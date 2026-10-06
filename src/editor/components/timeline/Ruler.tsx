"use client";

import { SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatRulerLabel, formatSeconds } from "@/core/time";
import { useAgentStore } from "../../store/agent-store";
import { seek, usePlaybackStore } from "../../store/playback-store";
import { useProjectStore } from "../../store/project-store";
import { HEADER_WIDTH, RULER_HEIGHT, rulerStep, useTimeline } from "./geometry";

const MARKER_COLORS: Record<string, string> = {
  note: "oklch(0.76 0.1 250)",
  beat: "oklch(0.82 0.12 85)",
  chapter: "oklch(0.78 0.11 160)",
  "ai-flag": "var(--ai)",
};

/** Visible horizontal range of the timeline scroller, so the ruler only draws what's on screen. */
const useVisibleRange = (scrollRef: React.RefObject<HTMLDivElement | null>) => {
  const [range, setRange] = useState({ left: 0, width: 2000 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRange({ left: el.scrollLeft, width: el.clientWidth }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollRef]);
  return range;
};

const PlayheadHandle = () => {
  const { ppf } = useTimeline();
  const frame = usePlaybackStore((s) => s.frame);
  return (
    <svg
      width={11}
      height={14}
      viewBox="0 0 11 14"
      className="pointer-events-none absolute bottom-0 -translate-x-1/2 text-playhead"
      style={{ left: frame * ppf + 0.5 }}
      aria-hidden
    >
      <path
        d="M1.5 0h8A1.5 1.5 0 0 1 11 1.5v7.3a1.5 1.5 0 0 1-.48 1.1L6.52 13.6a1.5 1.5 0 0 1-2.04 0L.48 9.9A1.5 1.5 0 0 1 0 8.8V1.5A1.5 1.5 0 0 1 1.5 0Z"
        fill="currentColor"
      />
    </svg>
  );
};

const AgentTag = () => {
  const { ppf } = useTimeline();
  const frame = useAgentStore((s) => s.frame);
  const status = useAgentStore((s) => s.status);
  const name = useAgentStore((s) => s.agentName);
  if (status === "idle" || frame === null) return null;
  return (
    <div
      className="pointer-events-none absolute top-0.5 left-0 transition-transform duration-250 ease-out-strong motion-reduce:transition-none"
      style={{ transform: `translateX(${frame * ppf}px)` }}
    >
      <div className="flex -translate-x-1/2 items-center gap-1 rounded-sm bg-ai px-1.5 py-px text-[10px] font-medium whitespace-nowrap text-ai-foreground">
        <SparklesIcon className="size-2.5" />
        {name ?? "Agent"}
      </div>
    </div>
  );
};

export const Ruler = () => {
  const { fps, ppf, contentWidth, scrollRef } = useTimeline();
  const markers = useProjectStore((s) => s.project?.markers ?? []);
  const inFrame = usePlaybackStore((s) => s.inFrame);
  const outFrame = usePlaybackStore((s) => s.outFrame);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisibleRange(scrollRef);
  const { major, minor } = rulerStep(ppf, fps);
  const withFrames = major < fps;

  // Draw ticks for the visible window (plus a margin), never the whole timeline.
  const fromX = Math.max(0, visible.left - HEADER_WIDTH - 200);
  const toX = Math.min(contentWidth, visible.left + visible.width + 200);
  const firstFrame = Math.floor(fromX / ppf / minor) * minor;
  const lastFrame = Math.ceil(toX / ppf);
  let majorPath = "";
  let minorPath = "";
  const labels: { frame: number; x: number }[] = [];
  for (let f = firstFrame; f <= lastFrame; f += minor) {
    const x = Math.round(f * ppf) + 0.5;
    if (f % major === 0) {
      majorPath += `M${x} ${RULER_HEIGHT - 12}V${RULER_HEIGHT}`;
      labels.push({ frame: f, x });
    } else {
      minorPath += `M${x} ${RULER_HEIGHT - 5}V${RULER_HEIGHT}`;
    }
  }

  const scrubTo = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    seek(Math.max(0, Math.round((clientX - rect.left) / ppf)));
  };

  return (
    <div
      ref={ref}
      className="relative shrink-0 cursor-ew-resize overflow-hidden border-b border-border bg-panel select-none"
      style={{ width: contentWidth, height: RULER_HEIGHT }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        scrubTo(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) scrubTo(e.clientX);
      }}
    >
      {inFrame !== null && outFrame !== null && outFrame > inFrame ? (
        <div
          className="pointer-events-none absolute inset-y-0 border-x border-brand/60 bg-brand/[0.12]"
          style={{ left: inFrame * ppf, width: (outFrame - inFrame) * ppf }}
        />
      ) : null}
      <svg className="pointer-events-none absolute top-0" style={{ left: 0, width: contentWidth, height: RULER_HEIGHT }} aria-hidden>
        <path d={minorPath} className="stroke-foreground/15" strokeWidth={1} />
        <path d={majorPath} className="stroke-foreground/35" strokeWidth={1} />
      </svg>
      {labels.map((l) => (
        <span
          key={l.frame}
          className="tabular pointer-events-none absolute top-1.5 pl-1 text-[10px] leading-none text-muted-foreground"
          style={{ left: l.x }}
        >
          {formatRulerLabel(l.frame, fps, withFrames)}
        </span>
      ))}
      {markers.map((m) =>
        m.kind === "beat" ? (
          <div
            key={m.id}
            className="pointer-events-none absolute bottom-0 h-1.5 w-0.5 -translate-x-1/2 rounded-t-full"
            style={{ left: m.frame * ppf, background: MARKER_COLORS.beat }}
          />
        ) : (
          <div
            key={m.id}
            className="absolute bottom-0 h-3.5 -translate-x-1/2 cursor-pointer"
            style={{ left: m.frame * ppf }}
            title={`${m.label} · ${formatSeconds(m.frame, fps)}`}
          >
            <div className="size-2 rotate-45 rounded-[1px]" style={{ background: m.color ?? MARKER_COLORS[m.kind] }} />
          </div>
        ),
      )}
      <AgentTag />
      <PlayheadHandle />
    </div>
  );
};
