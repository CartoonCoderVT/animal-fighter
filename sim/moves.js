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
  // Lola, the maid of the clock: a frantic knife fighter who skips through time. Two quick cuts, a
  // dance of knives that holds the rival, then she skips behind them and stabs them in the back,
  // and the rising spiral that launches. warp: where she reappears around the rival ('behind',
  // 'front' or 'above') at warpAt of the move; reach: how far away she finds that rival.
  lCutA: { dur: 0.2, hits: [0.4], range: 28, band: 24, dmg: [5], kind: 'knife', kb: [[0.9, 0]], cd: 0.07, step: 2.4 },
  lCutB: { dur: 0.2, hits: [0.4], range: 28, band: 24, dmg: [5], kind: 'knife', kb: [[1, 0]], cd: 0.07, step: 2.4 },
  lDance: { dur: 0.46, hits: [0.18, 0.3, 0.42, 0.54, 0.66, 0.8], range: 30, band: 26, dmg: [2, 2, 2, 2, 2, 3], kind: 'knife', kb: [[0.3, 0], [0.3, 0], [0.3, 0], [0.3, 0], [0.3, 0], [1, -0.5]], cd: 0.12, hold: 0.36, step: 1.2, flurry: true },
  lBehind: { dur: 0.34, hits: [0.56], range: 30, band: 26, dmg: [8], kind: 'knife', kb: [[1.6, -1]], cd: 0.12, hold: 0.46, crumple: true, warp: 'behind', warpAt: 0.26, reach: 90 },
  lRise: { dur: 0.36, hits: [0.42], range: 30, band: 30, dmg: [9], kind: 'knife', kb: [[1, -10.5]], cd: 0.2, launch: true, step: 2 },
  // S+J: down low, both knives through the ankles; the rival goes down.
  lLow: { dur: 0.32, hits: [0.42], range: 34, band: 22, dmg: [8], kind: 'knife', kb: [[2.2, -3]], cd: 0.34, knock: true, low: true, step: 2.5 },
  // Side+J: the skip. She is in front of a rival a long way off and cuts twice; the string goes on
  // from the dance of knives.
  lSkip: { dur: 0.36, hits: [0.48, 0.7], range: 30, band: 24, dmg: [5, 6], kind: 'knife', kb: [[0.4, -0.5], [1.2, -1]], cd: 0.24, hold: 0.42, warp: 'front', warpAt: 0.18, reach: 170 },
  // Her air string: crossing cuts, a wheel of knives that pulls the rival in, then she skips over
  // their head and drives both knives down, slamming them into the floor to bounce.
  lAirCut: { dur: 0.22, hits: [0.3, 0.64], range: 28, band: 26, dmg: [4, 4], kind: 'knife', kb: [[0.4, -0.5], [0.5, -0.5]], cd: 0.08 },
  lAirSpin: { dur: 0.38, hits: [0.2, 0.36, 0.52, 0.68, 0.84], range: 30, band: 30, dmg: [2, 2, 2, 2, 3], kind: 'knife', kb: [[0, 0], [0, 0], [0, 0], [0, 0], [0.6, -1]], cd: 0.1, around: true, pull: true },
  lAirDive: { dur: 0.36, hits: [0.52], range: 30, band: 38, dmg: [9], kind: 'knife', kb: [[1.2, 9]], cd: 0.25, spike: true, bounce: true, around: true, warp: 'above', warpAt: 0.22, reach: 120 },
  // Her bullet hell, out of her strings: knives laid in the air in a pattern (sim/timestop.js, SET).
  // They hang where she put them, turn toward the rival at the last instant and fly. set: the
  // pattern; setAt: when in the move the knives leave her hands; pin: hitstun a rival already
  // reeling is held in for the pattern to land.
  // A fresh tap of a direction + J: she skips back out of reach and lays a wall of knives between
  // them; J again skips her back in at the dance of knives.
  lFan: { dur: 0.4, hits: [], range: 0, band: 0, dmg: [], kind: 'knife', kb: [], cd: 0.12, warp: 'away', warpAt: 0.12, reach: 90, set: 'wall', setAt: 0.32, pin: 0.34 },
  // S+J: a rising flick that pops the rival up and flings a fan of knives high over them; they rain
  // down one after another while the string goes on from behind them.
  lRain: { dur: 0.36, hits: [0.38], range: 30, band: 28, dmg: [5], kind: 'knife', kb: [[0.4, -4.5]], cd: 0.14, hold: 0.5, step: 1.5, set: 'rain', setAt: 0.42 },
  // In the air, a fresh tap of a direction + J: she wheels round the rival laying a ring of knives
  // that closes in on them in a spiral; J again is the dive.
  lAirRing: { dur: 0.4, hits: [0.24], range: 30, band: 30, dmg: [3], kind: 'knife', kb: [[0, -0.5]], cd: 0.1, around: true, hold: 0.42, set: 'ring', setAt: 0.5, pin: 0.4 },
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
  // Her air string: twin claws, a spinning ball of claws, the dive that slams them into the floor.
  jAirClaw: { dur: 0.2, hits: [0.3, 0.64], range: 28, band: 26, dmg: [4, 4], kind: 'claw', kb: [[0.4, -0.5], [0.5, -0.5]], cd: 0.08 },
  jAirSpin: { dur: 0.36, hits: [0.2, 0.4, 0.6, 0.8], range: 30, band: 30, dmg: [3, 3, 3, 4], kind: 'claw', kb: [[0, 0], [0, 0], [0, 0], [0.6, -1]], cd: 0.1, around: true, pull: true },
  jAirDive: { dur: 0.32, hits: [0.42], range: 32, band: 34, dmg: [9], kind: 'claw', kb: [[1.5, 9]], cd: 0.25, spike: true, bounce: true },
  // Juma as the beast: slow, enormous, and armored while she swings. lag: a longer hit freeze;
  // quake: how hard the floor shakes and throws up rocks where the blow lands.
  bSlam: { dur: 0.56, hits: [0.46], range: 40, band: 30, dmg: [15], kind: 'paw', kb: [[1, 0]], cd: 0.26, step: 2, hold: 0.66, crumple: true, quake: 3, lag: 1.5 },
  bHammer: { dur: 0.62, hits: [0.48], range: 46, band: 30, dmg: [17], kind: 'paw', kb: [[1.8, 0]], cd: 0.3, step: 3, hold: 0.7, shock: 64, quake: 4, lag: 1.6 },
  bUpper: { dur: 0.64, hits: [0.45], range: 40, band: 36, dmg: [18], kind: 'paw', kb: [[1.5, -12.5]], cd: 0.36, launch: true, step: 2, quake: 3, lag: 1.7 },
  // S+J: the earthquake, both fists into the floor and a shockwave out both ways.
  bQuake: { dur: 0.72, hits: [0.5], range: 30, band: 30, dmg: [14], kind: 'paw', kb: [[2, -6]], cd: 0.6, knock: true, around: true, shock: 112, shockAt: 0, quake: 7, lag: 1.6 },
  // In the air: both paws together, slamming the rival down to bounce.
  bAirSmash: { dur: 0.42, hits: [0.42], range: 38, band: 38, dmg: [14], kind: 'paw', kb: [[1.5, 10]], cd: 0.3, spike: true, bounce: true, around: true, lag: 1.5 },
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
  // DARK NOX: the scythe flies free (sim/nox.js) and he fights bare-clawed, fast and savage. Each of
  // these blows has the scythe striking along with it (FAM_PLAN). dark: already DARK NOX's own numbers.
  dRend: { dur: 0.2, hits: [0.4], range: 34, band: 26, dmg: [6], kind: 'blood', kb: [[1, 0]], cd: 0.06, step: 3, dark: true },
  dRake: { dur: 0.22, hits: [0.4], range: 34, band: 28, dmg: [6], kind: 'blood', kb: [[0.6, -1.5]], cd: 0.06, dark: true },
  dFrenzy: { dur: 0.42, hits: [0.15, 0.35, 0.55, 0.75], range: 32, band: 28, dmg: [2.5, 2.5, 2.5, 3], kind: 'blood', kb: [[0.2, 0], [0.2, 0], [0.2, 0], [0.8, -1]], cd: 0.08, hold: 0.5, flurry: true, dark: true },
  dReap: { dur: 0.32, hits: [0.35], range: 34, band: 32, dmg: [7], kind: 'blood', kb: [[0.6, -3]], cd: 0.1, hold: 0.55, dark: true },
  dHarvest: { dur: 0.46, hits: [0.4], range: 72, band: 30, dmg: [10], kind: 'blood', kb: [[1, -10.5]], cd: 0.22, launch: true, spikes: [16, 30, 44, 58, 72], noSmear: true, dark: true },
  dAirClaw: { dur: 0.22, hits: [0.3, 0.62], range: 32, band: 28, dmg: [4, 4], kind: 'blood', kb: [[0.4, -0.5], [0.5, -0.5]], cd: 0.08, dark: true },
  dAirVortex: { dur: 0.38, hits: [0.2, 0.45, 0.7], range: 34, band: 34, dmg: [3, 3, 3], kind: 'blood', kb: [[0, 0], [0, 0], [0.6, -1]], cd: 0.1, around: true, pull: true, dark: true },
  dAirDive: { dur: 0.32, hits: [0.42], range: 34, band: 36, dmg: [9], kind: 'blood', kb: [[1.5, 9]], cd: 0.22, spike: true, bounce: true, around: true, dark: true },
  dKiss: { dur: 0.42, hits: [0.3, 0.66], range: 30, band: 24, dmg: [6, 9], kind: 'fang', kb: [[0.4, 0], [4.5, -2.5]], cd: 0.35, drain: 0.75, step: 4, feast: true, noSmear: true, dark: true },
  dExecute: { dur: 0.46, hits: [0.55], range: 44, band: 36, dmg: [14], kind: 'blood', kb: [[0, 2]], cd: 0.45, execute: true, noSmear: true, dark: true },
  dPhantom: { dur: 0.32, hits: [0.3], range: 90, band: 24, dmg: [8], kind: 'blood', kb: [[0.6, -2.5]], cd: 0.2, pass: true, blink: 90, noSmear: true, dark: true },
  // Mingau, the Cat King: he never strikes himself. Each of his moves is an order (a gesture of the
  // scepter) and his court does the fighting (COURT_PLAN; sim/court.js). range: how far his orders reach,
  // for the bots.
  kSlash: { dur: 0.2, hits: [], range: 90, band: 40, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.12, noSmear: true, order: true },
  kStab: { dur: 0.2, hits: [], range: 110, band: 40, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.12, noSmear: true, order: true },
  kVolley: { dur: 0.24, hits: [], range: 200, band: 60, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.1, noSmear: true, order: true },
  kZap: { dur: 0.24, hits: [], range: 180, band: 60, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.12, noSmear: true, order: true },
  kBash: { dur: 0.3, hits: [], range: 70, band: 40, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.25, noSmear: true, order: true },
  kAirSlash: { dur: 0.2, hits: [], range: 90, band: 50, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.08, noSmear: true, order: true },
  kAirShot: { dur: 0.22, hits: [], range: 200, band: 80, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.1, noSmear: true, order: true },
  kAirMeteor: { dur: 0.28, hits: [], range: 180, band: 80, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.25, noSmear: true, order: true },
  kRain: { dur: 0.3, hits: [], range: 200, band: 60, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.5, noSmear: true, order: true },
  kRise: { dur: 0.28, hits: [], range: 80, band: 40, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.25, noSmear: true, order: true },
  kMercy: { dur: 0.3, hits: [], range: 110, band: 40, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.4, noSmear: true, order: true },
  kCharge: { dur: 0.32, hits: [], range: 120, band: 30, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.4, noSmear: true, order: true },
  kShadow: { dur: 0.22, hits: [], range: 140, band: 40, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.15, noSmear: true, order: true },
  kDrop: { dur: 0.28, hits: [], range: 130, band: 90, dmg: [0], kind: 'order', kb: [[0, 0]], cd: 0.35, noSmear: true, order: true },
  // Everyone: the air string (the last one spikes down), the dash strike
  airA: { dur: 0.22, hits: [0.4], range: 28, band: 26, dmg: [7], kind: 'air', kb: [[1.5, 0]], cd: 0.12 },
  airB: { dur: 0.26, hits: [0.45], range: 28, band: 28, dmg: [8], kind: 'air', kb: [[1.8, 0]], cd: 0.14 },
  spike: { dur: 0.32, hits: [0.45], range: 30, band: 30, dmg: [12], kind: 'air', kb: [[2.5, 9]], cd: 0.35, knock: true, spike: true },
  dashAtk: { dur: 0.3, hits: [0.35], range: 34, band: 24, dmg: [11], kind: 'air', kb: [[6, -3]], cd: 0.3 }
};
Object.assign(MOVES, WEAPON_MOVES);

export const COMBOS = [['kSlash', 'kStab', 'kVolley', 'kZap', 'kBash'], ['whipA', 'whipB', 'tailUp'], ['lCutA', 'lCutB', 'lDance', 'lBehind', 'lRise'], ['jSwipe', 'jSwipe2', 'jFlurry', 'jRake', 'jPounceUp'], ['bloodClaw', 'scytheReap', 'scytheSpin', 'scytheGuillotine', 'bloodSpikes']];
// S+J on the ground: each fighter's heavy blow.
export const HEAVY = ['kRain', 'sweep', 'lLow', 'jLow', 'vampKiss'];
export const KING_AIR = ['kAirSlash', 'kAirShot', 'kAirMeteor'];
export const AIR = ['airA', 'airB', 'spike'];
export const NOX_AIR = ['nAirClaw', 'nAirVortex', 'nAirCross', 'nAirScythe'];
export const DARK_COMBO = ['dRend', 'dRake', 'dFrenzy', 'dReap', 'dHarvest'];
export const DARK_AIR = ['dAirClaw', 'dAirVortex', 'dAirDive'];
export const JUMA_AIR = ['jAirClaw', 'jAirSpin', 'jAirDive'];
export const LOLA_AIR = ['lAirCut', 'lAirSpin', 'lAirDive'];
export const BEAST_COMBO = ['bSlam', 'bHammer', 'bUpper'];
export const BEAST_AIR = ['bAirSmash'];
// The ground string a fighter is on right now (Juma's and Nox's depend on their form).
export const comboOf = a => (a.type === 3 && a.form === 'beast' ? BEAST_COMBO : a.type === 4 && a.form === 'dark' ? DARK_COMBO : COMBOS[a.type]);
export const noxAir = a => (a.form === 'dark' ? DARK_AIR : NOX_AIR);
// Air moves and the dash strike hit with each fighter's natural weapon.
export const NATURAL = ['claw', 'whip', 'knife', 'claw', 'blood'];

// Specials (K). Durations are upper bounds; most end on contact or landing.
export const SPECIALS = [
  // BANDEIRA REAL: the Cat King drives his banner into the floor (act 'plant', the banner stands at `pop`);
  // while his kingdom stands K is VOLTA AO REINO instead (act 'recall', `recall` s, home at `warp`).
  // KINGDOM, sim/kingdom.js.
  { id: 'banner', cd: 15, dur: 0.8, pop: 0.45, recall: 0.8, warp: 0.55 },
  { id: 'ball', cd: 8, dur: 2.6 },
  // ZA WARUDO: Lola stops time (sim/timestop.js). Slow to charge; her blows that land speed it up.
  { id: 'world', cd: 20 },
  // Juma turns into the beast: the shiver, the pop at `pop`, the roar; `form` seconds as the beast.
  { id: 'morph', cd: 9, dur: 1.0, pop: 0.6, form: 11 },
  // Piercing blood: blood condensed into an orb (charge, open to hits), then fired as a beam
  // through the arena; diagonally down from the air. Three blood marks on a rival go supernova.
  { id: 'beam', cd: 6, dur: 0.78, charge: 0.34 }
];

// Nox's blood: every blow of his makes the rival bleed (`bleed`, twice that as DARK NOX), and he drinks
// what they bleed into his meter (`drink` points per point of bleeding damage, up to `max`), and the pools
// of blood on the floors near him (POOL). Full, K makes him DARK NOX: `rise` seconds of transformation
// (he turns at `pop`), then `time` seconds (kept through death: the clock waits while he is down) of his
// own frenzied moveset with the scythe flying free (FAM), any other blow of his `dmg`x as hard, `kb`x the
// push and `range`x / `band`x the reach, taking `armor`x the damage, `speed`x as fast on his feet; K is then
// his blood beam every `beamCd` s. `fade`: turning back.
export const DARK = { max: 100, bleed: 0.3, drink: 2, rise: 1.0, pop: 0.6, time: 30, fade: 0.5, dmg: 1.45, kb: 1.3, range: 1.8, band: 1.45, armor: 0.85, speed: 1.15, beamCd: 2.2 };

// Pools of blood on the floors (sim/nox.js): `spill` of a blow per point of damage that draws blood, up
// to `max` each, at most `cap` of them, drops landing within `merge` of one join it; they dry `dry` a
// second. Nox drinks the ones within `reach` x `reachY` of him (`reachDark` x `reachDarkY` as DARK NOX),
// `rate` a second from each of the `sips` nearest (`rateDark` as DARK NOX): `meter` points of his meter
// per point drunk; as DARK NOX it heals him (`heal` hp per point).
export const POOL = { spill: 0.35, max: 20, cap: 32, merge: 10, dry: 0.1, min: 0.25, reach: 80, reachY: 50, reachDark: 140, reachDarkY: 80, rate: 5, rateDark: 10, sips: 2, meter: 0.4, heal: 0.35 };

// DARK NOX's scythe let loose (sim/nox.js): on its own it darts at whoever is within `reach` of him every
// `cd` s (`first` s after he turns), at `speed` a step, and cuts (`dmg`, `kb`, `hold` s of hitstun, `r`
// wide); `give` s to reach them before it gives up. With his dark blows it strikes along (FAM_PLAN).
export const FAM = { reach: 150, cd: 1.0, first: 0.5, speed: 9, dmg: 4, kb: [2.2, -2], hold: 0.26, r: 24, give: 0.5 };
// When the scythe strikes in each of his dark blows (`at`, fraction of the move) and how: `cross` through
// the rival from behind Nox to the far side, `reap` up from under them, `spin` around them, `chop` down
// from above, `whirl` a wide circle around Nox, `orbit` a tight one, `hook` from behind them toward him.
export const FAM_PLAN = {
  dRend: [{ at: 0.6, k: 'cross', dmg: 5, kb: [2, -1.5], hold: 0.4 }],
  dRake: [{ at: 0.62, k: 'reap', dmg: 5, kb: [0.6, -4], hold: 0.5 }],
  dFrenzy: [{ at: 0.3, k: 'spin', dmg: 3, kb: [0, -0.5], hold: 0.55 }, { at: 0.72, k: 'spin', dmg: 3, kb: [0.3, -0.5], hold: 0.55 }],
  dReap: [{ at: 0.7, k: 'chop', dmg: 7, kb: [0.5, 3], hold: 0.6, crumple: true }],
  dHarvest: [{ at: 0.6, k: 'whirl', dmg: 8, kb: [6, -6], knock: true }],
  dAirClaw: [{ at: 0.75, k: 'cross', dmg: 4, kb: [0.6, -1.5], hold: 0.4 }],
  dAirVortex: [{ at: 0.3, k: 'orbit', dmg: 3, pull: true, hold: 0.45 }, { at: 0.6, k: 'orbit', dmg: 3, pull: true, hold: 0.45 }, { at: 0.9, k: 'orbit', dmg: 3, pull: true, hold: 0.45 }],
  dAirDive: [{ at: 0.3, k: 'chop', dmg: 6, kb: [1, 9], spike: true }],
  dKiss: [{ at: 0.2, k: 'hook', dmg: 3, pull: true, hold: 0.5 }],
  dExecute: [{ at: 0.45, k: 'chop', dmg: 9, down: true }],
  dPhantom: [{ at: 0.75, k: 'cross', dmg: 6, kb: [1.5, -3], hold: 0.4 }]
};

// The Cat King's court (sim/court.js): the five little cats who follow Mingau, in this order. RANKS:
// each one's place by him, [along his facing (negative: behind), up from his feet].
export const COURT = ['soldier', 'archer', 'assassin', 'mage', 'shield'];
export const RANKS = { soldier: [-22, 0], archer: [-52, 0], assassin: [-38, 0], mage: [-30, 15], shield: [20, 0] };
// What each of them can do: `dur` s, strikes at `hits` (fractions of dur), `dmg` each, push `kb`, `hold` s of
// hitstun at least, `reach` (how far from the King a target can be), `r` how wide the strike is.
// Each of them lives and can die: `COURT_HP` health, back `COURT_RESPAWN` s after falling (all of them
// when the King comes back).
export const COURT_HP = { soldier: 24, archer: 14, assassin: 16, mage: 14, shield: 36 };
export const COURT_RESPAWN = 11;
export const COURT_ACTS = {
  soldier: {
    slash: { dur: 0.272, hits: [0.55], dmg: 5, kb: [1.5, -1], hold: 0.4, reach: 110, r: 20 },
    rise: { dur: 0.32, hits: [0.5], dmg: 7, kb: [0.8, -10.5], launch: true, reach: 90, r: 20 },
    air: { dur: 0.24, hits: [0.5], dmg: 6, kb: [0.6, -1.2], hold: 0.4, reach: 110, r: 22 },
    plunge: { dur: 0.32, hits: [0.6], dmg: 9, kb: [1, 9], spike: true, reach: 110, r: 22 },
    charge: { dur: 0.4, hits: [0.2, 0.4, 0.6, 0.8], dmg: 4, kb: [6, -4], reach: 130, r: 18, run: 130 }
  },
  archer: {
    shot: { dur: 0.288, hits: [0.5], dmg: 5, hold: 0.3, reach: 230 },
    volley: { dur: 0.4, hits: [0.3, 0.55, 0.8], dmg: 3, hold: 0.35, reach: 180 },
    rain: { dur: 0.36, hits: [0.4], dmg: 4, hold: 0.4, reach: 220, arrows: 7, spread: 18, delay: 0.3, height: 150 },
    airshot: { dur: 0.288, hits: [0.5], dmg: 5, hold: 0.4, reach: 220 }
  },
  assassin: {
    stab: { dur: 0.336, hits: [0.45, 0.75], dmg: 4, kb: [0.4, -0.5], hold: 0.45, bleed: 0.4, reach: 125, r: 20 },
    shadow: { dur: 0.32, hits: [0.4], dmg: 6, kb: [1, -1.5], hold: 0.4, bleed: 0.6, reach: 150, r: 20, run: 30 },
    mercy: { dur: 0.4, hits: [0.3, 0.55, 0.8], dmg: 4, bleed: 0.8, reach: 120, r: 24, down: true }
  },
  mage: {
    zap: { dur: 0.336, hits: [0.55], dmg: 6, kb: [0.3, -2], hold: 0.45, shock: 0.3, reach: 170, r: 18 },
    meteor: { dur: 0.4, hits: [0.7], dmg: 8, kb: [1, 9], spike: true, reach: 200, r: 24 }
  },
  shield: {
    bash: { dur: 0.32, hits: [0.5], dmg: 6, kb: [1.5, -10.5], launch: true, reach: 110, r: 20 },
    drop: { dur: 0.36, hits: [0.6], dmg: 8, kb: [1.5, 9], spike: true, reach: 140, r: 24 },
    charge: { dur: 0.4, hits: [0.2, 0.4, 0.6, 0.8], dmg: 4, kb: [6, -4], reach: 130, r: 18, run: 130 },
    guard: { dur: 0.2, hits: [] }
  }
};
// Which of them each of the King's orders sends (and what they do).
export const COURT_PLAN = {
  kSlash: [['soldier', 'slash']], kStab: [['assassin', 'stab']], kVolley: [['archer', 'volley']], kZap: [['mage', 'zap']], kBash: [['shield', 'bash']],
  kAirSlash: [['soldier', 'air']], kAirShot: [['archer', 'airshot']], kAirMeteor: [['mage', 'meteor']],
  kRain: [['archer', 'rain']], kRise: [['soldier', 'rise']], kMercy: [['assassin', 'mercy']],
  kCharge: [['shield', 'charge'], ['soldier', 'charge']], kShadow: [['assassin', 'shadow']], kDrop: [['shield', 'drop']]
};
// The court on its own (sim/court.js): they live to guard the King, frantically. Rivals within `guard` x
// `band` of him are threats (more so the one swinging at him or who just hit him). Every `beat` s another of
// them may strike on its own (`acts`), each then waiting its own `cd`; those blows are `dmg`x as hard, hold
// at most `hold` s and never launch, and only one of them every `stagger` s makes a rival reel (the others
// just sting), unless the King is being hit. The shield takes a blow aimed at the King from its side every
// `block` s. None of them ever strays more than `leash` from him (`leashY` up and down); in rank they never
// stand still, hopping up to `fidget` around their place.
export const AUTO = {
  guard: 170, band: 90, beat: 0.18, dmg: 0.22, hold: 0.2, stagger: 0.9, block: 2.2, leash: 150, leashY: 110, fidget: 10,
  acts: { soldier: 'slash', archer: 'shot', assassin: 'stab', mage: 'zap', shield: 'bash' },
  cd: { soldier: 0.8, archer: 1, assassin: 1.5, mage: 1.6, shield: 1.2 }
};
// The Cat King's kingdom (sim/kingdom.js), by level: 1 BANDEIRA, 2 CASA, 3 CASTELO.
//  - The structure: a box `w` x `h` standing on its base (x, y), `hp` health (damage done carries over a
//    level-up), `need` fish to grow to the next level, each fish delivered heals it `heal`. It is no wall:
//    everyone walks through it, but rivals' shots stop on it. Explosions hurt it `vs.blast`x, shotgun
//    pellets `vs.pellet`x, a thrown thing `vs.thrown`.
//  - The aura: a dome `aura` x `auraY` on the base; at level 3 the whole arena. His court inside it is
//    buffed by tier (`buff`): blows `dmg`x, waits `cd`x, takes `taken`x, heals `regen` a second, back from
//    the dead in `respawn` s. His kingdom's own units always fight at their kingdom's level.
//  - Planting: within `snap` of where he stands, never within `apart` of another kingdom on the same
//    floor, at most `max` kingdoms; `plantCd` s after it, `failCd` s after a plant or a recall that did not
//    happen, `replant` s after his kingdom falls (and whoever razed it eats `loot` hp). The recall only from
//    `recallMin` away, then `recallCd` s. `up`: s a level takes to build; `fall`: s the ruin takes to go.
//  - Fish (`fish`): at most `cap` on the map's spots at once, a spot back `back` s after it was taken
//    (`first` + `stagger` per spot at the start); spots within `near` of a kingdom stay empty (the workers
//    have to go out); a rival walking over one eats it (`eat` hp); a worker takes `gather` s to pick one up
//    and `drop` s to put it in.
//  - Workers: `n` by level, one more every `every` s (the first `first` s after the banner), back `respawn`
//    s after one dies; `speed` a step (`carry`x with a fish); they swing at a rival in their way (`see` ahead,
//    `seeY` up and down) every `cd` s and walk on after `tries` swings or `give` s, ignoring them `ignore` s.
//  - Knights: `n` by level, guarding the base `guard` x `guardY` around it, never more than `leash` from it,
//    standing `post` past its walls; they cut whoever is within `reach` every `cd` s; back in `respawn` s.
//  - Archers: `n` by level on the castle's towers (`dx`), shooting a rival within `range` x `rangeY` every
//    `every` s (`first` s after they appear), leading them by `lead`; back in `respawn` s.
//  - unitY: how high a unit's body is over its feet; unitR: how close a shot must pass to hit it.
// No blow of the kingdom ever launches, knocks down or spikes, and only one of its blows (or the court's)
// every AUTO.stagger s makes a rival reel.
export const KINGDOM = {
  w: [0, 20, 56, 84], h: [0, 60, 60, 96], hp: [0, 150, 260, 380],
  need: [0, 3, 6, 0], heal: [0, 6, 10, 16],
  aura: [0, 130, 180, Infinity], auraY: [0, 110, 140, Infinity],
  buff: { dmg: [1, 1.2, 1.35, 1.5], cd: [1, 0.85, 0.75, 0.65], taken: [1, 0.9, 0.8, 0.7], regen: [0, 0.5, 1, 1.5], respawn: [COURT_RESPAWN, 9, 7, 5.5] },
  vs: { blast: 1.5, pellet: 0.6, thrown: 10 },
  snap: 60, apart: 140, max: 4, recallMin: 160, recallCd: 12, plantCd: 8, failCd: 2, replant: 15, loot: 15,
  up: 1.2, fall: 1.0, msg: 1.2, hitFx: 0.15,
  ring: { r: 40, ry: 30, dmg: 4, kb: [3, -4] },
  fish: { cap: 5, back: 6, first: 0.5, stagger: 0.4, near: 140, eat: 4, gather: 0.5, drop: 0.3 },
  worker: {
    n: [0, 3, 4, 4], first: 1.5, every: 1.5, respawn: 6, hp: 10, speed: 1.9, carry: 0.85, see: 24, seeY: 30, cd: 1.0, tries: 3, give: 2, ignore: 3,
    swing: { dur: 0.35, at: 0.5, dmg: 3, kb: [1.2, -1], hold: 0.15, r: 16, kind: 'bash' }
  },
  knight: {
    n: [0, 0, 2, 2], hp: 30, speed: 1.8, guard: 140, guardY: 60, leash: 120, post: 14, reach: 40, cd: 1.3, respawn: 10,
    swing: { dur: 0.4, at: 0.55, dmg: 4, kb: [2, -1.5], hold: 0.3, r: 28, kind: 'blade' }
  },
  archer: { n: [0, 0, 0, 2], hp: 14, dx: [-30, 30], range: 300, rangeY: 220, every: 2.0, first: 0.6, draw: 0.15, pose: 0.3, dmg: 3, hold: 0.25, lead: 0.5, respawn: 14 },
  unitY: { worker: 9, knight: 12, archer: 9 }, unitR: { worker: 8, knight: 10, archer: 8 }
};
// Arrows: speed a step and gravity; the shield blocks shots that pass within `guard` of it.
export const ARROW = { speed: 12, grav: 0.18, guard: 13 };

// Breaking a combo: while reeling from a hit, Shift opens `window` seconds of parry; time it to the next
// blow and it is parried and the string ends there. Whether it worked or not, Shift does nothing again
// for `cd` seconds, so mashing it does not work. `safe`: a moment untouchable after breaking out.
export const BURST = { window: 0.14, cd: 0.9, safe: 0.2 };

// ZA WARUDO's timing, shared by the simulation (sim/timestop.js) and the cutscene. intro: the cut-in
// over the frozen frame; wave: the color drains out from her; stop: the stopped world; outro: the
// watch snaps shut. hang: how long a thrown knife flies before it stops in the air.
export const WORLD = { intro: 1.15, wave: 0.45, stop: 2.4, outro: 0.55, hang: 0.13, speed: 9, dmg: 1.2, range: 430 };
// Knives she lays in the air in her strings. fly: how long one takes from her hand to its spot;
// aim: how long before it flies it turns toward its rival; dmg: per knife (skip: the two she
// leaves where she vanished in a combo skip); max: knives of hers hanging at once; cd: between
// two of the branches that lay them.
export const SET = { fly: 0.11, aim: 0.12, dmg: 1.5, skip: 1.2, max: 30, cd: 1.3, life: 1 };
export const WORLD_T = WORLD.intro + WORLD.wave + WORLD.stop + WORLD.outro;
export const worldPhase = t => (t < WORLD.intro ? 'intro' : t < WORLD.intro + WORLD.wave ? 'wave' : t < WORLD.intro + WORLD.wave + WORLD.stop ? 'stop' : 'outro');
