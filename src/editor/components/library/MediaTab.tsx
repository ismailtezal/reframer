"use client";

import {
  AudioLinesIcon,
  FileVideoIcon,
  ImageIcon,
  LinkIcon,
  LoaderCircleIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Progress } from "@/components/ui/progress";
import { removeAsset, USER } from "@/core/ops";
import type { Asset } from "@/core/schema";
import { cn } from "@/lib/utils";
import { addAssetToTimeline, run } from "../../actions";
import { importMediaUrl, type StockResult, searchStock } from "../../media/ai";
import { type ImportProgress, importFiles } from "../../media/import";
import { useProjectStore } from "../../store/project-store";
import { DND_ASSET } from "../timeline/Timeline";
import { SectionTitle } from "./Library";

const fmtDuration = (s?: number) => {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** Paste a link to import it, or search free stock footage (Pexels, with your own key). */
const FindMedia = () => {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"video" | "photo">("video");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<StockResult[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const link = isUrl(query);

  const submit = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    try {
      if (link) {
        const asset = await importMediaUrl(q);
        toast.success(`Imported ${asset.name}`);
        setQuery("");
      } else {
        const { results } = await searchStock(q, kind);
        setResults(results);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const importResult = async (r: StockResult) => {
    setImporting(r.id);
    try {
      const ext = r.type === "video" ? "mp4" : "jpg";
      const name = `${
        query
          .trim()
          .replace(/[^\w-]+/g, "-")
          .slice(0, 32) || "stock"
      }-${r.id.split("-").pop()}.${ext}`;
      await importMediaUrl(r.url, name);
      toast.success(r.attribution ?? "Imported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          {link ? (
            <LinkIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          ) : (
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search stock or paste a link"
            aria-label="Search stock footage or paste a media link"
            className="h-7 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        {!link ? (
          <button
            type="button"
            onClick={() => setKind(kind === "video" ? "photo" : "video")}
            className="h-7 rounded-md border border-input px-2 text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
            title="Switch between video and photos"
          >
            {kind === "video" ? "Video" : "Photos"}
          </button>
        ) : null}
        <Button type="submit" size="sm" variant="secondary" disabled={!query.trim() || busy}>
          {busy ? <LoaderCircleIcon className="animate-spin" /> : link ? "Import" : "Search"}
        </Button>
      </form>
      {results ? (
        results.length ? (
          <div className="grid grid-cols-2 gap-1.5">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void importResult(r)}
                disabled={importing !== null}
                className="group relative overflow-hidden rounded-md border border-border bg-black text-left"
                title={`${r.attribution ?? ""} · click to import`}
              >
                {/* biome-ignore lint/performance/noImgElement: remote stock preview */}
                <img
                  src={r.preview}
                  alt={r.attribution ?? ""}
                  className="aspect-video w-full object-cover transition-opacity duration-150 group-hover:opacity-80"
                  loading="lazy"
                />
                {r.durationSec ? (
                  <span className="tabular absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">
                    {fmtDuration(r.durationSec)}
                  </span>
                ) : null}
                {importing === r.id ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <LoaderCircleIcon className="size-4 animate-spin text-white" />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No results. Try another search.</p>
        )
      ) : null}
      {results?.length ? <p className="text-[11px] text-muted-foreground">Free stock from Pexels. Click to import.</p> : null}
    </div>
  );
};

const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
  const Icon =
    asset.type === "video" ? FileVideoIcon : asset.type === "audio" ? AudioLinesIcon : asset.type === "lut" ? PaletteIcon : ImageIcon;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DND_ASSET, asset.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
          className="group relative cursor-grab overflow-hidden rounded-lg border border-border bg-panel-2 active:cursor-grabbing"
          title={asset.name}
        >
          <div className="relative aspect-video w-full bg-black/40">
            {asset.thumbnail ? (
              // biome-ignore lint/performance/noImgElement: local data-URL thumbnail
              <img src={asset.thumbnail} alt="" className="size-full object-cover" draggable={false} />
            ) : asset.type === "audio" && asset.waveform ? (
              <svg viewBox={`0 0 ${asset.waveform.length} 100`} preserveAspectRatio="none" className="size-full text-clip-audio">
                {asset.waveform.map((v, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static waveform bars
                  <rect key={i} x={i} y={50 - v * 45} width={0.7} height={Math.max(1, v * 90)} fill="currentColor" />
                ))}
              </svg>
            ) : (
              <div className="flex size-full items-center justify-center">
                <Icon className="size-6 text-muted-foreground" />
              </div>
            )}
            {asset.durationSec ? (
              <span className="tabular absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">
                {fmtDuration(asset.durationSec)}
              </span>
            ) : null}
            {asset.source === "generated" ? (
              <span className="absolute top-1 left-1 rounded bg-ai px-1 text-[9px] font-medium text-ai-foreground">AI</span>
            ) : null}
            <Button
              size="icon-xs"
              variant="secondary"
              className="absolute top-1 right-1 opacity-0 shadow transition-opacity group-hover:opacity-100"
              onClick={() => addAssetToTimeline(asset)}
              aria-label="Add to timeline at playhead"
            >
              <PlusIcon />
            </Button>
          </div>
          <div className="truncate px-1.5 py-1 text-[11px] text-muted-foreground">{asset.name}</div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => addAssetToTimeline(asset)}>
          <PlusIcon /> Add at playhead
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => run("Remove asset", (d) => removeAsset(d, asset.id, { actor: USER }))}>
          <Trash2Icon /> Remove from project
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const MediaTab = () => {
  const assets = useProjectStore((s) => s.project?.assets);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Record<string, ImportProgress>>({});
  const [dragOver, setDragOver] = useState(false);

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    await importFiles(files, (p) => setUploads((u) => ({ ...u, [p.id]: p })));
    setTimeout(() => setUploads((u) => Object.fromEntries(Object.entries(u).filter(([, p]) => p.phase !== "done"))), 1200);
    const failed = Object.values(uploads).filter((u) => u.phase === "error");
    if (failed.length) toast.error(`${failed.length} file(s) failed to import`);
  };

  const list = Object.values(assets ?? {}).sort((a, b) => b.createdAt - a.createdAt);
  const pending = Object.values(uploads).filter((u) => u.phase !== "done");

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onFiles([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/[0.14] px-3 py-6 text-center transition-colors duration-150 hover:border-foreground/25 hover:bg-foreground/[0.02]",
          dragOver && "border-brand/60 bg-brand-soft",
        )}
      >
        <UploadIcon className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">Drop media or click to import</span>
        <span className="text-xs text-muted-foreground">Video, audio, images, GIFs, .cube LUTs</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="video/*,audio/*,image/*,.cube"
        onChange={(e) => {
          void onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      <FindMedia />

      {pending.length > 0 ? (
        <div className="mt-3 space-y-2">
          {pending.map((u) => (
            <div key={u.id} className="rounded-lg border border-border p-2 text-xs">
              <div className="mb-1 flex justify-between gap-2">
                <span className="truncate">{u.name}</span>
                <span className={u.phase === "error" ? "text-destructive" : "text-muted-foreground"}>
                  {u.phase === "error" ? u.error : u.phase === "analyzing" ? "Analyzing…" : `${Math.round(u.progress * 100)}%`}
                </span>
              </div>
              {u.phase !== "error" ? <Progress value={u.phase === "analyzing" ? 5 : u.progress * 100} className="h-1" /> : null}
            </div>
          ))}
        </div>
      ) : null}

      <SectionTitle>Project media · {list.length}</SectionTitle>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing here yet. Import footage, screenshots, logos or music — or ask the agent to find stock footage or generate images.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map((a) => (
            <AssetCard key={a.id} asset={a} />
          ))}
        </div>
      )}
    </div>
  );
};
