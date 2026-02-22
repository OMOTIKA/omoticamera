// /app/credits/page.tsx
"use client";

// UI_VER: CREDITS_V1_20260206

import Footer from "@/components/Footer";
import Link from "next/link";

type Supporter = {
  name: string;
  note?: string; // 任意：肩書き/一言/企業名など
};

// ※ まずは仮データ（後でCMSやJSON/APIに置き換える想定）
const SUPPORTERS: Supporter[] = [
  { name: "初期サポーター募集中", note: "クラウドファンディング準備中" },
];

export default function CreditsPage() {
  const UI_VER = "CREDITS_V1_20260206";

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
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* ヘッダ */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/album"
              style={{
                textDecoration: "none",
                color: "#111",
                fontWeight: 900,
                borderRadius: 999,
                padding: "8px 12px",
                border: "1px solid #eaeaea",
                background: "#fff",
                whiteSpace: "nowrap",
              }}
            >
              戻る
            </Link>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>
                初期サポーター
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                「どこでもオモチカメラ」を支えてくださった皆さま
              </div>
            </div>
          </div>
        </div>

        {/* 本文 */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            ※ 表記内容は、支援時のプランや申請内容に基づいて掲載されます。
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {SUPPORTERS.map((s, idx) => (
              <div
                key={`${s.name}-${idx}`}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14, color: "#111" }}>
                  {s.name}
                </div>
                {s.note ? (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {s.note}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* 将来の広告枠のためのプレースホルダ（今は非表示でOKだが、場所だけ確保しやすい設計） */}
          {/* <div style={{ marginTop: 12, fontSize: 12, color: "#999" }}>
            （将来：スポンサー表示枠）
          </div> */}
        </div>

        <Footer uiVer={UI_VER} />
      </div>
    </main>
  );
}