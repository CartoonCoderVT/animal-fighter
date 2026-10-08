// Master palette and hue-shifted ramps: shadows lean violet, highlights lean warm.
export const P = {
  ink: '#110d1b',
  night0: '#171326', night1: '#1f1931', night2: '#2a2140', night3: '#382c52', night4: '#4a3b68',
  sky0: '#15132e', sky1: '#24204a', sky2: '#3d2c62', sky3: '#6a3766', sky4: '#a74b62', sky5: '#e0745e', sky6: '#f7a46c',
  moon0: '#ffe9bf', moon1: '#ffd08f', moon2: '#eba26e', moon3: '#b9705a',
  metal0: '#1e1a2b', metal1: '#2b2640', metal2: '#3e3757', metal3: '#5a5276', metal4: '#837a9c', metal5: '#b4adc8',
  rust0: '#3b2028', rust1: '#5e2f30', rust2: '#8a4636', rust3: '#b56a45',
  conc0: '#1d1a28', conc1: '#2a2637', conc2: '#3a3449', conc3: '#4f475e', conc4: '#6a6078', conc5: '#8a7f95',
  wood0: '#3a2224', wood1: '#5e3830', wood2: '#87553c', wood3: '#b07b4f', wood4: '#d6a46c',
  hazard: '#e7b448', hazardLight: '#f7d672', hazardDark: '#9a6a2c',
  warm: '#ffd59a', warmHot: '#fff0c8',
  blood0: '#3e0e1c', blood1: '#6b1426', blood2: '#9c2233', blood3: '#c83a44', blood4: '#e8676a',
  flesh: '#d9707a', bone0: '#a8957c', bone1: '#d8c9a8', bone2: '#f2e8cf',
  fire0: '#fff6c4', fire1: '#ffd25c', fire2: '#ff9a35', fire3: '#e3532d', fire4: '#97302e', smoke: '#4a4152',
  ice0: '#f2fdff', ice1: '#bdeeff', ice2: '#7cc7f0', ice3: '#4a86c8', ice4: '#2c4c8a',
  zap0: '#ffffff', zap1: '#b8fbff', zap2: '#5ad6ff', zap3: '#3a7cff',
  neonPink: '#ff6f9c', neonCyan: '#73f2ff', neonRed: '#ff4b4b',
  water0: '#1d2a4a', water1: '#2d4a72', water2: '#4b7aa6', water3: '#8cc0dc',
  cream: '#f4ead2', creamDark: '#c9b99a', uiDark: '#0d0a16', uiPanel: '#1b1529', uiLine: '#3b3052',
  good: '#8fd694', bad: '#ee6b6b', gold: '#f2c35b'
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function shiftHue(h, target, amount) {
  let d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}

export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

// [outline, dark, base, light, highlight]
const rampCache = new Map();
export function ramp(hex) {
  if (rampCache.has(hex)) return rampCache.get(hex);
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const make = (hh, ss, ll) => rgbToHex(...hslToRgb(hh, Math.max(0, Math.min(1, ss)), Math.max(0, Math.min(1, ll))));
  const out = [
    make(shiftHue(h, 262, 34), Math.min(1, s * 0.75 + 0.18), Math.max(0.07, l * 0.36)),
    make(shiftHue(h, 262, 16), Math.min(1, s * 0.95 + 0.06), l * 0.7),
    hex,
    make(shiftHue(h, 52, 9), s * 0.96, l + (1 - l) * 0.3),
    make(shiftHue(h, 55, 16), s * 0.82, l + (1 - l) * 0.58)
  ];
  const rgb = out.map(hexToRgb);
  const result = { hex: out, rgb };
  rampCache.set(hex, result);
  return result;
}
