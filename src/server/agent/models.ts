import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGateway } from "@ai-sdk/gateway";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { CACHE_DIR } from "../paths";
import { API_PROVIDERS, type ApiProviderId, getApiKey, readSettings } from "../settings";

/**
 * Model catalog (from models.dev, MIT) + provider factory.
 * Model refs: "<provider>:<modelId>", "custom:<endpointId>:<modelId>",
 * "harness:claude-code", "harness:codex".
 */

export type ModelInfo = {
  ref: string;
  provider: string;
  providerName: string;
  id: string;
  name: string;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
  efforts?: string[];
  context?: number;
  cost?: { input: number; output: number };
  releaseDate?: string;
  kind: "api" | "custom" | "harness";
};

type ModelsDevModel = {
  id: string;
  name: string;
  tool_call?: boolean;
  reasoning?: boolean;
  attachment?: boolean;
  reasoning_options?: { type: string; values?: string[] }[];
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number };
  cost?: { input: number; output: number };
  release_date?: string;
  status?: string;
};
type ModelsDev = Record<string, { id: string; name: string; models: Record<string, ModelsDevModel> }>;

const CATALOG_FILE = path.join(CACHE_DIR, "models-dev.json");
const CATALOG_TTL = 24 * 3600 * 1000;

let memory: { at: number; data: ModelsDev } | null = null;

const loadCatalog = async (): Promise<ModelsDev> => {
  if (memory && Date.now() - memory.at < CATALOG_TTL) return memory.data;
  try {
    const stat = await fs.stat(CATALOG_FILE);
    if (Date.now() - stat.mtimeMs < CATALOG_TTL) {
      const data = JSON.parse(await fs.readFile(CATALOG_FILE, "utf8")) as ModelsDev;
      memory = { at: stat.mtimeMs, data };
      return data;
    }
  } catch {
    // no cache yet
  }
  try {
    const res = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`models.dev ${res.status}`);
    const data = (await res.json()) as ModelsDev;
    // Keep only providers we support to keep the cache small.
    const slim: ModelsDev = {};
    for (const id of API_PROVIDERS) if (data[id]) slim[id] = data[id];
    if (data.vercel) slim.gateway = data.vercel;
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CATALOG_FILE, JSON.stringify(slim));
    memory = { at: Date.now(), data: slim };
    return slim;
  } catch (err) {
    console.warn("[reframer] models.dev unavailable, using fallback list", err);
    return FALLBACK;
  }
};

/** Minimal offline fallback so the app works without internet on first run. */
const FALLBACK: ModelsDev = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: {
      "claude-sonnet-5-5": { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", tool_call: true, attachment: true, reasoning: true },
      "claude-opus-5-5": { id: "claude-opus-5-5", name: "Claude Opus 5.5", tool_call: true, attachment: true, reasoning: true },
      "claude-haiku-4-5": { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", tool_call: true, attachment: true },
    },
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    models: {
      "gpt-5": { id: "gpt-5", name: "GPT-5", tool_call: true, attachment: true, reasoning: true },
      "gpt-5-mini": { id: "gpt-5-mini", name: "GPT-5 mini", tool_call: true, attachment: true, reasoning: true },
    },
  },
  google: {
    id: "google",
    name: "Google",
    models: {
      "gemini-2.5-pro": { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tool_call: true, attachment: true, reasoning: true },
      "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tool_call: true, attachment: true, reasoning: true },
    },
  },
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  mistral: "Mistral",
  groq: "Groq",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  gateway: "Vercel AI Gateway",
};

const toInfo = (provider: string, m: ModelsDevModel): ModelInfo => ({
  ref: `${provider}:${m.id}`,
  provider,
  providerName: PROVIDER_NAMES[provider] ?? provider,
  id: m.id,
  name: m.name,
  tools: !!m.tool_call,
  vision: !!m.attachment || !!m.modalities?.input?.includes("image"),
  reasoning: !!m.reasoning,
  efforts: m.reasoning_options?.find((o) => o.type === "effort")?.values,
  context: m.limit?.context,
  cost: m.cost ? { input: m.cost.input, output: m.cost.output } : undefined,
  releaseDate: m.release_date,
  kind: "api",
});

/** Lists models for configured providers (tool-capable only), newest first, plus local endpoints and harnesses. */
export const listModels = async (opts: { all?: boolean } = {}): Promise<ModelInfo[]> => {
  const catalog = await loadCatalog();
  const settings = await readSettings();
  const out: ModelInfo[] = [];
  for (const provider of API_PROVIDERS) {
    if (!opts.all && !(await getApiKey(provider))) continue;
    const p = catalog[provider];
    if (!p) continue;
    const models = Object.values(p.models)
      .filter((m) => m.tool_call && m.status !== "deprecated")
      .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
      .slice(0, provider === "openrouter" || provider === "gateway" ? 60 : 30);
    for (const m of models) out.push(toInfo(provider, m));
  }
  for (const endpoint of settings.custom) {
    for (const id of endpoint.models) {
      out.push({
        ref: `custom:${endpoint.id}:${id}`,
        provider: `custom:${endpoint.id}`,
        providerName: endpoint.name,
        id,
        name: id,
        tools: true,
        vision: false,
        reasoning: false,
        kind: "custom",
      });
    }
  }
  if (settings.harnesses.claudeCode.enabled) {
    out.push({
      ref: "harness:claude-code",
      provider: "harness",
      providerName: "Local agents",
      id: "claude-code",
      name: "Claude Code (your login)",
      tools: true,
      vision: true,
      reasoning: true,
      kind: "harness",
    });
  }
  if (settings.harnesses.codex.enabled) {
    out.push({
      ref: "harness:codex",
      provider: "harness",
      providerName: "Local agents",
      id: "codex",
      name: "Codex (your login)",
      tools: true,
      vision: true,
      reasoning: true,
      kind: "harness",
    });
  }
  return out;
};

export const getModelInfo = async (ref: string): Promise<ModelInfo | undefined> => {
  const list = await listModels({ all: true });
  return list.find((m) => m.ref === ref);
};

/** Builds an AI SDK language model for a ref using local keys. */
export const resolveLanguageModel = async (ref: string): Promise<LanguageModel> => {
  if (ref.startsWith("custom:")) {
    const [, endpointId, ...rest] = ref.split(":");
    const modelId = rest.join(":");
    const settings = await readSettings();
    const endpoint = settings.custom.find((c) => c.id === endpointId);
    if (!endpoint) throw new Error(`Unknown endpoint "${endpointId}"`);
    const provider = createOpenAICompatible({ name: endpoint.id, baseURL: endpoint.baseURL, apiKey: endpoint.apiKey || "local" });
    return provider(modelId);
  }
  const idx = ref.indexOf(":");
  const providerId = ref.slice(0, idx) as ApiProviderId;
  const modelId = ref.slice(idx + 1);
  const apiKey = await getApiKey(providerId);
  if (!apiKey) throw new Error(`No API key for ${PROVIDER_NAMES[providerId] ?? providerId}. Add one in Settings → Models.`);
  switch (providerId) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogle({ apiKey })(modelId);
    case "xai":
      return createXai({ apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "groq":
      return createGroq({ apiKey })(modelId);
    case "deepseek":
      return createDeepSeek({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
    case "gateway":
      return createGateway({ apiKey })(modelId);
    default:
      throw new Error(`Unsupported provider "${providerId}"`);
  }
};

export type ReasoningLevel = "provider-default" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

/** Maps the picker's effort values onto AI SDK 7's portable `reasoning` setting. */
export const toReasoning = (effort?: string): ReasoningLevel | undefined => {
  switch (effort) {
    case undefined:
    case "":
      return undefined;
    case "max":
      return "xhigh";
    case "none":
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return effort;
    default:
      return "provider-default";
  }
};
