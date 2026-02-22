"use client";

// UI_VER: HOST_SIGNUP_OTP_V1_20260211_SUSPENSE_FIX

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import PrototypeNote from "@/components/PrototypeNote";

const API = "https://omotika.zombie.jp/omoticamera-api/cms";

export default function HostSignupOtpPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <HostSignupOtpInner />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <main style={wrap}>
      <div style={stickyTop}>
        <div style={topRow}>
          <div style={{ width: 68 }} />
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={brand}>どこでもオモチカメラ</div>
            <div style={sub}>認証コード入力</div>
          </div>
          <div style={{ width: 68 }} />
        </div>
      </div>

      <div style={body}>
        <section style={card}>
          <div style={msg}>読み込み中…</div>
          <div style={{ height: 44, borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.10)" }} />
          <button style={{ ...btnPrimary, opacity: 0.55 }} disabled>
            準備中…
          </button>
        </section>

        <PrototypeNote />
        <Footer uiVer={"HOST_SIGNUP_OTP_V1_20260211_SUSPENSE_FIX"} showSupporters={false} />
      </div>
    </main>
  );
}

function HostSignupOtpInner() {
  const UI_VER = "HOST_SIGNUP_OTP_V1_20260211_SUSPENSE_FIX";
  const router = useRouter();
  const sp = useSearchParams();

  const email = (sp.get("email") || "").trim();
  const tmpToken = (sp.get("tmpToken") || "").trim();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canNext = useMemo(
    () => otp.trim().length >= 4 && !!tmpToken && !loading,
    [otp, tmpToken, loading]
  );

  const resend = async () => {
    if (!email) {
      setErr("メールアドレスが見つかりません。戻ってやり直してください。");
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const url = `${API}/auth_otp_send.php?email=${encodeURIComponent(email)}&v=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      const text = await r.text();
      let j: any;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error("server_not_json");
      }
      if (!j?.ok) throw new Error(j?.error || "send_failed");

      const nextTmp = String(j.tmpToken || "");
      if (!nextTmp) throw new Error("missing_tmpToken");

      router.replace(
        `/host/signup/otp?email=${encodeURIComponent(email)}&tmpToken=${encodeURIComponent(nextTmp)}`
      );
      setOtp("");
    } catch {
      setErr("再送に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!tmpToken) {
      setErr("一時トークンがありません。戻ってやり直してください。");
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const fd = new URLSearchParams();
      fd.set("tmpToken", tmpToken);
      fd.set("otp", otp.trim());

      const r = await fetch(`${API}/auth_otp_verify.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: fd.toString(),
      });

      const text = await r.text();
      let j: any;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error("server_not_json");
      }
      if (!j?.ok) throw new Error(j?.error || "otp_failed");

      router.push(
        `/host/signup/password?email=${encodeURIComponent(email)}&tmpToken=${encodeURIComponent(tmpToken)}`
      );
    } catch (e: any) {
      const m = String(e?.message || e || "failed");
      if (m === "otp_invalid") setErr("認証コードが正しくありません");
      else if (m === "otp_not_found_or_expired") setErr("認証コードの有効期限が切れています（再送してください）");
      else setErr("認証に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={wrap}>
      <div style={stickyTop}>
        <div style={topRow}>
          <button onClick={() => router.back()} style={backBtn}>
            ← 戻る
          </button>

          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={brand}>どこでもオモチカメラ</div>
            <div style={sub}>認証コード入力</div>
          </div>

          <div style={{ width: 68 }} />
        </div>
      </div>

      <div style={body}>
        <section style={card}>
          <div style={msg}>
            メールアドレスを確認して、<b>5桁の認証コード</b>を入力してください
          </div>

          <input
            placeholder="認証コード（5桁）"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={input}
            inputMode="numeric"
          />

          <button onClick={verify} disabled={!canNext} style={{ ...btnPrimary, opacity: canNext ? 1 : 0.55 }}>
            {loading ? "確認中…" : "次へ"}
          </button>

          <button onClick={resend} disabled={loading} style={btnGhost}>
            認証コードを再送
          </button>

          {err && <div style={errBox}>{err}</div>}
        </section>

        <PrototypeNote />
        <Footer uiVer={UI_VER} showSupporters={false} />
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

const topRow: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const brand: React.CSSProperties = { fontSize: 18, fontWeight: 900, lineHeight: 1.1 };
const sub: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "#555", marginTop: 2 };

const backBtn: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12,
  padding: "8px 10px",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
};

const body: React.CSSProperties = { maxWidth: 520, margin: "0 auto", padding: 12 };

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
  display: "grid",
  gap: 10,
};

const msg: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "#444", lineHeight: 1.35 };

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 16,
  background: "#fff",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const btnGhost: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
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