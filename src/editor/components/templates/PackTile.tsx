"use client";

import { SparklesIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { PackCard } from "@/core/packs";
import { cn } from "@/lib/utils";

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A template in a gallery: its poster, and its preview playing while it is pointed at or focused. */
export const PackTile: React.FC<{ pack: PackCard; onOpen: () => void; className?: string }> = ({ pack, onOpen, className }) => {
  const video = useRef<HTMLVideoElement>(null);
  // The preview fades in once it really plays, so a loading video never flashes black over the poster.
  const [playing, setPlaying] = useState(false);
  const start = () => {
    const v = video.current;
    if (!v || prefersReducedMotion()) return;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  };
  const stop = () => {
    video.current?.pause();
    setPlaying(false);
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={cn("group block w-full min-w-0 text-left outline-none", className)}
      aria-label={`${pack.name} template`}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-border bg-panel-2 transition-[border-color,transform] duration-150 ease-out group-hover:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring/50 group-active:scale-[0.98]">
        {pack.poster ? (
          // biome-ignore lint/performance/noImgElement: a local file the app serves as it is
          <img src={pack.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : null}
        {pack.preview ? (
          <video
            ref={video}
            src={pack.preview}
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setPlaying(true)}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out",
              playing ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
        {pack.engine !== "page" ? (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <SparklesIcon className="size-2.5" /> Agent
          </span>
        ) : null}
        <span className="tabular absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {Math.round(pack.durationSec)}s
        </span>
      </div>
      <div className="mt-1.5 truncate text-xs font-medium">{pack.name}</div>
    </button>
  );
};
