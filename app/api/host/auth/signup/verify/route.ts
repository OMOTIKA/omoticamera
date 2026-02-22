import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tmpToken = String(body?.tmpToken || "").trim();
    const otp = String(body?.otp || "").trim();

    const form = new URLSearchParams();
    form.set("tmpToken", tmpToken);
    form.set("otp", otp);

    const r = await fetch(`${API_BASE}/auth/host_signup_verify.php`, {
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