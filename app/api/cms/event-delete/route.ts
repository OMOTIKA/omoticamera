import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const ADMIN_KEY = process.env.CMS_ADMIN_KEY || "";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      eventId?: string;
      mode?: "trash" | "purge";
    };

    const eventId = (body.eventId || "").trim();
    const mode = (body.mode || "trash").trim();

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "missing_params", need: "eventId" },
        { status: 400 }
      );
    }

    if (mode !== "trash" && mode !== "purge") {
      return NextResponse.json(
        { ok: false, error: "bad_mode", mode },
        { status: 400 }
      );
    }

    if (!ADMIN_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_admin_key_missing" },
        { status: 500 }
      );
    }

    // ✅ サーバAPIが要求している必須パラメータをここで全部付与
    const qs = new URLSearchParams();
    qs.set("eventId", eventId);
    qs.set("mode", mode);
    qs.set("confirm", "1");          // ← ★これが missing_params の原因だった
    qs.set("key", ADMIN_KEY);

    const r = await fetch(`${API_BASE}/cms/event_delete.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: qs.toString(),
      cache: "no-store",
    });

    const j = await r.json();

    return NextResponse.json(j, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "failed", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}