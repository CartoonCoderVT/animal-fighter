// In-match HUD drawn on the 640x360 grid after the world: fighter cards (the Cat King's with his court's pips),
// floating tags, the little health bars over his familiars, kill feed.
import { VIEW_W, VIEW_H, S, clamp } from '../engine/const.js';
import { P } from '../engine/palette.js';
import { drawText, measure } from '../engine/font.js';
import { FIGHTERS, lookOf, styleOf, BELLY } from '../sim/fighters.js';
import { TOUCH_BUTTONS } from '../engine/input.js';
import { WEAPON_INFO } from '../sim/weapons.js';
import { seeded } from '../engine/const.js';
import { SPECIALS, DARK } from '../sim/moves.js';
import * as MOVES from '../sim/moves.js';
import { MAPS } from '../sim/map.js';
import { bloodMeter } from './dark-nox.js';

const X = v => Math.round(v * S);
// The Cat King's court (sim/court.js), in COURT order: each one's color in his card (bright, dim),
// its full health, and how high its head stands over its feet (view px) for its little health bar.
const COURT_KINDS = ['soldier', 'archer', 'assassin', 'mage', 'shield'];
const COURT_COL = {
  soldier: ['#9eaee0', '#3e4868'], archer: ['#6ccc5c', '#244a28'], assassin: ['#a878f0', '#3a2a5e'],
  mage: ['#5c96ff', '#1e2e66'], shield: ['#f2c35b', '#5a4220']
};
const COURT_TOP = { soldier: 21, archer: 19, assassin: 17, mage: 24, shield: 18 };
const courtMax = k => MOVES.COURT_HP?.[k] || 20;
const courtBack = k => { const r = MOVES.COURT_RESPAWN; return (typeof r === 'object' ? r?.[k] : r) || 9; };
// The King's kingdom (sim/kingdom.js) in his card: what stands, 7x7 (a banner, a house with cat ears, a
// castle); its little health bars over it and its units (how high their heads stand, view px).
const KG_GLYPH = {
  1: ['#......', '#####..', '######.', '#####..', '#......', '#......', '##.....'],
  2: ['.#...#.', '.##.##.', '#######', '.#####.', '.##.##.', '.##.##.', '.#####.'],
  3: ['#.#.#.#', '#######', '.#####.', '.#####.', '.##.##.', '.##.##.', '.#####.']
};
const KG_TOP = { worker: 11, knight: 15, archer: 13 };
const KG_STRUCT_TOP = lv => (MOVES.KINGDOM?.h?.[lv] ?? 60);
// A tiny cat's head, 5x4: [x, y] of its pixels (the ears, the face, the chin) and its two eyes.
const PIP = [[0, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [2, 2], [4, 2], [1, 3], [2, 3], [3, 3]];
const PIP_EYES = [[1, 2], [3, 2]];
const DEATH_TAG = {
  shatter: 'GELO', grind: 'FOSSO', crush: 'PRENSA', explosion: 'BUM', fire: 'FOGO', shock: 'CHOQUE', fall: 'QUEDA', decap: 'CABEÇA', bleed: 'SANGUE',
  impact: 'ARREMESSO', bullet: 'TIRO', pellet: 'TIRO', thrown: 'LÂMINA', claw: 'GARRAS', whip: 'RABADA', kick: 'COICE', paw: 'PATADA',
  fang: 'MORDIDA', bite: 'MORDIDA', roar: 'RUGIDO', sonic: 'GRITO', blood: 'HEMOMANCIA', hemo: 'PERFURANTE', scythe: 'FOICE', stomp: 'PISÃO', slam: 'ESMAGADO', knife: 'FACAS',
  blade: 'FACA', katana: 'KATANA', spear: 'LANÇA', pipe: 'CANO', axe: 'MACHADO', hammer: 'MARRETA',
  // Xolo: its own blows, its clones' and its demons'.
  gill: 'GUELRA', fin: 'CAUDA', gulp: 'GOLE', bubble: 'BOLHA', belly: 'BARRIGADA', nibble: 'MORDIDA', ember: 'BRASA', clone: 'BROTO', xolotl: 'XOLOTL'
};

// The fury bar's colors while it fills toward the beast, toward the titan, and as the titan.
export const RAGE_COLORS = {
  small: { base: '#ff8a1e', light: '#ffc85a', dark: '#b8460e', back: '#3a1a10' },
  beast: { base: '#e83a1a', light: '#ff7a3a', dark: '#8a1610', back: '#3a1010' },
  titan: { base: '#ff3a10', light: '#ffe08a', dark: '#a01008', back: '#4a0a08' }
};

// Xolo's brood on its card: one pip per clone slot, a head seen from the front, 5 wide, with its
// fan of three gills on each side. g/G gill tips and stalks (flames on a demon), h top light, b
// skin, s chin, e eye, m mouth (the inside of the maw on a demon), t tooth.
const XPIP = {
  mini: ['g.......g', '.G.hhh.G.', 'gGbebebGg', '.GbbmbbG.', 'g.sssss.g'],
  demon: ['g.......g', '.G.hhh.G.', 'gGbebebGg', '.GtmtmtG.', 'g.smtms.g']
};
const PIP_PAL = {
  mini: { g: '#ff6e8c', G: '#c4305a', h: '#ffd0de', b: '#f69bb7', s: '#d26f90', e: '#1c0a18', m: '#7a1e44' },
  demon: { g: '#ffd040', G: '#ff5a1a', h: '#ff5a4a', b: '#c8203a', s: '#6a1024', e: '#fff6a0', t: '#fff2dc', m: '#160006' }
};
const PIP_W = 9, PIP_H = 5;
const inPip = (x, y) => x >= 0 && y >= 0 && x < PIP_W && y < PIP_H && XPIP.mini[y][x] !== '.';
// The head's pixels, its rim (for the empty and the coming pips) and the dark outline around it.
const PIP_IN = [], PIP_RIM = [], PIP_OUT = [];
for (let y = -1; y <= PIP_H; y++) {
  for (let x = -1; x <= PIP_W; x++) {
    const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inPip(x + dx, y + dy));
    if (inPip(x, y)) { PIP_IN.push([x, y]); if (n4) PIP_RIM.push([x, y]); } else if ([-1, 0, 1].some(dy => [-1, 0, 1].some(dx => inPip(x + dx, y + dy)))) PIP_OUT.push([x, y]);
  }
}
const BROOD_KINDS = ['seed', 'bud', 'mini', 'demon'];
// Seconds left of the axolotl's demons: a snapshot carries them, a live record its end time.
const demonLeft = (a, time) => { const ax = a.axo; return !ax ? 0 : 'demonEnd' in ax ? Math.max(0, (ax.demonEnd || 0) - time) : ax.demon || 0; };

export function panel(g, x, y, w, h, { fill = '#120d1ecc', edge = '#3b3052', light = '#5a4a78', accent = null } = {}) {
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  g.fillStyle = edge; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = light; g.fillRect(x + 1, y + 1, w - 2, 1);
  if (accent) { g.fillStyle = accent; g.fillRect(x, y, 2, h); }
}

export function bar(g, x, y, w, h, k, color, back = '#2a2036', segments = 0) {
  g.fillStyle = '#0b0812'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = back; g.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(k, 0, 1));
  g.fillStyle = color; g.fillRect(x, y, fw, h);
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x, y, fw, 1);
  if (segments) { g.fillStyle = '#0b0812'; for (let i = 1; i < segments; i++) g.fillRect(x + Math.round((w * i) / segments), y, 1, h); }
}

export class HUD {
  constructor(renderer) {
    this.r = renderer;
    this.feed = [];
    this.lastHp = new Map();
    this.rage = new Map();
    this.cdLast = new Map();
    this.cdMax = new Map();
    this.courtSeen = new Map();
  }
  reset() { this.feed.length = 0; this.lastHp.clear(); this.rage.clear(); this.cdLast.clear(); this.cdMax.clear(); this.courtSeen.clear(); this.kgSeen?.clear(); }
  kill(e) {
    this.feed.unshift({ killer: e.killer, victim: e.victim, kind: e.kind, life: 5 });
    this.feed.length = Math.min(this.feed.length, 5);
  }

  draw(g, state, figures, { localId, mode, dt, touch, killsToWin = 5, countdown = 0, time = 0 }) {
    // floating tags
    for (const a of state.actors) {
      if (a.dead || a.swallowedBy != null) continue;
      const f = FIGHTERS[a.type];
      const p = this.r.worldToView(a.x, a.y), z = VIEW_W / this.r.cam.sw;
      // Juma's bigger forms carry their tag higher, over their heads; Lola's ears stand taller than the others.
      const tall = a.knocked ? 0 : a.form === 'titan' ? 12 : a.form === 'beast' ? 5 : a.type === 2 ? 4 : 0;
      const x = Math.round(p.x), y = Math.round(p.y - ((a.knocked ? 10 : 14) + tall) * z - 6);
      const local = a.id === localId;
      const name = (local ? '▼ ' : '') + a.name;
      drawText(g, name, x, y - 11, { color: local ? '#fff1c8' : f.color, outline: '#0b0812', align: 'center' });
      const w = 22, prev = this.lastHp.get(a.id) ?? a.hp;
      this.lastHp.set(a.id, prev + (a.hp - prev) * Math.min(1, dt * 4));
      g.fillStyle = '#0b0812'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
      g.fillStyle = '#6a2a3a'; g.fillRect(x - w / 2, y, Math.round(w * clamp(prev / a.maxHp, 0, 1)), 2);
      g.fillStyle = a.team === state.actors.find(b => b.id === localId)?.team && !local ? '#8fd6c4' : a.hp < a.maxHp * 0.3 ? '#ee6b6b' : '#8fd694';
      g.fillRect(x - w / 2, y, Math.round(w * clamp(a.hp / a.maxHp, 0, 1)), 2);
      // Juma's fury, under her life for everyone to see.
      if (a.type === 3) {
        const k = a.form === 'titan' ? 1 : clamp((a.rage || 0) / 100, 0, 1), c = RAGE_COLORS[a.form || 'small'];
        g.fillStyle = '#0b0812'; g.fillRect(x - w / 2 - 1, y + 3, w + 2, 2);
        g.fillStyle = k >= 1 && a.form !== 'titan' && Math.floor(time * 16) % 2 ? '#ffffff' : (Math.floor(time * 10) % 2 ? c.light : c.base);
        g.fillRect(x - w / 2, y + 3, Math.round(w * k), 1);
      }
      // The frog with someone inside: how long until they break out, in the colour of who it is.
      if (a.type === 5 && a.belly != null) {
        const v = state.actors.find(b => b.id === a.belly), k = clamp((a.bellyT || 0) / BELLY.hold, 0, 1);
        g.fillStyle = '#0b0812'; g.fillRect(x - w / 2 - 1, y + 3, w + 2, 2);
        g.fillStyle = k < 0.25 && Math.floor(time * 12) % 2 ? '#ffffff' : v ? FIGHTERS[v.type].color : '#9be05a';
        g.fillRect(x - w / 2, y + 3, Math.round(w * k), 1);
      }
      if (a.frozen > 0) drawText(g, 'CONGELADO', x, y + (a.type === 3 ? 7 : 5), { color: '#bdeeff', outline: '#0b0812', align: 'center' });
      // A live game's fighters keep their last count; it only shows while the combo is running.
      const chain = a.chainT !== undefined && state.time - a.chainT >= 1.1 ? 0 : a.chain;
      if (chain > 1) {
        const big = chain >= 6, pulse = Math.floor(time * 12) % 2;
        drawText(g, chain + '', x + 16, y - 26, { color: big ? (pulse ? '#ff6c8c' : '#ffd36c') : '#ffd36c', outline: '#1a0c14', shadow: '#5a1830', scale: big ? 3 : 2 });
        drawText(g, 'HITS!', x + 18 + (chain > 9 ? 2 : 1) * (big ? 18 : 12), y - 16, { color: '#fff1d6', outline: '#1a0c14' });
      }
    }
    this.courtBars(g, state, dt, time);
    this.kingdomBars(g, state, dt, time);
    // Rivals outside the camera view get an arrow on the screen edge.
    for (const a of state.actors) {
      if (a.dead || a.id === localId || mode === 'sandbox' || a.swallowedBy != null) continue;
      const p = this.r.worldToView(a.x, a.y);
      if (p.x >= 0 && p.x < VIEW_W && p.y >= 30 && p.y < VIEW_H) continue;
      const x = clamp(p.x, 10, VIEW_W - 10), y = clamp(p.y, 44, VIEW_H - 12);
      const col = FIGHTERS[a.type].color, dx = Math.sign(p.x - x), dy = Math.sign(p.y - y);
      g.fillStyle = '#0b0812';
      g.fillRect(x - 5, y - 5, 11, 11);
      g.fillStyle = col;
      g.fillRect(x - 4, y - 4, 9, 9);
      g.fillStyle = '#0b0812';
      for (let i = 0; i < 4; i++) {
        if (dx) g.fillRect(x + dx * (6 + i), y - 3 + i, 1, 7 - i * 2);
        if (dy) g.fillRect(x - 3 + i, y + dy * (6 + i), 7 - i * 2, 1);
      }
      drawText(g, a.name[0], x, y - 3, { color: '#0b0812', align: 'center' });
    }
    // fighter cards along the top
    const list = state.actors.slice(0, 4);
    const cw = 118, gap = 6, total = list.length * cw + (list.length - 1) * gap;
    let cx = Math.round((VIEW_W - total) / 2);
    for (const a of list) {
      const f = FIGHTERS[a.type], local = a.id === localId;
      // While Xolo's demons are out its card's edge smoulders.
      const demon = a.type === 6 && !a.dead ? demonLeft(a, state.time ?? time) : 0;
      const accent = demon > 0 ? (Math.floor(time * 5) % 2 ? '#ff3a1a' : '#c8102a') : f.color;
      panel(g, cx, 6, cw, 26, { accent, fill: local ? '#1d1430e6' : '#120d1ed9', edge: local ? '#6a5490' : '#3b3052' });
      g.save();
      g.beginPath(); g.rect(cx + 3, 8, 22, 22); g.clip();
      // The titan towers out of the frame: lower her so the face shows (Lola's bow a little).
      const titan = a.form === 'titan';
      this.r.drawPreview(g, a.type, cx + (titan ? 5 : 13), titan ? 45 : a.type === 2 ? 38 : 34, { density: 1, key: 'hud' + a.id, dt: 0, form: lookOf(a) });
      g.restore();
      if (a.dead) { g.fillStyle = 'rgba(10,6,16,0.6)'; g.fillRect(cx + 3, 8, 22, 22); drawText(g, Math.max(1, Math.ceil(a.respawn)) + '', cx + 14, 14, { color: '#f0d2b0', align: 'center', outline: '#0b0812' }); }
      drawText(g, a.name, cx + 29, 9, { color: local ? '#fff1c8' : '#d8cde8' });
      const cd = clamp(1 - a.abilityCd / f.cooldown, 0, 1);
      // (the frog holding the King in his belly holds his court too)
      const king = a.court?.length;
      if (a.type === 3) {
        // Juma's card carries her fury bar under her life, and the K cooldown under that.
        bar(g, cx + 29, 19, 58, 3, a.hp / a.maxHp, a.hp < a.maxHp * 0.3 ? '#ee6b6b' : '#8fd694');
        this.rageBar(g, a, cx + 29, 25, 58, 4, dt, time);
        g.fillStyle = '#2a2036'; g.fillRect(cx + 29, 30, 58, 1);
        g.fillStyle = cd >= 1 ? '#f2c35b' : '#8a7aa8'; g.fillRect(cx + 29, 30, Math.round(58 * cd), 1);
      } else if (a.type === 6) {
        // Xolo's card: its life, its brood (a head per clone slot, with what each has left beside
        // it) and the K under them.
        bar(g, cx + 29, 19, 58, 3, a.hp / a.maxHp, a.hp < a.maxHp * 0.3 ? '#ee6b6b' : '#8fd694');
        this.broodPips(g, a, state, cx + 29, 23, time);
        this.xoloK(g, a, cx + 29, 30, 58, demon, time);
      } else {
        bar(g, cx + 29, 21, 58, 3, a.hp / a.maxHp, a.hp < a.maxHp * 0.3 ? '#ee6b6b' : '#8fd694');
        if (a.type === 2) this.watchMeter(g, cx + 29, 27, cd, time);
        // Nox's meter is the blood he has drunk; as DARK NOX, the time he has left in that form (it
        // holds while he is dead, and burns faster to the eye in its last seconds).
        else if (a.type === 4) {
          const dark = a.form === 'dark', k = dark ? clamp((a.formT || 0) / DARK.time, 0, 1) : clamp((a.blood || 0) / (DARK.max || 100), 0, 1);
          bloodMeter(g, cx + 29, 27, 58, k, { time, dark, full: !dark && k >= 1, gore: this.r.fx?.gore ?? 2, paused: dark && !!a.dead, low: dark && (a.formT || 0) < 5, secs: dark && !a.weapon ? a.formT || 0 : null });
        } else if (king) {
          // The Cat King: a shorter special bar, and his court beside it, one little head each. With his
          // kingdom standing the bar is its fish toward the next level (its health once it is a castle),
          // and its glyph and health line sit under his kills.
          const kg = state.kingdoms?.find(k => k.by === a.id && k.st !== 'fall');
          if (kg) {
            const hk = kg.mx > 0 ? clamp(kg.hp / kg.mx, 0, 1) : 0;
            if (kg.lv < 3) bar(g, cx + 29, 27, 26, 1, kg.need > 0 ? kg.res / kg.need : 1, '#ffd76a', '#3a2c1a', kg.need > 0 && kg.need <= 10 ? kg.need : 0);
            else bar(g, cx + 29, 27, 26, 1, hk, hk < 0.3 ? '#ee6b6b' : '#ffd76a');
            this.kingdomGlyph(g, cx + 100, 20, kg, a.abilityCd <= 0 && !a.dead, hk, time);
          } else bar(g, cx + 29, 27, 26, 1, cd, cd >= 1 ? '#f2c35b' : '#8a7aa8');
          this.courtPips(g, cx + 59, 26, a, time);
        } else bar(g, cx + 29, 27, 58, 1, cd, cd >= 1 ? '#f2c35b' : '#8a7aa8');
        // The frog's belly: who he has inside and how long they have left in there.
        if (a.type === 5 && a.belly != null) {
          const v = state.actors.find(b => b.id === a.belly);
          bar(g, cx + 29, 29, king ? 26 : 58, 1, clamp((a.bellyT || 0) / BELLY.hold, 0, 1), v ? FIGHTERS[v.type].color : '#9be05a');
        }
      }
      if (mode !== 'sandbox' && mode !== 'attract') {
        for (let k = 0; k < killsToWin; k++) {
          g.fillStyle = k < a.kills ? f.color : '#2a2036';
          g.fillRect(cx + 92 + (k % 5) * 5, 10 + Math.floor(k / 5) * 5, 4, 4);
        }
      }
      const glyph = king && state.kingdoms?.some(k => k.by === a.id && k.st !== 'fall');
      if (a.weapon) drawText(g, WEAPON_INFO[a.weapon] ? WEAPON_INFO[a.weapon].name.slice(0, 4) : a.weapon === 'extinguisher' ? 'EXT' : a.ammo + '', glyph ? cx + 97 : cx + cw - 4, 20, { color: '#e8c590', align: 'right' });
      cx += cw + gap;
    }
    // kill feed
    let fy = 38;
    for (const k of this.feed) {
      k.life -= dt;
      const alpha = clamp(k.life, 0, 1);
      const text = k.killer ? `${k.killer} ▶ ${k.victim}` : `${k.victim} ×`;
      const tag = DEATH_TAG[k.kind] || '';
      const w = measure(text) + (tag ? measure(tag) + 6 : 0) + 8;
      g.globalAlpha = alpha;
      panel(g, VIEW_W - w - 6, fy, w, 13, { fill: '#120d1ecc' });
      drawText(g, text, VIEW_W - w - 2, fy + 2, { color: '#f0e4d0' });
      if (tag) drawText(g, tag, VIEW_W - 10, fy + 2, { color: '#f2c35b', align: 'right' });
      g.globalAlpha = 1;
      fy += 15;
    }
    this.feed = this.feed.filter(k => k.life > 0);
    // local player respawn / status
    const me = state.actors.find(a => a.id === localId);
    if (me?.dead) {
      panel(g, VIEW_W / 2 - 80, 140, 160, 34, { accent: '#ee6b6b' });
      drawText(g, `VOLTA EM ${Math.max(1, Math.ceil(me.respawn))}…`, VIEW_W / 2, 146, { color: '#f0d8c3', scale: 2, align: 'center' });
    }
    // Swallowed: the inside of the frog, and every button pressed brings the way out closer.
    if (me && !me.dead && me.swallowedBy != null) {
      const frog = state.actors.find(b => b.id === me.swallowedBy), k = 1 - clamp((frog?.bellyT ?? 0) / BELLY.hold, 0, 1);
      const shake = Math.floor(time * 20) % 2;
      panel(g, VIEW_W / 2 - 110, 150, 220, 40, { accent: '#9be05a', fill: '#14200ee6' });
      drawText(g, 'DENTRO DO SAPO!', VIEW_W / 2 + (shake ? 1 : 0), 156, { color: '#c8f080', scale: 2, align: 'center', outline: '#0b0812' });
      drawText(g, 'APERTE TUDO PARA SAIR', VIEW_W / 2, 174, { color: '#f0e4d0', align: 'center', alpha: 0.6 + Math.sin(time * 10) * 0.4 });
      g.fillStyle = '#0b0812'; g.fillRect(VIEW_W / 2 - 80, 184, 160, 4);
      g.fillStyle = '#9be05a'; g.fillRect(VIEW_W / 2 - 79, 185, Math.round(158 * k), 2);
    }
    if (me && !me.dead && me.knocked) drawText(g, 'APERTE PULO PARA LEVANTAR', VIEW_W / 2, 330, { color: '#f0d2b0', outline: '#0b0812', align: 'center', alpha: 0.6 + Math.sin(time * 8) * 0.4 });
    if (mode === 'sandbox') drawText(g, 'LABORATÓRIO', VIEW_W - 8, VIEW_H - 14, { color: '#cbb6d8', outline: '#0b0812', align: 'right' });
    else if (mode !== 'attract') drawText(g, `PRIMEIRO A ${killsToWin}`, VIEW_W - 8, VIEW_H - 14, { color: '#cbb6d8', outline: '#0b0812', align: 'right' });
    if (countdown > 0) {
      const n = Math.ceil(countdown - 0.7);
      const label = n > 0 ? String(n) : 'TRETA!';
      const k = (countdown - 0.7) % 1;
      const scale = n > 0 ? 6 : 5;
      drawText(g, label, VIEW_W / 2, VIEW_H / 2 - 30, { color: n > 0 ? '#f2c35b' : '#ff8f6a', outline: '#1a1020', shadow: '#402b43', scale, align: 'center', alpha: n > 0 ? clamp(k * 3, 0, 1) : 1 });
      // Where the fight is.
      const arena = MAPS[state.map] || MAPS.depot;
      drawText(g, `${arena.name} · ${arena.subtitle}`, VIEW_W / 2, VIEW_H / 2 + 22, { color: '#cbb6d8', outline: '#1a1020', align: 'center' });
    }
    if (touch) { const me = state.actors.find(a => a.id === localId); this.drawTouch(g, me && styleOf(me)); }
  }

  // Juma's fury bar. Fire runs along the fill; past two thirds it shakes and throws up flames, full
  // it flashes white, and when she transforms it drains back to zero to fill again for the next
  // form. As the titan it stays full and molten. The pips beside it are her three forms.
  rageBar(g, a, x, y, w, h, dt, time) {
    const titan = a.form === 'titan' && !a.dead, target = a.dead ? 0 : titan ? 100 : clamp(a.rage || 0, 0, 100);
    let v = this.rage.get(a.id) ?? target;
    v = target >= v ? v + (target - v) * Math.min(1, dt * 12) : Math.max(target, v - dt * 150);
    this.rage.set(a.id, v);
    const k = v / 100, c = RAGE_COLORS[(!a.dead && a.form) || 'small'], full = !titan && target >= 100;
    const hot = titan ? 1 : clamp((k - 0.6) / 0.4, 0, 1), f30 = Math.floor(time * 30);
    // Shaking as it nears full.
    const sx = hot > 0.5 && f30 % 2 ? (f30 % 4 < 2 ? 1 : -1) : 0, bx = x + sx;
    g.fillStyle = '#0b0812'; g.fillRect(bx - 1, y - 1, w + 2, h + 2);
    g.fillStyle = c.back; g.fillRect(bx, y, w, h);
    const fw = Math.round(w * k);
    for (let i = 0; i < fw; i++) {
      // Bands of fire flowing toward the leading edge, brighter on top, darker underneath.
      const band = ((i - Math.floor(time * (titan ? 40 : 26))) % 7 + 7) % 7;
      const mid = full ? (f30 % 4 < 2 ? '#ffffff' : c.light) : band < 2 ? c.light : band < 5 ? c.base : c.dark;
      g.fillStyle = mid; g.fillRect(bx + i, y, 1, h);
      g.fillStyle = full ? '#ffffff' : c.light; g.fillRect(bx + i, y, 1, 1);
      g.fillStyle = c.dark; g.fillRect(bx + i, y + h - 1, 1, 1);
    }
    if (fw > 0 && fw < w) { g.fillStyle = f30 % 2 ? '#ffffff' : '#ffe8a0'; g.fillRect(bx + fw - 1, y, 1, h); }
    // Segment ticks at the thirds.
    g.fillStyle = '#0b0812';
    for (const t of [1 / 3, 2 / 3]) g.fillRect(bx + Math.round(w * t), y + h - 1, 1, 1);
    // Flames licking up off the fill.
    if (hot > 0) {
      const rnd = seeded(Math.floor(time * 14) + a.id * 31);
      for (let i = 0; i < fw; i++) {
        if (rnd() > hot * 0.45) continue;
        const tall = rnd() < 0.4 ? 2 : 1;
        g.fillStyle = rnd() < 0.5 ? c.light : '#ffe8a0';
        g.fillRect(bx + i, y - tall, 1, tall);
      }
    }
    // The three forms: small, beast, titan.
    ['small', 'beast', 'titan'].forEach((form, i) => {
      const px = x + w + 4 + i * 8, cur = (a.form || 'small') === form, reached = i <= ['small', 'beast', 'titan'].indexOf(a.form || 'small');
      g.fillStyle = '#0b0812'; g.fillRect(px - 1, y - 1, 7, h + 2);
      g.fillStyle = reached ? RAGE_COLORS[form].base : '#2a2036'; g.fillRect(px, y, 5, h);
      if (cur) { g.fillStyle = Math.floor(time * 4) % 2 ? '#ffffff' : RAGE_COLORS[form].light; g.fillRect(px, y, 5, 1); }
      if (i === 2 && !reached) { g.fillStyle = '#4a3a5a'; g.fillRect(px + 2, y + 1, 1, h - 2); }
    });
  }

  // Xolo's three clone slots. Empty: a grey head. A part in flight: its rim pulsing pink. A bud:
  // the head filling up pink from the chin as it swells. An adult: pink, with the time it has
  // left beside it (flashing white when hit). A demon: red, a mouth full of teeth, flames for
  // gills and its life in embers; white as it swells to burst. A dying one melts out of its slot.
  broodPips(g, a, state, x, y, time) {
    const kind = m => m.kind || (m.form === 'demon' ? 'demon' : 'mini');
    const mine = (state.minions || []).filter(m => m.owner === a.id && BROOD_KINDS.includes(kind(m)));
    const f16 = Math.floor(time * 16), pulse = ['#7a2a50', '#c4507a', '#ff9cb8', '#ffd0de', '#ff9cb8', '#c4507a'][Math.floor(time * 12) % 6];
    for (let slot = 0; slot < 3; slot++) {
      const m = mine.find(n => n.slot === slot && !n.dying) || mine.find(n => n.slot === slot);
      const k = m ? kind(m) : null, px = x + slot * 20 + 1, bx = px + 11, by = y + 1, bw = 6, bh = 3;
      // The head: a dark outline, the empty slot, then whatever fills it.
      g.fillStyle = '#0b0812';
      for (const [dx, dy] of PIP_OUT) g.fillRect(px + dx, y + dy, 1, 1);
      g.fillStyle = '#2a2036';
      for (const [dx, dy] of PIP_IN) g.fillRect(px + dx, y + dy, 1, 1);
      g.fillStyle = k === 'seed' ? pulse : '#4a3a5a';
      for (const [dx, dy] of PIP_RIM) g.fillRect(px + dx, y + dy, 1, 1);
      g.fillStyle = '#0b0812'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle = '#2a2036'; g.fillRect(bx, by, bw, bh);
      if (!m || k === 'seed') {
        // A part on its way: a spark running along the empty bar.
        if (k === 'seed') { g.fillStyle = pulse; g.fillRect(bx + Math.abs((Math.floor(time * 12) % 10) - 5), by, 1, bh); }
        continue;
      }
      const life = clamp(m.lifeMax ? m.life / m.lifeMax : 1, 0, 1);
      if (m.dying) {
        // Melting: the head sinks out of its slot.
        const sink = Math.floor(clamp((m.actT || 0) / 0.4, 0, 1) * (PIP_H + 1));
        this.pip(g, px, y, m.form === 'demon' ? 'demon' : 'mini', { sink, time, slot });
        continue;
      }
      if (k === 'bud') {
        const grown = 1 - life;
        this.pip(g, px, y, 'mini', { from: PIP_H - Math.ceil(grown * PIP_H), eyes: false, flash: Math.floor(time * 12) % 3 === 0, time, slot });
        g.fillStyle = pulse; g.fillRect(bx, by, Math.round(bw * grown), bh);
        continue;
      }
      if (k === 'mini') {
        // Turning into a demon: it flickers between the two.
        const look = m.act === 'morph' && f16 % 2 ? 'demon' : 'mini';
        this.pip(g, px, y, look, { white: m.hurt > 0 && f16 % 2, time, slot });
        const fw = Math.ceil(bw * life), low = life < 0.25 && Math.floor(time * 8) % 2;
        g.fillStyle = low ? '#ffffff' : '#f69bb7'; g.fillRect(bx, by, fw, bh);
        g.fillStyle = low ? '#ffffff' : '#ffd0de'; g.fillRect(bx, by, fw, 1);
        g.fillStyle = low ? '#ffffff' : '#d26f90'; g.fillRect(bx, by + bh - 1, fw, 1);
        continue;
      }
      // A demon. Swelling to burst it flashes white and shakes; its bar is its life, burning.
      const burst = m.act === 'burst', hurt = m.hurt > 0 || m.act === 'morph';
      this.pip(g, px + (burst && f16 % 2 ? 1 : 0), y, 'demon', { white: (burst || hurt) && f16 % 2, time, slot });
      const fw = Math.ceil(bw * clamp(m.hp / (m.maxHp || 1), 0, 1));
      for (let i = 0; i < fw; i++) {
        const band = ((i - Math.floor(time * 16) - slot * 3) % 4 + 4) % 4;
        g.fillStyle = band === 0 ? '#ffd040' : '#ff5a1a'; g.fillRect(bx + i, by, 1, 1);
        g.fillStyle = band === 1 ? '#ffd040' : '#ff5a1a'; g.fillRect(bx + i, by + 1, 1, 1);
        g.fillStyle = band === 2 ? '#ff5a1a' : '#a8102a'; g.fillRect(bx + i, by + 2, 1, 1);
      }
    }
  }

  // One head pip at (x, y): its look, the rows it fills from (a bud fills up from the chin), how far
  // it has sunk (melting), all white (a flash), and whether it has its eyes yet.
  pip(g, x, y, look, { from = 0, sink = 0, white = false, flash = false, eyes = true, time = 0, slot = 0 } = {}) {
    const rows = XPIP[look], pal = PIP_PAL[look];
    // A demon's gill flames lick: their tips swap shades a few times a second.
    const lick = look === 'demon' && (Math.floor(time * 9) + slot) % 2;
    for (let r = Math.max(from, 0); r < PIP_H; r++) {
      const src = r - sink;
      if (src < 0) continue;
      for (let c = 0; c < PIP_W; c++) {
        let ch = rows[src][c];
        if (ch === '.') continue;
        if (ch === 'e' && !eyes) ch = 'b';
        if (lick && (ch === 'g' || ch === 'G')) ch = ch === 'g' ? 'G' : 'g';
        if (flash && ch === 'b') ch = 'h';
        g.fillStyle = white ? '#ffffff' : pal[ch];
        g.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  // Xolo's K. While its demons are out it burns down in embers over the awakening; then (and after
  // the Bocarra's shorter wait) it fills back up from wherever the wait started.
  xoloK(g, a, x, y, w, demon, time) {
    const cdNow = Math.max(0, a.abilityCd || 0), full = FIGHTERS[6].cooldown;
    if (!this.cdMax.has(a.id)) this.cdMax.set(a.id, full);
    else if (cdNow > (this.cdLast.get(a.id) ?? 0) + 0.05) this.cdMax.set(a.id, clamp(cdNow, 0.5, full));
    this.cdLast.set(a.id, cdNow);
    g.fillStyle = '#2a2036'; g.fillRect(x, y, w, 1);
    if (demon <= 0) {
      const k = clamp(1 - cdNow / this.cdMax.get(a.id), 0, 1);
      g.fillStyle = k >= 1 ? '#f2c35b' : '#8a7aa8'; g.fillRect(x, y, Math.round(w * k), 1);
      return;
    }
    const fw = Math.round(w * clamp(demon / SPECIALS[6].dur, 0, 1)), f30 = Math.floor(time * 30);
    for (let i = 0; i < fw; i++) {
      const band = ((i - Math.floor(time * 24)) % 6 + 6) % 6;
      g.fillStyle = band < 2 ? '#ffd040' : band < 4 ? '#ff5a1a' : '#c8102a';
      g.fillRect(x + i, y, 1, 1);
    }
    // The burning end, and embers rising off the fuse.
    if (fw > 0) { g.fillStyle = f30 % 2 ? '#ffffff' : '#fff2a0'; g.fillRect(x + fw - 1, y, 1, 1); }
    const rnd = seeded(Math.floor(time * 12) + a.id * 17);
    for (let i = 0; i < fw; i++) {
      if (rnd() > 0.14) continue;
      g.fillStyle = rnd() < 0.5 ? '#ff8a1e' : '#ffd040';
      g.fillRect(x + i, y - (rnd() < 0.25 ? 2 : 1), 1, 1);
    }
  }

  // A tiny health bar over each familiar of a Cat King's court that is not at full health: it shows
  // when it is struck and fades a moment after (it stays, fainter, while it is badly hurt), green,
  // then yellow, then red, the health just lost draining away in pale pink.
  courtBars(g, state, dt, time) {
    const live = new Set();
    for (const a of state.actors) {
      if (!a.court?.length || a.dead) continue;
      for (let i = 0; i < a.court.length; i++) {
        const F = a.court[i], k = F.k || COURT_KINDS[i], key = a.id + ':' + i;
        live.add(key);
        const max = courtMax(k), hp = Math.max(0, Math.min(max, F.hp ?? max));
        let m = this.courtSeen.get(key);
        if (!m) { m = { lag: hp, hurtAt: -9 }; this.courtSeen.set(key, m); }
        if (F.hurt > 0) m.hurtAt = time;
        m.lag = hp > m.lag ? hp : m.lag + (hp - m.lag) * Math.min(1, dt * 5);
        if (F.st === 'dead' || F.st === 'gone' || F.st === 'appear' || hp >= max) { m.lag = hp; continue; }
        const k01 = hp / max, since = time - m.hurtAt;
        let alpha = since < 1.1 ? 1 : since < 1.5 ? 1 - (since - 1.1) / 0.4 : 0;
        if (k01 <= 0.34) alpha = Math.max(alpha, 0.75);
        if (alpha <= 0.02) continue;
        const p = this.r.worldToView(F.x, F.y), z = VIEW_W / this.r.cam.sw;
        const x = Math.round(p.x) - 4, y = Math.round(p.y - (COURT_TOP[k] + 4) * z);
        if (x < -10 || x > VIEW_W + 2 || y < -4 || y > VIEW_H) continue;
        g.globalAlpha = alpha;
        g.fillStyle = '#0b0812'; g.fillRect(x - 1, y - 1, 10, 4);
        g.fillStyle = '#2a2036'; g.fillRect(x, y, 8, 2);
        g.fillStyle = '#ffc8d4'; g.fillRect(x, y, Math.round(8 * clamp(m.lag / max, 0, 1)), 2);
        const low = k01 <= 0.34, blinkOff = low && k01 <= 0.2 && Math.floor(time * 6) % 2, fw = Math.max(1, Math.round(8 * k01));
        g.fillStyle = blinkOff ? '#ff9a9a' : low ? '#ee6b6b' : k01 <= 0.6 ? '#f2c35b' : '#8fd694';
        g.fillRect(x, y, fw, 2);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, fw, 1);
        g.globalAlpha = 1;
      }
    }
    if (this.courtSeen.size > live.size) for (const key of this.courtSeen.keys()) if (!live.has(key)) this.courtSeen.delete(key);
  }

  // The King's court in his card: five tiny cat heads in COURT order, each in its own color, lit from
  // the chin up as far as its health goes; struck, it flashes white; fallen, dark; about to come back,
  // blinking; popping back in, white.
  courtPips(g, x, y, a, time) {
    for (let i = 0; i < 5; i++) {
      const F = a.court[i], k = F?.k || COURT_KINDS[i], [lit, dim] = COURT_COL[k] || COURT_COL.soldier;
      const px = x + i * 6, max = courtMax(k);
      // The outline: the head's pixels pushed one each way, in ink; in gold while the kingdom's aura
      // strengthens it (brighter the stronger, twinkling at the castle's).
      const st = F?.st, dead = !F || a.dead || st === 'gone' || st === 'dead', b = dead ? 0 : F?.b | 0;
      g.fillStyle = b >= 3 && Math.floor(time * 6 + i) % 5 === 0 ? '#fff2a8' : b >= 2 ? '#ffc838' : b === 1 ? '#a8782a' : '#0b0812';
      for (const [u, v] of PIP) { g.fillRect(px + u - 1, y + v, 3, 1); g.fillRect(px + u, y + v - 1, 1, 3); }
      let k01 = dead ? 0 : clamp((F.hp ?? max) / max, 0, 1), col = lit;
      if (st === 'dead' && !a.dead && courtBack(k) - (F.t || 0) < 1.5 && Math.floor(time * 8) % 2) { k01 = 1; col = lit; }
      if (!dead && (F.hurt > 0.12 || (st === 'appear' && (F.t || 0) < 0.2))) { k01 = 1; col = '#ffffff'; }
      // Lit from the chin up (row 3 first, the ears last), the rest in its dim color, dark when gone.
      const rows = k01 <= 0 ? 0 : Math.max(1, Math.ceil(k01 * 4 - 0.01));
      for (const [u, v] of PIP) {
        g.fillStyle = 3 - v < rows ? col : dead ? '#1c1626' : dim;
        g.fillRect(px + u, y + v, 1, 1);
      }
      g.fillStyle = dead && rows === 0 ? '#3a304a' : '#0b0812';
      for (const [u, v] of PIP_EYES) g.fillRect(px + u, y + v, 1, 1);
    }
  }

  // The King's kingdom in his card: its glyph (gold with his recall home ready), a health line under it
  // (red when low, white while it is being struck).
  kingdomGlyph(g, x, y, kg, ready, hk, time) {
    const rows = KG_GLYPH[kg.lv] || KG_GLYPH[1];
    const building = kg.st === 'up' && Math.floor(time * 6) % 2;
    g.fillStyle = '#0b0812';
    rows.forEach((r, v) => { for (let u = 0; u < 7; u++) if (r[u] === '#') { g.fillRect(x + u - 1, y + v, 3, 1); g.fillRect(x + u, y + v - 1, 1, 3); } });
    g.fillStyle = building ? '#fff2a8' : ready ? '#ffd76a' : '#8a7aa8';
    rows.forEach((r, v) => { for (let u = 0; u < 7; u++) if (r[u] === '#') g.fillRect(x + u, y + v, 1, 1); });
    const w = Math.max(hk > 0 ? 1 : 0, Math.round(9 * hk));
    g.fillStyle = '#0b0812'; g.fillRect(x - 2, y + 7, 11, 3);
    g.fillStyle = '#2a2036'; g.fillRect(x - 1, y + 8, 9, 1);
    g.fillStyle = kg.hurt > 0 && Math.floor(time * 16) % 2 ? '#ffffff' : hk < 0.3 ? '#ee6b6b' : '#8fd694';
    g.fillRect(x - 1, y + 8, w, 1);
  }

  // Little health bars over a kingdom's structure (24x2) and its units (10x1) while they are hurt: they
  // show when struck and fade a moment after (staying, fainter, while badly hurt), as the court's do.
  kingdomBars(g, state, dt, time) {
    if (!state.kingdoms?.length) { if (this.kgSeen?.size) this.kgSeen.clear(); return; }
    const seen = this.kgSeen ||= new Map(), live = new Set(), z = VIEW_W / this.r.cam.sw;
    const one = (key, hp, max, hurt, vx, vy, w, h, hide) => {
      live.add(key);
      let m = seen.get(key);
      if (!m) { m = { lag: hp, hurtAt: -9 }; seen.set(key, m); }
      if (hurt > 0) m.hurtAt = time;
      m.lag = hp > m.lag ? hp : m.lag + (hp - m.lag) * Math.min(1, dt * 5);
      if (hide || hp >= max) { m.lag = hp; return; }
      const k01 = clamp(hp / max, 0, 1), since = time - m.hurtAt;
      let alpha = since < 1.1 ? 1 : since < 1.5 ? 1 - (since - 1.1) / 0.4 : 0;
      if (k01 <= 0.34) alpha = Math.max(alpha, 0.75);
      if (alpha <= 0.02) return;
      const x = Math.round(vx - w / 2), y = Math.round(vy - h);
      if (x < -w || x > VIEW_W || y < -4 || y > VIEW_H) return;
      g.globalAlpha = alpha;
      g.fillStyle = '#0b0812'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = '#2a2036'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ffc8d4'; g.fillRect(x, y, Math.round(w * clamp(m.lag / max, 0, 1)), h);
      const low = k01 <= 0.34, blinkOff = low && k01 <= 0.2 && Math.floor(time * 6) % 2;
      g.fillStyle = blinkOff ? '#ff9a9a' : low ? '#ee6b6b' : k01 <= 0.6 ? '#f2c35b' : '#8fd694';
      g.fillRect(x, y, Math.max(1, Math.round(w * k01)), h);
      if (h > 1) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, Math.max(1, Math.round(w * k01)), 1); }
      g.globalAlpha = 1;
    };
    for (const kg of state.kingdoms) {
      const q = this.r.worldToView(kg.x, kg.y - KG_STRUCT_TOP(kg.lv) - 8);
      one('kg' + kg.id, Math.max(0, kg.hp), kg.mx || 1, kg.hurt, q.x, q.y, 24, 2, kg.st === 'fall');
      for (const u of kg.u || []) {
        const max = MOVES.KINGDOM?.[u.k]?.hp || 10, p = this.r.worldToView(u.x, u.y);
        one('kg:' + u.id, Math.max(0, u.hp ?? max), max, u.hurt, p.x, p.y - ((KG_TOP[u.k] || 12) + 3) * z, 10, 1, u.st === 'dead' || u.st === 'appear');
      }
    }
    if (seen.size > live.size) for (const key of seen.keys()) if (!live.has(key)) seen.delete(key);
  }

  // Lola's super charges slowly: twelve ticks of a clock fill one by one, and once they are all lit
  // they glint in gold and a little watch beside them swings.
  watchMeter(g, x, y, k, time) {
    const full = k >= 1, lit = Math.floor(k * 12);
    for (let i = 0; i < 12; i++) {
      const on = i < lit, glint = full && Math.floor(time * 10) % 12 === i;
      g.fillStyle = '#0b0812'; g.fillRect(x + i * 5 - 1, y - 1, 5, 3);
      g.fillStyle = glint ? '#ffffff' : full ? '#ffd23a' : on ? '#6aa8f0' : '#2a2036';
      g.fillRect(x + i * 5, y, 3, 1);
    }
    // The tick being wound fills in as it charges.
    if (!full) { g.fillStyle = '#9cd0ff'; g.fillRect(x + lit * 5, y, Math.round((k * 12 - lit) * 3), 1); }
    if (full) {
      const sw = Math.round(Math.sin(time * 5) * 1.4), wx = x - 4 + sw, wy = y - 3;
      g.fillStyle = '#0b0812'; g.fillRect(wx - 1, wy - 1, 5, 5);
      g.fillStyle = '#ffd23a'; g.fillRect(wx, wy, 3, 3);
      g.fillStyle = '#fff8e8'; g.fillRect(wx + 1, wy + 1, 1, 1);
    }
  }

  drawTouch(g, type) {
    const r = this.r;
    for (const b of TOUCH_BUTTONS) {
      // The bats button is Nox's alone.
      if (b.id === 'bats' && type !== 4) continue;
      g.globalAlpha = 0.55;
      g.fillStyle = '#120d1e';
      circle(g, b.x, b.y, b.r);
      g.fillStyle = '#5a4a78';
      ring(g, b.x, b.y, b.r);
      g.globalAlpha = 0.85;
      drawText(g, b.label, b.x, b.y - 5, { color: '#f0e4d0', align: 'center' });
    }
    g.globalAlpha = 0.35;
    g.fillStyle = '#120d1e';
    circle(g, 70, 300, 30);
    g.fillStyle = '#5a4a78';
    ring(g, 70, 300, 30);
    g.globalAlpha = 1;
  }
}

function circle(g, x, y, r) {
  for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); g.fillRect(x - w, y + yy, w * 2, 1); }
}
function ring(g, x, y, r) {
  const n = Math.round(r * 6);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); }
}
