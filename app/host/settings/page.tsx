"use client";

// UI_VER: HOST_SETTINGS_UI_V1_20260213

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

type Phase = "reserved" | "live" | "ended_viewable" | "expired";

function fmtDateTime(ms?: number) {
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

function phaseLabel(p: Phase) {
  if (p === "reserved") return "予約中";
  if (p === "live") return "LIVE";
  if (p === "ended_viewable") return "閲覧可能（15日以内）";
  return "閲覧不可";
}

function calcPhase(startAt: number, endAt: number, storageDays = 15): Phase {
  const now = Date.now();
  const s = startAt || 0;
  const e = endAt || 0;

  if (!s || !e) return "reserved";
  if (now < s) return "reserved";
  if (s <= now && now < e) return "live";

  const viewLimit = e + storageDays * 24 * 60 * 60 * 1000;
  if (e <= now && now < viewLimit) return "ended_viewable";
  return "expired";
}

function toLocalInput(ms?: number) {
  if (!ms) return "";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function parseLocalInput(v: string) {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function HostSettingsPage() {
  const UI_VER = "HOST_SETTINGS_UI_V1_20260213";
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  const [eventId, setEventId] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [eventName, setEventName] = useState("");

  const [startAt, setStartAt] = useState<number>(0);
  const [endAt, setEndAt] = useState<number>(0);
  const [maxGuests, setMaxGuests] = useState<number>(0);

  // 編集フォーム
  const [nameInput, setNameInput] = useState("");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const [busy, setBusy] = useState(false);

  // 仕様固定
  const storageDays = 15;

  // 表示のためにtick（状態計算）
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const phase: Phase = useMemo(
    () => calcPhase(startAt, endAt, storageDays),
    // nowTickは phase判定に必要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startAt, endAt, storageDays, nowTick]
  );

  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");

    // ✅ hostSessionToken がないならログインへ
    const token = (localStorage.getItem("omoticamera_hostSessionToken") || "").trim();
    if (!token) {
      router.replace("/host/login");
      return;
    }

    // ✅ 選択中イベントがないなら /host/home へ
    const eid = (localStorage.getItem("omoticamera_eventId") || "").trim();
    const hk = (localStorage.getItem("omoticamera_hostKey") || "").trim();
    if (!eid || !hk) {
      router.replace("/host/home");
      return;
    }

    const en = (localStorage.getItem("omoticamera_eventName") || "").trim();
    const s = Number(localStorage.getItem("omoticamera_eventStart") || "0") || 0;
    const e = Number(localStorage.getItem("omoticamera_eventEnd") || "0") || 0;
    const mg = Number(localStorage.getItem("omoticamera_maxGuests") || "0") || 0;

    setEventId(eid);
    setHostKey(hk);
    setEventName(en);
    setStartAt(s);
    setEndAt(e);
    setMaxGuests(mg);

    setNameInput(en);
    setStartInput(toLocalInput(s));
    setEndInput(toLocalInput(e));

    setReady(true);
  }, [router]);

  // expiredならここも開けない（仕様）
  useEffect(() => {
    if (!ready) return;
    if (phase === "expired") {
      setErr("このイベントは閲覧可能期間（終了後15日）を過ぎたため、設定を開けません。イベント一覧へ戻ります。");
      const t = window.setTimeout(() => router.replace("/host/home"), 1200);
      return () => window.clearTimeout(t);
    }
  }, [ready, phase, router]);

  const canSave = useMemo(() => {
    if (!eventId || !hostKey) return false;
    const n = nameInput.trim();
    if (!n) return false;

    const endMs = parseLocalInput(endInput);
    if (!endMs) return false;

    // startは空でも可（予約扱い）だが、入れるなら妥当性を見る
    const startMs = startInput ? parseLocalInput(startInput) : 0;
    if (startInput && !startMs) return false;

    // startとendの整合
    if (startMs && endMs && startMs >= endMs) return false;

    return !busy;
  }, [eventId, hostKey, nameInput, startInput, endInput, busy]);

  const save = async () => {
    if (!canSave) return;

    const n = nameInput.trim();
    const startMs = startInput ? parseLocalInput(startInput) : 0;
    const endMs = parseLocalInput(endInput);

    const ok = confirm(
      "イベント設定を更新します。\n\n" +
        `イベント名：${n}\n` +
        `開始：${startMs ? fmtDateTime(startMs) : "未設定（予約扱い）"}\n` +
        `終了：${fmtDateTime(endMs)}\n\n` +
        "よろしいですか？"
    );
    if (!ok) return;

    setBusy(true);
    setErr("");

    try {
      // set_event.php に合わせる（既存の create/qr と同じ形）
      const qs = new URLSearchParams({
        eventId,
        eventName: n,
        hostKey,
        startAt: String(startMs || 0),
        endAt: String(endMs),
        maxGuests: String(maxGuests || 0),
        maxPhotos: "200",
        storageDays: String(storageDays),
        roleCaps: JSON.stringify({ host: 30, guest: 20 }),
        v: String(Date.now()),
      });

      const r = await fetch(`${API_BASE}/set_event.php?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json();

      if (!j?.ok) throw new Error(j?.error || "set_event_failed");

      // localStorage 同期（ホスト側UIの前提）
      localStorage.setItem("omoticamera_eventName", n);
      localStorage.setItem("omoticamera_eventStart", String(startMs || 0));
      localStorage.setItem("omoticamera_eventEnd", String(endMs));
      localStorage.setItem("omoticamera_maxGuests", String(maxGuests || 0));

      setEventName(n);
      setStartAt(startMs || 0);
      setEndAt(endMs);

      alert("更新しました。");
      router.replace("/host/event");
    } catch (e: any) {
      setErr(`更新に失敗：${String(e?.message || e || "failed")}`);
    } finally {
      setBusy(false);
    }
  };

  const resetToCurrent = () => {
    setErr("");
    setNameInput(eventName || "");
    setStartInput(toLocalInput(startAt));
    setEndInput(toLocalInput(endAt));
  };

  if (!ready) return null;

  return (
    <main style={wrap}>
      {/* ヘッダー：左上戻る／ログアウト無し（仕様） */}
      <header style={stickyTop}>
        <div style={topInner}>
          <button onClick={() => router.push("/host/event")} style={btnBack}>
            ← 戻る
          </button>

          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={brand}>どこでもオモチカメラ</div>
            <div style={title}>イベント設定</div>
          </div>

          <div style={{ width: 88 }} />
        </div>
      </header>

      <div style={body}>
        {err && <div style={errBox}>{err}</div>}

        {/* 現在状態 */}
        <section style={card}>
          <div style={rowBetween}>
            <div style={{ minWidth: 0 }}>
              <div style={miniLabel}>現在のイベント</div>
              <div style={eventNameStyle}>{eventName || "（イベント名 未設定）"}</div>
            </div>

            <span
              style={{
                ...pill,
                background: phase === "live" ? "#111" : "#f4f4f4",
                color: phase === "live" ? "#fff" : "#666",
              }}
            >
              {phaseLabel(phase)}
            </span>
          </div>

          <div style={metaLine}>
            <div>開始：{fmtDateTime(startAt)}</div>
            <div>終了：{fmtDateTime(endAt)}</div>
          </div>

          <div style={idLine}>eventId: {eventId}</div>
        </section>

        {/* 編集 */}
        <section style={{ ...card, marginTop: 10 }}>
          <div style={label}>編集</div>

          <div style={field}>
            <div style={miniLabel}>イベント名</div>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={input} placeholder="例：運動会2026" />
          </div>

          <div style={grid2}>
            <div style={field}>
              <div style={miniLabel}>開始日時（任意）</div>
              <input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} style={input} />
              <div style={hint}>
                ※ 空にすると「予約扱い（開始未設定）」になります
              </div>
            </div>

            <div style={field}>
              <div style={miniLabel}>終了日時（必須）</div>
              <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)} style={input} />
              {startInput && endInput && parseLocalInput(startInput) >= parseLocalInput(endInput) ? (
                <div style={hintErr}>※ 終了は開始より後にしてください</div>
              ) : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <button onClick={save} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}>
              {busy ? "更新中…" : "更新する"}
            </button>

            <button onClick={resetToCurrent} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>
              入力を元に戻す
            </button>
          </div>

          <div style={miniNote}>
            ※ イベント設定の反映はサーバ（set_event.php）へ保存されます。<br />
            ※ 「閲覧不可（終了後15日超）」のイベントは設定を開けません。
          </div>
        </section>

        {/* 一時停止（現時点は“UIのみ”） */}
        <section style={{ ...card, marginTop: 10 }}>
          <div style={label}>一時停止（準備中）</div>
          <div style={stateText}>
            ここは <b>サーバ側の pause 切替API</b> がまだ未実装のため、UIのみ配置しています。<br />
            （現状：upload.php / join.php は pause.json を読む処理は入っています）
          </div>
        </section>

        <Footer uiVer={UI_VER} showSupporters={false} />
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
  gridTemplateColumns: "88px 1fr 88px",
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

const brand: React.CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.1 };
const title: React.CSSProperties = { marginTop: 4, fontSize: 12, fontWeight: 900, color: "#666", lineHeight: 1.1 };

const body: React.CSSProperties = { maxWidth: 520, margin: "0 auto", padding: 10 };

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const rowBetween: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const eventNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.10)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const metaLine: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
  lineHeight: 1.35,
  display: "grid",
  gap: 2,
};

const idLine: React.CSSProperties = {
  marginTop: 8,
  fontSize: 10,
  color: "#999",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  wordBreak: "break-all",
};

const label: React.CSSProperties = { fontSize: 11, fontWeight: 900, color: "#666", marginBottom: 8 };

const field: React.CSSProperties = { display: "grid", gap: 6 };

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 10,
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
};

const btnGhost: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 14,
};

const hint: React.CSSProperties = { fontSize: 11, color: "#777", fontWeight: 800, lineHeight: 1.35 };
const hintErr: React.CSSProperties = { marginTop: 4, fontSize: 11, color: "#b00020", fontWeight: 900, lineHeight: 1.35 };

const miniLabel: React.CSSProperties = { fontSize: 11, color: "#666", fontWeight: 900 };

const miniNote: React.CSSProperties = {
  marginTop: 10,
  fontSize: 11,
  color: "#777",
  fontWeight: 800,
  lineHeight: 1.35,
};

const stateText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  padding: "10px 10px",
  background: "#fff",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  lineHeight: 1.4,
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

const uiVer: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  opacity: 0.35,
  textAlign: "center",
};