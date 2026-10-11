// A guest's playback of the host's snapshots: a small jitter buffer on the host's clock. Snapshots are
// shown a little in the past (just enough to cover how late and how unevenly they arrive) so there is
// almost always a newer one to interpolate towards. Pure (no DOM): the shell feeds it and asks it once
// per frame which two snapshots to draw between; tests drive it with a made-up arrival schedule.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sorted = v => [...v].sort((a, b) => a - b);

export class Playout {
  constructor() { this.reset(); }

  reset() {
    this.snaps = [];        // { s, n, at } by n; at = host time (ms) the snapshot shows
    this.pending = [];      // events not yet shown, by id
    this.maxEvent = 0;      // the newest event id received (the guest's ack)
    this.offMax = null;     // best (least delayed) host-minus-local clock offset, ms
    this.offT = 0;
    this.ds = [];           // how much later than the best each recent snapshot arrived
    this.gaps = [];         // host time between consecutive snapshots
    this.recent = [];       // { n, t } of the last 3 s, for the loss rate
    this.interval = 1000 / 30;
    this.delay = this.interval + 5;
    this.loss = 0;
    this.playhead = null; this.last = 0;
    this.received = 0; this.lost = 0; this.starved = 0; this.frames = 0; this.firstN = null; this.topN = -1;
  }

  // Snapshot n of the host's state at host time `at`, received at local time `now` (ms).
  push(s, n, at, now) {
    const snaps = this.snaps;
    let i = snaps.length;
    while (i > 0 && snaps[i - 1].n > n) i--;
    if (snaps[i - 1]?.n === n) return;
    const prev = snaps[i - 1];
    snaps.splice(i, 0, { s, n, at });
    if (snaps.length > 90) snaps.shift();
    this.received++;
    this.firstN ??= n;
    this.topN = Math.max(this.topN, n);
    this.lost = Math.max(0, this.topN - this.firstN + 1 - this.received);
    // The clocks: the largest host-minus-local offset is the least delayed snapshot. It sinks 2 ms a
    // second so it follows a slower route or the clocks drifting apart.
    const o = at - now;
    this.offMax = this.offMax === null ? o : Math.max(o, this.offMax - (now - this.offT) * 0.002);
    this.offT = now;
    this.ds.push(this.offMax - o);
    if (this.ds.length > 90) this.ds.shift();
    if (prev && n - prev.n <= 3 && at > prev.at) { this.gaps.push((at - prev.at) / (n - prev.n)); if (this.gaps.length > 30) this.gaps.shift(); }
    if (this.gaps.length) { const g = sorted(this.gaps); this.interval = g[g.length >> 1]; }
    this.recent.push({ n, t: now });
    while (this.recent[0].t < now - 3000) this.recent.shift();
    let lo = Infinity, hi = -Infinity;
    for (const r of this.recent) { lo = Math.min(lo, r.n); hi = Math.max(hi, r.n); }
    this.loss = 1 - this.recent.length / (hi - lo + 1);
    // Late by up to the 90th percentile of the jitter, plus one more interval when snapshots go missing.
    const d = sorted(this.ds), p90 = d[Math.min(d.length - 1, Math.floor(d.length * 0.9))];
    this.delay = clamp(this.interval + p90 + 5 + (this.loss > 0.01 ? this.interval : 0), this.interval + 5, 400);
    for (const e of s.events || []) if (e.id > this.maxEvent) { this.pending.push(e); this.maxEvent = e.id; }
    if (this.pending.length > 1000) this.pending.splice(0, this.pending.length - 1000);
  }

  // Once per rendered frame: moves the playhead and says what to draw (a, or a to b at t) and which
  // events are due.
  advance(now) {
    const snaps = this.snaps, out = { a: null, b: null, t: 0, events: [] };
    if (!snaps.length) return out;
    const dt = this.playhead === null ? 0 : Math.max(0, now - this.last);
    this.last = now;
    const target = now + this.offMax - this.delay;
    let gap = dt > 250;
    if (this.playhead === null) this.playhead = target;
    else {
      // Normally it runs with the clock, nudged at most 2 ms a frame towards where it should be;
      // far off (a stall, a hidden tab) it jumps. It never goes back.
      const free = this.playhead + dt, err = target - free;
      if (Math.abs(err) > 250) { gap = true; this.playhead = Math.max(this.playhead, target); }
      else this.playhead = Math.max(this.playhead, free + clamp(err * 0.05, -2, 2));
    }
    const ph = this.playhead;
    // Whatever the picture has left far behind is not played late: a window that stopped drawing for a while
    // (hidden, stalled) comes back with the playhead seconds ahead in one frame, and then only what is due about
    // now plays, not the last 250 ms of a busy fight at once. The kill feed still gets its lines.
    const cut = ph - (gap ? this.interval : 250);
    if (this.pending.length && this.pending[0].hostAt < cut) this.pending = this.pending.filter(e => e.hostAt >= cut || e.type === 'kill');
    this.frames++;
    let i = snaps.length - 1;
    while (i >= 0 && snaps[i].at > ph) i--;
    if (i < 0) out.a = snaps[0];
    else if (i === snaps.length - 1) { out.a = snaps[i]; this.starved++; }
    else {
      out.a = snaps[i]; out.b = snaps[i + 1];
      const span = out.b.at - out.a.at;
      out.t = span > 0 ? clamp((ph - out.a.at) / span, 0, 1) : 1;
    }
    if (i > 1) snaps.splice(0, i - 1);
    // An event first went out with the snapshot after it happened: it is due one interval before that.
    let k = 0;
    while (k < this.pending.length && this.pending[k].hostAt <= ph + this.interval) k++;
    out.events = this.pending.splice(0, k);
    return out;
  }
}
