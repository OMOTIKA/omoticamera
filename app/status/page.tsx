"use client";

import { useEffect, useState } from "react";
import { clearPending, listPending, PendingPhoto, updatePending } from "../lib/db";

export default function StatusPage() {
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const load = async () => {
    const arr = await listPending();
    setItems(arr);

    const map: Record<string, string> = {};
    for (const it of arr) {
      map[it.id] = URL.createObjectURL(it.blob);
    }
    setThumbs(map);
  };

  const uploadOne = async (it: PendingPhoto) => {
    await updatePending(it.id, { state: "uploading", lastError: "" });

    const form = new FormData();
    form.append("file", it.blob, `${it.id}.svg`);
    form.append("nickname", it.nickname);
    form.append("id", it.id);
form.append("createdAt", String(it.createdAt));

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      const msg = json.error || `HTTP ${res.status}`;
      await updatePending(it.id, {
        state: "error",
        retryCount: (it.retryCount || 0) + 1,
        lastError: msg,
      });
      return false;
    }

    await updatePending(it.id, { state: "sent", sentAt: Date.now() });
    return true;
  };

  const runUploader = async () => {
    if (!navigator.onLine) return;

    const all = await listPending();
    const targets = all
      .filter((x) => x.state === "pending" || x.state === "error")
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const it of targets) {
      if ((it.retryCount || 0) >= 3) continue;
      await uploadOne(it);
    }

    await load();
  };

  useEffect(() => {
    load();

    // オンライン復帰で自動送信
    const onOnline = () => runUploader();
    window.addEventListener("online", onOnline);

    // /statusが前面に来たら再実行
    const onFocus = () => runUploader();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = async () => {
    await clearPending();
    setItems([]);
    setThumbs({});
  };

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 740 }}>
      <h1>送信状況</h1>

      <p style={{ color: "#444" }}>
        送信待ち：
        <b>
          {items.filter((x) => x.state === "pending" || x.state === "error").length}
        </b>
        枚 / 送信済み：<b>{items.filter((x) => x.state === "sent").length}</b>枚
      </p>

      <button
        onClick={runUploader}
        style={{ padding: "10px 16px", cursor: "pointer" }}
      >
        今すぐ送信（手動）
      </button>

      <button
        onClick={clearAll}
        style={{ marginLeft: 8, padding: "10px 16px", cursor: "pointer" }}
      >
        全削除（テスト用）
      </button>

      <hr style={{ margin: "16px 0" }} />

      {items.length === 0 ? (
        <p>送信待ちはありません。</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                {it.nickname} / {new Date(it.createdAt).toLocaleString()}
              </div>

              <div style={{ fontSize: 12, marginBottom: 6 }}>
                状態：<b>{it.state}</b>
                {it.state === "error" && it.lastError ? `（${it.lastError}）` : ""}
              </div>

              <img
                src={thumbs[it.id]}
                alt="pending"
                style={{
                  width: "100%",
                  aspectRatio: "3 / 4",
                  objectFit: "cover",
                  borderRadius: 8,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
