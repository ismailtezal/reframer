// Monochrome-phosphor CRT post (WebGL2), adapted from lemo-opuscar styles/ascii-crt/demo/crt.js (MIT, LemoLab), itself from core/post/crt.js.
// Changes: P1 green phosphor ramp; the second channel is a warm coffee amber; rounded screen mask and power line corrected for a portrait frame; 4 px scanlines.
// Input: scene canvas R = phosphor intensity, G = warm intensity (values > 1 by drawing twice additively).
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const PRE = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D scene; uniform vec2 px;
void main(){ vec3 c = texture(scene,uv).rgb*.4 + (texture(scene,uv+px*vec2(1,1)).rgb + texture(scene,uv+px*vec2(-1,1)).rgb + texture(scene,uv+px*vec2(1,-1)).rgb + texture(scene,uv+px*vec2(-1,-1)).rgb)*.15; o = vec4(c,1); }`;
const DOWN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 px;
void main(){ vec3 c = texture(src,uv).rgb*.25 + (texture(src,uv+px*vec2(1,1)).rgb + texture(src,uv+px*vec2(-1,1)).rgb + texture(src,uv+px*vec2(1,-1)).rgb + texture(src,uv+px*vec2(-1,-1)).rgb)*.1875; o = vec4(c,1); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ float w[5] = float[](.2270270270, .1945945946, .1216216216, .0540540541, .0162162162);
  vec3 c = texture(src,uv).rgb*w[0]; for(int i=1;i<5;i++){ c += (texture(src,uv+dir*float(i)*1.5).rgb + texture(src,uv-dir*float(i)*1.5).rgb)*w[i]; } o = vec4(c,1); }`;
const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D scene, b1, b2, b3, b4; uniform vec2 res;
uniform float frame, curv, zoom, scan, glow, halo, beam, noiseA, flick, power, off, corner, refl, expo, warmSat, jolt;
uniform vec3 phosM, phosLo, phosHi, warm, glass;
float h1(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
vec3 phos(float a){ vec3 c = mix(phosLo, phosM, smoothstep(.0, .55, a)) * a; c += phosHi * smoothstep(.62, 1.25, a) * .55; return c; }
vec3 phosW(float e){ vec3 c = warm * e; c += vec3(1.0,.9,.72) * smoothstep(.65, 1.3, e) * .45; return c; }
void main(){
  float asp = res.x / res.y;
  vec2 cc = (uv - .5) * 2.0;
  vec2 d = cc; d.x *= 1.0 + curv * d.y * d.y * .55; d.y *= 1.0 + curv * 1.1 * d.x * d.x;
  d /= zoom;
  d.x += jolt;
  float sx = 1.0, sy = 1.0, boost = 0.0;
  if (power < 1.0) { sx = smoothstep(0.0, .35, power); sy = max(.003, smoothstep(.35, 1.0, power)); boost = pow(1.0 - sy, 3.0) * 1.4; }
  if (off > 0.0) { sy = max(.003, 1.0 - smoothstep(0.0, .45, off)); sx = max(.002, 1.0 - smoothstep(.45, .85, off)); boost = max(boost, pow(1.0 - sy, 2.0) * 1.2); }
  vec2 q = vec2(d.x / max(sx, .001), d.y / sy) * .5 + .5;
  vec2 s = 1.0 / res;
  vec3 sc = texture(scene, q).rgb * .6 + (texture(scene, q + s*vec2(beam,0)).rgb + texture(scene, q - s*vec2(beam,0)).rgb) * .2;
  float a = sc.r * expo, e = sc.g * expo;
  vec3 B = texture(b1,q).rgb*.5 + texture(b2,q).rgb*.55 + texture(b3,q).rgb*.5 + texture(b4,q).rgb*.45;
  vec3 Hh = texture(b3,q).rgb*.6 + texture(b4,q).rgb;
  vec3 c = phos(a) + phosW(e) * warmSat;
  c += (phosM * B.r + warm * B.g) * glow + (phosLo * Hh.r + warm * .8 * Hh.g) * halo;
  vec2 P = uv * res;
  float L = clamp(max(a, e), 0.0, 1.0);
  float ph = .5 - .5 * cos(6.2831853 * (q.y * res.y) / 4.0);
  c *= 1.0 - scan * ph * (1.0 - .55 * L);
  vec2 dp = vec2(d.x * asp, d.y);
  float sd = sdRound(dp, vec2(asp, 1.0), .06);
  float inside = 1.0 - smoothstep(-.003, .003, sd);
  vec2 dd = d; float vig = 1.0 - corner * (.30 * dot(dd, dd) + .9 * dd.x*dd.x*dd.y*dd.y);
  c += glass * vig;
  c += (h2(P + frame * 17.0) - .5) * noiseA * (.5 + L);
  c *= 1.0 + (h1(frame * .73) - .5) * flick;
  c *= vig;
  float r = smoothstep(.9, .0, length(dd - vec2(-.55, .62))) * refl;
  c += vec3(.85, 1.0, .9) * r * .028;
  c *= inside;
  vec3 bezel = vec3(.014, .016, .014) + (phosM * B.r + warm * B.g) * .2 * smoothstep(.07, .0, sd);
  c = mix(bezel, c, inside);
  c = c * (1.0 + boost) + min(expo, 1.0) * boost * vec3(.75, 1.0, .8) * smoothstep(.006, 0.0, abs(uv.y - .5)) * step(abs(uv.x - .5), max(sx, .004) * .5) * inside;
  o = vec4(clamp(c, 0., 1.), 1);
}`;

export function makeCRT(cv) {
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  const W = cv.width, H = cv.height;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const P = { pre: prog(PRE), down: prog(DOWN), blur: prog(BLUR), comp: prog(COMP) };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const fbo = (w, h) => { const t = tex(w, h), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const tScene = tex(W, H);
  const L = [2, 4, 8, 16].map(d => ({ a: fbo(Math.ceil(W / d), Math.ceil(H / d)), b: fbo(Math.ceil(W / d), Math.ceil(H / d)) }));
  const U = (p, n) => gl.getUniformLocation(p, n);
  const draw = (target) => { if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); } gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bindT = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };
  const params = { curv: .04, zoom: 1.0, scan: .28, glow: .55, halo: .2, beam: .8, noiseA: .022, flick: .012, power: 1, off: 0,
    corner: .5, refl: 1, expo: 1, warmSat: 1, jolt: 0,
    phosM: [.28, 1.0, .42], phosLo: [.03, .5, .14], phosHi: [.78, 1.0, .84], warm: [1.0, .62, .2], glass: [.010, .026, .016] };
  function render(scene, frame, over = {}) {
    const o = Object.assign({}, params, over);
    gl.bindTexture(gl.TEXTURE_2D, tScene); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.useProgram(P.pre); bindT(0, tScene); gl.uniform1i(U(P.pre, 'scene'), 0); gl.uniform2f(U(P.pre, 'px'), 1 / W, 1 / H);
    draw(L[0].a);
    for (let i = 0; i < L.length; i++) {
      const lv = L[i];
      if (i > 0) { gl.useProgram(P.down); bindT(0, L[i - 1].a.t); gl.uniform1i(U(P.down, 'src'), 0); gl.uniform2f(U(P.down, 'px'), 1 / L[i - 1].a.w, 1 / L[i - 1].a.h); draw(lv.a); }
      gl.useProgram(P.blur); gl.uniform1i(U(P.blur, 'src'), 0);
      bindT(0, lv.a.t); gl.uniform2f(U(P.blur, 'dir'), 1 / lv.a.w, 0); draw(lv.b);
      bindT(0, lv.b.t); gl.uniform2f(U(P.blur, 'dir'), 0, 1 / lv.a.h); draw(lv.a);
    }
    const p = P.comp; gl.useProgram(p);
    bindT(0, tScene); for (let i = 0; i < 4; i++) bindT(i + 1, L[i].a.t);
    ['scene', 'b1', 'b2', 'b3', 'b4'].forEach((n, i) => gl.uniform1i(U(p, n), i));
    gl.uniform2f(U(p, 'res'), W, H); gl.uniform1f(U(p, 'frame'), frame);
    for (const k of ['curv', 'zoom', 'scan', 'glow', 'halo', 'beam', 'noiseA', 'flick', 'power', 'off', 'corner', 'refl', 'expo', 'warmSat', 'jolt']) {
      if (!Number.isFinite(o[k])) throw new Error('crt param NaN: ' + k);
      gl.uniform1f(U(p, k), o[k]);
    }
    for (const k of ['phosM', 'phosLo', 'phosHi', 'warm', 'glass']) gl.uniform3fv(U(p, k), o[k]);
    draw(null);
  }
  return { render, params };
}
