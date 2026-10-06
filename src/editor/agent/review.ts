"use client";

import { renderStillOnWeb } from "@remotion/web-renderer";
import { getProjectDuration } from "@/core/project-utils";
import { ProjectComposition } from "@/remotion/ProjectComposition";
import { getProject } from "../store/project-store";

/**
 * Renders frames in the browser so agents can look at their own work
 * (contact-sheet review). Frames are small JPEG data URLs (~640px wide).
 */
export const captureFrames = async (timesSec: number[] | undefined, count: number) => {
  const project = getProject();
  const { width, height, fps } = project.settings;
  const duration = getProjectDuration(project);
  const frames = timesSec?.length
    ? timesSec.map((t) => Math.min(duration - 1, Math.max(0, Math.round(t * fps))))
    : Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) / count) * (duration - 1)));
  const scale = Math.min(1, 640 / width);
  const out: { timeSec: number; dataUrl: string }[] = [];
  for (const frame of frames) {
    try {
      const result = await renderStillOnWeb({
        composition: {
          id: "reframer-review",
          component: ProjectComposition,
          width,
          height,
          fps,
          durationInFrames: duration,
          defaultProps: { project, editor: false },
        },
        inputProps: { project, editor: false },
        frame,
        scale,
        delayRenderTimeoutInMilliseconds: 20000,
      });
      const blob = await result.blob({ format: "jpeg", quality: 0.72 });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      out.push({ timeSec: Math.round((frame / fps) * 100) / 100, dataUrl });
    } catch (err) {
      console.warn("[reframer] frame capture failed", err);
    }
  }
  return out;
};
