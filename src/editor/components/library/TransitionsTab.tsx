"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setTransition, USER } from "@/core/ops";
import { getPreviousAdjacentClip } from "@/core/project-utils";
import { TRANSITION_TYPES, type TransitionType } from "@/core/schema";
import { pairedSfxStart } from "@/core/transition-sfx";
import { TRANSITION_LABELS } from "@/remotion/transitions";
import { run } from "../../actions";
import { insertBuiltinSfx } from "../../library-actions";
import { getProject } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { SectionTitle } from "./Library";

const DIRECTIONAL = new Set<TransitionType>(["slide", "push", "wipe", "whip", "stretch"]);
/** Plugin-typical lengths: quick optical hits, medium moves, slow dissolves. */
/** Plugin-typical lengths (seconds), from editors' and pack makers' defaults. */
const LENGTH: Partial<Record<TransitionType, number>> = {
  flash: 0.3,
  glitch: 0.35,
  whip: 0.35,
  "zoom-in": 0.4,
  "zoom-out": 0.4,
  push: 0.5,
  slide: 0.5,
  spin: 0.6,
  stretch: 0.6,
  warp: 0.5,
  fade: 0.75,
  blur: 0.75,
  "dip-to-black": 0.8,
  "dip-to-white": 0.6,
  "light-leak": 1.0,
};
export const defaultTransitionSeconds = (type: TransitionType) => LENGTH[type] ?? 0.6;

const Glyph: React.FC<{ type: TransitionType }> = ({ type }) => (
  <div className="relative h-10 w-full overflow-hidden rounded-md bg-gradient-to-r from-sky-700/70 to-violet-700/70">
    <div
      className="absolute inset-y-0 left-1/2 w-1/2 bg-gradient-to-r from-amber-500/80 to-rose-500/80"
      style={{
        clipPath: type === "iris" || type === "clock-wipe" ? "circle(40% at 25% 50%)" : undefined,
        filter: type === "blur" || type === "whip" ? "blur(3px)" : undefined,
        opacity: type === "fade" || type.startsWith("dip") ? 0.6 : 1,
        transform: type === "zoom-in" ? "scale(1.3)" : type === "spin" ? "rotate(12deg)" : undefined,
      }}
    />
    {type === "flash" || type === "dip-to-white" ? <div className="absolute inset-0 bg-white/50" /> : null}
    {type === "dip-to-black" ? <div className="absolute inset-0 bg-black/50" /> : null}
    {type === "light-leak" ? (
      <div className="absolute inset-0 bg-gradient-to-br from-orange-300/70 via-transparent to-transparent" />
    ) : null}
  </div>
);

/** Applies a transition at the start of every selected clip (that has a clip before it). */
export const applyTransitionToSelection = (type: TransitionType, withSound = false) => {
  const ids = useUIStore.getState().selectedClipIds;
  const project = getProject();
  const fps = project.settings.fps;
  const targets = ids.filter((id) => project.clips[id]);
  if (targets.length === 0) {
    toast("Select the clip that should transition in, then pick a transition.");
    return;
  }
  const withNeighbour = targets.filter((id) => getPreviousAdjacentClip(project, project.clips[id]));
  run(`Add ${TRANSITION_LABELS[type]}`, (d) => {
    for (const id of targets) {
      const duration = Math.round(fps * defaultTransitionSeconds(type));
      setTransition(d, id, { type, duration, direction: DIRECTIONAL.has(type) ? "left" : undefined }, { actor: USER });
      const pair = withSound ? pairedSfxStart(type, d.clips[id].start, duration, fps) : null;
      if (pair) insertBuiltinSfx(d, pair.sfx, pair.start, pair.volume);
    }
  });
  if (withNeighbour.length < targets.length) {
    toast("Transitions blend with the clip right before on the same track — clips without one transition in from below.");
  }
};

export const TransitionsTab = () => {
  const [withSound, setWithSound] = useState(true);
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Select a clip, then pick how it enters. The previous clip on the same track plays out underneath.
      </p>
      <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-foreground/[0.03] px-2 py-1.5 text-xs">
        <span id="transition-sound-label">
          With sound <span className="text-muted-foreground">· whoosh, whip or hit on the cut</span>
        </span>
        <Switch checked={withSound} onCheckedChange={setWithSound} aria-labelledby="transition-sound-label" />
      </div>
      <SectionTitle>Transitions</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {TRANSITION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => applyTransitionToSelection(t, withSound)}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-panel-2 p-1.5 text-left transition-colors hover:border-ring"
          >
            <Glyph type={t} />
            <span className="px-0.5 text-[11px] text-muted-foreground">{TRANSITION_LABELS[t]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
