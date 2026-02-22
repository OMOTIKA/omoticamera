"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PhotoItem = {
  id: string;
  url: string;
  createdAt?: number;
  nickname?: string; // ホストのみ見える想定（UIでは出し分け）
};

const LS_ROLE = "omoticamera_role";
const LS_EVENT_ID = "omoticamera_eventId";
const LS_HOST_KEY = "omoticamera_hostKey";

// ✅ ロリポップAPI（.env.local で差し替え前提）
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://omotika.zombie.jp/omoticamera-api";

function getRole(): "host" | "guest" {
  if (typeof window === "undefined") return "guest";
  const r = localStorage.getItem(LS_ROLE);
  return r === "host" ? "host" : "guest";
}

function formatNum(n: number) {
  return new Intl.NumberFormat("ja-JP").format(n);
}

export default function GalleryPage() {
  const router = useRouter();
  const role = getRole();

  const [eventId, setEventId] = useState<string>("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // viewer
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const activePhoto = useMemo(() => photos[activeIndex], [photos, activeIndex]);

  const load = async () => {
    setLoading(true);
    setErr("");

    try {
      const eid = localStorage.getItem(LS_EVENT_ID) || "";
      setEventId(eid);

      if (!eid) {
        setPhotos([]);
        setErr("イベント情報が見つかりません。QRから参加すると一覧が見られます。");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/list.php?eventId=${encodeURIComponent(eid)}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!json?.ok) {
        setPhotos([]);
        setErr(json?.error || "一覧の読み込みに失敗しました");
        setLoading(false);
        return;
      }

      const arr: PhotoItem[] = (json.photos || []).map((p: any) => ({
        id: String(p.id || ""),
        url: String(p.url || ""),
        createdAt: typeof p.createdAt === "number" ? p.createdAt : undefined,
        nickname: typeof p.nickname === "string" ? p.nickname : undefined,
      }));

      // 新しい順（createdAtが無い場合は後ろへ）
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setPhotos(arr);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message || "一覧の読み込みに失敗しました");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToCamera = () => router.push("/camera");

  // ホストのみ：サーバー画像削除（delete.php）
  const deletePhoto = async (id: string) => {
    if (role !== "host") return;

    const hostKey = localStorage.getItem(LS_HOST_KEY) || "";
    if (!hostKey) {
      alert("ホストキーが見つかりません（先にホストログインしてください）");
      return;
    }

    const ok = confirm("この写真を削除します。\n削除すると元に戻せません。よろしいですか？");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/delete.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          hostKey,
          id,
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        alert(json?.error || "削除に失敗しました");
        return;
      }

      // UI更新
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      // open中なら閉じる or 次へ
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || "削除に失敗しました");
    }
  };

  const openViewer = (idx: number) => {
    setActiveIndex(idx);
    setOpen(true);
  };

  const next = () => setActiveIndex((i) => Math.min(i + 1, photos.length - 1));
  const prev = () => setActiveIndex((i) => Math.max(i - 1, 0));

  // ESCで閉じる（PC用）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photos.length]);

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      {/* ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>撮影済み一覧</div>
          <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>
            {eventId ? `イベントID：${eventId}` : "イベント未設定"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 14 }}>
            {formatNum(photos.length)}枚
          </div>
          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            更新
          </button>
        </div>
      </header>

      {/* 状態 */}
      {loading && (
        <div style={{ padding: 14, borderRadius: 14, background: "#fafafa", border: "1px solid #eee" }}>
          読み込み中…
        </div>
      )}
      {!loading && err && (
        <div style={{ padding: 14, borderRadius: 14, background: "#fff5f5", border: "1px solid #ffd5d5" }}>
          {err}
        </div>
      )}
      {!loading && !err && photos.length === 0 && (
        <div style={{ padding: 14, borderRadius: 14, background: "#fafafa", border: "1px solid #eee" }}>
          まだ写真がありません。
        </div>
      )}

      {/* グリッド（写真アプリ寄り） */}
      {!loading && !err && photos.length > 0 && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 12,
            marginBottom: 88,
          }}
        >
          <style>{`
            @media (min-width: 720px) {
              .grid3 { grid-template-columns: repeat(5, 1fr) !important; }
            }
          `}</style>

          <div className="grid3" style={{ display: "contents" }}>
            {photos.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => openViewer(idx)}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#f2f2f2",
                    boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
                  }}
                >
                  <img
                    src={p.url}
                    alt={p.id}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />

                  {/* ホストのみ：撮影者ヒント（小さく） */}
                  {role === "host" && p.nickname && (
                    <div
                      style={{
                        position: "absolute",
                        left: 8,
                        bottom: 8,
                        fontSize: 11,
                        fontWeight: 900,
                        color: "rgba(255,255,255,0.95)",
                        background: "rgba(0,0,0,0.55)",
                        padding: "4px 8px",
                        borderRadius: 999,
                        maxWidth: "90%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.nickname}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ビューア（1枚表示） */}
      {open && activePhoto && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.70)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, 96vw)",
              height: "min(720px, 80vh)",
              background: "#111",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              display: "grid",
              gridTemplateRows: "1fr auto",
            }}
          >
            <div style={{ position: "relative" }}>
              <img
                src={activePhoto.url}
                alt={activePhoto.id}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />

              {/* 左右 */}
              <button
                onClick={prev}
                disabled={activeIndex === 0}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: 0,
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  fontWeight: 1000,
                  cursor: activeIndex === 0 ? "not-allowed" : "pointer",
                  opacity: activeIndex === 0 ? 0.35 : 1,
                }}
              >
                ‹
              </button>

              <button
                onClick={next}
                disabled={activeIndex === photos.length - 1}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: 0,
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  fontWeight: 1000,
                  cursor: activeIndex === photos.length - 1 ? "not-allowed" : "pointer",
                  opacity: activeIndex === photos.length - 1 ? 0.35 : 1,
                }}
              >
                ›
              </button>
            </div>

            <div
              style={{
                padding: 12,
                background: "#0f0f10",
                color: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.75)" }}>
                {activeIndex + 1} / {photos.length}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {role === "host" && (
                  <button
                    onClick={() => deletePhoto(activePhoto.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: 0,
                      background: "rgba(255,80,80,0.92)",
                      color: "#111",
                      fontWeight: 1000,
                      cursor: "pointer",
                    }}
                  >
                    削除
                  </button>
                )}

                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: 0,
                    background: "rgba(255,255,255,0.18)",
                    color: "#fff",
                    fontWeight: 1000,
                    cursor: "pointer",
                  }}
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 下部バー：戻るを「撮影」に */}
      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 12,
          background: "rgba(255,255,255,0.92)",
          borderTop: "1px solid rgba(0,0,0,0.10)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center" }}>
          <button
            onClick={backToCamera}
            style={{
              padding: "12px 18px",
              borderRadius: 999,
              background: "#111",
              color: "#fff",
              border: 0,
              fontWeight: 1000,
              cursor: "pointer",
              minWidth: 160,
            }}
          >
            撮影へ戻る
          </button>
        </div>
      </nav>
    </main>
  );
}