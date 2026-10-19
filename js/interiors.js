// The kitchen and the south corridor as they stand in 2026, drawn from the photographs
// (61-65: the kitchen; 21 and 22: the corridor) and checked by drawing the model's lines over each
// one from its solved camera (tools/photo-registration). Plan metres: x east, y north; heights in metres.
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ---------------------------------------------------------------- the kitchen
// a U of aubergine gloss units under a grey worktop (photos 61-65): the window run on the west wall
// (sink), the south run (microwave, coffee) and the north run (hob, dishwasher) ending at the fridge;
// a tall appliance unit on the worktop in the south-west corner, water coolers past the fridge, and a
// long dark table with chairs on its west side. Dimensions solved jointly with the photo cameras.
export const KITCHEN = {
  wall: { w: 8.327, s: -1.883, n: 1.546 },
  depth: 0.62,
  southEnd: 10.81,                                          // east end of the south run
  fridge: { x0: 10.15, x1: 11.0, y0: 0.83, h: 1.75 },       // the north run stops at the fridge
  dishwasher: [9.16, 9.57],                                  // in the north run
  tall: { x1: 8.78, y0: -1.883, y1: -1.33, z0: 0.94, z1: 2.4 },
  table: { x0: 11.42, x1: 12.32, y0: -1.70, y1: 0.14, h: 0.75 },
  chairs: [-0.76, -0.2],                                     // along the table's west side
  coolers: [11.22, 11.6],                                    // against the north wall, east of the fridge
  plinth: 0.10, top: 0.88, worktop: 0.04, over: 0.025,
};

export function buildKitchen(b) {
  const K = KITCHEN, R = 'kitchen', { w: xW, s: yS, n: yN } = K.wall, D = K.depth;
  const box = (mat, x0, y0, x1, y1, z0, z1) => b.prism(R, mat, rect(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)), z0, z1);
  const lines = [];
  const L = (x0, y0, z0, x1, y1, z1) => lines.push(x0, z0, -y0, x1, z1, -y1);
  const zT = K.top, zW = K.top + K.worktop, zP = K.plinth, o = K.over;
  const xF = xW + D, yFs = yS + D, yFn = yN - D;            // front faces of the three runs

  // carcasses: plinth (set back 6 cm), aubergine body, worktop with a 2.5 cm overhang
  const run = (x0, y0, x1, y1, face) => {
    const set = { e: [0, 0, -0.06, 0], s: [0, 0.06, 0, 0], n: [0, 0, 0, -0.06] }[face];
    box('steelPanel', x0 + set[0], y0 + set[1], x1 + set[2], y1 + set[3], 0, zP);
    box('aubergine', x0, y0, x1, y1, zP, zT);
  };
  run(xW, yS, xF, yN, 'e');                                  // west run, the full wall
  run(xF, yS, K.southEnd, yFs, 's');                         // south run
  run(xF, yFn, K.fridge.x0, yN, 'n');                        // north run
  box('worktop', xW, yS, xF + o, yN, zT, zW);
  box('worktop', xF + o, yS, K.southEnd + o, yFs + o, zT, zW);
  box('worktop', xF + o, yFn - o, K.fridge.x0, yN, zT, zW);

  // fronts. West run: doors with vertical bars. South run: three rows of drawers with long bars.
  // North run: the dishwasher (white) and a drawer stack.
  const xf = xF + 0.002;
  for (let y = yFs + 0.05; y < yFn - 0.3; y += 0.6) L(xf, y, zP + 0.02, xf, y, zT - 0.02);
  for (let y = yFs + 0.35; y < yFn - 0.3; y += 0.6) box('steel', xF + 0.012, y - 0.008, xF + 0.03, y + 0.008, 0.3, zT - 0.1);
  const yfs = yFs + 0.002, x0s = xF + 0.05, bays = Math.max(1, Math.round((K.southEnd - x0s) / 0.85)), bw = (K.southEnd - x0s) / bays;
  for (let i = 0; i <= bays; i++) { const x = x0s + i * bw; L(x, yfs, zP + 0.02, x, yfs, zT - 0.02); }
  for (const z of [0.36, 0.62]) L(x0s, yfs, z, K.southEnd, yfs, z);
  for (let i = 0; i < bays; i++) {
    const a = x0s + i * bw + 0.06, c = x0s + (i + 1) * bw - 0.06;
    for (const z of [0.29, 0.55, 0.79]) box('steel', a, yFs + 0.012, c, yFs + 0.028, z, z + 0.016);
  }
  const [d0, d1] = K.dishwasher;
  box('whiteGoods', d0, yFn - 0.006, d1, yFn, zP + 0.02, zT - 0.02);
  L(d1 + 0.002, yFn - 0.002, zP + 0.02, d1 + 0.002, yFn - 0.002, zT - 0.02);
  for (const z of [0.36, 0.62]) L(d1, yFn - 0.002, z, K.fridge.x0, yFn - 0.002, z);
  for (const z of [0.29, 0.55, 0.79]) box('steel', d1 + 0.05, yFn - 0.028, K.fridge.x0 - 0.05, yFn - 0.012, z, z + 0.016);

  // on the worktops: sink and tap under the window, hob on the north run, microwave on the south run
  box('steel', xW + 0.08, -0.55, xF - 0.06, 0.25, zW, zW + 0.004);
  box('steel', xW + 0.12, -0.17, xW + 0.16, -0.13, zW, zW + 0.38);
  // the gas hob: a stainless plate with four burners
  box('stainless', 9.0, yFn + 0.06, 9.58, yN - 0.06, zW, zW + 0.012);
  for (const [bx, by] of [[9.14, yFn + 0.18], [9.44, yFn + 0.18], [9.14, yN - 0.18], [9.44, yN - 0.18]]) box('blackGloss', bx - 0.05, by - 0.05, bx + 0.05, by + 0.05, zW + 0.012, zW + 0.03);
  // microwave (stainless, a dark glass door), coffee machine and kettle
  box('stainless', 9.6, yS + 0.08, 10.1, yS + 0.44, zW, zW + 0.29);
  box('blackGloss', 9.64, yS + 0.44, 9.98, yS + 0.445, zW + 0.04, zW + 0.25);
  box('blackGloss', 10.2, yS + 0.1, 10.42, yS + 0.36, zW, zW + 0.33);
  box('stainless', 10.5, yS + 0.18, 10.66, yS + 0.34, zW, zW + 0.22);

  // the tall appliance unit standing on the worktop in the south-west corner, facing east
  const t = K.tall;
  box('stainless', xW, t.y0, t.x1, t.y1, t.z0, t.z1);
  for (let z = t.z0 + 0.4; z < t.z1 - 0.15; z += 0.32) L(t.x1 + 0.002, t.y0, z, t.x1 + 0.002, t.y1, z);

  // the fridge: freezer above, steel handles on its west edge
  const f = K.fridge, yFr = f.y0;
  box('stainless', f.x0, yFr, f.x1, yN - 0.02, 0.02, f.h);
  L(f.x0, yFr - 0.002, 1.2, f.x1, yFr - 0.002, 1.2);
  box('steel', f.x0 + 0.05, yFr - 0.04, f.x0 + 0.08, yFr, 0.55, 1.1);
  box('steel', f.x0 + 0.05, yFr - 0.04, f.x0 + 0.08, yFr, 1.28, 1.6);

  // water coolers with their bottles
  for (const x of K.coolers) {
    const y = yN - 0.18;
    box('whiteGoods', x - 0.16, y - 0.16, x + 0.16, y + 0.16, 0, 1.0);
    const ring = Array.from({ length: 12 }, (_, i) => [x + 0.135 * Math.cos((i * Math.PI) / 6), y + 0.135 * Math.sin((i * Math.PI) / 6)]);
    b.prism(R, 'bottle', ring, 1.01, 1.47);
  }

  // the table, and chairs on its west side
  const tb = K.table;
  box('wenge', tb.x0, tb.y0, tb.x1, tb.y1, tb.h - 0.035, tb.h);
  for (const [x, y] of [[tb.x0 + 0.06, tb.y0 + 0.06], [tb.x1 - 0.06, tb.y0 + 0.06], [tb.x0 + 0.06, tb.y1 - 0.06], [tb.x1 - 0.06, tb.y1 - 0.06]]) {
    box('wenge', x - 0.025, y - 0.025, x + 0.025, y + 0.025, 0, tb.h - 0.035);
  }
  for (const y of K.chairs) chair(b, R, tb.x0 - 0.3, y, 1);

  if (lines.length) b.addLines(R, lines, 0.8);
}

// a plain café chair: black seat and back on steel legs; dir +1 faces east
function chair(b, room, x, y, dir) {
  const box = (mat, x0, y0, x1, y1, z0, z1) => b.prism(room, mat, rect(x0, y0, x1, y1), z0, z1);
  box('blackGloss', x - 0.21, y - 0.21, x + 0.21, y + 0.21, 0.44, 0.47);
  const xb = x - dir * 0.2;
  box('blackGloss', Math.min(xb, xb - dir * 0.02), y - 0.2, Math.max(xb, xb - dir * 0.02), y + 0.2, 0.62, 0.86);
  for (const [dx, dy] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box('steel', x + dx - 0.01, y + dy - 0.01, x + dx + 0.01, y + dy + 0.01, 0, 0.44);
  box('steel', xb - 0.01, y - 0.18, xb + 0.01, y - 0.16, 0.47, 0.62);
  box('steel', xb - 0.01, y + 0.16, xb + 0.01, y + 0.18, 0.47, 0.62);
}

// ---------------------------------------------------------------- the corridor to the terrace
// on its north side (photo 21, camera re-solved from the corridor's lines): a plain wall, then open
// shelving where the model had a closed cabinet. Wooden side frames about 0.8 m apart hold glass
// shelves over a black lacquered base; a white back, and a bulkhead with lights above. The corridor
// is 1.15 m wide and ends at a glazed door onto the pergola terrace.
export const CORRIDOR = { x0: 14.33, x1: 19.93, shelvesFrom: 16.6, yFront: 1.50, yBack: 1.994, base: 0.45, top: 1.92, bulkhead: 2.3, bays: 4, shelves: [0.86, 1.22, 1.58] };

export function buildCorridor(b) {
  const C = CORRIDOR, R = 'hall';
  const box = (mat, x0, y0, x1, y1, z0, z1) => b.prism(R, mat, rect(x0, y0, x1, y1), z0, z1);
  const yF = C.yFront, yB = C.yBack - 0.04;
  box('plaster', C.x0, yF, C.shelvesFrom, C.yBack, 0, 2.8);       // the plain stretch nearest the kitchen
  box('plaster', C.shelvesFrom, yB, C.x1, C.yBack, 0, 2.8);        // the white back of the shelving
  box('plaster', C.shelvesFrom, yF, C.x1, yB, C.bulkhead, 2.8);     // the bulkhead over the shelves
  box('blackGloss', C.shelvesFrom, yF, C.x1, yB, 0, C.base);        // the black base
  for (let i = 0; i < 3; i++) {                                     // lights under the bulkhead
    const x = C.shelvesFrom + ((i + 0.5) * (C.x1 - C.shelvesFrom)) / 3;
    box('steel', x - 0.09, yF + 0.12, x + 0.09, yF + 0.2, C.bulkhead - 0.06, C.bulkhead);
  }
  const bw = (C.x1 - C.shelvesFrom) / C.bays, st = 0.05, rail = 0.05;
  for (let i = 0; i <= C.bays; i++) {
    const x = C.shelvesFrom + i * bw;
    const xa = i === 0 ? x : i === C.bays ? x - st : x - st / 2, xb = xa + st;
    // a side frame: front and back stiles, a top and a middle rail, open between
    box('shelfWood', xa, yF, xb, yF + rail, C.base, C.top);
    box('shelfWood', xa, yB - rail, xb, yB, C.base, C.top);
    box('shelfWood', xa, yF + rail, xb, yB - rail, C.top - rail, C.top);
    box('shelfWood', xa, yF + rail, xb, yB - rail, 1.04, 1.04 + rail);
  }
  for (let i = 0; i < C.bays; i++) {
    const xa = C.shelvesFrom + i * bw + st / 2 + (i === 0 ? st / 2 : 0), xb = C.shelvesFrom + (i + 1) * bw - st / 2 - (i === C.bays - 1 ? st / 2 : 0);
    for (const z of C.shelves) box('glass', xa, yF + 0.02, xb, yB - 0.02, z, z + 0.01);
  }
}
