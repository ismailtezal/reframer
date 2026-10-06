"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "../../store/ui-store";
import { AudioTab } from "./AudioTab";
import { CaptionsTab } from "./CaptionsTab";
import { ElementsTab } from "./ElementsTab";
import { LIBRARY_TABS } from "./LibraryRail";
import { MediaTab } from "./MediaTab";
import { StylesTab } from "./StylesTab";
import { TemplatesTab } from "./TemplatesTab";
import { TextTab } from "./TextTab";
import { TransitionsTab } from "./TransitionsTab";

export const Library = () => {
  const tab = useUIStore((s) => s.libraryTab);
  const meta = LIBRARY_TABS.find((t) => t.id === tab);
  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <h2 className="text-xs font-semibold">{meta?.label}</h2>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="@container/library p-3">
          {tab === "media" && <MediaTab />}
          {tab === "text" && <TextTab />}
          {tab === "elements" && <ElementsTab />}
          {tab === "styles" && <StylesTab />}
          {tab === "captions" && <CaptionsTab />}
          {tab === "audio" && <AudioTab />}
          {tab === "transitions" && <TransitionsTab />}
          {tab === "templates" && <TemplatesTab />}
        </div>
      </ScrollArea>
    </div>
  );
};

/** Small section heading used by every library tab. */
export const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="mt-4 mb-2 flex items-center justify-between first:mt-0">
    <h3 className="text-[11px] font-medium text-muted-foreground">{children}</h3>
    {action}
  </div>
);
