// Where a pixel of a photograph lands on a horizontal plane, from the photo's solved camera.
// node ray.cjs <id> "u,v,h[,label]" ...   (u, v on the 960-wide image; h = height of the plane in metres)
// Also: "u,v,x=8.327" intersects the vertical plane x = const, "u,v,y=1.546" the plane y = const.
const fs = require('fs');
const ROOT = '/Users/naj/Documents/_WPs/fabrika.cc/platform-593';
const [id, ...picks] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(ROOT + '/data/photos.json', 'utf8')).photos.find((q) => q.id === id);
const p = { ...meta, ...(process.env.POSES ? JSON.parse(fs.readFileSync(process.env.POSES, 'utf8'))[id] || {} : {}) };
const D2R = Math.PI / 180;
const W = 960, H = Math.round((960 * p.ih) / p.iw), a = W / H, t = Math.tan((p.fov * D2R) / 2);
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const yw = p.yaw * D2R, pt = (p.pitch || 0) * D2R, r = (p.roll || 0) * D2R;
const f = [Math.cos(pt) * Math.cos(yw), Math.sin(pt), -Math.sin(yw) * Math.cos(pt)];
const z = f.map((c) => -c);
const x0 = norm(cross([0, 1, 0], z)), y0 = cross(z, x0);
const xr = [0, 1, 2].map((i) => Math.cos(r) * x0[i] + Math.sin(r) * y0[i]);
const yr = [0, 1, 2].map((i) => -Math.sin(r) * x0[i] + Math.cos(r) * y0[i]);
const C = [p.x, p.h, -p.y];
for (const pick of picks) {
  const [us, vs, hs, label = ''] = pick.split(',');
  const u = +us, v = +vs;
  const nx = (2 * u) / W - 1, ny = 1 - (2 * v) / H;
  const dx = nx * t * a, dy = (ny + (p.shift || 0)) * t;
  const d = [0, 1, 2].map((i) => dx * xr[i] + dy * yr[i] + f[i]);
  let lam;
  if (hs.startsWith('x=')) lam = (+hs.slice(2) - C[0]) / d[0];
  else if (hs.startsWith('y=')) lam = (-(+hs.slice(2)) - C[2]) / d[2];
  else lam = (+hs - C[1]) / d[1];
  const P = C.map((c, i) => c + lam * d[i]);
  console.log(`${id} ${label.padEnd(18)} (${u},${v}) -> x ${P[0].toFixed(2)}  y ${(-P[2]).toFixed(2)}  h ${P[1].toFixed(2)}  dist ${lam.toFixed(2)}`);
}
