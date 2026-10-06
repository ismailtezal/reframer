"use client";

import { CheckIcon, CpuIcon, ExternalLinkIcon, KeyRoundIcon, LoaderCircleIcon, PlugIcon, RefreshCwIcon, TerminalIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "../agent/AgentPanel";
import { useModelStore } from "../agent/models";

type ProviderStatus = { id: string; configured: boolean; source: "settings" | "env" | null; masked: string | null };
type Endpoint = { id: string; name: string; baseURL: string; apiKey?: string; models: string[] };
type PublicSettings = {
  providers: ProviderStatus[];
  custom: Endpoint[];
  defaultModel?: string;
  integrations: Record<string, string | null>;
  transcription: "local" | "openai" | "groq" | "elevenlabs";
  harnesses: { claudeCode: { enabled: boolean; executable?: string }; codex: { enabled: boolean; executable?: string } };
  mcpToken: string;
  remotionLicenseKey: string | null;
};

const PROVIDERS: Record<string, { name: string; url: string; hint: string }> = {
  anthropic: { name: "Anthropic", url: "https://console.anthropic.com/settings/keys", hint: "Claude models" },
  openai: { name: "OpenAI", url: "https://platform.openai.com/api-keys", hint: "GPT models, transcription, voice" },
  google: { name: "Google", url: "https://aistudio.google.com/apikey", hint: "Gemini models" },
  xai: { name: "xAI", url: "https://console.x.ai", hint: "Grok models" },
  mistral: { name: "Mistral", url: "https://console.mistral.ai/api-keys", hint: "Mistral models" },
  groq: { name: "Groq", url: "https://console.groq.com/keys", hint: "Fast open models, transcription" },
  deepseek: { name: "DeepSeek", url: "https://platform.deepseek.com/api_keys", hint: "DeepSeek models" },
  openrouter: { name: "OpenRouter", url: "https://openrouter.ai/keys", hint: "Hundreds of models with one key" },
  gateway: { name: "Vercel AI Gateway", url: "https://vercel.com/ai-gateway", hint: "Many providers, one key" },
};

const NAV: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "keys", label: "Model keys", icon: KeyRoundIcon },
  { id: "local", label: "Local models", icon: CpuIcon },
  { id: "agents", label: "Claude Code & Codex", icon: TerminalIcon },
  { id: "integrations", label: "Media services", icon: PlugIcon },
];

const put = async (patch: Record<string, unknown>): Promise<PublicSettings> => {
  const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Couldn't save settings");
  return (await res.json()) as PublicSettings;
};

const SectionHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-4 space-y-1">
    <h3 className="text-sm font-semibold">{title}</h3>
    {children ? <p className="text-xs leading-relaxed text-muted-foreground">{children}</p> : null}
  </div>
);

const KeyRow: React.FC<{
  label: string;
  hint: string;
  url?: string;
  status: { configured: boolean; source: "settings" | "env" | null; masked: string | null };
  onSave: (value: string | null) => Promise<void>;
}> = ({ label, hint, url, status, onSave }) => {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (v: string | null) => {
    setSaving(true);
    try {
      await onSave(v);
      setValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid grid-cols-[132px_1fr] items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {label}
          {status.configured ? <CheckIcon className="size-3 text-emerald-400" aria-label="Connected" /> : null}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) void save(value.trim());
        }}
      >
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={status.source === "env" ? "Set by environment variable" : (status.masked ?? "Paste API key")}
          autoComplete="off"
          spellCheck={false}
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          onKeyDown={(e) => e.stopPropagation()}
        />
        {value.trim() ? (
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <LoaderCircleIcon className="animate-spin" /> : "Save"}
          </Button>
        ) : status.source === "settings" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => void save(null)}
            disabled={saving}
          >
            Remove
          </Button>
        ) : url ? (
          <Button type="button" size="sm" variant="ghost" className="gap-1 text-muted-foreground" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              Get key <ExternalLinkIcon className="size-3" />
            </a>
          </Button>
        ) : null}
      </form>
    </div>
  );
};

export const SettingsDialog: React.FC<{ open: boolean; section?: SettingsSection; onOpenChange: (o: boolean) => void }> = ({
  open,
  section = "keys",
  onOpenChange,
}) => {
  const [tab, setTab] = useState<SettingsSection>(section);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [detected, setDetected] = useState<{ claudeCode: string | null; codex: string | null }>({ claudeCode: null, codex: null });
  const [probing, setProbing] = useState(false);

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([
      fetch("/api/settings").then((r) => r.json() as Promise<PublicSettings>),
      fetch("/api/models").then(
        (r) => r.json() as Promise<{ harnesses: { claudeCode: { detected: string | null }; codex: { detected: string | null } } }>,
      ),
    ]);
    setSettings(s);
    setDetected({ claudeCode: m.harnesses.claudeCode.detected, codex: m.harnesses.codex.detected });
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(section);
    void load();
  }, [open, section, load]);

  const apply = async (patch: Record<string, unknown>) => {
    const next = await put(patch);
    setSettings(next);
    await useModelStore.getState().refresh();
  };

  const probeLocal = async () => {
    setProbing(true);
    await useModelStore.getState().refresh();
    await load();
    setProbing(false);
  };

  const allModels = useModelStore((s) => s.models);
  const localModels = allModels.filter((m) => m.kind === "custom");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(600px,calc(100dvh-4rem))] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-border bg-panel p-2">
          <DialogTitle className="px-2 pt-1 pb-3 text-sm">Settings</DialogTitle>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.05] hover:text-foreground",
                tab === n.id && "bg-foreground/[0.07] text-foreground",
              )}
            >
              <n.icon className="size-3.5" />
              {n.label}
            </button>
          ))}
          <p className="mt-auto px-2 pb-1 text-[11px] leading-relaxed text-muted-foreground">
            Everything here is stored on this computer in <code className="font-mono">.reframer/settings.json</code>.
          </p>
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <DialogDescription className="sr-only">Models, API keys, local agents and media services</DialogDescription>
          {!settings ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "keys" ? (
            <section>
              <SectionHeader title="Model keys">
                Bring your own key for any provider. Keys go only to that provider. Models with tool use show up in the agent's model
                picker.
              </SectionHeader>
              <div>
                {settings.providers.map((p) => (
                  <KeyRow
                    key={p.id}
                    label={PROVIDERS[p.id]?.name ?? p.id}
                    hint={PROVIDERS[p.id]?.hint ?? ""}
                    url={PROVIDERS[p.id]?.url}
                    status={p}
                    onSave={async (value) => {
                      await apply({ keys: { [p.id]: value } });
                      toast.success(value ? `${PROVIDERS[p.id]?.name ?? p.id} connected` : "Key removed");
                    }}
                  />
                ))}
              </div>
            </section>
          ) : tab === "local" ? (
            <section className="space-y-4">
              <SectionHeader title="Local models">
                Models served on this machine by Ollama or LM Studio (any OpenAI-compatible server). Nothing leaves your computer. Pick a
                model with tool calling, such as Qwen 3 or Llama 3.3.
              </SectionHeader>
              {settings.custom.map((endpoint) => {
                const models = localModels.filter((m) => m.provider === `custom:${endpoint.id}`);
                return (
                  <div key={endpoint.id} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{endpoint.name}</span>
                      <span
                        className={cn(
                          "ml-auto rounded-sm px-1.5 py-0.5 text-[11px]",
                          models.length ? "bg-emerald-400/10 text-emerald-400" : "bg-foreground/[0.06] text-muted-foreground",
                        )}
                      >
                        {models.length ? `${models.length} model${models.length > 1 ? "s" : ""} found` : "Not running"}
                      </span>
                    </div>
                    <input
                      defaultValue={endpoint.baseURL}
                      onBlur={(e) => {
                        const baseURL = e.target.value.trim();
                        if (baseURL && baseURL !== endpoint.baseURL) {
                          void apply({ custom: settings.custom.map((c) => (c.id === endpoint.id ? { ...c, baseURL } : c)) });
                        }
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={`${endpoint.name} address`}
                      className="h-7 w-full rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                    {models.length ? (
                      <p className="truncate text-[11px] text-muted-foreground">{models.map((m) => m.id).join(" · ")}</p>
                    ) : null}
                  </div>
                );
              })}
              <Button variant="secondary" size="sm" onClick={() => void probeLocal()} disabled={probing} className="gap-1.5">
                <RefreshCwIcon className={cn(probing && "animate-spin")} /> Look for local models
              </Button>
            </section>
          ) : tab === "agents" ? (
            <section className="space-y-3">
              <SectionHeader title="Claude Code & Codex">
                Use the coding agents you already pay for. Reframer runs your own installed, unmodified CLI on this machine with your own
                login. It never reads or stores your credentials. These agents only get Reframer's editing tools, with no file or shell
                access.
              </SectionHeader>
              {(
                [
                  { key: "claudeCode", name: "Claude Code", login: "claude", install: "npm install -g @anthropic-ai/claude-code" },
                  { key: "codex", name: "Codex", login: "codex login", install: "npm install -g @openai/codex" },
                ] as const
              ).map((h) => {
                const conf = settings.harnesses[h.key];
                const found = detected[h.key];
                return (
                  <div key={h.key} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center gap-2">
                      <TerminalIcon className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{h.name}</span>
                      <Switch
                        className="ml-auto"
                        checked={conf.enabled}
                        onCheckedChange={(enabled) => void apply({ harnesses: { [h.key]: { enabled } } })}
                        aria-label={`Use ${h.name}`}
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {found ? (
                        <>
                          Found at <code className="font-mono text-foreground/80">{found}</code>. Not signed in? Run{" "}
                          <code className="font-mono text-foreground/80">{h.login}</code> in a terminal once.
                        </>
                      ) : (
                        <>
                          Not found on this machine. Install it with <code className="font-mono text-foreground/80">{h.install}</code>, then
                          sign in with <code className="font-mono text-foreground/80">{h.login}</code>.
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </section>
          ) : (
            <section className="space-y-4">
              <SectionHeader title="Media services">
                Optional services the agent can use for stock footage, voiceovers and generated images.
              </SectionHeader>
              <div>
                {(
                  [
                    { id: "pexels", name: "Pexels", hint: "Free stock video & photos", url: "https://www.pexels.com/api/" },
                    { id: "elevenlabs", name: "ElevenLabs", hint: "Voiceovers", url: "https://elevenlabs.io/app/settings/api-keys" },
                    { id: "fal", name: "fal", hint: "Image generation", url: "https://fal.ai/dashboard/keys" },
                  ] as const
                ).map((s) => {
                  const masked = settings.integrations[s.id] ?? null;
                  return (
                    <KeyRow
                      key={s.id}
                      label={s.name}
                      hint={s.hint}
                      url={s.url}
                      status={{ configured: !!masked, source: masked ? "settings" : null, masked }}
                      onSave={async (value) => {
                        await apply({ integrations: { [s.id]: value } });
                        toast.success(value ? `${s.name} connected` : "Key removed");
                      }}
                    />
                  );
                })}
              </div>
              <div>
                <KeyRow
                  label="Remotion license"
                  hint="Only for companies of 4+ people"
                  url="https://www.remotion.dev/license"
                  status={{
                    configured: !!settings.remotionLicenseKey,
                    source: settings.remotionLicenseKey ? "settings" : null,
                    masked: settings.remotionLicenseKey,
                  }}
                  onSave={async (value) => {
                    await apply({ remotionLicenseKey: value });
                    toast.success(value ? "License key saved" : "License key removed");
                  }}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium">Transcription</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "local", label: "On this computer", hint: "Whisper on your GPU, free and private" },
                      { id: "openai", label: "OpenAI", hint: "Uses your OpenAI key" },
                      { id: "groq", label: "Groq", hint: "Fast, uses your Groq key" },
                      { id: "elevenlabs", label: "ElevenLabs", hint: "Uses your ElevenLabs key" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => void apply({ transcription: o.id })}
                      className={cn(
                        "rounded-md border px-2.5 py-2 text-left transition-colors duration-150",
                        settings.transcription === o.id ? "border-brand/60 bg-brand-soft" : "border-border hover:bg-foreground/[0.03]",
                      )}
                    >
                      <span className="block text-xs font-medium">{o.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
