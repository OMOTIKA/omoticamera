"use client";

// UI_VER: JOIN_UI_V3_20260209_SUSPENSE_FIX

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";

type JoinResp = {
  ok: boolean;
  marker?: string;
  error?: string;
  message?: string;
  eventId?: string;
  eventName?: string;
  guestKey?: string;
};

export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <JoinInner />
    </Suspense>
  );
}

function LoadingShell() {
  const UI_VER = "JOIN_UI_V3_20260209_SUSPENSE_FIX";
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        padding: 12,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 14,
            border: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>イベント名：読み込み中…</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>
            参加して撮影へ
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              表示名
            </div>
            <div
              style={{
                width: "100%",
                height: 44,
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            />
          </div>

          <button
            disabled
            style={{
              width: "100%",
              marginTop: 12,
              padding: "14px",
              borderRadius: 999,
              border: 0,
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15,
              opacity: 0.55,
            }}
          >
            準備中…
          </button>

          <div style={{ marginTop: 10, fontSize: 10, opacity: 0.35 }}>
            UI_VER: {UI_VER}
          </div>
        </div>

        <Footer uiVer={UI_VER} />
      </div>
    </main>
  );
}

function JoinInner() {
  const UI_VER = "JOIN_UI_V3_20260209_SUSPENSE_FIX";

  const router = useRouter();
  const sp = useSearchParams();

  // ※あなたの実装通り：event で受ける
  const eventId = useMemo(() => sp.get("event") || "", [sp]);

  const [nickname, setNickname] = useState("");
  const [eventName, setEventName] = useState("イベント名：読み込み中…");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "guest");

    if (!eventId) {
      setEventName("イベント名：未指定");
      setErr("イベント情報がありません（QRから入り直してください）");
      return;
    }

    localStorage.setItem("omoticamera_eventId", eventId);

    (async () => {
      try {
        const r = await fetch(
          `https://omotika.zombie.jp/omoticamera-api/list.php?eventId=${encodeURIComponent(
            eventId
          )}&v=${Date.now()}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        const name = j?.eventName || "";
        setEventName(name ? `イベント名：${name}` : "イベント名：未設定");
      } catch {
        setEventName("イベント名：取得失敗（通信）");
      }
    })();
  }, [eventId]);

  const join = async () => {
    setErr("");
    if (!eventId) {
      setErr("イベント情報がありません（QRから入り直してください）");
      return;
    }
    if (!nickname.trim()) {
      setErr("表示名を入力してください");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(
        `/api/join?eventId=${encodeURIComponent(eventId)}&nickname=${encodeURIComponent(
          nickname.trim()
        )}&v=${Date.now()}`,
        { cache: "no-store" }
      );

      const j = (await r.json()) as JoinResp;

      if (!j?.ok) {
        setErr(j?.message || j?.error || "参加できませんでした");
        return;
      }

      if (j.guestKey) localStorage.setItem("omoticamera_guestKey", j.guestKey);
      localStorage.setItem("omoticamera_eventId", eventId);
      localStorage.setItem("omoticamera_role", "guest");

      router.push("/camera");
    } catch {
      setErr("参加できませんでした（通信）");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        padding: 12,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 14,
            border: "1px solid #eee",
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>{eventName}</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>
            参加して撮影へ
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              表示名
            </div>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例）オモチカ"
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 14,
                outline: "none",
                background: "#fff",
              }}
              disabled={busy}
            />
          </div>

          {err && (
            <div
              style={{
                marginTop: 10,
                background: "#fff3f3",
                border: "1px solid #ffd0d0",
                color: "#c00",
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {err}
            </div>
          )}

          <button
            onClick={join}
            disabled={busy}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "14px",
              borderRadius: 999,
              border: 0,
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "参加中…" : "参加して撮影へ"}
          </button>

          <div style={{ marginTop: 10, fontSize: 10, opacity: 0.35 }}>
            UI_VER: {UI_VER}
          </div>
        </div>

        <Footer uiVer={UI_VER} />
      </div>
    </main>
  );
}