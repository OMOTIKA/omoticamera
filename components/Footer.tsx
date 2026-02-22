"use client";

import { useEffect, useMemo, useState } from "react";

type AppConfig = {
  uiVer?: string;
  ad?: {
    enabled?: boolean;
    label?: string;
    placeholder?: string;
    logoUrl?: string;
    linkUrl?: string;
    companyName?: string;
  };
};

type Props = {
  uiVer?: string;
  showSupporters?: boolean;
  /** ✅ 追加：この画面では広告（Supported by）を出さない */
  hideAd?: boolean;
};

export default function Footer({ uiVer, hideAd = false }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetch(`/app-config.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  const ad = config?.ad;

  const protoAd = useMemo(() => {
    const enabled = ad?.enabled ?? true;
    const label = ad?.label || "Supported by";
    const logoUrl = (ad?.logoUrl || "").trim() || "/canon-logo_01.png";
    const linkUrl = (ad?.linkUrl || "").trim() || "https://canon.jp/";
    const companyName = (ad?.companyName || "").trim() || "canon(キヤノン)";
    const placeholder = (ad?.placeholder || "").trim() || "ここに広告が入ります";
    return { enabled, label, logoUrl, linkUrl, companyName, placeholder };
  }, [ad]);

  return (
    <footer
      style={{
        marginTop: 14,
        paddingTop: 10,
        paddingBottom: 16,
        textAlign: "center",
        fontSize: 11,
        color: "#666",
      }}
    >
      {/* ✅ 広告スペース（Supported by） */}
      {!hideAd && protoAd.enabled && (
        <a
          href={protoAd.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            margin: "0 auto 12px",
            padding: 10,
            borderRadius: 14,
            background: "#fafafa",
            border: "1px solid #eee",
            maxWidth: 520,
            textDecoration: "none",
            color: "#444",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>
            {protoAd.label}
          </div>

          <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
            <img
              src={protoAd.logoUrl}
              alt={protoAd.companyName}
              style={{ maxHeight: 44, objectFit: "contain" }}
            />
            <div style={{ fontWeight: 900, fontSize: 12, color: "#333" }}>
              {protoAd.companyName}
            </div>

            {(!protoAd.logoUrl || protoAd.logoUrl.trim() === "") && (
              <div style={{ fontSize: 11, color: "#777" }}>{protoAd.placeholder}</div>
            )}
          </div>
        </a>
      )}

      {/* ✅ オモチカロゴ（復活） */}
      <div style={{ marginBottom: 6 }}>
        <img
          src="/omotika-logo.png"
          alt="オモチカ"
          style={{ height: 80, objectFit: "contain" }}
        />
      </div>

      <div>© OMOTIKA design / どこでもオモチカメラ</div>

      {(uiVer || config?.uiVer) && (
        <div style={{ marginTop: 6, opacity: 0.35 }}>
          UI_VER: {uiVer || config?.uiVer}
        </div>
      )}
    </footer>
  );
}