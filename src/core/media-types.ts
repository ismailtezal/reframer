/**
 * Media types by content. Hosts often label music generically (incompetech sends
 * MP3s as application/octet-stream, Wikimedia sends Ogg as application/ogg) and
 * imports are named after the track ("Piano Between — Kevin MacLeod"), so neither
 * the header nor the name can be trusted to say what a download is.
 */

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Other spellings hosts use for the same formats. */
const ALIASES: Record<string, string> = {
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/x-flac": "audio/flac",
  "audio/x-aac": "audio/aac",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "application/ogg": "audio/ogg",
  "audio/vorbis": "audio/ogg",
  "audio/opus": "audio/ogg",
  "video/x-m4v": "video/mp4",
  "image/jpg": "image/jpeg",
};

const BY_EXTENSION: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type])),
  webm: "video/webm",
  jpeg: "image/jpeg",
  m4v: "video/mp4",
  oga: "audio/ogg",
  opus: "audio/ogg",
};

/** "Audio/MP3; charset=x" → "audio/mpeg". */
export const normalizeMediaType = (type: string) => {
  const t = type.split(";")[0].trim().toLowerCase();
  return ALIASES[t] ?? t;
};

/** The type a file name's extension implies, if it's a media extension. */
export const mediaTypeFromName = (name: string): string | null => {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext ? (BY_EXTENSION[ext] ?? null) : null;
};

const ascii = (b: Uint8Array, at: number, text: string) => [...text].every((c, i) => b[at + i] === c.charCodeAt(0));

/** The format from a file's first bytes (64 is enough, including WebM's doctype). */
export const sniffMediaType = (b: Uint8Array): string | null => {
  if (b.length < 4) return null;
  if (ascii(b, 0, "ID3")) return "audio/mpeg";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "audio/aac"; // ADTS header
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "audio/mpeg"; // MPEG audio frame sync
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return "audio/wav";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (ascii(b, 0, "OggS")) return "audio/ogg";
  if (ascii(b, 0, "fLaC")) return "audio/flac";
  if (b[0] === 0x89 && ascii(b, 1, "PNG")) return "image/png";
  if (ascii(b, 0, "GIF8")) return "image/gif";
  if (ascii(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (brand === "M4A " || brand === "M4B ") return "audio/mp4";
    if (brand === "qt  ") return "video/quicktime";
    if (brand === "avif" || brand === "avis") return "image/avif";
    return "video/mp4";
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return new TextDecoder().decode(b.subarray(0, 64)).includes("webm") ? "video/webm" : "video/x-matroska";
  }
  return null;
};

/** `name` with the extension its type calls for: ("Piano Between", audio/mpeg) → "Piano Between.mp3". */
export const withMediaExtension = (name: string, type: string) => {
  const ext = EXTENSIONS[normalizeMediaType(type)];
  return !ext || mediaTypeFromName(name) ? name : `${name}.${ext}`;
};
