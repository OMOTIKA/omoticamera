import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function clampText(s: string, max: number) {
  const t = (s || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventName: string = (body.eventName || "").toString();
    const joinUrl: string = (body.joinUrl || "").toString();
    const qrPngDataUrl: string = (body.qrPngDataUrl || "").toString();

    if (!eventName || !joinUrl || !qrPngDataUrl) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    // 55x91mm
    const W = mmToPt(55);
    const H = mmToPt(91);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // ✅ 日本語フォント読み込み（public/fonts に置く）
    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansJP-Regular.ttf");
    if (!fs.existsSync(fontPath)) {
      return NextResponse.json(
        { ok: false, error: "font_not_found", hint: "public/fonts/NotoSansJP-Regular.ttf を配置してください" },
        { status: 500 }
      );
    }
    const fontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(fontBytes);

    // ✅ ロゴ読み込み（public/omotika_logo.png を使う）
    const logoPath = path.join(process.cwd(), "public", "omotika_logo.png");
    const logoPngBytes = fs.readFileSync(logoPath);
    const logoImg = await pdfDoc.embedPng(logoPngBytes);

    // ✅ QR PNG（クライアントから受け取ったdataURL）
    const base64 = qrPngDataUrl.split(",")[1];
    const qrBytes = Buffer.from(base64, "base64");
    const qrImg = await pdfDoc.embedPng(qrBytes);

    const page = pdfDoc.addPage([W, H]);

    // 背景
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

    // うす枠＆角丸風（pdf-libは角丸が弱いので“枠”で上品に）
    const pad = mmToPt(4.5);
    page.drawRectangle({
      x: pad,
      y: pad,
      width: W - pad * 2,
      height: H - pad * 2,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.7,
      color: rgb(1, 1, 1),
      opacity: 0.06,
      borderOpacity: 0.14,
    });

    // テキスト系
    const brand = "どこでもオモチカメラ";
    const title = "イベント名：";
    const ev = clampText(eventName, 18);
    const sub1 = "写真撮影に参加しよう";
    const sub2 = "アプリのダウンロード不要";
    const copy = "© OMOTIKA / どこでもオモチカメラ";

    // 上段ブランド（小さめ）
    page.drawText(brand, {
      x: pad + mmToPt(2),
      y: H - pad - mmToPt(6),
      size: 9.5,
      font,
      color: rgb(0, 0, 0),
      opacity: 0.75,
    });

    // イベント名：ラベル
    page.drawText(title, {
      x: pad + mmToPt(2),
      y: H - pad - mmToPt(13),
      size: 8.5,
      font,
      color: rgb(0, 0, 0),
      opacity: 0.65,
    });

    // イベント名（センター・大きめ）
    const evSize = 13.5;
    const evWidth = font.widthOfTextAtSize(ev, evSize);
    page.drawText(ev, {
      x: (W - evWidth) / 2,
      y: H - pad - mmToPt(20),
      size: evSize,
      font,
      color: rgb(0, 0, 0),
    });

    // QR配置（やや下へ／大きめ）
    const qrSize = mmToPt(34);
    const qrX = (W - qrSize) / 2;
    const qrY = mmToPt(33);

    // QRの“白枠”
    page.drawRectangle({
      x: qrX - mmToPt(1),
      y: qrY - mmToPt(1),
      width: qrSize + mmToPt(2),
      height: qrSize + mmToPt(2),
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.6,
      borderOpacity: 0.12,
      color: rgb(1, 1, 1),
    });

    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    // 参加文言
    const s1Size = 9.2;
    const s1W = font.widthOfTextAtSize(sub1, s1Size);
    page.drawText(sub1, {
      x: (W - s1W) / 2,
      y: mmToPt(27),
      size: s1Size,
      font,
      color: rgb(0, 0, 0),
      opacity: 0.86,
    });

    const s2Size = 8.2;
    const s2W = font.widthOfTextAtSize(sub2, s2Size);
    page.drawText(sub2, {
      x: (W - s2W) / 2,
      y: mmToPt(22),
      size: s2Size,
      font,
      color: rgb(0, 0, 0),
      opacity: 0.64,
    });

    // ロゴ（少し大きめ、崩れない）
    const logoH = mmToPt(6.8);
    const scale = logoH / logoImg.height;
    const logoW = logoImg.width * scale;

    page.drawImage(logoImg, {
      x: (W - logoW) / 2,
      y: mmToPt(13),
      width: logoW,
      height: logoH,
    });

    // コピーライト（最下段）
    const cSize = 7.2;
    const cW = font.widthOfTextAtSize(copy, cSize);
    page.drawText(copy, {
      x: (W - cW) / 2,
      y: mmToPt(7),
      size: cSize,
      font,
      color: rgb(0, 0, 0),
      opacity: 0.45,
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="omoticamera-card-55x91mm.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}