// Specials (K) and the moves everyone shares: aerial stomp and carrying a downed fighter.
// A running special lives in a.act; stepSpecial runs it each step and may lock movement.
import { Body, Composite } from './physics.js';
import { SPECIALS, JUMA_AIR, LOLA_AIR, KING_AIR, DARK, noxAir } from './moves.js';
import { freeScythe } from './nox.js';
import { royalAttack, stepDecree } from './court.js';
import { FIGHTERS } from './fighters.js';
import { damage, startMove, landPlunge, markOf, drama } from './combat.js';
import { MOVES } from './moves.js';
import { knockdown, pushActor, ragdollOf, breakJoint } from './ragdoll.js';
import { damageProp } from './props.js';
import { breakLamp } from './hazards.js';
import { rnd, clamp } from '../engine/const.js';
import { HALF_H } from '../render/rig.js';
import { MAP } from './map.js';
import { startWorld, skipSpot, skipTo, skipKnives } from './timestop.js';

const LOCK = { lock: true };

export function setAct(a, act, max) {
  a.act = act;
  a.actT = 0;
  a.actMax = max;
}

export function endAct(g, a) {
  if (a.act === 'shake' || a.act === 'carry') {
    if (a.holdJoint) Composite.remove(g.engine.world, a.holdJoint);
    a.holdJoint = null;
    a.holdingLimb = null;
  }
  a.act = null;
  a.actT = 0;
  a.rideOn = null;
}

export function startSpecial(g, a) {
  // The Cat King's ATAQUE REAL (sim/court.js).
  if (a.type === 0) { royalAttack(g, a); return; }
  if (a.type === 3) { jumaSpecial(g, a); return; }
  if (a.type === 4) { noxSpecial(g, a); return; }
  // Lola's ZA WARUDO (sim/timestop.js); nothing happens while time is already stopped.
  if (a.type === 2) { if (startWorld(g, a)) { a.powerSeq = (a.powerSeq || 0) + 1; a.abilityCd = SPECIALS[2].cd; } return; }
  const sp = SPECIALS[a.type];
  const v = a.body.velocity;
  a.powerSeq = (a.powerSeq || 0) + 1;
  a.abilityCd = sp.cd;
  a.attack = 0;
  a.hits = null;
  g.fx('focus', { x: a.x, y: a.y, p: 0.6 });
  if (sp.id === 'pounce') {
    setAct(a, 'pounce', sp.dur);
    Body.setVelocity(a.body, { x: a.face * 9.5, y: a.ground ? -5.5 : Math.min(v.y, -2.5) });
    a.ground = false;
    g.text(a.x, a.y - 30, 'BOTE!', '#ffb763');
    g.sound('swing', a.x);
  } else if (sp.id === 'ball') {
    setAct(a, 'ball', sp.dur);
    a.ballV = a.face * 8.5;
    a.ballHit = {};
    g.text(a.x, a.y - 30, 'BOLA DE HAMSTER!', '#cec7dc');
    g.fx('ring', { x: a.x, y: a.y + 4, size: 30, color: '#d8f0ff' });
    g.sound('pickup', a.x);
  } else if (sp.id === 'beam') {
    // Close to a rival carrying three blood marks, K is the requiem instead of the beam.
    const prey = g.enemies(a).find(b => !b.dead && !b.knocked && markOf(g, b) >= 3 && Math.abs(b.x - a.x) < 80 && Math.abs(b.y - a.y) < 50);
    if (prey) { startRequiem(g, a, prey); return; }
    setAct(a, 'beam', sp.dur);
    a.beamFired = false;
    a.beamAir = !a.ground;
    Body.setVelocity(a.body, { x: v.x * 0.3, y: a.ground ? v.y : Math.min(v.y, 0) });
    g.sound('charge', a.x);
  }
}

// Nox's K. With his blood meter full: DARK NOX. As DARK NOX: the blood beam (by a rival carrying three
// blood marks, the requiem). Otherwise there is nothing to drink from yet.
function noxSpecial(g, a) {
  const v = a.body.velocity;
  if (a.form === 'dark') {
    a.powerSeq = (a.powerSeq || 0) + 1;
    a.abilityCd = DARK.beamCd;
    a.attack = 0; a.hits = null;
    const prey = g.enemies(a).find(b => !b.dead && !b.knocked && markOf(g, b) >= 3 && Math.abs(b.x - a.x) < 120 && Math.abs(b.y - a.y) < 60);
    if (prey) { startRequiem(g, a, prey); return; }
    setAct(a, 'beam', SPECIALS[4].dur);
    a.beamFired = false;
    a.beamAir = !a.ground;
    Body.setVelocity(a.body, { x: v.x * 0.3, y: a.ground ? v.y : Math.min(v.y, 0) });
    g.sound('charge', a.x);
    return;
  }
  if ((a.blood || 0) < DARK.max) {
    if (!(a.thirstT > g.time)) { a.thirstT = g.time + 1.2; g.text(a.x, a.y - 30, 'SEDE...', '#a83048'); }
    return;
  }
  a.powerSeq = (a.powerSeq || 0) + 1;
  a.attack = 0; a.hits = null;
  setAct(a, 'darkRise', DARK.rise);
  Body.setVelocity(a.body, { x: v.x * 0.2, y: a.ground ? v.y : Math.min(v.y, 0) });
  g.fx('darkNox', { x: a.x, y: a.y, who: a.id });
  g.fx('focus', { x: a.x, y: a.y, p: 0.9 });
  g.text(a.x, a.y - 30, 'O SANGUE CHAMA...', '#ff3a5a');
  a.riseText = g.effects[g.effects.length - 1];
  drama(g, 0.7, a);
  g.sound('bats', a.x);
}

// The moment he turns: a burst of blood and bats that throws everyone close back, bleeding.
function becomeDark(g, a) {
  const said = g.effects.indexOf(a.riseText);
  if (said >= 0) g.effects.splice(said, 1);
  a.form = 'dark';
  a.formT = DARK.time;
  a.blood = DARK.max;
  a.abilityCd = 0.6;
  // The scythe leaves his hand and flies on its own (sim/nox.js).
  freeScythe(g, a);
  const x = a.x, y = a.y, R = 96;
  for (const b of enemiesNear(g, a, b => !b.knocked && Math.abs(b.x - x) < R && Math.abs(b.y - y) < 60)) {
    const s = Math.sign(b.x - x) || a.face, f = 1 - Math.abs(b.x - x) / R;
    const dealt = damage(g, b, 5 + 6 * f, { x: b.x - s * 4, y: b.y }, a.id, 'hemo', { kb: { x: s * (5 + 5 * f), y: -3.5 - 2 * f } });
    if (dealt && !b.dead && !b.knocked) { b.hitstun = Math.max(b.hitstun || 0, 0.5); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); b.bleed = Math.min(6, (b.bleed || 0) + 1); b.bleedBy = a.id; b.bleedByT = g.time; }
  }
  for (const l of g.limbs) if (Math.abs(l.x - x) < R + 10 && Math.abs(l.y - y) < 60) Body.setVelocity(l.body, { x: l.body.velocity.x + Math.sign(l.x - x) * 5, y: l.body.velocity.y - 3 });
  g.fx('darkNoxPop', { x, y, who: a.id });
  g.fx('bloodBurst', { x, y: y - 4, n: 3 });
  g.text(x, y - 44, 'DARK NOX!', '#ff2a4a');
  g.shake = Math.max(g.shake, 9);
  g.flash = Math.max(g.flash, 0.25);
  drama(g, 0.6, a);
  g.sound('explosion', x);
}

export function startDarkFade(g, a) {
  setAct(a, 'darkFade', DARK.fade);
  a.attack = 0; a.hits = null;
  a.abilityCd = 0;
}

// After a launcher: leap straight at the airborne target, then open the air combo on arrival.
// then: the move to throw on arrival (small Juma pouncing after a rival her string knocked away).
export function startChase(g, a, prey, then = null) {
  if (a.type === 4) { startSwarm(g, a, { prey, then: then || noxAir(a)[0] }); return; }
  if (a.type === 2) { startBlink(g, a, prey, then || LOLA_AIR[0]); return; }
  setAct(a, 'chase', 0.42);
  a.chaseId = prey.id;
  a.chaseThen = then;
  a.ground = false;
  g.fx('dash', { x: a.x, y: a.y, face: prey.x >= a.x ? 1 : -1 });
  g.sound('jump', a.x);
}

// Lola after a launcher, or after a rival her string knocked out of reach: she is gone for a few
// frames (time stopped for her alone) and steps out of it beside them, already cutting.
const BLINK_T = 0.07;
export function startBlink(g, a, prey, then) {
  setAct(a, 'blink', BLINK_T);
  a.blinkTo = prey.id;
  a.blinkThen = then;
  a.attack = 0; a.hits = null;
  g.fx('skipOut', { x: a.x, y: a.y, face: a.face, who: a.id });
  g.sound('skip', a.x);
}

// Weapon ground pound: hold the strike pose and fall fast; the blow lands on touchdown.
export function startPlunge(g, a) {
  setAct(a, 'plunge', 2);
  Body.setVelocity(a.body, { x: a.body.velocity.x * 0.3, y: 13 });
}

export function startStomp(g, a) {
  // The beast drops like a meteor and the floor jumps where she lands.
  if (a.type === 3 && a.form === 'beast') {
    setAct(a, 'meteor', 1.6);
    a.slamHit = {};
    a.attackCd = 0.4;
    Body.setVelocity(a.body, { x: a.body.velocity.x * 0.3, y: 16 });
    g.sound('whoosh', a.x);
    return;
  }
  setAct(a, 'stomp', 1.6);
  a.slamHit = {};
  a.attackCd = 0.3;
  Body.setVelocity(a.body, { x: a.body.velocity.x * 0.4, y: 15 });
  g.sound('swing', a.x);
}

// Pick up a downed fighter or a corpse and carry it overhead.
export function startCarry(g, a, limb) {
  const r = limb.ragdoll;
  const core = (r && (r.limbs.body || r.limbs.head)) || limb;
  a.holdingLimb = core.id;
  setAct(a, 'carry', Infinity);
  g.text(a.x, a.y - 30, 'PEGUEI!', '#e8c590');
  g.sound('pickup', a.x);
}

// Velocity toward a point relative to the holder, capped so the body glides there instead of
// jumping, and carried along with the holder's own motion.
function steerHeld(a, limb, ox, oy, k, max) {
  const b = limb.body, v = a.body.velocity;
  let vx = (a.body.position.x + ox - b.position.x) * k, vy = (a.body.position.y + oy - b.position.y) * k;
  const m = Math.hypot(vx, vy);
  if (m > max) { vx *= max / m; vy *= max / m; }
  Body.setVelocity(b, { x: vx + v.x, y: vy + v.y });
}

function heldRagdoll(g, a) {
  const limb = g.limbs.find(l => l.id === a.holdingLimb);
  return { limb, r: limb?.ragdoll || null };
}

function fling(g, a, vx, vy) {
  const { limb, r } = heldRagdoll(g, a);
  const limbs = r ? Object.values(r.limbs) : limb ? [limb] : [];
  endAct(g, a);
  for (const l of limbs) {
    l.owner = a.id;
    l.throwTime = g.time + 2;
    Body.setVelocity(l.body, { x: vx + rnd(-1, 1), y: vy + rnd(-1, 1) });
  }
  const victim = r && g.actor(r.actor);
  if (victim && victim.knocked) { victim.knock = Math.max(victim.knock, 1.2); victim.lastHit = a.id; victim.lastHitTime = g.time; }
  return limbs.length > 0;
}

export function throwCarried(g, a) {
  if (fling(g, a, a.face * 11, -6)) {
    a.attack = 0.25; a.attackKind = 'throw'; a.attackSeq = (a.attackSeq || 0) + 1;
    a.attackCd = 0.35;
    g.text(a.x, a.y - 30, 'VOA!', '#e8c590');
    g.sound('swing', a.x);
  }
}

const enemiesNear = (g, a, test) => g.enemies(a).filter(b => !b.dead && test(b));

// Returns LOCK (or a velocity override) when the special controls movement this step.
export function stepSpecial(g, a, input, pressed, dt) {
  a.actT += dt;
  const v = a.body.velocity;
  switch (a.act) {
    case 'pounce': {
      const b = enemiesNear(g, a, b => !b.knocked && Math.abs(b.x - a.x) < 16 && Math.abs(b.y - a.y) < 26)[0];
      if (b) {
        setAct(a, 'ride', 1.3);
        a.rideOn = b.id;
        a.rideTick = 0;
        b.stun = Math.max(b.stun, 0.3);
        g.text(b.x, b.y - 34, 'MONTOU!', '#ffb763');
        return LOCK;
      }
      if ((a.ground && a.actT > 0.12) || a.actT > a.actMax) endAct(g, a);
      return a.act ? LOCK : null;
    }
    case 'ride': {
      const b = g.actor(a.rideOn);
      if (!b || b.dead || b.knocked || a.actT > a.actMax || pressed('jump')) { kickoff(g, a, b); return LOCK; }
      const tx = b.x - a.face * 2, ty = b.y - 35;
      Body.setPosition(a.body, { x: a.body.position.x + clamp(tx - a.body.position.x, -7, 7), y: a.body.position.y + clamp(ty - a.body.position.y, -7, 7) });
      Body.setVelocity(a.body, { x: b.body.velocity.x, y: b.body.velocity.y });
      a.rideTick -= dt;
      if (a.rideTick <= 0) {
        a.rideTick = 0.16;
        damage(g, b, 4, { x: b.x + rnd(-4, 4), y: b.y - 8 }, a.id, 'claw', { kb: { x: 0, y: 0 }, part: 'head', dir: rnd(-1.2, 1.2) });
        b.stun = Math.max(b.stun, 0.2);
        g.fx('slash', { x: b.x, y: b.y - 8, face: Math.random() < 0.5 ? 1 : -1, size: 12, kind: 'claw', fin: 0, color: '#f1d9a8' });
      }
      return LOCK;
    }
    case 'chase': {
      const b = g.actor(a.chaseId);
      if (!b || b.dead || b.knocked) { endAct(g, a); return null; }
      b.float = Math.max(b.float || 0, 0.25);
      const side = Math.sign(a.x - b.x) || -a.face;
      const tx = b.x + side * 16, ty = b.y + 2, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      a.face = b.x >= a.x ? 1 : -1;
      if (d < 10 || a.actT > a.actMax) {
        endAct(g, a);
        const then = a.chaseThen || (a.type === 4 ? noxAir(a)[0] : a.type === 3 ? (a.form === 'beast' ? 'bAirSmash' : JUMA_AIR[0]) : a.type === 0 ? KING_AIR[0] : 'airA');
        a.chaseThen = null;
        if (b.ground) Body.setVelocity(a.body, { x: a.face, y: 0 });
        else {
          a.ground = false;
          Body.setVelocity(b.body, { x: 0, y: -1 });
          b.float = 0.6;
          Body.setVelocity(a.body, { x: 0, y: -0.5 });
        }
        startMove(g, a, then);
        return LOCK;
      }
      return { lock: true, vx: (dx / d) * 12, vy: (dy / d) * 12 };
    }
    case 'plunge': {
      const mv = MOVES[a.attackKind];
      if (mv) a.attack = Math.max(a.attack, mv.dur * (1 - mv.anim.w) - 0.01);
      if (a.ground || a.climbing || a.actT > a.actMax) { endAct(g, a); landPlunge(g, a); return null; }
      return { lock: true, vx: v.x * 0.95, vy: Math.max(v.y, 14) };
    }
    case 'kickoff':
      if (a.actT > 0.3 || (a.ground && a.actT > 0.1)) endAct(g, a);
      return null;
    case 'blink': {
      if (a.actT < a.actMax) return { lock: true, vx: 0, vy: 0 };
      const b = g.actor(a.blinkTo), then = a.blinkThen;
      endAct(g, a);
      if (!b || b.dead || b.knocked) return null;
      const spot = skipSpot(a, b, 'front') || { x: b.x - (Math.sign(b.x - a.x) || a.face) * 18, y: b.y - 8, ground: false };
      const x0 = a.x, y0 = a.y;
      skipTo(g, a, spot.x, spot.y, { face: Math.sign(b.x - spot.x) || a.face, ground: spot.ground, quiet: true, ghost: false });
      skipKnives(g, a, x0, y0, b);
      if (!b.ground) { Body.setVelocity(b.body, { x: 0, y: -1 }); b.float = Math.max(b.float || 0, 0.6); }
      startMove(g, a, then);
      return LOCK;
    }
    // Stopped time runs from Game.step (sim/timestop.js); this only holds her if it ever gets here.
    case 'world': return LOCK;
    case 'ball': {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir) { a.ballV = clamp(a.ballV + dir * 0.6, -9.5, 9.5); a.face = Math.sign(a.ballV) || a.face; }
      if (a.actT > 0.15 && Math.abs(v.x) < 1.2 && Math.abs(a.ballV) > 3) {
        a.ballV = -a.ballV * 0.7;
        a.face = Math.sign(a.ballV) || a.face;
        g.sound('thud', a.x);
        g.fx('dust', { x: a.x, y: a.y + 10, n: 3 });
      }
      let vy = v.y;
      if (pressed('jump') && a.ground) { vy = -9; g.sound('jump', a.x); }
      for (const b of enemiesNear(g, a, b => Math.hypot(b.x - a.x, b.y - a.y) < 22)) {
        if (g.time - (a.ballHit[b.id] ?? -9) < 0.5) continue;
        a.ballHit[b.id] = g.time;
        const s = Math.sign(b.x - a.x) || a.face;
        damage(g, b, 12, { x: b.x - s * 4, y: b.y + 8 }, a.id, 'impact', { kb: { x: s * 8, y: -5 }, knock: true });
        a.ballV = -s * Math.abs(a.ballV) * 0.5;
        g.shake = Math.max(g.shake, 4);
      }
      for (const l of g.limbs) if (Math.hypot(l.x - a.x, l.y - a.y) < 20) Body.setVelocity(l.body, { x: l.body.velocity.x + a.ballV * 0.4, y: l.body.velocity.y - 2 });
      for (const p of g.props) if (!p.held && !p.fixed && !p.body.isStatic && Math.hypot(p.x - a.x, p.y - a.y) < 24) Body.setVelocity(p.body, { x: p.body.velocity.x + a.ballV * 0.3, y: p.body.velocity.y - 1 });
      if (a.actT > a.actMax) { endAct(g, a); g.fx('poof', { x: a.x, y: a.y }); return null; }
      return { lock: true, vx: a.ballV, vy };
    }
    case 'bite': {
      const grab = biteTarget(g, a);
      if (grab) { seize(g, a, grab); return LOCK; }
      if (a.actT > a.actMax) endAct(g, a);
      return { lock: true, vx: a.face * 7 * (1 - a.actT / a.actMax), vy: v.y };
    }
    case 'shake': {
      const { limb, r } = heldRagdoll(g, a);
      if (!limb) { endAct(g, a); return null; }
      const victim = r && g.actor(r.actor);
      if (victim && victim.knocked) victim.knock = Math.max(victim.knock, 0.8);
      steerHeld(a, limb, a.face * 14, -5, 0.5, 10);
      a.shakeTick = (a.shakeTick ?? 0) - dt;
      if (a.shakeTick <= 0) {
        a.shakeTick = 0.25;
        a.shakeSide = -(a.shakeSide || 1);
        for (const l of r ? Object.values(r.limbs) : [limb]) Body.setVelocity(l.body, { x: l.body.velocity.x + a.shakeSide * a.face * 5, y: l.body.velocity.y - 6 });
        if (victim && !victim.dead && victim.knocked) damage(g, victim, 7, { x: limb.x, y: limb.y }, a.id, 'bite', { part: limb.part, kb: { x: 0, y: 0 }, force: true });
        if (r && (g.settings.gore ?? 2) === 2 && Math.random() < 0.35) {
          const j = r.joints.filter(j => !j.broken && j.child !== limb.part)[Math.floor(rnd(0, 4))];
          if (j) { breakJoint(g, r, j, 'stretch'); g.text(limb.x, limb.y - 20, 'RASGOU!', '#e99598'); }
        }
        g.shake = Math.max(g.shake, 3);
        g.sound('squish', a.x);
      }
      if (a.actT > a.actMax) {
        fling(g, a, a.face * 12, -6);
        setAct(a, 'toss', 0.3);
        g.text(a.x, a.y - 30, 'NHAC!', '#ffd36c');
        g.sound('swing', a.x);
      }
      return { lock: true, vx: v.x * 0.6, vy: v.y };
    }
    case 'toss':
      if (a.actT > a.actMax) endAct(g, a);
      return null;
    case 'decree': return stepDecree(g, a);
    case 'darkRise': {
      // The blood gathers into him, shivering; then he turns.
      if (a.form !== 'dark' && a.actT >= DARK.pop) becomeDark(g, a);
      if (a.actT > a.actMax) { endAct(g, a); return null; }
      return { lock: true, vx: v.x * 0.8, vy: a.ground ? v.y : Math.min(v.y, 0.3) };
    }
    case 'darkFade': {
      if (a.form === 'dark' && a.actT >= DARK.fade * 0.5) { a.form = null; a.formT = 0; a.blood = 0; g.fx('darkFade', { x: a.x, y: a.y, who: a.id }); g.sound('bats', a.x); }
      if (a.actT > a.actMax) { endAct(g, a); return null; }
      return { lock: true, vx: v.x * 0.8, vy: v.y };
    }
    case 'morph': {
      // Hunched and shivering, swelling, then the pop into the beast and the roar.
      if (!a.form && a.actT >= SPECIALS[3].pop) becomeBeast(g, a);
      if (a.actT > a.actMax) { endAct(g, a); return null; }
      return { lock: true, vx: v.x * 0.8, vy: a.ground ? v.y : Math.min(v.y, 0.6) };
    }
    case 'unmorph': {
      // The beast runs out of breath, a puff of steam, and she is small again.
      if (a.form && a.actT >= 0.32) { a.form = null; a.formT = 0; g.fx('unmorphPop', { x: a.x, y: a.y, face: a.face }); g.sound('pop', a.x); }
      if (a.actT > a.actMax) { endAct(g, a); return null; }
      return { lock: true, vx: v.x * 0.8, vy: v.y };
    }
    case 'charge': return stepCharge(g, a, v);
    case 'chargeEnd':
    case 'slamLand':
      if (a.actT > a.actMax) endAct(g, a);
      return { lock: true, vx: v.x * 0.85, vy: v.y };
    case 'leap': {
      // Up, a beat at the top, then straight down onto whoever is under her.
      for (const b of enemiesNear(g, a, b => !a.slamHit[b.id] && !b.knocked && v.y > 0 && Math.abs(b.x - a.x) < 16 && b.y - a.y > 6 && b.y - a.y < 40)) {
        a.slamHit[b.id] = true;
        damage(g, b, 12, { x: b.x, y: b.y - 12 }, a.id, 'slam', { kb: { x: 0, y: 4 }, part: 'head', knock: true, lag: 1.4 });
      }
      // She comes down on the level of whoever she jumped at, through any catwalk on the way.
      MAP.oneway.forEach((p, i) => { if (p.y < (a.leapTo ?? 0) - 4) a.drop[i] = 0.1; });
      if (a.ground && a.actT > 0.12) { shockwave(g, a, 130, true); setAct(a, 'slamLand', 0.36); return LOCK; }
      if (a.actT > a.actMax) endAct(g, a);
      return { lock: true, vx: v.x, vy: v.y < -1.5 ? v.y : clamp(v.y, 15, 17) };
    }
    case 'meteor': {
      for (const b of enemiesNear(g, a, b => !a.slamHit[b.id] && !b.knocked && Math.abs(b.x - a.x) < 18 && b.y - a.y > 6 && b.y - a.y < 44)) {
        a.slamHit[b.id] = true;
        damage(g, b, 14, { x: b.x, y: b.y - 12 }, a.id, 'slam', { kb: { x: 0, y: 6 }, part: 'head', knock: true, lag: 1.5 });
      }
      if (a.ground || a.climbing) { shockwave(g, a, 80, true); setAct(a, 'slamLand', 0.3); return LOCK; }
      if (a.actT > a.actMax) endAct(g, a);
      return { lock: true, vx: v.x * 0.97, vy: clamp(v.y, 16, 17) };
    }
    case 'requiem': return stepRequiem(g, a, v);
    case 'swarm': return stepSwarm(g, a);
    case 'beam': {
      if (!a.beamFired && a.actT >= SPECIALS[4].charge) { a.beamFired = true; bloodBeam(g, a); }
      if (a.actT > a.actMax) { endAct(g, a); return null; }
      // In the air Nox hangs while the blood condenses and the shot holds him up.
      return { lock: true, vx: a.body.velocity.x * 0.82, vy: a.ground ? v.y : Math.min(v.y, a.beamFired ? 1.4 : 0.25) };
    }
    case 'stomp': {
      for (const b of enemiesNear(g, a, b => !a.slamHit[b.id] && Math.abs(b.x - a.x) < 14 && b.y - a.y > 10 && b.y - a.y < 40)) {
        a.slamHit[b.id] = true;
        damage(g, b, 12, { x: b.x, y: b.y - 14 }, a.id, 'stomp', { kb: { x: 0, y: 3 }, part: 'head', knock: v.y > 16 });
        if (!b.dead && !b.knocked) b.stun = Math.max(b.stun, 0.6);
        g.fx('ring', { x: b.x, y: b.y - 16, size: 14, color: '#ffffff' });
        endAct(g, a);
        return { lock: true, vx: v.x, vy: -9 };
      }
      for (const l of g.limbs) {
        if (a.slamHit['l' + l.id] || Math.abs(l.x - a.x) > 12 || l.y - a.y < 6 || l.y - a.y > 30) continue;
        a.slamHit['l' + l.id] = true;
        Body.setVelocity(l.body, { x: l.body.velocity.x, y: 6 });
        const owner = g.actor(l.actor);
        if (l.attached && owner && owner.knocked && !owner.dead && owner.team !== a.team) damage(g, owner, 9, { x: l.x, y: l.y }, a.id, 'stomp', { part: l.part, kb: { x: 0, y: 0 }, force: true });
      }
      if (a.ground || a.climbing || a.actT > a.actMax) { endAct(g, a); g.fx('dust', { x: a.x, y: a.y + 16, n: 5 }); return null; }
      return { lock: true, vx: v.x * 0.98, vy: Math.max(v.y, 14) };
    }
    case 'carry': {
      const { limb, r } = heldRagdoll(g, a);
      if (!limb) { endAct(g, a); return null; }
      const victim = r && g.actor(r.actor);
      if (victim && victim.knocked) victim.knock = Math.max(victim.knock, 0.5);
      steerHeld(a, limb, a.face * 2, -27, 0.35, 8);
      return null;
    }
  }
  return null;
}

function kickoff(g, a, b) {
  if (b && !b.dead) damage(g, b, 6, { x: b.x, y: b.y - 10 }, a.id, 'kick', { kb: { x: a.face * 7, y: -4 }, knock: true });
  setAct(a, 'kickoff', 0.35);
  a.rideOn = null;
  Body.setVelocity(a.body, { x: -a.face * 4, y: -7 });
  g.sound('punch', a.x);
}

function biteTarget(g, a) {
  const inFront = (x, y) => { const along = (x - a.x) * a.face; return along > -4 && along < 30 && Math.abs(y - a.y) < 26; };
  const b = g.enemies(a).find(b => !b.dead && !b.knocked && inFront(b.x, b.y));
  if (b) return { actor: b };
  const limb = g.limbs.find(l => inFront(l.x, l.y) && (l.ragdoll || !l.attached) && (!l.attached || g.actor(l.actor)?.team !== a.team));
  return limb ? { limb } : null;
}

// Small Juma's S+J: the lunging bite that seizes, shakes and throws.
const BITE = { dur: 0.3, shake: 1.0 };
export function startBite(g, a) {
  a.biteCd = 2.4;
  a.attack = 0; a.hits = null;
  a.attackSeq = (a.attackSeq || 0) + 1;
  a.attackCd = 0.3;
  setAct(a, 'bite', BITE.dur);
  Body.setVelocity(a.body, { x: a.face * 7, y: a.ground ? Math.min(a.body.velocity.y, -1.5) : a.body.velocity.y });
  g.sound('swing', a.x);
}

function seize(g, a, { actor, limb }) {
  if (actor) {
    knockdown(g, actor, { velocity: { x: a.face * 1, y: -2 }, time: 2.6 });
    const r = ragdollOf(g, actor);
    limb = r && (r.limbs.body || r.limbs.head || Object.values(r.limbs)[0]);
    if (!limb) { endAct(g, a); return; }
  }
  const core = limb.ragdoll && limb.ragdoll.limbs.body ? limb.ragdoll.limbs.body : limb;
  a.holdingLimb = core.id;
  setAct(a, 'shake', BITE.shake);
  a.shakeTick = 0.1;
  g.text(a.x, a.y - 30, 'MORDIDA!', '#ffd36c');
  g.sound('squish', a.x);
}

// The beast lands: everything near the impact is knocked away.
function shockwave(g, a, R = 120, beast = false) {
  const x = a.x, y = a.y + 16;
  for (const b of g.enemies(a)) {
    if (b.dead) continue;
    const dx = b.x - x, d = Math.abs(dx);
    if (d > R || Math.abs(b.y + 16 - y) > 50) continue;
    const f = 1 - d / R, s = Math.sign(dx) || a.face;
    damage(g, b, (beast ? 8 : 6) + 14 * f, { x: b.x - s * 4, y: b.y + 12 }, a.id, 'slam', { kb: { x: s * (3 + 8 * f), y: -4 - 4 * f }, knock: f > 0.25, lag: beast ? 1.4 : 1 });
  }
  for (const l of g.limbs) {
    const d = Math.abs(l.x - x);
    if (d < R && Math.abs(l.y - y) < 50) Body.setVelocity(l.body, { x: l.body.velocity.x + Math.sign(l.x - x) * 6 * (1 - d / R), y: l.body.velocity.y - 6 * (1 - d / R) });
  }
  for (const p of [...g.props]) {
    if (p.held || p.fixed || p.body.isStatic) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > R) continue;
    if (p.kind === 'glass' && d < 60) { damageProp(g, p, 60, a.id); continue; }
    Body.setVelocity(p.body, { x: p.body.velocity.x + Math.sign(p.x - x) * 5 * (1 - d / R), y: p.body.velocity.y - 6 * (1 - d / R) });
  }
  g.fx('ring', { x, y, size: R, color: beast ? '#ffb070' : '#ffd6e4' });
  g.fx('ring', { x, y, size: R * 0.6, color: '#ffffff' });
  g.fx('land', { x, y, p: 1 });
  g.fx('dust', { x, y, n: 10 });
  if (beast) { g.fx('quake', { x, y, p: R > 100 ? 9 : 6, face: a.face, both: 1 }); g.sound('quake', x); }
  g.shake = Math.max(g.shake, beast ? 12 : 9);
  g.flash = Math.max(g.flash, 0.2);
  g.sound('thud', x);
}

// ---- Juma's forms ------------------------------------------------------------------------
// K: small, she turns into the beast; as the beast, the seismic leap.
function jumaSpecial(g, a) {
  a.powerSeq = (a.powerSeq || 0) + 1;
  a.attack = 0;
  a.hits = null;
  if (a.form === 'beast') { startLeap(g, a); return; }
  a.abilityCd = SPECIALS[3].cd;
  setAct(a, 'morph', SPECIALS[3].dur);
  Body.setVelocity(a.body, { x: a.body.velocity.x * 0.3, y: Math.min(a.body.velocity.y, 0) });
  g.fx('morphStart', { x: a.x, y: a.y, face: a.face });
  g.text(a.x, a.y - 30, 'GRRRR...', '#ffb763');
  a.growlText = g.effects[g.effects.length - 1];
  g.sound('growl', a.x);
}

function becomeBeast(g, a) {
  // The growl gives way to the name.
  const said = g.effects.indexOf(a.growlText);
  if (said >= 0) g.effects.splice(said, 1);
  a.form = 'beast';
  a.formT = SPECIALS[3].form;
  a.abilityCd = 0.8;
  // The roar: everyone close is blown back and reels.
  const x = a.x, y = a.y, R = 84;
  for (const b of enemiesNear(g, a, b => !b.knocked && Math.abs(b.x - x) < R && Math.abs(b.y - y) < 50)) {
    const s = Math.sign(b.x - x) || a.face, f = 1 - Math.abs(b.x - x) / R;
    damage(g, b, 4 + 4 * f, { x: b.x - s * 4, y: b.y }, a.id, 'roar', { kb: { x: s * (4 + 5 * f), y: -3 - 2 * f } });
    if (!b.dead && !b.knocked) { b.hitstun = Math.max(b.hitstun || 0, 0.5); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); }
  }
  for (const l of g.limbs) if (Math.abs(l.x - x) < R + 10 && Math.abs(l.y - y) < 60) Body.setVelocity(l.body, { x: l.body.velocity.x + Math.sign(l.x - x) * 4, y: l.body.velocity.y - 3 });
  for (const p of g.props) if (!p.held && !p.fixed && !p.body.isStatic && Math.abs(p.x - x) < R + 10 && Math.abs(p.y - y) < 60) Body.setVelocity(p.body, { x: p.body.velocity.x + Math.sign(p.x - x) * 3, y: p.body.velocity.y - 3 });
  g.fx('morphPop', { x, y, face: a.face });
  g.fx('roar', { x: x + a.face * 8, y: y - 10, face: a.face });
  g.shake = Math.max(g.shake, 8);
  g.flash = Math.max(g.flash, 0.15);
  g.text(x, y - 36, 'FERA!', '#ff9a3a');
  g.sound('roar', x);
  drama(g, 0.3, a);
}

export function startUnmorph(g, a) {
  setAct(a, 'unmorph', 0.7);
  a.abilityCd = SPECIALS[3].cd;
  a.attack = 0;
  a.hits = null;
  g.fx('steam', { x: a.x, y: a.y - 6, n: 10 });
  g.text(a.x, a.y - 30, 'UFA...', '#e8d0b0');
}

// The beast lasts while its timer runs; it turns back at the first free moment after.
export function tickForm(g, a, dt) {
  // DARK NOX lasts while his blood does (the meter is his time left), then he turns back.
  if (a.form === 'dark') {
    if (a.act === 'darkRise' || a.act === 'darkFade') return;
    a.formT = Math.max(0, (a.formT || 0) - dt);
    a.blood = (DARK.max * a.formT) / DARK.time;
    if (a.formT <= 0 && !a.act && !(a.attack > 0) && !a.knocked && !(a.hitstun > 0) && !(a.frozen > 0)) startDarkFade(g, a);
    return;
  }
  if (a.form !== 'beast' || a.act === 'morph' || a.act === 'unmorph') return;
  a.formT = Math.max(0, (a.formT || 0) - dt);
  if (a.formT <= 0 && !a.act && !(a.attack > 0) && !a.knocked && !(a.hitstun > 0) && !(a.frozen > 0)) startUnmorph(g, a);
}

// The beast's side+J: digs in, then a charge that scoops up whoever is in the way and carries them
// into the wall (crushed against it), the pit's edge, or to the end of the run.
export function startCharge(g, a) {
  a.chargeCd = 2.4;
  a.attack = 0;
  a.hits = null;
  a.attackSeq = (a.attackSeq || 0) + 1;
  a.attackCd = 0.3;
  setAct(a, 'charge', 0.95);
  a.carry = [];
  a.chargeHit = {};
  a.chargeGo = false;
  g.sound('growl', a.x);
}

const CHARGE_WIND = 0.2, CHARGE_V = 7.5;
function stepCharge(g, a, v) {
  if (a.actT < CHARGE_WIND) return { lock: true, vx: v.x * 0.6, vy: v.y };
  const face = a.face;
  if (!a.chargeGo) { a.chargeGo = true; g.fx('dash', { x: a.x, y: a.y, face }); g.fx('quake', { x: a.x - face * 6, y: a.y + 16, p: 1, face }); g.sound('whoosh', a.x); }
  for (const b of enemiesNear(g, a, b => !b.knocked && !a.chargeHit[b.id] && (b.x - a.x) * face > -4 && (b.x - a.x) * face < 26 && Math.abs(b.y - a.y) < 26)) {
    a.chargeHit[b.id] = true;
    if (!damage(g, b, 6, { x: b.x - face * 4, y: b.y }, a.id, 'paw', { kb: { x: 0, y: 0 }, lag: 1.2 }) || b.dead || b.knocked) continue;
    a.carry.push(b.id);
    g.text(b.x, b.y - 34, 'INVESTIDA!', '#ff9a3a');
  }
  // Whoever she hit rides on her shoulder.
  const held = a.carry.map(id => g.actor(id)).filter(b => b && !b.dead && !b.knocked);
  for (const b of held) {
    // Pinned on her shoulder, lifted off their feet, far enough out that both read.
    Body.setPosition(b.body, { x: a.body.position.x + face * 26, y: Math.min(b.body.position.y, a.body.position.y - 6) });
    Body.setVelocity(b.body, { x: face * CHARGE_V, y: 0 });
    b.lagPos = null;
    b.hitstun = Math.max(b.hitstun || 0, 0.3); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun);
  }
  const ahead = a.x + face * (held.length ? 38 : 12);
  const wall = inside(ahead, a.y);
  const pit = a.ground && ahead > MAP.pit.x0 && ahead < MAP.pit.x1;
  if (wall || pit || a.actT > a.actMax) { chargeSlam(g, a, held, wall); return LOCK; }
  if (a.ground && Math.random() < 0.5) g.fx('dust', { x: a.x - face * 6, y: a.y + 16, n: 1 });
  return { lock: true, vx: face * CHARGE_V, vy: v.y };
}

function chargeSlam(g, a, held, wall) {
  const face = a.face;
  setAct(a, 'chargeEnd', 0.34);
  for (const b of held) {
    if (wall) {
      damage(g, b, 18, { x: b.x + face * 6, y: b.y }, a.id, 'slam', { kb: { x: -face * 3, y: -4 }, knock: true, lag: 1.8 });
      g.fx('wallSplat', { x: b.x + face * 8, y: b.y, face });
      g.text(b.x, b.y - 38, 'ESMAGOU!', '#ff9a3a');
    } else damage(g, b, 12, { x: b.x - face * 4, y: b.y }, a.id, 'paw', { kb: { x: face * 9, y: -5 }, knock: true, lag: 1.5 });
  }
  a.carry = [];
  if (wall) { g.fx('quake', { x: a.x + face * 20, y: a.y + 16, p: 3, face }); g.sound('thud', a.x); }
  g.shake = Math.max(g.shake, wall ? 10 : held.length ? 6 : 3);
  Body.setVelocity(a.body, { x: wall ? -face * 2 : face * 2, y: a.body.velocity.y });
}

// The beast's K: the seismic leap. A huge jump at the nearest rival and a landing that throws
// everyone around off their feet.
function startLeap(g, a) {
  a.abilityCd = 3.6;
  const b = g.enemies(a).filter(b => !b.dead && !b.knocked && Math.abs(b.x - a.x) < 260 && Math.abs(b.y - a.y) < 160).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
  if (b) a.face = b.x >= a.x ? 1 : -1;
  setAct(a, 'leap', 1.8);
  a.slamHit = {};
  a.leapTo = (b || a).body.position.y + HALF_H;
  Body.setVelocity(a.body, { x: b ? clamp((b.x - a.x) / 32, -6.5, 6.5) : a.face * 3, y: -12.5 });
  a.ground = false;
  g.fx('quake', { x: a.x, y: a.y + 16, p: 2, face: a.face });
  g.text(a.x, a.y - 30, 'SALTO SÍSMICO!', '#ff9a3a');
  g.sound('jump', a.x);
}

// Standing on a floor is not inside it: two units of give at the feet and the head.
const inside = (x, y) => x < 14 || x > 946 || MAP.solids.some(s => s.kind !== 'pit' && x + 7 > s.x0 && x - 7 < s.x1 && y + HALF_H - 2 > s.y0 && y - HALF_H + 2 < s.y1);
function warp(g, a, x, y) {
  Body.setPosition(a.body, { x, y });
  Body.setVelocity(a.body, { x: 0, y: 0 });
  a.x = x; a.y = y; a.prevFeet = y + HALF_H; a.teleported = g.seq; a.ghostClear = true;
}

// The swarm: Nox bursts into bats that fly an arc to a rival, homing on them, and gather again
// behind them (in front when there is no room) with Nox already striking. It happens on its own
// inside his strings, whenever the rival is out of reach of the next blow and for the chase after a
// launcher or a bounce (then: the blow he forms into); L sends it at the nearest rival on a
// cooldown, and with nobody in reach it just carries him ahead. Bats cannot be hit.
const SWARM_RANGE = 340;
export function startSwarm(g, a, { prey = null, then = null } = {}) {
  prey ||= g.enemies(a).filter(b => !b.dead && !b.knocked && Math.hypot(b.x - a.x, b.y - a.y) < SWARM_RANGE)
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
  const x0 = a.x, y0 = a.y;
  let x1 = clamp(a.x + a.face * 120, 20, 940), y1 = a.y;
  if (prey) [x1, y1] = swarmLanding(a, prey);
  else if (inside(x1, y1)) x1 = a.x;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  setAct(a, 'swarm', clamp(dist / (then ? 1100 : 900), then ? 0.12 : 0.18, then ? 0.28 : 0.36));
  a.swarm = { x0, y0, x1, y1, prey: prey?.id ?? null, then };
  if (!then) a.batCd = 2.5;
  if (prey) prey.float = Math.max(prey.float || 0, 0.5);
  a.attack = 0; a.hits = null;
  a.ground = false;
  g.fx('batSwarm', { x: a.x, y: a.y, n: 18 });
  g.sound('bats', a.x);
}
// Behind the rival (the side they are not facing), or in front if the wall or a block is there.
function swarmLanding(a, b) {
  const back = -(b.face || 1);
  for (const s of [back, -back]) {
    const x = b.x + s * 20;
    if (!inside(x, b.y)) return [x, b.y];
  }
  return [b.x, b.y - 30];
}
function stepSwarm(g, a) {
  const sw = a.swarm;
  if (!sw) { endAct(g, a); return null; }
  const prey = sw.prey != null ? g.actor(sw.prey) : null;
  if (prey && !prey.dead && !prey.knocked) { [sw.x1, sw.y1] = swarmLanding(a, prey); if (!prey.ground) prey.float = Math.max(prey.float || 0, 0.3); }
  // An arc that rises over the middle of the flight.
  const k = Math.min(1, a.actT / a.actMax), u = 1 - (1 - k) * (1 - k);
  const mx = (sw.x0 + sw.x1) / 2, my = Math.min(sw.y0, sw.y1) - 26 - Math.abs(sw.x1 - sw.x0) * 0.08;
  const x = (1 - u) * (1 - u) * sw.x0 + 2 * (1 - u) * u * mx + u * u * sw.x1, y = (1 - u) * (1 - u) * sw.y0 + 2 * (1 - u) * u * my + u * u * sw.y1;
  warp(g, a, clamp(x, 14, 946), y);
  a.ground = false;
  if (k < 1) return LOCK;
  endAct(g, a);
  a.swarm = null;
  if (prey && !prey.dead) a.face = prey.x >= a.x ? 1 : -1;
  // Landing by a rival on the floor puts him on the floor too.
  a.ground = !!(prey && prey.ground && Math.abs(prey.y - a.y) < 4);
  g.fx('batSwarm', { x: a.x, y: a.y, arrive: 1, n: 18 });
  g.fx('ring', { x: a.x, y: a.y, size: 26, color: '#ff4a64' });
  startMove(g, a, sw.then || (a.form === 'dark' ? 'dFrenzy' : 'batStrike'));
  return LOCK;
}

// Requiem in crimson (Omnislash): the rival is held up in a bubble of blood while Nox cuts through
// it from every side, seven times, then drops on it from above and the blood bursts.
const CUTS = [[-1, 0.2], [1, -0.7], [-1, -1], [1, 0.5], [-1, -0.35], [1, 1], [-1, -0.8]];
const CUT_AT = 0.12, CUT_GAP = 0.085;
function startRequiem(g, a, b) {
  setAct(a, 'requiem', 1.2);
  a.reqId = b.id; a.reqN = 0; a.reqDone = false;
  a.reqAnchor = { x: b.x, y: b.y, to: b.y - (b.ground ? 26 : 10) };
  b.bloodMark = 0;
  b.hitstun = Math.max(b.hitstun || 0, 0.5); b.hitstunMax = b.hitstun;
  g.fx('batSwarm', { x: a.x, y: a.y });
  g.fx('requiemStart', { x: b.x, y: a.reqAnchor.to, owner: a.id });
  g.text(a.x, a.y - 34, 'RÉQUIEM CARMESIM!', '#ff4a64');
  drama(g, 0.9, a, b);
  g.sound('charge', a.x);
}

function stepRequiem(g, a, v) {
  const b = g.actor(a.reqId), an = a.reqAnchor;
  if (!b || b.dead || b.knocked) { endAct(g, a); return null; }
  if (!a.reqDone) {
    an.y = Math.max(an.to, an.y - 2.5);
    Body.setPosition(b.body, { x: an.x, y: an.y });
    Body.setVelocity(b.body, { x: 0, y: 0 });
    b.hitstun = Math.max(b.hitstun, 0.35); b.float = 0.4;
  }
  while (a.reqN < CUTS.length && a.actT >= CUT_AT + a.reqN * CUT_GAP) {
    let [s, h] = CUTS[a.reqN];
    if (inside(an.x + s * 28, an.y - h * 18)) s = -s;
    const fx = an.x - s * 28, fy = an.y + h * 18, tx = clamp(an.x + s * 28, 14, 946), ty = an.y - h * 18;
    warp(g, a, tx, ty);
    a.face = -s;
    const dealt = damage(g, b, 3, { x: b.x, y: b.y }, a.id, 'blood', { kb: { x: 0, y: 0 }, launch: true, dir: s * h });
    if (dealt) a.hp = Math.min(a.maxHp, a.hp + dealt * 0.15);
    g.fx('requiemCut', { x: fx, y: fy, x2: tx, y2: ty, owner: a.id });
    g.sound('slash', tx);
    a.reqN++;
    if (b.dead) { endAct(g, a); return null; }
  }
  if (a.reqN >= CUTS.length && !a.reqDone && a.actT >= CUT_AT + CUTS.length * CUT_GAP + 0.1) {
    // From above, straight down through it: the bubble and every cut burst at once.
    a.reqDone = true;
    const y = inside(an.x, an.y - 34) ? an.y : an.y - 34;
    warp(g, a, an.x, y);
    damage(g, b, 18, { x: b.x, y: b.y - 6 }, a.id, 'hemo', { kb: { x: -a.face * 2, y: 10 }, knock: true });
    g.fx('requiemBurst', { x: an.x, y: an.y, owner: a.id });
    g.fx('supernova', { x: an.x, y: an.y });
    g.text(an.x, an.y - 44, 'FIM.', '#ffffff');
    drama(g, 0.5, a, b);
    g.shake = Math.max(g.shake, 10);
    g.sound('explosion', an.x);
  }
  if (a.actT > a.actMax) { endAct(g, a); return null; }
  return { lock: true, vx: 0, vy: a.reqDone ? Math.min(v.y + 0.6, 6) : 0 };
}

// Piercing blood: a beam from Nox's claw straight ahead (down and ahead from the air) that runs
// until a wall or block stops it and goes through everyone on the way. Each blood mark on a
// rival adds to it; three go supernova and blow the rival down.
const BEAM_LEN = 430;
export function beamLine(a) {
  const ang = a.beamAir ? (a.face > 0 ? 0.55 : Math.PI - 0.55) : a.face > 0 ? 0 : Math.PI;
  const dx = Math.cos(ang), dy = Math.sin(ang), x0 = a.x + a.face * 10, y0 = a.y - 1;
  let len = BEAM_LEN;
  for (let d = 0; d < BEAM_LEN; d += 3) {
    const px = x0 + dx * d, py = y0 + dy * d;
    if (px < 4 || px > 956 || py > MAP.floorY + 40 || MAP.solids.some(s => s.kind !== 'pit' && px > s.x0 && px < s.x1 && py > s.y0 && py < s.y1)) { len = d; break; }
  }
  return { x0, y0, dx, dy, len };
}

function bloodBeam(g, a) {
  const { x0, y0, dx, dy, len } = beamLine(a);
  // How far along the beam a point is, if it is within r of it.
  const along = (px, py, r) => {
    const t = clamp((px - x0) * dx + (py - y0) * dy, 0, len);
    return Math.hypot(x0 + dx * t - px, y0 + dy * t - py) < r ? t : -1;
  };
  let drank = 0;
  // As DARK NOX the beam is wider and hits harder.
  const dark = a.form === 'dark', wide = dark ? 22 : 15, hard = dark ? 1.4 : 1;
  for (const b of g.enemies(a)) {
    if (b.dead || b.knocked || along(b.x, b.y, wide) < 0) continue;
    if (b.iframes > 0 && b.dodge > 0) continue;
    const marks = markOf(g, b), nova = marks >= 3;
    b.bloodMark = 0;
    const dealt = damage(g, b, (14 + marks * 5) * hard, { x: b.x - dx * 5, y: b.y }, a.id, 'hemo', { kb: { x: dx * (nova ? 9 : 6), y: dy * 6 - (nova ? 5 : 2) }, knock: nova || marks >= 2 });
    drank += dealt || 0;
    if (nova) {
      g.fx('supernova', { x: b.x, y: b.y });
      g.text(b.x, b.y - 40, 'SUPERNOVA!', '#ff4a64');
      g.shake = Math.max(g.shake, 8);
      g.sound('explosion', b.x);
    } else if (dealt) g.fx('bloodBurst', { x: b.x, y: b.y, n: 1 + marks });
  }
  for (const l of g.limbs) {
    if (along(l.x, l.y, 10) < 0) continue;
    Body.setVelocity(l.body, { x: l.body.velocity.x + dx * 7, y: l.body.velocity.y + dy * 7 - 2 });
    const owner = g.actor(l.actor);
    if (l.attached && owner && owner.knocked && !owner.dead && owner.team !== a.team && (!l.ragdoll.hitAt || g.time - l.ragdoll.hitAt > 0.2)) {
      l.ragdoll.hitAt = g.time;
      drank += damage(g, owner, 10, { x: l.x, y: l.y }, a.id, 'hemo', { part: l.part, kb: { x: 0, y: 0 }, force: true }) || 0;
    }
  }
  for (const p of [...g.props]) {
    if (p.held || p.fixed || along(p.x, p.y, Math.max(10, (p.h || 10) / 2 + 4)) < 0) continue;
    damageProp(g, p, p.kind === 'glass' ? 60 : 18, a.id);
    if (g.props.includes(p) && !p.body.isStatic) Body.setVelocity(p.body, { x: p.body.velocity.x + dx * 6, y: p.body.velocity.y + dy * 6 - 2 });
  }
  for (const lamp of g.hz?.lamps || []) if (along(lamp.body.position.x, lamp.body.position.y, 12) >= 0) breakLamp(g, lamp, { vx: dx * 20, vy: dy * 20 });
  if (drank) a.hp = Math.min(a.maxHp, a.hp + drank * 0.25);
  Body.setVelocity(a.body, { x: -dx * 3, y: a.beamAir ? -2.5 : a.body.velocity.y });
  g.fx('bloodBeam', { x: x0, y: y0, x2: x0 + dx * len, y2: y0 + dy * len, dark: dark ? 1 : 0 });
  g.text(a.x, a.y - 32, 'SANGUE PERFURANTE!', '#ff5a6e');
  g.shake = Math.max(g.shake, 5);
  g.flash = Math.max(g.flash, 0.15);
  g.sound('beam', a.x);
}
