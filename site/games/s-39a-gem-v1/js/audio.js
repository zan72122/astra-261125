window.RPP = window.RPP || {};

RPP.Audio = (function () {
  let ctx = null;
  let noiseBuf = null;
  let ambientStarted = false;
  let masterGain = null;

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ctx.destination);
      createNoiseBuffer();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (!ambientStarted && ctx.state !== 'closed') {
      startWinterAmbience();
    }
    return ctx;
  }

  function createNoiseBuffer() {
    const length = ctx.sampleRate * 2.5;
    noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  function startWinterAmbience() {
    ambientStarted = true;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.4;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = ctx.createGain();
    gain.gain.value = 0.016;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
  }

  function unlock() {
    ensureContext();
  }

  // Crisp apple bite: しゃくしゃく
  function playAppleCrunch(intensity) {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const vol = (intensity || 1) * 0.24;
    const now = c.currentTime;

    for (let k = 0; k < 2; k++) {
      const t = now + k * 0.065;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = 0.9 + Math.random() * 0.35;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200 + Math.random() * 1400, t);
      bp.Q.value = 1.8;

      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 950;

      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * (k === 0 ? 1.0 : 0.72), t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);

      src.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(masterGain);
      src.start(t, Math.random() * 1.4, 0.11);
    }

    // Subtle crisp snap pop
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680 + Math.random() * 180, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.045);
    const og = c.createGain();
    og.gain.setValueAtTime(vol * 0.25, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // Bamboo leaf pluck + rustle
  function playBambooPluck() {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3100, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.09);
    bp.Q.value = 2.6;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.2, 0.12);

    playSnowPatter(4);
  }

  // Falling snow flakes: ぱらぱら
  function playSnowPatter(count) {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const n = count || 5;
    const now = c.currentTime;
    for (let i = 0; i < n; i++) {
      const t = now + i * (0.045 + Math.random() * 0.055);
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800 + Math.random() * 2400;
      bp.Q.value = 3.2;

      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045 + Math.random() * 0.03, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      src.connect(bp);
      bp.connect(g);
      g.connect(masterGain);
      src.start(t, Math.random() * 1.5, 0.06);
    }
  }

  // Soft snow footstep: 雪の上の小さな足音
  function playFootstep() {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;

    const lp = c.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(900 + Math.random() * 350, now);
    lp.Q.value = 1.2;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    src.connect(lp);
    lp.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.6, 0.11);
  }

  // Gentle branch creak: 枝のきしみ
  function playBranchCreak() {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const base = 105 + Math.random() * 35;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 0.86, now + 0.22);

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340 + Math.random() * 120;
    filter.Q.value = 5.5;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // Wooden saucer tap
  function playDishTap(pitchScale) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const f = (330 + Math.random() * 30) * (pitchScale || 1);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(f, now + 0.045);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Soft tactile pickup from basket or snow
  function playPickup() {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Powdery snow impact
  function playSnowDrop() {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    src.connect(lp);
    lp.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.2, 0.18);
  }

  // Tiny grape roll & plop
  function playGrapeRoll() {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(510, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Soft juicy grape chew
  function playGrapeChew() {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1350;
    bp.Q.value = 2.0;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.07, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.2, 0.09);
  }

  // Brushing snow from hollow lip
  function playBrushSnow() {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.linearRampToValueAtTime(1400, now + 0.22);
    bp.Q.value = 1.2;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.1, 0.26);
  }

  // Gentle yawn breath
  function playYawn() {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(720, now);
    bp.frequency.linearRampToValueAtTime(480, now + 0.55);
    bp.Q.value = 2.5;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.04, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 0.8, 0.65);
  }

  return {
    unlock,
    playAppleCrunch,
    playBambooPluck,
    playSnowPatter,
    playFootstep,
    playBranchCreak,
    playDishTap,
    playPickup,
    playSnowDrop,
    playGrapeRoll,
    playGrapeChew,
    playBrushSnow,
    playYawn,
  };
})();
