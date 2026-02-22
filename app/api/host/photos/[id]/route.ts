import { store } from "../../../_store";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const isPublic = !!body.isPublic;

  const p = store.photos.find((x) => x.id === id);
  if (!p) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  p.isPublic = isPublic;
  return Response.json({ ok: true });
}
