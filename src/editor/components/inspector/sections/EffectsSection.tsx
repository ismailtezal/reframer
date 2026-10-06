"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { LUT_LIBRARY } from "@/core/luts";
import { addEffect, removeEffect, USER, updateEffect } from "@/core/ops";
import type { Clip, Effect, GradeEffect } from "@/core/schema";
import { run } from "../../../actions";
import { useAssetsOfType } from "../../../hooks/useAssets";
import { ColorField, FieldRow, Section, SelectField, SliderField } from "../fields";

type EffectInput = Parameters<typeof addEffect>[2];

const NEW_EFFECTS: { label: string; make: () => EffectInput; canvasOnly?: boolean }[] = [
  { label: "Color grade", make: () => ({ type: "grade", contrast: 1, saturation: 1 }), canvasOnly: true },
  { label: "Vignette", make: () => ({ type: "vignette", amount: 0.35 }), canvasOnly: true },
  { label: "Film grain", make: () => ({ type: "grain", amount: 0.15 }), canvasOnly: true },
  { label: "Blur", make: () => ({ type: "blur", radius: 8 }) },
  { label: "Glow", make: () => ({ type: "glow", radius: 24, intensity: 0.8, threshold: 0.6 }) },
  { label: "Drop shadow", make: () => ({ type: "drop-shadow", radius: 24, offsetX: 0, offsetY: 12, opacity: 0.5 }) },
  { label: "Chromatic aberration", make: () => ({ type: "chromatic-aberration", amount: 6 }), canvasOnly: true },
  { label: "Zoom blur", make: () => ({ type: "zoom-blur", amount: 30 }), canvasOnly: true },
  { label: "Camera shake", make: () => ({ type: "shake", intensity: 8, frequency: 12 }) },
  { label: "Pixelate", make: () => ({ type: "pixelate", size: 12 }), canvasOnly: true },
  { label: "Duotone", make: () => ({ type: "duotone", dark: "#1e1b4b", light: "#fde68a" }), canvasOnly: true },
  { label: "Black & white", make: () => ({ type: "grayscale", amount: 1 }) },
  { label: "Scanlines", make: () => ({ type: "scanlines", amount: 0.3 }), canvasOnly: true },
  { label: "Halftone", make: () => ({ type: "halftone", size: 10 }), canvasOnly: true },
];

const GRADE_SLIDERS: { key: keyof GradeEffect; label: string; min: number; max: number; def: number; step?: number }[] = [
  { key: "exposure", label: "Exposure", min: -2, max: 2, def: 0 },
  { key: "contrast", label: "Contrast", min: 0.5, max: 1.6, def: 1 },
  { key: "saturation", label: "Saturation", min: 0, max: 2, def: 1 },
  { key: "vibrance", label: "Vibrance", min: -1, max: 1, def: 0 },
  { key: "temperature", label: "Temperature", min: -1, max: 1, def: 0 },
  { key: "tint", label: "Tint", min: -1, max: 1, def: 0 },
  { key: "highlights", label: "Highlights", min: -1, max: 1, def: 0 },
  { key: "shadows", label: "Shadows", min: -1, max: 1, def: 0 },
  { key: "fade", label: "Fade (matte)", min: 0, max: 0.4, def: 0 },
];

const EffectEditor: React.FC<{ clip: Clip; effect: Effect }> = ({ clip, effect }) => {
  const luts = useAssetsOfType(["lut"]);
  const set = (patch: Record<string, unknown>) =>
    run(
      "Edit effect",
      (d) => updateEffect(d, clip.id, effect.id, patch, { actor: USER }),
      `fx:${effect.id}:${Object.keys(patch).join(",")}`,
    );
  const slider = (key: string, label: string, min: number, max: number, value: number, step = 0.01) => (
    <FieldRow key={key} label={label}>
      <SliderField value={value} min={min} max={max} step={step} onChange={(v) => set({ [key]: v })} />
    </FieldRow>
  );
  switch (effect.type) {
    case "grade":
      return (
        <>
          <FieldRow label="Look (LUT)">
            <SelectField
              value={effect.lut ?? "none"}
              options={[
                { value: "none", label: "None" },
                ...LUT_LIBRARY.map((l) => ({ value: l.id, label: l.label })),
                ...luts.map((a) => ({ value: `asset:${a.id}`, label: `↑ ${a.name}` })),
              ]}
              onChange={(v) => set({ lut: v === "none" ? null : v })}
            />
          </FieldRow>
          {effect.lut ? slider("lutIntensity", "Look amount", 0, 1, effect.lutIntensity ?? 1) : null}
          {GRADE_SLIDERS.map((s) => slider(s.key, s.label, s.min, s.max, (effect[s.key] as number | undefined) ?? s.def, s.step))}
        </>
      );
    case "vignette":
      return (
        <>
          {slider("amount", "Amount", 0, 1, effect.amount)}
          {slider("radius", "Radius", 0, 1, effect.radius ?? 0.7)}
          {slider("feather", "Feather", 0, 1, effect.feather ?? 0.4)}
        </>
      );
    case "grain":
      return slider("amount", "Amount", 0, 1, effect.amount);
    case "blur":
      return slider("radius", "Radius", 0, 80, effect.radius, 0.5);
    case "glow":
      return (
        <>
          {slider("radius", "Radius", 0, 120, effect.radius, 1)}
          {slider("intensity", "Intensity", 0, 3, effect.intensity)}
          {slider("threshold", "Threshold", 0, 1, effect.threshold ?? 0.6)}
          <FieldRow label="Color">
            <ColorField value={effect.color ?? "#ffffff"} onChange={(color) => set({ color })} />
          </FieldRow>
        </>
      );
    case "chromatic-aberration":
      return slider("amount", "Amount", 0, 30, effect.amount, 0.5);
    case "zoom-blur":
      return slider("amount", "Amount", 0, 120, effect.amount, 1);
    case "shake":
      return (
        <>
          {slider("intensity", "Intensity", 0, 60, effect.intensity, 0.5)}
          {slider("frequency", "Frequency", 1, 30, effect.frequency ?? 12, 1)}
        </>
      );
    case "drop-shadow":
      return (
        <>
          {slider("radius", "Blur", 0, 120, effect.radius, 1)}
          {slider("offsetY", "Offset Y", -80, 80, effect.offsetY, 1)}
          {slider("opacity", "Opacity", 0, 1, effect.opacity)}
        </>
      );
    case "pixelate":
      return slider("size", "Block size", 1, 80, effect.size, 1);
    case "duotone":
      return (
        <FieldRow label="Colors">
          <ColorField value={effect.dark} onChange={(dark) => set({ dark })} />
          <ColorField value={effect.light} onChange={(light) => set({ light })} />
        </FieldRow>
      );
    case "grayscale":
      return slider("amount", "Amount", 0, 1, effect.amount);
    case "scanlines":
      return slider("amount", "Amount", 0, 1, effect.amount);
    case "halftone":
      return slider("size", "Dot size", 2, 60, effect.size, 1);
  }
};

const EFFECT_LABEL: Record<Effect["type"], string> = {
  grade: "Color grade",
  vignette: "Vignette",
  grain: "Film grain",
  blur: "Blur",
  glow: "Glow",
  "chromatic-aberration": "Chromatic aberration",
  "zoom-blur": "Zoom blur",
  shake: "Camera shake",
  "drop-shadow": "Drop shadow",
  pixelate: "Pixelate",
  duotone: "Duotone",
  grayscale: "Black & white",
  scanlines: "Scanlines",
  halftone: "Halftone",
};

export const EffectsSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const canvas = clip.type === "video" || clip.type === "image";
  const effects = clip.effects ?? [];
  return (
    <Section
      title={canvas ? "Color & effects" : "Effects"}
      defaultOpen={effects.length > 0}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Add effect">
              <PlusIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {NEW_EFFECTS.filter((e) => canvas || !e.canvasOnly).map((e) => (
              <DropdownMenuItem
                key={e.label}
                onClick={() => run(`Add ${e.label}`, (d) => addEffect(d, clip.id, e.make(), { actor: USER }))}
              >
                {e.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {effects.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canvas ? "Grade, LUT looks, grain, glow and more — GPU accelerated." : "Blur, glow, shadow and shake."}
        </p>
      ) : null}
      {effects.map((effect) => (
        <div key={effect.id} className="space-y-1 rounded-md border border-border/60 p-2">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={effect.enabled !== false}
              onCheckedChange={(on) =>
                run(on ? "Enable effect" : "Disable effect", (d) => updateEffect(d, clip.id, effect.id, { enabled: on }, { actor: USER }))
              }
            />
            <span className="flex-1 text-xs font-medium">{EFFECT_LABEL[effect.type]}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => run("Remove effect", (d) => removeEffect(d, clip.id, effect.id, { actor: USER }))}
              aria-label="Remove effect"
            >
              <Trash2Icon />
            </Button>
          </div>
          {effect.enabled !== false ? <EffectEditor clip={clip} effect={effect} /> : null}
        </div>
      ))}
    </Section>
  );
};
