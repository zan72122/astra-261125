"use strict";
const floorMap = tiled(0xe2d9bd, 0xf1e7cd, "#b3ad99", 4);
floorMap.repeat.set(18, 18);
plane(scene, mat(0xffffff, 0.88, 0, { map: floorMap }), 0, FLOOR - 0.43, 0, 67, 67, true);
const wallMap = tiled(0xb7d3bd, 0xd4e0c6, "#9fb7a9", 4);
wallMap.repeat.set(9, 1.35);
const wall = box(scene, mat(0xffffff, 0.45, 0.06, { map: wallMap }), 0, -1.75, back - 2.7, 28, 4.1, 0.4);
box(scene, ivory, 0, 0.34, back - 2.7, 28, 0.18, 0.55);
for (let x = -13; x < 15; x += 3.6) {
  rod(scene, enamel, V(x, 0.41, back - 2.71), V(x, 1.67, back - 2.71), 0.049);
  rod(scene, metal, V(x, 0.42, back - 2.71), V(x, 0.48, back - 2.71), 0.105);
}
for (const h of [0.99, 1.65]) rod(scene, h > 1 ? brass : metal, V(-17, h, back - 2.71), V(17, h, back - 2.71), h > 1 ? 0.057 : 0.022);
const distantSea = mat(0x8ccbcc, 0.83);
box(scene, distantSea, 0, -0.01, -33, 86, 0.3, 47);
const mineral = granite();
const rockSalt = mat(0xffffff, 0.81, 0.035, { vertexColors: true, map: mineral, bumpMap: mineral, bumpScale: 0.075 });
caustic(rockSalt, 0.28);
const rockShader = rockSalt.onBeforeCompile;
rockSalt.onBeforeCompile = (shader) => {
  rockShader(shader);
  shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
  float shoreline=wetWorld.y+.028*sin(wetWorld.x*7.3+wetWorld.z*3.)+.013*sin(wetWorld.z*18.);
  float damp=1.-smoothstep(.06,.21,shoreline);
  diffuseColor.rgb*=mix(vec3(1.),vec3(.51,.69,.71),damp);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.046,.22,.24),.45*(1.-smoothstep(-2.7,-.12,wetWorld.y)));
  roughnessFactor=mix(roughnessFactor,.34,damp);
 `);
};
const rockRanges = [];

function rock(x, top, z, rx, height, rz, tone, walk = false, detail = 13) {
  const verts = [], cols = [], idx = [], levels = [0, 0.13, 0.38, 0.68, 0.9, 1], radii = [0.79, 0.99, 1, 0.96, 0.8, 0.53], rings = [];
  const phi = rand() * TAU, squeeze = Array.from({ length: detail }, () => 0.86 + rand() * 0.23), tilt = rand() * 0.05 - 0.025;
  for (let j = 0; j < levels.length; j++) {
    const ring = [];
    for (let i = 0; i < detail; i++) {
      const a = TAU * i / detail + phi, rf = radii[j] * squeeze[i] * (0.96 + 0.08 * rand()), xx = Math.cos(a) * rf, zz = Math.sin(a) * rf;
      const yy = top - height + height * levels[j] + height * (rand() - 0.5) * (j === 5 ? 0.026 : 0.075) + xx * tilt;
      ring.push(verts.length / 3);
      verts.push(x + xx * rx, yy, z + zz * rz);
      const color = new T.Color(tone).multiplyScalar(0.85 + rand() * 0.23 + (j === 5 ? 0.08 : 0));
      if (yy < 0.13) color.lerp(new T.Color(yy < -0.4 ? 0x365f60 : 0x344744), yy < -0.4 ? 0.39 : 0.53);
      cols.push(color.r, color.g, color.b);
    }
    rings.push(ring);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < detail; i++) {
    const n = (i + 1) % detail, a = rings[j][i], b = rings[j][n], c2 = rings[j + 1][n], d = rings[j + 1][i];
    idx.push(a, d, b, b, d, c2);
  }
  const center = verts.length / 3;
  verts.push(x, top + 8e-3, z);
  const c = new T.Color(tone).multiplyScalar(1.07);
  cols.push(c.r, c.g, c.b);
  for (let i = 0; i < detail; i++) idx.push(rings[5][i], center, rings[5][(i + 1) % detail]);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(verts.flatMap((v, i) => i % 3 === 0 ? [v * 0.36 + verts[i + 1] * 0.18, verts[i + 2] * 0.32 + verts[i + 1] * 0.28] : []), 2));
  geo.setIndex(idx);
  const facets = geo.toNonIndexed();
  facets.computeVertexNormals();
  geo.dispose();
  mesh(facets, rockSalt);
  if (walk) rockRanges.push({ x, z, rx, rz, top });
  return top;
}
const perch = V(-W * 0.271, 0.68, back + 1.12);
rock(perch.x, 0.68, perch.z, portrait ? 1.58 : 2.24, 2.18, 1.37, 0x737771, true);
rock(-W * 0.29, 0.4, perch.z + 0.85, portrait ? 1.15 : 1.7, 2.55, 1.15, 0x606b66, true);
rock(-W * 0.37, 0.85, back + 0.23, 1.34, 2.48, 1.02, 0x80827a, true);
rock(-W * 0.08, 0.35, back + 0.47, 1.65, 1.96, 0.97, 0x65726e, true);
rock(W * 0.32, 0.44, -0.67, portrait ? 1.15 : 1.82, 2.31, portrait ? 2.8 : 2.38, 0x6c7169, true);
rock(W * 0.4, 0.27, 1.63, 1.02, 1.88, 1.11, 0x5e6862, true);
for (let i = 0; i < 18; i++) {
  const left = i < 10, x = left ? -W * 0.42 + rand() * 0.89 : W * (0.37 + rand() * 0.1), z = back + 0.18 + rand() * (left ? D * 0.66 : D * 0.83);
  rock(x, -0.42 - rand() * 2, z, 0.47 + rand() * 0.93, 1.25 + rand(), 0.63 + rand() * 0.62, 0x61716a);
}
for (let i = 0; i < 16; i++) rock(-16 + i * 2.7, 0.4 + rand() * 1.7, -20 - rand() * 5, 2 + rand() * 3, 3, 1.8 + rand(), 0xb9c5ac, false, 9);
// Salt-tolerant tufts on the dry, rear edge of the exhibit.
const foliage = [mat(0x647c50, 0.79), mat(0x86945a, 0.8), mat(0xa4a26b, 0.81)];

function tuft(x, y, z, h, count) {
  const vs = [], cs = [], ix = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * TAU, l = (0.43 + rand() * 0.63) * h, k = (0.15 + rand() * 0.6) * h, dx = Math.cos(a), dz = Math.sin(a), w = 0.023 + rand() * 0.025, ox = x + (rand() - 0.5) * h * 0.3, oz = z + (rand() - 0.5) * h * 0.3, id = vs.length / 3;
    vs.push(ox - w * dz, y, oz + w * dx, ox + w * dz, y, oz - w * dx, ox + dx * k * 0.4 - w * dz * 0.64, y + l * 0.75, oz + dz * k * 0.4 + w * dx * 0.64, ox + dx * k * 0.4 + w * dz * 0.64, y + l * 0.75, oz + dz * k * 0.4 - w * dx * 0.64, ox + dx * k, y + l, oz + dz * k);
    ix.push(id, id + 1, id + 2, id + 1, id + 3, id + 2, id + 2, id + 3, id + 4);
    const col = foliage[i % 3].color;
    for (let j = 0; j < 5; j++) cs.push(col.r * (0.7 + 0.08 * j), col.g * (0.7 + 0.08 * j), col.b * (0.7 + 0.08 * j));
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(vs, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(cs, 3));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  mesh(geo, mat(0xffffff, 0.83, 0, { vertexColors: true, side: T.DoubleSide }));
}
tuft(-W * 0.39, 0.79, back + 0.1, 0.82, 37);
tuft(-W * 0.11, 0.34, back + 0.16, 0.44, 29);
tuft(W * 0.44, 0.39, back + 1, 0.65, 39);
const bedMap = tiled(0x9acac2, 0xb3d2bd, "#8eaea7", 4);
bedMap.repeat.set(W / 3.4, D / 3.4);
plane(scene, caustic(mat(0x72bfce, 0.82, 0, { map: bedMap }), 0.55), 0, FLOOR + 0.08, 0, W, D, true);
const shell = mat(0x386361, 0.5, 0.27), beading = mat(0x8aa99a, 0.37, 0.48);
rounded(scene, shell, 0, FLOOR - 0.13, 0, W + 0.32, 0.51, D + 0.25, 0.14);
box(scene, caustic(mat(0x398898, 0.73), 0.27), 0, FLOOR / 2, back - 0.06, W, -FLOOR, 0.17);
for (const s of [-1, 1]) {
  box(scene, enamel, s * (W * 0.5 + 0.015), 0.025, 0, 0.17, 0.2, D + 0.23);
  box(scene, ivory, s * (W * 0.5 + 0.015), 0.139, 0, 0.203, 0.043, D + 0.26);
  box(scene, enamel, s * (W * 0.5 + 0.015), FLOOR * 0.5, front + 0.04, 0.19, -FLOOR, 0.19);
  box(scene, beading, s * (W * 0.5 + 0.015), FLOOR * 0.5, front + 0.149, 0.105, -FLOOR, 0.045);
  box(scene, enamel, s * (W * 0.5 + 0.015), FLOOR * 0.5, back, 0.16, -FLOOR, 0.18);
}
box(scene, enamel, 0, 5e-3, front + 0.065, W + 0.34, 0.255, 0.2);
box(scene, ivory, 0, 0.145, front + 0.065, W + 0.38, 0.056, 0.24);
box(scene, rubber, 0, -0.151, front + 0.05, W + 0.1, 0.049, 0.16);
box(scene, beading, 0, FLOOR + 0.16, front + 0.1, W + 0.2, 0.16, 0.14);
box(scene, ivory, 0, 0.09, back - 0.06, W + 0.24, 0.09, 0.2);
const windowPane = plane(scene, new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: {}, vertexShader: "varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: `varying vec2 v;void main(){float d=1.-v.y;float gleam=.065*pow(max(0.,cos(22.*(v.x+v.y*.19))),26.); gl_FragColor=vec4(mix(vec3(.015,.53,.69),vec3(.015,.33,.47),d),.095+.19*d+gleam);
 #include <colorspace_fragment>
 }` }), 0, FLOOR / 2, front + 0.02, W, -FLOOR);
const sideGlass = windowPane.material;
for (const s of [-1, 1]) {
  const o = plane(scene, sideGlass, s * W / 2, FLOOR / 2, 0, D, -FLOOR);
  o.rotation.y = s * PI / 2;
}
const dimples = { value: [new T.Vector4(), new T.Vector4(), new T.Vector4()] };
const waterMaterial = new T.ShaderMaterial({ uniforms: { t: timeU, impacts: dimples }, transparent: true, depthWrite: false, side: T.DoubleSide, vertexShader: `
 uniform float t;uniform vec4 impacts[3];varying vec3 wp;void main(){vec3 p=position;vec4 w=modelMatrix*vec4(p,1.);w.y+=.012*sin(w.x*3.5+w.z*1.6+t*1.55)+.009*cos(w.z*5.1-t*1.2+w.x);for(int i=0;i<3;i++){vec2 off=w.xz-impacts[i].xy;w.y-=impacts[i].z*exp(-dot(off,off)*26.); }wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`, fragmentShader: `
 uniform float t;varying vec3 wp;void main(){vec2 p=wp.xz;
 float a=sin(p.x*5.2+p.y*8.+t*1.24+1.6*sin(p.y*2.+p.x*.91-t*.52));
 float b=sin(p.y*13.5-p.x*3.9-t*1.8+sin(p.x*3.+p.y-t*.5)*1.2);
 vec3 n=normalize(vec3(.067*a,1.,.112*b+.04*a));vec3 eye=normalize(cameraPosition-wp);
 float f=pow(1.-abs(dot(n,eye)),2.4);float flash=pow(max(0.,dot(reflect(-normalize(vec3(-.50,.86,-.48)),n),eye)),95.);
 float ribbon=smoothstep(.92,1.,a)*smoothstep(.61,1.,b);
 vec3 col=mix(vec3(.018,.42,.55),vec3(.53,.87,.88),f*.87)+vec3(.67,.63,.48)*(flash*.85+ribbon*.12);
 gl_FragColor=vec4(col,.21+.39*f+ribbon*.11+flash*.28);
 #include <colorspace_fragment>
 }` });
const water = mesh(new T.PlaneGeometry(W, D, 58, 46), waterMaterial);
water.rotation.x = -PI / 2;
water.castShadow = false;
water.renderOrder = 2;
const dishPos = V(W * (portrait ? 0.321 : 0.339), 0.59, portrait ? -0.2 : -0.8);
const dish = group();
dish.position.copy(dishPos);
const dishMat = mat(0xced6d2, 0.235, 0.9, { side: T.DoubleSide });
const platter = lathe(dish, dishMat, [[0, 0], [0.67, 5e-3], [0.84, 0.043], [0.98, 0.145], [1.025, 0.17], [1.047, 0.155], [1.031, 0.126], [0.91, 0.054], [0.72, -0.042], [0, -0.047]]);
dish.scale.set(portrait ? 0.82 : 1.02, 1, portrait ? 0.76 : 0.87);
const foot = lathe(dish, darkMetal, [[0.59, -0.048], [0.6, -0.1], [0.65, -0.1], [0.66, -0.046]]);
const stationM = mat(0x6f9391, 0.41, 0.55), plateM = mat(0xbbc6c0, 0.31, 0.77), knobM = mat(0xe26932, 0.28, 0.43);
const ports = [];

function station(x, z, yaw, index) {
  const g = group();
  g.position.set(x, 0.62, z);
  g.rotation.y = yaw;
  const base = rounded(g, stationM, 0, -0.115, -0.04, 1.02, 0.19, 1.52, 0.075);
  for (const sx of [-0.43, 0.43]) {
    box(g, brass, sx, 0.012, -0.04, 0.042, 0.065, 1.54);
    rod(g, metal, V(sx, -0.16, -0.49), V(sx, -0.43, -0.49), 0.063);
  }
  const board = group(g);
  board.position.set(0, 0.075, 0.24);
  rounded(board, plateM, 0, 0, -0.03, 0.85, 0.066, 1.2, 0.043);
  for (const sx of [-0.418, 0.418]) {
    box(board, plateM, sx, 0.072, -0.025, 0.041, 0.13, 1.21);
    rod(board, metal, V(sx, 0.14, -0.61), V(sx, 0.14, 0.56), 0.024);
  }
  rod(g, brass, V(-0.51, 0.032, 0.23), V(0.51, 0.032, 0.23), 0.066);
  const track = rounded(g, plateM, 0, 0.078, -1.12, 0.86, 0.073, 1.02, 0.054);
  for (const sx of [-0.435, 0.435]) box(g, metal, sx, 0.16, -1.12, 0.042, 0.13, 1.06);
  const dividers = [];
  for (let i = 0; i < 3; i++) {
    const d = rod(g, brass, V(-0.42, 0.162, -0.66 - i * 0.32), V(0.42, 0.162, -0.66 - i * 0.32), 0.024);
    dividers.push(d);
  }
  const mount = group(g);
  mount.position.set(index === 0 ? 0.62 : -0.62, -5e-3, 0.27);
  const collar = lathe(mount, brass, [[1e-3, 0], [0.245, 0], [0.267, 0.047], [0.25, 0.14], [0.215, 0.16], [1e-3, 0.16]]);
  const button = group(mount);
  lathe(button, darkMetal, [[0.01, 0.13], [0.148, 0.13], [0.148, 0.25], [0.01, 0.25]]);
  const cap = lathe(button, knobM.clone(), [[1e-3, 0.22], [0.204, 0.22], [0.229, 0.247], [0.23, 0.31], [0.203, 0.35], [0.13, 0.366], [1e-3, 0.37]]);
  const anchor = V();
  mount.localToWorld(anchor.set(0, 0.32, 0));
  ports.push({ g, board, base, track, dividers, button, cap, anchor, index, ready: null, queue: [], cycle: -1, feed: null, transit: null });
}
station(W * (portrait ? 0.179 : 0.21), portrait ? 1.64 : 1.33, -1.04, 0);
station(W * (portrait ? 0.087 : 0.093), back + 0.99, -0.37, 1);
for (const p of ports) {
  // Riveted sheet steel, the hinge knuckles, and a visible return spring.
  for (const side of [-1, 1]) {
    for (const z of [-0.44, 0.48]) egg(p.g, metal, side * 0.46, -5e-3, z, 0.035, 0.015, 0.035, true);
    rod(p.board, metal, V(side * 0.315, -0.012, 2e-3), V(side * 0.395, -0.012, 2e-3), 0.068);
    for (let j = 0; j < 3; j++) rod(p.board, plateM, V(side * (0.14 + j * 0.086), 0.036, -0.48), V(side * (0.14 + j * 0.086), 0.036, 0.34), 0.011);
  }
  const spring = [];
  for (let j = 0; j <= 70; j++) {
    const t = j / 70;
    spring.push(V(0.081 * Math.cos(t * TAU * 6), -0.16 + 0.33 * t, 0.081 * Math.sin(t * TAU * 6) - 0.32));
  }
  tube(p.g, darkMetal, spring, 0.012, 72);
  const backFoot = wpos(p.g, 0, -0.12, -1.29);
  rock(backFoot.x, 0.39, backFoot.z, 0.66, 1.41, 0.71, 0x777b72, true, 12);
  for (const sx of [-0.32, 0.32]) rod(p.g, metal, V(sx, -0.01, -1.25), V(sx, -0.34, -1.25), 0.047);
}
const dropletMat = mat(0xcbebea, 0.09, 0.27, { transparent: true, opacity: 0.64 });
for (let i = 0; i < 14; i++) {
  const a = rand() * TAU, r = 0.47 + rand() * 0.48, size = 0.014 + rand() * 0.018;
  egg(dish, dropletMat, Math.cos(a) * r, 0.037 + 0.13 * smooth(0.72, 1, r), Math.sin(a) * r, size, size * 0.42, size * 1.18, true);
}
// Outboard push rods follow the frame all the way to the two release mechanisms.
const rods = [], pulleys = [];
const bayHalf = portrait ? 1.22 : W * 0.345;
for (const sign of [-1, 1]) {
  const x = sign * (bayHalf + 0.11);
  box(scene, rubber, x, FLOOR * 0.5, front + 0.062, 0.098, -FLOOR - 0.18, 0.088);
  box(scene, enamel, x, FLOOR * 0.5, front + 0.115, 0.068, -FLOOR - 0.18, 0.08);
  for (const y of [-0.18, FLOOR + 0.24]) egg(scene, metal, x, y, front + 0.164, 0.02, 0.02, 9e-3, true);
}

function pulley(x, y, z) {
  const g = group();
  g.position.set(x, y, z);
  const wheel = mesh(new T.TorusGeometry(0.13, 0.036, 9, 26), brass, g);
  rod(g, darkMetal, V(0, 0, -0.1), V(0, 0, 0.1), 0.06);
  for (let i = 0; i < 3; i++) {
    const a = i * PI / 3;
    rod(g, metal, V(-0.105 * Math.cos(a), -0.105 * Math.sin(a), 0), V(0.105 * Math.cos(a), 0.105 * Math.sin(a), 0), 0.014);
  }
  pulleys.push(wheel);
  return g;
}
for (let i = 0; i < 2; i++) {
  const side = i === 0 ? 1 : -1, x = side * bayHalf, z = front + 0.23, y = FLOOR * 0.4;
  const g = group();
  const runner = rod(g, brass, V(x, y, z), V(x, 0.23, z), 0.036);
  for (const cy of [-0.32, y + 0.19]) {
    const band = mesh(new T.TorusGeometry(0.066, 0.02, 8, 22), metal);
    band.rotation.x = PI / 2;
    band.position.set(x, cy, z);
    box(scene, enamel, x, cy, z - 0.085, 0.19, 0.097, 0.14);
  }
  const cap = egg(g, knobM.clone(), x, y, z + 0.059, 0.161, 0.183, 0.137);
  const knobPos = V(x, y, z + 0.065);
  rods.push({ g, cap, knobPos });
  const a = ports[i].anchor;
  tube(scene, metal, [V(x, 0.22, z), V(x, 0.26, z - 0.18), V(side * (W / 2 - 0.12), 0.26, z - 0.48), V(side * (W / 2 - 0.12), 0.26, a.z), V(a.x, 0.38, a.z)], 0.027, 38);
}
const netRX = W * 0.479, netRZ = D * 0.463, netBase = FLOOR + 0.37;
let netLift = 0, netDesired = 0;
const maxLift = -netBase - 0.6;

function netY(x, z) {
  return netBase + netLift + 0.18 * Math.pow(x / netRX, 4) + 0.14 * Math.pow(z / netRZ, 4) + 0.045 * z / netRZ;
}
const netG = group(), netGeo = new T.BufferGeometry(), nx = Math.ceil(netRX * 2 / 0.147), nz = Math.ceil(netRZ * 2 / 0.147);
const netArray = new Float32Array((nx + 1) * (nz + 1) * 3), netIndex = [];
for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
  const k = j * (nx + 1) + i, x = (2 * i / nx - 1) * netRX, z = (2 * j / nz - 1) * netRZ;
  netArray[k * 3] = x;
  netArray[k * 3 + 1] = netY(x, z);
  netArray[k * 3 + 2] = z;
  if (i < nx) netIndex.push(k, k + 1);
  if (j < nz) netIndex.push(k, k + nx + 1);
}
netGeo.setAttribute("position", new T.BufferAttribute(netArray, 3).setUsage(T.DynamicDrawUsage));
netGeo.setIndex(netIndex);
const unloadedNet = netArray.slice();
const netWeave = new T.LineSegments(netGeo, new T.LineBasicMaterial({ color: 0x476e65, transparent: true, opacity: 0.71 }));
netG.add(netWeave);
const netEdge = group();
for (const side of [-1, 1]) {
  for (let axis = 0; axis < 2; axis++) {
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const n = j / 6 - 1, x = (axis ? side : n) * netRX, z = (axis ? n : side) * netRZ;
      pts.push(V(x, netY(x, z), z));
    }
    tube(netEdge, ropeMat, pts, 0.025);
  }
}
const liftX = bayHalf * 0.65, liftZ = front + 0.3, handle = group();
handle.position.set(liftX, -0.56, liftZ);
const handleLoop = tube(handle, brass, [[0, 0.04, 0], [-0.12, -0.045, 0.015], [-0.12, -0.305, 0.023], [0, -0.367, 0.036], [0.12, -0.305, 0.023], [0.12, -0.045, 0.015], [0, 0.04, 0]], 0.045);
rod(handle, darkMetal, V(-0.11, -0.285, 0.025), V(0.11, -0.285, 0.025), 0.057);
const lines = [];

function movingLine(a, b) {
  const geometry = new T.CylinderGeometry(0.023, 0.023, a.distanceTo(b), 8, 16);
  const o = mesh(geometry, ropeMat);
  o.position.copy(a).lerp(b, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  lines.push({ o, a, b, straight: geometry.attributes.position.array.slice(), slack: -1 });
  return o;
}
for (const side of [-1, 1]) {
  const px = side * (netRX - 0.04);
  pulley(px, 0.19, front - 0.12);
  movingLine(V(px, netY(px, netRZ), netRZ), V(px, 0.21, front - 0.12));
  tube(scene, ropeMat, [V(px, 0.28, front - 0.12), V(px, 0.315, front + 0.035), V(liftX + side * 0.055, 0.306, front + 0.12), V(liftX + side * 0.055, 0.21, liftZ)], 0.02, 24);
  movingLine(V(liftX + side * 0.055, 0.23, liftZ), V(liftX + side * 0.055, -0.56, liftZ));
}
pulley(liftX, 0.2, liftZ - 0.025);
for (let i = 0; i <= 8; i++) {
  const x = W * (i / 8 - 0.5);
  egg(scene, metal, x, 0.01, front + 0.173, 0.032, 0.032, 0.013, true);
  egg(scene, metal, x, FLOOR + 0.17, front + 0.179, 0.029, 0.029, 0.013, true);
}
