"use client";

// UI_VER: HOST_SCAN_UI_V1_20260217

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";

function extractEventIdFromText(text: string): string {
  const t = (text || "").trim();

  // join URL: /join?eventId=...
  try {
    const u = new URL(t, window.location.origin);
    const eid = u.searchParams.get("eventId") || "";
    if (/^[0-9a-fA-F-]{36}$/.test(eid)) return eid;
  } catch {
    // noop
  }

  // raw uuid
  if (/^[0-9a-fA-F-]{36}$/.test(t)) return t;

  return "";
}

export default function HostScanPage() {
  const UI_VER = "HOST_SCAN_UI_V1_20260217";
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

  const hasBarcodeDetector = useMemo(() => {
    // BarcodeDetector は一部ブラウザのみ
    return typeof (window as any).BarcodeDetector !== "undefined";
  }, []);

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");

    const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
    if (!token) {
      router.replace("/host/login");
      return;
    }
    setReady(true);

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stopCamera = () => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    setErr("");
    if (!hasBarcodeDetector) {
      setErr("この端末ではカメラ読み取りに未対応です。下の入力欄にURL（またはeventId）を貼り付けてください。");
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      const v = videoRef.current;
      if (!v) throw new Error("video_not_ready");
      v.srcObject = stream;
      await v.play();

      const BD = (window as any).BarcodeDetector;
      const detector = new BD({ formats: ["qr_code"] });

      setScanning(true);

      tickRef.current = window.setInterval(async () => {
        try {
          if (!videoRef.current) return;
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = String(barcodes[0].rawValue || "");
            const eid = extractEventIdFromText(raw);
            if (eid) {
              stopCamera();
              router.push(`/join?eventId=${encodeURIComponent(eid)}`);
            } else {
              // eventId が取れない場合は raw を入力欄へ
              setText(raw);
            }
          }
        } catch {
          // silent
        }
      }, 450);
    } catch (e: any) {
      stopCamera();
      setErr(`カメラ開始に失敗しました：${String(e?.message || e || "failed")}`);
    }
  };

  const go = () => {
    setErr("");
    const eid = extractEventIdFromText(text);
    if (!eid) {
      setErr("eventId を取得できませんでした。join URL（/join?eventId=...）または eventId を貼り付けてください。");
      return;
    }
    router.push(`/join?eventId=${encodeURIComponent(eid)}`);
  };

  if (!ready) return null;

  return (
    <main style={wrap}>
      <header style={topBar}>
        <div style={topInner}>
          <button onClick={() => router.back()} style={btnGhostSmall}>←</button>
          <div style={topTitle}>QRを読み込む</div>
          <div style={{ width: 44 }} />
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

        <section style={card}>
          <div style={label}>カメラ読み取り（対応端末のみ）</div>

          <div style={videoWrap}>
            <video ref={videoRef} style={video} playsInline muted />
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <button onClick={startCamera} style={btnPrimary} disabled={scanning}>
              {scanning ? "読み取り中…" : "カメラで読み取る"}
            </button>
            <button onClick={stopCamera} style={btnGhost} disabled={!scanning}>
              停止
            </button>
          </div>

          <div style={miniNote}>
            ※ うまく起動しない場合は、下の入力欄に「join URL」または「eventId」を貼り付けてください。
          </div>
        </section>

        <section style={{ ...card, marginTop: 10 }}>
          <div style={label}>URL / eventId を貼り付け</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例：https://xxxx/join?eventId=...  または eventId"
            style={input}
          />
          <button onClick={go} style={{ ...btnPrimary, marginTop: 10 }}>
            参加する（ゲスト）
          </button>
        </section>

        <Footer uiVer={UI_VER} showSupporters={false} />
      </div>
    </main>
  );
}

/* styles */
const wrap: React.CSSProperties = { minHeight: "100vh", background: "#fff", color: "#111", fontFamily: "system-ui" };
const topBar: React.CSSProperties = { position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: 10 };
const topInner: React.CSSProperties = { maxWidth: 520, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 };
const topTitle: React.CSSProperties = { fontSize: 16, fontWeight: 900, textAlign: "center" };
const body: React.CSSProperties = { maxWidth: 520, margin: "0 auto", padding: 10 };
const card: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12, background: "#fafafa" };

const label: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#444", marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14 };

const btnPrimary: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 12, border: 0, background: "#111", color: "#fff", fontWeight: 900, fontSize: 14 };
const btnGhost: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", fontWeight: 900, fontSize: 14 };
const btnGhostSmall: React.CSSProperties = { justifySelf: "start", padding: "9px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" };

const videoWrap: React.CSSProperties = { borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.10)", background: "#000", aspectRatio: "16/10" as any, display: "grid", placeItems: "center" };
const video: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

const miniNote: React.CSSProperties = { marginTop: 8, fontSize: 11, color: "#777", fontWeight: 800, lineHeight: 1.35 };
const errBox: React.CSSProperties = { marginBottom: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(176,0,32,0.22)", background: "rgba(176,0,32,0.06)", color: "#b00020", fontSize: 12, fontWeight: 900 };