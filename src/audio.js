// All sound is synthesized with the Web Audio API, so there are no audio files to license.
// Swap in recorded sounds later (e.g. Kenney or freesound.org) by replacing these functions.
(function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  let muted = false;
  let noiseBuf = null;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.45; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  const now = () => ctx.currentTime;

  function out(pan) {
    if (pan === undefined || !ctx.createStereoPanner) return sfxBus;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(sfxBus);
    return p;
  }

  function env(gainNode, t, a, peak, dur) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone({ type = 'square', f0 = 440, f1 = null, dur = 0.15, vol = 0.2, delay = 0, pan, attack = 0.005 }) {
    const t = now() + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, attack, vol, dur);
    o.connect(g); g.connect(out(pan));
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.2, type = 'lowpass', f0 = 800, f1 = null, q = 1, delay = 0, pan, attack = 0.005 }) {
    const t = now() + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, attack, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(out(pan));
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const SFX = {
    till: () => { noise({ dur: 0.12, vol: 0.35, f0: 600, f1: 200 }); tone({ type: 'sine', f0: 120, f1: 60, dur: 0.1, vol: 0.25 }); },
    water: () => { noise({ dur: 0.4, vol: 0.12, type: 'bandpass', f0: 2500, f1: 1200, q: 2, attack: 0.05 }); },
    plant: () => { tone({ f0: 520, f1: 700, dur: 0.07, vol: 0.08 }); },
    harvest: () => { tone({ f0: 660, dur: 0.07, vol: 0.1 }); tone({ f0: 990, dur: 0.12, vol: 0.1, delay: 0.07 }); },
    coin: () => { tone({ f0: 990, dur: 0.06, vol: 0.08 }); tone({ f0: 1320, dur: 0.1, vol: 0.08, delay: 0.06 }); },
    place: () => { tone({ type: 'triangle', f0: 200, f1: 90, dur: 0.12, vol: 0.3 }); noise({ dur: 0.06, vol: 0.15, f0: 1200 }); },
    error: () => { tone({ type: 'square', f0: 110, dur: 0.15, vol: 0.08 }); },
    swing: () => { noise({ dur: 0.12, vol: 0.12, type: 'highpass', f0: 800, f1: 3000, attack: 0.02 }); },
    hit: (pan) => { noise({ dur: 0.1, vol: 0.3, f0: 1500, f1: 300, pan }); tone({ type: 'sine', f0: 160, f1: 50, dur: 0.15, vol: 0.3, pan }); },
    hurt: () => { tone({ type: 'square', f0: 400, f1: 120, dur: 0.3, vol: 0.12 }); noise({ dur: 0.2, vol: 0.15, f0: 900 }); },
    caw: (pan) => {
      [0, 0.22].forEach((d) => {
        tone({ type: 'sawtooth', f0: 820, f1: 430, dur: 0.18, vol: 0.06, delay: d, pan, attack: 0.01 });
        noise({ dur: 0.18, vol: 0.08, type: 'bandpass', f0: 1400, f1: 900, q: 3, delay: d, pan });
      });
    },
    flap: (pan) => { noise({ dur: 0.08, vol: 0.06, type: 'bandpass', f0: 600, q: 1, pan }); noise({ dur: 0.08, vol: 0.05, type: 'bandpass', f0: 500, q: 1, delay: 0.1, pan }); },
    groan: (pan) => {
      const t = now();
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95 + Math.random() * 20, t);
      o.frequency.linearRampToValueAtTime(70, t + 1.1);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
      const lg = ctx.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 6;
      const g = ctx.createGain(); env(g, t, 0.25, 0.16, 1.2);
      o.connect(fl); fl.connect(g); g.connect(out(pan));
      o.start(t); lfo.start(t); o.stop(t + 1.3); lfo.stop(t + 1.3);
    },
    rise: (pan) => { noise({ dur: 0.9, vol: 0.2, f0: 300, f1: 120, pan, attack: 0.2 }); },
    zombieDie: (pan) => { tone({ type: 'sawtooth', f0: 140, f1: 40, dur: 0.6, vol: 0.12, pan }); noise({ dur: 0.4, vol: 0.2, f0: 500, f1: 100, pan }); },
    crunch: (pan) => { noise({ dur: 0.07, vol: 0.12, type: 'bandpass', f0: 1800, q: 2, pan }); },
    bell: () => {
      [1, 2.4, 3.9].forEach((m, i) => tone({ type: 'sine', f0: 220 * m, dur: 2.5 - i * 0.6, vol: 0.12 / (i + 1), attack: 0.005 }));
    },
    dawn: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.5, vol: 0.08, delay: i * 0.12 })); },
    gameOver: () => { [220, 207, 196, 147].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.6, vol: 0.07, delay: i * 0.35 })); }
  };

  // ---------- Simple generative music ----------
  const Music = {
    mode: 'off', timer: null, nightNodes: null, dayGain: null,
    set(mode) {
      if (!ctx || mode === this.mode) return;
      this.mode = mode;
      clearInterval(this.timer); this.timer = null;
      this.stopNight();
      if (mode === 'day') this.startDay();
      if (mode === 'night') this.startNight();
    },
    startDay() {
      // Gentle pentatonic plucks
      const scale = [392, 440, 523, 587, 659, 784, 880];
      let step = 0;
      this.timer = setInterval(() => {
        if (muted) return;
        step++;
        if (Math.random() < 0.6) {
          const f = scale[Math.floor(Math.random() * scale.length)];
          const t = now();
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
          const g = ctx.createGain(); env(g, t, 0.01, 0.07, 0.9);
          o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1);
        }
        if (step % 8 === 0) {
          const t = now();
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 196;
          const g = ctx.createGain(); env(g, t, 0.05, 0.08, 1.6);
          o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1.7);
        }
      }, 400);
    },
    startNight() {
      const t = now();
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 4);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 260; fl.Q.value = 4;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(fl.frequency);
      const oscs = [55, 55.7, 82.4].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(fl); o.start(t); return o; });
      fl.connect(g); g.connect(musicBus); lfo.start(t);
      this.nightNodes = { g, oscs, lfo };
      // Occasional dissonant music-box chime
      this.timer = setInterval(() => {
        if (muted || Math.random() < 0.55) return;
        const base = [466, 494, 622, 740][Math.floor(Math.random() * 4)];
        tone({ type: 'sine', f0: base, dur: 1.6, vol: 0.05 });
        tone({ type: 'sine', f0: base * 1.06, dur: 1.6, vol: 0.03, delay: 0.25 });
      }, 1800);
    },
    stopNight() {
      if (!this.nightNodes) return;
      const { g, oscs, lfo } = this.nightNodes;
      const t = now();
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
      oscs.forEach((o) => o.stop(t + 2.1)); lfo.stop(t + 2.1);
      this.nightNodes = null;
    }
  };

  FH.Audio = {
    unlock() {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    play(name, pan) {
      if (!ctx || muted || !SFX[name]) return;
      try { SFX[name](pan); } catch (e) { /* audio is best-effort */ }
    },
    music(mode) { if (ctx) Music.set(mode); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.7;
      return muted;
    },
    get muted() { return muted; }
  };
})();
