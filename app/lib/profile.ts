export type GuestProfile = {
  eventId: string;
  code: string;
  nickname: string;
  guestId: string;
  updatedAt?: number;
};

function apiBase() {
  // 既に .env.local で使っている想定（無ければあなたのAPIに差し替えOK）
  // 例: NEXT_PUBLIC_OMOTICAMERA_API_BASE="http://omotika.zombie.jp/omoticamera-api"
  return process.env.NEXT_PUBLIC_OMOTICAMERA_API_BASE || "http://omotika.zombie.jp/omoticamera-api";
}

// 復帰コード：見せる用に短く＆打ちやすく（英数字のみ）
export function createResumeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O/1/Iを避ける
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `RC-${s}`; // 例: RC-ABCD2345
}

export async function saveProfile(p: GuestProfile) {
  const res = await fetch(`${apiBase()}/profile_save.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  const j = await res.json().catch(() => null);
  if (!j?.ok) {
    throw new Error(`profile_save not ok: ${JSON.stringify(j)}`);
  }
  return j;
}

export async function getProfile(eventId: string, code: string): Promise<GuestProfile> {
  const url = `${apiBase()}/profile_get.php?eventId=${encodeURIComponent(eventId)}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const j = await res.json().catch(() => null);
  if (!j?.ok) {
    throw new Error(`profile_get not ok: ${JSON.stringify(j)}`);
  }
  return j.profile as GuestProfile;
}