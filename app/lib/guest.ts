export function getGuestKey(): string {
  return localStorage.getItem("omoticamera_guestKey") || "";
}

export async function touchGuest(eventId: string, guestKey: string) {
  if (!eventId || !guestKey) return;

  const url =
    `https://omotika.zombie.jp/omoticamera-api/touch_guest.php` +
    `?eventId=${encodeURIComponent(eventId)}` +
    `&guestKey=${encodeURIComponent(guestKey)}` +
    `&v=${Date.now()}`;

  try {
    await fetch(url, { cache: "no-store" });
  } catch {
    // 通信が弱いときは黙ってOK（次の周期で更新される）
  }
}