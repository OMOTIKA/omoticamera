"use client";

// UI_VER: HOST_ACCOUNT_UI_V2_20260218
// ✅ サーバー保存（nickname 1回制限 / avatar upload / newsOptIn）
// ✅ localStorage は hostSessionToken のみ使用

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";

type Profile = {
  accountId: string;
  email: string;
  nickname: string;
  nicknameLocked: boolean;
  newsOptIn: boolean;
  avatarUrl: string;
  updatedAt: number;
};

type ProfileGetResp =
  | { ok: true; marker: string; profile: Profile }
  | { ok: false; error: string };

type ProfileUpdateResp =
  | { ok: true; marker: string; profile: Profile }
  | { ok: false; error: string };

type AvatarUploadResp =
  | { ok: true; marker: string; avatarUrl: string; updatedAt: number }
  | { ok: false; error: string };

export default function HostAccountPage() {
  const UI_VER = "HOST_ACCOUNT_UI_V2_20260218";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);

  // 編集用 state
  const [nickname, setNickname] = useState("");
  const [newsOptIn, setNewsOptIn] = useState(true);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
  }, []);

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      if (!token) {
        router.replace("/host/login");
        return;
      }

      const url = `${API_BASE}/host_profile_get.php?hostSessionToken=${encodeURIComponent(token)}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as ProfileGetResp;

      if (!j.ok) throw new Error(j.error || "profile_get_failed");

      setProfile(j.profile);
      setNickname(j.profile.nickname || "");
      setNewsOptIn(!!j.profile.newsOptIn);
    } catch (e: any) {
      setErr(`読み込み失敗：${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const canEditNickname = useMemo(() => {
    if (!profile) return true;
    return !profile.nicknameLocked;
  }, [profile]);

  const saveProfile = async () => {
    if (!token) return;
    if (!profile) return;

    setErr("");
    setSaving(true);
    try {
      const qs = new URLSearchParams({
        hostSessionToken: token,
        nickname: (nickname || "").trim(),
        newsOptIn: newsOptIn ? "1" : "0",
      });

      const url = `${API_BASE}/host_profile_update.php?${qs.toString()}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as ProfileUpdateResp;

      if (!j.ok) {
        if (j.error === "nickname_locked") {
          throw new Error("ニックネームは1回だけ変更できます。すでに設定済みのため変更できません。");
        }
        throw new Error(j.error || "profile_update_failed");
      }

      setProfile(j.profile);
      setNickname(j.profile.nickname || "");
      setNewsOptIn(!!j.profile.newsOptIn);

      alert("保存しました");
      router.push("/host/home");
    } catch (e: any) {
      setErr(`保存失敗：${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async (file: File | null) => {
    if (!file || !token) return;

    setErr("");
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append("hostSessionToken", token);
      fd.append("avatar", file);

      const r = await fetch(`${API_BASE}/host_avatar_upload.php`, {
        method: "POST",
        body: fd,
        cache: "no-store",
      });

      const j = (await r.json()) as AvatarUploadResp;
      if (!j.ok) throw new Error(j.error || "avatar_upload_failed");

      // 画面上の即時反映
      setProfile((p) =>
        p
          ? {
              ...p,
              avatarUrl: j.avatarUrl,
              updatedAt: j.updatedAt,
            }
          : p
      );

      alert("アバターを更新しました");
    } catch (e: any) {
      setErr(`アバター更新失敗：${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={wrap}>
        <header style={topBar}>
          <div style={topInner}>
            <button onClick={() => router.back()} style={btnGhostSmall}>
              ←
            </button>
            <div style={topTitle}>アカウント設定</div>
            <div style={{ width: 44 }} />
          </div>
        </header>

        <div style={body}>
          <div style={softInfo}>読み込み中…</div>
          <Footer uiVer={UI_VER} showSupporters={false} />
        </div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <header style={topBar}>
        <div style={topInner}>
          <button onClick={() => router.back()} style={btnGhostSmall}>
            ←
          </button>
          <div style={topTitle}>アカウント設定</div>
          <div style={{ width: 44 }} />
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

        {/* メール */}
        <section style={card}>
          <div style={label}>メールアドレス</div>
          <div style={value}>{profile?.email || "-"}</div>
        </section>

        {/* ニックネーム */}
        <section style={{ ...card, marginTop: 10 }}>
          <div style={rowBetween}>
            <div style={label}>ニックネーム（1回だけ変更可）</div>
            {profile?.nicknameLocked && <span style={pillLocked}>LOCK</span>}
          </div>

          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例：オモチカ"
            style={{ ...input, opacity: canEditNickname ? 1 : 0.7 }}
            disabled={!canEditNickname || saving}
          />

          {!canEditNickname && (
            <div style={miniNote}>※ すでに設定済みのため、変更できません（表示はできます）。</div>
          )}
        </section>

        {/* アバター */}
        <section style={{ ...card, marginTop: 10 }}>
          <div style={label}>アカウントのアバター</div>

          <div style={avatarRow}>
            <div style={avatarWrap}>
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="avatar" style={avatarImg} />
              ) : (
                <div style={avatarPlaceholder}>No</div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickAvatar(e.target.files?.[0] || null)}
                style={{ width: "100%" }}
                disabled={saving}
              />
              <div style={miniNote}>※ 2MBまで / 自動で512pxに最適化して保存します</div>
            </div>
          </div>
        </section>

        {/* お知らせ */}
        <section style={{ ...card, marginTop: 10 }}>
          <div style={label}>お知らせ</div>

          <label style={toggleRow}>
            <input
              type="checkbox"
              checked={newsOptIn}
              onChange={(e) => setNewsOptIn(e.target.checked)}
              disabled={saving}
            />
            アプリ/メールのお知らせを受け取る（将来CMS配信と連動）
          </label>
        </section>

        <button
          onClick={saveProfile}
          disabled={saving}
          style={{ ...btnPrimary, marginTop: 12, opacity: saving ? 0.7 : 1 }}
        >
          保存して戻る
        </button>

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
  fontFamily: "system-ui",
};

const topBar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: 10,
};

const topInner: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 8,
};

const topTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  textAlign: "center",
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
  fontSize: 12,
  fontWeight: 900,
  color: "#444",
  marginBottom: 6,
};

const value: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#111",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 14,
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const btnGhostSmall: React.CSSProperties = {
  justifySelf: "start",
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const avatarRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const avatarWrap: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 999,
  overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  flex: "0 0 auto",
};

const avatarImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const avatarPlaceholder: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  color: "#777",
};

const toggleRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  fontWeight: 900,
  fontSize: 13,
  color: "#222",
};

const miniNote: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: "#777",
  fontWeight: 800,
  lineHeight: 1.35,
};

const rowBetween: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const pillLocked: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  color: "#666",
};

const errBox: React.CSSProperties = {
  marginBottom: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(176,0,32,0.22)",
  background: "rgba(176,0,32,0.06)",
  color: "#b00020",
  fontSize: 12,
  fontWeight: 900,
};

const softInfo: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fafafa",
  padding: 10,
  color: "#444",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.45,
};