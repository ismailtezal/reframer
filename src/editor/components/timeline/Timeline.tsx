"use client";

import { AudioLinesIcon, LayersIcon, PlusIcon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { addTrack, moveClip, trimClip, USER } from "@/core/ops";
import { getClipEnd, getProjectDuration } from "@/core/project-utils";
import type { Clip, Project, Track } from "@/core/schema";
import { cn } from "@/lib/utils";
import { addAssetToTimeline, addComponent, run } from "../../actions";
import { addSfx } from "../../library-actions";
import { importFiles } from "../../media/import";
import { AGENT_GLOW_MS, useAgentStore } from "../../store/agent-store";
import { seek, usePlaybackStore } from "../../store/playback-store";
import { getProject, transact, useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { ClipItem } from "./ClipItem";
import { HEADER_WIDTH, RULER_HEIGHT, snapDelta, snapPoints, TimelineContext, TRACK_HEIGHT, xToFrame, Z } from "./geometry";
import { Playhead } from "./Playhead";
import { Ruler } from "./Ruler";
import { TimelineToolbar } from "./TimelineToolbar";
import { TrackHeader } from "./TrackHeader";
import { useTimelineViewport, VIEWPORT_BLOCK } from "./viewport";

type MoveDrag = {
  kind: "move";
  ids: string[];
  anchorId: string;
  startX: number;
  moved: boolean;
  delta: number;
  targetTrackId: string;
  snapAt: number | null;
};
type TrimDrag = {
  kind: "trim";
  id: string;
  edge: "start" | "end";
  startX: number;
  orig: number;
  snapAt: number | null;
};
type MarqueeDrag = {
  kind: "marquee";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
};
type DragState = MoveDrag | TrimDrag | MarqueeDrag;

export const DND_ASSET = "application/x-reframer-asset";
export const DND_COMPONENT = "application/x-reframer-component";
export const DND_SFX = "application/x-reframer-sfx";

/** Imports files and lays them end to end from `frame`. Videos and images land on the main (lowest) visual track by default. */
const importToTimeline = async (files: File[], frame: number, trackId?: string) => {
  if (files.length === 0) return;
  const toastId = toast.loading(`Importing ${files.length} file${files.length > 1 ? "s" : ""}…`);
  try {
    const assets = await importFiles(files);
    const mainTrack = [...getProject().tracks].reverse().find((t) => t.kind === "visual")?.id;
    let at = frame;
    for (const asset of assets) {
      const id = addAssetToTimeline(asset, {
        frame: at,
        trackId: trackId ?? mainTrack,
      });
      const c = id ? getProject().clips[id] : undefined;
      if (c) at = getClipEnd(c);
    }
  } finally {
    toast.dismiss(toastId);
  }
};

const EmptyState: React.FC<{ top: number; left: number }> = ({ top, left }) => {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="pointer-events-none absolute right-0 bottom-0 p-2" style={{ top, left }}>
      <div
        className={cn(
          "pointer-events-auto flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center transition-colors duration-150",
          over ? "border-brand/70 bg-brand/[0.06]" : "border-foreground/[0.18] bg-background",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const assetId = e.dataTransfer.getData(DND_ASSET);
          const asset = assetId ? getProject().assets[assetId] : undefined;
          if (asset) addAssetToTimeline(asset, { frame: 0 });
          else void importToTimeline([...e.dataTransfer.files], 0);
        }}
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground">
          <UploadIcon className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop media here</p>
          <p className="text-xs text-muted-foreground">
            Video, audio and images. Or describe the video to the agent and watch it build here.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Import media
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void importToTimeline(files, 0);
          }}
        />
      </div>
    </div>
  );
};

const AddTrackMenu = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="xs" className="gap-1 text-muted-foreground hover:text-foreground">
        <PlusIcon /> Track
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-44">
      <DropdownMenuItem onClick={() => run("Add track", (d) => addTrack(d, { kind: "visual", index: 0 }))}>
        <LayersIcon /> Visual track
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => run("Add audio track", (d) => addTrack(d, { kind: "audio" }))}>
        <AudioLinesIcon /> Audio track
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const Timeline = () => {
  const project = useProjectStore((s) => s.project);
  const pxPerSecond = useUIStore((s) => s.pxPerSecond);
  const selectedIds = useUIStore((s) => s.selectedClipIds);
  const focusedProperty = useUIStore((s) => s.focusedProperty);
  const touched = useAgentStore((s) => s.touched);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(1200);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // The visible lane window drives clip-internal virtualization (see viewport.ts).
    let raf = 0;
    const publish = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => useTimelineViewport.setState({ left: el.scrollLeft, width: el.clientWidth - HEADER_WIDTH }));
    };
    const ro = new ResizeObserver(([e]) => {
      setViewportW(e.contentRect.width - HEADER_WIDTH);
      publish();
    });
    ro.observe(el);
    el.addEventListener("scroll", publish, { passive: true });
    publish();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("scroll", publish);
    };
  }, []);

  // Keep agent glows animating until they fade.
  useEffect(() => {
    if (!Object.values(touched).some((t) => Date.now() - t < AGENT_GLOW_MS)) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [touched]);

  const fps = project?.settings.fps ?? 30;
  const ppf = pxPerSecond / fps;
  const duration = project ? getProjectDuration(project) : fps * 5;
  const contentFrames = Math.max(duration + fps * 8, Math.ceil(viewportW / ppf));
  const contentWidth = contentFrames * ppf;

  const geometry = useMemo(() => ({ fps, ppf, durationInFrames: duration, contentWidth, scrollRef }), [fps, ppf, duration, contentWidth]);

  const updateDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  // --- Pointer handling ----------------------------------------------------

  const laneAt = (clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY);
    return (el?.closest("[data-track-lane]") as HTMLElement | null)?.dataset.trackLane ?? null;
  };

  const frameAtClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return xToFrame(clientX - rect.left - HEADER_WIDTH + el.scrollLeft, ppf);
    },
    [ppf],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: drag state lives in refs; the handler never goes stale
  const onPointerDownBody = useCallback((e: React.PointerEvent, clip: Clip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const ui = useUIStore.getState();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let ids = ui.selectedClipIds;
    if (additive) {
      ui.select([clip.id], { toggle: true });
      ids = ui.selectedClipIds.includes(clip.id) ? ui.selectedClipIds.filter((i) => i !== clip.id) : [...ui.selectedClipIds, clip.id];
    } else if (!ids.includes(clip.id)) {
      ui.select([clip.id]);
      ids = [clip.id];
    }
    ui.selectTrack(clip.trackId);
    updateDrag({
      kind: "move",
      ids,
      anchorId: clip.id,
      startX: e.clientX,
      moved: false,
      delta: 0,
      targetTrackId: clip.trackId,
      snapAt: null,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: drag state lives in refs; the handler never goes stale
  const onPointerDownEdge = useCallback((e: React.PointerEvent, clip: Clip, edge: "start" | "end") => {
    if (e.button !== 0) return;
    useUIStore.getState().select([clip.id]);
    updateDrag({
      kind: "trim",
      id: clip.id,
      edge,
      startX: e.clientX,
      orig: edge === "start" ? clip.start : getClipEnd(clip),
      snapAt: null,
    });
  }, []);

  const onLanePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const frame = frameAtClientX(e.clientX);
    seek(frame);
    if (!e.shiftKey) useUIStore.getState().clearSelection();
    const lane = laneAt(e.clientX, e.clientY);
    if (lane) useUIStore.getState().selectTrack(lane);
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect || !scrollRef.current) return;
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const y = e.clientY - rect.top + scrollRef.current.scrollTop;
    updateDrag({
      kind: "marquee",
      x0: x,
      y0: y,
      x1: x,
      y1: y,
      additive: e.shiftKey,
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: listeners attach once per drag; live values are read from refs
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const p = getProject();
      if (!d) return;
      if (d.kind === "move") {
        let delta = Math.round((e.clientX - d.startX) / ppf);
        const moved = d.moved || Math.abs(e.clientX - d.startX) > 3;
        const clips = d.ids.map((id) => p.clips[id]).filter(Boolean);
        const minStart = Math.min(...clips.map((c) => c.start));
        delta = Math.max(-minStart, delta);
        let snapAt: number | null = null;
        if (useUIStore.getState().snapping && !e.altKey) {
          const pts = snapPoints(p, usePlaybackStore.getState().frame, new Set(d.ids));
          const edges = clips.flatMap((c) => [c.start + delta, getClipEnd(c) + delta]);
          const s = snapDelta(edges, pts, ppf);
          delta += s.delta;
          snapAt = s.at;
        }
        const anchor = p.clips[d.anchorId];
        const lane = laneAt(e.clientX, e.clientY);
        const laneTrack = lane ? p.tracks.find((t) => t.id === lane) : undefined;
        const targetTrackId =
          laneTrack && anchor && (laneTrack.kind === "audio") === (anchor.type === "audio") && !laneTrack.locked
            ? laneTrack.id
            : d.targetTrackId;
        updateDrag({ ...d, delta, moved, targetTrackId, snapAt });
      } else if (d.kind === "trim") {
        const clip = p.clips[d.id];
        if (!clip) return;
        let edge = d.orig + Math.round((e.clientX - d.startX) / ppf);
        let snapAt: number | null = null;
        if (useUIStore.getState().snapping && !e.altKey) {
          const s = snapDelta([edge], snapPoints(p, usePlaybackStore.getState().frame, new Set([clip.id])), ppf);
          edge += s.delta;
          snapAt = s.at;
        }
        // Don't trim into neighbours on the same track.
        const neighbours = Object.values(p.clips).filter((c) => c.trackId === clip.trackId && c.id !== clip.id);
        if (d.edge === "start") {
          const limit = Math.max(0, ...neighbours.filter((c) => getClipEnd(c) <= clip.start).map(getClipEnd));
          edge = Math.min(Math.max(edge, limit), getClipEnd(clip) - 1);
        } else {
          const after = neighbours.filter((c) => c.start >= getClipEnd(clip)).map((c) => c.start);
          const limit = after.length ? Math.min(...after) : Number.POSITIVE_INFINITY;
          edge = Math.max(Math.min(edge, limit), clip.start + 1);
        }
        try {
          transact("Trim", (draft) => trimClip(draft, d.id, d.edge === "start" ? { start: edge } : { end: edge }, { actor: USER }), {
            actor: USER,
            mergeKey: `trim:${d.id}:${d.edge}`,
          });
        } catch {
          // Media limits reached — ignore further movement.
        }
        if (snapAt !== d.snapAt) updateDrag({ ...d, snapAt });
      } else if (d.kind === "marquee") {
        const el = scrollRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x1 = e.clientX - rect.left + el.scrollLeft;
        const y1 = e.clientY - rect.top + el.scrollTop;
        updateDrag({ ...d, x1, y1 });
        // Select clips intersecting the rectangle.
        const minX = Math.min(d.x0, x1);
        const maxX = Math.max(d.x0, x1);
        const minY = Math.min(d.y0, y1);
        const maxY = Math.max(d.y0, y1);
        if (maxX - minX < 4 && maxY - minY < 4) return;
        const hits: string[] = [];
        for (const node of el.querySelectorAll<HTMLElement>("[data-timeline-clip]")) {
          const r = node.getBoundingClientRect();
          const nx0 = r.left - rect.left + el.scrollLeft;
          const ny0 = r.top - rect.top + el.scrollTop;
          if (nx0 < maxX && nx0 + r.width > minX && ny0 < maxY && ny0 + r.height > minY) {
            const id = node.dataset.timelineClip;
            if (id) hits.push(id);
          }
        }
        useUIStore.getState().select(hits, { additive: d.additive });
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.kind === "move" && d.moved) {
        const p = getProject();
        const anchor = p.clips[d.anchorId];
        const trackChanged = anchor && d.targetTrackId !== anchor.trackId;
        if (d.delta !== 0 || trackChanged) {
          run(d.ids.length > 1 ? `Move ${d.ids.length} clips` : "Move clip", (draft) => {
            const ordered = [...d.ids].sort((a, b) =>
              d.delta > 0 ? draft.clips[b].start - draft.clips[a].start : draft.clips[a].start - draft.clips[b].start,
            );
            for (const id of ordered) {
              const c = draft.clips[id];
              if (!c) continue;
              const trackId = id === d.anchorId || d.ids.length === 1 ? d.targetTrackId : c.trackId;
              moveClip(draft, id, { start: c.start + d.delta, trackId }, "auto-track", { actor: USER });
            }
          });
        }
      }
      updateDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag !== null, ppf]);

  // --- Zoom with ctrl/cmd + wheel, anchored at the cursor ------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - HEADER_WIDTH;
      const pps = useUIStore.getState().pxPerSecond;
      const time = (el.scrollLeft + cursorX) / pps;
      const next = pps * Math.exp(-e.deltaY * 0.0022);
      useUIStore.getState().setPxPerSecond(next);
      const applied = useUIStore.getState().pxPerSecond;
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, time * applied - cursorX);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- Drag & drop from the library / OS -----------------------------------
  const onDrop = async (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const frame = frameAtClientX(e.clientX);
    const assetId = e.dataTransfer.getData(DND_ASSET);
    const componentId = e.dataTransfer.getData(DND_COMPONENT);
    const sfxId = e.dataTransfer.getData(DND_SFX);
    if (sfxId) {
      addSfx(sfxId, frame);
      return;
    }
    if (assetId) {
      const asset = getProject().assets[assetId];
      if (asset) addAssetToTimeline(asset, { frame, trackId });
      return;
    }
    if (componentId) {
      seek(frame);
      useUIStore.getState().selectTrack(trackId);
      addComponent(componentId);
      return;
    }
    if (e.dataTransfer.files.length > 0) await importToTimeline([...e.dataTransfer.files], frame, trackId);
  };

  if (!project) return null;

  const dragDelta = drag?.kind === "move" && drag.moved ? drag : null;
  const snapLine = drag && drag.kind !== "marquee" && drag.snapAt !== null ? drag.snapAt : null;
  const now = Date.now();
  const isEmpty = Object.keys(project.clips).length === 0;

  return (
    <TimelineContext.Provider value={geometry}>
      <div className="flex h-full min-h-0 flex-col bg-panel">
        <TimelineToolbar viewportWidth={viewportW} />
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} className="absolute inset-0 overflow-auto overscroll-contain bg-background">
            <div className="relative" style={{ width: HEADER_WIDTH + contentWidth, minHeight: "100%" }}>
              <div className="sticky top-0 flex" style={{ height: RULER_HEIGHT, zIndex: Z.ruler }}>
                <div
                  className="sticky left-0 flex shrink-0 items-center border-r border-b border-border bg-panel px-1.5"
                  style={{ width: HEADER_WIDTH, zIndex: Z.corner }}
                >
                  <AddTrackMenu />
                </div>
                <Ruler />
              </div>

              {project.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  project={project}
                  contentWidth={contentWidth}
                  ppf={ppf}
                  fps={fps}
                  selectedIds={selectedIds}
                  focusedProperty={focusedProperty}
                  touched={touched}
                  now={now}
                  dragDelta={dragDelta}
                  onLanePointerDown={onLanePointerDown}
                  onPointerDownBody={onPointerDownBody}
                  onPointerDownEdge={onPointerDownEdge}
                  onDrop={onDrop}
                />
              ))}
              <div className="flex" style={{ height: 72 }}>
                <div className="sticky left-0 shrink-0 border-r border-border bg-panel" style={{ width: HEADER_WIDTH, zIndex: Z.header }} />
                <div
                  className="flex-1"
                  onPointerDown={onLanePointerDown}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const firstVisual = project.tracks.find((t) => t.kind === "visual");
                    if (firstVisual) void onDrop(e, firstVisual.id);
                  }}
                />
              </div>

              {snapLine !== null ? (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-brand"
                  style={{
                    left: HEADER_WIDTH + snapLine * ppf,
                    zIndex: Z.snap,
                  }}
                />
              ) : null}
              {drag?.kind === "marquee" ? (
                <div
                  className="pointer-events-none absolute z-20 rounded-sm border border-brand/70 bg-brand/10"
                  style={{
                    left: Math.min(drag.x0, drag.x1),
                    top: Math.min(drag.y0, drag.y1),
                    width: Math.abs(drag.x1 - drag.x0),
                    height: Math.abs(drag.y1 - drag.y0),
                  }}
                />
              ) : null}
              <Playhead />
            </div>
          </div>
          {isEmpty ? <EmptyState top={RULER_HEIGHT} left={HEADER_WIDTH} /> : null}
        </div>
      </div>
    </TimelineContext.Provider>
  );
};

type TrackRowProps = {
  track: Track;
  project: Project;
  contentWidth: number;
  ppf: number;
  fps: number;
  selectedIds: string[];
  focusedProperty: string | null;
  touched: Record<string, number>;
  now: number;
  dragDelta: MoveDrag | null;
  onLanePointerDown: (e: React.PointerEvent) => void;
  onPointerDownBody: (e: React.PointerEvent, clip: Clip) => void;
  onPointerDownEdge: (e: React.PointerEvent, clip: Clip, edge: "start" | "end") => void;
  onDrop: (e: React.DragEvent, trackId: string) => void;
};

const TrackRow: React.FC<TrackRowProps> = ({
  track,
  project,
  contentWidth,
  ppf,
  fps,
  selectedIds,
  focusedProperty,
  touched,
  now,
  dragDelta,
  onLanePointerDown,
  onPointerDownBody,
  onPointerDownEdge,
  onDrop,
}) => {
  const height = TRACK_HEIGHT[track.kind];
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const [dropHover, setDropHover] = useState(false);
  // Only clips near the visible window are mounted (selected and dragged clips always are),
  // so zooming or editing a long project costs about the same as a short one.
  const windowKey = useTimelineViewport(
    (s) =>
      `${Math.floor(s.left / VIEWPORT_BLOCK)}:${Math.ceil((s.left + s.width) / VIEWPORT_BLOCK)}:${Math.ceil(s.width / VIEWPORT_BLOCK)}`,
  );
  const [blockA, blockB, blocksWide] = windowKey.split(":").map(Number);
  const winStart = (blockA - blocksWide) * VIEWPORT_BLOCK;
  const winEnd = (blockB + blocksWide) * VIEWPORT_BLOCK;
  const clips = Object.values(project.clips).filter((c) => {
    if (c.trackId !== track.id) return false;
    const x0 = c.start * ppf;
    const x1 = (c.start + c.duration) * ppf;
    return (x1 >= winStart && x0 <= winEnd) || selectedIds.includes(c.id) || !!dragDelta?.ids.includes(c.id);
  });
  // Clips dragged onto this track from another one render here as ghosts.
  const incoming =
    dragDelta && dragDelta.targetTrackId === track.id
      ? dragDelta.ids
          .map((id) => project.clips[id])
          .filter((c) => c && c.trackId !== track.id && (dragDelta.ids.length === 1 || c.id === dragDelta.anchorId))
      : [];

  const renderClip = (clip: Clip, ghost: boolean) => {
    const dragging = !!dragDelta?.ids.includes(clip.id);
    const delta = dragging && dragDelta ? dragDelta.delta : 0;
    const leavesTrack =
      !!dragDelta && dragging && dragDelta.targetTrackId !== track.id && (dragDelta.ids.length === 1 || clip.id === dragDelta.anchorId);
    if (leavesTrack && !ghost) return null;
    const glowAt = touched[clip.id];
    const glow = glowAt && now - glowAt < AGENT_GLOW_MS ? 1 - (now - glowAt) / AGENT_GLOW_MS : null;
    return (
      <ClipItem
        key={clip.id}
        clip={clip}
        asset={"assetId" in clip ? project.assets[clip.assetId] : undefined}
        left={(clip.start + delta) * ppf}
        width={clip.duration * ppf}
        height={height}
        fps={fps}
        ppf={ppf}
        selected={selectedIds.includes(clip.id)}
        dragging={dragging}
        locked={track.locked || !!clip.locked}
        agentGlow={glow}
        focusedProperty={focusedProperty}
        onPointerDownBody={onPointerDownBody}
        onPointerDownEdge={onPointerDownEdge}
      />
    );
  };

  return (
    <div className="flex border-b border-border" style={{ height }}>
      <TrackHeader track={track} height={height} selected={selectedTrackId === track.id} />
      <div
        data-track-lane={track.id}
        className={cn(
          "relative shrink-0",
          track.locked && "bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(255_255_255/0.02)_6px_12px)]",
          selectedTrackId === track.id && "bg-foreground/[0.02]",
          dropHover && "bg-brand/[0.08]",
        )}
        style={{ width: contentWidth }}
        onPointerDown={onLanePointerDown}
        onDragOver={(e) => {
          e.preventDefault();
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          setDropHover(false);
          onDrop(e, track.id);
        }}
      >
        {clips.map((c) => renderClip(c, false))}
        {incoming.map((c) => renderClip(c, true))}
        {track.muted || track.hidden ? <div className="pointer-events-none absolute inset-0 z-[15] bg-background/45" /> : null}
      </div>
    </div>
  );
};
