// VHS camcorder pass for a full-frame vertical picture (the last pass, straight to the 1080×1920 canvas).
// Adapted from lemo-opuscar styles/backrooms/demo/vhs.js (MIT, LemoLab): no pillarbox, portrait lens, tape lines
// decoupled from the render size, plus a snow (static) mix for the end of the tape.
export const VHS = {
  uniforms: {
    tDiffuse: { value: null }, tOSD: { value: null },
    res: { value: [1080, 1920] }, src: { value: [540, 960] }, lines: { value: 480 },
    frame: { value: 0 }, tint: { value: [1, 1, 1] }, expo: { value: 1 }, gain: { value: 0.03 },
    sharp: { value: 0.9 }, lumaW: { value: 1.25 }, chromaW: { value: 5.0 }, chromaShift: { value: 1.6 }, sat: { value: 1.0 },
    jitter: { value: 0.3 }, track: { value: 0 }, roll: { value: 0 }, barrel: { value: 0.16 }, vig: { value: 0.42 },
    black: { value: 0.045 }, dropout: { value: 1 }, off: { value: 0 }, smear: { value: 0.35 }, snow: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
precision highp float;
uniform sampler2D tDiffuse, tOSD; uniform vec2 res, src; uniform vec3 tint;
uniform float lines, frame, expo, gain, sharp, lumaW, chromaW, chromaShift, sat, jitter, track, roll, barrel, vig, black, dropout, off, smear, snow;
varying vec2 vUv;
float h1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(h1(i), h1(i+1.), f); }
float hh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
const mat3 toYIQ = mat3(.299, .596, .211, .587, -.274, -.523, .114, -.322, .312);
const mat3 toRGB = mat3(1., 1., 1., .956, -.272, -1.106, .621, -.647, 1.703);
vec2 lens(vec2 q){ vec2 p = q - .5; vec2 pa = p * vec2(res.x / res.y, 1.); float r2 = dot(pa, pa); p *= 1. + barrel * r2; p *= 1. - barrel * .12; return p + .5; }
vec3 sig(vec2 q){
  vec2 ql = lens(q);
  vec3 c = texture2D(tDiffuse, ql).rgb;
  if (ql.x < 0. || ql.x > 1. || ql.y < 0. || ql.y > 1.) c = vec3(0.);
  vec4 o = texture2D(tOSD, q);
  return mix(c, o.rgb, o.a);
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / res;
  float F = floor(frame);
  uv.y = fract(uv.y + roll);
  float line = floor((1. - uv.y) * lines);
  float dx = 1. / src.x;
  float off1 = (h1(line * .37 + F * 1.13) - .5) * jitter * dx;
  off1 += (vn1(line * .012 + F * .7) - .5) * jitter * .8 * dx;
  float hsw = smoothstep(lines - 9., lines - 3., line);
  off1 += hsw * (.012 + .025 * h1(line + F * 3.1));
  float band = 0.;
  if (track > 0.) {
    float by = fract(h1(F * .31) * .6 + F * .037);
    band = smoothstep(.09 * track + .02, 0., abs(uv.y - by));
    off1 += (h1(line * .13 + F * 7.1) - .5) * .05 * track * (1. + band * 4.);
    off1 += band * track * .06 * sin(F * 2.3 + line * .02);
    uv.y += (h1(F * 1.9) - .5) * .02 * track;
  }
  vec2 q = vec2(uv.x + off1, uv.y);
  float Y = 0., Yw = 0., ws = 0., wws = 0.;
  for (int i = -3; i <= 3; i++) { float fi = float(i); float w = exp(-fi * fi / (2. * lumaW * lumaW)); Y += dot(sig(q + vec2(fi * dx, 0.)), vec3(.299, .587, .114)) * w; ws += w; }
  for (int i = -4; i <= 4; i++) { float fi = float(i) * 1.8; float w = exp(-fi * fi / (2. * 12.)); Yw += dot(sig(q + vec2(fi * dx, 0.)), vec3(.299, .587, .114)) * w; wws += w; }
  Y /= ws; Yw /= wws;
  Y = Y + sharp * (Y - Yw);
  vec2 IQ = vec2(0.); float cw = 0.;
  for (int i = -5; i <= 5; i++) { float fi = float(i) * chromaW * .4; float w = exp(-float(i * i) / 12.); IQ += (toYIQ * sig(q + vec2((fi - chromaShift) * dx, 0.))).yz * w; cw += w; }
  IQ /= cw;
  float tail = 0.;
  for (int i = 1; i <= 6; i++) { float yy = dot(sig(q - vec2(float(i) * 2.5 * dx, 0.)), vec3(.299, .587, .114)); tail += max(yy - .82, 0.) * (1. - float(i) / 7.); }
  Y += tail * smear;
  float px = floor(uv.x * src.x / 1.5);
  float nY = (h2(vec2(px, line) + F * 7.3) - .5) + (h2(vec2(floor(px / 3.), line) + F * 3.1) - .5) * .6;
  Y += nY * gain * (1.3 - Y * .8);
  IQ += (vec2(vn1(uv.x * 38. + line * 3.1 + F * 17.), vn1(uv.x * 31. + line * 1.7 + F * 11.)) - .5) * gain * .5;
  IQ *= sat;
  vec3 c = toRGB * vec3(Y, IQ);
  if (track > 0.) { float sn = h2(vec2(floor(fc.x / 3.), line) + F * 31.); c = mix(c, vec3(sn), band * .8 * track); c = mix(c, vec3(dot(c, vec3(.33))), band * track); }
  if (hsw > 0.) c = mix(c, vec3(h2(vec2(px, line + F))), hsw * .35);
  if (dropout > 0.) for (int k = 0; k < 3; k++) {
    float fk = float(k); float hk = h1(F * 3.7 + fk * 11.3);
    if (hk > .55) continue;
    float dl = floor(h1(F * 1.3 + fk * 5.1) * lines), dxs = h1(F * 2.9 + fk * 7.7), dlen = .02 + .1 * h1(F * 4.1 + fk);
    if (abs(line - dl) < .6 && uv.x > dxs && uv.x < dxs + dlen) c = mix(c, vec3(.95), dropout * (1. - (uv.x - dxs) / dlen));
  }
  c *= tint * expo;
  c = c * (1. - black) + black;
  c = mix(c, (1. - exp(-c * 1.6)) / (1. - exp(-1.6)), smoothstep(.55, 1.2, c));
  vec2 d = (uv - .5) * vec2(res.x / res.y * 1.35, 1.); c *= 1. - vig * smoothstep(.22, .7, length(d));
  // snow: no signal (horizontally stretched grains at tape rate, with slow bright bands)
  if (snow > 0.) {
    float ry = floor(fc.y / 2.), jx = hh(vec2(ry, F)) * 4.;
    float g1 = hh(vec2(floor((fc.x + jx) / 3.4), ry) + F * vec2(37.1, 17.3)), g2 = hh(vec2(floor(fc.x / 9.), ry) + F * vec2(11.7, 53.9));
    float sn = pow(g1 * .72 + g2 * .28, 1.4);
    float bandS = .78 + .3 * smoothstep(.2, .9, sin(uv.y * 2.4 + F * .35)) + .25 * step(.985, hh(vec2(ry * .01, F)));
    c = mix(c, vec3(sn * bandS) * vec3(.95, .97, 1.), snow);
  }
  c = mix(c, vec3(0.), off);
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`,
};
