// Shared skeleton of the chibi fighters, used by the simulation (hit location, ragdolls).
// Six physical parts: the body carries the head, both arms and both feet. Tails and
// scarves are cosmetic and ride on the body or head.
import { S } from '../engine/const.js';
import { CAST, SLOTS, ANCHOR, JOINT, PARENT, partCenter, partSize, snapDeg } from './pixel-data.js';
import { frameFor } from './anim.js';

// The physics box is 16x34 world units; its center is the actor anchor and the soles sit FOOT below.
export const HALF_H = 17;
export const FOOT = 17;
export const BODY_W = 16;
export const PARTS = SLOTS;
export { PARENT };
export const MASS = { body: 1.6, head: 1.0, armF: 0.22, armB: 0.22, footF: 0.25, footB: 0.25 };
// Relative angle limits (child - parent) for ragdoll joints, facing right.
export const LIMITS = { head: [-0.7, 0.7], armF: [-2.6, 2.6], armB: [-2.6, 2.6], footF: [-1.3, 1.3], footB: [-1.3, 1.3] };

export function subtree(name) {
  return name === 'body' ? [...SLOTS] : [name];
}

// Physical box of a part in world units: a little inside the drawn pixels.
export function partBox(type, slot) {
  const [w, h] = partSize(CAST[type], slot);
  const k = slot === 'head' ? [0.8, 0.72] : slot === 'body' ? [0.85, 0.8] : [1, 1];
  return [Math.max(3, w * k[0]) / S, Math.max(3, h * k[1]) / S];
}

const toWorld = (x, y) => [x / S, y / S + FOOT];

// Part centers and joint pivots in world units relative to the actor anchor, facing right.
export function poseFromFrame(type, frame) {
  const ch = CAST[type];
  const spin = (((frame.spin || 0) % 4) + 4) % 4;
  const turn = (x, y) => {
    let px = x, py = y + 7;
    for (let i = 0; i < spin; i++) [px, py] = [-py, px];
    return [px, py - 7];
  };
  return SLOTS.map(name => {
    const [ax, ay] = ANCHOR[name];
    const [dx = 0, dy = 0, deg = 0] = frame[name] || [];
    const a = (snapDeg(deg) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const [cx, cy] = partCenter(ch, name);
    const vx = cx - ax, vy = cy - ay;
    const center = turn(ax + dx + vx * c - vy * s, ay + dy + vx * s + vy * c);
    const [jx, jy] = JOINT[name] || [ax, ay];
    const joint = turn(ax + dx + (jx - ax) * c - (jy - ay) * s, ay + dy + (jx - ax) * s + (jy - ay) * c);
    const [x, y] = toWorld(...center), [px, py] = toWorld(...joint);
    return { name, x, y, angle: a + (spin * Math.PI) / 2, w: 1, px, py };
  });
}

export function pose(a, time = 0) {
  return poseFromFrame(a.type, frameFor(a, time).frame);
}

// Offset from a part's center to its matrix pivot, in pixels, per fighter type (wounds are stored from the pivot).
export const PIVOT_FROM_CENTER = CAST.map(ch => Object.fromEntries(SLOTS.map(slot => {
  const [cx, cy] = partCenter(ch, slot), [ax, ay] = ANCHOR[slot];
  return [slot, [cx - ax - 0.5, cy - ay - 0.5]];
})));
