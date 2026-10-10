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
    id: 'ocelot', name: 'Juma', species: 'A JAGUATIRICA', role: 'FÚRIA / FERA', word: 'GRRR.', color: '#e6ba67',
    desc: 'Pequena, rápida e sem paciência nenhuma. Quando perde a calma, vira a FERA.',
    ability: 'Fera', icon: '!', stats: [5, 4, 5], hp: 150, speed: 5.3, weight: 0.95, cooldown: 9,
    detail: 'J: fúria de garras; lado+J: bote; S+J: mordida. K: vira a FERA, lenta e blindada, e o chão treme. Na FERA, K é o salto sísmico.'
  },
  {
    id: 'bat', name: 'Nox', species: 'O MORCEGO BRANCO', role: 'VAMPIRO / HEMOMANCIA', word: 'SHHH.', color: '#9fb9ea',
    desc: 'Vampiro de cachecol vermelho. Faz do sangue garra, chicote e lança, e bebe o troco.',
    ability: 'DARK NOX', icon: '⌁', stats: [4, 4, 5], hp: 110, speed: 5.1, weight: 0.8, cooldown: 6,
    detail: 'Faz sangrar e bebe o sangue, até das poças. Barra cheia + K = DARK NOX por 30 s (nem a morte tira): a foice voa sozinha e comba junto.'
  }
];
// Juma's beast form is far heavier and slower than she is.
export const weightOf = a => FIGHTERS[a.type].weight * (a.form === 'beast' ? 1.9 : 1);
// DARK NOX is quicker on his feet.
export const speedOf = a => FIGHTERS[a.type].speed * (a.form === 'beast' ? 0.66 : a.form === 'dark' ? DARK.speed : 1);
