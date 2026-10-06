"use client";

import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ItalicIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getFontEntry } from "@/core/fonts";
import { USER, updateClip } from "@/core/ops";
import type { TextClip, TextStyle } from "@/core/schema";
import { run } from "../../../actions";
import { usePlaybackStore } from "../../../store/playback-store";
import { ColorField, FieldRow, FontPicker, KeyframeButton, NumberField, Section, SelectField, SliderField } from "../fields";
import { keyframeState, setValue, toggleKeyframe, valueAtPlayhead } from "../props";

export const TextSection: React.FC<{ clip: TextClip }> = ({ clip }) => {
  const frame = usePlaybackStore((s) => s.frame);
  const s = clip.style;
  const setStyle = (patch: Partial<TextStyle>, label = "Edit text style") =>
    run(label, (d) => updateClip(d, clip.id, { style: patch }, { actor: USER }), `style:${clip.id}:${Object.keys(patch).join(",")}`);
  const weights = getFontEntry(s.fontFamily)?.weights ?? [300, 400, 500, 600, 700, 800, 900];
  const color = valueAtPlayhead<string>(clip, "style.color", s.color);
  const fontSize = valueAtPlayhead<number>(clip, "style.fontSize", s.fontSize);

  return (
    <>
      <Section title="Text">
        <Textarea
          value={clip.text}
          onChange={(e) => run("Edit text", (d) => updateClip(d, clip.id, { text: e.target.value }, { actor: USER }), `text:${clip.id}`)}
          rows={3}
          className="min-h-16 resize-y text-sm"
        />
        <FieldRow label="Font">
          <FontPicker value={s.fontFamily} onChange={(fontFamily) => setStyle({ fontFamily }, "Change font")} />
        </FieldRow>
        <FieldRow label="Weight">
          <SelectField
            value={String(s.fontWeight)}
            options={weights.map((w) => ({ value: String(w), label: String(w) }))}
            onChange={(v) => setStyle({ fontWeight: Number(v) }, "Font weight")}
          />
          <Toggle size="sm" pressed={!!s.italic} onPressedChange={(italic) => setStyle({ italic })} aria-label="Italic" className="h-7">
            <ItalicIcon />
          </Toggle>
        </FieldRow>
        <FieldRow label="Size">
          <NumberField
            value={fontSize}
            min={4}
            max={800}
            onChange={(v) => setValue(clip.id, "style.fontSize", v, "Font size")}
            suffix="px"
          />
          <KeyframeButton
            state={keyframeState(clip, "style.fontSize", frame)}
            onClick={() => toggleKeyframe(clip.id, "style.fontSize", fontSize)}
          />
        </FieldRow>
        <FieldRow label="Color">
          <ColorField value={color} onChange={(v) => setValue(clip.id, "style.color", v, "Text color")} />
          <KeyframeButton state={keyframeState(clip, "style.color", frame)} onClick={() => toggleKeyframe(clip.id, "style.color", color)} />
        </FieldRow>
        <FieldRow label="Align">
          <ToggleGroup
            type="single"
            size="sm"
            value={s.align}
            onValueChange={(v) => v && setStyle({ align: v as TextStyle["align"] }, "Align text")}
            className="h-7"
          >
            <ToggleGroupItem value="left" aria-label="Left">
              <AlignLeftIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Center">
              <AlignCenterIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Right">
              <AlignRightIcon />
            </ToggleGroupItem>
          </ToggleGroup>
          <SelectField
            value={s.textTransform}
            options={[
              { value: "none", label: "Aa" },
              { value: "uppercase", label: "AA" },
              { value: "lowercase", label: "aa" },
              { value: "capitalize", label: "Aa Aa" },
            ]}
            onChange={(v) => setStyle({ textTransform: v as TextStyle["textTransform"] }, "Text case")}
          />
        </FieldRow>
        <FieldRow label="Tracking">
          <SliderField
            value={s.letterSpacing}
            min={-0.1}
            max={0.5}
            step={0.005}
            onChange={(letterSpacing) => setStyle({ letterSpacing })}
            format={(v) => v.toFixed(3)}
          />
        </FieldRow>
        <FieldRow label="Line height">
          <SliderField value={s.lineHeight} min={0.7} max={2.2} step={0.01} onChange={(lineHeight) => setStyle({ lineHeight })} />
        </FieldRow>
      </Section>

      <Section title="Text effects" defaultOpen={false}>
        <FieldRow label="Gradient">
          <Switch
            checked={!!s.gradient}
            onCheckedChange={(on) =>
              setStyle(
                {
                  gradient: on
                    ? {
                        type: "linear",
                        angle: 100,
                        stops: [
                          { color: s.color, pos: 0 },
                          { color: "#A78BFA", pos: 1 },
                        ],
                      }
                    : undefined,
                },
                on ? "Add gradient" : "Remove gradient",
              )
            }
          />
          {s.gradient?.type === "linear" ? (
            <>
              <ColorField
                value={s.gradient.stops[0].color}
                onChange={(c) =>
                  s.gradient?.type === "linear" &&
                  setStyle({ gradient: { ...s.gradient, stops: [{ ...s.gradient.stops[0], color: c }, ...s.gradient.stops.slice(1)] } })
                }
              />
              <ColorField
                value={s.gradient.stops[s.gradient.stops.length - 1].color}
                onChange={(c) =>
                  s.gradient?.type === "linear" &&
                  setStyle({
                    gradient: {
                      ...s.gradient,
                      stops: [...s.gradient.stops.slice(0, -1), { ...s.gradient.stops[s.gradient.stops.length - 1], color: c }],
                    },
                  })
                }
              />
            </>
          ) : null}
        </FieldRow>
        <FieldRow label="Stroke">
          <Switch
            checked={!!s.stroke}
            onCheckedChange={(on) => setStyle({ stroke: on ? { color: "#000000", width: 6 } : undefined }, "Toggle stroke")}
          />
          {s.stroke ? (
            <>
              <ColorField value={s.stroke.color} onChange={(c) => setStyle({ stroke: { width: s.stroke?.width ?? 6, color: c } })} />
              <NumberField
                className="max-w-16"
                value={s.stroke.width}
                min={0}
                max={60}
                onChange={(w) => setStyle({ stroke: { color: s.stroke?.color ?? "#000", width: w } })}
              />
            </>
          ) : null}
        </FieldRow>
        <FieldRow label="Shadow">
          <Switch
            checked={!!s.shadow}
            onCheckedChange={(on) =>
              setStyle({ shadow: on ? { color: "rgba(0,0,0,0.55)", blur: 16, x: 0, y: 6 } : undefined }, "Toggle shadow")
            }
          />
          {s.shadow ? (
            <>
              <ColorField value={s.shadow.color} onChange={(c) => s.shadow && setStyle({ shadow: { ...s.shadow, color: c } })} />
              <NumberField
                className="max-w-16"
                prefix="B"
                value={s.shadow.blur}
                min={0}
                max={120}
                onChange={(blur) => s.shadow && setStyle({ shadow: { ...s.shadow, blur } })}
              />
            </>
          ) : null}
        </FieldRow>
        <FieldRow label="Background">
          <Switch
            checked={!!s.background}
            onCheckedChange={(on) =>
              setStyle({ background: on ? { color: "#000000", paddingX: 24, paddingY: 10, radius: 12 } : undefined }, "Toggle background")
            }
          />
          {s.background ? (
            <>
              <ColorField
                value={s.background.color}
                onChange={(c) => s.background && setStyle({ background: { ...s.background, color: c } })}
              />
              <NumberField
                className="max-w-16"
                prefix="R"
                value={s.background.radius}
                min={0}
                max={200}
                onChange={(radius) => s.background && setStyle({ background: { ...s.background, radius } })}
              />
            </>
          ) : null}
        </FieldRow>
      </Section>
    </>
  );
};
