"use client";

// UI_VER: CMS_EVENTS_UI_V1_20260209

import { useEffect, useState } from "react";

type EventRow = {
  eventId: string;
  eventName: string;
  planId: string;
  hostLabel: string;
  maxGuests: number;
  activeGuests: number;
  totalGuests: number;
  startAt: number;
  endAt: number;
  ended: boolean;
  storageDays: number;
  bytes: number;
};

type ApiResp = {
  ok: boolean;
  events: EventRow[];
  storage: {
    ratio: number;
    warn80: boolean;
    stop90: boolean;
  };
};

const API =
  "https://omotika.zombie.jp/omoticamera-api/cms/dashboard.php";

export default function CmsEventsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<EventRow[]>([]);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    fetch(API + "?ping=0")
      .then((r) => r.json())
      .then((j: ApiResp) => {
        if (!j.ok) throw new Error();
        const sorted = [...j.events].sort(
          (a, b) => (b.startAt || 0) - (a.startAt || 0)
        );
        setRows(sorted);
        setRatio(j.storage?.ratio || 0);
      })
      .catch(() => setErr("取得エラー"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Wrap>読み込み中…</Wrap>;
  if (err) return <Wrap>{err}</Wrap>;

  return (
    <Wrap>
      <Header ratio={ratio} />

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th>イベント</th>
              <th>ホスト</th>
              <th>プラン</th>
              <th>参加</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.eventId}>
                <td>
                  <div style={name}>{e.eventName || "（無名）"}</div>
                  <div style={sub}>{e.eventId}</div>
                </td>

                <td>{e.hostLabel || "-"}</td>

                <td>{e.planId || "-"}</td>

                <td>
                  {e.activeGuests}/{e.maxGuests}
                </td>

                <td>
                  {e.ended ? (
                    <span style={pillEnded}>終了</span>
                  ) : (
                    <span style={pillActive}>開催中</span>
                  )}
                </td>

                <td>
                  <button style={miniBtn}>詳細</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={uiVer}>UI_VER: CMS_EVENTS_UI_V1_20260209</div>
    </Wrap>
  );
}

/* ---------------- styles ---------------- */

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
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

function Header({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  return (
    <div style={card}>
      <div style={{ fontWeight: 900, fontSize: 20 }}>
        どこでもオモチカメラ CMS
      </div>

      <div style={{ marginTop: 8 }}>
        ストレージ使用率：{pct}%
        <div style={barBg}>
          <div style={{ ...bar, width: pct + "%" }} />
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};

const tableWrap: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const name: React.CSSProperties = {
  fontWeight: 800,
};

const sub: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
};

const pillActive: React.CSSProperties = {
  background: "#111",
  color: "#fff",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 800,
};

const pillEnded: React.CSSProperties = {
  background: "#ddd",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 800,
};

const miniBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 700,
};

const barBg: React.CSSProperties = {
  height: 8,
  background: "#eee",
  borderRadius: 999,
  marginTop: 6,
};

const bar: React.CSSProperties = {
  height: 8,
  background: "#111",
  borderRadius: 999,
};

const uiVer: React.CSSProperties = {
  marginTop: 12,
  fontSize: 11,
  opacity: 0.5,
  textAlign: "center",
};