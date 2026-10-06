import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { generateImage, type ImageModel } from "ai";
import { getApiKey, readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Default image model per provider, tried in this order when none is chosen in Settings. */
const DEFAULTS = [
  { provider: "openai", model: "gpt-image-1" },
  { provider: "google", model: "gemini-2.5-flash-image" },
  { provider: "xai", model: "grok-imagine-image" },
];

const resolveImageModel = async (preferred?: string): Promise<{ model: ImageModel; ref: string } | null> => {
  const chosen = preferred ? [{ provider: preferred.split(":")[0], model: preferred.split(":").slice(1).join(":") }] : [];
  for (const c of [...chosen, ...DEFAULTS]) {
    if (c.provider !== "openai" && c.provider !== "google" && c.provider !== "xai") continue;
    const apiKey = await getApiKey(c.provider);
    if (!apiKey) continue;
    const ref = `${c.provider}:${c.model}`;
    if (c.provider === "openai") return { model: createOpenAI({ apiKey }).image(c.model), ref };
    if (c.provider === "google") return { model: createGoogle({ apiKey }).image(c.model), ref };
    return { model: createXai({ apiKey }).image(c.model), ref };
  }
  return null;
};

const ASPECTS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "3:2", "2:3"]);

/** Generates one image with the user's own key and returns the bytes. */
export async function POST(request: Request) {
  const { prompt, aspect } = (await request.json()) as { prompt?: string; aspect?: string };
  if (!prompt?.trim()) return Response.json({ error: "prompt required" }, { status: 400 });
  const settings = await readSettings();
  const resolved = await resolveImageModel(settings.imageModel);
  if (!resolved) {
    return Response.json(
      { error: "Image generation needs an OpenAI, Google or xAI key. Add one in Settings → Model keys." },
      { status: 400 },
    );
  }
  try {
    const result = await generateImage({
      model: resolved.model,
      prompt: prompt.trim(),
      aspectRatio: (aspect && ASPECTS.has(aspect) ? aspect : "16:9") as `${number}:${number}`,
      abortSignal: request.signal,
    });
    const image = result.image;
    return new Response(Buffer.from(image.uint8Array), {
      headers: { "Content-Type": image.mediaType || "image/png", "x-model": resolved.ref, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
