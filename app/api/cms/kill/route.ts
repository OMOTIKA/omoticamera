import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = process.env.CMS_API_BASE || "https://omotika.zombie.jp/omoticamera-api/cms";
const ADMIN_KEY = process.env.CMS_ADMIN_KEY || "";

type Body = { enabled: boolean; message?: string };

export async function POST(req: Request) {
  try {
    if (!ADMIN_KEY) {
      return NextResponse.json({ ok: false, error: "admin_key_missing" }, { status: 200 });
    }

    const body = (await req.json()) as Body;
    const enabled = body?.enabled ? "1" : "0";
    const message = (body?.message ?? "").toString();

    const url =
      `${BASE}/kill.php?` +
      `enabled=${encodeURIComponent(enabled)}` +
      `&message=${encodeURIComponent(message)}` +
      `&key=${encodeURIComponent(ADMIN_KEY)}` +
      `&v=${Date.now()}`;

    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    return NextResponse.json(j, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 200 });
  }
}