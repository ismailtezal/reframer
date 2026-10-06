import { API_PROVIDERS, type ApiProviderId, type CustomEndpoint, publicSettings, readSettings, writeSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await publicSettings());
}

type Patch = {
  keys?: Partial<Record<ApiProviderId, string | null>>;
  custom?: CustomEndpoint[];
  defaultModel?: string;
  favorites?: string[];
  integrations?: Record<string, string | null>;
  transcription?: "local" | "openai" | "groq" | "elevenlabs";
  imageModel?: string;
  speechModel?: string;
  harnesses?: { claudeCode?: { enabled?: boolean; executable?: string }; codex?: { enabled?: boolean; executable?: string } };
  regenerateMcpToken?: boolean;
  remotionLicenseKey?: string | null;
};

/** Partial update. `null` clears a key. Masked values ("••••") are ignored. */
export async function PUT(request: Request) {
  const patch = (await request.json()) as Patch;
  const s = await readSettings();
  const next = structuredClone(s);
  if (patch.keys) {
    for (const [k, v] of Object.entries(patch.keys)) {
      if (!API_PROVIDERS.includes(k as ApiProviderId)) continue;
      if (v === null || v === "") delete next.keys[k as ApiProviderId];
      else if (typeof v === "string" && !v.includes("••••")) next.keys[k as ApiProviderId] = v.trim();
    }
  }
  if (patch.custom) {
    next.custom = patch.custom.map((c) => {
      const prev = s.custom.find((p) => p.id === c.id);
      return { ...c, apiKey: c.apiKey?.includes("••••") ? prev?.apiKey : c.apiKey };
    });
  }
  if (patch.defaultModel !== undefined) next.defaultModel = patch.defaultModel;
  if (patch.favorites) next.favorites = patch.favorites;
  if (patch.integrations) {
    for (const [k, v] of Object.entries(patch.integrations)) {
      const key = k as keyof typeof next.integrations;
      if (v === null || v === "") delete next.integrations[key];
      else if (!v.includes("••••")) next.integrations[key] = v.trim();
    }
  }
  if (patch.transcription) next.transcription = patch.transcription;
  if (patch.imageModel !== undefined) next.imageModel = patch.imageModel;
  if (patch.speechModel !== undefined) next.speechModel = patch.speechModel;
  if (patch.harnesses?.claudeCode) next.harnesses.claudeCode = { ...next.harnesses.claudeCode, ...patch.harnesses.claudeCode };
  if (patch.harnesses?.codex) next.harnesses.codex = { ...next.harnesses.codex, ...patch.harnesses.codex };
  if (patch.remotionLicenseKey !== undefined) {
    const key = patch.remotionLicenseKey?.trim();
    if (!key) delete next.remotionLicenseKey;
    else if (!key.includes("••••")) next.remotionLicenseKey = key;
  }
  if (patch.regenerateMcpToken) {
    const { randomBytes } = await import("node:crypto");
    next.mcpToken = randomBytes(18).toString("base64url");
  }
  await writeSettings(next);
  return Response.json(await publicSettings());
}
