// The Cat King's entrance on the character select screen, played from the moment he is picked:
//   0.00  the throne room wakes: a warm gold glow swells behind the pedestal and two royal banners
//         unroll from the dark, little gold notes of a fanfare rising off them;
//   0.15  a shaft of gold light falls on the pedestal and the King appears in it, kneeling, in a
//         white flash; his court comes in: the archer running from the left, the soldier leaping
//         over the King from behind him, the shield cat marching in from the right, the mage
//         floating down from above, the assassin out of a puff of smoke;
//   0.70  he rises and sweeps his cape out behind him;
//   1.05  he raises the scepter: a burst of golden rays from the orb, and the court takes its
//         battle positions (shield kneeling in front with the shield planted, soldier sword up,
//         archer with the bow drawn, assassin crouched with the daggers out, mage casting a glowing
//         sigil above them all);
//   1.50  the hero pose, looping: the scepter held high and burning softly, the cape stirring, the
//         crown's jewels twinkling, gold motes rising, little breaths and blinks; every few seconds
//         he points the scepter at the rivals and the court answers, each hopping in turn.
// The court is drawn with court-art.js (drawFamiliar / drawFamiliarGlow / HERO_POSE); the King with
// his figure sprite and king-art.js's regalia. The group spills right of the slot (to about x+90 at
// density 2), toward the empty space before the next fighter.
// Everything is drawn on the UI canvas at the menu's pixel density.
import { figureSprite, drawFigure, tintOf } from './fighter-art.js';
import { castFor } from './pixel-data.js';
import { bayer } from '../engine/const.js';
import { drawKingRegalia, bodyMask, scepterOrb } from './king-art.js';
import * as Court from './court-art.js';

const T_SHAFT = 0.15, T_APPEAR = 0.32, T_RISE = 0.7, T_RAISE = 1.05, T_POSE = 1.5, LOOP = 4.8, ORDER = 3.3;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = u => 1 - (1 - u) * (1 - u);
const easeOut3 = u => 1 - (1 - u) * (1 - u) * (1 - u);
const lerp = (a, b, u) => a + (b - a) * u;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// His frames for the entrance (slot offsets as in anim.js): kneeling as he appears, the sweep of the
// cape with the scepter arm thrown forward, the scepter raised (two breaths), and the order.
const F = {
  kneel: { head: [1, 3, 11.25], body: [0, 2], armF: [1, 1, -40], armB: [0, 2, 10], footF: [3, 0], footB: [-2, 0] },
  rise: { head: [1, 1], body: [0, 1], armF: [2, 0, -70], armB: [-1, 0, 30], footF: [3, 0], footB: [-3, 0] },
  sweep: { head: [1, 0, -11.25], body: [0, 0], armF: [3, -1, -100], armB: [-3, -1, 120], footF: [3, 0], footB: [-3, 0] },
  up: { head: [1, -1, -11.25], body: [0, -1], armF: [3, -4, -157.5], armB: [-1, 0, 25], footF: [3, 0], footB: [-3, 0] },
  up2: { head: [1, 0, -11.25], body: [0, 0], armF: [3, -3, -157.5], armB: [-1, 1, 25], footF: [3, 0], footB: [-3, 0] },
  point: { head: [2, 0], body: [1, 0], armF: [4, -4, -135], armB: [-2, 0, 40], footF: [4, 0], footB: [-3, 0] }
};

// Where each of the court stands in the pose (feet, in density cells from the King's feet), where
// it comes from, and when it arrives. Behind him: the archer, the soldier and the mage (floating);
// in front: the shield and the assassin.
const COURT = [
  { k: 'archer', at: [-25, 0], from: [-66, 0], t0: 0.2, t1: 0.85, how: 'run', behind: true },
  { k: 'mage', at: [-18, -21], from: [-18, -84], t0: 0.3, t1: 1.0, how: 'float', behind: true },
  { k: 'soldier', at: [27, 0], from: [-58, 0], t0: 0.12, t1: 0.82, how: 'leap', behind: false },
  { k: 'assassin', at: [39, 1], from: [39, 1], t0: 0.72, t1: 0.8, how: 'blink', behind: false },
  { k: 'shield', at: [14, 0], from: [54, 0], t0: 0.18, t1: 0.95, how: 'walk', behind: false }
];

// ---- the throne room: cached at one cell per pixel, drawn at the menu's density -----------------
const cache = new Map();
function cached(key, w, h, paint) {
  let c = cache.get(key);
  if (!c) { c = mk(w, h); paint(c.getContext('2d'), w, h); cache.set(key, c); }
  return c;
}
// A warm glow behind him: dithered rings of gold, brightest at his chest.
function glowCanvas() {
  return cached('glow', 72, 64, (g, w, h) => {
    const cols = ['#2a1a20', '#3e2622', '#5a3a22', '#7a5428'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - w / 2 + 0.5) / (w / 2), (y - h * 0.55) / (h * 0.55));
      const v = 1 - d + (bayer(x, y) - 0.5) * 0.28;
      if (v <= 0.05) continue;
      g.fillStyle = cols[Math.min(3, Math.floor(v * 4.2))];
      g.fillRect(x, y, 1, 1);
    }
  });
}
// The shaft of light that falls on the pedestal.
function shaftCanvas() {
  return cached('shaft', 24, 80, (g, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const half = 4 + (y / h) * 8, d = Math.abs(x - w / 2 + 0.5) / half;
      const v = 1 - d + (bayer(x, y) - 0.5) * 0.5;
      if (v <= 0) continue;
      g.fillStyle = v > 0.75 ? '#fff6c8' : v > 0.4 ? '#ffd76a' : '#a8701e';
      g.fillRect(x, y, 1, 1);
    }
  });
}
// A royal banner: a gold rod with finials, crimson cloth with a gold border, the crest (a crown over
// a fleur) and a swallowtail.
const BANNER_W = 11, BANNER_H = 34;
function bannerCanvas() {
  return cached('banner', BANNER_W, BANNER_H, (g, w, h) => {
    const P = { o: '#1c0a14', Y: '#fff2a8', G: '#f8c84a', g: '#cc8a2a', d: '#86501e', 1: '#5c0c22', 2: '#941a30', 3: '#c42e3e', 4: '#e05050' };
    const put = (c, x, y) => { g.fillStyle = P[c]; g.fillRect(x, y, 1, 1); };
    // The rod.
    for (let x = 0; x < w; x++) put(x === 0 || x === w - 1 ? 'Y' : x % 2 ? 'G' : 'g', x, 0);
    for (let x = 0; x < w; x++) put('o', x, 1);
    put('Y', 0, 1); put('Y', w - 1, 1);
    const crest = [
      '..G.G.G..',
      '..GGGGG..',
      '..gGGGg..',
      '.........',
      '....Y....',
      '...GGG...',
      '..G.G.G..',
      '....g....'
    ];
    for (let y = 2; y < h; y++) {
      const tail = h - y, notch = tail <= 5 ? 5 - tail : -1; // swallowtail: a notch cut up the middle
      for (let x = 1; x < w - 1; x++) {
        const mid = Math.abs(x - (w - 1) / 2);
        if (notch >= 0 && mid <= notch * 0.8) continue;
        const edge = x === 1 || x === w - 2 || y === 2 || (notch >= 0 && mid <= notch * 0.8 + 1);
        let c = edge ? (x === 1 || y === 2 ? 'G' : 'g') : x < 3 ? '4' : x > w - 4 ? '2' : '3';
        if (!edge && (x + y) % 5 === 0 && x > 2 && x < w - 3) c = '2';
        const cy = y - 9, cx = x - 1;
        if (cy >= 0 && cy < crest.length && crest[cy][cx] && crest[cy][cx] !== '.') c = crest[cy][cx];
        put(c, x, y);
      }
    }
  });
}
function drawBanner(g, x, y, s, unroll, t, seed) {
  const c = bannerCanvas(), rows = Math.round(BANNER_H * unroll);
  for (let r = 0; r < rows; r++) {
    // The cloth sways more toward its foot; while it unrolls the foot flaps.
    const depth = r / BANNER_H, flap = unroll < 1 && r > rows - 4 ? Math.sin(t * 30 + r) * 1 : 0;
    const dx = Math.round(Math.sin(t * 1.7 + seed + r * 0.18) * depth * 1.4 + flap);
    g.drawImage(c, 0, r, BANNER_W, 1, x + (dx - Math.floor(BANNER_W / 2)) * s, y + r * s, BANNER_W * s, s);
  }
  // The roll still wound at its foot.
  if (unroll < 1 && rows > 1) {
    g.fillStyle = '#5c0c22'; g.fillRect(x - 4 * s, y + rows * s, 9 * s, 2 * s);
    g.fillStyle = '#f8c84a'; g.fillRect(x - 5 * s, y + rows * s, s, 2 * s); g.fillRect(x + 5 * s, y + rows * s, s, 2 * s);
  }
}

// A note of the fanfare (a quaver), rising.
function note(g, x, y, s, c) {
  g.fillStyle = c;
  g.fillRect(x, y + 2 * s, 2 * s, s); g.fillRect(x + s, y - s, s, 3 * s); g.fillRect(x + 2 * s, y - s, s, s);
}
// A puff of the assassin's smoke.
function smoke(g, x, y, s, k, seed) {
  for (let i = 0; i < 9; i++) {
    const a = seed + i * 2.4, r = (2 + k * 9 + (i % 3)) * s, R = Math.max(1, Math.round((3 - k * 2.4) - (i % 2))) * s;
    g.globalAlpha = (1 - k) * 0.9;
    g.fillStyle = i % 3 ? '#2a2038' : '#4a3a5e';
    g.fillRect(Math.round(x + Math.cos(a) * r - R / 2), Math.round(y + Math.sin(a) * r * 0.7 - R / 2 - k * 4 * s), R, R);
  }
  g.globalAlpha = 1;
}

export class KingHero {
  constructor(renderer) { this.r = renderer; }

  draw(g, x, y, t, { density: s = 2, dt = 1 / 60 } = {}) {
    const prevOp = g.globalCompositeOperation, prevA = g.globalAlpha;
    const lt = t - T_POSE, cyc = lt > 0 ? lt % LOOP : -1;
    // The order in the loop: the scepter comes down to point at the rivals and back up.
    const ord = cyc >= ORDER ? (cyc - ORDER) / 0.9 : -1;

    // ---- the throne room: the glow, the banners, the fanfare
    const wake = ease(clamp01(t / 0.45));
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = wake * (0.85 + 0.15 * Math.sin(t * 2.2)) * (t > T_RAISE && t < T_RAISE + 0.4 ? 1.25 : 1);
    const gc = glowCanvas();
    g.drawImage(gc, x - (gc.width / 2) * s, y - 54 * s, gc.width * s, gc.height * s);
    g.globalAlpha = 1;
    g.globalCompositeOperation = prevOp;
    const unroll = easeOut3(clamp01((t - 0.05) / 0.5));
    if (unroll > 0) {
      drawBanner(g, x - 27 * s, y - 66 * s, s, unroll, t, 0);
      drawBanner(g, x + 27 * s, y - 66 * s, s, unroll, t, 1.7);
    }
    if (t < 1.6) {
      for (let i = 0; i < 6; i++) {
        const k = (t - 0.15 - i * 0.12) / 0.9;
        if (k <= 0 || k >= 1) continue;
        const side = i % 2 ? 1 : -1, nx = x + side * (27 + Math.sin(k * 9 + i) * 3) * s, ny = y - (68 + k * 22) * s;
        g.globalAlpha = 1 - k * k;
        note(g, Math.round(nx), Math.round(ny), s, i % 3 ? '#ffd76a' : '#fff2a8');
      }
      g.globalAlpha = 1;
    }

    // Motes of gold drifting up through the glow once he holds court.
    if (t > T_RAISE) {
      g.globalCompositeOperation = 'lighter';
      const fade = clamp01((t - T_RAISE) / 0.6);
      for (let i = 0; i < 9; i++) {
        const k = (t * (0.16 + (i % 4) * 0.03) + i * 0.37) % 1;
        const mx = x + (((i * 23) % 56) - 28 + Math.sin(t * 1.3 + i * 2) * 2) * s, my = y - (4 + k * 70) * s;
        g.globalAlpha = fade * Math.sin(k * Math.PI) * 0.8;
        g.fillStyle = i % 3 ? '#a87a2a' : '#ffd76a';
        g.fillRect(Math.round(mx / s) * s, Math.round(my / s) * s, s, s);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = prevOp;
    }

    // ---- the shaft of light he appears in
    if (t > T_SHAFT && t < T_RISE + 0.4) {
      const k = clamp01((t - T_SHAFT) / 0.17), out = clamp01((t - T_RISE) / 0.4), sc = shaftCanvas();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (1 - out) * 0.9;
      const hh = Math.round(sc.height * k);
      g.drawImage(sc, 0, 0, sc.width, hh, x - (sc.width / 2) * s, y - sc.height * s + (sc.height - hh) * 0, sc.width * s, hh * s);
      g.globalAlpha = 1;
      g.globalCompositeOperation = prevOp;
    }

    // ---- the court behind him
    const court = this.courtAt(t, cyc, ord, s);
    for (const c of court) if (c.behind) this.drawMember(g, c, x, y, s, t);

    // ---- the King
    const glow = t >= T_APPEAR ? this.drawKing(g, x, y, t, s, dt, cyc, ord) : null;

    // ---- the court in front of him
    for (const c of court) if (!c.behind) this.drawMember(g, c, x, y, s, t);
    for (const c of court) if (c.smoke >= 0 && c.smoke < 1) smoke(g, x + c.at[0] * s, y - 7 * s, s, c.smoke, 1.3);
    // His light over everything: the orb's star, the sparks, the burst of rays.
    if (glow) glow();

    g.globalCompositeOperation = prevOp;
    g.globalAlpha = prevA;
  }

  // Where each familiar is and how it stands at time t.
  courtAt(t, cyc, ord, s) {
    return COURT.map((m, i) => {
      const o = { k: m.k, behind: m.behind, at: m.at, x: m.at[0], y: m.at[1], pose: Court.HERO_POSE?.[m.k] || 'idle', pt: t, show: true, smoke: -1, f: 1 };
      if (t < m.t0) { o.show = false; return o; }
      const u = clamp01((t - m.t0) / (m.t1 - m.t0));
      if (m.how === 'run' || m.how === 'walk') {
        o.x = lerp(m.from[0], m.at[0], m.how === 'walk' ? u : ease(u)); o.y = m.at[1];
        if (u < 1) { o.pose = m.how; o.f = Math.sign(m.at[0] - m.from[0]) || 1; }
        // The shield cat plants its shield: a little drop as it kneels.
        if (m.how === 'walk' && u >= 1 && t < m.t1 + 0.12) o.y = m.at[1] - 2 * (1 - (t - m.t1) / 0.12);
      } else if (m.how === 'leap') {
        // Over the King in one bound, landing in front of him.
        o.x = lerp(m.from[0], m.at[0], u); o.y = m.at[1] - Math.sin(u * Math.PI) * 34;
        if (u < 1) o.pose = u < 0.5 ? 'jump' : 'fall';
        if (u >= 1 && t < m.t1 + 0.1) o.y = m.at[1];
      } else if (m.how === 'float') {
        o.x = m.at[0] + Math.sin(u * 5) * 4 * (1 - u); o.y = lerp(m.from[1], m.at[1], easeOut3(u));
        if (u < 1) o.pose = 'idle';
      } else if (m.how === 'blink') {
        o.smoke = (t - m.t0) / 0.45;
        o.show = t >= m.t0 + 0.06;
      }
      // In the loop the court answers his order, one after another, with a hop.
      if (ord >= 0) {
        const h = (ord - 0.25 - i * 0.08) / 0.22;
        if (h > 0 && h < 1) o.y -= Math.sin(h * Math.PI) * 3;
      }
      // The mage bobs as he floats.
      if (m.k === 'mage') o.y += Math.round(Math.sin(t * 2.4) * 1.2);
      return o;
    });
  }

  drawMember(g, c, x, y, s, t) {
    if (!c.show || !Court.drawFamiliar) return;
    const fx = Math.round(x + c.x * s), fy = Math.round(y + c.y * s);
    const o = { f: c.f, scale: s, pose: c.pose, t, p: 0.5 };
    Court.drawFamiliar(g, c.k, fx, fy, o);
    if (Court.drawFamiliarGlow) {
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      Court.drawFamiliarGlow(g, c.k, fx, fy, o);
      g.globalCompositeOperation = op;
    }
  }

  // The King: his frame and the pose of his regalia for this moment.
  drawKing(g, x, y, t, s, dt, cyc, ord) {
    let name, expr = '', W = 3, L = 0.5, glow = 0.35, beat = 0, smear = null, ang;
    const at = t - T_APPEAR;
    if (t < T_RISE) { name = 'kneel'; expr = 'Blink'; W = 1; L = 0; glow = 0; }
    else if (t < T_RAISE) {
      const k = (t - T_RISE) / (T_RAISE - T_RISE);
      name = k < 0.25 ? 'rise' : 'sweep'; expr = k < 0.25 ? '' : 'Open';
      // The sweep: the cape flung wide behind him, settling with an overshoot.
      W = k < 0.25 ? 4 : 13 - 8 * ease((k - 0.25) / 0.75); L = k < 0.25 ? 1 : 5 - 4 * ease((k - 0.25) / 0.75);
      glow = 0;
    } else {
      const k = clamp01((t - T_RAISE) / 0.25);
      name = Math.floor((t - T_RAISE) * 1.3) % 2 ? 'up2' : 'up';
      W = 9 - 2.5 * k + Math.sin(t * 1.4) * 1.4; L = 2.4 - 0.8 * k + Math.sin(t * 2.3) * 0.7;
      glow = t < T_POSE ? 1 - 0.6 * clamp01((t - T_RAISE - 0.2) / 0.25) : 0.4 + 0.12 * Math.sin(t * 3);
      beat = t < T_RAISE + 0.35 ? 1 - (t - T_RAISE) / 0.35 : 0;
      if (t < T_RAISE + 0.08) smear = { from: 85, to: 22 };
      if (ord >= 0 && ord < 1) {
        // The order: down to point at them (a star on the beat), held, and back up.
        if (ord < 0.55) { name = 'point'; expr = 'Open'; beat = clamp01(1 - Math.abs(ord - 0.12) / 0.12); glow = 0.25; W = 6; L = 1.2; if (ord < 0.08) smear = { from: 22, to: 45 }; }
        else if (ord < 0.62) smear = { from: 45, to: 22 };
      }
      // A blink now and then.
      if (cyc >= 0 && cyc % 2.4 > 2.28 && name !== 'point') expr = 'Blink';
    }
    const frame = F[name], a = this.actor ||= { id: 981, type: 0, face: 1, ground: true, vx: 0, vy: 0, attack: 0, act: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0 };
    ang = 180 + (frame.armF?.[2] || 0);
    if (name === 'kneel') ang = 60;
    const f = { frame, expr, name };
    const chains = this.r.secondaryFor('heroKing').update(a, frame, t, dt);
    const { s: sp, overlay } = figureSprite(a, f, '', chains);
    const ch = castFor(0);
    const T = { bx: x, by: y, face: 1, q: 0, sc: s, ox: 0, oy: 0 };
    const P = { W, L, ang, reach: name === 'up' || name === 'up2' ? 2 : name === 'point' ? 2 : 0, beat, glow, smear, hurt: false };
    // A white flash as he appears, a gold rim of light round him from then on.
    const flash = at < 0.12;
    const mask = bodyMask(sp);
    if (overlay) drawFigure(g, flash ? tintOf(overlay, '#ffffff') : overlay, x, y, 1, s);
    if (!flash) drawKingRegalia(g, T, a, frame, P, t, 'back', { mask, ch, v: '' });
    const rim = tintOf(sp, at < 0.4 ? '#fff2a8' : '#c88a2a');
    g.globalAlpha = at < 0.4 ? 1 : 0.6;
    for (const [ox, oy] of [[-s, 0], [s, 0], [0, -s]]) drawFigure(g, rim, x + ox, y + oy, 1, s);
    g.globalAlpha = 1;
    drawFigure(g, flash ? tintOf(sp, '#ffffff') : sp, x, y, 1, s);
    if (flash) return null;
    drawKingRegalia(g, T, a, frame, P, t, 'front', { ch, v: '' });
    return () => this.drawKingGlow(g, T, a, frame, ch, P, t, s);
  }

  drawKingGlow(g, T, a, frame, ch, P, t, s) {
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    drawKingRegalia(g, T, a, frame, P, t, 'glow', { ch, v: '' });
    // The burst of golden rays as the scepter goes up.
    const rk = (t - T_RAISE) / 0.55;
    if (rk > 0 && rk < 1) {
      const [ox, oy] = scepterOrb(T, frame, ch, P);
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * Math.PI * 2 + 0.13, r0 = (3 + rk * 18) * s, r1 = r0 + (6 + (i % 2) * 6) * (1 - rk) * s;
        g.globalAlpha = 1 - rk;
        g.fillStyle = i % 2 ? '#ffd76a' : '#fff6c8';
        for (let r = r0; r < r1; r += s) g.fillRect(Math.round((ox + Math.cos(an) * r) / s) * s, Math.round((oy + Math.sin(an) * r) / s) * s, s, s);
      }
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = op;
  }
}
