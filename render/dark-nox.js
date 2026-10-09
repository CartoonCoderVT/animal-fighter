// DARK NOX: the form Nox takes when his blood meter is full. His palette turned dark (the cast in
// pixel-data.js wears it), the aura of blood mist behind him, his burning eyes and the embers of
// blood over him, the transformation (blood spiralling in, bats bursting out, a crimson ring and a
// dark flash) and its reverse, his meter on the HUD card and the red light he gives off. Also his
// scythe flying on its own as a familiar (a.fam) with the crescents it cuts, and the pools of
// blood lying about the arena (state.pools) with the streams he drinks out of them.
// Everything is derived from observable state (form, act, act time, fam, pools) and fx events, so
// remote peers draw the same thing. Pure module at load time (no DOM until something is drawn), and
// no static imports from pixel-data.js or blood-art.js, which import this one (blood-art.js is
// loaded lazily for the scythe's drawing).
import { S, bayer, seeded } from '../engine/const.js';

// Nox turned dark: near-black violet fur with a cold slate highlight and chest, so his silhouette
// still reads on the night arenas; crimson ears and nose, a blood-red scarf, eyes and mouth that glow.
export const DARK_NOX_PALETTE = {
  o: '#06020a', 1: '#5e5c9a', 2: '#231936', 3: '#130b20', 4: '#6c6a9e', 5: '#3e3868', 6: '#d01834', 7: '#7a0820',
  8: '#12060e', 9: '#3e0c22', e: '#ff1e3a', w: '#ffe2d8', r: '#9a0a26', x: '#e01030', y: '#6a0414'
};
// Nox's own colors (PALETTES.bat in pixel-data.js), so the dark can repaint his sprite pixel by
// pixel as it rises up him; a color not in here (a tint, a wound) just goes dark.
const LIGHT_NOX = {
  o: '#2a2038', 1: '#ffffff', 2: '#e8e2f0', 3: '#bdb2d2', 4: '#ffffff', 5: '#e0d6ea', 6: '#ffb0c6', 7: '#e46e92',
  8: '#4e3a6a', 9: '#6e5890', e: '#1e1420', w: '#ffffff', r: '#ffa0b8', x: '#e2445c', y: '#a82840'
};
let toDark = null;
// The dark color for a pixel of his light sprite (packed 0xRRGGBB), or -1.
function darkOf(rgbInt) {
  if (!toDark) {
    toDark = new Map();
    // Fur before belly: white is both his lit fur and his chest; the fur reads better dark.
    for (const k of ['4', '5', 'w', '1', '2', '3', '6', '7', '8', '9', 'e', 'r', 'x', 'y', 'o']) toDark.set(parseInt(LIGHT_NOX[k].slice(1), 16), DARK_NOX_PALETTE[k]);
  }
  return toDark.get(rgbInt) ?? null;
}

// His blood once he is dark: the scythe, talons and orb. A crimson body with a black edge.
export const DARK_BLOOD_PAL = {
  blood: { out: '#060108', dark: '#3a0410', mid: '#8a0a20', light: '#d0142e', glint: '#ff4a5e', edge: '#060108', tip: '#ff8a96' },
  shadow: { out: '#06020c', dark: '#1e0838', mid: '#4a1a80', light: '#7a3ac8', glint: '#c09aff', edge: '#06020c', tip: '#efe0ff' }
};
export const darkBloodPal = gore => (gore === 0 ? DARK_BLOOD_PAL.shadow : DARK_BLOOD_PAL.blood);

// The aura, mist, embers and bats. Without gore the blood turns to violet shadow.
const FXPAL = {
  blood: { core: '#ffe2d8', hot: '#ff3048', mid: '#c0102a', deep: '#760418', mist: '#3a0212', black: '#0a0208', bat: '#0e0612', wing: '#5a0418' },
  shadow: { core: '#efe0ff', hot: '#b97aff', mid: '#7a2ac0', deep: '#3c1260', mist: '#1e0834', black: '#08040e', bat: '#0c0816', wing: '#2e1052' }
};
const fxPal = gore => (gore === 0 ? FXPAL.shadow : FXPAL.blood);

// Timings shared with the simulation (DARK in sim/moves.js): the rise lasts 1 s and turns him dark
// at 0.6 s, the fade 0.5 s.
const RISE = 1.0, POP = 0.6, FADE = 0.5;
export const DARK_TIMES = { rise: RISE, pop: POP, fade: FADE };
// Turning back, he has the scythe in his hand again from 60% of the fade on: blood-art.js draws it
// there and the familiar is no longer drawn.
export const famCaught = a => a?.act === 'darkFade' && (a.actT ?? 0) >= FADE * 0.6;
const FIG_W = 72, FIG_H = 64;
const clamp01 = v => Math.max(0, Math.min(1, v));
const wrapA = v => v - Math.round(v / (Math.PI * 2)) * Math.PI * 2;
const ease = u => 1 - (1 - u) * (1 - u);

// How much of the dark is on him: rising through the transformation, 1 while he is DARK NOX,
// draining as he turns back.
export function darkness(a) {
  if (!a || a.type !== 4) return 0;
  const at = a.actT ?? 0;
  if (a.act === 'darkRise') return at < POP ? at / POP : 1;
  if (a.act === 'darkFade') return Math.max(0, 1 - at / FADE);
  return a.form === 'dark' ? 1 : 0;
}

// A slow double heartbeat (lub-dub), 0..1.
function heartbeat(t, rate = 1.1) {
  const p = (t * rate) % 1;
  return Math.max(0, 1 - Math.abs(p - 0.08) / 0.07) + 0.6 * Math.max(0, 1 - Math.abs(p - 0.26) / 0.07);
}

// Cheap smooth value noise for the flames of the aura.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const RGB = new Map();
function rgb(hex) {
  let v = RGB.get(hex);
  if (!v) { const n = parseInt(hex.slice(1, 7), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(hex, v); }
  return v;
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c, g, img: g.createImageData(w, h) }; };

// A little bat: a black body, wings up or down with crimson-lit tips, a burning eye.
function bat(g, P, x, y, up) {
  const bx = Math.round(x), by = Math.round(y), wy = up ? -1 : 1;
  g.fillStyle = P.bat; g.fillRect(bx - 1, by, 3, 2);
  g.fillRect(bx - 2, by + wy, 1, 1); g.fillRect(bx + 2, by + wy, 1, 1);
  g.fillStyle = P.mid; g.fillRect(bx - 3, by + wy * 2, 1, 1); g.fillRect(bx + 3, by + wy * 2, 1, 1);
  g.fillStyle = P.wing; g.fillRect(bx - 2, by + wy * 2, 1, 1); g.fillRect(bx + 2, by + wy * 2, 1, 1);
  g.fillStyle = P.hot; g.fillRect(bx, by, 1, 1);
}

// The flying scythe: 1.3 times the one in his hand, turning about its balance point, FAM_PIVOT
// (scythe units, his own scythe's pixels) down the shaft from the head, so it whirls like a thrown
// blade and, floating at his shoulder, its butt stays clear of the floor; FAM_FORM: how long it
// takes to form out of the blood (famReturn).
const FAM_S = 1.3, FAM_PIVOT = 15, SHAFT = 24, FAM_FORM = 0.3;
const DEG = Math.PI / 180;
// The crescents it cuts (famSlash), facing right: the centre of the arc from the cut point (view
// pixels), its radius, the sweep a0 -> a1 (radians, 0 ahead, positive down), the thickness, how
// long it lasts and whether it is a whole ring round the cut point.
const SLASH = {
  auto: { c: [0, 31], r: 33, a0: -122 * DEG, a1: -58 * DEG, w: 3, life: 0.17 },
  cross: { c: [0, 42], r: 45, a0: -120 * DEG, a1: -60 * DEG, w: 4, life: 0.2 },
  reap: { c: [-14, 2], r: 17, a0: 75 * DEG, a1: -85 * DEG, w: 4, life: 0.2 },
  chop: { c: [-34, -2], r: 36, a0: -50 * DEG, a1: 55 * DEG, w: 5, life: 0.22 },
  hook: { c: [-4, 0], r: 13, a0: -105 * DEG, a1: 140 * DEG, w: 4, life: 0.2 },
  spin: { c: [0, 0], r: 20, a0: 0, a1: 360 * DEG, w: 3, life: 0.22, ring: true, sq: 0.85 },
  orbit: { c: [0, 0], r: 15, a0: 0, a1: 360 * DEG, w: 2, life: 0.18, ring: true, sq: 0.85 },
  whirl: { c: [0, 0], r: 40, a0: 0, a1: 360 * DEG, w: 5, life: 0.28, ring: true, sq: 0.7 },
  form: { c: [0, 0], r: 12, a0: 0, a1: 360 * DEG, w: 2, life: 0.25, ring: true, sq: 0.85 }
};
// A cut's arc in view pixels, mirrored for a cut facing left; rings start where the blade is.
function slashGeom(q) {
  const L = SLASH[q.k], f = q.f, rot = L.ring ? q.ang || 0 : 0;
  const a0 = f > 0 ? L.a0 + rot : Math.PI - L.a0 - rot, a1 = f > 0 ? L.a1 + rot : Math.PI - L.a1 - rot;
  return { cx: q.x + L.c[0] * f, cy: q.y + L.c[1], r: L.r, a0, a1, w: L.w, sq: L.sq || 1 };
}
// A crescent cut: it sweeps in fast, thick behind its leading point, inked black on its outer side
// with a white-hot edge, then its tail runs up after the head and it thins away.
function drawSlash(g, P, q, ox, oy) {
  const u = q.t / q.life;
  if (u < 0) return;
  const G = slashGeom(q), head = Math.min(1, u / 0.3), tail = u < 0.3 ? 0 : Math.min(1, (u - 0.3) / 0.7);
  if (head - tail < 0.02) return;
  const span = G.a1 - G.a0, n = Math.ceil(Math.abs(span) * G.r), thin = 1 - u * 0.5;
  const px = (c, x, y) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1); };
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    if (v < tail || v > head) continue;
    const s = (v - tail) / (head - tail), prof = Math.sin(Math.PI * Math.pow(s, 1.6)), w = Math.max(1, Math.round(G.w * prof * thin));
    const a = G.a0 + span * v, ca = Math.cos(a), sa = Math.sin(a) * G.sq;
    if (w > 1) px(P.black, G.cx + ca * (G.r + 1), G.cy + sa * (G.r + 1));
    for (let d = 0; d < w; d++) {
      const r = G.r - d;
      px(d === 0 ? (u < 0.45 && prof > 0.4 && !q.red ? P.core : P.hot) : d === 1 ? (q.red ? P.mid : P.hot) : d < w - 1 ? P.mid : P.deep, G.cx + ca * r, G.cy + sa * r);
    }
  }
}

// Pools of blood (or, without gore, of violet shadow): ink round the ends, a dark rim, the body and
// its lit surface, a gloss, the floor stained under it, and the stream's drops.
// A pool's fields: network snapshots send [x, y, amt, by], the local game hands its own objects.
// by: the id of the Nox drinking it, -1 when nobody does (ids start at 0).
const poolX = p => p.x ?? p[0], poolY = p => p.y ?? p[1], poolAmt = p => p.amt ?? p[2], poolBy = p => p.by ?? p[3] ?? -1;
const POOL = {
  blood: { ink: '#120106', rim: '#3a040f', deep: '#52060f', body: '#6e0818', top: '#9a1026', gloss: '#ffb0b8', shine: '#d23448', stain: '#2a0610', drop: '#c8142e', hot: '#ff4058' },
  shadow: { ink: '#06030c', rim: '#1a0a30', deep: '#24103e', body: '#341060', top: '#4e2088', gloss: '#e0c8ff', shine: '#8a5ad0', stain: '#120820', drop: '#7a2ac0', hot: '#b97aff' }
};

// The renderer calls drawBack on its lit layer before his sprite (the mist is lit by the scene),
// drawFront and drawEffects on its emissive layer (the hot rim of the aura, his eyes, the embers and
// the transformation glow). update(dt) runs every frame; event(e) takes every fx event.
export class DarkNoxFX {
  constructor(renderer = null) {
    this.r = renderer;
    this.goreSet = 2;
    this.parts = [];
    this.seqs = [];
    this.flashes = [];
    this.rings = [];
    this.at = new Map();
    this.layers = null;
    this.fams = new Map();
    this.slashes = [];
    // The scythe is drawn with blood-art.js, which imports this module: loaded once this is.
    this.art = null;
    import('./blood-art.js').then(m => { this.art = m; }).catch(e => console.warn('dark nox scythe', e));
  }

  // Without gore his blood turns to violet shadow, like the rest of his hemomancy.
  get gore() { return this.r?.fx?.gore ?? this.goreSet; }
  set gore(v) { this.goreSet = v; }

  reset() { this.parts.length = 0; this.seqs.length = 0; this.flashes.length = 0; this.rings.length = 0; this.at.clear(); this.fams.clear(); this.slashes.length = 0; }

  // Where an actor was last drawn: his chest, his feet and his silhouette.
  spot(who, e) {
    let s = this.at.get(who);
    if (!s) { s = { cx: e.x, cy: e.y, fx: e.x, fy: e.y + 11, lastT: null, trail: [], emberT: 0, dripT: 0, mask: null, mx: 0, my: 0, mw: FIG_W, popT: 9 }; this.at.set(who, s); }
    return s;
  }

  event(e) {
    if (e.fx === 'famSlash' || e.fx === 'famReturn') { this.famEvent(e); return; }
    if (e.fx !== 'darkNox' && e.fx !== 'darkNoxPop' && e.fx !== 'darkFade') return;
    const x = (e.x ?? 0) * S, y = (e.y ?? 0) * S, who = e.who ?? -1;
    const s = this.spot(who, { x, y });
    const P = fxPal(this.gore), rnd = seeded((e.id || 1) * 2654435761);
    if (e.fx === 'darkNox') {
      // The blood gathers: it spirals in from all around and rises off the floor into him.
      this.seqs.push({ k: 'rise', who, t: 0, life: POP, acc: 0 });
      this.rings.push({ who, t: 0, life: 0.5, r: 30, shrink: true, color: P.mid });
    } else if (e.fx === 'darkNoxPop') {
      s.popT = 0;
      this.flashes.push({ who, t: 0, life: 0.1 });
      this.rings.push({ who, t: 0, life: 0.5, r: 78, color: P.hot, thick: 2 });
      // Spikes of blood stabbing out all round him and drawing back.
      for (let i = 0; i < 9; i++) this.parts.push({ k: 'spike', who, a: (i / 9) * Math.PI * 2 + (rnd() - 0.5) * 0.4, len: 20 + rnd() * 22, t: 0, life: 0.3 + rnd() * 0.08 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + rnd() * 0.3, sp = 70 + rnd() * 80;
        this.parts.push({ k: 'bat', x: s.cx, y: s.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 30, t: 0, life: 0.55 + rnd() * 0.35, seed: rnd() * 9 });
      }
      for (let i = 0; i < 28; i++) {
        const a = rnd() * Math.PI * 2, sp = 40 + rnd() * 110;
        this.parts.push({ k: 'drop', x: s.cx, y: s.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 50, g: 260, t: 0, life: 0.5 + rnd() * 0.4, floor: s.fy });
      }
    } else {
      // Turning back: the blood unwinds out of him, a few bats scatter, and what is left of the
      // dark runs off him into a pool at his feet that soaks away.
      this.seqs.push({ k: 'fade', who, t: 0, life: FADE * 0.5, acc: 0 });
      this.rings.push({ who, t: 0, life: 0.4, r: 34, color: P.mid });
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, sp = 40 + rnd() * 50;
        this.parts.push({ k: 'bat', x: s.cx, y: s.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.6 + rnd() * 0.3, seed: rnd() * 9, small: true });
      }
      this.parts.push({ k: 'pool', x: s.fx, y: s.fy, vx: 0, vy: 0, t: 0, life: 1.1 });
    }
  }

  update(dt) {
    if (dt <= 0) return;
    for (const q of this.seqs) {
      q.t += dt;
      const s = this.at.get(q.who);
      if (!s || q.t > q.life) continue;
      // Spiral particles, more of them as it builds.
      q.acc += dt * (q.k === 'rise' ? 34 + 50 * (q.t / q.life) : 46);
      while (q.acc >= 1) {
        q.acc -= 1;
        const floor = q.k === 'rise' && Math.random() < 0.35;
        this.parts.push({
          k: 'spiral', who: q.who, out: q.k === 'fade', a0: Math.random() * Math.PI * 2, dir: Math.random() < 0.5 ? -1 : 1,
          r0: floor ? 22 + Math.random() * 20 : 18 + Math.random() * 26, floor, fx0: (Math.random() - 0.5) * 60,
          t: 0, life: 0.32 + Math.random() * 0.22
        });
      }
    }
    this.seqs = this.seqs.filter(q => q.t < q.life);
    for (const p of this.parts) {
      p.t += dt;
      if (p.k === 'fleck' || p.k === 'fdrop' || p.k === 'wisp') {
        if (p.k === 'wisp') { p.vx *= Math.pow(0.2, dt); p.vy -= 14 * dt; }
        else p.vy += 420 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        continue;
      }
      if (p.k === 'bat' || p.k === 'drop' || p.k === 'ember' || p.k === 'drip') {
        if (p.k === 'drip' && p.t < p.hang) continue;
        if (p.k === 'bat') { p.vx *= Math.pow(0.35, dt); p.vy = p.vy * Math.pow(0.35, dt) - 20 * dt; }
        if (p.k === 'ember') p.vx = Math.sin((p.t + p.seed) * 7) * 8;
        if (p.g) p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        // Drops that reach the floor leave a little splash that soaks away.
        if ((p.k === 'drop' || p.k === 'drip') && p.floor !== undefined && p.y >= p.floor - 1 && p.vy > 0) {
          p.t = p.life;
          this.parts.push({ k: 'splat', x: p.x, y: p.floor - 1, t: 0, life: 0.6, w: p.k === 'drip' ? 2 : 1 + Math.round(Math.random() * 2) });
        }
      }
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < f.life);
    for (const s of this.at.values()) s.popT += dt;
    for (const q of this.slashes) q.t += dt;
    this.slashes = this.slashes.filter(q => q.t < q.life);
    for (const m of this.fams.values()) m.formT += dt;
  }

  // Keeps track of where he is and reads his silhouette out of the figure canvas: m holds 1 for
  // his pixels, and the rim pixels on his underside and his top are listed for drips and embers.
  track(f) {
    const a = f.a, s = this.spot(a.id, { x: f.hx, y: f.hy - 11 });
    s.cx = f.hx; s.cy = f.hy - 11; s.fx = f.hx; s.fy = f.hy;
    const A = f.fc?.alpha;
    if (!A) { s.mask = null; return s; }
    const W = f.fc.body?.c?.width || FIG_W, H = f.fc.body?.c?.height || FIG_H, N = W * H;
    if (!s.mask || s.mask.length !== N) { s.mask = new Uint8Array(N); s.dist = new Uint8Array(N); s.under = new Int32Array(N); s.top = new Int32Array(N); }
    const m = s.mask;
    let nu = 0, nt = 0, y0 = H, y1 = -1;
    for (let i = 0; i < N; i++) m[i] = A[i * 4 + 3] > 0 ? 1 : 0;
    for (let i = 0; i < N; i++) {
      if (!m[i]) continue;
      const y = (i / W) | 0;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (y < H - 1 && !m[i + W]) s.under[nu++] = i;
      if (y > 0 && !m[i - W]) s.top[nt++] = i;
    }
    s.nu = nu; s.nt = nt; s.y0 = y0; s.y1 = y1;
    s.mw = W; s.mh = H; s.mx = f.x; s.my = f.y;
    return s;
  }

  layer(i, W, H) {
    this.layers ||= [];
    let L = this.layers[i];
    if (!L || L.c.width !== W || L.c.height !== H) { L = mkCanvas(W, H); this.layers[i] = L; }
    return L;
  }

  // Behind his sprite: a crown of dark-red flames and blood mist rising off his silhouette, a hot
  // crimson rim right against him, and drops of blood falling off his underside.
  drawBack(g, f, ox, oy, t) {
    const a = f.a;
    if (!a || a.type !== 4) return;
    const s = this.track(f), k = darkness(a);
    const fresh = s.lastT !== null && t !== s.lastT, dt = fresh ? Math.min(0.1, Math.max(0, t - s.lastT)) : 0;
    if (k > 0.02 && s.mask && !(a.act === 'swarm' || a.act === 'blink')) {
      const W = s.mw, H = s.mh, N = W * H, m = s.mask, D = s.dist, P = fxPal(this.gore);
      const flare = a.act === 'darkRise' && (a.actT ?? 0) >= POP ? 1 - ((a.actT ?? 0) - POP) / (RISE - POP) : 0;
      const beat = heartbeat(t), R = 3, span = Math.max(1, s.y1 - s.y0), waist = s.y0 + span * 0.62;
      // Distance from his silhouette in rings, a plus step then a box step for a rounder halo.
      for (let i = 0; i < N; i++) D[i] = m[i] ? 0 : 255;
      for (let r = 1; r <= R; r++) {
        const box = r % 2 === 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (D[i] !== 255) continue;
          const p = r - 1;
          if ((x > 0 && D[i - 1] === p) || (x < W - 1 && D[i + 1] === p) || (y > 0 && D[i - W] === p) || (y < H - 1 && D[i + W] === p) ||
            (box && ((x > 0 && y > 0 && D[i - W - 1] === p) || (x < W - 1 && y > 0 && D[i - W + 1] === p) || (x > 0 && y < H - 1 && D[i + W - 1] === p) || (x < W - 1 && y < H - 1 && D[i + W + 1] === p)))) D[i] = r;
        }
      }
      const L = this.layer(0, W, H), d = L.img.data;
      if (!s.glow || s.glow.c.width !== W || s.glow.c.height !== H) s.glow = mkCanvas(W, H);
      const gd = s.glow.img.data;
      d.fill(0); gd.fill(0);
      const set = (i, hex) => { const [r, gg, b] = rgb(hex), q = i * 4; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255; };
      // What glows is painted again over the lighting (drawFront); the mist stays lit by the scene.
      const hot = (i, hex) => { set(i, hex); const [r, gg, b] = rgb(hex), q = i * 4; gd[q] = r; gd[q + 1] = gg; gd[q + 2] = b; gd[q + 3] = 255; };
      // The halo: a glowing rim of blood against him, strongest from the waist up, a dark-red
      // haze round that, and a few motes of mist.
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, dd = D[i];
        if (!dd || dd > R) continue;
        const b = bayer(x, y), up = y < waist;
        if (dd === 1) {
          if (up || b < 0.5 * k + flare) hot(i, b < 0.2 + 0.5 * beat * k + flare ? P.hot : P.mid);
          else set(i, P.deep);
        } else if (dd === 2) { if (b < (up ? 0.55 : 0.3) * k + flare * 0.5) set(i, P.deep); }
        else if (b < (up ? 0.22 : 0.1) * k) set(i, P.mist);
      }
      // Tongues of dark flame licking up off the top of him, column by column: a glowing root,
      // dark red, then black-red tips broken into wisps; they flicker and climb.
      const seed = (a.id || 0) * 17.3, tall = (2.5 + 5 * k + flare * 7) * k;
      for (let x = 0; x < W; x++) {
        let yt = -1;
        for (let y = 0; y < H; y++) if (D[y * W + x] <= 2) { yt = y; break; }
        if (yt < 0 || yt > waist) continue;
        const n1 = noise(x * 0.27 + seed, t * 3.2), n2 = noise(x * 0.7 + seed + 9, t * 6.1);
        const h = Math.round(tall * (n1 * 0.85 + n2 * 0.5) - 1.5);
        for (let j = 1; j <= h && yt - j >= 0; j++) {
          const i = (yt - j) * W + x, u = j / h, b = bayer(x, yt - j);
          if (u <= 0.3) hot(i, P.mid);
          else if (u <= 0.65) set(i, P.deep);
          else if (b < 0.6) set(i, u > 0.9 ? P.black : P.mist);
        }
        // Now and then a wisp tears off the tip and drifts up.
        if (h > 2 && n2 > 0.62) {
          const yy = yt - h - 2 - Math.floor(((t * 2.4 + n1 * 3) % 1) * 4);
          if (yy >= 0) set(yy * W + x, P.mist);
        }
      }
      L.g.putImageData(L.img, 0, 0);
      g.drawImage(L.c, s.mx, s.my);
      s.glow.g.putImageData(s.glow.img, 0, 0);
      s.glowT = t;
      // Drops of blood falling off him.
      if (dt > 0 && s.nu) {
        s.dripT += dt * (1.5 + 3 * k);
        while (s.dripT >= 1) {
          s.dripT -= 1;
          const i = s.under[Math.floor(Math.random() * s.nu)], x = i % W, y = (i / W) | 0;
          if (y < s.y0 + (s.y1 - s.y0) * 0.35) continue;
          this.parts.push({ k: 'drip', who: a.id, x: s.mx - ox + x, y: s.my - oy + y + 1, vx: 0, vy: 0, g: 220, t: 0, hang: 0.12 + Math.random() * 0.12, life: 1.2, floor: f.hy + 1 });
        }
      }
    }
    if (fresh || s.lastT === null) s.lastT = t;
    this.drawParts(g, ox, oy, t, p => p.k === 'drip' && p.who === a.id);
  }

  // Over his sprite: the dark rising up him through the transformation (and draining back off),
  // a crimson flash of his silhouette at the pop, his burning eyes with a streak when he moves
  // fast, and embers of blood rising off him.
  drawFront(g, f, ox, oy, t) {
    const a = f.a;
    if (!a || a.type !== 4) return;
    const s = this.at.get(a.id) || this.track(f), k = darkness(a), P = fxPal(this.gore), at = a.actT ?? 0;
    const hidden = a.act === 'swarm' || a.act === 'blink';
    if (s.glow && s.glowT === t && k > 0.02 && !hidden) g.drawImage(s.glow.c, s.mx, s.my);
    if (s.mask && !hidden) {
      const W = s.mw, H = s.mh, m = s.mask, span = Math.max(1, s.y1 - s.y0 + 1);
      let mode = null, line = 0;
      if (a.act === 'darkRise' && at < POP) { mode = 'rise'; line = s.y1 + 1 - Math.round(Math.pow(at / POP, 0.85) * (span + 1)); }
      // He turns back halfway through the fade; the dark then drains off him from the head down.
      else if (a.act === 'darkFade' && a.form !== 'dark') { mode = 'fade'; line = s.y0 + Math.round(ease(clamp01((at - FADE * 0.5) / (FADE * 0.45))) * (span + 1)); }
      const pop = s.popT < 0.1;
      if (mode || pop) {
        const L = this.layer(1, W, H), d = L.img.data;
        d.fill(0);
        const set = (i, hex) => { const [r, gg, b] = rgb(hex), q = i * 4; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255; };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!m[i]) continue;
          if (pop) { set(i, (x + y) % 2 ? P.hot : P.mid); continue; }
          // Rising: the dark repaints him from the feet up (his own colors turned dark); fading:
          // what is still dark lies below the line. A hot seam of blood runs along the line.
          const dy = y - line;
          if (dy === 0 || dy === -1 && bayer(x, y) < 0.5) set(i, dy === 0 ? P.hot : P.mid);
          else if (dy > 0 && (dy > 2 || bayer(x, y) < 0.4 + dy * 0.25)) {
            const A = f.fc.alpha, q = i * 4, c = darkOf((A[q] << 16) | (A[q + 1] << 8) | A[q + 2]);
            set(i, c || (dy < 3 ? P.deep : '#140818'));
          }
        }
        L.g.putImageData(L.img, 0, 0);
        g.drawImage(L.c, s.mx, s.my);
      }
    }
    // The eyes burn: a white-hot core, a red glow, a flame licking back off the brow, and a
    // streak behind them when he moves fast.
    const eye = f.info?.eye, face = a.face || 1;
    const fresh = s.eyeT !== t;
    s.eyeT = t;
    if (k > 0.25 && eye && !hidden && !(a.severed || []).includes('head')) {
      const ex = Math.round(eye.x), ey = Math.round(eye.y), tr = s.trail;
      if (fresh) { tr.push({ x: ex, y: ey }); if (tr.length > 6) tr.shift(); }
      for (let i = 1; i < tr.length; i++) {
        const p = tr[i - 1], q = tr[i], n = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
        if (n < 2) continue;
        g.globalAlpha = (i / tr.length) * 0.85;
        g.fillStyle = i > tr.length - 3 ? P.hot : P.mid;
        for (let u = 0; u <= n; u++) g.fillRect(Math.round(p.x + (q.x - p.x) * (u / n)) + ox, Math.round(p.y + (q.y - p.y) * (u / n)) + oy + 1, 1, 1);
      }
      g.globalAlpha = 1;
      const flick = Math.floor(t * 14 + (a.id || 0)) % 3;
      g.fillStyle = P.hot;
      g.fillRect(ex + ox + (face > 0 ? 0 : -1), ey + oy + 1, 2, 2);
      g.fillStyle = P.core;
      g.fillRect(ex + ox, ey + oy, 1, 2);
      // The flame off the brow, flickering back away from his face.
      g.fillStyle = P.hot;
      g.fillRect(ex + ox - face, ey + oy - 1, 1, 1);
      g.fillStyle = flick ? P.mid : P.hot;
      g.fillRect(ex + ox - face * 2, ey + oy - 1 - (flick === 2 ? 1 : 0), 1, 1);
      if (flick !== 1) { g.fillStyle = P.deep; g.fillRect(ex + ox - face * 3, ey + oy - 2, 1, 1); }
    } else s.trail.length = 0;
    // Embers of blood rising off his head and shoulders.
    if (k > 0.2 && fresh && s.mask && s.nt && !hidden && s.lastT !== null) {
      s.emberT += Math.min(0.1, Math.abs(t - (s.emT ?? t))) * (5 + 9 * k);
      while (s.emberT >= 1) {
        s.emberT -= 1;
        const i = s.top[Math.floor(Math.random() * s.nt)], W = s.mw;
        this.parts.push({ k: 'ember', who: a.id, x: s.mx - ox + (i % W), y: s.my - oy + ((i / W) | 0) - 1, vx: 0, vy: -16 - Math.random() * 18, t: 0, life: 0.45 + Math.random() * 0.5, seed: Math.random() * 9 });
      }
    }
    s.emT = t;
    this.drawParts(g, ox, oy, t, p => p.k === 'ember' && p.who === a.id);
  }

  // The transformation and its reverse: spirals of blood, bats, the ring, the dark flash, the
  // spikes and spray of the pop, and the pool he leaves when he turns back.
  drawEffects(g, ox, oy, t) {
    const P = fxPal(this.gore);
    // The dark flash: for a beat the world round him goes black, fringed with dark red, and only
    // his silhouette shows, in crimson.
    for (const fl of this.flashes) {
      const s = this.at.get(fl.who);
      if (!s) continue;
      const u = fl.t / fl.life, r = 20 + ease(u) * 26, cx = Math.round(s.cx + ox), cy = Math.round(s.cy + oy), dens = 1.6 - u * 1.5;
      for (let y = -r; y <= r; y++) {
        const half = Math.sqrt(Math.max(0, r * r - y * y)), yy = cy + Math.round(y * 0.85);
        for (let x = -Math.round(half); x <= Math.round(half); x++) {
          const px = cx + x, v = dens * (1 - Math.hypot(x, y) / (r * 1.5)), b = bayer(px, yy);
          if (b < v) { g.fillStyle = P.black; g.fillRect(px, yy, 1, 1); }
          else if (b < v + 0.12) { g.fillStyle = P.deep; g.fillRect(px, yy, 1, 1); }
        }
      }
      // His silhouette stays lit in crimson inside the black.
      if (s.mask) {
        const W = s.mw;
        g.fillStyle = P.hot;
        for (let i = 0; i < s.mask.length; i++) if (s.mask[i]) g.fillRect(s.mx + (i % W), s.my + ((i / W) | 0), 1, 1);
      }
    }
    for (const r of this.rings) {
      const s = this.at.get(r.who);
      if (!s) continue;
      const u = r.t / r.life, rad = r.shrink ? r.r * (1 - ease(u)) + 4 : r.r * (0.15 + ease(u) * 0.85);
      g.globalAlpha = r.shrink ? Math.min(1, u * 3) * (1 - u * 0.5) : 1 - u;
      g.fillStyle = r.color;
      const n = Math.max(16, Math.round(rad * 3.2)), th = r.thick && u < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        if (r.thin && i % 3 === 0) continue;
        const an = (i / n) * Math.PI * 2;
        g.fillRect(Math.round(s.cx + Math.cos(an) * rad + ox), Math.round(s.cy + Math.sin(an) * rad * 0.85 + oy), th, th);
      }
      g.globalAlpha = 1;
    }
    for (const q of this.slashes) drawSlash(g, P, q, ox, oy);
    this.drawParts(g, ox, oy, t, p => p.k !== 'drip' && p.k !== 'ember' && p.k !== 'wisp');
  }

  // ---- the flying scythe ------------------------------------------------------------------------
  famOf(id) {
    let m = this.fams.get(id);
    if (!m) { m = { hist: [], lastT: null, w: 0, v: 0, dropT: 0, wispT: 0, formT: 9, out: null, st: null }; this.fams.set(id, m); }
    return m;
  }

  // famSlash: the crescent it cuts (and blood flung off it); famReturn: blood winds in beside him
  // and the scythe forms out of it (what was left of it where he died comes apart).
  famEvent(e) {
    const x = (e.x ?? 0) * S, y = (e.y ?? 0) * S, rnd = seeded((e.id || 1) * 2246822519), f = e.f || 1;
    if (e.fx === 'famSlash') {
      const k = SLASH[e.k] ? e.k : 'auto', L = SLASH[k];
      const q = { k, x, y, f, ang: e.ang || 0, t: 0, life: L.life, seed: rnd() };
      this.slashes.push(q);
      if (this.slashes.length > 24) this.slashes.shift();
      // Blood thrown off along the cut, flying on the way the blade went.
      const G = slashGeom(q), n = L.ring ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const v = 0.25 + rnd() * 0.75, a = G.a0 + (G.a1 - G.a0) * v, sd = Math.sign(G.a1 - G.a0), sp = 70 + rnd() * 110;
        const px = G.cx + Math.cos(a) * G.r, py = G.cy + Math.sin(a) * G.r * G.sq;
        this.parts.push({ k: 'fleck', x: px, y: py, vx: -Math.sin(a) * sd * sp + Math.cos(a) * 30, vy: Math.cos(a) * sd * sp * G.sq + Math.sin(a) * 30 - 40, t: 0, life: 0.35 + rnd() * 0.3 });
      }
      return;
    }
    const m = this.famOf(e.who ?? -1), last = m.hist[m.hist.length - 1];
    if (last && m.st === 'lost') for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, sp = 20 + rnd() * 60;
      this.parts.push({ k: 'fdrop', x: last.x + Math.cos(a) * 6, y: last.y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, t: 0, life: 0.5 + rnd() * 0.3 });
    }
    m.hist.length = 0; m.formT = 0;
    for (let i = 0; i < 26; i++) this.parts.push({ k: 'swirl', x, y, r0: 14 + rnd() * 16, a0: rnd() * Math.PI * 2, dir: f, t: 0, life: FAM_FORM * (0.7 + rnd() * 0.3) });
    this.slashes.push({ k: 'form', x, y, f, ang: 0, t: -FAM_FORM * 0.8, life: 0.25, seed: rnd(), red: true });
  }

  // Where the scythe is this frame (view pixels, no shake): its pivot, the grip drawScythe takes,
  // its angle (degrees, drawScythe's) and size. ang is a plain rotation on screen (clockwise, 0 =
  // shaft up; the simulation spins it ang += speed * f so its edge leads); drawScythe mirrors its
  // angles by the side the blade faces, hence f * ang.
  famPose(a, F) {
    const f = F.f || a.face || 1;
    let s = FAM_S;
    if (a.act === 'darkFade') s = FAM_S + (1 - FAM_S) * clamp01((a.actT ?? 0) / (FADE * 0.6));
    const th = 180 + (f * (F.ang || 0) * 180) / Math.PI, r = (th * Math.PI) / 180, L = (SHAFT - FAM_PIVOT) * s;
    const px = F.x * S, py = F.y * S;
    return { f, s, th, px, py, gx: px + Math.sin(r) * f * L, gy: py - Math.cos(r) * L };
  }

  // The flying scythe (a.fam), called twice a frame: glow=false on the lit layer (the scythe itself
  // and the dark mist curling off it), glow=true on the emissive layer (its burning eye, the red
  // glow in the blade, the edge flaring on a cut, afterimages when it darts and a blur when it spins).
  drawFamiliar(g, a, ox, oy, t, glow = false) {
    const F = a?.fam, art = this.art;
    if (!F || !art || famCaught(a)) return;
    const m = this.famOf(a.id), q = this.famPose(a, F), lost = F.st === 'lost';
    const P = darkBloodPal(this.gore), X = fxPal(this.gore), grow = clamp01(m.formT / FAM_FORM);
    if (grow <= 0) return;
    m.st = F.st;
    if (!glow) {
      if (m.lastT !== null && t < m.lastT - 0.5) m.hist.length = 0;
      const dt = m.lastT === null ? 0 : Math.min(0.1, Math.max(0, t - m.lastT)), prev = m.hist[m.hist.length - 1];
      if (dt > 0 || !prev) {
        const d = prev ? wrapA((F.ang || 0) - prev.raw) : 0, u = prev ? prev.u + d : F.ang || 0;
        if (prev && dt > 0) { m.w = m.w * 0.4 + (d / dt) * 0.6; m.v = m.v * 0.4 + (Math.hypot(q.px - prev.x, q.py - prev.y) / dt) * 0.6; }
        m.hist.push({ x: q.px, y: q.py, u, raw: F.ang || 0, s: q.s, f: q.f });
        if (m.hist.length > 7) m.hist.shift();
      }
      m.out = art.drawScythe(g, P, q.gx + ox, q.gy + oy, q.th, q.f, q.s, lost ? 0.5 : 1, grow, t);
      if (dt > 0 && m.out && grow >= 1) {
        // Drops flung off the point (a spray when it spins or darts), mist off the blade.
        const fast = Math.abs(m.w) > 9 || m.v > 120;
        m.dropT += dt * (lost ? 1 : fast ? 26 : 4);
        while (m.dropT >= 1) {
          m.dropT -= 1;
          const sd = Math.sign(m.w) || 1, tx = m.out.tx - ox, ty = m.out.ty - oy, dx = tx - q.px, dy = ty - q.py, sp = fast ? 40 + Math.random() * 60 : 0;
          const n = Math.hypot(dx, dy) || 1;
          this.parts.push({ k: 'fdrop', x: tx, y: ty, vx: (-dy / n) * sp * sd, vy: (dx / n) * sp * sd, t: 0, life: 0.45 + Math.random() * 0.25 });
        }
        m.wispT += dt * (lost ? 3 : 9);
        while (m.wispT >= 1) {
          m.wispT -= 1;
          const b = art.bladeSpine(q.gx, q.gy, q.th, q.f, q.s, 0.1 + Math.random() * 0.8);
          this.parts.push({ k: 'wisp', who: a.id, x: b.x + (Math.random() - 0.5) * 3, y: b.y, vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 8, t: 0, life: 0.4 + Math.random() * 0.4 });
        }
      }
      m.lastT = t;
      this.drawParts(g, ox, oy, t, p => p.k === 'wisp' && p.who === a.id);
      return;
    }
    if (!m.out) return;
    const dot = (c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    const hx = m.out.x - ox, hy = m.out.y - oy;
    // The scythe itself is painted again over the scene's lighting, so it never sinks into the dark
    // of the arena (it is its own light); dim when it lies lost.
    const body = () => art.drawScythe(g, P, q.gx + ox, q.gy + oy, q.th, q.f, q.s, lost ? 0.32 : 1, grow, t);
    if (lost) {
      // Dropped where he died: hanging dim, its eye opening now and then.
      body();
      if ((t * 0.8) % 1 < 0.35) { dot(X.deep, hx - 1, hy - 1, 3); dot(X.mid, hx, hy - 1, 1, 3); }
      return;
    }
    const spin = Math.abs(m.w), hunt = F.st === 'hunt' || F.st === 'strike', strike = F.st === 'strike';
    // The blade at pose h (a past one, or this one turned by du), as points along its edge.
    const edge = (h, du, alpha, c, c2, step = 0.14) => {
      const th = 180 + (h.f * (h.u + du) * 180) / Math.PI, r = (th * Math.PI) / 180, L = (SHAFT - FAM_PIVOT) * h.s;
      const gx = h.x + Math.sin(r) * h.f * L, gy = h.y - Math.cos(r) * L;
      g.globalAlpha = alpha * grow;
      for (let u = 0.08; u <= 1.001; u += step) {
        const b = art.bladeSpine(gx, gy, th, h.f, h.s, Math.min(1, u));
        dot(u > 0.85 ? c2 : c, b.ex, b.ey);
        if (u < 0.7) dot(c, (b.x + b.ex) / 2, (b.y + b.ey) / 2);
      }
      g.globalAlpha = 1;
    };
    const cur = m.hist[m.hist.length - 1];
    if (cur) {
      // Spinning: the blade blurs into a wheel behind its edge, a hot ring where the point runs.
      if (spin > 8) {
        const sd = Math.sign(m.w), stp = Math.min(0.42, Math.max(0.16, spin / 60 * 0.55)), n = spin > 16 ? 6 : 4;
        for (let k = n; k >= 1; k--) edge(cur, -sd * k * stp, 0.8 * (1 - k / (n + 1)), k <= 2 ? X.hot : X.mid, k <= 1 ? X.core : X.hot, 0.12);
        const tip = art.bladeSpine(0, 0, 180, 1, cur.s, 1), R = Math.hypot(tip.x, tip.y + (SHAFT - FAM_PIVOT) * cur.s);
        const a1 = Math.atan2(m.out.ty - oy - cur.y, m.out.tx - ox - cur.x), arc = Math.min(Math.PI * 1.6, n * stp * 1.2);
        g.globalAlpha = 0.7 * grow;
        for (let k = 0; k < arc * R; k += 1.4) { const an = a1 - sd * (k / R); dot(k < R * 0.3 ? X.core : X.hot, cur.x + Math.cos(an) * R, cur.y + Math.sin(an) * R); }
        g.globalAlpha = 1;
      }
      // Darting: afterimages of the blade along its path.
      if (m.v > 100 || hunt) for (let i = 0; i < m.hist.length - 1; i++) {
        const h = m.hist[i], nx = m.hist[i + 1];
        if (Math.hypot(nx.x - h.x, nx.y - h.y) < 2) continue;
        const k = (i + 1) / m.hist.length;
        edge(h, 0, 0.55 * k, k > 0.6 ? X.mid : X.deep, X.hot, 0.18);
      }
    }
    body();
    // The blood in the blade glows, a pulse running out along it; the edge flares white on a cut.
    const pulse = (t * 1.7) % 1;
    for (let u = 0.06; u <= 0.94; u += 0.07) {
      const b = art.bladeSpine(q.gx, q.gy, q.th, q.f, q.s, u * grow), mx = (b.x * 0.6 + b.ex * 0.4), my = (b.y * 0.6 + b.ey * 0.4);
      const near = Math.abs(u - pulse) < 0.09;
      g.globalAlpha = (near ? 0.95 : hunt ? 0.7 : 0.45) * grow;
      dot(near ? X.hot : X.mid, mx, my);
      if (strike) { g.globalAlpha = 1; dot(u > 0.5 ? X.core : X.hot, b.ex, b.ey); }
    }
    g.globalAlpha = 1;
    // Its eye: a burning iris round the slit, wide open and streaking when it hunts.
    dot(X.hot, hx - 1, hy - 1, 1, 3); dot(X.hot, hx + 1, hy - 1, 1, 3);
    dot(hunt ? X.core : X.hot, hx, hy - 2); dot(hunt ? X.core : X.hot, hx, hy + 1);
    if (hunt) {
      dot(X.mid, hx - 2, hy, 1, 1); dot(X.mid, hx + 2, hy, 1, 1);
      const p0 = m.hist[Math.max(0, m.hist.length - 3)];
      if (p0) { const dx = q.px - p0.x, dy = q.py - p0.y, n = Math.min(10, Math.hypot(dx, dy)); for (let i = 1; i < n; i++) { g.globalAlpha = 1 - i / n; dot(i < 3 ? X.hot : X.mid, hx - (dx / (n || 1)) * i, hy - (dy / (n || 1)) * i); } g.globalAlpha = 1; }
    }
  }

  // ---- pools of blood --------------------------------------------------------------------------
  // Every pool as a flat glossy puddle lying on its surface (top at y): a dark rim, a lit surface
  // with a highlight sliding over it, the floor stained round it and a few drips running down its
  // face. While Nox drinks one (by) it shivers and a stream of blood arcs out of it into his chest.
  // Lit play layer, behind the fighters. pools: [x, y, amt, by] (world units).
  drawPools(g, pools, actors, ox, oy, t) {
    if (!pools?.length) return;
    const P = this.gore === 0 ? POOL.shadow : POOL.blood;
    for (const p of pools) {
      const amt = +poolAmt(p) || 0;
      if (!(amt > 0.05)) continue;
      const px0 = poolX(p), by = poolBy(p), drink = by >= 0, k = Math.min(1, amt / 20), seed = hash(Math.round(px0 / 8), 3.7);
      const w = Math.max(2, Math.round(3 + 27 * Math.pow(k, 0.7))), h = amt < 2.5 ? 1 : amt < 9 ? 2 : 3;
      const sy = Math.round(poolY(p) * S + oy), cx = px0 * S + ox, x0 = Math.round(cx - w / 2);
      const shiv = drink ? (Math.floor(t * 36 + seed * 7) % 2 ? 1 : -1) : 0;
      // The floor soaked round it.
      g.fillStyle = P.stain;
      g.fillRect(x0 - 1, sy, w + 2, 1);
      if (w > 7) for (let x = x0 + 1; x < x0 + w - 1; x += 2) g.fillRect(x + (sy & 1), sy + 1, 1, 1);
      // The lens of blood: a full bottom row, narrower rows over it, a dark rim at the ends.
      const inset = Math.max(1, Math.round(w * 0.16));
      let tx = x0, tw = w;
      for (let r = 0; r < h; r++) {
        const ins = r * inset, rw = w - ins * 2;
        if (rw < 2) break;
        const rx = x0 + ins + (drink && r === h - 1 ? shiv : 0), ry = sy - 1 - r, top = r === h - 1 || w - (r + 1) * inset * 2 < 2;
        g.fillStyle = top ? P.top : r === 0 ? P.deep : P.body;
        g.fillRect(rx, ry, rw, 1);
        g.fillStyle = P.rim;
        g.fillRect(rx, ry, 1, 1); g.fillRect(rx + rw - 1, ry, 1, 1);
        if (top) { tx = rx; tw = rw; break; }
      }
      g.fillStyle = P.ink;
      g.fillRect(x0 - 1, sy - 1, 1, 1); g.fillRect(x0 + w, sy - 1, 1, 1);
      // The gloss: a highlight sliding slowly to and fro over the surface; ripples run in to the
      // middle while it is drunk.
      const ty = sy - 1 - Math.min(h - 1, Math.floor((w - 2) / (2 * inset))), ph = Math.abs(((t * 0.22 + seed * 2) % 2) - 1);
      if (tw >= 4) {
        const gx = tx + 1 + Math.round(ph * (tw - 3));
        g.fillStyle = P.gloss; g.fillRect(gx, ty, 1, 1);
        g.fillStyle = P.shine; g.fillRect(gx + (ph > 0.5 ? -1 : 1), ty, 1, 1);
      } else if (tw >= 2) { g.fillStyle = P.shine; g.fillRect(tx + 1, ty, 1, 1); }
      if (drink && tw >= 4) {
        g.fillStyle = P.shine;
        for (let j = 0; j < 3; j++) { const d = ((t * 26 + j * (tw / 6)) % (tw / 2)) | 0; g.fillRect(tx + d, ty, 1, 1); g.fillRect(tx + tw - 1 - d, ty, 1, 1); }
      }
      // Drips running down the face of the floor at its edges.
      if (amt >= 4) for (let j = 0; j < (amt >= 12 ? 2 : 1); j++) {
        const dx = j ? x0 + w - 2 - Math.floor(seed * 3) : x0 + 1 + Math.floor(seed * w * 0.3), L = 1 + Math.floor(k * 2.5 + hash(dx, 1.3) * 1.5);
        g.fillStyle = P.deep; g.fillRect(dx, sy + 1, 1, L);
        g.fillStyle = P.body; g.fillRect(dx, sy + L, 1, 1);
        const dp = (t * 0.45 + seed + j * 0.5) % 1;
        if (dp > 0.7) { g.fillStyle = P.drop; g.fillRect(dx, sy + L + 1 + Math.floor((dp - 0.7) * 14), 1, 1); }
      }
      if (drink) {
        const a = actors?.find(q => q.id === by);
        if (a && !a.dead) this.stream(g, P, cx, ty, a.x * S + ox, (a.y - 6) * S + oy, t, a.form === 'dark', seed, false);
      }
    }
  }

  // The bright drops in the streams of blood, for the emissive layer (optional: the streams are
  // already drawn by drawPools; this makes them glow).
  drawPoolsGlow(g, pools, actors, ox, oy, t) {
    if (!pools?.length) return;
    const P = this.gore === 0 ? POOL.shadow : POOL.blood;
    for (const p of pools) {
      const by = poolBy(p), amt = +poolAmt(p) || 0;
      if (!(by >= 0) || !(amt > 0.05)) continue;
      const a = actors?.find(q => q.id === by);
      if (!a || a.dead) continue;
      const k = Math.min(1, amt / 20), w = Math.max(2, Math.round(3 + 27 * Math.pow(k, 0.7))), h = amt < 2.5 ? 1 : amt < 9 ? 2 : 3;
      const sy = Math.round(poolY(p) * S + oy), ty = sy - 1 - Math.min(h - 1, Math.floor((w - 2) / (2 * Math.max(1, Math.round(w * 0.16)))));
      this.stream(g, P, poolX(p) * S + ox, ty, a.x * S + ox, (a.y - 6) * S + oy, t, a.form === 'dark', hash(Math.round(poolX(p) / 8), 3.7), true);
    }
  }

  // A stream of blood from a pool (x0, y0) arcing up into Nox (x1, y1): a thin wavering ribbon with
  // drops riding along it, a little column rising off the pool where it leaves; faster and fuller as
  // DARK NOX. glow: only the bright drops.
  stream(g, P, x0, y0, x1, y1, t, dark, seed, glow) {
    const dist = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 6 - dist * 0.22;
    const at = u => { const a = 1 - u; return [a * a * x0 + 2 * a * u * mx + u * u * x1, a * a * y0 + 2 * a * u * my + u * u * y1]; };
    const n = Math.max(6, Math.round(dist / 1.6)), speed = dark ? 1.9 : 1.1, wob = dark ? 1.4 : 1;
    if (!glow) {
      g.fillStyle = P.rim;
      for (let i = 0; i <= n; i++) {
        const u = i / n, [x, y] = at(u), o = Math.sin(u * 11 - t * 16 + seed * 6) * wob * Math.sin(u * Math.PI);
        g.fillRect(Math.round(x), Math.round(y + o), 1, dark && u > 0.08 && u < 0.92 ? 2 : 1);
      }
      // Where it leaves the pool: a column pulled up off the surface.
      g.fillStyle = P.body;
      g.fillRect(Math.round(x0) - 1, Math.round(y0) - 1, 3, 1);
      g.fillRect(Math.round(x0), Math.round(y0) - 2 - (Math.floor(t * 20) & 1), 1, 2);
    }
    const m = Math.max(4, Math.round(dist / (dark ? 7 : 10)));
    for (let j = 0; j < m; j++) {
      const u = (j / m + t * speed + seed) % 1, [x, y] = at(u), o = Math.sin(u * 11 - t * 16 + seed * 6) * wob * Math.sin(u * Math.PI);
      const big = j % 3 === 0 && u > 0.1 && u < 0.85;
      g.fillStyle = glow ? (big ? P.hot : P.drop) : big ? P.drop : P.top;
      g.fillRect(Math.round(x), Math.round(y + o) - (big ? 1 : 0), big ? 2 : 1, big ? 2 : 1);
    }
  }

  drawParts(g, ox, oy, t, which) {
    const P = fxPal(this.gore);
    const dot = (c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    for (const p of this.parts) {
      if (!which(p)) continue;
      const u = p.t / p.life;
      if (p.k === 'spiral') {
        const s = this.at.get(p.who);
        if (!s) continue;
        // In toward his chest (or out of it), winding round as it goes; the ones off the floor
        // rise from beside his feet.
        const e = p.out ? ease(u) : 1 - ease(u);
        const pos = v => {
          const r = p.r0 * v, an = p.a0 + p.dir * v * 4.2;
          if (p.floor && !p.out) return [s.cx + p.fx0 * v + Math.cos(an) * r * 0.3, s.cy + (s.fy - s.cy) * v + Math.sin(an) * r * 0.25];
          return [s.cx + Math.cos(an) * r, s.cy + Math.sin(an) * r * 0.7];
        };
        const [x, y] = pos(e), [x2, y2] = pos(Math.min(1, e + 0.08)), [x3, y3] = pos(Math.min(1, e + 0.16));
        g.globalAlpha = p.out ? 1 - u : Math.min(1, u * 4);
        dot(P.deep, x3, y3);
        dot(P.mid, x2, y2);
        dot(p.out ? P.mid : u > 0.7 ? P.hot : P.mid, x, y);
        g.globalAlpha = 1;
      } else if (p.k === 'bat') {
        const up = Math.floor(p.t * 22 + p.seed) % 2;
        g.globalAlpha = Math.min(1, (1 - u) * 2.5);
        if (p.small && up) dot(P.bat, p.x - 1, p.y, 3, 1);
        else bat(g, P, p.x + ox, p.y + oy, up);
        g.globalAlpha = 1;
      } else if (p.k === 'drop') {
        g.globalAlpha = Math.min(1, (1 - u) * 3);
        dot(u < 0.3 ? P.hot : P.mid, p.x, p.y, 1, Math.abs(p.vy) > 60 ? 2 : 1);
        g.globalAlpha = 1;
      } else if (p.k === 'drip') {
        // Hangs off him, swelling, then falls.
        if (p.t < p.hang) dot(P.mid, p.x, p.y, 1, p.t > p.hang * 0.5 ? 2 : 1);
        else { dot(P.mid, p.x, p.y, 1, 2); dot(P.hot, p.x, p.y, 1, 1); }
      } else if (p.k === 'splat') {
        if (u > 0.6 && Math.floor(p.t * 30) % 2) continue;
        dot(P.deep, p.x - Math.floor(p.w / 2), p.y, p.w + (u < 0.3 ? 1 : 0), 1);
        if (u < 0.25) dot(P.mid, p.x, p.y - 1);
      } else if (p.k === 'ember') {
        if (u > 0.7 && Math.floor(p.t * 24) % 2) continue;
        dot(u < 0.3 ? P.core : u < 0.6 ? P.hot : P.mid, p.x, p.y);
      } else if (p.k === 'spike') {
        const s = this.at.get(p.who);
        if (!s) continue;
        const out = u < 0.2 ? ease(u / 0.2) : 1 - (u - 0.2) / 0.8, L = p.len * out, ca = Math.cos(p.a), sa = Math.sin(p.a) * 0.8;
        for (const pass of [0, 1]) for (let d = 5; d < L; d += 0.7) {
          const wd = Math.max(1, Math.round(4 * (1 - d / L))), x = s.cx + ca * d - wd / 2, y = s.cy + sa * d - wd / 2;
          if (!pass) dot(P.black, x - 1, y - 1, wd + 2);
          else dot(d > L - 2 ? P.core : wd > 2 ? P.deep : wd > 1 ? P.mid : P.hot, x, y, wd);
        }
      } else if (p.k === 'fleck' || p.k === 'fdrop') {
        // Blood flung off the flying blade and off its cuts.
        if (u > 0.75 && Math.floor(p.t * 30) % 2) continue;
        dot(u < 0.25 && p.k === 'fleck' ? P.core : u < 0.55 ? P.hot : P.mid, p.x, p.y, 1, Math.abs(p.vy) > 90 ? 2 : 1);
      } else if (p.k === 'wisp') {
        // Dark mist curling up off the blade.
        dot(u < 0.3 ? P.deep : u < 0.7 ? P.mist : P.black, p.x, p.y);
      } else if (p.k === 'swirl') {
        // Blood winding in to where the scythe re-forms.
        const e = 1 - ease(u), r = p.r0 * e, an = p.a0 + p.dir * u * 6;
        g.globalAlpha = Math.min(1, u * 4);
        dot(u > 0.6 ? P.hot : P.mid, p.x + Math.cos(an) * r, p.y + Math.sin(an) * r * 0.8);
        dot(P.deep, p.x + Math.cos(an - p.dir * 0.3) * (r + 2), p.y + Math.sin(an - p.dir * 0.3) * (r + 2) * 0.8);
        g.globalAlpha = 1;
      } else if (p.k === 'pool') {
        // Spreads out from under him, then soaks into the floor from the edges in.
        const w = Math.round(4 + 14 * ease(Math.min(1, u * 3))), lim = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
        for (let i = -w; i <= w; i++) {
          const e = 1 - Math.abs(i) / (w + 1);
          if (e < 1 - lim) continue;
          const x = Math.round(p.x + i);
          dot(Math.abs(i) < w * 0.5 && u < 0.6 ? P.mid : P.deep, x, Math.round(p.y) - 1);
          if (e > 0.5 && (x & 1)) dot(P.mist, x, Math.round(p.y));
        }
      }
    }
  }
}

// Light he gives off while dark or changing (view pixels): a deep red glow round him, a flare at
// the pop, and his eye.
export function darkLights(f, t) {
  const a = f?.a, k = darkness(a);
  if (k <= 0.02) return [];
  const at = a.actT ?? 0, out = [];
  const pop = a.act === 'darkRise' && at >= POP ? Math.max(0, 1 - (at - POP) / 0.25) : 0;
  out.push({ x: f.hx, y: f.hy - 12, r: 30 + 14 * k + pop * 50, color: pop > 0.5 ? '#ff4058' : '#b80c26', i: 0.35 + 0.35 * k + 0.1 * heartbeat(t) + pop * 1.1 });
  if (f.info?.eye && !(a.severed || []).includes('head')) out.push({ x: f.info.eye.x, y: f.info.eye.y, r: 12, color: '#ff2a40', i: 0.6 + 0.4 * k, noRim: true });
  return out;
}

// The flying scythe's red light (view pixels, without the shake): a glow round it, stronger while
// it hunts and flaring on a cut; dim where it lies when he is dead.
export function familiarLights(a, t, gore = 2) {
  const F = a?.fam;
  if (!F || famCaught(a)) return [];
  const color = gore === 0 ? '#9a5aff' : '#ff2a40', x = F.x * S, y = F.y * S;
  if (F.st === 'lost') return [{ x, y, r: 16, color, i: 0.2 + 0.1 * heartbeat(t, 0.8), noRim: true }];
  const hunt = F.st === 'hunt', strike = F.st === 'strike';
  return [{ x, y, r: strike ? 48 : hunt ? 36 : 26, color: strike ? (gore === 0 ? '#c09aff' : '#ff5a6a') : color, i: strike ? 1.1 : hunt ? 0.75 : 0.42 + 0.12 * heartbeat(t) }];
}

// Nox's blood meter on his HUD card: a little vial of blood filling from the left, with a drop
// gathering under its front and falling. Full, it beats like a heart, a glint runs along it and a
// drop beside it beats too: K is ready. While he is DARK NOX it drains (k is the time left) and its
// surface burns.
// paused: he is dead and the time holds (the blood stands still, dim); low: the last seconds, the
// vial flashes.
export function bloodMeter(g, x, y, w, k, { time = 0, dark = false, full = false, gore = 2, paused = false, low = false } = {}) {
  k = clamp01(k);
  const P = gore === 0
    ? { glass: '#160c22', shine: '#2a1c40', tick: '#3a2a56', top: '#b97aff', body: '#7a2ac0', low: '#3c1260', meniscus: '#efe0ff', glow: '#9a5aff', hot: '#d8b8ff' }
    : { glass: '#1e0a14', shine: '#341626', tick: '#4a2232', top: '#ff4a64', body: '#c8142e', low: '#7a0a1e', meniscus: '#ffd0d8', glow: '#ff3048', hot: '#ff8a9a' };
  const beat = full && !dark ? heartbeat(time, 1.3) : 0, alarm = low && !paused && Math.floor(time * 6) % 2 === 0;
  const px = (c, xx, yy, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(xx, yy, ww, hh); };
  // The vial: a dark glass tube with a faint shine and quarter marks.
  px(beat > 0.5 || alarm ? '#5a0a1e' : '#0b0812', x - 1, y - 1, w + 2, 4);
  px(P.glass, x, y, w, 2);
  for (let i = 2; i < w; i += 4) px(P.shine, x + i, y, 2, 1);
  for (let q = 1; q < 4; q++) px(P.tick, x + Math.round((w * q) / 4), y + 1, 1, 1);
  const fw = Math.round(w * k);
  if (fw > 0) {
    if (dark && paused) {
      // He is dead: the dark blood stands still, its surface a dull ember.
      px('#2a0410', x, y, fw, 2);
      px('#5a0414', x, y, fw, 1);
      for (let i = 1; i < fw; i += 3) px('#7a0820', x + i, y, 1, 1);
      px('#a01028', x + fw - 1, y, 1, 2);
    } else if (dark) {
      // Black blood, its surface on fire, draining from the right.
      px('#3a0410', x, y, fw, 2);
      px('#7a0418', x, y + 1, fw, 1);
      for (let i = 0; i < fw; i++) {
        const fl = Math.floor(time * 18 + i * 0.7 + Math.sin(i * 1.7) * 3) % 5;
        px(fl === 0 ? '#ff8a4a' : fl === 1 ? '#ff3a2a' : fl === 4 ? '#7a0418' : '#d0102a', x + i, y, 1, 1);
      }
      // The burning front and embers lifting off it.
      px(Math.floor(time * 20) % 2 ? '#fff0c8' : '#ffb070', x + fw - 1, y, 1, 2);
      for (let e = 0; e < 3; e++) {
        const ph = (time * 1.6 + e / 3) % 1, ex = x + Math.max(0, fw - 1 - Math.floor(((e * 37) % 11) * fw / 11));
        if (ph < 0.6) px(ph < 0.25 ? '#ffb070' : '#e0142e', ex, y - 1 - Math.floor(ph * 4), 1, 1);
      }
    } else {
      const hot = beat > 0.4;
      px(hot ? P.glow : P.body, x, y + 1, fw, 1);
      px(hot ? P.hot : P.top, x, y, fw, 1);
      // Blood flowing along the vial.
      for (let i = 0; i < fw; i++) if (((i - Math.floor(time * 10)) % 7 + 7) % 7 === 0) px(P.low, x + i, y + 1, 1, 1);
      if (fw > 1) px(P.meniscus, x + fw - 1, y, 1, 1);
      if (full) {
        // A glint running along the full vial.
        const gx = Math.floor((time * 40) % (w + 30));
        if (gx < w) px('#ffffff', x + gx, y, 1, 1);
        if (gx > 0 && gx - 1 < w) px(P.meniscus, x + gx - 1, y, 1, 1);
      }
    }
  }
  // A drop gathering under the front of the blood, and falling.
  if (fw > 1 && !full && !paused) {
    const ph = (time * 0.8) % 1, dx = x + fw - 2;
    if (ph < 0.55) { if (ph > 0.2) px(dark ? '#9a0a20' : P.body, dx, y + 2, 1, 1); }
    else if (ph < 0.8) px(dark ? '#e0142e' : P.top, dx, y + 2 + Math.floor((ph - 0.55) * 12), 1, 1);
  }
  // Full: a drop beside the vial beats with his heart.
  if (full && !dark) {
    const bx = x + w + 2, by = y - 2, big = beat > 0.4;
    px('#0b0812', bx, by - 1, 3, 1); px('#0b0812', bx - 1, by, 5, 5); px('#0b0812', bx, by + 5, 3, 1);
    px(big ? P.glow : P.body, bx + 1, by, 1, 1);
    px(big ? P.glow : P.body, bx, by + 1, 3, 3);
    px(P.low, bx + 1, by + 4, 1, 1); px(P.low, bx + 2, by + 3, 1, 1);
    px(big ? '#ffffff' : P.meniscus, bx, by + 2, 1, 1);
  }
}
