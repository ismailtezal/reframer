"use client";

import { SlidersHorizontalIcon, SparklesIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useBridge } from "./agent/bridge-client";
import { stopAgent } from "./agent/control";
import { useAgentPrompt } from "./agent/prompt-bus";
import { AgentHeaderActions, AgentPanel, type SettingsSection } from "./components/agent/AgentPanel";
import { CommandPalette } from "./components/CommandPalette";
import { ConnectAgentDialog } from "./components/dialogs/ConnectAgentDialog";
import { ExportDialog } from "./components/dialogs/ExportDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { ShortcutsDialog } from "./components/dialogs/ShortcutsDialog";
import { Inspector } from "./components/inspector/Inspector";
import { Library } from "./components/library/Library";
import { LibraryRail } from "./components/library/LibraryRail";
import { Preview } from "./components/preview/Preview";
import { TopBar } from "./components/TopBar";
import { Timeline } from "./components/timeline/Timeline";
import { useShortcuts } from "./hooks/useShortcuts";
import { useAutosave } from "./persistence";
import { useProjectStore } from "./store/project-store";
import { useUIStore } from "./store/ui-store";

type Dialog = "export" | "settings" | "connect" | "shortcuts" | "palette" | null;
type RightTab = "agent" | "inspector";

const storage = typeof window === "undefined" ? undefined : window.localStorage;

/**
 * Layout: library on the left, the preview in the middle (largest), the
 * agent/inspector on the right, and a full-width timeline along the bottom.
 */
export const Editor = () => {
  useAutosave();
  const projectId = useProjectStore((s) => s.project?.id);
  // Agent tool calls run here, in the open window, so every edit is visible live.
  useBridge(projectId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("keys");
  const openSettings = useCallback((section?: SettingsSection) => {
    setSettingsSection(section ?? "keys");
    setDialog("settings");
  }, []);
  const [rightTab, setRightTab] = useState<RightTab>("agent");
  const libraryOpen = useUIStore((s) => s.libraryOpen);
  const [focusNonce, setFocusNonce] = useState(0);

  const workspace = useDefaultLayout({
    id: "reframer-workspace",
    storage,
    panelIds: libraryOpen ? ["library", "preview", "right"] : ["preview", "right"],
  });
  const main = useDefaultLayout({
    id: "reframer-main",
    storage,
    panelIds: ["workspace", "timeline"],
  });

  const handlers = useMemo(
    () => ({
      openCommandPalette: () => setDialog("palette"),
      openInlinePrompt: () => {
        setRightTab("agent");
        setFocusNonce((n) => n + 1);
      },
      focusAgent: () => {
        setRightTab("agent");
        setFocusNonce((n) => n + 1);
      },
      openShortcuts: () => setDialog("shortcuts"),
      stopAgent: () => stopAgent(),
    }),
    [],
  );
  useShortcuts(handlers);
  const closeDialog = useCallback(() => setDialog(null), []);

  // Prompts sent to the agent from the library bring the chat forward.
  useEffect(
    () =>
      useAgentPrompt.subscribe((s) => {
        if (s.request) setRightTab("agent");
      }),
    [],
  );

  // Selecting a clip by hand surfaces its properties (agent selections don't steal focus).
  useEffect(
    () =>
      useUIStore.subscribe((s, prev) => {
        if (
          s.selectedClipIds.length > 0 &&
          s.selectedClipIds !== prev.selectedClipIds &&
          !document.activeElement?.closest("[data-agent-panel]")
        ) {
          setRightTab("inspector");
        }
      }),
    [],
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <TopBar
        onExport={() => setDialog("export")}
        onSettings={() => openSettings()}
        onConnectAgent={() => setDialog("connect")}
        onShortcuts={() => setDialog("shortcuts")}
        onCommandPalette={() => setDialog("palette")}
      />
      <ResizablePanelGroup
        orientation="vertical"
        defaultLayout={main.defaultLayout}
        onLayoutChanged={main.onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="workspace" defaultSize="62" minSize={260} className="min-h-0">
          <div className="flex h-full min-h-0">
            <LibraryRail />
            <ResizablePanelGroup
              orientation="horizontal"
              defaultLayout={workspace.defaultLayout}
              onLayoutChanged={workspace.onLayoutChanged}
              className="min-w-0 flex-1"
            >
              {libraryOpen ? (
                <>
                  <ResizablePanel id="library" defaultSize="22" minSize={248} maxSize="36" className="min-w-0">
                    <Library />
                  </ResizablePanel>
                  <ResizableHandle />
                </>
              ) : null}
              <ResizablePanel id="preview" defaultSize="52" minSize={360} className="min-w-0">
                <Preview />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel id="right" defaultSize="26" minSize={300} maxSize="40" className="min-w-0">
                <RightPanel tab={rightTab} onTab={setRightTab} focusNonce={focusNonce} onOpenSettings={openSettings} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="timeline" defaultSize="38" minSize={180} className="min-h-0">
          <Timeline />
        </ResizablePanel>
      </ResizablePanelGroup>

      <ExportDialog open={dialog === "export"} onOpenChange={(o) => !o && closeDialog()} />
      <SettingsDialog open={dialog === "settings"} section={settingsSection} onOpenChange={(o) => !o && closeDialog()} />
      <ConnectAgentDialog open={dialog === "connect"} onOpenChange={(o) => !o && closeDialog()} />
      <ShortcutsDialog open={dialog === "shortcuts"} onOpenChange={(o) => !o && closeDialog()} />
      <CommandPalette
        open={dialog === "palette"}
        onOpenChange={(o) => !o && closeDialog()}
        onAction={(a) => {
          if (a === "settings") openSettings();
          else if (a === "export" || a === "connect" || a === "shortcuts") setDialog(a);
          else closeDialog();
        }}
      />
    </div>
  );
};

const PanelTab: React.FC<{
  value: RightTab;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ value, icon: Icon, children }) => (
  <TabsPrimitive.Trigger
    value={value}
    className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=active]:bg-foreground/[0.07] data-[state=active]:text-foreground [&_svg]:size-3.5"
  >
    <Icon />
    {children}
  </TabsPrimitive.Trigger>
);

const RightPanel: React.FC<{
  tab: RightTab;
  onTab: (tab: RightTab) => void;
  focusNonce: number;
  onOpenSettings: (section?: SettingsSection) => void;
}> = ({ tab, onTab, focusNonce, onOpenSettings }) => (
  <Tabs value={tab} onValueChange={(v) => onTab(v as RightTab)} className="flex h-full flex-col gap-0 bg-panel">
    <div className="flex h-9 shrink-0 items-center border-b border-border px-1.5">
      <TabsPrimitive.List className="flex items-center gap-0.5" aria-label="Side panel">
        <PanelTab value="agent" icon={SparklesIcon}>
          Agent
        </PanelTab>
        <PanelTab value="inspector" icon={SlidersHorizontalIcon}>
          Inspector
        </PanelTab>
      </TabsPrimitive.List>
      {tab === "agent" ? <AgentHeaderActions /> : null}
    </div>
    <TabsContent value="agent" className="min-h-0 flex-1 data-[state=inactive]:hidden" forceMount>
      <AgentPanel focusNonce={focusNonce} onOpenSettings={onOpenSettings} />
    </TabsContent>
    <TabsContent value="inspector" className="min-h-0 flex-1 overflow-hidden">
      <Inspector />
    </TabsContent>
  </Tabs>
);
