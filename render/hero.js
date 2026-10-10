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
import { slotPoint, castFor, composeChars, paletteFor } from './pixel-data.js';
import { RAGE_COLORS } from './hud.js';
import { drawScythe, bloodPal } from './blood-art.js';
import { BUD, BUBBLETS, VENUS, BITS_PAL, BURN_PAL, outline, bitCanvas, turn } from './axo-bits.js';
import { drawText } from '../engine/font.js';
import { seeded, bayer } from '../engine/const.js';

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

// Juma's entrance, played from the moment she is picked:
//   0.00  she pounces in from off the pedestal and lands in a crouch, dust kicking up;
//   0.50  the fury takes her: she shivers, steams and smoulders while her fury bar fills;
//   1.05  she bursts into the beast in a flash, and roars; the bar drains and fills again;
//   2.05  the beast heaves on all fours, stones lifting off the floor, and bursts into the TITAN:
//         the floor splits, three huge claw marks tear open in the dark behind her and burn;
//   2.85  the hero pose, looping: hunched over a cracked, glowing floor, one fist cocked, eyes
//         burning, steam on her breath, embers drifting up, and every few seconds both fists
//         hammered into the floor.
const J_LAND = 0.45, J_BEAST = 1.05, J_TITAN = 2.05, J_POSE = 2.85, J_CYCLE = 4.4;
const ROCK = ['#5a5068', '#7a6e88', '#3e3648'], EMBER = ['#ffffff', '#ffe2a0', '#ffb040', '#ff6a2a'];

// Three claw marks ripped through the dark behind her, curving, molten at the core: each one tears
// open from its top end.
function clawMarks(g, cx, cy, k, t, s) {
  const L = 44 * s;
  for (let m = 0; m < 3; m++) {
    const x0 = cx + (m - 1) * 13 * s + 16 * s, y0 = cy - 22 * s + Math.abs(m - 1) * 4 * s, len = L * ease(clamp01(k * 1.5 - m * 0.25));
    for (let d = 0; d < len; d++) {
      const u = d / L, w = Math.max(1, Math.round(Math.sin(u * Math.PI) * 4.5 * s));
      const x = x0 - d * 0.78 + Math.sin(u * Math.PI) * 5 * s, y = y0 + d * 0.85;
      g.globalAlpha = 0.8 + Math.sin(t * 8 + m * 2 + d * 0.2) * 0.2;
      dot(g, '#2a0604', x - w / 2 - s, y, w + 2 * s, 1);
      dot(g, '#c8280c', x - w / 2, y, w, 1);
      if (w > s) dot(g, '#ff7a1e', x - w / 3, y, Math.max(1, (w * 2) / 3), 1);
      if (w > s * 3) dot(g, '#ffe8a0', x - w / 8, y, Math.max(1, w / 4), 1);
    }
  }
  g.globalAlpha = 1;
}

export class JumaHero {
  constructor(renderer) { this.r = renderer; }

  draw(g, x, y, t, { density: s = 2, dt = 1 / 60 } = {}) {
    // The claw marks burn behind her from the moment the titan bursts out.
    const tear = clamp01((t - J_TITAN) / 0.4);
    if (tear > 0) clawMarks(g, x, y - 44 * s, tear, t, s);
    // Embers drifting up out of the marks.
    if (tear > 0.5) for (let i = 0; i < 14; i++) {
      const ph = (t * (0.25 + (i % 5) * 0.06) + i / 14) % 1;
      g.globalAlpha = (1 - ph) * 0.9;
      dot(g, EMBER[i % 4], x - 34 * s + ((i * 37) % 68) * s + Math.sin(t * 2 + i) * 3 * s, y - 10 * s - ph * 70 * s, s, s);
    }
    g.globalAlpha = 1;

    // Her form and pose for this moment of the entrance.
    let form = null, name = 'jStance1', expr = 'Angry', ox = 0, oy = 0, jit = 0, flash = null, face = 1;
    const cyc = t > J_POSE ? (t - J_POSE) % J_CYCLE : -1;
    if (t < J_LAND) {
      // The pounce: in from the left in an arc, claws first.
      const k = t / J_LAND;
      ox = -(1 - k) * 60 * s; oy = -Math.sin(k * Math.PI) * 26 * s;
      name = k < 0.5 ? 'jPuX' : 'jDvX'; expr = 'Open';
    } else if (t < J_LAND + 0.12) { name = 'land'; }
    else if (t < J_BEAST - 0.08) {
      const k = Math.floor(t * 22);
      name = k % 2 ? 'mShiv1' : 'mShiv2'; expr = k % 4 < 2 ? 'Angry' : 'Pain'; jit = 1;
    } else if (t < J_BEAST + 0.06) { form = 'beast'; name = 'mPop'; expr = 'Open'; flash = Math.floor(t * 40) % 2 ? '#ffffff' : '#ffe2a0'; }
    else if (t < J_BEAST + 0.5) { form = 'beast'; name = Math.floor(t * 14) % 2 ? 'bRoar' : 'bRoar2'; expr = 'Open'; }
    else if (t < J_TITAN - 0.08) {
      form = 'beast'; const k = Math.floor(t * (18 + (t - J_BEAST) * 14));
      name = k % 2 ? 'mHeave1' : 'mHeave2'; expr = k % 3 ? 'Open' : 'Pain'; jit = t > J_TITAN - 0.5 ? 2 : 1;
    } else if (t < J_TITAN + 0.08) { form = 'titan'; name = 'tRoar'; expr = 'Open'; flash = Math.floor(t * 40) % 2 ? '#ffffff' : '#ffe2a0'; }
    else if (t < J_POSE) { form = 'titan'; name = Math.floor(t * 12) % 2 ? 'tRoar' : 'tRoar2'; expr = 'Open'; jit = t < J_TITAN + 0.4 ? 2 : 1; }
    else {
      form = 'titan';
      if (cyc < 3.4) { name = Math.floor((t - J_POSE) * 1.3) % 2 ? 'tHero2' : 'tHero1'; expr = (t % 3.1) < 0.12 ? 'Blink' : 'Angry'; }
      else if (cyc < 3.78) { name = 'tSmA2'; expr = 'Open'; }
      else if (cyc < 3.88) { name = 'tSmX'; expr = 'Open'; }
      else { name = 'tSmI'; expr = 'Open'; }
    }
    const pound = cyc >= 3.88 ? cyc - 3.88 : -1;
    // The burst into the titan and each pound shake her whole stage.
    const quake = (t > J_TITAN && t < J_TITAN + 0.5) ? (1 - (t - J_TITAN) / 0.5) * 3 : pound >= 0 && pound < 0.3 ? (1 - pound / 0.3) * 2 : 0;
    if (quake > 0) { ox += Math.round(Math.sin(t * 90) * quake) * s; oy += Math.round(Math.cos(t * 77) * quake * 0.5) * s; }
    if (jit) ox += (Math.floor(t * 34) % 2 ? jit : -jit) * s;
    const fx = x + ox, fy = y + oy;

    // Cracks in the floor under her once she is the titan, glowing.
    if (t > J_TITAN) {
      const glow = 0.55 + Math.sin(t * 4) * 0.2 + (pound >= 0 ? Math.max(0, 0.5 - pound) : 0);
      const r2 = seeded(9);
      for (let i = 0; i < 6; i++) {
        let cx = x + (i % 2 ? 1 : -1) * 3 * s, cy = y - 1;
        const d = i % 2 ? 1 : -1, n = 8 + Math.floor(r2() * 8);
        for (let k = 0; k < n; k++) {
          cx += d * (1 + r2() * 2) * s * 0.7; cy += (r2() < 0.3 ? 1 : 0);
          g.globalAlpha = clamp01(glow * (1 - k / n) + 0.2);
          dot(g, k < 3 ? '#ffe08a' : '#ff5a1a', cx, Math.min(y + 4 * s, cy), s, 1);
        }
      }
      g.globalAlpha = 1;
    }

    const frame = FRAMES[name] || {};
    const a = this.actor ||= { id: 961, type: 3, face: 1, ground: true, vx: 0, vy: 0, attack: 0, act: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0 };
    a.form = form;
    const f = { frame, expr, name };
    const chains = this.r.secondaryFor('jumaHero').update(a, frame, t, dt);
    const sp = figureSprite(a, f, '', chains);
    let body = sp.s, overlay = sp.overlay;
    if (flash) { body = tintOf(body, flash); if (overlay) overlay = tintOf(overlay, flash); }

    // The fury: an aura around her silhouette, building through each change, smouldering after.
    const aura = t < J_LAND ? 0 : t < J_BEAST ? (t - J_LAND) / (J_BEAST - J_LAND) : t < J_BEAST + 0.4 ? 0.6 : t < J_TITAN ? 0.3 + (t - J_BEAST - 0.4) / (J_TITAN - J_BEAST - 0.4) * 0.7 : 0.45 + Math.sin(t * 6) * 0.15 + (pound >= 0 ? 0.3 : 0);
    if (aura > 0.05) {
      const col = aura > 0.85 ? '#ffe2a0' : form === 'titan' ? '#ff5a1a' : '#ff8a3a';
      const tb = tintOf(body, col), to = overlay && tintOf(overlay, col);
      g.globalAlpha = clamp01(aura) * (0.55 + 0.35 * Math.abs(Math.sin(t * 9)));
      for (const [dx, dy] of [[-s, 0], [s, 0], [0, -s], [0, s]]) { if (to) drawFigure(g, to, fx + dx, fy + dy, face, s); drawFigure(g, tb, fx + dx, fy + dy, face, s); }
      g.globalAlpha = 1;
    }
    if (overlay) drawFigure(g, overlay, fx, fy, face, s);
    drawFigure(g, body, fx, fy, face, s);

    // Burning eyes, and steam on her breath.
    const ch = castFor(3, form), e = ch.eye || EYE;
    if (form) {
      const eye = figurePoint(frame, 'head', e[0], e[1], fx, fy, face, s, ch);
      g.globalAlpha = clamp01(0.7 + Math.sin(t * 5) * 0.3);
      dot(g, '#ffffff', eye.x, eye.y, s, s);
      dot(g, form === 'titan' ? '#ffe08a' : '#ffc040', eye.x - s, eye.y, s, s); dot(g, form === 'titan' ? '#ffe08a' : '#ffc040', eye.x + s, eye.y, s, s);
      g.globalAlpha = 1;
    }
    if (t > J_POSE) for (let i = 0; i < 6; i++) {
      const ph = ((t * 0.8 + i / 6) % 1);
      g.globalAlpha = (1 - ph) * 0.35;
      dot(g, '#e8e4f0', fx + (22 + ph * 14) * s, fy - (30 + ph * 10 + Math.sin(t * 3 + i) * 2) * s, 2 * s, 2 * s);
    }
    g.globalAlpha = 1;

    // Steam and embers pouring off her while she changes; stones lifting into the titan.
    const changing = (t > J_LAND && t < J_BEAST) || (t > J_BEAST + 0.5 && t < J_TITAN);
    if (changing) for (let i = 0; i < 10; i++) {
      const ph = (t * 1.6 + i / 10) % 1;
      g.globalAlpha = (1 - ph) * 0.8;
      dot(g, i % 3 ? EMBER[1 + (i % 3)] : '#e8e4f0', x + Math.sin(i * 2.7) * 12 * s, y - 4 * s - ph * 30 * s, s, i % 3 ? s : 2 * s);
      if (t > J_BEAST + 0.5 && i < 6) { g.globalAlpha = 1 - ph; dot(g, ROCK[i % 3], x + (i - 2.5) * 9 * s, y - ph * 22 * s, 2 * s, 2 * s); }
    }
    g.globalAlpha = 1;

    // Landing dust, the pops, the pounds: rings and rocks along the floor.
    const burst = (t0, R, n, col) => {
      const k = (t - t0) / 0.5;
      if (k < 0 || k >= 1) return;
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 48; i++) { const an = (i / 48) * Math.PI * 2; dot(g, col, x + Math.cos(an) * R * ease(k) * s, y - 14 * s + Math.sin(an) * R * ease(k) * 0.6 * s); }
      const r3 = seeded(Math.round(t0 * 100));
      for (let i = 0; i < n; i++) { const vx = (r3() - 0.5) * 3, vy = -1.5 - r3() * 3; dot(g, ROCK[i % 3], x + vx * k * 30 * s, y - 2 + (vy * k * 30 + k * k * 60) * s, 2 * s, 2 * s); }
      g.globalAlpha = 1;
    };
    burst(J_LAND, 18, 4, '#c8b8d8');
    burst(J_BEAST, 40, 8, '#ffb070');
    burst(J_TITAN, 70, 16, '#ff5a1a');
    if (pound >= 0) burst(t - pound, 46, 10, '#ffe2a0');

    // The fury bar on the front of the pedestal: filling, draining at each change, molten at the end.
    const fill = t < J_LAND ? 0 : t < J_BEAST ? (t - J_LAND) / (J_BEAST - J_LAND - 0.08) : t < J_BEAST + 0.3 ? 1 - (t - J_BEAST) / 0.3 : t < J_TITAN ? (t - J_BEAST - 0.3) / (J_TITAN - J_BEAST - 0.38) : 1;
    const stage = t < J_BEAST ? 'small' : t < J_TITAN ? 'beast' : 'titan', c = RAGE_COLORS[stage], bw = 52, bx = x - bw / 2, by = y + 4;
    dot(g, '#0b0812', bx - 1, by - 1, bw + 2, 4);
    dot(g, c.back, bx, by, bw, 2);
    const fw = Math.round(bw * clamp01(fill));
    for (let i = 0; i < fw; i++) dot(g, ((i - Math.floor(t * 26)) % 6 + 6) % 6 < 2 ? c.light : c.base, bx + i, by, 1, 2);
    if (fw > 0 && fw < bw) dot(g, '#ffffff', bx + fw - 1, by, 1, 2);
  }
}

// Don's entrance, played from the moment he is picked:
//   0.00  he cannonballs in from above, curled up and spinning, and lands on the pedestal in a
//         big slimy splash, squashed flat;
//   0.55  he rises, a fly buzzes past and his tongue snatches it out of the air: GLUP;
//   1.45  the boss pose, looping: planted wide under the slats of light of a film-noir office,
//         one fist out, his cigar smoking, blowing smoke rings; every few seconds the fly comes
//         back and the tongue gets it again.
const F_LAND = 0.42, F_RISE = 0.6, F_POSE = 1.45, F_CYCLE = 4.6;
const SLIME = ['#c8f080', '#9be05a', '#6b9e3c', '#e8ffd0'];

// A fly: a dark body and two flickering wings.
function fly(g, x, y, t, s) {
  dot(g, '#120d1e', x - s, y, 3 * s, 2 * s);
  dot(g, '#7a2a3a', x + s, y, s, s);
  g.globalAlpha = 0.75;
  const up = Math.floor(t * 40) % 2;
  dot(g, '#e8f4ff', x - s, y - (up ? 2 : 1) * s, 2 * s, s);
  g.globalAlpha = 1;
}

export class FrogHero {
  constructor(renderer) { this.r = renderer; }

  draw(g, x, y, t, { density: s = 2, dt = 1 / 60 } = {}) {
    // Film noir: slats of light from a window blind fall across the dark behind him.
    const lit = clamp01((t - F_LAND) / 0.5);
    if (lit > 0) {
      for (let i = 0; i < 6; i++) {
        g.globalAlpha = lit * (0.1 + (i % 2) * 0.04) * (0.9 + Math.sin(t * 0.7) * 0.1);
        for (let k = 0; k < 4 * s; k++) dot(g, '#f2d890', x - 22 * s + i * 4 * s - k * 0.5, y - 74 * s + i * 10 * s + k, 40 * s, 1);
      }
      g.globalAlpha = 1;
    }
    let name = 'fHero1', expr = '', ox = 0, oy = 0, spin = 0, tongue = 0, flyAt = null;
    const cyc = t > F_POSE ? (t - F_POSE) % F_CYCLE : -1;
    if (t < F_LAND) {
      // In from above, curled up and spinning.
      const k = t / F_LAND;
      ox = -(1 - k) * 40 * s; oy = -(1 - k * k) * 90 * s;
      name = 'fBall'; expr = 'Angry'; spin = Math.floor(t * 18);
    } else if (t < F_RISE) { name = 'fSqI'; expr = 'Open'; }
    else if (t < F_POSE || cyc > 3) {
      // The fly: in along a wobbling path, the tongue out to it, back in, the gulp.
      const lt = t < F_POSE ? (t - F_RISE) / (F_POSE - F_RISE) : (cyc - 3) / (F_CYCLE - 3);
      if (lt < 0.35) { name = 'fHero1'; expr = 'Angry'; const k = lt / 0.35; flyAt = [x + (60 - 26 * k) * s + Math.sin(t * 19) * 3 * s, y - (44 - 18 * k) * s + Math.cos(t * 23) * 3 * s]; }
      else if (lt < 0.5) { name = 'fLhX'; expr = 'Wide'; tongue = Math.sin(((lt - 0.35) / 0.15) * Math.PI); }
      else if (lt < 0.72) { name = 'fGulp1'; expr = 'Puff'; }
      else { name = 'fHero2'; expr = 'Blink'; }
    } else {
      name = Math.floor((t - F_POSE) * 1.3) % 2 ? 'fHero2' : 'fHero1';
      expr = (t % 3.3) < 0.12 ? 'Blink' : '';
    }
    const frame = { ...(FRAMES[name] || {}), ...(spin ? { spin } : {}) };
    const fx = x + ox, fy = y + oy;
    const a = this.actor ||= { id: 962, type: 5, face: 1, ground: true, vx: 0, vy: 0, attack: 0, act: null, copy: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0 };
    const f = { frame, expr, name };
    const { s: sp } = figureSprite(a, f, t > F_LAND && t < F_LAND + 0.06 ? 'flash' : '', null);
    // The light through the blinds rims him from the upper left.
    if (lit > 0) { g.globalAlpha = lit; const rim = tintOf(sp, '#f2d890'); for (const [dx, dy] of [[-s, 0], [0, -s]]) drawFigure(g, rim, fx + dx, fy + dy, 1, s); g.globalAlpha = 1; }
    drawFigure(g, sp, fx, fy, 1, s);
    const ch = castFor(5, null);
    if (tongue > 0) {
      const m = ch.mouth || [8, -3];
      this.r.tongueAt(g, figurePoint(frame, 'head', m[0], m[1], fx, fy, 1, s, ch), tongue * 34 * s, 1, s, -tongue * 18 * s);
    }
    if (flyAt) fly(g, flyAt[0], flyAt[1], t, s);
    // Cigar smoke curling up off the ember, and a smoke ring now and then.
    if (t > F_RISE && expr !== 'Wide' && expr !== 'Puff') {
      const ember = figurePoint(frame, 'head', 11, -5, fx, fy, 1, s, ch);
      dot(g, Math.floor(t * 6) % 3 ? '#ff6a2a' : '#ffe2a0', ember.x, ember.y, s, s);
      for (let i = 0; i < 8; i++) {
        const ph = (t * 0.5 + i / 8) % 1;
        g.globalAlpha = (1 - ph) * 0.45;
        dot(g, i % 2 ? '#c8c0d8' : '#a8a0c0', ember.x + Math.sin(t * 2 + i * 1.7 + ph * 5) * 3 * s * ph, ember.y - ph * 30 * s, s * (ph > 0.5 ? 2 : 1), s * (ph > 0.5 ? 2 : 1));
      }
      const rp = cyc >= 0 && cyc < 3 ? (cyc % 1.5) / 1.5 : -1;
      if (rp >= 0) {
        g.globalAlpha = (1 - rp) * 0.6;
        const R = (2 + rp * 5) * s, cx2 = ember.x + 6 * s + rp * 14 * s, cy2 = ember.y - 4 * s - rp * 22 * s;
        for (let i = 0; i < 20; i++) { const an = (i / 20) * Math.PI * 2; dot(g, '#e8e4f0', cx2 + Math.cos(an) * R, cy2 + Math.sin(an) * R * 0.5, s, s); }
      }
      g.globalAlpha = 1;
    }
    // The splash: slime thrown up all around as he lands, and a ring along the floor.
    const sk = (t - F_LAND) / 0.6;
    if (sk > 0 && sk < 1) {
      const r3 = seeded(77);
      g.globalAlpha = 1 - sk;
      for (let i = 0; i < 26; i++) { const vx = (r3() - 0.5) * 4, vy = -2 - r3() * 3.5; dot(g, SLIME[i % 4], x + vx * sk * 26 * s, y - 2 * s + (vy * sk * 26 + sk * sk * 70) * s, s * (i % 3 ? 1 : 2), s); }
      for (let i = 0; i < 48; i++) { const an = (i / 48) * Math.PI * 2; dot(g, '#c8f080', x + Math.cos(an) * 34 * ease(sk) * s, y - 2 * s + Math.sin(an) * 6 * ease(sk) * s); }
      g.globalAlpha = 1;
    }
    // A slime puddle stays on the pedestal.
    const pool = clamp01((t - F_LAND) / 0.4);
    if (pool > 0) { const w = Math.round(ease(pool) * 22 * s); for (let i = -w; i <= w; i++) { const d = Math.abs(i) / (w || 1); dot(g, d > 0.85 ? '#3d6a2a' : '#6b9e3c', x + i, y - 1, 1, d < 0.6 ? 2 : 1); if (d < 0.5 && (i + Math.floor(t * 5)) % 9 === 0) dot(g, '#c8f080', x + i, y - 1); } }
  }
}

// Xolo's entrance, played from the moment it is picked:
//   0.00  deep water floods the stage while a bubble wobbles up out of a puddle of goo on the
//         pedestal, Xolo curled up inside it;
//   0.45  the bubble pops and Xolo drops out belly-first in a slimy splash, a ring running out
//         along the floor;
//   0.80  it twists round, bites the tip off its own tail (NHAC!) and spits it out ahead;
//   1.10  the tip buds and hatches into a clone that shakes itself off, and two drops of goo flung
//         off its gills pop into two more: one behind it, one on top of its head;
//   1.75  all four look out at you, and for three frames the clones' eyes burn and their smiles
//         split into teeth under lightning off the Venus star; then they are cute again;
//   2.05  the hero pose, looping: low and wide on the bottom of the deep, gills flared, one clone
//         riding its head and two at its feet breathing a beat after it; the gills flick, bubbles
//         rise, and every few seconds one of the clones flashes into the demon it can become.
// Everything sits on the sprites' own pixel grid: positions are whole cells of `density` pixels.
const X_POP = 0.45, X_LAND = 0.62, X_UP = 0.72, X_BITE = 0.8, X_CHOMP = 0.9, X_SPIT = 0.98, X_TIP = 1.1, X_HATCH = 1.5;
const X_FLING = [1.14, 1.27], X_BACK = 1.3, X_RIDE = 1.45, X_LOOK = 1.75, X_TEASE = 1.82, X_POSE = 2.05, X_FLASH = 4.5, TEASE_F = 0.07;
const GOO = ['#fff4f6', '#ffd0de', '#f69bb7', '#d26f90'];
// The water: a cone of deep blue-green under the light, darkening with depth (and the same cone
// gone to blood while the clones show their teeth); the light bands, rays and surface; the star.
const SEA = ['#1a4562', '#163b56', '#12324b', '#0e2940', '#0b2135', '#09192b'];
const BLOOD = ['#5a1626', '#4c1020', '#3e0c1a', '#300a15', '#24070f', '#1a050b'];
const BANDS = ['#3c8cb0', '#327b9e', '#296a8a', '#215a76'], SURF = ['#6cbcdc', '#d8f6ff'];
const STAR_PAL = { r: '#2c3c5e', q: '#7486b4', y: '#dce6ff' };
const FOAM = { 1: '#a8e4f8', w: '#ffffff', 3: '#3a8ab0' };
const TOP_W = 10, FLOOR_W = 22, DEEP = 64;
// Where each clone ends up (cells from the middle of the pedestal; the rider sits on the head),
// and how long after Xolo it breathes and flicks its gills.
const XU = -4, BROOD_AT = { back: -17, front: 14 }, ECHO = { back: 0.34, front: 0.24, head: 0.14 };
// The rider lies on its belly along the top of Xolo's skull, chin on its brow, arms dangling and
// legs trailing over the gills, lifting its head with each breath.
const RIDE = [
  { head: [3, 3], body: [0, 0], armF: [1, 0, -22.5], armB: [0, 0, -11.25], footF: [-3, -1, 90], footB: [-4, -1, 101.25], tailDeg: 10 },
  { head: [3, 2], body: [0, 0], armF: [1, 0, -33.75], armB: [0, 0, -22.5], footF: [-3, -1, 90], footB: [-4, -1, 101.25], tailDeg: 18 }
];
// Curled up asleep in the bubble, the tail wrapped round under it.
const CURL = { head: [1, 3, 33.75], body: [0, 1], armF: [1, 1, -45], armB: [0, 1, -22.5], footF: [1, -1, -22.5], footB: [-1, -1], front: 'tail', tail: [[1, 0], [-1, 2], [-1, 5], [2, 7], [6, 7], [9, 5]] };
// The tip of the tail it bites off: a tapering paddle end, the bitten end sealed pale (c/k).
const TIP = outline(['.1155.', 'k11119', 'c22299', '.3388.']);
// A drop of goo flung off the gills, and the little puddle a clone pops up out of.
const DROP = outline(['.1.', '1f2', '223']), PUD = ['.21f1.', '233332'];
// Xolo's eye and the top of its skull, in head cells; the clone's eye.
const XEYE = [7, -6], XTOP = [-1, -8], MEYE = [3, -5];

// How wide the cone of water is (half, in cells) at row j down from its surface.
const coneW = j => TOP_W + (FLOOR_W - TOP_W) * (j / DEEP) ** 0.8;
// How solid the water is at a cell: whole inside, a checker on its last cells, nothing past it.
function inCone(i, j) {
  const e = coneW(j) - Math.abs(i + 0.5);
  return e >= 2 || (e >= 1 ? (i + j) % 2 === 0 : e >= 0 && (i + 2 * j) % 4 === 0);
}
const water = new Map();
// The cone of water behind the pedestal, one cell per pixel (drawn at density): bands of depth
// meeting in a checker, its sides dissolving into the dark.
function waterCone(pal) {
  if (water.has(pal)) return water.get(pal);
  const c = document.createElement('canvas'); c.width = FLOOR_W * 2; c.height = DEEP;
  const g = c.getContext('2d'), per = DEEP / pal.length;
  for (let j = 0; j < DEEP; j++) for (let i = -FLOOR_W; i < FLOOR_W; i++) {
    if (!inCone(i, j)) continue;
    const b = Math.floor(j / per), next = j % per >= per - 2 && (i + j) % 2 === 0 && b < pal.length - 1;
    g.fillStyle = pal[next ? b + 1 : b];
    g.fillRect(i + FLOOR_W, j, 1, 1);
  }
  water.set(pal, c);
  return c;
}

// A lightning bolt between two cells: a jagged white core with a gold glow along one side.
function bolt(g, ox, oy, x0, y0, x1, y1, seed, s, alpha = 1) {
  const r = seeded(seed), n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4)), pts = [[x0, y0]];
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < n; i++) { const k = i / n, j = (r() - 0.5) * 5; pts.push([x0 + (x1 - x0) * k + (nx / nl) * j, y0 + (y1 - y0) * k + (ny / nl) * j]); }
  pts.push([x1, y1]);
  for (const [col, dx, a] of [['#ffd040', 1, 0.6], ['#ffffff', 0, 1]]) {
    g.globalAlpha = alpha * a;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], m = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let k = 0; k <= m; k++) dot(g, col, ox + (Math.round(ax + ((bx - ax) * k) / m) + dx) * s, oy + Math.round(ay + ((by - ay) * k) / m) * s, s, s);
    }
  }
  g.globalAlpha = 1;
}

// A bubble on the cell grid: a faint film, a rim lit on the upper left, a shine.
function bubble(g, ox, oy, cx, cy, rx, ry, s) {
  g.globalAlpha = 0.18;
  for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2))); dot(g, '#bfeaff', ox + (cx - hw) * s, oy + (cy + y) * s, (hw * 2 + 1) * s, s); }
  g.globalAlpha = 0.9;
  const n = Math.round(Math.max(rx, ry) * 7), seen = new Set();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry), k = x + ',' + y;
    if (seen.has(k)) continue;
    seen.add(k);
    const lit = Math.cos(a + 2.356);
    dot(g, lit > 0.6 ? '#ffffff' : lit < -0.4 ? '#4a96c0' : '#a8e4f8', ox + x * s, oy + y * s, s, s);
  }
  g.globalAlpha = 1;
  for (let a = -2.7; a <= -2.0; a += 0.18) dot(g, '#ffffff', ox + Math.round(cx + Math.cos(a) * (rx - 2)) * s, oy + Math.round(cy + Math.sin(a) * (ry - 2)) * s, s, s);
}

// A four-point twinkle of white light on a cell.
function glint(g, X, Y, s) {
  dot(g, '#ffffff', X, Y, s, s);
  g.globalAlpha = 0.8;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(g, '#bfeaff', X + dx * s, Y + dy * s, s, s);
  g.globalAlpha = 1;
}

// A pixel matrix drawn at density with its top-left on the cell grid.
const stamp = (g, rows, pal, key, x, y, s, face = 1) => g.drawImage(bitCanvas(rows, pal, key, face), x, y, rows[0].length * s, rows.length * s);

export class XoloHero {
  constructor(renderer) { this.r = renderer; this.sprites = new Map(); }

  // A clone's figure: its own cast, or with its eyes burning and its smile split into teeth.
  mini(form, frame, expr, tease = false) {
    if (!tease) return figureSprite({ id: 964, type: 6, form, severed: [], wounds: {} }, { frame, expr }, '', null).s;
    const key = JSON.stringify(frame);
    let sp = this.sprites.get(key);
    if (!sp) {
      const ch = this.teaser(), out = composeChars(ch, frame, {});
      sp = { canvas: bitCanvas(out.rows, paletteFor(ch), 'xoloTease' + key), flipped: null, x0: out.x0, y0: out.y0, w: out.w, h: out.h };
      this.sprites.set(key, sp);
    }
    return sp;
  }
  // The clone's cast with the special's teaser face, made from its own open-mouthed face: the eye
  // shine white-hot and the eye ember, the upper lip a row of needle teeth, the gape below a row
  // of teeth set between them on red gums.
  teaser() {
    if (this.tease) return this.tease;
    const ch = castFor(6, 'mini'), base = ch.parts.headOpen || ch.parts.head;
    let lip = -1, shine = false;
    const head = base.map((row, y) => {
      if (lip < 0 && y > base.length / 2 && [...row].filter(c => c === 'm').length > 2) lip = y;
      return [...row].map((c, x) => {
        if (c === 'w' || (c === 'e' && !shine)) { shine = true; return 'f'; }
        if (c === 'e') return 'v';
        if (lip >= 0 && y === lip && c === 'm') return x % 2 ? 'f' : 'm';
        if (lip >= 0 && y > lip && c === 'm') return 'g';
        if (lip >= 0 && y > lip && c === '6') return x % 2 ? 'm' : 'f';
        return c;
      }).join('');
    });
    return (this.tease = { ...ch, id: 'axoMiniTease', palette: { ...ch.palette, m: '#2a0612', v: '#ff6a1e' }, parts: { ...ch.parts, head } });
  }

  draw(g, x, y, t, { density: s = 2, dt = 1 / 60 } = {}) {
    const C = (u, v) => [x + Math.round(u) * s, y + Math.round(v) * s];
    const tease = t >= X_TEASE && t < X_TEASE + 3 * TEASE_F ? Math.floor((t - X_TEASE) / TEASE_F) : -1;
    const lt = t - X_POSE, cyc = lt >= 0 ? Math.floor(lt / X_FLASH) : -1, fl = lt >= 0 ? lt % X_FLASH : -1;
    // Every few seconds in the pose, one clone flashes demon for three frames.
    const flashing = fl >= 2 && fl < 2 + 3 * TEASE_F ? Math.floor((fl - 2) / TEASE_F) : -1;
    const flashWho = ['back', 'front', 'head'][Math.floor(seeded(cyc + 7)() * 3)];

    // The deep: the water floods up the cone of light as the bubble rises, then laps at its surface.
    const fill = ease(clamp01(t / 0.42)), level = Math.max(1, Math.round(DEEP * fill)), top = -level, j0 = DEEP - level;
    g.drawImage(waterCone(tease >= 0 && tease < 2 ? BLOOD : SEA), 0, j0, FLOOR_W * 2, level, x - FLOOR_W * s, y + top * s, FLOOR_W * 2 * s, level * s);
    const cell = (i, j, c) => { if (j >= j0 && inCone(i, j)) dot(g, c, x + i * s, y + (j - DEEP) * s, s, s); };
    if (!(tease >= 0 && tease < 2)) {
      // Two shafts of light slanting down from the surface, swaying, each a band lighter than the
      // water it crosses, ending in a checker.
      const per = DEEP / SEA.length;
      for (let k = 0; k < 2; k++) {
        const i0 = (k ? 4 : -6) + Math.round(Math.sin(t * 0.45 + k * 2.4) * 2);
        for (let j = j0 + 1; j < j0 + 40 && j < DEEP; j++) {
          const b = Math.floor(j / per), end = j - j0 > 30;
          for (let w = 0; w < 3; w++) { const i = i0 + w + Math.round((j - j0) * 0.3); if (!end || (i + j) % 2 === 0) cell(i, j, SEA[Math.max(0, b - 1)]); }
        }
      }
      // The light bands: wavy lines of light under the surface, breaking up and re-forming, dimmer
      // the deeper they lie.
      [2, 5, 9, 14].forEach((d, k) => {
        let prev = null;
        for (let i = -FLOOR_W; i < FLOOR_W; i++) {
          if (Math.sin(i * 0.42 + t * (0.9 + k * 0.2) + k * 2.3) < -0.35) { prev = null; continue; }
          const j = j0 + d + Math.round(Math.sin(i * 0.55 - t * (1.6 - k * 0.2) + k) * 1.2);
          if (prev != null) for (let jj = Math.min(prev, j) + 1; jj < Math.max(prev, j); jj++) cell(i, jj, BANDS[k]);
          cell(i, j, BANDS[k]);
          prev = j;
        }
      });
    }
    // The surface: a bright line lapping across the top of the cone, crests running along it; it
    // rolls in big waves while the water is still flooding in.
    for (let i = -FLOOR_W; i < FLOOR_W; i++) {
      const lap = Math.round(Math.sin(i * 0.6 + t * 3.2) * 0.6 + (t < 0.7 ? Math.sin(i * 0.9 - t * 9) * (0.7 - t) * 2.4 : 0));
      if (inCone(i, j0)) dot(g, (i + Math.floor(t * 5)) % 7 === 0 ? SURF[1] : SURF[0], x + i * s, y + (top + lap) * s, s, s);
    }

    // The Venus star of Xolotl, faint over the water; it flares up gold and red while the clones
    // show their teeth.
    const star = clamp01((t - X_LAND) / 0.8);
    if (star > 0) {
      const flare = tease >= 0 || flashing >= 0, v = flare ? VENUS[2] : VENUS[1], [vx, vy] = C(5 - (v[0].length >> 1), -DEEP - 9 - (v.length >> 1));
      g.globalAlpha = flare ? 1 : star * (0.7 + 0.2 * Math.sin(t * 2.3));
      stamp(g, v, flare ? BURN_PAL : STAR_PAL, flare ? 'venusL' : 'venusM', vx, vy, s);
      g.globalAlpha = 1;
    }

    // Bubbles rising off the bottom (they swell as they rise) and popping at the surface.
    if (t > 0.35) {
      const r = seeded(19);
      for (let i = 0; i < 9; i++) {
        const per = 2.4 + r() * 2.2, ph = ((t - 0.35) / per + r()) % 1, v = -2 - ph * (DEEP - 4), w = coneW(DEEP + v) - 4;
        const u = (r() - 0.5) * 2 * w + Math.sin(t * 2.6 + i * 1.9) * 1.2, m = BUBBLETS[ph < 0.3 ? 0 : ph < 0.75 ? 1 : 2];
        g.globalAlpha = 0.75;
        stamp(g, m, FOAM, 'foam' + m.length, ...C(u - (m[0].length >> 1), v - (m.length >> 1)), s);
      }
      g.globalAlpha = 1;
    }

    // Xolo's pose and place for this moment.
    let name = 'xStance1', frame = null, expr = '', fv = 0, inside = 0;
    const fu = XU;
    if (t < X_POP) { frame = CURL; expr = Math.floor(t * 3) % 2 ? 'Blink' : ''; }
    else if (t < X_UP) { name = 'xFlop'; expr = 'Open'; }
    else if (t < X_BITE) { name = 'xSlR'; expr = 'Angry'; }
    else if (t < X_CHOMP) { name = 'xShA'; expr = 'Open'; }
    else if (t < X_SPIT) { name = 'xShA'; expr = 'Angry'; }
    else if (t < X_SPIT + 0.12) { name = 'xShX'; expr = 'Wide'; }
    else if (t < 1.14) { name = 'xShR'; }
    else if (t < X_LOOK) { name = 'xStance1'; expr = (t > 1.14 && t < 1.22) || (t > 1.27 && t < 1.35) ? 'Lash' : ''; }
    else if (t < X_POSE) { name = 'xStance1'; expr = tease >= 0 ? 'Open' : ''; }
    else { name = Math.floor(lt * 1.6) % 2 ? 'xStance2' : 'xStance1'; expr = lt % 1.2 < 0.14 ? 'Blink' : ''; }
    frame ||= FRAMES[name] || FRAMES.xStance1 || {};
    // In the bubble: carried up with it, bobbing; out of it, dropping belly-first to the floor.
    const bk = clamp01((t - 0.02) / (X_POP - 0.02)), R = 3 + 10 * ease(clamp01(bk * 2.2)), bcy = -R - 10 * bk ** 1.5;
    if (t < X_POP) { fv = Math.round(bcy + 5 + Math.sin(t * 9)); inside = clamp01((R - 8) / 3); }
    else if (t < X_LAND) { const k = (t - X_POP) / (X_LAND - X_POP); fv = Math.round((bcy + 5) * (1 - k * k)); }
    const [fx, fy] = C(fu, fv), XCH = castFor(6, null), MCH = castFor(6, 'mini');
    // A point on Xolo's head (head cells) in cells from the middle of the pedestal.
    const onHead = (u, v) => { const p = figurePoint(frame, 'head', u, v, 0, 0, 1, 1, XCH); return [fu + p.x, fv + p.y]; };

    const a = this.actor ||= { id: 963, type: 6, face: 1, ground: true, vx: 0, vy: 0, attack: 0, act: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0, axo: null };
    // From the bite until the pose, the tail is short and grows back.
    a.axo = t >= X_SPIT && t < X_POSE ? { tail: 1, regrow: { tail: 0.68 + 0.32 * clamp01((t - X_SPIT) / (X_POSE - 0.2 - X_SPIT)) } } : null;
    const chains = this.r.secondaryFor('xoloHero').update(a, frame, t, dt);
    const { s: body, overlay } = figureSprite(a, { frame, expr, name }, t >= X_LAND && t < X_LAND + 0.05 ? 'flash' : '', chains);

    // The puddle of goo on the pedestal: a drop at first, flattened wide by the landing.
    const pw = t < X_LAND ? Math.round(2 + 4 * clamp01(t / 0.2)) : Math.round(6 + 11 * ease(clamp01((t - X_LAND) / 0.35)));
    for (let i = -pw; i <= pw; i++) {
      const d = Math.abs(i) / pw;
      if (d < 0.7) dot(g, (i + Math.floor(t * 4)) % 6 === 0 ? GOO[0] : GOO[1], ...C(fu + i, -2), s, s);
      dot(g, d > 0.85 ? GOO[3] : GOO[2], ...C(fu + i, -1), s, s);
    }

    // The clones: where each one is and what it is doing.
    const brood = [];
    const sunk = born => Math.round((1 - clamp01((t - born) / 0.2)) * 8);
    // Before the pose they stand still; in it they breathe and flick their gills a beat after Xolo.
    const miniPose = (who, born) => {
      const lag = ECHO[who];
      if (t < born + 0.22) return [FRAMES.cPop, 'Open'];
      if (t < X_POSE) return [FRAMES.cIdle1, t < X_LOOK && (t - born) % 1.1 < 0.12 ? 'Blink' : ''];
      return [FRAMES[Math.floor((lt - lag) * 1.6) % 2 ? 'cIdle2' : 'cIdle1'] || FRAMES.cIdle1, ((lt - lag + 12) % 1.2) < 0.14 ? 'Blink' : ''];
    };
    // Behind it: popped out of the first drop.
    if (t >= X_BACK) {
      const [f, e] = miniPose('back', X_BACK);
      brood.push({ who: 'back', u: BROOD_AT.back, v: 0, frame: f, expr: e, sink: sunk(X_BACK), behind: true });
    }
    // In front: hatched out of the bitten-off tip, shaking itself dry.
    if (t >= X_HATCH) {
      const h = t - X_HATCH;
      const [f, e] = h < 0.25 ? [FRAMES[Math.floor(h * 16) % 2 ? 'cHatch2' : 'cHatch1'] || FRAMES.cIdle1, h < 0.08 ? 'Blink' : 'Open'] : miniPose('front', X_HATCH);
      brood.push({ who: 'front', u: BROOD_AT.front, v: 0, frame: f, expr: e, sink: 0, behind: true });
    }
    // On its head: popped out of the second drop, then lying there with its chin on the brow.
    if (t >= X_RIDE) {
      const [u, v] = onHead(XTOP[0], XTOP[1]), lag = ECHO.head;
      const sit = t < X_RIDE + 0.22 ? FRAMES.cPop : RIDE[t < X_POSE ? 0 : Math.floor((lt - lag) * 1.6) % 2 ? 1 : 0];
      const e = t < X_RIDE + 0.22 ? 'Open' : t >= X_POSE && ((lt - lag + 12) % 1.2) < 0.14 ? 'Blink' : '';
      brood.push({ who: 'head', u: Math.round(u), v: Math.round(v), frame: sit, expr: e, sink: sunk(X_RIDE), behind: true });
    }
    // The teaser turns all three for three frames (eyes and teeth only); in the pose, one of them
    // flashes the whole demon on its middle frame.
    for (const m of brood) {
      m.flash = tease >= 0 ? tease : m.who === flashWho ? flashing : -1;
      const demon = m.flash === 1 && tease < 0;
      if (demon) { m.frame = FRAMES.dIdle1 || {}; m.expr = 'Maw'; }
      m.form = demon ? 'demon' : 'mini';
      m.sp = this.mini(m.form, m.frame, m.expr, m.flash >= 0 && !demon);
    }
    // The light from above rims every figure along its top edge.
    const rimmed = (sp, X, Y) => {
      g.globalAlpha = 0.55 * fill;
      drawFigure(g, tintOf(sp, '#9fe4ff'), X, Y - s, 1, s);
      g.globalAlpha = 1;
      drawFigure(g, sp, X, Y, 1, s);
    };
    const drawMini = m => {
      const [X, Y] = C(m.u, m.v);
      if (m.sink > 0) {
        // Rising out of its drop of goo: whatever is still under the surface does not show.
        g.save(); g.beginPath(); g.rect(X - 20 * s, Y - 30 * s, 40 * s, 30 * s); g.clip();
        drawFigure(g, m.sp, X, Y + m.sink * s, 1, s);
        g.restore();
        stamp(g, PUD, BITS_PAL, 'xoloPud', X - 3 * s, Y - s, s);
        return;
      }
      rimmed(m.sp, X, Y);
      // The one at the back sits deeper in the water.
      if (m.who === 'back' && m.flash < 0) { g.globalAlpha = 0.2; drawFigure(g, tintOf(m.sp, SEA[1]), X, Y, 1, s); g.globalAlpha = 1; }
    };

    // Back to front: the tail, the clones (the one ahead tucks its tail under Xolo's chin, the rider
    // lies in among the gill fronds), Xolo.
    if (t < X_POP) g.globalAlpha = inside;
    if (overlay) drawFigure(g, overlay, fx, fy, 1, s);
    g.globalAlpha = 1;
    for (const m of brood) if (m.behind) drawMini(m);
    if (t < X_POP) {
      // Seen through the bubble's film.
      g.globalAlpha = inside;
      drawFigure(g, body, fx, fy, 1, s);
      g.globalAlpha = inside * 0.35;
      drawFigure(g, tintOf(body, '#bfeaff'), fx, fy, 1, s);
      g.globalAlpha = 1;
    } else rimmed(body, fx, fy);
    for (const m of brood) if (!m.behind && !m.top) drawMini(m);

    // The bubble, and its pop: the film tears into a ring of droplets and a spray of little bubbles.
    if (t > 0.02 && t < X_POP) bubble(g, x, y, fu, Math.round(bcy), R + Math.sin(t * 14) * 0.8, R - Math.sin(t * 14) * 0.8, s);
    const pk = (t - X_POP) / 0.3;
    if (pk >= 0 && pk < 1) {
      const r = seeded(41), cy = -23;
      g.globalAlpha = 1 - pk;
      for (let i = 0; i < 28; i++) { const an = (i / 28) * Math.PI * 2; dot(g, i % 3 ? '#a8e4f8' : '#ffffff', ...C(fu + Math.cos(an) * (13 + pk * 9), cy + Math.sin(an) * (13 + pk * 9)), s, s); }
      for (let i = 0; i < 10; i++) {
        const an = r() * Math.PI * 2, sp = 10 + r() * 14, m = BUBBLETS[i % 3];
        stamp(g, m, FOAM, 'foam' + m.length, ...C(fu + Math.cos(an) * sp * pk * 1.6 - 1, cy + Math.sin(an) * sp * pk * 1.6 - pk * 6 - 1), s);
      }
      g.globalAlpha = 1;
    }
    // The belly flop: goo thrown up all around and a ring running out along the floor.
    const sk = (t - X_LAND) / 0.55;
    if (sk > 0 && sk < 1) {
      const r = seeded(77);
      g.globalAlpha = 1 - sk * sk;
      for (let i = 0; i < 24; i++) { const vx = (r() - 0.5) * 2.6, vy = -1.2 - r() * 1.8; dot(g, GOO[i % 4], ...C(fu + vx * sk * 22, -2 + vy * sk * 22 + sk * sk * 34), s, s); }
      for (let i = 0; i < 40; i++) { const an = (i / 40) * Math.PI * 2; dot(g, i % 4 ? GOO[1] : GOO[0], ...C(fu + Math.cos(an) * 24 * ease(sk), -1 + Math.sin(an) * 3 * ease(sk)), s, s); }
      g.globalAlpha = 1;
    }

    // The bite: NHAC!, a burst of goo where the tail tip comes off, and the tip spat out ahead to
    // bud on the floor.
    const [mu, mv] = onHead(7, -3), ck = (t - X_CHOMP) / 0.4;
    if (ck >= 0 && ck < 1) {
      const r = seeded(5);
      g.globalAlpha = 1 - ck;
      for (let i = 0; i < 6; i++) dot(g, GOO[i % 4], ...C(mu + (r() - 0.3) * 10 * ck, mv - r() * 8 * ck + ck * ck * 10), s, s);
      drawText(g, 'NHAC!', x + Math.round(mu + 2) * s, y + Math.round(mv - 10 - ck * 4) * s, { color: '#fff1d6', shadow: '#c4305a', align: 'center' });
      g.globalAlpha = 1;
    }
    if (t >= X_SPIT && t < X_TIP + 0.06) {
      const k = clamp01((t - X_SPIT) / (X_TIP - X_SPIT)), u = mu + (BROOD_AT.front - mu) * k, v = mv + (-2 - mv) * k - Math.sin(k * Math.PI) * 9, deg = k < 1 ? Math.round(k * 48) * 11.25 : 0;
      const tt = turn(TIP, [3, 2], deg, 'xoloTip');
      stamp(g, tt.rows, BITS_PAL, 'xoloTip' + deg, ...C(u - tt.piv[0], v - tt.piv[1]), s);
    }
    if (t >= X_TIP + 0.06 && t < X_HATCH) {
      const stage = Math.min(3, Math.floor((t - X_TIP - 0.06) / 0.085)), pulse = Math.floor(t * (5 + stage * 3)) % 2, m = BUD[stage][pulse];
      stamp(g, m, BITS_PAL, 'xoloBud' + stage + pulse, ...C(BROOD_AT.front - (m[0].length >> 1), 1 - m.length), s);
    }
    // Two drops flung off the gills: one back to the floor behind, one up and onto its head.
    for (const [t0, t1, gu, gv, to, hop] of [[X_FLING[0], X_BACK, -8, -8, null, 6], [X_FLING[1], X_RIDE, -6, -12, XTOP, 10]]) {
      if (t < t0 || t >= t1) continue;
      const k = (t - t0) / (t1 - t0), [pu, pv] = onHead(gu, gv), [eu, ev] = to ? onHead(...to) : [BROOD_AT.back, -1];
      stamp(g, DROP, BITS_PAL, 'xoloDrop', ...C(pu + (eu - pu) * k - 1, pv + (ev - pv) * k - Math.sin(k * Math.PI) * hop - 2), s);
    }
    // Hatching and each pop out of a drop: a plop of white and pink.
    for (const m of brood) {
      const t0 = { back: X_BACK, front: X_HATCH, head: X_RIDE }[m.who], k = (t - t0) / 0.3;
      if (k < 0 || k >= 1) continue;
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; dot(g, i % 2 ? GOO[0] : GOO[1], ...C(m.u + Math.cos(an) * (3 + k * 7), m.v - 2 + Math.sin(an) * (1.5 + k * 3)), s, s); }
      g.globalAlpha = 1;
    }

    // In the pose: bubbles now and then out of the gills, and the wet shine on its skull twinkling.
    if (lt >= 0) {
      const bt = lt % 3.1;
      for (let i = 0; i < 3; i++) {
        const k = (bt - i * 0.22) / 1.2;
        if (k < 0 || k >= 1) continue;
        const [gu, gv] = onHead(-9, -9), m = BUBBLETS[k < 0.4 ? 0 : 1];
        g.globalAlpha = 0.85 * (1 - k * k);
        stamp(g, m, FOAM, 'foam' + m.length, ...C(gu + Math.sin(k * 9 + i) * 1.5 - (m[0].length >> 1), gv - k * 26), s);
      }
      g.globalAlpha = 1;
      if (lt % 2.7 > 2.55) {
        const [hu, hv] = onHead(0, -8);
        glint(g, ...C(hu, hv), s);
      }
    }
    // All four look out at you: a glint in every eye.
    if (t >= X_LOOK && t < X_LOOK + 0.12) {
      glint(g, ...C(...onHead(XEYE[0] + 1, XEYE[1] - 1)), s);
      for (const m of brood) { const q = figurePoint(m.frame, 'head', MEYE[0] + 1, MEYE[1] - 1, 0, 0, 1, 1, MCH); glint(g, ...C(m.u + q.x, m.v + q.y), s); }
    }
    // The teaser and the flashes: a crackle of lightning round each burning clone; at the height of
    // the teaser, one bolt from the star forking down onto all three.
    const lit = brood.filter(m => m.flash >= 0);
    if (lit.length) {
      const seed = Math.floor(t * 60), [su, sv] = [5, -DEEP - 9];
      if (tease === 1 || (tease < 0 && flashing === 1)) {
        const [ku, kv] = [Math.round(lit.reduce((n, m) => n + m.u, 0) / lit.length), -34];
        bolt(g, x, y, su, sv + 6, ku, kv, seed, s);
        for (const m of lit) bolt(g, x, y, ku, kv, m.u, m.v - 9, seed + m.u * 7, s, 0.9);
      }
      for (const m of lit) {
        // The eyes flare like embers.
        if (m.form === 'mini') {
          const q = figurePoint(m.frame, 'head', MEYE[0], MEYE[1] + 1, 0, 0, 1, 1, MCH), [ex, ey] = C(m.u + q.x, m.v + q.y);
          g.globalAlpha = 0.7;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(g, '#ff5a1a', ex + dx * s, ey + dy * s, s, s);
          g.globalAlpha = 1;
          dot(g, '#fff6a0', ex, ey, s, s);
        }
        if (m.flash === 2) continue;
        const r = seeded(seed * 3 + m.u + 50), an = r() * Math.PI * 2, u0 = m.u + Math.cos(an) * 7, v0 = m.v - 6 + Math.sin(an) * 5;
        bolt(g, x, y, Math.round(u0), Math.round(v0), Math.round(u0 + Math.cos(an + 1.2) * 5), Math.round(v0 + Math.sin(an + 1.2) * 5), seed + m.u, s, 0.9);
      }
    }
  }
}
