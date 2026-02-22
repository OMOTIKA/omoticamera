import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = process.env.CMS_API_BASE || "https://omotika.zombie.jp/omoticamera-api/cms";

export async function GET() {
  try {
    // いったんUI先行のため ping=1 で読む（認証UIを後で繋ぐ）
    const url = `${BASE}/dashboard.php?ping=1&withSizes=1&v=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    return NextResponse.json(j, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 200 });
  }
}