"use client";

// UI_VER: HOST_PLANS_REDIRECT_V1_20260211

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HostPlansPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/host/create");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        background: "#fff",
        color: "#111",
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14 }}>プラン画面を開いています…</div>
      <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
        自動で「新規イベント作成」へ移動します
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "#aaa" }}>
        UI_VER: HOST_PLANS_REDIRECT_V1_20260211
      </div>
    </main>
  );
}