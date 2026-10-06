export const secondsToFrames = (seconds: number, fps: number): number => Math.max(0, Math.round(seconds * fps));

export const framesToSeconds = (frames: number, fps: number): number => frames / fps;

/** Rounds to 2 decimals so agents see clean numbers. */
export const framesToSecondsRounded = (frames: number, fps: number): number => Math.round((frames / fps) * 100) / 100;

const pad = (n: number, width = 2) => String(Math.floor(n)).padStart(width, "0");

/** `mm:ss:ff` timecode. Hours are added when needed. */
export const formatTimecode = (frame: number, fps: number): string => {
  const totalSeconds = Math.floor(frame / fps);
  const ff = frame % fps;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${pad(minutes)}:${pad(seconds)}:${pad(ff)}`;
  return hours > 0 ? `${hours}:${base}` : base;
};

/** Broadcast-style `hh:mm:ss:ff` timecode with fixed width (transport display). */
export const formatSMPTE = (frame: number, fps: number): string => {
  const f = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(f / fps);
  return `${pad(totalSeconds / 3600)}:${pad((totalSeconds % 3600) / 60)}:${pad(totalSeconds % 60)}:${pad(f % fps)}`;
};

/** Ruler label: `0:05`, `1:30`, or `0:05:12` (with frames) when zoomed past one second per label. */
export const formatRulerLabel = (frame: number, fps: number, withFrames: boolean): string => {
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const base = `${minutes}:${pad(totalSeconds % 60)}`;
  return withFrames ? `${base}:${pad(frame % fps)}` : base;
};

/** Human friendly `m:ss.s` (used in chat, cards and the ruler). */
export const formatSeconds = (frame: number, fps: number, decimals = 1): string => {
  const total = frame / fps;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  const s = seconds.toFixed(decimals).padStart(decimals > 0 ? decimals + 3 : 2, "0");
  return `${minutes}:${s}`;
};

/** Parses `12`, `12.5`, `1:02`, `1:02.5` or `00:01:02:10` (with fps) into frames. */
export const parseTimecode = (input: string, fps: number): number | null => {
  const value = input.trim();
  if (value === "") return null;
  const parts = value.split(":");
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return secondsToFrames(nums[0], fps);
  if (nums.length === 2) return secondsToFrames(nums[0] * 60 + nums[1], fps);
  if (nums.length === 3) {
    // mm:ss:ff
    return Math.round((nums[0] * 60 + nums[1]) * fps + nums[2]);
  }
  if (nums.length === 4) {
    return Math.round((nums[0] * 3600 + nums[1] * 60 + nums[2]) * fps + nums[3]);
  }
  return null;
};

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
