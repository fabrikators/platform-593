// Solve each photograph's camera from landmarks, by least squares (Levenberg-Marquardt).
// node solve.cjs <features.json> <out.json> [ids]
// features.json: { "<id>": { "W": 960, "H": 540, "start": {x,y,h,yaw,fov}, "free": ["x","y","h","yaw","roll","fov","shift"],
//   "pts":   [[X, Y, Z, u, v], ...]                          plan metres (Z up) -> pixel on the 960-wide grid
//   "vert":  [[X, Y, [[u, v], ...]], ...]                     a vertical edge at (X, Y): pixels anywhere along it
//   "lines": [[[X1, Y1, Z1], [X2, Y2, Z2], [[u, v], ...]], ...] a 3D line: pixels anywhere along it } }
// The camera is the one stage.view builds: position (x, h, -y), yaw/pitch lookAt, rotateZ(roll), vertical fov, lens shift.
const fs = require('fs');
const [fj, outj, idsArg] = process.argv.slice(2);
const F = JSON.parse(fs.readFileSync(fj, 'utf8'));
const out = fs.existsSync(outj) ? JSON.parse(fs.readFileSync(outj, 'utf8')) : {};
const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

function camera(p, W, H) {
  const C = [p.x, p.h, -p.y];
  const yw = p.yaw * D2R, pt = (p.pitch || 0) * D2R, r = (p.roll || 0) * D2R;
  const f = [Math.cos(pt) * Math.cos(yw), Math.sin(pt), -Math.sin(yw) * Math.cos(pt)];
  const z = [-f[0], -f[1], -f[2]];
  const x0 = norm(cross([0, 1, 0], z)), y0 = cross(z, x0);
  const xr = [0, 1, 2].map((i) => Math.cos(r) * x0[i] + Math.sin(r) * y0[i]);
  const yr = [0, 1, 2].map((i) => -Math.sin(r) * x0[i] + Math.cos(r) * y0[i]);
  const t = Math.tan((p.fov * D2R) / 2), a = W / H;
  const P = (X, Y, Z) => {
    const d = sub([X, Z, -Y], C);
    const cx = dot(d, xr), cy = dot(d, yr), cz = dot(d, z);
    if (cz > -1e-3) return [NaN, NaN];
    const nx = cx / -cz / (t * a), ny = cy / -cz / t - (p.shift || 0);
    return [((nx + 1) / 2) * W, ((1 - ny) / 2) * H];
  };
  // a 3D line, clipped to the part in front of the camera, as two image points
  P.line = (A, B) => {
    const depth = (Q) => -dot(sub([Q[0], Q[2], -Q[1]], C), z);
    const dA = depth(A), dB = depth(B), near = 0.3;
    if (dA < near && dB < near) return [[NaN, NaN], [NaN, NaN]];
    const at = (k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
    let a0 = A, b0 = B;
    if (dA < near) a0 = at((near - dA) / (dB - dA));
    if (dB < near) b0 = at((near - dA) / (dB - dA));
    return [P(...a0), P(...b0)];
  };
  return P;
}
function lineDist(a, b, q) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  return ((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / L;
}
function residuals(p, f) {
  const P = camera(p, f.W, f.H), r = [];
  // an optional last element weights a feature (default 1)
  for (const [X, Y, Z, u, v, w = 1] of f.pts || []) { const [pu, pv] = P(X, Y, Z); r.push(w * (pu - u), w * (pv - v)); }
  for (const [X, Y, img, w = 1] of f.vert || []) { const a = P(X, Y, 0), b = P(X, Y, 2.5); for (const q of img) r.push(w * lineDist(a, b, q)); }
  for (const [A, B, img, w = 1] of f.lines || []) { const [a, b] = P.line(A, B); for (const q of img) r.push(w * lineDist(a, b, q)); }
  // soft priors: { "prior": { "h": [1.35, 0.15] } } pulls a parameter towards a value, in units of its sigma (scaled to 10 px)
  for (const [k, [mu, sd]] of Object.entries(f.prior || {})) r.push((10 * ((p[k] || 0) - mu)) / sd);
  return r.map((v) => (Number.isFinite(v) ? v : 500));
}
const EPS = { x: 0.01, y: 0.01, h: 0.005, yaw: 0.05, pitch: 0.05, roll: 0.05, fov: 0.05, shift: 0.001 };
function solve(f) {
  const free = f.free || ['x', 'y', 'h', 'yaw', 'roll', 'fov', 'shift'];
  let p = { pitch: 0, roll: 0, shift: 0, ...f.start };
  let r = residuals(p, f), cost = r.reduce((s, v) => s + v * v, 0), lam = 1e-2;
  for (let it = 0; it < 200; it++) {
    const J = free.map((k) => { const q = { ...p, [k]: p[k] + EPS[k] }; return residuals(q, f).map((v, i) => (v - r[i]) / EPS[k]); });
    const n = free.length, A = free.map(() => new Array(n).fill(0)), g = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] = J[i].reduce((s, v, m) => s + v * J[j][m], 0); g[i] = J[i].reduce((s, v, m) => s + v * r[m], 0); }
    let improved = false;
    for (let tries = 0; tries < 12; tries++) {
      const M = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (A[i][i] + 1e-9) : 0)));
      const dlt = gauss(M, g.map((v) => -v));
      const q = { ...p }; free.forEach((k, i) => { q[k] += dlt[i]; });
      const r2 = residuals(q, f), c2 = r2.reduce((s, v) => s + v * v, 0);
      if (c2 < cost) { p = q; r = r2; const done = cost - c2 < 1e-8 * cost; cost = c2; lam = Math.max(lam / 3, 1e-7); improved = true; if (done) it = 1e9; break; }
      lam *= 4;
    }
    if (!improved) break;
  }
  return { p, rms: Math.sqrt(cost / r.length), r };
}
function gauss(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let m = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[m][i])) m = k;
    [M[i], M[m]] = [M[m], M[i]];
    for (let k = i + 1; k < n; k++) { const c = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= c * M[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
const r2 = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
for (const [id, f] of Object.entries(F)) {
  if (idsArg && !idsArg.split(',').includes(id)) continue;
  const { p, rms, r } = solve(f);
  const q = { x: r2(p.x, 2), y: r2(p.y, 2), h: r2(p.h, 2), yaw: r2(p.yaw, 1), pitch: r2(p.pitch || 0, 1), roll: r2(p.roll || 0, 1), shift: r2(p.shift || 0, 3), fov: r2(p.fov, 1) };
  out[id] = { ...q, rms: r2(rms, 1) };
  console.log(id, JSON.stringify(out[id]), 'worst', r2(Math.max(...r.map(Math.abs)), 1));
}
fs.writeFileSync(outj, JSON.stringify(out, null, 1));
