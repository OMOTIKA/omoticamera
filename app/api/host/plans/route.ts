import { NextResponse } from "next/server";

const PLANS = [
  { planId: "starter", label: "スターター", priceYen: 0, maxGuests: 10, maxShotsGuest: 20 },
  { planId: "basic", label: "ベーシック", priceYen: 2000, maxGuests: 25, maxShotsGuest: 20 },
  { planId: "premium", label: "プレミアム", priceYen: 8000, maxGuests: 100, maxShotsGuest: 20 },
  { planId: "elite", label: "エリート", priceYen: 20000, maxGuests: 250, maxShotsGuest: 20 },
  { planId: "business", label: "ビジネス / 法人向け", priceYen: 65000, maxGuests: 500, maxShotsGuest: 20 },
  // シークレット（通常非表示）→ キャンペーンコード一致時のみ返す
  { planId: "secret", label: "シークレット（キャンペーン）", priceYen: 0, maxGuests: 0, maxShotsGuest: 20 },
] as const;

type Plan = (typeof PLANS)[number];

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP").format(n);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // 通常は secret は返さない
    const code = (url.searchParams.get("code") || "").trim();
    const secretCode = (process.env.CAMPAIGN_CODE || "").trim();

    const includeSecret = !!secretCode && !!code && code === secretCode;

    const list: Plan[] = includeSecret
      ? (PLANS as unknown as Plan[])
      : (PLANS.filter((p) => p.planId !== "secret") as unknown as Plan[]);

    return NextResponse.json({
      ok: true,
      marker: "HOST_PLANS_V1_OK",
      uiVer: "HOST_PLANS_API_V1_20260210",
      includeSecret: includeSecret ? "1" : "0",
      plans: list.map((p) => ({
        ...p,
        priceLabel: p.priceYen === 0 ? "無料" : `¥${yen(p.priceYen)}`,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}