// Joint solve of several photographs' cameras and shared unknown dimensions (a small bundle adjustment).
// node bundle.cjs <features.json> <out.json> <ids> '<{"wm": -0.2, "wn": 1.4}>'
// In features, any coordinate may be a string naming a shared unknown ("wm"), or "wm+0.15" for an offset from it.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/solve.cjs', 'utf8');
const camera = new Function(src.slice(src.indexOf('const D2R'), src.indexOf('function residuals')) + '; return camera;')();
const [fj, outj, idsArg, varsJ = '{}', vpriorJ = '{}'] = process.argv.slice(2);
const VPRIOR = JSON.parse(vpriorJ);
const F = JSON.parse(fs.readFileSync(fj, 'utf8'));
const out = fs.existsSync(outj) ? JSON.parse(fs.readFileSync(outj, 'utf8')) : {};
const ids = idsArg.split(',');
const V0 = JSON.parse(varsJ);
const vnames = Object.keys(V0);
const val = (c, V) => {
  if (typeof c === 'number') return c;
  const m = String(c).match(/^([a-z]\w*)([+-][\d.]+)?$/);
  return V[m[1]] + (m[2] ? +m[2] : 0);
};
const lineDist = (a, b, q) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); return ((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / L; };
function residuals(cams, V) {
  const r = [];
  ids.forEach((id, k) => {
    const f = F[id], p = cams[k], P = camera(p, f.W, f.H);
    for (const [X, Y, Z, u, v, w = 1] of f.pts || []) { const q = P(val(X, V), val(Y, V), val(Z, V)); r.push(w * (q[0] - u), w * (q[1] - v)); }
    for (const [X, Y, img, w = 1] of f.vert || []) { const a = P(val(X, V), val(Y, V), 0), b = P(val(X, V), val(Y, V), 2.5); for (const q of img) r.push(w * lineDist(a, b, q)); }
    for (const [A, B, img, w = 1] of f.lines || []) { const [a, b] = P.line(A.map((c) => val(c, V)), B.map((c) => val(c, V))); for (const q of img) r.push(w * lineDist(a, b, q)); }
    for (const [key, [mu, sd]] of Object.entries(f.prior || {})) r.push((10 * ((p[key] || 0) - mu)) / sd);
  });
  for (const [k, [mu, sd]] of Object.entries(VPRIOR)) r.push((10 * (V[k] - mu)) / sd);
  return r.map((v) => (Number.isFinite(v) ? v : 500));
}
const EPS = { x: 0.01, y: 0.01, h: 0.005, yaw: 0.05, fov: 0.05, shift: 0.001, roll: 0.05, pitch: 0.05 };
const free = ids.map((id) => F[id].free || ['x', 'y', 'h', 'yaw', 'fov', 'shift']);
let cams = ids.map((id) => ({ pitch: 0, roll: 0, shift: 0, ...(out[id] || {}), ...F[id].start }));
if (process.argv.includes('--fromOut')) cams = ids.map((id, k) => ({ pitch: 0, roll: 0, shift: 0, ...F[id].start, ...(out[id] || {}) }));
let V = { ...V0 };
const params = [...ids.flatMap((id, k) => free[k].map((key) => ['c', k, key])), ...vnames.map((n) => ['v', n])];
const get = (cs, Vs, [t, a, b]) => (t === 'c' ? cs[a][b] : Vs[a]);
const set = (cs, Vs, [t, a, b], x) => { if (t === 'c') cs[a][b] = x; else Vs[a] = x; };
const clone = () => [cams.map((c) => ({ ...c })), { ...V }];
let r = residuals(cams, V), cost = r.reduce((s, v) => s + v * v, 0), lam = 1e-2;
for (let it = 0; it < 300; it++) {
  const J = params.map((pr) => { const [cs, Vs] = clone(); const e = pr[0] === 'c' ? EPS[pr[2]] : 0.005; set(cs, Vs, pr, get(cs, Vs, pr) + e); return residuals(cs, Vs).map((v, i) => (v - r[i]) / e); });
  const n = params.length, A = params.map(() => new Array(n).fill(0)), g = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { for (let j = i; j < n; j++) { let s = 0; for (let m = 0; m < r.length; m++) s += J[i][m] * J[j][m]; A[i][j] = A[j][i] = s; } let s = 0; for (let m = 0; m < r.length; m++) s += J[i][m] * r[m]; g[i] = s; }
  let ok = false;
  for (let t = 0; t < 12; t++) {
    const M = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (A[i][i] + 1e-9) : 0)));
    const d = gauss(M, g.map((v) => -v));
    const [cs, Vs] = clone(); params.forEach((pr, i) => set(cs, Vs, pr, get(cs, Vs, pr) + d[i]));
    const r2 = residuals(cs, Vs), c2 = r2.reduce((s, v) => s + v * v, 0);
    if (c2 < cost) { const done = cost - c2 < 1e-9 * cost; cams = cs; V = Vs; r = r2; cost = c2; lam = Math.max(lam / 3, 1e-8); ok = true; if (done) it = 1e9; break; }
    lam *= 4;
  }
  if (!ok) break;
}
function gauss(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) { let m = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[m][i])) m = k; [M[i], M[m]] = [M[m], M[i]]; for (let k = i + 1; k < n; k++) { const c = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= c * M[i][j]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x;
}
const r2 = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
ids.forEach((id, k) => {
  const p = cams[k];
  const rr = residuals(cams.map((c, j) => (j === k ? c : c)), V);
  out[id] = { x: r2(p.x, 2), y: r2(p.y, 2), h: r2(p.h, 2), yaw: r2(p.yaw, 1), pitch: r2(p.pitch || 0, 1), roll: r2(p.roll || 0, 1), shift: r2(p.shift || 0, 3), fov: r2(p.fov, 1) };
  console.log(id, JSON.stringify(out[id]));
});
console.log('shared', JSON.stringify(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, r2(v, 3)]))), 'rms', r2(Math.sqrt(cost / r.length), 2), 'worst', r2(Math.max(...r.map(Math.abs)), 1));
fs.writeFileSync(outj, JSON.stringify(out, null, 1));
