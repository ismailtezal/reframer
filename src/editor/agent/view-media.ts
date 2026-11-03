"use client";

import { getProject } from "../store/project-store";

/**
 * A look inside a source video before it goes on the timeline: frames across the asset (or a range of
 * it), numbered with their times, so in and out points are chosen by what happens in the shot.
 * Seeks with the browser's own player: WebM files from Commons often have no cue index for a demuxer.
 */

const TILE_W = 384;
const TILE_H = 216;
const COLS = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const once = (el: HTMLVideoElement, event: string, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      el.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), timeoutMs);
    el.addEventListener(event, onEvent);
    el.addEventListener("error", onError);
  });

export const viewMedia = async (assetId: string, fromSec?: number, toSec?: number, count = 12) => {
  const asset = getProject().assets[assetId];
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (asset.type !== "video")
    throw new Error("view_media looks inside videos; place photos directly, and use detect_beats or transcribe for audio.");
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = asset.src;
  try {
    if (!(await once(video, "loadeddata", 30_000))) throw new Error("This video couldn't be loaded for viewing.");
    const duration = Number.isFinite(video.duration) ? video.duration : (asset.durationSec ?? 0);
    const from = clamp(fromSec ?? 0, 0, duration);
    const to = clamp(toSec ?? duration, from, duration);
    const n = clamp(Math.round(count), 2, 16);
    const times = Array.from({ length: n }, (_, i) => Math.round((from + ((to - from) * (i + 0.5)) / n) * 10) / 10);
    const rows = Math.ceil(n / COLS);
    const sheet = document.createElement("canvas");
    sheet.width = COLS * (TILE_W + 4) - 4;
    sheet.height = rows * (TILE_H + 4) - 4;
    const g = sheet.getContext("2d");
    if (!g) throw new Error("No canvas");
    g.fillStyle = "#141414";
    g.fillRect(0, 0, sheet.width, sheet.height);
    for (const [i, t] of times.entries()) {
      const x = (i % COLS) * (TILE_W + 4);
      const y = Math.floor(i / COLS) * (TILE_H + 4);
      const seeked = once(video, "seeked", 15_000);
      video.currentTime = t;
      if (await seeked) {
        // Letterboxed, so a vertical clip looks vertical.
        const k = Math.min(TILE_W / video.videoWidth, TILE_H / video.videoHeight);
        const w = video.videoWidth * k;
        const h = video.videoHeight * k;
        g.drawImage(video, x + (TILE_W - w) / 2, y + (TILE_H - h) / 2, w, h);
      }
      const label = `${i + 1} · ${t.toFixed(1)}s`;
      g.font = "bold 18px sans-serif";
      const lw = g.measureText(label).width + 14;
      g.fillStyle = "rgba(0,0,0,0.75)";
      g.fillRect(x, y, lw, 26);
      g.fillStyle = "#fff";
      g.fillText(label, x + 7, y + 19);
    }
    return { durationSec: Math.round(duration * 10) / 10, times, dataUrl: sheet.toDataURL("image/jpeg", 0.8) };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
};
