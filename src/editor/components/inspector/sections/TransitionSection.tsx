"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTransition, USER } from "@/core/ops";
import { getPreviousAdjacentClip } from "@/core/project-utils";
import { type Clip, TRANSITION_TYPES, type Transition } from "@/core/schema";
import { TRANSITION_LABELS } from "@/remotion/transitions";
import { run } from "../../../actions";
import { getProject } from "../../../store/project-store";
import { EasingField, FieldRow, NumberField, Section, SelectField } from "../fields";

export const TransitionSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const project = getProject();
  const fps = project.settings.fps;
  const t = clip.transitionIn;
  const hasPrev = !!getPreviousAdjacentClip(project, clip);
  const set = (next: Transition | null, label: string) =>
    run(label, (d) => setTransition(d, clip.id, next, { actor: USER }), `transition:${clip.id}`);

  return (
    <Section title="Transition in" defaultOpen={!!t}>
      <div className="flex items-center gap-1.5">
        <SelectField
          value={t?.type ?? "none"}
          options={[{ value: "none", label: "None (cut)" }, ...TRANSITION_TYPES.map((x) => ({ value: x, label: TRANSITION_LABELS[x] }))]}
          onChange={(v) =>
            set(
              v === "none"
                ? null
                : {
                    type: v as Transition["type"],
                    duration: t?.duration ?? Math.round(fps * 0.5),
                    direction: t?.direction,
                    easing: t?.easing,
                  },
              "Set transition",
            )
          }
        />
        {t ? (
          <Button variant="ghost" size="icon-xs" onClick={() => set(null, "Remove transition")} aria-label="Remove transition">
            <XIcon />
          </Button>
        ) : null}
      </div>
      {!hasPrev ? (
        <p className="text-[11px] text-muted-foreground">
          No clip right before this one on its track — it transitions in over the layers below.
        </p>
      ) : null}
      {t ? (
        <>
          <FieldRow label="Duration">
            <NumberField
              value={t.duration / fps}
              step={0.05}
              min={1 / fps}
              max={clip.duration / fps}
              precision={2}
              suffix="s"
              onChange={(s) => set({ ...t, duration: Math.max(1, Math.round(s * fps)) }, "Transition duration")}
            />
          </FieldRow>
          {t.type === "slide" || t.type === "push" || t.type === "wipe" || t.type === "whip" ? (
            <FieldRow label="Direction">
              <SelectField
                value={t.direction ?? "left"}
                options={["left", "right", "up", "down"]}
                onChange={(d) => set({ ...t, direction: d as Transition["direction"] }, "Transition direction")}
              />
            </FieldRow>
          ) : null}
          <FieldRow label="Easing">
            <EasingField value={t.easing} onChange={(easing) => set({ ...t, easing }, "Transition easing")} />
          </FieldRow>
        </>
      ) : null}
    </Section>
  );
};
