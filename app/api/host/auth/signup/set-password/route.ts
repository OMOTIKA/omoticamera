import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const signupToken = String(body?.signupToken ?? "").trim();
    const password = String(body?.password ?? "");

    if (!signupToken || !password) {
      return NextResponse.json(
        { ok: false, error: "missing_params", need: "signupToken + password" },
        { status: 200 }
      );
    }

    const form = new URLSearchParams();
    form.set("signupToken", signupToken);
    form.set("password", password);

    const r = await fetch(`${API_BASE}/auth/host_signup_set_password.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
      cache: "no-store",
    });

    const text = await r.text();
    let j: any = null;
    try {
      j = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "server_not_json", status: r.status, bodyHead: text.slice(0, 200) },
        { status: 200 }
      );
    }

    return NextResponse.json(j, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "failed", message: String(e?.message || e) },
      { status: 200 }
    );
  }
}