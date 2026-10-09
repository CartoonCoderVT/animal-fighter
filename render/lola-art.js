// Lola's art, drawn by code on the 640x360 grid:
//  - her knives: a fan between the fingers of the guard hand, one in the other, swung along the
//    arms in every cut; thrown, hanging in stopped time, flying, and stuck in walls and floors;
//  - the time skip: the afterimage she leaves behind dissolving into the dark, the ring of a clock
//    face where she went and where she came out, the dotted trail between them;
//  - ZA WARUDO: the cut-in over the frozen frame (her face over a clock, the shout slammed in letter
//    by letter), the wave that turns the world to a negative and drains its color, the gray stopped
//    world with Lola and her knives the only things in color, the seconds counted, and the color
//    flooding back when time moves again.
// Everything is derived from observable state (acts, poses, snapshot fields) and simulation events,
// so remote peers draw the same thing.
import { VIEW_W, VIEW_H, S, seeded, BAYER4 } from '../engine/const.js';
import { drawText, measure } from '../engine/font.js';
import { figurePoint, drawFigure, tintOf, partSprite } from './fighter-art.js';
import { castFor } from './pixel-data.js';
import { MOVES, WORLD, WORLD_T, worldPhase } from '../sim/moves.js';

const X = v => v * S;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ease = k => 1 - (1 - k) * (1 - k);
const clamp01 = v => Math.max(0, Math.min(1, v));
export const STEEL = { spine: '#3c4566', mid: '#c4d2ea', edge: '#ffffff', tip: '#ffffff', guard: '#ffcf40', guardDark: '#c08a20', grip: '#2b2a5c', pommel: '#dfe8f6' };
const BLUE = { pale: '#d8ecff', light: '#9cd0ff', mid: '#5a9af0', deep: '#2a4ab8' };
// A knife she laid that has not flown yet (on its way out of her hand, or hanging).
const hangs = b => !!b.set && (b.k < 1 || b.hold > 0);

// ---- knives ------------------------------------------------------------------------------
// A throwing knife laid along ang from its pommel at (x, y): a pommel ring, the navy grip, a gold
// guard, a blade with a dark spine and a bright edge, and a white point. s: pixel density.
export function drawKnife(g, x, y, ang, { s = 1, len = 7, alpha = 1, glint = 0 } = {}) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const put = (i, j, col) => { g.fillStyle = col; g.fillRect(Math.round(x + (c * i - sn * j) * s), Math.round(y + (sn * i + c * j) * s), s, s); };
  g.globalAlpha = alpha;
  put(0, 0, STEEL.pommel);
  for (let i = 0.5; i < 2; i += 0.5) put(i, 0, STEEL.grip);
  put(2, -1, STEEL.guardDark); put(2, 0, STEEL.guard); put(2, 1, STEEL.guard);
  for (let i = 3; i < len - 1; i += 0.5) put(i, -1, STEEL.spine);
  for (let i = 2.5; i < len; i += 0.5) put(i, 0, STEEL.mid);
  for (let i = 3; i < len - 1.5; i += 0.5) put(i, 1, STEEL.edge);
  put(len, 0, STEEL.tip);
  // A glint running up the blade.
  if (glint > 0) { const i = 3 + (len - 3) * (glint % 1); put(i, 0, '#ffffff'); put(i, 1, '#ffffff'); }
  g.globalAlpha = 1;
}

// Her gold pocket watch, open: a gold case, a white face with a hand, the crown and a bit of chain.
export function drawWatch(g, x, y, s = 1, t = 0, open = true) {
  const p = (dx, dy, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), w * s, h * s); };
  p(-1, -3, '#ffcf40', 3, 1); p(0, -4, '#c08a20');
  p(-2, -2, '#c08a20', 5, 5); p(-1, -2, '#ffcf40', 3, 1); p(-2, -1, '#ffcf40', 1, 3);
  if (open) {
    p(-1, -1, '#fff8e8', 3, 3);
    const a = t * 6, hx = Math.round(Math.cos(a)), hy = Math.round(Math.sin(a));
    p(0, 0, '#1a1430'); p(hx, hy, '#5a4a78');
  } else p(-1, -1, '#ffe88a', 3, 3);
  p(2, 1, '#c08a20'); p(3, 2, '#ffcf40'); p(4, 2, '#c08a20');
}

// The hand at the tip of an arm and the direction the arm points, in canvas pixels.
function handOf(frame, slot, fx, fy, face, scale, ch) {
  const p = figurePoint(frame, slot, 0, 3, fx, fy, face, scale, ch);
  const r = ((frame[slot]?.[2] || 0) * Math.PI) / 180;
  return { x: p.x, y: p.y, ang: Math.atan2(Math.cos(r), -Math.sin(r) * face) };
}

const KNIFE_MOVES = new Set(['lCutA', 'lCutB', 'lDance', 'lBehind', 'lRise', 'lLow', 'lSkip', 'lAirCut', 'lAirSpin', 'lAirDive', 'lFan', 'lRain', 'lAirRing', 'dashAtk']);
// What a hand holds this frame: 'fan' (three knives between the fingers), 'one', 'watch' or nothing.
function holdOf(a, slot, frameName) {
  if (a.weapon || a.holding || a.act === 'carry') return null;
  if (a.act === 'world') {
    if (frameName === 'wWatch' || frameName === 'wSnap') return slot === 'armF' ? 'watch' : 'one';
    if (frameName === 'wHome') return 'one';
    const thrown = (a.wPose === 'throw' && slot === 'armF') || (a.wPose === 'throwB' && slot === 'armB');
    if (thrown && (a.wPoseT ?? 0) < 0.1) return null;
    return 'fan';
  }
  // Laying knives: fans drawn in both hands, then empty hands the instant they are thrown.
  if (frameName === 'lFanX' || frameName === 'lRainX') return null;
  if (frameName === 'lFanA') return 'fan';
  if (a.attack > 0 && KNIFE_MOVES.has(a.attackKind)) return 'one';
  if (frameName === 'lStance1' || frameName === 'lStance2' || frameName === 'lHero' || frameName === 'lHero2') return slot === 'armF' ? 'fan' : 'one';
  return 'one';
}

// Knives in Lola's hands for one layer: 'back' before her sprite (the far hand), 'front' after.
export function handKnives(g, a, f, fx, fy, face, scale, time, layer) {
  const frame = f.frame, severed = a.severed || [], ch = castFor(a.type, a.form);
  const slots = layer === 'back' ? (frame.front === 'armB' ? [] : ['armB']) : frame.front === 'armB' ? ['armF', 'armB'] : ['armF'];
  for (const slot of slots) {
    if (severed.includes(slot)) continue;
    const hold = holdOf(a, slot, f.name);
    if (!hold) continue;
    const h = handOf(frame, slot, fx, fy, face, scale, ch), c = Math.cos(h.ang), sn = Math.sin(h.ang);
    if (hold === 'watch') { drawWatch(g, h.x + c * 2 * scale, h.y + sn * 2 * scale, scale, time, a.wPose !== 'snap'); continue; }
    const glint = ((time * 0.9 + (slot === 'armB' ? 0.4 : 0) + (a.id || 0) * 0.17) % 2.2);
    if (hold === 'one') drawKnife(g, h.x + c * scale, h.y + sn * scale, h.ang, { s: scale, len: 6, glint: glint < 1 ? glint : 0 });
    else for (const d of [-0.45, 0, 0.45]) drawKnife(g, h.x + Math.cos(h.ang + d) * scale, h.y + Math.sin(h.ang + d) * scale, h.ang + d, { s: scale, len: 6, glint: d === 0 && glint < 1 ? glint : 0 });
  }
}

// One knife stuck in a fighter (super knives that stayed in): grip and guard out, blade in.
export function embeddedKnife(g, x, y, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const put = (i, col) => { g.fillStyle = col; g.fillRect(Math.round(x - c * i), Math.round(y - sn * i), 1, 1); };
  put(-1, STEEL.mid); put(0, STEEL.guard); put(1, STEEL.grip); put(2, STEEL.grip); put(3, STEEL.pommel);
}

// ---- dithered dissolve -------------------------------------------------------------------
// 17 masks of the 4x4 Bayer matrix, from nothing erased to everything erased.
const DITHER = Array.from({ length: 17 }, (_, n) => {
  const c = mk(4, 4), g = c.getContext('2d');
  g.fillStyle = '#000';
  for (let i = 0; i < 16; i++) if (BAYER4[i] < n / 16) g.fillRect(i % 4, Math.floor(i / 4), 1, 1);
  return c;
});

// ---- the effects of the skips and the knives ---------------------------------------------
export class LolaFX {
  constructor(renderer) {
    this.r = renderer;
    this.time = 0;
    this.scratch = mk(72, 64); this.sg = this.scratch.getContext('2d');
    this.lastFig = new Map();
    this.reset();
  }
  reset() {
    this.ghosts = []; this.rings = []; this.trails = []; this.stuck = []; this.sparks = []; this.flashes = new Map();
    this.pips = []; this.laid = new Map();
    this.resumeAt = -9; this.worldAt = -9; this.worldOwner = null;
  }

  // Remember how each fighter looked, so a skip can leave that sprite behind.
  remember(a, info, fx, fy) { this.lastFig.set(a.id, { s: info.sprite, o: info.overlay, face: a.face || 1, type: a.type }); }

  spark(x, y, n, colors, sp = 1.6, life = 0.3, a = null, spread = 6.3) {
    for (let i = 0; i < n; i++) {
      const an = a === null ? Math.random() * Math.PI * 2 : a + (Math.random() - 0.5) * spread, v = sp * (0.4 + Math.random() * 0.8);
      this.sparks.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: life * (0.6 + Math.random() * 0.6), max: life, c: colors[i % colors.length] });
    }
  }

  event(e) {
    const x = X(e.x ?? 0), y = X(e.y ?? 0);
    switch (e.fx) {
      case 'timeSkip': {
        const x2 = X(e.x2), y2 = X(e.y2);
        if (e.ghost) this.ghost(e.who, x, y);
        this.rings.push({ x, y: y - 6, t: 0, life: 0.24, out: true });
        this.rings.push({ x: x2, y: y2 - 6, t: 0, life: 0.2, out: false });
        if (Math.hypot(x2 - x, y2 - y) > 8) this.trails.push({ x, y: y - 6, x2, y2: y2 - 6, t: 0, life: 0.22 });
        this.flashes.set(e.who, this.time + 0.09);
        this.spark(x2, y2 - 6, 6, ['#ffffff', BLUE.light, BLUE.pale], 1.8, 0.28);
        break;
      }
      case 'skipOut':
        this.ghost(e.who, x, y);
        this.rings.push({ x, y: y - 6, t: 0, life: 0.24, out: true });
        this.spark(x, y - 6, 5, ['#ffffff', BLUE.light], 1.4, 0.25);
        break;
      case 'knifeFan': this.spark(x, y, 4, ['#ffffff', STEEL.edge, BLUE.light], 2.2, 0.18, e.a, 0.8); break;
      case 'knifeSet':
        // Knives leaving her hands to be laid in the air: a flick of steel and a tick of the clock.
        this.spark(x, y, 6, ['#ffffff', STEEL.edge, BLUE.light, BLUE.pale], 2.4, 0.2, e.k === 'rain' ? -Math.PI / 2 : null, e.k === 'rain' ? 1.4 : 6.3);
        this.rings.push({ x, y: y - 2, t: 0, life: 0.18, out: true });
        break;
      case 'knifeHit': this.spark(x, y, 5, ['#ffffff', STEEL.edge, '#ffe2a0'], 2.2, 0.22, (e.a ?? 0) + Math.PI, 1.6); break;
      case 'knifeStick':
        this.stuck.push({ x, y, a: e.a ?? 0, life: 4, max: 4 });
        if (this.stuck.length > 80) this.stuck.shift();
        this.spark(x, y, 3, ['#ffffff', '#ffe2a0'], 1.4, 0.2, (e.a ?? 0) + Math.PI, 1.2);
        break;
      case 'worldStart': this.worldAt = this.time; this.worldOwner = e.who; break;
      case 'worldEnd': this.resumeAt = this.time; this.resumeX = x; this.resumeY = y - 8; break;
    }
  }

  // Her laid knives, followed from frame to frame (live or snapshot): a little lock of light as
  // each one stops dead in its spot, a burst as it flies.
  watch(state) {
    const seen = new Set();
    for (const b of state.bullets || []) {
      if (b.kind !== 'knife' || !b.set) continue;
      seen.add(b.id);
      const phase = b.k < 1 ? 0 : b.hold > 0 ? 1 : 2, was = this.laid.get(b.id) ?? (phase === 2 ? 2 : 0);
      if (phase !== was) {
        const x = X(b.x), y = X(b.y), a = b.ang ?? Math.atan2(b.vy, b.vx);
        if (phase >= 1 && was < 1) this.pips.push({ x, y, a, t: 0, life: 0.16, kind: 'lock' });
        if (phase === 2) { this.pips.push({ x, y, a, t: 0, life: 0.12, kind: 'go' }); this.spark(x, y, 2, ['#ffffff', BLUE.pale], 1.6, 0.14, a + Math.PI, 1); }
      }
      this.laid.set(b.id, phase);
    }
    for (const id of this.laid.keys()) if (!seen.has(id)) this.laid.delete(id);
  }

  ghost(who, x, y) {
    const f = this.lastFig.get(who);
    if (f?.s) this.ghosts.push({ ...f, x, y: y + X(17), t: 0, life: 0.3 });
  }

  // White for a frame or two as she steps out of the skip.
  flashOf(id) { const u = this.flashes.get(id); return u && this.time < u ? (u - this.time > 0.05 ? '#ffffff' : '#cfe4ff') : null; }

  update(dt) {
    this.time += dt;
    for (const list of [this.ghosts, this.rings, this.trails, this.pips]) for (const e of list) e.t += dt;
    this.ghosts = this.ghosts.filter(e => e.t < e.life);
    this.rings = this.rings.filter(e => e.t < e.life);
    this.trails = this.trails.filter(e => e.t < e.life);
    this.pips = this.pips.filter(e => e.t < e.life);
    for (const s of this.stuck) s.life -= dt;
    this.stuck = this.stuck.filter(s => s.life > 0);
    for (const p of this.sparks) { p.life -= dt; p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy = p.vy * 0.9 + 0.04; }
    this.sparks = this.sparks.filter(p => p.life > 0);
  }

  // Knives in the lit play layer: stuck ones and the ones flying after time moves again.
  drawLit(g, state, ox, oy) {
    for (const s of this.stuck) {
      const fade = Math.min(1, s.life / 0.6);
      if (fade < 1 && Math.floor(s.life * 20) % 2) continue;
      // Only the back half shows: the point is in the wall.
      const c = Math.cos(s.a), sn = Math.sin(s.a);
      drawKnife(g, s.x + ox - c * 5, s.y + oy - sn * 5, s.a, { len: 4 });
    }
    for (const b of state.bullets || []) if (b.kind === 'knife') this.drawBulletKnife(g, b, ox, oy);
  }

  // A knife bullet, point at its position: flying along its velocity, or hanging where she laid it
  // along the line it will fly.
  drawBulletKnife(g, b, ox, oy) {
    const ang = hangs(b) ? b.ang : Math.atan2(b.vy, b.vx), x = X(b.x) + ox, y = X(b.y) + oy, c = Math.cos(ang), sn = Math.sin(ang);
    drawKnife(g, x - c * 7, y - sn * 7, ang, { len: 7 });
  }

  // Bright things over the lighting: afterimages, clock rings, trails, sparks, streaks of flying knives.
  drawEmissive(g, state, ox, oy) {
    for (const gh of this.ghosts) this.drawGhost(g, gh, ox, oy);
    for (const r of this.rings) this.drawRing(g, r, ox, oy);
    this.drawTrails(g, ox, oy);
    for (const p of this.sparks) {
      g.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      g.fillStyle = p.c;
      g.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), 1, 1);
    }
    g.globalAlpha = 1;
    this.drawPips(g, ox, oy);
    for (const b of state.bullets || []) {
      if (b.kind !== 'knife') continue;
      if (hangs(b)) { this.drawLaidGlow(g, b, ox, oy); continue; }
      const x = X(b.x) + ox, y = X(b.y) + oy, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
      for (let i = 8; i < 18; i++) { g.globalAlpha = 0.5 * (1 - (i - 8) / 10); g.fillStyle = i < 11 ? '#ffffff' : BLUE.light; g.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1); }
      g.globalAlpha = 1;
      g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  // A laid knife in its pocket of stopped time. On its way out of her hand, a white streak behind
  // it. Hanging, a cold pulse at the point; as it is about to fly, the line it will fly along is
  // drawn out ahead of it (the warning of a bullet hell), then a glint runs up the blade.
  drawLaidGlow(g, b, ox, oy) {
    const x = X(b.x) + ox, y = X(b.y) + oy;
    if (b.k < 1) {
      const px = X(b.px ?? b.x) + ox, py = X(b.py ?? b.y) + oy, d = Math.hypot(x - px, y - py);
      if (d < 1) return;
      const ux = (x - px) / d, uy = (y - py) / d;
      for (let i = 1; i < d + 4; i++) { g.globalAlpha = 0.7 * (1 - i / (d + 4)); g.fillStyle = i < 3 ? '#ffffff' : BLUE.light; g.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1); }
      g.globalAlpha = 1;
      return;
    }
    const c = Math.cos(b.ang), sn = Math.sin(b.ang), left = b.hold;
    if (left < 0.26) {
      const k = 1 - left / 0.26, L = Math.round(4 + ease(k) * 26);
      for (let i = 2; i < L; i += 2) {
        g.globalAlpha = 0.6 * k * (1 - i / (L + 6));
        g.fillStyle = (i + Math.floor(this.time * 30)) % 4 < 2 ? '#ffffff' : BLUE.light;
        g.fillRect(Math.round(x + c * i), Math.round(y + sn * i), 1, 1);
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 14 + (b.id || 0));
    g.globalAlpha = 0.35 + pulse * 0.4; g.fillStyle = BLUE.pale; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    g.globalAlpha = 0.25 * pulse; g.fillStyle = BLUE.light; g.fillRect(Math.round(x - c * 3 - sn), Math.round(y - sn * 3 + c), 1, 1); g.fillRect(Math.round(x - c * 3 + sn), Math.round(y - sn * 3 - c), 1, 1);
    if (left < 0.07) {
      const i = 2 + (1 - left / 0.07) * 5;
      g.globalAlpha = 1; g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x - c * (7 - i)), Math.round(y - sn * (7 - i)), 1, 1);
    }
    g.globalAlpha = 1;
  }

  // The lock of light as a laid knife stops (a tiny diamond closing on it), and the burst as it flies.
  drawPips(g, ox, oy) {
    for (const p of this.pips) {
      const k = p.t / p.life, x = p.x + ox, y = p.y + oy;
      if (p.kind === 'lock') {
        const R = Math.round(5 - ease(k) * 4);
        g.globalAlpha = 0.5 + k * 0.5; g.fillStyle = k < 0.5 ? '#ffffff' : BLUE.light;
        for (const [dx, dy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) g.fillRect(Math.round(x + dx), Math.round(y + dy), 1, 1);
      } else {
        const c = Math.cos(p.a), sn = Math.sin(p.a), R = 1 + ease(k) * 4;
        g.globalAlpha = 1 - k; g.fillStyle = '#ffffff';
        for (const s of [-1, 1]) g.fillRect(Math.round(x - c * 2 + -sn * R * s), Math.round(y - sn * 2 + c * R * s), 1, 1);
        g.fillRect(Math.round(x - c * (2 + R)), Math.round(y - sn * (2 + R)), 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  // The dotted line of a skip, from where she was to where she is, eaten from the start.
  drawTrails(g, ox, oy) {
    for (const tr of this.trails) {
      const k = tr.t / tr.life, n = Math.max(1, Math.round(Math.hypot(tr.x2 - tr.x, tr.y2 - tr.y) / 3));
      g.globalAlpha = 1 - k;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        if (u < k * 0.8) continue;
        g.fillStyle = i % 2 ? BLUE.light : '#ffffff';
        g.fillRect(Math.round(tr.x + (tr.x2 - tr.x) * u + ox), Math.round(tr.y + (tr.y2 - tr.y) * u + oy), 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  drawGhost(g, gh, ox, oy) {
    const k = gh.t / gh.life, sg = this.sg, W = 72, H = 64, FX = 36, FY = 50;
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, W, H);
    const tint = k < 0.12 ? '#ffffff' : '#7fb4ff';
    if (gh.o) drawFigure(sg, tintOf(gh.o, tint), FX, FY, gh.face);
    drawFigure(sg, tintOf(gh.s, tint), FX, FY, gh.face);
    // Dissolves from the bottom up, in a dither.
    sg.globalCompositeOperation = 'destination-out';
    const lvl = Math.min(16, Math.floor(k * 18));
    if (lvl > 0) { sg.fillStyle = sg.createPattern(DITHER[lvl], 'repeat'); sg.fillRect(0, 0, W, H); }
    const cut = Math.round(H - (H - 4) * Math.max(0, k - 0.3) / 0.7);
    if (cut < H) { sg.fillStyle = '#000'; sg.fillRect(0, cut, W, H - cut); }
    sg.globalCompositeOperation = 'source-over';
    g.globalAlpha = k < 0.12 ? 1 : 0.85;
    g.drawImage(this.scratch, Math.round(gh.x + ox - FX), Math.round(gh.y + oy - FY));
    g.globalAlpha = 1;
  }

  // The face of a clock: a ring of dots and twelve ticks, flung outward where she left and
  // closing in where she arrives.
  drawRing(g, r, ox, oy) {
    const k = r.t / r.life, e = ease(k), R = r.out ? 4 + e * 14 : 18 - e * 15;
    g.globalAlpha = r.out ? 1 - k : 0.4 + k * 0.6;
    const n = Math.max(12, Math.round(R * 4));
    g.fillStyle = BLUE.light;
    for (let i = 0; i < n; i += 2) { const a = (i / n) * Math.PI * 2; g.fillRect(Math.round(r.x + ox + Math.cos(a) * R), Math.round(r.y + oy + Math.sin(a) * R), 1, 1); }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), L = i % 3 === 0 ? 3 : 2;
      for (let d = 0; d < L; d++) g.fillRect(Math.round(r.x + ox + c * (R - d)), Math.round(r.y + oy + s * (R - d)), 1, 1);
    }
    // The hands sweep round once.
    const ha = -Math.PI / 2 + (r.out ? 1 : -1) * e * Math.PI * 2;
    for (let d = 0; d < R * 0.7; d++) g.fillRect(Math.round(r.x + ox + Math.cos(ha) * d), Math.round(r.y + oy + Math.sin(ha) * d), 1, 1);
    g.globalAlpha = 1;
  }

  // Knives stopped in the air (live game: g.knives; remote: the snapshot's knives).
  drawHanging(g, state, ox, oy) {
    const list = state.knives || [];
    for (const k of list) {
      const x = X(k.x) + ox, y = X(k.y) + oy, c = Math.cos(k.ang), sn = Math.sin(k.ang);
      // Still flying out of her hand: a streak behind it.
      if (k.k < 1) for (let i = 3; i < 9; i++) { g.globalAlpha = 0.6 * (1 - i / 9); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x - c * i), Math.round(y - sn * i), 1, 1); }
      g.globalAlpha = 1;
      const glint = (this.time * 0.7 + (k.id || 0) * 0.137) % 3;
      drawKnife(g, x - c * 7, y - sn * 7, k.ang, { len: 7, glint: glint < 1 ? glint : 0 });
    }
  }

  // ---- ZA WARUDO in the world layer ----------------------------------------------------
  // Called on the final scene canvas. Darkens the frozen frame during the cut-in, sweeps the
  // negative wave out from her, turns the stopped world gray and cool, then puts Lola, her knives
  // and her effects back on top in full color. After time moves again, the color floods back out
  // from her in a ring.
  worldPass(sg, state, figures, ox, oy) {
    const ts = state.timeStop;
    const since = this.time - this.resumeAt;
    if (!ts) {
      if (since < 0.4) {
        // The color returns: a white ring rushing out, negative inside its rim for a moment.
        const k = since / 0.4, R = 30 + ease(k) * 720, cx = this.resumeX + ox, cy = this.resumeY + oy;
        sg.save();
        ringPath(sg, cx, cy, R, Math.max(6, 60 * (1 - k)));
        sg.clip();
        sg.globalCompositeOperation = 'difference';
        sg.fillStyle = '#ffffff';
        sg.fillRect(0, 0, VIEW_W, VIEW_H);
        sg.restore();
        if (since < 0.08) { sg.fillStyle = `rgba(255,255,255,${0.8 * (1 - since / 0.08)})`; sg.fillRect(0, 0, VIEW_W, VIEW_H); }
      }
      return;
    }
    const t = ts.t, phase = worldPhase(t), owner = figures.find(f => f.a.id === ts.owner);
    const cx = X(ts.x) + ox, cy = X(ts.y) + oy - 8, maxR = Math.hypot(Math.max(cx, VIEW_W - cx), Math.max(cy, VIEW_H - cy)) + 10;
    if (phase === 'intro') {
      sg.fillStyle = `rgba(8,5,20,${Math.min(0.55, t * 2)})`;
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (phase === 'wave') {
      const k = (t - WORLD.intro) / WORLD.wave, R = ease(k) * maxR;
      sg.fillStyle = 'rgba(8,5,20,0.55)';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.save();
      circlePath(sg, cx, cy, R);
      sg.clip();
      sg.globalCompositeOperation = 'difference';
      sg.fillStyle = '#ffffff';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.globalCompositeOperation = 'saturation';
      sg.fillStyle = '#808080';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.globalCompositeOperation = 'multiply';
      sg.fillStyle = '#c8b8ff';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.restore();
      // The rim of the wave.
      sg.fillStyle = '#ffffff';
      const n = Math.round(R * 5);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; sg.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 2, 2); }
    } else {
      // The stopped world: no color, the blacks lifted to a cold haze.
      sg.globalCompositeOperation = 'saturation';
      sg.fillStyle = '#808080';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.globalCompositeOperation = 'screen';
      sg.fillStyle = '#34344e';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.globalCompositeOperation = 'multiply';
      sg.fillStyle = '#d2d4f4';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.globalCompositeOperation = 'source-over';
      // A last flash right before time moves again.
      const left = WORLD_T - t;
      if (left < 0.1) { sg.fillStyle = `rgba(255,255,255,${(1 - left / 0.1) * 0.7})`; sg.fillRect(0, 0, VIEW_W, VIEW_H); }
    }
    sg.globalCompositeOperation = 'source-over';
    // Lola and everything of hers, in color.
    if (phase !== 'intro' || t > 0) {
      this.drawHanging(sg, state, ox, oy);
      // Her knives in the air (laid ones still hanging, thrown ones caught mid-flight) stay in color.
      for (const b of state.bullets || []) if (b.kind === 'knife') { this.drawBulletKnife(sg, b, ox, oy); if (hangs(b)) this.drawLaidGlow(sg, b, ox, oy); }
      this.drawPips(sg, ox, oy);
      if (owner) {
        const s = owner.info.sprite, face = owner.a.face || 1;
        const rim = tintOf(s, phase === 'stop' || phase === 'outro' ? BLUE.light : '#ffe8a0');
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawFigure(sg, rim, owner.hx + ox + dx, owner.hy + oy + dy, face);
        sg.drawImage(owner.fc.body.c, owner.x, owner.y);
        // Her eye burns while she holds the world still.
        const eye = owner.info.eye;
        if (eye && !(owner.a.severed || []).includes('head')) {
          sg.fillStyle = '#ffffff'; sg.fillRect(Math.round(eye.x) + ox, Math.round(eye.y) + oy, 1, 1);
          sg.globalAlpha = 0.7; sg.fillStyle = '#ff5a6e'; sg.fillRect(Math.round(eye.x) + ox + face, Math.round(eye.y) + oy, 1, 1); sg.globalAlpha = 1;
        }
      }
      for (const gh of this.ghosts) this.drawGhost(sg, gh, ox, oy);
      for (const r of this.rings) this.drawRing(sg, r, ox, oy);
      this.drawTrails(sg, ox, oy);
      for (const p of this.sparks) { sg.fillStyle = p.c; sg.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), 1, 1); }
    }
  }

  // ---- ZA WARUDO on the interface layer (screen space, over the HUD) -----------------------
  drawOverlay(g, state) {
    const ts = state.timeStop;
    const since = this.time - this.resumeAt;
    // Letterbox bars: in with the cut-in, thinner through the stopped world, out after.
    let bar = 0;
    if (ts) bar = ts.t < WORLD.intro ? 30 * ease(clamp01(ts.t / 0.16)) : ts.t < WORLD.intro + 0.3 ? 30 - 12 * ease((ts.t - WORLD.intro) / 0.3) : 18;
    else if (since < 0.35) bar = 18 * (1 - ease(since / 0.35));
    if (bar > 0) { g.fillStyle = '#05030a'; g.fillRect(0, 0, VIEW_W, Math.round(bar)); g.fillRect(0, VIEW_H - Math.round(bar), VIEW_W, Math.round(bar)); }
    if (!ts) return;
    const t = ts.t, owner = state.actors.find(a => a.id === ts.owner);
    if (t < WORLD.intro) this.cutIn(g, t, owner);
    const st = t - WORLD.intro - WORLD.wave;
    // Counting the seconds of stopped time, as is tradition.
    if (st >= 0.6 && st < WORLD.stop + 0.1) {
      const n = Math.min(2, Math.floor((st - 0.6) / 0.8) + 1), k = ((st - 0.6) % 0.8) / 0.8;
      const label = n === 1 ? '1 SEGUNDO...' : '2 SEGUNDOS...';
      drawText(g, '◷ ' + label, VIEW_W / 2, VIEW_H - 34, { color: '#d8ecff', outline: '#0b0812', align: 'center', scale: 2, alpha: k < 0.15 ? k / 0.15 : 1 });
    }
    if (t >= WORLD.intro + WORLD.wave + WORLD.stop) {
      const k = (t - WORLD.intro - WORLD.wave - WORLD.stop) / WORLD.outro;
      drawText(g, 'TOKI WA UGOKIDASU', VIEW_W / 2, VIEW_H / 2 + 52, { color: '#ffffff', outline: '#0b0812', shadow: '#2a4ab8', scale: 3, align: 'center', alpha: clamp01(k * 4) });
      drawText(g, '(E O TEMPO VOLTA A ANDAR.)', VIEW_W / 2, VIEW_H / 2 + 84, { color: '#9cd0ff', outline: '#0b0812', align: 'center', alpha: clamp01(k * 4 - 1) });
    }
  }

  // The cut-in: a slanted band slides across the screen, Lola's face over a clock whose hands spin
  // and stop dead at twelve, and the shout slammed in letter by letter.
  cutIn(g, t, owner) {
    const T = WORLD.intro;
    // The frame goes white for an instant, then dim behind the band.
    g.fillStyle = `rgba(6,4,14,${Math.min(0.5, t * 3)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const inK = ease(clamp01(t / 0.2)), outK = clamp01((t - (T - 0.14)) / 0.14);
    const slide = (1 - inK) * VIEW_W - ease(outK) * VIEW_W * 1.2;
    const y0 = 96, h = 150, lean = 46;
    g.save();
    g.translate(Math.round(slide), 0);
    // The band.
    g.beginPath();
    g.moveTo(-60, y0 + lean); g.lineTo(VIEW_W + 60, y0); g.lineTo(VIEW_W + 60, y0 + h); g.lineTo(-60, y0 + h + lean); g.closePath();
    g.fillStyle = '#10163e';
    g.fill();
    g.save();
    g.clip();
    // Speed lines rushing left.
    const rnd = seeded(77);
    for (let i = 0; i < 40; i++) {
      const yy = y0 + rnd() * (h + lean), len = 30 + rnd() * 120, x = ((rnd() * VIEW_W * 2 - t * 900 * (0.6 + rnd())) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100;
      g.fillStyle = i % 3 ? '#1e2a6a' : '#2f448e';
      g.fillRect(Math.round(x), Math.round(yy), Math.round(len), 1);
    }
    // The clock behind her face.
    const cx = 168, cy = y0 + 92, R = 76;
    const spin = t < 0.62 ? -t * 40 : -0.62 * 40;
    const stopK = t < 0.62 ? 0 : 1;
    g.fillStyle = '#1a2458';
    for (let y = -R; y <= R; y++) { const w = Math.round(Math.sqrt(R * R - y * y)); g.fillRect(cx - w, cy + y, w * 2, 1); }
    g.fillStyle = '#c8a040';
    for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 2, 2); }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2, L = i % 3 === 0 ? 10 : 5;
      for (let d = 0; d < L; d++) { g.fillStyle = i % 3 === 0 ? '#ffd860' : '#8a7a50'; g.fillRect(Math.round(cx + Math.cos(a) * (R - 4 - d)), Math.round(cy + Math.sin(a) * (R - 4 - d)), 2, 2); }
    }
    const hand = (a, L, w, c) => { for (let d = 0; d < L; d++) { g.fillStyle = c; g.fillRect(Math.round(cx + Math.cos(a) * d - w / 2), Math.round(cy + Math.sin(a) * d - w / 2), w, w); } };
    // Spinning backward, then stopped dead at twelve.
    hand(-Math.PI / 2 + (stopK ? 0 : spin), R - 18, 3, '#ffe8a0');
    hand(-Math.PI / 2 + (stopK ? 0 : spin / 12), R - 34, 4, '#ffd23a');
    // Her face, big.
    if (owner) {
      const sp = partSprite({ type: owner.type, form: owner.form || null, part: 'head', angle: 0, face: 1, wounds: [], cut: [] }, '', t < 0.5 ? 'Angry' : 'Open');
      if (sp) {
        const s = Math.max(3, Math.min(6, Math.floor(130 / sp.canvas.height))), w = sp.canvas.width * s, hh = sp.canvas.height * s, px = 168 - Math.round(w / 2), py = y0 + h + 12 - hh;
        g.imageSmoothingEnabled = false;
        g.drawImage(sp.canvas, px, py, w, hh);
        // The eye burns: the middle of the eye cells of her base face, flared.
        const e = eyeOf(castFor(owner.type, owner.form || null));
        if (e && t > 0.3) {
          // partSprite pads the head by its outline: one cell.
          const gx = Math.round(px + (e.x + 1) * s), gy = Math.round(py + (e.y + 1) * s), k = clamp01((t - 0.3) / 0.15);
          g.fillStyle = '#ff3a5a'; g.fillRect(gx - s, gy - s, s * 2, s * 2);
          g.fillStyle = '#ffffff'; g.fillRect(gx - s / 2, gy - s / 2, s, s);
          g.globalAlpha = 0.85 * (1 - clamp01((t - 0.55) / 0.4));
          const L = Math.round(90 * k);
          g.fillStyle = '#ffd0d8'; g.fillRect(gx - L, gy - 1, L * 2, 2);
          g.fillStyle = '#ffffff'; g.fillRect(gx - L / 2, gy - 1, L, 2);
          g.globalAlpha = 1;
        }
      }
    }
    g.restore();
    // Gold edges of the band.
    g.fillStyle = '#ffd23a';
    for (let x = -60; x < VIEW_W + 60; x++) {
      const u = (x + 60) / (VIEW_W + 120);
      g.fillRect(x, Math.round(y0 + lean * (1 - u)) - 2, 1, 2);
      g.fillRect(x, Math.round(y0 + h + lean * (1 - u)), 1, 2);
    }
    // ZA WARUDO, one letter at a time, each one slammed down from big onto its place.
    const word = 'ZA WARUDO!', SC = 5;
    const x0 = 286, ty = y0 + 38;
    let x = x0;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], at = 0.34 + i * 0.045, k = clamp01((t - at) / 0.08);
      const w = measure(ch, SC) + SC * 2;
      if (t >= at && ch !== ' ') {
        const sc = SC + Math.round((1 - k) * 4), jit = k < 1 ? Math.round((Math.random() - 0.5) * 6) : 0;
        const cxl = x + w / 2, cyl = ty + 5 * SC;
        drawText(g, ch, Math.round(cxl - measure(ch, sc) / 2) + jit, Math.round(cyl - 5 * sc) + jit, { color: '#ffd23a', outline: '#1a0c14', shadow: '#c8142e', scale: sc });
      }
      x += w;
    }
    if (t > 0.86) drawText(g, 'TOKI YO TOMARE!', x0 + 4, ty + 62, { color: '#ffffff', outline: '#0b0812', shadow: '#2a4ab8', scale: 2, alpha: clamp01((t - 0.86) / 0.08) });
    g.restore();
    if (t < 0.07) { g.fillStyle = `rgba(255,255,255,${1 - t / 0.07})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
}

// The middle of the eye in a cast's base head, in head cells.
const eyes = new WeakMap();
function eyeOf(ch) {
  if (eyes.has(ch)) return eyes.get(ch);
  let sx = 0, sy = 0, n = 0;
  ch.parts.head.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'e' || c === 'w') { sx += x + 0.5; sy += y + 0.5; n++; } }));
  const e = n ? { x: sx / n, y: sy / n } : null;
  eyes.set(ch, e);
  return e;
}

// Crisp pixel circle (and ring) clip paths, one rectangle per row, only for rows on screen.
function circlePath(g, cx, cy, r) {
  g.beginPath();
  for (let y = Math.max(-r, -cy - 1); y <= Math.min(r, VIEW_H - cy + 1); y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    if (w > 0) g.rect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}
function ringPath(g, cx, cy, r, th) {
  g.beginPath();
  const r0 = Math.max(0, r - th);
  for (let y = Math.max(-r, -cy - 1); y <= Math.min(r, VIEW_H - cy + 1); y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))), w0 = Math.abs(y) < r0 ? Math.round(Math.sqrt(r0 * r0 - y * y)) : 0;
    if (w <= 0) continue;
    if (w0 > 0) { g.rect(Math.round(cx - w), Math.round(cy + y), w - w0, 1); g.rect(Math.round(cx + w0), Math.round(cy + y), w - w0, 1); }
    else g.rect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

// Which moves are knife moves (used by the renderer for trails and smears).
export const isKnifeMove = kind => KNIFE_MOVES.has(kind) && !!MOVES[kind];
