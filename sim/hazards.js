import { Bodies, Body, Composite, Constraint, CAT, MASK, approach, inPit } from './physics.js';
import { MAP } from './map.js';
import { rnd, dist, clamp } from '../engine/const.js';
import { damage, kill } from './combat.js';
import { addProp, removeProp, explode, damageProp, THROWABLES } from './props.js';
import { knockdown, pushActor, ragdollOf } from './ragdoll.js';
import { HALF_H } from '../render/rig.js';

export function installHazards(g) {
  const world = g.engine.world;
  const hz = g.hz = {
    conveyor: { ...MAP.conveyor, dir: 1, offset: 0 }, bulletBodies: [], lamps: [], cable: null, press: null, cargo: null,
    puddle: { ...MAP.puddle, live: 0 }, grindCd: 0
  };
  hz.onExplosion = onExplosion;

  const pr = MAP.press;
  const head = Bodies.rectangle((pr.x0 + pr.x1) / 2, pr.rest + pr.headH / 2, pr.x1 - pr.x0, pr.headH, { isStatic: true, friction: 0.6, collisionFilter: { category: CAT.world, mask: 0xffffffff }, label: 'press' });
  Composite.add(world, head);
  g.staticBodies.push(head);
  hz.press = { body: head, state: 'up', t: pr.interval, y: pr.rest, owner: null, sirenCd: 0 };
  const btn = pr.button;
  const button = Bodies.rectangle(btn.x + btn.w / 2, btn.y + btn.h / 2, btn.w, btn.h, { isStatic: true, isSensor: true });
  button.plugin.hazard = { onBullet: (g, b) => { triggerPress(g, b.owner); return true; } };
  hz.bulletBodies.push(button);

  MAP.lamps.forEach((def, i) => {
    const body = Bodies.rectangle(def.x, def.y + def.len + 5, 14, 10, { density: 0.002, frictionAir: 0.015, collisionFilter: { category: CAT.prop, mask: MASK.lamp }, label: 'lamp' });
    const c = Constraint.create({ pointA: { x: def.x, y: def.y }, bodyB: body, pointB: { x: 0, y: -5 }, length: def.len, stiffness: 0.9, damping: 0.02 });
    const lamp = { id: i, body, ax: def.x, ay: def.y, len: def.len, on: true, off: 0, under: def.y > 100 };
    body.plugin.lamp = lamp;
    body.plugin.hazard = { onBullet: (g, b) => { breakLamp(g, lamp, b); return true; } };
    Composite.add(world, [body, c]);
    hz.lamps.push(lamp);
    hz.bulletBodies.push(body);
    Body.setVelocity(body, { x: rnd(-0.6, 0.6), y: 0 });
  });

  const cd = MAP.cable, segs = [], links = [];
  for (let i = 0; i < cd.segments; i++) {
    const s = Bodies.circle(cd.x + i * 1.5, cd.y + i * cd.segLen + cd.segLen / 2, 3, { density: 0.0025, frictionAir: 0.03, friction: 0.8, collisionFilter: { category: CAT.cable, mask: MASK.cable }, label: 'cable' });
    s.plugin.cable = true;
    segs.push(s);
    links.push(Constraint.create(i === 0
      ? { pointA: { x: cd.x, y: cd.y }, bodyB: s, length: cd.segLen / 2, stiffness: 0.95, damping: 0.05 }
      : { bodyA: segs[i - 1], bodyB: s, length: cd.segLen, stiffness: 0.92, damping: 0.05 }));
  }
  Composite.add(world, [...segs, ...links]);
  hz.cable = { segs, links, sparkT: 0 };
  hz.bulletBodies.push(...segs);

  spawnCargo(g, false);
  for (const gl of MAP.glass) {
    const p = addProp(g, { kind: 'glass', x: gl.x, y: (gl.y0 + gl.y1) / 2, w: 8, h: gl.y1 - gl.y0 });
    p.hp = 24;
    p.fixed = true;
    Body.setStatic(p.body, true);
  }
}

function spawnCargo(g, lowering) {
  const c = MAP.cargo;
  const p = addProp(g, { kind: 'cargo', x: c.x, y: lowering ? c.anchorY + 10 + c.h / 2 : c.anchorY + c.chain + c.h / 2, w: c.w, h: c.h });
  p.hp = 99999;
  p.chain = Constraint.create({ pointA: { x: c.x, y: c.anchorY }, bodyB: p.body, pointB: { x: 0, y: -c.h / 2 }, length: lowering ? 10 : c.chain, stiffness: 0.95, damping: 0.05 });
  p.chainHp = 30;
  Composite.add(g.engine.world, p.chain);
  g.hz.cargo = { id: p.id, lowering, respawn: 0, rest: 0 };
}

export function triggerPress(g, owner) {
  const pr = g.hz.press;
  if (pr.state !== 'up') return false;
  pr.state = 'warn';
  pr.t = MAP.press.warn;
  pr.owner = owner ?? null;
  g.text(900, 290, 'PRENSA!', '#ff6b5a');
  return true;
}

export function breakLamp(g, lamp, b) {
  Body.setVelocity(lamp.body, { x: lamp.body.velocity.x + (b?.vx || 0) * 0.15, y: lamp.body.velocity.y + (b?.vy || 0) * 0.1 });
  if (!lamp.on) return;
  lamp.on = false;
  lamp.off = 20;
  g.fx('debris', { x: lamp.body.position.x, y: lamp.body.position.y + 4, n: 8, k: 'glass' });
  g.fx('spark', { x: lamp.body.position.x, y: lamp.body.position.y + 4, n: 8, a: Math.PI / 2 });
  g.sound('glass', lamp.body.position.x);
}

function onExplosion(g, x, y, R) {
  for (const l of g.hz.lamps) {
    const d = Math.hypot(l.body.position.x - x, l.body.position.y - y);
    if (d < R * 1.6) Body.setVelocity(l.body, { x: l.body.velocity.x + Math.sign(l.body.position.x - x) * 6 * (1 - d / (R * 1.6)), y: l.body.velocity.y - 2 });
  }
  for (const s of g.hz.cable.segs) {
    const d = Math.hypot(s.position.x - x, s.position.y - y);
    if (d < R) Body.setVelocity(s, { x: s.velocity.x + (s.position.x - x) * 0.12, y: s.velocity.y - 5 });
  }
}

export function hazardInteract(g, a) {
  const lv = MAP.conveyor.lever;
  if (Math.hypot(a.x - lv.x, a.y - lv.y) < 44) {
    g.hz.conveyor.dir *= -1;
    g.text(lv.x + 10, lv.y - 40, g.hz.conveyor.dir > 0 ? 'ESTEIRA ▶' : '◀ ESTEIRA', '#e5ca98');
    g.sound('pickup', lv.x);
    return true;
  }
  const btn = MAP.press.button;
  if (Math.hypot(a.x - btn.x, a.y - (btn.y + 20)) < 44) {
    if (triggerPress(g, a.id)) g.sound('pickup', btn.x);
    return true;
  }
  return false;
}

function segIntersect(ax, ay, bx, by, cx, cy, dx, dy, pad = 4) {
  const minDist = Math.min(segD(ax, ay, cx, cy, dx, dy), segD(bx, by, cx, cy, dx, dy), segD(cx, cy, ax, ay, bx, by), segD(dx, dy, ax, ay, bx, by));
  if (minDist < pad) return true;
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (!d) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
function segD(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

export function hazardBulletHit(g, b, nx, ny) {
  const cargo = g.props.find(p => p.id === g.hz.cargo?.id);
  if (!cargo?.chain || b.kind === 'word') return;
  const c = MAP.cargo;
  const ang = cargo.body.angle;
  const tx = cargo.body.position.x + Math.sin(ang) * (c.h / 2), ty = cargo.body.position.y - Math.cos(ang) * (c.h / 2);
  if (!segIntersect(b.x, b.y, nx, ny, c.x, c.anchorY, tx, ty)) return;
  if (b.chainHit === cargo.id) return;
  b.chainHit = cargo.id;
  cargo.chainHp -= b.damage;
  g.fx('spark', { x: (b.x + nx) / 2, y: (b.y + ny) / 2, n: 4, a: Math.atan2(-b.vy, -b.vx) });
  g.sound('ricochet', c.x);
  if (cargo.chainHp <= 0) dropCargo(g, cargo, b.owner);
}

function dropCargo(g, cargo, owner) {
  Composite.remove(g.engine.world, cargo.chain);
  cargo.chain = null;
  cargo.owner = owner ?? null;
  g.text(cargo.x, cargo.y - 40, 'SOLTOU!', '#ffcf8a');
  g.sound('crack', cargo.x);
}

function crushZone(x0, x1, y0, y1, x, y) { return x > x0 && x < x1 && y > y0 && y < y1; }

export function tickHazards(g, dt) {
  const hz = g.hz;
  hz.conveyor.offset = (hz.conveyor.offset + hz.conveyor.dir * hz.conveyor.speed * dt * 60) % 1200;
  const cv = hz.conveyor;
  for (const p of g.props) {
    if (p.held || p.body.isStatic) continue;
    // The belt drags whatever rests on it; floor friction would otherwise win.
    if (p.x > cv.x0 && p.x < cv.x1 && Math.abs(p.body.bounds.max.y - cv.y) < 3 && Math.abs(p.body.velocity.x - cv.dir * cv.speed) < 3) Body.setVelocity(p.body, { x: cv.dir * cv.speed * 1.4, y: p.body.velocity.y });
  }
  for (const l of g.limbs) if (l.x > cv.x0 && l.x < cv.x1 && Math.abs(l.body.bounds.max.y - cv.y) < 4 && Math.abs(l.body.velocity.x - cv.dir * cv.speed) < 3) Body.setVelocity(l.body, { x: cv.dir * cv.speed * 1.3, y: l.body.velocity.y });

  // Hydraulic press
  const pr = hz.press, P = MAP.press;
  pr.t -= dt;
  pr.sirenCd -= dt;
  if (pr.state === 'up' && pr.t <= 0) { pr.state = 'warn'; pr.t = P.warn; pr.owner = null; }
  else if (pr.state === 'warn') {
    if (pr.sirenCd <= 0) { g.sound('siren', 900); pr.sirenCd = 0.5; }
    if (pr.t <= 0) pr.state = 'slam';
  } else if (pr.state === 'slam') {
    pr.y += 22;
    const bottom = pr.y + P.headH;
    for (const a of g.actors) {
      if (a.dead) continue;
      const top = a.knocked ? a.y - 12 : a.body.position.y - HALF_H;
      if (a.x > P.x0 - 6 && a.x < P.x1 + 6 && bottom > top + 10 && a.y > P.rest) {
        a.hp = 0;
        kill(g, a, pr.owner ?? a.lastHit, { kind: 'crush' });
        g.text(900, 420, 'PRENSADO!', '#ff8f7a');
      }
    }
    if (bottom >= P.bottom) {
      pr.y = P.bottom - P.headH;
      pr.state = 'hold'; pr.t = 0.5;
      g.shake = Math.max(g.shake, 9);
      g.sound('press', 900);
      g.fx('dust', { x: 900, y: P.bottom, n: 16, w: 50 });
      for (const l of [...g.limbs]) if (crushZone(P.x0, P.x1, P.bottom - P.headH - 8, P.bottom + 4, l.x, l.y)) { g.fx('blood', { x: l.x, y: P.bottom - 4, dx: rnd(-3, 3), dy: -2, n: 10, s: 4 }); g.removeLimb(l); }
      for (const p of [...g.props]) if (crushZone(P.x0 - 4, P.x1 + 4, P.bottom - P.headH - 10, P.bottom + 4, p.x, p.y)) {
        if (p.kind === 'barrel' || p.kind === 'propane' || THROWABLES.includes(p.kind)) { removeProp(g, p); explode(g, p.x, p.y, pr.owner); }
        else if (p.kind === 'crate') damageProp(g, p, 999, pr.owner);
      }
    }
  } else if (pr.state === 'hold' && pr.t <= 0) pr.state = 'rise';
  else if (pr.state === 'rise') {
    pr.y -= 2.2;
    // Whoever rides the rising head is slid off before it reaches the ceiling block.
    const cx = (P.x0 + P.x1) / 2;
    for (const a of g.actors) {
      if (a.dead || a.knocked || a.x < P.x0 - 8 || a.x > P.x1 + 8) continue;
      if (Math.abs(a.body.position.y + HALF_H - pr.y) < 8) Body.setVelocity(a.body, { x: (a.x < cx ? -1 : 1) * 6, y: a.body.velocity.y });
    }
    // Loose parts and objects on the head are pushed off; whatever is still there near the top is crushed.
    for (const l of [...g.limbs]) {
      if (l.x < P.x0 - 4 || l.x > P.x1 + 4 || l.y > pr.y + 2 || l.y < pr.y - 30) continue;
      if (pr.y < P.rest + 14) { g.fx('blood', { x: l.x, y: l.y, dx: 0, dy: -2, n: 6, s: 3 }); g.removeLimb(l); continue; }
      Body.setVelocity(l.body, { x: (l.x < cx ? -1 : 1) * 5, y: l.body.velocity.y });
    }
    for (const p of g.props) if (!p.held && !p.body.isStatic && p.x > P.x0 - 4 && p.x < P.x1 + 4 && p.y < pr.y + 2 && p.y > pr.y - 40) Body.setVelocity(p.body, { x: (p.x < cx ? -1 : 1) * 5, y: p.body.velocity.y });
    if (pr.y <= P.rest) { pr.y = P.rest; pr.state = 'up'; pr.t = P.interval; }
  }
  Body.setPosition(pr.body, { x: (P.x0 + P.x1) / 2, y: pr.y + P.headH / 2 }, true);

  // Shredder pit
  hz.grindCd -= dt;
  const pit = MAP.pit;
  for (const a of g.actors) {
    if (a.dead) continue;
    if (inPit(a.x) && a.y + (a.knocked ? 0 : HALF_H) > pit.y0 + 10) {
      a.hp = 0;
      kill(g, a, a.lastHit != null && g.time - (a.lastHitTime ?? -9) < 6 ? a.lastHit : null, { kind: 'grind' });
      g.text(480, 470, 'TRITURADO!', '#ff8f7a');
    }
  }
  for (const l of [...g.limbs]) if (inPit(l.x) && l.y > pit.y0 + 12) { grindFx(g, l.x, 'blood'); g.removeLimb(l); }
  for (const p of [...g.props]) if (inPit(p.x) && p.y > pit.y0 + 10) {
    removeProp(g, p);
    if (p.kind === 'barrel' || p.kind === 'propane' || THROWABLES.includes(p.kind)) explode(g, p.x, pit.y0, p.owner, 0.8);
    else grindFx(g, p.x, p.kind === 'crate' || p.kind === 'plank' ? 'wood' : 'spark');
  }

  // Live cable and the puddle it can electrify
  const cable = hz.cable, end = cable.segs[cable.segs.length - 1];
  const ex = end.position.x, ey = end.position.y;
  const pd = hz.puddle;
  pd.live = Math.max(0, pd.live - dt);
  if (ex > pd.x0 - 8 && ex < pd.x1 + 8 && ey > pd.y - 12) pd.live = 0.4;
  for (const a of g.actors) {
    if (a.dead) continue;
    a.shockCd = Math.max(0, (a.shockCd || 0) - dt);
    const touching = Math.abs(ex - a.x) < 12 && ey > a.y - 22 && ey < a.y + HALF_H + 2;
    const wet = pd.live > 0 && a.ground && a.x > pd.x0 && a.x < pd.x1;
    if ((touching || wet) && a.shockCd <= 0) {
      a.shockCd = 0.3;
      const owner = a.lastHit != null && g.time - (a.lastHitTime ?? -9) < 5 ? a.lastHit : null;
      damage(g, a, 6, { x: ex, y: ey }, owner, 'shock', { kb: { x: Math.sign(a.x - ex || 1) * 2.5, y: -2 }, environment: true });
      a.shock = 0.55;
      g.fx('zap', { x1: ex, y1: ey, x2: a.x, y2: a.y - 4 });
      g.sound('zap', a.x);
    }
  }
  for (const l of g.limbs) if (Math.hypot(l.x - ex, l.y - ey) < 20 || (pd.live > 0 && l.x > pd.x0 && l.x < pd.x1 && l.y > pd.y - 10)) {
    Body.setAngularVelocity(l.body, rnd(-0.5, 0.5));
    l.shock = 0.3;
    l.char = Math.min(1, (l.char || 0) + dt * 0.2);
  }

  // Hanging cargo
  const cg = hz.cargo;
  const cargo = g.props.find(p => p.id === cg.id);
  if (!cargo) {
    cg.respawn += dt;
    if (cg.respawn > 18) spawnCargo(g, true);
  } else {
    if (cg.lowering && cargo.chain) {
      cargo.chain.length = Math.min(MAP.cargo.chain, cargo.chain.length + 40 * dt);
      if (cargo.chain.length >= MAP.cargo.chain) cg.lowering = false;
    }
    if (!cargo.chain) {
      cg.rest = cargo.body.speed < 0.2 ? cg.rest + dt : 0;
      if (cg.rest > 10) { removeProp(g, cargo); g.fx('dust', { x: cargo.x, y: cargo.y, n: 10 }); }
    }
  }

  for (const l of hz.lamps) {
    if (!l.on) { l.off -= dt; if (l.off <= 0) l.on = true; }
  }
}

function grindFx(g, x, kind) {
  g.fx('grind', { x, k: kind });
  if (g.hz.grindCd <= 0) { g.sound('grind', x); g.hz.grindCd = 0.3; }
}

export function hazardSnapshot(g) {
  const hz = g.hz;
  const r = v => Math.round(v * 10) / 10;
  const cargo = g.props.find(p => p.id === hz.cargo?.id);
  return {
    conveyor: { dir: hz.conveyor.dir, offset: r(hz.conveyor.offset) },
    press: { y: r(hz.press.y), state: hz.press.state, t: r(hz.press.t) },
    cable: hz.cable.segs.map(s => [r(s.position.x), r(s.position.y)]),
    lamps: hz.lamps.map(l => ({ x: r(l.body.position.x), y: r(l.body.position.y), ax: l.ax, ay: l.ay, a: r(l.body.angle * 100) / 100, on: l.on, under: l.under })),
    puddle: { live: hz.puddle.live > 0 },
    cargo: cargo ? { chain: !!cargo.chain, hp: cargo.chainHp } : null
  };
}
