"use client";

// UI_VER: ALBUM_UI_V4_20260205

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const UPLOADS_BASE = "https://omotika.zombie.jp/omoticamera-uploads";

type AlbumApi = {
  ok: boolean;
  marker?: string;
  eventId: string;
  eventName?: string;
  ended?: boolean;
  expired?: boolean;
  albumUrl?: string;
  albumExpiresAt?: number; // unix sec
  photos?: { id: string; createdAt: number }[];
  error?: string;
};

export default function AlbumPage() {
  const UI_VER = "ALBUM_UI_V4_20260205";
  const router = useRouter();

  const role = useMemo(() => {
    if (typeof window === "undefined") return "guest";
    return localStorage.getItem("omoticamera_role") || "guest";
  }, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [data, setData] = useState<AlbumApi | null>(null);

  useEffect(() => {
    const eventId = localStorage.getItem("omoticamera_eventId") || "";
    const hostKey = localStorage.getItem("omoticamera_hostKey") || "";

    if (!eventId) {
      setErr("イベント情報がありません");
      setLoading(false);
      return;
    }

    const qs = new URLSearchParams();
    qs.set("eventId", eventId);
    qs.set("v", String(Date.now())); // cache避け

    // 撮影期間中の閲覧許可（ホストのみ）
    if (role === "host" && hostKey) qs.set("hostKey", hostKey);

    fetch(`${API_BASE}/album.php?${qs.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: AlbumApi) => {
        if (!j?.ok) {
          setErr("通信エラー");
          setData(null);
          return;
        }
        j.photos = Array.isArray(j.photos) ? j.photos : [];
        j.eventName = (j.eventName || "").trim();
        setData(j);
      })
      .catch(() => {
        setErr("通信エラー");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [role]);

  // -------- helpers --------
  const eventName = data?.eventName ? data.eventName : "イベント名：未設定";
  const ended = !!data?.ended;
  const expired = !!data?.expired;

  const albumExpiresAt = Number(data?.albumExpiresAt || 0); // unix sec
  const remainText = useMemo(() => {
    if (!ended || expired) return "";
    if (!albumExpiresAt) return "残り：—";
    const nowSec = Math.floor(Date.now() / 1000);
    const diff = albumExpiresAt - nowSec;
    if (diff <= 0) return "残り：0日";
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days >= 1) return `残り：${days}日`;
    return `残り：${hours}時間`;
  }, [ended, expired, albumExpiresAt]);

  const photos = data?.photos || [];

  // 撮影期間中：ゲストは閲覧不可
  const canViewDuring = role === "host";
  const showWaiting = !ended && !canViewDuring;

  // ダウンロード可否
  const canDownload = ended && !expired;

  // ZIPはホストのみ
  const canZip = canDownload && role === "host";

  // ホストで撮影期間中は「閲覧のみ」→この一箇所だけで案内（重複排除）
  const subtitle = ended
    ? remainText
    : role === "host"
      ? "※撮影期間中は閲覧のみ（ダウンロード不可）"
      : "";

  const onBack = () => {
    if (role === "host") router.push("/host/guests");
    else router.push("/join");
  };

  // -------- views --------
  if (loading) {
    return (
      <main style={wrap}>
        <div style={card}>
          <Header
            title={eventName}
            rightPill="読み込み中…"
            onBack={onBack}
            subtitle=""
          />
          <div style={msg}>読み込み中…</div>
        </div>
        <Footer uiVer={UI_VER} />
      </main>
    );
  }

  if (err || !data) {
    return (
      <main style={wrap}>
        <div style={card}>
          <Header title="アルバム" rightPill="エラー" onBack={onBack} subtitle="" />
          <div style={msg}>{err || "通信エラー"}</div>
        </div>
        <Footer uiVer={UI_VER} />
      </main>
    );
  }

  // 期限切れ：画像非表示・DL不可
  if (expired) {
    return (
      <main style={wrap}>
        <div style={card}>
          <Header title={eventName} rightPill="期間終了" onBack={onBack} subtitle="" />
          <div style={msg}>閲覧期間は終了しました</div>
        </div>
        <Footer uiVer={UI_VER} />
      </main>
    );
  }

  // 撮影期間中：ゲストは待機（スマート文言）
  if (showWaiting) {
    return (
      <main style={wrap}>
        <div style={card}>
          <Header title={eventName} rightPill="撮影中" onBack={onBack} subtitle="" />
          <div style={msg}>
            イベント終了後に共有アルバムが公開されます。公開後は閲覧・ダウンロードできます。
          </div>
        </div>
        <Footer uiVer={UI_VER} />
      </main>
    );
  }

  // 表示OK（ホストは撮影中も閲覧OK / 終了後は全員閲覧OK）
  const statePill = ended ? "閲覧中" : "撮影中（閲覧のみ）";

  return (
    <main style={wrap}>
      <div style={card}>
        <Header title={eventName} rightPill={statePill} onBack={onBack} subtitle={subtitle} />

        {/* 操作列（ZIPのみ：ホスト＆終了後） */}
        <div style={actionsRow}>
          {canZip && (
            <a
              href={`${API_BASE}/zip.php?eventId=${encodeURIComponent(data.eventId)}&v=${Date.now()}`}
              style={primaryBtn}
            >
              まとめてダウンロード（ZIP）
            </a>
          )}
        </div>

        {/* 0枚 */}
        {photos.length === 0 && <div style={msg}>写真がまだありません</div>}

        {/* 2列・詰めグリッド */}
        {photos.length > 0 && (
          <div style={masonry}>
            {photos.map((p) => {
              const imgUrl = `${UPLOADS_BASE}/event-${data.eventId}/${p.id}`;
              return (
                <div key={p.id} style={tile}>
                  <img
                    src={`${imgUrl}?v=${p.createdAt || 0}`}
                    loading="lazy"
                    decoding="async"
                    style={img}
                    alt=""
                  />

                  {/* 個別DL：終了後のみ（ゲストはこれだけ） */}
                  {canDownload && (
                    <a href={imgUrl} download style={dlBtn}>
                      DL
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer uiVer={UI_VER} />
    </main>
  );
}

// -------------------------
// parts
// -------------------------
function Header({
  title,
  rightPill,
  onBack,
  subtitle,
}: {
  title: string;
  rightPill: string;
  onBack: () => void;
  subtitle: string;
}) {
  return (
    <div style={headerWrap}>
      <div style={headerTop}>
        <button onClick={onBack} style={backBtn}>
          戻る
        </button>

        <span style={pill}>{rightPill}</span>
      </div>

      <div style={titleRow}>
        <div style={titleStyle} title={title}>
          {title}
        </div>
      </div>

      {!!subtitle && <div style={sub}>{subtitle}</div>}
    </div>
  );
}

// -------------------------
// styles（スマホ優先・軽量）
// -------------------------
const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f6f6",
  padding: 8,
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 10,
  maxWidth: 900,
  margin: "0 auto",
};

const headerWrap: React.CSSProperties = {
  marginBottom: 8,
};

const headerTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
};

const backBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "6px 10px",
  borderRadius: 999,
  background: "#111",
  color: "#fff",
  whiteSpace: "nowrap",
};

const titleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sub: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#666",
};

const msg: React.CSSProperties = {
  fontSize: 13,
  color: "#333",
  padding: "6px 2px 2px",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  margin: "8px 0 10px",
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  textAlign: "center",
  padding: "12px 12px",
  borderRadius: 999,
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  fontSize: 13,
};

const masonry: React.CSSProperties = {
  columnCount: 2,
  columnGap: 4,
};

const tile: React.CSSProperties = {
  breakInside: "avoid",
  marginBottom: 4,
  position: "relative",
  borderRadius: 10,
  overflow: "hidden",
  background: "#eee",
};

const img: React.CSSProperties = {
  width: "100%",
  height: "auto",
  display: "block",
};

const dlBtn: React.CSSProperties = {
  position: "absolute",
  right: 6,
  bottom: 6,
  fontSize: 11,
  background: "rgba(0,0,0,0.78)",
  color: "#fff",
  padding: "4px 10px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 900,
};