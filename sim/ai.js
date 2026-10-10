import { EMPTY_INPUT } from '../engine/input.js';
import { MAP, pathTo } from './map.js';
import { inPit, Query } from './physics.js';
import { rnd, dist, clamp } from '../engine/const.js';
import { FOOT, HALF_H } from '../render/rig.js';
import { MOVES, DARK, POOL, KINGDOM, comboOf } from './moves.js';
import { styleOf } from './fighters.js';
import { courtStrikeSoon } from './court.js';
import { ownKingdom, canPlant } from './kingdom.js';
import { MELEE, isMelee } from './weapons.js';
import { minionsOf, adultsOf, targetable } from './minions.js';

const RANGED = a => a.weapon === 'pistol' || a.weapon === 'shotgun';

// The nearest standing kingdom of a rival's.
function rivalKingdom(g, a) {
  let best = null, bd = Infinity;
  for (const k of g.kingdoms || []) {
    if (k.st === 'fall' || k.team === a.team) continue;
    const d = Math.hypot(k.x - a.x, k.y - (a.y + HALF_H));
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// When each special is worth firing, given the gap to the target.
const SPECIAL_RANGE = [
  // The Cat King: his banner has its own rules (think, below).
  () => false,
  (dx, dy) => Math.abs(dx) < 220 && Math.abs(dy) < 24,
  // Lola stops time whenever a rival is in reach of her knives (it charges slowly anyway).
  (dx, dy) => Math.abs(dx) < 280 && Math.abs(dy) < 150,
  // Juma: small, the frenzy at a rival a few steps ahead; the beast leaps at rivals a little away;
  // the titan grabs whoever is in arm's reach, or claps at whoever is in front.
  (dx, dy, a) => (a.form === 'titan' ? Math.abs(dx) < 200 && Math.abs(dy) < 40 : a.form === 'beast' ? Math.abs(dx) > 50 && Math.abs(dx) < 220 && Math.abs(dy) < 90 : Math.abs(dx) > 16 && Math.abs(dx) < 110 && Math.abs(dy) < 24),
  // Nox: with his blood full, DARK NOX when the fight is close. As DARK NOX (or as the frog that
  // swallowed him), the blood beam: level along the floor, or down and ahead (about 30 degrees) from
  // the air (the requiem by a rival with 3 marks).
  (dx, dy, a, t, g) => a.form !== 'dark' && a.type === 4 ? (a.blood || 0) >= DARK.max && Math.abs(dx) < 220 && Math.abs(dy) < 90
    : t && t.bloodMark >= 3 && g.time - (t.markT ?? -9) < 5 ? Math.abs(dx) < 100 && Math.abs(dy) < 50 : a.ground ? Math.abs(dx) > 30 && Math.abs(dx) < 320 && Math.abs(dy) < 16 : Math.abs(dx) < 300 && Math.abs(dy - Math.abs(dx) * 0.61) < 18,
  // The frog breathes in at a rival a few steps ahead, level with his mouth.
  (dx, dy) => Math.abs(dx) > 12 && Math.abs(dx) < 105 && Math.abs(dy) < 24,
  // The axolotl awakens its brood when it has two clones or more (or is in trouble) and a rival is
  // around; alone (or as the frog's borrowed style) it bites with the maw from up close.
  (dx, dy, a, t, g) => {
    const n = a.type === 6 ? minionsOf(g, a).length : 0;
    return n ? (n >= 2 || a.hp < 50) && Math.abs(dx) < 220 && Math.abs(dy) < 80 : Math.abs(dx) > 10 && Math.abs(dx) < 40 && Math.abs(dy) < 24;
  }
];

export function nodeAt(g, x, feetY) {
  let best = null;
  for (const n of g.nav.nodes) {
    if (x < n.x0 - 14 || x > n.x1 + 14) continue;
    if (n.y < feetY - 6) continue;
    if (!best || n.y < best.y) best = n;
  }
  return best;
}

function currentNode(g, a) {
  if (a.ground && a.groundInfo?.id) return g.nav.nodes.find(n => n.id === a.groundInfo.id) || null;
  if (a.ground) return nodeAt(g, a.x, a.y + FOOT);
  return null;
}

// A roll covers ~70 units: only roll if it ends on the same surface and away from the pit.
function safeRoll(g, a, dir) {
  const node = currentNode(g, a);
  const nx = a.x + dir * 75;
  if (!node || nx < node.x0 || nx > node.x1) return false;
  return !(nx > MAP.pit.x0 - 24 && nx < MAP.pit.x1 + 24);
}

function steer(input, a, x, tol = 6) {
  input.left = x < a.x - tol;
  input.right = x > a.x + tol;
}

export function think(g, a, dt) {
  const input = EMPTY_INPUT();
  if (g.mode === 'sandbox') return input;
  const ai = (a.ai ||= { path: null, from: null, to: null, edge: null, airborne: false, stuck: 0, lastX: a.x, wait: rnd(0, 0.4), grabCd: 2, panicDir: 1 });
  ai.wait -= dt;
  ai.grabCd -= dt;
  // Inside the frog: hammer every button to get out (a bot mashes about eight times a second).
  if (a.swallowedBy != null) {
    const k = ['attack', 'jump', 'power'][Math.floor(Math.random() * 3)];
    if (Math.random() < 0.28) input[k] = !a.lastInput[k];
    return input;
  }
  // The Cat King, or the frog with him (and so his court) in his belly: they fight the King's way.
  const reign = a.type === 0 || !!a.court;

  if (a.burning > 0) {
    if (Math.random() < 0.02) ai.panicDir *= -1;
    steer(input, a, a.x + ai.panicDir * 100);
    input.dodge = Math.random() < 0.06 && safeRoll(g, a, ai.panicDir);
    if (a.ground && Math.random() < 0.05) input.jump = true;
    return input;
  }

  let target = g.closest(a);
  const ranged = RANGED(a);
  // A rival's kingdom (a Cat King's banner, house or castle) is a goal of its own: when nobody is in the
  // way, when it is right there on this floor, or much closer than any rival; never while a rival is
  // on top of the bot. Once on it, a second at least before letting go.
  ai.aimAt = null;
  const ek = rivalKingdom(g, a);
  if (ek) {
    const dR = target ? dist(a, target) : Infinity, dS = Math.hypot(ek.x - a.x, ek.y - (a.y + HALF_H));
    const threat = target && ((target.attack > 0 && dR < 90) || (a.blowBy === target.id && g.time - (a.blowT ?? -9) < 1.2 && dR < 150));
    // (a downed or untouchable rival right there is still the one to go for: to pick up, or to wait on)
    const want = !target || ((target.knocked || target.invincible > 0) && dS < 220 && dR > 40) || (currentNode(g, a)?.id === ek.node && dS < 140 && dR > 160) || dS < 0.4 * dR;
    if (want && !threat) { if (ai.goalKg !== ek.id) { ai.goalKg = ek.id; ai.goalT = g.time + 1; } }
    else if (threat || g.time >= (ai.goalT ?? 0)) ai.goalKg = null;
  } else ai.goalKg = null;
  const goal = ai.goalKg != null ? g.kingdoms.find(k => k.id === ai.goalKg && k.st !== 'fall') : null;
  if (goal) {
    target = { x: goal.x, y: goal.y - HALF_H, knocked: false, ground: true, stun: 0, hitstun: 0, invincible: 0, id: null, kg: goal, hw: KINGDOM.w[goal.lv] / 2 };
    if (ranged) ai.aimAt = { x: goal.x, y: goal.y - KINGDOM.h[goal.lv] / 2 };
  }
  if (!target) return input;
  const dx = target.x - a.x, dy = target.y - a.y;

  const mine = currentNode(g, a);
  const theirs = target.knocked ? nodeAt(g, target.x, target.y + 6) : nodeAt(g, target.x, target.y + FOOT);
  // (a kingdom is only shot at with nothing solid in the way; else the bot goes there)
  const lineOk = !target.kg || !ai.aimAt || !Query.ray(g.staticBodies, { x: a.x, y: a.y + 5 }, ai.aimAt, 1).length;
  const clearShot = ranged && Math.abs(dy) < 160 && lineOk;
  let moveTo = null;

  if (!a.ground && ai.airborne && ai.edge) {
    // Keep the jump held to the apex and steer to the landing spot.
    input.jump = a.vy < 0;
    const land = ai.edge.type === 'drop' ? ai.dropX ?? a.x : ai.edge.land ?? clamp(a.x, ai.edge.x0 ?? a.x, ai.edge.x1 ?? a.x);
    steer(input, a, land, 4);
  } else {
    if (a.ground) ai.airborne = false;
    if (mine && theirs && mine.id !== theirs.id && !clearShot) {
      if (ai.from !== mine.id || ai.to !== theirs.id || !ai.path) {
        ai.path = pathTo(g.nav, mine.id, theirs.id);
        ai.from = mine.id; ai.to = theirs.id; ai.stuck = 0;
      }
      const e = ai.path?.[0];
      ai.edge = e;
      if (e) {
        if (e.type === 'up') {
          const tx = clamp(a.x, e.x0, e.x1);
          moveTo = tx;
          if (Math.abs(a.x - tx) < 14 && a.ground) { input.jump = true; ai.airborne = true; }
        } else if (e.type === 'drop') {
          const tx = clamp(a.x, e.x0, e.x1);
          moveTo = tx;
          const prop = a.ground && a.groundInfo?.kind === 'prop' ? a.groundInfo.body?.bounds : null;
          if (prop && mine) {
            // Down+jump drops through the platform, not through a prop lying on it (one the bot cannot
            // pick up): step off it first, to the side with room on this platform.
            const l = prop.min.x - 12, r = prop.max.x + 12;
            moveTo = r > mine.x1 || (l >= mine.x0 && a.x - l <= r - a.x) ? l : r;
          } else if (Math.abs(a.x - tx) < 14 && a.ground) { input.down = true; input.jump = !a.lastInput.jump; ai.airborne = true; ai.dropX = tx; }
        } else if (e.type === 'fall') {
          moveTo = e.edge + e.dir * 30;
        } else if (e.type === 'leap') {
          const along = (a.x - e.takeoff) * e.dir;
          const atTakeoff = along > -12 && along < 30;
          moveTo = atTakeoff ? e.land : e.takeoff;
          if (atTakeoff && a.ground) { input.jump = true; ai.airborne = true; steer(input, a, e.land, 0); }
        }
      }
    } else {
      ai.path = null;
      ai.edge = null;
      // The Cat King keeps a few steps back and lets his court go in; a kingdom is struck at its wall.
      const desired = target.kg ? (reign ? target.hw + 46 : ranged ? 210 : target.hw + 6) : ranged ? 210 : reign ? 46 : 16;
      if (Math.abs(dx) > desired) moveTo = target.x;
      else if (ranged && Math.abs(dx) < 110) moveTo = a.x - Math.sign(dx || 1) * 90;
      if (mine && moveTo !== null) moveTo = clamp(moveTo, mine.x0, mine.x1);
    }
  }

  // Unarmed with a blade on the floor nearby and nobody in its face: go and grab it.
  if (!reign && !(a.type === 4 && a.form === 'dark') && !a.weapon && !a.holding && !a.act && a.ground && Math.abs(dx) > 60) {
    const loot = g.props.filter(p => !p.held && MELEE.includes(p.kind) && Math.abs(p.y - a.y) < 34 && Math.abs(p.x - a.x) < 240).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    if (loot && (!mine || (loot.x > mine.x0 - 6 && loot.x < mine.x1 + 6))) {
      moveTo = loot.x;
      if (Math.abs(loot.x - a.x) < 26 && ai.grabCd <= 0) { input.grab = true; ai.grabCd = 1.5; }
    }
  }

  // Nox, thirsty and with nobody in his face: off to drink a pool of blood on his floor.
  if (a.type === 4 && a.form !== 'dark' && (a.blood || 0) < DARK.max && !a.act && a.ground && Math.hypot(dx, dy) > 120 && g.pools?.length) {
    const feet = a.y + FOOT;
    const pool = g.pools.filter(p => p.amt > 2 && Math.abs(p.y - feet) < 6 && Math.abs(p.x - a.x) < 260 && (!mine || (p.x > mine.x0 - 4 && p.x < mine.x1 + 4)) && !inPit(p.x))
      .sort((p, q) => q.amt / (40 + Math.abs(q.x - a.x)) - p.amt / (40 + Math.abs(p.x - a.x)))[0];
    if (pool && Math.abs(pool.x - a.x) > POOL.reach * 0.5) moveTo = pool.x;
  }

  // The Cat King without a kingdom, his banner ready: to the nearest place it may go. With one below the
  // castle: home, so his court stands in its aura (unless a rival is near).
  if (reign && a.ground && !a.act && !target.kg && dist(a, target) > 200) {
    const kg = ownKingdom(g, a);
    if (!kg && a.abilityCd <= 1) { const c = canPlant(g, a); if (!c.ok && c.near != null) moveTo = c.near; }
    else if (kg && kg.lv < 3 && mine?.id === kg.node) {
      // Home (all the way to the door once he sets off), and he stays there.
      if (Math.abs(a.x - kg.x) > 100) ai.home = true;
      if (ai.home && Math.abs(a.x - kg.x) < 30) ai.home = false;
      moveTo = ai.home ? kg.x : null;
    }
  } else ai.home = false;
  // Hurt and with nobody close: a fish on this floor.
  if (a.ground && !a.act && a.hp < a.maxHp * 0.7 && g.fish?.length && !(reign && ownKingdom(g, a)) && (!target || target.kg || dist(a, target) > 140)) {
    const f = g.fish.filter(f => mine && f.node === mine.id && Math.abs(f.x - a.x) < 120).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    if (f) moveTo = f.x;
  }

  // Hazard avoidance overrides the plan.
  if (MAP.id === 'depot') {
    const P = MAP.press, pr = g.hz.press;
    if ((pr.state === 'warn' || pr.state === 'slam') && a.x > P.x0 - 24 && a.x < P.x1 + 24 && a.y > 400) moveTo = P.x0 - 70;
    const end = g.hz.cable.segs[g.hz.cable.segs.length - 1].position;
    if (Math.hypot(end.x - a.x, end.y - a.y) < 46) {
      moveTo = a.x + Math.sign(a.x - end.x || 1) * 60;
      // Cornered between the wall and the live cable: jump over it instead.
      if (moveTo < 24) { moveTo = end.x + 70; if (a.ground) input.jump = true; }
    }
    // Out of the live puddle by the side that has room (the left edge is against the wall).
    if (g.hz.puddle.live && a.ground && a.x > MAP.puddle.x0 - 10 && a.x < MAP.puddle.x1 + 10 && a.y > 440) moveTo = a.x < (MAP.puddle.x0 + MAP.puddle.x1) / 2 && MAP.puddle.x0 - 30 > 20 ? MAP.puddle.x0 - 30 : MAP.puddle.x1 + 30;
  } else if (MAP.id === 'castle') {
    // Out from under a pendulum's sweep: wait at the side for the blade to pass.
    for (const p of g.hz.pend) {
      const bx = p.x + Math.sin(p.ang) * p.len, by = p.y + Math.cos(p.ang) * p.len;
      if (Math.abs(a.y - by) < 30 && Math.abs(a.x - p.x) < 130 && Math.abs(a.x - bx) < 70 && Math.sign(p.w) === Math.sign(a.x - bx)) moveTo = a.x + Math.sign(a.x - bx || 1) * 40;
    }
  }

  if (moveTo !== null && !(ai.airborne && !a.ground)) steer(input, a, moveTo);
  // Never drift into the shredder: when falling near the pit without a planned leap, steer to the closer lip.
  const pit = MAP.pit;
  if (!a.ground && !(ai.airborne && ai.edge?.type === 'leap') && a.x > pit.x0 - 30 && a.x < pit.x1 + 30 && a.vy > -2 && a.y < MAP.floorY) {
    steer(input, a, a.x < (pit.x0 + pit.x1) / 2 ? pit.x0 - 34 : pit.x1 + 34, 2);
  }

  // On a ladder: keep climbing toward the rival, or step off at the bottom.
  if (a.climbing) { if (dy < -12) input.jump = true; else input.down = true; }
  // Standing on a head, or someone standing on ours: step off to the side.
  if (a.groundInfo?.kind === 'actor' || (a.ground && Math.abs(dx) < 12 && dy < -20 && dy > -50)) {
    ai.offDir ||= Math.random() < 0.5 ? -1 : 1;
    steer(input, a, a.x + ai.offDir * 60);
    if (a.groundInfo?.kind === 'actor') input.jump = !a.lastInput.jump;
  } else ai.offDir = 0;
  // A route step that has not worked for a while is dropped and the bot wanders a moment.
  if (ai.edge && ai.edge === ai.lastEdge) ai.edgeT = (ai.edgeT || 0) + dt; else ai.edgeT = 0;
  ai.lastEdge = ai.edge;
  if (ai.edgeT > 4) { ai.path = null; ai.edge = null; ai.edgeT = 0; ai.wander = 1.2; ai.wanderX = a.x + (Math.random() < 0.5 ? -1 : 1) * 90; }
  if (ai.wander > 0) { ai.wander -= dt; steer(input, a, ai.wanderX); }

  // Unstick: hop when pushing against something without moving.
  if (a.ground && (input.left || input.right) && Math.abs(a.x - ai.lastX) < 0.3) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt);
  ai.lastX = a.x;
  if (ai.stuck > 0.35 && ai.wait <= 0) { input.jump = true; ai.wait = rnd(0.25, 0.6); ai.airborne = false; }
  if (ai.stuck > 2.5) { ai.path = null; ai.stuck = 0; }

  // Combat. aimed: a direction held on purpose with an attack (a directional move).
  let aimed = false;
  {
    // As DARK NOX his scythe strikes a step further than his claws reach.
    const natural = MOVES[comboOf(a)[0]].range + (a.form === 'dark' ? 18 : 0) + 4;
    const armed = isMelee(a.weapon);
    const meleeRange = a.weapon === 'extinguisher' ? 110 : armed ? MOVES[a.weapon + ':nLight'].range + 4 : natural;
    const facing = dx * a.face >= -4;
    const reachX = target.kg ? target.hw + meleeRange - 4 : meleeRange;
    input.attack = ranged ? Math.abs(dy) < 230 && Math.abs(dx) < 650 && lineOk : Math.abs(dy) < 24 && Math.abs(dx) < reachX && facing && !target.knocked;
    if (target.kg && reign) input.attack = Math.abs(dx) < target.hw + 100 && Math.abs(dy) < 40 && facing;
    input.power = target.kg ? false : armed ? Math.abs(dy) < 26 && Math.abs(dx) < meleeRange + 10 && facing && Math.random() < 0.06 : a.abilityCd <= 0 && !a.act && !target.knocked && facing && SPECIAL_RANGE[styleOf(a)](dx, dy, a, target, g);
    // The Cat King: the banner when nobody is on top of him and it may go here; with his kingdom standing,
    // home when it is under attack and he is far from it.
    if (reign) {
      const kg = ownKingdom(g, a), near = (r, ry) => g.enemies(a).some(b => !b.dead && Math.abs(b.x - a.x) < r && Math.abs(b.y - a.y) < ry);
      if (!kg) input.power = a.abilityCd <= 0 && !a.act && a.ground && !input.jump && !near(120, 80) && canPlant(g, a).ok;
      else input.power = !target.kg && a.abilityCd <= 0 && !a.act && a.ground && !input.jump && g.time - kg.hitT < 1.5 && Math.hypot(a.x - kg.x, a.y + HALF_H - kg.y) > 260 && !near(140, 90);
    }
    // With a weapon, mix in the directional lights now and then: side to lunge in, down to lift.
    if (armed && input.attack && a.ground && Math.random() < 0.25) { aimed = true; if (Math.abs(dx) > meleeRange * 0.6) { input.right = dx > 0; input.left = dx < 0; } else input.down = Math.random() < 0.4; }
    // Follow a launched rival into the air and keep the combo going.
    if (!target.ground && !target.knocked && (target.stun > 0 || target.hitstun > 0) && Math.abs(dx) < 40 && dy < -6 && dy > -90) {
      if (a.ground) input.jump = true;
      input.attack = Math.abs(dy) < 30;
    }
    // The frog: keeps breathing in while a rival is still in front of him; with someone inside, uses
    // their special when it fits (S+K), and spits them at whoever is in line before they break out.
    if (a.type === 5 && !armed) {
      const inLine = facing && Math.abs(dy) < 22 && Math.abs(dx) < 240;
      if (a.act === 'inhale') input.power = facing && Math.abs(dx) < 130 && Math.abs(dy) < 40;
      // With the King inside he keeps him (and the court) for as long as he can: the banner or the way
      // home on S+K when they fit, and the King spat out only just before he breaks free.
      else if (a.belly != null && !a.act && a.court) {
        if (input.power) { aimed = true; input.down = true; }
        else input.power = inLine && !target.knocked && a.bellyT < 1.2;
      } else if (a.belly != null && !a.act) {
        const own = a.copy != null && a.abilityCd <= 0 && SPECIAL_RANGE[a.copy](dx, dy, a, target, g);
        if (own && Math.random() < 0.08) { aimed = true; input.power = true; input.down = true; }
        else input.power = inLine && !target.knocked && (a.bellyT < 2.5 || Math.random() < 0.006);
      }
    }
    // Nox closes long gaps as a swarm of bats.
    if (styleOf(a) === 4 && !a.act && !(a.batCd > 0) && Math.hypot(dx, dy) > 110 && Math.hypot(dx, dy) < 320 && Math.random() < 0.015) input.bats = true;
    // Nox opens with the shadow cut from a few steps away.
    if (styleOf(a) === 4 && a.ground && !a.act && !a.weapon && Math.abs(dx) > 28 && Math.abs(dx) < (a.form === 'dark' ? 96 : 64) && Math.abs(dy) < 16 && Math.random() < 0.05) { aimed = true; input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
    // The Cat King: from a distance, the rain of arrows now and then; a few steps off, the charge.
    if (reign && a.ground && !a.act && Math.abs(dy) < 40 && !target.knocked) {
      if (Math.abs(dx) > 100 && Math.abs(dx) < 210 && Math.random() < 0.015) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
      else if (Math.abs(dx) > 60 && Math.abs(dx) < 120 && Math.random() < 0.02) { aimed = true; input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
    }
    // Juma, small: the lightning pounce from a few steps away, the bite up close.
    // The beast: the charge from further off, the earthquake when rivals crowd her.
    if (styleOf(a) === 3 && a.ground && !a.act && !a.weapon && Math.abs(dy) < 18 && !target.knocked) {
      const crowd = g.enemies(a).filter(b => !b.dead && !b.knocked && Math.abs(b.x - a.x) < 90 && Math.abs(b.y - a.y) < 30).length;
      if (a.form) {
        if (!(a.chargeCd > 0) && Math.abs(dx) > 50 && Math.abs(dx) < (a.form === 'titan' ? 200 : 140) && Math.random() < 0.03) { aimed = true; input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
        else if ((crowd >= 2 || Math.abs(dx) < 40) && a.comboTimer <= 0 && Math.random() < 0.03) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
      } else if (Math.abs(dx) > 30 && Math.abs(dx) < 66 && Math.random() < 0.05) { aimed = true; input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
      else if (Math.abs(dx) < 28 && !(a.biteCd > 0) && a.comboTimer <= 0 && Math.random() < 0.03) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
      // Small Juma, mid-string: a fresh tap toward the rival for the cross now and then.
      else if (a.comboTimer > 0 && Math.abs(dx) < 50 && Math.random() < 0.06) { aimed = true; input.attack = !a.lastInput.attack; if (!a.lastInput.left && !a.lastInput.right) { input.right = dx > 0; input.left = dx < 0; } }
    }
    // The axolotl: plants clones when it has room and nobody is on it, blows bubbles at rivals above,
    // slides in from a few steps away, ends strings with the tidal bore, feasts on a downed rival,
    // fires a clone at a rival further off, and sets its demons off near the end of the awakening.
    if (a.type === 6 && !armed && !a.act) {
      const ax = a.axo, near = g.enemies(a).some(b => !b.dead && Math.hypot(b.x - a.x, b.y - a.y) < 70);
      const brood = minionsOf(g, a).length;
      if (ax.carry != null) { ai.carryT = (ai.carryT || 0) + dt; if (ai.carryT > 0.25 && facing && Math.abs(dy) < 30) { input.attack = !a.lastInput.attack; aimed = true; ai.carryT = 0; } }
      else if (g.time >= ax.shedReady && brood < 2 && a.hp > 35 && a.ground && ((!near && Math.random() < 0.02) || (a.attackKind === 'xTail' && a.comboTimer > 0 && !a.hits?.length && Math.random() < 0.3))) { aimed = true; input.power = true; input.down = true; }
      else if (a.ground && a.comboTimer <= 0 && dy < -30 && dy > -90 && dx * a.face > 40 && dx * a.face < 110 && Math.random() < 0.04) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
      else if (a.ground && target.knocked && Math.abs(dx) < 40 && Math.abs(dy) < 36 && Math.random() < 0.12) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
      else if (a.ground && a.comboTimer <= 0 && Math.abs(dx) > 30 && Math.abs(dx) < 66 && Math.abs(dy) < 18 && !target.knocked && Math.random() < 0.04) { aimed = true; input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
      else if (a.comboTimer > 0 && a.attackKind === 'xGulp' && Math.abs(dx) < 50 && Math.random() < 0.1) { aimed = true; input.attack = !a.lastInput.attack; if (!a.lastInput.left && !a.lastInput.right) { input.right = dx > 0; input.left = dx < 0; } }
      else if (a.ground && Math.abs(dx) > 70 && Math.abs(dx) < 200 && Math.abs(dy) < 24 && ai.grabCd <= 0 && Math.random() < 0.01 && adultsOf(g, a).some(m => Math.abs(m.x - a.x) < 20 && Math.abs(m.y - a.y) < 20)) { input.grab = true; ai.grabCd = 1; ai.carryT = 0; }
      if (ax.demon && g.time - ax.demon.at > 4.5 && g.minions.some(m => m.owner === a.id && m.kind === 'demon' && Math.hypot(m.x - target.x, m.y - target.y) < 40)) input.power = !a.lastInput.power;
    }
    // Lola skips through time to a rival a few steps off, and cuts low up close now and then.
    if (styleOf(a) === 2 && a.ground && !a.act && !a.weapon && Math.abs(dy) < 30 && !target.knocked) {
      if (!(a.skipCd > 0) && Math.abs(dx) > 50 && Math.abs(dx) < 160 && Math.random() < 0.04) { aimed = true; input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
      else if (Math.abs(dx) < 30 && a.comboTimer <= 0 && Math.random() < 0.02) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
    }
    // Inside her strings Lola lays knives now and then: the rain (S+J), the wall (a fresh tap of a
    // direction + J, and J again skips her back in) and, in the air, the ring. One roll of the dice
    // per blow; a tap needs the direction let go for a frame first.
    if (styleOf(a) === 2 && !a.act && !a.weapon && !target.knocked) {
      const lp = (ai.lola ||= {});
      if (!lp.plan && a.comboTimer > 0 && a.attack <= 0.1 && !(a.setCd > 0) && a.attackSeq !== lp.seq) {
        lp.seq = a.attackSeq;
        const r = Math.random();
        if (a.ground && (a.attackKind === 'lCutB' || a.attackKind === 'lDance')) lp.plan = r < 0.3 ? 'rain' : r < 0.55 ? 'wall' : null;
        else if (!a.ground && (a.attackKind === 'lAirCut' || a.attackKind === 'lAirSpin')) lp.plan = r < 0.35 ? 'ring' : null;
        lp.let = false;
      }
      if (lp.plan && (a.comboTimer <= 0 || a.setCd > 0 || (lp.plan === 'ring') === a.ground)) lp.plan = null;
      if (lp.plan) aimed = true;
      if (lp.plan === 'rain') { input.down = true; input.attack = true; input.left = false; input.right = false; }
      else if (lp.plan) {
        if (!lp.let || a.attackCd > 0) { input.left = false; input.right = false; input.attack = false; lp.let = true; }
        else { const dir = Math.sign(dx) || a.face; input.right = dir > 0; input.left = dir < 0; input.attack = true; }
      }
      if (a.attackKind === 'lFan' && a.comboTimer > 0 && Math.hypot(dx, dy) < 160) input.attack = true;
    }
    // A rival's clone in reach when no fighter is: swat it. A clone latched on: shake it off.
    if (!armed && !input.attack && a.ground && Math.random() < 0.08 && g.minions.some(m => m.team !== a.team && targetable(m) && (m.x - a.x) * a.face > -4 && (m.x - a.x) * a.face < natural && Math.abs(m.y - a.y) < 24)) input.attack = true;
    if ((a.latchN || 0) > 0 && a.dodgeCd <= 0 && Math.random() < 0.04) input.dodge = true;
    // Close the gap with a roll that turns into a dashing strike.
    if (a.ground && !a.act && !a.weapon && a.dodgeCd <= 0 && Math.abs(dx) > 44 && Math.abs(dx) < 95 && Math.abs(dy) < 20 && Math.random() < 0.03 && safeRoll(g, a, Math.sign(dx))) {
      input.dodge = true; input.right = dx > 0; input.left = dx < 0;
    }
    if (a.dodge > 0 && a.dodgeKind === 'roll' && Math.abs(dx) < 50) input.attack = !a.lastInput.attack;
    // Stomp on heads from above: a rival on their feet and out of a combo, and only where the drop
    // straight down is safe (not into the pit, not under the press).
    const safeDrop = !inPit(a.x) && Math.abs(a.x - (MAP.pit.x0 + MAP.pit.x1) / 2) > (MAP.pit.x1 - MAP.pit.x0) / 2 + 30
      && !(MAP.press && a.x > MAP.press.x0 - 16 && a.x < MAP.press.x1 + 16);
    if (!a.ground && !a.act && !target.knocked && a.comboTimer <= 0 && !(target.hitstun > 0) && safeDrop && Math.abs(dx) < 12 && dy > 12 && dy < 120 && a.vy > -2) { aimed = true; input.down = true; input.attack = true; }
    // The titan hammers a downed rival into the floor.
    if (a.type === 3 && a.form === 'titan' && a.ground && !a.act && target.knocked && Math.abs(dx) < 44 && Math.abs(dy) < 40 && Math.random() < 0.1) { aimed = true; input.attack = !a.lastInput.attack; input.down = true; }
    // Pick up a downed rival and throw them.
    if (a.act === 'carry') {
      ai.carryT = (ai.carryT || 0) + dt;
      if (ai.carryT > 0.5) { input.attack = true; ai.carryT = 0; }
    } else if (target.knocked && dist(a, target) < 30 && ai.grabCd <= 0) { input.grab = true; ai.grabCd = 2; }
    if (a.holding && Math.abs(dy) < 80 && Math.abs(dx) < 320 && ai.grabCd <= 0) { input.grab = true; ai.grabCd = 1; }
    if (!a.weapon && !a.holding && !a.act && ai.grabCd <= 0) {
      const noArms = reign || (a.type === 4 && a.form === 'dark');
      const item = g.props.find(p => !p.held && (noArms ? ['crate'] : ['gun', 'crate', 'extinguisher', ...MELEE]).includes(p.kind) && dist(a, p) < 34 && Math.abs(p.y - a.y) < 30);
      if (item) { input.grab = true; ai.grabCd = 3; }
    }
    // Shoot the barrel next to the target.
    if (ranged) {
      const barrel = g.props.find(p => (p.kind === 'barrel' || p.kind === 'propane') && dist(p, target) < 70 && dist(p, a) > 160);
      if (barrel) { input.aimX = barrel.x; input.aimY = barrel.y; input.attack = true; }
    }
  }

  // Caught in a string: now and then a bot times Shift to the next blow and breaks out of it.
  if (a.hitstun > 0 && !(a.burstCd > 0) && !a.lastInput.dodge && Math.random() < 0.015
    && g.enemies(a).some(b => (b.hits?.length && b.attack > 0 && Math.abs(b.x - a.x) < 90 && Math.abs(b.y - a.y) < 50 && b.attack - b.hits[0].at < 0.1) || courtStrikeSoon(b, a, 0.1))) {
    input.dodge = true; input.left = false; input.right = false;
  }
  // Parry or dodge a blow that is about to land.
  const swing = g.enemies(a).find(b => b.attack > 0 && b.hits?.length && Math.abs(b.x - a.x) < 46 && Math.abs(b.y - a.y) < 30 && (a.x - b.x) * b.face > 0);
  if (swing && Math.random() < 0.06) {
    if (Math.random() < 0.55 && a.parryCd <= 0) { input.dodge = true; input.left = false; input.right = false; input.attack = false; }
    else if (a.dodgeCd <= 0 && safeRoll(g, a, Math.sign(a.x - swing.x) || 1)) { input.dodge = true; input.right = a.x > swing.x; input.left = a.x < swing.x; }
  }
  // Roll away from incoming shots now and then.
  if (a.dodgeCd <= 0 && Math.random() < 0.12) {
    const threat = g.bullets.find(b => b.team !== a.team && Math.hypot(b.x - a.x, b.y - a.y) < 70 && Math.sign(b.vx) === Math.sign(a.x - b.x));
    if (threat) input.dodge = safeRoll(g, a, input.right ? 1 : input.left ? -1 : a.face);
  }
  // A plain blow is thrown planted: a held direction or down would turn it into another move.
  if (input.attack && !aimed && !ranged && a.ground && !a.climbing && Math.abs(dx) < 70) { input.left = false; input.right = false; if (!input.jump) input.down = false; }
  if (input.aimX === null) { input.aimX = target.x; input.aimY = target.y; }
  // Turn to the target, but never in the middle of a move (dashes through the rival would shake).
  if (!input.left && !input.right && !(a.attack > 0)) a.face = dx >= 0 ? 1 : -1;
  return input;
}
