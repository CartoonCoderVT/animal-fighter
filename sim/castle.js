// "Castelo — Salão do Relógio" (sim/map.js, CASTLE): everything in the hall that can be touched.
//  - Candles on iron stands: a blow, a shot or a knife puts one out and it drops something (a heart
//    that heals a little, holy water, a dagger, an axe...). They light again a while later.
//  - The chandelier hangs from the gallery over the pit by its chain: cut the chain (shots, knives or
//    blows) and it comes down burning on whoever is under it, then a new one is lowered.
//  - Two pendulum blades swing from the gallery across the balconies, all match long.
//  - The loose stone over the spike pit shakes under whoever stands on it and falls; it is put back.
//  - Suits of armor fall apart under blows and leave their axe or spear.
//  - SECRET: the cracked wall at the left end of the floor breaks open on a roast in an alcove
//    (it heals a lot); the wall is bricked up again later with a new roast behind it.
//  - SECRET: strike the gargoyle at the right tower and its eyes burn: the door of the hidden room on
//    top of the tower slides up for a while. Inside there is a chest.
// Decor props (candles, armor, the cracked wall, the gargoyle, the chest) are static props with a hit
// hook (p.hit, called by damageProp) and a look the renderer draws them by (p.look).
import { Body, Bodies, Composite, Constraint, CAT } from './physics.js';
import { MAP } from './map.js';
import { rnd, clamp } from '../engine/const.js';
import { damage } from './combat.js';
import { addProp, removeProp, ignite } from './props.js';
import { HALF_H } from '../render/rig.js';

const CANDLE = { w: 12, h: 19, relight: 14 };
const ARMOR = { w: 20, h: 39, hp: 36, back: 30 };
const CRACKED = { hp: 60, reseal: 40 };
const DOOR = { open: 20, speed: 1.8 };
const ROAST = 50, HEART = 12;
// What a candle drops (weights): mostly small hearts and things to throw, now and then a weapon.
const DROPS = [['heart', 30], ['molotov', 12], ['blade', 14], ['axe', 8], ['spear', 6], ['katana', 5], ['grenade', 5], [null, 20]];

const surfaceProp = (g, kind, x, y, w, h, look, { sensor = true } = {}) => {
  const p = addProp(g, { kind, x, y: y - h / 2, w, h });
  Body.setStatic(p.body, true);
  p.body.isSensor = sensor;
  p.decor = true;
  p.look = look;
  return p;
};

export function installCastle(g) {
  const world = g.engine.world;
  const hz = g.hz = {
    map: 'castle', bulletBodies: [], lamps: [], grindCd: 0, off: {},
    candles: [], armors: [], pend: MAP.pendulums.map(p => ({ ...p, ang: 0, w: 0 })), hitCd: new Map(),
    crumble: { i: MAP.oneway.findIndex(p => p.kind === 'crumble'), state: 'solid', t: 0 },
    door: { open: 0, t: 0, body: null }, gargoyle: { glow: 0, prop: null },
    cracked: { prop: null, t: 0, roast: null }, chest: { prop: null, t: 0 },
    chandelier: { id: null, respawn: 0, rest: 0, lowering: false }
  };
  MAP.candles.forEach((c, i) => spawnCandle(g, i));
  MAP.armors.forEach((c, i) => spawnArmor(g, i));
  spawnCracked(g);
  // The hidden room's door: a slab of stone between the tower and its roof.
  const d = MAP.door;
  hz.door.body = Bodies.rectangle((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, d.x1 - d.x0, d.y1 - d.y0, { isStatic: true, friction: 0.8, collisionFilter: { category: CAT.world, mask: 0xffffffff }, label: 'door' });
  Composite.add(world, hz.door.body);
  g.staticBodies.push(hz.door.body);
  const gy = MAP.gargoyle;
  hz.gargoyle.prop = surfaceProp(g, 'gargoyle', gy.x, gy.y + 9, 21, 18, { glow: 0 });
  hz.gargoyle.prop.hit = (g, p, amount, owner) => openDoor(g, owner);
  spawnChest(g);
  spawnChandelier(g, false);
  for (const gl of MAP.glass) {
    const p = addProp(g, { kind: 'glass', x: gl.x, y: (gl.y0 + gl.y1) / 2, w: 8, h: gl.y1 - gl.y0 });
    p.hp = 24;
    p.fixed = true;
    Body.setStatic(p.body, true);
  }
}

// ---- candles ------------------------------------------------------------------------------
function spawnCandle(g, i) {
  const c = MAP.candles[i];
  const p = surfaceProp(g, 'candle', c.x, c.y, CANDLE.w, CANDLE.h, { lit: 1, flash: 0 });
  p.hit = hitCandle;
  g.hz.candles[i] = { id: p.id, t: 0 };
}
function hitCandle(g, p, amount, owner) {
  p.look.flash = 0.12;
  if (!p.look.lit) { g.sound('ricochet', p.x); return; }
  p.look.lit = 0;
  const slot = g.hz.candles.find(c => c.id === p.id);
  if (slot) slot.t = CANDLE.relight;
  g.fx('spark', { x: p.x, y: p.y - 6, n: 6, a: -Math.PI / 2 });
  g.fx('poof', { x: p.x, y: p.y - 8 });
  g.sound('break', p.x);
  // A Castlevania candle: something drops out of it.
  let r = rnd(0, DROPS.reduce((s, d) => s + d[1], 0)), kind = null;
  for (const [k, w] of DROPS) { if ((r -= w) < 0) { kind = k; break; } }
  if (!kind) return;
  const drop = kind === 'heart' ? addPickup(g, 'heart', p.x, p.y - 12) : addProp(g, { kind, x: p.x, y: p.y - 14, velocity: { x: rnd(-1.2, 1.2), y: -3.5 } });
  if (kind === 'blade') drop.hp = 999;
  g.text(p.x, p.y - 26, kind === 'heart' ? '♥' : kind === 'molotov' ? 'ÁGUA BENTA!' : '!', kind === 'heart' ? '#ff6a8a' : '#ffe08a');
}

// Something healing on the floor: picked up by touching it (hearts from candles, roasts).
function addPickup(g, kind, x, y) {
  const p = addProp(g, { kind, x, y, w: kind === 'roast' ? 18 : 9, h: kind === 'roast' ? 12 : 9, velocity: { x: rnd(-0.6, 0.6), y: kind === 'roast' ? 0 : -3 } });
  p.pickup = true;
  p.decor = true;
  p.life = kind === 'heart' ? 14 : null;
  p.look = {};
  return p;
}

// ---- suits of armor ------------------------------------------------------------------------
function spawnArmor(g, i) {
  const c = MAP.armors[i];
  const p = surfaceProp(g, 'armor', c.x, c.y, ARMOR.w, ARMOR.h, { weapon: c.weapon, face: c.x < 480 ? 1 : -1, max: ARMOR.hp, flash: 0 });
  p.hp = ARMOR.hp;
  p.hit = hitArmor;
  g.hz.armors[i] = { id: p.id, t: 0 };
}
function hitArmor(g, p, amount, owner) {
  p.hp -= amount;
  p.look.flash = 0.12;
  g.fx('spark', { x: p.x, y: p.y - 4, n: 4, a: -Math.PI / 2 });
  g.sound('clang', p.x);
  if (p.hp > 0) return;
  removeProp(g, p);
  const slot = g.hz.armors.find(c => c.id === p.id);
  if (slot) { slot.id = null; slot.t = ARMOR.back; }
  g.fx('debris', { x: p.x, y: p.y, n: 18, k: 'metal' });
  g.sound('thud', p.x);
  addProp(g, { kind: p.look.weapon, x: p.x, y: p.y - 6, velocity: { x: rnd(-1.5, 1.5), y: -3 } });
  g.text(p.x, p.y - 30, 'DESMONTOU!', '#d8d4e8');
}

// ---- the cracked wall and the roast behind it (secret) --------------------------------------
function spawnCracked(g) {
  const c = MAP.cracked;
  const p = surfaceProp(g, 'cracked', (c.x0 + c.x1) / 2, c.y1, c.x1 - c.x0, c.y1 - c.y0, { max: CRACKED.hp, flash: 0 }, { sensor: false });
  p.hp = CRACKED.hp;
  p.hit = hitCracked;
  g.hz.cracked.prop = p;
}
function hitCracked(g, p, amount, owner) {
  p.hp -= amount;
  p.look.flash = 0.1;
  g.fx('debris', { x: p.x + rnd(-6, 6), y: p.y + rnd(-20, 20), n: 4, k: 'stone' });
  g.sound('thud', p.x);
  if (p.hp > 0) return;
  removeProp(g, p);
  g.hz.cracked.prop = null;
  g.fx('debris', { x: p.x, y: p.y, n: 26, k: 'stone' });
  g.fx('dust', { x: p.x, y: MAP.cracked.y1, n: 14, w: 20 });
  g.shake = Math.max(g.shake, 5);
  g.sound('thud', p.x);
  const r = MAP.cracked.roast;
  g.hz.cracked.roast = addPickup(g, 'roast', r.x, r.y - 6).id;
  g.text(p.x, p.y - 50, 'UMA CARNE NA PAREDE!', '#ffcf8a');
}

// ---- the gargoyle, the hidden room's door and the chest (secret) ----------------------------
function openDoor(g, owner) {
  const hz = g.hz;
  hz.gargoyle.glow = 1;
  hz.gargoyle.prop.look.glow = 1;
  if (hz.door.t > 0) { hz.door.t = DOOR.open; return; }
  hz.door.t = DOOR.open;
  g.text(MAP.door.x0 + 30, MAP.door.y0 - 20, 'ALGO SE ABRIU...', '#ff8a7a');
  g.sound('press', MAP.door.x0);
  g.shake = Math.max(g.shake, 3);
  // The chest inside is full again if it was opened before.
  if (!hz.chest.prop || hz.chest.prop.look.open) { if (hz.chest.prop) removeProp(g, hz.chest.prop); spawnChest(g); }
}
function spawnChest(g) {
  const c = MAP.chest;
  const p = surfaceProp(g, 'chest', c.x, c.y, 24, 16, { open: 0, flash: 0 });
  p.hit = hitChest;
  g.hz.chest.prop = p;
}
function hitChest(g, p, amount, owner) {
  if (p.look.open) return;
  p.look.open = 1;
  p.look.flash = 0.2;
  g.fx('spark', { x: p.x, y: p.y - 8, n: 12, a: -Math.PI / 2 });
  g.sound('pickup', p.x);
  g.text(p.x - 20, p.y - 40, 'TESOURO!', '#ffe070');
  addPickup(g, 'roast', p.x - 14, p.y - 10);
  for (const [kind, vx] of [[['katana', 'axe', 'hammer'][Math.floor(rnd(0, 3))], -2.2], ['molotov', -1]]) addProp(g, { kind, x: p.x - 4, y: p.y - 16, velocity: { x: vx, y: -4 } });
}

// ---- the chandelier ------------------------------------------------------------------------
function spawnChandelier(g, lowering) {
  const c = MAP.chandelier;
  const p = addProp(g, { kind: 'chandelier', x: c.x, y: lowering ? c.anchorY + 10 + c.h / 2 : c.anchorY + c.chain + c.h / 2, w: c.w, h: c.h });
  p.hp = 99999;
  p.look = { lit: 1 };
  p.chain = Constraint.create({ pointA: { x: c.x, y: c.anchorY }, bodyB: p.body, pointB: { x: 0, y: -c.h / 2 }, length: lowering ? 10 : c.chain, stiffness: 0.95, damping: 0.05 });
  p.chainHp = 24;
  // Blows at it go to the chain; once it has fallen, hitting the floor breaks it in flames.
  p.hit = (g, p, amount, owner) => { if (p.chain) cutChain(g, p, amount, owner); else if (amount > 12) crashChandelier(g, p); };
  Composite.add(g.engine.world, p.chain);
  Object.assign(g.hz.chandelier, { id: p.id, lowering, respawn: 0, rest: 0 });
}
function cutChain(g, p, amount, owner) {
  p.chainHp -= amount;
  g.fx('spark', { x: MAP.chandelier.x, y: MAP.chandelier.anchorY + 30, n: 4, a: Math.PI / 2 });
  g.sound('ricochet', p.x);
  if (p.chainHp > 0) return;
  Composite.remove(g.engine.world, p.chain);
  p.chain = null;
  p.owner = owner ?? null;
  g.text(p.x, p.y - 40, 'O LUSTRE!', '#ffcf8a');
  g.sound('crack', p.x);
}
function crashChandelier(g, p) {
  if (!g.props.includes(p) || p.look.broke) return;
  p.look.broke = 1; p.look.lit = 0;
  g.fx('debris', { x: p.x, y: p.y, n: 16, k: 'metal' });
  g.fx('fireburst', { x: p.x, y: p.y, n: 18 });
  for (const dx of [-20, 0, 20]) ignite(g, p.x + dx, p.y, p.owner, 5);
  g.shake = Math.max(g.shake, 7);
  g.sound('thud', p.x);
}
// A shot crossing the chain (between the hook and the chandelier) cuts at it.
export function castleBulletHit(g, b, nx, ny) {
  const p = g.props.find(q => q.id === g.hz.chandelier.id);
  if (!p?.chain || b.kind === 'word' || b.chainHit === p.id) return;
  const c = MAP.chandelier, ax = c.x, ay = c.anchorY, bx = p.body.position.x, by = p.body.position.y - c.h / 2;
  // Closest approach between the shot's step and the chain.
  const dist = segDist(b.x, b.y, nx, ny, ax, ay, bx, by);
  if (dist > 5) return;
  b.chainHit = p.id;
  cutChain(g, p, b.damage, b.owner);
}
function segDist(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (px, py, x0, y0, x1, y1) => { const vx = x1 - x0, vy = y1 - y0, l = vx * vx + vy * vy || 1, t = clamp(((px - x0) * vx + (py - y0) * vy) / l, 0, 1); return Math.hypot(px - x0 - vx * t, py - y0 - vy * t); };
  const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (den) {
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(d(ax, ay, cx, cy, dx, dy), d(bx, by, cx, cy, dx, dy), d(cx, cy, ax, ay, bx, by), d(dx, dy, ax, ay, bx, by));
}

// ---- every step ----------------------------------------------------------------------------
export function tickCastle(g, dt) {
  const hz = g.hz;
  tickPendulums(g, dt);
  tickCrumble(g, dt);

  // Candles light again; armor is set up again once nobody stands where it goes.
  hz.candles.forEach((c, i) => {
    const p = g.props.find(q => q.id === c.id);
    if (!p) { spawnCandle(g, i); return; }
    if (p.look.flash > 0) p.look.flash = Math.max(0, p.look.flash - dt);
    if (!p.look.lit && (c.t -= dt) <= 0) { p.look.lit = 1; g.fx('spark', { x: p.x, y: p.y - 8, n: 3, a: -Math.PI / 2 }); }
  });
  hz.armors.forEach((c, i) => {
    if (c.id != null) { const p = g.props.find(q => q.id === c.id); if (p && p.look.flash > 0) p.look.flash = Math.max(0, p.look.flash - dt); return; }
    const a = MAP.armors[i];
    if ((c.t -= dt) <= 0 && !g.actors.some(o => !o.dead && Math.abs(o.x - a.x) < 20 && Math.abs(o.y + HALF_H - a.y) < 30)) { spawnArmor(g, i); g.fx('spawn', { x: a.x, y: a.y - 20, color: '#c8c4d8' }); }
  });

  // The cracked wall: bricked up again once its roast has been eaten and the alcove is empty.
  const ck = hz.cracked, cm = MAP.cracked;
  if (ck.prop && ck.prop.look.flash > 0) ck.prop.look.flash = Math.max(0, ck.prop.look.flash - dt);
  if (!ck.prop && (ck.roast == null || !g.props.some(p => p.id === ck.roast))) {
    ck.roast = null;
    ck.t += dt;
    if (ck.t > CRACKED.reseal && !g.actors.some(o => !o.dead && o.x < cm.x1 + 12 && o.y > cm.y0 - 20)) { ck.t = 0; spawnCracked(g); }
  }

  // The hidden room's door slides up while the gargoyle's spell lasts; it waits for the doorway to be clear to close.
  const dr = hz.door, dm = MAP.door, H = dm.y1 - dm.y0;
  if (dr.t > 0) dr.t -= dt;
  const blocked = g.actors.some(o => !o.dead && o.x > dm.x0 - 12 && o.x < dm.x1 + 12 && o.y > dm.y0 - 20 && o.y < dm.y1 + 10);
  const want = dr.t > 0 || (dr.open > 0 && blocked) ? 1 : 0;
  dr.open = clamp(dr.open + (want ? 1 : -1) * dt * (want ? 1.2 : 0.8), 0, 1);
  Body.setPosition(dr.body, { x: (dm.x0 + dm.x1) / 2, y: (dm.y0 + dm.y1) / 2 - dr.open * H });
  hz.gargoyle.glow = Math.max(0, hz.gargoyle.glow - dt * 0.15);
  if (hz.gargoyle.prop) hz.gargoyle.prop.look.glow = dr.t > 0 ? Math.max(0.35, hz.gargoyle.glow) : hz.gargoyle.glow;
  if (hz.chest.prop?.look.flash > 0) hz.chest.prop.look.flash = Math.max(0, hz.chest.prop.look.flash - dt);

  // Pickups: hearts and roasts heal whoever touches them.
  for (const p of [...g.props]) {
    if (!p.pickup) continue;
    if (p.life != null && (p.life -= dt) <= 0) { removeProp(g, p); continue; }
    const a = g.actors.find(o => !o.dead && !o.knocked && Math.abs(o.x - p.x) < 16 && Math.abs(o.y - p.y) < HALF_H + 10);
    if (!a) continue;
    const heal = p.kind === 'roast' ? ROAST : HEART;
    a.hp = Math.min(a.maxHp, a.hp + heal);
    g.text(a.x, a.y - 30, `+${heal}`, '#7cff9a');
    g.fx('spawn', { x: a.x, y: a.y, color: '#7cff9a' });
    g.sound('pickup', a.x);
    removeProp(g, p);
  }

  // The chandelier: lowered again after it fell; a fallen one burns out and is cleared away.
  const ch = hz.chandelier, c = g.props.find(p => p.id === ch.id);
  if (!c) { if ((ch.respawn += dt) > 18) spawnChandelier(g, true); }
  else {
    if (ch.lowering && c.chain) {
      c.chain.length = Math.min(MAP.chandelier.chain, c.chain.length + 40 * dt);
      if (c.chain.length >= MAP.chandelier.chain) ch.lowering = false;
    }
    if (!c.chain) {
      // Down on something: it breaks in flames.
      if (!c.look.broke && c.body.speed < 1.5 && c.y > MAP.chandelier.anchorY + MAP.chandelier.chain + 30) crashChandelier(g, c);
      ch.rest = c.body.speed < 0.2 ? ch.rest + dt : 0;
      if (ch.rest > 8) { removeProp(g, c); g.fx('dust', { x: c.x, y: c.y, n: 10 }); }
    }
  }
}

// The pendulums swing all match long; the blade cuts whoever it sweeps through (once per pass).
function tickPendulums(g, dt) {
  const hz = g.hz;
  for (const [k, t] of hz.hitCd) { if (t - dt <= 0) hz.hitCd.delete(k); else hz.hitCd.set(k, t - dt); }
  hz.pend.forEach((p, i) => {
    const w = (Math.PI * 2) / p.period, ph = g.time * w + p.phase * w;
    const prev = p.ang;
    p.ang = p.amp * Math.sin(ph);
    p.w = p.amp * w * Math.cos(ph);
    // A whoosh as it sweeps through the bottom.
    if (Math.sign(prev) !== Math.sign(p.ang) && prev !== 0) g.sound('swish', p.x);
    const bx = p.x + Math.sin(p.ang) * p.len, by = p.y + Math.cos(p.ang) * p.len;
    const dir = Math.sign(p.w) || 1, speed = Math.abs(p.w) * p.len / 60;
    if (speed < 1.2) return;
    for (const a of g.actors) {
      if (a.dead || a.knocked) continue;
      const key = i + ':' + a.id;
      if (hz.hitCd.has(key)) continue;
      if (Math.abs(a.x - bx) > 24 || Math.abs(a.y - 6 - by) > 18) continue;
      hz.hitCd.set(key, 0.8);
      const owner = a.lastHit != null && g.time - (a.lastHitTime ?? -9) < 5 ? a.lastHit : null;
      damage(g, a, 12, { x: bx, y: by }, owner, 'blade', { kb: { x: dir * 5.5, y: -3.5 }, environment: true, dir: dir * 0.6 });
      g.sound('slash', a.x);
    }
    for (const l of g.limbs) if (Math.abs(l.x - bx) < 20 && Math.abs(l.y - by) < 14) Body.setVelocity(l.body, { x: dir * 6, y: -3 });
    for (const pr of g.props) if (!pr.body.isStatic && !pr.held && Math.abs(pr.x - bx) < 20 && Math.abs(pr.y - by) < 14) Body.setVelocity(pr.body, { x: dir * 5, y: -2 });
  });
}

// The loose stone over the spike pit: whoever stands on it has a moment, then it falls.
function tickCrumble(g, dt) {
  const cr = g.hz.crumble;
  if (cr.i < 0) return;
  const p = MAP.oneway[cr.i], body = g.onewayBodies[cr.i];
  const on = g.actors.some(a => !a.dead && !a.knocked && a.ground && a.groundInfo?.kind === 'oneway' && a.groundInfo.index === cr.i);
  cr.t -= dt;
  if (cr.state === 'solid' && on) { cr.state = 'shake'; cr.t = 0.55; g.sound('crack', (p.x0 + p.x1) / 2); }
  else if (cr.state === 'shake' && cr.t <= 0) {
    cr.state = 'gone'; cr.t = 6;
    g.hz.off[cr.i] = true;
    body.collisionFilter.category = 0;
    g.fx('debris', { x: (p.x0 + p.x1) / 2, y: p.y + 6, n: 16, k: 'stone' });
    g.sound('thud', (p.x0 + p.x1) / 2);
    for (const a of g.actors) if (a.groundInfo?.kind === 'oneway' && a.groundInfo.index === cr.i) { a.ground = false; a.groundInfo = null; }
  } else if (cr.state === 'gone' && cr.t <= 0 && !g.actors.some(a => !a.dead && a.x > p.x0 - 14 && a.x < p.x1 + 14 && Math.abs(a.y + HALF_H - p.y) < 40)) {
    cr.state = 'solid';
    g.hz.off[cr.i] = false;
    body.collisionFilter.category = 32 << cr.i;
    g.fx('spawn', { x: (p.x0 + p.x1) / 2, y: p.y, color: '#8a80a8' });
  }
}

export function castleSnapshot(g) {
  const hz = g.hz, r = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const cr = hz.crumble;
  return {
    map: 'castle', lamps: [],
    pend: hz.pend.map(p => ({ x: p.x, y: p.y, len: p.len, ang: r2(p.ang) })),
    crumble: { state: cr.state, t: r2(Math.max(0, cr.t)) },
    door: { open: r2(hz.door.open) },
    gargoyle: { glow: r2(hz.gargoyle.glow) },
    chandelier: (() => { const c = g.props.find(p => p.id === hz.chandelier.id); return c ? { chain: !!c.chain } : null; })()
  };
}
