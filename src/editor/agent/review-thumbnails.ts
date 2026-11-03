export type ReviewThumbnail = { timeSec: number; dataUrl: string };

/** CLI tool results can retain only frame timestamps/labels after image payloads are stripped. */
export const reviewThumbnails = (output: unknown): ReviewThumbnail[] => {
  if (!output || typeof output !== "object" || !("frames" in output) || !Array.isArray(output.frames)) return [];
  return output.frames.filter(
    (frame): frame is ReviewThumbnail =>
      frame !== null &&
      typeof frame === "object" &&
      typeof frame.timeSec === "number" &&
      Number.isFinite(frame.timeSec) &&
      typeof frame.dataUrl === "string" &&
      frame.dataUrl.startsWith("data:image/"),
  );
};
