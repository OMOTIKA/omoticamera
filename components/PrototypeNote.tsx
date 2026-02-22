"use client";

// UI_VER: PROTOTYPE_NOTE_V1_20260212

import { useEffect, useState } from "react";

type Props = {
  text?: string;
  storageKey?: string; // ユーザーが閉じたら覚える
};

export default function PrototypeNote({
  text = "※ 現在、開発中につき、仕様は予告なく変更されます。",
  storageKey = "omoticamera_hidePrototypeNote",
}: Props) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      setHidden(v === "1");
    } catch {
      setHidden(false);
    }
  }, [storageKey]);

  if (hidden) return null;

  return (
    <div style={wrap} role="note" aria-label="プロトタイプ注意書き">
      <div style={box}>
        <div style={msg}>{text}</div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, "1");
            } catch {}
            setHidden(true);
          }}
          style={btn}
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
  padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
  pointerEvents: "none", // 下のUIを邪魔しない
};

const box: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  pointerEvents: "auto", // 自分は押せる
};

const msg: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#555",
  lineHeight: 1.35,
  flex: 1,
};

const btn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 18,
  lineHeight: "32px",
  cursor: "pointer",
};