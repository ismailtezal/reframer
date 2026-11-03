import { type AudioProfile, audioProfile, measureMix as measureMixWith } from "@/core/checks/sound";
import type { Project } from "@/core/schema";

export { measureSound } from "@/core/checks/sound";

/** Loudness profiles of the project's audio files, decoded in the browser (cached per file). */
const profiles = new Map<string, Promise<AudioProfile | null>>();

const profileOf = (src: string | undefined): Promise<AudioProfile | null> => {
  if (!src) return Promise.resolve(null);
  let pending = profiles.get(src);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const audio = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await res.arrayBuffer());
        const n = audio.length;
        const mono = new Float32Array(n);
        for (let c = 0; c < audio.numberOfChannels; c++) {
          const d = audio.getChannelData(c);
          for (let i = 0; i < n; i++) mono[i] += d[i] / audio.numberOfChannels;
        }
        return audioProfile(mono, audio.sampleRate);
      } catch {
        return null;
      }
    })();
    profiles.set(src, pending);
  }
  return pending;
};

/** Sound effects that stick out of the music under them, measured from the audio itself. */
export const measureMix = (project: Project): Promise<string[]> => measureMixWith(project, profileOf);
