(function (global) {
  'use strict';

  class OtterAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.ambientGain = null;
      this.ambientFilter = null;
      this.noiseBuffer = null;
      this.unlocked = false;
      this.underwaterMix = 0;
    }

    unlock() {
      if (this.unlocked && this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.72;
        this.master.connect(this.ctx.destination);

        this.noiseBuffer = this._createNoiseBuffer(2.0);
        this._startAmbientWater();
        this.unlocked = true;
      } catch (_) {
        // Audio unavailable
      }
    }

    _createNoiseBuffer(seconds) {
      const rate = this.ctx.sampleRate;
      const length = Math.floor(rate * seconds);
      const buffer = this.ctx.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        // Soft pink-ish water noise
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.12) * 0.65;
      }
      return buffer;
    }

    _startAmbientWater() {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.045;

      // Gentle LFO to breathe like sunlit pool ripples
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.22;
      lfoGain.gain.value = 110;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();

      this.ambientFilter = filter;
      this.ambientGain = gain;
    }

    setUnderwater(amount) {
      this.underwaterMix = Math.max(0, Math.min(1, amount));
      if (!this.ctx || !this.ambientFilter || !this.ambientGain) return;
      const now = this.ctx.currentTime;
      const freq = 420 - this.underwaterMix * 240;
      const vol = 0.045 + this.underwaterMix * 0.04;
      this.ambientFilter.frequency.setTargetAtTime(freq, now, 0.15);
      this.ambientGain.gain.setTargetAtTime(vol, now, 0.15);
    }

    // Soft shell pickup clink from bucket
    playPickup(isScallop) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const base = isScallop ? 720 : 960;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.28, now + 0.055);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    // Splash sound scaled by drop height (0..1) and shell size
    playSplash(intensity = 0.5, isBig = false) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const clamped = Math.max(0.12, Math.min(1.0, intensity));
      const sizeScale = isBig ? 1.2 : 1.0;

      // 1. Resonant water cavity "pochan" bloop
      const bloop = this.ctx.createOscillator();
      const bloopGain = this.ctx.createGain();
      bloop.type = 'sine';
      const startFreq = (isBig ? 165 : 235) + (1 - clamped) * 75;
      const endFreq = (isBig ? 430 : 620) + (1 - clamped) * 140;
      bloop.frequency.setValueAtTime(startFreq, now + 0.015);
      bloop.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

      bloopGain.gain.setValueAtTime(0.0001, now);
      bloopGain.gain.linearRampToValueAtTime(0.24 * clamped * sizeScale, now + 0.025);
      bloopGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);

      bloop.connect(bloopGain);
      bloopGain.connect(this.master);
      bloop.start(now);
      bloop.stop(now + 0.18);

      // 2. Filtered water splash spray
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100 + clamped * 900, now);
      filter.frequency.exponentialRampToValueAtTime(480, now + 0.28 + clamped * 0.18);
      filter.Q.value = 1.1;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.22 * clamped * sizeScale, now + 0.018);
      nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.30 + clamped * 0.22);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.master);
      noise.start(now, Math.random() * 1.1, 0.55);

      // 3. Secondary water droplets ("picha-picha") for higher drops
      const dropCount = clamped > 0.55 ? 3 : 1;
      for (let i = 0; i < dropCount; i++) {
        const delay = 0.08 + i * 0.055 + Math.random() * 0.04;
        this._playDroplet(now + delay, 0.05 + clamped * 0.06);
      }
    }

    _playDroplet(when, amp) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const f = 540 + Math.random() * 420;
      osc.frequency.setValueAtTime(f, when);
      osc.frequency.exponentialRampToValueAtTime(f * 1.75, when + 0.05);

      gain.gain.setValueAtTime(0.0005, when);
      gain.gain.linearRampToValueAtTime(amp, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0005, when + 0.065);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.07);
    }

    // Gentle small water stir (otter paddling / surfacing / stone lifting)
    playWaterStir(amp = 0.11) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(580, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.25);
      filter.Q.value = 0.9;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.30);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      noise.start(now, Math.random() * 1.2, 0.35);
    }

    // "Kon-kon" shell knocking against flat stone or rock
    playStoneKnock(isRock = false) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const jitter = 0.94 + Math.random() * 0.12;

      // Body knock resonance (dual modal oscillators for crisp wet stone timbre)
      const freqs = isRock ? [520 * jitter, 1180 * jitter] : [760 * jitter, 1680 * jitter];
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f * 1.08, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + 0.055);

        const peak = idx === 0 ? 0.22 : 0.12;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + (idx === 0 ? 0.065 : 0.042));

        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.075);
      });

      // Crisp transient click
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = isRock ? 1800 : 2500;
      bp.Q.value = 2.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.18, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      noise.start(now, Math.random(), 0.04);
    }

    // "Paka!" clean shell cracking open
    playShellCrack(isScallop = false) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Sharp ceramic/calcite snap
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(isScallop ? 1900 : 2600, now);
      hp.Q.value = 1.6;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.28, now + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(this.master);
      noise.start(now, Math.random(), 0.1);

      // Hollow shell opening pop
      const pop = this.ctx.createOscillator();
      const pg = this.ctx.createGain();
      pop.type = 'sine';
      const base = isScallop ? 680 : 920;
      pop.frequency.setValueAtTime(base, now + 0.006);
      pop.frequency.exponentialRampToValueAtTime(base * 1.42, now + 0.06);
      pg.gain.setValueAtTime(0.001, now + 0.006);
      pg.gain.linearRampToValueAtTime(0.15, now + 0.015);
      pg.gain.exponentialRampToValueAtTime(0.0008, now + 0.09);
      pop.connect(pg);
      pg.connect(this.master);
      pop.start(now + 0.006);
      pop.stop(now + 0.1);
    }

    // Soft munching or baby gentle sip
    playEat(isBaby = false) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (isBaby) {
        // Gentle "chu" soft sip
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(860, now + 0.075);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.085, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.1);
      } else {
        // Soft muffled "mogu" chew
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'bandpass';
        lp.frequency.value = 620 + Math.random() * 180;
        lp.Q.value = 1.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.07, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        noise.connect(lp);
        lp.connect(g);
        g.connect(this.master);
        noise.start(now, Math.random(), 0.1);
      }
    }

    // Underwater dive bubbles
    playBubbles(count = 4) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < count; i++) {
        const t = now + i * 0.065 + Math.random() * 0.04;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        const f = 320 + Math.random() * 380;
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.07);
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(0.055, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.085);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.09);
      }
    }

    // Soft stone placement onto otter belly
    playStonePlace() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.12);
      this.playWaterStir(0.08);
    }
  }

  global.OtterAudio = OtterAudio;
})(window);
