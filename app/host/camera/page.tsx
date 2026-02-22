// app/host/camera/page.tsx
"use client";

// UI_VER: HOST_CAMERA_V4_20260222

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

import { addPending, listPending } from "@/app/lib/db";
import { tryAutoSend } from "@/app/lib/uploader";

const UI_VER = "HOST_CAMERA_V4_20260222";

const API_BASE_DEFAULT = "https://omotika.zombie.jp/omoticamera-api";
const API_BASE = process.env.NEXT_PUBLIC_OMOTICAMERA_API_BASE || API_BASE_DEFAULT;

const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";

type ListResp = {
  ok: boolean;
  eventId: string;
  eventName?: string;
  roleCaps?: { host: number; guest: number };
  photos?: { id: string; createdAt: number }[];
};

type HostEventGetResp =
  | {
      ok: true;
      event: { eventId: string; eventName: string; startAt: number; endAt: number };
      status: "draft" | "reserved" | "running" | "ended";
      paused: boolean;
      now: number;
      expireAt: number;
      expired: boolean;
      viewable: boolean;
      caps: { canShowQr: boolean; canShoot: boolean; canViewAlbum: boolean };
    }
  | { ok: false; error: string };

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}

function nowMs() {
  return Date.now();
}

export default function HostCameraPage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const eventIdRef = useRef<string>("");
  const hostKeyRef = useRef<string>("");

  const [statusMsg, setStatusMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);

  const [facing, setFacing] = useState<"environment" | "user">("environment");

  // フラッシュ仕様 C：torch + フォールバック
  type FlashMode = "off" | "on";
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [torchSupported, setTorchSupported] = useState(false);

  // LIVE（点滅）
  const [liveOn, setLiveOn] = useState(false);

  // QR（ポンとサクッと：その場で生成して表示）
  const [showQrOverlay, setShowQrOverlay] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrBusy, setQrBusy] = useState(false);

  // グリッド線（デフォルトOFF）
  const [gridOn, setGridOn] = useState(false);

  // 枚数
  const [cap, setCap] = useState<number>(0);
  const [count, setCount] = useState<number>(0);

  // event status（host_event_get で “running か” を確認）
  const [eventName, setEventName] = useState("");
  const [canShootByEvent, setCanShootByEvent] = useState(false);
  const [canShowQrByEvent, setCanShowQrByEvent] = useState(true);

  // 直前サムネ（撮影直後にセット）
  const [lastThumbUrl, setLastThumbUrl] = useState<string>("");
  const [lastThumbPending, setLastThumbPending] = useState(false);
  const lastPendingIdRef = useRef<string>("");

  // 自動再送 常駐
  const autoSendTimerRef = useRef<number | null>(null);
  const autoSendLockRef = useRef(false);

  const canShoot = useMemo(
    () => ready && !sending && canShootByEvent,
    [ready, sending, canShootByEvent]
  );

  // join URL（useMemo固定バグを避ける：常に“今”から生成）
  const getJoinUrl = () => {
    const eid = eventIdRef.current;
    if (!eid) return "";
    if (typeof window === "undefined") return "";
    return `${location.origin}/join?eventId=${encodeURIComponent(eid)}`;
  };

  // -------------------------
  // init
  // -------------------------
  useEffect(() => {
    // ホスト固定
    localStorage.setItem("omoticamera_role", "host");

    eventIdRef.current = safeStr(localStorage.getItem("omoticamera_eventId")).trim();
    hostKeyRef.current = safeStr(localStorage.getItem("omoticamera_hostKey")).trim();

    if (!eventIdRef.current) {
      setStatusMsg("イベント情報がありません。イベントから入り直してください。");
      return;
    }

    // LIVE点滅
    const liveTimer = window.setInterval(() => setLiveOn((v) => !v), 520);

    // 初期ロード
    void refreshCount();
    void refreshEventCaps();

    // 自動再送A：online + 定期
    const onOnline = () => void runAutoSend("online");
    window.addEventListener("online", onOnline);
    autoSendTimerRef.current = window.setInterval(() => void runAutoSend("interval"), 8000);

    // 初回も一回走らせる（溜まってたら即送る）
    void runAutoSend("boot");

    return () => {
      clearInterval(liveTimer);
      window.removeEventListener("online", onOnline);
      if (autoSendTimerRef.current) window.clearInterval(autoSendTimerRef.current);

      stopCamera();
      if (lastThumbUrl) URL.revokeObjectURL(lastThumbUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshEventCaps = async () => {
    try {
      const token = safeStr(localStorage.getItem(LS_KEY_HOST_SESSION)).trim();
      if (!token) return;

      const eid = eventIdRef.current;
      const url =
        `${API_BASE}/host_event_get.php?` +
        `hostSessionToken=${encodeURIComponent(token)}&eventId=${encodeURIComponent(eid)}&v=${Date.now()}`;

      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as HostEventGetResp;
      if (!j.ok) return;

      setEventName(j.event?.eventName || "");
      setCanShootByEvent(Boolean(j.caps?.canShoot)); // running & not paused
      setCanShowQrByEvent(Boolean(j.caps?.canShowQr));
    } catch {
      // silent
    }
  };

  // -------------------------
  // auto resend (A)
  // -------------------------
  const runAutoSend = async (reason: "boot" | "online" | "interval") => {
    if (autoSendLockRef.current) return;
    autoSendLockRef.current = true;

    try {
      // オフラインなら無駄撃ちしない
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const { sent } = await tryAutoSend();

      // 直前サムネの「未送信」状態を更新（該当IDがもう無ければ消す）
      const lastId = lastPendingIdRef.current;
      if (lastId) {
        const all = await listPending();
        const stillPending = all.some((p) => p.id === lastId);
        if (!stillPending) setLastThumbPending(false);
      }

      // 送れたら枚数反映
      if (sent > 0) void refreshCount();

      // reason別ログは控えめ（必要なら戻す）
      void reason;
    } catch {
      // silent
    } finally {
      autoSendLockRef.current = false;
    }
  };

  // -------------------------
  // count/cap
  // -------------------------
  const refreshCount = async () => {
    try {
      const eid = eventIdRef.current;
      const res = await fetch(`${API_BASE}/list.php?eventId=${encodeURIComponent(eid)}&v=${Date.now()}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as ListResp;
      if (!j?.ok) return;

      const caps = j.roleCaps || { host: 30, guest: 20 };
      setCap(caps.host);

      const key = hostKeyRef.current;
      const prefix = `host-${key}-slot-`;
      const photos = j.photos || [];
      const mine = photos.filter((p) => p.id.startsWith(prefix)).length;
      setCount(mine);
    } catch {
      // silent
    }
  };

  // -------------------------
  // camera start/stop
  // -------------------------
  const startCamera = async () => {
    if (starting) return;
    setStarting(true);
    setStatusMsg("");

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });

      streamRef.current = stream;

      const track = stream.getVideoTracks()?.[0] || null;
      trackRef.current = track;

      // torch対応判定
      let torchOk = false;
      try {
        // @ts-ignore
        const caps = track?.getCapabilities?.();
        // @ts-ignore
        torchOk = Boolean(caps && (caps as any).torch);
      } catch {
        torchOk = false;
      }
      setTorchSupported(torchOk);

      // torch ON のまま再起動された時は、ここで反映
      if (flashMode === "on" && torchOk) {
        await applyTorch(true);
      }

      const v = videoRef.current;
      if (!v) throw new Error("no_video");
      v.srcObject = stream;
      await v.play();

      setReady(true);
      setStatusMsg("");
    } catch {
      setReady(false);
      setStatusMsg("カメラを起動できません（権限/httpsを確認）");
    } finally {
      setStarting(false);
    }
  };

  const stopCamera = () => {
    setReady(false);
    setTorchSupported(false);
    trackRef.current = null;

    const s = streamRef.current || (videoRef.current?.srcObject as MediaStream | null);
    s?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const applyTorch = async (on: boolean) => {
    const track = trackRef.current;
    if (!track) return;

    try {
      // @ts-ignore
      await track.applyConstraints({ advanced: [{ torch: on }] });
    } catch {
      // torch不可なら何もしない（フォールバック）
    }
  };

  const toggleFacing = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);

    // 起動中なら即反映
    if (ready) {
      await startCamera();
    }
  };

  const toggleFlash = async () => {
    const next: FlashMode = flashMode === "off" ? "on" : "off";
    setFlashMode(next);

    if (torchSupported) {
      await applyTorch(next === "on");
      setStatusMsg("");
    } else {
      // フォールバック：状態だけ持つ（端末非対応の案内）
      setStatusMsg(next === "on" ? "この端末ではフラッシュ（トーチ）が使えません" : "");
      if (next === "off") setTimeout(() => setStatusMsg(""), 800);
    }
  };

  // -------------------------
  // navigation
  // -------------------------
  const goEvent = () => {
    stopCamera();
    const eid = eventIdRef.current;
    if (eid) router.push(`/host/event/${encodeURIComponent(eid)}`);
    else router.push("/host/home");
  };

  const goPhotos = () => {
    stopCamera();
    router.push("/host/photos"); // redirect係が eventId へ振る想定
  };

  // -------------------------
  // QR (tap)
  // -------------------------
  const qrEnabled = canShowQrByEvent && !!eventIdRef.current;

  const openQr = async () => {
    if (!qrEnabled) return;
    if (qrBusy) return;

    setQrBusy(true);
    try {
      const url = getJoinUrl();
      if (!url) return;

      // その場で生成（iframeなし）
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
      });

      setQrDataUrl(dataUrl);
      setShowQrOverlay(true);
    } catch {
      setStatusMsg("QR生成に失敗しました");
      setTimeout(() => setStatusMsg(""), 900);
    } finally {
      setQrBusy(false);
    }
  };

  const closeQr = () => setShowQrOverlay(false);

  // -------------------------
  // shoot (queue -> tryAutoSend)
  // -------------------------
  const shoot = async () => {
    if (!canShoot) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (!eventIdRef.current) return;

    setSending(true);
    setStatusMsg("");

    try {
      const v = videoRef.current;
      const c = canvasRef.current;

      c.width = v.videoWidth || 1280;
      c.height = v.videoHeight || 720;
      c.getContext("2d")!.drawImage(v, 0, 0);

      const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));

      // ✅ 直前サムネ（送信成功前でも“撮れた”感）
      setLastThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });

      // ✅ 送信待ちキューへ積む（IndexedDB）
      const createdAt = nowMs();
      const hostKey = hostKeyRef.current || "host";
      const pendingId = `host-${hostKey}-slot-${createdAt}`;
      lastPendingIdRef.current = pendingId;

      const nickname =
        safeStr(localStorage.getItem("omoticamera_hostNickname")) ||
        safeStr(localStorage.getItem("omoticamera_nickname")) ||
        "host";

      await addPending({
        id: pendingId,
        createdAt,
        nickname,
        blob,
      });

      // ✅ 未送信マークON
      setLastThumbPending(true);

      // ✅ すぐ送ってみる（失敗してもキューに残る）
      await runAutoSend("interval");

      setStatusMsg("撮影しました");
      setTimeout(() => setStatusMsg(""), 500);
    } catch {
      setStatusMsg("撮影に失敗しました");
      setTimeout(() => setStatusMsg(""), 900);
    } finally {
      setSending(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  const disabledByNoInit = !eventIdRef.current || !hostKeyRef.current;

  return (
    <main style={styles.wrap}>
      {/* TOP BAR：左右 1fr / 中央 auto → LIVEが“画面ど真ん中” */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <button onClick={goEvent} style={styles.topBtn} aria-label="イベントへ戻る">
            ←
          </button>
        </div>

        <div style={styles.topCenter}>
          <span
            style={{
              ...styles.livePill,
              opacity: liveOn ? 1 : 0.28,
            }}
          >
            LIVE
          </span>
        </div>

        <div style={styles.topRight}>
          <div style={styles.countPill} aria-label="撮影枚数">
            {cap > 0 ? `${count}/${cap}` : `${count}/-`}
          </div>

          <button onClick={toggleFlash} style={styles.iconBtn} aria-label="フラッシュ切替">
            <span style={styles.iconCircle}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M13 2L6.2 13.2H11.3L9.6 22L17.8 10.8H12.7Z"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
              {flashMode === "on" && <span style={styles.onDot} />}
            </span>
          </button>
        </div>
      </div>

      {/* VIDEO */}
      <div style={styles.videoWrap}>
        <video ref={videoRef} playsInline muted style={styles.video} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* grid overlay */}
        {gridOn && (
          <>
            <div style={{ ...styles.gridLineV, left: "33.333%" }} />
            <div style={{ ...styles.gridLineV, left: "66.666%" }} />
            <div style={{ ...styles.gridLineH, top: "33.333%" }} />
            <div style={{ ...styles.gridLineH, top: "66.666%" }} />
          </>
        )}

        {/* QR overlay（ポンとサクッと） */}
        {showQrOverlay && qrDataUrl && (
          <div style={styles.qrOverlay} onClick={closeQr} role="button" aria-label="QRを閉じる">
            <div style={styles.qrCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.qrTitle}>参加用QR</div>
              <div style={styles.qrSub}>タップで閉じます</div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="join qr" style={styles.qrImg} />

              <div style={styles.qrHint}>撮影の流れを止めずに、すぐ戻れます</div>
            </div>
          </div>
        )}

        {/* 未起動 overlay */}
        {!ready && (
          <div style={styles.overlay}>
            <div style={styles.overlayCard}>
              <div style={styles.overlayTitle}>ホストカメラ</div>
              <div style={styles.overlayMsg}>
                {disabledByNoInit
                  ? "イベント情報がありません。イベント画面から入り直してください。"
                  : "開始をタップしてください"}
              </div>

              <button
                onClick={startCamera}
                disabled={disabledByNoInit || starting}
                style={{
                  ...styles.startBtn,
                  opacity: disabledByNoInit ? 0.5 : 1,
                }}
              >
                {starting ? "起動中…" : "開始"}
              </button>

              {!!eventName && <div style={styles.smallNote}>{eventName}</div>}
              {!canShootByEvent && <div style={styles.smallWarn}>※イベントが「開催中」のときだけ撮影できます</div>}

              {statusMsg && <div style={styles.status}>{statusMsg}</div>}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER：1fr / auto / 1fr で破綻しない。シャッターは中央列で絶対センター */}
      <div style={styles.bottomBar}>
        {/* left */}
        <div style={styles.bottomLeft}>
          <button onClick={goPhotos} style={styles.thumbBtn} aria-label="撮影一覧へ">
            {lastThumbUrl ? (
              <span style={styles.thumbWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lastThumbUrl} alt="" style={styles.thumbImg} />
                {lastThumbPending && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/Unsent.png" alt="" style={styles.unsentMark} />
                )}
              </span>
            ) : (
              <span style={styles.thumbPlaceholder} />
            )}
          </button>

          <button
            type="button"
            onClick={openQr}
            disabled={!qrEnabled || qrBusy}
            style={{ ...styles.iconBtnSquare, opacity: qrEnabled ? 1 : 0.35 }}
            aria-label="QRを表示"
          >
            <span style={styles.iconSquare}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" fill="none" stroke="white" strokeWidth="1.6" />
                <rect x="14" y="3" width="7" height="7" fill="none" stroke="white" strokeWidth="1.6" />
                <rect x="3" y="14" width="7" height="7" fill="none" stroke="white" strokeWidth="1.6" />
                <rect x="16" y="16" width="2" height="2" fill="white" />
                <rect x="19" y="13" width="2" height="2" fill="white" />
                <rect x="13" y="19" width="2" height="2" fill="white" />
              </svg>
            </span>
          </button>
        </div>

        {/* center */}
        <div style={styles.bottomCenter}>
          <button
            onClick={shoot}
            disabled={!canShoot || disabledByNoInit}
            style={{
              ...styles.shutterBtn,
              opacity: !canShoot || disabledByNoInit ? 0.45 : 1,
              cursor: !canShoot || disabledByNoInit ? "not-allowed" : "pointer",
            }}
            aria-label="シャッター"
          >
            <span style={styles.shutterOuterRing}>
              <span style={styles.shutterInnerRing}>
                <span style={styles.shutterCore} />
              </span>
            </span>
          </button>
        </div>

        {/* right */}
        <div style={styles.bottomRight}>
          <button
            onClick={() => setGridOn((v) => !v)}
            style={styles.iconBtnSquare}
            aria-label="グリッド線切替"
          >
            <span
              style={{
                ...styles.iconSquare,
                background: gridOn ? "rgba(110,110,110,0.92)" : (styles.iconSquare.background as any),
              }}
            >
              {/* 大きい四角 + 縦横3分割線（角丸なし/細線/butt） */}
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="0"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.05"
                  shapeRendering="geometricPrecision"
                />
                <path
                  d="M9.333 4V20 M14.667 4V20"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.95"
                  strokeLinecap="butt"
                  shapeRendering="geometricPrecision"
                />
                <path
                  d="M4 9.333H20 M4 14.667H20"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.95"
                  strokeLinecap="butt"
                  shapeRendering="geometricPrecision"
                />
              </svg>
            </span>
          </button>

          <button onClick={toggleFacing} style={styles.iconBtn} aria-label="自撮り切替">
            <span style={styles.iconCircle}>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M7.2 7.2a7 7 0 0 1 11.6 2.2"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M18.9 6.6v3.8h-3.8"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.8 16.8a7 7 0 0 1-11.6-2.2"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M5.1 17.4v-3.8h3.8"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}

/* ================= styles ================= */

const BASE_BG = "rgba(90,90,90,0.92)"; // ✅ 統一背景色（QR / フラッシュ / 自撮り / グリッド）
const BASE_SHADOW = "0 6px 16px rgba(0,0,0,0.35)";

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" },

  // TOP：左右 1fr / 中央 auto → LIVEが完全センター
  topBar: {
    padding: "10px 10px 6px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    color: "#fff",
  },
  topLeft: {
    justifySelf: "start",
    display: "flex",
    alignItems: "center",
  },
  topCenter: {
    justifySelf: "center",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  topRight: {
    justifySelf: "end",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  topBtn: {
    width: 46,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 18,
    display: "grid",
    placeItems: "center",
  },
  livePill: {
    padding: "6px 12px",
    borderRadius: 999,
    background: "#B00020",
    color: "#fff",
    fontWeight: 900,
    letterSpacing: 0.5,
    border: "1px solid rgba(0,0,0,0.15)",
    boxShadow: "0 2px 10px rgba(176,0,32,0.35)",
  },
  countPill: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
    minWidth: 56,
    textAlign: "center",
  },

  // 共通アイコン（丸）
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 999,
    border: 0,
    padding: 0,
    background: "transparent",
    display: "grid",
    placeItems: "center",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: BASE_BG,
    display: "grid",
    placeItems: "center",
    boxShadow: BASE_SHADOW,
    position: "relative",
  },
  onDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#fff",
    opacity: 0.9,
    transform: "translate(14px, -14px)",
  } as React.CSSProperties,

  // 共通アイコン（四角）
  iconBtnSquare: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: 0,
    padding: 0,
    background: "transparent",
    display: "grid",
    placeItems: "center",
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: BASE_BG,
    display: "grid",
    placeItems: "center",
    boxShadow: BASE_SHADOW,
  },

  // VIDEO
  videoWrap: { position: "relative", flex: 1, background: "#000" },
  video: { width: "100%", height: "100%", objectFit: "cover" },

  // grid lines
  gridLineV: {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 0.8,
  background: "rgba(255,255,255,0.22)",
  backdropFilter: "blur(0.5px)"
},
gridLineH: {
  position: "absolute",
  left: 0,
  right: 0,
  height: 0.8,
  background: "rgba(255,255,255,0.22)",
  backdropFilter: "blur(0.5px)"
},

  // QR overlay
  qrOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.35)",
    zIndex: 30,
  },
  qrCard: {
    width: "min(92vw, 360px)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(20,20,20,0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    textAlign: "center",
  },
  qrTitle: { fontSize: 15, fontWeight: 900 },
  qrSub: { marginTop: 4, fontSize: 11, opacity: 0.85 },
  qrImg: {
    marginTop: 10,
    width: 280,
    height: 280,
    borderRadius: 14,
    background: "#fff",
    padding: 10,
    boxSizing: "border-box",
  },
  qrHint: { marginTop: 10, fontSize: 11, opacity: 0.85 },

  // overlay (not ready)
  overlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.45)",
    zIndex: 10,
  },
  overlayCard: {
    width: "min(92vw, 360px)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(20,20,20,0.88)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    textAlign: "center",
  },
  overlayTitle: { fontSize: 16, fontWeight: 900 },
  overlayMsg: { marginTop: 6, fontSize: 12, opacity: 0.85 },
  startBtn: {
    marginTop: 10,
    width: "100%",
    borderRadius: 999,
    padding: "12px 14px",
    border: 0,
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    fontSize: 14,
  },
  smallNote: { marginTop: 8, fontSize: 12, fontWeight: 900, opacity: 0.9 },
  smallWarn: { marginTop: 6, fontSize: 11, opacity: 0.85 },
  status: { marginTop: 8, fontSize: 12, opacity: 0.9 },

  // FOOTER：gridで安定（シャッターは中央列で絶対センター）
  bottomBar: {
    padding: "10px 14px calc(14px + env(safe-area-inset-bottom))",
    background: "linear-gradient(to top, rgba(0,0,0,0.90), rgba(0,0,0,0.20))",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 12,
    minHeight: 110,
  },
  bottomLeft: {
    justifySelf: "start",
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  bottomCenter: {
    justifySelf: "center",
    display: "grid",
    placeItems: "center",
  },
  bottomRight: {
    justifySelf: "end",
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  // thumbnail
  thumbBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: 0,
    padding: 0,
    background: "transparent",
    overflow: "hidden",
  },
  thumbWrap: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "block",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    borderRadius: 12,
    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    display: "block",
    borderRadius: 12,
    background: "rgba(255,255,255,0.10)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
  },
  unsentMark: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    objectFit: "contain",
    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
  },

  // shutter
  shutterBtn: {
    width: 86,
    height: 86,
    borderRadius: 999,
    border: 0,
    background: "transparent",
    display: "grid",
    placeItems: "center",
  },
  shutterOuterRing: {
    width: 82,
    height: 82,
    borderRadius: 999,
    border: "3px solid rgba(255,255,255,0.45)",
    display: "grid",
    placeItems: "center",
  },
  shutterInnerRing: {
    width: 74,
    height: 74,
    borderRadius: 999,
    border: "3px solid rgba(255,255,255,0.70)",
    display: "grid",
    placeItems: "center",
  },
  shutterCore: {
    width: 62,
    height: 62,
    borderRadius: 999,
    background: "#fff",
    boxShadow: "0 1px 0 rgba(0,0,0,0.35) inset, 0 10px 22px rgba(0,0,0,0.35)",
  },
};