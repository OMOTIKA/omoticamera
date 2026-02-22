import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !email.includes("@") || !password) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 200 });
    }

    // ✅ ここは “ホスト用” のログインAPIをサーバに用意したら差し替える
    // いったん固定： /auth/host_login.php を叩く前提にする
    const form = new URLSearchParams();
    form.set("email", email);
    form.set("password", password);

    const r = await fetch(`${API_BASE}/auth/host_login.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
      cache: "no-store",
    });

    const text = await r.text();
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: "bad_upstream_response", text }, { status: 200 });
    }

    return NextResponse.json(j, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 200 });
  }
}