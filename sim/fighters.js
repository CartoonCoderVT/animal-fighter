import { DARK } from './moves.js';
// stats: [DANO, MOBILIDADE, ESPECIAL] out of 5.
export const FIGHTERS = [
  {
    id: 'cat', name: 'Mingau', species: 'O REI GATO', role: 'COMANDO / CORTE', word: 'AJOELHEM.', color: '#f68268',
    desc: 'Rei de coroa e cetro. Cinco gatinhos da corte o protegem a todo custo e atacam sozinhos.',
    ability: 'BANDEIRA REAL', icon: '♛', stats: [3, 4, 5], hp: 90, speed: 5, weight: 0.9, cooldown: 15,
    detail: 'J: a corte ataca um por vez. S+J flechas; lado+J carga. K: finca a bandeira: gatinhos buscam peixe e ela vira casa e castelo.'
  },
  {
    id: 'rat', name: 'Marola', species: 'O RATO', role: 'ALCANCE / ATROPELO', word: 'ALOHA.', color: '#7bcbbb',
    desc: 'Pequeno, rápido e com um rabo que parece chicote. Zero preocupação.',
    ability: 'Bola de hamster', icon: '≈', stats: [2, 5, 4], hp: 115, speed: 5.3, weight: 0.8, cooldown: 8,
    detail: 'J chicoteia de longe; o terceiro lança com o rabo. S+J é uma rasteira que derruba. K vira bola de hamster e atropela.'
  },
  {
    id: 'rabbit', name: 'Lola', species: 'A COELHA', role: 'FACAS / TEMPO', word: 'TIC-TAC.', color: '#6aa8f0',
    desc: 'Coelha de laço azul com um relógio de bolso. Corta com facas e some antes de você piscar.',
    ability: 'ZA WARUDO', icon: '◷', stats: [4, 5, 5], hp: 120, speed: 5.1, weight: 0.9, cooldown: 20,
    detail: 'J: facas, dança de lâminas, some e reaparece atrás. Lado+J: salta no tempo. No combo: S+J chuva de facas, toque de lado+J muralha (no ar, anel). K: para o tempo.'
  },
  {
    id: 'ocelot', name: 'Juma', species: 'A JAGUATIRICA', role: 'FÚRIA / FERA / TITÃ', word: 'GRRR.', color: '#e6ba67',
    desc: 'Cada pancada que leva enche a barra de FÚRIA. Cheia, vira a FERA; cheia de novo, a TITÃ, que esmaga tudo.',
    ability: 'Frenesi · Salto · Trovão', icon: '!', stats: [5, 4, 5], hp: 150, speed: 5.3, weight: 0.95, cooldown: 7,
    detail: 'J: garras; lado+J: bote; S+J: mordida; K: frenesi. FERA: patadas, investida, terremoto; K salto. TITÃ: K agarra e esmaga ou bate palma-trovão.'
  },
  {
    id: 'bat', name: 'Nox', species: 'O MORCEGO BRANCO', role: 'VAMPIRO / HEMOMANCIA', word: 'SHHH.', color: '#9fb9ea',
    desc: 'Vampiro de cachecol vermelho. Faz do sangue garra, chicote e lança, e bebe o troco.',
    ability: 'DARK NOX', icon: '⌁', stats: [4, 4, 5], hp: 110, speed: 5.1, weight: 0.8, cooldown: 6,
    detail: 'Faz sangrar e bebe o sangue, até das poças. Barra cheia + K = DARK NOX por 30 s (nem a morte tira): a foice voa sozinha e comba junto.'
  },
  {
    id: 'frog', name: 'Don Sapone', species: 'O SAPO', role: 'ENGOLE / COPIA', word: 'CROAC.', color: '#8cc65a',
    desc: 'Chefão de chapéu e charuto. Engole os rivais vivos e vira uma aberração com o estilo deles.',
    ability: 'Engolir · Cuspir', icon: '◉', stats: [3, 4, 5], hp: 125, speed: 4.9, weight: 0.95, cooldown: 7,
    detail: 'J: tapas e língua. Segure K: suga e engole. Com alguém na pança: K cospe; S+K usa o especial do engolido.'
  },
  {
    id: 'axolotl', name: 'Xolo', species: 'O AXOLOTE', role: 'REGENERAÇÃO / CLONES', word: 'BLUB.', color: '#ff9cb8',
    desc: 'Sorriso eterno e corpo de gelatina. Cada pedaço que perde cresce de novo, e o pedaço vira um irmãozinho que morde.',
    ability: 'Despertar de Xolotl', icon: '*', stats: [3, 3, 5], hp: 115, speed: 4.7, weight: 0.85, cooldown: 9,
    detail: 'J: guelras e cauda; lado+J: barrigada; S+J: bolha. Partes perdidas viram brotos (até 3) que copiam seus golpes. S+K solta a cauda; E pega e J arremessa um broto. K: os brotos viram demônios.'
  }
];
// Juma's forms. Each one is heavier and slower than the last, takes blows on a thicker hide
// (armor: the share of damage that gets through) and arrives with life of its own (hp: added to
// her maximum and healed on the spot). rage: how much of the fury bar a point of damage taken fills.
export const FORMS = {
  null: { weight: 1, speed: 1, armor: 1, hp: 0, rage: 2.1 },
  beast: { weight: 1.9, speed: 0.66, armor: 0.8, hp: 50, rage: 1.5 },
  titan: { weight: 2.8, speed: 0.58, armor: 0.7, hp: 80, rage: 0 }
};
export const formOf = a => FORMS[a.form || null] || FORMS.null;
// The fighting style a fighter is using: their own, or the one the frog swallowed. Moves, specials
// and the habits that go with them follow the style; life, weight, speed and looks stay the fighter's.
export const styleOf = a => a.copy ?? a.type;
// The body a fighter is drawn with: Juma's and Nox's forms, or the frog's borrowed looks ('c0'..'c6').
export const lookOf = a => (a.type === 5 ? (a.copy != null && !(a.act === 'gulp' && !a.copied) ? 'c' + a.copy : null) : a.form || null);
export const weightOf = a => FIGHTERS[a.type].weight * formOf(a).weight;
// DARK NOX is quicker on his feet; the frog waddles a little slower with someone in his belly.
export const speedOf = a => FIGHTERS[a.type].speed * formOf(a).speed * (a.form === 'dark' ? DARK.speed : 1) * (a.belly != null ? 0.88 : 1);
// The frog's belly: how long a swallowed rival stays in on their own, and how much each button
// they mash takes off it.
export const BELLY = { hold: 8, mash: 0.12 };
// The fury bar: full at this much, and the form it turns her into.
export const RAGE_MAX = 100;
export const NEXT_FORM = { null: 'beast', beast: 'titan' };
