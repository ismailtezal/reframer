import { findClaudeExecutable } from "@/server/agent/harness-claude-code";
import { findCodexExecutable } from "@/server/agent/harness-codex";
import { listModels } from "@/server/agent/models";
import { readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** Models for configured providers + local endpoints (probed) + local agent CLIs. */
export async function GET(request: Request) {
  const all = new URL(request.url).searchParams.get("all") === "1";
  const settings = await readSettings();
  // Discover models served by local OpenAI-compatible endpoints (Ollama, LM Studio).
  await Promise.all(
    settings.custom.map(async (endpoint) => {
      try {
        const res = await fetch(`${endpoint.baseURL.replace(/\/$/, "")}/models`, {
          headers: endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {},
          signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { id: string }[] };
        const ids = (data.data ?? []).map((m) => m.id).filter(Boolean);
        if (ids.length) endpoint.models = ids;
      } catch {
        // endpoint not running
      }
    }),
  );
  const [models, claude, codex] = await Promise.all([listModels({ all }), findClaudeExecutable(), findCodexExecutable()]);
  return Response.json({
    models,
    defaultModel: settings.defaultModel,
    favorites: settings.favorites,
    harnesses: {
      claudeCode: { ...settings.harnesses.claudeCode, detected: claude ?? null },
      codex: { ...settings.harnesses.codex, detected: codex ?? null },
    },
  });
}
