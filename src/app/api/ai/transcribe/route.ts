import { getApiKey, readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Word = { text: string; startMs: number; endMs: number; timestampMs: number; confidence: number | null };

const toWords = (raw: { word: string; start: number; end: number }[], offsetSec: number): Word[] =>
  raw
    .filter((w) => w.word.trim())
    .map((w, i) => {
      const startMs = Math.round((w.start + offsetSec) * 1000);
      const endMs = Math.round((w.end + offsetSec) * 1000);
      const text = w.word.trim();
      return {
        text: i === 0 && offsetSec === 0 ? text : ` ${text}`,
        startMs,
        endMs,
        timestampMs: Math.round((startMs + endMs) / 2),
        confidence: null,
      };
    });

/**
 * Cloud transcription with the user's own key. The editor sends 16 kHz mono
 * WAV chunks (extracted in the browser, so uploads stay small) plus the
 * chunk's start offset; we answer with word timings in the project's format.
 */
export async function POST(request: Request) {
  const offsetSec = Number(new URL(request.url).searchParams.get("offset") ?? 0) || 0;
  const audio = await request.blob();
  if (audio.size === 0) return Response.json({ error: "No audio received" }, { status: 400 });
  const settings = await readSettings();
  const engine = settings.transcription;
  try {
    if (engine === "openai" || engine === "groq") {
      const key = await getApiKey(engine);
      if (!key)
        return Response.json(
          { error: `Transcription with ${engine === "openai" ? "OpenAI" : "Groq"} needs its key in Settings.` },
          { status: 400 },
        );
      const form = new FormData();
      form.append("file", new File([audio], "audio.wav", { type: "audio/wav" }));
      form.append("model", engine === "openai" ? "whisper-1" : "whisper-large-v3-turbo");
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      const base = engine === "openai" ? "https://api.openai.com/v1" : "https://api.groq.com/openai/v1";
      const res = await fetch(`${base}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: request.signal,
      });
      if (!res.ok)
        return Response.json({ error: `${engine} answered ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
      const data = (await res.json()) as { language?: string; words?: { word: string; start: number; end: number }[] };
      return Response.json({ words: toWords(data.words ?? [], offsetSec), language: data.language, engine });
    }
    if (engine === "elevenlabs") {
      const key = settings.integrations.elevenlabs;
      if (!key)
        return Response.json({ error: "Transcription with ElevenLabs needs its key in Settings → Media services." }, { status: 400 });
      const form = new FormData();
      form.append("file", new File([audio], "audio.wav", { type: "audio/wav" }));
      form.append("model_id", "scribe_v1");
      form.append("timestamps_granularity", "word");
      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": key },
        body: form,
        signal: request.signal,
      });
      if (!res.ok)
        return Response.json({ error: `ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
      const data = (await res.json()) as { language_code?: string; words?: { text: string; start: number; end: number; type: string }[] };
      const words = (data.words ?? []).filter((w) => w.type === "word").map((w) => ({ word: w.text, start: w.start, end: w.end }));
      return Response.json({ words: toWords(words, offsetSec), language: data.language_code, engine });
    }
    return Response.json({ error: "Local transcription runs in the editor, not on the server." }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
