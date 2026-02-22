"use client";

// UI_VER: HOST_PHOTOS_UI_V3_WITH_PENDING_20260220

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import { listPending } from "../../lib/db";

type PhotoItem = {
  id: string;
  url: string;
  createdAt?: number;
  nickname?: string;
  _pending?: boolean;
};

const API_BASE_DEFAULT = "https://omotika.zombie.jp/omoticamera-api";

function pickPhotos(j: any): PhotoItem[] {
  const cand = j?.photos ?? j?.data ?? j?.items ?? [];
  return Array.isArray(cand) ? (cand as PhotoItem[]) : [];
}

function isSvg(url: string) {
  return /\.svg(\?|$)/i.test(url);
}

export default function HostPhotosPage() {
  const UI_VER = "HOST_PHOTOS_UI_V3_WITH_PENDING_20260220";
  const router = useRouter();

  const [serverItems, setServerItems] = useState<PhotoItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const pendingObjectUrlsRef = useRef<string[]>([]);

  const API_BASE = process.env.NEXT_PUBLIC_OMOTICAMERA_API_BASE || API_BASE_DEFAULT;

  const eventId =
    typeof window !== "undefined"
      ? (localStorage.getItem("omoticamera_eventId") || "").trim()
      : "";

  // ----------------------------
  // pending読み込み
  // ----------------------------
  const loadPending = async () => {
    pendingObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    pendingObjectUrlsRef.current = [];

    const pend = await listPending();
    const mapped = pend.map((p) => {
      const url = URL.createObjectURL(p.blob);
      pendingObjectUrlsRef.current.push(url);
      return {
        id: p.id,
        url,
        createdAt: p.createdAt,
        nickname: p.nickname,
        _pending: true,
      };
    });

    setPendingItems(mapped);
  };

  // ----------------------------
  // server読み込み
  // ----------------------------
  const loadServer = async () => {
    if (!eventId) return;

    const url = `${API_BASE}/list.php?eventId=${encodeURIComponent(
      eventId
    )}&t=${Date.now()}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      const j = JSON.parse(text);
      setServerItems(pickPhotos(j));
    } catch {
      setServerItems([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadServer(), loadPending()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    return () => {
      pendingObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line
  }, []);

  // ----------------------------
  // 混ぜる（pending + server）
  // ----------------------------
  const allItems = useMemo(() => {
    const merged = [...pendingItems, ...serverItems];
    return merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [pendingItems, serverItems]);

  return (
    <main style={wrap}>
      <div style={header}>
        <div style={{ fontWeight: 900 }}>写真一覧（ホスト）</div>
        <button onClick={loadAll} style={btnReload}>
          更新
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20 }}>読み込み中…</div>
      ) : (
        <div style={grid}>
          {allItems.map((p) => (
            <div key={p.id} style={card}>
              <div style={thumbWrap}>
                {isSvg(p.url) ? (
                  <object data={p.url} type="image/svg+xml" style={thumbImg} />
                ) : (
                  <img src={p.url} alt="" style={thumbImg} />
                )}

                {/* 🔴 未送信バッジ（18px） */}
                {p._pending && (
                  <img
                    src="/Unsent.png"
                    alt=""
                    style={unsentBadge}
                  />
                )}
              </div>

              <div style={{ fontSize: 11, marginTop: 6 }}>
                {p.nickname ? <strong>{p.nickname} ・ </strong> : null}
                {p.id}
              </div>
            </div>
          ))}
        </div>
      )}

      <Footer uiVer={UI_VER} />
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fff",
};

const header: React.CSSProperties = {
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const btnReload: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "#fff",
  fontWeight: 900,
};

const grid: React.CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
};

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const thumbWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 12,
  overflow: "hidden",
  background: "#f2f2f2",
};

const thumbImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const unsentBadge: React.CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  width: 18,   // ← Bサイズ確定
  height: 18,
  pointerEvents: "none",
};