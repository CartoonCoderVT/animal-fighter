// Mingau, the Cat King, and his court: five little cats (a soldier, an archer, an assassin, a mage and a
// shield-bearer) who follow him everywhere in formation and do all his fighting. The King never strikes:
// each of his moves is an order, and the one it is meant for runs, shoots, blinks or casts. Left to
// themselves they guard him: they turn to whoever threatens him and strike on their own, taking turns,
// the shield-bearer takes blows for him, and none of them ever strays far from him.
import { Body } from './physics.js';
import { COURT, RANKS, COURT_ACTS, COURT_PLAN, ROYAL, ARROW, AUTO, MOVES, KING_AIR, comboOf, SPECIALS } from './moves.js';
import { weightOf } from './fighters.js';
import { damage, perfectDodge, cutCorpse, drama, startMove, removeBullet } from './combat.js';
import { startChase, setAct, endAct } from './specials.js';
import { knockdown } from './ragdoll.js';
import { damageProp } from './props.js';
import { HALF_H } from '../render/rig.js';
import { clamp, rnd } from '../engine/const.js';

// ---- the King's orders ------------------------------------------------------------------------

// J: which order (the string, the air string, S+J, side+J, the dash), then the court carries it out.
export function kingOrder(g, a) {
  // Right after a launcher, J sends him up after the rival to go on in the air.
  const prey = a.chase && g.time < a.chase.until ? g.actor(a.chase.id) : null;
  if (prey && !prey.dead && !prey.knocked && !prey.ground) { a.chase = null; startChase(g, a, prey, KING_AIR[0]); return; }
  const list = comboOf(a), chaining = a.comboTimer > 0 && !!MOVES[a.attackKind]?.order;
  const side = a.input.left || a.input.right, tapped = g.time - (a.dirTap ?? -9) < 0.2 && !a.bot;
  let id;
  if (a.dashStrike) { a.dashStrike = false; id = 'kCharge'; }
  else if (!a.ground && !a.climbing) {
    const prev = KING_AIR.indexOf(a.attackKind);
    id = a.input.down ? 'kDrop' : KING_AIR[chaining && prev >= 0 ? (prev + 1) % KING_AIR.length : 0];
  } else if (a.input.down) id = chaining ? 'kRise' : downedNear(g, a) ? 'kMercy' : 'kRain';
  else if (side && !chaining) { a.face = a.input.right ? 1 : -1; id = 'kCharge'; }
  // (only before the volley: from there the string has to run on to the shield's launcher)
  else if (side && chaining && tapped && !['kShadow', 'kVolley', 'kZap'].includes(a.attackKind)) { a.face = a.input.right ? 1 : -1; id = 'kShadow'; }
  else {
    // The charge and the shadow dash pick the string up at the volley.
    a.combo = chaining ? (a.attackKind === 'kShadow' || a.attackKind === 'kCharge' ? 2 : (a.combo + 1) % list.length) : 0;
    id = list[a.combo];
  }
  startMove(g, a, id);
}

const downedNear = (g, a) => g.enemies(a).some(b => !b.dead && b.knocked && Math.abs(b.x - a.x) < COURT_ACTS.assassin.mercy.reach && Math.abs(b.y - a.y) < 50);

// The rival an order is for: the one the King's string is on, else the closest one he faces in reach,
// else the closest one in reach at all.
function targetFor(g, a, spec) {
  const reach = spec.reach || 120, ok = b => !b.dead && (spec.down ? b.knocked : !b.knocked) && Math.abs(b.x - a.x) < reach && Math.abs(b.y - a.y) < Math.max(70, reach * 0.5);
  const last = a.lastPrey != null && g.time - (a.lastPreyT ?? -9) < 1.6 ? g.actor(a.lastPrey) : null;
  if (last && last.team !== a.team && ok(last)) return last.id;
  const near = g.enemies(a).filter(ok).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
  return (near.find(b => (b.x - a.x) * a.face > -8) || near[0])?.id ?? null;
}

// One of the court is sent: whatever it was doing, it does this now (auto: on its own, not on an order).
function command(g, a, who, act, targets = null, auto = false) {
  const f = a.court?.find(f => f.k === who);
  if (!f || f.st === 'gone') return;
  const spec = COURT_ACTS[who][act];
  Object.assign(f, { st: 'act', act, t: 0, hit: 0, sx: f.x, sy: f.y, targets, tgt: targets ? targets[0] ?? null : targetFor(g, a, spec), dir: a.face || 1, auto });
  const T = aim(g, a, f, spec);
  f.dir = Math.sign(T.x - a.x) || a.face || 1;
  f.f = f.dir;
}

// Where the action is aimed: its rival (live), else a spot ahead of the King.
function aim(g, a, f, spec) {
  const b = f.tgt != null ? g.actor(f.tgt) : null;
  if (b && !b.dead) return { x: b.x, y: b.y, b };
  return { x: a.x + (f.dir || a.face || 1) * Math.min(spec.reach || 100, 90), y: a.y, b: null };
}

// ---- the court --------------------------------------------------------------------------------

export function makeCourt(g, a, appear = false) {
  a.court = COURT.map((k, i) => {
    const s = rankSpot(a, k);
    if (appear) g.fx('courtAppear', { x: Math.round(s.x), y: Math.round(s.y), k });
    return { k, i, x: s.x, y: s.y, vx: 0, vy: 0, f: a.face || 1, air: false, st: appear ? 'appear' : 'follow', act: 'idle', t: 0, hit: 0, tgt: null, dir: 1 };
  });
}

// A familiar's place by the King (its feet, world units), the ranks turned toward whoever threatens him.
function rankSpot(a, k) {
  const [dx, up] = RANKS[k], face = a.guardDir || a.face || 1;
  return { x: clamp(a.x + face * dx, 10, 950), y: a.y + HALF_H - up };
}

// Move toward a point: `k` of the way there each step, never faster than `max` a step.
function glide(f, x, y, k, max = 99) {
  let dx = (x - f.x) * k, dy = (y - f.y) * k;
  const d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  f.vx = dx; f.vy = dy; f.x += dx; f.y += dy;
}
const ease = u => u * u * (3 - 2 * u);

// A velocity that survives the hitlag freeze the hit just started.
function shove(b, x, y) {
  Body.setVelocity(b.body, { x, y });
  if (b.lagPos) b.lagVel = { x, y };
}

// A strike of the court's at (cx, cy): every rival within `r` (or all around a ring on the floor), the
// ragdolls and the things lying around. Never freezes the King (solo); his string goes on from it.
function courtHit(g, a, f, spec, cx, cy, dir, only = null) {
  const r = spec.r || 20;
  let struck = 0;
  for (const b of g.enemies(a)) {
    if (b.dead || (b.knocked && !spec.down) || (only && !only.includes(b.id))) continue;
    const inside = spec.ring ? Math.abs(b.x - cx) < r && Math.abs(b.y + HALF_H - cy) < 40 : Math.hypot(b.x - cx, (b.y - cy) * 1.15) < r;
    if (!inside) continue;
    if (b.knocked) {
      if (damage(g, b, spec.dmg, { x: b.x, y: b.y }, a.id, 'blade', { part: 'body', kb: { x: 0, y: 2 }, force: true, solo: true })) { struck++; if (spec.bleed) b.bleed = Math.min(6, (b.bleed || 0) + spec.bleed); }
      continue;
    }
    if (b.iframes > 0 && b.dodge > 0 && !b.perfect) { perfectDodge(g, b); continue; }
    const side = spec.ring ? Math.sign(b.x - cx) || dir : dir, kb = spec.kb || [0.5, -1];
    const kind = f.k === 'mage' ? 'magic' : f.k === 'shield' ? 'bash' : 'blade';
    const dealt = damage(g, b, spec.dmg, { x: b.x - side * 4, y: b.y }, a.id, kind, { kb: { x: side * kb[0], y: kb[1] }, knock: !!spec.knock, launch: !!(spec.launch || spec.spike), dir: rnd(-0.8, 0.8), solo: true, familiar: () => { f.hit = spec.hits.length; } });
    if (!dealt) continue;
    struck++;
    a.lastPrey = b.id; a.lastPreyT = g.time;
    if (b.dead) continue;
    if (spec.bleed) b.bleed = Math.min(6, (b.bleed || 0) + spec.bleed);
    if (spec.shock) b.shock = Math.max(b.shock || 0, spec.shock);
    if (spec.hold && !b.knocked) { b.hitstun = Math.max(b.hitstun || 0, spec.hold); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); }
    if (spec.launch && !b.knocked) {
      shove(b, side * kb[0], kb[1] / weightOf(b));
      b.stun = Math.max(b.stun, 0.7); b.float = 0.75;
      b.hitstun = Math.max(b.hitstun || 0, b.stun); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun);
      a.chase = { id: b.id, until: g.time + 1.1 };
      g.fx('focus', { x: b.x, y: b.y, p: 0.7 });
    }
    // Slammed down: the first time in a combo the rival bounces back up, the second they stay down.
    if (spec.spike && !b.knocked) {
      if (b.bounced) knockdown(g, b, { velocity: { x: side * 2, y: 8 }, time: 1.4 });
      else { b.bounced = true; b.bounceArm = g.time; b.bounceBy = a.id; b.float = 0; shove(b, side * kb[0], 10 / weightOf(b)); }
    }
    // Hits in the air keep the rival up there for the next order.
    if (!b.ground && !spec.spike && !b.knocked) b.float = Math.max(b.float || 0, 0.35);
  }
  const gore = g.settings.gore ?? 2;
  for (const l of [...g.limbs]) {
    if (Math.hypot(l.x - cx, l.y - cy) > r + 4) continue;
    Body.setVelocity(l.body, { x: l.body.velocity.x + dir * 2, y: l.body.velocity.y - 2 });
    if (gore === 2 && f.k !== 'shield' && f.k !== 'mage' && l.ragdoll && l.part !== 'body' && g.actor(l.actor)?.dead && Math.random() < 0.3) cutCorpse(g, l);
  }
  for (const p of [...g.props]) {
    if (p.held || p.fixed || Math.hypot(p.x - cx, p.y - cy) > r + Math.max(p.w || 0, p.h || 0) * 0.5) continue;
    damageProp(g, p, spec.dmg, a.id);
    if (g.props.includes(p) && !p.body.isStatic) Body.setVelocity(p.body, { x: dir * 2.5, y: -2.5 });
  }
  g.fx('courtHit', { x: Math.round(cx), y: Math.round(cy), k: f.k, act: f.act, f: dir });
  g.sound(struck ? (f.k === 'shield' ? 'punch' : f.k === 'mage' ? 'zap' : 'slash') : 'whoosh', cx);
  return struck;
}

// An arrow from the archer at (x, y) toward T, aimed over the drop of its fall.
function loose(g, a, x, y, T, spec, { speed = ARROW.speed, vy = null } = {}) {
  const dx = T.x - x, dy = T.y - 2 - y, steps = Math.max(4, Math.abs(dx) / speed);
  const vx = clamp(dx / steps, -speed, speed), v = vy ?? clamp((dy - 0.5 * ARROW.grav * steps * steps) / steps, -speed, speed);
  g.bullets.push({ id: g.nextId++, owner: a.id, team: a.team, x, y, px: x, py: y, vx, vy: v, damage: spec.dmg, life: 1.4, color: '#e8d8a8', kind: 'arrow', bounces: 1, grav: ARROW.grav, court: 1, hold: spec.hold || 0 });
  g.sound('whoosh', x);
}

// A blow struck on its own: lighter, a short hold at most, and never a launcher.
const TONED = new Map();
function toned(spec) {
  let s = TONED.get(spec);
  if (!s) TONED.set(spec, s = { ...spec, dmg: spec.dmg * AUTO.dmg, hold: Math.min(spec.hold || 0, AUTO.hold), launch: false, spike: false, knock: false, kb: spec.launch || spec.spike ? [3.5, -2.5] : spec.kb });
  return s;
}

// One step of a familiar carrying out its action.
function stepAct(g, a, f, dt) {
  const spec0 = COURT_ACTS[f.k][f.act], spec = f.auto ? toned(spec0) : spec0, p = f.t / spec.dur;
  const aimed = aim(g, a, f, spec), dir = f.dir;
  // Held on its leash, a familiar may not get all the way to its rival: then it strikes the air in front.
  const T = Math.abs(aimed.x - a.x) > AUTO.leash + 20 && ['soldier', 'assassin', 'shield'].includes(f.k) && !['charge', 'slam'].includes(f.act)
    ? { x: a.x + Math.sign(aimed.x - a.x) * AUTO.leash, y: aimed.y, b: null } : aimed;
  const due = () => f.hit < spec.hits.length && p >= spec.hits[f.hit];
  const hand = () => ({ x: f.x + f.f * 5, y: f.y - 9 });
  const home = rankSpot(a, f.k);
  switch (`${f.k}.${f.act}`) {
    // In, cut, carried on a little.
    case 'soldier.slash': case 'assassin.shadow': {
      const h = spec.hits[0], end = f.act === 'shadow' ? { x: T.x + dir * spec.run, y: T.y + HALF_H } : { x: T.x - dir * 12, y: T.y + HALF_H };
      if (p < h) glide(f, f.sx + (end.x - f.sx) * ease(p / h), f.sy + (end.y - f.sy) * ease(p / h), 1);
      if (due()) { courtHit(g, a, f, spec, T.x, T.y, dir); f.hit++; }
      break;
    }
    // Beside them, then a rising cut that throws them up (the soldier leaps with it).
    case 'soldier.rise': {
      const h = spec.hits[0];
      if (p < h) glide(f, T.x - dir * 12, T.y + HALF_H, 0.45, 12);
      else glide(f, f.x + dir, T.y + HALF_H - 34 * Math.min(1, (p - h) / 0.3), 0.5);
      if (due()) { courtHit(g, a, f, spec, T.x, T.y, dir); f.hit++; }
      break;
    }
    // Up beside them in the air, cut.
    case 'soldier.air': {
      glide(f, T.x - dir * 12, T.y + 10, 0.5, 14);
      if (due()) { courtHit(g, a, f, spec, T.x, T.y, dir); f.hit++; }
      break;
    }
    // From above them, the sword straight down.
    case 'soldier.plunge': case 'shield.drop': {
      const h = spec.hits[0];
      if (p < h * 0.5) { f.x = T.x; f.y = T.y - 50; f.vx = 0; }
      else if (p < h) glide(f, T.x, T.y + HALF_H, (p - h * 0.5) / (h * 0.5), 18);
      if (due()) { courtHit(g, a, f, spec, T.x, T.y, dir); f.hit++; if (f.k === 'shield') g.shake = Math.max(g.shake, 4); }
      break;
    }
    // Shoulder to shoulder, straight through whoever is in the way.
    case 'soldier.charge': case 'shield.charge': {
      const lane = f.k === 'shield' ? 0 : -6, x = clamp(f.sx + dir * spec.run * ease(Math.min(1, p / 0.85)), 12, 948);
      glide(f, x + lane * dir, a.y + HALF_H, 0.6, 14);
      if (due()) { courtHit(g, a, f, spec, f.x + dir * 6, f.y - 10, dir); f.hit++; }
      break;
    }
    // The finale: a leap high over the first rival and a huge cut down through them.
    case 'soldier.finale': {
      const h = spec.hits[0];
      if (p < h * 0.6) glide(f, T.x - dir * 10, T.y - 60, 0.3, 16);
      else if (p < h) glide(f, T.x, T.y + HALF_H, 0.5, 20);
      if (due()) {
        courtHit(g, a, f, spec, T.x, T.y, dir, f.targets);
        g.fx('royal', { x: Math.round(T.x), y: Math.round(T.y), f: dir });
        g.text(T.x, T.y - 40, 'PELO REI!', '#ffd76a');
        g.shake = Math.max(g.shake, 8); g.flash = Math.max(g.flash, 0.2);
        drama(g, 0.4, a);
        f.hit++;
      }
      break;
    }
    // The archer stays in rank and shoots.
    case 'archer.shot': case 'archer.volley': case 'archer.airshot': {
      if (f.act === 'airshot') glide(f, home.x, home.y - 26, 0.3, 8); else glide(f, home.x, home.y, 0.2, 6);
      f.f = Math.sign(T.x - f.x) || f.f;
      if (due()) { const h = hand(); loose(g, a, h.x, h.y, { x: T.x + (T.b ? T.b.body.velocity.x * 4 : 0), y: T.y }, spec); f.hit++; }
      break;
    }
    // Into the sky, and a moment later the arrows come down all over them.
    case 'archer.rain': {
      glide(f, home.x, home.y, 0.2, 6);
      if (due()) {
        const h = hand();
        g.bullets.push({ id: g.nextId++, owner: a.id, team: a.team, x: h.x, y: h.y, px: h.x, py: h.y, vx: f.f * 1.5, vy: -16, damage: 0, life: 0.3, color: '#e8d8a8', kind: 'arrow', bounces: 1, court: 1, sky: 1 });
        g.sound('whoosh', h.x);
        // Spread over where they stand (and where they are running to), falling from a little above them.
        const lead = T.b ? clamp(T.b.body.velocity.x * 8, -30, 30) : 0;
        f.rain = Array.from({ length: spec.arrows }, (_, i) => ({ at: spec.delay - f.t + i * 0.05, x: T.x + lead + (i / (spec.arrows - 1) - 0.5) * spec.spread * 2 + rnd(-4, 4), y: Math.max(4, T.y - spec.height) }));
        f.hit++;
      }
      break;
    }
    // Arrows arcing down onto every rival of the decree.
    case 'archer.barrage': {
      glide(f, home.x, home.y, 0.2, 6);
      if (due()) {
        const list = (f.targets || []).map(id => g.actor(id)).filter(b => b && !b.dead);
        const b = list[f.hit % Math.max(1, list.length)] || T.b;
        const h = hand();
        if (b) loose(g, a, h.x, h.y, b, spec, { speed: 10 });
        f.hit++;
      }
      break;
    }
    // Gone, and behind them; two stabs.
    case 'assassin.stab': case 'assassin.mercy': {
      if (f.t >= 0.06 && !f.blinked) {
        const x = clamp(T.x + dir * 14, 12, 948), y = T.y + HALF_H;
        g.fx('blink', { x: Math.round(f.x), y: Math.round(f.y), x2: Math.round(x), y2: Math.round(y) });
        f.x = x; f.y = y; f.vx = 0; f.blinked = true; f.f = -dir;
      }
      if (f.blinked) glide(f, T.x + dir * 12, T.y + HALF_H, 0.3, 4);
      if (due()) { courtHit(g, a, f, spec, T.x, T.y, -dir); f.hit++; }
      break;
    }
    // From one rival of the decree to the next, cutting.
    case 'assassin.dance': {
      const list = (f.targets || []).map(id => g.actor(id)).filter(b => b && !b.dead);
      const b = list[Math.min(list.length - 1, Math.floor(p * list.length))] || T.b;
      if (b && f.on !== b.id) {
        const s = Math.sign(f.x - b.x) || 1, x = clamp(b.x - s * 14, 12, 948), y = b.y + HALF_H;
        g.fx('blink', { x: Math.round(f.x), y: Math.round(f.y), x2: Math.round(x), y2: Math.round(y) });
        f.x = x; f.y = y; f.on = b.id; f.f = Math.sign(b.x - x) || 1;
      }
      if (due() && b) { courtHit(g, a, f, spec, b.x, b.y, f.f, [b.id]); f.hit++; }
      break;
    }
    // The mage stays floating in rank; the sky does the rest.
    case 'mage.zap': case 'mage.meteor': {
      glide(f, home.x, home.y, 0.2, 6);
      f.f = Math.sign(T.x - f.x) || f.f;
      if (due()) {
        if (f.act === 'zap') g.fx('bolt', { x: Math.round(T.x), y: Math.round(T.y) });
        else g.fx('meteor', { x0: Math.round(T.x - dir * 70), y0: Math.round(T.y - 130), x: Math.round(T.x), y: Math.round(T.y) });
        courtHit(g, a, f, spec, T.x, T.y, dir);
        f.hit++;
      }
      break;
    }
    case 'mage.storm': {
      glide(f, home.x, home.y - 10, 0.2, 6);
      if (due()) {
        const list = (f.targets || []).map(id => g.actor(id)).filter(b => b && !b.dead);
        for (const b of list.length ? list : T.b ? [T.b] : []) { g.fx('bolt', { x: Math.round(b.x), y: Math.round(b.y) }); courtHit(g, a, f, spec, b.x, b.y, Math.sign(b.x - a.x) || dir, [b.id]); }
        if (!list.length && !T.b) g.fx('bolt', { x: Math.round(T.x), y: Math.round(T.y) });
        f.hit++;
      }
      break;
    }
    // The shield's bash: a short charge into them that throws them up.
    case 'shield.bash': {
      const h = spec.hits[0];
      if (p < h) glide(f, f.sx + (T.x - dir * 12 - f.sx) * ease(p / h), T.y + HALF_H, 1);
      if (due()) { courtHit(g, a, f, spec, T.x, T.y, dir); f.hit++; }
      break;
    }
    // The decree's opener: a leap and the shield slammed into the floor; the ring holds them all.
    case 'shield.slam': {
      const h = spec.hits[0], fx = T.x - dir * 20, floor = T.y + HALF_H;
      if (p < h) glide(f, f.sx + (fx - f.sx) * ease(p / h), floor - Math.sin((p / h) * Math.PI) * 40, 1);
      if (due()) {
        g.fx('shieldSlam', { x: Math.round(f.x), y: Math.round(floor), r: spec.r });
        g.shake = Math.max(g.shake, 6);
        courtHit(g, a, f, spec, f.x, floor, dir, f.targets);
        f.hit++;
      }
      break;
    }
    case 'shield.guard': glide(f, home.x, home.y, 0.3, 6); break;
  }
}

// One step of the whole court.
function tickCourt(g, a, dt) {
  if (!a.court) makeCourt(g, a);
  // Each new order of the King's (however it started: J, the chase, a combo) sends its familiars.
  if (!a.dead && a.attack > 0 && a.attackSeq !== a.courtSeq && COURT_PLAN[a.attackKind]) {
    a.courtSeq = a.attackSeq;
    for (const [who, act] of COURT_PLAN[a.attackKind]) command(g, a, who, act);
  }
  if (!a.dead) courtBrain(g, a, dt);
  for (const f of a.court) {
    // The King is down: they vanish in a puff, and come back with him.
    if (a.dead) {
      if (f.st !== 'gone') { g.fx('courtPoof', { x: Math.round(f.x), y: Math.round(f.y), k: f.k }); f.st = 'gone'; f.t = 0; f.rain = null; }
      continue;
    }
    if (f.st === 'gone') { makeCourt(g, a, true); return; }
    f.t += dt;
    // A rain of arrows still on its way down.
    if (f.rain) {
      for (const r of f.rain) if (!r.done && (r.at -= dt) <= 0) {
        r.done = true;
        g.bullets.push({ id: g.nextId++, owner: a.id, team: a.team, x: r.x, y: r.y, px: r.x, py: r.y - 6, vx: 0, vy: 13, damage: COURT_ACTS.archer.rain.dmg, life: 1.6, color: '#e8d8a8', kind: 'arrow', bounces: 1, court: 1, hold: COURT_ACTS.archer.rain.hold, rainY: 1 });
      }
      if (f.rain.every(r => r.done)) f.rain = null;
    }
    if (f.st === 'appear' && f.t >= 0.4) { f.st = 'follow'; f.t = 0; }
    if (f.st === 'act') {
      stepAct(g, a, f, dt);
      if (f.t >= COURT_ACTS[f.k][f.act].dur) { f.st = 'back'; f.t = 0; f.act = 'idle'; f.blinked = false; f.on = null; f.targets = null; }
    } else {
      // In rank, or running back to it.
      const s = rankSpot(a, f.k), back = f.st === 'back';
      glide(f, s.x, s.y, back ? 0.22 : 0.16 + f.i * 0.012, back ? 9 : 8);
      if (Math.abs(f.vx) > 0.8) f.f = Math.sign(f.vx); else if (!back) f.f = a.guardDir || a.face || 1;
      if (back && Math.hypot(s.x - f.x, s.y - f.y) < 4) { f.st = 'follow'; f.t = 0; }
    }
    // The one rule: never far from the King.
    f.x = clamp(f.x, a.x - AUTO.leash, a.x + AUTO.leash);
    f.y = clamp(f.y, a.y - AUTO.leashY, a.y + HALF_H + 40);
    f.air = f.y < a.y + HALF_H - RANKS[f.k][1] - 3 || (!a.ground && f.st === 'follow');
  }
  shieldGuard(g, a);
}

// The shield-bearer on guard blocks shots coming at the King from its side.
function shieldGuard(g, a) {
  const f = a.court.find(f => f.k === 'shield');
  if (!f || (f.st !== 'follow' && !(f.st === 'act' && f.act === 'guard'))) return;
  const cx = f.x, cy = f.y - 9;
  for (const b of [...g.bullets]) {
    if (b.team === a.team || (b.set && (b.k < 1 || b.hold > 0))) continue;
    if (Math.hypot(b.x - cx, b.y - cy) > ARROW.guard || (a.x - b.x) * b.vx < 0) continue;
    removeBullet(g, b);
    g.fx('clang', { x: Math.round(cx + f.f * 4), y: Math.round(cy) });
    g.sound('ricochet', cx);
    Object.assign(f, { st: 'act', act: 'guard', t: 0, hit: 0, sx: f.x, sy: f.y, tgt: null, dir: f.f });
  }
}

// Who threatens the King most: rivals close to him, above all the one swinging at him or who just hit him.
function threatOf(g, a) {
  const hitMe = a.lastHit != null && g.time - (a.lastHitTime ?? -9) < 1.5 ? a.lastHit : null;
  let best = null, score = -1;
  for (const b of g.enemies(a)) {
    if (b.dead || b.knocked || b.invincible > 0 || ['swarm', 'world', 'requiem'].includes(b.act)) continue;
    const dx = Math.abs(b.x - a.x);
    if (dx > AUTO.guard || Math.abs(b.y - a.y) > AUTO.band) continue;
    let s = 1 - dx / AUTO.guard;
    if (b.id === hitMe) s += 1;
    if (b.attack > 0 && (a.x - b.x) * (b.face || 1) > 0 && dx < 70) s += 0.8;
    if (s > score) { score = s; best = b; }
  }
  return best;
}

// The court left to itself: the ranks turn to the threat, and one at a time they strike it. When the King
// is being hit, the assassin goes first, to cut the attacker off him.
function courtBrain(g, a, dt) {
  a.courtBeat = Math.max(0, (a.courtBeat || 0) - dt);
  for (const f of a.court) f.autoCd = Math.max(0, (f.autoCd || 0) - dt);
  const T = threatOf(g, a);
  a.guardDir = T ? Math.sign(T.x - a.x) || a.face : a.face;
  if (!T || a.courtBeat > 0 || a.act === 'decree') return;
  const d = Math.abs(T.x - a.x);
  const danger = a.hitstun > 0 || a.knocked || (a.lastHit === T.id && g.time - (a.lastHitTime ?? -9) < 0.8);
  const order = danger ? ['assassin', 'soldier', 'mage', 'shield', 'archer']
    : d < 45 && T.attack > 0 ? ['shield', 'soldier', 'assassin', 'mage', 'archer']
    : d < 110 ? ['soldier', 'archer', 'mage', 'assassin', 'shield'] : ['archer', 'mage'];
  for (const who of order) {
    const f = a.court.find(f => f.k === who), act = AUTO.acts[who];
    if (!f || f.autoCd > 0 || (f.st !== 'follow' && f.st !== 'back') || d > COURT_ACTS[who][act].reach) continue;
    command(g, a, who, act, [T.id], true);
    f.autoCd = AUTO.cd[who];
    a.courtBeat = AUTO.beat;
    if (danger && g.time - (a.rescueT ?? -9) > 5) { a.rescueT = g.time; g.text(a.x, a.y - 42, 'PROTEJAM O REI!', '#ffd76a'); }
    return;
  }
}

// The shield-bearer on guard between the King and a rival takes the rival's blow for him (now and then).
export function shieldBlocks(g, a, o) {
  if (a.type !== 0 || !a.court || a.dead || a.knocked || !o || o === a || o.team === a.team || (a.shieldAt ?? -9) > g.time) return false;
  const f = a.court.find(f => f.k === 'shield');
  if (!f || (f.st !== 'follow' && !(f.st === 'act' && f.act === 'guard'))) return false;
  const side = Math.sign(f.x - a.x);
  if (!side || side !== Math.sign(o.x - a.x) || Math.abs(f.x - a.x) > 34 || Math.abs(o.x - a.x) > 140) return false;
  a.shieldAt = g.time + AUTO.block;
  Object.assign(f, { st: 'act', act: 'guard', t: 0, hit: 0, sx: f.x, sy: f.y, tgt: null, dir: side, f: side, auto: false });
  g.fx('clang', { x: Math.round(f.x + side * 4), y: Math.round(f.y - 10), big: 1 });
  g.text(a.x, a.y - 34, 'PROTEGIDO!', '#9fd8ff');
  g.sound('clang', f.x);
  if (!o.knocked) o.stun = Math.max(o.stun || 0, 0.2);
  return true;
}

// Every step: each King's court.
export function tickKings(g, dt) {
  for (const a of g.actors) if (a.type === 0) tickCourt(g, a, dt);
}

// ---- ATAQUE REAL ------------------------------------------------------------------------------

// K: the King raises his scepter and the court strikes as one at the rivals around him.
export function royalAttack(g, a) {
  const targets = g.enemies(a).filter(b => !b.dead && !b.knocked && Math.abs(b.x - a.x) < ROYAL.reach && Math.abs(b.y - a.y) < ROYAL.band)
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, ROYAL.max).map(b => b.id);
  a.powerSeq = (a.powerSeq || 0) + 1;
  a.abilityCd = SPECIALS[0].cd;
  a.attack = 0; a.hits = null;
  if (targets.length) a.face = Math.sign(g.actor(targets[0]).x - a.x) || a.face;
  setAct(a, 'decree', SPECIALS[0].dur);
  a.decree = { targets, done: 0 };
  Body.setVelocity(a.body, { x: a.body.velocity.x * 0.2, y: a.ground ? a.body.velocity.y : Math.min(a.body.velocity.y, 0) });
  g.fx('decree', { x: a.x, y: a.y, who: a.id });
  g.text(a.x, a.y - 34, 'POR ORDEM DO REI!', '#ffd76a');
  g.flash = Math.max(g.flash, 0.15);
  drama(g, 0.5, a);
  g.sound('charge', a.x);
}

// The decree's steps, on the King's clock (he stands with the scepter up; a blow on him ends it).
export function stepDecree(g, a) {
  const d = a.decree;
  if (!d) { endAct(g, a); return null; }
  while (d.done < ROYAL.at.length && a.actT >= ROYAL.at[d.done][2]) {
    const [who, act] = ROYAL.at[d.done];
    command(g, a, who, act, d.targets.filter(id => { const b = g.actor(id); return b && !b.dead; }));
    d.done++;
  }
  if (a.actT > a.actMax) { endAct(g, a); a.decree = null; return null; }
  const v = a.body.velocity;
  return { lock: true, vx: v.x * 0.6, vy: a.ground ? v.y : Math.min(v.y, 0.5) };
}

// One of King k's court about to strike b within `within` s (for the bots' combo breaker).
export function courtStrikeSoon(k, b, within) {
  return !!k.court?.some(f => {
    if (f.st !== 'act' || (f.tgt !== b.id && !f.targets?.includes(b.id))) return false;
    const spec = COURT_ACTS[f.k][f.act], h = spec.hits[f.hit];
    return h != null && h * spec.dur - f.t > 0 && h * spec.dur - f.t < within;
  });
}

// Held in the decree: no breaking out of it with Shift.
export const decreeHolds = (o, b) => o.act === 'decree' && !!o.decree?.targets.includes(b.id);

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
export const courtSnapshot = court => !court ? null : court.map(f => ({ k: f.k, x: r1(f.x), y: r1(f.y), f: f.f, vx: r1(f.vx), air: !!f.air, st: f.st, act: f.act, t: r2(f.t) }));
