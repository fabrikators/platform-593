// Platform 593: the 2026 photographs on the plan. Each camera on the sheet opens a viewer that
// lays the photograph over the model seen from the same spot, with a wipe between the two.
// ?place adds keys to adjust each pose and a button that copies data/photos.json.
import * as THREE from 'three';
import { PLAN } from './plan-data.js';
import { LINES_BACK } from './reveal.js';
import { createStage, ALL_ROOMS } from './stage.js';
import { Rig } from './camera.js';
import { STR, initialLang, rememberLang } from './i18n.js';

const params = new URLSearchParams(location.search);
const PLACE = params.has('place');
const SMALL = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
const D2R = Math.PI / 180;
const $ = (s, el = document) => el.querySelector(s);
let lang = initialLang();

// ---------------- page text, in English or French
function applyText() {
  const L = STR[lang], P = L.photos;
  document.documentElement.lang = lang;
  document.title = P.title;
  $('meta[name="description"]').content = P.description;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = L[el.dataset.i18n];
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', L[el.dataset.i18nAria]);
  for (const el of document.querySelectorAll('[data-p]')) el.textContent = P[el.dataset.p];
  for (const el of document.querySelectorAll('[data-p-aria]')) el.setAttribute('aria-label', P[el.dataset.pAria]);
  for (const b of document.querySelectorAll('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  $('.toplink').href = `index.html?lang=${lang}`;
}
applyText();

if (!document.createElement('canvas').getContext('webgl2')) {
  document.querySelector('.fallback').hidden = false;
  document.querySelector('.loader').classList.add('is-done');
  document.documentElement.classList.add('no-webgl');
  throw new Error('WebGL 2 is not available');
}

// ---------------- the photographs and the stage (the bare building: no staging, no door leaves)
const DATA = await fetch('data/photos.json').then((r) => r.json());
const PH = DATA.photos;
let dirty = true;
const canvas = document.getElementById('scene');
const st = await createStage({ canvas, small: SMALL, lang, bare: true, onDirty: () => { dirty = true; } });
const { renderer, camera, rooms, building, sheet, sky } = st;

const viewer = $('.viewer'), box = $('.viewer__box'), slot = $('.viewer__model'), bar = $('.viewer__bar');
const img = $('.viewer__photo'), splitEl = $('.viewer__split'), range = $('.viewer__range');
const markersEl = $('.markers');
let cur = -1;           // the photograph in the viewer, -1 on the plan
let ink = false;        // compare with the drawing rather than the model
const roomName = (p) => STR[lang].photos.rooms[p.room] || '';
const label = (i) => `${roomName(PH[i])} · ${STR[lang].photos.n(i + 1, PH.length)}`;

// ---------------- the plan: the opening sheet of the walk, cut at 1.20 m
const rig = new Rig();
const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 1, dist: 1 };
function planView() {
  if (!(innerWidth > 0 && innerHeight > 0)) return; // a background tab: wait for the resize
  const aspect = innerWidth / innerHeight;
  rig.pose(0, aspect, pose);
  if (aspect < 0.8) {
    // phones: the building fills the screen rather than the whole sheet (the plan's x runs up the screen)
    const xs = PLAN.slab.map((q) => q[0]), ys = PLAN.slab.map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs) + 1.6, (Math.max(...ys) - Math.min(...ys) + 1.2) / aspect);
    const dir = pose.pos.clone().sub(pose.target).normalize();
    pose.target.set(cx, 0, -cy);
    pose.dist = span / (2 * Math.tan((pose.fov * D2R) / 2));
    pose.pos.copy(pose.target).addScaledVector(dir, pose.dist);
  }
  camera.position.copy(pose.pos);
  camera.up.copy(pose.up);
  camera.lookAt(pose.target);
  camera.fov = pose.fov;
  camera.aspect = aspect;
  camera.near = Math.max(0.03, pose.dist - 45);
  camera.far = pose.dist + 260;
  camera.updateProjectionMatrix();
  for (const r of ALL_ROOMS) rooms.set(r, 14.6, -5.9, 0, 1);
  building.setCut(1.2, false);
  for (const r of building.shadowOnly) r.visible = false;
  building.doors.front.setAngle(0);
  building.setSlide(0);
  building.setCapTone(0);
  sky.update(camera, 0);
  sheet.setFade(1);
  sheet.paperMesh.material.opacity = 1;
  sheet.paperMesh.visible = true;
  st.setSun(0, 0);
  LINES_BACK.value = 0;
  st.aoK = 0;
  st.render();
}

// ---------------- one marker per photograph: where it was taken, and what the lens saw
const v3 = new THREE.Vector3();
function toScreen(x, y, h = 1.2) {
  v3.set(x, h, -y).project(camera);
  return [((v3.x + 1) / 2) * innerWidth, ((1 - v3.y) / 2) * innerHeight];
}
const tip = document.createElement('div');
tip.className = 'pm-tip';
tip.hidden = true;
tip.innerHTML = '<img alt="" width="180" height="101"><span></span>';
document.body.append(tip);
const markers = PH.map((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `pm${p.approx ? ' pm--approx' : ''}`;
  b.innerHTML = `<svg viewBox="-70 -70 140 140" aria-hidden="true"><path class="pm__cone"/><path class="pm__lead"/><circle class="pm__at" r="0"/><circle class="pm__dot" r="9"/><text class="pm__n">${i + 1}</text></svg>`;
  b.addEventListener('click', () => openViewer(i));
  b.addEventListener('pointerenter', () => showTip(i));
  b.addEventListener('focus', () => showTip(i));
  b.addEventListener('pointerleave', hideTip);
  b.addEventListener('blur', hideTip);
  markersEl.append(b);
  return b;
});
function layoutMarkers() {
  const a = toScreen(14, 6), c = toScreen(15, 6);
  const pxm = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const R = Math.min(64, Math.max(26, 1.5 * pxm)), dot = Math.min(10, Math.max(8, 0.24 * pxm));
  // cameras a few centimetres apart: the dots step aside, a leader keeps the true point
  const at = PH.map((p) => toScreen(p.x, p.y));
  const d = at.map(([x, y]) => [x, y]);
  const minD = 2 * dot + 4;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) {
      let dx = d[j][0] - d[i][0], dy = d[j][1] - d[i][1];
      const L = Math.hypot(dx, dy);
      if (L >= minD) continue;
      if (L < 1e-3) { dx = 1; dy = 0; } else { dx /= L; dy /= L; }
      const k = (minD - L) / 2 + 0.1;
      d[i][0] -= dx * k; d[i][1] -= dy * k; d[j][0] += dx * k; d[j][1] += dy * k;
      moved = true;
    }
    if (!moved) break;
  }
  PH.forEach((p, i) => {
    const [sx, sy] = at[i];
    const [dx, dy] = toScreen(p.x + Math.cos(p.yaw * D2R), p.y + Math.sin(p.yaw * D2R));
    const th = Math.atan2(dy - sy, dx - sx);
    const hf = Math.atan(Math.tan((p.fov * D2R) / 2) * (p.iw / p.ih));
    const ox = sx - d[i][0], oy = sy - d[i][1];
    const pt = (t) => `${(ox + R * Math.cos(t)).toFixed(1)} ${(oy + R * Math.sin(t)).toFixed(1)}`;
    const b = markers[i];
    b.style.left = `${d[i][0].toFixed(1)}px`;
    b.style.top = `${d[i][1].toFixed(1)}px`;
    b.querySelector('.pm__cone').setAttribute('d', `M${ox.toFixed(1)} ${oy.toFixed(1)}L${pt(th - hf)}A${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${pt(th + hf)}Z`);
    const lead = b.querySelector('.pm__lead'), off = Math.hypot(ox, oy) > 2;
    lead.setAttribute('d', off ? `M0 0L${ox.toFixed(1)} ${oy.toFixed(1)}` : '');
    b.querySelector('.pm__at').setAttribute('r', off ? '2' : '0');
    b.querySelector('.pm__at').setAttribute('cx', ox.toFixed(1));
    b.querySelector('.pm__at').setAttribute('cy', oy.toFixed(1));
    b.querySelector('.pm__dot').setAttribute('r', dot.toFixed(1));
    b.style.setProperty('--hit', `${(2 * dot + 4).toFixed(0)}px`);
    b.setAttribute('aria-label', label(i));
  });
}
function showTip(i) {
  const p = PH[i], b = markers[i].getBoundingClientRect();
  const t = tip.querySelector('img');
  t.src = `assets/photos/thumbs/${p.id}.jpg`;
  t.height = Math.round((180 * p.ih) / p.iw);
  tip.querySelector('span').textContent = label(i);
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const x = Math.min(innerWidth - w - 8, Math.max(8, b.left + b.width / 2 - w / 2));
  const y = b.top - h - 10 > 8 ? b.top - h - 10 : b.bottom + 10;
  tip.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
}
function hideTip() { tip.hidden = true; }

// ---------------- the viewer: the canvas moves into the photograph's frame
function fitBox() {
  const p = PH[cur], vs = getComputedStyle(viewer);
  const availW = viewer.clientWidth - parseFloat(vs.paddingLeft) - parseFloat(vs.paddingRight);
  const availH = viewer.clientHeight - parseFloat(vs.paddingTop) - bar.offsetHeight - 6;
  const a = p.iw / p.ih, GAP = 6;
  // a tall screen with room for both: the photograph above the model, whole, instead of the wipe
  const stack = availW / availH < 0.9 && 2 * (availW / a) + GAP <= availH;
  const rows = stack ? 2 : 1;
  let w = availW, h = w / a;
  if (rows * h + (rows - 1) * GAP > availH) { h = (availH - (rows - 1) * GAP) / rows; w = h * a; }
  w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
  box.classList.toggle('is-stacked', stack);
  box.style.setProperty('--h', `${h}px`);
  box.style.width = `${w}px`;
  box.style.height = `${rows * h + (rows - 1) * GAP}px`;
  st.resize(w, h);
}
function viewRender() {
  const p = PH[cur];
  st.view({ x: p.x, y: p.y, h: p.h, yaw: p.yaw, pitch: p.pitch, roll: p.roll || 0, shift: p.shift || 0, fov: p.fov, aspect: p.iw / p.ih, ink });
}
function setSplit(v) {
  range.value = v;
  img.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
  splitEl.style.left = `${v}%`;
}
function writeViewer() {
  const P = STR[lang].photos, p = PH[cur];
  $('.viewer__name').textContent = roomName(p);
  $('.viewer__n').textContent = P.n(cur + 1, PH.length);
  img.alt = `${roomName(p)} — ${P.photo}`;
  $('.viewer__tag--model').textContent = ink ? P.drawing : P.model;
  $('[data-act="model"]').setAttribute('aria-pressed', String(!ink));
  $('[data-act="ink"]').setAttribute('aria-pressed', String(ink));
  const note = p.approx ? P.approx : p.room === 'hall' ? P.replanned : '';
  $('.viewer__approx').textContent = note;
  $('.viewer__approx').hidden = !note;
  if (PLACE) showPose();
}
function openViewer(i) {
  const was = cur;
  cur = (i + PH.length) % PH.length;
  hideTip();
  if (was < 0) {
    slot.append(canvas);
    viewer.hidden = false;
    document.body.classList.add('is-viewing');
    viewer.focus({ preventScroll: true });
  }
  img.src = `assets/photos/${PH[cur].id}.jpg`;
  for (const k of [cur - 1, cur + 1]) new Image().src = `assets/photos/${PH[(k + PH.length) % PH.length].id}.jpg`;
  writeViewer();
  fitBox();
  history.replaceState(null, '', `${location.pathname}${location.search}#${PH[cur].id}`);
  dirty = true;
}
function closeViewer() {
  if (cur < 0) return;
  const was = cur;
  cur = -1;
  viewer.hidden = true;
  document.body.classList.remove('is-viewing');
  document.body.prepend(canvas);
  st.resize(innerWidth, innerHeight);
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  dirty = true;
  draw();
  markers[was].focus({ preventScroll: true });
}
viewer.tabIndex = -1;
range.addEventListener('input', () => setSplit(+range.value));
setSplit(50);
viewer.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'prev') openViewer(cur - 1);
  else if (act === 'next') openViewer(cur + 1);
  else if (act === 'close') closeViewer();
  else if (act === 'model' || act === 'ink') { ink = act === 'ink'; writeViewer(); dirty = true; }
  else if (act === 'copy') copyPositions();
});
addEventListener('keydown', (e) => {
  if (cur < 0) return;
  if (e.key === 'Escape') { closeViewer(); return; }
  if (PLACE && placeKey(e)) { e.preventDefault(); return; }
  if (document.activeElement === range) return;
  if (e.key === 'ArrowLeft') openViewer(cur - 1);
  else if (e.key === 'ArrowRight') openViewer(cur + 1);
});

// ---------------- ?place: nudge the pose from the keyboard, then copy the whole file
function placeKey(e) {
  const p = PH[cur], k = e.shiftKey ? 5 : 1, m = 0.05 * k;
  const f = [Math.cos(p.yaw * D2R), Math.sin(p.yaw * D2R)], r = [f[1], -f[0]];
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const move = (d, s) => { p.x += d[0] * m * s; p.y += d[1] * m * s; };
  if (key === 'ArrowUp') move(f, 1);
  else if (key === 'ArrowDown') move(f, -1);
  else if (key === 'ArrowRight') move(r, 1);
  else if (key === 'ArrowLeft') move(r, -1);
  else if (key === 'q') p.yaw = (p.yaw + k + 360) % 360;
  else if (key === 'e') p.yaw = (p.yaw - k + 360) % 360;
  else if (key === 'r') p.pitch += 0.5 * k;
  else if (key === 'f') p.pitch -= 0.5 * k;
  else if (key === 'z') p.fov = Math.max(20, p.fov - k);
  else if (key === 'x') p.fov = Math.min(100, p.fov + k);
  else if (key === 'PageUp') p.h += 0.02 * k;
  else if (key === 'PageDown') p.h -= 0.02 * k;
  else if (key === 't') p.shift = (p.shift || 0) + 0.005 * k;
  else if (key === 'g') p.shift = (p.shift || 0) - 0.005 * k;
  else if (key === '[') p.roll = (p.roll || 0) - 0.2 * k;
  else if (key === ']') p.roll = (p.roll || 0) + 0.2 * k;
  else return false;
  const r2 = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  Object.assign(p, { x: r2(p.x, 2), y: r2(p.y, 2), h: r2(p.h, 2), yaw: r2(p.yaw, 1), pitch: r2(p.pitch, 1), roll: r2(p.roll || 0, 1), shift: r2(p.shift || 0, 3) });
  showPose();
  dirty = true;
  return true;
}
function showPose() {
  const { id, x, y, h, yaw, pitch, roll = 0, shift = 0, fov } = PH[cur];
  $('.viewer__pose').textContent = JSON.stringify({ id, x, y, h, yaw, pitch, roll, shift, fov });
}
function fileText() {
  const row = (p) => `  ${JSON.stringify(p).replace(/,"/g, ', "').replace(/":/g, '": ')}`;
  return `{\n "note": ${JSON.stringify(DATA.note)},\n "photos": [\n${PH.map(row).join(',\n')}\n ]\n}\n`;
}
function copyPositions() {
  const btn = $('[data-act="copy"]');
  const text = fileText();
  console.log(text);
  navigator.clipboard?.writeText(text).then(() => {
    btn.textContent = STR[lang].photos.copied;
    setTimeout(() => { btn.textContent = STR[lang].photos.copy; }, 1600);
  }).catch(() => {});
}
if (PLACE) $('.viewer__place').hidden = false;

// ---------------- language, size, drawing
for (const b of document.querySelectorAll('.lang button')) {
  b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    rememberLang(lang);
    applyText();
    sheet.relabel(lang);
    const size = renderer.getSize(new THREE.Vector2());
    for (const m of sheet.lineMats) m.resolution.copy(size);
    layoutMarkers();
    if (cur >= 0) writeViewer();
    dirty = true;
  });
}
function draw() {
  if (cur < 0) { planView(); layoutMarkers(); } else viewRender();
}
addEventListener('resize', () => {
  if (cur < 0) st.resize(innerWidth, innerHeight);
  else fitBox();
  dirty = true;
});
st.resize(innerWidth, innerHeight);
try { draw(); } catch (e) { console.error('first render', e); }
dirty = false;
document.querySelector('.loader').classList.add('is-done');
(function frame() {
  requestAnimationFrame(frame);
  if (dirty) { dirty = false; draw(); }
})();

// a link to one photograph: photos.html#05
const fromHash = PH.findIndex((p) => `#${p.id}` === location.hash);
if (fromHash >= 0) openViewer(fromHash);

// for headless checks
window.__p593photos = { open: openViewer, close: closeViewer, ready: st.loading, count: PH.length };
