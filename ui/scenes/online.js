import { VIEW_W, VIEW_H } from '../../engine/const.js';
import { drawText } from '../../engine/font.js';
import { FIGHTERS } from '../../sim/fighters.js';
import { panel, paragraph, button, hit, hover, TextField } from '../widgets.js';

const goMenu = s => import('./title.js').then(m => s.go(new m.MenuScene(s)));

export class OnlineScene {
  constructor(shell, { code = '' } = {}) {
    this.shell = shell; this.t = 0; this.status = '';
    this.name = new TextField({ label: 'SEU NOME', value: shell.settings.name || FIGHTERS[shell.selected].name, maxLength: 18, filter: /[\p{L}\p{N} _.\-]/u });
    this.code = new TextField({ label: 'CÓDIGO DA SALA', value: code, maxLength: 6, filter: /[A-Za-z2-9]/ });
    this.items = ['name', 'create', 'code', 'join', 'fighter', 'back'];
    this.focus = code ? 3 : 1;
    this.busy = false;
    const x = VIEW_W / 2 - 150;
    this.rects = { name: { x, y: 92, w: 300, h: 32 }, create: { x, y: 134, w: 300, h: 22 }, code: { x, y: 182, w: 200, h: 32 }, join: { x: x + 208, y: 194, w: 92, h: 20 }, fighter: { x, y: 244, w: 300, h: 18 }, back: { x, y: 268, w: 300, h: 18 } };
    this.name.onEnter = () => this.setFocus(1);
    this.code.onEnter = () => this.setFocus(3);
  }
  enter() { this.setFocus(this.focus); }
  exit() { this.shell.input.blurText(); }
  setFocus(i) {
    this.focus = (i + this.items.length) % this.items.length;
    const key = this.items[this.focus];
    this.name.focused = key === 'name';
    this.code.focused = key === 'code';
    if (key === 'name') this.shell.input.focusText(this.name.target(), this.name.value);
    else if (key === 'code') this.shell.input.focusText(this.code.target(), this.code.value);
    else this.shell.input.blurText();
  }
  async create() {
    if (this.busy) return;
    this.busy = true;
    this.shell.settings.name = this.name.value.trim();
    this.shell.saveSettings();
    this.shell.net.bots = Math.max(0, Math.min(3, this.shell.settings.bots ?? 3));
    try { await this.shell.net.create(this.name.value, this.shell.selected); } catch (e) { this.status = e.message; }
    this.busy = false;
  }
  async join() {
    if (this.busy) return;
    this.busy = true;
    this.shell.settings.name = this.name.value.trim();
    this.shell.saveSettings();
    try { await this.shell.net.join(this.code.value, this.name.value, this.shell.selected); } catch (e) { this.status = e.message; }
    this.busy = false;
  }
  activate(key) {
    this.shell.sound.play('ui_ok');
    if (key === 'create') this.create();
    else if (key === 'join') this.join();
    else if (key === 'back') { this.shell.net.close(); goMenu(this.shell); }
    else if (key === 'fighter') import('./select.js').then(m => this.shell.go(new m.SelectScene(this.shell, { next: 'online', code: this.code.value })));
    else this.setFocus(this.items.indexOf(key));
  }
  update(dt) {
    this.t += dt;
    const i = this.shell.input;
    if (i.nav('up')) { this.setFocus(this.focus - 1); this.shell.sound.play('ui_move'); }
    if (i.nav('down')) { this.setFocus(this.focus + 1); this.shell.sound.play('ui_move'); }
    for (const [key, r] of Object.entries(this.rects)) if (hit(i, r)) this.activate(key);
    const key = this.items[this.focus];
    if (i.nav('ok') && key !== 'name' && key !== 'code') this.activate(key);
    if (i.nav('back') && !i.textTarget) { this.shell.net.close(); goMenu(this.shell); }
  }
  draw(g, dt) {
    g.fillStyle = '#0d0918'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(g, VIEW_W / 2 - 166, 30, 332, 300, { accent: '#f68268' });
    drawText(g, 'A TRETA FICA MELHOR EM GRUPO', VIEW_W / 2 - 150, 42, { color: '#8a7f9c' });
    drawText(g, 'JOGAR COM AMIGOS', VIEW_W / 2 - 150, 56, { color: '#fff1d6', scale: 2, shadow: '#3a2450' });
    const sel = k => this.items[this.focus] === k;
    this.name.draw(g, this.rects.name.x, this.rects.name.y, 300, dt);
    button(g, this.rects.create, this.busy ? 'CONECTANDO…' : 'CRIAR UMA SALA', { hot: sel('create'), disabled: this.busy });
    drawText(g, 'OU ENTRE NA SALA DE UM AMIGO', VIEW_W / 2, 166, { color: '#6a5e80', align: 'center' });
    this.code.draw(g, this.rects.code.x, this.rects.code.y, 200, dt);
    button(g, this.rects.join, 'ENTRAR', { hot: sel('join'), disabled: this.busy });
    paragraph(g, 'Até quatro pessoas; bots completam as vagas. O anfitrião mantém o jogo aberto.', VIEW_W / 2 - 150, 222, 300, '#8a7f9c');
    button(g, this.rects.fighter, `LUTADOR: ${FIGHTERS[this.shell.selected].name.toUpperCase()} · TROCAR`, { hot: sel('fighter'), color: FIGHTERS[this.shell.selected].color });
    button(g, this.rects.back, 'VOLTAR', { hot: sel('back') });
    if (this.status) paragraph(g, this.status, VIEW_W / 2 - 150, 296, 300, '#f2c35b');
  }
}

export class LobbyScene {
  constructor(shell) {
    this.shell = shell; this.t = 0; this.copied = 0;
    this.items = ['bots', 'start', 'leave'];
    this.focus = shell.net.host ? 1 : 2;
    this.rects = { code: { x: VIEW_W / 2 - 150, y: 70, w: 300, h: 40 }, bots: { x: VIEW_W / 2 - 150, y: 242, w: 300, h: 16 }, start: { x: VIEW_W / 2 - 150, y: 262, w: 300, h: 20 }, leave: { x: VIEW_W / 2 - 150, y: 286, w: 300, h: 16 } };
  }
  async copy() {
    const link = `${location.origin}${location.pathname}?sala=${this.shell.net.code}`;
    try { await navigator.clipboard.writeText(link); this.copied = 2; } catch { this.shell.toast('Código da sala: ' + this.shell.net.code); }
  }
  start() {
    const s = this.shell, net = s.net;
    if (!net.host) return;
    const players = net.players.map(p => ({ ...p }));
    const used = new Set(players.map(p => p.id));
    // The chosen number of bots fills free places; with nobody else in the room one still comes.
    let bots = Math.max(net.bots, players.length < 2 ? 1 : 0);
    for (let id = 0; id < 4 && bots > 0; id++) if (!used.has(id)) { players.push({ id, type: (s.selected + id + 1) % FIGHTERS.length, name: FIGHTERS[(s.selected + id + 1) % FIGHTERS.length].name + ' BOT', bot: true }); bots--; }
    try { net.start(players); s.startMatch(players, { mode: 'online' }); } catch (e) { s.toast(e.message); }
  }
  // The host cycles the number of bots, 0 to 3, and it is remembered.
  cycleBots() {
    const s = this.shell;
    if (!s.net.host) return;
    s.settings.bots = (s.net.bots + 1) % 4;
    s.saveSettings();
    s.net.setBots(s.settings.bots);
    s.sound.play('ui_move');
  }
  leave() { this.shell.net.close(); goMenu(this.shell); }
  update(dt) {
    this.t += dt; this.copied = Math.max(0, this.copied - dt);
    const i = this.shell.input;
    if (i.nav('up')) { this.focus = (this.focus + 2) % 3; this.shell.sound.play('ui_move'); }
    if (i.nav('down')) { this.focus = (this.focus + 1) % 3; this.shell.sound.play('ui_move'); }
    if (i.pressed('KeyC') || hit(i, this.rects.code)) this.copy();
    if (hit(i, this.rects.start)) this.start();
    if (hit(i, this.rects.bots)) this.cycleBots();
    // Your own fighter can still be changed while the room waits.
    const me = this.shell.net.players.findIndex(p => p.id === this.shell.net.localId);
    const step = i.nav('left') ? -1 : i.nav('right') ? 1 : me >= 0 && hit(i, { x: VIEW_W / 2 - 150, y: 122 + me * 30, w: 300, h: 26 }) ? 1 : 0;
    if (step) { this.shell.pickFighter((this.shell.selected + step + FIGHTERS.length) % FIGHTERS.length); this.shell.sound.play('ui_move'); }
    if (hit(i, this.rects.leave)) this.leave();
    if (i.nav('ok')) { const k = this.items[this.focus]; if (k === 'start') this.start(); else if (k === 'bots') this.cycleBots(); else this.leave(); }
    if (i.nav('back')) this.leave();
  }
  draw(g) {
    const net = this.shell.net;
    g.fillStyle = '#0d0918'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(g, VIEW_W / 2 - 166, 30, 332, 290, { accent: '#7bcbbb' });
    drawText(g, net.host ? 'SUA SALA ESTÁ ABERTA' : 'VOCÊ ESTÁ NA SALA', VIEW_W / 2 - 150, 36, { color: '#8a7f9c' });
    drawText(g, 'JUNTA A GALERA.', VIEW_W / 2 - 150, 47, { color: '#fff1d6', scale: 2 });
    panel(g, this.rects.code.x, this.rects.code.y, 300, 40, { fill: '#120d1e', edge: '#665665' });
    drawText(g, net.code, VIEW_W / 2 - 140, 80, { color: '#f68268', scale: 3, spacing: 2 });
    drawText(g, this.copied > 0 ? 'LINK COPIADO!' : 'C · COPIAR LINK', VIEW_W / 2 + 140, 86, { color: '#cbb6d8', align: 'right' });
    for (let k = 0; k < 4; k++) {
      const p = net.players[k], y = 122 + k * 30;
      panel(g, VIEW_W / 2 - 150, y, 300, 26, { fill: p ? '#1d1430' : '#120d1e', accent: p ? FIGHTERS[p.type].color : null });
      if (p) {
        g.save(); g.beginPath(); g.rect(VIEW_W / 2 - 146, y + 2, 22, 22); g.clip();
        this.shell.renderer.drawPreview(g, p.type, VIEW_W / 2 - 135, y + 32, { density: 1, key: 'lobby' + k, dt: 0 });
        g.restore();
        drawText(g, p.name, VIEW_W / 2 - 118, y + 4, { color: '#fff1d6' });
        drawText(g, FIGHTERS[p.type].name + (p.id === 0 ? ' · ANFITRIÃO' : ''), VIEW_W / 2 - 118, y + 14, { color: '#8a7f9c' });
        if (p.id === net.localId) drawText(g, '◀ ▶ TROCAR', VIEW_W / 2 + 144, y + 9, { color: FIGHTERS[p.type].color, align: 'right' });
      } else drawText(g, k - net.players.length < net.bots ? 'VAGA LIVRE · UM BOT JOGA SE NINGUÉM ENTRAR' : 'VAGA LIVRE · SEM BOT', VIEW_W / 2 - 140, y + 9, { color: '#5a4e68' });
    }
    button(g, this.rects.bots, net.host ? `BOTS: ${net.bots} · TROCAR` : `BOTS: ${net.bots} · O ANFITRIÃO ESCOLHE`, { hot: this.focus === 0 && net.host, disabled: !net.host, color: '#8a7f9c' });
    button(g, this.rects.start, net.host ? 'COMEÇAR PARTIDA ▶' : 'AGUARDANDO ANFITRIÃO…', { hot: this.focus === 1 && net.host, disabled: !net.host, color: '#7bcbbb' });
    button(g, this.rects.leave, 'SAIR DA SALA', { hot: this.focus === 2 });
    drawText(g, net.host ? 'MANDE O CÓDIGO E O LINK DO JOGO PARA OS AMIGOS.' : 'O ANFITRIÃO COMEÇA A PARTIDA.', VIEW_W / 2, 308, { color: '#6a5e80', align: 'center' });
  }
}
