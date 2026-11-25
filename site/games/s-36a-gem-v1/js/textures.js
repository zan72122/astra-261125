(function (global) {
  'use strict';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function seededRand(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function toTexture(canvas, srgb = true, repeatX = 1, repeatY = 1) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  // Chipmunk back & body fur texture: soft reddish-brown, cream belly, 5 natural dark-brown & pale stripes
  // Mapped onto torso sphere/capsule where u=0.5 is top spine, u=0/1 is belly, v=0..1 is tail-to-neck
  function createChipmunkFurTextures(variant = 0) {
    const w = 512;
    const h = 512;
    const albedo = makeCanvas(w, h);
    const ctx = albedo.getContext('2d');
    const bump = makeCanvas(w, h);
    const bctx = bump.getContext('2d');
    const rand = seededRand(variant === 0 ? 104729 : 309123);

    // Base reddish-brown tawny coat (not overly saturated)
    const baseHex = variant === 0 ? '#a9744d' : '#b7855c';
    const rufousHex = variant === 0 ? '#b67848' : '#c28b5e';
    const bellyHex = '#e9decb';
    const darkStripeHex = variant === 0 ? '#3e291b' : '#4a3322';
    const lightStripeHex = variant === 0 ? '#e5d5bc' : '#ecdfc8';

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    // Smooth dorsal-to-belly gradient across U (x axis: center x=256 is dorsal spine, edges x=0 & 512 are belly)
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, bellyHex);
    grad.addColorStop(0.16, '#dfc9ab');
    grad.addColorStop(0.28, rufousHex);
    grad.addColorStop(0.5, baseHex);
    grad.addColorStop(0.72, rufousHex);
    grad.addColorStop(0.84, '#dfc9ab');
    grad.addColorStop(1.0, bellyHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Warm russet rump wash near lower V
    const rumpGrad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    rumpGrad.addColorStop(0, 'rgba(176,108,58,0)');
    rumpGrad.addColorStop(0.6, 'rgba(176,108,58,0.28)');
    rumpGrad.addColorStop(1, 'rgba(162,98,52,0.12)');
    ctx.fillStyle = rumpGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw 5 dorsal dark stripes & 2 pale cream stripes between outer dark stripes
    // x = 0.5 is dorsal center. Stripes run along Y (v = 0.14 to 0.88)
    function drawSoftStripe(centerU, widthU, color, alpha, yStart, yEnd) {
      const cx = centerU * w;
      const hw = widthU * w * 0.5;
      for (let y = Math.floor(yStart * h); y < Math.floor(yEnd * h); y += 2) {
        const t = (y / h - yStart) / (yEnd - yStart);
        const taper = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
        const wNow = hw * (0.45 + 0.65 * Math.pow(taper, 0.55));
        const lg = ctx.createLinearGradient(cx - wNow, 0, cx + wNow, 0);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(0.25, color);
        lg.addColorStop(0.75, color);
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.globalAlpha = alpha * (0.55 + 0.45 * taper);
        ctx.fillStyle = lg;
        ctx.fillRect(cx - wNow, y, wNow * 2, 3);
        ctx.restore();
      }
    }

    // Center spine dark stripe
    drawSoftStripe(0.50, 0.044, darkStripeHex, 0.82, 0.08, 0.86);
    // Inner flanks: warm tawny-gray then dark-pale-dark triplet on each side
    drawSoftStripe(0.415, 0.040, darkStripeHex, 0.78, 0.14, 0.84);
    drawSoftStripe(0.585, 0.040, darkStripeHex, 0.78, 0.14, 0.84);
    drawSoftStripe(0.368, 0.042, lightStripeHex, 0.86, 0.16, 0.82);
    drawSoftStripe(0.632, 0.042, lightStripeHex, 0.86, 0.16, 0.82);
    drawSoftStripe(0.324, 0.036, darkStripeHex, 0.72, 0.18, 0.80);
    drawSoftStripe(0.676, 0.036, darkStripeHex, 0.72, 0.18, 0.80);

    // Fine directional fur strokes for organic natural blending (no hard graphic stripes)
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 16000; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 6 + rand() * 14;
      const dx = (rand() - 0.5) * 2.2;
      const u = x / w;

      // Pick subtle fur-tip variation matching underlying coat region
      const distSpine = Math.abs(u - 0.5);
      let strokeCol;
      const r = rand();
      if (distSpine > 0.36) {
        strokeCol = r < 0.5 ? 'rgba(244,235,218,0.28)' : 'rgba(205,182,150,0.22)';
      } else if (distSpine < 0.03 || (distSpine > 0.068 && distSpine < 0.105) || (distSpine > 0.155 && distSpine < 0.195)) {
        strokeCol = r < 0.65 ? 'rgba(54,35,22,0.34)' : 'rgba(135,92,58,0.25)';
      } else if (distSpine > 0.11 && distSpine < 0.15) {
        strokeCol = r < 0.65 ? 'rgba(236,222,196,0.38)' : 'rgba(195,158,118,0.25)';
      } else {
        strokeCol = r < 0.45 ? 'rgba(182,124,78,0.30)' : r < 0.8 ? 'rgba(138,88,54,0.25)' : 'rgba(224,196,158,0.24)';
      }

      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 0.8 + rand() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + len);
      ctx.stroke();

      // Hair strand height in bump map
      const shade = Math.floor(95 + rand() * 90);
      bctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      bctx.lineWidth = 1.0;
      bctx.beginPath();
      bctx.moveTo(x, y);
      bctx.lineTo(x + dx, y + len);
      bctx.stroke();
    }

    return {
      map: toTexture(albedo, true, 1, 1),
      bumpMap: toTexture(bump, false, 1, 1),
    };
  }

  // Head fur texture with subtle pale buff cheek/eye-stripe markings typical of Tamias sibiricus
  function createChipmunkHeadTexture(variant = 0) {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rand = seededRand(variant === 0 ? 88211 : 99123);

    ctx.fillStyle = variant === 0 ? '#af7a52' : '#bc8b62';
    ctx.fillRect(0, 0, w, h);

    // Lower jaw/cheeks slightly paler warm buff
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, variant === 0 ? '#9c6842' : '#ab7950');
    g.addColorStop(0.52, variant === 0 ? '#b78259' : '#c39067');
    g.addColorStop(0.74, '#dfccb0');
    g.addColorStop(1.0, '#eadfce');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Fine facial fur strokes
    for (let i = 0; i < 4500; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const a = 0.16 + rand() * 0.16;
      ctx.strokeStyle = rand() > 0.5 ? `rgba(235,214,185,${a})` : `rgba(110,68,38,${a})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 3, y + 4 + rand() * 6);
      ctx.stroke();
    }
    return toTexture(c, true, 1, 1);
  }

  // Fluffy backlit tail hair plume texture with individual hair strands glowing golden at tips
  function createTailFurPlumeTexture(variant = 0) {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rand = seededRand(variant === 0 ? 55109 : 77312);

    ctx.clearRect(0, 0, w, h);

    // Soft central spine density
    const spineG = ctx.createLinearGradient(0, 0, w, 0);
    spineG.addColorStop(0.0, 'rgba(235,200,130,0)');
    spineG.addColorStop(0.28, 'rgba(130,86,52,0.22)');
    spineG.addColorStop(0.5, 'rgba(92,58,34,0.78)');
    spineG.addColorStop(0.72, 'rgba(130,86,52,0.22)');
    spineG.addColorStop(1.0, 'rgba(235,200,130,0)');
    ctx.fillStyle = spineG;
    ctx.fillRect(0, 12, w, h - 24);

    // Draw hundreds of individual sweeping hair strands radiating from center spine
    for (let i = 0; i < 780; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const y0 = 14 + rand() * (h - 28);
      const tY = y0 / h;
      const envelope = Math.sin(Math.max(0.05, Math.min(0.95, tY)) * Math.PI);
      const len = (36 + rand() * 78) * (0.45 + 0.65 * envelope);
      const x0 = w * 0.5 + (rand() - 0.5) * 16;
      const x1 = x0 + side * len;
      const y1 = y0 - (14 + rand() * 34);
      const cx = x0 + side * len * 0.52;
      const cy = y0 - (4 + rand() * 14);

      const lg = ctx.createLinearGradient(x0, y0, x1, y1);
      const r = rand();
      if (r < 0.28) {
        // Dark-banded guard hair with sunlit golden tip
        lg.addColorStop(0.0, 'rgba(72,46,28,0.92)');
        lg.addColorStop(0.42, 'rgba(155,105,62,0.85)');
        lg.addColorStop(0.72, 'rgba(58,38,24,0.82)');
        lg.addColorStop(0.92, 'rgba(246,216,144,0.75)');
        lg.addColorStop(1.0, 'rgba(255,234,172,0.0)');
      } else if (r < 0.68) {
        // Warm tawny-ochre strand
        lg.addColorStop(0.0, 'rgba(148,96,56,0.88)');
        lg.addColorStop(0.55, variant === 0 ? 'rgba(186,128,76,0.78)' : 'rgba(198,142,88,0.78)');
        lg.addColorStop(0.88, 'rgba(248,220,148,0.72)');
        lg.addColorStop(1.0, 'rgba(255,238,180,0.0)');
      } else {
        // Fine translucent backlit golden outer filament
        lg.addColorStop(0.0, 'rgba(184,132,78,0.65)');
        lg.addColorStop(0.6, 'rgba(232,190,116,0.68)');
        lg.addColorStop(0.9, 'rgba(255,232,162,0.78)');
        lg.addColorStop(1.0, 'rgba(255,245,204,0.0)');
      }

      ctx.strokeStyle = lg;
      ctx.lineWidth = 0.9 + rand() * 1.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  // Bark texture for stump sides & forest trees
  function createBarkTextures() {
    const w = 512;
    const h = 512;
    const albedo = makeCanvas(w, h);
    const ctx = albedo.getContext('2d');
    const bump = makeCanvas(w, h);
    const bctx = bump.getContext('2d');
    const rand = seededRand(44123);

    ctx.fillStyle = '#5c4736';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#707070';
    bctx.fillRect(0, 0, w, h);

    // Vertical bark ridges and fissures
    for (let i = 0; i < 420; i++) {
      const x = rand() * w;
      const bw = 4 + rand() * 18;
      const isCrack = rand() < 0.34;
      ctx.fillStyle = isCrack
        ? `rgba(42,30,21,${0.4 + rand() * 0.4})`
        : `rgba(${104 + Math.floor(rand() * 34)},${82 + Math.floor(rand() * 26)},${62 + Math.floor(rand() * 20)},${0.35 + rand() * 0.35})`;
      ctx.fillRect(x, 0, bw, h);

      const bv = isCrack ? 28 + Math.floor(rand() * 30) : 135 + Math.floor(rand() * 90);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x, 0, bw, h);
    }

    // Horizontal lenticels, moss flecks & organic breaks
    for (let i = 0; i < 2400; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const rw = 2 + rand() * 14;
      const rh = 3 + rand() * 22;
      const m = rand();
      if (m < 0.08) {
        ctx.fillStyle = `rgba(92,118,58,${0.25 + rand() * 0.25})`;
      } else if (m < 0.5) {
        ctx.fillStyle = `rgba(52,38,28,${0.2 + rand() * 0.25})`;
      } else {
        ctx.fillStyle = `rgba(136,110,84,${0.18 + rand() * 0.22})`;
      }
      ctx.fillRect(x, y, rw, rh);
    }

    return {
      map: toTexture(albedo, true, 2, 1),
      bumpMap: toTexture(bump, false, 2, 1),
    };
  }

  // Concentric weathered tree rings for stump top with subtle radial crack marks
  function createStumpTopTextures() {
    const w = 512;
    const h = 512;
    const albedo = makeCanvas(w, h);
    const ctx = albedo.getContext('2d');
    const bump = makeCanvas(w, h);
    const bctx = bump.getContext('2d');
    const rand = seededRand(71234);

    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.fillStyle = '#b4926b';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#888888';
    bctx.fillRect(0, 0, w, h);

    // Concentric organic growth rings
    for (let r = 248; r > 4; r -= 3.2) {
      const norm = r / 248;
      ctx.beginPath();
      bctx.beginPath();
      const darkRing = Math.sin(r * 0.42 + Math.sin(r * 0.11) * 1.4) > 0.15;
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
        const wobble = Math.sin(a * 3 + r * 0.04) * 4.5 + Math.cos(a * 5 - r * 0.03) * 2.5;
        const rr = r + wobble * norm;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (a === 0) {
          ctx.moveTo(x, y);
          bctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
          bctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      bctx.closePath();

      if (norm > 0.90) {
        ctx.fillStyle = '#634d39';
      } else if (norm > 0.82) {
        ctx.fillStyle = darkRing ? '#9e7c58' : '#b7946d';
      } else {
        ctx.fillStyle = darkRing ? '#a27f59' : '#c09e75';
      }
      ctx.fill();

      bctx.strokeStyle = darkRing ? 'rgba(95,95,95,0.55)' : 'rgba(165,165,165,0.45)';
      bctx.lineWidth = 2;
      bctx.stroke();
    }

    // Fine wood grain fibers
    for (let i = 0; i < 1600; i++) {
      const a = rand() * Math.PI * 2;
      const r0 = 10 + rand() * 210;
      const r1 = r0 + 6 + rand() * 24;
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(92,68,44,0.12)' : 'rgba(215,186,144,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // Prominent shallow radial crack at front-right (where walnut wedges!) + 2 subtle hairlines
    const cracks = [
      { angle: 0.58, r0: 36, r1: 218, width: 7.5, dark: 0.78 },
      { angle: -1.9, r0: 44, r1: 180, width: 3.2, dark: 0.45 },
      { angle: 2.35, r0: 55, r1: 170, width: 2.8, dark: 0.42 },
    ];
    for (const cr of cracks) {
      ctx.strokeStyle = `rgba(48,34,22,${cr.dark})`;
      ctx.lineWidth = cr.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(cr.angle) * cr.r0, cy + Math.sin(cr.angle) * cr.r0);
      ctx.lineTo(cx + Math.cos(cr.angle) * cr.r1, cy + Math.sin(cr.angle) * cr.r1);
      ctx.stroke();

      bctx.strokeStyle = '#181818';
      bctx.lineWidth = cr.width + 2;
      bctx.beginPath();
      bctx.moveTo(cx + Math.cos(cr.angle) * cr.r0, cy + Math.sin(cr.angle) * cr.r0);
      bctx.lineTo(cx + Math.cos(cr.angle) * cr.r1, cy + Math.sin(cr.angle) * cr.r1);
      bctx.stroke();
    }

    // Damp moss creeping onto outer rim
    for (let i = 0; i < 420; i++) {
      const a = rand() * Math.PI * 2;
      const r = 192 + rand() * 54;
      const rad = 4 + rand() * 14;
      ctx.fillStyle = `rgba(${78 + Math.floor(rand() * 34)},${108 + Math.floor(rand() * 34)},${46 + Math.floor(rand() * 20)},${0.18 + rand() * 0.34})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    return {
      map: toTexture(albedo, true, 1, 1),
      bumpMap: toTexture(bump, false, 1, 1),
    };
  }

  // Damp velvet moss texture
  function createMossTextures() {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const b = makeCanvas(w, h);
    const bctx = b.getContext('2d');
    const rand = seededRand(91823);

    ctx.fillStyle = '#4c6d31';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#787878';
    bctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 5500; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 1 + rand() * 3.2;
      const g = 92 + Math.floor(rand() * 58);
      const red = Math.floor(g * (0.58 + rand() * 0.22));
      const blue = Math.floor(g * 0.36);
      ctx.fillStyle = `rgba(${red},${g},${blue},${0.45 + rand() * 0.45})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      const bv = 80 + Math.floor(rand() * 150);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x, y, 2, 2);
    }

    return {
      map: toTexture(c, true, 2, 2),
      bumpMap: toTexture(b, false, 2, 2),
    };
  }

  // Warm sunlit autumn forest path floor (bright earthy soil + fine litter, never too dark)
  function createGroundTextures() {
    const w = 512;
    const h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const b = makeCanvas(w, h);
    const bctx = b.getContext('2d');
    const rand = seededRand(33445);

    ctx.fillStyle = '#8b6f4e';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, w, h);

    // Soft earthy mottling & sunlit ochre soil patches
    for (let i = 0; i < 180; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const rad = 18 + rand() * 54;
      const m = rand();
      ctx.fillStyle = m < 0.35
        ? 'rgba(156,126,88,0.22)'
        : m < 0.65
          ? 'rgba(112,86,58,0.22)'
          : 'rgba(104,118,62,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine humus, pine needles, soil pebbles, fallen leaf bits
    for (let i = 0; i < 4200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const rad = 1 + rand() * 3.5;
      const pick = rand();
      if (pick < 0.25) {
        ctx.fillStyle = 'rgba(174,132,82,0.34)';
      } else if (pick < 0.5) {
        ctx.fillStyle = 'rgba(128,88,52,0.32)';
      } else if (pick < 0.75) {
        ctx.fillStyle = 'rgba(182,118,56,0.25)';
      } else {
        ctx.fillStyle = 'rgba(84,64,44,0.28)';
      }
      ctx.fillRect(x, y, rad * 1.4, rad);

      const bv = 75 + Math.floor(rand() * 115);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x, y, rad, rad);
    }

    return {
      map: toTexture(c, true, 5, 5),
      bumpMap: toTexture(b, false, 5, 5),
    };
  }

  // Detailed veined autumn leaf texture (red, amber, gold variants)
  function createAutumnLeafTexture(palette = 'red') {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rand = seededRand(palette === 'red' ? 111 : palette === 'gold' ? 222 : 333);

    const colors = {
      red: ['#c44d2c', '#9e3820', '#d87236', '#722818'],
      gold: ['#ddb13a', '#c48d28', '#e8c958', '#8d5d1a'],
      amber: ['#cf6f2b', '#a84c20', '#de9438', '#783416'],
    }[palette] || ['#cf6f2b', '#a84c20', '#de9438', '#783416'];

    ctx.clearRect(0, 0, w, h);

    // Organic oak/birch-like pointed autumn leaf silhouette
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.94); // stem base
    ctx.bezierCurveTo(w * 0.16, h * 0.78, w * 0.08, h * 0.45, w * 0.24, h * 0.24);
    ctx.bezierCurveTo(w * 0.34, h * 0.12, w * 0.45, h * 0.08, w * 0.5, h * 0.04);
    ctx.bezierCurveTo(w * 0.55, h * 0.08, w * 0.66, h * 0.12, w * 0.76, h * 0.24);
    ctx.bezierCurveTo(w * 0.92, h * 0.45, w * 0.84, h * 0.78, w * 0.5, h * 0.94);
    ctx.closePath();

    const lg = ctx.createLinearGradient(0, h * 0.04, 0, h * 0.94);
    lg.addColorStop(0, colors[2]);
    lg.addColorStop(0.5, colors[0]);
    lg.addColorStop(1, colors[1]);
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.clip();

    // Subtle dry autumn mottling & edge spots
    for (let i = 0; i < 65; i++) {
      ctx.fillStyle = rand() > 0.4 ? 'rgba(255,215,130,0.12)' : 'rgba(90,42,20,0.14)';
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 6 + rand() * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp central midrib & branching leaf veins (clearly visible at low eye-level!)
    ctx.strokeStyle = colors[3];
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.96);
    ctx.lineTo(w * 0.5, h * 0.08);
    ctx.stroke();

    for (let i = 0; i < 7; i++) {
      const y = h * (0.82 - i * 0.105);
      const reach = (0.36 - Math.abs(i - 2.6) * 0.065) * w;
      for (const side of [-1, 1]) {
        ctx.lineWidth = 2.0 - i * 0.14;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, y);
        ctx.quadraticCurveTo(w * 0.5 + side * reach * 0.55, y - 10, w * 0.5 + side * reach, y - 28);
        ctx.stroke();

        // Fine tertiary veinlets
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = 'rgba(95,44,18,0.45)';
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + side * reach * 0.48, y - 9);
        ctx.lineTo(w * 0.5 + side * reach * 0.68, y - 2);
        ctx.stroke();
        ctx.strokeStyle = colors[3];
      }
    }
    ctx.restore();

    // Petiole stem
    ctx.strokeStyle = '#6c4527';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.92);
    ctx.lineTo(w * 0.52, h * 0.99);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  // Acorn glossy nut + cross-hatched cupule cap
  function createAcornTextures() {
    // Nut body
    const c1 = makeCanvas(256, 256);
    const ctx1 = c1.getContext('2d');
    const g = ctx1.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#6a3b1a');
    g.addColorStop(0.35, '#864f25');
    g.addColorStop(0.78, '#7a451f');
    g.addColorStop(1, '#583015');
    ctx1.fillStyle = g;
    ctx1.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 3) {
      ctx1.fillStyle = x % 6 === 0 ? 'rgba(65,32,12,0.16)' : 'rgba(175,112,58,0.11)';
      ctx1.fillRect(x, 0, 1.5, 256);
    }

    // Cupule cap (scaled/cross-hatched bumpy pattern)
    const c2 = makeCanvas(256, 256);
    const ctx2 = c2.getContext('2d');
    const b2 = makeCanvas(256, 256);
    const bctx2 = b2.getContext('2d');
    ctx2.fillStyle = '#6d533c';
    ctx2.fillRect(0, 0, 256, 256);
    bctx2.fillStyle = '#555555';
    bctx2.fillRect(0, 0, 256, 256);

    const step = 16;
    for (let row = 0; row < 256 / step + 1; row++) {
      for (let col = 0; col < 256 / step + 1; col++) {
        const cx = col * step + (row % 2 ? step * 0.5 : 0);
        const cy = row * step;
        ctx2.fillStyle = row % 2 ? '#7c6147' : '#634a35';
        ctx2.beginPath();
        ctx2.ellipse(cx, cy, 7, 5.5, 0, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.strokeStyle = 'rgba(42,28,18,0.55)';
        ctx2.lineWidth = 1.5;
        ctx2.stroke();

        bctx2.fillStyle = '#dcdcdc';
        bctx2.beginPath();
        bctx2.ellipse(cx, cy, 6, 4.5, 0, 0, Math.PI * 2);
        bctx2.fill();
      }
    }

    return {
      nutMap: toTexture(c1, true, 1, 1),
      capMap: toTexture(c2, true, 2, 1),
      capBump: toTexture(b2, false, 2, 1),
    };
  }

  // Corrugated gray-brown walnut shell
  function createWalnutTextures() {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const b = makeCanvas(w, h);
    const bctx = b.getContext('2d');
    const rand = seededRand(61234);

    ctx.fillStyle = '#8f7d67';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#909090';
    bctx.fillRect(0, 0, w, h);

    // Wavy rugged grooves
    for (let i = 0; i < 120; i++) {
      const y = rand() * h;
      const x = rand() * w;
      const len = 18 + rand() * 48;
      const isPit = rand() < 0.52;
      ctx.strokeStyle = isPit ? 'rgba(72,58,44,0.48)' : 'rgba(182,164,138,0.42)';
      ctx.lineWidth = 2.5 + rand() * 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.3, y + (rand() - 0.5) * 16, x + len * 0.7, y + (rand() - 0.5) * 16, x + len, y + (rand() - 0.5) * 8);
      ctx.stroke();

      bctx.strokeStyle = isPit ? '#262626' : '#e6e6e6';
      bctx.lineWidth = 3 + rand() * 3;
      bctx.beginPath();
      bctx.moveTo(x, y);
      bctx.bezierCurveTo(x + len * 0.3, y + (rand() - 0.5) * 16, x + len * 0.7, y + (rand() - 0.5) * 16, x + len, y + (rand() - 0.5) * 8);
      bctx.stroke();
    }

    // Center seam ridge
    ctx.fillStyle = 'rgba(178,160,136,0.5)';
    ctx.fillRect(w * 0.485, 0, w * 0.03, h);
    bctx.fillStyle = '#f2f2f2';
    bctx.fillRect(w * 0.485, 0, w * 0.03, h);

    return {
      map: toTexture(c, true, 1, 1),
      bumpMap: toTexture(b, false, 1, 1),
    };
  }

  // Striped sunflower seed texture
  function createSunflowerSeedTexture() {
    const w = 128;
    const h = 128;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#363432';
    ctx.fillRect(0, 0, w, h);

    // Classic creamy longitudinal stripes
    const stripes = [10, 26, 48, 66, 86, 108];
    for (const sx of stripes) {
      ctx.fillStyle = '#dcd4c4';
      ctx.fillRect(sx, 0, 5.5, h);
      ctx.fillStyle = 'rgba(180,170,156,0.5)';
      ctx.fillRect(sx - 1.5, 0, 1.5, h);
      ctx.fillRect(sx + 5.5, 0, 1.5, h);
    }
    return toTexture(c, true, 1, 1);
  }

  // Natural woven linen cloth pouch texture
  function createLinenTextures() {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const b = makeCanvas(w, h);
    const bctx = b.getContext('2d');
    const rand = seededRand(50511);

    ctx.fillStyle = '#d3c2a3';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, w, h);

    for (let i = 0; i < w; i += 4) {
      const shade = Math.floor((rand() - 0.5) * 16);
      ctx.fillStyle = `rgb(${205 + shade},${188 + shade},${156 + shade})`;
      ctx.fillRect(i, 0, 2, h);
      ctx.fillStyle = `rgb(${198 - shade},${181 - shade},${148 - shade})`;
      ctx.fillRect(0, i, w, 2);

      bctx.fillStyle = '#a8a8a8';
      bctx.fillRect(i, 0, 2, h);
      bctx.fillStyle = '#626262';
      bctx.fillRect(0, i, w, 2);
    }

    // Subtle warm hem stitching near top
    ctx.strokeStyle = 'rgba(148,112,76,0.45)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(w, 36);
    ctx.stroke();

    return {
      map: toTexture(c, true, 2, 2),
      bumpMap: toTexture(b, false, 2, 2),
    };
  }

  // Warm turned wood plate grain
  function createWoodPlateTexture() {
    const w = 256;
    const h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c49664';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 2) {
      const wave = Math.sin(y * 0.09) * 10 + Math.sin(y * 0.25) * 4;
      const v = Math.floor(wave);
      ctx.fillStyle = `rgb(${192 + v},${144 + Math.floor(v * 0.8)},${94 + Math.floor(v * 0.6)})`;
      ctx.fillRect(0, y, w, 2);
    }
    return toTexture(c, true, 1, 1);
  }

  // Dappled morning canopy sunlight texture (projected/blended on ground & stump)
  function createDappleTexture() {
    const w = 512;
    const h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rand = seededRand(81294);

    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 42; i++) {
      const x = 40 + rand() * (w - 80);
      const y = 40 + rand() * (h - 80);
      const rx = 18 + rand() * 44;
      const ry = 14 + rand() * 34;
      const rot = rand() * Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(rx, ry));
      rg.addColorStop(0, 'rgba(255, 240, 186, 0.34)');
      rg.addColorStop(0.55, 'rgba(255, 230, 165, 0.16)');
      rg.addColorStop(1, 'rgba(255, 224, 150, 0)');
      ctx.fillStyle = rg;
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  global.ForestTextures = {
    createChipmunkFurTextures,
    createChipmunkHeadTexture,
    createTailFurPlumeTexture,
    createBarkTextures,
    createStumpTopTextures,
    createMossTextures,
    createGroundTextures,
    createAutumnLeafTexture,
    createAcornTextures,
    createWalnutTextures,
    createSunflowerSeedTexture,
    createLinenTextures,
    createWoodPlateTexture,
    createDappleTexture,
  };
})(window);
