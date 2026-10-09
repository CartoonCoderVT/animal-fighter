// Frame pipeline: background -> lit play layer (multiplied by the light map) -> rim light -> emissive + bloom
// -> volumetrics, foreground and post -> sharp upscale to the display.
import { VIEW_W, VIEW_H, S, clamp, rnd } from '../engine/const.js';
import { P, hexToRgb } from '../engine/palette.js';
import { drawText } from '../engine/font.js';
import { MAP } from '../sim/map.js';
import { surfaceY } from '../sim/physics.js';
import { World } from './world.js';
import { Lighting, cookie } from './lighting.js';
import { FX } from './fx.js';
import { sprite } from './sprites.js';
import { FOOT, HALF_H, BODY_W } from './rig.js';
import { MATS, weaponDef, LAMP_DEF, drawPropSprite } from './props-art.js';
import { figureSprite, drawFigure, figurePoint, partSprite, variantOf, shadowOf, tintOf } from './fighter-art.js';
import { seeded } from '../engine/const.js';
import { frameFor } from './anim.js';
import { Secondary } from './secondary.js';
import { drawBloodArt, drawMarks } from './blood-art.js';
import { NoxHero } from './hero.js';
import { LolaHero } from './lola-hero.js';
import { MOVES, COMBOS, comboOf } from '../sim/moves.js';
import { castFor } from './pixel-data.js';
import { isMelee, WEAPON_INFO } from '../sim/weapons.js';
import { LolaFX, handKnives, embeddedKnife } from './lola-art.js';
import { worldPhase } from '../sim/moves.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const X = v => Math.round(v * S);
const PART_ORDER = { armB: 0, footB: 1, body: 2, footF: 3, head: 4, armF: 5 };
// Each live fighter is painted into a small canvas with its feet at (FIG_X, FIG_Y).
const FIG_W = 72, FIG_H = 64, FIG_X = 36, FIG_Y = 50;
const WEAPON_SCALE = 0.7;
// Nox's eye in head cells from the head pivot; the hand at the tip of the near arm.
const EYE = [2, -6], HAND = [0, 3];
const DEMO_ACT = ['pounce', 'ball', 'world', 'morph', 'beam'];
// The instant of Juma's transformation: the figure burns white just before and after the pop.
function morphFlash(a) {
  const t = a.actT ?? 0;
  if (a.act === 'morph' && t >= 0.5 && t < 0.66) return Math.floor(t * 40) % 2 ? '#ffffff' : '#ffe2a0';
  if (a.act === 'unmorph' && t >= 0.27 && t < 0.38) return Math.floor(t * 40) % 2 ? '#ffffff' : '#ffe2a0';
  return null;
}
// Shivering as she swells: the whole figure jitters a pixel either way.
const morphJitter = (a, time) => (a.act === 'morph' && (a.actT ?? 0) > 0.12 && (a.actT ?? 0) < 0.6 ? (Math.floor(time * 34) % 2 ? 1 : -1) : 0);
const JUMA_TRAIL = { null: '#ffd27a', beast: '#ff7a2a' };
// Specials the menu preview carries forward across the pedestal.
const DEMO_MOVES = ['pounce', 'ball', 'bite'];

function vignette() {
  const c = mk(VIEW_W, VIEW_H), g = c.getContext('2d');
  const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.45, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.45, VIEW_W * 0.62);
  grad.addColorStop(0, 'rgba(10,6,20,0)');
  grad.addColorStop(1, 'rgba(10,6,20,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  return c;
}
const shadowCache = new Map();
function contactShadow(w) {
  w = Math.max(4, Math.min(24, Math.round(w)));
  if (shadowCache.has(w)) return shadowCache.get(w);
  const c = mk(w + 2, 4), g = c.getContext('2d');
  g.fillStyle = 'rgba(8,4,14,0.55)';
  for (let y = 0; y < 4; y++) for (let x = 0; x < w + 2; x++) {
    const d = ((x - (w + 1) / 2) / ((w + 1) / 2)) ** 2 + ((y - 1.5) / 2) ** 2;
    if (d < 1 && ((x + y) % 2 === 0 || d < 0.5)) g.fillRect(x, y, 1, 1);
  }
  shadowCache.set(w, c);
  return c;
}

export class Renderer {
  constructor(display) {
    this.display = display;
    this.dg = display.getContext('2d');
    this.scene = mk(VIEW_W, VIEW_H); this.sg = this.scene.getContext('2d');
    // The world is drawn into scene and the interface into ui; present() zooms only the world.
    this.ui = mk(VIEW_W, VIEW_H); this.ug = this.ui.getContext('2d');
    this.sil = mk(FIG_W, FIG_H); this.silg = this.sil.getContext('2d');
    this.back = mk(VIEW_W, VIEW_H); this.bg = this.back.getContext('2d');
    this.lit = mk(VIEW_W, VIEW_H); this.lg = this.lit.getContext('2d');
    this.mask = mk(VIEW_W, VIEW_H); this.mg = this.mask.getContext('2d');
    this.emit = mk(VIEW_W, VIEW_H); this.eg = this.emit.getContext('2d');
    this.small = mk(160, 90); this.smg = this.small.getContext('2d');
    this.tiny = mk(80, 45); this.tng = this.tiny.getContext('2d');
    this.pre = mk(1, 1); this.pg = this.pre.getContext('2d');
    this.world = new World();
    this.light = new Lighting();
    this.fx = new FX();
    this.lola = new LolaFX(this);
    this.previews = new Map();
    this.secondary = new Secondary();
    this.simTime = null;
    this.simDt = 0;
    this.figCache = new Map();
    this.vig = vignette();
    this.time = 0;
    this.view = { x: 0, y: 0, w: VIEW_W, h: VIEW_H, scale: 1, dpr: 1, left: 0, top: 0 };
    this.pixelMode = 'sharp';
    for (const g of [this.sg, this.bg, this.lg, this.eg, this.mg, this.ug, this.silg]) g.imageSmoothingEnabled = false;
    this.cam = { x: VIEW_W / 2, y: VIEW_H / 2, zoom: 1, punch: 0, sx: 0, sy: 0, sw: VIEW_W, sh: VIEW_H, lead: 0, runV: 0, focusX: null, focusY: null, focusId: null, wasDead: false };
    this.trauma = 0;
    this.flashT = 0;
    this.lastImpact = -9;
    this.keyPose = new Map();
    this.scythes = new Map();
    this.scythePresence = new Map();
    this.swarmPos = new Map();
    this.eyeTrail = new Map();
    this.aura = mk(FIG_W, FIG_H); this.ag = this.aura.getContext('2d');
    this.worldDrawn = false;
    this.impact = null;
    this.focusLines = [];
    this.trails = new Map();
    this.light.setStatic([
      { x: 320, y: 220, r: 100, color: '#ff6f9c', i: 0.75, occlude: true, tag: 'on' },
      { x: 91, y: 288, r: 40, color: '#4dff9a', i: 0.6 },
      { x: 46, y: 140, r: 34, color: '#7fe8ff', i: 0.5 },
      { x: 588, y: 140, r: 34, color: '#7fe8ff', i: 0.5 },
      { x: 320, y: 352, r: 64, color: '#ff4a2a', i: 0.55 }
    ]);
    this.resize();
  }

  resetMatch() {
    this.fx.reset();
    this.lola.reset();
    this.figCache.clear();
    this.secondary.clear();
    this.trails.clear();
    this.simTime = null;
    this.impact = null;
    Object.assign(this.cam, { x: VIEW_W / 2, y: VIEW_H / 2, zoom: 1, punch: 0, lead: 0, runV: 0, focusX: null, focusY: null, focusId: null });
    this.trauma = 0;
    this.flashT = 0;
  }

  resize() {
    const r = this.display.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (this.display.width !== W || this.display.height !== H) { this.display.width = W; this.display.height = H; }
    let scale = Math.min(W / VIEW_W, H / VIEW_H);
    if (this.pixelMode === 'integer' && scale >= 1) scale = Math.floor(scale);
    const vw = Math.round(VIEW_W * scale), vh = Math.round(VIEW_H * scale);
    this.view = { x: Math.floor((W - vw) / 2), y: Math.floor((H - vh) / 2), w: vw, h: vh, scale, dpr, left: r.left, top: r.top };
  }

  screenToView(cx, cy) {
    const v = this.view;
    return { x: ((cx - v.left) * v.dpr - v.x) / v.scale, y: ((cy - v.top) * v.dpr - v.y) / v.scale };
  }

  present() {
    const v = this.view, dg = this.dg;
    dg.fillStyle = '#05030a';
    dg.fillRect(0, 0, this.display.width, this.display.height);
    if (this.worldDrawn) {
      const c = this.cam;
      this.blit(this.scene, c.sx, c.sy, c.sw, c.sh, false);
      dg.imageSmoothingEnabled = true;
      dg.drawImage(this.vig, v.x, v.y, v.w, v.h);
      this.worldDrawn = false;
    }
    this.blit(this.ui, 0, 0, VIEW_W, VIEW_H, true);
  }

  // Sharp upscale of a region of a 640x360 layer: nearest to an integer multiple, then smooth.
  blit(src, sx, sy, sw, sh, clear) {
    const v = this.view, dg = this.dg;
    if (sw === VIEW_W && (Number.isInteger(v.scale) || this.pixelMode === 'integer')) {
      dg.imageSmoothingEnabled = false;
      dg.drawImage(src, 0, 0, VIEW_W, VIEW_H, v.x, v.y, v.w, v.h);
      return;
    }
    const k = Math.max(1, Math.ceil(v.scale * (VIEW_W / sw)));
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const iw = Math.min(VIEW_W - ix, Math.ceil(sw) + 1), ih = Math.min(VIEW_H - iy, Math.ceil(sh) + 1);
    if (this.pre.width < iw * k || this.pre.height < ih * k) { this.pre.width = Math.max(this.pre.width, iw * k); this.pre.height = Math.max(this.pre.height, ih * k); }
    const pg = this.pg;
    pg.imageSmoothingEnabled = false;
    if (clear) pg.clearRect(0, 0, iw * k, ih * k);
    pg.drawImage(src, ix, iy, iw, ih, 0, 0, iw * k, ih * k);
    dg.imageSmoothingEnabled = true;
    dg.imageSmoothingQuality = 'high';
    dg.drawImage(this.pre, (sx - ix) * k, (sy - iy) * k, sw * k, sh * k, v.x, v.y, v.w, v.h);
  }

  // World units <-> interface pixels through the camera.
  worldToView(x, y) {
    const c = this.cam, z = VIEW_W / c.sw;
    return { x: (x * S - c.sx) * z, y: (y * S - c.sy) * z };
  }
  viewToWorld(x, y) {
    const c = this.cam, z = VIEW_W / c.sw;
    return { x: (c.sx + x / z) / S, y: (c.sy + y / z) / S };
  }

  // Each player's camera follows their own fighter, side-scroller style (Keren, "Scroll Back"):
  //  - a camera window: the fighter moves freely inside a box before the camera follows;
  //  - platform snap: vertical framing settles when standing, not on every hop;
  //  - forward focus from sustained running, so turning around does not swing the view;
  //  - a rival close by eases the zoom out to keep both in frame.
  // Without a local fighter (title screen) it frames everyone.
  updateCamera(state, dt, settings, localId) {
    const c = this.cam;
    const me = state.actors.find(a => a.id === localId);
    const on = settings.camera !== false && state.mode !== 'sandbox';
    let fx = c.x, fy = c.y, zoomT = 1;
    if (on && me) {
      if (!me.dead) {
        const px = X(me.x), py = X(me.y), WX = 30, WY = 20;
        if (c.focusX === null || me.id !== c.focusId || c.wasDead) { c.focusX = px; c.focusY = py; c.focusId = me.id; c.wasDead = false; }
        if (px > c.focusX + WX) c.focusX = px - WX; else if (px < c.focusX - WX) c.focusX = px + WX;
        if (me.ground || me.climbing) c.focusY += (py - c.focusY) * (1 - Math.exp(-dt * 5));
        if (py > c.focusY + WY) c.focusY = py - WY; else if (py < c.focusY - WY * 2) c.focusY = py + WY * 2;
        c.runV += ((me.vx || 0) - c.runV) * (1 - Math.exp(-dt * 1.5));
        const leadT = Math.abs(c.runV) > 2.5 ? Math.sign(c.runV) * 20 : c.lead;
        c.lead += (leadT - c.lead) * (1 - Math.exp(-dt * 1.2));
        fx = c.focusX + c.lead; fy = c.focusY - 14; zoomT = 1.6;
        let near = null, nd = Infinity;
        for (const b of state.actors) {
          if (b.dead || b.id === me.id) continue;
          const d = Math.abs(X(b.x) - px) + Math.abs(X(b.y) - py) * 1.5;
          if (d < nd) { nd = d; near = b; }
        }
        if (near && Math.abs(X(near.x) - px) < 170 && Math.abs(X(near.y) - py) < 100) {
          const bx = X(near.x), by = X(near.y);
          zoomT = clamp(Math.min(VIEW_W / (Math.abs(bx - px) + 210), VIEW_H / (Math.abs(by - py) + 150)), 1.3, 1.6);
          fx += (bx - px) * 0.3; fy += (by - py) * 0.3;
        }
      } else { c.wasDead = true; zoomT = 1.35; }
    } else if (on) {
      const pts = state.actors.filter(a => !a.dead).map(a => [X(a.x), X(a.y)]);
      if (pts.length) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        zoomT = clamp(Math.min(VIEW_W / (x1 - x0 + 180), VIEW_H / (y1 - y0 + 140)), 1, 1.6);
        fx = (x0 + x1) / 2; fy = (y0 + y1) / 2 - 8;
      }
    } else { fx = VIEW_W / 2; fy = VIEW_H / 2; }
    if (on && (state.slowmo || state.drama)) zoomT *= 1.08;
    // ZA WARUDO: in on Lola for the cut-in, then the stopped world around her and her rivals.
    const ts = state.timeStop, lola = ts && state.actors.find(a => a.id === ts.owner);
    if (on && lola) {
      if (worldPhase(ts.t) === 'intro') { fx = X(lola.x); fy = X(lola.y) - 12; zoomT = 2.1; }
      else {
        const pts = [[X(lola.x), X(lola.y)], ...state.actors.filter(a => (ts.targets || []).includes(a.id) && !a.dead).map(a => [X(a.x), X(a.y)])];
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        zoomT = clamp(Math.min(VIEW_W / (x1 - x0 + 200), VIEW_H / (y1 - y0 + 150)), 1.1, 1.75);
        fx = (x0 + x1) / 2; fy = (y0 + y1) / 2 - 10;
      }
    }
    const k = 1 - Math.exp(-dt * 4.5);
    c.x += (fx - c.x) * k; c.y += (fy - c.y) * k;
    c.zoom += (zoomT - c.zoom) * (1 - Math.exp(-dt * 1.6));
    c.punch *= Math.exp(-dt * 8);
    const z = c.zoom * (1 + c.punch);
    c.sw = VIEW_W / z; c.sh = VIEW_H / z;
    c.sx = clamp(c.x - c.sw / 2, 0, VIEW_W - c.sw);
    c.sy = clamp(c.y - c.sh / 2, 0, VIEW_H - c.sh);
  }

  // Is a point (view-buffer pixels) inside what this player currently sees?
  visible(x, y, margin = 0) {
    const c = this.cam;
    return x >= c.sx - margin && x <= c.sx + c.sw + margin && y >= c.sy - margin && y <= c.sy + c.sh + margin;
  }

  // Simulation events feed the camera: shake (trauma), punch-in, flashes and impact frames —
  // only for what happens on this player's screen.
  hype(e, settings) {
    const c = this.cam, p = e.p || 1, x = X(e.x ?? 0), y = X(e.y ?? 0);
    // Nox's big moments shake and punch in too: the burst, the requiem, the bounce, the beam.
    const PUNCH = { supernova: 0.05, requiemBurst: 0.07, groundBounce: 0.025, bloodBeam: 0.03, morphPop: 0.07, wallSplat: 0.05, quake: p >= 6 ? 0.03 : 0, worldEnd: 0.08 };
    if (PUNCH[e.fx] && this.visible(x, y, 20)) {
      c.punch = Math.max(c.punch, PUNCH[e.fx]);
      if ((e.fx === 'requiemBurst' || e.fx === 'morphPop' || e.fx === 'worldEnd') && settings.shake !== false) {
        this.lastImpact = this.time;
        this.focusLines.push({ x, y, life: 0.3, max: 0.3, seed: (e.id || 1) * 7, p: 3 });
        this.impact = { x, y, frames: e.fx === 'morphPop' ? 3 : 4, n: 0, seed: e.id || 1, clash: e.fx === 'requiemBurst' };
      }
    }
    const TRAUMA = { worldStart: 0.35, worldEnd: 0.6, timeSkip: 0.04, knifeHit: 0.02, quake: 0.03 * p, morphPop: 0.45, wallSplat: 0.32, roar: 0.12, armor: 0.03, supernova: 0.35, requiemBurst: 0.5, groundBounce: 0.16, bloodBeam: 0.2, bloodSpikes: 0.07, requiemCut: 0.03, shadowX: 0.05, hit: 0.035 + 0.035 * p, impact: e.ko ? 0.4 : 0.12 + 0.06 * p, explosion: 0.5, clang: e.big ? 0.12 : 0.05, clash: 0.18, land: p >= 0.9 ? 0.08 : 0, parry: 0.12 };
    const t = TRAUMA[e.fx];
    if (!t) return;
    const seen = e.fx === 'worldStart' || e.fx === 'worldEnd' || this.visible(x, y, e.fx === 'explosion' ? 60 : 4);
    if (!seen) return;
    this.trauma = Math.min(1, this.trauma + t);
    if (e.fx === 'explosion') this.flashT = Math.max(this.flashT, 0.35);
    if (e.fx === 'impact') {
      c.punch = Math.max(c.punch, e.ko ? 0.06 : 0.02 + p * 0.012);
      const big = e.ko || e.clash || e.parry || (e.knock && p >= 1.4);
      if (big && settings.shake !== false && this.time - this.lastImpact > 0.8) {
        this.lastImpact = this.time;
        this.focusLines.push({ x, y, life: 0.2, max: 0.2, seed: (e.id || 1) * 7, p });
        this.impact = { x, y, frames: e.ko ? 5 : 3, n: 0, seed: e.id || 1, clash: !!e.clash };
      }
    }
  }

  // Smooth shake from trauma (Eiserloh): amplitude grows with trauma squared, motion comes from
  // continuous noise, and it settles on its own.
  shakeOffset(dt, settings) {
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    if (settings.shake === false || this.trauma <= 0) return [0, 0];
    const amp = 3.5 * this.trauma * this.trauma, t = this.time * 28;
    const n = s => Math.sin(s * 0.71) * 0.5 + Math.sin(s * 1.37 + 1.3) * 0.3 + Math.sin(s * 2.93 + 2.1) * 0.2;
    return [Math.round(amp * n(t)), Math.round(amp * n(t + 57.3))];
  }

  // Nox in flight as a swarm: a flock of bats around where he is, flapping, strung out behind the
  // way he is flying, with a smear of red where their eyes catch the light.
  drawSwarm(eg, f, ox, oy, t) {
    const a = f.a, last = this.swarmPos.get(a.id), cx = f.hx + ox, cy = f.hy + oy - 12;
    const vx = last ? f.hx - last.x : 0, vy = last ? f.hy - last.y : 0, sp = Math.hypot(vx, vy) || 1;
    this.swarmPos.set(a.id, { x: f.hx, y: f.hy });
    const P = this.fx.pal(), rnd = seeded((a.id || 1) * 97);
    for (let i = 0; i < 18; i++) {
      const ph = rnd() * Math.PI * 2, r = 3 + rnd() * 9, lag = rnd() * 2.2;
      const x = cx + Math.cos(ph + t * (6 + rnd() * 4)) * r - (vx / sp) * lag * 7, y = cy + Math.sin(ph + t * (7 + rnd() * 3)) * r * 0.6 - (vy / sp) * lag * 7;
      const up = Math.floor(t * 26 + i) % 2;
      const bx = Math.round(x), by = Math.round(y), wy = up ? -1 : 1;
      eg.fillStyle = '#2a1430';
      eg.fillRect(bx - 1, by, 3, 2);
      eg.fillRect(bx - 2, by + wy, 1, 1); eg.fillRect(bx + 2, by + wy, 1, 1);
      eg.fillStyle = P.mid;
      eg.fillRect(bx - 3, by + wy * 2, 1, 1); eg.fillRect(bx + 3, by + wy * 2, 1, 1);
      eg.fillStyle = i % 3 ? P.light : P.glint;
      eg.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // A thin trail of red wisps where the swarm has been.
    for (let i = 1; i <= 6; i++) { eg.globalAlpha = 0.5 * (1 - i / 7); eg.fillStyle = P.mid; eg.fillRect(Math.round(cx - (vx / sp) * i * 5), Math.round(cy - (vy / sp) * i * 5 + Math.sin(t * 20 + i) * 2), 2, 1); }
    eg.globalAlpha = 1;
  }

  // Effects tied to Nox's key poses as he enters them: the snap (X) leaves a smear along the claw's
  // path and the back foot pushes dust off the floor, the planted impact (I) kicks a little up
  // ahead, and the deepest wind-up (A2) flashes a glint in his eye.
  keyFx(f) {
    const a = f.a, name = f.info.name || '', last = this.keyPose.get(a.id);
    const hand = f.info.hand, face = a.face || 1;
    // Juma's smears and glints are amber, the beast's a hot orange; Nox's are blood.
    const juma = a.type === 3, beast = juma && a.form === 'beast';
    const c = juma ? (beast ? { c1: '#ffb070', c2: '#ff6a2a' } : { c1: '#fff1c8', c2: '#ffd27a' }) : a.type === 2 ? { c1: '#eef6ff', c2: '#7fb4ff' } : {};
    if (last && last.name !== name && this.simDt > 0) {
      const dust = (x, dir, n) => this.fx.burst('dust', x, f.hy - 1, n, { a: dir > 0 ? -0.35 : Math.PI + 0.35, spread: 0.7, s: beast ? 2 : 1.5, life: beast ? 0.6 : 0.45, colors: ['#8a7f95', '#6a6078', '#a89cb8'], g: -0.02, drag: 0.9, size: 2 });
      if (/X2?$/.test(name)) {
        this.fx.hemo.push({ k: 'whoosh', x: last.hx, y: last.hy, x2: hand.x, y2: hand.y, cx: f.hx, cy: f.hy - 12, t: 0, life: beast ? 0.14 : 0.1, max: beast ? 0.14 : 0.1, ...c, wide: beast ? 2 : 0 });
        if (a.ground) dust(f.hx - face * 7, -face, beast ? 6 : 4);
      } else if (/I2?$/.test(name) && a.ground) dust(f.hx + face * 6, face, beast ? 5 : 2);
      else if (/A2$/.test(name)) this.fx.hemo.push({ k: 'glint', x: f.info.eye.x, y: f.info.eye.y, t: 0, life: 0.14, max: 0.14, ...c });
      // Every footfall of the beast at a run lands with a thud.
      else if (beast && a.ground && (name === 'run1' || name === 'run2')) { dust(f.hx + (name === 'run1' ? face : -face) * 3, -face, 3); this.trauma = Math.min(1, this.trauma + 0.03); }
    }
    this.keyPose.set(a.id, { name, hx: hand.x, hy: hand.y });
  }

  // Afterimages: a few fading copies of the sprite itself, left only by the fastest moves
  // (dodges, dash strikes, chases, pounces, spikes) and by a perfect dodge.
  updateTrails(figures, dt) {
    const FAST = ['pounce', 'kickoff', 'slam', 'chase', 'stomp', 'requiem', 'charge', 'leap', 'meteor', 'bite'];
    for (const f of figures) {
      const a = f.a, list = this.trails.get(a.id) || [];
      const fast = FAST.includes(a.act) || a.dodge > 0 || a.perfectT > 0 || (a.attack > 0 && ['dashAtk', 'spike', 'shadowCut', 'nAirScythe', 'nAirVortex', 'scytheGuillotine', 'scytheSpin', 'scytheReap', 'jBolt', 'jRake', 'jPounceUp', 'jFlurry', 'jAirSpin', 'jAirDive', 'bHammer', 'bUpper', 'bAirSmash', 'lDance', 'lBehind', 'lRise', 'lSkip', 'lAirSpin', 'lAirDive', 'lRain', 'lAirRing'].includes(a.attackKind));
      f.trail = list;
      if (fast && dt > 0 && (list.stepT = (list.stepT || 0) + dt) > 0.05) {
        list.stepT = 0;
        list.push({ s: f.info.sprite, o: f.info.overlay, x: f.hx, y: f.hy, face: a.face || 1, life: 0.2, tint: a.perfectT > 0 ? '#bfe8ff' : a.type === 4 ? '#e2445c' : a.type === 3 ? JUMA_TRAIL[a.form || null] : a.type === 2 ? '#7fb4ff' : null });
      }
      for (const g of list) g.life -= dt;
      while (list.length && list[0].life <= 0) list.shift();
      if (list.length > 4) list.shift();
      this.trails.set(a.id, list);
    }
  }

  drawTrails(lg, figures, ox, oy) {
    for (const f of figures) for (const t of f.trail || []) {
      lg.globalAlpha = Math.max(0, t.life / 0.2) * 0.4;
      const s = t.tint ? tintOf(t.s, t.tint) : t.s, o = t.o && (t.tint ? tintOf(t.o, t.tint) : t.o);
      if (o) drawFigure(lg, o, t.x + ox, t.y + oy, t.face);
      drawFigure(lg, s, t.x + ox, t.y + oy, t.face);
    }
    lg.globalAlpha = 1;
  }

  // Anime focus lines rushing in toward a big hit.
  drawFocusLines(g, dt) {
    for (const L of this.focusLines) {
      L.life -= dt;
      const k = Math.max(0, L.life / L.max), rnd = seeded(L.seed + Math.floor(L.life * 40));
      g.fillStyle = '#ffffff';
      g.globalAlpha = 0.55 * k;
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r0 = 34 + rnd() * 30 + (1 - k) * 20, r1 = r0 + 40 + rnd() * 50;
        const ca = Math.cos(a), sa = Math.sin(a), w = 1;
        for (let r = r0; r < r1; r += 1.5) g.fillRect(Math.round(L.x + ca * r), Math.round(L.y + sa * r), w, w);
      }
    }
    g.globalAlpha = 1;
    this.focusLines = this.focusLines.filter(L => L.life > 0);
  }

  // Two or three frames of high-contrast silhouettes on the heaviest hits.
  drawImpactFrame(sg, state, figures, ox, oy) {
    const im = this.impact;
    const dark = im.n % 2 === 0;
    const bg = dark ? '#07040c' : '#fff6f0', fg = dark ? '#fff6f0' : '#07040c';
    sg.fillStyle = bg;
    sg.fillRect(0, 0, VIEW_W, VIEW_H);
    const sil = this.silg;
    for (const f of figures) {
      sil.globalCompositeOperation = 'copy';
      sil.drawImage(f.fc.body.c, 0, 0);
      sil.globalCompositeOperation = 'source-in';
      sil.fillStyle = fg;
      sil.fillRect(0, 0, FIG_W, FIG_H);
      sil.globalCompositeOperation = 'source-over';
      sg.drawImage(this.sil, f.x, f.y);
    }
    for (const l of state.limbs || []) {
      const sp = partSprite(l, '', l.part === 'head' ? 'Dead' : '');
      if (!sp) continue;
      const t = tintOf({ canvas: sp.canvas, w: sp.canvas.width, h: sp.canvas.height, x0: 0, y0: 0, tints: sp.tints ||= {} }, fg);
      sg.drawImage(t.canvas, X(l.x) + ox - sp.px, X(l.y) + oy - sp.py);
    }
    // Jagged burst at the point of impact.
    const rnd = seeded(im.seed);
    sg.fillStyle = im.clash ? '#ff4a6a' : fg;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.2, len = 10 + rnd() * (im.clash ? 40 : 26);
      for (let r = 2; r < len; r += 1) { const w = Math.max(1, Math.round((1 - r / len) * 3)); sg.fillRect(Math.round(im.x + ox + Math.cos(a) * r), Math.round(im.y + oy + Math.sin(a) * r), w, w); }
    }
  }


  // ---------------------------------------------------------------------------------------
  render(state, { localId = 0, settings = {}, debug = false, dt = 1 / 60 } = {}) {
    this.time += dt;
    const t = this.time;
    // Secondary motion follows simulation time, so tails freeze with hitstop and pause.
    const st = state.time ?? t;
    this.simDt = this.simTime === null ? 0 : Math.max(0, Math.min(0.1, st - this.simTime));
    this.simTime = st;
    this.fx.gore = settings.gore ?? 2;
    this.fx.limit = settings.particles === false ? 300 : 900;
    const events = state.fxQueue ? state.fxQueue.splice(0) : (state.events || []).filter(e => e.type === 'fx' && e.id > this.fx.lastId);
    for (const e of events) { this.fx.event(e); this.lola.event(e); this.hype(e, settings); if (!state.fxQueue) this.fx.lastId = Math.max(this.fx.lastId, e.id); }
    this.updateCamera(state, dt, settings, localId);
    const hz = state.hazards || null;
    // Effects run on game time: they slow down with the dramatic slow motion and the LAB's, and
    // hang where they are while Lola holds time still (no new ones either). Hers run on.
    if (!state.timeStop) {
      this.spawnAmbientFx(state, hz, dt);
      this.fx.update(dt * (state.drama ? 0.35 : 1) * Math.min(1, state.timeScale ?? 1));
    }
    this.lola.update(dt * (state.drama && !state.timeStop ? 0.35 : 1));
    this.lola.watch(state);

    const [ox, oy] = this.shakeOffset(dt, settings);
    const rich = settings.particles !== false && !this.autoLow;

    // Each fighter is painted once into a small CPU canvas. From its pixels we derive the wall
    // shadow and true silhouette rim lights, so internal limb edges never light up.
    const figures = [];
    for (const a of state.actors) {
      if (a.dead || a.knocked) continue;
      const fx = Math.round(a.x * S), fy = Math.round((a.y + FOOT) * S);
      const fc = this.figureCanvases(a.id);
      fc.body.g.clearRect(0, 0, FIG_W, FIG_H);
      const info = this.paintFighter(fc.body.g, a, FIG_X, FIG_Y, state.time ?? t);
      for (const k of ['eye', 'hand']) { info[k].x += fx - FIG_X; info[k].y += fy - FIG_Y; }
      fc.alpha = fc.body.g.getImageData(0, 0, FIG_W, FIG_H).data;
      figures.push({ a, hx: fx, hy: fy, cx: fx, cy: fy - 10, info, fc, x: fx - FIG_X + ox, y: fy - FIG_Y + oy });
      if (a.type === 2 && a.act !== 'blink') this.lola.remember(a, info);
    }
    this.updateTrails(figures, this.simDt);
    for (const f of figures) if (f.a.type >= 2) this.keyFx(f);

    // Lights are gathered up front: rims and wall shadows need them.
    const L = this.light;
    L.begin(this.neonOn(t));
    this.collectLights(state, hz, figures, t);
    for (const l of L.lights) { l.x += ox; l.y += oy; }
    this.fx.lights(l => L.add({ ...l, x: l.x + ox, y: l.y + oy }));
    for (const f of figures) this.bakeFigure(f, L, rich);

    // ---- background
    this.world.drawBackground(this.bg, t, { x: ox * 0.4, y: oy * 0.4 });

    // ---- lit play layer
    const lg = this.lg;
    lg.globalCompositeOperation = 'source-over';
    lg.globalAlpha = 1;
    lg.clearRect(0, 0, VIEW_W, VIEW_H);
    lg.drawImage(this.world.wall, ox, oy);
    lg.drawImage(this.fx.wallDecals, ox, oy);
    this.drawNeonBoard(lg, ox, oy, false, t);
    if (rich) this.drawWallShadows(lg, figures, hz, ox, oy);
    lg.drawImage(this.world.back, ox, oy);
    if (hz) this.drawLamps(lg, hz, ox, oy);
    this.drawCargoChain(lg, state, ox, oy);
    lg.drawImage(this.world.solids, ox, oy);
    lg.drawImage(this.fx.floorDecals, ox, oy);
    lg.drawImage(this.world.fronts, ox, oy);
    if (hz) this.drawHazards(lg, hz, ox, oy, t);
    this.drawContactShadows(lg, state, ox, oy);
    for (const p of state.props) this.drawProp(lg, p, ox, oy, t);
    this.drawLimbs(lg, state, ox, oy, t);
    this.lola.drawLit(lg, state, ox, oy);
    this.drawTrails(lg, figures, ox, oy);
    for (const f of figures) {
      if (f.a.invincible > 0.1 && Math.floor(t * 12) % 2) lg.globalAlpha = 0.55;
      lg.drawImage(f.fc.body.c, f.x, f.y);
      lg.globalAlpha = 1;
    }
    this.fx.drawLit(lg, ox, oy);

    // ---- lighting
    L.render();
    this.mg.globalCompositeOperation = 'copy';
    this.mg.drawImage(this.lit, 0, 0);
    lg.globalCompositeOperation = 'multiply';
    lg.drawImage(L.map, 0, 0, VIEW_W, VIEW_H);
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(this.mask, 0, 0);
    lg.globalCompositeOperation = 'source-over';

    // ---- fighters keep part of their own color so they read against the set
    lg.globalAlpha = 0.45;
    for (const f of figures) lg.drawImage(f.fc.body.c, f.x, f.y);
    lg.globalAlpha = 1;
    for (const f of figures) if (f.info.smear) this.drawSmear(lg, f.a, f.info.smear.frame, f.info.smear.sm, f.hx + ox, f.hy + oy, f.a.face || 1, 1);
    if (state.limbs?.length) this.drawLimbs(lg, state, ox, oy, t, 0.38);

    // ---- rim light on fighters
    lg.globalCompositeOperation = 'lighter';
    for (const f of figures) for (const r of f.rims) { lg.globalAlpha = r.alpha; lg.drawImage(r.c, f.x, f.y); }
    lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'source-over';

    // ---- emissive + bloom
    const eg = this.eg;
    eg.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawEmissive(eg, state, hz, figures, ox, oy, t);
    lg.drawImage(this.emit, 0, 0);
    if (rich) {
      this.smg.imageSmoothingEnabled = true; this.tng.imageSmoothingEnabled = true;
      this.smg.clearRect(0, 0, 160, 90); this.smg.drawImage(this.emit, 0, 0, 160, 90);
      this.tng.clearRect(0, 0, 80, 45); this.tng.drawImage(this.small, 0, 0, 80, 45);
      lg.imageSmoothingEnabled = true;
      lg.globalCompositeOperation = 'lighter';
      lg.globalAlpha = 0.7; lg.drawImage(this.tiny, 0, 0, VIEW_W, VIEW_H);
      lg.globalAlpha = 0.45; lg.drawImage(this.small, 0, 0, VIEW_W, VIEW_H);
      lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
      lg.imageSmoothingEnabled = false;
    }

    // ---- final composite
    const sg = this.sg;
    sg.globalCompositeOperation = 'source-over';
    sg.globalAlpha = 1;
    sg.drawImage(this.back, 0, 0);
    sg.drawImage(this.lit, 0, 0);
    if (rich) {
      sg.globalCompositeOperation = 'lighter';
      sg.globalAlpha = 0.06;
      sg.drawImage(L.shafts, ox, oy);
      sg.globalAlpha = 0.1;
      for (const l of L.lights) if (l.kind === 'cone' && l.beam) { const c = cookie(l.r / 2, l.color, 'cone', l.angle, l.spread); sg.drawImage(c, Math.round(l.x - c.width), Math.round(l.y - c.height), c.width * 2, c.height * 2); }
      sg.globalAlpha = 1;
      sg.globalCompositeOperation = 'source-over';
    }
    sg.drawImage(this.world.fg, Math.round(ox * 1.3), Math.round(oy * 1.3));
    this.fx.drawGlyphs(sg, ox, oy);
    this.lola.worldPass(sg, state, figures, ox, oy);
    if (debug) this.drawDebug(sg, state, ox, oy);
    this.drawFocusLines(sg, dt);
    if (this.impact) {
      this.drawImpactFrame(sg, state, figures, ox, oy);
      if (dt > 0 && ++this.impact.n >= this.impact.frames) this.impact = null;
    }
    if (state.slowmo || state.drama) {
      sg.globalCompositeOperation = 'saturation';
      sg.fillStyle = state.slowmo ? 'rgba(128,128,128,0.6)' : 'rgba(128,128,128,0.3)';
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
      sg.globalCompositeOperation = 'source-over';
    }
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.flashT > 0 && settings.shake !== false) {
      sg.fillStyle = `rgba(255,244,220,${Math.min(0.45, this.flashT * 1.2)})`;
      sg.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    for (const e of state.effects || []) if (e.kind === 'text') drawText(sg, e.text, X(e.x) + ox, X(e.y) + oy - 20, { color: e.color, outline: '#140f1f', align: 'center', alpha: clamp(e.life * 3, 0, 1) });
    this.worldDrawn = true;
    return figures;
  }

  // Paints a live fighter with its feet at (fx, fy); returns the eye and hand points.
  paintFighter(g, a, fx, fy, time, { scale = 1 } = {}) {
    const face = a.face || 1;
    // Frozen in the hitlag of a blow it took: the body shivers along the hit.
    if (a.hitlag > 0 && a.hitstun > 0) fx += (Math.floor(time * 60) % 2 ? 1 : -1) * (a.hitHeavy ? 2 : 1) * scale;
    fx += morphJitter(a, time) * scale;
    const f = frameFor(a, time), frame = f.frame;
    const chains = this.secondary.update(a, frame, time, this.simDt);
    const sprites = figureSprite(a, f, variantOf(a, this.time), chains), flash = morphFlash(a) || (a.type === 2 && this.lola.flashOf(a.id));
    const s = flash ? tintOf(sprites.s, flash) : sprites.s, overlay = sprites.overlay && flash ? tintOf(sprites.overlay, flash) : sprites.overlay;
    const severed = a.severed || [];
    const ch = castFor(a.type, a.form), eye = ch.eye || EYE;
    const hand = figurePoint(frame, 'armF', HAND[0], HAND[1], fx, fy, face, scale, ch);
    // Nox as a swarm of bats, Lola between two places in a skip: nothing to draw.
    const behind = a.weapon === 'extinguisher', bats = a.act === 'swarm' || a.act === 'blink';
    const knives = a.type === 2 && !bats && !a.weapon;
    if (behind && !severed.includes('armF')) this.drawWeapon(g, a, frame, hand, face, scale);
    if (knives) handKnives(g, a, f, fx, fy, face, scale, this.time, 'back');
    if (overlay && !bats) drawFigure(g, overlay, fx, fy, face, scale);
    if (!bats) drawFigure(g, s, fx, fy, face, scale);
    if (knives) handKnives(g, a, f, fx, fy, face, scale, this.time, 'front');
    if (!behind && a.weapon && !severed.includes('armF')) this.drawWeapon(g, a, frame, hand, face, scale);
    for (const e of a.embedded || []) {
      if (severed.includes(e.part)) continue;
      const p = figurePoint(frame, e.part, 0, e.part === 'head' ? -5 : e.part === 'body' ? -4 : 2, fx, fy, face, scale);
      if (e.kind === 'knife') { embeddedKnife(g, p.x, p.y, (e.a || 0) * face); continue; }
      const da = (e.a || 0) * face + Math.PI;
      for (let i = 0; i < 5; i++) { g.fillStyle = i < 2 ? '#3e2c2c' : i === 4 ? '#ffffff' : '#c9d3de'; g.fillRect(Math.round(p.x + Math.cos(da) * (i - 1)), Math.round(p.y + Math.sin(da) * (i - 1)), 1, 1); }
    }
    if (f.ball) this.drawBall(g, fx, fy, scale, time);
    // Weapon smears are drawn later, over the lighting, so they read as bright streaks.
    const smear = f.smear && isMelee(a.weapon) && !severed.includes('armF') ? { sm: f.smear, frame } : null;
    return { eye: figurePoint(frame, 'head', eye[0], eye[1], fx, fy, face, scale, ch), hand, sprite: s, overlay, smear, frame, name: f.name };
  }

  // Thick pixel line along points (the electric cable).
  tube(g, pts, width, colors, stripe = null, thin = false) {
    if (!pts || pts.length < 2) return;
    const r = Math.max(0.5, width / 2);
    const samples = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 0.8));
      for (let k = 0; k < n; k++) samples.push([a.x + (b.x - a.x) * (k / n), a.y + (b.y - a.y) * (k / n), i]);
    }
    samples.push([pts[pts.length - 1].x, pts[pts.length - 1].y, pts.length - 1]);
    const taper = i => r * (1 - (i / samples.length) * 0.45);
    if (!thin) {
      g.fillStyle = colors[0];
      samples.forEach(([x, y], i) => { const rr = Math.round(taper(i)); g.fillRect(Math.round(x) - rr - 1, Math.round(y) - rr - 1, rr * 2 + 2, rr * 2 + 2); });
    }
    samples.forEach(([x, y, seg], i) => { const rr = Math.round(taper(i)); g.fillStyle = stripe && seg % 2 ? stripe : colors[1]; g.fillRect(Math.round(x) - rr, Math.round(y) - rr, Math.max(1, rr * 2), Math.max(1, rr * 2)); });
    if (!thin) { g.fillStyle = colors[2]; samples.forEach(([x, y], i) => { if (i % 2 === 0) g.fillRect(Math.round(x - taper(i) * 0.5), Math.round(y - taper(i) * 0.5), 1, 1); }); }
  }

  drawWeapon(g, a, frame, hand, face, scale) {
    const kind = a.weapon, sc = WEAPON_SCALE * scale;
    const def = weaponDef(kind);
    if (!def) return;
    let sp;
    if (kind === 'pistol' || kind === 'shotgun') {
      const aim = a.aim ?? (face > 0 ? 0 : Math.PI), right = Math.cos(aim) >= 0;
      sp = sprite(def, MATS, { angle: right ? aim : aim - Math.PI, mirror: right ? 1 : -1, scale: sc });
      g.drawImage(sp.canvas, Math.round(hand.x + Math.cos(aim) * 3 * scale) - sp.ox, Math.round(hand.y + Math.sin(aim) * 3 * scale) - sp.oy);
      return;
    }
    if (kind === 'extinguisher') {
      sp = sprite(def, MATS, { angle: 0, mirror: face, scale: sc });
      g.drawImage(sp.canvas, Math.round(hand.x) - sp.ox, Math.round(hand.y - 2 * scale) - sp.oy);
      return;
    }
    // Melee: during an attack the weapon extends straight out along the arm; at rest it is
    // held at the weapon's own grip angle (blades up, the spear level).
    const attacking = a.attack > 0 && MOVES[a.attackKind]?.weapon;
    const deg = (frame.armF?.[2] || 0) + 90 + (attacking ? 0 : WEAPON_INFO[kind]?.grip ?? -90);
    const ang = (deg * Math.PI) / 180;
    sp = sprite(def, MATS, { angle: face > 0 ? ang : -ang, mirror: face, scale: sc });
    g.drawImage(sp.canvas, Math.round(hand.x) - sp.ox, Math.round(hand.y) - sp.oy);
  }

  // The blur a blade leaves along its arc (anime smear): a fan from where the swing started to
  // where the weapon is now, brightest at the leading edge; straight streaks for thrusts and a
  // ring for spins.
  drawSmear(g, a, frame, sm, fx, fy, face, scale) {
    const info = WEAPON_INFO[a.weapon];
    const sh = figurePoint(frame, 'armF', 0, 0, fx, fy, face, scale);
    const R1 = (3.5 + info.len * WEAPON_SCALE) * scale, R0 = R1 * 0.45;
    g.fillStyle = info.smear;
    if (sm.style === 'swing') {
      const from = sm.from, to = sm.cur, span = Math.abs(to - from), n = Math.max(2, Math.ceil(span / 4));
      for (let i = 0; i <= n; i++) {
        const t = i / n, d = ((from + (to - from) * t + 90) * Math.PI) / 180;
        const c = Math.cos(d) * face, s = Math.sin(d);
        g.globalAlpha = (0.08 + 0.62 * t * t) * sm.k;
        for (let r = R0 + (1 - t) * (R1 - R0) * 0.5; r <= R1; r += 1) g.fillRect(Math.round(sh.x + c * r), Math.round(sh.y + s * r), 1, 1);
      }
      // Bright leading edge.
      const d = ((to + 90) * Math.PI) / 180;
      g.globalAlpha = 0.9 * sm.k;
      g.fillStyle = '#ffffff';
      for (let r = R0; r <= R1; r += 1) g.fillRect(Math.round(sh.x + Math.cos(d) * face * r), Math.round(sh.y + Math.sin(d) * r), 1, 1);
    } else if (sm.style === 'thrust') {
      const d = ((sm.cur + 90) * Math.PI) / 180, c = Math.cos(d) * face, s = Math.sin(d);
      const tip = R1 + (sm.dx || 0) * scale;
      for (const off of [-2, 0, 2]) {
        g.globalAlpha = (off ? 0.35 : 0.7) * sm.k;
        for (let r = tip - 12 * scale; r <= tip - 2; r += 1) g.fillRect(Math.round(sh.x + c * r - s * off), Math.round(sh.y + s * r + c * off * face), 1, 1);
      }
    } else if (sm.style === 'spin') {
      const cx = fx, cy = fy - 8 * scale, n = Math.round(R1 * 7);
      for (let i = 0; i < n; i++) {
        const d = (i / n) * Math.PI * 2;
        g.globalAlpha = (0.25 + 0.35 * ((i + Math.floor(this.time * 40)) % 7) / 7) * sm.k;
        g.fillRect(Math.round(cx + Math.cos(d) * R1), Math.round(cy + Math.sin(d) * R1 * 0.8), 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  // Marola's hamster ball: a see-through shell with a glint, around the curled-up rat.
  drawBall(g, fx, fy, scale, time) {
    const r = 12 * scale, cx = fx, cy = fy - 8 * scale;
    g.fillStyle = 'rgba(190,226,255,0.16)';
    for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
    const n = Math.round(r * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      const lit = Math.cos(a + 2.4) > 0.3;
      g.fillStyle = lit ? 'rgba(240,250,255,0.85)' : 'rgba(150,190,230,0.55)';
      g.fillRect(x, y, 1, 1);
    }
    const spin = time * 6;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.round(cx + Math.cos(-2.3 + i * 0.18) * (r - 3)), Math.round(cy + Math.sin(-2.3 + i * 0.18) * (r - 3)), 1, 1);
    g.fillStyle = 'rgba(200,230,255,0.5)';
    for (let i = 0; i < 4; i++) { const a = spin + (i * Math.PI) / 2; g.fillRect(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1) * 0.3), 1, 1); }
  }

  // ---------------------------------------------------------------------------------------
  drawWallShadows(lg, figures, hz, ox, oy) {
    if (!hz) return;
    lg.globalCompositeOperation = 'source-atop';
    for (const f of figures) {
      let best = null, bd = 150;
      for (const l of hz.lamps) {
        if (!l.on) continue;
        const d = Math.hypot(X(l.x) - f.cx, X(l.y) - f.cy);
        if (d < bd) { bd = d; best = l; }
      }
      if (!best) continue;
      const dx = Math.round((f.cx - X(best.x)) * 0.14), dy = Math.round((f.cy - X(best.y)) * 0.1) + 3;
      lg.globalAlpha = 0.42 * (1 - bd / 150);
      lg.drawImage(f.fc.shadow.c, f.x + dx, f.y + dy);
    }
    lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'source-over';
  }

  figureCanvases(id) {
    let f = this.figCache.get(id);
    if (!f) {
      const make = () => { const c = mk(FIG_W, FIG_H); const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return { c, g, img: g.createImageData(FIG_W, FIG_H) }; };
      f = { body: make(), shadow: make(), rim: [make(), make()] };
      this.figCache.set(id, f);
    }
    return f;
  }

  // Silhouette shadow and rim masks computed on the CPU from the fighter's own pixels.
  bakeFigure(f, L, rich) {
    const A = f.fc.alpha, W = FIG_W, H = FIG_H;
    if (rich) {
      const sd = f.fc.shadow.img.data;
      for (let i = 0; i < W * H; i++) { const k = i * 4; if (A[k + 3]) { sd[k] = 14; sd[k + 1] = 10; sd[k + 2] = 24; sd[k + 3] = 255; } else sd[k + 3] = 0; }
      f.fc.shadow.g.putImageData(f.fc.shadow.img, 0, 0);
    }
    const lights = L.rimAt(f.cx, f.cy, 1);
    lights.push({ k: 0.22, dx: 0.7, dy: -0.7, color: '#8f9cff' });
    f.rims = [];
    lights.slice(0, 2).forEach((r, n) => {
      const dx = Math.round(r.dx), dy = Math.round(r.dy);
      if (!dx && !dy) return;
      const slot = f.fc.rim[n], d = slot.img.data;
      const [cr, cg, cb] = hexToRgb(r.color);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        d[k + 3] = 0;
        if (!A[k + 3]) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && A[(ny * W + nx) * 4 + 3]) continue;
        d[k] = cr; d[k + 1] = cg; d[k + 2] = cb; d[k + 3] = 255;
      }
      slot.g.putImageData(slot.img, 0, 0);
      f.rims.push({ c: slot.c, alpha: Math.min(0.9, r.k * 1.1) });
    });
  }

  drawContactShadows(lg, state, ox, oy) {
    const put = (x, feet, w) => {
      const top = surfaceY(x, feet - 6);
      const h = top - feet;
      if (h > 140 || top > 560) return;
      const sh = contactShadow(w * (1 - h / 200));
      lg.globalAlpha = Math.max(0.15, 1 - h / 140);
      lg.drawImage(sh, Math.round(X(x) - sh.width / 2) + ox, X(top) - 2 + oy);
      lg.globalAlpha = 1;
    };
    for (const a of state.actors) if (!a.dead && !a.knocked && a.act !== 'swarm') put(a.x, a.y + FOOT, a.act === 'ball' ? 16 : 11);
    for (const p of state.props) if (p.kind !== 'glass' && p.kind !== 'cargo') put(p.x, p.y + p.h / 2, X(p.w) + 2);
  }

  drawProp(lg, p, ox, oy, t) {
    if (p.kind === 'glass') {
      const x = X(p.x - p.w / 2) + ox, y = X(p.y - p.h / 2) + oy, w = X(p.w), h = X(p.h);
      lg.fillStyle = 'rgba(150,210,230,0.22)'; lg.fillRect(x, y, w, h);
      lg.fillStyle = 'rgba(220,245,255,0.55)'; lg.fillRect(x, y, 1, h); lg.fillRect(x, y, w, 1);
      for (let i = 4; i < h - 4; i += 9) lg.fillRect(x + 2, y + i, 1, 4);
      lg.fillStyle = '#2b2540'; lg.fillRect(x - 1, y + h, w + 2, 2);
      return;
    }
    drawPropSprite(lg, p, ox, oy);
  }

  drawLimbs(lg, state, ox, oy, t, boost = 0) {
    const limbs = (state.limbs || []).slice().sort((a, b) => (PART_ORDER[a.part] ?? 0) - (PART_ORDER[b.part] ?? 0));
    for (const l of limbs) {
      const owner = state.actors.find(a => a.id === l.actor);
      const xray = l.shock && Math.floor(t * 18) % 2 === 0;
      const variant = (l.char > 0.55 ? 'char2' : l.char > 0.25 ? 'char1' : '') + (l.frozen ? 'ice' : '') + (xray ? 'xray' : '');
      const expr = l.part === 'head' ? (l.attached && owner && !owner.dead ? 'Hurt' : 'Dead') : '';
      const sp = partSprite(l, variant, expr);
      if (!sp) continue;
      const cx = X(l.x) + ox, cy = X(l.y) + oy;
      lg.globalAlpha = (l.life < 1.5 ? Math.max(0, l.life / 1.5) : 1) * (boost || 1);
      lg.drawImage(sp.canvas, cx - sp.px, cy - sp.py);
      if (!boost) for (const e of l.embedded || []) {
        const da = (e.a || 0) + Math.PI;
        for (let i = 0; i < 5; i++) { lg.fillStyle = i < 2 ? '#3e2c2c' : '#c9d3de'; lg.fillRect(Math.round(cx + Math.cos(da) * (i - 1)), Math.round(cy + Math.sin(da) * (i - 1)), 1, 1); }
      }
      lg.globalAlpha = 1;
    }
    for (const p of state.pins || []) { lg.fillStyle = '#c9d3de'; lg.fillRect(X(p.x) + ox - 3, X(p.y) + oy, 6, 1); lg.fillStyle = '#3e2c2c'; lg.fillRect(X(p.x) + ox - 5, X(p.y) + oy - 1, 2, 3); }
  }

  drawLamps(lg, hz, ox, oy) {
    for (const l of hz.lamps) {
      const ax = X(l.ax) + ox, ay = X(l.ay) + oy, lx = X(l.x) + ox, ly = X(l.y) + oy - 3;
      const steps = Math.max(1, Math.round(Math.hypot(lx - ax, ly - ay)));
      for (let i = 0; i <= steps; i += 1) { lg.fillStyle = i % 3 === 0 ? '#5d5378' : '#2b2540'; lg.fillRect(Math.round(ax + (lx - ax) * (i / steps)), Math.round(ay + (ly - ay) * (i / steps)), 1, 1); }
      const sp = sprite(LAMP_DEF(l.on), MATS, { angle: l.a || 0 });
      lg.drawImage(sp.canvas, lx - sp.ox, ly + 2 - sp.oy);
    }
  }

  drawCargoChain(lg, state, ox, oy) {
    const cargo = state.props.find(p => p.kind === 'cargo');
    const cx = X(MAP.cargo.x) + ox, top = X(MAP.cargo.anchorY) + oy;
    lg.fillStyle = '#2b2540'; lg.fillRect(cx - 8, top - 9, 16, 9);
    lg.fillStyle = '#5d5378'; lg.fillRect(cx - 8, top - 9, 16, 1);
    lg.fillStyle = '#15111f'; lg.fillRect(cx - 7, top - 1, 3, 2); lg.fillRect(cx + 4, top - 1, 3, 2);
    if (!cargo || !cargo.chain) return;
    const h = MAP.cargo.h / 2, a = cargo.angle || 0;
    const ex = X(cargo.x + Math.sin(a) * h) + ox, ey = X(cargo.y - Math.cos(a) * h) + oy;
    const n = Math.max(1, Math.round(Math.hypot(ex - cx, ey - top)));
    for (let i = 0; i <= n; i++) { lg.fillStyle = i % 2 ? '#8a87a2' : '#3a3352'; lg.fillRect(Math.round(cx + (ex - cx) * (i / n)), Math.round(top + (ey - top) * (i / n)), i % 2 ? 1 : 2, 1); }
    lg.fillStyle = '#8a87a2'; lg.fillRect(ex - 2, ey - 1, 4, 2);
  }

  drawHazards(lg, hz, ox, oy, t) {
    const f = (x, y, w, h, c) => { lg.fillStyle = c; lg.fillRect(Math.round(x) + ox, Math.round(y) + oy, Math.round(w), Math.round(h)); };
    // Conveyor
    const cv = MAP.conveyor, x0 = X(cv.x0), x1 = X(cv.x1), cy = X(cv.y);
    f(x0 - 3, cy - 1, x1 - x0 + 6, 5, '#1d182c');
    const off = Math.floor(hz.conveyor.offset * S) % 6;
    for (let x = x0; x < x1; x++) { const k = ((x - x0 - off) % 6 + 6) % 6; f(x, cy, 1, 1, k < 3 ? '#5a5276' : '#3a3352'); f(x, cy + 1, 1, 2, k === 0 ? '#2a2540' : '#433a5c'); }
    for (const rx of [x0, x1 - 1]) { f(rx - 2, cy, 4, 4, '#6a6088'); f(rx - 1, cy + 1, 2, 2, (Math.floor(t * 8) % 2) ? '#8a80a8' : '#3a3352'); }
    f(x0 + 6, cy + 4, 2, 1, hz.conveyor.dir > 0 ? P.hazard : '#3a3352'); f(x1 - 8, cy + 4, 2, 1, hz.conveyor.dir < 0 ? P.hazard : '#3a3352');
    // Lever
    const lv = MAP.conveyor.lever, lx = X(lv.x), ly = X(lv.y) + 8;
    f(lx - 4, ly, 9, 6, '#3a3352'); f(lx - 4, ly, 9, 1, '#6a6088');
    const la = hz.conveyor.dir > 0 ? 0.5 : -0.5;
    for (let i = 0; i < 9; i++) f(lx + Math.sin(la) * i, ly - Math.cos(la) * i, 1, 1, '#8a87a2');
    f(lx + Math.sin(la) * 9 - 1, ly - Math.cos(la) * 9 - 1, 3, 3, '#d43c3c');
    // Puddle
    const pd = MAP.puddle, px0 = X(pd.x0), px1 = X(pd.x1), py = X(pd.y);
    for (let x = px0; x < px1; x++) {
      const k = (x - px0) / (px1 - px0), h = Math.round(Math.sin(k * Math.PI) * 2);
      f(x, py - h + 1, 1, h + 1, hz.puddle.live && Math.random() < 0.3 ? P.zap2 : (x + Math.floor(t * 4)) % 9 === 0 ? P.water3 : P.water1);
    }
    // Pit grinder
    const pa = X(MAP.pit.x0), pb = X(MAP.pit.x1), gy = 346;
    for (let x = pa + 2; x < pb - 2; x++) {
      const k = ((x + Math.floor(t * 40)) % 6);
      f(x, gy + (k < 3 ? 0 : 2), 1, 3, k < 3 ? '#8a87a2' : '#4a4264');
      const k2 = ((x - Math.floor(t * 40)) % 6 + 6) % 6;
      f(x, gy + 6 + (k2 < 3 ? 0 : 2), 1, 3, k2 < 3 ? '#6a6088' : '#3a3352');
    }
    // Press: piston and head
    const pr = MAP.press, P0 = X(pr.x0), P1 = X(pr.x1), head = X(hz.press.y), hh = X(pr.headH);
    const mid = (P0 + P1) / 2;
    f(mid - 6, 200, 12, head - 200, '#8a87a2'); f(mid - 6, 200, 2, head - 200, '#c4c0d8'); f(mid + 4, 200, 2, head - 200, '#4a4264');
    f(P0, head, P1 - P0, hh, '#3e3757'); f(P0, head, P1 - P0, 1, '#8a80a8'); f(P0, head + hh - 1, P1 - P0, 1, '#15111f');
    for (let x = P0; x < P1; x++) f(x, head + hh - 6, 1, 4, ((x >> 2) % 2) ? P.hazard : '#1d1a26');
    for (const bx of [P0 + 4, P1 - 7]) f(bx, head + 4, 3, 3, '#8a87a2');
    // Press button
    const b = pr.button;
    f(X(b.x) - 2, X(b.y) - 2, X(b.w) + 4, X(b.h) + 4, '#2b2540');
    f(X(b.x), X(b.y), X(b.w), X(b.h), hz.press.state === 'up' ? '#d43c3c' : '#6a2a2a');
    // Cable
    const pts = hz.cable.map(([x, y]) => ({ x: X(x) + ox, y: X(y) + oy }));
    this.tube(lg, [{ x: X(MAP.cable.x) + ox, y: X(MAP.cable.y) + oy }, ...pts], 2, ['#0e0a14', '#2a2430', '#4a4252']);
    const end = pts[pts.length - 1];
    lg.fillStyle = '#e8a35e'; lg.fillRect(Math.round(end.x), Math.round(end.y), 2, 2);
  }

  drawNeonBoard(lg, ox, oy, lit, t) {
    drawText(lg, 'DEPÓSITO 07', 320 + ox, 210 + oy, { color: lit ? '#ffb3cc' : '#4a2a3e', scale: 2, align: 'center' });
  }

  neonOn(t) {
    const k = Math.floor(t * 10);
    return !((k % 97) < 2 || (k % 53) === 0);
  }

  // ---------------------------------------------------------------------------------------
  collectLights(state, hz, figures, t) {
    const L = this.light, add = l => L.add(l);
    if (hz) for (const l of hz.lamps) {
      if (!l.on) continue;
      const x = X(l.x), y = X(l.y) + 4;
      const flick = 0.92 + Math.sin(t * 23 + l.ax) * 0.04;
      const light = { x, y, r: l.under ? 110 : 150, color: '#ffd59a', i: flick, kind: 'cone', angle: -(l.a || 0), spread: l.under ? 0.85 : 0.5, occlude: true, beam: !l.under };
      add(light);
      add({ x, y, r: 20, color: '#ffe8c0', i: 0.7, noRim: true });
    }
    if (hz && (hz.press.state === 'warn' || hz.press.state === 'slam')) add({ x: 600, y: 206, r: 110, color: '#ff3a3a', i: 0.6 + Math.sin(t * 18) * 0.4, kind: 'point', occlude: true });
    for (const f of state.fires || []) add({ x: X(f.x), y: X(f.y) - 8, r: 64, color: '#ff9a45', i: 0.85 + Math.sin(t * 31 + f.x) * 0.15, occlude: true });
    for (const a of state.actors) if (!a.dead && a.burning > 0) add({ x: X(a.x), y: X(a.y) - 6, r: 50, color: '#ff9a45', i: 0.8 });
    for (const p of state.props) if (p.rocket || p.burning > 0) add({ x: X(p.x), y: X(p.y), r: 54, color: '#ffae5a', i: 0.8 });
    // Lola's knives give a small cold light; other shots a warm one.
    for (const b of state.bullets || []) add(b.kind === 'knife' ? { x: X(b.x), y: X(b.y), r: 10, color: '#cfe4ff', i: 0.45, noRim: true } : { x: X(b.x), y: X(b.y), r: b.word ? 22 : 14, color: b.word ? b.color : '#ffe2a0', i: 0.6, noRim: !!b.word });
    if (hz) {
      const end = hz.cable[hz.cable.length - 1];
      if (Math.random() < 0.6) add({ x: X(end[0]), y: X(end[1]), r: 30, color: '#8af0ff', i: 0.5 + Math.random() * 0.4 });
      if (hz.puddle.live) add({ x: X((MAP.puddle.x0 + MAP.puddle.x1) / 2), y: X(MAP.puddle.y) - 4, r: 60, color: '#6ad8ff', i: 0.8 * Math.random() + 0.2 });
    }
    for (const f of figures) if (f.a.type === 3) {
      const k = this.jumaGlow(f.a, t);
      if (f.a.form === 'beast' && f.info?.eye && !(f.a.severed || []).includes('head')) add({ x: f.info.eye.x, y: f.info.eye.y, r: 10, color: '#ffc040', i: 0.7, noRim: true });
      if (k > 0.05) add({ x: f.hx, y: f.hy - 12, r: 26 + k * 46, color: k > 0.8 ? '#ffe2a0' : '#ff8a3a', i: k * 1.3 });
    }
    for (const f of figures) if (f.a.type === 4 && f.info?.eye) {
      add({ x: f.info.eye.x, y: f.info.eye.y, r: 10, color: '#ff4f6e', i: 0.7, noRim: true });
      // The blood orb lights the claw up as it condenses.
      const at = f.a.actT ?? 0;
      if (f.a.act === 'swarm') add({ x: f.hx, y: f.hy - 12, r: 34, color: this.fx.gore === 0 ? '#9a5aff' : '#ff3048', i: 0.7 });
      if (f.a.act === 'beam' && at < 0.46) add({ x: f.info.hand.x, y: f.info.hand.y, r: 16 + Math.min(1, at / 0.34) * 36, color: this.fx.gore === 0 ? '#9a5aff' : '#ff3048', i: 0.5 + Math.min(1, at / 0.34) * 0.9 });
    }
  }

  drawEmissive(eg, state, hz, figures, ox, oy, t) {
    if (hz) for (const l of hz.lamps) if (l.on) {
      const x = X(l.x) + ox, y = X(l.y) + oy + 5;
      eg.fillStyle = '#fff4d0'; eg.fillRect(x - 2, y, 5, 2); eg.fillStyle = '#ffffff'; eg.fillRect(x - 1, y, 3, 1);
    }
    if (this.neonOn(t)) this.drawNeonBoard(eg, ox, oy, true, t);
    drawText(eg, 'SAÍDA', 78 + ox, 283 + oy, { color: '#5affa4' });
    eg.fillStyle = '#5fd8f0'; eg.fillRect(40 + ox, 135 + oy, 12, 9); eg.fillRect(582 + ox, 135 + oy, 12, 9);
    eg.fillStyle = '#ff3a2a'; eg.fillRect(318 + ox, 357 + oy, 4, 2);
    if (hz && (hz.press.state === 'warn' || hz.press.state === 'slam') && Math.floor(t * 8) % 2) { eg.fillStyle = '#ff4a4a'; eg.fillRect(597 + ox, 201 + oy, 6, 4); }
    if (hz) {
      const [ex, ey] = hz.cable[hz.cable.length - 1];
      if (Math.random() < 0.5) { eg.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#9af6ff'; eg.fillRect(X(ex) + ox + Math.round(rnd(-2, 2)), X(ey) + oy + Math.round(rnd(-2, 2)), 1, 1); }
      if (hz.puddle.live && Math.random() < 0.5) {
        const x0 = X(MAP.puddle.x0), x1 = X(MAP.puddle.x1);
        this.fx.zaps.push({ x1: rnd(x0, x1), y1: X(MAP.puddle.y), x2: rnd(x0, x1), y2: X(MAP.puddle.y) - rnd(2, 8), life: 0.05, seed: Math.floor(Math.random() * 999) });
      }
    }
    for (const b of state.bullets || []) {
      if (b.kind === 'knife') continue;
      const x = X(b.x) + ox, y = X(b.y) + oy;
      if (b.word) drawText(eg, b.word, x, y - 5, { color: b.color, outline: '#1a1424', align: 'center' });
      else {
        const px0 = X(b.px ?? b.x) + ox, py0 = X(b.py ?? b.y) + oy;
        const n = Math.max(1, Math.round(Math.hypot(x - px0, y - py0)));
        for (let i = 0; i <= n; i++) { eg.fillStyle = i > n - 2 ? '#ffffff' : '#ffd890'; eg.globalAlpha = 0.3 + (i / n) * 0.7; eg.fillRect(Math.round(px0 + (x - px0) * (i / n)), Math.round(py0 + (y - py0) * (i / n)), 1, 1); }
        eg.globalAlpha = 1;
      }
    }
    for (const p of state.props) if ((p.armed && ['grenade', 'mine', 'c4'].includes(p.kind) && Math.floor(t * 6) % 2) || p.kind === 'molotov' && p.armed) { eg.fillStyle = p.kind === 'molotov' ? P.fire1 : '#ff4a4a'; eg.fillRect(X(p.x) + ox, X(p.y) + oy - 3, 1, 1); }
    for (const e of state.effects || []) if (e.kind === 'beam') {
      const n = Math.round(Math.hypot(X(e.tx) - X(e.x), X(e.ty) - X(e.y)));
      eg.fillStyle = e.color;
      for (let i = 0; i < n; i++) if ((i + Math.floor(t * 30)) % 4) eg.fillRect(Math.round(X(e.x) + (X(e.tx) - X(e.x)) * (i / n)) + ox, Math.round(X(e.y) + (X(e.ty) - X(e.y)) * (i / n)) + oy, 1, 1);
    }
    for (const f of figures) if (f.a.type === 4 && f.info?.eye && !(f.a.severed || []).includes('head')) { eg.fillStyle = '#ff6f86'; eg.fillRect(Math.round(f.info.eye.x) + ox, Math.round(f.info.eye.y) + oy, 1, 1); }
    const st = state.time ?? t;
    for (const f of figures) if (f.a.type === 3) this.drawJuma(eg, f, ox, oy, st);
    for (const f of figures) {
      if (f.a.type === 4 && f.a.act === 'swarm') this.drawSwarm(eg, f, ox, oy, st);
      if (f.a.type === 4) {
        // When the scythe is put away it comes apart into blood where its head was.
        // It forms out of the blood over a few frames whenever it comes back into his hand.
        const pres = this.scythePresence.get(f.a.id) ?? 0;
        const fa = f.fc.alpha, fxo = f.x, fyo = f.y;
        const mask = (x, y) => { const lx = x - fxo, ly = y - fyo; return lx >= 0 && ly >= 0 && lx < FIG_W && ly < FIG_H && fa[(ly * FIG_W + lx) * 4 + 3] > 0; };
        const sc = drawBloodArt(eg, f.a, f.info.frame, f.hx + ox, f.hy + oy, st, { gore: this.fx.gore, presence: pres, mask });
        const was = this.scythes.get(f.a.id);
        if (was && !sc && this.simDt > 0) this.fx.scytheBurst(was.x - ox, was.y - oy, was.tx - ox, was.ty - oy);
        this.scythes.set(f.a.id, sc || null);
        this.scythePresence.set(f.a.id, sc ? Math.min(1, pres + this.simDt * 6) : 0);
        // Dragged behind him at a run, its head scrapes sparks off the floor.
        if (sc && f.a.ground && Math.abs(f.a.vx || 0) > 3 && sc.y >= f.hy + oy - 3 && this.simDt > 0 && Math.random() < 0.6) this.fx.burst('spark', sc.x - ox, f.hy - 1, 1, { a: (f.a.face || 1) > 0 ? Math.PI + 0.4 : -0.4, spread: 0.8, s: 1.8, life: 0.25, colors: ['#ffffff', '#ffd0a0', this.fx.pal().light], g: 0.1, b: 0.3, em: true });
      }
      if (f.a.bloodMark) drawMarks(eg, f.a, f.hx + ox, f.hy + oy - (f.a.type === 2 ? 34 : 31), st, this.fx.gore);
    }
    this.fx.drawHemo(eg, ox, oy, t);
    this.fx.drawEmissive(eg, ox, oy, t);
    // In stopped time Lola's effects are drawn in color over the gray world instead (worldPass).
    if (!state.timeStop) this.lola.drawEmissive(eg, state, ox, oy);
  }

  // Screen-space overlays drawn over the HUD (ZA WARUDO's cut-in, bars and captions).
  drawOverlay(g, state) { if (state) this.lola.drawOverlay(g, state); }

  // How strongly Juma glows: swelling through the transformation, a smoulder as the beast.
  jumaGlow(a, t) {
    const at = a.actT ?? 0;
    if (a.act === 'morph') return at < 0.12 ? (at / 0.12) * 0.3 : at < 0.6 ? 0.3 + ((at - 0.12) / 0.48) * 0.7 : Math.max(0, 1 - (at - 0.6) / 0.3);
    if (a.act === 'unmorph') return at < 0.38 ? 0.45 : 0;
    if (a.form === 'beast') return 0.16 + 0.06 * Math.sin(t * 6) + (a.attack > 0 ? 0.12 : 0);
    return 0;
  }

  // Juma over the lighting: an aura around her silhouette that pulses outward as she swells (and
  // smoulders around the beast), and the beast's burning eyes leaving a streak when she moves fast.
  drawJuma(eg, f, ox, oy, t) {
    const a = f.a, k = this.jumaGlow(a, t);
    if (k > 0.03 && f.info.sprite) {
      const ag = this.ag, face = a.face || 1, hot = k > 0.75, r = k > 0.55 ? 2 : 1;
      ag.globalCompositeOperation = 'source-over';
      ag.clearRect(0, 0, FIG_W, FIG_H);
      const tint = tintOf(f.info.sprite, hot ? '#ffe2a0' : '#ff8a3a'), tov = f.info.overlay && tintOf(f.info.overlay, hot ? '#ffe2a0' : '#ff8a3a');
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        if (tov) drawFigure(ag, tov, FIG_X + dx + morphJitter(a, t), FIG_Y + dy, face);
        drawFigure(ag, tint, FIG_X + dx + morphJitter(a, t), FIG_Y + dy, face);
      }
      ag.globalCompositeOperation = 'destination-out';
      ag.drawImage(f.fc.body.c, 0, 0);
      ag.globalCompositeOperation = 'source-over';
      eg.globalAlpha = Math.min(1, k * 1.2) * (0.65 + 0.35 * Math.abs(Math.sin(t * (a.act === 'morph' ? 22 : 5))));
      eg.drawImage(this.aura, f.x, f.y);
      eg.globalAlpha = 1;
    }
    const trail = this.eyeTrail.get(a.id) || [];
    if (a.form === 'beast' && f.info.eye && !(a.severed || []).includes('head')) {
      const ex = Math.round(f.info.eye.x), ey = Math.round(f.info.eye.y);
      if (this.simDt > 0) { trail.push({ x: ex, y: ey }); if (trail.length > 7) trail.shift(); }
      for (let i = 1; i < trail.length; i++) {
        const p = trail[i - 1], q = trail[i], n = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
        if (n < 2) continue;
        eg.globalAlpha = (i / trail.length) * 0.8;
        eg.fillStyle = i > trail.length - 3 ? '#ffe04a' : '#ff8a2a';
        for (let s = 0; s <= n; s++) eg.fillRect(Math.round(p.x + (q.x - p.x) * (s / n)) + ox, Math.round(p.y + (q.y - p.y) * (s / n)) + oy, 1, 1);
      }
      eg.globalAlpha = 1;
      eg.fillStyle = '#fff4a0';
      eg.fillRect(ex + ox, ey + oy, 1, 1);
    } else trail.length = 0;
    this.eyeTrail.set(a.id, trail);
  }

  spawnAmbientFx(state, hz, dt) {
    const fx = this.fx;
    // Juma: steam and embers pour off her as she transforms; the beast smoulders and breathes steam.
    const STEAM = ['#e8e4f0', '#c8c0d8', '#a8a0c0'], EMBER = ['#ffe2a0', '#ffb040', '#ff6a2a'];
    for (const a of state.actors) {
      if (a.dead || a.knocked || a.type !== 3) continue;
      const x = X(a.x), y = X(a.y), at = a.actT ?? 0;
      if (a.act === 'morph' && at > 0.08 && at < 0.62) {
        if (Math.random() < 0.7) fx.burst('steam', x + rnd(-6, 6), y + rnd(-6, 8), 1, { a: -Math.PI / 2, spread: 0.8, s: 0.9, life: 0.7, colors: STEAM, em: true, g: -0.05, drag: 0.94, size: 2, grow: 0.05 });
        if (Math.random() < 0.6) fx.burst('spark', x + rnd(-8, 8), y + rnd(-8, 10), 1, { a: -Math.PI / 2, spread: 0.9, s: 1.2, life: 0.6, colors: EMBER, g: -0.03, drag: 0.96, em: true });
      } else if (a.act === 'unmorph' && at < 0.4 && Math.random() < 0.6) fx.burst('steam', x + rnd(-6, 6), y + rnd(-6, 6), 1, { a: -Math.PI / 2, spread: 0.9, s: 0.8, life: 0.8, colors: STEAM, em: true, g: -0.04, drag: 0.94, size: 2, grow: 0.05 });
      else if (a.form === 'beast') {
        if (Math.random() < dt * 5) fx.burst('spark', x + rnd(-7, 7), y + rnd(-10, 6), 1, { a: -Math.PI / 2, spread: 0.8, s: 0.7, life: 0.7, colors: EMBER, g: -0.025, drag: 0.97, em: true });
        // A breath of steam from the jaws every so often.
        if (!a.attack && Math.random() < dt * 0.9) fx.burst('steam', x + (a.face || 1) * 9, y - 6, 3, { a: (a.face || 1) > 0 ? -0.3 : Math.PI + 0.3, spread: 0.6, s: 0.7, life: 0.6, colors: STEAM, em: true, g: -0.03, drag: 0.94, size: 1, grow: 0.04 });
      }
    }
    for (const f of state.fires || []) if (Math.random() < 0.9) fx.burst('fire', X(f.x) + rnd(-12, 12), X(f.y) - 2, 2, { a: -Math.PI / 2, spread: 0.7, s: 0.9, life: 0.6, colors: [P.fire0, P.fire1, P.fire2], g: -0.04, drag: 0.96, size: 2, em: true });
    for (const a of state.actors) {
      if (a.dead) continue;
      if (a.burning > 0 && Math.random() < 0.8) fx.burst('fire', X(a.x) + rnd(-5, 5), X(a.y) + rnd(-12, 12), 1, { a: -Math.PI / 2, spread: 0.6, s: 0.8, life: 0.5, colors: [P.fire0, P.fire1, P.fire2], g: -0.05, size: 2, em: true });
      if (a.frozen > 0 && Math.random() < 0.08) fx.burst('frost', X(a.x) + rnd(-6, 6), X(a.y) + rnd(-14, 10), 1, { s: 0.3, life: 0.8, colors: [P.ice0], g: 0.01, em: true });
      if (a.bleed > 0.3 && this.fx.gore && Math.random() < dt * (2 + a.bleed * 2)) fx.burst('blood', X(a.x) + rnd(-4, 4), X(a.y) + rnd(-10, 6), 2 + Math.round(a.bleed), { a: -Math.PI / 2, spread: 1.4, s: 1.6, life: 0.8, colors: [P.blood2, P.blood1, P.blood3], stick: true, size: 1 });
    }
    for (const l of state.limbs || []) if (l.bleed > 0.4 && this.fx.gore && Math.random() < dt * l.bleed * 3) fx.burst('blood', X(l.x), X(l.y), 2, { a: -Math.PI / 2, spread: 2, s: 1.2, life: 0.7, colors: [P.blood2, P.blood1], stick: true });
    for (const p of state.props) {
      if (p.rocket) fx.burst('fire', X(p.x) - Math.sin(p.angle) * -8, X(p.y) + Math.cos(p.angle) * 10, 3, { a: p.angle + Math.PI / 2, spread: 0.4, s: 2.4, life: 0.35, colors: [P.fire0, P.fire1, P.fire2], g: 0, size: 2, em: true });
      if (p.burning > 0 && Math.random() < 0.6) fx.burst('fire', X(p.x) + rnd(-5, 5), X(p.y) - 4, 1, { a: -Math.PI / 2, spread: 0.6, s: 0.8, life: 0.5, colors: [P.fire0, P.fire1, P.fire2], g: -0.04, size: 2, em: true });
    }
    if (hz) {
      const [ex, ey] = hz.cable[hz.cable.length - 1];
      if (Math.random() < 0.12) fx.burst('spark', X(ex), X(ey), 2, { s: 1.6, life: 0.25, colors: [P.zap0, P.zap1], g: 0.1, b: 0.3, em: true });
    }
  }

  drawDebug(g, state, ox, oy) {
    g.globalAlpha = 0.8;
    g.strokeStyle = '#80ecca';
    g.lineWidth = 1;
    for (const s of MAP.solids) g.strokeRect(X(s.x0) + 0.5 + ox, X(s.y0) + 0.5 + oy, X(s.x1 - s.x0), X(s.y1 - s.y0));
    g.strokeStyle = '#e8c070';
    for (const p of MAP.oneway) g.strokeRect(X(p.x0) + 0.5 + ox, X(p.y) + 0.5 + oy, X(p.x1 - p.x0), X(p.h));
    g.strokeStyle = '#ff7a9a';
    for (const a of state.actors) if (!a.dead && !a.knocked) g.strokeRect(X(a.x - BODY_W / 2) + 0.5 + ox, X(a.y - HALF_H) + 0.5 + oy, X(BODY_W), X(HALF_H * 2));
    g.fillStyle = '#9af6ff';
    for (const l of state.limbs || []) g.fillRect(X(l.x) + ox, X(l.y) + oy, 1, 1);
    g.globalAlpha = 1;
  }

  // Character preview for menus, painted straight into a UI context with its feet at (x, y).
  // Secondary motion state for the menus' own figures.
  secondaryFor(key) {
    this.menuSec ||= new Map();
    if (!this.menuSec.has(key)) this.menuSec.set(key, new Secondary());
    return this.menuSec.get(key);
  }

  // A fighter's entrance and hero pose on the select screen (t: seconds since picked). Nox and Lola
  // have their own; the others play their moves.
  drawHero(g, type, x, y, t, { density = 2, dt = 1 / 60, key = 'hero' + type } = {}) {
    if (type === 4) { (this.noxHero ||= new NoxHero(this)).draw(g, x, y, t, { density, dt, gore: this.fx.gore }); return; }
    if (type === 2) { (this.lolaHero ||= new LolaHero(this)).draw(g, x, y, t, { density, dt }); return; }
    this.drawPreview(g, type, x, y, { density, mode: 'demo', key, face: 1, dt });
  }

  // Juma on the select screen: her claws, the transformation, the beast's blows, and back again.
  jumaDemo(p) {
    const a = p.a;
    if (a.act) {
      a.actT = (p.t - p.actAt);
      if (a.act === 'morph' && a.actT >= 0.6) a.form = 'beast';
      if (a.act === 'unmorph' && a.actT >= 0.32) a.form = null;
      if (a.actT >= (a.act === 'morph' ? 1.0 : 0.7)) { a.act = null; p.next = p.t + 0.7; }
      return;
    }
    if (p.t < p.next || a.attack > 0) return;
    const list = comboOf(a);
    p.step++;
    if (p.step < list.length) { a.attackKind = list[p.step]; a.attack = MOVES[a.attackKind].dur; p.next = p.t + MOVES[a.attackKind].dur + (a.form ? 0.3 : 0.12); }
    else { a.act = a.form ? 'unmorph' : 'morph'; a.actT = 0; p.actAt = p.t; p.step = -1; }
  }

  drawPreview(g, type, x, y, { density = 2, face = 1, mode = 'idle', key = 'p' + type, dt = 1 / 60, dim = 0, form = null } = {}) {
    let p = this.previews.get(key);
    if (!p || p.type !== type) {
      p = { type, a: { id: 900 + type, type, x: 0, y: 0, face, ground: true, vx: 0, vy: 0, attack: 0, attackKind: null, act: null, wounds: {}, severed: [], broken: {}, embedded: [], char: 0, hurt: 0 }, t: 0, next: 1.2, step: -1, actT: 0, sec: new Secondary() };
      this.previews.set(key, p);
    }
    const a = p.a;
    a.face = face;
    p.t += dt;
    a.attack = Math.max(0, a.attack - dt);
    if (p.actT > 0) { p.actT -= dt; a.actT = 0.8 - p.actT; if (DEMO_MOVES.includes(a.act)) a.x += face * dt * 60; if (p.actT <= 0) { a.act = null; a.x = 0; } }
    if (mode !== 'demo') { a.attack = 0; a.act = null; a.form = form; }
    else if (type === 3) this.jumaDemo(p);
    else if (p.t > p.next && !a.act) {
      const list = COMBOS[type];
      p.step = (p.step + 1) % (list.length + 1);
      p.next = p.t + (p.step === list.length ? 1.6 : 0.7);
      if (p.step === list.length) { a.act = DEMO_ACT[type]; p.actT = 0.8; }
      else { a.attackKind = list[p.step]; a.attack = MOVES[list[p.step]].dur; }
    }
    const f = frameFor(a, p.t);
    const chains = p.sec.update(a, f.frame, p.t, dt);
    const sprites = figureSprite(a, f, '', chains), flash = morphFlash(a);
    const s = flash ? tintOf(sprites.s, flash) : sprites.s, overlay = sprites.overlay && flash ? tintOf(sprites.overlay, flash) : sprites.overlay;
    x += morphJitter(a, p.t) * density;
    if (type === 2 && !dim) handKnives(g, a, f, x, y, face, density, p.t, 'back');
    if (overlay) drawFigure(g, overlay, x, y, face, density);
    drawFigure(g, s, x, y, face, density);
    if (type === 2 && !dim) handKnives(g, a, f, x, y, face, density, p.t, 'front');
    if (f.ball) this.drawBall(g, x, y, density, p.t);
    if (type === 4 && !dim) drawBloodArt(g, a, f.frame, x, y, p.t, { scale: density, gore: this.fx.gore });
    if (dim > 0) {
      const prev = g.globalAlpha;
      g.globalAlpha = prev * dim;
      if (overlay) drawFigure(g, shadowOf(overlay), x, y, face, density);
      drawFigure(g, shadowOf(s), x, y, face, density);
      g.globalAlpha = prev;
    }
  }
}
