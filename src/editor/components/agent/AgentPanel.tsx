"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpIcon, ChevronDownIcon, HistoryIcon, PlusIcon, SparklesIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { summarizeProject } from "@/agent/summary";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { newId } from "@/core/ids";
import { cn } from "@/lib/utils";
import { motionCatalogForAgents } from "@/remotion/components/registry";
import { saveCheckpoint } from "../../agent/checkpoints";
import { registerStopper } from "../../agent/control";
import { useAgentPrompt } from "../../agent/prompt-bus";
import { useAgentStore } from "../../store/agent-store";
import { usePlaybackStore } from "../../store/playback-store";
import { getProject, useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { PlanCard, QuestionCard, SetupCard } from "./AgentCards";
import { AssistantMessage, UserMessage } from "./AgentParts";
import { ModelPicker } from "./ModelPicker";
import { useModelStore, useModels } from "./models";
import { useThreadStore } from "./threads";

export type SettingsSection = "keys" | "local" | "agents" | "integrations";

/** Everything the agent should know about the editor right now, sent with each message. */
const buildContext = () => {
  const project = getProject();
  const selection = useUIStore.getState().selectedClipIds;
  const frame = usePlaybackStore.getState().frame;
  const builtIn = motionCatalogForAgents().map((c) => ({ id: c.id, category: c.category, description: c.description }));
  const custom = Object.values(project.components ?? {}).map((c) => ({
    id: `code:${c.id}`,
    category: "custom",
    description: c.description ?? c.name,
  }));
  return {
    summary: summarizeProject(project, { selection, playheadFrame: frame }),
    components: [...builtIn, ...custom],
    selection,
    playheadSec: Math.round((frame / project.settings.fps) * 100) / 100,
  };
};

const SUGGESTIONS_EMPTY = [
  "Make a 20-second launch video for my app, Apple keynote style",
  "Create a kinetic title intro with a gradient background",
  "Build a data story: three stats that count up, one per beat",
  "Make a 9:16 short with bold captions from my clip",
];
const SUGGESTIONS_EDIT = [
  "Review the edit and fix anything that feels off",
  "Add bold word-by-word captions",
  "Restyle this in the MrBeast style",
  "Add whooshes and pops on the cuts",
];

const EmptyState: React.FC<{ onPick: (text: string) => void }> = ({ onPick }) => {
  const hasClips = useProjectStore((s) => Object.keys(s.project?.clips ?? {}).length > 0);
  const suggestions = hasClips ? SUGGESTIONS_EDIT : SUGGESTIONS_EMPTY;
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="space-y-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-ai-soft text-ai">
          <SparklesIcon className="size-4" />
        </div>
        <p className="text-sm font-semibold">{hasClips ? "What should we change?" : "What should we make?"}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The agent edits this timeline live. You see every change as it happens, and you can take over anytime.
        </p>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="block w-full rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground/15 hover:bg-foreground/[0.03] hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

const SelectionChip = () => {
  const ids = useUIStore((s) => s.selectedClipIds);
  const first = useProjectStore((s) => (ids[0] ? s.project?.clips[ids[0]] : undefined));
  if (ids.length === 0) return null;
  const name = first?.name || (first?.type === "text" ? first.text : first?.type) || "clip";
  return (
    <div className="px-2.5 pt-2">
      <span className="inline-flex max-w-full items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[11px] text-foreground/80">
        <span className="truncate">Selection: {name}</span>
        {ids.length > 1 ? <span className="shrink-0 text-muted-foreground">+{ids.length - 1}</span> : null}
      </span>
    </div>
  );
};

const EffortPicker = () => {
  const effort = useModelStore((s) => s.effort);
  const setEffort = useModelStore((s) => s.setEffort);
  const model = useModelStore((s) => s.models.find((m) => m.ref === s.selected));
  if (!model?.reasoning || model.kind === "custom") return null;
  const levels = model.efforts?.length ? model.efforts : ["low", "medium", "high"];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs capitalize text-muted-foreground hover:text-foreground">
          {effort}
          <ChevronDownIcon className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-40">
        <DropdownMenuLabel>Thinking effort</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={effort} onValueChange={setEffort}>
          {levels.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} className="capitalize">
              {l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Composer: React.FC<{
  busy: boolean;
  canSend: boolean;
  focusNonce: number;
  prefill: { text: string; nonce: number } | null;
  onSend: (text: string) => void;
  onStop: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
}> = ({ busy, canSend, focusNonce, prefill, onSend, onStop, onOpenSettings }) => {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusNonce) ref.current?.focus();
  }, [focusNonce]);
  useEffect(() => {
    if (!prefill) return;
    setText(prefill.text);
    ref.current?.focus();
  }, [prefill]);
  // Grow with the text, up to a limit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if (!value || busy || !canSend) return;
    onSend(value);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-lg border border-border bg-background transition-colors duration-150 focus-within:border-brand/50"
    >
      <SelectionChip />
      <textarea
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={canSend ? "Describe an edit…" : "Connect a model to start"}
        aria-label="Message the agent"
        className="block max-h-48 min-h-[52px] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
      />
      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        <ModelPicker onOpenSettings={() => onOpenSettings("keys")} />
        <EffortPicker />
        <div className="flex-1" />
        {busy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon-sm" variant="secondary" onClick={onStop} aria-label="Stop">
                <SquareIcon className="size-3 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop · keeps finished steps (Esc)</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="submit" size="icon-sm" disabled={!text.trim() || !canSend} aria-label="Send">
            <ArrowUpIcon />
          </Button>
        )}
      </div>
    </form>
  );
};

const ChatView: React.FC<{
  projectId: string;
  threadId: string;
  focusNonce: number;
  onOpenSettings: (section?: SettingsSection) => void;
}> = ({ projectId, threadId, focusNonce, onOpenSettings }) => {
  const initialMessages = useThreadStore((s) => s.initialMessages);
  const { models, loaded, selected } = useModels();
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        prepareSendMessagesRequest: ({ messages }) => {
          const { selected: modelRef, effort, models: list } = useModelStore.getState();
          const model = list.find((m) => m.ref === modelRef);
          return {
            body: {
              projectId,
              threadId,
              messages,
              modelRef,
              effort: model?.reasoning ? effort : undefined,
              context: buildContext(),
            },
          };
        },
      }),
    [projectId, threadId],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void useThreadStore.getState().refresh();
    },
  });

  const busy = status === "submitted" || status === "streaming";
  // Stop both the stream and the server-side turn (closing a stream alone doesn't always end it).
  const stopTurn = useCallback(() => {
    void stop();
    void fetch("/api/agent/stop", { method: "POST", body: JSON.stringify({ projectId, threadId }) });
  }, [stop, projectId, threadId]);
  useEffect(() => registerStopper(stopTurn), [stopTurn]);
  // Leaving or reloading the page ends a running turn instead of letting it edit a window you can't see.
  useEffect(() => {
    if (!busy) return;
    const onLeave = () => navigator.sendBeacon("/api/agent/stop", JSON.stringify({ projectId, threadId }));
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [busy, projectId, threadId]);
  // If the stream ends without an idle signal (errors, aborts), clear the presence.
  useEffect(() => {
    if (!busy) {
      const s = useAgentStore.getState();
      if (s.status !== "idle" && s.status !== "waiting") {
        s.setStatus("idle", null);
        s.setFrame(null);
      }
    }
  }, [busy]);

  const send = (text: string) => {
    if (!selected) {
      onOpenSettings("keys");
      return;
    }
    clearError();
    const id = newId("msg");
    // Restore point: the project exactly as it was before this message.
    saveCheckpoint(id);
    useAgentStore.getState().setPlan([]);
    useAgentStore.getState().setStatus("thinking", null, models.find((m) => m.ref === selected)?.name ?? "Agent");
    void sendMessage({ id, role: "user", parts: [{ type: "text", text }] });
  };

  const noModels = loaded && models.length === 0;

  // Prompts handed over from elsewhere in the editor (e.g. "Clone this style").
  const request = useAgentPrompt((s) => s.request);
  // biome-ignore lint/correctness/useExhaustiveDependencies: react only to new prompt requests
  useEffect(() => {
    if (!request) return;
    useAgentPrompt.getState().clear();
    if (request.send && selected && !busy) send(request.text);
    else setPrefill({ text: request.text, nonce: request.nonce });
  }, [request]);
  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-3 py-3">
          {messages.length === 0 ? (
            noModels ? (
              <div className="pt-4">
                <SetupCard onOpenSettings={onOpenSettings} />
              </div>
            ) : (
              <EmptyState onPick={(text) => setPrefill({ text, nonce: Date.now() })} />
            )
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} message={m} canRestore />
              ) : (
                <AssistantMessage key={m.id} message={m} streaming={busy && m.id === lastId} />
              ),
            )
          )}
          {status === "submitted" ? <p className="text-shimmer text-xs">Thinking…</p> : null}
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {error.message || "Something went wrong."}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="space-y-2 border-t border-border p-2">
        <QuestionCard />
        <PlanCard />
        <Composer
          busy={busy}
          canSend={!noModels}
          focusNonce={focusNonce}
          prefill={prefill}
          onSend={send}
          onStop={stopTurn}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
};

/** The agent chat: messages, live activity, plan, questions and the composer. */
export const AgentPanel: React.FC<{ focusNonce: number; onOpenSettings: (section?: SettingsSection) => void }> = ({
  focusNonce,
  onOpenSettings,
}) => {
  const projectId = useProjectStore((s) => s.project?.id);
  const threadId = useThreadStore((s) => s.currentId);
  const loading = useThreadStore((s) => s.loading);

  useEffect(() => {
    if (projectId) void useThreadStore.getState().init(projectId);
  }, [projectId]);

  return (
    <div data-agent-panel className="h-full min-h-0">
      {projectId && threadId && !loading ? (
        <ChatView key={threadId} projectId={projectId} threadId={threadId} focusNonce={focusNonce} onOpenSettings={onOpenSettings} />
      ) : null}
    </div>
  );
};

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** History and new-chat buttons, shown in the side panel header next to the tabs. */
export const AgentHeaderActions = () => {
  const threads = useThreadStore((s) => s.threads);
  const currentId = useThreadStore((s) => s.currentId);
  return (
    <div className="ml-auto flex items-center">
      <DropdownMenu onOpenChange={(open) => open && void useThreadStore.getState().refresh()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Chat history">
                <HistoryIcon />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Chat history</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Chats in this project</DropdownMenuLabel>
          {threads.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">No chats yet.</p> : null}
          {threads.slice(0, 30).map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => void useThreadStore.getState().open(t.id)}
              className={cn("group/thread gap-2", t.id === currentId && "bg-foreground/[0.05]")}
            >
              <span className="min-w-0 flex-1 truncate">{t.title || "New chat"}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{ago(t.updatedAt)}</span>
              <button
                type="button"
                aria-label="Delete chat"
                className="hidden size-5 items-center justify-center rounded-sm text-muted-foreground group-hover/thread:flex hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  void useThreadStore.getState().remove(t.id);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => useThreadStore.getState().startNew()}>
            <PlusIcon /> New chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={() => useThreadStore.getState().startNew()} aria-label="New chat">
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New chat</TooltipContent>
      </Tooltip>
    </div>
  );
};
