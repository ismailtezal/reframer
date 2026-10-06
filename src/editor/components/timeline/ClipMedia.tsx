"use client";

import { memo, useEffect, useState } from "react";
import type { Asset, Clip } from "@/core/schema";
import { loadPeaks, loadThumbLayout, peaksInRange, peekPeaks, peekThumbLayout, thumbUrl } from "../../media/derived";
import { useVisibleSpan } from "./viewport";

type MediaClip = Extract<Clip, { trimStart: number }>;

/** Clip-local pixels → source seconds. */
const sourceSec = (clip: MediaClip, x: number, ppf: number, fps: number) => (clip.trimStart + (x / ppf) * clip.speed) / fps;

/**
 * Filmstrip frames for the visible part of a video clip only. Frames are small
 * JPEGs made by FFmpeg on the local server; the browser decodes them off the
 * main thread.
 */
export const Filmstrip = memo(function Filmstrip({
  clip,
  asset,
  left,
  width,
  height,
  ppf,
  fps,
}: {
  clip: MediaClip;
  asset: Asset;
  left: number;
  width: number;
  height: number;
  ppf: number;
  fps: number;
}) {
  const [layout, setLayout] = useState(() => peekThumbLayout(asset.src));
  useEffect(() => {
    if (layout !== undefined) return;
    let alive = true;
    void loadThumbLayout(asset.src).then((l) => alive && setLayout(l));
    return () => {
      alive = false;
    };
  }, [asset.src, layout]);
  const span = useVisibleSpan(left, width);
  if (!layout || !span || layout.count === 0) return null;
  const tileW = Math.max(16, Math.round((layout.width / layout.height) * height));
  const first = Math.floor(span[0] / tileW);
  const last = Math.ceil(span[1] / tileW);
  const tiles: { x: number; i: number }[] = [];
  for (let t = first; t < last; t++) {
    const center = sourceSec(clip, (t + 0.5) * tileW, ppf, fps);
    tiles.push({ x: t * tileW, i: Math.min(layout.count - 1, Math.max(0, Math.round(center / layout.interval))) });
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {tiles.map(({ x, i }) => (
        // biome-ignore lint/performance/noImgElement: tiny cached frames, decoded async
        <img
          key={x}
          src={thumbUrl(asset.src, i)}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute top-0 h-full object-cover opacity-85"
          style={{ left: x, width: tileW }}
        />
      ))}
    </div>
  );
});

/** Waveform for the visible part of an audio or video clip, one bar per ~3 px. */
export const ClipWaveform = memo(function ClipWaveform({
  clip,
  asset,
  left,
  width,
  height,
  ppf,
  fps,
  className,
}: {
  clip: MediaClip;
  asset: Asset;
  left: number;
  width: number;
  height: number;
  ppf: number;
  fps: number;
  className?: string;
}) {
  const [peaks, setPeaks] = useState(() => peekPeaks(asset.src));
  useEffect(() => {
    if (peaks !== undefined) return;
    let alive = true;
    void loadPeaks(asset.src).then((p) => alive && setPeaks(p));
    return () => {
      alive = false;
    };
  }, [asset.src, peaks]);
  const span = useVisibleSpan(left, width);
  if (!peaks || !span || height < 4) return null;
  const [x0, x1] = span;
  const bars = Math.max(1, Math.floor((x1 - x0) / 3));
  const values = peaksInRange(peaks, sourceSec(clip, x0, ppf, fps), sourceSec(clip, x1, ppf, fps), bars);
  const mid = height / 2;
  const step = (x1 - x0) / bars;
  let d = "";
  for (let i = 0; i < bars; i++) {
    const h = Math.max(1, values[i] * (height - 2));
    d += `M${(i * step + step / 2).toFixed(1)} ${(mid - h / 2).toFixed(1)}v${h.toFixed(1)}`;
  }
  return (
    <svg
      width={x1 - x0}
      height={height}
      className={className ?? "pointer-events-none absolute bottom-0"}
      style={{ left: x0, color: "var(--tone)" }}
      aria-hidden
    >
      <path d={d} stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
    </svg>
  );
});
