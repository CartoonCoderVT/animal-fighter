// The axolotl's body: parts it loses come off clean (a pop of goo, no blood), fly off and bud into
// smaller copies of it (its clones, see minions.js), while it grows the part back. It sheds by its
// own rule, at any gore setting and to any kind of blow, and never loses its head that way.
import { releaseHeld, ragdollOf } from './ragdoll.js';
import { dropWeapon } from './props.js';
import { SPECIALS } from './moves.js';
import { startMove } from './combat.js';
import { minionsOf, spawnSeed, startMorph, burstDemons, pickUpClone, throwClone, blowBubble, adultsOf } from './minions.js';
import { pose } from '../render/rig.js';
import { rnd } from '../engine/const.js';

// Regeneração. load: how much (weighted) damage pops a part; heavy: a single blow that pops one on
// the spot; cd: seconds between pops (a long string cannot strip it bare; blows meanwhile count
// half); regrow: seconds to grow a part back, and the life it brings back; mend: seconds for a
// broken bone, scar: for wounds to close after the last blow.
export const SHED = { load: 36, heavy: 16, cd: 3, regrow: { tail: 7, armF: 6, armB: 6, footF: 6, footB: 6 }, heal: 3, mend: 5, scar: 6 };
// How hard each kind of blow pulls at its parts.
const PULL = { cut: 1.5, explosion: 2, grind: 2, pierce: 1.2, blunt: 1 };
// The order parts come off when a blow lands on the head or body: the back ones first, so it keeps
// its weapon arm and its footing as long as it can.
export const POP_ORDER = ['tail', 'armB', 'footB', 'armF', 'footF'];
const LIMBS = ['armF', 'armB', 'footF', 'footB'];
// S+K: tearing a part off on purpose costs life and has its own cooldown.
export const SELF_SHED = { hp: 5, min: 11, cd: 6, vx: 6.5, vy: -4.5, dmg: 6, kb: [2.5, -3] };

export const axoInit = () => ({ load: 0, popReady: 0, tailCut: false, regrow: {}, mend: {}, demonEnd: 0, demon: null, shedReady: 0, carry: null, scarAt: 0, chip: [] });
const attached = (a, p) => (p === 'tail' ? !a.axo.tailCut : !a.severed.includes(p));

// After a blow lands on the axolotl: its parts take the pull, and one may come off.
export function axoHit(g, a, part, amount, cat, low) {
  const ax = a.axo;
  if (!ax || a.dead || a.swallowedBy != null) return;
  ax.scarAt = g.time;
  const eff = amount * (PULL[cat] ?? 1);
  const ready = g.time >= ax.popReady;
  ax.load = Math.min(SHED.load, ax.load + eff * (ready ? 1 : 0.5));
  if (!ready || (ax.load < SHED.load && eff < SHED.heavy)) return;
  // The limb the blow struck, a foot for a low blow, else the next in line.
  let pick = LIMBS.includes(part) && attached(a, part) ? part : null;
  if (!pick && low) { const feet = ['footF', 'footB'].filter(p => attached(a, p)); pick = feet.length ? feet[Math.floor(rnd(0, feet.length))] : null; }
  pick ||= POP_ORDER.find(p => attached(a, p));
  if (!pick) return;
  ax.load = 0;
  ax.popReady = g.time + SHED.cd;
  popPart(g, a, pick);
}

// Where a part sits on the axolotl right now (its tail grows from the back of the body).
function partAt(g, a, part) {
  if (part === 'tail') return { x: a.x - a.face * 9, y: a.y + 6 };
  const r = a.knocked ? ragdollOf(g, a) : null, l = r?.limbs[part];
  if (l) return { x: l.body.position.x, y: l.body.position.y, limb: l };
  const b = pose(a, g.time).find(x => x.name === part);
  return b ? { x: a.x + b.x * a.face, y: a.y + b.y } : { x: a.x, y: a.y };
}

// The part comes off with a wet plop. It flies, lands and buds into a clone; with three clones out
// already, it streams as goo into the nearest one instead (it eats it, and grows). thrown: torn off
// on purpose and hurled forward (S+K), hurting the first rival it flies into.
export function popPart(g, a, part, thrown = false) {
  const ax = a.axo, at = partAt(g, a, part);
  if (part === 'tail') ax.tailCut = true;
  else {
    if (at.limb) g.removeLimb(at.limb);
    a.severed.push(part);
    delete a.wounds[part]; delete a.broken[part];
    a.partDmg[part] = 0;
    for (const e of a.embedded.filter(e => e.part === part)) if (e.kind === 'blade') g.addProp({ kind: e.weapon || 'blade', x: at.x, y: at.y, velocity: { x: rnd(-2, 2), y: -3 } });
    a.embedded = a.embedded.filter(e => e.part !== part);
    if (part === 'armF') { if (a.weapon) dropWeapon(g, a); releaseHeld(g, a); }
  }
  ax.regrow[part] = { t0: g.time, dur: SHED.regrow[part] };
  const v = a.knocked ? { x: 0, y: 0 } : a.body.velocity;
  const vx = thrown ? a.face * SELF_SHED.vx + v.x * 0.3 : v.x + rnd(-2, 2) - a.face * 1.5, vy = thrown ? SELF_SHED.vy : rnd(-6, -3);
  const seed = spawnSeed(g, a, part, at.x, at.y, vx, vy, thrown ? { dmg: SELF_SHED.dmg, kb: SELF_SHED.kb } : null);
  if (seed && ax.demonEnd > g.time) seed.awaken = true;
  if (!seed) feedBrood(g, a, at);
  g.fx('goo', { x: at.x, y: at.y, n: 14 });
  g.text(a.x, a.y - 30, thrown ? 'SOLTOU!' : 'PLOP!', '#ffb3c8');
  g.sound('plop', a.x);
  return seed;
}

// A part lost with the brood full goes to the nearest clone, which gains life and time.
function feedBrood(g, a, at) {
  const m = minionsOf(g, a).filter(m => m.kind === 'mini' || m.kind === 'demon').sort((p, q) => Math.hypot(p.x - at.x, p.y - at.y) - Math.hypot(q.x - at.x, q.y - at.y))[0];
  if (!m) return;
  m.hp = Math.min(m.maxHp, m.hp + 6);
  if (m.kind === 'mini') m.life = Math.min(m.lifeMax + 3, m.life + 3);
  g.fx('goo', { x: m.x, y: m.y, n: 8 });
  g.text(m.x, m.y - 18, 'NHAC!', '#ff9cc0');
}

// Each step for an axolotl: lost parts grow back once their time comes (the clock stops while it
// is down, swallowed or frozen in a hit), bones mend, wounds close without a scar.
export function tickAxolotl(g, a, dt) {
  const ax = a.axo;
  if (a.type !== 6 || !ax || a.dead) return;
  const paused = a.knocked || a.swallowedBy != null || a.hitlag > 0;
  for (const [part, r] of Object.entries(ax.regrow)) {
    if (paused) { r.t0 += dt; continue; }
    if (g.time < r.t0 + r.dur) continue;
    delete ax.regrow[part];
    if (part === 'tail') ax.tailCut = false;
    else {
      a.severed = a.severed.filter(p => p !== part);
      delete a.wounds[part]; delete a.broken[part];
      a.partDmg[part] = 0;
    }
    a.hp = Math.min(a.maxHp, a.hp + SHED.heal);
    const at = partAt(g, a, part);
    g.fx('regrow', { x: at.x, y: at.y, part });
    g.sound('plip', a.x);
  }
  for (const p of Object.keys(a.broken)) {
    if (!a.broken[p]) continue;
    ax.mend[p] ??= g.time + SHED.mend;
    if (g.time >= ax.mend[p]) { delete a.broken[p]; delete ax.mend[p]; g.fx('regrow', { ...partAt(g, a, p), part: p }); }
  }
  if (Object.keys(a.wounds).length && g.time - ax.scarAt > SHED.scar) a.wounds = {};
  a.bleed = Math.max(0, a.bleed - 4 * dt);
  // The brood changes one after the other, even if a blow cuts the cast pose short; the awakening
  // runs its course, and at the end every demon still standing bursts.
  if (ax.demon) for (const m of g.minions) if (m.owner === a.id && m.morphAt != null && g.time >= m.morphAt) { m.morphAt = null; startMorph(g, m, a); }
  if (ax.demon && g.time >= ax.demonEnd) endAwakening(g, a);
}

// K and S+K for the axolotl. S+K tears off a part to plant a clone; K awakens the brood (pressed
// again during the awakening, it sets the demons off); with no brood, K is the Bocarra.
export function axoPower(g, a) {
  const ax = a.axo;
  // S+K cancels the end of any blow that already landed.
  const free = !(a.attack > 0) || !a.hits?.length;
  if (a.input.down && a.type === 6) { if (free) selfShed(g, a); return; }
  if (ax?.demon && g.time - ax.demon.at > 1) { endAwakening(g, a, true); return; }
  if (a.abilityCd > 0 || !free) return;
  axoSpecial(g, a);
}

// The special for whoever has the axolotl's style: its own brood if it has one, else the maw (the
// frog that swallowed the axolotl only ever gets the maw).
export function axoSpecial(g, a) {
  const brood = a.type === 6 ? minionsOf(g, a) : [];
  a.powerSeq = (a.powerSeq || 0) + 1;
  if (!brood.length) {
    a.abilityCd = SPECIALS[6].maw;
    a.attack = 0; a.hits = null;
    startMove(g, a, 'xMaw');
    g.text(a.x, a.y - 30, 'BOCARRA!', '#ff4a6a');
    g.sound('chomp', a.x);
    return;
  }
  const sp = SPECIALS[6];
  a.attack = 0; a.hits = null;
  a.act = 'xolotl'; a.actT = 0; a.actMax = sp.cast;
  a.axo.demonEnd = g.time + sp.cast + sp.dur;
  a.axo.demon = { at: g.time, cap: 12 + 6 * Math.min(3, brood.length), on: {}, total: 0, healed: 0 };
  a.abilityCd = sp.cast + sp.dur + sp.cd;
  // A clone in its mouth comes out as a demon.
  if (a.axo.carry != null) throwClone(g, a, true);
  brood.forEach((m, i) => { m.morphAt = g.time + 0.05 * i; });
  g.fx('xolotlCast', { x: a.x, y: a.y, targets: brood.map(m => ({ x: Math.round(m.x), y: Math.round(m.y) })) });
  g.text(a.x, a.y - 34, 'XOLOTL!', '#ff4a3a');
  g.sound('howl', a.x);
  g.flash = Math.max(g.flash, 0.3);
}

// The cast pose: the axolotl rears up while its brood changes (see tickAxolotl).
export function stepXolotl(g, a) {
  return a.actT >= a.actMax;
}

function endAwakening(g, a, early = false) {
  const ax = a.axo;
  for (const m of g.minions) if (m.owner === a.id) { m.morphAt = null; m.awaken = false; }
  burstDemons(g, a);
  if (early) a.abilityCd = SPECIALS[6].cd;
  ax.demon = null; ax.demonEnd = 0;
  g.text(a.x, a.y - 30, 'SACRIFÍCIO!', '#ff7a3a');
}

// S+K: it bites off the next part in line and hurls it forward; where it lands a clone buds.
function selfShed(g, a) {
  const ax = a.axo;
  if (g.time < ax.shedReady) return;
  const part = POP_ORDER.find(p => attached(a, p));
  const room = minionsOf(g, a).length < 3 || adultsOf(g, a).length > 0;
  if (!part || !room) { ax.shedReady = g.time + 0.3; g.text(a.x, a.y - 28, 'NADA PRA SOLTAR!', '#d7b5ba'); g.fx('goo', { x: a.x, y: a.y, n: 4 }); return; }
  if (a.hp < SELF_SHED.min) { ax.shedReady = g.time + 0.3; g.text(a.x, a.y - 28, 'SEM FORÇAS!', '#d7b5ba'); return; }
  ax.shedReady = g.time + SELF_SHED.cd;
  a.hp -= SELF_SHED.hp;
  a.shedPart = part;
  a.attack = 0; a.hits = null;
  a.powerSeq = (a.powerSeq || 0) + 1;
  startMove(g, a, 'xShed');
}

// The moment xShed lands: the part comes off and flies.
export function shedStrike(g, a) {
  const part = a.shedPart && attached(a, a.shedPart) ? a.shedPart : POP_ORDER.find(p => attached(a, p));
  a.shedPart = null;
  if (part) popPart(g, a, part, true);
}

// E for the axolotl: with a clone in its mouth, set it down; else scoop up a clone close by when
// one is nearer than anything else to pick up. Returns true when it handled the button.
export function axoGrab(g, a) {
  if (a.type !== 6 || !a.axo) return false;
  if (a.axo.carry != null) { throwClone(g, a, true); return true; }
  if (a.holding || a.weapon && !a.input.down) return false;
  return !!pickUpClone(g, a);
}
export { throwClone, blowBubble };

// What the renderer and the HUD need of it.
export function axoSnapshot(g, a) {
  const ax = a.axo;
  if (!ax) return null;
  const regrow = {};
  for (const [p, r] of Object.entries(ax.regrow)) regrow[p] = Math.round(Math.min(1, (g.time - r.t0) / r.dur) * 100) / 100;
  return {
    tail: ax.tailCut ? 1 : 0, regrow, demon: Math.round(Math.max(0, ax.demonEnd - g.time) * 10) / 10, shed: Math.round(Math.max(0, ax.shedReady - g.time) * 10) / 10,
    carry: ax.carry ?? null, load: Math.round(ax.load / SHED.load * 100) / 100
  };
}

// A joint of a downed axolotl torn by something else (a blast, a stretch, a shake): the limb comes
// off clean and flies on as a seed, like any part it loses.
export function shedLimb(g, a, l) {
  const part = l.part;
  const v = l.body.velocity, x = l.body.position.x, y = l.body.position.y;
  g.removeLimb(l);
  if (!a.severed.includes(part)) a.severed.push(part);
  a.axo.regrow[part] = { t0: g.time, dur: SHED.regrow[part] || 6 };
  const seed = spawnSeed(g, a, part, x, y, v.x, Math.min(v.y, -2));
  if (!seed) feedBrood(g, a, { x, y });
  g.fx('goo', { x, y, n: 12 });
  g.sound('plop', x);
}
