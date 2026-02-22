import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";
const ADMIN_KEY = process.env.CMS_ADMIN_KEY || "";

export async function POST() {
  if (!ADMIN_KEY) {
    return NextResponse.json({ ok:false, error:"server_admin_key_missing" },{status:500});
  }

  const qs = new URLSearchParams();
  qs.set("key", ADMIN_KEY);

  const r = await fetch(`${API_BASE}/cms/event_sweep_invalid.php`,{
    method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body: qs.toString(),
    cache:"no-store"
  });

  const j = await r.json();
  return NextResponse.json(j);
}