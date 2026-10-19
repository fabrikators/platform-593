// Direction A, "The line": the hall staged as a collector's gallery.
// Plan frame coordinates (x east, y north). Pieces sit in the bays the black
// line makes; nothing stands on the line itself.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { rect, W, H } from './arch.js';
import { revealMaterial, revealHullMaterial, INK } from './reveal.js';
import { STR } from './i18n.js';

export function furnishHall(b, opts = {}) {
  const R = 'hall';
  // the photo map compares the photographs with the bare building: architecture and the ceiling tracks only
  if (opts.bare) { if (opts.bare !== 'shell') tracks(b, R); return; }
  // long dark table in the north lobe of the line (9.6 m, as on Platform-2c)
  const tx0 = 8.0, tx1 = 17.6, ty0 = 9.5, ty1 = 10.62;
  b.prism(R, 'darkOak', rect(tx0, ty0, tx1, ty1), 0.705, 0.745);
  for (const x of [tx0 + 0.35, (tx0 + tx1) / 2 - 1.6, (tx0 + tx1) / 2 + 1.6, tx1 - 0.35]) {
    b.prism(R, 'steel', rect(x - 0.03, ty0 + 0.08, x + 0.03, ty1 - 0.08), 0.68, 0.705);
    for (const y of [ty0 + 0.1, ty1 - 0.1]) b.prism(R, 'steel', rect(x - 0.03, y - 0.03, x + 0.03, y + 0.03), 0, 0.68);
  }
  // books and a folio on the table
  for (const [x, w, d, h] of [[9.2, 0.32, 0.24, 0.06], [9.24, 0.28, 0.22, 0.12], [12.4, 0.62, 0.44, 0.02], [15.9, 0.3, 0.22, 0.09]]) {
    b.prism(R, 'paperStack', rect(x - w / 2, 10.0 - d / 2, x + w / 2, 10.0 + d / 2), 0.745, 0.745 + h);
  }

  // plinths in the bays of the serpentine
  const plinths = [
    { x: 16.0, y: 8.12, s: 0.46, h: 0.95, item: 'ceramic_vase_01' },
    { x: 17.25, y: 8.2, s: 0.4, h: 0.6, item: 'brass_vase_01' },
    { x: 16.55, y: 4.55, s: 0.5, h: 0.82, item: 'ceramic_vase_03' },
  ];
  for (const p of plinths) b.prism(R, 'plinth', rect(p.x - p.s / 2, p.y - p.s / 2, p.x + p.s / 2, p.y + p.s / 2), 0, p.h);
  // a bronze piece inside the first finger of the line
  b.prism(R, 'plinth', rect(16.0, 5.95, 17.2, 6.75), 0, 0.32);

  // canvases (colour fields painted in code, no outside artwork)
  const canvases = [
    { x0: 8.9, x1: 12.1, y: 7.881 + 0.03, face: 1, bottom: 0.8, h: 1.9, pal: ['#7a2a1f', '#c45a2c', '#e9b26a'] },
    { x: 5.813 + 0.03, y0: 9.1, y1: 11.0, face: 2, bottom: 0.9, h: 1.55, pal: ['#1f2e57', '#27406f', '#d9cfb8'] },
    { x: 14.328 + 0.03, y0: 2.1, y1: 3.5, face: 2, bottom: 0.85, h: 1.8, pal: ['#c49a3c', '#efe0b4', '#3a3a32'] },
  ];
  // with ?archive the walls carry Madi's 1988-89 shows instead (hangArchive)
  if (!opts.archive) canvases.forEach((c, i) => addCanvas(b, R, c, i));

  tracks(b, R);
}

// black track lights on the ceiling, like the photographs
function tracks(b, R) {
  for (const [y, xa] of [[3.0, 14.6], [6.3, 14.6], [10.05, 6.2]]) {
    b.prism(R, 'steel', rect(xa, y - 0.02, 21.0, y + 0.02), H - 0.04, H - 0.005);
    for (let x = xa + 0.6; x < 21; x += 1.55) {
      b.prism(R, 'steel', rect(x - 0.04, y - 0.04, x + 0.04, y + 0.04), H - 0.24, H - 0.04);
    }
  }
}

function addCanvas(b, room, c, i) {
  const tex = colourField(c.pal, i);
  const depth = 0.045;
  let w, geo, pos, rotY;
  if (c.face === 1) { // on a wall facing north (+y)
    w = c.x1 - c.x0;
    pos = W((c.x0 + c.x1) / 2, c.y + depth / 2, c.bottom + c.h / 2);
    rotY = Math.PI;
  } else { // on a wall facing east (+x)
    w = c.y1 - c.y0;
    pos = W(c.x + depth / 2, (c.y0 + c.y1) / 2, c.bottom + c.h / 2);
    rotY = Math.PI / 2;
  }
  geo = new THREE.BoxGeometry(w, c.h, depth);
  const side = b.materialFor(room, 'canvasEdge');
  const front = revealMaterial(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), b.rooms.get(room));
  front.polygonOffset = true; front.polygonOffsetFactor = 1; front.polygonOffsetUnits = 1;
  const mesh = new THREE.Mesh(geo, [side, side, side, side, front, side]);
  // box +z is the face we see; turn it into the room
  mesh.position.copy(pos);
  mesh.rotation.y = rotY;
  mesh.castShadow = true; mesh.receiveShadow = true;
  b.group.add(mesh);
  const e = new LineSegments2(new LineSegmentsGeometry().setPositions(new THREE.EdgesGeometry(geo).attributes.position.array), b.lineMat(room));
  e.position.copy(pos); e.rotation.y = rotY;
  b.group.add(e);
}

function colourField(pal, seed) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  const rnd = mulberry(seed * 7919 + 13);
  g.fillStyle = pal[0]; g.fillRect(0, 0, c.width, c.height);
  const block = (col, x, y, w, h, a) => {
    for (let k = 0; k < 140; k++) {
      g.globalAlpha = a * (0.05 + rnd() * 0.06);
      g.fillStyle = col;
      const j = 18;
      g.fillRect(x + (rnd() - 0.5) * j, y + (rnd() - 0.5) * j, w + (rnd() - 0.5) * j * 2, h + (rnd() - 0.5) * j * 2);
    }
  };
  block(pal[1], 70, 60, 884, 300, 1);
  block(pal[2], 70, 400, 884, 170, 1);
  g.globalAlpha = 1;
  // canvas weave
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
    const v = ((px % 3 === 0) ^ (py % 3 === 0) ? 5 : -3) + (rnd() - 0.5) * 6;
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// CC0 models from Poly Haven, placed in the hall
const MODELS = [
  // by the east glazing, clear of the corridor to the terrace door (photo 21)
  { id: 'mid_century_lounge_chair', at: [20.95, 2.75], rot: 150, room: 'hall' },
  { id: 'potted_plant_02', at: [21.15, 3.55], rot: 0, room: 'hall', scale: 1.15 },
  { id: 'pachira_aquatica_01', at: [21.1, 3.0], rot: 20, room: 'hall', scale: 1.0 },
  { id: 'pachira_aquatica_01', at: [20.95, 11.85], rot: 140, room: 'hall', scale: 0.9 },
  { id: 'modern_arm_chair_01', at: [6.45, 11.55], rot: 150, room: 'hall' },
  { id: 'ceramic_vase_01', at: [16.0, 8.12], on: 0.95, room: 'hall', scale: 1.6 },
  { id: 'brass_vase_01', at: [17.25, 8.2], on: 0.6, room: 'hall', scale: 1.5 },
  { id: 'ceramic_vase_03', at: [16.55, 4.55], on: 0.82, room: 'hall', scale: 1.4 },
  // covered terrace: trees in the planters, two chairs and a low table in the bay
  { id: 'pachira_aquatica_01', at: [23.95, 6.45], on: 0.2, room: 'covered', scale: 0.85, rot: 60 },
  { id: 'pachira_aquatica_01', at: [24.85, 9.85], on: 0.2, room: 'covered', scale: 0.8, rot: 200 },
  { id: 'pachira_aquatica_01', at: [25.88, 8.3], on: 0.2, room: 'covered', scale: 0.95, rot: 110 },
  { id: 'pachira_aquatica_01', at: [25.88, 3.4], on: 0.2, room: 'covered', scale: 0.95, rot: 300 },
  { id: 'pachira_aquatica_01', at: [23.95, 10.85], on: 0.2, room: 'covered', scale: 0.75, rot: 15 },
  { id: 'potted_plant_02', at: [22.0, 11.0], room: 'covered', scale: 1.25, rot: 30 },
  { id: 'potted_plant_02', at: [22.05, 4.7], room: 'covered', scale: 1.15, rot: 130 },
  { id: 'modern_arm_chair_01', at: [24.3, 7.95], room: 'covered', face: [24.95, 8.4] },
  { id: 'modern_arm_chair_01', at: [25.5, 8.85], room: 'covered', face: [24.95, 8.4] },
  { id: 'modern_coffee_table_01', at: [24.95, 8.4], room: 'covered', rot: 35 },
];

export async function loadModels(b, renderer, onEach) {
  const loader = new GLTFLoader();
  const cache = {};
  const hulls = [];
  const load = (id) => loader.loadAsync(`assets/models/${id}/${id}_1k.gltf`).catch(() => loader.loadAsync(`assets/models/${id}/${id}_1k.gltf`));
  const jobs = MODELS.map(async (m) => {
    cache[m.id] ||= load(m.id);
    let gltf;
    try { gltf = await cache[m.id]; } catch (e) { console.warn('model', m.id, e); return; }
    const obj = gltf.scene.clone(true);
    const room = b.rooms.get(m.room);
    const meshes = [];
    obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((o) => {
      o.material = o.material.clone();
      revealMaterial(o.material, room, { shade: 0.05 });
      o.material.envMapIntensity = 0.8;
      o.castShadow = true; o.receiveShadow = true;
      const hull = new THREE.Mesh(o.geometry, revealHullMaterial(room, 1.0));
      hull.renderOrder = 1;
      hulls.push(hull.material);
      o.add(hull);
    });
    const s = m.scale || 1;
    obj.scale.setScalar(s);
    obj.position.copy(W(m.at[0], m.at[1], m.on || 0));
    obj.rotation.y = m.face ? Math.atan2(m.face[0] - m.at[0], -m.face[1] + m.at[1]) : THREE.MathUtils.degToRad(m.rot || 0);
    b.group.add(obj);
    onEach?.();
  });
  await Promise.allSettled(jobs);
  return hulls;
}

// ---------------------------------------------------------------- Platform, 1988-89
// Hussein Madi's four shows at Platform, hung on the hall walls with bilingual labels.
// Images live in assets/archive/ (kept out of the public build until the estate agrees).
const SHOWS = [
  // hung in date order along the ride on the black line (act 2): column, partition, west wall, lobe wall.
  // face: which way the wall faces; wall: its plane (plan x for E/W faces, plan y for N);
  // c: centre along the wall; b: bottom height; w, h: outer size (m)
  { key: 'sculptures', face: 'W', wall: 18.816,
    poster: { file: 'poster-sculptures.jpg', c: 8.45, b: 1.0, w: 0.62, h: 0.89 }, label: { c: 7.86, y: 1.45 } },
  { key: 'pastels', face: 'E', wall: 14.328, work: { file: 'pastels.jpg', c: 2.85, b: 0.85, w: 1.34, h: 1.28, kind: 'framed', mat: 0.12 },
    poster: { file: 'poster-pastels.jpg', c: 3.9, b: 1.25, w: 0.48, h: 0.68 }, label: { c: 3.9, y: 1.02 } },
  { key: 'dessins', face: 'E', wall: 5.813, work: { file: 'dessins.jpg', c: 10.55, b: 0.85, w: 1.19, h: 1.28, kind: 'framed', mat: 0.1 },
    poster: { file: 'poster-dessins.jpg', c: 8.75, b: 1.0, w: 0.6, h: 0.85 }, label: { c: 9.47, y: 1.45 } },
  { key: 'peintures', face: 'N', wall: 7.881, work: { file: 'peintures.jpg', c: 10.0, b: 0.7, w: 1.9, h: 1.82, kind: 'canvas' },
    poster: { file: 'poster-peintures.jpg', c: 12.35, b: 0.95, w: 0.66, h: 0.915 }, label: { c: 13.1, y: 1.45 } },
];

function wallPose(face, wall, c, height, depth) {
  // returns world position of the piece's centre and its Y rotation (box +z looks into the room)
  if (face === 'N') return { pos: W(c, wall + depth / 2, height), rot: Math.PI };
  if (face === 'E') return { pos: W(wall + depth / 2, c, height), rot: Math.PI / 2 };
  return { pos: W(wall - depth / 2, c, height), rot: -Math.PI / 2 };
}

function piece(b, room, face, wall, spec, frontMat, depth, sideMat) {
  const { pos, rot } = wallPose(face, wall, spec.c, spec.b + spec.h / 2, depth);
  const geo = new THREE.BoxGeometry(spec.w, spec.h, depth);
  const mesh = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]);
  mesh.position.copy(pos);
  mesh.rotation.y = rot;
  mesh.castShadow = true; mesh.receiveShadow = true;
  b.group.add(mesh);
  const e = new LineSegments2(new LineSegmentsGeometry().setPositions(new THREE.EdgesGeometry(geo).attributes.position.array), b.lineMat(room));
  e.position.copy(pos); e.rotation.y = rot;
  b.group.add(e);
  return mesh;
}

// the front face: the image, optionally on a white mat inside a thin black frame
function frontTexture(img, w, h, mat, frame) {
  const k = 520; // px per metre
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d');
  g.fillStyle = '#141414'; g.fillRect(0, 0, c.width, c.height);
  const f = frame * k, m = mat * k;
  g.fillStyle = '#f4f2ec'; g.fillRect(f, f, c.width - 2 * f, c.height - 2 * f);
  const iw = c.width - 2 * (f + m), ih = c.height - 2 * (f + m);
  const s = Math.min(iw / img.width, ih / img.height);
  const dw = img.width * s, dh = img.height * s;
  g.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function labelTexture(lines, note) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, c.width, c.height);
  // each line shrinks until it fits the plaque
  const fit = (text, style, px, family, y, color) => {
    let size = px;
    g.font = `${style} ${size}px ${family}`;
    while (g.measureText(text).width > c.width - 72 && size > 12) { size -= 1; g.font = `${style} ${size}px ${family}`; }
    g.fillStyle = color;
    g.fillText(text, 36, y);
  };
  const sans = 'Inter, Helvetica, sans-serif';
  fit(lines[0], '600', 52, sans, 80, '#0e0d0c');
  fit(lines[1], 'italic 500', 44, sans, 140, '#0e0d0c');
  fit(lines[2], '500', 32, sans, 214, '#0e0d0c');
  fit(lines[3], '500', 32, sans, 258, '#0e0d0c');
  if (note) fit(note, '500', 28, '"IBM Plex Mono", monospace', 320, '#4a463f');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function hangArchive(b, lang) {
  const room = b.rooms.get('hall');
  const loader = new THREE.ImageLoader();
  const frameMat = b.materialFor('hall', 'steel');
  const edgeMat = b.materialFor('hall', 'canvasEdge');
  const labels = [];
  for (const sh of SHOWS) {
    for (const [spec, kind] of [[sh.work, sh.work?.kind], [sh.poster, 'poster']]) {
      if (!spec) continue;
      const front = revealMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: kind === 'canvas' ? 0.85 : 0.35 }), room);
      front.polygonOffset = true; front.polygonOffsetFactor = 1; front.polygonOffsetUnits = 1;
      const depth = kind === 'canvas' ? 0.045 : 0.03;
      piece(b, 'hall', sh.face, sh.wall, spec, front, depth, kind === 'canvas' ? edgeMat : frameMat);
      loader.load(`assets/archive/${spec.file}`, (img) => {
        front.map = kind === 'canvas' ? frontTexture(img, spec.w, spec.h, 0, 0) : frontTexture(img, spec.w, spec.h, spec.mat || 0, 0.02);
        front.needsUpdate = true;
        b.onArchiveImage?.();
      });
    }
    // the wall label
    const lm = revealMaterial(new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.9 }), room);
    const spec = { c: sh.label.c, b: sh.label.y - 0.1, w: 0.36, h: 0.2 };
    piece(b, 'hall', sh.face, sh.wall, spec, lm, 0.008, b.materialFor('hall', 'plinth'));
    labels.push({ key: sh.key, mat: lm, hasPoster: !!sh.poster && !sh.work });
  }
  const relabel = (lg) => {
    const L = STR[lg];
    for (const l of labels) {
      const [title, date] = L.shows[l.key];
      l.mat.map?.dispose();
      l.mat.map = labelTexture(L.showLines(title, date), l.hasPoster ? L.posterNote : '');
      l.mat.needsUpdate = true;
    }
  };
  relabel(lang);
  return { relabel, spots: [[17.5, 8.45, 18.82, 1.5, 8.45]] };
}
