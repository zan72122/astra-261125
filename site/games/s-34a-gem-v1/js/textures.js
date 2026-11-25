(function () {
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

  function makeTexture(canvas, repeatX, repeatY, srgb) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (repeatX || repeatY) tex.repeat.set(repeatX || 1, repeatY || 1);
    if (srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Warm cedar/pine wood planks with grain, knots, and plank seams
  function createWoodTexture(opts) {
    const o = Object.assign({
      w: 512, h: 512,
      base: [188, 144, 98],
      grain: [148, 105, 65],
      planks: 4,
      seed: 11,
      repeatX: 1, repeatY: 1
    }, opts);
    const rand = seededRand(o.seed);
    const c = makeCanvas(o.w, o.h);
    const ctx = c.getContext('2d');
    const ph = o.h / o.planks;

    for (let p = 0; p < o.planks; p++) {
      const y0 = p * ph;
      const tone = (rand() - 0.5) * 18;
      const r = Math.min(255, Math.max(0, o.base[0] + tone));
      const g = Math.min(255, Math.max(0, o.base[1] + tone * 0.85));
      const b = Math.min(255, Math.max(0, o.base[2] + tone * 0.7));
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(0, y0, o.w, ph);

      // Fine fibers
      for (let i = 0; i < 75; i++) {
        const yy = y0 + rand() * ph;
        const alpha = 0.06 + rand() * 0.14;
        ctx.strokeStyle = `rgba(${o.grain[0]},${o.grain[1]},${o.grain[2]},${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.8 + rand() * 2.4;
        ctx.beginPath();
        const wave = (rand() - 0.5) * 5;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(o.w * 0.33, yy + wave, o.w * 0.66, yy - wave, o.w, yy + (rand() - 0.5) * 2);
        ctx.stroke();
      }

      // Occasional soft wood knot
      if (rand() < 0.65) {
        const kx = 60 + rand() * (o.w - 120);
        const ky = y0 + ph * (0.25 + rand() * 0.5);
        const kr = 8 + rand() * 14;
        const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr * 2.2);
        grad.addColorStop(0, `rgba(${o.grain[0] - 25},${o.grain[1] - 25},${o.grain[2] - 20},0.55)`);
        grad.addColorStop(0.5, `rgba(${o.grain[0]},${o.grain[1]},${o.grain[2]},0.22)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.translate(kx, ky);
        ctx.scale(2.1, 0.7);
        ctx.beginPath();
        ctx.arc(0, 0, kr, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // Plank seam
      ctx.fillStyle = 'rgba(72,48,28,0.42)';
      ctx.fillRect(0, y0, o.w, 2.2);
      ctx.fillStyle = 'rgba(245,220,185,0.16)';
      ctx.fillRect(0, y0 + 2.2, o.w, 1.5);
    }
    return makeTexture(c, o.repeatX, o.repeatY, true);
  }

  // Dry golden straw bed texture for inside the wooden box
  function createStrawBedTexture() {
    const rand = seededRand(42);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c89e52';
    ctx.fillRect(0, 0, 512, 512);

    // Warm shadow crevices
    for (let i = 0; i < 240; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 8 + rand() * 24;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(130, 92, 38, 0.25)');
      g.addColorStop(1, 'rgba(130, 92, 38, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Layered crisscrossing golden straw stalks
    const colors = ['#e2be6c', '#d5ad56', '#ebd088', '#c39744', '#f0da9a', '#b88b3d'];
    for (let i = 0; i < 620; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const len = 36 + rand() * 88;
      const ang = rand() * Math.PI * 2;
      const dx = Math.cos(ang) * len;
      const dy = Math.sin(ang) * len;
      const bend = (rand() - 0.5) * 14;
      ctx.strokeStyle = colors[(rand() * colors.length) | 0];
      ctx.lineWidth = 1.6 + rand() * 2.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dx * 0.5 - dy * 0.1 + bend, y + dy * 0.5 + dx * 0.1, x + dx, y + dy);
      ctx.stroke();

      // Subtle sunlit highlight line along stalk
      ctx.strokeStyle = 'rgba(255, 246, 210, 0.26)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y - 0.5);
      ctx.quadraticCurveTo(x + dx * 0.5 - dy * 0.1 + bend, y + dy * 0.5 + dx * 0.1 - 0.5, x + dx + 0.5, y + dy - 0.5);
      ctx.stroke();
    }
    return makeTexture(c, 2, 2, true);
  }

  // Rough unglazed terracotta texture + bump map
  function createTerracottaTextures() {
    const rand = seededRand(77);
    const c = makeCanvas(256, 256);
    const b = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#c57250';
    ctx.fillRect(0, 0, 256, 256);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, 256, 256);

    // Subtle wheel-thrown horizontal bands
    for (let y = 0; y < 256; y += 3) {
      const v = Math.sin(y * 0.24) * 7 + (rand() - 0.5) * 5;
      ctx.fillStyle = v > 0 ? `rgba(225,155,118,${(v * 0.015).toFixed(3)})` : `rgba(120,60,38,${(-v * 0.015).toFixed(3)})`;
      ctx.fillRect(0, y, 256, 2);
      const bv = Math.min(255, Math.max(0, 128 + v * 4)) | 0;
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(0, y, 256, 2);
    }

    // Fine mineral grit speckles
    for (let i = 0; i < 2400; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const s = 0.8 + rand() * 1.8;
      const bright = rand() > 0.45;
      ctx.fillStyle = bright ? 'rgba(232,175,140,0.22)' : 'rgba(112,56,34,0.25)';
      ctx.fillRect(x, y, s, s);
      const bv = bright ? 168 : 92;
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x, y, s, s);
    }

    return {
      map: makeTexture(c, 2, 1, true),
      bumpMap: makeTexture(b, 2, 1, false)
    };
  }

  // Glazed stoneware ceramic texture for water dish & outdoor saucer
  function createCeramicTexture(baseHex, speckleHex) {
    const rand = seededRand(91);
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = baseHex || '#e9e4d8';
    ctx.fillRect(0, 0, 256, 256);

    // Gentle glaze variation
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5, 'rgba(220,210,190,0.0)');
    grad.addColorStop(1, 'rgba(160,145,125,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 420; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 0.6 + rand() * 1.3;
      ctx.fillStyle = speckleHex || 'rgba(130,115,96,0.24)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return makeTexture(c, 1, 1, true);
  }

  // Woven willow/bamboo basket texture
  function createBasketTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9b7648';
    ctx.fillRect(0, 0, 256, 256);

    const step = 16;
    for (let y = 0; y < 256; y += step) {
      for (let x = 0; x < 256; x += step * 2) {
        const offset = ((y / step) % 2) * step;
        const rx = (x + offset) % 256;
        const grad = ctx.createLinearGradient(rx, y, rx + step * 1.8, y);
        grad.addColorStop(0, '#805e36');
        grad.addColorStop(0.5, '#c8a068');
        grad.addColorStop(1, '#7a5932');
        ctx.fillStyle = grad;
        ctx.fillRect(rx, y + 1, step * 1.75, step - 2);
      }
      ctx.fillStyle = 'rgba(65,42,20,0.38)';
      ctx.fillRect(0, y, 256, 1.5);
    }
    return makeTexture(c, 3, 2, true);
  }

  // Detailed chickweed leaf (はこべ) texture with fine venation, including torn edge fibers
  function createChickweedLeafTexture(tornHalf) {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // Rich fresh spring green gradient
    const g = ctx.createLinearGradient(128, 240, 128, 16);
    g.addColorStop(0, '#4f8f3c');
    g.addColorStop(0.45, '#68ab48');
    g.addColorStop(1, '#84c258');

    ctx.save();
    ctx.beginPath();
    if (!tornHalf) {
      // Whole ovate pointed chickweed leaf
      ctx.moveTo(128, 244);
      ctx.bezierCurveTo(36, 200, 24, 96, 128, 12);
      ctx.bezierCurveTo(232, 96, 220, 200, 128, 244);
    } else if (tornHalf === 'left') {
      // Left torn piece with jagged organic tear line
      ctx.moveTo(128, 244);
      ctx.bezierCurveTo(36, 200, 24, 96, 128, 12);
      ctx.lineTo(136, 48);
      ctx.lineTo(114, 78);
      ctx.lineTo(138, 112);
      ctx.lineTo(116, 146);
      ctx.lineTo(134, 182);
      ctx.lineTo(120, 216);
      ctx.closePath();
    } else {
      // Right torn piece with matching organic tear edge
      ctx.moveTo(128, 12);
      ctx.bezierCurveTo(232, 96, 220, 200, 128, 244);
      ctx.lineTo(120, 216);
      ctx.lineTo(134, 182);
      ctx.lineTo(116, 146);
      ctx.lineTo(138, 112);
      ctx.lineTo(114, 78);
      ctx.lineTo(136, 48);
      ctx.closePath();
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();

    // Subtle cellular texture mottling
    const rand = seededRand(tornHalf === 'left' ? 201 : tornHalf === 'right' ? 202 : 200);
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(190,235,140,0.09)' : 'rgba(42,88,30,0.09)';
      ctx.beginPath();
      ctx.arc(rand() * 256, rand() * 256, 3 + rand() * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central midrib vein
    ctx.strokeStyle = 'rgba(205, 238, 155, 0.85)';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 242);
    ctx.quadraticCurveTo(126, 128, 128, 20);
    ctx.stroke();

    // Fine branching lateral veins (細かな葉脈)
    for (let i = 0; i < 7; i++) {
      const y = 212 - i * 27;
      const span = Math.sin(((i + 0.8) / 8) * Math.PI) * 82;
      for (const dir of [-1, 1]) {
        ctx.strokeStyle = 'rgba(208, 240, 162, 0.72)';
        ctx.lineWidth = 2.0 - i * 0.14;
        ctx.beginPath();
        ctx.moveTo(128, y);
        ctx.quadraticCurveTo(128 + dir * span * 0.55, y - 10, 128 + dir * span, y - 34);
        ctx.stroke();

        // Secondary delicate veinlets
        ctx.strokeStyle = 'rgba(218, 245, 178, 0.45)';
        ctx.lineWidth = 0.9;
        for (let j = 1; j <= 3; j++) {
          const t = j * 0.26;
          const vx = 128 + dir * span * t;
          const vy = y - 34 * t * t - 4;
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(vx + dir * 14, vy - 12);
          ctx.stroke();
        }
      }
    }

    // Highlight bright fresh fibrous veins along torn edge if torn!
    if (tornHalf) {
      const pts = [[128, 12], [136, 48], [114, 78], [138, 112], [116, 146], [134, 182], [120, 216], [128, 244]];
      ctx.strokeStyle = 'rgba(225, 250, 188, 0.92)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      // Tiny exposed vein filaments sticking out at the tear
      ctx.strokeStyle = 'rgba(235, 255, 200, 0.95)';
      ctx.lineWidth = 1.3;
      const side = tornHalf === 'left' ? 1 : -1;
      for (let i = 1; i < pts.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(pts[i][0] - side * 8, pts[i][1]);
        ctx.lineTo(pts[i][0] + side * 6, pts[i][1] - 4);
        ctx.stroke();
      }
    }

    ctx.restore();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Brown mother hen layered feather texture
  function createHenFeatherTexture() {
    const rand = seededRand(305);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#9a5b32');
    bg.addColorStop(0.5, '#864a26');
    bg.addColorStop(1, '#6f3b1e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    // Overlapping scalloped warm brown feathers
    const rows = 18;
    const cols = 14;
    const rw = 512 / cols;
    const rh = 512 / rows;
    for (let r = -1; r < rows + 1; r++) {
      for (let col = -1; col < cols + 1; col++) {
        const cx = col * rw + (r % 2 ? rw * 0.5 : 0) + (rand() - 0.5) * 4;
        const cy = r * rh + (rand() - 0.5) * 3;
        const tone = (rand() - 0.5) * 26;
        const cr = Math.min(220, Math.max(70, 146 + tone)) | 0;
        const cg = Math.min(165, Math.max(40, 86 + tone * 0.65)) | 0;
        const cb = Math.min(110, Math.max(22, 48 + tone * 0.4)) | 0;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.ellipse(0, 0, rw * 0.64, rh * 0.85, 0, 0, Math.PI * 2);
        const fg = ctx.createRadialGradient(0, -rh * 0.25, 2, 0, 0, rh * 0.9);
        fg.addColorStop(0, `rgb(${Math.min(255, cr + 26)},${Math.min(255, cg + 20)},${Math.min(255, cb + 14)})`);
        fg.addColorStop(0.75, `rgb(${cr},${cg},${cb})`);
        fg.addColorStop(1, `rgb(${Math.max(30, cr - 28)},${Math.max(18, cg - 22)},${Math.max(12, cb - 14)})`);
        ctx.fillStyle = fg;
        ctx.fill();

        // Delicate feather rachis & barbs
        ctx.strokeStyle = 'rgba(235, 190, 138, 0.22)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -rh * 0.55);
        ctx.lineTo(0, rh * 0.65);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(242, 205, 158, 0.14)';
        ctx.lineWidth = 0.75;
        for (let k = -3; k <= 3; k++) {
          ctx.beginPath();
          ctx.moveTo(0, k * 4);
          ctx.lineTo(rw * 0.45, k * 4 + 5);
          ctx.moveTo(0, k * 4);
          ctx.lineTo(-rw * 0.45, k * 4 + 5);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    return makeTexture(c, 2, 2, true);
  }

  // Soft downy fine-hair bump/roughness map for baby chicks
  function createChickDownBumpTexture() {
    const rand = seededRand(512);
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1800; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const len = 5 + rand() * 9;
      const ang = -Math.PI * 0.5 + (rand() - 0.5) * 1.1;
      const bright = rand() > 0.45 ? 168 : 96;
      ctx.strokeStyle = `rgba(${bright},${bright},${bright},0.38)`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    return makeTexture(c, 3, 3, false);
  }

  // Outdoor morning spring grass & earthy soil texture
  function createGardenGrassTexture() {
    const rand = seededRand(619);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5e8844';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle earthy & sunlit patches
    for (let i = 0; i < 160; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 14 + rand() * 44;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      const col = rand() > 0.35 ? 'rgba(128,170,76,0.24)' : 'rgba(98,84,56,0.22)';
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Tiny grass blades
    for (let i = 0; i < 900; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const ang = rand() * Math.PI * 2;
      const len = 8 + rand() * 18;
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(136,184,82,0.5)' : 'rgba(72,115,48,0.45)';
      ctx.lineWidth = 1.2 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    return makeTexture(c, 4, 4, true);
  }

  // Flat garden stone texture
  function createStoneTexture() {
    const rand = seededRand(808);
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9b988e';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 900; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 1 + rand() * 5;
      const v = (118 + rand() * 65) | 0;
      ctx.fillStyle = `rgba(${v},${v - 2},${v - 8},0.28)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return makeTexture(c, 1, 1, true);
  }

  window.PiyoTextures = {
    createWoodTexture,
    createStrawBedTexture,
    createTerracottaTextures,
    createCeramicTexture,
    createBasketTexture,
    createChickweedLeafTexture,
    createHenFeatherTexture,
    createChickDownBumpTexture,
    createGardenGrassTexture,
    createStoneTexture
  };
})();
