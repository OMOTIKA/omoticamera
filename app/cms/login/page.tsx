"use client";

// UI_VER: CMS_LOGIN_UI_V1_20260209

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api/cms";
const LS_TOKEN = "omoticamera_cms_token";
const LS_LOGINID = "omoticamera_cms_loginId";
const LS_DISPLAY = "omoticamera_cms_displayName";

export default function CmsLoginPage() {
  const UI_VER = "CMS_LOGIN_UI_V1_20260209";
  const router = useRouter();

  const [loginId, setLoginId] = useState("sakaia");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // 既にログイン済みならダッシュボードへ
    const token = localStorage.getItem(LS_TOKEN);
    if (token) router.replace("/cms/dashboard");
  }, [router]);

  const onSubmit = async () => {
    if (sending) return;
    setMsg("");
    if (!loginId || !password) {
      setMsg("ログインIDとパスワードを入力してください");
      return;
    }

    setSending(true);
    try {
      const qs = new URLSearchParams({
        loginId,
        password,
        v: String(Date.now()),
      });

      const r = await fetch(`${API_BASE}/auth_login.php?${qs.toString()}`, {
        cache: "no-store",
      });
      const j = await r.json();

      if (!j?.ok || !j?.tmpToken) throw new Error("login_failed");

      // displayName は任意（あれば保存）
      if (j.displayName) localStorage.setItem(LS_DISPLAY, String(j.displayName));
      localStorage.setItem(LS_LOGINID, loginId);

      // OTP送信へ
      router.push(`/cms/otp?tmpToken=${encodeURIComponent(j.tmpToken)}`);
    } catch {
      setMsg("ログインできませんでした（通信/認証）");
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          どこでもオモチカメラCMS
        </div>

        <div style={label}>ログインID</div>
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          style={input}
          autoCapitalize="none"
          autoCorrect="off"
        />

        <div style={label}>パスワード</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
          autoCapitalize="none"
          autoCorrect="off"
        />

        <button onClick={onSubmit} disabled={sending} style={primaryBtn}>
          {sending ? "送信中…" : "ログイン"}
        </button>

        {msg && <div style={msgStyle}>{msg}</div>}

        <div style={uiVer}>UI_VER: {UI_VER}</div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f6f6",
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 14,
  padding: 14,
  boxSizing: "border-box",
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
  marginTop: 10,
  marginBottom: 6,
  fontWeight: 800,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  fontSize: 15,
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "12px 12px",
  borderRadius: 999,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const msgStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  color: "#b00020",
  fontWeight: 800,
};

const uiVer: React.CSSProperties = {
  marginTop: 12,
  fontSize: 10,
  opacity: 0.35,
};