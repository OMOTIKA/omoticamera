import { store } from "../../_store";

export async function GET() {
  const photos = [...store.photos].sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ ok: true, photos });
}
