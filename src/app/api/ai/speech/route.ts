import { getApiKey, readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OPENAI_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"]);
/**
 * ElevenLabs default (premade) voices, usable on every plan through the API (library voices need a
 * paid plan). All speak any language with eleven_multilingual_v2.
 */
const ELEVEN_VOICES: Record<string, string> = {
  george: "JBFqnCBsd6RMkjVDRZzb", // warm male storyteller
  daniel: "onwK4e9ZLuTAKqWW03F9", // male broadcaster
  brian: "nPczCjzI2devNBz1zQrb", // deep male
  sarah: "EXAVITQu4vr4xnSDxMaL", // soft female
};
const ELEVEN_DEFAULT_VOICE = ELEVEN_VOICES.george;

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** ElevenLabs' per-character timing grouped into caption words (later words keep their leading space). */
const alignmentToWords = (a: Alignment | null | undefined) => {
  const words: { text: string; startMs: number; endMs: number; timestampMs: null; confidence: null }[] = [];
  if (!a?.characters?.length) return words;
  let current: { text: string; start: number; end: number } | undefined;
  const flush = () => {
    if (!current) return;
    words.push({
      text: (words.length ? " " : "") + current.text,
      startMs: Math.round(current.start * 1000),
      endMs: Math.round(current.end * 1000),
      timestampMs: null,
      confidence: null,
    });
    current = undefined;
  };
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      flush();
      return;
    }
    const start = a.character_start_times_seconds[i] ?? 0;
    const end = a.character_end_times_seconds[i] ?? start;
    if (current) {
      current.text += ch;
      current.end = end;
    } else current = { text: ch, start, end };
  });
  flush();
  return words;
};

/**
 * Text to speech with ElevenLabs (preferred) or OpenAI, using the user's own keys. Returns mp3 bytes,
 * or with `timestamps: true` (ElevenLabs only) JSON: base64 audio plus the spoken words' timing.
 */
export async function POST(request: Request) {
  const { text, voice, timestamps } = (await request.json()) as { text?: string; voice?: string; timestamps?: boolean };
  if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
  const settings = await readSettings();
  const eleven = settings.integrations.elevenlabs;
  try {
    if (eleven && !(voice && OPENAI_VOICES.has(voice))) {
      const named = voice ? ELEVEN_VOICES[voice.trim().toLowerCase()] : undefined;
      const voiceId = named ?? (voice && /^[A-Za-z0-9]{16,32}$/.test(voice) ? voice : ELEVEN_DEFAULT_VOICE);
      // eleven_v3 reads with natural pauses and intonation (multilingual_v2 sounds flat in Turkish); "natural" stability.
      const speak = (model: string) =>
        fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}${timestamps ? "/with-timestamps" : ""}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": eleven, "Content-Type": "application/json", Accept: timestamps ? "application/json" : "audio/mpeg" },
          body: JSON.stringify({
            text: text.trim(),
            model_id: model,
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
          }),
          signal: request.signal,
        });
      let model = "eleven_v3";
      let res = await speak(model);
      // A voice or plan without v3 falls back to multilingual v2 rather than losing the voiceover.
      if (!res.ok && res.status >= 400 && res.status < 500 && res.status !== 401) {
        model = "eleven_multilingual_v2";
        res = await speak(model);
      }
      if (!res.ok)
        return Response.json({ error: `ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
      if (timestamps) {
        const data = (await res.json()) as { audio_base64: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
        return Response.json({
          audio: data.audio_base64,
          mimeType: "audio/mpeg",
          model: `elevenlabs:${model}`,
          words: alignmentToWords(data.alignment ?? data.normalized_alignment),
        });
      }
      return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "x-model": `elevenlabs:${model}` } });
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
