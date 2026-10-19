// The shared stage: renderer, scene, building, sheet, light, sky, ambient occlusion and
// assets. The scroll walk (main.js) and the photo map (photos.js) both build on it.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { PLAN } from './plan-data.js';
import { Rooms, PAPER, HULL_RES, LINES_BACK } from './reveal.js';
import { Sky } from './sky.js';
import { Building, H } from './arch.js';
import { Sheet } from './sheet.js';
import { furnishHall, loadModels, hangArchive } from './furnish.js';

export const ALL_ROOMS = ['hall', 'big', 'dressing', 'bath', 'closet', 'core', 'storeN', 'wc', 'storeS', 'kitchen', 'terrace', 'covered', 'none', 'top'];

export async function createStage({ canvas, capture = false, small = false, lang = 'en', archive = false, bare = false, onDirty = () => {} }) {
  // ---------------- renderer, scene, camera
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
  const DPR = Math.min(window.devicePixelRatio || 1, capture ? 1 : small ? 1.25 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = PAPER.clone();
  const camera = new THREE.PerspectiveCamera(1.1, 1, 100, 3000);

  // ---------------- fonts first: the sheet's lettering is drawn into canvases
  await Promise.race([
    Promise.all(['600 64px Inter', '500 64px Inter', '400 64px Inter', '400 64px "IBM Plex Mono"', '500 64px "IBM Plex Mono"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  // ---------------- the model and the sheet
  const rooms = new Rooms(ALL_ROOMS);
  // the hall's sweep turns round the end of the 7 m wall (14.1, 7.9) into the north lobe, and slows there
  rooms.gate('hall', 14.1, -7.9, -7.85, 14.1, 1.6);
  const building = new Building(rooms);
  building.build();
  furnishHall(building, { archive, bare });
  const shows = archive ? hangArchive(building, lang) : null;
  building.finish();
  scene.add(building.group);
  building.onArchiveImage = onDirty;
  // the photo map compares against the bare building: no door leaves in the way
  if (bare) for (const d of building.doors.all || []) if (!d.front && !d.glazed) d.pivot.visible = false;
  const sheet = new Sheet(lang);
  sheet.onTexture = onDirty;
  scene.add(sheet.group);
  sheet.paperMesh.material.transparent = true;

  // ---------------- light: low sun through the terrace glazing
  const centre = new THREE.Vector3(14.5, 0, -6);
  const sunDir = new THREE.Vector3(1.0, 0.34, -0.42).normalize();
  const sun = new THREE.DirectionalLight('#ffbb7c', 10.5);
  sun.position.copy(centre).addScaledVector(sunDir, 45);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 17, bottom: -17, near: 1, far: 100 });
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#f3e9dc', '#d6c4ad', 0.3);
  scene.add(hemi);
  // the sun keeps its bearing; act 3 lowers it to the HDRI's sunset (7.6 deg), the closing plan raises it
  const SUN_AZ = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const SUN = {
    elev: [17.4, 7.65, 38], col: ['#ffbb7c', '#ff8a4c', '#ffd9ae'].map((c) => new THREE.Color(c)), int: [10.5, 7.5, 5.2],
    hemi: [0.3, 0.32, 0.9], hemiSky: ['#f3e9dc', '#d9d7e6', '#f6efe4'].map((c) => new THREE.Color(c)), env: [0.42, 0.52, 0.45],
  };
  function setSun(a, b) {
    // a: afternoon -> sunset, b: sunset -> plan light
    const mix3 = (arr) => THREE.MathUtils.lerp(THREE.MathUtils.lerp(arr[0], arr[1], a), arr[2], b);
    const e = THREE.MathUtils.degToRad(mix3(SUN.elev));
    const d = new THREE.Vector3(SUN_AZ.x * Math.cos(e), Math.sin(e), SUN_AZ.y * Math.cos(e));
    sun.position.copy(centre).addScaledVector(d, 45);
    sun.color.copy(SUN.col[0]).lerp(SUN.col[1], a).lerp(SUN.col[2], b);
    sun.intensity = mix3(SUN.int);
    hemi.intensity = mix3(SUN.hemi);
    hemi.color.copy(SUN.hemiSky[0]).lerp(SUN.hemiSky[1], a).lerp(SUN.hemiSky[2], b);
    scene.environmentIntensity = mix3(SUN.env);
  }
  // the sky dome: paper until the open terrace, aligned so the HDRI's sun sits where our sun is
  const sky = new Sky();
  sky.uniforms.uRot.value = THREE.MathUtils.degToRad(63);
  sky.uniforms.uGain.value = 0.5;
  scene.environmentRotation.set(0, THREE.MathUtils.degToRad(-63), 0);
  scene.add(sky.mesh);
  // daylight from every window of the hall, the kitchen and the big room, as soft area lights facing in
  RectAreaLightUniformsLib.init();
  for (const w of PLAN.walls) {
    if (w.kind !== 'full') continue;
    const side = ['hall', 'kitchen', 'big'].map((k) => w.sides.indexOf(k)).find((i) => i >= 0);
    if (side === undefined) continue;
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
    const n = side === 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    for (const o of w.open) {
      if (o.kind !== 'window') continue;
      const s = (o.s0 + o.s1) / 2, wd = o.s1 - o.s0, ht = o.head - o.sill;
      const cx = w.a[0] + u[0] * s + n[0] * (w.t / 2 + 0.04), cy = w.a[1] + u[1] * s + n[1] * (w.t / 2 + 0.04);
      const l = new THREE.RectAreaLight('#ffeeda', 5.0, wd, ht);
      l.position.set(cx, o.sill + ht / 2, -cy);
      l.lookAt(cx + n[0], o.sill + ht / 2, -(cy + n[1]));
      scene.add(l);
    }
  }
  // gallery spots on the canvases (and, with the archive, on the sculptures poster)
  for (const [x, y, tx, ty, tz] of [[10.5, 9.6, 10.5, 1.75, 7.9], [7.2, 10.05, 5.85, 1.65, 10.05], [15.6, 2.8, 14.35, 1.75, 2.8], ...(shows ? shows.spots : [])]) {
    const s = new THREE.SpotLight('#ffd7ad', 14, 7, 0.55, 0.6, 2);
    s.position.set(x, H - 0.25, -y);
    s.target.position.set(tx, ty, -tz);
    scene.add(s, s.target);
  }
  scene.environmentIntensity = 0.42;

  // ---------------- ambient occlusion, multiplied over the finished frame once we are inside
  // (computed in its own buffers, so the paper and ink colours of the drawing stay exact)
  let ao = null;
  if (!small) {
    ao = new GTAOPass(scene, camera, Math.round(innerWidth * DPR), Math.round(innerHeight * DPR));
    ao.output = GTAOPass.OUTPUT.Denoise;
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.4, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 16 });
  }
  const aoScratch = new THREE.WebGLRenderTarget(4, 4);
  let noAO = [];
  function collectNoAO() {
    noAO = [];
    scene.traverse((o) => {
      const m = o.material;
      if (o.isLineSegments2 || (m && (m.transparent || m.colorWrite === false || m.isShaderMaterial || m.isMeshBasicMaterial))) noAO.push(o);
    });
  }
  collectNoAO();

  const stage = {
    THREE, renderer, scene, camera, DPR, rooms, building, sheet, shows, sky, sun, setSun, H,
    aoK: 0,
    resize(w = innerWidth, h = innerHeight) {
      renderer.setSize(w, h, false);
      for (const m of [...building.lineMats, ...sheet.lineMats]) m.resolution.set(w, h);
      HULL_RES.value.set(w, h);
      if (ao) ao.setSize(Math.round(w * DPR), Math.round(h * DPR));
    },
    render() {
      const e = camera.projectionMatrix.elements, w = camera.matrixWorld.elements;
      if (!(renderer.domElement.width > 0 && renderer.domElement.height > 0) || !Number.isFinite(e[0] + e[5] + w[12] + w[13] + w[14])) return;
      renderer.render(scene, camera);
      if (ao && stage.aoK > 0.001) {
        const vis = noAO.map((o) => o.visible);
        noAO.forEach((o) => { o.visible = false; });
        ao.render(renderer, aoScratch, aoScratch);
        noAO.forEach((o, i) => { o.visible = vis[i]; });
        ao.blendMaterial.uniforms.intensity.value = stage.aoK;
        ao.blendMaterial.uniforms.tDiffuse.value = ao.pdRenderTarget.texture;
        ao.renderPass(renderer, ao.blendMaterial, null);
      }
    },
    // the building as it stands, seen from any viewpoint: x, y (plan, m), h (eye height),
    // yaw (deg, 0 = plan east, 90 = plan north), pitch, roll (deg), fov (vertical deg), ink (the line drawing),
    // shift (vertical lens shift, in half-heights: photographs with corrected verticals are level and shifted)
    view(v) {
      const k = v.ink ? 0 : 80;
      for (const r of ALL_ROOMS) rooms.set(r, v.x, -v.y, k, 1);
      building.setCut(H + 0.06, true);
      for (const r of building.shadowOnly) r.visible = true;
      building.doors.front.setAngle(1);
      building.setSlide(0);
      building.setCapTone(1);
      sky.update(camera, 0);
      sheet.setFade(0);
      sheet.paperMesh.material.opacity = 1;
      sheet.paperMesh.visible = true;
      setSun(0, 0);
      LINES_BACK.value = v.ink ? 1 : 0;
      const yaw = THREE.MathUtils.degToRad(v.yaw), pitch = THREE.MathUtils.degToRad(v.pitch || 0);
      const h = v.h ?? 1.35;
      camera.position.set(v.x, h, -v.y);
      camera.up.set(0, 1, 0);
      camera.lookAt(v.x + Math.cos(yaw) * Math.cos(pitch), h + Math.sin(pitch), -v.y - Math.sin(yaw) * Math.cos(pitch));
      if (v.roll) camera.rotateZ(THREE.MathUtils.degToRad(v.roll));
      camera.fov = v.fov ?? 60;
      camera.aspect = v.aspect ?? innerWidth / innerHeight;
      camera.near = 0.03; camera.far = 300;
      camera.updateProjectionMatrix();
      if (v.shift) {
        camera.projectionMatrix.elements[9] = v.shift;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
      stage.aoK = small || v.ao === false ? 0 : 0.8;
      if (v.shadows !== false) renderer.shadowMap.needsUpdate = true;
      stage.render();
    },
  };

  // ---------------- assets: environment, textures, models (the sheet does not wait for them)
  const texLoader = new THREE.TextureLoader();
  const tex = (url, srgb, repeat = 1) => new Promise((res) => texLoader.load(url, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }, undefined, () => res(null)));

  async function loadEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const hdr = await new RGBELoader().loadAsync('assets/hdri/sunset_jhbcentral_2k.hdr');
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    sky.setTexture(hdr); // the same HDRI is the sky seen from the terrace
    scene.environment = env;
  }

  async function loadTextures() {
    const [mC, mR, bC, bR, pN, pR, oC, oR] = await Promise.all([
      tex('assets/tex/marble-white/color.jpg', true), tex('assets/tex/marble-white/rough.jpg', false),
      tex('assets/tex/marble-black/color.jpg', true), tex('assets/tex/marble-black/rough.jpg', false),
      tex('assets/tex/plaster/normal.jpg', false, 0.5), tex('assets/tex/plaster/rough.jpg', false, 0.5),
      tex('assets/tex/oak/color.jpg', true), tex('assets/tex/oak/rough.jpg', false),
    ]);
    for (const m of Object.values(building.mats)) {
      const k = m.userData?.kind;
      if (!k) continue;
      if (k === 'marble' || k === 'stoneFloor' || k === 'terraceFloor') { m.map = mC; m.roughnessMap = mR; }
      else if (k === 'inlay') { m.map = bC; m.roughnessMap = bR; }
      else if (k === 'plaster' || k === 'ceiling' || k === 'planter') { m.normalMap = pN; m.normalScale = new THREE.Vector2(0.22, 0.22); m.roughnessMap = pR; }
      else if (k === 'oak' || k === 'darkOak' || k === 'teak' || k === 'woodFloor') { m.map = oC; m.roughnessMap = oR; }
      m.needsUpdate = true;
    }
  }

  stage.loading = Promise.all([
    loadEnvironment().catch((e) => console.warn('environment', e)),
    loadTextures().catch((e) => console.warn('textures', e)),
    (bare ? Promise.resolve() : loadModels(building, renderer, onDirty)).catch((e) => console.warn('models', e)),
  ]).then(() => {
    collectNoAO();
    renderer.shadowMap.needsUpdate = true;
    onDirty();
  });

  return stage;
}
