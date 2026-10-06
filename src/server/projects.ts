import "server-only";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { type Project, ProjectSchema } from "@/core/schema";
import { PROJECTS_DIR, projectDir, projectFile, TRASH_DIR } from "./paths";

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  clipCount: number;
  thumbnail?: string;
};

const writeAtomic = async (file: string, data: string) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, file);
};

export const readProject = async (id: string): Promise<Project | null> => {
  try {
    const raw = await fs.readFile(projectFile(id), "utf8");
    return JSON.parse(raw) as Project;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
};

export const writeProject = async (project: Project) => {
  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    // Save anyway (never lose user work) but surface the problem in logs.
    console.warn(`[reframer] project ${project.id} failed validation:`, parsed.error.issues.slice(0, 3));
  }
  await writeAtomic(projectFile(project.id), JSON.stringify(project));
};

const summarize = (p: Project, thumbnail?: string): ProjectSummary => {
  let end = 0;
  for (const c of Object.values(p.clips)) end = Math.max(end, c.start + c.duration);
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    width: p.settings.width,
    height: p.settings.height,
    fps: p.settings.fps,
    durationSec: Math.round(((p.settings.durationInFrames ?? end) / p.settings.fps) * 10) / 10,
    clipCount: Object.keys(p.clips).length,
    thumbnail,
  };
};

export const listProjects = async (): Promise<ProjectSummary[]> => {
  if (!existsSync(PROJECTS_DIR)) return [];
  const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const out: ProjectSummary[] = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    try {
      const project = await readProject(d.name);
      if (!project) continue;
      const thumbPath = path.join(projectDir(d.name), "thumbnail.jpg");
      const thumbnail = existsSync(thumbPath) ? `/api/projects/${d.name}/thumbnail?v=${project.updatedAt}` : undefined;
      out.push(summarize(project, thumbnail));
    } catch (err) {
      console.warn(`[reframer] could not read project ${d.name}`, err);
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
};

/** Moves a project to `.reframer/trash` instead of deleting it. */
export const trashProject = async (id: string) => {
  await fs.mkdir(TRASH_DIR, { recursive: true });
  const target = path.join(TRASH_DIR, `${id}-${Date.now()}`);
  await fs.rename(projectDir(id), target);
};
