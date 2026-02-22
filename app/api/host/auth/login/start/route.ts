import { NextResponse } from "next/server";

const API = "http://omotika.zombie.jp/omoticamera-api/auth/host_login_start.php";

export async function POST(req: Request) {
  const body = await req.json();

  const form = new URLSearchParams();
  form.set("email", body.email || "");
  form.set("password", body.password || ""); // ✅ 追加

  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });

  // ✅ まず text で受けて、JSONでなければ原因を返す
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    return NextResponse.json(j);
  } catch {
    return NextResponse.json({
      ok: false,
      error: "upstream_non_json",
      status: r.status,
      bodyHead: text.slice(0, 200),
    });
  }
}