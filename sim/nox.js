// Nox's blood. The pools it leaves on the floors (blows that draw blood, bleeding, severed parts, the
// dead), which he drinks from close by; and, as DARK NOX, his scythe let loose: a familiar that flies
// around him cutting whoever comes near, and strikes along with every one of his dark blows.
import { Body } from './physics.js';
import { MAP } from './map.js';
import { DARK, POOL, FAM, FAM_PLAN, MOVES } from './moves.js';
import { weightOf } from './fighters.js';
import { damage, markBlood, bleedFor, fillBlood, perfectDodge, cutCorpse } from './combat.js';
import { knockdown } from './ragdoll.js';
import { damageProp } from './props.js';
import { strikeCourts } from './court.js';
import { HALF_H } from '../render/rig.js';
import { clamp, rnd } from '../engine/const.js';

// ---- pools ------------------------------------------------------------------------------------

// The walkable surface under (x, y): its top, its ends, and which one-way platform it is (-1 if none).
// Platforms that are gone for now (the castle's loose stone) hold nothing.
function floorUnder(g, x, y) {
  let best = null;
  // (Nothing pools at the bottom of the pit: it is lost down there.)
  for (const s of MAP.solids) if (s.kind !== 'wall' && s.kind !== 'pit' && x >= s.x0 && x <= s.x1 && s.y0 >= y - 2 && (!best || s.y0 < best.y)) best = { y: s.y0, x0: s.x0, x1: s.x1, ow: -1 };
  MAP.oneway.forEach((p, i) => { if (!g.hz?.off?.[i] && x >= p.x0 && x <= p.x1 && p.y >= y - 2 && (!best || p.y < best.y)) best = { y: p.y, x0: p.x0, x1: p.x1, ow: i }; });
  return best;
}

// Blood landing around (x, y) falls to the floor under it and pools there (joining a pool close by).
export function spill(g, x, y, amt) {
  if (!(amt > 0.05) || !g.pools) return;
  const f = floorUnder(g, x, y);
  if (!f) return;
  x = clamp(x, f.x0 + 3, f.x1 - 3);
  const near = g.pools.find(p => p.y === f.y && Math.abs(p.x - x) < POOL.merge + p.amt * 0.5);
  if (near) {
    const k = amt / (near.amt + amt);
    near.x = clamp(near.x + (x - near.x) * k * 0.5, f.x0 + 3, f.x1 - 3);
    near.amt = Math.min(POOL.max, near.amt + amt);
    return;
  }
  g.pools.push({ id: g.nextId++, x, y: f.y, x0: f.x0, x1: f.x1, ow: f.ow, amt: Math.min(POOL.max, amt), by: -1 });
  if (g.pools.length > POOL.cap) {
    let small = 0;
    for (let i = 1; i < g.pools.length; i++) if (g.pools[i].amt < g.pools[small].amt) small = i;
    g.pools.splice(small, 1);
  }
}

// Pools dry out; Nox drinks the ones near him: his meter fills, and as DARK NOX it heals him.
function tickPools(g, dt) {
  for (const p of g.pools) {
    p.by = -1;
    p.amt -= POOL.dry * dt;
    // The ledge it lay on gave way: it pours down onto whatever is below.
    if (p.ow >= 0 && g.hz?.off?.[p.ow]) { const a = p.amt; p.amt = 0; spill(g, p.x, p.y + 4, a * 0.6); }
  }
  for (const a of g.actors) {
    if (a.type !== 4 || a.dead || a.knocked || a.frozen > 0) continue;
    const dark = a.form === 'dark';
    if (dark ? a.hp >= a.maxHp : (a.blood || 0) >= DARK.max || a.act === 'darkRise') continue;
    const rx = dark ? POOL.reachDark : POOL.reach, ry = dark ? POOL.reachDarkY : POOL.reachY, feet = a.y + HALF_H;
    const near = g.pools.filter(p => p.amt > 0 && p.by < 0 && Math.abs(p.x - a.x) < rx + p.amt * 0.6 && Math.abs(p.y - feet) < ry)
      .sort((p, q) => Math.abs(p.x - a.x) + Math.abs(p.y - feet) - Math.abs(q.x - a.x) - Math.abs(q.y - feet)).slice(0, POOL.sips);
    let drunk = 0;
    for (const p of near) {
      const d = Math.min(p.amt, (dark ? POOL.rateDark : POOL.rate) * dt);
      p.amt -= d; p.by = a.id; drunk += d;
    }
    if (!drunk) continue;
    if (dark) a.hp = Math.min(a.maxHp, a.hp + drunk * POOL.heal);
    else fillBlood(g, a, drunk * POOL.meter);
  }
  g.pools = g.pools.filter(p => p.amt >= POOL.min);
}

// ---- the familiar -----------------------------------------------------------------------------

// The scythe leaves his hand (he has just turned) or forms again beside him (he is back from the dead).
export function freeScythe(g, a, back = false) {
  a.fam = { x: a.x + a.face * 10, y: a.y - 6, vx: 0, vy: 0, ang: 0, st: 'orbit', k: 'auto', f: a.face || 1, t: 0, cd: FAM.first, tgt: null, seq: -1, done: 0, last: null };
  if (back) g.fx('famReturn', { x: a.fam.x, y: a.fam.y, who: a.id });
}

// Where it floats while nothing needs cutting: over his back shoulder, bobbing.
const restSpot = (g, a) => ({ x: a.x - (a.face || 1) * 15, y: a.y - 20 + Math.sin(g.time * 3.1 + a.id) * 3 });

// Glide toward a point: `k` of the way there each step, never faster than `max` a step.
function glide(f, x, y, k, max = 99) {
  let dx = (x - f.x) * k, dy = (y - f.y) * k;
  const d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  f.vx = dx; f.vy = dy; f.x += dx; f.y += dy;
}

// Someone (or something) the scythe may cut on its own: rivals close to him, still on their feet.
const fair = (a, b) => !b.dead && !b.knocked && !(b.invincible > 0) && b.act !== 'swarm' && b.act !== 'world' && b.act !== 'requiem' && Math.hypot(b.x - a.x, b.y - a.y) < FAM.reach;
// What it goes for when no rival is near (never the barrels: it would blow him up).
const BREAKABLE = new Set(['crate', 'glass', 'candle', 'armor', 'cracked']);

function pickPrey(g, a) {
  const f = a.fam;
  const rivals = g.enemies(a).filter(b => fair(a, b));
  if (rivals.length) {
    // Spread the cuts around: the one it did not cut last time first, then the closest to him.
    rivals.sort((p, q) => (p.id === f.last) - (q.id === f.last) || Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
    return { id: rivals[0].id };
  }
  const p = g.props.filter(p => BREAKABLE.has(p.kind) && !p.held && !p.fixed && p.hp > 0 && p.hp < 900 && Math.hypot(p.x - a.x, p.y - a.y) < FAM.reach * 0.7)
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
  return p ? { prop: p.id } : null;
}

// The blow of his it strikes along with: the rival he is on, else the closest one ahead of him.
function comboTarget(g, a, mv) {
  const b = a.lastPrey != null && g.time - (a.lastPreyT ?? -9) < 1.6 ? g.actor(a.lastPrey) : null;
  if (b && !b.dead && !b.knocked && Math.hypot(b.x - a.x, b.y - a.y) < 160) return b.id;
  const reach = (mv?.range || 34) + 60;
  const c = g.enemies(a).filter(b => !b.dead && (!b.knocked || mv?.execute) && (b.x - a.x) * a.face > -16 && Math.abs(b.x - a.x) < reach && Math.abs(b.y - a.y) < 70)
    .sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
  return c ? c.id : null;
}

// Points of a strike around its target T (dir: the side T is on, seen from Nox): A where it comes
// from, S where it cuts, F where the cut carries it.
function strikePath(k, T, dir, a, p) {
  switch (k) {
    case 'cross': return { A: { x: T.x - dir * 28, y: T.y - 8 }, S: { x: T.x, y: T.y }, F: { x: T.x + dir * 32, y: T.y - 4 } };
    case 'reap': return { A: { x: T.x + dir * 6, y: T.y + 22 }, S: { x: T.x, y: T.y + 2 }, F: { x: T.x - dir * 4, y: T.y - 38 } };
    case 'chop': return { A: { x: T.x + dir * 4, y: T.y - 48 }, S: { x: T.x, y: T.y + 4 }, F: { x: T.x, y: T.y + 10 } };
    case 'hook': return { A: { x: T.x + dir * 32, y: T.y - 4 }, S: { x: T.x + dir * 10, y: T.y }, F: { x: T.x - dir * 6, y: T.y } };
    case 'spin': {
      const th = p * 16 + a.id, c = { x: T.x + Math.cos(th) * 20, y: T.y + Math.sin(th) * 14 };
      return { A: c, S: c, F: c, at: T };
    }
    case 'whirl': {
      const th = p * Math.PI * 3 + (dir < 0 ? Math.PI : 0), c = { x: a.x + Math.cos(th) * 56 * dir, y: a.y - 4 + Math.sin(th) * 30 };
      return { A: c, S: c, F: c, at: { x: a.x, y: a.y }, ring: { rx: 74, ry: 46 } };
    }
    case 'orbit': {
      const th = p * Math.PI * 4 + a.id, c = { x: a.x + Math.cos(th) * 26, y: a.y - 2 + Math.sin(th) * 20 };
      return { A: c, S: c, F: c, at: { x: a.x, y: a.y }, ring: { rx: 40, ry: 36 } };
    }
  }
  return { A: T, S: T, F: T };
}

// A velocity that survives the hitlag freeze the hit just started.
function shove(b, x, y) {
  Body.setVelocity(b.body, { x, y });
  if (b.lagPos) b.lagVel = { x, y };
}

// The scythe cuts at (cx, cy): every rival there (all around him for the wide swings), the ragdolls,
// and the things lying around. combo: one of his own blows, so the string goes on from it.
function famHit(g, a, s, cx, cy, dir, ring, combo) {
  const f = a.fam, amount = s.dmg ?? FAM.dmg, kb = s.kb || [0.4, -0.5], r = s.r || FAM.r;
  let struck = 0;
  for (const b of g.enemies(a)) {
    if (b.dead || (b.knocked && !s.down)) continue;
    const inside = ring ? Math.abs(b.x - a.x) < ring.rx && Math.abs(b.y - a.y) < ring.ry : Math.hypot(b.x - cx, (b.y - cy) * 1.2) < r;
    if (!inside) continue;
    // Driven down into a downed rival (the execution).
    if (b.knocked) { if (damage(g, b, amount, { x: b.x, y: b.y }, a.id, 'scythe', { part: 'body', kb: { x: 0, y: 3 }, force: true, solo: true })) struck++; continue; }
    if (b.iframes > 0 && b.dodge > 0 && !b.perfect) { perfectDodge(g, b); continue; }
    // Which way it throws them: on along the cut, away from him for the wide swings, toward him
    // for the hook and the tight circle.
    const away = Math.sign(b.x - a.x) || a.face, side = ring && !s.pull ? away : s.k === 'hook' || s.pull ? -away : dir;
    const dealt = damage(g, b, amount, { x: b.x - side * 4, y: b.y + (s.k === 'reap' ? 6 : 0) }, a.id, 'scythe', { kb: { x: side * kb[0], y: kb[1] }, knock: !!s.knock, launch: !!s.spike, dir: rnd(-0.9, 0.9), solo: true, familiar: () => { f.st = 'back'; f.t = 0; f.cd = FAM.cd; } });
    if (!dealt) continue;
    struck++;
    if (b.dead) continue;
    if (s.hold && !b.knocked) { b.hitstun = Math.max(b.hitstun || 0, s.hold); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); }
    if (s.crumple && !b.knocked) b.hitHeavy = true;
    if (s.pull && !b.knocked) { b.float = Math.max(b.float || 0, 0.4); shove(b, clamp((a.x + a.face * 16 - b.x) * 0.22, -4, 4), clamp((a.y - 4 - b.y) * 0.2, -3, 3)); }
    // Slammed down: the first time in a combo the rival bounces back up, the second they stay down.
    if (s.spike && !b.knocked) {
      if (b.bounced) knockdown(g, b, { velocity: { x: side * 2, y: 8 }, time: 1.4 });
      else { b.bounced = true; b.bounceArm = g.time; b.bounceBy = a.id; b.float = 0; shove(b, side * kb[0], 10 / weightOf(b)); }
    }
    a.hp = Math.min(a.maxHp, a.hp + dealt * 0.1);
    markBlood(g, b);
    bleedFor(g, a, b, DARK.bleed);
    f.last = b.id;
    if (combo) { a.lastPrey = b.id; a.lastPreyT = g.time; a.comboTimer = Math.max(a.comboTimer || 0, 0.4); }
  }
  // The Cat King's court in reach is cut too.
  strikeCourts(g, a, (x, y) => (ring ? Math.abs(x - a.x) < ring.rx && Math.abs(y - a.y) < ring.ry : Math.hypot(x - cx, y - cy) < r + 4), amount, () => dir);
  // Ragdolls are thrown about; the dead are cut up.
  const gore = g.settings.gore ?? 2;
  for (const l of [...g.limbs]) {
    if (Math.hypot(l.x - cx, l.y - cy) > r + 6 && !(ring && Math.abs(l.x - a.x) < ring.rx && Math.abs(l.y - a.y) < ring.ry)) continue;
    Body.setVelocity(l.body, { x: l.body.velocity.x + dir * 2.5, y: l.body.velocity.y - 2.5 });
    const owner = g.actor(l.actor);
    if (gore === 2 && l.ragdoll && l.part !== 'body' && owner?.dead && Math.random() < 0.4) cutCorpse(g, l);
  }
  for (const p of [...g.props]) {
    if (p.held || p.fixed) continue;
    const inside = ring ? Math.abs(p.x - a.x) < ring.rx && Math.abs(p.y - a.y) < ring.ry : Math.hypot(p.x - cx, p.y - cy) < r + Math.max(p.w || 0, p.h || 0) * 0.5;
    if (!inside) continue;
    damageProp(g, p, amount, a.id);
    if (g.props.includes(p) && !p.body.isStatic) Body.setVelocity(p.body, { x: dir * 2.5, y: -2.5 });
    struck++;
  }
  g.fx('famSlash', { x: Math.round(cx), y: Math.round(cy), k: s.k || 'auto', f: dir, ang: Math.round(f.ang * 100) / 100, who: a.id });
  g.sound(struck ? 'slash' : 'whoosh', cx);
  return struck;
}

// One step of the scythe's life.
function tickFamiliar(g, a, dt) {
  const f = a.fam;
  f.t += dt;
  f.cd = Math.max(0, f.cd - dt);
  // He is down: it hangs where it was, slowly turning, waiting for him.
  if (a.dead) {
    if (f.st !== 'lost') { f.st = 'lost'; f.t = 0; }
    glide(f, f.x, f.y + Math.sin(g.time * 1.7 + a.id) * 0.4, 1);
    f.ang += 0.02 * f.f;
    return;
  }
  if (f.st === 'lost') { freeScythe(g, a, true); return; }
  // Turning back: it flies home into his hand.
  if (a.act === 'darkFade') {
    f.st = 'return';
    glide(f, a.x + a.face * 8, a.y - 4, 0.5, 14);
    f.ang += 0.45 * f.f;
    return;
  }
  // One of his dark blows: the scythe strikes along with it.
  const plan = a.attack > 0 ? FAM_PLAN[a.attackKind] : null;
  if (plan && f.seq !== a.attackSeq) { f.seq = a.attackSeq; f.done = 0; f.tgt = comboTarget(g, a, MOVES[a.attackKind]); f.st = 'combo'; f.t = 0; }
  if (plan && f.seq === a.attackSeq) {
    const mv = MOVES[a.attackKind], p = clamp(1 - a.attack / mv.dur, 0, 1);
    const b = f.tgt != null ? g.actor(f.tgt) : null;
    const T = b && !b.dead ? { x: b.x, y: b.y } : { x: a.x + a.face * (mv.range + 16), y: a.y };
    const dir = Math.sign(T.x - a.x) || a.face;
    f.f = dir;
    const step = plan[Math.min(f.done, plan.length - 1)];
    const path = strikePath(step.k, T, dir, a, p);
    f.k = step.k;
    if (f.done < plan.length) {
      const win = Math.min(step.at, 0.3), u = clamp((p - (step.at - win)) / win, 0, 1);
      const gx = path.A.x + (path.S.x - path.A.x) * u, gy = path.A.y + (path.S.y - path.A.y) * u;
      glide(f, gx, gy, 0.55, 26);
      f.ang += (step.k === 'chop' ? 0.35 : 0.6) * dir;
      if (p >= step.at) {
        f.x = path.S.x; f.y = path.S.y;
        const at = path.at || path.S;
        famHit(g, a, step, at.x, at.y, dir, path.ring, true);
        f.done++;
        f.st = 'strike'; f.t = 0;
      }
    } else {
      glide(f, path.F.x, path.F.y, 0.4, 12);
      f.ang += 0.3 * dir;
    }
    f.cd = Math.max(f.cd, 0.35);
    return;
  }
  if (f.st === 'combo' || (f.st === 'strike' && f.t > 0.12)) { f.st = 'back'; f.t = 0; }
  // On its own: dart at someone near him and cut.
  if ((f.st === 'orbit' || f.st === 'back') && f.cd <= 0 && !(a.act === 'darkRise' || a.act === 'requiem')) {
    const prey = pickPrey(g, a);
    if (prey) { f.tgt = prey; f.st = 'hunt'; f.t = 0; f.k = 'auto'; }
    else f.cd = 0.25;
  }
  if (f.st === 'hunt') {
    const b = f.tgt?.id != null ? g.actor(f.tgt.id) : null, p = f.tgt?.prop != null ? g.props.find(p => p.id === f.tgt.prop) : null;
    const ok = b ? fair(a, b) || Math.hypot(b.x - f.x, b.y - f.y) < 30 && !b.dead && !b.knocked : !!p;
    if (!ok || f.t > FAM.give) { f.st = 'back'; f.t = 0; f.cd = FAM.cd * 0.5; return; }
    const tx = b ? b.x : p.x, ty = b ? b.y - 2 : p.y;
    const dir = Math.sign(tx - f.x) || a.face;
    f.f = dir;
    glide(f, tx - dir * 6, ty, 0.3, FAM.speed);
    f.ang += 0.55 * dir;
    if (Math.hypot(tx - f.x, ty - f.y) < 14) {
      famHit(g, a, { k: 'auto', dmg: FAM.dmg, kb: FAM.kb, hold: FAM.hold }, tx, ty, dir, null, false);
      f.st = 'strike'; f.t = 0; f.cd = FAM.cd;
    }
    return;
  }
  if (f.st === 'strike') {
    // Carried on a little by the cut.
    glide(f, f.x + f.f * 6, f.y - 2, 0.3, 4);
    f.ang += 0.5 * f.f;
    return;
  }
  // Back to his shoulder, then floating there, the blade swaying.
  const r = restSpot(g, a);
  if (f.st === 'back') {
    glide(f, r.x, r.y, 0.28, FAM.speed);
    f.ang += 0.32 * f.f;
    if (Math.hypot(r.x - f.x, r.y - f.y) < 8) { f.st = 'orbit'; f.t = 0; }
    return;
  }
  f.f = a.face || 1;
  glide(f, r.x, r.y, 0.2, 8);
  // Settle the spin back to upright (blade on top), the long way round never.
  const rest = f.f * (0.3 + Math.sin(g.time * 2 + a.id) * 0.12), turn = Math.round((f.ang - rest) / (Math.PI * 2)) * Math.PI * 2;
  f.ang += (rest + turn - f.ang) * 0.15;
}

// Every step: the pools, and each DARK NOX's scythe.
export function tickNox(g, dt) {
  tickPools(g, dt);
  for (const a of g.actors) {
    if (a.type !== 4) continue;
    if (a.form === 'dark' || (a.act === 'darkFade' && a.fam)) {
      if (!a.fam) freeScythe(g, a);
      tickFamiliar(g, a, dt);
    } else if (a.fam) a.fam = null;
  }
}

export const famSnapshot = (f, r, r2) => f && { x: r(f.x), y: r(f.y), ang: r2(f.ang), st: f.st, k: f.k, f: f.f };
