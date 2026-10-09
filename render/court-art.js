// The Cat King's court: the five little cats who follow Mingau and fight on his orders (sim/court.js).
// soldier (sword, helmet and plume), archer (green hood, bow and quiver), assassin (black cat, crimson
// mask, two daggers), mage (pointed hat, starry robe, staff with a crystal; he floats), shield (a big
// kite shield with the royal crest). Each one is built out of shaded pixel primitives into a small
// cached sprite per pose (1-px ink outline, a light rim along the top), then posed from what the
// simulation says it is doing (a.court[i]: st, act, t, vx, air, f): idle breathing, walk and run
// cycles, jumps, every action with its anticipation, strike frame and follow-through, popping in and out.
// The event effects (slashes, stabs, lightning, meteors, the shockwave, smoke, the royal arc), the
// arrows and magic bolts and the lights are drawn from fx events and observable state, so remote peers
// see the same thing. Pure at load time (no DOM until something is drawn).
//
// Hooks (renderer.js):
//   const court = new CourtFX(renderer)
//   court.event(e)                                 every fx event
//   court.update(dt)                               every frame (game time)
//   court.drawCourt(g, a, ox, oy, t, front)        lit layer: front=false before the fighters (the
//                                                  court in formation, behind the King), front=true
//                                                  after them (the shield on guard and every familiar
//                                                  acting, so the blows read over the fighters)
//   court.drawCourtGlow(g, a, ox, oy, t)           emissive layer: crystal, eyes, spells, the decree's aura
//   court.drawEffects(g, ox, oy, t)                emissive layer: the event effects
//   court.drawBullet(g, b, ox, oy, t)              arrows and magic bolts; true if it drew b
//   courtLights(state, t)                          light descriptors (view px, no shake)
// For the select screen (king-hero.js):
//   drawFamiliar(g, k, x, y, { f, scale, pose, t, p })   one familiar, feet at canvas pixel (x, y)
//   drawFamiliarGlow(g, k, x, y, { f, scale, pose, t, p })  its glowing bits (crystal, sigil, eyes)
//   pose: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | any action name of COURT_ACTS[k] (p: 0..1 through it)
//         | the hero poses 'heroRaise' (soldier), 'heroDraw' (archer), 'heroCrouch' (assassin),
//           'heroCast' (mage), 'heroKneel' (shield): HERO_POSE[k] names each one's.
import { S, seeded } from '../engine/const.js';
import { ramp } from '../engine/palette.js';
import * as MOVES from '../sim/moves.js';

const KINDS = ['soldier', 'archer', 'assassin', 'mage', 'shield'];
export const HERO_POSE = { soldier: 'heroRaise', archer: 'heroDraw', assassin: 'heroCrouch', mage: 'heroCast', shield: 'heroKneel' };
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = u => 1 - (1 - u) * (1 - u);
const easeIn = u => u * u;
const lerp = (a, b, u) => a + (b - a) * u;
const DEG = Math.PI / 180;

// Action timings from the simulation, with fallbacks in case a name is missing.
const FALLBACK = {
  soldier: { slash: [0.34, [0.55]], rise: [0.4, [0.5]], air: [0.3, [0.5]], plunge: [0.4, [0.6]], charge: [0.5, [0.2, 0.4, 0.6, 0.8]], finale: [0.7, [0.65]] },
  archer: { shot: [0.36, [0.5]], volley: [0.5, [0.3, 0.55, 0.8]], rain: [0.45, [0.4]], airshot: [0.36, [0.5]], barrage: [0.6, [0.2, 0.4, 0.6, 0.8]] },
  assassin: { stab: [0.42, [0.45, 0.75]], shadow: [0.4, [0.4]], mercy: [0.5, [0.3, 0.55, 0.8]], dance: [0.8, [0.15, 0.35, 0.55, 0.75]] },
  mage: { zap: [0.42, [0.55]], meteor: [0.5, [0.7]], storm: [0.6, [0.35, 0.6, 0.85]] },
  shield: { bash: [0.4, [0.5]], drop: [0.45, [0.6]], slam: [0.55, [0.7]], charge: [0.5, [0.2, 0.4, 0.6, 0.8]], guard: [0.25, []] }
};
function actInfo(k, act) {
  const A = MOVES.COURT_ACTS?.[k]?.[act];
  if (A) return { dur: A.dur || 0.4, hits: A.hits || [] };
  const f = FALLBACK[k]?.[act];
  return f ? { dur: f[0], hits: f[1] } : { dur: 0.4, hits: [0.5] };
}
// Where p (0..1 through an action) stands relative to its strikes: i the strike it is on, pre 0..1
// winding up to it (1 on the strike), post 0..1 after it until the next wind-up (or the end).
function stageOf(p, hits) {
  if (!hits.length) return { i: 0, pre: 1, post: p, n: 0, last: true };
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i], start = i === 0 ? 0 : (hits[i - 1] + h) / 2;
    if (p < h) return { i, pre: clamp01((p - start) / Math.max(0.001, h - start)), post: 0, n: hits.length, last: i === hits.length - 1 };
    const end = i === hits.length - 1 ? 1 : (h + hits[i + 1]) / 2;
    if (p < end) return { i, pre: 1, post: clamp01((p - h) / Math.max(0.001, end - h)), n: hits.length, last: i === hits.length - 1 };
  }
  return { i: hits.length - 1, pre: 1, post: 1, n: hits.length, last: true };
}

// ---- palettes -----------------------------------------------------------------------------------
// ramp(): [outline, dark, base, light, highlight]
const INK = '#120b19';
const R = hex => ramp(hex).hex;
const STEEL = R('#a9aec8'), GOLD = R('#e8b040'), PINK = R('#ff9fb4'), CREAM = R('#fbecd2');
const EYE = R('#2a1a2a');
const KIT = {
  soldier: { fur: R('#ee9a48'), belly: CREAM, pink: PINK, eyeR: EYE, main: R('#cc3444'), trim: GOLD, steel: STEEL, plume: R('#e8384a'), grip: R('#6a3a2a'), glow: '#ffe6a0', ghost: '#ff8a5a' },
  archer: { fur: R('#ead0a2'), belly: R('#fff8ea'), pink: PINK, eyeR: EYE, main: R('#46a24c'), dark: R('#2c6e3c'), leather: R('#8e5634'), wood: R('#b4783a'), string: R('#b8a890'), white: R('#f0ecf4'), glow: '#c8ffb0', ghost: '#7ce07a' },
  assassin: { fur: R('#3e3450'), belly: R('#5e5476'), pink: R('#c46a8c'), eyeR: R('#ffe23a'), main: R('#c8263c'), steel: R('#cfd6e8'), grip: R('#2a2030'), toe: R('#5e5476'), glow: '#ffe23a', ghost: '#7a4ac8' },
  mage: { fur: R('#f4f2fa'), belly: CREAM, pink: PINK, eyeR: EYE, main: R('#4444b0'), trim: GOLD, wood: R('#94603a'), gem: R('#c46cff'), glow: '#e0b0ff', ghost: '#a070ff' },
  shield: { fur: R('#b07a4e'), belly: CREAM, pink: PINK, eyeR: EYE, steel: STEEL, main: R('#c02e44'), trim: GOLD, glow: '#ffe08a', ghost: '#ffd860' }
};

// ---- the pixel grid each pose is painted into --------------------------------------------------
// Local coordinates: x ahead (facing right), y down, the feet's bottom row is y = -1.
const GW = 64, GH = 64, OX = 32, OY = 44;
class Grid {
  constructor() {
    this.R = new Array(GW * GH).fill(null);
    this.L = new Uint8Array(GW * GH);
    this.P = new Int16Array(GW * GH);
    this.pid = 0; this.cells = null; this.pts = {};
  }
  // A part: with sep, an ink line is drawn round it where it covers what was painted before.
  begin(sep = false) { this.pid++; this.cells = sep ? [] : null; }
  end() {
    if (!this.cells) return;
    for (const i of this.cells) for (const d of [-1, 1, -GW, GW]) {
      const n = i + d;
      if (this.R[n] && this.P[n] !== this.pid && this.P[n] > 0) { this.R[n] = null; this.L[n] = 0; this.P[n] = -1; }
    }
    this.cells = null;
  }
  set(x, y, Rp, l) {
    const gx = OX + Math.floor(x), gy = OY + Math.floor(y);
    if (gx < 1 || gy < 1 || gx >= GW - 1 || gy >= GH - 1) return;
    const i = gy * GW + gx;
    this.R[i] = Rp; this.L[i] = l; this.P[i] = this.pid;
    if (this.cells) this.cells.push(i);
  }
  ink(x, y) { const gx = OX + Math.floor(x), gy = OY + Math.floor(y), i = gy * GW + gx; if (gx > 0 && gy > 0 && gx < GW - 1 && gy < GH - 1) { this.R[i] = null; this.P[i] = -1; } }
  has(x, y) { const i = (OY + Math.floor(y)) * GW + OX + Math.floor(x); return !!this.R[i]; }
  rect(x, y, w, h, Rp, l) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, Rp, l); }
  // A shaded ellipse lit from the top left.
  ell(cx, cy, rx, ry, Rp, { lo = 1, hi = 3, top = 4 } = {}) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), d = -0.55 * nx - 0.62 * ny + 0.56 * nz;
      this.set(x, y, Rp, d > 0.97 ? top : d > 0.72 ? hi : d > -0.3 ? 2 : lo);
    }
  }
  line(x0, y0, x1, y1, Rp, l, w = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      this.rect(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, Rp, typeof l === 'function' ? l(i / n) : l);
    }
  }
  // A filled polygon, flat colored (lv: level, or a function of x, y).
  poly(pts, Rp, lv) {
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      let on = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
      }
      if (on) this.set(x, y, Rp, typeof lv === 'function' ? lv(x, y) : lv);
    }
  }
  pt(name, x, y) { this.pts[name] = [x, y]; }
}

// Turns a painted grid into a sprite: an ink outline round the whole silhouette, the top edge lit,
// cropped to its bounds. pts: named points (relative to the feet) for the glow layer and effects.
let mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const RGBC = new Map();
const rgbOf = hex => { let v = RGBC.get(hex); if (!v) { const n = parseInt(hex.slice(1, 7), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGBC.set(hex, v); } return v; };
function finish(G) {
  const N = GW * GH, out = new Array(N).fill(null), Rr = G.R, L = G.L;
  for (let i = 0; i < N; i++) if (Rr[i]) {
    // The rim: what faces up (open sky above it) catches the light.
    let l = L[i];
    if (!Rr[i - GW] && G.P[i - GW] !== -1 && l < 3 && l > 0) l = 3;
    out[i] = Rr[i][l];
  }
  // The outline, and the separation lines parts left (P = -1).
  const solid = i => !!Rr[i];
  for (let i = GW; i < N - GW; i++) {
    if (Rr[i]) continue;
    if (G.P[i] === -1 && (solid(i - 1) || solid(i + 1) || solid(i - GW) || solid(i + GW))) { out[i] = INK; continue; }
    if (solid(i - 1) || solid(i + 1) || solid(i - GW) || solid(i + GW)) out[i] = INK;
  }
  let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (out[y * GW + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, c = mkCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hex = out[(y + y0) * GW + x + x0];
    if (!hex) continue;
    const [r, gg, b] = rgbOf(hex), k = (y * w + x) * 4;
    d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    mask[y * w + x] = hex === INK ? 2 : 1;
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, flipped: null, x0: x0 - OX, y0: y0 - OY, w, h, mask, pts: G.pts, tints: {} };
}

// ---- the cats ---------------------------------------------------------------------------------
// Foot frames: [far foot, near foot] (x, bottom row) and how far the body sinks (+) or rises (-).
const LEGS = {
  stand: { far: [-3, -1], near: [1, -1], dy: 0 },
  w0: { far: [-4, -1], near: [2, -1], dy: 0 }, w1: { far: [-2, -2], near: [0, -1], dy: -1 },
  w2: { far: [1, -1], near: [-3, -1], dy: 0 }, w3: { far: [-1, -1], near: [-1, -2], dy: -1 },
  r0: { far: [-5, -2], near: [3, -1], dy: 0 }, r1: { far: [-3, -2], near: [1, -3], dy: -1 },
  r2: { far: [3, -1], near: [-5, -2], dy: 0 }, r3: { far: [1, -3], near: [-3, -2], dy: -1 },
  jump: { far: [-3, -2], near: [1, -3], dy: -1 }, fall: { far: [-4, -1], near: [2, -2], dy: -1 },
  crouch: { far: [-4, -1], near: [2, -1], dy: 2 }, lunge: { far: [-5, -1], near: [3, -1], dy: 1 },
  kneel: { far: [-4, -1], near: [2, -1], dy: 2 }, land: { far: [-4, -1], near: [2, -1], dy: 1 },
  tuck: { far: [-2, -3], near: [1, -3], dy: -1 }, split: { far: [-6, -1], near: [4, -1], dy: 2 }
};

// The cat under the gear: tail, far leg, body, near leg. o: the pose (see poseFor). Returns where
// the body and head are.
function cat(G, K, o) {
  const lg = LEGS[o.legs] || LEGS.stand, dy = lg.dy + (o.dy || 0), lean = o.lean || 0;
  const bx = o.bx || 0, by = -5 + dy;
  const hx = 1 + lean + bx, hy = -10.5 + dy + (o.hdy || 0);
  const F = K.fur, B = K.body || F, LG = K.legs || F;
  // The tail: thick at the root, curling up behind, swaying.
  if (!o.noTail) {
    G.begin();
    const sw = o.tail || 0, up = o.tailUp || 0;
    const p = [[bx - 3, by + 0.5], [bx - 5, by - 0.5], [bx - 6 + sw * 0.3, by - 2.5 - up], [bx - 6 + sw * 0.7, by - 4 - up], [bx - 5 + sw, by - 5 - up]];
    G.line(p[0][0], p[0][1], p[1][0], p[1][1], F, 2, 2);
    G.line(p[1][0], p[1][1], p[2][0], p[2][1], F, 2, 2);
    G.line(p[2][0], p[2][1], p[3][0], p[3][1], F, 3);
    G.line(p[3][0], p[3][1], p[4][0], p[4][1], K.tailTip || F, 3);
    G.end();
  }
  // Far leg and foot, a shade darker.
  const foot = ([fx, fy], near) => {
    const top = by + 2;
    G.line(bx + (near ? 1 : -1), top, bx + fx + 0.5, fy - 1, LG, near ? 2 : 1);
    G.rect(bx + fx, fy - 1, 2, 2, LG, near ? 2 : 1);
    if (near) G.set(bx + fx + 1, fy - 1, K.toe || LG, 3);
  };
  if (!o.noLegs) { G.begin(); foot(lg.far, false); G.end(); }
  if (o.armB && !o.noArmB) { G.begin(); G.line(bx - 1, by - 1, o.armB[0], o.armB[1], K.sleeve || F, 1); G.set(o.armB[0], o.armB[1], F, 2); G.end(); G.pt('handB', o.armB[0], o.armB[1]); }
  // The body, the belly patch.
  G.begin();
  G.ell(bx, by, 3.1, 2.6, B);
  if (!K.body) { G.set(bx + 1, by, K.belly, 3); G.set(bx + 2, by, K.belly, 3); G.set(bx + 1, by + 1, K.belly, 2); G.set(bx + 2, by + 1, K.belly, 2); }
  G.end();
  if (!o.noLegs) { G.begin(); foot(lg.near, true); G.end(); }
  G.pt('chest', bx + 1, by - 1);
  G.pt('head', hx, hy);
  return { bx, by, hx, hy, dy };
}
// The head: a round face, two ears (the far one darker, the near one pink inside), big eyes, a
// cream muzzle and a pink nose. ears=false under a hat; mask paints over the muzzle instead.
function head(G, K, c, o, { ears = true, mask = null } = {}) {
  const { hx, hy } = c, F = K.fur;
  G.begin(true);
  if (ears) {
    const et = o.ear || 0;
    G.poly([[hx - 3.8, hy - 1.6], [hx - 2.8, hy - 5.4], [hx - 0.6, hy - 2.8]], F, 1);
    if (et === 2) G.poly([[hx - 0.4, hy - 2.6], [hx + 0.2, hy - 4.8], [hx + 3.4, hy - 2.4]], F, 2);
    else G.poly([[hx + 0.2, hy - 2.8], [hx + 2.2 - et, hy - 5.6 + et * 0.6], [hx + 3.9, hy - 1.6]], F, 2);
    if (et !== 2) G.set(hx + 2 - et, hy - 4, K.pink, 2);
  }
  G.ell(hx, hy, 4.3, 3.35, F);
  const mx = hx + 2, my = hy + 1;
  if (mask) mask(mx, my);
  else {
    G.set(mx, my + 1, K.belly, 2); G.set(mx + 1, my + 1, K.belly, 2); G.set(mx + 1, my, K.belly, 3); G.set(mx + 2, my, K.belly, 3); G.set(mx + 2, my + 1, K.belly, 2);
    G.set(mx + 2, my - 1, K.pink, 3);
  }
  G.end();
  // Eyes: the near one big with a shine, the far one a dot.
  const e = o.eye || 'open', E = K.eyeR, ex = hx + 2, ey = hy - 1, fx = hx - 1;
  if (e === 'blink') { G.set(ex, ey + 1, E, 2); G.set(ex - 1, ey + 1, E, 2); G.set(fx, ey + 1, E, 2); }
  else if (e === 'happy') { G.set(ex - 1, ey + 1, E, 2); G.set(ex, ey, E, 2); G.set(ex + 1, ey + 1, E, 2); G.set(fx, ey, E, 2); G.set(fx - 1, ey + 1, E, 2); }
  else if (e === 'angry') { G.set(ex, ey + 1, E, 2); G.set(ex - 1, ey, E, 2); G.set(ex, ey, E, 2); G.set(fx, ey + 1, E, 2); G.set(fx + 1, ey, E, 2); }
  else { G.set(ex, ey, E, K.eyeL ?? 2); G.set(ex, ey + 1, E, 2); G.set(fx, ey, E, 2); G.set(fx, ey + 1, E, 2); }
  G.pt('eye', ex, ey);
  G.pt('eyeF', fx, ey);
}
// The near arm to the hand point (a paw there).
function arm(G, K, c, hand, l = 3) {
  G.begin();
  const sx = c.bx + 1, sy = c.by - 1;
  if (Math.hypot(hand[0] - sx, hand[1] - sy) > 1.5) G.line(sx, sy, hand[0], hand[1], K.sleeve || K.fur, 2);
  G.set(hand[0], hand[1], K.fur, l);
  G.end();
  G.pt('hand', hand[0], hand[1]);
}
const along = (x, y, a, d) => [x + Math.cos(a) * d, y + Math.sin(a) * d];

// A sword at angle a (radians, 0 ahead, -90 up): grip, gold guard across, steel blade, bright tip.
function sword(G, K, hand, a, len = 7, gold = false) {
  const [hx, hy] = hand, c = Math.cos(a), s = Math.sin(a);
  G.begin();
  G.set(hx - c, hy - s, K.grip, 2);
  const gx = hx + c * 1.1, gy = hy + s * 1.1;
  G.line(gx - s * 1.5, gy + c * 1.5, gx + s * 1.5, gy - c * 1.5, K.trim, 3);
  const BL = gold ? GOLD : K.steel;
  for (let d = 2; d <= len + 1; d++) G.set(hx + c * d, hy + s * d, BL, d >= len ? 4 : 3);
  G.end();
  G.pt('tip', hx + c * (len + 1), hy + s * (len + 1));
  G.pt('blade', hx + c * (len * 0.6 + 1), hy + s * (len * 0.6 + 1));
}
// A dagger: dark grip, steel blade, bright point.
function dagger(G, K, hand, a, len = 3) {
  const [hx, hy] = hand, c = Math.cos(a), s = Math.sin(a);
  G.begin();
  G.set(hx - c, hy - s, K.grip, 2);
  for (let d = 1; d <= len; d++) G.set(hx + c * d, hy + s * d, K.steel, d === len ? 4 : 3);
  G.end();
}

// The kite shield, centred on c, turned by rot (radians, clockwise; 0 upright, its point down): a red
// field lit on its left, a gold rim and the royal crest (a little gold crown).
function shieldOf(G, K, c, rot, w, h) {
  const cs = Math.cos(rot), sn = Math.sin(rot), at = (x, y) => [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
  G.begin(true);
  G.poly([at(-w, -h * 0.45), at(w, -h * 0.45), at(w, h * 0.12), at(0, h * 0.55), at(-w, h * 0.12)], K.main, () => 2);
  for (let i = 0; i < G.R.length; i++) {
    if (G.P[i] !== G.pid) continue;
    const x = (i % GW) - OX + 0.5 - c[0], y = Math.floor(i / GW) - OY + 0.5 - c[1], lx = x * cs + y * sn, ly = -x * sn + y * cs;
    const rim = G.P[i - 1] !== G.pid || G.P[i + 1] !== G.pid || G.P[i - GW] !== G.pid || G.P[i + GW] !== G.pid;
    if (rim) { G.R[i] = K.trim; G.L[i] = lx < 0 || ly < -h * 0.3 ? 3 : 2; }
    else G.L[i] = lx < -1 ? 3 : lx > 1.2 ? 1 : 2;
  }
  if (w >= 2.5) {
    const k = at(0, -h * 0.08), kx = Math.round(k[0] - 0.5), ky = Math.round(k[1] - 0.5);
    G.set(kx - 1, ky, K.trim, 3); G.set(kx, ky, K.trim, 4); G.set(kx + 1, ky, K.trim, 2);
    G.set(kx - 1, ky - 1, K.trim, 4); G.set(kx + 1, ky - 1, K.trim, 3); G.set(kx, ky - 1, K.main, 1); G.set(kx, ky + 1, K.main, 1);
  }
  G.end();
  G.pt('shield', ...at(0, -h * 0.08));
  G.pt('shieldTip', ...at(0, h * 0.55));
}

// ---- each familiar -----------------------------------------------------------------------------
const BUILD = {
  // The soldier: a little ginger cat in a round steel cap (ear guards, a red plume), a red tabard
  // with a gold belt, a short sword.
  soldier(G, K, o) {
    const Kb = { ...K, body: K.main };
    if (o.swordBack) sword(G, K, o.hand, o.wpn, o.len || 6, o.gold);
    const c = cat(G, Kb, o);
    G.begin(); for (let x = -2; x <= 2; x++) G.set(c.bx + x, c.by + 1, K.trim, x === 0 ? 4 : 2); G.end();
    head(G, K, c, o, { ears: false });
    const { hx, hy } = c;
    G.begin();
    // The cap: a steel dome on the head, its brim just over the eyes.
    const rows = [[-6, -2, 1], [-5, -3, 2], [-4, -4, 3], [-3, -4, 4], [-2, -5, 4]];
    for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) G.set(hx + x, hy + y, K.steel, y === -2 ? (x < 0 ? 2 : 1) : x <= x0 + 1 && y < -3 ? 4 : x >= x1 - 1 ? 2 : 3);
    G.end();
    // The plume: up off the crown and blown back.
    G.begin();
    const pw = o.plume || 0;
    G.set(hx, hy - 7, K.plume, 3); G.set(hx - 1, hy - 7, K.plume, 4); G.set(hx - 1, hy - 8, K.plume, 3); G.set(hx - 2, hy - 8, K.plume, 3);
    G.set(hx - 3, hy - 8 + pw, K.plume, 2); G.set(hx - 4, hy - 7 + pw, K.plume, 2); G.set(hx - 5, hy - 6 + pw, K.plume, 1); G.set(hx - 2, hy - 7, K.plume, 2);
    G.end();
    if (!o.swordBack) sword(G, K, o.hand, o.wpn, o.len || 6, o.gold);
    arm(G, Kb, c, o.hand);
  },
  // The archer: a cream cat in a green hood (ears up through it) and short cape, a quiver on the
  // back, the bow held out in the far paw and its string drawn by the near one.
  archer(G, K, o) {
    const Kb = { ...K, body: K.main, legs: K.leather, sleeve: K.main };
    const lg = LEGS[o.legs] || LEGS.stand, dy = lg.dy + (o.dy || 0), bx = o.bx || 0, by = -5 + dy;
    // The quiver across the back, fletchings showing over the shoulder; the cape.
    G.begin();
    G.line(bx - 4, by - 4, bx - 2, by + 1, K.leather, (u) => (u < 0.3 ? 3 : 2), 2);
    G.set(bx - 5, by - 5, K.white, 4); G.set(bx - 4, by - 6, R('#e04848'), 3); G.set(bx - 3, by - 5, K.white, 3);
    G.end();
    G.begin();
    G.poly([[bx - 1, by - 3], [bx - 5 - (o.cape || 0), by + 2.6], [bx + 0.5, by + 2.6]], K.dark, (x, y) => (y < by ? 3 : 2));
    G.end();
    const c = cat(G, Kb, o);
    head(G, K, c, o, { ears: false });
    const { hx, hy } = c;
    // The hood over the head, open at the face, with the ears in it and a point hanging behind.
    G.begin();
    for (let y = -6; y <= 3; y++) for (let x = -6; x <= 4; x++) {
      const nx = (x + 0.6) / 4.9, ny = (y + 0.3) / 3.9;
      const ear = (y >= -6 && y <= -4) && ((x === -3 && y >= -5) || (x === -2 && y >= -5) || (x === 1 && y >= -5) || (x === 2 && y >= -6));
      if (nx * nx + ny * ny > 1 && !ear) continue;
      // The face stays open.
      if (x >= 0 && y >= -2) continue;
      if (x === -1 && y >= 0 && y <= 2) continue;
      G.set(hx + x, hy + y, K.main, ear ? (x > 0 ? 3 : 2) : y <= -3 ? 3 : x <= -4 ? 1 : 2);
    }
    G.set(hx + 2, hy - 4, K.pink, 2);
    G.set(hx - 6, hy + 1, K.main, 1); G.set(hx - 6, hy + 2, K.main, 1); G.set(hx - 7, hy + 2, K.main, 1);
    G.end();
    // The bow in the far paw, held out; the string to the near paw when drawn.
    const bh = o.bowHand, ba = o.bowA ?? 0, draw = o.draw || 0, r = 4.4;
    G.begin();
    G.line(c.bx, c.by - 1, bh[0], bh[1], K.main, 1);
    const nrm = ba + Math.PI / 2, tips = [];
    for (let i = -4; i <= 4; i++) {
      const u = i / 4, bend = (1 - u * u) * 2.4 - 0.6;
      const x = bh[0] + Math.cos(nrm) * u * r + Math.cos(ba) * bend, y = bh[1] + Math.sin(nrm) * u * r + Math.sin(ba) * bend;
      if (i === -4 || i === 4) tips.push([x, y]);
      G.set(x, y, K.wood, Math.abs(i) >= 3 ? 4 : i < 0 ? 3 : 2);
    }
    G.set(bh[0], bh[1], K.fur, 3);
    G.end();
    const pull = draw > 0 ? o.hand : [(tips[0][0] + tips[1][0]) / 2 - Math.cos(ba) * 0.6, (tips[0][1] + tips[1][1]) / 2 - Math.sin(ba) * 0.6];
    G.begin();
    G.line(tips[0][0], tips[0][1], pull[0], pull[1], K.string, 2);
    G.line(tips[1][0], tips[1][1], pull[0], pull[1], K.string, 2);
    G.end();
    if (draw > 0) {
      const tip = along(bh[0], bh[1], ba, 3);
      G.begin(); G.line(pull[0], pull[1], tip[0], tip[1], K.wood, 3); G.set(tip[0], tip[1], STEEL, 4); G.end();
      G.pt('arrow', tip[0], tip[1]);
    }
    G.pt('bow', bh[0], bh[1]);
    arm(G, Kb, c, o.hand);
  },
  // The assassin: a black cat, a crimson mask over the muzzle with its ties streaming behind, eyes
  // that glow, a dagger in each paw.
  assassin(G, K, o) {
    const lg = LEGS[o.legs] || LEGS.stand, dy = lg.dy + (o.dy || 0), bx = o.bx || 0, hx = 1 + (o.lean || 0) + bx, hy = -10.5 + dy + (o.hdy || 0);
    G.begin();
    const fl = o.ties || 0;
    G.line(hx - 4, hy + 0.5, hx - 7, hy - 0.5 + fl, K.main, 2);
    G.line(hx - 7, hy - 0.5 + fl, hx - 9, hy + 0.5 + fl * 2, K.main, 1);
    G.line(hx - 4, hy + 1.5, hx - 6, hy + 2.5 + fl, K.main, 1);
    G.end();
    if (o.armB) dagger(G, K, o.armB, o.wpnB ?? o.wpn, 3);
    const c = cat(G, K, o);
    head(G, K, c, o, {
      mask: (mx, my) => {
        for (let x = -2; x <= 3; x++) for (let y = 0; y <= 1; y++) if (G.has(mx + x, my + y)) G.set(mx + x, my + y, K.main, y === 0 ? 3 : 2);
      }
    });
    G.begin(); for (let x = -2; x <= 2; x++) G.set(c.bx + x, c.by + 1, K.main, x > 0 ? 3 : 2); G.end();
    dagger(G, K, o.hand, o.wpn, 4);
    arm(G, K, c, o.hand);
    G.pt('tip', o.hand[0] + Math.cos(o.wpn) * 4, o.hand[1] + Math.sin(o.wpn) * 4);
  },
  // The mage: a white cat in a starry blue robe down to the floor and a tall pointed hat, a staff
  // taller than he is with a violet crystal.
  mage(G, K, o) {
    const dy = o.dy || 0, bx = o.bx || 0, hx = 1 + (o.lean || 0) + bx, hy = -10.5 + dy + (o.hdy || 0);
    G.begin(); G.line(bx - 3, -2 + dy, bx - 5, -3 + dy, K.fur, 2, 2); G.set(bx - 6, -4 + dy - (o.tail > 0 ? 1 : 0), K.fur, 3); G.end();
    // The robe: a bell from the neck to the hem (it sways), a gold hem and stars.
    G.begin();
    const sw = o.hem || 0;
    G.poly([[bx - 2.4, -8 + dy], [bx + 2.6, -8 + dy], [bx + 4.4 + sw, -0.5 + dy], [bx - 4.4 + sw, -0.5 + dy]], K.main, (x, y) => (x - bx < -1 ? 3 : x - bx > 1 ? 1 : 2));
    for (let x = Math.round(bx - 4 + sw); x <= Math.round(bx + 4 + sw); x++) G.set(x, -1 + dy, K.trim, x - bx < 0 ? 3 : 2);
    G.set(bx + 1, -5 + dy, K.trim, 4); G.set(bx - 2, -3 + dy, K.trim, 3); G.set(bx + 2, -3 + dy, K.trim, 3);
    G.end();
    G.pt('chest', bx + 1, -6 + dy);
    const cc = { bx, by: -5 + dy, hx, hy };
    head(G, K, cc, o, { ears: false });
    // The hat: a wide brim, a cone bent back at the tip, a gold band and a star.
    G.begin(true);
    const bend = o.hatBend || 0;
    G.rect(hx - 4, hy - 3, 9, 1, K.main, 2); G.set(hx - 5, hy - 2, K.main, 2); G.set(hx + 5, hy - 2, K.main, 1);
    G.poly([[hx - 3, hy - 3], [hx + 3.4, hy - 3], [hx + 0.6, hy - 9], [hx - 1.4 - bend, hy - 11]], K.main, (x) => (x < hx - 1 ? 3 : 2));
    G.set(hx - 2 - bend, hy - 11, K.main, 3); G.set(hx - 3 - bend, hy - 10.5 + bend * 0.5, K.main, 3);
    for (let x = -2; x <= 2; x++) G.set(hx + x, hy - 4, K.trim, x < 0 ? 3 : 2);
    G.set(hx, hy - 7, K.trim, 4); G.set(hx - 1, hy - 7, K.trim, 3); G.set(hx + 1, hy - 7, K.trim, 3); G.set(hx, hy - 8, K.trim, 3); G.set(hx, hy - 6, K.trim, 3);
    G.end();
    G.pt('hat', hx - 3 - bend, hy - 11);
    // The staff in the near paw: its crystal up by the hat.
    const st = o.staff, sa = o.staffA ?? -90 * DEG, c = Math.cos(sa), s = Math.sin(sa);
    const top = [st[0] + c * 9, st[1] + s * 9], foot = [st[0] - c * 6, st[1] - s * 6];
    G.begin();
    G.line(foot[0], foot[1], top[0], top[1], K.wood, (u) => (u > 0.5 ? 3 : 2));
    const [cx, cy] = along(top[0], top[1], sa, 1.5);
    G.set(cx, cy - 1, K.gem, 4); G.set(cx - 1, cy, K.gem, 3); G.set(cx, cy, K.gem, 4); G.set(cx + 1, cy, K.gem, 2); G.set(cx, cy + 1, K.gem, 2);
    G.set(top[0] - 1, top[1], K.trim, 3); G.set(top[0] + 1, top[1], K.trim, 2);
    G.end();
    G.pt('gem', cx, cy);
    G.begin();
    G.line(bx + 1, -7 + dy, o.hand[0], o.hand[1], K.main, 3);
    G.set(o.hand[0], o.hand[1], K.fur, 3);
    G.end();
    G.pt('hand', o.hand[0], o.hand[1]);
    if (o.handB) { G.begin(); G.line(bx - 1, -7 + dy, o.handB[0], o.handB[1], K.main, 2); G.set(o.handB[0], o.handB[1], K.fur, 3); G.end(); G.pt('handB', o.handB[0], o.handB[1]); }
  },
  // The shield-bearer: a stocky brown cat in a steel helm and breastplate behind a big kite shield
  // with the royal crest (a gold crown on red).
  shield(G, K, o) {
    const Kb = { ...K, body: K.steel };
    const c = cat(G, Kb, o);
    head(G, K, c, o, { ears: false });
    const { hx, hy } = c;
    // The helm: a steel bowl down over the ears with a gold crest and a cheek guard.
    G.begin();
    for (let y = -5; y <= 1; y++) for (let x = -5; x <= 5; x++) {
      const nx = (x + 0.5) / 4.7, ny = (y + 0.3) / 3.7;
      if (nx * nx + ny * ny > 1) continue;
      if (x >= 0 && y >= -1) continue;
      if (x >= -1 && y >= 0) continue;
      G.set(hx + x, hy + y, K.steel, y === -2 && x >= -1 ? 1 : x < -2 ? 2 : y <= -3 ? 3 : 2);
    }
    G.set(hx - 1, hy - 4, K.trim, 3); G.set(hx, hy - 4, K.trim, 3); G.set(hx - 2, hy - 4, K.trim, 3); G.set(hx - 1, hy - 5, K.trim, 4);
    G.end();
    if (!o.noShield) shieldOf(G, K, o.sh, o.shRot || 0, o.shW ?? 3.5, o.shH ?? 10);
    if (o.showArm) arm(G, Kb, c, o.hand);
  }
};

// ---- poses ------------------------------------------------------------------------------------
// The base hand and weapon placement for a resting familiar of each kind.
function basePose(k, legs, dy, t, idx) {
  const L = LEGS[legs] || LEGS.stand, by = -5 + L.dy + dy;
  switch (k) {
    case 'soldier': return { hand: [3, by], wpn: -60 * DEG };
    case 'archer': return { hand: [2, by], bowHand: [5, by - 2], bowA: 0, draw: 0 };
    case 'assassin': return { hand: [3, by + 1], wpn: 20 * DEG, armB: [-2, by + 1], wpnB: 160 * DEG };
    case 'mage': return { hand: [4, by - 2], staff: [4, by - 2], staffA: -90 * DEG };
    case 'shield': return { hand: [3, by - 1], sh: [6, by - 4], shW: 3.5, shH: 10 };
  }
  return {};
}

// What a familiar looks like this frame: the pose params (all whole numbers or quantized, so the
// sprite cache hits) and where the sprite sits relative to its feet (dx, dy) plus glow cues.
function poseFor(k, F, t, idx, mem) {
  const ph = t + idx * 0.37;
  const vx = F.vx || 0, sp = Math.abs(vx);
  const breath = Math.sin(ph * 2.6) > 0.55 ? 1 : 0;
  const blink = (ph * 0.7) % 4.3 < 0.12;
  const twitch = (ph * 0.9 + idx) % 5.1 < 0.15 ? 1 : 0;
  let legs = 'stand', o = { eye: blink ? 'blink' : 'open', ear: twitch, tail: Math.round(Math.sin(ph * 1.8) * 1.5), dy: breath };
  let dx = 0, ody = 0, cue = {};
  const moving = sp > 0.12 && F.st !== 'act';
  if (F.air && F.st !== 'act' && k !== 'mage') {
    const rising = mem && mem.vy < -0.2;
    legs = rising ? 'jump' : 'fall'; o.dy = 0; o.tail = rising ? -1 : 1; o.ear = rising ? 0 : 2;
  } else if (moving && k !== 'mage') {
    const run = sp > 0.6, rate = run ? 11 : 6.5, fr = Math.floor(((mem?.dist ?? t * sp * 60) * (run ? 0.09 : 0.11)) % 4);
    legs = (run ? 'r' : 'w') + ((fr + 4) % 4);
    o.dy = 0; o.lean = run ? 1 : 0; o.tail = run ? -2 : o.tail;
    if (run) o.ear = 2;
    void rate;
  }
  if (k === 'mage') {
    // He floats: a slow bob, the hem swaying; moving, he leans and the hem trails.
    legs = 'stand';
    o.dy = 0;
    ody = Math.round(Math.sin(ph * 2.2) * 1.2);
    o.hem = moving ? -Math.sign(vx * (F.f || 1)) : Math.round(Math.sin(ph * 2.2 + 1));
    o.lean = moving ? 1 : 0;
  }
  o.legs = legs;
  Object.assign(o, basePose(k, legs, o.dy, t, idx));
  if (k === 'soldier') { o.plume = moving ? 1 : Math.sin(ph * 2) > 0.7 ? 1 : 0; if (legs[0] === 'r') o.wpn = -20 * DEG, o.hand = [3, -6]; }
  if (k === 'archer') o.cape = moving ? 1 : 0;
  if (k === 'assassin') { o.ties = moving ? 0 : Math.round(Math.sin(ph * 3)); if (!moving && !F.air) { o.legs = 'crouch'; Object.assign(o, basePose(k, 'crouch', 0, t, idx)); o.dy = 0; } }
  if (k === 'shield' && F.st !== 'act') o.eye = blink ? 'blink' : 'angry';
  return { o, dx, dy: ody, cue };
}

// ---- sprite cache ----------------------------------------------------------------------------
class LRU {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) { const v = this.map.get(k); if (v) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k, v) { this.map.set(k, v); if (this.map.size > this.max) this.map.delete(this.map.keys().next().value); }
}
const SPRITES = new LRU(1200);
const keyOf = (k, o) => {
  let s = k;
  for (const n in o) {
    const v = o[n];
    s += '|' + n + ':' + (Array.isArray(v) ? v.map(q => Math.round(q * 2) / 2).join(',') : typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  }
  return s;
};
export function familiarSprite(k, o) {
  const key = keyOf(k, o);
  let s = SPRITES.get(key);
  if (s === undefined) {
    const G = new Grid();
    BUILD[k](G, KIT[k], o);
    s = finish(G);
    SPRITES.set(key, s);
  }
  return s;
}
function flippedOf(s) {
  if (!s.flipped) {
    const c = mkCanvas(s.w, s.h), g = c.getContext('2d');
    g.translate(s.w, 0); g.scale(-1, 1); g.drawImage(s.canvas, 0, 0);
    s.flipped = c;
  }
  return s.flipped;
}
// A flat-colored copy (afterimages, the white pop) or only its outline in a color (the decree's rim).
function tintOf(s, color, rim = false) {
  const key = (rim ? 'r' : 't') + color;
  if (!s.tints[key]) {
    const c = mkCanvas(s.w, s.h), g = c.getContext('2d');
    if (rim) {
      g.fillStyle = color;
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x] === 2) g.fillRect(x, y, 1, 1);
    } else {
      g.drawImage(s.canvas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, s.w, s.h);
    }
    s.tints[key] = { canvas: c, flipped: null, x0: s.x0, y0: s.y0, w: s.w, h: s.h };
  }
  return s.tints[key];
}
function blit(g, s, x, y, f = 1, scale = 1) {
  if (f >= 0) g.drawImage(s.canvas, Math.round(x + s.x0 * scale), Math.round(y + s.y0 * scale), s.w * scale, s.h * scale);
  else g.drawImage(flippedOf(s), Math.round(x - (s.x0 + s.w) * scale), Math.round(y + s.y0 * scale), s.w * scale, s.h * scale);
}
// A sprite's named point in canvas pixels for a sprite drawn at (x, y) facing f.
function ptOf(s, name, x, y, f = 1, scale = 1) {
  const p = s?.pts?.[name];
  if (!p) return null;
  return { x: x + (f >= 0 ? p[0] + 0.5 : -p[0] - 0.5) * scale, y: y + (p[1] + 0.5) * scale };
}

// ---- select screen ---------------------------------------------------------------------------
export function drawFamiliar(g, k, x, y, { f = 1, scale = 1, pose = 'idle', t = 0, p = 0, idx = KINDS.indexOf(k) } = {}) {
  const F = { k, f, vx: pose === 'run' ? 1.2 : pose === 'walk' ? 0.4 : 0, air: pose === 'jump' || pose === 'fall', st: pose === 'idle' || pose === 'walk' || pose === 'run' || pose === 'jump' || pose === 'fall' ? 'follow' : 'act', act: pose, t: 0 };
  const mem = { vy: pose === 'jump' ? -1 : 1, dist: t * Math.abs(F.vx) * 60 };
  const q = poseFor(k, F, t, idx, mem);
  const s = familiarSprite(k, q.o);
  if (s) blit(g, s, x + q.dx * scale * f, y + q.dy * scale, f, scale);
  return s;
}
