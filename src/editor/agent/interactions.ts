"use client";

import { create } from "zustand";

/** Questions agents ask the user (ask_user), answered in the chat panel. */
export type PendingQuestion = {
  id: string;
  agent: string;
  question: string;
  options: string[];
  resolve: (answer: string) => void;
};

type Store = {
  questions: PendingQuestion[];
  ask: (q: Omit<PendingQuestion, "resolve">) => Promise<string>;
  answer: (id: string, answer: string) => void;
};

export const useInteractions = create<Store>()((set, get) => ({
  questions: [],
  ask: (q) =>
    new Promise<string>((resolve) => {
      set({ questions: [...get().questions, { ...q, resolve }] });
    }),
  answer: (id, answer) => {
    const q = get().questions.find((x) => x.id === id);
    if (!q) return;
    q.resolve(answer);
    set({ questions: get().questions.filter((x) => x.id !== id) });
  },
}));
