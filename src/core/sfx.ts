/**
 * Built-in sound effects. Every file is synthesized from scratch by
 * `scripts/generate-sfx.mjs` (no samples, no third-party audio) into
 * `public/sfx/<id>.wav`: 16-bit PCM, mono, 48 kHz, peak -1 dBFS. The sounds are
 * dedicated to the public domain under CC0 1.0.
 *
 * `durationSec` is measured from the generated files. If you change a recipe's
 * length, re-run the script and update it here.
 */
export type SfxEntry = {
  id: string;
  name: string;
  category: "transition" | "ui" | "impact" | "riser" | "foley" | "cartoon";
  durationSec: number;
  /** Public URL of the WAV file. */
  src: string;
  /** Search keywords: synonyms and typical uses. */
  tags: string[];
  /** What it sounds like and where it fits; timed sounds say where their peak is. */
  description: string;
};

const sfx = (entry: Omit<SfxEntry, "src">): SfxEntry => ({
  ...entry,
  src: `/sfx/${entry.id}.wav`,
});

export const SFX_LIBRARY: SfxEntry[] = [
  // Transitions
  sfx({
    id: "whoosh",
    name: "Whoosh",
    category: "transition",
    durationSec: 0.702,
    tags: ["air", "swish", "pass-by", "movement", "slide", "transition"],
    description:
      "Airy filtered-noise pass-by that swells to a peak about 0.45 s in. Put the peak on the cut for slides, pans and element moves.",
  }),
  sfx({
    id: "whoosh-fast",
    name: "Fast whoosh",
    category: "transition",
    durationSec: 0.352,
    tags: ["air", "quick", "swipe", "zip", "transition"],
    description: "Quick, tight air whoosh peaking at about 0.19 s. For snappy cuts, swipes and fast element entrances.",
  }),
  sfx({
    id: "swoosh",
    name: "Swoosh",
    category: "transition",
    durationSec: 0.402,
    tags: ["bright", "swish", "swipe", "motion graphics", "transition"],
    description: "Bright, slightly tonal swish peaking at about 0.17 s. Suits motion-graphics moves, text fly-ins and logo swipes.",
  }),
  sfx({
    id: "whip",
    name: "Whip pan",
    category: "transition",
    durationSec: 0.242,
    tags: ["whip pan", "swish", "fast", "camera move", "transition"],
    description: "Very fast whip-pan swish centered at about 0.12 s. Put the center on the cut of a whip-pan or smash transition.",
  }),
  sfx({
    id: "glitch",
    name: "Glitch",
    category: "transition",
    durationSec: 0.602,
    tags: ["digital", "stutter", "bitcrush", "error", "data", "cyber"],
    description:
      "Choppy digital stutter: bitcrushed buzzes, crunchy noise, data chirps and buffer-repeat rolls. For glitch transitions, UI errors and tech reveals.",
  }),
  sfx({
    id: "static",
    name: "TV static",
    category: "transition",
    durationSec: 0.702,
    tags: ["tv", "noise", "interference", "snow", "signal", "channel change"],
    description:
      "Burst of analog TV snow with crackle that snaps on and cuts out cleanly. For channel-change cuts, signal loss and VHS or retro looks.",
  }),

  // Risers
  sfx({
    id: "riser",
    name: "Riser",
    category: "riser",
    durationSec: 2.002,
    tags: ["build", "tension", "sweep up", "uplifter", "trailer", "drop"],
    description:
      "2 s tension build: a noise sweep and detuned saws gliding up three octaves with an accelerating pulse. It peaks on its last frame, so end it on the cut or drop.",
  }),
  sfx({
    id: "riser-short",
    name: "Short riser",
    category: "riser",
    durationSec: 1.002,
    tags: ["build", "tension", "sweep up", "uplifter", "quick"],
    description: "1 s riser (two octaves, faster pulse) that peaks on its last frame. For quick builds into a reveal or punch-in.",
  }),

  // UI
  sfx({
    id: "pop",
    name: "Pop",
    category: "ui",
    durationSec: 0.162,
    tags: ["bubble", "blip", "appear", "notification", "emphasis"],
    description: "Bubbly pitch-drop blip. For elements, emoji and captions popping in, or a playful emphasis.",
  }),
  sfx({
    id: "click",
    name: "Click",
    category: "ui",
    durationSec: 0.052,
    tags: ["button", "mouse", "tap", "select", "interface"],
    description: "Crisp, short UI click. For cursor clicks, button presses and selections in screen recordings and UI animations.",
  }),
  sfx({
    id: "tick",
    name: "Tick",
    category: "ui",
    durationSec: 0.072,
    tags: ["clock", "timer", "countdown", "soft", "list"],
    description: "Soft clock tick with a small metallic ring. For countdowns, timers, counters and items ticking into a list.",
  }),
  sfx({
    id: "tap",
    name: "Tap",
    category: "ui",
    durationSec: 0.092,
    tags: ["touch", "finger", "soft", "screen", "phone"],
    description: "Soft fingertip tap with a gentle low thump. For touchscreen taps and subtle, low-key UI feedback.",
  }),
  sfx({
    id: "switch",
    name: "Switch",
    category: "ui",
    durationSec: 0.102,
    tags: ["toggle", "light switch", "mechanical", "on off", "click"],
    description: "Two-stage mechanical toggle click. For switches, toggles, mode changes and before/after flips.",
  }),
  sfx({
    id: "ding",
    name: "Ding",
    category: "ui",
    durationSec: 1.452,
    tags: ["bell", "notification", "correct", "success", "alert"],
    description:
      "Clean bell strike (C6) with a long, shimmering decay. For correct answers, completed tasks, highlights and notifications.",
  }),
  sfx({
    id: "chime",
    name: "Chime",
    category: "ui",
    durationSec: 1.302,
    tags: ["notification", "two-tone", "success", "message", "pleasant"],
    description: "Pleasant two-note rising chime (A5 to E6). For notifications, messages, achievements and positive reveals.",
  }),
  sfx({
    id: "sparkle",
    name: "Sparkle",
    category: "ui",
    durationSec: 1.002,
    tags: ["magic", "shimmer", "twinkle", "reveal", "glitter"],
    description:
      "Shimmering high bell arpeggio with a glittery echo tail. For magic moments, product reveals, shine effects and highlights.",
  }),

  // Impacts
  sfx({
    id: "impact",
    name: "Impact",
    category: "impact",
    durationSec: 1.402,
    tags: ["hit", "cinematic", "trailer", "slam", "punch"],
    description:
      "Cinematic hit: a sub drop, chest punch and bright crack with a dark rumble tail. Lands on its first frame; for title slams, logo hits and big reveals.",
  }),
  sfx({
    id: "boom",
    name: "Boom",
    category: "impact",
    durationSec: 1.452,
    tags: ["explosion", "deep", "low", "rumble", "trailer"],
    description: "Deep, round boom with a slow rumble tail. For heavy reveals, explosions and dramatic beats; best on full-range speakers.",
  }),
  sfx({
    id: "sub-drop",
    name: "Sub drop",
    category: "impact",
    durationSec: 1.302,
    tags: ["sub", "bass", "drop", "low end", "808", "transition"],
    description:
      "Pure sine glide from 70 Hz down to 28 Hz. Adds weight under cuts, title cards and beat drops; felt more than heard on small speakers.",
  }),
  sfx({
    id: "bass-hit",
    name: "Bass hit",
    category: "impact",
    durationSec: 0.852,
    tags: ["808", "kick", "punch", "bass", "beat drop"],
    description: "Punchy 808-style bass hit with a fast pitch snap and saturated growl. For beat-synced cuts, text slams and drops.",
  }),
  sfx({
    id: "braam",
    name: "Braam",
    category: "impact",
    durationSec: 1.452,
    tags: ["brass", "horn", "trailer", "dark", "cinematic", "tension"],
    description:
      "Short, dark, detuned brass-like swell that peaks at about 0.2 s. For trailer-style title cards, ominous reveals and dramatic tension.",
  }),
  sfx({
    id: "vine-boom",
    name: "Emphasis boom",
    category: "impact",
    durationSec: 1.302,
    tags: ["meme", "emphasis", "comedy", "punchline", "reaction", "boom"],
    description:
      "Deep, punchy meme-style emphasis boom: a drum-like hit with a fast pitch drop, light saturation and a short, dark room tail. Lands on its first frame (peak within 3 ms); put it on a punchline, reaction shot or dramatic zoom.",
  }),

  // Foley
  sfx({
    id: "typewriter",
    name: "Typewriter key",
    category: "foley",
    durationSec: 0.172,
    tags: ["key", "typing", "retro", "mechanical", "text"],
    description:
      "Single typewriter key strike: key thock, metal typebar slap and carriage tick. Use one per character for typewriter text.",
  }),
  sfx({
    id: "typing",
    name: "Keyboard typing",
    category: "foley",
    durationSec: 0.748,
    tags: ["keyboard", "keys", "computer", "typing", "office"],
    description:
      "Short burst of seven modern keyboard keystrokes at a natural pace, including a spacebar. For typing on screen, search bars and chat UIs.",
  }),
  sfx({
    id: "shutter",
    name: "Camera shutter",
    category: "foley",
    durationSec: 0.252,
    tags: ["camera", "photo", "snapshot", "screenshot", "dslr"],
    description:
      "DSLR-style double-click shutter, open and close about 85 ms apart. For photo moments, screenshots, freeze frames and flashes.",
  }),
  sfx({
    id: "cash",
    name: "Cash register",
    category: "foley",
    durationSec: 1.202,
    tags: ["money", "ka-ching", "sale", "price", "payment"],
    description:
      "Cash-register ka-ching: mechanical clicks, a bright bell and a few coin pings. For prices, sales, revenue numbers and money moments.",
  }),
  sfx({
    id: "paper",
    name: "Paper slide",
    category: "foley",
    durationSec: 0.422,
    tags: ["paper", "sheet", "rustle", "slide", "document", "page"],
    description:
      "Short paper foley: a sheet sliding across a desk with a little rustle, swelling to a peak at about 0.15 s. For cards, notes and documents sliding in, page flips and paper-style UI.",
  }),

  // Cartoon
  sfx({
    id: "record-scratch",
    name: "Record scratch",
    category: "cartoon",
    durationSec: 0.442,
    tags: ["vinyl", "dj", "stop", "rewind", "comedy", "meme"],
    description: "DJ vinyl scratch, a fast push and pull back. For a comedic stop, a 'wait, what?' moment or a rewind.",
  }),
  sfx({
    id: "boing",
    name: "Boing",
    category: "cartoon",
    durationSec: 0.902,
    tags: ["spring", "bounce", "jump", "comedy", "wobble"],
    description: "Cartoon spring boing with a wobbling, settling pitch. For bounces, jumps, wobbly elements and playful comedic beats.",
  }),
  sfx({
    id: "slide-whistle-up",
    name: "Slide whistle up",
    category: "cartoon",
    durationSec: 0.702,
    tags: ["whistle", "rise", "jump", "comedy", "ascend"],
    description: "Breathy cartoon slide whistle rising from 520 Hz to 1.76 kHz. For things flying up, comedic jumps and rising numbers.",
  }),
];

export const getSfx = (id: string) => SFX_LIBRARY.find((entry) => entry.id === id);
