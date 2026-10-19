// spaces.html: Platform 593 shown as one of Fabrika's spaces. Text in English or French (js/spaces-i18n.js),
// address and contact from data/spaces.json, areas and the plan straight from the building model
// (js/plan-data.js), so the page, the walk and the photo map always agree.
import { PLAN } from './plan-data.js';
import { KITCHEN, CORRIDOR } from './interiors.js';
import { W } from './spaces-i18n.js';
import { initialLang, rememberLang, n } from './i18n.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let lang = initialLang();
let info = {};
let layout = 'studio';
const L = () => W[lang];
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const val = (v) => (v == null || v === '' ? null : typeof v === 'object' ? (v[lang] ?? v.en ?? null) : String(v));
const m2 = (v, d = 1) => `${n(v, d, lang)} m²`;

// ---------------- the rooms, in the order the table lists them
const ROWS = [
  { key: 'hall', rooms: ['hall'] },
  { key: 'big', rooms: ['big'] },
  { key: 'kitchen', rooms: ['kitchen'] },
  { key: 'dressing', rooms: ['dressing'] },
  { key: 'bath', rooms: ['bath'] },
  { key: 'wc', rooms: ['wc'] },
  { key: 'storage', rooms: ['storeN', 'storeS', 'closet'] },
  { key: 'covered', rooms: ['covered'], out: true },
  { key: 'terrace', rooms: ['terrace'], out: true },
];
const area = (row) => row.rooms.reduce((s, r) => s + (PLAN.rooms[r]?.area || 0), 0);
const INTERIOR = ROWS.filter((r) => !r.out).reduce((s, r) => s + area(r), 0);
const OUTDOOR = ROWS.filter((r) => r.out).reduce((s, r) => s + area(r), 0);

// ---------------- the photographs shown, in order
const PHOTOS = ['01', '09', '03', '05', '08', '07', '06', '31', '61', '21', '81', '88'];
let SIZES = {};

// ---------------- the plan, drawn from the model: x east, y north (metres) -> SVG user units
const NS = 'http://www.w3.org/2000/svg';
const X0 = 0.4, X1 = 29.5, YT = 14.6, YB = -3.5;
const sx = (x) => +(x - X0).toFixed(3);
const sy = (y) => +(YT - y).toFixed(3);
function el(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const ring = (pts) => `M${pts.map(([x, y]) => `${sx(x)} ${sy(y)}`).join('L')}Z`;
const rectPts = (a) => [[a.x0, a.y0], [a.x1, a.y0], [a.x1, a.y1], [a.x0, a.y1]];

const LABELS = {
  hall: [17.0, 8.25], big: null, kitchen: null, covered: null, terrace: null, dressing: null, bath: null, core: null,
  storeN: null, storeS: null, wc: null,
};
const SMALL = new Set(['storeN', 'storeS', 'wc', 'bath', 'dressing']);
const NO_AREA = new Set(['core', 'storeN', 'storeS', 'wc']);

function drawPlan(host, { live = false, layoutKey = null, uid = 'p' } = {}) {
  const T = L();
  host.textContent = '';
  const svg = el('svg', { viewBox: `0 0 ${(X1 - X0).toFixed(2)} ${(YT - YB).toFixed(2)}`, role: 'img', 'aria-labelledby': `${uid}-t ${uid}-d` }, host);
  el('title', { id: `${uid}-t` }, svg, T.space.planTitle);
  el('desc', { id: `${uid}-d` }, svg, T.space.planDesc);
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: `${uid}-hatch`, width: 0.3, height: 0.3, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 0.3, class: 'hatch-line' }, pat);

  // rooms: a live room answers the table and the pointer
  const gRooms = el('g', {}, svg);
  const rowOf = {};
  ROWS.forEach((row) => row.rooms.forEach((r) => { rowOf[r] = row; }));
  for (const [key, room] of Object.entries(PLAN.rooms)) {
    if (key === 'none' || key === 'top') continue;
    const d = [ring(room.poly), ...(room.holes || []).map(ring)].join('');
    if (key === 'core') { el('path', { d, fill: `url(#${uid}-hatch)` }, gRooms); continue; }
    const row = rowOf[key];
    const cls = ['room', room.outdoor ? 'room--out' : '', live && row ? 'room--live' : ''].filter(Boolean).join(' ');
    const p = el('path', { d, 'fill-rule': 'evenodd', class: cls, 'data-room': key }, gRooms);
    if (live && row) {
      p.addEventListener('pointerenter', () => highlight(row.key, true));
      p.addEventListener('pointerleave', () => highlight(row.key, false));
      p.addEventListener('click', () => $(`.room-btn[data-row="${row.key}"]`)?.focus());
    }
  }

  // fixtures that belong to the building (no loose furniture)
  const gFix = el('g', {}, svg);
  // the WC, basins and shower from the model; the kitchen and the corridor shelving as they stand in 2026
  for (const f of PLAN.fixtures) if (!['table', 'kitchen', 'cabinet'].includes(f.kind)) el('path', { d: ring(f.poly), class: 'fix' }, gFix);
  const K = KITCHEN, kw = K.wall, kd = K.depth, C = CORRIDOR;
  const fix = (x0, y0, x1, y1) => el('path', { d: ring(rectPts({ x0, y0, x1, y1 })), class: 'fix' }, gFix);
  fix(kw.w, kw.s, kw.w + kd, kw.n);
  fix(kw.w + kd, kw.s, K.southEnd, kw.s + kd);
  fix(kw.w + kd, kw.n - kd, K.fridge.x0, kw.n);
  fix(K.fridge.x0, K.fridge.y0, K.fridge.x1, kw.n - 0.02);
  if (!layoutKey) fix(K.table.x0, K.table.y0, K.table.x1, K.table.y1);
  fix(C.x0, C.yFront, C.x1, C.yBack);

  // walls, then the openings cut through them
  const gWalls = el('g', {}, svg);
  for (const w of PLAN.walls) el('path', { d: ring(w.quad), class: `wall${w.kind === 'parapet' ? ' wall--parapet' : w.kind === 'planter' ? ' wall--planter' : ''}` }, gWalls);
  const gOpen = el('g', {}, svg);
  for (const w of PLAN.walls) {
    const L0 = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const u = [(w.b[0] - w.a[0]) / L0, (w.b[1] - w.a[1]) / L0], nrm = [-u[1], u[0]];
    const at = (s, off = 0) => [w.a[0] + u[0] * s + nrm[0] * off, w.a[1] + u[1] * s + nrm[1] * off];
    const half = w.t / 2 + 0.01;
    for (const o of w.open) {
      el('path', { d: ring([at(o.s0, -half), at(o.s1, -half), at(o.s1, half), at(o.s0, half)]), class: 'gap' }, gOpen);
      if (o.kind === 'window') {
        for (const off of [-w.t / 4, w.t / 4]) {
          const [p, q] = [at(o.s0, off), at(o.s1, off)];
          el('line', { x1: sx(p[0]), y1: sy(p[1]), x2: sx(q[0]), y2: sy(q[1]), class: 'win' }, gOpen);
        }
      } else if ((o.kind === 'door' || o.kind === 'front') && o.hinge && o.swing) {
        const leaf = o.s1 - o.s0;
        const p0 = at(o.s0), p1 = at(o.s1);
        const dist = (p) => Math.hypot(p[0] - o.hinge[0], p[1] - o.hinge[1]);
        const hinge = dist(p0) < dist(p1) ? p0 : p1;
        const closed = hinge === p0 ? p1 : p0;
        const open = [hinge[0] + o.swing[0] * leaf, hinge[1] + o.swing[1] * leaf];
        el('line', { x1: sx(hinge[0]), y1: sy(hinge[1]), x2: sx(open[0]), y2: sy(open[1]), class: 'leaf' }, gOpen);
        const v1 = [sx(closed[0]) - sx(hinge[0]), sy(closed[1]) - sy(hinge[1])];
        const v2 = [sx(open[0]) - sx(hinge[0]), sy(open[1]) - sy(hinge[1])];
        const sweep = v1[0] * v2[1] - v1[1] * v2[0] > 0 ? 1 : 0;
        el('path', { d: `M${sx(closed[0])} ${sy(closed[1])}A${leaf.toFixed(3)} ${leaf.toFixed(3)} 0 0 ${sweep} ${sx(open[0])} ${sy(open[1])}`, class: 'swing' }, gOpen);
      }
    }
  }

  // the black line in the floor
  el('path', { d: ring(PLAN.inlay), class: 'inlay' }, svg);

  // furniture of a layout, over the rooms
  if (layoutKey) drawLayout(svg, layoutKey);

  // room names and areas
  const gLab = el('g', {}, svg);
  const names = { ...T.rooms, terrace: T.rooms.terraceShort, covered: T.rooms.coveredPlan };
  for (const key of Object.keys(LABELS)) {
    const room = PLAN.rooms[key];
    if (!room) continue;
    // on a layout, zones name the rooms they take; only the rest keep their names
    if (layoutKey && !['covered', 'terrace', 'core', ...(layoutKey === 'host' ? [] : ['kitchen'])].includes(key)) continue;
    const [x, y] = LABELS[key] || room.caption;
    const small = SMALL.has(key);
    // a name may run over two lines ('\n'): the lines centre on the room's caption point
    const lines = names[key].split('\n'), lh = small ? 0.32 : 0.44;
    const t = el('text', { x: sx(x), y: sy(y) - ((lines.length - 1) * lh) / 2, class: `label${small ? ' label--small' : ''}` }, gLab);
    lines.forEach((line, i) => el('tspan', { x: sx(x), dy: i ? lh : 0 }, t, line));
    if (!layoutKey && !NO_AREA.has(key)) el('text', { x: sx(x), y: sy(y) + ((lines.length - 1) * lh) / 2 + (small ? 0.36 : 0.48), class: 'label label--area' }, gLab, m2(room.area));
  }

  // north and a 5 m scale
  const gN = el('g', {}, svg);
  const nx = sx(2.0), ny = sy(-1.4);
  el('path', { d: `M${nx} ${ny - 0.75}L${nx + 0.3} ${ny + 0.3}L${nx} ${ny + 0.1}L${nx - 0.3} ${ny + 0.3}Z`, class: 'north' }, gN);
  el('text', { x: nx, y: ny + 0.85, class: 'north', 'text-anchor': 'middle' }, gN, T.space.north);
  const bx = sx(3.4), by = sy(-1.9);
  for (let i = 0; i < 5; i++) el('rect', { x: bx + i, y: by, width: 1, height: 0.16, class: i % 2 ? 'scale-bar scale-bar--w' : 'scale-bar' }, gN);
  el('text', { x: bx, y: by + 0.62, class: 'scale' }, gN, '0');
  el('text', { x: bx + 5, y: by + 0.62, class: 'scale', 'text-anchor': 'end' }, gN, T.space.scale);
  return svg;
}

// ---------------- three layouts, drawn on the plan (plan metres)
const DESK = [1.4, 0.7];
function bench(x0, y0, n1, rows = 2, chairs = 'out') {
  const out = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i < n1; i++) {
    const d = { kind: 'desk', x0: x0 + i * DESK[0], y0: y0 + r * DESK[1], x1: x0 + (i + 1) * DESK[0], y1: y0 + (r + 1) * DESK[1] };
    d.chairY = rows === 1 ? (chairs === 'north' ? d.y1 + 0.32 : d.y0 - 0.32) : r === 0 ? d.y0 - 0.32 : d.y1 + 0.32;
    out.push(d);
  }
  return out;
}
const zone = (x0, y0, x1, y1, label) => ({ kind: 'zone', x0, y0, x1, y1, label });
const LAYOUTS = {
  studio: [
    ...bench(7.6, 9.55, 4), ...bench(15.0, 10.0, 2), ...bench(15.0, 6.3, 2),
    zone(15.9, 2.15, 21.0, 5.1, 'meeting'), { kind: 'tbl', x0: 16.4, y0: 2.6, x1: 18.4, y1: 3.5 },
    zone(2.25, 6.85, 5.45, 12.05, 'quiet'), { kind: 'tbl', x0: 3.0, y0: 8.9, x1: 4.8, y1: 9.8 },
    zone(19.45, 9.45, 21.25, 11.95, 'lounge'), { kind: 'sofa', x0: 20.35, y0: 9.9, x1: 21.05, y1: 11.6 }, { kind: 'sofa', x0: 19.6, y0: 11.25, x1: 20.3, y1: 11.85 },
  ],
  team: [
    ...bench(7.6, 9.55, 4), ...bench(15.0, 10.0, 2), ...bench(15.0, 6.3, 2),
    zone(2.25, 6.85, 5.45, 12.05, 'office'), ...bench(2.8, 8.0, 1),
    zone(15.9, 2.15, 21.0, 5.1, 'office'), ...bench(16.4, 2.4, 3, 1, 'north'),
    zone(19.35, 5.55, 20.95, 7.35, 'table'), { kind: 'tbl', x0: 19.65, y0: 5.85, x1: 20.65, y1: 7.05 },
  ],
  host: [
    ...bench(7.6, 9.55, 4),
    zone(2.25, 6.85, 5.45, 12.05, 'quiet'), { kind: 'tbl', x0: 3.0, y0: 8.9, x1: 4.8, y1: 9.8 },
    zone(14.6, 5.5, 20.8, 11.9, 'event'),
    zone(21.75, 0.6, 23.7, 11.1, 'foyer'),
    zone(8.55, -1.65, 12.7, 1.3, 'catering'),
  ],
};
const SUMMARY = {
  studio: (T, d) => [T.layouts.desks(d), T.layouts.meeting, T.layouts.quiet, T.layouts.lounge],
  team: (T, d) => [T.layouts.desks(d), T.layouts.offices(2), T.layouts.meetingTable],
  host: (T, d) => [T.layouts.desks(d), T.layouts.eventFloor],
};
function drawLayout(svg, key) {
  const T = L();
  const g = el('g', {}, svg);
  const items = LAYOUTS[key];
  for (const it of items.filter((i) => i.kind === 'zone')) {
    el('path', { d: ring(rectPts(it)), class: 'zone' }, g);
    el('text', { x: sx(it.x0) + 0.18, y: sy(it.y1) + 0.46, class: 'zone-label' }, g, T.layouts.zone[it.label]);
  }
  for (const it of items) {
    if (it.kind === 'desk') {
      el('path', { d: ring(rectPts(it)), class: 'desk' }, g);
      el('circle', { cx: sx((it.x0 + it.x1) / 2), cy: sy(it.chairY), r: 0.19, class: 'chair' }, g);
    } else if (it.kind === 'tbl') el('path', { d: ring(rectPts(it)), class: 'tbl' }, g);
    else if (it.kind === 'sofa') el('path', { d: ring(rectPts(it)), class: 'sofa' }, g);
  }
}
const deskCount = (key) => LAYOUTS[key].filter((i) => i.kind === 'desk').length;

// ---------------- the areas table, linked to the plan
function highlight(rowKey, on) {
  const row = ROWS.find((r) => r.key === rowKey);
  if (!row) return;
  for (const r of row.rooms) $$(`#plan [data-room="${r}"]`).forEach((p) => p.classList.toggle('is-on', on));
  $(`.room-btn[data-row="${rowKey}"]`)?.classList.toggle('is-on', on);
}
function renderAreas() {
  const T = L();
  const body = $('#areas-body');
  body.textContent = '';
  let firstOut = true;
  for (const row of ROWS) {
    const tr = document.createElement('tr');
    if (row.out && firstOut) { tr.className = 'first-out'; firstOut = false; }
    const th = document.createElement('th');
    th.scope = 'row';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `room-btn${row.out ? ' is-out' : ''}`;
    b.dataset.row = row.key;
    b.textContent = T.rooms[row.key];
    for (const [ev, on] of [['pointerenter', true], ['pointerleave', false], ['focus', true], ['blur', false]]) b.addEventListener(ev, () => highlight(row.key, on));
    th.appendChild(b);
    const td = document.createElement('td');
    td.textContent = m2(area(row));
    tr.append(th, td);
    body.appendChild(tr);
  }
  $('#areas-total').textContent = m2(INTERIOR + OUTDOOR, 0);
  $('[data-fig="interior"]').textContent = m2(INTERIOR, 0);
  $('[data-fig="terraces"]').textContent = m2(OUTDOOR, 0);
  $('[data-fig="hall"]').textContent = m2(PLAN.rooms.hall.area, 1);
}

// ---------------- layouts
function renderLayout() {
  const T = L();
  for (const b of $$('.tab')) b.setAttribute('aria-pressed', String(b.dataset.layout === layout));
  $('#layout-text').textContent = T.layouts[layout].text;
  const parts = SUMMARY[layout](T, deskCount(layout));
  const count = $('#layout-count');
  count.textContent = '';
  count.append(`${T.layouts.asDrawn} `);
  const strong = document.createElement('strong');
  strong.textContent = parts[0];
  count.append(strong, ` · ${parts.slice(1).join(' · ')}`);
  drawPlan($('#layout-plan'), { layoutKey: layout, uid: 'lp' });
}

// ---------------- gallery and lightbox
let shown = 0;
function renderGallery() {
  const T = L();
  const ul = $('#gallery');
  ul.textContent = '';
  PHOTOS.forEach((id, i) => {
    const [title, sub] = T.gallery.items[id];
    const [w, h] = SIZES[id] || [1600, 900];
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shot';
    b.setAttribute('aria-label', `${T.gallery.open}: ${title}`);
    const img = document.createElement('img');
    img.src = `assets/photos/thumbs/${id}.jpg`;
    img.srcset = `assets/photos/thumbs/${id}.jpg 360w, assets/photos/${id}.jpg ${w}w`;
    img.sizes = '(max-width: 700px) 100vw, 400px';
    img.width = 360; img.height = Math.round((360 * h) / w);
    img.loading = 'lazy';
    img.alt = '';
    const cap = document.createElement('span');
    cap.className = 'shot__cap';
    const t = document.createElement('span'); t.className = 'shot__t'; t.textContent = title;
    const s = document.createElement('span'); s.className = 'shot__s'; s.textContent = sub;
    cap.append(t, s);
    b.append(img, cap);
    b.addEventListener('click', () => openPhoto(i));
    li.appendChild(b);
    ul.appendChild(li);
  });
}
const lb = $('#lightbox');
function showPhoto(i) {
  const T = L();
  shown = (i + PHOTOS.length) % PHOTOS.length;
  const id = PHOTOS[shown];
  const [title, sub] = T.gallery.items[id];
  const img = $('#lb-img');
  img.src = `assets/photos/${id}.jpg`;
  img.alt = `${title}. ${sub}`;
  $('#lb-title').textContent = title;
  $('#lb-sub').textContent = sub;
  $('#lb-n').textContent = T.gallery.count(shown + 1, PHOTOS.length);
  for (const k of [shown - 1, shown + 1]) new Image().src = `assets/photos/${PHOTOS[(k + PHOTOS.length) % PHOTOS.length]}.jpg`;
}
function openPhoto(i) {
  showPhoto(i);
  if (!lb.open) lb.showModal();
}
lb.addEventListener('click', (e) => {
  const act = e.target.closest('[data-lb]')?.dataset.lb;
  if (act === 'prev') showPhoto(shown - 1);
  else if (act === 'next') showPhoto(shown + 1);
  else if (act === 'close' || e.target === lb) lb.close();
});
lb.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(shown - 1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(shown + 1); }
});
lb.addEventListener('close', () => { $$('.shot')[shown]?.focus({ preventScroll: true }); });

// ---------------- what is here, Fabrika, location, contact: what data/spaces.json says (nothing shown when empty)
function renderInfo() {
  const T = L();
  const inPlace = $('#in-place');
  inPlace.textContent = '';
  for (const item of T.here.items) { const li = document.createElement('li'); li.textContent = item; inPlace.appendChild(li); }
  const fab = val(info.fabrikaUrl);
  $('#fabrika-link').hidden = !fab;
  if (fab) $('#fabrika-link').href = fab;
  const address = val(info.address);
  $('#address').hidden = !address;
  $('#address').textContent = address || '';
  const map = val(info.mapUrl);
  $('#map-wrap').hidden = !map;
  if (map) $('#map-link').href = map;
  const c = info.contact || {};
  const ul = $('#contact-list');
  ul.textContent = '';
  const add = (text, href) => {
    const li = document.createElement('li');
    if (href) { const a = document.createElement('a'); a.href = href; a.textContent = text; li.appendChild(a); } else li.textContent = text;
    ul.appendChild(li);
  };
  if (val(c.name)) add(val(c.name));
  if (c.phone) add(`${T.contact.call} ${c.phone}`, `tel:${String(c.phone).replace(/[^\d+]/g, '')}`);
  if (c.email) add(c.email, `mailto:${c.email}`);
  const sel = $('#plan-select');
  const keep = sel.selectedIndex;
  sel.textContent = '';
  T.contact.planOptions.forEach((o) => { const opt = document.createElement('option'); opt.textContent = o; sel.appendChild(opt); });
  sel.selectedIndex = Math.max(0, keep);
  $('#whatsapp').hidden = !c.whatsapp;
  updateWhatsApp();
}

// ---------------- getting in touch: a pre-filled email (the site has no server), or WhatsApp
const form = $('#contact-form');
function formValues() {
  const f = Object.fromEntries(new FormData(form).entries());
  for (const k of Object.keys(f)) f[k] = String(f[k]).trim();
  return f;
}
function updateWhatsApp() {
  const c = info.contact || {};
  if (!c.whatsapp) return;
  const T = L();
  const f = formValues();
  const text = f.name ? T.contact.body(f) : T.contact.subject('');
  $('#whatsapp').href = `https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
form.addEventListener('input', (e) => {
  if (e.target.matches('[aria-invalid="true"]') && e.target.checkValidity()) e.target.removeAttribute('aria-invalid');
  updateWhatsApp();
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const T = L();
  const bad = $$('input[required]', form).filter((i) => !i.checkValidity());
  for (const i of $$('input[required]', form)) { if (bad.includes(i)) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); }
  if (bad.length) { bad[0].focus(); bad[0].reportValidity(); return; }
  const email = info.contact?.email;
  const status = $('#form-status');
  if (!email) { status.textContent = T.contact.noContact; return; }
  const f = formValues();
  status.textContent = T.contact.sending;
  location.href = `mailto:${email}?subject=${encodeURIComponent(T.contact.subject(f.org))}&body=${encodeURIComponent(T.contact.body(f))}`;
});

// ---------------- language
function applyText() {
  const T = L();
  document.documentElement.lang = lang;
  document.title = T.title;
  $('meta[name="description"]').content = T.description;
  $('meta[property="og:title"]').content = T.title;
  $('meta[property="og:description"]').content = T.description;
  for (const e of $$('[data-w]')) { const v = get(T, e.dataset.w); if (typeof v === 'string') e.textContent = v; }
  for (const e of $$('[data-w-aria]')) { const v = get(T, e.dataset.wAria); if (typeof v === 'string') e.setAttribute('aria-label', v); }
  for (const e of $$('[data-w-alt]')) { const v = get(T, e.dataset.wAlt); if (typeof v === 'string') e.alt = v; }
  for (const b of $$('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  for (const a of $$('[data-link="walk"]')) a.href = `index.html?lang=${lang}`;
  for (const a of $$('[data-link="walk2"]')) a.href = `walk2.html?lang=${lang}`;
  for (const a of $$('[data-link="photos"]')) a.href = `photos.html?lang=${lang}`;
}
function renderAll() {
  applyText();
  renderAreas();
  drawPlan($('#plan'), { live: true, uid: 'pl' });
  renderLayout();
  renderGallery();
  renderInfo();
  if (lb.open) showPhoto(shown);
}

for (const b of $$('.lang button')) {
  b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    rememberLang(lang);
    renderAll();
  });
}
for (const b of $$('.tab')) b.addEventListener('click', () => { layout = b.dataset.layout; renderLayout(); });
for (const b of $$('[data-print]')) b.addEventListener('click', () => window.print());

// ---------------- start: the page reads in English without any of this; with it, everything is filled in
const [lst, ph] = await Promise.all([
  fetch('data/spaces.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  fetch('data/photos.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { photos: [] })).catch(() => ({ photos: [] })),
]);
info = lst || {};
SIZES = Object.fromEntries((ph.photos || []).map((p) => [p.id, [p.iw, p.ih]]));
renderAll();
