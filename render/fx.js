// Client-side effects driven by simulation events: particles, smears, flashes and persistent decals.
import { VIEW_W, VIEW_H, S, seeded, bayer } from '../engine/const.js';
import { P } from '../engine/palette.js';
import { MAP } from '../sim/map.js';
import { drawText } from '../engine/font.js';
import { bloodPal } from './blood-art.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => v * S;
const ease = t => 1 - (1 - t) * (1 - t);
const TOPS = [
  ...MAP.solids.filter(s => s.kind !== 'wall' && s.kind !== 'pit').map(s => ({ x0: X(s.x0), x1: X(s.x1), y: X(s.y0) })),
  ...MAP.oneway.map(p => ({ x0: X(p.x0), x1: X(p.x1), y: X(p.y) }))
];
const BLOOD = [P.blood1, P.blood2, P.blood3, P.blood2, P.blood0];
const ROCK = ['#5a5068', '#7a6e88', '#3e3648', '#9a8eaa'], STEAM = ['#e8e4f0', '#c8c0d8', '#a8a0c0'], EMBER = ['#ffffff', '#ffe2a0', '#ffb040', '#ff6a2a'];
const DUST = ['#6a6078', '#8a7f95', '#4f475e'];
const FIRE = [P.fire0, P.fire1, P.fire2, P.fire3, P.fire4];
const DEBRIS = {
  wood: ['#b07b4f', '#87553c', '#d6a46c'], glass: ['#bfe8f2', '#8cc0dc', '#ffffff'], metal: ['#8a87a2', '#5a5276', '#c4c0d8'],
  flesh: [P.flesh, P.blood3, P.blood2], bone: [P.bone1, P.bone2, P.bone0], ice: [P.ice0, P.ice1, P.ice2]
};

export class FX {
  constructor() {
    this.parts = [];
    this.smears = [];
    this.flashes = [];
    this.zaps = [];
    this.rings = [];
    this.hemo = [];
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
    this.wg.clearRect(0, 0, VIEW_W, VIEW_H);
    this.fg.clearRect(0, 0, VIEW_W, VIEW_H);
    this.lastId = 0;
  }

  add(p) {
    if (this.parts.length >= this.limit) return;
    p.max = p.life;
    this.parts.push(p);
  }

  burst(kind, x, y, n, opts = {}) {
    const rnd = opts.rnd || Math.random;
    for (let i = 0; i < n; i++) {
      const a = opts.a !== undefined ? opts.a + (rnd() - 0.5) * (opts.spread ?? 1.2) : rnd() * Math.PI * 2;
      const sp = (opts.s ?? 2) * (0.3 + rnd() * 0.9);
      this.add({ k: kind, x, y, vx: Math.cos(a) * sp + (opts.dx || 0), vy: Math.sin(a) * sp + (opts.dy || 0), life: (opts.life ?? 0.8) * (0.5 + rnd()), c: opts.colors ? opts.colors[Math.floor(rnd() * opts.colors.length)] : opts.c, s: opts.size ?? 1, g: opts.g ?? 0.15, b: opts.b ?? 0, em: !!opts.em, drag: opts.drag ?? 1, stick: !!opts.stick, grow: opts.grow || 0 });
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
    for (const list of [this.smears, this.flashes, this.zaps, this.rings, this.hemo]) for (const s of list) s.life -= dt;
    this.smears = this.smears.filter(s => s.life > 0);
    this.flashes = this.flashes.filter(s => s.life > 0);
    this.zaps = this.zaps.filter(s => s.life > 0);
    this.rings = this.rings.filter(s => s.life > 0);
    this.hemo = this.hemo.filter(s => s.life > 0);
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
      if (p.em || p.k === 'glyph') continue;
      g.globalAlpha = p.k === 'dust' || p.k === 'smoke' || p.k === 'spray' ? Math.min(1, (p.life / p.max) * 1.4) * (p.k === 'smoke' ? 0.75 : 0.7) : 1;
      g.fillStyle = p.c;
      const s = Math.max(1, Math.round(p.s));
      g.fillRect(Math.round(p.x + ox - s / 2), Math.round(p.y + oy - s / 2), s, s);
    }
    g.globalAlpha = 1;
  }

  drawEmissive(g, ox, oy, t) {
    for (const p of this.parts) {
      if (!p.em) continue;
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
        g.fillRect(Math.round(r.x + Math.cos(a) * rad + ox), Math.round(r.y + Math.sin(a) * rad * 0.9 + oy), 1, 1);
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
    }
  }
}
