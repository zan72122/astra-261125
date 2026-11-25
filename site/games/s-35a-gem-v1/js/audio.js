// Web Audio procedural sound engine for こやぎの もぐもぐ
(function () {
  'use strict';

  class KoyagiAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
      this.unlocked = false;
      this.breezeGain = null;
      this.birdTimer = null;
    }

    unlock() {
      if (this.unlocked && this.ctx && this.ctx.state === 'running') return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!this.ctx) {
          this.ctx = new AudioCtx();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.72;
          this.master.connect(this.ctx.destination);
          this._createNoiseBuffer();
          this._startAmbientBreeze();
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.unlocked = true;
      } catch (e) {
        // Ignore audio init errors in restricted environments
      }
    }

    _createNoiseBuffer() {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 1.4;
      }
      this.noiseBuffer = buffer;
    }

    _startAmbientBreeze() {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 380;
      filter.Q.value = 0.7;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const gain = this.ctx.createGain();
      gain.gain.value = 0.022;
      this.breezeGain = gain;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      src.start();
      lfo.start();

      // Occasional gentle distant afternoon meadow birdsong
      const scheduleBird = () => {
        if (!this.ctx) return;
        const delay = 5500 + Math.random() * 9000;
        this.birdTimer = setTimeout(() => {
          if (this.ctx && this.ctx.state === 'running' && document.visibilityState !== 'hidden') {
            this._playDistantBird();
          }
          scheduleBird();
        }, delay);
      };
      scheduleBird();
    }

    _playDistantBird() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const base = 2400 + Math.random() * 900;
      const chirps = Math.random() < 0.5 ? 2 : 3;
      for (let i = 0; i < chirps; i++) {
        const t = now + i * 0.16;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * 1.24, t + 0.06);
        osc.frequency.exponentialRampToValueAtTime(base * 0.94, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.015, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.14);
      }
    }

    // Dry hay rustling (さらさら)
    playHayRustle(intensity = 0.7, duration = 0.24) {
      if (!this.ctx || this.ctx.state !== 'running' || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      const bursts = Math.max(2, Math.round(2 + intensity * 3));
      for (let i = 0; i < bursts; i++) {
        const offset = (i / bursts) * duration * 0.7 + Math.random() * 0.02;
        const t = now + offset;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800 + Math.random() * 1400;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3400 + Math.random() * 2400;
        bp.Q.value = 1.6;

        const gain = this.ctx.createGain();
        const peak = (0.07 + intensity * 0.11) * (0.7 + Math.random() * 0.4);
        const len = 0.055 + Math.random() * 0.075;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + len);

        src.connect(hp);
        hp.connect(bp);
        bp.connect(gain);
        gain.connect(this.master);

        src.start(t, Math.random() * 1.4, len + 0.03);
      }
    }

    // Hay landing on trough (faster drop -> brighter scatter)
    playHayDrop(speed = 0.5) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const clamped = Math.min(1.5, Math.max(0.2, speed));
      this.playHayRustle(0.55 + clamped * 0.55, 0.28 + clamped * 0.12);
      // Soft wooden trough pat
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(145 + clamped * 35, now);
      osc.frequency.exponentialRampToValueAtTime(72, now + 0.08);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.05 + clamped * 0.04, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    // Soft hay chewing sound (もぐもぐ)
    playChewSoft() {
      if (!this.ctx || this.ctx.state !== 'running' || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1100 + Math.random() * 600, now);
      bp.frequency.exponentialRampToValueAtTime(650, now + 0.09);
      bp.Q.value = 2.4;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.055, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 1.5, 0.12);
    }

    // Crisp carrot crunch (ぽりぽり)
    playCarrotBite() {
      if (!this.ctx || this.ctx.state !== 'running' || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      // 3 micro-fracture snaps for crisp vegetable crunch
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.026 + Math.random() * 0.01;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1850 + i * 650 + Math.random() * 400;
        bp.Q.value = 2.2;

        const g = this.ctx.createGain();
        const peak = i === 0 ? 0.24 : 0.14;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start(t, Math.random() * 1.5, 0.07);
      }

      // Crisp woody snap resonance
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.045);
      og.gain.setValueAtTime(0.001, now);
      og.gain.linearRampToValueAtTime(0.11, now + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(og);
      og.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.06);
    }

    // Small hoof tap on grass/dirt (蹄の小刻みな音)
    playHoofStep(isMother = false) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const baseFreq = isMother ? 115 : 185 + Math.random() * 35;

      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.42, now + 0.055);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(isMother ? 0.095 : 0.055, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.07);

      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'bandpass';
        lp.frequency.value = isMother ? 650 : 1050;
        lp.Q.value = 1.4;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.linearRampToValueAtTime(isMother ? 0.045 : 0.03, now + 0.004);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        src.connect(lp);
        lp.connect(ng);
        ng.connect(this.master);
        src.start(now, Math.random() * 1.4, 0.06);
      }
    }

    // Drinking water (ちゅっちゅ)
    playWaterSip() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.15;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        const f0 = 320 + Math.random() * 70;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + 0.065);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + 0.11);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.075, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.115);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.13);
      }
    }

    // Water droplet dripping from chin
    playWaterDrip() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const f = 920 + Math.random() * 340;
      osc.frequency.setValueAtTime(f * 0.72, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, now + 0.048);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.048, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.07);
    }

    // Pushing tin water bucket (tin resonance + water slosh)
    playWaterSlosh() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      // Dull tin ring
      const tin = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      tin.type = 'triangle';
      tin.frequency.setValueAtTime(295, now);
      tin.frequency.exponentialRampToValueAtTime(240, now + 0.18);
      tg.gain.setValueAtTime(0.0001, now);
      tg.gain.linearRampToValueAtTime(0.055, now + 0.01);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      tin.connect(tg);
      tg.connect(this.master);
      tin.start(now);
      tin.stop(now + 0.24);

      // Liquid slosh noise
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(480, now);
        bp.frequency.exponentialRampToValueAtTime(1150, now + 0.12);
        bp.frequency.exponentialRampToValueAtTime(520, now + 0.3);
        bp.Q.value = 3.2;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.linearRampToValueAtTime(0.11, now + 0.05);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        src.start(now, Math.random() * 1.2, 0.36);
      }
    }

    // Wooden gate creak
    playGateCreak() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.linearRampToValueAtTime(225, now + 0.16);
      osc.frequency.linearRampToValueAtTime(190, now + 0.32);

      filter.type = 'bandpass';
      filter.frequency.value = 540;
      filter.Q.value = 6.0;

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.38);
    }

    // Basket wood thump / tilt
    playBasketWood() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(92, now + 0.1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.085, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    // Gentle authentic goat bleat (めぇ)
    playSoftBleat(pitchScale = 1.0) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const f1 = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = 'sawtooth';
      const baseF = 330 * pitchScale;
      osc.frequency.setValueAtTime(baseF * 0.96, now);
      osc.frequency.linearRampToValueAtTime(baseF * 1.08, now + 0.09);
      osc.frequency.linearRampToValueAtTime(baseF * 0.91, now + 0.34);

      lfo.type = 'sine';
      lfo.frequency.value = 18 * (pitchScale > 0.8 ? 1.05 : 0.85);
      lfoGain.gain.value = 14 * pitchScale;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(1050 * Math.sqrt(pitchScale), now);
      f1.Q.value = 3.6;

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.048, now + 0.04);
      g.gain.linearRampToValueAtTime(0.036, now + 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      osc.connect(f1);
      f1.connect(g);
      g.connect(this.master);

      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.38);
      lfo.stop(now + 0.38);
    }
  }

  window.KoyagiAudio = new KoyagiAudio();
})();
