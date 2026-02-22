"use client";

import { useEffect, useState } from "react";

type AppConfig = {
  ad?: {
    enabled?: boolean;
    label?: string;
    placeholder?: string;
    logoUrl?: string;
    linkUrl?: string;
  };
};

type Props = {
  // 画面によって「小さめ/大きめ」だけ変えたい時用
  compact?: boolean;
};

export default function AdSlot({ compact = true }: Props) {
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetch(`/app-config.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => {});
  }, []);

  const ad = cfg?.ad;
  if (!ad?.enabled) return null;

  const label = (ad.label || "Supported by").trim();
  const placeholder = (ad.placeholder || "ここに広告が入ります").trim();
  const logoUrl = (ad.logoUrl || "").trim();
  const linkUrl = (ad.linkUrl || "").trim();

  const box: React.CSSProperties = {
    marginTop: compact ? 10 : 14,
    padding: compact ? 10 : 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fafafa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    textDecoration: "none",
    color: "#444",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 900,
    color: "#666",
    whiteSpace: "nowrap",
  };

  const placeholderStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    color: "#111",
  };

  const imgStyle: React.CSSProperties = {
    height: compact ? 28 : 34,
    maxWidth: "60%",
    objectFit: "contain",
    display: "block",
  };

  // ロゴ無し＝プレースホルダ
  if (!logoUrl) {
    return (
      <div style={box}>
        <span style={labelStyle}>{label}</span>
        <span style={placeholderStyle}>{placeholder}</span>
      </div>
    );
  }

  // ロゴあり＝リンク（linkUrlが無ければリンク無し表示）
  const inner = (
    <>
      <span style={labelStyle}>{label}</span>
      <img src={logoUrl} alt="sponsor" style={imgStyle} />
    </>
  );

  if (!linkUrl) {
    return <div style={box}>{inner}</div>;
  }

  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={box}>
      {inner}
    </a>
  );
}