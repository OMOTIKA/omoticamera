"use client";

import { useRouter } from "next/navigation";

export default function HostHeader() {
  const router = useRouter();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #eee",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900 }}>ホスト</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/host/qr")}
            style={{ padding: "10px 12px", borderRadius: 999, cursor: "pointer" }}
          >
            QR表示
          </button>

          <button
            onClick={() => router.back()}
            style={{ padding: "10px 12px", borderRadius: 999, cursor: "pointer" }}
          >
            戻る
          </button>
        </div>
      </div>
    </header>
  );
}