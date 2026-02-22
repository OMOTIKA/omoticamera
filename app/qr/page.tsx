"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const UPLOADS_BASE = "https://omotika.zombie.jp/omoticamera-uploads";

type ListResp = {
  ok: boolean;
  marker: string;
  eventId: string;
  eventName?: string;
  roleCaps?: { host?: number; guest?: number };
  photos?: { id: string; createdAt: number }[];
};

type SlotInfo = {
  slot: number; // 1..cap
  id?: string;
  createdAt?: number;
};

export default function CameraPage() {
  const UI_VER = "CAMERA_UI_V3_ONEHAND_20260205";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const roleRef = useRef<string | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const guestKeyRef = useRef<string | null>(null);
  const hostKeyRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const [eventName, setEventName] = useState("");
  const [cap, setCap] = useState(20);
  const [mySlots, setMySlots] = useState<SlotInfo[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // 上限到達 → 差し替えモード
  const isCapReached = useMemo(() => {
    if (!mySlots.length) return false;
    return mySlots.every((s) => !!s.id);
  }, [mySlots]);

  const filledCount = useMemo(() => mySlots.filter((s) => s.id).length, [mySlots]);

  const nextEmptySlot = useMemo(() => {
    const s = mySlots.find((x) => !x.id);
    return s ? s.slot : null;
  }, [mySlots]);

  // 差し替えドロワー（上限到達時だけ使う）
  const [drawerOpen, setDrawerOpen] = useState(false);

  // -------------------------
  // 初期化
  // -------------------------
  useEffect(() => {
    roleRef.current = localStorage.getItem("omoticamera_role");
    eventIdRef.current = localStorage.getItem("omoticamera_eventId");
    guestKeyRef.current = localStorage.getItem("omoticamera_guestKey");
    hostKeyRef.current = localStorage.getItem("omoticamera_hostKey");

    if (!eventIdRef.current) {
      setStatus("イベント情報がありません。QRから入り直してください。");
      return;
    }
    if (roleRef.current === "guest" && !guestKeyRef.current) {
      setStatus("参加情報がありません。参加画面から入り直してください。");
      return;
    }
    if (roleRef.current === "host" && !hostKeyRef.current) {
      setStatus("ホスト情報がありません。ホスト画面から入り直してください。");
      return;
    }

    startCamera();
    touchGuestOnce();
    refreshMySlots(true);

    const onFocus = () => {
      touchGuestOnce();
      refreshMySlots(false);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    const timer = setInterval(() => {
      touchGuestOnce();
      refreshMySlots(false);
    }, 60000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // カメラ開始/停止
  // -------------------------
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch {
      setStatus("カメラを起動できません");
    }
  };

  const stopCamera = () => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
  };

  // -------------------------
  // lastActive（ゲストのみ）
  // -------------------------
  const touchGuestOnce = async () => {
    if (roleRef.current !== "guest") return;
    if (!eventIdRef.current || !guestKeyRef.current) return;

    try {
      await fetch(
        `${API_BASE}/touch_guest.php?eventId=${encodeURIComponent(
          eventIdRef.current
        )}&guestKey=${encodeURIComponent(guestKeyRef.current)}`
      );
    } catch {
      // silent
    }
  };

  // -------------------------
  // slots
  // -------------------------
  const buildMySlots = (list: ListResp): SlotInfo[] => {
    const role = roleRef.current === "host" ? "host" : "guest";
    const key = role === "host" ? (hostKeyRef.current || "") : (guestKeyRef.current || "");

    const capN =
      role === "host"
        ? Math.max(1, Number(list.roleCaps?.host || 30))
        : Math.max(1, Number(list.roleCaps?.guest || 20));

    setCap(capN);
    setEventName(list.eventName || "");

    const slots: SlotInfo[] = Array.from({ length: capN }, (_, i) => ({ slot: i + 1 }));
    for (const p of list.photos || []) {
      const m = p.id.match(/^(guest|host)-(.+?)-slot-(\d+)\.jpg$/);
      if (!m) continue;
      if (m[1] !== role) continue;
      if (!key || m[2] !== key) continue;

      const s = Number(m[3]);
      if (!Number.isFinite(s) || s < 1 || s > capN) continue;
      slots[s - 1] = { slot: s, id: p.id, createdAt: p.createdAt };
    }
    return slots;
  };

  const refreshMySlots = async (loud: boolean) => {
    const eid = eventIdRef.current;
    if (!eid) return;

    try {
      if (loud) setStatus("");
      const res = await fetch(`${API_BASE}/list.php?eventId=${encodeURIComponent(eid)}&v=${Date.now()}`);
      const json = (await res.json()) as ListResp;

      if (!json?.ok) {
        if (loud) setStatus("イベント情報の取得に失敗しました");
        return;
      }

      const slots = buildMySlots(json);
      setMySlots(slots);

      // 上限に達した瞬間：ドロワー開く（ただし撮影ボタンは常に下にある）
      const reachedNow = slots.length > 0 && slots.every((s) => !!s.id);
      if (reachedNow) {
        setDrawerOpen(true);
        if (!selectedSlot) setStatus(`上限に達しました。差し替える番号（1〜${slots.length}）を選んでください。`);
      } else {
        setDrawerOpen(false);
        setSelectedSlot(null);
      }
    } catch {
      if (loud) setStatus("通信エラー");
    }
  };

  const thumbUrl = (id: string, createdAt?: number) => {
    const eid = eventIdRef.current;
    if (!eid) return "";
    const v = createdAt || Date.now();
    return `${UPLOADS_BASE}/event-${encodeURIComponent(eid)}/${encodeURIComponent(id)}?v=${v}`;
  };

  // -------------------------
  // 撮影 → 即送信（slot確定）
  // -------------------------
  const shoot = async () => {
    if (!ready || sending) return;
    if (!videoRef.current || !canvasRef.current) return;

    // slot決定
    const slotToUse = !isCapReached ? nextEmptySlot : selectedSlot;

    if (!slotToUse) {
      // 上限到達なのに選んでない
      if (isCapReached) {
        setDrawerOpen(true);
        setStatus(`上限に達しました。差し替える番号（1〜${cap}）を選んでください。`);
      }
      return;
    }

    setSending(true);
    setStatus(isCapReached ? `差し替え中…（${slotToUse}）` : "送信中…");

    try {
      const v = videoRef.current;
      const c = canvasRef.current;

      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);

      const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));

      await upload(blob, slotToUse);
      await refreshMySlots(false);

      setStatus(isCapReached ? "差し替え完了" : "送信完了");
    } catch {
      setStatus("送信失敗（通信）");
    } finally {
      setSending(false);
    }
  };

  const upload = async (blob: Blob, slot: number) => {
    const eid = eventIdRef.current;
    if (!eid) throw new Error("missing eventId");

    const role = roleRef.current === "host" ? "host" : "guest";
    const key = role === "host" ? hostKeyRef.current : guestKeyRef.current;
    if (!key) throw new Error("missing key");

    const fd = new FormData();
    fd.append("eventId", eid);
    fd.append("role", role);
    fd.append(role === "host" ? "hostKey" : "guestKey", key);
    fd.append("slot", String(slot));
    fd.append("file", blob, "photo.jpg");

    const res = await fetch(`${API_BASE}/upload.php`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("upload failed");
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <main style={{ minHeight: "100vh", background: "#000", position: "relative" }}>
      {/* 画面上部の薄い情報（邪魔しない） */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          zIndex: 20,
          padding: "10px 12px",
          background: "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0))",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          {eventName ? `イベント：${eventName}` : ""}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
          {`あなたの枠：${filledCount}/${cap}`}
          {isCapReached ? "（上限）" : ""}
        </div>
      </div>

      {/* カメラ */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          background: "#000",
          display: "block",
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 差し替えドロワー（上限到達時だけ） */}
      {isCapReached ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 96, // 撮影ボタンの上に置く
            zIndex: 30,
            padding: "10px 12px",
            background: drawerOpen ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.55)",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            maxHeight: drawerOpen ? "42vh" : "42px",
            overflow: "hidden",
            transition: "max-height 160ms ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.95 }}>
              差し替え番号を選択（{cap}枚）
            </div>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "#fff",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {drawerOpen ? "閉じる" : "開く"}
            </button>
          </div>

          {drawerOpen ? (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 6,
                }}
              >
                {mySlots.map((s) => {
                  const isSelected = selectedSlot === s.slot;
                  return (
                    <button
                      key={s.slot}
                      onClick={() => {
                        setSelectedSlot(s.slot);
                        setStatus(`差し替え番号：${s.slot}`);
                      }}
                      style={{
                        padding: 0,
                        borderRadius: 10,
                        border: isSelected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                        background: "#000",
                        overflow: "hidden",
                        aspectRatio: "1 / 1",
                      }}
                      aria-label={`slot ${s.slot}`}
                    >
                      <div style={{ position: "relative", width: "100%", height: "100%" }}>
                        {s.id ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl(s.id, s.createdAt)}
                            alt={`slot-${s.slot}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : null}

                        <div
                          style={{
                            position: "absolute",
                            left: 6,
                            top: 6,
                            fontSize: 11,
                            fontWeight: 900,
                            background: "rgba(0,0,0,0.55)",
                            padding: "2px 6px",
                            borderRadius: 999,
                          }}
                        >
                          {s.slot}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                {selectedSlot ? `選択中：${selectedSlot}` : "未選択（撮影できません）"}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 最下部固定：親指ゾーン */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          padding: "12px 12px calc(12px + env(safe-area-inset-bottom))",
          background: "rgba(0,0,0,0.78)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <button
          onClick={shoot}
          disabled={!ready || sending || (isCapReached && !selectedSlot)}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 999,
            border: 0,
            fontSize: 18,
            fontWeight: 900,
            background: sending ? "#777" : "#fff",
            color: "#000",
            opacity: !ready || sending || (isCapReached && !selectedSlot) ? 0.82 : 1,
          }}
        >
          撮影
        </button>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9, textAlign: "center" }}>
          {status}
        </div>

        <div style={{ marginTop: 6, fontSize: 10, opacity: 0.55, textAlign: "center" }}>
          {UI_VER}
        </div>
      </div>
    </main>
  );
}