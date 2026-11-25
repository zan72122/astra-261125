window.RPP = window.RPP || {};

RPP.Textures = (function () {
  const cache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function seededRand(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function finalizeTex(canvas, isColor, repeatX, repeatY) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (repeatX || repeatY) tex.repeat.set(repeatX || 1, repeatY || 1);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function buildFurTexture(baseHex, midHex, tipHex, seed) {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const rnd = seededRand(seed);

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    // Soft mottled undercoat
    for (let i = 0; i < 420; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 14 + rnd() * 34;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, rnd() > 0.5 ? midHex : baseHex);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layered fine directional fur strokes
    ctx.lineCap = 'round';
    for (let i = 0; i < 7500; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const len = 10 + rnd() * 18;
      const ang = Math.PI * 0.5 + (rnd() - 0.5) * 0.32;
      const p = rnd();
      ctx.strokeStyle = p < 0.45 ? baseHex : p < 0.84 ? midHex : tipHex;
      ctx.globalAlpha = p < 0.84 ? 0.55 : 0.38;
      ctx.lineWidth = 1.0 + rnd() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Delicate winter morning frosted fur-tip glints
    ctx.strokeStyle = '#f5eee4';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 700; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const len = 5 + rnd() * 9;
      ctx.globalAlpha = 0.14 + rnd() * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return finalizeTex(c, true, 1, 1);
  }

  function buildFurBump() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const rnd = seededRand(901);
    ctx.fillStyle = '#7c7c7c';
    ctx.fillRect(0, 0, 512, 512);
    ctx.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const len = 8 + rnd() * 16;
      const v = Math.floor(85 + rnd() * 135);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.1 + rnd() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 4, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return finalizeTex(c, false, 1, 1);
  }

  function buildTailTexture(russetHex, lightHex, tipHex, seed) {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const rnd = seededRand(seed);

    ctx.fillStyle = russetHex;
    ctx.fillRect(0, 0, 512, 512);

    // 7 natural rings along V (y axis from base=0 to tip=512)
    const bands = [
      { y0: 0, y1: 68, col: russetHex },
      { y0: 68, y1: 122, col: lightHex },
      { y0: 122, y1: 184, col: russetHex },
      { y0: 184, y1: 238, col: lightHex },
      { y0: 238, y1: 300, col: russetHex },
      { y0: 300, y1: 352, col: lightHex },
      { y0: 352, y1: 416, col: russetHex },
      { y0: 416, y1: 454, col: lightHex },
      { y0: 454, y1: 512, col: tipHex },
    ];
    for (const b of bands) {
      ctx.fillStyle = b.col;
      ctx.fillRect(0, b.y0, 512, b.y1 - b.y0);
    }

    // Blend edges with lush fur strokes
    ctx.lineCap = 'round';
    for (let i = 0; i < 8500; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const band = bands.find((b) => y >= b.y0 && y <= b.y1) || bands[0];
      const len = 10 + rnd() * 18;
      ctx.strokeStyle = band.col;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1.4 + rnd() * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y - 6 + rnd() * 12);
      ctx.lineTo(x + (rnd() - 0.5) * 6, y + len);
      ctx.stroke();
    }

    // Subtle frosted highlight strokes
    ctx.strokeStyle = '#f3ece2';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 650; i++) {
      const x = rnd() * 512;
      const y = rnd() * 465;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 4, y + 8 + rnd() * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const tex = finalizeTex(c, true, 1, 1);
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function buildBarkTextures() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const b = makeCanvas(512, 512);
    const bctx = b.getContext('2d');
    const rnd = seededRand(303);

    ctx.fillStyle = '#5a4a3f';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, 512, 512);

    // Vertical organic bark ridges
    for (let i = 0; i < 240; i++) {
      const x = rnd() * 512;
      const w = 4 + rnd() * 16;
      const dark = rnd() > 0.45;
      ctx.fillStyle = dark ? '#3e322a' : '#6f5d50';
      ctx.globalAlpha = 0.35 + rnd() * 0.35;
      ctx.fillRect(x, 0, w, 512);

      bctx.fillStyle = dark ? '#454545' : '#b8b8b8';
      bctx.globalAlpha = 0.45;
      bctx.fillRect(x, 0, w, 512);
    }

    // Cracks and knots
    ctx.lineCap = 'round';
    bctx.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const len = 18 + rnd() * 65;
      const dx = (rnd() - 0.5) * 10;
      ctx.strokeStyle = rnd() > 0.25 ? '#2f251f' : '#85776a';
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 1.2 + rnd() * 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + len);
      ctx.stroke();

      bctx.strokeStyle = '#252525';
      bctx.globalAlpha = 0.55;
      bctx.lineWidth = 1.6 + rnd() * 2.5;
      bctx.beginPath();
      bctx.moveTo(x, y);
      bctx.lineTo(x + dx, y + len);
      bctx.stroke();
    }

    // Subtle winter frost specks on bark
    for (let i = 0; i < 320; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 1.5 + rnd() * 5;
      ctx.fillStyle = '#dbe6ef';
      ctx.globalAlpha = 0.08 + rnd() * 0.14;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    bctx.globalAlpha = 1;
    return {
      map: finalizeTex(c, true, 2, 3),
      bump: finalizeTex(b, false, 2, 3),
    };
  }

  function buildWoodTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    const rnd = seededRand(404);
    ctx.fillStyle = '#b48a62';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      const v = Math.sin(y * 0.14) * 12 + (rnd() - 0.5) * 10;
      const r = Math.min(255, Math.max(0, 174 + v));
      const g = Math.min(255, Math.max(0, 134 + v * 0.8));
      const b = Math.min(255, Math.max(0, 94 + v * 0.6));
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(0, y, 256, 2.2);
    }
    return finalizeTex(c, true, 1, 1);
  }

  function buildWickerTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8b643e';
    ctx.fillRect(0, 0, 256, 256);
    const step = 16;
    for (let row = 0; row < 256 / step; row++) {
      for (let col = 0; col < 256 / step; col++) {
        const even = (row + col) % 2 === 0;
        const x = col * step;
        const y = row * step;
        const grad = even
          ? ctx.createLinearGradient(x, y, x + step, y)
          : ctx.createLinearGradient(x, y, x, y + step);
        grad.addColorStop(0, '#7c5633');
        grad.addColorStop(0.5, '#c49664');
        grad.addColorStop(1, '#77512f');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      }
    }
    return finalizeTex(c, true, 3, 2);
  }

  function buildSnowBump() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    const rnd = seededRand(515);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4500; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const v = Math.floor(105 + rnd() * 65);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
    return finalizeTex(c, false, 6, 6);
  }

  function buildSoftPuffTexture() {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.45, 'rgba(242,248,255,0.42)');
    grad.addColorStop(1, 'rgba(235,244,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildSkyTexture() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#8fb8df');
    grad.addColorStop(0.35, '#bdd8ee');
    grad.addColorStop(0.62, '#dfebf5');
    grad.addColorStop(0.80, '#f3ebe3');
    grad.addColorStop(1.0, '#e6edf4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle soft morning sunlight glow on right horizon
    const sun = ctx.createRadialGradient(390, 310, 8, 390, 310, 190);
    sun.addColorStop(0, 'rgba(255,248,232,0.75)');
    sun.addColorStop(0.45, 'rgba(255,238,212,0.28)');
    sun.addColorStop(1, 'rgba(255,238,212,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildAppleSkinTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    const rnd = seededRand(717);
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#c62f2c');
    grad.addColorStop(0.55, '#b62422');
    grad.addColorStop(1, '#d24738');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = rnd() > 0.35 ? 'rgba(245,212,175,0.28)' : 'rgba(130,20,18,0.25)';
      ctx.beginPath();
      ctx.arc(rnd() * 256, rnd() * 256, 0.8 + rnd() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return finalizeTex(c, true, 1, 1);
  }

  function getAll() {
    if (cache.ready) return cache;
    cache.furRusset = buildFurTexture('#9f4b2c', '#b45c39', '#cf8660', 101);
    cache.furRusset2 = buildFurTexture('#a75534', '#bc6945', '#d69772', 202);
    cache.furDark = buildFurTexture('#2d221e', '#3c2e28', '#524038', 105);
    cache.furCream = buildFurTexture('#e8dfd1', '#f0e9de', '#f7f3ec', 109);
    cache.furBump = buildFurBump();
    cache.tailRing1 = buildTailTexture('#9e4b2c', '#cfa177', '#2b201c', 111);
    cache.tailRing2 = buildTailTexture('#a85736', '#d6ae86', '#312520', 222);

    const bark = buildBarkTextures();
    cache.barkMap = bark.map;
    cache.barkBump = bark.bump;
    cache.woodMap = buildWoodTexture();
    cache.wickerMap = buildWickerTexture();
    cache.snowBump = buildSnowBump();
    cache.softPuff = buildSoftPuffTexture();
    cache.skyMap = buildSkyTexture();
    cache.appleSkin = buildAppleSkinTexture();
    cache.ready = true;
    return cache;
  }

  return { getAll };
})();
