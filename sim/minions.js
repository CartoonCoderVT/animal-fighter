// The axolotl's clones: smaller copies of itself that grow out of the parts it loses. They live in
// their own list (g.minions), not among the fighters: they never score, respawn, take a HUD card or
// count as players online. Their hits are credited to the axolotl that grew them. Each one has a
// small body of its own that stands on floors and catwalks, walks through fighters, and is hit by
// blows, shots, blasts and hazards through the hit sites that call hitMinions().
import { Bodies, Body, Composite, Query, CAT, MASK, onewayBit } from './physics.js';
import { MAP } from './map.js';
import { clamp, rnd } from '../engine/const.js';

// Clone numbers. h is half the body height: the feet sit h below the center.
export const CLONE = { cap: 3, hp: 22, life: 16, w: 10, h: 10, speed: 3.4, accel: 0.55, jump: 8.4, leash: 230, sight: 260, reach: 22, hitCd: 0.75 };

const FIELDS = { type: 6, form: 'mini', severed: [], wounds: {}, broken: {}, embedded: [], stumps: [], knocked: false, dead: false };

export function minionsOf(g, owner) { return g.minions.filter(m => m.owner === owner.id && !m.dying); }

// A clone grows at (x, y) for its owner, if it has room for another.
export function spawnMinion(g, owner, x, y, { face = owner.face || 1, vx = 0, vy = -2 } = {}) {
  const mine = minionsOf(g, owner);
  if (mine.length >= CLONE.cap) return null;
  const slot = [0, 1, 2].find(s => !mine.some(m => m.slot === s)) ?? 0;
  const body = Bodies.rectangle(x, y, CLONE.w, CLONE.h * 2, {
    chamfer: { radius: 4 }, friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, inertia: Infinity, density: 0.002,
    collisionFilter: { category: CAT.minion, mask: MASK.minion }, label: 'minion'
  });
  const m = {
    ...FIELDS, severed: [], wounds: {}, broken: {}, embedded: [], stumps: [],
    id: g.nextId++, owner: owner.id, slot, team: owner.team, x, y, vx, vy, face, body, foot: CLONE.h,
    hp: CLONE.hp, maxHp: CLONE.hp, life: CLONE.life, born: g.time, ground: false, move: 0,
    act: null, actT: 0, attack: 0, attackKind: null, attackSeq: 0, hits: null, hitCd: rnd(0.2, 0.5),
    hitstun: 0, hitstunMax: 0, hurt: 0, stun: 0, invincible: 0, dodge: 0, dying: 0, target: null, think: rnd(0, 0.2)
  };
  body.plugin.minion = m;
  Body.setVelocity(body, { x: vx, y: vy });
  Composite.add(g.engine.world, body);
  g.minions.push(m);
  return m;
}

export function removeMinion(g, m) {
  const i = g.minions.indexOf(m);
  if (i >= 0) g.minions.splice(i, 1);
  Composite.remove(g.engine.world, m.body);
}

// Gone: a puff of goo where it stood (how: 'melt' when its time runs out or its owner falls).
export function killMinion(g, m, how = 'hit') {
  if (m.dead) return;
  m.dead = true;
  g.fx('cloneDeath', { x: m.x, y: m.y, form: m.form, how });
  g.sound('squish', m.x);
  removeMinion(g, m);
}

// A blow, shot or blast lands on a clone. Returns the damage dealt.
export function hurtMinion(g, m, amount, point, ownerId, kind, { kb = { x: 0, y: -2 }, hold = 0.25 } = {}) {
  if (m.dead || m.dying || amount <= 0) return 0;
  m.hp -= amount;
  m.hurt = 0.2;
  m.hitstun = Math.max(m.hitstun, hold); m.hitstunMax = m.hitstun;
  m.attack = 0; m.hits = null;
  Body.setVelocity(m.body, { x: clamp(kb.x * 1.3, -12, 12), y: clamp(kb.y * 1.2 - 1, -12, 10) });
  const attacker = g.actor(ownerId);
  if (attacker && attacker.team !== m.team) attacker.stats.damage += amount;
  g.fx('cloneHit', { x: point?.x ?? m.x, y: point?.y ?? m.y, form: m.form });
  if (m.hp <= 0) killMinion(g, m, 'hit');
  return amount;
}

// Every enemy clone the test accepts, for the hit sites of other fighters' attacks.
export function hitMinions(g, team, test, fn) {
  let n = 0;
  for (const m of [...g.minions]) if (!m.dead && !m.dying && m.team !== team && test(m)) { fn(m); n++; }
  return n;
}

// Feet on a floor or a catwalk (one-way platforms only from above, as fighters do).
function groundOf(g, m) {
  const b = m.body, x = b.position.x, feet = b.position.y + CLONE.h;
  if (b.velocity.y < -0.6) return null;
  const from = Math.min(m.prevFeet ?? feet, feet);
  const on = top => feet >= top - 3 && from <= top + 7;
  for (const s of MAP.solids) if (s.kind !== 'wall' && x + 4 > s.x0 && x - 4 < s.x1 && on(s.y0)) return s.y0;
  for (let i = 0; i < MAP.oneway.length; i++) {
    const p = MAP.oneway[i];
    if ((b.collisionFilter.mask & onewayBit(i)) && x + 4 > p.x0 && x - 4 < p.x1 && on(p.y)) return p.y;
  }
  // Standing on a crate, a barrel or any other prop.
  const props = [];
  for (const p of g.props) if (!p.held && p.kind !== 'glass') props.push(p.body);
  for (const dx of [-3, 3]) if (Query.ray(props, { x: x + dx, y: feet - 2 }, { x: x + dx, y: feet + 5 }, 2).length) return feet;
  return null;
}

function updateMask(m) {
  let mask = MASK.minion;
  const feet = m.body.position.y + CLONE.h;
  for (let i = 0; i < MAP.oneway.length; i++) if (!(m.drop > 0) && feet <= MAP.oneway[i].y + 3) mask |= onewayBit(i);
  m.body.collisionFilter.mask = mask;
}

// Before the physics step: timers, the clone's mind, and the velocity it wants.
export function stepMinions(g, dt) {
  for (const m of [...g.minions]) {
    const owner = g.actor(m.owner);
    // Without the axolotl that grew them, clones melt away.
    if (!owner || owner.dead) { killMinion(g, m, 'melt'); continue; }
    for (const k of ['hurt', 'hitstun', 'stun', 'hitCd', 'invincible', 'drop']) m[k] = Math.max(0, (m[k] || 0) - dt);
    m.life -= dt;
    if (m.life <= 0) { killMinion(g, m, 'melt'); continue; }
    if (m.attack > 0) m.attack = Math.max(0, m.attack - dt);
    if (m.act) m.actT += dt;
    m.ground = groundOf(g, m) !== null;
    const v = m.body.velocity;
    let vx = v.x, vy = v.y;
    if (m.hitstun > 0) { if (m.ground) vx *= 0.8; }
    else think(g, m, owner, dt, v, (x, y) => { vx = x; vy = y; });
    updateMask(m);
    Body.setVelocity(m.body, { x: vx, y: vy });
  }
}

// The default mind: stay with the owner; go after rivals that come close to it.
function think(g, m, owner, dt, v, set) {
  m.think -= dt;
  if (m.think <= 0 || (m.target != null && !g.actor(m.target))) {
    m.think = 0.25;
    const near = g.enemies(owner).filter(b => !b.dead && Math.hypot(b.x - owner.x, b.y - owner.y) < CLONE.leash && Math.hypot(b.x - m.x, b.y - m.y) < CLONE.sight)
      .sort((p, q) => Math.hypot(p.x - m.x, p.y - m.y) - Math.hypot(q.x - m.x, q.y - m.y))[0];
    m.target = near ? near.id : null;
  }
  const t = m.target != null ? g.actor(m.target) : null;
  let goal = owner.x - (owner.face || 1) * (16 + m.slot * 11);
  // Around a rival they spread out instead of piling up on one spot.
  if (t) goal = t.x - Math.sign(t.x - m.x || 1) * (10 + m.slot * 7);
  const dx = goal - m.x;
  const move = Math.abs(dx) > 5 ? Math.sign(dx) : 0;
  if (move) m.face = move;
  if (t) m.face = Math.sign(t.x - m.x) || m.face;
  m.move = move;
  let vx = v.x, vy = v.y;
  const want = move * CLONE.speed;
  vx = m.ground ? vx + clamp(want - vx, -CLONE.accel, CLONE.accel) : vx + clamp(want - vx, -CLONE.accel * 0.5, CLONE.accel * 0.5);
  // Hop up after whoever it follows, and over small steps it walks into.
  const above = (t ? t.y : owner.y) < m.y - 26;
  if (m.ground && (above || (move && Math.abs(v.x) < 0.3 && Math.abs(dx) > 14)) && !(m.jumpCd > 0)) { vy = -CLONE.jump; m.jumpCd = 0.6; }
  m.jumpCd = Math.max(0, (m.jumpCd || 0) - dt);
  // Drop through a catwalk to follow someone below.
  if (m.ground && (t ? t.y : owner.y) > m.y + 40 && !(m.drop > 0)) m.drop = 0.3;
  // Left far behind (another floor, across the pit): it dives into the floor and pops up by its owner.
  m.lost = Math.hypot(owner.x - m.x, owner.y - m.y) > 320 ? (m.lost || 0) + dt : 0;
  if (m.lost > 1.6) warpMinion(g, m, owner.x - (owner.face || 1) * 14, owner.y);
  set(vx, vy);
}

export function warpMinion(g, m, x, y) {
  g.fx('cloneHop', { x: m.x, y: m.y + CLONE.h });
  Body.setPosition(m.body, { x: clamp(x, 14, 946), y });
  Body.setVelocity(m.body, { x: 0, y: -2 });
  m.x = m.body.position.x; m.y = m.body.position.y; m.prevFeet = m.y + CLONE.h; m.lost = 0;
  g.fx('cloneHop', { x: m.x, y: m.y + CLONE.h });
}

// After the physics step: positions, walls, and the pit and the bottom of the map.
export function syncMinions(g) {
  for (const m of [...g.minions]) {
    const b = m.body;
    if (b.position.x < 8 || b.position.x > 952) { Body.setPosition(b, { x: clamp(b.position.x, 8, 952), y: b.position.y }); Body.setVelocity(b, { x: 0, y: b.velocity.y }); }
    m.x = b.position.x; m.y = b.position.y; m.vx = b.velocity.x; m.vy = b.velocity.y;
    m.prevFeet = m.y + CLONE.h;
    if (m.y > 640) killMinion(g, m, 'fall');
  }
}

export function minionSnapshot(g) {
  const r = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  return g.minions.map(m => ({
    id: m.id, owner: m.owner, slot: m.slot, type: 6, form: m.form, team: m.team, x: r(m.x), y: r(m.y), vx: r(m.vx), vy: r(m.vy), face: m.face,
    hp: r(m.hp), maxHp: m.maxHp, life: r(m.life), ground: m.ground, move: m.move, act: m.act, actT: r2(m.actT), attack: r2(m.attack),
    attackKind: m.attackKind, attackSeq: m.attackSeq, hitstun: r2(m.hitstun), hitstunMax: r2(m.hitstunMax), hurt: r2(m.hurt), foot: m.foot
  }));
}
