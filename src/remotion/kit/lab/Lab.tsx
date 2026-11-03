import type React from "react";
import { AbsoluteFill, Composition, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { createProject } from "../../../core/defaults";
import { compileCodeComponent } from "../../code/runtime";
import { getMotionComponent } from "../../components/registry";
import { RenderProvider } from "../../context";
import { fontStack, useFonts } from "../../fonts";
import { Camera, Device, Float, LightStage, RevealText, ramp } from "..";
import { Layer } from "../Camera";
import { Caption } from "../Caption";
import { FormatMorph } from "../FormatMorph";
import { Callout } from "../illustration/Callout";
import { Critter, hop, lookAt, take } from "../illustration/Critter";
import { Flow } from "../illustration/Flow";
import { SceneLight } from "../illustration/light";
import { Crowd, Person } from "../illustration/Person";
import { Dust, Forest, Hills, Planet, Sky, Tree } from "../illustration/world";
import { CeilingFilm } from "./Ceiling";
import { HERO_EXAMPLE, KZ_EXAMPLE, TYPE_EXAMPLE } from "./examples";

/**
 * Kit lab: one shot per composition, rendered on its own to judge each building block's craft
 * (not part of the app bundle). Render with scratchpad kitlab-render.mjs (public dir: real stills).
 */

const clampX = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FONT = "Inter Tight, Inter, sans-serif";

/** A believable editor whose state changes: a prompt is typed, then the film re-cuts on the beat. */
const EditorUI: React.FC<{ t0: number }> = ({ t0 }) => {
  const frame = useCurrentFrame() - t0;
  const recut = ramp(frame, 40, 18, "smooth");
  const play = interpolate(frame, [0, 110], [0.18, 0.64], clampX);
  const prompt = "Cut it to the beat and make the opening punchier";
  const typed = prompt.slice(0, Math.floor(interpolate(frame, [0, 32], [0, prompt.length], clampX)));
  const before = [0.02, 0.24, 0.41, 0.66, 0.96];
  const after = [0.02, 0.13, 0.27, 0.39, 0.53, 0.66, 0.8, 0.96];
  const edges = recut < 0.5 ? before : after;
  const pop = recut < 0.5 ? 0 : 1 - (recut - 0.5) * 2;
  const thumbs = ["clay3.jpg", "clay2.jpg", "clay1.jpg"];
  return (
    <AbsoluteFill style={{ background: "#0b0c10", fontFamily: "Inter, sans-serif" }}>
      <div
        style={{
          position: "absolute",
          left: "2.5%",
          top: "4.5%",
          width: "65%",
          height: "57%",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <Img
          src={staticFile(recut < 0.5 ? "clay3.jpg" : "clay2.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + 0.04 * play})` }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55))" }} />
      </div>
      <div
        style={{
          position: "absolute",
          right: "2.5%",
          top: "4.5%",
          width: "28%",
          height: "57%",
          borderRadius: 12,
          background: "#14161d",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div style={{ color: "#8b93a3", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Agent</div>
        <div
          style={{
            background: "#262b38",
            color: "#f1f3f7",
            fontSize: 21,
            borderRadius: 12,
            padding: "13px 15px",
            lineHeight: 1.35,
            minHeight: 56,
          }}
        >
          {typed}
          {frame < 36 ? <span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>▍</span> : null}
        </div>
        <div
          style={{
            marginTop: 16,
            color: "#7ee0a1",
            fontSize: 19,
            fontWeight: 600,
            opacity: ramp(frame, 50, 10),
            transform: `translateY(${(1 - ramp(frame, 50, 10)) * 8}px)`,
          }}
        >
          ✓ 32 beats mapped · 9 clips re-cut
        </div>
      </div>
      <div
        style={{ position: "absolute", left: "2.5%", right: "2.5%", top: "64.5%", bottom: "5%", borderRadius: 12, background: "#0f1116" }}
      >
        {edges.slice(0, -1).map((a, i) => {
          const b = edges[i + 1];
          return (
            <div
              key={`${edges.length}-${a}`}
              style={{
                position: "absolute",
                left: `${a * 100 + 0.2}%`,
                width: `${(b - a) * 100 - 0.4}%`,
                top: "10%",
                height: "40%",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: pop > 0 ? `0 0 ${22 * pop}px rgba(255,178,36,${0.8 * pop})` : "inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              <Img
                src={staticFile(thumbs[i % thumbs.length])}
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
              />
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: "1%",
            right: "1%",
            top: "58%",
            height: "32%",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          {Array.from({ length: 96 }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
              key={i}
              style={{
                flex: 1,
                height: `${22 + Math.abs(Math.sin(i * 1.7) * 62) + (i % 8 === 0 ? 14 : 0)}%`,
                background: i % 8 === 0 ? "#ffb224" : "#2a3346",
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: `${play * 100}%`,
            top: 0,
            bottom: 0,
            width: 3,
            background: "#ffb224",
            boxShadow: "0 0 14px #ffb224",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Headline alone → it lifts away → the laptop rises in → the camera eases toward the screen as the edit happens. */
const MacbookHero: React.FC = () => {
  const frame = useCurrentFrame();
  const CUT = 42;
  const rise = ramp(frame, CUT, 20, "ease-out");
  return (
    <LightStage variant="dark" accent="#4f7cff" floor={0.9} light={{ x: 0.5, y: 0.5 }}>
      {frame < CUT ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <RevealText text="Edit by *describing* it." size={132} start={0} mode="lines" />
        </AbsoluteFill>
      ) : (
        <Camera from={{ scale: 1 }} to={{ scale: 1.12, y: 0.02 }} start={CUT + 16} duration={150 - CUT - 16} ease="ease-in-out">
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 10 }}>
            <div style={{ transform: `translateY(${(1 - rise) * 120}px) scale(${0.96 + 0.04 * rise})` }}>
              <Device
                kind="macbook"
                width={1500}
                tilt={{ from: { x: 14, y: -6 }, to: { x: 2, y: 0 } }}
                start={CUT}
                duration={40}
                glow="#4f7cff"
                reflection={0.12}
              >
                <EditorUI t0={CUT + 8} />
              </Device>
            </div>
          </AbsoluteFill>
        </Camera>
      )}
    </LightStage>
  );
};

/** A real frame reflows 16:9 → 1:1 → 9:16, then a hard cut on the beat to the phone playing the vertical cut. */
const PhoneHero: React.FC = () => {
  const frame = useCurrentFrame();
  // One continuous morph 16:9 → 1:1 → 9:16 (aspect eased through the square), same center throughout.
  const m = ramp(frame, 14, 50, "ease-in-out");
  const aspect = m < 0.5 ? 16 / 9 + (1 - 16 / 9) * (m * 2) : 1 + (9 / 16 - 1) * ((m - 0.5) * 2);
  const area = 560 * 560;
  const w = Math.sqrt(area * aspect);
  const h = Math.sqrt(area / aspect);
  const label = m > 0.75 ? "9:16" : m > 0.3 ? "1:1" : "16:9";
  const cut = frame >= 72;
  return (
    <LightStage variant="color" accent="#3f55ff" accent2="#ff2f7e" light={{ x: 0.66, y: 0.5 }} intensity={0.9}>
      <Camera from={{ scale: 1.0 }} to={{ scale: 1.07, x: -0.012 }}>
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 140 }}>
          <div style={{ width: 780 }}>
            <RevealText
              text={"One timeline.\n*Every format.*"}
              size={112}
              align="left"
              accent="linear-gradient(90deg,#ffffff,#b7c4ff)"
              maxWidth={1}
              mode="lines"
            />
            <div style={{ height: 34 }} />
            <RevealText
              text="16:9, 1:1 and 9:16 — reflowed for you."
              size={50}
              weight={600}
              color="rgba(255,255,255,0.9)"
              align="left"
              start={18}
              maxWidth={1}
            />
          </div>
          <div style={{ position: "relative", width: 440, height: 880, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!cut ? (
              <div
                style={{
                  position: "absolute",
                  width: w,
                  height: h,
                  borderRadius: 28,
                  overflow: "hidden",
                  boxShadow: "0 40px 90px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.14)",
                }}
              >
                <Img src={staticFile("clay2.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    left: 18,
                    color: "white",
                    fontFamily: FONT,
                    fontWeight: 700,
                    fontSize: 30,
                    padding: "6px 16px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.45)",
                  }}
                >
                  {label}
                </div>
              </div>
            ) : (
              <Float>
                <Device
                  kind="iphone"
                  width={430}
                  tilt={{ from: { y: -14, x: 4 }, to: { y: -5, x: 2 } }}
                  start={72}
                  duration={78}
                  glow="#ff2f7e"
                >
                  <AbsoluteFill>
                    <Img
                      src={staticFile("clay2.jpg")}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: `scale(${1.05 + 0.04 * ramp(frame, 72, 78, "linear")})`,
                      }}
                    />
                    <AbsoluteFill
                      style={{
                        background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.6))",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        paddingBottom: 96,
                      }}
                    >
                      <div
                        style={{
                          color: "white",
                          fontFamily: FONT,
                          fontWeight: 700,
                          fontSize: 36,
                          textAlign: "center",
                          padding: "0 26px",
                          lineHeight: 1.12,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        The wheel never stops.
                      </div>
                    </AbsoluteFill>
                  </AbsoluteFill>
                </Device>
              </Float>
            )}
          </div>
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
};

/** Type cut to the music: lines land on beats (120 BPM = every 15 frames) with a light pulse; nothing shifts. */
const TypeOnly: React.FC = () => {
  const frame = useCurrentFrame();
  const beat = (n: number) => 2 + n * 15;
  const pulse = [beat(0), beat(1)].reduce((acc, t) => acc + (frame >= t ? Math.max(0, 1 - (frame - t) / 12) : 0), 0);
  return (
    <LightStage variant="dark" accent="#c9d2ff" light={{ x: 0.5, y: 0.46 }} intensity={0.55 + pulse * 0.25}>
      <Camera from={{ scale: 1.0, x: 0.008 }} to={{ scale: 1.07, x: -0.008 }}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <RevealText text="Cuts that land" size={156} start={0} speed={9} mode="lines" />
            <RevealText
              text="*on the beat.*"
              size={156}
              start={beat(1) - 4}
              speed={9}
              mode="lines"
              accent="linear-gradient(90deg,#ffd166 0%,#ff7a3d 45%,#ff3d77 100%)"
            />
            <div style={{ height: 44 }} />
            <RevealText
              text="Reframer maps the music before it cuts."
              size={64}
              weight={600}
              color="rgba(245,245,247,0.9)"
              start={beat(3)}
              mode="lines"
            />
          </div>
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
};

/** A playbook example compiled the way the editor compiles agent-written components. */
const Compiled: React.FC<{ source: string; props?: Record<string, unknown> }> = ({ source, props }) => {
  const { width, height, durationInFrames } = useVideoConfig();
  const result = compileCodeComponent(source);
  if (!result.ok)
    return <AbsoluteFill style={{ background: "#300", color: "#fcc", fontSize: 36, padding: 60 }}>{result.error}</AbsoluteFill>;
  const C = result.Component;
  return <C {...props} width={width} height={height} durationInFrames={durationInFrames} />;
};
const AgentHero: React.FC = () => <Compiled source={HERO_EXAMPLE} props={{ still: staticFile("clay2.jpg") }} />;
const AgentClose: React.FC = () => <Compiled source={HERO_EXAMPLE} props={{ still: staticFile("clay2.jpg"), closeUp: true, t0: 30 }} />;
const AgentType: React.FC = () => <Compiled source={TYPE_EXAMPLE} />;
const AgentKz: React.FC = () => <Compiled source={KZ_EXAMPLE} />;

/** Illustration kit: a layered night world, a hero who looks, hops and lands, a friend who reacts. */
const KzScene: React.FC = () => {
  const frame = useCurrentFrame();
  const h = hop(frame, 70, { height: 170 });
  const t = take(frame, 94);
  const lookUp = interpolate(frame, [18, 30], [0, -0.95], clampX);
  const lookX = interpolate(frame, [18, 30], [0, 0.55], clampX);
  return (
    <AbsoluteFill style={{ background: "#0b1033" }}>
      <Camera from={{ scale: 1.04 }} to={{ scale: 1.14, focus: { x: 0.47, y: 0.6 } }}>
        <Layer depth={0.15}>
          <Sky top="#0b1033" bottom="#4153a8" stars={120} seed={2} />
        </Layer>
        <Layer depth={0.25}>
          <Planet x={1430} y={250} size={250} color="#ff9566" atmosphere="#ffc9a1" surface="bands" />
        </Layer>
        <Hills color="#173a5e" air="#5367bd" layers={4} horizon={0.52} seed={4} />
        <Layer depth={0.9}>
          <Forest ground={0.82} count={15} color="#1d7a62" air="#3e56a8" haze={0.25} seed={3} heights={[120, 230]} />
        </Layer>
        <Layer depth={1.05}>
          <div
            style={{
              position: "absolute",
              left: -200,
              right: -200,
              top: 1080 * 0.81,
              bottom: -200,
              background: "linear-gradient(180deg, #1a5c4c, #0f3a33)",
            }}
          />
          <Critter
            x={760}
            y={930}
            size={270}
            color="#ff7a59"
            look={{ x: lookX, y: lookUp }}
            mood={frame > 66 ? "happy" : "neutral"}
            pose={frame > 88 ? "cheer" : "idle"}
            {...h}
            seed={2}
          />
          <Critter
            x={1190}
            y={935}
            size={205}
            color="#58c4f5"
            height={1.22}
            flip
            look={{ x: frame > 86 ? -0.7 : -0.3, y: frame > 86 ? -0.4 : 0 }}
            ears="antenna"
            seed={5}
            {...t}
          />
        </Layer>
        <Layer depth={1.4}>
          <Dust count={28} size={3.5} seed={9} opacity={0.3} />
        </Layer>
      </Camera>
    </AbsoluteFill>
  );
};

/** People: a speaker at a podium and a crowd that reacts in a ripple. */
const KzPeople: React.FC = () => {
  const frame = useCurrentFrame();
  const talk = frame < 56 ? 0.5 + 0.5 * Math.sin(frame / 2.3) * Math.sin(frame / 5.1) : 0;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #1b2259 0%, #2d3a8c 70%, #3b2f6e 100%)" }}>
      <Camera from={{ scale: 1.02 }} to={{ scale: 1.1, focus: { x: 0.5, y: 0.55 } }}>
        <div
          style={{
            position: "absolute",
            left: 660,
            top: 140,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,214,140,0.35), transparent 65%)",
          }}
        />
        <Person
          x={960}
          y={700}
          size={520}
          hero
          skin="#e8b896"
          hair="side"
          hairColor="#d9d4cf"
          mustache
          jacket="#2b2f45"
          shirt="#f4f1ea"
          tie="#d6453d"
          build={1.15}
          talk={talk}
          mood={frame > 70 ? "happy" : "neutral"}
          pose={frame > 70 ? "cheer" : "point"}
          look={{ x: 0, y: 0.2 }}
          seed={3}
        />
        <div
          style={{
            position: "absolute",
            left: 790,
            top: 560,
            width: 340,
            height: 150,
            borderRadius: 18,
            background: "linear-gradient(180deg, #8a5a3c, #6b4430)",
            boxShadow: "inset 0 6px 0 rgba(255,255,255,0.18)",
          }}
        />
        <Crowd rows={2} perRow={10} ground={1.02} size={250} reactAt={62} reaction="surprised" look={{ x: 0, y: -0.6 }} seed={4} />
      </Camera>
    </AbsoluteFill>
  );
};

/** The illustrated-explainer playbook example, written the way the agent would (one beat). */
const KzBeat: React.FC = () => {
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
          <Callout x={planet.x - 120} y={planet.y} text="A gas giant" sub="no solid ground at all" side="left" length={170} start={64} />
        </Layer>
        <Hills color="#173a5e" air="#5367bd" layers={4} horizon={0.52} />
        <Layer depth={0.9}>
          <Forest ground={0.82} count={15} color="#1d7a62" air="#3e56a8" haze={0.25} />
        </Layer>
        <Layer depth={1.05}>
          <div
            style={{
              position: "absolute",
              left: -200,
              right: -200,
              top: 875,
              bottom: -200,
              background: "linear-gradient(#1a5c4c, #0f3a33)",
            }}
          />
          <Critter
            x={hero.x}
            y={hero.y}
            size={280}
            color="#ff7a59"
            look={eyes}
            mood={f > 40 ? "happy" : "neutral"}
            arms={f > 44 ? { right: 132 } : undefined}
            {...jump}
          />
          <Critter
            x={1190}
            y={935}
            size={210}
            color="#58c4f5"
            height={1.2}
            flip
            ears="antenna"
            look={f < 54 ? { x: -0.7, y: -0.2 } : lookAt(1190, 700, planet.x, planet.y)}
            seed={5}
            {...friend}
          />
        </Layer>
        <Layer depth={1.4}>
          <Dust count={26} />
        </Layer>
      </Camera>
      <AbsoluteFill style={{ justifyContent: "flex-start", padding: "80px 0 0 110px" }}>
        <RevealText
          text={"What is a *planet*\nmade of?"}
          size={92}
          font="Montserrat"
          weight={800}
          accent="#ffc93c"
          align="left"
          start={2}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The MacBook from above: lid, keyboard deck and trackpad in perspective. */
const MacbookDeck: React.FC = () => (
  <LightStage variant="dark" accent="#6c8cff" light={{ x: 0.5, y: 0.18 }} floor={0.8}>
    <Camera from={{ scale: 1 }} to={{ scale: 1.08 }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Device
          kind="macbook"
          finish="silver"
          width={1000}
          glow="#6c8cff"
          reflection={0.12}
          tilt={{ from: { x: 22, y: -24 }, to: { x: 14, y: -8 } }}
        >
          <EditorUI t0={0} />
        </Device>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

/** Worst case for the deck: just above its angle threshold, under a strong close-up zoom. */
const DeckEdge: React.FC = () => (
  <LightStage variant="dark" accent="#6c8cff" floor={0.8}>
    <Camera from={{ scale: 2.2, focus: { x: 0.5, y: 0.6 } }} to={{ scale: 2.3, focus: { x: 0.5, y: 0.6 } }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Device kind="macbook" finish="silver" width={1220} tilt={{ from: { x: 9, y: -4 }, to: { x: 8.2, y: -2 } }} sway={0}>
          <EditorUI t0={30} />
        </Device>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

/** One frame reflowing 16:9 → 9:16 → 1:1 beside its headline, a caption that stays at the bottom. */
const FormatMorphShot: React.FC = () => (
  <LightStage variant="color" accent="#3f55ff" accent2="#ff2f7e" light={{ x: 0.66, y: 0.5 }} intensity={0.9}>
    <Camera from={{ scale: 1 }} to={{ scale: 1.08 }}>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120 }}>
        <div style={{ width: 760 }}>
          <RevealText
            text={"One timeline.\n*Every format.*"}
            size={112}
            align="left"
            accent="linear-gradient(90deg,#ffffff,#b7c4ff)"
            maxWidth={1}
            mode="lines"
          />
        </div>
        <div style={{ width: 760, height: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FormatMorph formats={["16:9", "9:16", "1:1"]} at={[16, 64]} size={600} src={staticFile("clay2.jpg")} focus={{ x: 0.42, y: 0.5 }}>
            <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: "7%" }}>
              <div style={{ color: "white", fontFamily: FONT, fontWeight: 700, fontSize: 34, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
                The wheel never stops.
              </div>
            </AbsoluteFill>
          </FormatMorph>
        </div>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

/** A mechanism shown as flow: water climbing a trunk, air drifting into the crown. */
const KzFlow: React.FC = () => (
  <AbsoluteFill style={{ background: "#0d1240" }}>
    <Camera from={{ scale: 1.02 }} to={{ scale: 1.1, focus: { x: 0.5, y: 0.5 } }}>
      <Layer depth={0.15}>
        <Sky top="#0b1033" bottom="#3d4fa3" stars={80} />
      </Layer>
      <Hills color="#173a5e" air="#5367bd" layers={3} horizon={0.62} />
      <Layer depth={1}>
        <div
          style={{ position: "absolute", left: -200, right: -200, top: 930, bottom: -200, background: "linear-gradient(#1a5c4c, #0f3a33)" }}
        />
        <Tree x={960} y={940} height={820} kind="round" color="#2a9d6f" sway={0.6} />
        <Flow d="M 960 935 C 950 820 972 700 958 600 C 950 520 966 470 960 420" color="#7fe3ff" size={9} speed={160} guide="#0b3d63" />
        <Flow d="M 1500 300 C 1340 330 1200 300 1060 330" color="#ffffff" size={7} speed={120} count={8} start={20} />
        <Callout x={985} y={700} text="Water climbs" sub="pulled up from the leaves" side="right" length={160} start={30} />
      </Layer>
    </Camera>
  </AbsoluteFill>
);

/** Debug: the bare device on a flat background, to see whether its first frame differs from the next. */
const DeviceFirstFrame: React.FC = () => (
  <LightStage variant="dark" accent="#6c8cff" light={{ x: 0.5, y: 0.18 }} floor={0.8}>
    <Camera from={{ scale: 1 }} to={{ scale: 1.08 }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Device
          kind="macbook"
          finish="silver"
          width={1000}
          glow="#6c8cff"
          reflection={0.12}
          tilt={{ from: { x: 18, y: -18 }, to: { x: 12, y: -6 } }}
        >
          <EditorUI t0={0} />
        </Device>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

/** Captions over a busy illustrated frame: whole lines, scrim, safe area. */
const KzCaption: React.FC = () => (
  <AbsoluteFill>
    <KzBeat />
    <Caption text={"Most of a tree is made of *air*,\nnot soil."} start={6} />
  </AbsoluteFill>
);

const CaptionVariants: React.FC = () => (
  <AbsoluteFill>
    <KzBeat />
    {(["card", "marker", "outline", "scrim"] as const).map((v, i) => (
      <Sequence key={v} from={i * 45} durationInFrames={45}>
        <Caption variant={v} text={"Ağaçların çoğu *havadan* yapılır,\ntopraktan değil."} start={3} exitAt={34} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

/** useFonts with bare family names, the way agents tend to call it. */
const FontTest: React.FC = () => {
  useFonts(["Roboto Condensed", "JetBrains Mono"], "Playfair Display");
  const row = (family: string, weight: number) => (
    <div style={{ fontFamily: fontStack(family), fontWeight: weight, fontSize: 64, color: "#111" }}>
      {family} {weight}: Şeyma ığdır ÇÖĞÜ 0123
    </div>
  );
  return (
    <AbsoluteFill style={{ background: "#f4f1ea", padding: 60, gap: 18 }}>
      {row("Roboto Condensed", 300)}
      {row("Roboto Condensed", 800)}
      {row("JetBrains Mono", 400)}
      {row("Playfair Display", 700)}
      {row("Inter", 400)}
    </AbsoluteFill>
  );
};

/** Every tree kind large, then a forest at two distances, to judge the drawing. */
const TreeLab: React.FC = () => (
  <AbsoluteFill>
    <Sky top="#14205a" bottom="#5d7bd0" stars={0} />
    <Hills color="#3b6f8f" air="#7d97d8" layers={2} horizon={0.62} />
    <Forest ground={0.66} count={18} heights={[70, 120]} color="#2e7d6b" air="#7d97d8" haze={0.45} seed={3} />
    <AbsoluteFill style={{ top: "70%", background: "#3f8f5a" }} />
    <Tree x={260} y={900} height={420} kind="round" color="#3f9d63" seed={2} />
    <Tree x={700} y={900} height={460} kind="pine" color="#2f8a6a" seed={5} />
    <Tree x={1100} y={900} height={440} kind="tall" color="#3b8f5c" seed={7} />
    <Tree x={1500} y={900} height={360} kind="round" color="#5aa35a" seed={11} />
    <Tree x={1780} y={905} height={260} kind="bush" color="#4f9a55" seed={4} />
  </AbsoluteFill>
);

/** The same trees and hills inside one scene light (night blue ambient, warm light from the right). */
const TreeLabLit: React.FC = () => (
  <AbsoluteFill>
    <SceneLight ambient="#24307a" light="#ffd59a" side="right">
      <TreeLab />
    </SceneLight>
  </AbsoluteFill>
);

/** The scene lab under a warm sunset light from the right (characters, trees and clouds share it). */
const KzSceneLit: React.FC = () => (
  <SceneLight ambient="#3a2a6e" light="#ffb36b" side="right">
    <KzScene />
  </SceneLight>
);

/** Descenders and accents through every RevealText mode (nothing may be sliced by the masks). */
const MaskTest: React.FC = () => (
  <AbsoluteFill style={{ background: "#f3efe6", justifyContent: "center", gap: 40 }}>
    <RevealText
      text={"ultimate *sophistication* gjpqy"}
      mode="mask"
      size={110}
      color="#1b1b1b"
      accent="#d23c2f"
      font="Playfair Display"
      start={0}
    />
    <RevealText text={"Şimdi ığdır Çağ jpg"} mode="lines" size={90} color="#1b1b1b" font="Montserrat" weight={800} start={0} />
    <RevealText text={"Quietly typing gyp"} mode="words" size={90} color="#1b1b1b" font="Inter" start={0} />
  </AbsoluteFill>
);

/** The built-in components agents reach for most, each with its defaults, 90 frames apiece. */
const GALLERY = [
  "kinetic-title",
  "end-card",
  "counter",
  "stat-grid",
  "line-chart",
  "bar-chart",
  "lower-third",
  "quote-card",
  "chapter-card",
  "logo-reveal",
  "particles",
  "glow-orbs",
];
const galleryProject = createProject({ name: "Gallery" });
const BuiltinGallery: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <RenderProvider project={galleryProject} editor={false}>
      <AbsoluteFill style={{ background: "#0d0f14" }}>
        {GALLERY.map((id, i) => {
          const def = getMotionComponent(id);
          if (!def) return null;
          const C = def.Component;
          return (
            <Sequence key={id} from={i * 90} durationInFrames={90}>
              <C {...def.defaults} width={width} height={height} durationInFrames={90} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </RenderProvider>
  );
};

export const KitLab: React.FC = () => (
  <>
    <Composition id="macbook-hero" component={MacbookHero} durationInFrames={150} fps={30} width={1920} height={1080} />
    <Composition id="phone-hero" component={PhoneHero} durationInFrames={150} fps={30} width={1920} height={1080} />
    <Composition id="type-only" component={TypeOnly} durationInFrames={120} fps={30} width={1920} height={1080} />
    <Composition id="agent-hero" component={AgentHero} durationInFrames={75} fps={30} width={1920} height={1080} />
    <Composition id="agent-close" component={AgentClose} durationInFrames={60} fps={30} width={1920} height={1080} />
    <Composition id="agent-type" component={AgentType} durationInFrames={60} fps={30} width={1920} height={1080} />
    <Composition id="kz-scene" component={KzScene} durationInFrames={150} fps={30} width={1920} height={1080} />
    <Composition id="kz-people" component={KzPeople} durationInFrames={120} fps={30} width={1920} height={1080} />
    <Composition id="kz-beat" component={KzBeat} durationInFrames={120} fps={30} width={1920} height={1080} />
    <Composition id="agent-kz" component={AgentKz} durationInFrames={120} fps={30} width={1920} height={1080} />
    <Composition id="macbook-deck" component={MacbookDeck} durationInFrames={90} fps={30} width={1920} height={1080} />
    <Composition id="deck-edge" component={DeckEdge} durationInFrames={30} fps={30} width={1920} height={1080} />
    <Composition id="format-morph" component={FormatMorphShot} durationInFrames={110} fps={30} width={1920} height={1080} />
    <Composition id="kz-flow" component={KzFlow} durationInFrames={120} fps={30} width={1920} height={1080} />
    <Composition id="ceiling-apple" component={CeilingFilm} durationInFrames={450} fps={30} width={1920} height={1080} />
    <Composition id="device-first" component={DeviceFirstFrame} durationInFrames={30} fps={30} width={1920} height={1080} />
    <Composition id="kz-caption" component={KzCaption} durationInFrames={90} fps={30} width={1920} height={1080} />
    <Composition id="tree-lab" component={TreeLab} durationInFrames={60} fps={30} width={1920} height={1080} />
    <Composition id="tree-lab-lit" component={TreeLabLit} durationInFrames={60} fps={30} width={1920} height={1080} />
    <Composition id="kz-scene-lit" component={KzSceneLit} durationInFrames={150} fps={30} width={1920} height={1080} />
    <Composition id="mask-test" component={MaskTest} durationInFrames={40} fps={30} width={1920} height={1080} />
    <Composition id="builtin-gallery" component={BuiltinGallery} durationInFrames={1080} fps={30} width={1920} height={1080} />
    <Composition id="font-test" component={FontTest} durationInFrames={10} fps={30} width={1920} height={1080} />
    <Composition id="caption-variants" component={CaptionVariants} durationInFrames={180} fps={30} width={1920} height={1080} />
  </>
);
