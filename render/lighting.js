// Pixel-art lighting: banded, dithered light cookies added into a half-resolution light map
// (2px light texels) that multiplies the scene. Static lights are baked once.
import { VIEW_W, VIEW_H, S, bayer } from '../engine/const.js';
import { hexToRgb } from '../engine/palette.js';
import { MAP } from '../sim/map.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => Math.round(v * S);
export const AMBIENT = '#4f4682';
export const LW = VIEW_W / 2, LH = VIEW_H / 2;

const cookieCache = new Map();
const RADII = [5, 7, 10, 14, 19, 25, 32, 40, 50, 62, 75, 90];
const bucketR = r => RADII.find(x => x >= r) || RADII[RADII.length - 1];

// r is in light-map texels (half view pixels).
export function cookie(r, color, kind = 'point', angle = 0, spread = 0.55) {
  r = bucketR(r);
  const ab = kind === 'cone' ? Math.round(angle / (Math.PI / 24)) : 0;
  const key = `${r}|${color}|${kind}|${ab}|${spread}`;
  let c = cookieCache.get(key);
  if (c) return c;
  const size = r * 2;
  c = mk(size, size);
  const g = c.getContext('2d'), id = g.createImageData(size, size), D = id.data;
  const [cr, cg, cb] = hexToRgb(color);
  const ang = ab * (Math.PI / 24);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - r, dy = y + 0.5 - r, d = Math.hypot(dx, dy) / r;
    if (d >= 1) continue;
    let v = Math.pow(1 - d, 1.35);
    if (kind === 'cone') {
      const a = Math.atan2(dx, dy) - ang;
      const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      const k = off < spread ? 1 : off < spread * 1.45 ? 1 - (off - spread) / (spread * 0.45) : 0;
      v = v * k + Math.max(0, 1 - d * 5) * 0.7;
    }
    const q = v * 4, base = Math.floor(q), frac = q - base;
    const level = Math.min(4, base + (frac > 0.3 + bayer(x, y) * 0.4 ? 1 : 0)) / 4;
    if (level <= 0) continue;
    const i = (y * size + x) * 4;
    D[i] = cr * level; D[i + 1] = cg * level; D[i + 2] = cb * level; D[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  c.key = key;
  cookieCache.set(key, c);
  return c;
}

// Moonlight falling through the arena's windows (MAP.windows, view pixels).
function moonShafts(w, h, k, windows = MAP.windows || []) {
  const c = mk(w, h), g = c.getContext('2d');
  const dx = -0.42, dy = 1;
  const id = g.createImageData(w, h), D = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const vx = x * k, vy = y * k;
    let v = 0;
    for (const win of windows) {
      const t = (vy - (win.y + win.h)) / dy;
      if (t < -win.h) continue;
      const sx = vx - dx * Math.max(0, t);
      if (sx <= win.x + 6 || sx >= win.x + win.w - 6) continue;
      if (t < 0) { v = Math.max(v, 0.9); continue; }
      v = Math.max(v, Math.max(0, 1 - t / 200) * 0.85);
    }
    if (v <= 0) continue;
    const q = v * 3, base = Math.floor(q), level = (base + ((q - base) > bayer(x, y) ? 1 : 0)) / 3;
    const i = (y * w + x) * 4;
    D[i] = 62 * level; D[i + 1] = 76 * level; D[i + 2] = 136 * level; D[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}

function occluders() {
  const list = [];
  for (const s of MAP.solids) if (s.kind === 'block') list.push({ x0: X(s.x0), y0: X(s.y0), x1: X(s.x1), y1: X(s.y1), a: 1 });
  for (const p of MAP.oneway) list.push({ x0: X(p.x0), y0: X(p.y), x1: X(p.x1), y1: X(p.y + p.h), a: p.kind === 'gantry' ? 0.9 : 0.55 });
  return list;
}

export class Lighting {
  constructor() {
    this.map = mk(LW, LH);
    this.g = this.map.getContext('2d');
    this.tmps = new Map();
    this.occCache = new Map();
    this.setMap();
    this.lights = [];
    this.statics = [];
    this.bases = {};
  }

  // The arena changed: its moonlight and the shapes that cast shadows.
  setMap() {
    this.shafts = moonShafts(VIEW_W, VIEW_H, 1);
    this.shaftsLow = moonShafts(LW, LH, 2);
    this.occ = occluders();
    this.occCache.clear();
  }

  tmp(size) {
    let t = this.tmps.get(size);
    if (!t) { const c = mk(size, size); t = { c, g: c.getContext('2d') }; this.tmps.set(size, t); }
    return t;
  }

  // Bake ambient, moon shafts and fixed lights; 'tag' lights only appear in the matching base.
  setStatic(lights) {
    this.statics = lights;
    for (const tag of ['on', 'off']) {
      const c = mk(LW, LH), g = c.getContext('2d');
      g.fillStyle = AMBIENT;
      g.fillRect(0, 0, LW, LH);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.6;
      g.drawImage(this.shaftsLow, 0, 0);
      for (const l of lights) if (!l.tag || l.tag === tag) this.addLight(g, l);
      this.bases[tag] = c;
    }
  }

  begin(neonOn = true) { this.lights.length = 0; this.neonOn = neonOn; }
  add(l) { if (l.i > 0.02 && l.r > 2) this.lights.push(l); }

  render() {
    const g = this.g;
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = 1;
    g.drawImage(this.bases[this.neonOn ? 'on' : 'off'], 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const l of this.lights) this.addLight(g, l);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  addLight(g, l) {
    const c = cookie(l.r / 2, l.color, l.kind, l.angle || 0, l.spread || 0.55);
    const r = c.width / 2, lx = l.x / 2, ly = l.y / 2;
    g.globalAlpha = Math.min(1, l.i);
    if (!l.occlude) { g.drawImage(c, Math.round(lx - r), Math.round(ly - r)); return; }
    // Occluded cookies are cached per texel position: lamps and fires barely move between frames.
    const qx = Math.round(lx), qy = Math.round(ly);
    const key = c.key + '|' + qx + '|' + qy;
    let oc = this.occCache.get(key);
    if (!oc) {
      oc = mk(c.width, c.height);
      const tg = oc.getContext('2d');
      tg.drawImage(c, 0, 0);
      tg.globalCompositeOperation = 'destination-out';
      for (const o of this.occ) this.cutShadow(tg, o, qx, qy, r, qx - r, qy - r);
      this.occCache.set(key, oc);
      if (this.occCache.size > 320) this.occCache.delete(this.occCache.keys().next().value);
    }
    g.drawImage(oc, qx - r, qy - r);
  }

  cutShadow(tg, o, lx, ly, r, ox, oy) {
    const x0 = o.x0 / 2, x1 = o.x1 / 2, y0 = o.y0 / 2, y1 = o.y1 / 2;
    if (lx > x0 && lx < x1 && ly > y0 && ly < y1) return;
    if (x1 < lx - r || x0 > lx + r || y1 < ly - r || y0 > ly + r) return;
    tg.fillStyle = `rgba(0,0,0,${o.a})`;
    const edges = [[x0, y0, x1, y0, 0, -1], [x1, y0, x1, y1, 1, 0], [x1, y1, x0, y1, 0, 1], [x0, y1, x0, y0, -1, 0]];
    const far = r * 6;
    tg.beginPath();
    for (const [ax, ay, bx, by, nx, ny] of edges) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      if (nx * (mx - lx) + ny * (my - ly) <= 0) continue;
      const da = Math.hypot(ax - lx, ay - ly) || 1, db = Math.hypot(bx - lx, by - ly) || 1;
      tg.moveTo(ax - ox, ay - oy);
      tg.lineTo(bx - ox, by - oy);
      tg.lineTo(bx + (bx - lx) / db * far - ox, by + (by - ly) / db * far - oy);
      tg.lineTo(ax + (ax - lx) / da * far - ox, ay + (ay - ly) / da * far - oy);
      tg.closePath();
    }
    tg.fill();
  }

  rimAt(x, y, count = 2) {
    const out = [];
    for (const list of [this.lights, this.statics]) for (const l of list) {
      if (l.noRim || (l.tag === 'on' && !this.neonOn)) continue;
      const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy);
      if (d > l.r || d < 1) continue;
      if (l.kind === 'cone') {
        const a = Math.atan2(dx, dy) - (l.angle || 0);
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > (l.spread || 0.55) * 1.3) continue;
      }
      out.push({ k: (1 - d / l.r) * l.i, dx: -dx / d, dy: -dy / d, color: l.color });
    }
    out.sort((a, b) => b.k - a.k);
    return out.slice(0, count);
  }
}
