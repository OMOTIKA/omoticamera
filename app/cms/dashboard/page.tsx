"use client";

// UI_VER: CMS_DASHBOARD_UI_V3_SEARCH_SORT_20260210

import { useEffect, useMemo, useState } from "react";

type DashboardApi = {
  ok: boolean;
  marker?: string;
  uiVer?: string;
  storage?: {
    usedBytes: number;
    maxBytes: number;
    ratio: number;
    warn80: boolean;
    stop90: boolean;
  };
  killSwitch?: { enabled: boolean; message: string };
  notice?: { enabled: boolean; textJa: string; textEn: string };
  events?: {
    eventId: string;
    eventName: string;
    planId: string;
    hostLabel: string;
    maxGuests: number;
    activeGuests: number;
    totalGuests: number;
    startAt?: number;
    endAt: number;
    ended: boolean;
    paused?: boolean; // APIがまだ返してなくてもOK（UI側でfalse扱い）
    storageDays: number;
    bytes: number;
    metaPathExists?: string;
    guestsPathExists?: string;
  }[];
  eventsCount?: number;
};

function fmtBytes(n: number) {
  if (!n || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

type Filter = "all" | "running" | "paused" | "ended";
type SortKey = "created" | "bytes" | "active" | "total";
type SortDir = "desc" | "asc";

function isUuidLike(s: string) {
  return /^[a-f0-9-]{36}$/i.test(s);
}

export default function CmsDashboardPage() {
  const UI_VER = "CMS_DASHBOARD_UI_V3_SEARCH_SORT_20260210";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<DashboardApi | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("ただいまメンテナンス中です");
  const [toast, setToast] = useState("");

  const [filter, setFilter] = useState<Filter>("all");

  // ✅ 追加：検索
  const [q, setQ] = useState("");

  // ✅ 追加：並び替え
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // 削除確認モーダル
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEventId, setConfirmEventId] = useState("");
  const [confirmEventName, setConfirmEventName] = useState("");
  const [confirmMode, setConfirmMode] = useState<"trash" | "purge">("trash");

  const killOn = !!data?.killSwitch?.enabled;

  const ratioPct = useMemo(() => {
    const r = data?.storage?.ratio ?? 0;
    return Math.round(r * 1000) / 10;
  }, [data]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 1400);
  };

  const refresh = async () => {
    setErr("");
    try {
      const r = await fetch("/api/cms/dashboard", { cache: "no-store" });
      const j = (await r.json()) as any;
      if (!j?.ok) throw new Error(j?.error || "api_error");
      setData(j);
      setMessage(j.killSwitch?.message || "ただいまメンテナンス中です");
    } catch {
      setErr("通信エラー");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, []);

  // A’3) 両方まとめて止める（kill + 全event pause）
  const setGlobalStop = async (nextEnabled: boolean) => {
    if (busy) return;
    setBusy(true);
    setErr("");

    try {
      const k = await fetch("/api/cms/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          enabled: nextEnabled,
          message: nextEnabled ? message : "",
        }),
      });
      const kj = await k.json();
      if (!kj?.ok) throw new Error(kj?.error || "kill_failed");

      const p = await fetch("/api/cms/pause-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: nextEnabled ? "pause" : "resume",
          reason: message,
        }),
      });
      const pj = await p.json();
      if (!pj?.ok) throw new Error(pj?.error || "pause_all_failed");

      await refresh();
      showToast(nextEnabled ? "全停止をONにしました" : "全停止をOFFにしました");
    } catch (e: any) {
      setErr(`操作失敗：${String(e?.message || e || "unknown")}`);
    } finally {
      setBusy(false);
    }
  };

  // 削除（trash/purge）
  const openDeleteConfirm = (eventId: string, eventName: string, mode: "trash" | "purge") => {
    setConfirmEventId(eventId);
    setConfirmEventName(eventName || "(無題)");
    setConfirmMode(mode);
    setConfirmOpen(true);
  };

  const execDelete = async () => {
    if (busy) return;
    if (!confirmEventId) return;

    setBusy(true);
    setErr("");

    try {
      const r = await fetch("/api/cms/event-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          eventId: confirmEventId,
          mode: confirmMode,
          confirm: 1,
        }),
      });

      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "delete_failed");

      setConfirmOpen(false);
      await refresh();
      showToast(confirmMode === "trash" ? "ゴミ箱へ移動しました" : "完全削除しました");
    } catch (e: any) {
      setErr(`操作失敗：${String(e?.message || e || "unknown")}`);
    } finally {
      setBusy(false);
    }
  };

  const events = useMemo(() => {
    const list = (data?.events || []).map((e) => ({
      ...e,
      paused: !!e.paused,
      startAt: e.startAt || 0,
      endAt: e.endAt || 0,
    }));

    // 1) filter
    let filtered = list;
    if (filter === "running") filtered = filtered.filter((e) => !e.ended && !e.paused);
    if (filter === "paused") filtered = filtered.filter((e) => e.paused);
    if (filter === "ended") filtered = filtered.filter((e) => e.ended);

    // 2) search
    const qq = q.trim().toLowerCase();
    if (qq) {
      filtered = filtered.filter((e) => {
        const hay = [
          e.eventName || "",
          e.hostLabel || "",
          e.planId || "",
          e.eventId || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      });
    }

    // 3) sort
    const dir = sortDir === "desc" ? -1 : 1;
    const getCreated = (e: any) => e.startAt || e.endAt || 0;

    const sorted = [...filtered].sort((a, b) => {
      let av = 0;
      let bv = 0;

      if (sortKey === "bytes") {
        av = a.bytes || 0;
        bv = b.bytes || 0;
      } else if (sortKey === "active") {
        av = a.activeGuests || 0;
        bv = b.activeGuests || 0;
      } else if (sortKey === "total") {
        av = a.totalGuests || 0;
        bv = b.totalGuests || 0;
      } else {
        av = getCreated(a);
        bv = getCreated(b);
      }

      if (av !== bv) return (av < bv ? -1 : 1) * dir;
      return String(a.eventId).localeCompare(String(b.eventId)) * dir;
    });

    return sorted;
  }, [data, filter, q, sortKey, sortDir]);

  return (
    <main style={wrap}>
      <div style={topBar}>
        <div style={brand}>どこでもオモチカメラCMS</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* ✅ 検索 */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索（イベント名 / ホスト名 / plan / eventId）"
            style={{ ...input, width: 320, padding: "10px 12px" }}
            disabled={busy}
          />

          {/* フィルタ */}
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={select} disabled={busy}>
            <option value="all">全て</option>
            <option value="running">開催中</option>
            <option value="paused">停止中</option>
            <option value="ended">終了</option>
          </select>

          {/* ✅ 並び替え */}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={select} disabled={busy}>
            <option value="created">作成日</option>
            <option value="bytes">容量</option>
            <option value="active">参加者（現在）</option>
            <option value="total">参加者（累計）</option>
          </select>

          <select value={sortDir} onChange={(e) => setSortDir(e.target.value as SortDir)} style={select} disabled={busy}>
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>

          <button onClick={refresh} disabled={busy} style={btnGhost}>
            更新
          </button>
        </div>
      </div>

      {loading ? (
        <div style={card}>読み込み中…</div>
      ) : err ? (
        <div style={{ ...card, borderColor: "#f2c9c9" }}>{err}</div>
      ) : (
        <>
          {/* 緊急停止（縦を短く） */}
          <div style={{ ...card, borderColor: killOn ? "#ffb3b3" : "#eee", padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>緊急停止</div>

              <span
                style={{
                  ...pill,
                  background: killOn ? "#111" : "#f4f4f4",
                  color: killOn ? "#fff" : "#666",
                }}
              >
                {killOn ? "停止中" : "稼働中"}
              </span>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="停止メッセージ"
                style={{ ...input, maxWidth: 360, padding: "8px 10px" }}
                disabled={busy}
              />

              <button
                onClick={() => setGlobalStop(true)}
                disabled={busy || killOn}
                style={{ ...btnDanger, padding: "8px 14px" }}
              >
                ON
              </button>

              <button
                onClick={() => setGlobalStop(false)}
                disabled={busy || !killOn}
                style={{ ...btnPrimary, padding: "8px 14px" }}
              >
                OFF
              </button>
              
              <button
  onClick={async()=>{
    if(!confirm("不正イベントを一括でゴミ箱へ移動します。よろしいですか？")) return;
    const r = await fetch("/api/cms/sweep-invalid",{method:"POST"});
    const j = await r.json();
    if(j.ok){
      showToast(`不正イベント ${j.moved} 件を移動`);
      refresh();
    }else{
      setErr("操作失敗："+(j.error||"unknown"));
    }
  }}
  style={btnGhost}
>
  不正ID掃除
</button>
            </div>
          </div>

          {/* ストレージ */}
          <div style={card}>
            <div style={h2}>ストレージ</div>
            <div style={sub}>
              使用量：{fmtBytes(data?.storage?.usedBytes || 0)} / {fmtBytes(data?.storage?.maxBytes || 0)}（{ratioPct}%）
            </div>
            <div style={barOuter}>
              <div style={{ ...barInner, width: `${Math.min(100, Math.max(0, ratioPct))}%` }} />
            </div>
            <div style={miniNote}>
              警告80%：{data?.storage?.warn80 ? "ON" : "OFF"} / 停止90%：{data?.storage?.stop90 ? "ON" : "OFF"}
            </div>
          </div>

          {/* イベント一覧 */}
          <div style={card}>
            <div style={rowBetween}>
              <div style={h2}>イベント一覧</div>
              <div style={sub}>件数：{events.length}（全体：{data?.eventsCount ?? 0}）</div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>イベント名</th>
                    <th style={th}>プラン</th>
                    <th style={th}>ホスト名</th>
                    <th style={th}>参加枠</th>
                    <th style={th}>状態</th>
                    <th style={th}>容量</th>
                    <th style={th}>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {events.map((e) => {
                    const badId = !isUuidLike(e.eventId);

                    const stateLabel = e.paused ? "停止中" : e.ended ? "終了" : "開催中";
                    const stateBg = e.paused ? "#ffe7c2" : e.ended ? "#111" : "#f4f4f4";
                    const stateColor = e.paused ? "#7a4b00" : e.ended ? "#fff" : "#666";

                    return (
                      <tr key={e.eventId}>
                        <td style={td}>
                          <div style={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                            {e.eventName || "(無題)"} {badId && <span style={{ marginLeft: 6, ...pill, background: "#ffd5d5", color: "#b00020" }}>不正ID</span>}
                          </div>
                          <div style={monoSmall}>{e.eventId}</div>
                        </td>
                        <td style={td}>{e.planId || "-"}</td>
                        <td style={td}>{e.hostLabel || "-"}</td>
                        <td style={td}>
                          {e.activeGuests}/{e.maxGuests}
                          <div style={monoSmall}>total:{e.totalGuests}</div>
                        </td>
                        <td style={td}>
                          <span style={{ ...pill, background: stateBg, color: stateColor }}>
                            {stateLabel}
                          </span>
                        </td>
                        <td style={td}>{fmtBytes(e.bytes || 0)}</td>
                        <td style={td}>
                          {badId ? (
                            <div style={miniNote}>
                              ※ この行は eventId が `{` `}` を含むため<br/>
                              UI削除できません（<b>FTPで event-{"{eventId}"} を削除</b>してください）
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                style={btnMini}
                                disabled={busy}
                                onClick={() => openDeleteConfirm(e.eventId, e.eventName, "trash")}
                              >
                                ゴミ箱へ
                              </button>

                              <button
                                style={{ ...btnMini, borderColor: "#ffb3b3", color: "#b00020" }}
                                disabled={busy}
                                onClick={() => openDeleteConfirm(e.eventId, e.eventName, "purge")}
                              >
                                完全削除
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={miniNote}>
              ※ 終了イベントは「終了から7日」でアーカイブ。必要に応じてゴミ箱/完全削除を使います。
            </div>
          </div>
        </>
      )}

      {/* UI_VER */}
      <div style={uiVer}>UI_VER: {UI_VER}</div>

      {/* Toast */}
      {toast && <div style={toastStyle}>{toast}</div>}

      {/* Confirm modal */}
      {confirmOpen && (
        <div style={modalOverlay} onClick={() => !busy && setConfirmOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>削除の確認</div>

            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              対象：<b>{confirmEventName}</b>
              <div style={monoSmall}>eventId: {confirmEventId}</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
              {confirmMode === "trash" ? (
                <>イベントを <b>ゴミ箱へ移動</b>します（復旧可能）。</>
              ) : (
                <>
                  イベントを <b style={{ color: "#b00020" }}>完全削除</b>します（復旧不可）。
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button style={btnGhost} disabled={busy} onClick={() => setConfirmOpen(false)}>
                キャンセル
              </button>
              <button
                style={confirmMode === "trash" ? btnPrimary : btnDanger}
                disabled={busy}
                onClick={execDelete}
              >
                {busy ? "処理中…" : confirmMode === "trash" ? "ゴミ箱へ移動" : "完全削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------- styles ----------

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f6f6",
  padding: 12,
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const topBar: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const brand: React.CSSProperties = { fontSize: 16, fontWeight: 900 };

const select: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const card: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto 10px",
  background: "#fff",
  borderRadius: 14,
  padding: 12,
  border: "1px solid #eee",
};

const rowBetween: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const h2: React.CSSProperties = { fontSize: 14, fontWeight: 900 };

const sub: React.CSSProperties = { fontSize: 12, color: "#666", marginTop: 4 };

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  fontSize: 14,
  outline: "none",
};

const btnDanger: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 999,
  border: 0,
  background: "#ff3b30",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 999,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
};

const btnGhost: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const btnMini: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 900,
  fontSize: 12,
};

const miniNote: React.CSSProperties = { fontSize: 11, color: "#666", lineHeight: 1.35 };

const barOuter: React.CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: "#eee",
  overflow: "hidden",
  marginTop: 8,
};

const barInner: React.CSSProperties = { height: "100%", background: "#111" };

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
  color: "#333",
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f3f3f3",
  verticalAlign: "top",
};

const monoSmall: React.CSSProperties = {
  fontSize: 10,
  color: "#777",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  marginTop: 4,
};

const uiVer: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  fontSize: 10,
  opacity: 0.35,
  padding: "6px 2px 16px",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 18,
  transform: "translateX(-50%)",
  background: "#111",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 14,
};

const modalCard: React.CSSProperties = {
  width: "min(520px, 100%)",
  background: "#fff",
  borderRadius: 16,
  padding: 14,
  border: "1px solid #eee",
  boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
};