"use client";

import { LockIcon, SparklesIcon, Trash2Icon, UnlockIcon, UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ANIMATION_LABELS } from "@/core/animation";
import { USER, updateClip, updateSettings } from "@/core/ops";
import { describeAspect, getProjectDuration } from "@/core/project-utils";
import { ANIMATION_IN_OUT_TYPES, type AnimationInOutType, type Clip } from "@/core/schema";
import { formatSeconds } from "@/core/time";
import { deleteSelection, duplicateSelection, run } from "../../actions";
import { useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { clipLabel } from "../timeline/ClipItem";
import { ColorField, FieldRow, NumberField, Section, SelectField } from "./fields";
import { AnimationSection } from "./sections/AnimationSection";
import { CaptionsSection } from "./sections/CaptionsSection";
import { ComponentSection } from "./sections/ComponentSection";
import { EffectsSection } from "./sections/EffectsSection";
import { MediaSection } from "./sections/MediaSection";
import { BackgroundSection, ShapeSection } from "./sections/ShapeSection";
import { TextSection } from "./sections/TextSection";
import { TimingSection } from "./sections/TimingSection";
import { TransformSection } from "./sections/TransformSection";
import { TransitionSection } from "./sections/TransitionSection";

const TYPE_NAME: Record<Clip["type"], string> = {
  video: "Video",
  audio: "Audio",
  image: "Image",
  text: "Text",
  shape: "Shape",
  background: "Background",
  captions: "Captions",
  component: "Element",
};

const ClipHeader: React.FC<{ clip: Clip }> = ({ clip }) => {
  const project = useProjectStore((s) => s.project);
  const asset = project && "assetId" in clip ? project.assets[clip.assetId] : undefined;
  const byAgent = clip.meta?.createdBy === "ai" || clip.meta?.createdBy === "agent";
  return (
    <div className="space-y-2 border-b border-border/70 p-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {TYPE_NAME[clip.type]}
        </Badge>
        <Input
          key={clip.id}
          defaultValue={clip.name ?? clipLabel(clip, asset)}
          onBlur={(e) =>
            e.target.value.trim() && run("Rename clip", (d) => updateClip(d, clip.id, { name: e.target.value.trim() }, { actor: USER }))
          }
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-7 flex-1 text-sm font-medium"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            run(clip.locked ? "Unlock clip" : "Lock clip", (d) => updateClip(d, clip.id, { locked: !clip.locked }, { actor: USER }))
          }
          aria-label={clip.locked ? "Unlock" : "Lock (also protects from the agent)"}
          className={clip.locked ? "text-amber-400" : undefined}
        >
          {clip.locked ? <LockIcon /> : <UnlockIcon />}
        </Button>
      </div>
      {byAgent ? (
        <div className="flex items-start gap-1.5 rounded-md bg-ai-soft px-2 py-1.5 text-[11px] text-foreground/90">
          <SparklesIcon className="mt-0.5 size-3 shrink-0 text-ai" />
          <div>
            <span className="font-medium">Made by {clip.meta?.agent ?? "the agent"}</span>
            {clip.meta?.humanEdited ? (
              <span className="text-muted-foreground"> · edited by you (the agent will ask before changing it)</span>
            ) : null}
            {clip.meta?.note ? <p className="mt-0.5 text-muted-foreground">{clip.meta.note}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ClipInspector: React.FC<{ clip: Clip }> = ({ clip }) => (
  <div>
    <ClipHeader clip={clip} />
    {clip.type === "text" ? <TextSection clip={clip} /> : null}
    {clip.type === "captions" ? <CaptionsSection clip={clip} /> : null}
    {clip.type === "component" ? <ComponentSection clip={clip} /> : null}
    {clip.type === "video" || clip.type === "audio" || clip.type === "image" ? <MediaSection clip={clip} /> : null}
    {clip.type === "shape" ? <ShapeSection clip={clip} /> : null}
    {clip.type === "background" ? <BackgroundSection clip={clip} /> : null}
    {clip.type !== "audio" ? <TransformSection clip={clip} /> : null}
    {clip.type !== "audio" ? <AnimationSection clip={clip} /> : null}
    {clip.type !== "audio" ? <EffectsSection clip={clip} /> : null}
    {clip.type !== "audio" ? <TransitionSection clip={clip} /> : null}
    <TimingSection clip={clip} />
  </div>
);

const MultiInspector: React.FC<{ clips: Clip[] }> = ({ clips }) => {
  const visual = clips.filter((c) => c.type !== "audio");
  return (
    <div className="space-y-3 p-3">
      <p className="text-sm font-medium">{clips.length} clips selected</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={duplicateSelection}>
          Duplicate
        </Button>
        <Button size="sm" variant="secondary" onClick={() => deleteSelection()}>
          <Trash2Icon /> Delete
        </Button>
      </div>
      {visual.length ? (
        <FieldRow label="In animation">
          <SelectField
            value=""
            placeholder="Apply to all…"
            options={ANIMATION_IN_OUT_TYPES.map((t) => ({ value: t, label: ANIMATION_LABELS[t] }))}
            onChange={(t) =>
              run("Animate selection", (d) => {
                for (const c of visual) {
                  updateClip(
                    d,
                    c.id,
                    { animations: { ...(d.clips[c.id]?.animations ?? {}), in: { type: t as AnimationInOutType, duration: 15 } } },
                    { actor: USER },
                  );
                }
              })
            }
          />
        </FieldRow>
      ) : null}
      <p className="text-xs text-muted-foreground">Tip: press Ctrl K to ask the agent to change all of them at once.</p>
    </div>
  );
};

const ProjectInspector = () => {
  const project = useProjectStore((s) => s.project);
  if (!project) return null;
  const s = project.settings;
  const duration = getProjectDuration(project);
  return (
    <div>
      <div className="border-b border-border/70 p-3">
        <p className="text-sm font-medium">{project.name}</p>
        <p className="text-xs text-muted-foreground">
          {describeAspect(s.width, s.height)} · {s.width}×{s.height} · {s.fps} fps · {formatSeconds(duration, s.fps)}
        </p>
      </div>
      <Section title="Canvas">
        <FieldRow label="Size">
          <NumberField
            prefix="W"
            value={s.width}
            min={16}
            max={7680}
            onChange={(width) => run("Canvas width", (d) => updateSettings(d, { width: Math.round(width) }))}
          />
          <NumberField
            prefix="H"
            value={s.height}
            min={16}
            max={7680}
            onChange={(height) => run("Canvas height", (d) => updateSettings(d, { height: Math.round(height) }))}
          />
        </FieldRow>
        <FieldRow label="Background">
          <ColorField
            value={s.backgroundColor}
            onChange={(backgroundColor) => run("Background color", (d) => updateSettings(d, { backgroundColor }), "bgcolor")}
          />
        </FieldRow>
        <FieldRow label="Length" hint="Leave on auto to end with the last clip">
          <SelectField
            value={s.durationInFrames ? "fixed" : "auto"}
            options={[
              { value: "auto", label: "Auto (last clip)" },
              { value: "fixed", label: "Fixed length" },
            ]}
            onChange={(v) => run("Duration mode", (d) => updateSettings(d, { durationInFrames: v === "fixed" ? duration : undefined }))}
          />
        </FieldRow>
        {s.durationInFrames ? (
          <FieldRow label="Seconds">
            <NumberField
              value={s.durationInFrames / s.fps}
              step={0.5}
              min={0.1}
              precision={2}
              suffix="s"
              onChange={(sec) => run("Set length", (d) => updateSettings(d, { durationInFrames: Math.max(1, Math.round(sec * s.fps)) }))}
            />
          </FieldRow>
        ) : null}
      </Section>
      {project.brief?.prompt ? (
        <Section title="Brief">
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{project.brief.prompt}</p>
        </Section>
      ) : null}
      <div className="p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <UserIcon className="size-3" /> Select a clip to edit it. Everything the agent makes stays editable here.
        </p>
      </div>
    </div>
  );
};

export const Inspector = () => {
  const selected = useUIStore((s) => s.selectedClipIds);
  const allClips = useProjectStore((s) => s.project?.clips);
  const clips = selected.map((id) => allClips?.[id]).filter((c): c is Clip => !!c);
  return (
    <ScrollArea className="h-full">
      {clips.length === 0 ? (
        <ProjectInspector />
      ) : clips.length === 1 ? (
        <ClipInspector clip={clips[0]} />
      ) : (
        <MultiInspector clips={clips} />
      )}
    </ScrollArea>
  );
};
