// An office floor at 03:14: a long aisle (yellowed wall on the left, an endless open-plan desk field on the right),
// flat light from a grid of fluorescent troffers kept in one float DataTexture, fog that follows local light.
// Lighting, fog and surface shaders adapted from lemo-opuscar styles/backrooms/demo/world.js (MIT, LemoLab).
import * as THREE from 'three';
import { mulberry, hash } from './core/lib.js';
import * as TX from './tex.js';

export const H = 2.7;                       // ceiling
export const LX = 2.4, LZ = 2.4, LOX = 0.0, LOZ = 0.0;
const LN = 128, LOFF = 64, WT = 0.16;
export const WALL_X = -1.45;                // the aisle's west wall
const PODS = [0, 1, 2, 3, 4, 5, 6, 7].map(p => 2.2 + 4.2 * p);   // desk pods (x of line A's front edge)
const GROUPS = []; for (let g = -2; g <= 12; g++) GROUPS.push(g);  // desk groups along z (4 desks each)
const deskZ = (g, k) => 2.5 - g * 7.8 - k * 1.5;
export const LIT = { pod: 0, g: 1, k: 0 };   // the one monitor left on
export const SIG = { x: 0, y: 0.99, z: deskZ(LIT.g, LIT.k) };      // its screen centre (x filled in by the builder)
export const START_CHAIR = { x: PODS[0] - 0.36, z: deskZ(0, 0) };

// ———————————————— light grid ————————————————
export const lightData = new Float32Array(LN * LN * 4);
export const lightTex = new THREE.DataTexture(lightData, LN, LN, THREE.RGBAFormat, THREE.FloatType);
lightTex.magFilter = lightTex.minFilter = THREE.NearestFilter;
export const LIGHTS = [];
{
  const R = mulberry(99);
  for (let i = -LOFF; i < LOFF; i++) for (let j = -LOFF; j < LOFF; j++) {
    const x = LX * i + LOX, z = LZ * j + LOZ;
    if (x < -30 || x > 60 || z > 26 || z < -150) continue;
    const r = R(), warm = (R() - .5) * 0.16, green = R() * 0.07, rb = R();
    let kind;
    if (x < WALL_X) kind = 'dead';                                   // rooms behind the wall: dark doorways
    else if (Math.abs(x) < .1) kind = r < .03 ? 'flicker' : 'ok';    // the aisle: one endless row
    else {                                                           // night mode: only some banks of the field are on
      const bank = hash(Math.floor(i / 2) * 13.1 + Math.floor(j / 2) * 7.7 + 3.3);
      kind = bank < .3 ? (r < .035 ? 'dead' : r < .06 ? 'flicker' : 'ok') : (rb < .6 ? 'dim' : 'dead');
    }
    // route areas guaranteed lit: the opening chair and the lit desk; the strip beside the aisle never fully dark
    if (Math.abs(x - 2.4) < .1 && z > -6 && z < 4) kind = 'ok';
    if (Math.abs(x - 4.8) < .1 && z > -1 && z < 4) kind = 'ok';
    if (x > 1 && x < 3 && z > -60 && z <= -6 && kind === 'dead') kind = 'dim';
    const base = kind === 'dead' ? 0 : kind === 'dim' ? 0.05 + R() * 0.07 : 0.85 + R() * 0.3;
    LIGHTS.push({ i, j, x, z, base, col: [1 + warm, 1 + green, 0.84 - warm * 0.6], kind, ph: R() * 100 });
  }
}
export function updateLights(t, g = 1) {
  lightData.fill(0);
  for (const L of LIGHTS) {
    let k = L.base;
    if (L.kind === 'flicker') { const s = Math.floor(t * 24 + L.ph), h1 = hash(s * 1.7 + L.ph), h2 = hash(Math.floor(t * 1.3 + L.ph)); k *= h2 < .35 ? (h1 < .5 ? .15 : .9) : 1; }
    const o = ((L.j + LOFF) * LN + (L.i + LOFF)) * 4;
    lightData[o] = L.col[0] * k * g; lightData[o + 1] = L.col[1] * k * g; lightData[o + 2] = L.col[2] * k * g; lightData[o + 3] = 1;
  }
  lightTex.needsUpdate = true;
}

// ———————————————— shaders ————————————————
export const U = {
  uLights: { value: lightTex }, uAmb: { value: 0.16 }, uI: { value: 2.2 },
  uSigPos: { value: new THREE.Vector3() }, uSigI: { value: 0.0 }, uSigCol: { value: new THREE.Color(0.16, 0.3, 1.0) },
  uFogCol: { value: new THREE.Color(0.19, 0.16, 0.075) }, uFogD: { value: 0.03 }, uFogG: { value: 1 }, uTime: { value: 0 },
};
const f2 = v => v.toFixed(2);
const VS = `
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const COMMON = `
uniform sampler2D uLights; uniform float uAmb, uI, uSigI, uFogD, uFogG, uTime; uniform vec3 uSigPos, uSigCol, uFogCol;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int k = 0; k < 5; k++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
void lightAt(vec3 P, vec3 N, vec3 V, float shin, out vec3 dif, out vec3 spc, out vec3 amb){
  dif = vec3(0); spc = vec3(0); amb = vec3(0);
  float gi = floor((P.x - ${f2(LOX)}) / ${f2(LX)} + .5), gj = floor((P.z - ${f2(LOZ)}) / ${f2(LZ)} + .5);
  for (int di = -2; di <= 2; di++) for (int dj = -2; dj <= 2; dj++) {
    float i = gi + float(di), j = gj + float(dj);
    vec4 L = texture2D(uLights, (vec2(i, j) + ${LOFF}.5) / ${LN}.);
    if (L.a < .5) continue;
    vec3 lp = vec3(i * ${f2(LX)} + ${f2(LOX)}, ${f2(H - 0.02)}, j * ${f2(LZ)} + ${f2(LOZ)});
    vec3 d = lp - P; float d2 = dot(d, d); vec3 l = d * inversesqrt(d2);
    float emit = .3 + .7 * max(l.y, 0.);
    dif += L.rgb * max(dot(N, l), 0.) * emit / (d2 + .3);
    if (shin > 0.) { vec3 hv = normalize(l + V); spc += L.rgb * pow(max(dot(N, hv), 0.), shin) * emit / (d2 + .3); }
    vec2 dh = d.xz; amb += L.rgb / (dot(dh, dh) + 3.);
  }
  dif *= uI; spc *= uI; amb *= uAmb;
  // the one monitor left on: a soft blue area light facing west
  // (only what is in front of the glass: the note on it and the bezel get nothing)
  if (uSigI > 0.) { vec3 d = uSigPos - P; float d2 = dot(d, d); vec3 l = d * inversesqrt(d2);
    float face = smoothstep(.0, .12, uSigPos.x - P.x) * clamp(-l.x * 1.3 + .1, 0., 1.);
    dif += uSigCol * uSigI * face * (max(dot(N, l), 0.) * .9 + .05) / (d2 + .12); }
}
vec3 fog(vec3 c, vec3 P){ float d = length(P - cameraPosition); float f = 1. - exp(-d * uFogD); return mix(c, uFogCol * uFogG, f); }
vec3 fogA(vec3 c, vec3 P, vec3 a){ float d = length(P - cameraPosition); float f = 1. - exp(-d * uFogD);
  float k = clamp(dot(a, vec3(.333)) / (.2 * uAmb / .16), .15, 1.25); return mix(c, uFogCol * uFogG * k, f); }
`;
const mat = (frag, extraU = {}) => new THREE.ShaderMaterial({ uniforms: { ...U, ...extraU }, vertexShader: VS, fragmentShader: COMMON + frag });

const WALL_FS = `
uniform sampler2D map;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float u = abs(N.x) > .5 ? vW.z * sign(N.x) : -vW.x * sign(N.z);
  float roll = floor(u / .53);
  vec3 alb = texture2D(map, vec2(u / .53, vW.y / .53)).rgb;
  alb *= .92 + .12 * h21(vec2(roll, 3.1));
  float st = fbm(vec2(u * .9, vW.y * 1.4) + 5.);
  alb *= mix(vec3(1.), vec3(.82, .74, .55), smoothstep(.55, .78, st) * .8);
  float wmask = smoothstep(.45, .65, fbm(vec2(u * .23, 7.)));
  float wet = (fbm(vec2(u * .8, 3.)) * .5 + .05) * wmask;
  float tide = smoothstep(wet + .05, wet - .06, vW.y) * wmask;
  alb *= mix(vec3(1.), vec3(.74, .63, .42), tide * .55);
  alb *= 1. - .2 * smoothstep(.04, 0., abs(vW.y - wet)) * step(.15, wet);
  alb *= mix(vec3(1.), vec3(.86, .8, .62), smoothstep(${f2(H - 0.35)}, ${f2(H)}, vW.y) * .6);
  float sx = fract(u / .53) * .53;
  alb *= 1. - .4 * smoothstep(.008, 0., sx) * step(.3, h21(vec2(roll, 7.)));
  if (vW.y < .1) alb = vec3(.30, .24, .15) * (.9 + .1 * vn(vec2(u * 30., 1.)));
  vec3 d, s, a; lightAt(vW + N * .02, N, V, 0., d, s, a);
  gl_FragColor = vec4(fogA(alb * (d + a), vW, a), 1.);
}`;
const FLOOR_FS = `
uniform sampler2D map;
void main(){
  vec3 N = vec3(0, 1, 0); vec3 V = normalize(cameraPosition - vW);
  vec3 alb = texture2D(map, vW.xz).rgb;
  alb *= .9 + .2 * vn(vW.xz * 1.3);
  float damp = smoothstep(.55, .72, fbm(vW.xz * .45 + 3.));
  alb *= mix(1., .7, damp);
  alb *= .88 + .24 * fbm(vW.xz * 7.);
  vec3 d, s, a; lightAt(vW, N, V, 22., d, s, a);
  vec3 c = alb * (d + a * .7) + s * (.012 + .07 * damp) * vec3(1., .95, .8);
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
const CEIL_FS = `
uniform sampler2D map;
void main(){
  vec3 N = vec3(0, -1, 0); vec3 V = normalize(cameraPosition - vW);
  vec2 q = vec2((vW.x + .3) / 1.2, (vW.z - .6) / 1.2);
  vec3 alb = texture2D(map, q).rgb;
  vec2 tile = floor(vec2((vW.x + .3) / .6, (vW.z - .6) / 1.2));
  float hs = h21(tile); alb *= .95 + .08 * hs;
  vec2 f0 = fract(vec2((vW.x + .3) / .6, (vW.z - .6) / 1.2));
  float kind = h21(tile + 71.);
  bool vent = kind > .972 && kind <= .992, yell = kind > .93 && kind <= .972;
  if (yell) alb *= mix(vec3(.93, .86, .7), vec3(.8, .68, .45), smoothstep(.2, .5, length(f0 - .5)));
  if (vent) { vec2 g = (f0 - .5) * vec2(1., 2.); float sq = step(max(abs(g.x), abs(g.y)), .38);
    float slot = step(.5, fract(g.y * 11.)); alb = mix(alb, mix(vec3(.2, .19, .16), vec3(.78, .76, .7), slot), sq); }
  if (hs > .93 && !vent) { vec2 f = f0 - .5; f.x *= .5; float r = length(f + (vec2(h21(tile + 3.), h21(tile + 5.)) - .5) * .3);
    alb *= mix(vec3(1.), vec3(.72, .58, .34), smoothstep(.22, .19, r) * .8); }
  vec3 d, s, a; lightAt(vW - vec3(0, .05, 0), N, V, 0., d, s, a);
  gl_FragColor = vec4(fogA(alb * (d * .55 + a * 1.05), vW, a), 1.);
}`;
const TROF_FS = `
uniform sampler2D map; uniform float uEmit;
void main(){
  vec2 cell = vec2(floor((vW.x - ${f2(LOX)}) / ${f2(LX)} + .5), floor((vW.z - ${f2(LOZ)}) / ${f2(LZ)} + .5));
  vec4 L = texture2D(uLights, (cell + ${LOFF}.5) / ${LN}.);
  vec3 tx = texture2D(map, vUv).rgb;
  float glow = smoothstep(.75, .95, dot(tx, vec3(.33)));
  gl_FragColor = vec4(fog(mix(tx * .25 * (L.rgb * .3 + .05), tx * L.rgb * uEmit, glow), vW), 1.);
}`;
const PAINT_FS = `
uniform sampler2D map; uniform vec3 color; uniform float useMap, shin, spec, emit, useWorld;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N; vec3 V = normalize(cameraPosition - vW);
  vec2 uv = vUv;
  if (useWorld > 0.) { vec3 n = abs(N); uv = (n.x > .5 ? vW.zy : n.z > .5 ? vW.xy : vW.xz) * useWorld; }
  vec3 alb = color; if (useMap > .5) alb *= texture2D(map, uv).rgb;
  vec3 d, s, a; lightAt(vW + N * .02, N, V, shin, d, s, a);
  vec3 c = alb * (d + a) + s * spec + alb * emit;
  gl_FragColor = vec4(fogA(c, vW, a), 1.);
}`;
export function paint(o = {}) {
  return mat(PAINT_FS, {
    map: { value: o.map || null }, color: { value: new THREE.Color(o.color ?? '#ffffff') }, useMap: { value: o.map ? 1 : 0 },
    shin: { value: o.shin ?? 0 }, spec: { value: o.spec ?? 0 }, emit: { value: o.emit ?? 0 }, useWorld: { value: o.world ?? 0 },
  });
}

// ———————————————— geometry: boxes merged per material ————————————————
const FACES = [
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]], TRI = [0, 1, 2, 0, 2, 3];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
export const M = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s);
function box(acc, key, w, h, d, m) {
  const A = acc[key] ??= { p: [], n: [], u: [] }, e = m.elements;
  for (const [n, cs] of FACES) {
    const nx = e[0] * n[0] + e[4] * n[1] + e[8] * n[2], ny = e[1] * n[0] + e[5] * n[1] + e[9] * n[2], nz = e[2] * n[0] + e[6] * n[1] + e[10] * n[2];
    for (const k of TRI) {
      const c = cs[k], x = c[0] * w / 2, y = c[1] * h / 2, z = c[2] * d / 2;
      A.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      A.n.push(nx, ny, nz); A.u.push(UVQ[k][0], UVQ[k][1]);
    }
  }
}
const local = (base, x, y, z, ry = 0, rx = 0, rz = 0) => base.clone().multiply(M(x, y, z, ry, rx, rz));
function meshes(acc, mats, parent) {
  const out = {};
  for (const k in acc) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(acc[k].p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(acc[k].n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(acc[k].u, 2));
    const m = new THREE.Mesh(g, mats[k]); parent.add(m); out[k] = m;
  }
  return out;
}

// Office chair, local frame: the sitter faces +x
function chair(acc, base) {
  box(acc, 'chair', .46, .08, .48, local(base, 0, .47, 0));
  box(acc, 'chair', .06, .46, .44, local(base, -.25, .80, 0, 0, 0, .1));
  box(acc, 'metal', .05, .14, .05, local(base, -.2, .58, 0));
  box(acc, 'metal', .05, .36, .05, local(base, 0, .25, 0));
  for (let k = 0; k < 5; k++) box(acc, 'metal', .3, .035, .045, local(base, 0, .07, 0, k * 1.2566).multiply(M(.13, 0, 0)));
}
// Desk with CRT and keyboard. lineA: sitter on the west side, screen faces west (−x)
function desk(acc, lineA, d0, zc, R, lit) {
  const dir = lineA ? -1 : 1, xs = lineA ? d0 : d0 + .8, xe = xs + .75, xc = (xs + xe) / 2;
  box(acc, 'deskTop', .75, .03, 1.4, M(xc, .735, zc));
  box(acc, 'deskSide', .7, .72, .03, M(xc, .36, zc - .68)); box(acc, 'deskSide', .7, .72, .03, M(xc, .36, zc + .68));
  box(acc, 'deskSide', .02, .45, 1.34, M(lineA ? xe - .03 : xs + .03, .45, zc));
  const mx = lineA ? xs + .42 : xe - .42, mz = lit ? zc : zc + (R() - .5) * .12;
  const plastic = lit ? 'litPlastic' : 'plastic';
  box(acc, plastic, .06, .34, .38, M(mx, .98, mz));
  box(acc, plastic, .3, .28, .3, M(mx - dir * .18, .97, mz));
  box(acc, plastic, .22, .03, .22, M(mx - dir * .08, .765, mz));
  box(acc, plastic, .08, .05, .1, M(mx - dir * .08, .80, mz));
  box(acc, lit ? 'litScreen' : 'glass', .006, .22, .29, M(mx + dir * .031, .99, mz));
  box(acc, 'plastic', .16, .025, .44, M(mx + dir * .32, .762, mz + (R() - .5) * .1, (R() - .5) * .12));
  if (R() < .55) box(acc, 'paper', .22, .015 + R() * .05, .3, M(xc + (R() - .5) * .2, .76, zc + (R() < .5 ? -.47 : .47), (R() - .5) * .4));
  if (R() < .3) box(acc, 'mug', .08, .1, .08, M(mx + dir * .28, .8, zc + .5 * (R() < .5 ? -1 : 1)));
  if (R() < .35) box(acc, 'phone', .18, .06, .2, M(mx + dir * .05, .78, zc - .52, (R() - .5) * .5));
  return { mx, mz, front: mx + dir * .034 };
}

export function buildWorld(scene) {
  const T = { wall: TX.wallpaper(), carpet: TX.carpet(), ceil: TX.ceiling(), trof: TX.troffer(), fabric: TX.fabric() };
  const acc = {}, R = mulberry(4242);
  // the west wall with dark doorways every 12 m
  const wall = (z0, z1) => box(acc, 'wall', WT, H, Math.abs(z1 - z0), M(WALL_X, H / 2, (z0 + z1) / 2));
  let z = 24;
  for (let k = 0; k < 15; k++) { const gap = -7.6 - 12 * k; wall(z, gap + .55); box(acc, 'wall', WT, H - 2.1, 1.1, M(WALL_X, 2.1 + (H - 2.1) / 2, gap)); z = gap - .55; }
  wall(z, -160);
  box(acc, 'wall', 60, H, WT, M(WALL_X + 30, H / 2, 25));          // far south wall
  // pillars in the field walkways
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { const px = 5.07 + 8.4 * i, pz = -3.65 - 15.6 * j - 7.8 * (i % 2); if (px === 5.07 && j === 0) continue; box(acc, 'wall', .5, H, .5, M(px, H / 2, pz)); }
  // desk field
  let litInfo = null;
  for (const [p, d0] of PODS.entries()) for (const g of GROUPS) {
    const zc0 = deskZ(g, 0), zc3 = deskZ(g, 3);
    box(acc, 'divider', .05, 1.08, 6.0, M(d0 + .775, .54, (zc0 + zc3) / 2));
    box(acc, 'trim', .07, .025, 6.02, M(d0 + .775, 1.09, (zc0 + zc3) / 2));
    for (let k = 0; k < 4; k++) {
      const zc = deskZ(g, k);
      for (const lineA of [true, false]) {
        const lit = lineA && p === LIT.pod && g === LIT.g && k === LIT.k;
        const info = desk(acc, lineA, d0, zc, R, lit);
        if (lit) litInfo = info;
        const isStart = lineA && p === 0 && g === 0 && k === 0;
        if (isStart) continue;                                              // the opening chair is built on its own
        if (lit) { chair(acc, M(d0 - .62, 0, zc + .9, .95)); continue; }      // left pulled out, turned to the aisle
        if (R() < .08) continue;                                            // a few desks have no chair
        const sx = lineA ? d0 - .36 - R() * .25 : d0 + 1.55 + .36 + R() * .25;
        chair(acc, M(sx, 0, zc + (R() - .5) * .3, (lineA ? 0 : Math.PI) + (R() - .5) * .7));
      }
    }
  }
  SIG.x = litInfo.front; SIG.z = litInfo.mz;
  U.uSigPos.value.set(SIG.x - .03, SIG.y, SIG.z);
  const mats = {
    wall: mat(WALL_FS, { map: { value: T.wall } }),
    deskTop: paint({ color: '#cbbf9b', shin: 30, spec: .05 }), deskSide: paint({ color: '#8b7f62' }),
    divider: paint({ map: T.fabric, world: 1.6 }), trim: paint({ color: '#b9b194', shin: 40, spec: .08 }),
    plastic: paint({ color: '#cfc4a0', shin: 25, spec: .06 }), litPlastic: paint({ color: '#cfc4a0', shin: 25, spec: .06 }),
    glass: paint({ map: TX.crtDark(), shin: 140, spec: .9 }),
    litScreen: paint({ map: TX.crtBlue(), color: '#ffffff', emit: 4.2 }),
    chair: paint({ color: '#3a3832' }), metal: paint({ color: '#2a2926', shin: 40, spec: .15 }),
    paper: paint({ color: '#e5dfca' }), mug: paint({ color: '#d6cfbd', shin: 30, spec: .1 }), phone: paint({ color: '#4a4740', shin: 30, spec: .1 }),
  };
  const ms = meshes(acc, mats, scene);
  // floor and ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(FLOOR_FS, { map: { value: T.carpet } }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(10, 0, -60); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(CEIL_FS, { map: { value: T.ceil } }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(10, H, -60); scene.add(ceil);
  // troffers
  const tp = [], tn = [], tu = [];
  for (const L of LIGHTS) {
    const x0 = L.x - .3, x1 = L.x + .3, z0 = L.z - .6, z1 = L.z + .6, y = H - .004;
    tp.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
    for (let k = 0; k < 6; k++) tn.push(0, -1, 0);
    tu.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2));
  const trofMat = mat(TROF_FS, { map: { value: T.trof }, uEmit: { value: 5.0 } });
  scene.add(new THREE.Mesh(tg, trofMat));
  // the swivelling chair of the opening (its own mesh so it can turn)
  const sc = new THREE.Group(); sc.position.set(START_CHAIR.x, 0, START_CHAIR.z); scene.add(sc);
  const cacc = {}; chair(cacc, new THREE.Matrix4()); meshes(cacc, mats, sc);
  // the sticky note on the lit screen + a blinking cursor
  const note = new THREE.Mesh(new THREE.BoxGeometry(.003, .1, .1), paint({ map: TX.note(), emit: .05 }));
  note.position.set(SIG.x - .004, SIG.y + .01, SIG.z + .035); note.rotation.x = .045; scene.add(note);
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(.002, .006, .016), paint({ color: '#e8ecff', emit: 6 }));
  cursor.position.set(SIG.x - .003, SIG.y + .085, SIG.z - .118); scene.add(cursor);
  return { ms, trofMat, swivel: sc, note, cursor, litScreen: mats.litScreen };
}
