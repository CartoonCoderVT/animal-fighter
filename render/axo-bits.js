// Small hand-drawn pixel matrices for the axolotl's passive and its special: the severed tail piece,
// the bud a lost part swells into, the stages of a part growing back, the goo puddle its clones dive
// into, the bubbles they melt into, and the marks the demons leave behind (the scorched dog skull,
// the Venus star of the cast). Same legend as the fighters; fill-only matrices get their outline
// here (light on the lit top-left edge, dark elsewhere). Pure data and helpers, no DOM until a
// sprite is asked for, so the art preview can run in Node.
import { rotate, snapDeg } from './pixel-data.js';

// The axolotl's ramps, plus the pale regrowing tissue: c is the sealed cap, k its rim.
export const BITS_PAL = {
  o: '#3a1430', p: '#7a2a54', 1: '#ffd0de', 2: '#f69bb7', 3: '#d26f90', 8: '#a8456c', 9: '#e98aa8',
  4: '#fff4f6', 5: '#f2c4d2', 6: '#ff6e8c', 7: '#c4305a', e: '#1c0a18', w: '#ffffff', f: '#fffaf0',
  c: '#ffe4ec', k: '#fff4f6'
};
// Soot and embers for the demons' marks.
export const BURN_PAL = { a: '#120608', b: '#2a1012', d: '#4a1c18', y: '#fff2a0', r: '#ff5a1a', q: '#ffd040', v: '#ff2a3a', o: '#2a0008' };

// Adds a one-pixel outline around the filled cells: 'p' where the fill lies below or to the right
// (the lit top-left edge), 'o' everywhere else. Returns the bigger matrix (pivot moves by +1,+1).
export function outline(rows, lit = true) {
  const h = rows.length, w = rows[0].length, out = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  for (let y = -1; y <= h; y++) {
    let row = '';
    for (let x = -1; x <= w; x++) {
      const c = at(x, y);
      if (c !== '.') { row += c; continue; }
      const r = at(x + 1, y) !== '.', d = at(x, y + 1) !== '.', l = at(x - 1, y) !== '.', u = at(x, y - 1) !== '.';
      row += (r || d) && !l && !u && lit ? 'p' : r || d || l || u ? 'o' : '.';
    }
    out.push(row);
  }
  return out;
}

// The tail it bit off itself (or that was torn off): a flat paddle that tapers to a point, the
// fin ridge pale along its top and bottom edges, the cut end sealed pale. Cut end on the left.
export const TAIL_PIECE = outline([
  '.4455554....',
  'k111111554..',
  'c22222221154',
  'k33333332255',
  '.98888899...'
]);

// A shed part swelling into a clone over 0.8 s: a wet bead with a white core, a mound, a larva
// with gill nubs and a tail bud, and a curled-up clone with its eye open about to hatch. Each stage
// has a breath-in frame (swollen) for the pulse. Bottom row sits on the floor, centred.
export const BUD = [
  [
    outline([
      '.f1.',
      '1w42',
      '2233'
    ]),
    outline([
      '.f11.',
      '1w442',
      '22333'
    ])
  ],
  [
    outline([
      '..11..',
      '.1f12.',
      '12w423',
      '223333'
    ]),
    outline([
      '..111..',
      '.1f112.',
      '12ww423',
      '1244423',
      '2233333'
    ])
  ],
  [
    outline([
      '6..11..',
      '.611f2.',
      '11w4423',
      '2244233',
      '.333338'
    ]),
    outline([
      '6.6.11..',
      '.6111f2.',
      '211ww423',
      '22444233',
      '.3333338'
    ])
  ],
  [
    outline([
      '6.6.....',
      '.6.1111.',
      '6611f112',
      '.11124e2',
      '21w44223',
      '.3333338'
    ]),
    outline([
      '6.6.6....',
      '.6.11111.',
      '66111f112',
      '.1111244e',
      '221ww4223',
      '.33333338'
    ])
  ]
];

// A lost part growing back, in four stages: a sealed pale cap, a bud, a paddle, then the part with
// its digits still pale. Each stage lists its matrix and the cell that sits on the joint.
// Arms hang down from the shoulder; feet grow down from the hip with the toes ahead.
export const REGROW = {
  arm: [
    { m: ['kk', 'cc'], piv: [0, 0], bare: true },
    { m: outline(['12', 'cc']), piv: [1, 1] },
    { m: outline(['12', '22', 'cc']), piv: [1, 1] },
    { m: outline(['11.', '222', 'c.c']), piv: [2, 1] }
  ],
  foot: [
    { m: ['kk', 'cc'], piv: [0, 0], bare: true },
    { m: outline(['12', 'cc']), piv: [1, 1] },
    { m: outline(['122', 'ccc']), piv: [2, 1] },
    { m: outline(['.222', '2c2c']), piv: [3, 1] }
  ]
};
// Which of the four stages a part is at for its progress (0..1).
export const regrowStage = k => (k < 0.15 ? 0 : k < 0.45 ? 1 : k < 0.8 ? 2 : 3);

// The goo puddle a clone dives into and pops back out of (and melts into), from a drop to a pool.
// Two rows on the floor: the wet surface with its shine, the darker edge underneath.
export const PUDDLE = [
  ['.21.', '2332'],
  ['.21f1.', '233332'],
  ['..21f112..', '.22333332.', '2333888332'],
  ['...211f1112...', '.223333333322.', '23338888883332']
];

// Bubbles a melting clone breaks up into and the ones that rise off a popped bubble: a dot, a ring,
// a ring with a shine. w is the shine, 1 the film, 3 the shadowed edge.
export const BUBBLETS = [
  ['1'],
  ['.1.', '1.3', '.3.'],
  ['.11.', '1w.3', '1..3', '.33.'],
  ['..111..', '.1w..3.', '1w....3', '1.....3', '1.....3', '.3...3.', '..333..']
];

// The scorch the Sacrifício leaves on the wall above the floor: a dog's skull, Xolotl's face,
// burnt into the brick. a is char, b soot, d the singed edge.
// v marks the sockets and the nose, where embers glow for a moment after the blast.
export const SKULL = [
  '...baaaaab...',
  '.baaaaaaaaab.',
  'baaaaaaaaaaab',
  'aa.vv.a.vv.aa',
  'aa.vv.a.vv.aa',
  'baa..aaa..aab',
  '.baaaaaaaaab.',
  '..baaaaaaab..',
  '...aa.v.aa...',
  '...baaaaab...',
  '...a.aaa.a...',
  '...d.....d...'
];

// The Venus star (Xolotl is the evening star): five points, a white-hot heart, gold body, red edge.
// Three sizes so it can flare up without scaling.
export const VENUS = [
  [
    '...r...',
    '..rqr..',
    'rrqyqrr',
    '.rqyqr.',
    '.rqrqr.',
    'rr...rr'
  ],
  [
    '.....r.....',
    '....rqr....',
    '....qyq....',
    'rrrqqyqqrrr',
    '.rqqyyyqqr.',
    '..rqyyyqr..',
    '..rqyyyqr..',
    '.rqyqrqyqr.',
    '.rqr...rqr.',
    'rr.......rr'
  ],
  [
    '.......r.......',
    '......rqr......',
    '......qyq......',
    '.....rqyqr.....',
    '.....qyyyq.....',
    'rrrrqqyyyqqrrrr',
    '.rqqqyyyyyqqqr.',
    '..rqqyyyyyqqr..',
    '...rqyyyyyqr...',
    '...rqyyyyyqr...',
    '..rqyyqrqyyqr..',
    '..rqyqr.rqyqr..',
    '.rqqr.....rqqr.',
    '.rqr.......rqr.',
    'rr...........rr'
  ]
];

// ---- sprites (browser only) --------------------------------------------------------------------
const cache = new Map();
const hex = new Map();
const rgbOf = c => { let v = hex.get(c); if (!v) { v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); hex.set(c, v); } return v; };

// A matrix as a canvas, cached by key (mirrored when face < 0).
export function bitCanvas(rows, pal, key, face = 1) {
  const k = key + '|' + face;
  let c = cache.get(k);
  if (c) return c;
  const h = rows.length, w = rows[0].length;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][face < 0 ? w - 1 - x : x];
    if (ch === '.' || !pal[ch]) continue;
    const [r, gg, b] = rgbOf(pal[ch]), i = (y * w + x) * 4;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (cache.size > 600) cache.delete(cache.keys().next().value);
  cache.set(k, c);
  return c;
}

// A matrix turned RotSprite-style to deg (snapped to the fighters' angle step) around its pivot.
// Returns { rows, piv } and caches by key.
const turned = new Map();
export function turn(rows, piv, deg, key) {
  deg = snapDeg(deg);
  const k = key + '|' + deg;
  let t = turned.get(k);
  if (!t) {
    const r = rotate(rows, piv, deg);
    t = { rows: r.m, piv: r.piv };
    if (turned.size > 400) turned.delete(turned.keys().next().value);
    turned.set(k, t);
  }
  return t;
}
