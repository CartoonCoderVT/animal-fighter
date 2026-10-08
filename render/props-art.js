// Props, weapons and small set pieces built from the same shaded-vector rasterizer.
import { sprite, material } from './sprites.js';
import { S } from '../engine/const.js';

const E = (x, y, rx, ry, m, z = 0, o = {}) => ({ t: 'ellipse', x, y, rx, ry, m, z, ...o });
const C = (x1, y1, x2, y2, r1, r2, m, z = 0, o = {}) => ({ t: 'capsule', x1, y1, x2, y2, r1, r2, m, z, ...o });
const R = (x, y, w, h, r, m, z = 0, o = {}) => ({ t: 'rect', x, y, w, h, r, m, z, ...o });
const CY = (x, y, w, h, m, z = 0, o = {}) => ({ t: 'cyl', x, y, w, h, m, z, ...o });
const CH = (x, y, w, h, m, z = 0, o = {}) => ({ t: 'cylh', x, y, w, h, m, z, ...o });
const Pg = (pts, m, z = 0, o = {}) => ({ t: 'poly', pts, m, z, ...o });
const col = c => (c.includes(':') ? { m: c.split(':')[0], tone: +c.split(':')[1] } : { c });
const px = (x, y, c, over = false) => ({ t: 'px', x, y, over, ...col(c) });
const ln = (x1, y1, x2, y2, c, over = false) => ({ t: 'line', x1, y1, x2, y2, over, ...col(c) });

export const MATS = {
  wood: material('#a06e48'), barrel: material('#a83e40', { gloss: true }), hazard: material('#e7b448'), gunmetal: material('#4c4a5e', { gloss: true }),
  grip: material('#3e2c2c'), steel: material('#c9d3de', { gloss: true }), metal: material('#8a87a2'), rust: material('#80594a'), extRed: material('#d43c3c', { gloss: true }),
  label: material('#efe2c8'), propane: material('#93b8cc', { gloss: true }), olive: material('#626d3c'), bottle: material('#4f8f5c', { gloss: true }), rag: material('#d8c09a'),
  clay: material('#cbb57a'), glass: material('#a8d8e8', { gloss: true }), container: material('#3f6c8c'), containerDark: material('#2b4c66'), ink: material('#1d1a26', { flat: true }),
  board: material('#6fc0b2', { gloss: true }), boardStripe: material('#f0d27a'), phone: material('#2b2638'), screen: material('#9ff6ff', { emissive: true }),
  shade: material('#465a52'), bulb: material('#fff0c0', { emissive: true }), bulbOff: material('#6a6458'), led: material('#ff4a4a', { emissive: true })
};

const defs = new Map();
function def(key, build) {
  if (!defs.has(key)) { const d = build(); d.key = key; defs.set(key, d); }
  return defs.get(key);
}

export function propDef(p) {
  const W = Math.max(2, Math.round(p.w * S)), H = Math.max(2, Math.round(p.h * S));
  const k = p.kind;
  if (k === 'crate') return def(`crate${W}x${H}`, () => ({
    shapes: [R(-W / 2, -H / 2, W, H, 1, 'wood', 0, { b: 0.5, edge: 1.6 })],
    details: [ln(-W / 2 + 2, -H / 2 + 2, W / 2 - 3, H / 2 - 3, 'wood:3'), ln(W / 2 - 3, -H / 2 + 2, -W / 2 + 2, H / 2 - 3, 'wood:1'), ln(-W / 2 + 2, -H / 2 + 2, W / 2 - 3, -H / 2 + 2, 'wood:1'), ln(-W / 2 + 2, H / 2 - 3, W / 2 - 3, H / 2 - 3, 'wood:1'),
      px(-W / 2 + 1, -H / 2 + 1, 'metal:3'), px(W / 2 - 2, -H / 2 + 1, 'metal:3'), px(-W / 2 + 1, H / 2 - 2, 'metal:2'), px(W / 2 - 2, H / 2 - 2, 'metal:2')]
  }));
  if (k === 'barrel') return def(`barrel${W}x${H}`, () => ({
    shapes: [CY(-W / 2, -H / 2, W, H, 'barrel', 0, { b: 1 }), R(-W / 2, -H / 2, W, 2, 0, 'barrel', 1, { b: 0.3, line: 'soft' }), R(-3, -3, 6, 6, 0.5, 'hazard', 2, { b: 0.3 })],
    details: [ln(-W / 2, -H / 4, W / 2, -H / 4, 'barrel:1'), ln(-W / 2, H / 4, W / 2, H / 4, 'barrel:1'), px(0, -2, 'ink:2'), px(0, -1, 'ink:2'), px(0, 1, 'ink:2')]
  }));
  if (k === 'gun') return weaponDef(p.weapon === 'shotgun' ? 'shotgun' : 'pistol');
  if (MELEE_SHAPES[k]) return weaponDef(k, true);
  if (k === 'extinguisher') return weaponDef(k);
  if (k === 'propane') return def(`propane${W}x${H}`, () => ({
    shapes: [CY(-W / 2, -H / 2 + 2, W, H - 2, 'propane', 0, { b: 1 }), E(0, -H / 2 + 2.5, W / 2, 2.5, 'propane', 0.5), R(-1.5, -H / 2 - 1, 3, 2.5, 0.5, 'metal', 1), R(-W / 2, -1, W, 4, 0, 'label', 1.5, { b: 0.6 })],
    details: [ln(-W / 2 + 1, 0.5, W / 2 - 1, 0.5, 'barrel:2'), px(-1, 2, 'ink:2'), px(1, 2, 'ink:2')]
  }));
  if (k === 'grenade') return def('grenade', () => ({ shapes: [E(0, 0.8, 3.2, 3.6, 'olive', 0, { b: 1 }), R(-1.2, -4.2, 2.4, 1.8, 0.4, 'metal', 1)], details: [ln(1.2, -3.6, 2.8, -1, 'metal:3'), px(-2, -4, 'metal:3'), ln(-2, 0, 2, 0, 'olive:1'), ln(-2, 2.4, 2, 2.4, 'olive:1')] }));
  if (k === 'molotov') return def('molotov', () => ({ shapes: [CY(-2, -2.5, 4, 9, 'bottle', 0, { b: 1 }), R(-1, -5.5, 2, 3.5, 0.5, 'bottle', 0.5), C(0, -6, 0.6, -8.4, 1, 1.3, 'rag', 1)], details: [ln(-1, 0, 1, 0, 'rag:3'), px(-1, -1, 'bottle:4')] }));
  if (k === 'mine') return def(`mine${W}`, () => ({ shapes: [R(-W / 2, -H / 2, W, H, 1.5, 'olive', 0, { b: 0.7 }), R(-1.5, -H / 2 - 1, 3, 2, 0.5, 'metal', 1)], details: [ln(-W / 2 + 2, 0, W / 2 - 2, 0, 'olive:1')] }));
  if (k === 'c4') return def(`c4${W}`, () => ({ shapes: [R(-W / 2, -H / 2, W, H, 0.8, 'clay', 0, { b: 0.5 })], details: [ln(-W / 2, -1, W / 2, -1, 'barrel:2'), ln(-W / 2, 1, W / 2, 1, 'container:2'), px(W / 2 - 2, -H / 2 + 1, 'led:3')] }));
  if (k === 'shard') return def('shard', () => ({ shapes: [Pg([[-1.5, -2.5], [1.5, -1], [0.5, 2.5], [-1.2, 1]], 'glass', 0, { b: 0.4 })] }));
  if (k === 'plank') return def(`plank${W}x${H}`, () => ({ shapes: [R(-W / 2, -H / 2, W, H, 0.4, 'wood', 0, { b: 0.4 })], details: [ln(-W / 2 + 1, 0, W / 2 - 1, 0, 'wood:1')] }));
  if (k === 'cargo') return def(`cargo${W}x${H}`, () => {
    const d = [];
    for (let x = -W / 2 + 3; x < W / 2 - 2; x += 3) d.push(ln(x, -H / 2 + 3, x, H / 2 - 5, 'container:1'));
    for (let x = -W / 2; x < W / 2; x += 4) d.push(ln(x, H / 2 - 3, x + 2, H / 2 - 1, 'hazard:2'));
    d.push(px(-1, -H / 2 + 1, 'metal:4'), px(0, -H / 2 + 1, 'metal:4'));
    return { shapes: [R(-W / 2, -H / 2, W, H, 1, 'container', 0, { b: 0.45, edge: 2 }), R(-W / 2, -H / 2, W, 2.5, 0, 'containerDark', 1, { b: 0.3 }), R(-W / 2, H / 2 - 4, W, 4, 0, 'ink', 0.5, { b: 0.2 })], details: d };
  });
  return def(`box${W}x${H}`, () => ({ shapes: [R(-W / 2, -H / 2, W, H, 1, 'metal', 0)] }));
}

// Melee weapons are drawn from the grip (x = 0) outward along +x, so they sit in the paw and
// swing around it; on the floor the same shapes are shifted to be centered on the prop.
const LEN = { blade: 14.5, katana: 24.5, spear: 34, pipe: 22, axe: 21, hammer: 22 };
const MELEE_SHAPES = {
  blade: o => ({
    shapes: [R(o, -1, 4.5, 2, 0.8, 'grip', 0), R(o + 4.3, -2, 1.2, 4, 0, 'metal', 2), Pg([[o + 5.4, -1.3], [o + 13, -0.9], [o + 14.5, 0], [o + 13, 0.9], [o + 5.4, 1.1]], 'steel', 1, { b: 0.6 })],
    details: [ln(o + 6, -0.6, o + 12.5, -0.5, 'steel:4')]
  }),
  katana: o => ({
    shapes: [R(o, -1, 6.5, 2, 0.6, 'grip', 0), E(o + 7, 0, 1, 2.2, 'boardStripe', 2, { b: 0.5 }), Pg([[o + 7.8, -1], [o + 22, -1.3], [o + 24.5, -0.3], [o + 22.2, 0.7], [o + 7.8, 0.8]], 'steel', 1, { b: 0.55 })],
    details: [px(o + 1.5, 0, 'label:3'), px(o + 3.5, -1, 'label:3'), px(o + 5, 0, 'label:3'), ln(o + 8.5, -0.7, o + 22, -0.9, 'steel:4')]
  }),
  spear: o => ({
    shapes: [CH(o, -0.9, 28.5, 1.8, 'wood', 0, { b: 0.7 }), R(o + 26.5, -1.3, 2, 2.6, 0.3, 'rag', 1), Pg([[o + 28.4, -2.2], [o + 34, 0], [o + 28.4, 2.2], [o + 29.4, 0]], 'steel', 2, { b: 0.6 })],
    details: [ln(o + 29.5, -0.5, o + 33, 0, 'steel:4')]
  }),
  pipe: o => ({
    shapes: [CH(o, -1.6, 22, 3.2, 'rust', 0, { b: 1 }), R(o - 0.5, -2, 1.6, 4, 0.4, 'metal', 1), R(o + 20.5, -2.2, 1.8, 4.4, 0.4, 'metal', 1)],
    details: [px(o + 7, -1, 'rust:4'), px(o + 13, 0, 'rust:1'), px(o + 16, -1, 'rust:4')]
  }),
  axe: o => ({
    shapes: [CH(o, -0.9, 20, 1.8, 'wood', 0, { b: 0.7 }), Pg([[o + 13.5, -1.2], [o + 17.5, -6.5], [o + 20.5, -7], [o + 21, -1], [o + 20.5, 4.5], [o + 17.5, 4.2], [o + 13.5, 1.2]], 'steel', 1, { b: 0.5 }), R(o + 19, -2, 3, 4, 0.5, 'metal', 2)],
    details: [ln(o + 20.4, -6.4, o + 20.4, 4, 'steel:4'), px(o + 16, -3, 'steel:1')]
  }),
  hammer: o => ({
    shapes: [CH(o, -1, 17, 2, 'wood', 0, { b: 0.7 }), R(o + 15, -5.5, 7, 11, 1.2, 'gunmetal', 1, { b: 0.6 }), R(o + 14.4, -6, 1.2, 12, 0, 'metal', 2)],
    details: [ln(o + 16.5, -4.5, o + 16.5, 4.5, 'gunmetal:4'), px(o + 20.5, -4, 'gunmetal:4')]
  })
};

export function weaponDef(kind, centered = false) {
  if (MELEE_SHAPES[kind]) return def('w:' + kind + (centered ? ':c' : ''), () => MELEE_SHAPES[kind](centered ? -LEN[kind] / 2 : 0));
  if (kind === 'shotgun') return def('w:shotgun', () => ({ shapes: [R(-10, -1.4, 7, 3.2, 1, 'wood', 0), R(-4, -1.5, 15, 2.4, 0.5, 'gunmetal', 1), R(1, 0.6, 5, 1.8, 0.6, 'wood', 2)], details: [px(9, -1, 'gunmetal:4'), ln(-3, -1, 8, -1, 'gunmetal:3')] }));
  if (kind === 'pistol') return def('w:pistol', () => ({ shapes: [R(-4, -1.6, 10, 3, 0.6, 'gunmetal', 1), R(-3.6, 0.6, 3, 4, 0.7, 'grip', 0)], details: [px(4, -1, 'gunmetal:4'), ln(-2, -1.2, 4, -1.2, 'gunmetal:3')] }));
  if (kind === 'extinguisher') return def('w:ext', () => ({ shapes: [CY(-3, -6, 6, 14, 'extRed', 0, { b: 1 }), E(0, -6, 3, 1.6, 'extRed', 0.5), R(-1.2, -9, 2.4, 3, 0.4, 'metal', 1), R(-2.4, -2, 4.8, 4, 0.5, 'label', 1, { b: 0.4 }), C(1, -8.2, 5, -7.6, 0.6, 0.6, 'ink', 2)], details: [px(-1, 0, 'barrel:2')] }));
  if (kind === 'board') return def('w:board', () => ({ shapes: [E(0, 0, 11, 2.3, 'board', 0, { b: 0.8 })], details: [ln(-9, 0, 9, 0, 'boardStripe:3'), px(8, -1, 'board:4')] }));
  if (kind === 'phone') return def('w:phone', () => ({ shapes: [R(-1.5, -2.5, 3, 5, 0.6, 'phone', 0)], details: [px(0, -1, 'screen:3'), px(0, 0, 'screen:3'), px(0, 1, 'screen:2')] }));
  return null;
}

export const LAMP_DEF = on => def(on ? 'lampOn' : 'lampOff', () => ({ shapes: [Pg([[-2.5, -1], [2.5, -1], [6.5, 4.5], [-6.5, 4.5]], 'shade', 0, { b: 0.7 }), R(-1, -3, 2, 2.5, 0.3, 'metal', 1), E(0, 5, 2.6, 1.6, on ? 'bulb' : 'bulbOff', 0.5)] }));

export function drawPropSprite(g, p, ox = 0, oy = 0) {
  const d = propDef(p);
  const sp = sprite(d, MATS, { angle: p.angle || 0, mirror: 1, variant: p.burning > 0 ? 'char1' : '' });
  g.drawImage(sp.canvas, Math.round(p.x * S + ox) - sp.ox, Math.round(p.y * S + oy) - sp.oy);
  return sp;
}
