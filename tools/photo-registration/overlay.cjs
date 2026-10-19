// Draw the model's edges (red) over each photograph at a solved pose, with the picked landmarks (yellow).
// node overlay.cjs <poses.json> <features.json|-> <outDir> ids
const { chromium } = require('/Users/naj/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = '/Users/naj/Documents/_WPs/fabrika.cc/platform-593';
const [pj, fj, outDir, idsArg] = process.argv.slice(2);
const poses = JSON.parse(fs.readFileSync(pj, 'utf8'));
const feats = fj !== '-' && fs.existsSync(fj) ? JSON.parse(fs.readFileSync(fj, 'utf8')) : {};
const meta = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photos.json'), 'utf8')).photos.map((p) => [p.id, p]));
const ids = idsArg.split(',');
const GRID = process.argv.includes('--grid');
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const groups = {};
  for (const id of ids) { const m = meta[id.split('#')[0]]; const H = Math.round((960 * m.ih) / m.iw); (groups[H] ||= []).push(id); }
  for (const [Hs, list] of Object.entries(groups)) {
    const W = 960, H = +Hs;
    const b = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
    const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto('http://127.0.0.1:8593/?capture&photo=shell&hud=0', { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.__p593, null, { timeout: 120000, polling: 500 });
    await page.evaluate(() => window.__p593.ready);
    await page.evaluate((g) => { window.__grid = g; }, GRID);
    for (const id of list) {
      const pid = id.split('#')[0], m = meta[pid], p = { ...m, ...poses[id], aspect: m.iw / m.ih };
      const url = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, 'assets/photos', `${pid}.jpg`)).toString('base64');
      const f = feats[id] || {};
      const marks = [...(f.pts || []).map((q) => [q[3], q[4]]), ...(f.vert || []).flatMap((q) => q[2]), ...(f.lines || []).flatMap((q) => q[2])];
      const png = await page.evaluate(async ([v, url, W, H, marks]) => {
        window.__p593.view({ ...v, ink: true, ao: false, shadows: false });
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.drawImage(document.getElementById('scene'), 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data;
        const L = new Float32Array(W * H);
        for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        const img = new Image(); img.src = url; await img.decode();
        g.drawImage(img, 0, 0, W, H);
        const o = g.getImageData(0, 0, W, H);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x, k = i * 4;
          const e = Math.max(Math.abs(L[i + 1] - L[i - 1]), Math.abs(L[i + W] - L[i - W])) > 16;
          if (e) { o.data[k] = 255; o.data[k + 1] = 20; o.data[k + 2] = 10; }
          else { o.data[k] *= 0.7; o.data[k + 1] *= 0.7; o.data[k + 2] *= 0.7; }
        }
        g.putImageData(o, 0, 0);
        g.fillStyle = '#ff0';
        for (const [u, w] of marks) { g.beginPath(); g.arc(u, w, 3, 0, 7); g.fill(); }
        if (window.__grid) {
          g.font = '10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
          for (let x = 0; x <= W; x += 40) { g.strokeStyle = x % 200 === 0 ? 'rgba(80,200,255,0.8)' : 'rgba(80,200,255,0.35)'; g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
          for (let y = 0; y <= H; y += 40) { g.strokeStyle = y % 200 === 0 ? 'rgba(80,200,255,0.8)' : 'rgba(80,200,255,0.35)'; g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
          const tab = (t, x, y) => { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x - 13, y - 6, 26, 12); g.fillStyle = '#fff'; g.fillText(t, x, y); };
          for (let x = 80; x < W; x += 80) { tab(String(x), x, 7); tab(String(x), x, H - 7); }
          for (let y = 80; y < H; y += 80) { tab(String(y), 14, y); tab(String(y), W - 14, y); }
        }
        return c.toDataURL('image/jpeg', 0.88);
      }, [p, url, W, H, marks]);
      fs.writeFileSync(path.join(outDir, `o-${id.replace('#', '_')}.jpg`), Buffer.from(png.split(',')[1], 'base64'));
    }
    await b.close();
  }
  console.log('overlays', ids.join(','));
})();
