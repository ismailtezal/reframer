import { createEffect } from "remotion";

/**
 * 2.5D parallax for a still photo: the picture is re-sampled through its depth map (bright = near),
 * so as the virtual camera moves, near things shift and swell more than far ones. Runs as a WebGL2
 * effect in the clip's canvas chain, so grades and LUTs on the clip still apply after it.
 */

export type ParallaxMove = "push" | "pull" | "left" | "right" | "rise" | "fall";

export type DepthParallaxParams = {
  /** The loaded depth map (same framing as the photo). */
  depth: HTMLImageElement;
  /** Identifies the depth map in the effect key. */
  depthKey: string;
  move: ParallaxMove;
  /** 0–1 strength (0.5 is a clear but natural move). */
  amount: number;
  /** 0–1 through the move. */
  progress: number;
  /** The photo's width / height, and how it's fitted to the canvas. */
  imageAspect: number;
  fit: "cover" | "contain" | "fill";
};

type State = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  source: WebGLTexture;
  depth: WebGLTexture;
  depthKey: string | null;
  u: Record<string, WebGLUniformLocation | null>;
};

const VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// The view is zoomed in a little so the shifted edges never show; a few fixed-point iterations find,
// for each output pixel, the source pixel whose depth-scaled shift lands there.
const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform sampler2D uDepth;
uniform vec4 uDepthRect;
uniform vec2 uShift;
uniform float uDolly;
uniform float uZoom;
uniform float uFocus;
// Depth softened over a small neighbourhood: hard depth edges tear the picture when layers separate,
// soft ones bend it a little, which the eye accepts.
float depthAt(vec2 q) {
  vec2 dq = uDepthRect.xy + q * uDepthRect.zw;
  float r = 0.012;
  float d = texture(uDepth, clamp(dq, 0.0, 1.0)).r * 0.36;
  d += texture(uDepth, clamp(dq + vec2(r, 0.0), 0.0, 1.0)).r * 0.16;
  d += texture(uDepth, clamp(dq - vec2(r, 0.0), 0.0, 1.0)).r * 0.16;
  d += texture(uDepth, clamp(dq + vec2(0.0, r), 0.0, 1.0)).r * 0.16;
  d += texture(uDepth, clamp(dq - vec2(0.0, r), 0.0, 1.0)).r * 0.16;
  return d;
}
void main() {
  vec2 c = vec2(0.5);
  vec2 p = c + (vUv - c) / uZoom;
  vec2 q = p;
  for (int i = 0; i < 5; i++) {
    float d = depthAt(q) - uFocus;
    q = p - uShift * d - (p - c) * uDolly * d;
  }
  fragColor = texture(uSource, clamp(q, 0.0, 1.0));
}
`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type);
  if (!s) throw new Error("Could not create a shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Parallax shader: ${gl.getShaderInfoLog(s) ?? "compile failed"}`);
  return s;
};

const texture = (gl: WebGL2RenderingContext) => {
  const t = gl.createTexture();
  if (!t) throw new Error("Could not create a texture");
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
};

const setup = (target: HTMLCanvasElement): State => {
  const gl = target.getContext("webgl2", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("The parallax effect needs WebGL2");
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a program");
  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(`Parallax program: ${gl.getProgramInfoLog(program) ?? "link failed"}`);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  if (!vao || !vbo) throw new Error("Could not create buffers");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  const u = Object.fromEntries(
    ["uSource", "uDepth", "uDepthRect", "uShift", "uDolly", "uZoom", "uFocus"].map((n) => [n, gl.getUniformLocation(program, n)]),
  );
  return { gl, program, vao, vbo, source: texture(gl), depth: texture(gl), depthKey: null, u };
};

/**
 * Mostly linear, so the camera is visibly moving through the whole shot (cuts between moving shots
 * read as one flowing camera), with a touch of ease so it never starts with a jolt.
 */
const travel = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return 0.75 * x + 0.25 * x * x * (3 - 2 * x);
};

/**
 * Camera for the move at a point in it: lateral shift (uv), radial dolly, zoom and the still depth.
 * At amount 1 a push grows the whole frame ~15% and near things ~8% more than far ones over the shot (the
 * separation sells depth; much more and edges tear); a slide moves near and far layers ~0.07 of the frame apart.
 */
export const parallaxCamera = (move: ParallaxMove, amount: number, progress: number) => {
  const a = Math.min(1, Math.max(0, amount));
  const t = travel(progress);
  const side = 0.07 * a;
  const dolly = 0.08 * a;
  const push = 0.15 * a;
  switch (move) {
    case "left":
    case "right": {
      const dir = move === "left" ? -1 : 1;
      return { shift: [dir * side * (t - 0.5), 0] as const, dolly: 0, zoom: 1 + side * 0.7 + 0.03 * a * t, focus: 0.55 };
    }
    case "rise":
    case "fall": {
      const dir = move === "rise" ? 1 : -1;
      return { shift: [0, dir * side * (t - 0.5)] as const, dolly: 0, zoom: 1 + side * 0.7 + 0.03 * a * t, focus: 0.55 };
    }
    case "pull":
      return { shift: [0, 0] as const, dolly: dolly * (1 - t), zoom: 1.03 + push * (1 - t), focus: 0 };
    default:
      return { shift: [0, 0] as const, dolly: dolly * t, zoom: 1.03 + push * t, focus: 0 };
  }
};

/** Where the canvas sits inside the photo (in the photo's uv), for the fit the canvas uses. */
const depthRect = (imageAspect: number, canvasAspect: number, fit: DepthParallaxParams["fit"]) => {
  if (fit === "fill") return [0, 0, 1, 1];
  const wider = imageAspect > canvasAspect;
  if (fit === "cover") {
    if (wider) {
      const w = canvasAspect / imageAspect;
      return [(1 - w) / 2, 0, w, 1];
    }
    const h = imageAspect / canvasAspect;
    return [0, (1 - h) / 2, 1, h];
  }
  // contain: the photo fills a band of the canvas; map canvas uv back into it.
  if (wider) {
    const h = canvasAspect / imageAspect;
    return [0, -(1 / h - 1) / 2, 1, 1 / h];
  }
  const w = imageAspect / canvasAspect;
  return [-(1 / w - 1) / 2, 0, 1 / w, 1];
};

export const depthParallax = createEffect<DepthParallaxParams, State>({
  type: "reframer.depthParallax",
  label: "depthParallax()",
  documentationLink: null,
  backend: "webgl2",
  calculateKey: (p) => `depth-parallax-${p.depthKey}-${p.move}-${p.amount}-${p.progress.toFixed(4)}-${p.fit}`,
  setup,
  apply: ({ source, width, height, params, state, flipSourceY }) => {
    const { gl, program, u } = state;
    gl.viewport(0, 0, width, height);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
    gl.bindTexture(gl.TEXTURE_2D, state.source);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    if (state.depthKey !== params.depthKey) {
      // A DOM image: flip it so its rows match the quad's uv, like the source.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, state.depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, params.depth);
      state.depthKey = params.depthKey;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    const cam = parallaxCamera(params.move, params.amount, params.progress);
    const [rx, ry, rw, rh] = depthRect(params.imageAspect, width / height, params.fit);
    gl.uniform1i(u.uSource, 0);
    gl.uniform1i(u.uDepth, 1);
    // Flipped uploads put v = 0 at the bottom, so the rect's y origin flips too.
    gl.uniform4f(u.uDepthRect, rx, 1 - ry - rh, rw, rh);
    gl.uniform2f(u.uShift, cam.shift[0], cam.shift[1]);
    gl.uniform1f(u.uDolly, cam.dolly);
    gl.uniform1f(u.uZoom, cam.zoom);
    gl.uniform1f(u.uFocus, cam.focus);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.source);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.depth);
    gl.bindVertexArray(state.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
  },
  cleanup: (state) => {
    const { gl } = state;
    gl.deleteTexture(state.source);
    gl.deleteTexture(state.depth);
    gl.deleteBuffer(state.vbo);
    gl.deleteProgram(state.program);
    gl.deleteVertexArray(state.vao);
  },
  schema: {},
  validateParams: (p) => {
    if (!p || !(p.depth instanceof HTMLImageElement)) throw new TypeError("depthParallax needs a loaded depth image");
  },
});
