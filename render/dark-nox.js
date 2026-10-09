// DARK NOX: the form Nox takes when his blood meter is full. His palette turned dark (the cast in
// pixel-data.js wears it), the aura of blood mist behind him, his burning eyes and the embers of
// blood over him, the transformation (blood spiralling in, bats bursting out, a crimson ring and a
// dark flash) and its reverse, his meter on the HUD card and the red light he gives off.
// Everything is derived from observable state (form, act, act time) and fx events, so remote peers
// draw the same thing. Pure module at load time (no DOM until something is drawn), and no imports
// from pixel-data.js, which imports this one.
import { S, bayer } from '../engine/const.js';

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
  blood: { core: '#ffe2d8', hot: '#ff3048', mid: '#c0102a', deep: '#760418', mist: '#3a0212', black: '#0a0208', bat: '#0e0612', wing: '#2a0a1a' },
  shadow: { core: '#efe0ff', hot: '#b97aff', mid: '#7a2ac0', deep: '#3c1260', mist: '#1e0834', black: '#08040e', bat: '#0c0816', wing: '#1e0c34' }
};
const fxPal = gore => (gore === 0 ? FXPAL.shadow : FXPAL.blood);

// Timings shared with the simulation: the rise lasts 1 s and turns him dark at 0.6 s, the form
// lasts 12 s, the fade 0.5 s.
const RISE = 1.0, POP = 0.6, FADE = 0.5, FORM = 12;
const FIG_W = 72, FIG_H = 64;
const clamp01 = v => Math.max(0, Math.min(1, v));
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

// A tiny bat: a body, wings up or down, a red eye.
function bat(g, P, x, y, up, eye = true) {
  const bx = Math.round(x), by = Math.round(y), wy = up ? -1 : 1;
  g.fillStyle = P.bat; g.fillRect(bx - 1, by, 3, 2);
  g.fillRect(bx - 2, by + wy, 1, 1); g.fillRect(bx + 2, by + wy, 1, 1);
  g.fillStyle = P.wing; g.fillRect(bx - 3, by + wy * 2, 1, 1); g.fillRect(bx + 3, by + wy * 2, 1, 1);
  if (eye) { g.fillStyle = P.hot; g.fillRect(bx, by, 1, 1); }
}

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
  }

  // Without gore his blood turns to violet shadow, like the rest of his hemomancy.
  get gore() { return this.r?.fx?.gore ?? this.goreSet; }
  set gore(v) { this.goreSet = v; }

  reset() { this.parts.length = 0; this.seqs.length = 0; this.flashes.length = 0; this.rings.length = 0; this.at.clear(); }

  // Where an actor was last drawn: his chest, his feet and his silhouette.
  spot(who, e) {
    let s = this.at.get(who);
    if (!s) { s = { cx: e.x, cy: e.y, fx: e.x, fy: e.y + 11, lastT: null, trail: [], emberT: 0, dripT: 0, mask: null, mx: 0, my: 0, mw: FIG_W, popT: 9, fadeT: 9 }; this.at.set(who, s); }
    return s;
  }

  event(e) {
    if (e.fx !== 'darkNox' && e.fx !== 'darkNoxPop' && e.fx !== 'darkFade') return;
    const x = (e.x ?? 0) * S, y = (e.y ?? 0) * S, who = e.who ?? -1;
    const s = this.spot(who, { x, y });
    const P = fxPal(this.gore);
    if (e.fx === 'darkNox') {
      // The blood gathers: it spirals in from all around and rises off the floor into him.
      this.seqs.push({ k: 'rise', who, t: 0, life: POP, acc: 0 });
      this.rings.push({ who, t: 0, life: 0.5, r: 30, shrink: true, color: P.mid });
    } else if (e.fx === 'darkNoxPop') {
      s.popT = 0;
      this.flashes.push({ who, t: 0, life: 0.14 });
      this.rings.push({ who, t: 0, life: 0.5, r: 78, color: P.hot, thick: 2 });
      // Spikes of blood stabbing out all round him and drawing back.
      for (let i = 0; i < 14; i++) this.parts.push({ k: 'spike', who, a: (i / 14) * Math.PI * 2 + Math.random() * 0.25, len: 26 + Math.random() * 26, t: 0, life: 0.34 + Math.random() * 0.08 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, sp = 70 + Math.random() * 80;
        this.parts.push({ k: 'bat', x: s.cx, y: s.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 30, t: 0, life: 0.55 + Math.random() * 0.35, seed: Math.random() * 9 });
      }
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 110;
        this.parts.push({ k: 'drop', x: s.cx, y: s.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 50, g: 260, t: 0, life: 0.5 + Math.random() * 0.4, floor: s.fy });
      }
    } else {
      // Turning back: the blood unwinds out of him, a few bats scatter and dark smoke lifts off.
      s.fadeT = 0;
      this.seqs.push({ k: 'fade', who, t: 0, life: FADE * 0.5, acc: 0 });
      this.rings.push({ who, t: 0, life: 0.4, r: 34, color: P.mid });
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 40 + Math.random() * 50;
        this.parts.push({ k: 'bat', x: s.cx, y: s.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.6 + Math.random() * 0.3, seed: Math.random() * 9, small: true });
      }
      for (let i = 0; i < 10; i++) this.parts.push({ k: 'smoke', x: s.cx + (Math.random() - 0.5) * 14, y: s.cy + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 14, t: 0, life: 0.7 + Math.random() * 0.4, r: 2 + Math.random() * 2 });
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
      if (p.k === 'bat' || p.k === 'drop' || p.k === 'smoke' || p.k === 'ember' || p.k === 'drip') {
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
    for (const s of this.at.values()) { s.popT += dt; s.fadeT += dt; }
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
      const beat = heartbeat(t), R = Math.min(5, Math.round(1 + 3 * k + flare * 1.5));
      // Distance from his silhouette in rings, alternating plus and box steps for a rounder halo.
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
      // The hot rim also glows: it is painted again over the lighting (drawFront).
      const hot = (i, hex) => { set(i, hex); const [r, gg, b] = rgb(hex), q = i * 4; gd[q] = r; gd[q + 1] = gg; gd[q + 2] = b; gd[q + 3] = 255; };
      const seed = (a.id || 0) * 17.3, rise = t * 16;
      const tongue = 2 + (6 + flare * 6) * k;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (m[i]) continue;
        const dd = D[i], b = bayer(x, y);
        // Flame noise scrolling upward; the halo is thicker where it is high.
        const n = noise(x * 0.42 + seed, (y + rise) * 0.3);
        if (dd === 1) { if (b < 0.3 + 0.45 * beat * k + flare) hot(i, P.hot); else set(i, P.mid); }
        else if (dd === 2) { if (b < 0.35 + 0.5 * n) set(i, b < 0.25 * k + flare * 0.4 ? P.mid : P.deep); }
        else if (dd <= R) { if (b < (0.75 - (dd - 2) * 0.2) * n) set(i, dd === 3 && n > 0.6 ? P.deep : P.mist); }
        else {
          // Tongues of dark flame licking up off him, broken into wisps at the tips.
          const H2 = Math.floor(tongue * (0.35 + 0.9 * noise(x * 0.3 + seed + 40, t * 2.2)));
          for (let j = 1; j <= H2 && y + j < H; j++) {
            const xx = x + (Math.sin((y + rise) * 0.55 + x) > 0.6 ? 1 : 0);
            const below = D[(y + j) * W + Math.min(W - 1, xx)];
            if (below > 2) continue;
            const u = j / (H2 + 1);
            if (n > 0.3 + u * 0.55 && b < 1.05 - u * 0.6) set(i, u < 0.35 ? P.deep : u < 0.7 ? P.mist : P.black);
            break;
          }
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
      if (a.act === 'darkRise' && at < POP) { mode = 'rise'; line = s.y1 + 1 - Math.round(ease(at / POP) * (span + 1)); }
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
            const A = f.fc.alpha, q = i * 4, c = mode === 'rise' ? darkOf((A[q] << 16) | (A[q + 1] << 8) | A[q + 2]) : null;
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

  // The transformation and its reverse: spirals of blood, bats, rings, the dark flash, spray and smoke.
  drawEffects(g, ox, oy, t) {
    const P = fxPal(this.gore);
    // The dark flash: for a beat the world around him goes black, with a ring of blood at its edge.
    for (const fl of this.flashes) {
      const s = this.at.get(fl.who);
      if (!s) continue;
      const u = fl.t / fl.life, r = 22 + ease(u) * 40, cx = Math.round(s.cx + ox), cy = Math.round(s.cy + oy), dens = 1.6 - u * 1.2;
      for (let y = -r; y <= r; y++) {
        const half = Math.sqrt(Math.max(0, r * r - y * y)), yy = cy + Math.round(y * 0.85);
        for (let x = -Math.round(half); x <= Math.round(half); x++) {
          const edge = Math.abs(Math.hypot(x, y) - r);
          const px = cx + x;
          if (edge < 1.2) { g.fillStyle = P.hot; g.fillRect(px, yy, 1, 1); continue; }
          if (edge < 3 && bayer(px, yy) < 0.5) { g.fillStyle = P.deep; g.fillRect(px, yy, 1, 1); continue; }
          if (bayer(px, yy) < dens * (1 - Math.hypot(x, y) / (r * 1.6))) { g.fillStyle = P.black; g.fillRect(px, yy, 1, 1); }
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
    this.drawParts(g, ox, oy, t, p => p.k !== 'drip' && p.k !== 'ember');
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
        const out = u < 0.25 ? ease(u / 0.25) : 1 - (u - 0.25) / 0.75, L = p.len * out, ca = Math.cos(p.a), sa = Math.sin(p.a) * 0.8;
        for (let d = 6; d < L; d += 1) {
          const wd = Math.max(1, Math.round(3 * (1 - d / L)));
          dot(d > L - 2 ? P.core : wd > 1 ? P.mid : P.hot, s.cx + ca * d - wd / 2, s.cy + sa * d - wd / 2, wd);
        }
      } else if (p.k === 'smoke') {
        const r = Math.round(p.r + u * 3), cx = Math.round(p.x), cy = Math.round(p.y), lim = 0.55 * (1 - u);
        g.fillStyle = u < 0.4 ? P.mist : P.black;
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && bayer(cx + x, cy + y) < lim) g.fillRect(cx + x + ox, cy + y + oy, 1, 1);
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

// Nox's blood meter on his HUD card: a little vial of blood filling from the left, with a drop
// gathering under its front and falling. Full, it beats like a heart, a glint runs along it and a
// drop beside it beats too: K is ready. While he is DARK NOX it drains (k is the time left) and its
// surface burns.
export function bloodMeter(g, x, y, w, k, { time = 0, dark = false, full = false, gore = 2 } = {}) {
  k = clamp01(k);
  const P = gore === 0
    ? { glass: '#160c22', shine: '#2a1c40', tick: '#3a2a56', top: '#b97aff', body: '#7a2ac0', low: '#3c1260', meniscus: '#efe0ff', glow: '#9a5aff', hot: '#d8b8ff' }
    : { glass: '#1e0a14', shine: '#341626', tick: '#4a2232', top: '#ff4a64', body: '#c8142e', low: '#7a0a1e', meniscus: '#ffd0d8', glow: '#ff3048', hot: '#ff8a9a' };
  const beat = full && !dark ? heartbeat(time, 1.3) : 0;
  const px = (c, xx, yy, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(xx, yy, ww, hh); };
  // The vial: a dark glass tube with a faint shine and quarter marks.
  px(beat > 0.5 ? '#5a0a1e' : '#0b0812', x - 1, y - 1, w + 2, 4);
  px(P.glass, x, y, w, 2);
  for (let i = 2; i < w; i += 4) px(P.shine, x + i, y, 2, 1);
  for (let q = 1; q < 4; q++) px(P.tick, x + Math.round((w * q) / 4), y + 1, 1, 1);
  const fw = Math.round(w * k);
  if (fw > 0) {
    if (dark) {
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
  if (fw > 1 && !full) {
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
