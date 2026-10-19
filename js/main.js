import * as THREE from 'three';
import { PLAN } from './plan-data.js';
import { LINES_BACK } from './reveal.js';
import { H } from './arch.js';
import { createStage } from './stage.js';
import { Rig, T, ramp, ease, easeIO, sweepRadius, ACT2, ACT2A, ACT3, ACT3_T } from './camera.js';
import { STR, initialLang, rememberLang } from './i18n.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
if (CAPTURE) document.documentElement.classList.add('is-capture');
if (CAPTURE && params.get('hud') === '0') document.documentElement.classList.add('no-hud');
let lang = initialLang();
// phones and small tablets: fewer pixels, smaller shadow map, no ambient-occlusion pass
const SMALL = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// phones and tablets: the guide says swipe, not scroll
if (matchMedia('(pointer: coarse)').matches) {
  document.documentElement.classList.add('is-touch');
  document.querySelector('.hint__t').dataset.i18n = 'hintTouch';
  document.querySelector('.hint__s').dataset.i18n = 'hintTouchHow';
}

// ---------------- page text, in English or French
function applyText() {
  const L = STR[lang];
  document.documentElement.lang = lang;
  document.title = L.title;
  document.querySelector('meta[name="description"]').content = L.description;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = L[el.dataset.i18n];
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', L[el.dataset.i18nAria]);
  for (const b of document.querySelectorAll('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  document.querySelector('[data-link="photos"]').href = `photos.html?lang=${lang}`;
  document.querySelector('[data-link="walk2"]').href = `walk2.html?lang=${lang}`;
}
applyText();

// ---------------- no WebGL 2: show the plan as a picture instead
if (!document.createElement('canvas').getContext('webgl2')) {
  document.querySelector('.fallback').hidden = false;
  document.querySelector('.loader').classList.add('is-done');
  document.documentElement.classList.add('no-webgl');
  throw new Error('WebGL 2 is not available');
}

const state = { p: 0, dirty: true, lastDoor: -1, lastSlide: -1 };

// ---------------- the stage: renderer, scene, building, sheet, light, sky (js/stage.js)
// Hussein Madi at Platform, 1988-89: only with ?archive, and only where the images are deployed
const ARCHIVE = params.has('archive') && await fetch('assets/archive/manifest.json', { cache: 'no-store' }).then((r) => r.ok).catch(() => false);
// ?photo: the bare building for matching the photographs (no staging, no loose furniture)
const PHOTO = params.has('photo') ? (params.get('photo') === 'shell' ? 'shell' : true) : false;
const canvas = document.getElementById('scene');
const st = await createStage({ canvas, capture: CAPTURE, small: SMALL, lang, archive: ARCHIVE, bare: PHOTO, onDirty: () => { state.dirty = true; } });
const { renderer, camera, rooms, building, sheet, shows, sky, setSun } = st;

// ---------------- camera rig and the scroll timeline
const rig = new Rig();
// with the archive, act 2 is the same ride with a pause at each of Madi's four shows
const R2 = ARCHIVE ? ACT2A : ACT2;
rig.act2 = R2;
const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 1, dist: 1 };
// act 2 captions are timed from where the ride reaches each place
const A2 = R2.times();
const A3 = ACT3.times();
const act2Range = { line: [1.012, A2.ne - 0.01], lobe: [A2.ne - 0.01, A2.leave + 0.004], covered: [A2.door - 0.004, A3.gap - 0.01],
  terrace: [A3.gap - 0.01, ACT3_T.rise0 + 0.03], plan: [2.86, 3.01] };
for (const el of document.querySelectorAll('.cap[data-act2]')) [el.dataset.from, el.dataset.to] = act2Range[el.dataset.act2];
// the four shows: their captions and the timeline strip follow the look stops
const SHOW_KEYS = ['sculptures', 'pastels', 'dessins', 'peintures'];
const showRange = {};
if (ARCHIVE) {
  for (const l of R2.looks) showRange[l.key] = [Math.max(1.012, R2.tAtS(l.s - l.span[0] * 0.7)), R2.tAtS(l.s + l.span[1] * 0.7)];
  for (const el of document.querySelectorAll('.cap[data-show]')) {
    el.hidden = false;
    [el.dataset.from, el.dataset.to] = showRange[el.dataset.show];
  }
  document.querySelector('.timeline').hidden = false;
}
const timelineEl = document.querySelector('.timeline');
const timelineItems = [...timelineEl.querySelectorAll('li')];
const timelineSpan = ARCHIVE ? [1.005, R2.tAtS(R2.marks.peintures + 2.6)] : [9, 9];
const caps = [...document.querySelectorAll('.cap')].filter((el) => !el.hidden).map((el) => ({ el, a: +el.dataset.from, b: +el.dataset.to }));
const topRun = Math.hypot(PLAN.inlay[36][0] - PLAN.inlay[2][0], PLAN.inlay[36][1] - PLAN.inlay[2][1]);
// scroll split by screens: act 1 = 9, act 2 = 11, act 3 = 7 (27 in all)
const B1 = 9 / 27, B2 = 20 / 27;
const tOfScroll = (q) => (q <= B1 ? q / B1 : q <= B2 ? 1 + (q - B1) / (B2 - B1) : 2 + (q - B2) / (1 - B2));
const scrollOfT = (t) => (t <= 1 ? t * B1 : t <= 2 ? B1 + (t - 1) * (B2 - B1) : B2 + (t - 2) * (1 - B2));
const rail = document.querySelector('.rail__fill');
const hint = document.querySelector('.hint');
const mark = document.querySelector('.mark');
const inlayLength = PLAN.inlay.reduce((s, p, i, a) => s + Math.hypot(a[(i + 1) % a.length][0] - p[0], a[(i + 1) % a.length][1] - p[1]), 0);
// captions: the numbers come from the model
const FIG = { hall: PLAN.rooms.hall.area, line: inlayLength, run: topRun, covered: PLAN.rooms.covered.area, terrace: PLAN.rooms.terrace.area };
function writeTimeline() {
  const L = STR[lang].timeline;
  timelineEl.querySelector('.timeline__t').textContent = L.title;
  timelineEl.setAttribute('aria-label', L.title);
  for (const li of timelineItems) {
    li.querySelector('.timeline__d').textContent = L.dates[li.dataset.show];
    li.querySelector('.timeline__n').textContent = STR[lang].shows[li.dataset.show][0];
  }
  for (const el of document.querySelectorAll('.cap[data-show]')) {
    const [head, body] = L.caps[el.dataset.show];
    el.querySelector('.cap__n').textContent = head;
    el.querySelector('.cap__t').textContent = body;
  }
}
function writeCaptions() {
  writeTimeline();
  for (const el of document.querySelectorAll('.cap[data-cap]')) {
    const i = +el.dataset.cap;
    const [head, body] = (ARCHIVE && STR[lang].capsArchive[i]) || STR[lang].caps[i];
    el.querySelector('.cap__n').textContent = head;
    el.querySelector('.cap__t').textContent = typeof body === 'function' ? body(FIG) : body;
  }
}
writeCaptions();
// the EN / FR switch relabels the page and the sheet in place
for (const b of document.querySelectorAll('.lang button')) {
  b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    rememberLang(lang);
    applyText();
    writeCaptions();
    sheet.relabel(lang);
    shows?.relabel(lang);
    for (const m of sheet.lineMats) m.resolution.set(innerWidth, innerHeight);
    state.dirty = true;
  });
}

function apply(p) {
  if (!(innerWidth > 0 && innerHeight > 0)) return; // a background tab: wait for the resize
  const aspect = innerWidth / innerHeight;
  rig.pose(p, aspect, pose);
  camera.position.copy(pose.pos);
  camera.up.copy(pose.up);
  camera.lookAt(pose.target);
  // on a portrait phone the room views open up vertically so they keep some width
  camera.fov = aspect < 1 && pose.fov > 40
    ? THREE.MathUtils.lerp(pose.fov, Math.min(92, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(pose.fov / 2)) * Math.pow(1 / aspect, 0.62)))), ramp(pose.fov, 40, 54))
    : pose.fov;
  camera.aspect = aspect;
  camera.near = Math.max(0.03, Math.min(camera.position.y - 3.5, pose.dist - 45));
  camera.far = pose.dist + 260;
  camera.updateProjectionMatrix();

  // the cut climbs in act 1 and sinks back to 1.20 m during the closing rise
  const cut = p <= 2 ? THREE.MathUtils.lerp(1.2, H + 0.06, easeIO(ramp(p, T.cutStart, T.cutEnd)))
    : THREE.MathUtils.lerp(H + 0.06, 1.2, easeIO(ramp(p, 2.66, 2.86)));
  building.setCut(cut, p > T.cutEnd);
  for (const r of building.shadowOnly) r.visible = cut > H - 0.02;
  sheet.setFade(p <= 2 ? 1 - ease(ramp(p, T.sheetFadeA, T.sheetFadeB)) : ease(ramp(p, 2.86, 2.95)));
  LINES_BACK.value = ease(ramp(p, 2.84, 2.94));
  const door = easeIO(ramp(p, T.doorA, T.doorB));
  building.doors.front.setAngle(door);
  if (door !== state.lastDoor) { renderer.shadowMap.needsUpdate = true; state.lastDoor = door; }
  rooms.set('hall', 11.12, -5.79, sweepRadius(p), 1.6);
  // act 2: the sliding panel opens as the ride reaches it; the covered terrace sweeps from the threshold
  const sRide = p > 1 ? R2.sAtT(p) : 0;
  const slide = easeIO(ramp(sRide, R2.marks.door - 3.2, R2.marks.door - 1.3));
  building.setSlide(slide);
  if (slide !== state.lastSlide) { renderer.shadowMap.needsUpdate = true; state.lastSlide = slide; }
  const rCov = p > 1 ? Math.max(0, sRide - (R2.marks.door - 0.4)) * 2.0 + 150 * Math.max(0, p - A2.door) : 0;
  rooms.set('covered', 21.6, -9.7, rCov, 1.5);
  // act 3: the open terrace sweeps from the planter gap, the sky follows; the sun goes down
  const s3 = p > 2 ? ACT3.sAtT(p) : 0;
  const gapS = ACT3.marks.gap;
  const rTer = p > 2 ? Math.max(0, s3 - gapS + 0.3) * 2.5 + 160 * Math.max(0, p - A3.gap) : 0;
  rooms.set('terrace', 22.8, -11.4, rTer, 1.8);
  const skyK = ease(ramp(s3, gapS + 0.2, gapS + 4.0)) * (1 - ease(ramp(p, 2.62, 2.8)));
  sky.update(camera, skyK);
  sheet.paperMesh.material.opacity = 1 - skyK;
  sheet.paperMesh.visible = skyK < 0.999;
  setSun(ease(ramp(p, 2.06, 2.48)), ease(ramp(p, 2.6, 2.86)));
  // rising, the rest of the flat floods with material from the terrace
  const rAll = 48 * ease(ramp(p, 2.6, 2.86));
  for (const k of ['big', 'dressing', 'bath', 'closet', 'core', 'storeN', 'wc', 'storeS', 'kitchen', 'none', 'top']) rooms.set(k, 25.4, -12.6, rAll, 2.2);
  if (p > 2.04) renderer.shadowMap.needsUpdate = true;
  building.setCapTone(ease(ramp(camera.position.y, 14, 5)));
  st.aoK = SMALL ? 0 : 0.95 * ease(ramp(p, 0.6, 0.7)) * (1 - ease(ramp(p, 2.7, 2.85)));

  // one caption at a time: a show's caption wins over the chapter's
  let active = null;
  for (const c of caps) if (p >= c.a && p < c.b) active = c;
  for (const c of caps) c.el.classList.toggle('is-on', c === active);
  if (ARCHIVE) {
    timelineEl.classList.toggle('is-on', p >= timelineSpan[0] && p < timelineSpan[1]);
    let now = -1;
    SHOW_KEYS.forEach((k, i) => { if (p >= showRange[k][0] - 0.004) now = i; });
    timelineItems.forEach((li, i) => { li.classList.toggle('is-now', i === now); li.classList.toggle('is-past', i < now); });
  }
  rail.style.height = `${(scrollOfT(p) * 100).toFixed(2)}%`;
  hint.style.opacity = p > 0.02 ? 0 : 1;
  mark.style.opacity = (ease(ramp(p, 0.16, 0.24)) * (1 - ease(ramp(p, 2.85, 2.93)))).toFixed(3);
}

function resize() {
  st.resize();
  state.dirty = true;
}
addEventListener('resize', resize);
resize();
const render = () => st.render();
const loading = st.loading;

apply(0);
try { render(); } catch (e) { console.error('first render', e); }
document.querySelector('.loader').classList.add('is-done');

// ---------------- scroll: Lenis smooths the wheel, ScrollTrigger maps the track to p
if (!CAPTURE) {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: REDUCED ? 1 : 0.075, smoothWheel: !REDUCED, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.create({
    trigger: '#track',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => { state.p = tOfScroll(self.progress); state.dirty = true; },
  });
  gsap.ticker.add(() => {
    if (!state.dirty) return;
    state.dirty = false;
    apply(state.p);
    render();
  });
}

// ---------------- capture hook (used to record the walk frame by frame, and to match the photographs)
if (CAPTURE) window.__p593 = {
  view(v) { st.view(v); return true; },
  marks: () => ({ ...A2, len: R2.len }),
  ready: loading.then(() => new Promise((r) => requestAnimationFrame(() => r(true)))),
  set(p) { state.p = p; apply(p); renderer.shadowMap.needsUpdate = true; render(); return true; },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
