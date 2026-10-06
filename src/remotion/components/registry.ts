import { arrowCallout } from "./annotation/ArrowCallout";
import { circleHighlight } from "./annotation/CircleHighlight";
import { cursorClick } from "./annotation/CursorClick";
import { highlighterSweep } from "./annotation/HighlighterSweep";
import { aurora } from "./backgrounds/Aurora";
import { glowOrbs } from "./backgrounds/GlowOrbs";
import { gradientMesh } from "./backgrounds/GradientMesh";
import { gridBackground } from "./backgrounds/GridBackground";
import { particles } from "./backgrounds/Particles";
import { endCard } from "./brand/EndCard";
import { logoReveal } from "./brand/LogoReveal";
import { barChart } from "./data/BarChart";
import { countdown } from "./data/Countdown";
import { counter } from "./data/Counter";
import { lineChart } from "./data/LineChart";
import { mapRoute } from "./data/MapRoute";
import { progressBar } from "./data/ProgressBar";
import { progressRing } from "./data/ProgressRing";
import { statGrid } from "./data/StatGrid";
import { browserWindow } from "./device/BrowserWindow";
import { codeWindow } from "./device/CodeWindow";
import { deviceFrame } from "./device/DeviceFrame";
import { terminalWindow } from "./device/TerminalWindow";
import { filmGrain } from "./overlay/FilmGrain";
import { letterbox } from "./overlay/Letterbox";
import { lightSweep } from "./overlay/LightSweep";
import { vhsOverlay } from "./overlay/VhsOverlay";
import { chatBubbles } from "./social/ChatBubbles";
import { emojiPop } from "./social/EmojiPop";
import { notificationBanner } from "./social/NotificationBanner";
import { socialPost } from "./social/SocialPost";
import { subscribeCta } from "./social/SubscribeCta";
import { chapterCard } from "./text/ChapterCard";
import { kineticTitle } from "./text/KineticTitle";
import { lowerThird } from "./text/LowerThird";
import { quoteCard } from "./text/QuoteCard";
import type { AnyMotionComponent, MotionCategory } from "./types";

/**
 * Built-in motion components. To add one: create a file that exports a
 * `defineMotionComponent(...)` and list it here. That's it — the inspector,
 * the library panel, the agent tools and MCP pick it up automatically.
 */
export const MOTION_COMPONENTS: AnyMotionComponent[] = [
  // text
  kineticTitle,
  lowerThird,
  chapterCard,
  quoteCard,
  // backgrounds
  gradientMesh,
  gridBackground,
  glowOrbs,
  aurora,
  particles,
  // data
  counter,
  barChart,
  lineChart,
  statGrid,
  progressRing,
  progressBar,
  countdown,
  mapRoute,
  // devices
  deviceFrame,
  browserWindow,
  terminalWindow,
  codeWindow,
  // social
  emojiPop,
  subscribeCta,
  socialPost,
  chatBubbles,
  notificationBanner,
  // annotation
  arrowCallout,
  circleHighlight,
  highlighterSweep,
  cursorClick,
  // brand
  logoReveal,
  endCard,
  // overlays
  lightSweep,
  letterbox,
  filmGrain,
  vhsOverlay,
];

const byId = new Map(MOTION_COMPONENTS.map((c) => [c.id, c]));

export const getMotionComponent = (id: string): AnyMotionComponent | undefined => byId.get(id);

export const motionComponentsByCategory = (): Record<MotionCategory, AnyMotionComponent[]> => {
  const out = {} as Record<MotionCategory, AnyMotionComponent[]>;
  for (const c of MOTION_COMPONENTS) {
    out[c.category] ??= [];
    out[c.category].push(c);
  }
  return out;
};

/** Compact catalog for agent prompts: id, category, description, prop names with defaults. */
export const motionCatalogForAgents = () =>
  MOTION_COMPONENTS.map((c) => ({
    id: c.id,
    category: c.category,
    description: c.description,
    defaultDurationSec: c.defaultDuration,
    props: Object.fromEntries(
      Object.entries(c.schema).map(([k, f]) => [
        k,
        `${f.type}${f.options ? `(${f.options.join("|")})` : ""} = ${JSON.stringify(f.default)}`,
      ]),
    ),
  }));
