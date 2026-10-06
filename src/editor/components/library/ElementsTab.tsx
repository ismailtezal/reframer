"use client";

import { Player, Thumbnail } from "@remotion/player";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { createComponentClip, createProject } from "@/core/defaults";
import type { Project } from "@/core/schema";
import { MOTION_COMPONENTS } from "@/remotion/components/registry";
import type { AnyMotionComponent, MotionCategory } from "@/remotion/components/types";
import { ProjectComposition } from "@/remotion/ProjectComposition";
import { addComponent } from "../../actions";
import { useInView } from "../../hooks/useInView";
import { DND_COMPONENT } from "../timeline/Timeline";
import { SectionTitle } from "./Library";

const CATEGORY_LABEL: Record<MotionCategory, string> = {
  text: "Titles & text",
  background: "Backgrounds",
  data: "Data & numbers",
  device: "Devices & UI",
  social: "Social",
  annotation: "Annotations",
  brand: "Brand",
  overlay: "Overlays & looks",
};

const PREVIEW_W = 640;
const PREVIEW_H = 360;

/** A throwaway single-clip project used to preview one component. */
const previewProject = (def: AnyMotionComponent): Project => {
  const p = createProject({ name: def.name, width: PREVIEW_W * 3, height: PREVIEW_H * 3, fps: 30 });
  p.settings.backgroundColor = def.category === "background" || def.category === "overlay" ? "#000" : "#0b0b10";
  const trackId = p.tracks[1].id;
  const box = def.defaultBox;
  const clip = createComponentClip(p.settings, {
    trackId,
    start: 0,
    duration: Math.round(def.defaultDuration * 30),
    component: def.id,
    transform: box
      ? {
          x: box.x * p.settings.width,
          y: box.y * p.settings.height,
          width: box.width * p.settings.width,
          height: box.height * p.settings.height,
        }
      : undefined,
  });
  p.clips[clip.id] = clip;
  return p;
};

const ElementCard: React.FC<{ def: AnyMotionComponent }> = ({ def }) => {
  const [hover, setHover] = useState(false);
  // Previews are full compositions; only draw the ones scrolled into view.
  const [ref, visible] = useInView<HTMLButtonElement>();
  const project = useMemo(() => previewProject(def), [def]);
  const duration = Math.max(30, Math.round(def.defaultDuration * 30));
  const common = {
    component: ProjectComposition,
    inputProps: { project, editor: false },
    durationInFrames: duration,
    compositionWidth: project.settings.width,
    compositionHeight: project.settings.height,
    fps: 30,
    style: { width: "100%", aspectRatio: "16 / 9" },
  } as const;
  return (
    <button
      ref={ref}
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_COMPONENT, def.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => addComponent(def.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative overflow-hidden rounded-md border border-border bg-black text-left transition-colors duration-150 hover:border-foreground/25"
      title={def.description}
    >
      <div className="pointer-events-none">
        {!visible ? (
          <div className="aspect-video w-full bg-black" />
        ) : hover ? (
          <Player {...common} autoPlay loop controls={false} initiallyMuted />
        ) : (
          <Thumbnail {...common} frameToDisplay={Math.min(duration - 1, Math.round(duration * 0.55))} />
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-1.5 py-1">
        <span className="truncate text-[11px] text-muted-foreground group-hover:text-foreground">{def.name}</span>
        <PlusIcon className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
    </button>
  );
};

export const ElementsTab = () => {
  const [query, setQuery] = useState("");
  const filtered = MOTION_COMPONENTS.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.description} ${c.tags?.join(" ") ?? ""} ${c.category}`.toLowerCase().includes(q);
  });
  const groups = new Map<MotionCategory, AnyMotionComponent[]>();
  for (const c of filtered) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search elements…" className="h-8 pl-8 text-sm" />
      </div>
      {[...groups.entries()].map(([cat, items]) => (
        <div key={cat}>
          <SectionTitle>{CATEGORY_LABEL[cat]}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {items.map((def) => (
              <ElementCard key={def.id} def={def} />
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 ? <p className="mt-6 text-center text-xs text-muted-foreground">No elements match “{query}”.</p> : null}
    </div>
  );
};
