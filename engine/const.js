// World units are the physics space; the renderer draws pixel art at VIEW resolution.
export const WORLD_W = 960;
export const WORLD_H = 540;
export const VIEW_W = 640;
export const VIEW_H = 360;
export const S = VIEW_W / WORLD_W;
export const STEP = 1 / 60;

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const px = x => Math.round(x * S);
export const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
export const wrapAngle = a => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// Small deterministic generator so client-side effects match across peers.
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
].map(v => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];
