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

export default function AdSlot() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetch(`/app-config.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  const ad = cfg?.ad;

  // OFFなら何も表示しない
  if (ad?.enabled === false) return null;

  const label = ad?.label || "Supported by";
  const placeholder = ad?.placeholder || "ここに広告が入ります";
  const hasLogo = !!ad?.logoUrl;

  const boxStyle: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fafafa",
    borderRadius: 14,
    padding: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const leftStyle: React.CSSProperties = { minWidth: 0 };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#666", fontWeight: 900 };
  const textStyle: React.CSSProperties = { fontSize: 13, fontWeight: 900, color: "#111", marginTop: 2 };

  const logoWrap: React.CSSProperties = {
    width: 84,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  };

  const inner = (
    <div style={boxStyle}>
      <div style={leftStyle}>
        <div style={labelStyle}>{label}</div>
        <div style={textStyle}>{hasLogo ? " " : placeholder}</div>
      </div>

      <div style={logoWrap}>
        {hasLogo ? (
          <img src={ad!.logoUrl!} alt="ad" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ fontSize: 10, color: "#999", fontWeight: 900 }}>LOGO</div>
        )}
      </div>
    </div>
  );

  // linkUrl があればクリック可能に
  if (ad?.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        {inner}
      </a>
    );
  }

  return inner;
}