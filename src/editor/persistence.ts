"use client";

import { useEffect } from "react";
import { useProjectStore } from "./store/project-store";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let queued = false;

const saveNow = async (): Promise<void> => {
  const { project, setSaveState } = useProjectStore.getState();
  if (!project) return;
  if (inflight) {
    queued = true;
    return inflight;
  }
  setSaveState("saving");
  inflight = (async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      // Only mark saved if nothing changed while we were saving.
      const latest = useProjectStore.getState().project;
      setSaveState(latest === project ? "saved" : "dirty", Date.now());
    } catch (err) {
      console.error(err);
      setSaveState("error");
    } finally {
      inflight = null;
      if (queued) {
        queued = false;
        void saveNow();
      }
    }
  })();
  return inflight;
};

/** Saves immediately (e.g. before exporting or navigating away). */
export const flushSave = async () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (useProjectStore.getState().saveState === "dirty") await saveNow();
  if (inflight) await inflight;
};

/** Debounced autosave + unsaved-changes guard. */
export const useAutosave = () => {
  useEffect(() => {
    const unsub = useProjectStore.subscribe(
      (s) => s.revision,
      () => {
        if (useProjectStore.getState().saveState !== "dirty") return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => void saveNow(), 700);
      },
    );
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useProjectStore.getState().saveState;
      if (s === "dirty" || s === "saving") {
        void saveNow();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsub();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
};
