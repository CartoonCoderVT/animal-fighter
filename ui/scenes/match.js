import { VIEW_W, VIEW_H, S, clamp } from '../../engine/const.js';
import { drawText, measure } from '../../engine/font.js';
import { FIGHTERS } from '../../sim/fighters.js';
import { Menu, panel, button, hit, hover } from '../widgets.js';
import { SettingsScene, HelpScene } from './panels.js';
import { ResultsScene } from './results.js';

const SPAWNS = [['crate', 'CAIXA'], ['barrel', 'BARRIL'], ['propane', 'BOTIJÃO'], ['extinguisher', 'EXTINTOR'], ['grenade', 'GRANADA'], ['molotov', 'MOLOTOV'], ['blade', 'FACA'], ['katana', 'KATANA'], ['spear', 'LANÇA'], ['pipe', 'CANO'], ['axe', 'MACHADO'], ['hammer', 'MARRETA'], ['pistol', 'PISTOLA'], ['shotgun', 'ESCOPETA'], ['dummy', 'ALVO']];
const TOOLS = [['hand', 'MÃO'], ['slow', 'LENTO'], ['rig', 'ESQUELETO'], ['gore', 'VIOLÊNCIA'], ['reset', 'LIMPAR']];

// Buttons in a row from the left; a row that runs out of width continues one row up.
function layout(list, y) {
  let x = 6;
  return list.map(([id, label]) => {
    const w = measure(label) + 10;
    if (x + w > VIEW_W - 6) { x = 6; y -= 16; }
    const r = { id, label, x, y, w, h: 13 };
    x += w + 3;
    return r;
  });
}

export class MatchScene {
  constructor(shell, { mode = 'solo', online = false, countdown = 3 } = {}) {
    this.shell = shell; this.mode = mode; this.online = online; this.countdown = countdown; this.t = 0; this.endT = 0;
    this.tools = { hand: mode === 'sandbox', slow: false, rig: false };
    this.spawnBar = layout(SPAWNS, VIEW_H - 15);
    this.toolBar = layout(TOOLS, VIEW_H - 31);
    this.lastBeep = Math.ceil(countdown);
    this.dragging = false;
  }
  countdownNow() { return this.shell.game ? this.countdown : this.shell.remote?.countdown || 0; }
  enter() {
    const s = this.shell;
    s.sound.music('fight');
    if (s.game && this.countdown > 0) s.game.paused = true;
    if (this.countdown > 0) s.sound.play('countdown');
  }
  resume() { if (this.shell.game && !this.online) this.shell.game.paused = false; }
  // Driven by the simulation clock so a hidden host window still starts the round.
  tickCountdown(dt) {
    if (this.countdown <= 0) return;
    this.countdown -= dt;
    if (this.shell.game) this.shell.game.countdown = Math.max(0, this.countdown);
    const n = Math.ceil(this.countdown - 0.7);
    if (n !== this.lastBeep && n >= 0) { this.lastBeep = n; this.shell.sound.play(n > 0 ? 'countdown' : 'go'); }
    if (this.countdown <= 0 && this.shell.game && this.shell.stack.length === 1) this.shell.game.paused = false;
  }

  labAction(id) {
    const s = this.shell, g = s.game;
    if (!g || this.mode !== 'sandbox') return;
    const me = g.actor(s.localId);
    const m = s.input.mouse;
    const usable = m.inside && m.y < VIEW_H - 34 && m.y > 34;
    const mw = s.renderer.viewToWorld(m.x, m.y);
    const x = usable ? mw.x : clamp((me?.x ?? 480) + (me?.face ?? 1) * 90, 40, 920), y = usable ? mw.y : 80;
    if (id === 'hand') { this.tools.hand = !this.tools.hand; if (!this.tools.hand) g.release(); return; }
    if (id === 'slow') { this.tools.slow = !this.tools.slow; g.timeScale = this.tools.slow ? 0.3 : 1; return; }
    if (id === 'rig') { this.tools.rig = !this.tools.rig; return; }
    if (id === 'gore') { s.settings.gore = (s.settings.gore + 2) % 3; s.saveSettings(); s.toast(['SEM SANGUE', 'SÓ SANGUE', 'VIOLÊNCIA COMPLETA'][s.settings.gore]); return; }
    if (id === 'reset') { s.startMatch(s.lastPlayers, { mode: 'sandbox', instant: true }); return; }
    if (id === 'dummy') {
      if (g.actors.length >= 10) { s.toast('Limite de 10 alvos. Use LIMPAR.'); return; }
      g.addActor({ type: (s.selected + g.actors.length) % FIGHTERS.length, x: clamp(x, 40, 920), y: Math.min(y, 300), bot: true });
      return;
    }
    if (id === 'pistol' || id === 'shotgun') g.addProp({ kind: 'gun', weapon: id, x, y });
    else g.addProp({ kind: id, x, y });
    s.sound.play('pickup', x);
  }

  update(dt) {
    const s = this.shell, i = s.input, game = s.game;
    this.t += dt;
    if (i.nav('back') || i.nav('pause') || i.pressed('Escape')) { s.push(new PauseScene(s, this)); if (game && !this.online) game.paused = true; return; }

    const st = s.state();
    const me = st?.actors.find(a => a.id === s.localId);
    const gi = i.gameInput();
    if (gi.padAim !== null && gi.padAim !== undefined && me) { gi.aimX = me.x + Math.cos(gi.padAim) * 200; gi.aimY = me.y + 5 + Math.sin(gi.padAim) * 200; }
    delete gi.padAim;
    // LAB toolbar and the hand
    if (this.mode === 'sandbox' && game) {
      let consumed = false;
      for (const c of i.clicks) for (const b of [...this.spawnBar, ...this.toolBar]) if (c.x >= b.x && c.x < b.x + b.w && c.y >= b.y && c.y < b.y + b.h) { consumed = true; if (!c.down) this.labAction(b.id); }
      if (this.tools.hand) {
        gi.attack = false;
        const m = i.mouse;
        const overBar = m.y > VIEW_H - 34;
        const w = s.renderer.viewToWorld(m.x, m.y);
        if (i.clicks.some(c => c.down && c.button === 0) && !consumed && !overBar) this.dragging = game.grabAt(w.x, w.y);
        if (this.dragging && m.buttons.has(0)) game.dragTo(w.x, w.y);
        if (this.dragging && !m.buttons.has(0)) { game.release(); this.dragging = false; }
      } else if (consumed) gi.attack = false;
    }
    if (this.countdownNow() > 0) Object.assign(gi, { left: false, right: false, jump: false, attack: false, power: false, grab: false, dodge: false, bats: false });
    if (game) game.inputFor(s.localId, gi);
    else if (s.net.started) {
      s.inputTick += dt;
      const key = JSON.stringify(gi);
      if (key !== this.lastSent || s.inputTick > 1 / 30) { s.net.sendInput(gi); s.inputTick = 0; this.lastSent = key; }
    }

    if (st && st.winner !== null && st.winner !== undefined) {
      this.endT += dt;
      if (this.endT > 1.4) s.go(new ResultsScene(s, { winner: st.winner, actors: st.actors.map(a => ({ ...a })), mode: this.mode, localId: s.localId }));
    }
  }

  draw(g, dt) {
    const s = this.shell, st = s.state();
    if (!st) {
      g.fillStyle = '#0d0918'; g.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(g, 'AGUARDANDO O ANFITRIÃO…', VIEW_W / 2, VIEW_H / 2, { color: '#cbb6d8', align: 'center' });
      return;
    }
    const paused = s.game?.paused && this.countdown <= 0;
    const figures = s.renderer.render(st, { localId: s.localId, settings: paused ? { ...s.settings, shake: false } : s.settings, debug: this.tools.rig, dt: paused ? 0 : dt });
    s.hud.draw(g, st, figures, { localId: s.localId, mode: this.mode, dt, touch: s.input.touchMode && s.stack.length === 1, countdown: this.countdownNow(), time: this.t });
    s.renderer.drawOverlay(g, st);
    if (this.mode === 'sandbox') {
      for (const b of this.toolBar) {
        const on = this.tools[b.id];
        panel(g, b.x, b.y, b.w, b.h, { fill: on ? '#f68268' : '#120d1ee6', edge: on ? '#ffd9c8' : '#4a3a68' });
        drawText(g, b.label, b.x + 5, b.y + 2, { color: on ? '#1a1020' : '#f0e4d0' });
      }
      for (const b of this.spawnBar) {
        const hot = hover(s.input, b);
        panel(g, b.x, b.y, b.w, b.h, { fill: hot ? '#3a2850' : '#120d1ee6' });
        drawText(g, b.label, b.x + 5, b.y + 2, { color: '#e8c590' });
      }
      if (this.tools.hand && s.input.mouse.inside) {
        const m = s.input.mouse;
        g.fillStyle = this.dragging ? '#f68268' : '#fff1d6';
        g.fillRect(Math.round(m.x) - 3, Math.round(m.y), 7, 1); g.fillRect(Math.round(m.x), Math.round(m.y) - 3, 1, 7);
        if (this.dragging && s.game?.grab) {
          const b = s.renderer.worldToView(s.game.grab.body.position.x, s.game.grab.body.position.y);
          const n = Math.round(Math.hypot(b.x - m.x, b.y - m.y));
          for (let k = 0; k < n; k += 2) g.fillRect(Math.round(m.x + (b.x - m.x) * (k / n)), Math.round(m.y + (b.y - m.y) * (k / n)), 1, 1);
        }
      }
    }
    if (this.online && !s.net.host && s.latency) drawText(g, `PING ${s.latency}MS`, 6, VIEW_H - 14, { color: '#8a7f9c', outline: '#0b0812' });
  }
}

export class PauseScene {
  constructor(shell, match) {
    this.shell = shell; this.match = match;
    const s = shell;
    const items = [
      { label: 'CONTINUAR', action: () => this.close() },
      { label: 'COMO JOGAR', action: () => s.push(new HelpScene(s)) },
      { label: 'AJUSTES', action: () => s.push(new SettingsScene(s)) }
    ];
    if (!match.online) items.push({ label: 'REINICIAR', action: () => { s.pop(); s.startMatch(s.lastPlayers, { mode: match.mode }); } });
    items.push({ label: 'SAIR DA PARTIDA', color: '#ee6b6b', action: () => { if (s.net.host) s.net.end(); s.leaveMatch({ keepRoom: false }); } });
    this.menu = new Menu(items, { x: VIEW_W / 2 - 90, y: 140, w: 180, h: 18 });
  }
  close() { this.shell.pop(); this.match.resume(); this.shell.canvas.focus(); }
  update(dt) {
    const it = this.menu.update(this.shell.input, dt, this.shell.sound);
    if (it) it.action();
    else if (this.shell.input.nav('back') || this.shell.input.nav('pause')) this.close();
  }
  draw(g) {
    g.fillStyle = 'rgba(8,5,16,0.72)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(g, VIEW_W / 2 - 110, 92, 220, 160, { accent: '#f68268' });
    drawText(g, this.match.online ? 'MENU' : 'INTERVALO', VIEW_W / 2 - 90, 102, { color: '#8a7f9c' });
    drawText(g, this.match.online ? 'A TRETA CONTINUA' : 'RESPIRA UM POUCO.', VIEW_W / 2 - 90, 116, { color: '#fff1d6', scale: 2 });
    this.menu.draw(g);
  }
}
