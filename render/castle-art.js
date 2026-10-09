// Castle interactables ("Salão do Relógio"): candelabras, suits of armor, the cracked wall, the roast,
// the chest, the gargoyle, the hidden door, the chandelier and its chain, the pendulum blades and the
// loose stone over the pit. Everything is drawn in VIEW pixels: the caller converts world units (x * S)
// and adds the shake offset. Small static pieces are hand-placed pixel maps baked once; the pieces that
// rotate (chandelier, pendulum blade) use the shaded-vector rasterizer of sprites.js, like props-art.js.
import { S, bayer, seeded, clamp } from '../engine/const.js';
import { sprite, material } from './sprites.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => Math.round(v * S);
const fill = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const dot = (g, x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
// A cheap hash for per-object animation offsets.
const hash = n => { let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---- palette for the pixel maps ---------------------------------------------------------------
const PAL = {
  k: '#110d1b', Z: '#07050c',
  // iron / steel: shadows lean violet, highlights lean warm
  1: '#1e1a2b', 2: '#2b2640', 3: '#3e3757', 4: '#5a5276', 5: '#837a9c', 6: '#b4adc8', 7: '#ece8f6',
  // wax
  w: '#f4ecd6', W: '#d8c9a8', v: '#a8957c',
  // gold
  G: '#9a6a2c', g: '#e0a840', y: '#f7d672', Y: '#fff3c0',
  // wood
  a: '#2e1a1e', b: '#5e3830', c: '#87553c', d: '#b07b4f', e: '#d6a46c',
  // red velvet / plume
  r: '#5a1022', R: '#9c2233', s: '#c83a44', S: '#e8676a',
  // stone
  n: '#1d1a28', m: '#2a2637', p: '#3a3449', q: '#4f475e', t: '#6a6078', u: '#8a7f95', x: '#aaa0b8',
  // roast
  M: '#3e1612', N: '#6e2c1c', O: '#a24a28', Q: '#d0763a', T: '#f4b070',
  // bone
  B: '#f6eedc', C: '#d4c4a0', D: '#9c8a70',
  // plate
  P: '#f0ecf8', L: '#b6b0cc', K: '#6e6888',
  // glow
  E: '#ff4040', F: '#ffd8a8', H: '#ff9a35'
};
const RGB = {};
for (const [k, v] of Object.entries(PAL)) { const n = parseInt(v.slice(1), 16); RGB[k] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// Bake a pixel map (rows of palette letters; '.' or ' ' is clear) into a canvas, optionally mirrored.
const baked = new Map();
function bake(key, rows, flip = false) {
  const k = key + (flip ? '|f' : '');
  let b = baked.get(k);
  if (b) return b;
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), D = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][flip ? w - 1 - x : x], rgb = ch && RGB[ch];
    if (!rgb) continue;
    const i = (y * w + x) * 4;
    D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  b = { c, w, h, white: null };
  baked.set(k, b);
  return b;
}
function whiteOf(b) {
  if (b.white) return b.white;
  const c = mk(b.w, b.h), g = c.getContext('2d');
  g.drawImage(b.c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff6ea';
  g.fillRect(0, 0, b.w, b.h);
  return (b.white = c);
}
function blit(g, b, x, y, hurt = 0) {
  g.drawImage(b.c, Math.round(x), Math.round(y));
  if (hurt > 0.02) {
    const a = g.globalAlpha;
    g.globalAlpha = a * Math.min(1, hurt * 1.6);
    g.drawImage(whiteOf(b), Math.round(x), Math.round(y));
    g.globalAlpha = a;
  }
}
// Stamp map rows into a char grid at (ox, oy) (used to compose the armor with its weapon and dents).
function stamp(grid, rows, ox, oy) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.' && row[i] !== ' ') { const y = oy + j, x = ox + i; if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = row[i]; } });
}

// ---- flames ---------------------------------------------------------------------------------
// A 2-px candle flame whose wick sits at (x, y) (left column of the candle, its top row).
const FLAME = [
  ['.o', 'oy', 'yc'],
  ['o.', 'yo', 'cy'],
  ['..', 'oo', 'yc'],
  ['.o', 'yo', 'cy'],
  ['o.', 'oy', 'yc']
];
const FLAME_C = { o: '#ff9a35', y: '#ffd25c', c: '#fff6c4' };
function flame(g, x, y, t, seed) {
  const k = Math.floor(t * 11 + seed * 17 + Math.sin(t * 3.1 + seed * 9) * 2);
  const f = FLAME[((k % FLAME.length) + FLAME.length) % FLAME.length];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { const c = FLAME_C[f[j][i]]; if (c) dot(g, x + i, y - 3 + j, c); }
  // A spark now and then above the tip.
  if (((k * 7 + Math.round(seed * 13)) % 11) === 0) dot(g, x + (k & 1), y - 5, '#ffd25c');
}
// The wick and its thin smoke once the candle is out.
function smoke(g, x, y, t, seed) {
  dot(g, x, y - 1, '#2a2236');
  const a = g.globalAlpha;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.9 + seed + i / 3) % 1;
    const sy = y - 2 - Math.floor(ph * 9), sx = x + Math.round(Math.sin(ph * 6 + seed * 5 + i) * (ph * 2));
    g.globalAlpha = a * (1 - ph) * 0.75;
    dot(g, sx, sy, ph < 0.4 ? '#8a7f95' : '#5a5270');
  }
  g.globalAlpha = a;
}

// ---- candelabra ---------------------------------------------------------------------------------
// 10 x 13, three candles; the stand's centre line runs between columns 4 and 5.
const CANDELABRA = [
  '....wW....',
  '....wW....',
  '.wW.wv.wW.',
  '.wW.wW.wW.',
  '.wvGygGwW.',
  'GygGk1GygG',
  '.4.k53k.4.',
  '..4.53.4..',
  '...4653...',
  '....53....',
  '...4653...',
  '..k4553k..',
  '.k54k153k.'
];
export function drawCandle(g, x, y, { lit = true, t = 0, hurt = 0, emissive = false } = {}) {
  const b = bake('candle', CANDELABRA);
  const x0 = Math.round(x) - 5, y0 = Math.round(y) - b.h;
  if (emissive && !lit) return;
  if (!emissive) blit(g, b, x0, y0, hurt);
  const seed = hash(Math.round(x) * 31 + Math.round(y));
  // wicks: the centre candle is the tallest
  const wicks = [[x0 + 4, y0], [x0 + 1, y0 + 2], [x0 + 7, y0 + 2]];
  wicks.forEach(([wx, wy], i) => {
    if (lit) flame(g, wx, wy, t, seed + i * 0.37);
    else smoke(g, wx + (i === 0 ? 1 : 0), wy, t, seed + i * 0.29);
  });
}

// ---- wall torch (the hidden room) -----------------------------------------------------------
// An iron sconce fixed to the wall at (x, y) (the cup's rim), with a bigger flame. Its light is in
// castleLights (HIDDEN_TORCH). castle-world.js paints this very sconce (with a still flame) in the hidden
// room at (584, 118..126): keep the two in step, the light has to sit on the painted flame.
export const HIDDEN_TORCH = { x: 584, y: 120 };
const SCONCE = [
  'k66665k',
  'k45543k',
  '.k443k.',
  '..k3k..',
  '..k4k..',
  '.k454k.',
  '.k343k.',
  '..kkk..'
];
const TORCH_FLAME = [
  ['..o..', '.oyo.', '.yco.', 'oycyo', '.occ.'],
  ['...o.', '..oy.', '.ocyo', 'oycy.', '.ycc.'],
  ['.o...', '.yo..', 'oyco.', '.ycyo', '.ccy.'],
  ['..o..', '..yo.', '.oyco', 'oycyo', '.occ.']
];
export function drawTorch(g, x, y, { t = 0, lit = true, emissive = false } = {}) {
  const b = bake('sconce', SCONCE);
  x = Math.round(x); y = Math.round(y);
  if (!emissive) blit(g, b, x - 3, y);
  if (!lit) { if (!emissive) smoke(g, x, y, t, 0.5); return; }
  const f = TORCH_FLAME[Math.floor(t * 10 + Math.sin(t * 2.3) * 1.5) & 3];
  f.forEach((row, j) => { for (let i = 0; i < 5; i++) { const c = FLAME_C[row[i]]; if (c) dot(g, x - 2 + i, y - 5 + j, c); } });
  if ((Math.floor(t * 9) % 5) === 0) dot(g, x + ((Math.floor(t * 9) % 3) - 1), y - 7, '#ffd25c');
}

// ---- suit of armor -----------------------------------------------------------------------------
// 14 x 26 facing right, the weapon held in the front hand. Rows -11.. above the armor are the weapon's.
const ARMOR = [
  '......sSs.....',
  '....sRRSRs....',
  '...sRrk66k....',
  '..sRrk6754k...',
  '.sRr.k6554k...',
  '.Rr..k5411k...',
  '.r...k5434k...',
  '.....k5413k...',
  '.....k4433k...',
  '.k554kk33k665k',
  'k6543k654k654k',
  'k543k66754k54k',
  '.k43k567543k4k',
  '.k43k567543k5k',
  '.k43k456543k4k',
  '.k32GggygGGk4k',
  'k553555544365k',
  'k653544433k66k',
  '.kk.k5k45k.kk.',
  '....k54k54k...',
  '....k54k54k...',
  '....k76k76k...',
  '....k43k43k...',
  '....k54k54k...',
  '....k43k43k...',
  '...k5543k55443'
];
// Weapon maps: [rows, column of their left edge, row of their top] in armor coordinates.
const SPEAR = [[
  '.76.',
  '.76.',
  '7665',
  '6654',
  '6554',
  '.54.',
  'kgGk',
  'sgG.',
  'Rdb.',
  'sdb.',
  'Rdb.'
].concat(Array(31).fill('.db.')).concat(['.53.', '.53.']), 12, -11];
const AXE = [[
  '..76......',
  '..76......',
  '..65..k...',
  '..43.k6k..',
  '..43k567k.',
  '.k43k45677',
  'k5434k4567',
  'k4434k4457',
  '.k43kk4457',
  '..43.k4567',
  '..43.k5677',
  '..43..k67k',
  '..43...kk.'].concat(Array(23).fill('..db......')).concat(['..53......', '..53......']), 11, -10];
// Battle damage, by level (facing right): dents (a dark pit with a lit lower lip), chips, a split breastplate.
const DENTS = [
  [],
  [[8, 12, '2'], [9, 13, '6'], [2, 11, '2']],
  [[7, 3, '3'], [8, 4, '7'], [11, 10, '2'], [12, 11, '3'], [5, 1, '.'], [2, 3, '.'], [1, 4, '.'], [6, 16, '2']],
  [[6, 11, '1'], [6, 12, '1'], [7, 13, '1'], [7, 14, '1'], [6, 14, '6'], [0, 10, '3'], [1, 10, '4'], [8, 18, '.'],
    [6, 0, '.'], [7, 0, '.'], [8, 0, '.'], [4, 1, '.'], [9, 1, 'r'], [1, 5, '.'], [1, 6, '.'], [2, 5, '.'], [3, 2, '.'], [11, 21, '3']]
];
function armorSprite(weapon, level, flip) {
  const key = `armor|${weapon}|${level}`;
  const full = key + (flip ? '|f' : '');
  if (baked.has(full)) return baked.get(full);
  const top = -11, W = 21, H = 26 - top;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const wp = weapon === 'spear' ? SPEAR : AXE;
  stamp(grid, wp[0], wp[1], wp[2] - top);
  stamp(grid, ARMOR, 0, -top);
  // The front gauntlet closes over the shaft.
  stamp(grid, ['k', '5', '4'], 13, 16 - top);
  for (let l = 1; l <= level; l++) for (const [cx, cy, ch] of DENTS[l]) {
    const y = cy - top;
    if (ch === '.') { if (grid[y][cx] !== 'k') grid[y][cx] = '.'; } else if (grid[y][cx] !== '.') grid[y][cx] = ch;
  }
  if (level >= 3) {
    // the helmet knocked askew: the head drops a pixel and slides back one
    const snap = [];
    for (let y = 0; y <= 8; y++) { snap.push(grid[y - top].slice(0, 12)); for (let x = 0; x < 12; x++) grid[y - top][x] = '.'; }
    snap.forEach((r, j) => r.forEach((ch, i) => { if (ch !== '.' && i > 0) grid[j + 1 - top][i - 1] = ch; }));
  }
  return bake(key, grid.map(r => r.join('')), flip);
}
export function drawArmor(g, x, y, face = 1, { weapon = 'axe', hp, max = 36, t = 0, hurt = 0 } = {}) {
  const d = 1 - clamp(max > 0 && hp != null ? hp / max : 1, 0, 1);
  const level = d > 0.72 ? 3 : d > 0.45 ? 2 : d > 0.18 ? 1 : 0;
  const flip = face < 0;
  const b = armorSprite(weapon === 'spear' ? 'spear' : 'axe', level, flip);
  // The armor's centre (column 7) on x; the soles on y. A clang rattles it.
  const rattle = hurt > 0.15 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
  const cx = flip ? b.w - 7 : 7;
  const x0 = Math.round(x) - cx + rattle, y0 = Math.round(y) - b.h;
  blit(g, b, x0, y0, hurt);
  // Something stirs inside a battered suit: the visor slit glows now and then.
  const shiftY = level >= 3 ? 1 : 0, shiftX = level >= 3 ? -1 : 0;
  if (level >= 2 && (Math.floor(t * 3 + x) % 4 !== 0 || hurt > 0)) {
    const ex = 8 + shiftX, ey = 5 + 11 + shiftY;
    const sx = flip ? b.w - 1 - ex : ex;
    dot(g, x0 + sx, y0 + ey, level >= 3 ? '#ff4040' : '#a8202c');
    if (level >= 3) dot(g, x0 + (flip ? sx - 1 : sx + 1), y0 + ey, '#ff8a6a');
  }
}

// ---- cracked brick wall (secret) -----------------------------------------------------------------
const wallCache = new Map();
function wallBase(w, h) {
  const key = w + 'x' + h;
  if (wallCache.has(key)) return wallCache.get(key);
  const c = mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), D = id.data;
  const set = (x, y, ch) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const rgb = RGB[ch], i = (y * w + x) * 4; D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = 255; };
  const rnd = seeded(4242 + w * 7 + h);
  const CH = 6, BW = 8;
  const bricks = [];
  for (let row = 0, y = 0; y < h; row++, y += CH) {
    const off = row % 2 ? -BW / 2 : 0;
    for (let x = off; x < w; x += BW) {
      const tone = rnd();
      bricks.push({ x0: Math.max(0, x), x1: Math.min(w, x + BW) - 1, y0: y, y1: Math.min(h, y + CH) - 1, tone });
    }
  }
  // mortar
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, 'n');
  for (const b of bricks) {
    const base = b.tone < 0.25 ? 'q' : b.tone > 0.8 ? 'u' : 't';
    const dark = base === 'u' ? 't' : base === 'q' ? 'p' : 'q', lite = base === 'u' ? 'x' : base === 'q' ? 't' : 'u';
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
      let ch = base;
      if (y === b.y0) ch = lite;
      else if (y === b.y1 - 1) ch = dark;
      else if (x === b.x0) ch = lite;
      else if (x === b.x1 - 1) ch = dark;
      else if (bayer(x * 3 + b.x0, y * 5) < 0.12) ch = dark;
      set(x, y, ch);
    }
    // a pit or two in the face of the stone
    if (b.x1 - b.x0 > 3) { const px = b.x0 + 1 + Math.floor(rnd() * (b.x1 - b.x0 - 2)), py = b.y0 + 2; set(px, py, dark); }
  }
  // a darker cap stone row on top and a lit edge on the side facing the hall
  for (let x = 0; x < w; x++) { set(x, 0, 'x'); set(x, 1, 'u'); }
  for (let y = 0; y < h; y++) { set(w - 1, y, y % CH === CH - 1 ? 'q' : 'p'); }
  g.putImageData(id, 0, 0);
  // The crack network: one long fissure from a weak point and its branches, in growth order.
  const pts = [];
  const ox = Math.floor(w * 0.45), oy = Math.floor(h * 0.58);
  const walk = (x, y, dx, dy, n, t0, depth) => {
    let fx = x, fy = y;
    for (let i = 0; i < n; i++) {
      fx += dx + (rnd() - 0.5) * 0.9; fy += dy + (rnd() - 0.5) * 0.6;
      const tt = t0 + i / n * (1 - t0) * (depth ? 0.8 : 1);
      pts.push({ x: Math.round(fx), y: Math.round(fy), t: tt });
      if (depth < 2 && rnd() < 0.09) walk(fx, fy, dx * 0.4 + (rnd() - 0.5) * 1.2, dy * 0.6 + (rnd() < 0.5 ? 0.8 : -0.8), Math.floor(n * 0.45), tt, depth + 1);
    }
  };
  pts.push({ x: ox, y: oy, t: 0 });
  walk(ox, oy, 0.25, -0.95, Math.floor(h * 0.55), 0, 0);
  walk(ox, oy, -0.2, 0.95, Math.floor(h * 0.42), 0.05, 0);
  walk(ox, oy, -0.9, -0.3, Math.floor(w * 0.5), 0.2, 1);
  walk(ox, oy, 0.9, 0.35, Math.floor(w * 0.5), 0.3, 1);
  // Stones that fall out as it weakens, nearest the weak point first.
  const holes = bricks.filter(b => b.x1 - b.x0 >= 3 && b.y0 > 1).map(b => ({ ...b, d: Math.hypot((b.x0 + b.x1) / 2 - ox, (b.y0 + b.y1) / 2 - oy) })).sort((a, b) => a.d - b.d).slice(0, 6);
  const out = { c, pts, holes, w, h };
  wallCache.set(key, out);
  return out;
}
export function drawCracked(g, x0, y0, x1, y1, hp, max = 60) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  const w = Math.round(x1) - x0, h = Math.round(y1) - y0;
  if (w < 2 || h < 2) return;
  const base = wallBase(w, h);
  const d = 1 - clamp(max > 0 && hp != null ? hp / max : 1, 0, 1);
  g.drawImage(base.c, x0, y0);
  // Fallen-out stones: the dark alcove behind, with the lit lower lip of the hole.
  const nh = d > 0.85 ? 4 : d > 0.7 ? 2 : d > 0.55 ? 1 : 0;
  for (let i = 0; i < nh; i++) {
    const b = base.holes[i];
    // a ragged hole: the stone's edges chip off unevenly, its lower lip catches the light
    for (let yy = b.y0 - 1; yy <= b.y1; yy++) for (let xx = b.x0 - 1; xx <= b.x1; xx++) {
      if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
      const rim = xx < b.x0 || xx >= b.x1 || yy < b.y0 || yy >= b.y1;
      const hv = hash(xx * 17 + yy * 53 + i * 7);
      if (rim ? hv > 0.3 : (xx === b.x0 || xx === b.x1 - 1) && (yy === b.y0 || yy === b.y1 - 1) && hv < 0.5) continue;
      dot(g, x0 + xx, y0 + yy, yy === b.y0 - 1 || yy === b.y0 ? '#000000' : PAL.Z);
    }
    for (let xx = b.x0; xx < b.x1; xx++) if (hash(xx * 5 + i) > 0.25) dot(g, x0 + xx, y0 + b.y1, PAL.u);
  }
  // Cracks: a hairline even when whole (a hint), growing with the damage.
  const reach = 0.06 + d * 1.05;
  for (const p of base.pts) {
    if (p.t > reach || p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue;
    dot(g, x0 + p.x, y0 + p.y, PAL.Z);
    if (d > 0.3 && p.t < reach - 0.25 && p.x + 1 < w) dot(g, x0 + p.x + 1, y0 + p.y, PAL.k);
    if (p.y + 1 < h && p.x - 1 >= 0) dot(g, x0 + p.x - 1, y0 + p.y + 1, PAL.u);
  }
  // Grit at its foot.
  const grit = Math.floor(d * 7);
  for (let i = 0; i < grit; i++) {
    const gx = x0 + Math.floor(hash(i * 13 + w) * (w + 6)) - 2, big = hash(i * 7 + 3) > 0.6;
    fill(g, gx, y0 + h - (big ? 2 : 1), big ? 2 : 1, big ? 2 : 1, big ? PAL.t : PAL.q);
    if (big) dot(g, gx, y0 + h - 2, PAL.u);
  }
}

// ---- the roast (wall meat) ---------------------------------------------------------------------
const ROAST = [
  '..........BB...',
  '.........BCDB..',
  '.....kkk.kCD...',
  '...kkTQOkkCk...',
  '..kQTTQOOOkk...',
  '.kOQTQQOOOONk..',
  '.kOQQOOOONNNk..',
  '.kNOOONNNNNMk..',
  'kKkMNNNNNMMkkKk',
  'kPPkkkkkkkkkLLk',
  '.kLPPPPPPPLLLk.',
  '..kkkkkkkkkkk..'
];
export function drawRoast(g, x, y, t = 0, { emissive = false } = {}) {
  const b = bake('roast', ROAST);
  const x0 = Math.round(x) - 7, y0 = Math.round(y) - b.h;
  const a = g.globalAlpha;
  if (!emissive) blit(g, b, x0, y0);
  // steam
  for (let i = 0; i < (emissive ? 0 : 2); i++) {
    const ph = (t * 0.6 + i * 0.5) % 1;
    g.globalAlpha = a * (1 - ph) * 0.5;
    dot(g, x0 + 5 + i * 3 + Math.round(Math.sin(ph * 7 + i) * 1), y0 + 1 - Math.floor(ph * 7), '#e8e0f0');
  }
  g.globalAlpha = a;
  // the glint: a little star that blooms on the glaze every so often
  const k = Math.floor((t % 1.6) * 12);
  const gx = x0 + 4, gy = y0 + 4;
  if (k === 1 || k === 5) dot(g, gx, gy, '#fff8e0');
  if (k >= 2 && k <= 4) {
    dot(g, gx, gy, '#ffffff');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(g, gx + dx, gy + dy, '#fff0c8');
    if (k === 3) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(g, gx + dx, gy + dy, '#ffd8a0');
  }
}

// ---- treasure chest ----------------------------------------------------------------------------
const CHEST = [
  '...kkkkkkkkkk...',
  '..k5eedddddd5k..',
  'kdd5dccccccc5cbk',
  'kcc4ccGggGcc4bak',
  'k33433GygG33433k',
  'kdd5dcGkkGcc5cbk',
  'kdc5ccGGGGcc5bbk',
  'kcc4cbbbbbbb4bak',
  'kcb4bbbbbbbb4bak',
  'k33433333333433k',
  '.kkkkkkkkkkkkkk.'
];
const CHEST_OPEN = [
  '..kkkkkkkkkkkk..',
  '.kb4bbbbbbbb4bk.',
  '.kb4aaaaaaaa4ak.',
  '.ka3aaaaaaaa3ak.',
  '.kk3kkkkkkkk3kk.',
  '...kyYgyGgyYk...',
  '..kgyGyYgyGgyk..',
  'k33yGgYyggYGg33k',
  'kdd5dcGkkGcc5cbk',
  'kdc5ccGGGGcc5bbk',
  'kcc4cbbbbbbb4bak',
  'kcb4bbbbbbbb4bak',
  'k33433333333433k',
  '.kkkkkkkkkkkkkk.'
];
export function drawChest(g, x, y, open = false, t = 0, { emissive = false } = {}) {
  const b = bake(open ? 'chestO' : 'chest', open ? CHEST_OPEN : CHEST);
  const x0 = Math.round(x) - 8, y0 = Math.round(y) - b.h;
  if (open) {
    // a golden glow welling out of it (dithered, pulsing)
    const pulse = 0.5 + Math.sin(t * 4) * 0.25;
    const a = g.globalAlpha;
    for (let yy = -9; yy < 8; yy++) for (let xx = -2; xx < 18; xx++) {
      const dx = (xx - 7.5) / 10, dy = (yy - 6) / 9, v = 1 - Math.hypot(dx, dy);
      if (v <= 0 || bayer(xx + x0, yy + y0) > v * pulse) continue;
      g.globalAlpha = a * (v > 0.5 ? 0.55 : 0.3);
      dot(g, x0 + xx, y0 + yy, v > 0.5 ? '#ffe9a0' : '#e0a840');
    }
    g.globalAlpha = a;
  }
  if (!emissive) blit(g, b, x0, y0);
  else if (open) {
    // the heap of gold shines through the dark
    for (let i = 0; i < 6; i++) dot(g, x0 + 4 + ((i * 5 + Math.floor(t * 3)) % 9), y0 + 5 + (i % 3), i % 2 ? '#fff3c0' : '#f7d672');
  }
  if (open) {
    // sparkles rising out of the coins
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.7 + i * 0.25) % 1, sx = x0 + 3 + Math.floor(hash(i * 5 + Math.floor(t * 0.7 + i * 0.25)) * 10);
      const sy = y0 + 5 - Math.floor(ph * 12);
      dot(g, sx, sy, ph < 0.5 ? '#fff6c4' : '#f7d672');
      if (ph < 0.3) { dot(g, sx - 1, sy, '#e0a840'); dot(g, sx + 1, sy, '#e0a840'); }
    }
  } else {
    // the lock catches the light
    if ((Math.floor(t * 6) % 9) === 0) dot(g, x0 + 7, y0 + 3, '#fff3c0');
  }
}

// ---- gargoyle ----------------------------------------------------------------------------------
// A horned demon's head seen from the front (18 x 15), on a stone corbel whose arm runs back to the
// wall behind it (the side opposite 'face'). (x, y) is the middle of the head. The left half is
// drawn; the right half is its mirror, a shade darker (the light comes from the upper left).
const GARG_HALF = [
  'k........',
  'kxk......',
  'kuxk.....',
  '.kuxk....',
  '.ktuxkkkk',
  '..ktuxxxx',
  'kk.kuxxxx',
  'kxkkkkuxx',
  '.kxtnnkkx',
  '..ktZZnux',
  '..ktqnnux',
  '..kqtuuxn',
  '.kkqkknnk',
  'kxkBkZZZZ',
  '.kqBZZZZZ',
  '..kqkBZZZ',
  '...kqtkkk',
  '....kkk..'
];
const DARKER = { x: 'u', u: 't', t: 'q', q: 'p', p: 'n' };
const GARGOYLE = GARG_HALF.map(r => r + [...r].reverse().map(c => DARKER[c] || c).join(''));
// The bracket: a stone beam from the wall behind the head (drawn here with the wall on the left, for a
// head looking right) and a moulded console under the chin.
const GARG_ARM = [
  'kkk.............',
  'xuukkkkkkkkkkkkk',
  'utuxuuuuuuuuuutk',
  'tqtttttttqtttttk',
  'tqqqqqqqqpqqqqpk',
  'qpkkkkkkkkkkkkkk',
  'pnk.............',
  'kkk.............'
];
const GARG_CONSOLE = [
  'kkkkkkkkkkkk',
  'kxuuuuuuuutk',
  '.kqtttttttk.',
  '..kqqqqqpk..',
  '...kppppk...',
  '....kkkk....'
];
export function drawGargoyle(g, x, y, face = -1, { glow = 0, t = 0, emissive = false } = {}) {
  const flip = face < 0;
  const head = bake('gargoyle', GARGOYLE), arm = bake('gargArm', GARG_ARM, flip), con = bake('gargCon', GARG_CONSOLE);
  const shake = glow > 0.85 ? (Math.floor(t * 30) % 2 ? 1 : 0) : 0;
  const hx = Math.round(x) - 9 + shake, hy = Math.round(y) - 9;
  if (!emissive) {
    // the beam runs back into the wall behind the head; the console holds the chin
    blit(g, arm, flip ? hx + 9 : hx - 7, hy + 2);
    blit(g, head, hx, hy);
    blit(g, con, hx + 3, hy + 16);
  }
  if (glow > 0.03) {
    const flick = 0.85 + Math.sin(t * 17) * 0.15;
    const hot = glow * flick > 0.55;
    // burning eyes and an ember in the throat
    for (const ex of [4, 5, 12, 13]) dot(g, hx + ex, hy + 9, (ex === 4 || ex === 13) ? (glow > 0.3 ? '#ff4040' : '#8a1a22') : hot ? '#ffe0b0' : '#ff4040');
    if (glow > 0.4) {
      const a = g.globalAlpha;
      g.globalAlpha = a * glow * 0.5 * flick;
      for (const ex of [4.5, 12.5]) for (const [dx, dy] of [[-1.5, -1], [-0.5, -1], [0.5, -1], [-2.5, 0], [1.5, 0], [-0.5, 1]]) dot(g, hx + ex + dx + (ex > 9 ? 1 : 0), hy + 9 + dy, '#ff4040');
      g.globalAlpha = a;
      for (let i = 6; i <= 11; i++) if (Math.floor(t * 8 + i) % 3) dot(g, hx + i, hy + 14, glow > 0.7 ? '#ff6a3a' : '#a0242c');
    }
    // dust shaken loose, falling from under the console and the beam
    const n = emissive ? 0 : Math.round(glow * 8);
    const a = g.globalAlpha;
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.9 + hash(i * 37)) % 1;
      const dx = hx + 1 + Math.floor(hash(i * 11 + 1) * 17) + (i % 3 === 0 ? (flip ? 9 : -6) : 0);
      g.globalAlpha = a * (1 - ph) * 0.85;
      dot(g, dx + Math.round(Math.sin(ph * 5 + i) * 1), hy + 21 + Math.floor(ph * 26), i % 3 ? '#8a7f95' : '#aaa0b8');
    }
    g.globalAlpha = a;
  }
}

// ---- secret door -----------------------------------------------------------------------------
const doorCache = new Map();
function doorSlab(w, h) {
  const key = w + 'x' + h;
  if (doorCache.has(key)) return doorCache.get(key);
  const c = mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), D = id.data;
  const set = (x, y, ch) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const rgb = RGB[ch], i = (y * w + x) * 4; D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = 255; };
  const rnd = seeded(77 + w + h * 3);
  const teeth = 4;
  // stone blocks, two to a course, staggered
  const CH = 9;
  for (let y = 0; y < h - teeth; y++) for (let x = 0; x < w; x++) {
    const row = Math.floor(y / CH), ly = y % CH, split = row % 2 ? Math.floor(w * 0.35) : Math.floor(w * 0.62);
    let ch = (x * 7 + y * 3) % 11 === 0 ? 'q' : 't';
    if (ly === 0) ch = 'n';
    else if (ly === 1) ch = 'u';
    else if (ly === CH - 1) ch = 'p';
    if (x === split) ch = 'n';
    else if (x === split + 1 && ly > 0) ch = 'u';
    else if (x === split - 1 && ly > 0) ch = 'q';
    set(x, y, ch);
  }
  // iron frame down both sides, iron straps with rivets across
  for (let y = 0; y < h - teeth; y++) { set(0, y, '4'); set(1, y, '3'); set(w - 2, y, '2'); set(w - 1, y, '1'); }
  for (const sy of [3, Math.floor((h - teeth) / 2), h - teeth - 6]) {
    for (let x = 0; x < w; x++) { set(x, sy, '5'); set(x, sy + 1, '4'); set(x, sy + 2, '2'); }
    for (let x = 2; x < w - 1; x += 5) { set(x, sy + 1, '7'); set(x + 1, sy + 1, '3'); }
  }
  // a carved sigil in the middle stone: a clock face, the key to the room
  const cx = Math.floor(w / 2), cy = Math.floor((h - teeth) / 2) - 9;
  for (let a = 0; a < 16; a++) { const px = Math.round(cx + Math.cos(a / 16 * Math.PI * 2) * 3), py = Math.round(cy + Math.sin(a / 16 * Math.PI * 2) * 3); set(px, py, 'p'); }
  set(cx, cy, 'n'); set(cx, cy - 1, 'n'); set(cx, cy - 2, 'n'); set(cx + 1, cy, 'n');
  for (let y = cy - 4; y <= cy + 4; y++) if (rnd() < 0.3) set(cx + 4, y, 'u');
  // the bottom edge: iron teeth
  for (let y = h - teeth; y < h; y++) for (let x = 0; x < w; x++) {
    const k = x % 5, depth = y - (h - teeth);
    const inTooth = k >= 1 && k <= 3 && (depth < 2 || k === 2);
    if (depth === 0) set(x, y, '2');
    else if (inTooth) set(x, y, k === 1 ? '6' : k === 2 ? '5' : '3');
  }
  g.putImageData(id, 0, 0);
  doorCache.set(key, c);
  return c;
}
export function drawDoor(g, x0, y0, x1, y1, open = 0) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  const w = Math.round(x1) - x0, h = Math.round(y1) - y0;
  if (w < 2 || h < 2 || open >= 1) return;
  const slab = doorSlab(w, h);
  const lift = Math.round(clamp(open, 0, 1) * h);
  const sh = h - lift;
  if (sh <= 0) return;
  // grinding: it shudders a pixel while moving
  const moving = open > 0.001 && open < 0.999;
  const jx = moving && (Math.floor(open * 90) % 3 === 0) ? 1 : 0;
  g.drawImage(slab, 0, lift, w, sh, x0 + jx, y0, w, sh);
  // the slot it slides into, a dark lip where it meets the roof
  fill(g, x0, y0, w, 1, PAL.k);
  if (moving) {
    // grit sifting down from the slot
    for (let i = 0; i < 4; i++) {
      const ph = (open * 6 + i * 0.25) % 1;
      dot(g, x0 + 2 + Math.floor(hash(i * 9 + Math.floor(open * 6)) * (w - 4)), y0 + 1 + Math.floor(ph * 8), PAL.u);
    }
  }
}

// ---- iron chain ---------------------------------------------------------------------------------
// Oval links rasterized at any angle, alternating one seen face-on (a ring around a hole) and one
// seen edge-on (a bar), lit from the upper left.
export function drawChain(g, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len, vx = -uy, vy = ux;
  const pitch = 3.5, n = Math.max(1, Math.round(len / pitch)), step = len / n;
  // the side of the chain facing the light
  const litSide = vx * -0.55 + vy * -0.72 > 0 ? 1 : -1;
  const xa = Math.floor(Math.min(x0, x1)) - 3, xb = Math.ceil(Math.max(x0, x1)) + 3, ya = Math.floor(Math.min(y0, y1)) - 3, yb = Math.ceil(Math.max(y0, y1)) + 3;
  for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) {
    const rx = px + 0.5 - x0, ry = py + 0.5 - y0;
    const along = rx * ux + ry * uy, across = rx * vx + ry * vy;
    if (along < -0.5 || along > len + 0.5 || Math.abs(across) > 2.2) continue;
    const i = Math.max(0, Math.min(n - 1, Math.floor(along / step)));
    let col = null;
    for (const j of [i - 1, i, i + 1]) {
      if (j < 0 || j >= n) continue;
      const la = along - (j + 0.5) * step;
      if (j % 2 === 0) {
        const r = Math.hypot(la / 2.3, across / 1.6);
        if (r < 1.1 && r > 0.42) { col = across * litSide > 0.3 ? '#a49cbc' : across * litSide < -0.3 ? '#3e3757' : '#6a6088'; break; }
      } else if (Math.abs(across) < 0.55 && Math.abs(la) < 2.4) { col = Math.abs(la) < 0.8 ? '#c4bed8' : '#7a70a0'; break; }
    }
    if (col) dot(g, px, py, col);
  }
}

// ---- vector-built pieces (rotate cleanly) --------------------------------------------------------
let MATS = null;
const mats = () => MATS || (MATS = {
  iron: material('#5a5276'), ironDark: material('#3e3757'), ironThin: material('#7a70a0', { noOutline: true }),
  gold: material('#e0a840', { gloss: true }), wax: material('#efe2c8', { flat: true }),
  steel: material('#c9d3de', { gloss: true }), blade: material('#a9b4c8', { gloss: true })
});
const E = (x, y, rx, ry, m, z = 0, o = {}) => ({ t: 'ellipse', x, y, rx, ry, m, z, ...o });
const C = (x1, y1, x2, y2, r1, r2, m, z = 0, o = {}) => ({ t: 'capsule', x1, y1, x2, y2, r1, r2, m, z, ...o });
const R = (x, y, w, h, r, m, z = 0, o = {}) => ({ t: 'rect', x, y, w, h, r, m, z, ...o });
const Pg = (pts, m, z = 0, o = {}) => ({ t: 'poly', pts, m, z, ...o });
const ln = (x1, y1, x2, y2, c, over = true) => ({ t: 'line', x1, y1, x2, y2, over, c });
const pxd = (x, y, c, over = true) => ({ t: 'px', x, y, over, c });

// The chandelier: hook at (0, 0); a ring of 8 candles (rx 19, seen a little from above), a central
// stem with a gold knop and a spiked finial below.
const RING = { cy: 10, rx: 18.5, ry: 3, band: 2.6 };
const CANDLE_ANG = Array.from({ length: 8 }, (_, k) => (k + 0.5) * Math.PI / 4);
const candleTop = a => { const x = RING.rx * Math.cos(a), y = RING.cy + RING.ry * Math.sin(a); return [x, y - 5]; };
let chandDef = null;
function chandelierDef() {
  if (chandDef) return chandDef;
  const { cy, rx, ry, band } = RING;
  const arc = (a0, a1, n) => {
    const outer = [], inner = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = rx * Math.cos(a), y = cy + ry * Math.sin(a); outer.push([x, y + band]); inner.push([x, y]); }
    return outer.concat(inner.reverse());
  };
  const shapes = [
    Pg(arc(Math.PI, Math.PI * 2, 18), 'ironDark', 0, { b: 0.4 }),
    C(0, 2, 0, 15, 1.1, 1.4, 'iron', 1),
    E(0, 6, 2.2, 1.4, 'gold', 1.5),
    Pg(arc(0, Math.PI, 18), 'iron', 3, { b: 0.5 }),
    E(0, 14.6, 2.8, 1.6, 'gold', 4),
    Pg([[-2, 15.4], [2, 15.4], [0.4, 18.6], [-0.4, 18.6]], 'iron', 3.8),
    E(0, 0.8, 1.6, 1.6, 'iron', 2)
  ];
  const details = [];
  // inner arms from the stem out to the ring, seen between its halves
  for (const s of [-1, 1]) details.push(ln(s * 1, 12, s * 9, 11, '#7a70a0'), ln(s * 9, 11, s * 15, 10, '#7a70a0'), pxd(s * 9, 12, '#3e3757'));
  details.push(pxd(0, 0, '#211c31'));
  for (const a of CANDLE_ANG) {
    const front = Math.sin(a) > 0, [x, top] = candleTop(a), z = front ? 2 : 0.5;
    shapes.push(R(x - 1, top, 2, 5, 0, 'wax', z, { edge: 0.6 }));
    shapes.push(E(x, top + 5, 2, 0.9, 'gold', z + 0.1));
    details.push(pxd(x - 1, top, '#fffaf0', false));
  }
  // a gold rail along the top of the front band, studs and little gold drops hanging under it
  for (let i = 1; i < 36; i++) { const a = i / 36 * Math.PI, x = rx * Math.cos(a), y = cy + ry * Math.sin(a); details.push(pxd(x, y + 0.4, i % 6 === 3 ? '#fff3c0' : '#c89040', false)); }
  for (const a of [Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]) {
    const x = rx * Math.cos(a), y = cy + ry * Math.sin(a) + band;
    shapes.push(E(x, y + 1.2, 1, 1.2, 'gold', 4.5));
    details.push(pxd(x, y + 0.8, '#fff3c0', false));
  }
  for (let i = 2; i < 18; i += 4) { const a = i / 18 * Math.PI, x = rx * Math.cos(a), y = cy + ry * Math.sin(a); details.push(pxd(x, y + 1.6, '#9a92b4', false)); }
  // three hanging chains from the hook to the ring
  details.push(ln(0, 1.5, -rx + 1, cy - 1, '#8a80a8'), ln(0, 1.5, rx - 1, cy - 1, '#8a80a8'));
  chandDef = { key: 'castle-chandelier', shapes, details };
  return chandDef;
}
export function drawChandelier(g, x, y, angle = 0, { lit = true, t = 0, broke = false, emissive = false } = {}) {
  x = Math.round(x); y = Math.round(y);
  if (emissive && !lit) return;
  if (!emissive) { const sp = sprite(chandelierDef(), mats(), { angle }); g.drawImage(sp.canvas, x - sp.ox, y - sp.oy); }
  const ca = Math.cos(angle), sa = Math.sin(angle);
  CANDLE_ANG.forEach((a, i) => {
    if (broke && i % 3 === 1) return;
    const [lx, ly] = candleTop(a);
    const sx = Math.floor(x + (lx - 0.5) * ca - ly * sa), sy = Math.floor(y + (lx - 0.5) * sa + ly * ca);
    if (lit) flame(g, sx - 0, sy, t, i * 0.21 + 0.13);
    else smoke(g, sx, sy, t, i * 0.31);
  });
}

// The pendulum blade, hanging from its rod's end at (0, 0): a crescent ~28 x 11 with a socket.
let bladeDef = null;
function pendulumBladeDef() {
  if (bladeDef) return bladeDef;
  const N = 20, outer = [], inner = [], edge = [], fuller = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI;
    outer.push([14 * Math.cos(a), 1 + 10 * Math.sin(a)]);
    inner.push([14 * Math.cos(a), 1 + 4 * Math.sin(a)]);
  }
  for (let i = 1; i < 40; i++) {
    const a = i / 40 * Math.PI;
    edge.push(pxd(13.2 * Math.cos(a), 1 + 9.3 * Math.sin(a), '#f4fbff', false));
    if (i > 6 && i < 34 && i % 2 === 0) fuller.push(pxd(12 * Math.cos(a), 1 + 6.6 * Math.sin(a), '#6a7690', false));
  }
  const shapes = [
    Pg(outer.concat(inner.reverse()), 'blade', 0, { b: 0.5, edge: 2.2 }),
    R(-2, -6, 4, 9, 0.8, 'iron', 2),
    E(0, -5.5, 2.8, 1.3, 'gold', 3),
    E(0, 2.6, 2.6, 1.6, 'iron', 2.5)
  ];
  bladeDef = { key: 'castle-blade', shapes, details: [...fuller, ...edge, pxd(-1, -3, '#b4adc8', false), pxd(0, 2, '#d8d0ec', false)] };
  return bladeDef;
}
export function drawPendulum(g, px, py, ang = 0, len = 133, { t = 0, emissive = false } = {}) {
  px = Math.round(px); py = Math.round(py);
  const sx = Math.sin(ang), cy = Math.cos(ang);
  const ex = px + sx * len, ey = py + cy * len;
  if (!emissive) drawPendulumBody(g, px, py, sx, cy, ex, ey, ang, len);
  // a glint running along the edge
  const k = (t * 0.7) % 1;
  if (k < 0.35) {
    const a = Math.PI * (0.15 + k / 0.35 * 0.7), lx = 13.2 * Math.cos(a), ly = 1 + 9.3 * Math.sin(a);
    const gx = ex + lx * Math.cos(-ang) - ly * Math.sin(-ang), gy = ey + lx * Math.sin(-ang) + ly * Math.cos(-ang);
    dot(g, gx, gy, '#ffffff');
    dot(g, gx + 1, gy, '#e8f4ff'); dot(g, gx - 1, gy, '#e8f4ff'); dot(g, gx, gy - 1, '#e8f4ff');
  }
}
function drawPendulumBody(g, px, py, sx, cy, ex, ey, ang, len) {
  // the mounting plate under the gallery and the pivot hub
  fill(g, px - 5, py - 4, 11, 3, '#2b2640'); fill(g, px - 5, py - 4, 11, 1, '#6a6088'); dot(g, px - 4, py - 3, '#9a92b4'); dot(g, px + 4, py - 3, '#9a92b4');
  // the rod: three pixels across, lit on its left
  const n = Math.ceil(len) - 4;
  for (let i = 3; i <= n; i++) {
    const x = Math.round(px + sx * i), y = Math.round(py + cy * i);
    const collar = i % 34 === 0;
    dot(g, x - 1, y, collar ? '#b4adc8' : '#837a9c');
    dot(g, x, y, collar ? '#837a9c' : '#4a4462');
    dot(g, x + 1, y, '#1e1a2b');
    if (collar) { dot(g, x - 2, y, '#5a5276'); dot(g, x + 2, y, '#1e1a2b'); }
  }
  // hub
  const hub = ['.k3k.', 'k563k', '35731', 'k431k', '.k1k.'];
  hub.forEach((row, j) => { for (let i = 0; i < 5; i++) { const c = PAL[row[i]]; if (c && row[i] !== '.') dot(g, px - 2 + i, py - 2 + j, c); } });
  // the blade turns with the rod (its own sprite angle is the opposite sense of 'ang')
  const sp = sprite(pendulumBladeDef(), mats(), { angle: -ang });
  g.drawImage(sp.canvas, Math.round(ex) - sp.ox, Math.round(ey) - sp.oy);
}

// ---- the loose stone ledge over the pit ---------------------------------------------------------
const ledgeCache = new Map();
function ledgeStones(x0, x1) {
  const key = x0 + ':' + x1;
  if (ledgeCache.has(key)) return ledgeCache.get(key);
  const rnd = seeded(913 + x0 * 3 + x1);
  const stones = [];
  for (let x = x0; x < x1;) {
    const w = Math.min(x1 - x, 9 + Math.floor(rnd() * 6));
    stones.push({ x, w: x1 - (x + w) < 5 ? x1 - x : w, seed: rnd(), crack: Math.floor(rnd() * 6) + 2 });
    x += stones[stones.length - 1].w;
  }
  ledgeCache.set(key, stones);
  return stones;
}
function paintStone(g, x, y, w, s, shake, cut = null) {
  const H = 8;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < w; xx++) {
    if (cut && !cut(xx, yy)) continue;
    let c;
    const edgeL = xx === 0, edgeR = xx === w - 1;
    if (yy === 0) c = edgeR ? PAL.t : '#c4bad4';
    else if (yy === 1) c = edgeL ? PAL.x : PAL.u;
    else if (yy === H - 1) c = PAL.n;
    else if (yy === H - 2) c = PAL.p;
    else {
      const n = hash(xx * 13 + yy * 71 + Math.floor(s.seed * 997));
      c = edgeL ? PAL.u : edgeR ? PAL.p : n < 0.13 ? PAL.q : n > 0.93 ? PAL.u : PAL.t;
    }
    // the chipped bottom corners
    if (yy === H - 1 && (edgeL || edgeR)) continue;
    dot(g, x + xx, y + yy, c);
  }
  if (shake > 0.15) {
    // a crack opening down the stone
    const n = Math.min(H - 1, Math.round(shake * 9)), zig = [0, 0, 1, 1, 0, 1, 2, 2];
    for (let i = 1; i <= n; i++) { dot(g, x + s.crack + zig[i], y + i, PAL.Z); if (i > 1 && i < H - 2) dot(g, x + s.crack + zig[i] + 1, y + i, PAL.x); }
  }
}
export function drawCrumble(g, x0, x1, y, { shake = 0, gone = 0, t = 0 } = {}) {
  x0 = Math.round(x0); x1 = Math.round(x1); y = Math.round(y);
  if (gone >= 1 || x1 - x0 < 2) return;
  const stones = ledgeStones(x0, x1);
  if (gone <= 0 && shake <= 0.05) {
    // at rest: one baked strip
    const key = 'ledge|' + x0 + ':' + x1;
    let c = baked.get(key);
    if (!c) {
      const cv = mk(x1 - x0, 8), cg = cv.getContext('2d');
      stones.forEach(s => paintStone(cg, s.x - x0, 0, s.w, s, 0));
      c = { c: cv, w: x1 - x0, h: 8, white: null };
      baked.set(key, c);
    }
    g.drawImage(c.c, x0, y);
    return;
  }
  if (gone <= 0) {
    stones.forEach((s, i) => {
      const jx = shake > 0.05 ? Math.round(Math.sin(t * 61 + i * 2.3) * Math.min(1, shake * 1.6)) : 0;
      const jy = shake > 0.45 && Math.sin(t * 47 + i * 1.7) > 0.3 ? 1 : 0;
      paintStone(g, s.x + jx, y + jy, s.w, s, shake);
    });
    // grit trickling from the joints while it shakes
    if (shake > 0.05) for (let i = 0; i < 3; i++) {
      const ph = (t * 2.2 + i / 3) % 1, s = stones[i % stones.length];
      dot(g, s.x + s.w - 1, y + 8 + Math.floor(ph * 14), i % 2 ? PAL.u : PAL.q);
    }
    return;
  }
  // Falling apart: each stone breaks in two chunks that tumble into the pit and crumble to dust.
  const a = g.globalAlpha;
  stones.forEach((s, i) => {
    const half = Math.max(2, Math.floor(s.w / 2));
    for (let k = 0; k < 2; k++) {
      const id = i * 2 + k, dir = k ? 1 : -1;
      const fall = gone * gone * (46 + hash(id) * 30), drift = dir * gone * (2 + hash(id + 9) * 5);
      const tilt = gone > 0.25 ? Math.round(gone * 3 * dir) : 0;
      const cx = s.x + (k ? half : 0), cw = k ? s.w - half : half;
      const fade = gone > 0.55 ? (gone - 0.55) / 0.45 : 0;
      paintStone(g, Math.round(cx + drift), Math.round(y + fall), cw, s, 0, (xx, yy) => {
        // ragged break edge, a slant as it tips, then it dissolves
        if ((k ? xx === 0 : xx === cw - 1) && (yy + id) % 3 === 0) return false;
        if (tilt && (k ? cw - 1 - xx : xx) < Math.abs(tilt) - (yy >> 1)) return false;
        return bayer(xx + id * 3, yy + id) >= fade;
      });
    }
    // pebbles
    for (let k = 0; k < 2; k++) {
      const id = i * 5 + k;
      const fx = s.x + Math.floor(hash(id + 3) * s.w), fy = y + 4 + gone * gone * (70 + hash(id) * 40);
      g.globalAlpha = a * (1 - gone);
      fill(g, fx, fy, 1 + (k & 1), 1 + (k & 1), k ? PAL.q : PAL.u);
    }
  });
  // a puff of dust where it was
  if (gone < 0.6) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const dx = (hash(i * 4.1) - 0.5) * (x1 - x0 + 8) * (0.6 + gone), dy = 4 - gone * 10 * hash(i * 2.3) + Math.sin(i) * 2;
      g.globalAlpha = a * (0.6 - gone) * 0.9;
      dot(g, (x0 + x1) / 2 + dx, y + dy, i % 2 ? '#8a7f95' : '#6a6078');
    }
  }
  g.globalAlpha = a;
}

// ---- lights ---------------------------------------------------------------------------------------
// Light descriptors in VIEW pixels for the castle's live flames: { x, y, r, color, i, ... }.
// state: { props, hazards } straight from the snapshot (world units). Props keep their looks in
// p.look (lit, open, glow, broke); positions are body centres (the surface is at y + h / 2).
export function castleLights(state = {}, t = 0) {
  const out = [];
  const props = state.props || [], hz = state.hazards || {};
  const flick = (seed, k = 0.08) => 1 - k + Math.sin(t * 19 + seed * 7.3) * k * 0.6 + Math.sin(t * 31 + seed * 3.1) * k * 0.4;
  const foot = p => p.y + (p.h ? p.h / 2 : 0);
  for (const p of props) {
    const look = p.look || p;
    if (p.kind === 'candle' && (look.lit ?? p.lit)) {
      const x = X(p.x), y = X(foot(p)) - 15;
      out.push({ x, y, r: 64, color: '#ffb060', i: 0.78 * flick(p.x), occlude: true });
      out.push({ x, y: y + 1, r: 14, color: '#ffe0a0', i: 0.55 * flick(p.x + 1, 0.15), noRim: true });
    } else if (p.kind === 'chandelier' && (look.lit ?? p.lit)) {
      const a = p.angle || 0, h = (p.h || 27) / 2;
      const x = X(p.x - Math.sin(a) * h * 0.2), y = X(p.y - Math.cos(a) * h * 0.4);
      out.push({ x, y, r: 130, color: '#ffc070', i: 0.85 * flick(3.3, 0.06) });
      out.push({ x, y: y - 2, r: 30, color: '#ffe0a8', i: 0.6 * flick(4.1, 0.12), noRim: true });
    } else if (p.kind === 'chest' && (look.open ?? p.open)) {
      out.push({ x: X(p.x), y: X(foot(p)) - 9, r: 54, color: '#ffd060', i: 0.7 + Math.sin(t * 4) * 0.15, occlude: true });
    } else if (p.kind === 'gargoyle') {
      const glow = Math.max(look.glow || 0, hz.gargoyle?.glow || 0);
      if (glow > 0.03) out.push({ x: X(p.x) - 2, y: X(p.y) - 1, r: 20 + glow * 26, color: '#ff3a3a', i: glow * (0.75 + Math.sin(t * 17) * 0.15), noRim: glow < 0.4 });
    } else if (p.kind === 'roast') {
      out.push({ x: X(p.x), y: X(foot(p)) - 6, r: 12, color: '#ffd8a0', i: 0.25, noRim: true });
    }
  }
  // The torch in the hidden room: dim behind the closed door, it spills out as the slab rises.
  const open = hz.door?.open ?? 0;
  out.push({ x: HIDDEN_TORCH.x, y: HIDDEN_TORCH.y - 6, r: 72, color: '#ffb060', i: (0.35 + open * 0.55) * flick(9.1), occlude: true });
  return out;
}
