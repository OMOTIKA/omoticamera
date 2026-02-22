export type OmochiPlan = {
  guestMaxShots: number;     // ゲスト1人あたり撮影上限
  hostMaxShots: number;      // ホスト撮影上限
  guestMaxPeople: number;    // ゲスト人数上限（今は表示/説明用）
  storageDays: number;       // 保存日数（今は表示用）
};

const KEY = "omoticamera_plan";

export const DEFAULT_PLAN: OmochiPlan = {
  guestMaxShots: 20,
  hostMaxShots: 100,
  guestMaxPeople: 10,
  storageDays: 15,
};

// 数値が壊れても落ちないようにする
function safeInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

export function getPlan(): OmochiPlan {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PLAN;
    const obj = JSON.parse(raw);

    return {
      guestMaxShots: safeInt(obj.guestMaxShots, DEFAULT_PLAN.guestMaxShots, 1, 200),
      hostMaxShots: safeInt(obj.hostMaxShots, DEFAULT_PLAN.hostMaxShots, 1, 1000),
      guestMaxPeople: safeInt(obj.guestMaxPeople, DEFAULT_PLAN.guestMaxPeople, 1, 5000),
      storageDays: safeInt(obj.storageDays, DEFAULT_PLAN.storageDays, 1, 365),
    };
  } catch {
    return DEFAULT_PLAN;
  }
}

export function setPlan(plan: Partial<OmochiPlan>) {
  const cur = getPlan();
  const next: OmochiPlan = { ...cur, ...plan };
  localStorage.setItem(KEY, JSON.stringify(next));
}