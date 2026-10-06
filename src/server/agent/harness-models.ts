import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CACHE_DIR } from "../paths";

/**
 * The models each local agent CLI offers on the user's own account, with the
 * thinking-effort levels each supports, so the composer can offer the same
 * choices as the Claude Code and Codex apps.
 */

export type HarnessModel = {
  /** Value passed to the CLI; "default" means "don't pass one" (the CLI's own default). */
  id: string;
  name: string;
  description?: string;
  efforts?: string[];
  defaultEffort?: string;
};

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
// Claude Code's SDK accepts these; Codex's SDK accepts these.
export const CLAUDE_EFFORT_LEVELS = new Set(CLAUDE_EFFORTS);
export const CODEX_EFFORT_LEVELS = new Set(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);

const CLAUDE_FALLBACK: HarnessModel[] = [
  { id: "default", name: "Default (recommended)", efforts: CLAUDE_EFFORTS, defaultEffort: "high" },
  { id: "opus", name: "Opus", efforts: CLAUDE_EFFORTS, defaultEffort: "high" },
  { id: "sonnet", name: "Sonnet", efforts: CLAUDE_EFFORTS, defaultEffort: "high" },
  { id: "haiku", name: "Haiku" },
];

const CACHE_FILE = path.join(CACHE_DIR, "claude-code-models.json");
const TTL = 6 * 3600 * 1000;

const g = globalThis as unknown as { __reframerClaudeModels?: { at: number; models: HarnessModel[]; pending?: Promise<HarnessModel[]> } };

/** Asks the user's Claude Code CLI which models their login can use (≈1 s). */
const queryClaudeCode = async (): Promise<HarnessModel[]> => {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  // Imported lazily: the harness module imports this one.
  const { findClaudeExecutable } = await import("./harness-claude-code");
  const abort = new AbortController();
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  // A prompt stream that never yields: the CLI starts and answers control requests without running a turn.
  const idle: AsyncIterable<never> = {
    [Symbol.asyncIterator]: () => ({ next: () => hold.then(() => ({ done: true as const, value: undefined as never })) }),
  };
  const q = sdk.query({
    prompt: idle,
    options: { abortController: abort, pathToClaudeCodeExecutable: await findClaudeExecutable(), settingSources: [], tools: [] },
  });
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Claude Code didn't answer")), 20_000));
    const models = await Promise.race([q.supportedModels(), timeout]);
    return models.map((m) => {
      const efforts = m.supportsEffort === false ? undefined : m.supportedEffortLevels?.filter((e) => CLAUDE_EFFORT_LEVELS.has(e));
      return {
        id: m.value,
        name: m.displayName,
        description: m.description,
        efforts: efforts?.length ? efforts : undefined,
        defaultEffort: efforts?.includes("high") ? "high" : efforts?.[0],
      };
    });
  } finally {
    release();
    abort.abort();
  }
};

export const listClaudeCodeModels = async (): Promise<HarnessModel[]> => {
  const cache = g.__reframerClaudeModels;
  if (cache && Date.now() - cache.at < TTL) return cache.models;
  if (!cache) {
    try {
      const stat = await fs.stat(CACHE_FILE);
      const models = JSON.parse(await fs.readFile(CACHE_FILE, "utf8")) as HarnessModel[];
      g.__reframerClaudeModels = { at: stat.mtimeMs, models };
      if (Date.now() - stat.mtimeMs < TTL) return models;
    } catch {
      // No cache yet.
    }
  }
  const state = g.__reframerClaudeModels ?? { at: 0, models: CLAUDE_FALLBACK };
  g.__reframerClaudeModels = state;
  state.pending ??= queryClaudeCode()
    .then(async (models) => {
      Object.assign(state, { at: Date.now(), models });
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(CACHE_FILE, JSON.stringify(models));
      return models;
    })
    .catch(() => state.models)
    .finally(() => {
      state.pending = undefined;
    });
  return state.pending;
};

type CodexCacheModel = {
  slug?: string;
  display_name?: string;
  description?: string;
  default_reasoning_level?: string;
  supported_reasoning_levels?: { effort?: string }[];
  visibility?: string;
  priority?: number;
};

/**
 * Codex keeps the account's model list in CODEX_HOME/models_cache.json (no
 * credentials in it). Only the `models` list is read.
 */
export const listCodexModels = async (): Promise<HarnessModel[]> => {
  const home = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const defaultEntry: HarnessModel = { id: "default", name: "Default", description: "Your Codex default model" };
  try {
    const raw = JSON.parse(await fs.readFile(path.join(home, "models_cache.json"), "utf8")) as { models?: CodexCacheModel[] };
    const models = (raw.models ?? [])
      .filter((m) => m.slug && m.visibility !== "hide")
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((m) => {
        const efforts = (m.supported_reasoning_levels ?? []).map((l) => l.effort ?? "").filter((e) => CODEX_EFFORT_LEVELS.has(e));
        return {
          id: m.slug as string,
          name: m.display_name ?? (m.slug as string),
          description: m.description,
          efforts: efforts.length ? efforts : undefined,
          defaultEffort: m.default_reasoning_level && efforts.includes(m.default_reasoning_level) ? m.default_reasoning_level : efforts[0],
        };
      });
    if (!models.length) return [defaultEntry];
    // The CLI's default is the `model` set at the top of config.toml, else its first listed model.
    const config = await fs.readFile(path.join(home, "config.toml"), "utf8").catch(() => "");
    const configured = /^model\s*=\s*"([^"]+)"/m.exec(config.split(/^\s*\[/m)[0] ?? "")?.[1];
    const base = models.find((m) => m.id === configured) ?? models[0];
    return [{ ...base, id: "default", name: `Default (${base.name})`, description: base.description }, ...models];
  } catch {
    return [defaultEntry];
  }
};
