"use client";

// UI_VER: HOST_CREATE_UI_V7_20260219

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

function uuidv4() {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    const s = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return s.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const b = new Uint8Array(16);
  cryptoObj.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const LS_KEY_HOST_SESSION = "omoticamera_hostSessionToken";

const yen = (n: number) => new Intl.NumberFormat("ja-JP").format(n);

const PLANS = [
  { planId: "starter", label: "スターター", priceYen: 0, maxGuests: 10 },
  { planId: "basic", label: "ベーシック", priceYen: 2000, maxGuests: 25 },
  { planId: "premium", label: "プレミアム", priceYen: 8000, maxGuests: 100 },
  { planId: "elite", label: "エリート", priceYen: 20000, maxGuests: 250 },
  { planId: "business", label: "ビジネス", priceYen: 65000, maxGuests: 500 },
] as const;

type EventItem = {
  eventId: string;
  eventName: string;
  planId?: string;
  startAt?: number;
  endAt?: number;
  maxGuests?: number;
};

function isRunning(e: EventItem) {
  const now = Date.now();
  const s = Number(e.startAt || 0);
  const ed = Number(e.endAt || 0);
  return !!s && !!ed && s <= now && now < ed;
}

function isUpcoming(e: EventItem) {
  const now = Date.now();
  const s = Number(e.startAt || 0);
  const ed = Number(e.endAt || 0);
  // 予約中：開始が未来、かつ終了も未来（雑に壊れにくく）
  return !!s && !!ed && now < s && now < ed;
}

function isBlocking(e: EventItem) {
  return isRunning(e) || isUpcoming(e);
}

function parseMsFromDatetimeLocal(v: string) {
  // datetime-local はローカルタイム扱いで Date が解釈する
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export default function HostCreatePage() {
  const UI_VER = "HOST_CREATE_UI_V7_20260219";
  const router = useRouter();

  const [eventName, setEventName] = useState("");
  const [planId, setPlanId] = useState<(typeof PLANS)[number]["planId"]>("starter");

  const [useNow, setUseNow] = useState(true);
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState(""); // datetime-local

  const [campaign, setCampaign] = useState(""); // ✅ サーバーへ保存する（localStorageには置かない）

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [loadingGate, setLoadingGate] = useState(true);
  const [blockingEvent, setBlockingEvent] = useState<EventItem | null>(null);

  const plan = useMemo(() => PLANS.find((p) => p.planId === planId)!, [planId]);

  // ---- gate: running/upcoming があればブロック ----
  useEffect(() => {
    localStorage.setItem("omoticamera_role", "host");

    const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
    if (!token) {
      router.replace("/host/login");
      return;
    }

    const gate = async () => {
      setLoadingGate(true);
      setErr("");
      try {
        const url = `${API_BASE}/host_list_events.php?hostSessionToken=${encodeURIComponent(token)}`;
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "list_events_failed");
        const list: EventItem[] = Array.isArray(j.events) ? j.events : [];
        const block = list.find(isBlocking) || null;
        setBlockingEvent(block);
      } catch (e: any) {
        setErr(`読み込み失敗：${String(e?.message || e)}`);
      } finally {
        setLoadingGate(false);
      }
    };

    void gate();
  }, [router]);

  // ---- validation ----
  const validationMsg = useMemo(() => {
    if (loadingGate) return "読み込み中です…";

    if (blockingEvent) {
      // 開催中 or 予約中
      const kind = isRunning(blockingEvent) ? "開催中" : "予約中";
      return `現在「${kind}」のイベントがあるため、新規イベントは作成できません。`;
    }

    const name = eventName.trim();
    if (!name) return "イベント名を入力してください。";

    // end 必須
    if (!endAt) return "終了日時を入力してください。";

    const now = Date.now();
    const endMs = parseMsFromDatetimeLocal(endAt);
    if (!Number.isFinite(endMs)) return "終了日時の形式が不正です。";
    if (endMs <= now) return "終了日時は「現在より未来」を選んでください。";

    // start は「今すぐ開始」の場合は now 扱い
    const startMs = useNow ? now : parseMsFromDatetimeLocal(startAt);
    if (!useNow) {
      if (!startAt) return "開始日時を入力してください（今すぐ開始をOFFの場合）。";
      if (!Number.isFinite(startMs)) return "開始日時の形式が不正です。";
    }

    // start < end
    if (Number.isFinite(startMs) && startMs >= endMs) return "日時が不正です（開始 < 終了 にしてください）。";

    return ""; // OK
  }, [loadingGate, blockingEvent, eventName, useNow, startAt, endAt]);

  const canSubmit = useMemo(() => {
    if (saving) return false;
    return validationMsg === "";
  }, [saving, validationMsg]);

  const createEvent = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setErr("");

    try {
      const token = (localStorage.getItem(LS_KEY_HOST_SESSION) || "").trim();
      if (!token) throw new Error("missing_hostSessionToken");

      // 念のため直前にも gate（running/upcoming）
      const gateUrl = `${API_BASE}/host_list_events.php?hostSessionToken=${encodeURIComponent(token)}`;
      const gateRes = await fetch(gateUrl, { cache: "no-store" });
      const gateJson = await gateRes.json();
      if (!gateJson?.ok) throw new Error(gateJson?.error || "list_events_failed");
      const list: EventItem[] = Array.isArray(gateJson.events) ? gateJson.events : [];
      const block = list.find(isBlocking) || null;
      if (block) {
        setBlockingEvent(block);
        const kind = isRunning(block) ? "開催中" : "予約中";
        throw new Error(`現在「${kind}」のイベントがあるため、新規イベントは作成できません。`);
      }

      const now = Date.now();
      const startMs = useNow ? now : parseMsFromDatetimeLocal(startAt);
      const endMs = parseMsFromDatetimeLocal(endAt);

      // 最終防衛（validationと同じ）
      if (!eventName.trim()) throw new Error("イベント名を入力してください。");
      if (!Number.isFinite(endMs) || endMs <= now) throw new Error("終了日時は「現在より未来」を選んでください。");
      if (!Number.isFinite(startMs)) throw new Error("開始日時の形式が不正です。");
      if (startMs >= endMs) throw new Error("日時が不正です（開始 < 終了 にしてください）。");

      const eventId = uuidv4();
      const hostKey = uuidv4();

      const qs = new URLSearchParams({
        hostSessionToken: token, // ✅ アカウント紐付け
        eventId,
        eventName: eventName.trim(),
        hostKey,

        planId: plan.planId,
        startAt: String(startMs),
        endAt: String(endMs),
        maxGuests: String(plan.maxGuests),

        maxPhotos: "200",
        storageDays: "15",
        roleCaps: JSON.stringify({ host: 30, guest: 20 }),

        // ✅ 本番想定：キャンペーンコードはサーバーへ（CMS運用前提）
        campaign: campaign.trim(),
      });

      const r = await fetch(`${API_BASE}/set_event.php?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "set_event_failed");

      // 端末側の“現在イベント”は既存互換としてセット（キャンペーンは保存しない）
      localStorage.setItem("omoticamera_eventId", eventId);
      localStorage.setItem("omoticamera_eventName", eventName.trim());
      localStorage.setItem("omoticamera_hostKey", hostKey);

      localStorage.setItem("omoticamera_planId", plan.planId);
      localStorage.setItem("omoticamera_planLabel", plan.label);
      localStorage.setItem("omoticamera_planPriceYen", String(plan.priceYen));
      localStorage.setItem("omoticamera_maxGuests", String(plan.maxGuests));

      localStorage.setItem("omoticamera_eventStart", String(startMs));
      localStorage.setItem("omoticamera_eventEnd", String(endMs));

      router.push("/host/qr");
    } catch (e: any) {
      setErr(`作成失敗：${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  const goBlockingEvent = () => {
    if (!blockingEvent) return;
    localStorage.setItem("omoticamera_eventId", blockingEvent.eventId);
    localStorage.setItem("omoticamera_eventName", blockingEvent.eventName || "");
    if (blockingEvent.startAt) localStorage.setItem("omoticamera_eventStart", String(blockingEvent.startAt));
    if (blockingEvent.endAt) localStorage.setItem("omoticamera_eventEnd", String(blockingEvent.endAt));
    if (blockingEvent.planId) localStorage.setItem("omoticamera_planId", String(blockingEvent.planId));
    if (typeof blockingEvent.maxGuests === "number") localStorage.setItem("omoticamera_maxGuests", String(blockingEvent.maxGuests));
    router.push("/host/event");
  };

  return (
    <main style={wrap}>
      <header style={stickyTop}>
        <div style={topBar}>
          <button onClick={() => router.back()} style={backBtn} aria-label="戻る">
            ←
          </button>
          <div style={title}>新規イベント作成</div>
          <div style={{ width: 32 }} />
        </div>
      </header>

      <div style={body}>
        {blockingEvent && (
          <div style={softInfo}>
            {isRunning(blockingEvent) ? (
              <>現在「開催中」のイベントがあるため、新規イベント作成はできません。<br />イベント終了後に作成できます。</>
            ) : (
              <>現在「予約中（未来開始）」のイベントがあるため、新規イベント作成はできません。<br />そのイベントが終了してから作成できます。</>
            )}
            <div style={{ marginTop: 8 }}>
              <button onClick={goBlockingEvent} style={btnGhost}>
                既存イベントを開く
              </button>
            </div>
          </div>
        )}

        <section style={card}>
          <div style={label}>イベント名</div>
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="例：運動会2026"
            style={input}
            disabled={!!blockingEvent}
          />
        </section>

        <section style={{ ...card, marginTop: 8 }}>
          <div style={label}>プラン</div>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value as any)}
            style={input}
            disabled={!!blockingEvent}
          >
            {PLANS.map((p) => (
              <option key={p.planId} value={p.planId}>
                {p.label}（{p.maxGuests}名 / ¥{yen(p.priceYen)}）
              </option>
            ))}
          </select>

          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="キャンペーンコード（任意・サーバー保存）"
            style={{ ...input, marginTop: 8 }}
            disabled={!!blockingEvent}
          />
        </section>

        <section style={{ ...card, marginTop: 8 }}>
          <label style={checkRow}>
            <input
              type="checkbox"
              checked={useNow}
              onChange={(e) => setUseNow(e.target.checked)}
              disabled={!!blockingEvent}
            />
            今すぐ開始
          </label>

          {!useNow && (
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              style={{ ...input, marginTop: 8 }}
              disabled={!!blockingEvent}
            />
          )}
        </section>

        <section style={{ ...card, marginTop: 8 }}>
          <div style={label}>終了日時</div>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            style={input}
            disabled={!!blockingEvent}
          />
        </section>

        {/* ✅ バリデーションメッセージ（エラーとは分離：未入力の案内もここ） */}
        {validationMsg && !err && <div style={hintBox}>{validationMsg}</div>}
        {err && <div style={errBox}>{err}</div>}

        <button
          onClick={createEvent}
          disabled={!canSubmit}
          style={{ ...btnPrimary, marginTop: 10, opacity: canSubmit ? 1 : 0.5 }}
        >
          {useNow ? "イベントを開始する" : "イベントを作成する"}
        </button>

        <Footer uiVer={UI_VER} showSupporters={false} />
      </div>
    </main>
  );
}

/* styles */

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#fff", fontFamily: "system-ui" };
const stickyTop: React.CSSProperties = { position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #eee" };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, maxWidth: 520, margin: "0 auto" };
const title: React.CSSProperties = { fontSize: 16, fontWeight: 900, textAlign: "center" };
const backBtn: React.CSSProperties = { fontSize: 16, fontWeight: 900, background: "none", border: 0 };

const body: React.CSSProperties = { maxWidth: 520, margin: "0 auto", padding: 10 };
const card: React.CSSProperties = { border: "1px solid #eee", borderRadius: 12, padding: 10, background: "#fafafa" };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 900, color: "#666", marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14 };

const btnPrimary: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 12, background: "#111", color: "#fff", border: 0, fontWeight: 900 };
const btnGhost: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 12, background: "#fff", color: "#111", border: "1px solid rgba(0,0,0,0.12)", fontWeight: 900 };

const checkRow: React.CSSProperties = { display: "flex", gap: 8, fontWeight: 900, fontSize: 13 };

const errBox: React.CSSProperties = { marginTop: 8, padding: 8, borderRadius: 10, background: "#ffecec", color: "#b00020", fontSize: 12, fontWeight: 900 };
const hintBox: React.CSSProperties = { marginTop: 8, padding: 8, borderRadius: 10, background: "#f4f4f4", color: "#444", fontSize: 12, fontWeight: 900 };

const softInfo: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fafafa",
  padding: 10,
  marginBottom: 10,
  color: "#444",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.45,
};