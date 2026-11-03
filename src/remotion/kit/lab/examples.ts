/**
 * The worked examples embedded verbatim in src/agent/skills/apple-keynote.md, kept as code-component source so the lab
 * compiles them exactly the way the editor compiles what the agent writes.
 */

export const HERO_EXAMPLE = String.raw`import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { Camera, Device, LightStage, ramp, rgba, useFonts } from "reframer";

// One idea per shot: the product on a lit stage, its screen doing the feature mid-shot.
// Use it twice back to back: a wide shot, then a hard cut to closeUp with t0 so the story continues.
export default function ProductHero({ prompt = "Cut it to the beat", accent = "#6c8cff", still = "", closeUp = false, t0 = 0 }) {
  const frame = useCurrentFrame() + t0; // the UI's story time, continuous across the cut
  useFonts([{ family: "Inter", weight: 500 }, { family: "Inter", weight: 600 }]);
  const typed = prompt.slice(0, Math.round(ramp(frame, 2, 22, "linear") * prompt.length));
  const recut = ramp(frame, 40, 14); // the state change
  const done = ramp(frame, 54, 12);
  const before = [0, 0.17, 0.36, 0.55, 0.74, 1]; // cut points, off the beat…
  const after = [0, 0.2, 0.4, 0.6, 0.8, 1]; // …snapped onto it
  const cuts = before.map((c, i) => interpolate(recut, [0, 1], [c, after[i]]));
  // Without footage, a soft gradient; each timeline thumbnail crops the picture differently (wide, mid, close).
  const picture = (zoom = 1, pos = "50% 50%") =>
    still ? <Img src={still} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: "scale(" + zoom + ")", transformOrigin: pos }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2b3656, #0b0e17)" }} />;
  const camera = closeUp
    ? { from: { scale: 2, focus: { x: 0.5, y: 0.6 } }, to: { scale: 2.15, focus: { x: 0.52, y: 0.605 } } }
    : { from: { scale: 1 }, to: { scale: 1.08, y: 0.01 } };
  return (
    <LightStage variant="dark" accent={accent} light={{ x: 0.5, y: 0.2 }} floor={0.84}>
      <Camera {...camera}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Device kind="macbook" finish="silver" width={closeUp ? 1220 : 1000} glow={accent} reflection={0.14} screenBackground="#0d0e12"
            tilt={closeUp ? { from: { x: 4, y: -5 }, to: { x: 2, y: -2 } } : { from: { x: 18, y: -16 }, to: { x: 10, y: -5 } }}>
            <AbsoluteFill style={{ padding: 20, gap: 12, fontFamily: "Inter, sans-serif", color: "#eceef3" }}>
              <div style={{ height: 76, borderRadius: 14, background: "#191b21", border: "2px solid " + rgba(accent, 0.7),
                display: "flex", alignItems: "center", padding: "0 24px", fontSize: 40, fontWeight: 500 }}>
                {typed}<span style={{ color: accent, opacity: frame % 20 < 10 ? 1 : 0 }}>▍</span>
              </div>
              <div style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>{picture()}</div>
              <div style={{ position: "relative", height: 130, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative", height: 74 }}>
                {cuts.slice(0, -1).map((c, i) => (
                  <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: c * 100 + "%", width: (cuts[i + 1] - c) * 100 + "%", padding: "0 3px" }}>
                    <div style={{ height: "100%", borderRadius: 8, overflow: "hidden", boxShadow: "0 0 0 2px " + rgba(accent, 0.25 + 0.6 * recut) }}>
                      {picture(1 + (i % 3) * 0.7, ["50% 50%", "30% 40%", "70% 60%", "45% 70%", "60% 35%"][i])}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: "relative", height: 44, display: "flex", alignItems: "center", gap: 3 }}>
                {Array.from({ length: 90 }, (_, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: 2, background: "#3a4152",
                    height: 8 + 30 * Math.abs(Math.sin(i * 1.3) * Math.sin(i * 0.21 + 1)) * (i % 18 < 3 ? 1.2 : 0.6) }} />
                ))}
              </div>
              {after.slice(1, -1).map((b) => (
                <div key={b} style={{ position: "absolute", left: b * 100 + "%", top: -6, bottom: -4, width: 3, marginLeft: -1.5, borderRadius: 2,
                  background: accent, opacity: ramp(frame, 28, 8) * (0.55 + 0.45 * ramp(frame, 40, 14)) }} />
              ))}
              </div>
              <div style={{ position: "absolute", left: "50%", bottom: 172, padding: "12px 24px", borderRadius: 14,
                background: "#17241b", color: "#9df0ad", fontSize: 34, fontWeight: 600, whiteSpace: "nowrap",
                opacity: done, transform: "translate(-50%, " + (1 - done) * 14 + "px)" }}>
                ✓ 5 cuts moved to the beat
              </div>
            </AbsoluteFill>
          </Device>
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
}
`;

export const TYPE_EXAMPLE = String.raw`import React from "react";
import { AbsoluteFill } from "remotion";
import { Camera, LightStage, RevealText } from "reframer";

// A type beat: one short line, big, landing in the first half second, while the camera keeps moving.
export default function TypeBeat({ text = "Edit by *describing* it.", accent = "#6c8cff" }) {
  return (
    <LightStage variant="dark" accent={accent} light={{ x: 0.5, y: 0.42 }} floor={null}>
      <Camera from={{ scale: 1.04 }} to={{ scale: 1.12 }}>
        <AbsoluteFill style={{ justifyContent: "center" }}>
          <RevealText text={text} size={140} mode="mask" accent={accent} />
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
}
`;

export const KZ_EXAMPLE = String.raw`import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Callout, Camera, Critter, Dust, Forest, Hills, Layer, Planet, RevealText, Sky, hop, lookAt, take } from "reframer";

// One beat = a composed style frame + one primary action + a visible reaction, on a moving camera.
export default function PlanetBeat({ title = "What is a *planet*\nmade of?", accent = "#ffc93c" }) {
  const f = useCurrentFrame();
  const hero = { x: 760, y: 930 };
  const planet = { x: 1480, y: 330 };
  const eyes = f < 12 ? { x: 0.2, y: 0 } : lookAt(hero.x, hero.y - 250, planet.x, planet.y); // looks first…
  const jump = hop(f, 34, { height: 140 }); // …then acts: crouch, stretch, landing squash
  const friend = take(f, 54); // …and the other one reacts after
  return (
    <AbsoluteFill style={{ background: "#0d1240" }}>
      <Camera from={{ scale: 1.02 }} to={{ scale: 1.12, focus: { x: 0.52, y: 0.6 } }}>
        <Layer depth={0.15}>
          <Sky top="#0b1033" bottom="#4153a8" stars={120} />
        </Layer>
        <Layer depth={0.25}>
          <Planet x={planet.x} y={planet.y} size={240} color="#ff9566" atmosphere="#ffc9a1" surface="bands" />
          <Callout x={planet.x - 120} y={planet.y} text="A gas giant" sub="no solid ground at all" side="left" length={170} start={64} accent={accent} />
        </Layer>
        <Hills color="#173a5e" air="#5367bd" layers={4} horizon={0.52} />
        <Layer depth={0.9}>
          <Forest ground={0.82} count={15} color="#1d7a62" air="#3e56a8" haze={0.25} />
        </Layer>
        <Layer depth={1.05}>
          <div style={{ position: "absolute", left: -200, right: -200, top: 875, bottom: -200, background: "linear-gradient(#1a5c4c, #0f3a33)" }} />
          <Critter x={hero.x} y={hero.y} size={280} color="#ff7a59" look={eyes} mood={f > 40 ? "happy" : "neutral"} arms={f > 44 ? { right: 132 } : undefined} {...jump} />
          <Critter x={1190} y={935} size={210} color="#58c4f5" height={1.2} flip ears="antenna" seed={5}
            look={f < 54 ? { x: -0.7, y: -0.2 } : lookAt(1190, 700, planet.x, planet.y)} {...friend} />
        </Layer>
        <Layer depth={1.4}>
          <Dust count={26} />
        </Layer>
      </Camera>
      <AbsoluteFill style={{ justifyContent: "flex-start", padding: "80px 0 0 110px" }}>
        <RevealText text={title} size={92} font="Montserrat" weight={800} accent={accent} align="left" start={2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
`;
