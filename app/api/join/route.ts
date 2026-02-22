import { NextResponse } from "next/server";

const API_BASE = "https://omotika.zombie.jp/omoticamera-api";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId") || "";
    const nickname = url.searchParams.get("nickname") || "";
    const v = url.searchParams.get("v") || String(Date.now());

    if (!eventId || !nickname) {
      return NextResponse.json(
        { ok: false, error: "missing_params", eventId, nickname },
        { status: 400 }
      );
    }

    // 本番APIへ（サーバ側fetchなのでCORS無関係）
    const upstream = `${API_BASE}/join.php?eventId=${encodeURIComponent(
      eventId
    )}&nickname=${encodeURIComponent(nickname)}&v=${encodeURIComponent(v)}`;

    const r = await fetch(upstream, {
      cache: "no-store",
      // join.php が GET 想定なので method は省略でもOK
    });

    const text = await r.text();

    // ここで JSON 以外が返る事故もあり得るので try/catch
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "bad_upstream_response", status: r.status, text },
        { status: 502 }
      );
    }

    return NextResponse.json(json, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "proxy_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}