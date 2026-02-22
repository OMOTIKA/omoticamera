import { redirect } from "next/navigation";

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const ev = searchParams?.event;
  const eventId = Array.isArray(ev) ? ev[0] : ev;

  // ✅ 旧URL互換： /?event=xxxx で来たら /join?event=xxxx に転送
  if (eventId && String(eventId).trim()) {
    redirect(`/join?event=${encodeURIComponent(String(eventId).trim())}`);
  }

  // ✅ ホスト入口だけ（ゲスト導線は置かない）
  return (
    <main
      style={{
        padding: 24,
        maxWidth: 520,
        margin: "0 auto",
        fontFamily: "sans-serif",
        color: "#111",
        background: "#fff",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
        どこでもオモチカメラ
      </h1>

      <p style={{ marginTop: 0, color: "#555", fontSize: 14, lineHeight: 1.6 }}>
        ※ ゲストはQRから参加します（この画面はホスト専用です）
      </p>

      <a
        href="/host/login"
        style={{
          display: "block",
          width: "100%",
          padding: "14px 16px",
          borderRadius: 999,
          background: "#000",
          color: "#fff",
          fontWeight: 900,
          fontSize: 16,
          textAlign: "center",
          textDecoration: "none",
          marginTop: 12,
        }}
      >
        ホストとして開始する
      </a>
    </main>
  );
}