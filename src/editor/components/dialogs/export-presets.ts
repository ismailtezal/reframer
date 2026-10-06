"use client";

import { BUILTIN_PRESETS, type ExportPreset, type ExportSettings, normalizeExportSettings } from "@/core/export";

/** Saved custom presets and the last export's settings, kept per machine. */

const PRESETS_KEY = "reframer.export.presets";
const LAST_KEY = "reframer.export.last";

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: presets just won't persist.
  }
};

export const loadCustomPresets = (): ExportPreset[] =>
  read<ExportPreset[]>(PRESETS_KEY, [])
    .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
    .map((p) => ({ ...p, group: "Custom" as const, settings: normalizeExportSettings(p.settings) }));

export const saveCustomPresets = (presets: ExportPreset[]) => write(PRESETS_KEY, presets);

export const loadLastExport = (): { presetId: string; settings: ExportSettings } => {
  const last = read<{ presetId?: string; settings?: Partial<ExportSettings> } | null>(LAST_KEY, null);
  if (last?.settings) return { presetId: last.presetId ?? "", settings: normalizeExportSettings(last.settings) };
  return { presetId: BUILTIN_PRESETS[0].id, settings: BUILTIN_PRESETS[0].settings };
};

export const saveLastExport = (presetId: string, settings: ExportSettings) => write(LAST_KEY, { presetId, settings });
