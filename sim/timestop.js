// Lola, the maid of the clock. Two things live here:
//
// The time skip: inside her strings she stops time for an instant, steps somewhere else and lets it
// run again. Nobody else sees the stop, only that she is suddenly behind them, in front of them or
// over their head (skipTo). It is an instant warp with effects on both ends, nothing more.
//
// ZA WARUDO, her super: she really stops time. The world freezes the moment she clicks her pocket
// watch (the cut-in plays over the frozen frame), a wave drains the color out of everything, and in
// the stopped world she skips from spot to spot around her rivals throwing fans of knives that stop
// dead in the air a hand's length out, then circles each of them laying a ring of knives. Back where
// she stood, she snaps the watch shut: time moves again and every knife flies at once.
// While it runs Game.step only advances Lola and her knives (stepTimeStop) and leaves everything
// else, velocities included, exactly as it was; the game clock itself does not move.
import { Body } from './physics.js';
import { MAP } from './map.js';
import { clamp } from '../engine/const.js';
import { HALF_H } from '../render/rig.js';
import { WORLD, WORLD_T } from './moves.js';

export { WORLD, WORLD_T };

const RAD = Math.PI / 180;
const ease = k => 1 - (1 - k) * (1 - k);
// Standing on a floor is not inside it: a little give at the feet and the head.
const inside = (x, y) => x < 14 || x > 946 || MAP.solids.some(s => s.kind !== 'pit' && x + 7 > s.x0 && x - 7 < s.x1 && y + HALF_H - 2 > s.y0 && y - HALF_H + 2 < s.y1);
const overPit = x => x > MAP.pit.x0 - 6 && x < MAP.pit.x1 + 6;
// Somewhere to stand at (x, y) (a fighter's center): a floor, a block or a catwalk under the feet,
// within reach units below them. edge: how far past its end a surface still counts (half a foot by
// default; 0 asks for the center itself to be over it).
export function footing(x, y, reach = 4, edge = 6) {
  const feet = y + HALF_H;
  return MAP.solids.some(s => s.kind !== 'wall' && s.kind !== 'pit' && x + edge > s.x0 && x - edge < s.x1 && s.y0 >= feet - 4 && s.y0 <= feet + reach)
    || MAP.oneway.some(p => x + edge > p.x0 && x - edge < p.x1 && p.y >= feet - 4 && p.y <= feet + reach);
}
// A point (a knife) inside a wall, a block or the floor.
const solidAt = (x, y) => x < 4 || x > 956 || MAP.solids.some(q => q.kind !== 'pit' && x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1);

function place(g, a, x, y) {
  Body.setPosition(a.body, { x, y });
  Body.setVelocity(a.body, { x: 0, y: 0 });
  a.x = x; a.y = y; a.prevFeet = y + HALF_H; a.teleported = g.seq; a.ghostClear = true; a.lagPos = null;
}

// ---- the time skip ----------------------------------------------------------------------
// Where she reappears around rival b: behind them (the far side from her), in front of them, or over
// their head. Never inside a wall or a block, never over the shredder without a catwalk under it.
// Beside a rival on their feet she wants footing too: a spot past the end of their platform falls back
// to the other side, and only if neither has any does she appear in the air there.
export function skipSpot(a, b, where) {
  const s = Math.sign(b.x - a.x) || a.face || 1;
  const tries = where === 'above' ? [[-s * 6, -34], [-s * 6, -22], [-s * 20, 0]]
    : where === 'behind' ? [[s * 19, 0], [-s * 19, 0]]
      : [[-s * 20, 0], [s * 19, 0]];
  let air = null;
  for (const [dx, dy] of tries) {
    const x = clamp(b.x + dx, 18, 942), y = b.y + dy;
    if (inside(x, y) || (overPit(x) && !footing(x, y, 120, 0))) continue;
    if (dy || !b.ground) return { x, y, ground: false };
    if (footing(x, y)) return { x, y, ground: true };
    air ||= { x, y, ground: false };
  }
  return air;
}

// Out of here and in over there in the same instant. The renderer leaves her afterimage behind and
// flashes her in at the other end.
export function skipTo(g, a, x, y, { face = null, ground = false, quiet = false, ghost = true } = {}) {
  const x0 = a.x, y0 = a.y;
  place(g, a, x, y);
  a.ground = ground;
  if (face) a.face = face;
  a.skips = (a.skips || 0) + 1;
  g.fx('timeSkip', { x: x0, y: y0, x2: x, y2: y, face: a.face, who: a.id, ghost: ghost ? 1 : 0 });
  if (!quiet) g.sound('skip', x);
}

// ---- ZA WARUDO --------------------------------------------------------------------------
// Rivals in reach, nearest first; she works on up to three of them.
function rivalsFor(g, a) {
  return g.enemies(a).filter(b => !b.dead && Math.abs(b.x - a.x) < WORLD.range && Math.abs(b.y - a.y) < 260)
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 3);
}

// Around a rival: the angle (degrees, 0 = to their right, -90 = over their head) and distance.
const around = (b, deg, R) => [b.x + Math.cos(deg * RAD) * R, b.y - 2 + Math.sin(deg * RAD) * R * 0.85];
const BLINK_ANG = [-165, -15, -120, -60, -90, 170, 10, -140, -40];
const BLINKS = [6, 4, 3];
const RING = 12;

// The whole stopped-time routine, laid out up front: the rivals cannot move while it runs.
// Times are seconds into the stopped world.
function plan(g, a, rivals) {
  const ev = [], n = rivals.length;
  const blinkEnd = 1.55, ringEnd = 2.15;
  if (!n) {
    // Nobody in reach: a show of knives in fans all around her.
    for (let i = 0; i < 6; i++) ev.push({ at: 0.1 + i * 0.22, kind: 'fan', from: 'here', deg: -150 + i * 24, n: 5 });
  } else {
    const per = BLINKS[n - 1], gap = blinkEnd / (per * n);
    let k = 0;
    for (let r = 0; r < per; r++) rivals.forEach((b, i) => {
      const deg = BLINK_ANG[(r + i * 2) % BLINK_ANG.length];
      const at = k++ * gap;
      ev.push({ at, kind: 'blink', tgt: b.id, deg, R: 54 });
      ev.push({ at: at + Math.min(0.07, gap * 0.4), kind: 'fan', tgt: b.id, n: 5 });
    });
    // Then the rings: she runs circles round each of them, laying a knife every few steps.
    const slot = (ringEnd - blinkEnd) / n;
    rivals.forEach((b, i) => {
      const t0 = blinkEnd + i * slot;
      for (let j = 0; j < RING; j++) {
        const deg = -90 + (j * 360) / RING, at = t0 + (j / RING) * slot * 0.9;
        if (j % 3 === 0) ev.push({ at, kind: 'blink', tgt: b.id, deg, R: 50, ring: true });
        ev.push({ at: at + 0.01, kind: 'ring', tgt: b.id, deg });
      }
    });
  }
  ev.push({ at: WORLD.stop - 0.2, kind: 'home' });
  return ev.sort((p, q) => p.at - q.at);
}

export function startWorld(g, a) {
  // Not while time is already stopped, nor once the match is won.
  if (g.timeStop || g.winPending !== null || g.winner !== null) return false;
  const rivals = rivalsFor(g, a);
  if (rivals[0]) a.face = Math.sign(rivals[0].x - a.x) || a.face;
  g.timeStop = {
    owner: a.id, t: 0, x: a.x, y: a.y, targets: rivals.map(b => b.id),
    home: { x: a.body.position.x, y: a.body.position.y, face: a.face, ground: a.ground },
    plan: plan(g, a, rivals), next: 0, knifeId: 1
  };
  g.knives = [];
  a.act = 'world'; a.actT = 0; a.actMax = WORLD_T + 1;
  a.attack = 0; a.hits = null; a.dodge = 0; a.dodgeKind = null; a.parry = 0;
  a.wPose = 'click'; a.wPoseAt = 0; a.wPoseT = 0; a.wArm = 0;
  Body.setVelocity(a.body, { x: 0, y: 0 });
  g.fx('worldStart', { x: a.x, y: a.y, who: a.id });
  g.sound('zawarudo', a.x);
  return true;
}

function pose(a, name, t) { a.wPose = name; a.wPoseAt = t; }

// A knife leaves her hand along ang and stops in the air dist further on.
function throwKnife(g, ts, a, x, y, ang, dist, tgt) {
  const c = Math.cos(ang), s = Math.sin(ang);
  let d = dist;
  // Never stopped inside a wall: shorten the throw until it is clear.
  while (d > 4 && solidAt(x + c * d, y + s * d)) d -= 3;
  g.knives.push({ id: ts.knifeId++, sx: x, sy: y, tx: x + c * d, ty: y + s * d, x, y, ang, tgt, born: ts.t, k: 0, owner: a.id, team: a.team });
}

function runEvent(g, ts, a, e) {
  const st = ts.t - WORLD.intro - WORLD.wave;
  const b = e.tgt != null ? g.actor(e.tgt) : null;
  if (e.kind === 'blink' && b) {
    let [x, y] = around(b, e.deg, e.R);
    for (const k of [1, 0.7, 0.45]) {
      [x, y] = around(b, e.deg, e.R * k);
      if (!inside(x, y) && y > 24 && y < MAP.floorY - HALF_H + 1) break;
      x = null;
    }
    if (x == null) { [x, y] = around(b, e.deg < -90 || e.deg > 90 ? -150 : -30, 40); if (inside(x, y)) return; }
    skipTo(g, a, clamp(x, 18, 942), y, { face: Math.sign(b.x - x) || a.face, quiet: true });
    pose(a, e.ring ? 'dash' : 'appear', st);
    g.sound('tick', x);
  } else if (e.kind === 'fan') {
    const face = a.face || 1, hx = a.x + face * 7, hy = a.y - 1;
    a.wArm = (a.wArm + 1) % 2;
    pose(a, a.wArm ? 'throwB' : 'throw', st);
    const aim = b ? Math.atan2(b.y - 2 - hy, b.x - hx) : (e.deg ?? (face > 0 ? -20 : -160)) * RAD;
    const reach = b ? Math.hypot(b.x - hx, b.y - 2 - hy) : 80;
    for (let i = 0; i < e.n; i++) {
      const off = (i - (e.n - 1) / 2) * 8 * RAD, dist = Math.min(reach - 16, 16 + ((i * 7) % 5) * 2);
      throwKnife(g, ts, a, hx, hy, aim + off, Math.max(8, dist), b ? b.id : null);
    }
    g.fx('knifeFan', { x: hx, y: hy, a: aim, who: a.id });
    g.sound('knife', hx);
  } else if (e.kind === 'ring' && b) {
    const [x, y] = around(b, e.deg, 36);
    if (solidAt(x, y)) return;
    const ang = Math.atan2(b.y - 2 - y, b.x - x);
    g.knives.push({ id: ts.knifeId++, sx: x - Math.cos(ang) * 6, sy: y - Math.sin(ang) * 6, tx: x, ty: y, x, y, ang, tgt: b.id, born: ts.t, k: 0, owner: a.id, team: a.team, ring: true });
    g.sound('knife', x);
  } else if (e.kind === 'home') {
    const h = ts.home, tgt = g.actor(ts.targets[0]);
    skipTo(g, a, h.x, h.y, { face: tgt ? Math.sign(tgt.x - h.x) || h.face : h.face, ground: h.ground, quiet: true });
    pose(a, 'home', st);
  }
}

// One step of stopped time. Returns false once time runs again.
export function stepTimeStop(g, dt) {
  const ts = g.timeStop, a = g.actor(ts.owner);
  if (!a || a.dead || a.act !== 'world') { resume(g); return false; }
  ts.t += dt;
  a.actT = ts.t;
  const st = ts.t - WORLD.intro - WORLD.wave;
  if (st >= 0) while (ts.next < ts.plan.length && ts.plan[ts.next].at <= st) runEvent(g, ts, a, ts.plan[ts.next++]);
  if (ts.t >= WORLD.intro + WORLD.wave + WORLD.stop && a.wPose !== 'snap') { pose(a, 'snap', st); g.sound('watch', a.x); }
  // The stopped clock still ticks for her.
  if (st > 0 && Math.floor(st * 2) !== Math.floor((st - dt) * 2)) g.sound('tock', a.x);
  a.wPoseT = st - (a.wPoseAt || 0);
  // Thrown knives fly out of her hand and stop where her time ends.
  for (const k of g.knives) {
    k.k = clamp((ts.t - k.born) / WORLD.hang, 0, 1);
    const e = ease(k.k);
    k.x = k.sx + (k.tx - k.sx) * e; k.y = k.sy + (k.ty - k.sy) * e;
  }
  if (g.netEvents.length > 240) g.netEvents.splice(0, g.netEvents.length - 240);
  if (ts.t >= WORLD_T) { resume(g); return false; }
  return true;
}

// Time moves again: every knife flies on along its line at once. Each barrage keeps its own count of
// knives aimed at and landed on each rival (several Lolas can have knives in the air at once).
export function resume(g) {
  const ts = g.timeStop, a = ts && g.actor(ts.owner);
  const batch = (g.knifeBatch = (g.knifeBatch || 0) + 1), aim = {};
  for (const k of g.knives || []) {
    const c = Math.cos(k.ang), s = Math.sin(k.ang);
    g.bullets.push({ id: g.nextId++, owner: k.owner, team: k.team, x: k.x, y: k.y, px: k.x, py: k.y, vx: c * WORLD.speed, vy: s * WORLD.speed, damage: WORLD.dmg, life: 1.4, color: '#e8f4ff', kind: 'knife', bounces: 9, tgt: k.tgt, batch });
    if (k.tgt != null) aim[k.tgt] = (aim[k.tgt] || 0) + 1;
  }
  g.barrages = (g.barrages || []).filter(br => g.bullets.some(b => b.batch === br.id));
  if (Object.keys(aim).length) g.barrages.push({ id: batch, aim, hits: {}, downed: {} });
  g.knives = [];
  // Nothing pressed while time stood still counts: only presses after it moves again.
  for (const b of g.actors) { b.queued = {}; b.lastInput = { ...b.input }; }
  g.timeStop = null;
  if (a && a.act === 'world') { a.act = null; a.actT = 0; a.wPose = null; }
  if (a) {
    a.attackCd = Math.max(a.attackCd || 0, 0.15);
    g.fx('worldEnd', { x: a.x, y: a.y, who: a.id });
    g.sound('timeResume', a.x);
  }
}

// A knife of the super striking rival b: once a little over half of the knives of that barrage aimed
// at them have landed, the next one knocks them down (the rest keep hitting the ragdoll). Knives
// that a roll or invincibility swallowed do not count.
const barrageOf = (g, knife) => (g.barrages || []).find(br => br.id === knife.batch);
export function knifeKnock(g, knife, b) {
  const br = barrageOf(g, knife);
  if (!br || br.downed[b.id]) return false;
  return (br.hits[b.id] || 0) + 1 >= Math.max(4, Math.ceil((br.aim[b.id] || 0) * 0.55));
}
export function knifeKnocked(g, knife, b, knock) {
  const br = barrageOf(g, knife);
  if (!br) return;
  br.hits[b.id] = (br.hits[b.id] || 0) + 1;
  if (knock) br.downed[b.id] = true;
}
