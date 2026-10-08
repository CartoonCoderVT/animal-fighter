// Frame-based animation for the pixel fighters. A frame gives each slot [dx, dy, degrees]
// (clockwise) relative to the rest pose, plus tail and whole-figure spin. The frame is picked
// from observable actor state only, so the host simulation (hit location, ragdoll start pose)
// and every remote renderer agree without sending poses over the network.
import { MOVES } from '../sim/moves.js';

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
  kickA: [['kickA0', 'kickA1', 'kickA2'], 'Angry'],
  kickB: [['kickB0', 'kickB1', 'kickB2'], 'Angry'],
  hopkick: [['hopkick0', 'hopkick1', 'hopkick2'], 'Angry'],
  kick: [['kick0', 'kick1', 'kick2'], 'Angry'],
  pawA: [['paw0', 'paw1', 'paw2'], 'Angry'],
  pawB: [['pawB0', 'pawB1', 'pawB2'], 'Angry'],
  rising: [['rising0', 'rising1', 'rising2'], 'Angry'],
  smash: [['smash0', 'smash0', 'smash1'], 'Angry'],
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
  dashAtk: [[0, 'nCutX', 'Angry'], [0.6, 'nCutF', 'Angry']]
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
  for (const k of ['armF', 'armB']) if (f[k]) f[k] = [f[k][0], f[k][1], snap(f[k][2])];
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
  if (act === 'stomp') return pick('stomp', 'Angry');
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
  if (a.attack > 0 && a.type === 4 && KEYS[kind] && MOVES[kind]) {
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
  if (a.stun > 0.25) base = pick(Math.floor(time * 4) % 2 ? 'dizzy' : 'hurt', 'Hurt');
  else if (a.hurt > 0.06) base = pick('hurt', 'Hurt');
  else if (a.getup > 0) base = pick('crouch');
  else if (!a.ground) base = a.gliding ? pick('glide') : pick((a.vy ?? 0) < -1 ? 'jump' : 'fall');
  else if (a.crouch) base = pick('crouch');
  else if (a.landImpact > 5) base = pick('land');
  else if (a.skid > 0) base = pick('skid');
  else if (Math.abs(a.vx || 0) > 0.6) {
    const rate = Math.min(1.4, 0.55 + Math.abs(a.vx) / 6);
    base = pick(['run1', 'runPass', 'run2', 'runPass2'][Math.floor((time + seed) * 12 * rate) % 4]);
  } else {
    const breath = Math.floor((time + seed) * 1.6) % 2;
    // Nox never stands neutral: low, claws up, leaning toward the fight.
    base = a.type === 4 ? pick(breath ? 'nStance2' : 'nStance1', blink ? 'Blink' : 'Angry') : pick(breath ? 'idle2' : 'idle');
    base = { ...base, frame: { ...base.frame, tailDeg: Math.round(Math.sin((time + seed) * 1.7) * 2) * 3 } };
  }
  if (gun) base = { ...base, frame: { ...base.frame, armF: aimArm(a, (a.recoil || 0) > 0.3) }, name: base.name + '+aim' };
  return base;
}
