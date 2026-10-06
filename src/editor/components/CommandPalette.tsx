"use client";

import {
  CaptionsIcon,
  CopyPlusIcon,
  DownloadIcon,
  KeyboardIcon,
  MagnetIcon,
  PlugZapIcon,
  RatioIcon,
  ScissorsIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
  TypeIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { ASPECT_PRESETS, type AspectPresetId } from "@/core/defaults";
import { updateSettings } from "@/core/ops";
import { MOTION_COMPONENTS } from "@/remotion/components/registry";
import { addComponent, addText, deleteSelection, duplicateSelection, run, splitAtPlayhead } from "../actions";
import { useUIStore } from "../store/ui-store";

export type PaletteAction = "export" | "settings" | "connect" | "shortcuts" | "close";

export const CommandPalette: React.FC<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAction: (a: PaletteAction) => void;
}> = ({ open, onOpenChange, onAction }) => {
  const exec = (fn: () => void) => () => {
    fn();
    onAction("close");
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Every editor action">
      <CommandInput placeholder="Type a command or search elements…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Edit">
          <CommandItem onSelect={exec(() => splitAtPlayhead())}>
            <ScissorsIcon /> Split at playhead <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={exec(duplicateSelection)}>
            <CopyPlusIcon /> Duplicate selection <CommandShortcut>Ctrl D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={exec(() => deleteSelection())}>
            <Trash2Icon /> Delete selection <CommandShortcut>Del</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={exec(() => addText())}>
            <TypeIcon /> Add text <CommandShortcut>T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={exec(() => useUIStore.getState().toggleSnapping())}>
            <MagnetIcon /> Toggle snapping <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Format">
          {(Object.keys(ASPECT_PRESETS) as AspectPresetId[]).map((id) => (
            <CommandItem
              key={id}
              onSelect={exec(() =>
                run(`Change format to ${id}`, (d) =>
                  updateSettings(d, { width: ASPECT_PRESETS[id].width, height: ASPECT_PRESETS[id].height }),
                ),
              )}
            >
              <RatioIcon /> Switch to {id} — {ASPECT_PRESETS[id].hint}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Elements">
          {MOTION_COMPONENTS.map((c) => (
            <CommandItem key={c.id} value={`${c.name} ${c.tags?.join(" ") ?? ""}`} onSelect={exec(() => addComponent(c.id))}>
              <SparklesIcon /> Add {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="App">
          <CommandItem onSelect={() => onAction("export")}>
            <DownloadIcon /> Export video
          </CommandItem>
          <CommandItem onSelect={() => onAction("settings")}>
            <SettingsIcon /> Models & API keys
          </CommandItem>
          <CommandItem onSelect={() => onAction("connect")}>
            <PlugZapIcon /> Connect Claude Code / Codex / Cursor
          </CommandItem>
          <CommandItem onSelect={() => onAction("shortcuts")}>
            <KeyboardIcon /> Keyboard shortcuts
          </CommandItem>
          <CommandItem onSelect={exec(() => useUIStore.getState().setLibraryTab("captions"))}>
            <CaptionsIcon /> Captions
          </CommandItem>
          <CommandItem onSelect={exec(() => useUIStore.getState().setLibraryTab("styles"))}>
            <WandSparklesIcon /> Styles
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
