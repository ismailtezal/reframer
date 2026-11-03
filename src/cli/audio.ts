import { type AudioProfile, audioProfile } from "@/core/checks/sound";
import { runFfmpeg } from "@/server/ffmpeg";
import { resolveMediaPath } from "./media-server";

/**
 * Loudness profiles of a project's audio for the mix check, decoded with FFmpeg the way the editor's
 * browser decodes them (22.05 kHz, channels averaged to mono).
 */
export const audioProfiles = (appRoot: string) => {
  const cache = new Map<string, Promise<AudioProfile | null>>();
  return (src: string | undefined): Promise<AudioProfile | null> => {
    if (!src) return Promise.resolve(null);
    let pending = cache.get(src);
    if (!pending) {
      pending = (async () => {
        const file = /^https?:/i.test(src) ? src : resolveMediaPath(appRoot, src.split("?")[0]);
        if (!file) return null;
        const chunks: Buffer[] = [];
        try {
          await runFfmpeg(["-v", "error", "-i", file, "-vn", "-ac", "2", "-ar", "22050", "-f", "f32le", "pipe:1"], {
            onStdout: (chunk) => chunks.push(chunk),
          });
        } catch {
          return null;
        }
        const raw = Buffer.concat(chunks);
        // Copied out: a pooled Buffer's offset needn't be 4-byte aligned for a Float32Array view.
        const stereo = new Float32Array(Math.floor(raw.byteLength / 4));
        new Uint8Array(stereo.buffer).set(raw.subarray(0, stereo.length * 4));
        const mono = new Float32Array(Math.floor(stereo.length / 2));
        for (let i = 0; i < mono.length; i++) mono[i] = (stereo[2 * i] + stereo[2 * i + 1]) / 2;
        return mono.length ? audioProfile(mono, 22050) : null;
      })();
      cache.set(src, pending);
    }
    return pending;
  };
};
