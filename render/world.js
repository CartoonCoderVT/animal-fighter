// Procedurally painted level art, all on the 640x360 pixel grid.
import { VIEW_W, VIEW_H, S, seeded, bayer } from '../engine/const.js';
import { P, hexToRgb, mix, ramp } from '../engine/palette.js';
import { MAP } from '../sim/map.js';
import { drawText } from '../engine/font.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => Math.round(v * S);
export const MARGIN = 24;

// ---- low level painters -------------------------------------------------------------------
function img(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }
function setPx(D, w, x, y, rgb, a = 255) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  if (i < 0 || i >= D.length) return;
  if (a >= 255) { D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = 255; return; }
  const t = a / 255, ia = D[i + 3] / 255, oa = t + ia * (1 - t) || 1;
  D[i] = (rgb[0] * t + D[i] * ia * (1 - t)) / oa; D[i + 1] = (rgb[1] * t + D[i + 1] * ia * (1 - t)) / oa; D[i + 2] = (rgb[2] * t + D[i + 2] * ia * (1 - t)) / oa; D[i + 3] = oa * 255;
}
function stopsAt(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][0]) {
    const [t0, a] = stops[i], [t1, b] = stops[i + 1];
    return [a, b, (t - t0) / (t1 - t0 || 1)];
  }
  const last = stops[stops.length - 1][1];
  return [last, last, 0];
}
function ditherV(D, w, x0, y0, ww, hh, stops) {
  const rs = stops.map(([t, c]) => [t, hexToRgb(c)]);
  for (let y = y0; y < y0 + hh; y++) {
    const [a, b, f] = stopsAt(rs, (y - y0) / hh);
    for (let x = x0; x < x0 + ww; x++) setPx(D, w, x, y, bayer(x, y) < f ? b : a);
  }
}
const R = c => hexToRgb(c);

// ---- sky, moon and clouds -------------------------------------------------------------------
function paintSky() {
  const w = VIEW_W + MARGIN * 2, h = VIEW_H + MARGIN * 2;
  const c = mk(w, h), g = c.getContext('2d');
  const id = g.createImageData(w, h), D = id.data;
  ditherV(D, w, 0, 0, w, h, [[0, P.sky0], [0.22, P.sky1], [0.42, P.sky2], [0.58, P.sky3], [0.68, P.sky4], [0.75, P.sky5], [0.82, P.sky6], [1, P.sky6]]);
  const rnd = seeded(7);
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h * 0.42), b = rnd();
    setPx(D, w, x, y, b > 0.8 ? R('#fff4e0') : R('#b9a9e0'), b > 0.8 ? 255 : 140);
    if (b > 0.97) { setPx(D, w, x + 1, y, R('#c9b9f0'), 120); setPx(D, w, x - 1, y, R('#c9b9f0'), 120); setPx(D, w, x, y + 1, R('#c9b9f0'), 120); setPx(D, w, x, y - 1, R('#c9b9f0'), 120); }
  }
  // Moon with banded halo
  const mx = 500 + MARGIN, my = 62 + MARGIN, mr = 23;
  for (let y = my - 80; y < my + 80; y++) for (let x = mx - 80; x < mx + 80; x++) {
    const d = Math.hypot(x - mx, y - my);
    if (d < mr) {
      const edge = d / mr;
      let col = edge > 0.86 ? R(P.moon1) : R(P.moon0);
      const n = Math.sin(x * 0.7 + y * 0.3) + Math.sin(x * 0.23 - y * 0.5) * 1.3 + Math.sin((x + y) * 0.11) * 1.5;
      if (n > 1.6) col = R(P.moon1);
      if (n > 2.6) col = R(P.moon2);
      if (x - mx > 12 && edge > 0.7 && bayer(x, y) < 0.5) col = R(P.moon2);
      setPx(D, w, x, y, col);
    } else if (d < mr + 50) {
      const t = 1 - (d - mr) / 50, band = Math.ceil(t * 4) / 4;
      if (bayer(x, y) < band * band * 0.55) setPx(D, w, x, y, R(t > 0.75 ? P.moon1 : t > 0.45 ? '#c97a72' : '#7e4a74'), 110 + band * 80);
    }
  }
  g.putImageData(id, 0, 0);
  return c;
}

function paintClouds(seed, y0, y1, count, base, rim, top, w = 1360) {
  const h = y1 - y0 + 30, c = mk(w, h), g = c.getContext('2d');
  const id = g.createImageData(w, h), D = id.data;
  const rnd = seeded(seed), blobs = [];
  for (let i = 0; i < count; i++) {
    const cx = rnd() * w, cy = h * 0.35 + rnd() * h * 0.35, len = 40 + rnd() * 120;
    for (let k = 0; k < 6; k++) blobs.push({ x: cx + (rnd() - 0.5) * len, y: cy + (rnd() - 0.5) * 10, r: 6 + rnd() * 14, ry: 3 + rnd() * 6 });
  }
  const field = (x, y) => {
    let f = 0;
    for (const b of blobs) {
      let dx = Math.abs(x - b.x); dx = Math.min(dx, w - dx);
      const d = (dx / b.r) ** 2 + ((y - b.y) / b.ry) ** 2;
      if (d < 1) f += 1 - d;
    }
    return f;
  };
  const F = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) F[y * w + x] = field(x, y);
  const B = R(base), RIM = R(rim), TOP = R(top);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = F[y * w + x];
    if (f < 0.35 + bayer(x, y) * 0.3) continue;
    const below = y + 2 < h ? F[(y + 2) * w + x] : 0, above = y > 0 ? F[(y - 1) * w + x] : 0;
    let col = B;
    if (below < 0.4) col = RIM;
    else if (above < 0.4) col = TOP;
    setPx(D, w, x, y, col, 230);
  }
  g.putImageData(id, 0, 0);
  return c;
}

// ---- skylines -----------------------------------------------------------------------------
function paintCity(seed, w, base, height, colors) {
  const h = VIEW_H + MARGIN * 2, c = mk(w, h), g = c.getContext('2d');
  const rnd = seeded(seed);
  const id = g.createImageData(w, h), D = id.data;
  const body = R(colors.body), rim = R(colors.rim), win = R(colors.win), win2 = R(colors.win2);
  const blinks = [];
  let x = -10;
  while (x < w) {
    const bw = 12 + Math.floor(rnd() * colors.maxW), bh = height[0] + Math.floor(rnd() * (height[1] - height[0]));
    const top = base - bh;
    for (let yy = top; yy < h; yy++) for (let xx = x; xx < x + bw; xx++) setPx(D, w, xx, yy, xx >= x + bw - 1 || yy === top ? rim : body);
    if (rnd() < 0.3) { const ax = x + Math.floor(bw / 2), ah = 6 + rnd() * 14; for (let yy = top - ah; yy < top; yy++) setPx(D, w, ax, Math.floor(yy), rim); blinks.push([ax, Math.floor(top - ah)]); }
    if (rnd() < 0.25) for (let yy = top - 4; yy < top; yy++) for (let xx = x + 2; xx < x + bw - 2; xx++) if (xx % 3 === 0) setPx(D, w, xx, yy, rim);
    for (let yy = top + 4; yy < base + 20; yy += colors.winGap) for (let xx = x + 2; xx < x + bw - 2; xx += colors.winGap) {
      const r = rnd();
      if (r < colors.lit) { setPx(D, w, xx, yy, r < colors.lit * 0.35 ? win2 : win); if (colors.winW > 1) setPx(D, w, xx + 1, yy, win); }
    }
    x += bw + Math.floor(rnd() * 4);
  }
  // Haze toward the horizon glow.
  const haze = R(colors.haze);
  for (let y = base - height[1]; y < h; y++) {
    const t = Math.max(0, Math.min(1, (y - (base - height[1])) / (height[1] + 30)));
    for (let xx = 0; xx < w; xx++) if (D[(y * w + xx) * 4 + 3] && bayer(xx, y) < t * colors.hazeAmt) setPx(D, w, xx, y, haze, 150);
  }
  g.putImageData(id, 0, 0);
  return { canvas: c, blinks };
}

function paintIndustry() {
  const w = VIEW_W + MARGIN * 4, h = VIEW_H + MARGIN * 2, c = mk(w, h), g = c.getContext('2d');
  const body = '#1a1530', rim = '#4b3d70', dark = '#120f22', win = '#e89462';
  const fill = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); };
  const base = 300;
  fill(0, base - 40, w, h, body);
  const rnd = seeded(31);
  for (let x = 0; x < w; x += 46) { const hh = 30 + rnd() * 50; fill(x, base - 40 - hh, 40, hh + 2, body); fill(x + 39, base - 40 - hh, 1, hh, rim); for (let k = 0; k < 4; k++) fill(x + 4 + k * 9, base - 40 - hh - 6, 9, 6, k % 2 ? body : dark); }
  const stacks = [[70, 150], [96, 118], [612, 160]];
  for (const [sx, sh] of stacks) { fill(sx, base - sh, 11, sh, body); fill(sx + 10, base - sh, 1, sh, rim); fill(sx - 1, base - sh, 13, 4, rim); for (let y = base - sh + 14; y < base; y += 22) fill(sx, y, 11, 2, dark); }
  // water tower
  const tx = 660;
  fill(tx, 170, 30, 24, body); fill(tx + 29, 170, 1, 24, rim); fill(tx - 2, 166, 34, 5, body); fill(tx + 6, 160, 18, 6, body);
  for (const lx of [tx + 2, tx + 26]) fill(lx, 194, 2, base - 194, body);
  g.strokeStyle = body; g.lineWidth = 1; g.beginPath(); g.moveTo(tx + 3, 200); g.lineTo(tx + 27, 230); g.moveTo(tx + 27, 200); g.lineTo(tx + 3, 230); g.stroke();
  // crane
  fill(250, 150, 4, base - 150, body);
  for (let x = 200; x < 360; x += 2) fill(x, 150 + ((x / 2) % 2), 1, 3, body);
  g.strokeStyle = rim; g.beginPath(); g.moveTo(200, 150.5); g.lineTo(360, 150.5); g.stroke();
  for (let y = 150; y < base; y += 8) { g.strokeStyle = body; g.beginPath(); g.moveTo(250, y); g.lineTo(254, y + 8); g.stroke(); }
  fill(330, 152, 1, 30, body); fill(327, 182, 7, 4, body);
  for (let i = 0; i < 70; i++) { const x = rnd() * w, y = base - 30 - rnd() * 60; if (rnd() < 0.6) { fill(x, y, 2, 2, win); if (rnd() < 0.3) fill(x + 3, y, 2, 2, '#ffcf8a'); } }
  return { canvas: c, stacks: stacks.map(([x, hh]) => [x + 5, base - hh]).concat([[tx + 15, 160]]) };
}

function paintFog(seed, color, amt) {
  const w = 1280, h = 60, c = mk(w, h), g = c.getContext('2d');
  const id = g.createImageData(w, h), D = id.data, col = R(color), rnd = seeded(seed);
  const waves = Array.from({ length: 5 }, () => [rnd() * 6, 0.005 + rnd() * 0.02, 4 + rnd() * 8]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 1 - Math.abs(y - h / 2) / (h / 2);
    for (const [p, f, a] of waves) v += Math.sin(x * f * Math.PI * 2 / 1 + p) * a / 60;
    if (bayer(x, y) < v * amt) setPx(D, w, x, y, col, 120);
  }
  g.putImageData(id, 0, 0);
  return c;
}

// ---- warehouse wall -----------------------------------------------------------------------
export const WINDOWS = [{ x: 20, y: 18, w: 186, h: 128 }, { x: 246, y: 18, w: 148, h: 104 }, { x: 434, y: 18, w: 186, h: 128 }];
function paintWall() {
  const w = VIEW_W, h = VIEW_H, c = mk(w, h), g = c.getContext('2d');
  const id = g.createImageData(w, h), D = id.data;
  const rib = [R('#3e3757'), R('#322c49'), R('#2d2843'), R('#232035')];
  const rnd = seeded(91);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let col = rib[x % 4];
    if (y % 58 === 0) col = R('#18142a');
    else if (y % 58 === 1) col = R('#4a4264');
    setPx(D, w, x, y, col);
  }
  // rivets and rust streaks
  for (let y = 0; y < h; y += 58) for (let x = 6; x < w; x += 16) {
    setPx(D, w, x, y + 3, R('#6c6288')); setPx(D, w, x, y + 4, R('#221d33'));
    if (rnd() < 0.22) { const len = 8 + rnd() * 30; for (let k = 0; k < len; k++) if (bayer(x, y + 5 + k) < 1 - k / len) setPx(D, w, x + (k > len * 0.6 ? 1 : 0), y + 5 + k, R(k < len * 0.4 ? P.rust3 : P.rust2), 170); }
  }
  // grime toward the floor
  for (let y = 230; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < (y - 230) / 140) setPx(D, w, x, y, R('#1d1828'), 150);
  // concrete base and hazard band
  for (let y = 300; y < 328; y++) for (let x = 0; x < w; x++) setPx(D, w, x, y, y === 300 ? R(P.conc4) : (x * 7 + y * 13) % 23 === 0 ? R(P.conc1) : R(P.conc2));
  for (let y = 312; y < 321; y++) for (let x = 0; x < w; x++) setPx(D, w, x, y, ((x + y) >> 2) % 2 ? R(P.hazardDark) : R('#241f2c'));
  // window cut-outs with frames and mullions
  for (const win of WINDOWS) {
    for (let y = win.y; y < win.y + win.h; y++) for (let x = win.x; x < win.x + win.w; x++) {
      const i = (y * w + x) * 4;
      D[i + 3] = 0;
    }
    const paneW = 23, paneH = 21;
    for (let y = win.y; y < win.y + win.h; y++) for (let x = win.x; x < win.x + win.w; x++) {
      const lx = x - win.x, ly = y - win.y;
      const border = lx < 4 || ly < 4 || lx >= win.w - 4 || ly >= win.h - 4;
      const mull = (lx - 4) % paneW < 2 || (ly - 4) % paneH < 2;
      if (border) setPx(D, w, x, y, lx < 1 || ly < 1 ? R('#5d5378') : lx >= win.w - 1 || ly >= win.h - 1 ? R('#15111f') : R('#2b2540'));
      else if (mull) setPx(D, w, x, y, (lx - 4) % paneW === 0 || (ly - 4) % paneH === 0 ? R('#433a5c') : R('#1c1729'));
    }
    // dirty and broken panes, reflections
    for (let py = win.y + 6; py < win.y + win.h - 6; py += paneH) for (let pxx = win.x + 6; pxx < win.x + win.w - 6; pxx += paneW) {
      const r = rnd();
      for (let y = py; y < py + paneH - 2; y++) for (let x = pxx; x < pxx + paneW - 2; x++) {
        const lx = x - pxx, ly = y - py;
        if (r < 0.32) setPx(D, w, x, y, R('#2c2448'), 120 + (bayer(x, y) < 0.5 ? 40 : 0));
        if (r > 0.86 && lx + ly < 9 && bayer(x, y) < 0.7) setPx(D, w, x, y, R('#6e6290'), 200);
        if ((lx - ly + 40) % 17 === 0 && r > 0.2 && r < 0.86) setPx(D, w, x, y, R('#9a8cc0'), 70);
      }
    }
  }
  // roof truss
  for (let y = 0; y < 15; y++) for (let x = 0; x < w; x++) {
    const beam = y < 4 || y >= 11;
    const brace = !beam && (Math.abs(((x % 24) - (y - 4) * 3.4)) < 1.5 || Math.abs(((x % 24) - (24 - (y - 4) * 3.4))) < 1.5);
    if (beam || brace) setPx(D, w, x, y, y === 0 || y === 11 ? R('#5d5378') : R('#221c33'));
  }
  // pipe along the wall
  for (let x = 0; x < w; x++) for (let y = 148; y < 154; y++) setPx(D, w, x, y, [R('#6c6288'), R('#4a4264'), R('#3a3352'), R('#2d2742'), R('#211c31'), R('#17131f')][y - 148]);
  for (let x = 30; x < w; x += 96) for (let y = 147; y < 155; y++) for (let k = 0; k < 3; k++) setPx(D, w, x + k, y, k === 0 ? R('#7a70a0') : R('#2d2742'));
  g.putImageData(id, 0, 0);

  // painted stencil, posters, fuse box, sign boards
  g.globalAlpha = 0.5;
  drawText(g, '07', 140, 168, { color: '#c49a48', scale: 4 });
  g.globalAlpha = 1;
  const box = (x, y, ww, hh, face, edge, dark) => { g.fillStyle = dark; g.fillRect(x, y, ww, hh); g.fillStyle = face; g.fillRect(x, y, ww - 1, hh - 1); g.fillStyle = edge; g.fillRect(x, y, ww - 1, 1); g.fillRect(x, y, 1, hh - 1); };
  box(42, 204, 20, 22, '#4e5a5a', '#7d8a86', '#1e2224');
  g.fillStyle = '#e7b448'; g.fillRect(48, 210, 8, 7); g.fillStyle = '#241f2c'; g.fillRect(51, 211, 2, 5);
  box(470, 232, 30, 34, '#c9b99a', '#efe2c8', '#5a4e44');
  g.fillStyle = '#9c2233'; g.fillRect(474, 236, 22, 8);
  drawText(g, 'NÃO', 476, 247, { color: '#3a2a2a' });
  drawText(g, 'BRIGUE', 471, 255, { color: '#3a2a2a' });
  box(248, 204, 144, 30, '#1a1424', '#3a2f4a', '#0c0914');
  // shelves
  for (const sx of [436, 18]) {
    g.fillStyle = '#2a2536'; g.fillRect(sx, 268, 3, 60); g.fillRect(sx + 78, 268, 3, 60);
    for (const sy of [278, 302, 324]) {
      g.fillStyle = '#4a3f58'; g.fillRect(sx, sy, 81, 2);
      for (let bx = sx + 4; bx < sx + 74; bx += 13 + ((bx * 7) % 5)) { const bh = 8 + ((bx * 13) % 9); box(bx, sy - bh, 11, bh, ((bx >> 2) % 3) ? '#7a5a44' : '#5c6a5a', '#a07a58', '#2a1e1e'); }
    }
  }
  // exit sign board
  box(76, 283, 30, 10, '#0f2a1e', '#2a4a3a', '#06120c');
  // clock
  g.fillStyle = '#1c1729'; g.beginPath(); g.arc(320, 180, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d9cdb2'; g.beginPath(); g.arc(320, 180, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a2236'; g.fillRect(320, 175, 1, 5); g.fillRect(320, 180, 4, 1);
  return c;
}

// ---- solid level geometry ---------------------------------------------------------------------
function paintBack() {
  // Structures behind the fighters: railings, supports, ladders, booth interiors, press frame.
  const c = mk(VIEW_W, VIEW_H), g = c.getContext('2d');
  const f = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  for (const p of MAP.oneway) {
    const x0 = X(p.x0), x1 = X(p.x1), y = X(p.y);
    if (p.kind !== 'gantry') {
      for (let x = x0 + 2; x < x1; x += 14) f(x, y - 11, 1, 11, '#3a3352');
      f(x0, y - 12, x1 - x0, 1, '#5d5378'); f(x0, y - 11, x1 - x0, 1, '#241f33');
      f(x0, y - 6, x1 - x0, 1, '#3a3352');
    }
    if (p.kind === 'catwalk') {
      for (const sx of [x0 + 4, x1 - 7]) { f(sx, y + 8, 3, 328 - y - 8, '#2b2540'); f(sx, y + 8, 1, 328 - y - 8, '#4b4366'); }
      g.strokeStyle = '#2b2540'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0 + 6, y + 10); g.lineTo(x1 - 6, 326); g.moveTo(x1 - 6, y + 10); g.lineTo(x0 + 6, 326); g.stroke();
    }
    if (p.kind === 'bridge') for (const sx of [x0 + 3, x1 - 4]) f(sx, 98, 1, y - 98, '#3a3352');
    if (p.kind === 'gantry') {
      for (const sx of [x0, x1 - 6]) { f(sx, 14, 6, y - 14, '#2b2540'); f(sx, 14, 1, y - 14, '#4b4366'); for (let yy = 20; yy < y; yy += 9) f(sx + 1, yy, 4, 1, '#1d182c'); }
    }
  }
  for (const l of MAP.ladders) {
    const lx = X(l.x), top = X(l.top) - 2, bot = X(l.bottom);
    f(lx - 6, top, 2, bot - top, '#6a6088'); f(lx + 5, top, 2, bot - top, '#6a6088');
    f(lx - 5, top, 1, bot - top, '#8a80a8'); f(lx + 6, top, 1, bot - top, '#3a3352');
    for (let y = top + 3; y < bot; y += 6) { f(lx - 4, y, 9, 1, '#7a70a0'); f(lx - 4, y + 1, 9, 1, '#2b2540'); }
  }
  // Booth interiors above the high blocks
  for (const [bx, dir] of [[0, 1], [540, -1]]) {
    f(bx, 112, 100, 48, '#1b1626');
    for (let y = 114; y < 160; y += 4) f(bx, y, 100, 1, '#211b2e');
    const desk = dir > 0 ? bx + 28 : bx + 40;
    f(desk, 146, 34, 3, '#4a3a3a'); f(desk + 2, 149, 2, 11, '#3a2c2c'); f(desk + 30, 149, 2, 11, '#3a2c2c');
    f(desk + 10, 134, 14, 11, '#121018'); f(desk + 11, 135, 12, 9, '#1f3a48'); f(desk + 16, 145, 3, 1, '#121018');
    f(bx + (dir > 0 ? 6 : 76), 120, 18, 14, '#2c2438'); f(bx + (dir > 0 ? 7 : 77), 121, 16, 12, '#c9b99a');
    for (let y = 123; y < 132; y += 2) f(bx + (dir > 0 ? 9 : 79), y, 10 - (y % 3), 1, '#8a7a6a');
    f(bx, 110, 100, 3, '#3a3352'); f(bx, 110, 100, 1, '#5d5378');
  }
  // Press housing under the right block
  const P0 = X(MAP.press.x0), P1 = X(MAP.press.x1);
  f(P0 - 3, 200, 3, 128, '#2b2540'); f(P1, 200, 3, 128, '#2b2540'); f(P0 - 3, 200, 1, 128, '#4b4366');
  for (let y = 206; y < 328; y += 10) { f(P0 - 3, y, 3, 2, P.hazard); f(P1, y, 3, 2, P.hazard); }
  return c;
}

function paintSolids() {
  const c = mk(VIEW_W, VIEW_H), g = c.getContext('2d');
  const id = g.createImageData(VIEW_W, VIEW_H), D = id.data, w = VIEW_W;
  const rnd = seeded(55);
  const conc = [R(P.conc5), R(P.conc4), R(P.conc3), R(P.conc2), R(P.conc1), R(P.conc0)];
  for (const s of MAP.solids) {
    if (s.kind === 'wall' || s.kind === 'pit') continue;
    const x0 = X(s.x0), x1 = X(s.x1), y0 = X(s.y0), y1 = Math.min(VIEW_H, X(s.y1));
    for (let y = y0; y < y1; y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const ly = y - y0;
      let col;
      if (ly === 0) col = conc[0];
      else if (ly === 1) col = conc[1];
      else if (ly < 4) col = conc[2];
      else {
        col = conc[3];
        const n = (x * 13 + y * 7) % 29, n2 = (x * 5 + y * 11) % 37;
        if (n === 0) col = conc[4];
        if (n2 === 0) col = conc[2];
        if (s.kind === 'block' && (ly % 8 === 0 || (x + (Math.floor(ly / 8) % 2) * 8) % 16 === 0)) col = conc[4];
        if (s.kind === 'floor' && x % 64 === 0) col = conc[5];
        if (bayer(x, y) < (ly - 4) / 50) col = conc[4];
      }
      if (x === x0 && x0 > 0) col = conc[1];
      if (x === x1 - 1 && x1 < w) col = conc[4];
      setPx(D, w, x, y, col);
    }
    if (s.kind === 'floor') {
      for (let i = 0; i < 6; i++) {
        const cx = x0 + rnd() * (x1 - x0), cy = y0 + 8 + rnd() * 20, rx = 6 + rnd() * 14;
        for (let y = cy - 3; y < cy + 3; y++) for (let x = cx - rx; x < cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / 3) ** 2 < 1 && bayer(x | 0, y | 0) < 0.6) setPx(D, w, x | 0, y | 0, conc[4]);
      }
    }
  }
  // Hazard stripes on the pit lip
  for (const [a, b] of [[X(MAP.pit.x0) - 18, X(MAP.pit.x0)], [X(MAP.pit.x1), X(MAP.pit.x1) + 18]]) for (let y = 330; y < 336; y++) for (let x = a; x < b; x++) setPx(D, w, x, y, ((x + y) >> 1) % 2 ? R(P.hazard) : R('#1d1a26'));
  // Pit interior
  const pa = X(MAP.pit.x0), pb = X(MAP.pit.x1);
  for (let y = 328; y < VIEW_H; y++) for (let x = pa; x < pb; x++) {
    const t = (y - 328) / 32;
    let col = R(mix('#1a1424', '#07050c', t));
    if (x < pa + 3) col = R('#2a2236'); if (x > pb - 4) col = R('#0c0914');
    setPx(D, w, x, y, col);
  }
  g.putImageData(id, 0, 0);
  // Booth window frames and office signs
  g.fillStyle = '#2b2540'; g.fillRect(98, 110, 4, 52); g.fillRect(538, 110, 4, 52);
  g.fillStyle = '#5d5378'; g.fillRect(98, 110, 1, 52); g.fillRect(538, 110, 1, 52);
  drawText(g, 'ESCRITÓRIO', 6, 186, { color: '#8a7f95', shadow: '#1d1a28' });
  drawText(g, 'PRENSA 3T', 572, 186, { color: '#e7b448', shadow: '#1d1a28' });
  return c;
}

function paintPlatformFronts() {
  const c = mk(VIEW_W, VIEW_H), g = c.getContext('2d');
  const f = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  for (const p of MAP.oneway) {
    const x0 = X(p.x0), x1 = X(p.x1), y = X(p.y), h = X(p.h);
    if (p.kind === 'gantry') {
      f(x0, y, x1 - x0, h, '#2e2844'); f(x0, y, x1 - x0, 1, '#8a80a8'); f(x0, y + 1, x1 - x0, 1, '#5d5378'); f(x0, y + h - 1, x1 - x0, 1, '#15111f');
      for (let x = x0 + 4; x < x1; x += 8) { f(x, y + 3, 1, 1, '#7a70a0'); f(x, y + h - 3, 1, 1, '#7a70a0'); }
      continue;
    }
    f(x0, y, x1 - x0, 1, '#a49ac0'); f(x0, y + 1, x1 - x0, 1, '#6a6088');
    for (let x = x0; x < x1; x++) for (let yy = y + 2; yy < y + h - 1; yy++) f(x, yy, 1, 1, (x + (yy % 2)) % 3 === 0 ? '#120e1c' : '#3e3757');
    f(x0, y + h - 1, x1 - x0, 1, '#1d182c');
    for (const ex of [x0, x1 - 4]) for (let yy = y + 2; yy < y + h - 1; yy++) f(ex, yy, 4, 1, (yy % 2) ? P.hazard : '#241f2c');
  }
  return c;
}

function paintForeground() {
  const c = mk(VIEW_W, VIEW_H), g = c.getContext('2d');
  const ink = '#0b0812', rim = '#2d2442';
  const f = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // hanging chains at the top corners
  for (const [x, len] of [[6, 46], [14, 30], [628, 54], [619, 34]]) {
    for (let y = 0; y < len; y += 4) { f(x - 1, y, 3, 3, ink); f(x, y + 1, 1, 1, rim); }
    f(x - 2, len, 5, 4, ink); f(x - 2, len + 4, 2, 3, ink);
  }
  // pipe across the bottom-left and debris on the right
  f(0, 344, 92, 9, ink); f(0, 344, 92, 1, rim); f(88, 342, 7, 13, ink); f(88, 342, 7, 1, rim);
  for (let x = 520; x < 640; x++) { const h = 6 + Math.round(Math.sin(x * 0.17) * 3 + Math.sin(x * 0.05) * 4); f(x, VIEW_H - h, 1, h, ink); if (x % 7 === 0) f(x, VIEW_H - h, 1, 1, rim); }
  // caution tape
  for (let x = 400; x < 520; x++) { const y = 352 + Math.round((x - 400) * 0.02); f(x, y, 1, 3, ((x >> 3) % 2) ? '#8a6a2c' : '#151018'); }
  return c;
}

// ---- props --------------------------------------------------------------------------------
export class World {
  constructor() {
    this.sky = paintSky();
    this.cloudsFar = paintClouds(3, 70, 130, 7, '#3a2d5c', '#b5596a', '#4c3d72');
    this.cloudsNear = paintClouds(11, 120, 200, 6, '#2a2148', '#e0745e', '#3a2d5c');
    this.far = paintCity(21, VIEW_W + MARGIN * 4, 288, [30, 90], { body: '#2c2448', rim: '#463a68', win: '#a86a62', win2: '#e8a26a', winGap: 3, winW: 1, lit: 0.18, maxW: 26, haze: '#7a4068', hazeAmt: 0.8 });
    this.industry = paintIndustry();
    this.fogA = paintFog(5, '#6a4a7a', 0.55);
    this.fogB = paintFog(9, '#3a2c52', 0.7);
    this.wall = paintWall();
    this.back = paintBack();
    this.solids = paintSolids();
    this.fronts = paintPlatformFronts();
    this.fg = paintForeground();
    this.smoke = [];
  }

  drawBackground(g, t, cam) {
    const par = k => [Math.round(-MARGIN + cam.x * k), Math.round(-MARGIN + cam.y * k)];
    let [x, y] = par(0.05);
    g.drawImage(this.sky, x, y);
    const twinkle = Math.floor(t * 3);
    g.fillStyle = '#fff6e8';
    for (let i = 0; i < 6; i++) { const s = (i * 97 + twinkle * 31) % 640, sy = (i * 53 + twinkle * 17) % 120; if ((twinkle + i) % 3 === 0) g.fillRect(s, sy, 1, 1); }
    const cf = (t * 2) % 1360, cn = (t * 5) % 1360;
    g.drawImage(this.cloudsFar, Math.round(-cf + cam.x * 0.08), 60); g.drawImage(this.cloudsFar, Math.round(1360 - cf + cam.x * 0.08), 60);
    [x, y] = par(0.15);
    g.drawImage(this.far.canvas, x - MARGIN, y);
    if (Math.floor(t * 1.5) % 2) { g.fillStyle = '#ff5a5a'; for (const [bx, by] of this.far.blinks) g.fillRect(bx + x - MARGIN, by + y, 1, 1); }
    g.drawImage(this.cloudsNear, Math.round(-cn + cam.x * 0.12), 110); g.drawImage(this.cloudsNear, Math.round(1360 - cn + cam.x * 0.12), 110);
    [x, y] = par(0.3);
    g.drawImage(this.fogA, Math.round(-((t * 3) % 640) + x), 236);
    g.drawImage(this.industry.canvas, x - MARGIN, y);
    // chimney smoke
    if (Math.random() < 0.35) for (const [sx, sy] of this.industry.stacks) this.smoke.push({ x: sx + (Math.random() - 0.5) * 3, y: sy, r: 2, life: 1 });
    for (const s of this.smoke) { s.y -= 0.18; s.x += 0.12; s.r += 0.04; s.life -= 0.004; }
    this.smoke = this.smoke.filter(s => s.life > 0 && s.y > -20);
    for (const s of this.smoke) {
      g.fillStyle = s.life > 0.6 ? '#4a3d62' : '#3a2f52';
      const r = Math.round(s.r);
      g.fillRect(Math.round(s.x + x - MARGIN - r), Math.round(s.y + y - r), r * 2, r * 2);
    }
    g.drawImage(this.fogB, Math.round(-((t * 6) % 640) + x), 262);
    g.drawImage(this.fogB, Math.round(640 - ((t * 6) % 640) + x), 262);
  }
}
