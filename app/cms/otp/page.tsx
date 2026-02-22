"use client";

// UI_VER: CMS_OTP_UI_V1_20260209_SUSPENSE_FIX

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api/cms";
const LS_TOKEN = "omoticamera_cms_token";

export default function CmsOtpPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <CmsOtpInner />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          ワンタイムパスコード（OTP）
        </div>
        <div style={desc}>読み込み中…</div>
      </div>
    </main>
  );
}

function CmsOtpInner() {
  const UI_VER = "CMS_OTP_UI_V1_20260209_SUSPENSE_FIX";
  const router = useRouter();
  const sp = useSearchParams();

  const tmpToken = useMemo(() => sp.get("tmpToken") || "", [sp]);

  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("メールを確認して、6桁のコードを入力してください");
  const [sentOnce, setSentOnce] = useState(false);

  useEffect(() => {
    if (!tmpToken) {
      setMsg("tmpToken がありません。ログインからやり直してください。");
      return;
    }
    // 画面に来たら自動で送信（UX）
    if (!sentOnce) void sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmpToken]);

  const sendOtp = async () => {
    if (sending) return;
    if (!tmpToken) return;

    setSending(true);
    try {
      const qs = new URLSearchParams({ tmpToken, v: String(Date.now()) });
      const r = await fetch(`${API_BASE}/auth_otp_send.php?${qs}`, { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) throw new Error("send_failed");
      setSentOnce(true);
      setMsg("送信しました。メールの6桁コードを入力してください");
    } catch {
      setMsg("送信できませんでした（通信）");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (sending) return;
    setMsg("");
    if (!tmpToken) {
      setMsg("tmpToken がありません。ログインからやり直してください。");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setMsg("6桁の数字を入力してください");
      return;
    }

    setSending(true);
    try {
      const qs = new URLSearchParams({ tmpToken, otp, v: String(Date.now()) });
      const r = await fetch(`${API_BASE}/auth_otp_verify.php?${qs}`, { cache: "no-store" });
      const j = await r.json();

      if (!j?.ok || !j?.sessionToken) throw new Error("verify_failed");

      localStorage.setItem(LS_TOKEN, String(j.sessionToken));
      router.replace("/cms/dashboard");
    } catch {
      setMsg("確認できませんでした（期限切れ/誤り/通信）");
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          ワンタイムパスコード（OTP）
        </div>

        <div style={desc}>{msg}</div>

        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          inputMode="numeric"
          pattern="\d*"
          placeholder="123456"
          style={input}
        />

        <button onClick={verify} disabled={sending} style={primaryBtn}>
          {sending ? "確認中…" : "確認してログイン"}
        </button>

        <button onClick={sendOtp} disabled={sending} style={ghostBtn}>
          再送
        </button>

        <button onClick={() => router.replace("/cms/login")} style={linkBtn}>
          ログインに戻る
        </button>

        <div style={uiVer}>UI_VER: {UI_VER}</div>
      </div>
    </main>
  );
}

/* styles */

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

const desc: React.CSSProperties = {
  fontSize: 13,
  color: "#333",
  marginBottom: 10,
  lineHeight: 1.4,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: 3,
  textAlign: "center",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "12px 12px",
  borderRadius: 999,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "12px 12px",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
};

const linkBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#333",
  fontWeight: 800,
  fontSize: 13,
  textDecoration: "underline",
};

const uiVer: React.CSSProperties = {
  marginTop: 12,
  fontSize: 10,
  opacity: 0.35,
};