// Nox's entrance on the character select screen, played from the moment he is picked:
//   0.00  a swarm of bats spirals in onto the pedestal and he forms out of it in a flash;
//   0.62  he throws his arms open like a cape and the scythe forms out of blood in his hand;
//   1.35  he whirls it over his head and drives the butt into the floor (shockwave, splash);
//   2.05  the hero pose, looping: the reaper's guard with the scythe looming over his head, a
//         blood moon behind him, bats wheeling, his scarf streaming, blood rising off him like
//         an aura, his eyes burning, and every few seconds a quick twirl of the scythe.
// Everything is drawn on the UI canvas at the menu's pixel density.
import { FRAMES } from './anim.js';
import { figureSprite, drawFigure, figurePoint, tintOf } from './fighter-art.js';
import { slotPoint } from './pixel-data.js';
import { drawScythe, bloodPal } from './blood-art.js';
import { seeded } from '../engine/const.js';

const T_FORM = 0.62, T_SCYTHE = 0.62, T_SPIN = 1.35, T_SLAM = 1.8, T_POSE = 2.05;
const EYE = [2, -6];

const dot = (g, c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const ease = t => 1 - (1 - t) * (1 - t);
const clamp01 = v => Math.max(0, Math.min(1, v));

// One little bat, wings up or down.
function bat(g, x, y, up, d, color, eye) {
  dot(g, color, x - d, y, 3 * d, d);
  dot(g, color, x - 2 * d, y + (up ? -d : d), d, d); dot(g, color, x + 2 * d, y + (up ? -d : d), d, d);
  dot(g, color, x - 3 * d, y + (up ? -2 * d : 2 * d), d, d); dot(g, color, x + 3 * d, y + (up ? -2 * d : 2 * d), d, d);
  if (eye) dot(g, eye, x, y, d, d);
}

// A blood moon: a dithered red disc with darker seas and a pale rim on the lit side.
function moon(g, cx, cy, r, t, P) {
  const seas = [[-0.3, -0.2, 0.32], [0.25, 0.3, 0.22], [0.35, -0.35, 0.15], [-0.15, 0.4, 0.12]];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y) / r;
    if (d > 1) continue;
    const sea = seas.some(([sx, sy, sr]) => Math.hypot(x / r - sx, y / r - sy) < sr);
    const lit = (x + y) / r < -0.9 + d * 0.4;
    const c = d > 0.94 ? (x + y < 0 ? '#ff8a8a' : '#5a0a18') : sea ? '#7a1424' : lit ? '#e8445a' : (x * 3 + y * 5) % 7 === 0 ? '#a01a2e' : '#c02238';
    dot(g, c, cx + x, cy + y);
  }
  // A thin halo, breathing.
  g.globalAlpha = 0.25 + Math.sin(t * 1.6) * 0.08;
  for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; dot(g, P.light, cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); }
  g.globalAlpha = 1;
}

export class NoxHero {
  constructor(renderer) { this.r = renderer; this.key = null; }

  draw(g, x, y, t, { density: s = 2, dt = 1 / 60, gore = 2 } = {}) {
    const P = bloodPal(gore), cx = x, top = y - 24 * s;
    // The blood moon rises behind the pedestal.
    const mk = clamp01(t / 0.8);
    moon(g, cx, Math.round(y - 70 - 10 * (1 - ease(mk))), Math.round(26 * ease(mk)) || 1, t, P);
    // Bats: spiralling in at first, wheeling behind him once he stands.
    const rnd = seeded(31);
    for (let i = 0; i < 22; i++) {
      const ph = rnd() * Math.PI * 2, sp = 0.7 + rnd() * 0.8, flap = Math.floor((t * 14 + i) % 2) === 0;
      if (t < T_FORM) {
        const k = clamp01(t / T_FORM), R = (90 + rnd() * 60) * (1 - ease(k)), a = ph + k * 5 * sp;
        bat(g, cx + Math.cos(a) * R, top + 6 + Math.sin(a) * R * 0.55, flap, s, '#140a1c', P.light);
      } else if (i < 8) {
        const a = ph + t * 0.9 * sp, R = 44 + (i % 3) * 10;
        bat(g, cx + Math.cos(a) * R, y - 64 + Math.sin(a) * R * 0.32 + Math.sin(t * 3 + i) * 3, flap, s, '#1a0e24', i % 2 ? P.mid : null);
      }
    }
    if (t < T_FORM - 0.08) return;

    // His pose for this moment of the entrance.
    let name = 'nStance1', expr = 'Angry', th = 181, grow = 1, spin = null;
    if (t < T_SCYTHE) name = 'nKissA2';
    else if (t < T_SPIN) { name = 'nKissA2'; expr = 'Open'; grow = clamp01((t - T_SCYTHE) / 0.55); th = 160; }
    else if (t < T_SLAM) { name = 'ncUp'; spin = (t - T_SPIN) / (T_SLAM - T_SPIN); th = 160 + 360 * ease(spin); }
    else if (t < T_POSE) { name = 'gI'; expr = 'Open'; th = 178; }
    else {
      // The loop: two breaths, and a twirl every few seconds.
      const lt = t - T_POSE, cyc = lt % 4.2;
      name = Math.floor(lt * 1.4) % 2 ? 'heroPose2' : 'heroPose';
      th = 196 + Math.sin(lt * 2) * 3;
      if (cyc > 3.4) { spin = (cyc - 3.4) / 0.8; th = 196 + 360 * ease(spin); name = 'ncUp'; }
    }
    const frame = FRAMES[name] || FRAMES.nStance1;
    const a = this.actor ||= { id: 960, type: 4, face: 1, ground: true, vx: 0, vy: 0, attack: 0, act: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0 };
    a.vx = 3.2 + Math.sin(t * 1.3) * 1.6; // the wind streaming his scarf
    const f = { frame, expr, name };
    const chains = this.r.secondaryFor('hero').update(a, frame, t, dt);
    const { s: sp, overlay } = figureSprite(a, f, t - T_FORM < 0.08 ? 'flash' : '', chains);

    // The scythe, gripped in the back hand and drawn behind him (his sprite goes on top).
    const slot = name === 'ncUp' ? 'armF' : 'armB';
    const [hx, hy] = slotPoint(slot, frame, 0, 3);
    const gx = x + hx * s, gy = name.startsWith('hero') || name === 'nStance1' ? y - 7 * s : y + hy * s;
    if (spin != null) for (let i = 1; i <= 5; i++) drawScythe(g, P, gx, gy, th - i * 16, 1, s, 0.18 * (1 - i / 6), grow, t);
    if (t >= T_SCYTHE) drawScythe(g, P, gx, gy, th, 1, s, 1, Math.max(0.05, grow), t);

    // The aura: drops of blood rising off him, thicker once he stands in the pose.
    const aura = t >= T_POSE ? 1 : clamp01((t - T_SCYTHE) / 0.8);
    for (let i = 0; i < 12; i++) {
      const ph = (t * (0.6 + (i % 4) * 0.12) + i / 12) % 1;
      if (ph > aura) continue;
      g.globalAlpha = (1 - ph) * 0.9;
      dot(g, ph < 0.3 ? P.light : P.mid, x + Math.sin(i * 2.3) * 11 * s, y - 2 - ph * 30 * s, s, s * (ph < 0.5 ? 2 : 1));
    }
    g.globalAlpha = 1;

    // A pool of his blood spreads under him once he has driven the scythe into the floor.
    const pool = clamp01((t - T_SLAM) / 0.6);
    if (pool > 0) {
      const w = Math.round(ease(pool) * 26 * s);
      for (let i = -w; i <= w; i++) { const d = Math.abs(i) / (w || 1); if (d < 1) { dot(g, d > 0.85 ? P.out : P.mid, x + i, y - 1, 1, d < 0.6 ? 2 : 1); if (d < 0.5 && (i + Math.floor(t * 6)) % 7 === 0) dot(g, P.light, x + i, y - 1); } }
    }

    // Formed out of the swarm: fade in from a flash. The blood moon behind him rims him in red.
    g.globalAlpha = clamp01((t - (T_FORM - 0.08)) / 0.12);
    const rim = tintOf(sp, P.light);
    for (const [ox, oy] of [[-s, 0], [0, -s], [-s, -s]]) drawFigure(g, rim, x + ox, y + oy, 1, s);
    if (overlay) drawFigure(g, overlay, x, y, 1, s);
    drawFigure(g, sp, x, y, 1, s);
    g.globalAlpha = 1;

    // Burning eyes.
    const eye = figurePoint(frame, 'head', EYE[0], EYE[1], x, y, 1, s);
    const flare = 0.6 + Math.sin(t * 5) * 0.25 + (t > T_POSE && (t - T_POSE) % 4.2 > 3.3 ? 0.4 : 0);
    g.globalAlpha = clamp01(flare);
    dot(g, '#ffffff', eye.x, eye.y, s, s);
    dot(g, P.light, eye.x - s, eye.y, s, s); dot(g, P.light, eye.x + s, eye.y, s, s);
    g.globalAlpha = 1;

    // The flash he forms in, and the slam's shockwave and splash.
    const ft = t - (T_FORM - 0.08);
    if (ft > 0 && ft < 0.25) { g.globalAlpha = 1 - ft / 0.25; for (let i = 0; i < 64; i++) { const an = (i / 64) * Math.PI * 2, R = 10 + ft * 160; dot(g, '#ffffff', cx + Math.cos(an) * R, y - 22 + Math.sin(an) * R * 0.6); } g.globalAlpha = 1; }
    const st = t - T_SLAM;
    if (st > 0 && st < 0.5) {
      const k = st / 0.5;
      g.globalAlpha = 1 - k;
      for (let i = -40; i <= 40; i++) if (Math.abs(i) > k * 40 - 6) dot(g, i % 3 ? P.light : P.glint, gx + i * (0.4 + k * 1.4), y - 1 + (Math.abs(i) % 5 === 0 ? -1 : 0));
      const r2 = seeded(5);
      for (let i = 0; i < 16; i++) { const vx = (r2() - 0.5) * 3, vy = -1.5 - r2() * 3; dot(g, r2() < 0.5 ? P.mid : P.light, gx + vx * st * 30, y - 2 + vy * st * 30 + st * st * 120, s, s); }
      g.globalAlpha = 1;
    }
  }
}
