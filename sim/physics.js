import { MAP } from './map.js';

export const M = globalThis.Matter;
export const { Engine, Bodies, Body, Composite, Constraint, Events, Query, Vector } = M;

export const CAT = { world: 1, actor: 2, prop: 4, limb: 8, bullet: 16, cable: 1 << 20, sensor: 1 << 21, minion: 1 << 22 };
// Each one-way platform has its own collision bit (bits 5..19), so an arena has at most 15 of them.
export const onewayBit = i => 32 << i;
export const MAX_ONEWAY = 15;
export const ALL_ONEWAY = Array.from({ length: MAX_ONEWAY }, (_, i) => onewayBit(i)).reduce((m, b) => m | b, 0);
export const MASK = {
  actor: CAT.world | CAT.actor | CAT.prop | CAT.bullet,
  prop: CAT.world | CAT.actor | CAT.prop | CAT.limb | CAT.bullet | CAT.cable | CAT.minion | ALL_ONEWAY,
  // The axolotl's clones stand on floors and props and pass through fighters and each other.
  minion: CAT.world | CAT.prop,
  limb: CAT.world | CAT.prop | CAT.limb | CAT.bullet | CAT.cable | ALL_ONEWAY,
  bullet: CAT.world | CAT.actor | CAT.prop | CAT.limb,
  cable: CAT.world | CAT.prop | CAT.limb | ALL_ONEWAY,
  lamp: CAT.actor | CAT.prop | CAT.limb | CAT.bullet
};
// Per-step gravity in world units (Matter: 1.35 * 0.001 * 16.67ms^2).
export const GRAV = 1.35 * 0.001 * (1000 / 60) ** 2;

export function createEngine() {
  return Engine.create({ gravity: { x: 0, y: 1.35 }, positionIterations: 8, velocityIterations: 6, constraintIterations: 6 });
}

export function buildStatic(world) {
  const statics = [];
  for (const s of MAP.solids) {
    const body = Bodies.rectangle((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.x1 - s.x0, s.y1 - s.y0, {
      isStatic: true, friction: 0.8, collisionFilter: { category: CAT.world, mask: 0xffffffff }, label: 'solid'
    });
    body.plugin.surface = s;
    statics.push(body);
  }
  const oneways = MAP.oneway.map((p, i) => {
    // The collision body runs deeper than the drawn catwalk so fast ragdoll parts cannot tunnel it.
    const depth = p.h + 10;
    const body = Bodies.rectangle((p.x0 + p.x1) / 2, p.y + depth / 2, p.x1 - p.x0, depth, {
      isStatic: true, friction: 0.8, collisionFilter: { category: onewayBit(i), mask: 0xffffffff }, label: 'oneway'
    });
    body.plugin.oneway = { ...p, index: i };
    return body;
  });
  Composite.add(world, [...statics, ...oneways]);
  return { statics, oneways };
}

// Top of the first walkable surface at or below y (solid, one-way). Falls back to the floor.
export function surfaceY(x, y, { oneway = true } = {}) {
  let best = Infinity;
  for (const s of MAP.solids) if (s.kind !== 'wall' && x >= s.x0 && x <= s.x1 && s.y0 >= y - 2 && s.y0 < best) best = s.y0;
  if (oneway) MAP.oneway.forEach((p, i) => { if (!MAP.off?.[i] && x >= p.x0 && x <= p.x1 && p.y >= y - 2 && p.y < best) best = p.y; });
  return best === Infinity ? MAP.floorY + 60 : best;
}

export function inPit(x) {
  return x > MAP.pit.x0 && x < MAP.pit.x1;
}

export const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
