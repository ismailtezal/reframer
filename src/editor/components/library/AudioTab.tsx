"use client";

import { AudioWaveformIcon, MicIcon, MusicIcon, PauseIcon, PlayIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SFX_LIBRARY, type SfxEntry } from "@/core/sfx";
import { cn } from "@/lib/utils";
import { addAssetToTimeline } from "../../actions";
import { addSfx, addVoiceover, markBeats } from "../../library-actions";
import { importFiles } from "../../media/import";
import { DND_SFX } from "../timeline/Timeline";
import { SectionTitle } from "./Library";

const CATEGORY_LABEL: Record<SfxEntry["category"], string> = {
  transition: "Transitions",
  impact: "Impacts",
  riser: "Risers",
  ui: "UI & pops",
  foley: "Foley",
  cartoon: "Cartoon",
};
const ORDER: SfxEntry["category"][] = ["transition", "impact", "riser", "ui", "foley", "cartoon"];

/** One shared preview player so only one sound plays at a time. */
const usePreview = () => {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = (sfx: SfxEntry) => {
    if (playing === sfx.id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(sfx.src);
    a.volume = 0.8;
    a.onended = () => setPlaying((p) => (p === sfx.id ? null : p));
    audio.current = a;
    void a.play();
    setPlaying(sfx.id);
  };
  return { playing, toggle };
};

const SfxRow: React.FC<{ sfx: SfxEntry; playing: boolean; onPreview: () => void }> = ({ sfx, playing, onPreview }) => (
  <div
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData(DND_SFX, sfx.id);
      e.dataTransfer.effectAllowed = "copy";
    }}
    className="group flex h-8 items-center gap-1.5 rounded-md pr-1 pl-0.5 transition-colors duration-150 hover:bg-foreground/[0.04]"
    title={sfx.description}
  >
    <Button variant="ghost" size="icon-xs" onClick={onPreview} aria-label={playing ? `Stop ${sfx.name}` : `Play ${sfx.name}`}>
      {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
    </Button>
    <span className={cn("min-w-0 flex-1 truncate text-xs", playing ? "text-foreground" : "text-foreground/85")}>{sfx.name}</span>
    <span className="text-[11px] text-muted-foreground tabular">{sfx.durationSec.toFixed(1)}s</span>
    <Button
      variant="ghost"
      size="icon-xs"
      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      onClick={() => addSfx(sfx.id)}
      aria-label={`Add ${sfx.name} at the playhead`}
    >
      <PlusIcon />
    </Button>
  </div>
);

const VoiceoverBox = () => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        rows={3}
        placeholder="Type a script to voice…"
        className="block w-full resize-none rounded-md border border-input bg-background px-2.5 py-2 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Uses your ElevenLabs or OpenAI key</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await addVoiceover(text.trim());
            setBusy(false);
          }}
          className="gap-1.5"
        >
          <MicIcon /> Generate
        </Button>
      </div>
    </div>
  );
};

export const AudioTab = () => {
  const [query, setQuery] = useState("");
  const { playing, toggle } = usePreview();
  const musicInput = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const list = q ? SFX_LIBRARY.filter((s) => `${s.name} ${s.tags.join(" ")} ${s.description}`.toLowerCase().includes(q)) : SFX_LIBRARY;

  return (
    <div className="space-y-1">
      <SectionTitle>Music</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => musicInput.current?.click()}>
          <MusicIcon /> Add music
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => void markBeats()}>
          <AudioWaveformIcon /> Mark beats
        </Button>
      </div>
      <input
        ref={musicInput}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          for (const asset of await importFiles(files)) addAssetToTimeline(asset);
        }}
      />
      <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
        Bring your own track. Marked beats show on the ruler, and clips snap to them.
      </p>

      <SectionTitle>Voiceover</SectionTitle>
      <VoiceoverBox />

      <SectionTitle>Sound effects</SectionTitle>
      <div className="relative pb-1">
        <SearchIcon className="pointer-events-none absolute top-[14px] left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search sounds"
          className="h-7 pl-8 text-xs"
        />
      </div>
      {ORDER.map((cat) => {
        const items = list.filter((s) => s.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="pb-1">
            <div className="px-1 pt-2 pb-0.5 text-[11px] text-muted-foreground">{CATEGORY_LABEL[cat]}</div>
            {items.map((s) => (
              <SfxRow key={s.id} sfx={s} playing={playing === s.id} onPreview={() => toggle(s)} />
            ))}
          </div>
        );
      })}
      <p className="pt-2 text-[11px] leading-snug text-muted-foreground">All sounds are generated by Reframer and free to use (CC0).</p>
    </div>
  );
};
