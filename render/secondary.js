// Secondary motion for tails and scarf ends: short verlet chains in character space (pixels,
// facing right) that keep their drawn shape, wag, and lag behind the body's motion.
import { CAST, ANCHOR, TAILS, SCARF, BEAST, TITAN, castFor } from './pixel-data.js';
import { lookOf } from '../sim/fighters.js';
import { S } from '../engine/const.js';

// stiff: pull toward the drawn shape at the root (tip uses stiff * tip); grav: px/frame²;
// drag: how hard air pushes the chain back while moving; wag: [speed, degrees] idle sway.
const SPECS = {
  cat: [{ root: ANCHOR.tail, shape: TAILS.cat.shape, tube: TAILS.cat, stiff: 0.2, tip: 0.3, grav: 0.05, drag: 0.32, inertia: 0.7, wag: [2.1, 9] }],
  ocelot: [{ root: ANCHOR.tail, shape: TAILS.ocelot.shape, tube: TAILS.ocelot, stiff: 0.2, tip: 0.3, grav: 0.05, drag: 0.32, inertia: 0.7, wag: [1.5, 7] }],
  ocelotBeast: [{ root: BEAST.anchor.tail, shape: TAILS.ocelotBeast.shape, tube: TAILS.ocelotBeast, stiff: 0.28, tip: 0.3, grav: 0.06, drag: 0.3, inertia: 0.8, wag: [1.1, 9] }],
  ocelotTitan: [{ root: TITAN.anchor.tail, shape: TAILS.ocelotTitan.shape, tube: TAILS.ocelotTitan, stiff: 0.32, tip: 0.3, grav: 0.07, drag: 0.3, inertia: 0.85, wag: [0.9, 8] }],
  rat: [{ root: ANCHOR.tail, shape: TAILS.rat.shape, tube: TAILS.rat, stiff: 0.12, tip: 0.3, grav: 0.08, drag: 0.32, inertia: 0.9, wag: [1.4, 14] }],
  bat: SCARF.strands.map((shape, i) => ({ root: SCARF.root, shape, tube: SCARF, stiff: 0.05, tip: 0.2, grav: 0.12, drag: 0.85, inertia: 1, wag: [1.7 + i * 0.4, 6], flutter: 0.35 + i * 0.15 }))
};

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

class Chain {
  constructor(spec, root) {
    this.spec = spec;
    this.rest = spec.shape.map(([x, y]) => [x - spec.shape[0][0], y - spec.shape[0][1]]);
    this.len = this.rest.slice(1).map((p, i) => Math.hypot(p[0] - this.rest[i][0], p[1] - this.rest[i][1]));
    this.pts = this.rest.map(([x, y]) => ({ x: root[0] + x, y: root[1] + y, px: root[0] + x, py: root[1] + y }));
  }
  mirror() { for (const p of this.pts) { p.x = -p.x; p.px = -p.px; } }
  step(root, shape, angle, force, k, time, seed) {
    const { stiff, tip, grav, flutter = 0 } = this.spec, n = this.pts.length;
    const rest = shape ? shape.map(([x, y]) => [x - shape[0][0], y - shape[0][1]]) : this.rest;
    const speed = Math.hypot(force.vx, force.vy);
    for (let i = 1; i < n; i++) {
      const p = this.pts[i], t = i / (n - 1);
      let vx = (p.x - p.px) * 0.84, vy = (p.y - p.py) * 0.84;
      p.px = p.x; p.py = p.y;
      vx += (force.ax + force.wx * t) * k;
      vy += (grav * t + force.ay + force.wy * t) * k;
      if (flutter && speed > 0.4) {
        const f = Math.sin(time * 19 + i * 1.4 + seed) * flutter * Math.min(2, speed) * t;
        vx += f * 0.4 * k; vy += f * k;
      }
      p.x += vx; p.y += vy;
      const [rx, ry] = rot(rest[Math.min(i, rest.length - 1)][0], rest[Math.min(i, rest.length - 1)][1], angle);
      const s = stiff * (1 - t * (1 - tip)) * Math.min(1.5, k) * (shape ? 2.4 : 1);
      p.x += (root[0] + rx - p.x) * Math.min(1, s);
      p.y += (root[1] + ry - p.y) * Math.min(1, s);
    }
    const p0 = this.pts[0];
    p0.x = p0.px = root[0]; p0.y = p0.py = root[1];
    for (let it = 0; it < 2; it++) {
      for (let i = 1; i < n; i++) {
        const a = this.pts[i - 1], b = this.pts[i], L = this.len[i - 1] || 1;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, f = (d - L) / d;
        if (i === 1) { b.x -= dx * f; b.y -= dy * f; }
        else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; }
      }
      p0.x = root[0]; p0.y = root[1];
    }
    return this.pts.map(p => [p.x, p.y]);
  }
}

// The frog's borrowed tail or scarf moves like its owner's, hung from his own back.
const copied = new Map();
function specsOf(ch) {
  if (SPECS[ch.id]) return SPECS[ch.id];
  if (ch.copyOf == null || (!ch.scarf && (!ch.tail || ch.tail.blob))) return null;
  if (!copied.has(ch.id)) {
    const own = SPECS[CAST[ch.copyOf].id];
    copied.set(ch.id, own.map(s => ch.scarf ? { ...s, root: ch.scarf.root, tube: ch.scarf } : { ...s, root: ch.anchor.tail, shape: ch.tail.shape, tube: ch.tail }));
  }
  return copied.get(ch.id);
}

export class Secondary {
  constructor() { this.map = new Map(); }
  clear() { this.map.clear(); }

  // Returns [{ pts, spec }] for the actor's loose chains this frame, or null to draw them static.
  update(a, frame, time, dt) {
    const ch = castFor(a.type, lookOf(a)), id = ch.id, specs = specsOf(ch);
    if (!specs || frame.spin) { this.map.delete(a.id); return null; }
    let st = this.map.get(a.id);
    const [bdx = 0, bdy = 0] = frame.body || [];
    const rootOf = spec => [spec.root[0] + bdx, spec.root[1] + bdy];
    if (!st || st.id !== id) {
      st = { id, face: a.face || 1, vx: 0, vy: 0, chains: specs.map(s => new Chain(s, rootOf(s))), seed: (a.id || 0) * 2.3 };
      this.map.set(a.id, st);
    }
    if ((a.face || 1) !== st.face) { st.face = a.face || 1; for (const c of st.chains) c.mirror(); }
    const k = Math.min(2, dt * 60);
    // Body velocity in pixels per frame, facing-right space.
    const vx = (a.vx || 0) * S * st.face, vy = (a.vy || 0) * S;
    const ax = k > 0 ? (vx - st.vx) / k : 0, ay = k > 0 ? (vy - st.vy) / k : 0;
    st.vx = vx; st.vy = vy;
    const out = [];
    specs.forEach((spec, i) => {
      const chain = st.chains[i];
      if (k <= 0) { out.push({ pts: chain.pts.map(p => [p.x, p.y]), spec: spec.tube }); return; }
      const wag = (Math.sin(time * spec.wag[0] + st.seed + i) * spec.wag[1] + (frame.tailDeg || 0)) * Math.PI / 180;
      const force = {
        ax: -Math.max(-3, Math.min(3, ax)) * spec.inertia, ay: -Math.max(-3, Math.min(3, ay)) * spec.inertia,
        wx: -Math.max(-6, Math.min(6, vx)) * spec.drag * 0.12, wy: -Math.max(-6, Math.min(6, vy)) * spec.drag * 0.12, vx, vy
      };
      const shape = Array.isArray(frame.tail) && spec.tube !== SCARF ? frame.tail : null;
      out.push({ pts: chain.step(rootOf(spec), shape, wag, force, k, time, st.seed), spec: spec.tube });
    });
    return out;
  }
}
