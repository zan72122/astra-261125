'use strict';
// The grid stores volume per unit area. Transport, loading the blade and licking
// all debit the same cells that supply the material.
class PasteField {
  constructor(nx, nz, width, depth, allowed) {
    Object.assign(this, {nx, nz, width, depth, allowed});
    this.sx = width / (nx - 1);
    this.sz = depth / (nz - 1);
    this.area = this.sx * this.sz;
    this.h = new Float32Array(nx * nz);
    this.work = new Float32Array(nx * nz);
    this.dirty = true;
  }
  x(i) {
    return (i % this.nx) * this.sx - this.width / 2
  }
  z(i) {
    return Math.floor(i / this.nx) * this.sz - this.depth / 2
  }
  at(x, z) {
    const i = Math.round(clamp((x / this.width + .5)) * (this.nx - 1)), j = Math.round(clamp(z / this.depth + .5) * (this.nz - 1));
    return this.h[j * this.nx + i]
  }
  each(x, z, rx, rz, fn) {
    const a = Math.max(0, Math.floor((x - rx + this.width / 2) / this.sx)), b = Math.min(this.nx - 1, Math.ceil((x + rx + this.width / 2) / this.sx));
    const c = Math.max(0, Math.floor((z - rz + this.depth / 2) / this.sz)), d = Math.min(this.nz - 1, Math.ceil((z + rz + this.depth / 2) / this.sz));
    for (let j = c; j <= d; j++)for (let k = a; k <= b; k++) {
      const i = j * this.nx + k, xx = this.x(i), zz = this.z(i);
      if (this.allowed(xx, zz))fn(i, xx - x, zz - z)
    }
  }
  deposit(x, z, r, vol, stretch = 1) {
    if (vol <= 0)return 0;
    let total = 0;
    const kernel = (dx, dz) => Math.pow(Math.max(0, 1 - dx * dx / (r * r) - dz * dz / (r * r * stretch * stretch)), 1.27);
    this.each(x, z, r, r * stretch, (i, dx, dz) => {
      total += kernel(dx, dz)
    });
    if (!total)return 0;
    this.each(x, z, r, r * stretch, (i, dx, dz) => {
      this.h[i] += vol * kernel(dx, dz) / (total * this.area)
    });
    this.dirty = true;
    return vol
  }
  scrape(x, z, ux, uz, width, depth, fraction, film, groove = null) {
    let volume = 0;
    const radius = Math.hypot(width, depth);
    this.each(x, z, radius, radius, (i, dx, dz) => {
      let side = (dx * uz - dz * ux) / width, along = (dx * ux + dz * uz) / depth;
      const w = 1 - side * side - along * along;
      if (w <= 0)return;
      const floor = film + (groove ? groove(i) : 0);
      const take = Math.max(0, this.h[i] - floor) * Math.min(1, w * 2.4) * fraction;
      this.h[i] -= take;
      volume += take * this.area
    });
    if (volume)this.dirty = true;
    return volume
  }
  smear(x, z, ux, uz, step, speed, load, terrain, surface, vertical = false) {
    const fast = clamp((speed - .19) / 1.75), width = mix(.177, .130, fast);
    const h = this.at(x, z), floor = mix(.006, .002, fast);
    const cut = this.scrape(x, z, ux, uz, width, .103, clamp(step / .037), floor, i => {
      const px = this.x(i), pz = this.z(i), side = Math.abs((px - x) * uz - (pz - z) * ux) / width;
      return terrain(px, pz) * (1 - smooth((side - .4) / .46)) * (1 - .78 * Math.abs(uz))
    });
    load += cut * .76;
    // Low shoulders remain outside the path of the flat middle of the blade.
    for (const s of [-1, 1]) {
      const part = cut * .12;
      load += part - this.deposit(x + uz * width * .84 * s, z - ux * width * .84 * s, .041, part)
    }
    const give = Math.min(load, load * (1 - Math.exp(-step * mix(2.35, .43, fast))) + Math.min(h, .1) * step * .0008);
    const supply = give * (vertical ? 1 - .20 * uz : 1);
    let laid = 0;
    for (let j = -4; j <= 4; j++) {
      const a = j / 4, w = (1 - .35 * a * a) / (9 - .35 * 3.75);
      const px = x + uz * a * width * .7, pz = z - ux * a * width * .7;
      const crest = clamp(surface(px, pz) / .023);
      // A quick pass touches the high points. The rest travels on the blade.
      const contact = mix(1, .055 + .945 * crest, fast);
      const slip = vertical && px > .04 ? clamp((.046 - surface(px, pz)) / .046) : 0;
      laid += this.deposit(px, pz, .036, Math.min(load - laid, supply * w * contact * (1 + .16 * slip)));

    }
    return Math.max(0, load - laid)
  }
  fall(dt, support) {
    this.work.fill(0);
    let moving = false;
    for (let j = this.nz - 2; j >= 0; j--)for (let k = 1; k < this.nx - 1; k++) {
      const i = j * this.nx + k, x = this.x(i), z = this.z(i), a = this.h[i], n = i + this.nx;
      if (a < .046 || !this.allowed(x, z + this.sz))continue;
      const excess = Math.max(0, a - support(x, z) - .041), move = Math.min(excess, Math.max(0, a - this.h[n] + .018)) * dt * .33;
      if (move > 1e-7) {
        this.work[i] -= move;
        this.work[n] += move;
        moving = true
      }
    }
    if (moving) {
      for (let i = 0; i < this.h.length; i++)this.h[i] += this.work[i];
      this.dirty = true
    }
  }
  volume() {
    return this.h.reduce((a, b) => a + b, 0) * this.area
  }
}
function pasteSurface(parent, field, base, substrate, offset = .0009) {
  const g = new T.BufferGeometry(), n = field.h.length, positions = new Float32Array(n * 3), colors = new Float32Array(n * 3), idx = [], baseY = new Float32Array(n);
  const tint = color(0x994e38), dark = color(0x784331);
  for (let i = 0; i < n; i++) {
    let x = field.x(i), z = field.z(i);
    positions[3 * i] = x;
    positions[3 * i + 2] = z;
    baseY[i] = base(x, z) + offset;
    const c = tone(tint, dark, .25 + .18 * Math.sin(x * 40 + z * 31) * Math.sin(z * 24 - x * 17) + range(-.12, .13));
    colors.set([c.r, c.g, c.b], i * 3);
    if (i % field.nx < field.nx - 1 && i < n - field.nx) {
      let a = i, b = i + 1, c = i + field.nx, d = c + 1;
      idx.push(a, c, b, b, c, d)
    }
  }
  g.setIndex(idx);
  g.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  g.setAttribute('layer', new T.BufferAttribute(field.h, 1).setUsage(T.DynamicDrawUsage));
  g.computeVertexNormals();
  const m = material(0xffffff, .56, {vertexColors : true, side : T.DoubleSide});
  const backlight = {value : 0};
  m.onBeforeCompile = shader => {
    shader.uniforms.underTone = {value : color(substrate)};
    shader.uniforms.windowLight = backlight;
    shader.vertexShader = 'attribute float layer; varying float wetLayer;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nwetLayer=layer;');
    shader.fragmentShader = 'varying float wetLayer; uniform vec3 underTone; uniform float windowLight;\n' + shader.fragmentShader
    .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif(wetLayer<0.00085)discard;')
    .replace('#include <color_fragment>', '#include <color_fragment>\nfloat coverage=1.0-exp(-wetLayer*mix(118.0,87.0,windowLight)); diffuseColor.rgb=mix(underTone*(1.0+windowLight*.06),diffuseColor.rgb,coverage);')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nfloat wetEdge=smoothstep(.001,.019,fwidth(wetLayer)); roughnessFactor=mix(.66,.32,wetEdge);')
  };

  const o = mesh(parent, g, m);
  o.castShadow = false;
  o.frustumCulled = false;
  return {object : o, backlight, refresh(bend = 0) {
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) {
      let z = positions[3 * i + 2];
      p.setY(i, baseY[i] + field.h[i] + bend * Math.pow(clamp((z + .96) / 1.92), 2))
    }
    p.needsUpdate = true;
    g.attributes.layer.needsUpdate = true;
    g.computeVertexNormals();
    field.dirty = false
  }}
}
