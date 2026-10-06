"use client";

import { useEffect } from "react";
import { useAgentStore } from "../../store/agent-store";
import { usePlaybackStore } from "../../store/playback-store";
import { HEADER_WIDTH, useTimeline, Z } from "./geometry";

/**
 * Playhead lines through the tracks. The handles live in the ruler. The
 * user's playhead never eases; the agent's cursor glides so you can follow it.
 */
export const Playhead = () => {
  const { ppf, scrollRef } = useTimeline();
  const frame = usePlaybackStore((s) => s.frame);
  const playing = usePlaybackStore((s) => s.playing);
  const agentFrame = useAgentStore((s) => s.frame);
  const agentStatus = useAgentStore((s) => s.status);
  const x = HEADER_WIDTH + frame * ppf;

  // Page the timeline while playing so the playhead stays visible.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const visibleStart = el.scrollLeft + HEADER_WIDTH;
    const visibleEnd = el.scrollLeft + el.clientWidth;
    if (x > visibleEnd - 40 || x < visibleStart) {
      el.scrollLeft = Math.max(0, x - HEADER_WIDTH - el.clientWidth * 0.15);
    }
  }, [x, playing, scrollRef]);

  const agentActive = agentStatus !== "idle" && agentFrame !== null;

  return (
    <>
      {agentActive ? (
        <div
          className="pointer-events-none absolute top-0 bottom-0 left-0 w-px bg-ai/70 transition-transform duration-250 ease-out-strong motion-reduce:transition-none"
          style={{
            transform: `translateX(${HEADER_WIDTH + (agentFrame ?? 0) * ppf}px)`,
            zIndex: Z.agentPlayhead,
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-playhead" style={{ left: x, zIndex: Z.playhead }} />
    </>
  );
};
