// Global pose search: score the model's line drawing against the photograph's edges from every
// position on a grid inside the room and every heading, then refine the best few.
// node globalsearch.cjs <outJson> <id> <room[,room]> [fov=66] [step=0.5]
// Cost: mean truncated distance from model edges to photo edges + from photo edges to model edges.
const { chromium } = require('/Users/naj/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = '/Users/naj/Documents/_WPs/fabrika.cc/platform-593';
const [outJson, id, roomsArg, fovArg = '66', stepArg = '0.5'] = process.argv.slice(2);
const meta = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photos.json'), 'utf8')).photos.map((p) => [p.id, p]));
const src = fs.readFileSync(path.join(ROOT, 'js/plan-data.js'), 'utf8');
const PLAN = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const m = meta[id], W = 320, H = Math.round((320 * m.ih) / m.iw);
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const rooms = roomsArg.split(',').map((r) => PLAN.rooms[r]);
const inRoom = (pt) => rooms.some((r) => inside(pt, r.poly) && !r.holes.some((h) => inside(pt, h)));
const clear = (pt) => !PLAN.walls.some((w) => inside(pt, w.quad)) && !PLAN.fixtures.some((f) => inside(pt, f.poly));
const near = (pt, d) => PLAN.walls.some((w) => w.kind === 'full' && w.quad.some(([x, y]) => Math.hypot(x - pt[0], y - pt[1]) < d));
const step = +stepArg;
const pts = [];
const xs = rooms.flatMap((r) => r.poly.map((q) => q[0])), ys = rooms.flatMap((r) => r.poly.map((q) => q[1]));
for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) {
  const pt = [x, y]; if (inRoom(pt) && clear(pt)) pts.push(pt);
}
const edges = 'data:image/png;base64,' + execFileSync('magick', [path.join(ROOT, 'assets/photos', `${id}.jpg`), '-resize', `${W}x${H}!`, '-colorspace', 'gray', '-blur', '0x1.0', '-canny', '0x1.2+15%+35%', 'png:-']).toString('base64');

const PAGE = () => {
  const R = (window.__gs = {});
  const c2 = document.createElement('canvas'); const g2 = c2.getContext('2d', { willReadFrequently: true });
  const dtOf = (mask, W, H) => {
    const dt = new Float32Array(W * H); const s2 = Math.SQRT2;
    for (let i = 0; i < W * H; i++) dt[i] = mask[i] ? 0 : 1e6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let v = dt[i]; if (x > 0) v = Math.min(v, dt[i - 1] + 1); if (y > 0) { v = Math.min(v, dt[i - W] + 1); if (x > 0) v = Math.min(v, dt[i - W - 1] + s2); if (x < W - 1) v = Math.min(v, dt[i - W + 1] + s2); } dt[i] = v; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let v = dt[i]; if (x < W - 1) v = Math.min(v, dt[i + 1] + 1); if (y < H - 1) { v = Math.min(v, dt[i + W] + 1); if (x < W - 1) v = Math.min(v, dt[i + W + 1] + s2); if (x > 0) v = Math.min(v, dt[i + W - 1] + s2); } dt[i] = v; }
    return dt;
  };
  R.init = async (W, H, url) => {
    R.W = W; R.H = H; c2.width = W; c2.height = H;
    const img = new Image(); img.src = url; await img.decode();
    g2.drawImage(img, 0, 0, W, H);
    const d = g2.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
    R.pe = [];
    for (let i = 0; i < W * H; i++) if (d[i * 4] > 127) { mask[i] = 1; R.pe.push(i); }
    // keep at most 2500 photo edge pixels for the reverse term
    if (R.pe.length > 2500) { const k = R.pe.length / 2500; R.pe = Array.from({ length: 2500 }, (_, j) => R.pe[Math.floor(j * k)]); }
    R.dtP = dtOf(mask, W, H);
  };
  R.cost = (v) => {
    const { W, H } = R;
    window.__p593.view({ ...v, ink: true, ao: false, shadows: false });
    g2.drawImage(document.getElementById('scene'), 0, 0, W, H);
    const d = g2.getImageData(0, 0, W, H).data;
    const L = new Float32Array(W * H), E = new Uint8Array(W * H);
    for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    let n = 0, s = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (Math.max(Math.abs(L[i + 1] - L[i - 1]), Math.abs(L[i + W] - L[i - W])) > 16) { E[i] = 1; n++; s += Math.min(R.dtP[i], 8); } }
    if (n < 150) return 99;
    const dtM = dtOf(E, W, H);
    let s2 = 0; for (const i of R.pe) s2 += Math.min(dtM[i], 8);
    return s / n + s2 / R.pe.length;
  };
  R.refine = (p0) => {
    let P = { ...p0 }, best = R.cost(P);
    const spec = [['x', 0.2, 0.02], ['y', 0.2, 0.02], ['yaw', 3, 0.2], ['fov', 4, 0.3], ['h', 0.08, 0.01], ['shift', 0.04, 0.004]];
    const st = Object.fromEntries(spec.map(([k, s]) => [k, s]));
    for (let pass = 0; pass < 16; pass++) {
      let imp = false;
      for (const [k, , mn] of spec) { if (st[k] < mn) continue; for (const sg of [1, -1]) { let mv = false; for (let r = 0; r < 4; r++) { const q = { ...P, [k]: P[k] + sg * st[k] }; if (k === 'h' && (q.h < 0.9 || q.h > 1.8)) break; if (k === 'fov' && (q.fov < 40 || q.fov > 95)) break; const c = R.cost(q); if (c < best - 1e-4) { best = c; P = q; mv = imp = true; } else break; } if (mv) break; } }
      if (!imp) { let any = false; for (const [k, , mn] of spec) { st[k] /= 2; if (st[k] >= mn) any = true; } if (!any) break; }
    }
    return { P, best };
  };
};

(async () => {
  const t0 = Date.now();
  const b = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:8593/?capture&photo=shell&hud=0', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__p593, null, { timeout: 120000, polling: 500 });
  await page.evaluate(() => window.__p593.ready);
  await page.evaluate(PAGE);
  await page.evaluate(([W, H, u]) => window.__gs.init(W, H, u), [W, H, edges]);
  const base = { h: 1.3, pitch: 0, roll: 0, shift: -0.12, fov: +fovArg, aspect: m.iw / m.ih };
  const all = await page.evaluate(([pts, base]) => {
    const out = [];
    for (const [x, y] of pts) for (let yaw = 0; yaw < 360; yaw += 10) out.push([window.__gs.cost({ ...base, x, y, yaw }), x, y, yaw]);
    return out;
  }, [pts, base]);
  all.sort((a, b2) => a[0] - b2[0]);
  // the best few, at least 1 m or 40 degrees apart from each other
  const seeds = [];
  for (const c of all) { if (seeds.length >= 10) break; if (seeds.every((s) => Math.hypot(s[1] - c[1], s[2] - c[2]) > 1 || Math.abs(((s[3] - c[3] + 540) % 360) - 180) > 40)) seeds.push(c); }
  const refined = [];
  for (const s of seeds) {
    const r = await page.evaluate(([p]) => window.__gs.refine(p), [{ ...base, x: s[1], y: s[2], yaw: s[3] }]);
    refined.push({ cost: +r.best.toFixed(3), coarse: +s[0].toFixed(3), ...Object.fromEntries(Object.entries(r.P).filter(([k]) => ['x', 'y', 'h', 'yaw', 'fov', 'shift'].includes(k)).map(([k, v]) => [k, +v.toFixed(3)])) });
  }
  refined.sort((a, b2) => a.cost - b2.cost);
  const res = fs.existsSync(outJson) ? JSON.parse(fs.readFileSync(outJson, 'utf8')) : {};
  res[id] = refined;
  fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
  console.log(id, `${pts.length} positions x 36 headings in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const r of refined.slice(0, 5)) console.log(' ', JSON.stringify(r));
  await b.close();
})();
