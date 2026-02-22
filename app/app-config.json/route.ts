import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function GET() {
  try {
    const r = await fetch(`${API_BASE}/cms/app_config.php?public=1`, {
      cache: "no-store",
    });
    const j = await r.json();

    if (!j?.ok) {
      return NextResponse.json(
        {
          uiVer: "APP_CONFIG_FALLBACK_V1",
          ad: { enabled: true, label: "Supported by", placeholder: "ここに広告が入ります", logoUrl: "", linkUrl: "" },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(j.config ?? {}, { status: 200 });
  } catch {
    // 画面を壊さないfallback
    return NextResponse.json(
      {
        uiVer: "APP_CONFIG_FALLBACK_V1",
        ad: { enabled: true, label: "Supported by", placeholder: "ここに広告が入ります", logoUrl: "", linkUrl: "" },
      },
      { status: 200 }
    );
  }
}