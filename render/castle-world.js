// Castle arena art ("Castelo — Salão do Relógio"): a gothic clock hall at midnight, painted by code on
// the 640x360 grid. Same contract as World in render/world.js: the static layers wall, back, solids,
// fronts and fg, drawBackground (the night seen through the windows) and drawClock (the great clock's
// hands and works). The geometry mirrors CASTLE in sim/map.js in view pixels (world units * 2/3).
import { VIEW_W, VIEW_H, seeded, bayer } from '../engine/const.js';
import { hexToRgb } from '../engine/palette.js';

const MARGIN = 24;
// The moon windows (view pixels), the same numbers as CASTLE.windows: the lighting casts shafts from them.
export const WINDOWS = [{ x: 22, y: 18, w: 56, h: 120 }, { x: 178, y: 26, w: 46, h: 96 }, { x: 416, y: 26, w: 46, h: 96 }, { x: 562, y: 18, w: 56, h: 120 }];
export const CLOCK = { x: 320, y: 46, r: 34 };

// ---- geometry (view pixels) -------------------------------------------------------------------
const FLOOR_Y = 328;
const PIT = { x0: 288, x1: 352 };
const TOWERS = [{ x0: 0, x1: 100, y0: 160, y1: 200, side: -1 }, { x0: 540, x1: 640, y0: 160, y1: 200, side: 1 }];
const ROOF = { x0: 540, x1: 640, y0: 78, y1: 100 };
const ROOM = { x0: 556, x1: 640, y0: 100, y1: 160 };
const DOOR = { x0: 540, x1: 556 };
const BALCONIES = [{ x0: 104, x1: 224, y: 248, ladder: 124 }, { x0: 416, x1: 536, y: 248, ladder: 516 }];
const BRIDGES = [{ x0: 230, x1: 292, y: 168 }, { x0: 348, x1: 410, y: 168 }];
const GALLERY = { x0: 160, x1: 480, y: 90 };
const PH = 8; // one-way platform thickness
const LADDERS = [{ x: 124, top: 248, bottom: 328 }, { x: 516, top: 248, bottom: 328 }];
const PIVOTS = [164, 476]; // pendulum pivots, at the gallery underside (y 98)
const HOOK_X = 320; // the chandelier's chain hangs from here
const ALCOVE = { x0: 0, x1: 36, y0: 280, y1: 328 }; // the alcove (0..20) and the cracked wall in front of it (20..36)
const GLASS_X = 100;
const PIERS = [243, 397]; // the great arch's piers flanking the clock bay
const PILLARS = [128, 512];
const ARCH = { x0: 250, x1: 390, spring: 200 };
const START = (11 * 60 + 45) * 60; // the clock reads a quarter to midnight when the match starts

// ---- palettes ------------------------------------------------------------------------------
const WALL = { mortar: '#120e1d', shadow: '#1b1530', f: ['#221b37', '#261f3c', '#2a2241', '#2e2646', '#322a4b'], hi: '#3a315a', spec: '#332b50' };
const LOW = { mortar: '#110d1b', shadow: '#1c1631', f: ['#241d39', '#28203e', '#2c2443', '#302848', '#342c4d'], hi: '#3e365f', spec: '#373054' };
const PLAY = { mortar: '#191426', shadow: '#272139', f: ['#363049', '#39324f', '#3d3554', '#423a5a', '#463e5f'], hi: '#51486d', spec: '#5d5479' };
const PLAY_TOP = ['#d2c9e6', '#a59cc2', '#7d749b', '#5f5680'];
const COLUMN = ['#120e1c', '#201a35', '#2d2645', '#393056', '#453c66', '#514670', '#453c66', '#393056', '#312a4c', '#292242', '#211b37', '#19142a', '#120e1c'];
const BK = { ink: '#0d0a15', d: '#1a1530', m: '#29223f', m2: '#332b4d', l: '#463d66', l2: '#5c5282', l3: '#776d9c' };
const VELVET = ['#1c0510', '#35091a', '#541225', '#771b31', '#9a2b3f', '#b84452'];
const GOLD = ['#3a2412', '#6e4520', '#a8702e', '#d9a548', '#f6d27a', '#fff0b8'];
const IRON = ['#0b0912', '#16121f', '#221d31', '#332c48', '#4c4466', '#6f6890', '#9d97ba'];
const WOOD = ['#24161a', '#3a2224', '#5e3830', '#87553c', '#b07b4f', '#d6a46c'];
const CREAM = ['#5c5044', '#8a7c68', '#b4a588', '#d6c9a8', '#ece2c6', '#fbf5e2'];
const BONE = ['#3e3440', '#6e6264', '#a8957c', '#d8c9a8', '#f2e8cf'];
const FIRE = ['#fff6c4', '#ffd25c', '#ff9a35', '#e3532d', '#97302e'];
const IVY = ['#0c1414', '#132321', '#1b3330', '#28473f', '#3a5f50'];

// ---- pixel buffer helpers --------------------------------------------------------------------
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const RGB = new Map();
const C = c => { if (typeof c !== 'string') return c; let v = RGB.get(c); if (!v) { v = hexToRgb(c); RGB.set(c, v); } return v; };
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const TAU = Math.PI * 2;
const mixDark = hex => { const [r, g, b] = C(hex); return '#' + [r, g, b].map(v => Math.round(v * 0.6).toString(16).padStart(2, '0')).join(''); };

class Pix {
  constructor(w = VIEW_W, h = VIEW_H) {
    this.w = w; this.h = h;
    this.c = mk(w, h); this.g = this.c.getContext('2d');
    this.id = this.g.createImageData(w, h); this.D = this.id.data;
  }
  set(x, y, col, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const D = this.D, i = (y * this.w + x) * 4, c = C(col);
    if (a >= 255) { D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; return; }
    const t = a / 255, ia = D[i + 3] / 255, oa = t + ia * (1 - t);
    if (oa <= 0) return;
    D[i] = (c[0] * t + D[i] * ia * (1 - t)) / oa;
    D[i + 1] = (c[1] * t + D[i + 1] * ia * (1 - t)) / oa;
    D[i + 2] = (c[2] * t + D[i + 2] * ia * (1 - t)) / oa;
    D[i + 3] = oa * 255;
  }
  alpha(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.D[(y * this.w + x) * 4 + 3]; }
  erase(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.D[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, col, a) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, col, a); }
  shade(x, y, k) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const D = this.D, i = (y * this.w + x) * 4;
    D[i] *= k; D[i + 1] *= k; D[i + 2] *= Math.min(1, k * 1.04);
  }
  line(x0, y0, x1, y1, col, a) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
      this.set(x0, y0, col, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // Draws rows of a little bitmap: '.' is clear, other characters index into cols.
  sprite(x, y, rows, cols) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const k = r[i]; if (k !== '.' && cols[k]) this.set(x + i, y + j, cols[k]); } });
  }
  done() { this.g.putImageData(this.id, 0, 0); return this.c; }
}

function ditherV(p, x0, y0, w, h, stops) {
  const rs = stops.map(([t, c]) => [t, C(c)]);
  for (let y = y0; y < y0 + h; y++) {
    const t = (y - y0) / h;
    let a = rs[rs.length - 1][1], b = a, f = 0;
    for (let i = 0; i < rs.length - 1; i++) if (t <= rs[i + 1][0]) { a = rs[i][1]; b = rs[i + 1][1]; f = (t - rs[i][0]) / (rs[i + 1][0] - rs[i][0] || 1); break; }
    for (let x = x0; x < x0 + w; x++) p.set(x, y, bayer(x, y) < f ? b : a);
  }
}

// One dressed stone: 1px mortar bottom/right, lit top/left edge, darker lower rows, a few specks.
function stone(p, bx, by, bw, bh, pal, rnd, cx0 = 0, cx1 = p.w) {
  const n = Math.sin(bx * 0.021 + by * 0.013) + Math.sin(bx * 0.007 - by * 0.031 + 2) + rnd() * 1.6 - 0.8;
  const face = pal.f[Math.max(0, Math.min(pal.f.length - 1, Math.floor((n + 2) / 4 * pal.f.length)))], chip = rnd();
  for (let y = by; y < by + bh; y++) for (let x = Math.max(bx, cx0); x < Math.min(bx + bw, cx1); x++) {
    const lx = x - bx, ly = y - by;
    let col = face;
    if (ly === bh - 1 || lx === bw - 1) col = pal.mortar;
    else if (ly === 0 || lx === 0) col = ly === 0 && lx === 0 ? pal.spec : pal.hi;
    else if (ly === bh - 2 || lx === bw - 2) col = pal.shadow;
    else if (ly >= bh - 4 && bayer(x, y) < 0.25) col = pal.shadow;
    p.set(x, y, col);
  }
  const inX = x => x >= cx0 && x < cx1;
  if (chip < 0.22) for (const [dx, dy] of [[2, 2], [3, 2], [2, 3]]) { if (inX(bx + bw - dx)) p.set(bx + bw - dx, by + bh - dy, pal.mortar); }
  else if (chip > 0.86) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) { if (inX(bx + dx)) p.set(bx + dx, by + dy, pal.mortar); }
  const specks = (bw * bh) / 30 | 0;
  for (let i = 0; i < specks; i++) {
    const x = bx + 2 + Math.floor(rnd() * Math.max(1, bw - 4)), y = by + 2 + Math.floor(rnd() * Math.max(1, bh - 4));
    if (inX(x)) p.set(x, y, rnd() < 0.6 ? pal.shadow : pal.spec);
  }
  // A hairline crack now and then.
  if (rnd() < 0.08 && bw > 12) {
    let x = bx + 3 + Math.floor(rnd() * (bw - 6)), y = by + 1;
    while (y < by + bh - 2) { if (inX(x)) p.set(x, y, pal.mortar); y++; if (rnd() < 0.5) x += rnd() < 0.5 ? -1 : 1; }
  }
}

function masonry(p, x0, y0, x1, y1, ch, wmin, wmax, pal, seed) {
  const rnd = seeded(seed);
  for (let y = y0; y < y1; y += ch) {
    let x = x0 - Math.floor(rnd() * wmax);
    while (x < x1) { const bw = wmin + Math.floor(rnd() * (wmax - wmin)); stone(p, x, y, bw, Math.min(ch, y1 - y), pal, rnd, x0, x1); x += bw; }
  }
}

// A round column: shading across the width, drum joints, optional capital and base.
function column(p, cx, w, y0, y1, ramp = COLUMN, { capital = true, base = true, joints = 26, capH = 6, baseH = 6 } = {}) {
  const x0 = cx - (w >> 1);
  const at = lx => ramp[Math.round(lx / (w - 1) * (ramp.length - 1))];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x0 + w; x++) {
    const lx = x - x0;
    let col = at(lx);
    const j = (y - y0) % joints;
    if (j === 0 && y > y0 + capH) col = ramp[Math.max(0, ramp.indexOf(col) - 3)];
    else if (j === 1 && y > y0 + capH && lx > 1 && lx < w - 2) col = ramp[Math.min(ramp.length - 1, Math.max(0, ramp.indexOf(col) + 1))];
    p.set(x, y, col);
  }
  const block = (yy, hh, ww) => {
    const bx = cx - (ww >> 1);
    for (let y = yy; y < yy + hh; y++) for (let x = bx; x < bx + ww; x++) {
      const ly = y - yy, lx = x - bx;
      let col = BK.m2;
      if (ly === 0) col = BK.l2; else if (ly === hh - 1) col = BK.ink; else if (lx === 0) col = BK.l; else if (lx === ww - 1) col = BK.d;
      else if (ly === 1) col = BK.l;
      p.set(x, y, col);
    }
  };
  if (capital) { block(y0, Math.ceil(capH / 2), w + 6); block(y0 + Math.ceil(capH / 2), capH >> 1, w + 3); }
  if (base) { block(y1 - baseH, baseH >> 1, w + 3); block(y1 - (baseH >> 1), baseH >> 1, w + 6); }
}

// Pointed (two-centred) arch over a rectangle; k grows it outward by k pixels.
function archShape(win, k = 0, sharp = 1.5) {
  const a = win.w / 2, r = a * sharp, spring = win.y + Math.sqrt(r * r - (r - a) * (r - a));
  const cl = win.x + r, cr = win.x + win.w - r, xm = win.x + a, bottom = win.y + win.h;
  const f = (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (px < win.x - k || px > win.x + win.w + k || py > bottom + k) return false;
    if (py >= spring) return true;
    return Math.hypot(px - (px < xm ? cl : cr), py - spring) <= r + k;
  };
  f.spring = spring; f.xm = xm;
  return f;
}

// A gossamer cobweb in a corner: radial threads and sagging rings (dx, dy: direction into the room).
function cobweb(p, x, y, size, dx, dy, col = '#8a84ac', a = 120) {
  const rays = 5;
  for (let r = 0; r < rays; r++) {
    const ang = (r / (rays - 1)) * Math.PI / 2;
    const ex = Math.cos(ang) * size, ey = Math.sin(ang) * size;
    p.line(x, y, x + dx * ex, y + dy * ey, col, a * 0.8);
  }
  for (let ring = 1; ring <= 3; ring++) {
    const rr = size * ring / 3.4;
    for (let s = 0; s <= 24; s++) {
      const ang = (s / 24) * Math.PI / 2, sag = Math.sin((s % 6) / 6 * Math.PI) * ring * 0.6;
      const px = x + dx * (Math.cos(ang) * rr - sag * 0.5), py = y + dy * (Math.sin(ang) * rr - sag * 0.5);
      if (bayer(Math.round(px), Math.round(py)) < 0.8) p.set(px, py, col, a * 0.7);
    }
  }
}

// ---- the back wall -----------------------------------------------------------------------------
function paintWindow(p, win) {
  const inside = archShape(win);
  const rings = [1, 2, 3, 4, 5, 6, 7].map(k => archShape(win, k));
  const litCol = ['#06040c', '#61578c', '#4a4170', '#383055', '#2c2546', '#3a3156', '#110d1b'];
  const darkCol = ['#06040c', '#463d68', '#352d50', '#2a2342', '#231d3a', '#2f2848', '#0d0a15'];
  const xm = inside.xm;
  for (let y = win.y - 9; y < win.y + win.h + 2; y++) for (let x = win.x - 9; x < win.x + win.w + 9; x++) {
    if (inside(x, y)) continue;
    for (let k = 0; k < rings.length; k++) if (rings[k](x, y)) { p.set(x, y, (x < xm ? litCol : darkCol)[k]); break; }
  }
  // Tracery: two lancets under a plate head pierced by a stained-glass oculus.
  const a = win.w / 2, mull = Math.round(xm) - 1;
  const lw = mull - win.x, lancets = [{ x: win.x, w: lw }, { x: mull + 2, w: win.x + win.w - mull - 2 }];
  const lsp = inside.spring + 7;
  const lshape = lancets.map(l => archShape({ x: l.x, y: lsp - Math.sqrt((l.w * 0.75) ** 2 - (l.w * 0.25) ** 2), w: l.w, h: win.y + win.h - lsp + Math.sqrt((l.w * 0.75) ** 2 - (l.w * 0.25) ** 2) }));
  const lApex = lsp - Math.sqrt((lw * 0.75) ** 2 - (lw * 0.25) ** 2);
  const oy = (win.y + lApex) / 2 + 1, ro = Math.max(5, Math.min(a * 0.42, (lApex - win.y) / 2 - 1));
  const glassA = ['#c0303f', '#2f56b0', '#c0303f', '#2f56b0'];
  const type = new Map();
  const key = (x, y) => y * 1000 + x;
  for (let y = win.y; y < win.y + win.h; y++) for (let x = win.x; x < win.x + win.w; x++) {
    if (!inside(x, y)) continue;
    let tp = 'stone';
    if (x === mull || x === mull + 1) tp = 'mull';
    else {
      const li = x < mull ? 0 : 1;
      if (lshape[li](x, y)) {
        const l = lancets[li], lx = x - l.x;
        tp = 'open';
        const cxl = l.x + l.w / 2 - 0.5, dia = Math.abs(x - cxl) + Math.abs(y - (lApex + 8));
        if (dia <= 3) tp = dia > 2.2 ? 'lead' : li ? 'glassB' : 'glassA';
        if ((y - lsp) % 15 === 14 || y === lsp) tp = 'lead';
        if (lx === Math.floor(l.w / 2) && y > lsp) tp = 'lead';
      } else {
        const d = Math.hypot(x + 0.5 - (mull + 1), y + 0.5 - oy);
        if (d < ro) {
          const dx = x + 0.5 - (mull + 1), dy = y + 0.5 - oy;
          if (d >= ro - 1 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.6) tp = 'lead';
          else if (d < 2) tp = 'gold';
          else tp = Math.abs(dy) > Math.abs(dx) ? 'red' : 'blue';
        }
      }
    }
    type.set(key(x, y), tp);
  }
  const isOpen = (x, y) => { const t = type.get(key(x, y)); return t && t !== 'stone' && t !== 'mull'; };
  for (const [k, tp] of type) {
    const x = k % 1000, y = Math.floor(k / 1000);
    if (tp === 'open') { p.erase(x, y); continue; }
    if (tp === 'stone') {
      let col = '#2a2342';
      if (isOpen(x, y + 1) || isOpen(x + 1, y)) col = '#0f0b18';
      else if (isOpen(x, y - 1) || isOpen(x - 1, y)) col = '#5a5084';
      else if (bayer(x, y) < 0.18) col = '#241e3a';
      p.set(x, y, col);
    } else if (tp === 'mull') p.set(x, y, x === mull ? '#564c7e' : '#1a152b');
    else if (tp === 'lead') p.set(x, y, '#0c0914');
    else {
      p.erase(x, y);
      const col = { glassA: '#9a2236', glassB: '#24459a', red: '#a82236', blue: '#22449e', gold: '#e8b850' }[tp];
      p.set(x, y, col, tp === 'gold' ? 220 : 165);
    }
  }
  // Sill.
  const sy = win.y + win.h;
  for (let x = win.x - 8; x < win.x + win.w + 8; x++) {
    const e = x === win.x - 8 || x === win.x + win.w + 7;
    p.set(x, sy, e ? '#4a4170' : '#6a6094'); p.set(x, sy + 1, '#463d68'); p.set(x, sy + 2, '#2e2748'); p.set(x, sy + 3, '#100c19');
    if (bayer(x, sy + 4) < 0.5) p.set(x, sy + 4, '#0f0b18');
  }
}

function paintClockFace(p) {
  const { x: cx, y: cy, r: R } = CLOCK;
  // A carved stone roundel holds the face; the bronze rim and an ivory chapter ring sit inside it.
  for (let y = cy - R - 12; y <= cy + R + 12; y++) for (let x = cx - R - 12; x <= cx + R + 12; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), lit = (-dx * 0.6 - dy * 0.8) / (d || 1);
    if (d > R + 10.5) continue;
    let col = null;
    if (d > R + 9.5) col = '#0c0916';
    else if (d > R + 4.5) {
      // Stone voussoirs around the rim.
      const ang = Math.atan2(dy, dx), seg = ((ang / TAU) * 28 + 28) % 1;
      col = d > R + 8.5 ? '#3c345a' : d < R + 5.5 ? '#120e1c' : lit > 0.25 ? '#3a3257' : lit < -0.35 ? '#241e39' : '#2e2748';
      if (seg < 0.07) col = '#130f1f';
    } else if (d > R + 3.5) col = GOLD[0];
    else if (d > R + 0.5) {
      const b = d - R;
      col = b > 2.5 ? (lit > 0 ? GOLD[3] : GOLD[2]) : b > 1.5 ? (lit > 0.3 ? GOLD[5] : lit > -0.4 ? GOLD[4] : GOLD[3]) : (lit > 0 ? GOLD[3] : GOLD[1]);
    } else if (d > R - 0.5) col = GOLD[0];
    else if (d > 21.5) {
      col = CREAM[4];
      if (d > R - 1.5 || d < 22.5) col = CREAM[2];
      else if (bayer(x, y) < 0.12 + Math.max(0, -lit) * 0.2) col = CREAM[3];
      if (lit > 0.6 && d > 30 && bayer(x, y) < 0.3) col = CREAM[5];
    } else if (d > 20.5) col = GOLD[2];
    else col = d > 19.5 ? '#0d0a16' : '#171324';
    if (col) p.set(x, y, col);
  }
  // Minute track and hour marks.
  for (let m = 0; m < 60; m++) {
    const ang = (m / 60) * TAU, s = Math.sin(ang), c = -Math.cos(ang);
    const rr = R - 2.6;
    p.set(Math.round(cx + s * rr), Math.round(cy + c * rr), m % 5 === 0 ? '#1a1220' : CREAM[1]);
    if (m % 5 === 0) p.set(Math.round(cx + s * (rr - 1)), Math.round(cy + c * (rr - 1)), '#1a1220');
  }
  // Roman numerals (upright, 4px tall).
  const G = { I: ['#', '#', '#', '#'], V: ['#.#', '#.#', '#.#', '.#.'], X: ['#.#', '.#.', '.#.', '#.#'] };
  const NUM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  NUM.forEach((n, h) => {
    const ang = (h / 12) * TAU, w = [...n].reduce((s, ch) => s + G[ch][0].length + 1, -1);
    const rr = h % 3 === 0 ? 26 : 26.5;
    const nx = Math.round(cx + Math.sin(ang) * rr - w / 2 + 0.01), ny = Math.round(cy - Math.cos(ang) * rr - 2);
    let ox = 0;
    for (const ch of n) { p.sprite(nx + ox, ny, G[ch], { '#': '#2a1a26' }); ox += G[ch][0].length + 1; }
  });
  // Ornaments on the rim: studs at the hours, spikes at the quarters, a crescent crest on top.
  for (let h = 0; h < 12; h++) {
    const ang = (h / 12) * TAU, s = Math.sin(ang), c = -Math.cos(ang);
    if (h % 3) { const x = Math.round(cx + s * (R + 7)), y = Math.round(cy + c * (R + 7)); p.set(x, y, GOLD[4]); p.set(x + 1, y, GOLD[2]); p.set(x, y + 1, GOLD[2]); p.set(x + 1, y + 1, GOLD[1]); continue; }
    for (let k = 0; k < 7; k++) {
      const rr = R + 4 + k, half = Math.max(0, 2.5 - k * 0.45);
      for (let q = -Math.ceil(half); q <= Math.ceil(half); q++) {
        if (Math.abs(q) > half) continue;
        const x = Math.round(cx + s * rr + c * q * -1), y = Math.round(cy + c * rr + s * q);
        p.set(x, y, q < 0 ? GOLD[4] : q > 0 ? GOLD[2] : GOLD[3]);
      }
    }
  }
  p.sprite(cx - 4, cy - R - 17, ['.##...##.', '##.....##', '#.......#', '##.....##', '.##...##.', '..#####..'], { '#': GOLD[3] });
  p.sprite(cx - 1, cy - R - 13, ['.#.', '###', '.#.'], { '#': GOLD[5] });
}

function banner(p, cx, y0, h, emblem) {
  const w = 20, x0 = cx - w / 2, mid = (w - 1) / 2, tail = 9;
  // Rod with finials.
  for (let x = x0 - 4; x < x0 + w + 4; x++) { p.set(x, y0 - 3, GOLD[4]); p.set(x, y0 - 2, GOLD[2]); p.set(x, y0 - 1, GOLD[0]); }
  for (const fx of [x0 - 6, x0 + w + 3]) p.sprite(fx, y0 - 5, ['.#.', '###', '###', '.#.'], { '#': GOLD[3] });
  const cut = (lx, ly) => { const k = ly - (h - tail); return k >= 0 && Math.abs(lx - mid) < (k + 1) * (mid / tail); };
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const lx = x - x0, ly = y - y0;
    if (cut(lx, ly)) continue;
    // Folds: light crests and shadowed valleys across the width.
    const fold = Math.sin(lx / (w - 1) * Math.PI * 2.5 + 0.6 + ly * 0.012);
    let col = fold > 0.55 ? VELVET[4] : fold > 0 ? VELVET[3] : fold > -0.6 ? VELVET[2] : VELVET[1];
    if (fold > 0.85 && bayer(x, y) < 0.35) col = VELVET[5];
    if (lx === 0 || lx === w - 1) col = GOLD[2];
    else if (lx === 1 || lx === w - 2) col = VELVET[0];
    if ((ly === 3 || ly === 7) && lx > 0 && lx < w - 1) col = GOLD[3];
    if (ly < 2) col = VELVET[1];
    if (cut(lx, ly + 1) || cut(lx - 1, ly) || cut(lx + 1, ly)) col = lx % 2 ? GOLD[3] : GOLD[2];
    p.set(x, y, col);
  }
  if (emblem === 'hourglass') p.sprite(Math.round(cx - 4), y0 + 14, ['#######', '.#ooo#.', '..#o#..', '...#...', '..#.#..', '.#.o.#.', '#ooooo#', '#######'], { '#': GOLD[4], o: GOLD[2] });
  else p.sprite(Math.round(cx - 5), y0 + 15, ['#.......#', '##.#.#.##', '#########', '.#######.', '..#.#.#..'], { '#': GOLD[3] });
}

function greatArch(p) {
  const { x0, x1, spring: sp } = ARCH;
  const a = (x1 - x0) / 2, r = a * 1.15;
  const cl = x0 + r, cr = x1 - r, xm = (x0 + x1) / 2;
  // Signed distance-ish to the opening (negative inside), in continuous coordinates.
  const inner = (px, py) => {
    if (px < x0 || px > x1 || py > FLOOR_Y) return 99;
    if (py >= sp) return -Math.min(px - x0, x1 - px);
    return Math.hypot(px - (px < xm ? cl : cr), py - sp) - r;
  };
  // The recess is a vaulted passage: transverse arches recede toward a vanishing point.
  const V = { x: xm, y: 236 }, SC = [1, 0.8, 0.64, 0.51, 0.41, 0.33];
  const inS = (px, py, k) => inner(V.x + (px - V.x) / k, V.y + (py - V.y) / k) <= 0;
  const WALLC = ['#18131f', '#141019', '#100d16', '#0d0a12', '#0a080f', '#07050b'];
  const FLOORC = ['#231d31', '#1e192b', '#191524', '#15111e', '#110e19', '#0c0a12'];
  const RIB = ['#332b4a', '#2b2540', '#241f36', '#1e1a2d', '#181524'];
  for (let y = 100; y < FLOOR_Y; y++) for (let x = x0 - 12; x < x1 + 12; x++) {
    const px = x + 0.5, py = y + 0.5;
    const d = inner(px, py);
    if (d <= 0) {
      let k = 0;
      while (k + 1 < SC.length && inS(px, py, SC[k + 1])) k++;
      const base = V.y + (FLOOR_Y - V.y) * (SC[k + 1] || SC[k] * 0.8);
      let col = WALLC[k];
      if (py > base) {
        // Floor of the passage: flagstones in perspective.
        col = FLOORC[k];
        const u = (px - V.x) / (py - V.y) * (FLOOR_Y - V.y);
        if (Math.abs(((u % 18) + 18) % 18 - 9) > 8.2) col = WALLC[Math.min(5, k + 1)];
        if (py - base < 1) col = WALLC[Math.min(5, k + 1)];
      } else if (k + 1 < SC.length && k < RIB.length && !inS(px, py, SC[k] * 0.94) && k > 0) {
        // The face of a transverse rib: lit edge, then stone.
        col = inS(px, py, SC[k] * 0.985) ? RIB[k] : '#3c3456';
        if (!inS(px, py, SC[k] * 0.955) && inS(px, py, SC[k] * 0.985)) col = mixDark(RIB[k]);
      } else if (bayer(x, y) < 0.5 && k < 5 && inS(px, py, SC[k + 1] * 1.03)) col = WALLC[Math.min(5, k + 1)];
      // Shadow under the outer arch.
      if (d > -3 && py < sp) col = '#07050c';
      else if (d > -6 && py < sp && bayer(x, y) < 0.5) col = '#0a0711';
      p.set(x, y, col);
      continue;
    }
    if (py >= sp) continue;
    const dl = Math.hypot(px - (px < xm ? cl : cr), py - sp) - r;
    if (dl < 0 || dl > 10) continue;
    if (px < x0 - 10 || px > x1 + 10) continue;
    // Voussoirs.
    const c = px < xm ? cl : cr;
    const ang = Math.atan2(sp - py, px < xm ? c - px : px - c);
    const sv = ang * (r + 5), seg = sv / 11 - Math.floor(sv / 11);
    let col = dl < 1 ? '#0b0814' : dl < 2 ? '#4b4270' : dl > 9 ? '#0f0b18' : dl < 4 ? '#382f56' : '#2e2748';
    if (seg < 0.1 && dl > 1) col = '#120e1c';
    if (px > xm - 7 && px < xm + 7) col = dl < 1 ? '#0b0814' : dl > 9 ? '#0f0b18' : Math.abs(px - xm) > 6 ? '#120e1c' : dl < 2 ? '#5a5084' : '#3a3258';
    p.set(x, y, col);
  }
  // Keystone with a carved skull.
  const ky = Math.round(sp - Math.sqrt(r * r - (xm - cl) * (xm - cl))) - 12;
  for (let y = ky; y < ky + 4; y++) for (let x = Math.round(xm) - 7; x < Math.round(xm) + 7; x++) p.set(x, y, y === ky ? '#5a5084' : x === Math.round(xm) - 7 ? '#463d68' : x === Math.round(xm) + 6 ? '#1a152b' : '#3a3258');
  p.sprite(Math.round(xm) - 4, ky + 3, ['..###..', '.#####.', '##o#o##', '##o#o##', '.##.##.', '..#.#..', '.#.#.#.'], { '#': '#8a7f8c', o: '#120c18' });
  // Piers with imposts where the arch springs.
  for (const cx of PIERS) {
    column(p, cx, 14, 0, FLOOR_Y, COLUMN, { capital: false, base: true, joints: 22, baseH: 8 });
    for (let y = sp - 8; y < sp; y++) for (let x = cx - 9; x < cx + 9; x++) {
      const ly = y - (sp - 8);
      p.set(x, y, ly === 0 ? '#61578c' : ly === 7 ? '#0d0a15' : ly < 3 ? '#41385f' : ly === 3 ? '#1a152b' : '#2e2748');
    }
    // Capitals at the top, where the vault ribs spring.
    for (let y = 8; y < 16; y++) for (let x = cx - 10; x < cx + 10; x++) {
      const ly = y - 8, half = 10 - Math.max(0, 4 - ly);
      if (Math.abs(x + 0.5 - cx) > half) continue;
      p.set(x, y, ly === 0 ? '#5a5084' : ly === 7 ? '#0d0a15' : x < cx - half + 2 ? '#463d68' : x > cx + half - 3 ? '#1a152b' : '#2e2748');
    }
  }
}

// Pointed vault ribs springing from a capital at (x, y) toward both sides.
function ribs(p, cx, y, span, dirs = [-1, 1]) {
  for (const dir of dirs) {
    const r = span * 0.9;
    const ccx = cx + dir * r, ccy = y;
    for (let yy = -6; yy < y; yy++) for (let xx = Math.min(cx, ccx) - 2; xx <= Math.max(cx, ccx) + 2; xx++) {
      const d = Math.hypot(xx + 0.5 - ccx, yy + 0.5 - ccy) - r;
      if (d < -5 || d > 0) continue;
      if ((xx - cx) * dir < -1) continue;
      p.set(xx, yy, d > -1 ? '#0d0a15' : d > -2 ? '#2a2342' : d > -4 ? '#3c3459' : '#130f1f');
    }
  }
}

// A heater shield, quartered red and blue under a gold rim, hung from a ring.
function shield(p, cx, y0) {
  const w = 24, h = 28, x0 = cx - w / 2;
  for (let y = y0; y < y0 + h; y++) {
    const ly = y - y0, t = ly / (h - 1);
    const half = t < 0.42 ? w / 2 : (w / 2) * Math.sqrt(Math.max(0, 1 - ((t - 0.42) / 0.58) ** 1.6));
    for (let x = x0; x < x0 + w; x++) {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > half) continue;
      const edge = half - Math.abs(dx), top = ly;
      let col;
      if (edge < 1 || top < 1 || (t > 0.95)) col = GOLD[0];
      else if (edge < 2.2 || top < 2) col = dx < 0 ? GOLD[4] : GOLD[2];
      else if (Math.abs(dx) < 1.5 || Math.abs(ly - 11) < 1) col = GOLD[3];
      else {
        const q = (dx < 0) === (ly < 11);
        col = q ? (bayer(x, y) < 0.15 ? VELVET[4] : VELVET[3]) : (bayer(x, y) < 0.15 ? '#3a4c9a' : '#2a3a80');
        if (edge < 3.5) col = q ? VELVET[2] : '#1e2a62';
      }
      p.set(x, y, col);
    }
  }
  // A gold bat over the cross, and the hanging ring.
  p.sprite(cx - 6, y0 + 8, ['#.........#', '##..#.#..##', '###.###.###', '.#########.', '..##.#.##..', '...#...#...'], { '#': GOLD[4] });
  p.sprite(cx - 2, y0 - 5, ['.###.', '#...#', '#...#', '.###.', '..#..'], { '#': IRON[4] });
}

// A gilded frame around an oil portrait: Lola, the white rabbit of the clock, under the full moon.
function portrait(p, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const lx = x - x0, ly = y - y0, e = Math.min(lx, ly, w - 1 - lx, h - 1 - ly);
    let col;
    if (e === 0) col = GOLD[0];
    else if (e === 1) col = lx === 1 || ly === 1 ? GOLD[4] : GOLD[2];
    else if (e === 2) col = (lx + ly) % 4 === 0 ? GOLD[4] : GOLD[3];
    else if (e === 3) col = GOLD[1];
    else {
      const t = (ly - 4) / (h - 8);
      col = bayer(x, y) < t * 1.2 ? '#1c1638' : '#2c2658';
      const mx = x0 + w - 8.5, my = y0 + 9.5, md = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (md < 3.6) col = md < 2.8 ? '#e8dcb8' : '#a89c8a';
      else if (md < 6 && bayer(x, y) < 0.4) col = '#3e3870';
    }
    p.set(x, y, col);
  }
  p.sprite(x0 + 5, y0 + 5, [
    '...wwp..wwp.......',
    '...wpw..wpw.......',
    '...wpw..wpw.......',
    '...wpw..wpw.......',
    '...wpw.wpw........',
    '..BbbwBbww........',
    '.bbbbBBbbbb.......',
    '..bb.wwwwbb.......',
    '....wwwwwwww......',
    '...wwwwwwwwww.....',
    '...wwwwwwwKKww....',
    '..swwwwwwwKKwwn...',
    '..swwwwwwwwwkww...',
    '...sswwwwwwwww....',
    '.....sswwwws......',
    '.......wwww.......',
    '.....dRRRRRd......',
    '...dddWWWWWddd....',
    '..ddddWWHWWdddd...',
    '.dddddWWWWWddddd..',
    '.DddddddddddddDD..',
    'DDddddddddddddDD..',
  ], { w: '#f4ecf2', s: '#c4b0c8', p: '#f3aebf', b: '#9cd0ff', B: '#5a9af0', K: '#1a1020', n: '#e8668a', k: '#ff9db3', d: '#6aa2ee', D: '#3e64c4', W: '#ffffff', R: '#1a1020', H: '#e8405e' });
}

function paintWall() {
  const p = new Pix();
  masonry(p, 0, 0, VIEW_W, 258, 10, 16, 30, WALL, 11);
  // String course under the upper wall.
  for (let x = 0; x < VIEW_W; x++) {
    const rows = ['#0d0a15', '#4a4170', '#3a3258', '#2e2748', '#120e1c', '#2e2748', '#3a3258', '#0d0a15', '#120e1c'];
    rows.forEach((c, i) => p.set(x, 258 + i, c));
    if (x % 12 === 0) { p.set(x, 263, '#0d0a15'); p.set(x, 264, '#0d0a15'); }
  }
  // Wainscot of big ashlar and a plinth.
  masonry(p, 0, 267, VIEW_W, 316, 12, 26, 44, LOW, 12);
  for (let x = 0; x < VIEW_W; x++) {
    const rows = ['#0d0a15', '#3f3760', '#2e2748', '#262040', '#262040', '#211b37', '#211b37', '#1c1730', '#1c1730', '#171328', '#171328', '#120e1f'];
    rows.forEach((c, i) => p.set(x, 316 + i, c));
    if (x % 40 === 0) for (let y = 318; y < 328; y++) p.set(x, y, '#0d0a15');
  }
  // Pillars with banners between the bays, ribs of the vault at the top.
  for (const cx of PILLARS) {
    column(p, cx, 14, 8, 258, COLUMN, { capital: true, base: true, joints: 26, capH: 8, baseH: 8 });
    ribs(p, cx, 9, 52);
  }
  greatArch(p);
  for (const cx of PIERS) ribs(p, cx, 9, 52, cx < 320 ? [-1] : [1]);
  // Gothic windows.
  for (const win of WINDOWS) paintWindow(p, win);
  paintClockFace(p);
  banner(p, PILLARS[0], 28, 86, 'hourglass');
  banner(p, PILLARS[1], 28, 86, 'hourglass');
  // Decor under the towers: a coat of arms on the left, Lola's portrait on the right.
  shield(p, 60, 216);
  portrait(p, 556, 206, 30, 40);
  // Cobwebs in the corners.
  cobweb(p, 0, 0, 26, 1, 1);
  cobweb(p, 639, 0, 22, -1, 1);
  cobweb(p, PIERS[0] + 7, 98, 12, 1, 1, '#8a84ac', 90);
  cobweb(p, PIERS[1] - 7, 98, 12, -1, 1, '#8a84ac', 90);
  // Ivy creeping down the left window and the right pillar.
  ivy(p, 14, 0, 70, 21);
  ivy(p, 626, 0, 54, 23);
  ivy(p, 520, 4, 36, 24);
  // Damp streaks under the window sills, moss low on the wainscot.
  const rd = seeded(61);
  for (const win of WINDOWS) for (let x = win.x - 6; x < win.x + win.w + 6; x++) {
    const len = 6 + rd() * 34;
    for (let y = win.y + win.h + 5; y < win.y + win.h + 5 + len; y++) if (bayer(x, y) < 0.55 * (1 - (y - win.y - win.h - 5) / len)) p.shade(x, y, 0.8);
  }
  for (let x = 0; x < VIEW_W; x++) {
    const m = Math.sin(x * 0.05) + Math.sin(x * 0.13 + 1) * 0.6 + Math.sin(x * 0.011 + 3) * 1.2;
    if (m < 0.8 || (x > PIERS[0] - 8 && x < PIERS[1] + 8)) continue;
    const h = Math.round((m - 0.8) * 9);
    for (let y = 315 - h; y < 316; y++) if (bayer(x, y) < 0.35 + (y - (315 - h)) / (h + 1) * 0.4 && p.alpha(x, y)) p.set(x, y, IVY[2], 150);
  }
  // Darker toward the top corners and the vault.
  const D = p.D;
  for (let y = 0; y < 250; y++) for (let x = 0; x < VIEW_W; x++) {
    const i = (y * VIEW_W + x) * 4;
    if (D[i + 3] < 250) continue;
    const side = Math.abs(x + 0.5 - 320) / 320;
    let v = clamp01(1 - y / 230) * (0.12 + 0.88 * side * side) + clamp01(1 - y / 22) * 0.45;
    const lvl = Math.min(3, Math.floor(v * 3 + bayer(x, y) * 0.999));
    if (lvl > 0) p.shade(x, y, 1 - lvl * 0.16);
  }
  return p.done();
}

function ivy(p, x, y, len, seed) {
  const rnd = seeded(seed);
  let cx = x;
  for (let yy = y; yy < y + len; yy++) {
    if (rnd() < 0.3) cx += rnd() < 0.5 ? -1 : 1;
    p.set(cx, yy, IVY[1]);
    if (rnd() < 0.45) {
      const side = rnd() < 0.5 ? -1 : 1, lx = cx + side * (1 + Math.floor(rnd() * 2));
      p.set(lx, yy, IVY[3]); p.set(lx + side, yy, IVY[2]); p.set(lx, yy + 1, IVY[2]);
      if (rnd() < 0.4) p.set(lx, yy - 1, IVY[4]);
    }
  }
}

// ---- structures behind the fighters ------------------------------------------------------------
function balustrade(p, x0, x1, top, gaps = []) {
  const h = 12, y0 = top - h;
  const gap = x => gaps.some(([a, b]) => x >= a && x < b);
  const VASE = [3, 1, 1, 3, 3, 3, 3, 1, 3];
  for (let x = x0; x < x1; x++) {
    if (gap(x)) continue;
    p.set(x, y0, BK.l3); p.set(x, y0 + 1, BK.l); p.set(x, y0 + 2, BK.d);
    p.set(x, top - 1, BK.m);
  }
  for (let bx = x0 + 4; bx < x1 - 4; bx += 7) {
    if (gap(bx) || gap(bx + 2)) continue;
    VASE.forEach((w, i) => {
      const y = y0 + 3 + i, off = (3 - w) >> 1;
      for (let k = 0; k < w; k++) p.set(bx + off + k, y, w === 1 ? BK.m2 : k === 0 ? BK.l2 : k === 2 ? BK.d : BK.l);
    });
  }
  // Newel posts at the ends and beside the gaps.
  const posts = [x0, x1 - 5];
  for (const [a, b] of gaps) posts.push(a - 5, b);
  for (const px of posts) {
    for (let y = y0 - 3; y < top; y++) for (let x = px; x < px + 5; x++) {
      const lx = x - px, ly = y - (y0 - 3);
      let col = lx === 0 ? BK.l2 : lx === 4 ? BK.ink : lx === 1 ? BK.l : BK.m2;
      if (ly === 0) col = BK.l3; else if (ly === 1 || ly === 4) col = lx === 4 ? BK.ink : BK.d;
      p.set(x, y, col);
    }
    p.set(px + 1, y0 - 5, BK.l2); p.set(px + 2, y0 - 5, BK.l); p.set(px + 3, y0 - 5, BK.m); p.set(px + 1, y0 - 4, BK.l); p.set(px + 2, y0 - 4, BK.m2); p.set(px + 3, y0 - 4, BK.d);
    p.set(px + 2, y0 - 6, BK.l2);
  }
}

function chain(p, x, y0, y1) {
  for (let y = y0; y < y1; y++) {
    const k = (y - y0) % 4;
    if (k === 0 || k === 2) { p.set(x, y, k === 0 ? IRON[5] : IRON[2]); }
    else if (k === 1) { p.set(x - 1, y, IRON[5]); p.set(x + 1, y, IRON[2]); p.set(x, y, IRON[0]); }
    else p.set(x, y, IRON[4]);
  }
}

function ladder(p, l) {
  const top = l.top - 10, bot = l.bottom;
  for (let y = top; y < bot; y++) {
    p.set(l.x - 6, y, WOOD[4]); p.set(l.x - 5, y, WOOD[2]);
    p.set(l.x + 5, y, WOOD[3]); p.set(l.x + 6, y, WOOD[1]);
    if (y % 9 === 4) { p.set(l.x - 6, y, WOOD[2]); p.set(l.x + 5, y, WOOD[2]); }
  }
  for (const x of [l.x - 6, l.x + 5]) { p.set(x, top - 1, WOOD[4]); p.set(x + 1, top - 1, WOOD[3]); }
  for (let y = top + 4; y < bot - 2; y += 7) {
    for (let x = l.x - 4; x < l.x + 5; x++) { p.set(x, y, WOOD[5]); p.set(x, y + 1, WOOD[3]); p.set(x, y + 2, WOOD[0]); }
    p.set(l.x - 4, y + 1, WOOD[1]);
  }
}

function corbel(p, x, y, w = 6, steps = 3) {
  for (let s = 0; s < steps; s++) for (let k = 0; k < 2; k++) {
    const ww = w - s * 2;
    for (let i = 0; i < ww; i++) p.set(x - (w >> 1) + s + i, y + s * 2 + k, k === 0 ? (i === 0 ? BK.l2 : BK.l) : i === ww - 1 ? BK.ink : BK.m2);
  }
  p.set(x, y + steps * 2, BK.d);
}

function balconySupport(p, b) {
  const y = b.y + PH;
  for (const cx of [b.x0 + 5, b.x1 - 6]) column(p, cx, 7, y, FLOOR_Y, ['#120e1c', '#3a3258', '#4e4472', '#41385f', '#2e2748', '#1f1934', '#120e1c'], { joints: 18, capH: 6, baseH: 6 });
  // Two shallow arches with a pendant boss between them.
  const xa = b.x0 + 11, xb = b.x1 - 11, mid = Math.round((xa + xb) / 2);
  for (const [l, r] of [[xa, mid - 2], [mid + 2, xb]]) {
    const half = (r - l) / 2, cxm = (l + r) / 2;
    for (let x = l; x < r; x++) {
      const u = (x + 0.5 - cxm) / half, ya = Math.round(y + 3 + 10 * u * u);
      for (let yy = y; yy <= ya + 2; yy++) {
        let col = BK.m;
        if (yy >= ya) col = yy === ya ? BK.l : yy === ya + 1 ? BK.m2 : BK.ink;
        else if (yy === y) col = BK.ink;
        else if (bayer(x, yy) < 0.2) col = BK.d;
        p.set(x, yy, col);
      }
    }
  }
  for (let yy = y; yy < y + 14; yy++) for (let x = mid - 2; x < mid + 2; x++) p.set(x, yy, x === mid - 2 ? BK.l : x === mid + 1 ? BK.ink : BK.m2);
  p.sprite(mid - 2, y + 14, ['####', '.##.', '.#..'], { '#': BK.l });
}

function paintBack() {
  const p = new Pix();
  // The hidden room on the right tower: dark stone, a torch and a cobweb.
  for (let y = ROOM.y0; y < ROOM.y1; y++) for (let x = DOOR.x0; x < ROOM.x1; x++) p.set(x, y, '#0c0914');
  masonry(p, ROOM.x0, ROOM.y0, ROOM.x1, ROOM.y1, 8, 12, 22, { mortar: '#09070f', shadow: '#110d1b', f: ['#191427', '#1c162b', '#1f1930'], hi: '#272040', spec: '#231c38' }, 77);
  const tx = 584, ty = 118;
  for (let y = ROOM.y0; y < ROOM.y1; y++) for (let x = ROOM.x0; x < ROOM.x1; x++) {
    const d = Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 1.2);
    const k = clamp01(1 - d / 34);
    const band = Math.floor(k * 4 + bayer(x, y) * 0.999) / 4;
    if (band > 0) p.set(x, y, band > 0.6 ? '#b0603a' : band > 0.3 ? '#7a3c34' : '#4a2632', 70 + band * 90);
  }
  // Torch sconce with a still flame (the lighting adds the glow).
  p.sprite(tx - 3, ty + 2, ['#.....#', '#######', '.#####.', '..###..', '...#...', '...#...', '..###..'], { '#': IRON[3] });
  p.sprite(tx - 2, ty - 7, ['..a..', '..a..', '.aba.', '.bcb.', 'abccb', 'bcccb', '.bcb.', '..b..'], { a: FIRE[3], b: FIRE[2], c: FIRE[1] });
  p.set(tx, ty - 2, FIRE[0]);
  cobweb(p, 639, ROOM.y0, 14, -1, 1, '#9a94b8', 110);
  // Chains and shackles on the wall, a skull on the floor.
  chain(p, 626, ROOM.y0 + 2, 128);
  p.sprite(623, 128, ['.###.', '#...#', '#...#', '.###.'], { '#': IRON[4] });
  p.sprite(560, 153, ['.###..', '#####.', '#o#o#.', '#####.', '.#.#..'], { '#': BONE[2], o: '#140d16' });
  p.set(567, 158, BONE[1]); p.set(568, 159, BONE[2]); p.set(569, 158, BONE[1]);
  // The doorway (behind the gargoyle's door): a deep jamb.
  for (let y = ROOM.y0; y < ROOM.y1; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) {
    const lx = x - DOOR.x0;
    p.set(x, y, lx < 2 ? '#1c1730' : lx < 4 ? '#120e1c' : bayer(x, y) < (lx - 4) / 14 ? '#100c19' : '#07050c');
  }
  for (let x = DOOR.x0; x < ROOM.x1; x++) { p.set(x, ROOM.y0, '#07050c'); p.set(x, ROOM.y0 + 1, bayer(x, 0) < 0.5 ? '#07050c' : '#110d1b'); }

  // The alcove behind the cracked wall: a dark niche with an empty pewter plate.
  for (let y = ALCOVE.y0; y < ALCOVE.y1; y++) for (let x = ALCOVE.x0; x < ALCOVE.x1; x++) {
    const t = (y - ALCOVE.y0) / (ALCOVE.y1 - ALCOVE.y0);
    let col = bayer(x, y) < 0.3 + t * 0.4 ? '#140f20' : '#0b0812';
    if ((y - ALCOVE.y0) % 9 === 8 || ((x + Math.floor((y - ALCOVE.y0) / 9) * 7) % 14 === 0)) col = '#08060d';
    p.set(x, y, col);
  }
  for (let x = ALCOVE.x0; x < ALCOVE.x1 + 2; x++) for (let y = ALCOVE.y0 - 7; y < ALCOVE.y0; y++) {
    const ly = y - (ALCOVE.y0 - 7);
    p.set(x, y, ly === 0 ? BK.l2 : ly === 6 ? BK.ink : x % 9 === 0 ? BK.d : ly < 3 ? BK.l : BK.m2);
  }
  // Plate niche: a small arch in the back of the alcove with a pewter plate on the floor.
  p.sprite(3, 296, ['..######..', '.#......#.', '#........#', '#........#', '#........#', '#........#', '#........#', '##########'], { '#': '#1e1830' });
  for (let y = 299; y < 304; y++) for (let x = 4; x < 12; x++) if (Math.hypot(x - 7.5, y - 301) < 3) p.set(x, y, '#000000', 120);
  p.sprite(2, 324, ['..########..', '.#aaaaaaaa#.', '#abbbbbbbba#', '.##########.'], { '#': '#4c4466', a: '#9d97ba', b: '#6f6890' });

  // Balconies: arcades under them, balustrades on top with a gap where the ladder comes up.
  for (const b of BALCONIES) {
    balconySupport(p, b);
    balustrade(p, b.x0, b.x1, b.y, [[b.ladder - 9, b.ladder + 9]]);
  }
  // The gallery: balustrade on top, corbels under it, pendulum brackets and the chandelier hook.
  balustrade(p, GALLERY.x0, GALLERY.x1, GALLERY.y);
  const gy = GALLERY.y + PH;
  const avoid = [...PIVOTS, HOOK_X, ...BRIDGES.flatMap(b => [b.x0 + 3, b.x1 - 4])];
  for (let x = GALLERY.x0 + 12; x < GALLERY.x1 - 8; x += 16) if (!avoid.some(a => Math.abs(a - x) < 8)) corbel(p, x, gy, 6, 3);
  for (const px of PIVOTS) {
    p.sprite(px - 5, gy - 1, ['###########', '#hhhhhhhhh#', '.#hhhhhhh#.', '..#hhhhh#..', '...#hhh#...', '....###....'], { '#': IRON[1], h: IRON[3] });
    p.sprite(px - 2, gy - 1, ['.###.', '#lmd#', '#m.d#', '#mdd#', '.###.'], { '#': IRON[0], l: IRON[6], m: IRON[4], d: IRON[2] });
    p.set(px - 4, gy, IRON[5]); p.set(px + 4, gy, IRON[5]);
  }
  p.sprite(HOOK_X - 6, gy - 1, ['#############', '#hhhhhhhhhhh#', '.###########.', '.....#h#.....', '....#...#....', '....#...#....', '.....###.....'], { '#': IRON[1], h: IRON[4] });
  // Bridges hang from the gallery on chains.
  for (const b of BRIDGES) for (const cx of [b.x0 + 3, b.x1 - 4]) {
    chain(p, cx, gy, b.y);
    p.sprite(cx - 2, gy - 1, ['#####', '.###.'], { '#': IRON[3] });
  }
  // Big stepped corbels under the towers' inner ends.
  for (const t of TOWERS) {
    const ex = t.side < 0 ? t.x1 : t.x0;
    for (let s = 0; s < 4; s++) {
      const w = 16 - s * 4, x0 = t.side < 0 ? ex - w : ex;
      for (let y = t.y1 + s * 4; y < t.y1 + s * 4 + 4; y++) for (let x = x0; x < x0 + w; x++) {
        const ly = y - (t.y1 + s * 4), edge = t.side < 0 ? x === x0 : x === x0 + w - 1;
        p.set(x, y, ly === 3 ? BK.ink : ly === 0 ? BK.l : edge ? (t.side < 0 ? BK.l2 : BK.d) : BK.m2);
      }
    }
  }
  // The glass pane's stone head on the left tower.
  p.sprite(GLASS_X - 5, 104, ['.#########.', '#lllllllll#', '#mmmmmmmmm#', '#mmmmmmmmm#', '.##mmmmm##.', '...#ddd#...', '....#d#....', '.....#.....'], { '#': BK.ink, l: BK.l2, m: BK.m2, d: BK.d });
  for (const l of LADDERS) ladder(p, l);
  return p.done();
}

// ---- crisp stone the fighters stand on -----------------------------------------------------------
function playStone(p, x0, y0, x1, y1, seed, { ch = 8, wmin = 16, wmax = 30, frieze = false } = {}) {
  // Bright top edge, then courses of dressed blocks darkening downward.
  for (let x = x0; x < x1; x++) PLAY_TOP.forEach((c, i) => { if (y0 + i < y1) p.set(x, y0 + i, c); });
  let y = y0 + PLAY_TOP.length;
  if (frieze) {
    for (let x = x0; x < x1; x++) {
      const k = (x - x0) % 6;
      p.set(x, y, '#2a2440'); p.set(x, y + 1, k < 4 ? '#6a6190' : '#2a2440'); p.set(x, y + 2, k < 4 ? '#4e4570' : '#1d1830'); p.set(x, y + 3, '#1d1830');
    }
    y += 4;
  }
  masonry(p, x0, y, x1, y1, ch, wmin, wmax, PLAY, seed);
  for (let yy = y; yy < y1; yy++) for (let x = x0; x < x1; x++) {
    const t = (yy - y) / Math.max(1, VIEW_H - y);
    if (bayer(x, yy) < t * 0.9) p.shade(x, yy, 0.78);
  }
}

function paintSolids() {
  const p = new Pix();
  // Floor on both sides of the pit.
  for (const [a, b, seed] of [[0, PIT.x0, 31], [PIT.x1, VIEW_W, 32]]) {
    playStone(p, a, FLOOR_Y, b, VIEW_H, seed, { ch: 11, wmin: 24, wmax: 40 });
  }
  // The pit: a narrow shaft of dark stone with iron spikes at its bottom.
  for (let y = FLOOR_Y; y < VIEW_H; y++) for (let x = PIT.x0; x < PIT.x1; x++) {
    const t = (y - FLOOR_Y) / (VIEW_H - FLOOR_Y);
    let col = bayer(x, y) < t ? '#08060d' : '#120e1c';
    if ((y - FLOOR_Y) % 7 === 6 || (x + Math.floor((y - FLOOR_Y) / 7) * 6) % 12 === 0) col = '#07050b';
    if (x < PIT.x0 + 5) col = bayer(x, y) < (PIT.x0 + 5 - x) / 5 ? '#050308' : col;
    if (x === PIT.x1 - 1) col = '#2a2440';
    if (x === PIT.x1 - 2) col = '#1a1528';
    p.set(x, y, col);
  }
  // Floor ends on the lip of the pit.
  for (let y = FLOOR_Y; y < VIEW_H; y++) { p.set(PIT.x0 - 1, y, '#191426'); p.set(PIT.x0 - 2, y, '#2a2440'); p.set(PIT.x1, y, PLAY_TOP[3]); p.set(PIT.x1 + 1, y, PLAY.hi); }
  for (const [x, w] of [[PIT.x0 - 3, 3], [PIT.x1, 3]]) for (let i = 0; i < w; i++) { p.set(x + i, FLOOR_Y, PLAY_TOP[0]); p.set(x + i, FLOOR_Y + 1, PLAY_TOP[1]); }
  // Spikes: a back row in shadow, a front row of bright iron, a few with old blood.
  const spike = (bx, tip, w, dark) => {
    for (let y = tip; y < VIEW_H; y++) {
      const half = (y - tip) / (VIEW_H + 4 - tip) * (w / 2) + 0.35;
      for (let x = Math.floor(bx - half); x <= Math.ceil(bx + half); x++) {
        const u = (x + 0.5 - bx) / Math.max(0.5, half);
        if (Math.abs(u) > 1.05) continue;
        let col = dark ? (u < 0 ? IRON[3] : IRON[2]) : u < -0.45 ? IRON[6] : u < 0.1 ? IRON[5] : u < 0.6 ? IRON[4] : IRON[3];
        if (Math.abs(u) > 0.85) col = IRON[0];
        p.set(x, y, col);
      }
    }
  };
  for (let x = PIT.x0 + 5; x < PIT.x1 - 2; x += 6) spike(x, 344 + ((x * 7) % 3), 6, true);
  const front = [];
  for (let x = PIT.x0 + 3; x < PIT.x1 - 1; x += 7) front.push(x + 2);
  front.forEach((x, i) => spike(x, 340 + (i % 2) * 3, 7, false));
  front.forEach((x, i) => { if (i % 3 === 1) { const tip = 340 + (i % 2) * 3; p.set(x, tip, '#c83a44'); p.set(x, tip + 1, '#9c2233'); p.set(x - 1, tip + 2, '#6b1426'); } });

  // Towers and the hidden room's roof: crisp stone with a carved frieze and a corbel table under them.
  for (const t of TOWERS) {
    playStone(p, t.x0, t.y0, t.x1, t.y1 - 6, 40 + t.side, { ch: 8, wmin: 14, wmax: 26, frieze: true });
    lombard(p, t.x0, t.x1, t.y1 - 6);
    const ex = t.side < 0 ? t.x1 - 1 : t.x0;
    for (let y = t.y0 + 1; y < t.y1; y++) { p.set(ex, y, t.side < 0 ? '#191426' : PLAY_TOP[2]); p.set(ex - t.side, y, t.side < 0 ? PLAY.shadow : PLAY.spec); }
  }
  playStone(p, ROOF.x0, ROOF.y0, ROOF.x1, ROOF.y1 - 6, 47, { ch: 6, wmin: 12, wmax: 22, frieze: true });
  lombard(p, ROOF.x0, ROOF.x1, ROOF.y1 - 6);
  for (let y = ROOF.y0 + 1; y < ROOF.y1; y++) { p.set(ROOF.x0, y, PLAY_TOP[2]); p.set(ROOF.x0 + 1, y, PLAY.spec); }
  // Carved plaques on the towers: a skull on the left, the clock's hourglass on the right.
  plaque(p, 50, 176, 'skull');
  plaque(p, 600, 176, 'hourglass');
  return p.done();
}

function lombard(p, x0, x1, y) {
  // A row of little round arches under a cornice.
  for (let x = x0; x < x1; x++) {
    const k = (x - x0) % 8;
    for (let yy = y; yy < y + 6; yy++) {
      const ly = yy - y;
      let col = '#3a3350';
      if (ly === 0) col = '#5d5479';
      if (ly >= 2 && k >= 1 && k <= 6 && ly >= (k === 1 || k === 6 ? 3 : 2)) col = ly === 5 ? '#0d0a15' : '#191426';
      if (k === 0 && ly > 0) col = ly === 5 ? '#0d0a15' : '#4a4268';
      if (ly === 5) col = '#0d0a15';
      p.set(x, yy, col);
    }
  }
}

function plaque(p, cx, cy, kind) {
  for (let y = cy - 7; y < cy + 7; y++) for (let x = cx - 9; x < cx + 9; x++) {
    const lx = x - (cx - 9), ly = y - (cy - 7);
    let col = '#342d4a';
    if (ly === 0 || lx === 0) col = '#1d1830';
    else if (ly === 13 || lx === 17) col = '#655c84';
    else if (ly === 1 || lx === 1) col = '#29233b';
    p.set(x, y, col);
  }
  if (kind === 'skull') p.sprite(cx - 4, cy - 5, ['..###..', '.#####.', '##o#o##', '##o#o##', '.##.##.', '..#.#..', '.#.#.#.', '.......', '#.....#', '.#...#.'], { '#': '#8a7f9c', o: '#191426' });
  else p.sprite(cx - 4, cy - 5, ['#######', '.#ooo#.', '..#o#..', '...#...', '..#.#..', '.#.o.#.', '#ooooo#', '#######'], { '#': '#8a7f9c', o: '#5d5479' });
}

// ---- fronts of the one-way platforms ---------------------------------------------------------------
function paintFronts() {
  const p = new Pix();
  for (const b of BALCONIES) {
    const { x0, x1, y } = b;
    for (let x = x0; x < x1; x++) {
      p.set(x, y, PLAY_TOP[0]); p.set(x, y + 1, PLAY_TOP[1]); p.set(x, y + 2, '#4a4268');
      const k = (x - x0 - 4) % 10;
      for (let yy = y + 3; yy < y + 7; yy++) {
        let col = '#433b5c';
        if (k >= 1 && k <= 7) { const ly = yy - (y + 3); col = ly === 0 ? '#1d1830' : ly === 3 ? '#6a6190' : k === 1 ? '#1d1830' : k === 7 ? '#5a5180' : '#2c2642'; if (ly > 0 && ly < 3 && k >= 3 && k <= 5) col = ly === 1 ? '#8a80aa' : '#433b5c'; }
        p.set(x, yy, col);
      }
      p.set(x, y + 7, '#120e1c');
    }
    for (const ex of [x0, x1 - 4]) for (let yy = y; yy < y + PH; yy++) for (let x = ex; x < ex + 4; x++) {
      const lx = x - ex, ly = yy - y;
      p.set(x, yy, ly === 0 ? PLAY_TOP[0] : ly === 7 ? '#120e1c' : lx === 0 ? '#7d749b' : lx === 3 ? '#1d1830' : ly === 1 ? PLAY_TOP[1] : '#5a5180');
    }
  }
  for (const b of BRIDGES) {
    const { x0, x1, y } = b;
    let plank = x0, pw = 9;
    for (let x = x0; x < x1; x++) {
      if (x - plank >= pw) { plank = x; pw = 8 + ((x * 7) % 4); }
      const edge = x === plank;
      p.set(x, y, WOOD[5]); p.set(x, y + 1, edge ? WOOD[3] : WOOD[4]);
      for (let yy = y + 2; yy < y + 7; yy++) {
        let col = edge ? WOOD[1] : WOOD[3];
        if (!edge && ((x * 13 + yy * 7) % 11 === 0)) col = WOOD[2];
        if (!edge && yy === y + 2) col = WOOD[4];
        if (x === plank + 1 && !edge) col = WOOD[2];
        p.set(x, yy, col);
      }
      p.set(x, y + 7, WOOD[0]);
    }
    for (const ex of [x0, x1 - 5]) for (let yy = y; yy < y + PH; yy++) for (let x = ex; x < ex + 5; x++) {
      const lx = x - ex, ly = yy - y;
      let col = ly === 0 ? IRON[6] : ly === 7 ? IRON[0] : lx === 0 ? IRON[5] : lx === 4 ? IRON[1] : IRON[3];
      if ((ly === 2 || ly === 5) && lx === 2) col = IRON[6];
      p.set(x, yy, col);
    }
  }
  // The gallery: a carved stone cornice with a relief of tiny balusters and dentils under it.
  const { x0, x1, y } = GALLERY;
  for (let x = x0; x < x1; x++) {
    p.set(x, y, PLAY_TOP[0]); p.set(x, y + 1, PLAY_TOP[1]); p.set(x, y + 2, '#4a4268');
    const k = (x - x0) % 5;
    const relief = [['#1d1830', '#1d1830', '#1d1830', '#1d1830'], ['#6a6190', '#2c2642', '#6a6190', '#5a5180'], ['#4a4268', '#4a4268', '#3a3350', '#3a3350'], ['#2c2642', '#2c2642', '#2c2642', '#2c2642'], ['#1d1830', '#1d1830', '#1d1830', '#1d1830']][k];
    relief.forEach((c, i) => p.set(x, y + 3 + i, c));
    p.set(x, y + 7, '#120e1c');
    if ((x - x0) % 6 < 3) { p.set(x, y + 8, (x - x0) % 6 === 0 ? '#5a5180' : '#2c2642'); if ((x - x0) % 6 === 1) p.set(x, y + 9, '#1d1830'); }
  }
  for (const ex of [x0, x1 - 4]) for (let yy = y; yy < y + PH; yy++) for (let x = ex; x < ex + 4; x++) {
    const lx = x - ex, ly = yy - y;
    p.set(x, yy, ly === 0 ? PLAY_TOP[0] : ly === 7 ? '#120e1c' : lx === 0 ? '#7d749b' : lx === 3 ? '#1d1830' : ly === 1 ? PLAY_TOP[1] : '#5a5180');
  }
  return p.done();
}

// ---- foreground silhouettes (parallax 1.3) ----------------------------------------------------------
function paintForeground() {
  const p = new Pix();
  const ink = '#0a0711', rim = '#2a2140';
  // A pier in silhouette at the right edge, and the spring of a foreground arch over the top-right corner.
  for (let y = 0; y < VIEW_H; y++) {
    let w = 8;
    if (y >= 52 && y < 58) w = 11; else if (y >= 58 && y < 61) w = 10;
    if (y >= 334) w = y < 337 ? 11 : 13;
    for (let x = VIEW_W - w; x < VIEW_W; x++) p.set(x, y, x === VIEW_W - w ? rim : ink);
  }
  for (let y = 0; y < 60; y++) for (let x = 560; x < VIEW_W; x++) {
    const d = Math.hypot(x + 0.5 - 560, y + 0.5 - 60);
    if (d < 72) continue;
    p.set(x, y, d < 73 ? rim : ink);
  }
  // Ivy hanging from the top-left, chains at the top corners.
  const rnd = seeded(5);
  for (const [x, len] of [[3, 34], [9, 22], [16, 44], [24, 18], [33, 28], [44, 14]]) {
    let cx = x;
    for (let y = 0; y < len; y++) {
      if (rnd() < 0.25) cx += rnd() < 0.5 ? -1 : 1;
      p.set(cx, y, ink);
      if (rnd() < 0.55) { const s = rnd() < 0.5 ? -1 : 1; p.set(cx + s, y, ink); p.set(cx + 2 * s, y, ink); p.set(cx + s, y + 1, ink); if (rnd() < 0.5) p.set(cx + 2 * s, y - 1, '#16221f'); }
    }
  }
  for (let x = 0; x < 52; x++) { const h = 3 + Math.round(Math.sin(x * 0.4) * 1.5 + Math.sin(x * 0.13) * 2); for (let y = 0; y < h; y++) p.set(x, y, ink); }
  for (const [x, len] of [[614, 34]]) {
    for (let y = 0; y < len; y += 4) { p.set(x - 1, y, ink); p.set(x + 1, y, ink); p.set(x - 1, y + 1, ink); p.set(x + 1, y + 1, ink); p.set(x, y + 2, ink); p.set(x, y + 3, ink); p.set(x, y + 1, rim); }
    p.sprite(x - 3, len, ['.#####.', '#.....#', '#.....#', '.#...#.', '..###..'], { '#': ink });
  }
  // Rubble and a skull along the bottom edge.
  for (let x = 0; x < 92; x++) { const h = 4 + Math.round(Math.sin(x * 0.31) * 2 + Math.sin(x * 0.11 + 1) * 3); for (let y = VIEW_H - h; y < VIEW_H; y++) p.set(x, y, ink); if (x % 9 === 3) p.set(x, VIEW_H - h, rim); }
  p.sprite(58, 347, ['..####..', '.######.', '##..#..#', '########', '.##.###.', '..#.#.#.'], { '#': ink });
  for (let x = 548; x < VIEW_W; x++) { const h = 3 + Math.round(Math.sin(x * 0.23) * 2 + Math.sin(x * 0.07) * 3); for (let y = VIEW_H - h; y < VIEW_H; y++) p.set(x, y, ink); if (x % 11 === 2) p.set(x, VIEW_H - h, rim); }
  return p.done();
}

// ---- the night outside ---------------------------------------------------------------------------
const MOON = { x: 54, y: 88, r: 23 };

function paintSky() {
  const w = VIEW_W + MARGIN * 2, h = VIEW_H + MARGIN * 2, p = new Pix(w, h);
  ditherV(p, 0, 0, w, h, [[0, '#05041a'], [0.08, '#0a0926'], [0.17, '#121034'], [0.26, '#1b1844'], [0.34, '#262152'], [0.41, '#30285c'], [0.5, '#382d64'], [1, '#3c3068']]);
  const rnd = seeded(17);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h * 0.5), b = rnd();
    p.set(x, y, b > 0.85 ? '#fff6e6' : b > 0.5 ? '#b8b0e8' : '#6e66a8', b > 0.85 ? 255 : 170);
    if (b > 0.975) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, '#9d94d8', 150);
  }
  // A huge, pale moon with a banded halo.
  const mx = MOON.x + MARGIN, my = MOON.y + MARGIN, mr = MOON.r;
  for (let y = my - 70; y < my + 70; y++) for (let x = mx - 70; x < mx + 70; x++) {
    const dx = x + 0.5 - mx, dy = y + 0.5 - my, d = Math.hypot(dx, dy);
    if (d < mr) {
      const e = d / mr;
      let col = '#f4eedb';
      const n = Math.sin(x * 0.55 + y * 0.31) + Math.sin(x * 0.21 - y * 0.47) * 1.3 + Math.sin((x + y) * 0.12) * 1.5 + Math.sin(x * 0.09 - 1.4) * 1.2;
      if (n > 1.5) col = '#ddd5c6';
      if (n > 2.6) col = '#c4bcbc';
      if (e > 0.88) col = bayer(x, y) < 0.5 ? '#d6cfcc' : col;
      if (dx + dy > mr * 0.9 && bayer(x, y) < (dx + dy - mr * 0.9) / (mr * 0.5)) col = '#b8b0c4';
      if (dx + dy < -mr * 1.1 && e > 0.7) col = '#fffbee';
      p.set(x, y, col);
    } else if (d < mr + 50) {
      const t = 1 - (d - mr) / 50;
      if (t > 0.86) p.set(x, y, bayer(x, y) < 0.75 ? '#8e86c4' : '#5c56a0', 200);
      else if (t > 0.6) { if (bayer(x, y) < 0.5) p.set(x, y, '#5c56a0', 170); }
      else if (t > 0.3) { if (bayer(x, y) < 0.25) p.set(x, y, '#3e3880', 160); }
      else if (bayer(x, y) < 0.0625) p.set(x, y, '#3e3880', 140);
    }
  }
  return p.done();
}

function paintClouds(seed, h, count, base, top, rim, w = 1360) {
  const p = new Pix(w, h), rnd = seeded(seed), blobs = [];
  for (let i = 0; i < count; i++) {
    const cx = rnd() * w, cy = h * 0.4 + rnd() * h * 0.3, len = 50 + rnd() * 140;
    for (let k = 0; k < 7; k++) blobs.push({ x: cx + (rnd() - 0.5) * len, y: cy + (rnd() - 0.5) * 8, r: 8 + rnd() * 16, ry: 2 + rnd() * 5 });
  }
  const F = new Float32Array(w * h);
  for (const b of blobs) {
    for (let y = Math.max(0, Math.floor(b.y - b.ry)); y < Math.min(h, Math.ceil(b.y + b.ry)); y++) for (let xx = Math.floor(b.x - b.r); xx < Math.ceil(b.x + b.r); xx++) {
      const x = ((xx % w) + w) % w, d = ((xx - b.x) / b.r) ** 2 + ((y - b.y) / b.ry) ** 2;
      if (d < 1) F[y * w + x] += 1 - d;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = F[y * w + x];
    if (f < 0.35 + bayer(x, y) * 0.3) continue;
    const below = y + 2 < h ? F[(y + 2) * w + x] : 0, above = y > 1 ? F[(y - 2) * w + x] : 0;
    let col = base;
    if (above < 0.4) col = top;
    else if (below < 0.4) col = rim;
    p.set(x, y, col, 225);
  }
  return p.done();
}

// The distant castle on its crag: towers, spires, a few lit windows. W is view width + 4*MARGIN.
function paintCastle() {
  const w = VIEW_W + MARGIN * 4, h = VIEW_H + MARGIN * 2, p = new Pix(w, h);
  const OX = MARGIN * 2, OY = MARGIN;
  const body = '#0c0a1f', rimL = '#3a3474', roof = '#0a081a', win = ['#f0a860', '#ffd59a', '#c8784a'];
  const rnd = seeded(29);
  // Far mountains, pale with distance.
  for (let x = 0; x < w; x++) {
    const vx = x - OX;
    const ridge = Math.round(116 - Math.abs(Math.sin(vx * 0.011 + 0.4)) * 26 - Math.sin(vx * 0.037) * 6 - Math.sin(vx * 0.13) * 2 + 16 * Math.exp(-(((vx - MOON.x) / 46) ** 2)));
    for (let y = ridge + OY; y < h; y++) p.set(x, y, y === ridge + OY ? '#3a3370' : y < ridge + OY + 3 && bayer(x, y) < 0.5 ? '#2a245a' : '#1e1946');
  }
  const towers = [];
  const tower = (vx, tw, top, kind, lit = 2) => towers.push({ vx, tw, top, kind, lit });
  // Placed so each window frames something: a spire beside the moon, a chapel spire, the keep.
  tower(27, 8, 60, 'cone'); tower(68, 9, 102, 'crenel', 1);
  tower(182, 12, 64, 'cone'); tower(205, 11, 94, 'crenel');
  tower(422, 11, 100, 'cone'); tower(438, 8, 58, 'cone', 1); tower(456, 12, 102, 'crenel');
  tower(566, 40, 74, 'keep', 4); tower(580, 11, 44, 'cone'); tower(598, 8, 54, 'cone'); tower(562, 7, 60, 'cone', 1);
  for (let vx = -40; vx < VIEW_W + 40; vx += 30 + Math.floor(rnd() * 18)) if (!towers.some(t => Math.abs(t.vx - vx) < 26)) tower(vx, 8 + Math.floor(rnd() * 6), 98 + Math.floor(rnd() * 10), rnd() < 0.5 ? 'cone' : 'crenel', 1);
  // Curtain wall linking them.
  for (let x = 0; x < w; x++) {
    const vx = x - OX, top = 110 + Math.round(Math.sin(vx * 0.02) * 2);
    for (let y = top + OY; y < h; y++) p.set(x, y, body);
    if (((vx % 6) + 6) % 6 < 3) for (let y = top - 3 + OY; y < top + OY; y++) p.set(x, y, body);
  }
  for (const t of towers) {
    const x0 = t.vx + OX, top = t.top + OY;
    const litSide = t.vx + t.tw / 2 < MOON.x ? 1 : -1;
    for (let y = top; y < h; y++) for (let x = x0; x < x0 + t.tw; x++) p.set(x, y, (litSide > 0 ? x === x0 + t.tw - 1 : x === x0) ? rimL : body);
    if (t.kind === 'cone') {
      const ch = Math.round(t.tw * 1.8);
      for (let y = top - ch; y < top; y++) {
        const half = (y - (top - ch)) / ch * (t.tw / 2 + 1.5);
        const xa = Math.floor(x0 + t.tw / 2 - half), xb = Math.ceil(x0 + t.tw / 2 - 1 + half);
        for (let x = xa; x <= xb; x++) p.set(x, y, roof);
        p.set(litSide > 0 ? xb : xa, y, rimL);
      }
      for (let k = 1; k < 4; k++) p.set(x0 + (t.tw >> 1), top - ch - k, roof);
      for (let x = x0 - 2; x < x0 + t.tw + 2; x++) p.set(x, top, body);
    }
    if (t.kind === 'crenel' || t.kind === 'keep') for (let x = x0 - 1; x < x0 + t.tw + 1; x++) { p.set(x, top, body); if ((x - x0) % 3 !== 2) { p.set(x, top - 1, body); p.set(x, top - 2, body); } }
    for (let k = 0; k < t.lit; k++) {
      const wx = x0 + 2 + Math.floor(rnd() * Math.max(1, t.tw - 4)), wy = top + 5 + Math.floor(rnd() * 24);
      const c = win[Math.floor(rnd() * 3)];
      p.set(wx, wy, c); p.set(wx, wy + 1, c);
      if (t.tw > 14) { p.set(wx + 1, wy, c); p.set(wx + 1, wy + 1, c); }
    }
  }
  // A pennant on the keep's tallest spire.
  p.sprite(585 + OX, 44 - 26 + OY, ['#....', '###..', '#####', '###..', '#....', '#....'], { '#': roof });
  return p.done();
}

// The crag and a dead tree close by (seen low in the windows).
function paintHills() {
  const w = VIEW_W + MARGIN * 4, h = VIEW_H + MARGIN * 2, p = new Pix(w, h);
  const OX = MARGIN * 2, OY = MARGIN;
  for (let x = 0; x < w; x++) {
    const vx = x - OX;
    const top = 124 + Math.round(Math.sin(vx * 0.021 + 0.5) * 5 + Math.sin(vx * 0.067) * 2 + Math.cos(vx * 0.009) * 4);
    for (let y = top + OY; y < h; y++) p.set(x, y, y === top + OY ? '#221e48' : '#0b0918');
  }
  const tree = (bx, by, s) => {
    const branch = (x, y, ang, len, wd) => {
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      for (let k = 0; k < wd; k++) p.line(x + k + OX, y + OY, ex + k + OX, ey + OY, '#0b0918');
      if (len > 4) { branch(ex, ey, ang - 0.5, len * 0.66, Math.max(1, wd - 1)); branch(ex, ey, ang + 0.42, len * 0.6, Math.max(1, wd - 1)); }
    };
    branch(bx, by, -Math.PI / 2 - 0.08, 16 * s, 3);
  };
  tree(64, 134, 0.95); tree(190, 124, 0.7); tree(600, 128, 0.8);
  // Graves on the crag.
  for (const gx of [36, 210, 446, 584]) p.sprite(gx + OX, 118 + OY, ['.#.', '###', '.#.', '.#.', '###'], { '#': '#0b0918' });
  return p.done();
}

function paintFog(seed, color, amt, w = 1280, h = 40) {
  const p = new Pix(w, h), col = C(color), rnd = seeded(seed);
  const waves = Array.from({ length: 5 }, () => [rnd() * 6, (1 + Math.floor(rnd() * 5)) / w, 4 + rnd() * 8]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 1 - Math.abs(y - h / 2) / (h / 2);
    for (const [ph, f, a] of waves) v += Math.sin(x * f * TAU + ph) * a / 60;
    if (bayer(x, y) < v * amt) p.set(x, y, col, 110);
  }
  return p.done();
}

// Bats (5x3 frames: wings up, level, down, level).
const BAT_FRAMES = [['#...#', '.###.', '..#..'], ['.....', '#####', '..#..'], ['..#..', '.###.', '#...#'], ['.....', '#####', '..#..']];
const BATS = [
  { T: 23, v: 58, y: 72, amp: 9, dir: 1, off: 2 },
  { T: 23, v: 58, y: 84, amp: 7, dir: 1, off: 1.4 },
  { T: 31, v: 46, y: 96, amp: 12, dir: -1, off: 9 },
  { T: 37, v: 64, y: 30, amp: 6, dir: -1, off: 21 },
  { T: 41, v: 52, y: 72, amp: 14, dir: 1, off: 30 }
];

// ---- the great clock's works: hands, an escapement of gears and the giant cog behind ---------------------
function handMask(angle, len, tail, hw) {
  const dx = Math.sin(angle), dy = -Math.cos(angle), R = Math.ceil(len + 2), out = [];
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const s = x * dx + y * dy, q = -x * dy + y * dx;
    if (s < -tail - 0.5 || s > len + 0.5) continue;
    const w = hw(s);
    if (Math.abs(q) <= w) out.push([x, y, q]);
  }
  return out;
}

function gearPaint(p, cx, cy, r, teeth, rot, cols, spokes = 4) {
  const R = r + 2;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) - rot, tooth = (((a / TAU) * teeth % 1) + 1) % 1 < 0.5;
    const outer = tooth ? r : r - 2;
    if (d > outer) continue;
    const lit = (-dx * 0.6 - dy * 0.8) / (d || 1);
    let col = null;
    if (d > r - 4.5) col = d > outer - 1 ? (lit > 0.2 ? cols[3] : cols[1]) : lit > 0.3 ? cols[3] : lit < -0.3 ? cols[1] : cols[2];
    else if (d < 2.5) col = d < 1.2 ? cols[0] : cols[3];
    else {
      const sa = ((a % (TAU / spokes)) + TAU / spokes) % (TAU / spokes);
      const off = Math.min(sa, TAU / spokes - sa) * d;
      if (off < 1.1) col = lit > 0 ? cols[3] : cols[2];
      else if (d < 4) col = cols[1];
    }
    if (col) p.set(x, y, col);
  }
}

const COG = { r: 52, teeth: 32, inner: 47 };
function paintCog(rot) {
  const S = COG.r * 2 + 6, p = new Pix(S, S), c = S / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    if (d < COG.inner - 1 || d > COG.r) continue;
    const a = Math.atan2(dy, dx) - rot, u = (((a / TAU) * COG.teeth % 1) + 1) % 1;
    const tooth = u > 0.18 && u < 0.62;
    if (d > COG.inner + 1 && !tooth) continue;
    const lit = (-dx * 0.6 - dy * 0.8) / d;
    let col = '#2a2440';
    if (d > COG.r - 1 || (tooth && (u < 0.24 || u > 0.56))) col = lit > 0.2 ? '#4a4168' : '#151122';
    else if (lit > 0.45) col = '#3a3256';
    else if (lit < -0.4) col = '#1c172e';
    p.set(x, y, col);
  }
  return p.done();
}

export class CastleWorld {
  constructor() {
    this.sky = paintSky();
    this.cloudsFar = paintClouds(3, 70, 8, '#1a1740', '#3a3577', '#13112e');
    this.cloudsNear = paintClouds(13, 60, 6, '#151231', '#4d4789', '#0e0c22');
    this.castle = paintCastle();
    this.hills = paintHills();
    this.fog = paintFog(5, '#3a3470', 0.32);
    this.wall = paintWall();
    this.back = paintBack();
    this.solids = paintSolids();
    this.fronts = paintFronts();
    this.fg = paintForeground();
    // The works of the clock: 4 frames of the gears under the dial and of the giant cog behind it.
    this.dial = [0, 1, 2, 3].map(f => {
      const p = new Pix(44, 44), c = 22;
      for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d <= 19.5) p.set(x, y, d > 18.5 ? '#0d0a16' : bayer(x, y) < d / 30 ? '#100c1a' : '#161226');
      }
      const step = f / 4;
      gearPaint(p, c, c, 10, 10, step * (TAU / 10), [IRON[0], IRON[2], IRON[3], IRON[5]]);
      gearPaint(p, c - 9.5, c + 11.5, 6.4, 6, -step * (TAU / 6) + 0.3, [IRON[0], IRON[1], IRON[2], IRON[4]], 3);
      gearPaint(p, c + 11, c - 10, 5.6, 6, -step * (TAU / 6), [IRON[0], IRON[1], IRON[2], IRON[4]], 3);
      for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) if (Math.hypot(x - c, y - c) > 19.5) p.erase(x, y);
      return p.done();
    });
    this.cog = [0, 1, 2, 3].map(f => paintCog(f / 4 * (TAU / COG.teeth)));
    this.hands = mk(72, 72);
    this.handsKey = '';
  }

  drawBackground(g, t, cam) {
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    const par = k => [Math.round(-MARGIN + cam.x * k), Math.round(-MARGIN + cam.y * k)];
    let [x, y] = par(0.04);
    g.drawImage(this.sky, x, y);
    const tw = Math.floor(t * 2.5);
    g.fillStyle = '#fff8ec';
    for (let i = 0; i < 7; i++) { if ((tw + i * 3) % 5) continue; g.fillRect((i * 97 + tw * 31) % 640, (i * 41 + tw * 13) % 150, 1, 1); }
    const cf = (t * 3) % 1360, cn = (t * 7) % 1360;
    g.drawImage(this.cloudsFar, Math.round(-cf + cam.x * 0.07), 34 + Math.round(cam.y * 0.07));
    g.drawImage(this.cloudsFar, Math.round(1360 - cf + cam.x * 0.07), 34 + Math.round(cam.y * 0.07));
    [x, y] = par(0.15);
    g.drawImage(this.castle, x - MARGIN, y);
    g.drawImage(this.fog, Math.round(-((t * 4) % 1280) + x), 100 + y);
    g.drawImage(this.fog, Math.round(1280 - ((t * 4) % 1280) + x), 100 + y);
    g.drawImage(this.cloudsNear, Math.round(-cn + cam.x * 0.1), 4 + Math.round(cam.y * 0.1));
    g.drawImage(this.cloudsNear, Math.round(1360 - cn + cam.x * 0.1), 4 + Math.round(cam.y * 0.1));
    [x, y] = par(0.3);
    g.drawImage(this.hills, x - MARGIN, y);
    // Bats cross the windows now and then.
    g.fillStyle = '#06040d';
    for (const b of BATS) {
      const u = (t + b.off) % b.T, bx = b.dir > 0 ? -12 + u * b.v : VIEW_W + 12 - u * b.v;
      if (bx < -8 || bx > VIEW_W + 8) continue;
      const by = Math.round(b.y + Math.sin(u * 1.7 + b.off) * b.amp + cam.y * 0.2), fr = BAT_FRAMES[Math.floor(t * 9 + b.off * 3) % 4];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) if (fr[j][i] === '#') g.fillRect(Math.round(bx) + i, by + j, 1, 1);
    }
  }

  // The clock's works and hands over the wall at (320, 46) + offset; t is the match time in seconds.
  drawClock(g, t, ox = 0, oy = 0) {
    const time = START + Math.max(0, t || 0), sec = Math.floor(time) % 60, frame = Math.floor(time) % 4;
    const { x: cx, y: cy } = CLOCK;
    g.drawImage(this.cog[frame], cx - (this.cog[frame].width >> 1) + ox, cy - (this.cog[frame].height >> 1) + oy);
    const minute = Math.floor(time / 15) / 4 % 60, hour = Math.floor(time / 60) / 60 % 12;
    const key = sec + '|' + minute + '|' + hour;
    if (key !== this.handsKey) {
      this.handsKey = key;
      const hg = this.hands.getContext('2d'), c = 36;
      hg.clearRect(0, 0, 72, 72);
      hg.drawImage(this.dial[frame], c - 22, c - 22);
      const put = (list, col, dx = 0, dy = 0) => { hg.fillStyle = col; for (const [x, y] of list) hg.fillRect(c + x + dx, c + y + dy, 1, 1); };
      const hand = (ang, len, tail, hw, light, mid, dark) => {
        const core = handMask(ang, len, tail, hw), set = new Set(core.map(([x, y]) => x + ',' + y)), edge = [];
        for (const [x, y] of core) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + ex) + ',' + (y + ey); if (!set.has(k)) { set.add(k); edge.push([x + ex, y + ey]); } }
        put(core.concat(edge), 'rgba(6,3,12,0.45)', 1, 1);
        put(edge, '#120a14');
        put(core.filter(v => v[2] < -0.3), light); put(core.filter(v => Math.abs(v[2]) <= 0.3), mid); put(core.filter(v => v[2] > 0.3), dark);
      };
      const hA = hour / 12 * TAU, mA = minute / 60 * TAU, sA = sec / 60 * TAU;
      hand(hA, 15, 2, s => (s > 8 && s < 13 ? 2.2 - Math.abs(s - 10.5) * 0.35 : s >= 13 ? Math.max(0, (15 - s) * 0.6) : 1.1), GOLD[5], GOLD[3], GOLD[2]);
      hand(mA, 24, 3, s => (s > 19 ? Math.max(0, (24 - s) * 0.3) : s > 14 && s < 17 ? 1.6 : 0.8), GOLD[5], GOLD[4], GOLD[2]);
      const sec1 = handMask(sA, 27, 7, s => (s < -4 && s > -7.5 ? 1.4 : 0.45));
      put(sec1, 'rgba(6,3,12,0.45)', 1, 1);
      put(sec1, '#d8323c');
      put(sec1.filter(([x, y]) => (x * Math.sin(sA) - y * Math.cos(sA)) < -3.5), '#8c1a2a');
      hg.fillStyle = GOLD[1]; hg.fillRect(c - 2, c - 1, 5, 3); hg.fillRect(c - 1, c - 2, 3, 5);
      hg.fillStyle = GOLD[4]; hg.fillRect(c - 1, c - 1, 3, 3);
      hg.fillStyle = GOLD[5]; hg.fillRect(c - 1, c - 1, 1, 1);
    }
    g.drawImage(this.hands, cx - 36 + ox, cy - 36 + oy);
    // A glint that runs over the centre now and then.
    const gp = (t || 0) % 6;
    if (gp < 0.35) {
      const k = gp < 0.12 ? 1 : gp < 0.24 ? 2 : 1;
      g.fillStyle = '#fff8e0';
      g.fillRect(cx + ox - k, cy + oy, k * 2 + 1, 1); g.fillRect(cx + ox, cy + oy - k, 1, k * 2 + 1);
    }
  }
}
