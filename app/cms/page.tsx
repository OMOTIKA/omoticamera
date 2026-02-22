"use client";

// UI_VER: CMS_DASHBOARD_V1_20260208

import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

/**
 * CMSトップが期待するレスポンス（サーバ側をこの形で返す想定）
 * GET 例:  /cms/dashboard.php?v=...
 *
 * - usedMb / maxMb でストレージ%を算出
 * - events はページング済みでもOK（ここは pages/total まで持てる）
 */
type CmsDashboardResp = {
  ok: boolean;
  marker?: string;

  // 重要：ストレージ
  storage: {
    usedMb: number; // 例: 9576.803
    maxMb: number; // 例: 348823 + used でもOK（全体上限）
    warnAtPct: number; // 80
    stopAtPct: number; // 90
    uploadStopped: boolean; // 90%超えなどで true
  };

  // 重要：制御
  killSwitch: {
    enabled: boolean;
    reason: string; // 表示用（空なら非表示）
  };

  // お知らせ（運営から）
  notice: {
    enabled: boolean;
    title: string;
    body: string;
    startsAt: number; // unix ms
    endsAt: number; // unix ms
  };

  // 統計（ざっくりでOK）
  stats: {
    eventsTotal: number;
    eventsActive: number;
    guestsTotal: number;
    photosTotal: number;
  };

  // イベント一覧（運営用）
  events: Array<{
    eventId: string;
    eventName: string;

    planId: string;
    planLabel: string;
    priceYen: number;

    hostName: string; // CMSで付与（ホスト表示名）
    maxGuests: number;
    activeGuests: number;
    photosCount: number;

    status: "active" | "ended" | "stopped";
    endAt: number; // unix ms (0=未設定)
    albumExpiresAt: number; // unix sec (0=未生成)
    hardDeleteAt: number; // unix ms (20日後など)
    usedMb: number; // イベント単位の概算
  }>;

  // 任意：ページング
  page?: number;
  per?: number;
  pages?: number;
  total?: number;
};

export default function CmsDashboardPage() {
  const UI_VER = "CMS_DASHBOARD_V1_20260208";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<CmsDashboardResp | null>(null);

  // UI用：検索・ソート（スマホでも軽量）
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<
    "updated" | "status" | "guests" | "photos" | "storage"
  >("updated");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setErr("");

      try {
        const res = await fetch(
          `${API_BASE}/cms/dashboard.php?v=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include", // CMSはセッション前提
          }
        );
        const json = (await res.json()) as CmsDashboardResp;

        if (!json?.ok) throw new Error("api_error");
        if (!alive) return;

        setData(json);
      } catch {
        if (!alive) return;
        setErr("通信エラー：CMSダッシュボードを取得できませんでした");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, []);

  const storagePct = useMemo(() => {
    const s = data?.storage;
    if (!s || s.maxMb <= 0) return 0;
    return Math.min(100, Math.max(0, (s.usedMb / s.maxMb) * 100));
  }, [data]);

  const storageLevel = useMemo(() => {
    if (!data) return "ok" as const;
    const pct = storagePct;
    const warn = data.storage.warnAtPct;
    const stop = data.storage.stopAtPct;

    if (pct >= stop) return "stop" as const;
    if (pct >= warn) return "warn" as const;
    return "ok" as const;
  }, [data, storagePct]);

  const filteredEvents = useMemo(() => {
    const ev = data?.events || [];
    const qq = q.trim();
    const base = qq
      ? ev.filter((e) => {
          const hay = `${e.eventName} ${e.hostName} ${e.planLabel} ${e.planId}`.toLowerCase();
          return hay.includes(qq.toLowerCase());
        })
      : ev;

    const sorted = [...base].sort((a, b) => {
      if (sort === "status") {
        const rank = (s: string) => (s === "active" ? 0 : s === "ended" ? 1 : 2);
        return rank(a.status) - rank(b.status);
      }
      if (sort === "guests") return (b.activeGuests || 0) - (a.activeGuests || 0);
      if (sort === "photos") return (b.photosCount || 0) - (a.photosCount || 0);
      if (sort === "storage") return (b.usedMb || 0) - (a.usedMb || 0);
      // updated（代替：endAt / hardDeleteAt などでざっくり）
      return (b.hardDeleteAt || 0) - (a.hardDeleteAt || 0);
    });

    return sorted;
  }, [data, q, sort]);

  // -------------------------
  // helpers
  // -------------------------
  const yen = (n: number) => `¥${(n || 0).toLocaleString("ja-JP")}`;
  const mbToGb = (mb: number) => `${(mb / 1024).toFixed(1)}GB`;
  const fmtDate = (ms: number) => {
    if (!ms) return "—";
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  };
  const fmtSecToDate = (sec: number) => {
    if (!sec) return "—";
    return fmtDate(sec * 1000);
  };

  // -------------------------
  // UI states
  // -------------------------
  if (loading) {
    return (
      <main className="wrap">
        <div className="topbar">
          <div className="brand">どこでもオモチカメラCMS</div>
          <div className="sub">読み込み中…</div>
        </div>
        <div className="card">読み込み中…</div>
        <div className="uiver">UI_VER: {UI_VER}</div>
        <Style />
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="wrap">
        <div className="topbar">
          <div className="brand">どこでもオモチカメラCMS</div>
          <div className="sub">Dashboard</div>
        </div>
        <div className="card error">{err || "エラー"}</div>
        <div className="uiver">UI_VER: {UI_VER}</div>
        <Style />
      </main>
    );
  }

  // -------------------------
  // main
  // -------------------------
  return (
    <main className="wrap">
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="brand">どこでもオモチカメラCMS</div>
          <div className="sub">全イベント横断管理（運営専用）</div>
        </div>

        {/* 右側：状態 */}
        <div className="topbarRight">
          {data.killSwitch.enabled && (
            <span className="pill pillStop">強制停止</span>
          )}
          {storageLevel === "warn" && <span className="pill pillWarn">容量警告</span>}
          {storageLevel === "stop" && <span className="pill pillStop">容量停止</span>}
        </div>
      </div>

      {/* Storage */}
      <section className="section">
        <div className="sectionHead">
          <div className="sectionTitle">ストレージ</div>
          <div className="sectionRight">
            <span className="mini">
              {mbToGb(data.storage.usedMb)} / {mbToGb(data.storage.maxMb)}（{storagePct.toFixed(1)}%）
            </span>
          </div>
        </div>

        <div className="barWrap">
          <div
            className={[
              "bar",
              storageLevel === "ok" ? "barOk" : "",
              storageLevel === "warn" ? "barWarn" : "",
              storageLevel === "stop" ? "barStop" : "",
            ].join(" ")}
            style={{ width: `${storagePct}%` }}
          />
        </div>

        <div className="hintRow">
          <div className="hint">
            警告：{data.storage.warnAtPct}% ／ 停止：{data.storage.stopAtPct}%
          </div>
          <div className="hint">
            {data.storage.uploadStopped ? "アップロード停止中" : "稼働中"}
          </div>
        </div>
      </section>

      {/* Notice / KillSwitch */}
      {(data.notice.enabled || data.killSwitch.enabled) && (
        <section className="section">
          <div className="grid2">
            <div className="card">
              <div className="cardTitle">お知らせ</div>
              {data.notice.enabled ? (
                <>
                  <div className="cardMain">{data.notice.title}</div>
                  <div className="cardSub">{data.notice.body}</div>
                  <div className="cardMeta">
                    {fmtDate(data.notice.startsAt)} 〜 {fmtDate(data.notice.endsAt)}
                  </div>
                </>
              ) : (
                <div className="cardSub">現在お知らせはありません</div>
              )}
            </div>

            <div className="card">
              <div className="cardTitle">運営キルスイッチ</div>
              <div className="cardMain">
                {data.killSwitch.enabled ? "ON（停止）" : "OFF（通常）"}
              </div>
              {data.killSwitch.reason && (
                <div className="cardSub">{data.killSwitch.reason}</div>
              )}
              <div className="cardMeta">
                ※操作ボタンは後段（安全設計してから実装）
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="section">
        <div className="sectionHead">
          <div className="sectionTitle">統計</div>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="statLabel">総イベント</div>
            <div className="statVal">{data.stats.eventsTotal}</div>
          </div>
          <div className="stat">
            <div className="statLabel">稼働中</div>
            <div className="statVal">{data.stats.eventsActive}</div>
          </div>
          <div className="stat">
            <div className="statLabel">総ゲスト</div>
            <div className="statVal">{data.stats.guestsTotal}</div>
          </div>
          <div className="stat">
            <div className="statLabel">総撮影</div>
            <div className="statVal">{data.stats.photosTotal}</div>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="section">
        <div className="sectionHead">
          <div className="sectionTitle">イベント一覧</div>
          <div className="controls">
            <input
              className="input"
              placeholder="検索（イベント名 / ホスト名 / プラン）"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
            >
              <option value="updated">並び：更新（簡易）</option>
              <option value="status">並び：状態</option>
              <option value="guests">並び：参加人数</option>
              <option value="photos">並び：撮影枚数</option>
              <option value="storage">並び：容量</option>
            </select>
          </div>
        </div>

        {/* PC table */}
        <div className="pcOnly">
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>イベント</th>
                  <th>プラン</th>
                  <th>ホスト</th>
                  <th>ゲスト</th>
                  <th>撮影</th>
                  <th>状態</th>
                  <th>アルバム期限</th>
                  <th>容量</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.eventId}>
                    <td>
                      <div className="tdTitle">{e.eventName}</div>
                      <div className="tdSub">{e.eventId}</div>
                    </td>
                    <td>
                      <div className="tdTitle">{e.planLabel}</div>
                      <div className="tdSub">{yen(e.priceYen)}</div>
                    </td>
                    <td>
                      <div className="tdTitle">{e.hostName || "—"}</div>
                    </td>
                    <td>
                      <div className="tdTitle">
                        {e.activeGuests}/{e.maxGuests}
                      </div>
                    </td>
                    <td>
                      <div className="tdTitle">{e.photosCount}</div>
                    </td>
                    <td>{StatusPill(e.status)}</td>
                    <td>
                      <div className="tdTitle">{fmtSecToDate(e.albumExpiresAt)}</div>
                      <div className="tdSub">削除 {fmtDate(e.hardDeleteAt)}</div>
                    </td>
                    <td>
                      <div className="tdTitle">{mbToGb(e.usedMb)}</div>
                    </td>
                    <td>
                      <button className="btn">詳細</button>
                      <button className="btn ghost">…</button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 14, color: "#666" }}>
                      該当するイベントがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="spOnly">
          <div className="cards">
            {filteredEvents.map((e) => (
              <div key={e.eventId} className="eCard">
                <div className="eTop">
                  <div className="eTitle">{e.eventName}</div>
                  <div>{StatusPill(e.status)}</div>
                </div>

                <div className="ePlan">
                  <span className="ePlanName">{e.planLabel}</span>
                  <span className="ePlanPrice">{yen(e.priceYen)}</span>
                </div>

                <div className="eGrid">
                  <div className="eItem">
                    <div className="eLabel">ホスト</div>
                    <div className="eVal">{e.hostName || "—"}</div>
                  </div>
                  <div className="eItem">
                    <div className="eLabel">ゲスト</div>
                    <div className="eVal">
                      {e.activeGuests}/{e.maxGuests}
                    </div>
                  </div>
                  <div className="eItem">
                    <div className="eLabel">撮影</div>
                    <div className="eVal">{e.photosCount}</div>
                  </div>
                  <div className="eItem">
                    <div className="eLabel">容量</div>
                    <div className="eVal">{mbToGb(e.usedMb)}</div>
                  </div>
                </div>

                <div className="eMeta">
                  <div>アルバム期限：{fmtSecToDate(e.albumExpiresAt)}</div>
                  <div>完全削除：{fmtDate(e.hardDeleteAt)}</div>
                </div>

                <div className="eActions">
                  <button className="btn wide">詳細</button>
                  <button className="btn ghost">…</button>
                </div>
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <div className="card" style={{ color: "#666" }}>
                該当するイベントがありません
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="uiver">UI_VER: {UI_VER}</div>
      <Style />
    </main>
  );
}

// -------------------------
// parts
// -------------------------
function StatusPill(status: "active" | "ended" | "stopped") {
  if (status === "active") return <span className="pill pillOn">撮影中</span>;
  if (status === "ended") return <span className="pill pillOff">終了</span>;
  return <span className="pill pillStop">停止</span>;
}

// -------------------------
// styles（超軽量・レスポンシブ）
// -------------------------
function Style() {
  return (
    <style jsx>{`
      .wrap {
        min-height: 100vh;
        background: #f6f6f6;
        padding: 10px;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      }

      .topbar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 8px 6px;
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(246, 246, 246, 0.92);
        backdrop-filter: blur(8px);
      }

      .brand {
        font-weight: 900;
        font-size: 16px;
        line-height: 1.15;
      }
      .sub {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
      }
      .topbarRight {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .section {
        margin: 10px auto;
        max-width: 1100px;
      }

      .sectionHead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      .sectionTitle {
        font-size: 13px;
        font-weight: 900;
        color: #111;
      }

      .sectionRight {
        font-size: 12px;
        color: #666;
      }

      .mini {
        font-size: 12px;
        color: #555;
        font-weight: 700;
      }

      .card {
        background: #fff;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
      }

      .card.error {
        border: 1px solid #ffd6d6;
        background: #fff7f7;
        color: #b40000;
        font-weight: 800;
      }

      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .cardTitle {
        font-size: 12px;
        font-weight: 900;
        color: #111;
      }
      .cardMain {
        font-size: 14px;
        font-weight: 900;
        margin-top: 6px;
      }
      .cardSub {
        font-size: 12px;
        color: #444;
        margin-top: 6px;
        line-height: 1.35;
      }
      .cardMeta {
        font-size: 11px;
        color: #777;
        margin-top: 6px;
      }

      .barWrap {
        height: 10px;
        background: #ececec;
        border-radius: 999px;
        overflow: hidden;
      }
      .bar {
        height: 100%;
        border-radius: 999px;
      }
      .barOk {
        background: #111;
      }
      .barWarn {
        background: #b8860b;
      }
      .barStop {
        background: #c40000;
      }

      .hintRow {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 6px;
      }
      .hint {
        font-size: 11px;
        color: #666;
      }

      .pill {
        display: inline-block;
        font-size: 11px;
        font-weight: 900;
        padding: 5px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .pillOn {
        background: #111;
        color: #fff;
      }
      .pillOff {
        background: #f0f0f0;
        color: #444;
      }
      .pillWarn {
        background: #fff3d6;
        color: #6b4a00;
        border: 1px solid #ffe2a8;
      }
      .pillStop {
        background: #ffe0e0;
        color: #7d0000;
        border: 1px solid #ffb5b5;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .stat {
        background: #fff;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
      }
      .statLabel {
        font-size: 11px;
        color: #666;
        font-weight: 800;
      }
      .statVal {
        font-size: 20px;
        font-weight: 900;
        margin-top: 6px;
        line-height: 1;
      }

      .controls {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        width: 100%;
      }
      .input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #e6e6e6;
        background: #fff;
        font-size: 14px;
        outline: none;
      }
      .select {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #e6e6e6;
        background: #fff;
        font-size: 14px;
        font-weight: 800;
      }

      .pcOnly {
        display: block;
      }
      .spOnly {
        display: none;
      }

      .tableWrap {
        background: #fff;
        border-radius: 12px;
        overflow: auto;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        min-width: 980px;
      }
      th {
        font-size: 12px;
        color: #666;
        text-align: left;
        padding: 10px;
        border-bottom: 1px solid #eee;
        background: #fafafa;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      td {
        padding: 10px;
        border-bottom: 1px solid #f2f2f2;
        vertical-align: top;
      }
      .tdTitle {
        font-weight: 900;
        font-size: 13px;
        color: #111;
      }
      .tdSub {
        font-size: 11px;
        color: #777;
        margin-top: 4px;
        word-break: break-all;
      }

      .btn {
        padding: 8px 10px;
        border-radius: 10px;
        border: 0;
        background: #111;
        color: #fff;
        font-weight: 900;
        font-size: 12px;
        cursor: pointer;
        margin-right: 6px;
      }
      .btn.ghost {
        background: #fff;
        color: #111;
        border: 1px solid #ddd;
      }
      .btn.wide {
        flex: 1;
      }

      /* mobile cards */
      .cards {
        display: grid;
        gap: 10px;
      }
      .eCard {
        background: #fff;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
      }
      .eTop {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }
      .eTitle {
        font-weight: 900;
        font-size: 15px;
        line-height: 1.15;
      }
      .ePlan {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 8px;
        font-size: 12px;
        color: #333;
        font-weight: 800;
      }
      .ePlanName {
        color: #111;
      }
      .ePlanPrice {
        color: #666;
        font-weight: 900;
      }

      .eGrid {
        margin-top: 10px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .eItem {
        border: 1px solid #f0f0f0;
        border-radius: 10px;
        padding: 8px;
      }
      .eLabel {
        font-size: 10px;
        color: #777;
        font-weight: 900;
      }
      .eVal {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 900;
        color: #111;
        word-break: break-word;
      }

      .eMeta {
        margin-top: 10px;
        font-size: 11px;
        color: #666;
        display: grid;
        gap: 4px;
      }

      .eActions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }

      .uiver {
        max-width: 1100px;
        margin: 14px auto 6px;
        font-size: 11px;
        color: #999;
        text-align: center;
        user-select: all;
      }

      /* responsive */
      @media (max-width: 840px) {
        .grid2 {
          grid-template-columns: 1fr;
        }
        .stats {
          grid-template-columns: 1fr 1fr;
        }
        .pcOnly {
          display: none;
        }
        .spOnly {
          display: block;
        }
        .controls {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}