import { VIEW_W, VIEW_H, STEP, clamp } from '../../engine/const.js';
import { drawText, measure } from '../../engine/font.js';
import { Menu, panel } from '../widgets.js';
import { SelectScene } from './select.js';
import { OnlineScene } from './online.js';
import { SettingsScene, HelpScene, CreditsScene } from './panels.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
let logoCache = null;
function logoCanvas() {
  if (logoCache) return logoCache;
  const c = mk(260, 80), g = c.getContext('2d');
  drawText(g, 'ANIMAL', 4, 4, { color: '#fff1d6', outline: '#0b0812', shadow: '#f68268', scale: 4 });
  drawText(g, 'FIGHTER', 4, 40, { color: '#f68268', outline: '#0b0812', shadow: '#7a2a3a', scale: 5 });
  // two-tone fill: darken the lower half of each word
  const id = g.getImageData(0, 0, c.width, c.height), D = id.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    const band = (y >= 4 + 26 && y < 4 + 40) || (y >= 40 + 34 && y < 40 + 55);
    if (band && D[i] > 200 && D[i + 1] > 150) { D[i] *= 0.86; D[i + 1] *= 0.78; D[i + 2] *= 0.8; }
  }
  g.putImageData(id, 0, 0);
  return (logoCache = c);
}

export function drawLogo(g, x, y, t, scale = 1) {
  const c = logoCanvas();
  const w = c.width * scale, h = c.height * scale;
  g.drawImage(c, Math.round(x), Math.round(y), w, h);
  // sweeping shine
  const sx = ((t * 160) % 520) - 130;
  g.save();
  g.beginPath(); g.rect(Math.round(x), Math.round(y), w, h); g.clip();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.25;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < h; i++) g.fillRect(Math.round(x + sx * scale - i * 0.5), Math.round(y + i), 6 * scale, 1);
  g.restore();
  drawText(g, '®', x + w + 2, y + 2, { color: '#f68268' });
}

function stepAttract(shell, dt) {
  const a = shell.ensureAttract();
  shell.attractAge += dt;
  shell.attractAcc = Math.min((shell.attractAcc || 0) + dt, 0.1);
  while (shell.attractAcc >= STEP) { a.step(STEP); shell.attractAcc -= STEP; }
  for (const actor of a.actors) if (!actor.dead && actor.y > 700) actor.hp = 0;
  return a;
}
export function drawAttract(shell, g, dt, dim = 0.35) {
  const a = shell.attract || shell.ensureAttract();
  shell.renderer.render(a, { settings: { ...shell.settings, shake: false }, dt });
  if (dim > 0) { g.fillStyle = `rgba(8,5,16,${dim})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
}

export class TitleScene {
  constructor(shell) { this.shell = shell; this.t = 0; }
  enter() { this.shell.sound.music('menu'); }
  update(dt) {
    this.t += dt;
    stepAttract(this.shell, dt);
    const i = this.shell.input;
    if (this.t > 0.4 && (i.anyPressed || i.clicks.some(c => !c.down))) { this.shell.sound.play('ui_ok'); this.shell.go(new MenuScene(this.shell)); }
  }
  draw(g, dt) {
    drawAttract(this.shell, g, dt, 0.3);
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, 'rgba(8,5,16,0.65)'); grad.addColorStop(0.5, 'rgba(8,5,16,0.1)'); grad.addColorStop(1, 'rgba(8,5,16,0.7)');
    g.fillStyle = grad; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    drawLogo(g, VIEW_W / 2 - 130, 70 + bob, this.t);
    drawText(g, 'CLUBE DO CAOS · VOL. 02', VIEW_W / 2, 160, { color: '#cbb6d8', align: 'center', outline: '#0b0812' });
    if (Math.floor(this.t * 2) % 2 === 0) drawText(g, this.shell.input.touchMode ? 'TOQUE PARA COMEÇAR' : 'PRESSIONE QUALQUER TECLA', VIEW_W / 2, 270, { color: '#fff1d6', align: 'center', outline: '#0b0812', scale: 2 });
    drawText(g, 'PEQUENOS ANIMAIS. GRANDES PROBLEMAS.', VIEW_W / 2, 340, { color: '#8a7f9c', align: 'center', outline: '#0b0812' });
  }
}

export class MenuScene {
  constructor(shell) {
    this.shell = shell; this.t = 0;
    const s = shell;
    this.menu = new Menu([
      { label: 'JOGAR', hint: 'Você contra três bots. Primeiro a 5 nocautes.', action: () => s.go(new SelectScene(s, { next: 'solo' })) },
      { label: 'ONLINE', hint: 'Crie uma sala ou entre na de um amigo. Até 4 pessoas.', action: () => s.go(new SelectScene(s, { next: 'online' })) },
      { label: 'LABORATÓRIO', hint: 'Sandbox de física: arraste ragdolls, crie objetos, teste a violência.', action: () => s.go(new SelectScene(s, { next: 'sandbox' })) },
      { label: 'LUTADORES', hint: 'Conheça o clube do caos.', action: () => s.go(new SelectScene(s, { next: 'browse' })) },
      { label: 'COMO JOGAR', hint: 'Controles, perigos e truques.', action: () => s.push(new HelpScene(s)) },
      { label: 'AJUSTES', hint: 'Violência, efeitos, áudio e tela.', action: () => s.push(new SettingsScene(s)) },
      { label: 'CRÉDITOS', hint: 'Quem fez e o que foi usado.', action: () => s.push(new CreditsScene(s)) },
      { label: 'TELA CHEIA', hint: 'Também pela tecla F ou F11.', action: () => s.toggleFullscreen() }
    ], { x: 28, y: 118, w: 190, h: 18 });
  }
  enter() { this.shell.sound.music('menu'); }
  update(dt) {
    this.t += dt;
    stepAttract(this.shell, dt);
    const it = this.menu.update(this.shell.input, dt, this.shell.sound);
    if (it) it.action();
    if (this.shell.input.nav('back')) this.shell.go(new TitleScene(this.shell));
  }
  draw(g, dt) {
    drawAttract(this.shell, g, dt, 0.15);
    const grad = g.createLinearGradient(0, 0, 320, 0);
    grad.addColorStop(0, 'rgba(8,5,16,0.88)'); grad.addColorStop(0.75, 'rgba(8,5,16,0.55)'); grad.addColorStop(1, 'rgba(8,5,16,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 320, VIEW_H);
    drawLogo(g, 24, 26, this.t, 0.62);
    drawText(g, 'DEPÓSITO 07 · TURNO DA NOITE', 28, 94, { color: '#8a7f9c' });
    this.menu.draw(g);
    const hint = this.shell.input.lastDevice === 'pad' ? 'A CONFIRMA · B VOLTA' : '▲▼ ESCOLHE · ENTER CONFIRMA · ESC VOLTA';
    drawText(g, hint, 28, VIEW_H - 16, { color: '#6a5e80' });
    drawText(g, 'VERSÃO 0.2', VIEW_W - 8, VIEW_H - 16, { color: '#6a5e80', align: 'right', outline: '#0b0812' });
  }
}
