"use client";

import { AudioWaveformIcon, LoaderCircleIcon, MicIcon, MusicIcon, PauseIcon, PlayIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SFX_LIBRARY, type SfxEntry } from "@/core/sfx";
import { cn } from "@/lib/utils";
import { addAssetToTimeline } from "../../actions";
import { addSfx, addSoundAsset, addVoiceover, markBeats } from "../../library-actions";
import { type AudioSearchResult, importMediaUrl, searchAudioLibrary } from "../../media/ai";
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
  const toggle = (id: string, src: string) => {
    if (playing === id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(src);
    a.volume = 0.8;
    a.onended = () => setPlaying((p) => (p === id ? null : p));
    audio.current = a;
    void a.play().catch(() => setPlaying((p) => (p === id ? null : p)));
    setPlaying(id);
  };
  return { playing, toggle };
};

const formatLength = (sec?: number) => {
  if (sec === undefined) return "";
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
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

/** Debounced search of the free music / recorded SFX libraries. */
const useLibrarySearch = (kind: "music" | "sfx", query: string) => {
  const [state, setState] = useState<{ results: AudioSearchResult[]; loading: boolean; error: string | null }>({
    results: [],
    loading: false,
    error: null,
  });
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ results: [], loading: false, error: null });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(() => {
      searchAudioLibrary({ kind, query: q, limit: kind === "music" ? 12 : 10 })
        .then(({ results }) => live && setState({ results, loading: false, error: null }))
        .catch(
          (err: unknown) => live && setState({ results: [], loading: false, error: err instanceof Error ? err.message : String(err) }),
        );
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [kind, query]);
  return state;
};

const LibraryRow: React.FC<{ item: AudioSearchResult; playing: boolean; onPreview: () => void }> = ({ item, playing, onPreview }) => {
  const [adding, setAdding] = useState(false);
  const add = async () => {
    setAdding(true);
    try {
      const asset = await importMediaUrl(item.url, `${item.title}${item.creator ? ` — ${item.creator}` : ""}`, {
        attribution: item.attribution,
        license: item.license,
        provider: item.source,
      });
      if (item.kind === "music") addAssetToTimeline(asset);
      else addSoundAsset(asset);
    } catch (err) {
      toast.error(`Couldn't add "${item.title}": ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAdding(false);
    }
  };
  return (
    <div
      className="group flex min-h-8 items-center gap-1.5 rounded-md py-0.5 pr-1 pl-0.5 transition-colors duration-150 hover:bg-foreground/[0.04]"
      title={[item.title, item.creator, item.tags.slice(0, 6).join(", "), item.attribution ?? item.license].filter(Boolean).join("\n")}
    >
      <Button variant="ghost" size="icon-xs" onClick={onPreview} aria-label={playing ? `Stop ${item.title}` : `Play ${item.title}`}>
        {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
      </Button>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-xs", playing ? "text-foreground" : "text-foreground/85")}>{item.title}</span>
        <span className="truncate text-[10px] text-muted-foreground">{[item.creator, item.genre].filter(Boolean).join(" · ")}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-sm px-1 text-[9px] font-medium",
          item.attribution ? "bg-amber-400/10 text-amber-300/90" : "bg-emerald-400/10 text-emerald-300/90",
        )}
        title={item.attribution ? "Free to use with credit (the credit is kept with the clip)" : "Free to use, no credit needed"}
      >
        {item.attribution ? "Credit" : "Free"}
      </span>
      <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground tabular">{formatLength(item.durationSec)}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(!adding && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
        onClick={() => void add()}
        disabled={adding}
        aria-label={`Add ${item.title}`}
      >
        {adding ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
      </Button>
    </div>
  );
};

const LibraryResults: React.FC<{
  state: ReturnType<typeof useLibrarySearch>;
  preview: ReturnType<typeof usePreview>;
  empty: string;
}> = ({ state, preview, empty }) => {
  if (state.loading && !state.results.length) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" /> Searching…
      </div>
    );
  }
  if (state.error) return <p className="px-1 py-1 text-[11px] text-destructive">{state.error}</p>;
  if (!state.results.length) return <p className="px-1 py-1 text-[11px] text-muted-foreground">{empty}</p>;
  return (
    <div>
      {state.results.map((r) => (
        <LibraryRow key={r.id} item={r} playing={preview.playing === r.id} onPreview={() => preview.toggle(r.id, r.url)} />
      ))}
    </div>
  );
};

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

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative pb-1">
    <SearchIcon className="pointer-events-none absolute top-[14px] left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="h-7 pl-8 text-xs"
    />
  </div>
);

export const AudioTab = () => {
  const [query, setQuery] = useState("");
  const [musicQuery, setMusicQuery] = useState("");
  const preview = usePreview();
  const musicInput = useRef<HTMLInputElement>(null);
  const music = useLibrarySearch("music", musicQuery);
  const recorded = useLibrarySearch("sfx", query);
  const q = query.trim().toLowerCase();
  const list = q ? SFX_LIBRARY.filter((s) => `${s.name} ${s.tags.join(" ")} ${s.description}`.toLowerCase().includes(q)) : SFX_LIBRARY;

  return (
    <div className="space-y-1">
      <SectionTitle>Music</SectionTitle>
      <SearchBox value={musicQuery} onChange={setMusicQuery} placeholder="Find music: mood, genre, instrument" />
      {musicQuery.trim().length >= 2 ? (
        <LibraryResults state={music} preview={preview} empty="No tracks found. Try a mood plus a genre, like “uplifting electronic”." />
      ) : null}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => musicInput.current?.click()}>
          <MusicIcon /> Your track
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
        Free music from Kevin MacLeod and Jamendo. Credits are kept with each track. Marked beats show on the ruler, and clips snap to them.
      </p>

      <SectionTitle>Voiceover</SectionTitle>
      <VoiceoverBox />

      <SectionTitle>Sound effects</SectionTitle>
      <SearchBox value={query} onChange={setQuery} placeholder="Search sounds" />
      {q.length >= 2 ? (
        <div className="pb-1">
          <div className="px-1 pt-1 pb-0.5 text-[11px] text-muted-foreground">Recorded (Freesound)</div>
          <LibraryResults state={recorded} preview={preview} empty="No recordings found." />
        </div>
      ) : null}
      {ORDER.map((cat) => {
        const items = list.filter((s) => s.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="pb-1">
            <div className="px-1 pt-2 pb-0.5 text-[11px] text-muted-foreground">{CATEGORY_LABEL[cat]}</div>
            {items.map((s) => (
              <SfxRow key={s.id} sfx={s} playing={preview.playing === s.id} onPreview={() => preview.toggle(s.id, s.src)} />
            ))}
          </div>
        );
      })}
      <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
        Built-in sounds are generated by Reframer (CC0). Recorded ones come from Freesound under CC0 or CC BY.
      </p>
    </div>
  );
};
