"use client";

import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  MaximizeIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { USER, updateClip } from "@/core/ops";
import type { Clip } from "@/core/schema";
import { run } from "../../../actions";
import { useCoarseFrame } from "../../../store/playback-store";
import { getProject } from "../../../store/project-store";
import { FieldRow, KeyframeButton, NumberField, Section, SliderField } from "../fields";
import { keyframeState, setValue, toggleKeyframe, valueAtPlayhead } from "../props";

const IconBtn: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-xs" onClick={onClick} aria-label={label}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const TransformSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCoarseFrame();
  const { width: W, height: H } = getProject().settings;
  const field = (path: "x" | "y" | "width" | "height" | "scale" | "rotation", label: string, step = 1, precision?: number) => {
    const v = valueAtPlayhead<number>(clip, path, 0);
    return (
      <div className="flex min-w-0 items-center gap-0.5">
        <NumberField prefix={label} value={v} step={step} precision={precision} onChange={(nv) => setValue(clip.id, path, nv)} />
        <KeyframeButton state={keyframeState(clip, path, frame)} onClick={() => toggleKeyframe(clip.id, path, v)} />
      </div>
    );
  };
  const opacity = valueAtPlayhead<number>(clip, "opacity", 1);
  const blur = valueAtPlayhead<number>(clip, "blur", 0);
  const patch = (p: Record<string, unknown>, label: string) => run(label, (d) => updateClip(d, clip.id, p, { actor: USER }));

  return (
    <Section
      title="Transform"
      action={
        <div className="flex items-center">
          <IconBtn label="Center horizontally" onClick={() => setValue(clip.id, "x", W / 2, "Center horizontally")}>
            <AlignCenterVerticalIcon />
          </IconBtn>
          <IconBtn label="Center vertically" onClick={() => setValue(clip.id, "y", H / 2, "Center vertically")}>
            <AlignCenterHorizontalIcon />
          </IconBtn>
          <IconBtn
            label="Fill frame"
            onClick={() => patch({ transform: { x: W / 2, y: H / 2, width: W, height: H, scale: 1, rotation: 0 } }, "Fill frame")}
          >
            <MaximizeIcon />
          </IconBtn>
          <IconBtn label="Reset rotation & scale" onClick={() => patch({ transform: { scale: 1, rotation: 0 } }, "Reset transform")}>
            <RotateCcwIcon />
          </IconBtn>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        {field("x", "X")}
        {field("y", "Y")}
        {field("width", "W")}
        {clip.type === "text" ? <div /> : field("height", "H")}
        {field("scale", "S", 0.01, 2)}
        {field("rotation", "R", 1, 1)}
      </div>
      <FieldRow label="Opacity">
        <SliderField
          value={opacity}
          min={0}
          max={1}
          onChange={(v) => setValue(clip.id, "opacity", v)}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <KeyframeButton state={keyframeState(clip, "opacity", frame)} onClick={() => toggleKeyframe(clip.id, "opacity", opacity)} />
      </FieldRow>
      <FieldRow label="Blur">
        <SliderField
          value={blur}
          min={0}
          max={60}
          step={0.5}
          onChange={(v) => setValue(clip.id, "blur", v)}
          format={(v) => `${v.toFixed(0)}px`}
        />
        <KeyframeButton state={keyframeState(clip, "blur", frame)} onClick={() => toggleKeyframe(clip.id, "blur", blur)} />
      </FieldRow>
      {clip.type === "video" || clip.type === "image" || clip.type === "shape" || clip.type === "component" ? (
        <FieldRow label="Corner radius">
          <SliderField
            value={clip.transform.radius ?? 0}
            min={0}
            max={Math.round(Math.min(clip.transform.width, clip.transform.height) / 2)}
            step={1}
            onChange={(v) => patch({ transform: { radius: v } }, "Corner radius")}
            format={(v) => `${v.toFixed(0)}`}
          />
        </FieldRow>
      ) : null}
      {clip.type === "video" || clip.type === "image" ? (
        <FieldRow label="Crop">
          <div className="grid flex-1 grid-cols-4 gap-1">
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <NumberField
                key={side}
                prefix={side[0].toUpperCase()}
                value={Math.round((clip.transform.crop?.[side] ?? 0) * 100)}
                min={0}
                max={95}
                suffix="%"
                onChange={(v) =>
                  patch({ transform: { crop: { top: 0, right: 0, bottom: 0, left: 0, ...clip.transform.crop, [side]: v / 100 } } }, "Crop")
                }
              />
            ))}
          </div>
        </FieldRow>
      ) : null}
      <FieldRow label="Flip">
        <Button
          variant={clip.transform.flipX ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => patch({ transform: { flipX: !clip.transform.flipX } }, "Flip horizontal")}
          aria-label="Flip horizontal"
        >
          <FlipHorizontal2Icon />
        </Button>
        <Button
          variant={clip.transform.flipY ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => patch({ transform: { flipY: !clip.transform.flipY } }, "Flip vertical")}
          aria-label="Flip vertical"
        >
          <FlipVertical2Icon />
        </Button>
      </FieldRow>
    </Section>
  );
};
