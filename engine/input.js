import { VIEW_W, VIEW_H, S } from './const.js';

export const EMPTY_INPUT = () => ({ left: false, right: false, jump: false, down: false, attack: false, power: false, grab: false, dodge: false, drop: false, detonate: false, bats: false, aimX: null, aimY: null });

const NAV_KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', KeyJ: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', KeyP: 'pause'
};
const PAD_NAV = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'ok', 1: 'back', 9: 'pause', 8: 'back' };
const REPEATABLE = new Set(['up', 'down', 'left', 'right']);

// Touch buttons are laid out in view pixels and drawn by the HUD.
export const TOUCH_BUTTONS = [
  { id: 'jump', label: 'PULO', x: 600, y: 318, r: 21 },
  { id: 'attack', label: 'ATK', x: 556, y: 296, r: 17 },
  { id: 'power', label: 'PODER', x: 560, y: 254, r: 15 },
  { id: 'grab', label: 'PEGAR', x: 604, y: 268, r: 14 },
  { id: 'dodge', label: 'ROLAR', x: 514, y: 326, r: 14 },
  { id: 'bats', label: 'MORC', x: 516, y: 286, r: 12 }
];

export class Input {
  constructor(canvas, textInput) {
    this.canvas = canvas;
    this.textInput = textInput;
    this.keys = new Set();
    this.latched = new Set();
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, buttons: new Set(), inside: false, moved: false, wheel: 0 };
    this.clicks = [];
    this.navHeld = new Map();
    this.navPressed = new Set();
    this.rawPressed = new Set();
    this.pad = { connected: false, buttons: [], axes: [0, 0, 0, 0], prev: [] };
    this.touches = new Map();
    this.touchMode = false;
    this.textZones = [];
    this.stick = null;
    this.textTarget = null;
    this.anyPressed = false;
    this.lastDevice = 'keyboard';
    this.screenToView = (x, y) => ({ x, y });
    this.viewToWorld = (x, y) => ({ x: x / S, y: y / S });
    this.bind();
  }

  bind() {
    const typing = () => !!this.textTarget;
    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^F\d+$/.test(e.code) && e.code !== 'F11') return;
      this.lastDevice = 'keyboard';
      this.anyPressed = true;
      if (typing()) {
        if (e.code === 'Backspace') this.textTarget.onBackspace?.();
        else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.textTarget.onEnter?.();
        else if (e.code === 'Escape') this.textTarget.onEscape?.();
        else if (e.key.length === 1 && document.activeElement !== this.textInput) this.textTarget.onChar?.(e.key);
        if (document.activeElement !== this.textInput) e.preventDefault();
        if (['Escape', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) this.pushNav(NAV_KEYS[e.code] || (e.code === 'Tab' ? 'down' : null), e.repeat);
        return;
      }
      e.preventDefault();
      if (!e.repeat) { this.rawPressed.add(e.code); this.latched.add(e.code); }
      this.keys.add(e.code);
      if (NAV_KEYS[e.code]) this.pushNav(NAV_KEYS[e.code], e.repeat);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });

    const c = this.canvas;
    const pos = e => this.screenToView(e.clientX, e.clientY);
    c.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return this.touchMove(e);
      const p = pos(e);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true; this.mouse.moved = true;
      this.lastDevice = 'mouse';
    });
    c.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') this.mouse.inside = false; });
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      c.focus();
      try { c.setPointerCapture(e.pointerId); } catch {}
      this.anyPressed = true;
      if (e.pointerType === 'touch') return this.touchStart(e);
      const p = pos(e);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true;
      if (e.button === 1) e.preventDefault();
      this.mouse.buttons.add(e.button);
      this.latched.add('Mouse' + e.button);
      this.clicks.push({ x: p.x, y: p.y, button: e.button, down: true });
      this.lastDevice = 'mouse';
    });
    c.addEventListener('pointerup', e => {
      if (e.pointerType === 'touch') return this.touchEnd(e);
      const p = pos(e);
      this.mouse.buttons.delete(e.button);
      this.clicks.push({ x: p.x, y: p.y, button: e.button, down: false });
    });
    c.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') this.touchEnd(e); else this.mouse.buttons.clear(); });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    addEventListener('gamepadconnected', () => { this.pad.connected = true; });
    this.textInput.addEventListener('input', () => this.textTarget?.onValue?.(this.textInput.value));
    this.textInput.addEventListener('keydown', e => { if (e.code === 'Enter') { this.textTarget?.onEnter?.(); e.preventDefault(); } });
  }

  pushNav(action, repeat = false) {
    if (!action || repeat) return;
    this.navPressed.add(action);
    if (REPEATABLE.has(action)) this.navHeld.set(action, { t: 0, next: 0.34 });
  }

  touchStart(e) {
    this.touchMode = true;
    this.lastDevice = 'touch';
    const p = this.screenToView(e.clientX, e.clientY);
    const t = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, role: 'ui' };
    if (this.gameplayTouch) {
      const button = TOUCH_BUTTONS.find(b => Math.hypot(b.x - p.x, b.y - p.y) < b.r + 6);
      if (button) t.role = 'button:' + button.id;
      else if (p.x < VIEW_W * 0.45) { t.role = 'stick'; this.stick = t; }
      else t.role = 'aim';
    }
    if (t.role === 'ui') this.clicks.push({ x: p.x, y: p.y, button: 0, down: true, touch: true });
    this.touches.set(e.pointerId, t);
  }
  touchMove(e) {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    const p = this.screenToView(e.clientX, e.clientY);
    t.x = p.x; t.y = p.y;
    if (t.role === 'ui') { this.mouse.x = p.x; this.mouse.y = p.y; }
  }
  touchEnd(e) {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    if (t.role === 'ui') {
      this.clicks.push({ x: t.x, y: t.y, button: 0, down: false, touch: true });
      // Phones only open the keyboard for a focus made inside the tap itself, not on the next frame.
      if (this.textZones.some(r => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h)) this.textInput.focus();
    }
    if (this.stick === t) this.stick = null;
    this.touches.delete(e.pointerId);
  }

  clear() {
    this.keys.clear();
    this.mouse.buttons.clear();
    this.navHeld.clear();
    this.touches.clear();
    this.stick = null;
  }

  // Called once per rendered frame before scenes read edges.
  update(dt) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const gp = pads[0];
    if (gp) {
      this.pad.connected = true;
      const buttons = gp.buttons.map(b => b.pressed || b.value > 0.5);
      const axes = [...gp.axes];
      const dead = v => (Math.abs(v) < 0.28 ? 0 : v);
      const stickNav = { up: dead(axes[1]) < -0.5, down: dead(axes[1]) > 0.5, left: dead(axes[0]) < -0.5, right: dead(axes[0]) > 0.5 };
      for (const [i, action] of Object.entries(PAD_NAV)) if (buttons[i] && !this.pad.prev[i]) { this.pushNav(action); this.anyPressed = true; this.lastDevice = 'pad'; }
      for (const [action, on] of Object.entries(stickNav)) {
        const key = 'stick-' + action;
        if (on && !this.pad.prev[key]) { this.pushNav(action); this.lastDevice = 'pad'; }
        if (!on && this.navHeld.get(action)?.source === 'stick') this.navHeld.delete(action);
        buttons[key] = on;
      }
      if (buttons.some(Boolean) || axes.some(a => Math.abs(a) > 0.5)) this.lastDevice = 'pad';
      this.pad.prev = buttons;
      this.pad.buttons = buttons;
      this.pad.axes = axes.map(dead);
    } else this.pad.buttons = [];

    for (const [action, h] of this.navHeld) {
      const held = this.navActionHeld(action);
      if (!held) { this.navHeld.delete(action); continue; }
      h.t += dt;
      if (h.t >= h.next) { this.navPressed.add(action); h.next += 0.085; }
    }
  }

  navActionHeld(action) {
    for (const [code, a] of Object.entries(NAV_KEYS)) if (a === action && this.keys.has(code)) return true;
    for (const [i, a] of Object.entries(PAD_NAV)) if (a === action && this.pad.buttons[i]) return true;
    return !!this.pad.buttons['stick-' + action];
  }

  // UI edges consumed by the active scene.
  nav(action) { return this.navPressed.has(action); }
  pressed(code) { return this.rawPressed.has(code); }
  endFrame() {
    this.navPressed.clear();
    this.rawPressed.clear();
    this.latched.clear();
    this.clicks.length = 0;
    this.mouse.moved = false;
    this.mouse.wheel = 0;
    this.anyPressed = false;
  }

  // Gameplay input for the local player, in world units for aim.
  gameInput() {
    // Taps shorter than a frame still count: latched keys stay down until the frame ends.
    const k = { has: c => this.keys.has(c) || this.latched.has(c) };
    const mb = { has: n => this.mouse.buttons.has(n) || this.latched.has('Mouse' + n) };
    const b = this.pad.buttons, ax = this.pad.axes;
    const input = EMPTY_INPUT();
    input.left = k.has('KeyA') || k.has('ArrowLeft') || !!b[14] || ax[0] < -0.35;
    input.right = k.has('KeyD') || k.has('ArrowRight') || !!b[15] || ax[0] > 0.35;
    input.jump = k.has('KeyW') || k.has('ArrowUp') || k.has('Space') || !!b[0];
    input.down = k.has('KeyS') || k.has('ArrowDown') || !!b[13] || ax[1] > 0.55;
    input.attack = k.has('KeyJ') || mb.has(0) || !!b[2] || !!b[7];
    input.power = k.has('KeyK') || mb.has(2) || !!b[3];
    input.grab = k.has('KeyE') || mb.has(1) || !!b[1];
    input.drop = k.has('KeyR') || !!b[5];
    input.detonate = k.has('KeyQ') || !!b[6];
    input.dodge = k.has('ShiftLeft') || k.has('ShiftRight') || !!b[4];
    input.bats = k.has('KeyL') || !!b[11];
    if (this.touchMode) {
      for (const t of this.touches.values()) {
        if (t.role.startsWith('button:')) input[t.role.slice(7)] = true;
      }
      if (this.stick) {
        const dx = this.stick.x - this.stick.sx, dy = this.stick.y - this.stick.sy;
        if (dx < -8) input.left = true;
        if (dx > 8) input.right = true;
        if (dy > 16) input.down = true;
        if (dy < -22) input.jump = true;
      }
      const aim = [...this.touches.values()].find(t => t.role === 'aim');
      if (aim) { const w = this.viewToWorld(aim.x, aim.y); input.aimX = w.x; input.aimY = w.y; input.attack = true; }
    } else if (this.lastDevice === 'mouse' && this.mouse.inside) {
      const w = this.viewToWorld(this.mouse.x, this.mouse.y);
      input.aimX = w.x;
      input.aimY = w.y;
    }
    input.padAim = Math.hypot(ax[2] || 0, ax[3] || 0) > 0.3 ? Math.atan2(ax[3], ax[2]) : null;
    return input;
  }

  focusText(target, value = '') {
    this.textTarget = target;
    if (this.touchMode) {
      this.textInput.value = value;
      this.textInput.maxLength = target?.maxLength || 18;
      this.textInput.focus();
    }
  }
  blurText() {
    this.textTarget = null;
    this.textInput.blur();
    this.canvas.focus();
  }
}
