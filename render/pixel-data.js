// Fighters as modular pixel matrices (SNES RPG style). Pure data + helpers, no DOM, so the
// art preview tool can run in Node. Legend for matrices in pixel-parts.js:
//   . empty  o outline  1/2/3 fur light/base/dark  4/5 belly light/shade  6/7 pink light/dark
//   8/9 markings dark/mid  e eye  w eye shine  r blush  x/y scarf light/dark
// Wound overlays painted onto parts: B blood  K dark blood  F flesh  O bone  U bruise  C/D burn  I/J frost
// Light comes from the top-left. Outlines are drawn around each part when it is composed,
// so a front part (head, near arm) gets a dark line where it overlaps what is behind it.
import { PARTS } from './pixel-parts.js';
import { DARK_NOX_PALETTE } from './dark-nox.js';

const FAR = { 1: '2', 2: '3', 4: '5', 6: '7', 9: '8', x: 'y' };

const PALETTES = {
  cat: { o: '#3b1b1e', 1: '#ffb763', 2: '#f08a3c', 3: '#c25e2c', 4: '#fff3dc', 5: '#f0cc9c', 6: '#ffb3c4', 7: '#e8728e', 8: '#a8482a', e: '#1e1420', w: '#ffffff', r: '#ff9c9c' },
  rat: { o: '#2b2238', 1: '#cec7dc', 2: '#a89fbc', 3: '#7b7192', 4: '#efe7f0', 5: '#d4c8d8', 6: '#ffb8ca', 7: '#ee7a9a', e: '#1e1420', w: '#ffffff', r: '#ffa0b6' },
  // Lola: pink-white fur under a wine outline, a light-blue bow and dress, a white apron, a gold watch.
  rabbit: { o: '#5c1f30', 1: '#ffffff', 2: '#ffe4ea', 3: '#f3aebf', 4: '#ffffff', 5: '#efd3df', 6: '#ff9db3', 7: '#e8668a', 8: '#3e64c4', 9: '#6aa2ee', x: '#b8e0ff', y: '#7fb0f0', e: '#2a1420', g: '#ffd47a', h: '#cf893a', r: '#e8405e' },
  ocelot: { o: '#3a2010', 1: '#ffd36c', 2: '#eca83e', 3: '#bf7a26', 4: '#fff2cf', 5: '#f0d39a', 6: '#e0a070', 7: '#d0605e', 8: '#5a2e18', 9: '#8a5028', e: '#1e1420', w: '#ffffff', r: '#ffa08a' },
  // Juma's beast form: deeper fur, near-black rosettes, ivory fangs and claws, burning eyes.
  ocelotBeast: { o: '#220c04', 1: '#f2a848', 2: '#c86c20', 3: '#8a4214', 4: '#f6e2b8', 5: '#d6ad78', 6: '#e09070', 7: '#b8343a', 8: '#2e1408', 9: '#62300f', e: '#140806', w: '#ffffff', r: '#ff7a5a', f: '#fff6e0', g: '#ffd23a', m: '#4a0a10' },
  bat: { o: '#2a2038', 1: '#ffffff', 2: '#e8e2f0', 3: '#bdb2d2', 4: '#ffffff', 5: '#e0d6ea', 6: '#ffb0c6', 7: '#e46e92', 8: '#4e3a6a', 9: '#6e5890', e: '#1e1420', w: '#ffffff', r: '#ffa0b8', x: '#e2445c', y: '#a82840' }
};
export const OVERLAY = { B: '#b4243a', K: '#5c1020', F: '#e8868a', O: '#f4ead2', U: '#7a4874', C: '#2a1a1c', D: '#4a2a22', I: '#c8f2ff', J: '#7fd0f0' };

// Pivot of each part in its own matrix. Heads, bodies and feet hang from their bottom-center;
// arms from the shoulder.
const PIVOT = { arm: [1, 0], scarf: [4, 1] };
const baseName = name => (name.startsWith('head') ? 'head' : name);
export function pivotOf(name, m) {
  const p = PIVOT[baseName(name)];
  if (p) return p;
  return [Math.floor((m[0].length - 1) / 2), m.length - 1];
}
export const TAILS = {
  cat: { width: 3, colors: ['2', '1', '3'], stripe: '8', every: 2.5, shape: [[1, 0], [-2, 0], [-5, -1], [-7, -3], [-8, -6], [-8, -9], [-6, -11]] },
  ocelot: { width: 3, colors: ['2', '1', '3'], stripe: '8', every: 2.5, tip: '8', shape: [[1, 0], [-2, 0], [-5, -1], [-7, -3], [-8, -6], [-8, -9], [-6, -11]] },
  rat: { width: 1, colors: ['6', '6', '7'], shape: [[0, 0], [-3, 1], [-6, 0], [-8, -2], [-9, -5], [-8, -8]] },
  rabbit: null,
  ocelotBeast: { width: 4, colors: ['2', '1', '3'], stripe: '8', every: 2.5, tip: '8', shape: [[1, 0], [-3, 0], [-7, -1], [-10, -3], [-12, -7], [-12, -11], [-10, -14]] }
};
// Nox's scarf: a knot in the matrix and two loose ends drawn as chains from the back of the knot.
export const SCARF = {
  width: 2, colors: ['x', 'x', 'y'], root: [-4, -6],
  strands: [[[0, 0], [-2, 0], [-4, 1], [-6, 2], [-8, 2], [-10, 3]], [[0, 0], [-1, 1], [-3, 2], [-4, 4], [-5, 5]]]
};

// Mingau, the Cat King, has one look of his own: 'Proud', the lids half down over his eyes, looking
// down his nose at everyone (his guard and his walk). The eye is cells 9-10 of rows 6-8 of the head.
const lidded = (rows, lid) => rows.map((r, y) => (y === 6 ? r.slice(0, 9) + lid + r.slice(11) : r));
const KING_PARTS = { ...PARTS.cat, headProud: lidded(PARTS.cat.head, '33') };
const castOf = id => ({ id, palette: PALETTES[id], parts: id === 'cat' ? KING_PARTS : PARTS[id], tail: TAILS[id] || null, scarf: id === 'bat' ? SCARF : null });
// Lola's head with its bow sits a pixel higher than the others', so more of her dress shows.
// eye: the eye in head cells from the head's pivot.
const LOLA_RIG = {
  anchor: { head: [1, -10], body: [0, -2], armF: [4, -7], armB: [1, -8], footF: [2, -1], footB: [-2, -1], tail: [-4, -5], scarf: [0, -7] },
  joint: { head: [1, -10], armF: [4, -7], armB: [1, -8], footF: [2, -2], footB: [-2, -2] },
  eye: [3, -4]
};
// The fighters, by type. Alternate forms are casts of their own with their own anchors.
export const CAST = Object.keys(PARTS).filter(id => id !== 'ocelotBeast').map(id => (id === 'rabbit' ? { ...castOf(id), ...LOLA_RIG } : castOf(id)));
// Juma's beast form is bigger: a taller chest carries the head higher and the shoulders wider.
export const BEAST = {
  ...castOf('ocelotBeast'),
  anchor: { head: [2, -12], body: [0, -2], armF: [5, -10], armB: [1, -11], footF: [3, -1], footB: [-3, -1], tail: [-6, -7], scarf: [0, -9] },
  joint: { head: [2, -12], armF: [5, -10], armB: [1, -11], footF: [3, -2], footB: [-3, -2] },
  eye: [2, -8]
};
// DARK NOX's wings: bat wings grown out of his back, built from bones once at load. Each pose is
// the wrist, the thumb claw, three finger tips (leading to trailing) and where the membrane meets
// his flank, in cells from the wing root (upper back), x ahead, y down. The membrane is filled
// between the bones with a scalloped trailing edge, panel by panel in two shades of blood; the
// bones are dark with a lit leading edge and a pale hooked thumb. `far` is the other wing, seen
// past him (a shade darker, drawn first).
const WING_POSES = {
  // Folded on his back like a cloak, a hump over the shoulders with the thumb hooked up.
  fold: [{ w: [-3, -5], th: [-2, -7], f: [[-6, 1], [-5, 5], [-3, 7]], hip: [0, 7] }],
  // Half open and raised behind him: the feral guard.
  half: [{ w: [-6, -7], th: [-5, -9], f: [[-13, -6], [-13, -1], [-9, 3]], hip: [-1, 6] }],
  // Swept back and low for speed: running, dashing, lunging.
  back: [{ w: [-7, -3], th: [-7, -5], f: [[-14, -2], [-13, 2], [-8, 4]], hip: [-1, 5] }],
  // Spread wide behind him.
  open: [{ w: [-7, -6], th: [-6, -8], f: [[-16, -6], [-16, 0], [-11, 4]], hip: [-1, 6] }],
  // Raised high over him (the jump, the dive gathering, the uppercut).
  up: [{ w: [-4, -10], th: [-3, -12], f: [[-11, -15], [-14, -8], [-10, -2]], hip: [-1, 5] }, { far: true, w: [0, -17], th: [1, -19], f: [[5, -23], [9, -19], [8, -11]], hip: [2, 0] }],
  // Flung open as far as they go: the finisher, the pop of the transformation, the bite.
  flare: [{ w: [-8, -9], th: [-7, -11], f: [[-17, -13], [-19, -5], [-14, 1]], hip: [-1, 6] }, { far: true, w: [2, -17], th: [3, -19], f: [[8, -22], [12, -18], [11, -10]], hip: [2, 0] }],
  // Wrapped forward round the prey while he drinks.
  wrap: [{ w: [-3, -9], th: [-2, -11], f: [[-8, -9], [-10, -3], [-7, 2]], hip: [-1, 6] }, { far: true, w: [8, -10], th: [9, -12], f: [[16, -6], [15, 0], [11, 4]], hip: [3, 3] }]
};
function wingRows({ w, th, f, hip }, far) {
  // The membrane outline: root, wrist, each finger tip with a scallop pulled back between them.
  const poly = [[0, 0], w];
  const tips = [...f, hip];
  for (let i = 0; i < tips.length; i++) {
    poly.push(tips[i]);
    if (i < tips.length - 1) {
      const [ax, ay] = tips[i], [bx, by] = tips[i + 1], mx = (ax + bx) / 2, my = (ay + by) / 2;
      poly.push([mx + (w[0] - mx) * 0.22, my + (w[1] - my) * 0.22]);
    }
  }
  const xs = [...poly.map(p => p[0]), th[0]], ys = [...poly.map(p => p[1]), th[1]];
  const x0 = Math.floor(Math.min(...xs)) - 1, y0 = Math.floor(Math.min(...ys)) - 1;
  const W = Math.ceil(Math.max(...xs)) - x0 + 2, H = Math.ceil(Math.max(...ys)) - y0 + 2;
  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  const inside = (px, py) => {
    let on = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
    }
    return on;
  };
  // Panels between the bones alternate dark wine and near black (the blood is his scarf, his
  // claws and the glow round him: dark wings keep his shape clear against it); the far wing is all
  // near black.
  const wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
  const a0 = Math.atan2(f[0][1] - w[1], f[0][0] - w[0]);
  const rel = (x, y) => wrap(Math.atan2(y - w[1], x - w[0]) - a0);
  const fa = [...f.slice(1), hip].map(([x, y]) => rel(x, y)), sweep = Math.sign(fa[fa.length - 1]) || 1;
  const lit = far ? '8' : '9', dim = '8';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = x + x0 + 0.5, cy = y + y0 + 0.5;
    if (!inside(cx, cy)) continue;
    const d = rel(cx, cy) * sweep;
    let panel = 0;
    for (const v of fa) if (d > v * sweep) panel++;
    grid[y][x] = panel % 2 ? dim : lit;
  }
  const line = (ax, ay, bx, by, c, c2 = c) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / n) - x0, y = Math.round(ay + ((by - ay) * k) / n) - y0;
      if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = k === n ? c2 : c;
    }
  };
  // Finger bones, the forearm (lit along its top), and the hooked thumb with a slate claw (not white:
  // his burning eyes stay the only bright points on him).
  for (const [fx, fy] of f) line(w[0], w[1], fx, fy, far ? '9' : '2');
  line(0, 0, w[0], w[1], far ? '9' : '2');
  line(0, -1, w[0], w[1] - 1, far ? '2' : '1');
  line(w[0], w[1], th[0], th[1], far ? '2' : '1', far ? '1' : '4');
  return { m: grid.map(r => r.join('')), piv: [-x0, -y0] };
}
const WINGS = Object.fromEntries(Object.entries(WING_POSES).map(([k, list]) => [k, list.map(s => ({ ...wingRows(s, s.far), far: !!s.far })).sort((a, b) => b.far - a.far)]));

// DARK NOX: Nox himself (same id, so his scarf moves the same) in his dark palette, cached apart,
// with the bat wings on his back (the frame's `wing` picks the pose; folded when it names none).
// His arms are lit along the outside so the blows read against his dark body, and end in two pale
// hooked claws just past the hand (the hand stays at cell 3, where the blood talons grow from).
const DARK_ARM = [
  '11.',
  '112',
  '122',
  '.13',
  'w.w'
];
export const DARK_NOX = { ...castOf('bat'), parts: { ...PARTS.bat, arm: DARK_ARM }, palette: DARK_NOX_PALETTE, paletteId: 'batDark', wings: { root: [-3, -8], poses: WINGS } };
export const castFor = (type, form) => (form === 'beast' && CAST[type]?.id === 'ocelot' ? BEAST : form === 'dark' && CAST[type]?.id === 'bat' ? DARK_NOX : CAST[type]);
const anchorsOf = ch => ch?.anchor || ANCHOR;
const jointsOf = ch => ch?.joint || JOINT;

// Figure slots and the matrix each one uses. Anchors are in character space (x right, y up to 0
// at the ground, facing right): where each part's pivot sits in the rest pose.
export const SLOTS = ['head', 'body', 'armF', 'armB', 'footF', 'footB'];
const MATRIX = { head: 'head', body: 'body', armF: 'arm', armB: 'arm', footF: 'foot', footB: 'foot', scarf: 'scarf' };
export const ANCHOR = { head: [1, -9], body: [0, -2], armF: [4, -7], armB: [1, -8], footF: [2, -1], footB: [-2, -1], tail: [-4, -5], scarf: [0, -7] };
// Where each part hinges on the body (ragdoll joints and severed stumps).
export const JOINT = { head: [1, -9], armF: [4, -7], armB: [1, -8], footF: [2, -2], footB: [-2, -2] };
export const PARENT = { head: 'body', armF: 'body', armB: 'body', footF: 'body', footB: 'body' };
// Cosmetic pieces ride on a slot: they share its offset.
const RIDES = { scarf: 'body' };

export function rotateQ(m, q) {
  let out = m;
  for (let k = 0; k < ((q % 4) + 4) % 4; k++) {
    const h = out.length, w = out[0].length, next = [];
    for (let x = 0; x < w; x++) { let row = ''; for (let y = h - 1; y >= 0; y--) row += out[y][x]; next.push(row); }
    out = next;
  }
  return out;
}
function rotatePivot([px, py], m, q) {
  const h = m.length, w = m[0].length;
  q = ((q % 4) + 4) % 4;
  if (q === 1) return [h - 1 - py, px];
  if (q === 2) return [w - 1 - px, h - 1 - py];
  if (q === 3) return [py, w - 1 - px];
  return [px, py];
}
export function mirror(rows) { return rows.map(r => [...r].reverse().join('')); }

// Scale2x (EPX), used three times for RotSprite-style rotation at any angle.
function scale2x(m) {
  const h = m.length, w = m[0].length, out = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : m[y][x]);
  for (let y = 0; y < h; y++) {
    let r0 = '', r1 = '';
    for (let x = 0; x < w; x++) {
      const P = m[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      r0 += (C === A && C !== D && A !== B ? A : P) + (A === B && A !== C && B !== D ? B : P);
      r1 += (D === C && D !== B && C !== A ? C : P) + (B === D && B !== A && D !== C ? D : P);
    }
    out.push(r0, r1);
  }
  return out;
}
const bigCache = new Map();
function upscale8(m) {
  const key = m.join('|');
  let b = bigCache.get(key);
  if (!b) {
    b = scale2x(scale2x(scale2x(m)));
    if (bigCache.size > 600) bigCache.delete(bigCache.keys().next().value);
    bigCache.set(key, b);
  }
  return b;
}

export const ANGLE_STEP = 360 / 32;
export const snapDeg = d => Math.round(d / ANGLE_STEP) * ANGLE_STEP;

// Rotates a char matrix clockwise by deg around the pivot cell. Returns the matrix and new pivot.
export function rotate(m, piv, deg) {
  deg = ((snapDeg(deg) % 360) + 360) % 360;
  if (deg % 90 === 0) return { m: rotateQ(m, deg / 90), piv: rotatePivot(piv, m, deg / 90) };
  const th = (deg * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
  const h = m.length, w = m[0].length, cx = piv[0] + 0.5, cy = piv[1] + 0.5;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const rx = x - cx, ry = y - cy, X = rx * c - ry * s, Y = rx * s + ry * c;
    minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
  }
  const ox = Math.floor(minX), oy = Math.floor(minY), W = Math.ceil(maxX) - ox + 1, H = Math.ceil(maxY) - oy + 1;
  const B = upscale8(m), out = [];
  for (let j = 0; j < H; j++) {
    let row = '';
    for (let i = 0; i < W; i++) {
      const X = ox + i, Y = oy + j;
      const sx = X * c + Y * s + cx, sy = -X * s + Y * c + cy;
      const bx = Math.floor(sx * 8), by = Math.floor(sy * 8);
      row += bx >= 0 && by >= 0 && bx < w * 8 && by < h * 8 ? B[by][bx] : '.';
    }
    out.push(row);
  }
  return { m: out, piv: [-ox, -oy] };
}

// Wounds live in part space: (u, v) cells from the part's pivot, facing right, unrotated.
const WOUND = {
  hole: s => [[0, 0, s > 2.4 ? 'O' : 'K'], ...(s > 1.1 ? [[1, 0, 'B'], [0, 1, 'B']] : []), ...(s > 1.8 ? [[-1, 0, 'B'], [0, -1, 'K']] : [])],
  bruise: s => [[0, 0, 'U'], ...(s > 1.2 ? [[1, 0, 'U']] : []), ...(s > 2 ? [[0, 1, 'U']] : [])],
  burn: s => [[0, 0, 'C'], [1, 1, 'D'], ...(s > 1.5 ? [[-1, 0, 'D']] : [])],
  frost: () => [[0, 0, 'I'], [1, 0, 'J']],
  stump: () => [[0, 0, 'O'], [-1, 0, 'F'], [1, 0, 'F'], [0, -1, 'B'], [0, 1, 'K']]
};
function cutCells(w) {
  const len = 2 + (w.s || 1) * 1.2, a = w.a ?? 0.6, ca = Math.cos(a), sa = Math.sin(a), out = [];
  for (let i = -len / 2; i <= len / 2; i += 0.7) out.push([Math.round(ca * i), Math.round(sa * i), 'B']);
  if ((w.s || 1) > 2) out.push([0, 0, 'F']);
  return out;
}
export function applyWounds(m, piv, wounds) {
  if (!wounds || !wounds.length) return m;
  const rows = m.map(r => [...r]);
  for (const w of wounds) {
    const cells = w.t === 'cut' ? cutCells(w) : (WOUND[w.t] || WOUND.bruise)(w.s || 1);
    for (const [dx, dy, c] of cells) {
      const x = piv[0] + Math.round(w.u) + dx, y = piv[1] + Math.round(w.v) + dy;
      if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) continue;
      const cur = rows[y][x];
      if (cur === '.' || cur === 'e' || cur === 'w') continue;
      rows[y][x] = c;
    }
  }
  return rows.map(r => r.join(''));
}

class Grid {
  constructor() { this.cells = new Map(); }
  set(x, y, c) { this.cells.set(x + ',' + y, c); }
  // Stamp a fill-only matrix and outline it; the outline may cover parts drawn earlier.
  stamp(m, x0, y0, far = false) {
    const mine = new Set();
    for (let y = 0; y < m.length; y++) {
      const row = m[y];
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        if (c === '.') continue;
        this.set(x0 + x, y0 + y, far ? FAR[c] || c : c);
        mine.add((x0 + x) + ',' + (y0 + y));
      }
    }
    for (const k of mine) {
      const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = (x + dx) + ',' + (y + dy);
        if (!mine.has(n)) this.cells.set(n, 'o');
      }
    }
  }
  rows() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of this.cells.keys()) {
      const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1);
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const rows = Array.from({ length: h }, () => new Array(w).fill('.'));
    for (const [k, c] of this.cells) { const i = k.indexOf(','); rows[+k.slice(i + 1) - y0][+k.slice(0, i) - x0] = c; }
    fillHoles(rows, w, h);
    return { rows: rows.map(r => r.join('')), x0, y0, w, h };
  }
}

// Gaps closed in by a tail or limb read as see-through holes; shade them as outline instead.
function fillHoles(rows, w, h) {
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i - x) / w;
    if (seen[i] || rows[y][x] !== '.') continue;
    seen[i] = 1;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) { const x = i % w, y = (i - x) / w; if (rows[y][x] === '.' && !seen[i]) rows[y][x] = 'o'; }
}

function tube(grid, pts, t) {
  const r = t.width / 2, fill = new Map();
  let along = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const seg = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(seg * 2));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * (k / n), y = ay + (by - ay) * (k / n);
      along += seg / n;
      const rr = Math.max(0.5, r * (1 - (i / pts.length) * 0.2));
      for (let yy = Math.floor(y - rr); yy <= Math.ceil(y + rr); yy++) for (let xx = Math.floor(x - rr); xx <= Math.ceil(x + rr); xx++) {
        if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > rr * rr + 0.3) continue;
        const key = xx + ',' + yy;
        if (!fill.has(key)) fill.set(key, { along, end: i === pts.length - 2 && k > n * 0.5 });
      }
    }
  }
  const has = (x, y) => fill.has(x + ',' + y);
  for (const [key, info] of fill) {
    const [x, y] = key.split(',').map(Number);
    let c = t.colors[0];
    if (!has(x, y - 1) || !has(x - 1, y)) c = t.colors[1];
    if (!has(x, y + 1) || !has(x + 1, y)) c = t.colors[2];
    if (t.stripe && Math.floor(info.along / t.every) % 2 === 1) c = t.stripe;
    if (t.tip && info.end) c = t.tip;
    grid.set(x, y, c);
  }
  for (const key of fill.keys()) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!fill.has((x + dx) + ',' + (y + dy))) grid.set(x + dx, y + dy, 'o');
  }
}

const BLOB_TAIL = ['.11.', '1112', '1122', '.22.'];

// Tail points for a frame: the default shape swayed by tailDeg, or the frame's own curve.
export function tailPoints(ch, frame = {}) {
  if (!ch.tail || ch.tail.blob) return null;
  const [tx, ty] = anchorsOf(ch).tail;
  const [bdx = 0, bdy = 0] = frame.body || [];
  const shape = frame.tail || ch.tail.shape;
  const a = ((frame.tailDeg || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return shape.map(([x, y]) => [tx + bdx + x * c - y * s, ty + bdy + x * s + y * c]);
}

const transformOf = (frame, slot) => frame[slot] || (RIDES[slot] ? [...(frame[RIDES[slot]] || []).slice(0, 2), 0] : []);

// Where a slot's matrix lands for a frame: rotated matrix and its top-left in character space.
export function placeSlot(ch, slot, frame = {}, opts = {}) {
  const mname = MATRIX[slot];
  let m0 = slot === 'head' ? ch.parts[opts.expr ? 'head' + opts.expr : 'head'] || ch.parts.head : ch.parts[mname];
  if (!m0) return null;
  const [ax, ay] = anchorsOf(ch)[slot];
  const [dx = 0, dy = 0, deg = 0] = transformOf(frame, slot);
  const piv0 = pivotOf(mname, m0);
  const extra = [...(opts.wounds?.[slot] || []), ...(opts.stumps?.[slot] || [])];
  if (extra.length) m0 = applyWounds(m0, piv0, extra);
  const { m, piv } = deg ? rotate(m0, piv0, deg) : { m: m0, piv: piv0 };
  // Whole cells only: weapon thrusts ease their offsets in between pixels.
  return { m, x: Math.round(ax + dx - piv[0]), y: Math.round(ay + dy - piv[1]) };
}

// Maps a point given in a slot's unrotated matrix space (cells from its pivot) to character space.
export function slotPoint(slot, frame, u, v, ch = null) {
  const [ax, ay] = anchorsOf(ch)[slot];
  const [dx = 0, dy = 0, deg = 0] = transformOf(frame, slot);
  const a = (snapDeg(deg) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [ax + dx + u * c - v * s, ay + dy + u * s + v * c];
}

// Stumps: a severed child leaves a raw end where it hinged on its parent.
function stumpsFor(severed, ch) {
  if (!severed?.length) return null;
  const out = {};
  for (const slot of severed) {
    const parent = PARENT[slot];
    if (!parent || severed.includes(parent)) continue;
    const [jx, jy] = jointsOf(ch)[slot], [ax, ay] = anchorsOf(ch)[parent];
    (out[parent] ||= []).push({ u: jx - ax, v: jy - ay + (slot === 'head' ? 1 : 0), t: 'stump', s: 2 });
  }
  return out;
}

const DRAW = ['wings', 'tail', 'armB', 'footB', 'blob', 'body', 'footF', 'head', 'scarf', 'armF'];

// Static scarf ends (ragdolls, previews without motion), offset with the body.
function scarfPoints(ch, frame, shape) {
  const [bdx = 0, bdy = 0] = frame.body || [];
  return shape.map(([x, y]) => [ch.scarf.root[0] + bdx + x, ch.scarf.root[1] + bdy + y]);
}

// Loose chains (tails, scarf ends) composed on their own, for the animated overlay.
export function composeTubes(ch, chains) {
  const g = new Grid();
  for (const c of chains) if (c.pts?.length > 1) tube(g, c.pts, c.spec);
  return g.cells.size ? g.rows() : null;
}

// Composes a figure. opts: { expr, wounds: {slot: [...]}, severed: [slots], only: [slots] }.
// Returns char rows (outlines included) and their top-left in character space.
export function composeChars(ch, frame = {}, opts = {}) {
  const g = new Grid();
  const severed = opts.severed || [];
  const stumps = stumpsFor(severed, ch);
  const want = slot => !severed.includes(RIDES[slot] || slot) && (!opts.only || opts.only.includes(RIDES[slot] || slot));
  const bodyOn = want('body');
  const order = frame.front ? DRAW.filter(s => s !== frame.front).concat(frame.front) : DRAW;
  for (const step of order) {
    if (step === 'wings') {
      // Wings ride on the body, like the scarf.
      const set = bodyOn && ch.wings && frame.wing !== false ? ch.wings.poses[frame.wing || 'fold'] || ch.wings.poses.fold : null;
      if (set) {
        const [bdx = 0, bdy = 0] = frame.body || [], [rx, ry] = ch.wings.root;
        for (const wg of set) g.stamp(wg.m, rx + bdx - wg.piv[0], ry + bdy - wg.piv[1]);
      }
      continue;
    }
    if (step === 'tail') {
      if (bodyOn && ch.tail && !ch.tail.blob && frame.tail !== false) tube(g, tailPoints(ch, frame), ch.tail);
      if (bodyOn && ch.scarf && frame.scarf !== false) for (const s of ch.scarf.strands) tube(g, scarfPoints(ch, frame, s), ch.scarf);
      continue;
    }
    if (step === 'blob') {
      if (bodyOn && ch.tail?.blob) { const [bdx = 0, bdy = 0] = frame.body || []; g.stamp(BLOB_TAIL, anchorsOf(ch).tail[0] + bdx - 3, ANCHOR.tail[1] + bdy - 2); }
      continue;
    }
    if (!want(step) || (step === 'scarf' && !ch.parts.scarf)) continue;
    const p = placeSlot(ch, step, frame, { expr: step === 'head' ? opts.expr : '', wounds: opts.wounds, stumps });
    if (p) g.stamp(p.m, p.x, p.y, (step === 'armB' || step === 'footB') && frame.front !== step);
  }
  if (!g.cells.size) return null;
  let out = g.rows();
  // Whole-figure quarter turns (rolls, the hamster ball) around the middle of the body.
  const spin = (((frame.spin || 0) % 4) + 4) % 4;
  if (spin) {
    const cx = 0, cy = -7;
    const piv = [cx - out.x0, cy - out.y0];
    const r = rotateQ(out.rows, spin), np = rotatePivot(piv, out.rows, spin);
    out = { rows: r, x0: cx - np[0], y0: cy - np[1], w: r[0].length, h: r.length };
  }
  return out;
}

const paletteCache = new Map();
const mixHex = (a, b, t) => {
  const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
// Palette with optional state tints in the variant string: char1-3, ice, xray, flash.
export function paletteFor(ch, variant = '') {
  const key = (ch.paletteId || ch.id) + variant;
  let p = paletteCache.get(key);
  if (p) return p;
  p = { ...OVERLAY, ...ch.palette };
  if (variant) {
    const charQ = +(variant.match(/char(\d)/)?.[1] || 0);
    for (const k of Object.keys(p)) {
      let c = p[k];
      if (charQ && k !== 'e' && k !== 'w') c = mixHex(c, k === 'o' ? '#140c0c' : '#3a2420', [0, 0.35, 0.6, 0.85][charQ]);
      if (variant.includes('ice')) c = k === 'o' ? '#24486a' : mixHex(c, '#a8e4ff', 0.55);
      if (variant.includes('xray')) c = k === 'o' ? '#e8fbff' : k === 'O' ? '#ffffff' : mixHex(c, '#1a3a4a', 0.75);
      if (variant.includes('flash') && k !== 'o') c = mixHex(c, '#ffffff', 0.7);
      p[k] = c;
    }
  }
  paletteCache.set(key, p);
  return p;
}

export function toPixels(rows, palette) {
  const h = rows.length, w = rows[0].length, pixels = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows[y][x]; if (c !== '.') pixels[y * w + x] = palette[c] || '#ff00ff'; }
  return pixels;
}

const PREVIEW_POSES = {
  idle: {},
  idle2: { head: [0, 1], armF: [0, 1], armB: [0, 1] },
  run1: { footF: [2, 0], footB: [-2, -1], head: [1, 0], armF: [-1, 0, 25], armB: [1, 0, -25] },
  run2: { footF: [-2, -1], footB: [2, 0], head: [1, 0], armF: [1, 0, -25], armB: [-1, 0, 25] },
  jump: { footF: [1, -2], footB: [-1, -1], armF: [0, -1, -160], armB: [0, -1, 160], head: [0, -1], body: [0, -1] },
  hurt: { head: [-1, 0], armF: [1, -1, -60], armB: [-1, -1, 60], body: [-1, 0] }
};

export function composePose(ch, frame = {}, opts = {}) {
  const out = composeChars(ch, typeof frame === 'string' ? PREVIEW_POSES[frame] || {} : frame, opts);
  return { pixels: toPixels(out.rows, paletteFor(ch, opts.variant || '')), w: out.w, h: out.h, x0: out.x0, y0: out.y0 };
}

// Center of a slot's matrix in character space (rest pose) and its size in pixels.
export function partCenter(ch, slot) {
  const m = ch.parts[MATRIX[slot]];
  const [px, py] = pivotOf(MATRIX[slot], m), [ax, ay] = anchorsOf(ch)[slot];
  return [ax - px + m[0].length / 2, ay - py + m.length / 2];
}
export function partSize(ch, slot) {
  const m = ch.parts[MATRIX[slot]];
  return [m[0].length, m.length];
}

// A single physics part at rest (the body carries the tail and scarf), for ragdolls.
// piv is the cell under the part's center, which follows the physics body.
export function composePart(ch, slot, opts = {}) {
  const out = composeChars(ch, {}, { ...opts, only: [slot], severed: (opts.severed || []).filter(s => s !== slot) });
  if (!out) return null;
  const [cx, cy] = partCenter(ch, slot);
  return { ...out, piv: [Math.floor(cx - out.x0), Math.floor(cy - out.y0)] };
}

export function checkArt(ch) {
  const warn = [];
  for (const [name, m] of Object.entries(ch.parts)) {
    const w = m[0].length;
    m.forEach((row, i) => {
      if (row.length !== w) warn.push(`${ch.id}.${name} row ${i} has ${row.length} (expected ${w})`);
      for (const c of row) if (c !== '.' && !ch.palette[c]) warn.push(`${ch.id}.${name} unknown '${c}'`);
    });
  }
  if (Object.keys(ch.palette).length > 16) warn.push(`${ch.id} palette has ${Object.keys(ch.palette).length} colors`);
  return warn;
}
