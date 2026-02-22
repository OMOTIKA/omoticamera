"use client";

// UI_VER: HOST_GUESTS_UI_V3_20260212

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

type Guest = {
  guestKey: string;
  nickname: string;
  createdAt: number;
  lastActiveAt: number;
  isDisabled: boolean;
  // 将来：blocked / disableCount などが来ても壊れないように
  [k: string]: any;
};

type ApiOk = {
  ok: true;
  marker: string;
  eventId: string;
  eventName: string;
  maxGuests: number; // 同時参加上限（端末）
  activeGuests: number; // 現在アクティブ（端末）
  page: number;
  per: number;
  pages: number;
  total: number;
  q: string;
  sort: string;
  guests: Guest[];
};

type ApiErr = {
  ok: false;
  error: string;
  marker?: string;
  message?: string;
};

function fmtAgo(ms: number) {
  if (!ms) return "-";
  const diff = Date.now() - ms;
  if (diff < 0) return "今";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  return `${day}日前`;
}

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export default function HostGuestsPage() {
  const UI_VER = "HOST_GUESTS_UI_V3_20260212";
  const router = useRouter();

  const [eventId, setEventId] = useState("");
  const [hostKey, setHostKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [eventName, setEventName] = useState("");
  const [maxGuests, setMaxGuests] = useState<number>(0);
  const [activeGuests, setActiveGuests] = useState<number>(0);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const per = 50;

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"active" | "new" | "name">("active");

  const debounceRef = useRef<number | null>(null);

  // 初期：localStorageから
  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");

    const eid = (localStorage.getItem("omoticamera_eventId") || "").trim();
    const hk = (localStorage.getItem("omoticamera_hostKey") || "").trim();

    setEventId(eid);
    setHostKey(hk);

    setQInput("");
    setQ("");

    if (!eid || !hk) {
      setErr("イベント情報がありません。ホスト（主催者）でログインしてから開いてください。");
    }
  }, []);

  // デバウンス：入力→0.35秒後に確定
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPage(1);
      setQ(qInput.trim());
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [qInput]);

  const mapErr = (code: string, msg?: string) => {
    // サーバ側の error を「画面表示向け」に変換
    if (code === "server_not_json") return "通信エラー（サーバ応答がJSONではありません）";
    if (code === "bad_eventId") return "イベント情報が不正です。";
    if (code === "missing_hostKey") return "ホスト権限が確認できません（hostKey）。";
    if (code === "hostKey_mismatch") return "認証エラー：ホスト情報が一致しません。";
    if (code === "event_folder_not_found" || code === "event_not_found") return "イベントが見つかりません。";

    // 復帰/停止まわり（本番仕様）
    if (code === "active_capacity_full") return "満席のため復帰できません（同時参加の上限に達しています）。";
    if (code === "device_blocked") return "この端末は復帰不可になりました（停止回数が上限に達しました）。";
    if (code === "guest_not_found") return "参加者が見つかりません（更新して再度お試しください）。";

    // 汎用
    return msg ? `通信エラー：${msg}` : `通信エラー：${code}`;
  };

  const fetchList = async (nextPage: number) => {
    if (!eventId || !hostKey) return;

    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams();
      params.set("eventId", eventId);
      params.set("hostKey", hostKey);
      params.set("page", String(nextPage));
      params.set("per", String(per));
      params.set("sort", sort);
      if (q) params.set("q", q);
      params.set("v", String(Date.now()));

      const url = `${API_BASE}/list_guests.php?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });

      const text = await res.text();
      let json: ApiOk | ApiErr;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("server_not_json");
      }

      if (!json || (json as any).ok !== true) {
        const e = (json as ApiErr)?.error || "failed";
        const m = (json as ApiErr)?.message;
        throw new Error(m ? `${e}|${m}` : e);
      }

      const ok = json as ApiOk;

      setEventName(ok.eventName || "");
      setMaxGuests(ok.maxGuests || 0);
      setActiveGuests(ok.activeGuests || 0);

      setGuests(ok.guests || []);
      setPage(ok.page || nextPage);
      setPages(ok.pages || 1);
    } catch (e: any) {
      const raw = String(e?.message || e || "failed");
      if (raw.includes("|")) {
        const [code, msg] = raw.split("|", 2);
        setErr(mapErr(code, msg));
      } else {
        setErr(mapErr(raw));
      }
    } finally {
      setLoading(false);
    }
  };

  // sort / q / eventId / hostKey 変更で取り直し
  useEffect(() => {
    if (!eventId || !hostKey) return;
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, hostKey, sort, q]);

  // 自動更新（表示中のみ）
  useEffect(() => {
    if (!eventId || !hostKey) return;

    const onVisibility = () => {
      if (!document.hidden) fetchList(page);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(() => {
      if (!document.hidden) fetchList(page);
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, hostKey, page, sort, q]);

  const disableGuest = async (guestKey: string) => {
    if (!eventId || !hostKey) return;

    const ok = confirm(
      "この端末を「停止」にします。\n停止後の新規撮影は無効になります。\n（過去の写真は残ります）\n\nよろしいですか？"
    );
    if (!ok) return;

    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams();
      params.set("eventId", eventId);
      params.set("hostKey", hostKey);
      params.set("guestKey", guestKey);
      params.set("v", String(Date.now()));

      const url = `${API_BASE}/disable_guest.php?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("server_not_json");
      }

      if (!json?.ok) {
        const code = String(json?.error || "disable_failed");
        const msg = String(json?.message || "");
        throw new Error(msg ? `${code}|${msg}` : code);
      }

      await fetchList(page);
    } catch (e: any) {
      const raw = String(e?.message || e || "failed");
      if (raw.includes("|")) {
        const [code, msg] = raw.split("|", 2);
        setErr(mapErr(code, msg));
      } else {
        setErr(mapErr(raw));
      }
    } finally {
      setLoading(false);
    }
  };

  const enableGuest = async (guestKey: string) => {
    if (!eventId || !hostKey) return;

    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams();
      params.set("eventId", eventId);
      params.set("hostKey", hostKey);
      params.set("guestKey", guestKey);
      params.set("v", String(Date.now()));

      const url = `${API_BASE}/enable_guest.php?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("server_not_json");
      }

      if (!json?.ok) {
        const code = String(json?.error || "enable_failed");
        const msg = String(json?.message || "");
        throw new Error(msg ? `${code}|${msg}` : code);
      }

      await fetchList(page);
    } catch (e: any) {
      const raw = String(e?.message || e || "failed");
      if (raw.includes("|")) {
        const [code, msg] = raw.split("|", 2);
        setErr(mapErr(code, msg));
      } else {
        setErr(mapErr(raw));
      }
    } finally {
      setLoading(false);
    }
  };

  const liveText = useMemo(() => {
    const mg = maxGuests ? String(maxGuests) : "—";
    return `LIVE 参加中 ${activeGuests}/${mg}`;
  }, [activeGuests, maxGuests]);

  const canPrev = page > 1 && !loading;
  const canNext = page < pages && !loading;

  return (
    <main style={wrap}>
      {/* ✅ 固定ヘッダー：戻る(左) / タイトル(中央) / QR(右) */}
      <header style={stickyTop}>
        <div style={topBar}>
          <button onClick={() => router.push("/host/dashboard")} style={btnBack}>
            戻る
          </button>

          <div style={centerBox}>
            <div style={title}>参加者一覧</div>
            <div style={livePill}>{liveText}</div>
          </div>

          <button onClick={() => router.push("/host/qr")} style={btnPrimarySmall}>
            QR
          </button>
        </div>

        <div style={subBar}>
          <div style={eventLine}>
            <span style={{ color: "#666", fontWeight: 900 }}>イベント：</span>
            <span style={eventNameText}>{eventName || "-"}</span>
          </div>
        </div>

        {/* 検索＋ソート（1段） */}
        <div style={controlsRow}>
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="ニックネーム検索"
            style={searchInput}
          />

          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as any);
            }}
            style={select}
            disabled={loading}
          >
            <option value="active">最終アクティブ</option>
            <option value="new">参加が新しい</option>
            <option value="name">名前順</option>
          </select>

          <button
            onClick={() => fetchList(page)}
            disabled={loading}
            style={{ ...btnGhostSmall, opacity: loading ? 0.6 : 1 }}
          >
            更新
          </button>
        </div>

        {err && <div style={errBar}>{err}</div>}
      </header>

      <div style={body}>
        {loading && guests.length === 0 ? (
          <div style={empty}>読み込み中…</div>
        ) : guests.length === 0 ? (
          <div style={empty}>参加者がいません</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {guests.map((g) => (
              <div
                key={g.guestKey}
                style={{
                  ...rowCard,
                  background: g.isDisabled ? "#f5f5f5" : "#fff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={nameLine}>
                    <span style={{ fontWeight: 900 }}>
                      {g.nickname || "（未設定）"}
                    </span>

                    {g.isDisabled ? (
                      <span style={disabledTag}>停止</span>
                    ) : (
                      <span style={activeTag}>参加中</span>
                    )}
                  </div>

                  {/* guestKeyは基本出さない（縦・横スクロール原因） */}
                  <div style={metaLine}>
                    <span>最終：{fmtAgo(g.lastActiveAt)}</span>
                    <span style={{ opacity: 0.8 }}>・</span>
                    <span>参加：{g.createdAt ? fmtAgo(g.createdAt) : "-"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {g.isDisabled ? (
                    <button
                      onClick={() => enableGuest(g.guestKey)}
                      disabled={loading}
                      style={{
                        ...btnGhostSmall,
                        minWidth: 66,
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      復帰
                    </button>
                  ) : (
                    <button
                      onClick={() => disableGuest(g.guestKey)}
                      disabled={loading}
                      style={{
                        ...btnGhostSmall,
                        minWidth: 66,
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      停止
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(g.guestKey || "");
                        alert("端末キーをコピーしました");
                      } catch {
                        alert("コピーできませんでした");
                      }
                    }}
                    style={{ ...btnGhostSmall, minWidth: 44 }}
                    disabled={!g.guestKey}
                    title="端末キーをコピー"
                  >
                    ID
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ページング（薄く） */}
        <div style={pager}>
          <button
            onClick={() => fetchList(Math.max(1, page - 1))}
            disabled={!canPrev}
            style={{ ...btnGhost, opacity: canPrev ? 1 : 0.5 }}
          >
            前へ
          </button>

          <div style={pageInfo}>
            {page}/{pages}
          </div>

          <button
            onClick={() => fetchList(page + 1)}
            disabled={!canNext}
            style={{ ...btnGhost, opacity: canNext ? 1 : 0.5 }}
          >
            次へ
          </button>
        </div>

        {/* ✅ フッター：英語表記（スポンサーは非表示のまま） */}
        <Footer uiVer={UI_VER} showSupporters={false} />
      </div>
    </main>
  );
}

/* ---------------- styles ---------------- */

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fff",
  color: "#111",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const stickyTop: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: "10px 10px 8px",
};

const topBar: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "74px 1fr 54px",
  alignItems: "center",
  gap: 8,
};

const centerBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
  gap: 6,
};

const title: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
  textAlign: "center",
};

const livePill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "3px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fafafa",
  color: "#111",
  textAlign: "center",
  maxWidth: "100%",
};

const subBar: React.CSSProperties = {
  maxWidth: 520,
  margin: "8px auto 0",
};

const eventLine: React.CSSProperties = {
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const eventNameText: React.CSSProperties = {
  fontWeight: 900,
  color: "#111",
};

const controlsRow: React.CSSProperties = {
  maxWidth: 520,
  margin: "8px auto 0",
  display: "grid",
  gridTemplateColumns: "1fr 120px 70px",
  gap: 8,
  alignItems: "center",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const select: React.CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 13,
  background: "#fff",
  fontWeight: 900,
};

const errBar: React.CSSProperties = {
  maxWidth: 520,
  margin: "8px auto 0",
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};

const body: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 10,
};

const empty: React.CSSProperties = {
  padding: 10,
  fontSize: 13,
  color: "#666",
};

const rowCard: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: "9px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const nameLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  lineHeight: 1.2,
  minWidth: 0,
};

const activeTag: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  color: "#111",
  whiteSpace: "nowrap",
};

const disabledTag: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  color: "#777",
  whiteSpace: "nowrap",
};

const metaLine: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#666",
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const pager: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 80px 1fr",
  gap: 8,
  alignItems: "center",
  marginTop: 10,
};

const pageInfo: React.CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 900,
  color: "#666",
};

const btnGhost: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
};

const btnPrimarySmall: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
  minWidth: 54,
};

const btnGhostSmall: React.CSSProperties = {
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const btnBack: React.CSSProperties = {
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};