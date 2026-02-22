"use client";

// UI_VER: HOST_LOGIN_UI_V5_20260213

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import PrototypeNote from "@/components/PrototypeNote";

type Step = "login" | "otp";

type StartOk = { ok: true; marker: string; tmpToken: string; ttlSec: number };
type VerifyOk = {
  ok: true;
  marker: string;
  hostSessionToken: string;
  ttlSec: number;
  accountId?: string;
};
type ApiErr = { ok: false; error: string; message?: string };

function isEmail(s: string) {
  const v = s.trim().toLowerCase();
  return v.includes("@") && v.includes(".");
}

export default function HostLoginPage() {
  const UI_VER = "HOST_LOGIN_UI_V5_20260213";
  const router = useRouter();

  const [step, setStep] = useState<Step>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tmpToken, setTmpToken] = useState("");
  const [otp, setOtp] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");
    const t = (localStorage.getItem("omoticamera_hostSessionToken") || "").trim();
    if (t) router.replace("/host/home");
  }, [router]);

  const canSendOtp = useMemo(() => {
    return isEmail(email) && password.length >= 1 && !busy;
  }, [email, password, busy]);

  const canVerifyOtp = useMemo(() => {
    const code = otp.replace(/\D/g, "");
    return tmpToken.length >= 8 && code.length === 5 && !busy;
  }, [tmpToken, otp, busy]);

  const startLogin = async () => {
    if (!canSendOtp) return;
    setBusy(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const j = (await r.json()) as StartOk | ApiErr;
      if (!j?.ok) throw new Error((j as ApiErr)?.error || "login_start_failed");

      setTmpToken((j as StartOk).tmpToken || "");
      setStep("otp");
    } catch (e: any) {
      const msg = String(e?.message || e || "failed");
      if (msg === "bad_email") setErr("メールアドレスを確認してください");
      else if (msg === "email_not_registered") setErr("このメールアドレスは登録されていません");
      else setErr(`送信に失敗しました：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const verifyLogin = async () => {
    if (!canVerifyOtp) return;
    setBusy(true);
    setErr("");

    try {
      const code = otp.replace(/\D/g, "");
      const r = await fetch("/api/host/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ tmpToken, otp: code }),
      });

      const j = (await r.json()) as VerifyOk | ApiErr;
      if (!j?.ok) throw new Error((j as ApiErr)?.error || "otp_invalid");

      const token = (j as VerifyOk).hostSessionToken || "";
      if (!token) throw new Error("missing_hostSessionToken");

      localStorage.setItem("omoticamera_hostSessionToken", token);
      localStorage.setItem("omoticamera_role", "host");

      router.replace("/host/home");
    } catch (e: any) {
      const msg = String(e?.message || e || "failed");
      if (msg === "otp_invalid") setErr("認証コードが違います");
      else if (msg === "otp_not_found_or_expired") setErr("認証コードの有効期限が切れました。再送してください。");
      else setErr(`認証に失敗しました：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    await startLogin();
  };

  const goResetPw = () => router.push("/host/login/password");
  const goSignup = () => router.push("/host/signup/email");
  const goSupporters = () => router.push("/supporters");

  return (
    <main style={wrap}>
      <header style={stickyTop}>
        <div style={topInnerCenter}>
          <div style={brand}>どこでもオモチカメラ</div>
          <div style={title}>アカウントログイン</div>
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

        {/* 上段：既存ログイン */}
        <section style={card}>
          {step === "login" ? (
            <>
              <div style={label}>メールアドレス：</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                style={input}
              />

              <div style={{ height: 6 }} />

              <div style={label}>パスワード：</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                style={input}
              />

              <button onClick={goResetPw} style={forgotBtn} disabled={busy}>
                パスワードをお忘れの方
              </button>

              <button
                onClick={startLogin}
                disabled={!canSendOtp}
                style={{ ...btnPrimary, opacity: canSendOtp ? 1 : 0.55 }}
              >
                {busy ? "送信中…" : "認証コードを送る"}
              </button>

              {/* ✅ 縦を圧縮：注意文を短く */}
              <div style={miniNote}>※ 初回/別端末で認証コードが必要です。</div>
            </>
          ) : (
            <>
              <div style={centerTitle}>認証コード（5桁）</div>
              <div style={noteCenter}>メールに届いた5桁を入力してください</div>

              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
                placeholder="例：12345"
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ ...input, textAlign: "center", fontWeight: 900, letterSpacing: 4 }}
              />

              <button
                onClick={verifyLogin}
                disabled={!canVerifyOtp}
                style={{ ...btnPrimary, opacity: canVerifyOtp ? 1 : 0.55 }}
              >
                {busy ? "確認中…" : "ログインする"}
              </button>

              {/* ✅ 縦を圧縮：gap/余白を減らす */}
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                <button
                  onClick={resendOtp}
                  disabled={!canSendOtp}
                  style={{ ...btnGhost, opacity: canSendOtp ? 1 : 0.6 }}
                >
                  認証コードを再送
                </button>

                <button
                  onClick={() => {
                    setStep("login");
                    setOtp("");
                    setTmpToken("");
                    setErr("");
                  }}
                  style={btnGhost}
                  disabled={busy}
                >
                  メールアドレス入力へ戻る
                </button>
              </div>
            </>
          )}
        </section>

        {/* 下段：新規登録（別カテゴリ） */}
        <section style={{ ...card, marginTop: 8 }}>
          <button onClick={goSignup} style={btnGhost} disabled={busy}>
            新規アカウント登録はこちら
          </button>
        </section>

        {/* 創設サポーター（目立たせない） */}
        <div style={supportersWrap}>
          <button onClick={goSupporters} style={btnSupporters} disabled={busy}>
            創設サポーター
          </button>
        </div>

        {/* ✅ ここは仕様通り必須 */}
        <Footer uiVer={UI_VER} showSupporters={true} />
        <PrototypeNote />
      </div>
    </main>
  );
}

/* ---------------- styles（縦を詰める版） ---------------- */

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fff",
  color: "#111",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const stickyTop: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: "10px 12px", // ✅ 少し圧縮
};

const topInnerCenter: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  textAlign: "center",
};

const brand: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.1, // ✅ 圧縮
};

const title: React.CSSProperties = {
  marginTop: 4, // ✅ 圧縮
  fontSize: 12,
  fontWeight: 900,
  color: "#666",
  lineHeight: 1.15, // ✅ 圧縮
};

const body: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 10,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 10, // ✅ 12→10
  background: "#fafafa",
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#666",
  marginBottom: 5, // ✅ 6→5
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px", // ✅ 11→10
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const forgotBtn: React.CSSProperties = {
  marginTop: 4, // ✅ 6→4
  padding: "6px 0", // ✅ 8→6
  background: "transparent",
  border: 0,
  textAlign: "left",
  fontSize: 12,
  fontWeight: 900,
  color: "#111",
  textDecoration: "underline",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  marginTop: 8, // ✅ 10→8
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

const errBox: React.CSSProperties = {
  marginBottom: 8, // ✅ 10→8
  padding: "9px 12px", // ✅ 少し圧縮
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};

const miniNote: React.CSSProperties = {
  marginTop: 8, // ✅ 10→8
  fontSize: 11,
  color: "#777",
  lineHeight: 1.25, // ✅ 圧縮
  fontWeight: 800,
};

const centerTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  textAlign: "center",
};

const noteCenter: React.CSSProperties = {
  marginTop: 4, // ✅ 6→4
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
  textAlign: "center",
  lineHeight: 1.25, // ✅ 圧縮
  marginBottom: 8, // ✅ 10→8
};

const supportersWrap: React.CSSProperties = {
  maxWidth: 520,
  margin: "6px auto 0", // ✅ 8→6
  padding: "0 4px",
  display: "flex",
  justifyContent: "flex-end",
};

const btnSupporters: React.CSSProperties = {
  padding: "7px 10px", // ✅ 8→7
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
  color: "#666",
  cursor: "pointer",
};