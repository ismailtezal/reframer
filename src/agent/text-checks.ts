import type { LintIssue } from "@/core/lint";
import type { Clip, Project } from "@/core/schema";
import { getMotionComponent } from "@/remotion/components/registry";

/**
 * Words on screen that went wrong before they were drawn: text that arrived through a broken encoding
 * ("BugÃ¼n" for "Bugün", "?" boxes for letters), and components still showing their sample copy
 * ("happy users" under a counter nobody labelled).
 */

// UTF-8 read as a Windows code page: Ã, Ä or Å followed by what a continuation byte decodes to there.
const MOJIBAKE = /�|[ÃÄÅ][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/;

const r1 = (n: number) => Math.round(n * 10) / 10;
const short = (text: string) => (text.length > 40 ? `${text.slice(0, 38)}…` : text);

/** The strings a clip shows, with where they live (for the message). */
const textsOf = (clip: Clip): { where: string; text: string }[] => {
  if (clip.type === "text") return [{ where: "text", text: clip.text }];
  if (clip.type === "captions") return [{ where: "captions", text: clip.words.map((w) => w.text).join("") }];
  if (clip.type !== "component") return [];
  const out: { where: string; text: string }[] = [];
  const walk = (v: unknown, where: string) => {
    if (typeof v === "string") out.push({ where, text: v });
    else if (Array.isArray(v)) for (const [i, x] of v.entries()) walk(x, `${where}[${i}]`);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, where ? `${where}.${k}` : k);
  };
  walk(clip.props, "");
  return out;
};

export const lintText = (project: Project): LintIssue[] => {
  const fps = project.settings.fps;
  const issues: LintIssue[] = [];
  for (const clip of Object.values(project.clips)) {
    if (clip.hidden) continue;
    const timeSec = r1(clip.start / fps);
    const broken = textsOf(clip).find((t) => MOJIBAKE.test(t.text));
    if (broken)
      issues.push({
        severity: "error",
        code: "broken-encoding",
        clipId: clip.id,
        timeSec,
        message: `"${short(broken.text)}" (${broken.where}) has letters mangled by a wrong text encoding. Re-enter it, and save edit files as UTF-8.`,
      });
    if (clip.type !== "component") continue;
    const isCode = clip.component.startsWith("code:");
    const schema = isCode ? project.components?.[clip.component.slice(5)]?.propsSchema : getMotionComponent(clip.component)?.schema;
    if (!schema) continue;
    const name = clip.name ?? (isCode ? project.components?.[clip.component.slice(5)]?.name : getMotionComponent(clip.component)?.name);
    for (const [key, field] of Object.entries(schema as Record<string, { type: string; default?: unknown }>)) {
      if (field.type !== "string" && field.type !== "text") continue;
      const sample = field.default;
      if (typeof sample !== "string" || !/\p{L}{3,}/u.test(sample)) continue;
      const value = clip.props[key] ?? sample;
      if (value !== sample) continue;
      issues.push({
        severity: "warning",
        code: "sample-text",
        clipId: clip.id,
        timeSec,
        message: `${name ?? clip.component} still shows its sample text "${short(sample)}" (${key}). Write the real copy, or set it to "" to hide it.`,
      });
    }
  }
  return issues;
};
