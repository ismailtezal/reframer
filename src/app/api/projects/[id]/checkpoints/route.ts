import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeId, checkpointsDir } from "@/server/paths";

export const dynamic = "force-dynamic";

/** Keep the newest N restore points per project. */
const KEEP = 60;

/**
 * Restore points: a snapshot of the project taken right before each message
 * you send to an agent, so any turn can be rolled back in one click.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/checkpoints">) {
  const { id } = await ctx.params;
  const projectId = assertSafeId(id);
  const body = (await request.json()) as { id: string; project: unknown };
  const checkpointId = assertSafeId(body.id);
  const dir = checkpointsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${checkpointId}.json`), JSON.stringify({ at: Date.now(), project: body.project }), "utf8");
  // Prune the oldest.
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  if (files.length > KEEP) {
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(dir, f))).mtimeMs })));
    stats.sort((a, b) => a.t - b.t);
    await Promise.all(stats.slice(0, files.length - KEEP).map((s) => fs.rm(path.join(dir, s.f), { force: true })));
  }
  return Response.json({ ok: true });
}

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/checkpoints">) {
  const { id } = await ctx.params;
  const projectId = assertSafeId(id);
  const checkpointId = new URL(request.url).searchParams.get("checkpointId");
  if (!checkpointId) {
    const dir = checkpointsDir(projectId);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    return Response.json({ checkpoints: files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)) });
  }
  try {
    const raw = await fs.readFile(path.join(checkpointsDir(projectId), `${assertSafeId(checkpointId)}.json`), "utf8");
    return new Response(raw, { headers: { "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "Restore point not found" }, { status: 404 });
  }
}
