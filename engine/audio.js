// Synthesized sound effects and a tiny chiptune sequencer; nothing is loaded from disk.
const N = (freq, dur, type = 'lowpass', to = null) => ({ freq, dur, type, to });
const SFX = {
  jump: { wave: 'square', f0: 340, f1: 620, dur: 0.09, vol: 0.5 },
  land: { wave: 'sine', f0: 140, f1: 55, dur: 0.09, noise: N(420, 0.08), vol: 0.7 },
  word: { wave: 'square', f0: 230, f1: 120, dur: 0.1, vol: 0.45 },
  gun: { wave: 'square', f0: 95, f1: 30, dur: 0.1, noise: N(1700, 0.12), vol: 0.75 },
  shotgun: { wave: 'square', f0: 70, f1: 22, dur: 0.16, noise: N(950, 0.26), vol: 0.9 },
  hit: { wave: 'square', f0: 120, f1: 40, dur: 0.1, noise: N(1500, 0.1), vol: 0.8 },
  punch: { wave: 'sine', f0: 170, f1: 55, dur: 0.08, noise: N(900, 0.07), vol: 0.8 },
  swing: { noise: N(2200, 0.08, 'bandpass'), vol: 0.45 },
  break: { wave: 'square', f0: 90, f1: 40, dur: 0.12, noise: N(650, 0.22), vol: 0.7 },
  glass: { wave: 'sine', f0: 2100, f1: 1300, dur: 0.18, noise: N(4200, 0.26, 'highpass'), vol: 0.6 },
  explosion: { wave: 'sine', f0: 65, f1: 22, dur: 0.55, noise: N(360, 0.65), vol: 1 },
  heal: { wave: 'sine', f0: 560, f1: 980, dur: 0.28, vol: 0.5 },
  charm: { wave: 'sine', f0: 650, f1: 1150, dur: 0.3, vol: 0.5 },
  summon: { wave: 'square', f0: 430, f1: 760, dur: 0.14, vol: 0.45 },
  roar: { wave: 'sawtooth', f0: 75, f1: 38, dur: 0.45, noise: N(300, 0.3), vol: 0.75 },
  slash: { wave: 'sawtooth', f0: 320, f1: 90, dur: 0.1, noise: N(2600, 0.12, 'highpass'), vol: 0.65 },
  pickup: { wave: 'square', f0: 760, f1: 1300, dur: 0.1, vol: 0.4 },
  death: { wave: 'square', f0: 70, f1: 25, dur: 0.4, vol: 0.6 },
  crack: { wave: 'square', f0: 900, f1: 200, dur: 0.04, noise: N(3200, 0.06, 'highpass'), vol: 0.75 },
  squish: { noise: N(700, 0.16), wave: 'sine', f0: 110, f1: 60, dur: 0.1, vol: 0.7 },
  freeze: { wave: 'sine', f0: 1700, f1: 2700, dur: 0.3, noise: N(5000, 0.2, 'highpass'), vol: 0.45 },
  shatter: { wave: 'triangle', f0: 2600, f1: 1800, dur: 0.25, noise: N(5200, 0.4, 'highpass'), vol: 0.8 },
  zap: { wave: 'sawtooth', f0: 1300, f1: 260, dur: 0.18, noise: N(2400, 0.14, 'bandpass'), vol: 0.6 },
  press: { wave: 'sawtooth', f0: 55, f1: 32, dur: 0.4, noise: N(220, 0.5), vol: 0.9 },
  siren: { wave: 'square', f0: 620, f1: 880, dur: 0.45, vol: 0.3 },
  grind: { wave: 'sawtooth', f0: 48, f1: 36, dur: 0.5, noise: N(320, 0.5), vol: 0.9 },
  ricochet: { wave: 'sine', f0: 2600, f1: 900, dur: 0.17, vol: 0.4 },
  casing: { wave: 'sine', f0: 3300, f1: 2900, dur: 0.05, vol: 0.18 },
  thud: { wave: 'sine', f0: 90, f1: 40, dur: 0.1, noise: N(260, 0.1), vol: 0.6 },
  rocket: { wave: 'sawtooth', f0: 180, f1: 420, dur: 0.35, noise: N(1300, 0.35), vol: 0.6 },
  spray: { noise: N(3200, 0.16, 'highpass'), vol: 0.35 },
  ui_move: { wave: 'square', f0: 540, f1: 540, dur: 0.035, vol: 0.25 },
  ui_ok: { wave: 'square', f0: 660, f1: 1000, dur: 0.08, vol: 0.3 },
  ui_back: { wave: 'square', f0: 440, f1: 290, dur: 0.08, vol: 0.3 },
  countdown: { wave: 'square', f0: 440, f1: 440, dur: 0.12, vol: 0.35 },
  go: { wave: 'square', f0: 660, f1: 1320, dur: 0.3, vol: 0.4 },
  clang: { partials: [[1250, 0.5, 0.55], [1873, 0.36, 0.42], [2507, 0.3, 0.33], [3341, 0.2, 0.26], [4270, 0.12, 0.18]], noise: N(5200, 0.05, 'highpass'), vol: 0.75 },
  clang2: { partials: [[1660, 0.42, 0.28], [2480, 0.3, 0.22], [3310, 0.2, 0.16]], noise: N(6000, 0.03, 'highpass'), vol: 0.55 },
  swish: { noise: N(1400, 0.13, 'bandpass', 4200), vol: 0.42 },
  whoosh: { noise: N(380, 0.24, 'bandpass', 1300), vol: 0.62 },
  chop: { wave: 'square', f0: 240, f1: 60, dur: 0.08, noise: N(1900, 0.11), vol: 0.8 },
  // Hemomancy: a wet slap of blood, the hum of blood condensing, the crack of the beam.
  blood: { wave: 'sine', f0: 150, f1: 55, dur: 0.12, noise: N(650, 0.16, 'bandpass', 220), vol: 0.75 },
  charge: { wave: 'sine', f0: 140, f1: 880, dur: 0.34, noise: N(400, 0.34, 'bandpass', 2400), vol: 0.5 },
  beam: { wave: 'sawtooth', f0: 900, f1: 110, dur: 0.32, noise: N(3200, 0.3, 'highpass', 900), vol: 0.8 },
  // A flurry of wings and squeaks.
  bats: { wave: 'square', f0: 2600, f1: 1500, dur: 0.12, noise: N(1800, 0.3, 'bandpass', 600), vol: 0.45 }
};

const SONGS = {
  menu: {
    bpm: 112, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: [0, null, 0, null, 12, null, 0, 7, 0, null, 0, null, 12, 10, 7, null],
    arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 2, 1, 0, null],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1]
  },
  fight: {
    bpm: 150, chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 51, 54]],
    bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 10, 0, 7, 0],
    arp: [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 3, 2, 1, 2],
    kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  }
};
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.35;
    this.musicVolume = 0.25;
    this.last = {};
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  async enable(on = true) {
    this.enabled = on;
    if (on) {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const d = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const real = new Float32Array(32), imag = new Float32Array(32);
        for (let n = 1; n < 32; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
        this.pulse = this.ctx.createPeriodicWave(real, imag);
      }
      await this.ctx.resume();
      this.applyVolume();
      if (this.wantedSong) this.music(this.wantedSong);
    } else if (this.ctx) {
      this.stopMusic();
      await this.ctx.suspend();
    }
  }

  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = 1;
    this.musicGain.gain.value = this.musicVolume * 0.5;
  }

  play(name, x = null) {
    if (!this.enabled || !this.ctx) return;
    const spec = SFX[name];
    if (!spec) return;
    const t = this.ctx.currentTime;
    if (t - (this.last[name] || 0) < 0.035) return;
    this.last[name] = t;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(this.volume * 0.3 * (spec.vol ?? 0.6), t);
    let node = out;
    if (x !== null && this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.8, Math.min(0.8, (x / 960) * 1.6 - 0.8));
      out.connect(pan);
      pan.connect(this.master);
    } else out.connect(this.master);
    const dur = Math.max(spec.dur || 0, spec.noise?.dur || 0, ...(spec.partials || []).map(p => p[2]));
    for (const [f, v, d] of spec.partials || []) {
      const o = this.ctx.createOscillator(), pg = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * (0.98 + Math.random() * 0.04), t);
      pg.gain.setValueAtTime(v, t);
      pg.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(pg); pg.connect(node);
      o.start(t); o.stop(t + d);
    }
    if (spec.noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = spec.noise.type;
      filter.frequency.value = spec.noise.freq;
      if (spec.noise.to) filter.frequency.exponentialRampToValueAtTime(spec.noise.to, t + spec.noise.dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + spec.noise.dur);
      src.connect(filter); filter.connect(g); g.connect(node);
      src.start(t, Math.random() * 0.5);
      src.stop(t + spec.noise.dur);
    }
    if (spec.wave) {
      const o = this.ctx.createOscillator();
      o.type = spec.wave;
      o.frequency.setValueAtTime(spec.f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, spec.f1), t + spec.dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + spec.dur);
      o.connect(g); g.connect(node);
      o.start(t);
      o.stop(t + spec.dur);
    }
    setTimeout(() => out.disconnect(), (dur + 0.1) * 1000);
  }

  music(name) {
    this.wantedSong = name;
    if (!this.enabled || !this.ctx) return;
    if (this.song === name) return;
    this.stopMusic();
    if (!name || !SONGS[name]) return;
    this.song = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  schedule() {
    const song = SONGS[this.song];
    if (!song || !this.ctx) return;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % 16, bar = Math.floor(this.step / 16) % song.chords.length, chord = song.chords[bar];
      const t = this.nextTime;
      if (song.bass[i] !== null) this.tone(midi(chord[0] - 12 + song.bass[i]), t, stepDur * 0.9, 'triangle', 0.55);
      if (song.arp[i] !== null) {
        const n = song.arp[i] === 3 ? chord[0] + 12 : chord[song.arp[i]];
        this.tone(midi(n + 12), t, stepDur * 0.55, 'pulse', 0.12);
      }
      if (song.kick[i]) this.drum(t, 'kick');
      if (song.snare[i]) this.drum(t, 'snare');
      if (song.hat[i]) this.drum(t, 'hat');
      this.nextTime += stepDur;
      this.step++;
    }
  }
  tone(freq, t, dur, wave, vol) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    if (wave === 'pulse') o.setPeriodicWave(this.pulse); else o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  drum(t, kind) {
    const g = this.ctx.createGain();
    g.connect(this.musicGain);
    if (kind === 'kick') {
      const o = this.ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); o.start(t); o.stop(t + 0.17);
      return;
    }
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const dur = kind === 'hat' ? 0.03 : 0.12;
    g.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g);
    src.start(t, Math.random() * 0.5); src.stop(t + dur);
  }
}
