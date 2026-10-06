"use client";

import { SparklesIcon } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { USER, updateClip } from "@/core/ops";
import type { Clip } from "@/core/schema";
import { cn } from "@/lib/utils";
import { setTransformValue, valueAt } from "../../animatable";
import { AGENT_GLOW_MS, useAgentStore } from "../../store/agent-store";
import { usePlaybackStore } from "../../store/playback-store";
import { getProject, transact, useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";

type Box = {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
  locked: boolean;
};

type Drag =
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: "scale";
      id: string;
      cx: number;
      cy: number;
      startDist: number;
      origScale: number;
    }
  | {
      kind: "edge";
      id: string;
      edge: "l" | "r" | "t" | "b";
      startX: number;
      startY: number;
      origW: number;
      origH: number;
      rot: number;
    }
  | {
      kind: "rotate";
      id: string;
      cx: number;
      cy: number;
      origRot: number;
      startAngle: number;
    };

const SNAP_PX = 7;

/** Box of a clip in composition px at the current frame (base transform + keyframes). */
const measureBox = (clip: Clip, frame: number, root: HTMLElement | null): Box => {
  const el = root?.querySelector<HTMLElement>(`[data-clip-id="${clip.id}"]`);
  const w = valueAt(clip, "width", frame);
  // Text clips grow with content: use the rendered height.
  const h = clip.type === "text" && el ? el.offsetHeight : valueAt(clip, "height", frame);
  const scale = valueAt(clip, "scale", frame);
  return {
    id: clip.id,
    cx: valueAt(clip, "x", frame),
    cy: valueAt(clip, "y", frame),
    w: w * Math.abs(scale),
    h: h * Math.abs(scale),
    rot: valueAt(clip, "rotation", frame),
    locked: !!clip.locked,
  };
};

const BoxFrame: React.FC<{
  box: Box;
  scale: number;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ box, scale, className, children, style }) => (
  <div
    className={cn("pointer-events-none absolute", className)}
    style={{
      left: (box.cx - box.w / 2) * scale,
      top: (box.cy - box.h / 2) * scale,
      width: box.w * scale,
      height: box.h * scale,
      transform: box.rot ? `rotate(${box.rot}deg)` : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

export const CanvasOverlay: React.FC<{
  scale: number;
  playerRoot: HTMLElement | null;
}> = ({ scale, playerRoot }) => {
  const project = useProjectStore((s) => s.project);
  const frame = usePlaybackStore((s) => s.frame);
  const selectedIds = useUIStore((s) => s.selectedClipIds);
  const select = useUIStore((s) => s.select);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const showSafeZones = useUIStore((s) => s.showSafeZones);
  const touched = useAgentStore((s) => s.touched);
  const agentName = useAgentStore((s) => s.agentName);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [editingText, setEditingText] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Re-render while agent glows fade out.
  useEffect(() => {
    const active = Object.values(touched).some((t) => Date.now() - t < AGENT_GLOW_MS);
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [touched]);

  const toComp = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale],
  );

  if (!project) return null;
  const { width: W, height: H } = project.settings;

  const visibleClips = Object.values(project.clips).filter(
    (c) => c.type !== "audio" && frame >= c.start && frame < c.start + c.duration && !c.hidden,
  );
  const selected = selectedIds.map((id) => project.clips[id]).filter((c): c is Clip => !!c && c.type !== "audio");
  const selectedBoxes = selected
    .filter((c) => frame >= c.start && frame < c.start + c.duration)
    .map((c) => measureBox(c, frame, playerRoot));
  const glowing = visibleClips
    .filter((c) => touched[c.id] && Date.now() - touched[c.id] < AGENT_GLOW_MS)
    .map((c) => ({
      box: measureBox(c, frame, playerRoot),
      age: (Date.now() - touched[c.id]) / AGENT_GLOW_MS,
    }));

  const hitTest = (e: React.PointerEvent): string | null => {
    const overlay = overlayRef.current;
    if (!overlay || !playerRoot) return null;
    overlay.style.pointerEvents = "none";
    const stack = document.elementsFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = "";
    for (const el of stack) {
      if (!playerRoot.contains(el)) continue;
      const id = (el as HTMLElement).closest<HTMLElement>("[data-clip-id]")?.dataset.clipId;
      if (!id) continue;
      const clip = project.clips[id];
      const track = clip && project.tracks.find((t) => t.id === clip.trackId);
      if (clip && !track?.locked) return id;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const id = hitTest(e);
    if (!id) {
      if (!e.shiftKey) clearSelection();
      return;
    }
    if (e.shiftKey) select([id], { toggle: true });
    else if (!selectedIds.includes(id)) select([id]);
    const clip = getProject().clips[id];
    if (!clip || clip.locked) return;
    const p = toComp(e);
    dragRef.current = {
      kind: "move",
      id,
      startX: p.x,
      startY: p.y,
      origX: valueAt(clip, "x", frame),
      origY: valueAt(clip, "y", frame),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toComp(e);
    const f = usePlaybackStore.getState().frame;
    if (drag.kind === "move") {
      let x = drag.origX + (p.x - drag.startX);
      let y = drag.origY + (p.y - drag.startY);
      const g: { x?: number; y?: number } = {};
      const clip = getProject().clips[drag.id];
      if (clip && !e.altKey) {
        const box = measureBox(clip, f, playerRoot);
        const xs = [W / 2, box.w / 2, W - box.w / 2, W * 0.05 + box.w / 2, W * 0.95 - box.w / 2];
        const ys = [H / 2, box.h / 2, H - box.h / 2, H * 0.05 + box.h / 2, H * 0.95 - box.h / 2];
        for (const sx of xs)
          if (Math.abs(x - sx) * scale < SNAP_PX) {
            x = sx;
            g.x = sx === W / 2 ? W / 2 : sx;
          }
        for (const sy of ys)
          if (Math.abs(y - sy) * scale < SNAP_PX) {
            y = sy;
            g.y = sy === H / 2 ? H / 2 : sy;
          }
      }
      setGuides(g);
      transact(
        "Move",
        (d) => {
          setTransformValue(d, drag.id, "x", Math.round(x), f);
          setTransformValue(d, drag.id, "y", Math.round(y), f);
        },
        { actor: USER, mergeKey: `move:${drag.id}` },
      );
    } else if (drag.kind === "scale") {
      const dist = Math.hypot(p.x - drag.cx, p.y - drag.cy);
      const next = Math.max(0.02, drag.origScale * (dist / Math.max(1, drag.startDist)));
      transact("Scale", (d) => setTransformValue(d, drag.id, "scale", Math.round(next * 1000) / 1000, f), {
        actor: USER,
        mergeKey: `scale:${drag.id}`,
      });
    } else if (drag.kind === "edge") {
      const rad = (-drag.rot * Math.PI) / 180;
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      transact(
        "Resize",
        (d) => {
          const c = d.clips[drag.id];
          if (!c) return;
          const s = Math.abs(c.transform.scale) || 1;
          if (drag.edge === "l" || drag.edge === "r") {
            const w = Math.max(8, drag.origW + ((drag.edge === "r" ? lx : -lx) * 2) / s);
            setTransformValue(d, drag.id, "width", Math.round(w), f);
          } else {
            const h = Math.max(8, drag.origH + ((drag.edge === "b" ? ly : -ly) * 2) / s);
            setTransformValue(d, drag.id, "height", Math.round(h), f);
          }
        },
        { actor: USER, mergeKey: `edge:${drag.id}:${drag.edge}` },
      );
    } else if (drag.kind === "rotate") {
      const angle = (Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180) / Math.PI;
      let rot = drag.origRot + (angle - drag.startAngle);
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      else if (Math.abs(rot % 90) < 3) rot = Math.round(rot / 90) * 90;
      transact("Rotate", (d) => setTransformValue(d, drag.id, "rotation", Math.round(rot * 10) / 10, f), {
        actor: USER,
        mergeKey: `rotate:${drag.id}`,
      });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setGuides({});
  };

  const startHandle = (e: React.PointerEvent, box: Box, kind: "scale" | "rotate" | "l" | "r" | "t" | "b") => {
    e.stopPropagation();
    const clip = getProject().clips[box.id];
    if (!clip || clip.locked) return;
    const p = toComp(e);
    const f = usePlaybackStore.getState().frame;
    if (kind === "scale") {
      dragRef.current = {
        kind: "scale",
        id: box.id,
        cx: box.cx,
        cy: box.cy,
        startDist: Math.hypot(p.x - box.cx, p.y - box.cy),
        origScale: valueAt(clip, "scale", f),
      };
    } else if (kind === "rotate") {
      dragRef.current = {
        kind: "rotate",
        id: box.id,
        cx: box.cx,
        cy: box.cy,
        origRot: box.rot,
        startAngle: (Math.atan2(p.y - box.cy, p.x - box.cx) * 180) / Math.PI,
      };
    } else {
      dragRef.current = {
        kind: "edge",
        id: box.id,
        edge: kind,
        startX: p.x,
        startY: p.y,
        origW: valueAt(clip, "width", f),
        origH: valueAt(clip, "height", f),
        rot: box.rot,
      };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = hitTest(e as unknown as React.PointerEvent);
    if (id && project.clips[id]?.type === "text") setEditingText(id);
  };

  const single = selectedBoxes.length === 1 ? selectedBoxes[0] : null;
  const singleClip = single ? project.clips[single.id] : null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {showSafeZones ? <SafeZones W={W} H={H} scale={scale} /> : null}

      {glowing.map(({ box, age }) => (
        <BoxFrame
          key={`glow-${box.id}`}
          box={box}
          scale={scale}
          className="rounded-[3px] border-2 border-ai"
          style={{
            opacity: 1 - age * 0.85,
            boxShadow: "0 0 24px -4px var(--ai)",
          }}
        >
          <span className="absolute -top-6 left-0 flex items-center gap-1 rounded-md bg-ai px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-ai-foreground shadow-lg">
            <SparklesIcon className="size-2.5" /> {agentName ?? "Agent"}
          </span>
        </BoxFrame>
      ))}

      {selectedBoxes.map((box) => (
        <BoxFrame key={box.id} box={box} scale={scale} className="outline outline-1 outline-brand">
          {single?.id === box.id && !box.locked ? (
            <>
              {(["tl", "tr", "bl", "br"] as const).map((c) => (
                <span
                  key={c}
                  onPointerDown={(e) => startHandle(e, box, "scale")}
                  className={cn(
                    "pointer-events-auto absolute size-2.5 rounded-[2px] border border-brand bg-white",
                    c === "tl" && "-top-[5px] -left-[5px] cursor-nwse-resize",
                    c === "tr" && "-top-[5px] -right-[5px] cursor-nesw-resize",
                    c === "bl" && "-bottom-[5px] -left-[5px] cursor-nesw-resize",
                    c === "br" && "-right-[5px] -bottom-[5px] cursor-nwse-resize",
                  )}
                />
              ))}
              {(["l", "r", "t", "b"] as const)
                .filter((edge) => !(singleClip?.type === "text" && (edge === "t" || edge === "b")))
                .map((edge) => (
                  <span
                    key={edge}
                    onPointerDown={(e) => startHandle(e, box, edge)}
                    className={cn(
                      "pointer-events-auto absolute rounded-full border border-brand bg-white",
                      edge === "l" && "top-1/2 -left-[3px] h-4 w-1.5 -translate-y-1/2 cursor-ew-resize",
                      edge === "r" && "top-1/2 -right-[3px] h-4 w-1.5 -translate-y-1/2 cursor-ew-resize",
                      edge === "t" && "-top-[3px] left-1/2 h-1.5 w-4 -translate-x-1/2 cursor-ns-resize",
                      edge === "b" && "-bottom-[3px] left-1/2 h-1.5 w-4 -translate-x-1/2 cursor-ns-resize",
                    )}
                  />
                ))}
              <span
                onPointerDown={(e) => startHandle(e, box, "rotate")}
                className="pointer-events-auto absolute -top-7 left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border border-brand bg-white"
                title="Rotate (Shift snaps to 15°)"
              />
            </>
          ) : null}
        </BoxFrame>
      ))}

      {guides.x !== undefined ? (
        <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-brand" style={{ left: guides.x * scale }} />
      ) : null}
      {guides.y !== undefined ? (
        <div className="pointer-events-none absolute right-0 left-0 h-px bg-brand" style={{ top: guides.y * scale }} />
      ) : null}

      {editingText && project.clips[editingText]?.type === "text" ? (
        <InlineTextEditor clipId={editingText} scale={scale} frame={frame} onDone={() => setEditingText(null)} />
      ) : null}
    </div>
  );
};

const SafeZones: React.FC<{ W: number; H: number; scale: number }> = ({ W, H, scale }) => {
  const portrait = H > W;
  if (portrait) {
    // Shorts / Reels / TikTok UI: keep text out of the top 11.5%, bottom 22%, right 13%.
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 bg-rose-500/15" style={{ height: H * 0.115 * scale }} />
        <div className="absolute inset-x-0 bottom-0 bg-rose-500/15" style={{ height: H * 0.22 * scale }} />
        <div
          className="absolute right-0 bg-rose-500/15"
          style={{
            top: H * 0.115 * scale,
            bottom: H * 0.22 * scale,
            width: W * 0.13 * scale,
          }}
        />
        <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-rose-200">Platform UI zones</span>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute border border-dashed border-white/35" style={{ inset: `${H * 0.05 * scale}px ${W * 0.05 * scale}px` }} />
      <div className="absolute border border-dashed border-white/20" style={{ inset: `${H * 0.1 * scale}px ${W * 0.1 * scale}px` }} />
      <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white/80">Action safe · Title safe</span>
    </div>
  );
};

const InlineTextEditor: React.FC<{
  clipId: string;
  scale: number;
  frame: number;
  onDone: () => void;
}> = ({ clipId, scale, frame, onDone }) => {
  const clip = useProjectStore((s) => s.project?.clips[clipId]);
  const [value, setValue] = useState(clip && clip.type === "text" ? clip.text : "");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  if (!clip || clip.type !== "text") return null;
  const commit = () => {
    if (value !== clip.text) {
      transact("Edit text", (d) => updateClip(d, clipId, { text: value }, { actor: USER }), { actor: USER });
    }
    onDone();
  };
  const w = valueAt(clip, "width", frame) * scale;
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone();
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-10 resize-none rounded-md border border-brand bg-black/80 p-2 text-center text-white shadow-2xl outline-none"
      style={{
        left: valueAt(clip, "x", frame) * scale - w / 2,
        top: valueAt(clip, "y", frame) * scale - 40,
        width: w,
        minHeight: 80,
        fontSize: Math.max(13, clip.style.fontSize * scale * 0.9),
        fontFamily: `"${clip.style.fontFamily}", Inter, sans-serif`,
        fontWeight: clip.style.fontWeight,
      }}
    />
  );
};
