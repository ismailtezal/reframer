import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "@/core/schema";
import { DATA_DIR, projectDir, projectFile } from "@/server/paths";
import { listProjects, readProject, writeProject } from "@/server/projects";
import { notFound, usage } from "./errors";

/** What every command gets: where the user is, where the app is, and how to talk back. */
export type CliContext = {
  /** The directory the command was run from (user paths resolve against it). */
  cwd: string;
  /** The Reframer app checkout the CLI runs from. */
  appRoot: string;
  dataDir: string;
  quiet: boolean;
  /** Progress for people, on stderr (stdout carries only the JSON result). */
  log: (message: string) => void;
  /** A user-supplied path, resolved against where the command was run. */
  resolvePath: (p: string) => string;
};

export const createContext = (opts: { cwd: string; appRoot: string; quiet: boolean }): CliContext => ({
  cwd: opts.cwd,
  appRoot: opts.appRoot,
  dataDir: DATA_DIR,
  quiet: opts.quiet,
  log: (message) => {
    if (!opts.quiet) process.stderr.write(`${message}\n`);
  },
  resolvePath: (p) => path.resolve(opts.cwd, p),
});

const SAFE_ID = /^[a-z0-9_-]{3,64}$/i;

/** A project by id, or by a unique name or id prefix (what an agent or a person is likely to type). */
export const resolveProject = async (ref: string | undefined): Promise<Project> => {
  if (!ref) throw usage("Which project? Pass a project id (see `reframer projects`).");
  if (SAFE_ID.test(ref) && existsSync(projectFile(ref))) {
    const project = await readProject(ref);
    if (project) return project;
  }
  const all = await listProjects();
  const lower = ref.toLowerCase();
  const matches = all.filter((p) => p.name.toLowerCase() === lower || p.id.toLowerCase().startsWith(lower));
  if (matches.length === 1) {
    const project = await readProject(matches[0].id);
    if (project) return project;
  }
  if (matches.length > 1)
    throw usage(
      `"${ref}" matches ${matches.length} projects: ${matches
        .slice(0, 6)
        .map((m) => `${m.id} (${m.name})`)
        .join(", ")}`,
      "Pass the project id.",
    );
  throw notFound(`No project "${ref}"`, "List them with `reframer projects`.");
};

/** Snapshots taken before each CLI change, newest last, so `reframer undo` can step back. */
const HISTORY_KEEP = 30;
export const historyDir = (projectId: string) => path.join(projectDir(projectId), "cli-history");

const stamp = () => new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 18);

/** Saves a changed project, keeping the previous version as an undo step. */
export const saveProject = async (before: Project, after: Project, label: string): Promise<Project> => {
  const dir = historyDir(before.id);
  await fs.mkdir(dir, { recursive: true });
  const name = `${stamp()}-${label.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.json`;
  await fs.writeFile(path.join(dir, name), JSON.stringify({ at: Date.now(), label, project: before }), "utf8");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  await Promise.all(files.slice(0, Math.max(0, files.length - HISTORY_KEEP)).map((f) => fs.rm(path.join(dir, f), { force: true })));
  const saved = { ...after, updatedAt: Date.now() };
  await writeProject(saved);
  return saved;
};

/** The newest undo step (and its file), if any. */
export const latestHistory = async (projectId: string) => {
  const dir = historyDir(projectId);
  const files = existsSync(dir) ? (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort() : [];
  const file = files.at(-1);
  if (!file) return null;
  const raw = JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as { at: number; label: string; project: Project };
  return { file: path.join(dir, file), ...raw, remaining: files.length - 1 };
};
