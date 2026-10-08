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
    this.items = ['name', 'create', 'code', 'join', 'back'];
    this.focus = code ? 3 : 1;
    this.busy = false;
    const x = VIEW_W / 2 - 150;
    this.rects = { name: { x, y: 92, w: 300, h: 32 }, create: { x, y: 134, w: 300, h: 22 }, code: { x, y: 182, w: 200, h: 32 }, join: { x: x + 208, y: 194, w: 92, h: 20 }, back: { x, y: 268, w: 300, h: 18 } };
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
    paragraph(g, `Você joga de ${FIGHTERS[this.shell.selected].name}. Até quatro pessoas; bots completam as vagas. O anfitrião mantém o jogo aberto.`, VIEW_W / 2 - 150, 222, 300, '#8a7f9c');
    button(g, this.rects.back, 'VOLTAR', { hot: sel('back') });
    if (this.status) paragraph(g, this.status, VIEW_W / 2 - 150, 296, 300, '#f2c35b');
  }
}

export class LobbyScene {
  constructor(shell) {
    this.shell = shell; this.t = 0; this.copied = 0;
    this.items = ['start', 'leave'];
    this.focus = shell.net.host ? 0 : 1;
    this.rects = { code: { x: VIEW_W / 2 - 150, y: 70, w: 300, h: 40 }, start: { x: VIEW_W / 2 - 150, y: 254, w: 300, h: 22 }, leave: { x: VIEW_W / 2 - 150, y: 282, w: 300, h: 18 } };
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
    for (let id = 0; id < 4; id++) if (!used.has(id)) players.push({ id, type: (s.selected + id + 1) % 5, name: FIGHTERS[(s.selected + id + 1) % 5].name + ' BOT', bot: true });
    try { net.start(players); s.startMatch(players, { mode: 'online' }); } catch (e) { s.toast(e.message); }
  }
  leave() { this.shell.net.close(); goMenu(this.shell); }
  update(dt) {
    this.t += dt; this.copied = Math.max(0, this.copied - dt);
    const i = this.shell.input;
    if (i.nav('up') || i.nav('down')) { this.focus = 1 - this.focus; this.shell.sound.play('ui_move'); }
    if (i.pressed('KeyC') || hit(i, this.rects.code)) this.copy();
    if (hit(i, this.rects.start)) this.start();
    if (hit(i, this.rects.leave)) this.leave();
    if (i.nav('ok')) { if (this.items[this.focus] === 'start') this.start(); else this.leave(); }
    if (i.nav('back')) this.leave();
  }
  draw(g) {
    const net = this.shell.net;
    g.fillStyle = '#0d0918'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(g, VIEW_W / 2 - 166, 30, 332, 290, { accent: '#7bcbbb' });
    drawText(g, net.host ? 'SUA SALA ESTÁ ABERTA' : 'VOCÊ ESTÁ NA SALA', VIEW_W / 2 - 150, 42, { color: '#8a7f9c' });
    drawText(g, 'JUNTA A GALERA.', VIEW_W / 2 - 150, 54, { color: '#fff1d6', scale: 2 });
    panel(g, this.rects.code.x, this.rects.code.y, 300, 40, { fill: '#120d1e', edge: '#665665' });
    drawText(g, net.code, VIEW_W / 2 - 140, 80, { color: '#f68268', scale: 3, spacing: 2 });
    drawText(g, this.copied > 0 ? 'LINK COPIADO!' : 'C · COPIAR LINK', VIEW_W / 2 + 140, 86, { color: '#cbb6d8', align: 'right' });
    for (let k = 0; k < 4; k++) {
      const p = net.players[k], y = 122 + k * 30;
      panel(g, VIEW_W / 2 - 150, y, 300, 26, { fill: p ? '#1d1430' : '#120d1e', accent: p ? FIGHTERS[p.type].color : null });
      if (p) {
        g.save(); g.beginPath(); g.rect(VIEW_W / 2 - 146, y + 2, 22, 22); g.clip();
        this.shell.renderer.drawPreview(g, p.type, VIEW_W / 2 - 135, y + 46, { density: 1, key: 'lobby' + k, dt: 0 });
        g.restore();
        drawText(g, p.name, VIEW_W / 2 - 118, y + 4, { color: '#fff1d6' });
        drawText(g, FIGHTERS[p.type].name + (p.id === 0 ? ' · ANFITRIÃO' : ''), VIEW_W / 2 - 118, y + 14, { color: '#8a7f9c' });
      } else drawText(g, 'VAGA LIVRE · UM BOT JOGA SE NINGUÉM ENTRAR', VIEW_W / 2 - 140, y + 9, { color: '#5a4e68' });
    }
    button(g, this.rects.start, net.host ? 'COMEÇAR PARTIDA ▶' : 'AGUARDANDO ANFITRIÃO…', { hot: this.focus === 0 && net.host, disabled: !net.host, color: '#7bcbbb' });
    button(g, this.rects.leave, 'SAIR DA SALA', { hot: this.focus === 1 });
    drawText(g, net.host ? 'MANDE O CÓDIGO E O LINK DO JOGO PARA OS AMIGOS.' : 'O ANFITRIÃO COMEÇA A PARTIDA.', VIEW_W / 2, 306, { color: '#6a5e80', align: 'center' });
  }
}
