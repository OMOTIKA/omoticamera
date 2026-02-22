"use client";

// UI_VER: CMS_EVENT_DETAIL_UI_V2_20260209

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_DASH =
  "https://omotika.zombie.jp/omoticamera-api/cms/dashboard.php";

const API_PAUSE =
  "https://omotika.zombie.jp/omoticamera-api/cms/event_pause.php";

export default function CmsEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();

  const [row, setRow] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setErr("");
    try {
      const r = await fetch(`${API_DASH}?v=${Date.now()}`, { cache: "no-store" });
      const j = await r.json();
      const found = j.events.find((e: any) => e.eventId === eventId);
      if (!found) throw new Error("not_found");
      setRow(found);
    } catch {
      setErr("イベント取得失敗");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const doPause = async (action: "pause" | "resume") => {
    setMsg("");
    setBusy(true);
    try {
      const key = localStorage.getItem("omoticamera_cmsKey") || ""; // 暫定
      const reason =
        action === "pause" ? "運営側で一時停止" : "";

      const fd = new FormData();
      fd.append("eventId", eventId);
      fd.append("action", action);
      fd.append("reason", reason);
      if (key) fd.append("key", key);

      const r = await fetch(`${API_PAUSE}?v=${Date.now()}`, {
        method: "POST",
        body: fd,
        cache: "no-store",
      });
      const j = await r.json();
      if (!j?.ok) {
        setMsg("失敗：" + (j?.error || "api_error"));
        return;
      }
      setMsg(action === "pause" ? "停止しました" : "再開しました");
      await load();
    } catch {
      setMsg("通信エラー");
    } finally {
      setBusy(false);
    }
  };

  if (err) return <Wrap>{err}</Wrap>;
  if (!row) return <Wrap>読み込み中…</Wrap>;

  return (
    <Wrap>
      <div style={card}>
        <div style={title}>{row.eventName || "（無名イベント）"}</div>
        <div style={sub}>{row.eventId}</div>

        <Info label="プラン" value={row.planId || "-"} />
        <Info label="ホスト" value={row.hostLabel || "-"} />
        <Info label="参加状況" value={`${row.activeGuests}/${row.maxGuests}`} />
        <Info label="状態" value={row.ended ? "終了" : "開催中"} />
        <Info label="保存日数" value={`${row.storageDays}日`} />
        <Info label="使用容量" value={formatMB(row.bytes)} />

        {msg && <div style={toast}>{msg}</div>}
      </div>

      <div style={card}>
        <div style={sectionTitle}>制御</div>

        <div style={btnGrid}>
          <button
            style={dangerBtn}
            disabled={busy}
            onClick={() => doPause("pause")}
          >
            ⏸ イベント停止
          </button>

          <button
            style={ghostBtn}
            disabled={busy}
            onClick={() => doPause("resume")}
          >
            ▶ 再開
          </button>
        </div>

        <div style={hint}>
          ※停止は「削除」ではありません。撮影/参加/アップロードを止めるための運営スイッチです。
        </div>
      </div>

      <button onClick={() => router.back()} style={backBtn}>
        ← 戻る
      </button>

      <div style={uiVer}>UI_VER: CMS_EVENT_DETAIL_UI_V2_20260209</div>
    </Wrap>
  );
}

function Info({ label, value }: any) {
  return (
    <div style={infoRow}>
      <div style={infoLabel}>{label}</div>
      <div style={infoVal}>{value}</div>
    </div>
  );
}

function Wrap({ children }: any) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: 12,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};

const title: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
};

const sub: React.CSSProperties = {
  fontSize: 12,
  color: "#777",
  marginTop: 4,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const infoRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 0",
  borderBottom: "1px solid #eee",
};

const infoLabel: React.CSSProperties = {
  fontWeight: 700,
};

const infoVal: React.CSSProperties = {
  opacity: 0.8,
};

const btnGrid: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const ghostBtn: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 800,
};

const dangerBtn: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: 0,
  background: "#b00020",
  color: "#fff",
  fontWeight: 900,
};

const backBtn: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 800,
};

const hint: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginTop: 10,
  lineHeight: 1.4,
};

const toast: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
  textAlign: "center",
};

const uiVer: React.CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  opacity: 0.5,
  marginTop: 10,
};

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}