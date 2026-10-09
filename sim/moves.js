// "Instinto animal" moveset. Timings are shared by the simulation (hit moments) and the
// animation (key frames), so every peer sees the strike on the frame it lands.
// range: reach in world units in front of the fighter; band: vertical reach around the chest;
// step: forward nudge so combo hits keep contact. Combo hits push a little, finishers a lot.
// launch: sends the target up and opens a chase (J again leaps after them into an air combo).
import { WEAPON_MOVES } from './weapons.js';
import { styleOf } from './fighters.js';

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
  // Juma, small: quick and frantic. Swipe, swipe, a storm of claws, the rake that lunges in and
  // folds the rival over, and the rising pounce that launches.
  jSwipe: { dur: 0.17, hits: [0.4], range: 28, band: 24, dmg: [5], kind: 'claw', kb: [[0.8, 0]], cd: 0.07, step: 2.6 },
  jSwipe2: { dur: 0.17, hits: [0.4], range: 28, band: 24, dmg: [5], kind: 'claw', kb: [[0.9, 0]], cd: 0.07, step: 2.6 },
  jFlurry: { dur: 0.44, hits: [0.2, 0.34, 0.48, 0.62, 0.78], range: 30, band: 26, dmg: [3, 3, 3, 3, 4], kind: 'claw', kb: [[0.4, 0], [0.4, 0], [0.4, 0], [0.4, 0], [1.2, -0.5]], cd: 0.16, hold: 0.34, step: 1.4, flurry: true },
  jRake: { dur: 0.26, hits: [0.42], range: 34, band: 24, dmg: [8], kind: 'claw', kb: [[1.6, -1]], cd: 0.12, step: 4.5, hold: 0.42, crumple: true },
  jPounceUp: { dur: 0.34, hits: [0.4], range: 30, band: 30, dmg: [9], kind: 'claw', kb: [[1, -10.5]], cd: 0.2, launch: true, step: 2 },
  // S+J out of the string: the low rake that sweeps the legs out.
  jLow: { dur: 0.3, hits: [0.4], range: 34, band: 22, dmg: [8], kind: 'claw', kb: [[2, -3]], cd: 0.32, knock: true, low: true, step: 2.5 },
  // Side+J: the lightning pounce, flat out through the rival raking twice; the string goes on
  // from the storm of claws. bolt: dash speed for the first half of the move.
  jBolt: { dur: 0.32, hits: [0.3, 0.56], range: 40, band: 22, dmg: [5, 6], kind: 'claw', kb: [[0.4, -0.5], [1.4, -2.5]], cd: 0.26, pass: true, bolt: 7.5, hold: 0.42 },
  // A fresh tap of a direction + J inside the string: the cross, a lunge through two crossing claws
  // that picks the string up again at the rake.
  jCross: { dur: 0.3, hits: [0.36, 0.62], range: 34, band: 24, dmg: [5, 6], kind: 'claw', kb: [[0.5, -0.5], [1.2, -1]], cd: 0.12, step: 5, hold: 0.5 },
  // Her air string: twin claws, a spinning ball of claws, the dive that slams them into the floor.
  jAirClaw: { dur: 0.2, hits: [0.3, 0.64], range: 28, band: 26, dmg: [4, 4], kind: 'claw', kb: [[0.4, -0.5], [0.5, -0.5]], cd: 0.08 },
  jAirSpin: { dur: 0.36, hits: [0.2, 0.4, 0.6, 0.8], range: 30, band: 30, dmg: [3, 3, 3, 4], kind: 'claw', kb: [[0, 0], [0, 0], [0, 0], [0.6, -1]], cd: 0.1, around: true, pull: true },
  jAirDive: { dur: 0.32, hits: [0.42], range: 32, band: 34, dmg: [9], kind: 'claw', kb: [[1.5, 9]], cd: 0.25, spike: true, bounce: true },
  // Juma as the beast: slow, enormous, and armored while she swings. lag: a longer hit freeze;
  // quake: how hard the floor shakes and throws up rocks where the blow lands.
  bSlam: { dur: 0.56, hits: [0.46], range: 40, band: 30, dmg: [15], kind: 'paw', kb: [[1, 0]], cd: 0.26, step: 2, hold: 0.66, crumple: true, quake: 3, lag: 1.5 },
  bHammer: { dur: 0.62, hits: [0.48], range: 46, band: 30, dmg: [17], kind: 'paw', kb: [[1.8, 0]], cd: 0.3, step: 3, hold: 0.7, shock: 64, quake: 4, lag: 1.6 },
  bUpper: { dur: 0.64, hits: [0.45], range: 40, band: 36, dmg: [18], kind: 'paw', kb: [[1.5, -12.5]], cd: 0.36, launch: true, step: 2, quake: 3, lag: 1.7 },
  // Third in the string: both paws swung in from wide and clapped together on the rival (clap: a
  // ring of force out of the clap that shoves everyone else back).
  bClap: { dur: 0.58, hits: [0.5], range: 40, band: 32, dmg: [16], kind: 'paw', kb: [[0.4, -1]], cd: 0.28, step: 2, hold: 0.8, crumple: true, clap: 1, lag: 1.7 },
  // S+J: the earthquake, both fists into the floor and a shockwave out both ways.
  bQuake: { dur: 0.72, hits: [0.5], range: 30, band: 30, dmg: [14], kind: 'paw', kb: [[2, -6]], cd: 0.6, knock: true, around: true, shock: 112, shockAt: 0, quake: 7, lag: 1.6 },
  // In the air: a raking swipe each way, then both paws together, slamming the rival down to bounce.
  bAirClaw: { dur: 0.34, hits: [0.3, 0.62], range: 36, band: 34, dmg: [7, 8], kind: 'paw', kb: [[0.4, -0.6], [0.6, -0.8]], cd: 0.14, lag: 1.3 },
  bAirSmash: { dur: 0.42, hits: [0.42], range: 38, band: 38, dmg: [14], kind: 'paw', kb: [[1.5, 10]], cd: 0.3, spike: true, bounce: true, around: true, lag: 1.5 },
  // Juma as the titan: every blow is enormous and wrecks whatever it touches (wreck: props in
  // reach take several times the damage, hanging lamps are torn down). A hook that folds the
  // rival over, the double-fisted smash into the floor, and the uppercut that sends them flying.
  tHook: { dur: 0.6, hits: [0.5], range: 50, band: 34, dmg: [18], kind: 'paw', kb: [[1.4, -0.5]], cd: 0.3, step: 3, hold: 0.8, crumple: true, quake: 3, lag: 1.7, wreck: 4 },
  tSmash: { dur: 0.72, hits: [0.5], range: 50, band: 34, dmg: [22], kind: 'paw', kb: [[0.6, 0]], cd: 0.34, step: 2, hold: 0.9, crumple: true, shock: 80, quake: 7, lag: 1.9, wreck: 4 },
  tUpper: { dur: 0.72, hits: [0.46], range: 46, band: 42, dmg: [22], kind: 'paw', kb: [[1.5, -13.5]], cd: 0.4, launch: true, step: 2, quake: 4, lag: 2, wreck: 4 },
  // S+J: the cataclysm, both fists into the floor and the whole level heaves.
  tQuake: { dur: 0.85, hits: [0.5], range: 36, band: 34, dmg: [18], kind: 'paw', kb: [[3, -7]], cd: 0.7, knock: true, around: true, shock: 180, shockAt: 0, quake: 9, lag: 1.8, wreck: 6 },
  // S+J over a downed rival: three blows hammered down into them (pound).
  tPound: { dur: 0.95, hits: [0.3, 0.56, 0.82], range: 44, band: 40, dmg: [9, 9, 15], kind: 'paw', kb: [[0, 2], [0, 2], [0, 3]], cd: 0.6, pound: true, quake: 4, lag: 1.4 },
  // In the air: a sweeping backhand, then the double-fisted hammer down that bounces them.
  tAirClaw: { dur: 0.4, hits: [0.45], range: 44, band: 40, dmg: [12], kind: 'paw', kb: [[0.6, -1.2]], cd: 0.16, around: true, lag: 1.5, wreck: 3 },
  tAirSmash: { dur: 0.5, hits: [0.42], range: 46, band: 46, dmg: [18], kind: 'paw', kb: [[1.5, 11]], cd: 0.34, spike: true, bounce: true, around: true, lag: 1.8, wreck: 3 },
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
  // The frog. Webbed palms that slap left and right, a tongue that snaps out faster than the eye and
  // reels the rival in, a giant palm (the hand drawn twice its size on impact), and the legs of a
  // spring that launch. reach: per-hit range where a move's hits differ.
  fSlap: { dur: 0.2, hits: [0.38], range: 28, band: 24, dmg: [6], kind: 'slap', kb: [[1, 0]], cd: 0.1, step: 2.4 },
  fSlap2: { dur: 0.22, hits: [0.4], range: 30, band: 24, dmg: [6], kind: 'slap', kb: [[1.2, 0]], cd: 0.1, step: 2.4 },
  fLash: { dur: 0.3, hits: [0.3], range: 58, band: 22, dmg: [6], kind: 'tongue', kb: [[-2.8, 0]], cd: 0.14, hold: 0.45, tongue: 58, noSmear: true },
  fBigPalm: { dur: 0.42, hits: [0.5], range: 36, band: 28, dmg: [11], kind: 'slap', kb: [[1.4, -0.5]], cd: 0.22, hold: 0.62, crumple: true, step: 3, lag: 1.5 },
  fSpring: { dur: 0.38, hits: [0.44], range: 30, band: 30, dmg: [10], kind: 'kick', kb: [[1.2, -10.8]], cd: 0.28, launch: true, step: 1.5 },
  // Side+J, the tongue-hook: it sticks to the rival 86 away and reels him in to a flying double knee;
  // the string goes on from the giant palm. Missing, the tongue comes back slack.
  fGrapple: { dur: 0.44, hits: [0.2, 0.6], range: 86, reach: [86, 30], band: 22, dmg: [4, 8], kind: 'tongue', kb: [[-0.5, 0], [1.6, -2.5]], cd: 0.28, hold: 0.45, tongue: 86, grapple: true, noSmear: true },
  // S+J: the croak. The throat sac swells bigger than his head and bursts into a ring of sound.
  fCroak: { dur: 0.6, hits: [0.48], range: 30, band: 30, dmg: [10], kind: 'croak', kb: [[3, -6]], cd: 0.5, knock: true, around: true, croak: 92, noSmear: true },
  // S+J over a downed rival: a hop and the whole belly dropped on them.
  fSquash: { dur: 0.6, hits: [0.5], range: 40, band: 40, dmg: [14], kind: 'belly', kb: [[0, 3]], cd: 0.5, pound: true, quake: 2, lag: 1.3 },
  // His air string: two slaps, a corkscrew of kicks that holds the rival, the fly-catcher (the
  // tongue yanks them under him) and the double stomp that spikes.
  fAirSlap: { dur: 0.22, hits: [0.3, 0.62], range: 28, band: 26, dmg: [4, 4], kind: 'slap', kb: [[0.4, -0.5], [0.5, -0.5]], cd: 0.1 },
  fAirSpin: { dur: 0.36, hits: [0.2, 0.4, 0.6, 0.8], range: 30, band: 30, dmg: [3, 3, 3, 4], kind: 'kick', kb: [[0, 0], [0, 0], [0, 0], [0.6, -1]], cd: 0.12, around: true, pull: true },
  fAirLash: { dur: 0.3, hits: [0.32], range: 48, band: 30, dmg: [5], kind: 'tongue', kb: [[-2, 0.5]], cd: 0.12, tongue: 48, noSmear: true },
  fStomp: { dur: 0.32, hits: [0.4], range: 30, band: 34, dmg: [11], kind: 'kick', kb: [[1.5, 9]], cd: 0.26, spike: true, bounce: true },
  // Everyone: the air string (the last one spikes down), the dash strike
  airA: { dur: 0.22, hits: [0.4], range: 28, band: 26, dmg: [7], kind: 'air', kb: [[1.5, 0]], cd: 0.12 },
  airB: { dur: 0.26, hits: [0.45], range: 28, band: 28, dmg: [8], kind: 'air', kb: [[1.8, 0]], cd: 0.14 },
  spike: { dur: 0.32, hits: [0.45], range: 30, band: 30, dmg: [12], kind: 'air', kb: [[2.5, 9]], cd: 0.35, knock: true, spike: true },
  dashAtk: { dur: 0.3, hits: [0.35], range: 34, band: 24, dmg: [11], kind: 'air', kb: [[6, -3]], cd: 0.3 }
};
Object.assign(MOVES, WEAPON_MOVES);

export const COMBOS = [['scratchA', 'scratchB', 'upper'], ['whipA', 'whipB', 'tailUp'], ['kickA', 'kickB', 'hopkick'], ['jSwipe', 'jSwipe2', 'jFlurry', 'jRake', 'jPounceUp'], ['bloodClaw', 'scytheReap', 'scytheSpin', 'scytheGuillotine', 'bloodSpikes'], ['fSlap', 'fSlap2', 'fLash', 'fBigPalm', 'fSpring']];
// S+J on the ground: each fighter's heavy blow.
export const HEAVY = ['lowclaw', 'sweep', 'kick', 'jLow', 'vampKiss', 'fCroak'];
export const AIR = ['airA', 'airB', 'spike'];
export const NOX_AIR = ['nAirClaw', 'nAirVortex', 'nAirCross', 'nAirScythe'];
export const JUMA_AIR = ['jAirClaw', 'jAirSpin', 'jAirDive'];
export const FROG_AIR = ['fAirSlap', 'fAirSpin', 'fAirLash', 'fStomp'];
export const BEAST_COMBO = ['bSlam', 'bHammer', 'bClap', 'bUpper'];
export const BEAST_AIR = ['bAirClaw', 'bAirSmash'];
export const TITAN_COMBO = ['tHook', 'tSmash', 'tUpper'];
export const TITAN_AIR = ['tAirClaw', 'tAirSmash'];
// The ground and air strings a fighter is on right now (Juma's depend on her form).
export const comboOf = a => { const s = styleOf(a); return s === 3 && a.form ? (a.form === 'titan' ? TITAN_COMBO : BEAST_COMBO) : COMBOS[s]; };
export const airOf = a => { const s = styleOf(a); return s === 4 ? NOX_AIR : s === 5 ? FROG_AIR : s === 3 ? (a.form === 'titan' ? TITAN_AIR : a.form === 'beast' ? BEAST_AIR : JUMA_AIR) : AIR; };
// Air moves and the dash strike hit with each fighter's natural weapon.
export const NATURAL = ['claw', 'whip', 'kick', 'claw', 'blood', 'slap'];

// Specials (K). Durations are upper bounds; most end on contact or landing.
export const SPECIALS = [
  { id: 'pounce', cd: 6, dur: 0.75, ride: 1.3 },
  { id: 'ball', cd: 8, dur: 2.6 },
  { id: 'sky', cd: 7, dur: 2.2 },
  // Juma's K changes with her form (the frenzy, the seismic leap, the thunderclap or the crushing
  // grab). Her transformations are not on a button: they come out of the fury bar, the beast's
  // after `dur` seconds of shivering (the pop at `pop`), the titan's after `titan` (pop at `titanPop`).
  { id: 'fury', cd: 7, dur: 1.0, pop: 0.6, titan: 1.7, titanPop: 1.15 },
  // Piercing blood: blood condensed into an orb (charge, open to hits), then fired as a beam
  // through the arena; diagonally down from the air. Three blood marks on a rival go supernova.
  { id: 'beam', cd: 6, dur: 0.78, charge: 0.34 },
  // The frog's K is his inhale (or the spit, with someone inside); S+K throws the special he copied.
  { id: 'inhale', cd: 1.1 }
];
