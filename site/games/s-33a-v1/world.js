"use strict";
const T = THREE, PI = Math.PI, TAU = 2 * PI, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const clamp = (n, a, b) => Math.max(a, Math.min(n, b)), mix = T.MathUtils.lerp;
const smooth = (a, b, t) => {
  const f = clamp((t - a) / (b - a), 0, 1);
  return f * f * (3 - 2 * f);
};
let seed = 36512;

function rand() {
  seed = Math.imul(1664525, seed) + 1013904223 >>> 0;
  return seed / 4294967296;
}
const canvas = document.querySelector("canvas");
const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, 0.08, 100);
scene.background = new T.Color(0xc7e2dc);
scene.fog = new T.FogExp2(0xc1d9d3, 0.019);
const portrait = innerWidth / innerHeight < 0.87;
const W = portrait ? 6.9 : 10.8, D = portrait ? 7.9 : 6.8, FLOOR = portrait ? -3.95 : -3.25;
const front = D / 2, back = -front;
const timeU = { value: 0 };

function group(parent = scene) {
  const g = new T.Group();
  parent.add(g);
  return g;
}

function mat(color, roughness = 0.54, metalness = 0, extra = {}) {
  return new T.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function mesh(geo, m, p = scene) {
  const o = new T.Mesh(geo, m);
  p.add(o);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const sphere = new T.SphereGeometry(1, 28, 20), sphereLow = new T.SphereGeometry(1, 12, 9);

function egg(p, m, x, y, z, sx, sy, sz, low = false) {
  const o = mesh(low ? sphereLow : sphere, m, p);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  return o;
}

function box(p, m, x, y, z, w, h, d) {
  const o = mesh(new T.BoxGeometry(w, h, d), m, p);
  o.position.set(x, y, z);
  return o;
}

function rounded(p, m, x, y, z, w, h, d, r = 0.08) {
  const shape = new T.Shape(), a = w / 2 - r, b = h / 2 - r, q = Math.min(r, d * 0.4, w * 0.21, h * 0.21) * 0.5;
  shape.moveTo(-a, -h / 2);
  shape.lineTo(a, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -b);
  shape.lineTo(w / 2, b);
  shape.quadraticCurveTo(w / 2, h / 2, a, h / 2);
  shape.lineTo(-a, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, b);
  shape.lineTo(-w / 2, -b);
  shape.quadraticCurveTo(-w / 2, -h / 2, -a, -h / 2);
  const geo = new T.ExtrudeGeometry(shape, { depth: Math.max(2e-3, d - 2 * q), bevelThickness: q, bevelSize: q, bevelSegments: 3, curveSegments: 5 });
  geo.center();
  const o = mesh(geo, m, p);
  o.position.set(x, y, z);
  return o;
}

function rod(p, m, a, b, r, seg = 12, r2 = r) {
  const delta = b.clone().sub(a);
  const o = mesh(new T.CylinderGeometry(r2, r, delta.length(), seg), m, p);
  o.position.copy(a).lerp(b, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), delta.normalize());
  return o;
}

function tube(p, m, points, r = 0.03, seg = 36) {
  const curve = new T.CatmullRomCurve3(points.map((s) => Array.isArray(s) ? V(...s) : s));
  return mesh(new T.TubeGeometry(curve, seg, r, 8, false), m, p);
}

function lathe(p, m, points, segments = 64) {
  return mesh(new T.LatheGeometry(points.map(([x, y]) => new T.Vector2(x, y)), segments), m, p);
}

function tex(c, repeat = 1) {
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.setScalar(repeat);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function grit(size) {
  const c = makeCanvas(size, size), ctx = c.getContext("2d"), im = ctx.createImageData(size, size);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 208 + rand() * 45;
    im.data.set([v, v, v, 255], i);
  }
  ctx.putImageData(im, 0, 0);
  return tex(c, 3);
}
const grain = grit(192);
// A tileable mineral texture supplies the small-scale detail between the rock's fracture planes.

function granite() {
  const size = 384, c = makeCanvas(size, size), ctx = c.getContext("2d"), im = ctx.createImageData(size, size);
  const fields = [5, 16, 48].map((n) => ({ n, a: Float32Array.from({ length: n * n }, () => rand()) }));
  function sample(field, x, y) {
    const n = field.n, u = x * n / size, v = y * n / size, i = Math.floor(u), j = Math.floor(v);
    const a = smooth(0, 1, u - i), b = smooth(0, 1, v - j), get = (dx, dy) => field.a[(j + dy) % n * n + (i + dx) % n];
    return mix(mix(get(0, 0), get(1, 0), a), mix(get(0, 1), get(1, 1), a), b);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const g = sample(fields[0], x, y), m = sample(fields[1], x, y), q = sample(fields[2], x, y), crystal = rand();
    const mica = crystal > 0.975 ? 32 : crystal < 0.07 ? -33 : 0;
    const vein = 12 * Math.exp(-Math.abs(Math.sin(TAU * (y * 2 / size + x / size) + g * 5 + m)) * 22);
    const v = 165 + 42 * g + 23 * m + 25 * q + mica + vein + (rand() - 0.5) * 21, idx = (y * size + x) * 4;
    im.data.set([v + 4 * m, v + 2 * g, v - 4 * q, 255], idx);
  }
  ctx.putImageData(im, 0, 0);
  return tex(c, 2);
}
const sun = new T.DirectionalLight(0xfff0ca, 3.25);
sun.position.set(-5, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.1, far: 35 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = 0.024;
sun.shadow.bias = -25e-5;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(new T.HemisphereLight(0xe7f9ff, 0x9cad9d, 1.9));
const rim = new T.DirectionalLight(0xd9f7ff, 1.65);
rim.position.set(3.5, 6, -7);
scene.add(rim);
// A local studio environment gives the wet feathers, enamel and steel different reflections.
const sky = new T.Scene();
sky.background = new T.Color(0xabcbd3);
for (const [x, y, z, w, h, col, intensity] of [[-6, 8, 5, 8, 7, 0xffffff, 4], [8, 2, 1, 2, 7, 0xfff5ce, 2], [-3, 2, -8, 8, 5, 0xd5f6ff, 2], [1, -5, 0, 20, 14, 0x66796e, 0.7], [4, 1, -6, 2, 5, 0x18383b, 0.6]]) {
  const lightCard = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(intensity), side: T.DoubleSide }));
  lightCard.position.set(x, y, z);
  lightCard.lookAt(0, 0, 0);
  sky.add(lightCard);
}
const pmrem = new T.PMREMGenerator(renderer);
const env = pmrem.fromScene(sky, 0.08);
scene.environment = env.texture;
scene.environmentIntensity = 0.56;
pmrem.dispose();
const metal = mat(0x97a9a9, 0.28, 0.83), darkMetal = mat(0x344e50, 0.45, 0.66), brass = mat(0xc59951, 0.33, 0.66);
const enamel = mat(0x507f7c, 0.34, 0.54), ivory = mat(0xf4e6c6, 0.35, 0.18), rubber = mat(0x293f40, 0.84, 0.06);
const orange = mat(0xd96232, 0.28, 0.36), ropeMat = mat(0xa68a59, 0.85, 0.04);

function tiled(c1, c2, grout, n = 4) {
  const c = makeCanvas(512, 512), g = c.getContext("2d"), s = 512 / n;
  g.fillStyle = grout;
  g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * s, y = j * s;
    g.fillStyle = new T.Color(c1).lerp(new T.Color(c2), rand()).getStyle();
    g.fillRect(x + 1.7, y + 1.7, s - 3.4, s - 3.4);
    g.fillStyle = "rgba(255,255,248,.25)";
    g.fillRect(x + 2, y + 2, s - 4, 1.5);
    g.fillStyle = "rgba(49,72,59,.12)";
    g.fillRect(x + 2, y + s - 3, s - 4, 1.5);
  }
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = rand() * 5 - 2.5;
    for (let k = 0; k < 3; k++) img.data[i + k] += d;
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

function plane(p, m, x, y, z, w, h, floor = false) {
  const o = mesh(new T.PlaneGeometry(w, h), m, p);
  o.position.set(x, y, z);
  if (floor) o.rotation.x = -PI / 2;
  o.castShadow = false;
  return o;
}

function caustic(m, strength = 0.35) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.wetTime = timeU;
    sh.vertexShader = "varying vec3 wetWorld;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nwetWorld=(modelMatrix*vec4(transformed,1.)).xyz;");
    sh.fragmentShader = "varying vec3 wetWorld; uniform float wetTime;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
 vec2 cp=wetWorld.xz*3.3+wetWorld.y*vec2(.38,.54);
 cp+=vec2(sin(cp.y*1.13+wetTime*.57),cos(cp.x*.92-wetTime*.31))*.49;
 float c1=sin(cp.x*1.52+sin(cp.y*1.13+wetTime*.36)) + sin(cp.y*1.43+sin(cp.x*.81-wetTime*.33));
 float c2=cos(cp.x*1.34+.67*sin(cp.y*1.54-wetTime*.41))+cos(cp.y*1.15+.92*cos(cp.x+wetTime*.35));
 float lightNet=pow(max(0.,1.-abs(c1+.15*c2)),8.)+.36*pow(max(0.,1.-abs(c2)),12.);
 diffuseColor.rgb+=vec3(.38,.86,.85)*lightNet*${strength.toFixed(2)}*(1.-smoothstep(-.15,.18,wetWorld.y));`);
  };
  m.customProgramCacheKey = () => String(strength);
  return m;
}

function wpos(o, x = 0, y = 0, z = 0) {
  return o.localToWorld(V(x, y, z));
}
