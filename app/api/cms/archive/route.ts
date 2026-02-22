import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api/cms";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventId = String(body?.eventId || "");
    const archived = body?.archived ? "1" : "0";

    const key = process.env.CMS_ADMIN_KEY || "";
    if (!key) return NextResponse.json({ ok: false, error: "missing_admin_key" });

    const url =
      `${API_BASE}/event_archive.php` +
      `?eventId=${encodeURIComponent(eventId)}` +
      `&archived=${encodeURIComponent(archived)}` +
      `&key=${encodeURIComponent(key)}` +
      `&v=${Date.now()}`;

    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    return NextResponse.json(j);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}