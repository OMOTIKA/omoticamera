import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      purpose?: string; // "host_signup" など（ログ用）
    };

    const email = (body.email || "").trim();
    const purpose = (body.purpose || "host_signup").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    const qs = new URLSearchParams();
    qs.set("email", email);
    qs.set("purpose", purpose);

    const r = await fetch(`${API_BASE}/auth_otp_send.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: qs.toString(),
      cache: "no-store",
    });

    const text = await r.text();
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: "server_not_json", raw: text }, { status: 502 });
    }

    return NextResponse.json(j, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}