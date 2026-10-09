// The Cat King's regalia, drawn with Mingau's sprite (fighter type 0): the royal cape behind him
// (red velvet with an ermine collar and a gold hem, flowing with his motion, lifting as he falls and
// swinging across when he turns), the gold crown on his head and the scepter in his hand. He never
// strikes: the scepter conducts his court. Every order is its own gesture (a sweep for the soldier's
// cut, a thrust for the shield's bash, a point at the sky for the lightning, a point at the floor for
// the mercy...) with a glint at the orb on the beat the order is given; through the ATAQUE REAL it is
// held high, burning gold.
//
//   drawRegalia(g, f, ox, oy, t, layer)  f: the renderer's figure record ({ a, hx, hy, info, fc, x, y }).
//     'back'  the cape. Draw it before his sprite; with f.fc.alpha (and f.x, f.y) it also stays behind
//             him when drawn after it.
//     'front' the crown, the ermine collar and the scepter, after his sprite.
//     'glow'  emissive bits for the glow layer: the orb's glint, the jewels, the order's spark, and all
//             of the scepter while he decrees.
//   regaliaLights(f, t)  light descriptors { x, y, r, color, i } in view px (no shake).
//
// Everything is placed from f.info (the eye recovers where his sprite was painted, hit shivers
// included) in character space, so it follows any frame: head tilts, body offsets, quarter-turn
// tumbles. KingHero (king-hero.js) draws the same pieces at the menu's density via drawKingRegalia.
import { slotPoint, castFor, rotate, mirror } from './pixel-data.js';
import { MOVES } from '../sim/moves.js';
import { bayer } from '../engine/const.js';
import { mix } from '../engine/palette.js';

const EYE = [2, -6], HAND = [0, 3];
// Head cells (from the head's pivot, its bottom middle) under the middle of the crown's lowest row:
// between the ears, on the crown of the skull.
const CROWN_AT = [-1, -10];
const REST = 40;

// Light from the top left. Golds, two jewels, pearls; the cape's velvet ramp (0 darkest .. 4 lit),
// ermine (white, shade, black tails) and the gold trim.
const BASE = {
  o: '#1c0a14', Y: '#fff7c8', G: '#f8c84a', g: '#cc8a2a', d: '#86501e',
  R: '#ff3c5e', r: '#a6163a', B: '#6cc8ff', b: '#2c5cd4', W: '#ffffff',
  0: '#2c0614', 1: '#5c0c22', 2: '#941a30', 3: '#c42e3e', 4: '#ea5e56',
  E: '#fffaf0', e: '#d4cae2', k: '#1e1428'
};
const pals = new Map();
function palette(v) {
  let p = pals.get(v);
  if (p) return p;
  p = { ...BASE };
  if (v === 'flash') for (const k in p) { if (k !== 'o') p[k] = mix(p[k], '#ffffff', 0.7); }
  else if (v === 'glow') Object.assign(p, { o: '#6a3008', Y: '#ffffff', G: '#fff2a8', g: '#ffd45a', d: '#f0a032', R: '#ffe0b0', r: '#ff9a40', W: '#ffffff' });
  else if (v === 'ice') for (const k in p) p[k] = k === 'o' ? '#24486a' : mix(p[k], '#a8e4ff', 0.55);
  pals.set(v, p);
  return p;
}

// Fill-only matrices (outlined when cached). The crown hangs from its band's middle; the scepter
// points up from the grip.
const CROWN = [
  'W..W..W',
  'G.GYG.g',
  'GYGGGgg',
  'gRgBgRd',
  'ddddddd'
];
const CROWN_PIV = [3, 4];
const SCEPTER = [
  '..W..',
  '.YGg.',
  '..g..',
  '.YRr.',
  'YWRRd',
  '.Rrr.',
  '.dGd.',
  '..G..',
  '..g..',
  '..G..',
  '..g..',
  '..G..',
  '..g..',
  '..Y..'
];
const SCEPTER_PIV = [2, 12];
// Along the scepter from its grip (cells, up): the orb's middle and the cross's tip.
const ORB = 8, TIP = 12;

const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sprites = new Map();
// A matrix rotated (RotSprite, clockwise, snapped to 11.25 degrees), mirrored for the facing and
// outlined; px, py: the pivot's cell in the canvas.
function sprite(name, m, piv, deg, face, v) {
  deg = ((Math.round(deg / 11.25) * 11.25) % 360 + 360) % 360;
  const key = name + '|' + deg + '|' + face + '|' + v;
  let s = sprites.get(key);
  if (s) return s;
  let { m: r, piv: p } = deg ? rotate(m, piv, deg) : { m, piv };
  if (face < 0) { r = mirror(r); p = [r[0].length - 1 - p[0], p[1]]; }
  const h = r.length + 2, w = r[0].length + 2, grid = Array.from({ length: h }, () => new Array(w).fill('.'));
  for (let y = 0; y < r.length; y++) for (let x = 0; x < r[0].length; x++) if (r[y][x] !== '.') grid[y + 1][x + 1] = r[y][x];
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && grid[y][x] !== '.' && grid[y][x] !== '@';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grid[y][x] === '.' && (filled(x, y - 1) || filled(x, y + 1) || filled(x - 1, y) || filled(x + 1, y))) grid[y][x] = '@';
  }
  const c = mkCanvas(w, h), g = c.getContext('2d'), P = palette(v);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = grid[y][x];
    if (ch === '.') continue;
    g.fillStyle = ch === '@' ? P.o : P[ch] || '#ff00ff';
    g.fillRect(x, y, 1, 1);
  }
  s = { c, px: p[0] + 1, py: p[1] + 1, w, h };
  if (sprites.size > 400) sprites.delete(sprites.keys().next().value);
  sprites.set(key, s);
  return s;
}

// ---- where he is: character space (facing right, feet at 0, y down) to canvas pixels
// T: { bx, by, face, q, sc, ox, oy }. q: the frame's quarter turns (tumbling), about (0, -7) like
// composeChars.
function spin(T, x, y) {
  for (let i = 0; i < T.q; i++) { const nx = -(y + 7); y = x - 7; x = nx; }
  return [x, y];
}
function toView(T, x, y) {
  const [X, Y] = spin(T, x, y);
  return [T.ox + T.bx + X * T.face * T.sc, T.oy + T.by + Y * T.sc];
}
const cell = (T, x, y) => { const [X, Y] = toView(T, x, y); return [Math.round(X), Math.round(Y)]; };

function basis(f, ox, oy) {
  const a = f.a, frame = f.info?.frame || {}, ch = castFor(a.type, a.form), face = a.face || 1;
  const eu = ch?.eye || EYE, [ex, ey] = slotPoint('head', frame, eu[0], eu[1], ch);
  const q = (((frame.spin || 0) % 4) + 4) % 4;
  const eye = f.info?.eye || { x: f.hx + ex * face, y: f.hy + ey };
  return { a, frame, ch, T: { bx: eye.x - ex * face, by: eye.y - ey, face, q, sc: 1, ox, oy } };
}

// ---- per-fighter motion: the cape's sweep and lift on springs, the scepter's angle
const motion = new Map();
function stateOf(a, t) {
  let st = motion.get(a.id);
  if (!st || t < st.t - 0.5 || t > st.t + 5) {
    st = { t, W: 2 * (a.face || 1), vW: 0, L: 0, vL: 0, ang: REST, kind: null, p: 0, from: REST, lastHx: null, lastHy: null, vx: 0, vy: 0 };
    if (motion.size > 24) motion.clear();
    motion.set(a.id, st);
  }
  return st;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = u => 1 - (1 - u) * (1 - u) * (1 - u);

// The scepter through each order: [p, degrees from up (clockwise, facing right), thrust px]. The
// third key is the beat the order is given (a glint at the orb, a smear along the swing).
const ORDERS = {
  kSlash: [[0, 34], [0.28, -50], [0.5, 105, 1], [1, 95]],       // a sweep, like the soldier's cut
  kStab: [[0, 34], [0.3, 10], [0.48, 90, 2], [1, 85]],          // a quick point at them
  kVolley: [[0, 34], [0.3, 20], [0.5, 68, 1], [1, 62]],         // "loose!"
  kZap: [[0, 34], [0.3, 75], [0.5, 8, 2], [1, 12]],             // up at the sky they are under
  kBash: [[0, 34], [0.3, 62, -2], [0.5, 90, 3], [1, 88, 1]],    // a thrust
  kAirSlash: [[0, 20], [0.28, -40], [0.5, 118, 1], [1, 112]],
  kAirShot: [[0, 20], [0.3, 30], [0.5, 120, 2], [1, 115, 1]],
  kAirMeteor: [[0, 20], [0.35, -25], [0.56, 150, 1], [1, 146]], // raised, then brought down
  kRain: [[0, 34], [0.35, -2, 2], [0.6, 10, 2], [0.8, -4, 2], [1, 4, 2]], // the sky, waved
  kRise: [[0, 34], [0.28, 140], [0.52, 6, 2], [1, 12]],         // a rising sweep
  kMercy: [[0, 34], [0.35, -10], [0.58, 152, 1], [1, 148]],     // down at the fallen
  kCharge: [[0, 34], [0.3, -30], [0.52, 82, 3], [1, 80, 2]],    // "charge!"
  kShadow: [[0, 34], [0.25, 22], [0.45, 100, 1], [1, 96]],
  kDrop: [[0, 34], [0.4, -12], [0.6, 165, 1], [1, 160]]
};
const BEAT = k => ORDERS[k][2][0];
function orderAt(kind, p, from) {
  const K = ORDERS[kind];
  for (let i = 1; i < K.length; i++) {
    if (p > K[i][0] && i < K.length - 1) continue;
    const a = K[i - 1], b = K[i], u = ease(clamp((p - a[0]) / (b[0] - a[0] || 1), 0, 1));
    const a1 = i === 1 ? from : a[1];
    return { ang: a1 + (b[1] - a1) * u, reach: (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * u };
  }
  return { ang: K[K.length - 1][1], reach: K[K.length - 1][2] || 0 };
}
const isOrder = a => a.attack > 0 && ORDERS[a.attackKind];
const orderP = a => clamp(1 - a.attack / (MOVES[a.attackKind]?.dur || 0.3), 0, 1);
const decreeOf = a => (a.act === 'decree' ? a.actT ?? 0 : -1);

// Frames every fighter shares: in these the arm is not aiming the scepter anywhere.
const GENERIC = /^(idle|run|jump|fall|crouch|land|skid|hurt|dizzy|tumble|glide|carry|climb|throw|stomp|parry|airdash|roll)/;

// Steps the springs once per sim time and returns this frame's pose of the regalia.
function pose(a, f, t, st) {
  const dt = clamp(t - st.t, 0, 0.1);
  st.t = t;
  const face = a.face || 1;
  // His speed in view px per step: the actor's when it has one, else from where he was drawn.
  if (st.lastHx != null && dt > 0) { st.vx += ((f.hx - st.lastHx) / (dt * 60) - st.vx) * 0.5; st.vy += ((f.hy - st.lastHy) / (dt * 60) - st.vy) * 0.5; }
  st.lastHx = f.hx; st.lastHy = f.hy;
  const vx = Number.isFinite(a.vx) ? a.vx * (2 / 3) : st.vx, vy = Number.isFinite(a.vy) ? a.vy * (2 / 3) : st.vy;
  const dec = decreeOf(a), hurt = a.hitstun > 0;
  // The cape: swept back by his speed (in world terms, so it swings across when he turns), lifted
  // when he falls or dashes, billowing in the decree's wind.
  let W = 2 + clamp(vx * face * 1.6, -6, 9), L = clamp((a.ground === false ? vy * 1.3 : 0) + Math.abs(vx) * 0.5, -3, 6);
  if (dec >= 0) { W = 6 + Math.sin(t * 9) * 1.5; L = 3.5 + Math.sin(t * 7) * 1.5; }
  if (hurt) W += 3;
  for (let k = 0, n = Math.max(1, Math.ceil(dt / (1 / 120))); k < n; k++) {
    const h = dt / n;
    st.vW += ((W * face - st.W) * 160 - st.vW * 11) * h; st.W += st.vW * h;
    st.vL += ((L - st.L) * 120 - st.vL * 10) * h; st.L += st.vL * h;
  }
  // The scepter. When his frame lifts the arm (the order and decree poses) it points along the arm;
  // with the arm down it is keyed here, and never swings up through his face.
  const frame = f.info?.frame || {}, armDeg = frame.armF?.[2] || 0, armAng = 180 + armDeg;
  const posed = Math.abs(armDeg) >= 70 && !GENERIC.test(f.info?.name || '');
  const clear = v => (posed || v < -90 || v >= 26 ? [v, 0] : [26, (26 - Math.max(v, -40)) / 30]);
  let ang = REST, reach = 0, beat = 0, glow = 0;
  const name = f.info?.name || '';
  if (dec >= 0) {
    if (st.kind !== 'decree') { st.kind = 'decree'; st.from = st.ang; }
    const up = ease(clamp(dec / 0.2, 0, 1)), down = clamp((dec - 2.4) / 0.2, 0, 1);
    const [high, extra] = clear(posed ? armAng : 0);
    ang = st.from + (high - st.from) * up + (REST - high) * down; reach = (2 + extra) * up * (1 - down);
    glow = Math.min(up, 1 - down);
    beat = dec < 0.45 ? clamp(1 - Math.abs(dec - 0.2) / 0.25, 0, 1) : 0.35 + 0.25 * Math.sin(t * 8);
  } else if (isOrder(a)) {
    const p = orderP(a);
    if (st.kind !== a.attackKind || p < st.p) { st.kind = a.attackKind; st.from = st.ang; }
    st.p = p;
    const o = orderAt(a.attackKind, p, st.from), b = BEAT(a.attackKind);
    const [v, extra] = clear(posed ? armAng : o.ang);
    ang = v; reach = o.reach + extra;
    beat = clamp(1 - Math.abs(p - b) / 0.16, 0, 1);
  } else {
    st.kind = null;
    let v = REST;
    if (hurt) v = -40 + Math.sin(t * 30) * 8;
    else if (a.ground === false) v = posed ? clamp(armAng, 10, 80) : 20;
    else if (/^run/.test(name) || Math.abs(vx) > 1.2) v = 58 + (name === 'run1' ? 6 : name === 'run2' ? -6 : 0);
    else if (name === 'crouch' || name === 'land') v = 62;
    v += Math.sin(t * 2.1) * 3;
    st.ang += (v - st.ang) * Math.min(1, dt * 18);
    ang = st.ang;
  }
  if (dec >= 0 || isOrder(a)) st.ang = ang;
  // The swing over the last few frames, for the smear.
  const hist = (st.hist ||= []);
  if (dt > 0) { hist.push([t, ang]); while (hist.length > 8) hist.shift(); }
  let smear = null;
  if (dec >= 0 || isOrder(a)) for (const [ht, ha] of hist) if (t - ht <= 0.09 && Math.abs(ha - ang) >= 20) { smear = { from: ha, to: ang }; break; }
  return { W: st.W * face, L: st.L, ang, reach, beat, smear, glow, hurt };
}

// ---- the cape: a sheet hung from the collar, filled row by row in character space
const CW = 40, CH = 34, CX = 30, CY = 28; // grid: x in [-30, 9], y in [-28, 5]
const grid = new Uint8Array(CW * CH);
const CODES = ['.', 'o', '0', '1', '2', '3', '4', 'Y', 'G', 'g', 'd', 'E', 'e', 'k'];
const C = Object.fromEntries(CODES.map((c, i) => [c, i]));

function capePolygon(frame, P, t) {
  const [bdx = 0, bdy = 0] = frame.body || [];
  const rx = bdx, ry = -11 + bdy, W = P.W, L = P.L;
  const amp = 0.35 + Math.min(1.4, Math.abs(W - 2) * 0.12 + Math.abs(L) * 0.12);
  const Rf = [rx, ry], Rb = [rx - 5, ry - 0.5];
  const hb = Math.max(Math.min(W, 12), -4), wob = Math.sin(t * 4.3) * amp * 0.6;
  // The trailing edge: over the shoulders, out behind his back, down to the hem (a cubic curve).
  const Hb = [rx - 11 - hb, ry + 10.5 - L], Hf = [Math.min(rx - 2 - hb * 0.4, Hb[0] + 5 + Math.max(0, 2 - hb)), ry + 10.5 - L * 0.5];
  const C1 = [rx - 9 - hb * 0.2, ry - 0.5 - L * 0.1], C2 = [rx - 11 - hb * 0.6 + wob, ry + 5 - L * 0.5];
  const pts = [Rf, Rb];
  for (let i = 1; i <= 8; i++) {
    const u = i / 8, w = 1 - u, k0 = w * w * w, k1 = 3 * w * w * u, k2 = 3 * w * u * u, k3 = u * u * u;
    pts.push([k0 * Rb[0] + k1 * C1[0] + k2 * C2[0] + k3 * Hb[0], k0 * Rb[1] + k1 * C1[1] + k2 * C2[1] + k3 * Hb[1]]);
  }
  // The hem: a wave runs along it, faster the harder the cape flies.
  const sp = 5 + Math.min(8, Math.abs(W - 2) * 1.2);
  for (let i = 1; i <= 5; i++) {
    const u = i / 6;
    pts.push([Hb[0] + (Hf[0] - Hb[0]) * u, Hb[1] + (Hf[1] - Hb[1]) * u + Math.sin(t * sp + i * 1.9) * amp]);
  }
  pts.push(Hf);
  return { pts, rx, ry };
}

function fillCape(frame, P, t) {
  grid.fill(0);
  const { pts, rx, ry } = capePolygon(frame, P, t);
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  y0 = Math.max(-CY, Math.floor(y0)); y1 = Math.min(CH - CY - 2, Math.ceil(y1));
  const xs = [];
  let any = false;
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j];
      if ((ay > yc) !== (by > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(-CX + 1, Math.round(xs[k])), xb = Math.min(CW - CX - 2, Math.round(xs[k + 1]) - 1);
      for (let x = xa; x <= xb; x++) { grid[(y + CY) * CW + x + CX] = C['2']; any = true; }
    }
  }
  if (!any) return null;
  // Shading: the collar's two rows are ermine, the trailing edge and the hem are trimmed in gold,
  // and the velvet falls in folds fanning out from the collar, lit from the top left.
  const at = (x, y) => grid[(y + CY) * CW + x + CX];
  const fx0 = rx - 1, fy0 = ry - 5, wave = t * 2.2 + P.W * 0.35;
  for (let y = y0; y <= y1; y++) for (let x = -CX + 1; x < CW - CX - 1; x++) {
    const i = (y + CY) * CW + x + CX;
    if (!grid[i]) continue;
    const top = y - ry;
    let c;
    if (top < 2 && x > rx - 9) c = (x * 5 + y * 3 + 64) % 7 === 0 ? C.k : top === 1 && !at(x - 1, y) ? C.e : C.E;
    else if (!at(x, y - 1)) c = C.G;
    else if (!at(x, y + 1)) c = (x + y + 64) % 3 === 0 ? C.Y : C.G;
    else if (!at(x - 1, y)) c = top < 4 ? C.Y : C.G;
    else {
      const ang = Math.atan2(x + 0.5 - fx0, y + 0.5 - fy0), fold = Math.sin(ang * 10 + wave);
      let v = 0.5 + 0.42 * fold - 0.03 * top + (at(x - 2, y) ? 0 : 0.22) - (at(x + 1, y) ? 0 : 0.3);
      v += (bayer(x + 64, y + 64) - 0.5) * 0.22;
      c = v > 0.9 ? C['4'] : v > 0.58 ? C['3'] : v > 0.22 ? C['2'] : v > 0 ? C['1'] : C['0'];
    }
    grid[i] = c;
  }
  // Outline round it.
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = -CX + 1; x < CW - CX - 1; x++) {
    const i = (y + CY) * CW + x + CX;
    if (grid[i] || y + CY < 1 || y + CY >= CH - 1) continue;
    if ((grid[i - 1] > 1) || (grid[i + 1] > 1) || (grid[i - CW] > 1) || (grid[i + CW] > 1)) grid[i] = C.o;
  }
  return { y0: y0 - 1, y1: y1 + 1 };
}

function drawCape(g, T, frame, P, t, v, mask) {
  const box = fillCape(frame, P, t);
  if (!box) return;
  const pal = palette(v), s = T.sc;
  let last = -1;
  for (let y = box.y0; y <= box.y1; y++) for (let x = -CX + 1; x < CW - CX - 1; x++) {
    const c = grid[(y + CY) * CW + x + CX];
    if (!c) continue;
    const [X, Y] = spin(T, x, y);
    if (mask && mask(X, Y)) continue;
    const vx = Math.round(T.ox + T.bx + X * T.face * s), vy = Math.round(T.oy + T.by + Y * s);
    if (c !== last) { g.fillStyle = pal[CODES[c]]; last = c; }
    g.fillRect(vx, vy, s, s);
  }
}

// ---- the crown, the collar, the scepter
function drawCrown(g, T, frame, ch, v, lift = 0, tilt = 0) {
  const [cx, cy] = slotPoint('head', frame, CROWN_AT[0], CROWN_AT[1] - lift, ch);
  const s = sprite('crown', CROWN, CROWN_PIV, (frame.head?.[2] || 0) + tilt + T.q * 90, T.face, v);
  const [X, Y] = cell(T, cx, cy);
  g.drawImage(s.c, X - s.px * T.sc, Y - s.py * T.sc, s.w * T.sc, s.h * T.sc);
}

// The ermine collar shows round the front of his neck, under the chin.
function drawCollar(g, T, frame, v) {
  const [bdx = 0, bdy = 0] = frame.body || [], P = palette(v), s = T.sc;
  const cells = [[-3, -9, 'E'], [-2, -9, 'k'], [-1, -9, 'E'], [0, -9, 'E'], [1, -9, 'e'], [-4, -9, 'o'], [2, -9, 'o'], [-3, -8, 'o'], [-2, -8, 'o'], [-1, -8, 'o'], [0, -8, 'o'], [1, -8, 'o']];
  for (const [x, y, c] of cells) { const [X, Y] = cell(T, x + bdx, y + bdy); g.fillStyle = P[c]; g.fillRect(X, Y, s, s); }
}

function scepterAt(T, frame, ch, P) {
  const [hx, hy] = slotPoint('armF', frame, HAND[0], HAND[1], ch);
  const r = (P.ang * Math.PI) / 180, dx = Math.sin(r), dy = -Math.cos(r);
  // Thrust out along itself.
  const gx = hx + dx * P.reach, gy = hy + dy * P.reach;
  return { gx, gy, dx, dy, deg: P.ang + T.q * 90 };
}

function drawScepter(g, T, frame, ch, P, v, paw = true) {
  const S = scepterAt(T, frame, ch, P), s = sprite('scepter', SCEPTER, SCEPTER_PIV, S.deg, T.face, v);
  const [X, Y] = cell(T, S.gx, S.gy);
  g.drawImage(s.c, X - s.px * T.sc, Y - s.py * T.sc, s.w * T.sc, s.h * T.sc);
  // His paw closed round the grip.
  if (paw) {
    const [hx, hy] = slotPoint('armF', frame, HAND[0], HAND[1], ch), pal = castPal(ch);
    const [px, py] = cell(T, hx, hy), [qx, qy] = cell(T, hx - 1, hy - 1 + 0.01);
    g.fillStyle = pal[4] || '#fff3dc'; g.fillRect(qx, qy, T.sc, T.sc);
    g.fillStyle = pal[5] || '#f0cc9c'; g.fillRect(px, py, T.sc, T.sc);
  }
}
const castPal = ch => ch?.palette || {};

// A four-point star.
function star(g, x, y, r, s, c1, c2) {
  g.fillStyle = c2;
  for (let i = 1; i <= r; i++) { g.fillRect(x + i * s, y, s, s); g.fillRect(x - i * s, y, s, s); g.fillRect(x, y + i * s, s, s); g.fillRect(x, y - i * s, s, s); }
  if (r > 2) { g.fillRect(x + s, y + s, s, s); g.fillRect(x - s, y - s, s, s); g.fillRect(x + s, y - s, s, s); g.fillRect(x - s, y + s, s, s); }
  g.fillStyle = c1; g.fillRect(x, y, s, s);
}

function orbPoint(T, frame, ch, P) {
  const S = scepterAt(T, frame, ch, P);
  return toView(T, S.gx + S.dx * ORB, S.gy + S.dy * ORB);
}
function tipPoint(T, frame, ch, P) {
  const S = scepterAt(T, frame, ch, P);
  return toView(T, S.gx + S.dx * (TIP + 1), S.gy + S.dy * (TIP + 1));
}

// The scepter's swing: a fan of gold at the orb's radius from where it was to where it is.
function drawSmear(g, T, frame, ch, P, alpha = 1) {
  if (!P.smear) return;
  const [hx, hy] = slotPoint('armF', frame, HAND[0], HAND[1], ch);
  const a0 = P.smear.from, a1 = P.smear.to, span = Math.abs(a1 - a0);
  if (span < 20) return;
  const n = Math.ceil(span / 6), s = T.sc;
  for (let i = 0; i <= n; i++) {
    const u = i / n, d = ((a0 + (a1 - a0) * u) * Math.PI) / 180;
    g.globalAlpha = alpha * (0.15 + 0.75 * u * u);
    for (let r = ORB - 1; r <= TIP + 1 + P.reach; r += 1) {
      const [X, Y] = cell(T, hx + Math.sin(d) * r, hy - Math.cos(d) * r);
      g.fillStyle = r > TIP - 1 ? '#fff4c0' : '#ffc84a';
      g.fillRect(X, Y, s, s);
    }
  }
  g.globalAlpha = 1;
}

function variantOf(a) {
  if (a.frozen > 0) return 'ice';
  if (a.hurt > 0.135) return 'flash';
  return '';
}

// Draws the regalia on any canvas: T maps character space to it (see basis()); used by the game
// (drawRegalia) and the select screen (king-hero.js) alike.
export function drawKingRegalia(g, T, a, frame, P, t, layer, { mask = null, ch = castFor(a.type, a.form), v = variantOf(a) } = {}) {
  const severed = a.severed || [];
  if (severed.includes('body')) return;
  if (layer === 'back') { drawCape(g, T, frame, P, t, v, mask); return; }
  const hasHead = !severed.includes('head'), hasArm = !severed.includes('armF');
  if (layer === 'front') {
    drawCollar(g, T, frame, v);
    if (hasHead) drawCrown(g, T, frame, ch, v, P.hurt ? 1 : 0, P.hurt ? -11.25 : 0);
    if (hasArm) {
      drawSmear(g, T, frame, ch, P, 0.55);
      drawScepter(g, T, frame, ch, P, P.glow > 0.5 ? 'glow' : v);
    }
    return;
  }
  if (layer === 'glow') {
    const s = T.sc;
    if (hasArm) {
      if (P.glow > 0) {
        g.globalAlpha = P.glow;
        drawScepter(g, T, frame, ch, P, 'glow', false);
        g.globalAlpha = 1;
      }
      drawSmear(g, T, frame, ch, P, 0.8);
      const [ox, oy] = orbPoint(T, frame, ch, P), X = Math.round(ox), Y = Math.round(oy);
      // The ruby glints; on the beat of an order a star flares on it.
      g.fillStyle = '#ffd0d8'; g.fillRect(X - s, Y - s, s, s);
      if (P.beat > 0.05) {
        g.globalAlpha = Math.min(1, P.beat * 1.4);
        star(g, X, Y, 1 + Math.round(P.beat * 3 + P.glow * 2), s, '#ffffff', '#ffe27a');
        g.globalAlpha = 1;
      }
      // Sparks shed off it while he decrees.
      if (P.glow > 0.2) {
        for (let i = 0; i < 7; i++) {
          const ph = (t * (0.9 + (i % 3) * 0.25) + i / 7) % 1, an = i * 2.4 + t * 1.3;
          g.globalAlpha = (1 - ph) * P.glow;
          g.fillStyle = ph < 0.4 ? '#ffffff' : '#ffd860';
          g.fillRect(Math.round(ox + Math.cos(an) * (3 + ph * 9) * s), Math.round(oy + Math.sin(an) * (3 + ph * 9) * s - ph * 4 * s), s, s);
        }
        g.globalAlpha = 1;
      }
    }
    if (hasHead) {
      // The crown's jewels twinkle in turn.
      const [cx, cy] = slotPoint('head', frame, CROWN_AT[0], CROWN_AT[1] - (P.hurt ? 1 : 0), ch);
      const k = Math.floor(t * 1.7) % 5;
      if (k < 3) {
        const [X, Y] = cell(T, cx + (k - 1) * 2 + (k === 1 ? 0 : 0), cy - 1);
        g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 11);
        g.fillStyle = k === 1 ? '#c8ecff' : '#ffd0dc';
        g.fillRect(X, Y, s, s);
        g.globalAlpha = 1;
      }
      if (P.glow > 0.2) {
        const [X, Y] = cell(T, cx, cy - 5);
        g.globalAlpha = 0.8 * P.glow * (0.6 + 0.4 * Math.sin(t * 6));
        star(g, X, Y, 2, s, '#ffffff', '#fff0a0');
        g.globalAlpha = 1;
      }
    }
  }
}

// His body's own pixels, tail left out (with secondary motion the tail is a separate overlay and
// info.sprite is the rest of him): the cape stays behind his body and arms but covers the root of
// his tail, which pokes out from under it. Tested in character space (quarter turns applied), so it
// holds at any scale and facing.
export function bodyMask(s) {
  if (!s?.canvas) return null;
  const A = (s._kingA ||= s.canvas.getContext('2d').getImageData(0, 0, s.w, s.h).data);
  return (X, Y) => { const lx = X - s.x0, ly = Y - s.y0; return lx >= 0 && ly >= 0 && lx < s.w && ly < s.h && A[(ly * s.w + lx) * 4 + 3] > 0; };
}

const poses = new Map();
function poseFor(f, t) {
  const a = f.a, st = stateOf(a, t);
  let P = poses.get(a.id);
  if (!P || P.t !== t) { P = pose(a, f, t, st); P.t = t; poses.set(a.id, P); if (poses.size > 24) poses.clear(); }
  return P;
}

export function drawRegalia(g, f, ox, oy, t, layer = 'front') {
  const a = f?.a;
  if (!a || a.type !== 0 || !f.info) return;
  const { frame, ch, T } = basis(f, ox, oy), P = poseFor(f, t);
  drawKingRegalia(g, T, a, frame, P, t, layer, { mask: layer === 'back' ? bodyMask(f.info.sprite) : null, ch });
}

export function regaliaLights(f, t) {
  const a = f?.a;
  if (!a || a.type !== 0 || !f.info || (a.severed || []).includes('armF')) return [];
  // Lights are gathered before the figures are drawn, on another clock: use the pose last drawn.
  const P = poses.get(a.id);
  if (!P) return [];
  const { frame, ch, T } = basis(f, 0, 0);
  const [x, y] = orbPoint(T, frame, ch, P), out = [{ x, y, r: 9 + P.beat * 10, color: '#ffd27a', i: 0.25 + P.beat * 0.5 }];
  if (P.glow > 0) out.push({ x, y, r: 30 + P.glow * 40 + Math.sin(t * 8) * 4, color: '#ffe08a', i: 0.6 + P.glow * 0.8 });
  return out;
}

// For the select screen: the pose of his regalia for a scripted moment. P fields: W (cape sweep,
// px back), L (lift), ang (scepter, degrees from up), reach, beat (0..1 the orb's star), glow
// (0..1 the scepter burning gold), smear ({ from, to } or null), hurt.
export const REGALIA_REST = REST;
export { star as regaliaStar, tipPoint as scepterTip, orbPoint as scepterOrb };
