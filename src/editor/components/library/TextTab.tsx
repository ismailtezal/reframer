"use client";

import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { createTextClip } from "@/core/defaults";
import { insertClip, USER } from "@/core/ops";
import { secondsToFrames } from "@/core/time";
import { loadFont } from "@/remotion/fonts";
import { addShape, run } from "../../actions";
import { TEXT_PRESETS, type TextPreset } from "../../presets/text-presets";
import { usePlaybackStore } from "../../store/playback-store";
import { useUIStore } from "../../store/ui-store";
import { SectionTitle } from "./Library";

export const addTextPreset = (preset: TextPreset, text?: string) => {
  const id = run(`Add ${preset.name}`, (d) => {
    const unit = Math.min(d.settings.width, d.settings.height) / 1080;
    const trackId = d.tracks.find((t) => t.kind === "visual" && !t.locked)?.id;
    if (!trackId) throw new Error("No visual track available");
    const clip = createTextClip(d.settings, {
      trackId,
      start: usePlaybackStore.getState().frame,
      duration: secondsToFrames(3, d.settings.fps),
      text: text ?? preset.sample,
      style: {
        ...preset.style,
        fontSize: Math.round((preset.style.fontSize ?? 80) * unit),
        stroke: preset.style.stroke
          ? { ...preset.style.stroke, width: Math.max(1, Math.round(preset.style.stroke.width * unit)) }
          : undefined,
      },
    });
    if (preset.textAnimation) clip.textAnimation = preset.textAnimation;
    if (preset.animations) clip.animations = preset.animations;
    clip.name = preset.name;
    return insertClip(d, clip, "auto-track", { actor: USER });
  });
  if (id) useUIStore.getState().select([id]);
};

const PresetCard: React.FC<{ preset: TextPreset }> = ({ preset }) => {
  const s = preset.style;
  return (
    <button
      type="button"
      onClick={() => addTextPreset(preset)}
      className="group relative flex h-20 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-neutral-950 px-2 text-center transition-colors hover:border-ring"
      title={`Add “${preset.name}”`}
    >
      <span
        className="max-w-full truncate leading-none"
        style={{
          fontFamily: `"${s.fontFamily}", Inter, sans-serif`,
          fontWeight: s.fontWeight,
          fontStyle: s.italic ? "italic" : undefined,
          fontSize: Math.min(26, (s.fontSize ?? 80) * 0.22),
          letterSpacing: s.letterSpacing !== undefined ? `${s.letterSpacing}em` : undefined,
          textTransform: s.textTransform,
          color: s.gradient ? "transparent" : (s.color ?? "#fff"),
          backgroundImage:
            s.gradient?.type === "linear"
              ? `linear-gradient(${s.gradient.angle}deg, ${s.gradient.stops.map((st) => st.color).join(", ")})`
              : undefined,
          WebkitBackgroundClip: s.gradient ? "text" : undefined,
          WebkitTextStroke: s.stroke ? `1px ${s.stroke.color}` : undefined,
          textShadow: s.shadow ? `0 0 ${Math.min(10, s.shadow.blur / 3)}px ${s.shadow.color}` : undefined,
          background: s.background ? s.background.color : undefined,
          padding: s.background ? "2px 8px" : undefined,
          borderRadius: s.background ? 4 : undefined,
          ...(preset.id === "highlight" ? { color: "#111", background: "linear-gradient(transparent 55%, #FDE047 55%)" } : {}),
        }}
      >
        {preset.sample}
      </span>
      <span className="absolute bottom-1 left-1.5 text-[10px] text-white/45">{preset.name}</span>
      <PlusIcon className="absolute top-1.5 right-1.5 size-3.5 text-white/0 transition-colors group-hover:text-white/70" />
    </button>
  );
};

export const TextTab = () => {
  // Warm up preset fonts so cards render in their real typefaces.
  useEffect(() => {
    for (const p of TEXT_PRESETS) void loadFont({ family: p.style.fontFamily, weight: p.style.fontWeight ?? 400, italic: p.style.italic });
  }, []);
  return (
    <div>
      <SectionTitle>Text styles</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {TEXT_PRESETS.map((p) => (
          <PresetCard key={p.id} preset={p} />
        ))}
      </div>
      <SectionTitle>Shapes</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {(["rect", "ellipse", "triangle", "star", "polygon", "line", "arrow"] as const).map((shape) => (
          <button
            key={shape}
            type="button"
            onClick={() => addShape(shape)}
            className="flex aspect-square items-center justify-center rounded-lg border border-border bg-panel-2 text-[10px] capitalize text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <ShapeGlyph shape={shape} />
          </button>
        ))}
      </div>
    </div>
  );
};

const ShapeGlyph: React.FC<{ shape: string }> = ({ shape }) => {
  const common = { fill: "currentColor", className: "size-6" };
  switch (shape) {
    case "rect":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="3" />
        </svg>
      );
    case "ellipse":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M12 3l9 17H3z" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z" />
        </svg>
      );
    case "polygon":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
        </svg>
      );
    case "line":
      return (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path d="M3 12h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path
            d="M3 12h16M14 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
