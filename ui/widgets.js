// Pixel UI widgets drawn on the 640x360 grid, driven by keyboard, gamepad, mouse and touch.
import { VIEW_W, VIEW_H, bayer, clamp } from '../engine/const.js';
import { drawText, measure, wrap } from '../engine/font.js';
import { panel } from '../render/hud.js';

export { panel };
const inside = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export class Menu {
  constructor(items, { x = 40, y = 120, w = 170, h = 17, align = 'left', scale = 1 } = {}) {
    this.items = items; this.x = x; this.y = y; this.w = w; this.h = h; this.align = align; this.scale = scale;
    this.index = items.findIndex(i => !i.disabled);
    this.pulse = 0;
  }
  rect(i) { return { x: this.x, y: this.y + i * this.h, w: this.w, h: this.h - 2 }; }
  // Returns the activated item, if any.
  update(input, dt, sound) {
    this.pulse += dt;
    const move = d => {
      let i = this.index;
      for (let n = 0; n < this.items.length; n++) { i = (i + d + this.items.length) % this.items.length; if (!this.items[i].disabled) break; }
      if (i !== this.index) { this.index = i; sound?.play('ui_move'); }
    };
    if (input.nav('up')) move(-1);
    if (input.nav('down')) move(1);
    const item = this.items[this.index];
    if (item?.left && input.nav('left')) { item.left(); sound?.play('ui_move'); }
    if (item?.right && input.nav('right')) { item.right(); sound?.play('ui_move'); }
    if (input.mouse.moved) this.items.forEach((it, i) => { if (!it.disabled && inside(input.mouse, this.rect(i)) && this.index !== i) { this.index = i; sound?.play('ui_move'); } });
    for (const c of input.clicks) if (!c.down) this.items.forEach((it, i) => {
      if (it.disabled || !inside(c, this.rect(i))) return;
      this.index = i;
      if (it.right && c.x > this.x + this.w * 0.55) it.right();
      else if (it.left && c.x < this.x + this.w * 0.55 && it.kind === 'choice') it.left();
      this.clicked = it;
    });
    if (this.clicked) { const it = this.clicked; this.clicked = null; if (it.action) { sound?.play('ui_ok'); return it; } }
    if (input.nav('ok') && item && !item.disabled && item.action) { sound?.play('ui_ok'); return item; }
    return null;
  }
  draw(g) {
    this.items.forEach((it, i) => {
      const r = this.rect(i), sel = i === this.index;
      if (sel) {
        g.fillStyle = '#2a1d3dd9'; g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle = it.color || '#f68268'; g.fillRect(r.x, r.y, 2, r.h);
        const bob = Math.floor(this.pulse * 6) % 2;
        drawText(g, '▶', r.x + 5 + bob, r.y + 3, { color: it.color || '#f68268' });
      }
      const color = it.disabled ? '#5a4e68' : sel ? '#fff1d6' : '#b9aecb';
      drawText(g, it.label, r.x + 16, r.y + 3, { color, scale: this.scale, shadow: '#0b0812' });
      if (it.value !== undefined) {
        const v = typeof it.value === 'function' ? it.value() : it.value;
        drawText(g, (it.left ? '◀ ' : '') + v + (it.right ? ' ▶' : ''), r.x + r.w - 6, r.y + 3, { color: sel ? '#f2c35b' : '#9a8cb0', align: 'right', shadow: '#0b0812' });
      }
    });
    const it = this.items[this.index];
    if (it?.hint) {
      const lines = wrap(it.hint, this.w);
      lines.forEach((l, k) => drawText(g, l, this.x, this.y + this.items.length * this.h + 6 + k * 11, { color: '#8a7f9c' }));
    }
  }
}

export class TextField {
  constructor({ label, value = '', maxLength = 18, filter = null, upper = true }) {
    this.label = label; this.value = value; this.maxLength = maxLength; this.filter = filter; this.upper = upper; this.focused = false; this.t = 0;
  }
  target() {
    return {
      maxLength: this.maxLength,
      onChar: ch => { if (this.filter && !this.filter.test(ch)) return; if (this.value.length < this.maxLength) this.value += this.upper ? ch.toUpperCase() : ch; },
      onBackspace: () => { this.value = this.value.slice(0, -1); },
      onValue: v => { this.value = (this.upper ? v.toUpperCase() : v).split('').filter(c => !this.filter || this.filter.test(c)).join('').slice(0, this.maxLength); },
      onEnter: () => { this.onEnter?.(); },
      onEscape: () => { this.onEscape?.(); }
    };
  }
  draw(g, x, y, w, dt) {
    this.t += dt;
    drawText(g, this.label, x, y, { color: '#8a7f9c' });
    panel(g, x, y + 12, w, 18, { fill: this.focused ? '#1d1430' : '#120d1e', edge: this.focused ? '#f68268' : '#3b3052' });
    drawText(g, this.value + (this.focused && Math.floor(this.t * 2.5) % 2 ? '_' : ''), x + 6, y + 17, { color: '#fff1d6' });
  }
}

export function button(g, r, label, { hot = false, color = '#f68268', scale = 1, disabled = false } = {}) {
  panel(g, r.x, r.y, r.w, r.h, { fill: disabled ? '#140f1e' : hot ? color : '#1d1430', edge: hot ? '#ffd9c8' : '#4a3a68', light: hot ? '#ffd9c8' : '#5a4a78' });
  drawText(g, label, r.x + r.w / 2, r.y + Math.round((r.h - 10 * scale) / 2), { color: disabled ? '#5a4e68' : hot ? '#1a1020' : '#f0e4d0', scale, align: 'center' });
}
export const hit = (input, r) => input.clicks.some(c => !c.down && inside(c, r));
export const hover = (input, r) => inside(input.mouse, r);

// Ordered-dither dissolve between scenes.
export function dissolve(g, k, color = '#05030a') {
  if (k <= 0) return;
  g.fillStyle = color;
  if (k >= 1) { g.fillRect(0, 0, VIEW_W, VIEW_H); return; }
  const cell = 4;
  for (let y = 0; y < VIEW_H; y += cell) for (let x = 0; x < VIEW_W; x += cell) if (bayer(x / cell, y / cell) < k) g.fillRect(x, y, cell, cell);
}

export function title(g, text, x, y, { color = '#fff1d6', accent = '#f68268', scale = 3, align = 'left' } = {}) {
  drawText(g, text, x, y, { color, scale, outline: '#0b0812', shadow: accent, align });
}

export function paragraph(g, text, x, y, w, color = '#b9aecb', lineH = 11) {
  const lines = wrap(text, w);
  lines.forEach((l, i) => drawText(g, l, x, y + i * lineH, { color }));
  return lines.length * lineH;
}

export function keycap(g, label, x, y) {
  const w = Math.max(11, measure(label) + 6);
  g.fillStyle = '#0b0812'; g.fillRect(x, y, w, 13);
  g.fillStyle = '#3b3052'; g.fillRect(x, y, w, 11);
  g.fillStyle = '#5a4a78'; g.fillRect(x, y, w, 1);
  drawText(g, label, x + w / 2, y + 1, { color: '#f0e4d0', align: 'center' });
  return w;
}
export { clamp };
