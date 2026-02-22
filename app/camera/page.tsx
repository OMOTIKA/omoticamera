"use client";

// UI_VER: CAMERA_V10_20260206

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

type ListResp = {
  ok: boolean;
  eventId: string;
  eventName?: string;
  roleCaps?: { host: number; guest: number };
  photos?: { id: string; createdAt: number }[];
};

export default function CameraPage() {
  const UI_VER = "CAMERA_V10_20260206";

  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const roleRef = useRef<string>("guest");
  const eventIdRef = useRef<string>("");
  const hostKeyRef = useRef<string>("");
  const guestKeyRef = useRef<string>("");

  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);

  const [gridOn, setGridOn] = useState(true);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const [cap, setCap] = useState<number>(0);
  const [count, setCount] = useState<number>(0);

  const canShoot = useMemo(() => ready && !sending, [ready, sending]);

  // -------------------------
  // init
  // -------------------------
  useEffect(() => {
    roleRef.current = (localStorage.getItem("omoticamera_role") || "guest") as string;
    eventIdRef.current = localStorage.getItem("omoticamera_eventId") || "";
    hostKeyRef.current = localStorage.getItem("omoticamera_hostKey") || "";
    guestKeyRef.current = localStorage.getItem("omoticamera_guestKey") || "";

    // ゲストなのに guestKey がない → 参加導線へ戻す
    if (roleRef.current === "guest" && !guestKeyRef.current) {
      setStatus("参加情報がありません。QRから参加し直してください。");
      return;
    }
    if (!eventIdRef.current) {
      setStatus("イベント情報がありません。QRから参加し直してください。");
      return;
    }

    // 初期表示は「開始ボタン」方式（iOS/Chrome事故減）
    setStatus("");

    // lastActive（ゲストのみ）
    touchGuestOnce();
    const onFocus = () => touchGuestOnce();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(touchGuestOnce, 60000);

    // 枚数表示用データ
    refreshCount();

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // lastActive（軽量）
  // -------------------------
  const touchGuestOnce = async () => {
    if (roleRef.current !== "guest") return;
    if (!eventIdRef.current || !guestKeyRef.current) return;
    try {
      await fetch(
        `${API_BASE}/touch_guest.php?eventId=${encodeURIComponent(eventIdRef.current)}&guestKey=${encodeURIComponent(
          guestKeyRef.current
        )}&v=${Date.now()}`,
        { cache: "no-store" }
      );
    } catch {
      // silent
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

      const role = roleRef.current === "host" ? "host" : "guest";
      const caps = j.roleCaps || { host: 30, guest: 20 };
      const myCap = role === "host" ? caps.host : caps.guest;
      setCap(myCap);

      const key = role === "host" ? hostKeyRef.current : guestKeyRef.current;
      const prefix = `${role}-${key}-slot-`;
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
    setStatus("");

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });

      streamRef.current = stream;

      const v = videoRef.current;
      if (!v) throw new Error("no_video");

      v.srcObject = stream;

      // iOS/Chromeの“play失敗”対策：明示的にawait
      await v.play();

      setReady(true);
      setStatus("");
    } catch {
      setReady(false);
      setStatus("カメラを起動できません（権限/httpsを確認）");
    } finally {
      setStarting(false);
    }
  };

  const stopCamera = () => {
    setReady(false);
    const s = streamRef.current || (videoRef.current?.srcObject as MediaStream | null);
    s?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const back = () => {
    stopCamera(); // ←戻る時に確実停止
    router.back();
  };

  const toggleFacing = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);

    // 起動中なら切替は即反映
    if (ready) {
      await startCamera();
    }
  };

  // -------------------------
  // shoot（連写不可）
  // -------------------------
  const shoot = async () => {
    if (!canShoot) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (!eventIdRef.current) return;

    setSending(true);
    setStatus("");

    try {
      const v = videoRef.current;
      const c = canvasRef.current;

      c.width = v.videoWidth || 1280;
      c.height = v.videoHeight || 720;
      c.getContext("2d")!.drawImage(v, 0, 0);

      const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));

      const fd = new FormData();
      fd.append("eventId", eventIdRef.current);

      const role = roleRef.current === "host" ? "host" : "guest";
      const key = role === "host" ? hostKeyRef.current : guestKeyRef.current;
      if (key) fd.append(role === "host" ? "hostKey" : "guestKey", key);

      fd.append("file", blob, "photo.jpg");

      await fetch(`${API_BASE}/upload.php`, { method: "POST", body: fd });

      // 送信後に枚数更新（軽量）
      await refreshCount();
      setStatus("送信しました");
      setTimeout(() => setStatus(""), 900);
    } catch {
      setStatus("送信失敗（通信）");
    } finally {
      setSending(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  const disabledByNoInit =
    !eventIdRef.current || (roleRef.current === "guest" && !guestKeyRef.current);

  return (
    <main style={styles.wrap}>
      {/* 上部：戻る + 枚数 */}
      <div style={styles.topBar}>
        <button onClick={back} style={styles.backBtn}>
          戻る
        </button>
        <div style={styles.count}>
          {cap > 0 ? `${count}/${cap}` : `${count}/-`}
        </div>
      </div>

      {/* video */}
      <div style={styles.videoWrap}>
        <video ref={videoRef} playsInline muted style={styles.video} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* grid */}
        {gridOn && (
          <>
            <div style={{ ...styles.gridLineV, left: "33.333%" }} />
            <div style={{ ...styles.gridLineV, left: "66.666%" }} />
            <div style={{ ...styles.gridLineH, top: "33.333%" }} />
            <div style={{ ...styles.gridLineH, top: "66.666%" }} />
          </>
        )}

        {/* 未起動 overlay */}
        {!ready && (
          <div style={styles.overlay}>
            <div style={styles.overlayCard}>
              <div style={styles.overlayTitle}>カメラ</div>
              <div style={styles.overlayMsg}>
                {disabledByNoInit ? "イベント情報がありません。QRから参加し直してください。" : "開始をタップしてください"}
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

              {status && <div style={styles.status}>{status}</div>}
            </div>
          </div>
        )}
      </div>

      {/* 下部操作（iOS寄せ） */}
      <div style={styles.bottomBar}>
        {/* 左：グリッド */}
        <button onClick={() => setGridOn((v) => !v)} style={styles.smallBtn} aria-label="grid">
          {gridOn ? "グリッドON" : "グリッドOFF"}
        </button>

        {/* 中央：シャッター */}
        <button
          onClick={shoot}
          disabled={!canShoot || disabledByNoInit}
          style={{
            ...styles.shutter,
            opacity: !canShoot || disabledByNoInit ? 0.5 : 1,
          }}
          aria-label="shutter"
        >
          <span style={styles.shutterOuter}>
            <span style={styles.shutterInner} />
          </span>
        </button>

        {/* 右：自撮り（iPhoneっぽく右下） */}
        <button onClick={toggleFacing} style={styles.smallBtn} aria-label="selfie">
          自撮り
        </button>
      </div>

      {/* UI_VER（最下段・1行） */}
      <div style={styles.uiVer}>UI_VER: {UI_VER}</div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" },

  topBar: {
    padding: "10px 10px 6px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
  },
  backBtn: {
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
    fontSize: 12,
  },
  count: { fontSize: 12, fontWeight: 900, opacity: 0.9 },

  videoWrap: { position: "relative", flex: 1, background: "#000" },
  video: { width: "100%", height: "100%", objectFit: "cover" },

  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.28)" },
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.28)" },

  overlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.45)",
  },
  overlayCard: {
    width: "min(92vw, 360px)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(20,20,20,0.85)",
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
  status: { marginTop: 8, fontSize: 12, opacity: 0.85 },

  bottomBar: {
    padding: "8px 14px 14px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
    background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.25))",
  },

  smallBtn: {
    justifySelf: "start",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 12px",
    fontWeight: 800,
    fontSize: 12,
    width: "fit-content",
  },

  shutter: {
    justifySelf: "center",
    width: 78,
    height: 78,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
  },
  // iOS寄せ：ツヤ（外→内の濃淡差を強め）
  shutterOuter: {
    width: 64,
    height: 64,
    borderRadius: 999,
    background:
      "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.25) 100%)",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 10px 20px rgba(0,0,0,0.35) inset, 0 10px 24px rgba(0,0,0,0.45)",
  },
  shutterInner: {
    width: 46,
    height: 46,
    borderRadius: 999,
    background:
      "radial-gradient(circle at 30% 25%, #ffffff, #dcdcdc 55%, #bfbfbf 100%)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  },

  uiVer: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    textAlign: "center",
    paddingBottom: 10,
    paddingTop: 2,
  },
};