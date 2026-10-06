import { type AudioKind, searchAudio } from "@/server/audio-library";

export const dynamic = "force-dynamic";

/** ?kind=music|sfx&q=…[&minSec=&maxSec=&limit=] — free-to-use music and sound effects. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind: AudioKind = params.get("kind") === "sfx" ? "sfx" : "music";
  const query = params.get("q")?.trim();
  if (!query) return Response.json({ error: "q required" }, { status: 400 });
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  try {
    const results = await searchAudio({ kind, query, minSec: num("minSec"), maxSec: num("maxSec"), limit: num("limit") });
    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
