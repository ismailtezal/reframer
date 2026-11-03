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
  /** Bumped on every open, so the chat view restarts from the freshly loaded messages. */
  version: number;
  loading: boolean;
  init: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
  open: (threadId: string) => Promise<void>;
  startNew: () => void;
  remove: (threadId: string) => Promise<void>;
};

const fetchMessages = async (projectId: string, threadId: string): Promise<UIMessage[]> => {
  const res = await fetch(`/api/threads?projectId=${encodeURIComponent(projectId)}&threadId=${encodeURIComponent(threadId)}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Couldn't load the chat (${res.status})`);
  const data = (await res.json()) as { thread?: { messages: UIMessage[] } };
  return data.thread?.messages ?? [];
};

/** Agent chat threads for the open project (stored under .reframer/projects/<id>/threads). */
export const useThreadStore = create<ThreadStore>()((set, get) => ({
  projectId: null,
  threads: [],
  currentId: null,
  initialMessages: [],
  version: 0,
  loading: false,

  init: async (projectId) => {
    // Coming back to the project: reopen the chat you were in, from disk. What's in memory is
    // from when it was first opened, so it misses everything said since.
    const resume = get().projectId === projectId ? get().currentId : null;
    set({ projectId, loading: true, ...(resume ? {} : { threads: [], currentId: null, initialMessages: [] }) });
    await get().refresh();
    const target = resume ?? get().threads[0]?.id;
    if (target) await get().open(target);
    else set({ currentId: newId("thread"), initialMessages: [], version: get().version + 1 });
    set({ loading: false });
  },

  refresh: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const res = await fetch(`/api/threads?projectId=${encodeURIComponent(projectId)}`);
      const data = (await res.json()) as { threads: ThreadMeta[] };
      if (get().projectId === projectId) set({ threads: data.threads ?? [] });
    } catch {
      // offline server; keep what we have
    }
  },

  open: async (threadId) => {
    const projectId = get().projectId;
    if (!projectId) return;
    let messages: UIMessage[] = [];
    try {
      messages = await fetchMessages(projectId, threadId);
    } catch {
      // keep going with an empty view rather than a stuck one
    }
    if (get().projectId !== projectId) return;
    set({ currentId: threadId, initialMessages: messages, version: get().version + 1 });
  },

  startNew: () => set({ currentId: newId("thread"), initialMessages: [], version: get().version + 1 }),

  remove: async (threadId) => {
    const projectId = get().projectId;
    if (!projectId) return;
    await fetch(`/api/threads?projectId=${encodeURIComponent(projectId)}&threadId=${encodeURIComponent(threadId)}`, { method: "DELETE" });
    if (get().currentId === threadId) get().startNew();
    await get().refresh();
  },
}));
