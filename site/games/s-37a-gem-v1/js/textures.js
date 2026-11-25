(function (global) {
  'use strict';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function configureTex(tex, isColor = true, repeatX = 1, repeatY = 1) {
    if (isColor && THREE.SRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    if (repeatX !== 1 || repeatY !== 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    tex.needsUpdate = true;
    return tex;
  }

  // Realistic wet sea otter fur texture (albedo + bump)
  function createFurTextures(baseHex, tipHex, seed = 1) {
    const w = 256, h = 256;
    const colCanvas = makeCanvas(w, h);
    const colCtx = colCanvas.getContext('2d');
    const bumpCanvas = makeCanvas(w, h);
    const bumpCtx = bumpCanvas.getContext('2d');

    colCtx.fillStyle = baseHex;
    colCtx.fillRect(0, 0, w, h);

    bumpCtx.fillStyle = '#787878';
    bumpCtx.fillRect(0, 0, w, h);

    let s = seed * 9301 + 49297;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // Soft undercoat mottling
    for (let i = 0; i < 160; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 10 + rand() * 24;
      const grad = colCtx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rand() > 0.5 ? 'rgba(255,244,230,0.06)' : 'rgba(22,12,6,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      colCtx.fillStyle = grad;
      colCtx.beginPath();
      colCtx.arc(x, y, r, 0, Math.PI * 2);
      colCtx.fill();
    }

    // Fine directional wet fur strands (clumped softly like real wet sea otter pelage)
    for (let i = 0; i < 2400; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 8 + rand() * 14;
      const lean = (rand() - 0.5) * 3.5;

      const light = rand() > 0.42;
      colCtx.strokeStyle = light ? tipHex : 'rgba(28, 17, 11, 0.34)';
      colCtx.globalAlpha = 0.22 + rand() * 0.35;
      colCtx.lineWidth = 0.9 + rand() * 1.4;
      colCtx.beginPath();
      colCtx.moveTo(x, y);
      colCtx.quadraticCurveTo(x + lean * 0.5, y + len * 0.5, x + lean, y + len);
      colCtx.stroke();

      const bVal = Math.floor(110 + rand() * 110);
      bumpCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
      bumpCtx.globalAlpha = 0.35;
      bumpCtx.lineWidth = 1.0 + rand() * 1.1;
      bumpCtx.beginPath();
      bumpCtx.moveTo(x, y);
      bumpCtx.lineTo(x + lean, y + len);
      bumpCtx.stroke();
    }
    colCtx.globalAlpha = 1;
    bumpCtx.globalAlpha = 1;

    return {
      map: configureTex(new THREE.CanvasTexture(colCanvas), true, 2, 2),
      bumpMap: configureTex(new THREE.CanvasTexture(bumpCanvas), false, 2, 2)
    };
  }

  // Glossy ash-white / pale grey clam shell with concentric growth rings
  function createClamTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#b9bcb9');
    grad.addColorStop(0.35, '#d7d6cf');
    grad.addColorStop(0.75, '#c1beb4');
    grad.addColorStop(1, '#9c988e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Natural subtle chevron / ring bands of Japanese asari clam
    for (let y = 10; y < 256; y += 13) {
      ctx.strokeStyle = y % 26 === 10 ? 'rgba(92, 90, 84, 0.36)' : 'rgba(245, 244, 238, 0.38)';
      ctx.lineWidth = 2.6 + (y % 5) * 0.45;
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const wave = Math.sin(x * 0.08 + y * 0.05) * 4.0;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    // Subtle radial ribs
    ctx.strokeStyle = 'rgba(105, 102, 95, 0.22)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * 256;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }

    return configureTex(new THREE.CanvasTexture(c), true, 1, 1);
  }

  // Flat fan-shaped fluted scallop shell (pale pearl/ivory with warm beige-grey ribs)
  function createScallopTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(128, 230, 10, 128, 120, 220);
    grad.addColorStop(0, '#d8d0c4');
    grad.addColorStop(0.5, '#eae6de');
    grad.addColorStop(1, '#cfccc6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Fluted fan ridges
    for (let i = -9; i <= 9; i++) {
      const angle = i * 0.12;
      const ex = 128 + Math.sin(angle) * 260;
      const ey = 245 - Math.cos(angle) * 260;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(150, 142, 132, 0.34)' : 'rgba(255, 253, 248, 0.52)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(128, 245);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // Fine growth arcs
    ctx.strokeStyle = 'rgba(140, 135, 125, 0.16)';
    ctx.lineWidth = 1.5;
    for (let r = 40; r < 230; r += 26) {
      ctx.beginPath();
      ctx.arc(128, 245, r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    return configureTex(new THREE.CanvasTexture(c), true, 1, 1);
  }

  // Smooth wet dark-brown flat river stone
  function createStoneTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#504238';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 1 + Math.random() * 9;
      ctx.fillStyle = Math.random() > 0.5
        ? 'rgba(110, 96, 84, 0.22)'
        : 'rgba(34, 26, 20, 0.28)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return configureTex(new THREE.CanvasTexture(c), true, 1, 1);
  }

  // Bright sunlit sandy aquarium floor with soft ripples
  function createSandTexture() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ddd3bc';
    ctx.fillRect(0, 0, 512, 512);

    // Gentle sand ripples
    for (let y = 0; y < 512; y += 36) {
      const g = ctx.createLinearGradient(0, y, 0, y + 36);
      g.addColorStop(0, 'rgba(255, 252, 240, 0.16)');
      g.addColorStop(0.5, 'rgba(176, 162, 134, 0.18)');
      g.addColorStop(1, 'rgba(255, 252, 240, 0.12)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, y + Math.sin(x * 0.025 + y * 0.04) * 7);
      }
      ctx.lineTo(512, y + 36);
      ctx.lineTo(0, y + 36);
      ctx.closePath();
      ctx.fill();
    }

    // Fine natural sand grains & tiny pebbles
    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 0.7 + Math.random() * 1.8;
      ctx.fillStyle = Math.random() > 0.45
        ? 'rgba(155, 142, 118, 0.35)'
        : 'rgba(252, 248, 236, 0.35)';
      ctx.fillRect(x, y, r, r);
    }

    return configureTex(new THREE.CanvasTexture(c), true, 3, 3);
  }

  // Warm pale travertine/limestone pool rim texture
  function createPoolRimTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e5e0d4';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 1 + Math.random() * 6;
      ctx.fillStyle = Math.random() > 0.5
        ? 'rgba(205, 198, 184, 0.25)'
        : 'rgba(250, 248, 242, 0.28)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return configureTex(new THREE.CanvasTexture(c), true, 4, 1);
  }

  // Coastal aquarium rock texture
  function createRockTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8b877d';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 360; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const rx = 6 + Math.random() * 26;
      const ry = 3 + Math.random() * 10;
      ctx.fillStyle = Math.random() > 0.5
        ? 'rgba(118, 114, 104, 0.28)'
        : 'rgba(68, 66, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return configureTex(new THREE.CanvasTexture(c), true, 2, 2);
  }

  // Animated caustics pattern texture (organic wavy water light ribbons, no rigid hexagons)
  function createCausticsTexture() {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const tau = Math.PI * 2;

    for (let y = 0; y < size; y++) {
      const ny = (y / size) * tau;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * tau;
        // Domain-warped organic water interference ribbons (tiles seamlessly!)
        const wx = nx + 0.55 * Math.sin(ny * 2.0 + Math.cos(nx * 2.0));
        const wy = ny + 0.55 * Math.cos(nx * 2.0 - Math.sin(ny * 2.0));

        const w1 = Math.abs(Math.sin(wx * 2.0 + Math.sin(wy * 3.0) * 0.7));
        const w2 = Math.abs(Math.cos(wy * 2.0 - Math.cos(wx * 3.0) * 0.7));
        const w3 = Math.abs(Math.sin((wx + wy) * 2.0 + Math.sin((wx - wy) * 2.0) * 0.5));

        const c1 = Math.pow(1.0 - w1, 4.2);
        const c2 = Math.pow(1.0 - w2, 4.2);
        const c3 = Math.pow(1.0 - w3, 5.0) * 0.65;
        const v = Math.min(255, (c1 + c2 + c3) * 195);

        const idx = (y * size + x) * 4;
        data[idx] = v * 0.78;
        data[idx + 1] = v * 0.98;
        data[idx + 2] = v * 0.96;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return configureTex(new THREE.CanvasTexture(c), true, 3.5, 3.5);
  }

  // Soft radial particle texture for bubbles & sparkles
  function createSoftDotTexture() {
    const c = makeCanvas(64, 64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(26, 24, 3, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(225,248,252,0.55)');
    g.addColorStop(0.8, 'rgba(180,235,240,0.18)');
    g.addColorStop(1, 'rgba(180,235,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return configureTex(new THREE.CanvasTexture(c), true, 1, 1);
  }

  global.OtterTextures = {
    createFurTextures,
    createClamTexture,
    createScallopTexture,
    createStoneTexture,
    createSandTexture,
    createPoolRimTexture,
    createRockTexture,
    createCausticsTexture,
    createSoftDotTexture
  };
})(window);
