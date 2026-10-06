import { getApiKey, readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OPENAI_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"]);
/** ElevenLabs premade voice used when none is given. */
const ELEVEN_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

/** Text to speech with ElevenLabs (preferred) or OpenAI, using the user's own keys. Returns mp3 bytes. */
export async function POST(request: Request) {
  const { text, voice } = (await request.json()) as { text?: string; voice?: string };
  if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
  const settings = await readSettings();
  const eleven = settings.integrations.elevenlabs;
  try {
    if (eleven && !(voice && OPENAI_VOICES.has(voice))) {
      const voiceId = voice && /^[A-Za-z0-9]{16,32}$/.test(voice) ? voice : ELEVEN_DEFAULT_VOICE;
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": eleven, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: text.trim(), model_id: "eleven_multilingual_v2" }),
        signal: request.signal,
      });
      if (!res.ok)
        return Response.json({ error: `ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
      return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "x-model": "elevenlabs:eleven_multilingual_v2" } });
    }
    const openai = await getApiKey("openai");
    if (!openai) {
      return Response.json(
        { error: "Voiceovers need an ElevenLabs key (Media services) or an OpenAI key (Model keys) in Settings." },
        { status: 400 },
      );
    }
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voice && OPENAI_VOICES.has(voice) ? voice : "alloy",
        input: text.trim(),
        response_format: "mp3",
      }),
      signal: request.signal,
    });
    if (!res.ok) return Response.json({ error: `OpenAI answered ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "x-model": "openai:gpt-4o-mini-tts" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
