// The arenas. World units (960 x 540, one screen); every coordinate is a multiple of 3 so it lands on
// whole pixels (S = 2/3). MAP is the arena being played: useMap() fills it with one of MAPS, and the
// whole simulation and renderer read it from there. windows (view pixels): where the moonlight comes in.

// "Depósito 07 — Turno da Noite".
const DEPOT = {
  id: 'depot',
  name: 'DEPÓSITO 07',
  subtitle: 'TURNO DA NOITE',
  floorY: 492,
  solids: [
    { id: 'floorL', x0: 0, y0: 492, x1: 432, y1: 564, kind: 'floor' },
    { id: 'floorR', x0: 528, y0: 492, x1: 960, y1: 564, kind: 'floor' },
    { id: 'wallL', x0: -48, y0: -420, x1: 0, y1: 564, kind: 'wall' },
    { id: 'wallR', x0: 960, y0: -420, x1: 1008, y1: 564, kind: 'wall' },
    { id: 'blockL', x0: 0, y0: 240, x1: 150, y1: 300, kind: 'block' },
    { id: 'blockR', x0: 810, y0: 240, x1: 960, y1: 300, kind: 'block' },
    { id: 'pitFloor', x0: 432, y0: 558, x1: 528, y1: 600, kind: 'pit' }
  ],
  oneway: [
    { id: 'catL', x0: 156, x1: 336, y: 372, h: 12, kind: 'catwalk' },
    { id: 'catR', x0: 624, x1: 804, y: 372, h: 12, kind: 'catwalk' },
    { id: 'bridgeL', x0: 345, x1: 438, y: 252, h: 12, kind: 'bridge' },
    { id: 'bridgeR', x0: 522, x1: 615, y: 252, h: 12, kind: 'bridge' },
    { id: 'gantry', x0: 240, x1: 720, y: 135, h: 12, kind: 'gantry' }
  ],
  ladders: [{ x: 186, top: 372, bottom: 492 }, { x: 774, top: 372, bottom: 492 }],
  spawns: [[246, 343], [714, 343], [390, 223], [570, 223]],
  pit: { x0: 432, x1: 528, y0: 504, y1: 558, text: 'TRITURADO!' },
  windows: [{ x: 20, y: 18, w: 186, h: 128 }, { x: 246, y: 18, w: 148, h: 104 }, { x: 434, y: 18, w: 186, h: 128 }],
  conveyor: { x0: 165, x1: 372, y: 492, speed: 1.4, lever: { x: 141, y: 468 } },
  press: { x0: 852, x1: 948, rest: 300, bottom: 492, headH: 48, button: { x: 801, y: 321, w: 9, h: 18 }, interval: 8, warn: 1.6 },
  cable: { x: 78, y: 300, segments: 12, segLen: 15 },
  puddle: { x0: 21, x1: 120, y: 492 },
  cargo: { x: 480, anchorY: 147, w: 60, h: 42, chain: 99 },
  lamps: [
    { x: 150, y: -6, len: 72 }, { x: 330, y: -6, len: 57 }, { x: 630, y: -6, len: 57 }, { x: 810, y: -6, len: 72 },
    { x: 246, y: 384, len: 18 }, { x: 714, y: 384, len: 18 }, { x: 570, y: 264, len: 21 }
  ],
  glass: [{ x: 150, y0: 168, y1: 240 }, { x: 810, y0: 168, y1: 240 }],
  props: [
    { kind: 'crate', x: 291, y: 358 }, { kind: 'crate', x: 318, y: 358 }, { kind: 'crate', x: 304, y: 331 },
    { kind: 'crate', x: 603, y: 478 }, { kind: 'crate', x: 630, y: 478 }, { kind: 'crate', x: 616, y: 451 },
    { kind: 'crate', x: 693, y: 478 },
    { kind: 'barrel', x: 561, y: 475 }, { kind: 'barrel', x: 789, y: 355 }, { kind: 'barrel', x: 36, y: 223 },
    { kind: 'propane', x: 597, y: 237 }, { kind: 'extinguisher', x: 924, y: 227 },
    { kind: 'pipe', x: 762, y: 488 }, { kind: 'gun', x: 228, y: 366, weapon: 'pistol' }, { kind: 'gun', x: 732, y: 366, weapon: 'shotgun' },
    { kind: 'blade', x: 108, y: 236 }, { kind: 'katana', x: 600, y: 470 }, { kind: 'spear', x: 380, y: 238 }, { kind: 'grenade', x: 369, y: 245 }, { kind: 'molotov', x: 666, y: 362 },
    { kind: 'mine', x: 666, y: 488 }, { kind: 'c4', x: 210, y: 487 }
  ]
};

// "Castelo — Salão do Relógio": a gothic hall at midnight. The same bones as the depot (floor with a pit in
// the middle, two balconies with ladders, two bridges, the high gallery, two towers) so everyone fights
// the same way, but everything in it can be touched (sim/castle.js):
//  - candles on stands (candles): break one and it drops something; they light again later;
//  - the chandelier hangs from the gallery over the pit: cut its chain and it crashes down burning;
//  - two pendulum blades swing from the gallery across the balconies (pendulums);
//  - a loose stone over the spike pit (the 'crumble' ledge) gives way under whoever stands on it;
//  - suits of armor (armors) fall apart under blows and leave their weapon;
//  - SECRET: the cracked wall at the left end of the floor (cracked) hides a roast in an alcove;
//  - SECRET: strike the gargoyle at the right tower and its door opens: the hidden room on top of
//    the tower (towerR) keeps a chest.
const CASTLE = {
  id: 'castle',
  name: 'CASTELO',
  subtitle: 'SALÃO DO RELÓGIO',
  floorY: 492,
  solids: [
    { id: 'floorL', x0: 0, y0: 492, x1: 432, y1: 564, kind: 'floor' },
    { id: 'floorR', x0: 528, y0: 492, x1: 960, y1: 564, kind: 'floor' },
    { id: 'wallL', x0: -48, y0: -420, x1: 0, y1: 564, kind: 'wall' },
    { id: 'wallR', x0: 960, y0: -420, x1: 1008, y1: 564, kind: 'wall' },
    { id: 'towerL', x0: 0, y0: 240, x1: 150, y1: 300, kind: 'block' },
    // The hidden room: its floor (the right tower) and its roof; the door is the gap between them at
    // x 810..834 (sim/castle.js). The bots never path into it.
    { id: 'towerR', x0: 810, y0: 240, x1: 960, y1: 300, kind: 'block', nav: false },
    { id: 'roofR', x0: 810, y0: 117, x1: 960, y1: 150, kind: 'block' },
    { id: 'pitFloor', x0: 432, y0: 558, x1: 528, y1: 600, kind: 'pit' }
  ],
  oneway: [
    { id: 'balcL', x0: 156, x1: 336, y: 372, h: 12, kind: 'balcony' },
    { id: 'balcR', x0: 624, x1: 804, y: 372, h: 12, kind: 'balcony' },
    { id: 'bridgeL', x0: 345, x1: 438, y: 252, h: 12, kind: 'bridge' },
    { id: 'bridgeR', x0: 522, x1: 615, y: 252, h: 12, kind: 'bridge' },
    { id: 'gallery', x0: 240, x1: 720, y: 135, h: 12, kind: 'gallery' },
    { id: 'crumble', x0: 450, x1: 510, y: 420, h: 12, kind: 'crumble', nav: false }
  ],
  ladders: [{ x: 186, top: 372, bottom: 492 }, { x: 774, top: 372, bottom: 492 }],
  spawns: [[246, 343], [714, 343], [390, 223], [570, 223]],
  pit: { x0: 432, x1: 528, y0: 504, y1: 558, text: 'ESPETADO!' },
  windows: [{ x: 22, y: 18, w: 56, h: 120 }, { x: 178, y: 26, w: 46, h: 96 }, { x: 416, y: 26, w: 46, h: 96 }, { x: 562, y: 18, w: 56, h: 120 }],
  // The great clock on the back wall over the gallery (view pixels): its hands tell real match time.
  clock: { x: 320, y: 46, r: 34 },
  chandelier: { x: 480, anchorY: 147, w: 60, h: 27, chain: 93 },
  pendulums: [{ x: 246, y: 147, len: 200, amp: 0.5, period: 3.4, phase: 0 }, { x: 714, y: 147, len: 200, amp: 0.5, period: 3.4, phase: 1.7 }],
  // Candles stand on a surface: x, and y of that surface.
  candles: [{ x: 96, y: 492 }, { x: 870, y: 492 }, { x: 222, y: 372 }, { x: 738, y: 372 }, { x: 384, y: 252 }, { x: 576, y: 252 }, { x: 318, y: 135 }, { x: 642, y: 135 }, { x: 36, y: 240 }],
  armors: [{ x: 99, y: 240, weapon: 'axe' }, { x: 918, y: 492, weapon: 'spear' }],
  cracked: { x0: 30, x1: 54, y0: 420, y1: 492, roast: { x: 15, y: 492 } },
  gargoyle: { x: 801, y: 141 },
  door: { x0: 810, x1: 834, y0: 150, y1: 240 },
  chest: { x: 912, y: 240 },
  glass: [{ x: 150, y0: 168, y1: 240 }],
  props: [
    { kind: 'crate', x: 291, y: 358 }, { kind: 'crate', x: 669, y: 358 },
    { kind: 'barrel', x: 600, y: 475 }, { kind: 'barrel', x: 330, y: 475 },
    { kind: 'katana', x: 696, y: 470 }, { kind: 'spear', x: 380, y: 238 }, { kind: 'blade', x: 588, y: 238 },
    { kind: 'molotov', x: 252, y: 362 }, { kind: 'gun', x: 480, y: 125, weapon: 'pistol' }
  ]
};

export const MAPS = { depot: DEPOT, castle: CASTLE };
export const MAP_IDS = Object.keys(MAPS);
export const MAP = {};
// Make id the arena being played (the depot if it is unknown). Cheap when it already is.
export function useMap(id) {
  const def = MAPS[id] || DEPOT;
  if (MAP.id === def.id) return MAP;
  for (const k of Object.keys(MAP)) delete MAP[k];
  Object.assign(MAP, def);
  return MAP;
}
useMap('depot');

// Walkable surfaces for the navigation graph.
export function surfaces() {
  const list = [];
  for (const s of MAP.solids) if ((s.kind === 'floor' || s.kind === 'block') && s.nav !== false) list.push({ id: s.id, x0: Math.max(12, s.x0 + 12), x1: Math.min(948, s.x1 - 12), y: s.y0, oneway: false, solid: s });
  MAP.oneway.forEach((p, i) => { if (p.nav !== false) list.push({ id: p.id, x0: p.x0 + 10, x1: p.x1 - 10, y: p.y, oneway: true, index: i }); });
  return list;
}

const JUMP_H = 150, GAP = 112;
export function buildNav() {
  const nodes = surfaces(), edges = [];
  for (const a of nodes) for (const b of nodes) {
    if (a === b) continue;
    const ox0 = Math.max(a.x0, b.x0), ox1 = Math.min(a.x1, b.x1), overlap = ox1 - ox0;
    const dy = a.y - b.y;
    if (dy > 0 && dy <= JUMP_H) {
      if (b.oneway && overlap >= 24) edges.push({ from: a.id, to: b.id, type: 'up', x0: ox0 + 8, x1: ox1 - 8, cost: 1.4 + dy / 120 });
      else {
        // Jump onto the side of a block or across a gap upward.
        if (b.x1 < a.x1 && a.x1 - b.x1 > 18 && (a.x0 <= b.x1 + GAP)) edges.push({ from: a.id, to: b.id, type: 'leap', takeoff: Math.max(a.x0, b.x1 + 22), dir: -1, land: b.x1 - 24, cost: 2.2 + dy / 100 });
        if (b.x0 > a.x0 && b.x0 - a.x0 > 18 && (a.x1 >= b.x0 - GAP)) edges.push({ from: a.id, to: b.id, type: 'leap', takeoff: Math.min(a.x1, b.x0 - 22), dir: 1, land: b.x0 + 24, cost: 2.2 + dy / 100 });
      }
    } else if (dy < 0) {
      if (a.oneway && overlap >= 24) edges.push({ from: a.id, to: b.id, type: 'drop', x0: ox0 + 8, x1: ox1 - 8, cost: 0.8 });
      if (b.x0 <= a.x1 + 40 && b.x1 > a.x1 + 10) edges.push({ from: a.id, to: b.id, type: 'fall', edge: a.x1, dir: 1, land: Math.max(b.x0 + 14, a.x1 + 26), cost: 1 });
      if (b.x1 >= a.x0 - 40 && b.x0 < a.x0 - 10) edges.push({ from: a.id, to: b.id, type: 'fall', edge: a.x0, dir: -1, land: Math.min(b.x1 - 14, a.x0 - 26), cost: 1 });
    } else if (dy === 0) {
      if (b.x0 > a.x1 && b.x0 - a.x1 <= GAP + 24) edges.push({ from: a.id, to: b.id, type: 'leap', takeoff: a.x1 - 6, dir: 1, land: b.x0 + 26, cost: 1.8 });
      if (b.x1 < a.x0 && a.x0 - b.x1 <= GAP + 24) edges.push({ from: a.id, to: b.id, type: 'leap', takeoff: a.x0 + 6, dir: -1, land: b.x1 - 26, cost: 1.8 });
    }
  }
  return { nodes, edges };
}

export function pathTo(nav, from, to) {
  if (from === to) return [];
  const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
  while (open.size) {
    let cur = null;
    for (const n of open) if (cur === null || dist.get(n) < dist.get(cur)) cur = n;
    open.delete(cur);
    if (cur === to) break;
    for (const e of nav.edges) if (e.from === cur) {
      const d = dist.get(cur) + e.cost;
      if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); prev.set(e.to, e); open.add(e.to); }
    }
  }
  if (!prev.has(to)) return null;
  const path = [];
  for (let n = to; n !== from; n = prev.get(n).from) path.unshift(prev.get(n));
  return path;
}
