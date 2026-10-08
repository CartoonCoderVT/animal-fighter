import { Bodies, Body, Composite, Constraint, CAT, MASK, inPit, surfaceY } from './physics.js';
import { pose, PARENT, MASS, LIMITS, subtree, partBox, HALF_H } from '../render/rig.js';
import { rnd, clamp, wrapAngle } from '../engine/const.js';
import { MAP } from './map.js';

let groupSeq = 1;
const RAG_LIFT = 3;

export function makeLimb(g, a, b, { velocity = { x: 0, y: 0 }, group = 0, life = 26, spin = 0.12, lift = 0 } = {}) {
  const [w, h] = partBox(a.type, b.name);
  const x = a.x + b.x * a.face, y = a.y + b.y - lift, angle = b.angle * a.face;
  const body = Bodies.rectangle(x, y, w, h, {
    angle, density: (MASS[b.name] * 0.4) / (w * h), friction: 0.7, frictionAir: 0.012, restitution: 0.12,
    chamfer: { radius: Math.min(w, h) * 0.3 }, collisionFilter: { category: CAT.limb, mask: MASK.limb, group }, label: 'limb'
  });
  const limb = {
    id: g.nextId++, body, type: a.type, part: b.name, actor: a.id, face: a.face, scale: 1,
    wounds: (a.wounds[b.name] || []).map(w => ({ ...w })), char: a.char || 0, frozen: a.frozen > 0, life, maxLife: life,
    attached: false, ragdoll: null, owner: null, throwTime: 0, hp: 30, x, y, angle, bleed: 0,
    cut: b.name === 'body' ? a.severed.filter(n => n !== 'body') : []
  };
  body.plugin.limb = limb;
  g.limbs.push(limb);
  Composite.add(g.engine.world, body);
  Body.setVelocity(body, { x: velocity.x + rnd(-1, 1), y: velocity.y + rnd(-1, 0.5) });
  Body.setAngularVelocity(body, rnd(-spin, spin));
  return limb;
}

export function buildRagdoll(g, a, { velocity = { x: 0, y: 0 }, alive = true, spin = 0.06 } = {}) {
  const bones = pose(a, g.time).filter(b => !a.severed.includes(b.name));
  const group = -(groupSeq++);
  const r = { id: g.nextId++, actor: a.id, limbs: {}, joints: [], alive, muscle: alive ? 1 : 0, group, detached: false };
  for (const b of bones) {
    // Built a little above the ground so no part starts inside the floor or a catwalk.
    const limb = makeLimb(g, a, b, { velocity, group, spin, lift: RAG_LIFT });
    limb.attached = true;
    // A body that drops right beside crates would be born inside them and shoved away: ignore
    // objects for a moment while it settles.
    limb.body.collisionFilter.mask = MASK.limb & ~CAT.prop;
    limb.propGrace = 0.2;
    limb.ragdoll = r;
    r.limbs[b.name] = limb;
  }
  for (const b of bones) {
    const parent = PARENT[b.name];
    if (!parent || !r.limbs[parent]) continue;
    const P = r.limbs[parent].body, C = r.limbs[b.name].body;
    const pivot = { x: a.x + b.px * a.face, y: a.y + b.py - RAG_LIFT };
    const c = Constraint.create({
      bodyA: P, bodyB: C, pointA: { x: pivot.x - P.position.x, y: pivot.y - P.position.y },
      pointB: { x: pivot.x - C.position.x, y: pivot.y - C.position.y }, length: 0, stiffness: 0.95, damping: 0.08
    });
    const [lo, hi] = LIMITS[b.name] || [-0.5, 0.5];
    const min = a.face > 0 ? lo : -hi, max = a.face > 0 ? hi : -lo;
    const rel = wrapAngle(C.angle - P.angle);
    r.joints.push({ c, parent, child: b.name, min, max, strain: 0, target: clamp(rel, min, max) * 0.6 });
    Composite.add(g.engine.world, c);
  }
  g.ragdolls.push(r);
  return r;
}

// A raw end where a part tore off its parent, in the part's own pixel space.
export function addStump(l) {
  if (l.part === 'body' || l.wounds.some(w => w.t === 'stump')) return;
  l.wounds.push({ u: 0, v: l.part.startsWith('foot') ? -1 : 0, t: 'stump', s: 2 });
}

export function ragdollOf(g, a) {
  return g.ragdolls.find(r => r.actor === a.id && !r.detached);
}

export function stepRagdolls(g, dt) {
  for (const r of g.ragdolls) {
    for (const j of r.joints) {
      if (j.broken) continue;
      const P = r.limbs[j.parent]?.body, C = r.limbs[j.child]?.body;
      if (!P || !C) continue;
      // Measure around the middle of the allowed range so wide joints never wrap past ±π.
      const mid = (j.min + j.max) / 2;
      const rel = mid + wrapAngle(C.angle - P.angle - mid), relVel = C.angularVelocity - P.angularVelocity;
      const total = P.mass + C.mass, wc = P.mass / total, wp = C.mass / total;
      let corr = 0;
      if (rel < j.min || rel > j.max) {
        const excess = rel < j.min ? rel - j.min : rel - j.max;
        corr += (Math.sign(relVel) === Math.sign(excess) ? relVel * 0.9 : 0) + excess * 0.2;
        // Positional fix around the joint pivot keeps the limb attached while it snaps back.
        const px = P.position.x + j.c.pointA.x, py = P.position.y + j.c.pointA.y;
        Body.rotate(C, -excess * 0.8 * wc, { x: px, y: py });
        Body.rotate(P, excess * 0.8 * wp, { x: px, y: py });
      }
      if (r.alive && r.muscle > 0) corr += ((rel - j.target) * 0.05 + relVel * 0.1) * r.muscle;
      if (corr) {
        Body.setAngularVelocity(C, C.angularVelocity - corr * wc);
        Body.setAngularVelocity(P, P.angularVelocity + corr * wp);
      }
      const ax = P.position.x + j.c.pointA.x, ay = P.position.y + j.c.pointA.y;
      const bx = C.position.x + j.c.pointB.x, by = C.position.y + j.c.pointB.y;
      const stretch = Math.hypot(ax - bx, ay - by);
      if ((g.settings.gore ?? 2) === 2 && stretch > 7) j.strain += stretch - 7;
      else j.strain *= 0.85;
      if (j.strain > 12) breakJoint(g, r, j, 'stretch');
    }
    if (r.alive) r.muscle = Math.max(0.3, r.muscle - dt * 0.45);
  }
}

// After the solver: contacts can shove small paws past their limits, so snap them back.
export function settleLimits(g) {
  for (const r of g.ragdolls) for (const j of r.joints) {
    if (j.broken) continue;
    const P = r.limbs[j.parent]?.body, C = r.limbs[j.child]?.body;
    if (!P || !C) continue;
    const mid = (j.min + j.max) / 2;
    const rel = mid + wrapAngle(C.angle - P.angle - mid);
    if (rel >= j.min && rel <= j.max) continue;
    const excess = rel < j.min ? rel - j.min : rel - j.max;
    const wc = P.mass / (P.mass + C.mass);
    const px = P.position.x + j.c.pointA.x, py = P.position.y + j.c.pointA.y;
    Body.rotate(C, -excess * wc, { x: px, y: py });
    Body.rotate(P, excess * (1 - wc), { x: px, y: py });
    const relVel = C.angularVelocity - P.angularVelocity;
    if (Math.sign(relVel) === Math.sign(excess)) {
      Body.setAngularVelocity(C, C.angularVelocity - relVel * wc);
      Body.setAngularVelocity(P, P.angularVelocity + relVel * (1 - wc));
    }
  }
}

export function breakJoint(g, r, j, cause = 'cut') {
  if (j.broken) return;
  j.broken = true;
  Composite.remove(g.engine.world, j.c);
  const child = r.limbs[j.child];
  const a = g.actor(r.actor);
  const names = subtree(j.child).filter(n => r.limbs[n]);
  for (const n of names) r.limbs[n].attached = false;
  if (a && !a.dead && !r.detached) {
    for (const n of names) if (!a.severed.includes(n)) a.severed.push(n);
    a.stumps.push(j.parent);
    if (j.child === 'armF') a.weapon = null;
  }
  if (child) { child.bleed = 4; addStump(child); }
  const p = r.limbs[j.parent];
  if (p) { p.bleed = Math.max(p.bleed, 3); (p.cut ||= []).push(j.child); }
  const pos = child?.body.position || p?.body.position;
  if (pos) {
    g.fx('blood', { x: pos.x, y: pos.y, dx: rnd(-2, 2), dy: -3, n: 18, s: 4 });
    if (cause !== 'gib') g.text(pos.x, pos.y - 14, 'CRAC!', '#e99598');
  }
  g.sound('crack', pos?.x);
}

export function pushActor(g, a, vx, vy, mode = 'add') {
  const r = a.knocked ? ragdollOf(g, a) : null;
  if (r) {
    for (const l of Object.values(r.limbs)) if (l.attached) {
      const v = l.body.velocity;
      Body.setVelocity(l.body, mode === 'set' ? { x: vx, y: vy } : { x: v.x + vx, y: v.y + vy });
    }
    return;
  }
  const v = a.body.velocity;
  Body.setVelocity(a.body, mode === 'set' ? { x: vx, y: vy } : { x: v.x + vx, y: v.y + vy });
}

export function releaseHeld(g, a) {
  if (a.holding) {
    const p = g.props.find(p => p.id === a.holding);
    if (p) {
      p.held = false;
      Body.setStatic(p.body, false);
      p.body.collisionFilter.mask = MASK.prop;
    }
    a.holding = null;
  }
  if (a.holdJoint) Composite.remove(g.engine.world, a.holdJoint);
  a.holdJoint = null;
  a.holdingLimb = null;
  if (a.act === 'carry' || a.act === 'shake') a.act = null;
}

export function knockdown(g, a, { velocity = { x: 0, y: -2 }, time = 1.6 } = {}) {
  if (a.dead) return;
  if (a.knocked) {
    a.knock = Math.min(3, a.knock + time * 0.35);
    pushActor(g, a, velocity.x * 0.7, velocity.y * 0.7);
    return;
  }
  releaseHeld(g, a);
  a.act = null;
  a.hits = null;
  a.hitlag = 0; a.lagPos = null;
  a.climbing = false;
  a.dodge = 0;
  a.knocked = true;
  a.knockTime = 0;
  a.knock = time;
  a.getup = 0;
  a.frozen = 0;
  const v = a.body.velocity;
  buildRagdoll(g, a, { velocity: { x: v.x * 0.5 + velocity.x, y: v.y * 0.5 + velocity.y }, alive: true });
  Composite.remove(g.engine.world, a.body);
  g.fx('dust', { x: a.x, y: a.y + HALF_H - 2, n: 6 });
}

// Ragdoll back to an animated fighter, keeping any severed pieces on the floor.
export function recover(g, a) {
  const r = ragdollOf(g, a);
  if (!r) { a.knock = 0; a.knocked = false; return true; }
  const core = r.limbs.body || Object.values(r.limbs).find(l => l.attached);
  if (!core) return false;
  if (inPit(core.body.position.x) && core.body.position.y > MAP.floorY - 20) return false;
  // Feet go where the lowest part of the ragdoll is, and the body is nudged out of any wall.
  let bottom = -Infinity;
  for (const l of Object.values(r.limbs)) if (l.attached) bottom = Math.max(bottom, l.body.bounds.max.y);
  // Settle onto the floor right there if it is within a few units (parts sink in a little).
  const surf = surfaceY(core.body.position.x, bottom - 12);
  const top = Math.abs(surf - bottom) < 14 ? surf : bottom;
  const x = clearX(clamp(core.body.position.x, 10, 950), top - HALF_H * 2, top);
  a.getupPose = {};
  for (const [name, l] of Object.entries(r.limbs)) if (l.attached) a.getupPose[name] = { x: l.body.position.x - x, y: l.body.position.y - top, angle: l.body.angle };
  for (const [name, l] of Object.entries(r.limbs)) {
    if (!l.attached) continue;
    Composite.remove(g.engine.world, l.body);
    g.limbs = g.limbs.filter(x => x !== l);
    delete r.limbs[name];
  }
  for (const j of r.joints) if (!j.broken && (!r.limbs[j.parent] || !r.limbs[j.child])) { Composite.remove(g.engine.world, j.c); j.broken = true; }
  r.detached = true;
  r.alive = false;
  if (!Object.keys(r.limbs).length) g.ragdolls = g.ragdolls.filter(x => x !== r);
  Body.setPosition(a.body, { x, y: top - HALF_H - 0.5 });
  Body.setVelocity(a.body, { x: 0, y: 0 });
  Composite.add(g.engine.world, a.body);
  a.x = x; a.y = top - HALF_H;
  a.ghostClear = true;
  a.knock = 0;
  a.knocked = false;
  a.getup = 0.5;
  a.invincible = Math.max(a.invincible, 0.45);
  a.stun = 0;
  return true;
}

// Moves a body column at x out of the static blocks it would overlap between y0 and y1.
function clearX(x, y0, y1) {
  const half = 8;
  for (const s of MAP.solids) {
    if (s.kind !== 'wall' && s.kind !== 'block') continue;
    if (y1 <= s.y0 + 6 || y0 >= s.y1 - 6 || x + half <= s.x0 || x - half >= s.x1) continue;
    const left = s.x0 - half - 0.5, right = s.x1 + half + 0.5;
    // Take the nearer free side; a side that runs into the map edge is not free.
    x = (x - s.x0 < s.x1 - x && left > 8) || right > 952 ? left : right;
  }
  return clamp(x, 8, 952);
}

export function gib(g, a) {
  let r = ragdollOf(g, a);
  if (!r) {
    const v = a.body.velocity;
    r = buildRagdoll(g, a, { velocity: { x: v.x, y: v.y - 2 }, alive: false, spin: 0.4 });
    Composite.remove(g.engine.world, a.body);
  }
  r.alive = false;
  for (const j of r.joints) breakJoint(g, r, j, 'gib');
  for (const l of Object.values(r.limbs)) {
    Body.setVelocity(l.body, { x: l.body.velocity.x + rnd(-7, 7), y: l.body.velocity.y + rnd(-9, -2) });
    Body.setAngularVelocity(l.body, rnd(-0.5, 0.5));
    l.bleed = 3;
  }
  g.fx('gib', { x: a.x, y: a.y, n: 14, type: a.type });
  g.fx('blood', { x: a.x, y: a.y, dx: 0, dy: -4, n: 40, s: 7 });
  g.sound('squish', a.x);
}

export function pinLimb(g, limb, point) {
  const c = Constraint.create({ pointA: { x: point.x, y: point.y }, bodyB: limb.body, pointB: { x: point.x - limb.body.position.x, y: point.y - limb.body.position.y }, length: 0, stiffness: 0.9, damping: 0.1 });
  Composite.add(g.engine.world, c);
  g.pins.push({ c, limb: limb.id, life: 14, x: point.x, y: point.y });
}
