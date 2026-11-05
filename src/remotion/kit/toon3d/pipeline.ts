import * as THREE from "three";

/**
 * The look, as our own render pipeline (no postprocessing library): every pass is a full-screen shader on our own
 * render targets, run once per frame from the Stage's useFrame.
 *
 *   1. scene      → HDR colour (half float, MSAA 4) + depth
 *   2. ink        → world-only normals + depth (camera layer 0), an edge mask (depth jumps from the 2nd difference of
 *                   1/z, normal creases), composited as near-black lines in display gamma. Cards, sky and effects
 *                   live on layer NOINK, so they never get outlined and they hide the lines behind them.
 *   3. lens blur  → thin-lens CoC per pixel, gathered at half resolution (Vogel disc, occlusion-aware: background
 *                   never bleeds over a sharper subject; a blurred foreground spreads over what is behind it)
 *   4. bloom      → only HDR emissives (> 1.0): dual-Kawase down/up chain
 *   5. finish     → exposure, Khronos PBR Neutral tone map, grade (S-curve with lifted blacks, zone saturation,
 *                   split tone, vignette), glitch / flash / fade, dither, sRGB out
 *
 * Every pixel size is given at 1080×1920 and scaled with the drawing buffer height.
 */

export const NOINK = 1;

export type Grade = {
  /** contrast around mid grey (0 = none) */
  contrast: number;
  /** black lift in display units (0.03 = blacks never below ~8/255) */
  lift: number;
  /** multiplies saturation in shadows / mids / highlights */
  sat: [number, number, number];
  /** RGB offsets (display units) added in shadows and highlights */
  shadowTint: [number, number, number];
  highTint: [number, number, number];
  /** vignette strength and start radius */
  vignette: [number, number];
};

export type Post = {
  exposure: number;
  grade: Grade;
  inkWidth: number;
  inkColor: string;
  /** focus distance along the view axis (m) and blur radius at infinity (px @1080); cInf 0 = off */
  focus: number;
  cInf: number;
  bloom: number;
  bloomThreshold: number;
  flash: number;
  fade: number;
  glitch: number;
  /** frame number: drives grain-free dither and glitch blocks deterministically */
  seed: number;
  /** camera motion over the shutter, in px at 1080×1920 (x right, y up); [0, 0] = no blur */
  motion: [number, number];
  fog?: { color: THREE.Color; near: number; far: number } | null;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DEPTH_FN = /* glsl */ `
uniform float cNear;
uniform float cFar;
float distAt(sampler2D t, vec2 uv) {
  float d = textureLod(t, uv, 0.0).x;
  return (cNear * cFar) / (cFar - d * (cFar - cNear));
}`;

const NORMAL_VERT = /* glsl */ `
#include <common>
varying vec3 vN;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  vN = transformedNormal;
  #include <begin_vertex>
  #include <project_vertex>
}`;
const NORMAL_FRAG = /* glsl */ `
varying vec3 vN;
void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  gl_FragColor = vec4(n, 1.0);
}`;

const MASK_FRAG = /* glsl */ `
uniform sampler2D tNormal;
uniform sampler2D tDepthW;
uniform sampler2D tDepthMain;
uniform vec2 texel;
uniform float width;      // silhouette line width (px, output)
uniform float creaseK;    // crease width / silhouette width
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
${DEPTH_FN}
const vec2 STEP[4] = vec2[4](vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, -1.0));
const float SLEN[4] = float[4](1.0, 1.0, 1.41421, 1.41421);

float crease(vec3 n0, float zc, vec2 uq, float zq) {
  vec4 nq = textureLod(tNormal, uq, 0.0);
  if (nq.a < 0.5 || abs(zq - zc) > zc * 0.02) return 0.0;
  return 1.0 - smoothstep(0.64, 0.82, dot(n0, nq.xyz));   // ~35°–50°
}

void main() {
  vec4 nc = textureLod(tNormal, vUv, 0.0);
  if (nc.a < 0.5) { gl_FragColor = vec4(0.0); return; }
  float zc = distAt(tDepthW, vUv);
  // a card / effect nearer than the world here: no world ink over it
  float zm = distAt(tDepthMain, vUv);
  if (zm < zc * 0.985 - 0.02) { gl_FragColor = vec4(0.0); return; }
  float w = width;
  float hc = 0.5 * w * creaseK;
  float Wc = 1.0 / zc;
  float eD = 0.0, eN = 0.0;
  for (int a = 0; a < 4; a++) {
    for (int r = 1; r <= 5; r++) {
      vec2 o = STEP[a] * texel * float(r);
      float d = (float(r) - 0.5) * SLEN[a];
      float cw = clamp(w + 0.5 - d, 0.0, 1.0);
      float ch = clamp(hc + 0.5 - d, 0.0, 1.0);
      if (cw <= 0.0 && ch <= 0.0) break;
      float z1 = distAt(tDepthW, vUv - o), z2 = distAt(tDepthW, vUv + o);
      float s = (1.0 / z1 + 1.0 / z2 - 2.0 * Wc) / Wc;   // < 0: we are the near side of a depth jump
      eD = max(eD, smoothstep(0.012, 0.04, -s) * cw);
      if (ch > 0.0) eN = max(eN, max(crease(nc.xyz, zc, vUv - o, z1), crease(nc.xyz, zc, vUv + o, z2)) * ch);
    }
  }
  float fogK = fogFar > fogNear ? clamp((zc - fogNear) / (fogFar - fogNear), 0.0, 1.0) : 0.0;
  gl_FragColor = vec4(max(eD, eN), fogK, 0.0, 1.0);
}`;

const INK_COMP_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tMask;
uniform vec2 texel;
uniform vec3 inkColor;    // linear
uniform vec3 fogColor;    // linear
varying vec2 vUv;
float m(float x, float y) { return texture2D(tMask, vUv + vec2(x, y) * texel).r; }
void main() {
  float a = (4.0 * m(0.0, 0.0) + 2.0 * (m(1.0, 0.0) + m(-1.0, 0.0) + m(0.0, 1.0) + m(0.0, -1.0))
    + m(1.0, 1.0) + m(-1.0, 1.0) + m(1.0, -1.0) + m(-1.0, -1.0)) / 16.0;
  vec4 c = texture2D(tColor, vUv);
  float fk = texture2D(tMask, vUv).g;
  vec3 ink = mix(inkColor, fogColor, fk * 0.55);
  // blend in display gamma like a drawn line (coverage → darkness is linear on screen)
  vec3 g = pow(max(c.rgb, 0.0), vec3(1.0 / 2.2));
  vec3 gi = pow(ink, vec3(1.0 / 2.2));
  gl_FragColor = vec4(pow(mix(g, gi, a), vec3(2.2)), 1.0);
}`;

const DOF_PREP_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;       // full-res texel
uniform float focus;
uniform float cInf;       // px, output
uniform float maxCoC;     // px, output
varying vec2 vUv;
${DEPTH_FN}
void main() {
  vec3 col = texture2D(tColor, vUv).rgb;   // bilinear = 2x2 average
  float d = distAt(tDepth, vUv + texel * vec2(-0.5, -0.5));
  d = min(d, distAt(tDepth, vUv + texel * vec2(0.5, -0.5)));
  d = min(d, distAt(tDepth, vUv + texel * vec2(-0.5, 0.5)));
  d = min(d, distAt(tDepth, vUv + texel * vec2(0.5, 0.5)));
  float coc = cInf * (1.0 - focus / max(d, 1e-3));
  if (coc < 0.0) coc *= 1.25;
  coc = clamp(coc, -maxCoC, maxCoC);
  gl_FragColor = vec4(col, coc);
}`;

const DOF_TILE_FRAG = /* glsl */ `
uniform sampler2D tPrep;
uniform vec2 texel;       // prep (half-res) texel
varying vec2 vUv;
void main() {
  float m = 0.0;
  for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
    float c = textureLod(tPrep, vUv + (vec2(float(x), float(y)) + 0.5) * texel, 0.0).a;
    m = max(m, -c);
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const DOF_BLUR_FRAG = /* glsl */ `
uniform sampler2D tPrep;
uniform sampler2D tTile;
uniform vec2 texelFull;
uniform vec2 texelTile;
varying vec2 vUv;
#define TAPS 44
#define GOLDEN 2.39996323
void main() {
  vec4 c0 = textureLod(tPrep, vUv, 0.0);
  float cc = c0.a;
  float nearMax = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) nearMax = max(nearMax, textureLod(tTile, vUv + vec2(float(x), float(y)) * texelTile, 0.0).r);
  float R = max(abs(cc), nearMax);
  if (R < 0.75) { gl_FragColor = vec4(c0.rgb, 0.0); return; }
  vec3 acc = c0.rgb; float wsum = 1.0; float nearW = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float rr = sqrt((float(i) + 0.5) / float(TAPS)) * R;
    float a = float(i) * GOLDEN;
    vec4 s = textureLod(tPrep, vUv + vec2(cos(a), sin(a)) * rr * texelFull, 0.0);
    float cs = s.a;
    float spread = abs(cs);
    if (cs > cc + 0.25) spread = min(spread, abs(cc));     // farther: never wider than our own blur
    float w = clamp(spread - rr + 1.0, 0.0, 1.0);
    acc += s.rgb * w; wsum += w;
    if (cs < -0.5 && cs < cc - 0.5) nearW += w;
  }
  gl_FragColor = vec4(acc / wsum, clamp(2.0 * nearW / wsum, 0.0, 1.0));
}`;

const DOF_COMP_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBlur;
uniform sampler2D tDepth;
uniform float focus;
uniform float cInf;
uniform float maxCoC;
varying vec2 vUv;
${DEPTH_FN}
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 b = texture2D(tBlur, vUv);
  float d = distAt(tDepth, vUv);
  float coc = cInf * (1.0 - focus / max(d, 1e-3));
  if (coc < 0.0) coc *= 1.25;
  float t = max(smoothstep(0.8, 2.6, min(abs(coc), maxCoC)), b.a);
  gl_FragColor = vec4(mix(sharp, b.rgb, t), 1.0);
}`;

const BLOOM_PRE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = clamp(l - threshold, 0.0, 4.0);
  float soft = k * k / (4.0 * 0.35 + 1e-4);
  float wgt = max(soft, k) / max(l, 1e-4);
  gl_FragColor = vec4(c * min(wgt, 1.0), 1.0);
}`;
const KAWASE_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;   // source texel
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
const KAWASE_UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 texel;   // source texel
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + texel * vec2(-2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, -2.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, 2.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

const FINISH_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float bloom;
uniform float exposure;
uniform float contrast;
uniform float lift;
uniform vec3 sat;
uniform vec3 shadowTint;
uniform vec3 highTint;
uniform vec2 vignette;
uniform float flash;
uniform float fade;
uniform float glitch;
uniform float seed;
uniform vec2 resolution;
uniform vec2 motion;      // uv units over the shutter
varying vec2 vUv;

// Khronos PBR Neutral tone mapping
vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

vec3 sampleHDR(vec2 uv) {
  return texture2D(tColor, uv).rgb + texture2D(tBloom, uv).rgb * bloom;
}

void main() {
  vec2 uv = vUv;
  vec3 c;
  if (glitch > 0.001) {
    // blocky horizontal tears + RGB split, deterministic per frame
    float row = floor(uv.y * 48.0);
    float h = hash(vec2(row, floor(seed)));
    float tear = step(1.0 - 0.35 * glitch, h) * (hash(vec2(row, seed + 7.0)) - 0.5) * 0.12 * glitch;
    uv.x += tear;
    float split = 0.012 * glitch;
    c = vec3(sampleHDR(uv + vec2(split, 0.0)).r, sampleHDR(uv).g, sampleHDR(uv - vec2(split, 0.0)).b);
    c *= 1.0 + 0.25 * glitch * sin(uv.y * resolution.y * 1.4);
  } else if (dot(motion, motion) > 1e-7) {
    // camera motion blur: 11 taps along the shutter path
    c = vec3(0.0);
    for (int i = 0; i < 11; i++) c += sampleHDR(uv + motion * (float(i) / 10.0 - 0.5));
    c /= 11.0;
  } else {
    c = sampleHDR(uv);
  }
  c = neutral(c * exposure);
  vec3 g = toSRGB(c);
  // S-curve around mid grey, then lifted blacks
  g = clamp(g + contrast * g * (1.0 - g) * (g - 0.5) * 2.0, 0.0, 1.0);
  g = lift + (1.0 - lift) * g;
  float y = dot(g, vec3(0.2126, 0.7152, 0.0722));
  float wS = 1.0 - smoothstep(0.0, 0.5, y);
  float wH = smoothstep(0.5, 1.0, y);
  float wM = 1.0 - wS - wH;
  float s = sat.x * wS + sat.y * wM + sat.z * wH;
  g = max(vec3(y) + s * (g - vec3(y)), 0.0);
  g += shadowTint * wS + highTint * wH;
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y * 1.15;
  float r = length(p) * 0.85;
  g *= 1.0 - vignette.x * smoothstep(vignette.y, 1.15, r);
  g = mix(g, vec3(1.0), flash);
  g = mix(g, vec3(0.0), fade);
  g += (hash(gl_FragCoord.xy + seed * 17.0) - 0.5) / 255.0;   // dither: no banding in the night skies
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

const BLEND_FRAG = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform float t;
varying vec2 vUv;
void main() { gl_FragColor = vec4(mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, t), 1.0); }`;

const rt = (w: number, h: number, o: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    ...o,
  });

export class Pipeline {
  readonly w: number;
  readonly h: number;
  private sceneRT: THREE.WebGLRenderTarget;
  private normalRT: THREE.WebGLRenderTarget;
  private maskRT: THREE.WebGLRenderTarget;
  private inkedRT: THREE.WebGLRenderTarget;
  private prepRT: THREE.WebGLRenderTarget;
  private tileRT: THREE.WebGLRenderTarget;
  private blurRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[];
  private bloomUp: THREE.WebGLRenderTarget[];
  private outRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private black: THREE.DataTexture;
  private normalMat: THREE.ShaderMaterial;
  private mats: Record<string, THREE.ShaderMaterial> = {};
  private quad: THREE.Mesh;
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private clear = new THREE.Color();

  constructor(width: number, height: number) {
    this.w = width;
    this.h = height;
    const w = width;
    const h = height;
    this.sceneRT = rt(w, h, { samples: 4, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    this.normalRT = rt(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
    });
    this.maskRT = rt(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.inkedRT = rt(w, h);
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.prepRT = rt(hw, hh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.tileRT = rt(Math.ceil(hw / 4), Math.ceil(hh / 4), { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.blurRT = rt(hw, hh);
    this.dofRT = rt(w, h);
    this.bloomDown = [];
    this.bloomUp = [];
    let bw = hw;
    let bh = hh;
    for (let i = 0; i < 6; i++) {
      this.bloomDown.push(rt(bw, bh));
      this.bloomUp.push(rt(bw, bh));
      bw = Math.max(2, Math.ceil(bw / 2));
      bh = Math.max(2, Math.ceil(bh / 2));
    }
    this.outRT = [rt(w, h, { type: THREE.UnsignedByteType }), rt(w, h, { type: THREE.UnsignedByteType })];
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    this.normalMat = new THREE.ShaderMaterial({ vertexShader: NORMAL_VERT, fragmentShader: NORMAL_FRAG, side: THREE.DoubleSide });
    const fs = (name: string, frag: string, uniforms: Record<string, THREE.IUniform>) => {
      this.mats[name] = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    };
    const texel = new THREE.Vector2(1 / w, 1 / h);
    fs("mask", MASK_FRAG, {
      tNormal: { value: this.normalRT.texture },
      tDepthW: { value: this.normalRT.depthTexture },
      tDepthMain: { value: this.sceneRT.depthTexture },
      texel: { value: texel },
      width: { value: 3.4 },
      creaseK: { value: 0.75 },
      fogNear: { value: 0 },
      fogFar: { value: 0 },
      cNear: { value: 0.1 },
      cFar: { value: 100 },
    });
    fs("inkComp", INK_COMP_FRAG, {
      tColor: { value: this.sceneRT.texture },
      tMask: { value: this.maskRT.texture },
      texel: { value: texel },
      inkColor: { value: new THREE.Color() },
      fogColor: { value: new THREE.Color() },
    });
    fs("dofPrep", DOF_PREP_FRAG, {
      tColor: { value: this.inkedRT.texture },
      tDepth: { value: this.sceneRT.depthTexture },
      texel: { value: texel },
      focus: { value: 5 },
      cInf: { value: 0 },
      maxCoC: { value: 26 },
      cNear: { value: 0.1 },
      cFar: { value: 100 },
    });
    fs("dofTile", DOF_TILE_FRAG, { tPrep: { value: this.prepRT.texture }, texel: { value: new THREE.Vector2(1 / hw, 1 / hh) } });
    fs("dofBlur", DOF_BLUR_FRAG, {
      tPrep: { value: this.prepRT.texture },
      tTile: { value: this.tileRT.texture },
      texelFull: { value: texel },
      texelTile: { value: new THREE.Vector2(1 / this.tileRT.width, 1 / this.tileRT.height) },
    });
    fs("dofComp", DOF_COMP_FRAG, {
      tColor: { value: this.inkedRT.texture },
      tBlur: { value: this.blurRT.texture },
      tDepth: { value: this.sceneRT.depthTexture },
      focus: { value: 5 },
      cInf: { value: 0 },
      maxCoC: { value: 26 },
      cNear: { value: 0.1 },
      cFar: { value: 100 },
    });
    fs("bloomPre", BLOOM_PRE_FRAG, { tColor: { value: null }, threshold: { value: 1 } });
    fs("down", KAWASE_DOWN_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    fs("up", KAWASE_UP_FRAG, { tSrc: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() } });
    fs("finish", FINISH_FRAG, {
      tColor: { value: null },
      tBloom: { value: null },
      bloom: { value: 0.5 },
      exposure: { value: 1 },
      contrast: { value: 0 },
      lift: { value: 0 },
      sat: { value: new THREE.Vector3(1, 1, 1) },
      shadowTint: { value: new THREE.Vector3() },
      highTint: { value: new THREE.Vector3() },
      vignette: { value: new THREE.Vector2(0.15, 0.5) },
      flash: { value: 0 },
      fade: { value: 0 },
      glitch: { value: 0 },
      seed: { value: 0 },
      resolution: { value: new THREE.Vector2(w, h) },
      motion: { value: new THREE.Vector2() },
    });
    fs("blend", BLEND_FRAG, { tA: { value: null }, tB: { value: null }, t: { value: 0 } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mats.finish);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private pass(renderer: THREE.WebGLRenderer, name: string, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = this.mats[name];
    renderer.setRenderTarget(target);
    renderer.render(this.fsScene, this.fsCam);
  }

  /** Renders one view (scene + camera, already posed) through the whole chain into `target` (null = screen). */
  renderView(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    cam: THREE.PerspectiveCamera,
    post: Post,
    target: THREE.WebGLRenderTarget | null,
  ) {
    const px = this.h / 1920;
    const autoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.getClearColor(this.clear);
    const clearAlpha = renderer.getClearAlpha();

    // 1. scene (all layers)
    cam.layers.enable(0);
    cam.layers.enable(NOINK);
    renderer.shadowMap.autoUpdate = true;
    renderer.setRenderTarget(this.sceneRT);
    renderer.render(scene, cam);

    // 2. ink: world normals + depth (layer 0 only, no background), then the mask and the composite
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.normalMat;
    cam.layers.set(0);
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.normalRT);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    scene.background = bg;
    cam.layers.enable(NOINK);
    renderer.setClearColor(this.clear, clearAlpha);
    renderer.shadowMap.autoUpdate = true;

    const near = cam.near;
    const far = cam.far;
    for (const k of ["mask", "dofPrep", "dofComp"]) {
      this.mats[k].uniforms.cNear.value = near;
      this.mats[k].uniforms.cFar.value = far;
    }
    const mu = this.mats.mask.uniforms;
    mu.width.value = post.inkWidth * px;
    mu.fogNear.value = post.fog?.near ?? 0;
    mu.fogFar.value = post.fog?.far ?? 0;
    this.pass(renderer, "mask", this.maskRT);
    (this.mats.inkComp.uniforms.inkColor.value as THREE.Color).set(post.inkColor);
    if (post.fog) (this.mats.inkComp.uniforms.fogColor.value as THREE.Color).copy(post.fog.color);
    this.pass(renderer, "inkComp", this.inkedRT);

    // 3. lens blur
    let color: THREE.WebGLRenderTarget = this.inkedRT;
    if (post.cInf > 0.2) {
      for (const k of ["dofPrep", "dofComp"]) {
        const u = this.mats[k].uniforms;
        u.focus.value = post.focus;
        u.cInf.value = post.cInf * px;
        u.maxCoC.value = 26 * px;
      }
      this.pass(renderer, "dofPrep", this.prepRT);
      this.pass(renderer, "dofTile", this.tileRT);
      this.pass(renderer, "dofBlur", this.blurRT);
      this.pass(renderer, "dofComp", this.dofRT);
      color = this.dofRT;
    }

    // 4. bloom
    let bloomTex: THREE.Texture = this.black;
    if (post.bloom > 0) {
      this.mats.bloomPre.uniforms.tColor.value = color.texture;
      this.mats.bloomPre.uniforms.threshold.value = post.bloomThreshold;
      this.pass(renderer, "bloomPre", this.bloomDown[0]);
      for (let i = 1; i < this.bloomDown.length; i++) {
        const src = this.bloomDown[i - 1];
        this.mats.down.uniforms.tSrc.value = src.texture;
        (this.mats.down.uniforms.texel.value as THREE.Vector2).set(1 / src.width, 1 / src.height);
        this.pass(renderer, "down", this.bloomDown[i]);
      }
      let src = this.bloomDown[this.bloomDown.length - 1];
      for (let i = this.bloomDown.length - 2; i >= 0; i--) {
        this.mats.up.uniforms.tSrc.value = src.texture;
        this.mats.up.uniforms.tAdd.value = this.bloomDown[i].texture;
        (this.mats.up.uniforms.texel.value as THREE.Vector2).set(1 / src.width, 1 / src.height);
        this.pass(renderer, "up", this.bloomUp[i]);
        src = this.bloomUp[i];
      }
      bloomTex = this.bloomUp[0].texture;
    }

    // 5. finish
    const f = this.mats.finish.uniforms;
    f.tColor.value = color.texture;
    f.tBloom.value = bloomTex;
    f.bloom.value = post.bloom;
    f.exposure.value = post.exposure;
    f.contrast.value = post.grade.contrast;
    f.lift.value = post.grade.lift;
    (f.sat.value as THREE.Vector3).set(...post.grade.sat);
    (f.shadowTint.value as THREE.Vector3).set(...post.grade.shadowTint);
    (f.highTint.value as THREE.Vector3).set(...post.grade.highTint);
    (f.vignette.value as THREE.Vector2).set(...post.grade.vignette);
    f.flash.value = post.flash;
    f.fade.value = post.fade;
    f.glitch.value = post.glitch;
    f.seed.value = post.seed;
    const [mx, my] = post.motion;
    const len = Math.hypot(mx, my);
    // below ~6 px the blur is invisible: skip it (and its cost)
    (f.motion.value as THREE.Vector2).set(len > 6 ? mx / 1080 : 0, len > 6 ? my / 1920 : 0);
    this.pass(renderer, "finish", target);
    renderer.autoClear = autoClear;
  }

  /** Mixes the two views rendered into outA / outB (a dissolve) onto the screen. */
  blend(renderer: THREE.WebGLRenderer, t: number) {
    const u = this.mats.blend.uniforms;
    u.tA.value = this.outRT[0].texture;
    u.tB.value = this.outRT[1].texture;
    u.t.value = t;
    this.pass(renderer, "blend", null);
  }

  get outA() {
    return this.outRT[0];
  }
  get outB() {
    return this.outRT[1];
  }

  dispose() {
    for (const r of [
      this.sceneRT,
      this.normalRT,
      this.maskRT,
      this.inkedRT,
      this.prepRT,
      this.tileRT,
      this.blurRT,
      this.dofRT,
      ...this.bloomDown,
      ...this.bloomUp,
      ...this.outRT,
    ]) {
      r.depthTexture?.dispose();
      r.dispose();
    }
    for (const m of Object.values(this.mats)) m.dispose();
    this.normalMat.dispose();
    this.black.dispose();
  }
}
