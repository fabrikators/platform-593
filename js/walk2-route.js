// The second walk (walk2.html): from the sheet down into the big room, through the hall and the lobby,
// into the kitchen, along the south corridor and out through the glazed door onto the pergola terrace,
// then back up to the sheet. One timeline p in [0, 1].
import * as THREE from 'three';
import { Ride, riseU, ramp, ease, easeIO } from './camera.js';

export const T2 = {
  hold: 0.035,     // the sheet, still
  fall0: 0.04,     // the fall into the big room (the closing rise of the first walk, run backwards)
  fall1: 0.16,
  t0: 0.16,        // walking
  t1: 0.915,
  rise0: 0.925,    // back up to the sheet
  rise1: 0.995,
};

// plan points (x east, y north), eye height 1.6 m
const PATH = [
  [3.45, 7.75], [3.5, 8.9],                       // the big room, facing the balcony doors
  [4.55, 9.0], [5.05, 7.6], [5.45, 7.23],         // round to its door
  [6.45, 7.25], [6.6, 8.65],                      // the vestibule, into the hall
  [9.5, 8.65], [13.7, 8.65], [14.6, 8.3],         // east along the long wall, clear of its paintings
  [14.6, 7.3], [13.7, 6.7], [13.5, 5.6],          // round its end, into the lobby by the front door
  [13.62, 3.84], [13.62, 2.3], [13.45, 1.32],     // through the door into the south strip
  [12.94, 1.27], [12.2, 1.1], [11.5, 0.8],        // through the kitchen door, clear of its open leaf
  [10.95, 0.45], [10.3, -0.25],                   // the window run, then the south run
  [10.8, 0.25], [11.6, 0.82],                     // step back, turn
  [12.4, 1.06], [12.94, 1.1],                     // out of the kitchen
  [13.55, 0.93], [14.5, 0.93], [20.7, 0.93],      // the corridor
  [21.52, 0.9], [22.25, 0.98],                    // the glazed door, onto the terrace
];

export const RIDE2 = new Ride(PATH, {
  tTurn: T2.t0, t0: T2.t0, t1: T2.t1, pitch: -7, look: [1.2, 0.28], endPad: 1.6, dropInTurns: false,
  marks: { bigDoor: [5.74, 7.23], hall: [6.6, 8.65], lobby: [13.5, 5.6], strip: [13.62, 3.84], kdoor: [12.94, 1.27], kout: [12.94, 1.1], corridor: [14.5, 0.93], tdoor: [21.52, 0.9] },
  looks: [
    // the big room: the glazed doors onto the balcony
    { key: 'room', at: [3.45, 7.75], target: [3.4, 1.35, 12.25], span: [0.01, 1.8], dwell: 6, dwellWidth: 0.6 },
    // the kitchen: the window run, then the south run and the tall unit
    { key: 'window', at: [10.95, 0.45], target: [8.33, 1.05, -0.4], span: [1.1, 0.8], dwell: 5.5, dwellWidth: 0.5 },
    { key: 'south', at: [10.3, -0.25], target: [8.9, 1.05, -1.75], span: [0.7, 0.9], dwell: 5, dwellWidth: 0.5 },
  ],
  // quicker through the hall and the lobby, slower at the doors
  dips: (m, len) => [[m.hall + 4.5, -0.3, 3.0], [m.lobby, -0.35, 1.4], [m.bigDoor, 1.2, 0.6], [m.strip, 0.9, 0.5], [m.kdoor, 1.0, 0.5], [m.kout, 0.8, 0.5], [m.tdoor, 1.4, 0.7], [len, 3.0, 1.0]],
  final: [24.4, 1.35, -4.2],   // north-east over the counter, under the pergola
  finalFrom: (m) => m.tdoor - 0.2,
});

// the ride's first and last poses, for the fall and the rise
const blank = () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 58, dist: 3 });
let first = null, last = null;
export function pose2(p, aspect, out) {
  first ||= RIDE2.pose(T2.t0 + 1e-6, { pos: new THREE.Vector3(3.45, 1.6, -7.0), target: new THREE.Vector3(3.45, 1.4, -10.0) }, blank());
  last ||= RIDE2.pose(T2.t1, first, blank());
  if (p < T2.fall1) return riseU(1 - ramp(p, T2.fall0, T2.fall1), first, aspect, out);
  if (p > T2.rise0) return riseU(ramp(p, T2.rise0, T2.rise1), last, aspect, out);
  return RIDE2.pose(THREE.MathUtils.clamp(p, T2.t0 + 1e-6, T2.t1), first, out);
}

export { ramp, ease, easeIO };
