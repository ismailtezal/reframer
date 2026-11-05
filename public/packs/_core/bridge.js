/*
 * Style-pack film bridge. Load it first, as a classic script in <head>:
 *
 *   <script src="../../_core/bridge.js"></script>
 *
 * 1. Template inputs: `?inputs=<JSON>` in the page URL becomes `window.PACK_INPUTS` (always an
 *    object) before any module runs; `window.packInput(key, fallback)` reads one with its default.
 * 2. Hosting: inside a frame (Reframer's `page-film` clip) the page answers its host:
 *      host → { __rf: 1, type: "hello" }            "are you ready?"
 *      film → { __rf: 1, type: "ready", dur }        once window.READY is true and window.render exists
 *      host → { __rf: 1, type: "render", id, t }     draw second t
 *      film → { __rf: 1, type: "rendered", id }      after window.render(t) (and its promise, if any)
 *      film → { __rf: 1, type: "error", id?, message }
 *    Standalone (a headless renderer that calls window.render itself) nothing else changes.
 */
(() => {
  const readInputs = () => {
    try {
      const raw = new URLSearchParams(location.search).get("inputs");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      console.warn("[pack] inputs are not valid JSON; using the film's defaults");
      return {};
    }
  };
  const inputs = readInputs();
  window.PACK_INPUTS = inputs;

  /** The value when it's given and of the same type as the default, else the default. */
  window.packInput = (key, fallback) => {
    const v = inputs[key];
    if (v === undefined || v === null || v === "") return fallback;
    if (fallback !== undefined && fallback !== null && typeof v !== typeof fallback) return fallback;
    return v;
  };

  /**
   * Load the latin and latin-ext subsets of every font face on the page. `document.fonts.load(font)`
   * loads only the subsets its sample text needs, so a Turkish ş, ğ or İ typed into an input would
   * otherwise come out in a fallback font. Films await this before drawing text into textures.
   */
  window.packFonts = () =>
    Promise.all(
      [...document.fonts]
        .filter((f) => !f.unicodeRange || /U\+0?0[0-9A-F]{2}-|U\+0?1[0-9A-F]{2}|U\+0?2[0-9A-F]{2}|U\+0-10FFFF/i.test(f.unicodeRange))
        .map((f) => f.load().catch(() => null)),
    );

  if (window.parent === window) return;
  const host = window.parent;
  let announced = false;
  let announcing = false;

  const post = (msg) => {
    try {
      host.postMessage({ ...msg, __rf: 1 }, "*");
    } catch {
      // the host went away
    }
  };
  const isReady = () => window.READY === true && typeof window.render === "function";
  // Ready once the film says so and every face's Turkish subsets are in, so no frame draws a fallback glyph.
  const announce = async () => {
    if (announced || announcing || !isReady()) return;
    announcing = true;
    await window.packFonts();
    announcing = false;
    announced = true;
    post({ type: "ready", dur: typeof window.DUR === "number" ? window.DUR : null });
  };

  const poll = setInterval(() => {
    if (announced) clearInterval(poll);
    else announce();
  }, 25);

  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.__rf !== 1 || e.source !== host) return;
    if (m.type === "hello") {
      announced = false;
      announce();
    } else if (m.type === "render") {
      if (!isReady()) {
        post({ type: "error", id: m.id, message: "asked to draw before the film was ready" });
        return;
      }
      const t = Number(m.t);
      Promise.resolve()
        .then(() => window.render(t))
        .then(
          () => post({ type: "rendered", id: m.id }),
          (err) => post({ type: "error", id: m.id, message: String(err?.message ?? err) }),
        );
    }
  });

  window.addEventListener("error", (e) => {
    post({ type: "error", message: `${e.message || "script error"}${e.filename ? ` (${e.filename}:${e.lineno})` : ""}` });
  });
  window.addEventListener("unhandledrejection", (e) => {
    post({ type: "error", message: String(e.reason?.message ?? e.reason) });
  });
})();
