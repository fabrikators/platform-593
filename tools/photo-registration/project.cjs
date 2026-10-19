// Project landmarks with a given pose and print where each lands vs where it was picked.
// node project.cjs <features.json> <id> '<poseJSON>'
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/solve.cjs', 'utf8');
const camSrc = src.slice(src.indexOf('const D2R'), src.indexOf('function residuals'));
const camera = new Function(camSrc + '; return camera;')();
const [fj, id, pj] = process.argv.slice(2);
const f = JSON.parse(fs.readFileSync(fj, 'utf8'))[id], p = JSON.parse(pj);
const P = camera(p, f.W, f.H);
const r1 = (v) => Math.round(v);
for (const [X, Y, Z, u, v] of f.pts || []) { const q = P(X, Y, Z); console.log('pt  ', [X, Y, Z].join(','), 'picked', u, v, 'model', r1(q[0]), r1(q[1])); }
for (const [X, Y, img] of f.vert || []) { const a = P(X, Y, 0), b = P(X, Y, 2.5); console.log('vert', X, Y, 'picked u', img[0][0], 'model u at v', img[0][1], ':', r1(a[0] + ((b[0] - a[0]) * (img[0][1] - a[1])) / (b[1] - a[1]))); }
for (const [A, B, img] of f.lines || []) { const [a, b] = P.line(A, B); console.log('line', A.join(','), '->', B.join(','), 'picked', JSON.stringify(img), 'model through', r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])); }
