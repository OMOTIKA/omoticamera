"use client";

// UI_VER: HOST_SIGNUP_EMAIL_UI_V2_20260213

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import PrototypeNote from "@/components/PrototypeNote";

const UI_VER = "HOST_SIGNUP_EMAIL_UI_V2_20260213";

type StartOk = { ok: true; marker: string; tmpToken: string; ttlSec: number };
type VerifyOk = { ok: true; marker: string; signupToken: string; ttlSec: number };
type ApiErr = { ok: false; error: string; message?: string };

function isEmail(s: string) {
  const v = s.trim();
  return v.includes("@") && v.includes(".");
}

export default function HostSignupEmailPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [tmpToken, setTmpToken] = useState<string>("");

  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"email" | "otp">("email");

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState("");

  // ✅ 規約チェック（外せるようにする）
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePhotoConsent, setAgreePhotoConsent] = useState(false);
  const [agreeShare, setAgreeShare] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);

  const canSend = useMemo(() => {
    return (
      isEmail(email) &&
      agreeTerms &&
      agreePhotoConsent &&
      agreeShare &&
      agreeAge &&
      !sending
    );
  }, [email, agreeTerms, agreePhotoConsent, agreeShare, agreeAge, sending]);

  const canVerify = useMemo(() => {
    const code = otp.replace(/\D/g, "");
    return tmpToken.length >= 8 && code.length === 5 && !verifying;
  }, [tmpToken, otp, verifying]);

  const sendOtp = async () => {
    if (!canSend) return;

    setSending(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/signup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = (await r.json()) as StartOk | ApiErr;

      if (!j?.ok) {
        throw new Error((j as ApiErr)?.error || "otp_send_failed");
      }

      // ✅ tmpTokenは「OTP入力のため」に必ず保持（短期なので sessionStorage 推奨）
      setTmpToken((j as StartOk).tmpToken);
      sessionStorage.setItem("omoticamera_tmpToken", (j as StartOk).tmpToken);
      sessionStorage.setItem("omoticamera_signup_email", email.trim());

      // OTP入力フェーズへ
      setPhase("otp");
    } catch (e: any) {
      const msg = String(e?.message || e || "failed");
      if (msg === "bad_email") setErr("メールアドレスを確認してください");
      else if (msg === "otp_send_failed")
        setErr(
          "認証コード送信に失敗しました（SendGrid設定などを確認してください）"
        );
      else setErr(`認証コード送信に失敗しました：${msg}`);
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.replace(/\D/g, "");
    if (!canVerify) return;

    setVerifying(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ tmpToken, otp: code }),
      });
      const j = (await r.json()) as VerifyOk | ApiErr;

      if (!j?.ok) {
        const ecode = (j as ApiErr)?.error || "verify_failed";
        throw new Error(ecode);
      }

      // ✅ 本命：signupToken を必ず保存して password へ
      const signupToken = (j as VerifyOk).signupToken;
      sessionStorage.setItem("omoticamera_signupToken", signupToken);

      // セキュリティ的に tmpToken/otp は役目終了（消してOK）
      sessionStorage.removeItem("omoticamera_tmpToken");

      router.push("/host/signup/password");
    } catch (e: any) {
      const msg = String(e?.message || e || "failed");
      if (msg === "missing_params") setErr("入力が不足しています");
      else if (msg === "otp_invalid") setErr("認証コードが違います");
      else if (msg === "otp_not_found_or_expired")
        setErr("認証コードの有効期限が切れました。再送してください。");
      else setErr(`認証に失敗しました：${msg}`);
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    // resend は「同じメールで再送」＝ start を呼び直して tmpToken 更新
    await sendOtp();
  };

  return (
    <main style={wrap}>
      {/* 固定ヘッダー */}
      <div style={stickyTop}>
        <div style={topInnerCenter}>
          <div style={brand}>どこでもオモチカメラ</div>
          <div style={pageTitle}>ホスト（主催者）アカウント作成</div>
        </div>
      </div>

      <div style={body}>
        {/* ※ プロトタイプ注意は “上” じゃなく “下” に置く（縦圧縮） */}
        <section style={card}>
          {phase === "email" ? (
            <>
              <div style={label}>メールアドレス</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例：info@omotikadesign.com"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                style={input}
              />

              <div style={{ height: 10 }} />

              {/* 規約チェック（外せる） */}
              <div style={checks}>
                <label style={checkRow}>
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    利用規約・プライバシーポリシーに同意します{" "}
                    {/* ✅ ここだけ表記変更 */}
                    <a href="/terms" style={link}>
                      (全文リンク)
                    </a>
                  </span>
                </label>

                <label style={checkRow}>
                  <input
                    type="checkbox"
                    checked={agreePhotoConsent}
                    onChange={(e) =>
                      setAgreePhotoConsent(e.target.checked)
                    }
                  />
                  <span>写真の掲載同意を得ています</span>
                </label>

                <label style={checkRow}>
                  <input
                    type="checkbox"
                    checked={agreeShare}
                    onChange={(e) => setAgreeShare(e.target.checked)}
                  />
                  <span>投稿写真の共有利用を許諾します</span>
                </label>

                <label style={checkRow}>
                  <input
                    type="checkbox"
                    checked={agreeAge}
                    onChange={(e) => setAgreeAge(e.target.checked)}
                  />
                  <span>18歳以上（または保護者同意あり）</span>
                </label>
              </div>

              {err && <div style={errBox}>{err}</div>}

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button
                  onClick={sendOtp}
                  disabled={!canSend}
                  style={{
                    ...btnPrimary,
                    opacity: canSend ? 1 : 0.55,
                  }}
                >
                  {sending ? "送信中…" : "認証コードを送る"}
                </button>

                <button onClick={() => router.back()} style={btnGhost}>
                  戻る
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={msgTitle}>認証コード入力</div>
              <div style={msgText}>
                メールアドレスを確認して、5桁の認証コードを入力してください。
              </div>

              <div style={{ height: 10 }} />

              <div style={label}>認証コード（5桁）</div>
              <input
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                placeholder="例：12345"
                inputMode="numeric"
                style={input}
              />

              {err && <div style={errBox}>{err}</div>}

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button
                  onClick={verifyOtp}
                  disabled={!canVerify}
                  style={{
                    ...btnPrimary,
                    opacity: canVerify ? 1 : 0.55,
                  }}
                >
                  {verifying ? "確認中…" : "次へ"}
                </button>

                <button onClick={resend} disabled={sending} style={btnGhost}>
                  認証コードを再送
                </button>

                <button
                  onClick={() => {
                    // 最初からやり直し
                    setPhase("email");
                    setOtp("");
                    setTmpToken("");
                    setErr("");
                    sessionStorage.removeItem("omoticamera_tmpToken");
                    sessionStorage.removeItem("omoticamera_signupToken");
                  }}
                  style={btnGhost}
                >
                  メールアドレス入力へ戻る
                </button>
              </div>
            </>
          )}
        </section>

        <Footer uiVer={UI_VER} showSupporters={false} />
        <PrototypeNote />
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
  zIndex: 20,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: 10,
};

const topInnerCenter: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  textAlign: "center",
};

const brand: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
};

const pageTitle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 900,
  color: "#444",
};

const body: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 10,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const label: React.CSSProperties = {
  fontSize: 11,
  color: "#666",
  fontWeight: 900,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const checks: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 12,
  color: "#111",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  lineHeight: 1.35,
  fontWeight: 800,
};

const link: React.CSSProperties = {
  textDecoration: "underline",
  color: "#111",
  fontWeight: 900,
};

const msgTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const msgText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#555",
  fontWeight: 800,
  lineHeight: 1.35,
};

const errBox: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 12,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
};

const btnGhost: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
};