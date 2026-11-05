import * as THREE from "three";

/**
 * Two-tone world shading. The single directional light is the key ("sun", window light or moonlight): its N·L and
 * shadow-map visibility pick between a lit colour (the light's own colour × intensity) and a coloured shade
 * (uShade: warm-lit scenes get lavender/blue shade, night gets deep violet), with a soft terminator. Point lights
 * (lamps, monitor glow, the alarm) add on top through three's own loop. No hemisphere or ambient light: the shade
 * colour is the fill, so shadows keep their colour instead of going grey or black.
 */
export const TOON = {
  uShade: { value: new THREE.Color(0.35, 0.36, 0.5) },
  uTermLo: { value: -0.08 },
  uTermHi: { value: 0.32 },
  uUpK: { value: 0.82 },
};

const DIR_START = "#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )";
const chunk = THREE.ShaderChunk.lights_fragment_begin;
const at = chunk.indexOf(DIR_START);
if (at < 0) throw new Error("toon.ts: three's lights_fragment_begin changed");
const dirPart = chunk
  .slice(at)
  .replace(
    "directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow(",
    "sunVis = ( directLight.visible && receiveShadow ) ? getShadow(",
  )
  .replace(
    "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",
    "sunDirV = directLight.direction; sunCol = directLight.color;",
  );
if (!dirPart.includes("sunVis =") || !dirPart.includes("sunDirV =")) throw new Error("toon.ts: patch failed");
const LIGHTS_BEGIN = `float sunVis = 1.0; vec3 sunDirV = vec3(0.0, 1.0, 0.0); vec3 sunCol = vec3(0.0);\n${chunk.slice(0, at)}${dirPart}`;

const TWO_TONE = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float ndl = dot(geometryNormal, sunDirV);
  float lit = smoothstep(uTermLo, uTermHi, ndl) * sunVis;
  float upK = mix(uUpK, 1.0, 0.5 + 0.5 * dot(geometryNormal, upV));
  vec3 key = mix(uShade, sunCol * (0.82 + 0.18 * max(ndl, 0.0)), lit) * upK;
  reflectedLight.directDiffuse += diffuseColor.rgb * key;
}
#endif
`;

const DECL = "#include <common>\nuniform vec3 uShade; uniform float uTermLo; uniform float uTermHi; uniform float uUpK;";

/** A MeshLambertMaterial with the two-tone key. Emissive still works (screens, neon, lamps). */
export function toon(params: THREE.MeshLambertMaterialParameters = {}) {
  const m = new THREE.MeshLambertMaterial(params);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TOON);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", DECL)
      .replace("#include <lights_fragment_begin>", LIGHTS_BEGIN)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${TWO_TONE}`);
  };
  m.customProgramCacheKey = () => "toon2";
  return m;
}

/** Self-lit material (screens, neon, sky): colour × intensity, no lighting, optional texture. */
export function glow(color: THREE.ColorRepresentation, intensity = 1, map?: THREE.Texture | null) {
  const m = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    map: map ?? null,
    fog: false,
    toneMapped: false,
  });
  return m;
}

/**
 * Character cards: the drawing is lit by the scene, not pasted on. The key light's colour tints the card (normalised
 * so faces stay bright), a soft gradient darkens the side away from the key, and a coloured glow (monitor light at
 * night, the alarm) can wash in from one side. Alpha-to-coverage under MSAA gives clean cut-out edges.
 */
export class CardMaterial extends THREE.ShaderMaterial {
  constructor(map: THREE.Texture) {
    super({
      uniforms: {
        map: { value: map },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uGain: { value: 1 },
        uKeySide: { value: 1 },
        uGrad: { value: 0.12 },
        uGlow: { value: new THREE.Color(0, 0, 0) },
        uGlowSide: { value: -1 },
        uOpacity: { value: 1 },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 1000 },
        uFogFar: { value: 2000 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 uTint;
        uniform float uGain;
        uniform float uKeySide;
        uniform float uGrad;
        uniform vec3 uGlow;
        uniform float uGlowSide;
        uniform float uOpacity;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vec4 t = texture2D(map, vUv);
          float a = t.a * uOpacity;
          if (a < 0.02) discard;
          float side = (vUv.x - 0.5) * 2.0;                       // -1 left .. 1 right of the card
          float away = clamp(-side * uKeySide, 0.0, 1.0);
          vec3 c = t.rgb * uTint * uGain * (1.0 - uGrad * smoothstep(0.0, 1.0, away));
          float gs = clamp(side * uGlowSide, 0.0, 1.0);
          c += t.rgb * uGlow * (0.35 + 0.65 * smoothstep(0.0, 1.0, gs));
          float fk = clamp((vDist - uFogNear) / max(uFogFar - uFogNear, 1e-3), 0.0, 1.0);
          c = mix(c, uFogColor, fk);
          gl_FragColor = vec4(c, a);
        }`,
      alphaToCoverage: true,
      transparent: false,
      depthWrite: true,
    });
  }
}
