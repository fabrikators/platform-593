// Reference images for landmark picking:
//   node refgrid.cjs photos <outDir> id...   each photo at 960 px wide with a labelled 40 px grid
//   node refgrid.cjs plan <out.png> x0 y0 x1 y1 [pxPerM]   the plan (walls, openings, fixtures, inlay) with a labelled 0.5 m grid
const { chromium } = require('/Users/naj/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = '/Users/naj/Documents/_WPs/fabrika.cc/platform-593';
const [mode, out, ...rest] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await b.newPage();
  if (mode === 'photos') {
    fs.mkdirSync(out, { recursive: true });
    for (const id of rest) {
      const url = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, 'assets/photos', `${id}.jpg`)).toString('base64');
      const png = await page.evaluate(async (url) => {
        const img = new Image(); img.src = url; await img.decode();
        const W = 960, H = Math.round((960 * img.height) / img.width);
        // no margin: a pixel on this image is a pixel on the 960-wide photograph; labels sit inside, on small tabs
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, W, H);
        g.font = '10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let x = 0; x <= W; x += 40) {
          g.strokeStyle = x % 200 === 0 ? 'rgba(255,0,0,0.9)' : 'rgba(255,255,0,0.55)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke();
        }
        for (let y = 0; y <= H; y += 40) {
          g.strokeStyle = y % 200 === 0 ? 'rgba(255,0,0,0.9)' : 'rgba(255,255,0,0.55)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke();
        }
        const tab = (t, x, y) => { g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 13, y - 6, 26, 12); g.fillStyle = '#fff'; g.fillText(t, x, y); };
        for (let x = 80; x < W; x += 80) { tab(String(x), x, 7); tab(String(x), x, H - 7); }
        for (let y = 80; y < H; y += 80) { tab(String(y), 14, y); tab(String(y), W - 14, y); }
        return c.toDataURL('image/png');
      }, url);
      fs.writeFileSync(path.join(out, `g-${id}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
  } else {
    const [x0, y0, x1, y1, ppm = '60'] = rest.map(Number);
    const src = fs.readFileSync(path.join(ROOT, 'js/plan-data.js'), 'utf8');
    const PLAN = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
    const png = await page.evaluate(([PLAN, x0, y0, x1, y1, k]) => {
      const W = Math.round((x1 - x0) * k), H = Math.round((y1 - y0) * k);
      const c = document.createElement('canvas'); c.width = W + 60; c.height = H + 60;
      const g = c.getContext('2d');
      const X = (x) => 30 + (x - x0) * k, Y = (y) => 30 + (y1 - y) * k;
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.font = '10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let x = Math.ceil(x0 * 2) / 2; x <= x1; x += 0.5) {
        g.strokeStyle = Number.isInteger(x) ? '#9ab' : '#dde'; g.beginPath(); g.moveTo(X(x), 30); g.lineTo(X(x), 30 + H); g.stroke();
        if (Number.isInteger(x)) { g.fillStyle = '#036'; g.fillText(String(x), X(x), 14); g.fillText(String(x), X(x), H + 46); }
      }
      for (let y = Math.ceil(y0 * 2) / 2; y <= y1; y += 0.5) {
        g.strokeStyle = Number.isInteger(y) ? '#9ab' : '#dde'; g.beginPath(); g.moveTo(30, Y(y)); g.lineTo(30 + W, Y(y)); g.stroke();
        if (Number.isInteger(y)) { g.fillStyle = '#036'; g.fillText(String(y), 14, Y(y)); g.fillText(String(y), W + 46, Y(y)); }
      }
      const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } };
      for (const f of PLAN.fixtures) poly(f.poly, 'rgba(255,170,0,0.35)', '#a60');
      for (const w of PLAN.walls) {
        poly(w.quad, w.kind === 'full' ? '#222' : w.kind === 'parapet' ? '#777' : '#3a7', null);
        const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
        for (const o of w.open) {
          const p0 = [w.a[0] + u[0] * o.s0, w.a[1] + u[1] * o.s0], p1 = [w.a[0] + u[0] * o.s1, w.a[1] + u[1] * o.s1];
          g.strokeStyle = o.kind === 'window' ? '#09f' : o.kind === 'gap' ? '#3a7' : '#f0a'; g.lineWidth = Math.max(3, w.t * k);
          g.beginPath(); g.moveTo(X(p0[0]), Y(p0[1])); g.lineTo(X(p1[0]), Y(p1[1])); g.stroke(); g.lineWidth = 1;
        }
      }
      g.strokeStyle = '#c00'; g.lineWidth = 2; g.beginPath();
      PLAN.inlay.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.stroke();
      return c.toDataURL('image/png');
    }, [PLAN, x0, y0, x1, y1, ppm]);
    fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  }
  await b.close();
})();
