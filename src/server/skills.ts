import "server-only";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { loadPacks, packSkillBody } from "./packs";
import { SKILLS_DIR } from "./paths";

/**
 * Skills = expert playbooks the agent loads on demand (progressive disclosure,
 * like Claude Agent Skills). Built-ins ship in `src/agent/skills`; users can
 * add their own `.md` files to `.reframer/skills/` (same frontmatter format).
 */

export type Skill = { name: string; description: string; source: "builtin" | "user" | "pack"; body: string };

const BUILTIN_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "src", "agent", "skills");

const parse = (raw: string, source: Skill["source"], fallbackName: string): Skill | null => {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0)
      meta[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  return { name: meta.name || fallbackName, description: meta.description ?? "", source, body: m[2].trim() };
};

let cache: { at: number; skills: Skill[] } | null = null;

const loadDir = async (dir: string, source: Skill["source"]): Promise<Skill[]> => {
  if (!existsSync(dir)) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  const out: Skill[] = [];
  for (const f of files) {
    const skill = parse(await fs.readFile(path.join(dir, f), "utf8"), source, f.replace(/\.md$/, ""));
    if (skill) out.push(skill);
  }
  return out;
};

export const listSkills = async (): Promise<Skill[]> => {
  if (cache && Date.now() - cache.at < 10_000) return cache.skills;
  const builtin = await loadDir(BUILTIN_DIR, "builtin");
  const user = await loadDir(SKILLS_DIR, "user");
  // Each style pack is a skill too: its guide, led by how to use the pack here.
  const packs: Skill[] = (await loadPacks()).packs.map((p) => ({
    name: p.manifest.id,
    description: `Style pack: ${p.manifest.name}. ${p.manifest.description}`,
    source: "pack",
    body: packSkillBody(p),
  }));
  // Built-ins win over packs with the same name, user skills over both.
  const byName = new Map<string, Skill>();
  for (const s of [...packs, ...builtin, ...user]) byName.set(s.name, s);
  const skills = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), skills };
  return skills;
};

export const getSkill = async (name: string): Promise<Skill | undefined> =>
  (await listSkills()).find((s) => s.name === name.trim().toLowerCase().replace(/\s+/g, "-"));
