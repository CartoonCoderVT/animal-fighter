// The axolotl's body: parts it loses come off clean (a pop of goo, no blood), crawl a moment on the
// floor and hatch into a smaller copy of it (a clone, see minions.js); meanwhile it grows the part
// back. It sheds by its own rule, at any gore setting and to any kind of blow.
import { makeLimb, releaseHeld } from './ragdoll.js';
import { dropWeapon } from './props.js';
import { spawnMinion } from './minions.js';
import { pose } from '../render/rig.js';
import { rnd } from '../engine/const.js';

// at: damage on a part that pops it; heavy: a single blow that pops it at once; cd: seconds between
// pops (a long string cannot strip it bare); hatch: seconds before a shed part hatches; regrow:
// seconds to grow a part back; head: the head only pops below this share of life.
export const SHED = { at: 18, heavy: 14, cd: 1.2, hatch: 0.7, regrow: 5, regrowHead: 2.5, head: 0.35 };
const LIMBS = ['armF', 'armB', 'footF', 'footB'];

// After a blow lands on the axolotl: maybe a part pops.
export function axoHit(g, a, part, amount, ownerId) {
  if (a.dead || a.knocked || a.swallowedBy != null || (a.shedCd ?? 0) > g.time) return;
  // A blow to the body loosens whichever limb it still has.
  if (part === 'body') {
    if (amount < SHED.heavy) return;
    const left = LIMBS.filter(p => !a.severed.includes(p));
    if (!left.length) return;
    part = left[Math.floor(rnd(0, left.length))];
  }
  if (a.severed.includes(part)) return;
  if (part === 'head' && a.hp > a.maxHp * SHED.head) return;
  if ((a.partDmg[part] || 0) < SHED.at && amount < SHED.heavy) return;
  shedPart(g, a, part, ownerId);
}

// The part comes off: it flies out, lands, and hatches into a clone (see tickSprouts).
export function shedPart(g, a, part, ownerId = null) {
  const b = pose(a, g.time).find(x => x.name === part);
  if (!b || a.severed.includes(part)) return null;
  const r = { id: g.nextId++, actor: a.id, limbs: {}, joints: [], alive: false, muscle: 0, group: -(9000 + g.nextId), detached: true };
  const l = makeLimb(g, a, b, { velocity: { x: a.body.velocity.x + rnd(-2, 2) - a.face * 1.5, y: rnd(-6, -3) }, group: r.group, spin: 0.2 });
  l.ragdoll = r; l.bleed = 0; l.wounds = [];
  l.sprout = { owner: a.id, at: g.time + SHED.hatch };
  r.limbs[part] = l;
  g.ragdolls.push(r);
  a.severed.push(part);
  a.regrow ||= {};
  a.regrow[part] = g.time + (part === 'head' ? SHED.regrowHead : SHED.regrow);
  a.partDmg[part] = 0;
  delete a.wounds[part];
  a.shedCd = g.time + SHED.cd;
  if (part === 'armF') { if (a.weapon) dropWeapon(g, a, { fling: true }); releaseHeld(g, a); }
  g.fx('goo', { x: l.x, y: l.y, n: 14 });
  g.text(a.x, a.y - 30, 'PLOP!', '#ff9cc0');
  g.sound('pop', a.x);
  const o = ownerId != null ? g.actor(ownerId) : null;
  if (o && o !== a) o.stats.limbs++;
  return l;
}

// Each step: shed parts that have landed hatch into clones (one too many just melts away).
export function tickSprouts(g) {
  for (const l of [...g.limbs]) {
    const s = l.sprout;
    if (!s || g.time < s.at) continue;
    const v = l.body.velocity;
    if (Math.hypot(v.x, v.y) > 3 && g.time < s.at + 1.2) continue;
    l.sprout = null;
    const owner = g.actor(s.owner);
    const m = owner && !owner.dead ? spawnMinion(g, owner, l.x, l.y - 8, { face: owner.face }) : null;
    g.fx(m ? 'cloneBirth' : 'goo', { x: l.x, y: l.y, n: 10 });
    if (m) { g.text(l.x, l.y - 16, 'CLONE!', '#ff9cc0'); g.sound('pop', l.x); }
    g.removeLimb(l);
  }
}

// Each step for an axolotl: lost parts grow back once their time comes (not while it is down).
export function tickRegrow(g, a) {
  if (a.type !== 6 || !a.regrow || a.dead || a.knocked) return;
  for (const [part, t] of Object.entries(a.regrow)) {
    if (g.time < t) continue;
    delete a.regrow[part];
    a.severed = a.severed.filter(p => p !== part);
    delete a.wounds[part]; delete a.broken[part];
    a.partDmg[part] = 0;
    a.embedded = a.embedded.filter(e => e.part !== part);
    const b = pose(a, g.time).find(x => x.name === part);
    g.fx('regrow', { x: b ? a.x + b.x * a.face : a.x, y: b ? a.y + b.y : a.y, part });
    g.sound('heal', a.x);
  }
}
