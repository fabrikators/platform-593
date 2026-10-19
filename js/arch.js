// The building, built from PLAN (the Live Home 3D model). One geometry serves
// both the sheet (cut by a horizontal clipping plane, seen from above) and the
// walk (eye height, real materials).
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { PLAN } from './plan-data.js';
import { revealMaterial, revealLineMaterial, PAPER, INK } from './reveal.js';
import { buildKitchen, buildCorridor } from './interiors.js';

export const H = PLAN.storeyHeight;
const CAP_SOFT = new THREE.Color('#c3bdb1');
const INTERIOR = ['hall', 'big', 'dressing', 'bath', 'closet', 'core', 'storeN', 'wc', 'storeS', 'kitchen'];

export const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

// ---------- small 2D helpers (plan frame)
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function roomAt(pt) {
  let best = null, area = Infinity;
  for (const [k, r] of Object.entries(PLAN.rooms)) {
    if (inside(pt, r.poly) && !(r.holes || []).some((h) => inside(pt, h)) && r.area < area) { best = k; area = r.area; }
  }
  return best;
}
// keep the part of a convex polygon whose coordinate along u (from a) is within [s0, s1]
function clipStrip(poly, a, u, s0, s1) {
  const cut = (pts, keep) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const fp = keep(p), fq = keep(q);
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) {
        const t = fp / (fp - fq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return out;
  };
  let r = cut(poly, (p) => dot(sub(p, a), u) - s0);
  if (r.length) r = cut(r, (p) => s1 - dot(sub(p, a), u));
  return r;
}

// ---------- geometry buckets: one mesh + one line set per (room, material)
class Bucket {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.lines = []; }
  poly(pts, n, uvOf) {
    // pts: Vector3[] planar convex polygon; n: outward normal
    const e1 = new THREE.Vector3().subVectors(pts[1], pts[0]);
    const e2 = new THREE.Vector3().subVectors(pts[2], pts[0]);
    const order = e1.cross(e2).dot(n) < 0 ? [...pts].reverse() : pts;
    for (let i = 1; i < order.length - 1; i++) {
      for (const p of [order[0], order[i], order[i + 1]]) {
        this.pos.push(p.x, p.y, p.z); this.nrm.push(n.x, n.y, n.z);
        const uv = uvOf ? uvOf(p) : worldUV(p, n);
        this.uv.push(uv[0], uv[1]);
      }
    }
  }
  edgesFrom(pos) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const e = new THREE.EdgesGeometry(g, 18).attributes.position.array;
    for (let i = 0; i < e.length; i++) this.lines.push(e[i]);
  }
  group(fn) {
    const start = this.pos.length;
    fn();
    this.edgesFrom(this.pos.slice(start));
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}
function worldUV(p, n) {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (ay >= ax && ay >= az) return [p.x, -p.z];
  if (ax >= az) return [-p.z * Math.sign(n.x || 1), p.y];
  return [p.x * Math.sign(n.z || 1), p.y];
}

export class Building {
  constructor(rooms) {
    this.rooms = rooms;              // Rooms (reveal uniforms)
    this.group = new THREE.Group();
    this.cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.2);
    this.buckets = new Map();        // key `${room}|${mat}`
    this.mats = {};                  // shared material definitions per kind, cloned per room
    this.lineMats = [];
    this.caps = [];                  // {mesh, sill, head, h}
    this.capGroup = new THREE.Group();
    this.doors = {};
    this.shadowOnly = [];
  }

  bucket(room, mat) {
    const k = `${room || 'none'}|${mat}`;
    if (!this.buckets.has(k)) this.buckets.set(k, new Bucket());
    return this.buckets.get(k);
  }

  build() {
    for (const w of PLAN.walls) this.wall(w);
    this.floorsAndCeilings();
    this.inlay();
    this.fixtures();
    buildKitchen(this);
    buildCorridor(this);
    this.pergola();
    this.core();
  }

  finish() {
    this.flush();
    this.group.add(this.capGroup);
  }

  // ---------------- walls
  wall(w) {
    const a = w.a, b = w.b;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const n = [-u[1], u[0]];
    const hT = w.h;
    let t = w.t;
    let quad = w.quad;
    if (w.kind === 'planter') {
      t = 0.45;
      const e = t / 2;
      quad = [[-e, e], [L + e, e], [L + e, -e], [-e, -e]].map(([s, d]) => [a[0] + u[0] * s + n[0] * d, a[1] + u[1] * s + n[1] * d]);
    }
    const sd = quad.map((p) => ({ p, s: dot(sub(p, a), u), d: dot(sub(p, a), n) }));
    const A = sd.filter((q) => q.d > 0).sort((x, y) => x.s - y.s);
    const B = sd.filter((q) => q.d <= 0).sort((x, y) => x.s - y.s);
    if (A.length !== 2 || B.length !== 2) return;
    const mat = w.kind === 'planter' ? 'planter' : 'plaster';
    const P = (s, d, y) => W(a[0] + u[0] * s + n[0] * d, a[1] + u[1] * s + n[1] * d, y);
    const nA = new THREE.Vector3(n[0], 0, -n[1]);
    const nB = nA.clone().negate();
    const uW = new THREE.Vector3(u[0], 0, -u[1]);
    const ops = w.open.map((o) => ({ ...o, sill: Math.max(0, o.sill), head: Math.min(hT, o.head) }));
    const flatRoom = w.sides.includes('hall') ? 'hall' : (w.sides[0] || w.sides[1]);

    const sideFace = (side, off, nrm, room) => {
      const s0 = side[0].s, s1 = side[1].s;
      const sB = [...new Set([s0, s1, ...ops.flatMap((o) => [o.s0, o.s1]).filter((s) => s > s0 && s < s1)])].sort((x, y) => x - y);
      const yB = [...new Set([0, hT, ...ops.flatMap((o) => [o.sill, o.head]).filter((y) => y > 0 && y < hT)])].sort((x, y) => x - y);
      const bk = this.bucket(room, mat);
      bk.group(() => {
        for (let i = 0; i < sB.length - 1; i++) {
          for (let j = 0; j < yB.length - 1; j++) {
            const sc = (sB[i] + sB[i + 1]) / 2, yc = (yB[j] + yB[j + 1]) / 2;
            if (ops.some((o) => sc > o.s0 && sc < o.s1 && yc > o.sill && yc < o.head)) continue;
            bk.poly([P(sB[i], off, yB[j]), P(sB[i + 1], off, yB[j]), P(sB[i + 1], off, yB[j + 1]), P(sB[i], off, yB[j + 1])], nrm);
          }
        }
      });
    };
    sideFace(A, t / 2, nA, w.sides[0]);
    sideFace(B, -t / 2, nB, w.sides[1]);

    // jambs, soffits, sills
    const jb = this.bucket(flatRoom, mat);
    for (const o of ops) {
      jb.group(() => {
        jb.poly([P(o.s0, -t / 2, o.sill), P(o.s0, t / 2, o.sill), P(o.s0, t / 2, o.head), P(o.s0, -t / 2, o.head)], uW);
        jb.poly([P(o.s1, -t / 2, o.sill), P(o.s1, t / 2, o.sill), P(o.s1, t / 2, o.head), P(o.s1, -t / 2, o.head)], uW.clone().negate());
        if (o.head < hT - 1e-3) jb.poly([P(o.s0, -t / 2, o.head), P(o.s1, -t / 2, o.head), P(o.s1, t / 2, o.head), P(o.s0, t / 2, o.head)], new THREE.Vector3(0, -1, 0));
        if (o.sill > 1e-3) jb.poly([P(o.s0, -t / 2, o.sill), P(o.s1, -t / 2, o.sill), P(o.s1, t / 2, o.sill), P(o.s0, t / 2, o.sill)], new THREE.Vector3(0, 1, 0));
      });
      if (o.kind === 'window') this.window(w, o, P, t, flatRoom);
      else if (o.kind !== 'gap') this.door(w, o, u, n, t, flatRoom);
    }

    // ends (mitred)
    for (const [p, q] of [[A[0].p, B[0].p], [A[1].p, B[1].p]]) {
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ev = sub(q, p);
      let en = [ev[1], -ev[0]];
      const l = Math.hypot(en[0], en[1]) || 1;
      en = [en[0] / l, en[1] / l];
      const ctr = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (dot(en, sub(mid, ctr)) < 0) en = [-en[0], -en[1]];
      const room = roomAt([mid[0] + en[0] * 0.25, mid[1] + en[1] * 0.25]) || flatRoom;
      const bk = this.bucket(room, mat);
      bk.group(() => bk.poly([W(p[0], p[1], 0), W(q[0], q[1], 0), W(q[0], q[1], hT), W(p[0], p[1], hT)], new THREE.Vector3(en[0], 0, -en[1])));
    }

    // top, split where full-height openings reach it
    const topRoom = w.kind === 'full' ? 'top' : (w.sides[0] || w.sides[1]);
    const tb = this.bucket(topRoom, mat);
    const gaps = ops.filter((o) => o.head >= hT - 1e-3).sort((x, y) => x.s0 - y.s0);
    let s = -1e3;
    const strips = [];
    for (const g of gaps) { strips.push([s, g.s0]); s = g.s1; }
    strips.push([s, 1e3]);
    tb.group(() => {
      for (const [s0, s1] of strips) {
        const pc = clipStrip(quad, a, u, s0, s1);
        if (pc.length >= 3) tb.poly(pc.map((p) => W(p[0], p[1], hT)), new THREE.Vector3(0, 1, 0));
      }
    });

    // planting in the planter boxes along the old saw-tooth glazing line
    if (w.kind === 'planter') {
      const e = t / 2 - 0.05;
      const cuts = [[-e + 0.05, L + e - 0.05]];
      for (const g of ops.filter((q) => q.kind === 'gap')) {
        const last = cuts.pop();
        cuts.push([last[0], g.s0 - 0.05], [g.s1 + 0.05, last[1]]);
      }
      for (const [sa, sb] of cuts) {
        const soil = [[sa, e], [sb, e], [sb, -e], [sa, -e]].map(([sx, dy]) => [a[0] + u[0] * sx + n[0] * dy, a[1] + u[1] * sx + n[1] * dy]);
        this.prism(w.sides.includes('covered') ? 'covered' : 'terrace', 'soil', soil, hT, hT + 0.012);
      }
    }

    // black poché caps for full walls: pieces between openings, each with its own gap rule
    if (w.kind === 'full') {
      const bounds = [-1e3, ...ops.flatMap((o) => [o.s0, o.s1]), 1e3];
      for (let i = 0; i < bounds.length - 1; i++) {
        const s0 = bounds[i], s1 = bounds[i + 1];
        if (s1 - s0 < 1e-4) continue;
        const o = ops.find((q) => Math.abs(q.s0 - s0) < 1e-6 && Math.abs(q.s1 - s1) < 1e-6);
        const pc = clipStrip(quad, a, u, s0, s1);
        if (pc.length < 3) continue;
        this.cap(pc, o ? o.sill : null, o ? o.head : null, hT);
      }
    }
  }

  cap(poly, sill, head, h, color = INK) {
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, this.capMat(color));
    m.renderOrder = 2;
    this.capGroup.add(m);
    this.caps.push({ mesh: m, sill, head, h });
  }
  // the cut stays black on the sheet; it softens as the camera comes down into the model
  setCapTone(k) {
    const m = this.mats['cap' + INK.getHexString()];
    if (m) m.color.copy(INK).lerp(CAP_SOFT, k);
  }
  capMat(color) {
    const k = 'cap' + color.getHexString();
    if (!this.mats[k]) this.mats[k] = new THREE.MeshBasicMaterial({ color, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return this.mats[k];
  }

  // caps follow the cut; openings show as gaps while the cut passes through them
  setCut(cut, risen) {
    this.cut.constant = cut;
    for (const c of this.caps) {
      const y = Math.min(cut, c.h);
      c.mesh.position.y = y - 0.002;
      let vis = true;
      if (c.sill !== null && y > c.sill + 1e-3 && y < c.head - 1e-3) vis = false;
      c.mesh.visible = vis;
    }
  }

  // ---------------- openings
  window(w, o, P, t, room) {
    const st = this.bucket(room, 'steel');
    const gl = this.bucket(room, 'glass');
    const fw = 0.05, fd = 0.07;
    const wdt = o.s1 - o.s0, ht = o.head - o.sill;
    const panels = o.panels || Math.max(1, Math.round(wdt / 1.15));
    const box = (bk, s0, s1, y0, y1, d0, d1) => {
      bk.group(() => {
        const c = [P(s0, d0, y0), P(s1, d0, y0), P(s1, d1, y0), P(s0, d1, y0), P(s0, d0, y1), P(s1, d0, y1), P(s1, d1, y1), P(s0, d1, y1)];
        const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
        const cen = new THREE.Vector3();
        c.forEach((v) => cen.add(v)); cen.multiplyScalar(1 / 8);
        for (const f of faces) {
          const pts = f.map((i) => c[i]);
          const fc = new THREE.Vector3(); pts.forEach((v) => fc.add(v)); fc.multiplyScalar(0.25);
          const e1 = new THREE.Vector3().subVectors(pts[1], pts[0]), e2 = new THREE.Vector3().subVectors(pts[2], pts[0]);
          const nn = e1.cross(e2).normalize();
          if (nn.dot(fc.clone().sub(cen)) < 0) nn.negate();
          bk.poly(pts, nn);
        }
      });
    };
    const d0 = -fd / 2, d1 = fd / 2;
    // the hall's north glazing panel onto the covered terrace slides open (act 2)
    const mid = P((o.s0 + o.s1) / 2, 0, 0);
    if (w.sides.includes('covered') && Math.abs(-mid.z - 10.29) < 0.6) return this.slidingPanel(o, P, room, box, fw, fd);
    box(st, o.s0, o.s1, o.sill, o.sill + fw, d0, d1);
    box(st, o.s0, o.s1, o.head - fw, o.head, d0, d1);
    box(st, o.s0, o.s0 + fw, o.sill + fw, o.head - fw, d0, d1);
    box(st, o.s1 - fw, o.s1, o.sill + fw, o.head - fw, d0, d1);
    const pw = (wdt - fw * 2) / panels;
    for (let i = 1; i < panels; i++) {
      const s = o.s0 + fw + pw * i;
      box(st, s - fw * 0.6, s + fw * 0.6, o.sill + fw, o.head - fw, d0, d1);
    }
    if (ht > 2.3 && o.sill < 0.1) {
      const y = o.sill + 2.1;
      box(st, o.s0 + fw, o.s1 - fw, y - fw * 0.5, y + fw * 0.5, d0, d1);
    }
    box(gl, o.s0 + fw, o.s1 - fw, o.sill + fw, o.head - fw, -0.006, 0.006);
  }

  slidingPanel(o, P, room, box, fw, fd) {
    const st = this.bucket(room, 'steel'), gl = this.bucket(room, 'glass');
    const d0 = -fd / 2, d1 = fd / 2;
    box(st, o.s0, o.s1, o.sill, o.sill + fw, d0, d1);
    box(st, o.s0, o.s1, o.head - fw, o.head, d0, d1);
    box(st, o.s0, o.s0 + fw, o.sill + fw, o.head - fw, d0, d1);
    box(st, o.s1 - fw, o.s1, o.sill + fw, o.head - fw, d0, d1);
    const yT = o.sill + 2.1;
    box(st, o.s0 + fw, o.s1 - fw, yT, yT + fw, d0, d1);
    box(gl, o.s0 + fw, o.s1 - fw, yT + fw, o.head - fw, -0.006, 0.006);
    const pw = (o.s1 - o.s0 - 2 * fw) / 2, f = 0.045;
    const sashes = [];
    for (let i = 0; i < 2; i++) {
      const a0 = o.s0 + fw + i * pw, a1 = a0 + pw;
      const dd = i === 0 ? [-0.034, -0.006] : [0.006, 0.034];
      const sb = new Bucket(), sg = new Bucket();
      box(sb, a0, a1, o.sill + fw, o.sill + fw + f, ...dd);
      box(sb, a0, a1, yT - f, yT, ...dd);
      box(sb, a0, a0 + f, o.sill + fw + f, yT - f, ...dd);
      box(sb, a1 - f, a1, o.sill + fw + f, yT - f, ...dd);
      box(sg, a0 + f, a1 - f, o.sill + fw + f, yT - f, dd[0] + 0.01, dd[1] - 0.01);
      const g = new THREE.Group();
      const ms = new THREE.Mesh(sb.geometry(), this.materialFor(room, 'steel'));
      ms.castShadow = ms.receiveShadow = true;
      const mg = new THREE.Mesh(sg.geometry(), this.materialFor(room, 'glass'));
      mg.renderOrder = 5;
      const ln = new LineSegments2(new LineSegmentsGeometry().setPositions([...sb.lines, ...sg.lines]), this.lineMat(room));
      ln.renderOrder = 3;
      g.add(ms, mg, ln);
      this.group.add(g);
      sashes.push(g);
    }
    // the southern sash (larger s) slides north behind the other one
    const uW = P(1, 0, 0).sub(P(0, 0, 0));
    this.slider = { group: sashes[1], dir: uW.multiplyScalar(-pw * 0.96) };
  }
  setSlide(k) {
    if (this.slider) this.slider.group.position.copy(this.slider.dir).multiplyScalar(k);
  }

  door(w, o, u, n, t, room) {
    const width = o.s1 - o.s0;
    const hinge = o.hinge, sw = o.swing;
    // the other end of the opening
    const sh = dot(sub(hinge, w.a), u);
    const far = Math.abs(sh - o.s0) < Math.abs(sh - o.s1) ? o.s1 : o.s0;
    const fp = [w.a[0] + u[0] * far, w.a[1] + u[1] * far];
    const cdir = [fp[0] - hinge[0], fp[1] - hinge[1]];
    const cl = Math.hypot(cdir[0], cdir[1]) || 1;
    const closedA = Math.atan2(cdir[1] / cl, cdir[0] / cl);
    let openA = Math.atan2(sw[1], sw[0]);
    let delta = openA - closedA;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    // hinge sits on the wall face on the swing side
    const sideSign = Math.sign(dot(sw, n)) || 1;
    const hp = [hinge[0] + n[0] * sideSign * (t / 2 - 0.025), hinge[1] + n[1] * sideSign * (t / 2 - 0.025)];
    const pivot = new THREE.Group();
    pivot.position.copy(W(hp[0], hp[1], 0));
    const leafW = width - 0.01, leafH = o.head - 0.01, th = 0.042;
    const g = new THREE.BoxGeometry(leafW, leafH, th);
    g.translate(leafW / 2, leafH / 2, 0);
    const lm = this.lineMat(room);
    if (o.glazed) {
      // a glazed door: a black steel frame round one pane
      const f = 0.055, parts = [[0, f, 0, leafH], [leafW - f, leafW, 0, leafH], [f, leafW - f, 0, f + 0.06], [f, leafW - f, leafH - f, leafH]];
      for (const [x0, x1, y0, y1] of parts) {
        const pg = new THREE.BoxGeometry(x1 - x0, y1 - y0, th);
        pg.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
        const pm = new THREE.Mesh(pg, this.materialFor(room, 'steel'));
        pm.castShadow = true;
        pivot.add(pm, new LineSegments2(new LineSegmentsGeometry().setPositions(new THREE.EdgesGeometry(pg, 20).attributes.position.array), lm));
      }
      const gg = new THREE.BoxGeometry(leafW - 2 * f, leafH - 2 * f - 0.06, 0.008);
      gg.translate(leafW / 2, (leafH + 0.06) / 2, 0);
      const pane = new THREE.Mesh(gg, this.materialFor(room, 'glass'));
      pane.renderOrder = 5;
      pivot.add(pane);
    } else {
      const leaf = new THREE.Mesh(g, this.materialFor(room, 'oak'));
      leaf.castShadow = true; leaf.receiveShadow = true;
      pivot.add(leaf);
      pivot.add(new LineSegments2(new LineSegmentsGeometry().setPositions(new THREE.EdgesGeometry(g, 20).attributes.position.array), lm));
    }
    const front = o.kind === 'front';
    if (front) {
      // lever handles on both faces, and the flat's number on the landing side
      const hm = this.materialFor(room, 'brass');
      for (const sz of [1, -1]) {
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 0.018), hm);
        lever.position.set(leafW - 0.16, 1.02, sz * (th / 2 + 0.045));
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 20).rotateX(Math.PI / 2), hm);
        rose.position.set(leafW - 0.09, 1.02, sz * (th / 2 + 0.025));
        lever.castShadow = rose.castShadow = true;
        pivot.add(lever, rose);
      }
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const g2 = c.getContext('2d');
      g2.strokeStyle = '#171614'; g2.lineWidth = 5; g2.strokeRect(6, 6, 244, 116);
      g2.fillStyle = '#171614'; g2.font = '600 78px Inter, Helvetica, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText('593', 128, 68);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
      plate.position.set(leafW / 2, 1.58, -(th / 2 + 0.003));
      plate.rotation.y = Math.PI;
      pivot.add(plate);
      // panel lines on the leaf (both faces)
      const panel = [];
      for (const z of [th / 2 + 0.001, -th / 2 - 0.001]) {
        const x0 = 0.12, x1 = leafW - 0.12, y0 = 0.15, y1 = leafH - 0.15;
        panel.push(x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z);
      }
      pivot.add(new LineSegments2(new LineSegmentsGeometry().setPositions(panel), this.lineMat(room, 0.8)));
    }
    const setAngle = (k) => { pivot.rotation.y = closedA + delta * k; };
    setAngle(front || o.glazed ? 0 : 1);
    this.group.add(pivot);
    const rec = { pivot, setAngle, closedA, delta, hinge: hp, width, swing: sw, front, glazed: !!o.glazed, room };
    if (front) this.doors.front = rec;
    if (o.glazed) this.doors.terrace = rec;
    (this.doors.all ||= []).push(rec);
  }

  // ---------------- floors, ceilings, shadow roof
  floorsAndCeilings() {
    for (const [key, r] of Object.entries(PLAN.rooms)) {
      let poly = r.poly;
      if (key === 'core') poly = [[7.162, 3.982], [8.327, 3.982], [8.327, 3.95], [10.709, 3.95], [10.709, 5.249], [11.002, 5.249], [11.002, 6.432], [7.162, 6.435]];
      const g = new THREE.ShapeGeometry(shapeOf(poly, key === 'core' ? [] : r.holes));
      g.rotateX(-Math.PI / 2);
      const kind = r.outdoor ? 'terraceFloor' : (key === 'hall' ? 'marble' : (key === 'kitchen' || key === 'big' ? 'woodFloor' : 'stoneFloor'));
      const m = new THREE.Mesh(g, this.materialFor(key, kind));
      m.receiveShadow = true;
      this.group.add(m);
      // floor outline (part of the room's drawing)
      const pts = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        pts.push(p[0], 0.003, -p[1], q[0], 0.003, -q[1]);
      }
      this.addLines(key, pts, 0.9);
      if (!r.outdoor) {
        const c = new THREE.ShapeGeometry(shapeOf(r.poly, r.holes));
        c.rotateX(Math.PI / 2);
        c.scale(1, 1, -1);
        c.translate(0, H, 0);
        flipWinding(c);
        const cm = new THREE.Mesh(c, this.materialFor(key, 'ceiling'));
        cm.receiveShadow = true;
        this.group.add(cm);
        // roof slab: casts the sun's shadow, never drawn
        const roof = new THREE.ExtrudeGeometry(shapeOf(r.poly, []), { depth: 0.3, bevelEnabled: false });
        roof.rotateX(-Math.PI / 2);
        roof.translate(0, H + 0.002, 0);
        const rm = new THREE.Mesh(roof, this.shadowOnlyMat());
        rm.castShadow = true;
        this.group.add(rm);
        this.shadowOnly.push(rm);
      }
    }
    // slab edge under everything
    const s = new THREE.Shape(PLAN.slab.map((p) => new THREE.Vector2(p[0], p[1])));
    const sg = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
    sg.rotateX(-Math.PI / 2);
    sg.translate(0, -0.201, 0);
    const sm = new THREE.Mesh(sg, this.materialFor('none', 'slab'));
    sm.castShadow = true; sm.receiveShadow = true;
    this.group.add(sm);
    this.addLines('none', new THREE.EdgesGeometry(sg, 30).attributes.position.array, 0.9);
  }
  shadowOnlyMat() {
    return (this.mats.shadowOnly ||= new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  }

  // ---------------- the black line in the floor
  inlay() {
    const pts = PLAN.inlay;
    const bk = this.bucket('hall', 'inlay');
    const wdt = 0.12, y = 0.0025;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L < 1e-3) continue;
      const u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], n = [-u[1], u[0]];
      const e = wdt / 2;
      const c = [[-e, e], [L + e, e], [L + e, -e], [-e, -e]].map(([s, d]) => W(p[0] + u[0] * s + n[0] * d, p[1] + u[1] * s + n[1] * d, y));
      bk.poly(c, new THREE.Vector3(0, 1, 0), (v) => [v.x * 0.5, -v.z * 0.5]);
    }
    // the band's two edges, as on the 2018 drawing
    const edge = [];
    for (const side of [1, -1]) {
      const off = offsetLoop(pts, (wdt / 2) * side);
      for (let i = 0; i < off.length; i++) {
        const p = off[i], q = off[(i + 1) % off.length];
        edge.push(p[0], y + 0.001, -p[1], q[0], y + 0.001, -q[1]);
      }
    }
    this.addLines('hall', edge, 0.8);
  }

  // ---------------- fixed furniture from the model (WC, basins, shower, the terrace counter).
  // The kitchen and the corridor shelving are drawn as they stand in 2026 (js/interiors.js).
  fixtures() {
    for (const f of PLAN.fixtures) {
      const room = roomAt(centroidOf(f.poly)) || 'hall';
      if (f.kind === 'kitchen' || f.kind === 'cabinet' || (f.kind === 'table' && room === 'kitchen')) continue;
      const kind = f.kind === 'cabinet' ? 'lacquer' : f.kind === 'kitchen' ? 'lacquer' : f.kind === 'table' ? (room === 'covered' ? 'teak' : 'oak') : 'ceramic';
      const h = f.kind === 'wc' ? 0.42 : f.kind === 'shower' ? 0.06 : f.kind === 'basin' ? 0.86 : f.h;
      this.prism(room, kind, f.poly, 0, h);
      if (f.kind === 'cabinet') {
        this.cap(f.poly, null, null, h, new THREE.Color('#c9c4b9'));
        // flush door joints every 0.6 m on the room side
        const [p0, p1] = [f.poly[0], f.poly[1]];
        const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const u = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
        const ys = f.poly.map((p) => p[1]);
        const yFace = Math.max(...ys) + 0.002;
        const joints = [];
        for (let s = 0.6; s < L - 0.1; s += 0.6) {
          const x = p0[0] + u[0] * s;
          joints.push(x, 0.08, -yFace, x, h - 0.02, -yFace);
        }
        this.addLines(room, joints, 0.8);
      }
    }
  }
  prism(room, mat, poly, y0, y1) {
    const bk = this.bucket(room, mat);
    bk.group(() => {
      const ctr = centroidOf(poly);
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        let nn = [q[1] - p[1], -(q[0] - p[0])];
        const l = Math.hypot(nn[0], nn[1]) || 1; nn = [nn[0] / l, nn[1] / l];
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        if (dot(nn, sub(mid, ctr)) < 0) nn = [-nn[0], -nn[1]];
        bk.poly([W(p[0], p[1], y0), W(q[0], q[1], y0), W(q[0], q[1], y1), W(p[0], p[1], y1)], new THREE.Vector3(nn[0], 0, -nn[1]));
      }
      bk.poly(poly.map((p) => W(p[0], p[1], y1)), new THREE.Vector3(0, 1, 0));
    });
  }

  // ---------------- covered terrace pergola (white steel), from the 2026 photographs
  pergola() {
    const poly = PLAN.rooms.covered.poly;
    const ys = poly.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const top = H, d = 0.16, wB = 0.08;
    const edgeX = (y) => {
      let xm = -Infinity;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        if ((p[1] > y) !== (q[1] > y)) xm = Math.max(xm, p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
      }
      return xm;
    };
    const x0 = 21.62;
    for (let y = y0 + 0.35; y < y1 - 0.2; y += 0.75) {
      const xe = edgeX(y) - 0.25;
      this.prism('covered', 'whiteSteel', rect(x0, y - wB / 2, xe, y + wB / 2), top - d, top);
    }
    for (const xb of [x0 + 0.05, 23.75]) {
      this.prism('covered', 'whiteSteel', rect(xb - 0.05, y0 + 0.2, xb + 0.05, y1 - 0.2), top - d - 0.06, top - d);
    }
    // the two posts by the planter bay are triangulated from photographs 85 and 88
    for (const [x, y] of [[23.75, 1.7], [23.75, 5.79], [23.75, 7.17], [23.8, 11.15]]) {
      this.prism('covered', 'whiteSteel', rect(x - 0.06, y - 0.06, x + 0.06, y + 0.06), 0, top - d - 0.06);
    }
  }

  // ---------------- landing: stair well and lift (the stair hall stays a drawing)
  core() {
    // dog-leg stair in the well (x 8.33-10.71, y 1.70-3.95): down on the east, up on the west
    const run = 0.28, rise = 0.17;
    for (let i = 0; i < 7; i++) {
      const yA = 3.92 - i * run, yB = yA - run;
      this.prism('core', 'stoneFloor', rect(9.6, yB, 10.66, yA), -(i + 1) * rise - 0.2, -(i + 1) * rise);
      this.prism('core', 'stoneFloor', rect(8.38, yB, 9.44, yA), (i + 1) * rise - 0.2, (i + 1) * rise);
    }
    this.prism('core', 'plaster', rect(9.44, 1.75, 9.6, 3.95), -1.4, 2.4);
    // well edge rail on the landing
    this.prism('core', 'steel', rect(9.6, 3.95, 10.7, 3.99), 0.95, 0.99);
    for (let x = 9.65; x <= 10.66; x += 0.12) this.prism('core', 'steel', rect(x, 3.96, x + 0.014, 3.98), 0, 0.95);
    // lift on the west side of the landing, doors facing east
    this.prism('core', 'steelPanel', rect(8.26, 4.35, 8.33, 5.55), 0, 2.15);
    this.addLines('core', [8.335, 0.01, -4.95, 8.335, 2.14, -4.95], 1.0);
  }

  // ---------------- materials and lines
  materialFor(room, kind) {
    const key = `${room}|${kind}`;
    if (this.mats[key]) return this.mats[key];
    const r = this.rooms.get(room);
    let m;
    switch (kind) {
      case 'marble':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#fff7ec', roughness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.1, envMapIntensity: 0.55 }), r, { tiles: { size: [0.6, 0.6], scale: 0.36 } });
        break;
      case 'stoneFloor':
      case 'terraceFloor':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#efebe3', roughness: 0.35 }), r, { tiles: { size: [0.6, 0.6], scale: 0.42 } });
        break;
      case 'woodFloor':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#a19b95', roughness: 0.6 }), r);
        break;
      case 'inlay':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.06 }), r, { ink: new THREE.Color('#d8d3c9'), shade: 0 });
        break;
      case 'plaster':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.92 }), r);
        break;
      case 'planter':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.85 }), r);
        break;
      case 'ceiling':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#f6f5f2', roughness: 0.95, side: THREE.FrontSide }), r, { shade: 0.03 });
        break;
      case 'steel':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#1d1d1c', metalness: 0.55, roughness: 0.42 }), r, { ink: INK, shade: 0 });
        break;
      case 'steelPanel':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#7d7a74', metalness: 0.7, roughness: 0.35 }), r);
        break;
      case 'brass':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.3 }), r, { ink: INK, shade: 0 });
        break;
      case 'soil':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#221c17', roughness: 1 }), r, { ink: new THREE.Color('#dcd7cd') });
        break;
      case 'whiteSteel':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#f2f1ee', metalness: 0.1, roughness: 0.5 }), r);
        break;
      case 'glass':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.2 }), r, { inkAlpha: 0 });
        break;
      case 'oak':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#b39880', roughness: 0.55 }), r);
        break;
      case 'teak':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#8f8578', roughness: 0.75 }), r);
        break;
      case 'lacquer':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#f1efea', roughness: 0.3, clearcoat: 0.35 }), r);
        break;
      case 'ceramic':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.2 }), r);
        break;
      case 'darkOak':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 0.42 }), r);
        break;
      case 'paperStack':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#e9e2d3', roughness: 0.9 }), r);
        break;
      case 'plinth':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#f5f4f0', roughness: 0.55 }), r);
        break;
      case 'canvasEdge':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#ede7da', roughness: 0.9 }), r);
        break;
      case 'aubergine':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#4a1220', roughness: 0.16, clearcoat: 0.8, clearcoatRoughness: 0.08 }), r);
        break;
      case 'worktop':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 0.42, metalness: 0.15 }), r);
        break;
      case 'stainless':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#b9b7b2', metalness: 0.75, roughness: 0.32 }), r);
        break;
      case 'whiteGoods':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#ecebe7', roughness: 0.35 }), r);
        break;
      case 'blackGloss':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.08 }), r, { ink: INK, shade: 0 });
        break;
      case 'wenge':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#4b3a2e', roughness: 0.5 }), r);
        break;
      case 'shelfWood':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#7b3f22', roughness: 0.45 }), r);
        break;
      case 'bottle':
        m = revealMaterial(new THREE.MeshPhysicalMaterial({ color: '#8fc3e8', roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.55, depthWrite: false }), r, { inkAlpha: 0.6 });
        break;
      case 'slab':
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#d9d5cc', roughness: 0.9 }), r);
        break;
      default:
        m = revealMaterial(new THREE.MeshStandardMaterial({ color: '#eeeeee' }), r);
    }
    m.userData.kind = kind;
    if (kind !== 'glass') { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }
    if (kind === 'inlay') { m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
    this.mats[key] = m;
    return m;
  }

  lineMat(room, width = 1.1) {
    const k = `line|${room}|${width}`;
    if (!this.mats[k]) {
      const m = revealLineMaterial(this.rooms.get(room), { width });
      this.lineMats.push(m);
      this.mats[k] = m;
    }
    return this.mats[k];
  }
  addLines(room, arr, width = 1.1) {
    const k = `${room || 'none'}|__lines${width}`;
    if (!this.buckets.has(k)) this.buckets.set(k, new Bucket());
    const b = this.buckets.get(k);
    for (let i = 0; i < arr.length; i++) b.lines.push(arr[i]);
  }

  flush() {
    const ARCH = new Set(['plaster', 'planter', 'steel', 'glass', 'whiteSteel', 'lacquer', 'oak', 'ceramic', 'aubergine', 'worktop', 'stainless', 'whiteGoods', 'blackGloss', 'wenge', 'shelfWood', 'steelPanel']);
    for (const [k, b] of this.buckets) {
      const [room, mat] = k.split('|');
      if (b.pos.length) {
        const m = new THREE.Mesh(b.geometry(), this.materialFor(room, mat));
        m.castShadow = mat !== 'glass' && mat !== 'inlay';
        m.receiveShadow = mat !== 'glass';
        if (mat === 'glass') m.renderOrder = 5;
        if (ARCH.has(mat)) { m.material.clippingPlanes = [this.cut]; m.material.clipShadows = true; }
        this.group.add(m);
      }
      if (b.lines.length) {
        const width = mat.startsWith('__lines') ? parseFloat(mat.slice(7)) : 1.1;
        const g = new LineSegmentsGeometry().setPositions(b.lines);
        const lm = this.lineMat(room, width);
        lm.clippingPlanes = [this.cut];
        const ls = new LineSegments2(g, lm);
        ls.renderOrder = 3;
        this.group.add(ls);
      }
    }
    for (const m of Object.values(this.mats)) {
      if (m.userData?.kind && ['oak', 'brass', 'bottle', 'steel'].includes(m.userData.kind)) { m.clippingPlanes = [this.cut]; m.clipShadows = true; }
    }
  }
}

export function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
// offset a closed polyline by d (mitred corners)
function offsetLoop(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const u1 = norm2([b[0] - a[0], b[1] - a[1]]), u2 = norm2([c[0] - b[0], c[1] - b[1]]);
    const n1 = [-u1[1], u1[0]], n2 = [-u2[1], u2[0]];
    const m = norm2([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = d / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]);
    out.push([b[0] + m[0] * k, b[1] + m[1] * k]);
  }
  return out;
}
function norm2(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
function shapeOf(poly, holes = []) {
  const s = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
  for (const h of holes || []) s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
  return s;
}
function centroidOf(p) { return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; }
function flipWinding(g) {
  const pos = g.attributes.position, nrm = g.attributes.normal;
  if (g.index) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.index.needsUpdate = true;
  }
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, -1, 0);
  nrm.needsUpdate = true;
  return g;
}
export { INTERIOR, inside };
