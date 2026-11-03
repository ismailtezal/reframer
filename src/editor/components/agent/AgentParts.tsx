"use client";

import type { UIMessage } from "ai";
import { CheckIcon, ChevronRightIcon, LoaderCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { restoreCheckpoint } from "../../agent/checkpoints";
import { describeToolCall } from "../../agent/describe";
import { reviewThumbnails } from "../../agent/review-thumbnails";
import { seek } from "../../store/playback-store";
import { getProject } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";

type Part = UIMessage["parts"][number];
type ToolPart = {
  type: string;
  toolName?: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/** Tools that only read: shown quieter, since they don't change the edit. */
const READ_TOOLS = new Set([
  "get_project",
  "get_clips",
  "list_styles",
  "get_style",
  "list_components",
  "load_skill",
  "get_errors",
  "WebSearch",
  "WebFetch",
]);

export const isToolPart = (p: Part): boolean => p.type === "dynamic-tool" || p.type.startsWith("tool-");
const toolName = (p: ToolPart) => (p.type === "dynamic-tool" ? (p.toolName ?? "tool") : p.type.slice(5));

export const textOfMessage = (m: UIMessage) =>
  m.parts
    .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");

const Markdown = memo(({ children }: { children: string }) => (
  <Streamdown className="space-y-2 text-sm leading-relaxed [&_code]:text-[12px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    {children}
  </Streamdown>
));
Markdown.displayName = "Markdown";

/** Clip ids a tool result points at, so a row can jump to the change. */
const targetsOf = (output: unknown): string[] => {
  if (!output || typeof output !== "object") return [];
  const o = output as Record<string, unknown>;
  const ids = [o.ids, o.clipIds, o.created, o.updated].find(Array.isArray) as unknown[] | undefined;
  const single = typeof o.clipId === "string" ? [o.clipId] : typeof o.id === "string" && o.id.startsWith("clip_") ? [o.id] : [];
  return [...(ids ?? []).filter((x): x is string => typeof x === "string"), ...single];
};

const reveal = (clipIds: string[]) => {
  const project = getProject();
  const clips = clipIds.map((id) => project.clips[id]).filter(Boolean);
  if (clips.length === 0) return;
  useUIStore.getState().select(clips.map((c) => c.id));
  seek(Math.min(...clips.map((c) => c.start)));
};

const ReviewThumbs: React.FC<{ output: unknown }> = ({ output }) => {
  const frames = reviewThumbnails(output);
  if (frames.length === 0) return null;
  const fps = getProject().settings.fps;
  return (
    <div className="mt-1 mb-1 ml-5 flex gap-1 overflow-x-auto pb-0.5">
      {frames.map((f) => (
        <button
          key={f.timeSec}
          type="button"
          onClick={() => seek(Math.round(f.timeSec * fps))}
          className="shrink-0 overflow-hidden rounded-sm ring-1 ring-border transition-[box-shadow] duration-150 hover:ring-foreground/30"
          title={`Frame at ${f.timeSec}s`}
        >
          {/* biome-ignore lint/performance/noImgElement: data URL frame */}
          <img src={f.dataUrl} alt={`Frame at ${f.timeSec}s`} className="h-10 w-auto" />
        </button>
      ))}
    </div>
  );
};

const ToolRow: React.FC<{ part: ToolPart }> = ({ part }) => {
  const name = toolName(part);
  const running = part.state === "input-streaming" || part.state === "input-available";
  const outputError =
    part.output && typeof part.output === "object" && "error" in (part.output as Record<string, unknown>)
      ? String((part.output as { error: unknown }).error)
      : null;
  const error = part.state === "output-error" ? (part.errorText ?? "Failed") : outputError;
  const label = part.state === "input-streaming" && !part.input ? name.replace(/_/g, " ") : describeToolCall(name, part.input);
  const read = READ_TOOLS.has(name);
  const targets = error ? [] : targetsOf(part.output);
  const answer = name === "ask_user" ? (part.output as { answer?: string } | undefined)?.answer : undefined;

  return (
    <div className="py-[3px]">
      <div className="flex items-start gap-2 text-xs">
        <span className="mt-px flex size-3.5 shrink-0 items-center justify-center">
          {running ? (
            <LoaderCircleIcon className="size-3.5 animate-spin text-ai motion-reduce:animate-none" />
          ) : error ? (
            <XIcon className="size-3.5 text-destructive" />
          ) : (
            <CheckIcon className={cn("size-3.5", read ? "text-muted-foreground/60" : "text-muted-foreground")} />
          )}
        </span>
        {targets.length ? (
          <button
            type="button"
            onClick={() => reveal(targets)}
            className="min-w-0 flex-1 truncate text-left text-foreground/90 decoration-foreground/30 underline-offset-2 hover:underline"
            title="Show on the timeline"
          >
            {label}
          </button>
        ) : (
          <span className={cn("min-w-0 flex-1 truncate", read ? "text-muted-foreground" : "text-foreground/90", running && "text-shimmer")}>
            {label}
          </span>
        )}
      </div>
      {answer ? <p className="mt-0.5 ml-5.5 text-xs text-muted-foreground">You: {answer}</p> : null}
      {error ? <p className="mt-0.5 ml-5.5 line-clamp-2 text-[11px] text-destructive/80">{error}</p> : null}
      {(name === "review_frames" || name === "critique_video") && !running ? <ReviewThumbs output={part.output} /> : null}
    </div>
  );
};

/** Consecutive tool calls render as one compact activity list; long runs fold their earlier steps. */
const ActivityGroup: React.FC<{ parts: ToolPart[] }> = ({ parts }) => {
  const [expanded, setExpanded] = useState(false);
  const FOLD_AFTER = 6;
  const hidden = !expanded && parts.length > FOLD_AFTER ? parts.length - 4 : 0;
  return (
    <div className="rounded-md border border-border bg-foreground/[0.02] px-2.5 py-1.5">
      {hidden ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 py-[3px] text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon className="size-3.5" /> {hidden} earlier steps
        </button>
      ) : null}
      {parts.slice(hidden).map((p) => (
        <ToolRow key={p.toolCallId} part={p} />
      ))}
    </div>
  );
};

const ThoughtMarkdown = memo(({ children }: { children: string }) => (
  <Streamdown className="space-y-1.5 text-xs leading-relaxed text-muted-foreground [&_[data-streamdown=strong]]:font-medium [&_[data-streamdown=strong]]:text-foreground/75 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    {/* Summaries put one heading per line ("**Planning**\n**Timing**"): keep the line breaks. */}
    {children.replace(/(?<!\n)\n(?!\n)/g, "  \n")}
  </Streamdown>
));
ThoughtMarkdown.displayName = "ThoughtMarkdown";

/** "**Planning the cut**\n\nI'll…" → "Planning the cut"; plain thoughts give their first sentence. */
const headlineOf = (text: string) => {
  const line = /\*\*(.+?)\*\*/.exec(text)?.[1] ?? text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "";
  return line.replace(/[*_`#>]/g, "").trim();
};

/**
 * The model's thinking: open and following along while it thinks, folded to a one-line
 * summary once the answer starts (unless the user opened or closed it themselves).
 */
const ReasoningRow: React.FC<{ text: string; streaming: boolean }> = ({ text, streaming }) => {
  const hasText = text.trim().length > 0;
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = hasText && (userOpen ?? streaming);
  const startedAt = useRef<number | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    if (streaming) startedAt.current ??= Date.now();
    else if (startedAt.current !== null) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
      startedAt.current = null;
    }
  }, [streaming]);

  // Follow new thoughts like a terminal, unless the user scrolled up to reread.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run as text streams in
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !streaming) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
    setFaded(el.scrollTop > 0);
  }, [text, streaming, open]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setFaded(el.scrollTop > 0);
  };

  const label = streaming ? "Thinking…" : seconds ? `Thought for ${seconds}s` : "Thought";
  const headline = !open && !streaming ? headlineOf(text) : "";

  return (
    <Collapsible open={open} onOpenChange={setUserOpen}>
      <CollapsibleTrigger
        disabled={!hasText}
        className="group/reason flex max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 enabled:hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150 group-data-[state=open]/reason:rotate-90",
            !hasText && "invisible",
          )}
        />
        <span className={cn("shrink-0", streaming && "text-shimmer")}>{label}</span>
        {headline ? <span className="min-w-0 truncate text-muted-foreground/70">· {headline}</span> : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={scroller}
          onScroll={onScroll}
          className={cn(
            "mt-1 ml-1.5 border-l border-border pl-3",
            streaming && "max-h-36 overflow-y-auto overscroll-contain",
            streaming && faded && "[mask-image:linear-gradient(to_bottom,transparent,#000_1.5rem)]",
          )}
        >
          <ThoughtMarkdown>{text}</ThoughtMarkdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const UserMessage: React.FC<{ message: UIMessage; canRestore: boolean }> = ({ message, canRestore }) => (
  <div className="group/user flex items-start justify-end gap-1">
    {canRestore ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="mt-1 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/user:opacity-100 focus-visible:opacity-100"
            onClick={() => void restoreCheckpoint(message.id)}
            aria-label="Restore to before this message"
          >
            <RotateCcwIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Restore the edit to before this message</TooltipContent>
      </Tooltip>
    ) : null}
    <div className="max-w-[88%] rounded-lg bg-raised px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{textOfMessage(message)}</div>
  </div>
);

export const AssistantMessage: React.FC<{ message: UIMessage; streaming: boolean }> = ({ message, streaming }) => {
  // Group consecutive tool parts so a run of edits reads as one activity list, and consecutive
  // thoughts (Codex streams several short summaries in a row) as one thinking row.
  const blocks: (
    | { kind: "tools"; parts: ToolPart[] }
    | { kind: "reasoning"; text: string; index: number; end: number; active: boolean }
    | { kind: "part"; part: Part; index: number }
  )[] = [];
  let lastIndex = -1;
  message.parts.forEach((part, index) => {
    if (part.type === "step-start") return;
    lastIndex = index;
    const last = blocks[blocks.length - 1];
    if (isToolPart(part)) {
      if (last?.kind === "tools") last.parts.push(part as unknown as ToolPart);
      else blocks.push({ kind: "tools", parts: [part as unknown as ToolPart] });
    } else if (part.type === "reasoning") {
      if (last?.kind === "reasoning") {
        if (part.text.trim()) last.text = last.text.trim() ? `${last.text}\n\n${part.text}` : part.text;
        last.end = index;
        last.active = part.state === "streaming";
      } else {
        blocks.push({ kind: "reasoning", text: part.text, index, end: index, active: part.state === "streaming" });
      }
    } else {
      blocks.push({ kind: "part", part, index });
    }
  });

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.kind === "tools") return <ActivityGroup key={`tools-${block.parts[0].toolCallId}`} parts={block.parts} />;
        if (block.kind === "reasoning") {
          const thinking = streaming && block.end === lastIndex && block.active;
          // Some models think without sharing the text: show the live status, never an empty dropdown.
          return block.text.trim() || thinking ? <ReasoningRow key={block.index} text={block.text} streaming={thinking} /> : null;
        }
        const { part, index } = block;
        if (part.type === "text") return part.text.trim() ? <Markdown key={index}>{part.text}</Markdown> : null;
        return <span key={`${i}-${part.type}`} hidden />;
      })}
    </div>
  );
};
