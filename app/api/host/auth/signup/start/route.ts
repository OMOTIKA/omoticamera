import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "bad_email" }, { status: 200 });
    }

    const form = new URLSearchParams();
    form.set("email", email);

    // ✅ サーバ側は cms/ ではなく auth/ に寄せる
    const r = await fetch(`${API_BASE}/auth/host_signup_start.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
      cache: "no-store",
    });

    const j = await r.json();
    return NextResponse.json(j, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 200 });
  }
}