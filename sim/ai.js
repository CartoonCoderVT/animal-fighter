import { EMPTY_INPUT } from '../engine/input.js';
import { MAP, pathTo } from './map.js';
import { rnd, dist, clamp } from '../engine/const.js';
import { FOOT } from '../render/rig.js';
import { MOVES, comboOf } from './moves.js';
import { MELEE, isMelee } from './weapons.js';

const RANGED = a => a.weapon === 'pistol' || a.weapon === 'shotgun';

// When each special is worth firing, given the gap to the target.
const SPECIAL_RANGE = [
  (dx, dy) => Math.abs(dx) > 30 && Math.abs(dx) < 150 && Math.abs(dy) < 40,
  (dx, dy) => Math.abs(dx) < 220 && Math.abs(dy) < 24,
  (dx, dy) => Math.abs(dx) < 90 && Math.abs(dy) < 60,
  // Juma: small, she turns into the beast when the fight is close; the beast leaps at rivals a little away.
  (dx, dy, a) => (a.form === 'beast' ? Math.abs(dx) > 50 && Math.abs(dx) < 220 && Math.abs(dy) < 90 : Math.abs(dx) < 140 && Math.abs(dy) < 60),
  // The blood beam: level along the floor, or down and ahead (about 30 degrees) from the air.
  (dx, dy, a, t, g) => t && t.bloodMark >= 3 && g.time - (t.markT ?? -9) < 5 ? Math.abs(dx) < 70 && Math.abs(dy) < 40 : a.ground ? Math.abs(dx) > 30 && Math.abs(dx) < 320 && Math.abs(dy) < 16 : Math.abs(dx) < 300 && Math.abs(dy - Math.abs(dx) * 0.61) < 18
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

  if (a.burning > 0) {
    if (Math.random() < 0.02) ai.panicDir *= -1;
    steer(input, a, a.x + ai.panicDir * 100);
    input.dodge = Math.random() < 0.06 && safeRoll(g, a, ai.panicDir);
    if (a.ground && Math.random() < 0.05) input.jump = true;
    return input;
  }

  const target = g.closest(a);
  if (!target) return input;
  const ranged = RANGED(a);
  const dx = target.x - a.x, dy = target.y - a.y;

  const mine = currentNode(g, a);
  const theirs = target.knocked ? nodeAt(g, target.x, target.y + 6) : nodeAt(g, target.x, target.y + FOOT);
  const clearShot = ranged && Math.abs(dy) < 160;
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
          if (Math.abs(a.x - tx) < 14 && a.ground) { input.down = true; input.jump = !a.lastInput.jump; ai.airborne = true; ai.dropX = tx; }
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
      const desired = ranged ? 210 : 16;
      if (Math.abs(dx) > desired) moveTo = target.x;
      else if (ranged && Math.abs(dx) < 110) moveTo = a.x - Math.sign(dx || 1) * 90;
      if (mine && moveTo !== null) moveTo = clamp(moveTo, mine.x0, mine.x1);
    }
  }

  // Unarmed with a blade on the floor nearby and nobody in its face: go and grab it.
  if (!a.weapon && !a.holding && !a.act && a.ground && Math.abs(dx) > 60) {
    const loot = g.props.filter(p => !p.held && MELEE.includes(p.kind) && Math.abs(p.y - a.y) < 34 && Math.abs(p.x - a.x) < 240).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    if (loot && (!mine || (loot.x > mine.x0 - 6 && loot.x < mine.x1 + 6))) {
      moveTo = loot.x;
      if (Math.abs(loot.x - a.x) < 26 && ai.grabCd <= 0) { input.grab = true; ai.grabCd = 1.5; }
    }
  }

  // Hazard avoidance overrides the plan.
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

  // Combat
  {
    const natural = MOVES[comboOf(a)[0]].range + 4;
    const armed = isMelee(a.weapon);
    const meleeRange = a.weapon === 'extinguisher' ? 110 : armed ? MOVES[a.weapon + ':nLight'].range + 4 : natural;
    const facing = dx * a.face >= -4;
    input.attack = ranged ? Math.abs(dy) < 230 && Math.abs(dx) < 650 : Math.abs(dy) < 24 && Math.abs(dx) < meleeRange && facing && !target.knocked;
    input.power = armed ? Math.abs(dy) < 26 && Math.abs(dx) < meleeRange + 10 && facing && Math.random() < 0.06 : a.abilityCd <= 0 && !a.act && !target.knocked && facing && SPECIAL_RANGE[a.type](dx, dy, a, target, g);
    // With a weapon, mix in the directional lights now and then: side to lunge in, down to lift.
    if (armed && input.attack && a.ground && Math.random() < 0.25) { if (Math.abs(dx) > meleeRange * 0.6) { input.right = dx > 0; input.left = dx < 0; } else input.down = Math.random() < 0.4; }
    // Follow a launched rival into the air and keep the combo going.
    if (!target.ground && !target.knocked && (target.stun > 0 || target.hitstun > 0) && Math.abs(dx) < 40 && dy < -6 && dy > -90) {
      if (a.ground) input.jump = true;
      input.attack = Math.abs(dy) < 30;
    }
    // Nox closes long gaps as a swarm of bats.
    if (a.type === 4 && !a.act && !(a.batCd > 0) && Math.hypot(dx, dy) > 110 && Math.hypot(dx, dy) < 320 && Math.random() < 0.015) input.bats = true;
    // Nox opens with the shadow cut from a few steps away.
    if (a.type === 4 && a.ground && !a.act && !a.weapon && Math.abs(dx) > 28 && Math.abs(dx) < 64 && Math.abs(dy) < 16 && Math.random() < 0.05) { input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
    // Juma, small: the lightning pounce from a few steps away, the bite up close.
    // The beast: the charge from further off, the earthquake when rivals crowd her.
    if (a.type === 3 && a.ground && !a.act && !a.weapon && Math.abs(dy) < 18 && !target.knocked) {
      const crowd = g.enemies(a).filter(b => !b.dead && !b.knocked && Math.abs(b.x - a.x) < 90 && Math.abs(b.y - a.y) < 30).length;
      if (a.form === 'beast') {
        if (!(a.chargeCd > 0) && Math.abs(dx) > 50 && Math.abs(dx) < 140 && Math.random() < 0.03) { input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
        else if ((crowd >= 2 || Math.abs(dx) < 40) && a.comboTimer <= 0 && Math.random() < 0.03) { input.attack = !a.lastInput.attack; input.down = true; }
      } else if (Math.abs(dx) > 30 && Math.abs(dx) < 66 && Math.random() < 0.05) { input.attack = !a.lastInput.attack; input.right = dx > 0; input.left = dx < 0; }
      else if (Math.abs(dx) < 28 && !(a.biteCd > 0) && a.comboTimer <= 0 && Math.random() < 0.03) { input.attack = !a.lastInput.attack; input.down = true; }
    }
    // Close the gap with a roll that turns into a dashing strike.
    if (a.ground && !a.act && !a.weapon && a.dodgeCd <= 0 && Math.abs(dx) > 44 && Math.abs(dx) < 95 && Math.abs(dy) < 20 && Math.random() < 0.03 && safeRoll(g, a, Math.sign(dx))) {
      input.dodge = true; input.right = dx > 0; input.left = dx < 0;
    }
    if (a.dodge > 0 && a.dodgeKind === 'roll' && Math.abs(dx) < 50) input.attack = !a.lastInput.attack;
    // Stomp on heads from above.
    if (!a.ground && !a.act && Math.abs(dx) < 12 && dy > 12 && dy < 120 && a.vy > -2) { input.down = true; input.attack = true; }
    // Pick up a downed rival and throw them.
    if (a.act === 'carry') {
      ai.carryT = (ai.carryT || 0) + dt;
      if (ai.carryT > 0.5) { input.attack = true; ai.carryT = 0; }
    } else if (target.knocked && dist(a, target) < 30 && ai.grabCd <= 0) { input.grab = true; ai.grabCd = 2; }
    if (a.holding && Math.abs(dy) < 80 && Math.abs(dx) < 320 && ai.grabCd <= 0) { input.grab = true; ai.grabCd = 1; }
    if (!a.weapon && !a.holding && !a.act && ai.grabCd <= 0) {
      const item = g.props.find(p => !p.held && ['gun', 'crate', 'extinguisher', ...MELEE].includes(p.kind) && dist(a, p) < 34 && Math.abs(p.y - a.y) < 30);
      if (item) { input.grab = true; ai.grabCd = 3; }
    }
    // Shoot the barrel next to the target.
    if (ranged) {
      const barrel = g.props.find(p => (p.kind === 'barrel' || p.kind === 'propane') && dist(p, target) < 70 && dist(p, a) > 160);
      if (barrel) { input.aimX = barrel.x; input.aimY = barrel.y; input.attack = true; }
    }
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
  if (input.aimX === null) { input.aimX = target.x; input.aimY = target.y; }
  if (!input.left && !input.right) a.face = dx >= 0 ? 1 : -1;
  return input;
}
