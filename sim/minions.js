// The axolotl's brood: smaller copies of itself that grow out of the parts it loses. They live in
// their own list (g.minions), not among the fighters: they never score, respawn, take a HUD card or
// count as players online. Their hits are credited to the axolotl that grew them. Each one has a
// small body of its own that stands on floors and catwalks, walks through fighters, and is hit by
// blows, shots, blasts and hazards through the hit sites that call hitMinions().
//
// A record goes through kinds: 'seed' (a lost part in flight) -> 'bud' (it swells where it landed)
// -> 'mini' (an adult clone) -> 'demon' (awakened by the special). 'bubble' is the axolotl's bubble
// shot, kept in the same list so it is drawn and sent with the rest; it is never a clone.
import { Bodies, Body, Composite, Query, CAT, MASK, onewayBit } from './physics.js';
import { MAP } from './map.js';
import { MOVES } from './moves.js';
import { clamp, rnd } from '../engine/const.js';
import { damage } from './combat.js';
import { knockdown, ragdollOf } from './ragdoll.js';

// Clone numbers. h is half the body height: the feet sit h below the center.
// leash: how far from its owner a clone goes after rivals (owner to rival); reach: how far from the
// clone. budget: most damage the clones of one owner deal one rival (and all rivals, budgetAll) in
// any `window` seconds, so a brood adds a little to every exchange and never runs a fight by itself.
export const CLONE = {
  cap: 3, hp: 18, life: 12, w: 10, h: 10, speed: 5.2, accel: 0.6, jump: 8.6,
  leash: 130, reach: 150, dive: 200, budget: 12, budgetAll: 18, window: 6,
  nibble: { dmg: 3, cd: 1.1, at: 0.2, dur: 0.45, range: 22, band: 18 },
  echo: { mul: 0.3, cost: 0.8, near: 70, delay: 0.1, step: 0.08 },
  latch: { dmg: 1, every: 0.3, ticks: 5 },
  toss: { vx: 9, vy: -2.5, time: 0.6, dmg: 6, cost: 2 }
};
export const BUD = { hp: 6, time: 0.8, h: 4 };
// The demons of Xolotl: tougher (armor: share of damage that gets through), faster, and with their
// own moves. A rival a demon staggered cannot be staggered by another for `lock` seconds.
export const DEMON = {
  hp: 12, hpMax: 30, armor: 0.75, speed: 6.2, jump: 10, sight: 260, lock: 0.5,
  pounce: { range: 120, crouch: 0.12, fly: 0.35, v: 9, dmg: 5, cd: 1.2 },
  bite: { range: 24, at: 0.18, dur: 0.48, dmg: 5, cd: 0.9 },
  feast: { dmg: 2, every: 0.25, ticks: 4, again: 3 },
  slam: { dmg: 4 },
  burst: { r: 34, dmg: 6, warn: 0.3, burn: 1.2 }
};
const BUBBLE = { r: 9, life: 1.6, vx: 2.4, vy: -1.6, trap: 0.8, pop: 4, immune: 3 };

const BROOD = ['seed', 'bud', 'mini', 'demon'];
// The clones (any stage) an axolotl has right now.
export function minionsOf(g, owner) { return g.minions.filter(m => m.owner === owner.id && BROOD.includes(m.kind) && !m.dying); }
export const adultsOf = (g, owner) => g.minions.filter(m => m.owner === owner.id && m.kind === 'mini' && !m.dying && !m.act);
// Whether blows can touch it: seeds in flight, bubbles, a clone in the mouth or under the floor,
// and one changing into a demon cannot be hit.
export const targetable = m => !m.dead && !m.dying && (m.kind === 'bud' || m.kind === 'mini' || m.kind === 'demon') && !['carried', 'dive', 'morph'].includes(m.act) && !(m.invincible > 0);

function makeBody(x, y, h) {
  return Bodies.rectangle(x, y, CLONE.w, h * 2, {
    chamfer: { radius: Math.min(4, h - 1) }, friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, inertia: Infinity, density: 0.002,
    collisionFilter: { category: CAT.minion, mask: MASK.minion }, label: 'minion'
  });
}

function record(g, owner, kind, x, y, h, extra) {
  const body = kind === 'bubble' ? null : makeBody(x, y, h);
  const m = {
    id: g.nextId++, owner: owner.id, slot: 0, type: 6, kind, form: 'mini', team: owner.team, x, y, vx: 0, vy: 0, face: owner.face || 1, body, h, foot: h,
    hp: 1, maxHp: 1, life: 1, lifeMax: 1, born: g.time, ground: false, move: 0, act: null, actT: 0, attack: 0, attackKind: null, attackSeq: 0,
    hitCd: rnd(0.2, 0.5), hitstun: 0, hitstunMax: 0, hurt: 0, invincible: 0, dying: 0, target: null, think: rnd(0, 0.2), latch: null, morph: 0,
    severed: [], wounds: {}, broken: {}, embedded: [], stumps: [], knocked: false, dead: false, ...extra
  };
  if (body) { body.plugin.minion = m; Composite.add(g.engine.world, body); }
  g.minions.push(m);
  return m;
}

// A lost part flies off (it hatches where it lands, see stepSeed). Returns null at the cap.
// missile: { dmg, kb } when it was thrown on purpose and hurts whoever it flies into.
export function spawnSeed(g, owner, part, x, y, vx, vy, missile = null) {
  if (minionsOf(g, owner).length >= CLONE.cap) return null;
  const m = record(g, owner, 'seed', x, y, BUD.h, { part, spin: rnd(0.25, 0.4) * (vx >= 0 ? 1 : -1), missile, slot: freeSlot(g, owner) });
  Body.setVelocity(m.body, { x: vx, y: vy });
  m.vx = vx; m.vy = vy;
  return m;
}

// An adult clone grows at (x, y), if its owner has room for another (tests and the select hero).
export function spawnMinion(g, owner, x, y, { face = owner.face || 1, vx = 0, vy = -2 } = {}) {
  if (minionsOf(g, owner).length >= CLONE.cap) return null;
  const m = record(g, owner, 'mini', x, y, CLONE.h, { slot: freeSlot(g, owner), face });
  grow(g, m);
  Body.setVelocity(m.body, { x: vx, y: vy });
  return m;
}

function freeSlot(g, owner) {
  const mine = minionsOf(g, owner);
  return [0, 1, 2].find(s => !mine.some(m => m.slot === s)) ?? 0;
}

// Into an adult: its full size body, life and lifetime.
function grow(g, m) {
  if (m.h !== CLONE.h) resize(g, m, CLONE.h);
  Object.assign(m, { kind: 'mini', form: 'mini', hp: CLONE.hp, maxHp: CLONE.hp, life: CLONE.life, lifeMax: CLONE.life, act: 'hatch', actT: 0, born: g.time });
}

function resize(g, m, h) {
  const old = m.body, y = old.position.y - (h - m.h);
  Composite.remove(g.engine.world, old);
  m.body = makeBody(old.position.x, y, h);
  m.body.plugin.minion = m;
  Body.setVelocity(m.body, old.velocity);
  Composite.add(g.engine.world, m.body);
  m.h = h; m.foot = h; m.y = y; m.prevFeet = y + h;
}

export function removeMinion(g, m) {
  const i = g.minions.indexOf(m);
  if (i >= 0) g.minions.splice(i, 1);
  if (m.body) Composite.remove(g.engine.world, m.body);
  const o = g.actor(m.owner);
  if (o?.axo?.carry === m.id) o.axo.carry = null;
  if (m.kind === 'bubble' && m.trap != null) { const v = g.actor(m.trap); if (v) v.bubbled = 0; }
}

// Gone: a burst of goo where it stood (how: 'melt' when its time runs out or its owner falls,
// 'ash' for a demon whose master fell, 'fall' into the pit).
export function killMinion(g, m, how = 'hit') {
  if (m.dead) return;
  m.dead = true;
  g.fx('cloneDeath', { x: m.x, y: m.y, form: m.form, how });
  if (how === 'hit' && m.kind !== 'bubble') g.text(m.x, m.y - 18, m.kind === 'bud' ? 'BROTO ESMAGADO!' : 'SPLOT!', '#ff8fa8');
  g.sound('squish', m.x);
  removeMinion(g, m);
}

// Melting away slowly (time is up, or its owner is gone): it shrinks into bubbles, then it is gone.
function dissolve(g, m, delay = 0) {
  if (m.dying) return;
  m.dying = 0.4 + delay; m.act = 'dying'; m.actT = -delay; m.latch = null;
  if (m.body) m.body.collisionFilter.mask = MASK.minion;
}

// A blow, shot or blast lands on a clone. Returns the damage dealt.
export function hurtMinion(g, m, amount, point, ownerId, kind, { kb = { x: 0, y: -2 }, hold = 0.3 } = {}) {
  if (!targetable(m) || amount <= 0) return 0;
  if (m.kind === 'bud') amount = m.hp;
  if (m.kind === 'demon') amount *= DEMON.armor;
  m.hp -= amount;
  m.hurt = 0.2;
  const o = g.actor(m.owner);
  if (m.act === 'latch' || m.act === 'feast') { m.act = null; m.latch = null; }
  if (m.act === 'thrown' && o?.axo) o.axo.carry = null;
  if (m.kind !== 'bud') {
    m.hitstun = Math.max(m.hitstun, m.kind === 'demon' ? 0.15 : Math.hypot(kb.x, kb.y) >= 6 ? 0.5 : hold); m.hitstunMax = m.hitstun;
    if (m.act !== 'burst' && (m.kind === 'mini' || !['pounce', 'bite'].includes(m.act))) { m.act = null; m.attack = 0; }
    if (m.body) Body.setVelocity(m.body, { x: clamp(kb.x * 1.3, -12, 12), y: clamp(kb.y * 1.2 - 1, -12, 10) });
  }
  const attacker = g.actor(ownerId);
  if (attacker && attacker.team !== m.team) attacker.stats.damage += amount;
  g.fx('cloneHit', { x: point?.x ?? m.x, y: point?.y ?? m.y, form: m.form });
  if (m.hp <= 0) killMinion(g, m, 'hit');
  return amount;
}

// Every enemy clone the test accepts, for the hit sites of other fighters' attacks.
export function hitMinions(g, team, test, fn) {
  let n = 0;
  for (const m of [...g.minions]) if (m.team !== team && targetable(m) && test(m)) { fn(m); n++; }
  return n;
}
// Area blows (rings, quakes, roars, blasts): every enemy clone in the box around (x, y).
// dmg and kb get the closeness k, 1 at the center down to 0 at the edge.
export function blastMinions(g, team, ownerId, x, y, rx, ry, dmg, kind, kb = (s, k) => ({ x: s * (3 + 5 * k), y: -3 - 3 * k })) {
  return hitMinions(g, team, m => Math.abs(m.x - x) < rx && Math.abs(m.y - y) < ry, m => {
    const s = Math.sign(m.x - x) || 1, k = 1 - Math.min(1, Math.abs(m.x - x) / rx);
    hurtMinion(g, m, typeof dmg === 'function' ? dmg(k) : dmg, { x: m.x - s * 3, y: m.y }, ownerId, kind, { kb: kb(s, k) });
  });
}

// Feet on a floor, a catwalk (one-way platforms only from above, as fighters do) or a prop.
function groundOf(g, m) {
  const b = m.body, x = b.position.x, feet = b.position.y + m.h;
  if (b.velocity.y < -0.6) return null;
  const from = Math.min(m.prevFeet ?? feet, feet);
  const on = top => feet >= top - 3 && from <= top + 7;
  for (const s of MAP.solids) if (s.kind !== 'wall' && x + 4 > s.x0 && x - 4 < s.x1 && on(s.y0)) return s.y0;
  for (let i = 0; i < MAP.oneway.length; i++) {
    const p = MAP.oneway[i];
    if ((b.collisionFilter.mask & onewayBit(i)) && x + 4 > p.x0 && x - 4 < p.x1 && on(p.y)) return p.y;
  }
  const props = [];
  for (const p of g.props) if (!p.held && p.kind !== 'glass') props.push(p.body);
  for (const dx of [-3, 3]) if (Query.ray(props, { x: x + dx, y: feet - 2 }, { x: x + dx, y: feet + 5 }, 2).length) return feet;
  return null;
}

function updateMask(m) {
  let mask = MASK.minion;
  const feet = m.body.position.y + m.h;
  for (let i = 0; i < MAP.oneway.length; i++) if (!(m.drop > 0) && feet <= MAP.oneway[i].y + 3) mask |= onewayBit(i);
  m.body.collisionFilter.mask = mask;
}

// Whether the clones may act for their owner: not while it reels, lies on the floor or is frozen
// (hitting the axolotl switches its brood off). Swallowed by the frog, they fight to get it out.
const ownerAwake = o => !(o.hitstun > 0) && !o.knocked && !(o.frozen > 0);

// The clone damage a rival has taken from this owner's brood lately, and what is left of the budget.
function budgetLeft(g, owner, victim) {
  const ax = owner.axo || (owner.axo = {});
  const log = (ax.chip ||= []).filter(e => g.time - e.t < CLONE.window);
  ax.chip = log;
  let mine = 0, all = 0;
  for (const e of log) { all += e.n; if (e.v === victim.id) mine += e.n; }
  return Math.max(0, Math.min(CLONE.budget - mine, CLONE.budgetAll - all));
}

// A clone's bite, nibble or echo on a rival, inside the budget. Chip hits never stagger or push.
function cloneHit(g, m, owner, b, amount, kind, opts = {}) {
  // Freeing their axolotl from the frog's belly, they bite as hard as they can.
  const n = b.belly === owner.id ? amount : Math.min(amount, budgetLeft(g, owner, b));
  if (n <= 0 || b.dead) return 0;
  const point = { x: b.x - (m.face || 1) * 4, y: b.y - 2 };
  const dealt = damage(g, b, n, point, owner.id, kind, { kb: { x: 0, y: 0 }, chip: true, src: m, killKind: 'clone', ...opts });
  if (dealt > 0) {
    owner.axo.chip.push({ t: g.time, v: b.id, n: dealt });
    owner.stats.brood = (owner.stats.brood || 0) + dealt;
    // Every nip on a full frog loosens his hold on the axolotl inside.
    if (b.belly === owner.id) b.bellyT -= 0.13;
  }
  return dealt;
}

// Before the physics step: timers, the minds, and the velocity each one wants.
export function stepMinions(g, dt) {
  for (const a of g.actors) a.latchN = 0;
  for (const m of g.minions) if ((m.act === 'latch' || m.act === 'feast') && m.latch != null) { const v = g.actor(m.latch); if (v) v.latchN = (v.latchN || 0) + 1; }
  for (const m of [...g.minions]) {
    if (m.dead) continue;
    const owner = g.actor(m.owner);
    for (const k of ['hurt', 'hitstun', 'hitCd', 'invincible', 'drop', 'jumpCd', 'pounceCd', 'biteCd']) m[k] = Math.max(0, (m[k] || 0) - dt);
    m.actT += dt;
    if (m.kind === 'bubble') { stepBubble(g, m, owner, dt); continue; }
    // Without the axolotl that grew them, clones melt away (demons crumble into ash, no burst).
    if ((!owner || owner.dead) && !m.dying) dissolve(g, m, 0.15 * m.slot);
    if (m.dying) {
      m.dying -= dt;
      if (m.dying <= 0) { killMinion(g, m, m.form === 'demon' ? 'ash' : 'melt'); continue; }
      calm(m, dt);
      continue;
    }
    m.ground = groundOf(g, m) !== null;
    if (m.kind === 'seed') { stepSeed(g, m, owner); continue; }
    if (m.kind === 'bud') { stepBud(g, m, owner, dt); continue; }
    // A demon's life is held for as long as the awakening lasts.
    if (m.kind === 'mini') m.life -= dt;
    if (m.life <= 0) { dissolve(g, m); continue; }
    if (m.act === 'hatch' && m.actT > 0.6) m.act = null;
    if (m.act === 'morph') { stepMorph(g, m, owner); continue; }
    if (m.act === 'carried') { stepCarried(g, m, owner); continue; }
    if (m.act === 'dive') { stepDive(g, m, owner); continue; }
    if (m.act === 'thrown') { stepThrown(g, m, owner); updateMask(m); continue; }
    if (m.act === 'latch' || m.act === 'feast') { stepLatch(g, m, owner, dt); continue; }
    if (m.act === 'burst') { stepBurst(g, m, owner); continue; }
    const v = m.body.velocity;
    let vx = v.x, vy = v.y;
    if (m.hitstun > 0) { if (m.ground) vx *= 0.8; }
    else {
      const out = m.kind === 'demon' ? thinkDemon(g, m, owner, dt, v) : thinkMini(g, m, owner, dt, v);
      vx = out.vx; vy = out.vy;
    }
    // The conveyor belt carries them along like everyone else.
    const c = g.hz?.conveyor;
    if (m.ground && c && m.x > c.x0 && m.x < c.x1 && m.y > 440 && m.y < 520) vx += c.dir * c.speed * 0.2;
    updateMask(m);
    Body.setVelocity(m.body, { x: vx, y: vy });
  }
}

function calm(m, dt) {
  if (!m.body) return;
  const v = m.body.velocity;
  Body.setVelocity(m.body, { x: v.x * (m.ground ? 0.7 : 0.98), y: v.y });
  m.ground = false;
}

// A part in flight: it spins until it lands, then swells into a bud (or, awakened mid-air, a demon).
// Thrown on purpose, it hurts the first rival it flies into.
function stepSeed(g, m, owner) {
  const v = m.body.velocity;
  if (m.missile && !m.missile.hit && !m.ground) {
    const b = g.enemies(owner || { id: -1, team: m.team }).find(b => !b.knocked && Math.abs(b.x - m.x) < 12 && Math.abs(b.y - m.y) < 22);
    if (b) {
      m.missile.hit = true;
      const s = Math.sign(v.x) || m.face;
      damage(g, b, m.missile.dmg, { x: m.x, y: m.y }, m.owner, 'fin', { kb: { x: s * m.missile.kb[0], y: m.missile.kb[1] }, src: m });
      Body.setVelocity(m.body, { x: -v.x * 0.3, y: -2 });
    }
  }
  if (m.ground) Body.setVelocity(m.body, { x: v.x * 0.75, y: v.y });
  if ((m.ground && Math.hypot(v.x, v.y) < 1.2) || m.actT > 1.6) {
    if (!m.ground && m.actT <= 1.6) return;
    if (m.awaken) { grow(g, m); startMorph(g, m, owner); return; }
    m.kind = 'bud'; m.act = null; m.actT = 0; m.hp = BUD.hp; m.maxHp = BUD.hp; m.life = BUD.time; m.lifeMax = BUD.time;
    g.fx('bud', { x: m.x, y: m.y + m.h });
    g.sound('blub', m.x);
  }
}

// A bud swells for a moment (any blow squashes it) and then hatches into an adult.
function stepBud(g, m, owner, dt) {
  m.life -= dt;
  const v = m.body.velocity;
  Body.setVelocity(m.body, { x: v.x * 0.7, y: v.y });
  if (m.life > 0) return;
  grow(g, m);
  Body.setVelocity(m.body, { x: 0, y: -3 });
  g.fx('cloneBirth', { x: m.x, y: m.y });
  g.text(m.x, m.y - 18, 'BROTO!', '#ff9cc0');
  g.sound('plop', m.x);
  if (owner) owner.stats.clones = (owner.stats.clones || 0) + 1;
  if (m.awaken && owner?.axo?.demonEnd > g.time) startMorph(g, m, owner);
}

// The default mind of an adult: stay with the owner; go after rivals that come close to it; bite.
function thinkMini(g, m, owner, dt, v) {
  m.think -= dt;
  const free = ownerAwake(owner);
  // The axolotl inside the frog: every clone goes for the frog.
  const frog = owner.swallowedBy != null ? g.actor(owner.swallowedBy) : null;
  if (m.think <= 0 || (m.target != null && !g.actor(m.target))) {
    m.think = 0.25;
    if (frog) m.target = frog.id;
    else {
      const busy = id => g.minions.filter(o => o !== m && o.owner === m.owner && o.target === id).length >= 2;
      const ok = b => !b.dead && Math.hypot(b.x - owner.x, b.y - owner.y) < CLONE.leash && Math.hypot(b.x - m.x, b.y - m.y) < CLONE.reach && !busy(b.id);
      const prey = owner.lastPrey != null && g.time - (owner.lastPreyT ?? -9) < 2 ? g.actor(owner.lastPrey) : null;
      const near = prey && prey.team !== owner.team && ok(prey) ? prey : g.enemies(owner).filter(ok).sort((p, q) => Math.hypot(p.x - m.x, p.y - m.y) - Math.hypot(q.x - m.x, q.y - m.y))[0];
      m.target = near ? near.id : null;
    }
  }
  const t = m.target != null ? g.actor(m.target) : null;
  // Just hatched: it shakes itself off where it is.
  if (m.act === 'hatch') return { vx: v.x * 0.8, vy: v.y };
  // The bite: a short dart in, the nip, back.
  if (m.act === 'nibble') {
    const N = CLONE.nibble;
    if (!m.bit && m.actT >= N.at) {
      m.bit = true;
      if (t && !t.dead && Math.abs(t.x - m.x) < N.range + 6 && Math.abs(t.y - m.y) < N.band + (m.ground ? 8 : 16)) { if (cloneHit(g, m, owner, t, N.dmg, 'nibble')) g.sound('chomp', m.x); }
    }
    if (m.actT >= N.dur) { m.act = null; m.hitCd = N.cd; }
    return { vx: v.x * 0.8 + (m.actT < N.at ? m.face * 0.6 : 0), vy: v.y };
  }
  if (m.act === 'echo') return stepEcho(g, m, owner, v);
  if (m.echo && g.time >= m.echo.at) { const e = m.echo; m.echo = null; if (free && !m.act) startEcho(g, m, owner, e); }
  let goal = owner.x - (owner.face || 1) * (12 + m.slot * 9);
  // Around a rival they spread out a little instead of piling up on one spot.
  if (t) goal = t.x - Math.sign(t.x - m.x || 1) * (8 + m.slot * 4);
  const dx = goal - m.x;
  const move = Math.abs(dx) > 6 ? Math.sign(dx) : 0;
  if (move) m.face = move;
  if (t) m.face = Math.sign(t.x - m.x) || m.face;
  m.move = move;
  if (t && free && !(m.hitCd > 0) && Math.abs(t.x - m.x) < CLONE.nibble.range && (frog || budgetLeft(g, owner, t) > 0)) {
    const dy = t.y - m.y;
    if (Math.abs(dy) < CLONE.nibble.band + 6) { m.act = 'nibble'; m.actT = 0; m.bit = false; m.attackSeq++; }
    // A rival just above it: it springs up and bites on the way.
    else if (dy < 0 && dy > -70 && m.ground && !(m.jumpCd > 0)) { m.act = 'nibble'; m.actT = 0; m.bit = false; m.attackSeq++; m.jumpCd = 0.6; return { vx: clamp((t.x - m.x) * 0.2, -3, 3), vy: -Math.min(CLONE.jump, 3 + Math.sqrt(-dy) * 0.9) }; }
  }
  return walk(g, m, owner, t, dx, move, v, CLONE.speed * ((owner.axo?.carry != null) ? 0.9 : 1), CLONE.jump);
}

// Running, hopping after whoever it follows, dropping through catwalks, and diving home when lost.
// The shredder pit: it never hops toward it, stops at the lip, steers off it when falling, and
// dives across to its owner when it has to.
function walk(g, m, owner, t, dx, move, v, speed, jump) {
  let vx = v.x, vy = v.y;
  const acc = m.ground ? CLONE.accel : CLONE.accel * 0.5;
  vx += clamp(move * speed - vx, -acc, acc);
  const P = MAP.pit, lip = x => x > P.x0 - 6 && x < P.x1 + 6, low = m.y + m.h > P.y0 - 70;
  const follow = t || owner;
  const above = follow.y < m.y - 20 && follow.y > m.y - 90 && Math.abs(follow.x - m.x) < 70;
  if (m.ground && (above || (move && Math.abs(v.x) < 0.3 && Math.abs(dx) > 14)) && !(m.jumpCd > 0) && !(low && lip(m.x + move * 50))) { vy = -jump; m.jumpCd = 0.6; g.fx('cloneHop', { x: m.x, y: m.y + m.h }); }
  if (m.ground && follow.y > m.y + 40 && !(m.drop > 0)) m.drop = 0.3;
  const brink = m.ground && m.y + m.h > P.y0 - 40 && !lip(m.x) && lip(m.x + vx * 4);
  if (brink) vx = 0;
  else if (!m.ground && vy > 0 && low && lip(m.x + vx * 6)) vx = m.x < (P.x0 + P.x1) / 2 ? Math.min(vx, -2) : Math.max(vx, 2);
  // Left far behind (another floor, across the pit): it dives into the floor and pops up by its owner.
  m.lost = brink || Math.hypot(owner.x - m.x, owner.y - m.y) > CLONE.dive || (Math.abs(owner.y - m.y) > 60 && owner.ground && m.ground && !t) ? (m.lost || 0) + (brink ? 3 : 1) / 60 : 0;
  if (m.lost > 1.2 && m.ground && owner.swallowedBy == null) { m.act = 'dive'; m.actT = 0; m.lost = 0; g.fx('cloneHop', { x: m.x, y: m.y + m.h }); }
  return { vx, vy };
}

function stepDive(g, m, owner) {
  Body.setVelocity(m.body, { x: 0, y: Math.min(m.body.velocity.y, 1) });
  if (m.actT >= 0.35 && !m.surfaced) {
    m.surfaced = true;
    warpMinion(g, m, owner.x - (owner.face || 1) * (16 + m.slot * 12), owner.y + (owner.knocked ? -6 : 0));
  }
  if (m.actT >= 0.7) { m.act = null; m.surfaced = false; }
}

export function warpMinion(g, m, x, y) {
  Body.setPosition(m.body, { x: clamp(x, 14, 946), y });
  Body.setVelocity(m.body, { x: 0, y: -2 });
  m.x = m.body.position.x; m.y = m.body.position.y; m.prevFeet = m.y + m.h; m.lost = 0;
  g.fx('cloneHop', { x: m.x, y: m.y + m.h });
}

// Eco: the owner's blow, repeated a beat late by every clone close to the rival it landed on.
export function queueEcho(g, owner, id, victim, amount) {
  if (!victim || victim.dead || victim.knocked || !victim.ground) return;
  for (const m of adultsOf(g, owner)) {
    if (m.echo || m.hitstun > 0 || !m.ground || Math.abs(m.x - victim.x) > CLONE.echo.near || Math.abs(m.y - victim.y) > 30) continue;
    m.echo = { at: g.time + CLONE.echo.delay + CLONE.echo.step * m.slot, id, victim: victim.id, dmg: Math.max(1, Math.round(amount * CLONE.echo.mul)) };
  }
}

function startEcho(g, m, owner, e) {
  const mv = MOVES[e.id], b = g.actor(e.victim);
  if (!mv || !b || b.dead || b.knocked) return;
  m.act = 'echo'; m.actT = 0; m.attackKind = e.id; m.attack = mv.dur; m.attackSeq++;
  m.echoHit = { at: mv.dur * mv.hits[mv.hits.length - 1], victim: b.id, dmg: e.dmg, done: false };
  m.face = Math.sign(b.x - m.x) || m.face;
  m.life -= CLONE.echo.cost;
}

function stepEcho(g, m, owner, v) {
  m.attack = Math.max(0, m.attack - 1 / 60);
  const e = m.echoHit;
  if (e && !e.done && m.actT >= e.at) {
    e.done = true;
    const b = g.actor(e.victim);
    if (b && !b.dead && !b.knocked && Math.abs(b.x - m.x) < CLONE.echo.near + 8 && Math.abs(b.y - m.y) < 34) {
      // The echo keeps a rival already reeling from the owner's string reeling, and never starts it.
      if (cloneHit(g, m, owner, b, e.dmg, MOVES[m.attackKind]?.kind === 'gill' ? 'gill' : 'nibble', { echo: true }) && b.hitstun > 0) b.hitstun = Math.max(b.hitstun, 0.22);
      g.fx('slash', { x: m.x + m.face * 10, y: m.y + 2, face: m.face, size: 10, kind: 'gill', fin: 0, color: '#ff8fa8' });
    }
  }
  if (m.attack <= 0) { m.act = null; m.attackKind = null; m.echoHit = null; }
  return { vx: v.x * 0.8 + (m.actT < 0.1 ? m.face * 0.5 : 0), vy: v.y };
}

// Latched on a rival's back: it gnaws a few times, slowing them down. A dodge, a parry, two jumps,
// a blow on the clone or the rival flying off shake it loose. A demon's feast pins them instead.
function stepLatch(g, m, owner, dt) {
  const b = g.actor(m.latch);
  const demon = m.act === 'feast';
  const L = demon ? DEMON.feast : CLONE.latch;
  const loose = () => { m.act = null; m.latch = null; m.body.collisionFilter.mask = MASK.minion; Body.setVelocity(m.body, { x: -m.face * 3, y: -4 }); };
  if (!b || b.dead || b.swallowedBy != null) { loose(); return; }
  if (!demon && !m.pile && (b.knocked || b.stun > 0.6)) { loose(); return; }
  if (b.dodge > 0 || b.parry > 0) { loose(); hurtMinion(g, m, 3, { x: m.x, y: m.y }, b.id, 'punch', { kb: { x: -m.face * 5, y: -4 } }); return; }
  if (b.jumpAt != null && b.jumpAt !== m.jumpSeen) { m.jumpSeen = b.jumpAt; if (++m.jumps >= 2) { loose(); return; } }
  // Leaping onto them first, then clinging on.
  const core = b.knocked ? ragdollOf(g, b)?.limbs.body : null;
  const tx = (core ? core.body.position.x : b.x) - (b.face || 1) * (demon ? 3 : 4) + (m.slot - 1) * 3, ty = (core ? core.body.position.y - 10 : b.y - 8);
  const p = m.body.position, d = Math.hypot(tx - p.x, ty - p.y);
  if (!m.clung) {
    m.body.collisionFilter.mask = 0;
    if (d < 10 || m.actT > 0.4) { m.clung = true; m.actT = 0; m.tick = 0; g.sound('chomp', b.x); }
    else { Body.setVelocity(m.body, { x: clamp((tx - p.x) * 0.35, -7, 7), y: clamp((ty - p.y) * 0.35, -7, 7) }); return; }
  }
  Body.setPosition(m.body, { x: tx, y: ty });
  Body.setVelocity(m.body, { x: 0, y: 0 });
  m.face = b.face || 1;
  m.tick -= dt;
  if (m.tick <= 0) {
    m.tick = L.every;
    m.ticks--;
    if (demon) {
      demonHit(g, m, owner, b, L.dmg, { chip: true, kind: 'fang' });
      b.hitstun = Math.max(b.hitstun || 0, 0.3); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun);
      if (!b.ground && !b.knocked) { b.float = Math.max(b.float || 0, 0.3); Body.setVelocity(b.body, { x: b.body.velocity.x * 0.5, y: Math.min(b.body.velocity.y, 0.5) }); }
    } else if (b.knocked && m.pile) {
      if (cloneHit(g, m, owner, b, L.dmg, 'nibble', { force: true, part: 'body' })) g.fx('toothMarks', { x: m.x, y: m.y + 4 });
    } else cloneHit(g, m, owner, b, L.dmg, 'nibble');
    if (m.ticks <= 0) {
      if (demon) {
        const pair = g.minions.filter(o => o.act === 'feast' && o.latch === b.id).length >= 2;
        m.feastCd = g.time + DEMON.feast.again;
        if ((!b.ground || pair) && !b.knocked && !b.dead) {
          demonHit(g, m, owner, b, DEMON.slam.dmg, { kind: 'slam' });
          if (!b.dead && !b.knocked) knockdown(g, b, { velocity: { x: 0, y: 6 }, time: 1.4 });
        }
      }
      loose();
    }
  }
}

// The Canibal pile: every adult clone close to the downed rival leaps on and chews.
export function pileOn(g, owner, b) {
  let n = 0;
  for (const m of adultsOf(g, owner)) {
    if (Math.hypot(m.x - b.x, m.y - b.y) > 90) continue;
    latchOn(m, b, true);
    n++;
  }
  if (n && b.knocked) b.knock = Math.min(b.knock + 0.3 * n, Math.max(b.knock, 0) + 0.6);
  return n;
}

function latchOn(m, b, pile = false) {
  m.act = 'latch'; m.actT = 0; m.latch = b.id; m.clung = false; m.ticks = CLONE.latch.ticks; m.tick = 0; m.jumps = 0; m.jumpSeen = b.jumpAt; m.pile = pile; m.echo = null;
}

// Estilingue: scooped up in its owner's mouth, then fired at a rival as a living projectile.
export function pickUpClone(g, a) {
  const m = adultsOf(g, a).filter(m => Math.abs(m.x - (a.x + a.face * 6)) < 24 && Math.abs(m.y - a.y) < 24).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
  if (!m) return null;
  m.act = 'carried'; m.actT = 0; m.echo = null; m.target = null;
  m.body.collisionFilter.mask = 0;
  a.axo.carry = m.id;
  g.sound('blub', a.x);
  return m;
}

function stepCarried(g, m, owner) {
  if (!owner || owner.axo?.carry !== m.id || owner.knocked || owner.dead) { m.act = null; if (owner?.axo?.carry === m.id) owner.axo.carry = null; m.body.collisionFilter.mask = MASK.minion; return; }
  Body.setPosition(m.body, { x: owner.x + owner.face * 9, y: owner.y - 4 });
  Body.setVelocity(m.body, { x: 0, y: 0 });
  m.face = owner.face;
}

export function throwClone(g, a, drop = false) {
  const m = g.minions.find(m => m.id === a.axo?.carry);
  a.axo.carry = null;
  if (!m) return false;
  m.body.collisionFilter.mask = MASK.minion;
  Body.setPosition(m.body, { x: a.x + a.face * 10, y: a.y - 4 });
  if (drop) { m.act = null; Body.setVelocity(m.body, { x: a.face * 1.5, y: -2 }); return true; }
  m.act = 'thrown'; m.actT = 0; m.face = a.face; m.thrownHit = false;
  m.life -= CLONE.toss.cost;
  Body.setVelocity(m.body, { x: a.face * CLONE.toss.vx, y: CLONE.toss.vy });
  a.attack = 0.25; a.attackKind = 'throw'; a.attackSeq = (a.attackSeq || 0) + 1; a.attackCd = 0.3;
  g.text(a.x, a.y - 30, 'VAI, BROTO!', '#ff9cb8');
  g.sound('swing', a.x);
  return true;
}

function stepThrown(g, m, owner) {
  const v = m.body.velocity;
  const b = g.enemies(owner).find(b => !b.knocked && Math.abs(b.x - m.x) < 12 && Math.abs(b.y - m.y) < 20);
  if (b) {
    const s = Math.sign(v.x) || m.face;
    const dealt = damage(g, b, CLONE.toss.dmg, { x: m.x, y: m.y }, m.owner, 'bite', { kb: { x: s * 2, y: -1.5 }, src: m, killKind: 'clone' });
    if (!m.dead && m.act === 'thrown') {
      if (dealt > 0 && !b.dead) {
        b.hitstun = Math.max(b.hitstun || 0, 0.5); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun);
        g.text(b.x, b.y - 30, 'NHAC!', '#ff9cb8');
        latchOn(m, b);
      } else { m.act = null; Body.setVelocity(m.body, { x: -s * 3, y: -3 }); }
    }
    return;
  }
  if (m.actT > CLONE.toss.time || (m.ground && m.actT > 0.1)) m.act = null;
}

// The special: the clone splits its smile into a mouth full of teeth.
export function startMorph(g, m, owner) {
  if (m.kind === 'bud' || m.kind === 'seed') { m.awaken = true; return; }
  m.act = 'morph'; m.actT = 0; m.morph = 0; m.echo = null; m.latch = null; m.invincible = 0.35;
  if (m.body) m.body.collisionFilter.mask = MASK.minion;
}

function stepMorph(g, m, owner) {
  m.morph = Math.min(1, m.actT / 0.3);
  const v = m.body.velocity;
  Body.setVelocity(m.body, { x: v.x * 0.7, y: v.y });
  if (m.form !== 'demon' && m.morph >= 0.5) {
    m.form = 'demon'; m.kind = 'demon';
    m.hp = Math.min(DEMON.hpMax, m.hp + DEMON.hp); m.maxHp = DEMON.hpMax;
    g.fx('demonMorph', { x: m.x, y: m.y });
    g.sound('sizzle', m.x);
  }
  if (m.actT >= 0.3) { m.act = null; m.morph = 1; }
}

// The demons' share of a rival and of the whole cast, and the owner's heal from it.
function demonBudget(owner, b) {
  const D = owner.axo.demon;
  if (!D) return 0;
  return Math.max(0, Math.min(D.cap - (D.on[b.id] || 0), 50 - D.total));
}
function demonHit(g, m, owner, b, amount, { chip = false, kind = 'fang', kb = { x: 0, y: 0 }, hold = 0 } = {}) {
  const D = owner.axo.demon, n = Math.min(amount, demonBudget(owner, b));
  if (n <= 0 || b.dead) { if (n <= 0 && D) m.sated = true; return 0; }
  // A rival a demon just staggered only takes the damage from the next one.
  const locked = (b.demonLock ?? -9) > g.time;
  const point = { x: b.x - (m.face || 1) * 4, y: b.y - 2 };
  const dealt = damage(g, b, n, point, owner.id, kind, { kb: chip || locked ? { x: 0, y: 0 } : kb, chip: chip || locked, src: m, killKind: 'xolotl' });
  if (dealt > 0) {
    D.on[b.id] = (D.on[b.id] || 0) + dealt; D.total += dealt;
    owner.stats.brood = (owner.stats.brood || 0) + dealt;
    const heal = Math.min(dealt * 0.4, 10 - D.healed);
    if (heal > 0) { owner.hp = Math.min(owner.maxHp, owner.hp + heal); D.healed += heal; }
    if (!chip && !locked) { b.demonLock = g.time + DEMON.lock; if (hold && !b.dead) { b.hitstun = Math.max(b.hitstun || 0, hold); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); } }
    g.fx('toothMarks', { x: b.x, y: b.y - 2 });
  }
  return dealt;
}

// A demon hunts: it pounces at whoever its master is after, bites, latches on and feasts.
function thinkDemon(g, m, owner, dt, v) {
  // While its master is down the demon only snarls where it stands.
  if (owner.knocked) { m.move = 0; return { vx: v.x * 0.8, vy: v.y }; }
  m.think -= dt;
  if (m.think <= 0 || (m.target != null && !g.actor(m.target)) || m.sated) {
    m.think = 0.2;
    const D = owner.axo.demon;
    const foes = g.enemies(owner).filter(b => !b.dead && Math.hypot(b.x - owner.x, b.y - owner.y) < DEMON.sight && (!D || demonBudget(owner, b) > 0));
    const crowded = id => foes.length > 1 && g.minions.filter(o => o !== m && o.kind === 'demon' && o.owner === m.owner && o.target === id).length >= 2;
    const prey = owner.lastPrey != null ? g.actor(owner.lastPrey) : null;
    const t = prey && foes.includes(prey) && !crowded(prey.id) ? prey : foes.filter(b => !crowded(b.id)).sort((p, q) => Math.hypot(p.x - owner.x, p.y - owner.y) - Math.hypot(q.x - owner.x, q.y - owner.y))[0];
    m.target = t ? t.id : null;
    m.sated = false;
  }
  const t = m.target != null ? g.actor(m.target) : null;
  const P = DEMON.pounce, B = DEMON.bite;
  if (m.act === 'pounce') {
    if (m.actT < P.crouch) return { vx: v.x * 0.5, vy: v.y };
    if (!m.launched) {
      m.launched = true;
      const tx = t ? t.x : m.x + m.face * 60, ty = t ? t.y - 4 : m.y - 20, d = Math.max(1, Math.hypot(tx - m.x, ty - m.y));
      g.sound('howl', m.x);
      return { vx: (tx - m.x) / d * P.v, vy: Math.min(-3, (ty - m.y) / d * P.v - 2) };
    }
    if (t && !t.dead && !t.knocked && Math.abs(t.x - m.x) < 18 && Math.abs(t.y - m.y) < 24) {
      const helpless = t.hitstun > 0 || t.stun > 0 || !t.ground;
      if (helpless && g.minions.filter(o => o.act === 'feast' && o.latch === t.id).length < 2 && (m.feastCd ?? -9) < g.time) {
        latchOn(m, t); m.act = 'feast'; m.ticks = DEMON.feast.ticks;
      } else { demonHit(g, m, owner, t, P.dmg, { kb: { x: m.face * 1.5, y: -2 }, hold: 0.3 }); m.act = null; }
      return { vx: -m.face * 1, vy: -2 };
    }
    if (m.actT > P.crouch + P.fly || (m.ground && m.actT > P.crouch + 0.08)) m.act = null;
    // It steers a little in flight toward its prey.
    if (t) return { vx: v.x + clamp((t.x - m.x) * 0.04, -0.6, 0.6), vy: v.y + clamp((t.y - 4 - m.y) * 0.02, -0.4, 0.3) };
    return { vx: v.x, vy: v.y };
  }
  if (m.act === 'bite') {
    if (!m.bit && m.actT >= B.at) {
      m.bit = true;
      if (t && !t.dead && !t.knocked && Math.abs(t.x - m.x) < B.range + 6 && Math.abs(t.y - m.y) < 28) { if (demonHit(g, m, owner, t, B.dmg, { kb: { x: m.face * 1.5, y: -2 }, hold: 0.3 })) g.sound('chomp', m.x); }
    }
    if (m.actT >= B.dur) { m.act = null; m.biteCd = B.cd; }
    return { vx: v.x * 0.7 + (m.actT < B.at ? m.face * 0.8 : 0), vy: v.y };
  }
  if (Math.random() < 0.05) g.fx('embers', { x: m.x, y: m.y - 6 });
  let goal = owner.x - (owner.face || 1) * (12 + m.slot * 9);
  if (t) goal = t.x - Math.sign(t.x - m.x || 1) * (8 + m.slot * 4);
  const dx = goal - m.x, move = Math.abs(dx) > 5 ? Math.sign(dx) : 0;
  if (move) m.face = move;
  if (t) m.face = Math.sign(t.x - m.x) || m.face;
  m.move = move;
  if (t && !t.knocked && demonBudget(owner, t) > 0) {
    const ax = Math.abs(t.x - m.x), ay = Math.abs(t.y - m.y);
    if (ax < B.range && ay < 22 && !(m.biteCd > 0)) { m.act = 'bite'; m.actT = 0; m.bit = false; m.attackSeq++; return { vx: v.x, vy: v.y }; }
    if (ax > 30 && ax < P.range && ay < 80 && !(m.pounceCd > 0) && m.ground) { m.act = 'pounce'; m.actT = 0; m.launched = false; m.pounceCd = P.cd; m.attackSeq++; return { vx: v.x * 0.5, vy: v.y }; }
  }
  return walk(g, m, owner, t, dx, move, v, DEMON.speed, DEMON.jump);
}

// The end of the awakening: every demon still standing swells white and bursts in hellfire.
export function burstDemons(g, owner) {
  let i = 0;
  for (const m of g.minions) if (m.owner === owner.id && m.kind === 'demon' && !m.dying && m.act !== 'burst') { m.act = 'burst'; m.actT = -0.06 * i++; m.latch = null; m.body.collisionFilter.mask = MASK.minion; }
}
function stepBurst(g, m, owner) {
  const v = m.body.velocity;
  Body.setVelocity(m.body, { x: v.x * 0.6, y: v.y });
  if (m.actT < DEMON.burst.warn) return;
  const R = DEMON.burst;
  for (const b of g.enemies(owner)) {
    const d = Math.hypot(b.x - m.x, (b.y - m.y) * 1.3);
    if (b.dead || d > R.r + 6) continue;
    const s = Math.sign(b.x - m.x) || m.face;
    if (damage(g, b, R.dmg, { x: b.x - s * 4, y: b.y }, owner.id, 'ember', { kb: { x: s * 4, y: -4 }, src: m, killKind: 'xolotl' }) > 0 && !b.dead) { b.burning = Math.max(b.burning || 0, R.burn); b.char = Math.min(1, (b.char || 0) + 0.06); }
  }
  blastMinions(g, m.team, owner.id, m.x, m.y, R.r, R.r, R.dmg, 'ember');
  g.fx('sacrifice', { x: m.x, y: m.y + m.h, r: R.r });
  g.shake = Math.max(g.shake, 5);
  g.sound('sizzle', m.x);
  m.dead = true;
  removeMinion(g, m);
}

// Xolo's bubble: blown out of its mouth, it rises ahead and traps the first rival it touches.
export function blowBubble(g, a) {
  for (const m of [...g.minions]) if (m.kind === 'bubble' && m.owner === a.id) popBubble(g, m);
  const m = record(g, a, 'bubble', a.x + a.face * 14, a.y - 6, 0, { r: BUBBLE.r, life: BUBBLE.life, lifeMax: BUBBLE.life, trap: null, vx: BUBBLE.vx * a.face, vy: BUBBLE.vy, face: a.face });
  g.sound('blub', a.x);
  return m;
}

export function popBubble(g, m, bonus = false) {
  g.fx('bubblePop', { x: m.x, y: m.y, r: m.r });
  g.sound('plop', m.x);
  if (bonus) g.text(m.x, m.y - 20, 'PLOC!', '#c8f0ff');
  m.dead = true;
  removeMinion(g, m);
}

function stepBubble(g, m, owner, dt) {
  m.life -= dt;
  const v = m.trap != null ? g.actor(m.trap) : null;
  if (v) {
    // Trapped: the rival floats inside, drifting up, until the time runs out or they mash free.
    if (v.dead || v.knocked || v.swallowedBy != null || !(v.bubbled > 0)) { popBubble(g, m); return; }
    v.bubbled -= dt;
    v.hitstun = Math.max(v.hitstun || 0, Math.min(0.2, v.bubbled)); v.hitstunMax = Math.max(v.hitstunMax || 0, v.hitstun);
    v.float = 0.2;
    Body.setVelocity(v.body, { x: v.body.velocity.x * 0.8, y: -0.4 });
    m.x = v.x; m.y = v.y - 2;
    return;
  }
  m.vx *= 0.985; m.vy = m.vy * 0.97 - 0.01;
  m.x += m.vx; m.y += m.vy;
  const wall = m.x < 14 || m.x > 946 || m.y < 12 || MAP.solids.some(s => m.x + m.r > s.x0 && m.x - m.r < s.x1 && m.y + m.r > s.y0 && m.y - m.r < s.y1);
  if (m.life <= 0 || wall) { popBubble(g, m); return; }
  const b = owner && g.enemies(owner).find(b => !b.knocked && !(b.iframes > 0 && b.dodge > 0) && (b.bubbleImmune ?? -9) < g.time && Math.abs(b.x - m.x) < m.r + 7 && Math.abs(b.y - m.y) < m.r + 14);
  if (!b) return;
  if (b.parry > 0) { popBubble(g, m); return; }
  if (!damage(g, b, 3, { x: m.x, y: m.y }, m.owner, 'bubble', { kb: { x: 0, y: 0 }, chip: true })) { popBubble(g, m); return; }
  if (b.dead || b.knocked) { popBubble(g, m); return; }
  m.trap = b.id; m.life = BUBBLE.trap + 0.2;
  b.bubbled = BUBBLE.trap; b.bubbleBy = m.owner; b.bubbleImmune = g.time + BUBBLE.immune;
  b.attack = 0; b.hits = null;
  g.text(b.x, b.y - 30, 'BOLHA!', '#c8f0ff');
}

// The owner's next blow on a rival in its bubble pops it for a little more.
export function bubbleBonus(g, b, ownerId) {
  if (!(b.bubbled > 0) || b.bubbleBy !== ownerId) return 0;
  b.bubbled = 0;
  const m = g.minions.find(m => m.kind === 'bubble' && m.trap === b.id);
  if (m) popBubble(g, m, true);
  return BUBBLE.pop;
}

// The frog's inhale takes in buds and clones as snacks; a demon burns his mouth.
export function inhaleMinions(g, frog, ahead, mouth, R) {
  for (const m of [...g.minions]) {
    if (m.team === frog.team || !targetable(m) || !m.body) continue;
    const d = ahead(m.x, m.y);
    if (d < 0) continue;
    if (d < 14) {
      if (m.kind === 'demon') {
        g.text(frog.x, frog.y - 34, 'QUEIMOU!', '#ff7a3a');
        damage(g, frog, 6, { x: mouth.x, y: mouth.y }, m.owner, 'ember', { kb: { x: -frog.face * 3, y: -2 }, src: m, killKind: 'xolotl' });
        killMinion(g, m, 'hit');
        return true;
      }
      frog.hp = Math.min(frog.maxHp, frog.hp + 3);
      g.text(frog.x, frog.y - 30, 'NHAC!', '#9be05a');
      g.fx('goo', { x: mouth.x, y: mouth.y, n: 8 });
      g.sound('gulp', frog.x);
      m.dead = true;
      removeMinion(g, m);
      continue;
    }
    const k = 1 - d / R, pull = 2.5 + 6 * k * k;
    const v = m.body.velocity;
    Body.setVelocity(m.body, { x: v.x + (-frog.face * pull - v.x) * 0.4, y: v.y + ((mouth.y - m.y) * 0.1 - v.y) * 0.3 });
    m.hitstun = Math.max(m.hitstun, 0.1);
  }
  return false;
}

// After the physics step: positions, walls, and the pit and the bottom of the map.
export function syncMinions(g) {
  for (const m of [...g.minions]) {
    const b = m.body;
    if (!b) continue;
    if (b.position.x < 8 || b.position.x > 952) { Body.setPosition(b, { x: clamp(b.position.x, 8, 952), y: b.position.y }); Body.setVelocity(b, { x: 0, y: b.velocity.y }); }
    m.x = b.position.x; m.y = b.position.y; m.vx = b.velocity.x; m.vy = b.velocity.y;
    m.prevFeet = m.y + m.h;
    if (m.y > 640) killMinion(g, m, 'fall');
  }
}

export function minionSnapshot(g) {
  const r = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  return g.minions.map(m => ({
    id: m.id, owner: m.owner, slot: m.slot, type: 6, kind: m.kind, form: m.form, team: m.team, x: r(m.x), y: r(m.y), vx: r(m.vx), vy: r(m.vy), face: m.face,
    hp: r(m.hp), maxHp: m.maxHp, life: r(m.life), lifeMax: m.lifeMax, ground: m.ground, move: m.move, act: m.act, actT: r2(m.actT), attack: r2(m.attack),
    attackKind: m.attackKind, attackSeq: m.attackSeq, hitstun: r2(m.hitstun), hitstunMax: r2(m.hitstunMax), hurt: r2(m.hurt), foot: m.foot,
    latch: m.latch, morph: r2(m.morph), part: m.part || null, r: m.r || 0, trap: m.trap ?? null, dying: m.dying > 0
  }));
}
