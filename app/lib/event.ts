export type EventConfig = {
  eventId: string;          // イベントID（フォルダ名など）
  hostKey: string;          // 管理用キー（APIで削除などの認証に使う）
  eventName: string;

  // イベント期間（ISO文字列）
  startAt: string;          // 例: 2026-01-30T12:18
  endAt: string;            // 例: 2026-01-30T12:22

  // プラン（イベント単位）
  planId: "starter" | "basic" | "premium" | "elite" | "business" | "secret";
  priceYen: number;

  // 条件（将来のシークレットもここに乗る）
  guestMaxPeople: number;   // ゲスト人数上限
  guestMaxShots: number;    // ゲスト1人あたり撮影枚数
  hostMaxShots: number;     // ホスト撮影枚数

  storageDays: number;      // 保存期間（日）
  oneEventOnly: boolean;    // 基本 true（スターターも「イベント単位」だが無料で何度でも作れる）
};

const KEY = "omoticamera_eventConfig";

export function getEventConfig(): EventConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EventConfig) : null;
  } catch {
    return null;
  }
}

export function setEventConfig(cfg: EventConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}