"use client";

import { CodeIcon, TriangleAlertIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ComponentClip, PropField } from "@/core/schema";
import { getComponentErrors, subscribeComponentErrors } from "@/remotion/code/runtime";
import { getMotionComponent } from "@/remotion/components/registry";
import { useAssetsOfType } from "../../../hooks/useAssets";
import { useCoarseFrame } from "../../../store/playback-store";
import { useProjectStore } from "../../../store/project-store";
import { ColorField, FieldRow, FontPicker, KeyframeButton, NumberField, Section, SelectField, SliderField } from "../fields";
import { keyframeState, setValue, toggleKeyframe, valueAtPlayhead } from "../props";

const useComponentErrors = () => useSyncExternalStore(subscribeComponentErrors, getComponentErrors, getComponentErrors);

/** Auto-generated controls from a component's prop schema. */
export const SchemaForm: React.FC<{ clip: ComponentClip; schema: Record<string, PropField> }> = ({ clip, schema }) => {
  const frame = useCoarseFrame();
  const images = useAssetsOfType(["image", "video"]);
  return (
    <>
      {Object.entries(schema).map(([key, field]) => {
        const path = `props.${key}`;
        const label = field.label ?? key;
        const current = valueAtPlayhead<unknown>(clip, path, field.default);
        const kf = (v: number | string) => (
          <KeyframeButton state={keyframeState(clip, path, frame)} onClick={() => toggleKeyframe(clip.id, path, v)} />
        );
        switch (field.type) {
          case "text":
            return (
              <div key={key} className="space-y-1 py-0.5">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Textarea
                  value={String(current ?? "")}
                  rows={2}
                  className="min-h-14 resize-y text-sm"
                  onChange={(e) => setValue(clip.id, path, e.target.value, `Edit ${label}`)}
                />
              </div>
            );
          case "string":
            return (
              <FieldRow key={key} label={label} hint={field.description}>
                <Input
                  value={String(current ?? "")}
                  className="h-7 text-xs"
                  onChange={(e) => setValue(clip.id, path, e.target.value, `Edit ${label}`)}
                />
              </FieldRow>
            );
          case "number": {
            const n = Number(current ?? 0);
            const ranged = field.min !== undefined && field.max !== undefined && field.max - field.min <= 1000;
            return (
              <FieldRow key={key} label={label} hint={field.description}>
                {ranged ? (
                  <SliderField
                    value={n}
                    min={field.min ?? 0}
                    max={field.max ?? 1}
                    step={field.step ?? 0.01}
                    onChange={(v) => setValue(clip.id, path, v, `Edit ${label}`)}
                    format={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed((field.step ?? 0.01) >= 1 ? 0 : 2))}
                  />
                ) : (
                  <NumberField
                    value={n}
                    step={field.step ?? 1}
                    min={field.min}
                    max={field.max}
                    onChange={(v) => setValue(clip.id, path, v, `Edit ${label}`)}
                  />
                )}
                {kf(n)}
              </FieldRow>
            );
          }
          case "boolean":
            return (
              <FieldRow key={key} label={label} hint={field.description}>
                <Switch checked={!!current} onCheckedChange={(v) => setValue(clip.id, path, v, `Toggle ${label}`)} />
              </FieldRow>
            );
          case "color":
            return (
              <FieldRow key={key} label={label} hint={field.description}>
                <ColorField value={String(current ?? "#ffffff")} onChange={(v) => setValue(clip.id, path, v, `Edit ${label}`)} />
                {kf(String(current ?? "#ffffff"))}
              </FieldRow>
            );
          case "enum":
            return (
              <FieldRow key={key} label={label} hint={field.description}>
                <SelectField
                  value={String(current ?? field.options?.[0] ?? "")}
                  options={field.options ?? []}
                  onChange={(v) => setValue(clip.id, path, v, `Edit ${label}`)}
                />
              </FieldRow>
            );
          case "font":
            return (
              <FieldRow key={key} label={label}>
                <FontPicker value={String(current ?? "Inter")} onChange={(v) => setValue(clip.id, path, v, "Change font")} />
              </FieldRow>
            );
          case "asset":
            return (
              <FieldRow key={key} label={label} hint={field.description}>
                <SelectField
                  value={String(current ?? "") || "__none"}
                  options={[{ value: "__none", label: "— none —" }, ...images.map((a) => ({ value: a.id, label: a.name }))]}
                  onChange={(v) => setValue(clip.id, path, v === "__none" ? "" : v, `Set ${label}`)}
                />
              </FieldRow>
            );
          default:
            return null;
        }
      })}
    </>
  );
};

export const ComponentSection: React.FC<{ clip: ComponentClip; onEditCode?: (componentId: string) => void }> = ({ clip, onEditCode }) => {
  const errors = useComponentErrors();
  const project = useProjectStore((s) => s.project);
  const isCode = clip.component.startsWith("code:");
  const code = isCode ? project?.components[clip.component.slice(5)] : undefined;
  const def = isCode ? undefined : getMotionComponent(clip.component);
  const schema = code?.propsSchema ?? (def?.schema as Record<string, PropField> | undefined) ?? {};
  const error = errors.find((e) => e.clipId === clip.id);

  return (
    <Section
      title={def?.name ?? code?.name ?? "Component"}
      action={
        isCode && code && onEditCode ? (
          <Button variant="ghost" size="xs" onClick={() => onEditCode(code.id)} className="gap-1 text-xs">
            <CodeIcon /> Code
          </Button>
        ) : null
      }
    >
      {def?.description || code?.description ? (
        <p className="pb-1 text-[11px] leading-snug text-muted-foreground">{def?.description ?? code?.description}</p>
      ) : null}
      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="font-mono">{error.message}</span>
        </div>
      ) : null}
      {Object.keys(schema).length === 0 ? (
        <p className="text-xs text-muted-foreground">No adjustable properties.</p>
      ) : (
        <SchemaForm clip={clip} schema={schema} />
      )}
    </Section>
  );
};
