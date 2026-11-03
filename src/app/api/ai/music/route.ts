import { readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Section = { name?: string; durationSec?: number; styles?: string[]; avoid?: string[] };
type MusicRequest = { styles?: string[]; avoid?: string[]; sections?: Section[]; durationSec?: number; instrumental?: boolean };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const words = (list: unknown) =>
  Array.isArray(list) ? list.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().slice(0, 80)) : [];

/**
 * Music composed for this edit with ElevenLabs Music, using the user's own key. With sections, the
 * track follows the edit's structure (each section exactly as long as its part of the film), so
 * changes in the music land on the cuts and the track ends on the last frame. Returns mp3 bytes.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as MusicRequest;
  const key = (await readSettings()).integrations.elevenlabs;
  if (!key) {
    return Response.json(
      { error: "Composing music needs an ElevenLabs key (Settings → Media services). Find a track with search_audio instead." },
      { status: 400 },
    );
  }
  const instrumental = body.instrumental !== false;
  const styles = words(body.styles);
  const avoid = words(body.avoid);
  const sections = (body.sections ?? []).filter((s) => (s.durationSec ?? 0) > 0);
  const payload = sections.length
    ? {
        model_id: "music_v1",
        composition_plan: {
          positive_global_styles: instrumental ? [...styles, "instrumental"] : styles,
          negative_global_styles: instrumental ? [...avoid, "vocals", "singing"] : avoid,
          sections: sections.map((s, i) => ({
            section_name: (s.name?.trim() || `Part ${i + 1}`).slice(0, 100),
            positive_local_styles: words(s.styles),
            negative_local_styles: words(s.avoid),
            // ElevenLabs takes sections of 3–120 s.
            duration_ms: clamp(Math.round((s.durationSec ?? 3) * 1000), 3000, 120000),
            lines: [],
          })),
        },
      }
    : {
        model_id: "music_v1",
        prompt:
          [styles.join(", "), avoid.length ? `Avoid: ${avoid.join(", ")}` : ""].filter(Boolean).join(". ") ||
          "cinematic instrumental underscore",
        music_length_ms: clamp(Math.round((body.durationSec ?? 30) * 1000), 3000, 600000),
        force_instrumental: instrumental,
      };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(payload),
      signal: request.signal,
    });
    if (!res.ok) return Response.json({ error: `ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 502 });
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "x-model": "elevenlabs:music_v1" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
