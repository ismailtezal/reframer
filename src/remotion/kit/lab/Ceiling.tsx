import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Camera, Device, Float, LightStage, RevealText, ramp, rgba } from "..";
import { FormatMorph } from "../FormatMorph";

/**
 * Ceiling test: a 15 s Apple-style launch film built by hand from the kit, to see how good the kit
 * can look when every shot is done with care (vs. what the agent makes with the same parts).
 */

const ACCENT = "#5b8cff";
const FONT = "Inter, sans-serif";
const PHOTOS = ["road.jpg", "beach.jpg", "aurora.jpg", "clay2.jpg", "clay1.jpg", "clay3.jpg"];
const clampX = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The product's UI, told as a story over frames `t`: a prompt is typed, the edit builds itself, then it re-cuts to the beat. */
const EditorScreen: React.FC<{ t0: number }> = ({ t0 }) => {
  const t = useCurrentFrame() + t0;
  const prompt = "Cut my Iceland trip into a 20 s reel";
  const typed = prompt.slice(0, Math.round(ramp(t, 2, 26, "linear") * prompt.length));
  const steps = ["Picked 6 shots", "Ordered for the story", "Cut to 20.0 s"];
  const landed = (i: number) => ramp(t, 48 + i * 7, 10, "smooth");
  const recut = ramp(t, 122, 14, "smooth");
  const beats = ramp(t, 110, 8);
  const play = interpolate(t, [92, 200], [0.02, 0.9], clampX);
  const before = [0, 0.13, 0.31, 0.46, 0.64, 0.8, 1];
  const after = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];
  const edges = before.map((b, i) => b + (after[i] - b) * recut);
  const under = Math.max(0, edges.findIndex((e, i) => i > 0 && play < e) - 1);
  const toast = (at: number) => ramp(t, at, 10, "smooth");
  return (
    <AbsoluteFill style={{ background: "#0c0d11", fontFamily: FONT, color: "#eceef3", padding: 18, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 34, fontSize: 20, color: "#a9adba" }}>
        <div style={{ width: 16, height: 16, borderRadius: 5, background: ACCENT }} />
        <span style={{ color: "#eceef3", fontWeight: 600 }}>Reframer</span>
        <span>Iceland reel</span>
        <div style={{ flex: 1 }} />
        {["16:9", "9:16", "1:1"].map((f, i) => (
          <span
            key={f}
            style={{
              padding: "3px 10px",
              borderRadius: 8,
              background: i === 0 ? rgba(ACCENT, 0.9) : "#1b1d24",
              color: i === 0 ? "#fff" : "#a9adba",
            }}
          >
            {f}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", gap: 14, minHeight: 0 }}>
        <div
          style={{ width: "29%", borderRadius: 14, background: "#14151b", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: "100%",
              padding: "10px 14px",
              borderRadius: 14,
              background: rgba(ACCENT, 0.22),
              border: `1.5px solid ${rgba(ACCENT, 0.6)}`,
              fontSize: 30,
              lineHeight: 1.15,
              fontWeight: 500,
            }}
          >
            {typed}
            {t < 30 ? <span style={{ color: ACCENT, opacity: t % 16 < 8 ? 1 : 0 }}>▍</span> : null}
          </div>
          {steps.map((s, i) => {
            const k = ramp(t, 40 + i * 10, 10, "smooth");
            return (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 24,
                  opacity: k,
                  transform: `translateY(${(1 - k) * 10}px)`,
                }}
              >
                <span style={{ color: "#7ee2a0", fontWeight: 700 }}>✓</span>
                {s}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ flex: 1, position: "relative", borderRadius: 14, overflow: "hidden", background: "#000" }}>
            <Img
              src={staticFile(PHOTOS[landed(0) > 0.5 ? under : 0])}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + 0.05 * play})` }}
            />
            {[
              { at: 92, text: "✓ 6 clips · 20.0 s", until: 118 },
              { at: 138, text: "✓ Every cut on the beat", until: 999 },
            ].map((m) => {
              const k = toast(m.at) * (1 - ramp(t, m.until, 8));
              return k > 0 ? (
                <div
                  key={m.text}
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 22,
                    transform: `translate(-50%, ${(1 - k) * 14}px)`,
                    opacity: k,
                    padding: "10px 20px",
                    borderRadius: 12,
                    background: "rgba(14,24,18,0.86)",
                    color: "#9df0ad",
                    fontSize: 30,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.text}
                </div>
              ) : null;
            })}
          </div>
          <div style={{ position: "relative", height: 132, borderRadius: 12, background: "#14151b", padding: "12px 10px" }}>
            <div style={{ position: "relative", height: 66 }}>
              {PHOTOS.map((ph, i) => {
                const k = landed(i);
                return (
                  <div
                    key={ph}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${edges[i] * 100}%`,
                      width: `${(edges[i + 1] - edges[i]) * 100}%`,
                      padding: "0 3px",
                      opacity: k,
                      transform: `translateY(${(1 - k) * -26}px)`,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 8,
                        overflow: "hidden",
                        boxShadow: `0 0 0 2px ${rgba(ACCENT, 0.3 + 0.6 * recut)}`,
                      }}
                    >
                      <Img src={staticFile(ph)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </div>
                );
              })}
              {after.slice(1, -1).map((b) => (
                <div
                  key={b}
                  style={{
                    position: "absolute",
                    left: `${b * 100}%`,
                    top: -8,
                    bottom: -40,
                    width: 3,
                    marginLeft: -1.5,
                    borderRadius: 2,
                    background: "#ffb547",
                    opacity: beats * (0.6 + 0.4 * recut),
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40, marginTop: 6 }}>
              {Array.from({ length: 80 }, (_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
                  key={`w${i}`}
                  style={{
                    flex: 1,
                    borderRadius: 2,
                    background: "#394054",
                    height: 6 + 28 * Math.abs(Math.sin(i * 1.3) * Math.sin(i * 0.23 + 1)) * (i % 13 < 2 ? 1.25 : 0.65),
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                top: 6,
                bottom: 6,
                left: `calc(${play * 100}% + 10px)`,
                width: 2,
                background: "#ffffff",
                opacity: landed(0),
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TypeShot: React.FC = () => (
  <LightStage variant="dark" accent={ACCENT} light={{ x: 0.5, y: 0.4 }} floor={null}>
    <Camera from={{ scale: 1.03 }} to={{ scale: 1.12 }}>
      <AbsoluteFill style={{ justifyContent: "center" }}>
        <RevealText
          text={"Edit video by\n*describing* it."}
          size={150}
          mode="mask"
          accent={`linear-gradient(90deg, #8fb4ff, ${ACCENT})`}
          start={0}
        />
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

const HeroWide: React.FC = () => (
  <LightStage variant="dark" accent={ACCENT} light={{ x: 0.5, y: 0.16 }} floor={0.86}>
    <Camera from={{ scale: 1 }} to={{ scale: 1.08, y: 0.01 }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Device
          kind="macbook"
          finish="silver"
          width={1040}
          glow={ACCENT}
          reflection={0.1}
          tilt={{ from: { x: 18, y: -18 }, to: { x: 12, y: -6 } }}
        >
          <EditorScreen t0={0} />
        </Device>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

const HeroClose: React.FC = () => (
  <LightStage variant="dark" accent={ACCENT} light={{ x: 0.5, y: 0.16 }} floor={0.86}>
    <Camera from={{ scale: 2.05, focus: { x: 0.58, y: 0.62 } }} to={{ scale: 2.2, focus: { x: 0.6, y: 0.62 } }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Device kind="macbook" finish="silver" width={1040} glow={ACCENT} tilt={{ from: { x: 5, y: -6 }, to: { x: 3, y: -3 } }} sway={1}>
          <EditorScreen t0={105} />
        </Device>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

const FormatsShot: React.FC = () => (
  <LightStage variant="color" accent="#3f55ff" accent2="#ff2f7e" light={{ x: 0.68, y: 0.5 }} intensity={0.9}>
    <Camera from={{ scale: 1 }} to={{ scale: 1.08, x: -0.01 }}>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 110 }}>
        <div style={{ width: 760 }}>
          <RevealText
            text={"One timeline.\n*Every format.*"}
            size={116}
            align="left"
            accent="linear-gradient(90deg,#ffffff,#b7c4ff)"
            maxWidth={1}
            mode="mask"
          />
        </div>
        <div style={{ width: 760, height: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FormatMorph
            formats={["16:9", "9:16", "1:1"]}
            at={[10, 58]}
            size={620}
            src={staticFile("aurora.jpg")}
            focus={{ x: 0.55, y: 0.5 }}
          >
            <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: "7%" }}>
              <div style={{ color: "white", fontFamily: FONT, fontWeight: 700, fontSize: 36, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
                Chasing the lights
              </div>
            </AbsoluteFill>
          </FormatMorph>
        </div>
      </AbsoluteFill>
    </Camera>
  </LightStage>
);

const PhoneShot: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <LightStage variant="dark" accent="#ff5f8a" light={{ x: 0.36, y: 0.3 }} floor={0.88}>
      <Camera from={{ scale: 1 }} to={{ scale: 1.08, x: 0.01 }}>
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 150 }}>
          <Float>
            <Device kind="iphone" width={420} glow="#ff5f8a" tilt={{ from: { x: 4, y: 16 }, to: { x: 2, y: 6 } }}>
              <AbsoluteFill>
                <Img
                  src={staticFile("beach.jpg")}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "38% 50%",
                    transform: `scale(${1.08 + 0.06 * ramp(frame, 0, 60, "linear")})`,
                  }}
                />
                <AbsoluteFill
                  style={{
                    background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.6))",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    paddingBottom: 90,
                  }}
                >
                  <div
                    style={{
                      color: "white",
                      fontFamily: FONT,
                      fontWeight: 700,
                      fontSize: 38,
                      textAlign: "center",
                      lineHeight: 1.1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Black sand,
                    <br />
                    blue hour.
                  </div>
                </AbsoluteFill>
              </AbsoluteFill>
            </Device>
          </Float>
          <div style={{ width: 640 }}>
            <RevealText
              text={"Same edit.\n*Vertical.*"}
              size={116}
              align="left"
              accent="linear-gradient(90deg,#ffd1dc,#ff5f8a)"
              maxWidth={1}
              mode="mask"
              start={2}
            />
          </div>
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [8, 40], [-0.4, 1.4], clampX);
  return (
    <LightStage variant="dark" accent={ACCENT} light={{ x: 0.5, y: 0.45 }} floor={null}>
      <Camera from={{ scale: 1.02 }} to={{ scale: 1.1 }}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 26 }}>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 20,
                background: `linear-gradient(135deg, #8fb4ff, ${ACCENT})`,
                boxShadow: `0 0 60px ${rgba(ACCENT, 0.55)}`,
              }}
            />
            <div style={{ position: "relative", overflow: "hidden" }}>
              <RevealText text="Reframer" size={150} mode="mask" start={0} maxWidth={2} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(100deg, transparent ${sweep * 100 - 12}%, rgba(255,255,255,0.35) ${sweep * 100}%, transparent ${sweep * 100 + 12}%)`,
                  mixBlendMode: "overlay",
                }}
              />
            </div>
          </div>
          <div
            style={{
              opacity: ramp(frame, 12, 12),
              transform: `translateY(${(1 - ramp(frame, 12, 12)) * 12}px)`,
              padding: "12px 28px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#f5f5f7",
              fontFamily: FONT,
              fontSize: 40,
              fontWeight: 600,
            }}
          >
            reframer.app
          </div>
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
};

export const CeilingFilm: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, 6, 420, 450], [0, 0.9, 0.9, 0], clampX)} />
    <Sequence durationInFrames={45}>
      <TypeShot />
    </Sequence>
    <Sequence from={45} durationInFrames={105}>
      <HeroWide />
    </Sequence>
    <Sequence from={150} durationInFrames={75}>
      <HeroClose />
    </Sequence>
    <Sequence from={225} durationInFrames={105}>
      <FormatsShot />
    </Sequence>
    <Sequence from={330} durationInFrames={60}>
      <PhoneShot />
    </Sequence>
    <Sequence from={390} durationInFrames={60}>
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);
