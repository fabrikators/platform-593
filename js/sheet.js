// The sheet: paper, frame, title block, room names, dimension strings and door
// swings. These are drawing conventions laid on the model's own floor; they fade
// once the walls start to rise.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PLAN } from './plan-data.js';
import { PAPER, INK } from './reveal.js';
import { STR, n } from './i18n.js';

export const SHEET = { x0: -3.4, x1: 33.6, y0: -8.3, y1: 17.9 }; // plan frame, ~A-series ratio

const INK_CSS = '#171614';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const CAPTION_AT = { covered: [23.7, 3.45] };
const TB = { x0: 22.4, x1: 33.0, y0: -7.7, y1: -3.4 };   // title block
const SB = { x0: 15.4, y: -6.9 };                         // scale bar

export class Sheet {
  constructor(lang = 'en') {
    this.group = new THREE.Group();
    this.textGroup = new THREE.Group();
    this.group.add(this.textGroup);
    this.fadeMats = [];
    this.textMats = [];
    this.lineMats = [];
    this.fade = 1;
    this.dimTexts = [];
    this.paper();
    this.frame();
    this.dims();
    this.swings();
    this.titleBlock();
    this.scaleBar();
    this.relabel(lang);
  }

  // all lettering, in one language; called again when the visitor switches
  relabel(lang) {
    for (const m of this.textGroup.children) { m.geometry.dispose(); if (!m.material.userData.keepMap) m.material.map.dispose(); m.material.dispose(); }
    this.textGroup.clear();
    this.textMats = [];
    const L = STR[lang];
    for (const [k, r] of Object.entries(PLAN.rooms)) {
      const [x, y] = r.caption;
      const big = r.area > 15;
      const small = r.area < 3;
      const lines = (L.rooms[k] ?? r.label).split('\n').filter(Boolean);
      const [cx, cy] = CAPTION_AT[k] || [x, y];
      const lh = big ? 0.5 : small ? 0.24 : 0.32;
      lines.forEach((ln, i) => this.text(ln, cx, cy + 0.18 + (lines.length - 1 - i) * lh, { size: big ? 0.36 : small ? 0.17 : 0.22, weight: 600, track: 0.12 }));
      this.text(`${n(r.area, 1, lang)} m²`, cx, cy - (big ? 0.32 : 0.16), { size: big ? 0.26 : small ? 0.13 : 0.17, weight: 400, track: 0.02, family: MONO });
    }
    for (const d of this.dimTexts) this.text(n(d.value, 2, lang), d.x, d.y, { size: 0.22, weight: 400, track: 0.02, family: MONO, rot: d.rot });
    const { x0, y0, y1 } = TB;
    this.signature(x0 + 0.42, y1 - 0.88);
    this.text('593', x0 + 4.75, y1 - 0.98, { size: 0.62, weight: 500, track: 0.04, align: 'left', h: -0.195, family: MONO });
    this.text(L.sheet.place, x0 + 0.45, y1 - 1.75, { size: 0.3, weight: 400, track: 0.02, align: 'left', h: -0.195 });
    this.text(L.sheet.cut, x0 + 0.45, y1 - 2.35, { size: 0.24, weight: 400, track: 0.02, align: 'left', h: -0.195, family: MONO });
    this.text(L.sheet.source, x0 + 0.45, y0 + 0.68, { size: 0.2, weight: 400, track: 0.02, align: 'left', h: -0.195, family: MONO });
    this.text(L.sheet.no, x0 + 6.6, y0 + 0.68, { size: 0.22, weight: 500, track: 0.08, align: 'left', h: -0.195, family: MONO });
    this.text('0', SB.x0, SB.y - 0.5, { size: 0.22, family: MONO, h: -0.195 });
    this.text('5 m', SB.x0 + 5, SB.y - 0.5, { size: 0.22, family: MONO, h: -0.195 });
    this.setFade(this.fade);
  }

  paper() {
    const g = new THREE.PlaneGeometry(2000, 2000);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: PAPER, depthWrite: true, toneMapped: false }));
    m.position.y = -0.215;
    m.renderOrder = -1;
    this.paperMesh = m;
    this.group.add(m);
  }

  lineSet(arr, width = 1, opacity = 1) {
    const m = new LineMaterial({ color: INK.getHex(), linewidth: width, transparent: true, depthWrite: false, opacity, toneMapped: false });
    m.userData.baseOpacity = opacity;
    m.userData.baseWidth = width;
    const ls = new LineSegments2(new LineSegmentsGeometry().setPositions(arr), m);
    ls.renderOrder = 4;
    this.lineMats.push(m);
    this.fadeMats.push(m);
    this.group.add(ls);
    return ls;
  }

  text(str, x, y, opts = {}) {
    const size = opts.size ?? 0.35;           // cap height-ish in metres
    const weight = opts.weight ?? 500;
    const family = opts.family ?? 'Inter, Helvetica, Arial, sans-serif';
    const track = opts.track ?? 0.08;          // letter spacing (em)
    const px = 120;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `${weight} ${px}px ${family}`;
    ctx.font = font;
    const chars = [...str];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const tw = widths.reduce((s, w) => s + w, 0) + track * px * (chars.length - 1);
    c.width = Math.ceil(tw + px * 0.4);
    c.height = Math.ceil(px * 1.35);
    ctx.font = font;
    ctx.fillStyle = opts.color || INK_CSS;
    ctx.textBaseline = 'middle';
    let cx = px * 0.2;
    chars.forEach((ch, i) => { ctx.fillText(ch, cx, c.height / 2); cx += widths[i] + track * px; });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const hM = size * 1.35 / 0.72;
    const wM = (c.width / c.height) * hM;
    const g = new THREE.PlaneGeometry(wM, hM);
    const anchor = opts.align === 'left' ? wM / 2 - (px * 0.2 / c.width) * wM : opts.align === 'right' ? -wM / 2 + (px * 0.2 / c.width) * wM : 0;
    g.translate(anchor, 0, 0);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1, toneMapped: false });
    m.userData.baseOpacity = 1;
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, opts.h ?? 0.006, -y);
    if (opts.rot) mesh.rotation.y = opts.rot;
    mesh.renderOrder = 4;
    this.textMats.push(m);
    this.textGroup.add(mesh);
    return mesh;
  }

  // the gallery's own mark: the handwritten Platform signature from its 1988-89 posters
  signature(x, y) {
    const hM = 0.95, wM = hM * (1320 / 347);
    const g = new THREE.PlaneGeometry(wM, hM);
    g.translate(wM / 2, 0, 0);
    g.rotateX(-Math.PI / 2);
    if (!this.sigTex) {
      this.sigTex = new THREE.TextureLoader().load('assets/brand/signature.png', () => this.onTexture?.());
      this.sigTex.colorSpace = THREE.SRGBColorSpace;
      this.sigTex.anisotropy = 8;
    }
    const m = new THREE.MeshBasicMaterial({ map: this.sigTex, transparent: true, depthWrite: false, toneMapped: false });
    m.userData.baseOpacity = 1;
    m.userData.keepMap = true;
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, -0.195, -y);
    mesh.renderOrder = 4;
    this.textMats.push(m);
    this.textGroup.add(mesh);
  }

  frame() {
    const { x0, x1, y0, y1 } = SHEET;
    const box = (a, b, c, d, h = -0.2) => [a, h, -b, c, h, -b, c, h, -b, c, h, -d, c, h, -d, a, h, -d, a, h, -d, a, h, -b];
    this.lineSet(box(x0, y0, x1, y1), 1.0, 0.9);
    this.lineSet(box(x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6), 2.2, 1);
  }

  dims() {
    const arr = [];
    for (const d of PLAN.dims) {
      const [ax, ay] = d.a, [bx, by] = d.b;
      const L = Math.hypot(bx - ax, by - ay);
      const u = [(bx - ax) / L, (by - ay) / L], n = [-u[1], u[0]];
      const o = d.off;
      const A = [ax + n[0] * o, ay + n[1] * o], B = [bx + n[0] * o, by + n[1] * o];
      const h = 0.006;
      arr.push(A[0], h, -A[1], B[0], h, -B[1]);
      // extension lines
      if (Math.abs(o) > 0.05) {
        const s = Math.sign(o);
        arr.push(ax + n[0] * s * 0.15, h, -(ay + n[1] * s * 0.15), A[0] + n[0] * s * 0.2, h, -(A[1] + n[1] * s * 0.2));
        arr.push(bx + n[0] * s * 0.15, h, -(by + n[1] * s * 0.15), B[0] + n[0] * s * 0.2, h, -(B[1] + n[1] * s * 0.2));
      }
      // architectural ticks
      const t = 0.17;
      const dg = [(u[0] + n[0]) * t, (u[1] + n[1]) * t];
      for (const P of [A, B]) arr.push(P[0] - dg[0], h, -(P[1] - dg[1]), P[0] + dg[0], h, -(P[1] + dg[1]));
      const mid = [(A[0] + B[0]) / 2 + n[0] * 0.26 * (o >= 0 ? 1 : -1), (A[1] + B[1]) / 2 + n[1] * 0.26 * (o >= 0 ? 1 : -1)];
      let ang = Math.atan2(u[1], u[0]);
      if (ang > Math.PI / 2 + 0.01) ang -= Math.PI;
      if (ang < -Math.PI / 2 + 0.01) ang += Math.PI;
      this.dimTexts.push({ value: parseFloat(d.text), x: mid[0], y: mid[1], rot: ang });
    }
    this.lineSet(arr, 0.8, 0.85);
  }

  swings() {
    const arr = [];
    for (const w of PLAN.walls) {
      for (const o of w.open) {
        if (!o.hinge) continue;
        const [hx, hy] = o.hinge;
        const r = o.s1 - o.s0;
        const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
        const u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
        const sh = (hx - w.a[0]) * u[0] + (hy - w.a[1]) * u[1];
        const far = Math.abs(sh - o.s0) < Math.abs(sh - o.s1) ? o.s1 : o.s0;
        const fp = [w.a[0] + u[0] * far, w.a[1] + u[1] * far];
        const a0 = Math.atan2(fp[1] - hy, fp[0] - hx);
        let a1 = Math.atan2(o.swing[1], o.swing[0]);
        let dA = a1 - a0;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        const N = 20;
        for (let i = 0; i < N; i++) {
          const t0 = a0 + (dA * i) / N, t1 = a0 + (dA * (i + 1)) / N;
          arr.push(hx + Math.cos(t0) * r, 0.005, -(hy + Math.sin(t0) * r), hx + Math.cos(t1) * r, 0.005, -(hy + Math.sin(t1) * r));
        }
      }
    }
    this.lineSet(arr, 0.7, 0.75);
  }

  titleBlock() {
    const { x0, x1, y0, y1 } = TB;
    const h = -0.2;
    const L = [];
    const seg = (a, b, c, d) => L.push(a, h, -b, c, h, -d);
    seg(x0, y0, x1, y0); seg(x1, y0, x1, y1); seg(x1, y1, x0, y1); seg(x0, y1, x0, y0);
    seg(x0, y0 + 1.35, x1, y0 + 1.35);
    seg(x0 + 6.2, y0, x0 + 6.2, y0 + 1.35);
    this.lineSet(L, 1.2, 1);
  }

  scaleBar() {
    const { x0, y } = SB, h = -0.2;
    const fills = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.PlaneGeometry(1, 0.22);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ color: i % 2 ? PAPER : INK, transparent: true, depthWrite: false, toneMapped: false });
      m.userData.baseOpacity = 1;
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x0 + i + 0.5, h + 0.004, -y);
      this.fadeMats.push(m);
      this.group.add(mesh);
      fills.push(mesh);
    }
    const L = [x0, h + 0.005, -(y - 0.11), x0 + 5, h + 0.005, -(y - 0.11), x0, h + 0.005, -(y + 0.11), x0 + 5, h + 0.005, -(y + 0.11),
      x0, h + 0.005, -(y - 0.11), x0, h + 0.005, -(y + 0.11), x0 + 5, h + 0.005, -(y - 0.11), x0 + 5, h + 0.005, -(y + 0.11)];
    this.lineSet(L, 1, 1);
  }

  setFade(f) {
    this.fade = f;
    for (const m of [...this.fadeMats, ...this.textMats]) {
      m.opacity = (m.userData.baseOpacity ?? 1) * f;
      m.visible = f > 0.002;
    }
  }
}
