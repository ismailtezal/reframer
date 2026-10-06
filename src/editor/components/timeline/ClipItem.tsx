"use client";

import {
  AudioLinesIcon,
  BlocksIcon,
  CaptionsIcon,
  FilmIcon,
  ImageIcon,
  LockIcon,
  ShapesIcon,
  SparklesIcon,
  SquareIcon,
  TypeIcon,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import type { Asset, Clip } from "@/core/schema";
import { cn } from "@/lib/utils";
import { getMotionComponent } from "@/remotion/components/registry";
import { getFilmstrip } from "../../media/analyze";
import { hasDerived } from "../../media/derived";
import { Filmstrip as DerivedFilmstrip, ClipWaveform as DerivedWaveform } from "./ClipMedia";

type IconType = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

/** Clip-type colors: desaturated tones used as a low-alpha body with a brighter 1px edge. */
const TYPE_META: Record<Clip["type"], { tone: string; icon: IconType }> = {
  video: { tone: "var(--clip-video)", icon: FilmIcon },
  audio: { tone: "var(--clip-audio)", icon: AudioLinesIcon },
  image: { tone: "var(--clip-image)", icon: ImageIcon },
  text: { tone: "var(--clip-text)", icon: TypeIcon },
  shape: { tone: "var(--clip-shape)", icon: ShapesIcon },
  background: { tone: "var(--clip-background)", icon: SquareIcon },
  captions: { tone: "var(--clip-captions)", icon: CaptionsIcon },
  component: { tone: "var(--clip-component)", icon: BlocksIcon },
};

export const clipTone = (type: Clip["type"]) => TYPE_META[type].tone;
export const clipIcon = (type: Clip["type"]) => TYPE_META[type].icon;

export const clipLabel = (clip: Clip, asset?: Asset): string => {
  if (clip.name) return clip.name;
  switch (clip.type) {
    case "text":
      return clip.text.replace(/\n/g, " ");
    case "captions":
      return "Captions";
    case "component":
      return getMotionComponent(clip.component)?.name ?? clip.component.replace(/^code:/, "");
    case "background":
      return "Background";
    case "shape":
      return clip.shape;
    default:
      return asset?.name ?? clip.type;
  }
};

/** Secondary line for clips without media to show. */
const clipDetail = (clip: Clip): string | null => {
  switch (clip.type) {
    case "text":
      return [clip.style.fontFamily, clip.textAnimation?.type && clip.textAnimation.type !== "none" ? clip.textAnimation.type : null]
        .filter(Boolean)
        .join(" · ");
    case "captions":
      return `${clip.words.length} words${clip.style.preset ? ` · ${clip.style.preset}` : ""}`;
    case "component": {
      const def = getMotionComponent(clip.component);
      return def ? def.category : "Code component";
    }
    case "background":
      return clip.fill.type === "solid" ? "Solid" : clip.fill.type === "linear" ? "Linear gradient" : "Radial gradient";
    default:
      return null;
  }
};

const Waveform: React.FC<{
  peaks: number[];
  asset: Asset;
  clip: Extract<Clip, { trimStart: number }>;
  fps: number;
  width: number;
  height: number;
  className?: string;
}> = memo(({ peaks, asset, clip, fps, width, height, className }) => {
  const dur = asset.durationSec ?? 0;
  if (!dur || peaks.length === 0 || width < 4 || height < 4) return null;
  const startSec = clip.trimStart / fps;
  const lenSec = (clip.duration * clip.speed) / fps;
  const bars = Math.max(1, Math.min(Math.floor(width / 2.5), 900));
  const mid = height / 2;
  let d = "";
  for (let i = 0; i < bars; i++) {
    const t = startSec + (lenSec * (i + 0.5)) / bars;
    const v = peaks[Math.min(peaks.length - 1, Math.floor((t / dur) * peaks.length))] ?? 0;
    const h = Math.max(1, v * (height - 2));
    const x = (i / bars) * width;
    d += `M${x.toFixed(1)} ${(mid - h / 2).toFixed(1)}v${h.toFixed(1)}`;
  }
  return (
    <svg
      width={width}
      height={height}
      className={cn("pointer-events-none absolute left-0", className)}
      style={{ color: "var(--tone)" }}
      aria-hidden
    >
      <path d={d} stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
    </svg>
  );
});
Waveform.displayName = "Waveform";

const Filmstrip: React.FC<{
  asset: Asset;
  clip: Extract<Clip, { trimStart: number }>;
  fps: number;
  width: number;
  height: number;
}> = ({ asset, clip, fps, width, height }) => {
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    if (asset.durationSec) getFilmstrip(asset.src, asset.durationSec, 16).then((f) => alive && setFrames(f));
    return () => {
      alive = false;
    };
  }, [asset.src, asset.durationSec]);
  const aspect = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
  const tileW = Math.max(20, Math.round(height * aspect));
  const tiles = Math.max(1, Math.ceil(width / tileW));
  const dur = asset.durationSec ?? 1;
  return (
    <div className="pointer-events-none absolute inset-0 flex overflow-hidden">
      {Array.from({ length: tiles }, (_, i) => {
        const t = (clip.trimStart + ((i + 0.5) / tiles) * clip.duration * clip.speed) / fps;
        const src = frames.length ? frames[Math.min(frames.length - 1, Math.floor((t / dur) * frames.length))] : asset.thumbnail;
        return src ? (
          // biome-ignore lint/performance/noImgElement: tiny data-URL thumbnails
          // biome-ignore lint/suspicious/noArrayIndexKey: tiles are positional
          <img key={i} src={src} alt="" className="h-full shrink-0 object-cover opacity-85" style={{ width: tileW }} draggable={false} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: tiles are positional
          <div key={i} className="h-full shrink-0" style={{ width: tileW }} />
        );
      })}
    </div>
  );
};

const TrimHandle: React.FC<{
  side: "start" | "end";
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}> = ({ side, selected, onPointerDown }) => (
  <span
    className={cn("absolute inset-y-0 z-10 flex w-2 cursor-ew-resize", side === "start" ? "left-0 justify-start" : "right-0 justify-end")}
    onPointerDown={onPointerDown}
  >
    <span
      className={cn(
        "flex h-full w-1.5 items-center justify-center transition-colors duration-150",
        side === "start" ? "rounded-l-[5px]" : "rounded-r-[5px]",
        selected ? "bg-brand" : "bg-transparent group-hover/clip:bg-foreground/20",
      )}
    >
      {selected ? <span className="h-3 w-px rounded-full bg-brand-foreground/80" /> : null}
    </span>
  </span>
);

export type ClipItemProps = {
  clip: Clip;
  asset?: Asset;
  left: number;
  width: number;
  height: number;
  fps: number;
  ppf: number;
  selected: boolean;
  dragging: boolean;
  locked: boolean;
  /** 0..1 strength of the agent glow, null when not recently touched */
  agentGlow: number | null;
  focusedProperty: string | null;
  onPointerDownBody: (e: React.PointerEvent, clip: Clip) => void;
  onPointerDownEdge: (e: React.PointerEvent, clip: Clip, edge: "start" | "end") => void;
  onContextMenu?: (e: React.MouseEvent, clip: Clip) => void;
};

const INSET = 3;
const LABEL_HEIGHT = 18;

export const ClipItem = memo(function ClipItem({
  clip,
  asset,
  left,
  width,
  height,
  fps,
  ppf,
  selected,
  dragging,
  locked,
  agentGlow,
  focusedProperty,
  onPointerDownBody,
  onPointerDownEdge,
}: ClipItemProps) {
  const meta = TYPE_META[clip.type];
  const Icon = meta.icon;
  const label = clipLabel(clip, asset);
  const innerH = height - INSET * 2;
  const byAgent = clip.meta?.createdBy === "ai" || clip.meta?.createdBy === "agent";
  // Clips the agent just added settle in once; existing clips never re-animate.
  const [arrive] = useState(() => byAgent && agentGlow !== null);
  const hasFilmstrip = !!asset && clip.type === "video" && width > 32;
  // Media served by the local server has FFmpeg-made thumbnails and peaks.
  const derived = hasDerived(asset?.src);
  const hasImage = !!asset?.thumbnail && clip.type === "image" && width > 32;
  const onMedia = hasFilmstrip || hasImage;
  const detail = !onMedia && clip.type !== "audio" && width > 90 && innerH >= 40 ? clipDetail(clip) : null;
  const keyframeTrack = focusedProperty ? clip.keyframes?.[focusedProperty] : undefined;
  const keyframeFrames = selected ? [...new Set(Object.values(clip.keyframes ?? {}).flatMap((t) => t.map((k) => k.frame)))] : [];

  return (
    <div
      data-timeline-clip={clip.id}
      className={cn(
        "group/clip absolute overflow-hidden rounded-[5px] select-none [contain:layout_style]",
        "bg-[color-mix(in_oklch,var(--tone)_24%,transparent)] transition-[background-color,opacity] duration-150 hover:bg-[color-mix(in_oklch,var(--tone)_32%,transparent)]",
        clip.hidden && "opacity-40",
        selected && "z-10 ring-2 ring-brand",
        dragging && "z-20 opacity-90 shadow-[0_10px_28px_-8px_rgb(0_0_0/0.7)]",
        locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
      )}
      style={
        {
          "--tone": meta.tone,
          top: INSET,
          bottom: INSET,
          left,
          width: Math.max(2, width),
          transformOrigin: "left center",
          animation: arrive ? "clip-arrive 320ms var(--ease-out-ui)" : undefined,
        } as React.CSSProperties
      }
      onPointerDown={(e) => !locked && onPointerDownBody(e, clip)}
    >
      {hasFilmstrip && asset && clip.type === "video" ? (
        derived ? (
          <DerivedFilmstrip clip={clip} asset={asset} left={left} width={width} height={innerH} ppf={ppf} fps={fps} />
        ) : (
          <Filmstrip asset={asset} clip={clip} fps={fps} width={width} height={innerH} />
        )
      ) : null}
      {hasImage && asset ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-85"
          style={{
            backgroundImage: `url(${asset.thumbnail})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
          }}
        />
      ) : null}
      {onMedia ? <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/65 to-transparent" /> : null}

      {derived && asset && clip.type === "audio" ? (
        <DerivedWaveform clip={clip} asset={asset} left={left} width={width} height={innerH - LABEL_HEIGHT} ppf={ppf} fps={fps} />
      ) : null}
      {derived && asset && clip.type === "video" && asset.hasAudio !== false && innerH > 36 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3.5 bg-black/45">
          <DerivedWaveform
            clip={clip}
            asset={asset}
            left={left}
            width={width}
            height={14}
            ppf={ppf}
            fps={fps}
            className="pointer-events-none absolute top-0"
          />
        </div>
      ) : null}
      {!derived && asset?.waveform && clip.type === "audio" ? (
        <Waveform
          peaks={asset.waveform}
          asset={asset}
          clip={clip}
          fps={fps}
          width={width}
          height={innerH - LABEL_HEIGHT}
          className="bottom-0"
        />
      ) : null}
      {!derived && asset?.waveform && clip.type === "video" && asset.hasAudio !== false && innerH > 36 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3.5 bg-black/45">
          <Waveform peaks={asset.waveform} asset={asset} clip={clip} fps={fps} width={width} height={14} className="top-0" />
        </div>
      ) : null}

      <div
        className={cn(
          "relative flex items-center gap-1 px-1.5 text-[11px] leading-none font-medium",
          onMedia ? "text-white" : "text-foreground/90",
        )}
        style={{ height: LABEL_HEIGHT }}
      >
        {width > 22 ? <Icon className="size-3 shrink-0" style={{ color: "var(--tone)" }} /> : null}
        {width > 44 ? <span className="min-w-0 truncate">{label}</span> : null}
        {width > 70 && (byAgent || locked) ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
            {byAgent ? <SparklesIcon className="size-2.5 opacity-50" aria-label="Made by an agent" /> : null}
            {locked ? <LockIcon className="size-2.5 opacity-70" aria-label="Locked" /> : null}
          </span>
        ) : null}
      </div>
      {detail ? <div className="relative truncate px-1.5 text-[10px] leading-3 text-muted-foreground">{detail}</div> : null}

      {clip.transitionIn ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 border-r border-foreground/15 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.1)_0_1.5px,transparent_1.5px_5px)]"
          style={{ width: Math.max(4, clip.transitionIn.duration * ppf) }}
          title={`Transition in: ${clip.transitionIn.type}`}
        />
      ) : null}

      {keyframeFrames.map((f) => (
        <span
          key={f}
          className={cn(
            "pointer-events-none absolute bottom-1 size-[7px] -translate-x-1/2 rotate-45 rounded-[1px] ring-1 ring-black/50",
            keyframeTrack?.some((k) => k.frame === f) ? "bg-brand" : "bg-foreground/75",
          )}
          style={{ left: f * ppf }}
        />
      ))}

      {locked ? (
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_5px,rgb(255_255_255/0.05)_5px_10px)]" />
      ) : null}

      {/* 1px edge in the clip's tone, drawn above the media */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--tone)_55%,transparent)]" />

      {agentGlow !== null ? (
        <>
          <div className="ai-shimmer pointer-events-none absolute inset-0" style={{ opacity: agentGlow * 0.8 }} />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1.5px_var(--ai)]"
            style={{ opacity: agentGlow }}
          />
        </>
      ) : null}

      {!locked ? (
        <>
          <TrimHandle
            side="start"
            selected={selected}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDownEdge(e, clip, "start");
            }}
          />
          <TrimHandle
            side="end"
            selected={selected}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDownEdge(e, clip, "end");
            }}
          />
        </>
      ) : null}
    </div>
  );
});
