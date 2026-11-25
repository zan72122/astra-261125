'use strict';
const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const clamp = (a, lo, hi) => Math.max(lo, Math.min(hi, a)), lerp = T.MathUtils.lerp;
const ease = (x) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x)
};
const follow = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
let seed = 733751;
function rnd() {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296
}
const canvas = document.getElementById('barn');
const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.09;
const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, .08, 100);
scene.background = new T.Color(0xcce2dd);
scene.fog = new T.FogExp2(0xe4e4cd, .026);
function group(parent, x = 0, y = 0, z = 0) {
  let g = new T.Group();
  parent.add(g);
  g.position.set(x, y, z);
  return g
}
function mat(color, roughness = .65, metalness = 0, extra = {}) {
  return new T.MeshStandardMaterial({color, roughness, metalness, ...extra})
}
function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
  let m = new T.Mesh(geo, material);
  parent.add(m);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m
}
const unitSphere = new T.SphereGeometry(1, 40, 28);
function egg(p, x, y, z, a, b, c, m) {
  let o = mesh(p, unitSphere, m, x, y, z);
  o.scale.set(a, b, c);
  return o
}
function cyl(p, x, y, z, rt, rb, h, m, n = 36) {
  return mesh(p, new T.CylinderGeometry(rt, rb, h, n), m, x, y, z)
}
function rod(p, a, b, r, m, r2 = r, n = 24) {
  let d = b.clone().sub(a), o = cyl(p, 0, 0, 0, r2, r, d.length(), m, n);
  o.position.copy(a).lerp(b, .5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o
}
function tube(p, pts, r, m, segments = 28) {
  return mesh(p, new T.TubeGeometry(new T.CatmullRomCurve3(pts), segments, r, 8, false), m)
}
function ring(p, x, y, z, r, t, m, axis = 'z') {
  let o = mesh(p, new T.TorusGeometry(r, t, 10, 64), m, x, y, z);
  if (axis === 'x') o.rotation.y = Math.PI / 2;
  if (axis === 'y') o.rotation.x = Math.PI / 2;
  return o
}
function makeCanvas(w, h) {
  let c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c
}
function texture(c) {
  let t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t
}
function noise(x, y) {
  let i = Math.floor(x), j = Math.floor(y), fx = ease(x - i), fy = ease(y - j);
  function hash(a, b) {
    let n = Math.imul(a + 71, 374761393) + Math.imul(b + 49, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  return lerp(lerp(hash(i, j), hash(i + 1, j), fx), lerp(hash(i, j + 1), hash(i + 1, j + 1), fx), fy)
}
function grain(id) {
  let c = makeCanvas(896, 192), ctx = c.getContext('2d'), im = ctx.createImageData(c.width, c.height);
  let knots = Array.from({length: 3}, () => [rnd(), rnd(), .018 + rnd() * .024]);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    let u = x / c.width, v = y / c.height, off = id * 13, warp = (noise(u * 2 + off, v * 4) - .5) * .027 + (noise(u * 7,
      v * 14 + off) - .5) * .006, knot = 0;
    for (let[kx, ky, size]of knots) {
      let du = (u - kx) * 1.9, dv = (v - ky) * .45, d = Math.sqrt(du * du + dv * dv);
      warp += Math.sign(dv) * size * .7 * Math.exp(-d * d * 300);
      knot += Math.exp(-d * d * 9000) * .33
    }
    let f = (v + warp), vein = Math.pow(.5 + .5 * Math.sin(f * 470 + noise(u * 5 + off, f * 41) * 8), 7);
    let tone = .86 + .22 * (noise(u * 3 + off, f * 19) - .5) + .13 * (noise(u * 17, f * 88) - .5) - .087 * vein + .044 * (rnd() - .5) - knot;
    let k = (y * c.width + x) * 4;
    im.data[k] = 237 * tone;
    im.data[k + 1] = 214 * tone;
    im.data[k + 2] = 174 * tone;
    im.data[k + 3] = 255
  }
  ctx.putImageData(im, 0, 0);
  return texture(c)
}
let grains = [grain(1), grain(2), grain(3)];
function timber(color, id = 0) {
  return mat(color, .62, 0, {map: grains[id % 3], bumpMap: grains[id % 3], bumpScale: .011})
}
const honey = [0xc8a477, 0xb99168, 0xd6b486, 0xbf9b74, 0xcfaa7c, 0xb89774].map((c, i) => timber(c, i));
const structural = timber(0x926d48, 2), edgeWood = timber(0xb89467, 1), darkWood = timber(0x775336, 0), sandWood = timber(0xd0aa78,
  2);
const pewter = mat(0xb8bbb1, .27, .86), iron = mat(0x50534a, .4, .71), brass = mat(0xb69a60, .33, .71), blackIron = mat(0x3d3d33,
  .58, .5);
function boxGeometry(w, h, d, r) {
  r = Math.min(r, w * .47, h * .47, d * .47);
  let g = new T.BoxGeometry(1, 1, 1, 6, 6, 6), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv,
    dim = [w, h, d];
  let axis = dim.indexOf(Math.max(...dim));
  for (let i = 0; i < pos.count; i++) {
    let a = [pos.getX(i), pos.getY(i), pos.getZ(i)], face = [nor.getX(i), nor.getY(i), nor.getZ(i)], q = [], nn = [];
    for (let j = 0; j < 3; j++) {
      let v = a[j] * 2, l = dim[j] * .5;
      q[j] = Math.abs(v) < .01 ? 0: Math.sign(v) * (l - r * 1.54 * (1 - Math.abs(v)));
      nn[j] = q[j] - clamp(q[j], -l + r, l - r)
    }
    let len = Math.hypot(...nn) || 1;
    for (let j = 0; j < 3; j++) {
      q[j] = q[j] - nn[j] + r * nn[j] / len;
      nn[j] /= len
    }
    pos.setXYZ(i, ...q);
    nor.setXYZ(i, ...nn);
    let faceAxis = face.findIndex(v => Math.abs(v) > .5), vert = [0, 1, 2].find(j => j !== axis && j !== faceAxis);
    if (faceAxis !== axis) uv.setXY(i, q[axis] / dim[axis] + .5, q[vert] / dim[vert] + .5);
  }
  return g
}
function box(p, x, y, z, w, h, d, m, r = .012) {
  return mesh(p, boxGeometry(w, h, d, r), m, x, y, z)
}
function nail(p, x, y, z, s = .023) {
  let o = egg(p, x, y, z, s, s * .94, s * .33, blackIron);
  return o
}
// A local light probe supplies the long window reflections on wet skin, glass and metal.
{
  let c = makeCanvas(512, 256), g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ddedea');
  grad.addColorStop(.44, '#e7d9b4');
  grad.addColorStop(.53, '#927453');
  grad.addColorStop(1, '#53463a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#fffcec';
    g.fillRect(60 + i * 32, 68, 28, 50)
  }
  g.fillStyle = '#fff5cd';
  g.fillRect(360, 84, 46, 55);
  let e = texture(c);
  e.mapping = T.EquirectangularReflectionMapping;
  let gen = new T.PMREMGenerator(renderer);
  scene.environment = gen.fromEquirectangular(e).texture;
  scene.environmentIntensity = .49;
  gen.dispose();
  e.dispose()
}
scene.add(new T.HemisphereLight(0xfff5df, 0xaa8869, 1.32));
const sunlight = new T.DirectionalLight(0xffebc6, 3.35);
sunlight.position.set(-4.5, 6.0, -7.3);
sunlight.target.position.set(.5, 1, .7);
scene.add(sunlight, sunlight.target);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
Object.assign(sunlight.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 22});
sunlight.shadow.bias = -.00032;
sunlight.shadow.normalBias = .014;
sunlight.shadow.radius = 2.5;
const softbox = new T.DirectionalLight(0xfff4de, 1.42);
softbox.position.set(-3, 4, 5);
scene.add(softbox);
const windowLight = new T.SpotLight(0xffdf9e, 0, 6, .235, .56, 2);
windowLight.position.set(-1.85, 2.08, -2.22);
scene.add(windowLight, windowLight.target);
const barn = group(scene), outdoors = group(scene);
const ground = mat(0x91815c, .96);
box(barn, 0, -.13, 1, 15, .25, 14, ground);
for (let i = 0; i < 15; i++) box(barn, -5 + i * .71, -.053, 1, .70, .095, 9, honey[(i + 2) % 6], .007);
// Honey-coloured boards surround an open, deep-set window.
const wallZ = -2.05;
for (let i = 0; i < 25; i++) {
  let x = -6 + i * .50;
  if (x > -3.5 && x < .65) {
    box(barn, x, .38, wallZ, .492, .78, .14, honey[i % 6]);
    box(barn, x, 5.51, wallZ, .493, 2.02, .15, honey[(i + 3) % 6])
  } else box(barn, x, 3.03, wallZ, .49, 6.12, .155, honey[i % 6]);
}
for (let x of [-3.76, .76, 3.68]) {
  box(barn, x, 2.8, wallZ + .12, .19, 5.7, .27, structural, .017);
  for (let y of [.65, 2.9, 4.6]) nail(barn, x, y, wallZ + .265, .029)
}
box(barn, -1.49, 4.45, wallZ + .10, 4.5, .21, .32, edgeWood);
box(barn, -1.49, 2.13, wallZ + .09, 4.54, .12, .31, sandWood);
box(barn, -1.51, .79, wallZ + .09, 4.45, .14, .29, structural);
for (let x of [-2.68, -.78]) box(barn, x, 3.3, wallZ + .015, .048, 2.23, .10, edgeWood, .006);
box(barn, -1.45, 3.78, wallZ + .016, 4.43, .055, .096, edgeWood, .005);
box(barn, 0, 4.88, -1.86, 12, .29, .31, structural);
// The lower opening is narrower than the sunlit upper window.
for (const [left, right] of [[-3.75, -2.62], [-.38, .75]]) {
  const width = (right - left) / 3;
  for (let i = 0; i < 3; i++) {
    box(barn, left + width * (i + .5), 1.465, -1.80, width - .006, 1.255, .10, honey[i + 1]);
  }
}
box(barn, -1.50, .825, -1.83, 2.32, .065, .23, edgeWood);
box(barn, -1.50, 2.103, -1.83, 2.32, .068, .23, edgeWood);
const shutter = group(barn, -1.5, 1.46, -1.95);
for (let i = 0; i < 6; i++) box(shutter, -.93 + i * .373, 0, 0, .37, 1.22, .11, honey[(i + 1) % 6]);
box(shutter, 0, .43, .082, 2.23, .102, .10, edgeWood);
box(shutter, 0, -.44, .082, 2.23, .10, .10, edgeWood);
const pull = group(shutter, .75, .02, .12);
rod(pull, V(0, 0, 0), V(0, 0, .095), .054, darkWood);
egg(pull, 0, 0, .12, .116, .111, .075, sandWood);
for (let x of [-2.97, 0, 2.53]) {
  box(barn, x, .95, -1.62, .13, 1.95, .17, structural)
}
box(barn, .65, 1.13, -1.65, 7.6, .155, .16, edgeWood);
box(barn, 2.85, 2.02, -1.65, 4, .16, .18, edgeWood);
let brace = box(barn, 2.08, 3.6, -1.87, 3.45, .16, .18, edgeWood);
brace.rotation.z = .61;
for (let x of [-4.3, 3.6]) {
  box(barn, x, 2.9, 1.58, .24, 5.9, .28, structural);
  let b = box(barn, x + (x < 0 ? .42: -.42), 4.58, 1.58, 1.45, .17, .22, structural);
  b.rotation.z = x < 0 ? .81: -.81
}
box(barn, 0, 5.11, 1.58, 9, .27, .29, structural);
// The pasture has solid terrain, field fences and distant tree crowns.
box(outdoors, 0, -.28, -20, 85, .4, 45, mat(0xa6af69, 1));
let hillM = [0x98ae87, 0x849d77, 0xb4be85, 0xa7b57b].map(v => mat(v, 1));
for (let i = 0; i < 15; i++) {
  let o = egg(outdoors, -32 + i * 4.7, -1.75, -17 - rnd() * 10, 7 + rnd() * 6, 2.6 + rnd() * 1.5, 4 + rnd() * 4,
    hillM[i % 4]);
  o.castShadow = false
}
const treePaint = [0x718850, 0x809352, 0x92a45f, 0xa9b86d, 0x63804f].map(v => mat(v, .96));
let leafGeo = new T.IcosahedronGeometry(1, 1);
function tree(x, y, z, s) {
  let p = group(outdoors, x, y, z);
  p.scale.setScalar(s);
  rod(p, V(), V(.06, 1.45, 0), .12, structural, .068, 9);
  for (let j = 0; j < 12; j++) {
    let a = j * 2.4, rr = .28 + rnd() * .60, xx = Math.cos(a) * rr, zz = Math.sin(a) * rr, yy = 1.45 + rnd() * .64;
    let o = mesh(p, leafGeo, treePaint[j % 5], xx, yy, zz);
    o.scale.set(.52 + rnd() * .35, .55 + rnd() * .4, .5 + rnd() * .32);
    o.castShadow = false
  }
}
for (let[x, z, s]of [[-5.4, -6.5, 1.45], [-3.8, -12, 1.04], [.4, -11, 1.2], [4, -8, 1.6], [-9, -10, 1.3], [2, -15,
  1.15]]) tree(x, 0, z, s);
{
  let leaves = [], normals = [], colors = [], indices = [];
  outdoors.traverse(o => {
    if (o.geometry !== leafGeo) return ;
    o.updateWorldMatrix(true, false);
    for (let j = 0; j < 130; j++) {
      let a = rnd() * TAU, v = rnd() * 2 - 1, h = Math.sqrt(1 - v * v), n = V(h * Math.cos(a), v, h * Math.sin(a)),
        q = n.clone().multiplyScalar(.91 + rnd() * .16).applyMatrix4(o.matrixWorld), len = .027 + rnd() * .061,
        w = len * (.23 + rnd() * .20), dir = V(Math.cos(a), .21 + rnd() * .48, Math.sin(a)).normalize(), side = V(-Math.sin(a),
        .16, Math.cos(a)).normalize(), tip = q.clone().addScaledVector(dir, len), mid = q.clone().lerp(tip, .54),
        start = leaves.length / 3, c = new T.Color().setHSL(.204 + rnd() * .045, .21 + rnd() * .18, .27 + rnd() * .21);
      for (let point of [q, mid.clone().addScaledVector(side, w), tip, mid.clone().addScaledVector(side, -w), mid.clone().add(V(0,
        w * .52, 0))]) {
        leaves.push(...point.toArray());
        normals.push(n.x * .65, .68 + n.y * .22, n.z * .65);
        colors.push(c.r, c.g, c.b)
      }
      indices.push(start, start + 1, start + 4, start + 1, start + 2, start + 4, start + 2, start + 3, start + 4,
        start + 3, start, start + 4)
    }
  });
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(leaves, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  let foliage = mesh(outdoors, g, mat(0xffffff, .94, 0, {vertexColors: true, side: T.DoubleSide}));
  foliage.castShadow = false;
}
for (let i = 0; i < 14; i++) {
  let x = -13 + i * 2;
  box(outdoors, x, .48, -6.6, .12, .96, .12, edgeWood);
  if (i < 13) {
    box(outdoors, x + 1, .66, -6.62, 2, .092, .085, sandWood);
    box(outdoors, x + 1, .36, -6.62, 2, .08, .07, sandWood)
  }
}
function strands(p, verts, colors, width = 1) {
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  let obj = new T.LineSegments(g, new T.LineBasicMaterial({vertexColors: true, linewidth: width}));
  p.add(obj);
  return obj
}
let grass = [], grassC = [];
for (let i = 0; i < 8000; i++) {
  let x = rnd() * 23 - 12, z = -2.8 - rnd() * 12, h = .045 + rnd() * .12;
  grass.push(x, 0, z, x + .03, h, z - .015);
  let c = new T.Color().setHSL(.16 + rnd() * .03, .22 + rnd() * .17, .32 + rnd() * .16);
  grassC.push(c.r, c.g, c.b, c.r * 1.19, c.g * 1.16, c.b)
}
strands(outdoors, grass, grassC);
let straw = [], strawC = [];
for (let i = 0; i < 3200; i++) {
  let x = -4 + rnd() * 9, z = -1.7 + rnd() * 4;
  if (x < .5 && z > .0 && rnd() > .17) continue;
  let y = .008 + rnd() * .028, a = rnd() * TAU, l = .06 + rnd() * .22;
  straw.push(x, y, z, x + Math.cos(a) * l, y + .012 * rnd(), z + Math.sin(a) * l);
  let c = new T.Color().setHSL(.105 + rnd() * .025, .33, .39 + rnd() * .28);
  strawC.push(c.r, c.g, c.b, c.r, c.g, c.b)
}
strands(barn, straw, strawC);
// The near gate frames the calf without crossing its muzzle.
const gate = group(barn, 1.72, 0, .79);
box(gate, 0, .831, 0, .19, 1.69, .20, edgeWood, .023);
box(gate, 1.88, 1.46, -.048, 3.72, .155, .138, sandWood, .015);
box(gate, 1.88, .67, -.045, 3.76, .169, .14, honey[0], .016);
for (let y of [.65, 1.46]) {
  nail(gate, -.021, y, .111, .029);
  nail(gate, .049, y + .018, .111, .020)
}
let ropeMat = mat(0xa68c64, .98);
for (let i = 0; i < 3; i++) ring(gate, 0, 1.24 + i * .024, .004, .143, .013, ropeMat, 'y');
tube(gate, [V(-.10, 1.25, .1), V(-.13, 1.09, .135), V(-.08, .966, .14), V(-.025, 1.055, .14), V(.013, 1.252, .132)],
  .013, ropeMat);
const motesGeo = new T.BufferGeometry(), motePositions = [];
for (let i = 0; i < 62; i++) motePositions.push(rnd() * 4.7 - 3, rnd() * 3.6 + .4, rnd() * 2.3 - 1.9);
motesGeo.setAttribute('position', new T.Float32BufferAttribute(motePositions, 3));
const motes = new T.Points(motesGeo, new T.PointsMaterial({color: 0xffedbe, size: .008, transparent: true, opacity: .53,
  depthWrite: false}));
scene.add(motes);
// Keep the shader and draw-call cost of fixed joinery low on a phone.
function batchSolids(root, excluded = []) {
  root.updateWorldMatrix(true, true);
  let inv = root.matrixWorld.clone().invert(), batches = new Map(), reserved = new Set();
  for (let object of excluded) object.traverse(o => reserved.add(o));
  root.traverse(o => {
    if (!o.isMesh || o.children.length || reserved.has(o) || o.material.transparent || Array.isArray(o.material)) return ;
    let key = o.material.uuid + '_' + o.castShadow + '_' + o.receiveShadow;
    let arr = batches.get(key) || [];
    arr.push(o);
    batches.set(key, arr)
  });
  for (let objects of batches.values()) {
    if (objects.length < 3) continue;
    let arrays = {position: [], normal: [], uv: [], color: []}, index = [], offset = 0, hasColor = objects[0].material.vertexColors;
    for (let o of objects) {
      let g = o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)), n = g.attributes.position.count;
      for (let k of ['position', 'normal', 'uv', 'color']) {
        if (k === 'color' && !hasColor) continue;
        if (g.attributes[k]) {
          for (let v of g.attributes[k].array) arrays[k].push(v)
        } else if (k === 'uv') {
          for (let j = 0; j < n * 2; j++) arrays.uv.push(0)
        }
      }
      if (g.index) {
        for (let v of g.index.array) index.push(v + offset)
      } else {
        for (let j = 0; j < n; j++) index.push(offset + j)
      }
      offset += n;
      g.dispose();
      o.removeFromParent()
    }
    let g = new T.BufferGeometry();
    for (let k of Object.keys(arrays)) if (arrays[k].length) g.setAttribute(k, new T.Float32BufferAttribute(arrays[k],
      k === 'uv' ? 2: 3));
    g.setIndex(index);
    let o = mesh(root, g, objects[0].material);
    o.castShadow = objects[0].castShadow;
    o.receiveShadow = objects[0].receiveShadow;
  }
}
batchSolids(barn, [shutter]);
batchSolids(outdoors);
