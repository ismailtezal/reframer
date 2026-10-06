import "server-only";
import path from "node:path";

/** Root for all local data. Override with REFRAMER_DATA_DIR. */
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.REFRAMER_DATA_DIR ?? path.join(process.cwd(), ".reframer"));

export const PROJECTS_DIR = path.join(DATA_DIR, "projects");
export const TRASH_DIR = path.join(DATA_DIR, "trash");
export const RENDERS_DIR = path.join(DATA_DIR, "renders");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
export const SKILLS_DIR = path.join(DATA_DIR, "skills");
export const STYLES_DIR = path.join(DATA_DIR, "styles");

const SAFE_ID = /^[a-z0-9_-]{3,64}$/i;

export const assertSafeId = (id: string) => {
  if (!SAFE_ID.test(id)) throw new Error(`Invalid id: ${id}`);
  return id;
};

/** Prevents path traversal for user-provided file names. */
export const safeFileName = (name: string) => {
  const base = path
    .basename(name)
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "-");
  return base.slice(-120) || "file";
};

export const projectDir = (id: string) => path.join(PROJECTS_DIR, assertSafeId(id));
export const projectFile = (id: string) => path.join(projectDir(id), "project.json");
export const mediaDir = (id: string) => path.join(projectDir(id), "media");
export const threadsDir = (id: string) => path.join(projectDir(id), "threads");
export const checkpointsDir = (id: string) => path.join(projectDir(id), "checkpoints");
