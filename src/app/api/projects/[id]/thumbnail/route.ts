import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeId, projectDir } from "@/server/paths";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const id = assertSafeId((await ctx.params).id);
  try {
    const data = await fs.readFile(path.join(projectDir(id), "thumbnail.jpg"));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

/** Body: raw JPEG bytes captured by the editor. */
export async function PUT(request: Request, ctx: Ctx) {
  const id = assertSafeId((await ctx.params).id);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > 2_000_000) return Response.json({ error: "Thumbnail too large" }, { status: 413 });
  await fs.writeFile(path.join(projectDir(id), "thumbnail.jpg"), bytes);
  return Response.json({ ok: true });
}
