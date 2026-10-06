"use client";

import { Switch } from "@/components/ui/switch";
import { USER, updateClip } from "@/core/ops";
import type { AudioClip, ImageClip, VideoClip } from "@/core/schema";
import { run } from "../../../actions";
import { usePlaybackStore } from "../../../store/playback-store";
import { getProject } from "../../../store/project-store";
import { FieldRow, KeyframeButton, NumberField, Section, SelectField, SliderField } from "../fields";
import { keyframeState, setValue, toggleKeyframe, valueAtPlayhead } from "../props";

export const MediaSection: React.FC<{ clip: VideoClip | AudioClip | ImageClip }> = ({ clip }) => {
  const frame = usePlaybackStore((s) => s.frame);
  const project = getProject();
  const asset = project.assets[clip.assetId];
  const fps = project.settings.fps;
  const patch = (p: Record<string, unknown>, label: string) =>
    run(label, (d) => updateClip(d, clip.id, p, { actor: USER }), `media:${clip.id}:${Object.keys(p).join(",")}`);

  return (
    <Section title={clip.type === "image" ? "Image" : clip.type === "video" ? "Video & audio" : "Audio"}>
      {asset ? (
        <div className="mb-1 flex items-center gap-2 rounded-md bg-panel-2 p-1.5 text-[11px] text-muted-foreground">
          {asset.thumbnail ? (
            // biome-ignore lint/performance/noImgElement: data-URL thumbnail
            <img src={asset.thumbnail} alt="" className="h-8 w-14 rounded object-cover" />
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-foreground">{asset.name}</div>
            <div>
              {asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}
              {asset.durationSec ? ` · ${asset.durationSec.toFixed(1)}s` : ""}
              {asset.fps ? ` · ${asset.fps}fps` : ""}
            </div>
          </div>
        </div>
      ) : null}
      {clip.type !== "audio" ? (
        <FieldRow label="Fit">
          <SelectField
            value={clip.fit}
            options={[
              { value: "cover", label: "Fill (crop)" },
              { value: "contain", label: "Fit (letterbox)" },
              { value: "fill", label: "Stretch" },
            ]}
            onChange={(fit) => patch({ fit }, "Change fit")}
          />
        </FieldRow>
      ) : null}
      {clip.type !== "image" ? (
        <>
          <FieldRow label="Volume">
            <SliderField
              value={valueAtPlayhead<number>(clip, "volume", clip.volume)}
              min={0}
              max={2}
              onChange={(v) => setValue(clip.id, "volume", v, "Volume")}
              format={(v) => (v <= 0 ? "-∞ dB" : `${(20 * Math.log10(v)).toFixed(1)} dB`)}
            />
            <KeyframeButton
              state={keyframeState(clip, "volume", frame)}
              onClick={() => toggleKeyframe(clip.id, "volume", valueAtPlayhead<number>(clip, "volume", clip.volume))}
            />
          </FieldRow>
          <FieldRow label="Mute">
            <Switch checked={!!clip.muted} onCheckedChange={(muted) => patch({ muted }, muted ? "Mute" : "Unmute")} />
          </FieldRow>
          <FieldRow label="Fade in">
            <NumberField
              value={(clip.fadeIn ?? 0) / fps}
              step={0.1}
              min={0}
              max={clip.duration / fps}
              precision={1}
              suffix="s"
              onChange={(v) => patch({ fadeIn: Math.round(v * fps) }, "Fade in")}
            />
          </FieldRow>
          <FieldRow label="Fade out">
            <NumberField
              value={(clip.fadeOut ?? 0) / fps}
              step={0.1}
              min={0}
              max={clip.duration / fps}
              precision={1}
              suffix="s"
              onChange={(v) => patch({ fadeOut: Math.round(v * fps) }, "Fade out")}
            />
          </FieldRow>
        </>
      ) : null}
      {clip.type === "audio" ? (
        <>
          <FieldRow label="Role">
            <SelectField
              value={clip.role ?? "other"}
              options={[
                { value: "music", label: "Music" },
                { value: "voice", label: "Voice / dialogue" },
                { value: "sfx", label: "Sound effect" },
                { value: "other", label: "Other" },
              ]}
              onChange={(role) => patch({ role, duck: role === "music" ? true : clip.duck }, "Audio role")}
            />
          </FieldRow>
          <FieldRow label="Auto-duck" hint="Lower this track automatically under speech">
            <Switch checked={!!clip.duck} onCheckedChange={(duck) => patch({ duck }, duck ? "Enable ducking" : "Disable ducking")} />
          </FieldRow>
        </>
      ) : null}
    </Section>
  );
};
