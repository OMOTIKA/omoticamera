"use client";

import { useEffect, useState } from "react";
import { clearAllPending, deletePending, listPending, type PendingPhoto } from "../lib/db";
import { tryAutoSend } from "../lib/uploader";

export default function StatusPage() {
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const arr = await listPending();
    setItems(arr);

    // 既存URLを解放してから作り直し
    Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));

    const map: Record<string, string> = {};
    for (const it of arr) {
      map[it.id] = URL.createObjectURL(it.blob);
    }
    setThumbs(map);
  };

  const runSend = async () => {
    if (busy) return;
    setBusy(true);
    setMsg("");

    try {
      if (!navigator.onLine) {
        setMsg("オフラインです（オンラインになったら自動再送されます）");
        return;
      }
      const { sent, failed } = await tryAutoSend();
      setMsg(`送信：${sent} / 失敗：${failed}`);
      await load();
    } catch {
      setMsg("送信に失敗しました（通信）");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("端末内の送信待ちを全て削除します。よろしいですか？")) return;
    await clearAllPending();
    await load();
  };

  const delOne = async (id: string) => {
    if (!confirm("この1枚を端末内の送信待ちから削除します。よろしいですか？")) return;
    await deletePending(id);
    await load();
  };

  useEffect(() => {
    load();

    const onOnline = () => void runSend();
    window.addEventListener("online", onOnline);

    const onFocus = () => void runSend();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 760 }}>
      <h1 style={{ marginBottom: 8 }}>送信状況（端末内キュー）</h1>

      <p style={{ color: "#444", marginTop: 0 }}>
        送信待ち：<b>{items.length}</b> 枚
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={runSend} disabled={busy} style={{ padding: "10px 16px", cursor: "pointer" }}>
          {busy ? "送信中…" : "今すぐ送信（手動）"}
        </button>

        <button onClick={clearAll} disabled={busy} style={{ padding: "10px 16px", cursor: "pointer" }}>
          全削除（テスト用）
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#f6f6f6", color: "#111" }}>
          {msg}
        </div>
      )}

      <hr style={{ margin: "16px 0" }} />

      {items.length === 0 ? (
        <p>送信待ちはありません。</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6, wordBreak: "break-all" }}>
                {it.nickname} / {new Date(it.createdAt).toLocaleString()}
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{it.id}</div>
              </div>

              <img
                src={thumbs[it.id]}
                alt="pending"
                style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 8 }}
              />

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => delOne(it.id)}
                  disabled={busy}
                  style={{ padding: "8px 10px", cursor: "pointer" }}
                >
                  1枚削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}