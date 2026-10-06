"use client";

import { useEffect } from "react";
import { newId } from "@/core/ids";
import { addMarker, insertClip, USER } from "@/core/ops";
import { getEditPoints, getProjectDuration } from "@/core/project-utils";
import type { Clip } from "@/core/schema";
import { addText, deleteSelection, duplicateSelection, nudgeSelection, redo, run, splitAtPlayhead, trimToPlayhead, undo } from "../actions";
import { useAgentStore } from "../store/agent-store";
import { getPlayer, pause, play, seek, togglePlay, usePlaybackStore } from "../store/playback-store";
import { getProject, useProjectStore } from "../store/project-store";
import { useUIStore } from "../store/ui-store";

let clipboard: Clip[] = [];

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[data-shortcuts-off]");
};

export type ShortcutHandlers = {
  openCommandPalette: () => void;
  openInlinePrompt: () => void;
  focusAgent: () => void;
  openShortcuts: () => void;
  stopAgent: () => void;
};

export const useShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lower = key.toLowerCase();

      // Global shortcuts that work even while typing.
      if (mod && lower === "k") {
        e.preventDefault();
        handlers.openInlinePrompt();
        return;
      }
      if (mod && lower === "l") {
        e.preventDefault();
        handlers.focusAgent();
        return;
      }
      if ((mod && key === "/") || (mod && e.shiftKey && lower === "p")) {
        e.preventDefault();
        handlers.openCommandPalette();
        return;
      }
      if (isTyping(e.target)) return;

      const project = useProjectStore.getState().project;
      if (!project) return;
      const fps = project.settings.fps;
      const frame = usePlaybackStore.getState().frame;
      const duration = getProjectDuration(project);
      const ui = useUIStore.getState();

      const handled = () => e.preventDefault();
      /** Marks the key as handled and runs the action. */
      const act = (fn: () => unknown) => {
        e.preventDefault();
        fn();
      };

      if (mod && lower === "z") {
        handled();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && lower === "y") return act(() => redo());
      if (mod && lower === "d") return act(() => duplicateSelection());
      if (mod && lower === "a") {
        handled();
        ui.select(Object.keys(project.clips));
        return;
      }
      if (mod && lower === "c") {
        clipboard = ui.selectedClipIds
          .map((id) => project.clips[id])
          .filter(Boolean)
          .map((c) => JSON.parse(JSON.stringify(c)));
        return;
      }
      if (mod && lower === "x") {
        clipboard = ui.selectedClipIds
          .map((id) => project.clips[id])
          .filter(Boolean)
          .map((c) => JSON.parse(JSON.stringify(c)));
        deleteSelection();
        return;
      }
      if (mod && lower === "v") {
        if (clipboard.length === 0) return;
        handled();
        const minStart = Math.min(...clipboard.map((c) => c.start));
        const ids = run("Paste", (d) =>
          clipboard.map((c) => {
            const copy = { ...JSON.parse(JSON.stringify(c)), id: newId("clip"), start: frame + (c.start - minStart) } as Clip;
            if (!d.tracks.some((t) => t.id === copy.trackId))
              copy.trackId = d.tracks.find((t) => (t.kind === "audio") === (copy.type === "audio"))?.id ?? copy.trackId;
            return insertClip(d, copy, "auto-track", { actor: USER });
          }),
        );
        if (ids) ui.select(ids);
        return;
      }
      if (mod && lower === "b") return act(() => splitAtPlayhead(e.shiftKey));

      if (mod) return;

      switch (key) {
        case " ":
          handled();
          togglePlay();
          return;
        case "k":
        case "K":
          return pause();
        case "l":
        case "L":
          return play();
        case "j":
        case "J":
          handled();
          return seek(Math.max(0, frame - fps));
        case "ArrowLeft":
          handled();
          return seek(Math.max(0, frame - (e.shiftKey ? fps : 1)));
        case "ArrowRight":
          handled();
          return seek(Math.min(duration - 1, frame + (e.shiftKey ? fps : 1)));
        case "ArrowUp": {
          handled();
          const prev = getEditPoints(project)
            .filter((p) => p < frame)
            .pop();
          return seek(prev ?? 0);
        }
        case "ArrowDown": {
          handled();
          const next = getEditPoints(project).find((p) => p > frame);
          return seek(next ?? duration - 1);
        }
        case "Home":
          return act(() => seek(0));
        case "End":
          return act(() => seek(duration - 1));
        case "s":
        case "S":
          return act(() => splitAtPlayhead());
        case "q":
        case "Q":
          return act(() => trimToPlayhead("left", true));
        case "w":
        case "W":
          return act(() => trimToPlayhead("right", true));
        case "[":
          if (e.altKey) return act(() => trimToPlayhead("left", false));
          return;
        case "]":
          if (e.altKey) return act(() => trimToPlayhead("right", false));
          return;
        case "Delete":
        case "Backspace":
          handled();
          return deleteSelection(e.shiftKey ? !ui.rippleDelete : undefined);
        case ",":
        case "<":
          return act(() => nudgeSelection(e.shiftKey ? -10 : -1));
        case ".":
        case ">":
          return act(() => nudgeSelection(e.shiftKey ? 10 : 1));
        case "n":
        case "N":
          return ui.toggleSnapping();
        case "m":
        case "M": {
          handled();
          const label = e.altKey ? (window.prompt("Marker note") ?? "") : `Marker ${getProject().markers.length + 1}`;
          run("Add marker", (d) => addMarker(d, { frame, label, kind: "note" }));
          return;
        }
        case "i":
        case "I":
          return usePlaybackStore.getState().setInOut(frame, usePlaybackStore.getState().outFrame);
        case "o":
        case "O":
          return usePlaybackStore.getState().setInOut(usePlaybackStore.getState().inFrame, frame);
        case "t":
        case "T":
          return act(() => addText());
        case "=":
        case "+":
          return ui.setPxPerSecond(ui.pxPerSecond * 1.35);
        case "-":
        case "_":
          return ui.setPxPerSecond(ui.pxPerSecond / 1.35);
        case "Z":
          if (e.shiftKey) {
            const el = document.querySelector<HTMLElement>("[data-track-lane]")?.parentElement?.parentElement;
            const width = el?.clientWidth ?? 1000;
            ui.setPxPerSecond((width - 220) / Math.max(1, duration / fps));
          }
          return;
        case "'":
          return ui.toggleSafeZones();
        case "f":
        case "F":
          return getPlayer()?.requestFullscreen();
        case "?":
          return handlers.openShortcuts();
        case "Escape":
          if (useAgentStore.getState().status !== "idle") return handlers.stopAgent();
          return ui.clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
};

export const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Playback",
    items: [
      ["Space", "Play / pause"],
      ["J / K / L", "Back 1s / pause / play"],
      ["← →", "Previous / next frame"],
      ["Shift ← →", "Back / forward 1 second"],
      ["↑ ↓", "Previous / next edit point"],
      ["Home / End", "Start / end"],
      ["I / O", "Mark in / out"],
    ],
  },
  {
    title: "Editing",
    items: [
      ["S or Ctrl B", "Split at playhead"],
      ["Ctrl Shift B", "Split all tracks"],
      ["Q / W", "Ripple-trim left / right of playhead"],
      ["Alt [ / Alt ]", "Trim to playhead (keep gap)"],
      ["Del", "Delete (Shift: toggle ripple)"],
      [", / .", "Nudge 1 frame (Shift: 10)"],
      ["Ctrl D", "Duplicate"],
      ["Ctrl C / X / V", "Copy / cut / paste"],
      ["T", "Add text"],
      ["M", "Add marker (Alt: with note)"],
      ["Ctrl Z / Ctrl Shift Z", "Undo / redo"],
    ],
  },
  {
    title: "View",
    items: [
      ["= / -", "Zoom timeline"],
      ["Shift Z", "Fit timeline"],
      ["N", "Toggle snapping"],
      ["'", "Safe zones"],
      ["F", "Fullscreen preview"],
    ],
  },
  {
    title: "AI",
    items: [
      ["Ctrl K", "Ask AI about the selection"],
      ["Ctrl L", "Focus the agent chat"],
      ["Esc", "Stop the agent"],
      ["Ctrl /", "Command palette"],
      ["?", "This cheat sheet"],
    ],
  },
];
