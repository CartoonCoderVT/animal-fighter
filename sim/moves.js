// "Instinto animal" moveset. Timings are shared by the simulation (hit moments) and the
// animation (key frames), so every peer sees the strike on the frame it lands.
// range: reach in world units in front of the fighter; band: vertical reach around the chest;
// step: forward nudge so combo hits keep contact. Combo hits push a little, finishers a lot.
// launch: sends the target up and opens a chase (J again leaps after them into an air combo).
import { WEAPON_MOVES } from './weapons.js';

export const MOVES = {
  // Mingau
  scratchA: { dur: 0.24, hits: [0.35], range: 30, band: 24, dmg: [8], kind: 'claw', kb: [[1.2, 0]], cd: 0.16, step: 2.2 },
  scratchB: { dur: 0.24, hits: [0.35], range: 30, band: 24, dmg: [8], kind: 'claw', kb: [[1.4, 0]], cd: 0.16, step: 2.2 },
  upper: { dur: 0.36, hits: [0.42], range: 30, band: 26, dmg: [11], kind: 'claw', kb: [[1.5, -10]], cd: 0.3, launch: true, step: 1.5 },
  lowclaw: { dur: 0.34, hits: [0.45], range: 32, band: 22, dmg: [9], kind: 'claw', kb: [[2.5, -3.5]], cd: 0.4, knock: true, low: true },
  // Marola
  whipA: { dur: 0.28, hits: [0.45], range: 46, band: 22, dmg: [7], kind: 'whip', kb: [[2, 0]], cd: 0.22 },
  whipB: { dur: 0.28, hits: [0.45], range: 46, band: 22, dmg: [7], kind: 'whip', kb: [[2, 0]], cd: 0.22 },
  tailUp: { dur: 0.36, hits: [0.45], range: 42, band: 26, dmg: [9], kind: 'whip', kb: [[1.2, -10]], cd: 0.3, launch: true },
  sweep: { dur: 0.42, hits: [0.45], range: 50, band: 22, dmg: [9], kind: 'whip', kb: [[2.5, -3.5]], cd: 0.48, knock: true, low: true },
  // Lola
  kickA: { dur: 0.22, hits: [0.4], range: 30, band: 24, dmg: [6], kind: 'kick', kb: [[1.2, 0]], cd: 0.14, step: 2 },
  kickB: { dur: 0.22, hits: [0.4], range: 30, band: 24, dmg: [6], kind: 'kick', kb: [[1.4, 0]], cd: 0.14, step: 2 },
  hopkick: { dur: 0.36, hits: [0.4], range: 30, band: 28, dmg: [10], kind: 'kick', kb: [[1.2, -10.5]], cd: 0.3, launch: true },
  kick: { dur: 0.38, hits: [0.3, 0.62], range: 34, band: 24, dmg: [6, 9], kind: 'kick', kb: [[1, 0], [9, -3.5]], cd: 0.5 },
  // Juma
  pawA: { dur: 0.34, hits: [0.45], range: 32, band: 26, dmg: [13], kind: 'paw', kb: [[1.5, 0]], cd: 0.28, step: 2.5 },
  pawB: { dur: 0.34, hits: [0.45], range: 32, band: 26, dmg: [13], kind: 'paw', kb: [[1.8, 0]], cd: 0.28, step: 2.5 },
  rising: { dur: 0.4, hits: [0.45], range: 32, band: 28, dmg: [14], kind: 'paw', kb: [[1.2, -9.5]], cd: 0.32, launch: true, step: 2 },
  smash: { dur: 0.52, hits: [0.5], range: 34, band: 28, dmg: [18], kind: 'paw', kb: [[7, -5]], cd: 0.58, knock: true, breaks: true, step: 3 },
  // Nox, hemomancy. A claw of blood, then a scythe of blood: the reap hooks the rival and drags
  // them in (negative push), the cyclone spins it around him and holds them, the guillotine
  // chops down and folds them over, and the stakes burst from the floor to launch.
  // hold: hitstun the blow leaves at least; crumple: the rival doubles over (heavy reaction).
  bloodClaw: { dur: 0.24, hits: [0.38], range: 30, band: 24, dmg: [7], kind: 'blood', kb: [[1.2, 0]], cd: 0.16, step: 2.4 },
  scytheReap: { dur: 0.34, hits: [0.45], range: 54, band: 24, dmg: [8], kind: 'scythe', kb: [[-2.6, 0]], cd: 0.2, noSmear: true },
  scytheSpin: { dur: 0.42, hits: [0.36, 0.6], range: 38, band: 28, dmg: [5, 6], kind: 'scythe', kb: [[0.4, -0.5], [0.6, -0.5]], cd: 0.22, around: true, hold: 0.46, noSmear: true },
  scytheGuillotine: { dur: 0.46, hits: [0.48], range: 44, band: 30, dmg: [11], kind: 'scythe', kb: [[0.6, 3]], cd: 0.28, hold: 0.56, crumple: true, floor: 32, step: 2, noSmear: true },
  bloodSpikes: { dur: 0.4, hits: [0.4], range: 54, band: 30, dmg: [10], kind: 'blood', kb: [[1, -10.5]], cd: 0.3, launch: true, spikes: [14, 26, 38, 50], noSmear: true },
  // S+J: the vampire's kiss. A lunging bite, then the drink, which feeds on the blood marks.
  vampKiss: { dur: 0.5, hits: [0.32, 0.66], range: 28, band: 22, dmg: [6, 9], kind: 'fang', kb: [[0.4, 0], [4.5, -2.5]], cd: 0.5, drain: 0.75, step: 3.5, feast: true, noSmear: true },
  // Nox's air string: twin claws, a vortex of blood whips (many hits that hold the rival up and
  // close), then the scythe that slams them into the floor so they bounce back up (once a combo).
  nAirClaw: { dur: 0.26, hits: [0.3, 0.62], range: 30, band: 26, dmg: [5, 5], kind: 'blood', kb: [[0.4, -0.5], [0.5, -0.5]], cd: 0.12 },
  nAirVortex: { dur: 0.4, hits: [0.2, 0.38, 0.56, 0.74], range: 34, band: 32, dmg: [3, 3, 3, 4], kind: 'scythe', kb: [[0, 0], [0, 0], [0, 0], [0.6, -1]], cd: 0.14, around: true, pull: true, noSmear: true },
  nAirScythe: { dur: 0.34, hits: [0.45], range: 36, band: 36, dmg: [11], kind: 'scythe', kb: [[1.5, 9]], cd: 0.3, spike: true, bounce: true, around: true },
  // Branches out of the ground string. S+J: the scythe sweeps the floor and pops the rival up (a
  // second launcher). A fresh tap of a direction + J: the phantom reap, through the rival with the
  // scythe, and the string picks up again at the guillotine.
  scytheSweep: { dur: 0.4, hits: [0.42], range: 50, band: 22, dmg: [8], kind: 'scythe', kb: [[0.8, -8]], cd: 0.3, low: true, launch: true, sweep: 34, noSmear: true },
  scytheDash: { dur: 0.38, hits: [0.3], range: 80, band: 24, dmg: [9], kind: 'scythe', kb: [[0.8, -2]], cd: 0.26, pass: true, blink: 80, noSmear: true },
  // S+J over a downed rival: the execution, the scythe driven straight down into them.
  execute: { dur: 0.56, hits: [0.52], range: 40, band: 34, dmg: [16], kind: 'scythe', kb: [[0, 2]], cd: 0.6, execute: true, noSmear: true },
  // Nox out of his swarm of bats: he forms behind the rival already cutting, down then back up.
  batStrike: { dur: 0.34, hits: [0.24, 0.52], range: 36, band: 30, dmg: [6, 8], kind: 'scythe', kb: [[0.4, -0.5], [2.5, -3]], cd: 0.2, around: true, noSmear: true },
  // Third in the air string: two crossing scythe cuts.
  nAirCross: { dur: 0.3, hits: [0.3, 0.6], range: 36, band: 32, dmg: [5, 5], kind: 'scythe', kb: [[0.4, -0.6], [0.6, -0.8]], cd: 0.12, noSmear: true },
  // Side+J: the shadow cut. Nox breaks into bats, comes out past the rival, and the cut opens late.
  shadowCut: { dur: 0.36, hits: [0.3], range: 70, band: 22, dmg: [8], kind: 'blood', kb: [[0.6, -2.5]], cd: 0.3, pass: true, blink: 70, noSmear: true },
  // Everyone: the air string (the last one spikes down), the dash strike
  airA: { dur: 0.22, hits: [0.4], range: 28, band: 26, dmg: [7], kind: 'air', kb: [[1.5, 0]], cd: 0.12 },
  airB: { dur: 0.26, hits: [0.45], range: 28, band: 28, dmg: [8], kind: 'air', kb: [[1.8, 0]], cd: 0.14 },
  spike: { dur: 0.32, hits: [0.45], range: 30, band: 30, dmg: [12], kind: 'air', kb: [[2.5, 9]], cd: 0.35, knock: true, spike: true },
  dashAtk: { dur: 0.3, hits: [0.35], range: 34, band: 24, dmg: [11], kind: 'air', kb: [[6, -3]], cd: 0.3 }
};
Object.assign(MOVES, WEAPON_MOVES);

export const COMBOS = [['scratchA', 'scratchB', 'upper'], ['whipA', 'whipB', 'tailUp'], ['kickA', 'kickB', 'hopkick'], ['pawA', 'pawB', 'rising'], ['bloodClaw', 'scytheReap', 'scytheSpin', 'scytheGuillotine', 'bloodSpikes']];
// S+J on the ground: each fighter's heavy blow.
export const HEAVY = ['lowclaw', 'sweep', 'kick', 'smash', 'vampKiss'];
export const AIR = ['airA', 'airB', 'spike'];
export const NOX_AIR = ['nAirClaw', 'nAirVortex', 'nAirCross', 'nAirScythe'];
// Air moves and the dash strike hit with each fighter's natural weapon.
export const NATURAL = ['claw', 'whip', 'kick', 'paw', 'blood'];

// Specials (K). Durations are upper bounds; most end on contact or landing.
export const SPECIALS = [
  { id: 'pounce', cd: 6, dur: 0.75, ride: 1.3 },
  { id: 'ball', cd: 8, dur: 2.6 },
  { id: 'sky', cd: 7, dur: 2.2 },
  { id: 'bite', cd: 8, dur: 0.3, shake: 1.0 },
  // Piercing blood: blood condensed into an orb (charge, open to hits), then fired as a beam
  // through the arena; diagonally down from the air. Three blood marks on a rival go supernova.
  { id: 'beam', cd: 6, dur: 0.78, charge: 0.34 }
];
