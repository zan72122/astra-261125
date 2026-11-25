// Procedural realistic PBR canvas textures for こやぎの もぐもぐ
(function () {
  'use strict';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function configureTexture(canvas, isColor = true, repeatX = 1, repeatY = 1) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (isColor && THREE.SRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  }

  // Authentic goat eye with pale golden-amber iris and horizontal rectangular pupil
  function createGoatEyeTexture(isMother = false) {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');

    // Warm ivory sclera around the outer periphery
    ctx.fillStyle = '#ddd6c7';
    ctx.fillRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const irisR = size * 0.39;

    // Subtle dark limbal border
    const limbal = ctx.createRadialGradient(cx, cy, irisR * 0.78, cx, cy, irisR * 1.06);
    limbal.addColorStop(0, isMother ? '#b5924a' : '#c7a75b');
    limbal.addColorStop(0.76, isMother ? '#8c6d33' : '#9f7f3e');
    limbal.addColorStop(0.93, '#4f3e22');
    limbal.addColorStop(1, 'rgba(210, 200, 185, 0)');
    ctx.fillStyle = limbal;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR * 1.06, 0, Math.PI * 2);
    ctx.fill();

    // Golden-ochre iris base (natural goat iris, never oversized dark eye)
    const irisGrad = ctx.createRadialGradient(cx, cy - irisR * 0.06, irisR * 0.14, cx, cy, irisR);
    irisGrad.addColorStop(0, isMother ? '#c5a050' : '#d6b76c');
    irisGrad.addColorStop(0.55, isMother ? '#b18b3f' : '#c4a254');
    irisGrad.addColorStop(0.88, isMother ? '#7d5f29' : '#8c6e34');
    irisGrad.addColorStop(1, '#4a3a20');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Fine natural radial iris striations
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, irisR * 0.96, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2 + (Math.random() - 0.5) * 0.04;
      const r0 = irisR * 0.26;
      const r1 = irisR * (0.85 + Math.random() * 0.13);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(245, 224, 165, 0.22)' : 'rgba(72, 52, 22, 0.2)';
      ctx.lineWidth = 1.2 + Math.random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();

    // True horizontal rectangular goat pupil (横長の瞳)
    const pw = irisR * 1.18;
    const ph = irisR * 0.34;
    const pr = ph * 0.42;
    const px = cx - pw * 0.5;
    const py = cy - ph * 0.5;

    ctx.fillStyle = '#181410';
    ctx.beginPath();
    ctx.moveTo(px + pr, py);
    ctx.lineTo(px + pw - pr, py);
    ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
    ctx.lineTo(px + pw, py + ph - pr);
    ctx.quadraticCurveTo(px + pw, py + ph, px + pw - pr, py + ph);
    ctx.lineTo(px + pr, py + ph);
    ctx.quadraticCurveTo(px, py + ph, px, py + ph - pr);
    ctx.lineTo(px, py + pr);
    ctx.quadraticCurveTo(px, py, px + pr, py);
    ctx.closePath();
    ctx.fill();

    // Subtle soft velvet shadow right around the pupil edge
    ctx.strokeStyle = 'rgba(42, 30, 14, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Subtle natural outdoor sky catchlight (small, realistic, not anime sparkle)
    const catchGrad = ctx.createRadialGradient(
      cx - irisR * 0.26, cy - irisR * 0.26, 1,
      cx - irisR * 0.26, cy - irisR * 0.26, irisR * 0.16
    );
    catchGrad.addColorStop(0, 'rgba(255, 252, 240, 0.58)');
    catchGrad.addColorStop(1, 'rgba(255, 252, 240, 0)');
    ctx.fillStyle = catchGrad;
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.26, cy - irisR * 0.26, irisR * 0.16, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Soft natural goat coat texture (white, light fawn, or mother cream-oat)
  function createFurTexture(variant = 'white') {
    const w = 512, h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    if (variant === 'white') {
      // Clean soft natural white (not yellowish!)
      ctx.fillStyle = '#f2f0ec';
      ctx.fillRect(0, 0, w, h);
    } else if (variant === 'fawn') {
      // Soft light caramel / tan base, gentle natural saturation
      ctx.fillStyle = '#cbb08e';
      ctx.fillRect(0, 0, w, h);
      // Soft natural cream/lighter patches (low-medium natural contrast)
      const patches = [
        [120, 140, 125, 95, 'rgba(235, 224, 206, 0.55)'],
        [370, 290, 140, 110, 'rgba(234, 223, 205, 0.48)'],
        [240, 410, 130, 85, 'rgba(182, 149, 114, 0.34)'],
        [410, 90, 110, 85, 'rgba(179, 146, 112, 0.28)'],
      ];
      for (const [px, py, rx, ry, col] of patches) {
        const g = ctx.createRadialGradient(px, py, rx * 0.15, px, py, rx);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(203, 176, 142, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Mother goat: warm soft ivory-oat with delicate taupe shading
      ctx.fillStyle = '#e7dfd1';
      ctx.fillRect(0, 0, w, h);
      const mg = ctx.createLinearGradient(0, 0, 0, h);
      mg.addColorStop(0, 'rgba(196, 178, 152, 0.32)');
      mg.addColorStop(0.55, 'rgba(235, 228, 214, 0.08)');
      mg.addColorStop(1, 'rgba(188, 170, 145, 0.24)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, w, h);
    }

    // Layered soft hair strands for velvety realism
    const strandCount = 3400;
    for (let i = 0; i < strandCount; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 10 + Math.random() * 18;
      const ang = Math.PI * 0.5 + (Math.random() - 0.5) * 0.45;
      const light = Math.random() > 0.48;
      if (variant === 'white') {
        ctx.strokeStyle = light ? 'rgba(255, 254, 252, 0.38)' : 'rgba(218, 214, 206, 0.28)';
      } else if (variant === 'fawn') {
        ctx.strokeStyle = light ? 'rgba(244, 234, 218, 0.30)' : 'rgba(155, 124, 92, 0.24)';
      } else {
        ctx.strokeStyle = light ? 'rgba(250, 246, 238, 0.32)' : 'rgba(176, 159, 136, 0.22)';
      }
      ctx.lineWidth = 0.8 + Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    return configureTexture(c, true, 1, 1);
  }

  function createFurBumpTexture() {
    const w = 256, h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 7 + Math.random() * 12;
      const ang = Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;
      const v = Math.random() > 0.5 ? 165 : 95;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    return configureTexture(c, false, 2, 2);
  }

  // Soft feathered alpha texture for backlit ear-rim & cheek peach-fuzz
  function createFuzzAlphaTexture() {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);

    // Fine radiating fuzz hairs
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r0 = 18 + Math.random() * 12;
      const r1 = 44 + Math.random() * 18;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0);
      ctx.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1);
      ctx.stroke();
    }
    return configureTexture(c, false, 1, 1);
  }

  // Aged amber/caramel ranch fence wood (擦れて飴色)
  function createWoodTexture(variant = 'fence') {
    const w = 512, h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    if (variant === 'fence') {
      ctx.fillStyle = '#a4774c';
    } else if (variant === 'basket') {
      ctx.fillStyle = '#b98f5c';
    } else {
      ctx.fillStyle = '#976c44';
    }
    ctx.fillRect(0, 0, w, h);

    // Subtle sun-bleached warmth & rubbed highlights
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(232, 198, 148, 0.22)');
    wash.addColorStop(0.5, 'rgba(130, 88, 48, 0.08)');
    wash.addColorStop(1, 'rgba(92, 60, 32, 0.24)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    // Horizontal wood grain lines
    for (let y = 0; y < h; y += 2) {
      const wave = Math.sin(y * 0.08) * 6;
      const dark = Math.random() > 0.45;
      ctx.strokeStyle = dark
        ? `rgba(82, 52, 26, ${0.07 + Math.random() * 0.14})`
        : `rgba(236, 202, 152, ${0.06 + Math.random() * 0.11})`;
      ctx.lineWidth = 1 + Math.random() * 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.33, y + wave, w * 0.66, y - wave * 0.7, w, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    // Two subtle knots
    for (let k = 0; k < 2; k++) {
      const kx = 90 + Math.random() * (w - 180);
      const ky = 50 + Math.random() * (h - 100);
      const kg = ctx.createRadialGradient(kx, ky, 2, kx, ky, 22);
      kg.addColorStop(0, 'rgba(72, 44, 22, 0.55)');
      kg.addColorStop(0.6, 'rgba(110, 70, 35, 0.25)');
      kg.addColorStop(1, 'rgba(110, 70, 35, 0)');
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 26, 11, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    return configureTexture(c, true, 1, 1);
  }

  function createWoodBumpTexture() {
    const w = 256, h = 128;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = 95 + Math.floor(Math.random() * 65);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (Math.random() - 0.5) * 3);
      ctx.stroke();
    }
    return configureTexture(c, false, 1, 1);
  }

  // Dusty golden dry hay texture (乾いてほこりっぽい金色)
  function createHayTexture() {
    const w = 256, h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c8aa66';
    ctx.fillRect(0, 0, w, h);

    const tones = ['#d7bc78', '#bfa05c', '#e0ca8a', '#ab8d4c', '#cbb170'];
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 24 + Math.random() * 52;
      const ang = (Math.random() - 0.5) * Math.PI;
      ctx.strokeStyle = tones[i % tones.length];
      ctx.lineWidth = 1.2 + Math.random() * 2.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    return configureTexture(c, true, 1, 1);
  }

  // Glossy orange carrot skin with delicate horizontal root rings
  function createCarrotTexture() {
    const w = 256, h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#dc631d');
    g.addColorStop(0.55, '#eb7524');
    g.addColorStop(1, '#cf5919');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 42; i++) {
      const y = Math.random() * h;
      const x = Math.random() * w;
      const len = 18 + Math.random() * 56;
      ctx.strokeStyle = 'rgba(155, 62, 14, 0.32)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    return configureTexture(c, true, 1, 1);
  }

  // Fresh cut carrot cross-section (オレンジ色の断面)
  function createCarrotCutTexture() {
    const s = 128;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const cx = s / 2, cy = s / 2;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 0.5);
    g.addColorStop(0, '#f7b25a');
    g.addColorStop(0.45, '#f29032');
    g.addColorStop(0.62, '#e36c1c');
    g.addColorStop(0.92, '#ed7a25');
    g.addColorStop(1, '#c75214');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // Subtle crisp radial cambium ring
    ctx.strokeStyle = 'rgba(255, 224, 165, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    return configureTexture(c, true, 1, 1);
  }

  // Galvanized dull tin bucket texture (ブリキの鈍い反射)
  function createTinTexture() {
    const w = 256, h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#adb4b8';
    ctx.fillRect(0, 0, w, h);

    // Galvanized zinc crystalline spangles
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 8 + Math.random() * 24;
      const v = 154 + Math.floor(Math.random() * 44);
      ctx.fillStyle = `rgba(${v},${v + 3},${v + 5},0.35)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + Math.random() * 0.5;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Subtle horizontal bucket seam ribs
    ctx.fillStyle = 'rgba(70, 76, 82, 0.22)';
    ctx.fillRect(0, h * 0.34, w, 4);
    ctx.fillRect(0, h * 0.68, w, 4);

    return configureTexture(c, true, 2, 1);
  }

  // Sunlit afternoon pasture ground texture
  function createGroundTexture() {
    const w = 512, h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    // Warm sunlit sage/meadow grass (never neon!)
    ctx.fillStyle = '#8b9d5e';
    ctx.fillRect(0, 0, w, h);

    // Soft organic dirt & warm sun-baked grass variations
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 18 + Math.random() * 58;
      const isWarm = Math.random() > 0.45;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, isWarm ? 'rgba(164, 152, 92, 0.28)' : 'rgba(104, 128, 66, 0.28)');
      g.addColorStop(1, 'rgba(139, 157, 94, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine grass blade texture strokes
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 5 + Math.random() * 10;
      const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 0.8;
      const pick = i % 3;
      ctx.strokeStyle = pick === 0
        ? 'rgba(182, 186, 114, 0.28)'
        : pick === 1
          ? 'rgba(98, 122, 62, 0.26)'
          : 'rgba(156, 140, 88, 0.22)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    return configureTexture(c, true, 12, 12);
  }

  window.KoyagiTextures = {
    createGoatEyeTexture,
    createFurTexture,
    createFurBumpTexture,
    createFuzzAlphaTexture,
    createWoodTexture,
    createWoodBumpTexture,
    createHayTexture,
    createCarrotTexture,
    createCarrotCutTexture,
    createTinTexture,
    createGroundTexture
  };
})();
