// /Users/akitomosakai/omochicamera/app/host/qr/[eventId]/page.tsx
"use client";

// UI_VER: HOST_QR_BY_EVENTID_UI_V1_20260219

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Footer from "@/components/Footer";
import { QRCodeCanvas } from "qrcode.react";

const UI_VER = "HOST_QR_BY_EVENTID_UI_V1_20260219";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";

type HostEventGetResp =
  | {
      ok: true;
      marker: string;
      accountId: string;
      email: string;
      expiresAtMs: number;
      event: {
        eventId: string;
        eventName: string;
        planId?: string;
        startAt: number;
        endAt: number;
        maxGuests?: number;
        maxPhotos?: number;
        storageDays: number;
        createdAt?: number;
        updatedAt?: number;
      };
      status: "draft" | "reserved" | "running" | "ended";
      paused: boolean;
      now: number;
      expireAt: number;
      expired: boolean;
      viewable: boolean;
      album: { albumUrl: string; albumExpiresAt: number };
      caps: { canShowQr: boolean; canShoot: boolean; canViewAlbum: boolean };
    }
  | { ok: false; error: string };

type UiStatus = "reserved" | "running" | "viewable" | "ended" | "draft";

function toUiStatus(api: HostEventGetResp & { ok: true }): UiStatus {
  if (api.status === "draft") return "draft";
  if (api.status === "reserved") return "reserved";
  if (api.status === "running") return "running";
  // ended
  if (api.viewable) return "viewable";
  return "ended";
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

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}

export default function HostQrByEventIdPage() {
  const router = useRouter();
  const params = useParams();
  const urlEventId = String((params as any)?.eventId || "").trim();

  // ---- state (Hooksはここで全部宣言する：順番固定) ----
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");

  const [startAt, setStartAt] = useState<number>(0);
  const [endAt, setEndAt] = useState<number>(0);

  const [paused, setPaused] = useState<boolean>(false);
  const [uiStatus, setUiStatus] = useState<UiStatus>("draft");

  const [caps, setCaps] = useState<{ canShowQr: boolean; canShoot: boolean; canViewAlbum: boolean }>({
    canShowQr: true,
    canShoot: false,
    canViewAlbum: false,
  });

  const qrRef = useRef<HTMLCanvasElement | null>(null);

  // ✅ Hooksは条件分岐より上に必ず置く（ここが今回のエラー対策の本体）
  const joinUrl = useMemo(() => {
    const eid = eventId || urlEventId;
    if (!eid) return "";
    return `${location.origin}/join?eventId=${encodeURIComponent(eid)}`;
  }, [eventId, urlEventId]);

  const canShowQr = useMemo(() => {
    // 要件：reserved / running / viewable ならQRは出す（閲覧可はアルバム入口だから）
    if (!caps.canShowQr) return false;
    return uiStatus === "reserved" || uiStatus === "running" || uiStatus === "viewable";
  }, [caps.canShowQr, uiStatus]);

  const canOpenCamera = useMemo(() => {
    // ✅ 要件：閲覧可では撮影できない（runningのみ）
    return uiStatus === "running" && !paused && caps.canShoot;
  }, [uiStatus, paused, caps.canShoot]);

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      localStorage.setItem("omoticamera_role", "host");

      if (!urlEventId) {
        router.replace("/host/home");
        return;
      }

      const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
      if (!token) {
        router.replace("/host/login");
        return;
      }

      const apiUrl =
        `${API_BASE}/host_event_get.php` +
        `?hostSessionToken=${encodeURIComponent(token)}` +
        `&eventId=${encodeURIComponent(urlEventId)}`;

      const data = await fetchJson<HostEventGetResp>(apiUrl);

      if (!data.ok) {
        if (data.error === "session_not_found_or_expired") {
          router.replace("/host/login");
          return;
        }
        if (data.error === "forbidden_event" || data.error === "event_not_found") {
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
      setUiStatus(toUiStatus(data));

      setCaps({
        canShowQr: Boolean(data.caps?.canShowQr),
        canShoot: Boolean(data.caps?.canShoot),
        canViewAlbum: Boolean(data.caps?.canViewAlbum),
      });

      // ✅ 互換のためlocalStorageも更新（他ページが依存している前提）
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
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlEventId]);

  const goMyPage = () => router.push("/host/home");
  const goEvent = () => router.push(`/host/event/${encodeURIComponent(urlEventId || eventId)}`);
  const goCamera = () => router.push("/host/camera");
  const goPhotos = () => router.push("/host/photos");

  const onClickCamera = () => {
    if (!canOpenCamera) return;
    goCamera();
  };

  const downloadQrPng = () => {
    try {
      const canvas = qrRef.current;
      if (!canvas) throw new Error("qr_not_ready");

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `omoticamera-qr-${(eventId || urlEventId || "event").slice(0, 12)}.png`;
      a.click();
    } catch (e: any) {
      setErr(`QRの保存に失敗しました：${String(e?.message || e || "failed")}`);
    }
  };

  // ---- render ----
  if (!ready) return null;

  const statusLabel =
    uiStatus === "running"
      ? "LIVE"
      : uiStatus === "reserved"
        ? "予約"
        : uiStatus === "viewable"
          ? "閲覧可"
          : uiStatus === "draft"
            ? "下書き"
            : "終了";

  return (
    <main style={wrap}>
      <header style={topBar}>
        <div style={topInner}>
          <button onClick={goMyPage} style={btnTopRight} aria-label="マイページへ戻る">
            マイページ
          </button>
          <div style={topTitle}>撮影参加用QR</div>
          <button onClick={goEvent} style={btnTopRight} aria-label="イベントへ戻る">
            イベント
          </button>
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

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

          <div style={{ ...pill, ...(uiStatus === "running" ? pillLive : uiStatus === "reserved" ? pillReserved : uiStatus === "viewable" ? pillViewable : pillGray) }}>
            {statusLabel}
            {paused && <span style={{ marginLeft: 8 }}>（停止中）</span>}
          </div>

          <div style={idLine}>eventId: {eventId || urlEventId}</div>
        </section>

        {/* QR */}
        <section style={qrCard}>
          {canShowQr ? (
            <>
              <div style={appNoNeed}>アプリのインストール不要</div>
              <div style={qrWrap}>
                <QRCodeCanvas
                  value={joinUrl || "about:blank"}
                  size={190}
                  level="M"
                  ref={(node) => {
                    // @ts-ignore
                    qrRef.current = node;
                  }}
                />
              </div>
              <div style={hintLine}>
                ※ このQRは「参加」だけでなく、{uiStatus === "viewable" ? "共有アルバムの入口" : "イベント参加の入口"}として使えます。
              </div>
            </>
          ) : (
            <div style={centerNote}>
              このステータスではQRを表示しません。
              <div style={{ marginTop: 8 }}>
                <button onClick={goEvent} style={btnGhost}>
                  イベントへ戻る
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 操作 */}
        <section style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {/* ✅ カメラ：runningのみ押せる（viewableで押せるバグ修正） */}
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
            {!canOpenCamera && <span style={btnSub}>（開催中のみ）</span>}
          </button>

          {/* アルバム：ホストは「開催中 or 閲覧可」で見れる想定（/host/event側のcaps運用に合わせる） */}
          <button onClick={goPhotos} style={btnGhost} aria-label="共有アルバムを開く">
            共有アルバムを開く
          </button>

          {/* DL */}
          <button onClick={downloadQrPng} style={btnGhost} aria-label="QRコードのダウンロード">
            QRコードのダウンロード
          </button>

          {/* 更新 */}
          <button
            onClick={load}
            style={{ ...btnGhost, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
            aria-label="最新情報に更新"
          >
            ↻ 最新情報に更新
          </button>
        </section>

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
  textAlign: "center",
  fontSize: 16,
  fontWeight: 900,
};

const btnTopRight: React.CSSProperties = {
  justifySelf: "start",
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
  padding: "8px 10px 16px",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
  marginTop: 10,
};

const qrCard: React.CSSProperties = {
  ...card,
  marginTop: 8,
  background: "#fff",
};

const eventNameRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "baseline",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 6,
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

const pillReserved: React.CSSProperties = {
  background: "rgba(40,120,255,0.12)",
  color: "#1a4fd8",
  borderColor: "rgba(40,120,255,0.28)",
};

const pillViewable: React.CSSProperties = {
  background: "rgba(40,120,255,0.10)",
  color: "#1a4fd8",
  borderColor: "rgba(40,120,255,0.25)",
};

const pillGray: React.CSSProperties = {
  background: "#fff",
  color: "#666",
};

const idLine: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  color: "#999",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  textAlign: "center",
};

const appNoNeed: React.CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 900,
  color: "#666",
  marginBottom: 6,
};

const qrWrap: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: 10,
  borderRadius: 14,
  background: "#fafafa",
  border: "1px solid rgba(0,0,0,0.10)",
};

const hintLine: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: "#777",
  fontWeight: 800,
  lineHeight: 1.35,
};

const centerNote: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.4,
  background: "#fff",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  padding: "12px",
  textAlign: "center",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: 13,
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
  border: "1px solid rgba(0,0,0,0.14)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
  color: "#111",
};

const btnSub: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.9,
};

const errBox: React.CSSProperties = {
  marginBottom: 10,
  padding: "10px",
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};
