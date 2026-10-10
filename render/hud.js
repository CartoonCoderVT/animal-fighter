// In-match HUD drawn on the 640x360 grid after the world: fighter cards, floating tags, kill feed.
import { VIEW_W, VIEW_H, S, clamp } from '../engine/const.js';
import { P } from '../engine/palette.js';
import { drawText, measure } from '../engine/font.js';
import { FIGHTERS } from '../sim/fighters.js';
import { TOUCH_BUTTONS } from '../engine/input.js';
import { WEAPON_INFO } from '../sim/weapons.js';
import { SPECIALS, DARK } from '../sim/moves.js';
import * as MOVES from '../sim/moves.js';
import { MAPS } from '../sim/map.js';
import { bloodMeter } from './dark-nox.js';

const X = v => Math.round(v * S);
// The Cat King's court (sim/court.js), in COURT order: each one's color in his card (bright, dim),
// its full health, and how high its head stands over its feet (view px) for its little health bar.
const COURT_KINDS = ['soldier', 'archer', 'assassin', 'mage', 'shield'];
const COURT_COL = {
  soldier: ['#c8cee6', '#4a4e66'], archer: ['#6ccc5c', '#244a28'], assassin: ['#a878f0', '#3a2a5e'],
  mage: ['#5c96ff', '#1e2e66'], shield: ['#f2c35b', '#5a4220']
};
const COURT_TOP = { soldier: 21, archer: 19, assassin: 17, mage: 24, shield: 18 };
const courtMax = k => MOVES.COURT_HP?.[k] || 20;
const courtBack = k => { const r = MOVES.COURT_RESPAWN; return (typeof r === 'object' ? r?.[k] : r) || 9; };
// A tiny cat's head, 5x4: [x, y] of its pixels (the ears, the face, the chin) and its two eyes.
const PIP = [[0, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [2, 2], [4, 2], [1, 3], [2, 3], [3, 3]];
const PIP_EYES = [[1, 2], [3, 2]];
const DEATH_TAG = {
  shatter: 'GELO', grind: 'FOSSO', crush: 'PRENSA', explosion: 'BUM', fire: 'FOGO', shock: 'CHOQUE', fall: 'QUEDA', decap: 'CABEÇA', bleed: 'SANGUE',
  impact: 'ARREMESSO', bullet: 'TIRO', pellet: 'TIRO', thrown: 'LÂMINA', claw: 'GARRAS', whip: 'RABADA', kick: 'COICE', paw: 'PATADA',
  fang: 'MORDIDA', bite: 'MORDIDA', roar: 'RUGIDO', sonic: 'GRITO', blood: 'HEMOMANCIA', hemo: 'PERFURANTE', scythe: 'FOICE', stomp: 'PISÃO', slam: 'ESMAGADO', knife: 'FACAS',
  blade: 'FACA', katana: 'KATANA', spear: 'LANÇA', pipe: 'CANO', axe: 'MACHADO', hammer: 'MARRETA'
};

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
    this.courtSeen = new Map();
  }
  reset() { this.feed.length = 0; this.lastHp.clear(); this.courtSeen.clear(); }
  kill(e) {
    this.feed.unshift({ killer: e.killer, victim: e.victim, kind: e.kind, life: 5 });
    this.feed.length = Math.min(this.feed.length, 5);
  }

  draw(g, state, figures, { localId, mode, dt, touch, killsToWin = 5, countdown = 0, time = 0 }) {
    // floating tags
    for (const a of state.actors) {
      if (a.dead) continue;
      const f = FIGHTERS[a.type];
      const p = this.r.worldToView(a.x, a.y), z = VIEW_W / this.r.cam.sw;
      // Lola's ears stand taller than the others: her tag floats over them.
      const x = Math.round(p.x), y = Math.round(p.y - (a.knocked ? 10 : a.type === 2 ? 18 : 14) * z - 6);
      const local = a.id === localId;
      const name = (local ? '▼ ' : '') + a.name;
      drawText(g, name, x, y - 11, { color: local ? '#fff1c8' : f.color, outline: '#0b0812', align: 'center' });
      const w = 22, prev = this.lastHp.get(a.id) ?? a.hp;
      this.lastHp.set(a.id, prev + (a.hp - prev) * Math.min(1, dt * 4));
      g.fillStyle = '#0b0812'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
      g.fillStyle = '#6a2a3a'; g.fillRect(x - w / 2, y, Math.round(w * clamp(prev / a.maxHp, 0, 1)), 2);
      g.fillStyle = a.team === state.actors.find(b => b.id === localId)?.team && !local ? '#8fd6c4' : a.hp < a.maxHp * 0.3 ? '#ee6b6b' : '#8fd694';
      g.fillRect(x - w / 2, y, Math.round(w * clamp(a.hp / a.maxHp, 0, 1)), 2);
      if (a.frozen > 0) drawText(g, 'CONGELADO', x, y + 5, { color: '#bdeeff', outline: '#0b0812', align: 'center' });
      if (a.chain > 1) {
        const big = a.chain >= 6, pulse = Math.floor(time * 12) % 2;
        drawText(g, a.chain + '', x + 16, y - 26, { color: big ? (pulse ? '#ff6c8c' : '#ffd36c') : '#ffd36c', outline: '#1a0c14', shadow: '#5a1830', scale: big ? 3 : 2 });
        drawText(g, 'HITS!', x + 18 + (a.chain > 9 ? 2 : 1) * (big ? 18 : 12), y - 16, { color: '#fff1d6', outline: '#1a0c14' });
      }
    }
    this.courtBars(g, state, dt, time);
    // Rivals outside the camera view get an arrow on the screen edge.
    for (const a of state.actors) {
      if (a.dead || a.id === localId || mode === 'sandbox') continue;
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
      panel(g, cx, 6, cw, 26, { accent: f.color, fill: local ? '#1d1430e6' : '#120d1ed9', edge: local ? '#6a5490' : '#3b3052' });
      g.save();
      g.beginPath(); g.rect(cx + 3, 8, 22, 22); g.clip();
      this.r.drawPreview(g, a.type, cx + 13, a.type === 2 ? 38 : 34, { density: 1, key: 'hud' + a.id, dt: 0, form: a.form || null });
      g.restore();
      if (a.dead) { g.fillStyle = 'rgba(10,6,16,0.6)'; g.fillRect(cx + 3, 8, 22, 22); drawText(g, Math.max(1, Math.ceil(a.respawn)) + '', cx + 14, 14, { color: '#f0d2b0', align: 'center', outline: '#0b0812' }); }
      drawText(g, a.name, cx + 29, 9, { color: local ? '#fff1c8' : '#d8cde8' });
      bar(g, cx + 29, 21, 58, 3, a.hp / a.maxHp, a.hp < a.maxHp * 0.3 ? '#ee6b6b' : '#8fd694');
      // As the beast, Juma's bar is the time she has left in that form.
      const king = a.type === 0 && a.court?.length;
      const beast = a.form === 'beast', cd = beast ? clamp((a.formT || 0) / SPECIALS[3].form, 0, 1) : clamp(1 - a.abilityCd / f.cooldown, 0, 1);
      if (a.type === 2) this.watchMeter(g, cx + 29, 27, cd, time);
      // Nox's meter is the blood he has drunk; as DARK NOX, the time he has left in that form (it
      // holds while he is dead, and burns faster to the eye in its last seconds).
      else if (a.type === 4) {
        const dark = a.form === 'dark', k = dark ? clamp((a.formT || 0) / DARK.time, 0, 1) : clamp((a.blood || 0) / (DARK.max || 100), 0, 1);
        bloodMeter(g, cx + 29, 27, 58, k, { time, dark, full: !dark && k >= 1, gore: this.r.fx?.gore ?? 2, paused: dark && !!a.dead, low: dark && (a.formT || 0) < 5, secs: dark && !a.weapon ? a.formT || 0 : null });
      } else if (king) {
        // The Cat King: a shorter special bar, and his court beside it, one little head each.
        bar(g, cx + 29, 27, 26, 1, cd, cd >= 1 ? '#f2c35b' : '#8a7aa8');
        this.courtPips(g, cx + 59, 26, a, time);
      } else bar(g, cx + 29, 27, 58, 1, cd, beast ? '#ff8a3a' : cd >= 1 ? '#f2c35b' : '#8a7aa8');
      if (mode !== 'sandbox' && mode !== 'attract') {
        for (let k = 0; k < killsToWin; k++) {
          g.fillStyle = k < a.kills ? f.color : '#2a2036';
          g.fillRect(cx + 92 + (k % 5) * 5, 10 + Math.floor(k / 5) * 5, 4, 4);
        }
      }
      if (a.weapon) drawText(g, WEAPON_INFO[a.weapon] ? WEAPON_INFO[a.weapon].name.slice(0, 4) : a.weapon === 'extinguisher' ? 'EXT' : a.ammo + '', cx + cw - 4, 20, { color: '#e8c590', align: 'right' });
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
    if (touch) this.drawTouch(g, state.actors.find(a => a.id === localId)?.type);
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
        const x = Math.round(p.x) - 4, y = Math.round(p.y - (COURT_TOP[k] + 3) * z);
        if (x < -10 || x > VIEW_W + 2 || y < -4 || y > VIEW_H) continue;
        g.globalAlpha = alpha;
        g.fillStyle = '#0b0812'; g.fillRect(x - 1, y - 1, 10, 3);
        g.fillStyle = '#2a2036'; g.fillRect(x, y, 8, 1);
        g.fillStyle = '#ffc8d4'; g.fillRect(x, y, Math.round(8 * clamp(m.lag / max, 0, 1)), 1);
        const low = k01 <= 0.34, blinkOff = low && k01 <= 0.2 && Math.floor(time * 6) % 2;
        g.fillStyle = blinkOff ? '#ff9a9a' : low ? '#ee6b6b' : k01 <= 0.6 ? '#f2c35b' : '#8fd694';
        g.fillRect(x, y, Math.max(1, Math.round(8 * k01)), 1);
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
      // The outline: the head's pixels pushed one each way, in ink.
      g.fillStyle = '#0b0812';
      for (const [u, v] of PIP) { g.fillRect(px + u - 1, y + v, 3, 1); g.fillRect(px + u, y + v - 1, 1, 3); }
      const st = F?.st, dead = !F || a.dead || st === 'gone' || st === 'dead';
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
