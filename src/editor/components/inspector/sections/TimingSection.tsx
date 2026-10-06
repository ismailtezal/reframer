"use client";

import { Input } from "@/components/ui/input";
import { moveClip, trimClip, USER, updateClip } from "@/core/ops";
import { BlendModeSchema, type Clip } from "@/core/schema";
import { formatSeconds, parseTimecode } from "@/core/time";
import { run } from "../../../actions";
import { getProject } from "../../../store/project-store";
import { FieldRow, NumberField, Section, SelectField } from "../fields";

const TimeInput: React.FC<{ frames: number; fps: number; onChange: (frames: number) => void }> = ({ frames, fps, onChange }) => (
  <Input
    key={frames}
    defaultValue={formatSeconds(frames, fps, 2)}
    onBlur={(e) => {
      const v = parseTimecode(e.target.value, fps);
      if (v !== null && v !== frames) onChange(v);
      else e.target.value = formatSeconds(frames, fps, 2);
    }}
    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    className="tabular h-7 font-mono text-xs"
  />
);

export const TimingSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const fps = getProject().settings.fps;
  return (
    <Section title="Timing" defaultOpen={false}>
      <FieldRow label="Start">
        <TimeInput
          frames={clip.start}
          fps={fps}
          onChange={(f) => run("Move clip", (d) => moveClip(d, clip.id, { start: f }, "auto-track", { actor: USER }))}
        />
      </FieldRow>
      <FieldRow label="Duration">
        <TimeInput
          frames={clip.duration}
          fps={fps}
          onChange={(f) => run("Change duration", (d) => trimClip(d, clip.id, { end: clip.start + Math.max(1, f) }, { actor: USER }))}
        />
      </FieldRow>
      {clip.type === "video" || clip.type === "audio" ? (
        <FieldRow label="Speed" hint="Changes playback speed; the clip length adapts">
          <NumberField
            value={clip.speed}
            step={0.05}
            min={0.1}
            max={16}
            precision={2}
            suffix="×"
            onChange={(v) =>
              run("Change speed", (d) => {
                const c = d.clips[clip.id];
                if (!c || (c.type !== "video" && c.type !== "audio")) return;
                // Keep the same source range: duration scales inversely with speed.
                const sourceFrames = c.duration * c.speed;
                updateClip(d, clip.id, { speed: v, duration: Math.max(1, Math.round(sourceFrames / v)) }, { actor: USER });
              })
            }
          />
        </FieldRow>
      ) : null}
      {clip.type !== "audio" ? (
        <FieldRow label="Blend">
          <SelectField
            value={clip.blendMode ?? "normal"}
            options={BlendModeSchema.options}
            onChange={(v) => run("Blend mode", (d) => updateClip(d, clip.id, { blendMode: v }, { actor: USER }))}
          />
        </FieldRow>
      ) : null}
    </Section>
  );
};
