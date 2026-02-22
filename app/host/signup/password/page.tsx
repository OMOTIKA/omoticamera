"use client";

// UI_VER: HOST_SIGNUP_PASSWORD_UI_V1_20260212

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import PrototypeNote from "@/components/PrototypeNote";

const UI_VER = "HOST_SIGNUP_PASSWORD_UI_V1_20260212";

type ApiOk = { ok: true; marker: string; accountId: string; hostSessionToken: string; ttlSec: number };
type ApiErr = { ok: false; error: string; message?: string };

export default function HostSignupPasswordPage() {
  const router = useRouter();

  const [signupToken, setSignupToken] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = sessionStorage.getItem("omoticamera_signupToken") || "";
    if (!t) {
      router.replace("/host/signup/email");
      return;
    }
    setSignupToken(t);
  }, [router]);

  const canSubmit = useMemo(() => {
    return !saving && pw1.length >= 8 && pw1 === pw2 && signupToken.length >= 8;
  }, [saving, pw1, pw2, signupToken]);

  const submit = async () => {
    if (!canSubmit) return;

    setSaving(true);
    setErr("");

    try {
      const r = await fetch("/api/host/auth/signup/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ signupToken, password: pw1 }),
      });

      const j = (await r.json()) as ApiOk | ApiErr;

      if (!j?.ok) {
        throw new Error((j as ApiErr)?.error || "failed");
      }

      // ✅ ログイン状態を保存（本番想定：端末に保持するので localStorage）
      localStorage.setItem("omoticamera_hostSessionToken", (j as ApiOk).hostSessionToken);
      localStorage.setItem("omoticamera_hostAccountId", (j as ApiOk).accountId);

      // signupTokenは使い捨て：消す
      sessionStorage.removeItem("omoticamera_signupToken");

      router.replace("/host/home");
    } catch (e: any) {
      const msg = String(e?.message || e || "failed");
      if (msg === "weak_password") setErr("パスワードは8文字以上にしてください");
      else if (msg === "signupToken_not_found_or_expired") setErr("手続きが期限切れです。最初からやり直してください。");
      else if (msg === "email_already_registered") setErr("このメールアドレスは既に登録されています。ログインに進んでください。");
      else setErr(`アカウント作成に失敗しました：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={wrap}>
      <div style={stickyTop}>
        <div style={topInnerCenter}>
          <div style={brand}>どこでもオモチカメラ</div>
          <div style={pageTitle}>認証コード入力</div>
        </div>
      </div>

      <div style={body}>
        <section style={card}>
          <div style={label}>パスワード（8文字以上）</div>
          <input
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            type="password"
            style={input}
            autoCapitalize="none"
            autoCorrect="off"
          />

          <div style={{ height: 8 }} />

          <div style={label}>パスワード（確認）</div>
          <input
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            type="password"
            style={input}
            autoCapitalize="none"
            autoCorrect="off"
          />

          {pw2 && pw1 !== pw2 ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "#b00020", fontWeight: 900 }}>
              パスワードが一致しません
            </div>
          ) : null}

          {err && <div style={errBox}>{err}</div>}

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <button onClick={submit} disabled={!canSubmit} style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.55 }}>
              {saving ? "作成中…" : "アカウント作成"}
            </button>

            <button onClick={() => router.back()} style={btnGhost}>
              戻る
            </button>
          </div>
        </section>

        <Footer uiVer={UI_VER} showSupporters={false} />
        <PrototypeNote />
      </div>
    </main>
  );
}

/* styles */

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