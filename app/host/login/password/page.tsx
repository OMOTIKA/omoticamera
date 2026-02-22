"use client";

// UI_VER: HOST_LOGIN_PASSWORD_UI_V3_20260213

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

type Step = "email" | "otp" | "setpw" | "done";

export default function HostLoginPasswordPage() {
  const UI_VER = "HOST_LOGIN_PASSWORD_UI_V3_20260213";
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [tmpToken, setTmpToken] = useState("");

  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canSend = useMemo(() => {
    const e = email.trim();
    return e.includes("@") && !busy;
  }, [email, busy]);

  const canVerify = useMemo(() => {
    return tmpToken && otp.trim().length === 5 && !busy;
  }, [tmpToken, otp, busy]);

  const canSetPw = useMemo(() => {
    if (!resetToken) return false;
    if (pw1.length < 8) return false;
    if (pw1 !== pw2) return false;
    return !busy;
  }, [resetToken, pw1, pw2, busy]);

  const sendOtp = async () => {
    if (!canSend) return;
    setBusy(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/password/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json();

      if (!j?.ok) throw new Error(j?.error || "otp_send_failed");
      setTmpToken(String(j.tmpToken || ""));
      setStep("otp");
    } catch (e: any) {
      setErr(`送信失敗：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    // emailステップへ戻さず、そのまま再送（UX優先）
    await sendOtp();
  };

  const verifyOtp = async () => {
    if (!canVerify) return;
    setBusy(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ tmpToken, otp: otp.trim() }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "otp_invalid");

      const token = String(j.resetToken || "");
      if (!token) throw new Error("missing_resetToken");

      setResetToken(token);
      setStep("setpw");
    } catch (e: any) {
      setErr(`確認失敗：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const setPassword = async () => {
    if (!canSetPw) return;
    setBusy(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ resetToken, password: pw1 }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "set_failed");

      setStep("done");
      window.setTimeout(() => router.replace("/host/login"), 700);
    } catch (e: any) {
      setErr(`変更失敗：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={wrap}>
      {/* 固定ヘッダー：左上戻る／右上は空（ログアウト不要） */}
      <header style={stickyTop}>
        <div style={topInner}>
          <button onClick={() => router.back()} style={btnBack} aria-label="戻る">
            ← 戻る
          </button>

          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={brand}>どこでもオモチカメラ</div>
            {/* ✅ 文言変更 */}
            <div style={title}>アカウントパスワードの再設定</div>
          </div>

          <div style={{ width: 84 }} />
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

        {step === "email" && (
          <section style={card}>
            <div style={label}>メールアドレス（ID）：</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例：info@omotikadesign.com"
              style={input}
              inputMode="email"
              autoComplete="email"
            />

            <button
              onClick={sendOtp}
              disabled={!canSend}
              style={{ ...btnPrimary, opacity: canSend ? 1 : 0.55 }}
            >
              {busy ? "送信中…" : "認証コードを送る"}
            </button>

            <div style={note}>※ 5桁の認証コードをメールで送ります（有効期限あり）。</div>
          </section>
        )}

        {step === "otp" && (
          <section style={card}>
            <div style={centerTitle}>認証コード（5桁）</div>
            <div style={noteCenter}>受信したメールの5桁コードを入力してください</div>

            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              placeholder="例：12345"
              style={{ ...input, textAlign: "center", fontWeight: 900, letterSpacing: 4 }}
              inputMode="numeric"
              autoComplete="one-time-code"
            />

            <button
              onClick={verifyOtp}
              disabled={!canVerify}
              style={{ ...btnPrimary, opacity: canVerify ? 1 : 0.55 }}
            >
              {busy ? "確認中…" : "次へ"}
            </button>

            {/* ✅ 再送ボタンを「増やす」：同機能のボタンを2種類置く（押しやすさ/意図明確化） */}
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <button
                onClick={resendOtp}
                disabled={!canSend}
                style={{ ...btnGhost, opacity: canSend ? 1 : 0.6 }}
              >
                認証コードを再送
              </button>

              <button
                onClick={resendOtp}
                disabled={!canSend}
                style={{ ...btnGhost, opacity: canSend ? 1 : 0.6 }}
              >
                認証コードを再送する
              </button>

              <button onClick={() => setStep("email")} style={btnGhost} disabled={busy}>
                メールアドレスを変更する
              </button>
            </div>
          </section>
        )}

        {step === "setpw" && (
          <section style={card}>
            <div style={centerTitle}>新しいパスワード</div>
            <div style={noteCenter}>8文字以上で設定してください</div>

            <div style={label}>パスワード：</div>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="8文字以上"
              style={input}
              autoComplete="new-password"
            />

            <div style={{ height: 8 }} />

            <div style={label}>パスワード（確認）：</div>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="もう一度"
              style={input}
              autoComplete="new-password"
            />

            <button
              onClick={setPassword}
              disabled={!canSetPw}
              style={{ ...btnPrimary, opacity: canSetPw ? 1 : 0.55 }}
            >
              {busy ? "変更中…" : "パスワードを変更する"}
            </button>

            <div style={note}>※ 変更後、ログイン画面に戻ります。</div>
          </section>
        )}

        {step === "done" && (
          <section style={card}>
            <div style={centerTitle}>変更しました</div>
            <div style={noteCenter}>ログイン画面へ移動します…</div>
          </section>
        )}

        {/* ✅ ロゴ/コピーライト/Supported by：カメラ・QR以外は必ず表示 */}
        <Footer uiVer={UI_VER} showSupporters={true} />
      </div>
    </main>
  );
}

/* ---------------- styles ---------------- */

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fff",
  color: "#111",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const stickyTop: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: "10px 10px 8px",
};

const topInner: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "84px 1fr 84px",
  alignItems: "center",
  gap: 8,
};

const btnBack: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const brand: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const title: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 900,
  color: "#666",
  lineHeight: 1.1,
};

const body: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 10,
  display: "grid",
  gap: 10,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#666",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "#111",
  color: "#fff",
  border: 0,
  fontWeight: 900,
  fontSize: 14,
  marginTop: 10,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.12)",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

const errBox: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};

const note: React.CSSProperties = {
  marginTop: 10,
  fontSize: 11,
  color: "#777",
  lineHeight: 1.35,
  fontWeight: 800,
};

const centerTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  textAlign: "center",
};

const noteCenter: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
  textAlign: "center",
  lineHeight: 1.4,
};