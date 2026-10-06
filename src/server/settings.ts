import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { SETTINGS_FILE } from "./paths";

/**
 * Local settings (API keys, default model, integrations). Stored in
 * `.reframer/settings.json` on the user's machine — never sent anywhere except
 * to the provider the key belongs to. Environment variables work as fallbacks.
 */

export const API_PROVIDERS = ["anthropic", "openai", "google", "xai", "mistral", "groq", "deepseek", "openrouter", "gateway"] as const;
export type ApiProviderId = (typeof API_PROVIDERS)[number];

export type CustomEndpoint = {
  id: string;
  name: string;
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 (Ollama) */
  baseURL: string;
  apiKey?: string;
  models: string[];
};

export type Settings = {
  keys: Partial<Record<ApiProviderId, string>>;
  custom: CustomEndpoint[];
  /** Default model, e.g. "anthropic:claude-sonnet-5-5" or "harness:claude-code" */
  defaultModel?: string;
  favorites: string[];
  integrations: {
    pexels?: string;
    elevenlabs?: string;
    fal?: string;
  };
  /** Speech-to-text engine: local Whisper (WebGPU) or a cloud provider via its key. */
  transcription: "local" | "openai" | "groq" | "elevenlabs";
  imageModel?: string;
  speechModel?: string;
  /** Agent harnesses (local CLIs) */
  harnesses: {
    claudeCode: { enabled: boolean; executable?: string };
    codex: { enabled: boolean; executable?: string };
  };
  /** Token external agents (Claude Code / Codex / Cursor) use to call the MCP endpoint. */
  mcpToken: string;
  remotionLicenseKey?: string;
};

const ENV_KEYS: Record<ApiProviderId, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  xai: ["XAI_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  groq: ["GROQ_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  gateway: ["AI_GATEWAY_API_KEY"],
};

const defaults = (): Settings => ({
  keys: {},
  custom: [
    { id: "ollama", name: "Ollama (local)", baseURL: "http://127.0.0.1:11434/v1", models: [] },
    { id: "lmstudio", name: "LM Studio (local)", baseURL: "http://127.0.0.1:1234/v1", models: [] },
  ],
  favorites: [],
  integrations: {},
  transcription: "local",
  harnesses: { claudeCode: { enabled: false }, codex: { enabled: false } },
  mcpToken: randomBytes(18).toString("base64url"),
});

let cache: Settings | null = null;

export const readSettings = async (): Promise<Settings> => {
  if (cache) return cache;
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
  } catch {
    // first run
  }
  const base = defaults();
  cache = {
    ...base,
    ...stored,
    keys: { ...base.keys, ...stored.keys },
    integrations: { ...base.integrations, ...stored.integrations },
    harnesses: {
      claudeCode: { ...base.harnesses.claudeCode, ...stored.harnesses?.claudeCode },
      codex: { ...base.harnesses.codex, ...stored.harnesses?.codex },
    },
    custom: stored.custom ?? base.custom,
    mcpToken: stored.mcpToken ?? base.mcpToken,
  };
  if (!stored.mcpToken) await writeSettings(cache);
  return cache;
};

export const writeSettings = async (settings: Settings) => {
  cache = settings;
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), { encoding: "utf8", mode: 0o600 });
};

/** Key for a provider: settings first, then environment variables. */
export const getApiKey = async (provider: ApiProviderId): Promise<string | undefined> => {
  const s = await readSettings();
  const fromSettings = s.keys[provider]?.trim();
  if (fromSettings) return fromSettings;
  for (const name of ENV_KEYS[provider]) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return undefined;
};

export const keySource = async (provider: ApiProviderId): Promise<"settings" | "env" | null> => {
  const s = await readSettings();
  if (s.keys[provider]?.trim()) return "settings";
  return ENV_KEYS[provider].some((n) => process.env[n]?.trim()) ? "env" : null;
};

const mask = (key: string) => (key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`);

/** Settings safe to send to the UI: keys are masked. */
export const publicSettings = async () => {
  const s = await readSettings();
  const providers = await Promise.all(
    API_PROVIDERS.map(async (id) => {
      const source = await keySource(id);
      const key = source ? await getApiKey(id) : undefined;
      return { id, configured: !!source, source, masked: key ? mask(key) : null };
    }),
  );
  return {
    providers,
    custom: s.custom.map((c) => ({ ...c, apiKey: c.apiKey ? mask(c.apiKey) : undefined })),
    defaultModel: s.defaultModel,
    favorites: s.favorites,
    integrations: Object.fromEntries(Object.entries(s.integrations).map(([k, v]) => [k, v ? mask(v) : null])),
    transcription: s.transcription,
    imageModel: s.imageModel,
    speechModel: s.speechModel,
    harnesses: s.harnesses,
    mcpToken: s.mcpToken,
    remotionLicenseKey: s.remotionLicenseKey ? mask(s.remotionLicenseKey) : null,
  };
};
export type PublicSettings = Awaited<ReturnType<typeof publicSettings>>;
