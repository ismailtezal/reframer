"use client";

import { create } from "zustand";

/**
 * Lets any part of the editor hand a prompt to the agent chat ("Clone this
 * style", "Restyle with the agent"). The chat picks it up, and the side panel
 * switches to the Agent tab.
 */
type PromptRequest = { text: string; send: boolean; nonce: number };

export const useAgentPrompt = create<{ request: PromptRequest | null; clear: () => void }>()((set) => ({
  request: null,
  clear: () => set({ request: null }),
}));

/** `send: false` only fills the composer so the user can edit before sending. */
export const askAgent = (text: string, send = true) => useAgentPrompt.setState({ request: { text, send, nonce: Date.now() } });
