// Lola's entrance on the character select screen, played from the moment she is picked:
//   0.00  a clock face swells up behind the pedestal, its hands racing; a ring of the clock closes in
//         on the pedestal and she steps out of it in a white flash, as if she had always been there;
//   0.55  she flicks her wrists and knives fan out of nowhere into a ring around her;
//   1.30  the hero pose, looping: knives fanned in both hands, the ring of knives wheeling round her,
//         the clock ticking second by second behind her, and every few seconds she clicks her watch:
//         the clock's hands stop, the colors drain from it, and the wheel of knives hangs dead still
//         for a beat before time runs again.
// Everything is drawn on the UI canvas at the menu's pixel density.
import { FRAMES } from './anim.js';
import { figureSprite, drawFigure, tintOf } from './fighter-art.js';
import { drawKnife, handKnives } from './lola-art.js';

const T_FLASH = 0.42, T_KNIVES = 0.55, T_POSE = 1.3, LOOP = 4.6, STOP = [3.4, 4.1];
const dot = (g, c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const ease = t => 1 - (1 - t) * (1 - t);
const clamp01 = v => Math.max(0, Math.min(1, v));

// The clock face behind her: a dark dial with a gold rim, twelve ticks (the quarters longer),
// and three hands. gray: how far the color has drained out of it.
function clock(g, cx, cy, R, hands, gray, t) {
  const rim = gray ? '#a8a8b8' : '#e0b040', rimDark = gray ? '#5a5a6a' : '#8a6420', dial = gray ? '#2a2a34' : '#18204a', dial2 = gray ? '#32323e' : '#202a5c';
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x, y);
    if (d > R + 0.5) continue;
    dot(g, d > R - 1.5 ? (x + y < 0 ? rim : rimDark) : d > R - 3 ? '#0c1028' : (x * 3 + y * 7) % 11 === 0 ? dial2 : dial, cx + x, cy + y);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2, L = i % 3 === 0 ? 5 : 3;
    for (let d = 0; d < L; d++) dot(g, i % 3 === 0 ? (gray ? '#d0d0dc' : '#ffd860') : gray ? '#7a7a88' : '#a08850', cx + Math.cos(a) * (R - 4 - d), cy + Math.sin(a) * (R - 4 - d), 2, 2);
  }
  const hand = (a, L, w, c) => { for (let d = 0; d < L; d++) dot(g, c, cx + Math.cos(a) * d - w / 2, cy + Math.sin(a) * d - w / 2, w, w); };
  hand(hands.h, R * 0.45, 3, gray ? '#c0c0cc' : '#ffd23a');
  hand(hands.m, R * 0.7, 2, gray ? '#d8d8e4' : '#ffe8a0');
  hand(hands.s, R * 0.82, 1, gray ? '#ffffff' : '#ff5a6e');
  dot(g, gray ? '#ffffff' : '#ffd23a', cx - 2, cy - 2, 4, 4);
}

export class LolaHero {
  constructor(renderer) { this.r = renderer; }

  draw(g, x, y, t, { density: s = 2, dt = 1 / 60 } = {}) {
    // The clock is a halo behind her head and bow; the wheel of knives turns round her waist.
    const cx = x, cy = y - 30 * s, R = 22 * s, wy = y - 15 * s;
    const lt = t - T_POSE, cyc = lt > 0 ? lt % LOOP : -1, stopped = cyc >= STOP[0] && cyc < STOP[1];
    // The world's own time: it stands still while she holds it, then runs on from there.
    const held = STOP[1] - STOP[0];
    const wt = lt > 0 ? T_POSE + Math.floor(lt / LOOP) * (LOOP - held) + Math.min(cyc, STOP[0]) + Math.max(0, cyc - STOP[1]) : t;
    // The clock: swelling in with its hands racing, then ticking second by second (a little
    // overshoot on every tick), and stopped dead while she holds the time.
    const grow = ease(clamp01(t / 0.4));
    let sec;
    if (t < T_FLASH) sec = -t * 220;
    else {
      const tt = stopped ? Math.floor(wt) + 0.99 : wt;
      const f = tt % 1;
      sec = Math.floor(tt) + (f < 0.12 ? Math.sin((f / 0.12) * Math.PI) * 0.15 : 0);
    }
    const hands = { s: -Math.PI / 2 + (sec * Math.PI * 2) / 60, m: -Math.PI / 2 + (t < T_FLASH ? sec / 8 : 1.1), h: -Math.PI / 2 + (t < T_FLASH ? sec / 60 : -0.9) };
    if (grow > 0.02) clock(g, cx, cy, Math.max(2, Math.round(R * grow)), hands, stopped, t);

    // The ring of the clock closing in on the pedestal, and the flash she steps out of.
    if (t < T_FLASH + 0.1) {
      const k = clamp01(t / T_FLASH), r = (1 - ease(k)) * 46 * s + 6;
      g.globalAlpha = 0.4 + k * 0.6;
      for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; if (i % 2) dot(g, '#9cd0ff', x + Math.cos(a) * r, wy + Math.sin(a) * r * 0.9, s, s); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; dot(g, '#ffffff', x + Math.cos(a) * r, wy + Math.sin(a) * r * 0.9, s * 2, s * 2); }
      g.globalAlpha = 1;
    }
    if (t < T_FLASH - 0.04) return;

    // Her pose for this moment.
    const name = t < T_KNIVES ? 'lSkA' : t < T_POSE ? (t < T_KNIVES + 0.25 ? 'lCaX' : 'lHero') : stopped && cyc < STOP[0] + 0.3 ? 'wWatch' : Math.floor(lt * 1.4) % 2 ? 'lHero2' : 'lHero';
    const frame = FRAMES[name];
    const a = this.actor ||= { id: 970, type: 2, face: 1, ground: true, vx: 0, vy: 0, attack: 0, act: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0 };
    a.act = name === 'wWatch' ? 'world' : null; a.actT = 0.1; a.wPose = 'click';
    const f = { frame, expr: name === 'wWatch' ? 'Blink' : t < T_POSE ? 'Angry' : '', name };
    const chains = this.r.secondaryFor('heroLola').update(a, frame, t, dt);
    const { s: sp, overlay } = figureSprite(a, f, '', chains);

    // The wheel of knives: fanned out of her hands, then wheeling round her, frozen while she
    // holds the time (and frozen ones glint).
    const wheel = clamp01((t - T_KNIVES) / 0.5);
    if (wheel > 0) {
      const spinT = wt;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 + spinT * 1.3, r = (9 + 18 * ease(wheel)) * s;
        const kx = x + Math.cos(a0) * r, ky = wy + Math.sin(a0) * r * 0.55;
        // Behind her on the far half of the wheel.
        if (Math.sin(a0) < 0) drawKnife(g, kx, ky, a0 + Math.PI / 2, { s, len: 7, glint: stopped ? ((t * 2 + i * 0.3) % 2) : 0 });
      }
    }
    // A white flash as she appears, then color, with a cold rim of light.
    const ft = t - (T_FLASH - 0.04);
    handKnives(g, a, f, x, y, 1, s, t, 'back');
    const rim = tintOf(sp, '#9cd0ff');
    for (const [ox, oy] of [[-s, 0], [s, 0], [0, -s]]) drawFigure(g, rim, x + ox, y + oy, 1, s);
    if (overlay) drawFigure(g, overlay, x, y, 1, s);
    drawFigure(g, ft < 0.12 ? tintOf(sp, '#ffffff') : sp, x, y, 1, s);
    handKnives(g, a, f, x, y, 1, s, t, 'front');
    if (wheel > 0) {
      const spinT = wt;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 + spinT * 1.3, r = (9 + 18 * ease(wheel)) * s;
        const kx = x + Math.cos(a0) * r, ky = wy + Math.sin(a0) * r * 0.55;
        if (Math.sin(a0) >= 0) drawKnife(g, kx, ky, a0 + Math.PI / 2, { s, len: 7, glint: stopped ? ((t * 2 + i * 0.3) % 2) : 0 });
      }
    }
    // Clicking the watch: a gray pulse spreads from her and the caption ticks.
    if (stopped) {
      const k = (cyc - STOP[0]) / (STOP[1] - STOP[0]);
      g.globalAlpha = 0.5 * (1 - k);
      for (let i = 0; i < 80; i++) { const an = (i / 80) * Math.PI * 2, rr = 10 + k * 60 * s; dot(g, '#ffffff', x + Math.cos(an) * rr, wy + Math.sin(an) * rr * 0.8, s, s); }
      g.globalAlpha = 1;
    }
  }
}
