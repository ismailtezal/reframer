import type React from "react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Artifact, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { LAYOUT_ARTIFACT } from "../../core/checks/layout";
import { fontsSettled } from "../fonts";
import { scanLayout } from "./layout-scan";

// Timers, not animation frames: a headless page may get no frames.
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Measures the frame's text layout once it has settled (fonts in, effects run) and hands the scan to
 * the renderer's caller as a render artifact, holding the frame until it is registered.
 */
export const LayoutProbe: React.FC<{ rootRef: RefObject<HTMLDivElement | null> }> = ({ rootRef }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [result, setResult] = useState<{ frame: number; json: string } | null>(null);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const handle = delayRender("Measuring the text layout", { timeoutInMilliseconds: 20000 });
    pending.current = handle;
    let cancelled = false;
    (async () => {
      await fontsSettled();
      await document.fonts.ready;
      await wait(0);
      await wait(0);
      await wait(30);
      const root = rootRef.current;
      return JSON.stringify(root ? scanLayout(root, width, height) : { found: [], blocks: [] });
    })()
      .catch((err) => JSON.stringify({ error: String(err) }))
      .then((json) => {
        if (!cancelled) setResult({ frame, json });
      });
    return () => {
      cancelled = true;
      if (pending.current === handle) {
        pending.current = null;
        continueRender(handle);
      }
    };
  }, [frame, width, height, rootRef, delayRender, continueRender]);
  // The artifact registers in a layout effect, so by now it is collected with the frame.
  useEffect(() => {
    if (result?.frame !== frame || pending.current === null) return;
    const handle = pending.current;
    pending.current = null;
    continueRender(handle);
  }, [result, frame, continueRender]);
  return result?.frame === frame ? <Artifact filename={`${LAYOUT_ARTIFACT}-${frame}.json`} content={result.json} /> : null;
};
