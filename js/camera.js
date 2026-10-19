// Camera path, driven by one timeline value t: act 1 is t in [0, 1], act 2 is [1, 2].
// Act 1, phase A: the sheet, seen straight down through a very long lens; the lens opens
// while the camera closes in (a dolly-zoom), so depth arrives gradually.
// Act 1, phase B: a Catmull-Rom flight down into the stair hall, through the door, into the hall.
// Act 2: the camera rides the black line at eye height, then leaves it for the covered terrace.
import * as THREE from 'three';
import { SHEET } from './sheet.js';
import { PLAN } from './plan-data.js';

const D2R = Math.PI / 180;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ramp = (p, a, b) => clamp01((p - a) / (b - a));
export const ease = (t) => t * t * (3 - 2 * t);
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const P_A = 0.36;

// the timeline, in progress units
export const T = {
  sheetHold: 0.1,
  lensEnd: 0.34,
  cutStart: 0.12,
  cutEnd: 0.3,
  sheetFadeA: 0.1,
  sheetFadeB: 0.2,
  doorA: 0.585,
  doorB: 0.645,
  sweep: [[0.645, 0], [0.7, 1.8], [0.78, 4.2], [0.86, 10.8], [1.0, 22]],
};

const SHEET_C = new THREE.Vector3((SHEET.x0 + SHEET.x1) / 2, 0, -(SHEET.y0 + SHEET.y1) / 2);
const BUILD_C = new THREE.Vector3(14.6, 0, -5.9);

function phaseA(p, aspect, out) {
  const portrait = aspect < 0.8;
  const sw = SHEET.x1 - SHEET.x0, sh = SHEET.y1 - SHEET.y0;
  const Hs = portrait ? Math.max(sw * 1.05, (sh * 1.05) / aspect) : Math.max(sh * 1.06, (sw * 1.06) / aspect);
  const z = easeIO(ramp(p, T.sheetHold, T.lensEnd));
  const fov = Math.exp(THREE.MathUtils.lerp(Math.log(1.1), Math.log(38), z));
  const Hf = THREE.MathUtils.lerp(Hs, portrait ? 30 : 21, easeIO(ramp(p, T.sheetHold, P_A)));
  const dist = Hf / (2 * Math.tan((fov * D2R) / 2));
  const target = SHEET_C.clone().lerp(BUILD_C, easeIO(ramp(p, T.sheetHold, P_A)));
  const pitch = THREE.MathUtils.lerp(-90, -56, easeIO(ramp(p, 0.16, P_A))) * D2R;
  const h0 = portrait ? 90 : 0;
  const heading = THREE.MathUtils.lerp(h0, 30, easeIO(ramp(p, 0.14, P_A))) * D2R;
  const fwd = new THREE.Vector3(Math.cos(pitch) * Math.sin(heading), Math.sin(pitch), -Math.cos(pitch) * Math.cos(heading));
  out.pos.copy(target).addScaledVector(fwd, -dist);
  out.target.copy(target);
  out.fov = fov;
  const sheetUp = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
  const w = ease(ramp(pitch / D2R, -90, -58));
  out.up.copy(sheetUp).lerp(new THREE.Vector3(0, 1, 0), w).normalize();
  out.dist = dist;
  return out;
}

const KEYS = [
  // [p, position, target, fov]   (world: x east, y up, z = -north)
  [0.405, [7.4, 15.5, 3.2], [10.1, 0.6, -5.2], 41],
  [0.46, [8.6, 7.6, -2.8], [10.4, 0.8, -5.6], 44],
  [0.535, [8.85, 2.3, -5.5], [11.08, 1.35, -5.79], 54],
  [0.575, [8.8, 1.6, -5.79], [11.08, 1.4, -5.79], 58],
  [0.635, [9.15, 1.6, -5.79], [11.3, 1.42, -5.84], 58],
  [0.7, [11.55, 1.6, -5.95], [15.0, 1.5, -6.3], 58],
  [0.78, [14.45, 1.6, -6.35], [21.5, 1.35, -6.4], 58],
  [0.86, [14.6, 1.6, -6.45], [21.5, 1.3, -6.6], 58],
  [0.94, [15.05, 1.6, -7.5], [18.6, 1.3, -11.6], 58],
  [1.0, [15.35, 1.62, -8.35], [6.6, 1.2, -10.5], 58],
];
const STOPS = new Set([0.575, 0.78, 0.86, 1.0]);

export class Rig {
  constructor() {
    this.act2 = ACT2;   // main.js swaps in ACT2A when the archive is on
    this.posCurve = null;
    this.tgtCurve = null;
    this.aspect = 0;
  }
  endOfAct1() {
    if (!this._end) {
      const k = KEYS[KEYS.length - 1];
      this._end = { pos: new THREE.Vector3(...k[1]), target: new THREE.Vector3(...k[2]), fov: k[3] };
    }
    return this._end;
  }
  endOfAct2() {
    if (!this._end2) {
      const o = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 58, dist: 3 };
      this._end2 = this.act2.pose(2.0, this.endOfAct1(), o);
    }
    return this._end2;
  }
  build(aspect) {
    this.aspect = aspect;
    const a = phaseA(P_A, aspect, { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 0 });
    this.aFov = a.fov;
    const pts = [a.pos.clone(), ...KEYS.map((k) => new THREE.Vector3(...k[1]))];
    const tgs = [a.target.clone(), ...KEYS.map((k) => new THREE.Vector3(...k[2]))];
    this.times = [P_A, ...KEYS.map((k) => k[0])];
    this.fovs = [a.fov, ...KEYS.map((k) => k[3])];
    this.posCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.tgtCurve = new THREE.CatmullRomCurve3(tgs, false, 'centripetal');
  }
  pose(p, aspect, out) {
    if (!(Math.abs(aspect - this.aspect) <= 1e-3) || !this.posCurve) this.build(aspect);
    if (p <= P_A) return phaseA(p, aspect, out);
    if (p > 2) return act3Pose(p, this.endOfAct2(), aspect, out);
    if (p > 1) return this.act2.pose(p, this.endOfAct1(), out);
    const t = this.times;
    let i = 0;
    while (i < t.length - 2 && p > t[i + 1]) i++;
    let local = clamp01((p - t[i]) / (t[i + 1] - t[i]));
    const startStop = i === 0 || STOPS.has(t[i]);
    const endStop = STOPS.has(t[i + 1]);
    if (startStop && endStop) local = easeIO(local);
    else if (startStop) local = leave(local);
    else if (endStop) local = 1 - leave(1 - local);
    const u = (i + local) / (t.length - 1);
    this.posCurve.getPoint(u, out.pos);
    this.tgtCurve.getPoint(u, out.target);
    out.fov = THREE.MathUtils.lerp(this.fovs[i], this.fovs[i + 1], ease(local));
    const dir = out.target.clone().sub(out.pos).normalize();
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / D2R;
    const w = ease(ramp(pitch, -90, -58));
    const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    out.up.copy(flat).lerp(new THREE.Vector3(0, 1, 0), w).normalize();
    out.dist = out.pos.distanceTo(out.target);
    return out;
  }
}

// out of a stop: starts at rest, ends at cruising speed (f(0)=0, f'(0)=0, f(1)=1, f'(1)=1)
const leave = (t) => t * t * (2 - t);

export function sweepRadius(p) {
  const s = T.sweep;
  if (p <= s[0][0]) return 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (p <= s[i + 1][0]) {
      const k = (p - s[i][0]) / (s[i + 1][0] - s[i][0]);
      return THREE.MathUtils.lerp(s[i][1], s[i + 1][1], i === 0 ? k * k : k);
    }
  }
  return s[s.length - 1][1];
}

// ---------------------------------------------------------------- acts 2 and 3: walking a path
const EYE = 1.6;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// round every corner with a small quadratic fillet, then resample densely
function filleted(pts, rMax = 0.55) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(rMax, l1 * 0.45, l2 * 0.45);
    const p0 = [b[0] + ((a[0] - b[0]) / l1) * r, b[1] + ((a[1] - b[1]) / l1) * r];
    const p2 = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8, v = 1 - u;
      out.push([v * v * p0[0] + 2 * v * u * b[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * b[1] + u * u * p2[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  // resample every 5 cm
  const dense = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1], b = out[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(l / 0.05));
    for (let k = 1; k <= n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return dense;
}

// A walk along a plan path at eye height. Before t0 the camera turns (and steps) from
// the previous act's last pose onto the path; between t0 and t1 it walks, slowing where the
// time-cost dips say so; near the end it settles on a fixed view.
export class Ride {
  constructor(planPts, cfg) {
    this.cfg = cfg;
    const d = filleted(planPts);
    this.pts = d.map(([x, y]) => new THREE.Vector3(x, EYE, -y));
    this.s = [0];
    for (let i = 1; i < this.pts.length; i++) this.s.push(this.s[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.len = this.s[this.s.length - 1];
    const sAt = ([x, y]) => {
      let best = 0, bd = Infinity;
      d.forEach((q, i) => { const dd = Math.hypot(q[0] - x, q[1] - y); if (dd < bd) { bd = dd; best = i; } });
      return this.s[best];
    };
    this.marks = {};
    for (const [k, xy] of Object.entries(cfg.marks)) this.marks[k] = sAt(xy);
    // look stops: the camera slows, steps aside if asked, and turns to face a target
    this.looks = (cfg.looks || []).map((l) => ({ ...l, s: sAt(l.at), tgt: new THREE.Vector3(l.target[0], l.target[1], -l.target[2]) }));
    for (const l of this.looks) this.marks[l.key] = l.s;
    const dips = [...cfg.dips(this.marks, this.len), ...this.looks.map((l) => [l.s, l.dwell, l.dwellWidth ?? 0.55])];
    this.c = [0];
    for (let i = 1; i < this.s.length; i++) {
      const sm = (this.s[i] + this.s[i - 1]) / 2;
      let w = 1;
      for (const [s0, a, wd] of dips) w += a * Math.exp(-(((sm - s0) / wd) ** 2));
      this.c.push(this.c[i - 1] + w * (this.s[i] - this.s[i - 1]));
    }
    this.cTot = this.c[this.c.length - 1];
    this.final = { target: new THREE.Vector3(...cfg.final) };
  }
  sAtT(t) {
    const { t0, t1 } = this.cfg;
    if (t <= t0) return 0;
    if (t >= t1) return this.len;
    const c = ((t - t0) / (t1 - t0)) * this.cTot;
    let lo = 0, hi = this.c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.c[m] < c) lo = m; else hi = m; }
    const k = (c - this.c[lo]) / (this.c[hi] - this.c[lo] || 1);
    return this.s[lo] + (this.s[hi] - this.s[lo]) * k;
  }
  tAtS(s) {
    let lo = 0, hi = this.s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] < s) lo = m; else hi = m; }
    return this.cfg.t0 + (this.c[lo] / this.cTot) * (this.cfg.t1 - this.cfg.t0);
  }
  point(s, out = new THREE.Vector3()) {
    if (s <= 0) return out.copy(this.pts[0]);
    if (s >= this.len) return out.copy(this.pts[this.pts.length - 1]);
    let lo = 0, hi = this.s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] < s) lo = m; else hi = m; }
    const k = (s - this.s[lo]) / (this.s[hi] - this.s[lo]);
    return out.copy(this.pts[lo]).lerp(this.pts[hi], k);
  }
  // heading from the average of the path some metres ahead, so turns begin early
  heading(s) {
    const [a0, step] = this.cfg.look;
    const p = this.point(s), acc = new THREE.Vector3(), q = new THREE.Vector3();
    for (let k = 0; k < 8; k++) acc.add(this.point(s + a0 + k * step, q));
    acc.multiplyScalar(1 / 8).sub(p);
    if (acc.lengthSq() < 1e-6) return null;
    return Math.atan2(acc.z, acc.x);
  }
  // how strongly each look stop holds the camera at ride distance s (0..1)
  lookWeight(l, s) {
    const [before, after] = l.span;
    return ease(ramp(s, l.s - before, l.s)) * (1 - ease(ramp(s, l.s, l.s + after)));
  }
  pose(t, start, out) {
    const cfg = this.cfg;
    const P = (yaw, pitch, pos) => {
      out.pos.copy(pos);
      out.target.set(pos.x + Math.cos(yaw) * Math.cos(pitch) * 3, pos.y + Math.sin(pitch) * 3, pos.z + Math.sin(yaw) * Math.cos(pitch) * 3);
      out.up.set(0, 1, 0);
      out.fov = 58;
      out.dist = 3;
      return out;
    };
    const d0 = start.target.clone().sub(start.pos);
    const yaw0 = Math.atan2(d0.z, d0.x), pitch0 = Math.atan2(d0.y, Math.hypot(d0.x, d0.z));
    const ridePitch = cfg.pitch * D2R;
    if (t <= cfg.t0) {
      // turn from the previous pose to the ride's own first pose (which may already face a look stop)
      const k = easeIO(ramp(t, cfg.tTurn, cfg.t0));
      const first = this.pose(cfg.t0 + 1e-6, start, { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 58, dist: 3 });
      const d1 = first.target.clone().sub(first.pos);
      const yaw1 = Math.atan2(d1.z, d1.x), pitch1 = Math.atan2(d1.y, Math.hypot(d1.x, d1.z));
      const pos = start.pos.clone().lerp(first.pos, k);
      return P(yaw0 + wrapPi(yaw1 - yaw0) * k, THREE.MathUtils.lerp(pitch0, pitch1, k), pos);
    }
    const s = this.sAtT(t);
    const pos = this.point(s);
    let wLook = 0;
    const looking = [];
    for (const l of this.looks) {
      const w = this.lookWeight(l, s);
      if (w <= 0) continue;
      if (l.offset) pos.add(new THREE.Vector3(l.offset[0], 0, -l.offset[1]).multiplyScalar(w));
      looking.push([l, w]);
      wLook = Math.max(wLook, w);
    }
    let yaw = this.heading(Math.min(s, this.len - cfg.endPad)) ?? 0;
    const df = this.final.target.clone().sub(pos);
    let yawF = Math.atan2(df.z, df.x);
    const pitchF = Math.atan2(df.y, Math.hypot(df.x, df.z));
    if (cfg.drift) yawF += cfg.drift[2] * D2R * easeIO(ramp(t, cfg.drift[0], cfg.drift[1]));
    const kf = easeIO(ramp(s, cfg.finalFrom(this.marks, this.len), this.len));
    yaw = yaw + wrapPi(yawF - yaw) * kf;
    let turn = 0;
    if (cfg.dropInTurns) {
      // in tight turns the eyes drop to the line at the camera's feet
      for (let k = -2; k <= 2; k++) {
        const a = this.heading(s + k * 0.45 - 0.35), b = this.heading(s + k * 0.45 + 0.35);
        if (a !== null && b !== null) turn += Math.abs(wrapPi(b - a)) / 0.7;
      }
      turn = ease(clamp01(turn / 5 / 1.1)) * (1 - kf);
    }
    let pitch = THREE.MathUtils.lerp(ridePitch - 20 * D2R * turn * (1 - wLook), pitchF, kf);
    for (const [l, w] of looking) {
      const d = l.tgt.clone().sub(pos);
      yaw = yaw + wrapPi(Math.atan2(d.z, d.x) - yaw) * w;
      pitch = THREE.MathUtils.lerp(pitch, Math.atan2(d.y, Math.hypot(d.x, d.z)), w);
    }
    return P(yaw, pitch, pos);
  }
  times() {
    const o = {};
    for (const [k, v] of Object.entries(this.marks)) o[k] = this.tAtS(v);
    return o;
  }
}

// act 2: the inlay from the first switchback (15.08, 7.23) round the serpentine, up the glazing,
// west along the windows, round the west end and back beside the table, then out
function railPlan() {
  const idx = [];
  for (let i = 16; i <= 41; i++) idx.push(i);
  for (let i = 0; i <= 11; i++) idx.push(i);
  const pts = idx.map((i) => [...PLAN.inlay[i]]);
  // keep 0.7 m off the 2.80 m cabinet wall on the south run
  for (const q of pts) if (Math.abs(q[1] - 2.35) < 0.06 && q[0] > 15.0 && q[0] < 19.7) q[1] += 0.32;
  // the switchback tips come within 0.7 m of the partition; the camera turns 1.1 m off it
  for (const q of pts) if (q[0] < 15.2 && q[1] < 7.5 && q[1] > 2.0) q[0] = 15.45;
  pts.push([17.2, 9.045]);
  // leave the line, pass well north of the column, through the sliding panel,
  // then turn south under the pergola
  pts.push([18.3, 9.7], [19.4, 10.0], [20.6, 9.9], [21.55, 9.72], [22.25, 9.55], [22.68, 9.1], [22.75, 8.55]);
  return pts;
}
export const ACT2 = new Ride(railPlan(), {
  tTurn: 1, t0: 1.07, t1: 1.985, pitch: -10, look: [2.0, 0.42], endPad: 5.5, dropInTurns: true,
  marks: { eastSide: [20.0, 3.9], ne: [19.52, 11.077], west: [6.91, 10.0], leave: [17.2, 9.045], door: [21.55, 9.72] },
  dips: (m, len) => [[0, 2.2, 1.0], [m.ne, 1.7, 1.6], [m.west, 1.0, 1.2], [m.door, 1.8, 1.0], [len, 3.2, 1.2]],
  final: [22.95, 1.25, -1.2], // down the pergola corridor
  finalFrom: (m) => m.door - 1.0,
});

// act 2 with the archive: the same ride, pausing at Madi's four shows in date order
export const ACT2A = new Ride(railPlan(), {
  ...ACT2.cfg,
  looks: [
    // 30 Nov 1988, sculptures: the poster on the column, seen from the start of the line
    { key: 'sculptures', at: [15.45, 7.228], target: [18.8, 1.42, 8.3], span: [0.01, 2.6], dwell: 6.5, dwellWidth: 0.7 },
    // 14 Dec 1988, pastels: the partition, from the second switchback (the camera steps back)
    { key: 'pastels', at: [15.45, 3.2], target: [14.33, 1.45, 3.2], offset: [0.55, 0], span: [1.6, 1.6], dwell: 7.5 },
    // 25 Jan 1989, drawings and prints: the west wall, from the run along the windows
    { key: 'dessins', at: [8.4, 11.07], target: [5.82, 1.45, 9.9], span: [2.2, 1.6], dwell: 7.5 },
    // 15 Feb 1989, paintings: the long lobe wall, from beside the table
    { key: 'peintures', at: [8.6, 9.045], target: [11.0, 1.5, 7.88], offset: [0, 0.3], span: [1.6, 2.2], dwell: 8 },
  ],
});

// act 3: turn round under the pergola, through the gap in the north planter, onto the open
// terrace, and face the low sun over the north-east parapet
export const ACT3_T = { turn: 2.0, t0: 2.05, t1: 2.44, rise0: 2.545, rise1: 2.97 };
export const ACT3 = new Ride([[22.75, 8.55], [22.62, 9.5], [22.75, 10.6], [22.8, 11.4], [22.95, 12.2], [23.9, 12.72], [24.6, 12.78], [25.15, 12.6]], {
  tTurn: ACT3_T.turn, t0: ACT3_T.t0, t1: ACT3_T.t1, pitch: -4, look: [1.2, 0.3], endPad: 2.5, dropInTurns: false,
  marks: { gap: [22.8, 11.4] },
  dips: (m, len) => [[0, 1.6, 0.8], [m.gap, 0.8, 0.8], [len, 3.0, 1.0]],
  final: [29.3, 1.95, -14.25], // the sun, low over the parapet
  finalFrom: (m) => m.gap + 0.6,
  drift: [ACT3_T.t1, ACT3_T.rise0, -7],
});

// the rise: a reverse dolly-zoom from the terrace back to the sheet seen through the long lens
function rise(t, start, aspect, out) {
  return riseU(ramp(t, ACT3_T.rise0, ACT3_T.rise1), start, aspect, out);
}
// u = 0: the eye-level pose `start`; u = 1: the sheet straight down through the 1.1 deg lens (the walk's
// first frame). Run backwards, it is the fall from the sheet into a room (walk2.html).
export function riseU(u, start, aspect, out) {
  const portrait = aspect < 0.8;
  const sw = SHEET.x1 - SHEET.x0, sh = SHEET.y1 - SHEET.y0;
  const Hs = portrait ? Math.max(sw * 1.05, (sh * 1.05) / aspect) : Math.max(sh * 1.06, (sw * 1.06) / aspect);
  const d0 = start.target.clone().sub(start.pos);
  const dist0 = d0.length();
  const pitch0 = Math.asin(THREE.MathUtils.clamp(d0.y / dist0, -1, 1));
  const head0 = Math.atan2(d0.x, -d0.z);
  const headF = (portrait ? 90 : 0) * D2R;
  const pitch = THREE.MathUtils.lerp(pitch0, -Math.PI / 2, easeIO(ramp(u, 0, 0.72)));
  const heading = head0 + wrapPi(headF - head0) * easeIO(ramp(u, 0.04, 0.85));
  const fov = Math.exp(THREE.MathUtils.lerp(Math.log(start.fov), Math.log(1.1), easeIO(ramp(u, 0.3, 1))));
  const Hf0 = 2 * dist0 * Math.tan((start.fov * D2R) / 2);
  const Hf = Math.exp(THREE.MathUtils.lerp(Math.log(Hf0), Math.log(Hs), easeIO(ramp(u, 0, 0.92))));
  const dist = Hf / (2 * Math.tan((fov * D2R) / 2));
  const target = start.target.clone().lerp(SHEET_C, easeIO(ramp(u, 0.03, 0.9)));
  const fwd = new THREE.Vector3(Math.cos(pitch) * Math.sin(heading), Math.sin(pitch), -Math.cos(pitch) * Math.cos(heading));
  out.pos.copy(target).addScaledVector(fwd, -dist);
  out.target.copy(target);
  out.fov = fov;
  const sheetUp = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
  out.up.copy(sheetUp).lerp(new THREE.Vector3(0, 1, 0), ease(ramp(pitch / D2R, -90, -58))).normalize();
  out.dist = dist;
  return out;
}

export function act3Pose(t, act2End, aspect, out) {
  if (t <= ACT3_T.rise0) return ACT3.pose(t, act2End, out);
  const start = ACT3.pose(ACT3_T.rise0, act2End, { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 58, dist: 3 });
  return rise(t, start, aspect, out);
}
