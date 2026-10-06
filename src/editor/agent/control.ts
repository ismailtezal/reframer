"use client";

import { useAgentStore } from "../store/agent-store";

/** Registry of stop handlers (the built-in chat registers its `stop`). */
const stoppers = new Set<() => void>();

export const registerStopper = (fn: () => void) => {
  stoppers.add(fn);
  return () => {
    stoppers.delete(fn);
  };
};

/** Esc: stops every running agent turn. Finished steps are kept. */
export const stopAgent = () => {
  for (const stop of stoppers) {
    try {
      stop();
    } catch (err) {
      console.error(err);
    }
  }
  useAgentStore.getState().setStatus("idle", null);
  useAgentStore.getState().setFrame(null);
};
