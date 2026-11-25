"use strict";
// The profiles use height and angle as texture coordinates, so the markings wrap the animal.

function profile(p, m, rings, steps = 64) {
  const vs = [], uv = [], indices = [], h0 = rings[0][0], h1 = rings[rings.length - 1][0];
  const curve = new T.CatmullRomCurve3(rings.map((r) => V(r[1], r[0], r[2])), false, "catmullrom", 0.38);
  const centers = new T.CatmullRomCurve3(rings.map((r) => V(0, r[0], r[3] || 0)), false, "catmullrom", 0.38);
  const count = (rings.length - 1) * 4;
  for (let j = 0; j <= count; j++) {
    const r = curve.getPoint(j / count), zc = centers.getPoint(j / count).z;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps - 0.5) * TAU;
      vs.push(Math.sin(a) * Math.max(1e-3, r.x), r.y, Math.cos(a) * Math.max(1e-3, r.z) + zc);
      uv.push(i / steps, (r.y - h0) / (h1 - h0));
      if (i < steps && j < count) {
        const n = j * (steps + 1) + i;
        indices.push(n, n + 1, n + steps + 1, n + 1, n + steps + 2, n + steps + 1);
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(vs, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(geo, m, p);
}

function plumage(part) {
  const c = makeCanvas(768, 512), g = c.getContext("2d"), img = g.createImageData(c.width, c.height), spots = [];
  for (let i = 0; i < 22; i++) spots.push([(rand() - 0.5) * 1.84, 0.22 + rand() * 0.35, 8e-3 + rand() * 0.023, 5e-3 + rand() * 8e-3]);
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
    const a = (i / c.width - 0.5) * TAU, A = Math.abs(a), v = 1 - j / c.height, noise = (rand() - 0.5) * 9;
    let white = 0, band = 0;
    if (part === "body") {
      const bibEdge = 1.62 - 0.21 * Math.pow(Math.abs(v - 0.48) * 1.9, 2) + 0.03 * Math.cos(v * 15);
      white = (1 - smooth(bibEdge - 0.022, bibEdge + 0.022, A)) * (1 - smooth(0.895, 0.93, v));
      const stripe = 0.735 - 0.125 * A * A - 0.162 * Math.pow(A, 4), width = 0.038 + 0.012 * A;
      band = 1 - smooth(width - 9e-3, width + 8e-3, Math.abs(v - stripe));
      white *= 1 - band * 0.99;
      for (const [sx, sy, rx, ry] of spots) {
        if (Math.abs(v - sy) < ry && Math.abs(a - sx) < rx && ((a - sx) / rx) ** 2 + ((v - sy) / ry) ** 2 < 1) white *= 0.055;
      }
    } else {
      const upper = 0.819 - 0.047 * Math.cos(A * 1.45) - 0.19 * Math.pow(A / 2.25, 3);
      const lower = 0.272 + 0.055 * Math.cos(A * 2.2);
      const arc = Math.pow((a - 1.3 * Math.sign(a)) / 0.91, 2) + Math.pow((v - 0.528) / 0.292, 2);
      const cheek = (1 - smooth(0.97, 1.035, arc)) * smooth(0.11, 0.63, A);
      const brow = (1 - smooth(0.051, 0.069, Math.abs(v - upper))) * smooth(0.39, 0.88, A) * (1 - smooth(1.96, 2.31, A));
      const curl = (1 - smooth(0.035, 0.054, Math.abs(v - lower))) * smooth(0.4, 0.73, A) * (1 - smooth(1.73, 2.02, A));
      const outer = 1 - smooth(1.02, 1.1, arc), inner = 1 - smooth(0.73, 0.79, ((A - 1.09) / 0.97) ** 2 + ((v - 0.55) / 0.29) ** 2);
      white = Math.max(brow, curl, Math.max(cheek, outer) * (1 - inner) * smooth(0.3, 0.63, A));
      white = Math.max(white, (1 - smooth(0.11, 0.26, v)) * (1 - smooth(1.45, 1.82, A)));
    }
    const sheen = 6 * Math.sin(a * 2 + 0.3) + 4 * v, f = white;
    const shade = part === "body" ? 0.9 + 0.1 * v : 0.985;
    const idx = (j * c.width + i) * 4;
    img.data[idx] = mix(27 + sheen, 241 * shade, f) + noise;
    img.data[idx + 1] = mix(35 + sheen, 239 * shade, f) + noise;
    img.data[idx + 2] = mix(39 + sheen, 222 * shade, f) + noise;
    img.data[idx + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 12e3; i++) {
    const x = rand() * 768, y = rand() * 512;
    g.strokeStyle = rand() > 0.5 ? "rgba(250,250,244,.105)" : "rgba(14,26,31,.10)";
    g.lineWidth = 0.45 + rand() * 0.55;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 0.35 * Math.sin(x * 0.012), y + 1.6 + rand() * 3.7);
    g.stroke();
  }
  const t = tex(c);
  return mat(0xffffff, 0.47, 0.04, { map: t, bumpMap: t, bumpScale: 7e-3 });
}
const peng = group(), body = group(peng), head = group(body);
const bodyFeathers = plumage("body"), faceFeathers = plumage("head");
profile(body, bodyFeathers, [[-0.99, 0.03, 0.025, -0.14], [-0.91, 0.24, 0.28, -0.105], [-0.7, 0.425, 0.385, -0.07], [-0.37, 0.53, 0.446, -0.026], [0.04, 0.565, 0.47, 0.016], [0.35, 0.507, 0.445, 0.054], [0.56, 0.38, 0.345, 0.085], [0.76, 0.286, 0.277, 0.106], [0.83, 0.22, 0.21, 0.11], [0.86, 0.02, 0.02, 0.11]]);
head.position.set(0, 0.733, 0.104);
profile(head, faceFeathers, [[-0.294, 0.075, 0.075, 0], [-0.245, 0.254, 0.263, -0.01], [-0.14, 0.345, 0.339, 0.012], [0.03, 0.394, 0.39, 0.04], [0.235, 0.39, 0.387, 0.056], [0.405, 0.347, 0.35, 0.045], [0.523, 0.234, 0.25, 0.015], [0.578, 0.12, 0.135, 4e-3], [0.596, 0.013, 0.012, 0]]);
const billUpper = mat(0x333d40, 0.33, 0.18), billLower = mat(0x4c5150, 0.42, 0.13);

function tapered(p, m, sections) {
  const vs = [], ix = [], uv = [], n = 24;
  for (let j = 0; j < sections.length; j++) {
    const [z, w, h, cy] = sections[j];
    for (let i = 0; i <= n; i++) {
      const a = TAU * i / n;
      vs.push(Math.cos(a) * w, cy + Math.sin(a) * h, z);
      uv.push(i / n, j / (sections.length - 1));
      if (i < n && j < sections.length - 1) {
        const s = j * (n + 1) + i;
        ix.push(s, s + 1, s + n + 1, s + 1, s + n + 2, s + n + 1);
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(vs, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  return mesh(geo, m, p);
}
const upperJaw = group(head), lowerJaw = group(head);
upperJaw.position.set(0, 0.11, 0.325);
lowerJaw.position.copy(upperJaw.position);
tapered(upperJaw, billUpper, [[0, 0.152, 0.109, 0.042], [0.115, 0.143, 0.086, 0.04], [0.24, 0.103, 0.063, 0.027], [0.38, 0.074, 0.045, 9e-3], [0.476, 0.029, 0.033, -5e-3], [0.49, 4e-3, 0.014, -0.022]]);
tapered(lowerJaw, billLower, [[0, 0.137, 0.06, -0.051], [0.12, 0.129, 0.045, -0.063], [0.27, 0.09, 0.037, -0.054], [0.4, 0.045, 0.022, -0.043], [0.469, 6e-3, 9e-3, -0.033]]);
const eyeRim = mat(0x514543, 0.54), iris = mat(0x593e26, 0.23, 0.06), pupil = mat(0x10181a, 0.12, 0.13), pink = mat(0xc48f82, 0.56, 0.02), glint = new T.MeshBasicMaterial({ color: 0xfffbea });
for (const s of [-1, 1]) {
  const eye = group(head);
  eye.position.set(s * 0.295, 0.223, 0.284);
  eye.rotation.y = s * 0.88;
  egg(eye, eyeRim, 0, 0, 0, 0.1, 0.093, 0.043);
  egg(eye, iris, 0, 2e-3, 0.034, 0.07, 0.073, 0.029);
  egg(eye, pupil, 0, 4e-3, 0.057, 0.045, 0.052, 0.014);
  egg(eye, glint, -0.016, 0.027, 0.073, 0.012, 0.012, 5e-3, true);
  tube(eye, pink, [[-0.104, 0.044, -2e-3], [-0.067, 0.092, 7e-3], [5e-3, 0.108, 0.014], [0.067, 0.092, 0], [0.092, 0.05, -0.013]], 0.025);
  egg(head, billUpper, s * 0.079, 0.184, 0.548, 0.017, 8e-3, 0.034, true);
}
const wingM = mat(0x263438, 0.44, 0.056, { bumpMap: grain, bumpScale: 9e-3 }), wingEdge = mat(0x475254, 0.52);
const wings = [], feet = [];
for (const s of [-1, 1]) {
  const pivot = group(body);
  pivot.position.set(0.427 * s, 0.317, 2e-3);
  const blade = group(pivot);
  blade.rotation.z = s * 0.14;
  const wing = profile(blade, wingM, [[-0.99, 0.013, 0.017, -0.2], [-0.89, 0.057, 0.102, -0.155], [-0.67, 0.088, 0.153, -0.102], [-0.37, 0.112, 0.19, -0.067], [-0.09, 0.13, 0.2, -0.01], [0.087, 0.087, 0.159, 0.01], [0.15, 0.017, 0.034, 0.015]], 34);
  wings.push(pivot);
  const footG = group(peng);
  footG.position.set(s * 0.239, -0.918, -0.029);
  const footM = mat(0x655957, 0.58, 0.11), nail = mat(0x3d4240, 0.49, 0.12);
  egg(footG, footM, 0, -0.032, 0, 0.095, 0.127, 0.104);
  egg(footG, footM, 0, -0.095, 0.12, 0.156, 0.063, 0.213);
  for (let k = -1; k <= 1; k++) {
    const toe = egg(footG, footM, k * 0.092, -0.104, 0.244 - Math.abs(k) * 0.02, 0.052, 0.042, 0.162);
    toe.rotation.y = k * 0.25;
    const claw = egg(footG, nail, k * 0.129, -0.107, 0.382 - Math.abs(k) * 0.035, 0.024, 0.022, 0.051, true);
    claw.rotation.y = k * 0.25;
  }
  feet.push(footG);
}
const tail = profile(body, wingM, [[-0.36, 0.027, 0.026, -0.38], [-0.22, 0.14, 0.085, -0.27], [0, 0.25, 0.142, -0.12], [0.18, 0.226, 0.159, -0.056], [0.27, 0.075, 0.05, 0]], 32);
tail.position.set(0, -0.62, -0.199);
const animalScale = portrait ? 1.12 : 1.26;
peng.scale.setScalar(animalScale);
const restPos = perch.clone().add(V(0, 1.065 * animalScale, 0));
peng.position.copy(restPos);
peng.rotation.y = 0.5;
const mouth = V(), mouthSocket = new T.Object3D();
mouthSocket.position.set(0, 0.077, 0.685);
head.add(mouthSocket);

function fishSkin() {
  const c = makeCanvas(512, 192), ctx = c.getContext("2d"), d = ctx.createImageData(512, 192);
  for (let j = 0; j < 192; j++) for (let i = 0; i < 512; i++) {
    const a = i / 512 * TAU, y = Math.sin(a), back = smooth(0.33, 0.94, y), line = Math.exp(-Math.pow((y - 0.025) / 0.124, 2)), scaleF = (Math.cos((i + 3 * Math.sin(j * 0.85)) * 1.76) * 0.5 + 0.5) * Math.cos(j * 0.42) ** 4;
    const n = (rand() - 0.5) * 11 + scaleF * 12, idx = (j * 512 + i) * 4;
    d.data.set([mix(179, 57, back) + line * 58 + n, mix(196, 93, back) + line * 41 + n, mix(201, 101, back) + line * 32 + n, 255], idx);
  }
  ctx.putImageData(d, 0, 0);
  return tex(c);
}
const scales = fishSkin(), fishM = mat(0xffffff, 0.24, 0.6, { map: scales, bumpMap: scales, bumpScale: 3e-3 });
const finM = mat(0x9caaa1, 0.41, 0.35, { transparent: true, opacity: 0.82, side: T.DoubleSide }), finSpine = mat(0x909d94, 0.5, 0.39), gillMat = mat(0x8e9d9e, 0.3, 0.55);

function fin(p, outline) {
  const shape = new T.Shape();
  outline.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y));
  shape.closePath();
  const g = new T.ExtrudeGeometry(shape, { depth: 7e-3, bevelEnabled: true, bevelSize: 3e-3, bevelThickness: 3e-3, bevelSegments: 2 });
  g.rotateY(PI / 2);
  return mesh(g, finM, p);
}
const fishTemplate = group();
fishTemplate.visible = false;
tapered(fishTemplate, fishM, [[-0.317, 0.012, 0.021, 0], [-0.235, 0.029, 0.049, 3e-3], [-0.09, 0.054, 0.09, 2e-3], [0.073, 0.064, 0.106, 6e-3], [0.195, 0.061, 0.094, 6e-3], [0.245, 0.049, 0.075, 3e-3], [0.31, 0.031, 0.046, -5e-3], [0.354, 4e-3, 0.013, -0.016]]);
const caudal = group(fishTemplate);
caudal.name = "caudal";
caudal.position.z = -0.302;
fin(caudal, [[8e-3, 0.018], [-0.113, 0.106], [-0.15, 0.111], [-0.103, 0.011], [-0.145, -0.077], [-0.129, -0.086], [-0.019, -0.036], [8e-3, -0.019]]);
fin(fishTemplate, [[-0.131, 0.074], [-0.146, 0.146], [-0.097, 0.134], [1e-3, 0.096]]);
fin(fishTemplate, [[-0.183, -0.047], [-0.205, -0.1], [-0.105, -0.083]]);
for (const s of [-1, 1]) {
  const gl = egg(fishTemplate, gillMat, s * 0.055, 0.015, 0.171, 8e-3, 0.067, 0.052, true);
  gl.rotation.x = -0.18;
  egg(fishTemplate, metal, s * 0.047, 0.027, 0.237, 0.013, 0.035, 0.034);
  egg(fishTemplate, pupil, s * 0.056, 0.027, 0.238, 9e-3, 0.025, 0.024);
  egg(fishTemplate, glint, s * 0.065, 0.037, 0.247, 4e-3, 7e-3, 7e-3, true);
  const f = fin(fishTemplate, [[0.13, 0], [0.038, -0.09], [0.077, -0.015]]);
  f.position.x = s * 0.055;
  f.rotation.z = -s * 0.4;
}
const fishList = [];

function newFish() {
  const o = fishTemplate.clone(true);
  o.visible = true;
  scene.add(o);
  const f = { o, tail: o.getObjectByName("caudal"), state: "dish", port: null, entry: null, vel: V(), age: 0, roll: 1.21, yaw: 0, tilt: 0, broad: 0.5, weight: 0, serial: 0, settle: 0 };
  o.rotation.order = "YXZ";
  fishList.push(f);
  return f;
}
