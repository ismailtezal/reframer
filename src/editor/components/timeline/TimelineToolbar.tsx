"use client";

import { CopyPlusIcon, MagnetIcon, ScissorsIcon, Trash2Icon, UnfoldHorizontalIcon, WavesIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getProjectDuration } from "@/core/project-utils";
import { deleteSelection, duplicateSelection, splitAtPlayhead } from "../../actions";
import { useProjectStore } from "../../store/project-store";
import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND, useUIStore } from "../../store/ui-store";

const ToolButton: React.FC<{
  label: string;
  kbd?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, kbd, onClick, active, disabled, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {label}
      {kbd ? <Kbd>{kbd}</Kbd> : null}
    </TooltipContent>
  </Tooltip>
);

// Logarithmic zoom slider so both ends feel equally fine-grained.
const toSlider = (pps: number) => (Math.log(pps / MIN_PX_PER_SECOND) / Math.log(MAX_PX_PER_SECOND / MIN_PX_PER_SECOND)) * 100;
const fromSlider = (v: number) => MIN_PX_PER_SECOND * (MAX_PX_PER_SECOND / MIN_PX_PER_SECOND) ** (v / 100);

export const TimelineToolbar: React.FC<{ viewportWidth: number }> = ({ viewportWidth }) => {
  const hasSelection = useUIStore((s) => s.selectedClipIds.length > 0);
  const snapping = useUIStore((s) => s.snapping);
  const ripple = useUIStore((s) => s.rippleDelete);
  const pps = useUIStore((s) => s.pxPerSecond);
  const project = useProjectStore((s) => s.project);
  const ui = useUIStore.getState;

  const fitToView = () => {
    if (!project) return;
    const seconds = getProjectDuration(project) / project.settings.fps;
    ui().setPxPerSecond(Math.max(MIN_PX_PER_SECOND, (viewportWidth - 48) / Math.max(1, seconds)));
  };

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border bg-panel px-1.5">
      <ToolButton label="Split at playhead" kbd="S" onClick={() => splitAtPlayhead()}>
        <ScissorsIcon />
      </ToolButton>
      <ToolButton label="Duplicate" kbd="Ctrl D" onClick={duplicateSelection} disabled={!hasSelection}>
        <CopyPlusIcon />
      </ToolButton>
      <ToolButton label="Delete" kbd="Del" onClick={() => deleteSelection()} disabled={!hasSelection}>
        <Trash2Icon />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-4 self-center" />
      <ToolButton label={snapping ? "Snapping on" : "Snapping off"} kbd="N" onClick={ui().toggleSnapping} active={snapping}>
        <MagnetIcon />
      </ToolButton>
      <ToolButton label={ripple ? "Ripple delete on: closes gaps" : "Ripple delete off"} onClick={ui().toggleRipple} active={ripple}>
        <WavesIcon />
      </ToolButton>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton label="Zoom out" kbd="-" onClick={() => ui().setPxPerSecond(pps / 1.4)}>
          <ZoomOutIcon />
        </ToolButton>
        <Slider
          className="mx-1.5 w-24"
          min={0}
          max={100}
          step={0.5}
          value={[toSlider(pps)]}
          onValueChange={([v]) => ui().setPxPerSecond(fromSlider(v))}
          aria-label="Timeline zoom"
        />
        <ToolButton label="Zoom in" kbd="=" onClick={() => ui().setPxPerSecond(pps * 1.4)}>
          <ZoomInIcon />
        </ToolButton>
        <ToolButton label="Fit to window" kbd="Shift Z" onClick={fitToView}>
          <UnfoldHorizontalIcon />
        </ToolButton>
      </div>
    </div>
  );
};
