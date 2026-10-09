// The whole site is the game: one canvas, a stack of in-game scenes, the fixed-step simulation and netcode.
import { VIEW_W, VIEW_H, STEP, clamp } from '../engine/const.js';
import { Input, EMPTY_INPUT } from '../engine/input.js';
import { Sound } from '../engine/audio.js';
import { drawText, measure } from '../engine/font.js';
import { Renderer } from '../render/renderer.js';
import { HUD, panel } from '../render/hud.js';
import { Game } from '../sim/game.js';
import { FIGHTERS } from '../sim/fighters.js';
import { Multiplayer } from '../net/network.js';
import { dissolve } from './widgets.js';
import { TitleScene, MenuScene } from './scenes/title.js';
import { MatchScene } from './scenes/match.js';
import { LobbyScene, OnlineScene } from './scenes/online.js';
import { SelectScene } from './scenes/select.js';

const DEFAULTS = { gore: 2, shake: true, camera: true, particles: true, volume: 0.35, music: 0.25, pixel: 'sharp', fps: false, name: '', map: 'depot' };

export class Shell {
  constructor(canvas, textInput, live) {
    this.canvas = canvas;
    this.live = live;
    this.settings = { ...DEFAULTS };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('af-settings') || '{}')); } catch {}
    this.renderer = new Renderer(canvas);
    this.renderer.pixelMode = this.settings.pixel;
    this.input = new Input(canvas, textInput);
    this.input.screenToView = (x, y) => this.renderer.screenToView(x, y);
    this.input.viewToWorld = (x, y) => this.renderer.viewToWorld(x, y);
    this.sound = new Sound();
    this.sound.volume = this.settings.volume;
    this.sound.musicVolume = this.settings.music;
    this.renderer.fx.onSound = (n, x) => this.sound.play(n, x);
    this.hud = new HUD(this.renderer);
    this.net = new Multiplayer(e => this.networkEvent(e));
    this.selected = Number.isInteger(this.settings.fighter) ? clamp(this.settings.fighter, 0, FIGHTERS.length - 1) : 0;
    this.mode = 'solo';
    this.game = null; this.remote = null; this.remotePrev = null; this.lastRemote = 0; this.lastEvent = 0; this.latency = 0;
    this.localId = 0;
    this.attract = null; this.attractAge = 0;
    this.stack = [];
    this.fade = 0; this.fadeDir = 0; this.pending = null;
    this.toasts = [];
    this.acc = 0; this.netTick = 0; this.inputTick = 0; this.pingTick = 0;
    this.last = performance.now();
    this.frameMs = 16; this.fpsT = 0; this.fps = 60; this.frames = 0;
    this.resizeFlag = true;
    new ResizeObserver(() => { this.resizeFlag = true; }).observe(canvas);
    addEventListener('resize', () => { this.resizeFlag = true; });
    addEventListener('keydown', e => { if (e.code === 'F11' || (e.code === 'KeyF' && !this.input.textTarget && !this.playing)) { e.preventDefault(); this.toggleFullscreen(); } });
    try {
      this.ticker = new Worker('ticker.js');
      // Browsers stop rAF for hidden or occluded windows; keep the simulation (and the online host) alive.
      this.ticker.onmessage = () => { if (document.hidden || performance.now() - this.last > 120) this.simulate(performance.now(), true); };
    } catch {}
    const room = new URL(location.href).searchParams.get('sala');
    // An invite opens the fighter select first, then the room with its code filled in.
    if (room && /^[A-Z2-9]{6}$/i.test(room)) this.stack = [new SelectScene(this, { next: 'online', code: room.toUpperCase() })];
    else this.stack = [new TitleScene(this)];
    this.stack[0].enter?.();
    requestAnimationFrame(t => this.frame(t));
  }

  get scene() { return this.stack[this.stack.length - 1]; }
  get base() { return this.stack[0]; }
  get playing() { return this.base instanceof MatchScene; }

  // Sets the fighter you play as and remembers it; in a room it is sent to the others.
  pickFighter(type) {
    this.selected = type;
    this.settings.fighter = type;
    this.saveSettings();
    if (this.net.status === 'lobby') this.net.pick(type);
  }

  saveSettings() {
    try { localStorage.setItem('af-settings', JSON.stringify(this.settings)); } catch {}
    this.sound.volume = this.settings.volume;
    this.sound.musicVolume = this.settings.music;
    this.sound.applyVolume();
    this.renderer.pixelMode = this.settings.pixel;
    this.resizeFlag = true;
  }

  go(scene, { instant = false } = {}) {
    if (instant) { this.swap(scene); return; }
    this.pending = scene;
    this.fadeDir = 1;
  }
  swap(scene) {
    for (const s of this.stack) s.exit?.();
    this.stack = [scene];
    this.input.blurText();
    scene.enter?.();
  }
  push(scene) { this.stack.push(scene); scene.enter?.(); }
  pop() { const s = this.stack.pop(); s?.exit?.(); this.input.blurText(); this.scene?.resume?.(); }

  toast(text) {
    this.toasts.push({ text, life: 3.2 });
    if (this.toasts.length > 3) this.toasts.shift();
    if (this.live) this.live.textContent = text;
  }

  async enableAudio() {
    if (this.sound.enabled) return;
    try { await this.sound.enable(true); } catch {}
  }

  toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => this.toast('Tela cheia indisponível neste navegador.'));
    } catch { this.toast('Tela cheia indisponível neste navegador.'); }
  }

  // ---- matches --------------------------------------------------------------------------
  makePlayers() {
    const name = (this.settings.name || FIGHTERS[this.selected].name).slice(0, 18);
    const bots = clamp(this.settings.bots ?? 3, 1, 3);
    return [{ id: 0, type: this.selected, name, bot: false }, ...[1, 2, 3].slice(0, bots).map(id => ({ id, type: (this.selected + id) % 5, name: FIGHTERS[(this.selected + id) % 5].name, bot: true }))];
  }

  startMatch(players = this.makePlayers(), { mode = this.mode, isRemote = false, instant = false, map = this.settings.map } = {}) {
    this.disposeGame();
    this.mode = mode;
    this.renderer.resetMatch();
    this.hud.reset();
    this.remote = null; this.remotePrev = null; this.lastEvent = 0; this.lastRemote = 0;
    this.localId = isRemote ? this.net.localId : 0;
    const countdown = mode === 'sandbox' || isRemote ? 0 : 3;
    if (!isRemote) {
      this.game = new Game({ players, mode, localId: 0, settings: this.settings, onEvent: e => this.gameEvent(e), killsToWin: 5, map });
      this.game.paused = countdown > 0;
      this.game.countdown = countdown;
    }
    this.lastPlayers = players;
    this.go(new MatchScene(this, { mode, online: mode === 'online', countdown }), { instant });
  }

  disposeGame() {
    if (this.game) { this.game.dispose(); this.game = null; }
  }

  leaveMatch({ keepRoom = false, toMenu = true } = {}) {
    this.disposeGame();
    this.remote = null;
    this.renderer.resetMatch();
    if (!keepRoom) this.net.close();
    if (toMenu) this.go(new MenuScene(this));
  }

  gameEvent(e) {
    if (e.type === 'sound') this.sound.play(e.name, e.x);
    else if (e.type === 'kill') this.hud.kill(e);
  }

  ensureAttract() {
    if (this.attract && this.attractAge < 90) return this.attract;
    this.attract?.dispose();
    const types = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 4);
    this.attract = new Game({ mode: 'attract', settings: { ...this.settings }, players: types.map((type, id) => ({ id, type, bot: true, name: FIGHTERS[type].name })) });
    this.attractAge = 0;
    this.renderer.resetMatch();
    return this.attract;
  }

  state() {
    if (this.game) return this.game;
    if (this.remote) return this.interpolateRemote();
    return null;
  }

  interpolateRemote() {
    const remote = this.remote, prev = this.remotePrev;
    if (!prev) return remote;
    const t = clamp((performance.now() - this.lastRemote) / 50, 0, 1);
    const out = { ...remote, time: prev.time + (remote.time - prev.time) * t };
    for (const key of ['actors', 'props', 'limbs', 'bullets']) {
      const old = new Map(prev[key].map(a => [a.id, a]));
      out[key] = remote[key].map(a => {
        const b = old.get(a.id);
        // Teleports are instant, never a slide: Lola's skips (counted in skips) and long jumps.
        if (!b || Math.hypot(a.x - b.x, a.y - b.y) > 180 || a.skips !== b.skips) return a;
        const lerpA = (x, y) => x + Math.atan2(Math.sin(y - x), Math.cos(y - x)) * t;
        const out = { ...a, x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t, angle: Number.isFinite(a.angle) && Number.isFinite(b.angle) ? lerpA(b.angle, a.angle) : a.angle };
        // DARK NOX's flying scythe: its spin is sent unwrapped, so it turns the right way between snapshots.
        const f = a.fam, h = b.fam;
        if (f && h && Math.hypot(f.x - h.x, f.y - h.y) < 120) out.fam = { ...f, x: h.x + (f.x - h.x) * t, y: h.y + (f.y - h.y) * t, ang: h.ang + (f.ang - h.ang) * t };
        // The Cat King's court: each familiar slides between snapshots (a blink is a jump, not a slide).
        if (a.court && b.court) out.court = a.court.map((c, i) => { const d = b.court[i]; return d && d.st === c.st && Math.hypot(c.x - d.x, c.y - d.y) < 60 ? { ...c, x: d.x + (c.x - d.x) * t, y: d.y + (c.y - d.y) * t } : c; });
        return out;
      });
    }
    // The cut-in and the stopped world are timed by the time stop's own clock: smooth it too.
    if (remote.timeStop && prev.timeStop && remote.timeStop.owner === prev.timeStop.owner) out.timeStop = { ...remote.timeStop, t: prev.timeStop.t + (remote.timeStop.t - prev.timeStop.t) * t };
    if (remote.hazards && prev.hazards) {
      out.hazards = { ...remote.hazards, lamps: remote.hazards.lamps.map((l, i) => { const p = prev.hazards.lamps[i]; return p ? { ...l, x: p.x + (l.x - p.x) * t, y: p.y + (l.y - p.y) * t } : l; }) };
    }
    return out;
  }

  // ---- network --------------------------------------------------------------------------
  networkEvent(e) {
    const scene = this.scene;
    if (e.type === 'status' || e.type === 'error') { scene.status = e.message; if (!(scene instanceof OnlineScene)) this.toast(e.message); }
    else if (e.type === 'lobby') { if (!this.playing) { if (this.base instanceof LobbyScene) this.base.refresh?.(); else this.go(new LobbyScene(this)); } }
    else if (e.type === 'input') this.game?.inputFor(e.id, e.input);
    else if (e.type === 'start') { this.mode = 'online'; this.startMatch(e.players, { mode: 'online', isRemote: true, map: e.map }); }
    else if (e.type === 'state') {
      this.lastRemote = performance.now();
      this.remotePrev = this.remote;
      this.remote = e.state;
      for (const ev of e.state.events || []) {
        if (ev.id <= this.lastEvent) continue;
        this.lastEvent = Math.max(this.lastEvent, ev.id);
        if (ev.type === 'sound') this.sound.play(ev.name, ev.x);
        else if (ev.type === 'kill') this.hud.kill(ev);
      }
    } else if (e.type === 'left') {
      const a = this.game?.actor(e.id);
      if (a) { a.bot = true; a.input = EMPTY_INPUT(); this.toast(a.name + ' saiu. Um bot assumiu.'); }
    } else if (e.type === 'disconnected') { this.leaveMatch({ keepRoom: false }); this.toast(e.message); }
    else if (e.type === 'end') { this.disposeGame(); this.remote = null; this.go(new LobbyScene(this)); this.toast(e.message); }
    else if (e.type === 'latency') this.latency = e.ms;
  }

  // ---- loop -----------------------------------------------------------------------------
  simulate(now, hiddenTick = false) {
    const dt = Math.min(0.1, (now - (this.simLast ?? now)) / 1000);
    this.simLast = now;
    if (this.base instanceof MatchScene) this.base.tickCountdown(dt);
    if (this.game) {
      if (!this.game.paused) {
        this.acc = Math.min(this.acc + dt, 0.15);
        while (this.acc >= STEP) { this.game.step(STEP); this.acc -= STEP; }
      }
      this.netTick += dt;
      if (this.net.host && this.net.started && this.netTick >= 1 / 20) { this.net.sendState(this.game.snapshot()); this.net.clearStaleInputs(); this.netTick = 0; }
    }
    if (hiddenTick) return;
    this.pingTick += dt;
    if (this.pingTick > 2) { this.net.ping(); this.pingTick = 0; if (!this.game && this.remote && performance.now() - this.lastRemote > 5000) this.toast('Conexão lenta. Aguardando o anfitrião…'); }
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0);
    this.last = now;
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    if (this.resizeFlag) { this.renderer.resize(); this.resizeFlag = false; }
    this.input.gameplayTouch = this.playing && this.stack.length === 1;
    this.input.update(dt);
    if (this.input.anyPressed) this.enableAudio();
    const t0 = performance.now();
    try {
      this.scene.update?.(dt);
      this.simulate(now);
      // Scenes draw the interface into the UI layer; the world goes through the camera.
      const g = this.renderer.ug;
      g.clearRect(0, 0, VIEW_W, VIEW_H);
      for (const s of this.stack) s.draw?.(g, dt);
      this.drawOverlay(g, dt);
      this.renderer.present();
    } catch (err) {
      console.error(err);
      this.errorCount = (this.errorCount || 0) + 1;
    }
    this.frameMs = this.frameMs * 0.95 + (performance.now() - t0) * 0.05;
    this.input.endFrame();
    requestAnimationFrame(t => this.frame(t));
  }

  drawOverlay(g, dt) {
    let y = 40;
    for (const t of this.toasts) {
      t.life -= dt;
      const w = measure(t.text) + 14;
      g.globalAlpha = clamp(t.life * 2, 0, 1);
      panel(g, Math.round(VIEW_W / 2 - w / 2), y, w, 15, { fill: '#f4ead2', edge: '#c9b99a', light: '#ffffff' });
      drawText(g, t.text, VIEW_W / 2, y + 3, { color: '#1a1020', align: 'center' });
      g.globalAlpha = 1;
      y += 18;
    }
    this.toasts = this.toasts.filter(t => t.life > 0);
    if (this.settings.fps) drawText(g, `${this.fps} FPS · ${this.frameMs.toFixed(1)}MS`, 4, VIEW_H - 12, { color: '#9af6ff', outline: '#0b0812' });
    // Drop the heaviest effects by itself when the machine can't hold the frame rate.
    if (this.playing && this.settings.particles && !this.renderer.autoLow) {
      this.slowT = this.fps < 45 ? (this.slowT || 0) + dt : 0;
      if (this.slowT > 4) { this.renderer.autoLow = true; this.toast('Efeitos leves ativados para manter a fluidez.'); }
    }
    if (matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth * 1.05) {
      g.fillStyle = 'rgba(5,3,10,0.94)';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      const t = performance.now() / 1000, a = Math.sin(t * 2) * 0.6;
      g.save(); g.translate(VIEW_W / 2, 150); g.rotate(a > 0 ? Math.min(a, Math.PI / 2) : 0);
      g.fillStyle = '#f68268'; g.fillRect(-16, -28, 32, 56); g.fillStyle = '#120d1e'; g.fillRect(-13, -24, 26, 46);
      g.restore();
      drawText(g, 'GIRE O APARELHO', VIEW_W / 2, 200, { color: '#fff1d6', scale: 2, align: 'center' });
      drawText(g, 'A ARENA É MAIS LARGA QUE ALTA.', VIEW_W / 2, 226, { color: '#8a7f9c', align: 'center' });
    }
    if (this.fadeDir) {
      this.fade = clamp(this.fade + this.fadeDir * dt * 6, 0, 1);
      if (this.fade >= 1 && this.pending) { this.swap(this.pending); this.pending = null; this.fadeDir = -1; }
      if (this.fade <= 0 && this.fadeDir < 0) this.fadeDir = 0;
    }
    dissolve(g, this.fade);
  }
}
