"use client";

import {
  ArrowUpIcon,
  FilmIcon,
  LoaderIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ASPECT_PRESETS, type AspectPresetId } from "@/core/defaults";
import { describeAspect } from "@/core/project-utils";
import { Logo } from "@/editor/components/TopBar";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/server/projects";

const EXAMPLES = [
  "A 30-second launch video for my app — Apple keynote style",
  "Turn my podcast clip into a vertical short with bold captions",
  "Kurzgesagt-style explainer about how black holes form",
  "Edit my vlog like Casey Neistat: whip pans, timelapses, music-first",
  "A data story: our revenue grew 3x this year, animated charts",
  "Cinematic logo reveal with light leaks and a bass hit",
];

const STYLE_CHIPS = ["Apple keynote", "Linear launch", "MrBeast", "Hormozi shorts", "Kurzgesagt", "A24 trailer", "MKBHD", "Vox explainer"];

const FORMATS: { id: AspectPresetId; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "16:9", icon: RectangleHorizontalIcon },
  { id: "9:16", icon: RectangleVerticalIcon },
  { id: "1:1", icon: SquareIcon },
];

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const Dashboard = () => {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<AspectPresetId>("16:9");
  const [style, setStyle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { projects: ProjectSummary[] }) => setProjects(d.projects))
      .catch(() => setProjects([]));
    const id = setInterval(() => setExampleIndex((i) => (i + 1) % EXAMPLES.length), 3800);
    return () => clearInterval(id);
  }, []);

  const create = async (opts: { prompt?: string; format?: AspectPresetId } = {}) => {
    setCreating(true);
    const f = ASPECT_PRESETS[opts.format ?? format];
    const fullPrompt = opts.prompt ? `${opts.prompt}${style ? `\nStyle: ${style}.` : ""}` : undefined;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: opts.prompt ? opts.prompt.slice(0, 48) : "Untitled video",
          width: f.width,
          height: f.height,
          fps: 30,
          prompt: fullPrompt,
        }),
      });
      const { project } = await res.json();
      router.push(`/editor/${project.id}${fullPrompt ? "?autostart=1" : ""}`);
    } catch {
      toast.error("Could not create the project");
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((p) => p?.filter((x) => x.id !== id) ?? null);
    toast("Moved to .reframer/trash");
  };

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(55%_55%_at_50%_0%,color-mix(in_oklch,var(--brand)_9%,transparent),transparent)]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight">Reframer</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">open source</span>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            <GithubMark /> GitHub
          </a>
        </Button>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-20">
        <section className="mx-auto mt-10 max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">What are we making?</h1>
          <p className="mt-3 text-balance text-muted-foreground">
            Describe a video. Watch the agent build it on a real timeline — and take over whenever you want. Any model, your keys, your
            machine.
          </p>

          <div className="mt-8 rounded-xl border border-border bg-card p-2 text-left shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] transition-colors duration-150 focus-within:border-brand/50">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                  e.preventDefault();
                  void create({ prompt: prompt.trim() });
                }
              }}
              rows={3}
              placeholder={EXAMPLES[exampleIndex]}
              className="w-full resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1">
              <div className="flex rounded-lg border border-border p-0.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors",
                      format === f.id && "bg-accent text-foreground",
                    )}
                  >
                    <f.icon className="size-3.5" /> {f.id}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {STYLE_CHIPS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(style === s ? null : s)}
                    className={cn(
                      "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                      style === s && "border-brand/50 bg-brand-soft text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button
                size="icon"
                className="ml-auto rounded-full"
                disabled={!prompt.trim() || creating}
                onClick={() => void create({ prompt: prompt.trim() })}
                aria-label="Create video"
              >
                {creating ? <LoaderIcon className="animate-spin" /> : <ArrowUpIcon />}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">or start blank:</span>
            {FORMATS.map((f) => (
              <Button key={f.id} variant="outline" size="sm" onClick={() => void create({ format: f.id })} disabled={creating}>
                <f.icon /> {f.id} {ASPECT_PRESETS[f.id].label.toLowerCase()}
              </Button>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent projects</h2>
            <Button variant="ghost" size="sm" onClick={() => void create()} disabled={creating}>
              <PlusIcon /> New project
            </Button>
          </div>
          {projects === null ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeletons
                <Skeleton key={i} className="aspect-video rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No projects yet. Describe a video above, or start blank.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {projects.map((p) => (
                <div key={p.id} className="group relative">
                  <Link href={`/editor/${p.id}`} className="block">
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-panel-2 transition-colors group-hover:border-ring">
                      {p.thumbnail ? (
                        // biome-ignore lint/performance/noImgElement: local thumbnail endpoint
                        <img src={p.thumbnail} alt="" className="size-full object-contain" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <FilmIcon className="size-6 text-muted-foreground" />
                        </div>
                      )}
                      <span className="tabular absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                        {describeAspect(p.width, p.height)} · {p.durationSec}s
                      </span>
                    </div>
                    <div className="mt-2 truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(p.updatedAt)} · {p.clipCount} clips
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon-xs"
                        className="absolute top-1.5 right-1.5 opacity-0 shadow group-hover:opacity-100"
                        aria-label="Project menu"
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onClick={() => void remove(p.id)}>
                        <Trash2Icon /> Move to trash
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const GithubMark = () => (
  <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);
