import type React from "react";
import { useRenderContext } from "../context";

/** Placeholder shown in the editor when an asset is missing. Renders nothing on export. */
export const MissingMedia: React.FC<{ label: string }> = ({ label }) => {
  const { editor } = useRenderContext();
  if (!editor) return null;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 12px, rgba(255,255,255,0.02) 12px 24px)",
        color: "rgba(255,255,255,0.6)",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 24,
        border: "2px dashed rgba(255,255,255,0.25)",
      }}
    >
      {label}
    </div>
  );
};
