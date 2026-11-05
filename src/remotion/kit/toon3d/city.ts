import * as THREE from "three";
import { rng } from "./chars/pen";
import { canvasTex, prDocTex } from "./paint";
import { NOINK } from "./pipeline";
import { toon } from "./toon";

/**
 * The PR city at night: towers of pull-request documents stacked like paper, lining a street where Mehmet stands
 * (at the origin, looking down the street toward −z). Messy stacks (each slab nudged and turned), some slabs glowing
 * green / red / cyan like diff lines, a violet fog, a gradient sky with a moon. Slabs can fall onto the towers.
 */
export type City = ReturnType<typeof buildCity>;

const SLAB = { w: 4.6, h: 0.5, d: 3.3 };

export const buildCity = () => {
  const group = new THREE.Group();
  const r = rng(2024);

  // ground: asphalt, sidewalks, a dashed centre line
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    toon({
      map: canvasTex(
        1024,
        1024,
        (g, w, h) => {
          g.fillStyle = "#36305e";
          g.fillRect(0, 0, w, h);
          g.fillStyle = "#4a4378";
          g.fillRect(0, 0, w * 0.18, h);
          g.fillRect(w * 0.82, 0, w * 0.18, h);
          g.fillStyle = "#ffd23f";
          for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 6, y, 12, 64);
          g.fillStyle = "rgba(0,0,0,0.15)";
          for (let y = 0; y < h; y += 64) g.fillRect(0, y, w * 0.18, 3);
        },
        { repeat: [1, 24] },
      ),
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.scale.set(0.11, 1, 1);
  ground.position.set(0, 0, -100);
  ground.receiveShadow = true;
  group.add(ground);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon({ color: "#2b2650" }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = -0.02;
  plaza.receiveShadow = true;
  group.add(plaza);

  // towers: footprints along both sides of the street and in blocks behind
  type Tower = { x: number; z: number; n: number; rot: number };
  const towers: Tower[] = [];
  for (let z = 4; z > -150; z -= 9 + r() * 3) {
    for (const side of [-1, 1]) {
      const near = Math.max(0, 1 - Math.abs(z) / 60);
      towers.push({ x: side * (8.5 + r() * 1.5), z, n: Math.round(18 + r() * 34 + near * 30), rot: (r() - 0.5) * 0.3 });
      towers.push({ x: side * (17 + r() * 4), z: z - 4, n: Math.round(26 + r() * 50), rot: (r() - 0.5) * 0.4 });
      if (r() < 0.7) towers.push({ x: side * (28 + r() * 8), z: z + 2, n: Math.round(30 + r() * 60), rot: (r() - 0.5) * 0.5 });
    }
  }
  // slabs, split over four PR-document textures for variety
  const docs = [0, 1, 2, 3].map((i) => prDocTex(40 + i));
  const edge = toon({
    map: canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = "#efeadc";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(110,100,150,0.4)";
      for (let y = 5; y < h; y += 8) g.fillRect(0, y, w, 1.5);
    }),
  });
  const xfs: THREE.Matrix4[][] = [[], [], [], []];
  const glowXf: THREE.Matrix4[] = [];
  const glowCol: THREE.Color[] = [];
  const tops: { x: number; z: number; y: number; rot: number }[] = [];
  const glowColors = ["#4dff9a", "#ff4d6d", "#5ff3ff", "#ffd23f"].map((c) => new THREE.Color(c).multiplyScalar(2.4));
  for (const t of towers) {
    let y = 0;
    for (let i = 0; i < t.n; i++) {
      const jx = (r() - 0.5) * 0.35;
      const jz = (r() - 0.5) * 0.35;
      const rot = t.rot + (r() - 0.5) * 0.14;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(t.x + jx, y + SLAB.h / 2, t.z + jz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      xfs[Math.floor(r() * 4)].push(m);
      if (r() < 0.12) {
        glowXf.push(m.clone().multiply(new THREE.Matrix4().makeScale(1.012, 0.36, 1.012)));
        glowCol.push(glowColors[Math.floor(r() * glowColors.length)]);
      }
      y += SLAB.h * (0.98 + r() * 0.06);
    }
    tops.push({ x: t.x, z: t.z, y, rot: t.rot });
  }
  const geo = new THREE.BoxGeometry(SLAB.w, SLAB.h, SLAB.d);
  docs.forEach((tex, i) => {
    const top = toon({ map: tex });
    const mesh = new THREE.InstancedMesh(geo, [edge, edge, top, edge, edge, edge], xfs[i].length);
    xfs[i].forEach((m, k) => {
      mesh.setMatrixAt(k, m);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  const glowMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), glowXf.length);
  glowXf.forEach((m, k) => {
    glowMesh.setMatrixAt(k, m);
    glowMesh.setColorAt(k, glowCol[k]);
  });
  glowMesh.frustumCulled = false;
  group.add(glowMesh);

  // falling slabs (posed per frame)
  const falling = new THREE.InstancedMesh(geo, [edge, edge, toon({ map: docs[1] }), edge, edge, edge], 24);
  falling.castShadow = true;
  falling.frustumCulled = false;
  falling.count = 0;
  group.add(falling);

  // street lamps along the sidewalks: warm glowing heads
  const poleMat = toon({ color: "#2a2148" });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffcf8a").multiplyScalar(3), toneMapped: false });
  for (let z = 2; z > -120; z -= 12) {
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 8), poleMat);
      pole.position.set(s * 5.6, 2.5, z);
      pole.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), headMat);
      head.position.set(s * 5.3, 5.05, z);
      group.add(pole, head);
    }
  }

  // sky dome: indigo → violet → a warm glow at the horizon, a moon, stars
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color("#0b0d2c") },
        mid: { value: new THREE.Color("#3b2a78") },
        hor: { value: new THREE.Color("#c4568a") },
      },
      vertexShader:
        "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
        void main(){ float e = clamp(vP.y, 0.0, 1.0);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, e)); c = mix(c, top, smoothstep(0.18, 0.75, e));
          gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  sky.layers.set(NOINK);
  sky.renderOrder = -1;
  group.add(sky);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3d6").multiplyScalar(2.6), toneMapped: false, fog: false }),
  );
  moon.position.set(-60, 150, -380);
  moon.lookAt(0, 0, 0);
  moon.layers.set(NOINK);
  group.add(moon);
  const starPos = new Float32Array(900);
  for (let i = 0; i < 300; i++) {
    const a = r() * Math.PI * 2;
    const e = 0.15 + r() * 1.3;
    starPos.set([Math.cos(a) * Math.cos(e) * 450, Math.sin(e) * 450, Math.sin(a) * Math.cos(e) * 450], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: new THREE.Color("#ffffff").multiplyScalar(1.6),
      size: 2.2,
      sizeAttenuation: false,
      fog: false,
      toneMapped: false,
    }),
  );
  stars.layers.set(NOINK);
  group.add(stars);

  const fog = new THREE.Fog("#3a2b6e", 28, 210);

  /** Drops `n` slabs onto the nearest towers' tops; `t` is the shot's seconds. */
  const poseFalling = (t: number, n: number) => {
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n && k < falling.instanceMatrix.count; i++) {
      const tw = tops[(i * 7) % Math.min(tops.length, 40)];
      const start = i * 0.18;
      const lt = t - start;
      if (lt < 0) continue;
      const fall = Math.min(1, lt / 0.55);
      const y = tw.y + 30 * (1 - fall * fall) + SLAB.h / 2;
      m.compose(
        new THREE.Vector3(tw.x, y, tw.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tw.rot + (1 - fall) * 0.8, (1 - fall) * 0.3)),
        new THREE.Vector3(1, 1, 1),
      );
      falling.setMatrixAt(k++, m);
    }
    falling.count = k;
    falling.instanceMatrix.needsUpdate = true;
  };

  return { group, fog, poseFalling, tops };
};
