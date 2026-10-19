// Ink-to-material reveal. Every surface and line belongs to one room; each room
// carries a sweep (origin, radius). Outside the sweep a fragment is drawn as ink
// on paper; inside it renders with its real material. Works in world space, so
// the drawing and the building stay the same geometry.
import * as THREE from 'three';

export const PAPER = new THREE.Color('#f2efe8');
export const INK = new THREE.Color('#171614');

const NOISE = /* glsl */`
uniform vec2 uRvOrigin;
uniform float uRvRadius;
uniform float uRvSoft;
uniform vec4 uRvGate;   // xy: corner the sweep turns round, z/w: region beyond it (z < z, x < w)
uniform float uRvGateK; // the sweep slows down past the corner
varying vec3 vRvW;
float rvDist(){
  vec2 p = vRvW.xz;
  if (p.y < uRvGate.z && p.x < uRvGate.w) return distance(uRvOrigin, uRvGate.xy) + uRvGateK * distance(uRvGate.xy, p);
  return distance(p, uRvOrigin);
}
float rvHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rvNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rvHash(i), rvHash(i + vec2(1, 0)), u.x), mix(rvHash(i + vec2(0, 1)), rvHash(i + vec2(1, 1)), u.x), u.y);
}
// 1 = still ink, 0 = real material
float rvInk(){
  if (uRvRadius <= 0.0) return 1.0;
  float d = rvDist();
  float n = rvNoise(vRvW.xz * 0.85) * 0.9 + rvNoise(vRvW.xz * 3.7 + 11.0) * 0.3 + rvNoise(vRvW.yy * 2.1 + vRvW.xz) * 0.15;
  return smoothstep(uRvRadius - uRvSoft, uRvRadius, d + n);
}
float rvEdge(){
  if (uRvRadius <= 0.0) return 0.0;
  float d = rvDist();
  float n = rvNoise(vRvW.xz * 0.85) * 0.9 + rvNoise(vRvW.xz * 3.7 + 11.0) * 0.3 + rvNoise(vRvW.yy * 2.1 + vRvW.xz) * 0.15;
  float x = (d + n - (uRvRadius - uRvSoft * 0.5)) / (uRvSoft * 0.5);
  return exp(-x * x * 2.0);
}
`;

const WORLD_VARY = /* glsl */`
  vec4 rvP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    rvP = instanceMatrix * rvP;
  #endif
  vRvW = (modelMatrix * rvP).xyz;
`;

export class Rooms {
  constructor(keys) {
    this.map = {};
    for (const k of keys) this.add(k);
  }
  add(k) {
    if (!this.map[k]) {
      this.map[k] = { uRvOrigin: { value: new THREE.Vector2() }, uRvRadius: { value: 0 }, uRvSoft: { value: 1.4 },
        uRvGate: { value: new THREE.Vector4(0, 0, -1e9, -1e9) }, uRvGateK: { value: 1 } };
    }
    return this.map[k];
  }
  get(k) { return this.add(k || 'none'); }
  gate(k, jx, jz, zMax, xMax, slow = 1) {
    const r = this.get(k);
    r.uRvGate.value.set(jx, jz, zMax, xMax);
    r.uRvGateK.value = slow;
  }
  set(k, x, z, radius, soft) {
    const r = this.get(k);
    r.uRvOrigin.value.set(x, z);
    r.uRvRadius.value = radius;
    if (soft !== undefined) r.uRvSoft.value = soft;
  }
}

// Patch a MeshStandardMaterial / MeshPhysicalMaterial.
// opts.ink: colour the ink pass uses (paper by default; black for steel, the floor inlay…)
// opts.inkAlpha: alpha while still ink (0 for glass so it reads as a line only)
// opts.shade: how much vertical faces darken in ink so the model reads in 3D
// opts.tiles: { size: [w,d], scale } paints a stone floor from one texture with per-tile variation
export function revealMaterial(mat, room, opts = {}) {
  const ink = {};
  (opts.ink || PAPER).getRGB(ink, THREE.SRGBColorSpace); // mixed after the output transform
  const u = {
    uRvInk: { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
    uRvInkAlpha: { value: opts.inkAlpha ?? 1 },
    uRvShade: { value: opts.shade ?? 0.07 },
    uTile: { value: new THREE.Vector2(...(opts.tiles?.size || [0.6, 0.6])) },
    uTileScale: { value: opts.tiles?.scale ?? 0.45 },
    uTileRot: { value: opts.tiles?.rotate === false ? 0 : 1 },
  };
  const tiles = !!opts.tiles;
  mat.userData.reveal = { room, u };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, room, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRvW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + WORLD_VARY);
    let fs = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE + `
uniform vec3 uRvInk; uniform float uRvInkAlpha; uniform float uRvShade;
uniform vec2 uTile; uniform float uTileScale; uniform float uTileRot;
float tHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }`);
    if (tiles) {
      fs = fs.replace('#include <map_fragment>', /* glsl */`
  vec2 tw = vRvW.xz / uTile;
  vec2 tid = floor(tw);
  vec2 tf = fract(tw);
  float h1 = tHash(tid), h2 = tHash(tid + 17.31), h3 = tHash(tid + 5.77);
  vec2 q = tf - 0.5;
  float rr = floor(h1 * 4.0) * uTileRot;
  if (rr > 2.5) q = vec2(q.y, -q.x); else if (rr > 1.5) q = -q; else if (rr > 0.5) q = vec2(-q.y, q.x);
  vec2 tUv = (q + 0.5) * uTileScale + vec2(h2, h3) * (1.0 - uTileScale);
  vec2 tdx = dFdx(tw) * uTileScale, tdy = dFdy(tw) * uTileScale;
  #ifdef USE_MAP
    vec4 sampledDiffuseColor = textureGrad(map, tUv, tdx, tdy);
    diffuseColor *= sampledDiffuseColor;
  #endif
  vec2 gd = min(tf, 1.0 - tf) * uTile;
  float grout = 1.0 - smoothstep(0.0006, 0.0018, min(gd.x, gd.y));
  diffuseColor.rgb *= 1.0 - grout * 0.28;
  diffuseColor.rgb *= 0.97 + 0.06 * h3;
`).replace('#include <roughnessmap_fragment>', /* glsl */`
  float roughnessFactor = roughness;
  #ifdef USE_ROUGHNESSMAP
    roughnessFactor *= textureGrad(roughnessMap, tUv, tdx, tdy).g;
  #endif
  roughnessFactor = mix(roughnessFactor, 0.55, grout);
`);
    }
    fs = fs.replace('#include <dithering_fragment>', /* glsl */`#include <dithering_fragment>
  {
    float k = rvInk();
    vec3 nW = normalize(inverseTransformDirection(normal, viewMatrix));
    float lit = clamp(dot(nW, normalize(vec3(0.35, 1.0, 0.55))), 0.0, 1.0);
    float sh = 1.0 - uRvShade * (1.0 - lit) - uRvShade * 0.6 * (1.0 - abs(nW.y));
    vec3 inkCol = uRvInk * sh;
    float e = rvEdge() * (1.0 - k);
    vec3 real = gl_FragColor.rgb * mix(vec3(1.0), vec3(0.93, 0.87, 0.78), e * 0.55);
    gl_FragColor.rgb = mix(real, inkCol, k);
    gl_FragColor.a = mix(gl_FragColor.a, uRvInkAlpha, k);
  }`);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'rv' + (tiles ? 't' : '') + (mat.type || '');
  return mat;
}

// Fat ink lines that fade where their room has been revealed.
// LINES_BACK brings every line back over the real materials (the closing plan sheet).
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
export const LINES_BACK = { value: 0 };

export function revealLineMaterial(room, opts = {}) {
  const m = new LineMaterial({
    color: (opts.color || INK).getHex(),
    linewidth: opts.width ?? 1.2,
    transparent: true,
    depthWrite: false,
    opacity: opts.opacity ?? 1,
    worldUnits: false,
    toneMapped: false,
  });
  m.userData.room = room;
  m.userData.baseWidth = opts.width ?? 1.2;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, room, { uLinesBack: LINES_BACK });
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vRvW;\nvoid main() {\n  vRvW = (modelMatrix * vec4(position.y < 0.5 ? instanceStart : instanceEnd, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', NOISE + '\nuniform float uLinesBack;\nvoid main() {')
      .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', 'gl_FragColor = vec4( diffuseColor.rgb, alpha * max(rvInk(), uLinesBack) );');
  };
  m.customProgramCacheKey = () => 'rvline';
  return m;
}

// Screen-space outline shell for complex meshes (furniture, plants) while they are ink.
// One shared resolution uniform; main.js keeps it in step with the viewport.
export const HULL_RES = { value: new THREE.Vector2(window.innerWidth, window.innerHeight) };
export function revealHullMaterial(room, px = 1.1) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...room, uPx: { value: px }, uRes: HULL_RES, uInk: { value: INK.clone() }, uLinesBack: LINES_BACK },
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      uniform float uPx; uniform vec2 uRes; varying vec3 vRvW;
      #include <common>
      #include <skinning_pars_vertex>
      #include <clipping_planes_pars_vertex>
      void main(){
        vec3 transformed = position;
        vec3 objectNormal = normal;
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vRvW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        vec3 nv = normalize(normalMatrix * objectNormal);
        vec2 n2 = (projectionMatrix * vec4(nv, 0.0)).xy;
        float l = length(n2);
        if (l > 1e-5) gl_Position.xy += (n2 / l) * uPx * 2.0 / uRes * gl_Position.w;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uInk;
      uniform float uLinesBack;
      #include <clipping_planes_pars_fragment>
      ${NOISE}
      void main(){
        #include <clipping_planes_fragment>
        if (max(rvInk(), uLinesBack) < 0.5) discard;
        gl_FragColor = vec4(uInk, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return m;
}
