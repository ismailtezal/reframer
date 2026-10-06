"use client";

/**
 * Human-readable one-liners for agent tool calls ("Added title “Ship faster”
 * at 0:02"). Used in the chat's action cards, the activity feed, the status
 * chip and undo history.
 */

type AnyInput = Record<string, unknown> | undefined;

const t = (s: unknown) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return "";
  const m = Math.floor(n / 60);
  const sec = n - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
};

const quote = (s: unknown, max = 36) => {
  const v = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return v.length > max ? `“${v.slice(0, max - 1)}…”` : `“${v}”`;
};

const describeClipSpec = (c: Record<string, unknown>) => {
  switch (c.type) {
    case "text":
      return `text ${quote(c.text)}`;
    case "component":
      return String(c.component ?? "element")
        .replace(/^code:/, "")
        .replace(/-/g, " ");
    case "sfx":
      return `${String(c.sound ?? "sound")} sound`;
    case "background":
      return "background";
    case "shape":
      return String(c.shape ?? "shape");
    default:
      return String(c.type ?? "clip");
  }
};

export const describeToolCall = (name: string, input: unknown): string => {
  const i = (input ?? {}) as AnyInput & Record<string, unknown>;
  switch (name) {
    case "get_project":
      return "Read the timeline";
    case "get_clips":
      return "Inspected clips";
    case "set_plan":
      return "Made a plan";
    case "update_plan":
      return `Plan step ${Number(i.index) + 1} → ${String(i.status)}`;
    case "add_clips": {
      const clips = (i.clips as Record<string, unknown>[] | undefined) ?? [];
      if (clips.length === 1) return `Added ${describeClipSpec(clips[0])} at ${t(clips[0].startSec)}`;
      const kinds = [...new Set(clips.map((c) => String(c.type)))].join(", ");
      return `Added ${clips.length} clips (${kinds})`;
    }
    case "update_clips": {
      const updates = (i.updates as unknown[] | undefined) ?? [];
      return updates.length === 1 ? "Edited a clip" : `Edited ${updates.length} clips`;
    }
    case "delete_clips":
      return `Deleted ${(i.ids as unknown[] | undefined)?.length ?? 0} clip(s)${i.ripple ? " and closed the gap" : ""}`;
    case "split_clip":
      return `Split at ${t(i.atSec)}`;
    case "trim_clip":
      return "Trimmed a clip";
    case "ripple_delete_range":
      return `Cut ${t(i.startSec)}–${t(i.endSec)}`;
    case "set_keyframes":
      return `Animated ${String(i.property ?? "a property")}`;
    case "set_transition":
      return i.transition ? `Added a ${String((i.transition as Record<string, unknown>).type)} transition` : "Removed a transition";
    case "apply_style":
      return `Applied the ${String(i.styleId ?? "custom")} style`;
    case "list_styles":
      return "Browsed styles";
    case "get_style":
      return `Studied the ${String(i.styleId)} style`;
    case "list_components":
      return "Browsed components";
    case "create_component":
      return `Built a custom component ${quote(i.name, 28)}`;
    case "update_component":
      return "Updated a custom component";
    case "get_errors":
      return "Checked for errors";
    case "add_captions":
      return `Added ${String(i.preset ?? "")} captions`.replace("  ", " ");
    case "transcribe":
      return "Transcribed audio";
    case "remove_silences":
      return "Removed silences";
    case "remove_fillers":
      return "Removed filler words";
    case "detect_beats":
      return "Found the beat";
    case "add_markers":
      return "Added markers";
    case "set_canvas":
      return i.aspect ? `Switched to ${String(i.aspect)}` : "Changed the canvas";
    case "review_frames":
      return "Reviewed frames";
    case "seek":
      return `Moved the playhead to ${t(i.timeSec)}`;
    case "select_clips":
      return "Selected clips";
    case "ask_user":
      return `Asked: ${quote(i.question, 60)}`;
    case "import_media":
      return "Imported media";
    case "search_stock":
      return `Searched stock for ${quote(i.query, 30)}`;
    case "generate_image":
      return `Generated an image ${quote(i.prompt, 30)}`;
    case "generate_voiceover":
      return "Recorded a voiceover";
    case "set_brand":
      return "Set the brand kit";
    case "load_skill":
      return `Loaded the ${String(i.name)} playbook`;
    case "WebSearch":
      return `Searched the web for ${quote(i.query, 34)}`;
    case "WebFetch":
      return "Read a web page";
    default:
      return name.replace(/_/g, " ");
  }
};
