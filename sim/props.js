import { Bodies, Body, Composite, MASK, CAT, surfaceY } from './physics.js';
import { rnd, dist, clamp } from '../engine/const.js';
import { damage, armUsable, woundLimb } from './combat.js';
import { strikeCourts } from './court.js';
import { pushActor, breakJoint, pinLimb } from './ragdoll.js';
import { pose } from '../render/rig.js';
import { hazardInteract } from './hazards.js';
import { startCarry, throwCarried } from './specials.js';
import { MELEE, WEAPON_INFO, isMelee } from './weapons.js';

export const THROWABLES = ['grenade', 'molotov', 'mine', 'c4'];
export const WEAPON_PROPS = ['gun', 'extinguisher', ...MELEE];
const SHARP = ['blade', 'katana', 'axe', 'spear'];
const SIZES = {
  crate: [26, 27], barrel: [26, 34], gun: [27, 9], plank: [18, 5], blade: [22, 6], pipe: [33, 6], extinguisher: [12, 24],
  katana: [36, 6], spear: [52, 6], axe: [30, 12], hammer: [33, 14],
  propane: [15, 30], grenade: [10, 12], molotov: [9, 20], mine: [17, 7], c4: [14, 9], glass: [8, 72], shard: [4, 7], cargo: [60, 42]
};
const HP = { barrel: 38, plank: 8, crate: 32, propane: 22, glass: 24, grenade: 18, molotov: 18, mine: 18, c4: 18, extinguisher: 20, cargo: 99999 };
const DENSITY = { barrel: 0.003, crate: 0.0015, cargo: 0.012, propane: 0.0022, extinguisher: 0.003, pipe: 0.004, gun: 0.002, katana: 0.003, spear: 0.0025, axe: 0.004, hammer: 0.006 };

export function addProp(g, { x, y, kind = 'crate', w, h, velocity, owner = null, weapon, ammo, angle = 0 }) {
  const [dw, dh] = SIZES[kind] || [20, 20];
  w = w ?? dw; h = h ?? dh;
  const body = Bodies.rectangle(x, y, w, h, {
    angle, density: DENSITY[kind] ?? 0.0015, friction: kind === 'barrel' ? 0.4 : 0.55, restitution: kind === 'plank' || kind === 'shard' ? 0.25 : 0.08, frictionAir: 0.012,
    chamfer: kind === 'barrel' || kind === 'propane' ? { radius: 3 } : undefined,
    collisionFilter: { category: CAT.prop, mask: MASK.prop }, label: 'prop'
  });
  const p = { id: g.nextId++, body, kind, w, h, x, y, angle, hp: HP[kind] ?? 999, owner, throwTime: 0, held: false, weapon, ammo, life: kind === 'shard' ? 12 : kind === 'plank' ? 30 : null };
  body.plugin.prop = p;
  g.props.push(p);
  Composite.add(g.engine.world, body);
  if (velocity) Body.setVelocity(body, velocity);
  return p;
}

export function removeProp(g, p) {
  const i = g.props.indexOf(p);
  if (i < 0) return;
  if (p.chain) { Composite.remove(g.engine.world, p.chain); p.chain = null; }
  Composite.remove(g.engine.world, p.body);
  g.props.splice(i, 1);
  for (const a of g.actors) if (a.holding === p.id) a.holding = null;
}

export function damageProp(g, p, amount, owner) {
  if (!g.props.includes(p) || p.held) return;
  // Arena things with their own behaviour (the castle's candles, armor, walls...: sim/castle.js).
  if (p.hit) { p.hit(g, p, amount, owner); return; }
  if (THROWABLES.includes(p.kind)) {
    p.hp -= amount;
    if (p.hp <= 0) {
      removeProp(g, p);
      if (p.kind === 'molotov') ignite(g, p.x, p.y, owner, 7);
      else explode(g, p.x, p.y, owner);
    }
    return;
  }
  if (p.kind === 'propane') {
    p.hp -= amount;
    if (p.hp <= 0 && !p.rocket) {
      p.rocket = 1.7; p.owner = owner;
      p.body.frictionAir = 0.03;
      g.text(p.x, p.y - 30, 'VAZOU!', '#ffcf8a');
      g.sound('rocket', p.x);
    }
    return;
  }
  if (p.kind === 'extinguisher') {
    p.hp -= amount;
    if (p.hp <= 0) { removeProp(g, p); freezeBurst(g, p.x, p.y, owner, 80); }
    return;
  }
  if (['mine', 'blade', 'gun', 'shard', 'pipe', 'cargo'].includes(p.kind)) return;
  p.hp -= amount;
  if (p.hp > 0) return;
  removeProp(g, p);
  if (p.kind === 'barrel') { explode(g, p.x, p.y, owner); return; }
  if (p.kind === 'glass') {
    g.sound('glass', p.x);
    for (let i = 0; i < 7; i++) addProp(g, { kind: 'shard', x: p.x + rnd(-5, 5), y: p.y + rnd(-p.h / 2, p.h / 2), velocity: { x: rnd(-4, 4), y: rnd(-5, 1) }, angle: rnd(0, 3) }).hp = 999;
    g.fx('debris', { x: p.x, y: p.y, n: 18, k: 'glass' });
    if (p.onBreak) p.onBreak(g);
    return;
  }
  if (p.burning > 0) ignite(g, p.x, p.y, p.burnOwner, 3);
  g.sound('break', p.x);
  if (p.kind !== 'plank') for (let i = 0; i < 4; i++) addProp(g, { kind: 'plank', x: p.x + rnd(-10, 10), y: p.y + rnd(-9, 9), w: rnd(7, 16), h: 4, velocity: { x: rnd(-4, 4), y: rnd(-5, 0) }, angle: rnd(0, 3) });
  g.fx('debris', { x: p.x, y: p.y, n: 14, k: 'wood' });
}

export function surfaceAt(x, y) { return surfaceY(x, y); }

export function ignite(g, x, y, owner, life = 7) {
  g.fires.push({ id: g.nextId++, x, y: surfaceY(x, y - 10) - 5, life, owner, cd: 0 });
}

export function explode(g, x, y, owner, power = 1) {
  g.shake = 13;
  g.flash = Math.max(g.flash, 0.5);
  g.fx('explosion', { x, y, r: 110 * power });
  g.fx('decal', { x, y, k: 'scorch', s: 3 * power, layer: 'wall' });
  g.fx('decal', { x, y: surfaceY(x, y - 20), k: 'scorch', s: 2.5 * power, layer: 'floor' });
  g.sound('explosion', x);
  const R = 150 * power;
  for (const a of g.actors) {
    if (a.dead) continue;
    const d = dist(a, { x, y });
    if (d > R) continue;
    const k = 1 - d / (R * 1.15);
    const dx = (a.x - x) / (d || 1), dy = (a.y - 10 - y) / (d || 1);
    const amount = k * 68 * power;
    damage(g, a, amount, { x: a.x - dx * 6, y: a.y - dy * 6 }, owner, 'explosion', { kb: { x: dx * 13 * k, y: dy * 9 * k - 7 * k }, knock: true, overkill: amount > a.hp + 30, environment: true });
  }
  // The Cat King's court is blown about too (all of them but its own King's).
  strikeCourts(g, g.actor(owner) || null, (fx, fy) => Math.hypot(fx - x, fy - y) < R * 0.8, 40 * power, f => Math.sign(f.x - x) || 1);
  for (const p of [...g.props]) {
    if (p.held || p.fixed) continue;
    const d = dist(p, { x, y });
    if (d > 115 * power) continue;
    p.owner = owner;
    if (!WEAPON_PROPS.includes(p.kind) && p.kind !== 'cargo') damageProp(g, p, 45, owner);
    if (g.props.includes(p) && !p.body.isStatic) Body.setVelocity(p.body, { x: (p.x - x) * 0.15, y: -8 });
  }
  for (const l of g.limbs) {
    const d = dist(l, { x, y });
    if (d > R) continue;
    Body.setVelocity(l.body, { x: l.body.velocity.x + (l.x - x) * 0.16, y: l.body.velocity.y - 8 * (1 - d / R) });
    Body.setAngularVelocity(l.body, rnd(-0.4, 0.4));
    l.char = Math.min(1, (l.char || 0) + 0.4);
    if ((g.settings.gore ?? 2) === 2 && d < 75 && l.ragdoll && Math.random() < 0.5) {
      const j = l.ragdoll.joints.find(j => !j.broken && (j.child === l.part || j.parent === l.part));
      if (j) breakJoint(g, l.ragdoll, j, 'gib');
    }
  }
  g.hz?.onExplosion?.(g, x, y, R);
  ignite(g, x, y, owner, 8);
}

export function freezeBurst(g, x, y, owner, radius) {
  g.fx('frost', { x, y, n: 30, big: 1 });
  g.sound('freeze', x);
  for (const a of g.actors) {
    if (a.dead || dist(a, { x, y }) > radius) continue;
    a.freeze = (a.freeze || 0) + 1.1;
    a.burning = 0;
    pushActor(g, a, Math.sign(a.x - x) * 5, -3);
  }
  for (const f of g.fires) if (dist(f, { x, y }) < radius * 1.4) f.life = 0;
}

export function armThrowable(g, p, a) {
  if (!THROWABLES.includes(p.kind)) return;
  p.owner = a.id; p.armed = true; p.armAt = g.time + 0.25;
  if (p.kind === 'grenade') p.fuse ??= 2.1;
  if (p.kind === 'mine') p.armAt = g.time + 1;
}

const isGun = w => w === 'pistol' || w === 'shotgun';

export function extendedAttack(g, a) {
  // Melee weapons have their own movesets (combat.weaponAttack); this handles the rest.
  if (!a.holding && a.weapon !== 'extinguisher') return false;
  if (!armUsable(a)) return false;
  const held = g.props.find(p => p.id === a.holding);
  if (held && THROWABLES.includes(held.kind)) {
    if (held.kind === 'grenade' && !held.armed) {
      held.fuse ??= 2.1; held.armed = true; held.owner = a.id; held.armAt = g.time;
      g.text(a.x, a.y - 28, 'JÁ ACENDEU. LANÇA!', '#f0b781');
    }
    a.attackCd = 0.3;
    return true;
  }
  if (!held && a.weapon === 'extinguisher') {
    a.attackCd = 0.06; a.attack = 0.12; a.attackKind = 'spray';
    a.ammo--;
    const ang = a.aim ?? (a.face > 0 ? 0 : Math.PI);
    const cx = Math.cos(ang), cy = Math.sin(ang);
    if (Math.random() < 0.5) g.fx('spray', { x: a.x + cx * 14, y: a.y + 5 + cy * 14, a: ang });
    g.sound('spray', a.x);
    for (const b of g.actors) {
      if (b.dead || b.id === a.id) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 125 || (dx * cx + dy * cy) / (d || 1) < 0.82) continue;
      if (b.team !== a.team || b.burning > 0) {
        if (b.team !== a.team) b.freeze = (b.freeze || 0) + 0.045;
        b.burning = 0;
        b.lastHit = a.id; b.lastHitTime = g.time;
        pushActor(g, b, cx * 0.55, cy * 0.4 - 0.05);
      }
    }
    for (const p of g.props) if (!p.held && !p.body.isStatic && dist(a, p) < 120) Body.setVelocity(p.body, { x: p.body.velocity.x + cx * 0.4, y: p.body.velocity.y + cy * 0.4 });
    for (const f of g.fires) { const d = Math.hypot(f.x - a.x, f.y - a.y); if (d < 130 && ((f.x - a.x) * cx + (f.y - a.y) * cy) / (d || 1) > 0.7) f.life -= 0.25; }
    pushActor(g, a, -cx * 0.12, 0);
    if (a.ammo <= 0) { g.text(a.x, a.y - 26, 'VAZIO', '#cfd8e8'); dropWeapon(g, a); }
    return true;
  }
  a.attack = 0.3; a.attackSeq = (a.attackSeq || 0) + 1;
  a.attackKind = a.weapon === 'pipe' ? 'pipe' : a.weapon === 'blade' ? 'blade' : 'bash';
  a.attackCd = a.weapon === 'pipe' ? 0.52 : 0.46;
  const amount = a.weapon === 'blade' ? 23 : a.weapon === 'pipe' ? 21 : held?.kind === 'barrel' ? 26 : 19, range = 42;
  const kind = a.weapon === 'blade' ? 'blade' : a.weapon === 'pipe' ? 'pipe' : 'impact';
  for (const b of g.enemies(a)) {
    if (dist(a, b) < range && (b.x - a.x) * a.face > -5 && Math.abs(b.y - a.y) < 30) {
      damage(g, b, amount, { x: b.x - a.face * 4, y: b.y }, a.id, kind, { kb: { x: a.face * (kind === 'pipe' ? 8 : 6), y: kind === 'pipe' ? -4 : -3 } });
    }
  }
  for (const p of [...g.props]) if (p !== held && !p.fixed && dist(a, p) < range) damageProp(g, p, amount, a.id);
  for (const l of g.limbs) if (!l.attached && dist(a, l) < range && (l.x - a.x) * a.face > -5) Body.setVelocity(l.body, { x: a.face * 7, y: -4 });
  if (held && held.kind !== 'barrel') {
    held.held = false;
    damageProp(g, held, 10, a.id);
    if (g.props.includes(held)) held.held = true; else a.holding = null;
  }
  g.fx('slash', { x: a.x + a.face * 22, y: a.y + 2, face: a.face, size: 26, kind: a.attackKind, fin: 0, color: '#e6d7b8' });
  g.sound('swing', a.x);
  return true;
}

export function dropWeapon(g, a, { thrown = false, fling = false } = {}) {
  if (!a.weapon) return null;
  const kind = isGun(a.weapon) ? 'gun' : a.weapon;
  const p = addProp(g, { kind, x: a.x + a.face * 10, y: a.y + 2, weapon: a.weapon, ammo: a.ammo });
  p.hp = kind === 'extinguisher' ? 20 : 999;
  Body.setVelocity(p.body, thrown ? { x: a.face * 13, y: -3 } : fling ? { x: -a.face * 4 + rnd(-1, 1), y: -9 } : { x: a.face * 3, y: -3 });
  if (fling) Body.setAngularVelocity(p.body, rnd(-0.6, 0.6));
  if (thrown) {
    Body.setAngularVelocity(p.body, a.face * (SHARP.includes(kind) ? 0.5 : 0.35));
    p.owner = a.id; p.throwTime = g.time + 2; p.thrown = true;
  }
  a.weapon = null; a.ammo = 0;
  return p;
}

export function detonateCharges(g, a) {
  const charges = g.props.filter(p => p.kind === 'c4' && p.armed && p.owner === a.id);
  if (!charges.length) { g.text(a.x, a.y - 28, 'NENHUMA CARGA ARMADA', '#bdb0c3'); return; }
  for (const p of charges) { removeProp(g, p); explode(g, p.x, p.y, a.id); }
}

const pickable = p => !p.held && !['glass', 'shard', 'cargo', 'chandelier'].includes(p.kind) && !p.fixed && !p.decor;

export function interact(g, a) {
  if (a.dead) return;
  if (a.act === 'carry') { throwCarried(g, a); return; }
  if (a.act) return;
  if (a.holding) {
    const p = g.props.find(p => p.id === a.holding);
    a.holding = null;
    if (p) {
      p.held = false; p.owner = a.id; p.throwTime = g.time + 2.5;
      armThrowable(g, p, a);
      Body.setStatic(p.body, false);
      p.body.collisionFilter.mask = MASK.prop;
      Body.setVelocity(p.body, { x: a.input.down ? a.face : a.face * 11, y: a.input.down ? 0 : -5 });
      Body.setAngularVelocity(p.body, 0.18 * a.face);
      a.attack = 0.25; a.attackKind = 'throw'; a.attackSeq = (a.attackSeq || 0) + 1;
      g.sound('swing', a.x);
    }
    return;
  }
  if (hazardInteract(g, a)) return;
  if (!armUsable(a)) { g.text(a.x, a.y - 28, 'SEM MÃO PARA PEGAR', '#d7b5ba'); return; }
  // The Cat King does not carry weapons (his court fights for him), nor DARK NOX (his scythe does).
  const noArms = a.type === 0 || (a.type === 4 && a.form === 'dark');
  const near = g.props.filter(p => pickable(p) && dist(a, p) < 38 && !(noArms && WEAPON_PROPS.includes(p.kind))).sort((b, c) => dist(a, b) - dist(a, c))[0];
  // Downed fighters and corpses can be picked up and thrown.
  const body = g.limbs.filter(l => l.ragdoll && (l.part === 'body' || l.part === 'head') && dist(a, l) < 32 && !g.actors.some(o => o.holdingLimb === l.id))
    .filter(l => { const o = g.actor(l.actor); return !l.attached || (o && o.knocked && o.id !== a.id); })
    .sort((b, c) => dist(a, b) - dist(a, c))[0];
  if (body && (!near || dist(a, body) < dist(a, near))) { startCarry(g, a, body); return; }
  if (near) {
    if (WEAPON_PROPS.includes(near.kind)) {
      if (a.weapon) dropWeapon(g, a);
      a.weapon = near.kind === 'gun' ? near.weapon || (Math.random() < 0.5 ? 'pistol' : 'shotgun') : near.kind;
      a.ammo = isMelee(near.kind) ? 999 : near.ammo || (a.weapon === 'shotgun' ? 16 : a.weapon === 'extinguisher' ? 120 : 24);
      removeProp(g, near);
      const label = WEAPON_INFO[a.weapon]?.name || { extinguisher: 'EXTINTOR', shotgun: 'ESCOPETA', pistol: 'PISTOLA' }[a.weapon];
      g.text(a.x, a.y - 28, isGun(a.weapon) ? `${label} +${a.ammo}` : label, '#e8c590');
      g.sound('pickup', a.x);
    } else {
      a.holding = near.id; near.held = true;
      Body.setStatic(near.body, true);
      near.body.collisionFilter.mask = 0;
      g.sound('pickup', a.x);
    }
    return;
  }
  if (a.embedded.length) {
    const e = a.embedded.pop();
    damage(g, a, 4, { x: a.x, y: a.y }, a.id, 'bleed', { force: true, part: e.part, kb: { x: 0, y: 0 } });
    a.bleed = Math.min(6, a.bleed + 1.5);
    if (e.kind === 'blade' && !a.weapon && !(a.type === 0 || (a.type === 4 && a.form === 'dark'))) { a.weapon = 'blade'; a.ammo = 999; }
    g.text(a.x, a.y - 28, 'ARRANCOU!', '#e99598');
    g.fx('blood', { x: a.x, y: a.y, dx: a.face * 2, dy: -2, n: 10, s: 3 });
    g.sound('squish', a.x);
    return;
  }
  if (a.weapon && !isGun(a.weapon)) {
    const kind = a.weapon;
    dropWeapon(g, a, { thrown: true });
    a.attack = 0.25; a.attackKind = 'throw'; a.attackSeq = (a.attackSeq || 0) + 1;
    g.text(a.x, a.y - 28, SHARP.includes(kind) ? 'LÁ VAI!' : 'TOMA!', '#e8c590');
    g.sound('swing', a.x);
    return;
  }
  if (a.weapon) {
    dropWeapon(g, a, { thrown: true });
    a.attack = 0.25; a.attackKind = 'throw';
    g.sound('swing', a.x);
    return;
  }
  g.text(a.x, a.y - 28, 'CHEGUE PERTO DE UM OBJETO', '#c7bccb');
}

export function updateHolding(g, a) {
  if (a.holding) {
    const p = g.props.find(p => p.id === a.holding);
    if (p) {
      Body.setPosition(p.body, { x: a.x + a.face * 3, y: a.y - 22 - p.h * 0.4 });
      Body.setAngle(p.body, Math.sin(g.time * 4) * 0.05);
      p.x = p.body.position.x; p.y = p.body.position.y;
    } else a.holding = null;
  }
}

export function tickProps(g, dt) {
  for (const p of [...g.props]) {
    if (p.life !== null && p.life !== undefined) { p.life -= dt; if (p.life <= 0) { removeProp(g, p); continue; } }
    if (p.fuse !== undefined) {
      p.fuse -= dt;
      if (p.fuse <= 0) { removeProp(g, p); explode(g, p.x, p.y, p.owner); continue; }
    }
    if (p.kind === 'mine' && p.armed && g.time > p.armAt) {
      const owner = g.actor(p.owner);
      if (g.actors.some(a => !a.dead && a.id !== p.owner && a.team !== owner?.team && dist(a, p) < 40)) { removeProp(g, p); explode(g, p.x, p.y, p.owner); continue; }
    }
    if (p.rocket > 0) {
      p.rocket -= dt;
      const ang = p.body.angle - Math.PI / 2;
      Body.applyForce(p.body, p.body.position, { x: Math.cos(ang) * 0.002, y: Math.sin(ang) * 0.002 });
      Body.setAngularVelocity(p.body, p.body.angularVelocity + rnd(-0.04, 0.04));
      if (Math.random() < 0.7) g.fx('smoke', { x: p.x - Math.cos(ang) * 14, y: p.y - Math.sin(ang) * 14, n: 1, fire: 1 });
      if (p.rocket <= 0) { removeProp(g, p); explode(g, p.x, p.y, p.owner, 1.2); continue; }
    }
    if (['crate', 'plank', 'barrel', 'propane'].includes(p.kind)) {
      for (const f of g.fires) if (dist(p, f) < 49) { p.burning = 4; p.burnOwner = f.owner; break; }
      if (p.burning > 0) {
        p.burning -= dt;
        p.burnCd = (p.burnCd || 0) - dt;
        if (p.burnCd <= 0) {
          p.burnCd = 0.45;
          damageProp(g, p, p.kind === 'barrel' ? 5 : p.kind === 'propane' ? 6 : 4, p.burnOwner);
          for (const o of g.props) if (o !== p && ['crate', 'plank', 'barrel', 'propane'].includes(o.kind) && dist(p, o) < 37) { o.burning = 3; o.burnOwner = p.burnOwner; }
        }
      }
    }
  }
  for (const f of g.fires) {
    f.life -= dt;
    f.cd -= dt;
    if (f.cd <= 0) {
      f.cd = 0.45;
      for (const a of g.actors) if (!a.dead && Math.abs(a.x - f.x) < 38 && Math.abs(a.y - f.y) < 55 && !(a.dodge > 0)) { a.burning = 3.5; a.burnOwner = f.owner; }
    }
  }
  g.fires = g.fires.filter(f => f.life > 0);
  for (const a of g.actors) {
    if (a.dead) { a.burning = 0; continue; }
    if (a.burning > 0) {
      a.burning -= dt;
      a.burnCd = (a.burnCd || 0) - dt;
      if (a.burnCd <= 0) { a.burnCd = 0.55; damage(g, a, 3, { x: a.x, y: a.y + 10 }, a.burnOwner ?? a.id, 'fire', { kb: { x: 0, y: 0 }, force: true, environment: true }); }
    }
  }
  for (const l of g.limbs) if (l.char < 1 && g.fires.some(f => Math.abs(f.x - l.x) < 34 && Math.abs(f.y - l.y) < 30)) l.char = Math.min(1, (l.char || 0) + dt * 0.25);
  if (g.props.length > 90) g.props.filter(p => p.kind === 'plank').slice(0, g.props.length - 90).forEach(p => removeProp(g, p));
}

export function propCollision(g, b1, b2, pair) {
  for (const [body, other] of [[b1, b2], [b2, b1]]) {
    const p = body.plugin.prop;
    if (!p || p.held) continue;
    const a = other.plugin.actor, prop2 = other.plugin.prop, limb = other.plugin.limb;
    // The castle's decor is not solid: something thrown into it breaks it, nothing else happens.
    if (p.decor) { if (prop2 && !prop2.decor && body.isSensor && prop2.body.speed > 4) damageProp(g, p, 12, prop2.owner); continue; }
    if (other.isSensor) continue;
    if (p.kind === 'glass') {
      if (a && a.body.speed > 4.5) damageProp(g, p, 60, a.id);
      if (prop2 && prop2.body.speed > 4) damageProp(g, p, 50, prop2.owner);
      if (limb && limb.body.speed > 5) damageProp(g, p, 50, limb.owner);
      continue;
    }
    if (p.kind === 'molotov' && p.armed && g.time > (p.armAt || 0) && body.speed > 1.5) {
      removeProp(g, p);
      for (let i = -1; i <= 1; i++) ignite(g, p.x + i * 24, p.y, p.owner, 8);
      g.fx('debris', { x: p.x, y: p.y, n: 10, k: 'glass' });
      g.fx('fireburst', { x: p.x, y: p.y, n: 20 });
      g.sound('glass', p.x);
      continue;
    }
    if (p.kind === 'c4' && p.armed && g.time > (p.armAt || 0) && other.isStatic) { Body.setStatic(body, true); p.stuck = true; }
    if (p.rocket > 0 && body.speed > 6 && (other.isStatic || a || prop2)) { removeProp(g, p); explode(g, p.x, p.y, p.owner, 1.2); continue; }
    if (a && !a.dead) {
      const thrown = p.throwTime > g.time && p.owner !== a.id;
      const owner = g.actor(p.owner);
      const rel = Math.hypot(body.velocity.x - a.body.velocity.x, body.velocity.y - a.body.velocity.y);
      if (thrown && owner && owner.team !== a.team && rel > 3.7) {
        if (SHARP.includes(p.kind) && p.thrown) {
          const bone = pose(a, g.time).filter(b => !a.severed.includes(b.name)).sort((x, y) => Math.hypot(a.x + x.x * a.face - p.x, a.y + x.y - p.y) - Math.hypot(a.x + y.x * a.face - p.x, a.y + y.y - p.y))[0];
          damage(g, a, 26, { x: p.x, y: p.y }, owner.id, 'thrown', { part: bone?.name, kb: { x: body.velocity.x * 0.4, y: -2 } });
          if (bone && !a.dead) a.embedded.push({ part: bone.name, kind: 'blade', a: Math.atan2(body.velocity.y, body.velocity.x) * a.face, u: 0, v: 0 });
          else if (a.dead && bone) embedInCorpse(g, a, bone.name, p);
          removeProp(g, p);
          g.sound('slash', a.x);
          continue;
        }
        const heavy = p.kind === 'pipe' || p.kind === 'gun' || p.kind === 'extinguisher';
        damage(g, a, Math.min(35, rel * (heavy ? 3 : 2.7)), { x: p.x, y: p.y }, owner.id, 'impact', { kb: { x: body.velocity.x * 0.45, y: -2.5 } });
        p.throwTime = 0;
        continue;
      }
      // Heavy things falling on someone crush them.
      if (body.mass > 2 && body.velocity.y > 5 && p.y < a.y - 12) {
        const amount = (body.velocity.y - 4) * body.mass * (p.kind === 'cargo' ? 1 : 0.9);
        if (amount > 6) damage(g, a, amount, { x: a.x, y: a.y - 12 }, p.owner ?? a.lastHit ?? a.id, 'crush', { kb: { x: 0, y: 2 }, knock: amount > 22, overkill: amount > 60, environment: true, part: 'head' });
      }
      if (!p.armed && a.body.speed > 2) { p.owner = a.id; p.throwTime = Math.max(p.throwTime, g.time + 0.8); }
    }
    if (limb && SHARP.includes(p.kind) && p.thrown && body.speed > 6 && (g.settings.gore ?? 2) === 2) {
      woundLimb(g, limb, { x: p.x, y: p.y }, 'cut', 2);
      if (limb.ragdoll) { const j = limb.ragdoll.joints.find(j => !j.broken && j.child === limb.part); if (j) breakJoint(g, limb.ragdoll, j, 'cut'); }
    }
    if (body.speed > 7 && p.kind !== 'gun' && (other.isStatic || prop2)) damageProp(g, p, body.speed * 1.8, p.owner);
  }
  const limb = b1.plugin.limb || b2.plugin.limb, otherBody = b1.plugin.limb ? b2 : b1;
  if (limb) {
    const a = otherBody.plugin.actor;
    if (a && limb.throwTime > g.time && limb.owner !== a.id && limb.body.speed > 5) {
      damage(g, a, Math.min(18, limb.body.speed * 1.4), { x: limb.x, y: limb.y }, limb.owner, 'impact', { kb: { x: limb.body.velocity.x * 0.4, y: -2 } });
      limb.throwTime = 0;
    }
    // Ragdolls slammed into the level take impact damage.
    if (otherBody.isStatic && !otherBody.isSensor && limb.attached && limb.body.speed > 9) {
      const owner = g.actor(limb.actor);
      if (owner && !owner.dead && owner.knocked && g.time - (owner.slamAt || 0) > 0.25) {
        owner.slamAt = g.time;
        damage(g, owner, (limb.body.speed - 8) * 2.2, { x: limb.x, y: limb.y }, owner.lastHit ?? owner.id, 'impact', { part: limb.part, kb: { x: 0, y: 0 }, force: true, environment: true });
        g.sound('thud', limb.x);
        g.fx('dust', { x: limb.x, y: limb.y, n: 3 });
      }
    }
  }
}

function embedInCorpse(g, a, part, p) {
  const l = g.limbs.find(l => l.actor === a.id && l.part === part && l.ragdoll?.detached);
  if (!l) return;
  l.embedded = (l.embedded || []).concat([{ kind: 'blade', a: Math.atan2(p.body.velocity.y, p.body.velocity.x) }]);
  if (l.x < 40 || l.x > 920) pinLimb(g, l, { x: l.x < 40 ? 4 : 956, y: l.y });
}
