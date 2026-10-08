import { Shell } from './ui/shell.js';
import { FIGHTERS } from './sim/fighters.js';
import { MatchScene } from './ui/scenes/match.js';

const canvas = document.getElementById('game');
const shell = new Shell(canvas, document.getElementById('text-input'), document.getElementById('live'));
canvas.focus();

// Explicit local test surface, enabled only by the development query parameter.
if (new URL(location.href).searchParams.has('test')) {
  window.__AF = {
    shell,
    get game() { return shell.game; },
    get remote() { return shell.remote; },
    get net() { return shell.net; },
    get selected() { return shell.selected; },
    get playing() { return shell.playing; },
    get input() { return shell.input; },
    get settings() { return shell.settings; },
    get renderer() { return shell.renderer; },
    get scene() { return shell.scene; },
    startGame(players, mode = shell.mode) { shell.mode = mode; shell.startMatch(players, { mode, instant: true }); const m = shell.base; if (m instanceof MatchScene && m.countdown > 0) { m.countdown = 0.01; } },
    leaveGame() { shell.leaveMatch(); },
    select(i) { shell.selected = i; },
    setMode(m) { shell.mode = m; },
    labAction(a) { if (shell.base instanceof MatchScene) shell.base.labAction(a); },
    fighters: FIGHTERS
  };
}
