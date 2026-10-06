/**
 * Export settings shared by the export dialog and the server renderer.
 * Modeled on media-encoder style presets: pick a preset, then override any
 * setting. Everything here is plain data so presets can be saved and reused.
 */

export type ExportFormat = "mp4" | "mov" | "webm" | "gif" | "wav" | "mp3" | "m4a";
export type VideoCodec = "h264" | "h265" | "vp9" | "prores" | "gif";
export type AudioCodec = "aac" | "opus" | "mp3" | "pcm";
export type ProResProfile = "proxy" | "light" | "standard" | "hq" | "4444";
export type EncoderSpeed = "fastest" | "fast" | "balanced" | "smallest";
export type RateControl = "quality" | "bitrate";

export type ExportSettings = {
  format: ExportFormat;
  videoCodec: VideoCodec;
  proresProfile: ProResProfile;
  /** "project" keeps the project size; a number targets that short side (720 → 1280×720 for 16:9). */
  resolution: "project" | number;
  rateControl: RateControl;
  /** Constant-quality level (CRF scale, 0–51; lower is better). */
  crf: number;
  /** Target bitrate for the "bitrate" rate control, in Mbps. */
  bitrateMbps: number;
  speed: EncoderSpeed;
  /** Hardware video encoder (NVIDIA NVENC). "auto" uses it when the machine has one. */
  hardware: "auto" | "on" | "off";
  includeAudio: boolean;
  audioCodec: AudioCodec;
  audioBitrateK: number;
  /** Draw effects and compositing on the GPU. */
  gpu: "auto" | "off";
  /** Parallel render processes. "auto" sizes it to the machine. */
  parallelism: "auto" | number;
};

export type ExportPreset = {
  id: string;
  name: string;
  group: "General" | "Web & social" | "Master & editing" | "Audio" | "Custom";
  description: string;
  settings: ExportSettings;
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "mp4",
  videoCodec: "h264",
  proresProfile: "hq",
  resolution: "project",
  rateControl: "quality",
  crf: 18,
  bitrateMbps: 12,
  speed: "fast",
  hardware: "auto",
  includeAudio: true,
  audioCodec: "aac",
  audioBitrateK: 320,
  gpu: "auto",
  parallelism: "auto",
};

const preset = (
  id: string,
  name: string,
  group: ExportPreset["group"],
  description: string,
  settings: Partial<ExportSettings>,
): ExportPreset => ({ id, name, group, description, settings: { ...DEFAULT_EXPORT_SETTINGS, ...settings } });

export const BUILTIN_PRESETS: ExportPreset[] = [
  preset("high-quality", "High quality", "General", "H.264 at project size. Plays everywhere; ideal for sharing and uploads.", {}),
  preset("fast-draft", "Fast draft", "General", "720p with the fastest encoder settings. For quick reviews.", {
    resolution: 720,
    crf: 26,
    speed: "fastest",
    audioBitrateK: 160,
  }),
  preset("small-hevc", "Small file (HEVC)", "General", "H.265 at about half the size of H.264 for the same quality.", {
    videoCodec: "h265",
    crf: 22,
  }),
  preset("youtube-1080", "YouTube 1080p", "Web & social", "H.264 1080p at YouTube's recommended upload bitrate.", {
    resolution: 1080,
    rateControl: "bitrate",
    bitrateMbps: 16,
    audioBitrateK: 384,
  }),
  preset("youtube-4k", "YouTube 4K", "Web & social", "H.264 2160p for 4K uploads. Upscales smaller projects.", {
    resolution: 2160,
    rateControl: "bitrate",
    bitrateMbps: 50,
    audioBitrateK: 384,
  }),
  preset("social", "Reels, TikTok & Shorts", "Web & social", "H.264 1080p sized for social uploads (keeps vertical framing).", {
    resolution: 1080,
    rateControl: "bitrate",
    bitrateMbps: 10,
    audioBitrateK: 256,
  }),
  preset("x", "X (Twitter)", "Web & social", "H.264 720p within X's upload limits.", {
    resolution: 720,
    rateControl: "bitrate",
    bitrateMbps: 6,
    audioBitrateK: 192,
  }),
  preset("webm", "WebM (VP9)", "Web & social", "Open web format with Opus audio. Smaller than H.264, slower to encode.", {
    format: "webm",
    videoCodec: "vp9",
    crf: 31,
    audioCodec: "opus",
    audioBitrateK: 160,
  }),
  preset("gif", "Animated GIF", "Web & social", "Silent looping GIF at 480p.", {
    format: "gif",
    videoCodec: "gif",
    resolution: 480,
    includeAudio: false,
  }),
  preset("prores-hq", "ProRes 422 HQ", "Master & editing", "Near-lossless master for color and finishing. Very large files.", {
    format: "mov",
    videoCodec: "prores",
    proresProfile: "hq",
    audioCodec: "pcm",
  }),
  preset("prores-proxy", "ProRes 422 Proxy", "Master & editing", "Lightweight ProRes for editing in other apps.", {
    format: "mov",
    videoCodec: "prores",
    proresProfile: "proxy",
    audioCodec: "pcm",
  }),
  preset("prores-4444", "ProRes 4444", "Master & editing", "Highest-quality ProRes with full chroma.", {
    format: "mov",
    videoCodec: "prores",
    proresProfile: "4444",
    audioCodec: "pcm",
  }),
  preset("audio-wav", "WAV (lossless)", "Audio", "Uncompressed 16-bit audio of the mix.", { format: "wav", audioCodec: "pcm" }),
  preset("audio-mp3", "MP3 320 kbps", "Audio", "Audio only, MP3.", { format: "mp3", audioCodec: "mp3", audioBitrateK: 320 }),
  preset("audio-m4a", "AAC (M4A)", "Audio", "Audio only, AAC in an M4A file.", { format: "m4a", audioCodec: "aac", audioBitrateK: 256 }),
];

export const isAudioOnly = (format: ExportFormat) => format === "wav" || format === "mp3" || format === "m4a";

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  mp4: "MP4",
  mov: "QuickTime (MOV)",
  webm: "WebM",
  gif: "GIF",
  wav: "WAV",
  mp3: "MP3",
  m4a: "M4A",
};

export const CODEC_LABEL: Record<VideoCodec, string> = {
  h264: "H.264",
  h265: "H.265 (HEVC)",
  vp9: "VP9",
  prores: "Apple ProRes",
  gif: "GIF",
};

export const AUDIO_CODEC_LABEL: Record<AudioCodec, string> = { aac: "AAC", opus: "Opus", mp3: "MP3", pcm: "PCM (uncompressed)" };

export const PRORES_LABEL: Record<ProResProfile, string> = {
  proxy: "422 Proxy",
  light: "422 LT",
  standard: "422",
  hq: "422 HQ",
  "4444": "4444",
};

/** Video codecs each container can hold. */
export const CODECS_FOR_FORMAT: Record<ExportFormat, VideoCodec[]> = {
  mp4: ["h264", "h265"],
  mov: ["prores", "h264", "h265"],
  webm: ["vp9"],
  gif: ["gif"],
  wav: [],
  mp3: [],
  m4a: [],
};

/** Audio codecs each container can hold. */
export const AUDIO_CODECS_FOR_FORMAT: Record<ExportFormat, AudioCodec[]> = {
  mp4: ["aac", "mp3"],
  mov: ["pcm", "aac"],
  webm: ["opus"],
  gif: [],
  wav: ["pcm"],
  mp3: ["mp3"],
  m4a: ["aac"],
};

export const EXTENSION: Record<ExportFormat, string> = {
  mp4: "mp4",
  mov: "mov",
  webm: "webm",
  gif: "gif",
  wav: "wav",
  mp3: "mp3",
  m4a: "m4a",
};

/** Codecs whose encoders take a constant-quality level. */
export const supportsCrf = (codec: VideoCodec) => codec === "h264" || codec === "h265" || codec === "vp9";
/** Codecs that can be encoded on NVIDIA GPUs. */
export const supportsHardware = (codec: VideoCodec) => codec === "h264" || codec === "h265";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Output size for a resolution choice. Always even, as 4:2:0 encoders require. */
export const outputSize = (project: { width: number; height: number }, resolution: ExportSettings["resolution"]) => {
  if (resolution === "project") return { width: even(project.width), height: even(project.height), scale: 1 };
  const short = Math.min(project.width, project.height);
  const scale = resolution / short;
  return { width: even(project.width * scale), height: even(project.height * scale), scale };
};

/** Resolution choices offered for a project (its own size plus common targets). */
export const resolutionOptions = (project: { width: number; height: number }) => {
  const short = Math.min(project.width, project.height);
  const options: { id: ExportSettings["resolution"]; label: string }[] = [{ id: "project", label: `${project.width}×${project.height}` }];
  for (const target of [480, 720, 1080, 1440, 2160]) {
    if (target === short) continue;
    const { width, height } = outputSize(project, target);
    options.push({ id: target, label: `${width}×${height}` });
  }
  return options;
};

/** Fills in defaults and repairs combinations a container can't hold. */
export const normalizeExportSettings = (input: Partial<ExportSettings> | undefined): ExportSettings => {
  const s: ExportSettings = { ...DEFAULT_EXPORT_SETTINGS, ...(input ?? {}) };
  if (!(s.format in CODECS_FOR_FORMAT)) s.format = "mp4";
  const codecs = CODECS_FOR_FORMAT[s.format];
  if (codecs.length && !codecs.includes(s.videoCodec)) s.videoCodec = codecs[0];
  const audio = AUDIO_CODECS_FOR_FORMAT[s.format];
  if (audio.length && !audio.includes(s.audioCodec)) s.audioCodec = audio[0];
  if (s.format === "gif") s.includeAudio = false;
  if (isAudioOnly(s.format)) s.includeAudio = true;
  if (!["proxy", "light", "standard", "hq", "4444"].includes(s.proresProfile)) s.proresProfile = "hq";
  if (s.resolution !== "project") s.resolution = clamp(Math.round(Number(s.resolution) || 1080), 144, 4320);
  s.rateControl = s.rateControl === "bitrate" ? "bitrate" : "quality";
  s.crf = clamp(Math.round(Number(s.crf) || 18), 0, s.videoCodec === "vp9" ? 63 : 51);
  s.bitrateMbps = clamp(Number(s.bitrateMbps) || 12, 0.5, 400);
  if (!["fastest", "fast", "balanced", "smallest"].includes(s.speed)) s.speed = "fast";
  if (!["auto", "on", "off"].includes(s.hardware)) s.hardware = "auto";
  s.audioBitrateK = clamp(Math.round(Number(s.audioBitrateK) || 320), 64, 512);
  s.gpu = s.gpu === "off" ? "off" : "auto";
  s.parallelism = s.parallelism === "auto" ? "auto" : clamp(Math.round(Number(s.parallelism) || 1), 1, 8);
  s.includeAudio = !!s.includeAudio;
  return s;
};

/** Rough output size in bytes, for the dialog's estimate. Null when it can't be guessed. */
export const estimateBytes = (s: ExportSettings, size: { width: number; height: number }, fps: number, seconds: number) => {
  const audio = s.includeAudio ? (s.audioCodec === "pcm" ? 48000 * 2 * 2 : (s.audioBitrateK * 1000) / 8) * seconds : 0;
  if (isAudioOnly(s.format)) return audio;
  const pixelsPerSec = size.width * size.height * fps;
  let videoBitsPerSec: number;
  if (s.videoCodec === "prores") {
    // Apple's published targets at 1080p30, scaled by pixel rate.
    const at1080p30 = { proxy: 45e6, light: 102e6, standard: 147e6, hq: 220e6, "4444": 330e6 }[s.proresProfile];
    videoBitsPerSec = at1080p30 * (pixelsPerSec / (1920 * 1080 * 30));
  } else if (s.videoCodec === "gif") {
    return null;
  } else if (s.rateControl === "bitrate") {
    videoBitsPerSec = s.bitrateMbps * 1e6;
  } else {
    // Empirical bits-per-pixel for motion graphics + footage at CRF 18, halving every 6 CRF steps.
    const base = s.videoCodec === "h265" ? 0.05 : s.videoCodec === "vp9" ? 0.06 : 0.08;
    const ref = s.videoCodec === "vp9" ? 31 : 18;
    videoBitsPerSec = pixelsPerSec * base * 2 ** ((ref - s.crf) / 6);
  }
  return (videoBitsPerSec / 8) * seconds + audio;
};

/** One-line summary such as "H.264 · 1920×1080 · CRF 18 · AAC 320 kbps". */
export const describeSettings = (s: ExportSettings, project: { width: number; height: number }) => {
  if (isAudioOnly(s.format)) {
    return [
      FORMAT_LABEL[s.format],
      s.audioCodec === "pcm" ? "16-bit PCM" : `${AUDIO_CODEC_LABEL[s.audioCodec]} ${s.audioBitrateK} kbps`,
    ].join(" · ");
  }
  const { width, height } = outputSize(project, s.resolution);
  const parts = [CODEC_LABEL[s.videoCodec] + (s.videoCodec === "prores" ? ` ${PRORES_LABEL[s.proresProfile]}` : ""), `${width}×${height}`];
  if (supportsCrf(s.videoCodec)) parts.push(s.rateControl === "bitrate" ? `${s.bitrateMbps} Mbps` : `CRF ${s.crf}`);
  if (s.includeAudio) parts.push(s.audioCodec === "pcm" ? "PCM audio" : `${AUDIO_CODEC_LABEL[s.audioCodec]} ${s.audioBitrateK} kbps`);
  return parts.join(" · ");
};
