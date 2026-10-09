// The castle arena in the renderer: its moving parts and decor, drawn each frame from the simulation
// state with the sprites of render/castle-art.js (passed in as art once it has loaded).
import { S } from '../engine/const.js';
import { MAP } from '../sim/map.js';

const X = v => Math.round(v * S);
export const CASTLE_PROPS = new Set(['candle', 'armor', 'cracked', 'roast', 'heart', 'chest', 'gargoyle', 'chandelier']);

// The pendulums, the loose stone over the pit and the hidden room's door (behind the fighters).
export function drawCastleHazards(lg, hz, ox, oy, t, art) {
  if (!art) return;
  for (const p of hz.pend || []) art.drawPendulum(lg, X(p.x) + ox, X(p.y) + oy, p.ang, X(p.len), { t });
  const ci = MAP.oneway.findIndex(p => p.kind === 'crumble');
  if (ci >= 0 && hz.crumble) {
    const p = MAP.oneway[ci], c = hz.crumble;
    const shake = c.state === 'shake' ? 1 - c.t / 0.55 : 0, gone = c.state === 'gone' ? Math.min(1, (6 - c.t) / 0.5) : 0;
    if (gone < 1) art.drawCrumble(lg, X(p.x0) + ox, X(p.x1) + ox, X(p.y) + oy, { shake, gone, t });
  }
  const d = MAP.door;
  if (d && hz.door && hz.door.open < 1) art.drawDoor(lg, X(d.x0) + ox, X(d.y0) + oy, X(d.x1) + ox, X(d.y1) + oy, hz.door.open);
}

// A castle prop (true when it was one of them).
export function drawCastleProp(lg, p, ox, oy, t, art) {
  if (!CASTLE_PROPS.has(p.kind)) return false;
  const look = p.look || {}, x = X(p.x) + ox, base = X(p.y + p.h / 2) + oy;
  if (p.kind === 'heart') { drawHeart(lg, x, X(p.y) + oy, t); return true; }
  if (!art) return true;
  switch (p.kind) {
    case 'candle': art.drawCandle(lg, x, base, { lit: !!look.lit, t, hurt: Math.min(1, (look.flash || 0) / 0.12) }); break;
    case 'armor': art.drawArmor(lg, x, base, look.face || 1, { weapon: look.weapon, hp: p.hp, max: look.max || 36, t, hurt: Math.min(1, (look.flash || 0) / 0.12) }); break;
    case 'cracked': art.drawCracked(lg, X(p.x - p.w / 2) + ox, X(p.y - p.h / 2) + oy, X(p.x + p.w / 2) + ox, base, p.hp, look.max || 60); break;
    case 'roast': art.drawRoast(lg, x, base, t); break;
    case 'chest': art.drawChest(lg, x, base, !!look.open, t); break;
    case 'gargoyle': art.drawGargoyle(lg, x, X(p.y) + oy, -1, { glow: look.glow || 0, t }); break;
    case 'chandelier': {
      const c = MAP.chandelier, a = p.angle || 0, h = p.h / 2;
      if (!c) break;
      const tx = X(p.x + Math.sin(a) * h) + ox, ty = X(p.y - Math.cos(a) * h) + oy;
      if (p.chain) art.drawChain(lg, X(c.x) + ox, X(c.anchorY) + oy, tx, ty);
      art.drawChandelier(lg, tx, ty, a, { lit: !!look.lit, t });
      break;
    }
  }
  return true;
}

// The little heart a candle drops: it bobs and blinks before it goes.
function drawHeart(g, x, y, t) {
  const by = Math.round(y + Math.sin(t * 5) * 1);
  const rows = ['.oo.oo.', 'orrorro', 'orwrrro', 'orrrrro', '.orrro.', '..oro..', '...o...'];
  const col = { o: '#3a0a1a', r: '#ff3a5e', w: '#ffd0da' };
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = col[row[i]]; if (c) { g.fillStyle = c; g.fillRect(x - 3 + i, by - 4 + j, 1, 1); } } });
}

// Lights of the castle's candles, chandelier and the like (view pixels).
export function castleLights(state, hz, t, art) {
  if (!art?.castleLights) return [];
  return art.castleLights({ props: state.props || [], hazards: hz }, t) || [];
}
