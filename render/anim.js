// Frame-based animation for the pixel fighters. A frame gives each slot [dx, dy, degrees]
// (clockwise) relative to the rest pose, plus tail and whole-figure spin. The frame is picked
// from observable actor state only, so the host simulation (hit location, ragdoll start pose)
// and every remote renderer agree without sending poses over the network.
import { MOVES } from '../sim/moves.js';
import { styleOf } from '../sim/fighters.js';

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
  // Lola
  kick0: { ...crouch, footF: [-1, -1] },
  kick1: { head: [-2, 0], body: [-1, -1], armF: [-1, -1, 40], armB: [-2, -1, 40], footF: [5, -3, -90], footB: [4, -2, -90] },
  kick2: { head: [-2, 1], body: [-1, -1], armF: [-1, -1, 60], armB: [-2, -1, 60], footF: [6, -4, -90], footB: [5, -3, -90] },
  sky: { head: [0, -2], body: [0, -1], armF: [0, -2, -170], armB: [0, -2, 170], footF: [0, 1], footB: [-1, 1] },
  slam: { head: [0, 1], armF: [0, -2, -150], armB: [0, -2, 150], footF: [1, 0], footB: [-1, 0] },
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
  // Juma, small, more: the cross (two claws crossing as she lunges through) and the frenzy (a flat
  // dash, then a blur of slashing poses as she goes back and forth through the rival).
  jCrA: { head: [-1, 2, 11.25], body: [-1, 1], armF: [-2, -2, 150], armB: [-3, 0, 120], footF: [3, 0], footB: [-3, 0], tailDeg: -18 },
  jCrX: { head: [3, 1, 22.5], body: [3, 1], armF: [5, -2, -150], armB: [4, 2, -40], footF: [5, 0], footB: [-4, -1, 33.75], tailDeg: 22 },
  jCrI: { head: [4, 2, 22.5], body: [3, 1], armF: [6, 2, -30], armB: [5, -2, -140], footF: [5, 0], footB: [-4, 0, 22.5], front: 'armB', tailDeg: 26 },
  jFrz1: { head: [3, 1, 22.5], body: [2, 0], armF: [5, -1, -120], armB: [-3, 0, 60], footF: [-2, -1, 50], footB: [-4, -1, 60], tailDeg: 30 },
  jFrz2: { head: [2, -1, -11.25], body: [1, -1], armF: [4, -3, -160], armB: [3, 1, -40], footF: [2, -2], footB: [-2, -1], front: 'armB', tailDeg: -24 },
  // The beast's clap: paws flung out wide, then swung in and slammed together on the rival.
  bClA: { head: [-1, 0, -11.25], body: [-1, 0], armF: [6, -6, -150], armB: [-7, -6, 140], footF: [3, 0], footB: [-3, 0], tailDeg: -16 },
  bClX: { head: [2, 0, 11.25], body: [1, 0], armF: [7, -4, -100], armB: [4, -5, -70], footF: [4, 0], footB: [-3, 0], tailDeg: 8 },
  bClI: { head: [3, 1, 22.5], body: [2, 1], armF: [8, -3, -90], armB: [7, -3, -90], footF: [4, 0], footB: [-4, 0], tailDeg: 18 },
  bAcA: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-5, -4, 130], armB: [3, -2, -80], footF: [1, -2], footB: [-1, -1], tailDeg: -18 },
  bAcI: { head: [3, 0, 11.25], body: [2, 0], armF: [8, -2, -90], armB: [-3, -2, 70], footF: [1, -2], footB: [-1, -1], tailDeg: 20 },
  bAcA2: { head: [2, 0], body: [1, 0], armB: [-4, -5, 140], armF: [5, 0, -40], footF: [1, -2], footB: [-1, -1], tailDeg: -10 },
  bAcI2: { head: [3, 1, 22.5], body: [2, 1], armB: [8, -1, -70], armF: [3, 1, 20], footF: [1, -2], footB: [-1, -1], front: 'armB', tailDeg: 22 },
  // Juma, the titan. A gorilla's stance: hunched behind the hump, knuckles low, swaying with each
  // heavy breath; a knuckle-walk at a run.
  tStance1: { head: [0, 1], armF: [3, 1, -25], armB: [-1, 0, 20], footF: [1, 0], footB: [-1, 0], tailDeg: 6 },
  tStance2: { head: [0, 2], body: [0, 1], armF: [3, 2, -25], armB: [-1, 1, 20], footF: [1, 0], footB: [-1, 0], tailDeg: 10 },
  tRun1: { head: [1, 1, 11.25], body: [1, 0], armF: [4, 0, -50], armB: [-3, 0, 40], footF: [3, 0], footB: [-3, -1], tailDeg: 10 },
  tRunP: { head: [1, 0, 11.25], body: [1, -1], armF: [2, -1, -20], armB: [-1, -1, 10], footF: [0, -1], footB: [0, 0], tailDeg: 4 },
  tRun2: { head: [1, 1, 11.25], body: [1, 0], armF: [0, 0, 15], armB: [2, 0, -40], footF: [-2, -1], footB: [3, 0], tailDeg: -6 },
  // The hook: the paw drawn all the way back past the hump, then one sweep across.
  tHkA1: { head: [-1, 0, -11.25], body: [-1, 0], armF: [-6, -2, 100], armB: [2, 0, -50], footF: [2, 0], footB: [-2, 0], tailDeg: -14 },
  tHkA2: { head: [-2, 1, -22.5], body: [-2, 1], armF: [-6, -2, 120], armB: [3, 1, -60], footF: [3, 0], footB: [-2, 0], tailDeg: -22 },
  tHkX: { head: [2, 0, 11.25], body: [2, 0], armF: [4, -2, -110], armB: [-2, 0, 40], footF: [3, 0], footB: [-3, -1, 22.5], tailDeg: 12 },
  tHkI: { head: [4, 1, 22.5], body: [3, 1], armF: [6, -1, -85], armB: [-4, 0, 50], footF: [4, 0], footB: [-4, 0], tailDeg: 22 },
  tHkF: { head: [3, 1, 11.25], body: [2, 1], armF: [5, -2, -150], armB: [-3, 0, 40], footF: [4, 0], footB: [-4, 0], tailDeg: 16 },
  tR: { head: [1, 1], body: [0, 1], armF: [3, 1, -30], armB: [-1, 1, 20], footF: [2, 0], footB: [-2, 0], tailDeg: 8 },
  // The smash: both fists raised high over the hump, held, then brought down into the floor.
  tSmA1: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-2, -2, 170], armB: [-4, -1, -175], footF: [2, 0], footB: [-2, 0], tailDeg: -16 },
  tSmA2: { head: [-2, -1, -22.5], body: [-2, -2], armF: [-3, -3, 175], armB: [-5, -2, -170], footF: [2, -1], footB: [-2, 0], tailDeg: -26 },
  tSmX: { head: [2, 0, 11.25], body: [1, 0], armF: [4, -3, -130], armB: [2, -2, -120], footF: [3, 0], footB: [-3, 0], tailDeg: 6 },
  tSmI: { head: [4, 4, 33.75], body: [2, 3], armF: [7, 3, -40], armB: [5, 3, -30], footF: [4, 0], footB: [-4, 0], tailDeg: 22 },
  tSmF: { head: [3, 4, 22.5], body: [2, 3], armF: [7, 4, -15], armB: [5, 4, -5], footF: [4, 0], footB: [-4, 0], tailDeg: 14 },
  // The uppercut: down into a crouch, then the whole mass uncoiling upward behind the fist.
  tUpA1: { head: [0, 3, 11.25], body: [0, 2], armF: [-1, 3, 40], armB: [-2, 2, 20], footF: [4, 0], footB: [-4, 0], tailDeg: -10 },
  tUpA2: { head: [-1, 5, 22.5], body: [-1, 4], armF: [-2, 4, 60], armB: [-3, 3, 30], footF: [4, 0], footB: [-4, 0], tailDeg: -20 },
  tUpX: { head: [2, -2, -11.25], body: [1, -2], armF: [4, -3, -165], armB: [-2, -1, 40], footF: [2, -1], footB: [-2, 0], tailDeg: 14 },
  tUpI: { head: [2, -4, -22.5], body: [1, -4], armF: [3, -5, 180], armB: [-3, -2, 50], footF: [1, -3], footB: [-2, -2, 22.5], tailDeg: 24 },
  tUpF: { head: [1, -1, -11.25], body: [0, -1], armF: [3, -3, -170], armB: [-1, 0, 30], footF: [2, 0], footB: [-2, 0], tailDeg: 12 },
  // The cataclysm: up on the toes with both fists high, then down into the floor on both sides.
  tQkA: { head: [0, -2, -22.5], body: [0, -3], armF: [0, -4, 175], armB: [-3, -3, -175], footF: [2, -1], footB: [-2, -1], tailDeg: -24 },
  tQkI: { head: [2, 6, 33.75], body: [1, 4], armF: [7, 5, -20], armB: [-4, 5, 20], footF: [5, 0], footB: [-5, 0], tailDeg: 26 },
  // Pounding a downed rival: one fist and then the other hammered down.
  tPdA: { head: [1, -1, -11.25], body: [0, -1], armF: [1, -4, 175], armB: [2, 1, -40], footF: [3, 0], footB: [-3, 0], tailDeg: -14 },
  tPdI: { head: [3, 5, 33.75], body: [2, 4], armF: [8, 5, -25], armB: [3, 2, -50], footF: [4, 0], footB: [-4, 0], tailDeg: 22 },
  tPdA2: { head: [1, -1, -11.25], body: [0, -1], armB: [-2, -3, 175], armF: [5, 2, -40], footF: [3, 0], footB: [-3, 0], tailDeg: -14 },
  tPdI2: { head: [3, 5, 33.75], body: [2, 4], armB: [7, 5, -25], armF: [5, 3, -40], footF: [4, 0], footB: [-4, 0], front: 'armB', tailDeg: 22 },
  // In the air: a backhand that sweeps all around, and both fists hammered down.
  tAcA: { head: [-1, -1, -11.25], body: [-1, -1], armF: [-5, -2, 110], armB: [3, -2, -70], footF: [1, -2], footB: [-1, -2], tailDeg: -18 },
  tAcI: { head: [3, 0, 11.25], body: [2, 0], armF: [6, -1, -90], armB: [-4, -2, 70], footF: [1, -2], footB: [-1, -2], tailDeg: 22 },
  tAsA: { head: [-1, -2, -22.5], body: [-1, -2], armF: [-2, -4, 170], armB: [-4, -3, 175], footF: [1, -3], footB: [-1, -3], tailDeg: -22 },
  tAsI: { head: [3, 3, 33.75], body: [2, 2], armF: [7, 4, -20], armB: [5, 4, -15], footF: [1, -2], footB: [-1, -2], tailDeg: 24 },
  // The thunderclap: arms flung wide, then slammed together straight ahead.
  tClA: { head: [-1, -2, -22.5], body: [-1, -1], armF: [6, -3, -140], armB: [-6, -2, 135], footF: [3, 0], footB: [-3, 0], tailDeg: -22 },
  tClI: { head: [4, 0, 11.25], body: [3, 0], armF: [7, -2, -90], armB: [6, -2, -90], footF: [5, 0], footB: [-4, 0], tailDeg: 22 },
  // The crushing grab: the rival held up over her head, then driven into the floor ahead or behind.
  tGrUp: { head: [0, -1, -22.5], body: [0, -1], armF: [1, -4, 180], armB: [-4, -2, 40], footF: [3, 0], footB: [-3, 0], tailDeg: -12 },
  tGrF: { head: [4, 4, 33.75], body: [3, 3], armF: [8, 4, -40], armB: [-4, 1, 40], footF: [5, 0], footB: [-4, 0], tailDeg: 24 },
  tGrB: { head: [-2, 3, -11.25], body: [-2, 2], armF: [-6, 4, 50], armB: [-4, 1, 40], footF: [3, 0], footB: [-5, 0], tailDeg: -20 },
  // The stampede: head down behind the hump, shoulder first, fists pounding the floor.
  tChgA: { head: [-1, 4, 22.5], body: [-1, 3], armF: [-1, 3, 30], armB: [-3, 3, 40], footF: [4, 0], footB: [-4, 0], tailDeg: -18 },
  tChg1: { head: [4, 4, 33.75], body: [3, 3], armF: [5, 3, -70], armB: [2, 1, 40], footF: [4, 0], footB: [-3, -1], tailDeg: 20 },
  tChg2: { head: [4, 3, 33.75], body: [3, 2], armF: [3, 3, -10], armB: [6, 2, -60], footF: [-2, -1], footB: [3, 0], tailDeg: 14 },
  tChgHit: { head: [5, 2, 22.5], body: [4, 2], armF: [7, -1, -100], armB: [5, -1, -110], footF: [5, 0], footB: [-5, 0], tailDeg: 24 },
  // Her roar, arms flung up and wide, jaws open on the sky.
  tRoar: { head: [1, -3, -33.75], body: [0, -2], armF: [6, -3, -140], armB: [-6, -3, 140], footF: [5, 0], footB: [-5, 0], tailDeg: -26 },
  tRoar2: { head: [1, -4, -45], body: [0, -2], armF: [6, -4, -150], armB: [-6, -4, 150], footF: [5, 0], footB: [-5, 0], tailDeg: -30 },
  // Her hero pose on the select screen: hunched low, one fist cocked high, glaring from under the brow.
  tHero1: { head: [2, 2, 22.5], body: [1, 1], armF: [5, -2, -160], armB: [-2, 1, 30], footF: [3, 0], footB: [-3, 0], tailDeg: 8 },
  tHero2: { head: [2, 3, 22.5], body: [1, 2], armF: [5, -1, -160], armB: [-2, 2, 30], footF: [3, 0], footB: [-3, 0], tailDeg: 14 },
  // Swelling into the titan: crouched, both fists on the floor, the body heaving.
  mHeave1: { head: [1, 4, 33.75], body: [0, 3], armF: [5, 3, -20], armB: [-4, 3, 20], footF: [4, 0], footB: [-4, 0], tailDeg: 24 },
  mHeave2: { head: [0, 3, 22.5], body: [0, 2], armF: [6, 2, -30], armB: [-5, 2, 30], footF: [4, 0], footB: [-4, 0], tailDeg: -20 },
  // Lola's quick kicks and the rocket kick that launches
  kickA0: { footF: [-1, -1], body: [-1, 0], head: [-1, 0] },
  kickA1: { footF: [4, -3, -90], head: [-1, 0], armF: [-1, -1, 40], armB: [-1, -1, 40] },
  kickA2: { footF: [3, -2, -60], head: [-1, 0] },
  kickB0: { footB: [-1, -1], body: [-1, 0] },
  kickB1: { footB: [5, -4, -100], head: [-1, 0], armF: [0, -1, 50], front: 'footB' },
  kickB2: { footB: [3, -2, -60], front: 'footB' },
  hopkick0: { ...crouch, footF: [0, 0] },
  hopkick1: { footF: [3, -9, -170], body: [0, -2], head: [-1, -1], armF: [-1, 0, 60], armB: [-1, 0, 60] },
  hopkick2: { footF: [2, -6, -140], body: [0, -1], head: [0, -1] },
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
  airKick0: { footF: [0, -2, 30], footB: [-1, -1], body: [-1, 0], head: [-1, 0] },
  airKick1: { footF: [5, -3, -90], footB: [-1, -2], head: [-1, 0], armF: [-1, -1, 60] },
  airWhip0: { footF: [1, -2], footB: [-1, -1], tail: [[1, 0], [-1, -3], [-2, -7], [0, -11], [3, -13]] },
  airWhip1: { footF: [1, -2], footB: [-1, -1], head: [1, 0], tail: [[1, 0], [3, -1], [8, -1], [13, 0], [17, 1]] },
  airB0: { footF: [1, -2], footB: [-1, -2], armF: [0, -1, -120] },
  airB1: { footF: [3, -2, -90], footB: [-1, -2], spin: 1 },
  airB2: { footF: [3, -2, -90], spin: 2 },
  spike0: { armF: [0, -3, 180], armB: [0, -3, 180], head: [0, -1], footF: [1, -2], footB: [-1, -1], tailDeg: -20 },
  spike1: { armF: [3, 2, -20], armB: [3, 2, -30], head: [2, 1], body: [1, 0], footF: [0, -1], front: 'armF', tailDeg: 20 },
  axe0: { footF: [2, -9, -175], body: [0, -1], head: [-1, 0], armF: [-1, 0, 60] },
  axe1: { footF: [4, -1, -40], head: [1, 1], body: [1, 0] },
  // Dash strikes out of a dodge
  dashAtk: { armF: [3, 0, -90], armB: [2, -1, -100], head: [2, 0], body: [1, 0], footF: [-2, 0, 30], footB: [-3, -1, 40], tailDeg: 20 },
  dashKick: { footF: [5, -3, -90], footB: [4, -2, -80], body: [-1, -1], head: [-2, 0], armF: [-1, -1, 60] },
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
  hurtA1: { head: [-1, 0, -11.25], body: [0, 0], armF: [0, -1, -120], armB: [-1, -1, 110], footF: [1, -1, -11.25], footB: [0, -2], tailDeg: 20 },
  // Don, the frog. He stands like a boss: low and wide, one fist out, the other on his gut. His
  // blows are all body: the whole head swings into a slap, the throat sac drives the croak.
  fStance1: { head: [1, 1], body: [0, 1], armF: [2, 0, -60], armB: [1, -1, -100], footF: [4, 0], footB: [-4, 0] },
  fStance2: { head: [1, 2], body: [0, 2], armF: [2, 1, -60], armB: [1, 0, -100], footF: [4, 0], footB: [-4, 0] },
  fSlA: { head: [-1, 1, -11.25], body: [-1, 1], armF: [-2, -1, 125], armB: [1, 0, -40], footF: [4, 0], footB: [-3, 0], tailDeg: -10 },
  fSlX: { head: [2, 0, 11.25], body: [2, 0], armF: [4, -1, -100], armB: [-1, 0, 40], footF: [4, 0], footB: [-3, -1, 22.5], tailDeg: 10 },
  fSlI: { head: [3, 1, 11.25], body: [2, 1], armF: [5, 1, -60], armB: [-1, 0, 50], footF: [4, 0], footB: [-3, 0], tailDeg: 14 },
  fSlR: { head: [1, 1], body: [1, 1], armF: [2, 1, -50], armB: [0, 0, -60], footF: [4, 0], footB: [-3, 0] },
  fSl2A: { head: [-1, 1, -11.25], body: [-1, 1], armB: [-2, -1, 130], armF: [2, 0, 30], footF: [4, 0], footB: [-3, 0], tailDeg: -10 },
  fSl2X: { head: [2, 0, 11.25], body: [2, 0], armB: [5, -1, -100], armF: [-1, 0, 40], footF: [4, 0], footB: [-3, -1, 22.5], front: 'armB', tailDeg: 10 },
  fSl2I: { head: [3, 1, 11.25], body: [2, 1], armB: [6, 1, -60], armF: [-1, 0, 50], footF: [4, 0], footB: [-3, 0], front: 'armB', tailDeg: 14 },
  fLhA: { head: [-2, 1, -11.25], body: [-1, 1], armF: [0, 1, 20], armB: [0, 0, 20], footF: [4, 0], footB: [-3, 0], tailDeg: -10 },
  fLhX: { head: [3, 0], body: [2, 0], armF: [2, 0, -40], armB: [1, 0, -20], footF: [5, 0], footB: [-3, -1, 22.5], tailDeg: 12 },
  fLhR: { head: [1, 1], body: [1, 1], armF: [1, 1, -30], armB: [0, 0, -40], footF: [4, 0], footB: [-3, 0] },
  fBpA1: { head: [-2, 2, -11.25], body: [-2, 1], armF: [-4, -3, 150], armB: [2, 0, -50], footF: [4, 0], footB: [-4, 0], tailDeg: -16 },
  fBpA2: { head: [-3, 2, -22.5], body: [-3, 1], armF: [-5, -4, 170], armB: [2, 0, -60], footF: [4, 0], footB: [-4, 0], tailDeg: -20 },
  fBpX: { head: [3, -1, 11.25], body: [3, -1], armF: [7, -3, -110], armB: [-2, 0, 60], footF: [5, 0], footB: [-4, -2, 33.75], tailDeg: 18 },
  fBpI: { head: [4, 1, 22.5], body: [3, 1], armF: [8, 0, -75], armB: [-2, 0, 70], footF: [5, 0], footB: [-4, -1, 22.5], tailDeg: 22 },
  fBpF: { head: [3, 2, 11.25], body: [2, 2], armF: [6, 2, -30], armB: [-1, 0, 40], footF: [5, 0], footB: [-4, 0], tailDeg: 12 },
  fSpA: { head: [0, 4], body: [0, 3], armF: [1, 2, 40], armB: [-1, 2, 50], footF: [3, 0], footB: [-3, 0], tailDeg: -18 },
  fSpX: { head: [1, -3, -11.25], body: [1, -3], armF: [0, -3, -160], armB: [0, -3, 160], footF: [5, -6, -90], footB: [2, -4, -45], tailDeg: 20 },
  fSpI: { head: [1, -4, -22.5], body: [1, -4], armF: [1, -4, -170], armB: [-1, -4, 170], footF: [5, -8, -112.5], footB: [3, -5, -67.5], tailDeg: 24 },
  fGrA: { head: [-2, 1, -11.25], body: [-1, 1], armF: [-1, 0, 40], armB: [0, 0, 30], footF: [4, 0], footB: [-3, 0], tailDeg: -12 },
  fGrX: { head: [3, 0], body: [2, 0], armF: [1, 0, -30], armB: [0, 0, -20], footF: [5, 0], footB: [-3, -1, 22.5], tailDeg: 10 },
  fGrK: { head: [2, -2, -11.25], body: [2, -2], armF: [-2, -2, 70], armB: [-3, -2, 60], footF: [6, -5, -90], footB: [4, -4, -78.75], tailDeg: 22 },
  fGrI: { head: [3, -1, 11.25], body: [3, -1], armF: [-2, -1, 80], armB: [-3, -1, 70], footF: [7, -4, -78.75], footB: [5, -3, -67.5], tailDeg: 24 },
  fCrA: { head: [-1, 3, -11.25], body: [0, 2], armF: [3, 1, -70], armB: [-3, 1, 70], footF: [4, 0], footB: [-4, 0], tailDeg: -14 },
  fCrX: { head: [0, -2, -22.5], body: [0, -1], armF: [4, -2, -130], armB: [-4, -2, 130], footF: [5, 0], footB: [-5, 0], tailDeg: 16 },
  fCrR: { head: [0, 1], body: [0, 1], armF: [2, 0, -70], armB: [-1, 0, 50], footF: [4, 0], footB: [-4, 0] },
  fSqA: { head: [0, -3, -11.25], body: [0, -3], armF: [2, -4, -160], armB: [-2, -4, 160], footF: [3, -4], footB: [-3, -4], tailDeg: -18 },
  fSqI: { head: [2, 4, 11.25], body: [0, 3], armF: [5, 2, -90], armB: [-5, 2, 90], footF: [6, 0, -22.5], footB: [-6, 0, 22.5], tailDeg: 26 },
  fAsA: { head: [-1, 0, -11.25], body: [-1, 0], armF: [-2, -2, 135], armB: [1, -1, -60], footF: [2, -2], footB: [-2, -2], tailDeg: -12 },
  fAsX: { head: [2, 0, 11.25], body: [1, 0], armF: [4, -1, -95], armB: [-1, -1, 50], footF: [2, -2], footB: [-2, -2], tailDeg: 10 },
  fAs2X: { head: [2, 0, 11.25], body: [1, 0], armB: [5, -1, -95], armF: [-1, -1, 50], footF: [2, -2], footB: [-2, -2], front: 'armB', tailDeg: 10 },
  fAlX: { head: [3, 0, 11.25], body: [1, 0], armF: [0, -1, 40], armB: [-1, -1, 30], footF: [1, -3], footB: [-2, -3], tailDeg: 14 },
  fStA: { head: [0, -1], body: [0, -1], armF: [1, -3, -150], armB: [-1, -3, 150], footF: [2, -5], footB: [-2, -5], tailDeg: -16 },
  fStI: { head: [0, -1, 11.25], body: [0, 0], armF: [2, -3, -170], armB: [-2, -3, 170], footF: [1, 3], footB: [-1, 3], tailDeg: 20 },
  // The boss pose on the select screen: planted wide, one fist out, the other hand on his gut.
  fHero1: { head: [2, 1, 11.25], body: [1, 1], armF: [5, -1, -95], armB: [1, 0, -150], footF: [5, 0], footB: [-4, 0] },
  fHero2: { head: [2, 2, 11.25], body: [1, 2], armF: [5, 0, -95], armB: [1, 1, -150], footF: [5, 0], footB: [-4, 0] },
  fBall: { head: [0, 3], body: [0, 2], armF: [1, 1, 30], armB: [-1, 1, 40], footF: [2, -2], footB: [-2, -2] },
  // Breathing in like a vacuum: leaning back on wide feet, arms thrown wide, jaws gaping.
  fInh1: { head: [-2, 0, -11.25], body: [-1, 0], armF: [3, -2, -140], armB: [-2, -2, 150], footF: [5, 0], footB: [-4, 0], tailDeg: -20 },
  fInh2: { head: [-2, 1, -11.25], body: [-1, 1], armF: [3, -1, -130], armB: [-2, -1, 140], footF: [5, 0], footB: [-4, 0], tailDeg: -16 },
  // The gulp: head thrown up as it goes down, then the whole body squashed around the lump.
  fGulp1: { head: [0, -2, -22.5], body: [0, -1], armF: [2, -2, -160], armB: [-2, -2, 160], footF: [3, 0], footB: [-3, 0], tailDeg: 10 },
  fGulp2: { head: [1, 3], body: [0, 2], armF: [4, 1, -80], armB: [-3, 1, 80], footF: [5, 0], footB: [-5, 0], tailDeg: -6 },
  fSpitA: { head: [-3, 2, -22.5], body: [-2, 1], armF: [0, 1, 60], armB: [-1, 0, 70], footF: [4, 0], footB: [-4, 0], tailDeg: -18 },
  fSpitX: { head: [4, 0, 11.25], body: [2, 0], armF: [-1, 0, 50], armB: [-2, 0, 60], footF: [5, 0], footB: [-4, -1, 22.5], tailDeg: 18 }
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
  kickA: [['kickA0', 'kickA1', 'kickA2'], 'Angry'],
  kickB: [['kickB0', 'kickB1', 'kickB2'], 'Angry'],
  hopkick: [['hopkick0', 'hopkick1', 'hopkick2'], 'Angry'],
  kick: [['kick0', 'kick1', 'kick2'], 'Angry'],
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
  jCross: [[0, 'jCrA', 'Angry'], [0.28, 'jCrX', 'Open'], [0.5, 'jCrI', 'Angry'], [0.86, 'jSwR', '']],
  bClap: [[0, 'bClA', 'Angry'], [0.3, 'bClA', 'Open'], [0.44, 'bClX', 'Open'], [0.5, 'bClI', 'Open'], [0.8, 'bSlR', '']],
  bAirClaw: [[0, 'bAcA', 'Angry'], [0.24, 'bAcI', 'Open'], [0.46, 'bAcA2', 'Angry'], [0.56, 'bAcI2', 'Open']],
  // The titan: wind-ups held even longer, and impact poses that sink into the floor.
  tHook: [[0, 'tHkA1', 'Angry'], [0.2, 'tHkA2', 'Angry'], [0.42, 'tHkX', 'Open'], [0.5, 'tHkI', 'Open'], [0.72, 'tHkF', 'Angry'], [0.9, 'tR', '']],
  tSmash: [[0, 'tSmA1', 'Angry'], [0.18, 'tSmA2', 'Open'], [0.42, 'tSmX', 'Open'], [0.5, 'tSmI', 'Open'], [0.72, 'tSmF', 'Angry'], [0.9, 'tR', '']],
  tUpper: [[0, 'tUpA1', 'Angry'], [0.2, 'tUpA2', 'Angry'], [0.38, 'tUpX', 'Open'], [0.46, 'tUpI', 'Open'], [0.72, 'tUpF', 'Angry'], [0.9, 'tR', '']],
  tQuake: [[0, 'tQkA', 'Angry'], [0.3, 'tQkA', 'Open'], [0.44, 'tSmX', 'Open'], [0.5, 'tQkI', 'Open'], [0.82, 'tSmF', 'Angry'], [0.94, 'tR', '']],
  tPound: [[0, 'tPdA', 'Angry'], [0.24, 'tPdI', 'Open'], [0.38, 'tPdA2', 'Angry'], [0.5, 'tPdI2', 'Open'], [0.64, 'tPdA', 'Angry'], [0.76, 'tPdI', 'Open'], [0.92, 'tR', '']],
  tAirClaw: [[0, 'tAcA', 'Angry'], [0.36, 'tAcI', 'Open']],
  tAirSmash: [[0, 'tAsA', 'Angry'], [0.32, 'tAsA', 'Open'], [0.42, 'tAsI', 'Open']],
  // The frog: snappy slaps, a tongue that is out and back in a blink, the giant palm held back.
  fSlap: [[0, 'fSlA', 'Angry'], [0.3, 'fSlX', 'Open'], [0.42, 'fSlI', 'Angry'], [0.75, 'fSlR', '']],
  fSlap2: [[0, 'fSl2A', 'Angry'], [0.3, 'fSl2X', 'Open'], [0.44, 'fSl2I', 'Angry'], [0.75, 'fSlR', '']],
  fLash: [[0, 'fLhA', 'Angry'], [0.2, 'fLhX', 'Wide'], [0.62, 'fLhR', 'Angry']],
  fBigPalm: [[0, 'fBpA1', 'Angry'], [0.22, 'fBpA2', 'Angry'], [0.42, 'fBpX', 'Open'], [0.5, 'fBpI', 'Open'], [0.72, 'fBpF', 'Angry'], [0.9, 'fSlR', '']],
  fSpring: [[0, 'fSpA', 'Angry'], [0.36, 'fSpX', 'Open'], [0.46, 'fSpI', 'Open'], [0.8, 'fall', 'Angry']],
  fGrapple: [[0, 'fGrA', 'Angry'], [0.12, 'fGrX', 'Wide'], [0.42, 'fGrK', 'Open'], [0.6, 'fGrI', 'Open'], [0.86, 'fSlR', 'Angry']],
  fCroak: [[0, 'fCrA', 'Puff'], [0.4, 'fCrX', 'Wide'], [0.8, 'fCrR', 'Angry']],
  fSquash: [[0, 'fSqA', 'Angry'], [0.46, 'fSqI', 'Open'], [0.84, 'crouch', 'Angry']],
  fAirSlap: [[0, 'fAsA', 'Angry'], [0.24, 'fAsX', 'Open'], [0.46, 'fAsA', 'Angry'], [0.56, 'fAs2X', 'Open']],
  fAirLash: [[0, 'fAsA', 'Angry'], [0.22, 'fAlX', 'Wide'], [0.7, 'fall', 'Angry']],
  fStomp: [[0, 'fStA', 'Angry'], [0.36, 'fStI', 'Open']]
};
export const keyFor = (kind, p) => { const k = KEYS[kind]; if (!k) return null; let r = k[0]; for (const e of k) if (p >= e[0]) r = e; return r; };

// The shared air and dash moves look different per fighter: kicks, tail, fangs.
const BY_TYPE = {
  airA: { 1: [['airWhip0', 'airWhip1', 'airWhip1'], 'Angry'], 2: [['airKick0', 'airKick1', 'airKick1'], 'Angry'] },
  spike: { 2: [['axe0', 'axe0', 'axe1'], 'Angry'] },
  dashAtk: { 1: [['dashWhip', 'dashWhip', 'dashWhip'], 'Angry'], 2: [['dashKick', 'dashKick', 'dashKick'], 'Angry'] }
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
  // Offsets snap to whole pixels too: thrusts ease the arm out by fractions, and sprites are pixel grids.
  for (const k of ['armF', 'armB']) if (f[k]) f[k] = [Math.round(f[k][0]), Math.round(f[k][1]), snap(f[k][2])];
  if (smear?.cur !== undefined) smear.cur = snap(smear.cur);
  return { frame: f, expr: 'Angry', name: 'w:' + mv.slot, smear };
}


const aimArm = (a, recoil) => {
  const aim = a.aim ?? 0;
  let rel = (a.face || 1) > 0 ? aim : Math.PI - aim;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  rel = Math.max(-1.45, Math.min(1.45, rel));
  return [recoil ? -1 : 0, 0, (rel * 180) / Math.PI - 90];
};

// Returns { frame, expr, name } for an actor (live or snapshot).
export function frameFor(a, time = 0) {
  const seed = (a.id || 0) * 1.37;
  const blink = (time + seed) % 3.4 < 0.12;
  const pick = (name, expr = blink ? 'Blink' : '') => ({ frame: FRAMES[name], expr, name });
  const t12 = Math.floor((time + seed) * 12);
  const act = a.act;
  if (act === 'ball') return { frame: { ...crouch, spin: Math.floor(a.x / 5) * (a.face || 1) }, expr: 'Angry', name: 'ball', ball: true };
  if (act === 'pounce') return pick('pounce', 'Angry');
  if (act === 'ride') return pick(t12 % 2 ? 'ride1' : 'ride2', 'Angry');
  if (act === 'kickoff') return pick('kickoff', 'Angry');
  if (act === 'sky') return pick('sky', 'Angry');
  if (act === 'slam') return pick('slam', 'Angry');
  if (act === 'bite') return pick('bite', 'Open');
  if (act === 'shake') return pick(Math.floor(time * 10) % 2 ? 'shake1' : 'shake2', 'Open');
  if (act === 'toss') return pick(a.form === 'titan' ? 'tHkF' : 'toss', 'Angry');
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
  if (act === 'morph') {
    const at = a.actT ?? 0, k = Math.floor(at * 22);
    if (a.morphTo === 'titan') {
      // Into the titan: the beast curls up, then heaves on all fours faster and faster as she
      // swells, the pop, and the roar of the titan.
      if (at < 0.15) return pick('mCurl', 'Pain');
      if (at < 0.6) return pick(k % 2 ? 'mShiv1' : 'mShiv2', k % 4 < 2 ? 'Angry' : 'Pain');
      if (at < 1.15) return pick(Math.floor(at * 30) % 2 ? 'mHeave1' : 'mHeave2', k % 3 ? 'Open' : 'Pain');
      return pick(Math.floor(at * 12) % 2 ? 'tRoar' : 'tRoar2', 'Open');
    }
    // Curled up, then shivering as she swells (her face going between fury and pain), the pop out
    // as the beast and the roar.
    if (at < 0.12) return pick('mCurl', 'Pain');
    if (at < 0.6) return pick(k % 2 ? 'mShiv1' : 'mShiv2', k % 4 < 2 ? 'Angry' : 'Pain');
    if (at < 0.68) return pick('mPop', 'Open');
    return pick(Math.floor(at * 14) % 2 ? 'bRoar' : 'bRoar2', 'Open');
  }
  if (act === 'frenzy') {
    // A flat dash, then a blur of slashes as she goes through the rival again and again.
    const rip = a.rip ?? (a.frenzy?.prey != null);
    return rip ? pick(Math.floor((a.actT ?? 0) / 0.075) % 2 ? 'jFrz2' : 'jFrz1', 'Open') : pick('jBoX', 'Open');
  }
  if (act === 'clap') { const at = a.actT ?? 0; return at < 0.36 ? pick('tClA', 'Angry') : at < 0.62 ? pick('tClI', 'Open') : pick('tR', 'Angry'); }
  if (act === 'crush') {
    // Overhead, then driven into the floor ahead, behind, and ahead again.
    const at = a.actT ?? 0, i = [0.46, 0.86, 1.26].findIndex(t => at > t - 0.14 && at < t + 0.12);
    return i < 0 ? pick('tGrUp', 'Angry') : pick(i === 1 ? 'tGrB' : 'tGrF', 'Open');
  }
  const titan = a.form === 'titan';
  if (act === 'charge') return pick((a.actT ?? 0) < (titan ? 0.26 : 0.2) ? (titan ? 'tChgA' : 'bChgA') : (Math.floor((a.actT ?? 0) * (titan ? 12 : 10)) % 2 ? (titan ? 'tChg1' : 'bChg1') : (titan ? 'tChg2' : 'bChg2')), 'Angry');
  if (act === 'chargeEnd') return pick(titan ? 'tChgHit' : 'bChgHit', 'Open');
  if (act === 'leap') return pick((a.vy ?? 0) < -1.5 ? 'bLeapUp' : 'bLeapDn', 'Open');
  if (act === 'meteor') return pick(titan ? 'tAsA' : 'bLeapDn', 'Open');
  if (act === 'slamLand') return pick(titan ? 'tQkI' : 'bLand', 'Open');
  if (act === 'stomp') return pick('stomp', 'Angry');
  // The frog's inhale, gulp and spit.
  if (act === 'inhale') return pick(t12 % 2 ? 'fInh1' : 'fInh2', 'Wide');
  if (act === 'gulp') return (a.actT ?? 0) < 0.3 ? pick('fGulp1', 'Puff') : pick('fGulp2', (a.actT ?? 0) < 0.45 ? 'Puff' : 'Blink');
  if (act === 'spit') return (a.actT ?? 0) < 0.12 ? pick('fSpitA', 'Puff') : pick('fSpitX', (a.actT ?? 0) < 0.3 ? 'Wide' : 'Angry');
  if (act === 'chase') return pick('chase', 'Angry');
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
  if (a.attack > 0 && kind === 'fAirSpin') {
    const p = 1 - a.attack / MOVES.fAirSpin.dur;
    if (p < 0.12) return pick('fAsA', 'Angry');
    if (p > 0.88) return pick('fall', 'Angry');
    return { frame: { ...FRAMES.jSpin, spin: Math.floor((time + seed) * 20) * (a.face || 1) }, expr: 'Open', name: 'jSpin' };
  }
  if (a.attack > 0 && kind === 'jAirSpin') {
    const p = 1 - a.attack / MOVES.jAirSpin.dur;
    if (p < 0.12) return pick('nVxA', 'Angry');
    if (p > 0.88) return pick('vortex', 'Angry');
    return { frame: { ...FRAMES.jSpin, spin: Math.floor((time + seed) * 20) * (a.face || 1) }, expr: 'Angry', name: 'jSpin' };
  }
  if (a.attack > 0 && KEYS[kind] && MOVES[kind] && (styleOf(a) === 4 || kind !== 'dashAtk')) {
    const [, name, expr] = keyFor(kind, Math.max(0, Math.min(0.999, 1 - a.attack / MOVES[kind].dur)));
    return pick(name, expr);
  }
  if (a.attack > 0 && wmv?.anim) return weaponFrame(wmv, Math.max(0, Math.min(0.999, 1 - a.attack / wmv.dur)), seed, time);
  if (a.attack > 0 && STRIKES[kind]) {
    const dur = MOVES[kind]?.dur || WEAPON_TIME[kind] || 0.3;
    const p = Math.max(0, Math.min(0.999, 1 - a.attack / dur));
    const [names, expr] = BY_TYPE[kind]?.[styleOf(a)] || STRIKES[kind];
    return pick(names[Math.floor(p * 3)], expr);
  }
  // Launched and still reeling: tumble head over heels.
  if (!a.ground && a.stun > 0.2 && !a.climbing) return { frame: { ...FRAMES.tumble, spin: Math.floor((time + seed) * 12) * -(a.face || 1) }, expr: 'Hurt', name: 'tumble' };
  const gun = a.weapon === 'pistol' || a.weapon === 'shotgun' || a.weapon === 'extinguisher';
  if (act === 'carry' || (a.holding && !gun)) return pick('carry', blink ? 'Blink' : '');
  if (a.climbing) return pick(Math.floor((a.y || 0) / 10) % 2 ? 'climb1' : 'climb2');
  let base;
  if (a.stun > 0.25) base = pick(Math.floor(time * 4) % 2 ? 'dizzy' : 'hurt', 'Hurt');
  else if (a.hurt > 0.06) base = pick('hurt', 'Hurt');
  else if (a.getup > 0) base = pick('crouch');
  else if (!a.ground) base = a.gliding ? pick('glide') : pick((a.vy ?? 0) < -1 ? 'jump' : 'fall');
  else if (a.crouch) base = pick('crouch');
  else if (a.landImpact > 5) base = pick('land');
  else if (a.skid > 0) base = pick('skid');
  else if (Math.abs(a.vx || 0) > 0.6) {
    const rate = Math.min(1.4, 0.55 + Math.abs(a.vx) / 6);
    // The titan lumbers along on her knuckles.
    base = pick((a.form === 'titan' ? ['tRun1', 'tRunP', 'tRun2', 'tRunP'] : ['run1', 'runPass', 'run2', 'runPass2'])[Math.floor((time + seed) * (a.form === 'titan' ? 9 : 12) * rate) % 4]);
  } else {
    const breath = Math.floor((time + seed) * 1.6) % 2;
    // Nox never stands neutral: low, claws up, leaning toward the fight.
    // The frog stands like the fighter he swallowed.
    const st = styleOf(a);
    base = st === 4 ? pick(breath ? 'nStance2' : 'nStance1', blink ? 'Blink' : 'Angry')
      : st === 5 ? pick(breath ? 'fStance2' : 'fStance1', blink ? 'Blink' : '')
      : st === 3 ? (a.form === 'titan' ? pick(breath ? 'tStance2' : 'tStance1', blink ? 'Blink' : 'Angry') : a.form === 'beast' ? pick(breath ? 'bStance2' : 'bStance1', blink ? 'Blink' : 'Angry') : pick(breath ? 'jStance2' : 'jStance1'))
      : pick(breath ? 'idle2' : 'idle');
    base = { ...base, frame: { ...base.frame, tailDeg: Math.round(Math.sin((time + seed) * 1.7) * 2) * 3 } };
  }
  if (gun) base = { ...base, frame: { ...base.frame, armF: aimArm(a, (a.recoil || 0) > 0.3) }, name: base.name + '+aim' };
  return base;
}
