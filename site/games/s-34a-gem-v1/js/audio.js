(function () {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.noiseBuf = null;
      this.master = null;
      this.lastPourTime = 0;
      this.lastStepTime = 0;
      this.lastSlideTime = 0;
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
          this._buildNoiseBuffer();
          this._startMorningAmbience();
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.unlocked = true;
      } catch (e) {
        // Ignore audio errors on restricted devices
      }
    }

    _buildNoiseBuffer() {
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
        data[i] = (b0 + b1 + b2 + white * 0.12) * 1.4;
      }
      this.noiseBuf = buf;
    }

    _startMorningAmbience() {
      if (!this.ctx || !this.noiseBuf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 480;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.018;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
    }

    _noiseBurst(duration, freq, Q, volume, filterType) {
      if (!this.ctx || !this.noiseBuf || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const offset = Math.random() * 1.5;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType || 'bandpass';
      filter.frequency.setValueAtTime(freq, t);
      filter.Q.value = Q || 2.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.008, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t, offset, duration + 0.02);
    }

    // 粟がさらさらとこぼれる音
    playMilletPour(intensity) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (now - this.lastPourTime < 0.055) return;
      this.lastPourTime = now;
      const vol = Math.min(0.14, 0.04 + (intensity || 0.5) * 0.09);
      this._noiseBurst(0.075, 4200 + Math.random() * 1600, 1.8, vol, 'bandpass');
    }

    // 粟の一粒が皿・わら・石に落ちる小さな音
    playGrainLand(surface) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      if (surface === 'dish' || surface === 'stone') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const baseFreq = surface === 'dish' ? 2300 + Math.random() * 900 : 1850 + Math.random() * 700;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, t + 0.028);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.055, t + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);

        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.038);
      } else {
        // Soft dry straw patter
        this._noiseBurst(0.032, 3100 + Math.random() * 1100, 2.4, 0.045, 'bandpass');
      }
    }

    // くちばしのつんつん
    playPeck(surface) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const f = surface === 'dish' || surface === 'stone' ? 1650 + Math.random() * 350 : 920 + Math.random() * 240;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.025);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.085, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.035);

      this._noiseBurst(0.02, 2600, 2.2, 0.03, 'highpass');
    }

    // ひよこの可愛い鳴き声（3羽それぞれ少し違う高さ）
    playChirp(chickIndex, mood) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const pitchShift = chickIndex === 0 ? 1.07 : chickIndex === 1 ? 1.0 : 0.93;
      const notes = mood === 'happy' ? 2 : mood === 'sleepy' ? 1 : (Math.random() < 0.45 ? 2 : 1);

      for (let i = 0; i < notes; i++) {
        const st = t + i * 0.115;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const base = (mood === 'sleepy' ? 2350 : 2850 + Math.random() * 220) * pitchShift;
        const dur = mood === 'sleepy' ? 0.14 : 0.085;

        osc.type = 'sine';
        osc2.type = 'triangle';

        osc.frequency.setValueAtTime(base * 0.86, st);
        osc.frequency.exponentialRampToValueAtTime(base * 1.16, st + dur * 0.35);
        osc.frequency.exponentialRampToValueAtTime(base * 0.92, st + dur);

        osc2.frequency.setValueAtTime(base * 1.72, st);
        osc2.frequency.exponentialRampToValueAtTime(base * 2.25, st + dur * 0.35);
        osc2.frequency.exponentialRampToValueAtTime(base * 1.84, st + dur);

        const g2 = this.ctx.createGain();
        g2.gain.value = 0.12;

        const peak = mood === 'sleepy' ? 0.038 : 0.072;
        gain.gain.setValueAtTime(0.0001, st);
        gain.gain.linearRampToValueAtTime(peak, st + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, st + dur + 0.015);

        osc.connect(gain);
        osc2.connect(g2);
        g2.connect(gain);
        gain.connect(this.master);

        osc.start(st);
        osc2.start(st);
        osc.stop(st + dur + 0.025);
        osc2.stop(st + dur + 0.025);
      }
    }

    // わらのきしみ・足でかき分ける音
    playStrawRustle(strength) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const vol = 0.04 + (strength || 0.5) * 0.06;
      this._noiseBurst(0.14, 2100 + Math.random() * 700, 1.4, vol, 'bandpass');
      setTimeout(() => {
        if (this.ctx && this.ctx.state === 'running') {
          this._noiseBurst(0.09, 2800 + Math.random() * 600, 1.8, vol * 0.65, 'bandpass');
        }
      }, 45);
    }

    // 小さな足音
    playFootstep(onGrass) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (now - this.lastStepTime < 0.07) return;
      this.lastStepTime = now;
      this._noiseBurst(0.024, onGrass ? 1500 : 2400, 2.2, 0.018, 'bandpass');
    }

    // 水を飲むこくん＋小さな水音
    playWaterSip() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      // Soft water dip ripple
      const dip = this.ctx.createOscillator();
      const dipGain = this.ctx.createGain();
      dip.type = 'sine';
      dip.frequency.setValueAtTime(680, t);
      dip.frequency.exponentialRampToValueAtTime(1180, t + 0.065);
      dipGain.gain.setValueAtTime(0.0001, t);
      dipGain.gain.linearRampToValueAtTime(0.055, t + 0.012);
      dipGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      dip.connect(dipGain);
      dipGain.connect(this.master);
      dip.start(t);
      dip.stop(t + 0.1);

      // Gentle "kokun" gulp ~0.26s later when head lifts
      const gt = t + 0.28;
      const gulp = this.ctx.createOscillator();
      const gGain = this.ctx.createGain();
      gulp.type = 'sine';
      gulp.frequency.setValueAtTime(520, gt);
      gulp.frequency.exponentialRampToValueAtTime(290, gt + 0.055);
      gulp.frequency.exponentialRampToValueAtTime(460, gt + 0.105);
      gGain.gain.setValueAtTime(0.0001, gt);
      gGain.gain.linearRampToValueAtTime(0.075, gt + 0.018);
      gGain.gain.exponentialRampToValueAtTime(0.0001, gt + 0.12);
      gulp.connect(gGain);
      gGain.connect(this.master);
      gulp.start(gt);
      gulp.stop(gt + 0.13);
    }

    // はこべの葉がちぎれる小さな音
    playLeafTear() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      this._noiseBurst(0.065, 3600, 1.6, 0.07, 'bandpass');
      this._noiseBurst(0.04, 5200, 2.2, 0.045, 'highpass');
    }

    // お母さんめんどりの優しい声・とんとん
    playHenCluck(type) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      if (type === 'call') {
        // Gentle tidbitting double cluck "koko, koko"
        for (let i = 0; i < 2; i++) {
          const st = t + i * 0.16;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(340, st);
          osc.frequency.exponentialRampToValueAtTime(480, st + 0.035);
          osc.frequency.exponentialRampToValueAtTime(260, st + 0.095);
          gain.gain.setValueAtTime(0.0001, st);
          gain.gain.linearRampToValueAtTime(0.09, st + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.11);
          osc.connect(gain);
          gain.connect(this.master);
          osc.start(st);
          osc.stop(st + 0.12);
        }
      } else if (type === 'fluff') {
        // Soft warm feather puff + purring coo
        this._noiseBurst(0.22, 950, 1.1, 0.075, 'bandpass');
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.exponentialRampToValueAtTime(210, t + 0.28);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.06, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.32);
      } else {
        // Soft beak tap on floor
        this.playPeck('straw');
      }
    }

    // 木戸を横に引く音・陶器皿を押す音
    playWoodSlide(speed) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (now - this.lastSlideTime < 0.085) return;
      this.lastSlideTime = now;
      const vol = Math.min(0.09, 0.025 + (speed || 0.4) * 0.05);
      this._noiseBurst(0.11, 560 + Math.random() * 180, 1.5, vol, 'bandpass');
    }

    playCeramicSlide(speed) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (now - this.lastSlideTime < 0.09) return;
      this.lastSlideTime = now;
      const vol = Math.min(0.065, 0.02 + (speed || 0.3) * 0.04);
      this._noiseBurst(0.09, 1300 + Math.random() * 240, 2.5, vol, 'bandpass');
    }
  }

  window.SoundEngine = SoundEngine;
})();
