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
//   court.update(dt)                               every frame (it measures the game clock the draw
//                                                  calls see, so the effects slow down with the LAB's
//                                                  slow motion too)
//   court.drawCourt(g, a, ox, oy, t, front)        lit layer: front=false before the fighters (the
//                                                  court in formation, behind the King), front=true
//                                                  after them (the shield on guard and every familiar
//                                                  acting, so the blows read over the fighters)
//   court.drawCourtKeep(lg, a, ox, oy, t, figures)  after the light map, right after the fighters'
//                                                  own-color pass (lg.globalAlpha = 0.45 ... drawImage):
//                                                  the familiars keep part of their own color too (the
//                                                  ones behind are cut out where a fighter stands in
//                                                  front of them). Until it is called, drawCourtGlow
//                                                  does it for the familiars in front only.
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
  clear() { this.R.fill(null); this.L.fill(0); this.P.fill(0); this.pid = 0; this.cells = null; this.pts = {}; return this; }
}
// One grid, cleared for each new pose (built lazily: no DOM or big arrays at load).
const GRID = { g: null, clear() { return (this.g ||= new Grid()).clear(); } };

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
  G.begin(true);
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
    const c = cat(G, Kb, o);
    G.begin(); for (let x = -2; x <= 2; x++) G.set(c.bx + x, c.by + 1, K.trim, x === 0 ? 4 : 2); G.end();
    // The sword over his body but under his head: raised, it shows over the helmet and before his
    // face, and never crosses his eyes.
    sword(G, K, o.hand, o.wpn, o.len || 6, o.gold);
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
    G.line(c.bx, c.by - 1, bh[0], bh[1], K.main, 2);
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
    G.begin();
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
// The body's y for a pose (the hands hang off it).
const BY = o => -5 + (LEGS[o.legs] || LEGS.stand).dy + (o.dy || 0);
const SHOULDER = o => [(o.bx || 0) + 1, BY(o) - 1];
// Hands and gear of each one at rest.
function rest(k, o) {
  const by = BY(o);
  switch (k) {
    case 'soldier': o.hand = [4, by]; o.wpn = -32 * DEG; break;
    case 'archer': o.hand = [2, by]; o.bowHand = [6, by - 1]; o.bowA = 0; o.draw = 0; break;
    case 'assassin': o.hand = [3, by + 1]; o.wpn = 20 * DEG; o.armB = [-2, by + 1]; o.wpnB = 160 * DEG; break;
    case 'mage': o.hand = [4, by - 2]; o.staff = o.hand; o.staffA = -90 * DEG; break;
    case 'shield': o.hand = [3, by - 1]; o.sh = [6, by + 0.5]; o.shRot = 0; break;
  }
}
// The run/walk cycle frame name for a phase.
const cycle = (run, ph) => (run ? 'r' : 'w') + (((Math.floor(ph) % 4) + 4) % 4);
// The archer's bow aimed along a, drawn back (u 0..1) or just released (rel).
function aimBow(o, a, u, rel = 0) {
  const [sx, sy] = SHOULDER(o), c = Math.cos(a), s = Math.sin(a);
  o.bowA = a; o.bowHand = [sx + c * 4.6, sy + 0.5 + s * 4.6];
  const pull = rel ? 6.5 : 1.5 + u * 4;
  o.hand = [o.bowHand[0] - c * pull, o.bowHand[1] - s * pull - (rel ? 1 : 0)];
  o.draw = !rel && u > 0.25 ? 1 : 0;
}

// Each action, posed from its stage s (stageOf) and p (0..1 through it). Mutates the pose o and
// returns cues for the glow layer: arc (a swing's smear: centre, radius, from/to degrees, u its
// age 0..1), ghost (afterimages), charge/fire/sigil (the mage's spells), flash, twang.
const STRIKE = 0.3;
// When the simulation blinks the assassin away (sim/court.js: 0.06 s into a stab or a mercy).
const BLINK = 0.06;
const ACT = {
  soldier: {
    slash(o, s) {
      o.eye = 'angry'; o.ear = 2;
      if (s.pre < 0.45) { o.legs = 'crouch'; o.lean = -1; const by = BY(o); o.hand = [-1, by - 3]; o.wpn = -150 * DEG; return {}; }
      if (s.pre < 1) { o.legs = 'lunge'; o.lean = 1; const by = BY(o); o.hand = [-1, by]; o.wpn = 170 * DEG; o.plume = 1; return { ghost: 1 }; }
      if (s.post < STRIKE) { o.legs = 'lunge'; o.lean = 2; const by = BY(o); o.hand = [5, by - 1]; o.wpn = 12 * DEG; o.plume = 1; return { arc: { c: [1, by - 2], r: 8, a0: -150, a1: 30, u: s.post / STRIKE }, ghost: 1 }; }
      o.legs = s.post < 0.7 ? 'lunge' : 'stand'; o.lean = 1; const by = BY(o); o.hand = [4, by + 1]; o.wpn = 55 * DEG; return {};
    },
    rise(o, s) {
      o.eye = 'angry'; o.ear = 2;
      if (s.pre < 0.6) { o.legs = 'crouch'; o.lean = -1; const by = BY(o); o.hand = [0, by + 2]; o.wpn = 150 * DEG; return {}; }
      if (s.pre < 1) { o.legs = 'lunge'; const by = BY(o); o.hand = [3, by + 1]; o.wpn = 100 * DEG; return {}; }
      if (s.post < STRIKE) { o.legs = 'jump'; o.lean = 1; const by = BY(o); o.hand = [5, by - 4]; o.wpn = -75 * DEG; o.len = 7; o.plume = 1; return { arc: { c: [1, by - 2], r: 8, a0: 110, a1: -85, u: s.post / STRIKE }, ghost: 1 }; }
      o.legs = 'tuck'; const by = BY(o); o.hand = [5, by - 5]; o.wpn = -88 * DEG; o.len = 7; o.plume = 1; return {};
    },
    air(o, s) {
      o.eye = 'angry'; o.ear = 2; o.legs = 'tuck';
      const by = BY(o);
      if (s.pre < 0.6) { o.hand = [-1, by - 4]; o.wpn = -150 * DEG; o.len = 7; return {}; }
      if (s.pre < 1) { o.hand = [-1, by - 5]; o.wpn = -118 * DEG; o.len = 7; return {}; }
      if (s.post < STRIKE) { o.hand = [5, by]; o.wpn = 35 * DEG; o.plume = 1; return { arc: { c: [1, by - 2], r: 8, a0: -130, a1: 50, u: s.post / STRIKE } }; }
      o.hand = [4, by + 1]; o.wpn = 70 * DEG; return {};
    },
    plunge(o, s) {
      o.eye = 'angry'; o.ear = 2;
      if (s.pre < 0.5) { o.legs = 'tuck'; const by = BY(o); o.hand = [4, by - 5]; o.wpn = -80 * DEG; o.len = 7; return {}; }
      if (s.pre < 1) { o.legs = 'tuck'; o.plume = 1; const by = BY(o); o.hand = [2, by + 2]; o.wpn = 90 * DEG; o.len = 7; return { ghost: 1, fall: 1 }; }
      if (s.post < STRIKE) { o.legs = 'crouch'; const by = BY(o); o.hand = [3, by + 1]; o.wpn = 90 * DEG; o.len = 6; return { flash: 1 - s.post / STRIKE }; }
      o.legs = s.post < 0.7 ? 'crouch' : 'stand'; const by = BY(o); o.hand = [3, by + 1]; o.wpn = 75 * DEG; return {};
    },
    charge(o, s, p, ph) {
      o.eye = 'angry'; o.ear = 2; o.plume = 1; o.lean = 2; o.legs = cycle(true, ph);
      const by = BY(o), jab = s.pre >= 1 && s.post < STRIKE;
      o.hand = [jab ? 6 : 4, by - 1]; o.wpn = (jab ? 0 : 8) * DEG;
      return { ghost: 1, thrust: jab ? 1 - s.post / STRIKE : 0 };
    },
    finale(o, s, p) {
      o.eye = 'angry'; o.ear = 2; o.gold = true; o.plume = 1;
      if (s.pre < 0.6) { o.legs = 'tuck'; const by = BY(o); o.hand = [5, by - 5]; o.wpn = -86 * DEG; o.len = 8; return { gold: 0.5 + s.pre, ghost: 1 }; }
      if (s.pre < 1) { o.legs = 'tuck'; const by = BY(o); o.hand = [-2, by - 4]; o.wpn = -125 * DEG; o.len = 9; return { gold: 1.2, ghost: 1 }; }
      if (s.post < STRIKE) { o.legs = 'lunge'; o.lean = 2; const by = BY(o); o.hand = [5, by + 1]; o.wpn = 60 * DEG; o.len = 8; return { gold: 1.4, arc: { c: [1, by - 3], r: 10, a0: -150, a1: 75, u: s.post / STRIKE, gold: 1 } }; }
      o.legs = 'crouch'; const by = BY(o); o.hand = [5, by + 1]; o.wpn = 80 * DEG; o.len = 7; o.gold = s.post < 0.8; return { gold: 1 - s.post };
    }
  },
  archer: {
    shot(o, s) { return bowAct(o, s, 0); },
    volley(o, s) { return bowAct(o, s, -4 * DEG * (s.i - 1)); },
    rain(o, s) { return bowAct(o, s, -68 * DEG); },
    airshot(o, s) { o.legs = 'tuck'; return bowAct(o, s, 38 * DEG); },
    barrage(o, s) { return bowAct(o, s, (-58 + (s.n > 1 ? s.i / (s.n - 1) : 0) * 44) * DEG, true); }
  },
  assassin: {
    stab(o, s, p, ph, F) {
      o.eye = 'angry'; o.ear = 2;
      if (s.i === 0 && s.pre < 1) {
        // Vanishing: low and still; then there behind them, blades cocked.
        o.legs = 'crouch'; const by = BY(o);
        if ((F?.t ?? 1) < BLINK) { o.hand = [2, by]; o.wpn = 0; return {}; }
        o.hand = [0, by - 2]; o.wpn = -150 * DEG; o.armB = [-2, by]; o.wpnB = 170 * DEG; return {};
      }
      if (s.post < STRIKE && s.pre >= 1) {
        o.legs = 'lunge'; o.lean = 1; const by = BY(o);
        if (s.i === 0) { o.hand = [5, by - 1]; o.wpn = 0; o.armB = [-2, by + 1]; o.wpnB = 160 * DEG; }
        else { o.hand = [1, by + 1]; o.wpn = 30 * DEG; o.armB = [5, by]; o.wpnB = 5 * DEG; o.noArmB = false; }
        return { stab: 1 - s.post / STRIKE, b: s.i === 1 };
      }
      o.legs = 'crouch'; const by = BY(o);
      if (s.i === 1 && s.pre < 1) { o.hand = [2, by]; o.wpn = 20 * DEG; o.armB = [-1, by - 3]; o.wpnB = -130 * DEG; return {}; }
      o.hand = [3, by]; o.wpn = 20 * DEG; o.armB = [-2, by + 1]; o.wpnB = 160 * DEG; return {};
    },
    shadow(o, s) {
      o.eye = 'angry'; o.ear = 2; o.ties = 1;
      if (s.pre < 1) { o.legs = 'lunge'; o.lean = 1; const by = BY(o); o.hand = [-2, by + 1]; o.wpn = 175 * DEG; o.armB = [-3, by]; o.wpnB = 185 * DEG; return { ghost: 1 }; }
      if (s.post < STRIKE) { o.legs = 'split'; o.lean = 2; const by = BY(o); o.hand = [5, by - 2]; o.wpn = -15 * DEG; o.armB = [-4, by]; o.wpnB = 185 * DEG; return { ghost: 1, arc: { c: [0, by - 1], r: 7, a0: 150, a1: -10, u: s.post / STRIKE, thin: 1 } }; }
      o.legs = 'crouch'; const by = BY(o); o.hand = [4, by + 1]; o.wpn = 30 * DEG; o.armB = [-3, by]; o.wpnB = 190 * DEG; return {};
    },
    mercy(o, s, p, ph, F) {
      o.eye = 'angry'; o.ear = 2; o.legs = 'kneel';
      const by = BY(o), alt = s.i % 2 === 1;
      if ((F?.t ?? 1) < BLINK) return {};
      const up = s.pre < 1 || s.post > 0.6, hand = up ? [2, by - 5] : [4, by + 2], a = 90 * DEG;
      if (alt) { o.armB = hand; o.wpnB = a; o.hand = [2, by]; o.wpn = 30 * DEG; }
      else { o.hand = hand; o.wpn = a; o.armB = [-2, by]; o.wpnB = 150 * DEG; }
      return !up ? { stab: 1 - s.post / 0.6, b: alt } : {};
    },
    dance(o, s) {
      o.eye = 'angry'; o.ear = 2; o.ties = 1;
      const alt = s.i % 2 === 1;
      if (s.pre < 0.5) { o.legs = 'crouch'; const by = BY(o); o.hand = [0, by - 3]; o.wpn = -140 * DEG; o.armB = [-2, by - 2]; o.wpnB = -160 * DEG; return {}; }
      if (s.pre < 1) { o.legs = 'lunge'; const by = BY(o); o.hand = [1, by - 4]; o.wpn = -110 * DEG; o.armB = [-1, by - 3]; o.wpnB = -120 * DEG; return { ghost: 1 }; }
      if (s.post < STRIKE) {
        o.legs = 'split'; o.lean = 2; const by = BY(o);
        if (alt) { o.hand = [5, by + 1]; o.wpn = 40 * DEG; o.armB = [4, by - 1]; o.wpnB = -10 * DEG; }
        else { o.hand = [5, by - 1]; o.wpn = -10 * DEG; o.armB = [3, by + 1]; o.wpnB = 50 * DEG; }
        return { arc: { c: [1, by - 1], r: 8, a0: alt ? 100 : -130, a1: alt ? -60 : 60, u: s.post / STRIKE, thin: 1 } };
      }
      o.legs = 'crouch'; const by = BY(o); o.hand = [4, by]; o.wpn = 30 * DEG; o.armB = [-2, by + 1]; o.wpnB = 160 * DEG; return {};
    }
  },
  mage: {
    zap(o, s) {
      const by = BY(o), u = ease(s.pre);
      if (s.pre < 1) { o.hand = [Math.round(lerp(4, 3, u)), Math.round(lerp(by - 2, by - 6, u))]; o.handB = s.pre > 0.4 ? [-1, by - 4] : null; o.hatBend = s.pre > 0.6 ? 1 : 0; o.eye = s.pre > 0.5 ? 'blink' : 'open'; return { charge: s.pre }; }
      if (s.post < STRIKE) { o.hand = [3, by - 7]; o.handB = [-1, by - 5]; o.hatBend = 2; o.eye = 'angry'; return { flash: 1 - s.post / STRIKE, charge: 1 }; }
      o.hand = [Math.round(lerp(3, 4, s.post)), Math.round(lerp(by - 6, by - 2, s.post))]; o.hatBend = 1; return {};
    },
    meteor(o, s) {
      const by = BY(o);
      if (s.pre < 1) { o.hand = [1, by - 4]; o.staffA = -120 * DEG; o.handB = [-2, by - 4]; o.hatBend = 1; o.eye = s.pre > 0.4 ? 'angry' : 'open'; return { fire: s.pre }; }
      if (s.post < STRIKE) { o.hand = [5, by - 3]; o.staffA = -25 * DEG; o.lean = 1; o.eye = 'angry'; return { flash: 1 - s.post / STRIKE }; }
      o.hand = [5, by - 2]; o.staffA = -50 * DEG; return {};
    },
    storm(o, s, p) {
      const by = BY(o);
      o.hand = [3, by - 6]; o.handB = [-2, by - 6]; o.staffA = -95 * DEG; o.hatBend = 1 + (Math.floor(p * 12) % 2); o.eye = 'angry';
      return { sigil: p, charge: 0.6 + 0.4 * s.pre, flash: s.pre >= 1 && s.post < STRIKE ? 1 - s.post / STRIKE : 0 };
    }
  },
  shield: {
    bash(o, s) {
      o.eye = 'angry';
      if (s.pre < 0.5) { o.legs = 'crouch'; o.lean = -1; const by = BY(o); o.sh = [4, by + 1]; return {}; }
      if (s.pre < 1) { o.legs = 'lunge'; o.lean = 1; const by = BY(o); o.sh = [7, by]; return { ghost: 1 }; }
      if (s.post < STRIKE) { o.legs = 'lunge'; o.lean = 2; const by = BY(o); o.sh = [8, by - 3]; o.shRot = -30 * DEG; return { flash: 1 - s.post / STRIKE }; }
      o.legs = 'stand'; const by = BY(o); o.sh = [7, by - 1]; o.shRot = -15 * DEG; return {};
    },
    drop(o, s) {
      o.eye = 'angry';
      if (s.pre < 0.5) { o.legs = 'tuck'; const by = BY(o); o.sh = [3, by - 9]; o.shRot = 180 * DEG; return {}; }
      if (s.pre < 1) { o.legs = 'tuck'; const by = BY(o); o.sh = [2, by + 5]; o.shRot = 0; return { ghost: 1, fall: 1 }; }
      if (s.post < STRIKE) { o.legs = 'crouch'; const by = BY(o); o.sh = [5, by + 2]; return { flash: 1 - s.post / STRIKE }; }
      o.legs = s.post < 0.7 ? 'crouch' : 'stand'; const by = BY(o); o.sh = [6, by + 1]; return {};
    },
    slam(o, s) {
      o.eye = 'angry';
      if (s.pre < 0.4) { o.legs = 'crouch'; const by = BY(o); o.sh = [5, by + 1]; o.shRot = -10 * DEG; return {}; }
      if (s.pre < 1) { o.legs = 'tuck'; const by = BY(o); o.sh = [2, by - 10]; o.shRot = 180 * DEG; return { gold: s.pre }; }
      if (s.post < STRIKE) { o.legs = 'crouch'; const by = BY(o); o.sh = [6, by + 2]; return { flash: 1 - s.post / STRIKE, gold: 1 }; }
      o.legs = s.post < 0.7 ? 'crouch' : 'stand'; const by = BY(o); o.sh = [6, by + 1]; return {};
    },
    charge(o, s, p, ph) {
      o.eye = 'angry'; o.lean = 1; o.legs = cycle(true, ph);
      const by = BY(o), jab = s.pre >= 1 && s.post < STRIKE;
      o.sh = [jab ? 8 : 7, by - 1]; o.shRot = -5 * DEG;
      return { ghost: 1, flash: jab ? 1 - s.post / STRIKE : 0 };
    },
    guard(o, s, p) {
      o.eye = 'angry'; o.legs = 'lunge';
      const by = BY(o); o.sh = [7, by - 1]; o.shRot = -8 * DEG;
      return { flash: Math.max(0, 1 - p * 3) };
    }
  }
};
function bowAct(o, s, a, fast = false) {
  o.eye = 'angry'; o.ear = 2;
  if (s.pre < 1) { aimBow(o, a, clamp01((s.pre - (fast ? 0 : 0.15)) * 1.6)); return { nock: o.draw }; }
  if (s.post < STRIKE) { aimBow(o, a, 0, 1); return { twang: 1 - s.post / STRIKE }; }
  aimBow(o, a, 0, 0); o.draw = 0;
  return {};
}
// The select screen's battle poses.
const HERO = {
  soldier(o, ph) { o.legs = 'lunge'; o.eye = 'angry'; o.plume = Math.sin(ph * 3) > 0 ? 1 : 0; const by = BY(o); o.hand = [6, by - 4]; o.wpn = -84 * DEG; o.len = 7; return { glint: 1 }; },
  archer(o, ph) { o.legs = 'lunge'; o.eye = 'angry'; o.cape = 1; aimBow(o, -12 * DEG, 1); return { nock: 1 }; },
  assassin(o, ph) { o.legs = 'split'; o.eye = 'angry'; o.ear = 2; o.ties = Math.round(Math.sin(ph * 4)); const by = BY(o); o.hand = [4, by]; o.wpn = -25 * DEG; o.armB = [-3, by - 1]; o.wpnB = 200 * DEG; return {}; },
  mage(o, ph) { const by = BY(o); o.hand = [4, by - 5]; o.handB = [-1, by - 5]; o.hatBend = 1; o.eye = 'angry'; return { sigil: (ph * 0.25) % 1, charge: 1, hero: 1 }; },
  shield(o, ph) { o.legs = 'kneel'; o.eye = 'angry'; const by = BY(o); o.sh = [6, by + 2]; return {}; }
};

// What a familiar looks like this frame: the pose (all small whole numbers, so the sprite cache
// hits), where the sprite sits relative to its feet (dx, dy) and the cues for the glow layer.
function poseFor(k, F, t, idx, mem) {
  const ph = t + idx * 0.37, vx = F.vx || 0, sp = Math.abs(vx);
  const breath = Math.sin(ph * 2.6) > 0.55 ? 1 : 0;
  const blink = (ph * 0.7) % 4.3 < 0.12;
  const twitch = (ph * 0.9 + idx) % 5.1 < 0.15 ? 1 : 0;
  const o = { legs: 'stand', eye: blink ? 'blink' : 'open', ear: twitch, tail: Math.round(Math.sin(ph * 1.8) * 1.5), dy: breath };
  let dy = 0, cue = {};
  const acting = F.st === 'act' && ACT[k]?.[F.act];
  const hero = F.st === 'hero';
  const moving = !acting && !hero && sp > 0.12;
  const run = sp > 0.6 || F.st === 'back';
  const cph = mem?.ph ?? t * (run ? 12 : 7);
  if (k === 'mage') {
    // He floats: a slow bob, the hem swaying; moving, he leans in and the hem trails.
    dy = Math.round(Math.sin(ph * 2.2) * 1.2) - (F.air ? 1 : 0);
    o.dy = 0;
    o.hem = moving ? -Math.sign(vx * (F.f || 1)) : Math.round(Math.sin(ph * 2.2 + 1));
    o.lean = moving ? 1 : 0;
  } else if (F.air && !acting && !hero) {
    const rising = (mem?.vy ?? 0) < -0.3;
    o.legs = rising ? 'jump' : 'fall'; o.dy = 0; o.tail = rising ? -1 : 1; o.ear = rising ? 0 : 2;
  } else if (moving) {
    o.legs = cycle(run, cph); o.dy = 0; o.lean = run ? 1 : 0;
    if (run) { o.tail = -2; o.ear = 2; }
  }
  rest(k, o);
  if (k === 'soldier') { o.plume = moving ? 1 : Math.sin(ph * 2) > 0.7 ? 1 : 0; if (moving && run) { o.hand = [3, BY(o) - 1]; o.wpn = -20 * DEG; } }
  if (k === 'archer') o.cape = moving ? 1 : 0;
  if (k === 'assassin') {
    o.ties = moving ? 1 : Math.round(Math.sin(ph * 3));
    if (!moving && !F.air) { o.legs = 'crouch'; o.dy = 0; rest(k, o); }
  }
  if (k === 'shield') { o.eye = blink ? 'blink' : 'angry'; if (F.air) o.sh = [5, BY(o) - 1]; }
  if (acting) {
    const A = actInfo(k, F.act), p = clamp01((F.t || 0) / A.dur), s = stageOf(p, A.hits);
    if (k !== 'mage') o.dy = 0;
    cue = ACT[k][F.act](o, s, p, cph, F) || {};
    // The assassin's blink: he fades out where he stood, and in again behind them.
    if (k === 'assassin' && (F.act === 'stab' || F.act === 'mercy')) {
      const bt = F.t || 0;
      if (bt < BLINK) cue.fade = clamp01(bt / BLINK);
      else if (bt < BLINK * 2) cue.fade = 1 - (bt - BLINK) / BLINK;
    }
    cue.act = F.act; cue.p = p;
  } else if (hero) {
    cue = HERO[k](o, ph) || {};
    if (k !== 'mage') o.dy = breath;
  }
  if (F.st === 'appear') {
    const at = F.t || 0;
    if (at < 0.12) cue.tint = '#ffffff';
    else dy -= Math.round(Math.sin(clamp01((at - 0.12) / 0.28) * Math.PI) * 3);
    o.eye = 'happy';
  }
  if (o.eye === 'blink' && cue.act) o.eye = 'angry';
  // Only what changes the picture goes in the key: ears show on the assassin alone (the others wear
  // a hat, a hood or a helmet), the mage's tail only peeks out or not, and through an action the
  // tail stays put (it would triple the poses to cache).
  if (k !== 'assassin') o.ear = 0;
  if (cue.act) o.tail = k === 'mage' ? 0 : -1;
  if (k === 'mage') o.tail = o.tail > 0 ? 1 : 0;
  return { o, dx: 0, dy, cue };
}

// ---- sprite cache ----------------------------------------------------------------------------
class LRU {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) { const v = this.map.get(k); if (v !== undefined) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k, v) { this.map.set(k, v); if (this.map.size > this.max) this.map.delete(this.map.keys().next().value); }
}
const SPRITES = new LRU(1500);
const keyOf = (k, o) => {
  let s = k;
  for (const n in o) {
    const v = o[n];
    if (v === undefined || v === null) continue;
    s += '|' + n + (Array.isArray(v) ? v.map(q => Math.round(q * 2) / 2).join(',') : typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  }
  return s;
};
export function familiarSprite(k, o) {
  const key = keyOf(k, o);
  let s = SPRITES.get(key);
  if (s === undefined) {
    const G = GRID.clear();
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
// A flat-colored copy (the white pop), only its outline in a color (rim: the decree's gold rim), or
// a dithered copy, every other pixel and the outline left out (rim = 'dither': afterimages).
function tintOf(s, color, rim = false) {
  const key = (rim === 'dither' ? 'd' : rim ? 'r' : 't') + color;
  if (!s.tints[key]) {
    const c = mkCanvas(s.w, s.h), g = c.getContext('2d');
    if (rim === 'dither') {
      g.fillStyle = color;
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x] === 1 && ((x + y) & 1) === 0) g.fillRect(x, y, 1, 1);
    } else if (rim) {
      g.fillStyle = color;
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x] === 2) g.fillRect(x, y, 1, 1);
    } else {
      g.drawImage(s.canvas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, s.w, s.h);
    }
    s.tints[key] = { canvas: c, flipped: null, x0: s.x0, y0: s.y0, w: s.w, h: s.h, tints: {} };
  }
  return s.tints[key];
}
function blit(g, s, x, y, f = 1, scale = 1) {
  if (f >= 0) g.drawImage(s.canvas, Math.round(x + s.x0 * scale), Math.round(y + s.y0 * scale), s.w * scale, s.h * scale);
  else g.drawImage(flippedOf(s), Math.round(x - (s.x0 + s.w) * scale), Math.round(y + s.y0 * scale), s.w * scale, s.h * scale);
}

// ---- effect palettes -------------------------------------------------------------------------
const FXC = {
  steel: { core: '#ffffff', hot: '#fff4d0', mid: '#ffd468', deep: '#b8761e', ink: '#2a1408' },
  gold: { core: '#ffffff', hot: '#fff2a8', mid: '#ffc838', deep: '#c47a12', ink: '#3a1e04' },
  blood: { core: '#ffffff', hot: '#ffd2dc', mid: '#ff4a64', deep: '#8a1030', ink: '#1e0410' },
  magic: { core: '#ffffff', hot: '#f0dcff', mid: '#b878ff', deep: '#5a2aa8', ink: '#12062a' },
  leaf: { core: '#ffffff', hot: '#eaffd8', mid: '#9ae070', deep: '#3a8a3a', ink: '#0a1a0a' },
  fire: { core: '#fff6c4', hot: '#ffd25c', mid: '#ff9a35', deep: '#e3532d', ink: '#97302e' },
  smoke: ['#2a2238', '#3a3050', '#4e4466', '#16101e']
};
const KIND_FX = { soldier: FXC.steel, archer: FXC.leaf, assassin: FXC.blood, mage: FXC.magic, shield: FXC.gold };

// A crescent cut: centre (cx, cy), radius r, from a0 to a1 (radians, view space), width w; u 0..1
// its age: the head sweeps in fast, white-hot, then the tail runs up after it and it thins away.
function crescent(g, P, cx, cy, r, a0, a1, w, u, ox = 0, oy = 0, scale = 1) {
  const head = Math.min(1, u / 0.35), tail = u < 0.3 ? 0 : Math.min(1, (u - 0.3) / 0.7);
  if (head - tail < 0.02) return;
  const span = a1 - a0, n = Math.max(6, Math.ceil(Math.abs(span) * r)), thin = 1 - u * 0.5;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    if (v < tail || v > head) continue;
    const q = (v - tail) / Math.max(0.01, head - tail), prof = Math.sin(Math.PI * Math.pow(q, 1.4)), ww = Math.max(1, Math.round(w * prof * thin));
    const a = a0 + span * v, ca = Math.cos(a), sa = Math.sin(a);
    for (let d = 0; d < ww; d++) {
      const rr = r - d;
      g.fillStyle = d === 0 ? (u < 0.45 && prof > 0.3 ? P.core : P.hot) : d === 1 ? (u < 0.3 && prof > 0.6 ? P.core : P.hot) : d < ww - 1 ? P.mid : P.deep;
      g.fillRect(Math.round(cx + ca * rr * scale + ox), Math.round(cy + sa * rr * scale + oy), scale, scale);
    }
  }
}
// A four-pointed glint (sparkle) of radius r.
function glint(g, P, x, y, r, ox = 0, oy = 0) {
  x = Math.round(x + ox); y = Math.round(y + oy);
  g.fillStyle = P.mid;
  for (let d = 1; d <= r; d++) { g.fillRect(x - d, y, 1, 1); g.fillRect(x + d, y, 1, 1); g.fillRect(x, y - d, 1, 1); g.fillRect(x, y + d, 1, 1); }
  g.fillStyle = P.hot;
  for (let d = 1; d <= Math.max(1, r - 2); d++) { g.fillRect(x - d, y, 1, 1); g.fillRect(x + d, y, 1, 1); g.fillRect(x, y - d, 1, 1); g.fillRect(x, y + d, 1, 1); }
  g.fillStyle = P.core; g.fillRect(x, y, 1, 1);
}
// A jagged lightning path from (x0, y0) down to (x1, y1) (re-rolled by seed).
function boltPath(x0, y0, x1, y1, seed, jag = 7) {
  const rnd = seeded(seed), pts = [[x0, y0]], n = Math.max(3, Math.round(Math.abs(y1 - y0) / 11));
  for (let i = 1; i < n; i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u + (rnd() - 0.5) * jag * 2, y0 + (y1 - y0) * u + (rnd() - 0.5) * 4]); }
  pts.push([x1, y1]);
  return pts;
}
function strokePath(g, pts, c, w, ox, oy) {
  g.fillStyle = c;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let k = 0; k <= n; k++) g.fillRect(Math.round(ax + ((bx - ax) * k) / n - (w - 1) / 2 + ox), Math.round(ay + ((by - ay) * k) / n + oy), w, 1);
  }
}
// A filled disc with dithered rings (the meteor's blast, the gem's glow).
function disc(g, x, y, r, colors, ox, oy, t = 0) {
  const R = Math.ceil(r);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const d = Math.hypot(i, j) / Math.max(0.5, r);
    if (d > 1) continue;
    const n = colors.length, k = Math.min(n - 1, Math.floor(d * n + (((i * 7 + j * 13 + Math.floor(t * 30)) & 3) / 4) * 0.6));
    g.fillStyle = colors[k];
    g.fillRect(Math.round(x + i + ox), Math.round(y + j + oy), 1, 1);
  }
}

// ---- the court on the field ------------------------------------------------------------------
let LIVE = null;
// The order they are drawn in: the mage at the back, the shield last.
const ORDER = [3, 1, 2, 0, 4];
// One familiar as drawCourt placed it (popping in white, fading out on a blink).
function blitRec(g, r, ox, oy, alpha) {
  const s = r.q.cue.tint ? tintOf(r.s, r.q.cue.tint) : r.s;
  g.globalAlpha = alpha * (r.q.cue.fade ? 1 - r.q.cue.fade * 0.8 : 1);
  blit(g, s, r.x + ox, r.y + oy, r.f);
  g.globalAlpha = 1;
}
const FEET = 17 * S;
export class CourtFX {
  constructor(renderer = null) {
    this.r = renderer;
    this.fx = [];
    this.parts = [];
    this.mem = new Map();
    this.drawn = new Map();
    this.bullets = [];
    // How fast game time runs against the dt update() is handed (the LAB's slow motion is not in
    // it): measured from the game clock the draw calls see, so the effects slow down with the game.
    this.rate = 1; this.clock = { t: null, gt: null, acc: 0, gacc: 0 };
    LIVE = this;
  }

  reset() { this.fx.length = 0; this.parts.length = 0; this.mem.clear(); this.drawn.clear(); this.bullets.length = 0; this.rate = 1; this.clock = { t: null, gt: null, acc: 0, gacc: 0 }; }

  // Particles: k 'spark' (glowing, with a streak), 'smoke' (a puff that grows and fades), 'ember',
  // 'mote' (a gold speck rising); x, y view pixels, v in px/s.
  part(k, x, y, vx, vy, life, c, extra = {}) {
    if (this.parts.length > 600) return;
    this.parts.push({ k, x, y, vx, vy, t: 0, life, c, g: 0, drag: 1, s: 1, ...extra });
  }
  sparks(x, y, n, P, rnd, { a = -Math.PI / 2, spread = Math.PI * 2, sp = 90, life = 0.3, g = 260 } = {}) {
    for (let i = 0; i < n; i++) {
      const an = a + (rnd() - 0.5) * spread, v = sp * (0.4 + rnd() * 0.8);
      this.part('spark', x, y, Math.cos(an) * v, Math.sin(an) * v, life * (0.6 + rnd() * 0.6), [P.core, P.hot, P.mid][Math.floor(rnd() * 3)], { g, drag: 0.04 });
    }
  }
  smoke(x, y, n, rnd, { r = 6, life = 0.5, up = 14, cols = FXC.smoke } = {}) {
    for (let i = 0; i < n; i++) {
      const an = rnd() * Math.PI * 2, d = rnd() * r;
      this.part('smoke', x + Math.cos(an) * d, y + Math.sin(an) * d * 0.7, Math.cos(an) * 18 * rnd(), -up * (0.4 + rnd()), life * (0.6 + rnd() * 0.6), cols[Math.floor(rnd() * cols.length)], { s: 2 + Math.floor(rnd() * 2), drag: 0.1 });
    }
  }

  event(e) {
    const x = (e.x ?? 0) * S, y = (e.y ?? 0) * S, rnd = seeded(((e.id || 1) * 2654435761) ^ 0x5bd1);
    switch (e.fx) {
      case 'courtHit': this.hitFx(e, x, y, rnd); break;
      case 'blink': {
        const x2 = (e.x2 ?? e.x) * S, y2 = (e.y2 ?? e.y) * S;
        this.smoke(x, y - 6, 9, rnd, { r: 6, life: 0.45, up: 10 });
        this.smoke(x2, y2 - 6, 7, rnd, { r: 5, life: 0.4, up: 16 });
        this.fx.push({ k: 'blink', x, y: y - 6, x2, y2: y2 - 6, t: 0, life: 0.18 });
        for (let i = 0; i < 4; i++) this.part('spark', x2 + (rnd() - 0.5) * 8, y2 - 4 - rnd() * 10, 0, -20, 0.3, FXC.magic.mid, { drag: 0.1 });
        break;
      }
      case 'bolt': {
        this.fx.push({ k: 'bolt', x, y, t: 0, life: 0.34, seed: (e.id || 1) * 31 });
        this.sparks(x, y + FEET - 2, 12, FXC.magic, rnd, { spread: 2.6, sp: 120, life: 0.35 });
        this.sparks(x, y, 6, FXC.gold, rnd, { sp: 70, life: 0.3, g: 120 });
        break;
      }
      case 'meteor': {
        const x0 = (e.x0 ?? e.x) * S, y0 = (e.y0 ?? e.y - 130) * S;
        this.fx.push({ k: 'meteor', x0, y0, x, y, t: 0, life: 0.55 });
        this.sparks(x, y, 18, FXC.fire, rnd, { sp: 140, life: 0.45, g: 300 });
        for (let i = 0; i < 8; i++) this.part('ember', x + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 6, (rnd() - 0.5) * 60, -30 - rnd() * 50, 0.6 + rnd() * 0.5, rnd() < 0.5 ? FXC.fire.hot : FXC.fire.mid, { g: 40, drag: 0.4 });
        this.smoke(x, y, 10, rnd, { r: 9, life: 0.8, up: 20, cols: ['#3a2a30', '#4e3a3a', '#2a2028', '#6a4a3a'] });
        break;
      }
      case 'shieldSlam': {
        this.fx.push({ k: 'slam', x, y, r: (e.r ?? 100) * S, t: 0, life: 0.55 });
        this.sparks(x, y - 2, 16, FXC.gold, rnd, { spread: 2.2, sp: 130, life: 0.45, g: 300 });
        this.smoke(x, y - 2, 10, rnd, { r: 14, life: 0.6, up: 8, cols: ['#5a5068', '#6a6078', '#4a4258'] });
        break;
      }
      case 'courtPoof': case 'courtAppear': {
        const P = KIND_FX[e.k] || FXC.gold, app = e.fx === 'courtAppear';
        this.smoke(x, y - 6, app ? 6 : 10, rnd, { r: 5, life: 0.5, up: 16, cols: ['#d8d0e8', '#a89cc0', '#7a6e94', '#efe8f8'] });
        for (let i = 0; i < 6; i++) { const an = rnd() * Math.PI * 2; this.part('spark', x + Math.cos(an) * 4, y - 6 + Math.sin(an) * 4, Math.cos(an) * 40, Math.sin(an) * 40 - 20, 0.4, [P.core, P.hot, P.mid][i % 3], { drag: 0.05 }); }
        this.fx.push({ k: app ? 'appear' : 'poof', x, y: y - 6, P, t: 0, life: app ? 0.4 : 0.3 });
        break;
      }
      case 'decree': {
        this.fx.push({ k: 'decree', x, y: y - 6, who: e.who, t: 0, life: 0.9, seed: rnd() * 9 });
        this.sparks(x, y - 20, 18, FXC.gold, rnd, { sp: 110, life: 0.6, g: 60 });
        break;
      }
      case 'royal': {
        const f = e.f || 1;
        this.fx.push({ k: 'royal', x, y, f, t: 0, life: 0.5 });
        this.sparks(x, y, 26, FXC.gold, rnd, { sp: 170, life: 0.5, g: 260 });
        for (let i = 0; i < 10; i++) this.part('mote', x + (rnd() - 0.5) * 40, y + FEET - 1, 0, -40 - rnd() * 60, 0.6 + rnd() * 0.4, rnd() < 0.5 ? FXC.gold.hot : FXC.gold.mid, { drag: 0.6 });
        break;
      }
    }
    if (this.fx.length > 80) this.fx.splice(0, this.fx.length - 80);
  }

  // A familiar's strike landing: what it looks like depends on who struck and how.
  hitFx(e, x, y, rnd) {
    const f = e.f || 1, k = e.k, act = e.act, P = KIND_FX[k] || FXC.steel;
    const push = q => this.fx.push({ t: 0, x, y, f, P, ...q });
    if (k === 'soldier') {
      if (act === 'rise') push({ k: 'cut', cx: x - f * 4, cy: y + 4, r: 14, a0: 110, a1: -85, w: 4, life: 0.2 });
      else if (act === 'plunge') { push({ k: 'pierce', life: 0.22 }); this.smoke(x, y + FEET - 2, 6, rnd, { r: 10, life: 0.5, up: 6, cols: ['#5a5068', '#6a6078'] }); }
      else if (act === 'charge') push({ k: 'thrust', life: 0.14 });
      else if (act !== 'finale') push({ k: 'cut', cx: x - f * 2, cy: y - 1, r: 13, a0: -140, a1: 40, w: 4, life: 0.2 });
      push({ k: 'star', life: 0.1, big: act === 'plunge' || act === 'finale' });
      this.sparks(x, y, 7, P, rnd, { a: f > 0 ? 0 : Math.PI, spread: 1.8, sp: 120 });
    } else if (k === 'assassin') {
      if (act === 'shadow') push({ k: 'line', life: 0.26 });
      else push({ k: 'cross', life: 0.16, big: act === 'dance', ang: rnd() * 0.6 - 0.3 });
      this.sparks(x, y, 5, P, rnd, { a: f > 0 ? 0 : Math.PI, spread: 2, sp: 90 });
      this.smoke(x - f * 4, y, 2, rnd, { r: 3, life: 0.3, up: 10 });
    } else if (k === 'shield') {
      push({ k: 'star', life: 0.14, big: true, P: FXC.gold });
      push({ k: 'ring', life: 0.26, r: act === 'drop' ? 18 : 13 });
      this.sparks(x, y, 10, FXC.gold, rnd, { a: act === 'bash' ? -Math.PI / 2 : f > 0 ? 0 : Math.PI, spread: 1.6, sp: 130 });
      if (act === 'drop') this.smoke(x, y + FEET - 2, 8, rnd, { r: 12, life: 0.5, up: 6, cols: ['#5a5068', '#6a6078'] });
    } else if (k === 'mage') {
      push({ k: 'ring', life: 0.22, r: 10, P: FXC.magic });
      this.sparks(x, y, 6, FXC.magic, rnd, { sp: 80 });
    } else {
      push({ k: 'star', life: 0.1 });
      this.sparks(x, y, 4, P, rnd, { sp: 70 });
    }
  }

  update(dt) {
    if (!(dt > 0)) return;
    const C = this.clock;
    C.acc += dt;
    if (C.acc >= 0.2) {
      // Over the last fifth of a second: game time gone by against frame time.
      if (C.gacc > 0) this.rate = Math.max(0.05, Math.min(1, C.gacc / C.acc));
      C.acc = 0; C.gacc = 0;
    }
    dt *= this.rate;
    for (const q of this.fx) q.t += dt;
    this.fx = this.fx.filter(q => q.t < q.life);
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      const d = Math.pow(p.drag, dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
  }

  // Per familiar: how far it has walked (its stride phase), how fast it is rising or falling, and
  // where it was the last few frames (for afterimages). Updated once per frame of game time.
  track(a, t) {
    const C = a.court;
    for (let i = 0; i < C.length; i++) {
      const F = C[i], key = a.id + ':' + i;
      let m = this.mem.get(key);
      if (!m || t < m.t - 0.5 || F.st === 'gone') { m = { t, x: F.x, y: F.y, vy: 0, ph: 0, hist: [], ht: 0 }; this.mem.set(key, m); }
      const dt = Math.min(0.1, Math.max(0, t - m.t));
      if (dt <= 0) continue;
      const vy = (F.y - m.y) / (dt * 60);
      m.vy = m.vy * 0.5 + vy * 0.5;
      const sp = Math.abs(F.vx || 0), run = sp > 0.6 || F.st === 'back';
      m.ph += dt * (run ? 13 : 7) * (sp > 0.12 || F.st === 'back' ? 1 : 0);
      m.ht += dt;
      if (m.ht >= 1 / 30) { m.ht = 0; m.hist.push({ x: F.x * S, y: F.y * S, f: F.f || 1, s: null, dy: 0 }); if (m.hist.length > 5) m.hist.shift(); }
      m.x = F.x; m.y = F.y; m.t = t;
    }
  }

  // One familiar's pose and sprite this frame, and where it goes (view px without shake).
  figure(a, i, t) {
    const F = a.court[i], k = F.k || KINDS[i];
    if (!BUILD[k]) return null;
    const m = this.mem.get(a.id + ':' + i);
    const q = poseFor(k, F, t, i, m);
    const s = familiarSprite(k, q.o);
    const f = (F.f || 1) >= 0 ? 1 : -1;
    const x = Math.round(F.x * S), y = Math.round(F.y * S) + q.dy;
    if (m && m.hist.length) { const h = m.hist[m.hist.length - 1]; if (!h.s) { h.s = s; h.f = f; h.dy = q.dy; } }
    return { k, F, q, s, f, x, y, t };
  }

  // The court on the lit layer: front=false before the fighters (in formation behind the King, and
  // their shadows), front=true after them (the shield on guard, and whoever is striking).
  drawCourt(g, a, ox, oy, t, front) {
    const C = a?.court;
    if (!C?.length) return;
    if (!front) this.track(a, t);
    let recs = this.drawn.get(a.id);
    if (!recs || recs.t !== t) { recs = { t, list: [] }; this.drawn.set(a.id, recs); }
    if (!front) {
      // Little contact shadows on the floor (the mage's well under him).
      g.fillStyle = '#0a0612';
      for (const F of C) {
        if (!F || F.st === 'gone' || (F.air && F.k !== 'mage')) continue;
        const sx = Math.round(F.x * S + ox), sy = Math.round(F.y * S + oy) + (F.k === 'mage' ? Math.round(12 * S) : 0);
        g.globalAlpha = F.k === 'mage' ? 0.22 : 0.35;
        g.fillRect(sx - 3, sy - 1, 7, 1); g.fillRect(sx - 2, sy, 5, 1);
      }
      g.globalAlpha = 1;
    }
    for (const i of ORDER) {
      const F = C[i];
      if (!F || F.st === 'gone') continue;
      const inFront = F.st === 'act' || F.k === 'shield';
      if (inFront !== !!front) continue;
      const r = this.figure(a, i, t);
      if (!r?.s) continue;
      r.front = !!front;
      recs.list[i] = r;
      blitRec(g, r, ox, oy, 1);
    }
  }

  // After the light map: the familiars keep part of their own color, as the fighters do (they would
  // sink into the dark arenas otherwise). The renderer calls it right after its fighters' own-color
  // pass with the figure records: the familiars behind the fighters are cut out where a fighter
  // stands in front of them, the ones in front are drawn as they are. Until the renderer calls it,
  // drawCourtGlow does it for the familiars in front (the ones striking) on its own.
  drawCourtKeep(g, a, ox, oy, t, figures = null, alpha = 0.45) {
    const recs = a?.court && this.drawn.get(a.id);
    if (!recs || recs.t !== t) return;
    recs.kept = t;
    const ga = g.globalAlpha, gc = g.globalCompositeOperation;
    if (figures) {
      // Behind: into a scratch canvas, the fighters' silhouettes punched out of it.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const r of recs.list) if (r && !r.front) {
        const X = r.x + ox + (r.f >= 0 ? r.s.x0 : -(r.s.x0 + r.s.w)), Y = r.y + oy + r.s.y0;
        x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X + r.s.w); y1 = Math.max(y1, Y + r.s.h);
      }
      if (x1 > x0) {
        x0 = Math.floor(x0); y0 = Math.floor(y0);
        const w = Math.ceil(x1 - x0) + 1, h = Math.ceil(y1 - y0) + 1;
        let c = this.scratch;
        if (!c || c.width < w || c.height < h) c = this.scratch = mkCanvas(Math.max(w, c?.width || 0), Math.max(h, c?.height || 0));
        const sg = c.getContext('2d');
        sg.globalCompositeOperation = 'source-over';
        sg.clearRect(0, 0, c.width, c.height);
        for (const i of ORDER) { const r = recs.list[i]; if (r && !r.front) blitRec(sg, r, ox - x0, oy - y0, 1); }
        sg.globalCompositeOperation = 'destination-out';
        for (const f of figures) if (f?.fc?.body?.c && f.x < x0 + w && f.y < y0 + h && f.x + f.fc.body.c.width > x0 && f.y + f.fc.body.c.height > y0) sg.drawImage(f.fc.body.c, f.x - x0, f.y - y0);
        sg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = alpha;
        g.drawImage(c, x0, y0);
      }
    }
    g.globalCompositeOperation = 'source-over';
    for (const i of ORDER) { const r = recs.list[i]; if (r && r.front) blitRec(g, r, ox, oy, alpha); }
    g.globalAlpha = ga; g.globalCompositeOperation = gc;
  }

  // The glowing bits on the emissive layer: the mage's crystal and spells, the assassin's eyes,
  // blades flashing through their swings and their smears, afterimages of dashes, and while the
  // King's decree lasts, his golden aura and a gold rim on every one of them.
  drawCourtGlow(g, a, ox, oy, t) {
    const C = a?.court;
    if (!C?.length) return;
    const recs = this.drawn.get(a.id);
    if (recs && recs.t === t && recs.kept !== t && this.r?.lg && this.r.lg !== g) this.drawCourtKeep(this.r.lg, a, ox, oy, t, null);
    const decree = a.act === 'decree' && !a.dead;
    if (decree) this.drawAura(g, a, ox, oy, t);
    for (let i = 0; i < C.length; i++) {
      const F = C[i];
      if (!F || F.st === 'gone') continue;
      const r = recs && recs.t === t && recs.list[i] ? recs.list[i] : this.figure(a, i, t);
      if (!r?.s) continue;
      const m = this.mem.get(a.id + ':' + i);
      // Afterimages along a dash: dithered, fainter the older, only where it has really moved.
      if (r.q.cue.ghost && m) {
        const col = KIT[r.k].ghost, n = m.hist.length;
        let lx = F.x * S, ly = F.y * S;
        for (let j = n - 2; j >= Math.max(0, n - 4); j--) {
          const h = m.hist[j];
          if (!h.s || Math.hypot(h.x - lx, h.y - ly) < 4) continue;
          lx = h.x; ly = h.y;
          g.globalAlpha = 0.42 - 0.14 * (n - 2 - j);
          blit(g, tintOf(h.s, col, 'dither'), Math.round(h.x + ox), Math.round(h.y + oy) + h.dy, h.f);
        }
        g.globalAlpha = 1;
      }
      glowBits(g, r.k, r.s, r.q, r.x + ox, r.y + oy, r.f, 1, t + i * 0.37);
      if (decree) {
        g.globalAlpha = 0.38 + 0.18 * Math.sin(t * 9 + i);
        blit(g, tintOf(r.s, '#ffd860', true), r.x + ox, r.y + oy, r.f);
        g.globalAlpha = 1;
      }
    }
  }

  // The King's golden aura through his decree: a halo of rays turning behind him, a ring of light
  // at his feet and motes of gold rising round him.
  drawAura(g, a, ox, oy, t) {
    const at = a.actT ?? 0, cx = a.x * S + ox, cy = (a.y + 17) * S + oy, k = Math.min(1, at / 0.25);
    const P = FXC.gold;
    // Rays: long and thin, from outside his silhouette, turning slowly.
    for (let i = 0; i < 10; i++) {
      const an = (i / 10) * Math.PI * 2 + t * 0.7, len = (9 + 6 * ((i * 7) % 3)) * k, r0 = 17;
      for (let d = 0; d < len; d++) {
        if ((d + Math.floor(t * 20)) % 5 === 0) continue;
        g.globalAlpha = (1 - d / len) * 0.75;
        g.fillStyle = d < len * 0.4 ? P.hot : P.mid;
        g.fillRect(Math.round(cx + Math.cos(an) * (r0 + d)), Math.round(cy - 12 + Math.sin(an) * (r0 + d) * 0.9), 1, 1);
      }
    }
    g.globalAlpha = 1;
    // The ring at his feet.
    const R = 14 + Math.sin(t * 6) * 1.5;
    for (let i = 0; i < 48; i++) {
      const an = (i / 48) * Math.PI * 2, x = cx + Math.cos(an) * R, y = cy + Math.sin(an) * R * 0.22;
      g.fillStyle = Math.sin(an) > 0 ? P.hot : P.deep;
      if ((i + Math.floor(t * 16)) % 3) g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // Motes rising.
    for (let i = 0; i < 9; i++) {
      const u = (t * 0.8 + i * 0.137) % 1, x = cx + Math.sin(i * 2.3 + t * 2) * (8 + (i % 3) * 4), y = cy - u * 34;
      g.fillStyle = u < 0.5 ? P.hot : P.mid;
      g.globalAlpha = 1 - u;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    g.globalAlpha = 1;
  }

  // Arrows and magic bolts (lit layer); true if it drew b.
  drawBullet(g, b, ox, oy, t) {
    if (!b || (b.kind !== 'arrow' && b.kind !== 'magic')) return false;
    const x = b.x * S + ox, y = b.y * S + oy;
    if (b.kind === 'arrow') {
      let vx = b.vx ?? 0, vy = b.vy ?? 0;
      if (!vx && !vy) vy = 1;
      const n = Math.hypot(vx, vy), c = vx / n, s = vy / n;
      const px = (col, d, side = 0) => { g.fillStyle = col; g.fillRect(Math.round(x - c * d - s * side), Math.round(y - s * d + c * side), 1, 1); };
      // A dark line under it so it reads on any ground, then the head, the shaft and the fletching.
      g.globalAlpha = 0.6;
      for (let d = 0; d <= 7; d++) px('#140c18', d, 1);
      g.globalAlpha = 1;
      px('#ffffff', 0); px('#b8c0dc', 1); px('#8a90b0', 1, -1); px('#8a90b0', 1, 1);
      for (let d = 2; d <= 6; d++) px(d < 4 ? '#d49a5a' : '#a8703c', d);
      px('#f0f4e8', 6, -1); px('#f0f4e8', 6, 1); px('#58b858', 7, -1); px('#58b858', 7, 1); px('#e8e0d0', 7);
      this.bullets.push({ k: 'arrow', x: x - ox, y: y - oy, c, s });
      return true;
    }
    // A magic bolt: a violet orb with a white core and a gold spark circling it, a fading trail.
    let vx = b.vx ?? (b.x - (b.px ?? b.x)), vy = b.vy ?? (b.y - (b.py ?? b.y));
    const n = Math.hypot(vx, vy) || 1;
    g.fillStyle = '#5a2aa8';
    for (let i = 1; i <= 4; i++) { g.globalAlpha = 0.7 - i * 0.15; g.fillRect(Math.round(x - (vx / n) * i * 2), Math.round(y - (vy / n) * i * 2), 1, 1); }
    g.globalAlpha = 1;
    g.fillStyle = '#b878ff'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    this.bullets.push({ k: 'magic', x: x - ox, y: y - oy, vx: vx / n, vy: vy / n });
    return true;
  }

  // The event effects, on the emissive layer.
  drawEffects(g, ox, oy, t) {
    const C = this.clock;
    if (C.gt !== null) { const d = t - C.gt; if (d >= 0 && d < 0.5) C.gacc += d; }
    C.gt = t;
    const dot = (c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    // The glowing part of the shots drawn on the lit layer this frame.
    for (const b of this.bullets) {
      if (b.k === 'arrow') {
        // A streak along the whole shaft (so it reads against the dark), fading off behind it.
        const at = (d, side = 0) => [b.x - b.c * d - b.s * side, b.y - b.s * d + b.c * side];
        for (let d = 1; d <= 12; d++) {
          g.globalAlpha = d <= 7 ? 0.42 : 0.3 * (1 - (d - 7) / 6);
          dot(d < 2 ? '#e8eeff' : d < 7 ? '#ffe2b0' : '#fff4d8', ...at(d));
        }
        g.globalAlpha = 0.5; dot('#c8ffb8', ...at(7, -1)); dot('#c8ffb8', ...at(7, 1));
        g.globalAlpha = 1; dot('#ffffff', b.x, b.y);
      }
      else {
        dot(FXC.magic.mid, b.x - 1, b.y - 1, 3); dot('#ffffff', b.x, b.y);
        const an = t * 18, gx = b.x + Math.cos(an) * 3, gy = b.y + Math.sin(an) * 3;
        dot(FXC.gold.hot, gx, gy);
        g.globalAlpha = 0.6; for (let i = 1; i <= 5; i++) dot(i < 3 ? FXC.magic.hot : FXC.magic.mid, b.x - b.vx * i * 2, b.y - b.vy * i * 2); g.globalAlpha = 1;
      }
    }
    this.bullets.length = 0;
    for (const q of this.fx) {
      const u = q.t / q.life;
      switch (q.k) {
        case 'cut': crescent(g, q.P, q.cx, q.cy, q.r, (q.f > 0 ? q.a0 : 180 - q.a0) * DEG, (q.f > 0 ? q.a1 : 180 - q.a1) * DEG, q.w, u, ox, oy); break;
        case 'star': {
          const r = Math.round((q.big ? 8 : 5) * (1 - u * 0.6));
          glint(g, q.P, q.x, q.y, r, ox, oy);
          if (q.big) { const d = Math.round(r * 0.6); dot(q.P.hot, q.x - d, q.y - d); dot(q.P.hot, q.x + d, q.y - d); dot(q.P.hot, q.x - d, q.y + d); dot(q.P.hot, q.x + d, q.y + d); }
          break;
        }
        case 'ring': {
          const P = q.P, R = q.r * (0.3 + 0.7 * ease(u));
          g.globalAlpha = 1 - u;
          for (let i = 0; i < 40; i++) { const an = (i / 40) * Math.PI * 2; dot(i % 2 ? P.hot : P.mid, q.x + Math.cos(an) * R, q.y + Math.sin(an) * R * 0.85); }
          g.globalAlpha = 1;
          break;
        }
        case 'cross': {
          // Two quick crossing stabs: white-hot lines that snap open and shrink away.
          const L = (q.big ? 7 : 5) * (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) * 0.8);
          for (const sd of [-1, 1]) {
            const an = sd * (Math.PI / 4) + (q.ang || 0);
            for (let d = -L; d <= L; d++) dot(Math.abs(d) < L * 0.4 ? q.P.core : Math.abs(d) < L * 0.75 ? q.P.hot : q.P.mid, q.x + Math.cos(an) * d, q.y + Math.sin(an) * d);
          }
          break;
        }
        case 'line': {
          // The shadow dash's cut straight through: a long hairline that opens to a white seam.
          const L = 20, w = u < 0.25 ? 1 : u < 0.6 ? 2 : 1;
          for (let d = -L; d <= L; d++) {
            const v = Math.abs(d) / L;
            if (v > 1 - u * 0.6 && u > 0.4) continue;
            dot(v < 0.3 ? q.P.core : v < 0.7 ? q.P.hot : q.P.mid, q.x + d * q.f, q.y - 1 + Math.round(d * 0.12) * q.f, 1, w);
          }
          break;
        }
        case 'pierce': {
          // The plunge: a streak down onto them and a burst of light on the floor.
          const top = q.y - 26, bot = q.y + FEET;
          g.globalAlpha = 1 - u;
          for (let yy = top; yy < bot; yy++) dot(yy > bot - 6 ? q.P.core : q.P.hot, q.x, yy);
          g.globalAlpha = 1;
          const R = 4 + u * 14;
          for (let i = -R; i <= R; i++) if (Math.abs(i) > R - 4 || u < 0.2) dot(Math.abs(i) > R - 2 ? q.P.mid : q.P.hot, q.x + i, bot - 1);
          break;
        }
        case 'thrust': {
          const L = 14 * (1 - u);
          for (let d = 0; d < L; d++) dot(d < 4 ? q.P.core : q.P.hot, q.x - q.f * d, q.y);
          glint(g, q.P, q.x, q.y, 3, ox, oy);
          break;
        }
        case 'blink': {
          // A thread of shadow between where the assassin was and where he is.
          g.globalAlpha = (1 - u) * 0.8;
          const n = Math.ceil(Math.hypot(q.x2 - q.x, q.y2 - q.y) / 2);
          for (let i = 0; i <= n; i += 1) { const v = i / n; if ((i + Math.floor(t * 40)) % 3) dot(i % 2 ? FXC.magic.deep : FXC.magic.mid, q.x + (q.x2 - q.x) * v, q.y + (q.y2 - q.y) * v + Math.sin(v * Math.PI) * -6); }
          g.globalAlpha = 1;
          break;
        }
        case 'bolt': this.drawBolt(g, q, u, ox, oy, t); break;
        case 'meteor': this.drawMeteor(g, q, u, ox, oy, t); break;
        case 'slam': this.drawSlam(g, q, u, ox, oy, t); break;
        case 'poof': case 'appear': {
          const P = q.P, R = (q.k === 'appear' ? 12 : 8) * ease(u);
          g.globalAlpha = 1 - u;
          for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2 + u; dot(i % 2 ? P.hot : P.mid, q.x + Math.cos(an) * R, q.y + Math.sin(an) * R); }
          g.globalAlpha = 1;
          if (q.k === 'appear' && u < 0.5) glint(g, P, q.x, q.y - 2, Math.round(5 * (1 - u * 2)), ox, oy);
          break;
        }
        case 'decree': this.drawDecree(g, q, u, ox, oy, t); break;
        case 'royal': this.drawRoyal(g, q, u, ox, oy, t); break;
      }
    }
    // Particles.
    for (const p of this.parts) {
      const k = p.t / p.life;
      if (p.k === 'smoke') {
        const sz = Math.round(p.s + k * 2);
        g.globalAlpha = 0.75 * (1 - k);
        dot(p.c, p.x - sz / 2, p.y - sz / 2, sz);
      } else if (p.k === 'spark') {
        g.globalAlpha = 1;
        dot(p.c, p.x, p.y);
        g.globalAlpha = 0.5;
        dot(p.c, p.x - p.vx * 0.012, p.y - p.vy * 0.012);
      } else {
        g.globalAlpha = 1 - k * 0.7;
        dot(p.c, p.x, p.y);
      }
    }
    g.globalAlpha = 1;
  }

  // Lightning out of the top of the screen onto them: a white core, a violet halo, forks, a flash at
  // the start, and a burst of light where it hits the floor.
  drawBolt(g, q, u, ox, oy, t) {
    const P = FXC.magic, top = -oy - 4, bot = q.y + FEET;
    const flick = Math.floor(q.t * 30);
    if (u > 0.55 && flick % 2) return;
    const pts = boltPath(q.x + ((q.seed % 7) - 3) * 3, top, q.x, bot, q.seed + flick * 13, 7);
    const wide = u < 0.15;
    strokePath(g, pts.map(([x, y]) => [x - 1, y]), P.mid, 1, ox, oy);
    strokePath(g, pts.map(([x, y]) => [x + 1, y]), P.mid, 1, ox, oy);
    if (wide) { strokePath(g, pts.map(([x, y]) => [x - 2, y]), P.deep, 1, ox, oy); strokePath(g, pts.map(([x, y]) => [x + 2, y]), P.deep, 1, ox, oy); }
    strokePath(g, pts, u < 0.4 ? P.core : P.hot, 1, ox, oy);
    // Two forks off it.
    const rnd = seeded(q.seed + flick * 7);
    for (let j = 0; j < 2; j++) {
      const i = 1 + Math.floor(rnd() * (pts.length - 2)), [fx, fy] = pts[i], sd = rnd() < 0.5 ? -1 : 1;
      strokePath(g, boltPath(fx, fy, fx + sd * (8 + rnd() * 10), fy + 10 + rnd() * 10, q.seed + j * 5 + flick, 4), P.hot, 1, ox, oy);
    }
    // The strike on the floor.
    const R = 3 + u * 12;
    g.globalAlpha = 1 - u;
    for (let i = -R; i <= R; i++) g.fillStyle = Math.abs(i) < R * 0.4 ? P.core : P.mid, g.fillRect(Math.round(q.x + i + ox), Math.round(bot - 1 + oy), 1, 1);
    if (u < 0.3) disc(g, q.x, bot - 3, 4 - u * 8, [P.core, P.hot, P.mid], ox, oy, t);
    g.globalAlpha = 1;
  }

  // The meteor: its fiery trail down from where it fell, and the blast where it struck.
  drawMeteor(g, q, u, ox, oy, t) {
    const P = FXC.fire;
    // The trail: thick and bright at the bottom, burning out back up its path.
    const tail = Math.max(0, 1 - u * 2.2);
    if (tail > 0) {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const v = i / n, x = q.x + (q.x0 - q.x) * v * 0.55 * (0.4 + tail * 0.6), y = q.y + (q.y0 - q.y) * v * 0.55 * (0.4 + tail * 0.6), w = Math.max(1, Math.round((1 - v) * 4 * tail));
        g.fillStyle = v < 0.2 ? P.core : v < 0.45 ? P.hot : v < 0.7 ? P.mid : P.deep;
        g.fillRect(Math.round(x - w / 2 + ox), Math.round(y - w / 2 + oy), w, w);
      }
    }
    // The blast: a fireball swelling and breaking up into embers.
    const R = u < 0.25 ? 4 + (u / 0.25) * 10 : 14 * (1 - (u - 0.25) * 0.8);
    if (u < 0.6) disc(g, q.x, q.y, R, u < 0.12 ? [P.core, P.core, P.hot, P.mid] : u < 0.35 ? [P.core, P.hot, P.mid, P.deep] : [P.hot, P.mid, P.deep, P.ink], ox, oy, t);
    // Its shockwave along the floor.
    const fy = q.y + FEET - 1, W = 6 + u * 30;
    g.globalAlpha = 1 - u;
    for (let i = -W; i <= W; i++) if (Math.abs(i) > W - 5) { g.fillStyle = P.hot; g.fillRect(Math.round(q.x + i + ox), Math.round(fy + oy), 1, 1); }
    g.globalAlpha = 1;
  }

  // The shield's slam: a golden ring running out along the floor to its reach, columns of light
  // rising off its edge and a flash where the shield struck.
  drawSlam(g, q, u, ox, oy, t) {
    const P = FXC.gold, R = Math.max(4, q.r * ease(Math.min(1, u * 1.3))), fy = q.y - 1;
    for (let i = 0; i < Math.ceil(R * 4); i++) {
      const an = (i / Math.ceil(R * 4)) * Math.PI * 2, x = q.x + Math.cos(an) * R, y = fy + Math.sin(an) * R * 0.16;
      const front = Math.sin(an) > 0;
      g.globalAlpha = (1 - u) * (front ? 1 : 0.6);
      g.fillStyle = front ? P.hot : P.mid;
      g.fillRect(Math.round(x + ox), Math.round(y + oy), 1, front ? 2 : 1);
    }
    // A second, inner ring a beat behind.
    const R2 = R * 0.6;
    g.globalAlpha = (1 - u) * 0.6;
    for (let i = 0; i < Math.ceil(R2 * 3); i++) { const an = (i / Math.ceil(R2 * 3)) * Math.PI * 2; g.fillStyle = P.mid; g.fillRect(Math.round(q.x + Math.cos(an) * R2 + ox), Math.round(fy + Math.sin(an) * R2 * 0.16 + oy), 1, 1); }
    // Columns of light at its edges.
    const H = 22 * (1 - u);
    for (const sd of [-1, 1]) for (let j = 0; j < H; j++) {
      g.globalAlpha = (1 - j / H) * (1 - u);
      g.fillStyle = j < H * 0.3 ? P.core : P.hot;
      g.fillRect(Math.round(q.x + sd * R + ox), Math.round(fy - j + oy), 1, 1);
    }
    g.globalAlpha = 1;
    if (u < 0.3) { glint(g, P, q.x, fy - 3, Math.round(9 * (1 - u / 0.3)) + 2, ox, oy); disc(g, q.x, fy - 2, 6 * (1 - u / 0.3), [P.core, P.hot, P.mid], ox, oy, t); }
  }

  // The decree: a burst of golden light round the King, rays flung out from him and a pillar of
  // light falling on him from above.
  drawDecree(g, q, u, ox, oy, t) {
    const P = FXC.gold;
    // The pillar.
    const pw = Math.round(8 * (1 - u)), py0 = -oy - 4;
    if (pw > 0) for (let y = py0; y < q.y + 12; y += 1) {
      g.globalAlpha = (1 - u) * 0.35 * (0.5 + 0.5 * ((y - py0) / (q.y + 12 - py0)));
      g.fillStyle = P.hot;
      g.fillRect(Math.round(q.x - pw / 2 + ox), Math.round(y + oy), pw, 1);
    }
    g.globalAlpha = 1;
    // Rays flung out.
    for (let i = 0; i < 16; i++) {
      const an = (i / 16) * Math.PI * 2 + q.seed, r0 = 10 + u * 30, len = (i % 2 ? 10 : 18) * (1 - u);
      for (let d = 0; d < len; d++) {
        g.globalAlpha = 1 - u;
        g.fillStyle = d < 3 ? P.core : d < len * 0.6 ? P.hot : P.mid;
        g.fillRect(Math.round(q.x + Math.cos(an) * (r0 + d) + ox), Math.round(q.y + Math.sin(an) * (r0 + d) * 0.85 + oy), 1, 1);
      }
    }
    g.globalAlpha = 1;
    // The ring.
    const R = 6 + ease(u) * 46;
    g.globalAlpha = 1 - u;
    for (let i = 0; i < 80; i++) { const an = (i / 80) * Math.PI * 2; g.fillStyle = i % 2 ? P.hot : P.core; g.fillRect(Math.round(q.x + Math.cos(an) * R + ox), Math.round(q.y + Math.sin(an) * R * 0.85 + oy), 1, 1); }
    g.globalAlpha = 1;
    if (u < 0.25) glint(g, P, q.x, q.y - 14, Math.round(10 * (1 - u * 4)) + 2, ox, oy);
  }

  // The finale: a huge golden crescent brought down through them, a burst and a gold seam split
  // across the floor.
  drawRoyal(g, q, u, ox, oy, t) {
    const P = FXC.gold, f = q.f || 1;
    const a0 = (f > 0 ? -120 : 300) * DEG, a1 = (f > 0 ? 75 : 105) * DEG;
    crescent(g, P, q.x - f * 6, q.y - 2, 30, a0, a1, 7, Math.min(1, u * 1.2), ox, oy);
    crescent(g, { ...P, core: P.hot, hot: P.mid, mid: P.deep }, q.x - f * 6, q.y - 2, 22, a0, a1, 3, Math.min(1, u * 1.4 + 0.05), ox, oy);
    if (u < 0.35) {
      const r = Math.round(14 * (1 - u / 0.35)) + 3;
      glint(g, P, q.x, q.y, r, ox, oy);
      disc(g, q.x, q.y, 6 * (1 - u / 0.35) + 1, [P.core, P.hot, P.mid], ox, oy, t);
    }
    const fy = q.y + FEET - 1, W = 4 + ease(u) * 46;
    g.globalAlpha = 1 - u;
    for (let i = -W; i <= W; i++) { g.fillStyle = Math.abs(i) < W * 0.5 ? P.core : P.hot; g.fillRect(Math.round(q.x + i + ox), Math.round(fy + oy), 1, 1); if (Math.abs(i) % 9 === 3 && u < 0.6) g.fillRect(Math.round(q.x + i + ox), Math.round(fy - 1 - ((i * 7) & 3) + oy), 1, 2); }
    g.globalAlpha = 1;
  }

  lights(add) {
    for (const q of this.fx) {
      const u = q.t / q.life;
      if (q.k === 'bolt') add({ x: q.x, y: q.y, r: 80, color: '#d8b8ff', i: 1.7 * (1 - u) });
      else if (q.k === 'meteor') add({ x: q.x, y: q.y, r: 90, color: '#ff9a40', i: 1.6 * (1 - u) });
      else if (q.k === 'slam') add({ x: q.x, y: q.y - 6, r: 40 + q.r * 0.6 * u, color: '#ffd860', i: 1.2 * (1 - u) });
      else if (q.k === 'royal') add({ x: q.x, y: q.y, r: 110, color: '#ffe080', i: 1.8 * (1 - u) });
      else if (q.k === 'decree') add({ x: q.x, y: q.y, r: 100, color: '#ffd860', i: 1.4 * (1 - u) });
      else if (q.k === 'star' && q.big) add({ x: q.x, y: q.y, r: 40, color: '#ffe2a0', i: 0.8 * (1 - u) });
    }
  }
}

// The glowing bits of one familiar drawn at (x, y) facing f at scale: the mage's crystal (charging,
// the fireball he conjures, the sigil of his storm), the assassin's eyes, blades flashing through
// their swing with the smear they leave, the bow's arrow tip, the shield's crest catching the light.
function glowBits(g, k, s, q, x, y, f, scale, t) {
  const cue = q.cue, K = KIT[k];
  const P = (name) => { const p = s.pts?.[name]; return p ? [x + (f >= 0 ? p[0] + 0.5 : -p[0] - 0.5) * scale, y + (p[1] + 0.5) * scale] : null; };
  const dot = (c, px, py, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(px - (scale - 1) / 2), Math.round(py - (scale - 1) / 2), w * scale, h * scale); };
  if (cue.arc) {
    const A = cue.arc, cx = x + A.c[0] * f * scale, cy = y + A.c[1] * scale;
    const a0 = (f > 0 ? A.a0 : 180 - A.a0) * DEG, a1 = (f > 0 ? A.a1 : 180 - A.a1) * DEG;
    crescent(g, A.gold ? FXC.gold : KIND_FX[k], cx, cy, A.r, a0, a1, A.thin ? 2 : 3, Math.min(1, A.u * 0.9 + 0.1), 0, 0, scale);
  }
  if (k === 'mage') {
    const gem = P('gem');
    if (gem) {
      const ch = cue.charge || 0, pulse = 0.5 + 0.5 * Math.sin(t * 4);
      g.globalAlpha = 0.5 + 0.5 * Math.max(ch, pulse * 0.6);
      dot(FXC.magic.mid, gem[0] - scale, gem[1]); dot(FXC.magic.mid, gem[0] + scale, gem[1]); dot(FXC.magic.mid, gem[0], gem[1] - scale); dot(FXC.magic.mid, gem[0], gem[1] + scale);
      g.globalAlpha = 1;
      dot(ch > 0.5 || cue.flash ? '#ffffff' : FXC.magic.hot, gem[0], gem[1]);
      // Sparks spiralling into the crystal as he charges.
      if (ch > 0) for (let i = 0; i < 5; i++) {
        const v = ((t * 2.2 + i / 5) % 1), an = i * 1.3 + t * 6, r = (1 - v) * 9 * scale;
        g.globalAlpha = v;
        dot(i % 2 ? FXC.magic.hot : FXC.gold.hot, gem[0] + Math.cos(an) * r, gem[1] + Math.sin(an) * r);
      }
      g.globalAlpha = 1;
      if (cue.flash) glint(g, FXC.magic, gem[0], gem[1], Math.round((3 + 4 * cue.flash) * scale), 0, 0);
      // The fireball he conjures over the staff for the meteor.
      if (cue.fire) disc(g, gem[0] - f * scale, gem[1] - 4 * scale, (1 + cue.fire * 2.5) * scale, [FXC.fire.core, FXC.fire.hot, FXC.fire.mid, FXC.fire.deep], 0, 0, t);
    }
    // The sigil of the storm: a ring of runes turning over his head.
    if (cue.sigil !== undefined) {
      const hat = P('hat') || [x, y - 20 * scale], cx = x + f * scale, cy = Math.min(hat[1], y - 20 * scale) - 4 * scale, R = (cue.hero ? 9 : 8) * scale;
      for (let i = 0; i < 36; i++) {
        const an = (i / 36) * Math.PI * 2 + t * 1.6;
        g.globalAlpha = i % 3 ? 0.9 : 0.5;
        dot(i % 6 === 0 ? FXC.gold.hot : FXC.magic.mid, cx + Math.cos(an) * R, cy + Math.sin(an) * R * 0.35);
      }
      for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2 - t * 2.4; dot(FXC.magic.hot, cx + Math.cos(an) * R * 0.55, cy + Math.sin(an) * R * 0.55 * 0.35); }
      g.globalAlpha = 1;
    }
  }
  if (k === 'assassin' && q.o.eye !== 'blink') {
    const e = P('eye'), e2 = P('eyeF');
    g.globalAlpha = 1 - (cue.fade || 0);
    if (e) { dot(K.glow, e[0], e[1]); dot(K.glow, e[0], e[1] + scale); }
    if (e2) dot(K.glow, e2[0], e2[1] + scale);
    g.globalAlpha = 1;
  }
  if (k === 'soldier') {
    const tip = P('tip');
    if (cue.gold && tip) {
      // The blade burning gold for the finale (not where his head hides it).
      const h = P('hand'), hd = P('head');
      if (h) {
        const n = Math.ceil(Math.hypot(tip[0] - h[0], tip[1] - h[1]) / scale);
        g.globalAlpha = Math.min(1, cue.gold);
        for (let i = 2; i <= n; i++) {
          const px = h[0] + ((tip[0] - h[0]) * i) / n, py = h[1] + ((tip[1] - h[1]) * i) / n;
          if (hd && Math.abs(px - hd[0]) < 4.5 * scale && py - hd[1] > -7 * scale && py - hd[1] < 3.5 * scale) continue;
          dot(i > n - 2 ? '#ffffff' : FXC.gold.hot, px, py);
        }
        g.globalAlpha = 1;
      }
      glint(g, FXC.gold, tip[0], tip[1], Math.round((2 + Math.sin(t * 20) + cue.gold) * scale), 0, 0);
    } else if (tip && (cue.glint || cue.arc || cue.thrust)) glint(g, FXC.steel, tip[0], tip[1], Math.round((cue.glint ? 2 + Math.max(0, Math.sin(t * 3)) * 2 : 2) * scale), 0, 0);
  }
  if (k === 'archer') {
    const ar = P('arrow');
    if (ar && cue.nock) dot('#ffffff', ar[0], ar[1]);
    if (cue.twang) { const b = P('bow'); if (b) { g.globalAlpha = cue.twang; dot(FXC.leaf.hot, b[0] - f * scale, b[1] - 2 * scale, 1, 4); g.globalAlpha = 1; } }
  }
  if (k === 'shield') {
    const c = P('shield');
    if (c) {
      const sweep = (t * 0.45) % 1;
      if (cue.flash || cue.gold) glint(g, FXC.gold, c[0], c[1], Math.round((2 + 4 * Math.max(cue.flash || 0, (cue.gold || 0) * 0.6)) * scale), 0, 0);
      else if (sweep < 0.12) dot('#fff6c8', c[0], c[1] - scale);
    }
  }
}

// ---- lights ----------------------------------------------------------------------------------
// Light descriptors (view px, without the shake): the mage's crystal (brighter as he casts), the
// King's golden aura through the decree, magic bolts, and the event effects (lightning, meteors,
// the slam, the royal arc, the decree's burst).
export function courtLights(state, t) {
  const out = [];
  for (const a of state?.actors || []) {
    if (!a.court || a.dead) continue;
    if (a.act === 'decree') out.push({ x: a.x * S, y: (a.y + 4) * S, r: 70 + Math.sin(t * 6) * 6, color: '#ffd860', i: 0.9 });
    const m = a.court.find(F => F.k === 'mage');
    if (m && m.st !== 'gone') {
      const casting = m.st === 'act';
      out.push({ x: (m.x + (m.f || 1) * 6) * S, y: (m.y - 26) * S, r: casting ? 34 : 16, color: '#c070ff', i: casting ? 1.0 : 0.45, noRim: !casting });
    }
  }
  for (const b of state?.bullets || []) if (b.kind === 'magic') out.push({ x: b.x * S, y: b.y * S, r: 18, color: '#c88aff', i: 0.7, noRim: true });
  LIVE?.lights(l => out.push(l));
  return out;
}

// ---- select screen ---------------------------------------------------------------------------
function heroFigure(k, { f = 1, pose = 'idle', t = 0, p = 0, idx = KINDS.indexOf(k) } = {}) {
  const loco = pose === 'idle' || pose === 'walk' || pose === 'run' || pose === 'jump' || pose === 'fall';
  const isHero = pose.startsWith('hero');
  const A = !loco && !isHero ? actInfo(k, pose) : null;
  const F = { k, f, vx: pose === 'run' ? 1.2 : pose === 'walk' ? 0.4 : 0, air: pose === 'jump' || pose === 'fall', st: loco ? 'follow' : isHero ? 'hero' : 'act', act: pose, t: A ? p * A.dur : 0 };
  const mem = { vy: pose === 'jump' ? -1 : 1, ph: t * (pose === 'run' ? 13 : 7) };
  const q = poseFor(k, F, t, idx, mem);
  return { q, s: familiarSprite(k, q.o) };
}
// One familiar with its feet at canvas pixel (x, y). pose: 'idle', 'walk', 'run', 'jump', 'fall',
// an action of COURT_ACTS[k] (p: 0..1 through it) or its hero pose (HERO_POSE[k]). Returns the sprite.
export function drawFamiliar(g, k, x, y, opts = {}) {
  if (!BUILD[k]) return null;
  const { f = 1, scale = 1 } = opts, { q, s } = heroFigure(k, opts);
  if (s) blit(g, s, x, y + q.dy * scale, f, scale);
  return s;
}
// Its glowing bits, drawn after it (on the same canvas on the select screen).
export function drawFamiliarGlow(g, k, x, y, opts = {}) {
  if (!BUILD[k]) return;
  const { f = 1, scale = 1, t = 0 } = opts, { q, s } = heroFigure(k, opts);
  if (s) glowBits(g, k, s, q, x, y + q.dy * scale, f, scale, t + KINDS.indexOf(k) * 0.37);
}
