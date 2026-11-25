(function () {
  'use strict';

  class PokapokaAudio {
    constructor() {
      this.ctx = null;
      this.noiseBuffer = null;
      this.master = null;
      this.ambientGain = null;
      this.pourGain = null;
      this.pourFilter = null;
      this.started = false;
      this.lastBonkTime = 0;
    }

    unlock() {
      if (this.started) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.72;
        this.master.connect(this.ctx.destination);

        // Create reusable 2-second pink-ish noise buffer
        const sr = this.ctx.sampleRate;
        const len = sr * 2;
        const buf = this.ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.950 * b2 + white * 0.048;
          data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.14) * 1.4));
        }
        this.noiseBuffer = buf;

        this._startAmbient();
        this._setupPourStream();
        this.started = true;
      } catch (e) {
        // Ignore if audio unavailable
      }
    }

    _startAmbient() {
      // Very gentle warm bath murmur
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      filter.Q.value = 0.8;

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.055, this.ctx.currentTime + 1.8);

      src.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.master);
      src.start();
    }

    _setupPourStream() {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      this.pourFilter = this.ctx.createBiquadFilter();
      this.pourFilter.type = 'bandpass';
      this.pourFilter.frequency.value = 920;
      this.pourFilter.Q.value = 1.6;

      this.pourGain = this.ctx.createGain();
      this.pourGain.gain.value = 0.0001;

      src.connect(this.pourFilter);
      this.pourFilter.connect(this.pourGain);
      this.pourGain.connect(this.master);
      src.start();
    }

    setPourLevel(amount) {
      if (!this.started || !this.pourGain) return;
      const now = this.ctx.currentTime;
      const target = Math.max(0.0001, Math.min(0.24, amount * 0.22));
      this.pourGain.gain.setTargetAtTime(target, now, 0.1);
      this.pourFilter.frequency.setTargetAtTime(780 + amount * 420 + Math.sin(now * 5.2) * 80, now, 0.08);
      if (amount > 0.25 && Math.random() < 0.16) {
        this.playWaterRipple(0.22 * amount, 1.35 + Math.random() * 0.45);
      }
    }

    // Crisp apple crunch ("かりっ")
    playAppleCrunch(isBaby) {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const pitchMul = isBaby ? 1.24 : 1.0;

      // Two-stage crisp fracture burst
      [0, 0.042].forEach((offset, idx) => {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime((idx === 0 ? 2200 : 1650) * pitchMul, now + offset);
        bp.Q.value = 1.9;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 780 * pitchMul;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.linearRampToValueAtTime(idx === 0 ? 0.34 : 0.22, now + offset + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.085);

        src.connect(bp);
        bp.connect(hp);
        hp.connect(g);
        g.connect(this.master);

        src.start(now + offset, Math.random() * 1.4, 0.11);
      });

      // Short crisp snap harmonic
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680 * pitchMul, now);
      osc.frequency.exponentialRampToValueAtTime(240 * pitchMul, now + 0.045);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.11, now);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(og);
      og.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.055);
    }

    // Soft side-to-side chewing munch ("もぐもぐ")
    playChew(isLeaf, isBaby) {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const pitchMul = isBaby ? 1.2 : 1.0;

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime((isLeaf ? 2600 : 1350) * pitchMul, now);
      bp.Q.value = isLeaf ? 1.5 : 2.2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(isLeaf ? 0.14 : 0.11, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (isLeaf ? 0.095 : 0.075));

      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 1.5, 0.12);
    }

    // Water plop / small wave ("ちゃぽん / ぴちゃ")
    playWaterRipple(intensity, pitchScale) {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const amp = Math.max(0.05, Math.min(1, intensity || 0.5));
      const p = pitchScale || 1.0;

      // Resonant upward water-drop pitch sweep
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const baseF = (210 + Math.random() * 65) * p;
      osc.frequency.setValueAtTime(baseF, now);
      osc.frequency.exponentialRampToValueAtTime(baseF * 2.15, now + 0.095);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.16 * amp, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.15);

      // Soft splash shimmer
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 650 * p;
      bp.Q.value = 1.2;

      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(0.10 * amp, now + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      src.start(now, Math.random() * 1.4, 0.24);
    }

    // Yuzu floating gently bumping together ("ことん / ぽこん")
    playYuzuBonk(strength) {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      if (now - this.lastBonkTime < 0.09) return;
      this.lastBonkTime = now;

      const amp = Math.max(0.06, Math.min(1, strength || 0.45));
      const f = 265 + Math.random() * 70;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 1.18, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.88, now + 0.07);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.14 * amp, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.09);
    }

    // Gentle nose exhale ("ふーっ")
    playNoseExhale(isBaby) {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(isBaby ? 640 : 440, now);
      lp.frequency.linearRampToValueAtTime(isBaby ? 420 : 280, now + 0.48);
      lp.Q.value = 1.4;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.085, now + 0.11);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      src.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 1.1, 0.6);
    }

    // Soft dry bamboo basket rustle / stone place
    playBasketTouch() {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1480;
      bp.Q.value = 2.4;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 1.4, 0.13);
    }

    playStoneSet() {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.055);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.065);
    }

    // Gentle soft nose-to-nose bump on shared cabbage ("こつん")
    playNoseBoop() {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.10, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  }

  window.PokapokaAudio = PokapokaAudio;
})();
