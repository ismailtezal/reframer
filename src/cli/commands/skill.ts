import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type Command, RAW_OUTPUT } from "../command";
import { CliError } from "../errors";

/** Where Claude Code looks for personal skills. */
const CLAUDE_SKILLS = () => path.join(os.homedir(), ".claude", "skills");

export const skillCommand: Command = {
  name: "skill",
  summary: "The agent guide for this CLI (SKILL.md): print it, or install it where Claude Code finds skills",
  usage: "reframer skill [--install [--dir <skills folder>]] [--raw]",
  flags: {
    install: { type: "boolean", description: "Write it to ~/.claude/skills/reframer/SKILL.md (Claude Code loads it when a task needs it)" },
    dir: { type: "string", description: "Skills folder to install into instead (a project's .claude/skills, another agent's folder)" },
    raw: { type: "boolean", description: "Print the markdown itself instead of JSON" },
  },
  examples: ["reframer skill --install", "reframer skill --raw > AGENTS-reframer.md"],
  run: async (ctx, { flags }) => {
    const source = path.join(ctx.appRoot, "skills", "reframer", "SKILL.md");
    if (!existsSync(source)) throw new CliError("E_ENV", `The agent guide is missing (${source})`);
    const text = await fs.readFile(source, "utf8");
    if (flags.raw) return { [RAW_OUTPUT]: text };
    if (!flags.install && !flags.dir) return { path: source, skill: text };
    const dir = flags.dir ? ctx.resolvePath(String(flags.dir)) : CLAUDE_SKILLS();
    const target = path.join(dir, "reframer", "SKILL.md");
    await fs.mkdir(path.dirname(target), { recursive: true });
    const before = existsSync(target) ? await fs.readFile(target, "utf8") : null;
    await fs.writeFile(target, text, "utf8");
    return { installed: target, updated: before !== null && before !== text, unchanged: before === text };
  },
};
