// Nox's hemomancy drawn on the 640x360 grid: talons grown from his claw, the scythe of blood he
// forms for the reap, cyclone, guillotine, wheel and air slam, the orb he condenses before the
// piercing beam, and the blood marks floating over rivals. Everything is derived from observable state (move, progress, act
// time), so remote peers draw the same thing. Without gore the blood turns to violet shadow.
import { MOVES } from '../sim/moves.js';
import { slotPoint } from './pixel-data.js';
import { seeded } from '../engine/const.js';

export const BLOOD_PAL = {
  blood: { out: '#2a0410', dark: '#7a0a1e', mid: '#c8142e', light: '#ff4a64', glint: '#ffd0d8' },
  shadow: { out: '#140822', dark: '#3c1260', mid: '#7a2ac0', light: '#b97aff', glint: '#efe0ff' }
};
export const bloodPal = gore => (gore === 0 ? BLOOD_PAL.shadow : BLOOD_PAL.blood);

const dot = (g, c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
// While set, a scythe is drawn behind its owner: pixels his sprite covers are skipped.
let occlude = null;
const put = (g, c, x, y, w = 1, h = w) => { if (!occlude || !occlude(Math.round(x), Math.round(y))) dot(g, c, x, y, w, h); };

// Hand at the tip of the near arm and the direction the arm points, in canvas pixels.
function armOf(frame, fx, fy, face, scale) {
  const [hx, hy] = slotPoint('armF', frame, 0, 3);
  const deg = frame.armF?.[2] || 0, r = (deg * Math.PI) / 180;
  return { x: fx + hx * face * scale, y: fy + hy * scale, dx: -Math.sin(r) * face, dy: Math.cos(r) };
}

// Three hooked talons fanning out from the claw.
function talons(g, P, h, k, scale) {
  const len = Math.round((3 + 2 * k) * scale);
  for (const s of [-0.45, 0, 0.45]) {
    const c = Math.cos(s), sn = Math.sin(s), dx = h.dx * c - h.dy * sn, dy = h.dx * sn + h.dy * c;
    for (let i = 1; i <= len; i++) {
      const bend = (i / len) * (i / len) * 1.6 * scale;
      const x = h.x + dx * i + h.dy * bend * 0.6, y = h.y + dy * i - h.dx * bend * 0.6;
      dot(g, i === len ? P.glint : i > len - 2 ? P.light : P.mid, x, y, Math.max(1, Math.round(scale)));
    }
  }
}

// A blood orb of radius r (pixels) with a dark rim, a lit side and a hot core.
export function orb(g, P, x, y, r, t) {
  const R = Math.max(1, r);
  for (let yy = -R - 1; yy <= R + 1; yy++) for (let xx = -R - 1; xx <= R + 1; xx++) {
    const d = Math.hypot(xx, yy);
    if (d > R + 0.6) continue;
    const c = d > R - 0.4 ? P.out : xx + yy < -R * 0.5 ? P.light : d < R * 0.45 && R >= 2 ? P.glint : P.mid;
    dot(g, c, x + xx, y + yy);
  }
  // A drop wobbling off the bottom.
  if (R >= 2 && Math.floor(t * 8) % 3 === 0) dot(g, P.mid, x, y + R + 1);
}

// Blood drawn in from all around toward a point, spiralling inward.
function converge(g, P, x, y, k, t, radius) {
  for (let i = 0; i < 8; i++) {
    const f = (t * 2.6 + i / 8) % 1, a = (i / 8) * Math.PI * 2 + t * 5 + f * 2;
    const r = radius * (1 - f) * (0.4 + 0.6 * (1 - k * 0.5));
    dot(g, f > 0.7 ? P.light : P.mid, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
  }
}

// The blood scythe, built pixel by pixel. Angles are arm angles for a fighter facing right
// (0 down, 270 ahead, 180 up) and the whole thing is mirrored for the other side. The shaft runs
// through the grip to the head; the blade leaves the head on the leading side and curls back
// toward the grip with its sharp edge inside, so a forward swing leads with the edge and a reap
// at the end of its reach hooks back toward Nox. flip puts the blade on the other side, for the
// strokes that swing the other way round.
// The head carries a vampire's eye; a spike juts off the back of it, the spine is serrated, a
// glint runs along the edge, blood drips off the point and the pommel ends in a thorn.
const SHAFT = 24, BUTT = 7, BLADE = 15, CURL = 7;
function frameOf(gx, gy, th, face, flip = false) {
  const r = (th * Math.PI) / 180, dx = -Math.sin(r), dy = Math.cos(r), f = flip ? -1 : 1;
  return { dx, dy, nx: -dy * f, ny: dx * f, at: (lx, ly) => [gx + lx * face, gy + ly] };
}
function bladePoint(F, len, u, s) {
  return [F.dx * len + F.nx * u * BLADE * s - F.dx * u * u * CURL * s, F.dy * len + F.ny * u * BLADE * s - F.dy * u * u * CURL * s];
}
export function drawScythe(g, P, gx, gy, th, face, s = 1, alpha = 1, grow = 1, t = 0, flip = false) {
  if (alpha <= 0 || grow <= 0) return null;
  const F = frameOf(gx, gy, th, face, flip), len = SHAFT * s * grow, bl = Math.min(1, grow * 1.4);
  g.globalAlpha = alpha;
  // Shaft: banded blood red with a dark line down its back and a wrapped grip.
  for (let k = -BUTT * s * grow; k <= len; k += 0.6) {
    const [bx, by] = F.at(F.dx * k - F.nx * 0.9, F.dy * k - F.ny * 0.9);
    put(g, P.out, bx, by);
    const [x, y] = F.at(F.dx * k, F.dy * k), band = Math.floor(k / (3 * s)) % 2;
    put(g, Math.abs(k) < 3 * s ? P.dark : band ? P.mid : P.light, x, y);
  }
  // A thorn for a pommel.
  for (let j = 0; j < 3; j++) { const [x, y] = F.at(-F.dx * (BUTT * s * grow + j), -F.dy * (BUTT * s * grow + j)); put(g, j === 2 ? P.glint : P.mid, x, y); }
  // The blade: outlined spine with teeth, red body, a hot inner edge and a glinting point.
  const n = Math.round(BLADE * s * 2.4), shimmer = (t * 1.3) % 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * bl, [lx, ly] = bladePoint(F, len, u, s), w = Math.max(1, Math.round((1 - u * 0.78) * 4 * s));
    const tooth = i % 4 === 0 && u > 0.08 && u < 0.85;
    for (let k = tooth ? -2 : -1; k <= w; k++) {
      const [x, y] = F.at(lx - F.dx * k * 0.85, ly - F.dy * k * 0.85);
      const edge = k === w, near = Math.abs(u - shimmer) < 0.05;
      put(g, k < 0 ? P.out : edge ? (near || u > 0.88 ? P.glint : P.light) : k === 0 ? P.dark : k === 1 ? P.mid : P.light, x, y);
    }
  }
  const [tx, ty] = F.at(...bladePoint(F, len, bl, s));
  put(g, '#ffffff', tx, ty);
  // A spike off the back of the head.
  for (let j = 1; j <= 4; j++) { const [x, y] = F.at(F.dx * (len + j * 0.4) - F.nx * j * s, F.dy * (len + j * 0.4) - F.ny * j * s); put(g, j === 4 ? P.glint : j > 2 ? P.light : P.mid, x, y); }
  // The vampire's eye in the head: a ring of blood round a pale iris and a slit pupil that blinks.
  const [hx, hy] = F.at(F.dx * len, F.dy * len), open = Math.floor(t * 0.7) % 5 !== 0 || (t * 0.7) % 1 > 0.12;
  put(g, P.out, hx - 2, hy - 1, 5, 3); put(g, P.out, hx - 1, hy - 2, 3, 5);
  put(g, open ? P.glint : P.mid, hx - 1, hy - 1, 3, 3);
  if (open) put(g, P.out, hx, hy - 1, 1, 3);
  // Blood running off the point.
  if (grow >= 1) for (let k = 0; k < 3; k++) {
    const ph = (t * 1.4 + k / 3) % 1;
    g.globalAlpha = alpha * (1 - ph);
    put(g, ph < 0.2 ? P.light : P.mid, tx, ty + 1 + ph * 9 * s, 1, ph < 0.5 ? 2 : 1);
  }
  g.globalAlpha = 1;
  return { x: hx, y: hy, tx, ty };
}
// The arc the blade sweeps, as a fan of fading copies of its edge between two angles.
function scytheSmear(g, P, gx, gy, from, to, face, s, alpha = 1, flip = false) {
  if (alpha <= 0 || Math.abs(to - from) < 6) return;
  const steps = Math.ceil(Math.abs(to - from) / 3), len = SHAFT * s;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps, th = from + (to - from) * k, F = frameOf(gx, gy, th, face, flip);
    g.globalAlpha = alpha * k * k * 0.85;
    for (const u of [0.2, 0.45, 0.7, 0.88, 1]) { const [x, y] = F.at(...bladePoint(F, len, u, s)); dot(g, u >= 0.85 ? P.glint : P.light, x, y, u === 1 && k > 0.7 ? 2 : 1); }
    const [x, y] = F.at(F.dx * (len - 3), F.dy * (len - 3));
    dot(g, P.mid, x, y);
  }
  g.globalAlpha = 1;
}
// How each scythe move swings: held, a snap that starts fast, then a follow-through. A move may
// chain several strokes; spins whirl it round the body instead; grow is the part of the move it
// takes to form out of the blood when it was not already in his hand.
const SWING = {
  scytheReap: { strokes: [{ from: 115, to: 300, w: 0.3, s: 0.45 }], after: 322, end: 0.8, grow: 0.28 },
  scytheSpin: { spin: 2, from: 110, w: 0.22, s: 0.78, center: true },
  scytheGuillotine: { strokes: [{ from: 160, to: 350, w: 0.38, s: 0.48 }], after: 356, end: 0.84 },
  scytheSweep: { strokes: [{ from: 50, to: -75, w: 0.3, s: 0.42 }], after: -85, end: 0.8, flip: true },
  scytheDash: { strokes: [{ from: 120, to: 305, w: 0.24, s: 0.32 }], after: 320, end: 0.8 },
  execute: { strokes: [{ from: 170, to: 352, w: 0.42, s: 0.52 }], after: 358, end: 0.9 },
  dashAtk: { strokes: [{ from: 100, to: 290, w: 0.1, s: 0.3 }], after: 310, end: 0.8 },
  batStrike: { strokes: [{ from: 120, to: 322, w: 0.1, s: 0.24 }, { from: 322, to: 170, w: 0.4, s: 0.52, flip: true }], after: 165, end: 0.85 },
  nAirCross: { strokes: [{ from: 150, to: 330, w: 0.18, s: 0.3 }, { from: 330, to: 175, w: 0.46, s: 0.6, flip: true }], after: 170, end: 0.85 },
  nAirScythe: { strokes: [{ from: 150, to: 345, w: 0.33, s: 0.45 }], after: 356, end: 0.8, grow: 0.22 },
  nAirVortex: { spin: 3, from: 0, w: 0.12, s: 0.88, center: true, grow: 0.12 }
};
function swingAt(sw, p) {
  if (sw.spin) {
    if (p < sw.w) return { th: sw.from };
    if (p < sw.s) { const t = (p - sw.w) / (sw.s - sw.w); return { th: sw.from + 360 * sw.spin * t, prev: sw.from + 360 * sw.spin * Math.max(0, t - 0.18), smear: 1 }; }
    return { th: sw.from + 360 * sw.spin, fade: 1 - Math.min(1, (p - sw.s) / (1 - sw.s)) };
  }
  // The stroke under way (or the last one done), its snap, then the follow-through.
  let st = sw.strokes[0];
  for (const k of sw.strokes) if (p >= k.w) st = k;
  const last = st === sw.strokes[sw.strokes.length - 1], flip = !!(st.flip ?? sw.flip);
  if (p < st.w) return { th: st.from, flip };
  if (p < st.s) { const t = (p - st.w) / (st.s - st.w); return { th: st.from + (st.to - st.from) * (1 - Math.pow(1 - t, 2.4)), prev: st.from, smear: 1, flip }; }
  if (!last) return { th: st.to, prev: st.from, smear: Math.max(0, 1 - (p - st.s) * 12), flip };
  const t = Math.min(1, (p - st.s) / ((sw.end ?? 1) - st.s));
  return { th: st.to + ((sw.after ?? st.to) - st.to) * t, prev: st.from, smear: Math.max(0, 1 - t * 2.5), flip };
}
function scytheMove(g, P, a, h, fx, fy, p, t, face, scale, presence) {
  const sw = SWING[a.attackKind];
  const grow = presence >= 0.99 || !sw.grow ? 1 : Math.min(1, p / sw.grow);
  const gx = sw.center ? fx : h.x, gy = sw.center ? fy - 12 * scale : h.y;
  if (grow < 1) converge(g, P, gx, gy, grow, t, 16 * scale);
  const st = swingAt(sw, p);
  if (st.smear) scytheSmear(g, P, gx, gy, sw.spin ? st.prev : st.prev > st.th ? Math.min(st.prev, st.th + 160) : Math.max(st.prev, st.th - 160), st.th, face, scale, st.smear, st.flip);
  return drawScythe(g, P, gx, gy, st.th, face, scale, st.fade ?? 1, grow, t, st.flip);
}
// The scythe in hand outside its own moves, held in the back hand and drawn behind him. Standing:
// the reaper's guard, upright with its butt on the floor and the blade arching over his head
// toward the rival, swaying with his breath. Running: dragged low behind. In the air: trailing
// behind and below. During claw blows it is swung back out of the way. During
// claw blows it moves to the back hand. Moves that need both arms put it away.
const CLAWS = ['bloodClaw', 'nAirClaw', 'shadowCut', 'bloodSpikes'];
const NO_SCYTHE = ['vampKiss'];
function heldScythe(g, P, a, frame, fx, fy, t, face, scale, presence, mask) {
  if (a.act || a.climbing || a.holding || a.weapon || NO_SCYTHE.includes(a.attackKind) && a.attack > 0) return null;
  const sway = Math.sin(t * 2.2) * 2;
  let slot = 'armB', th, stand = false;
  if (a.attack > 0 && CLAWS.includes(a.attackKind)) th = 48;
  else if (a.hitstun > 0) th = 168 + Math.sin(t * 40) * 5;
  else if (!a.ground) th = a.gliding ? 30 : 42 + sway;
  else if (Math.abs(a.vx || 0) > 0.6) th = 72 + sway * 0.4;
  else { th = (a.crouch ? 172 : 181) + sway; stand = true; }
  if (!frame[slot]) slot = 'armF';
  const [hx, hy] = slotPoint(slot, frame, 0, 3);
  // Standing, the butt rests on the floor and the blade arches over his head toward the rival.
  const gx = fx + hx * face * scale, gy = stand ? fy - BUTT * scale : fy + hy * scale;
  if (presence < 1) converge(g, P, gx, gy, presence, t, 14 * scale);
  occlude = mask || null;
  const out = drawScythe(g, P, gx, gy, th, face, scale, 1, Math.max(0.05, presence), t);
  occlude = null;
  return out;
}

// Drops of blood rising around Nox while he condenses the orb.
function aura(g, P, fx, fy, face, k, t, scale) {
  for (let i = 0; i < 7; i++) {
    const ph = (t * 1.7 + i / 7) % 1, x = fx + (-9 + ((i * 5) % 18)) * scale, y = fy - ph * (14 + 14 * k) * scale;
    if (ph > 0.15 + k * 0.85) continue;
    dot(g, ph > 0.7 ? P.light : P.mid, x, y, Math.max(1, Math.round(scale)), Math.max(1, Math.round(2 * scale)));
  }
}

// Blood art for one fighter this frame. a: actor or snapshot; frame from frameFor. Returns where
// the scythe's head is when one is out, so it can come apart in blood once it is gone.
export function drawBloodArt(g, a, frame, fx, fy, t, { scale = 1, gore = 2, presence = 1, mask = null } = {}) {
  if (a.type !== 4 || !frame?.armF || (a.severed || []).includes('armF')) return;
  const P = bloodPal(gore), face = a.face || 1, h = armOf(frame, fx, fy, face, scale);
  if (a.act === 'requiem') {
    // Every cut is a scythe stroke through the rival; the drop from above swings it down once more.
    const at = a.actT ?? 0;
    if (at < 0.12) { converge(g, P, h.x, h.y, at / 0.12, t, 16 * scale); return drawScythe(g, P, h.x, h.y, 150, face, scale, 1, Math.max(presence, at / 0.12), t); }
    const u = ((at - 0.12) / 0.085) % 1, th = a.reqDone ? 350 : 150 + 200 * (1 - Math.pow(1 - Math.min(1, u * 2.4), 2));
    if (!a.reqDone) scytheSmear(g, P, h.x, h.y, 150, th, face, scale, 1);
    return drawScythe(g, P, h.x, h.y, th, face, scale, 1, 1, t);
  }
  if (a.act === 'beam') {
    const at = a.actT ?? 0;
    if (at < 0.34) {
      const k = at / 0.34;
      aura(g, P, fx, fy, face, k, t, scale);
      converge(g, P, h.x, h.y, k, t, 18 * scale);
      orb(g, P, h.x + h.dx * 2 * scale, h.y + h.dy * 2 * scale, Math.round((1 + 3 * k) * scale), t);
    } else if (at < 0.46) {
      // Muzzle burst where the beam leaves the claw.
      const r = Math.round((6 - (at - 0.34) * 30) * scale);
      for (let i = 0; i < 8; i++) {
        const an = (i * Math.PI) / 4, len = i % 2 ? r * 0.5 : r;
        for (let d = 1; d < len; d++) dot(g, d < 2 ? P.glint : P.light, h.x + Math.cos(an) * d, h.y + Math.sin(an) * d);
      }
      orb(g, P, h.x, h.y, Math.max(1, Math.round(2 * scale)), t);
    } else if (Math.floor(t * 10) % 2) dot(g, P.mid, h.x, h.y + 1);
    return;
  }
  const mv = MOVES[a.attackKind];
  if (a.attack > 0 && mv) {
  const p = Math.max(0, Math.min(0.999, 1 - a.attack / mv.dur));
  switch (a.attackKind) {
    case 'bloodClaw': case 'nAirClaw':
      if (p < 0.3) { if (Math.floor(t * 12) % 2) dot(g, P.mid, h.x, h.y + 1); }
      else if (p < 0.8) talons(g, P, h, p < 0.5 ? 1 : 1 - (p - 0.5) / 0.3, scale);
      break;
    case 'scytheReap': case 'scytheSpin': case 'scytheGuillotine': case 'nAirScythe': case 'nAirVortex':
    case 'scytheSweep': case 'scytheDash': case 'execute': case 'nAirCross': case 'dashAtk': case 'batStrike':
      return scytheMove(g, P, a, h, fx, fy, p, t, face, scale, presence);
    case 'bloodSpikes':
      if (p < 0.4) { converge(g, P, h.x, h.y, p / 0.4, t, 14 * scale); orb(g, P, h.x, h.y - scale, Math.round((1 + 2 * (p / 0.4)) * scale), t); }
      else {
        // The blood the claw drove into the floor spreads into a pool.
        const w = Math.round((6 + 10 * Math.min(1, (p - 0.4) / 0.2)) * scale), x0 = fx + face * 10 * scale;
        dot(g, P.out, x0 - w / 2 - 1, fy - 1, w + 2, 2);
        dot(g, P.mid, x0 - w / 2, fy - 1, w, 1);
        dot(g, P.light, x0 - w / 4, fy - 1, Math.max(1, w / 3), 1);
      }
      break;
    case 'vampKiss':
      if (p < 0.32) converge(g, P, fx + face * 4 * scale, fy - 14 * scale, p / 0.32, t, 12 * scale);
      break;
    case 'shadowCut':
      if (p >= 0.3 && p < 0.7) talons(g, P, h, 1, scale);
      break;
  }
  }
  return heldScythe(g, P, a, frame, fx, fy, t, face, scale, presence, mask);
}

// Blood marks over a rival: one drop per mark, bobbing above the head; they blink before fading.
export function drawMarks(g, a, x, y, t, gore = 2) {
  const n = a.bloodMark || 0;
  if (!n || (a.markLeft !== undefined && a.markLeft < 1 && Math.floor(t * 10) % 2)) return;
  const P = bloodPal(gore), rnd = seeded((a.id || 0) * 31 + 7);
  const x0 = Math.round(x - (n - 1) * 2.5);
  for (let i = 0; i < n; i++) {
    const bx = x0 + i * 5, by = Math.round(y + Math.sin(t * 4 + i * 1.3 + rnd()) * 1.2);
    dot(g, P.out, bx, by - 3, 1, 1); dot(g, P.out, bx - 1, by - 2, 3, 1); dot(g, P.out, bx - 2, by - 1, 5, 4); dot(g, P.out, bx - 1, by + 3, 3, 1);
    dot(g, P.mid, bx, by - 2, 1, 1); dot(g, P.mid, bx - 1, by - 1, 3, 4); dot(g, P.dark, bx, by + 2, 2, 1);
    dot(g, n === 3 ? P.glint : P.light, bx - 1, by, 1, 1);
  }
}
