"use client";

import { ScissorsIcon, SparklesIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CAPTION_PRESETS, type CaptionPreset } from "@/core/caption-presets";
import { cn } from "@/lib/utils";
import { loadFont } from "@/remotion/fonts";
import { askAgent } from "../../agent/prompt-bus";
import { useInView } from "../../hooks/useInView";
import { applyCaptionPreset } from "../../library-actions";
import { useProjectStore } from "../../store/project-store";
import { SectionTitle } from "./Library";

const SAMPLE = ["This", "is", "how", "it", "looks"];
const ACTIVE = 2;

/** A static sample of the caption look: one page of words with the active word highlighted. */
const Sample: React.FC<{ preset: CaptionPreset; visible: boolean }> = ({ preset, visible }) => {
  const s = preset.style;
  useEffect(() => {
    if (visible && s.fontFamily) void loadFont({ family: s.fontFamily, weight: s.fontWeight }).catch(() => undefined);
  }, [visible, s.fontFamily, s.fontWeight]);
  const words = SAMPLE.slice(0, Math.max(2, Math.min(4, s.maxWordsPerPage ?? 3)));
  const scale = 0.24;
  return (
    <div className="flex h-16 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#2a2f3a,#14161c)] px-2">
      <p
        className="text-center"
        style={{
          fontFamily: `"${s.fontFamily}", ui-sans-serif, system-ui`,
          fontWeight: s.fontWeight,
          fontSize: Math.min(17, Math.max(11, (s.fontSize ?? 64) * scale)),
          lineHeight: s.lineHeight ?? 1.1,
          letterSpacing: s.letterSpacing ? `${s.letterSpacing}em` : undefined,
          textTransform: s.textTransform,
          color: s.color,
          WebkitTextStroke: s.stroke?.width ? `${Math.max(0.5, s.stroke.width * scale * 0.5)}px ${s.stroke.color}` : undefined,
          paintOrder: "stroke fill",
          textShadow: s.shadow
            ? `0 ${Math.round((s.shadow.y ?? 0) * scale)}px ${Math.round((s.shadow.blur ?? 0) * scale)}px ${s.shadow.color}`
            : undefined,
        }}
      >
        {words.map((w, i) => (
          <span
            key={w}
            className="inline-block px-[0.12em]"
            style={
              i === ACTIVE
                ? {
                    color: s.activeColor ?? s.color,
                    background: s.activeBackground,
                    borderRadius: s.activeBackground ? 4 : undefined,
                  }
                : undefined
            }
          >
            {w}
          </span>
        ))}
      </p>
    </div>
  );
};

const PresetCard: React.FC<{ preset: CaptionPreset; current: boolean }> = ({ preset, current }) => {
  const [ref, visible] = useInView<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => void applyCaptionPreset(preset.id)}
      className={cn(
        "overflow-hidden rounded-md border text-left transition-colors duration-150",
        current ? "border-brand/70" : "border-border hover:border-foreground/15",
      )}
      title={preset.description}
    >
      <Sample preset={preset} visible={visible} />
      <div className="px-2 py-1.5">
        <div className="truncate text-[11px] font-medium">{preset.name}</div>
        <div className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{preset.description}</div>
      </div>
    </button>
  );
};

export const CaptionsTab = () => {
  const captions = useProjectStore((s) => Object.values(s.project?.clips ?? {}).find((c) => c.type === "captions"));
  const currentPreset = captions?.type === "captions" ? captions.style.preset : undefined;
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {captions
          ? "Pick a look to restyle your captions. Select one captions clip to change only that one."
          : "Pick a look and Reframer transcribes your main video's speech and adds word-timed captions. Transcription runs on this computer unless you choose a cloud engine in Settings."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CAPTION_PRESETS.map((p) => (
          <PresetCard key={p.id} preset={p} current={p.id === currentPreset} />
        ))}
      </div>
      <SectionTitle>Clean up speech</SectionTitle>
      <div className="grid grid-cols-1 gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="justify-start gap-2"
          onClick={() => askAgent("Remove the filler words (um, uh, like, you know) from my talking clip, keeping the cuts smooth.")}
        >
          <ScissorsIcon /> Remove filler words
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="justify-start gap-2"
          onClick={() => askAgent("Cut the long silences and dead air from my talking clip, keeping natural breathing room.")}
        >
          <ScissorsIcon /> Cut silences
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="justify-start gap-2"
          onClick={() =>
            askAgent("Find the strongest 30-60 second moment in my clip and turn it into a vertical short with bold captions.")
          }
        >
          <SparklesIcon /> Make a short from the best moment
        </Button>
      </div>
    </div>
  );
};
