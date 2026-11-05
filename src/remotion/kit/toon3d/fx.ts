import * as THREE from "three";
import { NOINK } from "./pipeline";
import { canvasTex } from "./paint";

/**
 * Effects composited into the 3D world as flat cartoon sprites: code glyphs pouring out of the AI, sparkles, Z's,
 * a question mark, and pop-up error windows. Glyphs are camera-facing instanced quads reading a glyph atlas; the
 * director refills them every frame from seeded, analytic trajectories, so any frame renders the same in any order.
 */
export const GLYPHS = ["{", "}", "( )", "=>", ";", "</>", "const", "let", "if", "[ ]", "&&", "0", "1", "#", "fn", "!=", "++", "||", "==", "...", "Z", "?", "★", "✦", "✓", "!", "♪", "</", "λ", "%", "@", "~"];
export const G = Object.fromEntries(GLYPHS.map((g, i) => [g, i])) as Record<string, number>;

const atlas = () =>
  canvasTex(1024, 1024, (g, w) => {
    const cell = w / 8;
    g.clearRect(0, 0, w, w);
    g.textAlign = "center";
    g.textBaseline = "middle";
    GLYPHS.forEach((s, i) => {
      const cx = (i % 8) * cell + cell / 2;
      const cy = Math.floor(i / 8) * cell + cell / 2;
      const big = s.length <= 2;
      g.font = `800 ${big ? cell * 0.62 : cell * (s.length > 4 ? 0.26 : 0.36)}px ${s === "Z" || s === "?" || s === "!" ? "'Baloo 2'" : "'JetBrains Mono'"}, monospace`;
      g.lineJoin = "round";
      g.lineWidth = cell * 0.07;
      g.strokeStyle = "#2a1c38";
      g.strokeText(s, cx, cy + cell * 0.03);
      g.fillStyle = "#ffffff";
      g.fillText(s, cx, cy + cell * 0.03);
    });
  });

class GlyphMaterial extends THREE.ShaderMaterial {
  constructor(map: THREE.Texture, additive: boolean) {
    super({
      uniforms: { map: { value: map } },
      vertexShader: /* glsl */ `
        attribute float aCell;
        attribute vec4 aColor;
        attribute vec2 aSizeRot;
        varying vec2 vUv;
        varying vec4 vColor;
        void main() {
          vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float c = cos(aSizeRot.y), s = sin(aSizeRot.y);
          vec2 p = mat2(c, s, -s, c) * position.xy * aSizeRot.x;
          center.xy += p;
          gl_Position = projectionMatrix * center;
          float col = mod(aCell, 8.0), row = floor(aCell / 8.0);
          vUv = (vec2(col, 7.0 - row) + uv) / 8.0;
          vColor = aColor;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        varying vec4 vColor;
        void main() {
          vec4 t = texture2D(map, vUv);
          ${additive ? "gl_FragColor = vec4(t.rgb * vColor.rgb * t.a * vColor.a, 1.0);" : "gl_FragColor = vec4(mix(vec3(0.16,0.11,0.22), vColor.rgb, t.r) , t.a * vColor.a); if (gl_FragColor.a < 0.03) discard;"}
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }
}

class GlyphLayer {
  readonly mesh: THREE.InstancedMesh;
  private cell: THREE.InstancedBufferAttribute;
  private color: THREE.InstancedBufferAttribute;
  private sizeRot: THREE.InstancedBufferAttribute;
  private n = 0;
  private m = new THREE.Matrix4();
  constructor(map: THREE.Texture, additive: boolean, readonly max: number) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.cell = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.sizeRot = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    geo.setAttribute("aCell", this.cell);
    geo.setAttribute("aColor", this.color);
    geo.setAttribute("aSizeRot", this.sizeRot);
    this.mesh = new THREE.InstancedMesh(geo, new GlyphMaterial(map, additive), max);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(NOINK);
    this.mesh.renderOrder = additive ? 3 : 2;
    this.mesh.count = 0;
  }
  begin() {
    this.n = 0;
  }
  add(pos: THREE.Vector3, size: number, cell: number, color: THREE.Color, alpha = 1, rot = 0) {
    if (this.n >= this.max || alpha <= 0.002 || size <= 0) return;
    this.m.makeTranslation(pos.x, pos.y, pos.z);
    this.mesh.setMatrixAt(this.n, this.m);
    this.cell.setX(this.n, cell);
    this.color.setXYZW(this.n, color.r, color.g, color.b, alpha);
    this.sizeRot.setXY(this.n, size, rot);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cell.needsUpdate = true;
    this.color.needsUpdate = true;
    this.sizeRot.needsUpdate = true;
  }
}

/** A pop-up window (error / fixed) as an unlit card that scales in with a bounce. */
const popupTex = (kind: "error" | "ok") =>
  canvasTex(512, 320, (g, w, h) => {
    const red = kind === "error";
    g.fillStyle = "#2a1c38";
    g.beginPath();
    g.roundRect(6, 10, w - 12, h - 16, 34);
    g.fill();
    g.fillStyle = red ? "#ff4d5e" : "#3ccf7a";
    g.beginPath();
    g.roundRect(14, 4, w - 28, h - 22, 28);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.fillRect(14, 4, w - 28, 54);
    for (const [i, c] of ["#ffd23f", "#ffffff", "#ffffff"].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(52 + i * 36, 31, 10, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 150px 'Baloo 2', sans-serif";
    g.fillText(red ? "!" : "✓", 120, 180);
    g.font = "800 92px 'Baloo 2', sans-serif";
    g.fillText(red ? "HATA" : "TAMAM", 330, 186);
  });

/** A big pop-up word card ("10x"): yellow, ink-outlined, unlit. */
const wordTex = (text: string, color: string) =>
  canvasTex(768, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 300px 'Baloo 2', sans-serif";
    g.lineJoin = "round";
    g.fillStyle = "#2a1c38";
    g.fillText(text, w / 2 + 10, h / 2 + 34);
    g.lineWidth = 34;
    g.strokeStyle = "#2a1c38";
    g.strokeText(text, w / 2, h / 2 + 22);
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 22);
  });

export class Fx {
  readonly group = new THREE.Group();
  readonly tenX: THREE.Mesh;
  readonly glow: GlyphLayer;
  readonly ink: GlyphLayer;
  readonly popups: THREE.Mesh[] = [];
  readonly okPopup: THREE.Mesh;
  constructor() {
    const map = atlas();
    this.glow = new GlyphLayer(map, true, 900);
    this.ink = new GlyphLayer(map, false, 120);
    this.group.add(this.glow.mesh, this.ink.mesh);
    const err = popupTex("error");
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: err, transparent: true, toneMapped: false, depthWrite: true, alphaTest: 0.1 }));
      (m.material as THREE.MeshBasicMaterial).color.setScalar(1.35);
      m.layers.set(NOINK);
      m.visible = false;
      this.popups.push(m);
      this.group.add(m);
    }
    this.okPopup = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: popupTex("ok"), transparent: true, toneMapped: false, alphaTest: 0.1 }));
    (this.okPopup.material as THREE.MeshBasicMaterial).color.setScalar(1.35);
    this.okPopup.layers.set(NOINK);
    this.okPopup.visible = false;
    this.group.add(this.okPopup);
    this.tenX = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: wordTex("10x", "#ffd23f"), transparent: true, toneMapped: false, alphaTest: 0.1 }));
    (this.tenX.material as THREE.MeshBasicMaterial).color.setScalar(1.25);
    this.tenX.layers.set(NOINK);
    this.tenX.visible = false;
    this.group.add(this.tenX);
  }
  begin() {
    this.glow.begin();
    this.ink.begin();
    for (const p of this.popups) p.visible = false;
    this.okPopup.visible = false;
    this.tenX.visible = false;
  }
  end() {
    this.glow.end();
    this.ink.end();
  }
}
