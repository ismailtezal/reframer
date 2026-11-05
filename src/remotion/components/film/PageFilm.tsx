import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getRemotionEnvironment, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { filmUrl, isPackId, packFilmPath } from "../../../core/packs";
import { useRenderContext } from "../../context";
import { type BoxProps, defineMotionComponent } from "../types";

/**
 * A film from a style pack: a web page that draws any second itself (`window.render(t)`), played
 * here frame by frame. The page lives in `public/packs/<pack>/film/` and gets its template inputs as
 * `window.PACK_INPUTS`; `public/packs/_core/bridge.js` (loaded by every pack film) answers this
 * component's messages. Messages rather than direct calls, because renders load the page from the
 * media server, another origin than the composition.
 */

type Props = {
  pack: string;
  /** JSON object: the pack's template inputs. */
  inputs: string;
  /** A film page of one's own (same contract) instead of a pack's. */
  src: string;
  offsetSec: number;
  speed: number;
};

type DelayFns = ReturnType<typeof useDelayRender>;
type FromFilm = { __rf: 1; type: "ready" | "rendered" | "error"; id?: number; message?: string };

/**
 * One conversation with a film page. The page says `ready` once its fonts and images are in, then
 * draws whatever second it's asked for and answers `rendered`. While rendering, every frame holds its
 * screenshot until that answer; in the editor only the newest request matters, so scrubbing never
 * queues up stale frames.
 */
export class FilmLink {
  private frame: HTMLIFrameElement | null = null;
  private ready = false;
  private live = true;
  private nextId = 1;
  private readyHandle: number | null;
  private readonly waits = new Map<number, number>();
  private queue: { id: number; t: number }[] = [];
  private inFlight: number | null = null;
  private latest: number | null = null;

  constructor(
    private readonly label: string,
    private readonly fns: DelayFns,
    private readonly rendering: boolean,
  ) {
    this.readyHandle = fns.delayRender(`Loading the film page ${label}`, { timeoutInMilliseconds: 180_000 });
  }

  /**
   * The frame element, not its window: when the page loads from another site the frame moves to another
   * process and Chrome can hand out a new window object for it, so a window kept from mount time stops
   * matching the messages' source.
   */
  bind(frame: HTMLIFrameElement | null) {
    this.frame = frame;
  }

  private get win(): Window | null {
    return this.frame?.contentWindow ?? null;
  }

  /** Mounted (again: React's strict mode remounts effects with the same instance). */
  start() {
    this.live = true;
  }

  /** The page loaded: ask it to say whether it's ready, in case it was before anyone listened. */
  hello() {
    this.post({ type: "hello" });
  }

  readonly onMessage = (e: MessageEvent) => {
    if (!this.live || !this.win || e.source !== this.win) return;
    const m = e.data as FromFilm | null;
    if (!m || m.__rf !== 1) return;
    if (m.type === "ready") {
      if (this.ready) return;
      this.ready = true;
      this.release();
      this.flush();
    } else if (m.type === "rendered") {
      this.done(m.id);
    } else if (m.type === "error") {
      const err = new Error(`The film page ${this.label} failed: ${m.message ?? "unknown error"}`);
      if (this.rendering) this.fns.cancelRender(err);
      else console.warn(err.message);
      this.done(m.id);
    }
  };

  renderAt(t: number) {
    if (this.rendering) {
      const id = this.nextId++;
      this.waits.set(id, this.fns.delayRender(`Drawing the film page at ${t.toFixed(3)}s`, { timeoutInMilliseconds: 60_000 }));
      this.queue.push({ id, t });
    } else {
      this.latest = t;
    }
    this.flush();
  }

  /** Unmounted: nothing may wait on this page any more. */
  stop() {
    this.live = false;
    this.release();
    for (const handle of this.waits.values()) this.fns.continueRender(handle);
    this.waits.clear();
    this.queue = [];
    this.inFlight = null;
  }

  private flush() {
    if (!this.ready || !this.win || !this.live) return;
    if (this.rendering) {
      for (const { id, t } of this.queue.splice(0)) this.post({ type: "render", id, t });
      return;
    }
    if (this.inFlight !== null || this.latest === null) return;
    const id = this.nextId++;
    this.inFlight = id;
    const t = this.latest;
    this.latest = null;
    this.post({ type: "render", id, t });
  }

  private done(id: number | undefined) {
    if (id === undefined) return;
    const handle = this.waits.get(id);
    if (handle !== undefined) {
      this.waits.delete(id);
      this.fns.continueRender(handle);
    }
    if (this.inFlight === id) {
      this.inFlight = null;
      this.flush();
    }
  }

  private release() {
    if (this.readyHandle === null) return;
    this.fns.continueRender(this.readyHandle);
    this.readyHandle = null;
  }

  private post(msg: Record<string, unknown>) {
    this.win?.postMessage({ __rf: 1, ...msg }, "*");
  }
}

const FilmFrame: React.FC<{ url: string; t: number; width: number; height: number; label: string }> = ({
  url,
  t,
  width,
  height,
  label,
}) => {
  const fns = useDelayRender();
  const [link] = useState(() => new FilmLink(label, fns, getRemotionEnvironment().isRendering));
  const ref = useRef<HTMLIFrameElement>(null);
  useLayoutEffect(() => {
    link.bind(ref.current);
  }, [link]);
  useEffect(() => {
    link.start();
    window.addEventListener("message", link.onMessage);
    return () => {
      window.removeEventListener("message", link.onMessage);
      link.stop();
    };
  }, [link]);
  useLayoutEffect(() => {
    link.renderAt(t);
  }, [link, t]);
  return (
    <iframe
      ref={ref}
      src={url}
      title={label}
      onLoad={() => link.hello()}
      style={{ width, height, border: 0, display: "block", background: "transparent", pointerEvents: "none" }}
    />
  );
};

type FilmSource = { ok: true; href: string; label: string } | { ok: false; message: string };

export const filmSource = (p: Pick<Props, "pack" | "inputs" | "src">, resolveSrc: (src: string) => string): FilmSource => {
  let inputs: Record<string, unknown> | undefined;
  const raw = p.inputs.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, message: "The inputs are not valid JSON" };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, message: "The inputs must be a JSON object" };
    inputs = parsed as Record<string, unknown>;
  }
  const src = p.src.trim();
  if (src) {
    if (!/^(https?:\/\/|\/)/.test(src)) return { ok: false, message: "The film URL must start with http(s):// or /" };
    return { ok: true, href: filmUrl(src.startsWith("/") ? resolveSrc(src) : src, inputs), label: src };
  }
  const pack = p.pack.trim();
  if (!pack) return { ok: false, message: "Choose a style pack" };
  if (!isPackId(pack)) return { ok: false, message: `"${pack}" is not a style pack id` };
  return { ok: true, href: filmUrl(resolveSrc(packFilmPath(pack)), inputs), label: pack };
};

const PageFilm: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { resolveSrc, editor } = useRenderContext();
  const source = filmSource(p, resolveSrc);
  const width = Math.max(1, Math.round(p.width));
  const height = Math.max(1, Math.round(p.height));
  if (!source.ok) {
    if (!editor) throw new Error(`Style film: ${source.message}`);
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1f1f2e 0%, #2a2a3d 50%, #1a1a26 100%)",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: Math.max(14, Math.min(width, height) * 0.04),
          textAlign: "center",
          padding: 24,
        }}
      >
        {source.message}
      </div>
    );
  }
  const speed = p.speed > 0 ? p.speed : 1;
  const t = Math.max(0, p.offsetSec + (frame / fps) * speed);
  return <FilmFrame key={source.href} url={source.href} t={t} width={width} height={height} label={source.label} />;
};

export const pageFilm = defineMotionComponent<Props>({
  id: "page-film",
  name: "Style film",
  category: "background",
  description:
    "A whole film in a style pack's look (Art Deco, 1930s rubber-hose cartoon, CRT terminal, 80s anime, liminal camcorder…): a page that draws every frame itself, filling the clip. Set `pack` to a pack id and `inputs` to a JSON object of that pack's template inputs (titles, lines, names); `reframer packs` / load_skill(<pack id>) list the packs, their inputs and rules. It is the picture at the bottom of the stack: voice, music and captions go on top. `offsetSec` starts the film later, like trimming footage.",
  schema: {
    pack: {
      type: "string",
      label: "Style pack",
      default: "",
      description: "Pack id: a folder in public/packs (reframer packs lists them)",
    },
    inputs: {
      type: "text",
      label: "Inputs (JSON)",
      default: "",
      description: "The pack's template inputs as a JSON object; its guide lists them. Empty keeps the defaults.",
    },
    src: { type: "string", label: "Film URL", default: "", description: "A film page of your own instead of a pack (same contract)" },
    offsetSec: { type: "number", label: "Start at (s)", default: 0, min: 0, max: 600, step: 0.1 },
    speed: { type: "number", label: "Speed", default: 1, min: 0.25, max: 4, step: 0.05 },
  },
  defaults: { pack: "", inputs: "", src: "", offsetSec: 0, speed: 1 },
  defaultDuration: 12,
  Component: PageFilm,
  tags: ["style pack", "film", "template", "page", "art deco", "cartoon", "anime", "terminal", "found footage"],
});
