import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

// サーバ環境変数（.env.local など）
const ADMIN_KEY = process.env.CMS_ADMIN_KEY || "";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      eventId?: string;
      action?: "pause" | "resume";
      reason?: string;
    };

    const eventId = (body.eventId || "").trim();
    const action = body.action;
    const reason = (body.reason || "").trim();

    if (!eventId || !action) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }
    if (!ADMIN_KEY) {
      return NextResponse.json({ ok: false, error: "server_admin_key_missing" }, { status: 500 });
    }

    const qs = new URLSearchParams();
    qs.set("eventId", eventId);
    qs.set("action", action);
    qs.set("reason", reason);
    qs.set("key", ADMIN_KEY);

    const r = await fetch(`${API_BASE}/cms/event_pause.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: qs.toString(),
      cache: "no-store",
    });

    const j = await r.json();
    return NextResponse.json(j, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}