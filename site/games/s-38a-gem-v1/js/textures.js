(function () {
  'use strict';

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function makeTexture(canvas, repeatX, repeatY, isColor) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (repeatX || repeatY) {
      tex.repeat.set(repeatX || 1, repeatY || 1);
    }
    if (isColor !== false && THREE.SRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Coarse natural capybara fur (albedo + bump + roughness)
  function createFurTextures(baseHex, tipHex, darkWetHex, seed) {
    const w = 512;
    const h = 512;
    const rand = mulberry32(seed || 101);

    const colCanvas = createCanvas(w, h);
    const colCtx = colCanvas.getContext('2d');
    const bumpCanvas = createCanvas(w, h);
    const bumpCtx = bumpCanvas.getContext('2d');
    const roughCanvas = createCanvas(w, h);
    const roughCtx = roughCanvas.getContext('2d');

    // Warm base coat with subtle darker wet underside along V
    const grad = colCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, baseHex);
    grad.addColorStop(0.58, baseHex);
    grad.addColorStop(0.86, darkWetHex);
    grad.addColorStop(1, darkWetHex);
    colCtx.fillStyle = grad;
    colCtx.fillRect(0, 0, w, h);

    bumpCtx.fillStyle = '#787878';
    bumpCtx.fillRect(0, 0, w, h);

    // Upper back slightly glossy from mist/sunset, lower wet fur sleeker (lower roughness)
    const rGrad = roughCtx.createLinearGradient(0, 0, 0, h);
    rGrad.addColorStop(0, '#c2c2c2');
    rGrad.addColorStop(0.55, '#b2b2b2');
    rGrad.addColorStop(0.82, '#626262');
    rGrad.addColorStop(1, '#4c4c4c');
    roughCtx.fillStyle = rGrad;
    roughCtx.fillRect(0, 0, w, h);

    // Draw coarse, wiry capybara hair strands
    const baseCol = new THREE.Color(baseHex);
    const tipCol = new THREE.Color(tipHex);
    const wetCol = new THREE.Color(darkWetHex);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < 6200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 10 + rand() * 20;
      const ang = (Math.PI * 0.5) + (rand() - 0.5) * 0.36;
      const dx = Math.cos(ang) * len;
      const dy = Math.sin(ang) * len;
      const wetFactor = Math.max(0, Math.min(1, (y / h - 0.56) * 2.2));

      tmpCol.copy(baseCol);
      const rPick = rand();
      if (rPick < 0.36) {
        tmpCol.lerp(tipCol, 0.35 + rand() * 0.45);
      } else if (rPick < 0.72) {
        tmpCol.multiplyScalar(0.84 + rand() * 0.16);
      } else {
        tmpCol.lerp(wetCol, 0.28 + rand() * 0.25);
      }
      if (wetFactor > 0) {
        tmpCol.lerp(wetCol, wetFactor * 0.52);
      }

      colCtx.strokeStyle = '#' + tmpCol.getHexString();
      colCtx.lineWidth = 1.0 + rand() * 1.3;
      colCtx.globalAlpha = 0.55 + rand() * 0.35;
      colCtx.beginPath();
      colCtx.moveTo(x, y);
      colCtx.lineTo(x + dx, y + dy);
      colCtx.stroke();

      const bVal = Math.floor(95 + rand() * 135);
      bumpCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
      bumpCtx.lineWidth = 1.1 + rand() * 1.1;
      bumpCtx.globalAlpha = 0.6;
      bumpCtx.beginPath();
      bumpCtx.moveTo(x, y);
      bumpCtx.lineTo(x + dx, y + dy);
      bumpCtx.stroke();
    }

    colCtx.globalAlpha = 1;
    bumpCtx.globalAlpha = 1;

    return {
      map: makeTexture(colCanvas, 2, 2, true),
      bumpMap: makeTexture(bumpCanvas, 2, 2, false),
      roughnessMap: makeTexture(roughCanvas, 2, 2, false)
    };
  }

  // Natural volcanic / river stone for the bath rim & platform
  function createStoneTextures(seed) {
    const w = 512;
    const h = 512;
    const rand = mulberry32(seed || 202);
    const colC = createCanvas(w, h);
    const colCtx = colC.getContext('2d');
    const bumpC = createCanvas(w, h);
    const bumpCtx = bumpC.getContext('2d');

    colCtx.fillStyle = '#8b837b';
    colCtx.fillRect(0, 0, w, h);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, w, h);

    // Broad warm mineral patches
    for (let i = 0; i < 180; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 18 + rand() * 68;
      const shade = 112 + Math.floor((rand() - 0.5) * 44);
      const warm = Math.floor(shade * 1.04);
      const cool = Math.floor(shade * 0.94);
      const g = colCtx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(${warm},${shade},${cool},0.34)`);
      g.addColorStop(1, `rgba(${warm},${shade},${cool},0)`);
      colCtx.fillStyle = g;
      colCtx.fillRect(x - r, y - r, r * 2, r * 2);

      const bv = 100 + Math.floor(rand() * 60);
      const bg = bumpCtx.createRadialGradient(x, y, 2, x, y, r);
      bg.addColorStop(0, `rgba(${bv},${bv},${bv},0.35)`);
      bg.addColorStop(1, `rgba(${bv},${bv},${bv},0)`);
      bumpCtx.fillStyle = bg;
      bumpCtx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Fine speckled mineral grain
    for (let i = 0; i < 4200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const sz = 1 + rand() * 3.2;
      const v = 86 + Math.floor(rand() * 88);
      colCtx.fillStyle = `rgba(${v + 6},${v},${v - 6},0.28)`;
      colCtx.fillRect(x, y, sz, sz);

      const bv = 70 + Math.floor(rand() * 120);
      bumpCtx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
      bumpCtx.fillRect(x, y, sz, sz);
    }

    return {
      map: makeTexture(colC, 2, 2, true),
      bumpMap: makeTexture(bumpC, 2, 2, false)
    };
  }

  // Woven bamboo basket texture
  function createBasketTextures() {
    const w = 512;
    const h = 512;
    const colC = createCanvas(w, h);
    const colCtx = colC.getContext('2d');
    const bumpC = createCanvas(w, h);
    const bumpCtx = bumpC.getContext('2d');

    colCtx.fillStyle = '#8b683e';
    colCtx.fillRect(0, 0, w, h);
    bumpCtx.fillStyle = '#383838';
    bumpCtx.fillRect(0, 0, w, h);

    const step = 32;
    const rand = mulberry32(303);

    // Woven strips
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const horiz = ((x / step) + (y / step)) % 2 === 0;
        const tone = (rand() - 0.5) * 18;
        const r = Math.min(240, Math.max(120, Math.floor(194 + tone)));
        const g = Math.min(220, Math.max(95, Math.floor(156 + tone * 0.8)));
        const b = Math.min(170, Math.max(60, Math.floor(96 + tone * 0.6)));

        if (horiz) {
          const gr = colCtx.createLinearGradient(x, y, x + step, y);
          gr.addColorStop(0, `rgb(${r - 32},${g - 28},${b - 20})`);
          gr.addColorStop(0.5, `rgb(${r + 14},${g + 12},${b + 8})`);
          gr.addColorStop(1, `rgb(${r - 32},${g - 28},${b - 20})`);
          colCtx.fillStyle = gr;
          colCtx.fillRect(x, y + 3, step, step - 6);

          const bg = bumpCtx.createLinearGradient(x, y, x + step, y);
          bg.addColorStop(0, '#666');
          bg.addColorStop(0.5, '#e8e8e8');
          bg.addColorStop(1, '#666');
          bumpCtx.fillStyle = bg;
          bumpCtx.fillRect(x, y + 3, step, step - 6);
        } else {
          const gr = colCtx.createLinearGradient(x, y, x, y + step);
          gr.addColorStop(0, `rgb(${r - 36},${g - 32},${b - 22})`);
          gr.addColorStop(0.5, `rgb(${r + 8},${g + 6},${b + 4})`);
          gr.addColorStop(1, `rgb(${r - 36},${g - 32},${b - 22})`);
          colCtx.fillStyle = gr;
          colCtx.fillRect(x + 3, y, step - 6, step);

          const bg = bumpCtx.createLinearGradient(x, y, x, y + step);
          bg.addColorStop(0, '#5a5a5a');
          bg.addColorStop(0.5, '#dcdcdc');
          bg.addColorStop(1, '#5a5a5a');
          bumpCtx.fillStyle = bg;
          bumpCtx.fillRect(x + 3, y, step - 6, step);
        }
      }
    }

    return {
      map: makeTexture(colC, 3, 2, true),
      bumpMap: makeTexture(bumpC, 3, 2, false)
    };
  }

  // Split bamboo trough & fence culm texture
  function createBambooCulmTextures() {
    const w = 256;
    const h = 512;
    const rand = mulberry32(404);
    const colC = createCanvas(w, h);
    const colCtx = colC.getContext('2d');
    const bumpC = createCanvas(w, h);
    const bumpCtx = bumpC.getContext('2d');

    colCtx.fillStyle = '#9aa06c';
    colCtx.fillRect(0, 0, w, h);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, w, h);

    // Longitudinal bamboo fibers
    for (let i = 0; i < 600; i++) {
      const x = rand() * w;
      const v = (rand() - 0.5) * 26;
      colCtx.fillStyle = `rgba(${145 + v},${154 + v},${102 + v * 0.7},0.35)`;
      colCtx.fillRect(x, 0, 1 + rand() * 2, h);

      const bv = 115 + Math.floor(rand() * 35);
      bumpCtx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
      bumpCtx.fillRect(x, 0, 1 + rand() * 1.5, h);
    }

    // Bamboo node rings
    [128, 384].forEach((ny) => {
      colCtx.fillStyle = 'rgba(92, 82, 54, 0.55)';
      colCtx.fillRect(0, ny - 4, w, 8);
      colCtx.fillStyle = 'rgba(210, 204, 152, 0.45)';
      colCtx.fillRect(0, ny + 4, w, 4);

      bumpCtx.fillStyle = '#dcdcdc';
      bumpCtx.fillRect(0, ny - 3, w, 6);
      bumpCtx.fillStyle = '#484848';
      bumpCtx.fillRect(0, ny + 3, w, 3);
    });

    return {
      map: makeTexture(colC, 1, 1, true),
      bumpMap: makeTexture(bumpC, 1, 1, false)
    };
  }

  // Dimpled bright yellow yuzu peel
  function createYuzuTextures() {
    const w = 256;
    const h = 256;
    const rand = mulberry32(505);
    const colC = createCanvas(w, h);
    const colCtx = colC.getContext('2d');
    const bumpC = createCanvas(w, h);
    const bumpCtx = bumpC.getContext('2d');

    const gr = colCtx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f3ca3e');
    gr.addColorStop(0.5, '#f4c430');
    gr.addColorStop(1, '#e4ae24');
    colCtx.fillStyle = gr;
    colCtx.fillRect(0, 0, w, h);

    bumpCtx.fillStyle = '#929292';
    bumpCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 1.2 + rand() * 2.2;
      colCtx.fillStyle = rand() > 0.5 ? 'rgba(255, 224, 96, 0.25)' : 'rgba(208, 150, 18, 0.22)';
      colCtx.beginPath();
      colCtx.arc(x, y, r, 0, Math.PI * 2);
      colCtx.fill();

      bumpCtx.fillStyle = 'rgba(52, 52, 52, 0.65)';
      bumpCtx.beginPath();
      bumpCtx.arc(x, y, r * 0.9, 0, Math.PI * 2);
      bumpCtx.fill();
    }

    return {
      map: makeTexture(colC, 1, 1, true),
      bumpMap: makeTexture(bumpC, 1, 1, false)
    };
  }

  // Glossy red apple skin & creamy cut flesh
  function createAppleTextures() {
    const w = 256;
    const h = 256;
    const rand = mulberry32(606);

    const skinC = createCanvas(w, h);
    const sCtx = skinC.getContext('2d');
    const gr = sCtx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#c8342d');
    gr.addColorStop(0.5, '#b92a24');
    gr.addColorStop(1, '#9f231e');
    sCtx.fillStyle = gr;
    sCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < 420; i++) {
      const x = rand() * w;
      const y = rand() * h;
      sCtx.fillStyle = rand() > 0.35 ? 'rgba(230, 96, 62, 0.24)' : 'rgba(248, 224, 154, 0.26)';
      sCtx.fillRect(x, y, 2 + rand() * 3, 8 + rand() * 16);
    }

    const fleshC = createCanvas(w, h);
    const fCtx = fleshC.getContext('2d');
    const fGr = fCtx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.65);
    fGr.addColorStop(0, '#f8eed0');
    fGr.addColorStop(0.75, '#f2e4bd');
    fGr.addColorStop(1, '#e2cd9a');
    fCtx.fillStyle = fGr;
    fCtx.fillRect(0, 0, w, h);

    return {
      skinMap: makeTexture(skinC, 1, 1, true),
      fleshMap: makeTexture(fleshC, 1, 1, true)
    };
  }

  // Wet green veined cabbage leaf texture
  function createCabbageTextures() {
    const w = 512;
    const h = 512;
    const colC = createCanvas(w, h);
    const ctx = colC.getContext('2d');
    const bumpC = createCanvas(w, h);
    const bCtx = bumpC.getContext('2d');

    const gr = ctx.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, '#c8daa6');
    gr.addColorStop(0.28, '#8ab464');
    gr.addColorStop(0.7, '#64984c');
    gr.addColorStop(1, '#528741');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);

    bCtx.fillStyle = '#707070';
    bCtx.fillRect(0, 0, w, h);

    // Central pale crisp midrib
    ctx.strokeStyle = 'rgba(232, 240, 202, 0.85)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.quadraticCurveTo(w * 0.49, h * 0.52, w * 0.5, h * 0.08);
    ctx.stroke();

    bCtx.strokeStyle = '#efefef';
    bCtx.lineWidth = 24;
    bCtx.beginPath();
    bCtx.moveTo(w * 0.5, h);
    bCtx.lineTo(w * 0.5, h * 0.08);
    bCtx.stroke();

    // Branching veins
    for (let i = 0; i < 8; i++) {
      const yStart = h * (0.88 - i * 0.1);
      const spread = h * 0.18;
      [-1, 1].forEach((dir) => {
        ctx.strokeStyle = 'rgba(220, 234, 188, 0.62)';
        ctx.lineWidth = 8 - i * 0.6;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, yStart);
        ctx.quadraticCurveTo(w * 0.5 + dir * w * 0.24, yStart - spread * 0.45, w * 0.5 + dir * w * 0.46, yStart - spread);
        ctx.stroke();

        bCtx.strokeStyle = '#c8c8c8';
        bCtx.lineWidth = 7 - i * 0.5;
        bCtx.beginPath();
        bCtx.moveTo(w * 0.5, yStart);
        bCtx.quadraticCurveTo(w * 0.5 + dir * w * 0.24, yStart - spread * 0.45, w * 0.5 + dir * w * 0.46, yStart - spread);
        bCtx.stroke();
      });
    }

    // Subtle moist leaf crinkles
    const rand = mulberry32(707);
    for (let i = 0; i < 240; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 6 + rand() * 20;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(132, 182, 92, 0.14)' : 'rgba(66, 118, 52, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return {
      map: makeTexture(colC, 1, 1, true),
      bumpMap: makeTexture(bumpC, 1, 1, false)
    };
  }

  // Soft translucent organic steam puff sprite
  function createSteamTexture() {
    const s = 256;
    const c = createCanvas(s, s);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);

    const lobes = [
      { x: 0.50, y: 0.52, r: 0.36, a: 0.28 },
      { x: 0.36, y: 0.55, r: 0.26, a: 0.22 },
      { x: 0.65, y: 0.54, r: 0.26, a: 0.22 },
      { x: 0.48, y: 0.36, r: 0.28, a: 0.22 },
      { x: 0.56, y: 0.64, r: 0.24, a: 0.18 }
    ];
    lobes.forEach((l) => {
      const g = ctx.createRadialGradient(l.x * s, l.y * s, 2, l.x * s, l.y * s, l.r * s);
      g.addColorStop(0, `rgba(255, 250, 245, ${l.a})`);
      g.addColorStop(0.55, `rgba(255, 246, 238, ${l.a * 0.45})`);
      g.addColorStop(1, 'rgba(255, 246, 238, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });

    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Winter dry grass meadow texture
  function createWinterGrassTexture() {
    const w = 512;
    const h = 512;
    const rand = mulberry32(808);
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#8e7a56';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 320; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 16 + rand() * 54;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      const tone = rand() > 0.45 ? 'rgba(164, 140, 94, 0.25)' : 'rgba(116, 108, 68, 0.25)';
      g.addColorStop(0, tone);
      g.addColorStop(1, 'rgba(140, 122, 84, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 3800; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 6 + rand() * 14;
      const ang = -Math.PI * 0.5 + (rand() - 0.5) * 0.7;
      ctx.strokeStyle = rand() > 0.3 ? 'rgba(182, 158, 106, 0.42)' : 'rgba(118, 114, 72, 0.38)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    return makeTexture(c, 5, 5, true);
  }

  window.PokapokaTextures = {
    createFurTextures,
    createStoneTextures,
    createBasketTextures,
    createBambooCulmTextures,
    createYuzuTextures,
    createAppleTextures,
    createCabbageTextures,
    createSteamTexture,
    createWinterGrassTexture
  };
})();
