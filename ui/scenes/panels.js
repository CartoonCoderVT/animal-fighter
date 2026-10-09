import { VIEW_W, VIEW_H } from '../../engine/const.js';
import { drawText } from '../../engine/font.js';
import { Menu, panel, paragraph, keycap } from '../widgets.js';

class Overlay {
  constructor(shell) { this.shell = shell; this.scroll = 0; }
  back() { this.shell.sound.play('ui_back'); this.shell.pop(); }
  frame(g, title, eyebrow, h = 300) {
    g.fillStyle = 'rgba(8,5,16,0.8)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const x = VIEW_W / 2 - 230, y = Math.round((VIEW_H - h) / 2);
    panel(g, x, y, 460, h, { accent: '#f68268' });
    drawText(g, eyebrow, x + 16, y + 10, { color: '#8a7f9c' });
    drawText(g, title, x + 16, y + 22, { color: '#fff1d6', scale: 2, shadow: '#3a2450' });
    drawText(g, 'ESC VOLTA', x + 444, y + 10, { color: '#6a5e80', align: 'right' });
    return { x: x + 16, y: y + 50 };
  }
}

export class SettingsScene extends Overlay {
  constructor(shell) {
    super(shell);
    const st = shell.settings, save = () => shell.saveSettings();
    const cycle = (key, values) => ({ left: () => { st[key] = values[(values.indexOf(st[key]) - 1 + values.length) % values.length]; save(); }, right: () => { st[key] = values[(values.indexOf(st[key]) + 1) % values.length]; save(); } });
    const step = (key, d) => ({ left: () => { st[key] = Math.max(0, Math.round((st[key] - d) * 100) / 100); save(); }, right: () => { st[key] = Math.min(1, Math.round((st[key] + d) * 100) / 100); save(); } });
    this.menu = new Menu([
      { label: 'VIOLÊNCIA', kind: 'choice', value: () => ['SEM SANGUE', 'SÓ SANGUE', 'COMPLETA'][st.gore], ...cycle('gore', [0, 1, 2]), hint: 'Completa: cortes, ossos, desmembramento e juntas que quebram.' },
      { label: 'TREMOR DE CÂMERA', kind: 'choice', value: () => (st.shake ? 'LIGADO' : 'DESLIGADO'), ...cycle('shake', [true, false]), hint: 'Também desliga os flashes de impacto.' },
      { label: 'CÂMERA DINÂMICA', kind: 'choice', value: () => (st.camera !== false ? 'LIGADA' : 'DESLIGADA'), ...cycle('camera', [true, false]), hint: 'Aproxima a câmera da luta e dá zoom nos golpes fortes.' },
      { label: 'EFEITOS', kind: 'choice', value: () => (st.particles ? 'ALTOS' : 'LEVES'), ...cycle('particles', [true, false]), hint: 'Leves desliga bloom, feixes de luz e sombras na parede. Bom para máquinas fracas.' },
      { label: 'VOLUME DOS EFEITOS', kind: 'choice', value: () => Math.round(st.volume * 100) + '%', ...step('volume', 0.05) },
      { label: 'VOLUME DA MÚSICA', kind: 'choice', value: () => Math.round(st.music * 100) + '%', ...step('music', 0.05) },
      { label: 'ESCALA DOS PIXELS', kind: 'choice', value: () => (st.pixel === 'integer' ? 'INTEIRA' : 'NÍTIDA'), ...cycle('pixel', ['sharp', 'integer']), hint: 'Inteira usa só múltiplos exatos (bordas pretas maiores).' },
      { label: 'MOSTRAR FPS', kind: 'choice', value: () => (st.fps ? 'SIM' : 'NÃO'), ...cycle('fps', [false, true]) },
      { label: 'VOLTAR', action: () => this.back() }
    ], { x: VIEW_W / 2 - 214, y: 82, w: 428, h: 17 });
  }
  update(dt) {
    const it = this.menu.update(this.shell.input, dt, this.shell.sound);
    if (it) it.action();
    else if (this.shell.input.nav('back')) this.back();
  }
  draw(g) {
    this.frame(g, 'AJUSTES DA ARENA', 'DO SEU JEITO', 280);
    this.menu.draw(g);
  }
}

const CONTROLS = [
  [['A', 'D'], 'MOVER'], [['W', 'ESPAÇO'], 'PULAR · SEGURE PARA IR MAIS ALTO · NOX PLANA'], [['S'], 'AGACHAR · SEGURE NA PLATAFORMA PARA DESCER'],
  [['J', 'CLIQUE'], 'LEVE · COM DIREÇÃO MUDA O GOLPE · J DE NOVO PERSEGUE'], [['K', 'DIREITO'], 'PODER ESPECIAL · COM ARMA: GOLPE PESADO'], [['E', 'MEIO'], 'PEGAR ARMAS E RIVAIS CAÍDOS · ARREMESSAR'],
  [['SHIFT'], 'PARRY · ESQUIVA · APANHANDO: QUEBRA O COMBO'], [['L'], 'NOX: REVOADA · VIRA MORCEGOS E ATACA O MAIS PERTO'], [['R', 'Q'], 'LARGAR ARMA · DETONAR C4'], [['ESC'], 'PAUSAR']
];

export class HelpScene extends Overlay {
  constructor(shell) { super(shell); this.page = 0; }
  update() {
    const i = this.shell.input;
    if (i.nav('left') || i.nav('right') || i.clicks.some(c => !c.down)) { this.page = 1 - this.page; this.shell.sound.play('ui_move'); }
    if (i.nav('back') || i.nav('ok')) this.back();
  }
  draw(g) {
    const { x, y } = this.frame(g, this.page ? 'A ARENA MORDE' : 'COMO JOGAR', `MANUAL DA CONFUSÃO · ${this.page + 1}/2 · ◀ ▶`, 300);
    if (this.page === 0) {
      CONTROLS.forEach(([keys, label], i) => {
        let kx = x;
        for (const k of keys) kx += keycap(g, k, kx, y + i * 17) + 3;
        drawText(g, label, x + 112, y + 2 + i * 17, { color: '#d8cde8' });
      });
      paragraph(g, 'Controle: analógico move, A pula, X ataca, Y poder, B pega, LB rola, analógico direito mira (clique: revoada do Nox). Mouse mira na arena. Primeiro a 5 nocautes vence.', x, y + 178, 428, '#8a7f9c');
    } else {
      const tips = [
        'Golpes fortes, explosões e quedas derrubam: o lutador vira ragdoll e levanta depois. Aperte pulo para levantar mais rápido.',
        'Ossos quebram, cortes sangram até matar, lâminas cravam corpos na parede. Extintor congela (um golpe forte estilhaça); rolar apaga o fogo.',
        'No DEPÓSITO: a prensa desce a cada 9 s, o fosso tritura, o cabo eletrifica a poça. Atire na corrente da carga; botijão atingido vira foguete.',
        'Mingau, o Rei Gato, não ataca: cada J manda um da corte (soldado, assassino, arqueiro, mago, escudeiro). S+J chuva de flechas, lado+J carga. K: ATAQUE REAL.',
        'Lola salta no tempo e deixa facas paradas no ar. No combo: S+J chuva de facas, lado+J muralha (no ar, anel). K: ZA WARUDO.',
        'Nox bebe sangue, até das poças no chão. Barra cheia + K: DARK NOX por 30 s (nem a morte tira); a foice voa sozinha e comba junto.',
        'No CASTELO (M na escolha do lutador): velas soltam itens, o lustre cai se a corrente for cortada, pêndulos cortam e a pedra sobre as estacas desaba. Dizem que o castelo guarda segredos...'
      ];
      let yy = y;
      for (const t of tips) yy += paragraph(g, '· ' + t, x, yy, 428, '#d8cde8') + 6;
    }
  }
}

export class CreditsScene extends Overlay {
  update() { if (this.shell.input.nav('back') || this.shell.input.nav('ok') || this.shell.input.clicks.some(c => !c.down)) this.back(); }
  draw(g) {
    const { x, y } = this.frame(g, 'FEITO DE PEQUENAS PEÇAS', 'CRÉDITOS & LICENÇAS', 290);
    let yy = y;
    const block = (title, text) => { drawText(g, title, x, yy, { color: '#f2c35b' }); yy += 12; yy += paragraph(g, text, x, yy, 428, '#b9aecb') + 8; };
    block('ANIMAL FIGHTER', 'Jogo original. Superfighters Deluxe, Duck Game e Mutilate-a-Doll 2 são referências de combate e física; nenhuma arte ou código deles foi usado.');
    block('ARTE, ANIMAÇÃO E SOM', 'Pixel art procedural: personagens em vetor rasterizados com luz, rig de 16 peças, cenário pintado por código. Efeitos e músicas sintetizados no navegador.');
    block('MATTER.JS 0.20 · MIT', 'Física de corpos rígidos, ragdolls e restrições. brm.io/matter-js');
    block('PEERJS 1.5.5 · MIT', 'Salas WebRTC para jogar online. O anfitrião mantém o jogo aberto.');
  }
}
