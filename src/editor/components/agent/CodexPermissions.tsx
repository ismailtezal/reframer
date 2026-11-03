"use client";

import { ChevronDownIcon, ShieldIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CODEX_PERMISSIONS, type CodexPermission, DEFAULT_CODEX_PERMISSION, isCodexPermission } from "@/core/codex-permissions";
import { useModelStore } from "./models";

export const CodexPermissions: React.FC<{ disabled?: boolean; value?: CodexPermission; onSaved?: () => void }> = ({
  disabled,
  value,
  onSaved,
}) => {
  const stored = useModelStore((s) => s.harnesses?.codex.permissions);
  const permission = value ?? stored ?? DEFAULT_CODEX_PERMISSION;
  const [saving, setSaving] = useState(false);
  const current = CODEX_PERMISSIONS.find((option) => option.id === permission) ?? CODEX_PERMISSIONS[1];

  const save = async (next: string) => {
    if (!isCodexPermission(next) || next === permission || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ harnesses: { codex: { permissions: next } } }),
      });
      if (!response.ok) throw new Error("Couldn't save Codex permissions.");
      useModelStore.setState((state) => ({
        harnesses: state.harnesses ? { ...state.harnesses, codex: { ...state.harnesses.codex, permissions: next } } : null,
      }));
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save Codex permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || saving}
          className="h-7 min-w-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label={`Codex permissions: ${current.label}`}
        >
          <ShieldIcon className="size-3.5 shrink-0" />
          <span className="truncate">{saving ? "Saving…" : current.label}</span>
          <ChevronDownIcon className="size-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel>Codex permissions</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={permission} onValueChange={(next) => void save(next)}>
          {CODEX_PERMISSIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id} className="items-start py-2">
              <div className="space-y-0.5">
                <div className="text-xs">
                  {option.label}
                  {option.id === "edit" ? " · default" : ""}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{option.description}</p>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Applies to Codex's next message.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
