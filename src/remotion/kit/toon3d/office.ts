import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { AITerminal } from "./ai";
import { rng } from "./chars/pen";
import {
  bookSpine,
  canvasTex,
  clockFace,
  keyboardTex,
  neonTex,
  posterTex,
  prDocTex,
  type SkyMode,
  skyline,
  wallPaint,
  whiteboardTex,
  woodFloor,
} from "./paint";
import { NOINK } from "./pipeline";
import { drawCode, Screen } from "./screens";
import { glow, toon } from "./toon";

/** Slabs in the paper stack on the desk (a prop a shot can reveal one by one). */
const SLAB_N = 26;

/**
 * The open-plan office, modelled in code. Mehmet's desk sits at the origin, facing +z (the camera side). Rows of
 * desks with AI terminals fill the floor (instanced). Floor-to-ceiling windows on the back wall look onto a painted
 * skyline; the key light comes through them. Units are metres.
 */
export const PALETTE = {
  wallCream: "#f4e5cf",
  wallCoral: "#ef8a6b",
  frame: "#2f6f78",
  deskTop: "#f7f3ea",
  deskLeg: "#3aa8a0",
  panel: "#ef6f5b",
  chair: "#f07a54",
  chairDark: "#3d3552",
  ceiling: "#f3eee6",
  pot: "#d9774f",
  leaf: "#3f9e5a",
  leafLight: "#6cc06d",
};

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r = 0) => {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** Instanced copies of one geometry at given transforms. */
const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, xf: THREE.Matrix4[]) => {
  const m = new THREE.InstancedMesh(geo, mat, xf.length);
  xf.forEach((x, i) => {
    m.setMatrixAt(i, x);
  });
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
};
const at = (x: number, y: number, z: number, ry = 0, s = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(s, s, s),
  );

/** Unlit, instanced screens with a per-instance scroll offset and glow (code or faces on every terminal). */
class InstancedScreenMaterial extends THREE.ShaderMaterial {
  constructor(map: THREE.Texture) {
    super({
      uniforms: { map: { value: map }, uGlow: { value: 1.4 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aOff;
        varying vec2 vUv;
        varying float vOff;
        void main() {
          vUv = uv;
          vOff = aOff;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float uGlow;
        uniform float uTime;
        varying vec2 vUv;
        varying float vOff;
        void main() {
          vec2 uv = vec2(vUv.x, fract(vUv.y * 0.5 + vOff + uTime));
          gl_FragColor = vec4(texture2D(map, uv).rgb * uGlow * (0.85 + 0.3 * fract(vOff * 7.0)), 1.0);
        }`,
    });
  }
}

export type Office = ReturnType<typeof buildOffice>;

export const buildOffice = () => {
  const group = new THREE.Group();
  const P = PALETTE;

  // ---- floor, walls, ceiling -------------------------------------------------------------------------------------
  const floorMat = toon({ map: woodFloor() });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const rugMat = toon({
    map: canvasTex(1024, 1024, (g, w) => {
      g.clearRect(0, 0, w, w);
      const rings = ["#5aa69e", "#e9dcc5", "#5aa69e"];
      rings.forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(w / 2, w / 2, [w / 2 - 4, w / 2 - 70, w / 2 - 92][i], 0, Math.PI * 2);
        g.fill();
      });
    }),
    transparent: true,
    alphaTest: 0.5,
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.6, 0.004, 2.9);
  rug.receiveShadow = true;
  group.add(rug);
  const frameMat = toon({ color: P.frame });
  const wallCream = toon({ map: wallPaint(P.wallCream, 3) });
  const wallCoral = toon({ map: wallPaint(P.wallCoral, 5) });
  // back wall: windows between mullions
  const backZ = -9;
  const back = new THREE.Group();
  back.add(box(32, 0.55, 0.3, frameMat, 0, 0.275, backZ));
  back.add(box(32, 0.7, 0.3, wallCream, 0, 3.25, backZ));
  for (let x = -15; x <= 15; x += 2.5) back.add(box(0.16, 2.4, 0.3, frameMat, x, 1.75, backZ));
  back.add(box(32, 0.08, 0.14, frameMat, 0, 2.1, backZ + 0.05));
  group.add(back);
  // side walls: coral on the left, cream with posters on the right; a front wall
  group.add(box(0.3, 3.6, 24, wallCoral, -15.5, 1.8, 0));
  group.add(box(0.3, 3.6, 24, wallCream, 15.5, 1.8, 0));
  group.add(box(32, 3.6, 0.3, wallCream, 0, 1.8, 11.5));
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), toon({ map: posterTex(11 + i) }));
    p.position.set(15.33, 1.7, -6 + i * 3.4);
    p.rotation.y = -Math.PI / 2;
    group.add(p);
  }

  const ceiling = new THREE.Group();
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), toon({ color: P.ceiling }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.6;
  ceiling.add(ceil);
  // pendant lamps over the rows
  const shadeMat = toon({ color: "#2f6f78" });
  const bulbOn = glow("#ffe2a8", 3.2);
  const lampXf: THREE.Matrix4[] = [];
  for (let z = -7.2; z <= 7.2; z += 3.6) for (let x = -12; x <= 12; x += 4) lampXf.push(at(x, 2.75, z - 0.3));
  ceiling.add(instanced(new THREE.CylinderGeometry(0.12, 0.34, 0.26, 20, 1, true), shadeMat, lampXf));
  const bulbs = instanced(
    new THREE.SphereGeometry(0.1, 12, 8),
    bulbOn,
    lampXf.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.1, 0))),
  );
  bulbs.castShadow = false;
  ceiling.add(bulbs);
  ceiling.add(
    instanced(
      new THREE.CylinderGeometry(0.008, 0.008, 0.85, 4),
      shadeMat,
      lampXf.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.55, 0))),
    ),
  );
  group.add(ceiling);

  // ---- outside: the painted city behind the windows (unlit) --------------------------------------------------
  const skies: Record<SkyMode, THREE.Texture> = { morning: skyline("morning"), night: skyline("night"), dawn: skyline("dawn") };
  const backdropMat = new THREE.MeshBasicMaterial({ map: skies.morning, toneMapped: false, fog: false });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), backdropMat);
  backdrop.position.set(0, 12, -40);
  backdrop.layers.set(NOINK);
  group.add(backdrop);
  // ground outside (below the window line, mostly hidden)
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), new THREE.MeshBasicMaterial({ color: "#6a6f9a" }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.set(0, -0.02, -30);
  outside.layers.set(NOINK);
  group.add(outside);

  // ---- generic desks (instanced): every desk has an AI terminal ---------------------------------------------
  const deskTopMat = toon({ color: P.deskTop });
  const legMat = toon({ color: P.deskLeg });
  const panelMat = toon({ color: P.panel });
  const chairMat = toon({ color: P.chair });
  const chairDark = toon({ color: P.chairDark });
  const termBody = toon({ color: "#e7e1fb" });
  const termAccent = toon({ color: "#8b6cf0" });
  const seats: { x: number; z: number }[] = [];
  for (let z = -7.2; z <= 7.2; z += 3.6)
    for (let x = -12.6; x <= 12.61; x += 1.8) {
      if (Math.abs(x) < 0.1 && Math.abs(z) < 0.1) continue; // Mehmet's own desk
      if (z > 1 && Math.abs(x) < 4.2) continue; // an open aisle in front of his desk (the boss walks here)
      seats.push({ x, z });
    }
  const D = (dx: number, dy: number, dz: number, ry = 0) => seats.map((s) => at(s.x + dx, dy, s.z + dz, ry));
  group.add(instanced(new RoundedBoxGeometry(1.62, 0.05, 0.8, 2, 0.015), deskTopMat, D(0, 0.725, 0)));
  group.add(instanced(new THREE.BoxGeometry(0.06, 0.7, 0.7), legMat, D(-0.74, 0.35, 0)));
  group.add(instanced(new THREE.BoxGeometry(0.06, 0.7, 0.7), legMat, D(0.74, 0.35, 0)));
  group.add(instanced(new THREE.BoxGeometry(1.46, 0.38, 0.03), panelMat, D(0, 0.42, 0.36)));
  // chairs
  group.add(instanced(new RoundedBoxGeometry(0.52, 0.09, 0.5, 2, 0.04), chairMat, D(0, 0.47, -0.78)));
  group.add(instanced(new RoundedBoxGeometry(0.5, 0.56, 0.08, 2, 0.04), chairMat, D(0, 0.86, -1.04)));
  group.add(instanced(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 8), chairDark, D(0, 0.24, -0.78)));
  group.add(instanced(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 5), chairDark, D(0, 0.04, -0.78)));
  // terminals (left side of each desk, turned a little toward the seat)
  const termXf = D(-0.42, 0.75, 0.08, 0.35);
  group.add(
    instanced(
      new RoundedBoxGeometry(0.34, 0.035, 0.24, 2, 0.015),
      termAccent,
      termXf.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.0175, 0))),
    ),
  );
  group.add(
    instanced(
      new THREE.CylinderGeometry(0.045, 0.06, 0.12, 12),
      termAccent,
      termXf.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.09, 0))),
    ),
  );
  group.add(
    instanced(
      new RoundedBoxGeometry(0.6, 0.46, 0.42, 3, 0.07),
      termBody,
      termXf.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.37, 0))),
    ),
  );
  const rowScreen = new Screen(512, 768);
  const rowScreenMat = new InstancedScreenMaterial(rowScreen.texture);
  rowScreen.texture.wrapT = THREE.RepeatWrapping;
  const screens = instanced(
    new THREE.PlaneGeometry(0.48, 0.345),
    rowScreenMat,
    termXf.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.375, 0.2165))),
  );
  const offs = new Float32Array(seats.length);
  const r = rng(99);
  for (let i = 0; i < offs.length; i++) offs[i] = r();
  screens.geometry.setAttribute("aOff", new THREE.InstancedBufferAttribute(offs, 1));
  screens.castShadow = false;
  group.add(screens);
  // keyboards on every desk
  const kbMat = toon({ map: keyboardTex() });
  group.add(instanced(new THREE.BoxGeometry(0.44, 0.02, 0.15), kbMat, D(0.05, 0.76, -0.2)));

  // ---- Mehmet's desk (unique, detailed) --------------------------------------------------------------------
  const desk = new THREE.Group();
  desk.add(box(1.62, 0.05, 0.8, deskTopMat, 0, 0.725, 0, 0.015));
  desk.add(box(0.06, 0.7, 0.7, legMat, -0.74, 0.35, 0));
  desk.add(box(0.06, 0.7, 0.7, legMat, 0.74, 0.35, 0));
  desk.add(box(1.46, 0.38, 0.03, panelMat, 0, 0.42, 0.36));
  const chair = new THREE.Group();
  chair.add(box(0.52, 0.09, 0.5, chairMat, 0, 0.47, -0.82, 0.04));
  chair.add(box(0.5, 0.6, 0.08, chairMat, 0, 0.9, -1.1, 0.04));
  chair.add(box(0.07, 0.4, 0.07, chairDark, 0, 0.24, -0.82));
  desk.add(chair);
  // keyboard + mouse
  const kb = box(0.44, 0.02, 0.15, kbMat, 0.04, 0.76, -0.2);
  desk.add(kb);
  desk.add(box(0.07, 0.03, 0.1, toon({ color: "#d9dbe6" }), 0.36, 0.765, -0.2, 0.012));
  // Mehmet's monitor: to his right, turned toward him and a little toward the camera
  const monitor = new THREE.Group();
  monitor.add(box(0.66, 0.42, 0.035, toon({ color: "#2b2440" }), 0, 0.31, 0, 0.012));
  monitor.add(box(0.05, 0.22, 0.05, toon({ color: "#2b2440" }), 0, 0.11, 0.03));
  monitor.add(box(0.26, 0.02, 0.18, toon({ color: "#2b2440" }), 0, 0.01, 0.03));
  const monitorScreen = new Screen(1024, 640);
  const monitorMat = new THREE.MeshBasicMaterial({ map: monitorScreen.texture, toneMapped: false });
  const mscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), monitorMat);
  mscreen.position.set(0, 0.31, -0.019);
  mscreen.rotation.y = Math.PI;
  monitor.add(mscreen);
  // sticky notes on the bezel
  for (const [i, c] of ["#ffe066", "#ff9fb2", "#9be7a8"].entries()) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), toon({ color: c }));
    n.position.set(-0.3 + i * 0.07, 0.49 - (i % 2) * 0.02, -0.02);
    n.rotation.set(0, Math.PI, 0.1 * (i - 1));
    n.layers.set(NOINK);
    monitor.add(n);
  }
  monitor.position.set(0.36, 0.75, 0.16);
  monitor.rotation.y = 0.5;
  desk.add(monitor);
  // the hero AI terminal on his left, facing the camera, turned toward him
  const ai = new AITerminal();
  ai.group.position.set(-0.52, 0.75, 0.06);
  ai.group.rotation.y = 0.42;
  desk.add(ai.group);
  // ten years of books
  const books = new THREE.Group();
  let by = 0.75;
  for (let i = 0; i < 7; i++) {
    const h = 0.05 + (i % 3) * 0.012;
    const spine = bookSpine(i);
    const mats = [
      toon({ color: "#f3ead6" }),
      toon({ color: "#f3ead6" }),
      toon({ color: "#e9dfc6" }),
      toon({ color: "#e9dfc6" }),
      toon({ map: spine }),
      toon({ map: spine }),
    ];
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3 - (i % 2) * 0.03, h, 0.22), mats);
    b.position.set(-0.88 + ((i * 7) % 5) * 0.006, by + h / 2, -0.12);
    b.rotation.y = 0.12 * Math.sin(i * 2.3);
    b.castShadow = b.receiveShadow = true;
    books.add(b);
    by += h;
  }
  books.position.set(1.48, 0, -0.1);
  desk.add(books);
  // coffee mug (+ the extra cups of the night)
  const mugMat = toon({ color: "#fdfaf3" });
  const mug = new THREE.Group();
  mug.add(box(0.001, 0.001, 0.001, mugMat));
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 20), mugMat);
  mugBody.position.y = 0.05;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), toon({ color: "#4a2a1a" }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.092;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 16), mugMat);
  handle.position.set(0.05, 0.05, 0);
  mug.add(mugBody, coffee, handle);
  mug.position.set(-0.2, 0.75, -0.24);
  mugBody.castShadow = true;
  desk.add(mug);
  const cups = new THREE.Group();
  const cupMat = toon({ color: "#f6efe2" });
  const sleeveMat = toon({ color: "#c46a3b" });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.12, 16), cupMat);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.034, 0.045, 16), sleeveMat);
    body.position.y = 0.06;
    sl.position.y = 0.06;
    c.add(body, sl);
    c.position.set(0.32 + (i % 3) * 0.09, 0.75 + Math.floor(i / 3) * 0.12, -0.32 - (i % 2) * 0.07);
    cups.add(c);
  }
  desk.add(cups);
  // rubber duck (debugging, obviously)
  const duck = new THREE.Group();
  const duckMat = toon({ color: "#ffd23f" });
  const dBody = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), duckMat);
  dBody.scale.set(1.2, 0.85, 1);
  dBody.position.y = 0.04;
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), duckMat);
  dHead.position.set(0.03, 0.095, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 10), toon({ color: "#ff8a3d" }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.065, 0.092, 0);
  duck.add(dBody, dHead, beak);
  duck.position.set(0.6, 0.75 + 0.43, -0.22);
  duck.rotation.y = -1.9;
  desk.add(duck);
  // desk lamp (warm pool at night)
  const lamp = new THREE.Group();
  const lampMat = toon({ color: "#2f6f78" });
  lamp.add(box(0.14, 0.02, 0.14, lampMat, 0, 0.01, 0, 0.008));
  const arm = box(0.02, 0.42, 0.02, lampMat, 0, 0.22, 0);
  arm.rotation.z = 0.25;
  lamp.add(arm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 20, 1, true), lampMat);
  shade.position.set(-0.08, 0.43, 0);
  shade.rotation.z = 0.9;
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), glow("#ffd59a", 3.6));
  lampBulb.position.set(-0.11, 0.4, 0);
  lamp.add(shade, lampBulb);
  lamp.position.set(0.74, 0.75, 0.25);
  lamp.rotation.y = 2.2;
  desk.add(lamp);
  group.add(desk);

  // ---- PR stack on the desk (grows on "üst üste biniyor") -------------------------------------------------------
  const prStack = new THREE.Group();
  prStack.position.set(-0.98, 0, -1.15);
  {
    const edges = ["#f6f1e4", "#c9f2d6", "#ffd6dc", "#d4e4ff"].map((c) => toon({ color: c }));
    const tops = [0, 1, 2].map((i) => toon({ map: prDocTex(70 + i) }));
    for (let k = 0; k < SLAB_N; k++) {
      const e = edges[k % 4];
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.068, 0.38), [e, e, tops[k % 3], e, e, e]);
      s.position.y = k * 0.072 + 0.034;
      s.castShadow = s.receiveShadow = true;
      s.visible = false;
      prStack.add(s);
    }
  }
  desk.add(prStack);

  // ---- column with the wall clock, the rolling whiteboard, the neon sign, plants ------------------------------
  const column = box(0.7, 3.6, 0.7, wallCream, 1.25, 1.8, -2.6);
  group.add(column);
  const clock = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 40), toon({ color: "#2a1c38" }));
  rim.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), toon({ map: clockFace() }));
  face.position.z = 0.031;
  const handMat = toon({ color: "#2a1c38" });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.01), handMat);
  hourHand.geometry.translate(0, 0.07, 0);
  hourHand.position.z = 0.045;
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.25, 0.01), handMat);
  minuteHand.geometry.translate(0, 0.1, 0);
  minuteHand.position.z = 0.055;
  const secondHand = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.26, 0.006), toon({ color: "#e4483b" }));
  secondHand.geometry.translate(0, 0.09, 0);
  secondHand.position.z = 0.062;
  clock.add(rim, face, hourHand, minuteHand, secondHand);
  clock.position.set(1.25, 2.35, -2.22);
  group.add(clock);

  const wb = new THREE.Group();
  const wbFrame = toon({ color: "#c9cfdc" });
  wb.add(box(1.5, 0.95, 0.04, wbFrame, 0, 1.45, 0, 0.01));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.88), toon({ map: whiteboardTex() }));
  board.position.set(0, 1.45, 0.022);
  wb.add(board);
  for (const s of [-1, 1]) {
    wb.add(box(0.04, 1.0, 0.04, wbFrame, s * 0.7, 0.5, 0));
    wb.add(box(0.04, 0.04, 0.5, wbFrame, s * 0.7, 0.05, 0));
  }
  wb.position.set(2.15, 0, -1.3);
  wb.rotation.y = -0.35;
  group.add(wb);

  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.71),
    new THREE.MeshBasicMaterial({
      map: neonTex("</>", "#ff4fd8"),
      color: new THREE.Color(2.4, 2.4, 2.4),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  neon.position.set(-2.8, 2.55, -8.55);
  neon.layers.set(NOINK);
  group.add(neon);

  const plants = new THREE.Group();
  const potMat = toon({ color: P.pot });
  const leafMats = [toon({ color: P.leaf }), toon({ color: P.leafLight })];
  const plant = (x: number, z: number, s: number, seed: number) => {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, 0.42, 20), potMat);
    pot.position.y = 0.21;
    pot.castShadow = true;
    g.add(pot);
    const rr = rng(seed);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), leafMats[i % 2]);
      const a = (i / 9) * Math.PI * 2 + rr();
      const rad = 0.12 + rr() * 0.22;
      leaf.scale.set(1.2, 0.32, 0.75);
      leaf.position.set(Math.cos(a) * rad, 0.62 + rr() * 0.75, Math.sin(a) * rad);
      leaf.rotation.set(rr() * 0.8 - 0.4, a, (rr() - 0.5) * 1.2);
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    plants.add(g);
  };
  plant(1.75, -0.45, 1.25, 3);
  plant(-2.05, -1.6, 1.1, 8);
  plant(-6.6, -8.3, 1.4, 12);
  plant(5.4, -8.3, 1.3, 17);
  plant(9.2, -1.8, 1.2, 21);
  group.add(plants);

  return {
    group,
    floor,
    ceiling,
    backdrop,
    backdropMat,
    skies,
    desk,
    monitorScreen,
    monitorMat,
    ai,
    books,
    mug,
    cups,
    duck,
    lampBulb,
    prStack,
    clock: { hourHand, minuteHand, secondHand },
    whiteboard: wb,
    neon,
    rowScreen,
    rowScreenMat,
    seats,
    drawRowScreens: (scroll: number) =>
      rowScreen.draw(`row${Math.floor(scroll * 4)}`, (g, w, h) =>
        drawCode(g, w, h, { scroll: Math.floor(scroll * 4) / 4, rows: 24, gutter: false, bg: "#0b1433" }),
      ),
  };
};
