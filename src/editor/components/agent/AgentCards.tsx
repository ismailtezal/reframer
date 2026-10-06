"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleIcon,
  CpuIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  MessageCircleQuestionIcon,
  SkipForwardIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInteractions } from "../../agent/interactions";
import { type PlanStep, useAgentStore } from "../../store/agent-store";
import { seek } from "../../store/playback-store";

const StepIcon: React.FC<{ status: PlanStep["status"] }> = ({ status }) => {
  switch (status) {
    case "done":
      return <CheckIcon className="size-3.5 text-muted-foreground" />;
    case "running":
      return <LoaderCircleIcon className="size-3.5 animate-spin text-ai motion-reduce:animate-none" />;
    case "failed":
      return <XIcon className="size-3.5 text-destructive" />;
    case "skipped":
      return <SkipForwardIcon className="size-3.5 text-muted-foreground/60" />;
    default:
      return <CircleIcon className="size-3 text-muted-foreground/50" />;
  }
};

/** The agent's plan, docked above the composer while it works. */
export const PlanCard = () => {
  const plan = useAgentStore((s) => s.plan);
  const [open, setOpen] = useState(true);
  if (plan.length === 0) return null;
  const done = plan.filter((s) => s.status === "done" || s.status === "skipped").length;
  const running = plan.find((s) => s.status === "running");
  return (
    <div className="rounded-md border border-border bg-panel-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs"
        aria-expanded={open}
      >
        <CircleDashedIcon className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">Plan</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{!open && running ? running.title : null}</span>
        <span className="tabular text-muted-foreground">
          {done}/{plan.length}
        </span>
        <ChevronDownIcon className={cn("size-3.5 text-muted-foreground transition-transform duration-150", !open && "-rotate-90")} />
      </button>
      {open ? (
        <ol className="max-h-40 space-y-0.5 overflow-y-auto px-2.5 pb-2">
          {plan.map((step) => (
            <li key={step.id} className="flex items-start gap-2 text-xs">
              <span className="mt-px flex size-3.5 shrink-0 items-center justify-center">
                <StepIcon status={step.status} />
              </span>
              <button
                type="button"
                disabled={!step.range}
                onClick={() => step.range && seek(step.range[0])}
                className={cn(
                  "min-w-0 flex-1 text-left",
                  step.status === "done" || step.status === "skipped" ? "text-muted-foreground" : "text-foreground/90",
                  step.status === "running" && "font-medium text-foreground",
                  step.range && "hover:underline",
                )}
              >
                {step.title}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};

/** Questions an agent is waiting on (ask_user). */
export const QuestionCard = () => {
  const questions = useInteractions((s) => s.questions);
  const answer = useInteractions((s) => s.answer);
  const [draft, setDraft] = useState("");
  const q = questions[0];
  if (!q) return null;
  const submit = (value: string) => {
    if (!value.trim()) return;
    answer(q.id, value.trim());
    setDraft("");
  };
  return (
    <div className="rounded-md border border-ai/40 bg-ai-soft p-2.5">
      <div className="flex items-start gap-2">
        <MessageCircleQuestionIcon className="mt-0.5 size-3.5 shrink-0 text-ai" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm leading-snug">
            <span className="font-medium text-ai">{q.agent}</span> asks: {q.question}
          </p>
          {q.options.length ? (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((o) => (
                <Button key={o} size="xs" variant="secondary" onClick={() => submit(o)}>
                  {o}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={q.options.length ? "Or type your own answer…" : "Type your answer…"}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              onKeyDown={(e) => e.stopPropagation()}
            />
            <Button type="submit" size="sm" disabled={!draft.trim()}>
              Answer
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

/** First run: no model connected yet. */
export const SetupCard: React.FC<{ onOpenSettings: (section?: "keys" | "local" | "agents") => void }> = ({ onOpenSettings }) => (
  <div className="space-y-3">
    <div className="space-y-1">
      <p className="text-sm font-semibold">Connect a model to start</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Reframer works with any model. Your keys and logins stay on this computer.
      </p>
    </div>
    <div className="space-y-1.5">
      {(
        [
          { id: "keys", icon: KeyRoundIcon, title: "Add an API key", body: "Anthropic, OpenAI, Google, xAI, OpenRouter and more." },
          { id: "agents", icon: TerminalIcon, title: "Use Claude Code or Codex", body: "Runs your own installed CLI with your own login." },
          { id: "local", icon: CpuIcon, title: "Run a local model", body: "Ollama or LM Studio on this machine. Nothing leaves it." },
        ] as const
      ).map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onOpenSettings(o.id)}
          className="flex w-full items-start gap-2.5 rounded-md border border-border bg-foreground/[0.02] px-2.5 py-2 text-left transition-colors duration-150 hover:border-foreground/15 hover:bg-foreground/[0.04]"
        >
          <o.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="space-y-0.5">
            <span className="block text-xs font-medium">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.body}</span>
          </span>
        </button>
      ))}
    </div>
  </div>
);
