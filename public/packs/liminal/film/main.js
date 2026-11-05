// OFİS · 03:14 — Liminal Found Footage style preview (vertical 1080×1920, 15 s).
// three.js at 540×960 → GTAO + autofocus depth of field + bloom (core/three/post.js) → VHS camcorder pass → 1080×1920,
// then the VCR's clean OSD on a 2D canvas. Engine adapted from lemo-opuscar styles/backrooms/demo (MIT, LemoLab).
import * as THREE from 'three';
import { makePost } from './core/three/post.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clamp, seg, ss, lerp, hash, vnoise, env } from './core/lib.js';
import * as S from './story.js';
import { buildWorld, updateLights, U } from './world.js';
import { VHS } from './vhs.js';
import { drawOSD, drawVCR } from './osd.js';
import { IN } from './inputs.js';

const Q = new URLSearchParams(location.search);
const RAW = Q.has('raw');
// load the exact subsets we draw (Turkish letters live in latin-ext)
await document.fonts.load('84px VCR', 'OFİS · 03:14 REC PLAY KAS 0123456789 ŞĞÜÖÇİ ışğüöç');
await document.fonts.load("700 160px Hand", 'Toplantı yarın 09:00 ı');
await window.packFonts?.();

const W = 1080, H = 1920, SW = 540, SH = 960, T = S.T;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.85;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0, 0, 0);
const camera = new THREE.PerspectiveCamera(64, SW / SH, .03, 170); camera.rotation.order = 'YXZ';
const post = makePost(renderer, scene, camera, SW, SH, { ssaa: 1, ao: true, aoRadius: .45, aoThickness: 1.2, aoScale: 1.6, aoAmt: .7 });
post.bloom.strength = .55; post.bloom.radius = .55; post.bloom.threshold = 1.1;
post.vig.uniforms.amt.value = 0; post.vig.uniforms.contrast.value = 0; post.vig.uniforms.sat.value = 1;
post.dof.maxCoc = 14;
const osdCv = document.createElement('canvas'); osdCv.width = W; osdCv.height = H;
const osdTex = new THREE.CanvasTexture(osdCv); osdTex.minFilter = osdTex.magFilter = THREE.LinearFilter; osdTex.generateMipmaps = false;
const vhs = new ShaderPass(VHS);
vhs.uniforms.tOSD.value = osdTex; vhs.uniforms.res.value = [W, H]; vhs.uniforms.src.value = [SW, SH];
if (RAW) Object.assign(vhs.uniforms, {}), ['sharp', 'gain', 'jitter', 'barrel', 'dropout', 'smear', 'chromaShift'].forEach(k => vhs.uniforms[k].value = 0);
post.composer.addPass(vhs);

const world = buildWorld(scene);
const ov = document.getElementById('ov'), ox = ov.getContext('2d');

// gait phase from distance walked (one step per 0.7 m)
const DT = 1 / 240, NS = Math.ceil(S.DUR / DT) + 2, DIST = new Float32Array(NS);
for (let k = 1; k < NS; k++) { const a = S.POS((k - 1) * DT), b = S.POS(k * DT); DIST[k] = DIST[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
const distAt = t => { const f = clamp(t / DT, 0, NS - 1.001), i = Math.floor(f); return lerp(DIST[i], DIST[i + 1], f - i); };
const speedAt = t => (distAt(t + .15) - distAt(t - .15)) / .3;
const STRIDE = .7;

// lights: three short blackouts, then they stay out (only the monitor is left)
function gLight(t) {
  let g = 1;
  T.flick.forEach((f, i) => {
    if (t > f - .03 && t < f + .1 + i * .02) g = .025;
    else if (t >= f + .1 + i * .02 && t < f + .2) g = Math.min(g, .55 + .45 * seg(t, f + .1, f + .2));
  });
  if (t >= T.dark) g = .02;
  return g;
}
function darkMem(t) { let s = 0, w = 0; for (let k = 0; k < 40; k++) { const d = k * .03, e = Math.exp(-d / .45); s += (1 - gLight(t - d)) * e; w += e; } return s / w; }

// handheld camcorder: gait + breathing + tremor scaled by fear; frozen while holding breath after the ding
const nz = (t, f, s) => vnoise(t * f + s * 17.3) - .5;
function camPose(t) {
  const [x, z] = S.POS(t); let yaw = S.YAW(t), pitch = S.PITCH(t), roll;
  const sp = speedAt(t), amp = clamp(sp / 1.25), ph = distAt(t) / STRIDE * Math.PI, fear = S.FEAR(t);
  const hold = 1 - env(t, T.hush[0] - .05, T.hush[1] + .15, .06, .15);
  let y = 1.5 + S.CAMH(t);
  y += .03 * amp * (Math.abs(Math.sin(ph)) - .6);
  const sway = .018 * amp * Math.sin(ph), br = Math.sin(t * Math.PI * 2 * .27);
  const zk = 64 / S.VFOV(t), tz = 1 / Math.sqrt(zk);            // zoomed in: the same hand shake reads bigger, so damp it a little
  pitch += (nz(t, 1.1, 1) * .016 + nz(t, 3.7, 2) * .005 * (1 + 2 * fear) + nz(t, 9.5, 3) * .0022 * fear + br * .006) * hold * tz;
  yaw += (nz(t, .9, 4) * .018 + nz(t, 3.3, 5) * .005 * (1 + 2 * fear) + .011 * amp * Math.sin(ph)) * hold * tz;
  roll = (nz(t, .6, 6) * .035 + .014 * amp * Math.sin(ph) + nz(t, 7, 7) * .003 * fear) * hold + .01;
  y += br * .006 * hold;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return { x: x + rx * sway * hold, y, z: z + rz * sway * hold, yaw, pitch, roll };
}

function render(t) {
  const cp = camPose(t);
  camera.position.set(cp.x, cp.y, cp.z); camera.rotation.set(cp.pitch, cp.yaw, cp.roll);
  camera.fov = S.VFOV(t); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  world.swivel.rotation.y = S.swivel(t);
  world.cursor.visible = Math.floor(t * 1.9) % 2 === 0;
  const g = gLight(t);
  updateLights(t, g);
  U.uSigI.value = .5 * (.97 + .03 * Math.sin(t * 113));
  U.uFogG.value = .35 + .65 * g;
  scene.background.copy(U.uFogCol.value).multiplyScalar(U.uFogG.value * .15);
  post.dof.focus = S.FOCUS(t); post.dof.aper = S.APER(t);
  // VHS
  const u = vhs.uniforms, dm = darkMem(t), f = Math.floor(t * 30);
  u.frame.value = f;
  const awb = ss(seg(t, T.rollIn, T.rollIn + 1.8));
  u.tint.value = [lerp(.78, 1.0, awb), lerp(.92, 1.0, awb), lerp(1.45, .95, awb) * (1 + .04 * Math.sin(t * .31))];
  u.expo.value = (1 + .5 * dm) * (.97 + .03 * Math.sin(t * .47));
  u.gain.value = .034 + .09 * dm + .02 * seg(S.VFOV(t), 64, 17.5) + .01 * S.FEAR(t);
  let trk = 0, roll = 0;
  if (t < T.rollIn + .55) { const k = 1 - seg(t, T.rollIn, T.rollIn + .55); trk = k; roll = k * k * .4; }
  trk = Math.max(trk, env(t, T.tear[0], T.tear[1], .06, .05));
  if (t > T.tear[0] && t < T.tear[1]) roll = (hash(f * .7) - .5) * .14;
  u.track.value = trk; u.roll.value = roll;
  u.snow.value = t >= T.snow ? 1 : 0;
  u.off.value = t < T.rollIn ? 1 : 0;
  // camcorder OSD (inside the signal)
  drawOSD(osdCv, {
    hide: t < T.rollIn || t >= T.snow, t, rec: true,
    clock: S.clock(t), date: IN.date,
    title: t >= T.title[0] && t < T.title[1] ? IN.title : null, titleN: Math.floor((t - T.title[0]) * 16),
  });
  osdTex.needsUpdate = true;
  U.uTime.value = t;
  post.composer.render();
  // VCR OSD on top (clean)
  drawVCR(ox, { blue: t < T.rollIn, play: t >= T.play[0] && t < T.play[1] });
}

window.DUR = S.DUR; window.render = render;
window.dbg = { camera, scene, post, vhs, U, world, camPose };
render(0);
window.READY = true;
