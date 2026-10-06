"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LibraryTab = "media" | "text" | "elements" | "styles" | "audio" | "captions" | "transitions" | "templates";
export type RightTab = "inspector" | "agent";

type UIStore = {
  selectedClipIds: string[];
  selectedTrackId: string | null;
  /** Keyframe property focused in the inspector (diamond highlight in the timeline). */
  focusedProperty: string | null;
  /** Timeline zoom in pixels per second. */
  pxPerSecond: number;
  snapping: boolean;
  rippleDelete: boolean;
  libraryTab: LibraryTab;
  libraryOpen: boolean;
  agentOpen: boolean;
  /** Follow the agent: seek & select where it edits. */
  followAgent: boolean;
  /** Show safe-zone guides over the preview. */
  showSafeZones: boolean;
  timelineHeight: number;
  previewZoom: "fit" | number;

  select: (ids: string[], opts?: { additive?: boolean; toggle?: boolean }) => void;
  clearSelection: () => void;
  selectTrack: (id: string | null) => void;
  setFocusedProperty: (prop: string | null) => void;
  setPxPerSecond: (v: number) => void;
  toggleSnapping: () => void;
  toggleRipple: () => void;
  setLibraryTab: (tab: LibraryTab) => void;
  setLibraryOpen: (open: boolean) => void;
  setAgentOpen: (open: boolean) => void;
  setFollowAgent: (v: boolean) => void;
  toggleSafeZones: () => void;
  setPreviewZoom: (z: "fit" | number) => void;
};

export const MIN_PX_PER_SECOND = 8;
export const MAX_PX_PER_SECOND = 1200;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      selectedClipIds: [],
      selectedTrackId: null,
      focusedProperty: null,
      pxPerSecond: 90,
      snapping: true,
      rippleDelete: false,
      libraryTab: "media",
      libraryOpen: true,
      agentOpen: true,
      followAgent: true,
      showSafeZones: false,
      timelineHeight: 300,
      previewZoom: "fit",

      select: (ids, opts = {}) => {
        const current = get().selectedClipIds;
        if (opts.toggle) {
          const set_ = new Set(current);
          for (const id of ids) {
            if (set_.has(id)) set_.delete(id);
            else set_.add(id);
          }
          set({ selectedClipIds: [...set_] });
        } else if (opts.additive) {
          set({ selectedClipIds: [...new Set([...current, ...ids])] });
        } else {
          set({ selectedClipIds: ids });
        }
      },
      clearSelection: () => set({ selectedClipIds: [], focusedProperty: null }),
      selectTrack: (id) => set({ selectedTrackId: id }),
      setFocusedProperty: (prop) => set({ focusedProperty: prop }),
      setPxPerSecond: (v) => set({ pxPerSecond: Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, v)) }),
      toggleSnapping: () => set({ snapping: !get().snapping }),
      toggleRipple: () => set({ rippleDelete: !get().rippleDelete }),
      setLibraryTab: (tab) => set({ libraryTab: tab, libraryOpen: true }),
      setLibraryOpen: (open) => set({ libraryOpen: open }),
      setAgentOpen: (open) => set({ agentOpen: open }),
      setFollowAgent: (v) => set({ followAgent: v }),
      toggleSafeZones: () => set({ showSafeZones: !get().showSafeZones }),
      setPreviewZoom: (z) => set({ previewZoom: z }),
    }),
    {
      name: "reframer-ui",
      partialize: (s) => ({
        pxPerSecond: s.pxPerSecond,
        snapping: s.snapping,
        rippleDelete: s.rippleDelete,
        libraryTab: s.libraryTab,
        libraryOpen: s.libraryOpen,
        agentOpen: s.agentOpen,
        followAgent: s.followAgent,
        showSafeZones: s.showSafeZones,
        timelineHeight: s.timelineHeight,
      }),
    },
  ),
);
