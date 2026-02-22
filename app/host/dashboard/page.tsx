"use client";

// UI_VER: HOST_DASHBOARD_UI_V3_20260213

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP").format(n);
}

function fmtDateTime(ms: number) {
  if (!ms) return "-";
  try {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${dd} ${hh}:${mm}`;
  } catch {
    return "-";
  }
}

export default function HostDashboardPage() {
  const UI_VER = "HOST_DASHBOARD_UI_V3_20260213";
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [planId, setPlanId] = useState("");
  const [planLabel, setPlanLabel] = useState("");
  const [priceYen, setPriceYen] = useState(0);
  const [maxGuests, setMaxGuests] = useState(0);
  const [maxShotsGuest, setMaxShotsGuest] = useState(20);
  const [startAt, setStartAt] = useState(0);
  const [endAt, setEndAt] = useState(0);

  useEffect(() => {
    const hostSession = (localStorage.getItem("omoticamera_hostSessionToken") || "").trim();
    const hostKey = (localStorage.getItem("omoticamera_hostKey") || "").trim();
    const eid = (localStorage.getItem("omoticamera_eventId") || "").trim();

    if (!hostSession || !hostKey || !eid) {
      router.replace("/host/login");
      return;
    }

    localStorage.setItem("omoticamera_role", "host");

    setEventId(eid);
    setEventName((localStorage.getItem("omoticamera_eventName") || "").trim());

    const pid = (localStorage.getItem("omoticamera_planId") || "").trim();
    setPlanId(pid);
    setPlanLabel((localStorage.getItem("omoticamera_planLabel") || "").trim());
    setPriceYen(Number(localStorage.getItem("omoticamera_planPriceYen") || "0") || 0);
    setMaxGuests(Number(localStorage.getItem("omoticamera_maxGuests") || "0") || 0);
    setMaxShotsGuest(Number(localStorage.getItem("omoticamera_maxShotsGuest") || "20") || 20);

    setStartAt(Number(localStorage.getItem("omoticamera_eventStart") || "0") || 0);
    setEndAt(Number(localStorage.getItem("omoticamera_eventEnd") || "0") || 0);

    setReady(true);
  }, [router]);

  const planText = useMemo(() => {
    const name = planLabel || planId || "-";
    const price = priceYen === 0 ? "無料" : `¥${yen(priceYen)}`;
    const mg = maxGuests ? `${maxGuests}` : "-";
    const ms = maxShotsGuest ? `${maxShotsGuest}` : "20";
    return `${name} / ${price}（参加枠:${mg}・撮影上限:${ms}）`;
  }, [planId, planLabel, priceYen, maxGuests, maxShotsGuest]);

  const logout = () => {
    const ok = confirm("ログアウトしますか？");
    if (!ok) return;

    // ✅ セキュリティ優先：セッショントークン＆鍵を消す
    localStorage.removeItem("omoticamera_hostSessionToken");
    localStorage.removeItem("omoticamera_hostKey");
    localStorage.removeItem("omoticamera_role");

    // イベントID等も“ホスト情報”なので消す（端末に残さない）
    localStorage.removeItem("omoticamera_eventId");
    localStorage.removeItem("omoticamera_eventName");
    localStorage.removeItem("omoticamera_eventStart");
    localStorage.removeItem("omoticamera_eventEnd");
    localStorage.removeItem("omoticamera_planId");
    localStorage.removeItem("omoticamera_planLabel");
    localStorage.removeItem("omoticamera_planPriceYen");
    localStorage.removeItem("omoticamera_maxGuests");
    localStorage.removeItem("omoticamera_maxShotsGuest");

    router.replace("/host/login");
  };

  const resetLocal = () => {
    const ok = confirm("保存されたホスト情報（イベント/キー）を端末から削除します。\nよろしいですか？");
    if (!ok) return;

    localStorage.removeItem("omoticamera_hostKey");
    localStorage.removeItem("omoticamera_eventId");
    localStorage.removeItem("omoticamera_eventName");
    localStorage.removeItem("omoticamera_eventStart");
    localStorage.removeItem("omoticamera_eventEnd");

    localStorage.removeItem("omoticamera_planId");
    localStorage.removeItem("omoticamera_planLabel");
    localStorage.removeItem("omoticamera_planPriceYen");
    localStorage.removeItem("omoticamera_maxGuests");
    localStorage.removeItem("omoticamera_maxShotsGuest");

    alert("削除しました。ログイン画面へ戻ります。");
    router.replace("/host/login");
  };

  if (!ready) return null;

  return (
    <main style={wrap}>
      {/* ✅ 固定ヘッダー（左：戻る／右：ログアウト） */}
      <div style={stickyTop}>
        <div style={topInner}>
          <button onClick={() => router.push("/host/home")} style={btnBack}>
            ← 戻る
          </button>

          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={title}>ホスト管理</div>
            <div style={subLine}>
              <span style={{ fontWeight: 900 }}>イベント：</span>
              <span style={{ fontWeight: 900, color: "#111" }}>
                {eventName || "（イベント名 未設定）"}
              </span>
            </div>
          </div>

          <button onClick={logout} style={btnLogout}>
            ログアウト
          </button>
        </div>
      </div>

      <div style={body}>
        {/* 情報カード */}
        <section style={cardThin}>
          <div style={rowBetween}>
            <div style={{ minWidth: 0 }}>
              <div style={miniLabel}>イベントID</div>
              <div style={mono}>{eventId}</div>
            </div>

            <button onClick={() => navigator.clipboard?.writeText(eventId)} style={btnGhostSmall}>
              コピー
            </button>
          </div>

          <div style={{ height: 8 }} />

          <div style={miniLabel}>プラン</div>
          <div style={planLine}>{planText}</div>

          <div style={{ height: 8 }} />

          <div style={row2}>
            <div>
              <div style={miniLabel}>開始</div>
              <div style={tinyVal}>{fmtDateTime(startAt)}</div>
            </div>
            <div>
              <div style={miniLabel}>終了</div>
              <div style={tinyVal}>{fmtDateTime(endAt)}</div>
            </div>
          </div>
        </section>

        {/* アクション */}
        <section style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <button onClick={() => router.push("/host/qr")} style={btnPrimary}>
            QR（参加用）
          </button>

          <button onClick={() => router.push("/camera")} style={btnGhost}>
            撮影（ホスト）
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => router.push("/host/guests")} style={btnGhost}>
              参加者一覧
            </button>
            <button onClick={() => router.push("/host/photos")} style={btnGhost}>
              写真管理
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => router.push("/host/plans")} style={btnGhost}>
              プランを見る
            </button>
            <button onClick={() => router.push("/host/create")} style={btnGhost}>
              新規イベント
            </button>
          </div>

          <button onClick={resetLocal} style={btnDanger}>
            この端末のホスト情報を削除
          </button>

          <div style={miniNote}>
            ※ 端末を変えたときだけ eventId / hostKey の入力が必要です。
          </div>
        </section>

        <div style={uiVer}>UI_VER: {UI_VER}</div>
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

const topInner: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "92px 1fr 92px",
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
};

const btnLogout: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const title: React.CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };

const subLine: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#666",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const body: React.CSSProperties = { maxWidth: 520, margin: "0 auto", padding: 10 };

const cardThin: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const rowBetween: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };

const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

const miniLabel: React.CSSProperties = { fontSize: 11, color: "#666", fontWeight: 900, marginBottom: 4 };

const mono: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#111",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  wordBreak: "break-all",
  lineHeight: 1.25,
};

const planLine: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#111", lineHeight: 1.25 };

const tinyVal: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#111" };

const miniNote: React.CSSProperties = { fontSize: 11, color: "#777", lineHeight: 1.35, marginTop: 2 };

const btnPrimary: React.CSSProperties = { padding: "12px 12px", borderRadius: 12, border: 0, background: "#111", color: "#fff", fontWeight: 900, fontSize: 14 };

const btnGhost: React.CSSProperties = { padding: "12px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", fontWeight: 900, fontSize: 14 };

const btnDanger: React.CSSProperties = { padding: "12px 12px", borderRadius: 12, border: 0, background: "#ff3b30", color: "#fff", fontWeight: 900, fontSize: 14 };

const btnGhostSmall: React.CSSProperties = { padding: "9px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" };

const uiVer: React.CSSProperties = { marginTop: 10, fontSize: 10, color: "#aaa", textAlign: "center" };