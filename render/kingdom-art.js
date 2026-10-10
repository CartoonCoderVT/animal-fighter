// The Cat King's kingdom (BANDEIRA REAL, sim/kingdom.js): the banner he drives into the floor, the house it
// grows into and the castle after that, the golden aura that buffs his court, the fish his little workers
// fetch, his workers, knights and archers (drawn by court-art.js), and every moment of it (the plant, a
// level-up, blows, the collapse, the recall home, a fish picked up, delivered, eaten).
//
// Everything lasting is drawn from state (state.kingdoms, state.fish, actor.pk), the same shape for the
// live Game and a guest's snapshot; events only add one-off effects. Memory is per kingdom / fish id in
// Maps, cleared by reset(). Structures are hand-painted pixel sprites baked once per (level, damage,
// owner colour) with the court's 1-px ink outline, composed each frame with their moving parts (the
// cloth, pennants, the reveal of a build) into a small canvas per kingdom that is then drawn, flashed,
// toppled or sunk as a whole.
//
// Hooks (renderer.js):
//   const k = new KingdomFX(renderer)
//   k.reset()                                    a new match
//   k.event(e)                                   every fx event (kgPlant, kgLevel, kgHit, kgFall, ...)
//   k.update(dt, state)                          every frame the world is not stopped (runs on game time)
//   k.drawStructures(lg, state, ox, oy)          lit layer, after the floor decals, before world.fronts
//   k.drawFish(lg, state, ox, oy)                lit layer, after the props
//   k.drawUnits(lg, state, ox, oy, front)        lit layer, with the court (front: units striking, in the
//                                                air, the archers and the castle's front battlements, then
//                                                the dust and debris)
//   k.drawKeep(lg, state, ox, oy, figures)       after the light map, with the fighters' own-colour pass
//   k.drawGlow(eg, state, ox, oy)                emissive: the aura, windows, torches, the ghost banner
//   k.drawEffects(eg, ox, oy)                    emissive: the event effects
//   kingdomLights(state, t, fx)                  light descriptors (view px, no shake)
//   kingdomColor(by)                             the owner's colour (scarves, ribbons, pennants)
import { S, seeded } from '../engine/const.js';
import { KINGDOM } from '../sim/moves.js';
import { drawBanner, drawBannerTint, drawPennant } from './banner-art.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => Math.round(v * S);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = u => 1 - (1 - u) * (1 - u);
const easeIn = u => u * u;
const lerp = (a, b, u) => a + (b - a) * u;
const HALF_H = 17;
const INK = '#120b19';

// The owner's colour, by actor id (the scarf of his units, the ribbons on his banner, his pennants).
export const KINGDOM_COLORS = ['#5aaaff', '#6ee08a', '#c08aff', '#ffe46a'];
export const kingdomColor = by => KINGDOM_COLORS[(((by | 0) % 4) + 4) % 4];

// ---- palette -----------------------------------------------------------------------------------
const KP = {
  // warm sandstone (it stands out of the violet depot and castle walls)
  s0: '#3a2c34', s1: '#5e4a4c', s2: '#86705e', s3: '#ab9374', s4: '#d0b88e', s5: '#efdcb2',
  // wood
  w0: '#2e1a1e', w1: '#4a2a26', w2: '#6e4030', w3: '#94603e', w4: '#b8844e',
  // plaster
  p0: '#b09a80', p1: '#d8c4a0', p2: '#f0e2c0',
  // roof tiles
  r0: '#4a0c1c', r1: '#7a1628', r2: '#a8263a', r3: '#cc4048', r4: '#ec7068', pink: '#ffa6b4',
  // gold
  g0: '#86501e', g1: '#cc8a2a', g2: '#f8c84a', g3: '#fff2a8',
  // iron
  i0: '#1e1a2b', i1: '#3e3757', i2: '#5a5276', i3: '#837a9c',
  // earth
  d0: '#3a2626', d1: '#5a3a30', d2: '#7a5440', d3: '#9a7050',
  // a lit window as the lit layer sees it (the emissive pass brightens it), a dark doorway, cracks
  W: '#d88a40', dark: '#1a0f16', crack: '#2a1a20', gem: '#e05050'
};
const RGB = new Map();
const rgbOf = hex => { let v = RGB.get(hex); if (!v) { const n = parseInt(hex.slice(1, 7), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(hex, v); } return v; };

// A small canvas painted cell by cell, coordinates from its anchor (the base's centre: y = -1 is the
// bottom row of the thing standing on the floor).
class Pix {
  constructor(w, h, ax, ay) { this.c = mk(w, h); this.g = this.c.getContext('2d', { willReadFrequently: true }); this.w = w; this.h = h; this.ax = ax; this.ay = ay; }
  p(x, y, c) { if (!c) return; this.g.fillStyle = c; this.g.fillRect(this.ax + x, this.ay + y, 1, 1); }
  r(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(this.ax + x, this.ay + y, w, h); }
  del(x, y) { this.g.clearRect(this.ax + x, this.ay + y, 1, 1); }
}
// The court's ink outline: every clear cell touching a painted one (not below the base line).
function outline(P, ink = INK) {
  const { w, h } = P, img = P.g.getImageData(0, 0, w, h), D = img.data, A = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) A[i] = D[i * 4 + 3] > 0 ? 1 : 0;
  const [r, g, b] = rgbOf(ink);
  for (let y = 0; y < Math.min(h, P.ay); y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (A[i]) continue;
    if ((x > 0 && A[i - 1]) || (x < w - 1 && A[i + 1]) || (y > 0 && A[i - w]) || (y < h - 1 && A[i + w])) { D[i * 4] = r; D[i * 4 + 1] = g; D[i * 4 + 2] = b; D[i * 4 + 3] = 255; }
  }
  P.g.putImageData(img, 0, 0);
}
// Cracks running down from a few seeded points inside `areas` ({x, y, w, h}), never through glass;
// and, worse, chips knocked off the top edge.
function damage(P, stage, seed, areas, chipCols = null) {
  if (!stage) return;
  const rnd = seeded(seed), { w, h } = P, img = P.g.getImageData(0, 0, w, h), D = img.data;
  const idx = (x, y) => ((P.ay + y) * w + P.ax + x) * 4;
  const ok = (x, y) => { const X0 = P.ax + x, Y0 = P.ay + y; if (X0 < 0 || Y0 < 0 || X0 >= w || Y0 >= h) return false; const i = idx(x, y); if (!D[i + 3]) return false; const [r, g, b] = rgbOf(KP.W); return !(D[i] === r && D[i + 1] === g && D[i + 2] === b); };
  const set = (x, y, hex) => { const i = idx(x, y), [r, g, b] = rgbOf(hex); D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = 255; };
  const n = stage === 1 ? 3 : 7;
  for (let k = 0; k < n; k++) {
    const A = areas[Math.floor(rnd() * areas.length)];
    let x = A.x + Math.floor(rnd() * A.w), y = A.y + Math.floor(rnd() * A.h);
    const len = 4 + Math.floor(rnd() * (stage === 1 ? 5 : 9)), lean = rnd() < 0.5 ? -1 : 1;
    for (let s = 0; s < len; s++) {
      if (!ok(x, y)) break;
      set(x, y, KP.crack);
      if (s % 2 === 0 && ok(x - lean, y)) set(x - lean, y, KP.s4);
      y += 1;
      if (rnd() < 0.55) x += rnd() < 0.8 ? lean : -lean;
    }
  }
  if (stage >= 2 && chipCols) {
    for (const cx of chipCols) {
      let top = null;
      for (let y = -P.ay; y < 0; y++) if (D[idx(cx, y) + 3]) { top = y; break; }
      if (top === null) continue;
      const d = 1 + Math.floor(rnd() * 2);
      for (let j = 0; j < d; j++) for (let i = 0; i < 2; i++) { const k = idx(cx + i, top + j); if (P.ax + cx + i < w) D[k + 3] = 0; }
    }
  }
  P.g.putImageData(img, 0, 0);
}

// A stone with a light top and a shaded right side.
function stone(P, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.p(x + i, y + j, j === 0 ? (i === 0 ? KP.s5 : KP.s4) : i === w - 1 ? KP.s1 : KP.s2);
}
// Ashlar: courses three rows tall, blocks five wide, offset every other course; lit from the upper left,
// the last columns on the right in shade.
function masonry(P, x0, y0, x1, y1, { light = 0, tone = 0 } = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const course = Math.floor((y1 - y) / 3), ry = (y1 - y) % 3, off = course % 2 ? 3 : 0, bi = Math.floor((x - x0 + off) / 6), bx = (((x - x0 + off) % 6) + 6) % 6;
    // Each block a little lighter or darker than the next.
    const h = ((bi * 73856093) ^ (course * 19349663)) >>> 0, vary = h % 5 === 0 ? 1 : h % 7 === 0 ? -1 : 0;
    let lv = ry === 0 || bx === 5 ? 2 : (ry === 2 && bx < 2 ? 4 : 3) + vary;
    lv += tone;
    if (x >= x1 - 1) lv--;
    if (x <= x0 + 1 && light) lv++;
    P.p(x, y, KP['s' + Math.max(0, Math.min(5, lv))]);
  }
}

// ---- the three structures ------------------------------------------------------------------------
// Where the windows are on each (cells from the base centre), for the glow; the door the units use.
const WINDOWS = {
  2: [{ x: -13, y: -20, w: 5, h: 5 }, { x: 9, y: -20, w: 5, h: 5 }, { x: -6, y: -29, w: 2, h: 2 }, { x: 5, y: -29, w: 2, h: 2 }],
  3: [{ x: -10, y: -45, w: 3, h: 5, arch: 1 }, { x: 8, y: -45, w: 3, h: 5, arch: 1 }, { x: -21, y: -48, w: 1, h: 5 }, { x: 21, y: -48, w: 1, h: 5 }, { x: -21, y: -23, w: 1, h: 4 }, { x: 21, y: -23, w: 1, h: 4 }]
};
// Each sprite's top (cells above the base) for the build's reveal.
const TOP = { 1: 44, 2: 46, 3: 73 };
const TORCH = { x: 20, y: -32 };

// BANDEIRA: the mound and its ring of stones (it stays put when the pole topples), and the pole with
// the gold crown on top (the cloth is drawn live from banner-art.js).
function paintMound() {
  const P = new Pix(24, 8, 12, 6);
  stone(P, -9, -2, 3, 2); stone(P, 7, -2, 3, 2);
  const rows = [[-1, 7], [-2, 5], [-3, 3]];
  for (const [y, hw] of rows) for (let x = -hw; x <= hw; x++) {
    const top = y === -3 || Math.abs(x) > (y === -1 ? 5 : 3);
    P.p(x, y, top ? (x < 0 ? KP.d3 : KP.d2) : (x + y) & 1 ? KP.d1 : KP.d2);
  }
  stone(P, -5, -1, 2, 1); stone(P, 4, -1, 2, 1);
  outline(P);
  return P;
}
function paintPole() {
  const P = new Pix(16, 52, 8, 50);
  for (let y = -40; y <= -3; y++) { P.p(-1, y, KP.w3); P.p(0, y, KP.w2); P.p(1, y, KP.w1); }
  for (const y of [-39, -6]) { P.p(-1, y, KP.g2); P.p(0, y, KP.g1); P.p(1, y, KP.g0); }
  P.p(-1, -5, KP.g1); P.p(0, -5, KP.g0); P.p(1, -5, KP.g0);
  // The crown finial: three points, a jewelled band, a collar.
  P.p(-2, -44, KP.g3); P.p(0, -44, KP.g3); P.p(2, -44, KP.g3);
  for (let x = -2; x <= 2; x++) { P.p(x, -43, x === 0 ? KP.g3 : KP.g2); P.p(x, -42, x === 0 ? KP.gem : x < 0 ? KP.g2 : KP.g1); }
  for (let x = -1; x <= 1; x++) P.p(x, -41, x < 1 ? KP.g1 : KP.g0);
  outline(P);
  return P;
}
// CASA: a stone plinth, timber-framed walls, a round door, two warm windows with flower boxes, and a red
// tiled roof shaped like a cat's head (two ear gables, two little lit attic eyes), a chimney, and a pole
// on the ridge for the pennant.
function paintHouse(stage, seed) {
  const P = new Pix(56, 56, 28, 50);
  // Roof first (the walls tuck under the eaves).
  for (let k = 0; k <= 19; k++) {
    const y = -22 - k, xo = Math.round(20 - (k * 10) / 19), xi = k >= 10 ? Math.round(((k - 10) * 10) / 9) : -1;
    for (let x = -xo; x <= xo; x++) {
      if (xi >= 0 && Math.abs(x) < xi) continue;
      const t = k % 3;
      let c = t === 0 ? (x % 3 === 0 ? KP.r2 : KP.r1) : t === 1 ? KP.r2 : KP.r3;
      if (x === -xo || (xi > 0 && x === xi)) c = KP.r4;
      else if (x === xo || (xi > 0 && x === -xi)) c = KP.r1;
      if (k >= 12 && k <= 17 && Math.abs(x) <= xo - 2 && Math.abs(x) >= xi + 2 && Math.abs(x) >= 7) c = k === 12 ? KP.r4 : KP.pink;
      P.p(x, y, c);
    }
  }
  for (let x = -20; x <= 20; x++) { P.p(x, -22, KP.w1); P.p(x, -23, x % 4 === 0 ? KP.w2 : KP.r1); }
  // The attic eyes.
  for (const ex of [-6, 5]) { P.r(ex, -29, 2, 2, KP.W); P.p(ex, -30, KP.r1); P.p(ex + 1, -30, KP.r1); }
  // Chimney on the right slope.
  for (let y = -35; y <= -28; y++) for (let x = 13; x <= 15; x++) P.p(x, y, (y + (x === 14 ? 1 : 0)) % 3 === 0 ? KP.s1 : x === 15 ? KP.s2 : KP.s3);
  for (let x = 12; x <= 16; x++) { P.p(x, -36, KP.s4); P.p(x, -37, x === 12 ? KP.s5 : KP.s3); }
  // The ridge pole.
  for (let y = -44; y <= -31; y++) P.p(0, y, y === -44 ? KP.g3 : KP.w2);
  P.p(0, -45, KP.g2);
  // Walls.
  for (let y = -21; y <= -5; y++) for (let x = -16; x <= 16; x++) {
    const shade = y <= -20 ? 0 : x > 10 ? 0 : x < -10 ? 2 : 1;
    P.p(x, y, KP['p' + shade]);
  }
  // Timber framing: corner posts, posts by the door, the top and middle beams, braces.
  for (let y = -21; y <= -5; y++) { P.p(-16, y, KP.w2); P.p(-15, y, KP.w3); P.p(15, y, KP.w2); P.p(16, y, KP.w1); P.p(-5, y, KP.w2); P.p(5, y, KP.w2); }
  for (let x = -16; x <= 16; x++) { P.p(x, -21, KP.w1); P.p(x, -13, x === -16 || x === 16 ? KP.w1 : KP.w2); P.p(x, -12, KP.w1); }
  for (let i = 0; i <= 6; i++) { P.p(-14 + i, -6 - i, KP.w2); P.p(14 - i, -6 - i, KP.w2); }
  // Windows with flower boxes.
  for (const wx of [-13, 9]) {
    for (let y = -20; y <= -16; y++) for (let x = wx; x <= wx + 4; x++) {
      const frame = y === -20 || y === -16 || x === wx || x === wx + 4, mull = x === wx + 2 || y === -18;
      P.p(x, y, frame ? KP.w1 : mull ? KP.w2 : KP.W);
    }
    for (let x = wx - 1; x <= wx + 5; x++) { P.p(x, -14, KP.w3); P.p(x, -15, (x + wx) % 2 ? KP.r3 : KP.pink); }
    P.p(wx - 1, -15, '#5aa04a'); P.p(wx + 5, -15, '#5aa04a');
  }
  // A crown plaque over the door.
  P.p(-2, -20, KP.g3); P.p(0, -20, KP.g3); P.p(2, -20, KP.g3);
  for (let x = -2; x <= 2; x++) { P.p(x, -19, KP.g2); P.p(x, -18, x === 0 ? KP.gem : KP.g1); }
  // Plinth.
  masonry(P, -18, -4, 18, -1);
  for (let x = -18; x <= 18; x++) P.p(x, -4, x % 5 === 0 ? KP.s3 : KP.s5);
  // The round door in a stone arch, a step in front.
  const door = [[-15, 1], [-14, 2], [-13, 3]];
  for (let y = -15; y <= -2; y++) {
    const hw = door.find(d => d[0] === y)?.[1] ?? 3;
    for (let x = -hw - 1; x <= hw + 1; x++) {
      const arch = Math.abs(x) === hw + 1 || y === -16;
      P.p(x, y, arch ? (x < 0 ? KP.s5 : KP.s3) : x === -hw ? KP.w3 : Math.abs(x) === 1 && y > -14 ? KP.w1 : y === -10 || y === -5 ? KP.i2 : KP.w2);
    }
  }
  for (let x = -1; x <= 1; x++) P.p(x, -16, KP.s5);
  P.p(2, -8, KP.g2);
  for (let x = -5; x <= 5; x++) P.p(x, -1, x === -5 ? KP.s5 : KP.s4);
  damage(P, stage, seed, [{ x: -15, y: -21, w: 9, h: 8 }, { x: 6, y: -21, w: 9, h: 8 }, { x: -17, y: -4, w: 34, h: 3 }, { x: -12, y: -30, w: 24, h: 6 }], [-19, -11, 9, 17]);
  outline(P);
  return P;
}
// CASTELO: a keep between two towers; cat-ear merlons along the keep and (in front of the archers) on
// the towers, arched windows and arrow slits, a gate with a portcullis half up under the big banner,
// the owner's pennants hanging on the towers, torch brackets.
function paintCastle(stage, seed, color) {
  const P = new Pix(72, 92, 36, 86);
  // The keep.
  masonry(P, -13, -54, 13, -1, { tone: -1 });
  for (let y = -54; y <= -1; y++) { P.p(-13, y, KP.s0); P.p(-12, y, (y & 1) ? KP.s0 : KP.s1); P.p(12, y, KP.s1); P.p(13, y, KP.s0); }
  for (let x = -13; x <= 13; x++) { P.p(x, -54, KP.s4); P.p(x, -53, x % 3 ? KP.s1 : KP.s0); }
  // Cat-head merlons: a block with two ears.
  for (const mx of [-12, -2, 8]) {
    for (let y = -57; y <= -55; y++) for (let x = mx; x <= mx + 4; x++) P.p(x, y, y === -57 ? KP.s4 : x === mx + 4 ? KP.s2 : KP.s3);
    P.p(mx, -58, KP.s4); P.p(mx + 1, -58, KP.s3); P.p(mx + 3, -58, KP.s3); P.p(mx + 4, -58, KP.s2); P.p(mx, -59, KP.s5); P.p(mx + 4, -59, KP.s3);
  }
  // Arched keep windows.
  for (const w of WINDOWS[3].slice(0, 2)) for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) {
    if (y === w.y && x !== w.x + 1) continue;
    P.p(x, y, KP.W);
  }
  for (const w of WINDOWS[3].slice(0, 2)) for (let x = w.x - 1; x <= w.x + w.w; x++) P.p(x, w.y + w.h, KP.s5);
  // Brackets of the banner's rod.
  P.p(-6, -51, KP.i1); P.p(6, -51, KP.i1); P.p(-6, -50, KP.i2); P.p(6, -50, KP.i2);
  // The gate: an arch of light voussoirs, a dark passage, the portcullis.
  const half = y => (y === -15 ? 3 : y === -14 ? 5 : y === -13 ? 6 : 7);
  for (let y = -16; y <= -1; y++) {
    const hw = y === -16 ? 2 : half(y);
    for (let x = -hw - 1; x <= hw + 1; x++) {
      const edge = Math.abs(x) >= hw || y === -16;
      if (edge) { P.p(x, y, x < 0 ? KP.s5 : KP.s4); continue; }
      const grid = y <= -8 && (x % 2 === 0 || y % 3 === 0);
      P.p(x, y, grid ? (y === -8 ? KP.i3 : KP.i2) : y > -4 ? KP.s0 : KP.dark);
    }
  }
  for (let x = -6; x <= 6; x += 2) P.p(x, -7, KP.i3);
  // Towers.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -27 : 14, x1 = x0 + 13, cx = side * 21;
    masonry(P, x0, -64, x1, -1, { light: 1 });
    for (let y = -5; y <= -1; y++) { P.p(x0 - 1, y, KP.s3); P.p(x1 + 1, y, KP.s1); }
    for (let x = x0 - 1; x <= x1 + 1; x++) { P.p(x, -64, KP.s5); P.p(x, -63, x % 2 ? KP.s3 : KP.s1); }
    // Arrow slits (glowing) and a lower one.
    for (const w of WINDOWS[3].slice(2)) if (Math.sign(w.x) === side) {
      for (let y = w.y - 1; y <= w.y + w.h; y++) { P.p(w.x - 1, y, KP.s1); P.p(w.x + 1, y, KP.s4); }
      for (let y = w.y; y < w.y + w.h; y++) P.p(w.x, y, KP.W);
      P.p(w.x, w.y - 1, KP.s1);
    }
    // The owner's pennant hanging under the battlement: a gold rod, the colour, a crimson border, a point.
    const [cr, cg, cb] = rgbOf(color), dk = '#' + [cr, cg, cb].map(v => Math.round(v * 0.62).toString(16).padStart(2, '0')).join('');
    for (let x = cx - 3; x <= cx + 3; x++) P.p(x, -61, x === cx - 3 || x === cx + 3 ? KP.g3 : KP.g2);
    for (let y = -60; y <= -51; y++) {
      const hw = y >= -53 ? -51 - y : 2;
      for (let x = cx - hw; x <= cx + hw; x++) P.p(x, y, Math.abs(x - cx) === hw ? KP.r2 : y === -57 ? KP.g2 : x === cx - hw + 1 ? color : dk);
    }
    // Torch bracket.
    P.p(side * TORCH.x, TORCH.y + 1, KP.i2); P.p(side * TORCH.x, TORCH.y + 2, KP.i1); P.p(side * TORCH.x - side, TORCH.y + 3, KP.i1);
    P.p(side * TORCH.x - 1, TORCH.y, KP.i3); P.p(side * TORCH.x + 1, TORCH.y, KP.i3); P.p(side * TORCH.x, TORCH.y, KP.w3);
  }
  damage(P, stage, seed, [{ x: -12, y: -40, w: 24, h: 22 }, { x: -26, y: -60, w: 11, h: 50 }, { x: 15, y: -60, w: 11, h: 50 }], [-13, -2, 9, -27, 26]);
  outline(P);
  return P;
}
// The towers' front battlements, drawn in front of the archers: a corbelled parapet with a cat-ear merlon
// at each end, so an archer peeks over it from the waist up.
function paintParapet(stage, seed) {
  const P = new Pix(72, 92, 36, 86);
  for (const side of [-1, 1]) {
    const x0 = (side < 0 ? -27 : 14) - 1, x1 = x0 + 15;
    for (let y = -67; y <= -65; y++) for (let x = x0; x <= x1; x++) P.p(x, y, y === -67 ? KP.s5 : y === -65 ? KP.s1 : x === x1 ? KP.s2 : x === x0 ? KP.s4 : (x - x0) % 6 === 5 && y === -66 ? KP.s2 : KP.s3);
    for (const mx of [x0, x1 - 4]) {
      for (let y = -70; y <= -68; y++) for (let x = mx; x <= mx + 4; x++) P.p(x, y, y === -70 ? KP.s5 : x === mx + 4 ? KP.s2 : x === mx ? KP.s4 : KP.s3);
      P.p(mx, -71, KP.s4); P.p(mx + 1, -71, KP.s3); P.p(mx + 3, -71, KP.s3); P.p(mx + 4, -71, KP.s2); P.p(mx, -72, KP.s5); P.p(mx + 4, -72, KP.s3);
      P.p(mx + 1, -72 + 1, KP.pink); P.p(mx + 3, -71, KP.pink);
    }
  }
  if (stage >= 2) { P.del(-28, -72); P.del(-28, -71); P.del(-27, -71); P.del(28, -72); P.del(28, -71); P.del(-20, -67); P.del(19, -67); P.del(20, -67); }
  outline(P);
  return P;
}
const SPRITES = new Map();
function spriteOf(key, make) { let s = SPRITES.get(key); if (!s) { s = make(); SPRITES.set(key, s); } return s; }
const moundSprite = () => spriteOf('mound', paintMound);
const poleSprite = () => spriteOf('pole', paintPole);
const houseSprite = stage => spriteOf('house' + stage, () => paintHouse(stage, 0x51a7));
const castleSprite = (stage, color) => spriteOf('castle' + stage + color, () => paintCastle(stage, 0x9e37, color));
const parapetSprite = stage => spriteOf('parapet' + stage, () => paintParapet(stage, 0x9e37));
function whiteOf(c, w) {
  w.width = c.width; w.height = c.height;
  const g = w.getContext('2d');
  g.globalCompositeOperation = 'copy'; g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff6ea'; g.fillRect(0, 0, w.width, w.height);
  g.globalCompositeOperation = 'source-over';
  return w;
}

// The fish: a 7x4 silver fish lying on its side, and the same mid-flop, tail up.
const FISH_PAL = { k: '#1a1626', d: '#3e4c6a', m: '#7f97b8', l: '#c4d6ec', w: '#f4fbff', b: '#a8b8d0', f: '#5a6a8c', e: '#0c0a14', o: '#ff9a6a' };
const FISH = {
  lie: ['.d.ddd.', 'dmmllwd', '.dbbbmd', 'd..dd..'],
  flop: ['d..ddd.', '.dmllwd', '.dbbbmd', '..dd...'],
  heap: ['.ddd.', 'dllwd', 'dbbmd']
};
const fishCache = new Map();
function fishSprite(kind, flip) {
  const key = kind + flip;
  let c = fishCache.get(key);
  if (c) return c;
  const rows = FISH[kind], w = rows[0].length, h = rows.length;
  c = mk(w, h);
  const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < w; x++) { const ch = row[flip ? w - 1 - x : x]; if (ch !== '.') { g.fillStyle = FISH_PAL[ch]; g.fillRect(x, y, 1, 1); } } });
  // Its eye.
  if (kind !== 'heap') { g.fillStyle = FISH_PAL.e; g.fillRect(flip ? 1 : w - 2, 1, 1, 1); }
  fishCache.set(key, c);
  return c;
}

// ---- effect palettes (as the court's) ----------------------------------------------------------
const FXC = {
  gold: { core: '#ffffff', hot: '#fff2a8', mid: '#ffc838', deep: '#c47a12', ink: '#3a1e04' },
  hurt: { core: '#ffffff', hot: '#ffe2e8', mid: '#ff5a74', deep: '#a8284a' },
  dust: ['#b8a890', '#968672', '#d8c8ae', '#7a6c5c'],
  stoneChips: ['#efdcb2', '#d0b88e', '#ab9374', '#86705e', '#5e4a4c'],
  woodChips: ['#b8844e', '#94603e', '#6e4030', '#f8c84a'],
  roof: ['#cc4048', '#a8263a', '#7a1628'],
  smoke: ['#2a2238', '#3a3050', '#4e4466', '#5e5470']
};
// A four-pointed glint of radius r.
function glint(g, P, x, y, r) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = P.mid;
  for (let d = 1; d <= r; d++) { g.fillRect(x - d, y, 1, 1); g.fillRect(x + d, y, 1, 1); g.fillRect(x, y - d, 1, 1); g.fillRect(x, y + d, 1, 1); }
  g.fillStyle = P.hot;
  for (let d = 1; d <= Math.max(1, r - 2); d++) { g.fillRect(x - d, y, 1, 1); g.fillRect(x + d, y, 1, 1); g.fillRect(x, y - d, 1, 1); g.fillRect(x, y + d, 1, 1); }
  g.fillStyle = P.core; g.fillRect(x, y, 1, 1);
}
// "+1", 7x5, in gold with a dark rim.
const PLUS = [[1, 1], [0, 2], [1, 2], [2, 2], [1, 3], [5, 0], [4, 1], [5, 1], [5, 2], [5, 3], [4, 4], [5, 4], [6, 4]];

// The per-kingdom canvas everything is composed into: wide enough for a toppling pole.
const CW = 112, CH = 100, AX = 56, AY = 92;
// How long the banner flies from the King's paw to its spot (a short drop when he stands on it).
const flyT = kg => (Math.abs((kg.ox ?? kg.x) - kg.x) > 3 ? 0.2 : 0.08);
const stageOf = kg => (kg.mx > 0 ? (kg.hp / kg.mx < 0.33 ? 2 : kg.hp / kg.mx < 0.66 ? 1 : 0) : 0);
const tierOf = kg => (kg.st === 'fall' ? 0 : kg.st === 'up' ? kg.lv - 1 : kg.lv);

export class KingdomFX {
  constructor(renderer = null) {
    this.r = renderer;
    this.mem = new Map();
    this.fishSeen = new Map();
    this.fx = [];
    this.parts = [];
    this.later = [];
    this.clock = 0;
    this.lastT = null;
    this.kings = [];
    this.scratch = null;
    this.ukeep = null;
  }

  reset() {
    this.mem.clear(); this.fishSeen.clear();
    this.fx.length = 0; this.parts.length = 0; this.later.length = 0;
    this.clock = 0; this.lastT = null; this.kings = [];
  }

  memOf(kg) {
    let m = this.mem.get(kg.id);
    if (!m) {
      m = { id: kg.id, st: kg.st, lv: kg.lv, fell: false, thud: false, hitF: 1, dustT: 0, smokeT: 0, chimT: 0, rx: 0, ry: 0, seen: this.clock, c: mk(CW, CH), c2: mk(CW, CH), w: mk(CW, CH) };
      for (const c of [m.c, m.c2, m.w]) c.getContext('2d').imageSmoothingEnabled = false;
      this.mem.set(kg.id, m);
    }
    return m;
  }

  // ---- particles ----
  part(k, x, y, vx, vy, life, c, extra = {}) {
    if (this.parts.length > 500) return;
    this.parts.push({ k, x, y, vx, vy, t: 0, life, c, g: 0, drag: 1, s: 1, floor: null, ...extra });
  }
  sparks(x, y, n, P, rnd, { a = -Math.PI / 2, spread = Math.PI * 2, sp = 90, life = 0.35, g = 220 } = {}) {
    for (let i = 0; i < n; i++) {
      const an = a + (rnd() - 0.5) * spread, v = sp * (0.4 + rnd() * 0.8);
      this.part('spark', x, y, Math.cos(an) * v, Math.sin(an) * v, life * (0.6 + rnd() * 0.6), [P.core, P.hot, P.mid][Math.floor(rnd() * 3)], { g, drag: 0.05 });
    }
  }
  dust(x, y, n, rnd, { r = 8, life = 0.6, up = 10, side = 30, cols = FXC.dust } = {}) {
    for (let i = 0; i < n; i++) {
      const sd = rnd() < 0.5 ? -1 : 1, d = rnd() * r;
      this.part('dust', x + sd * d, y - rnd() * 3, sd * side * (0.3 + rnd()), -up * (0.3 + rnd()), life * (0.6 + rnd() * 0.7), cols[Math.floor(rnd() * cols.length)], { s: 2 + Math.floor(rnd() * 2), drag: 0.08 });
    }
  }
  chips(x, y, n, rnd, cols, { dir = 0, sp = 80, floor = null, size = 1, life = 0.7 } = {}) {
    for (let i = 0; i < n; i++) {
      const an = dir ? (dir > 0 ? -0.5 : Math.PI + 0.5) + (rnd() - 0.5) * 1.6 : -Math.PI / 2 + (rnd() - 0.5) * 2.6, v = sp * (0.4 + rnd() * 0.8);
      this.part('chip', x + (rnd() - 0.5) * 4, y + (rnd() - 0.5) * 4, Math.cos(an) * v, Math.sin(an) * v - 20, life * (0.7 + rnd() * 0.6), cols[Math.floor(rnd() * cols.length)], { g: 380, drag: 0.5, floor, s: size + (rnd() < 0.3 ? 1 : 0) });
    }
  }
  motes(x, y, n, rnd, { r = 10, up = 40, life = 0.9 } = {}) {
    for (let i = 0; i < n; i++) this.part('mote', x + (rnd() - 0.5) * r * 2, y + (rnd() - 0.5) * 4, (rnd() - 0.5) * 10, -up * (0.4 + rnd()), life * (0.6 + rnd() * 0.6), rnd() < 0.5 ? FXC.gold.hot : FXC.gold.mid, { drag: 0.5 });
  }

  // ---- events: one-off moments ----
  event(e) {
    if (!e || typeof e.fx !== 'string' || e.fx.slice(0, 2) !== 'kg') return;
    const x = (e.x ?? 0) * S, y = (e.y ?? 0) * S, rnd = seeded(((e.id || 1) * 2654435761) ^ 0x6b1d), G = FXC.gold;
    const kg = this.kings.find(k => k.by === e.by && k.st !== 'fall') || this.kings.find(k => k.by === e.by);
    switch (e.fx) {
      case 'kgPlant': {
        // The pole bites when it lands: a gold ring over the floor and dust thrown both ways.
        const fly = Math.abs((e.ox ?? e.x) - (e.x ?? 0)) > 3 ? 0.2 : 0.08;
        this.later.push({ at: this.clock + fly, run: () => {
          this.fx.push({ k: 'ring', x, y, r: KINGDOM.ring.r * S + 8, t: 0, life: 0.5 });
          this.fx.push({ k: 'star', x, y: y - 4, P: G, t: 0, life: 0.18, big: true });
          this.dust(x, y, 14, rnd, { r: 6, life: 0.7, up: 12, side: 50 });
          this.chips(x, y - 1, 6, rnd, ['#9a7050', '#7a5440', '#5a3a30'], { sp: 70, floor: y - 1 });
          this.sparks(x, y - 2, 10, G, rnd, { spread: 2.4, sp: 110, life: 0.4 });
        } });
        break;
      }
      case 'kgLevel': {
        this.fx.push({ k: 'pillar', x, y, t: 0, life: 1.1, seed: rnd() * 9, w: (e.lv === 3 ? 30 : 22) });
        this.sparks(x, y - 20, 22, G, rnd, { sp: 120, life: 0.7, g: 60 });
        this.motes(x, y, 14, rnd, { r: 24, up: 50, life: 1.2 });
        this.dust(x, y, 12, rnd, { r: 20, life: 0.8, up: 8, side: 40 });
        break;
      }
      case 'kgHit': {
        const f = e.f || 1, lv = kg?.lv ?? 2;
        if (kg) { const m = this.mem.get(kg.id); if (m) m.hitF = f; }
        this.fx.push({ k: 'star', x: x - f * 3, y, P: { core: '#ffffff', hot: '#fff4d8', mid: '#ffd4a0' }, t: 0, life: 0.12 });
        this.chips(x, y, lv === 1 ? 5 : 7, rnd, lv === 1 ? FXC.woodChips : FXC.stoneChips, { dir: f, sp: 110, floor: kg ? kg.y * S - 1 : null });
        if (lv > 1) this.dust(x, y, 3, rnd, { r: 3, life: 0.4, up: 6, side: 20 });
        break;
      }
      case 'kgFall': {
        this.fx.push({ k: 'star', x, y: y - 20, P: G, t: 0, life: 0.2, big: true });
        this.fx.push({ k: 'ring', x, y, r: 50, t: 0, life: 0.6, dust: true });
        break;
      }
      case 'kgRecallStart': {
        const fy = y + HALF_H * S;
        this.fx.push({ k: 'column', x, y: fy, t: 0, life: 0.6, up: true });
        this.motes(x, fy, 10, rnd, { r: 8, up: 70, life: 0.7 });
        break;
      }
      case 'kgRecall': {
        const x0 = (e.x0 ?? 0) * S, y0 = (e.y0 ?? 0) * S + HALF_H * S, x1 = (e.x1 ?? 0) * S, y1 = (e.y1 ?? 0) * S + HALF_H * S;
        this.fx.push({ k: 'column', x: x0, y: y0, t: 0, life: 0.35, out: true });
        this.fx.push({ k: 'column', x: x1, y: y1, t: 0, life: 0.5, arrive: true });
        this.fx.push({ k: 'ring', x: x1, y: y1, r: 22, t: 0, life: 0.4 });
        this.sparks(x1, y1 - 10, 16, G, rnd, { sp: 110, life: 0.5, g: 120 });
        this.dust(x1, y1, 8, rnd, { r: 6, life: 0.5, up: 6, side: 40 });
        break;
      }
      case 'kgUnit': {
        this.dust(x, y - 2, 6, rnd, { r: 4, life: 0.45, up: 14, side: 20, cols: ['#e8e0f0', '#c8bcd8', '#a89cc0'] });
        this.fx.push({ k: 'appear', x, y: y - 6, t: 0, life: 0.4, P: G });
        break;
      }
      case 'kgUnitHurt': {
        const f = e.f || 1;
        this.fx.push({ k: 'pow', x, y, f, t: 0, life: 0.14 });
        this.sparks(x, y, 4, FXC.hurt, rnd, { a: f > 0 ? -0.4 : Math.PI + 0.4, spread: 2.2, sp: 80, life: 0.22 });
        break;
      }
      case 'kgUnitDie': {
        const f = e.f || 1, cy = y - (KINGDOM.unitY?.[e.k] ?? 9) * S;
        this.fx.push({ k: 'star', x, y: cy, P: FXC.hurt, t: 0, life: 0.16, big: true });
        this.fx.push({ k: 'pop', x, y: cy, t: 0, life: 0.28, r: 12 });
        this.sparks(x, cy, 8, G, rnd, { a: f > 0 ? -0.5 : Math.PI + 0.5, spread: 2.6, sp: 120, life: 0.35 });
        this.dust(x, cy, 6, rnd, { r: 3, life: 0.5, up: 16, side: 18, cols: ['#e8e0f0', '#c8bcd8', '#a89cc0'] });
        break;
      }
      case 'kgFish': this.fishPop(x, y, rnd); break;
      case 'kgPick': {
        this.fx.push({ k: 'plus', x, y: y - 10, t: 0, life: 0.7 });
        this.sparks(x, y - 3, 5, G, rnd, { sp: 60, life: 0.3, g: 80 });
        break;
      }
      case 'kgDeliver': {
        this.fx.push({ k: 'plus', x, y: y - 16, t: 0, life: 0.9, big: true });
        this.fx.push({ k: 'star', x, y: y - 8, P: G, t: 0, life: 0.16 });
        this.motes(x, y - 4, 6, rnd, { r: 6, up: 30 });
        break;
      }
      case 'kgEat': {
        this.fx.push({ k: 'bite', x, y: y - 3, t: 0, life: 0.3 });
        this.chips(x, y - 2, 7, rnd, ['#c4d6ec', '#7f97b8', '#f4fbff', '#ff9a6a'], { sp: 60, floor: y - 1, life: 0.6 });
        break;
      }
    }
    if (this.fx.length > 80) this.fx.splice(0, this.fx.length - 80);
  }
  fishPop(x, y, rnd) {
    this.fx.push({ k: 'star', x, y: y - 3, P: { core: '#ffffff', hot: '#e8f6ff', mid: '#8ec8ff' }, t: 0, life: 0.3, big: true });
    this.sparks(x, y - 3, 6, { core: '#ffffff', hot: '#e8f6ff', mid: '#8ec8ff' }, rnd, { sp: 60, life: 0.35, g: 120 });
    this.dust(x, y, 3, rnd, { r: 3, life: 0.4, up: 6, side: 14, cols: ['#8ec8ff', '#c4e2ff'] });
  }

  // ---- update: game time, and the moments read off state ----
  update(dt, state) {
    const T = state?.time;
    let d = dt;
    if (Number.isFinite(T)) { d = this.lastT === null || T < this.lastT - 0.5 ? 0 : Math.max(0, Math.min(0.1, T - this.lastT)); this.lastT = T; }
    this.step(d);
    const list = state?.kingdoms || [];
    this.kings = list;
    if (list.length || this.mem.size) this.watch(list, d);
    this.watchFish(state?.fish || [], d);
  }
  step(d) {
    this.clock += d;
    if (this.later.length) { const due = this.later.filter(q => q.at <= this.clock); this.later = this.later.filter(q => q.at > this.clock); for (const q of due) q.run(); }
    if (!(d > 0)) return;
    for (const q of this.fx) q.t += d;
    if (this.fx.length) this.fx = this.fx.filter(q => q.t < q.life);
    for (const p of this.parts) {
      p.t += d;
      p.vy += p.g * d;
      const k = Math.pow(p.drag, d);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * d; p.y += p.vy * d;
      if (p.floor !== null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; if (Math.abs(p.vy) < 12) { p.vy = 0; p.g = 0; p.vx *= 0.5; } }
    }
    if (this.parts.length) this.parts = this.parts.filter(p => p.t < p.life);
  }
  watch(list, d) {
    const live = new Set();
    for (const kg of list) {
      live.add(kg.id);
      const m = this.memOf(kg), rnd = seeded(((kg.id * 7919) ^ Math.floor(this.clock * 60)) >>> 0);
      const bx = kg.x * S, by = kg.y * S, lv = kg.lv;
      // A build finishing: a burst of sparkle over the new house or castle.
      if (m.st === 'up' && kg.st === 'stand' && lv >= 2) {
        this.sparks(bx, by - TOP[lv] * 0.6, 18, FXC.gold, rnd, { sp: 120, life: 0.6, g: 80 });
        this.motes(bx, by - 4, 10, rnd, { r: lv === 3 ? 28 : 18, up: 40 });
      }
      // The collapse: chunks of it thrown out, a cloud of dust (lv1: the pole topples, then thuds).
      if (kg.st === 'fall' && !m.fell) {
        m.fell = true;
        if (lv === 1) this.dust(bx, by, 6, rnd, { r: 4, life: 0.5, up: 6, side: 20 });
        else {
          const w = KINGDOM.w[lv] * S, h = TOP[lv];
          const cols = lv === 2 ? [...FXC.stoneChips, ...FXC.roof, KP.p1, KP.w2] : FXC.stoneChips;
          const n = lv === 2 ? 8 : 10;
          for (let i = 0; i < n; i++) {
            const px = bx + (rnd() - 0.5) * w, py = by - 6 - rnd() * h * 0.8, sd = Math.sign(px - bx) || 1;
            this.part('chunk', px, py, sd * (20 + rnd() * 60), -60 - rnd() * 70, 0.9 + rnd() * 0.4, cols[Math.floor(rnd() * cols.length)], { g: 420, drag: 0.6, floor: by - 1, s: 2 + Math.floor(rnd() * 2), spin: rnd() * 6 });
          }
          this.dust(bx, by, 22, rnd, { r: w / 2, life: 1.1, up: 16, side: 40 });
          this.dust(bx, by - h * 0.4, 8, rnd, { r: w / 3, life: 0.9, up: 6, side: 20 });
        }
      }
      if (kg.st === 'fall' && lv === 1 && !m.thud && kg.t >= KINGDOM.fall * 0.55) {
        m.thud = true;
        const lx = bx + (m.hitF || 1) * 26;
        this.dust(lx, by, 10, rnd, { r: 16, life: 0.6, up: 8, side: 30 });
        this.chips(lx, by - 2, 4, rnd, FXC.woodChips, { sp: 50, floor: by - 1 });
      }
      // Building: dust puffing off the scaffold.
      if (kg.st === 'up' && lv >= 2 && (m.dustT -= d) <= 0) {
        m.dustT = 0.12;
        const w = KINGDOM.w[lv] * S, rev = TOP[lv] * ease(clamp01(kg.t / KINGDOM.up));
        this.dust(bx + (rnd() - 0.5) * w, by - rnd() * rev, 2, rnd, { r: 2, life: 0.5, up: 8, side: 16 });
        if (rnd() < 0.5) this.part('mote', bx + (rnd() - 0.5) * w, by - rev, 0, -20, 0.5, FXC.gold.hot, { drag: 0.5 });
      }
      // The house's chimney smokes; a badly damaged house or castle smoulders.
      if (kg.st === 'stand' && lv === 2 && (m.chimT -= d) <= 0) {
        m.chimT = 0.45 + rnd() * 0.2;
        this.part('smoke', bx + 14, by - 38, 3 + rnd() * 4, -12 - rnd() * 6, 1.6, FXC.smoke[1 + Math.floor(rnd() * 3)], { s: 2, drag: 0.6, grow: 3 });
      }
      if (kg.st === 'stand' && stageOf(kg) === 2 && (m.smokeT -= d) <= 0) {
        m.smokeT = 0.3 + rnd() * 0.2;
        const w = (KINGDOM.w[lv] || 20) * S, h = lv === 1 ? 20 : TOP[lv];
        this.part('smoke', bx + (rnd() - 0.5) * w * 0.8, by - h * (0.3 + rnd() * 0.6), (rnd() - 0.5) * 6, -10 - rnd() * 8, 1.2, FXC.smoke[Math.floor(rnd() * 4)], { s: 2, drag: 0.6, grow: 3 });
      }
      // The aura's dome grows to its tier, and at the castle sweeps out over the whole arena.
      const T = tierOf(kg), tx = T === 3 ? 900 : T > 0 ? KINGDOM.aura[T] * S : 0, ty = T === 3 ? 700 : T > 0 ? KINGDOM.auraY[T] * S : 0;
      const k = 1 - Math.exp(-d * (T === 3 ? 1.6 : 5));
      m.rx += (tx - m.rx) * k; m.ry += (ty - m.ry) * k;
      m.tier = T;
      m.st = kg.st; m.lv = lv;
    }
    if (this.mem.size > live.size) for (const id of this.mem.keys()) if (!live.has(id)) this.mem.delete(id);
  }
  watchFish(fish, d) {
    for (const f of fish) {
      if (this.fishSeen.has(f.id)) continue;
      this.fishSeen.set(f.id, this.clock);
      // The first time a fish is seen it pops in with a sparkle (unless its event already did).
      const x = f.x * S, y = f.y * S;
      if (!this.fx.some(q => q.k === 'star' && q.t < 0.1 && Math.abs(q.x - x) < 2 && Math.abs(q.y - (y - 3)) < 2)) this.fishPop(x, y, seeded(f.id * 977));
    }
    if (this.fishSeen.size > fish.length + 8) { const ids = new Set(fish.map(f => f.id)); for (const id of this.fishSeen.keys()) if (!ids.has(id)) this.fishSeen.delete(id); }
  }

  // ---- the structures ----
  // Paint one level as it stands (sprite and its moving parts) into g with its base at (AX, AY).
  paintLevel(g, kg, lv, time, { stage = 0, unroll = 1, mound = true, seed = 0 } = {}) {
    const col = kingdomColor(kg.by);
    if (lv === 1) {
      const M = moundSprite(), Pp = poleSprite();
      if (mound) g.drawImage(M.c, AX - M.ax, AY - M.ay);
      g.drawImage(Pp.c, AX - Pp.ax, AY - Pp.ay);
      if (unroll > 0) {
        drawBanner(g, AX, AY - 37, 1, unroll, time, seed, stage);
        // The owner's ribbons tied to the ends of the rod.
        const n = Math.max(1, Math.round(7 * unroll));
        for (const sd of [-1, 1]) for (let i = 0; i < n; i++) {
          const sw = Math.round(Math.sin(time * 2.3 + seed + sd + i * 0.5) * (i / 7) * 1.5);
          g.fillStyle = i === n - 1 ? KP.g2 : i % 3 === 2 ? shade(col) : col;
          g.fillRect(AX + sd * 6 + sw, AY - 37 + i, 1, 1);
        }
      }
      return;
    }
    if (lv === 2) {
      const H = houseSprite(stage);
      g.drawImage(H.c, AX - H.ax, AY - H.ay);
      drawPennant(g, AX, AY - 44, time, seed, { len: 9, color: col, torn: stage >= 2 ? 1 : 0 });
      // The fish brought in so far, heaped by the door.
      const n = Math.min(kg.res || 0, 4);
      const HEAP = [[7, -3], [11, -3], [9, -5], [8, -7]];
      for (let i = 0; i < n; i++) g.drawImage(fishSprite('heap', i % 2), AX + HEAP[i][0], AY + HEAP[i][1]);
      return;
    }
    const C = castleSprite(stage, col);
    g.drawImage(C.c, AX - C.ax, AY - C.ay);
    drawBanner(g, AX, AY - 51, 1, 1, time, seed, stage);
  }
  // Compose the kingdom into its canvas for this frame.
  compose(kg, m, time) {
    const g = m.c.getContext('2d'), seed = (kg.id % 7) * 0.9;
    g.clearRect(0, 0, CW, CH);
    const st = kg.st, lv = kg.lv, stage = stageOf(kg);
    if (st === 'up' && lv === 1) {
      const u = clamp01((kg.t - flyT(kg)) / (KINGDOM.up - flyT(kg)));
      this.paintLevel(g, kg, 1, time, { unroll: ease(u), seed });
      return;
    }
    if (st === 'up' && lv >= 2) {
      const u = clamp01(kg.t / KINGDOM.up), fade = 1 - clamp01(kg.t / 0.3);
      if (fade > 0) { g.globalAlpha = fade; this.paintLevel(g, kg, lv - 1, time, { seed }); g.globalAlpha = 1; }
      // The new one rises out of the ground, row by row, behind its scaffold.
      const g2 = m.c2.getContext('2d');
      g2.clearRect(0, 0, CW, CH);
      this.paintLevel(g2, kg, lv, time, { stage, seed });
      const rev = Math.round((TOP[lv] + 2) * ease(u));
      if (rev > 0) g.drawImage(m.c2, 0, AY - rev, CW, rev, 0, AY - rev, CW, rev);
      this.scaffold(g, lv, u, rev);
      return;
    }
    this.paintLevel(g, kg, lv, time, { stage, seed, mound: !(st === 'fall' && lv === 1) });
  }
  // Timber scaffolding around a build: poles at the corners and between, planks every 8 rows.
  scaffold(g, lv, u, rev) {
    const hw = Math.round(KINGDOM.w[lv] * S / 2) + 2, top = Math.min(TOP[lv] + 2, rev + 10);
    const a = u < 0.08 ? u / 0.08 : u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
    if (a <= 0) return;
    g.globalAlpha = a;
    const poles = lv === 2 ? [-hw, -6, 6, hw] : [-hw, -hw + 14, -7, 7, hw - 14, hw];
    for (const x of poles) for (let y = 1; y <= top; y++) { g.fillStyle = y % 6 === 0 ? KP.w1 : KP.w3; g.fillRect(AX + x, AY - y, 1, 1); }
    for (let y = 8; y <= top; y += 8) {
      g.fillStyle = KP.w4; g.fillRect(AX - hw - 1, AY - y, hw * 2 + 3, 1);
      g.fillStyle = KP.w1; g.fillRect(AX - hw - 1, AY - y + 1, hw * 2 + 3, 1);
    }
    // Diagonal bracing in the bays.
    g.fillStyle = KP.w2;
    for (let i = 0; i < poles.length - 1; i++) {
      const x0 = poles[i], x1 = poles[i + 1], span = x1 - x0;
      for (let y = 8; y + 8 <= top; y += 8) for (let s = 1; s < span; s++) if (s % 2 === 0) g.fillRect(AX + x0 + s, AY - y - Math.round((s / span) * 7), 1, 1);
    }
    g.globalAlpha = 1;
  }
  // Where and how a kingdom's canvas goes on screen: hurt shake, the collapse's sink and tilt.
  placement(kg, m, ox, oy, time) {
    const bx = X(kg.x) + ox, by = X(kg.y) + oy;
    if (kg.st === 'fall') {
      const u = clamp01(kg.t / KINGDOM.fall), dir = m.hitF || 1;
      if (kg.lv === 1) return { bx, by, sink: 0, ang: dir * (Math.PI / 2) * easeIn(clamp01(u / 0.55)), alpha: 1 - clamp01((u - 0.65) / 0.35), pivot: 2 };
      return { bx, by, sink: Math.round(8 * ease(u)), ang: dir * 0.06 * ease(u), alpha: 1 - clamp01((u - 0.5) / 0.5), pivot: 0 };
    }
    const dx = kg.hurt > 0 ? (Math.floor(time * 40) % 2 ? 1 : -1) : 0;
    return { bx: bx + dx, by, sink: 0, ang: 0, alpha: 1, pivot: 0 };
  }
  blit(g, c, p, ox = 0, oy = 0) {
    if (p.alpha <= 0) return;
    const a = g.globalAlpha;
    g.globalAlpha = a * p.alpha;
    if (!p.ang && !p.sink) g.drawImage(c, p.bx - AX + ox, p.by - AY + oy);
    else {
      g.save();
      g.beginPath(); g.rect(p.bx + ox - CW, p.by + oy - CH * 1.5, CW * 2, CH * 1.5); g.clip();
      g.translate(p.bx + ox, p.by + oy + p.sink - p.pivot);
      g.rotate(p.ang);
      g.drawImage(c, -AX, -AY + p.pivot);
      g.restore();
    }
    g.globalAlpha = a;
  }
  // The banner flying from the King's paw to its spot, furled, tilted along its flight.
  drawFlight(lg, kg, ox, oy, time) {
    const u = clamp01(kg.t / flyT(kg)), x0 = X(kg.ox ?? kg.x) + ox, x1 = X(kg.x) + ox, y1 = X(kg.y) + oy;
    const far = Math.abs(x1 - x0) > 2, y0 = y1 - (far ? 27 : 8);
    const x = lerp(x0, x1, far ? u : 1), y = lerp(y0, y1, far ? easeIn(u) : easeIn(u)) - (far ? Math.sin(Math.PI * u) * 10 : 0);
    const ang = far ? Math.sign(x1 - x0) * (1 - u) * 0.5 : 0;
    const Pp = poleSprite();
    lg.save();
    lg.translate(Math.round(x), Math.round(y));
    lg.rotate(ang);
    lg.drawImage(Pp.c, -Pp.ax, -Pp.ay);
    // The furled cloth around the pole.
    lg.fillStyle = KP.r1; lg.fillRect(-2, -36, 4, 22);
    lg.fillStyle = KP.r3; lg.fillRect(-2, -36, 2, 22);
    lg.fillStyle = KP.g2; lg.fillRect(-2, -37, 5, 1); lg.fillRect(-2, -26, 4, 1); lg.fillRect(-2, -15, 4, 1);
    lg.restore();
  }

  drawStructures(lg, state, ox, oy) {
    if (!state?.kingdoms?.length) return;
    const time = state.time ?? 0;
    for (const kg of state.kingdoms) {
      const m = this.memOf(kg);
      m.place = null;
      if (kg.st === 'up' && kg.lv === 1 && kg.t < flyT(kg)) { this.drawFlight(lg, kg, ox, oy, time); continue; }
      this.compose(kg, m, time);
      const p = this.placement(kg, m, ox, oy, time);
      m.place = p; m.time = time;
      // A toppling banner leaves its mound behind.
      if (kg.st === 'fall' && kg.lv === 1) { const M = moundSprite(); lg.globalAlpha = 1 - clamp01((kg.t / KINGDOM.fall - 0.6) / 0.4); lg.drawImage(M.c, X(kg.x) + ox - M.ax, X(kg.y) + oy - M.ay); lg.globalAlpha = 1; }
      this.blit(lg, m.c, p);
      // Struck: a white flash.
      if (kg.hurt > 0 && kg.st !== 'fall') { lg.globalAlpha = Math.min(1, kg.hurt / 0.25) * 0.85; this.blit(lg, whiteOf(m.c, m.w), p); lg.globalAlpha = 1; }
    }
  }

  // ---- fish ----
  drawFish(lg, state, ox, oy) {
    if (!state?.fish?.length) return;
    const time = state.time ?? 0;
    for (const f of state.fish) {
      const x = X(f.x) + ox, y = X(f.y) + oy, id = f.id | 0;
      const cyc = (time + id * 0.61) / 1.5, ph = (cyc - Math.floor(cyc)) * 1.5, n = Math.floor(cyc);
      const hop = ph < 0.32, u = ph / 0.32, lift = hop ? Math.round(Math.sin(Math.PI * u) * 4) : 0;
      const flip = ((n + id) & 1) ^ (hop && u > 0.5 ? 1 : 0);
      // Its shadow on the floor (smaller as it leaves it).
      lg.fillStyle = '#0a0612'; lg.globalAlpha = 0.45;
      lg.fillRect(x - (lift > 2 ? 2 : 3), y - 1, lift > 2 ? 5 : 7, 1);
      lg.globalAlpha = 1;
      lg.drawImage(fishSprite(hop ? 'flop' : 'lie', flip), x - 3, y - 4 - lift - (hop ? 0 : 0));
    }
  }

  // ---- units ----
  unitOpts(kg) { return { color: kingdomColor(kg.by), lv: kg.lv }; }
  isFront(u) { return u.st === 'hit' || u.k === 'archer' || !!u.air; }
  drawUnits(lg, state, ox, oy, front) {
    if (state?.kingdoms?.length) {
      const time = state.time ?? 0, cm = this.r?.courtMod;
      if (!front) {
        // Little contact shadows on the floor.
        lg.fillStyle = '#0a0612';
        for (const kg of state.kingdoms) for (const u of kg.u || []) {
          if (u.air || u.k === 'archer' || u.st === 'dead') continue;
          const sx = X(u.x) + ox, sy = X(u.y) + oy, w = u.k === 'knight' ? 4 : 3;
          lg.globalAlpha = 0.35;
          lg.fillRect(sx - w, sy - 1, w * 2 + 1, 1); lg.fillRect(sx - w + 1, sy, w * 2 - 1, 1);
        }
        lg.globalAlpha = 1;
      }
      for (const kg of state.kingdoms) {
        const opts = this.unitOpts(kg);
        for (const u of kg.u || []) {
          if (this.isFront(u) !== !!front) continue;
          if (cm?.drawUnit) cm.drawUnit(lg, u, ox, oy, time, opts);
          else placeholderUnit(lg, u, ox, oy, time, opts);
        }
        lg.globalAlpha = 1;
        // The towers' front battlements, over the archers' legs.
        if (front && kg.lv === 3 && kg.st !== 'fall') this.drawParapet(lg, kg, ox, oy, time);
      }
    }
    if (front) this.drawLitParts(lg, ox, oy);
  }
  drawParapet(g, kg, ox, oy, time) {
    const m = this.mem.get(kg.id), P = parapetSprite(stageOf(kg)), p = m?.place;
    if (!p) return;
    if (kg.st === 'up') {
      const rev = Math.round((TOP[3] + 2) * ease(clamp01(kg.t / KINGDOM.up)));
      const from = P.ay - rev;
      if (rev < 64) return;
      g.drawImage(P.c, 0, from, P.w, rev, p.bx - P.ax, p.by - rev, P.w, rev);
      return;
    }
    g.drawImage(P.c, p.bx - P.ax, p.by - P.ay);
    if (kg.hurt > 0) { g.globalAlpha = Math.min(1, kg.hurt / 0.25) * 0.85; g.drawImage(whiteOf(P.c, this.pw ||= mk(1, 1)), p.bx - P.ax, p.by - P.ay); g.globalAlpha = 1; }
  }
  drawLitParts(g, ox, oy) {
    for (const p of this.parts) {
      if (p.k !== 'dust' && p.k !== 'chip' && p.k !== 'chunk' && p.k !== 'smoke') continue;
      const k = p.t / p.life;
      if (p.k === 'dust' || p.k === 'smoke') {
        const sz = Math.round(p.s + k * (p.grow ?? 2));
        g.globalAlpha = (p.k === 'smoke' ? 0.55 : 0.7) * (1 - k);
        g.fillStyle = p.c; g.fillRect(Math.round(p.x - sz / 2 + ox), Math.round(p.y - sz / 2 + oy), sz, sz);
      } else {
        g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
        g.fillStyle = p.c;
        const s = p.s, rot = p.k === 'chunk' && p.vy !== 0 ? Math.floor(p.t * (p.spin || 4)) % 2 : 0;
        g.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), rot ? s : s + (p.k === 'chunk' ? 1 : 0), rot ? s + 1 : s);
      }
    }
    g.globalAlpha = 1;
  }

  // ---- after the light map: the kingdom keeps a little of its own colour ----
  drawKeep(lg, state, ox, oy, figures = null) {
    if (!state?.kingdoms?.length) return;
    const time = state.time ?? 0, cm = this.r?.courtMod;
    let c = this.scratch;
    if (!c) { c = this.scratch = mk(CW, CH); c.getContext('2d').imageSmoothingEnabled = false; }
    const sg = c.getContext('2d');
    const punch = (g, x0, y0, w, h) => {
      g.globalCompositeOperation = 'destination-out';
      for (const f of figures || []) if (f?.fc?.body?.c && f.x < x0 + w && f.y < y0 + h && f.x + f.fc.body.c.width > x0 && f.y + f.fc.body.c.height > y0) g.drawImage(f.fc.body.c, f.x - x0, f.y - y0);
      g.globalCompositeOperation = 'source-over';
    };
    // The structures, at a quarter, cut out where a fighter stands in front.
    for (const kg of state.kingdoms) {
      const m = this.mem.get(kg.id), p = m?.place;
      if (!p || m.time !== time) continue;
      const x0 = p.bx - AX, y0 = p.by - AY;
      sg.clearRect(0, 0, CW, CH);
      this.blit(sg, m.c, p, -x0, -y0);
      punch(sg, x0, y0, CW, CH);
      lg.globalAlpha = 0.25;
      lg.drawImage(c, x0, y0);
      lg.globalAlpha = 1;
    }
    // The units, as the court keeps its colour: the ones behind cut out where a fighter stands.
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, any = false;
    for (const kg of state.kingdoms) for (const u of kg.u || []) { const x = X(u.x) + ox, y = X(u.y) + oy; bx0 = Math.min(bx0, x - 14); bx1 = Math.max(bx1, x + 14); by0 = Math.min(by0, y - 24); by1 = Math.max(by1, y + 4); any = true; }
    if (!any) return;
    bx0 = Math.floor(bx0); by0 = Math.floor(by0);
    const w = Math.ceil(bx1 - bx0), h = Math.ceil(by1 - by0);
    let u = this.ukeep;
    if (!u || u.width < w || u.height < h) { u = this.ukeep = mk(Math.max(w, u?.width || 0), Math.max(h, u?.height || 0)); u.getContext('2d').imageSmoothingEnabled = false; }
    const ug = u.getContext('2d');
    ug.globalCompositeOperation = 'source-over'; ug.globalAlpha = 1;
    ug.clearRect(0, 0, u.width, u.height);
    for (const front of [false, true]) {
      for (const kg of state.kingdoms) {
        const opts = this.unitOpts(kg);
        for (const v of kg.u || []) {
          if (this.isFront(v) !== front) continue;
          if (cm?.drawUnit) cm.drawUnit(ug, v, ox - bx0, oy - by0, time, opts); else placeholderUnit(ug, v, ox - bx0, oy - by0, time, opts);
          ug.globalAlpha = 1;
        }
      }
      if (!front) punch(ug, bx0, by0, w, h);
    }
    lg.globalAlpha = 0.45;
    lg.drawImage(u, 0, 0, w, h, bx0, by0, w, h);
    lg.globalAlpha = 1;
  }

  // ---- emissive: the aura, the lit windows, the torches, the ghost banner, the units' glow ----
  drawGlow(eg, state, ox, oy) {
    const time = state?.time ?? 0;
    if (state?.kingdoms?.length) {
      let castle = false;
      for (const kg of state.kingdoms) {
        const m = this.mem.get(kg.id), bx = X(kg.x) + ox, by = X(kg.y) + oy;
        if (m && m.rx > 3) this.drawDome(eg, kg, m, bx, by, time);
        if (kg.lv === 3 && kg.st === 'stand') castle = true;
        if (kg.st === 'fall' || !m?.place) continue;
        const p = m.place, rev = kg.st === 'up' && kg.lv >= 2 ? Math.round((TOP[kg.lv] + 2) * ease(clamp01(kg.t / KINGDOM.up))) : 999;
        const flick = i => 0.8 + 0.2 * Math.sin(time * 11 + i * 2.1) * Math.sin(time * 4.3 + i);
        // Windows.
        (WINDOWS[kg.lv] || []).forEach((w, i) => {
          if (-w.y > rev) return;
          eg.globalAlpha = flick(i) * (stageOf(kg) === 2 && i % 2 ? 0.35 : 0.9);
          for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) {
            if (kg.lv === 2 && w.w === 5 && (x === w.x || x === w.x + 4 || y === w.y || y === w.y + 4 || x === w.x + 2 || y === w.y + 2)) continue;
            if (w.arch && y === w.y && x !== w.x + 1) continue;
            eg.fillStyle = y >= w.y + w.h - 2 ? '#ffd890' : '#ffb060';
            eg.fillRect(p.bx + x, p.by + y, 1, 1);
          }
        });
        eg.globalAlpha = 1;
        // The finial's jewel and a glint now and then.
        if (kg.lv === 1) {
          eg.fillStyle = '#ff8a8a'; eg.fillRect(p.bx, p.by - 42, 1, 1);
          const gp = (time * 0.5 + kg.id * 0.37) % 1;
          if (gp < 0.12) glint(eg, FXC.gold, p.bx, p.by - 44, Math.round(3 * Math.sin((gp / 0.12) * Math.PI)) + 1);
        }
        // The castle's torches, and its big banner glowing.
        if (kg.lv === 3 && rev > 30) {
          for (const sd of [-1, 1]) this.flame(eg, p.bx + sd * TORCH.x, p.by + TORCH.y - 1, time + sd);
          if (kg.st === 'stand') {
            const seed = (kg.id % 7) * 0.9, a = 0.35 + 0.2 * Math.sin(time * 2.4);
            eg.globalAlpha = a;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawBannerTint(eg, p.bx + dx, p.by - 51 + dy, 1, time, seed, '#ffd76a', stageOf(kg));
            eg.globalAlpha = 1;
            eg.globalCompositeOperation = 'destination-out';
            drawBannerTint(eg, p.bx, p.by - 51, 1, time, seed, '#000000', stageOf(kg));
            eg.globalCompositeOperation = 'source-over';
            const cp = (time * 0.4) % 1;
            if (cp < 0.1) glint(eg, FXC.gold, p.bx, p.by - 41, Math.round(3 * Math.sin((cp / 0.1) * Math.PI)) + 1);
          }
        }
        // A build's leading edge.
        if (kg.st === 'up' && kg.lv >= 2 && rev < TOP[kg.lv]) {
          const hw = Math.round(KINGDOM.w[kg.lv] * S / 2);
          for (let x = -hw; x <= hw; x++) if ((x + Math.floor(time * 30)) % 3) { eg.fillStyle = x % 4 ? FXC.gold.mid : FXC.gold.hot; eg.globalAlpha = 0.7; eg.fillRect(p.bx + x, p.by - rev, 1, 1); }
          eg.globalAlpha = 1;
        }
      }
      // The castle's aura is the whole arena: gold motes drifting everywhere.
      if (castle) this.drawMotes(eg, ox, oy, time);
      // The units' glowing bits.
      const cm = this.r?.courtMod;
      if (cm?.drawUnitGlow) for (const kg of state.kingdoms) { const opts = this.unitOpts(kg); for (const u of kg.u || []) { cm.drawUnitGlow(eg, u, ox, oy, time, opts); eg.globalAlpha = 1; } }
    }
    // Where a King's banner would go if he pressed K now.
    for (const a of state?.actors || []) if (a.pk != null && !a.bot && !a.dead && (this.localId == null || a.id === this.localId)) this.drawGhost(eg, X(a.pk) + ox, X(a.y + HALF_H) + oy, time);
    // Fish catching the light.
    for (const f of state?.fish || []) {
      const cyc = (time + (f.id | 0) * 0.61) / 1.5, ph = (cyc - Math.floor(cyc)) * 1.5;
      if (ph > 0.7 && ph < 0.86) { eg.fillStyle = '#ffffff'; eg.globalAlpha = 0.9; eg.fillRect(X(f.x) + ox, X(f.y) + oy - 4, 1, 1); eg.globalAlpha = 0.5; eg.fillRect(X(f.x) + ox - 1, X(f.y) + oy - 4, 1, 1); eg.fillRect(X(f.x) + ox + 1, X(f.y) + oy - 4, 1, 1); eg.globalAlpha = 1; }
    }
  }
  flame(g, x, y, t) {
    const f = Math.floor(t * 12) % 3, h = 3 + (f === 1 ? 1 : 0);
    g.fillStyle = '#ff9a35'; g.fillRect(x - 1, y - h + 1, 3, h - 1);
    g.fillStyle = '#ffd25c'; g.fillRect(x, y - h, 1, h); if (f === 2) g.fillRect(x - 1, y - h + 1, 1, 1);
    g.fillStyle = '#fff6c4'; g.fillRect(x, y - 1, 1, 1);
  }
  // The aura: a gold half-dome standing on the base line (exactly the shape buffTier tests), dithered rim,
  // a gentle pulse, a gleam running round it, motes rising inside.
  drawDome(g, kg, m, cx, cy, time) {
    const rx = Math.round(m.rx), ry = Math.round(m.ry), seed = kg.id * 1.7;
    const fadeOut = (m.tier === 3 || kg.st === 'fall') ? clamp01(1 - (m.rx - 120) / 380) * (kg.st === 'fall' ? clamp01(1 - kg.t * 2) : 1) : 1;
    if (fadeOut <= 0.02 || rx < 3 || ry < 3) return;
    const pulse = (0.05 + 0.025 * (1 + Math.sin(time * 2.2 + seed))) * fadeOut;
    g.fillStyle = '#ffd76a';
    for (let j = 0; j < ry; j++) {
      const v = j / ry, w = Math.round(rx * Math.sqrt(1 - v * v));
      g.globalAlpha = pulse * (0.45 + 0.55 * v * v);
      g.fillRect(cx - w, cy - 1 - j, w * 2 + 1, 1);
    }
    // The rim: every other cell, brighter where the gleam passes.
    const n = Math.round(Math.PI * (rx + ry) * 0.75), gl = (time * 0.9 + seed) % (Math.PI * 1.6) - 0.3;
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * i) / n, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy - 1 - Math.sin(a) * ry);
      const near = Math.max(0, 1 - Math.abs(a - gl) / 0.25);
      if ((x + y) & 1 && near < 0.3) continue;
      g.globalAlpha = (0.35 + 0.6 * near) * fadeOut;
      g.fillStyle = near > 0.5 ? '#fff2a8' : '#ffc838';
      g.fillRect(x, y, 1, 1);
    }
    // The base line on the floor.
    g.fillStyle = '#ffc838';
    for (let x = -rx; x <= rx; x++) if ((x + Math.floor(time * 6)) % 4 === 0) { g.globalAlpha = 0.45 * fadeOut * (1 - Math.abs(x) / rx * 0.5); g.fillRect(cx + x, cy - 1, 1, 1); }
    // Motes rising inside.
    const nm = m.tier === 2 ? 6 : 4;
    for (let i = 0; i < nm; i++) {
      const u = (time * 0.32 + i * 0.173 + seed) % 1, sx = Math.sin(i * 12.9898 + seed) * 0.8;
      const x = cx + sx * rx + Math.sin(time * 1.3 + i) * 3, top = ry * Math.sqrt(Math.max(0, 1 - sx * sx)) * 0.9, y = cy - 2 - u * top;
      g.globalAlpha = Math.sin(Math.PI * u) * 0.9 * fadeOut;
      g.fillStyle = u < 0.5 ? '#fff2a8' : '#ffc838';
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    g.globalAlpha = 1;
  }
  drawMotes(g, ox, oy, time) {
    for (let i = 0; i < 12; i++) {
      const sp = 5 + (i % 4) * 3, x = ((i * 97.31 + time * sp * (i % 2 ? 1 : -1)) % 680 + 680) % 680 - 20;
      const y = ((i * 53.7 + 360 - ((time * (4 + (i % 3) * 2)) % 360)) % 360) + Math.sin(time * 0.8 + i) * 6;
      const tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
      g.globalAlpha = 0.25 + 0.55 * tw;
      g.fillStyle = tw > 0.8 ? '#fff2a8' : '#ffc838';
      g.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1);
      if (tw > 0.92) { g.globalAlpha = 0.4; g.fillRect(Math.round(x + ox) - 1, Math.round(y + oy), 3, 1); g.fillRect(Math.round(x + ox), Math.round(y + oy) - 1, 1, 3); }
    }
    g.globalAlpha = 1;
  }
  // The ghost hint: a dashed gold outline of the banner where it would stand (13 x 40), pulsing.
  drawGhost(g, x, y, time) {
    const a = 0.25 + 0.12 * (1 + Math.sin(time * 5)), march = Math.floor(time * 10);
    g.fillStyle = '#ffd76a';
    const dot = (px, py, i) => { if ((i + march) % 3 === 2) return; g.globalAlpha = a; g.fillRect(x + px, y + py, 1, 1); };
    let i = 0;
    for (let py = -40; py <= -1; py++) dot(0, py, i++);
    for (let px = -6; px <= 6; px++) dot(px, -37, i++);
    for (let py = -36; py <= -8; py++) { dot(-6, py, py); dot(6, py, py + 1); }
    for (let px = -6; px <= 6; px++) { const notch = Math.max(0, 4 - Math.abs(px)); dot(px, -7 - notch, px + 9); }
    dot(-1, -42, 0); dot(1, -42, 1); dot(0, -43, 2); dot(-2, -43, 0); dot(2, -43, 1);
    for (let px = -3; px <= 3; px++) dot(px, 0, px);
    g.globalAlpha = 1;
  }

  // ---- emissive: event effects and glowing particles ----
  drawEffects(g, ox, oy) {
    const dot = (c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    const G = FXC.gold;
    for (const q of this.fx) {
      const u = q.t / q.life;
      switch (q.k) {
        case 'ring': {
          // A ring racing out over the floor (seen from the side: a flat ellipse), and a second inside it.
          for (const [R0, a0] of [[q.r, 1], [q.r * 0.6, 0.6]]) {
            const R = R0 * (0.25 + 0.75 * ease(u)), n = Math.max(16, Math.round(R * 3));
            g.globalAlpha = (1 - u) * a0;
            for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2; if (q.dust && i % 2) continue; dot(Math.sin(an) > 0 ? G.hot : G.mid, q.x + Math.cos(an) * R, q.y - 1 + Math.sin(an) * R * 0.22); }
          }
          g.globalAlpha = 1;
          break;
        }
        case 'star': {
          const r = Math.round((q.big ? 8 : 5) * (1 - u * 0.6));
          glint(g, q.P || G, q.x + ox, q.y + oy, r);
          if (q.big) { const d = Math.round(r * 0.6); dot(q.P?.hot || G.hot, q.x - d, q.y - d); dot(q.P?.hot || G.hot, q.x + d, q.y - d); dot(q.P?.hot || G.hot, q.x - d, q.y + d); dot(q.P?.hot || G.hot, q.x + d, q.y + d); }
          break;
        }
        case 'pillar': {
          // A shaft of light from the top of the screen onto the build, rays flung out, a ring at its foot.
          const pw = Math.round(q.w * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85)), top = -oy - 4;
          if (pw > 0) for (let y = top; y < q.y; y++) {
            const v = (y - top) / Math.max(1, q.y - top);
            g.globalAlpha = (1 - u) * (0.18 + 0.3 * v);
            dot(G.hot, q.x - pw / 2, y, pw, 1);
            g.globalAlpha = (1 - u) * 0.5;
            dot(G.core, q.x - 1, y, 2, 1);
          }
          g.globalAlpha = 1;
          for (let i = 0; i < 14; i++) {
            const an = (i / 14) * Math.PI * 2 + q.seed, r0 = 12 + u * 34, len = (i % 2 ? 10 : 18) * (1 - u);
            for (let d = 0; d < len; d++) { g.globalAlpha = 1 - u; dot(d < 3 ? G.core : d < len * 0.6 ? G.hot : G.mid, q.x + Math.cos(an) * (r0 + d), q.y - 24 + Math.sin(an) * (r0 + d) * 0.8); }
          }
          g.globalAlpha = 1 - u;
          const R = 8 + ease(u) * 50;
          for (let i = 0; i < 80; i++) { const an = (i / 80) * Math.PI * 2; dot(i % 2 ? G.hot : G.mid, q.x + Math.cos(an) * R, q.y - 1 + Math.sin(an) * R * 0.22); }
          g.globalAlpha = 1;
          if (u < 0.25) glint(g, G, q.x + ox, q.y - 24 + oy, Math.round(10 * (1 - u * 4)) + 2);
          break;
        }
        case 'column': {
          // A gold column on the spot he leaves or arrives at: rising and thinning as he goes, crashing
          // down and spreading as he lands.
          const H = 46, w = q.arrive ? Math.round(9 * (1 - u)) + 1 : q.out ? Math.round(7 * (1 - u)) + 1 : Math.round(3 + 6 * ease(u));
          const h = q.up ? H * ease(Math.min(1, u * 1.6)) : H;
          g.globalAlpha = q.up ? 0.55 * (1 - u * 0.5) : 0.6 * (1 - u);
          for (let y = 0; y < h; y++) { const v = y / H; dot(v < 0.6 ? G.hot : G.mid, q.x - Math.floor(w / 2), q.y - 1 - y, w, 1); if (y % 3 === 0) { g.globalAlpha *= 1; dot(G.core, q.x, q.y - 1 - y, 1, 1); } }
          g.globalAlpha = 1;
          if (q.up) for (let i = 0; i < 3; i++) { const k = (u * 2 + i / 3) % 1; dot(G.core, q.x + Math.sin(i * 2 + u * 9) * 5, q.y - 4 - k * 40); }
          break;
        }
        case 'appear': {
          const R = 10 * ease(u);
          g.globalAlpha = 1 - u;
          for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2 + u; dot(i % 2 ? G.hot : G.mid, q.x + Math.cos(an) * R, q.y + Math.sin(an) * R); }
          g.globalAlpha = 1;
          if (u < 0.5) glint(g, G, q.x + ox, q.y - 2 + oy, Math.round(4 * (1 - u * 2)) + 1);
          break;
        }
        case 'pow': {
          glint(g, FXC.hurt, q.x + ox, q.y + oy, Math.max(1, Math.round(3 * (1 - u))) + 1);
          if (u < 0.6) for (const d of [-1, 1]) for (let j = 2; j < 4; j++) dot(j < 3 ? FXC.hurt.hot : FXC.hurt.mid, q.x + q.f * j, q.y + d * Math.round(j * 0.6));
          break;
        }
        case 'pop': {
          const R = q.r * (0.3 + 0.7 * ease(u));
          g.globalAlpha = 1 - u;
          for (let i = 0; i < 28; i++) { const an = (i / 28) * Math.PI * 2; dot(i % 2 ? FXC.hurt.hot : FXC.hurt.mid, q.x + Math.cos(an) * R, q.y + Math.sin(an) * R * 0.85); }
          g.globalAlpha = 1;
          break;
        }
        case 'plus': {
          // "+1" rising and fading, in gold with a dark rim.
          const y = q.y - ease(Math.min(1, u * 1.5)) * (q.big ? 10 : 7), x = q.x - 3, sc = 1;
          g.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1;
          g.fillStyle = FXC.gold.ink;
          for (const [px, py] of PLUS) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillRect(Math.round(x + px * sc + dx + ox), Math.round(y + py * sc + dy + oy), sc, sc);
          for (const [px, py] of PLUS) { g.fillStyle = py < 2 ? G.hot : G.mid; g.fillRect(Math.round(x + px * sc + ox), Math.round(y + py * sc + oy), sc, sc); }
          g.globalAlpha = 1;
          break;
        }
        case 'bite': {
          // A little chomp: two jaws of white teeth snapping shut.
          const o = Math.round(4 * (1 - Math.min(1, u * 3)));
          g.globalAlpha = 1 - u;
          for (let i = -3; i <= 3; i++) { dot('#ffffff', q.x + i, q.y - 2 - o - (i & 1)); dot('#ffffff', q.x + i, q.y + 2 + o + (i & 1)); }
          g.globalAlpha = 1;
          break;
        }
      }
    }
    for (const p of this.parts) {
      if (p.k !== 'spark' && p.k !== 'mote') continue;
      const k = p.t / p.life;
      if (p.k === 'spark') { g.globalAlpha = 1; dot(p.c, p.x, p.y); g.globalAlpha = 0.5; dot(p.c, p.x - p.vx * 0.012, p.y - p.vy * 0.012); }
      else { g.globalAlpha = 1 - k * 0.8; dot(p.c, p.x, p.y); }
    }
    g.globalAlpha = 1;
  }

  // Lights of the effects (view px, no shake).
  lights(add) {
    for (const q of this.fx) {
      const u = q.t / q.life;
      if (q.k === 'pillar') add({ x: q.x, y: q.y - 20, r: 110, color: '#ffe080', i: 1.5 * (1 - u) });
      else if (q.k === 'ring' && !q.dust) add({ x: q.x, y: q.y - 4, r: 30 + q.r * u, color: '#ffd860', i: 0.9 * (1 - u) });
      else if (q.k === 'column') add({ x: q.x, y: q.y - 20, r: 50, color: '#ffd860', i: 1.0 * (1 - u) });
      else if (q.k === 'star' && q.big) add({ x: q.x, y: q.y, r: 30, color: '#ffe2a0', i: 0.6 * (1 - u) });
    }
  }
}
const shade = hex => { const [r, g, b] = rgbOf(hex); return '#' + [r, g, b].map(v => Math.round(v * 0.62).toString(16).padStart(2, '0')).join(''); };

// Until court-art.js draws the kingdom's units: plain little figures that show where they are and what
// they are doing.
function placeholderUnit(g, u, ox, oy, time, opts) {
  const x = X(u.x) + ox, y = X(u.y) + oy, f = u.f || 1, dead = u.st === 'dead';
  const k = u.k, h = k === 'knight' ? 13 : k === 'archer' ? 11 : 9, w = k === 'knight' ? 8 : 6;
  const app = u.st === 'appear' ? clamp01((u.t || 0) / 0.4) : 1;
  g.globalAlpha = dead ? clamp01(1 - (u.t || 0) / 0.5) : 1;
  const bob = !dead && (u.st === 'go' || u.st === 'back' || u.st === 'chase') ? Math.floor(time * 10) % 2 : 0;
  const hh = Math.max(2, Math.round(h * app)), top = y - hh - bob;
  const flash = u.hurt > 0 ? '#ffffff' : null;
  g.fillStyle = INK; g.fillRect(x - w / 2 - 1, top - 1, w + 2, hh + 1);
  g.fillStyle = flash || (k === 'knight' ? '#9ea4c0' : k === 'archer' ? '#4a9a4a' : '#f0a060'); g.fillRect(x - w / 2, top, w, hh);
  g.fillStyle = flash || (k === 'knight' ? '#c42e3e' : k === 'archer' ? '#2e6a2e' : '#f8d040'); g.fillRect(x - w / 2, top, w, 2);
  g.fillStyle = opts.color; g.fillRect(x - w / 2, top + 3, w, 1);
  g.fillStyle = INK; g.fillRect(x + f * Math.floor(w / 4), top + 2, 1, 1);
  if (u.c) { g.drawImage(fishSprite('lie', f < 0 ? 1 : 0), x - 3, top - 5); }
  if (u.st === 'hit') { g.fillStyle = '#e8eeff'; g.fillRect(x + f * (w / 2 + 1), top + 1, f * 4, 1); }
  g.globalAlpha = 1;
}

// Light descriptors (view px, no shake): the finial, the house's window, the castle's torches, the aura,
// and the event effects of fx (the renderer's KingdomFX).
export function kingdomLights(state, t, fx = null) {
  const out = [];
  for (const kg of state?.kingdoms || []) {
    if (kg.st === 'fall') continue;
    const bx = kg.x * S, by = kg.y * S, T = tierOf(kg);
    const build = kg.st === 'up' ? clamp01(kg.t / KINGDOM.up) : 1;
    const flick = 0.85 + 0.15 * Math.sin(t * 9 + kg.id) * Math.sin(t * 3.7);
    if (kg.lv === 1 && (kg.st !== 'up' || kg.t > flyT(kg))) out.push({ x: bx, y: by - 43, r: 30, color: '#ffd76a', i: 0.25 });
    if (kg.lv === 2) out.push({ x: bx, y: by - 17, r: 50, color: '#ffb060', i: 0.45 * flick * build, occlude: true });
    if (kg.lv === 3) for (const sd of [-1, 1]) out.push({ x: bx + sd * TORCH.x, y: by + TORCH.y - 2, r: 60, color: '#ffb060', i: 0.5 * (0.85 + 0.15 * Math.sin(t * 13 + sd)) * build, occlude: true });
    if (T === 1 || T === 2) out.push({ x: bx, y: by - 10, r: KINGDOM.aura[T] * S, color: '#ffd76a', i: 0.12, noRim: true });
  }
  fx?.lights?.(l => out.push(l));
  return out;
}
