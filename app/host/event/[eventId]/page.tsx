"use client";

// UI_VER: HOST_EVENT_UI_V6_STARTNOW_20260219

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Footer from "@/components/Footer";

const UI_VER = "HOST_EVENT_UI_V6_STARTNOW_20260219";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";

/* ================= util ================= */

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

function hoursUntil(ms: number, now: number) {
  const diff = ms - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (60 * 60 * 1000));
}

function daysUntil(ms: number, now: number) {
  const diff = ms - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("non_json_response");
  }
}

async function postFormJson<T>(url: string, fd: FormData): Promise<T> {
  const r = await fetch(url, { method: "POST", body: fd });
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("non_json_response");
  }
}

/* ================= types ================= */

type UiStatus = "reserved" | "running" | "viewable" | "ended" | "draft";

type HostEventGetResp =
  | {
      ok: true;
      marker?: string;
      event: {
        eventId: string;
        eventName: string;
        startAt: number;
        endAt: number;
        planId?: string;
      };
      status: "draft" | "reserved" | "running" | "ended";
      paused: boolean;
      now: number;
      expireAt: number;
      expired: boolean;
      viewable: boolean;
      caps: { canShowQr: boolean; canShoot: boolean; canViewAlbum: boolean };
    }
  | { ok: false; error: string };

type StartNowResp = { ok: true; marker?: string } | { ok: false; error: string };

function toUiStatus(api: HostEventGetResp & { ok: true }): UiStatus {
  if (api.status === "draft") return "draft";
  if (api.status === "reserved") return "reserved";
  if (api.status === "running") return "running";
  // ended のとき viewable なら閲覧可
  if (api.viewable) return "viewable";
  return "ended";
}

/* ================= component ================= */

export default function HostEventPage() {
  const router = useRouter();
  const params = useParams();
  const urlEventId = String((params as any)?.eventId || "").trim();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");

  const [startAt, setStartAt] = useState<number>(0);
  const [endAt, setEndAt] = useState<number>(0);

  const [paused, setPaused] = useState(false);
  const [expireAt, setExpireAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const [uiStatus, setUiStatus] = useState<UiStatus>("draft");
  const [caps, setCaps] = useState({
    canShowQr: true,
    canShoot: false,
    canViewAlbum: false,
  });

  const [startingNow, setStartingNow] = useState(false);

  const lastLoadRef = useRef<number>(0);

  /* ---------- load ---------- */
  const load = async () => {
    const now = Date.now();
    if (now - lastLoadRef.current < 700) return; // 連打防止
    lastLoadRef.current = now;

    setLoading(true);
    setErr("");

    try {
      if (!urlEventId) {
        router.replace("/host/home");
        return;
      }

      const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
      if (!token) {
        router.replace("/host/login");
        return;
      }

      const url =
        `${API_BASE}/host_event_get.php?` +
        `hostSessionToken=${encodeURIComponent(token)}&` +
        `eventId=${encodeURIComponent(urlEventId)}`;

      const data = await fetchJson<HostEventGetResp>(url);

      if (!data.ok) {
        if (data.error === "session_not_found_or_expired") {
          router.replace("/host/login");
          return;
        }
        if (data.error === "forbidden_event" || data.error === "event_not_found") {
          // 互換の localStorage を掃除
          localStorage.removeItem("omoticamera_eventId");
          localStorage.removeItem("omoticamera_eventName");
          localStorage.removeItem("omoticamera_eventStart");
          localStorage.removeItem("omoticamera_eventEnd");
          localStorage.removeItem("omoticamera_planId");
          router.replace("/host/home");
          return;
        }
        throw new Error(data.error || "host_event_get_failed");
      }

      setEventId(data.event.eventId);
      setEventName(String(data.event.eventName || "イベント名未設定"));

      setStartAt(Number(data.event.startAt || 0));
      setEndAt(Number(data.event.endAt || 0));

      setPaused(Boolean(data.paused));
      setExpireAt(Number(data.expireAt || 0));
      setExpired(Boolean(data.expired));
      setNowMs(Number(data.now || Date.now()));

      setCaps({
        canShowQr: Boolean(data.caps?.canShowQr),
        canShoot: Boolean(data.caps?.canShoot),
        canViewAlbum: Boolean(data.caps?.canViewAlbum),
      });

      setUiStatus(toUiStatus(data));

      // ✅ 互換のためlocalStorageも更新（他ページがまだ依存している想定）
      localStorage.setItem("omoticamera_eventId", data.event.eventId);
      localStorage.setItem("omoticamera_eventName", String(data.event.eventName || ""));
      if (data.event.startAt) localStorage.setItem("omoticamera_eventStart", String(data.event.startAt));
      if (data.event.endAt) localStorage.setItem("omoticamera_eventEnd", String(data.event.endAt));
      if (data.event.planId) localStorage.setItem("omoticamera_planId", String(data.event.planId));
    } catch (e: any) {
      setErr(String(e?.message || e || "failed"));
    } finally {
      setLoading(false);
      setReady(true);
    }
  };

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlEventId]);

  /* ---------- derived ---------- */

  const untilStartH = useMemo(() => {
    if (!startAt) return 0;
    return hoursUntil(startAt, nowMs || Date.now());
  }, [startAt, nowMs]);

  const untilExpireD = useMemo(() => {
    if (!expireAt) return 0;
    return daysUntil(expireAt, nowMs || Date.now());
  }, [expireAt, nowMs]);

  const pillText = useMemo(() => {
    if (uiStatus === "running") return "LIVE";
    if (uiStatus === "reserved") return "予約";
    if (uiStatus === "viewable") return "閲覧可";
    if (uiStatus === "draft") return "下書き";
    return "終了";
  }, [uiStatus]);

  // ✅ カメラ：開催中のみ（閲覧可は押せない）
  const showCamera = uiStatus === "running" || uiStatus === "reserved";
  const canOpenCamera = uiStatus === "running" && !paused && caps.canShoot;

  // ✅ アルバム：running/viewable で開ける（hostは期間中も閲覧できる想定）
  const showAlbum = uiStatus === "running" || uiStatus === "reserved" || uiStatus === "viewable" || uiStatus === "ended";
  const canOpenAlbum = (uiStatus === "running" || uiStatus === "viewable") && caps.canViewAlbum;

  // ✅ QR：reserved/running/viewable は表示（アルバム入口として viewable でも必要）
  const showQr = uiStatus === "viewable" || (caps.canShowQr && (uiStatus === "reserved" || uiStatus === "running"));

  // ✅ 「今すぐ開始」：reserved のときだけ
  const canStartNow = uiStatus === "reserved" && untilStartH > 0;

  /* ---------- nav ---------- */
  const goHome = () => router.push("/host/home");
  const goAccount = () => router.push("/host/account");
  const goQr = () => router.push("/host/qr");
  const goCamera = () => router.push("/host/camera");
  const goPhotos = () => router.push("/host/photos");

  const onClickCamera = () => {
    if (!canOpenCamera) return;
    goCamera();
  };

  const onClickPhotos = () => {
    if (!canOpenAlbum) return;
    goPhotos();
  };

  /* ---------- start now ---------- */
  const onStartNow = async () => {
  if (startingNow) return;

  const ok = confirm(
    "予定より早くイベントを開始しますか？\n" +
      "開始すると、元の開始時刻には戻せません。\n" +
      "（参加者が撮影できる状態になります）"
  );
  if (!ok) return;

  setStartingNow(true);

  try {
    const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
    if (!token) {
      router.replace("/host/login");
      return;
    }

    // ✅ URLの[eventId]を最優先（stateは空の瞬間があり得る）
    const eid = (urlEventId || eventId || "").trim();
    if (!eid) {
      alert("eventId が見つかりません（画面を開き直してください）");
      return;
    }

    const base =
      `${API_BASE}/host_event_start_now.php?` +
      `hostSessionToken=${encodeURIComponent(token)}&` +
      `eventId=${encodeURIComponent(eid)}&` +
      `id=${encodeURIComponent(eid)}&` +
      `eid=${encodeURIComponent(eid)}`;

    // 1) JSON で送る（php://input を読む実装向け）
    {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostSessionToken: token,
          eventId: eid,
          id: eid,
          eid: eid,
        }),
      });

      let j: any = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      if (j?.ok) {
        await load();
        return;
      }

      // JSONで event_not_found 系以外なら、ここで止めてメッセージ表示
      const e1 = String(j?.error || "");
      if (e1 && !/event_not_found|forbidden_event/i.test(e1)) {
        alert(`開始に失敗しました：${e1}`);
        return;
      }
      // event_not_found/forbidden_event っぽいなら次を試す
    }

    // 2) FormData で送る（$_POST / pick_req を読む実装向け）
    {
      const fd = new FormData();
      fd.append("hostSessionToken", token);
      fd.append("eventId", eid);
      fd.append("id", eid);
      fd.append("eid", eid);

      const r = await fetch(base, { method: "POST", body: fd });
      const text = await r.text();

      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {
        alert("開始に失敗しました：サーバー応答がJSONではありません\n" + text.slice(0, 300));
        return;
      }

      if (!j?.ok) {
        alert(`開始に失敗しました：${j?.error || "unknown_error"}`);
        return;
      }

      await load();
      return;
    }
  } catch {
    alert("通信エラーが発生しました");
  } finally {
    setStartingNow(false);
  }
};



  if (!ready) return null;

  return (
    <>
      {/* ✅ <main> の直前に入れる：アニメーションCSS */}
      <style>{`
        @keyframes pulseRed {
          0% { box-shadow: 0 0 0 0 rgba(176,0,32,0.45); }
          70% { box-shadow: 0 0 0 12px rgba(176,0,32,0); }
          100% { box-shadow: 0 0 0 0 rgba(176,0,32,0); }
        }
      `}</style>

      <main style={wrap}>
        <header style={topBar}>
          <div style={topInner}>
            <button onClick={goHome} style={btnGhostSmall} aria-label="マイページへ戻る">
              ← マイページ
            </button>

            <div style={topTitle}>イベント管理</div>

            <button onClick={goAccount} style={btnGhostSmall} aria-label="設定">
              ⚙️
            </button>
          </div>
        </header>

        <div style={body}>
          {err && <div style={errBox}>読み込み失敗：{err}</div>}

          {/* ========= 上カード ========= */}
          <section style={card}>
            <div style={eventNameRow}>
              <div style={eventNameLabel}>イベント名：</div>
              <div style={eventNameText}>{eventName || "イベント名未設定"}</div>
            </div>

            <div style={metaLine}>
              開始：{fmtDate(startAt)}
              <br />
              終了：{fmtDate(endAt)}
            </div>

            <div
              style={{
                ...pill,
                ...(uiStatus === "running"
                  ? pillLive
                  : uiStatus === "reserved"
                    ? pillReservedBlue
                    : uiStatus === "viewable"
                      ? pillViewableBlue
                      : pillGray),
              }}
            >
              {pillText}
              {paused && <span style={{ marginLeft: 8 }}>（停止中）</span>}
            </div>

            {/* ✅ reserved：開始まで + 右に「今すぐ開始」 */}
            {uiStatus === "reserved" && untilStartH > 0 && (
              <div style={countRow}>
                <div style={hintLine}>開始まであと {untilStartH} 時間</div>

                {canStartNow && (
                  <button
                    onClick={onStartNow}
                    style={{
                      ...btnStartNow,
                      ...(startingNow ? btnStartNowDisabled : null),
                    }}
                    disabled={startingNow}
                    aria-label="今すぐ開始する"
                  >
                    {startingNow ? "開始中…" : "今すぐ開始"}
                  </button>
                )}
              </div>
            )}

            {/* ✅ viewable：期限表示 */}
            {uiStatus === "viewable" && untilExpireD > 0 && (
              <div style={hintLine}>閲覧可能期限まであと {untilExpireD} 日</div>
            )}

            {/* ✅ ended */}
            {uiStatus === "ended" && <div style={hintLine}>閲覧可能期限が過ぎたため閲覧できません</div>}

            <div style={idLine}>eventId: {eventId || urlEventId}</div>
          </section>

          {/* ========= ボタン群 ========= */}
          <section style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {showQr && (
              <button
                onClick={goQr}
                style={btnPrimary}
                aria-label={uiStatus === "viewable" ? "アルバム閲覧用QRを表示" : "撮影参加用QRを表示"}
              >
                {uiStatus === "viewable" ? "アルバム閲覧用QRを表示" : "撮影参加用QRを表示"}
              </button>
            )}

            {showCamera && (
              <button
                onClick={onClickCamera}
                style={{
                  ...btnPrimary,
                  opacity: canOpenCamera ? 1 : 0.45,
                  cursor: canOpenCamera ? "pointer" : "not-allowed",
                }}
                disabled={!canOpenCamera}
                aria-label="カメラで撮影する"
              >
                📷 カメラで撮影する
                {!canOpenCamera && (
                  <span style={btnSub}>
                    {uiStatus === "reserved" ? "（開始すると使えます）" : paused ? "（停止中）" : "（利用できません）"}
                  </span>
                )}
              </button>
            )}

            {showAlbum && (
              <button
                onClick={onClickPhotos}
                style={{
                  ...btnGhost,
                  opacity: canOpenAlbum ? 1 : 0.45,
                  cursor: canOpenAlbum ? "pointer" : "not-allowed",
                }}
                disabled={!canOpenAlbum}
                aria-label="共有アルバムを開く"
              >
                共有アルバムを開く
                {!canOpenAlbum && (
                  <span style={btnSub}>
                    {uiStatus === "reserved"
                      ? "（イベント開始後に閲覧できます）"
                      : uiStatus === "ended"
                        ? "（閲覧終了）"
                        : "（準備中）"}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={load}
              style={{
                ...btnGhost,
                opacity: loading ? 0.6 : 1,
              }}
              disabled={loading}
              aria-label="最新情報に更新"
            >
              ↻ 最新情報に更新
            </button>
          </section>

          <Footer uiVer={UI_VER} showSupporters={false} />
        </div>
      </main>
    </>
  );
}

/* ================= styles ================= */

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
  padding: 10,
};

const topInner: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 8,
};

const topTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  textAlign: "center",
};

const body: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 10,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const eventNameRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "baseline",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 8,
};

const eventNameLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#444",
};

const eventNameText: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  textAlign: "center",
  lineHeight: 1.2,
};

const metaLine: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
  lineHeight: 1.35,
  textAlign: "center",
};

const pill: React.CSSProperties = {
  margin: "10px auto 0",
  width: "fit-content",
  padding: "6px 12px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  border: "1px solid rgba(0,0,0,0.12)",
};

const pillLive: React.CSSProperties = {
  background: "#B00020",
  color: "#fff",
  borderColor: "transparent",
};

const pillReservedBlue: React.CSSProperties = {
  background: "rgba(40,120,255,0.12)",
  color: "#1a4fd8",
  borderColor: "rgba(40,120,255,0.28)",
};

const pillViewableBlue: React.CSSProperties = {
  background: "rgba(40,120,255,0.10)",
  color: "#1a4fd8",
  borderColor: "rgba(40,120,255,0.25)",
};

const pillGray: React.CSSProperties = {
  background: "#fff",
  color: "#666",
};

const hintLine: React.CSSProperties = {
  marginTop: 8,
  textAlign: "center",
  fontSize: 12,
  fontWeight: 900,
  color: "#444",
};

const countRow: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const idLine: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  color: "#999",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  textAlign: "center",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const btnGhost: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
  color: "#111",
};

const btnGhostSmall: React.CSSProperties = {
  justifySelf: "start",
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const btnSub: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.9,
};

const btnStartNow: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(176,0,32,0.35)",
  background: "#fff",
  color: "#b00020",
  fontWeight: 900,
  cursor: "pointer",
  animation: "pulseRed 1.4s infinite",
};

const btnStartNowDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
  animation: "none",
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
