// Client-side effects driven by simulation events: particles, smears, flashes and persistent decals.
import { VIEW_W, VIEW_H, S, seeded, bayer } from '../engine/const.js';
import { P } from '../engine/palette.js';
import { MAP } from '../sim/map.js';
import { drawText } from '../engine/font.js';
import { bloodPal } from './blood-art.js';
import { FIGHTERS } from '../sim/fighters.js';
import { SKULL, BURN_PAL, VENUS } from './axo-bits.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => v * S;
const ease = t => 1 - (1 - t) * (1 - t);
// The tops of the arena's surfaces, where falling particles settle (rebuilt when the arena changes).
let TOPS = [];
function surfaceTops() {
  TOPS = [
    ...MAP.solids.filter(s => s.kind !== 'wall' && s.kind !== 'pit').map(s => ({ x0: X(s.x0), x1: X(s.x1), y: X(s.y0) })),
    ...MAP.oneway.map(p => ({ x0: X(p.x0), x1: X(p.x1), y: X(p.y) }))
  ];
}
surfaceTops();
const BLOOD = [P.blood1, P.blood2, P.blood3, P.blood2, P.blood0];
const ROCK = ['#5a5068', '#7a6e88', '#3e3648', '#9a8eaa'], STEAM = ['#e8e4f0', '#c8c0d8', '#a8a0c0'], EMBER = ['#ffffff', '#ffe2a0', '#ffb040', '#ff6a2a'];
const DUST = ['#6a6078', '#8a7f95', '#4f475e'];
const SLIME = ['#c8f080', '#9be05a', '#6b9e3c', '#ffffff'];
// The axolotl's goo (pink, wet) and the demon's (embers and dark blood).
const GOO = ['#ffd0de', '#ff9cc0', '#f06e98', '#ffffff'], DEMON = ['#ffd040', '#ff5a1a', '#b02a44', '#2c0814'];
// Water (the geyser, popped bubbles) and the embers of Xolotl.
const WATER = ['#ffffff', '#d8f6ff', '#a8e4f8', '#6ac8ee'], HELL = ['#fff2a0', '#ffd040', '#ff5a1a', '#ff2a3a'];
// Particle defaults for hand-built particles.
const PART = { s: 1, g: 0, b: 0, drag: 1, em: false, ov: false, stick: false, grow: 0 };
// The colours of a fighter the frog copied (his own green when there is none).
const copyCols = c => (c >= 0 && FIGHTERS[c] ? [FIGHTERS[c].color, '#ffffff', '#ffe2a0'] : SLIME);
const FIRE = [P.fire0, P.fire1, P.fire2, P.fire3, P.fire4];
const DEBRIS = {
  wood: ['#b07b4f', '#87553c', '#d6a46c'], stone: ['#6a6280', '#4a4460', '#8a82a0', '#2e2a40'], glass: ['#bfe8f2', '#8cc0dc', '#ffffff'], metal: ['#8a87a2', '#5a5276', '#c4c0d8'],
  flesh: [P.flesh, P.blood3, P.blood2], bone: [P.bone1, P.bone2, P.bone0], ice: [P.ice0, P.ice1, P.ice2]
};

export class FX {
  setMap() { surfaceTops(); }

  constructor() {
    this.parts = [];
    this.smears = [];
    this.flashes = [];
    this.zaps = [];
    this.rings = [];
    this.hemo = [];
    // Shapes drawn over the lighting at full colour (water, the wave, the bite), and the red dim of
    // Xolotl's cast.
    this.over = [];
    this.dim = null;
    this.wallDecals = mk(VIEW_W, VIEW_H);
    this.floorDecals = mk(VIEW_W, VIEW_H);
    this.wg = this.wallDecals.getContext('2d');
    this.fg = this.floorDecals.getContext('2d');
    this.lastId = 0;
    this.onSound = () => {};
    this.gore = 2;
    this.limit = 900;
  }

  reset() {
    this.parts.length = 0; this.smears.length = 0; this.flashes.length = 0; this.zaps.length = 0; this.rings.length = 0; this.hemo.length = 0;
    this.over.length = 0; this.dim = null;
    this.wg.clearRect(0, 0, VIEW_W, VIEW_H);
    this.fg.clearRect(0, 0, VIEW_W, VIEW_H);
    this.lastId = 0;
  }

  add(p) {
    if (this.parts.length >= this.limit) return;
    p.max = p.life;
    this.parts.push(p);
  }
  part(p) { this.add({ ...PART, ...p }); }

  burst(kind, x, y, n, opts = {}) {
    const rnd = opts.rnd || Math.random;
    for (let i = 0; i < n; i++) {
      const a = opts.a !== undefined ? opts.a + (rnd() - 0.5) * (opts.spread ?? 1.2) : rnd() * Math.PI * 2;
      const sp = (opts.s ?? 2) * (0.3 + rnd() * 0.9);
      this.add({ k: kind, x, y, vx: Math.cos(a) * sp + (opts.dx || 0), vy: Math.sin(a) * sp + (opts.dy || 0), life: (opts.life ?? 0.8) * (0.5 + rnd()), c: opts.colors ? opts.colors[Math.floor(rnd() * opts.colors.length)] : opts.c, s: opts.size ?? 1, g: opts.g ?? 0.15, b: opts.b ?? 0, em: !!opts.em, ov: !!opts.ov, drag: opts.drag ?? 1, stick: !!opts.stick, grow: opts.grow || 0, seed: rnd() * 9 });
    }
  }

  event(e) {
    const x = X(e.x ?? 0), y = X(e.y ?? 0);
    const rnd = seeded((e.id || 1) * 2654435761);
    switch (e.fx) {
      case 'blood': {
        if (!this.gore) return;
        const n = Math.min(60, e.n || 8);
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, sp = (e.s || 3) * (0.2 + rnd()) * 0.6;
          this.add({ k: 'blood', x: x + (rnd() - 0.5) * 3, y: y + (rnd() - 0.5) * 3, vx: Math.cos(a) * sp + (e.dx || 0) * 0.5, vy: Math.sin(a) * sp * 0.8 + (e.dy || 0) * 0.5 - 0.6, life: 0.6 + rnd() * 0.9, c: BLOOD[i % BLOOD.length], s: rnd() < 0.25 ? 2 : 1, g: 0.14, stick: true, drag: 0.99 });
        }
        if (n > 10 && rnd() < 0.7) this.splat(this.wg, x + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 8, 2 + n / 10, rnd);
        break;
      }
      case 'spark': this.burst('spark', x, y, e.n || 4, { a: e.a, spread: 1.6, s: 2.6, life: 0.3, colors: [P.fire0, P.fire1, '#ffffff'], g: 0.12, b: 0.4, em: true, rnd }); break;
      case 'dust': this.burst('dust', x, y, e.n || 4, { a: -Math.PI / 2, spread: 2.6, s: 0.8, life: 0.6, colors: ['#6a6078', '#8a7f95', '#4f475e'], g: -0.01, drag: 0.92, size: 2, rnd, dx: 0 }); break;
      case 'land': {
        const k = e.p || 0.5;
        for (const d of [-1, 1]) this.burst('dust', x, y - 1, Math.round(2 + k * 5), { a: d > 0 ? 0 : Math.PI, spread: 0.6, s: 1.2 + k, life: 0.5, colors: ['#6a6078', '#8a7f95'], g: -0.02, drag: 0.9, size: 2, rnd });
        break;
      }
      case 'smoke': this.burst('smoke', x, y, e.n || 2, { a: -Math.PI / 2, spread: 1, s: 0.4, life: 1.2, colors: e.fire ? [P.fire2, P.smoke, '#3a3246'] : [P.smoke, '#3a3246', '#5a5068'], g: -0.03, drag: 0.97, size: 2, grow: 0.04, rnd }); break;
      case 'debris': this.burst('debris', x, y, e.n || 8, { s: 2.6, life: 1.6, colors: DEBRIS[e.k] || DEBRIS.metal, g: 0.18, b: 0.35, size: e.k === 'glass' ? 1 : 2, rnd, dy: -1.5 }); break;
      case 'gib': {
        if (!this.gore) return;
        this.burst('gib', x, y, e.n || 10, { s: 3.4, life: 2.4, colors: [...DEBRIS.flesh, ...DEBRIS.bone], g: 0.2, b: 0.25, size: 2, stick: true, rnd, dy: -2 });
        break;
      }
      case 'shatter': this.burst('debris', x, y, e.n || 12, { s: e.small ? 1.5 : 3.4, life: 1.8, colors: DEBRIS.ice, g: 0.2, b: 0.4, size: 2, rnd, dy: -1.5 }); break;
      case 'frost': this.burst('frost', x, y, e.n || 10, { s: e.big ? 2.4 : 1, life: 1, colors: [P.ice0, P.ice1, P.ice2], g: 0.02, drag: 0.95, size: 1, em: true, rnd }); break;
      case 'steam': this.burst('smoke', x, y, e.n || 8, { a: -Math.PI / 2, spread: 1.4, s: 0.9, life: 0.9, colors: ['#e8e4f0', '#c8c0d8', '#a8a0c0'], g: -0.04, drag: 0.94, size: 2, grow: 0.05, rnd }); break;
      case 'hearts': for (let i = 0; i < (e.n || 4); i++) this.add({ k: 'glyph', ch: '♥', x: x + (rnd() - 0.5) * 16, y: y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 0.4, vy: -0.4 - rnd() * 0.5, life: 0.9 + rnd() * 0.4, c: '#ff9ccc', g: -0.005, em: true }); break;
      case 'letters': for (let i = 0; i < 4; i++) this.add({ k: 'glyph', ch: 'AFSÉQUNPÔ'[Math.floor(rnd() * 9)], x, y, vx: (rnd() - 0.5) * 2.4, vy: -1 - rnd() * 1.5, life: 0.6 + rnd() * 0.4, c: e.color || '#fff', g: 0.12 }); break;
      case 'casing': this.add({ k: 'casing', x, y, vx: (e.d || 1) * (0.8 + rnd()), vy: -1.6 - rnd(), life: 2.5, c: '#e8c060', s: 1, g: 0.2, b: 0.45, spin: 0 }); break;
      case 'muzzle': {
        this.flashes.push({ x, y, a: e.a || 0, life: 0.06, big: e.big, color: e.color || '#fff1c4', word: e.word });
        if (!e.word) this.burst('spark', x, y, 3, { a: e.a, spread: 0.5, s: 3, life: 0.12, colors: [P.fire0, P.fire1], g: 0, em: true, rnd });
        this.burst('smoke', x, y, 2, { a: e.a, spread: 0.6, s: 0.6, life: 0.5, colors: ['#8a8098', '#6a6078'], g: -0.02, drag: 0.9, size: 1, grow: 0.03, rnd });
        break;
      }
      case 'explosion': {
        const r = X(e.r || 110);
        this.flashes.push({ x, y, life: 0.42, max: 0.42, kind: 'explosion', r });
        this.rings.push({ x, y, life: 0.35, max: 0.35, r: r * 1.1, color: '#ffe0b0' });
        this.burst('fire', x, y, 26, { s: 3.2, life: 0.7, colors: FIRE, g: -0.04, drag: 0.92, size: 3, em: true, grow: -0.03, rnd });
        this.burst('smoke', x, y, 16, { s: 1.6, life: 1.6, colors: [P.smoke, '#3a3246', '#2a2436'], g: -0.035, drag: 0.94, size: 3, grow: 0.06, rnd });
        this.burst('spark', x, y, 22, { s: 5, life: 0.6, colors: [P.fire0, P.fire1, P.fire2], g: 0.12, b: 0.3, em: true, rnd });
        this.burst('debris', x, y, 10, { s: 4, life: 1.6, colors: DEBRIS.metal, g: 0.2, b: 0.3, size: 2, rnd, dy: -2 });
        this.onSound('thud', e.x);
        break;
      }
      case 'fireburst': this.burst('fire', x, y, e.n || 16, { a: -Math.PI / 2, spread: 2.4, s: 2, life: 0.7, colors: FIRE, g: -0.05, drag: 0.94, size: 2, em: true, rnd }); break;
      case 'ring': this.rings.push({ x, y, life: 0.4, max: 0.4, r: X(e.size || 40), color: e.color || '#fff' }); break;
      case 'hit': {
        // Anime impact star plus sparks thrown along the blow.
        // Short and tight, so the impact pose underneath still reads; blood magic hits flash crimson.
        const p = e.p || 1, life = 0.05 + p * 0.02;
        this.flashes.push({ x, y, life, max: life, kind: 'star', p: p * 0.7, a: e.a || 0, seed: e.id || 1, color: e.blood ? this.pal().glint : undefined });
        this.burst('spark', x, y, Math.round(3 + p * 3), { a: e.a || 0, spread: 1.3, s: 2.4 + p, life: 0.25, colors: e.cut ? ['#ffffff', '#ffd0d8', '#ff7a8a'] : ['#ffffff', '#fff1a8', P.fire1], g: 0.08, em: true, rnd });
        break;
      }
      case 'impact': {
        const p = e.p || 1;
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 18 + p * 12, color: '#ffffff' });
        this.rings.push({ x, y, life: 0.42, max: 0.42, r: 30 + p * 18, color: e.clash ? '#ff6a8a' : '#ffe6a8' });
        this.burst('spark', x, y, Math.round(8 + p * 6), { spread: 6.3, s: 3.6 + p, life: 0.35, colors: ['#ffffff', '#ffe6a8', P.fire1], g: 0.06, em: true, rnd });
        if (e.ko) this.burst('debris', x, y, 10, { s: 3, life: 1.2, colors: ['#ffffff', '#f2e8cf'], g: 0.15, size: 1, rnd });
        break;
      }
      case 'clang': {
        const big = e.big ? 1 : 0;
        this.flashes.push({ x, y, life: 0.1 + big * 0.06, max: 0.1 + big * 0.06, kind: 'star', p: 1.8 + big * 1.4, a: rnd() * Math.PI, seed: e.id || 1, color: '#fff6c8' });
        for (const d of [0, Math.PI]) this.burst('spark', x, y, 6 + big * 6, { a: d + (rnd() - 0.5), spread: 1.4, s: 3 + big * 1.5, life: 0.35, colors: ['#ffffff', '#ffe8a0', '#ffb040'], g: 0.14, b: 0.4, em: true, rnd });
        this.burst('spark', x, y, 4, { a: -Math.PI / 2, spread: 1, s: 2.6, life: 0.4, colors: ['#ffffff', '#ffe8a0'], g: 0.12, em: true, rnd });
        if (big) this.rings.push({ x, y, life: 0.25, max: 0.25, r: 22, color: '#fff6c8' });
        break;
      }
      case 'parry':
        // A cool blue-white flash: the blow was turned aside.
        this.flashes.push({ x, y, life: 0.18, max: 0.18, kind: 'star', p: 3.2, a: Math.PI / 4, seed: e.id || 1, color: '#9ff0ff' });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 26, color: '#9ff0ff' });
        this.rings.push({ x, y, life: 0.45, max: 0.45, r: 44, color: '#ffffff' });
        this.burst('spark', x, y, 14, { spread: 6.3, s: 3.4, life: 0.35, colors: ['#ffffff', '#9ff0ff', '#5ad0ff'], g: 0.04, em: true, rnd });
        break;
      case 'perfect':
        this.rings.push({ x, y, life: 0.35, max: 0.35, r: 22, color: '#c8f0ff' });
        this.burst('spark', x, y, 8, { a: (e.face || 1) > 0 ? Math.PI : 0, spread: 1.2, s: 2.4, life: 0.3, colors: ['#ffffff', '#c8f0ff'], g: 0, em: true, rnd });
        break;
      case 'clash':
        this.flashes.push({ x, y, life: 0.16, max: 0.16, kind: 'star', p: 3, a: 0, seed: e.id || 1, color: '#ff6a8a' });
        for (const d of [0, Math.PI]) this.burst('spark', x, y, 10, { a: d - Math.PI / 6, spread: 1.6, s: 4.5, life: 0.4, colors: ['#ffffff', '#ffb0c0', '#ff4a6a'], g: 0.1, em: true, rnd });
        break;
      case 'dash': {
        const f = e.face || 1;
        this.burst('dust', x - f * 6, y + 10, 5, { a: f > 0 ? Math.PI : 0, spread: 0.7, s: 1.6, life: 0.4, colors: ['#8a7f95', '#6a6078'], g: -0.02, drag: 0.9, size: 2, rnd });
        this.smears.push({ x, y, face: f, size: 22, kind: 'dash', color: '#ffffff', life: 0.12, max: 0.12, fin: 0 });
        break;
      }
      case 'sonic':
        // Three expanding arcs in the facing direction.
        for (let i = 0; i < 3; i++) this.rings.push({ x, y, life: 0.42 + i * 0.1, max: 0.42 + i * 0.1, r: X(e.r || 150) * (0.55 + i * 0.22), color: i === 1 ? '#ffffff' : '#c8b8ff', dir: (e.face || 1) > 0 ? 0 : Math.PI, arc: 0.62 });
        this.burst('spark', x, y, 8, { a: (e.face || 1) > 0 ? 0 : Math.PI, spread: 1.1, s: 3.2, life: 0.35, colors: ['#e8e0ff', '#b8a8ff'], g: 0, em: true, rnd });
        break;
      case 'drain': {
        const tx = X(e.tx ?? e.x), ty = X(e.ty ?? e.y);
        for (let i = 0; i < (e.n || 6); i++) {
          const sx = x + (rnd() - 0.5) * 6, sy = y + (rnd() - 0.5) * 8;
          this.add({ k: 'drain', x: sx, y: sy, vx: (tx - sx) / 18 + (rnd() - 0.5) * 0.6, vy: (ty - sy) / 18 - 0.8, life: 0.32 + rnd() * 0.12, c: i % 2 ? '#ff5a78' : '#ffb0c0', s: 1, g: 0.04, em: true, drag: 1 });
        }
        break;
      }
      // Nox's hemomancy. Spikes of blood burst from the floor one after another.
      case 'bloodSpikes': {
        const f = e.face || 1;
        const at = e.at || [14, 26, 38, 50];
        // A vein of blood runs along the floor from the claw, and each stake bursts out of it.
        this.hemo.push({ k: 'vein', x: Math.round(x + X(6) * f), x2: Math.round(x + X(at[at.length - 1]) * f), y: Math.round(y), f, t: 0, life: 0.6, max: 0.6, run: at.length * 0.03 });
        at.forEach((d, i) => this.hemo.push({ k: 'spike', x: Math.round(x + X(d) * f), y: Math.round(y), f, h: 12 + i * 5, w: 2 + (i > 1 ? 1 : 0), delay: i * 0.03, t: 0, life: 0.66, max: 0.66, seed: (e.id || 1) * 7 + i, burst: false }));
        break;
      }
      case 'bloodBeam': {
        const x2 = X(e.x2), y2 = X(e.y2);
        this.hemo.push({ k: 'beam', x, y, x2, y2, t: 0, life: 0.34, max: 0.34, seed: e.id || 1 });
        this.decal({ k: 'blood', s: 4, layer: y2 >= TOPS.reduce((m, s) => Math.min(m, s.y), 999) - 2 && Math.abs(y2 - y) > 4 ? 'floor' : 'wall' }, x2, y2, rnd);
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 14, color: this.pal().light });
        this.burst('spark', x2, y2, 10, { a: Math.atan2(y - y2, x - x2), spread: 1.6, s: 2.6, life: 0.35, colors: [this.pal().light, this.pal().glint, this.pal().mid], g: 0.1, em: true, rnd });
        if (this.gore) this.burst('blood', x2, y2, 10, { a: Math.atan2(y - y2, x - x2), spread: 1.8, s: 2.2, life: 0.9, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd });
        break;
      }
      case 'supernova': {
        const P = this.pal();
        this.hemo.push({ k: 'nova', x, y, t: 0, life: 0.5, max: 0.5, seed: e.id || 1 });
        this.flashes.push({ x, y, life: 0.2, max: 0.2, kind: 'star', p: 4, a: 0, seed: e.id || 1, color: P.light });
        this.rings.push({ x, y, life: 0.35, max: 0.35, r: 30, color: P.glint });
        this.rings.push({ x, y, life: 0.55, max: 0.55, r: 52, color: P.light });
        this.burst('spark', x, y, 18, { spread: 6.3, s: 3.6, life: 0.45, colors: [P.light, P.glint, P.mid], g: 0.06, em: true, rnd });
        if (this.gore) this.burst('blood', x, y, 26, { spread: 6.3, s: 3, life: 1.1, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd, dy: -1 });
        break;
      }
      case 'bloodBurst': {
        const P = this.pal();
        this.burst('spark', x, y, 4 + (e.n || 1) * 3, { spread: 6.3, s: 2.4, life: 0.3, colors: [P.light, P.mid, P.glint], g: 0.08, em: true, rnd });
        if (this.gore) this.burst('blood', x, y, 4 + (e.n || 1) * 3, { a: -Math.PI / 2, spread: 2.4, s: 2, life: 0.8, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd });
        break;
      }
      // Nox breaks into bats (or gathers out of them) when he blinks.
      case 'batSwarm':
        for (let i = 0; i < (e.n || 12); i++) {
          const a = rnd() * Math.PI * 2, sp = 1.2 + rnd() * 1.8;
          this.hemo.push({ k: 'bat', x, y: y - 4, ox: Math.cos(a) * sp, oy: Math.sin(a) * sp * 0.7 - 0.4, arrive: !!e.arrive, t: 0, life: 0.34, max: 0.34, seed: (e.id || 1) * 13 + i });
        }
        this.burst('smoke', x, y - 2, 4, { s: 0.6, life: 0.4, colors: ['#2a1a30', '#3a2440'], g: -0.02, drag: 0.9, size: 2, rnd });
        break;
      case 'shadowLine': this.hemo.push({ k: 'streak', x, y, x2: X(e.x2), t: 0, life: 0.26, max: 0.26 }); break;
      case 'shadowX': this.hemo.push({ k: 'xcut', x, y, delay: e.delay || 0, t: 0, life: 0.42 + (e.delay || 0), max: 0.42 + (e.delay || 0), seed: e.id || 1, burst: false }); break;
      // The sweep's blade drags along the floor: a line of sparks and a scratch left behind.
      case 'scytheSweep': {
        const P = this.pal(), x2 = X(e.x2), f = e.face || 1;
        this.hemo.push({ k: 'streak', x, y: y - 1, x2, t: 0, life: 0.22, max: 0.22 });
        for (let i = 0; i <= 6; i++) this.burst('spark', x + (x2 - x) * (i / 6), y - 1, 2, { a: -Math.PI / 2 - f * 0.6, spread: 1, s: 2, life: 0.3, colors: ['#ffffff', P.glint, P.light], g: 0.12, b: 0.4, em: true, rnd });
        this.burst('dust', x2, y - 1, 6, { a: -Math.PI / 2, spread: 2.6, s: 1.2, life: 0.5, colors: ['#6a6078', '#8a7f95'], g: -0.01, drag: 0.92, size: 2, rnd });
        this.fg.fillStyle = 'rgba(14,10,18,0.7)';
        this.fg.fillRect(Math.round(Math.min(x, x2)), Math.round(y), Math.round(Math.abs(x2 - x)), 1);
        break;
      }
      // The execution: a geyser of blood out of the downed rival and stakes stabbing up around it.
      case 'bloodGeyser': {
        const P = this.pal();
        this.hemo.push({ k: 'nova', x, y, t: 0, life: 0.45, max: 0.45, seed: e.id || 1 });
        this.flashes.push({ x, y, life: 0.16, max: 0.16, kind: 'star', p: 3, a: -Math.PI / 2, seed: e.id || 1, color: P.glint });
        this.rings.push({ x, y, life: 0.4, max: 0.4, r: 34, color: P.light });
        this.burst('spark', x, y, 14, { a: -Math.PI / 2, spread: 0.9, s: 4, life: 0.45, colors: [P.light, P.glint, P.mid], g: 0.1, em: true, rnd });
        if (this.gore) this.burst('blood', x, y, 30, { a: -Math.PI / 2, spread: 0.8, s: 4.2, life: 1.2, colors: BLOOD, g: 0.17, size: 1, stick: true, rnd });
        break;
      }
      // The guillotine's blade bites the floor: sparks, a spray of blood and a gash left behind.
      case 'scytheFloor': {
        const P = this.pal(), f = e.face || 1;
        this.flashes.push({ x, y: y - 1, life: 0.08, max: 0.08, kind: 'star', p: 1.6, a: -Math.PI / 2, seed: e.id || 1, color: P.glint });
        this.burst('spark', x, y - 1, 10, { a: -Math.PI / 2 - f * 0.5, spread: 1.4, s: 2.8, life: 0.35, colors: [P.glint, P.light, '#ffffff'], g: 0.14, b: 0.4, em: true, rnd });
        if (this.gore) this.burst('blood', x, y - 2, 8, { a: -Math.PI / 2, spread: 2, s: 2, life: 0.8, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd });
        this.burst('dust', x, y - 1, 5, { a: -Math.PI / 2, spread: 2.6, s: 1.1, life: 0.5, colors: ['#6a6078', '#8a7f95'], g: -0.01, drag: 0.92, size: 2, rnd });
        this.fg.fillStyle = 'rgba(14,10,18,0.85)';
        for (let i = -5; i <= 5; i++) this.fg.fillRect(Math.round(x + i), Math.round(y + (Math.abs(i) < 2 ? 1 : 0)), 1, 1);
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 16, color: P.light });
        break;
      }
      case 'groundBounce': {
        this.hemo.push({ k: 'crack', x, y, t: 0, life: 0.5, max: 0.5, seed: e.id || 1 });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 22, color: '#ffe6c8' });
        this.flashes.push({ x, y: y - 2, life: 0.1, max: 0.1, kind: 'star', p: 2, a: -Math.PI / 2, seed: e.id || 1 });
        this.burst('dust', x, y - 1, 10, { a: -Math.PI / 2, spread: 2.8, s: 1.6, life: 0.6, colors: ['#6a6078', '#8a7f95', '#4f475e'], g: -0.01, drag: 0.92, size: 2, rnd });
        // The floor keeps the cracks.
        this.fg.fillStyle = 'rgba(14,10,18,0.8)';
        for (let i = 0; i < 4; i++) { let cx = x, cy = y; const d = i < 2 ? -1 : 1; for (let k = 0; k < 6; k++) { cx += d * (1 + rnd() * 2); cy += Math.round(rnd() * 2 - 1) * 0.5; this.fg.fillRect(Math.round(cx), Math.round(Math.min(y + 1, cy)), 1, 1); } }
        break;
      }
      // Juma's beast. Where a blow lands the floor cracks and throws up rocks and dust; the biggest
      // ones raise a wall of dust out along the floor.
      case 'quake': {
        const p = e.p || 1, f = e.face || 1;
        this.hemo.push({ k: 'crack', x, y, t: 0, life: 0.5 + p * 0.04, max: 0.5 + p * 0.04, seed: e.id || 1 });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 10 + p * 5, color: '#ffe6c8' });
        for (const d of e.both || p >= 6 ? [-1, 1] : [f]) this.burst('debris', x + d * 3, y - 1, 2 + Math.round(p * 0.8), { a: -Math.PI / 2 + d * 0.55, spread: 1.1, s: 1.6 + p * 0.25, life: 1.2, colors: ROCK, g: 0.2, b: 0.3, size: 2, rnd });
        this.burst('dust', x, y - 1, 4 + p, { a: -Math.PI / 2, spread: 2.8, s: 0.8 + p * 0.12, life: 0.7, colors: DUST, g: -0.01, drag: 0.92, size: 2, rnd });
        if (p >= 5) for (let i = 1; i <= 5; i++) for (const d of [-1, 1]) this.burst('dust', x + d * i * 8, y - 1, 2, { a: -Math.PI / 2, spread: 0.4, s: 1.2 + (5 - i) * 0.2, life: 0.55, colors: ['#8a7f95', '#a89cb8'], g: -0.02, drag: 0.9, size: 2, rnd });
        this.fg.fillStyle = 'rgba(14,10,18,0.8)';
        for (let i = 0; i < 3 + Math.min(4, p); i++) { let cx = x, cy = y; const d = i % 2 ? -1 : 1; for (let k = 0; k < 4 + p; k++) { cx += d * (1 + rnd() * 2); cy += Math.round(rnd() * 2 - 1) * 0.5; this.fg.fillRect(Math.round(cx), Math.round(Math.min(y + 1, cy)), 1, 1); } }
        break;
      }
      // The roar rolls out from her jaws in arcs; the titan's fills the room.
      case 'roar': {
        const f = e.face || 1, k = e.titan ? 1.7 : 1;
        for (let i = 0; i < (e.titan ? 6 : 4); i++) this.rings.push({ x, y, life: 0.35 + i * 0.12, max: 0.35 + i * 0.12, r: (26 + i * 20) * k, color: i % 2 ? '#ffffff' : e.titan ? '#ff7a3a' : '#ffb070', dir: f > 0 ? 0 : Math.PI, arc: e.titan ? 1.5 : 1.1 });
        this.rings.push({ x, y, life: 0.55, max: 0.55, r: 80 * k, color: '#ffe2a0' });
        this.burst('spark', x, y, e.titan ? 22 : 10, { a: f > 0 ? 0 : Math.PI, spread: e.titan ? 2 : 1.2, s: 3 * k, life: 0.35, colors: ['#ffffff', '#ffe2a0'], g: 0, em: true, rnd });
        break;
      }
      case 'morphStart':
        this.rings.push({ x, y: y + 4, life: 0.4, max: 0.4, r: e.titan ? 28 : 16, color: e.titan ? '#ff6a2a' : '#ffb070' });
        this.burst('steam', x, y + 8, e.titan ? 12 : 6, { a: -Math.PI / 2, spread: 2.4, s: 0.9, life: 0.8, colors: STEAM, em: true, g: -0.04, drag: 0.94, size: 2, grow: 0.05, rnd });
        break;
      // The pop: a burst of light and steam, rocks thrown up from the floor under her. The titan's
      // splits the floor open and showers the room with rocks.
      case 'morphPop': {
        const fy = y + X(16), k = e.titan ? 1.6 : 1;
        this.flashes.push({ x, y: y - 4, life: 0.22 * k, max: 0.22 * k, kind: 'star', p: 5 * k, a: Math.PI / 4, seed: e.id || 1, color: '#ffe2a0' });
        this.rings.push({ x, y, life: 0.45, max: 0.45, r: 56 * k, color: '#ffffff' });
        this.rings.push({ x, y, life: 0.65, max: 0.65, r: 96 * k, color: e.titan ? '#ff5a1a' : '#ff9a3a' });
        if (e.titan) this.rings.push({ x, y, life: 0.85, max: 0.85, r: 200, color: '#ffe2a0' });
        this.burst('spark', x, y, Math.round(28 * k), { spread: 6.3, s: 3.6 * k, life: 0.6, colors: EMBER, g: 0.05, drag: 0.95, em: true, rnd });
        this.burst('steam', x, y + 4, Math.round(16 * k), { a: -Math.PI / 2, spread: 3.2, s: 1.6 * k, life: 1, colors: STEAM, em: true, g: -0.04, drag: 0.93, size: 2, grow: 0.06, rnd });
        this.burst('debris', x, fy - 1, Math.round(10 * k * k), { a: -Math.PI / 2, spread: 2.2, s: 3 * k, life: 1.3, colors: ROCK, g: 0.2, b: 0.3, size: 2, rnd });
        this.hemo.push({ k: 'crack', x, y: fy, t: 0, life: 0.7 * k, max: 0.7 * k, seed: (e.id || 1) + 3 });
        break;
      }
      // The titan's thunderclap: a flash between her paws, a cone of shock arcs rolling ahead, the
      // air rippling and the floor ahead kicking up a wave of dust.
      case 'thunderclap': {
        const f = e.face || 1, R = X(e.r || 230), dir = f > 0 ? 0 : Math.PI;
        this.flashes.push({ x, y, life: 0.2, max: 0.2, kind: 'star', p: 6, a: 0, seed: e.id || 1, color: '#ffffff' });
        for (let i = 0; i < 6; i++) this.rings.push({ x, y, life: 0.3 + i * 0.07, max: 0.3 + i * 0.07, r: R * (0.25 + i * 0.16), color: i % 2 ? '#ffffff' : '#ffe2a0', dir, arc: 0.45 + i * 0.04 });
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 30, color: '#ffffff' });
        this.burst('spark', x, y, 26, { a: dir, spread: 0.9, s: 5, life: 0.4, colors: ['#ffffff', '#ffe2a0', '#ffb070'], g: 0, drag: 0.94, em: true, rnd });
        const fy = y + X(24);
        for (let i = 1; i <= 8; i++) this.burst('dust', x + f * i * (R / 8), fy - 1, 3, { a: -Math.PI / 2 + f * 0.3, spread: 0.6, s: 1.6 + (8 - i) * 0.15, life: 0.6, colors: DUST, g: -0.02, drag: 0.9, size: 2, rnd });
        break;
      }
      // The beast's paws clapped together: a ring of force and a burst of light.
      // The frog. The gulp: a wet slurp of slime and a ring closing in on him. The copy: a burst of
      // stars in the colours of whoever he swallowed. The spit: a star where they shoot out.
      // The axolotl. A part popping off: a wet burst of pink goo (a little red in it at full gore),
      // fat globs that stick where they land and a ring of spray.
      case 'goo': case 'plop': case 'shedRip': {
        const n = e.n || 10, cols = this.gore === 2 ? [...GOO, '#e8546e'] : GOO;
        this.burst('blood', x, y, n, { spread: 6.3, s: 2.2, life: 0.6, colors: cols, g: 0.18, stick: true, rnd, dy: -0.6 });
        this.burst('blood', x, y, Math.ceil(n / 3), { a: -Math.PI / 2, spread: 2.4, s: 1.8, life: 0.7, colors: GOO, g: 0.2, stick: true, size: 2, rnd });
        this.burst('drop', x, y, 6, { spread: 6.3, s: 1.6, life: 0.35, colors: ['#ffffff', '#fff4f6', '#ffd0de'], g: 0.1, ov: true, rnd });
        this.rings.push({ x, y, life: 0.18, max: 0.18, r: 8 + Math.min(10, n * 0.5), color: '#ffd0de' });
        if (e.fx !== 'goo') this.flashes.push({ x, y, life: 0.08, max: 0.08, kind: 'star', p: 1.4, a: Math.PI / 4, seed: e.id || 1, color: '#fff4f6' });
        break;
      }
      // A shed part landing and starting to swell: a soft pink pulse and a few drops of goo.
      case 'bud':
        this.rings.push({ x, y: y - 2, life: 0.3, max: 0.3, r: 9, color: '#ffd0de', flat: true });
        this.burst('blood', x, y - 2, 5, { a: -Math.PI / 2, spread: 2.2, s: 1.4, life: 0.5, colors: GOO, g: 0.18, stick: true, rnd });
        this.burst('spark', x, y - 3, 4, { a: -Math.PI / 2, spread: 2, s: 0.8, life: 0.45, colors: ['#ffffff', '#ffd0de'], g: -0.02, drag: 0.94, em: true, rnd });
        break;
      // A clone hatching: a pop of light, goo thrown up, two rings and sparkles drifting up.
      case 'cloneBirth':
        this.flashes.push({ x, y: y - 3, life: 0.1, max: 0.1, kind: 'star', p: 1.8, a: Math.PI / 4, seed: e.id || 1, color: '#fff4f6' });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 14, color: '#ffd0de' });
        this.rings.push({ x, y, life: 0.45, max: 0.45, r: 22, color: '#ff9cc0', flat: true });
        this.burst('blood', x, y, 12, { a: -Math.PI / 2, spread: 2.6, s: 2.4, life: 0.6, colors: GOO, g: 0.2, stick: true, rnd });
        this.burst('drop', x, y - 2, 6, { a: -Math.PI / 2, spread: 2.2, s: 2, life: 0.4, colors: ['#ffffff', '#fff4f6'], g: 0.14, ov: true, rnd });
        this.burst('spark', x, y - 4, 10, { a: -Math.PI / 2, spread: 2, s: 1.8, life: 0.5, colors: ['#ffffff', '#ffd0de', '#ff9cc0'], g: -0.02, drag: 0.94, em: true, rnd });
        break;
      // A clone gone: a mini bursts into goo and bubbles and leaves a splat; a demon into embers,
      // ash and a smear of dark blood. Melting away, it sinks into a ring of goo.
      case 'cloneDeath': {
        const demon = e.form === 'demon';
        this.burst('blood', x, y, 14, { spread: 6.3, s: 2.6, life: 0.6, colors: demon ? DEMON : GOO, g: 0.2, stick: true, rnd });
        if (demon) {
          this.burst('spark', x, y, 14, { a: -Math.PI / 2, spread: 2.6, s: 2, life: 0.7, colors: HELL, g: -0.03, drag: 0.94, em: true, rnd });
          this.burst('smoke', x, y, 6, { a: -Math.PI / 2, spread: 1.6, s: 0.6, life: 0.9, colors: ['#3a2a2a', '#2a1a1c', '#4a3236'], g: -0.03, drag: 0.94, size: 2, grow: 0.04, rnd });
        } else {
          this.burst('steam', x, y, 5, { a: -Math.PI / 2, spread: 2.4, s: 0.8, life: 0.6, colors: ['#ffe8f0', '#ffd0de'], g: -0.03, drag: 0.94, em: true, size: 2, grow: 0.05, rnd });
          for (let i = 0; i < 5; i++) this.part({ k: 'bubl', x: x + (rnd() - 0.5) * 10, y: y + (rnd() - 0.5) * 6, vx: (rnd() - 0.5) * 0.4, vy: -0.3 - rnd() * 0.5, life: 0.6 + rnd() * 0.5, c: '#ffd0de', s: 1 + Math.floor(rnd() * 3), g: -0.006, drag: 0.98, ov: true, seed: rnd() * 9 });
        }
        if (e.how !== 'melt' && e.how !== 'fall' && rnd() < 0.8) this.goo(this.wg, x + (rnd() - 0.5) * 6, y - 2, 3, rnd, demon);
        if (e.how === 'melt') this.rings.push({ x, y: y + 4, life: 0.3, max: 0.3, r: 10, color: demon ? '#ff5a1a' : '#ffd0de', flat: true });
        break;
      }
      case 'cloneHit':
        this.burst('blood', x, y, 5, { spread: 6.3, s: 1.8, life: 0.4, colors: e.form === 'demon' ? DEMON : GOO, g: 0.2, stick: true, rnd });
        this.burst('drop', x, y, 3, { spread: 6.3, s: 1.4, life: 0.25, colors: e.form === 'demon' ? ['#ffd040', '#ff5a1a'] : ['#ffffff', '#fff4f6'], g: 0.1, ov: e.form !== 'demon', em: e.form === 'demon', rnd });
        this.flashes.push({ x, y, life: 0.08, max: 0.08, kind: 'star', p: 1.2, a: 0, seed: e.id || 1, color: '#ffffff' });
        break;
      case 'cloneHop':
        this.burst('blood', x, y, 8, { a: -Math.PI / 2, spread: 1.6, s: 2.2, life: 0.5, colors: GOO, g: 0.2, stick: true, rnd });
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 9, color: '#ff9cc0', flat: true });
        break;
      // A part grown back: a swirl of pink light closing in on it, a ring and a twinkle.
      case 'regrow':
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; this.part({ k: 'spark', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, vx: -Math.cos(a) * 0.9, vy: -Math.sin(a) * 0.9, life: 0.4, c: i % 2 ? '#ffffff' : '#ff9cc0', em: true, drag: 0.95 }); }
        this.flashes.push({ x, y, life: 0.12, max: 0.12, kind: 'star', p: 1.6, a: Math.PI / 4, seed: e.id || 1, color: '#ffd0de' });
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 7, color: '#fff4f6' });
        this.hemo.push({ k: 'twinkle', x: Math.round(x), y: Math.round(y), t: 0, life: 0.35, max: 0.35 });
        break;
      // The tail flip's geyser: a pillar of water shooting up off the floor ahead of it.
      case 'geyser': {
        const top = this.floorAt(x, y, 30) ?? y;
        this.over.push({ k: 'geyser', x: Math.round(x), y: Math.round(top), f: e.face || 1, t: 0, life: 0.62, max: 0.62, crown: false });
        for (const d of [-1, 1]) this.burst('drop', x + d * 4, top - 1, 5, { a: d > 0 ? -0.5 : Math.PI + 0.5, spread: 0.7, s: 1.8, life: 0.4, colors: WATER, g: 0.18, ov: true, rnd });
        this.rings.push({ x, y: top, life: 0.3, max: 0.3, r: 16, color: '#d8f6ff', flat: true });
        break;
      }
      // The bubble bursting: its film flies apart in a ring of spray and a few small bubbles rise.
      case 'bubblePop': {
        const R = Math.max(4, X(e.r || 9));
        this.over.push({ k: 'pop', x: Math.round(x), y: Math.round(y), r: R, t: 0, life: 0.18, max: 0.18 });
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + rnd() * 0.3, sp = 1 + rnd() * 1.2; this.part({ k: 'drop', x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 0.3 + rnd() * 0.25, c: WATER[i % 3], g: 0.12, drag: 0.95, ov: true }); }
        for (let i = 0; i < 4; i++) this.part({ k: 'bubl', x: x + (rnd() - 0.5) * R, y: y + (rnd() - 0.5) * R, vx: (rnd() - 0.5) * 0.3, vy: -0.4 - rnd() * 0.4, life: 0.6 + rnd() * 0.4, c: '#d8f6ff', s: 1 + Math.floor(rnd() * 2), g: -0.005, drag: 0.98, ov: true, seed: rnd() * 9 });
        break;
      }
      // The tidal bore: a crest of pink water curling over as it rolls forward along the floor.
      case 'pororoca': {
        const f = e.face || 1, top = this.floorAt(x, y, 30) ?? y;
        this.over.push({ k: 'wave', x: Math.round(x), y: Math.round(top), f, t: 0, life: 0.5, max: 0.5, run: 40 });
        this.burst('drop', x, top - 3, 8, { a: f > 0 ? -0.6 : Math.PI + 0.6, spread: 0.8, s: 2.2, life: 0.45, colors: ['#ffffff', '#ffd0de', '#ff9cb8'], g: 0.14, ov: true, rnd });
        break;
      }
      // The mud slide's trail: a glossy streak of slime left along the floor.
      case 'slime': {
        const f = e.face || 1, top = this.floorAt(x, y, 30);
        if (top == null) break;
        const g = this.fg;
        for (let i = 0; i < 14; i++) {
          g.globalAlpha = 0.9 - i * 0.045;
          g.fillStyle = i % 6 === 2 ? '#fff4f6' : i % 2 ? '#f69bb7' : '#ffd0de';
          g.fillRect(Math.round(x - f * i), top, 1, 1);
          if (i % 5 === 3 && rnd() < 0.7) { g.fillStyle = '#d26f90'; g.fillRect(Math.round(x - f * i), top + 1, 1, 1 + Math.floor(rnd() * 2)); }
        }
        g.globalAlpha = 1;
        break;
      }
      // Xolotl answers: the room goes dark and red, the evening star flares over the axolotl and
      // lightning leaps from it into every clone it has.
      case 'xolotlCast': {
        const sy = y - 26;
        this.dim = { life: 0.9, max: 0.9 };
        this.hemo.push({ k: 'venus', x: Math.round(x), y: Math.round(sy), t: 0, life: 0.9, max: 0.9 });
        (e.targets || []).forEach((tg, i) => this.hemo.push({ k: 'xzap', x, y: sy, x2: X(tg.x), y2: X(tg.y), t: 0, delay: 0.05 + i * 0.05, life: 0.45 + i * 0.05, max: 0.45 + i * 0.05, seed: (e.id || 1) * 11 + i }));
        this.rings.push({ x, y: sy, life: 0.4, max: 0.4, r: 26, color: '#ff3a2a' });
        this.rings.push({ x, y: sy, life: 0.6, max: 0.6, r: 48, color: '#ffd040' });
        this.burst('spark', x, sy, 14, { spread: 6.3, s: 2.4, life: 0.5, colors: HELL, g: 0.02, drag: 0.94, em: true, rnd });
        break;
      }
      // A clone turning demon: a burst of embers, a ring of fire and a puff of black smoke.
      case 'demonMorph':
        this.flashes.push({ x, y, life: 0.12, max: 0.12, kind: 'star', p: 2.4, a: Math.PI / 4, seed: e.id || 1, color: '#ffd040' });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 16, color: '#ff5a1a' });
        this.burst('spark', x, y, 16, { spread: 6.3, s: 2.4, life: 0.55, colors: HELL, g: -0.02, drag: 0.93, em: true, rnd });
        this.burst('smoke', x, y, 5, { a: -Math.PI / 2, spread: 1.8, s: 0.7, life: 0.8, colors: ['#3a2a2a', '#2a1a1c', '#4a3236'], g: -0.03, drag: 0.94, size: 2, grow: 0.04, rnd });
        break;
      case 'embers': this.burst('spark', x, y, e.n || 5, { a: -Math.PI / 2, spread: 1.4, s: 0.9, life: 0.8, colors: HELL, g: -0.025, drag: 0.96, em: true, rnd }); break;
      // The Sacrifício: the demon goes up in fire and leaves Xolotl's dog skull scorched on the wall.
      case 'sacrifice': {
        const R = X(e.r || 34);
        this.flashes.push({ x, y, life: 0.2, max: 0.2, kind: 'star', p: 4, a: Math.PI / 4, seed: e.id || 1, color: '#ffd040' });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: R, color: '#fff2a0' });
        this.rings.push({ x, y, life: 0.45, max: 0.45, r: R * 1.4, color: '#ff3a1a' });
        this.burst('fire', x, y, 26, { spread: 6.3, s: 2.4, life: 0.6, colors: FIRE, g: -0.05, drag: 0.92, size: 2, em: true, grow: -0.02, rnd });
        this.burst('spark', x, y, 18, { spread: 6.3, s: 3.4, life: 0.5, colors: HELL, g: 0.06, drag: 0.95, em: true, rnd });
        this.burst('smoke', x, y, 10, { a: -Math.PI / 2, spread: 2, s: 1, life: 1.2, colors: [P.smoke, '#3a2a2a', '#2a1a1c'], g: -0.035, drag: 0.94, size: 3, grow: 0.05, rnd });
        const top = this.floorAt(x, y, 40);
        if (top != null) this.skull(Math.round(x), top);
        break;
      }
      // Where the maw closes: two rows of teeth snapping shut, and their dents left behind.
      case 'toothMarks': {
        this.over.push({ k: 'teeth', x: Math.round(x), y: Math.round(y), t: 0, life: 0.3, max: 0.3 });
        const g = this.wg, bx = Math.round(x), by = Math.round(y);
        g.fillStyle = 'rgba(26,8,18,0.55)';
        for (let i = -2; i <= 2; i++) { const dy = Math.abs(i) === 2 ? 1 : 0; g.fillRect(bx + i * 2, by - 3 + dy, 1, 1); g.fillRect(bx + i * 2, by + 3 - dy, 1, 1); }
        if (this.gore) { g.fillStyle = 'rgba(180,36,58,0.7)'; g.fillRect(bx - 2, by - 3, 1, 1); g.fillRect(bx + 2, by + 3, 1, 1); }
        break;
      }
      case 'gulp':
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 22, color: '#c8f080' });
        this.burst('spark', x + (e.face || 1) * 8, y - 2, 12, { spread: 6.3, s: 2.2, life: 0.4, colors: SLIME, g: 0.12, drag: 0.94, rnd });
        this.burst('blood', x + (e.face || 1) * 8, y, 6, { a: -Math.PI / 2, spread: 2.4, s: 1.6, life: 0.6, colors: ['#c8f080', '#9be05a'], g: 0.2, stick: true, rnd });
        break;
      case 'copyStar': {
        const cols = copyCols(e.copy ?? -1);
        this.flashes.push({ x, y: y - 6, life: 0.2, max: 0.2, kind: 'star', p: 4, a: Math.PI / 4, seed: e.id || 1, color: cols[0] });
        this.rings.push({ x, y: y - 4, life: 0.35, max: 0.35, r: 34, color: cols[0] });
        this.rings.push({ x, y: y - 4, life: 0.5, max: 0.5, r: 52, color: '#ffffff' });
        this.burst('spark', x, y - 6, 22, { spread: 6.3, s: 3, life: 0.6, colors: cols, g: 0.04, drag: 0.94, em: true, rnd });
        break;
      }
      case 'copyPoof':
        this.burst('steam', x, y, 10, { spread: 6.3, s: 1.2, life: 0.6, colors: ['#e8e4f0', '#c8f080', '#a8a0c0'], em: true, g: -0.03, drag: 0.92, size: 2, grow: 0.05, rnd });
        break;
      case 'spitStar': {
        const f = e.face || 1;
        this.flashes.push({ x, y, life: 0.16, max: 0.16, kind: 'star', p: 3.4, a: f > 0 ? 0 : Math.PI, seed: e.id || 1, color: '#fff2a0' });
        this.rings.push({ x, y, life: 0.25, max: 0.25, r: 20, color: '#ffffff' });
        this.burst('spark', x, y, 14, { a: f > 0 ? 0 : Math.PI, spread: 1.4, s: 3.4, life: 0.4, colors: ['#ffffff', '#fff2a0', '#c8f080'], g: 0, em: true, rnd });
        this.burst('blood', x, y, 8, { a: f > 0 ? -0.2 : Math.PI + 0.2, spread: 1, s: 2.6, life: 0.6, colors: ['#c8f080', '#9be05a'], g: 0.2, stick: true, rnd });
        break;
      }
      case 'bigPalm': {
        const f = e.face || 1;
        this.flashes.push({ x, y, life: 0.16, max: 0.16, kind: 'star', p: 4.4, a: f > 0 ? 0 : Math.PI, seed: e.id || 1, color: '#e8ffd0' });
        this.rings.push({ x, y, life: 0.22, max: 0.22, r: 18, color: '#ffffff' });
        this.rings.push({ x, y, life: 0.34, max: 0.34, r: 30, color: '#9be05a' });
        this.burst('spark', x, y, 14, { a: f > 0 ? 0 : Math.PI, spread: 2.2, s: 3, life: 0.35, colors: SLIME, g: 0.1, em: true, rnd });
        break;
      }
      // The croak: the sound comes off him in rings, wobbling outward to the edge of its reach.
      case 'croak': {
        const R = X(e.r || 90);
        for (let i = 0; i < 4; i++) this.rings.push({ x, y, life: 0.3 + i * 0.1, max: 0.3 + i * 0.1, r: R * (0.45 + i * 0.18), color: i % 2 ? '#ffffff' : '#c8f080' });
        this.flashes.push({ x, y, life: 0.12, max: 0.12, kind: 'star', p: 2.6, a: Math.PI / 4, seed: e.id || 1, color: '#e8ffd0' });
        this.burst('spark', x, y, 16, { spread: 6.3, s: 2.6, life: 0.35, colors: ['#ffffff', '#c8f080'], g: 0, em: true, rnd });
        break;
      }
      case 'clap':
        this.flashes.push({ x, y, life: 0.12, max: 0.12, kind: 'star', p: 3, a: Math.PI / 4, seed: e.id || 1, color: '#ffe2a0' });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 30, color: '#ffffff' });
        this.rings.push({ x, y, life: 0.42, max: 0.42, r: 48, color: '#ffb070' });
        this.burst('spark', x, y, 10, { spread: 6.3, s: 2.6, life: 0.3, colors: ['#ffffff', '#ffe2a0'], g: 0, em: true, rnd });
        break;
      // A rival crushed into the wall by the charge: a flash, flying scrap and a dent that stays.
      case 'wallSplat': {
        const f = e.face || 1;
        this.flashes.push({ x, y, life: 0.14, max: 0.14, kind: 'star', p: 4, a: f > 0 ? Math.PI : 0, seed: e.id || 1 });
        this.rings.push({ x, y, life: 0.3, max: 0.3, r: 26, color: '#ffe6c8' });
        this.burst('debris', x, y, 12, { a: f > 0 ? Math.PI : 0, spread: 1.6, s: 3, life: 1.2, colors: DEBRIS.metal, g: 0.18, b: 0.3, size: 2, rnd });
        this.burst('dust', x, y, 8, { spread: 6.3, s: 1, life: 0.7, colors: DUST, g: 0, drag: 0.92, size: 2, rnd });
        this.wg.fillStyle = 'rgba(14,10,18,0.7)';
        for (let i = 0; i < 6; i++) { let cx = x, cy = y; const a = rnd() * Math.PI * 2; for (let k = 0; k < 6; k++) { cx += Math.cos(a) * 1.4; cy += Math.sin(a) * 1.4; this.wg.fillRect(Math.round(cx), Math.round(cy), 1, 1); } }
        break;
      }
      // A blow that the beast's hide shrugs off: a dull orange spark, no flinch.
      case 'armor':
        this.flashes.push({ x, y, life: 0.08, max: 0.08, kind: 'star', p: 1.4, a: e.a || 0, seed: e.id || 1, color: '#ffb070' });
        this.rings.push({ x, y, life: 0.2, max: 0.2, r: 12, color: '#ffb070' });
        break;
      case 'requiemStart': this.hemo.push({ k: 'bubble', x, y, owner: e.owner, t: 0, life: 1.6, max: 1.6 }); break;
      case 'requiemCut': {
        const P = this.pal();
        this.hemo.push({ k: 'cut', x, y, x2: X(e.x2), y2: X(e.y2), owner: e.owner, t: 0, life: 1.4, max: 1.4 });
        this.burst('spark', (x + X(e.x2)) / 2, (y + X(e.y2)) / 2, 5, { spread: 6.3, s: 2, life: 0.25, colors: [P.light, P.glint], g: 0.04, em: true, rnd });
        break;
      }
      case 'requiemBurst': {
        const P = this.pal();
        // Every cut of the web and the bubble flash white and burst together.
        for (const h of this.hemo) if (h.owner === e.owner && (h.k === 'cut' || h.k === 'bubble')) { h.flash = true; h.life = Math.min(h.life, 0.16); }
        this.rings.push({ x, y, life: 0.6, max: 0.6, r: 70, color: P.light });
        this.flashes.push({ x, y, life: 0.24, max: 0.24, kind: 'star', p: 5, a: Math.PI / 4, seed: e.id || 1, color: P.glint });
        break;
      }
      case 'drainStream': {
        // The drink: blood arcs into Nox, who flares with a pulse of stolen life.
        const tx = X(e.tx), ty = X(e.ty), P = this.pal();
        this.hemo.push({ k: 'stream', x, y, tx, ty, t: 0, life: 0.42, max: 0.42, seed: e.id || 1 });
        this.rings.push({ x: tx, y: ty, life: 0.4, max: 0.4, r: 20, color: P.light });
        this.burst('spark', tx, ty + 6, 10, { a: -Math.PI / 2, spread: 1.6, s: 1.4, life: 0.55, colors: [P.light, P.glint, P.mid], g: -0.03, drag: 0.96, em: true, rnd });
        break;
      }
      case 'spawn': this.rings.push({ x, y, life: 0.5, max: 0.5, r: 26, color: e.color }); this.flashes.push({ x, y, life: 0.35, max: 0.35, kind: 'beam', color: e.color }); break;
      case 'slash':
        // Nox's claws tear crescent gashes of blood that run and drip.
        if (e.kind === 'blood') { if (!e.down) this.hemo.push({ k: 'claw', x, y, f: e.face || 1, r: X(e.size || 30) * 0.95, t: 0, life: 0.28, max: 0.28, seed: e.id || 1, up: e.up, down: e.down }); break; }
        this.smears.push({ x, y, face: e.face || 1, size: X(e.size || 40), kind: e.kind, color: e.color || '#fff', life: 0.14, max: 0.14, fin: e.fin }); break;
      case 'zap': this.zaps.push({ x1: X(e.x1), y1: X(e.y1), x2: X(e.x2), y2: X(e.y2), life: 0.12, seed: e.id }); this.burst('spark', X(e.x2), X(e.y2), 4, { s: 2, life: 0.2, colors: [P.zap0, P.zap1, P.zap2], em: true, g: 0.05, rnd }); break;
      case 'spray': this.burst('spray', x, y, 3, { a: e.a, spread: 0.35, s: 3.2, life: 0.5, colors: ['#f4f8ff', '#d8e4f4', '#bfd0e8'], g: -0.005, drag: 0.93, size: 2, grow: 0.08, rnd }); break;
      case 'grind': {
        const top = X(MAP.floorY) + 2;
        if (e.k === 'blood' && this.gore) this.burst('blood', x, X(MAP.pit.y0) + 8, 26, { a: -Math.PI / 2, spread: 0.7, s: 5, life: 1, colors: BLOOD, g: 0.16, stick: true, size: 2, rnd });
        this.burst(e.k === 'wood' ? 'debris' : 'spark', x, top + 14, 14, { a: -Math.PI / 2, spread: 0.9, s: 4.5, life: 0.7, colors: e.k === 'wood' ? DEBRIS.wood : [P.fire0, P.fire1], g: 0.16, em: e.k !== 'wood', rnd });
        break;
      }
      case 'poof': this.burst('smoke', x, y, 5, { s: 0.8, life: 0.5, colors: ['#b8b1ba', '#8a8098'], g: -0.02, drag: 0.9, size: 2, rnd }); break;
      case 'decal': this.decal(e, x, y, rnd); break;
    }
  }

  splat(g, x, y, size, rnd) {
    const n = Math.round(size * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * size;
      g.fillStyle = BLOOD[Math.floor(rnd() * 3)];
      g.globalAlpha = 0.85;
      g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), 1, 1);
      if (rnd() < 0.15) { const len = 2 + Math.floor(rnd() * 5); g.fillStyle = P.blood1; g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), 1, len); }
    }
    g.globalAlpha = 1;
  }

  // A splat of the axolotl's goo (or a demon's dark blood) on the wall.
  goo(g, x, y, size, rnd, demon = false) {
    const cols = demon ? ['#7a1a2a', '#4a0c18', '#b02a44'] : ['#f69bb7', '#ffd0de', '#d26f90'];
    for (let i = 0; i < Math.round(size * 3); i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * size;
      g.globalAlpha = 0.8;
      g.fillStyle = cols[Math.floor(rnd() * 3)];
      g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), 1, 1);
      if (rnd() < 0.12) g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), 1, 2 + Math.floor(rnd() * 3));
    }
    g.globalAlpha = 1;
  }

  // The top of the floor or catwalk under (x, y), within reach pixels below it (or just above).
  floorAt(x, y, reach = 24) {
    let best = null;
    for (const t of TOPS) if (x >= t.x0 && x <= t.x1 && t.y >= y - 4 && t.y - y <= reach && (best === null || t.y < best)) best = t.y;
    return best;
  }

  // Xolotl's dog skull burnt into the wall right above the floor, in a ring of scorch, its
  // sockets glowing with embers for a moment.
  skull(x, top) {
    this.decal({ k: 'scorch', s: 1.3 }, x, top - 6, Math.random);
    const g = this.wg, w = SKULL[0].length, h = SKULL.length, x0 = x - (w >> 1), y0 = top - h;
    const A = { a: 0.92, b: 0.6, d: 0.32 };
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const c = SKULL[yy][xx];
      if (!A[c]) continue;
      g.globalAlpha = A[c];
      g.fillStyle = BURN_PAL[c];
      g.fillRect(x0 + xx, y0 + yy, 1, 1);
    }
    g.globalAlpha = 1;
    const eyes = [];
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (SKULL[yy][xx] === 'v') eyes.push([x0 + xx, y0 + yy]);
    this.hemo.push({ k: 'skullGlow', x, y: y0 + 4, eyes, t: 0, life: 1.8, max: 1.8 });
  }

  // How dark and red the screen is under Xolotl's cast (0..1).
  dimK() {
    const d = this.dim;
    if (!d) return 0;
    return Math.min(1, (d.max - d.life) / 0.08) * Math.min(1, d.life / 0.3);
  }

  decal(e, x, y, rnd) {
    const g = e.layer === 'floor' ? this.fg : this.wg;
    if (e.k === 'hole') {
      g.fillStyle = '#100c18'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillStyle = 'rgba(120,110,140,0.6)'; g.fillRect(Math.round(x) + 1, Math.round(y), 1, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
    } else if (e.k === 'scorch') {
      const r = (e.s || 2) * 8;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const d = Math.hypot(xx, yy * (e.layer === 'floor' ? 2.5 : 1)) / r;
        if (d < 1 && bayer(xx + 64, yy + 64) < (1 - d) * 1.2) { g.fillStyle = d < 0.4 ? 'rgba(12,8,14,0.85)' : 'rgba(30,22,30,0.6)'; g.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); }
      }
    } else if (e.k === 'blood' && this.gore) this.splat(g, x, y, e.s || 3, rnd);
  }

  update(dt) {
    const tops = TOPS;
    for (const p of this.parts) {
      p.life -= dt;
      const ox = p.x, oy = p.y;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy;
      if (p.grow) p.s = Math.max(0.5, p.s + p.grow);
      if (p.vy > 0 && (p.stick || p.b)) {
        for (const t of tops) {
          if (p.x >= t.x0 && p.x <= t.x1 && oy <= t.y && p.y >= t.y) {
            if (p.stick && (p.k !== 'gib' || Math.abs(p.vy) < 2.5)) {
              this.fg.fillStyle = p.c;
              this.fg.fillRect(Math.round(p.x), t.y, Math.max(1, Math.round(p.s + (Math.random() < 0.3 ? 1 : 0))), 1);
              if (Math.random() < 0.18) this.fg.fillRect(Math.round(p.x), t.y + 1, 1, 1 + Math.floor(Math.random() * 3));
              p.life = 0;
            } else if (p.b) {
              p.y = t.y - 0.5; p.vy *= -p.b; p.vx *= 0.7;
              if (p.k === 'casing' && Math.abs(p.vy) > 0.4) this.onSound('casing', p.x / S);
              if (Math.abs(p.vy) < 0.25) { p.vy = 0; p.g = 0; p.vx *= 0.5; }
            }
            break;
          }
        }
      }
      if (p.k === 'blood' && p.life <= 0 && p.y < 320 && Math.random() < 0.15) { this.wg.fillStyle = p.c; this.wg.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      if (p.x < -10 || p.x > VIEW_W + 10 || p.y > VIEW_H + 10) p.life = 0;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const o of this.over) {
      o.t += dt;
      // The geyser throws a crown of spray as it tops out, and rains back down as it collapses.
      if (o.k === 'geyser') {
        if (!o.crown && o.t >= 0.22) { o.crown = true; this.burst('drop', o.x, o.y - 40, 12, { a: -Math.PI / 2, spread: 2.6, s: 1.8, life: 0.55, colors: WATER, g: 0.12, ov: true }); }
        if (o.t > 0.36 && Math.random() < 0.7) this.burst('drop', o.x + (Math.random() - 0.5) * 6, o.y - 40 * (1 - (o.t - 0.36) / (o.max - 0.36)), 1, { a: Math.PI / 2, spread: 1.2, s: 1, life: 0.35, colors: WATER, g: 0.2, ov: true });
      }
      // Spray flies off the lip of the wave as it rolls.
      if (o.k === 'wave' && o.t < 0.34 && Math.random() < 0.8) {
        const run = o.run * ease(Math.min(1, o.t / 0.32));
        this.burst('drop', o.x + o.f * (run + 2), o.y - 8, 1, { a: o.f > 0 ? -0.9 : Math.PI + 0.9, spread: 0.8, s: 1.6, life: 0.3, colors: ['#ffffff', '#ffd0de'], g: 0.14, ov: true });
      }
    }
    if (this.dim && (this.dim.life -= dt) <= 0) this.dim = null;
    for (const h of this.hemo) {
      h.t += dt;
      // A spike bursting out throws blood off its tip and kicks up the floor.
      if (h.k === 'spike' && !h.burst && h.t >= h.delay) {
        h.burst = true;
        const rnd = seeded(h.seed);
        this.burst('spark', h.x, h.y - h.h, 3, { a: -Math.PI / 2, spread: 1.2, s: 1.8, life: 0.3, colors: [this.pal().light, this.pal().glint], g: 0.1, em: true, rnd });
        if (this.gore) this.burst('blood', h.x, h.y - h.h + 2, 4, { a: -Math.PI / 2, spread: 1.6, s: 1.8, life: 0.8, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd });
        this.burst('dust', h.x, h.y - 1, 2, { a: -Math.PI / 2, spread: 2.4, s: 0.7, life: 0.4, colors: ['#6a6078', '#8a7f95'], g: -0.01, drag: 0.92, size: 2, rnd });
      }
    }
    for (const list of [this.smears, this.flashes, this.zaps, this.rings, this.hemo, this.over]) for (const s of list) s.life -= dt;
    this.smears = this.smears.filter(s => s.life > 0);
    this.flashes = this.flashes.filter(s => s.life > 0);
    this.zaps = this.zaps.filter(s => s.life > 0);
    this.rings = this.rings.filter(s => s.life > 0);
    this.hemo = this.hemo.filter(s => s.life > 0);
    this.over = this.over.filter(s => s.life > 0);
  }

  pal() { return bloodPal(this.gore); }

  // A put-away scythe coming apart: drops of blood shaken off along the blade.
  scytheBurst(x, y, tx, ty) {
    const P = this.pal(), rnd = Math.random;
    for (let i = 0; i <= 6; i++) {
      const k = i / 6, px = x + (tx - x) * k, py = y + (ty - y) * k;
      this.burst('spark', px, py, 2, { spread: 6.3, s: 1, life: 0.35, colors: [P.light, P.mid, P.glint], g: 0.08, em: true, rnd });
      if (this.gore) this.burst('blood', px, py, 1, { spread: 6.3, s: 1, life: 0.6, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd });
    }
  }

  // Spikes, beams, supernovas and drinking streams of blood, drawn bright over the lighting.
  drawHemo(g, ox, oy, t) {
    const P = this.pal();
    const dot = (c, x, y, w = 1, h = w) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    for (const h of this.hemo) {
      if (h.k === 'venus') {
        // The evening star flares up in three steps, burns white-hot at the heart, then blinks out.
        const k = h.t / h.max, m = VENUS[h.t < 0.04 ? 0 : h.t < 0.08 || k > 0.82 ? 1 : 2];
        if (k > 0.66 && Math.floor(h.t * 24) % 2) continue;
        const hot = h.t < 0.25 && Math.floor(h.t * 30) % 2, x0 = h.x - (m[0].length >> 1), y0 = h.y - (m.length >> 1);
        for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length; x++) {
          const c = m[y][x];
          if (c !== '.') dot(c === 'y' && hot ? '#ffffff' : BURN_PAL[c], x0 + x, y0 + y);
        }
        continue;
      }
      if (h.k === 'xzap') {
        // Red lightning from the star into a clone, jumping to a new path every other frame.
        const lt = h.t - h.delay;
        if (lt < 0 || (lt > 0.12 && Math.floor(lt * 30) % 3 === 0)) continue;
        const r = seeded(h.seed * 97 + Math.floor(lt * 30)), n = 7;
        let x = h.x, y = h.y;
        for (let i = 1; i <= n; i++) {
          const tx = h.x + (h.x2 - h.x) * (i / n) + (i < n ? (r() - 0.5) * 9 : 0), ty = h.y + (h.y2 - h.y) * (i / n) + (i < n ? (r() - 0.5) * 9 : 0);
          const steps = Math.max(1, Math.round(Math.max(Math.abs(tx - x), Math.abs(ty - y))));
          for (let s = 0; s <= steps; s++) {
            const px = x + (tx - x) * (s / steps), py = y + (ty - y) * (s / steps);
            dot('#ff2a3a', px + 1, py); dot(lt < 0.08 ? '#ffffff' : '#fff2a0', px, py);
          }
          x = tx; y = ty;
        }
        continue;
      }
      if (h.k === 'skullGlow') {
        // Embers in the scorched skull's sockets, fading from gold to a dull red.
        const k = h.t / h.max;
        for (const [ex, ey] of h.eyes) if ((ex * 7 + ey * 3 + Math.floor(h.t * 12)) % 5 || k < 0.4) dot(k < 0.3 ? '#ffd040' : k < 0.65 ? '#ff5a1a' : '#9a1a10', ex, ey);
        continue;
      }
      if (h.k === 'twinkle') {
        // A four-point twinkle on the regrown part.
        const k = h.t / h.max, r = Math.round(3 * Math.sin(k * Math.PI));
        dot('#ffffff', h.x, h.y);
        for (let i = 1; i <= r; i++) { const c = i === r ? '#ff9cc0' : '#ffffff'; dot(c, h.x + i, h.y); dot(c, h.x - i, h.y); dot(c, h.x, h.y + i); dot(c, h.x, h.y - i); }
        continue;
      }
      if (h.k === 'whoosh') {
        // The snap smear: a band bowed out from the body along the claw's path, hot at the claw.
        const mx = (h.x + h.x2) / 2, my = (h.y + h.y2) / 2, ox2 = mx - h.cx, oy2 = my - h.cy, ol = Math.hypot(ox2, oy2) || 1;
        const qx = mx + (ox2 / ol) * 7, qy = my + (oy2 / ol) * 7, k = h.t / h.max;
        g.globalAlpha = 1 - k * 0.7;
        for (let u = 0; u <= 1; u += 0.04) {
          const a = 1 - u, x = a * a * h.x + 2 * a * u * qx + u * u * h.x2, y = a * a * h.y + 2 * a * u * qy + u * u * h.y2;
          const w = Math.max(1, Math.round(u * 3 * (1 - k)));
          const ww = w + (h.wide && u > 0.3 ? h.wide : 0);
          dot(u > 0.7 ? '#ffffff' : u > 0.35 ? h.c1 || P.glint : h.c2 || P.light, x - ww / 2, y - ww / 2, ww);
        }
        g.globalAlpha = 1;
      } else if (h.k === 'glint') {
        // A star of light in the eye just before the blow.
        const k = h.t / h.max, r = Math.round(3 * Math.sin(k * Math.PI));
        dot('#ffffff', h.x, h.y);
        const tip = h.c2 || P.light;
        for (let i = 1; i <= r; i++) { dot(i === r ? tip : '#ffffff', h.x + i, h.y); dot(i === r ? tip : '#ffffff', h.x - i, h.y); dot(i === r ? tip : '#ffffff', h.x, h.y + i); dot(i === r ? tip : '#ffffff', h.x, h.y - i); }
      } else if (h.k === 'bat') {
        // Little bats flapping out from the blink, or in toward it.
        const k = h.t / h.max, e = h.arrive ? 1 - k : k, d = 4 + e * 26;
        const x = h.x + h.ox * d, y = h.y + h.oy * d + Math.sin(h.t * 30 + h.seed) * 1.5, up = Math.floor(h.t * 24 + h.seed) % 2;
        g.globalAlpha = h.arrive ? Math.min(1, k * 3) : Math.min(1, (1 - k) * 2);
        dot(P.out, x - 1, y, 3, 1);
        dot(P.out, x - 2, y + (up ? -1 : 1), 1, 1); dot(P.out, x + 2, y + (up ? -1 : 1), 1, 1);
        dot(P.light, x, y, 1, 1);
        g.globalAlpha = 1;
      } else if (h.k === 'streak') {
        const k = h.t / h.max, lo = Math.min(h.x, h.x2), hi = Math.max(h.x, h.x2);
        g.globalAlpha = 1 - k;
        dot(P.mid, lo, h.y - 1, hi - lo + 1, k < 0.4 ? 3 : 1);
        dot(P.light, lo, h.y, hi - lo + 1, 1);
        if (k < 0.3) dot(P.glint, lo, h.y, hi - lo + 1, 1);
        g.globalAlpha = 1;
      } else if (h.k === 'xcut') {
        // The cut opens on the rival a beat after Nox has gone past.
        const lt = h.t - h.delay;
        if (lt < 0) continue;
        if (!h.burst) {
          h.burst = true;
          const rnd = seeded(h.seed);
          this.burst('spark', h.x, h.y, 8, { spread: 6.3, s: 2.6, life: 0.3, colors: [P.light, P.glint, P.mid], g: 0.08, em: true, rnd });
          if (this.gore) this.burst('blood', h.x, h.y, 10, { a: -Math.PI / 2, spread: 2.6, s: 2.2, life: 0.9, colors: BLOOD, g: 0.16, size: 1, stick: true, rnd });
        }
        const k = lt / (h.max - h.delay), L = 9 * Math.min(1, lt / 0.04);
        g.globalAlpha = k > 0.5 ? (1 - k) / 0.5 : 1;
        for (const s of [1, -1]) for (let d = -L; d <= L; d += 0.6) {
          const w = Math.max(1, Math.round(2 * (1 - Math.abs(d) / (L + 0.01))));
          dot(Math.abs(d) < L * 0.4 && k < 0.4 ? P.glint : P.light, h.x + d, h.y + d * s * 0.9, w);
        }
        g.globalAlpha = 1;
      } else if (h.k === 'crack') {
        const k = h.t / h.max, rnd = seeded(h.seed);
        g.globalAlpha = 1 - k;
        for (let i = 0; i < 5; i++) {
          let x = h.x, y = h.y - 1;
          const dir = i % 2 ? 1 : -1, len = 6 + rnd() * 10;
          for (let d = 0; d < len * Math.min(1, h.t / 0.06); d++) { x += dir; y -= rnd() < 0.3 ? 1 : 0; dot(d < 3 ? '#ffe6c8' : '#a89cb8', x, y); }
        }
        g.globalAlpha = 1;
      } else if (h.k === 'bubble') {
        // The prison of blood: a wobbling sphere around the held rival.
        const r = 14 + Math.sin(h.t * 18) * 0.8;
        g.globalAlpha = h.flash ? 1 : 0.32;
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y * 1.05); if (d < r - 1) dot(h.flash ? P.glint : P.mid, h.x + x, h.y + y); }
        g.globalAlpha = 1;
        for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; dot(h.flash ? '#ffffff' : a > 3.6 && a < 5 ? P.glint : P.light, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r); }
      } else if (h.k === 'cut') {
        // Each cut of the requiem stays hanging in the air until they all burst.
        const sweep = Math.min(1, h.t / 0.05), len = Math.hypot(h.x2 - h.x, h.y2 - h.y), dx = (h.x2 - h.x) / len, dy = (h.y2 - h.y) / len;
        const fresh = h.t < 0.12, w = h.flash ? 3 : fresh ? 2 : 1;
        for (let d = 0; d <= len * sweep; d += 0.7) {
          const taper = Math.sin((d / len) * Math.PI);
          const ww = Math.max(1, Math.round(w * taper + (h.flash ? 1 : 0)));
          dot(h.flash ? '#ffffff' : fresh ? P.glint : P.light, h.x + dx * d - ww / 2, h.y + dy * d - ww / 2, ww);
        }
      } else if (h.k === 'spike') {
        const lt = h.t - h.delay;
        if (lt < 0) continue;
        // Shoots up in a few frames, holds, then crumbles from the tip.
        const grow = Math.min(1, lt / 0.04), crumble = h.life < 0.2 ? h.life / 0.2 : 1;
        const H = Math.max(1, Math.round(h.h * grow * crumble));
        for (let y = 0; y < H; y++) {
          const k = (y + 1) / h.h, half = Math.max(0, Math.round(h.w * k)), lean = Math.round(h.f * (H - y) * 0.18);
          const yy = h.y - H + y, cx = h.x + lean;
          dot(P.out, cx - half - 1, yy, half * 2 + 3, 1);
          if (half > 0) dot(P.mid, cx - half, yy, half * 2 + 1, 1);
          dot(h.f > 0 ? P.light : P.dark, cx - half, yy);
          dot(h.f > 0 ? P.dark : P.light, cx + half, yy);
        }
        dot(P.glint, h.x + Math.round(h.f * H * 0.18), h.y - H);
        dot(P.out, h.x - h.w - 2, h.y - 1, h.w * 2 + 5, 1);
        dot(P.mid, h.x - h.w - 1, h.y - 1, h.w * 2 + 3, 1);
      } else if (h.k === 'vein') {
        const k = Math.min(1, h.t / h.run), x1 = h.x + (h.x2 - h.x) * k, fade = h.life < 0.2 ? h.life / 0.2 : 1;
        if (fade < 0.5 && Math.floor(h.t * 30) % 2) continue;
        const lo = Math.min(h.x, x1), hi = Math.max(h.x, x1);
        dot(P.out, lo - 1, h.y - 1, hi - lo + 3, 2);
        dot(P.mid, lo, h.y - 1, hi - lo + 1, 1);
        for (let x = lo; x <= hi; x += 3) dot(P.light, x + ((x * 7) % 2), h.y - 1);
        dot(P.glint, x1, h.y - 1);
      } else if (h.k === 'claw') {
        // Three parallel gashes torn diagonally through the rival, fading as drops run off them.
        const k = h.t / h.max, sweep = Math.min(1, h.t / 0.05), run = Math.max(0, k - 0.3);
        const L = h.r * 1.5, ux = h.f * 0.62, uy = h.up ? -0.78 : 0.78, nx = -uy, ny = ux;
        g.globalAlpha = k > 0.45 ? Math.max(0, (1 - k) / 0.55) : 1;
        for (let l = -1; l <= 1; l++) {
          const sx = h.x - ux * L * 0.5 + nx * l * 4.5 * h.f, sy = h.y - uy * L * 0.5 + ny * l * 4.5 * h.f;
          for (let d = 0; d <= L * sweep; d += 0.6) {
            const u = d / L, bow = Math.sin(u * Math.PI) * 2.2, w = Math.max(1, Math.round(1.9 * Math.sin(u * Math.PI)));
            const x = sx + ux * d + nx * bow * h.f, y = sy + uy * d + ny * bow * h.f;
            dot(u < 0.15 || u > 0.85 ? P.mid : P.light, x, y, w);
            if (k < 0.3 && u > 0.3 && u < 0.7) dot(P.glint, x, y);
            if (run > 0 && Math.abs(u - 0.5 - l * 0.12) < 0.015) dot(P.mid, x, y + 1, 1, Math.round(run * 14));
          }
        }
        g.globalAlpha = 1;
      } else if (h.k === 'beam') {
        const k = h.t / h.max, rnd = seeded(h.seed * 13 + Math.floor(h.t * 40));
        const w = k < 0.12 ? 3 + (k / 0.12) * 4 : 7 * Math.pow(Math.max(0, 1 - (k - 0.12) / 0.88), 0.7);
        const len = Math.hypot(h.x2 - h.x, h.y2 - h.y), dx = (h.x2 - h.x) / len, dy = (h.y2 - h.y) / len;
        const layers = [[w, P.out], [w - 2, P.mid], [w - 4, P.light], [k < 0.5 ? 1 : 0, P.glint]];
        // Two strands of blood twisting around the beam while it is at full strength.
        if (k < 0.65) for (let d = 0; d <= len; d += 1) {
          const s = Math.sin(d * 0.22 - h.t * 46) * (w / 2 + 2), cx = h.x + dx * d, cy = h.y + dy * d;
          dot(s > 0 ? P.light : P.dark, cx - dy * s, cy + dx * s);
          dot(s > 0 ? P.dark : P.light, cx + dy * s, cy - dx * s);
        }
        for (const [lw, c] of layers) {
          if (lw <= 0) continue;
          g.fillStyle = c;
          for (let d = 0; d <= len; d += 1) {
            const jag = d % 3 === 0 ? Math.round((rnd() - 0.5) * 2) : 0, half = Math.max(0.5, lw / 2 + (c === P.out ? jag : 0));
            const cx = h.x + dx * d, cy = h.y + dy * d;
            for (let s = -half; s <= half; s += 1) g.fillRect(Math.round(cx - dy * s + ox), Math.round(cy + dx * s + oy), 1, 1);
          }
        }
        // Droplets shed off the sides as it fades.
        if (k > 0.3) for (let i = 0; i < 10; i++) { const d = rnd() * len, s = (rnd() < 0.5 ? -1 : 1) * (w / 2 + 1 + rnd() * 3 * k); dot(rnd() < 0.5 ? P.mid : P.light, h.x + dx * d - dy * s, h.y + dy * d + dx * s + k * 4); }
      } else if (h.k === 'nova') {
        // Spikes of blood stab out all around the rival, then draw back.
        const k = h.t / h.max, out = k < 0.25 ? ease(k / 0.25) : 1 - (k - 0.25) / 0.75, rnd = seeded(h.seed);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rnd() * 0.3, L = (10 + rnd() * 14) * out, ca = Math.cos(a), sa = Math.sin(a);
          for (let d = 2; d < L; d++) {
            const wd = Math.max(1, Math.round(3 * (1 - d / L)));
            dot(d > L - 2 ? P.glint : wd > 1 ? P.mid : P.light, h.x + ca * d - wd / 2, h.y + sa * d * 0.85 - wd / 2, wd);
          }
        }
        if (k < 0.3) { dot(P.out, h.x - 3, h.y - 3, 7); dot(P.light, h.x - 2, h.y - 2, 5); dot(P.glint, h.x - 1, h.y - 1, 3); }
      } else if (h.k === 'stream') {
        // An arc of blood flowing from the bitten rival into Nox's mouth.
        const k = h.t / h.max, mx = (h.x + h.tx) / 2, my = Math.min(h.y, h.ty) - 8;
        for (let i = 0; i < 16; i++) {
          const u = ((i / 16) + h.t * 3) % 1;
          if (u > 0.2 + k || u < k - 0.5) continue;
          const a = 1 - u, x = a * a * h.x + 2 * a * u * mx + u * u * h.tx, y = a * a * h.y + 2 * a * u * my + u * u * h.ty;
          dot(P.out, x - 1, y - 1, 3);
          dot(i % 3 ? P.mid : P.light, x, y, 1);
        }
      }
    }
  }

  // Lit particles: blood, debris, dust and smoke.
  drawLit(g, ox, oy) {
    for (const p of this.parts) {
      if (p.em || p.ov || p.k === 'glyph') continue;
      g.globalAlpha = p.k === 'dust' || p.k === 'smoke' || p.k === 'spray' ? Math.min(1, (p.life / p.max) * 1.4) * (p.k === 'smoke' ? 0.75 : 0.7) : 1;
      g.fillStyle = p.c;
      const s = Math.max(1, Math.round(p.s));
      g.fillRect(Math.round(p.x + ox - s / 2), Math.round(p.y + oy - s / 2), s, s);
    }
    g.globalAlpha = 1;
  }

  // Over the lighting, at full colour: water and goo that should read bright and clean (the geyser,
  // the wave, spray, rising bubbles) and the bite's teeth.
  drawOver(g, ox, oy, t) {
    const dot = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    for (const o of this.over) {
      if (o.k === 'geyser') {
        // Rises in a quarter second, holds, then falls back in on itself and thins out.
        const rise = Math.min(1, o.t / 0.25), fall = o.t > 0.36 ? (o.t - 0.36) / (o.max - 0.36) : 0;
        const H = Math.round(40 * ease(rise) * (1 - fall)), w = Math.max(2, Math.round(8 * (1 - fall * 0.6)));
        if (H < 1) continue;
        const flow = Math.floor(o.t * 120);
        for (let yy = 0; yy < H; yy++) {
          const ww = w + (yy < 3 ? 4 - yy : 0), x0 = o.x - (ww >> 1), y = o.y - 1 - yy;
          for (let i = 0; i < ww; i++) {
            const edge = i === 0 || i === ww - 1, core = Math.abs(i - (ww - 1) / 2) < 1;
            const streak = (i === 1 || i === ww - 3) && (yy + flow) % 7 < 2;
            dot(edge ? '#5ab4e6' : streak || core ? '#ffffff' : (yy + flow + i) % 5 ? '#a8e4f8' : '#d8f6ff', x0 + i, y);
          }
        }
        // The foam crown on top: a ragged white cap a little wider than the column.
        const top = o.y - H - 1, cw = w + 2;
        for (let i = 0; i < cw; i++) { const up = (i + flow) % 3 === 0 ? 1 : 0; dot(i === 0 || i === cw - 1 ? '#d8f6ff' : '#ffffff', o.x - (cw >> 1) + i, top - up, 1, 1 + up); }
      } else if (o.k === 'wave') {
        // Grows as it rolls out, curls over at the lip and breaks into foam at the end.
        const k = o.t / o.max, run = o.run * ease(Math.min(1, o.t / 0.32)), front = o.x + o.f * run;
        const H = Math.round(10 * Math.sin(Math.min(1, k * 2.2) * Math.PI / 2) * (1 - Math.max(0, (k - 0.72) / 0.28)));
        if (H < 1) continue;
        const L = 18;
        for (let i = 0; i <= L; i++) {
          const h = Math.max(0, Math.round(H * Math.pow(1 - i / L, 1.4))), xx = front - o.f * i, top = o.y - 1 - h;
          g.globalAlpha = 0.4;
          if (h > 2) dot((i + Math.floor(o.t * 40)) % 4 ? '#ff9cb8' : '#ffd0de', xx, top + 2, 1, h - 1);
          g.globalAlpha = 1;
          dot('#ffffff', xx, top);
          if (h > 0) dot(i < 3 ? '#ffd0de' : '#ff8fa8', xx, top + 1);
        }
        // The lip: two pixels hanging over the front, then a fleck of foam falling off it.
        dot('#ffffff', front + o.f, o.y - H);
        dot('#ffd0de', front + o.f * 2, o.y - H + 1);
        if (Math.floor(o.t * 30) % 2) dot('#ffffff', front + o.f * 3, o.y - H + 3);
      } else if (o.k === 'pop') {
        // The film tears outward: eight short dashes flying off the rim.
        const k = o.t / o.max, r0 = o.r + k * 5;
        g.globalAlpha = 1 - k * 0.7;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2, c = Math.cos(a), s = Math.sin(a);
          for (let d = 0; d < 3 - k * 2; d++) dot(i % 2 ? '#d8f6ff' : '#ffffff', o.x + c * (r0 + d), o.y + s * (r0 + d));
        }
        g.globalAlpha = 1;
      } else if (o.k === 'teeth') {
        // Upper and lower rows of needle teeth slam shut, hold a beat and fade.
        const k = o.t / o.max, shut = Math.min(1, o.t / 0.06), gap = Math.round(5 - 4 * shut);
        if (k > 0.6 && Math.floor(o.t * 30) % 2) continue;
        for (const s of [-1, 1]) {
          const y = o.y + s * gap;
          dot('#ff4a6a', o.x - 5, y + s, 11, 1);
          for (let i = -2; i <= 2; i++) { const sag = Math.abs(i) === 2 ? -s : 0; dot('#fff2dc', o.x + i * 2, y + sag, 1, 1); dot('#fff2dc', o.x + i * 2, y + sag - s, 1, 1); }
        }
      }
    }
    for (const p of this.parts) {
      if (!p.ov) continue;
      const k = p.life / p.max;
      if (p.k === 'bubl') {
        // Rising bubbles wobble side to side and grow a shine.
        const x = Math.round(p.x + Math.sin(t * 9 + p.seed) * 0.8 + ox), y = Math.round(p.y + oy), s = Math.round(p.s);
        g.globalAlpha = Math.min(1, k * 2.5);
        if (s <= 1) { g.fillStyle = p.c; g.fillRect(x, y, 1, 1); }
        else if (s === 2) { g.fillStyle = p.c; g.fillRect(x, y - 1, 1, 1); g.fillRect(x - 1, y, 1, 1); g.fillStyle = '#7ab8d8'; g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1); }
        else { g.fillStyle = p.c; g.fillRect(x, y - 1, 2, 1); g.fillRect(x - 1, y, 1, 2); g.fillStyle = '#7ab8d8'; g.fillRect(x + 2, y, 1, 2); g.fillRect(x, y + 2, 2, 1); g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); }
        g.globalAlpha = 1;
      } else { g.fillStyle = p.c; const s = Math.max(1, Math.round(p.s)); g.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), s, s); }
    }
  }

  drawEmissive(g, ox, oy, t) {
    for (const p of this.parts) {
      if (!p.em || p.ov) continue;
      const k = p.life / p.max;
      if (p.k === 'fire') {
        g.fillStyle = FIRE[Math.min(4, Math.floor((1 - k) * 5))];
        const s = Math.max(1, Math.round(p.s * (0.5 + k)));
        g.fillRect(Math.round(p.x + ox - s / 2), Math.round(p.y + oy - s / 2), s, s);
      } else if (p.k === 'spark') {
        g.fillStyle = p.c;
        g.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), 1, 1);
        g.globalAlpha = 0.6;
        g.fillRect(Math.round(p.x - p.vx * 0.6 + ox), Math.round(p.y - p.vy * 0.6 + oy), 1, 1);
        g.globalAlpha = 1;
      } else if (p.k === 'glyph') continue;
      else if (p.k === 'steam') {
        g.globalAlpha = 0.32 * Math.min(1, k * 1.6);
        g.fillStyle = p.c;
        const sz = Math.max(1, Math.round(p.s));
        g.fillRect(Math.round(p.x + ox - sz / 2), Math.round(p.y + oy - sz / 2), sz, sz);
        g.globalAlpha = 1;
      } else { g.fillStyle = p.c; g.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), Math.max(1, Math.round(p.s)), Math.max(1, Math.round(p.s))); }
    }
    for (const f of this.flashes) {
      const x = Math.round(f.x + ox), y = Math.round(f.y + oy);
      if (f.kind === 'explosion') {
        const k = 1 - f.life / f.max, r = Math.max(2, f.r * (0.25 + k * 0.6));
        const rings = [[1, P.fire3], [0.78, P.fire2], [0.55, P.fire1], [0.3, P.fire0]];
        for (const [m, c] of rings) {
          const rr = r * m * (1 - k * 0.5);
          g.fillStyle = c;
          for (let yy = -rr; yy <= rr; yy += 1) {
            const half = Math.sqrt(Math.max(0, rr * rr - yy * yy));
            const jag = ((yy * 7 + Math.floor(t * 30)) % 3) - 1;
            g.fillRect(Math.round(x - half - jag), Math.round(y + yy), Math.round(half * 2 + jag * 2), 1);
          }
        }
      } else if (f.kind === 'star') {
        // Four long spikes along and across the blow, smaller ones between, white core.
        const k = f.life / f.max, r = (6 + f.p * 5) * (0.6 + k * 0.6), rnd = seeded(f.seed);
        g.fillStyle = f.color || '#ffffff';
        for (let i = 0; i < 8; i++) {
          const a = f.a + (i * Math.PI) / 4 + (rnd() - 0.5) * 0.2, len = i % 2 ? r * 0.55 : r;
          for (let d = 1; d < len; d++) { const w = d < len * 0.4 ? 2 : 1; g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), w, w); }
        }
        g.fillStyle = '#ffffff';
        g.fillRect(x - 1, y - 1, 3, 3);
      } else if (f.kind === 'beam') {
        const k = f.life / f.max;
        g.globalAlpha = k;
        g.fillStyle = f.color;
        g.fillRect(x - 3, y - 70, 6, 90);
        g.fillStyle = '#ffffff';
        g.fillRect(x - 1, y - 70, 2, 90);
        g.globalAlpha = 1;
      } else {
        const len = f.big ? 9 : 6, c = Math.cos(f.a), s = Math.sin(f.a);
        g.fillStyle = f.word ? f.color : '#fff6d8';
        for (let i = 0; i < len; i++) { const w = i < 2 ? 3 : i < len - 2 ? 2 : 1; g.fillRect(Math.round(x + c * i - w / 2), Math.round(y + s * i - w / 2), w, w); }
        g.fillStyle = P.fire1;
        g.fillRect(Math.round(x - s * 2), Math.round(y + c * 2), 1, 1); g.fillRect(Math.round(x + s * 2), Math.round(y - c * 2), 1, 1);
      }
    }
    for (const z of this.zaps) {
      const r = seeded(z.seed * 97 + Math.floor(t * 40));
      g.fillStyle = r() < 0.5 ? P.zap0 : P.zap1;
      let x = z.x1, y = z.y1;
      const n = 8;
      for (let i = 1; i <= n; i++) {
        const tx = z.x1 + (z.x2 - z.x1) * (i / n) + (i < n ? (r() - 0.5) * 8 : 0), ty = z.y1 + (z.y2 - z.y1) * (i / n) + (i < n ? (r() - 0.5) * 8 : 0);
        const steps = Math.max(Math.abs(tx - x), Math.abs(ty - y));
        for (let k = 0; k <= steps; k++) g.fillRect(Math.round(x + (tx - x) * (k / steps) + ox), Math.round(y + (ty - y) * (k / steps) + oy), 1, 1);
        x = tx; y = ty;
      }
    }
    for (const sm of this.smears) this.drawSmear(g, sm, ox, oy);
    for (const r of this.rings) {
      const k = 1 - r.life / r.max, rad = r.r * (0.2 + k * 0.8);
      g.globalAlpha = 1 - k;
      g.fillStyle = r.color;
      const steps = Math.max(12, Math.round(rad * 3));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        if (r.arc && Math.abs(Math.atan2(Math.sin(a - r.dir), Math.cos(a - r.dir))) > r.arc) continue;
        g.fillRect(Math.round(r.x + Math.cos(a) * rad + ox), Math.round(r.y + Math.sin(a) * rad * (r.flat ? 0.28 : 0.9) + oy), 1, 1);
      }
      g.globalAlpha = 1;
    }
  }

  drawSmear(g, sm, ox, oy) {
    const k = 1 - sm.life / sm.max;
    const frame = k < 0.34 ? 0 : k < 0.67 ? 1 : 2;
    const r = sm.size * (0.7 + frame * 0.15);
    const cx = sm.x + ox - sm.face * r * 0.5, cy = sm.y + oy;
    const a0 = -1.2 + frame * 0.25, a1 = 1.1;
    g.fillStyle = sm.color;
    const thick = frame === 2 ? 1 : sm.fin ? 3 : 2;
    if (sm.kind === 'dash') {
      g.fillStyle = sm.color;
      for (let i = 0; i < 4; i++) { const yy = Math.round(sm.y + oy - 8 + i * 5), len = Math.round(sm.size * (1 - k) * (0.6 + (i % 2) * 0.4)); g.fillRect(Math.round(sm.x + ox - sm.face * (len + 6)), yy, len, 1); }
      return;
    }
    // The axolotl's gill lash: three thin feathery arcs, the outer one palest, staggered.
    if (sm.kind === 'gill') {
      const cols = ['#ffd0de', '#ff8fa8', '#ff6e8c'];
      for (let l = 0; l < 3; l++) {
        const rr = r - l * 2, off = l * 0.14;
        g.fillStyle = frame === 2 ? '#ff8fa8' : cols[l];
        for (let a = a0 + off; a <= a1 - off * 0.5; a += 0.05) g.fillRect(Math.round(cx + Math.cos(a) * rr * sm.face), Math.round(cy + Math.sin(a) * rr * 0.75), 1, 1);
      }
      return;
    }
    const lines = sm.kind === 'claw' || sm.kind === 'lunge' || sm.kind === 'blood' ? 3 : 1;
    for (let l = 0; l < lines; l++) {
      const rr = r - l * 3;
      for (let a = a0; a <= a1; a += 0.06) {
        const t = (a - a0) / (a1 - a0), w = Math.max(1, Math.round(thick * Math.sin(t * Math.PI)));
        const x = cx + Math.cos(a) * rr * sm.face, y = cy + Math.sin(a) * rr * 0.75;
        g.fillRect(Math.round(x), Math.round(y), w, w);
      }
    }
    if (frame === 0 && (sm.kind === 'punch' || sm.kind === 'pipe' || sm.kind === 'bash' || sm.kind === 'board')) {
      const hx = Math.round(sm.x + ox + sm.face * r * 0.3), hy = Math.round(cy);
      g.fillStyle = '#ffffff';
      g.fillRect(hx - 3, hy, 7, 1); g.fillRect(hx, hy - 3, 1, 7); g.fillRect(hx - 2, hy - 2, 1, 1); g.fillRect(hx + 2, hy + 2, 1, 1); g.fillRect(hx + 2, hy - 2, 1, 1); g.fillRect(hx - 2, hy + 2, 1, 1);
    }
  }

  drawGlyphs(g, ox, oy) {
    for (const p of this.parts) if (p.k === 'glyph') drawText(g, p.ch, p.x + ox, p.y + oy, { color: p.c, outline: '#1a1424', alpha: Math.min(1, (p.life / p.max) * 2) });
  }

  lights(add) {
    for (const f of this.flashes) {
      if (f.kind === 'explosion') add({ x: f.x, y: f.y, r: 170, color: '#ffc27a', i: (f.life / f.max) * 1.4 });
      else if (f.kind !== 'beam') add({ x: f.x, y: f.y, r: f.big ? 64 : 44, color: f.word ? f.color : '#ffe2a0', i: f.kind === 'star' ? 0.3 + Math.min(0.6, (f.p || 1) * 0.14) : 1 });
    }
    for (const z of this.zaps) add({ x: z.x2, y: z.y2, r: 54, color: '#8af0ff', i: 1 });
    const red = this.gore === 0 ? '#9a5aff' : '#ff3048';
    for (const h of this.hemo) {
      const k = Math.max(0, h.life / h.max);
      if (h.k === 'beam') for (let i = 0; i <= 4; i++) add({ x: h.x + (h.x2 - h.x) * (i / 4), y: h.y + (h.y2 - h.y) * (i / 4), r: 48, color: red, i: k * 1.2 });
      else if (h.k === 'nova') add({ x: h.x, y: h.y, r: 90, color: red, i: k * 1.6 });
      else if (h.k === 'spike' && h.t >= h.delay) add({ x: h.x, y: h.y - h.h, r: 26, color: red, i: k * 0.7 });
      else if (h.k === 'bubble') add({ x: h.x, y: h.y, r: 50, color: red, i: h.flash ? 2 : 0.7 });
      else if (h.k === 'cut' && (h.t < 0.15 || h.flash)) add({ x: (h.x + h.x2) / 2, y: (h.y + h.y2) / 2, r: 40, color: h.flash ? '#ffffff' : red, i: 1 });
      else if (h.k === 'venus') add({ x: h.x, y: h.y, r: 96, color: '#ff3a2a', i: k * 1.6 });
      else if (h.k === 'xzap' && h.t >= h.delay) add({ x: h.x2, y: h.y2, r: 36, color: '#ff4a2a', i: k * 1.2 });
      else if (h.k === 'skullGlow') add({ x: h.x, y: h.y, r: 28, color: '#ff6a2a', i: k * 0.9 });
    }
    for (const o of this.over) if (o.k === 'geyser') add({ x: o.x, y: o.y - 20, r: 44, color: '#9ae8ff', i: 0.5 * (1 - o.t / o.max) });
  }
}
