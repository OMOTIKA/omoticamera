import { store } from "../_store";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const nickname = String(form.get("nickname") || "guest");
    const id = String(form.get("id") || crypto.randomUUID());
    const createdAt = Number(form.get("createdAt") || Date.now());

    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "file is required" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const dataBase64 = buf.toString("base64");

    const record = {
      id,
      createdAt,
      nickname,
      mime,
      dataBase64,
      isPublic: false,
      uploadedAt: Date.now(),
    };

    const idx = store.photos.findIndex((p) => p.id === id);
    if (idx >= 0) store.photos[idx] = record;
    else store.photos.push(record);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "upload failed" }, { status: 500 });
  }
}
