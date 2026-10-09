import { VIEW_W, VIEW_H, bayer } from '../../engine/const.js';
import { drawText, measure } from '../../engine/font.js';
import { FIGHTERS } from '../../sim/fighters.js';
import { panel, paragraph, button, hit, hover } from '../widgets.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
let stageCache = null;
function stage() {
  if (stageCache) return stageCache;
  const c = mk(VIEW_W, VIEW_H), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#0d0918'); grad.addColorStop(0.55, '#1e1532'); grad.addColorStop(0.62, '#2a1d40'); grad.addColorStop(1, '#0b0812');
  g.fillStyle = grad; g.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let y = 0; y < 150; y++) for (let x = 0; x < VIEW_W; x += 2) if (bayer(x, y) < 0.04 * (1 - y / 150)) { g.fillStyle = '#4a3b68'; g.fillRect(x, y, 1, 1); }
  // back wall panels
  g.fillStyle = '#17112a';
  for (let x = 0; x < VIEW_W; x += 40) g.fillRect(x, 40, 1, 180);
  g.fillStyle = '#251a3a'; g.fillRect(0, 222, VIEW_W, 2);
  return (stageCache = c);
}
// Pedestals spread evenly across the screen, however many fighters there are.
const SLOT = i => Math.round(VIEW_W / FIGHTERS.length * (i + 0.5));
let spotCache = null;
function spotlight() {
  if (spotCache) return spotCache;
  const c = mk(120, 192), g = c.getContext('2d');
  g.fillStyle = '#3a2a4a';
  for (let y = 0; y < 192; y++) {
    const half = 8 + y * 0.24;
    for (let xx = -half; xx < half; xx++) if (bayer(60 + xx, y) < 0.16 * (1 - Math.abs(xx) / half) + 0.03) g.fillRect(Math.round(60 + xx), y, 1, 1);
  }
  return (spotCache = c);
}

export class SelectScene {
  constructor(shell, { next = 'solo', code = '' } = {}) {
    this.shell = shell; this.next = next; this.code = code; this.index = shell.selected; this.t = 0; this.selT = 0; this.selOf = this.index;
    this.confirmRect = { x: VIEW_W - 152, y: 12, w: 140, h: 20 };
    this.botsRect = { x: VIEW_W - 152, y: 36, w: 140, h: 16 };
  }
  enter() { this.shell.sound.music('menu'); }
  confirm() {
    const s = this.shell;
    if (this.next === 'browse') { s.pickFighter(this.index); import('./title.js').then(m => s.go(new m.MenuScene(s))); return; }
    s.pickFighter(this.index);
    s.sound.play('ui_ok');
    if (this.next === 'online') import('./online.js').then(m => s.go(new m.OnlineScene(s, { code: this.code })));
    else s.startMatch(undefined, { mode: this.next });
  }
  update(dt) {
    this.t += dt;
    // Time since the current fighter was picked, for his entrance.
    if (this.selOf !== this.index) { this.selOf = this.index; this.selT = 0; } else this.selT += dt;
    const i = this.shell.input, snd = this.shell.sound;
    if (i.nav('left')) { this.index = (this.index + FIGHTERS.length - 1) % FIGHTERS.length; snd.play('ui_move'); }
    if (i.nav('right')) { this.index = (this.index + 1) % FIGHTERS.length; snd.play('ui_move'); }
    for (const c of i.clicks) {
      if (c.down) continue;
      for (let k = 0; k < FIGHTERS.length; k++) if (Math.abs(c.x - SLOT(k)) < VIEW_W / FIGHTERS.length / 2 && c.y > 110 && c.y < 236) { if (this.index === k) this.confirm(); else { this.index = k; snd.play('ui_move'); } }
    }
    if (hit(i, this.confirmRect)) this.confirm();
    // Solo: one to three bots.
    if (this.next === 'solo') {
      const bots = s => { this.shell.settings.bots = s; this.shell.saveSettings(); snd.play('ui_move'); };
      const n = Math.max(1, Math.min(3, this.shell.settings.bots ?? 3));
      if (i.nav('up')) bots(Math.min(3, n + 1));
      if (i.nav('down')) bots(Math.max(1, n - 1));
      if (hit(i, this.botsRect)) bots(n % 3 + 1);
    }
    if (i.nav('ok')) this.confirm();
    if (i.nav('back')) import('./title.js').then(m => this.shell.go(new m.MenuScene(this.shell)));
  }
  draw(g, dt) {
    const r = this.shell.renderer;
    g.drawImage(stage(), 0, 0);
    const label = this.code ? `CONVITE PARA A SALA ${this.code}` : { solo: 'JOGAR · SOLO', online: 'JOGAR · ONLINE', sandbox: 'LABORATÓRIO', browse: 'O CLUBE DO CAOS' }[this.next];
    drawText(g, label, 16, 12, { color: '#f68268' });
    drawText(g, 'ESCOLHA SEU LUTADOR', 16, 24, { color: '#fff1d6', scale: 2, shadow: '#3a2450' });
    for (let k = 0; k < FIGHTERS.length; k++) {
      const x = SLOT(k), sel = k === this.index, f = FIGHTERS[k];
      // spotlight
      if (sel) {
        g.globalCompositeOperation = 'lighter';
        g.drawImage(spotlight(), x - 60, 40);
        g.globalCompositeOperation = 'source-over';
      }
      // pedestal
      g.fillStyle = sel ? f.color : '#3a2d52';
      g.fillRect(x - 32, 228, 64, 2);
      g.fillStyle = '#120d1e'; g.fillRect(x - 30, 230, 60, 6);
      g.fillStyle = 'rgba(8,4,14,0.6)';
      for (let xx = -18; xx <= 18; xx++) g.fillRect(x + xx, 227 - (Math.abs(xx) < 12 ? 1 : 0), 1, 1);
      if (sel) r.drawHero(g, k, x, 227, this.selOf === k ? this.selT : 0, { density: 2, dt, key: 'sel' + k });
      else r.drawPreview(g, k, x, 227, { density: 2, mode: 'idle', key: 'sel' + k, face: 1, dt, dim: 0.6 });
      drawText(g, f.name, sel ? Math.max(66, Math.min(VIEW_W - 66, x)) : x, 240, { color: sel ? '#fff1d6' : '#6a5e80', align: 'center', scale: sel ? 2 : 1, shadow: sel ? '#3a2450' : null });
    }
    const f = FIGHTERS[this.index];
    panel(g, 12, 262, VIEW_W - 24, 86, { accent: f.color });
    drawText(g, f.species, 22, 268, { color: f.color });
    drawText(g, f.role, VIEW_W - 22, 268, { color: '#8a7f9c', align: 'right' });
    paragraph(g, f.desc, 22, 282, 290, '#d8cde8');
    drawText(g, 'PODER ESPECIAL', 22, 310, { color: '#8a7f9c' });
    drawText(g, f.icon + ' ' + f.ability, 22, 322, { color: '#f2c35b' });
    paragraph(g, f.detail, 330, 282, 290, '#b9aecb');
    ['DANO', 'MOBILIDADE', 'ESPECIAL'].forEach((label, j) => {
      drawText(g, label, 330, 318 + j * 10, { color: '#8a7f9c' });
      for (let k = 0; k < 5; k++) { g.fillStyle = k < f.stats[j] ? f.color : '#2a2036'; g.fillRect(420 + k * 14, 320 + j * 10, 11, 4); }
    });
    if (this.next !== 'browse') button(g, this.confirmRect, this.next === 'online' ? 'CONTINUAR ▶' : 'LUTAR ▶', { hot: true, color: f.color });
    if (this.next === 'solo') {
      const n = Math.max(1, Math.min(3, this.shell.settings.bots ?? 3));
      button(g, this.botsRect, `BOTS: ${n} · ▲▼`, { color: '#8a7f9c' });
    }
    drawText(g, '◀ ▶ TROCAR · ESC VOLTA', VIEW_W - 12, this.next === 'solo' ? 58 : 38, { color: '#6a5e80', align: 'right' });
  }
}
