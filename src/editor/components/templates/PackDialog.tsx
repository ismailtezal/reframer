"use client";

import { LoaderIcon, PlusIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PackCard, PackInput } from "@/core/packs";
import { describeAspect } from "@/core/project-utils";
import { prefersReducedMotion } from "./PackTile";
import { defaultFormValues, type FormValue, type FormValues, formSections, formToInputs } from "./template-form";

type Handlers = {
  /** Hand the template and the topic to the agent. */
  onAgent: (pack: PackCard, topic: string) => void | Promise<void>;
  /** Put the template's film on a timeline with these inputs. */
  onFill: (pack: PackCard, values: Record<string, unknown>) => void | Promise<void>;
  /** The fill button's words: "Add to timeline" in the editor, "Create video" on the dashboard. */
  fillLabel: string;
  /** Topic already typed somewhere else (the dashboard's prompt box). */
  initialTopic?: string;
};

/**
 * A template opened from a gallery: its preview, and two ways to make it. The agent makes it from a topic (fills
 * the words, writes the narration on the film's beats, adds voice, music and captions); or the form fills the
 * template's inputs by hand and puts the film on the timeline at once. `pack` stays set after closing, so the
 * dialog animates out with its content.
 */
export const PackDialog: React.FC<Handlers & { pack: PackCard | null; open: boolean; onOpenChange: (open: boolean) => void }> = ({
  pack,
  open,
  onOpenChange,
  ...handlers
}) => (
  <Dialog open={open && !!pack} onOpenChange={onOpenChange}>
    {pack ? <PackDialogBody key={pack.id} pack={pack} close={() => onOpenChange(false)} {...handlers} /> : null}
  </Dialog>
);

const TOPIC_EXAMPLE = "e.g. The launch party for our new app, Friday 9 pm on the rooftop";

const PackDialogBody: React.FC<Handlers & { pack: PackCard; close: () => void }> = ({
  pack,
  close,
  onAgent,
  onFill,
  fillLabel,
  initialTopic,
}) => {
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [form, setForm] = useState<FormValues>(() => defaultFormValues(pack));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"agent" | "fill" | null>(null);
  const canFill = pack.engine === "page";
  const { onScreen, narration } = formSections(pack);

  const set = (key: string, value: FormValue) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const agent = async () => {
    if (!topic.trim() || busy) return;
    setBusy("agent");
    try {
      await onAgent(pack, topic);
      close();
    } finally {
      setBusy(null);
    }
  };

  const fill = async () => {
    if (busy) return;
    const { values, problems } = formToInputs(pack, form);
    if (problems.length) {
      setErrors(Object.fromEntries(problems.map((p) => [p.key, p.message])));
      return;
    }
    setBusy("fill");
    try {
      await onFill(pack, values);
      close();
    } finally {
      setBusy(null);
    }
  };

  const facts = [
    pack.size ? describeAspect(pack.size.width, pack.size.height) : null,
    `${Math.round(pack.durationSec)} s`,
    ...pack.tags.slice(0, 3),
  ].filter(Boolean);

  return (
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[820px]" data-shortcuts-off="">
      <div className="grid sm:h-[min(580px,86vh)] sm:grid-cols-[326px_minmax(0,1fr)]">
        <div className="hidden bg-black sm:block">
          {pack.preview ? (
            <video
              src={pack.preview}
              poster={pack.poster}
              autoPlay={!prefersReducedMotion()}
              muted
              loop
              playsInline
              className="size-full object-cover"
            />
          ) : pack.poster ? (
            // biome-ignore lint/performance/noImgElement: a local file the app serves as it is
            <img src={pack.poster} alt="" className="size-full object-cover" />
          ) : null}
        </div>

        <div className="flex max-h-[86vh] min-h-0 flex-col sm:max-h-none">
          <DialogHeader className="gap-1.5 px-5 pt-5 pb-4">
            <DialogTitle className="text-base">{pack.name}</DialogTitle>
            <DialogDescription className="text-pretty">{pack.description}</DialogDescription>
            <p className="tabular text-[11px] text-muted-foreground">{facts.join(" · ")}</p>
          </DialogHeader>

          <Tabs defaultValue="agent" className="flex min-h-0 flex-1 flex-col gap-0 px-5 pb-5">
            <TabsList className="w-full">
              <TabsTrigger value="agent">With the agent</TabsTrigger>
              <TabsTrigger value="fill" disabled={!canFill}>
                Fill it in yourself
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agent" className="mt-4 flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="pack-topic">What is it about?</FieldLabel>
                <Textarea
                  id="pack-topic"
                  autoFocus
                  rows={4}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void agent();
                    }
                  }}
                  placeholder={TOPIC_EXAMPLE}
                  className="resize-none text-sm"
                />
                <FieldDescription>
                  {canFill
                    ? "The agent writes the template's words for your topic, puts the narration on the film's beats, and adds the voice, music, sound effects and captions."
                    : pack.engine === "blender"
                      ? "The agent builds the shots in Blender and renders them on your GPU (it asks before downloads and long renders), then edits them with voice, music and captions."
                      : "This template is made by the agent: it draws the pictures in the style, then adds the voice, music and captions."}
                </FieldDescription>
              </Field>
              <div className="flex justify-end">
                <Button onClick={() => void agent()} disabled={!topic.trim() || busy !== null}>
                  {busy === "agent" ? <LoaderIcon className="animate-spin" /> : <SparklesIcon />} Make it
                </Button>
              </div>
            </TabsContent>

            {canFill ? (
              <TabsContent value="fill" className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-1">
                  <FieldGroupBlock title="On screen">
                    {onScreen.map((input) => (
                      <InputField
                        key={input.key}
                        input={input}
                        value={form[input.key]}
                        error={errors[input.key]}
                        onChange={(v) => set(input.key, v)}
                      />
                    ))}
                  </FieldGroupBlock>
                  {narration.length ? (
                    <FieldGroupBlock title="Narration" note="Each line becomes a marker on its beat, where the voice-over goes.">
                      {narration.map((input) => (
                        <InputField
                          key={input.key}
                          input={input}
                          value={form[input.key]}
                          error={errors[input.key]}
                          onChange={(v) => set(input.key, v)}
                        />
                      ))}
                    </FieldGroupBlock>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm(defaultFormValues(pack));
                      setErrors({});
                    }}
                  >
                    <RotateCcwIcon /> Reset
                  </Button>
                  <Button onClick={() => void fill()} disabled={busy !== null}>
                    {busy === "fill" ? <LoaderIcon className="animate-spin" /> : <PlusIcon />} {fillLabel}
                  </Button>
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </div>
    </DialogContent>
  );
};

const FieldGroupBlock: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="space-y-3">
    <div>
      <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</h4>
      {note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
    {children}
  </section>
);

/** One template input as a form field, by its type; text fields stop at the length the film was laid out for. */
const InputField: React.FC<{ input: PackInput; value: FormValue | undefined; error?: string; onChange: (v: FormValue) => void }> = ({
  input,
  value,
  error,
  onChange,
}) => {
  const id = `pack-input-${input.key}`;
  const label = input.labelEn ?? input.label;
  const text = value === undefined ? "" : String(value);
  const counted = (input.type === "string" || input.type === "text") && input.maxLength;
  let control: React.ReactNode;
  switch (input.type) {
    case "text":
      control = (
        <Textarea
          id={id}
          rows={2}
          value={text}
          maxLength={input.maxLength}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-0 resize-none text-sm"
        />
      );
      break;
    case "list":
      control = (
        <Textarea
          id={id}
          rows={Math.min(6, Math.max(2, input.maxItems ?? 3))}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="One per line"
          className="min-h-0 resize-none text-sm"
        />
      );
      break;
    case "number":
      control = (
        <Input
          id={id}
          type="number"
          min={input.min}
          max={input.max}
          value={text}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-8 text-sm"
        />
      );
      break;
    case "boolean":
      control = <Switch id={id} checked={value === true} onCheckedChange={(on) => onChange(on)} />;
      break;
    case "color":
      control = (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={label}
            value={/^#[0-9a-f]{6}$/i.test(text) ? text : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
          />
          <Input id={id} value={text} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-sm" />
        </div>
      );
      break;
    case "enum":
      control = (
        <NativeSelect id={id} value={text} onChange={(e) => onChange(e.target.value)} className="w-full">
          {(input.options ?? []).map((o) => (
            <NativeSelectOption key={o} value={o}>
              {o}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      );
      break;
    default:
      control = (
        <Input id={id} value={text} maxLength={input.maxLength} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      );
  }
  return (
    <Field data-invalid={error ? true : undefined} className="gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={id} className="text-xs">
          {label}
          {input.required ? <span className="text-muted-foreground">*</span> : null}
        </FieldLabel>
        {counted ? (
          <span className="tabular font-mono text-[10px] text-muted-foreground">
            {text.length}/{input.maxLength}
          </span>
        ) : input.type === "list" && input.maxItems ? (
          <span className="text-[10px] text-muted-foreground">up to {input.maxItems}</span>
        ) : null}
      </div>
      {control}
      {input.help ? <FieldDescription className="text-[11px]">{input.help}</FieldDescription> : null}
      {error ? <FieldError className="text-[11px]">{error}</FieldError> : null}
    </Field>
  );
};
