import { type Actor, assertClipEditable, EditError } from "../ops";
import { getClipEnd, getPreviousAdjacentClip, getTrack } from "../project-utils";
import type { Clip, Effect, Project } from "../schema";
import type { StyleDNA, TypeRole } from "./schema";

export type StylePart = "grade" | "typography" | "captions" | "motion" | "transitions";

export type ApplyStyleOptions = {
  parts?: StylePart[];
  clipIds?: string[];
  actor?: Actor;
  force?: boolean;
};

export type ApplyStyleResult = {
  styleId: string;
  changed: Record<StylePart, number>;
  skipped: { id: string; reason: string }[];
  /** Creative direction the deterministic engine can't apply (for the agent / UI). */
  direction: {
    pacing: string;
    hook: string;
    ending: string;
    sound: string;
    signature: string[];
    avoid: string[];
    notes?: string;
  };
};

const STYLE_FX = new Set(["style-grade", "style-vignette", "style-grain", "style-ca", "style-glow"]);

const gradeEffects = (dna: StyleDNA): Effect[] => {
  const g = dna.grade;
  const out: Effect[] = [
    {
      id: "style-grade",
      type: "grade",
      exposure: g.exposure,
      contrast: g.contrast,
      saturation: g.saturation,
      vibrance: g.vibrance,
      temperature: g.temperature,
      tint: g.tint,
      highlights: g.highlights,
      shadows: g.shadows,
      fade: g.fade,
      lut: g.lut,
      lutIntensity: g.lut ? 0.8 : undefined,
    },
  ];
  if (g.vignette > 0.02) out.push({ id: "style-vignette", type: "vignette", amount: g.vignette });
  if (g.grain > 0.02) out.push({ id: "style-grain", type: "grain", amount: Math.min(1, g.grain) });
  if (g.chromaticAberration && g.chromaticAberration > 0.2) {
    out.push({ id: "style-ca", type: "chromatic-aberration", amount: g.chromaticAberration });
  }
  if (g.glow && g.glow > 0.05) out.push({ id: "style-glow", type: "glow", radius: 30, intensity: g.glow, threshold: 0.7 });
  return out;
};

const roleStyle = (role: TypeRole, H: number) => ({
  fontFamily: role.fontFamily,
  fontWeight: role.fontWeight,
  textTransform: role.textTransform,
  letterSpacing: role.letterSpacing,
  lineHeight: role.lineHeight,
  color: role.color,
  italic: role.italic,
  fontSize: Math.round((role.sizePctH / 100) * H),
  stroke: role.stroke,
  shadow: role.shadow,
  gradient: role.gradient
    ? {
        type: "linear" as const,
        angle: 100,
        stops: role.gradient.map((color, i, arr) => ({ color, pos: arr.length === 1 ? 0 : i / (arr.length - 1) })),
      }
    : undefined,
});

const isTitle = (clip: Extract<Clip, { type: "text" }>, H: number) =>
  clip.style.fontSize >= H * 0.055 || (clip.text.length <= 40 && clip.style.fontSize >= H * 0.045);

const fpsScale = (frames30: number, fps: number) => Math.max(1, Math.round((frames30 * fps) / 30));

/**
 * Applies the deterministic parts of a Style DNA to a draft project.
 * Respects locks and (for agents) hand-edited clips.
 */
export const applyStyleDNA = (draft: Project, dna: StyleDNA, opts: ApplyStyleOptions = {}): ApplyStyleResult => {
  const parts = new Set<StylePart>(opts.parts ?? ["grade", "typography", "captions", "motion", "transitions"]);
  const { width: W, height: H, fps } = draft.settings;
  const unit = Math.min(W, H) / 1080;
  const changed: Record<StylePart, number> = { grade: 0, typography: 0, captions: 0, motion: 0, transitions: 0 };
  const skipped: { id: string; reason: string }[] = [];
  const scope = opts.clipIds ? new Set(opts.clipIds) : null;

  const editable = (clip: Clip) => {
    try {
      assertClipEditable(draft, clip, { actor: opts.actor, force: opts.force });
      return true;
    } catch (err) {
      if (err instanceof EditError) skipped.push({ id: clip.id, reason: err.message });
      return false;
    }
  };

  const clips = Object.values(draft.clips).filter((c) => (!scope || scope.has(c.id)) && editable(c));

  for (const clip of clips) {
    // --- Grade (footage only) ---------------------------------------------
    if (parts.has("grade") && (clip.type === "video" || clip.type === "image")) {
      const kept = (clip.effects ?? []).filter((e) => !STYLE_FX.has(e.id) && e.type !== "grade");
      clip.effects = [...gradeEffects(dna), ...kept];
      changed.grade++;
    }

    // --- Typography ---------------------------------------------------------
    if (parts.has("typography") && clip.type === "text") {
      const role = isTitle(clip, H) ? dna.typography.title : (dna.typography.callout ?? dna.typography.body);
      const next = roleStyle(role, H);
      const isTitleRole = role === dna.typography.title;
      clip.style = {
        ...clip.style,
        fontFamily: next.fontFamily,
        fontWeight: next.fontWeight,
        textTransform: next.textTransform,
        letterSpacing: next.letterSpacing,
        lineHeight: next.lineHeight ?? clip.style.lineHeight,
        color: next.color,
        italic: next.italic,
        // Titles adopt the style's scale; body text keeps its size so layouts hold.
        fontSize: isTitleRole ? next.fontSize : clip.style.fontSize,
        stroke: next.stroke ? { ...next.stroke, width: next.stroke.width * unit } : undefined,
        shadow: next.shadow,
        gradient: isTitleRole ? next.gradient : undefined,
      };
      changed.typography++;
    }
    if (parts.has("typography") && clip.type === "component") {
      const p = clip.props;
      if ("fontFamily" in p || clip.component === "kinetic-title" || clip.component === "counter") {
        p.fontFamily = dna.typography.title.fontFamily;
        if ("fontWeight" in p || clip.component === "kinetic-title") p.fontWeight = dna.typography.title.fontWeight;
      }
      if (dna.palette.accents[0] && ("accentColor" in p || clip.component === "kinetic-title")) p.accentColor = dna.palette.accents[0];
      if (dna.palette.accents[1] && "accentColor2" in p) p.accentColor2 = dna.palette.accents[1];
      changed.typography++;
    }

    // --- Captions -------------------------------------------------------------
    if (parts.has("captions") && clip.type === "captions" && dna.captions.mode !== "none") {
      const s = dna.captions.style;
      clip.style = {
        ...clip.style,
        ...s,
        preset: dna.id,
        fontSize: s.fontSize ? Math.round(s.fontSize * unit) : clip.style.fontSize,
        stroke: s.stroke
          ? { ...s.stroke, width: Math.max(1, Math.round(s.stroke.width * unit)) }
          : s.stroke === undefined
            ? clip.style.stroke
            : undefined,
      };
      clip.transform.y = Math.round(dna.captions.yPct * H);
      changed.captions++;
    }

    // --- Motion ---------------------------------------------------------------
    if (parts.has("motion")) {
      const m = dna.motion;
      if (clip.type === "text" || clip.type === "shape" || (clip.type === "component" && clip.transform.width < W * 0.98)) {
        clip.animations = {
          ...clip.animations,
          in: { type: m.enter, duration: Math.round(fps * 0.55), easing: m.easing },
          out: { type: m.exit, duration: Math.round(fps * 0.35), easing: "ease-in" },
        };
        changed.motion++;
      }
      if (clip.type === "text" && m.textAnimation !== "none") {
        clip.textAnimation = {
          type: m.textAnimation,
          unit: m.textUnit,
          stagger: Math.max(0, Math.round((m.stagger * fps) / 30)),
          duration: m.textAnimation === "typewriter" ? 1 : Math.round(fps * 0.6),
          easing: m.easing,
        };
      }
      if (clip.type === "image" && m.kenBurns) {
        clip.animations = { ...clip.animations, loop: { type: "ken-burns", intensity: 1 } };
        changed.motion++;
      }
    }
  }

  // --- Transitions (cuts between adjacent clips on visual tracks) -------------
  if (parts.has("transitions")) {
    const t = dna.transitions;
    const cuts = clips
      .filter((c) => c.type !== "audio" && c.type !== "captions" && getTrack(draft, c.trackId)?.kind === "visual")
      .filter((c) => !!getPreviousAdjacentClip(draft, c))
      .sort((a, b) => a.start - b.start);
    const types = t.primary === "cut" ? [] : [t.primary, ...t.secondary];
    cuts.forEach((clip, i) => {
      if (types.length === 0) {
        if (clip.transitionIn) {
          delete clip.transitionIn;
          changed.transitions++;
        }
        return;
      }
      // Deterministic spread: every k-th cut gets a transition.
      const every = t.frequency >= 1 ? 1 : Math.max(1, Math.round(1 / Math.max(0.05, t.frequency)));
      if (i % every !== 0) {
        if (clip.transitionIn) delete clip.transitionIn;
        return;
      }
      const type = types[(i / every) % types.length] ?? types[0];
      clip.transitionIn = {
        type,
        duration: Math.min(clip.duration, fpsScale(t.durationFrames, fps)),
        direction: type === "slide" || type === "push" || type === "whip" || type === "wipe" ? "left" : undefined,
        easing: dna.motion.easing,
      };
      changed.transitions++;
    });
  }

  if (!opts.clipIds) {
    draft.styleId = dna.id;
    if (dna.palette.background && Object.values(draft.clips).every((c) => c.type !== "background")) {
      draft.settings.backgroundColor = dna.palette.background;
    }
  }
  draft.updatedAt = Date.now();

  return {
    styleId: dna.id,
    changed,
    skipped,
    direction: {
      pacing: `Average shot ~${dna.pacing.aslSec}s, ${dna.pacing.cutStyle} cuts, beat sync: ${dna.pacing.beatSync}${dna.pacing.punchIn ? `, punch-ins ${dna.pacing.punchIn.scale}x ~${dna.pacing.punchIn.perMin}/min` : ""}.`,
      hook: dna.pacing.hook,
      ending: dna.pacing.ending,
      sound: `${dna.sound.music}; ${dna.sound.bpm[0]}–${dna.sound.bpm[1]} BPM; SFX ~${dna.sound.sfxPerMin}/min (${dna.sound.sfx.join(", ")}); duck music ${dna.sound.duckDb} dB under voice.`,
      signature: dna.signature,
      avoid: dna.avoid,
      notes: dna.agentNotes,
    },
  };
};

/** Clip ids that would be affected (for previews / confirmations). */
export const styleTargets = (project: Project) =>
  Object.values(project.clips)
    .filter((c) => getClipEnd(c) > 0)
    .map((c) => c.id);
