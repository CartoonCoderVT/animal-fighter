// Frame-based animation for the pixel fighters. A frame gives each slot [dx, dy, degrees]
// (clockwise) relative to the rest pose, plus tail and whole-figure spin. The frame is picked
// from observable actor state only, so the host simulation (hit location, ragdoll start pose)
// and every remote renderer agree without sending poses over the network.
import { MOVES, WORLD, DARK, SPECIALS } from '../sim/moves.js';

const crouch = { head: [0, 3], body: [0, 1], armF: [0, 2], armB: [0, 2], footF: [1, 0], footB: [-1, 0] };

export const FRAMES = {
  idle: {},
  idle2: { head: [0, 1], armF: [0, 1], armB: [0, 1] },
  run1: { footF: [2, 0], footB: [-2, -1], head: [1, 0], armF: [-1, 0, 25], armB: [1, 0, -25], tailDeg: 8 },
  runPass: { body: [0, -1], head: [1, -1], footB: [0, -1], armF: [0, -1], armB: [0, -1], tailDeg: 0 },
  run2: { footF: [-2, -1], footB: [2, 0], head: [1, 0], armF: [1, 0, -25], armB: [-1, 0, 25], tailDeg: -8 },
  runPass2: { body: [0, -1], head: [1, -1], footF: [0, -1], armF: [0, -1], armB: [0, -1], tailDeg: 0 },
  jump: { footF: [1, -2], footB: [-1, -1], armF: [0, -1, -160], armB: [0, -1, 160], head: [0, -1], body: [0, -1], tailDeg: -12 },
  fall: { footF: [1, 0], footB: [-1, -1], armF: [0, -1, -120], armB: [0, -1, 120], tailDeg: 14 },
  crouch,
  land: { head: [0, 2], body: [0, 1], armF: [0, 1], armB: [0, 1] },
  skid: { head: [-1, 0], body: [-1, 0], footF: [2, 0], armF: [-1, 0, 30], armB: [0, 0, 30], tailDeg: 10 },
  hurt: { head: [-1, 0], armF: [1, -1, -60], armB: [-1, -1, 60], body: [-1, 0], tailDeg: 12 },
  dizzy: { head: [-1, 1], armF: [0, 0, 20], armB: [0, 0, -20] },
  climb1: { armF: [0, -2, 180], footF: [0, -1], tailDeg: 10 },
  climb2: { armB: [0, -2, 180], armF: [0, 0, 10], footB: [0, -1], tailDeg: -10 },
  glide: { armF: [0, -1, -120], armB: [0, -1, 120], footF: [1, -1], footB: [-1, -1], head: [0, -1], tailDeg: 6 },
  carry: { armF: [0, -1, 180], armB: [0, -1, 180], head: [0, 1] },
  throw: { armF: [1, -1, -100], armB: [0, 0, -40], head: [1, 0], body: [1, 0] },
  stomp: { footF: [0, 1], footB: [0, 1], armF: [0, -2, -170], armB: [0, -2, 170], head: [0, -1], tailDeg: -20 },
  // Nox. Every move is keyed in time (see KEYS): a held anticipation that squashes down and pulls
  // away from the blow (A), one or two snap frames where the whole body stretches into it (X), a
  // clear impact pose (I), follow-through past the target (F) and a recovery already set for the
  // next blow (R). At this size the read comes from squash and stretch, the head and the feet.
  nIdle: { head: [1, 2, 11.25], body: [0, 1], armF: [2, 0, -110], armB: [2, -1, -130], footF: [2, 0], footB: [-2, 0] },
  nIdle2: { head: [1, 3, 11.25], body: [0, 2], armF: [2, 1, -110], armB: [2, 0, -130], footF: [2, 0], footB: [-2, 0] },
  nClawA1: { head: [-2, 2, 11.25], body: [-1, 1], armF: [-3, 0, 135], armB: [2, 1, -60], footF: [3, 0], footB: [-2, 0] },
  nClawA2: { head: [-3, 3, 11.25], body: [-2, 2], armF: [-4, 1, 150], armB: [2, 1, -70], footF: [3, 0], footB: [-3, 0] },
  nClawX: { head: [4, -1, 11.25], body: [3, -1], armF: [4, -2, -110], armB: [-3, -1, 60], footF: [4, 0], footB: [-4, -2, 33.75] },
  nClawI: { head: [4, 0, 22.5], body: [3, 0], armF: [5, 1, -45], armB: [-3, -1, 75], footF: [4, 0], footB: [-4, -1, 22.5] },
  nClawF: { head: [3, 1, 11.25], body: [2, 1], armF: [3, 2, 15], armB: [-2, -1, 50], footF: [3, 0], footB: [-3, 0] },
  nClawR: { head: [1, 1], body: [0, 1], armF: [1, 0, -70], armB: [2, -1, -120], footF: [2, 0], footB: [-2, 0] },
  nLashA1: { head: [-2, 1, 11.25], body: [-1, 1], armF: [-3, 1, 105], armB: [2, 0, -80], footF: [3, 0], footB: [-2, 0] },
  nLashA2: { head: [-3, 2, 11.25], body: [-2, 1], armF: [-4, 1, 120], armB: [2, -1, -100], footF: [3, 0], footB: [-3, 0] },
  nLashX: { head: [3, -1], body: [2, -1], armF: [3, -3, -160], armB: [-3, 0, 60], footF: [3, 0], footB: [-3, -1, 22.5] },
  nLashI: { head: [4, 0, 11.25], body: [3, 0], armF: [4, -1, -90], armB: [-3, -1, 70], footF: [4, 0], footB: [-4, -1, 22.5] },
  nLashF: { head: [-2, 0, -11.25], body: [-2, 0], armF: [0, 0, -40], armB: [-3, 0, 40], footF: [3, 0], footB: [-3, 0] },
  nLashR: { head: [1, 2, 11.25], body: [0, 1], armF: [3, 1, -30], armB: [1, 0, -80], footF: [2, 0], footB: [-2, 0] },
  // Scythe guillotine: up on the toes with the scythe raised behind, arched at the peak, then the
  // whole body drops with the chop into a deep crouch, blade in the floor.
  gA1: { head: [-1, -2, -11.25], body: [-1, -1], armF: [-1, -4, 165], armB: [-2, -3, 150], footF: [2, -1], footB: [-2, 0] },
  gA2: { head: [-2, -3, -22.5], body: [-2, -2], armF: [-2, -5, 170], armB: [-3, -4, 160], footF: [2, -2, -11.25], footB: [-2, -1] },
  gX: { head: [3, 1, 22.5], body: [2, 1], armF: [3, 0, -60], armB: [1, -1, -90], footF: [3, 0], footB: [-3, -1, 22.5] },
  gI: { head: [3, 4, 33.75], body: [2, 2], armF: [4, 3, -20], armB: [3, 2, -30], footF: [4, 0], footB: [-4, 0] },
  gF: { head: [2, 3, 11.25], body: [2, 2], armF: [4, 3, -20], armB: [3, 2, -30], footF: [4, 0], footB: [-4, 0] },
  gR: { head: [1, 1], body: [0, 1], armF: [2, 0, -80], armB: [1, -1, -120], footF: [2, 0], footB: [-2, 0] },
  // Combat stance with the scythe: low and wide, the back hand on the upright scythe, the front
  // claw raised. Two breaths.
  nStance1: { head: [1, 2, 11.25], body: [0, 1], armF: [2, -1, -110], armB: [-1, 0, 15], footF: [3, 0], footB: [-3, 0] },
  nStance2: { head: [1, 3, 11.25], body: [0, 2], armF: [2, 0, -110], armB: [-1, 1, 15], footF: [3, 0], footB: [-3, 0] },
  // His hero pose on the select screen: wide and low, glaring from under his brow, the back hand on
  // the scythe looming over him, the front claw thrown up and open toward the rival.
  heroPose: { head: [2, 1, 22.5], body: [1, 1], armF: [4, -3, -140], armB: [-1, 0, 15], footF: [4, 0], footB: [-4, 0] },
  heroPose2: { head: [2, 2, 22.5], body: [1, 2], armF: [4, -2, -140], armB: [-1, 1, 15], footF: [4, 0], footB: [-4, 0] },
  // Scythe sweep along the floor: coiled low, lunging lower, stretched out flat, then looking up.
  swA: { head: [-1, 3, 11.25], body: [-1, 2], armF: [-2, 2, 60], armB: [1, 1, -60], footF: [3, 0], footB: [-3, 0] },
  swA2: { head: [-2, 4, 11.25], body: [-2, 2], armF: [-3, 2, 75], armB: [1, 1, -70], footF: [4, 0], footB: [-3, 0] },
  swX: { head: [3, 3, 11.25], body: [2, 2], armF: [3, 3, -40], armB: [-2, 1, 60], footF: [4, 0], footB: [-4, 0, 22.5] },
  swI: { head: [4, 4, 22.5], body: [3, 2], armF: [4, 3, -70], armB: [-3, 1, 70], footF: [5, 0], footB: [-4, 0, 22.5] },
  swF: { head: [3, 3, -11.25], body: [2, 2], armF: [4, 2, -90], armB: [-2, 1, 50], footF: [4, 0], footB: [-4, 0] },
  swR: { head: [1, 1, -22.5], body: [0, 1], armF: [2, 0, -60], armB: [1, -1, -120], footF: [2, 0], footB: [-2, 0] },
  // Execution: the guillotine's rise, then all the way down onto the body.
  exI: { head: [2, 5, 33.75], body: [1, 3], armF: [2, 4, 0], armB: [1, 3, -10], footF: [3, 0], footB: [-3, 0] },
  // Crossing cuts in the air: the downstroke, then cocked low and ripped back up.
  ncLow: { head: [1, 1, 11.25], body: [0, 1], armF: [1, 2, 30], armB: [-1, 0, 40], footF: [1, -2], footB: [-1, -1] },
  ncUp: { head: [2, -1, -11.25], body: [1, -1], armF: [3, -2, -150], armB: [-2, 0, 40], footF: [1, -2], footB: [-2, -1] },
  // Scythe cyclone: low wind-up, then spinning with the scythe wheeling around him, then braced.
  spinS: { armF: [2, -1, -90], armB: [-2, -1, 90], footF: [2, 0], footB: [-2, 0] },
  spinR: { head: [1, 1], body: [0, 1], armF: [3, 0, -90], armB: [0, -1, -60], footF: [3, 0], footB: [-3, 0] },
  nSpkA1: { head: [0, -2], body: [0, -1], armF: [0, -4, 180], armB: [-2, -2, 140], footF: [1, -1], footB: [-1, 0] },
  nSpkA2: { head: [-1, -3, -22.5], body: [0, -2], armF: [0, -5, 180], armB: [-2, -3, 150], footF: [1, -2, -11.25], footB: [-1, -1] },
  nSpkX: { head: [2, 2, 11.25], body: [1, 1], armF: [3, 1, -30], armB: [-2, -1, 100], footF: [3, 0], footB: [-3, 0] },
  nSpkI: { head: [3, 4, 22.5], body: [1, 2], armF: [4, 3, -10], armB: [-2, 1, 70], footF: [3, 0], footB: [-4, 0] },
  nSpkF: { head: [2, 3, -11.25], body: [1, 2], armF: [4, 3, -10], armB: [-2, 1, 50], footF: [3, 0], footB: [-4, 0] },
  nSpkR: { head: [1, 1, -22.5], body: [0, 1], armF: [1, 0, -70], armB: [1, -1, -130], footF: [2, 0], footB: [-2, 0] },
  nKissA1: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-1, -2, -135], armB: [-1, -2, 135], footF: [1, 0], footB: [-1, 0] },
  nKissA2: { head: [-2, -2, -22.5], body: [-1, -2], armF: [-2, -3, -160], armB: [-2, -3, 160], footF: [1, -1], footB: [-1, -1] },
  nKissX: { head: [4, 0, 11.25], body: [3, 0], armF: [4, -1, -100], armB: [3, -2, -110], footF: [4, 0], footB: [-4, -1, 33.75] },
  nKissI: { head: [4, 1, 22.5], body: [3, 0], armF: [4, -1, -80], armB: [3, -1, -70], footF: [3, 0], footB: [-3, 0, 22.5] },
  nKissD: { head: [4, 2, 22.5], body: [3, 1], armF: [3, 0, -60], armB: [3, 0, -50], footF: [2, 0], footB: [-3, 0] },
  nKissI2: { head: [-2, -1, -22.5], body: [-1, -1], armF: [-1, -3, -150], armB: [-2, -3, 150], footF: [2, 0], footB: [-2, 0] },
  nKissR: { head: [0, 1], body: [0, 1], armF: [2, 0, -100], armB: [1, -1, -120], footF: [2, 0], footB: [-2, 0] },
  nCutA1: { head: [0, 3, 11.25], body: [-1, 2], armF: [-2, 1, 135], armB: [2, 1, -60], footF: [3, 0], footB: [-3, 0] },
  nCutA2: { head: [-1, 4, 22.5], body: [-2, 2], armF: [-3, 1, 150], armB: [2, 2, -80], footF: [4, 0], footB: [-4, 0] },
  nCutX: { head: [4, 0, 11.25], body: [3, 0], armF: [-4, 0, 110], armB: [-3, -1, 80], footF: [4, 0], footB: [-5, 0, 22.5] },
  nCutF: { head: [3, 1], body: [2, 1], armF: [-4, 1, 100], armB: [-2, 0, 70], footF: [3, 0], footB: [-4, 0] },
  nCutR: { head: [1, 1, -11.25], body: [0, 1], armF: [-1, 0, 60], armB: [1, -1, -110], footF: [2, 0], footB: [-2, 0] },
  nAcA: { head: [-2, 0, -11.25], body: [-1, 0], armF: [-3, -2, 150], armB: [2, 0, -40], footF: [2, -2], footB: [0, -1] },
  nAcX: { head: [2, -1], body: [2, -1], armF: [3, -2, -120], armB: [-2, -1, 50], footF: [1, -2], footB: [-2, -2] },
  nAcI: { head: [3, 0, 11.25], body: [2, 0], armF: [4, 0, -60], armB: [-2, -1, 60], footF: [1, -2], footB: [-3, -2, 22.5] },
  nAcA2: { head: [1, 0], body: [0, 0], armF: [2, 1, -10], armB: [-3, -2, 150], footF: [1, -2], footB: [-1, -1] },
  nAcX2: { head: [2, -1], body: [2, -1], armB: [3, -2, -120], armF: [-2, 0, 40], footF: [2, -2], footB: [-2, -2], front: 'armB' },
  nAcI2: { head: [3, 0, 11.25], body: [2, 0], armB: [4, 0, -70], armF: [-2, -1, 60], footF: [2, -2], footB: [-3, -2, 22.5], front: 'armB' },
  nAcR: { head: [1, 0], body: [0, 0], armF: [1, -1, -100], armB: [1, -1, -120], footF: [1, -2], footB: [-1, -1] },
  nVxA: { head: [0, 1, 11.25], body: [0, 1], armF: [1, 0, 30], armB: [0, 0, -30], footF: [1, -2], footB: [-1, -2] },
  vortex: { armF: [3, -1, -90], armB: [-3, -1, 90], footF: [1, -2], footB: [-1, -1], head: [0, -1] },
  nScA: { armF: [-2, -3, 160], armB: [-3, -3, 150], body: [-1, -1], head: [-2, -1, -22.5], footF: [2, -2], footB: [1, -2] },
  nScA2: { armF: [-3, -4, 165], armB: [-4, -3, 150], body: [-2, -2], head: [-3, -2, -33.75], footF: [3, -2], footB: [2, -2] },
  nScX: { armF: [1, -3, -170], armB: [0, -3, -175], body: [1, -1], head: [2, -1], footF: [0, -1], footB: [-1, -2] },
  nScI: { armF: [4, 2, -15], armB: [3, 2, -25], head: [3, 1, 22.5], body: [2, 0], footF: [-1, -2], footB: [-2, -2], front: 'armF' },
  nScF: { armF: [3, 3, 10], armB: [2, 3, 0], head: [2, 2, 11.25], body: [1, 1], footF: [0, -1], footB: [-1, -2] },
  beamA: { armF: [-3, 1, 60], armB: [-3, 0, 70], body: [-2, 1], head: [-2, 2, 11.25], footF: [3, 0], footB: [-3, 0] },
  beamC0: { armF: [2, -1, -90], armB: [2, -2, -100], body: [-1, 1], head: [0, 1], footF: [3, 0], footB: [-4, 0] },
  beamC1: { armF: [2, -1, -90], armB: [2, -2, -100], body: [-1, 2], head: [0, 2], footF: [3, 0], footB: [-4, 0] },
  beamF: { armF: [2, -1, -90], armB: [1, -2, -100], body: [-3, 0], head: [-3, -1, -22.5], footF: [3, 0], footB: [-4, 0, 22.5] },
  beamR: { armF: [2, 0, -60], armB: [0, -1, -30], body: [-1, 1], head: [-1, 1], footF: [2, 0], footB: [-3, 0] },
  beamAA: { armF: [-3, 0, 45], armB: [-3, -1, 60], body: [-2, 0], head: [-2, 1, 11.25], footF: [2, -2], footB: [0, -1] },
  beamCA0: { armF: [3, 0, -56.25], armB: [3, -1, -67.5], body: [-1, 0], head: [0, 0, 11.25], footF: [1, -2], footB: [-1, -1] },
  beamCA1: { armF: [3, 0, -56.25], armB: [3, -1, -67.5], body: [-1, 1], head: [0, 1, 11.25], footF: [1, -2], footB: [-1, -1] },
  beamFA: { armF: [3, 0, -56.25], armB: [2, -1, -67.5], body: [-3, -1], head: [-3, -2, -22.5], footF: [1, -2], footB: [-1, -2] },
  beamRA: { armF: [2, 0, -45], armB: [0, -1, -30], body: [-1, 0], head: [-1, 0], footF: [1, -2], footB: [-1, -1] },
  // DARK NOX. Bare-clawed and feral: no scythe in his hands (it flies on its own), so every blow
  // is a claw, the body thrown after it, the bat wings on his back beating with each one (`wing`
  // picks their pose, see pixel-data.js). Almost no wind-up: a coil of a frame or two, the snap,
  // a savage impact pose leaning far into the rival, and he is already loaded for the next.
  // His guard: hunched right over, head low and forward, both claws out, wings half open, panting.
  dkIdle1: { head: [2, 1, 22.5], body: [1, 0], armF: [4, 0, -65], armB: [3, -1, -95], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  dkIdle2: { head: [2, 2, 22.5], body: [1, 1], armF: [4, 1, -55], armB: [3, 0, -85], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  // The run: a low lurching charge, head down, claws pumping, wings swept back.
  dkRun1: { head: [3, 2, 22.5], body: [1, 1], footF: [3, 0], footB: [-3, -1], armF: [4, 1, -40], armB: [1, 0, 30], wing: 'back', tailDeg: 8 },
  dkRunP: { head: [3, 1, 22.5], body: [1, 0], footF: [1, -1], footB: [0, -2], armF: [3, 0, -70], armB: [2, -1, -10], wing: 'back', tailDeg: 0 },
  dkRun2: { head: [3, 2, 22.5], body: [1, 1], footF: [-2, -1], footB: [3, 0], armF: [1, 1, 30], armB: [4, 0, -40], wing: 'back', tailDeg: -8 },
  dkRunP2: { head: [3, 1, 22.5], body: [1, 0], footF: [0, -2], footB: [1, -1], armF: [2, 0, -10], armB: [3, -1, -70], wing: 'back', tailDeg: 0 },
  // Rend: the near claw raked down through the rival.
  dRnA: { head: [0, 1, 11.25], body: [0, 0], armF: [-2, -2, 150], armB: [3, 0, -70], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  dRnX: { head: [5, -1, 11.25], body: [3, -1], armF: [4, -3, -125], armB: [-1, -1, 50], footF: [4, 0], footB: [-5, -1, 45], wing: 'back' },
  dRnI: { head: [6, 2, 33.75], body: [4, 1], armF: [6, 1, -45], armB: [-2, 0, 80], footF: [5, 0], footB: [-5, 0, 22.5], wing: 'back' },
  dRnF: { head: [4, 2, 22.5], body: [3, 1], armF: [5, 2, 10], armB: [-1, 0, 40], footF: [4, 0], footB: [-4, 0], wing: 'half' },
  dRnR: { head: [3, 2, 22.5], body: [2, 1], armF: [4, 1, -50], armB: [3, 0, -80], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  // Rake: the far claw backhanded up from the floor, chin up behind it.
  dRkA: { head: [3, 3, 22.5], body: [2, 2], armB: [1, 2, 30], armF: [4, 0, -60], footF: [4, 0], footB: [-3, 0], wing: 'half' },
  dRkX: { head: [3, 0, -11.25], body: [2, -1], armB: [4, -2, -110], armF: [0, -1, 60], footF: [3, 0], footB: [-3, -1, 22.5], front: 'armB', wing: 'half' },
  dRkI: { head: [3, -1, -22.5], body: [2, -2], armB: [5, -4, -155], armF: [-1, -1, 70], footF: [3, -1], footB: [-3, -1, 22.5], front: 'armB', wing: 'up' },
  dRkF: { head: [2, 0, -11.25], body: [1, -1], armB: [3, -4, 170], armF: [0, 0, 40], footF: [3, 0], footB: [-3, 0], front: 'armB', wing: 'open' },
  dRkR: { head: [3, 2, 11.25], body: [1, 1], armF: [4, 1, -60], armB: [3, 0, -90], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  // Frenzy: four claws, near, far, near rising, far crashing down, each arm cocking as the other
  // lands, stepping further in with every one, the wings beating.
  dFzA: { head: [2, 2, 22.5], body: [1, 1], armF: [0, -2, 150], armB: [3, 0, -60], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  dFz1X: { head: [4, 1, 22.5], body: [3, 0], armF: [4, -2, -130], armB: [1, -1, 60], footF: [4, 0], footB: [-4, -1, 22.5], wing: 'open' },
  dFz1I: { head: [5, 2, 22.5], body: [3, 1], armF: [6, 1, -40], armB: [0, -2, 140], footF: [4, 0], footB: [-4, 0], wing: 'back' },
  dFz2X: { head: [4, 1, 11.25], body: [3, 0], armB: [4, -2, -125], armF: [2, 0, 40], footF: [4, 0], footB: [-4, -1, 22.5], front: 'armB', wing: 'open' },
  dFz2I: { head: [5, 2, 33.75], body: [4, 1], armB: [6, 1, -40], armF: [0, 2, 60], footF: [4, 0], footB: [-4, 0], front: 'armB', wing: 'back' },
  dFz3X: { head: [4, 0, 0], body: [3, 0], armF: [5, 0, -80], armB: [0, -2, 150], footF: [4, 0], footB: [-4, -1, 22.5], wing: 'open' },
  dFz3I: { head: [4, -1, -22.5], body: [3, -1], armF: [5, -4, -155], armB: [-1, -3, 160], footF: [4, 0], footB: [-4, -1, 22.5], wing: 'up' },
  dFz4X: { head: [5, 0, 11.25], body: [4, 0], armB: [5, -3, -140], armF: [3, -1, -20], footF: [5, 0], footB: [-4, -1, 33.75], front: 'armB', wing: 'flare' },
  dFz4I: { head: [6, 3, 33.75], body: [4, 2], armB: [7, 2, -30], armF: [2, 1, 30], footF: [5, 0], footB: [-4, 0, 22.5], front: 'armB', wing: 'back' },
  dFzF: { head: [5, 3, 22.5], body: [4, 2], armB: [6, 3, 0], armF: [2, 1, 20], footF: [5, 0], footB: [-4, 0], front: 'armB', wing: 'half' },
  // Reap: sunk all the way down, then up through the rival behind the near claw, wings raised.
  dRpA: { head: [1, 4, 22.5], body: [0, 3], armF: [1, 2, 30], armB: [0, 2, -20], footF: [4, 0], footB: [-4, 0], wing: 'fold' },
  dRpA2: { head: [0, 5, 33.75], body: [-1, 3], armF: [0, 3, 45], armB: [1, 2, -30], footF: [4, 0], footB: [-4, 0], wing: 'fold' },
  dRpX: { head: [2, -3, -22.5], body: [1, -2], armF: [4, -5, -160], armB: [0, -1, 50], footF: [2, -1], footB: [-2, 0], wing: 'up' },
  dRpI: { head: [2, -4, -33.75], body: [1, -3], armF: [3, -7, 180], armB: [-1, -2, 60], footF: [1, -2], footB: [-1, -1, 22.5], wing: 'up' },
  dRpF: { head: [2, -2, -11.25], body: [1, -2], armF: [3, -6, -170], armB: [0, -1, 40], footF: [2, -1], footB: [-2, 0], wing: 'open' },
  dRpR: { head: [2, 2, 11.25], body: [1, 1], armF: [3, 0, -80], armB: [2, 0, -60], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  // Harvest: both claws dragged through the floor ahead, then ripped up and flung wide as the stakes
  // burst out of the ground, wings flared all the way, roaring.
  dHvA: { head: [3, 4, 33.75], body: [2, 3], armF: [4, 3, -20], armB: [3, 3, -10], footF: [4, 0], footB: [-4, 0], wing: 'fold' },
  dHvA2: { head: [3, 5, 33.75], body: [2, 3], armF: [5, 4, -10], armB: [4, 4, 0], footF: [4, 0], footB: [-4, 0], wing: 'half' },
  dHvX: { head: [2, -1, -11.25], body: [1, -1], armF: [5, -3, -125], armB: [4, -3, -140], footF: [4, 0], footB: [-4, -1, 22.5], wing: 'open' },
  dHvI: { head: [1, -2, -33.75], body: [0, -2], armF: [3, -3, -140], armB: [-4, -3, 140], footF: [4, 0], footB: [-4, 0], wing: 'flare' },
  dHvF: { head: [1, -1, -22.5], body: [0, -1], armF: [3, -2, -125], armB: [-4, -2, 125], footF: [4, 0], footB: [-4, 0], wing: 'flare' },
  dHvR: { head: [2, 2, 11.25], body: [1, 1], armF: [4, 0, -70], armB: [2, 0, -60], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  // In the air: twin claws, near then far.
  daA: { head: [-1, 0, -11.25], body: [-1, 0], armF: [-3, -2, 150], armB: [2, 0, -40], footF: [2, -2], footB: [0, -1], wing: 'up' },
  daX: { head: [3, -1, 11.25], body: [2, -1], armF: [4, -2, -120], armB: [-1, -1, 60], footF: [1, -2], footB: [-2, -2], wing: 'back' },
  daI: { head: [4, 0, 22.5], body: [2, 0], armF: [5, 1, -45], armB: [-2, -2, 140], footF: [1, -2], footB: [-3, -2, 22.5], wing: 'back' },
  daX2: { head: [3, -1, 11.25], body: [2, -1], armB: [4, -2, -120], armF: [-1, 0, 40], footF: [2, -2], footB: [-2, -2], front: 'armB', wing: 'open' },
  daI2: { head: [4, 0, 22.5], body: [2, 0], armB: [5, 1, -45], armF: [-2, -1, 70], footF: [2, -2], footB: [-3, -2, 22.5], front: 'armB', wing: 'back' },
  daR: { head: [1, 0], body: [0, 0], armF: [2, 0, -80], armB: [2, -1, -100], footF: [1, -2], footB: [-1, -1], wing: 'open' },
  // The vortex: curled, then spinning with both claws and the wings out.
  dVxA: { head: [0, 1, 11.25], body: [0, 1], armF: [1, 0, 30], armB: [0, 0, -30], footF: [1, -2], footB: [-1, -2], wing: 'fold' },
  dVx: { head: [0, -1], armF: [4, -1, -90], armB: [-4, -1, 90], footF: [1, -2], footB: [-1, -1], wing: 'open' },
  // The dive: gathered up under raised wings, then head first, claws first, onto them.
  dDvA: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-1, -4, 165], armB: [-2, -4, 155], footF: [1, -2], footB: [0, -2], wing: 'up' },
  dDvA2: { head: [-2, -2, -22.5], body: [-1, -2], armF: [-2, -5, 170], armB: [-3, -4, 160], footF: [1, -2], footB: [-1, -2], wing: 'flare' },
  dDvX: { head: [3, 3, 56.25], body: [2, 1], armF: [4, 3, -25], armB: [3, 3, -15], footF: [-2, -3, 56.25], footB: [-4, -2, 67.5], wing: 'up' },
  dDvI: { head: [3, 3, 33.75], body: [2, 2], armF: [5, 4, -10], armB: [4, 4, 0], footF: [0, -2, 30], footB: [-2, -2, 45], front: 'armF', wing: 'up' },
  dDvF: { head: [3, 3, 22.5], body: [2, 2], armF: [5, 4, -20], armB: [4, 3, -10], footF: [0, -2, 22.5], footB: [-2, -2, 33.75], wing: 'open' },
  // The kiss: rearing up with the wings flung open, the lunge, the bite, wings closing round the
  // prey while he gulps, then the head thrown back off them.
  dKsA: { head: [-1, -1, -22.5], body: [-1, -1], armF: [1, -3, -150], armB: [-3, -3, 150], footF: [2, 0], footB: [-2, 0], wing: 'flare' },
  dKsX: { head: [5, 0, 22.5], body: [3, 0], armF: [5, -1, -100], armB: [4, -2, -115], footF: [4, 0], footB: [-4, -1, 33.75], wing: 'back' },
  dKsI: { head: [5, 1, 33.75], body: [3, 0], armF: [5, 0, -75], armB: [4, -1, -85], footF: [4, 0], footB: [-4, 0, 22.5], wing: 'wrap' },
  dKsD: { head: [5, 2, 33.75], body: [3, 1], armF: [4, 1, -60], armB: [4, 0, -70], footF: [3, 0], footB: [-3, 0], wing: 'wrap' },
  dKsD2: { head: [5, 3, 45], body: [3, 1], armF: [4, 1, -55], armB: [4, 1, -65], footF: [3, 0], footB: [-3, 0], wing: 'wrap' },
  dKsI2: { head: [0, -2, -33.75], body: [0, -1], armF: [3, -3, -140], armB: [-3, -3, 140], footF: [3, 0], footB: [-3, 0], wing: 'flare' },
  dKsR: { head: [2, 2, 11.25], body: [1, 1], armF: [4, 0, -70], armB: [3, 0, -90], footF: [3, 0], footB: [-3, 0], wing: 'half' },
  // The execution: reared up over the downed rival, the claw raised, then down onto them, pinned.
  dExA: { head: [0, -1, -11.25], body: [0, -1], armF: [1, -4, 170], armB: [2, -1, -60], footF: [3, 0], footB: [-3, 0], wing: 'up' },
  dExA2: { head: [-1, -2, -22.5], body: [-1, -2], armF: [0, -5, 165], armB: [2, -2, -70], footF: [3, -1], footB: [-2, 0], wing: 'flare' },
  dExX: { head: [3, 2, 33.75], body: [2, 1], armF: [5, 0, -60], armB: [1, 0, 40], footF: [4, 0], footB: [-4, -1, 22.5], wing: 'back' },
  dExI: { head: [3, 5, 45], body: [2, 3], armF: [5, 4, -10], armB: [0, 2, 60], footF: [4, 0], footB: [-4, 0], wing: 'open' },
  dExF: { head: [3, 4, 33.75], body: [2, 3], armF: [5, 4, -15], armB: [0, 2, 50], footF: [4, 0], footB: [-4, 0], wing: 'half' },
  // The phantom: coiled to burst into bats, then out of them past the rival, the claw out.
  dPhA: { head: [-1, 3, 11.25], body: [-1, 2], armF: [-2, 1, 80], armB: [-2, 0, 90], footF: [3, 0], footB: [-3, 0], wing: 'fold' },
  dPhX: { head: [3, 1, 22.5], body: [2, 1], armF: [5, 0, -90], armB: [-3, -1, 80], footF: [-2, 0, 30], footB: [-3, -1, 50], wing: 'back' },
  dPhI: { head: [4, 3, 22.5], body: [3, 2], armF: [6, 2, -60], armB: [-3, 0, 90], footF: [5, 0], footB: [-4, 0, 22.5], wing: 'open' },
  dPhF: { head: [4, 3, 11.25], body: [3, 2], armF: [5, 3, -20], armB: [-2, 0, 70], footF: [5, 0], footB: [-4, 0], wing: 'half' },
  // Turning dark: the pop, arms and wings flung open, roaring (two poses a pixel apart, alternated).
  dPop: { head: [1, -2, -33.75], body: [0, -1], armF: [3, -2, -135], armB: [-4, -2, 135], footF: [4, 0], footB: [-4, 0], wing: 'flare' },
  dPop2: { head: [1, -3, -33.75], body: [0, -2], armF: [3, -3, -140], armB: [-4, -3, 140], footF: [4, 0], footB: [-4, 0], wing: 'flare' },
  // Turning back: the wings folding away, the far hand up to catch the scythe flying home.
  dCatch: { head: [1, 1, -11.25], body: [0, 1], armF: [2, 0, -100], armB: [-1, -2, 160], footF: [3, 0], footB: [-3, 0], wing: 'fold' },
  // Mingau, the Cat King (O REI GATO). He never strikes: his court fights for him, and every move of
  // his is an order given with the scepter in his near paw (render/king-art.js draws it along that arm
  // whenever the arm is raised past 70 degrees, so these poses aim it; an arm raised behind him is
  // written past -180 degrees so that angle, 180 + the arm's, swings over his head and not under his
  // feet). Upright and chin up, the other paw tucked behind his back or on his hip, feet planted apart.
  // His guard: chest out, a slow breath.
  kgIdle1: { head: [0, -1, -11.25], body: [0, -1], armF: [1, -1, -45], armB: [-3, -1, 33.75], footF: [1, 0], footB: [-1, 0] },
  kgIdle2: { head: [0, 0, -11.25], body: [0, 0], armF: [1, 0, -45], armB: [-3, 0, 33.75], footF: [1, 0], footB: [-1, 0] },
  // A stately walk: one measured step at a time, rising on the pass.
  kgWalk1: { head: [0, 0, -11.25], body: [0, 0], armF: [1, 0, -40], armB: [-3, 0, 33.75], footF: [2, 0], footB: [-2, 0], tailDeg: 4 },
  kgWalkP: { head: [0, -1, -11.25], body: [0, -1], armF: [1, -1, -40], armB: [-3, -1, 33.75], footF: [0, -1], footB: [0, 0], tailDeg: 0 },
  kgWalk2: { head: [0, 0, -11.25], body: [0, 0], armF: [1, 0, -40], armB: [-3, 0, 33.75], footF: [-2, 0], footB: [2, 0], tailDeg: -4 },
  kgWalkP2: { head: [0, -1, -11.25], body: [0, -1], armF: [1, -1, -40], armB: [-3, -1, 33.75], footF: [0, 0], footB: [0, -1], tailDeg: 0 },
  // The run: brisk but never hurried, a long stride, upright, the scepter carried ahead of him.
  kgRun1: { head: [1, 0, -11.25], body: [1, 0], armF: [2, 0, -56.25], armB: [-2, 0, 45], footF: [3, 0], footB: [-3, -1], tailDeg: 8 },
  kgRunP: { head: [1, -1, -11.25], body: [1, -1], armF: [2, -1, -56.25], armB: [-2, -1, 45], footF: [1, -1], footB: [-1, -2], tailDeg: 0 },
  kgRun2: { head: [1, 0, -11.25], body: [1, 0], armF: [2, 0, -56.25], armB: [-2, 0, 45], footF: [-3, -1], footB: [3, 0], tailDeg: -8 },
  kgRunP2: { head: [1, -1, -11.25], body: [1, -1], armF: [2, -1, -56.25], armB: [-2, -1, 45], footF: [-1, -2], footB: [1, -1], tailDeg: 0 },
  // The proud jump: knees tucked, chin high, the scepter raised; coming down, it leads the way.
  kgJump: { head: [0, -1, -22.5], body: [0, -1], armF: [2, -4, -157.5], armB: [-3, -1, 45], footF: [1, -2], footB: [-1, -1], tailDeg: -12 },
  kgFall: { head: [0, 0, -11.25], body: [0, 0], armF: [2, -1, -112.5], armB: [-3, -1, 56.25], footF: [1, 0], footB: [-1, -1], tailDeg: 14 },
  kgLand: { head: [0, 1, -11.25], body: [0, 1], armF: [1, 1, -45], armB: [-3, 1, 33.75], footF: [2, 0], footB: [-2, 0] },
  // Up after a launched rival: the scepter thrust up ahead of him.
  kgLeap: { head: [1, -1, -11.25], body: [1, -1], armF: [3, -2, -135], armB: [-3, -1, 67.5], footF: [-1, 0, 22.5], footB: [-2, -1, 33.75], tailDeg: 20 },
  // The point (the soldier's cut, the assassin's stab and dash, the air cut): the scepter raised, then
  // snapped down level at the rival, the body following it in, the free paw flung back.
  kgPtA: { head: [-1, -1, -11.25], body: [-1, -1], armF: [0, -5, -180], armB: [-3, -1, 33.75], footF: [2, 0], footB: [-2, 0] },
  kgPtX: { head: [1, 0], body: [1, 0], armF: [2, -1, -112.5], armB: [-3, 0, 45], footF: [3, 0], footB: [-2, 0] },
  kgPtI: { head: [1, 0, -11.25], body: [1, 0], armF: [3, -1, -90], armB: [-4, 0, 56.25], footF: [3, 0], footB: [-3, 0] },
  kgPtR: { head: [1, 0, -11.25], body: [0, 0], armF: [2, -1, -90], armB: [-3, 0, 45], footF: [2, 0], footB: [-2, 0] },
  // The stab: the same point thrust lower and further, a lunge.
  kgStI: { head: [2, 1], body: [2, 0], armF: [4, 0, -78.75], armB: [-3, 0, 56.25], footF: [4, 0], footB: [-3, 0] },
  // The shadow dash: a sly low flick.
  kgShA: { head: [-1, 1, 11.25], body: [-1, 1], armF: [-1, -1, -146.25], armB: [-3, 1, 33.75], footF: [2, 0], footB: [-2, 0] },
  kgShI: { head: [1, 2, 11.25], body: [1, 1], armF: [3, 0, -78.75], armB: [-4, 1, 56.25], footF: [3, 0], footB: [-3, 0] },
  // The sweep (the archer's volley): gathered in over his chest, then both arms swept open wide, the
  // scepter flung out and up ahead of him: "loose!".
  kgSwA: { head: [0, 1, 11.25], body: [0, 1], armF: [0, 0, -22.5], armB: [2, 0, -56.25], footF: [2, 0], footB: [-2, 0] },
  kgSwX: { head: [0, 0, -11.25], body: [0, 0], armF: [2, -2, -135], armB: [-2, -1, 90], footF: [2, 0], footB: [-2, 0] },
  kgSwI: { head: [1, -1, -11.25], body: [1, -1], armF: [3, -2, -112.5], armB: [-4, -2, 123.75], footF: [3, 0], footB: [-3, 0] },
  kgSwR: { head: [1, 0, -11.25], body: [1, 0], armF: [3, -1, -101.25], armB: [-3, -1, 90], footF: [3, 0], footB: [-3, 0] },
  // At the sky (the mage's lightning, the meteor): gathered low, then up on his toes, chin up.
  kgSkA: { head: [0, 1], body: [0, 1], armF: [1, 0, -78.75], armB: [-3, 1, 33.75], footF: [2, 0], footB: [-2, 0] },
  kgSkI: { head: [0, -1, -22.5], body: [0, -1], armF: [3, -5, -146.25], armB: [-3, -1, 45], footF: [2, 0], footB: [-2, 0] },
  kgSkyI: { head: [0, -1, -22.5], body: [0, -1], armF: [3, -6, -180], armB: [-3, -1, 45], footF: [1, -2], footB: [-1, -1] },
  // The palm (the shield's bash): both paws pulled in to the chest (the scepter drawn back upright), then
  // thrust out flat, planted wide.
  kgPaA: { head: [-1, 0], body: [-1, 0], armF: [-2, 0, -33.75], armB: [-1, 0, -45], footF: [3, 0], footB: [-2, 0] },
  kgPaI: { head: [2, 0, -11.25], body: [2, 0], armF: [4, -1, -90], armB: [4, 1, -90], footF: [4, 0], footB: [-3, 0], front: 'armB' },
  kgPaR: { head: [1, 0, -11.25], body: [1, 0], armF: [3, -1, -90], armB: [1, 0, -45], footF: [3, 0], footB: [-3, 0] },
  // "À CARGA!": the scepter cocked behind his head, swept over and out ahead, a lunging stride, a shout.
  kgChA: { head: [-1, 0, -11.25], body: [-1, 0], armF: [1, -6, -202.5], armB: [0, 0, -33.75], footF: [2, 0], footB: [-3, 0] },
  kgChX: { head: [1, -1, -11.25], body: [1, -1], armF: [3, -5, -168.75], armB: [-2, -1, 45], footF: [3, 0], footB: [-3, 0] },
  kgChI: { head: [2, 0, -11.25], body: [2, 0], armF: [4, -2, -123.75], armB: [-4, -1, 78.75], footF: [4, 0], footB: [-4, 0] },
  // Straight up (the rain of arrows): sunk, then stretched up on his toes, the scepter waved at the sky.
  kgUpA: { head: [0, 2], body: [0, 1], armF: [1, 1, -22.5], armB: [-3, 1, 33.75], footF: [2, 0], footB: [-2, 0] },
  kgUpI: { head: [0, -1, -22.5], body: [0, -1], armF: [3, -6, -180], armB: [-3, -1, 45], footF: [2, 0], footB: [-2, 0] },
  kgUpI2: { head: [0, -1, -22.5], body: [0, -1], armF: [3, -6, -168.75], armB: [-3, -1, 45], footF: [2, 0], footB: [-2, 0] },
  // Down at the fallen (the mercy): raised, then brought down, looking down his nose at them.
  kgDnA: { head: [0, -1, -11.25], body: [0, -1], armF: [1, -5, -168.75], armB: [-3, -1, 33.75], footF: [2, 0], footB: [-2, 0] },
  kgDnI: { head: [1, 2, 22.5], body: [1, 1], armF: [3, 0, -33.75], armB: [-3, 1, 45], footF: [3, 0], footB: [-2, 0] },
  // The rising gesture (the soldier's launcher): low, then the scepter swept up to the sky.
  kgRsA: { head: [0, 2, 11.25], body: [0, 1], armF: [2, 1, -33.75], armB: [-3, 1, 33.75], footF: [3, 0], footB: [-3, 0] },
  kgRsX: { head: [0, -1, -11.25], body: [0, -1], armF: [2, -2, -135], armB: [-3, -1, 45], footF: [2, 0], footB: [-2, 0] },
  kgRsI: { head: [0, -1, -22.5], body: [0, -1], armF: [3, -6, -168.75], armB: [-3, -1, 56.25], footF: [1, 0], footB: [-1, 0] },
  // In the air: the cut and the shot pointed ahead and down, the meteor called from the sky, the
  // shield dropped on them with the scepter pointed straight down.
  kgAA: { head: [0, -1, -11.25], body: [0, -1], armF: [1, -5, -168.75], armB: [-3, -1, 45], footF: [1, -2], footB: [-1, -1] },
  kgAPt: { head: [1, 0, -11.25], body: [1, 0], armF: [3, -1, -90], armB: [-4, -1, 56.25], footF: [1, -2], footB: [-2, -1] },
  kgAShot: { head: [1, 1, 11.25], body: [1, 0], armF: [3, 0, -56.25], armB: [-3, -1, 56.25], footF: [1, -2], footB: [-2, -1] },
  kgADrop: { head: [0, 1, 22.5], body: [0, 0], armF: [1, 1, -11.25], armB: [-3, 0, 33.75], footF: [1, -2], footB: [-1, -2] },
  // The scepter thrust high and held there, the other paw on his hip, chest out, chin up (two
  // breaths), lowered: VOLTA AO REINO and the end of BANDEIRA REAL.
  kgDecA: { head: [0, 2], body: [0, 1], armF: [1, 0, -146.25], armB: [-3, 1, 33.75], footF: [2, 0], footB: [-2, 0] },
  kgDec1: { head: [0, -1, -22.5], body: [1, -1], armF: [3, -6, -180], armB: [-5, 1, 90], footF: [2, 0], footB: [-2, 0] },
  kgDec2: { head: [0, 0, -22.5], body: [1, 0], armF: [3, -5, -180], armB: [-5, 2, 90], footF: [2, 0], footB: [-2, 0] },
  kgDecL: { head: [0, 0, -11.25], body: [0, 0], armF: [2, -1, -123.75], armB: [-3, 0, 45], footF: [2, 0], footB: [-2, 0] },
  // BANDEIRA REAL: the royal banner in his free paw (king-art.js draws it there): a squash with it
  // gathered low at his side, then raised high over his head on his toes, then driven down into the
  // floor before him with all his weight (it stands on its own from there), and the proud hold.
  kgPlA: { head: [0, 2, 11.25], body: [0, 1], armF: [1, 1, -45], armB: [-1, 1, 22.5], footF: [2, 0], footB: [-2, 0] },
  kgPlR: { head: [0, -1, -22.5], body: [0, -1], armF: [2, -1, -67.5], armB: [0, -4, -191.25], footF: [1, -1], footB: [-1, 0] },
  kgPlD: { head: [1, 2, 22.5], body: [1, 1], armF: [2, 0, -33.75], armB: [3, 1, -56.25], footF: [3, 0], footB: [-3, 0] },
  // VOLTA AO REINO's arrival: landed, knees bent, the scepter still up.
  kgRcL: { head: [0, 2], body: [0, 2], armF: [2, 0, -157.5], armB: [-3, 1, 56.25], footF: [3, 0], footB: [-3, 0] },
  // Mingau
  scratchA0: { armF: [-1, -1, 150], body: [-1, 0], head: [-1, 0] },
  scratchA1: { armF: [2, 0, -70], body: [1, 0], head: [1, 0], footF: [1, 0] },
  scratchA2: { armF: [2, 1, -20], body: [1, 0], head: [1, 0] },
  scratchB0: { armB: [0, -1, 150], body: [-1, 0], head: [-1, 0] },
  scratchB1: { armB: [3, 0, -80], body: [1, 0], head: [1, 0], footF: [1, 0], front: 'armB' },
  scratchB2: { armB: [3, 1, -25], body: [1, 0], head: [1, 0], front: 'armB' },
  upper0: { ...crouch, armF: [0, 2, 30] },
  upper1: { armF: [1, -3, -170], body: [0, -1], head: [1, -2], footF: [1, -1], footB: [0, -1] },
  upper2: { armF: [1, -3, -150], body: [0, -1], head: [1, -1] },
  pounce: { armF: [2, 0, -90], armB: [2, -1, -100], footF: [-3, -1, 40], footB: [-4, -1, 40], head: [2, 0], body: [1, 0], tailDeg: 20 },
  ride1: { armF: [1, 1, -40], armB: [1, 1, -50], footF: [0, -2], footB: [0, -2], head: [0, 1], tailDeg: 15 },
  ride2: { armF: [1, 1, -110], armB: [1, 0, -20], footF: [0, -2], footB: [0, -2], head: [0, 1], tailDeg: 5 },
  kickoff: { footF: [3, -2, -90], footB: [2, -2, -90], armF: [-1, -1, 120], armB: [-1, -1, 120], head: [-1, 0] },
  // Marola: the tail is the weapon
  whip0: { body: [-1, 0], head: [-1, 0], armF: [0, 0, 20], tail: [[1, 0], [-1, -3], [-2, -7], [0, -11], [3, -13]] },
  whip1: { armF: [1, 0, -40], head: [1, 0], tail: [[1, 0], [2, -4], [6, -7], [11, -8], [16, -7], [19, -5]] },
  whip2: { armF: [1, 0, -20], head: [1, 0], tail: [[1, 0], [3, -2], [8, -3], [13, -3], [17, -2]] },
  sweep0: { ...crouch, tail: [[1, 0], [-3, 1], [-7, 1], [-10, 0]] },
  sweep1: { ...crouch, armF: [1, 2, -50], tail: [[1, 1], [4, 4], [9, 5], [14, 5], [19, 4], [22, 3]] },
  // Lola, the maid of the clock. Knives in both hands (drawn by render/lola-art.js along the arms).
  // Her guard: low and light on her feet, the front hand up with a fan of knives between the
  // fingers, the back hand low with one more. Two breaths.
  lStance1: { head: [1, 1, 11.25], body: [0, 1], armF: [4, 1, -105], armB: [-1, 0, 35], footF: [3, 0], footB: [-3, 0] },
  lStance2: { head: [1, 2, 11.25], body: [0, 2], armF: [4, 2, -105], armB: [-1, 1, 35], footF: [3, 0], footB: [-3, 0] },
  // The cuts: the knife cocked back over the shoulder (A), the snap (X), the impact pose (I).
  lCaA: { head: [-1, 1], body: [-1, 1], armF: [-2, -2, 150], armB: [1, 0, -40], footF: [3, 0], footB: [-2, 0] },
  lCaX: { head: [2, 0, 11.25], body: [2, 0], armF: [3, -1, -95], armB: [-1, 0, 40], footF: [3, 0], footB: [-3, -1, 22.5] },
  lCaI: { head: [3, 1, 11.25], body: [2, 1], armF: [4, 2, -35], armB: [-2, 0, 55], footF: [4, 0], footB: [-3, 0] },
  lCbA: { head: [-1, 1], body: [-1, 1], armB: [-1, -2, 145], armF: [2, 0, 25], footF: [3, 0], footB: [-2, 0] },
  lCbX: { head: [2, 0, 11.25], body: [2, 0], armB: [4, -1, -100], armF: [-1, 0, 40], footF: [3, 0], footB: [-3, -1, 22.5], front: 'armB' },
  lCbI: { head: [3, 1, 11.25], body: [2, 1], armB: [5, 2, -35], armF: [-1, 0, 55], footF: [4, 0], footB: [-3, 0], front: 'armB' },
  // The dance of knives: four crossing slashes cycled faster than the eye.
  lDnA: { head: [2, 1, 11.25], body: [1, 1], armF: [4, -1, -110], armB: [2, 1, -30], footF: [3, 0], footB: [-3, 0] },
  lDnB: { head: [3, 1, 22.5], body: [2, 1], armB: [5, 0, -70], armF: [0, -1, -160], footF: [3, 0], footB: [-3, 0], front: 'armB' },
  lDnC: { head: [2, 0], body: [1, 0], armF: [4, 1, -50], armB: [1, -1, -150], footF: [3, 0], footB: [-3, 0] },
  lDnD: { head: [3, 2, 22.5], body: [2, 1], armB: [5, -1, -120], armF: [1, 1, -10], footF: [3, 0], footB: [-3, 0], front: 'armB' },
  // Behind you: coiled to vanish, then out of nowhere at their back with both knives driving in.
  lBhA: { head: [-1, 3, 11.25], body: [-1, 2], armF: [-2, 0, 120], armB: [-3, 0, 110], footF: [3, 0], footB: [-3, 0] },
  lBhX: { head: [3, 1, 22.5], body: [3, 1], armF: [5, 0, -90], armB: [4, -1, -95], footF: [5, 0], footB: [-4, -1, 33.75] },
  lBhI: { head: [4, 2, 22.5], body: [3, 1], armF: [6, 1, -80], armB: [5, 0, -85], footF: [5, 0], footB: [-4, 0, 22.5] },
  lBhF: { head: [2, 1, 11.25], body: [2, 1], armF: [3, 1, -40], armB: [2, 0, -60], footF: [4, 0], footB: [-3, 0] },
  // The rising spiral: sunk all the way down, then up through the rival behind both knives.
  lRsA: { head: [0, 4, 11.25], body: [0, 3], armF: [1, 2, 40], armB: [0, 2, 20], footF: [3, 0], footB: [-3, 0] },
  lRsX: { head: [2, -3, -22.5], body: [1, -2], armF: [3, -5, -170], armB: [1, -3, -150], footF: [1, -2], footB: [-1, -1, 22.5] },
  lRsI: { head: [2, -2, -11.25], body: [1, -2], armF: [2, -5, 180], armB: [-1, -3, 160], footF: [0, -2], footB: [-1, -2] },
  // Down low through the ankles.
  lLoA: { head: [-1, 4], body: [-1, 2], armF: [-1, 2, 120], armB: [0, 2, 0], footF: [3, 0], footB: [-3, 0] },
  lLoX: { head: [3, 4, 11.25], body: [2, 2], armF: [4, 4, -70], armB: [1, 3, -50], footF: [4, 0], footB: [-4, 0, 22.5] },
  lLoI: { head: [3, 4, 22.5], body: [2, 2], armF: [5, 4, -40], armB: [2, 3, -20], footF: [4, 0], footB: [-4, 0] },
  // About to skip: a light step, both knives drawn in.
  lSkA: { head: [-1, 1], body: [-1, 1], armF: [-1, 0, 60], armB: [-1, 0, 50], footF: [2, 0], footB: [-2, 0] },
  // Over their head: gathered up, then upside down onto them, both knives first.
  lDvA: { head: [0, -1], body: [0, -1], armF: [0, -3, 170], armB: [-1, -3, 160], footF: [1, -2], footB: [-1, -1] },
  lDvX: { head: [2, 2, 33.75], body: [1, 1], armF: [2, 3, -10], armB: [1, 3, 5], footF: [-1, -2, 22.5], footB: [-2, -2, 33.75], front: 'armF' },
  lDash: { head: [2, 0], body: [1, 0], armF: [4, -1, -90], armB: [-2, -1, 70], footF: [-2, 0, 30], footB: [-3, -1, 40] },
  // Laying knives in the air. The wall: both fans cocked back over the shoulders, then flung open
  // ahead of her (one hand high, one low, like a fan opening) and held there.
  lFanA: { head: [-1, 1, -11.25], body: [-1, 1], armF: [-1, -1, 140], armB: [-2, -1, 125], footF: [3, 0], footB: [-3, 0] },
  lFanX: { head: [2, 0, 11.25], body: [2, 0], armF: [4, -2, -125], armB: [3, 0, -60], footF: [4, 0], footB: [-4, -1, 22.5] },
  lFanI: { head: [2, 1, 11.25], body: [1, 1], armF: [4, -1, -112], armB: [2, 1, -72], footF: [4, 0], footB: [-3, 0] },
  // The rain: up on her toes, both arms flung high and wide as the knives go up, chin up to watch
  // them stop; then the arms held up there.
  lRainX: { head: [1, -2, -22.5], body: [0, -1], armF: [3, -4, -160], armB: [-2, -4, 160], footF: [1, -1], footB: [-2, -1] },
  lRainI: { head: [1, -1, -22.5], body: [0, -1], armF: [3, -3, -148], armB: [-2, -3, 148], footF: [2, 0], footB: [-2, 0] },
  // ZA WARUDO. The pocket watch held up to her face and clicked; then arms flung open, chin up.
  wWatch: { head: [0, 0, -11.25], body: [0, 0], armF: [1, -3, -165], armB: [-1, 0, 30], footF: [2, 0], footB: [-2, 0] },
  wPose: { head: [0, -1, -22.5], body: [0, -1], armF: [4, -3, -130], armB: [-4, -3, 130], footF: [3, 0], footB: [-3, 0] },
  wPose2: { head: [0, -2, -22.5], body: [0, -1], armF: [4, -4, -135], armB: [-4, -4, 135], footF: [3, 0], footB: [-3, 0] },
  // In the stopped world: stepping out of nowhere in mid-air with fans of knives ready, the throws
  // from either hand, running circles round a rival, and back home with the knives lowered.
  lAppear: { head: [1, 1, 11.25], body: [0, 1], armF: [1, -1, -150], armB: [0, -1, 150], footF: [1, -2], footB: [-1, -1] },
  lThrowF: { head: [2, 0, 11.25], body: [1, 0], armF: [4, -1, -95], armB: [-2, -1, 80], footF: [1, -2], footB: [-2, -1, 22.5] },
  lThrowB: { head: [2, 0, 11.25], body: [1, 0], armB: [4, -1, -95], armF: [-2, -1, 80], footF: [1, -2], footB: [-2, -1, 22.5], front: 'armB' },
  lRingDash: { head: [2, 1, 22.5], body: [1, 0], armF: [4, 0, -80], armB: [-3, -1, 60], footF: [-2, -1, 40], footB: [-3, -1, 50] },
  wHome: { head: [0, 1, 11.25], body: [0, 1], armF: [1, 1, -20], armB: [-1, 1, 20], footF: [2, 0], footB: [-2, 0] },
  wSnap: { head: [-1, 0, -11.25], body: [0, 0], armF: [1, -2, -150], armB: [-1, 0, 20], footF: [2, 0], footB: [-2, 0] },
  // Her hero pose on the select screen: knives fanned in both hands, crossed in front of her.
  lHero: { head: [1, 0, 11.25], body: [0, 0], armF: [5, 1, -100], armB: [-3, -1, 140], footF: [3, 0], footB: [-3, 0] },
  lHero2: { head: [1, 1, 11.25], body: [0, 1], armF: [5, 2, -100], armB: [-3, 0, 140], footF: [3, 0], footB: [-3, 0] },
  // Juma
  paw0: { armF: [-1, -2, 160], body: [-1, 0], head: [-1, 0] },
  paw1: { armF: [3, 0, -80], body: [1, 0], head: [2, 0], footF: [1, 0] },
  paw2: { armF: [3, 2, -30], body: [1, 0], head: [1, 1] },
  pawB0: { armB: [0, -2, 160], body: [-1, 0], head: [-1, 0] },
  pawB1: { armB: [4, 0, -85], body: [1, 0], head: [2, 0], footF: [1, 0], front: 'armB' },
  pawB2: { armB: [4, 2, -30], body: [1, 0], head: [1, 1], front: 'armB' },
  smash0: { armF: [0, -3, 180], armB: [0, -3, 180], head: [0, -1], body: [0, -1], footF: [0, -1] },
  smash1: { armF: [3, 1, -40], armB: [3, 1, -50], head: [2, 1], body: [1, 0], front: 'armF' },
  bite: { head: [3, 0, 10], body: [1, 0], armF: [1, 0, -60], armB: [1, 0, -60], footB: [-2, 0], tailDeg: 15 },
  shake1: { head: [3, -1, -15], body: [1, 0], armF: [1, 0, -40], tailDeg: -10 },
  shake2: { head: [2, 1, 15], armF: [1, 1, -70], tailDeg: 15 },
  toss: { head: [1, -2, -30], armF: [0, -1, -150], body: [0, -1], tailDeg: -15 },
  // Juma, small. A low predator's crouch, tail up, claws out; every move keyed in time (KEYS):
  // the wind-up (A), the snap (X), the impact pose (I), follow-through and recovery.
  jStance1: { head: [1, 2, 11.25], body: [0, 1], armF: [2, 0, -70], armB: [1, -1, -50], footF: [3, 0], footB: [-3, 0], tailDeg: -12 },
  jStance2: { head: [1, 3, 11.25], body: [0, 2], armF: [2, 1, -70], armB: [1, 0, -50], footF: [3, 0], footB: [-3, 0], tailDeg: -6 },
  jSwA: { head: [-1, 1], body: [-1, 1], armF: [-2, -1, 135], armB: [1, 0, -60], footF: [3, 0], footB: [-2, 0], tailDeg: -15 },
  jSwX: { head: [2, 0, 11.25], body: [2, 0], armF: [3, -1, -100], armB: [-1, 0, 40], footF: [3, 0], footB: [-3, -1, 22.5], tailDeg: 10 },
  jSwI: { head: [3, 1, 11.25], body: [2, 1], armF: [4, 2, -30], armB: [-1, 0, 50], footF: [4, 0], footB: [-3, 0], tailDeg: 16 },
  jSwR: { head: [1, 1], body: [1, 1], armF: [2, 1, -50], armB: [0, 0, -40], footF: [3, 0], footB: [-2, 0] },
  jSwA2: { head: [-1, 1], body: [-1, 1], armB: [-1, -1, 140], armF: [2, 0, 30], footF: [3, 0], footB: [-2, 0], tailDeg: -15 },
  jSwX2: { head: [2, 0, 11.25], body: [2, 0], armB: [4, -1, -100], armF: [-1, 0, 40], footF: [3, 0], footB: [-3, -1, 22.5], front: 'armB', tailDeg: 10 },
  jSwI2: { head: [3, 1, 11.25], body: [2, 1], armB: [5, 2, -30], armF: [-1, 0, 50], footF: [4, 0], footB: [-3, 0], front: 'armB', tailDeg: 16 },
  // The storm of claws: four slashing poses cycled faster than the eye.
  jFlA: { head: [2, 1, 11.25], body: [1, 1], armF: [4, -1, -110], armB: [1, 0, -20], footF: [3, 0], footB: [-3, 0], tailDeg: 18 },
  jFlB: { head: [3, 1, 22.5], body: [2, 1], armB: [5, 1, -60], armF: [0, 0, -150], footF: [3, 0], footB: [-3, 0], front: 'armB', tailDeg: 8 },
  jFlC: { head: [2, 0], body: [1, 0], armF: [4, 1, -45], armB: [1, -1, -140], footF: [3, 0], footB: [-3, 0], tailDeg: 22 },
  jFlD: { head: [3, 2, 22.5], body: [2, 1], armB: [5, -1, -120], armF: [1, 1, -10], footF: [3, 0], footB: [-3, 0], front: 'armB', tailDeg: 4 },
  // The rake: sinks back, then lunges flat out with both claws dragging down through.
  jRkA: { head: [-2, 3, 11.25], body: [-2, 2], armF: [-2, -1, 160], armB: [-3, -1, 150], footF: [3, 0], footB: [-2, 0], tailDeg: -20 },
  jRkX: { head: [4, 1, 22.5], body: [3, 1], armF: [5, -2, -130], armB: [4, -2, -140], footF: [5, 0], footB: [-4, -1, 33.75], tailDeg: 24 },
  jRkI: { head: [5, 2, 33.75], body: [4, 2], armF: [6, 3, -20], armB: [5, 3, -10], footF: [5, 0], footB: [-4, 0, 22.5], tailDeg: 26 },
  jRkF: { head: [4, 2, 22.5], body: [3, 2], armF: [5, 3, 10], armB: [4, 3, 20], footF: [4, 0], footB: [-4, 0], tailDeg: 14 },
  // The rising pounce: coiled tight, then up through the rival behind the claw.
  jPuA: { head: [0, 4, 11.25], body: [0, 3], armF: [1, 2, 40], armB: [0, 2, 30], footF: [3, 0], footB: [-3, 0], tailDeg: -24 },
  jPuX: { head: [2, -3, -22.5], body: [1, -2], armF: [3, -5, -170], armB: [1, -3, -150], footF: [1, -2], footB: [-1, -1, 22.5], tailDeg: 20 },
  jPuI: { head: [2, -2, -11.25], body: [1, -2], armF: [2, -5, 180], armB: [0, -3, -160], footF: [0, -2], footB: [-1, -2], tailDeg: 26 },
  jLoA: { head: [-1, 4], body: [-1, 2], armF: [-1, 2, 120], armB: [0, 2, 0], footF: [3, 0], footB: [-3, 0], tailDeg: -10 },
  jLoX: { head: [3, 4, 11.25], body: [2, 2], armF: [4, 4, -70], armB: [0, 2, 40], footF: [4, 0], footB: [-4, 0, 22.5], tailDeg: 16 },
  jLoI: { head: [3, 4, 22.5], body: [2, 2], armF: [5, 4, -40], armB: [0, 2, 50], footF: [4, 0], footB: [-4, 0], tailDeg: 20 },
  // The lightning pounce: stretched out flat, claws first, the legs trailing.
  jBoA: { head: [-1, 3], body: [-1, 2], armF: [-1, 1, 60], armB: [-2, 1, 70], footF: [2, 0], footB: [-3, 0], tailDeg: -18 },
  jBoX: { head: [3, 1, 22.5], body: [2, 1], armF: [5, 0, -90], armB: [4, -1, -100], footF: [-2, -1, 60], footB: [-4, -1, 70], tailDeg: 28 },
  jBoI: { head: [3, 2, 11.25], body: [2, 1], armF: [5, 1, -50], armB: [3, 0, -130], footF: [3, 0], footB: [-4, 0], tailDeg: 18 },
  jSpin: { armF: [3, -1, -90], armB: [-3, -1, 90], footF: [1, -2], footB: [-1, -1], head: [0, -1] },
  jDvA: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-2, -3, 150], armB: [-3, -2, 140], footF: [1, -2], footB: [0, -2], tailDeg: -24 },
  jDvX: { head: [2, 1, 33.75], body: [1, 1], armF: [3, 2, -45], armB: [2, 2, -30], footF: [2, 1, -20], footB: [0, 0, -10], tailDeg: 28 },
  jShake1: { head: [1, 1, -22.5], body: [0, 1], armF: [1, 0, -30], armB: [0, 0, -20], footF: [2, 0], footB: [-2, 0], tailDeg: 20 },
  jShake2: { head: [0, 1, 22.5], body: [0, 1], armF: [1, 0, -40], armB: [0, 0, -10], footF: [2, 0], footB: [-2, 0], tailDeg: -20 },
  // The transformation: curled up, then shivering as the body swells (two poses a pixel or two
  // apart, alternated fast), the pop out into the beast, low and spread, and the roar.
  mCurl: { head: [0, 4, 33.75], body: [0, 3], armF: [1, 2, -20], armB: [0, 2, -30], footF: [2, 0], footB: [-2, 0], tailDeg: 30 },
  mShiv1: { head: [-1, 3, 22.5], body: [-1, 2], armF: [1, 1, -40], armB: [0, 1, -50], footF: [3, 0], footB: [-3, 0], tailDeg: -20 },
  mShiv2: { head: [1, 2, 11.25], body: [1, 1], armF: [2, 0, -30], armB: [1, 0, -60], footF: [3, 0], footB: [-3, 0], tailDeg: 20 },
  mPop: { head: [1, 3, 22.5], body: [0, 2], armF: [7, 2, -70], armB: [-7, 2, 70], footF: [5, 0], footB: [-5, 0], tailDeg: -10 },
  // Juma, the beast. Hunched over, the arms hanging heavy, a slow breath.
  bStance1: { head: [1, 1, 11.25], body: [0, 0], armF: [2, 0, -25], armB: [1, 0, -15], footF: [3, 0], footB: [-3, 0], tailDeg: 6 },
  bStance2: { head: [1, 2, 11.25], body: [0, 1], armF: [2, 1, -25], armB: [1, 1, -15], footF: [3, 0], footB: [-3, 0], tailDeg: 10 },
  // The slam: both paws raised behind the head and held there, then the hammer down.
  bSlA1: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-3, -8, 165], armB: [-5, -7, 175], footF: [3, 0], footB: [-2, 0], tailDeg: -16 },
  bSlA2: { head: [-2, -1, -22.5], body: [-2, -2], armF: [-4, -11, 175], armB: [-6, -10, -170], footF: [3, -1], footB: [-2, 0], tailDeg: -24 },
  bSlX: { head: [2, 0, 11.25], body: [1, 0], armF: [5, -8, -130], armB: [3, -8, -120], footF: [3, 0], footB: [-3, 0], tailDeg: 6 },
  bSlI: { head: [3, 3, 33.75], body: [2, 2], armF: [8, 2, -40], armB: [6, 2, -30], footF: [4, 0], footB: [-4, 0], tailDeg: 20 },
  bSlF: { head: [3, 3, 22.5], body: [2, 2], armF: [8, 3, -15], armB: [6, 3, -5], footF: [4, 0], footB: [-4, 0], tailDeg: 14 },
  bSlR: { head: [1, 1], body: [0, 1], armF: [2, 1, -30], armB: [1, 1, -20], footF: [3, 0], footB: [-3, 0], tailDeg: 8 },
  // The hammer: the front paw thrown back over the shoulder, then one huge sweep across.
  bHmA1: { head: [-1, 0, -11.25], body: [-1, 0], armF: [-7, -2, 120], armB: [2, 0, -60], footF: [3, 0], footB: [-3, 0], tailDeg: -14 },
  bHmA2: { head: [-2, 1, -22.5], body: [-2, 1], armF: [-10, -4, 120], armB: [2, 1, -70], footF: [4, 0], footB: [-3, 0], tailDeg: -22 },
  bHmX: { head: [3, 0, 11.25], body: [2, 0], armF: [6, -4, -110], armB: [-2, 0, 50], footF: [4, 0], footB: [-4, -1, 22.5], tailDeg: 12 },
  bHmI: { head: [4, 1, 22.5], body: [3, 1], armF: [10, -1, -80], armB: [-4, 0, 60], footF: [5, 0], footB: [-4, 0], tailDeg: 22 },
  bHmF: { head: [2, 1], body: [2, 1], armF: [7, -7, -150], armB: [-3, 0, 40], footF: [4, 0], footB: [-4, 0], tailDeg: 16 },
  // The upper: sinks all the way down, then the whole body uncoils upward behind the paw.
  bUpA1: { head: [0, 3, 11.25], body: [0, 2], armF: [0, 2, 30], armB: [-1, 2, 20], footF: [4, 0], footB: [-4, 0], tailDeg: -10 },
  bUpA2: { head: [-1, 4, 22.5], body: [-1, 3], armF: [-1, 3, 45], armB: [-2, 2, 30], footF: [4, 0], footB: [-4, 0], tailDeg: -20 },
  bUpX: { head: [2, -2, -11.25], body: [1, -2], armF: [5, -8, -165], armB: [-1, -1, 40], footF: [2, -1], footB: [-2, 0], tailDeg: 14 },
  bUpI: { head: [2, -3, -22.5], body: [1, -3], armF: [5, -12, 180], armB: [-2, -1, 50], footF: [1, -2], footB: [-2, -1, 22.5], tailDeg: 24 },
  bUpF: { head: [1, -1, -11.25], body: [0, -1], armF: [3, -8, -170], armB: [-1, 0, 30], footF: [2, 0], footB: [-2, 0], tailDeg: 12 },
  // The earthquake: both fists high over the head, then down into the floor in a deep crouch.
  bQkA: { head: [0, -1, -22.5], body: [0, -2], armF: [-1, -12, 175], armB: [-4, -12, -175], footF: [3, -1], footB: [-3, -1], tailDeg: -24 },
  bQkI: { head: [2, 4, 33.75], body: [1, 3], armF: [7, 3, -15], armB: [3, 3, 10], footF: [5, 0], footB: [-5, 0], tailDeg: 24 },
  // The charge: dug in, then head down and shoulder first, then the shove at the end.
  bChgA: { head: [-1, 3, 22.5], body: [-1, 2], armF: [-1, 2, 30], armB: [-2, 2, 40], footF: [4, 0], footB: [-4, 0], tailDeg: -18 },
  bChg1: { head: [3, 3, 33.75], body: [2, 2], armF: [3, 1, -60], armB: [1, 1, 40], footF: [3, 0], footB: [-3, -1], tailDeg: 20 },
  bChg2: { head: [3, 2, 33.75], body: [2, 1], armF: [3, 2, -40], armB: [1, 0, 60], footF: [-1, -1], footB: [2, 0], tailDeg: 14 },
  bChgHit: { head: [4, 1, 22.5], body: [3, 1], armF: [8, -3, -100], armB: [7, -3, -110], footF: [4, 0], footB: [-4, 0], tailDeg: 24 },
  bAsA: { head: [-1, -1, -22.5], body: [-1, -1], armF: [-4, -11, 170], armB: [-6, -10, 175], footF: [1, -2], footB: [0, -2], tailDeg: -20 },
  bAsI: { head: [3, 2, 33.75], body: [2, 1], armF: [7, 3, -20], armB: [6, 3, -15], footF: [0, -2], footB: [-1, -2], tailDeg: 24 },
  // The seismic leap: arms thrown up on the way up, fists over the head coming down, the landing.
  bLeapUp: { head: [0, -2, -11.25], body: [0, -1], armF: [3, -9, -170], armB: [-3, -9, 170], footF: [1, -2], footB: [-1, -2], tailDeg: -20 },
  bLeapDn: { head: [1, 1, 22.5], body: [0, 0], armF: [2, -11, 180], armB: [-2, -11, 180], footF: [1, 1], footB: [-1, 1], tailDeg: -28 },
  bLand: { head: [2, 4, 33.75], body: [1, 3], armF: [4, 3, -40], armB: [-3, 3, 40], footF: [5, 0], footB: [-5, 0], tailDeg: 24 },
  // The roar: arms flung wide, head thrown back, jaws open.
  bRoar: { head: [1, -2, -22.5], body: [0, -1], armF: [8, -5, -135], armB: [-8, -5, 135], footF: [4, 0], footB: [-4, 0], tailDeg: -20 },
  bRoar2: { head: [1, -3, -33.75], body: [0, -1], armF: [8, -6, -145], armB: [-8, -6, 145], footF: [4, 0], footB: [-4, 0], tailDeg: -26 },
  // Out of breath at the end of the form: slouched, heaving.
  bTired1: { head: [1, 3, 22.5], body: [0, 2], armF: [1, 2, 0], armB: [0, 2, 5], footF: [3, 0], footB: [-3, 0], tailDeg: 20 },
  bTired2: { head: [1, 4, 33.75], body: [0, 3], armF: [1, 3, 5], armB: [0, 3, 10], footF: [3, 0], footB: [-3, 0], tailDeg: 24 },
  // Marola's tail swinging up from under the rival
  tailUp0: { ...crouch, tail: [[1, 0], [-4, 1], [-8, 0], [-10, -2]] },
  tailUp1: { head: [-1, -1], body: [0, -1], armF: [-1, -1, 60], tail: [[1, 0], [4, -2], [8, -6], [10, -11], [9, -16], [7, -19]] },
  tailUp2: { head: [-1, -1], tail: [[1, 0], [2, -5], [3, -10], [5, -14], [8, -16]] },
  // Juma's rising paw
  rising0: { ...crouch, armF: [0, 2, 40] },
  rising1: { armF: [2, -4, -175], armB: [1, -3, -160], body: [0, -2], head: [1, -3], footF: [1, -2], footB: [0, -2] },
  rising2: { armF: [2, -3, -165], body: [0, -1], head: [1, -2] },
  // Mingau's low claw
  lowclaw0: { ...crouch, armF: [0, 2, 120] },
  lowclaw1: { ...crouch, armF: [3, 3, -80], head: [1, 3] },
  lowclaw2: { ...crouch, armF: [3, 3, -30], head: [1, 3] },
  // Air string: a swipe, a forward somersault, then a meteor smash down
  airA0: { armF: [-1, -2, 150], footF: [1, -2], footB: [-1, -1], tailDeg: -10 },
  airA1: { armF: [2, 0, -60], footF: [1, -2], footB: [-1, -1], body: [1, 0], head: [1, 0], tailDeg: 10 },
  airWhip0: { footF: [1, -2], footB: [-1, -1], tail: [[1, 0], [-1, -3], [-2, -7], [0, -11], [3, -13]] },
  airWhip1: { footF: [1, -2], footB: [-1, -1], head: [1, 0], tail: [[1, 0], [3, -1], [8, -1], [13, 0], [17, 1]] },
  airB0: { footF: [1, -2], footB: [-1, -2], armF: [0, -1, -120] },
  airB1: { footF: [3, -2, -90], footB: [-1, -2], spin: 1 },
  airB2: { footF: [3, -2, -90], spin: 2 },
  spike0: { armF: [0, -3, 180], armB: [0, -3, 180], head: [0, -1], footF: [1, -2], footB: [-1, -1], tailDeg: -20 },
  spike1: { armF: [3, 2, -20], armB: [3, 2, -30], head: [2, 1], body: [1, 0], footF: [0, -1], front: 'armF', tailDeg: 20 },
  // Dash strikes out of a dodge
  dashAtk: { armF: [3, 0, -90], armB: [2, -1, -100], head: [2, 0], body: [1, 0], footF: [-2, 0, 30], footB: [-3, -1, 40], tailDeg: 20 },
  dashWhip: { body: [1, 0], head: [2, 0], footB: [-2, 0], tail: [[1, 0], [4, -2], [9, -3], [14, -2], [19, -1]] },
  // Defence and movement
  parry: { armF: [1, -2, -150], armB: [1, -2, -140], head: [-1, 1], body: [-1, 0], footF: [1, 0], footB: [-1, 0] },
  airdash: { armF: [-2, 0, 80], armB: [-2, -1, 80], footF: [-2, -1, 30], footB: [-3, -1, 40], head: [1, 0], body: [1, 0], tailDeg: 25 },
  chase: { armF: [2, -1, -110], armB: [1, -1, -120], head: [1, -1], footF: [-1, 0, 30], footB: [-2, 0, 40], tailDeg: 25 },
  tumble: { head: [-1, 0], armF: [1, -1, -100], armB: [-1, -1, 100], footF: [1, -1], footB: [-1, -2] },
  // Reeling from a hit. Light: the head snaps back, the body gives and gathers itself.
  hurtF0: { head: [-2, 0, -22.5], body: [-1, 0], armF: [0, -2, -140], armB: [-1, -2, 130], footF: [1, -1], footB: [-1, 0], tailDeg: 22 },
  hurtF1: { head: [0, 2, 11.25], body: [0, 1], armF: [0, 0, -25], armB: [0, 0, 20], footF: [1, 0], footB: [-1, 0], tailDeg: 12 },
  hurtF2: { head: [0, 1], body: [0, 1], armF: [0, 1, -10], armB: [0, 1, 10], footF: [1, 0], footB: [-1, 0], tailDeg: 6 },
  // Heavy: thrown back off balance with the front foot up, a flailing stagger, then hunched over.
  hurtH0: { head: [-3, 0, -33.75], body: [-2, -1], armF: [0, -2, -150], armB: [-1, -2, 140], footF: [2, -2, -22.5], footB: [-2, 0], tailDeg: 32 },
  hurtH1: { head: [-2, 1, -11.25], body: [-2, 0], armF: [-1, -1, -120], armB: [-2, -1, 90], footF: [2, -1], footB: [-2, 0], tailDeg: 24 },
  hurtH2: { head: [-1, 2, 11.25], body: [-1, 1], armF: [0, 1, -10], armB: [-1, 1, 20], footF: [1, 0], footB: [-2, 0], tailDeg: 10 },
  hurtH3: { head: [0, 2], body: [0, 1], armF: [0, 1, 5], armB: [0, 1, -5], footF: [1, 0], footB: [-1, 0], tailDeg: 4 },
  // From behind: shoved forward, head whipping down, arms and back leg flung back.
  hurtB0: { head: [2, 1, 22.5], body: [1, 0], armF: [-1, -1, 70], armB: [-1, -1, 95], footF: [1, 0], footB: [-3, -2, 22.5], tailDeg: -18 },
  hurtB1: { head: [1, 1, 11.25], body: [1, 1], armF: [0, 0, 35], armB: [0, 0, 45], footF: [1, 0], footB: [-2, -1], tailDeg: -8 },
  // In the air: folded around the blow, legs thrown forward and arms flung up.
  hurtA0: { head: [-2, 0, -22.5], body: [-1, 0], armF: [0, -2, -150], armB: [-1, -2, 140], footF: [2, -2, -33.75], footB: [1, -2, -22.5], tailDeg: 34 },
  hurtA1: { head: [-1, 0, -11.25], body: [0, 0], armF: [0, -1, -120], armB: [-1, -1, 110], footF: [1, -1, -11.25], footB: [0, -2], tailDeg: 20 }
};

// Hitstun sequences: [until progress, frame, face].
const HURT = {
  light: [[0.32, 'hurtF0', 'Hurt'], [0.66, 'hurtF1', 'Hurt'], [1, 'hurtF2', 'Hurt']],
  heavy: [[0.24, 'hurtH0', 'Pain'], [0.5, 'hurtH1', 'Pain'], [0.76, 'hurtH2', 'Hurt'], [1, 'hurtH3', 'Hurt']],
  back: [[0.32, 'hurtB0', 'Pain'], [0.66, 'hurtB1', 'Hurt'], [1, 'hurtF2', 'Hurt']],
  air: [[0.4, 'hurtA0', 'Pain'], [1, 'hurtA1', 'Hurt']]
};
// The sequence and step for a fighter in hitstun. While frozen in hitlag it holds the impact.
export function hurtStep(a) {
  const p = a.hitstunMax > 0 ? Math.max(0, Math.min(0.999, 1 - a.hitstun / a.hitstunMax)) : 0;
  const face = a.face || 1;
  const back = (a.hitDir || -face) === face;
  const set = !a.ground ? HURT.air : back ? HURT.back : a.hitHeavy ? HURT.heavy : HURT.light;
  const [, name, expr] = set.find(s => p < s[0]) || set[set.length - 1];
  return { name, expr: a.hitHeavy && expr === 'Hurt' && p < 0.5 ? 'Pain' : expr };
}

// Strike frames per move: [frame names at each third of the move], plus the face.
const STRIKES = {
  scratchA: [['scratchA0', 'scratchA1', 'scratchA2'], 'Angry'],
  scratchB: [['scratchB0', 'scratchB1', 'scratchB2'], 'Angry'],
  upper: [['upper0', 'upper1', 'upper2'], 'Angry'],
  lowclaw: [['lowclaw0', 'lowclaw1', 'lowclaw2'], 'Angry'],
  whipA: [['whip0', 'whip1', 'whip2'], 'Angry'],
  whipB: [['whip0', 'whip1', 'whip2'], 'Angry'],
  tailUp: [['tailUp0', 'tailUp1', 'tailUp2'], 'Angry'],
  sweep: [['sweep0', 'sweep1', 'sweep1'], 'Angry'],
  airA: [['airA0', 'airA1', 'airA1'], 'Angry'],
  airB: [['airB0', 'airB1', 'airB2'], 'Angry'],
  spike: [['spike0', 'spike0', 'spike1'], 'Angry'],
  dashAtk: [['dashAtk', 'dashAtk', 'dashAtk'], 'Angry'],
  blade: [['scratchA0', 'scratchA1', 'scratchA2'], 'Angry'],
  pipe: [['paw0', 'paw1', 'paw2'], 'Angry'],
  bash: [['smash0', 'smash1', 'smash1'], 'Angry'],
  throw: [['throw', 'throw', 'throw'], 'Angry']
};
// Nox's moves by time: [from progress, frame, face]. Uneven holds give the broken rhythm: a slow
// wind-up, a snap, a pause on the impact pose (the hitlag freeze lands there), then the rest.
const KEYS = {
  bloodClaw: [[0, 'nClawA1', 'Angry'], [0.14, 'nClawA2', 'Angry'], [0.3, 'nClawX', 'Angry'], [0.38, 'nClawI', 'Angry'], [0.56, 'nClawF', 'Angry'], [0.78, 'nClawR', '']],
  scytheReap: [[0, 'nLashA1', 'Angry'], [0.16, 'nLashA2', 'Angry'], [0.3, 'nLashX', 'Angry'], [0.45, 'nLashI', 'Angry'], [0.62, 'nLashF', 'Angry'], [0.82, 'nLashR', '']],
  scytheSpin: [[0, 'nCutA1', 'Angry'], [0.12, 'nCutA2', 'Angry'], [0.22, 'spinS', 'Angry'], [0.78, 'spinR', 'Angry']],
  scytheGuillotine: [[0, 'gA1', 'Angry'], [0.2, 'gA2', 'Open'], [0.38, 'gX', 'Angry'], [0.48, 'gI', 'Open'], [0.66, 'gF', 'Angry'], [0.84, 'gR', '']],
  scytheSweep: [[0, 'swA', 'Angry'], [0.18, 'swA2', 'Angry'], [0.32, 'swX', 'Angry'], [0.42, 'swI', 'Open'], [0.62, 'swF', 'Angry'], [0.82, 'swR', '']],
  scytheDash: [[0, 'nCutA1', 'Angry'], [0.16, 'nCutA2', 'Angry'], [0.3, 'nCutX', 'Angry'], [0.58, 'nCutF', 'Angry'], [0.82, 'nCutR', '']],
  execute: [[0, 'gA1', 'Angry'], [0.2, 'gA2', 'Open'], [0.42, 'gX', 'Angry'], [0.52, 'exI', 'Open'], [0.72, 'gF', 'Angry'], [0.88, 'gR', '']],
  batStrike: [[0, 'nCutX', 'Angry'], [0.24, 'nClawI', 'Angry'], [0.4, 'ncLow', 'Angry'], [0.52, 'nLashI', 'Angry'], [0.8, 'nClawR', '']],
  nAirCross: [[0, 'nAcA', 'Angry'], [0.18, 'nAcX', 'Angry'], [0.3, 'nAcI', 'Angry'], [0.46, 'ncLow', 'Angry'], [0.6, 'ncUp', 'Angry'], [0.82, 'nAcR', '']],
  bloodSpikes: [[0, 'nSpkA1', 'Angry'], [0.2, 'nSpkA2', 'Open'], [0.33, 'nSpkX', 'Angry'], [0.4, 'nSpkI', 'Open'], [0.62, 'nSpkF', 'Angry'], [0.84, 'nSpkR', '']],
  vampKiss: [[0, 'nKissA1', 'Open'], [0.14, 'nKissA2', 'Open'], [0.27, 'nKissX', 'Open'], [0.32, 'nKissI', 'Open'], [0.46, 'nKissD', 'Open'], [0.62, 'nKissI2', 'Open'], [0.8, 'nKissR', 'Angry']],
  shadowCut: [[0, 'nCutA1', 'Angry'], [0.16, 'nCutA2', 'Angry'], [0.3, 'nCutX', 'Angry'], [0.58, 'nCutF', 'Angry'], [0.82, 'nCutR', '']],
  nAirClaw: [[0, 'nAcA', 'Angry'], [0.22, 'nAcX', 'Angry'], [0.3, 'nAcI', 'Angry'], [0.46, 'nAcA2', 'Angry'], [0.56, 'nAcX2', 'Angry'], [0.62, 'nAcI2', 'Angry'], [0.84, 'nAcR', '']],
  nAirScythe: [[0, 'nScA', 'Angry'], [0.2, 'nScA2', 'Angry'], [0.36, 'nScX', 'Angry'], [0.45, 'nScI', 'Angry'], [0.66, 'nScF', 'Angry']],
  dashAtk: [[0, 'nCutX', 'Angry'], [0.6, 'nCutF', 'Angry']],
  // DARK NOX, bare-clawed: the snap lands almost at once and the impact pose sits exactly on the
  // move's hit time (see DARK_MOVES). The fourth field is the claw that is striking ('F' near,
  // 'B' far, 'FB' both), for the talons and smears drawn over him (darkClaw below).
  dRend: [[0, 'dRnA', 'Angry'], [0.16, 'dRnX', 'Angry', 'F'], [0.4, 'dRnI', 'Open', 'F'], [0.62, 'dRnF', 'Angry', 'F'], [0.82, 'dRnR', 'Angry']],
  dRake: [[0, 'dRkA', 'Angry'], [0.2, 'dRkX', 'Angry', 'B'], [0.4, 'dRkI', 'Open', 'B'], [0.62, 'dRkF', 'Angry', 'B'], [0.84, 'dRkR', 'Angry']],
  dFrenzy: [[0, 'dFzA', 'Angry'], [0.07, 'dFz1X', 'Angry', 'F'], [0.15, 'dFz1I', 'Open', 'F'], [0.27, 'dFz2X', 'Angry', 'B'], [0.35, 'dFz2I', 'Open', 'B'],
    [0.47, 'dFz3X', 'Angry', 'F'], [0.55, 'dFz3I', 'Open', 'F'], [0.66, 'dFz4X', 'Angry', 'B'], [0.75, 'dFz4I', 'Open', 'B'], [0.88, 'dFzF', 'Angry', 'B']],
  dReap: [[0, 'dRpA', 'Angry'], [0.1, 'dRpA2', 'Angry'], [0.24, 'dRpX', 'Open', 'F'], [0.35, 'dRpI', 'Open', 'F'], [0.6, 'dRpF', 'Angry', 'F'], [0.84, 'dRpR', 'Angry']],
  dHarvest: [[0, 'dHvA', 'Angry'], [0.16, 'dHvA2', 'Angry', 'FB'], [0.3, 'dHvX', 'Open', 'FB'], [0.4, 'dHvI', 'Open', 'FB'], [0.7, 'dHvF', 'Open', 'FB'], [0.88, 'dHvR', 'Angry']],
  dAirClaw: [[0, 'daA', 'Angry'], [0.18, 'daX', 'Angry', 'F'], [0.3, 'daI', 'Open', 'F'], [0.5, 'daX2', 'Angry', 'B'], [0.62, 'daI2', 'Open', 'B'], [0.84, 'daR', 'Angry']],
  dAirVortex: [[0, 'dVxA', 'Angry'], [0.1, 'dVx', 'Open', 'FB'], [0.86, 'dVx', 'Angry']],
  dAirDive: [[0, 'dDvA', 'Angry'], [0.14, 'dDvA2', 'Open'], [0.28, 'dDvX', 'Open', 'FB'], [0.42, 'dDvI', 'Open', 'FB'], [0.72, 'dDvF', 'Angry', 'FB']],
  dKiss: [[0, 'dKsA', 'Open'], [0.2, 'dKsX', 'Open', 'FB'], [0.3, 'dKsI', 'Open', 'FB'], [0.4, 'dKsD', 'Open', 'FB'], [0.66, 'dKsI2', 'Open'], [0.85, 'dKsR', 'Angry']],
  dExecute: [[0, 'dExA', 'Angry'], [0.25, 'dExA2', 'Open'], [0.45, 'dExX', 'Angry', 'F'], [0.55, 'dExI', 'Open', 'F'], [0.75, 'dExF', 'Angry', 'F'], [0.9, 'dRnR', 'Angry']],
  dPhantom: [[0, 'dPhA', 'Angry'], [0.1, 'dPhX', 'Angry', 'F'], [0.3, 'dPhI', 'Open', 'F'], [0.55, 'dPhF', 'Angry', 'F'], [0.8, 'dRnR', 'Angry']],
  // Juma, small: short holds, snaps that land almost at once.
  jSwipe: [[0, 'jSwA', 'Angry'], [0.3, 'jSwX', 'Angry'], [0.4, 'jSwI', 'Angry'], [0.75, 'jSwR', '']],
  jSwipe2: [[0, 'jSwA2', 'Angry'], [0.3, 'jSwX2', 'Angry'], [0.4, 'jSwI2', 'Angry'], [0.75, 'jSwR', '']],
  jRake: [[0, 'jRkA', 'Angry'], [0.3, 'jRkX', 'Open'], [0.42, 'jRkI', 'Open'], [0.66, 'jRkF', 'Angry'], [0.85, 'jSwR', '']],
  jPounceUp: [[0, 'jPuA', 'Angry'], [0.3, 'jPuX', 'Open'], [0.4, 'jPuI', 'Open'], [0.78, 'jSwR', '']],
  jLow: [[0, 'jLoA', 'Angry'], [0.3, 'jLoX', 'Angry'], [0.4, 'jLoI', 'Open'], [0.8, 'crouch', '']],
  jBolt: [[0, 'jBoA', 'Angry'], [0.14, 'jBoX', 'Open'], [0.62, 'jBoI', 'Angry'], [0.85, 'jSwR', '']],
  jAirClaw: [[0, 'nAcA', 'Angry'], [0.2, 'nAcX', 'Angry'], [0.3, 'nAcI', 'Angry'], [0.46, 'nAcA2', 'Angry'], [0.56, 'nAcX2', 'Angry'], [0.64, 'nAcI2', 'Angry'], [0.84, 'nAcR', '']],
  jAirDive: [[0, 'jDvA', 'Angry'], [0.3, 'jDvX', 'Open']],
  // The beast: long, held wind-ups, a heavy snap, and an impact pose that sits in the floor.
  bSlam: [[0, 'bSlA1', 'Angry'], [0.18, 'bSlA2', 'Open'], [0.38, 'bSlX', 'Angry'], [0.46, 'bSlI', 'Open'], [0.66, 'bSlF', 'Angry'], [0.86, 'bSlR', '']],
  bHammer: [[0, 'bHmA1', 'Angry'], [0.2, 'bHmA2', 'Angry'], [0.4, 'bHmX', 'Open'], [0.48, 'bHmI', 'Open'], [0.68, 'bHmF', 'Angry'], [0.88, 'bSlR', '']],
  bUpper: [[0, 'bUpA1', 'Angry'], [0.2, 'bUpA2', 'Angry'], [0.38, 'bUpX', 'Open'], [0.45, 'bUpI', 'Open'], [0.7, 'bUpF', 'Angry'], [0.9, 'bSlR', '']],
  bQuake: [[0, 'bQkA', 'Angry'], [0.28, 'bSlA2', 'Open'], [0.42, 'bSlX', 'Open'], [0.5, 'bQkI', 'Open'], [0.8, 'bSlF', 'Angry'], [0.92, 'bSlR', '']],
  bAirSmash: [[0, 'bAsA', 'Angry'], [0.28, 'bSlA2', 'Open'], [0.42, 'bAsI', 'Open']],
  // Lola: the cuts snap almost at once; the skips show her coiled to vanish, then already striking.
  lCutA: [[0, 'lCaA', 'Angry'], [0.28, 'lCaX', 'Angry'], [0.4, 'lCaI', 'Angry'], [0.75, 'lStance1', '']],
  lCutB: [[0, 'lCbA', 'Angry'], [0.28, 'lCbX', 'Angry'], [0.4, 'lCbI', 'Angry'], [0.75, 'lStance1', '']],
  lBehind: [[0, 'lBhA', 'Angry'], [0.26, 'lBhX', 'Open'], [0.5, 'lBhI', 'Open'], [0.7, 'lBhF', 'Angry'], [0.88, 'lStance1', '']],
  lRise: [[0, 'lRsA', 'Angry'], [0.3, 'lRsX', 'Open'], [0.42, 'lRsI', 'Open'], [0.8, 'lStance1', '']],
  lLow: [[0, 'lLoA', 'Angry'], [0.3, 'lLoX', 'Angry'], [0.42, 'lLoI', 'Open'], [0.8, 'crouch', '']],
  lSkip: [[0, 'lSkA', 'Angry'], [0.18, 'lCaX', 'Open'], [0.44, 'lCaI', 'Angry'], [0.58, 'lCbX', 'Angry'], [0.68, 'lCbI', 'Open'], [0.86, 'lStance1', '']],
  lAirCut: [[0, 'nAcA', 'Angry'], [0.2, 'nAcX', 'Angry'], [0.3, 'nAcI', 'Angry'], [0.46, 'nAcA2', 'Angry'], [0.56, 'nAcX2', 'Angry'], [0.64, 'nAcI2', 'Angry'], [0.84, 'nAcR', '']],
  lAirDive: [[0, 'lDvA', 'Angry'], [0.22, 'lDvX', 'Open']],
  lFan: [[0, 'lSkA', 'Angry'], [0.12, 'lFanA', 'Angry'], [0.3, 'lFanX', 'Open'], [0.5, 'lFanI', 'Angry'], [0.85, 'lStance1', '']],
  lRain: [[0, 'lLoA', 'Angry'], [0.26, 'lRsX', 'Open'], [0.38, 'lRsI', 'Open'], [0.44, 'lRainX', 'Open'], [0.66, 'lRainI', 'Angry'], [0.88, 'lStance1', '']],
  // The Cat King's orders: a stern wind-up (A), the scepter snapped to where he sends them (X) and held
  // there calling the order (I) a little before the beat king-art.js glints on, then eased off (R).
  kSlash: [[0, 'kgPtA', 'Angry'], [0.24, 'kgPtX', 'Open'], [0.36, 'kgPtI', 'Open'], [0.8, 'kgPtR', '']],
  kStab: [[0, 'kgPtA', 'Angry'], [0.24, 'kgPtX', 'Open'], [0.36, 'kgStI', 'Open'], [0.8, 'kgPtR', '']],
  kShadow: [[0, 'kgShA', 'Angry'], [0.22, 'kgPtX', 'Angry'], [0.34, 'kgShI', 'Angry'], [0.82, 'kgPtR', '']],
  kVolley: [[0, 'kgSwA', 'Angry'], [0.22, 'kgSwX', 'Angry'], [0.36, 'kgSwI', 'Open'], [0.8, 'kgSwR', '']],
  kZap: [[0, 'kgSkA', 'Angry'], [0.24, 'kgRsX', 'Open'], [0.36, 'kgSkI', 'Open'], [0.85, 'kgSkI', '']],
  kBash: [[0, 'kgPaA', 'Angry'], [0.3, 'kgPtX', 'Angry'], [0.4, 'kgPaI', 'Open'], [0.82, 'kgPaR', '']],
  kCharge: [[0, 'kgChA', 'Angry'], [0.2, 'kgChX', 'Open'], [0.32, 'kgChI', 'Open'], [0.88, 'kgPtR', 'Open']],
  kRain: [[0, 'kgUpA', 'Angry'], [0.2, 'kgRsX', 'Open'], [0.3, 'kgUpI', 'Open'], [0.5, 'kgUpI2', 'Open'], [0.62, 'kgUpI', ''], [0.74, 'kgUpI2', ''], [0.88, 'kgUpI', '']],
  kRise: [[0, 'kgRsA', 'Angry'], [0.26, 'kgRsX', 'Open'], [0.4, 'kgRsI', 'Open'], [0.85, 'kgRsI', '']],
  kMercy: [[0, 'kgDnA', 'Angry'], [0.34, 'kgPtX', 'Angry'], [0.46, 'kgDnI', 'Angry'], [0.88, 'kgDnI', '']],
  kAirSlash: [[0, 'kgAA', 'Angry'], [0.24, 'kgPtX', 'Open'], [0.36, 'kgAPt', 'Open'], [0.85, 'kgAPt', '']],
  kAirShot: [[0, 'kgAA', 'Angry'], [0.28, 'kgAPt', 'Open'], [0.4, 'kgAShot', 'Open'], [0.85, 'kgAShot', '']],
  kAirMeteor: [[0, 'kgAShot', 'Angry'], [0.26, 'kgAPt', 'Angry'], [0.38, 'kgSkyI', 'Open'], [0.85, 'kgSkyI', '']],
  kDrop: [[0, 'kgAA', 'Angry'], [0.4, 'kgAPt', 'Angry'], [0.52, 'kgADrop', 'Open'], [0.88, 'kgADrop', '']]
};
export const keyFor = (kind, p) => { const k = KEYS[kind]; if (!k) return null; let r = k[0]; for (const e of k) if (p >= e[0]) r = e; return r; };

// DARK NOX's moveset: durations (seconds) and hit times (progress), as the simulation defines them.
// The durations here are only used until sim/moves.js has the move.
export const DARK_MOVES = {
  dRend: { dur: 0.2, hits: [0.4] }, dRake: { dur: 0.22, hits: [0.4] }, dFrenzy: { dur: 0.42, hits: [0.15, 0.35, 0.55, 0.75] },
  dReap: { dur: 0.32, hits: [0.35] }, dHarvest: { dur: 0.46, hits: [0.4] }, dAirClaw: { dur: 0.22, hits: [0.3, 0.62] },
  dAirVortex: { dur: 0.38, hits: [0.2, 0.45, 0.7] }, dAirDive: { dur: 0.32, hits: [0.42] }, dKiss: { dur: 0.42, hits: [0.3, 0.66] },
  dExecute: { dur: 0.46, hits: [0.55] }, dPhantom: { dur: 0.32, hits: [0.3] }
};
const darkProgress = a => Math.max(0, Math.min(0.999, 1 - a.attack / (MOVES[a.attackKind]?.dur || DARK_MOVES[a.attackKind].dur)));
// The phase of a key from the last letter of its frame's name (D, the kiss's drink, holds the bite).
const PHASE = { A: 'A', X: 'X', I: 'I', F: 'F', R: 'R', D: 'I' };
// Which of DARK NOX's claws is striking right now, for whatever draws over him (talons, claw
// smears): { claw: 'F' (near arm) | 'B' (far arm) | 'FB' (both) | null, phase: 'A' wind-up | 'X' snap |
// 'I' impact | 'F' follow-through | 'R' recovery, p: progress 0..1, hit: index of the blow }.
// null when he is not in one of his dark moves.
export function darkClaw(a) {
  if (!a || !(a.attack > 0) || !DARK_MOVES[a.attackKind]) return null;
  const p = darkProgress(a), k = keyFor(a.attackKind, p), name = k[1], hits = DARK_MOVES[a.attackKind].hits;
  let hit = 0;
  while (hit < hits.length - 1 && p > (hits[hit] + hits[hit + 1]) / 2) hit++;
  // The vortex is one long spin: a snap all the way, an impact around each of its hits.
  const phase = name === 'dVx' && p < 0.86 ? (Math.abs(p - hits[hit]) < 0.0625 ? 'I' : 'X') : PHASE[name.match(/([A-Z])\d?$/)?.[1]] || 'R';
  return { claw: k[3] || null, phase, p, hit };
}

// DARK NOX's own frames for a dark move, or null. The vortex spins in quarter turns keyed to its
// hits (upright, upside down, upright at each one); the gulps of the kiss bob his head.
function darkAttack(a, kind, time, pick) {
  const p = darkProgress(a), face = a.face || 1;
  if (kind === 'dAirVortex' && p >= 0.1 && p < 0.86) {
    const q = Math.floor((p - 0.2) / 0.125 + 0.5);
    return { frame: { ...FRAMES.dVx, spin: q * face }, expr: q % 2 ? 'Angry' : 'Open', name: 'dVx' };
  }
  const [, name, expr] = keyFor(kind, p);
  if (name === 'dKsD') return pick(Math.floor(time * 9) % 2 ? 'dKsD2' : 'dKsD', 'Open');
  return pick(name, expr);
}

// DARK NOX between blows: the feral guard (a fast pant), the lurching run, and the wings for
// everything else he shares with the others (open on the way up, spread falling, flared when hit).
const FERAL = { nStance1: 'dkIdle1', nStance2: 'dkIdle2', run1: 'dkRun1', runPass: 'dkRunP', run2: 'dkRun2', runPass2: 'dkRunP2' };
const DARK_WING = {
  jump: 'up', fall: 'open', glide: 'flare', skid: 'open', land: 'half', airdash: 'back', chase: 'back',
  hurt: 'open', hurtF0: 'half', hurtH0: 'open', hurtH1: 'half', hurtA0: 'up', hurtA1: 'open', hurtB0: 'up', tumble: 'open', dizzy: 'half', crouch: 'fold',
  beamA: 'half', beamC0: 'open', beamC1: 'open', beamF: 'back', beamR: 'half', beamAA: 'up', beamCA0: 'open', beamCA1: 'open', beamFA: 'back', beamRA: 'open'
};
// The blows he still shares with Nox are thrown with the claws while he is dark: the requiem's cuts
// (one claw then the other, the dive at the end) and the dash strike out of a dodge.
const DARK_SWAP = {
  requiem: { nKissA2: 'dKsA', nClawI: 'dFz1I', nCutX: 'dFz2I', nScI: 'dDvI' },
  dashAtk: { nCutX: 'dPhX', nCutF: 'dPhI' }
};
function feral(r, a, time) {
  const seed = (a.id || 0) * 1.37;
  if (r.name === 'nStance1' || r.name === 'nStance2') {
    const pant = Math.floor((time + seed) * 3.2) % 2;
    return { frame: FRAMES[pant ? 'dkIdle2' : 'dkIdle1'], expr: r.expr === 'Blink' ? 'Blink' : pant ? 'Open' : 'Angry', name: pant ? 'dkIdle2' : 'dkIdle1' };
  }
  if (FERAL[r.name]) return { frame: FRAMES[FERAL[r.name]], expr: r.expr === 'Blink' ? 'Blink' : 'Angry', name: FERAL[r.name] };
  const swap = DARK_SWAP[a.act] || (a.attack > 0 ? DARK_SWAP[a.attackKind] : null);
  if (swap?.[r.name]) return { frame: FRAMES[swap[r.name]], expr: r.expr, name: swap[r.name] };
  const wing = DARK_WING[r.name] || (r.name.startsWith('w:') ? 'back' : null);
  if (wing && r.frame && r.frame.wing === undefined) return { ...r, frame: { ...r.frame, wing } };
  return r;
}

// The shared air and dash moves look different per fighter: kicks, tail, fangs.
const BY_TYPE = {
  airA: { 1: [['airWhip0', 'airWhip1', 'airWhip1'], 'Angry'] },
  dashAtk: { 1: [['dashWhip', 'dashWhip', 'dashWhip'], 'Angry'], 2: [['lDash', 'lDash', 'lDash'], 'Angry'] }
};
const WEAPON_TIME = { blade: 0.3, pipe: 0.3, bash: 0.3, throw: 0.25 };

const TWO_HANDED = ['spear', 'axe', 'hammer'];
// Weapon attacks are posed procedurally from the move's arc: a held anticipation pose, the arm
// sweeping the weapon through the swing (eased, so it starts fast), and a weighted follow-through.
// Returns the smear to draw along the arc while it is moving.
function weaponFrame(mv, p, seed, time) {
  const A = mv.anim, wind = p < A.w, swing = !wind && p < A.s;
  const t = swing ? (p - A.w) / (A.s - A.w) : wind ? 0 : 1;
  const e = 1 - (1 - t) * (1 - t);
  const air = ['nAir', 'sAir', 'dAir', 'rec', 'gp'].includes(mv.slot);
  const f = {};
  let arm = 0, smear = null;
  if (A.style === 'swing') {
    arm = wind ? A.from : swing ? A.from + (A.to - A.from) * e : A.to;
    f.armF = [wind ? -1 : 1, wind ? -1 : 0, arm];
    f.body = [wind ? -1 : 1, 0];
    f.head = wind ? [-1, -1] : swing ? [2, 0] : [1, 1];
    f.footF = wind ? [0, 0] : [2, 0];
    f.footB = [-1, 0];
    f.tailDeg = wind ? -15 : 20;
    if (swing) smear = { style: 'swing', from: A.from, cur: arm, k: 1 };
    else if (!wind && p < A.s + 0.14) smear = { style: 'swing', from: A.from, cur: arm, k: 1 - (p - A.s) / 0.14 };
  } else if (A.style === 'thrust') {
    arm = A.to;
    const dx = wind ? -2 : swing ? -2 + 7 * e : 4;
    f.armF = [dx, -1, arm];
    f.body = [wind ? -1 : 1, 0];
    f.head = [wind ? -1 : 2, 0];
    f.footF = [wind ? 0 : 3, 0];
    f.footB = [wind ? 0 : -2, 0];
    f.tailDeg = wind ? -10 : 25;
    if (swing || p < A.s + 0.1) smear = { style: 'thrust', cur: arm, dx, k: swing ? 1 : 1 - (p - A.s) / 0.1 };
  } else if (A.style === 'spin') {
    arm = -90;
    f.armF = [1, -1, -90];
    f.footF = [1, -1];
    f.footB = [-1, -1];
    if (swing) { f.spin = Math.floor(t * A.turns); smear = { style: 'spin', k: 1 }; }
  } else if (A.style === 'flurry') {
    const k = swing ? Math.floor((time + seed) * 30) % 2 : 0;
    arm = -90 + (k ? -14 : 10);
    f.armF = [k ? 5 : 0, -1, arm];
    f.body = [1, 0];
    f.head = [2, 0];
    f.footF = [2, 0];
    if (swing) smear = { style: 'thrust', cur: arm, dx: f.armF[0], k: 1 };
  }
  // Heavy weapons are held in both paws.
  if (TWO_HANDED.includes(mv.weapon) && A.style !== 'spin') f.armB = [f.armF[0] + 1, f.armF[1], arm + 10];
  if (mv.low) { f.head = [f.head?.[0] || 0, (f.head?.[1] || 0) + 3]; f.body = [f.body?.[0] || 0, 1]; f.armF = [f.armF[0], f.armF[1] + 2, f.armF[2]]; if (f.armB) f.armB = [f.armB[0], f.armB[1] + 2, f.armB[2]]; }
  if (air && A.style !== 'spin') { f.footF = [1, -2]; f.footB = [-1, -1]; }
  // Snap to the rotation steps the sprites use, so repeated frames hit the sprite cache.
  const snap = d => Math.round(d / 11.25) * 11.25;
  for (const k of ['armF', 'armB']) if (f[k]) f[k] = [f[k][0], f[k][1], snap(f[k][2])];
  if (smear?.cur !== undefined) smear.cur = snap(smear.cur);
  return { frame: f, expr: 'Angry', name: 'w:' + mv.slot, smear };
}


// ZA WARUDO, pose by pose: the watch clicked, the shout with arms flung open, then in the stopped
// world whatever she did last (the sim keeps it in wPose, wPoseT seconds ago), and the watch again.
function worldFrame(a, pick) {
  const t = a.actT ?? 0;
  if (t < WORLD.intro) return t < 0.32 ? pick('wWatch', t < 0.16 ? 'Angry' : 'Blink') : pick(Math.floor(t * 8) % 2 ? 'wPose2' : 'wPose', 'Open');
  if (t < WORLD.intro + WORLD.wave) return pick('wPose', 'Open');
  const pt = a.wPoseT ?? 0;
  switch (a.wPose) {
    case 'throw': return pick(pt < 0.12 ? 'lThrowF' : 'lAppear', 'Angry');
    case 'throwB': return pick(pt < 0.12 ? 'lThrowB' : 'lAppear', 'Angry');
    case 'dash': return pick('lRingDash', 'Angry');
    case 'home': return pick('wHome', 'Blink');
    case 'snap': return pick(pt < 0.28 ? 'wSnap' : 'wHome', pt < 0.28 ? 'Blink' : '');
    case 'appear': return pick('lAppear', 'Angry');
  }
  return pick('lAppear', 'Angry');
}

const aimArm = (a, recoil) => {
  const aim = a.aim ?? 0;
  let rel = (a.face || 1) > 0 ? aim : Math.PI - aim;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  rel = Math.max(-1.45, Math.min(1.45, rel));
  return [recoil ? -1 : 0, 0, (rel * 180) / Math.PI - 90];
};

// The Cat King. An order: its key (the air orders tuck his feet, the ones on the floor plant them,
// whichever he happens to be on when he gives it).
const KING_AIR_ORDERS = new Set(['kAirSlash', 'kAirShot', 'kAirMeteor', 'kDrop']);
const KING_WALK = ['kgWalk1', 'kgWalkP', 'kgWalk2', 'kgWalkP2'], KING_RUN = ['kgRun1', 'kgRunP', 'kgRun2', 'kgRunP2'];
function kingOrder(a, kind, pick) {
  const [, name, expr] = keyFor(kind, Math.max(0, Math.min(0.999, 1 - a.attack / MOVES[kind].dur)));
  const r = pick(name, expr), air = KING_AIR_ORDERS.has(kind);
  if (a.ground === false && !air) return { ...r, frame: { ...r.frame, footF: [1, -2], footB: [-1, -1] } };
  if (a.ground && air) return { ...r, frame: { ...r.frame, footF: [2, 0], footB: [-2, 0] } };
  return r;
}
// BANDEIRA REAL (a.act 'plant', SPECIALS[0].dur, the banner leaving his paw at SPECIALS[0].pop): the
// squash, the banner raised high, driven down into the floor, the proud hold with the scepter up.
const PLANT = SPECIALS[0] || { dur: 0.8, pop: 0.45, recall: 0.8, warp: 0.55 };
function kingPlant(a, pick) {
  const t = a.actT ?? 0, pop = PLANT.pop ?? 0.45;
  if (t < 0.15) return pick('kgPlA', 'Angry');
  if (t < pop - 0.05) return pick('kgPlR', 'Open');
  if (t < pop + 0.1) return pick('kgPlD', 'Angry');
  return pick(t > (PLANT.dur ?? 0.8) - 0.1 ? 'kgDec2' : 'kgDec1', 'Proud');
}
// VOLTA AO REINO (a.act 'recall', SPECIALS[0].recall, home at SPECIALS[0].warp): the scepter raised
// while the gold rises round him (king-art.js), a breath held; then the arrival, landing on his
// kingdom's doorstep with the scepter still high, standing proud.
function kingRecall(a, pick) {
  const t = a.actT ?? 0, warp = PLANT.warp ?? 0.55;
  if (t < 0.06) return pick('kgDecA', 'Angry');
  if (t < warp) return pick(Math.floor(t / 0.12) % 2 ? 'kgDec2' : 'kgDec1', t < 0.3 ? 'Open' : 'Blink');
  if (t < warp + 0.1) return pick('kgRcL', 'Open');
  return pick('kgDec1', 'Proud');
}

// Returns { frame, expr, name } for an actor (live or snapshot).
export function frameFor(a, time = 0) {
  const r = baseFrame(a, time);
  return a.type === 4 && a.form === 'dark' && !(a.attack > 0 && DARK_MOVES[a.attackKind]) ? feral(r, a, time) : r;
}

function baseFrame(a, time) {
  const seed = (a.id || 0) * 1.37;
  const blink = (time + seed) % 3.4 < 0.12;
  const pick = (name, expr = blink ? 'Blink' : '') => ({ frame: FRAMES[name], expr, name });
  const t12 = Math.floor((time + seed) * 12);
  const act = a.act;
  if (act === 'ball') return { frame: { ...crouch, spin: Math.floor(a.x / 5) * (a.face || 1) }, expr: 'Angry', name: 'ball', ball: true };
  if (act === 'pounce') return pick('pounce', 'Angry');
  if (act === 'ride') return pick(t12 % 2 ? 'ride1' : 'ride2', 'Angry');
  if (act === 'kickoff') return pick('kickoff', 'Angry');
  // Lola between two places: the skip pose (the renderer hides her).
  if (act === 'blink') return pick('lSkA', 'Angry');
  if (act === 'world') return worldFrame(a, pick);
  if (act === 'plant' && a.type === 0 && !(a.hitstun > 0)) return kingPlant(a, pick);
  if (act === 'recall' && a.type === 0 && !(a.hitstun > 0)) return kingRecall(a, pick);
  if (act === 'bite') return pick('bite', 'Open');
  if (act === 'shake') return pick(Math.floor(time * 10) % 2 ? 'shake1' : 'shake2', 'Open');
  if (act === 'toss') return pick('toss', 'Angry');
  if (act === 'requiem') {
    // Cape open as the bubble closes, then a slash pose at every cut, then the drop from above.
    const at = a.actT ?? 0;
    if (a.reqDone) return pick('nScI', 'Open');
    if (at < 0.12) return pick('nKissA2', 'Open');
    return pick(Math.floor((at - 0.12) / 0.085) % 2 ? 'nClawI' : 'nCutX', 'Angry');
  }
  if (act === 'beam') {
    // Condensing (a shiver), the shot, the follow-through; arms angled down from the air.
    const at = a.actT ?? 0, air = a.beamAir ?? !a.ground;
    if (at < 0.08) return pick(air ? 'beamAA' : 'beamA', 'Angry');
    if (at < 0.34) return pick((air ? 'beamCA' : 'beamC') + (t12 % 2), 'Angry');
    return at < 0.5 ? pick(air ? 'beamFA' : 'beamF', 'Open') : pick(air ? 'beamRA' : 'beamR', 'Angry');
  }
  // Nox turning into DARK NOX: curled up and shivering while the blood gathers into him, then arms
  // flung open as he turns; turning back, a breath.
  if (act === 'darkRise') {
    const at = a.actT ?? 0;
    if (at < DARK.pop) return at < 0.12 ? pick('mCurl', 'Pain') : pick(Math.floor(at * 22) % 2 ? 'mShiv1' : 'mShiv2', 'Angry');
    // The pop: the wings burst open, arms flung wide, the roar shuddering through him.
    return pick(at < DARK.pop + 0.08 || Math.floor(at * 16) % 2 ? 'dPop' : 'dPop2', 'Open');
  }
  // Turning back: the far hand up to catch the scythe as it flies home, then his old guard.
  if (act === 'darkFade') return (a.actT ?? 0) < DARK.fade * 0.6 ? pick('dCatch', 'Angry') : pick('nStance2', 'Blink');
  if (act === 'morph') {
    // Curled up, then shivering as she swells (her face going between fury and pain), the pop out
    // as the beast and the roar.
    const at = a.actT ?? 0, k = Math.floor(at * 22);
    if (at < 0.12) return pick('mCurl', 'Pain');
    if (at < 0.6) return pick(k % 2 ? 'mShiv1' : 'mShiv2', k % 4 < 2 ? 'Angry' : 'Pain');
    if (at < 0.68) return pick('mPop', 'Open');
    return pick(Math.floor(at * 14) % 2 ? 'bRoar' : 'bRoar2', 'Open');
  }
  if (act === 'unmorph') {
    // The beast heaving for breath, a puff of steam, and she shakes herself off, small again.
    const at = a.actT ?? 0;
    if (at < 0.32) return pick(Math.floor(at * 8) % 2 ? 'bTired1' : 'bTired2', 'Hurt');
    if (at < 0.46) return pick('mCurl', 'Blink');
    return pick(Math.floor(at * 12) % 2 ? 'jShake1' : 'jShake2', 'Angry');
  }
  if (act === 'charge') return pick((a.actT ?? 0) < 0.2 ? 'bChgA' : Math.floor((a.actT ?? 0) * 10) % 2 ? 'bChg1' : 'bChg2', 'Angry');
  if (act === 'chargeEnd') return pick('bChgHit', 'Open');
  if (act === 'leap') return pick((a.vy ?? 0) < -1.5 ? 'bLeapUp' : 'bLeapDn', 'Open');
  if (act === 'meteor') return pick('bLeapDn', 'Open');
  if (act === 'slamLand') return pick('bLand', 'Open');
  if (act === 'stomp') return pick('stomp', 'Angry');
  if (act === 'chase') return a.type === 0 ? pick('kgLeap', 'Angry') : pick('chase', 'Angry');
  if (a.frozen > 0) return pick('hurt', 'Hurt');
  // Reeling from a hit beats everything else; launched hard, it tumbles instead.
  if (a.hitstun > 0 && !a.climbing && !(a.dodge > 0)) {
    if (!a.ground && a.stun > 0.2) return { frame: { ...FRAMES.tumble, spin: Math.floor((time + seed) * 12) * -(a.face || 1) }, expr: 'Hurt', name: 'tumble' };
    const h = hurtStep(a);
    return pick(h.name, h.expr);
  }
  if (a.dodge > 0 && a.dodgeKind === 'roll') return { frame: { ...crouch, spin: Math.floor(time * 16) * (a.face || 1) }, expr: 'Hurt', name: 'roll' };
  if (a.dodge > 0 && a.dodgeKind === 'airdash') return pick('airdash', 'Angry');
  if (a.parry > 0 || a.parryLag > 0.12) return pick('parry', 'Angry');
  const kind = a.attackKind;
  const wmv = MOVES[kind];
  if (a.attack > 0 && kind === 'nAirVortex') {
    const p = 1 - a.attack / MOVES.nAirVortex.dur;
    if (p < 0.15) return pick('nVxA', 'Angry');
    if (p > 0.86) return pick('vortex', 'Angry');
    return { frame: { ...FRAMES.vortex, spin: Math.floor((time + seed) * 18) * (a.face || 1) }, expr: 'Angry', name: 'vortex' };
  }
  if (a.attack > 0 && kind === 'scytheSpin') {
    const p = 1 - a.attack / MOVES.scytheSpin.dur;
    if (p >= 0.22 && p < 0.78) return { frame: { ...FRAMES.spinS, spin: Math.floor((time + seed) * 14) * (a.face || 1) }, expr: 'Angry', name: 'spinS' };
  }
  if (a.attack > 0 && kind === 'jFlurry') {
    const p = 1 - a.attack / MOVES.jFlurry.dur;
    if (p < 0.14) return pick('jSwA', 'Angry');
    if (p > 0.86) return pick('jSwR', 'Angry');
    return pick(['jFlA', 'jFlB', 'jFlC', 'jFlD'][Math.floor((time + seed) * 30) % 4], Math.floor((time + seed) * 15) % 2 ? 'Open' : 'Angry');
  }
  if (a.attack > 0 && kind === 'lDance') {
    const p = 1 - a.attack / MOVES.lDance.dur;
    if (p < 0.12) return pick('lCaA', 'Angry');
    if (p > 0.86) return pick('lStance1', 'Angry');
    return pick(['lDnA', 'lDnB', 'lDnC', 'lDnD'][Math.floor((time + seed) * 30) % 4], Math.floor((time + seed) * 15) % 2 ? 'Open' : 'Angry');
  }
  // The ring: a quick wheel round the rival laying knives, then arms flung open, fans out.
  if (a.attack > 0 && kind === 'lAirRing') {
    const p = 1 - a.attack / MOVES.lAirRing.dur;
    if (p < 0.1) return pick('nVxA', 'Angry');
    if (p > 0.58) return pick(p > 0.85 ? 'lAppear' : 'wPose', p > 0.85 ? 'Angry' : 'Open');
    return { frame: { ...FRAMES.jSpin, spin: Math.floor((time + seed) * 20) * (a.face || 1) }, expr: 'Angry', name: 'jSpin' };
  }
  if (a.attack > 0 && (kind === 'jAirSpin' || kind === 'lAirSpin')) {
    const p = 1 - a.attack / MOVES[kind].dur;
    if (p < 0.12) return pick('nVxA', 'Angry');
    if (p > 0.88) return pick('vortex', 'Angry');
    return { frame: { ...FRAMES.jSpin, spin: Math.floor((time + seed) * 20) * (a.face || 1) }, expr: 'Angry', name: 'jSpin' };
  }
  if (a.attack > 0 && DARK_MOVES[kind]) return darkAttack(a, kind, time, pick);
  if (a.attack > 0 && a.type === 0 && wmv?.order && KEYS[kind]) return kingOrder(a, kind, pick);
  if (a.attack > 0 && KEYS[kind] && MOVES[kind] && !wmv.order && (a.type === 4 || kind !== 'dashAtk')) {
    const [, name, expr] = keyFor(kind, Math.max(0, Math.min(0.999, 1 - a.attack / MOVES[kind].dur)));
    return pick(name, expr);
  }
  if (a.attack > 0 && wmv?.anim) return weaponFrame(wmv, Math.max(0, Math.min(0.999, 1 - a.attack / wmv.dur)), seed, time);
  if (a.attack > 0 && STRIKES[kind]) {
    const dur = MOVES[kind]?.dur || WEAPON_TIME[kind] || 0.3;
    const p = Math.max(0, Math.min(0.999, 1 - a.attack / dur));
    const [names, expr] = BY_TYPE[kind]?.[a.type] || STRIKES[kind];
    return pick(names[Math.floor(p * 3)], expr);
  }
  // Launched and still reeling: tumble head over heels.
  if (!a.ground && a.stun > 0.2 && !a.climbing) return { frame: { ...FRAMES.tumble, spin: Math.floor((time + seed) * 12) * -(a.face || 1) }, expr: 'Hurt', name: 'tumble' };
  const gun = a.weapon === 'pistol' || a.weapon === 'shotgun' || a.weapon === 'extinguisher';
  if (act === 'carry' || (a.holding && !gun)) return pick('carry', blink ? 'Blink' : '');
  if (a.climbing) return pick(Math.floor((a.y || 0) / 10) % 2 ? 'climb1' : 'climb2');
  let base;
  const king = a.type === 0;
  if (a.stun > 0.25) base = pick(Math.floor(time * 4) % 2 ? 'dizzy' : 'hurt', 'Hurt');
  else if (a.hurt > 0.06) base = pick('hurt', 'Hurt');
  else if (a.getup > 0) base = pick('crouch');
  else if (!a.ground) base = a.gliding ? pick('glide') : king ? pick((a.vy ?? 0) < -1 ? 'kgJump' : 'kgFall') : pick((a.vy ?? 0) < -1 ? 'jump' : 'fall');
  else if (a.crouch) base = pick('crouch');
  else if (a.landImpact > 5) base = pick(king ? 'kgLand' : 'land');
  else if (a.skid > 0) base = pick('skid');
  else if (Math.abs(a.vx || 0) > 0.6) {
    const rate = Math.min(1.4, 0.55 + Math.abs(a.vx) / 6);
    // The King walks at a stately pace and only breaks into his long stride at speed.
    if (king) base = Math.abs(a.vx) < 3 ? pick(KING_WALK[Math.floor((time + seed) * 7 * rate) % 4], blink ? 'Blink' : 'Proud') : pick(KING_RUN[Math.floor((time + seed) * 10 * rate) % 4]);
    else base = pick(['run1', 'runPass', 'run2', 'runPass2'][Math.floor((time + seed) * 12 * rate) % 4]);
  } else if (king) {
    // A slow royal breath, looking down his nose at them, the tail swaying lazily behind him.
    base = pick(Math.floor((time + seed) * 1.1) % 2 ? 'kgIdle2' : 'kgIdle1', blink ? 'Blink' : 'Proud');
    base = { ...base, frame: { ...base.frame, tailDeg: Math.round(Math.sin((time + seed) * 0.9) * 3) * 3 } };
  } else {
    const breath = Math.floor((time + seed) * 1.6) % 2;
    // Nox never stands neutral: low, claws up, leaning toward the fight.
    base = a.type === 4 ? pick(breath ? 'nStance2' : 'nStance1', blink ? 'Blink' : 'Angry')
      : a.type === 2 ? pick(breath ? 'lStance2' : 'lStance1')
      : a.type === 3 ? (a.form === 'beast' ? pick(breath ? 'bStance2' : 'bStance1', blink ? 'Blink' : 'Angry') : pick(breath ? 'jStance2' : 'jStance1'))
      : pick(breath ? 'idle2' : 'idle');
    base = { ...base, frame: { ...base.frame, tailDeg: Math.round(Math.sin((time + seed) * 1.7) * 2) * 3 } };
  }
  if (gun) base = { ...base, frame: { ...base.frame, armF: aimArm(a, (a.recoil || 0) > 0.3) }, name: base.name + '+aim' };
  return base;
}
