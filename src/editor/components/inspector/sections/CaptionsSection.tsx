"use client";

import { StarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CAPTION_PRESETS, getCaptionPreset, scaledCaptionStyle } from "@/core/caption-presets";
import { USER, updateClip } from "@/core/ops";
import { CAPTION_ANIMATIONS, type CaptionStyle, type CaptionsClip } from "@/core/schema";
import { cn } from "@/lib/utils";
import { run } from "../../../actions";
import { seek, usePlaybackStore } from "../../../store/playback-store";
import { getProject } from "../../../store/project-store";
import { ColorField, FieldRow, FontPicker, NumberField, Section, SelectField, SliderField } from "../fields";

/** Timeline frame of a caption word (handles clip- and source-relative timing). */
const wordFrame = (clip: CaptionsClip, ms: number) => {
  const p = getProject();
  const fps = p.settings.fps;
  if (clip.timeBase === "source" && clip.sourceClipId) {
    const src = p.clips[clip.sourceClipId];
    if (src && (src.type === "video" || src.type === "audio")) {
      return Math.round(src.start + ((ms / 1000) * fps - src.trimStart) / src.speed);
    }
  }
  return Math.round(clip.start + (ms / 1000) * fps);
};

export const CaptionsSection: React.FC<{ clip: CaptionsClip }> = ({ clip }) => {
  const frame = usePlaybackStore((s) => s.frame);
  const s = clip.style;
  const setStyle = (patch: Partial<CaptionStyle>, label = "Caption style") =>
    run(label, (d) => updateClip(d, clip.id, { style: patch }, { actor: USER }), `cstyle:${clip.id}:${Object.keys(patch).join(",")}`);
  const editWord = (i: number, patch: Record<string, unknown>) =>
    run(
      "Edit caption",
      (d) => {
        const c = d.clips[clip.id];
        if (c?.type !== "captions") return;
        c.words[i] = { ...c.words[i], ...patch };
        if (c.meta && c.meta.createdBy !== "user") c.meta.humanEdited = true;
      },
      `cword:${clip.id}:${i}`,
    );

  return (
    <>
      <Section title="Caption style">
        <div className="grid grid-cols-2 gap-1.5">
          {CAPTION_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.description}
              onClick={() => {
                const scaled = scaledCaptionStyle(p, getProject().settings);
                run(`Caption style: ${p.name}`, (d) => {
                  updateClip(d, clip.id, { style: null }, { actor: USER });
                  updateClip(d, clip.id, { style: scaled }, { actor: USER });
                });
              }}
              className={cn(
                "truncate rounded-md border border-border bg-neutral-950 px-2 py-1.5 text-left text-[11px] transition-colors hover:border-ring",
                s.preset === p.id && "border-ai/70 bg-ai-soft",
              )}
              style={{
                fontFamily: `"${p.style.fontFamily}", Inter, sans-serif`,
                fontWeight: p.style.fontWeight,
                textTransform: p.style.textTransform,
                color: p.style.activeColor === p.style.color ? (p.style.emphasisColor ?? p.style.color) : p.style.activeColor,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <FieldRow label="Font">
          <FontPicker value={s.fontFamily} onChange={(fontFamily) => setStyle({ fontFamily, preset: undefined }, "Caption font")} />
        </FieldRow>
        <FieldRow label="Size / weight">
          <NumberField value={s.fontSize} min={8} max={400} suffix="px" onChange={(fontSize) => setStyle({ fontSize })} />
          <NumberField value={s.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => setStyle({ fontWeight })} />
        </FieldRow>
        <FieldRow label="Text / active">
          <ColorField value={s.color} onChange={(color) => setStyle({ color })} />
          <ColorField value={s.activeColor} onChange={(activeColor) => setStyle({ activeColor })} />
        </FieldRow>
        <FieldRow label="Keyword color" hint="Used for words marked with ★">
          <ColorField value={s.emphasisColor ?? "#FFD93D"} onChange={(emphasisColor) => setStyle({ emphasisColor })} />
        </FieldRow>
        <FieldRow label="Animation">
          <SelectField
            value={s.animation}
            options={CAPTION_ANIMATIONS}
            onChange={(animation) => setStyle({ animation: animation as CaptionStyle["animation"] })}
          />
        </FieldRow>
        <FieldRow label="Words / page">
          <SliderField
            value={s.maxWordsPerPage}
            min={1}
            max={12}
            step={1}
            onChange={(maxWordsPerPage) => setStyle({ maxWordsPerPage })}
            format={(v) => v.toFixed(0)}
          />
        </FieldRow>
        <FieldRow label="Case">
          <SelectField
            value={s.textTransform}
            options={[
              { value: "none", label: "As spoken" },
              { value: "uppercase", label: "UPPERCASE" },
              { value: "lowercase", label: "lowercase" },
            ]}
            onChange={(textTransform) => setStyle({ textTransform: textTransform as CaptionStyle["textTransform"] })}
          />
        </FieldRow>
        <FieldRow label="Outline">
          <NumberField
            value={s.stroke?.width ?? 0}
            min={0}
            max={40}
            onChange={(width) => setStyle({ stroke: width > 0 ? { color: s.stroke?.color ?? "#000", width } : undefined })}
          />
          <ColorField
            value={s.stroke?.color ?? "#000000"}
            onChange={(color) => setStyle({ stroke: { width: s.stroke?.width ?? 6, color } })}
          />
        </FieldRow>
        {getCaptionPreset(s.preset ?? "")?.description ? (
          <p className="text-[11px] text-muted-foreground">{getCaptionPreset(s.preset ?? "")?.description}</p>
        ) : null}
      </Section>

      <Section title={`Words · ${clip.words.length}`} defaultOpen={false}>
        <p className="pb-1 text-[11px] text-muted-foreground">Fix words, mark ★ keywords. Click a time to jump there.</p>
        <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
          {clip.words.map((w, i) => {
            const f = wordFrame(clip, w.startMs);
            const active = frame >= f && frame < wordFrame(clip, w.endMs);
            return (
              <div key={`${w.startMs}-${i}`} className={cn("flex items-center gap-1 rounded px-1", active && "bg-ai-soft")}>
                <button
                  type="button"
                  className="tabular w-11 shrink-0 text-left font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => seek(f)}
                >
                  {(w.startMs / 1000).toFixed(2)}
                </button>
                <Input
                  defaultValue={w.text.trim()}
                  onBlur={(e) => e.target.value !== w.text.trim() && editWord(i, { text: ` ${e.target.value.trim()}` })}
                  className="h-6 flex-1 px-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => editWord(i, { emphasis: !w.emphasis })}
                  className={cn(
                    "shrink-0 rounded p-0.5",
                    w.emphasis ? "text-amber-300" : "text-muted-foreground/40 hover:text-muted-foreground",
                  )}
                  aria-label="Toggle keyword"
                >
                  <StarIcon className={cn("size-3", w.emphasis && "fill-current")} />
                </button>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
};
