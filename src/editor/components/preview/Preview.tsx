"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  ScanIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ASPECT_PRESETS, type AspectPresetId } from "@/core/defaults";
import { updateSettings } from "@/core/ops";
import { describeAspect } from "@/core/project-utils";
import { formatSMPTE, parseTimecode } from "@/core/time";
import { cn } from "@/lib/utils";
import { getCompositionMetadata, ProjectComposition } from "@/remotion/ProjectComposition";
import { run } from "../../actions";
import { useAgentStore } from "../../store/agent-store";
import { getPlayer, registerPlayer, seek, togglePlay, usePlaybackStore } from "../../store/playback-store";
import { useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { CanvasOverlay } from "./CanvasOverlay";

const STAGE_PADDING = 24;
const ZOOM_LEVELS = [0.25, 0.5, 1, 2] as const;

const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
};

export const Preview = () => {
  const project = useProjectStore((s) => s.project);
  const zoom = useUIStore((s) => s.previewZoom);
  const playerRef = useRef<PlayerRef>(null);
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const [playerRoot, setPlayerRoot] = useState<HTMLElement | null>(null);
  const loop = usePlaybackStore((s) => s.loop);

  useEffect(() => {
    const player = playerRef.current;
    registerPlayer(player);
    if (!player) return;
    setPlayerRoot(player.getContainerNode());
    const onFrame = (e: { detail: { frame: number } }) => usePlaybackStore.getState().setFrame(e.detail.frame);
    const onPlay = () => usePlaybackStore.getState().setPlaying(true);
    const onPause = () => usePlaybackStore.getState().setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
      registerPlayer(null);
    };
  }, []);

  if (!project) return null;
  const meta = getCompositionMetadata(project);
  const availW = Math.max(0, area.width - STAGE_PADDING * 2);
  const availH = Math.max(0, area.height - STAGE_PADDING * 2);
  const fit = Math.min(availW / meta.width, availH / meta.height) || 0;
  const scale = zoom === "fit" ? fit : zoom;
  const displayW = Math.floor(meta.width * scale);
  const displayH = Math.floor(meta.height * scale);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="relative min-h-0 flex-1">
        <div ref={areaRef} className={cn("absolute inset-0", zoom === "fit" ? "overflow-hidden" : "overflow-auto")}>
          <div className="flex min-h-full min-w-full items-center justify-center" style={{ padding: STAGE_PADDING, width: "max-content" }}>
            <div className="relative bg-black ring-1 ring-white/[0.08]" style={{ width: displayW, height: displayH }}>
              <Player
                ref={playerRef}
                component={ProjectComposition}
                inputProps={{ project, editor: true }}
                durationInFrames={meta.durationInFrames}
                compositionWidth={meta.width}
                compositionHeight={meta.height}
                fps={meta.fps}
                style={{ width: displayW, height: displayH }}
                controls={false}
                clickToPlay={false}
                doubleClickToFullscreen={false}
                spaceKeyToPlayOrPause={false}
                loop={loop}
                errorFallback={({ error }) => (
                  <div className="flex h-full items-center justify-center bg-black p-6 text-center text-sm text-rose-300">
                    Preview error: {error.message}
                  </div>
                )}
              />
              {scale > 0 ? <CanvasOverlay scale={scale} playerRoot={playerRoot} /> : null}
            </div>
          </div>
        </div>
        <AgentStatusChip />
      </div>
      <TransportBar
        durationInFrames={meta.durationInFrames}
        fps={meta.fps}
        width={project.settings.width}
        height={project.settings.height}
      />
    </div>
  );
};

const AgentStatusChip = () => {
  const status = useAgentStore((s) => s.status);
  const text = useAgentStore((s) => s.statusText);
  const name = useAgentStore((s) => s.agentName);
  if (status === "idle") return null;
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-popover/95 px-3 py-1.5 text-xs shadow-lg ring-1 ring-ai/35",
          status === "error" && "ring-destructive/50",
        )}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ai opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-1.5 rounded-full bg-ai" />
        </span>
        <span className="font-medium text-ai">{name ?? "Agent"}</span>
        <span className="max-w-[46ch] truncate text-muted-foreground">{text ?? (status === "thinking" ? "Thinking…" : "Working…")}</span>
      </div>
    </div>
  );
};

const TransportButton: React.FC<{
  label: string;
  kbd?: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, kbd, onClick, active, children, className }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} aria-pressed={active} className={className}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {label}
      {kbd ? <Kbd>{kbd}</Kbd> : null}
    </TooltipContent>
  </Tooltip>
);

/** Current time; click to type a timecode and jump there. */
const Timecode: React.FC<{ fps: number; durationInFrames: number }> = ({ fps, durationInFrames }) => {
  const frame = usePlaybackStore((s) => s.frame);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex min-w-0 items-center font-mono text-xs tabular">
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: inline timecode entry
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              const f = parseTimecode(draft, fps);
              if (f !== null) seek(Math.min(durationInFrames - 1, f));
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="Go to timecode"
          className="h-6 w-[11ch] rounded-sm bg-background px-1 text-foreground outline-none ring-1 ring-ring"
        />
      ) : (
        <button
          type="button"
          className="h-6 rounded-sm px-1 text-foreground transition-colors duration-150 hover:bg-foreground/[0.06]"
          onClick={() => {
            setDraft(formatSMPTE(frame, fps));
            setEditing(true);
          }}
          title="Click to jump to a timecode"
        >
          {formatSMPTE(frame, fps)}
        </button>
      )}
      <span className="truncate text-muted-foreground @max-[540px]/transport:hidden">
        <span className="px-0.5 opacity-60">/</span>
        {formatSMPTE(durationInFrames, fps)}
      </span>
    </div>
  );
};

const FormatMenu: React.FC<{ width: number; height: number; fps: number }> = ({ width, height, fps }) => {
  const setAspect = (id: AspectPresetId) => {
    const p = ASPECT_PRESETS[id];
    run(`Change format to ${id}`, (d) => updateSettings(d, { width: p.width, height: p.height }));
  };
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs tabular text-muted-foreground hover:text-foreground">
              {describeAspect(width, height)}
              <ChevronDownIcon className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Format · {width}×{height} · {fps} fps
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-64" align="end" side="top">
        <DropdownMenuLabel>Format · clips re-flow to fit</DropdownMenuLabel>
        {(Object.keys(ASPECT_PRESETS) as AspectPresetId[]).map((id) => {
          const p = ASPECT_PRESETS[id];
          const current = p.width === width && p.height === height;
          return (
            <DropdownMenuItem key={id} onClick={() => setAspect(id)}>
              <span className="w-9 font-medium tabular">{id}</span>
              <span className="text-muted-foreground">{p.label}</span>
              {current ? <CheckIcon className="ml-auto" /> : <DropdownMenuShortcut>{p.hint}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Frame rate</DropdownMenuLabel>
        {[24, 25, 30, 60].map((f) => (
          <DropdownMenuItem key={f} onClick={() => run(`Set ${f} fps`, (d) => updateSettings(d, { fps: f }))}>
            <span className="tabular">{f} fps</span>
            {fps === f ? <CheckIcon className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ZoomMenu = () => {
  const zoom = useUIStore((s) => s.previewZoom);
  const setZoom = useUIStore((s) => s.setPreviewZoom);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-[52px] gap-1 px-2 text-xs tabular text-muted-foreground hover:text-foreground">
              {zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`}
              <ChevronDownIcon className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Preview zoom</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-36" align="end" side="top">
        <DropdownMenuItem onClick={() => setZoom("fit")}>Fit {zoom === "fit" ? <CheckIcon className="ml-auto" /> : null}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {ZOOM_LEVELS.map((z) => (
          <DropdownMenuItem key={z} onClick={() => setZoom(z)}>
            <span className="tabular">{z * 100}%</span>
            {zoom === z ? <CheckIcon className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const TransportBar: React.FC<{
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}> = ({ durationInFrames, fps, width, height }) => {
  const playing = usePlaybackStore((s) => s.playing);
  const loop = usePlaybackStore((s) => s.loop);
  const setLoop = usePlaybackStore((s) => s.setLoop);
  const showSafeZones = useUIStore((s) => s.showSafeZones);
  const toggleSafeZones = useUIStore((s) => s.toggleSafeZones);
  const step = (delta: number) => {
    const f = usePlaybackStore.getState().frame;
    seek(Math.min(durationInFrames - 1, Math.max(0, f + delta)));
  };

  return (
    <div className="@container/transport shrink-0 border-t border-border bg-panel">
      <div className="grid h-10 grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
        <Timecode fps={fps} durationInFrames={durationInFrames} />
        <div className="flex items-center gap-0.5">
          <TransportButton label="Go to start" kbd="Home" onClick={() => seek(0)}>
            <SkipBackIcon className="fill-current" />
          </TransportButton>
          <TransportButton label="Previous frame" kbd="←" onClick={() => step(-1)} className="@max-[360px]/transport:hidden">
            <ChevronLeftIcon />
          </TransportButton>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="mx-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="translate-x-px fill-current" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {playing ? "Pause" : "Play"} <Kbd>Space</Kbd>
            </TooltipContent>
          </Tooltip>
          <TransportButton label="Next frame" kbd="→" onClick={() => step(1)} className="@max-[360px]/transport:hidden">
            <ChevronRightIcon />
          </TransportButton>
          <TransportButton label="Go to end" kbd="End" onClick={() => seek(durationInFrames - 1)}>
            <SkipForwardIcon className="fill-current" />
          </TransportButton>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-0.5">
          <div className="flex items-center gap-0.5 @max-[600px]/transport:hidden">
            <TransportButton label="Loop playback" onClick={() => setLoop(!loop)} active={loop}>
              <RepeatIcon />
            </TransportButton>
            <TransportButton label="Safe zones" kbd="'" onClick={toggleSafeZones} active={showSafeZones}>
              <ScanIcon />
            </TransportButton>
          </div>
          <div className="flex items-center gap-0.5 @max-[460px]/transport:hidden">
            <FormatMenu width={width} height={height} fps={fps} />
            <ZoomMenu />
          </div>
          <TransportButton label="Fullscreen" kbd="F" onClick={() => getPlayer()?.requestFullscreen()}>
            <MaximizeIcon />
          </TransportButton>
        </div>
      </div>
    </div>
  );
};
