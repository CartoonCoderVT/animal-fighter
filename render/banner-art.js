// The Cat King's royal banner, shared by the select screen's throne room (king-hero.js), the banner he
// plants in the arena and his house and castle (kingdom-art.js), and the one he carries (king-art.js).
//   bannerCanvas(torn)                                the cloth, 11 x 34 cells, cached; torn 0 whole,
//                                                     1 a ragged foot, 2 ragged and holed
//   drawBanner(g, x, y, s, unroll, t, seed, torn)     hung from (x, y) at s px per cell, unrolled 0..1,
//                                                     swaying with t (seconds) and seed
//   drawBannerTint(g, x, y, s, t, seed, color, torn)  the same cloth as one flat colour (for a glow or a
//                                                     flash), swaying in step with drawBanner
//   drawPennant(g, x, y, t, seed, { len, color, torn, dir })
//                                                     a small swallowtail pennant flying from a pole at
//                                                     (x, y) (its top corner), crimson with a gold edge
//                                                     and a stripe of color along it, rippling with t
const cache = new Map();
function cached(key, w, h, paint) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    cache.set(key, c);
  }
  return c;
}
// A royal banner: a gold rod with finials, crimson cloth with a gold border, the crest (a crown over
// a fleur) and a swallowtail.
export const BANNER_W = 11, BANNER_H = 34;
export function bannerCanvas(torn = 0) {
  return cached('banner' + torn, BANNER_W, BANNER_H, (g, w, h) => {
    const P = { o: '#1c0a14', Y: '#fff2a8', G: '#f8c84a', g: '#cc8a2a', d: '#86501e', 1: '#5c0c22', 2: '#941a30', 3: '#c42e3e', 4: '#e05050' };
    const put = (c, x, y) => { g.fillStyle = P[c]; g.fillRect(x, y, 1, 1); };
    // The rod.
    for (let x = 0; x < w; x++) put(x === 0 || x === w - 1 ? 'Y' : x % 2 ? 'G' : 'g', x, 0);
    for (let x = 0; x < w; x++) put('o', x, 1);
    put('Y', 0, 1); put('Y', w - 1, 1);
    const crest = [
      '..G.G.G..',
      '..GGGGG..',
      '..gGGGg..',
      '.........',
      '....Y....',
      '...GGG...',
      '..G.G.G..',
      '....g....'
    ];
    // Torn: the foot ragged (how far up each column the cloth is gone) and, worse, a few holes.
    const rag = [0, 2, 4, 1, 3, 0, 2, 5, 1, 3, 0].map(v => (torn ? v * torn : 0));
    const holes = torn >= 2 ? [[3, 20], [7, 26], [6, 14], [4, 27]] : [];
    for (let y = 2; y < h; y++) {
      const tail = h - y, notch = tail <= 5 ? 5 - tail : -1; // swallowtail: a notch cut up the middle
      for (let x = 1; x < w - 1; x++) {
        const mid = Math.abs(x - (w - 1) / 2);
        if (notch >= 0 && mid <= notch * 0.8) continue;
        if (tail <= rag[x]) continue;
        if (holes.some(([hx, hy]) => Math.abs(x - hx) + Math.abs(y - hy) <= (x === hx ? 1 : 0))) continue;
        const frayed = tail === rag[x] + 1 && rag[x] > 0;
        const edge = x === 1 || x === w - 2 || y === 2 || (notch >= 0 && mid <= notch * 0.8 + 1) || frayed;
        let c = edge ? (x === 1 || y === 2 ? 'G' : frayed ? '1' : 'g') : x < 3 ? '4' : x > w - 4 ? '2' : '3';
        if (!edge && (x + y) % 5 === 0 && x > 2 && x < w - 3) c = '2';
        const cy = y - 9, cx = x - 1;
        if (cy >= 0 && cy < crest.length && crest[cy][cx] && crest[cy][cx] !== '.') c = crest[cy][cx];
        put(c, x, y);
      }
    }
  });
}
function tinted(torn, color) {
  return cached('tint' + torn + color, BANNER_W, BANNER_H, g => {
    g.drawImage(bannerCanvas(torn), 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, BANNER_W, BANNER_H);
  });
}
function drawCloth(g, c, x, y, s, unroll, t, seed) {
  const rows = Math.round(BANNER_H * unroll);
  for (let r = 0; r < rows; r++) {
    // The cloth sways more toward its foot; while it unrolls the foot flaps.
    const depth = r / BANNER_H, flap = unroll < 1 && r > rows - 4 ? Math.sin(t * 30 + r) * 1 : 0;
    const dx = Math.round(Math.sin(t * 1.7 + seed + r * 0.18) * depth * 1.4 + flap);
    g.drawImage(c, 0, r, BANNER_W, 1, x + (dx - Math.floor(BANNER_W / 2)) * s, y + r * s, BANNER_W * s, s);
  }
  return rows;
}
export function drawBanner(g, x, y, s, unroll, t, seed, torn = 0) {
  const rows = drawCloth(g, bannerCanvas(torn), x, y, s, unroll, t, seed);
  // The roll still wound at its foot.
  if (unroll < 1 && rows > 1) {
    g.fillStyle = '#5c0c22'; g.fillRect(x - 4 * s, y + rows * s, 9 * s, 2 * s);
    g.fillStyle = '#f8c84a'; g.fillRect(x - 5 * s, y + rows * s, s, 2 * s); g.fillRect(x + 5 * s, y + rows * s, s, 2 * s);
  }
}
export function drawBannerTint(g, x, y, s, t, seed, color, torn = 0) {
  drawCloth(g, tinted(torn, color), x, y, s, 1, t, seed);
}

// A pennant: `len` cells long, 5 tall, its hoist on the pole at (x, y) (top), flying toward dir.
export function drawPennant(g, x, y, t, seed, { len = 8, color = '#5aaaff', torn = 0, dir = 1, s = 1 } = {}) {
  const L = Math.max(3, len - (torn ? 2 * torn : 0));
  for (let i = 0; i < L; i++) {
    const u = i / Math.max(1, len - 1);
    // A ripple running out along it, stronger toward the fly end.
    const dy = Math.round(Math.sin(t * 6 + seed - i * 0.7) * u * 1.2);
    const fork = i >= L - 2 && !torn;
    for (let j = 0; j < 5; j++) {
      if (fork && j === 2) continue;                                // the swallowtail
      if (i > L - 3 && (j === 0 || j === 4) && i === L - 1) continue;
      const c = j === 0 ? '#f8c84a' : j === 4 ? '#86501e' : j === 2 ? color : i === 0 ? '#5c0c22' : j === 1 ? '#c42e3e' : '#941a30';
      g.fillStyle = c;
      g.fillRect(x + dir * (i + 1) * s - (dir < 0 ? s - 1 : 0), y + (j + dy) * s, s, s);
    }
  }
}
