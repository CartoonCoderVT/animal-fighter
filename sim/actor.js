import { Body, Query, MASK, CAT, onewayBit, GRAV, approach } from './physics.js';
import { MOVES, NOX_AIR, BURST } from './moves.js';
import { MAP } from './map.js';
import { FIGHTERS, speedOf, weightOf, styleOf } from './fighters.js';
import { clamp } from '../engine/const.js';
import { think } from './ai.js';
import { attack, power, damage, breakBone, tickAttack } from './combat.js';
import { interact, dropWeapon, detonateCharges, updateHolding } from './props.js';
import { knockdown, recover, ragdollOf } from './ragdoll.js';
import { stepSpecial, startSwarm, tickForm, tickTitan, stepSwallowed, tickBelly } from './specials.js';
import { tickAxolotl, axoGrab } from './axolotl.js';
import { HALF_H, FOOT } from '../render/rig.js';

export { HALF_H };
const TIMERS = ['batCd', 'biteCd', 'chargeCd', 'skipCd', 'setCd', 'burstCd', 'hitstun', 'attack', 'attackCd', 'abilityCd', 'float', 'bufA', 'bufP', 'parry', 'parryCd', 'parryLag', 'counter', 'perfectT', 'hurt', 'invincible', 'iframes', 'dodgeCd', 'dodge', 'jumpGrace', 'jumpBuffer', 'stun', 'getup', 'comboTimer', 'shock', 'skid', 'landT', 'climbCd'];

export function groundInfo(g, a) {
  const b = a.body, x = b.position.x, feet = b.position.y + HALF_H;
  if (b.velocity.y < -0.8) return null;
  const from = Math.min(a.prevFeet ?? feet, feet);
  const on = top => feet >= top - 3 && from <= top + 7;
  for (const s of MAP.solids) {
    if (s.kind === 'wall') continue;
    if (x + 6 > s.x0 && x - 6 < s.x1 && on(s.y0)) return { kind: 'solid', y: s.y0, id: s.id };
  }
  for (let i = 0; i < MAP.oneway.length; i++) {
    const p = MAP.oneway[i];
    if (g.hz?.off?.[i]) continue;
    if ((b.collisionFilter.mask & onewayBit(i)) && x + 6 > p.x0 && x - 6 < p.x1 && on(p.y)) return { kind: 'oneway', y: p.y, index: i, id: p.id };
  }
  if (b.collisionFilter.mask & CAT.actor) for (const o of g.actors) {
    if (o === a || o.dead || o.knocked || !(o.body.collisionFilter.mask & CAT.actor)) continue;
    const top = o.body.position.y - HALF_H;
    if (Math.abs(o.body.position.x - x) < 13 && feet >= top - 3 && feet <= top + 6) return { kind: 'actor', y: top, id: null, actor: o.id };
  }
  const bodies = [];
  for (const p of g.props) if (!p.held && p.kind !== 'glass' && !p.body.isSensor) bodies.push(p.body);
  for (const dx of [-5, 5]) {
    const hits = Query.ray(bodies, { x: x + dx, y: feet - 2 }, { x: x + dx, y: feet + 6 }, 2);
    if (hits.length) return { kind: 'prop', y: feet, body: hits[0].body || hits[0].bodyA };
  }
  return null;
}

// Speed and jump with the feet it has left. The axolotl crawls on its belly as much as it walks:
// a lost foot only slows it a little.
function legState(a) {
  const legs = ['footF', 'footB'].filter(f => !a.severed.includes(f)).length;
  const broken = (a.broken.footF ? 1 : 0) + (a.broken.footB ? 1 : 0);
  if (a.type === 6) return { legs, broken, run: 0.88 ** (2 - legs), jump: 0.92 ** (2 - legs) };
  return { legs, broken, run: legs === 2 ? 1 : legs === 1 ? 0.62 : 0.32, jump: legs === 2 ? 1 : 0.8 };
}

// A rival slammed down by Nox's scythe hits the floor and bounces back up, still reeling; whoever
// slammed them gets the chase again.
function groundBounce(g, a) {
  a.bounceArm = 0;
  a.hitstun = Math.max(a.hitstun || 0, 0.5); a.hitstunMax = Math.max(a.hitstunMax || 0, a.hitstun);
  a.stun = Math.max(a.stun, 0.45);
  a.float = 0.25;
  g.fx('groundBounce', { x: a.x, y: a.y + FOOT });
  g.sound('thud', a.x);
  g.shake = Math.max(g.shake, 5);
  g.text(a.x, a.y - 30, 'QUICOU!', '#ffd36c');
  const by = g.actor(a.bounceBy);
  if (by && !by.dead) by.chase = { id: a.id, until: g.time + 1.2 };
  return -8.5 / weightOf(a);
}

function land(g, a, impact, height = 0) {
  a.landImpact = impact;
  a.landT = 0.18;
  if (impact > 5) g.fx('land', { x: a.x, y: a.y + FOOT, p: Math.min(1, impact / 16) });
  if (impact > 6.5) g.sound('land', a.x);
  const rolled = g.time - (a.dodgeAt ?? -9) < 0.22;
  if (rolled && impact > 8) {
    a.dodge = 0.3; a.dodgeKind = 'roll'; a.iframes = 0.12;
    if (height > 300) g.text(a.x, a.y - 28, 'ROLOU!', '#cfe3b8');
    return;
  }
  // Only real drops hurt: more than two levels measured from the apex.
  if (height > 300) {
    const recent = a.lastHit != null && g.time - (a.lastHitTime ?? -9) < 4 ? a.lastHit : a.id;
    const amount = (height - 300) * 0.24 + 4;
    const leg = Math.random() < 0.5 ? 'footF' : 'footB';
    damage(g, a, amount, { x: a.x, y: a.y + 14 }, recent, 'fall', { part: leg, kb: { x: 0, y: 0 } });
    if (!a.dead && height > 420) breakBone(g, a, leg);
    if (!a.dead && height > 480) knockdown(g, a, { velocity: { x: a.body.velocity.x, y: -2 }, time: 1.2 });
  }
}

// Held by a rival: in Nox's requiem.
const heldBy = (g, a) => g.actors.some(o => o !== a && o.act === 'requiem' && o.reqId === a.id);

export function stepActor(g, a, dt) {
  if (a.dead) {
    a.respawn -= dt;
    if (a.respawn <= 0) g.respawnActor(a);
    return;
  }
  const f = FIGHTERS[a.type];
  // Frozen in hitlag: hold still (gravity included), then get the velocity back.
  if (a.hitlag > 0 && !a.knocked) {
    a.hitlag -= dt;
    if (a.lagPos) Body.setPosition(a.body, a.lagPos);
    Body.setVelocity(a.body, { x: 0, y: 0 });
    if (a.hitlag <= 0) { a.hitlag = 0; if (a.lagVel) Body.setVelocity(a.body, a.lagVel); a.lagPos = null; a.lagVel = null; }
    return;
  }
  a.lagPos = null;
  if (a.bloodMark && g.time - (a.markT ?? -9) >= 5) a.bloodMark = 0;
  if (a.bounced && a.ground && !(a.hitstun > 0)) a.bounced = false;
  if (a.turnT && g.time >= a.turnT) { const o = g.actor(a.turnTo); if (o && !o.dead) a.face = o.x >= a.x ? 1 : -1; a.turnT = 0; }
  for (const k of TIMERS) a[k] = Math.max(0, (a[k] || 0) - dt);
  for (const k in a.drop) a.drop[k] = Math.max(0, a.drop[k] - dt);
  tickForm(g, a, dt);
  tickBelly(g, a, dt);
  tickAxolotl(g, a, dt);
  if (a.frozen > 0) {
    a.frozen -= dt;
    if (a.frozen <= 0) { a.frozen = 0; g.fx('shatter', { x: a.x, y: a.y, n: 6, small: true }); g.text(a.x, a.y - 28, 'DESCONGELOU', '#bdeeff'); }
  }
  a.tickSeq = g.seq;
  if (!a.knocked) tickAttack(g, a);
  if (a.dead) return;

  const queued = a.queued || {};
  const input = a.bot ? think(g, a, dt) : { ...a.input };
  // The moves read the held directions off a.input (S+J, side+J): a bot's are what it thinks.
  if (a.bot) a.input = input;
  if (!a.bot) for (const k of Object.keys(queued)) input[k] = true;
  a.queued = {};
  const pressed = k => input[k] && (!a.lastInput[k] || queued[k]);
  // Swallowed: carried inside the frog, only mashing to get out.
  if (a.swallowedBy != null) { stepSwallowed(g, a, input, pressed, dt); a.lastInput = { ...input }; return; }

  if (a.knocked) {
    a.knock -= dt;
    a.knockTime += dt;
    if (pressed('jump') || pressed('attack')) a.knock -= 0.16;
    const r = ragdollOf(g, a);
    const core = r?.limbs.body;
    a.restT = !core || core.body.speed < 2 ? (a.restT || 0) + dt : 0;
    if (a.knock <= 0 && a.frozen <= 0 && (a.restT > 0.2 || a.knockTime > 6)) recover(g, a);
    a.lastInput = { ...input };
    return;
  }

  const body = a.body;
  let vx = body.velocity.x, vy = body.velocity.y;
  const gi = groundInfo(g, a);
  const wasGround = a.ground;
  a.ground = !!gi && !a.climbing;
  a.groundInfo = gi;
  const { broken, run, jump } = legState(a);
  if (a.ground) {
    a.jumpGrace = 0.1;
    a.airJumps = 0;
    if (a.dodgeKind === 'airdash') { a.dodgeKind = null; a.dodge = 0; }
    a.airDodged = false;
    a.recUsed = false;
    if (!wasGround) {
      if (a.bounceArm && g.time - a.bounceArm < 1.5) { vy = groundBounce(g, a); a.ground = false; }
      else land(g, a, a.lastPreVy || 0, a.fallStart != null ? a.y - a.fallStart : 0);
    }
    a.fallStart = null;
    if (a.dead || a.knocked) return;
  }

  if (a.act && a.frozen <= 0) {
    const ov = stepSpecial(g, a, input, pressed, dt);
    if (ov && !a.dead && !a.knocked) {
      a.lastInput = { ...input };
      updateHolding(g, a);
      const v = body.velocity;
      Body.setVelocity(body, { x: ov.vx ?? v.x, y: ov.vy ?? v.y });
      a.gliding = false;
      updateMask(g, a, body.velocity.y);
      a.lastPreVy = body.velocity.y;
      return;
    }
    if (a.dead || a.knocked) return;
    vx = body.velocity.x; vy = body.velocity.y;
  }

  if (a.frozen > 0) {
    vx *= a.ground ? 0.995 : 0.999;
    Body.setVelocity(body, { x: vx, y: Math.min(vy, 15) });
    updateMask(g, a, vy);
    a.lastPreVy = vy;
    a.lastInput = { ...input };
    return;
  }

  const reeling = a.stun > 0 || a.hitstun > 0;
  const control = reeling ? 0.12 : a.shock > 0 ? 0.2 : 1;
  // Clones latched on a rival weigh them down; an axolotl with a clone in its mouth goes a little slower.
  let speed = speedOf(a) * run * (1 - broken * 0.22) * (1 - 0.1 * Math.min(3, a.latchN || 0)) * (a.axo?.carry != null ? 0.85 : 1);
  a.crouch = a.ground && input.down && !a.climbing;
  if (a.crouch) speed *= 0.45;
  const move = control > 0.5 && a.parryLag <= 0 ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  a.move = move;
  if (move && a.attack <= 0.12) a.face = move;

  // Aim used by shooting and by the animation layer.
  if (input.aimX !== null && input.aimX !== undefined) a.aim = Math.atan2(input.aimY - (a.y + 5), input.aimX - a.x);
  else if (input.padAim !== null && input.padAim !== undefined) a.aim = input.padAim;
  else a.aim = a.face > 0 ? 0 : Math.PI;

  const conveyor = g.hz?.conveyor;
  const sv = gi && gi.id === 'floorL' && conveyor && a.x > conveyor.x0 && a.x < conveyor.x1 ? conveyor.dir * conveyor.speed : 0;

  // Ladders
  const feet = body.position.y + HALF_H;
  const ladder = MAP.ladders.find(l => Math.abs(a.x - l.x) < 14 && feet > l.top - 6 && feet <= l.bottom + 2);
  if (a.climbing) {
    if (!ladder || (move && pressed('jump'))) {
      a.climbing = false;
      a.climbCd = 0.3;
      if (move && pressed('jump')) { vy = -8.5; vx = move * speed; a.jumpHeld = true; }
    } else {
      vy = input.jump ? -2.8 : input.down ? 2.6 : 0;
      vx = (ladder.x - a.x) * 0.2;
      if (feet <= ladder.top + 1 && input.jump) { a.climbing = false; a.climbCd = 0.3; vy = -4.2; }
      if (gi && input.down && feet >= ladder.bottom - 3) { a.climbing = false; a.climbCd = 0.3; }
    }
  } else if (ladder && a.climbCd <= 0 && control >= 1 && ((!gi && input.jump && vy > -5) || (gi && input.down && Math.abs(feet - ladder.top) < 7))) {
    a.climbing = true;
    a.ground = false;
    a.dodge = 0;
  }

  // Horizontal control
  if (!a.climbing) {
    const bolt = a.attack > 0 ? MOVES[a.attackKind]?.bolt : 0;
    if (bolt && a.attack > MOVES[a.attackKind].dur * 0.5) vx = a.face * bolt;
    else if (a.dodge > 0 && a.dodgeKind === 'roll') vx = a.dodgeDir * 8 + sv;
    else if (a.dodge > 0.06 && a.dodgeKind === 'airdash') vx = a.dodgeDir * 8.5;
    // Caught in the frog's inhale: the wind carries them; running against it only slows it down.
    else if (g.time - (a.inhaled ?? -9) < 0.05) { if (move) vx += move * speed * 0.18; }
    else if (a.ground) {
      const target = move * speed + sv;
      if (move) {
        const rel = vx - sv;
        const turning = Math.sign(rel) === -move && Math.abs(rel) > 0.6;
        if (Math.abs(rel) > speed + 0.2 && Math.sign(rel) === move) vx = approach(vx, target, speed / 12);
        else vx = approach(vx, target, (turning ? speed / 2.6 : speed / 5.5) * control);
        if (turning && Math.abs(rel) > 2.6) { a.skid = 0.14; if (Math.random() < 0.4) g.fx('dust', { x: a.x - move * 5, y: a.y + FOOT, n: 1 }); }
      } else vx = approach(vx, sv, reeling ? speed / 8 : speed / 3.6);
    } else {
      if (move) { if (Math.abs(vx) < speed || Math.sign(vx) !== move) vx = approach(vx, move * speed, (speed / 11) * control); }
      else vx *= 0.993;
    }
  }

  // Jump, drop-through and variable height
  if (pressed('jump')) a.jumpBuffer = 0.12;
  if (gi && gi.kind === 'oneway' && input.down && !a.climbing) {
    a.downHeld = (a.downHeld || 0) + dt;
    if (pressed('jump') || a.downHeld > 0.16) {
      a.drop[gi.index] = 0.32;
      a.jumpBuffer = 0;
      a.downHeld = 0;
      vy = 2.2;
      a.ground = false;
    }
  } else a.downHeld = 0;
  if (!a.climbing && a.jumpBuffer > 0 && control >= 1 && (a.jumpGrace > 0 || (a.airJumps > 0 && pressed('jump')))) {
    const doubleJump = a.jumpGrace <= 0;
    if (doubleJump) { a.airJumps--; vy = -9.6; g.fx('ring', { x: a.x, y: a.y + 24, size: 16, color: '#b8c8f0' }); }
    else { vy = -10.8 * jump * (a.form === 'titan' ? 0.86 : a.form ? 0.9 : 1) * (a.type === 5 ? (a.belly != null ? 0.94 : 1.08) : 1); g.fx('dust', { x: a.x, y: a.y + FOOT, n: a.form === 'titan' ? 9 : 5 }); }
    vx += sv * 0.5;
    a.jumpBuffer = 0; a.jumpGrace = 0; a.jumpHeld = true; a.ground = false; a.jumpAt = g.time;
    g.sound('jump', a.x);
  }
  if (a.climbing || vy < 0) a.fallStart = null;
  else if (!a.ground && a.fallStart == null) a.fallStart = a.y;
  a.gliding = false;
  if (!a.ground && !a.climbing) {
    let gm = 1;
    if (vy > 0) gm = input.down ? 1.9 : 1.22;
    if (a.float > 0 && vy > -1.5) gm *= 0.4;
    else if (vy > -2 && input.jump && a.jumpHeld) gm = 0.55;
    vy += GRAV * (gm - 1);
    vy = Math.min(vy, input.down ? 17.5 : 15);
    if (a.jumpHeld && !input.jump) { if (vy < -2.5) vy *= 0.48; a.jumpHeld = false; }
    if (vy > 0) a.jumpHeld = false;
    // A bat hovers through his air string instead of dropping out from under it.
    if (styleOf(a) === 4 && a.attack > 0 && (NOX_AIR.includes(a.attackKind) || a.attackKind === 'dAirClaw' || a.attackKind === 'dAirVortex')) vy = Math.min(vy, 0.35);
    // Lola hangs in the air while she lays her ring of knives.
    if (styleOf(a) === 2 && a.attack > 0 && a.attackKind === 'lAirRing') vy = Math.min(vy, -0.3);
    // Nox glides, scarf streaming, while jump is held on the way down.
    if (styleOf(a) === 4 && vy > 1.2 && input.jump && control >= 1) { vy = Math.min(vy, 1.7); a.gliding = true; }
  }

  // Shift: standing still it parries; with a direction it dodges (roll on the ground, dash in
  // the air, both through attacks). Rolling also smothers fire.
  // A fresh tap of a direction, for Nox's phantom reap branch.
  if (pressed('left') || pressed('right')) a.dirTap = g.time;
  // Reeling from a hit, Shift is a split second of parry: timed to the next blow it breaks the combo
  // (combat.js parried); missed, Shift does nothing for a while (no mashing out of a string).
  // Not out of a hold (the requiem): it has its own way out.
  if (pressed('dodge') && a.hitstun > 0 && !a.knocked && !(a.frozen > 0) && !(a.burstCd > 0) && !a.act && !heldBy(g, a)) {
    a.parry = BURST.window; a.burstCd = BURST.cd;
    g.fx('ring', { x: a.x, y: a.y, size: 20, color: '#c8f0ff' });
    g.sound('swing', a.x);
  }
  if (pressed('dodge') && control >= 1 && !a.climbing && a.parryLag <= 0 && !a.act) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (!dir && a.parryCd <= 0) {
      a.parry = 0.2; a.parryLag = 0.36; a.parryCd = 0.5;
      a.attack = 0; a.hits = null;
      g.sound('swing', a.x);
    } else if (dir && a.dodgeCd <= 0 && (a.ground || !a.airDodged)) {
      a.dodgeAt = g.time; a.dodgeCd = 0.55; a.burning = 0; a.perfect = false;
      a.dodgeDir = dir; a.face = dir;
      a.attack = 0; a.hits = null;
      if (a.ground) { a.dodge = 0.24; a.dodgeKind = 'roll'; a.iframes = 0.22; vx = dir * 8; }
      else { a.airDodged = true; a.dodge = 0.24; a.dodgeKind = 'airdash'; a.iframes = 0.2; vx = dir * 8.5; vy = Math.min(vy, -1); }
      g.fx('dash', { x: a.x, y: a.y, face: dir });
      g.sound('swing', a.x);
    }
  }
  if (a.dodge > 0.06 && a.dodgeKind === 'airdash') vy = Math.min(vy, 0.4);
  if (a.dodge <= 0) a.dodgeKind = null;
  if (a.parryLag > 0 && a.ground) vx *= 0.7;

  // Attacking out of a dodge cancels it into a dashing strike.
  if (pressed('attack') && a.dodge > 0 && (a.dodgeKind === 'roll' || a.dodgeKind === 'airdash') && control >= 1 && !a.weapon) { a.dodge = 0; a.dodgeKind = null; a.iframes = 0; a.dashStrike = true; a.attackCd = 0; }
  const canAct = control >= 1 && a.shock <= 0 && a.parryLag <= 0 && !(a.dodge > 0 && a.dodgeKind === 'roll');
  // While reeling from a hit, presses are dropped rather than buffered: no mashing out of it.
  if (pressed('attack') && !(a.hitstun > 0)) a.bufA = 0.22;
  if (pressed('power') && !(a.hitstun > 0)) a.bufP = 0.22;
  const was = [a.attackSeq, a.powerSeq, a.act];
  if ((input.attack || a.bufA > 0) && canAct) { const s = a.attackSeq; attack(g, a); if (a.attackSeq !== s) a.bufA = 0; }
  if (canAct && (a.bufP > 0 || (a.bot && input.power))) { const s = a.attackSeq, p = a.powerSeq; power(g, a); if (a.attackSeq !== s || a.powerSeq !== p) a.bufP = 0; }
  // A move or special that just started set its own velocity (steps, lunges, leaps): keep it.
  if (was[0] !== a.attackSeq || was[1] !== a.powerSeq || was[2] !== a.act) { vx = body.velocity.x; vy = body.velocity.y; }
  if (pressed('grab') && canAct && !axoGrab(g, a)) interact(g, a);
  // Trapped in a bubble: every press wears it thinner.
  if (a.bubbled > 0 && (pressed('attack') || pressed('jump'))) a.bubbled -= 0.12;
  if (pressed('bats') && canAct && styleOf(a) === 4 && !(a.batCd > 0) && !a.act && !a.climbing) startSwarm(g, a);
  if (pressed('drop')) dropWeapon(g, a);
  if (pressed('detonate')) detonateCharges(g, a);
  a.lastInput = { ...input };
  if (a.dead || a.knocked) return;
  updateHolding(g, a);
  tickTitan(g, a);

  Body.setVelocity(body, { x: vx, y: vy });
  updateMask(g, a, vy);
  a.lastPreVy = vy;
}

const GHOST_ACTS = ['chase', 'plunge', 'requiem', 'swarm', 'charge', 'leap', 'meteor', 'blink', 'world', 'frenzy'];
function updateMask(g, a, vy) {
  const b = a.body;
  let mask = MASK.actor;
  if (a.ghostClear && !g.actors.some(o => o !== a && !o.dead && !o.knocked && o.swallowedBy == null && Math.abs(o.body.position.x - b.position.x) < 16 && Math.abs(o.body.position.y - b.position.y) < HALF_H * 2)) a.ghostClear = false;
  if (a.ghostClear || a.dodge > 0 || GHOST_ACTS.includes(a.act) || (a.attack > 0 && MOVES[a.attackKind]?.pass)) mask &= ~CAT.actor;
  if (!a.climbing) {
    const feet = b.position.y + HALF_H;
    for (let i = 0; i < MAP.oneway.length; i++) {
      if (a.drop[i] > 0) continue;
      if (feet <= MAP.oneway[i].y + 3) mask |= onewayBit(i);
    }
  }
  b.collisionFilter.mask = mask;
}

export function syncActor(g, a) {
  if (a.dead) return;
  if (a.knocked) {
    const r = ragdollOf(g, a);
    const core = r?.limbs.body || (r && Object.values(r.limbs)[0]);
    if (core) { a.x = core.body.position.x; a.y = core.body.position.y; a.vx = core.body.velocity.x; a.vy = core.body.velocity.y; }
    return;
  }
  a.x = a.body.position.x;
  a.y = a.body.position.y;
  a.vx = a.body.velocity.x;
  a.vy = a.body.velocity.y;
  a.x = clamp(a.x, -20, 980);
  // Sunk into a solid floor by a fast landing: put the feet back on top of it.
  const feet = a.body.position.y + HALF_H;
  for (const s of MAP.solids) {
    if (s.kind === 'wall' || a.x + 6 <= s.x0 || a.x - 6 >= s.x1) continue;
    if (feet > s.y0 + 1 && feet < s.y0 + HALF_H * 2 && (a.prevFeet ?? feet) <= s.y0 + 8) {
      Body.setPosition(a.body, { x: a.body.position.x, y: s.y0 - HALF_H });
      Body.setVelocity(a.body, { x: a.body.velocity.x, y: Math.min(0, a.body.velocity.y) });
      a.y = a.body.position.y;
    }
  }
  a.prevFeet = a.body.position.y + HALF_H;
}
