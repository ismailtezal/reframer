"use client";

import { SearchIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STYLE_PRESETS, type StyleDNA, searchStyles } from "@/core/styles";
import { cn } from "@/lib/utils";
import { loadFont } from "@/remotion/fonts";
import { askAgent } from "../../agent/prompt-bus";
import { useInView } from "../../hooks/useInView";
import { applyStyleLook } from "../../library-actions";
import { SectionTitle } from "./Library";

const GROUPS: { id: StyleDNA["category"]; label: string }[] = [
  { id: "creator", label: "Creators" },
  { id: "brand", label: "Brands" },
  { id: "genre", label: "Genres" },
];

const CUT_LABEL: Record<StyleDNA["pacing"]["cutStyle"], string> = {
  hard: "hard cuts",
  jump: "jump cuts",
  mixed: "mixed cuts",
  continuous: "long takes",
  beat: "cuts on the beat",
};

const restylePrompt = (dna: StyleDNA) =>
  `Restyle this video in the ${dna.name} style (style id "${dna.id}"). Apply its look, then adapt the pacing, captions, transitions and sound to match. Keep my content.`;

/** A small poster in the style's own colours and title type. */
const Poster: React.FC<{ dna: StyleDNA; visible: boolean }> = ({ dna, visible }) => {
  const title = dna.typography.title;
  useEffect(() => {
    if (visible) void loadFont({ family: title.fontFamily, weight: title.fontWeight, italic: !!title.italic }).catch(() => undefined);
  }, [visible, title.fontFamily, title.fontWeight, title.italic]);
  const gradient = title.gradient?.length ? `linear-gradient(90deg, ${title.gradient.join(", ")})` : undefined;
  return (
    <div className="relative h-16 overflow-hidden" style={{ background: dna.palette.background }}>
      <div className="absolute top-2 right-2 flex gap-1">
        {dna.palette.accents.slice(0, 3).map((c) => (
          <span key={c} className="size-2 rounded-full ring-1 ring-black/20" style={{ background: c }} />
        ))}
      </div>
      <span
        className="absolute bottom-2 left-2.5 max-w-[calc(100%-1.25rem)] truncate text-[15px] leading-tight"
        style={{
          color: gradient ? "transparent" : title.color || dna.palette.foreground,
          backgroundImage: gradient,
          backgroundClip: gradient ? "text" : undefined,
          WebkitBackgroundClip: gradient ? "text" : undefined,
          fontFamily: `"${title.fontFamily}", ui-sans-serif, system-ui`,
          fontWeight: title.fontWeight,
          textTransform: title.textTransform,
          letterSpacing: `${title.letterSpacing}em`,
          fontStyle: title.italic ? "italic" : undefined,
          WebkitTextStroke: title.stroke ? `${Math.min(3, Math.max(1, title.stroke.width / 3))}px ${title.stroke.color}` : undefined,
          paintOrder: "stroke fill",
        }}
      >
        {dna.name}
      </span>
    </div>
  );
};

const StyleCard: React.FC<{ dna: StyleDNA; open: boolean; onToggle: () => void }> = ({ dna, open, onToggle }) => {
  const [ref, visible] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-md border bg-panel-2 transition-colors duration-150",
        open ? "border-foreground/20" : "border-border hover:border-foreground/15",
      )}
    >
      <button type="button" onClick={onToggle} className="block w-full text-left" aria-expanded={open}>
        <Poster dna={dna} visible={visible} />
        <div className="space-y-0.5 px-2.5 py-2">
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{dna.description}</p>
        </div>
      </button>
      {open ? (
        <div className="space-y-2.5 border-t border-border px-2.5 py-2.5">
          <ul className="space-y-1">
            {dna.signature.slice(0, 3).map((s) => (
              <li key={s} className="flex gap-1.5 text-[11px] leading-snug text-foreground/85">
                <span className="mt-[5px] size-1 shrink-0 rounded-full bg-muted-foreground" />
                {s}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground tabular">
            {dna.format.aspect} · ~{dna.pacing.aslSec}s shots · {CUT_LABEL[dna.pacing.cutStyle]}
            {dna.captions.mode !== "none" ? ` · ${dna.captions.mode.replace(/_/g, " ")} captions` : ""}
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => applyStyleLook(dna)}>
              Apply look
            </Button>
            <Button size="sm" className="flex-1 gap-1" onClick={() => askAgent(restylePrompt(dna))}>
              <SparklesIcon className="size-3.5" /> Full restyle
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const CloneBox = () => {
  const [value, setValue] = useState("");
  const submit = () => {
    const name = value.trim();
    if (!name) return;
    askAgent(
      `Clone the editing style of "${name}" for this video. If a built-in style matches, start from it; otherwise research the style and build a custom one. Apply the look, then match the pacing, captions, transitions and sound.`,
    );
    setValue("");
  };
  return (
    <form
      className="space-y-2 rounded-md border border-border bg-foreground/[0.02] p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <WandSparklesIcon className="size-3.5 text-muted-foreground" /> Clone any style
      </div>
      <div className="flex gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="A creator, film, brand or genre"
          className="h-7 text-xs"
          aria-label="Style to clone"
        />
        <Button type="submit" size="sm" disabled={!value.trim()}>
          Clone
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">The agent studies the style and rebuilds it on your timeline.</p>
    </form>
  );
};

export const StylesTab = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const results = query.trim() ? searchStyles(query) : STYLE_PRESETS;
  return (
    <div className="space-y-3">
      <CloneBox />
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search styles"
          className="h-8 pl-8 text-sm"
        />
      </div>
      {GROUPS.map((g) => {
        const items = results.filter((s) => s.category === g.id);
        if (items.length === 0) return null;
        return (
          <div key={g.id}>
            <SectionTitle>{g.label}</SectionTitle>
            <div className="grid grid-cols-1 gap-2 @[340px]/library:grid-cols-2">
              {items.map((dna) => (
                <StyleCard key={dna.id} dna={dna} open={open === dna.id} onToggle={() => setOpen(open === dna.id ? null : dna.id)} />
              ))}
            </div>
          </div>
        );
      })}
      {results.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No built-in style matches. Use “Clone any style” above.</p>
      ) : null}
    </div>
  );
};
