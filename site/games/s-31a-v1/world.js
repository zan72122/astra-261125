'use strict';
const T = THREE, PI = Math.PI, TAU = 2 * PI, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
const smooth = t => (t = clamp(t), t * t * (3 - 2 * t));
const v3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
let seed = 31971;
function rnd() {
  seed = (Math.imul(1664525, seed) + 1013904223)>>>0;
  return seed / 4294967296
}
const range = (a, b) => mix(a, b, rnd()), color = v => new T.Color(v);
const canvas = document.querySelector('canvas');
const renderer = new T.WebGLRenderer( {canvas, antialias : true, alpha : false, powerPreference : 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
const scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 1, .05, 65);
scene.background = color(0xbac5a7);
scene.fog = new T.FogExp2(0xd1cdb5, .038);
function material(c, rough = .75, extra = {}) {
  return new T.MeshStandardMaterial( {color : c, roughness : rough, ...extra})
}
function group(parent = scene) {
  const g = new T.Group();
  parent.add(g);
  return g
}
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const o = new T.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o
}
const ballGeo = new T.SphereGeometry(1, 32, 24), smallBall = new T.SphereGeometry(1, 14, 10), tinyBall = new T.SphereGeometry(1, 8, 5), cube = new T.BoxGeometry();
function oval(p, m, x, y, z, a, b, c, geo = ballGeo) {
  const o = mesh(p, geo, m, x, y, z);
  o.scale.set(a, b, c);
  return o
}
function box(p, m, x, y, z, a, b, c) {
  const o = mesh(p, cube, m, x, y, z);
  o.scale.set(a, b, c);
  return o
}
function tube(p, m, pts, r = .02) {
  const curve = new T.CatmullRomCurve3(pts);
  return mesh(p, new T.TubeGeometry(curve, Math.max(8, pts.length * 3), r, 7, false), m)
}
function lathe(p, m, pts, n = 72) {
  return mesh(p, new T.LatheGeometry(pts.map(a => new T.Vector2(...a)), n), m)
}
function ring(p, m, x, y, z, r, w) {
  const a = mesh(p, new T.TorusGeometry(r, w, 8, 96), m, x, y, z);
  a.rotation.x = PI / 2;
  return a
}
function instance(p, geo, m, items) {
  const obj = new T.InstancedMesh(geo, m, items.length), dummy = new T.Object3D();
  items.forEach((d, i) => {
    dummy.position.set(...d.p);
    dummy.scale.set(...d.s);
    dummy.rotation.set(...(d.r || [0, 0, 0]));
    dummy.updateMatrix();
    obj.setMatrixAt(i, dummy.matrix);
    if (d.c)obj.setColorAt(i, color(d.c))
  });
  obj.receiveShadow = true;
  p.add(obj);
  return obj
}
function texture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t
}
function flecks(g, w, h, n, light, dark) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() < .48 ? light : dark;
    g.fillRect(rnd() * w, rnd() * h, range(.4, 2.2), range(.7, 3.2))
  }
}
const woodMap = texture(384, 1024, (g, w, h) => {
  g.fillStyle = '#bb936c';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2100; i++) {
    let x = rnd() * w, y = rnd() * h;
    g.strokeStyle = rnd() < .56 ? 'rgba(85,53,27,.10)' : 'rgba(252,220,167,.17)';
    g.lineWidth = range(.35, 2.6);
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 10, y + 60, x - 8, y + 125, x + 3, y + range(170, 340));
    g.stroke()
  }
  flecks(g, w, h, 21000, '#eac69b28', '#70523822')
});
const wood = material(0xe9cfac, .51, {map : woodMap}), trim = material(0xb2916b, .54, {map : woodMap});
const plaster = material(0xd3ccb4), frame = material(0xe7dcc3, .6), cloth = material(0xb7ad91, .99);
scene.add(new T.HemisphereLight(0xfff1d5, 0xd9ab90, 1.55));
const sun = new T.DirectionalLight(0xffe7bd, 2.75);
sun.position.set(-4, 7.5, -3);
sun.target.position.set(.2, 0, .65);
scene.add(sun, sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left : -5, right : 5, top : 5, bottom : -5, near : .1, far : 17});
sun.shadow.bias = -.00045;
sun.shadow.normalBias = .009;
const fill = new T.DirectionalLight(0xeaefec, 1.05);
fill.position.set(2, 4, 5);
scene.add(fill);
const floor = group();
box(floor, trim, 0, -.13, 0, 17, .14, 16);
const planks = [];
for (let i = -12; i <= 12; i++)for (let j = -3; j <= 3; j++)planks.push( {p : [i * .58, -.068, j * 2.22 + (i % 3) * .66], s : [.575, .075, 2.212], c : new T.Color().setHSL(.085, range(.11, .21), range(.72, .91)).getHex()});
instance(floor, cube, wood, planks);
const rugTexture = texture(1200, 1536, (g, w, h) => {
  g.fillStyle = '#993f34';
  g.fillRect(0, 0, w, h);
  function rect(n, c, k) {
    g.strokeStyle = c;
    g.lineWidth = k;
    g.strokeRect(n, n, w - 2 * n, h - 2 * n)
  }
  rect(10, '#64372e', 14);
  rect(21, '#c49b6c', 7);
  rect(43, '#713c34', 35);
  rect(67, '#d0a47b', 5);
  rect(77, '#704e46', 9);
  rect(88, '#c69165', 4);
  rect(102, '#7f352d', 14);
  function leaf(x, y, a, s, c) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-s * .43, -s * .66, 0, -s);
    g.quadraticCurveTo(s * .46, -s * .61, 0, 0);
    g.fill();
    g.restore()
  }
  function bloom(x, y, s, a, muted) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    const pet = muted ? '#aa5542' : '#bc875f', gem = muted ? '#c17c59' : '#e0b78c';
    for (let k = 0; k < 8; k++) {
      leaf(0, 0, k * PI / 4, s * (k % 2 ? .7 : 1), k % 2 ? (muted ? '#824739' : '#798781') : pet)
    }
    g.fillStyle = gem;
    g.beginPath();
    g.arc(0, 0, s * .18, 0, TAU);
    g.fill();
    g.restore()
  }
  for (let i = 45; i < w - 35; i += 42) {
    bloom(i, 43, 15, 0, false);
    bloom(i, h - 43, 15, 0, false)
  }
  for (let i = 84; i < h - 65; i += 42) {
    bloom(43, i, 15, 0, false);
    bloom(w - 43, i, 15, 0, false)
  }
  g.save();
  g.beginPath();
  g.rect(111, 111, w - 222, h - 222);
  g.clip();
  for (let j = -1; j < 10; j++)for (let i = -1; i < 8; i++) {
    const x = i * 176 + (j % 2) * 88 + 55, y = j * 151 + 20;
    bloom(x, y, 27, j * PI / 4, true);
    for (let k = 0; k < 4; k++) {
      const a = k * PI / 2 + PI * .25;
      leaf(x + Math.sin(a) * 33, y - Math.cos(a) * 33, a, 15, '#aa5b47')
    }
  }
  g.restore();
  for (let y = 0; y < h; y += 2) {
    g.fillStyle = y % 6 ? 'rgba(52,29,26,.09)' : 'rgba(255,220,170,.12)';
    g.fillRect(0, y, w, .8)
  }
  flecks(g, w, h, 95000, 'rgba(249,207,151,.22)', 'rgba(52,29,24,.22)');
});
const rug = mesh(scene, new T.BoxGeometry(5.75, .06, 6.1), [material(0x874e3b), material(0x874e3b), material(0xffffff, .99, {map : rugTexture, bumpMap : rugTexture, bumpScale : .012}), material(0x763d32), material(0x8b493b), material(0x8b493b)], 0, .001, 0);
const fringe = [];
for (let i = 0; i < 265; i++)for (const k of [-1, 1])fringe.push( {p : [-2.85 + i * .0217, .008, k * 3.08], s : [.007, .008, range(.05, .095)], r : [0, range(-.18, .18), 0]});
instance(scene, tinyBall, material(0xc6a982), fringe);
const shadeTex = texture(128, 128, (g, w, h) => {
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(43,25,13,.58)');
  grad.addColorStop(.48, 'rgba(48,27,17,.34)');
  grad.addColorStop(1, 'rgba(50,30,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h)
});
function shadow(p, x, y, z, w, d, alpha = .5) {
  const o = mesh(p, new T.PlaneGeometry(w, d), new T.MeshBasicMaterial( {map : shadeTex, transparent : true, opacity : alpha, depthWrite : false, polygonOffset : true, polygonOffsetFactor : -1}), x, y, z);
  o.rotation.x = -PI / 2;
  o.castShadow = o.receiveShadow = false;
  return o
}
// A low wooden garden window with a deep sill and a softly planted garden beyond.
const glassZ = -3.3;
box(scene, plaster, 0, .13, -3.42, 16, .34, .24);
box(scene, wood, 0, .29, -3.27, 14, .105, .49);
for (const x of [-4.6, -2.02, 1.90, 4.55]) {
  box(scene, frame, x, 2.65, -3.44, .115, 4.75, .16);
  box(scene, wood, x - .064, 2.65, -3.49, .025, 4.73, .13)
}
for (const y of [.39, 2.97, 4.95])box(scene, frame, 0, y, -3.47, 15, .095, .15);
const glass = material(0xdbede1, .16, {transparent : true, opacity : .075, depthWrite : false});
box(scene, glass, 0, 2.67, glassZ - .07, 14, 4.6, .018).castShadow = false;
const garden = group();
box(garden, material(0x8c9b67), 0, -.28, -9, 25, .4, 13);
const leaves = [];
for (let i = 0; i < 74; i++) {
  let x = range(-10, 10), z = range(-12, -5.5), y = range(-.2, 2.8);
  leaves.push( {p : [x, y, z], s : [range(.48, 1.32), range(.48, 1.28), range(.45, 1)], c : new T.Color().setHSL(range(.18, .23), range(.19, .42), range(.21, .53)).getHex()})
}
instance(garden, new T.IcosahedronGeometry(1, 2), material(0xffffff, .96), leaves);
const twigs = material(0x645d43);
for (let k = 0; k < 8; k++) {
  let x = range(-7, 7), z = range(-9.5, -5.9);
  tube(garden, twigs, [v3(x, -.3, z), v3(x + .1, 1.5, z), v3(x - .25, 3, z), v3(x + .43, 5.6, z)], .068);
  for (let i = 0; i < 3; i++)tube(garden, twigs, [v3(x, 1.3 + i * .5, z), v3(x + .45, 2 + i * .5, z), v3(x + 1, 2.4 + i * .5, z - .2)], .032)
}
const leafGeo = new T.BufferGeometry();
leafGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, -1, -.57, .09, -.45, .60, .06, -.45, -.76, .08, .24, .78, .065, .24, 0, 0, 1, 0, .24, 0], 3));
leafGeo.setIndex([0, 1, 6, 0, 6, 2, 1, 3, 6, 2, 6, 4, 3, 5, 6, 6, 5, 4]);
leafGeo.computeVertexNormals();
const canopy = [];
for (let b = 0; b < 84; b++) {
  const x = range(-8, 8), y = range(1.05, 5.4), z = range(-9, -5.2), a = range(-PI, PI);
  for (let j = 0; j < 25; j++) {
    const r = range(.04, .61), theta = range(0, TAU);
    canopy.push( {p : [x + Math.cos(theta) * r, y + Math.sin(theta) * r * .61, z + range(-.24, .24)], s : [range(.065, .13), range(.07, .13), range(.09, .17)], r : [range(-1.5, 1.5), a + theta, range(-1, 1)], c : new T.Color().setHSL(range(.17, .24), range(.24, .52), range(.26, .60)).getHex()})
  }
}
instance(garden, leafGeo, material(0xffffff, .7, {side : T.DoubleSide}), canopy);
const drops = [];
for (let i = 0; i < 170; i++)drops.push( {p : [range(-5, 5), range(.43, 4.9), glassZ - .085], s : [range(.004, .015), range(.01, .034), .008]});
const rain = instance(scene, tinyBall, material(0xd8eee2, .14, {transparent : true, opacity : .46}), drops);
const travelingDrops = [];
for (let i = 0; i < 12; i++) {
  let x = range(-3.8, 3.8), y = range(.5, 4.7);
  travelingDrops.push(oval(scene, material(0xbccfc1, .09, {transparent : true, opacity : .5}), x, y, glassZ - .08, .013, .037, .009, smallBall))
}
// A linen chair and a living plant frame the two sides of the room.
const chair = group();
chair.position.set(3.63, 0, -.55);
chair.rotation.y = -.2;
for (const x of [-.7, .7])for (const z of [-.54, .54])box(chair, trim, x, .33, z, .12, .65, .13);
box(chair, wood, 0, .51, 0, 1.7, .17, 1.45);
oval(chair, cloth, 0, .69, 0, .96, .22, .82);
const back = oval(chair, cloth, 0, 1.26, -.60, .96, .71, .22);
back.rotation.x = -.16;
const pot = group();
pot.position.set(-3.12, 0, -1.87);
lathe(pot, material(0xac7655, .88), [[.25, 0], [.36, .05], [.4, .5], [.43, .56], [.43, .6], [.37, .6], [.35, .54]]);
oval(pot, material(0x504131), 0, .55, 0, .36, .05, .36);
const plantMats = [0x476548, 0x62784c, 0x748653].map(c => material(c, .62));
for (let i = 0; i < 15; i++) {
  const a = i * 2.4, r = range(.23, .65), h = range(.85, 1.65), p = v3(Math.cos(a) * r, h, Math.sin(a) * r);
  tube(pot, plantMats[0], [v3(0, .5, 0), v3(p.x * .27, h * .86, p.z * .27), p], .011);
  const o = oval(pot, plantMats[i % 3], p.x, p.y, p.z, .13, .026, .31);
  o.rotation.set(-.28, a + .8, range(-.5, .5))
}

// Surrounding room and garden light, used only for reflections in the materials.
const roomLight = texture(256, 128, (g, w, h) => {
  const warm = g.createLinearGradient(0, 0, 0, h);
  warm.addColorStop(0, '#ddd6c3');
  warm.addColorStop(.43, '#adaea0');
  warm.addColorStop(.56, '#8e8775');
  warm.addColorStop(1, '#735b4b');
  g.fillStyle = warm;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#faf3d8';
  for (let j = 0; j < 2; j++)for (let i = 0; i < 4; i++)g.fillRect(32 + i * 11, 32 + j * 14, 10, 13)
});
roomLight.mapping = T.EquirectangularReflectionMapping;
scene.environment = roomLight;
scene.environmentIntensity = .3;
const linenMap = texture(96, 128, (g, w, h) => {
  g.fillStyle = '#f0e5d0';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 2) {
    g.fillStyle = 'rgba(120,105,87,.14)';
    g.fillRect(i, 0, .65, h)
  }
  for (let j = 0; j < h; j += 2) {
    g.fillStyle = 'rgba(125,109,89,.09)';
    g.fillRect(0, j, w, .7)
  }
});
linenMap.wrapS = linenMap.wrapT = T.RepeatWrapping;
linenMap.repeat.set(3, 8);
const linen = material(0xf7e8cd, .98, {map : linenMap, side : T.DoubleSide});
for (const side of [-1, 1]) {
  const g = new T.PlaneGeometry(1, 1, 54, 26), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + .5, t = p.getY(i) + .5, pleat = Math.cos(u * PI * 11.3 + .23 * Math.sin(t * 3 + u));
    p.setXYZ(i, side * (2.77 + (u - .5) * mix(1.12, .83, t)), .42 + t * 4.59 + .034 * pleat * (1 - t), -3.05 + .108 * pleat + .035 * Math.sin(t * 5 + u * 3))
  }
  g.computeVertexNormals();
  mesh(scene, g, linen)
}
