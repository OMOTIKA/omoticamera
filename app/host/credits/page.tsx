"use client";

import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

export default function HostCreditsPage() {
  const UI_VER = "HOST_CREDITS_UI_V1_20260213";
  const router = useRouter();

  return (
    <main style={wrap}>
      <div style={stickyTop}>
        <div style={topInner}>
          <button onClick={() => router.back()} style={btnBack}>
            ← 戻る
          </button>

          <div style={title}>アプリのクレジット表記</div>

          <div style={{ width: 80 }} />
        </div>
      </div>

      <div style={body}>
        {/* ✅ ここはCMS差し替え前提 */}
        <section style={card}>
          <h2>どこでもオモチカメラ</h2>
          <p>企画・開発：OMOTIKA design_オモチカ</p>
          <p>Supported by：キヤノン株式会社</p>
          <p>創設メインサポーター：小室哲哉さん</p>
          <p>Special Thanks：かのんちゃん、ねみちゃん</p>
        </section>

        <Footer uiVer={UI_VER} showSupporters={true} />
      </div>
    </main>
  );
}

/* styles */

const wrap = { minHeight: "100vh", background: "#fff", fontFamily: "system-ui" };
const stickyTop = { position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #eee", padding: 10 };
const topInner = { maxWidth: 520, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" };
const title = { fontWeight: 900, fontSize: 14 };

const btnBack = { border: "1px solid #ddd", borderRadius: 10, padding: "8px 10px", background: "#fff", fontWeight: 900 };

const body = { maxWidth: 520, margin: "0 auto", padding: 10 };
const card = { border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" };