"use client";

import {
  ArrowRightLeftIcon,
  AudioLinesIcon,
  CaptionsIcon,
  FolderOpenIcon,
  LayoutTemplateIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ShapesIcon,
  TypeIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type LibraryTab, useUIStore } from "../../store/ui-store";

export const LIBRARY_TABS: {
  id: LibraryTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "media", label: "Media", icon: FolderOpenIcon },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "elements", label: "Elements", icon: ShapesIcon },
  { id: "styles", label: "Styles", icon: WandSparklesIcon },
  { id: "captions", label: "Captions", icon: CaptionsIcon },
  { id: "audio", label: "Audio", icon: AudioLinesIcon },
  { id: "transitions", label: "Transitions", icon: ArrowRightLeftIcon },
  { id: "templates", label: "Templates", icon: LayoutTemplateIcon },
];

export const LibraryRail = () => {
  const tab = useUIStore((s) => s.libraryTab);
  const open = useUIStore((s) => s.libraryOpen);
  const setTab = useUIStore((s) => s.setLibraryTab);
  const setOpen = useUIStore((s) => s.setLibraryOpen);
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-panel py-1.5" aria-label="Library">
      {LIBRARY_TABS.map((t) => {
        const active = open && tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => (active ? setOpen(false) : setTab(t.id))}
            className={cn(
              "flex w-12 flex-col items-center gap-1 rounded-md py-1.5 text-[10px] leading-none font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
              active && "bg-foreground/[0.07] text-foreground",
            )}
            aria-pressed={active}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        );
      })}
      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(!open)} aria-label={open ? "Collapse panel" : "Expand panel"}>
              {open ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{open ? "Collapse panel" : "Expand panel"}</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
};
