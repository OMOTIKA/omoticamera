import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const ADMIN_KEY = process.env.CMS_ADMIN_KEY || "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const enabled = !!body.enabled;
    const label = String(body.label ?? "");
    const placeholder = String(body.placeholder ?? "");
    const logoUrl = String(body.logoUrl ?? "");
    const linkUrl = String(body.linkUrl ?? "");

    if (!ADMIN_KEY) {
      return NextResponse.json({ ok: false, error: "server_admin_key_missing" }, { status: 500 });
    }

    const qs = new URLSearchParams();
    qs.set("key", ADMIN_KEY);
    qs.set("enabled", enabled ? "1" : "0");
    qs.set("label", label);
    qs.set("placeholder", placeholder);
    qs.set("logoUrl", logoUrl);
    qs.set("linkUrl", linkUrl);

    const r = await fetch(`${API_BASE}/cms/app_config.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: qs.toString(),
      cache: "no-store",
    });

    const j = await r.json();
    return NextResponse.json(j);
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}