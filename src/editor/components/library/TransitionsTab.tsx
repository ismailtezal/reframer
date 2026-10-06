"use client";

import { toast } from "sonner";
import { setTransition, USER } from "@/core/ops";
import { getPreviousAdjacentClip } from "@/core/project-utils";
import { TRANSITION_TYPES, type TransitionType } from "@/core/schema";
import { TRANSITION_LABELS } from "@/remotion/transitions";
import { run } from "../../actions";
import { getProject } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { SectionTitle } from "./Library";

const DIRECTIONAL = new Set<TransitionType>(["slide", "push", "wipe", "whip"]);

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
export const applyTransitionToSelection = (type: TransitionType) => {
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
      setTransition(
        d,
        id,
        {
          type,
          duration: Math.round(fps * (type === "whip" || type === "flash" || type === "glitch" ? 0.35 : 0.6)),
          direction: DIRECTIONAL.has(type) ? "left" : undefined,
        },
        { actor: USER },
      );
    }
  });
  if (withNeighbour.length < targets.length) {
    toast("Transitions blend with the clip right before on the same track — clips without one transition in from below.");
  }
};

export const TransitionsTab = () => (
  <div>
    <p className="mb-3 text-xs text-muted-foreground">
      Select a clip, then pick how it enters. The previous clip on the same track plays out underneath.
    </p>
    <SectionTitle>Transitions</SectionTitle>
    <div className="grid grid-cols-2 gap-2">
      {TRANSITION_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => applyTransitionToSelection(t)}
          className="flex flex-col gap-1.5 rounded-lg border border-border bg-panel-2 p-1.5 text-left transition-colors hover:border-ring"
        >
          <Glyph type={t} />
          <span className="px-0.5 text-[11px] text-muted-foreground">{TRANSITION_LABELS[t]}</span>
        </button>
      ))}
    </div>
  </div>
);
