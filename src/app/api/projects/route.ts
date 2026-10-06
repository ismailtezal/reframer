import { createProject } from "@/core/defaults";
import type { Project } from "@/core/schema";
import { listProjects, writeProject } from "@/server/projects";

export async function GET() {
  return Response.json({ projects: await listProjects() });
}

type CreateBody = {
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  /** A full project (templates, imports). Its id is replaced. */
  project?: Project;
  prompt?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const base = createProject({ name: body.name, width: body.width, height: body.height, fps: body.fps });
  const project: Project = body.project
    ? { ...body.project, id: base.id, createdAt: base.createdAt, updatedAt: base.updatedAt, name: body.name ?? body.project.name }
    : base;
  if (body.prompt) project.brief = { prompt: body.prompt, storyboard: project.brief?.storyboard };
  await writeProject(project);
  return Response.json({ project }, { status: 201 });
}
