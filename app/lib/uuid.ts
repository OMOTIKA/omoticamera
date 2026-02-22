// app/lib/uuid.ts
"use client";

export function uuidv4(): string {
  // ✅ 1) 使えるならネイティブ（速い）
  const c: any = globalThis.crypto as any;
  if (c?.randomUUID) return c.randomUUID();

  // ✅ 2) Safari / http / 古い環境でも動くフォールバック（RFC4122 v4）
  // crypto.getRandomValues は http でも動くことが多い
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);

    // RFC 4122 version/variant
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  // ✅ 3) 最後の最後（超保険）
  const r = () => Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `${r().slice(0, 8)}-${r().slice(0, 4)}-4${r().slice(0, 3)}-8${r().slice(0, 3)}-${r()}${r().slice(0, 4)}`;
}