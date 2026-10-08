import { VIEW_W, VIEW_H, rnd } from '../../engine/const.js';
import { drawText } from '../../engine/font.js';
import { FIGHTERS } from '../../sim/fighters.js';
import { Menu, panel } from '../widgets.js';
import { SelectScene } from './select.js';

export class ResultsScene {
  constructor(shell, { winner, actors, mode, localId }) {
    this.shell = shell; this.winner = winner; this.mode = mode; this.localId = localId; this.t = 0;
    this.actors = actors.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    this.w = actors.find(a => a.id === winner) || this.actors[0];
    this.confetti = Array.from({ length: 90 }, () => ({ x: rnd(0, VIEW_W), y: rnd(-200, 0), vy: rnd(0.4, 1.2), vx: rnd(-0.3, 0.3), c: ['#f68268', '#f2c35b', '#7bcbbb', '#d3a0df', '#9fb9ea'][Math.floor(rnd(0, 5))], s: rnd(0, 6) }));
    const s = shell, online = mode === 'online';
    const items = [];
    if (!online || s.net.host) items.push({ label: online ? 'REVANCHE' : 'MAIS UMA', action: () => this.rematch() });
    if (!online) items.push({ label: 'TROCAR LUTADOR', action: () => s.go(new SelectScene(s, { next: mode === 'sandbox' ? 'sandbox' : 'solo' })) });
    items.push({ label: 'MENU PRINCIPAL', action: () => { if (online && s.net.host) s.net.end(); s.leaveMatch({ keepRoom: false }); } });
    this.menu = new Menu(items, { x: 400, y: 268, w: 220, h: 18 });
  }
  enter() { this.shell.sound.music('menu'); this.shell.sound.play('go'); }
  rematch() {
    const s = this.shell;
    if (this.mode === 'online') { try { s.net.start(s.lastPlayers); s.startMatch(s.lastPlayers, { mode: 'online' }); } catch (e) { s.toast(e.message); } }
    else s.startMatch(s.lastPlayers, { mode: this.mode });
  }
  update(dt) {
    this.t += dt;
    for (const c of this.confetti) { c.y += c.vy; c.x += c.vx + Math.sin(this.t * 2 + c.s) * 0.2; if (c.y > VIEW_H) { c.y = -4; c.x = rnd(0, VIEW_W); } }
    const it = this.menu.update(this.shell.input, dt, this.shell.sound);
    if (it) it.action();
  }
  draw(g, dt) {
    g.fillStyle = '#0d0918'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const f = FIGHTERS[this.w.type];
    // spotlight podium
    g.fillStyle = '#1b1430';
    for (let y = 30; y < 250; y++) { const half = 10 + (y - 30) * 0.32; g.fillRect(Math.round(150 - half), y, Math.round(half * 2), 1); }
    g.fillStyle = f.color; g.fillRect(96, 246, 108, 3);
    g.fillStyle = '#120d1e'; g.fillRect(100, 249, 100, 30);
    drawText(g, '1', 150, 256, { color: f.color, scale: 2, align: 'center' });
    this.shell.renderer.drawPreview(g, this.w.type, 150, 246, { density: 3, mode: 'demo', key: 'win', dt });
    for (const c of this.confetti) { g.fillStyle = c.c; g.fillRect(Math.round(c.x), Math.round(c.y), Math.floor(this.t * 8 + c.s) % 2 ? 2 : 1, 2); }
    const local = this.w.id === this.localId;
    drawText(g, local ? 'É DO CLUBE!' : 'FIM DA CONFUSÃO', 300, 30, { color: '#8a7f9c' });
    drawText(g, `${this.w.name} VENCEU.`, 300, 44, { color: '#fff1d6', scale: 3, shadow: f.color });
    panel(g, 300, 86, 326, 22 + this.actors.length * 18);
    const cols = [['LUTADOR', 308], ['NOC', 450], ['MORTES', 478], ['DANO', 522], ['MEMBROS', 556]];
    for (const [l, x] of cols) drawText(g, l, x, 92, { color: '#6a5e80' });
    this.actors.forEach((a, i) => {
      const y = 106 + i * 18, ff = FIGHTERS[a.type];
      g.fillStyle = ff.color; g.fillRect(308, y + 2, 4, 6);
      drawText(g, a.name + (a.id === this.localId ? ' · VOCÊ' : ''), 316, y, { color: a.id === this.w.id ? '#fff1d6' : '#b9aecb' });
      drawText(g, String(a.kills), 450, y, { color: '#f2c35b' });
      drawText(g, String(a.deaths), 478, y, { color: '#b9aecb' });
      drawText(g, String(Math.round(a.stats?.damage || 0)), 522, y, { color: '#b9aecb' });
      drawText(g, String(a.stats?.limbs || 0), 556, y, { color: '#b9aecb' });
    });
    this.menu.draw(g);
    if (this.mode === 'online' && !this.shell.net.host) drawText(g, 'AGUARDANDO O ANFITRIÃO…', 400, 250, { color: '#8a7f9c' });
  }
}
