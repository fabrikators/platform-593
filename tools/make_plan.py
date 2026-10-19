"""Build js/plan-data.js from the Live Home 3D project (Platform.lhzd).

Usage:  python3 tools/make_plan.py "<path>/Platform.lhzd" js/plan-data.js

Everything is in the model's plan frame: x east, y north (as drawn), metres.
The site converts to three.js with (x, y) -> (x, 0, -y).

The model has no windows on the balcony wall or in the kitchen; the ones in
ADDED_WINDOWS come from the 2026 photographs. The 37.7 m2 room is treated as a
terrace under an open steel pergola (as it stands in 2026), so its saw-tooth glazing becomes planters.
"""
import json
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

INTERIOR = {'hall', 'big', 'dressing', 'bath', 'closet', 'core', 'storeN', 'wc', 'storeS', 'kitchen'}
OUTDOOR = {'terrace', 'covered'}

# caption anchors -> room key, label (from the 2018 drawing)
ROOM_ANCHORS = [
    ('hall', (13.9, 6.6), 'HALL'),
    ('big', (3.6, 9.1), 'BIG ROOM'),
    ('dressing', (3.9, 5.1), 'DRESSING'),
    ('bath', (5.9, 5.3), 'BATH'),
    ('closet', (3.2, 6.2), ''),
    ('core', (9.1, 4.1), 'STAIRS · LIFT'),
    ('storeN', (8.7, 7.2), 'STORE'),
    ('wc', (11.5, 4.8), 'WC'),
    ('storeS', (11.9, 2.7), 'STORE'),
    ('kitchen', (11.6, -1.1), 'KITCHEN'),
    ('terrace', (26.8, 10.6), 'TERRACE'),
    ('covered', (23.4, 8.3), 'PERGOLA TERRACE'),
]

# hinge point, direction the open leaf points (plan frame)
DOOR_SWINGS = [
    ((5.74, 6.83), (-1, 0)),   # big room
    ((6.93, 6.51), (0, -1)),   # bath
    ((4.12, 6.56), (0, -1)),   # dressing
    ((12.42, 4.65), (-1, 0)),  # wc
    ((13.14, 3.84), (0, -1)),  # service passage
    ((12.94, 2.49), (-1, 0)),  # store south
    ((12.94, 0.77), (-1, 0)),  # kitchen
    ((11.08, 5.29), (1, 0)),   # front door (opens into the flat)
]

# windows the model lacks, placed from the 2026 photographs: (start, end, sill, head)
ADDED_WINDOWS = [
    ((1.86, 12.33), (5.07, 12.33), 0.0, 2.57),    # big room: a sheer-covered pane and glazed doors onto the balcony (solved jointly from photos 31, 32)
    ((6.9, 12.33), (8.7, 12.33), 0.9, 2.3),       # hall, balcony wall: windows over radiators (photos 06, 07)
    ((10.3, 12.33), (12.1, 12.33), 0.9, 2.3),
    ((13.7, 12.33), (15.5, 12.33), 0.9, 2.3),
    ((17.1, 12.33), (18.9, 12.33), 0.9, 2.3),
    ((8.2, -1.80), (8.2, 1.50), 1.10, 2.65),      # kitchen: the window over the sink, west wall (solved jointly from photos 61-65)
    ((5.85, 3.857), (6.55, 3.857), 1.7, 2.25),    # shower room: small high window (photo 41)
    ((4.3, 3.857), (5.1, 3.857), 1.73, 2.3),  # dressing: high window at the east end of the south wall (solved from photo 35)
]


def fl(s):
    return [float(v) for v in s.split(',')]


def yaw_of(direction):
    qx, qy, qz, qw = fl(direction)
    return 2 * math.atan2(qz, qw)


def xf(loc, yaw, p, scale=(1, 1)):
    x, y = p[0] * scale[0], p[1] * scale[1]
    c, s = math.cos(yaw), math.sin(yaw)
    return [loc[0] + c * x - s * y, loc[1] + s * x + c * y]


def path_pts(d):
    d = d.replace('F1', '').replace('M', ' ').replace('Z', ' ').replace('L', ' ')
    nums = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?(?:e-?\d+)?', d)]
    return [nums[i:i + 2] for i in range(0, len(nums) - 1, 2)]


def mesh_aabb(el):
    for m in el.iter():
        if 'aabb' in m.attrib and 'mesh3Dname' in m.attrib:
            return m.attrib['mesh3Dname'], fl(m.attrib['aabb'])
    return None, None


def area(p):
    return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2


def centroid(p):
    a = 0; cx = 0; cy = 0
    for i in range(len(p)):
        x0, y0 = p[i]; x1, y1 = p[(i + 1) % len(p)]
        cr = x0 * y1 - x1 * y0
        a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr
    a *= 0.5
    return [cx / (6 * a), cy / (6 * a)] if abs(a) > 1e-9 else p[0]


def inside(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % len(poly)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def r3(v):
    return round(v, 3)


def rp(p):
    return [r3(p[0]), r3(p[1])]


def hull4(pts):
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    return sorted(pts, key=lambda p: math.atan2(p[1] - cy, p[0] - cx))


def main(src, dst):
    with zipfile.ZipFile(src) as z:
        root = ET.fromstring(z.read('project.xml'))
    bld = root.find('Project/Site/products/_0/products')
    storey = next(p for p in bld if p.attrib.get('class') == 'BuildingStorey')
    slab = next((path_pts(p.attrib['materialContour']) for p in bld
                 if p.attrib.get('class') == 'BuildingSlab' and p.attrib.get('materialContour')), None)
    H = float(storey.attrib.get('storeyHeight', 2.8))

    walls, openings, rooms, loop, fixtures = [], [], [], [], []
    for el in storey.find('products'):
        c = el.attrib.get('class')
        place = el.find('place')
        loc = fl(place.attrib['location'])[:2] if place is not None else [0, 0]
        yaw = yaw_of(place.attrib['direction']) if place is not None else 0.0
        if c == 'Wall':
            t = float(el.attrib.get('thickness', 0.15))
            ctrls = [fl(el.attrib[k]) for k in sorted(el.attrib) if k.startswith('control')]
            length = ctrls[-1][0]
            corners = {}
            for i, tag in ((0, 'wallConnect0'), (1, 'wallConnect1')):
                wc = el.find(tag)
                if wc is not None:
                    corners[i] = (fl(wc.attrib['leftPoint']), fl(wc.attrib['rightPoint']))
            s_l, s_r = corners.get(0, ([0, t / 2], [0, -t / 2]))
            e_l, e_r = corners.get(1, ([length, t / 2], [length, -t / 2]))
            quad = hull4([xf(loc, yaw, p) for p in (s_l, s_r, e_l, e_r)])
            walls.append({'a': xf(loc, yaw, [0, 0]), 'b': xf(loc, yaw, [length, 0]), 't': t,
                          'h': max(cp[2] for cp in ctrls), 'quad': quad, 'len': length})
        elif c == 'Opening':
            cont = path_pts(el.attrib.get('materialContour', 'F1M0 0'))
            xs = [p[0] for p in cont]; zs = [p[1] for p in cont]
            kind = 'window'
            for f in el.iter():
                if f.attrib.get('class') == 'Door':
                    kind = 'door'
            openings.append({'a': xf(loc, yaw, [min(xs), 0]), 'b': xf(loc, yaw, [max(xs), 0]),
                             'sill': min(zs), 'head': max(zs), 'kind': kind})
        elif c == 'RoomSlab' and el.attrib.get('slabType') == '0':
            poly = [xf(loc, yaw, p) for p in path_pts(el.attrib['materialContour'])]
            # a contour may carry holes (columns) as extra closed loops
            loops, cur = [], []
            for p in poly:
                cur.append(p)
                if len(cur) > 3 and math.dist(p, cur[0]) < 1e-3:
                    loops.append(cur[:-1]); cur = []
            if len(cur) >= 3:
                loops.append(cur)
            loops.sort(key=area, reverse=True)
            cap = el.attrib.get('captionLocation')
            rooms.append({'poly': loops[0], 'holes': loops[1:], 'caption': xf(loc, yaw, fl(cap)) if cap else centroid(loops[0])})
        elif c == 'Group':
            for g in el.find('products'):
                gp = g.find('place')
                gl = fl(gp.attrib['location'])[:2]; gy = yaw_of(gp.attrib['direction'])
                sc = fl(gp.attrib['scale']) if 'scale' in gp.attrib else [1, 1, 1]
                _, bb = mesh_aabb(g)
                L = (bb[3] - bb[0]) * sc[0]
                ctr = xf(loc, yaw, gl)
                th = yaw + gy
                u = (math.cos(th), math.sin(th))
                loop.append({'a': [ctr[0] - u[0] * L / 2, ctr[1] - u[1] * L / 2],
                             'b': [ctr[0] + u[0] * L / 2, ctr[1] + u[1] * L / 2]})
        elif c == 'PathBasedBlock':
            poly = [xf(loc, yaw, p) for p in path_pts(el.attrib['materialContour'])][:4]
            fixtures.append({'kind': 'cabinet', 'poly': poly, 'h': float(el.attrib.get('thickness', H))})
        elif c == 'Furniture':
            name, bb = mesh_aabb(el)
            sc = fl(place.attrib['scale']) if 'scale' in place.attrib else [1, 1, 1]
            poly = [xf(loc, yaw, p, sc) for p in ((bb[0], bb[1]), (bb[3], bb[1]), (bb[3], bb[4]), (bb[0], bb[4]))]
            n = (name or '').lower()
            kind = ('wc' if n.startswith('769510') else 'basin' if n.startswith('899500') else
                    'shower' if 'shower' in n else 'kitchen' if 'kitchen' in n else 'table')
            fixtures.append({'kind': kind, 'poly': poly, 'h': bb[5] * sc[2]})

    # --- name rooms
    named = {}
    for key, anchor, label in ROOM_ANCHORS:
        best = min(rooms, key=lambda r: math.dist(r['caption'], anchor))
        named[key] = {'poly': best['poly'], 'holes': best['holes'], 'label': label,
                      'area': round(area(best['poly']) - sum(area(h) for h in best['holes']), 1),
                      'caption': best['caption']}

    def room_at(pt):
        hits = [k for k, r in named.items() if inside(pt, r['poly']) and not any(inside(pt, h) for h in r['holes'])]
        # prefer the smallest containing room (rooms do not overlap, but be safe)
        return min(hits, key=lambda k: named[k]['area']) if hits else None

    # --- classify walls
    out_walls = []
    for w in walls:
        ax, ay = w['a']; bx, by = w['b']
        L = math.hypot(bx - ax, by - ay) or 1e-6
        u = ((bx - ax) / L, (by - ay) / L); n = (-u[1], u[0])
        m = ((ax + bx) / 2, (ay + by) / 2); d = w['t'] / 2 + 0.25
        side_l = room_at((m[0] + n[0] * d, m[1] + n[1] * d))
        side_r = room_at((m[0] - n[0] * d, m[1] - n[1] * d))
        sides = {side_l, side_r}
        if sides == {'covered', 'terrace'}:
            kind = 'planter'
        elif sides & INTERIOR:
            kind = 'full'
        else:
            kind = 'parapet'
        out_walls.append({'a': rp(w['a']), 'b': rp(w['b']), 't': r3(w['t']), 'quad': [rp(p) for p in w['quad']],
                          'kind': kind, 'h': {'full': H, 'parapet': 1.05, 'planter': 0.55}[kind],
                          'sides': [side_l, side_r], 'open': []})

    def host_wall(a, b):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        best = None
        for i, w in enumerate(out_walls):
            ax, ay = w['a']; bx, by = w['b']
            L = math.hypot(bx - ax, by - ay)
            if L < 1e-6:
                continue
            u = ((bx - ax) / L, (by - ay) / L)
            ov = ((b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1]) / (math.dist(a, b) or 1)
            if abs(abs(ov) - 1) > 0.02:
                continue
            s = (mx - ax) * u[0] + (my - ay) * u[1]
            off = abs(-(mx - ax) * u[1] + (my - ay) * u[0])
            if -0.05 <= s <= L + 0.05 and off <= w['t'] / 2 + 0.2:
                if best is None or off < best[1]:
                    best = (i, off, u, (ax, ay), L)
        return best

    def attach(a, b, sill, head, kind, extra=None):
        hw = host_wall(a, b)
        if hw is None:
            print('no host wall for', kind, a, b)
            return
        i, _, u, (ax, ay), L = hw
        s0 = (a[0] - ax) * u[0] + (a[1] - ay) * u[1]
        s1 = (b[0] - ax) * u[0] + (b[1] - ay) * u[1]
        s0, s1 = sorted((max(0, s0), min(L, s1)) if s0 < s1 else (max(0, s1), min(L, s0)))
        rec = {'s0': r3(s0), 's1': r3(s1), 'sill': r3(sill), 'head': r3(min(head, H)), 'kind': kind}
        if extra:
            rec.update(extra)
        out_walls[i]['open'].append(rec)

    for o in openings:
        if o['kind'] == 'door':
            mid = ((o['a'][0] + o['b'][0]) / 2, (o['a'][1] + o['b'][1]) / 2)
            hinge, odir = min(DOOR_SWINGS, key=lambda d: math.dist(d[0], mid))
            front = math.dist(hinge, (11.08, 5.29)) < 0.2
            attach(o['a'], o['b'], o['sill'], o['head'], 'front' if front else 'door',
                   {'hinge': list(hinge), 'swing': list(odir)})
        else:
            hw = host_wall(o['a'], o['b'])
            if hw and out_walls[hw[0]]['kind'] == 'planter':
                continue  # covered terrace: no glazing on the saw-tooth line
            attach(o['a'], o['b'], o['sill'], o['head'], 'window')

    for a0, b0, sill, head in ADDED_WINDOWS:
        # the kitchen window has two panes on one mullion (photo 61)
        attach(a0, b0, sill, head, 'window', {'panels': 2} if a0[0] == 8.2 else None)
    # the glazed door at the east end of the south corridor, onto the pergola terrace (photo 21)
    attach((21.52, 0.45), (21.52, 1.38), 0.0, 2.45, 'door', {'hinge': [21.52, 0.45], 'swing': [1, 0], 'glazed': True})
    # a 1 m gap in the north planter: the way from the covered terrace onto the open terrace
    attach((22.3, 11.401), (23.3, 11.401), 0.0, 0.55, 'gap')

    for w in out_walls:
        w['open'].sort(key=lambda o: o['s0'])

    # --- order the floor inlay into one closed polyline
    segs = [(tuple(s['a']), tuple(s['b'])) for s in loop]
    chain = [segs.pop(0)]
    while segs:
        end = chain[-1][1]
        j = min(range(len(segs)), key=lambda k: min(math.dist(end, segs[k][0]), math.dist(end, segs[k][1])))
        s = segs.pop(j)
        chain.append(s if math.dist(end, s[0]) <= math.dist(end, s[1]) else (s[1], s[0]))
    inlay = []
    for k, (a, b) in enumerate(chain):
        prev = chain[k - 1][1]
        inlay.append(rp(((a[0] + prev[0]) / 2, (a[1] + prev[1]) / 2)))

    # --- dimension strings (from the model, not the 2018 drawing)
    def dim(a, b, off, text=None):
        return {'a': rp(a), 'b': rp(b), 'off': off, 'text': text or f'{math.dist(a, b):.2f}'}

    sx = [p[0] for p in slab]; sy = [p[1] for p in slab]
    hall = named['hall']['poly']; big = named['big']['poly']; kit = named['kitchen']['poly']
    hx = [p[0] for p in hall]; hy = [p[1] for p in hall]
    bxs = [p[0] for p in big]; bys = [p[1] for p in big]
    kx = [p[0] for p in kit]; ky = [p[1] for p in kit]
    dims = [
        dim((min(sx), max(sy)), (max(sx), max(sy)), 1.6),
        dim((max(sx), min(sy)), (max(sx), max(sy)), -1.6),
        dim((min(hx), 12.25), (max(hx), 12.25), -0.7),
        dim((min(bxs), 12.25), (max(bxs), 12.25), -0.7),
        dim((2.2, 6.64), (2.2, 12.25), 0.0),
        dim((min(kx), min(ky)), (max(kx), min(ky)), 0.7),
        dim((max(kx), min(ky)), (max(kx), max(ky)), -0.7),
    ]

    data = {
        'source': 'Platform.lhzd (Live Home 3D), Platform 593, Achrafieh',
        'storeyHeight': H,
        'slab': [rp(p) for p in slab],
        'rooms': {k: {'poly': [rp(p) for p in r['poly']], 'holes': [[rp(p) for p in h] for h in r['holes']],
                      'label': r['label'], 'area': r['area'],
                      'caption': rp(r['caption']), 'outdoor': k in OUTDOOR} for k, r in named.items()},
        'walls': out_walls,
        'inlay': inlay,
        'fixtures': [{'kind': f['kind'], 'poly': [rp(p) for p in f['poly']], 'h': r3(f['h'])} for f in fixtures],
        'dims': dims,
    }
    with open(dst, 'w') as f:
        f.write('// Generated by tools/make_plan.py from the Live Home 3D model. Do not edit by hand.\n')
        f.write('// Plan frame: x east, y north (as drawn), metres.\n')
        f.write('export const PLAN = ')
        json.dump(data, f, separators=(',', ':'))
        f.write(';\n')
    kinds = {}
    for w in out_walls:
        kinds[w['kind']] = kinds.get(w['kind'], 0) + 1
    print('walls', kinds, 'openings', sum(len(w['open']) for w in out_walls), 'inlay pts', len(inlay),
          'rooms', {k: r['area'] for k, r in named.items()})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
