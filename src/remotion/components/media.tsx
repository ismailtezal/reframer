import { Video } from "@remotion/media";
import type React from "react";
import { Img } from "remotion";
import { useRenderContext } from "../context";

/**
 * Resolves an `asset` prop (an asset id from the project, or a plain URL) to a
 * loadable URL. Returns null when empty or missing.
 */
export const useAssetSrc = (value: unknown): { src: string; kind: "image" | "video" } | null => {
  const { project, resolveSrc } = useRenderContext();
  if (typeof value !== "string" || value.trim() === "") return null;
  const asset = project.assets[value];
  if (asset) return { src: resolveSrc(asset.src), kind: asset.type === "video" ? "video" : "image" };
  if (/^(https?:|data:|blob:|\/)/.test(value)) {
    return { src: resolveSrc(value), kind: /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value) ? "video" : "image" };
  }
  return null;
};

/**
 * Renders an image or video asset filling its parent. Shows a subtle
 * placeholder (with `placeholder` text) when no asset is set, so templates
 * look intentional before the user drops in media.
 */
export const AssetMedia: React.FC<{
  value: unknown;
  fit?: "cover" | "contain";
  placeholder?: string;
  muted?: boolean;
  style?: React.CSSProperties;
}> = ({ value, fit = "cover", placeholder, muted = true, style }) => {
  const media = useAssetSrc(value);
  const fill: React.CSSProperties = { width: "100%", height: "100%", display: "block", ...style };
  if (!media) {
    return (
      <div
        style={{
          ...fill,
          background: "linear-gradient(135deg, #1f1f2e 0%, #2a2a3d 50%, #1a1a26 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.35)",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "max(14px, 4cqmin)",
          containerType: "size",
        }}
      >
        {placeholder ?? ""}
      </div>
    );
  }
  if (media.kind === "video") {
    return <Video src={media.src} muted={muted} objectFit={fit} style={fill} />;
  }
  return <Img src={media.src} style={{ ...fill, objectFit: fit }} />;
};
