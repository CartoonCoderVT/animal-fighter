// Turns pixel-matrix fighters into cached canvases: whole figures for live fighters and
// RotSprite-rotated single parts for ragdolls.
import { CAST, composeChars, composePart, composeTubes, paletteFor, rotate, mirror, snapDeg, slotPoint, castFor } from './pixel-data.js';
import { hexToRgb } from '../engine/palette.js';

// Sprite canvases stay in CPU memory: they are composited into the fighter's CPU canvas every
// frame, and GPU-backed sources would force a slow readback each time.
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; };
const rgb = new Map();
const toRgb = hex => { let v = rgb.get(hex); if (!v) { v = hexToRgb(hex); rgb.set(hex, v); } return v; };

function toCanvas(rows, palette) {
  const h = rows.length, w = rows[0].length, c = mk(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const [r, gg, b] = toRgb(palette[ch] || '#ff00ff'), k = (y * w + x) * 4;
      d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

class LRU {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) { const v = this.map.get(k); if (v) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k, v) { this.map.set(k, v); if (this.map.size > this.max) this.map.delete(this.map.keys().next().value); }
  clear() { this.map.clear(); }
}
const figures = new LRU(700), parts = new LRU(900), overlays = new LRU(400);
export function clearArtCache() { figures.clear(); parts.clear(); overlays.clear(); }

const woundKey = w => (w ? JSON.stringify(w) : '');

export function variantOf(a, time) {
  const q = a.char > 0.85 ? 3 : a.char > 0.55 ? 2 : a.char > 0.25 ? 1 : 0;
  let v = q ? 'char' + q : '';
  if (a.frozen > 0) v += 'ice';
  if (a.shock > 0 && Math.floor(time * 18) % 2 === 0) v += 'xray';
  // The white flash strobes through the hitlag freeze, so the impact pose still reads.
  else if (a.hurt > 0.135 && !(a.frozen > 0) && !(a.hitlag > 0 && Math.floor(time * 30) % 2)) v += 'flash';
  return v;
}

// The figure for an actor this frame (f from frameFor). With chains, tails and scarf ends are left
// out of the cached body and come back as a per-frame overlay drawn behind it.
// x0/y0 place each canvas relative to the feet, facing right.
export function figureSprite(a, f, variant = '', chains = null) {
  const severed = a.severed || [];
  const frame = chains ? { ...f.frame, tail: false, scarf: false } : f.frame;
  const key = a.type + (a.form || '') + '|' + JSON.stringify(frame) + '|' + f.expr + '|' + variant + '|' + severed.join(',') + '|' + woundKey(a.wounds);
  const ch = castFor(a.type, a.form);
  let s = figures.get(key);
  if (!s) {
    const out = composeChars(ch, frame, { expr: f.expr, wounds: a.wounds, severed });
    s = { canvas: toCanvas(out.rows, paletteFor(ch, variant)), flipped: null, x0: out.x0, y0: out.y0, w: out.w, h: out.h };
    figures.set(key, s);
  }
  let overlay = null;
  if (chains && !severed.includes('body')) {
    const out = composeTubes(ch, chains);
    if (out) {
      const okey = a.type + (a.form || '') + variant + '|' + out.x0 + ',' + out.y0 + '|' + out.rows.join('/');
      overlay = overlays.get(okey);
      if (!overlay) { overlay = { canvas: toCanvas(out.rows, paletteFor(ch, variant)), flipped: null, x0: out.x0, y0: out.y0, w: out.w, h: out.h }; overlays.set(okey, overlay); }
    }
  }
  return { s, overlay };
}

function flipped(s) {
  if (!s.flipped) {
    const c = mk(s.w, s.h), g = c.getContext('2d');
    g.translate(s.w, 0); g.scale(-1, 1); g.drawImage(s.canvas, 0, 0);
    s.flipped = c;
  }
  return s.flipped;
}

// Draws a figure with its feet at (fx, fy) in canvas pixels.
export function drawFigure(g, s, fx, fy, face = 1, scale = 1) {
  if (face >= 0) g.drawImage(s.canvas, fx + s.x0 * scale, fy + s.y0 * scale, s.w * scale, s.h * scale);
  else g.drawImage(flipped(s), fx - (s.x0 + s.w - 1) * scale, fy + s.y0 * scale, s.w * scale, s.h * scale);
}

// A point on a slot (cells from its pivot) in canvas pixels for a drawn figure.
export function figurePoint(frame, slot, u, v, fx, fy, face = 1, scale = 1, ch = null) {
  const [x, y] = slotPoint(slot, frame, u, v, ch);
  return { x: fx + x * face * scale, y: fy + y * scale };
}

// A ragdoll part rotated to the physics angle. (px, py) is the cell that sits on the body center.
export function partSprite(l, variant = '', expr = '') {
  const face = l.face || 1;
  const deg = snapDeg((l.angle * 180) / Math.PI) * face;
  const key = l.type + (l.form || '') + '|' + l.part + '|' + deg + '|' + face + '|' + variant + '|' + expr + '|' + (l.cut || []).join(',') + '|' + woundKey(l.wounds);
  let s = parts.get(key);
  if (!s) {
    const ch = castFor(l.type, l.form);
    const base = composePart(ch, l.part, { expr, wounds: { [l.part]: l.wounds }, severed: l.cut || [] });
    if (!base) return null;
    let { m, piv } = rotate(base.rows, base.piv, deg);
    if (face < 0) { m = mirror(m); piv = [m[0].length - 1 - piv[0], piv[1]]; }
    s = { canvas: toCanvas(m, paletteFor(ch, variant)), px: piv[0], py: piv[1] };
    parts.set(key, s);
  }
  return s;
}

// Flat dark copy of a figure (unselected fighters on the select screen).
export function shadowOf(s) {
  if (!s.shadow) {
    const c = mk(s.w, s.h), g = c.getContext('2d');
    g.drawImage(s.canvas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#0e0a18';
    g.fillRect(0, 0, s.w, s.h);
    s.shadow = { canvas: c, flipped: null, x0: s.x0, y0: s.y0, w: s.w, h: s.h };
  }
  return s.shadow;
}

// Flat-colored copy of a figure layer, cached per color (afterimages, impact frames).
export function tintOf(s, color) {
  s.tints ||= {};
  if (!s.tints[color]) {
    const c = mk(s.w, s.h), g = c.getContext('2d');
    g.drawImage(s.canvas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, s.w, s.h);
    s.tints[color] = { canvas: c, flipped: null, x0: s.x0, y0: s.y0, w: s.w, h: s.h };
  }
  return s.tints[color];
}
