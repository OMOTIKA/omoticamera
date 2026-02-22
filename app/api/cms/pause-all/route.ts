import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = process.env.CMS_API_BASE || "https://omotika.zombie.jp/omoticamera-api/cms";
const ADMIN_KEY = process.env.CMS_ADMIN_KEY || "";

type Body = { action: "pause" | "resume"; reason?: string };

async function getEvents(): Promise<{ ok: boolean; events?: { eventId: string; metaPathExists: string }[] }> {
  const url = `${BASE}/dashboard.php?ping=1&withSizes=0&v=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as any;
}

export async function POST(req: Request) {
  try {
    if (!ADMIN_KEY) {
      return NextResponse.json({ ok: false, error: "admin_key_missing" }, { status: 200 });
    }

    const body = (await req.json()) as Body;
    const action = body?.action;
    const reason = (body?.reason ?? "").toString();

    if (action !== "pause" && action !== "resume") {
      return NextResponse.json({ ok: false, error: "bad_action" }, { status: 200 });
    }

    const dj = await getEvents();
    if (!dj?.ok || !Array.isArray(dj.events)) {
      return NextResponse.json({ ok: false, error: "dashboard_failed" }, { status: 200 });
    }

    // meta.json があるイベントだけ対象（ゴミdir除外）
    const targets = dj.events.filter((e: any) => e?.eventId && e?.metaPathExists === "YES");

    const results: any[] = [];
    for (const e of targets) {
      const url =
        `${BASE}/event_pause.php?` +
        `eventId=${encodeURIComponent(e.eventId)}` +
        `&action=${encodeURIComponent(action)}` +
        `&reason=${encodeURIComponent(reason)}` +
        `&key=${encodeURIComponent(ADMIN_KEY)}` +
        `&v=${Date.now()}`;

      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        results.push({ eventId: e.eventId, ok: !!j?.ok, marker: j?.marker, error: j?.error || "" });
      } catch {
        results.push({ eventId: e.eventId, ok: false, error: "fetch_failed" });
      }
    }

    const okAll = results.every((x) => x.ok);
    return NextResponse.json(
      { ok: okAll, marker: "CMS_PAUSE_ALL_V1_OK", action, count: results.length, results },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "unknown" }, { status: 200 });
  }
}