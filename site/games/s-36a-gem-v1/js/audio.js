(function (global) {
  'use strict';

  class ForestAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.ambienceStarted = false;
      this.unlocked = false;
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.72;
        this.master.connect(this.ctx.destination);
        this.noiseBuf = this._createNoiseBuffer(2.0);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;
      if (!this.ambienceStarted) {
        this.ambienceStarted = true;
        this._startAmbience();
      }
    }

    _createNoiseBuffer(seconds) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    _startAmbience() {
      if (!this.ctx || !this.noiseBuf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 620;
      filter.Q.value = 0.85;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 210;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const gain = this.ctx.createGain();
      gain.gain.value = 0.022;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      src.start();
      lfo.start();
    }

    // Dry woody "koron" knock when an acorn or walnut lands/rolls on the stump
    playNutDrop(kind = 'acorn', strength = 1.0) {
      if (!this.unlocked || !this.ctx) return;
      const t = this.ctx.currentTime;
      const amp = Math.min(1, Math.max(0.2, strength));

      const baseFreq = kind === 'walnut' ? 330 : kind === 'seed' ? 760 : 490;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc2.type = 'sine';
      const pitchJitter = 0.93 + Math.random() * 0.15;
      osc.frequency.setValueAtTime(baseFreq * pitchJitter * 1.18, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * pitchJitter * 0.72, t + 0.055);
      osc2.frequency.setValueAtTime(baseFreq * pitchJitter * 2.1, t);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * pitchJitter * 1.4, t + 0.035);

      const peak = (kind === 'seed' ? 0.09 : kind === 'walnut' ? 0.26 : 0.21) * amp;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'walnut' ? 0.095 : 0.07));

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.11);
      osc2.stop(t + 0.09);

      // Dry surface tap click
      if (this.noiseBuf) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = kind === 'walnut' ? 1400 : 2100;
        bp.Q.value = 2.4;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t);
        ng.gain.linearRampToValueAtTime(0.11 * amp, t + 0.002);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
        n.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        n.start(t, Math.random() * 1.2, 0.04);
      }
    }

    // Subtle secondary rolling tap
    playNutRollTick(kind = 'acorn', speed = 0.5) {
      if (!this.unlocked || !this.ctx) return;
      this.playNutDrop(kind, Math.min(0.45, speed * 0.42));
    }

    // Crisp "karikari" nibbling sound
    playNibble(isWalnut = false) {
      if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
      const t = this.ctx.currentTime;
      const bursts = isWalnut ? 2 : 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < bursts; i++) {
        const offset = i * (isWalnut ? 0.055 : 0.042) + Math.random() * 0.012;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = (isWalnut ? 1750 : 2900) + Math.random() * 900;
        bp.Q.value = isWalnut ? 3.2 : 4.2;

        const g = this.ctx.createGain();
        const peak = isWalnut ? 0.17 : 0.11;
        g.gain.setValueAtTime(0.0001, t + offset);
        g.gain.linearRampToValueAtTime(peak, t + offset + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + offset + (isWalnut ? 0.036 : 0.024));

        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start(t + offset, Math.random() * 1.4, 0.05);
      }

      // Tiny tooth-shell click
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isWalnut ? 950 : 1650, t);
      osc.frequency.exponentialRampToValueAtTime(isWalnut ? 420 : 900, t + 0.022);
      og.gain.setValueAtTime(isWalnut ? 0.08 : 0.04, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      osc.connect(og);
      og.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.03);
    }

    // Satisfying shell crack when walnut finally breaks open
    playWalnutCrack() {
      if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const off = i * 0.032;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = i === 0 ? 1550 : 2400;
        bp.Q.value = 1.9;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.32 : 0.19, t + off + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.065);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start(t + off, Math.random() * 1.2, 0.08);
      }
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.06);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.07);
    }

    // Dry autumn leaf rustle / digging / brushing
    playLeafRustle(duration = 0.16, strength = 1.0) {
      if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2600 + Math.random() * 1000, t);
      bp.frequency.linearRampToValueAtTime(1800 + Math.random() * 700, t + duration);
      bp.Q.value = 1.3;

      const g = this.ctx.createGain();
      const peak = 0.13 * Math.min(1.2, strength);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + duration * 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      src.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 1.0, duration + 0.04);
    }

    // Tiny scurrying footstep on wood or leaves
    playFootstep(onLeaves = false) {
      if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = onLeaves ? 3200 + Math.random() * 900 : 1200 + Math.random() * 500;
      bp.Q.value = onLeaves ? 1.8 : 3.0;

      const g = this.ctx.createGain();
      const peak = onLeaves ? 0.055 : 0.048;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (onLeaves ? 0.032 : 0.018));

      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 1.4, 0.045);
    }

    // Soft cloth pouch drawstring rustle
    playPouchRustle(opening = true) {
      if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(opening ? 900 : 1400, t);
      bp.frequency.linearRampToValueAtTime(opening ? 1750 : 820, t + 0.14);
      bp.Q.value = 1.4;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.095, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 1.0, 0.2);
    }

    // Gentle cheek tuck pop
    playCheekTuck() {
      if (!this.unlocked || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(640, t + 0.045);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.07);
    }

    // Soft authentic chipmunk "chip!" chirp (used sparingly on greetings/curiosity)
    playChirp(pitchScale = 1.0) {
      if (!this.unlocked || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400 * pitchScale, t);
      osc.frequency.exponentialRampToValueAtTime(3450 * pitchScale, t + 0.032);
      osc.frequency.exponentialRampToValueAtTime(2100 * pitchScale, t + 0.072);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.078);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.085);
    }

    // Subtle wooden plate nudge
    playWoodSlide() {
      if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 680;
      bp.Q.value = 3.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 1.0, 0.14);
    }
  }

  global.ForestAudio = ForestAudio;
})(window);
