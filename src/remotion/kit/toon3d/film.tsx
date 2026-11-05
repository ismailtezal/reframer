import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { loadFont } from "../../fonts";
import type { Card } from "./card";
import type { Fx } from "./fx";
import type { LightPreset, Rig } from "./lights";
import { Pipeline, type Post } from "./pipeline";
import { TOON } from "./toon";

/**
 * A toon 3D film from a shot list: every shot is a pure function of the frame (camera, light, lens, post and how it
 * poses the world), so any frame renders the same in any order. The world is built once; each frame it is posed for
 * the shot (or both shots of a dissolve) and rendered through the look pipeline (ink lines, lens blur, bloom, grade,
 * camera motion blur).
 */

export type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type Lens = { at: V3 | null; cInf: number };

/** What the film needs from a world: its root, the light rig, and the cards (characters) to light. */
export type ToonWorld = {
  root: THREE.Object3D;
  rig: Rig;
  /** Character cards: hidden before every pose and tinted by the preset's card light. */
  cards?: Card[];
  fx?: Fx;
  /** Runs before each shot poses the world (reset props to their defaults here). */
  reset?: () => void;
  /** Runs after the light preset is applied (swap a sky texture by `p.sky`, dim practicals…). */
  onLight?: (p: LightPreset) => void;
};

export type ToonShot<W extends ToonWorld = ToonWorld> = {
  id?: string;
  /** frames, [from, to) */
  from: number;
  to: number;
  cam: (f: number) => Cam;
  light: (f: number) => LightPreset;
  /** focus point and blur at infinity (px at 1080 wide; 6–12 for shallow, 0 = off) */
  lens?: (f: number) => Lens;
  post?: (f: number) => Partial<Pick<Post, "flash" | "glitch" | "fade">>;
  pose?: (world: W, f: number, camera: THREE.PerspectiveCamera) => void;
  near?: number;
  far?: number;
  fog?: { color: string; near: number; far: number } | null;
  /** where the key light's shadow frustum centres (default: the camera's look point) */
  shadowAt?: V3;
};

export type ToonFilmProps<W extends ToonWorld> = {
  /** Builds the world once (meshes, cards, rig). */
  build: () => W;
  shots: ToonShot<W>[];
  /** Cross-dissolves as [first frame of the next shot, length in frames]. */
  dissolves?: [number, number][];
  ink?: { width?: number; color?: string };
  width?: number;
  height?: number;
};

// ---- camera grammar --------------------------------------------------------------------------------------------
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** smootherstep */
export const ss = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (6 * t - 15) + 10);
};
export const ramp = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lv = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
export const backOut = (x: number) => {
  const t = clamp01(x) - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
};
export const C = (pos: V3, look: V3, fov = 36, roll = 0): Cam => ({ pos, look, fov, roll });
export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({
  pos: lv(a.pos, b.pos, t),
  look: lv(a.look, b.look, t),
  fov: lerp(a.fov, b.fov, t),
  roll: lerp(a.roll, b.roll, t),
});
/** Dolly toward the look point by fraction k (k > 0 = closer). */
export const dolly = (c: Cam, k: number): Cam => ({ ...c, pos: lv(c.pos, c.look, k) });
/** Continuous push-in from f0 at `rate` per frame (holds creep in at 0.0015–0.0035, punch words ~0.006). */
export const push = (c: Cam, f: number, f0: number, rate: number) => dolly(c, 1 - (1 - rate) ** Math.max(0, f - f0));
/** Glides through keys: each key starts at its frame and eases in and out (smootherstep) over `dur` frames. */
export const keys = (f: number, list: { f: number; dur: number; cam: Cam }[]) => {
  let cur = list[0].cam;
  for (let i = 1; i < list.length; i++) {
    const k = list[i];
    if (f < k.f) break;
    cur = mixCam(cur, k.cam, ss((f - k.f) / k.dur));
  }
  return cur;
};
/** Impact kick on hit frames: the look point jumps, flips sign every frame and dies in 7 frames. */
export const kick = (c: Cam, f: number, hits: number[], amp = 1): Cam => {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const k = f - h;
    if (k < 0 || k >= 7) continue;
    const s = (k % 2 ? -1 : 1) * amp * (1 - k / 7);
    x += s * 0.012;
    y += s * 0.008 * (hash(h) > 0.5 ? 1 : -1);
  }
  return { ...c, look: [c.look[0] + x, c.look[1] + y, c.look[2]] };
};
/** Blink weight (0..1) on a seeded rhythm, plus forced blinks at `extra` frames. */
export const blinkAt = (f: number, seed: number, extra: number[] = []) => {
  for (const e of extra) if (f >= e && f < e + 4) return [0.5, 1, 1, 0.5][f - e];
  let t = 6 + ((seed * 13) % 37);
  let i = 0;
  while (t + 4 <= f) {
    t += 4 + 16 + Math.floor(hash(seed * 101 + i) * 48);
    i++;
  }
  const k = f - t;
  return k >= 0 && k < 4 ? [0.5, 1, 1, 0.5][k] : 0;
};

// ---- applying a shot -------------------------------------------------------------------------------------------
type View<W extends ToonWorld> = { shot: ToonShot<W>; f: number };

const shotAt = <W extends ToonWorld>(shots: ToonShot<W>[], f: number) =>
  shots.find((s) => f >= s.from && f < s.to) ?? (f < shots[0].from ? shots[0] : shots[shots.length - 1]);

const viewsAt = <W extends ToonWorld>(
  shots: ToonShot<W>[],
  dissolves: [number, number][],
  f: number,
): { a: View<W>; b?: View<W>; t: number } => {
  for (const [d, len] of dissolves) {
    if (f >= d && f < d + len)
      return { a: { shot: shotAt(shots, d - 1), f }, b: { shot: shotAt(shots, d), f }, t: ss((f - d + 1) / (len + 1)) };
  }
  return { a: { shot: shotAt(shots, f), f }, t: 0 };
};

const setCam = (camera: THREE.PerspectiveCamera, c: Cam) => {
  camera.position.set(...c.pos);
  camera.fov = c.fov;
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(...c.look);
  camera.rotateZ(c.roll);
  camera.updateMatrixWorld();
};

const fwd = new THREE.Vector3();
const tmp = new THREE.Vector3();
const probe = new THREE.PerspectiveCamera();

/** Screen motion of the look point over a 180° shutter, in pipeline px (1080×1920 reference, x right, y up). */
const shutterMotion = <W extends ToonWorld>(shot: ToonShot<W>, f: number, point: THREE.Vector3, w: number, h: number): [number, number] => {
  if (f - 1 < shot.from || f + 1 >= shot.to) return [0, 0];
  probe.aspect = w / h;
  probe.near = 0.05;
  probe.far = 800;
  const k = 1920 / h;
  const at = (t: number) => {
    setCam(probe, shot.cam(t));
    const p = point.clone().project(probe);
    return [p.x * (w / 2) * k, p.y * (h / 2) * k];
  };
  const a = at(f - 1);
  const b = at(f + 1);
  const m: [number, number] = [((b[0] - a[0]) / 2) * 0.5, ((b[1] - a[1]) / 2) * 0.5];
  const len = Math.hypot(m[0], m[1]);
  return len > 70 ? [(m[0] / len) * 70, (m[1] / len) * 70] : m;
};

const direct = <W extends ToonWorld>(
  w: W,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  v: View<W>,
  ink: ToonFilmProps<W>["ink"],
  size: [number, number],
): Post => {
  const { shot, f } = v;
  const c = shot.cam(f);
  camera.near = shot.near ?? 0.05;
  camera.far = shot.far ?? 80;
  setCam(camera, c);

  for (const card of w.cards ?? []) card.mesh.visible = false;
  w.reset?.();
  w.fx?.begin();
  shot.pose?.(w, f, camera);
  w.fx?.end();

  const light = shot.light(f);
  const lens = shot.lens?.(f) ?? { at: null, cInf: 0 };
  camera.getWorldDirection(fwd);
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const keySide = Math.sign(new THREE.Vector3(...light.keyDir).dot(right)) || 1;
  const focusPt = lens.at ? new THREE.Vector3(...lens.at) : new THREE.Vector3(...c.look);
  w.rig.apply(light, new THREE.Vector3(...(shot.shadowAt ?? c.look)), TOON.uShade.value);
  const tint = new THREE.Color(light.cardTint);
  const glow = new THREE.Color(light.cardGlow).multiplyScalar(light.cardGlowK);
  w.onLight?.(light);
  scene.background = new THREE.Color(light.clear);
  const fog = scene.fog as THREE.Fog;
  if (shot.fog) {
    fog.color.set(shot.fog.color);
    fog.near = shot.fog.near;
    fog.far = shot.fog.far;
  } else {
    fog.near = 400;
    fog.far = 900;
  }
  for (const card of w.cards ?? []) {
    const u = card.mat.uniforms;
    (u.uTint.value as THREE.Color).copy(tint);
    u.uGain.value = light.cardGain;
    u.uGrad.value = light.cardGrad;
    u.uKeySide.value = keySide;
    (u.uGlow.value as THREE.Color).copy(glow);
    (u.uFogColor.value as THREE.Color).copy(fog.color);
    u.uFogNear.value = fog.near;
    u.uFogFar.value = fog.far;
  }
  tmp.copy(focusPt).sub(camera.position);
  const extra = shot.post?.(f) ?? {};
  return {
    exposure: light.exposure,
    grade: light.grade,
    inkWidth: ink?.width ?? 3.6,
    inkColor: ink?.color ?? "#0f0b18",
    focus: Math.max(0.2, tmp.dot(fwd)),
    cInf: lens.cInf,
    bloom: light.bloom,
    bloomThreshold: 1.5,
    flash: extra.flash ?? 0,
    fade: extra.fade ?? 0,
    glitch: extra.glitch ?? 0,
    seed: f,
    motion: shutterMotion(shot, f, new THREE.Vector3(...c.look), size[0], size[1]),
    fog: shot.fog ? { color: fog.color, near: fog.near * 0.5, far: fog.far } : null,
  };
};

/** Disposes every geometry, material and texture under `root` (three re-uploads them if they are used again). */
const disposeTree = (root: THREE.Object3D) => {
  const seen = new Set<unknown>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        if (value instanceof THREE.Texture && !seen.has(value)) {
          seen.add(value);
          value.dispose();
        }
      }
      const uniforms = (m as THREE.ShaderMaterial).uniforms;
      if (uniforms)
        for (const u of Object.values(uniforms))
          if (u?.value instanceof THREE.Texture && !seen.has(u.value)) {
            seen.add(u.value);
            u.value.dispose();
          }
      m.dispose();
    }
  });
};

const Stage = <W extends ToonWorld>({ frame, build, shots, dissolves = [], ink }: ToonFilmProps<W> & { frame: number }) => {
  const { gl, scene, camera } = useThree();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the world is built once per mount
  const world = useMemo(build, []);
  const pipeline = useMemo(() => {
    const s = gl.getDrawingBufferSize(new THREE.Vector2());
    return new Pipeline(s.x, s.y);
  }, [gl]);
  useMemo(() => {
    scene.fog = new THREE.Fog("#000000", 400, 900);
  }, [scene]);
  // Free the GPU side on unmount: the editor remounts the film on every source change and every captured frame,
  // and an undisposed pipeline + world (hundreds of MB at 1080×1920) per mount crashes the page. The WebGL context
  // itself is released once its canvas has left the page (Chrome refuses new contexts past ~16 live ones); a
  // StrictMode re-run keeps the canvas connected, so it keeps its context.
  useEffect(
    () => () => {
      pipeline.dispose();
      disposeTree(world.root);
      setTimeout(() => {
        if (gl.domElement.isConnected) return;
        try {
          gl.dispose();
          gl.forceContextLoss();
        } catch {}
      }, 0);
    },
    [pipeline, world, gl],
  );
  const state = useRef({ frame, shots, dissolves, ink });
  state.current = { frame, shots, dissolves, ink };

  // Priority 1 takes over rendering from R3F: the pipeline draws the frame itself.
  useFrame(() => {
    const { frame: f, shots: list, dissolves: ds, ink: look } = state.current;
    const cam = camera as THREE.PerspectiveCamera;
    const size: [number, number] = [pipeline.w, pipeline.h];
    const v = viewsAt(list, ds, f);
    if (!v.b) {
      pipeline.renderView(gl, scene, cam, direct(world, cam, scene, v.a, look, size), null);
      return;
    }
    pipeline.renderView(gl, scene, cam, direct(world, cam, scene, v.a, look, size), pipeline.outA);
    pipeline.renderView(gl, scene, cam, direct(world, cam, scene, v.b, look, size), pipeline.outB);
    pipeline.blend(gl, v.t);
  }, 1);

  return <primitive object={world.root} dispose={null} />;
};

/** Fonts the painted textures use (glyphs, screens, signs); the world is built only once they are loaded. */
export const TOON_FONTS = ["Baloo 2", "JetBrains Mono", "Lilita One"];

/**
 * Loads the fonts painted textures use and holds the render until they are in; true once they are. Anything that
 * paints text into a canvas once (signs, screens, glyph atlases) must be built only after this is true, or the
 * fallback font is baked in. (`document.fonts.load` alone is not enough: it resolves at once for an unregistered face.)
 */
export const useToonFonts = (families: readonly string[] = TOON_FONTS) => {
  const [ready, setReady] = useState(false);
  const key = families.join("|");
  useEffect(() => {
    const handle = delayRender("Loading the toon film's fonts", { timeoutInMilliseconds: 30000 });
    Promise.all(key.split("|").map((family) => loadFont({ family, weight: "all" }).catch(() => {}))).finally(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [key]);
  return ready;
};

/** Renders a toon 3D film (see the toon-3d-story skill). Size defaults to the composition's. */
export const ToonFilm = <W extends ToonWorld>(props: ToonFilmProps<W>) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const width = props.width ?? video.width;
  const height = props.height ?? video.height;
  const ready = useToonFonts();
  if (!ready) return null;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      shadows="percentage"
      flat
      gl={{ antialias: false, stencil: false, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: 36, near: 0.05, far: 80, position: [0, 1.5, 3] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <Stage {...props} frame={frame} />
    </ThreeCanvas>
  );
};
