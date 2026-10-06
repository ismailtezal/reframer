"use client";

import type { UIMessage } from "ai";
import { create } from "zustand";
import { newId } from "@/core/ids";

export type ThreadMeta = { id: string; title: string; updatedAt: number; modelRef?: string };

type ThreadStore = {
  projectId: string | null;
  threads: ThreadMeta[];
  currentId: string | null;
  /** Messages to seed the chat with when a thread is opened. */
  initialMessages: UIMessage[];
  loading: boolean;
  init: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
  open: (threadId: string) => Promise<void>;
  startNew: () => void;
  remove: (threadId: string) => Promise<void>;
};

/** Agent chat threads for the open project (stored under .reframer/projects/<id>/threads). */
export const useThreadStore = create<ThreadStore>()((set, get) => ({
  projectId: null,
  threads: [],
  currentId: null,
  initialMessages: [],
  loading: false,

  init: async (projectId) => {
    if (get().projectId === projectId && get().currentId) return;
    set({ projectId, threads: [], currentId: null, initialMessages: [], loading: true });
    await get().refresh();
    const latest = get().threads[0];
    if (latest) await get().open(latest.id);
    else set({ currentId: newId("thread"), initialMessages: [] });
    set({ loading: false });
  },

  refresh: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const res = await fetch(`/api/threads?projectId=${encodeURIComponent(projectId)}`);
      const data = (await res.json()) as { threads: ThreadMeta[] };
      set({ threads: data.threads ?? [] });
    } catch {
      // offline server; keep what we have
    }
  },

  open: async (threadId) => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const res = await fetch(`/api/threads?projectId=${encodeURIComponent(projectId)}&threadId=${encodeURIComponent(threadId)}`);
      const data = (await res.json()) as { thread?: { messages: UIMessage[] } };
      set({ currentId: threadId, initialMessages: data.thread?.messages ?? [] });
    } catch {
      set({ currentId: threadId, initialMessages: [] });
    }
  },

  startNew: () => set({ currentId: newId("thread"), initialMessages: [] }),

  remove: async (threadId) => {
    const projectId = get().projectId;
    if (!projectId) return;
    await fetch(`/api/threads?projectId=${encodeURIComponent(projectId)}&threadId=${encodeURIComponent(threadId)}`, { method: "DELETE" });
    if (get().currentId === threadId) get().startNew();
    await get().refresh();
  },
}));
