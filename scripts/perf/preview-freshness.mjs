// Checks that preview video actually updates while playing: samples the preview canvas
// during playback and counts how often its pixels change.
//   node scripts/perf/preview-freshness.mjs <projectId> [--base=http://localhost:3000] [--from=0] [--seconds=4] [--headed]
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const projectId = process.argv.slice(2).find((a) => !a.startsWith("--"));
const BASE = args.base ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: !args.headed,
  args: ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist"],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const logs = [];
page.on("console", (m) => {
  if (/remotion|decode|timeout|error/i.test(m.text())) logs.push(m.text().slice(0, 160));
});
await page.goto(`${BASE}/editor/${projectId}`);
await page.waitForFunction(() => window.__reframer?.useProjectStore.getState().project, null, { timeout: 60_000 });
await page.waitForTimeout(2500);
const result = await page.evaluate(
  async ({ from, seconds }) => {
    const r = window.__reframer;
    const signature = () => {
      const c = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (!c) return "none";
      const g = document.createElement("canvas");
      g.width = 48;
      g.height = 27;
      const x = g.getContext("2d");
      try {
        x.drawImage(c, 0, 0, 48, 27);
      } catch (e) {
        return `err:${e.message}`;
      }
      const d = x.getImageData(0, 0, 48, 27).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2]) % 1e9;
      return h;
    };
    r.seek(from);
    await new Promise((s) => setTimeout(s, 1000));
    r.play();
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < seconds * 1000) {
      await new Promise((s) => requestAnimationFrame(() => setTimeout(s, 100)));
      samples.push({ t: Math.round(performance.now() - t0), frame: r.usePlaybackStore.getState().frame, sig: signature() });
    }
    r.pause();
    let changes = 0;
    let longestSameMs = 0;
    let sameSince = samples[0]?.t ?? 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].sig !== samples[i - 1].sig) {
        changes++;
        sameSince = samples[i].t;
      } else longestSameMs = Math.max(longestSameMs, samples[i].t - sameSince);
    }
    return { samples: samples.length, changes, longestStaleMs: longestSameMs, framesAdvanced: samples.at(-1).frame - samples[0].frame };
  },
  { from: Number(args.from ?? 0), seconds: Number(args.seconds ?? 4) },
);
console.log(JSON.stringify({ projectId, ...result, logs: logs.slice(0, 5) }));
await browser.close();
