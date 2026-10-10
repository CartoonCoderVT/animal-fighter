// The Cat King's royal banner, shared by the select screen's throne room (king-hero.js), the banner he
// plants in the arena and his house and castle (kingdom-art.js), and the one he carries (king-art.js).
//   bannerCanvas()                              the cloth, 11 x 34 cells, cached
//   drawBanner(g, x, y, s, unroll, t, seed)     hung from (x, y) at s px per cell, unrolled 0..1,
//                                              swaying with t (seconds) and seed
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
export function bannerCanvas() {
  return cached('banner', BANNER_W, BANNER_H, (g, w, h) => {
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
    for (let y = 2; y < h; y++) {
      const tail = h - y, notch = tail <= 5 ? 5 - tail : -1; // swallowtail: a notch cut up the middle
      for (let x = 1; x < w - 1; x++) {
        const mid = Math.abs(x - (w - 1) / 2);
        if (notch >= 0 && mid <= notch * 0.8) continue;
        const edge = x === 1 || x === w - 2 || y === 2 || (notch >= 0 && mid <= notch * 0.8 + 1);
        let c = edge ? (x === 1 || y === 2 ? 'G' : 'g') : x < 3 ? '4' : x > w - 4 ? '2' : '3';
        if (!edge && (x + y) % 5 === 0 && x > 2 && x < w - 3) c = '2';
        const cy = y - 9, cx = x - 1;
        if (cy >= 0 && cy < crest.length && crest[cy][cx] && crest[cy][cx] !== '.') c = crest[cy][cx];
        put(c, x, y);
      }
    }
  });
}
export function drawBanner(g, x, y, s, unroll, t, seed) {
  const c = bannerCanvas(), rows = Math.round(BANNER_H * unroll);
  for (let r = 0; r < rows; r++) {
    // The cloth sways more toward its foot; while it unrolls the foot flaps.
    const depth = r / BANNER_H, flap = unroll < 1 && r > rows - 4 ? Math.sin(t * 30 + r) * 1 : 0;
    const dx = Math.round(Math.sin(t * 1.7 + seed + r * 0.18) * depth * 1.4 + flap);
    g.drawImage(c, 0, r, BANNER_W, 1, x + (dx - Math.floor(BANNER_W / 2)) * s, y + r * s, BANNER_W * s, s);
  }
  // The roll still wound at its foot.
  if (unroll < 1 && rows > 1) {
    g.fillStyle = '#5c0c22'; g.fillRect(x - 4 * s, y + rows * s, 9 * s, 2 * s);
    g.fillStyle = '#f8c84a'; g.fillRect(x - 5 * s, y + rows * s, s, 2 * s); g.fillRect(x + 5 * s, y + rows * s, s, 2 * s);
  }
}

