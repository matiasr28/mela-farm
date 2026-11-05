// AudioEngine: música y efectos 100% sintetizados con Web Audio (sin archivos de audio).
// - La música es un loop "country" alegre (bajo, acordes, melodía y shaker) con un
//   secuenciador de anticipación (lookahead) para que el tempo sea estable.
// - Los efectos se atenúan con la distancia al jugador y tienen un mínimo de tiempo
//   entre repeticiones para no saturar cuando pasan muchos ítems.
// - En celulares el audio sólo puede arrancar tras un toque: se llama unlock() en la
//   pantalla de inicio.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 112;
const EIGHTH = 60 / BPM / 2;

// Progresión de 8 compases (Sol mayor): G D Em C | G C D G
const PROG = [
  { bass: 43, notes: [55, 59, 62] },
  { bass: 38, notes: [54, 57, 62] },
  { bass: 40, notes: [55, 59, 64] },
  { bass: 36, notes: [55, 60, 64] },
  { bass: 43, notes: [55, 59, 62] },
  { bass: 36, notes: [55, 60, 64] },
  { bass: 38, notes: [54, 57, 62] },
  { bass: 43, notes: [55, 59, 62] },
];

// Melodía: 8 corcheas por compás (null = silencio)
const _ = null;
const MELODY = [
  67, _, 71, 74, 76, 74, 71, _,
  69, _, 66, 69, 74, 71, 69, _,
  71, _, 74, 76, 79, 76, 74, _,
  76, 74, 72, 71, 69, _, _, _,
  67, _, 71, 74, 79, _, 76, 74,
  72, _, 76, 72, 71, 69, 67, _,
  69, 71, 74, _, 69, _, 66, _,
  67, _, _, _, 71, _, 67, _,
];

// Mínimo de segundos entre dos reproducciones del mismo efecto
const MIN_GAP = {
  pop: 0.035, drop: 0.04, harvest: 0.05, coin: 0.028, tick: 0.07, cluck: 0.45, moo: 3,
  full: 0.8, horn: 1, register: 0.2, unlock: 0.3, happy: 0.25, step: 0.2,
  talk: 0.15, oven: 0.5, mission: 0.5, levelup: 1, baa: 3, meow: 0.6, kiss: 0.5,
};

/** Recetas de cada efecto: (engine, tiempo, volumen, pitch) */
const SFX = {
  pop: (a, t, v, p) => a.tone(t, 520 * p, 0.09, { vol: 0.22 * v, slide: 820 * p }),
  drop: (a, t, v, p) => a.tone(t, 360 * p, 0.1, { type: 'triangle', vol: 0.28 * v, slide: 200 * p }),
  harvest: (a, t, v) => {
    a.noise(t, 0.07, { vol: 0.2 * v, freq: 3500, q: 0.8 });
    a.tone(t, 900, 0.06, { vol: 0.06 * v, slide: 1400 });
  },
  coin: (a, t, v, p) => {
    a.tone(t, 1318 * p, 0.06, { type: 'square', vol: 0.05 * v, filter: 5000 });
    a.tone(t + 0.05, 1760 * p, 0.14, { type: 'square', vol: 0.05 * v, filter: 5000 });
  },
  register: (a, t, v) => {
    a.noise(t, 0.05, { vol: 0.2 * v, freq: 5000, type: 'highpass' });
    a.tone(t + 0.04, 2093, 0.5, { vol: 0.12 * v });
    a.tone(t + 0.04, 2637, 0.6, { vol: 0.1 * v });
    a.tone(t + 0.12, 3136, 0.5, { vol: 0.06 * v });
  },
  unlock: (a, t, v) => {
    [523, 659, 784, 1046].forEach((f, i) => a.tone(t + i * 0.08, f, 0.28, { type: 'triangle', vol: 0.22 * v }));
    a.tone(t + 0.32, 1568, 0.6, { vol: 0.1 * v });
    a.noise(t + 0.3, 0.35, { vol: 0.06 * v, freq: 8000, type: 'highpass' });
  },
  tick: (a, t, v, p) => a.tone(t, 1100 * p, 0.035, { vol: 0.07 * v }),
  cluck: (a, t, v) => {
    for (let i = 0; i < 3; i++) {
      a.tone(t + i * 0.07, 650 - i * 60 + Math.random() * 80, 0.05, { type: 'square', vol: 0.045 * v, filter: 1800, slide: 450 });
    }
  },
  moo: (a, t, v) => a.tone(t, 170, 0.9, { type: 'sawtooth', vol: 0.11 * v, slide: 115, filter: 700, attack: 0.12 }),
  // "Muak": chasquido corto + tonito que sube
  kiss: (a, t, v) => {
    a.noise(t, 0.05, { vol: 0.25 * v, freq: 2500, q: 2 });
    a.tone(t + 0.03, 500, 0.12, { vol: 0.14 * v, slide: 1100 });
    a.tone(t + 0.2, 1046, 0.35, { type: 'triangle', vol: 0.1 * v, slide: 1568 });
  },
  meow: (a, t, v, p) => {
    const f = 620 * p;
    a.tone(t, f, 0.12, { type: 'triangle', vol: 0.12 * v, slide: f * 1.35, filter: 2600, attack: 0.03 });
    a.tone(t + 0.12, f * 1.35, 0.28, { type: 'triangle', vol: 0.12 * v, slide: f * 0.8, filter: 2600 });
  },
  baa: (a, t, v) => {
    for (let i = 0; i < 4; i++) {
      a.tone(t + i * 0.09, 400 - i * 12, 0.11, { type: 'sawtooth', vol: 0.06 * v, filter: 1800, attack: 0.02 });
    }
  },
  full: (a, t, v) => a.tone(t, 260, 0.18, { type: 'triangle', vol: 0.25 * v, slide: 150 }),
  horn: (a, t, v) => {
    for (const d of [0, 0.28]) {
      a.tone(t + d, 392, 0.22, { type: 'square', vol: 0.06 * v, filter: 1500 });
      a.tone(t + d, 494, 0.22, { type: 'square', vol: 0.06 * v, filter: 1500 });
    }
  },
  happy: (a, t, v) => a.tone(t, 880, 0.12, { vol: 0.1 * v, slide: 1320 }),
  // "Voz" estilo balbuceo: sílabas cortas con tono propio de cada personaje
  talk: (a, t, v, p) => {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = 330 * p * (0.85 + Math.random() * 0.4);
      a.tone(t + i * 0.075, f, 0.06, { type: 'square', vol: 0.035 * v, filter: 1600, slide: f * 0.92 });
    }
  },
  oven: (a, t, v) => {
    a.tone(t, 1400, 0.12, { vol: 0.08 * v });
    a.tone(t + 0.1, 1050, 0.25, { vol: 0.08 * v });
  },
  mission: (a, t, v) => {
    [784, 988, 1175, 1568].forEach((f, i) => a.tone(t + i * 0.07, f, 0.22, { type: 'square', vol: 0.05 * v, filter: 4000 }));
    a.tone(t + 0.3, 2093, 0.5, { vol: 0.08 * v });
  },
  levelup: (a, t, v) => {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => a.tone(t + i * 0.11, f, 0.4, { type: 'triangle', vol: 0.2 * v }));
    a.noise(t + 0.6, 0.6, { vol: 0.08 * v, freq: 8000, type: 'highpass' });
  },
};

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.last = {};
    this.muted = false;
    try { this.muted = localStorage.getItem('melas-farm-muted') === '1'; } catch { /* sin storage */ }

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  /** Crea/reanuda el AudioContext. Debe llamarse desde un gesto del usuario. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 1;
      this.sfx.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0.3;
      this.music.connect(this.master);

      // Buffer de ruido blanco reutilizable
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('melas-farm-muted', m ? '1' : '0'); } catch { /* sin storage */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  toggle() { this.setMuted(!this.muted); return this.muted; }

  /**
   * Reproduce un efecto.
   * @param {string} name
   * @param {{pos?: {x:number,z:number}, pitch?: number, volume?: number}} opts
   */
  play(name, { pos = null, pitch = 1, volume = 1 } = {}) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if ((this.last[name] ?? -10) + (MIN_GAP[name] ?? 0.03) > now) return;
    let v = volume;
    const p = this.game.player?.position;
    if (pos && p) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      v *= Math.max(0, Math.min(1, 1 - (d - 7) / 9)); // se apaga entre 7 y 16 unidades
      if (v <= 0.02) return;
    }
    this.last[name] = now;
    SFX[name]?.(this, now, v, pitch);
  }

  // ---------- Primitivas de síntesis ----------
  tone(t, freq, dur, { type = 'sine', vol = 0.2, attack = 0.005, slide = null, filter = null, dest = this.sfx } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t, dur, { vol = 0.2, freq = 2000, type = 'bandpass', q = 1, dest = this.sfx } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  // ---------- Música ----------
  startMusic() {
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.15;
    setInterval(() => this.schedule(), 25);
  }

  schedule() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05; // tras pausa
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (!this.muted) this.playStep(this.step, this.nextTime);
      this.nextTime += EIGHTH;
      this.step = (this.step + 1) % MELODY.length;
    }
  }

  playStep(s, t) {
    const dest = this.music;
    const bar = Math.floor(s / 8);
    const beat = s % 8;
    const chord = PROG[bar];
    // Bajo: tónica y quinta
    if (beat === 0 || beat === 4) {
      this.tone(t, NOTE(beat === 0 ? chord.bass : chord.bass + 7), 0.32, { type: 'triangle', vol: 0.35, dest });
      this.tone(t, 110, 0.1, { vol: 0.25, slide: 45, dest }); // "bombo" suave
    }
    // Acordes en contratiempo (rasgueo)
    if (beat % 2 === 1) {
      chord.notes.forEach((n, i) => this.tone(t + i * 0.008, NOTE(n), 0.14, { type: 'square', vol: 0.03, filter: 1400, dest }));
    }
    // Melodía
    const m = MELODY[s];
    if (m) {
      this.tone(t, NOTE(m), 0.28, { type: 'triangle', vol: 0.15, dest });
      this.tone(t, NOTE(m + 12), 0.12, { vol: 0.03, dest });
    }
    // Shaker
    this.noise(t, 0.04, { vol: beat % 2 ? 0.05 : 0.025, freq: 7000, type: 'highpass', dest });
  }
}
