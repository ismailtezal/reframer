import type { Project } from "@/core/schema";
import { assertSafeId } from "@/server/paths";
import { readProject, trashProject, writeProject } from "@/server/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const id = assertSafeId((await ctx.params).id);
  const project = await readProject(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json({ project });
}

export async function PUT(request: Request, ctx: Ctx) {
  const id = assertSafeId((await ctx.params).id);
  const body = (await request.json()) as { project: Project };
  if (!body.project || body.project.id !== id) {
    return Response.json({ error: "Project id mismatch" }, { status: 400 });
  }
  await writeProject(body.project);
  return Response.json({ ok: true, savedAt: Date.now() });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = assertSafeId((await ctx.params).id);
  await trashProject(id);
  return Response.json({ ok: true });
}
