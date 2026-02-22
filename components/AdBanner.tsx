"use client";

// UI_VER: AD_BANNER_V1_20260212

import { useEffect, useState } from "react";

type AdConfig = {
  enabled?: boolean;
  label?: string;
  placeholder?: string;
  logoUrl?: string;
  linkUrl?: string;
};

export default function AdBanner() {
  const [ad, setAd] = useState<AdConfig | null>(null);

  useEffect(() => {
    fetch("/app-config.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setAd(j?.ad ?? null))
      .catch(() =>
        setAd({
          enabled: true,
          label: "Supported by",
          placeholder: "ここに広告が入ります",
        })
      );
  }, []);

  if (!ad?.enabled) return null;

  const label = ad.label || "Supported by";
  const logo = ad.logoUrl || "/canon-logo_01.png"; // ← 今回のモック
  const link = ad.linkUrl || "https://canon.jp/";
  const placeholder = ad.placeholder || "";

  return (
    <div style={wrap}>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={box}
      >
        <div style={labelStyle}>{label}</div>

        {logo ? (
          <img src={logo} alt="sponsor" style={logoStyle} />
        ) : (
          <div style={ph}>{placeholder}</div>
        )}
      </a>
    </div>
  );
}

/* styles */

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 70, // PrototypeNote の上に乗せる
  zIndex: 998,
  padding: "6px 10px",
  pointerEvents: "none",
};

const box: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 14,
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textDecoration: "none",
  color: "#333",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  pointerEvents: "auto",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#666",
  minWidth: 96,
};

const logoStyle: React.CSSProperties = {
  height: 28,
  objectFit: "contain",
};

const ph: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#999",
};