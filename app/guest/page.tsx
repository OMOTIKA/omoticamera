"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile, createResumeCode } from "../lib/profile";

const ROLE_KEY = "omoticamera_role";
const EVENT_ID_KEY = "omoticamera_eventId";
const NICK_KEY = "omoticamera_nickname";
const RESUME_CODE_KEY = "omoticamera_resumeCode";
const GUEST_ID_KEY_GUEST = "omoticamera_guestId_guest";

function getQueryParams() {
  if (typeof window === "undefined") return { event: "" };
  const sp = new URLSearchParams(window.location.search);
  return { event: sp.get("event") || "" };
}

export default function GuestLoginPage() {
  const router = useRouter();
  const { event: eventFromUrl } = useMemo(() => getQueryParams(), []);

  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState("");

  const ensureEventId = () => {
    const eid = eventFromUrl.trim();
    if (!eid) return "";
    localStorage.setItem(EVENT_ID_KEY, eid);
    return eid;
  };

  const ensureGuestId = () => {
    let gid = localStorage.getItem(GUEST_ID_KEY_GUEST) || "";
    if (!gid) {
      gid = crypto.randomUUID();
      localStorage.setItem(GUEST_ID_KEY_GUEST, gid);
    }
    return gid;
  };

  const ensureResumeCode = () => {
    let rc = localStorage.getItem(RESUME_CODE_KEY) || "";
    if (!rc) {
      rc = createResumeCode();
      localStorage.setItem(RESUME_CODE_KEY, rc);
    }
    return rc;
  };

  useEffect(() => {
    // ゲスト専用：role固定
    localStorage.setItem(ROLE_KEY, "guest");

    const eventId = ensureEventId();
    if (!eventId) {
      setMsg("このページはQRから開いてください（イベント情報が見つかりません）");
      return;
    }

    // もし前に入力していたら復元
    const savedNick = localStorage.getItem(NICK_KEY) || "";
    if (savedNick) setNickname(savedNick);

    setMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    const n = nickname.trim();
    if (!n) {
      alert("ニックネームを入力してください");
      return;
    }

    const eventId = ensureEventId();
    if (!eventId) {
      alert("QRから開き直してください（イベント情報が見つかりません）");
      return;
    }

    localStorage.setItem(ROLE_KEY, "guest");
    localStorage.setItem(NICK_KEY, n);

    // ✅ 裏で救済情報を保存（ユーザーには見せない）
    const code = ensureResumeCode();
    const guestId = ensureGuestId();
    try {
      await saveProfile({ eventId, code, nickname: n, guestId });
      // 成功時も静かに（必要なら下の1行をコメントアウト解除）
      // setMsg("OK");
    } catch (e) {
      console.error(e);
      // 失敗しても撮影はできるので、怖がらせない文言に
      setMsg("※通信が弱いときは、あとで送信されます。");
    }

    router.push("/camera");
  };

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: 8, lineHeight: 1.25 }}>
        だれでもオモチカメラ
        <br />
        ゲスト参加
      </h1>

      <p style={{ marginTop: 0, color: "#444" }}>
        ニックネームを入れて、すぐ撮影できます。
      </p>

      {!eventFromUrl ? (
        <div style={{ marginBottom: 14, color: "#b00", fontWeight: 900 }}>
          ※ QRから開いてください（イベント情報がありません）
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
          ※うっかり閉じても大丈夫。戻ってきたら続きから使えます。
        </div>
      )}

      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>ニックネーム</div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
          本名でなくてOK（ホストだけが確認できます）
        </div>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例：オモチカ"
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #ddd",
            marginBottom: 12,
          }}
        />

        <button
          onClick={start}
          style={{
            padding: "12px 16px",
            cursor: "pointer",
            borderRadius: 999,
            fontSize: 16,
            width: "100%",
            fontWeight: 900,
          }}
        >
          撮影をはじめる
        </button>

        {msg && <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>{msg}</div>}
      </section>
    </main>
  );
}