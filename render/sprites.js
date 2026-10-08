// Vector part definitions rasterized into shaded pixel sprites. Rotation happens on the geometry,
// so outlines stay one pixel wide and the light stays fixed in screen space at any angle.
import { ramp, hexToRgb } from '../engine/palette.js';
import { bayer } from '../engine/const.js';

const LIGHT = (() => { const v = [-0.55, -0.72, 0.62]; const l = Math.hypot(...v); return v.map(x => x / l); })();
export const ANGLE_STEPS = 64;
const STEP = (Math.PI * 2) / ANGLE_STEPS;
export const angleBucket = a => ((Math.round(a / STEP) % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;

// mats: { key: { hex, gloss, flat, light } } -> resolved ramps
export function material(hex, opts = {}) {
  const r = ramp(hex);
  return { ramp: r.rgb, hex: r.hex, gloss: !!opts.gloss, flat: !!opts.flat, emissive: !!opts.emissive, noOutline: !!opts.noOutline };
}

function shapeBounds(s) {
  if (s.t === 'ellipse') { const r = Math.max(s.rx, s.ry); return [s.x - r, s.y - r, s.x + r, s.y + r]; }
  if (s.t === 'capsule') { const r = Math.max(s.r1, s.r2 ?? s.r1); return [Math.min(s.x1, s.x2) - r, Math.min(s.y1, s.y2) - r, Math.max(s.x1, s.x2) + r, Math.max(s.y1, s.y2) + r]; }
  if (s.t === 'rect' || s.t === 'cyl' || s.t === 'cylh') return [s.x, s.y, s.x + s.w, s.y + s.h];
  if (s.t === 'poly') { const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  return [0, 0, 0, 0];
}

// Returns [nx, ny, nz] or null when the point is outside.
function hit(s, x, y) {
  const b = s.b ?? 0.8;
  if (s.t === 'ellipse') {
    let dx = x - s.x, dy = y - s.y;
    if (s.rot) { const c = Math.cos(-s.rot), si = Math.sin(-s.rot); [dx, dy] = [dx * c - dy * si, dx * si + dy * c]; }
    const u = dx / s.rx, v = dy / s.ry, d2 = u * u + v * v;
    if (d2 > 1) return null;
    let nx = u * b, ny = v * b;
    if (s.rot) { const c = Math.cos(s.rot), si = Math.sin(s.rot); [nx, ny] = [nx * c - ny * si, nx * si + ny * c]; }
    return [nx, ny, Math.sqrt(1 - d2)];
  }
  if (s.t === 'capsule') {
    const r2 = s.r2 ?? s.r1, dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / l2));
    const qx = s.x1 + dx * t, qy = s.y1 + dy * t, r = s.r1 + (r2 - s.r1) * t;
    const ox = (x - qx) / r, oy = (y - qy) / r, d2 = ox * ox + oy * oy;
    if (d2 > 1) return null;
    return [ox * b, oy * b, Math.sqrt(1 - d2)];
  }
  if (s.t === 'rect') {
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return null;
    const r = s.r || 0;
    const ix = Math.max(s.x + r, Math.min(s.x + s.w - r, x)), iy = Math.max(s.y + r, Math.min(s.y + s.h - r, y));
    const dx = x - ix, dy = y - iy, d = Math.hypot(dx, dy);
    if (r > 0 && d > r) return null;
    if (r > 0 && d > 0) { const ox = dx / r, oy = dy / r; return [ox * b, oy * b, Math.sqrt(Math.max(0, 1 - ox * ox - oy * oy))]; }
    const e = Math.min(x - s.x, s.x + s.w - x, y - s.y, s.y + s.h - y), ew = s.edge ?? 1.2;
    if (e < ew) {
      const k = (1 - e / ew) * b;
      const nx = x - s.x < ew ? -k : s.x + s.w - x < ew ? k : 0, ny = y - s.y < ew ? -k : s.y + s.h - y < ew ? k : 0;
      return [nx, ny, 1];
    }
    return [0, 0, 1];
  }
  if (s.t === 'cyl' || s.t === 'cylh') {
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return null;
    const u = s.t === 'cyl' ? (x - s.x - s.w / 2) / (s.w / 2) : (y - s.y - s.h / 2) / (s.h / 2);
    const nz = Math.sqrt(Math.max(0.05, 1 - u * u));
    return s.t === 'cyl' ? [u * b, 0, nz] : [0, u * b, nz];
  }
  if (s.t === 'poly') {
    const p = s.pts;
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    }
    if (!inside) return null;
    const ew = s.edge ?? 1.6;
    let best = Infinity, bnx = 0, bny = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const ax = p[j][0], ay = p[j][1], ex = p[i][0] - ax, ey = p[i][1] - ay, l2 = ex * ex + ey * ey || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
      const d = Math.hypot(x - ax - ex * t, y - ay - ey * t);
      if (d < best) { best = d; const l = Math.sqrt(l2); bnx = ey / l; bny = -ex / l; }
    }
    // Make the normal point outward regardless of winding.
    const cx = p.reduce((m, q) => m + q[0], 0) / p.length, cy = p.reduce((m, q) => m + q[1], 0) / p.length;
    if (bnx * (x - cx) + bny * (y - cy) < 0) { bnx = -bnx; bny = -bny; }
    if (best < ew) { const k = (1 - best / ew) * b; return [bnx * k, bny * k, 1]; }
    return [0, 0, 1];
  }
  return null;
}

const cache = new Map();
let cacheBytes = 0;
export function cacheStats() { return { sprites: cache.size, kb: Math.round(cacheBytes / 1024) }; }

// def: { key, shapes: [...], details: [...] }, mats: { name: material }
export function sprite(def, mats, { angle = 0, mirror = 1, scale = 1, variant = '', matsKey = '' } = {}) {
  const bucket = angleBucket(angle);
  const key = def.key + '|' + matsKey + '|' + variant + '|' + bucket + '|' + mirror + '|' + scale;
  let s = cache.get(key);
  if (s) return s;
  // Long sessions touch many angle/variant combinations; start over past ~48MB of pixels.
  if (cacheBytes > 48e6) { cache.clear(); cacheBytes = 0; }
  s = rasterize(def, mats, bucket * STEP, mirror, scale, variant);
  cache.set(key, s);
  cacheBytes += s.w * s.h * 4;
  return s;
}

function rasterize(def, mats, angle, mirror, scale, variant) {
  const shapes = def.shapes.slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const ca = Math.cos(angle), sa = Math.sin(angle);
  // Screen-space bounds from transformed local bounds.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sh of shapes) {
    const [bx0, by0, bx1, by1] = shapeBounds(sh);
    for (const [lx, ly] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) {
      const mx = lx * mirror * scale, my = ly * scale;
      const sx = mx * ca - my * sa, sy = mx * sa + my * ca;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
  }
  const ox = Math.ceil(-x0) + 2, oy = Math.ceil(-y0) + 2;
  const w = Math.max(1, Math.ceil(x1) + ox + 2), h = Math.max(1, Math.ceil(y1) + oy + 2);
  const top = new Int16Array(w * h).fill(-1);
  const tone = new Int8Array(w * h);
  const darkShift = variant.includes('far') ? 1 : 0;
  const inv = 1 / scale;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const sx = px + 0.5 - ox, sy = py + 0.5 - oy;
      let lx = (sx * ca + sy * sa) * inv, ly = (-sx * sa + sy * ca) * inv;
      lx *= mirror;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const n = hit(shapes[i], lx, ly);
        if (!n) continue;
        const m = mats[shapes[i].m];
        let nx = n[0] * mirror, ny = n[1];
        [nx, ny] = [nx * ca - ny * sa, nx * sa + ny * ca];
        const len = Math.hypot(nx, ny, n[2]) || 1;
        let d = (nx * LIGHT[0] + ny * LIGHT[1] + n[2] * LIGHT[2]) / len;
        if (m?.flat) d = 0.55 + d * 0.25;
        d += (bayer(px, py) - 0.5) * 0.09;
        let t = d > 0.9 && m?.gloss ? 4 : d > 0.97 ? 4 : d > 0.62 ? 3 : d > 0.24 ? 2 : 1;
        if (m?.emissive) t = Math.max(3, t);
        tone[py * w + px] = Math.max(1, t - darkShift);
        top[py * w + px] = i;
        break;
      }
    }
  }
  const img = new ImageData(w, h);
  const D = img.data;
  const put = (i, rgb, a = 255) => { D[i * 4] = rgb[0]; D[i * 4 + 1] = rgb[1]; D[i * 4 + 2] = rgb[2]; D[i * 4 + 3] = a; };
  const tint = variantTint(variant);
  const color = (m, t) => { const c = m.ramp[Math.max(0, Math.min(4, t))]; return tint ? tint(c, t) : c; };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px, si = top[i];
      if (si < 0) continue;
      const sh = shapes[si], m = mats[sh.m];
      if (!m) continue;
      let t = tone[i];
      // Cast shadow from shapes stacked above, falling away from the light.
      if (sh.recv !== false) {
        const up = py > 0 ? top[i - w] : -1, ul = py > 0 && px > 0 ? top[i - w - 1] : -1, l1 = px > 0 ? top[i - 1] : -1;
        for (const q of [up, ul, l1]) if (q > si && shapes[q].cast !== false && (shapes[q].z ?? 0) > (sh.z ?? 0)) { t = Math.max(1, t - 1); break; }
      }
      // Contour where a lined shape sits on top of a lower one.
      if (sh.line) {
        const nb = [px > 0 ? top[i - 1] : -1, px < w - 1 ? top[i + 1] : -1, py > 0 ? top[i - w] : -1, py < h - 1 ? top[i + w] : -1];
        if (nb.some(q => q >= 0 && q < si && shapes[q].m !== sh.m)) t = sh.line === 'soft' ? Math.max(1, t - 1) : 0;
      }
      put(i, color(m, t));
    }
  }
  // Selective outer outline: darker on the shadow side, softer toward the light.
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (top[i] >= 0) continue;
      let src = -1, lit = false;
      const r = px < w - 1 ? top[i + 1] : -1, b = py < h - 1 ? top[i + w] : -1, l = px > 0 ? top[i - 1] : -1, u = py > 0 ? top[i - w] : -1;
      if (r >= 0) { src = r; lit = true; } else if (b >= 0) { src = b; lit = true; } else if (l >= 0) src = l; else if (u >= 0) src = u;
      if (src < 0) continue;
      const m = mats[shapes[src].m];
      if (!m || m.noOutline) continue;
      put(i, lit ? mix3(color(m, 0), INK, 0.25) : mix3(color(m, 0), INK, 0.55));
    }
  }
  for (const d of def.details || []) drawDetail(D, w, h, top, d, ox, oy, ca, sa, mirror, scale, tint, mats, darkShift);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(img, 0, 0);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = D[i * 4 + 3] > 0 ? 1 : 0;
  return { canvas, w, h, ox, oy, mask, ca, sa, mirror, scale };
}

function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

const CHAR = [42, 26, 28], ICE = hexToRgb('#a8e4ff'), ICE_HI = hexToRgb('#f2fdff'), INK = [20, 14, 30];
function variantTint(variant) {
  const charLevel = /char(\d)/.exec(variant)?.[1];
  const ice = variant.includes('ice');
  const flash = variant.includes('flash');
  if (!charLevel && !ice && !flash) return null;
  return (c, t) => {
    if (flash) return [255, 244, 228];
    let out = c;
    if (charLevel) out = mix3(out, CHAR, Math.min(0.85, charLevel * 0.28));
    if (ice) out = mix3(out, t >= 3 ? ICE_HI : ICE, 0.62);
    return out;
  };
}

function drawDetail(D, w, h, top, d, ox, oy, ca, sa, mirror, scale, tint, mats, darkShift) {
  let rgb;
  if (d.m) { const m = mats[d.m]; if (!m) return; rgb = m.ramp[Math.max(0, Math.min(4, d.tone - (d.tone > 0 ? darkShift : 0)))]; }
  else rgb = d.rgb || (d.rgb = hexToRgb(d.c));
  const col = tint ? tint(rgb, 2) : rgb;
  const toScreen = (x, y) => {
    const mx = x * mirror * scale, my = y * scale;
    return [Math.floor(mx * ca - my * sa + ox), Math.floor(mx * sa + my * ca + oy)];
  };
  const plot = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (!d.over && top[i] < 0) return;
    D[i * 4] = col[0]; D[i * 4 + 1] = col[1]; D[i * 4 + 2] = col[2]; D[i * 4 + 3] = 255;
  };
  if (d.t === 'px') { const [x, y] = toScreen(d.x, d.y); plot(x, y); return; }
  if (d.t === 'line') {
    let [xa, ya] = toScreen(d.x1, d.y1);
    const [xb, yb] = toScreen(d.x2, d.y2);
    const dx = Math.abs(xb - xa), dy = -Math.abs(yb - ya), sx = xa < xb ? 1 : -1, sy = ya < yb ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 64; n++) {
      plot(xa, ya);
      if (xa === xb && ya === yb) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; xa += sx; }
      if (e2 <= dx) { err += dx; ya += sy; }
    }
    return;
  }
  if (d.t === 'dot') {
    const r = d.r ?? 0.6;
    const [cx, cy] = toScreen(d.x, d.y);
    const rr = Math.ceil(r * scale) + 1;
    for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) {
      const sx = x + 0.5 - ox, sy = y + 0.5 - oy;
      let lx = (sx * ca + sy * sa) / scale, ly = (-sx * sa + sy * ca) / scale;
      lx *= mirror;
      if (((lx - d.x) / (d.rx ?? r)) ** 2 + ((ly - d.y) / (d.ry ?? r)) ** 2 <= 1) plot(x, y);
    }
  }
}

// Pixels on the sprite edge facing (dx, dy), tinted: a per-sprite rim light mask.
const rimCache = new WeakMap();
export function rimSprite(sp, dx, dy, color) {
  let m = rimCache.get(sp);
  if (!m) { m = new Map(); rimCache.set(sp, m); }
  const key = dx + ',' + dy + color;
  let c = m.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = sp.w; c.height = sp.h;
  const g = c.getContext('2d'), id = g.createImageData(sp.w, sp.h), D = id.data;
  const rgb = hexToRgb(color);
  for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
    if (!sp.mask[y * sp.w + x]) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < sp.w && ny < sp.h && sp.mask[ny * sp.w + nx]) continue;
    const i = (y * sp.w + x) * 4;
    D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  m.set(key, c);
  return c;
}

// Tinted silhouette of a cached sprite, e.g. for rim light or the hurt flash.
const silCache = new WeakMap();
export function silhouette(sp, color) {
  let m = silCache.get(sp);
  if (!m) { m = new Map(); silCache.set(sp, m); }
  let c = m.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = sp.w; c.height = sp.h;
  const g = c.getContext('2d');
  g.drawImage(sp.canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, sp.w, sp.h);
  m.set(color, c);
  return c;
}
