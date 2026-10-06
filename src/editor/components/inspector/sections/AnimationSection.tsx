"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANIMATION_LABELS } from "@/core/animation";
import { USER, updateClip } from "@/core/ops";
import {
  ANIMATION_IN_OUT_TYPES,
  type AnimationPreset,
  type Clip,
  type ClipAnimations,
  LOOP_TYPES,
  type LoopAnimation,
  TEXT_ANIMATIONS,
  type TextAnimation,
} from "@/core/schema";
import { run } from "../../../actions";
import { getProject } from "../../../store/project-store";
import { EasingField, FieldRow, NumberField, Section, SelectField, SliderField } from "../fields";

const DIRECTIONAL = new Set(["slide", "wipe", "mask-reveal"]);

const PresetEditor: React.FC<{
  label: string;
  value: AnimationPreset | undefined;
  fps: number;
  onChange: (v: AnimationPreset | undefined) => void;
  defaultDuration: number;
}> = ({ label, value, fps, onChange, defaultDuration }) => (
  <div className="space-y-1 rounded-md border border-border/60 p-2">
    <div className="flex items-center gap-1.5">
      <span className="w-8 text-xs text-muted-foreground">{label}</span>
      <SelectField
        value={value?.type ?? "none"}
        options={[{ value: "none", label: "None" }, ...ANIMATION_IN_OUT_TYPES.map((t) => ({ value: t, label: ANIMATION_LABELS[t] }))]}
        onChange={(t) =>
          onChange(
            t === "none" ? undefined : { ...value, type: t as AnimationPreset["type"], duration: value?.duration ?? defaultDuration },
          )
        }
      />
      {value ? (
        <Button variant="ghost" size="icon-xs" onClick={() => onChange(undefined)} aria-label={`Remove ${label} animation`}>
          <XIcon />
        </Button>
      ) : null}
    </div>
    {value ? (
      <>
        <FieldRow label="Duration">
          <NumberField
            value={value.duration / fps}
            step={0.05}
            min={1 / fps}
            max={10}
            precision={2}
            suffix="s"
            onChange={(s) => onChange({ ...value, duration: Math.max(1, Math.round(s * fps)) })}
          />
        </FieldRow>
        <FieldRow label="Easing">
          <EasingField value={value.easing} onChange={(easing) => onChange({ ...value, easing })} />
        </FieldRow>
        {DIRECTIONAL.has(value.type) ? (
          <FieldRow label="Direction">
            <SelectField
              value={value.direction ?? "up"}
              options={["up", "down", "left", "right"]}
              onChange={(d) => onChange({ ...value, direction: d as AnimationPreset["direction"] })}
            />
          </FieldRow>
        ) : null}
        <FieldRow label="Intensity">
          <SliderField value={value.intensity ?? 1} min={0} max={3} onChange={(intensity) => onChange({ ...value, intensity })} />
        </FieldRow>
      </>
    ) : null}
  </div>
);

export const AnimationSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const fps = getProject().settings.fps;
  const setAnimations = (patch: Partial<ClipAnimations>, label: string) =>
    run(
      label,
      (d) => {
        const c = d.clips[clip.id];
        if (!c) return;
        const next = { ...(c.animations ?? {}), ...patch };
        for (const k of Object.keys(next) as (keyof ClipAnimations)[]) if (next[k] === undefined) delete next[k];
        updateClip(d, clip.id, { animations: null }, { actor: USER });
        if (Object.keys(next).length) updateClip(d, clip.id, { animations: next }, { actor: USER });
      },
      `anim:${clip.id}:${Object.keys(patch).join(",")}`,
    );
  const loop = clip.animations?.loop;
  const setLoop = (l: LoopAnimation | undefined) => setAnimations({ loop: l }, "Loop animation");
  const textAnim = clip.type === "text" ? clip.textAnimation : undefined;
  const setTextAnim = (t: TextAnimation | null) =>
    run("Text animation", (d) => updateClip(d, clip.id, { textAnimation: t }, { actor: USER }), `textanim:${clip.id}`);

  return (
    <Section title="Animation">
      <PresetEditor
        label="In"
        value={clip.animations?.in}
        fps={fps}
        defaultDuration={Math.round(fps * 0.5)}
        onChange={(v) => setAnimations({ in: v }, "In animation")}
      />
      <PresetEditor
        label="Out"
        value={clip.animations?.out}
        fps={fps}
        defaultDuration={Math.round(fps * 0.4)}
        onChange={(v) => setAnimations({ out: v }, "Out animation")}
      />
      <div className="space-y-1 rounded-md border border-border/60 p-2">
        <div className="flex items-center gap-1.5">
          <span className="w-8 text-xs text-muted-foreground">Loop</span>
          <SelectField
            value={loop?.type ?? "none"}
            options={[{ value: "none", label: "None" }, ...LOOP_TYPES.map((t) => ({ value: t, label: t }))]}
            onChange={(t) =>
              setLoop(
                t === "none"
                  ? undefined
                  : { type: t as LoopAnimation["type"], period: loop?.period ?? 60, intensity: loop?.intensity ?? 1 },
              )
            }
          />
        </div>
        {loop ? (
          <>
            <FieldRow label="Period">
              <NumberField
                value={(loop.period ?? 60) / fps}
                step={0.1}
                min={0.1}
                max={20}
                precision={1}
                suffix="s"
                onChange={(s) => setLoop({ ...loop, period: Math.max(2, Math.round(s * fps)) })}
              />
            </FieldRow>
            <FieldRow label="Intensity">
              <SliderField value={loop.intensity ?? 1} min={0} max={3} onChange={(intensity) => setLoop({ ...loop, intensity })} />
            </FieldRow>
          </>
        ) : null}
      </div>
      {clip.type === "text" ? (
        <div className="space-y-1 rounded-md border border-border/60 p-2">
          <div className="flex items-center gap-1.5">
            <span className="w-8 text-xs text-muted-foreground">Text</span>
            <SelectField
              value={textAnim?.type ?? "none"}
              options={TEXT_ANIMATIONS.map((t) => ({ value: t, label: t }))}
              onChange={(t) =>
                setTextAnim(
                  t === "none"
                    ? null
                    : {
                        type: t as TextAnimation["type"],
                        unit: textAnim?.unit ?? (t === "typewriter" || t === "scramble" ? "char" : t === "mask-up" ? "line" : "word"),
                        stagger: textAnim?.stagger ?? 3,
                        duration: textAnim?.duration ?? 18,
                      },
                )
              }
            />
          </div>
          {textAnim && textAnim.type !== "none" ? (
            <>
              <FieldRow label="By">
                <SelectField
                  value={textAnim.unit}
                  options={["char", "word", "line"]}
                  onChange={(unit) => setTextAnim({ ...textAnim, unit: unit as TextAnimation["unit"] })}
                />
              </FieldRow>
              <FieldRow label="Stagger">
                <NumberField
                  value={textAnim.stagger}
                  step={1}
                  min={0}
                  max={30}
                  suffix="fr"
                  onChange={(stagger) => setTextAnim({ ...textAnim, stagger })}
                />
              </FieldRow>
              <FieldRow label="Duration">
                <NumberField
                  value={textAnim.duration}
                  step={1}
                  min={1}
                  max={90}
                  suffix="fr"
                  onChange={(duration) => setTextAnim({ ...textAnim, duration })}
                />
              </FieldRow>
              <FieldRow label="Easing">
                <EasingField value={textAnim.easing} onChange={(easing) => setTextAnim({ ...textAnim, easing })} />
              </FieldRow>
            </>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
};
