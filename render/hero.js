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
import { slotPoint, castFor } from './pixel-data.js';
import { RAGE_COLORS } from './hud.js';
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
