// "Depósito 07 — Turno da Noite". World units; every coordinate is a multiple of 3 so it lands on whole pixels.
export const MAP = {
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
  pit: { x0: 432, x1: 528, y0: 504, y1: 558 },
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

// Walkable surfaces for the navigation graph.
export function surfaces() {
  const list = [];
  for (const s of MAP.solids) if (s.kind === 'floor' || s.kind === 'block') list.push({ id: s.id, x0: Math.max(12, s.x0 + 12), x1: Math.min(948, s.x1 - 12), y: s.y0, oneway: false, solid: s });
  MAP.oneway.forEach((p, i) => list.push({ id: p.id, x0: p.x0 + 10, x1: p.x1 - 10, y: p.y, oneway: true, index: i }));
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
