// app/lib/uploader.ts
"use client";

import { listPending, markSent } from "./db";

const API_BASE =
  process.env.NEXT_PUBLIC_OMOTICAMERA_API_BASE ||
  "https://omotika.zombie.jp/omoticamera-api"; // ✅ http → https に固定

function getEventId(): string {
  return localStorage.getItem("omoticamera_eventId") || "";
}

function getRole(): "host" | "guest" {
  const r = localStorage.getItem("omoticamera_role");
  return r === "host" ? "host" : "guest";
}

function getNickname(): string {
  const role = getRole();
  if (role === "host") {
    return (
      localStorage.getItem("omoticamera_hostNickname") ||
      localStorage.getItem("omoticamera_nickname") ||
      "host"
    );
  }
  return localStorage.getItem("omoticamera_nickname") || "guest";
}

function getHostKey(): string {
  return localStorage.getItem("omoticamera_hostKey") || "";
}

function guessExt(pendingId: string, mime: string): string {
  const m = pendingId.match(/\.(png|jpg|jpeg|webp|svg)$/i);
  if (m) return m[1].toLowerCase();

  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("svg")) return "svg";

  return "svg";
}

async function postUpload(params: {
  eventId: string;
  id: string;
  blob: Blob;
  nickname: string;
  role: "host" | "guest";
  createdAt: number;
  hostKey?: string;
}) {
  const fd = new FormData();

  fd.append("eventId", params.eventId);
  fd.append("id", params.id);
  fd.append("nickname", params.nickname);
  fd.append("role", params.role);
  fd.append("createdAt", String(params.createdAt));

  if (params.hostKey) fd.append("hostKey", params.hostKey);

  const ext = guessExt(params.id, params.blob.type || "");
  const filename = `${params.id}.${ext}`.replace(/\.{2,}/g, ".");
  fd.append("file", params.blob, filename);

  const res = await fetch(`${API_BASE}/upload.php`, {
    method: "POST",
    body: fd,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`upload response not json. status=${res.status} body=${text}`);
  }
  if (!json?.ok) {
    throw new Error(`upload json not ok. body: ${text}`);
  }
  return json;
}

/**
 * 送信待ちを自動送信する
 */
export async function tryAutoSend(): Promise<{ sent: number; failed: number }> {
  const eventId = getEventId();
  if (!eventId) {
    console.warn("[AUTO_SEND] no eventId, keep pending");
    return { sent: 0, failed: 0 };
  }

  const role = getRole();
  const nickname = getNickname();
  const hostKey = role === "host" ? getHostKey() : "";

  const all = await listPending();
  if (all.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const p of all) {
    try {
      const result = await postUpload({
        eventId,
        id: p.id,
        blob: p.blob,
        nickname: p.nickname || nickname,
        role,
        createdAt: p.createdAt,
        hostKey,
      });

      await markSent(p.id);
      sent++;

      console.log("[AUTO_SEND] sent:", p.id, "eventId=", eventId, "url=", result?.url);
    } catch (e) {
      failed++;
      console.log("[AUTO_SEND] send failed, keep pending:", p.id, e);
    }
  }

  return { sent, failed };
}