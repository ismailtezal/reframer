"use client";

import type { CaptionWord } from "@/core/schema";

/**
 * A free voice that runs on this computer when no speech key works: Kokoro-82M (Apache-2.0, hexgrad)
 * through transformers.js, in US and UK English. Text normalisation and phoneme clean-up follow
 * kokoro-js (Apache-2.0). Phonemes come from eSpeak NG (GPL-3.0), fetched at first use from a CDN
 * instead of being bundled into Reframer's MIT build, like the model weights.
 *
 * Sentences are spoken one at a time, so each one's start and end are exact; the words inside are
 * placed by the model's own phoneme durations.
 */

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped";
const VOICES_URL = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";
const PHONEMIZER_URL = "https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js";
export const LOCAL_TTS_RATE = 24_000;

/** Kokoro's better voices by plain names (US: heart, bella, nicole, sarah, michael, fenrir, puck; UK: emma, george, fable). */
const VOICES: Record<string, string> = {
  heart: "af_heart",
  bella: "af_bella",
  nicole: "af_nicole",
  sarah: "af_sarah",
  emma: "bf_emma",
  michael: "am_michael",
  fenrir: "am_fenrir",
  puck: "am_puck",
  george: "bm_george",
  fable: "bm_fable",
};

/** The cloud voices' names, mapped to the best-rated local voice of the same kind. */
const CLOUD_NAMES: Record<string, string> = { george: "am_michael", daniel: "am_fenrir", brian: "am_puck", sarah: "af_heart" };
const DEFAULT_VOICE = "af_heart";

export const localVoiceId = (voice?: string) => {
  const v = voice?.toLowerCase().trim() ?? "";
  if (/^[ab][fm]_[a-z]+$/.test(v)) return v;
  return CLOUD_NAMES[v] ?? VOICES[v] ?? DEFAULT_VOICE;
};

/** True when the text reads as English: the only language the local voice speaks. */
export const looksEnglish = (text: string) => {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return false;
  const other = letters.filter((c) => !/[a-z]/i.test(c)).length;
  return other / letters.length < 0.02;
};

type Tensor = { data: Float32Array | BigInt64Array | Int32Array; dims: number[] };
type Tts = {
  model: (inputs: Record<string, unknown>) => Promise<Record<string, Tensor>>;
  tokenizer: (text: string, opts: { truncation: boolean }) => { input_ids: Tensor };
  Tensor: new (type: string, data: Float32Array | number[], dims: number[]) => unknown;
};

let loading: Promise<Tts> | null = null;

const loadModel = (onProgress?: (text: string) => void) => {
  loading ??= (async () => {
    const { StyleTextToSpeech2Model, AutoTokenizer, Tensor } = await import("@huggingface/transformers");
    const progress = (p: { status?: string; progress?: number }) => {
      if (p.status === "progress" && typeof p.progress === "number")
        onProgress?.(`Downloading the local voice ${Math.round(p.progress)}% (first time only)`);
    };
    const make = (device: "webgpu" | "wasm") =>
      StyleTextToSpeech2Model.from_pretrained(MODEL, { device, dtype: device === "webgpu" ? "fp32" : "q8", progress_callback: progress });
    // WebGPU only when an adapter really exists (headless and remote sessions often expose the API without one).
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    const webgpu = Boolean(gpu && (await gpu.requestAdapter().catch(() => null)));
    let model: Awaited<ReturnType<typeof make>>;
    try {
      model = await make(webgpu ? "webgpu" : "wasm");
    } catch (err) {
      if (!webgpu) throw err;
      model = await make("wasm");
    }
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
    return { model, tokenizer, Tensor } as unknown as Tts;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
};

type Phonemizer = { phonemize: (text: string, language?: string) => Promise<string[]> };
let phonemizer: Promise<Phonemizer> | null = null;
// Loaded at runtime from the CDN on purpose (see the header): the bundler must not follow it.
const importUrl = new Function("url", "return import(url)") as (url: string) => Promise<Phonemizer>;
const loadPhonemizer = () => {
  phonemizer ??= importUrl(PHONEMIZER_URL);
  phonemizer.catch(() => {
    phonemizer = null;
  });
  return phonemizer;
};

const voiceCache = new Map<string, Promise<Float32Array>>();
const loadVoice = (id: string) => {
  let p = voiceCache.get(id);
  if (!p) {
    p = fetch(`${VOICES_URL}/${id}.bin`).then(async (r) => {
      if (!r.ok) throw new Error(`Couldn't download the voice ${id} (${r.status})`);
      return new Float32Array(await r.arrayBuffer());
    });
    p.catch(() => voiceCache.delete(id));
    voiceCache.set(id, p);
  }
  return p;
};

// ---- Text → phonemes (after kokoro-js) ----

const speakYearOrTime = (m: string) => {
  if (m.includes(".")) return m;
  if (m.includes(":")) {
    const [h, min] = m.split(":").map(Number);
    return min === 0 ? `${h} o'clock` : min < 10 ? `${h} oh ${min}` : `${h} ${min}`;
  }
  const year = parseInt(m.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return m;
  const left = m.slice(0, 2);
  const right = parseInt(m.slice(2, 4), 10);
  const s = m.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${s}`;
    if (right < 10) return `${left} oh ${right}${s}`;
  }
  return `${left} ${right}${s}`;
};

const speakMoney = (m: string) => {
  const unit = m[0] === "$" ? "dollar" : "pound";
  if (Number.isNaN(Number(m.slice(1)))) return `${m.slice(1)} ${unit}s`;
  if (!m.includes(".")) return `${m.slice(1)} ${unit}${m.slice(1) === "1" ? "" : "s"}`;
  const [whole, frac] = m.slice(1).split(".");
  const cents = parseInt(frac.padEnd(2, "0"), 10);
  const small = m[0] === "$" ? (cents === 1 ? "cent" : "cents") : cents === 1 ? "penny" : "pence";
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${cents} ${small}`;
};

const speakDecimal = (m: string) => {
  const [whole, frac] = m.split(".");
  return `${whole} point ${frac.split("").join(" ")}`;
};

const normalize = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\(/g, "«")
    .replace(/\)/g, "»")
    .replace(/[^\S \n]/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, speakYearOrTime)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, speakMoney)
    .replace(/\d*\.\d+/g, speakDecimal)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-"))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();

const PUNCT_RUN = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;

const toPhonemes = async (text: string, british: boolean) => {
  const { phonemize } = await loadPhonemizer();
  const lang = british ? "en" : "en-us";
  const norm = normalize(text);
  // Punctuation passes through as-is (it shapes the pauses); everything between it is phonemized.
  const parts: { punct: boolean; text: string }[] = [];
  let at = 0;
  for (const m of norm.matchAll(PUNCT_RUN)) {
    if (at < (m.index ?? 0)) parts.push({ punct: false, text: norm.slice(at, m.index) });
    if (m[0].length) parts.push({ punct: true, text: m[0] });
    at = (m.index ?? 0) + m[0].length;
  }
  if (at < norm.length) parts.push({ punct: false, text: norm.slice(at) });
  const spoken = await Promise.all(parts.map(async (p) => (p.punct ? p.text : (await phonemize(p.text, lang)).join(" "))));
  let out = spoken
    .join("")
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");
  if (!british) out = out.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return out.trim();
};

/** Sounds in a phoneme string: letters only (no stress marks, length marks, spaces or punctuation). */
const soundCount = (phonemes: string) => phonemes.replace(/[\sˈˌː;:,.!?¡¿—…"«»“”(){}[\]'-]/g, "").length;

// ---- Script → sentences ----

const ABBREVIATION = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|inc|ltd|co|no|e\.g|i\.e)\.$/i;

const splitSentences = (text: string) => {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…]["')\]]?)\s+(?=["'([]?[\p{Lu}\p{N}])/u);
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && ABBREVIATION.test(out[out.length - 1])) out[out.length - 1] += ` ${p}`;
    else if (p) out.push(p);
  }
  return out;
};

/** A sentence the model can't take in one go (over ~500 sounds) splits at the comma nearest its middle. */
const splitLong = (sentence: string): string[] => {
  const commas = [...sentence.matchAll(/[,;:—]\s/g)].map((m) => (m.index ?? 0) + 1);
  if (!commas.length) {
    const words = sentence.split(" ");
    const half = Math.ceil(words.length / 2);
    return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
  }
  const mid = commas.reduce((best, c) => (Math.abs(c - sentence.length / 2) < Math.abs(best - sentence.length / 2) ? c : best));
  return [sentence.slice(0, mid).trim(), sentence.slice(mid).trim()];
};

// ---- Synthesis ----

type Spoken = { text: string; audio: Float32Array; words: { text: string; startSec: number; endSec: number }[] };

const speakChunk = async (tts: Tts, voice: Float32Array, text: string, british: boolean, speed: number): Promise<Spoken[]> => {
  const phonemes = await toPhonemes(text, british);
  const { input_ids } = tts.tokenizer(phonemes, { truncation: false });
  const tokens = input_ids.dims.at(-1) ?? 0;
  if (tokens > 510 && text.split(" ").length > 3) {
    const out: Spoken[] = [];
    for (const part of splitLong(text)) out.push(...(await speakChunk(tts, voice, part, british, speed)));
    return out;
  }
  const row = 256 * Math.min(Math.max(tokens - 2, 0), 509);
  const style = voice.slice(row, row + 256);
  const outputs = await tts.model({
    input_ids,
    style: new tts.Tensor("float32", style, [1, 256]),
    speed: new tts.Tensor("float32", [speed], [1]),
  });
  const audio = Float32Array.from(outputs.waveform.data as Float32Array);
  return [{ text, audio, words: await placeWords(text, phonemes, tokens, audio, outputs, british) }];
};

/**
 * Times for the sentence's words. Each word gets a share of the sentence's sounds (from phonemizing
 * the word alone, scaled to the sentence), and the model's per-sound durations turn sound positions
 * into seconds. Without durations, the sounds spread evenly across the voiced part of the audio.
 */
const placeWords = async (
  text: string,
  phonemes: string,
  tokens: number,
  audio: Float32Array,
  outputs: Record<string, Tensor>,
  british: boolean,
): Promise<{ text: string; startSec: number; endSec: number }[]> => {
  const words = text.split(" ").filter(Boolean);
  const total = audio.length / LOCAL_TTS_RATE;
  // Sound boundaries in seconds, from the model's durations when it gives them.
  const sounds = [...phonemes].filter((c) => soundCount(c) === 1);
  let edges: number[] | null = null;
  const durTensor = outputs.durations ?? outputs.pred_dur ?? outputs.duration;
  // Durations line up with the phoneme characters only when the tokenizer kept every one of them.
  if (durTensor && tokens === [...phonemes].length + 2) {
    const dur = Array.from(durTensor.data as ArrayLike<number | bigint>, Number);
    const unit =
      total /
      Math.max(
        1,
        dur.reduce((a, b) => a + b, 0),
      );
    // Durations follow the tokens: a pad, then one per character of the phoneme string, then a pad.
    const chars = [...phonemes];
    edges = [];
    let t = (dur[0] ?? 0) * unit;
    for (let i = 0; i < chars.length; i++) {
      const d = (dur[i + 1] ?? 0) * unit;
      if (soundCount(chars[i]) === 1) edges.push(t);
      t += d;
    }
    edges.push(t);
  }
  if (!edges || edges.length !== sounds.length + 1) {
    // Even spread across the voiced part (first to last sample above a low threshold).
    let first = 0;
    let last = audio.length - 1;
    while (first < audio.length && Math.abs(audio[first]) < 0.01) first++;
    while (last > first && Math.abs(audio[last]) < 0.01) last--;
    const a = first / LOCAL_TTS_RATE;
    const b = (last + 1) / LOCAL_TTS_RATE;
    edges = Array.from({ length: sounds.length + 1 }, (_, i) => a + ((b - a) * i) / Math.max(1, sounds.length));
  }
  // Each word's share of the sounds, scaled so the shares add up to the sentence.
  const shares = await Promise.all(words.map(async (w) => Math.max(1, soundCount(await toPhonemes(w, british)))));
  const sum = shares.reduce((a, b) => a + b, 0);
  const n = sounds.length;
  const timeAt = edges;
  let acc = 0;
  return words.map((w, i) => {
    const from = Math.round((acc / sum) * n);
    acc += shares[i];
    const to = Math.max(from + 1, Math.round((acc / sum) * n));
    return { text: w, startSec: timeAt[Math.min(from, n)], endSec: timeAt[Math.min(to, n)] };
  });
};

/**
 * Speaks a script with the local voice. Returns 24 kHz mono samples and the words with their times
 * (ready for captions), sentence by sentence with short natural pauses between them.
 */
export const speakLocally = async (
  script: string,
  opts: { voice?: string; speed?: number; onProgress?: (text: string) => void } = {},
): Promise<{ samples: Float32Array; words: CaptionWord[]; voice: string }> => {
  const voiceId = localVoiceId(opts.voice);
  const british = voiceId.startsWith("b");
  opts.onProgress?.("Loading the local voice…");
  const [tts, voice] = await Promise.all([loadModel(opts.onProgress), loadVoice(voiceId)]);
  const sentences = splitSentences(script);
  const pieces: Float32Array[] = [];
  const words: CaptionWord[] = [];
  let offset = 0;
  for (const [i, sentence] of sentences.entries()) {
    opts.onProgress?.(`Speaking sentence ${i + 1} of ${sentences.length}…`);
    for (const chunk of await speakChunk(tts, voice, sentence, british, opts.speed ?? 1)) {
      for (const w of chunk.words) {
        const startMs = Math.round((offset + w.startSec) * 1000);
        const endMs = Math.round((offset + w.endSec) * 1000);
        words.push({
          text: words.length ? ` ${w.text}` : w.text,
          startMs,
          endMs,
          timestampMs: Math.round((startMs + endMs) / 2),
          confidence: null,
        });
      }
      pieces.push(chunk.audio);
      offset += chunk.audio.length / LOCAL_TTS_RATE;
      // A breath between sentences; a shorter one where a long sentence was split.
      const pause = /[.!?…]["')\]]?$/.test(chunk.text) ? 0.28 : 0.12;
      pieces.push(new Float32Array(Math.round(pause * LOCAL_TTS_RATE)));
      offset += pause;
    }
  }
  const samples = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    samples.set(p, at);
    at += p.length;
  }
  return { samples, words, voice: voiceId };
};

// Dev only: speak from the console or a test driver; returns timing and the model's output names.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  Object.assign(window, {
    __reframerLocalTts: async (text: string, voice?: string) => {
      const t0 = performance.now();
      const out = await speakLocally(text, { voice, onProgress: (t) => console.info(`[tts] ${t}`) });
      return {
        seconds: out.samples.length / LOCAL_TTS_RATE,
        tookMs: Math.round(performance.now() - t0),
        voice: out.voice,
        words: out.words.map((w) => `${w.text.trim()}@${(w.startMs / 1000).toFixed(2)}-${(w.endMs / 1000).toFixed(2)}`).join(" "),
      };
    },
  });
}
