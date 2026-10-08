// Melee weapons with Brawlhalla-style movesets: light attacks by direction (neutral string,
// side, down; neutral/side/down in the air) and heavies (neutral/side/down signatures, a
// recovery and a ground pound in the air). Light = left click / J, heavy = right click / K.
//
// anim: how the near arm (and the weapon in it) moves through the attack, in phases:
//   windup [0, w): held anticipation pose · swing [w, s): the active arc · follow-through [s, 1]
//   swing: arm angle sweeps from -> to (degrees, 0 = hanging down, -90 = forward, ±180 = up)
//   thrust: arm points at `to` and drives forward · spin: whole-body turns · flurry: rapid stabs
// Move fields as in moves.js, plus: shock (shockwave radius on impact), around (hits behind too),
// pass (dashes through fighters), vy (self vertical speed at the start), plunge (falls until
// landing, hitting on touchdown), next (the following hit of a neutral light string).

export const MELEE = ['blade', 'katana', 'spear', 'pipe', 'axe', 'hammer'];
export const isMelee = w => MELEE.includes(w);

// weight decides clashes (the heavier blade wins and can disarm); ricochet: chance an enemy
// weapon glances off this one when it is held toward the attacker.
export const WEAPON_INFO = {
  blade: { name: 'FACA', weight: 1, ricochet: 0.2, grip: -170, len: 11, smear: '#f4f8ff' },
  katana: { name: 'KATANA', weight: 2, ricochet: 0.38, grip: -150, len: 16, smear: '#ffffff' },
  spear: { name: 'LANÇA', weight: 2, ricochet: 0.28, grip: -90, len: 24, smear: '#e8f0ff' },
  pipe: { name: 'CANO', weight: 3, ricochet: 0.2, grip: -160, len: 15, smear: '#f0d8c8' },
  axe: { name: 'MACHADO', weight: 4, ricochet: 0.25, grip: -160, len: 15, smear: '#fff0e0' },
  hammer: { name: 'MARRETA', weight: 5, ricochet: 0.15, grip: -170, len: 16, smear: '#ffe8d0' }
};

const SW = (from, to, w = 0.35, s = 0.62) => ({ style: 'swing', from, to, w, s });
const TH = (to = -90, w = 0.32, s = 0.58) => ({ style: 'thrust', to, w, s });
const SPIN = (turns = 4, w = 0.12, s = 0.88) => ({ style: 'spin', turns, w, s });
const FL = (w = 0.15, s = 0.85) => ({ style: 'flurry', to: -90, w, s });

// Hit moments inside the swing window, evenly spread.
const within = (a, n = 1) => Array.from({ length: n }, (_, i) => +(a.w + ((a.s - a.w) * (i + 0.6)) / n).toFixed(3));
function mv(o) {
  const n = o.n || 1, anim = o.anim;
  return { band: 26, cd: 0.2, kb: [[2, 0]], ...o, hits: o.hits || within(anim, n), dmg: Array.isArray(o.dmg) ? o.dmg : Array(n).fill(o.dmg), kb: Array.isArray(o.kb[0]) ? o.kb : Array(n).fill(o.kb) };
}

const SETS = {
  blade: {
    nLight: mv({ dur: 0.18, range: 24, dmg: 6, kb: [1, 0], anim: SW(140, -60), next: 'nLight2', step: 2 }),
    nLight2: mv({ dur: 0.18, range: 24, dmg: 6, kb: [1, 0], anim: SW(-30, -170), next: 'nLight3', step: 2 }),
    nLight3: mv({ dur: 0.24, range: 28, dmg: 9, kb: [4, -2], anim: TH(-90), step: 4 }),
    sLight: mv({ dur: 0.24, range: 30, dmg: 8, kb: [3, -1], anim: TH(-90, 0.25), step: 6 }),
    dLight: mv({ dur: 0.24, range: 26, dmg: 6, kb: [1.4, -6.5], anim: SW(30, -120), low: true, lift: true }),
    nAir: mv({ dur: 0.26, range: 22, dmg: 5, n: 2, kb: [1, -1.5], anim: SPIN(4), around: true }),
    sAir: mv({ dur: 0.22, range: 26, dmg: 7, kb: [3, -1], anim: SW(150, -40) }),
    dAir: mv({ dur: 0.26, range: 22, dmg: 8, kb: [1, 6], anim: TH(-10, 0.2, 0.7), spike: true, vy: 5 }),
    nSig: mv({ dur: 0.5, range: 26, dmg: 4, n: 4, kb: [[0.6, 0], [0.6, 0], [0.6, 0], [4, -3]], anim: FL(), cd: 0.4, step: 2 }),
    sSig: mv({ dur: 0.4, range: 30, dmg: 12, kb: [5, -3], anim: TH(-90, 0.3, 0.6), step: 10, pass: true, cd: 0.45 }),
    dSig: mv({ dur: 0.4, range: 30, dmg: 10, kb: [2.5, -3.5], anim: SPIN(4), low: true, knock: true, around: true, cd: 0.45 }),
    rec: mv({ dur: 0.4, range: 24, dmg: 9, kb: [1, -9], anim: SW(20, -175), vy: -10, launch: true, cd: 0.5 }),
    gp: mv({ dur: 0.6, range: 26, dmg: 10, kb: [3, -4], anim: TH(-5, 0.1, 0.9), plunge: true, shock: 34, knock: true, cd: 0.4 })
  },
  katana: {
    nLight: mv({ dur: 0.22, range: 34, dmg: 8, kb: [1.3, 0], anim: SW(150, -70), next: 'nLight2', step: 2.4 }),
    nLight2: mv({ dur: 0.22, range: 34, dmg: 8, kb: [1.5, 0], anim: SW(-70, 160), next: 'nLight3', step: 2.4 }),
    nLight3: mv({ dur: 0.32, range: 34, dmg: 10, kb: [1.2, -10], anim: SW(30, -175), launch: true }),
    sLight: mv({ dur: 0.28, range: 36, dmg: 10, kb: [3.5, -1.5], anim: SW(120, -80), step: 6 }),
    dLight: mv({ dur: 0.28, range: 34, dmg: 7, kb: [1.4, -6.5], anim: SW(60, -110), low: true, lift: true }),
    nAir: mv({ dur: 0.3, range: 30, dmg: 6, n: 2, kb: [1.2, -1.5], anim: SPIN(4), around: true }),
    sAir: mv({ dur: 0.28, range: 36, dmg: 10, kb: [4, -2], anim: SW(170, -60) }),
    dAir: mv({ dur: 0.3, range: 32, dmg: 9, kb: [2, 7], anim: SW(-130, 20), spike: true, vy: 3 }),
    nSig: mv({ dur: 0.5, range: 34, dmg: [6, 6, 10], n: 3, kb: [[0.8, -2], [0.8, -2], [1.2, -10]], anim: SW(60, -175, 0.25, 0.8), launch: true, cd: 0.45 }),
    sSig: mv({ dur: 0.55, range: 40, dmg: 16, kb: [6, -4], anim: SW(80, -100, 0.45, 0.65), step: 11, pass: true, knock: true, cd: 0.5 }),
    dSig: mv({ dur: 0.5, range: 36, dmg: 14, kb: [3, -5], anim: SW(170, 10, 0.4, 0.62), shock: 46, knock: true, cd: 0.5 }),
    rec: mv({ dur: 0.42, range: 30, dmg: 10, n: 2, kb: [1, -8], anim: SPIN(4, 0.1, 0.9), vy: -11, launch: true, around: true, cd: 0.5 }),
    gp: mv({ dur: 0.6, range: 30, dmg: 12, kb: [3, -4], anim: TH(-5, 0.1, 0.9), plunge: true, shock: 42, knock: true, cd: 0.4 })
  },
  spear: {
    nLight: mv({ dur: 0.24, range: 50, band: 20, dmg: 7, kb: [1.6, 0], anim: TH(-90), next: 'nLight2' }),
    nLight2: mv({ dur: 0.24, range: 50, band: 20, dmg: 7, kb: [1.8, 0], anim: TH(-100), next: 'nLight3' }),
    nLight3: mv({ dur: 0.34, range: 54, band: 20, dmg: 5, n: 2, kb: [[1, 0], [5, -1.5]], anim: FL(0.2, 0.8) }),
    sLight: mv({ dur: 0.3, range: 58, band: 20, dmg: 10, kb: [5, -1.5], anim: TH(-90, 0.3), step: 7 }),
    dLight: mv({ dur: 0.3, range: 46, dmg: 7, kb: [1.4, -6.5], anim: SW(50, -110), low: true, lift: true }),
    nAir: mv({ dur: 0.32, range: 40, dmg: 6, n: 2, kb: [1.2, -1.5], anim: SPIN(4), around: true }),
    sAir: mv({ dur: 0.28, range: 52, band: 20, dmg: 9, kb: [4, -1], anim: TH(-90, 0.25) }),
    dAir: mv({ dur: 0.3, range: 34, dmg: 9, kb: [1, 8], anim: TH(-5, 0.2, 0.7), spike: true, vy: 5 }),
    nSig: mv({ dur: 0.45, range: 46, dmg: 11, kb: [1.2, -10.5], anim: TH(-150, 0.35, 0.6), launch: true, cd: 0.45 }),
    sSig: mv({ dur: 0.5, range: 58, band: 20, dmg: 13, kb: [6, -2.5], anim: TH(-90, 0.4, 0.65), step: 9, vy: -3, cd: 0.5 }),
    dSig: mv({ dur: 0.45, range: 50, dmg: 10, kb: [3, -3.5], anim: SPIN(4), low: true, around: true, knock: true, cd: 0.5 }),
    rec: mv({ dur: 0.4, range: 40, dmg: 10, kb: [1, -9], anim: TH(-175, 0.15, 0.7), vy: -11.5, launch: true, cd: 0.5 }),
    gp: mv({ dur: 0.6, range: 32, dmg: 12, kb: [3, -4], anim: TH(-5, 0.1, 0.9), plunge: true, shock: 40, knock: true, cd: 0.4 })
  },
  pipe: {
    nLight: mv({ dur: 0.26, range: 32, dmg: 9, kb: [1.6, 0], anim: SW(150, -60), next: 'nLight2', step: 2.2 }),
    nLight2: mv({ dur: 0.26, range: 32, dmg: 9, kb: [1.8, 0], anim: SW(-60, 150), next: 'nLight3', step: 2.2 }),
    nLight3: mv({ dur: 0.36, range: 34, dmg: 12, kb: [5, -4], anim: SW(175, -20, 0.4, 0.62), knock: true, breaks: true }),
    sLight: mv({ dur: 0.3, range: 34, dmg: 9, kb: [4, -1], anim: TH(-90), step: 5 }),
    dLight: mv({ dur: 0.3, range: 32, dmg: 8, kb: [1.5, -6.5], anim: SW(60, -110), low: true, lift: true }),
    nAir: mv({ dur: 0.32, range: 30, dmg: 7, n: 2, kb: [1.2, -1.5], anim: SPIN(4), around: true }),
    sAir: mv({ dur: 0.3, range: 34, dmg: 10, kb: [4, -2], anim: SW(160, -50) }),
    dAir: mv({ dur: 0.32, range: 30, dmg: 10, kb: [2, 7], anim: SW(-150, 10), spike: true, vy: 3 }),
    nSig: mv({ dur: 0.48, range: 34, dmg: 13, kb: [1.2, -10.5], anim: SW(30, -175, 0.4, 0.62), launch: true, cd: 0.45 }),
    sSig: mv({ dur: 0.48, range: 36, dmg: 14, kb: [7, -3.5], anim: SW(110, -110, 0.42, 0.62), step: 8, knock: true, cd: 0.5 }),
    dSig: mv({ dur: 0.52, range: 34, dmg: 15, kb: [3, -5], anim: SW(175, 10, 0.42, 0.62), shock: 48, knock: true, breaks: true, cd: 0.5 }),
    rec: mv({ dur: 0.42, range: 30, dmg: 10, kb: [1, -9], anim: SW(20, -175, 0.15, 0.6), vy: -10.5, launch: true, cd: 0.5 }),
    gp: mv({ dur: 0.6, range: 30, dmg: 13, kb: [3, -4], anim: SW(175, 0, 0.1, 0.3), plunge: true, shock: 48, knock: true, cd: 0.4 })
  },
  axe: {
    nLight: mv({ dur: 0.34, range: 36, dmg: 13, kb: [1.8, 0], anim: SW(170, -40, 0.42, 0.64), next: 'nLight2', step: 2.6 }),
    nLight2: mv({ dur: 0.34, range: 36, dmg: 13, kb: [2, 0], anim: SW(100, -100, 0.4, 0.62), next: 'nLight3', step: 2.6 }),
    nLight3: mv({ dur: 0.44, range: 38, dmg: 9, n: 2, kb: [[1.5, -1], [6, -4]], anim: SPIN(8, 0.2, 0.85), around: true, knock: true }),
    sLight: mv({ dur: 0.36, range: 38, dmg: 14, kb: [4.5, -2], anim: SW(140, -80, 0.42, 0.64), step: 5 }),
    dLight: mv({ dur: 0.34, range: 34, dmg: 10, kb: [2, -6.5], anim: SW(90, -60), low: true, lift: true }),
    nAir: mv({ dur: 0.36, range: 32, dmg: 9, n: 2, kb: [1.2, -1.5], anim: SPIN(4), around: true }),
    sAir: mv({ dur: 0.34, range: 36, dmg: 14, kb: [4, -2], anim: SW(170, -20) }),
    dAir: mv({ dur: 0.36, range: 32, dmg: 14, kb: [2, 8], anim: SW(-175, 0), spike: true, vy: 3 }),
    nSig: mv({ dur: 0.55, range: 36, dmg: 16, kb: [1.2, -10.5], anim: SW(20, -175, 0.45, 0.66), launch: true, cd: 0.5 }),
    sSig: mv({ dur: 0.7, range: 34, dmg: 8, n: 3, kb: [[1.5, -1], [1.5, -1], [5, -3]], anim: SPIN(12, 0.15, 0.9), step: 6, around: true, cd: 0.55 }),
    dSig: mv({ dur: 0.62, range: 38, dmg: 20, kb: [3, -5], anim: SW(178, 5, 0.5, 0.66), shock: 52, knock: true, breaks: true, cd: 0.6 }),
    rec: mv({ dur: 0.45, range: 30, dmg: 11, n: 2, kb: [1, -8], anim: SPIN(4, 0.1, 0.9), vy: -10, launch: true, around: true, cd: 0.5 }),
    gp: mv({ dur: 0.65, range: 30, dmg: 15, kb: [3, -5], anim: SW(175, 0, 0.1, 0.3), plunge: true, shock: 56, knock: true, cd: 0.45 })
  },
  hammer: {
    nLight: mv({ dur: 0.4, range: 36, dmg: 15, kb: [6, -3], anim: SW(170, -10, 0.45, 0.66), next: 'nLight2', step: 2 }),
    nLight2: mv({ dur: 0.4, range: 36, dmg: 14, kb: [1.2, -10.5], anim: SW(-10, -175, 0.4, 0.64), launch: true }),
    sLight: mv({ dur: 0.4, range: 38, dmg: 15, kb: [9, -3], anim: SW(110, -110, 0.45, 0.66), step: 4 }),
    dLight: mv({ dur: 0.42, range: 34, dmg: 12, kb: [2, -5], anim: SW(175, 0, 0.45, 0.62), shock: 36, knock: true }),
    nAir: mv({ dur: 0.4, range: 32, dmg: 10, n: 2, kb: [1.5, -1.5], anim: SPIN(4), around: true }),
    sAir: mv({ dur: 0.4, range: 36, dmg: 15, kb: [5, -2], anim: SW(170, -20) }),
    dAir: mv({ dur: 0.42, range: 32, dmg: 16, kb: [2, 9], anim: SW(-175, 0), spike: true, vy: 3 }),
    nSig: mv({ dur: 0.7, range: 40, dmg: 22, kb: [12, -6], anim: SW(130, -130, 0.58, 0.72), knock: true, cd: 0.6 }),
    sSig: mv({ dur: 0.75, range: 36, dmg: 10, n: 3, kb: [[2, -1], [2, -1], [7, -4]], anim: SPIN(12, 0.15, 0.9), step: 5, around: true, cd: 0.6 }),
    dSig: mv({ dur: 0.7, range: 40, dmg: 18, kb: [4, -6], anim: SW(178, 0, 0.55, 0.68), shock: 90, knock: true, breaks: true, cd: 0.7 }),
    rec: mv({ dur: 0.48, range: 32, dmg: 12, kb: [1, -9], anim: SW(20, -175, 0.15, 0.6), vy: -10, launch: true, cd: 0.55 }),
    gp: mv({ dur: 0.7, range: 30, dmg: 16, kb: [4, -5], anim: SW(178, 0, 0.1, 0.3), plunge: true, shock: 70, knock: true, cd: 0.5 })
  }
};
// Hammer's neutral string is two big blows.
SETS.hammer.nLight3 = SETS.hammer.nLight2;

export const WEAPON_MOVES = {};
for (const [w, set] of Object.entries(SETS)) for (const [slot, m] of Object.entries(set)) {
  WEAPON_MOVES[w + ':' + slot] = { ...m, kind: w, weapon: w, slot, next: m.next ? w + ':' + m.next : null };
}

// Which move a light or heavy press picks, from the held direction and whether airborne.
export function weaponSlot(heavy, ground, side, down) {
  if (heavy) return ground ? (down ? 'dSig' : side ? 'sSig' : 'nSig') : down ? 'gp' : 'rec';
  return ground ? (down ? 'dLight' : side ? 'sLight' : 'nLight') : down ? 'dAir' : side ? 'sAir' : 'nAir';
}
