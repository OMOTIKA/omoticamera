import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ✅ /?event=xxxx は必ず /join?event=xxxx へ
  if (pathname === "/" && searchParams.has("event")) {
    const event = searchParams.get("event") || "";
    const url = req.nextUrl.clone();
    url.pathname = "/join";
    url.search = `?event=${encodeURIComponent(event)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/"] };