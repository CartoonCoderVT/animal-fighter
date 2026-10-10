// The Cat King's kingdom: BANDEIRA REAL. K drives his banner into the floor; around it a golden dome makes
// his court stronger (sim/court.js reads buffTier). It is there for good until someone razes it. Little
// worker cats come out of it and go all over the arena for fish (the map's fish spots, sim/map.js); every
// fish they bring home makes it grow: the banner becomes a house (two cat knights come out to guard it, the
// dome grows), and the house a castle (two archers on its towers, and the court stronger anywhere in the
// arena). The workers swing at whoever stands in their way; the knights and archers guard the house. While
// his kingdom stands, K takes the King home (VOLTA AO REINO).
// Everything here is plain data on the Game (g.kingdoms, g.fish): no bodies, no props, no actors. The
// kingdom ticks after the court (sim/game.js), so it stands still in stopped time, pauses and the end of a
// match. Rivals reach it through the court's channels (strikeCourts, courtInPath in sim/court.js).
import { Body } from './physics.js';
import { MAP, pathTo } from './map.js';
import { KINGDOM, SPECIALS, AUTO } from './moves.js';
import { damage, perfectDodge } from './combat.js';
import { setAct, endAct } from './specials.js';
import { strikeCourts, loose, courtFollow } from './court.js';
import { HALF_H } from '../render/rig.js';
import { clamp, rnd } from '../engine/const.js';
import { hitMinions, hurtMinion } from './minions.js';

const K = KINGDOM;
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => u * u * (3 - 2 * u);
const easeOut = u => 1 - (1 - u) * (1 - u);
const NAMES = ['', 'BANDEIRA DERRUBADA!', 'CASA DERRUBADA!', 'CASTELO DERRUBADO!'];
// Rivals the kingdom leaves alone: those out of reach of everything right now.
const HIDDEN = ['world', 'swarm', 'requiem'];

// Points over each level's box (from its base) that a blow has to reach to hit the structure: a tall
// castle is hit at its foot, its walls and its towers alike, whatever a blow tests.
const GRID = K.w.map((w, lv) => {
  if (!lv) return [];
  const h = K.h[lv], n = Math.ceil(w / 16), m = Math.ceil((h - 8) / 16), out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) out.push([-w / 2 + (i * w) / n, -4 - (j * (h - 8)) / m]);
  return out;
});

export const ownKingdom = (g, a) => g.kingdoms?.find(k => k.by === a.id && k.st !== 'fall') || null;
const unitAlive = u => u.st !== 'dead' && u.st !== 'appear';
const nodeById = (g, id) => g.nav.nodes.find(n => n.id === id) || null;
// A rival the kingdom may strike or shoot.
const fair = (b, team) => !b.dead && b.team !== team && !b.knocked && !(b.invincible > 0) && !HIDDEN.includes(b.act);

// ---- where a banner may go ----------------------------------------------------------------------

// Cut [x0, x1] out of a list of intervals.
function cut(set, x0, x1) {
  const out = [];
  for (const [lo, hi] of set) {
    if (x1 <= lo || x0 >= hi) { out.push([lo, hi]); continue; }
    if (lo < x0) out.push([lo, x0]);
    if (x1 < hi) out.push([x1, hi]);
  }
  return out;
}
// The stretches of a floor (nav node) a banner's base may stand on: room for the whole castle it may
// become, away from the map's no-go places (MAP.plantBan) and from other kingdoms, nothing overhead.
function legalSet(g, node, by) {
  const H = K.w[3] / 2;
  let set = [[node.x0 + H, node.x1 - H]];
  for (const b of MAP.plantBan || []) if (b.node === node.id) set = b.x0 == null ? [] : cut(set, b.x0 - H, b.x1 + H);
  for (const k of g.kingdoms) if (k.st !== 'fall' && k.by !== by && k.node === node.id) set = cut(set, k.x - K.apart, k.x + K.apart);
  const top = node.y - K.h[3], bottom = node.y - 1;
  for (const s of MAP.solids) if (s.kind !== 'wall' && s.kind !== 'pit' && s.y1 > top && s.y0 < bottom) set = cut(set, s.x0 - H, s.x1 + H);
  MAP.oneway.forEach((p, i) => { if (!MAP.off?.[i] && p.y + (p.h || 12) > top && p.y < bottom) set = cut(set, p.x0 - H, p.x1 + H); });
  return set.filter(([lo, hi]) => hi >= lo);
}
// The point of the set nearest x, on whole pixels (a multiple of 3), or null.
function nearestIn(set, x) {
  let best = null;
  for (const [lo, hi] of set) {
    let p = Math.round(clamp(x, lo, hi) / 3) * 3;
    if (p < lo) p += 3; if (p > hi) p -= 3;
    if (p < lo || p > hi) continue;
    if (best === null || Math.abs(p - x) < Math.abs(best - x)) best = p;
  }
  return best;
}

// Can King a plant his banner now, and where: { ok, x, node, near, why }.
export function canPlant(g, a) {
  if (ownKingdom(g, a)) return { ok: false, why: 'own' };
  if (g.winPending != null || g.winner != null || g.timeStop || g.kingdoms.length >= K.max) return { ok: false, why: 'busy' };
  const gi = a.groundInfo;
  if (!a.ground || a.climbing || !gi || (gi.kind !== 'solid' && gi.kind !== 'oneway')) return { ok: false, why: 'air' };
  const node = nodeById(g, gi.id);
  if (!node) return { ok: false, why: 'spot' };
  const x = nearestIn(legalSet(g, node, a.id), a.x);
  if (x === null) return { ok: false, why: 'spot' };
  if (Math.abs(x - a.x) > K.snap) return { ok: false, near: x, node, why: 'spot' };
  return { ok: true, x, node };
}
const legalAt = (g, node, x, by) => legalSet(g, node, by).some(([lo, hi]) => x >= lo - 0.01 && x <= hi + 0.01);

// ---- K ------------------------------------------------------------------------------------------

// K: plant the banner, or (with a kingdom standing) go home to it.
export function kingSpecial(g, a) {
  if (ownKingdom(g, a)) startRecall(g, a); else startPlant(g, a);
}

// A refusal: a word over him now and then, and nothing spent (the input buffer tries again a moment).
function refuse(g, a, text) {
  if (!text || g.time - (a.plantMsgT ?? -9) < K.msg) return;
  a.plantMsgT = g.time;
  g.text(a.x, a.y - 30, text, '#e4b18a');
}

function begin(g, a, act, dur, kact) {
  a.powerSeq = (a.powerSeq || 0) + 1;
  a.attack = 0; a.hits = null;
  a.abilityCd = K.failCd;
  setAct(a, act, dur);
  a.kact = kact;
}

function startPlant(g, a) {
  const c = canPlant(g, a);
  if (!c.ok) { refuse(g, a, c.why === 'air' ? 'NO CHÃO!' : c.why === 'spot' ? 'AQUI NÃO!' : null); return; }
  begin(g, a, 'plant', SPECIALS[0].dur, { kind: 'plant', x: c.x, node: c.node.id, done: false });
  if (Math.abs(c.x - a.x) > 2) a.face = Math.sign(c.x - a.x);
  Body.setVelocity(a.body, { x: a.body.velocity.x * 0.2, y: a.body.velocity.y });
  g.sound('swish', a.x);
}

// The banner goes in at `pop` (a blow or his death before that, and there is none).
export function stepPlant(g, a) {
  const k = a.kact, v = a.body.velocity;
  if (k && !k.done && a.actT >= SPECIALS[0].pop) {
    k.done = true;
    const node = nodeById(g, k.node);
    if (node && !ownKingdom(g, a) && g.winPending == null && g.kingdoms.length < K.max && legalAt(g, node, k.x, a.id)) {
      createKingdom(g, a, k.x, node);
      a.abilityCd = K.plantCd;
    } else refuse(g, a, 'AQUI NÃO!');
  }
  if (a.actT > a.actMax) { endAct(g, a); a.kact = null; return null; }
  return { lock: true, vx: v.x * 0.3, vy: a.ground ? v.y : Math.min(v.y, 0.5) };
}

function startRecall(g, a) {
  const kg = ownKingdom(g, a);
  if (g.winPending != null || g.timeStop) return;
  if (!a.ground || a.climbing) { refuse(g, a, 'NO CHÃO!'); return; }
  if (Math.hypot(a.x - kg.x, a.y + HALF_H - kg.y) < K.recallMin) { refuse(g, a, 'JÁ ESTÁ NO REINO'); return; }
  begin(g, a, 'recall', SPECIALS[0].recall, { kind: 'recall', done: false });
  g.fx('kgRecallStart', { x: Math.round(a.x), y: Math.round(a.y), by: a.id });
  g.text(a.x, a.y - 34, 'VOLTA AO REINO!', '#ffd76a');
  g.sound('charge', a.x);
}

// Home at `warp`: by the house, on the side he came from, with his court around him.
export function stepRecall(g, a) {
  const k = a.kact;
  if (k && !k.done && a.actT >= SPECIALS[0].warp) {
    k.done = true;
    const kg = ownKingdom(g, a);
    if (!kg) { endAct(g, a); a.kact = null; return null; }
    const side = Math.sign(a.x - kg.x) || -1;
    const tx = clamp(kg.x + side * (K.w[kg.lv] / 2 + 18), kg.lo, kg.hi), ty = kg.y - HALF_H - 1;
    g.fx('kgRecall', { x0: Math.round(a.x), y0: Math.round(a.y), x1: Math.round(tx), y1: Math.round(ty), by: a.id });
    Body.setPosition(a.body, { x: tx, y: ty });
    Body.setVelocity(a.body, { x: 0, y: 0 });
    a.x = tx; a.y = ty; a.prevFeet = ty + HALF_H; a.teleported = g.seq; a.ghostClear = true; a.lagPos = null;
    a.face = -side;
    courtFollow(g, a);
    a.abilityCd = K.recallCd;
    g.sound('pop', tx);
  }
  if (a.actT > a.actMax) { endAct(g, a); a.kact = null; return null; }
  return { lock: true, vx: 0, vy: a.ground ? a.body.velocity.y : Math.min(a.body.velocity.y, 0.5) };
}

// ---- the kingdom ----------------------------------------------------------------------------------

function createKingdom(g, a, x, node) {
  // The knights' ground: the stretch of this floor around the base, clear of the map's no-go places.
  let set = [[node.x0, node.x1]];
  for (const b of MAP.plantBan || []) if (b.node === node.id && b.x0 != null) set = cut(set, b.x0, b.x1);
  const [lo, hi] = set.find(([l, h]) => x >= l && x <= h) || [node.x0, node.x1];
  const kg = {
    id: g.nextId++, by: a.id, team: a.team, lv: 1, st: 'up', t: 0, x, y: node.y, ox: Math.round(a.x), hp: K.hp[1], mx: K.hp[1], hurt: 0,
    res: 0, need: K.need[1], u: [],
    node: node.id, lo: Math.max(lo, x - K.knight.leash), hi: Math.min(hi, x + K.knight.leash), wT: K.worker.first, kT: [0, 0], aT: [0, 0], hitBy: null, hitT: -9, hitFxT: -9
  };
  g.kingdoms.push(kg);
  if (!g.fishSpots) seedFish(g);
  // The pole bites into the floor: whoever stands right there is thrown back.
  for (const b of g.enemies(a)) {
    if (b.dead || b.knocked || b.invincible > 0 || Math.abs(b.x - x) >= K.ring.r || Math.abs(b.y + HALF_H - node.y) >= K.ring.ry) continue;
    const s = Math.sign(b.x - x) || a.face;
    damage(g, b, K.ring.dmg, { x: b.x - s * 4, y: b.y }, a.id, 'bash', { kb: { x: s * K.ring.kb[0], y: K.ring.kb[1] }, solo: true });
  }
  strikeCourts(g, a, (px, py) => Math.abs(px - x) < K.ring.r && Math.abs(py - (node.y - 9)) < K.ring.ry, K.ring.dmg, f => Math.sign(f.x - x) || 1);
  g.fx('kgPlant', { x, y: node.y, by: a.id, ox: kg.ox, f: a.face });
  g.text(x, node.y - 70, 'PELO REINO!', '#ffd76a');
  g.shake = Math.max(g.shake, 6);
  g.sound('thud', x);
  return kg;
}

// A blow (or shot, blast, thrown thing: kind) on the structure (v === kg) or one of its units.
export function hurtKingdom(g, kg, v, amount, src = null, dir = 0, kind = 'hit') {
  if (kg.st === 'fall' || !(amount > 0)) return false;
  const o = src != null ? g.actor(src) : null, credit = n => { if (o && o.id !== kg.by && o.team !== kg.team) o.stats.damage += n; };
  if (v === kg) {
    const amt = amount * (kind === 'blast' ? K.vs.blast : kind === 'pellet' ? K.vs.pellet : 1), before = kg.hp;
    kg.hp -= amt; kg.hurt = 0.25;
    if (o && o.team !== kg.team) { kg.hitBy = o.id; kg.hitT = g.time; }
    credit(Math.min(amt, before));
    if (g.time - kg.hitFxT >= K.hitFx) {
      kg.hitFxT = g.time;
      g.fx('kgHit', { x: Math.round(kg.x), y: Math.round(kg.y - K.h[kg.lv] / 2), by: kg.by, f: dir || 1 });
      g.sound('crack', kg.x);
    }
    if (kg.hp <= 0) razeKingdom(g, kg, src);
    return true;
  }
  if (!unitAlive(v)) return false;
  const amt = amount * K.buff.taken[kg.lv], before = v.hp, s = dir || -(v.f || 1);
  v.hp -= amt; v.hurt = 0.25;
  credit(Math.min(amt, before));
  g.fx('kgUnitHurt', { x: Math.round(v.x), y: Math.round(v.y - 9), k: v.k, f: s });
  g.sound('hit', v.x);
  if (v.hp > 0) {
    if (v.k !== 'archer' && !v.air) v.x = v.k === 'knight' ? clamp(v.x + s * 3, kg.lo, kg.hi) : v.x + s * 3;
    return true;
  }
  unitDie(g, kg, v, s);
  return true;
}

function unitDie(g, kg, u, s) {
  Object.assign(u, { st: 'dead', t: 0, hp: 0, c: 0, hop: null, air: false });
  release(g, u);
  if (u.k === 'knight') kg.kT[u.i] = K.knight.respawn;
  else if (u.k === 'archer') kg.aT[u.i] = K.archer.respawn;
  else kg.wT = Math.max(kg.wT, K.worker.respawn);
  g.fx('kgUnitDie', { x: Math.round(u.x), y: Math.round(u.y), k: u.k, f: s });
  g.sound('squish', u.x);
}
// A worker lets go of the fish it was after.
function release(g, u) {
  for (const f of g.fish) if (f.cl === u.id) f.cl = null;
}

// Razed: everything in it falls with it; the King waits to plant again; whoever did it eats well.
function razeKingdom(g, kg, src, quiet = false) {
  Object.assign(kg, { st: 'fall', t: 0, hp: 0 });
  for (const u of kg.u) {
    if (u.st !== 'dead') g.fx('kgUnitDie', { x: Math.round(u.x), y: Math.round(u.y), k: u.k, f: Math.sign(u.x - kg.x) || 1 });
    release(g, u);
  }
  kg.u = [];
  if (quiet) return;
  g.fx('kgFall', { x: kg.x, y: kg.y, by: kg.by, lv: kg.lv });
  g.text(kg.x, kg.y - K.h[kg.lv] - 10, NAMES[kg.lv], '#ff9a8a');
  g.shake = Math.max(g.shake, 8); g.flash = Math.max(g.flash, 0.2);
  g.sound('break', kg.x);
  const king = g.actor(kg.by);
  if (king) king.abilityCd = Math.max(king.abilityCd, K.replant);
  const o = src != null ? g.actor(src) : null;
  if (o && !o.dead && o.team !== kg.team) {
    o.hp = Math.min(o.maxHp, o.hp + K.loot);
    g.text(o.x, o.y - 34, 'SAQUE!', '#8fd694');
  }
}

// A fish brought home: it heals, and enough of them make it grow.
function deliver(g, kg) {
  kg.hp = Math.min(kg.mx, kg.hp + K.heal[kg.lv]);
  if (kg.lv >= 3) return;
  if (++kg.res < kg.need) return;
  kg.lv++; kg.res = 0; kg.need = K.need[kg.lv];
  kg.hp += K.hp[kg.lv] - K.hp[kg.lv - 1]; kg.mx = K.hp[kg.lv];
  kg.st = 'up'; kg.t = 0;
  g.fx('kgLevel', { x: kg.x, y: kg.y, by: kg.by, lv: kg.lv });
  g.text(kg.x, kg.y - K.h[kg.lv] - 10, kg.lv === 2 ? 'VIROU CASA!' : 'VIROU CASTELO!', '#ffd76a');
  g.shake = Math.max(g.shake, 4);
  g.sound('summon', kg.x);
}

// How strong King king's court is at (x, feetY): 0..3. While a level is still being built, the one
// before it; at the castle, anywhere.
export function buffTier(g, king, x, feetY) {
  const kg = ownKingdom(g, king);
  if (!kg) return 0;
  const T = kg.st === 'up' ? kg.lv - 1 : kg.lv;
  if (T <= 0) return 0;
  if (T >= 3) return 3;
  if (feetY > kg.y + 30) return 0;
  const dx = (x - kg.x) / K.aura[T], dy = (kg.y - feetY) / K.auraY[T];
  return dx * dx + dy * dy <= 1 ? T : 0;
}

// ---- reaching it --------------------------------------------------------------------------------

// A blow reaching the kingdoms of the rivals of `atk` (an actor or { id, team }; null for anyone's): the
// structure when any of its points passes `test`, each unit whose body does. Returns how many were hit.
export function strikeKingdoms(g, atk, test, amount, dirOf = null, kind = 'hit') {
  if (!(amount > 0) || !g.kingdoms?.length) return 0;
  let n = 0;
  for (const kg of [...g.kingdoms]) {
    if (kg.st === 'fall' || (atk && (kg.by === atk.id || kg.team === atk.team))) continue;
    if (GRID[kg.lv].some(([dx, dy]) => test(kg.x + dx, kg.y + dy))) {
      const c = { x: kg.x, y: kg.y - K.h[kg.lv] / 2 };
      if (hurtKingdom(g, kg, kg, amount, atk?.id ?? null, dirOf ? dirOf(c) : 0, kind)) n++;
    }
    for (const u of [...kg.u]) {
      if (kg.st === 'fall') break;
      if (unitAlive(u) && test(u.x, u.y - K.unitY[u.k]) && hurtKingdom(g, kg, u, amount, atk?.id ?? null, dirOf ? dirOf(u) : 0, kind)) n++;
    }
  }
  return n;
}

// Where along the segment (0..1) a ray from (x0, y0) to (x1, y1) enters the box, or Infinity.
function slab(x0, y0, x1, y1, bx0, by0, bx1, by1) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[x0, dx, bx0, bx1], [y0, dy, by0, by1]]) {
    if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return Infinity; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}
// A shot on its way (b, toward x1, y1): the first rival structure or unit on it: { kg, f, u }.
export function kingdomInPath(g, b, x1, y1) {
  let best = null;
  const dx = x1 - b.x, dy = y1 - b.y, len2 = dx * dx + dy * dy || 1;
  for (const kg of g.kingdoms || []) {
    if (kg.st === 'fall' || kg.team === b.team || kg.by === b.owner) continue;
    const w = K.w[kg.lv] / 2, t = slab(b.x, b.y, x1, y1, kg.x - w, kg.y - K.h[kg.lv], kg.x + w, kg.y);
    if (t < (best?.u ?? Infinity)) best = { kg, f: kg, u: t };
    for (const u of kg.u) {
      if (!unitAlive(u)) continue;
      const cx = u.x, cy = u.y - K.unitY[u.k], p = Math.max(0, Math.min(1, ((cx - b.x) * dx + (cy - b.y) * dy) / len2));
      if (Math.hypot(b.x + dx * p - cx, b.y + dy * p - cy) < K.unitR[u.k] && p < (best?.u ?? Infinity)) best = { kg, f: u, u: p };
    }
  }
  return best;
}

// The nearest point of a rival's structure ahead of a (within reach), to aim the court at: { x, y } or null.
export function structureAhead(g, a, dir, reach) {
  let best = null, bd = Infinity;
  for (const kg of g.kingdoms || []) {
    if (kg.st === 'fall' || kg.team === a.team) continue;
    const w = K.w[kg.lv] / 2, h = K.h[kg.lv];
    const near = clamp(a.x, kg.x - w, kg.x + w), d = (near - a.x) * dir;
    if (d < -w * 2 || Math.abs(near - a.x) > reach || a.y + HALF_H < kg.y - h - 40 || a.y - HALF_H > kg.y + 10) continue;
    if (Math.abs(near - a.x) < bd) { bd = Math.abs(near - a.x); best = { x: near, y: clamp(a.y, kg.y - h + 6, kg.y - 6) }; }
  }
  return best;
}

// ---- the units -------------------------------------------------------------------------------------

function addUnit(g, kg, k, i, x, y) {
  const u = { id: g.nextId++, k, i, x, y, f: Math.sign(x - kg.x) || 1, vx: 0, st: 'appear', t: 0, hp: K[k].hp, hurt: 0, c: 0, air: false, node: kg.node, path: null, pathTo: null, hop: null, cd: 0, prev: null, foe: null, foeN: 0, foeT: -9, ign: null, wx: 0, wt: 0 };
  kg.u.push(u);
  g.fx('kgUnit', { x: Math.round(x), y: Math.round(y), k, by: kg.by });
  g.sound('pop', x);
  return u;
}

// The real end of a floor (past its walkable inset) on side dir.
function realEnd(g, node, dir) {
  if (node.solid) return dir > 0 ? node.solid.x1 : node.solid.x0;
  const p = MAP.oneway[node.index];
  return p ? (dir > 0 ? p.x1 : p.x0) : dir > 0 ? node.x1 + 10 : node.x0 - 10;
}

// Walk a unit along the floors to (goal node, gx), hopping from floor to floor on the bots' map graph.
function walkTo(g, kg, u, goal, gx, speed) {
  const x0 = u.x;
  if (u.hop) {
    const h = u.hop;
    h.u = Math.min(1, h.u + 1 / 60 / h.T);
    const p = h.u;
    if (h.y1 < h.y0 - 4) {
      // Up: rise first, then over the lip.
      u.y = p < 0.6 ? lerp(h.y0, h.y1 - 12, easeOut(p / 0.6)) : lerp(h.y1 - 12, h.y1, (p - 0.6) / 0.4);
      u.x = lerp(h.x0, h.x1, ease(Math.max(0, (p - 0.35) / 0.65)));
    } else if (h.y1 <= h.y0 + 4) {
      u.x = lerp(h.x0, h.x1, p);
      u.y = lerp(h.y0, h.y1, p) - 30 * 4 * p * (1 - p);
    } else {
      // Down: out over the edge, then the drop.
      u.x = lerp(h.x0, h.x1, ease(Math.min(1, p / 0.5)));
      u.y = h.y0 - 10 * 4 * p * (1 - p) + (h.y1 - h.y0) * p * p;
    }
    u.vx = u.x - x0; u.air = true;
    if (Math.abs(u.vx) > 0.2) u.f = Math.sign(u.vx);
    if (p >= 1) { u.x = h.x1; u.y = h.y1; u.node = h.to; u.air = false; u.hop = null; u.path?.shift(); }
    return 'moving';
  }
  u.air = false;
  const step = to => { const d = to - u.x, s = Math.sign(d) * Math.min(Math.abs(d), speed); u.x += s; u.vx = s; if (s) u.f = Math.sign(s); };
  if (u.node === goal) {
    if (Math.abs(gx - u.x) < 3) { u.vx = 0; return 'there'; }
    step(gx);
    return 'moving';
  }
  if (u.pathTo !== goal || !u.path || (u.path[0] && u.path[0].from !== u.node)) { u.path = pathTo(g.nav, u.node, goal); u.pathTo = goal; }
  const e = u.path?.[0];
  if (!e) { u.path = null; u.pathTo = null; u.vx = 0; return 'stuck'; }
  const to = nodeById(g, e.to);
  if (!to) { u.path = null; u.pathTo = null; u.vx = 0; return 'stuck'; }
  let ex, lx;
  if (e.type === 'up' || e.type === 'drop') { ex = clamp(u.x, e.x0, e.x1); lx = ex; }
  else if (e.type === 'fall') { ex = realEnd(g, nodeById(g, e.from), e.dir) + e.dir * 6; lx = e.land; }
  else { ex = e.takeoff; lx = e.land; }
  if (Math.abs(ex - u.x) > 2) { step(ex); return 'moving'; }
  const dx = Math.abs(lx - u.x), dy = Math.abs(to.y - u.y);
  u.hop = { x0: u.x, y0: u.y, x1: lx, y1: to.y, T: clamp(0.25 + dx / 400 + dy / 600, 0.3, 0.9), u: 0, to: e.to };
  if (Math.abs(lx - u.x) > 1) u.f = Math.sign(lx - u.x);
  return 'moving';
}

// A blow of one of the kingdom's units at (cx, cy): rivals within spec.r, never launched or knocked down,
// and (with the court) only one blow every AUTO.stagger s makes a rival reel. A parried blow is batted
// back at the unit (never at the King, wherever he is).
function unitHit(g, kg, u, spec, cx, cy, dir) {
  const dmg = spec.dmg * K.buff.dmg[kg.lv];
  // The axolotl's clones in the way take the blow too.
  let struck = hitMinions(g, kg.team, m => Math.hypot(m.x - cx, (m.y - cy) * 1.15) < spec.r, m => hurtMinion(g, m, dmg, { x: m.x, y: m.y }, kg.by, spec.kind, { kb: { x: dir * 3, y: -2 } }));
  for (const b of g.actors) {
    if (!fair(b, kg.team) || Math.hypot(b.x - cx, (b.y - cy) * 1.15) >= spec.r) continue;
    if (b.iframes > 0 && b.dodge > 0 && !b.perfect) { perfectDodge(g, b); continue; }
    const light = g.time - (b.courtReelT ?? -9) < AUTO.stagger;
    if (!light) b.courtReelT = g.time;
    const dealt = damage(g, b, dmg, { x: b.x - dir * 4, y: b.y }, kg.by, spec.kind, { kb: { x: dir * spec.kb[0], y: spec.kb[1] }, solo: true, light, noLift: true, dir: rnd(-0.8, 0.8), familiar: () => { u.cd = Math.max(u.cd, 0.8); } });
    if (!dealt) continue;
    struck++;
    if (!b.dead && !b.knocked && !light && spec.hold) { b.hitstun = Math.max(b.hitstun || 0, spec.hold); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); }
  }
  struck += strikeCourts(g, g.actor(kg.by) || { id: kg.by, team: kg.team }, (x, y) => Math.hypot(x - cx, y - cy) < spec.r + 4, dmg, () => dir);
  g.sound(struck ? (spec.kind === 'blade' ? 'slash' : 'punch') : 'swish', cx);
  return struck;
}

// The rival in a worker's way (just ahead of it, about its height), if it is not ignoring them.
function inTheWay(g, kg, u) {
  const W = K.worker;
  for (const b of g.actors) {
    if (!fair(b, kg.team) || (u.ign && u.ign.id === b.id && g.time < u.ign.until)) continue;
    const ahead = (b.x - u.x) * u.f;
    if (ahead >= -4 && ahead <= W.see && Math.abs(b.y + HALF_H - u.y) < W.seeY) return b;
  }
  return null;
}

// The best fish for a worker: one on the map, not someone else's, not by a kingdom; the cheapest walk.
function pickFish(g, kg, u) {
  let best = null, bs = Infinity;
  for (const f of g.fish) {
    if (f.cl != null && f.cl !== u.id) continue;
    const s = pathCost(g, u.node, f.node) * 120 + Math.abs(f.x - u.x);
    if (s < bs) { bs = s; best = f; }
  }
  return best;
}
// How far apart two floors are on the map graph (all pairs, worked out once a Game).
function pathCost(g, a, b) {
  if (a === b) return 0;
  if (!g.kgCost) {
    const ids = g.nav.nodes.map(n => n.id), D = new Map();
    for (const i of ids) for (const j of ids) D.set(i + '>' + j, i === j ? 0 : Infinity);
    for (const e of g.nav.edges) if (e.cost < D.get(e.from + '>' + e.to)) D.set(e.from + '>' + e.to, e.cost);
    for (const k of ids) for (const i of ids) for (const j of ids) {
      const v = D.get(i + '>' + k) + D.get(k + '>' + j);
      if (v < D.get(i + '>' + j)) D.set(i + '>' + j, v);
    }
    g.kgCost = D;
  }
  return g.kgCost.get(a + '>' + b) ?? Infinity;
}

function stepWorker(g, kg, u, dt) {
  const W = K.worker, speed = W.speed * (u.c ? W.carry : 1);
  u.cd = Math.max(0, u.cd - dt);
  switch (u.st) {
    case 'appear': if (u.t >= 0.4) { u.st = 'go'; u.t = 0; } return;
    case 'hit': {
      if (u.t >= W.swing.dur * W.swing.at && !u.swung) { u.swung = true; unitHit(g, kg, u, W.swing, u.x + u.f * 10, u.y - 10, u.f); }
      if (u.t >= W.swing.dur) { u.st = u.prev || 'go'; u.t = 0; u.cd = W.cd; u.swung = false; }
      return;
    }
    case 'gather': {
      u.vx = 0;
      const f = g.fish.find(f => f.cl === u.id);
      if (!f) { u.st = 'go'; u.t = 0; return; }
      if (u.t >= K.fish.gather) {
        takeFish(g, f);
        u.c = 1; u.st = 'back'; u.t = 0;
        g.fx('kgPick', { x: Math.round(f.x), y: Math.round(f.y) });
        g.sound('pickup', f.x);
      }
      return;
    }
    case 'drop': {
      u.vx = 0;
      if (u.t >= K.fish.drop) {
        u.c = 0; u.st = 'go'; u.t = 0;
        g.fx('kgDeliver', { x: Math.round(kg.x), y: Math.round(kg.y - 10), by: kg.by });
        g.sound('pop', kg.x);
        deliver(g, kg);
      }
      return;
    }
  }
  // Walking (out for fish, home with one, or idling about the door): a rival in the way gets swung at.
  if ((u.st === 'go' || u.st === 'back') && !u.air && u.cd <= 0) {
    const b = inTheWay(g, kg, u);
    if (b) {
      if (u.foe !== b.id || g.time - u.foeT > W.give + 1) { u.foe = b.id; u.foeN = 0; u.foeT = g.time; }
      if (++u.foeN > W.tries || g.time - u.foeT > W.give) { u.ign = { id: b.id, until: g.time + W.ignore }; u.foe = null; }
      else { u.prev = u.st; u.st = 'hit'; u.t = 0; u.swung = false; u.f = Math.sign(b.x - u.x) || u.f; u.vx = 0; return; }
    }
  }
  if (u.st === 'back') {
    const r = walkTo(g, kg, u, kg.node, kg.x, speed);
    if (r === 'there') { u.st = 'drop'; u.t = 0; u.f = Math.sign(kg.x - u.x) || u.f; }
    else if (r === 'stuck') homeward(g, kg, u);
    return;
  }
  if (u.st === 'go') {
    let f = g.fish.find(f => f.cl === u.id);
    if (!f) {
      f = pickFish(g, kg, u);
      if (!f) { u.st = 'idle'; u.t = 0; return; }
      f.cl = u.id;
    }
    const r = walkTo(g, kg, u, f.node, f.x, speed);
    if (r === 'there') { u.st = 'gather'; u.t = 0; }
    else if (r === 'stuck') { f.cl = null; homeward(g, kg, u); }
    return;
  }
  // Idle: pacing about the door, looking for fish now and then.
  if ((u.wt -= dt) <= 0) {
    u.wt = rnd(0.5, 1.1); u.wx = rnd(-20, 20);
    if (pickFish(g, kg, u)) { u.st = 'go'; u.t = 0; return; }
  }
  if (walkTo(g, kg, u, kg.node, clamp(kg.x + u.wx, kg.lo, kg.hi), speed * 0.6) === 'stuck') homeward(g, kg, u);
}
// Lost (no way there from where it stands): back home in a puff.
function homeward(g, kg, u) {
  release(g, u);
  g.fx('kgUnit', { x: Math.round(kg.x), y: Math.round(kg.y), k: u.k, by: kg.by });
  Object.assign(u, { x: kg.x, y: kg.y, node: kg.node, hop: null, path: null, pathTo: null, air: false, st: u.c ? 'drop' : 'idle', t: 0, vx: 0 });
}

function stepKnight(g, kg, u, dt) {
  const N = K.knight, side = u.i ? 1 : -1;
  u.cd = Math.max(0, u.cd - dt);
  u.y = kg.y; u.air = false;
  if (u.st === 'appear') { if (u.t >= 0.4) { u.st = 'guard'; u.t = 0; } return; }
  if (u.st === 'hit') {
    u.vx = 0;
    if (u.t >= N.swing.dur * N.swing.at && !u.swung) { u.swung = true; unitHit(g, kg, u, N.swing, u.x + u.f * 14, u.y - 17, u.f); }
    if (u.t >= N.swing.dur) { u.st = 'guard'; u.t = 0; u.cd = N.cd; u.swung = false; }
    return;
  }
  const zone = b => fair(b, kg.team) && Math.abs(b.x - kg.x) < N.guard && Math.abs(b.y + HALF_H - kg.y) < N.guardY;
  const last = g.time - kg.hitT < 1.5 ? g.actor(kg.hitBy) : null;
  let T = last && zone(last) ? last : null;
  if (!T) { let bd = Infinity; for (const b of g.actors) if (zone(b) && Math.abs(b.x - u.x) < bd) { bd = Math.abs(b.x - u.x); T = b; } }
  const move = (to, speed) => { const d = clamp(to, kg.lo, kg.hi) - u.x, s = Math.sign(d) * Math.min(Math.abs(d), speed); u.x += s; u.vx = s; if (Math.abs(s) > 0.1) u.f = Math.sign(s); };
  if (T) {
    const s = Math.sign(T.x - u.x) || side;
    if (Math.abs(T.x - u.x) < N.reach && Math.abs(T.y + HALF_H - u.y) < 40 && u.cd <= 0) { u.st = 'hit'; u.t = 0; u.f = s; u.swung = false; u.vx = 0; return; }
    if (u.st !== 'chase') { u.st = 'chase'; u.t = 0; }
    move(T.x - s * 16, N.speed);
    u.f = s;
    return;
  }
  const post = kg.x + side * (K.w[kg.lv] / 2 + N.post);
  move(post, N.speed * 0.8);
  if (Math.abs(post - u.x) < 1) { if (u.st !== 'guard') { u.st = 'guard'; u.t = 0; } u.f = side; u.vx = 0; }
  else if (u.st !== 'chase') { u.st = 'chase'; u.t = 0; }
}

function stepArcher(g, kg, u, dt) {
  const A = K.archer;
  u.x = kg.x + A.dx[u.i]; u.y = kg.y - K.h[3]; u.vx = 0; u.air = false;
  u.cd -= dt;
  if (u.st === 'appear') { if (u.t >= 0.4) { u.st = 'idle'; u.t = 0; } return; }
  const cy = u.y - K.unitY.archer;
  let T = null, bd = Infinity;
  for (const b of g.actors) {
    if (!fair(b, kg.team) || Math.abs(b.x - u.x) > A.range || Math.abs(b.y - cy) > A.rangeY) continue;
    const d = Math.hypot(b.x - u.x, b.y - cy);
    if (d < bd) { bd = d; T = b; }
  }
  if (T) u.f = Math.sign(T.x - u.x) || u.f;
  if (u.st === 'shoot') {
    if (u.t >= A.draw && !u.swung && T) {
      u.swung = true;
      const lead = (T.body?.velocity.x || 0) * (Math.abs(T.x - u.x) / 12) * A.lead;
      loose(g, { id: kg.by, team: kg.team }, u.x + u.f * 4, cy, { x: T.x + lead, y: T.y }, { dmg: A.dmg, hold: A.hold }, { auto: true, mult: K.buff.dmg[kg.lv], gate: true });
    }
    if (u.t >= A.pose) { u.st = 'idle'; u.t = 0; u.swung = false; u.cd = A.every; }
    return;
  }
  if (T && u.cd <= 0) { u.st = 'shoot'; u.t = 0; u.swung = false; }
}

// ---- fish ------------------------------------------------------------------------------------------

function seedFish(g) {
  g.fish = [];
  g.fishSpots = (MAP.fish || []).map(([x, y], i) => {
    const n = g.nav.nodes.find(n => n.y === y && x >= n.x0 - 0.01 && x <= n.x1 + 0.01);
    return { i, x, y, node: n?.id ?? null, t: K.fish.first + i * K.fish.stagger, on: false };
  }).filter(s => s.node);
}
function takeFish(g, f) {
  g.fish = g.fish.filter(o => o !== f);
  const s = g.fishSpots?.[f.i];
  if (s) { s.on = false; s.t = K.fish.back; }
}

function tickFish(g, dt) {
  const standing = g.kingdoms.filter(k => k.st !== 'fall');
  for (const s of g.fishSpots) {
    if (s.on || (s.t -= dt) > 0) continue;
    const dormant = standing.some(k => Math.hypot(s.x - k.x, s.y - k.y) < K.fish.near);
    if (dormant || g.fish.length >= K.fish.cap) { s.t = 1; continue; }
    s.on = true;
    g.fish.push({ id: g.nextId++, x: s.x, y: s.y, i: s.i, node: s.node, cl: null });
    g.fx('kgFish', { x: s.x, y: s.y });
  }
  // Anyone (but a King with a kingdom of his own) walking over a fish eats it.
  for (const f of [...g.fish]) {
    const a = g.actors.find(a => !a.dead && !a.knocked && Math.abs(a.x - f.x) < 14 && Math.abs(a.y + HALF_H - f.y) < 20 && !standing.some(k => k.by === a.id));
    if (!a) continue;
    a.hp = Math.min(a.maxHp, a.hp + K.fish.eat);
    takeFish(g, f);
    g.fx('kgEat', { x: f.x, y: f.y });
    g.text(a.x, a.y - 30, 'NHAC!', '#8fd694');
    g.sound('pop', f.x);
  }
}

// ---- every step ---------------------------------------------------------------------------------------

export function tickKingdoms(g, dt) {
  // Where a human King's banner would go if he pressed K now (the ghost the renderer shows).
  for (const a of g.actors) if (a.type === 0 && !a.bot) {
    const c = !a.dead && !a.act && a.abilityCd <= 0 && !ownKingdom(g, a) ? canPlant(g, a) : null;
    a.pk = c?.ok ? c.x : null;
  }
  if (!g.kingdoms.length) { if (g.fishSpots) { g.fish = []; g.fishSpots = null; } return; }
  for (const kg of [...g.kingdoms]) {
    const king = g.actor(kg.by);
    if (!king && kg.st !== 'fall') { razeKingdom(g, kg, null, true); kg.t = K.fall; }
    if (king) kg.team = king.team;
    kg.t += dt;
    kg.hurt = Math.max(0, kg.hurt - dt);
    if (kg.st === 'fall') {
      if (kg.t >= K.fall) g.kingdoms.splice(g.kingdoms.indexOf(kg), 1);
      continue;
    }
    if (kg.st === 'up' && kg.t >= K.up) {
      kg.st = 'stand'; kg.t = 0;
      if (kg.lv === 2) kg.kT = [0, 0.25];
      if (kg.lv === 3) kg.aT = [0, 0.25];
    }
    hitByThrown(g, kg);
    if (kg.st === 'fall') continue;
    spawnUnits(g, kg, dt);
    for (const u of [...kg.u]) {
      u.t += dt;
      u.hurt = Math.max(0, u.hurt - dt);
      if (u.st === 'dead') { if (u.t >= 0.5) kg.u.splice(kg.u.indexOf(u), 1); continue; }
      if (u.k === 'worker') stepWorker(g, kg, u, dt);
      else if (u.k === 'knight') stepKnight(g, kg, u, dt);
      else stepArcher(g, kg, u, dt);
      if (kg.st === 'fall') break;
    }
  }
  if (g.fishSpots) tickFish(g, dt);
}

// A thing thrown at it (by a rival) knocks a piece off.
function hitByThrown(g, kg) {
  const w = K.w[kg.lv] / 2, h = K.h[kg.lv];
  for (const p of g.props) {
    if (p.held || !(p.throwTime > g.time) || p.body.speed <= 4 || p.kgHit === kg.id) continue;
    if (Math.abs(p.x - kg.x) > w + (p.w || 0) / 2 || p.y < kg.y - h - (p.h || 0) / 2 || p.y > kg.y + (p.h || 0) / 2) continue;
    const o = g.actor(p.owner);
    if (o && o.team === kg.team) continue;
    p.kgHit = kg.id;
    hurtKingdom(g, kg, kg, K.vs.thrown, p.owner ?? null, Math.sign(p.body.velocity.x) || 1, 'thrown');
    if (kg.st === 'fall') return;
  }
}

function spawnUnits(g, kg, dt) {
  const lv = kg.lv, live = k => kg.u.filter(u => u.k === k && u.st !== 'dead');
  if ((kg.wT -= dt) <= 0) {
    if (live('worker').length < K.worker.n[lv]) addUnit(g, kg, 'worker', 0, kg.x, kg.y);
    kg.wT = K.worker.every;
  }
  if (kg.st !== 'up') {
    for (let i = 0; i < K.knight.n[lv]; i++) {
      if (kg.u.some(u => u.k === 'knight' && u.i === i)) continue;
      if ((kg.kT[i] -= dt) <= 0) addUnit(g, kg, 'knight', i, kg.x, kg.y);
    }
    for (let i = 0; i < K.archer.n[lv]; i++) {
      if (kg.u.some(u => u.k === 'archer' && u.i === i)) continue;
      if ((kg.aT[i] -= dt) <= 0) addUnit(g, kg, 'archer', i, kg.x + K.archer.dx[i], kg.y - K.h[3]).cd = K.archer.first + (i * K.archer.every) / 2;
    }
  }
}

// ---- the network -------------------------------------------------------------------------------------

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
export const kingdomSnapshot = k => ({
  id: k.id, by: k.by, team: k.team, lv: k.lv, st: k.st, t: r2(k.t), x: k.x, y: k.y, ox: k.ox, hp: r1(k.hp), mx: k.mx, hurt: r2(k.hurt), res: k.res, need: k.need,
  u: k.u.map(u => ({ id: u.id, k: u.k, x: r1(u.x), y: r1(u.y), f: u.f, vx: r1(u.vx), st: u.st, t: r2(u.t), hp: r1(u.hp), hurt: r2(u.hurt), c: u.c, air: u.air ? 1 : 0 }))
});
export const fishSnapshot = fish => (fish || []).map(f => ({ id: f.id, x: f.x, y: f.y }));
