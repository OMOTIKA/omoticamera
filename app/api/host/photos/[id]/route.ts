import { store } from "../../../_store";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => ({} as any));
  const isPublic = !!(body as any).isPublic;

  const p = store.photos.find((x) => x.id === id);
  if (!p) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  p.isPublic = isPublic;
  return Response.json({ ok: true });
}