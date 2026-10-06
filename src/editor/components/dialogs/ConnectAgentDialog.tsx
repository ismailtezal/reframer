"use client";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAgentStore } from "../../store/agent-store";

type Client = "claude" | "codex" | "cursor" | "other";

const CLIENTS: { id: Client; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "cursor", label: "Cursor" },
  { id: "other", label: "Other MCP" },
];

const snippetsFor = (client: Client, url: string, token: string): { title: string; code: string }[] => {
  switch (client) {
    case "claude":
      return [
        {
          title: "Run once in a terminal",
          code: `claude mcp add --transport http reframer ${url} --header "Authorization: Bearer ${token}"`,
        },
      ];
    case "codex":
      return [
        {
          title: "Add to ~/.codex/config.toml",
          code: `[mcp_servers.reframer]\nurl = "${url}"\nbearer_token_env_var = "REFRAMER_MCP_TOKEN"`,
        },
        { title: "Set the token (Windows)", code: `setx REFRAMER_MCP_TOKEN ${token}` },
        { title: "Set the token (macOS / Linux)", code: `export REFRAMER_MCP_TOKEN=${token}` },
      ];
    case "cursor":
      return [
        {
          title: "Add to .cursor/mcp.json",
          code: JSON.stringify({ mcpServers: { reframer: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
        },
      ];
    default:
      return [
        { title: "Streamable HTTP endpoint", code: url },
        { title: "Header", code: `Authorization: Bearer ${token}` },
      ];
  }
};

const CodeBlock: React.FC<{ title: string; code: string; display: string }> = ({ title, code, display }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="group relative rounded-md border border-border bg-background">
        <pre className="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all">
          {display}
        </pre>
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1.5 right-1.5 text-muted-foreground"
          aria-label="Copy"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  );
};

/** How to drive this editor from an external coding agent over MCP. */
export const ConnectAgentDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const [client, setClient] = useState<Client>("claude");
  const [token, setToken] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const connected = useAgentStore((s) => s.connected);
  const live = Object.entries(connected).filter(([, at]) => Date.now() - at < 60_000);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp`;

  useEffect(() => {
    if (!open) return;
    void fetch("/api/settings")
      .then((r) => r.json() as Promise<{ mcpToken: string }>)
      .then((s) => setToken(s.mcpToken));
  }, [open]);

  const regenerate = async () => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateMcpToken: true }),
    });
    const s = (await res.json()) as { mcpToken: string };
    setToken(s.mcpToken);
    toast.success("New token created. Agents using the old one are disconnected.");
  };

  const masked = token ? `${token.slice(0, 4)}${"•".repeat(12)}` : "…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect an agent</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Drive this editor from Claude Code, Codex, Cursor or any MCP client. Every edit happens live in this window, and you can take
            over anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-0.5 rounded-md bg-foreground/[0.04] p-0.5" role="tablist">
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={client === c.id}
              onClick={() => setClient(c.id)}
              className={cn(
                "h-7 flex-1 rounded-[5px] text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground",
                client === c.id && "bg-raised text-foreground shadow-sm",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {token
            ? snippetsFor(client, url, token).map((s) => (
                <CodeBlock key={s.title} title={s.title} code={s.code} display={reveal ? s.code : s.code.split(token).join(masked)} />
              ))
            : null}
        </div>

        <div className="flex items-center gap-1 border-t border-border pt-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setReveal(!reveal)}>
            {reveal ? <EyeOffIcon /> : <EyeIcon />} {reveal ? "Hide token" : "Show token"}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => void regenerate()}>
            <RefreshCwIcon /> New token
          </Button>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", live.length ? "bg-emerald-400" : "bg-foreground/25")} />
            {live.length ? `Connected: ${live.map(([n]) => n).join(", ")}` : "No agent connected yet"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
