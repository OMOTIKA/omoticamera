"use client";

// UI_VER: HOST_HOME_UI_V7_20260219

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import PrototypeNote from "@/components/PrototypeNote";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";
// “ゲストとして参加中” のイベントID（今は端末保持。将来サーバーへ寄せやすい形）
const LS_KEY_GUEST_JOINED_EVENT_IDS = "omoticamera_guest_joined_eventIds";

// ---------------- types ----------------

type HostSessionResp =
  | { ok: true; marker: string; accountId: string; email: string; expiresAtMs: number }
  | { ok: false; error: string };

type HostListEventsResp =
  | {
      ok: true;
      marker: string;
      accountId: string;
      email: string;
      events: Array<{
        eventId: string;
        eventName: string;
        planId?: string;
        startAt?: number;
        endAt?: number;
        maxGuests?: number;
        createdAt?: number;
        updatedAt?: number;
        currentGuests?: number; // 将来
      }>;
    }
  | { ok: false; error: string };

type MetaResp =
  | {
      ok: true;
      marker: string;
      eventId: string;
      eventName: string;
      startAt: number;
      endAt: number;
      storageDays: number;
      albumOpen: boolean;
      expireAt: number;
      expired: boolean;
      now: number;
    }
  | { ok: false; error: string };

type UiEvent = {
  eventId: string;
  eventName: string;

  planId: string;
  maxGuests: number;

  startAt: number;
  endAt: number;

  currentGuests: number;

  updatedAt: number;
  createdAt: number;

  storageDays: number;
  albumOpen: boolean;
  expireAt: number;
  expired: boolean;

  isGuestJoin: boolean;
};

const PLANS: Array<{ planId: string; label: string; priceYen: number; maxGuests: number }> = [
  { planId: "starter", label: "スターター", priceYen: 0, maxGuests: 10 },
  { planId: "basic", label: "ベーシック", priceYen: 2000, maxGuests: 25 },
  { planId: "premium", label: "プレミアム", priceYen: 8000, maxGuests: 100 },
  { planId: "elite", label: "エリート", priceYen: 20000, maxGuests: 250 },
  { planId: "business", label: "ビジネス", priceYen: 65000, maxGuests: 500 },
];

function planLabel(planId?: string) {
  const p = PLANS.find((x) => x.planId === planId);
  return p ? p.label : "不明";
}

function fmtDate(ms?: number) {
  if (!ms) return "-";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function hoursUntil(ms: number) {
  const diff = ms - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (60 * 60 * 1000));
}

type Bucket = "running" | "upcoming" | "past";

function bucketOf(e: UiEvent): Bucket {
  const now = Date.now();
  if (e.startAt && e.endAt && e.startAt <= now && now < e.endAt) return "running";
  if (e.startAt && now < e.startAt) return "upcoming";
  return "past";
}

type PastSort = "new" | "old" | "end_desc" | "end_asc";

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    const j = JSON.parse(s);
    return j as T;
  } catch {
    return fallback;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}

export default function HostHomePage() {
  const UI_VER = "HOST_HOME_UI_V7_20260219";
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState(""); // ※トップでは非表示（内部保持だけ）
  const [accountId, setAccountId] = useState("");

  // プロフィール（サーバー保存が本線。現状API未実装でも落ちない）
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [events, setEvents] = useState<UiEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // イベント一覧（開閉）& ソート（pastのみ）
  const [pastOpen, setPastOpen] = useState(false);
  const [pastSort, setPastSort] = useState<PastSort>("new");

  const lastLoadRef = useRef<number>(0);

  const goAccount = () => router.push("/host/account");
  const goScanJoinQr = () => router.push("/host/scan");
  const goCreate = () => router.push("/host/create");

  const logout = () => {
    const ok = confirm("ログアウトしますか？");
    if (!ok) return;

    localStorage.removeItem("omoticamera_hostSessionToken");
    localStorage.removeItem("omoticamera_role");

    localStorage.removeItem("omoticamera_hostKey");
    localStorage.removeItem("omoticamera_eventId");
    localStorage.removeItem("omoticamera_eventName");
    localStorage.removeItem("omoticamera_eventStart");
    localStorage.removeItem("omoticamera_eventEnd");
    localStorage.removeItem("omoticamera_planId");

    router.replace("/host/login");
  };

  const loadAll = async () => {
    const now = Date.now();
    if (now - lastLoadRef.current < 700) return; // 連打防止
    lastLoadRef.current = now;

    setErr("");
    setLoading(true);

    try {
      const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
      if (!token) {
        router.replace("/host/login");
        return;
      }

      // 1) セッション
      const sessUrl = `${API_BASE}/auth/host_session_check.php?hostSessionToken=${encodeURIComponent(token)}`;
      const sess = await fetchJson<HostSessionResp>(sessUrl);
      if (!sess.ok) throw new Error(sess.error || "session_not_found_or_expired");
      setEmail(sess.email || "");
      setAccountId(sess.accountId || "");

      // 2) プロフィール（あれば取得。無くてもOK）
      try {
        const profUrl = `${API_BASE}/host_profile_get.php?hostSessionToken=${encodeURIComponent(token)}`;
        const pj = await fetchJson<any>(profUrl);
        if (pj?.ok && pj?.profile) {
          const nn = String(pj.profile.nickname || "").trim();
          const av = String(pj.profile.avatarUrl || pj.profile.avatar || "").trim();
          if (nn) setNickname(nn);
          if (av) setAvatarUrl(av);
        }
      } catch {
        // noop
      }

      // 3) ホストイベント一覧
      const listUrl = `${API_BASE}/host_list_events.php?hostSessionToken=${encodeURIComponent(token)}`;
      const list = await fetchJson<HostListEventsResp>(listUrl);
      if (!list.ok) throw new Error(list.error || "host_list_events_failed");

      // 4) ゲスト参加eventId（端末保持）
      const guestIds = safeJsonParse<string[]>(
        localStorage.getItem(LS_KEY_GUEST_JOINED_EVENT_IDS) || "[]",
        []
      ).filter((x) => typeof x === "string" && x.length > 0);

      const hostEvents = list.events || [];
      const hostIdSet = new Set(hostEvents.map((e) => e.eventId));
      const guestOnlyIds = guestIds.filter((id) => !hostIdSet.has(id));

      // 5) meta補完（閲覧期間等）
      const metaTargets: Array<{ eventId: string; src: "host" | "guest" }> = [
        ...hostEvents.map((e) => ({ eventId: e.eventId, src: "host" as const })),
        ...guestOnlyIds.map((id) => ({ eventId: id, src: "guest" as const })),
      ];

      const metas = await Promise.all(
        metaTargets.map(async (t) => {
          const url = `${API_BASE}/meta.php?eventId=${encodeURIComponent(t.eventId)}`;
          try {
            const mj = await fetchJson<MetaResp>(url);
            if (!mj.ok) return null;
            return { ...mj, _src: t.src } as any;
          } catch {
            return null;
          }
        })
      );

      const metaMap = new Map<string, any>();
      for (const m of metas) {
        if (m && m.eventId) metaMap.set(m.eventId, m);
      }

      const uiHost: UiEvent[] = hostEvents.map((e) => {
        const m = metaMap.get(e.eventId);
        const startAt = Number(e.startAt || m?.startAt || 0);
        const endAt = Number(e.endAt || m?.endAt || 0);

        const pid = String(e.planId || "").trim();
        return {
          eventId: e.eventId,
          eventName: String(e.eventName || m?.eventName || "（未設定）"),

          planId: pid || "unknown",
          maxGuests: Number(e.maxGuests || 0),

          startAt,
          endAt,

          currentGuests: Number((e as any).currentGuests || 0),

          updatedAt: Number(e.updatedAt || 0),
          createdAt: Number(e.createdAt || 0),

          storageDays: Number(m?.storageDays || 15),
          albumOpen: Boolean(m?.albumOpen || false),
          expireAt: Number(m?.expireAt || 0),
          expired: Boolean(m?.expired || false),

          isGuestJoin: guestIds.includes(e.eventId),
        };
      });

      const uiGuestOnly: UiEvent[] = guestOnlyIds.map((id) => {
        const m = metaMap.get(id);
        return {
          eventId: id,
          eventName: String(m?.eventName || "（イベント名未取得）"),

          planId: "unknown",
          maxGuests: Number(m?.maxGuests || 0),

          startAt: Number(m?.startAt || 0),
          endAt: Number(m?.endAt || 0),

          currentGuests: 0,

          updatedAt: 0,
          createdAt: 0,

          storageDays: Number(m?.storageDays || 15),
          albumOpen: Boolean(m?.albumOpen || false),
          expireAt: Number(m?.expireAt || 0),
          expired: Boolean(m?.expired || false),

          isGuestJoin: true,
        };
      });

      const all = [...uiHost, ...uiGuestOnly];

      // 表示順：running → upcoming → past、各カテゴリ内は新しい順
      const score = (b: Bucket) => (b === "running" ? 0 : b === "upcoming" ? 1 : 2);
      all.sort((a, b) => {
        const ba = bucketOf(a);
        const bb = bucketOf(b);
        const sa = score(ba);
        const sb = score(bb);
        if (sa !== sb) return sa - sb;

        const ta = a.updatedAt || a.createdAt || a.endAt || a.startAt || 0;
        const tb = b.updatedAt || b.createdAt || b.endAt || b.startAt || 0;
        return tb - ta;
      });

      setEvents(all);
      setReady(true);
    } catch (e: any) {
      setErr(String(e?.message || e || "failed"));
      setReady(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");
    const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
    if (!token) {
      router.replace("/host/login");
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const myPageTitle = useMemo(() => {
    const n = (nickname || "").trim();
    if (!n) return "マイページ";
    return `${n}さんのマイページ`;
  }, [nickname]);

  const displayNick = useMemo(() => (nickname || "").trim() || "（未設定）", [nickname]);

  const running = useMemo(() => events.filter((e) => bucketOf(e) === "running"), [events]);
  const upcoming = useMemo(() => events.filter((e) => bucketOf(e) === "upcoming"), [events]);
  const pastAll = useMemo(() => events.filter((e) => bucketOf(e) === "past"), [events]);

  const pastSorted = useMemo(() => {
    const arr = [...pastAll];
    const keyNew = (e: UiEvent) => e.updatedAt || e.createdAt || e.endAt || e.startAt || 0;
    if (pastSort === "new") arr.sort((a, b) => keyNew(b) - keyNew(a));
    if (pastSort === "old") arr.sort((a, b) => keyNew(a) - keyNew(b));
    if (pastSort === "end_desc") arr.sort((a, b) => (b.endAt || 0) - (a.endAt || 0));
    if (pastSort === "end_asc") arr.sort((a, b) => (a.endAt || 0) - (b.endAt || 0));
    return arr;
  }, [pastAll, pastSort]);

  const openHostEventHub = (e: UiEvent) => {
  localStorage.setItem("omoticamera_eventId", e.eventId);
  localStorage.setItem("omoticamera_eventName", e.eventName || "");
  if (e.startAt) localStorage.setItem("omoticamera_eventStart", String(e.startAt));
  if (e.endAt) localStorage.setItem("omoticamera_eventEnd", String(e.endAt));
  if (e.planId) localStorage.setItem("omoticamera_planId", String(e.planId));

  router.push("/host/event"); // ← ここ固定
};

  const openGuestJoin = (e: UiEvent) => {
    router.push(`/join?eventId=${encodeURIComponent(e.eventId)}`);
  };

  const EventCard = ({ e }: { e: UiEvent }) => {
  const b = bucketOf(e);

  const badge =
  b === "running"
    ? { text: "LIVE", style: pillLive }
    : b === "upcoming"
      ? { text: "予約", style: pillDraft }
      : { text: e.expired ? "終了" : "閲覧可", style: e.expired ? pillEnded : pillViewable };


  const titleText = e.isGuestJoin ? `${e.eventName}（ゲスト参加）` : e.eventName;

  const current = Number(e.currentGuests || 0);
  const max = Number(e.maxGuests || 0);

  const untilH = e.startAt ? hoursUntil(e.startAt) : 0;
  const showUntil = b === "upcoming" && untilH > 0;

  const onClick = () => {
    if (e.isGuestJoin) return openGuestJoin(e);
    return openHostEventHub(e);
  };

  return (
    <button onClick={onClick} style={eventCardBase}>
      <div style={eventTopRow}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={eventName}>{titleText || "（無題）"}</div>

          {!e.isGuestJoin && <div style={planLine}>プラン：{planLabel(e.planId)}</div>}

          <div style={metaLine}>
            開始：{fmtDate(e.startAt)}
            <br />
            終了：{fmtDate(e.endAt)}
          </div>

          <div style={metaLine2}>
            参加：{current} / {max || "-"}
            {showUntil && <span style={untilBadge}>　開始まであと {untilH} 時間</span>}
          </div>
        </div>

        <div style={eventBadgeCol}>
          <span style={{ ...pillBase, ...badge.style }}>{badge.text}</span>
          {e.isGuestJoin && <span style={{ ...pillBase, ...pillGuest }}>ゲスト参加</span>}
        </div>
      </div>
    </button>
  );
};


  if (!ready) return null;
    return (
    <main style={wrap}>
      {/* ヘッダー */}
      <header style={topBar}>
        <div style={topInner}>
          {/* 左：設定 */}
          <div style={leftIcons}>
            <button onClick={goAccount} style={iconBtnLg} aria-label="設定">
              <img src="/settings.png" alt="settings" style={iconImgLg} />
            </button>
          </div>

          {/* 中央：ブランド + タイトル */}
          <div style={centerHead}>
            <div style={brand}>どこでもオモチカメラ</div>
            <div style={title}>{myPageTitle}</div>
          </div>

          {/* 右：ログアウト */}
          <div style={{ display: "flex", justifyContent: "end" }}>
            <button onClick={logout} style={btnLogout}>
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

        {/* アバター */}
        <div style={avatarArea}>
          <div style={avatarWrap}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" style={avatarImg} />
            ) : (
              <div style={avatarPlaceholder}>No</div>
            )}
          </div>

          <div style={nickBig}>{displayNick}</div>

          {/* QR：親指圏 */}
          <button onClick={goScanJoinQr} style={qrFloatingBtn} aria-label="QRを読み込む（ゲスト参加）">
            <img src="/qrcode.png" alt="qrcode" style={qrIconImg} />
          </button>
        </div>

        {/* 新規イベント作成 */}
        <section style={createCard}>
          {/* 外枠と内枠の間：タイトル（センター） */}
          <div style={sectionBetweenTitle}>新規イベント作成</div>

          {/* 内枠 */}
          <button onClick={goCreate} style={btnCreate} aria-label="新規イベントを作成">
            <span style={createInner}>
              <img src="/Event.png" alt="event" style={eventIconImg} />
            </span>
          </button>

          <div style={ruleNote}>※ 同時に開催できるイベントは1件までです（全プラン共通）</div>
        </section>

        {/* イベント一覧 */}
{/* イベント一覧 */}
<section style={{ ...card, marginTop: 12, marginBottom: 12 }}>
  {/* 外枠と内枠の間：タイトル（センター） */}
  <div style={sectionBetweenTitle}>イベント一覧</div>

  {/* 内枠：内枠“全体”クリックで開閉。右に↻（同じ内枠内） */}
  <div
    style={listInnerBoxClickable}
    role="button"
    tabIndex={0}
    aria-label="イベント一覧を開閉"
    onClick={() => setPastOpen((v) => !v)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") setPastOpen((v) => !v);
    }}
  >
    {/* 中央：Event_List.png（内枠センター固定） */}
    <img src="/Event_List.png" alt="イベント一覧" style={listCenterIconImg} />

    {/* 右固定：更新（親のonClickを止める） */}
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void loadAll();
      }}
      style={{ ...btnMini, ...listRefreshBtn, opacity: loading ? 0.55 : 1 }}
      disabled={loading}
      aria-label="一覧を更新"
    >
      ↻
    </button>
  </div>

  {/* 開いた中（ここに「開催中」「予約」「過去」全部出す。ソートはpastだけ） */}
  {pastOpen && (
    <div style={{ marginTop: 10 }}>
      {/* 開催中 */}
      {running.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={subTitle}>開催中</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {running.map((e) => (
              <EventCard key={e.eventId} e={e} />
            ))}
          </div>
        </div>
      )}

      {/* 予約 */}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={subTitle}>予約</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {upcoming.map((e) => (
              <EventCard key={e.eventId} e={e} />
            ))}
          </div>
        </div>
      )}

      {/* 過去（閲覧可/終了） + ソート */}
      {pastAll.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={pastRowTop}>
            <div style={subTitle}>閲覧可 / 終了</div>

            {/* ソート（pastOpen内のみ） */}
            <select
              value={pastSort}
              onChange={(e) => setPastSort(e.target.value as PastSort)}
              style={pastSortSelect}
              aria-label="過去イベントの並び替え"
            >
              <option value="new">新しい順</option>
              <option value="old">古い順</option>
              <option value="end_desc">終了が新しい順</option>
              <option value="end_asc">終了が古い順</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {pastSorted.map((e) => (
              <EventCard key={e.eventId} e={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  )}

  {/* 0件表示（開閉関係なく） */}
  {events.length === 0 && !loading && (
    <div style={empty}>
      まだイベントがありません。
      <div style={emptySub}>まずは「＋」から作成してください。</div>
    </div>
  )}
</section>

{/* ✅ CANON（Footer）との余白を「12」で統一 */}
<div style={{ marginTop: 12 }}>
  <Footer uiVer={UI_VER} showSupporters={false} />
</div>
<PrototypeNote />
<div style={uiVer}>UI_VER: {UI_VER}</div>
      </div>
    </main>
  );
}


/* ---------------- styles ---------------- */

/* ✅ イベント一覧 内枠（横長・内枠全体クリック・中央アイコン・右↻同枠内） */
const listInnerBoxClickable: React.CSSProperties = {
  width: "100%",
  padding: 12, // ✅ 新規イベント作成の内枠と揃える
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fff",
  position: "relative", // ✅ ↻を右固定
  display: "grid",
  placeItems: "center", // ✅ 中央を“絶対センター”
  minHeight: 64,
  cursor: "pointer",
  userSelect: "none",
};

const pastRowTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fff",
  color: "#111",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const topBar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: "10px 10px",
};

const topInner: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "76px 1fr 88px",
  alignItems: "center",
  gap: 8,
};

const leftIcons: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const iconBtnLg: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  display: "grid",
  placeItems: "center",
  padding: 0,
};

const iconImgLg: React.CSSProperties = {
  width: 30,
  height: 30,
  objectFit: "contain",
  display: "block",
};

const centerHead: React.CSSProperties = {
  textAlign: "center",
  minWidth: 0,
};

const brand: React.CSSProperties = {
  fontSize: "clamp(16px, 5.0vw, 22px)",
  fontWeight: 900,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};

const title: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 900,
  color: "#666",
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};

const btnLogout: React.CSSProperties = {
  justifySelf: "end",
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const body: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: "10px 10px 16px",
};

const avatarArea: React.CSSProperties = {
  position: "relative",
  display: "grid",
  justifyItems: "center",
  paddingTop: 14,
  paddingBottom: 10,
};

const avatarWrap: React.CSSProperties = {
  width: 94,
  height: 94,
  borderRadius: 999,
  overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
};

const avatarImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const avatarPlaceholder: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  color: "#777",
};

const nickBig: React.CSSProperties = {
  marginTop: 10,
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.05,
};

const qrFloatingBtn: React.CSSProperties = {
  position: "absolute",
  right: 14,
  top: "43%",
  transform: "translateY(-50%)",
  width: 62,
  height: 62,
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  display: "grid",
  placeItems: "center",
  padding: 0,
  boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
};

const qrIconImg: React.CSSProperties = {
  width: 44,
  height: 44,
  objectFit: "contain",
  display: "block",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const createCard: React.CSSProperties = {
  ...card,
  background: "rgba(40,120,255,0.06)",
  border: "1px solid rgba(40,120,255,0.18)",
};

const sectionBetweenTitle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 16,
  fontWeight: 900,
  color: "#444",
  marginBottom: 10,
};

const btnCreate: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 18,
  display: "grid",
  placeItems: "center",
};

const createInner: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
};

const eventIconImg: React.CSSProperties = {
  width: 26,
  height: 26,
  objectFit: "contain",
  display: "block",
};

const ruleNote: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  fontWeight: 900,
  color: "#666",
  lineHeight: 1.35,
  textAlign: "center",
};

/* ✅ イベント一覧 内枠（横長・中央ボタン・右↻同枠内） */
const listInnerBox: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fff",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center", // ✅ 中央を常にセンターに固定
  minHeight: 64,
};

const listCenterIconImg: React.CSSProperties = {
  width: 26,
  height: 26,
  objectFit: "contain",
  display: "block",
};

const listRefreshBtn: React.CSSProperties = {
  position: "absolute",
  right: 6, // ✅ paddingと同じで揃える
  top: "50%",
  transform: "translateY(-50%)",
};

const btnMini: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 18,
  display: "grid",
  placeItems: "center",
};

const subTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#444",
};

const eventCardBase: React.CSSProperties = {
  textAlign: "left",
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fff",
  cursor: "pointer",
  overflow: "hidden",
};

const eventCardBig: React.CSSProperties = {
  padding: 12,
};

const eventCardSmall: React.CSSProperties = {
  padding: 10,
};

const eventTopRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  alignItems: "start",
};

const eventName: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const planLine: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  fontWeight: 900,
  color: "#444",
};

const metaLine: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#666",
  fontWeight: 800,
  lineHeight: 1.25,
};

const metaLine2: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#666",
  fontWeight: 900,
  lineHeight: 1.25,
  whiteSpace: "nowrap",
};

const untilBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#111",
};

const eventBadgeCol: React.CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "end",
  flexShrink: 0,
};

const pillBase: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "5px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  border: "1px solid rgba(0,0,0,0.10)",
  boxSizing: "border-box",
  maxWidth: "100%",
};

const pillLive: React.CSSProperties = {
  background: "#B00020",
  color: "#fff",
  borderColor: "transparent",
};

const pillDraft: React.CSSProperties = {
  background: "#f4f4f4",
  color: "#666",
};

const pillViewable: React.CSSProperties = {
  background: "#fff",
  color: "#111",
};

const pillEnded: React.CSSProperties = {
  background: "#fff",
  color: "#999",
};

const pillGuest: React.CSSProperties = {
  background: "#fff",
  color: "#0b5",
  border: "1px solid rgba(0,180,80,0.25)",
};

const pastSortRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const pastSortSelect: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
};

const empty: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px dashed rgba(0,0,0,0.14)",
  background: "#fff",
  fontSize: 13,
  color: "#666",
  fontWeight: 800,
};

const emptySub: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
  marginTop: 6,
  lineHeight: 1.35,
};

const errBox: React.CSSProperties = {
  marginBottom: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};

const uiVer: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  opacity: 0.35,
  textAlign: "center",
};