import { NextResponse } from "next/server";

const API = "http://omotika.zombie.jp/omoticamera-api/auth/host_login_verify.php";

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const form = new URLSearchParams();
    form.set("tmpToken", body?.tmpToken || "");
    form.set("otp", body?.otp || "");

    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    const text = await r.text();
    const j = safeJsonParse(text);

    // 上流が落ちて空レス/HTML等でも、Next側はJSONで返してフロントを詰まらせない
    if (!j) {
      return NextResponse.json(
        {
          ok: false,
          error: "upstream_non_json",
          status: r.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(j);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "verify_route_failed", message: String(e?.message || e || "failed") },
      { status: 500 }
    );
  }
}