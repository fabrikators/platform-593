// walk2.html: the second walk. The same model as the first; the route is in js/walk2-route.js.
import * as THREE from 'three';
import { PLAN } from './plan-data.js';
import { LINES_BACK } from './reveal.js';
import { H } from './arch.js';
import { createStage } from './stage.js';
import { STR, initialLang, rememberLang } from './i18n.js';
import { RIDE2, T2, pose2, ramp, ease, easeIO } from './walk2-route.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
if (CAPTURE) document.documentElement.classList.add('is-capture');
if (CAPTURE && params.get('hud') === '0') document.documentElement.classList.add('no-hud');
let lang = initialLang();
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
  const L = STR[lang], W2 = L.walk2;
  document.documentElement.lang = lang;
  document.title = W2.title;
  document.querySelector('meta[name="description"]').content = W2.description;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = L[el.dataset.i18n];
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', L[el.dataset.i18nAria]);
  for (const el of document.querySelectorAll('[data-w2]')) el.textContent = W2[el.dataset.w2];
  for (const el of document.querySelectorAll('[data-w2-aria]')) el.setAttribute('aria-label', W2[el.dataset.w2Aria]);
  for (const b of document.querySelectorAll('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  document.querySelector('[data-link="walk1"]').href = `index.html?lang=${lang}`;
}
applyText();

if (!document.createElement('canvas').getContext('webgl2')) {
  document.querySelector('.fallback').hidden = false;
  document.querySelector('.loader').classList.add('is-done');
  document.documentElement.classList.add('no-webgl');
  throw new Error('WebGL 2 is not available');
}

const state = { p: 0, dirty: true, lastDoor: -1 };
const canvas = document.getElementById('scene');
const st = await createStage({ canvas, capture: CAPTURE, small: SMALL, lang, onDirty: () => { state.dirty = true; } });
const { renderer, camera, rooms, building, sheet, sky, setSun } = st;
// this walk comes into the hall from the west: no gate round the long wall
rooms.gate('hall', 0, 0, -1e9, -1e9, 1);
const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 1, dist: 1 };

// ---------------- captions: timed from where the walk reaches each place; numbers from the model
const M = RIDE2.times();
const RANGES = [
  [0, T2.fall0 + 0.035], [T2.fall1 - 0.012, M.bigDoor], [M.bigDoor + 0.004, M.strip], [M.kdoor - 0.012, M.kout + 0.008],
  [M.kout + 0.01, M.tdoor - 0.012], [M.tdoor - 0.008, T2.rise0 + 0.025], [T2.rise1 - 0.05, 1.01],
];
const kitchenWindow = PLAN.walls.flatMap((w) => w.open).find((o) => o.panels === 2);
const FIG = {
  big: PLAN.rooms.big.area, kitchen: PLAN.rooms.kitchen.area, covered: PLAN.rooms.covered.area,
  win: kitchenWindow ? kitchenWindow.s1 - kitchenWindow.s0 : 3.3,
  corridor: 21.47 - 12.94,
};
const caps = [...document.querySelectorAll('.cap')].map((el) => ({ el, a: RANGES[+el.dataset.cap][0], b: RANGES[+el.dataset.cap][1] }));
function writeCaptions() {
  for (const c of caps) {
    const [head, body] = STR[lang].walk2.caps[+c.el.dataset.cap];
    c.el.querySelector('.cap__n').textContent = head;
    c.el.querySelector('.cap__t').textContent = typeof body === 'function' ? body(FIG) : body;
  }
}
writeCaptions();
for (const b of document.querySelectorAll('.lang button')) {
  b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    rememberLang(lang);
    applyText();
    writeCaptions();
    sheet.relabel(lang);
    for (const m of sheet.lineMats) m.resolution.set(innerWidth, innerHeight);
    state.dirty = true;
  });
}
const rail = document.querySelector('.rail__fill');
const hint = document.querySelector('.hint');
const mark = document.querySelector('.mark');

// ---------------- one frame of the walk at p
const S = RIDE2.marks;
const DOOR_BIG = [5.74, 7.23], DOOR_K = [12.94, 1.13], DOOR_T = [21.52, 0.9], START = [3.45, 7.75];
const HALLISH = ['hall', 'core', 'storeN', 'storeS', 'wc'];
const BIGISH = ['big', 'dressing', 'bath', 'closet'];
function apply(p) {
  if (!(innerWidth > 0 && innerHeight > 0)) return;
  const aspect = innerWidth / innerHeight;
  pose2(p, aspect, pose);
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

  // the cut climbs during the fall and sinks back to 1.20 m during the rise; the sheet fades out and back
  const early = p < 0.5;
  const cut = early ? THREE.MathUtils.lerp(1.2, H + 0.06, easeIO(ramp(p, 0.086, 0.112))) : THREE.MathUtils.lerp(H + 0.06, 1.2, easeIO(ramp(p, 0.944, 0.977)));
  building.setCut(cut, cut > H);
  for (const r of building.shadowOnly) r.visible = cut > H - 0.02;
  sheet.setFade(early ? 1 - ease(ramp(p, 0.066, 0.088)) : ease(ramp(p, 0.977, 0.991)));
  LINES_BACK.value = ease(ramp(p, 0.973, 0.99));

  // doors: the front door stays shut; the glazed door at the end of the corridor opens as we reach it
  const s = p > T2.t0 ? RIDE2.sAtT(Math.min(p, T2.t1)) : 0;
  building.doors.front.setAngle(0);
  building.setSlide(0);
  const door = easeIO(ramp(s, S.tdoor - 2.4, S.tdoor - 0.8));
  building.doors.terrace?.setAngle(door);
  if (door !== state.lastDoor) { renderer.shadowMap.needsUpdate = true; state.lastDoor = door; }

  // material sweeps: the big room as we land, the hall from its door, the kitchen from its door,
  // the terraces from the glazed door; rising, everything floods
  const flood = 60 * ease(ramp(p, 0.93, 0.965));
  const rBig = Math.max(6.0 * ease(ramp(p, 0.13, 0.2)) + 4.0 * s, flood);
  for (const k of BIGISH) rooms.set(k, START[0], -START[1], rBig, 1.5);
  const rHall = Math.max(Math.max(0, s - (S.bigDoor - 1.1)) * 2.8, flood);
  for (const k of HALLISH) rooms.set(k, DOOR_BIG[0], -DOOR_BIG[1], rHall, 1.8);
  rooms.set('kitchen', DOOR_K[0], -DOOR_K[1], Math.max(Math.max(0, s - (S.kdoor - 1.3)) * 2.6, flood), 1.4);
  const rOut = Math.max(Math.max(0, s - (S.tdoor - 1.9)) * 3.2, flood);
  rooms.set('covered', DOOR_T[0], -DOOR_T[1], rOut, 1.5);
  rooms.set('terrace', DOOR_T[0], -DOOR_T[1], rOut * 1.4, 1.8);
  for (const k of ['none', 'top']) rooms.set(k, 14.6, -5.9, flood, 2.2);

  // outside, the paper sky gives way to the real one; the sun warms a little, then the plan light
  const skyK = ease(ramp(s, S.tdoor - 0.7, S.tdoor + 0.9)) * (1 - ease(ramp(p, 0.948, 0.975)));
  sky.update(camera, skyK);
  sheet.paperMesh.material.opacity = 1 - skyK;
  sheet.paperMesh.visible = skyK < 0.999;
  setSun(0.3 * ease(ramp(p, 0.55, 0.92)), ease(ramp(p, 0.95, 0.985)));
  if (p > 0.55) renderer.shadowMap.needsUpdate = true;
  building.setCapTone(ease(ramp(camera.position.y, 14, 5)));
  st.aoK = SMALL ? 0 : 0.95 * ease(ramp(p, 0.13, 0.16)) * (1 - ease(ramp(p, 0.94, 0.965)));

  let active = null;
  for (const c of caps) if (p >= c.a && p < c.b) active = c;
  for (const c of caps) c.el.classList.toggle('is-on', c === active);
  rail.style.height = `${(p * 100).toFixed(2)}%`;
  hint.style.opacity = p > 0.02 ? 0 : 1;
  mark.style.opacity = (ease(ramp(p, 0.1, 0.15)) * (1 - ease(ramp(p, 0.96, 0.985)))).toFixed(3);
}

function resize() { st.resize(); state.dirty = true; }
addEventListener('resize', resize);
resize();
const render = () => st.render();
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
    trigger: '#track', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => { state.p = self.progress; state.dirty = true; },
  });
  gsap.ticker.add(() => {
    if (!state.dirty) return;
    state.dirty = false;
    apply(state.p);
    render();
  });
}

// ---------------- capture hook (recording frame by frame)
if (CAPTURE) window.__p593 = {
  marks: () => ({ ...M, len: RIDE2.len }),
  ready: st.loading.then(() => new Promise((r) => requestAnimationFrame(() => r(true)))),
  set(p) { state.p = p; apply(p); renderer.shadowMap.needsUpdate = true; render(); return true; },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
