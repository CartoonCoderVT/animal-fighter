import { Bodies, Body, Composite, Query, CAT, MASK } from './physics.js';
import { weightOf, formOf, styleOf } from './fighters.js';
import { pose, subtree, PARENT, PIVOT_FROM_CENTER, HALF_H } from '../render/rig.js';
import { S, rnd, clamp } from '../engine/const.js';
import { knockdown, pushActor, buildRagdoll, ragdollOf, breakJoint, gib, makeLimb, releaseHeld, pinLimb, addStump } from './ragdoll.js';
import { extendedAttack, dropWeapon, damageProp } from './props.js';
import { hazardBulletHit, breakLamp } from './hazards.js';
import { MOVES, AIR, NOX_AIR, DARK_AIR, JUMA_AIR, BEAST_AIR, TITAN_AIR, AXO_AIR, LOLA_AIR, NATURAL, SET, BURST, DARK, POOL, AUTO, comboOf, airOf, heavyOf } from './moves.js';
import { spill } from './nox.js';
import { kingOrder, shieldBlocks, strikeCourts, courtInPath, hurtFamiliar } from './court.js';
import { hurtKingdom } from './kingdom.js';
import { MAP } from './map.js';
import { startSpecial, startStomp, throwCarried, startChase, endAct, startPlunge, startSwarm, startBite, startCharge, feedRage, frogPower } from './specials.js';
import { isMelee, WEAPON_INFO, weaponSlot } from './weapons.js';
import { axoHit, axoPower, shedStrike, throwClone, blowBubble } from './axolotl.js';
import { hitMinions, hurtMinion, targetable, queueEcho, pileOn, bubbleBonus } from './minions.js';
import { skipSpot, skipTo, footing, knifeKnock, knifeKnocked, setKnives, skipKnives, stepSetKnife } from './timestop.js';

export const KIND = {
  punch: 'blunt', board: 'blunt', impact: 'blunt', fall: 'blunt', crush: 'blunt', power: 'blunt', pipe: 'blunt',
  whip: 'blunt', kick: 'blunt', paw: 'blunt', stomp: 'blunt', sonic: 'blunt', slam: 'blunt',
  claw: 'cut', blade: 'cut', katana: 'cut', axe: 'cut', hammer: 'blunt', spear: 'pierce',
  spit: 'blunt', tongue: 'blunt', slap: 'blunt', croak: 'blunt', belly: 'blunt', arrow: 'pierce', magic: 'blunt', bash: 'blunt', bullet: 'pierce', pellet: 'pierce', shard: 'pierce', thrown: 'pierce', fang: 'pierce', bite: 'pierce', blood: 'cut', hemo: 'pierce', scythe: 'cut', roar: 'blunt', knife: 'cut',
  gill: 'blunt', fin: 'blunt', gulp: 'blunt', bubble: 'blunt', nibble: 'pierce', ember: 'explosion',
  explosion: 'explosion', fire: 'fire', shock: 'shock', bleed: 'bleed', grind: 'grind', freeze: 'freeze'
};
const DOT = new Set(['fire', 'bleed', 'shock', 'freeze']);
const isGun = w => w === 'pistol' || w === 'shotgun';
const LIMB = ['armF', 'armB', 'footF', 'footB'];
const limbOf = part => (LIMB.includes(part) ? part : null);
const SLASH = { knife: '#e8f4ff', gill: '#ff8fa8', fin: '#ffd6e0', gulp: '#c8f0ff', bubble: '#e0f6ff', belly: '#ffe4ec', slap: '#e8ffd0', tongue: '#ff9cb4', blood: '#ff3a5a', claw: '#f1d9a8', whip: '#ffc8d8', kick: '#ffe8f0', paw: '#ffe0a0', fang: '#e8d0ff', air: '#ffffff', blade: '#f4f8ff', katana: '#ffffff', spear: '#e8f0ff', pipe: '#f0d8c8', axe: '#fff0e0', hammer: '#ffe8d0' };
const HEAVY_WEAPONS = ['pipe', 'axe', 'hammer'];

// Hitlag (Smash's freeze frames): only the fighters involved in a hit stop for a moment; the
// rest of the arena keeps running. The velocity they had is kept and given back afterwards.
export function hitlag(...list) {
  const dur = list.pop();
  for (const a of list) {
    if (!a || a.dead || a.knocked) continue;
    if (!a.lagPos) { a.lagPos = { x: a.body.position.x, y: a.body.position.y }; a.lagVel = { x: a.body.velocity.x, y: a.body.velocity.y }; }
    else a.lagVel = { x: a.body.velocity.x, y: a.body.velocity.y };
    a.hitlag = Math.max(a.hitlag || 0, dur);
  }
}
// Slow motion is reserved for moments a human player is part of.
const human = a => a && !a.bot;
// The simulation is shared online, so with more than one human nobody gets slowed down.
export function drama(g, t, ...who) {
  if (g.actors.filter(human).length > 1) return;
  if (who.some(human)) g.drama = Math.max(g.drama || 0, t);
}

export function armUsable(a) {
  return !a.severed.includes('armF') && !a.broken.armF;
}
// The limb a move needs: claws, paws and knives use an arm; tails and fangs always work.
function moveUsable(a) {
  const s = styleOf(a);
  if (s === 0 || s === 2 || s === 3) return armUsable(a) || (!a.severed.includes('armB') && !a.broken.armB);
  return true;
}
const EDGED = ['claw', 'katana', 'axe', 'blade', 'knife'];

export function attack(g, a) {
  if (a.dead || a.attackCd > 0 || a.invincible > 0.8 || a.knocked || a.frozen > 0 || a.parryLag > 0 || a.hitstun > 0) return;
  if (a.act) { if (a.act === 'carry') throwCarried(g, a); return; }
  // The Cat King never strikes himself: J is an order to his court (sim/court.js). Nor does the frog with
  // the King in his belly: the court is his while he keeps him there.
  if (a.type === 0 || a.court) { kingOrder(g, a); return; }
  // The axolotl with a clone in its mouth: J fires it at whoever is ahead (Estilingue).
  if (a.axo?.carry != null) { throwClone(g, a); return; }
  if (!a.ground && !a.climbing && a.input.down && !a.weapon && !a.holding) { startStomp(g, a); return; }
  if (isMelee(a.weapon) && !a.holding) { weaponAttack(g, a, false); return; }
  if (extendedAttack(g, a)) return;
  if (isGun(a.weapon)) {
    if (!armUsable(a)) { a.attackCd = 0.8; g.text(a.x, a.y - 26, 'SEM MÃO!', '#d7b5ba'); return; }
    a.attack = 0.3; a.attackSeq = (a.attackSeq || 0) + 1;
    a.attackKind = 'shoot';
    a.attackCd = a.weapon === 'shotgun' ? 0.55 : 0.24;
    shoot(g, a);
    return;
  }
  if (!moveUsable(a)) {
    a.attackCd = 0.8;
    g.text(a.x, a.y - 26, styleOf(a) === 2 ? 'SEM MÃOS!' : 'SEM GARRAS!', '#d7b5ba');
    return;
  }
  // Right after a launcher, J leaps after the target to start an air combo.
  const prey = a.chase && g.time < a.chase.until ? g.actor(a.chase.id) : null;
  if (prey && !prey.dead && !prey.knocked && !prey.ground) { a.chase = null; startChase(g, a, prey); return; }
  let id;
  const list = comboOf(a), chaining = a.comboTimer > 0 && (list.includes(a.attackKind) || ['shadowCut', 'scytheDash', 'batStrike', 'dPhantom', 'jBolt', 'jCross', 'fGrapple', 'xSlide', 'lSkip', 'lFan', 'lRain'].includes(a.attackKind));
  const style = styleOf(a), nox = style === 4, dark = nox && a.form === 'dark', side = a.input.left || a.input.right, tapped = g.time - (a.dirTap ?? -9) < 0.2;
  // A bot's steering makes fresh taps of its own: its knife branches follow its plan instead.
  const tapSet = tapped && (!a.bot || !!a.ai?.lola?.plan);
  const juma = style === 3, small = juma && !a.form, titan = juma && a.form === 'titan', lola = style === 2, frog = style === 5, axo = style === 6;
  if (a.dashStrike) id = 'dashAtk';
  else if (!a.ground && !a.climbing) {
    const air = airOf(a), prev = air.indexOf(a.attackKind);
    // Lola, a fresh tap of a direction in her air string: the ring of knives; then the dive.
    if (lola && a.comboTimer > 0 && (a.attackKind === 'lAirCut' || a.attackKind === 'lAirSpin') && side && tapSet && !(a.setCd > 0)) { a.setCd = SET.cd; id = 'lAirRing'; }
    else if (lola && a.comboTimer > 0 && a.attackKind === 'lAirRing') id = 'lAirDive';
    else id = air[a.comboTimer > 0 && prev >= 0 ? (prev + 1) % air.length : 0];
  } else if (a.input.down) {
    // Juma: small, S+J bites (out of a string it rakes low); the beast shakes the whole floor; the
    // titan heaves it, or hammers a downed rival into it.
    if (titan) id = downedNear(g, a) ? 'tPound' : 'tQuake';
    else if (juma && a.form) id = 'bQuake';
    else if (juma && !chaining && !(a.biteCd > 0)) { startBite(g, a); return; }
    // The axolotl: in the string the tail scoops the rival up; over a downed one it feasts; else
    // it blows a bubble.
    else if (axo) id = chaining ? 'xScoop' : downedNear(g, a) ? 'xFeast' : 'xBubble';
    // Lola out of her string: the rain of knives (now and then; else the low cut).
    else if (lola && chaining && !(a.setCd > 0)) { a.setCd = SET.cd; id = 'lRain'; }
    // DARK NOX: out of his string the harvest, over a downed rival the scythe's execution, else the kiss.
    else if (dark) id = chaining ? 'dHarvest' : downedNear(g, a) ? 'dExecute' : 'dKiss';
    else id = nox && chaining ? 'scytheSweep' : nox && downedNear(g, a) ? 'execute' : frog && downedNear(g, a) ? 'fSquash' : heavyOf(a);
  }
  // The frog with a direction: the tongue-hook, out of the string or on a fresh tap inside it.
  else if (frog && side && (!chaining || tapped) && a.attackKind !== 'fGrapple') { a.face = a.input.right ? 1 : -1; id = 'fGrapple'; }
  else if (nox && !chaining && side) { a.face = a.input.right ? 1 : -1; id = dark ? 'dPhantom' : 'shadowCut'; }
  // The axolotl with a direction: the mud slide out of the string, the tidal bore on a fresh tap inside it.
  else if (axo && side && !chaining) { a.face = a.input.right ? 1 : -1; id = 'xSlide'; }
  else if (axo && side && chaining && tapped && a.attackKind !== 'xPororoca') { a.face = a.input.right ? 1 : -1; id = 'xPororoca'; }
  else if (nox && chaining && side && tapped && a.attackKind !== 'scytheDash' && a.attackKind !== 'dPhantom') { a.face = a.input.right ? 1 : -1; id = dark ? 'dPhantom' : 'scytheDash'; }
  // Lola skips through time to a rival a long way off (on a short cooldown, else the string). Inside
  // her string a fresh tap of a direction is the wall of knives instead.
  else if (lola && chaining && side && tapSet && !(a.setCd > 0)) { a.setCd = SET.cd; id = 'lFan'; }
  else if (lola && !chaining && side && !(a.skipCd > 0)) { a.face = a.input.right ? 1 : -1; a.skipCd = 1.1; id = 'lSkip'; }
  // Juma with a direction: small, the lightning pounce (a fresh tap inside the string: the cross);
  // the beast and the titan charge, out of the string too.
  else if (juma && side && (!chaining || tapped) && !(a.form && a.chargeCd > 0) && !(small && chaining && a.attackKind === 'jCross')) {
    a.face = a.input.right ? 1 : -1;
    if (a.form) { startCharge(g, a); return; }
    id = chaining ? 'jCross' : 'jBolt';
  }
  else {
    // The shadow cut opens the string at the reap; the phantom reap picks it up at the guillotine;
    // Juma's pounce goes on into the storm of claws, her cross into the rake; Lola's skip and wall of
    // knives into the dance of knives, her rain of knives into the stab in the back.
    a.combo = chaining ? (a.attackKind === 'shadowCut' || a.attackKind === 'batStrike' || a.attackKind === 'dPhantom' ? 1 : a.attackKind === 'scytheDash' || a.attackKind === 'lRain' || a.attackKind === 'jCross' || a.attackKind === 'fGrapple' ? 3 : a.attackKind === 'jBolt' || a.attackKind === 'lSkip' || a.attackKind === 'lFan' || a.attackKind === 'xSlide' ? 2 : (a.combo + 1) % list.length) : 0;
    // A string can outlive the style it began in (the frog swallowing mid-combo): start the new one over.
    if (!list[a.combo]) a.combo = 0;
    id = list[a.combo];
  }
  // Nox's strings never drop to distance: a rival knocked out of reach of the next blow is chased
  // as a swarm of bats, and that blow lands as he forms beside them. Small Juma pounces after them;
  // Lola skips through time to them.
  if ((nox || small || lola) && a.comboTimer > 0) {
    const prey = comboPrey(g, a), mv = moveOf(a, MOVES[id]);
    if (prey && mv && !mv.blink && !mv.execute && !mv.pass && !mv.warp && (Math.abs(prey.x - a.x) > mv.range + 12 || Math.abs(prey.y - a.y) > mv.band + 14) && Math.hypot(prey.x - a.x, prey.y - a.y) < (nox ? 300 : 190)) {
      if (nox) startSwarm(g, a, { prey, then: id });
      else startChase(g, a, prey, id);
      return;
    }
  }
  startMove(g, a, id);
}

// Lola's skip inside a move: time stops for her alone for an instant and she is beside the rival
// she is working on (or the nearest one in reach), behind them, in front of them or over their
// head. With nobody there the skip forward still carries her a stretch.
function warpMove(g, a, mv) {
  if (mv.warp === 'away') { awaySkip(g, a, mv); return; }
  const tall = mv.warp === 'above' ? 150 : 60;
  // The skip forward goes where she points: the rival she was cutting only counts if it is that way.
  const prey = comboPrey(g, a);
  const b = (prey && (mv.warp !== 'front' || (prey.x - a.x) * a.face > -10) ? prey : null) || g.enemies(a).filter(b => !b.dead && !b.knocked && Math.abs(b.x - a.x) < mv.reach && Math.abs(b.y - a.y) < tall && (mv.warp !== 'front' || (b.x - a.x) * a.face > -10))
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
  if (!b || Math.abs(b.x - a.x) > mv.reach + 30 || Math.abs(b.y - a.y) > tall + 20) {
    if (mv.warp !== 'front') return;
    const x = clamp(a.x + a.face * 64, 18, 942);
    if (blocked(x, a.y) || (x > MAP.pit.x0 - 8 && x < MAP.pit.x1 + 8 && !footing(x, a.y, 60, 0)) || (a.ground && !footing(x, a.y))) return;
    skipTo(g, a, x, a.y, { ground: a.ground });
    return;
  }
  const spot = skipSpot(a, b, mv.warp);
  if (!spot) return;
  const x0 = a.x, y0 = a.y;
  skipTo(g, a, spot.x, spot.y, { face: Math.sign(b.x - spot.x) || a.face, ground: spot.ground });
  skipKnives(g, a, x0, y0, b);
  if (!b.ground) b.float = Math.max(b.float || 0, 0.35);
  // Over their head she drops with both knives down; in the air beside them she hangs there.
  if (mv.warp === 'above') shove(a, 0, 4);
  else if (!spot.ground) a.float = Math.max(a.float || 0, mv.dur);
  b.stun = Math.max(b.stun || 0, 0.12);
}

// Out of reach of the rival she is working on: a skip straight back from them (for the wall of
// knives), onto something to stand on if she was standing, never into a wall or over the shredder.
function awaySkip(g, a, mv) {
  const prey = comboPrey(g, a);
  const b = prey && Math.abs(prey.x - a.x) < mv.reach && Math.abs(prey.y - a.y) < 60 ? prey : null;
  const dir = b ? Math.sign(a.x - b.x) || -(a.face || 1) : -(a.face || 1);
  for (const d of [52, 44, 36]) {
    const x = clamp((b ? b.x : a.x) + dir * d, 18, 942);
    if (Math.abs(x - a.x) < 8) continue;
    if (blocked(x, a.y) || (x > MAP.pit.x0 - 8 && x < MAP.pit.x1 + 8 && !footing(x, a.y, 60, 0)) || (a.ground && !footing(x, a.y))) continue;
    if (MAP.press && g.hz.press?.state !== 'up' && x > MAP.press.x0 - 12 && x < MAP.press.x1 + 12) continue;
    skipTo(g, a, x, a.y, { face: b ? Math.sign(b.x - x) || a.face : a.face, ground: a.ground });
    if (!a.ground) a.float = Math.max(a.float || 0, mv.dur);
    return;
  }
}

// The rival Nox's string is on: the last one he hit, a moment ago, still standing.
function comboPrey(g, a) {
  const b = a.lastPrey != null && g.time - (a.lastPreyT ?? -9) < 1.6 ? g.actor(a.lastPrey) : null;
  return b && !b.dead && !b.knocked && b.team !== a.team ? b : null;
}

// Brawlhalla-style weapon attacks: the held direction picks the move; neutral lights chain.
export function weaponAttack(g, a, heavy) {
  if (a.dead || a.attackCd > 0 || a.invincible > 0.8 || a.knocked || a.frozen > 0 || a.parryLag > 0 || a.hitstun > 0 || a.act) return false;
  if (!armUsable(a)) { a.attackCd = 0.8; g.text(a.x, a.y - 26, 'SEM MÃO!', '#d7b5ba'); return false; }
  const side = !!(a.input.left || a.input.right), down = !!a.input.down;
  if (side) a.face = a.input.right ? 1 : -1;
  const prey = !heavy && a.chase && g.time < a.chase.until ? g.actor(a.chase.id) : null;
  if (prey && !prey.dead && !prey.knocked && !prey.ground) { a.chase = null; startChase(g, a, prey); return true; }
  let slot = a.dashStrike ? 'sLight' : weaponSlot(heavy, a.ground || a.climbing, side, down);
  if (slot === 'rec') { if (a.recUsed) return false; a.recUsed = true; }
  let id = a.weapon + ':' + slot;
  const prev = MOVES[a.attackKind];
  if (slot === 'nLight' && a.comboTimer > 0 && prev?.weapon === a.weapon && prev.next) id = prev.next;
  startMove(g, a, id);
  const mv = MOVES[id];
  if (mv.vy) Body.setVelocity(a.body, { x: a.body.velocity.x, y: mv.vy });
  if (mv.plunge) startPlunge(g, a);
  if (heavy) g.fx('focus', { x: a.x, y: a.y, p: 0.25 });
  return true;
}

export function startMove(g, a, id) {
  const mv = MOVES[id];
  a.attackKind = id;
  a.attack = mv.dur;
  a.attackCd = mv.cd + mv.dur * 0.5;
  a.comboTimer = mv.dur + 0.45;
  a.attackSeq = (a.attackSeq || 0) + 1;
  a.hits = mv.hits.map((p, i) => ({ at: mv.dur * (1 - p), i }));
  a.warpDone = false; a.setDone = false;
  if (a.dashStrike) {
    a.dashStrike = false;
    Body.setVelocity(a.body, { x: a.face * 8.5, y: Math.min(a.body.velocity.y, 0) });
    g.fx('dash', { x: a.x, y: a.y, face: a.face });
  } else if (mv.bolt) {
    Body.setVelocity(a.body, { x: a.face * mv.bolt, y: a.ground ? a.body.velocity.y : Math.min(a.body.velocity.y, 0) });
    g.fx('dash', { x: a.x, y: a.y, face: a.face });
  } else if (mv.step && a.ground) Body.setVelocity(a.body, { x: a.body.velocity.x * 0.3 + a.face * mv.step, y: a.body.velocity.y });
  if (mv.weapon && mv.step && !a.ground && !mv.vy) Body.setVelocity(a.body, { x: a.face * mv.step * 0.6, y: a.body.velocity.y });
  // In the air an attack hangs the fighter for a moment, which is what makes juggles possible.
  if (!a.ground && !mv.vy && !mv.plunge) {
    const down = mv.spike ? 2 : 0.6;
    Body.setVelocity(a.body, { x: a.body.velocity.x * 0.8, y: clamp(a.body.velocity.y, -1.5, down) });
    a.float = Math.max(a.float || 0, mv.dur);
  }
  g.sound(mv.weapon ? (HEAVY_WEAPONS.includes(mv.weapon) ? 'whoosh' : 'swish') : 'swing', a.x);
}

// Called every step: strikes land on their animation frame.
export function tickAttack(g, a) {
  if (!a.hits) return;
  const mv = MOVES[a.attackKind];
  if (!mv || a.attack <= 0) { a.hits = null; return; }
  if (!a.hits.length && !mv.warp && !mv.set) return;
  if (mv.warp && !a.warpDone && a.attack <= mv.dur * (1 - mv.warpAt)) { a.warpDone = true; warpMove(g, a, mv); }
  // Lola lays her knives in the air (sim/timestop.js).
  if (mv.set && !a.setDone && a.attack <= mv.dur * (1 - mv.setAt)) { a.setDone = true; setKnives(g, a, mv); }
  while (a.hits?.length && a.attack <= a.hits[0].at) strike(g, a, mv, a.hits.shift().i);
}

export function inReach(a, x, y, range, band, low = false) {
  const along = (x - a.x) * a.face;
  const dy = y - (a.y + (low ? 10 : 2));
  return along > -8 && along < range + 8 && Math.abs(dy) < band;
}

// Reach for a move: in front, or all around for spins and dashes that pass through.
function reaches(a, mv, x, y, pad = 0, low = !!mv.low) {
  if (mv.around || mv.pass) {
    const dy = y - (a.y + (low ? 10 : 2));
    return Math.abs(x - a.x) < mv.range + 8 + pad && Math.abs(dy) < mv.band + pad;
  }
  return inReach(a, x, y, mv.range + pad, mv.band + pad, low);
}

// DARK NOX: the same moves, far more destructive and reaching much further (made once per move).
const darkMoves = new Map();
export function darkMove(mv) {
  if (mv.dark) return mv;
  let d = darkMoves.get(mv);
  if (d) return d;
  d = { ...mv, dark: true, range: Math.round(mv.range * DARK.range), band: Math.round(mv.band * DARK.band), dmg: mv.dmg.map(x => x * DARK.dmg), kb: mv.kb.map(([x, y]) => [x * DARK.kb, y * (y < 0 ? 1.1 : DARK.kb)]) };
  if (mv.blink) d.blink = Math.round(mv.blink * 1.5);
  if (mv.spikes) d.spikes = mv.spikes.map(s => Math.round(s * DARK.range));
  for (const k of ['sweep', 'floor']) if (mv[k]) d[k] = Math.round(mv[k] * DARK.range);
  if (mv.shock) d.shock = Math.round(mv.shock * 1.4);
  darkMoves.set(mv, d);
  return d;
}
// The move as this fighter throws it right now.
export const moveOf = (a, mv) => (mv && a.form === 'dark' ? darkMove(mv) : mv);

// Nox's blows make the rival bleed, and the blood they lose is his (tickStatuses).
export function bleedFor(g, nox, b, amount) {
  b.bleed = Math.min(6, (b.bleed || 0) + amount);
  b.bleedBy = nox.id; b.bleedByT = g.time;
}
// Nox drinks what a rival bleeds from his blows: it fills his meter (not while he is DARK NOX).
function drink(g, nox, b, amount) {
  if (nox.form === 'dark' || nox.act === 'darkRise') return;
  if (Math.hypot(b.x - nox.x, b.y - nox.y) < 520) g.fx('drain', { x: b.x, y: b.y - 4, tx: nox.x, ty: nox.y - 4, n: 2 });
  fillBlood(g, nox, amount * DARK.drink);
}
// Points into Nox's blood meter (from a bleeding rival or a pool on the floor); full, he says so.
export function fillBlood(g, nox, pts) {
  if (nox.form === 'dark' || nox.act === 'darkRise') return;
  const was = nox.blood || 0;
  nox.blood = Math.min(DARK.max, was + pts);
  if (was < DARK.max && nox.blood >= DARK.max) {
    g.text(nox.x, nox.y - 38, 'SANGUE CHEIO! K', '#ff3a5a');
    g.fx('ring', { x: nox.x, y: nox.y, size: 34, color: '#ff3a5a' });
    g.sound('charge', nox.x);
  }
}

export function strike(g, a, mv, i) {
  // Moves whose hits reach differently (the frog's tongue-hook: far for the tongue, close for the knees).
  if (mv.reach) mv = { ...mv, range: mv.reach[i] ?? mv.range };
  if (a.form === 'dark') mv = darkMove(mv);
  if (mv.blink) { blinkCut(g, a, mv); return; }
  if (mv.execute) { execute(g, a, mv); return; }
  if (mv.pound) { pound(g, a, mv, i); return; }
  if (mv.bubble) { blowBubble(g, a); return; }
  if (mv.shed) { shedStrike(g, a); return; }
  // The axolotl's tail blows reach less while its tail grows back.
  if (mv.tail && a.axo?.tailCut) mv = { ...mv, range: mv.range - 8 };
  const face = a.face;
  const kind = mv.kind === 'air' ? NATURAL[styleOf(a)] : mv.kind;
  const counter = a.counter > 0;
  const last = i === mv.hits.length - 1;
  let amount = (mv.dmg[i] ?? mv.dmg[0]) * (counter ? 1.5 : 1);
  const kb = mv.kb[i] ?? mv.kb[0];
  const low = !!mv.low;
  let struck = false;
  const hit = new Set();
  const vamp = styleOf(a) === 4, juma = styleOf(a) === 3, lola = styleOf(a) === 2;
  let first = null;
  for (const b of g.enemies(a)) {
    if (b.knocked) continue;
    if (b.iframes > 0 && b.dodge > 0 && !b.perfect && Math.abs(b.x - a.x) < mv.range + 30 && Math.abs(b.y - a.y) < mv.band + 12) { perfectDodge(g, b); continue; }
    if (!reaches(a, mv, b.x, b.y, bulk(b))) continue;
    // A blade swung into one held up in guard toward it can glance off. Only a real guard
    // counts: someone attacking or just recovering from an attack takes the hit (trades land).
    const guarding = !(b.attack > 0) && !(b.attackCd > 0) && !b.act;
    if (mv.weapon && isMelee(b.weapon) && guarding && (a.x - b.x) * b.face > 0 && Math.random() < WEAPON_INFO[b.weapon].ricochet) { ricochet(g, a, b); return; }
    hit.add(b.id);
    const side = mv.around || mv.pass ? (Math.sign(b.x - a.x) || face) : face;
    const point = { x: b.x - side * 5, y: low ? b.y + 12 : b.y + 2 };
    const part = low ? (Math.random() < 0.5 ? 'footF' : 'footB') : mv.spike ? 'head' : undefined;
    // The kiss drinks the blood marks: each one adds to the bite and to the heal.
    const feast = mv.feast && last ? markOf(g, b) : 0;
    if (feast) { b.bloodMark = 0; g.fx('bloodBurst', { x: b.x, y: b.y - 4, n: feast }); g.text(b.x, b.y - 36, 'BANQUETE!', '#ff5a6e'); }
    // A rival trapped in the axolotl's bubble: its blow pops it for a little more.
    const pop = bubbleBonus(g, b, a.id);
    const dealt = damage(g, b, amount + feast * 4 + pop, point, a.id, kind, { kb: { x: side * kb[0] * (counter ? 1.6 : 1), y: kb[1] }, knock: (mv.knock && last) || (counter && last), launch: !!(mv.launch || mv.lift || mv.bounce), dir: EDGED.includes(kind) ? rnd(-0.9, 0.9) : undefined, part, lag: mv.lag });
    if (!dealt) continue;
    struck = true;
    first ||= b;
    // Small Juma's claws wind her up: every one that lands brings the frenzy closer.
    if (juma && !a.form) a.abilityCd = Math.max(0, a.abilityCd - 0.3);
    // Lola's watch winds up a little with every knife that lands.
    if (lola) a.abilityCd = Math.max(0, a.abilityCd - 0.12);
    if (mv.lift && !b.knocked && !b.dead) { Body.setVelocity(b.body, { x: side * kb[0], y: kb[1] / weightOf(b) }); b.stun = Math.max(b.stun, 0.55); b.float = 0.5; reeling(b); }
    if (mv.launch && last && !b.knocked && !b.dead) {
      Body.setVelocity(b.body, { x: face * kb[0], y: kb[1] / weightOf(b) });
      b.stun = Math.max(b.stun, 0.7);
      b.float = 0.75;
      reeling(b);
      a.chase = { id: b.id, until: g.time + 1.1 };
      g.fx('focus', { x: b.x, y: b.y, p: 0.7 });
    }
    if (mv.breaks && last && !b.dead && Math.random() < 0.5) breakBone(g, b, LIMB[Math.floor(rnd(0, 4))]);
    if (mv.hold && !b.knocked && !b.dead) { b.hitstun = Math.max(b.hitstun || 0, mv.hold); b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun); }
    if (mv.crumple && !b.knocked && !b.dead) b.hitHeavy = true;
    // The tongue-hook: stuck to the rival, it reels them in to the frog, who springs to meet them.
    if (mv.grapple && !last && !b.knocked && !b.dead) {
      b.float = Math.max(b.float || 0, 0.35);
      shove(b, clamp((a.x + face * 20 - b.x) * 0.3, -11, 11), -1.5);
      if (a.ground) shove(a, face * 2.5, -3.2);
      a.reeled = b.id;
    }
    // The vortex drags the rival into the middle of the whirl and holds them there.
    if (mv.pull && !last && !b.knocked && !b.dead) { b.float = Math.max(b.float || 0, 0.4); shove(b, clamp((a.x - b.x) * 0.2, -3, 3), clamp((a.y - 4 - b.y) * 0.2, -3, 3)); }
    // Slammed into the floor: the first time in a combo the rival bounces back up, the second it stays down.
    if (mv.bounce && !b.knocked && !b.dead) {
      if (b.bounced) knockdown(g, b, { velocity: { x: side * 2, y: 8 }, time: 1.4 });
      else { b.bounced = true; b.bounceArm = g.time; b.bounceBy = a.id; b.float = 0; shove(b, side * kb[0], 12); }
    }
    // Air strings rise with the rival: the attacker is carried along with them, so the next hit connects.
    if (vamp && !a.ground && (NOX_AIR.includes(a.attackKind) || DARK_AIR.includes(a.attackKind))) shove(a, a.body.velocity.x * 0.5, Math.min(a.body.velocity.y, -0.6));
    else if (!vamp && !a.ground && !mv.spike && !b.knocked && (AIR.includes(a.attackKind) || JUMA_AIR.includes(a.attackKind) || BEAST_AIR.includes(a.attackKind) || TITAN_AIR.includes(a.attackKind) || AXO_AIR.includes(a.attackKind) || LOLA_AIR.includes(a.attackKind))) shove(a, b.body.velocity.x * 0.9, Math.min(a.body.velocity.y, b.body.velocity.y));
    if (mv.drain) {
      a.hp = Math.min(a.maxHp, a.hp + dealt * (mv.drain + feast * 0.1));
      g.fx(last ? 'drainStream' : 'drain', { x: b.x, y: b.y - 6, tx: a.x + a.face * 3, ty: a.y - 6 });
    } else if (vamp) {
      // Nox's thirst: every blow steals a little life.
      a.hp = Math.min(a.maxHp, a.hp + dealt * 0.15);
      g.fx('drain', { x: b.x, y: b.y - 4, tx: a.x, ty: a.y - 4, n: 3 });
    }
    if (vamp && !mv.feast && !b.dead) markBlood(g, b);
    if (vamp && !b.dead) bleedFor(g, a, b, mv.dark ? DARK.bleed * 2 : DARK.bleed);
  }
  // The Cat King's court in the way takes the blow too (sim/court.js).
  strikeCourts(g, a, (x, y) => reaches(a, mv, x, y, 4, low), amount, f => Math.sign(f.x - a.x) || face);
  // Eco: the axolotl's clones close to the rival repeat the blow a beat later.
  if (mv.echo && first && a.type === 6 && (i === mv.hits.length - 1)) queueEcho(g, a, a.attackKind, first, amount);
  // The axolotl's clones in reach take the blow too.
  if (hitMinions(g, a.team, m => reaches(a, mv, m.x, m.y, 4, low), m => {
    const side = mv.around || mv.pass ? (Math.sign(m.x - a.x) || face) : face;
    hurtMinion(g, m, amount, { x: m.x - side * 3, y: m.y }, a.id, kind, { kb: { x: side * kb[0], y: kb[1] } });
  })) struck = true;
  // The geyser shoots up where the tail lands; the tidal bore rolls a wave out ahead.
  if (mv.geyser && a.ground) g.fx('geyser', { x: a.x + face * 16, y: a.y + 16, face });
  if (mv.wave && a.ground) { g.fx('pororoca', { x: a.x + face * 14, y: a.y + 16, face }); if (struck) g.text(a.x + face * 20, a.y - 32, 'POROROCA!', '#ffd6e0'); g.shake = Math.max(g.shake, 4); }
  if (mv.bolt && a.attackKind === 'xSlide' && i === 0 && a.ground) g.fx('slime', { x: a.x, y: a.y + 16, face });
  if (mv.spikes) g.fx('bloodSpikes', { x: a.x, y: a.y + 16, face, at: mv.spikes });
  if (mv.sweep && a.ground) g.fx('scytheSweep', { x: a.x + face * 8, y: a.y + 16, x2: a.x + face * mv.sweep, face });
  // The guillotine's blade bites into the floor ahead.
  if (mv.floor && a.ground) { g.fx('scytheFloor', { x: a.x + face * mv.floor, y: a.y + 16, face }); g.shake = Math.max(g.shake, 4); g.sound('chop', a.x); }
  if (mv.shock) struck = shockwave(g, a, mv, amount, hit) || struck;
  // The beast's clap: a ring of force out of her paws shoves everyone else back.
  if (mv.clap) clapRing(g, a, hit);
  // The frog's croak: the throat sac bursts into a ring of sound all around him.
  if (mv.croak) croakRing(g, a, mv, hit);
  // The giant palm lands with a wet crack.
  if (kind === 'slap' && mv.crumple && struck) { g.fx('bigPalm', { x: first ? first.x : a.x + face * 24, y: (first ? first.y : a.y) - 2, face }); g.text(a.x + face * 20, a.y - 30, 'PLAFT!', '#c8f080'); g.shake = Math.max(g.shake, 4); }
  // The beast's blows crack the floor where they land and throw up rocks.
  if (mv.quake && a.ground) { g.fx('quake', { x: a.x + face * (mv.shockAt ?? Math.round(mv.range * 0.6)), y: a.y + 16, p: mv.quake, face }); g.shake = Math.max(g.shake, 2 + mv.quake); }
  // Through and past: turn back to the rival for the rest of the string.
  if (mv.bolt && first && last) { a.turnTo = first.id; a.turnT = g.time + 0.05; }
  if (counter && struck) { a.counter = 0; g.text(a.x, a.y - 34, 'CONTRA-ATAQUE!', '#7ce8ff'); }
  // Downed fighters and corpses take the hit on their ragdoll.
  const gore = g.settings.gore ?? 2;
  for (const l of [...g.limbs]) {
    if (!reaches(a, mv, l.x, l.y, 6)) continue;
    const owner = g.actor(l.actor);
    Body.setVelocity(l.body, { x: l.body.velocity.x + face * kb[0] * 0.8, y: l.body.velocity.y + kb[1] * 0.8 - (mv.spike ? 0 : 1) });
    if (l.attached && owner && owner.knocked && !owner.dead && owner.team !== a.team) {
      if (!l.ragdoll.hitAt || g.time - l.ragdoll.hitAt > 0.1) {
        l.ragdoll.hitAt = g.time;
        damage(g, owner, amount * 0.8, { x: l.x, y: l.y }, a.id, kind, { part: l.part, kb: { x: 0, y: 0 }, force: true });
        struck = true;
      }
    } else if (EDGED.includes(kind) && gore === 2 && l.ragdoll && l.part !== 'body' && owner?.dead) cutCorpse(g, l);
  }
  for (const p of [...g.props]) {
    if (p.held || p.fixed || !reaches(a, mv, p.x, p.y, 8 + (mv.wreck ? 8 : 0))) continue;
    damageProp(g, p, amount * (mv.wreck || 1), a.id);
    if (g.props.includes(p) && !p.body.isStatic) Body.setVelocity(p.body, { x: face * Math.max(kb[0], mv.wreck ? 8 : 0) * 0.9, y: kb[1] - (mv.wreck ? 4 : 1) });
    struck = true;
  }
  // The titan's blows tear down the lamps they reach.
  if (mv.wreck) for (const lamp of g.hz?.lamps || []) if (lamp.on && reaches(a, mv, lamp.body.position.x, lamp.body.position.y, 12)) breakLamp(g, lamp, { vx: face * 25, vy: kb[1] * 2 });
  const finisher = mv.launch || mv.knock || mv.spike || i > 0;
  if (mv.weapon) {
    if (struck) g.sound(kind === 'axe' ? 'chop' : kind === 'hammer' || kind === 'pipe' ? 'thud' : 'slash', a.x);
    return;
  }
  if (mv.noSmear) { if (struck) g.sound(kind === 'gulp' ? 'chomp' : kind === 'fang' || kind === 'tongue' ? 'squish' : kind === 'scythe' ? 'slash' : kind === 'croak' ? 'punch' : 'blood', a.x); return; }
  // A storm of claws scatters its gashes up and down the rival.
  const fy = mv.flurry ? [-5, 4, -2, 6, -7][i % 5] : 0;
  g.fx('slash', { x: a.x + face * Math.round(mv.range * 0.6), y: a.y + (low ? 12 : mv.launch ? -6 : 2) + fy, face, size: Math.max(18, mv.range * 0.55), kind, fin: finisher ? 1 : 0, color: SLASH[kind] || '#fff', up: mv.launch ? 1 : 0, down: mv.spike ? 1 : 0 });
  if (struck) g.sound(kind === 'claw' ? 'slash' : kind === 'knife' ? 'cut' : kind === 'fang' ? 'squish' : kind === 'blood' ? 'blood' : kind === 'slap' ? 'slap' : 'punch', a.x);
}

// Thrown up and stunned: reeling as long as the stun lasts, so the combo breaker works there too.
function reeling(b) {
  b.hitstun = Math.max(b.hitstun || 0, b.stun);
  b.hitstunMax = Math.max(b.hitstunMax || 0, b.hitstun);
}

// The titan is a much bigger target than her body box.
const bulk = b => (b.form === 'titan' ? 8 : b.form === 'beast' ? 3 : 0);

// Area blows (rings, shockwaves, roars) on the enemy axolotl's clones within rx of x and ry of y.
// dmg(k) gets the closeness, 1 at the center down to 0 at the edge.
export function areaMinions(g, a, x, y, rx, ry, dmg, kind) {
  return hitMinions(g, a.team, m => Math.abs(m.x - x) < rx && Math.abs(m.y - y) < ry, m => {
    const s = Math.sign(m.x - x) || a.face, k = 1 - Math.min(1, Math.abs(m.x - x) / rx);
    hurtMinion(g, m, dmg(k), { x: m.x - s * 3, y: m.y }, a.id, kind, { kb: { x: s * (3 + 5 * k), y: -3 - 3 * k } });
  });
}

function clapRing(g, a, already) {
  const x = a.x + a.face * 18, y = a.y - 4;
  for (const b of g.enemies(a)) {
    if (b.dead || b.knocked || already.has(b.id) || Math.abs(b.x - x) > 70 || Math.abs(b.y - y) > 40) continue;
    const s = Math.sign(b.x - x) || a.face, k = 1 - Math.abs(b.x - x) / 70;
    damage(g, b, 4 + 4 * k, { x: b.x - s * 4, y: b.y }, a.id, 'sonic', { kb: { x: s * (4 + 5 * k), y: -2 - 2 * k } });
  }
  areaMinions(g, a, x, y, 70, 40, k => 4 + 4 * k, 'sonic');
  strikeCourts(g, a, (fx, fy) => Math.abs(fx - x) < 70 && Math.abs(fy - y) < 40, 6, f => Math.sign(f.x - x) || a.face);
  g.fx('clap', { x, y, face: a.face });
  g.sound('thud', x);
}

function croakRing(g, a, mv, already) {
  const x = a.x, y = a.y - 2, R = mv.croak;
  for (const b of g.enemies(a)) {
    const d = Math.hypot(b.x - x, (b.y - y) * 1.6);
    if (b.dead || b.knocked || already.has(b.id) || d > R) continue;
    const s = Math.sign(b.x - x) || a.face, k = 1 - d / R;
    const dealt = damage(g, b, 3 + 5 * k, { x: b.x - s * 4, y: b.y }, a.id, 'croak', { kb: { x: s * (3 + 6 * k), y: -2.5 - 3 * k } });
    if (dealt > 0 && !b.dead && !b.knocked && b.form !== 'titan') b.stun = Math.max(b.stun, 0.3 + 0.3 * k);
  }
  areaMinions(g, a, x, y, R, R * 0.6, k => 3 + 5 * k, 'croak');
  strikeCourts(g, a, (fx, fy) => Math.hypot(fx - x, (fy - y) * 1.6) < R, 6, f => Math.sign(f.x - x) || a.face);
  for (const l of g.limbs) { const d = Math.hypot(l.x - x, l.y - y); if (d < R) Body.setVelocity(l.body, { x: l.body.velocity.x + Math.sign(l.x - x) * 5 * (1 - d / R), y: l.body.velocity.y - 3 * (1 - d / R) }); }
  g.fx('croak', { x, y, r: R, face: a.face });
  g.shake = Math.max(g.shake, 4);
  g.sound('croak', x);
}

// The titan's pound: a fist hammered down into the nearest downed rival, the floor cracking under
// them; they stay down while it lasts.
function pound(g, a, mv, i) {
  const b = g.enemies(a).filter(b => !b.dead && b.knocked && Math.abs(b.x - a.x) < mv.range + 8 && Math.abs(b.y - a.y) < mv.band + 10)
    .sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
  const last = i === mv.hits.length - 1, x = b ? b.x : a.x + a.face * 22;
  // The axolotl's feast: bites instead of blows, and its brood leaps on at the first one.
  if (mv.nibble) {
    g.sound('chomp', x);
    if (!b) return;
    const dealt = damage(g, b, mv.dmg[i] ?? mv.dmg[0], { x: b.x, y: b.y }, a.id, mv.kind, { part: 'body', kb: { x: 0, y: 2 }, force: true });
    if (!dealt) return;
    b.knock = Math.max(b.knock || 0, 0.8);
    g.fx('toothMarks', { x: b.x, y: b.y });
    if (mv.drain) { a.hp = Math.min(a.maxHp, a.hp + dealt * mv.drain); g.fx('drain', { x: b.x, y: b.y - 6, tx: a.x + a.face * 3, ty: a.y - 6 }); }
    if (i === 0 && a.type === 6 && pileOn(g, a, b)) g.text(b.x, b.y - 36, 'BANQUETE!', '#ff9cb8');
    if (last) g.text(b.x, b.y - 30, 'NHAC!', '#ff9cb8');
    return;
  }
  g.fx('quake', { x, y: a.y + 16, p: last ? 6 : mv.quake, face: a.face, both: 1 });
  g.fx('land', { x, y: a.y + 16, p: 1 });
  g.shake = Math.max(g.shake, last ? 10 : 6);
  g.sound('thud', x);
  if (!b) return;
  const r = ragdollOf(g, b);
  for (const l of r ? Object.values(r.limbs) : []) Body.setVelocity(l.body, { x: l.body.velocity.x * 0.4, y: last ? -6 : 3 });
  if (!damage(g, b, mv.dmg[i] ?? mv.dmg[0], { x: b.x, y: b.y }, a.id, mv.kind, { part: 'body', kb: { x: 0, y: 3 }, force: true, lag: mv.lag })) return;
  b.knock = Math.max(b.knock || 0, 1);
  if (last) { g.text(b.x, b.y - 30, 'AMASSOU!', '#ff9a3a'); drama(g, 0.25, a, b); }
}

// A velocity that survives the hitlag freeze the hit just started.
function shove(b, x, y) {
  Body.setVelocity(b.body, { x, y });
  if (b.lagPos) b.lagVel = { x, y };
}

const blocked = (x, y) => x < 14 || x > 946 || MAP.solids.some(s => s.kind !== 'pit' && x + 6 > s.x0 && x - 6 < s.x1 && y + 10 > s.y0 && y - 10 < s.y1);

// Nox's shadow cut: he breaks into bats and comes out past the rival (stopping short of walls,
// blocks and the pit), cutting whoever was on the way; the gash opens a beat later and he turns.
function blinkCut(g, a, mv) {
  const face = a.face, x0 = a.x, y = a.y;
  let dist = mv.blink;
  for (let d = 4; d <= mv.blink; d += 4) {
    const px = x0 + face * d;
    if (blocked(px, y) || (a.ground && px > MAP.pit.x0 - 8 && px < MAP.pit.x1 + 8)) { dist = Math.max(0, d - 4); break; }
  }
  const x1 = x0 + face * dist;
  // Gone and through first, so the freeze of the hit holds him on the far side.
  const victims = g.enemies(a).filter(b => !b.dead && !b.knocked && (b.x - x0) * face >= -4 && (b.x - x0) * face <= dist + 10 && Math.abs(b.y - y) <= mv.band);
  g.fx('batSwarm', { x: x0, y });
  Body.setPosition(a.body, { x: x1, y: a.body.position.y });
  a.x = x1; a.prevFeet = a.body.position.y + HALF_H; a.teleported = g.seq; a.ghostClear = true; a.lagPos = null;
  g.fx('batSwarm', { x: x1, y, arrive: 1 });
  g.fx('shadowLine', { x: x0, y, x2: x1 });
  let first = null;
  for (const b of victims) {
    if (b.iframes > 0 && b.dodge > 0 && !b.perfect) { perfectDodge(g, b); continue; }
    const dealt = damage(g, b, mv.dmg[0], { x: b.x, y: b.y }, a.id, mv.kind, { kb: { x: face * mv.kb[0][0], y: mv.kb[0][1] }, launch: true, dir: face * 0.8 });
    if (!dealt) continue;
    first ||= b;
    a.hp = Math.min(a.maxHp, a.hp + dealt * 0.15);
    if (!b.dead) markBlood(g, b);
    g.fx('shadowX', { x: b.x, y: b.y, delay: 0.1 });
  }
  // The Cat Kings' courts and kingdoms on the way are cut too.
  if (strikeCourts(g, a, (px, py) => (px - x0) * face >= -4 && (px - x0) * face <= dist + 10 && Math.abs(py - y) <= mv.band + 9, mv.dmg[0], () => face)) first ||= true;
  if (first?.id != null) { a.turnTo = first.id; a.turnT = g.time + 0.14; }
  g.sound(first ? 'slash' : 'whoosh', x1);
}

// A downed rival close enough for the execution, by its ragdoll's body.
function downedNear(g, a) {
  return g.enemies(a).some(b => !b.dead && b.knocked && Math.abs(b.x - a.x) < 44 && Math.abs(b.y - a.y) < 40);
}

// The execution: the scythe driven down into a downed rival. A heavy blow through the ragdoll,
// a geyser of blood, a long drink, and they stay down a moment longer.
function execute(g, a, mv) {
  const b = g.enemies(a).filter(b => !b.dead && b.knocked && Math.abs(b.x - a.x) < mv.range + 8 && Math.abs(b.y - a.y) < mv.band + 10)
    .sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
  g.fx('scytheFloor', { x: a.x + a.face * 22, y: a.y + 16, face: a.face });
  g.shake = Math.max(g.shake, 5);
  g.sound('chop', a.x);
  if (!b) return;
  const dealt = damage(g, b, mv.dmg[0], { x: b.x, y: b.y }, a.id, mv.kind, { part: 'body', kb: { x: 0, y: 3 }, force: true });
  if (!dealt) return;
  a.hp = Math.min(a.maxHp, a.hp + dealt * 0.4);
  // It keeps them down a moment longer, once: executions cannot pin someone down forever.
  if (!(b.executedAt > (b.knockedAt ?? -9))) { b.knock = Math.max(b.knock || 0, 0.9); b.executedAt = g.time; }
  g.fx('bloodGeyser', { x: b.x, y: b.y });
  g.fx('drainStream', { x: b.x, y: b.y - 4, tx: a.x + a.face * 3, ty: a.y - 6 });
  g.text(b.x, b.y - 30, 'EXECUÇÃO!', '#ff4a64');
  drama(g, 0.25, a, b);
}

// Ground slams: a ring of force along the floor around the impact.
function shockwave(g, a, mv, amount, already) {
  const x = a.x + a.face * (mv.shockAt ?? 12), y = a.y + 16;
  let struck = false;
  for (const b of g.enemies(a)) {
    if (b.dead || b.knocked || already.has(b.id) || Math.abs(b.x - x) > mv.shock || Math.abs(b.y + 16 - y) > 34) continue;
    const s = Math.sign(b.x - x) || a.face, f = 1 - Math.abs(b.x - x) / mv.shock;
    if (damage(g, b, amount * (0.4 + 0.4 * f), { x: b.x - s * 4, y: b.y + 12 }, a.id, mv.kind, { kb: { x: s * (2 + 6 * f), y: -3 - 4 * f }, knock: f > 0.35, part: Math.random() < 0.5 ? 'footF' : 'footB' })) struck = true;
  }
  if (areaMinions(g, a, x, y - 10, mv.shock, 34, k => amount * (0.4 + 0.4 * k), mv.kind)) struck = true;
  for (const l of g.limbs) if (Math.abs(l.x - x) < mv.shock && Math.abs(l.y - y) < 40) Body.setVelocity(l.body, { x: l.body.velocity.x + Math.sign(l.x - x) * 3, y: l.body.velocity.y - 4 });
  if (strikeCourts(g, a, (px, py) => Math.abs(px - x) < mv.shock && Math.abs(py - y) < 40, amount * 0.6, f => Math.sign(f.x - x) || a.face)) struck = true;
  g.fx('ring', { x, y, size: mv.shock, color: '#ffe6c8' });
  g.fx('land', { x, y, p: 1 });
  g.fx('dust', { x, y, n: 6 + Math.round(mv.shock / 10) });
  g.fx('decal', { x, y: y + 1, k: 'scorch', s: 1 + mv.shock / 40, layer: 'floor' });
  g.shake = Math.max(g.shake, 4 + mv.shock / 12);
  g.sound('thud', x);
  return struck;
}

// Called by a plunge when it touches down.
export function landPlunge(g, a) {
  const mv = MOVES[a.attackKind];
  if (!mv?.plunge) return;
  a.attack = mv.dur * (1 - mv.anim.s);
  a.hits = null;
  strike(g, a, mv, 0);
}

// The blow glances off the defender's weapon: no damage, the attacker's swing recoils.
function ricochet(g, a, b) {
  a.attack = 0; a.hits = null; a.attackCd = 0.28;
  a.stun = Math.max(a.stun, 0.22);
  Body.setVelocity(a.body, { x: -a.face * 3.5, y: a.body.velocity.y - 1 });
  const x = b.x + b.face * 7, y = b.y;
  g.fx('clang', { x, y });
  g.text(x, y - 28, 'TINK!', '#e8f0ff');
  hitlag(a, b, 0.05);
  g.sound('clang2', x);
}

// A blow caught in the parry window: no damage, the attacker reels and the defender counters.
// familiar: the blow came from a familiar (DARK NOX's scythe, one of the King's court): it is batted
// away (the callback sends it off) and its master, somewhere else, is left alone.
// Parried while reeling: the combo is broken, and they are free (and untouchable for an instant).
function breakFree(a) {
  if (!(a.hitstun > 0)) return false;
  a.hitstun = 0; a.hitstunMax = 0; a.hitHeavy = false; a.stun = 0; a.iframes = Math.max(a.iframes || 0, BURST.safe); a.stunN = 0;
  return true;
}

function parried(g, a, o, point, familiar = null) {
  const burst = breakFree(a);
  a.parry = 0; a.parryLag = 0; a.counter = 0.9;
  if (familiar) {
    familiar();
    a.face = point.x >= a.x ? 1 : -1;
    g.fx('parry', { x: point.x, y: point.y });
    g.text(a.x, a.y - 34, burst ? 'QUEBROU O COMBO!' : 'REBATEU!', burst ? '#ffe070' : '#7ce8ff');
    drama(g, 0.2, a);
    g.sound('ricochet', a.x);
    return;
  }
  a.face = o.x >= a.x ? 1 : -1;
  if (o.act) endAct(g, o);
  o.attack = 0; o.hits = null; o.attackCd = 0.6;
  o.stun = Math.max(o.stun, 0.9);
  if (!o.knocked) Body.setVelocity(o.body, { x: (o.x >= a.x ? 1 : -1) * 5, y: -2.5 });
  g.fx('parry', { x: point.x, y: point.y });
  g.fx('impact', { x: point.x, y: point.y, p: 2, a: 0, clash: 1, parry: 1 });
  g.text(a.x, a.y - 34, burst ? 'QUEBROU O COMBO!' : 'PARRY!', burst ? '#ffe070' : '#7ce8ff');
  if (isMelee(a.weapon)) { g.fx('clang', { x: a.x + a.face * 7, y: a.y, big: 1 }); g.sound('clang', a.x); }
  drama(g, 0.3, a, o);
  hitlag(a, o, 0.1);
  g.sound('ricochet', a.x);
}

// Dodging through a blow at the last moment.
export function perfectDodge(g, a) {
  a.perfect = true;
  a.perfectT = 0.45;
  g.text(a.x, a.y - 34, 'ESQUIVA!', '#c8f0ff');
  g.fx('perfect', { x: a.x, y: a.y, face: a.face });
  g.fx('focus', { x: a.x, y: a.y, p: 0.5 });
  drama(g, 0.28, a);
  g.sound('swing', a.x);
}

export function cutCorpse(g, limb) {
  const r = limb.ragdoll;
  const j = r.joints.find(j => !j.broken && (j.child === limb.part || j.parent === limb.part));
  if (j) breakJoint(g, r, j, 'cut');
}

export function shoot(g, a) {
  let ang = a.aim ?? (a.face > 0 ? 0 : Math.PI);
  // A bot set on razing a kingdom aims at it.
  if (a.bot && a.ai?.aimAt) ang = Math.atan2(a.ai.aimAt.y - (a.y + 5), a.ai.aimAt.x - a.x);
  else if (a.bot || a.input.aimX === null) {
    const t = g.closest(a, 680);
    if (t && (a.bot || a.input.padAim == null)) ang = Math.atan2(t.y - (a.y + 5), t.x - a.x);
  }
  a.face = Math.cos(ang) >= 0 ? 1 : -1;
  a.aim = ang;
  const shotgun = a.weapon === 'shotgun';
  const count = shotgun ? 5 : 1;
  const sx = a.x + a.face * 6, sy = a.y + 6;
  for (let i = 0; i < count; i++) {
    const spread = shotgun ? 0.07 : 0.015;
    const an = ang + (i - (count - 1) / 2) * spread + (shotgun ? rnd(-0.03, 0.03) : 0);
    const speed = shotgun ? 17 : 21;
    const ox = sx + Math.cos(an) * 12, oy = sy + Math.sin(an) * 12;
    g.bullets.push({
      id: g.nextId++, owner: a.id, team: a.team, x: ox, y: oy, px: ox, py: oy, vx: Math.cos(an) * speed, vy: Math.sin(an) * speed,
      damage: shotgun ? 8 : 15, life: 0.9, color: '#ffe7a8', kind: shotgun ? 'pellet' : 'bullet', bounces: 0
    });
  }
  a.ammo--;
  g.fx('casing', { x: sx, y: sy, d: -a.face, n: 1 });
  if (a.ammo <= 0) { a.weapon = null; g.text(a.x, a.y - 26, 'SEM MUNIÇÃO', '#e4b18a'); }
  const kick = shotgun ? 3.5 : 1.2;
  pushActor(g, a, -Math.cos(ang) * kick, -Math.sin(ang) * kick * 0.4);
  a.recoil = shotgun ? 1 : 0.6;
  g.sound(shotgun ? 'shotgun' : 'gun', a.x);
  g.fx('muzzle', { x: sx + Math.cos(ang) * 14, y: sy + Math.sin(ang) * 14, a: ang, big: shotgun ? 1 : 0, color: '#fff1c4' });
}

// Bullets are swept with ray queries so fast shots never tunnel through thin limbs.
export function stepBullets(g, dt) {
  const statics = g.staticBodies;
  for (const b of [...g.bullets]) {
    // Lola's laid knives hang where she put them until they fly (sim/timestop.js).
    if (b.set && (b.k < 1 || b.hold > 0) && stepSetKnife(g, b, dt)) continue;
    b.life -= dt;
    if (b.life <= 0) {
      if (!b.court) g.fx('decal', { x: b.x, y: b.y, k: 'hole', s: 1, layer: 'wall' });
      removeBullet(g, b);
      continue;
    }
    // Arrows fall a little as they fly.
    if (b.grav) b.vy = Math.min(16, b.vy + b.grav);
    const nx = b.x + b.vx, ny = b.y + b.vy;
    const candidates = [...statics];
    for (const a of g.actors) if (!a.dead && !a.knocked && a.swallowedBy == null && a.id !== b.owner && a.team !== b.team) candidates.push(a.body);
    for (const p of g.props) if (!p.held) candidates.push(p.body);
    for (const m of g.minions) if (m.team !== b.team && m.body && targetable(m)) candidates.push(m.body);
    for (const l of g.limbs) candidates.push(l.body);
    g.hz?.bulletBodies?.forEach(x => candidates.push(x));
    const hits = Query.ray(candidates, { x: b.x, y: b.y }, { x: nx, y: ny }, 3);
    let best = null, bestT = Infinity;
    for (const h of hits) {
      const body = h.body || h.bodyA;
      const t = entryT(body, b.x, b.y, nx, ny);
      if (t < bestT) { bestT = t; best = body; }
    }
    hazardBulletHit(g, b, nx, ny);
    // A familiar of the Cat King's (or a rival's kingdom: its structure stops shots) on the way, before
    // anything else it would hit.
    const fam = b.damage > 0 ? courtInPath(g, b, nx, ny) : null;
    if (fam && fam.u <= bestT) {
      const dir = Math.sign(b.vx) || 1;
      if (fam.kg) hurtKingdom(g, fam.kg, fam.f, fam.f === fam.kg ? b.damage : b.damage * (b.kind === 'pellet' ? 1 : 0.8), b.owner, dir, b.kind === 'pellet' ? 'pellet' : 'shot');
      else hurtFamiliar(g, fam.k, fam.f, b.damage * (b.kind === 'pellet' ? 1 : 0.8), b.owner, dir);
      if (fam.kg && fam.f === fam.kg) g.fx('spark', { x: Math.round(b.x + (nx - b.x) * fam.u), y: Math.round(b.y + (ny - b.y) * fam.u), n: 3, a: Math.atan2(-b.vy, -b.vx) });
      removeBullet(g, b);
      continue;
    }
    b.px = b.x; b.py = b.y;
    if (best) {
      const t = Math.max(0, Math.min(1, bestT));
      const hx = b.x + (nx - b.x) * t, hy = b.y + (ny - b.y) * t;
      if (bulletHit(g, b, best, { x: hx, y: hy })) continue;
    }
    b.x = nx; b.y = ny;
    if (b.x < -60 || b.x > 1020 || b.y < -200 || b.y > 640) removeBullet(g, b);
  }
}

function entryT(body, x0, y0, x1, y1) {
  const bb = body.bounds, dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[x0, dx, bb.min.x, bb.max.x], [y0, dy, bb.min.y, bb.max.y]]) {
    if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return Infinity; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

export function removeBullet(g, b) {
  const i = g.bullets.indexOf(b);
  if (i >= 0) g.bullets.splice(i, 1);
}

// A knife of Lola's super landing: a sliver of damage each, and past a little over half of the
// knives aimed at a rival the next one knocks them down. A few stay stuck in them.
function knifeHit(g, b, a, point, angle) {
  const knock = knifeKnock(g, b, a), s = Math.sign(b.vx) || 1;
  const dealt = damage(g, a, b.damage, point, b.owner, 'knife', { kb: knock ? { x: s * 5, y: -4.5 } : { x: b.vx * 0.08, y: b.vy * 0.05 - 0.4 }, dir: angle, knock, solo: true });
  if (!dealt) return;
  knifeKnocked(g, b, a, knock);
  if (a.dead) return;
  g.fx('knifeHit', { x: point.x, y: point.y, a: angle });
  if (a.embedded.filter(e => e.kind === 'knife').length < 3 && Math.random() < 0.3) {
    const part = ['body', 'head', 'body', 'armF', 'footF'][Math.floor(rnd(0, 5))];
    if (!a.severed.includes(part)) a.embedded.push({ part, kind: 'knife', a: angle * (a.face || 1), u: 0, v: 0 });
  }
}

// Returns true when the bullet is consumed.
function bulletHit(g, b, body, point) {
  const angle = Math.atan2(b.vy, b.vx);
  const a = body.plugin.actor, p = body.plugin.prop, l = body.plugin.limb, m = body.plugin.minion;
  if (m) {
    if (!targetable(m) || m.team === b.team) return false;
    hurtMinion(g, m, b.damage ?? 10, point, b.owner, b.kind || 'bullet', { kb: { x: b.vx * 0.16, y: b.vy * 0.1 - 1 } });
    removeBullet(g, b);
    return true;
  }
  if (a) {
    if (a.id === b.owner || a.team === b.team || a.dead) return false;
    const swingDeflect = isMelee(a.weapon) && a.attack > 0 && MOVES[a.attackKind]?.weapon && (b.x - a.x) * a.face > 0 && Math.random() < 0.6;
    if (a.parry > 0 || swingDeflect) {
      if (swingDeflect) g.fx('clang', { x: point.x, y: point.y });
      b.vx = -b.vx; b.vy = -b.vy; b.owner = a.id; b.team = a.team; b.life = 0.9;
      b.x = point.x + b.vx * 0.5; b.y = point.y + b.vy * 0.5;
      // A shot parried while reeling breaks the combo as well.
      const burst = a.parry > 0 && breakFree(a);
      a.parry = 0; a.parryLag = 0;
      g.text(a.x, a.y - 34, burst ? 'QUEBROU O COMBO!' : 'REBATEU!', burst ? '#ffe070' : '#7ce8ff');
      g.fx('parry', { x: point.x, y: point.y });
      g.sound('ricochet', a.x);
      return true;
    }
    if (b.kind === 'knife') knifeHit(g, b, a, point, angle);
    else if (b.court) {
      // The court's arrows: no freeze on the King far away, and they keep the rival reeling. A castle's
      // archers' (gate) make them reel only once every so often, with the court's own blows.
      const light = !!b.gate && g.time - (a.courtReelT ?? -9) < AUTO.stagger;
      if (b.gate && !light) a.courtReelT = g.time;
      const dealt = damage(g, a, b.damage, point, b.owner, b.kind, { kb: { x: b.vx * 0.12, y: Math.min(0, b.vy * 0.05) - 0.8 }, dir: angle, solo: true, light });
      if (dealt && !a.dead && !a.knocked && b.hold && !light) { a.hitstun = Math.max(a.hitstun || 0, b.hold); a.hitstunMax = Math.max(a.hitstunMax || 0, a.hitstun); }
      if (dealt && !b.auto) { const k = g.actor(b.owner); if (k) { k.lastPrey = a.id; k.lastPreyT = g.time; } }
    }
    else damage(g, a, b.damage, point, b.owner, b.kind, { kb: { x: b.vx * 0.16, y: b.vy * 0.1 - 1 }, dir: angle });
  } else if (l) {
    const owner = g.actor(l.actor);
    if (l.attached && owner && !owner.dead && owner.knocked) {
      if (owner.team === b.team) return false;
      damage(g, owner, b.damage, point, b.owner, b.kind, { part: l.part, kb: { x: b.vx * 0.05, y: b.vy * 0.05 }, solo: b.kind === 'knife' });
    } else {
      woundLimb(g, l, point, 'hole', 1);
      l.hp -= b.damage;
      l.bleed = Math.max(l.bleed, 1.5);
      if ((g.settings.gore ?? 2) === 2 && l.hp <= 0 && l.ragdoll) cutCorpse(g, l);
      if (g.settings.gore) g.fx('blood', { x: point.x, y: point.y, dx: b.vx * 0.2, dy: -1, n: 6, s: 3 });
    }
    Body.setVelocity(l.body, { x: l.body.velocity.x + b.vx * 0.25, y: l.body.velocity.y + b.vy * 0.25 - 0.5 });
  } else if (p) {
    if (p.kind === 'cargo' || p.fixed) g.fx('spark', { x: point.x, y: point.y, n: 4, a: angle + Math.PI });
    damageProp(g, p, b.damage, b.owner);
    if (g.props.includes(p) && !p.body.isStatic) Body.applyForce(p.body, point, { x: b.vx * 0.0006, y: b.vy * 0.0006 });
    if (p.kind === 'gun' || p.kind === 'pipe' || p.kind === 'blade' || p.kind === 'extinguisher') g.fx('spark', { x: point.x, y: point.y, n: 3, a: angle + Math.PI });
  } else if (body.plugin.hazard) {
    if (body.plugin.hazard.onBullet(g, b, point) === false) return false;
  } else if (body.plugin.cable) {
    Body.setVelocity(body, { x: body.velocity.x + b.vx * 0.3, y: body.velocity.y + b.vy * 0.3 });
    return false;
  } else if (body.isStatic) {
    // A knife that misses stays stuck in the wall or the floor for a while.
    if (b.kind === 'knife') {
      if (body === g.hz?.press?.body) g.fx('spark', { x: point.x, y: point.y, n: 4, a: angle + Math.PI });
      else g.fx('knifeStick', { x: point.x, y: point.y, a: angle });
      g.sound('knifeStick', point.x);
    }
    else {
      const bb = body.bounds;
      const fromTop = b.y <= bb.min.y + 1, fromSide = b.x <= bb.min.x + 1 || b.x >= bb.max.x - 1;
      const n = fromTop ? [0, -1] : fromSide ? [b.x <= bb.min.x + 1 ? -1 : 1, 0] : [0, 1];
      const dirx = b.vx / Math.hypot(b.vx, b.vy), diry = b.vy / Math.hypot(b.vx, b.vy);
      const dot = Math.abs(dirx * n[0] + diry * n[1]);
      if (dot < 0.38 && b.bounces < 1) {
        if (n[0]) b.vx = -b.vx; else b.vy = -b.vy;
        b.bounces++;
        b.x = point.x + n[0] * 2; b.y = point.y + n[1] * 2;
        g.fx('spark', { x: point.x, y: point.y, n: 5, a: Math.atan2(b.vy, b.vx) });
        g.sound('ricochet', point.x);
        return true;
      }
      g.fx('spark', { x: point.x, y: point.y, n: 4, a: Math.atan2(n[1], n[0]) });
      g.fx('decal', { x: point.x, y: point.y, k: 'hole', s: 1, layer: fromTop ? 'floor' : 'wall' });
    }
  } else return false;
  removeBullet(g, b);
  return true;
}

export function woundLimb(g, l, point, type, size) {
  const [u, v] = partSpace({ name: l.part, x: 0, y: 0, angle: l.body.angle * l.face }, l.face, l.body.position.x, l.body.position.y, point, l.type);
  if (l.wounds.length < 7) l.wounds.push({ u: clamp(u, -7, 7), v: clamp(v, -7, 7), t: type, s: size });
}

// Wounds are kept in the part's own pixel space (cells from its pivot, facing right, unrotated).
function partSpace(bone, face, ax, ay, point, type) {
  const ang = -bone.angle * face;
  const dx = point.x - (ax + bone.x * face), dy = point.y - (ay + bone.y);
  let u = (dx * Math.cos(ang) - dy * Math.sin(ang)) * S, v = (dx * Math.sin(ang) + dy * Math.cos(ang)) * S;
  if (face < 0) u = -u;
  const [ox, oy] = PIVOT_FROM_CENTER[type]?.[bone.name] || [0, 0];
  return [Math.round(u + ox), Math.round(v + oy)];
}
function addWound(a, bone, point, type, amount, dir) {
  const [u, v] = partSpace(bone, a.face, a.x, a.y, point, a.type);
  const list = (a.wounds[bone.name] ||= []);
  const w = { u: clamp(u, -7, 7), v: clamp(v, -7, 7), t: type, s: clamp(amount / 12, 0.6, 3) };
  if (type === 'cut') w.a = dir !== undefined ? dir : rnd(-1, 1);
  if (list.length >= 5) {
    const near = list.reduce((m, x) => (Math.hypot(x.u - w.u, x.v - w.v) < Math.hypot(m.u - w.u, m.v - w.v) ? x : m));
    near.s = Math.min(3.5, near.s + w.s * 0.5);
    if (type === 'cut' || type === 'hole') near.t = type;
  } else list.push(w);
}

export function breakBone(g, a, part) {
  const limb = limbOf(part);
  if (!limb || a.broken[limb] || a.dead) return;
  a.broken[limb] = true;
  g.text(a.x, a.y - 30, 'QUEBROU!', '#f0d2b0');
  g.sound('crack', a.x);
  g.fx('spark', { x: a.x, y: a.y + 2, n: 3, color: '#f2e8cf' });
  if (limb === 'armF') { releaseHeld(g, a); if (a.weapon && !isGun(a.weapon)) dropWeapon(g, a); }
}

export function damage(g, a, amount, point, ownerId, kind = 'punch', opts = {}) {
  if (!a || a.dead || amount <= 0) return 0;
  // Inside the frog nothing reaches them.
  if (a.swallowedBy != null) return 0;
  const cat = KIND[kind] || 'blunt';
  const owner = g.actor(ownerId);
  // Mid-requiem Nox is a blur of blood, a swarm of bats has nothing to hit, and Lola holding the
  // world still is out of everyone's time: fighters cannot touch them. Neither can they touch Juma
  // tearing into someone in her frenzy, or turning into her next form.
  if ((a.act === 'requiem' || a.act === 'swarm' || a.act === 'world' || (a.act === 'frenzy' && a.frenzy?.prey != null)) && owner && owner !== a) return 0;
  if (a.act === 'morph' && owner && owner !== a && !opts.environment && !['crush', 'grind'].includes(kind)) { if (!DOT.has(cat)) g.fx('armor', { x: point.x, y: point.y, a: 0 }); return 0; }
  if ((a.invincible > 0 || a.iframes > 0) && !['grind', 'bleed', 'crush'].includes(cat) && !opts.force) {
    if (a.iframes > 0 && a.dodge > 0 && owner && owner !== a && !DOT.has(cat) && !a.perfect) perfectDodge(g, a);
    return 0;
  }
  if (a.parry > 0 && owner && owner !== a && owner.team !== a.team && !DOT.has(cat) && !opts.environment && !['explosion', 'grind'].includes(cat) && kind !== 'fall' && kind !== 'crush') {
    // A clone's bite caught in the parry: the clone reels, not the axolotl across the arena.
    if (opts.src) parriedClone(g, a, opts.src, point);
    else parried(g, a, owner, point, opts.familiar);
    return 0;
  }
  if (owner && ownerId !== a.id && owner.team === a.team) return 0;
  // The Cat King's shield-bearer takes the blow for him (or for the frog holding him; sim/court.js).
  if (a.court && !DOT.has(cat) && !opts.environment && !['explosion', 'grind'].includes(cat) && kind !== 'fall' && kind !== 'crush' && shieldBlocks(g, a, owner, amount, point)) return 0;
  if (a.act === 'ball') amount *= 0.5;
  // Juma's beast and titan take blows on a thick hide. The beast does not flinch while she swings
  // or charges (super armor); the titan does not flinch at all. Explosions still throw them and
  // the press still crushes them. DARK NOX, rising, takes half; as DARK NOX his own share.
  if (a.type === 3 && a.form && !DOT.has(cat)) amount *= formOf(a).armor;
  if (a.act === 'darkRise') amount *= 0.5;
  if (a.form === 'dark' && !DOT.has(cat)) amount *= DARK.armor;
  const tough = ((a.form === 'beast' && (a.attack > 0 || ['charge', 'leap', 'meteor', 'clap', 'crush'].includes(a.act))) || a.form === 'titan' || a.act === 'morph' || a.act === 'darkRise') && cat !== 'explosion' && !opts.environment && kind !== 'crush' && kind !== 'grind';
  if (a.frozen > 0 && (cat === 'blunt' || cat === 'explosion' || cat === 'pierce') && amount >= 14) {
    a.lastHit = ownerId; a.lastHitTime = g.time;
    kill(g, a, ownerId, { kind: 'shatter' });
    return amount;
  }
  if (a.weapon && ['paw', 'kick', 'claw', 'explosion', 'pipe', 'blade', 'katana', 'axe', 'spear', 'hammer', 'stomp', 'hemo'].includes(kind) && amount >= 14) {
    dropWeapon(g, a);
    g.text(a.x, a.y - 30, 'DESARMADO!', '#e7caa4');
  }
  const bones = pose(a, g.time).filter(b => !a.severed.includes(b.name));
  let bone = opts.part ? bones.find(b => b.name === opts.part) : null;
  if (!bone) bone = bones.slice().sort((b, c) => Math.hypot(a.x + b.x * a.face - point.x, a.y + b.y - point.y) - Math.hypot(a.x + c.x * a.face - point.x, a.y + c.y - point.y))[0];
  const part = bone?.name || 'body';
  const woundType = { blunt: 'bruise', cut: 'cut', pierce: 'hole', explosion: 'burn', fire: 'burn', shock: 'burn', freeze: 'frost', grind: 'cut' }[cat];
  if (bone && woundType && (!DOT.has(cat) || Math.random() < 0.15)) addWound(a, bone, point, woundType, amount, opts.dir);
  a.partDmg[part] = (a.partDmg[part] || 0) + amount;
  a.hp -= amount;
  feedRage(g, a, amount);
  // Every blow on a full frog loosens his hold on whoever is inside.
  if (a.belly != null) a.bellyT -= amount * 0.06;
  a.hurt = 0.16;
  if (!DOT.has(cat) || ownerId !== a.id) { a.lastHit = ownerId; a.lastHitTime = g.time; }
  // Real blows only (not bleeding or burning): who just struck this fighter (the Cat King's court watches).
  if (!DOT.has(cat) && owner && owner !== a) { a.blowBy = ownerId; a.blowT = g.time; }
  a.lastHitKind = kind;
  if (owner && ownerId !== a.id) owner.stats.damage += amount;
  // The rival a fighter's string is on: blows only, not a thrown knife that strays into a bystander
  // nor a clone's bite.
  if (owner && owner !== a && !DOT.has(cat) && !opts.solo && !opts.src) { owner.lastPrey = a.id; owner.lastPreyT = g.time; }
  const gore = g.settings.gore ?? 2;
  if (gore && !DOT.has(cat)) g.fx('blood', { x: point.x, y: point.y, dx: (opts.kb?.x || 0) * 0.4, dy: -1.5, n: Math.round(Math.min(40, amount * (gore === 2 ? 1.5 : 0.5))), s: cat === 'cut' ? 4.5 : 3 });
  // The blood a blow draws ends up on the floor (Nox drinks it there).
  const spilt = cat === 'cut' || cat === 'grind' ? 1 : cat === 'pierce' ? 0.8 : cat === 'blunt' && amount >= 8 && kind !== 'fall' ? 0.5 : 0;
  if (spilt) spill(g, point.x + (opts.kb?.x || 0) * 2, point.y, amount * POOL.spill * spilt);

  if (cat === 'blunt' && limbOf(part) && a.partDmg[part] >= 42 && amount >= 12) breakBone(g, a, part);
  // The axolotl does not bleed out: it closes over and grows back.
  if (cat === 'cut' && a.type !== 6) a.bleed = Math.min(6, a.bleed + amount * 0.05);
  if (cat === 'pierce' && a.type !== 6) a.bleed = Math.min(6, a.bleed + amount * 0.025);
  if (cat === 'fire') a.char = Math.min(1, a.char + 0.035);
  if (cat === 'explosion') a.char = Math.min(1, a.char + 0.3);
  if (cat === 'shock') { a.char = Math.min(1, a.char + 0.02); a.shock = Math.max(a.shock, 0.35); }
  // The axolotl sheds by its own rule; only its head can be cut off the usual way.
  if (a.type === 6 && !DOT.has(cat)) {
    axoHit(g, a, part, amount, cat, !!opts.low);
    if (gore === 2 && cat === 'cut' && part === 'head' && a.partDmg.head > 30 && a.hp < 25 && EDGED.includes(kind)) sever(g, a, 'head', ownerId);
  } else if (gore === 2 && cat === 'cut' && part !== 'body' && a.partDmg[part] > (kind === 'axe' ? 22 : 30) && (EDGED.includes(kind) || amount > 18) && (part !== 'head' || a.hp < 25)) sever(g, a, part, ownerId);
  if (a.dead) return amount;

  const w = weightOf(a);
  const kb = opts.kb || { x: (owner && owner !== a ? (a.x >= owner.x ? 1 : -1) : rnd(-1, 1)) * amount * 0.12, y: -2 };
  const kx = kb.x / w, ky = kb.y / w, mag = Math.hypot(kx, ky);
  let knock = false;
  // A clone's nibble only stings: no push, no stagger, no freeze. It keeps a rival that is already
  // reeling from the axolotl's string reeling, and never starts it.
  if (opts.chip) {
    if (a.hp <= 0) kill(g, a, ownerId, { kind: opts.killKind || kind, part, kb: { x: 0, y: -2 } });
    else {
      const t = a.dmgText;
      if (t && t.life > 0.55 && g.effects.includes(t)) { t.sum += amount; t.text = `-${Math.round(t.sum)}`; t.life = 1; t.x = a.x; t.y = a.y - 26; }
      else { g.text(a.x + rnd(-6, 6), a.y - 26, `-${Math.round(amount)}`, '#ffb3c8'); a.dmgText = g.effects[g.effects.length - 1]; a.dmgText.sum = amount; }
      g.fx('hit', { x: point.x, y: point.y, p: 0.4, a: 0, cut: 0 });
      if (opts.echo && owner && owner.team !== a.team) countHit(g, owner);
    }
    return amount;
  }
  if (a.hp > 0) {
    // Launchers send the target flying instead of ragdolling it, so the air combo can follow.
    knock = !tough && (opts.knock || (!opts.launch && mag > 10.5) || (cat === 'explosion' && amount > 10) || (cat === 'blunt' && amount >= 28 && kind !== 'fall'));
    if (knock) knockdown(g, a, { velocity: { x: kx, y: ky }, time: clamp(0.9 + amount * 0.02, 1, 2.6) });
    else if (a.knocked) pushActor(g, a, kx * 0.6, ky * 0.6);
    else if (tough) { if (owner && owner !== a && !DOT.has(cat)) g.fx('armor', { x: point.x, y: point.y, a: Math.atan2(ky, kx || 1) }); }
    else if (mag > 0.1) {
      const v = a.body.velocity;
      // Hits in the air keep the target afloat so combos can continue there (juggles).
      // (noLift: the Cat King's court striking on its own does not juggle anyone up)
      const juggle = !a.ground && !DOT.has(cat) && owner && owner !== a && !opts.noLift;
      const lift = owner && !owner.ground ? -1.4 : -3.2;
      Body.setVelocity(a.body, { x: juggle ? kx * 0.5 : v.x + kx, y: juggle ? Math.min(ky, lift) : Math.min(v.y, ky < 0 ? ky : v.y + ky) });
      if (juggle) a.float = 0.35;
      a.stun = Math.max(a.stun, 0.08 + mag * 0.022);
    }
    if (!knock && !a.knocked && !tough && !DOT.has(cat) && kind !== 'fall' && !opts.light) stagger(g, a, amount, Math.sign(kx) || (owner && owner !== a ? Math.sign(a.x - owner.x) : 0));
  }
  if (!DOT.has(cat)) {
    const heavy = knock || amount >= 14;
    g.shake = Math.max(g.shake, Math.min(heavy ? 9 : 6, amount / (heavy ? 4 : 7)));
    // A fighter plunging through the air (stomps, the beast's leap and meteor) keeps falling.
    // A thrown knife freezes only whoever it hits (solo), not the thrower; a clone's bite only its victim.
    hitlag(a, owner && owner !== a && !opts.solo && !opts.src && Math.abs(owner.x - a.x) < 70 && !['stomp', 'leap', 'meteor'].includes(owner.act) ? owner : null, (heavy ? clamp(amount * 0.005, 0.07, 0.13) : clamp(amount * 0.003, 0.03, 0.06)) * (opts.lag || 1));
    const dir = Math.atan2(ky, kx || (owner ? a.x - owner.x : 1));
    g.fx('hit', { x: point.x, y: point.y, p: Math.min(3, amount / 8), a: dir, cut: cat === 'cut' ? 1 : 0, blood: kind === 'blood' || kind === 'hemo' ? 1 : 0 });
    if (heavy && owner && owner !== a) {
      g.fx('impact', { x: point.x, y: point.y, p: Math.min(3, amount / 9), a: dir, knock: knock ? 1 : 0 });
      if (knock) drama(g, 0.32, a, owner);
    }
    g.sound(cat === 'cut' ? 'slash' : cat === 'pierce' ? 'hit' : cat === 'explosion' ? 'thud' : 'punch', a.x);
    if (owner && owner !== a && owner.team !== a.team) countHit(g, owner);
  }
  if (!DOT.has(cat)) {
    // Blows landing close together on one fighter add up into a single growing number.
    const t = a.dmgText;
    if (t && t.life > 0.55 && g.effects.includes(t)) { t.sum += amount; t.text = `-${Math.round(t.sum)}`; t.life = 1; t.x = a.x; t.y = a.y - 26; }
    else { g.text(a.x + rnd(-6, 6), a.y - 26, `-${Math.round(amount)}`, '#f6bb9f'); a.dmgText = g.effects[g.effects.length - 1]; a.dmgText.sum = amount; }
  } else if (amount >= 4) g.text(a.x + rnd(-8, 8), a.y - 26, `-${Math.round(amount)}`, '#e6a37a');
  if (a.hp <= 0) kill(g, a, ownerId, { kind: opts.killKind || kind, part, kb: { x: kx, y: ky }, overkill: -a.hp + amount > a.maxHp * 0.6 || opts.overkill });
  return amount;
}

// A clone or a thrown part caught in a parry: it bounces back dazed; its axolotl is not punished.
function parriedClone(g, a, m, point) {
  a.parry = 0; a.parryLag = 0; a.counter = 0.9;
  a.face = m.x >= a.x ? 1 : -1;
  if (m.body && !m.dead) {
    m.act = m.kind === 'seed' ? m.act : null; m.latch = null;
    m.hitstun = Math.max(m.hitstun || 0, 0.6); m.hitstunMax = m.hitstun;
    Body.setVelocity(m.body, { x: (m.x >= a.x ? 1 : -1) * 5, y: -3 });
  }
  g.fx('parry', { x: point.x, y: point.y });
  g.text(a.x, a.y - 34, 'PARRY!', '#7ce8ff');
  g.sound('ricochet', a.x);
}

// Getting hit interrupts whatever the fighter was doing and locks them out for a moment (hitstun),
// long enough for the attacker's next hit in the string to land first. Long strings wear it down.
function stagger(g, a, amount, dir) {
  if (a.act === 'ball') return;
  // Blows landing on the same step trade: a strike of the victim's due this very step still goes out.
  if (a.hits?.length && a.tickSeq !== g.seq && !(a.hitlag > 0) && !g.trading && a.attack - 1 / 60 <= a.hits[0].at) {
    g.trading = true;
    try { strike(g, a, MOVES[a.attackKind], a.hits.shift().i); } finally { g.trading = false; }
    if (a.dead || a.knocked) return;
  }
  if (a.act) {
    endAct(g, a);
    if (a.holdingLimb || a.holdJoint) releaseHeld(g, a);
  }
  a.attack = 0; a.hits = null; a.comboTimer = 0; a.combo = 0;
  a.bufA = 0; a.bufP = 0; a.dashStrike = false; a.chase = null;
  a.parry = 0;
  if (a.dodge > 0) { a.dodge = 0; a.dodgeKind = null; }
  if (a.climbing) { a.climbing = false; a.climbCd = 0.3; }
  a.stunN = g.time - (a.stunT ?? -9) < 0.9 ? (a.stunN || 0) + 1 : 1;
  a.stunT = g.time;
  const wear = Math.max(0.7, 1 - Math.max(0, a.stunN - 3) * 0.05);
  const t = clamp(0.22 + amount * 0.016, 0.28, 0.6) * wear;
  if (t >= (a.hitstun || 0)) { a.hitstun = t; a.hitstunMax = t; a.hitHeavy = amount >= 13; }
  a.hitDir = dir || a.hitDir || -(a.face || 1);
}

// Blood marks left by Nox: up to three, gone five seconds after the last one.
export function markOf(g, b) { return b.bloodMark && g.time - (b.markT ?? -9) < 5 ? b.bloodMark : 0; }
export function markBlood(g, b) {
  b.bloodMark = Math.min(3, markOf(g, b) + 1);
  b.markT = g.time;
}

const HYPE = { 4: 'MASSA!', 6: 'BRUTAL!', 9: 'INSANO!', 12: 'ÉPICO!!', 16: 'LENDÁRIO!!!' };
// Hits landed within a short window of each other build a combo.
function countHit(g, a) {
  a.chain = g.time - (a.chainT ?? -9) < 1.1 ? (a.chain || 0) + 1 : 1;
  a.chainT = g.time;
  if (HYPE[a.chain]) {
    // Each new word replaces the last one instead of piling up on it.
    const old = g.effects.indexOf(a.hypeText);
    if (old >= 0) g.effects.splice(old, 1);
    g.text(a.x, a.y - 40, HYPE[a.chain], ['#ffd36c', '#ff9a6c', '#ff6c8c', '#c88cff', '#7ce8ff'][Object.keys(HYPE).indexOf(String(a.chain))]);
    a.hypeText = g.effects[g.effects.length - 1];
    g.fx('focus', { x: a.x, y: a.y, p: 0.5 });
  }
}

export function sever(g, a, part, owner) {
  if (a.severed.includes(part)) return;
  if (a.knocked) {
    const r = ragdollOf(g, a);
    const j = r?.joints.find(j => j.child === part && !j.broken);
    if (j) breakJoint(g, r, j, 'cut');
    if (part === 'head' && !a.dead) { a.hp = 0; kill(g, a, owner, { kind: 'decap' }); }
    return;
  }
  const group = subtree(part).filter(n => !a.severed.includes(n));
  const bones = pose(a, g.time);
  const r = { id: g.nextId++, actor: a.id, limbs: {}, joints: [], alive: false, muscle: 0, group: -(9000 + g.nextId), detached: true };
  for (const name of group) {
    const b = bones.find(x => x.name === name);
    if (!b) continue;
    const l = makeLimb(g, a, b, { velocity: { x: a.body.velocity.x + rnd(-2, 2) + a.face * -1.5, y: rnd(-6, -3) }, group: r.group, spin: 0.2 });
    l.ragdoll = r;
    l.bleed = 4;
    if (name === part) addStump(l);
    r.limbs[name] = l;
  }
  g.ragdolls.push(r);
  a.severed.push(...group);
  a.stumps.push(PARENT[part]);
  a.bleed = Math.min(8, a.bleed + 2);
  if (part === 'head') { a.hp = 0; kill(g, a, owner, { kind: 'decap' }); }
  if (part === 'armF') { a.weapon = null; releaseHeld(g, a); }
  g.fx('blood', { x: a.x, y: a.y, dx: -a.face * 2, dy: -4, n: 26, s: 5 });
  spill(g, a.x, a.y, 5);
  g.text(a.x, a.y - 30, 'CRAC!', '#e99598');
  g.sound('squish', a.x);
  if (owner != null) { const o = g.actor(owner); if (o) o.stats.limbs++; }
}

export function kill(g, a, ownerId, { kind = 'punch', kb = { x: 0, y: -2 }, overkill = false } = {}) {
  if (a.dead) return;
  a.dead = true;
  a.deaths++;
  a.hp = 0;
  a.respawn = g.mode === 'sandbox' ? 2 : 3.5;
  a.deathKind = kind;
  const killer = g.actor(ownerId);
  const credit = killer;
  if (credit && credit.id !== a.id) {
    credit.kills++;
    credit.stats.kills++;
    g.onEvent({ type: 'kill', killer: credit.name, victim: a.name, kind });
    g.netEvents.push({ id: ++g.eventId, time: g.time, seq: g.seq, type: 'kill', killer: credit.name, victim: a.name, kind });
    if (g.mode !== 'sandbox' && g.mode !== 'attract' && credit.kills >= g.killsToWin && g.winPending === null) {
      g.winPending = credit.id;
      g.slowmo = 1.2;
    }
  } else {
    g.onEvent({ type: 'kill', killer: null, victim: a.name, kind });
    g.netEvents.push({ id: ++g.eventId, time: g.time, seq: g.seq, type: 'kill', killer: null, victim: a.name, kind });
  }
  releaseHeld(g, a);
  a.act = null;
  a.hits = null;
  if (a.weapon) dropWeapon(g, a);
  // The dead bleed out where they fall: a pool for Nox (nothing from a frozen statue).
  if (kind !== 'shatter') spill(g, a.x, a.y, kind === 'grind' || kind === 'crush' || kind === 'explosion' ? 12 : 7);
  for (const e of a.embedded) if (e.kind === 'blade') { /* the blade stays in the corpse */ }
  const gore = g.settings.gore ?? 2;
  if (kind === 'shatter') {
    const r = a.knocked ? ragdollOf(g, a) : buildRagdoll(g, a, { velocity: { x: a.body.velocity.x, y: -3 }, alive: false, spin: 0.3 });
    if (!a.knocked) Composite.remove(g.engine.world, a.body);
    for (const l of Object.values(r.limbs)) l.frozen = true;
    for (const j of r.joints) breakJoint(g, r, j, 'gib');
    for (const l of Object.values(r.limbs)) { l.bleed = 0; Body.setVelocity(l.body, { x: rnd(-5, 5), y: rnd(-7, -2) }); }
    r.detached = true;
    g.fx('shatter', { x: a.x, y: a.y, n: 18 });
    g.sound('shatter', a.x);
    g.text(a.x, a.y - 30, 'ESTILHAÇOU!', '#bdeeff');
  } else if (gore === 2 && (kind === 'grind' || kind === 'crush' || (kind === 'explosion' && overkill))) {
    gib(g, a);
    const r = ragdollOf(g, a);
    if (r) r.detached = true;
  } else {
    let r = a.knocked ? ragdollOf(g, a) : null;
    if (!r) {
      const v = a.body.velocity;
      r = buildRagdoll(g, a, { velocity: { x: v.x + kb.x, y: Math.min(v.y, 0) + kb.y }, alive: false, spin: 0.15 });
      Composite.remove(g.engine.world, a.body);
    }
    r.alive = false;
    r.muscle = 0;
    r.detached = true;
    for (const e of a.embedded) {
      const l = r.limbs[e.part];
      if (l) {
        l.embedded = (l.embedded || []).concat([e]);
        const nearWall = l.x < 40 || l.x > 920;
        if (e.kind === 'blade' && nearWall) pinLimb(g, l, { x: l.x < 40 ? 4 : 956, y: l.y });
      }
    }
  }
  a.knocked = false;
  a.knock = 0;
  g.shake = Math.max(g.shake, 8);
  if (credit && credit.id !== a.id) { g.fx('impact', { x: a.x, y: a.y, p: 3, a: Math.atan2(kb.y, kb.x || 1), ko: 1 }); drama(g, 0.5, a, credit); }
  g.sound('death', a.x);
}

export function power(g, a) {
  // The frog's K is his own: inhale, or spit out whoever is inside (even with a weapon in hand).
  const frog = a.type === 5;
  if (isMelee(a.weapon) && !a.holding && !(frog && a.belly != null)) { weaponAttack(g, a, true); return; }
  if (a.dead || a.invincible > 0.8 || a.knocked || a.frozen > 0 || a.hitstun > 0 || a.act) return;
  if (frog) { frogPower(g, a); return; }
  // The axolotl's K and S+K have their own rules (the shed has its own cooldown, and K again
  // during the awakening sets the demons off).
  if (a.type === 6) { axoPower(g, a); return; }
  if (a.abilityCd > 0) return;
  startSpecial(g, a);
}

// Damage over time and lingering conditions, run once per step.
export function tickStatuses(g, dt) {
  for (const a of g.actors) {
    if (a.dead) continue;
    const stumpBleed = a.type === 6 ? 0 : a.stumps.length * 1.1;
    a.bleed = Math.max(stumpBleed, a.bleed * (1 - 0.07 * dt));
    a.bleedTick = (a.bleedTick || 0) - dt;
    if (a.bleed > 0.35 && a.bleedTick <= 0) {
      a.bleedTick = 0.5;
      const owner = a.lastHit != null && g.time - (a.lastHitTime ?? -9) < 8 ? a.lastHit : a.id;
      const lost = damage(g, a, a.bleed * 0.5, { x: a.x, y: a.y }, owner, 'bleed', { kb: { x: 0, y: 0 }, force: true, environment: true });
      if (lost) spill(g, a.x + rnd(-4, 4), a.y, lost * 0.6);
      const nox = a.bleedBy != null && g.time - (a.bleedByT ?? -9) < 10 ? g.actor(a.bleedBy) : null;
      if (lost && nox && nox !== a && nox.type === 4 && !nox.dead) drink(g, nox, a, lost);
    }
    if (a.freeze > 0 && a.frozen <= 0) a.freeze = Math.max(0, a.freeze - dt * 0.3);
    if (a.freeze >= 1 && a.frozen <= 0) {
      a.freeze = 0; a.frozen = 3.2; a.burning = 0;
      g.text(a.x, a.y - 30, 'CONGELOU!', '#bdeeff');
      g.sound('freeze', a.x);
      g.fx('frost', { x: a.x, y: a.y, n: 14 });
    }
    if (a.burning > 0 && a.frozen > 0) { a.frozen = 0; g.fx('steam', { x: a.x, y: a.y, n: 8 }); }
  }
}
