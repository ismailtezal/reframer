import * as THREE from "three";
import { NOINK } from "./pipeline";
import { CardMaterial } from "./toon";

/**
 * A 2D drawing living in the 3D world: a canvas (redrawn only when its state changes), a camera-facing plane
 * anchored at its bottom centre, lit by the scene through CardMaterial. Cards sit on layer NOINK: the world ink never
 * outlines them, and they hide the world's lines behind them.
 */
export class Card {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh;
  readonly mat: CardMaterial;
  private lastKey = "";
  private scale: number;

  /**
   * @param designW design units across (1 unit = 1 mm in the world)
   * @param designH design units tall
   * @param pxPerUnit canvas resolution
   */
  constructor(
    readonly designW: number,
    readonly designH: number,
    pxPerUnit: number,
  ) {
    this.scale = pxPerUnit;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(designW * pxPerUnit);
    this.canvas.height = Math.round(designH * pxPerUnit);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mat = new CardMaterial(this.texture);
    const geo = new THREE.PlaneGeometry(designW / 1000, designH / 1000);
    geo.translate(0, designH / 2000, 0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.layers.set(NOINK);
    this.mesh.frustumCulled = false;
  }

  /** Redraws when `key` changes (a JSON of the drawing state). */
  draw(key: string, fn: (ctx: CanvasRenderingContext2D) => void) {
    if (key === this.lastKey) return;
    this.lastKey = key;
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    fn(ctx);
    this.texture.needsUpdate = true;
  }

  /** Bottom-centre position, turned to face the camera around the vertical axis. */
  place(x: number, y: number, z: number, cam: THREE.Camera, yawBias = 0) {
    this.mesh.position.set(x, y, z);
    const dx = cam.position.x - x;
    const dz = cam.position.z - z;
    this.mesh.rotation.set(0, Math.atan2(dx, dz) + yawBias, 0);
  }
}

/** Soft contact shadow on the floor under a standing card (multiplies the floor). */
export const contactBlob = (radius: number, strength = 0.45) => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) throw new Error("contactBlob: this browser has no 2D canvas");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, `rgba(40,30,80,${strength})`);
  grad.addColorStop(1, "rgba(40,30,80,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 1.2),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.layers.set(NOINK);
  m.renderOrder = 1;
  return m;
};
