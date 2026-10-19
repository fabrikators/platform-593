// Record the scroll frame by frame in headless Chromium (Playwright).
//   node tools/record.cjs stills 0,0.2,0.4        -> out/stills/p-0.200.png ...
//   node tools/record.cjs video [seconds] [fps] [t0] [t1] [name] -> out/<name>.mp4  (t: act 1 = 0..1, act 2 = 1..2)
// Needs the dev server: python3 tools/serve.py 8593
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const URL = process.env.P593_URL || 'http://127.0.0.1:8593/?capture';
const W = +(process.env.W || 1600), H = +(process.env.H || 900);

async function open() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.P593_CHANNEL || 'chrome',
    args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__p593, null, { timeout: 60000 });
  await page.evaluate(() => window.__p593.ready);
  await page.waitForTimeout(400);
  return { browser, page };
}

async function shot(page, p, file) {
  await page.evaluate((v) => window.__p593.set(v), p);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await page.screenshot({ path: file, type: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: file.endsWith('.jpg') ? 92 : undefined });
}

// time -> progress: hold on the sheet, steady through the middle, hold in the hall
function progressAt(t) {
  const hold0 = 0.035, hold1 = 0.08;
  if (t < hold0) return 0;
  if (t > 1 - hold1) return 1;
  return (t - hold0) / (1 - hold0 - hold1); // the page's own easing paces the stops
}

(async () => {
  const mode = process.argv[2] || 'stills';
  const { browser, page } = await open();
  if (mode === 'stills') {
    const list = (process.argv[3] || '0,0.12,0.2,0.28,0.36,0.46,0.54,0.575,0.62,0.68,0.75,0.82,0.9,1').split(',').map(Number);
    const dir = path.join(ROOT, 'out', 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const p of list) {
      const f = path.join(dir, `p-${p.toFixed(3)}.jpg`);
      const t0 = Date.now();
      await shot(page, p, f);
      console.log('still', p, Date.now() - t0, 'ms');
    }
  } else {
    const secs = +(process.argv[3] || 26), fps = +(process.argv[4] || 30);
    const tA = +(process.argv[5] ?? 0), tB = +(process.argv[6] ?? 1);
    const name = process.argv[7] || 'checkpoint-1';
    const n = Math.round(secs * fps);
    const dir = path.join(ROOT, 'out', 'frames');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await shot(page, tA + (tB - tA) * progressAt(i / (n - 1)), path.join(dir, `f${String(i).padStart(5, '0')}.jpg`));
      if (i % 60 === 0) console.log('frame', i, '/', n, Math.round((Date.now() - t0) / 1000), 's');
    }
    const outFile = path.join(ROOT, 'out', `${name}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%05d.jpg'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', outFile]);
    console.log('video', outFile);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
