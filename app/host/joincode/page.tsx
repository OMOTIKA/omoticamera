"use client";

// UI_VER: HOST_JOINCODE_UI_V1_20260206

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

type IssueJoinResp = {
  ok: boolean;
  marker?: string;
  joinCode?: string;
  expiresAt?: number;
  ttlMin?: number;
  error?: string;
};

export default function HostJoinCodePage() {
  const UI_VER = "HOST_JOINCODE_UI_V1_20260206";
  const router = useRouter();

  const [eventId, setEventId] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [status, setStatus] = useState<string>("");
  const [issuing, setIssuing] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    if (!joinCode) return "";
    const base = window.location.origin; // ←今開いているドメインでURLを作るのが超重要
    return `${base}/join?code=${encodeURIComponent(joinCode)}`;
  }, [joinCode]);

  useEffect(() => {
    const eid = localStorage.getItem("omoticamera_eventId") || "";
    const hk = localStorage.getItem("omoticamera_hostKey") || "";
    setEventId(eid);
    setHostKey(hk);

    if (!eid || !hk) {
      setStatus("イベント情報がありません。/host/login から入り直してください。");
    }
  }, []);

  const issueJoinCode = async () => {
    if (!eventId || !hostKey) {
      setStatus("eventId/hostKey がありません。/host/login から入り直してください。");
      return;
    }
    setIssuing(true);
    setStatus("");
    setCopied(false);

    try {
      const qs = new URLSearchParams({
        eventId,
        hostKey,
        v: String(Date.now()),
      });

      const res = await fetch(`${API_BASE}/issue_join.php?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as IssueJoinResp;

      if (!json?.ok || !json.joinCode) {
        setStatus(`発行失敗：${json?.error || "api_error"}`);
        return;
      }

      setJoinCode(json.joinCode);
      setExpiresAt(json.expiresAt || 0);

      // ついでにコピー（成功体験を短く）
      try {
        await navigator.clipboard.writeText(
          `参加URL：${window.location.origin}/join?code=${json.joinCode}`
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        // clipboard不可は無視
      }
    } catch {
      setStatus("発行失敗（通信）");
    } finally {
      setIssuing(false);
    }
  };

  const copyUrl = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // クリップボード不可は無視
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        padding: 10,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
            参加コード発行（ホスト用）
          </div>

          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            ※スマホで参加できない時の救済用。発行したコードはワンタイム/15分想定。
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={issueJoinCode}
              disabled={issuing || !eventId || !hostKey}
              style={{
                padding: "14px",
                borderRadius: 999,
                border: 0,
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                fontSize: 15,
                opacity: issuing || !eventId || !hostKey ? 0.6 : 1,
              }}
            >
              {issuing ? "発行中…" : "参加コードを発行"}
            </button>

            {joinCode && (
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 12, color: "#666" }}>参加コード</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>
                  {joinCode}
                </div>

                {expiresAt ? (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    期限：{new Date(expiresAt * 1000).toLocaleString()}
                  </div>
                ) : null}

                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <a
                    href={joinUrl}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "12px",
                      borderRadius: 999,
                      background: "#111",
                      color: "#fff",
                      textDecoration: "none",
                      fontWeight: 900,
                    }}
                  >
                    参加URLを開く（同一ドメイン）
                  </a>

                  <button
                    onClick={copyUrl}
                    style={{
                      padding: "12px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#fff",
                      fontWeight: 900,
                    }}
                  >
                    {copied ? "コピーしました" : "参加URLをコピー"}
                  </button>
                </div>
              </div>
            )}

            {status && (
              <div style={{ fontSize: 13, color: "#b00020", fontWeight: 800 }}>
                {status}
              </div>
            )}

            <button
              onClick={() => router.push("/host/guests")}
              style={{
                padding: "12px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 900,
              }}
            >
              参加者一覧に戻る
            </button>

            <div style={{ marginTop: 6, fontSize: 10, opacity: 0.35 }}>
              UI_VER: {UI_VER}
            </div>
          </div>
        </div>

        <Footer uiVer={UI_VER} />
      </div>
    </main>
  );
}