'use strict';
// Each coat is a continuous sectioned surface. The hair field follows the muzzle,
// forehead whorl and the long direction of the flanks.
function furTexture() {
  let c = makeCanvas(1024, 512), ctx = c.getContext('2d');
  ctx.fillStyle = '#f0e8d8';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 104000; i++) {
    let x = rnd() * 1024, y = rnd() * 512, a = Math.sin(y / 512 * TAU) * .68 + Math.sin(x / 175) * .16 + (rnd() - .5) * .55,
      l = 2 + rnd() * 8;
    ctx.strokeStyle = rnd() < .56 ? 'rgba(91,64,42,.13)': 'rgba(255,253,230,.64)';
    ctx.lineWidth = .55 + rnd() * .65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + l * .46, y + Math.sin(a) * l * .65, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke()
  }
  let t = texture(c);
  t.wrapT = T.RepeatWrapping;
  return t
}
const furMap = furTexture();
const coat = mat(0xffffff, .91, 0, {map: furMap, bumpMap: furMap, bumpScale: .005, vertexColors: true});
const fawn = new T.Color(0xbe8957), honeyFur = new T.Color(0xd8b27f), darkFur = new T.Color(0x83603f), creamFur = new T.Color(0xf1dab0);
const lipMat = mat(0x4b3931, .45), tongueMat = mat(0xb88077, .34), hoofMat = mat(0x645746, .61);
function section(rows, x) {
  let n = rows.length - 1, i = 0;
  while (i < n - 1 && x > rows[i + 1][0]) i++;
  let a = rows[i], b = rows[i + 1], l = b[0] - a[0], t = clamp((x - a[0]) / l, 0, 1), pr = rows[Math.max(0, i - 1)],
    nx = rows[Math.min(n, i + 2)];
  return a.slice(1).map((v, j) => {
    let k = j + 1, d1 = (b[k] - pr[k]) / (b[0] - pr[0]) * l, d2 = (nx[k] - a[k]) / (nx[0] - a[0]) * l;
    return (2 * t * t * t - 3 * t * t + 1) * v + (t * t * t - 2 * t * t + t) * d1 + (-2 * t * t * t + 3 * t * t) * b[k] + (t * t * t - t * t) * d2
  })
}
function coatSurface(p, rows, paint, density = 0) {
  let pos = [], col = [], uv = [], idx = [], nx = 64, nt = 72, min = rows[0][0], max = rows.at(-1)[0];
  function sample(x, a) {
    let[cy, ry, rz, cz = 0] = section(rows, x);
    return V(x, cy + Math.max(.002, ry) * Math.cos(a), cz + Math.max(.002, rz) * Math.sin(a))
  }
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nt; j++) {
    let u = i / nx, v = j / nt, a = v * TAU, x = lerp(min, max, u);
    let q = sample(x, a);
    pos.push(...q.toArray());
    let c = paint(x, a, q);
    col.push(c.r, c.g, c.b);
    uv.push(u, v);
    if (i < nx && j < nt) {
      let k = i * (nt + 1) + j;
      idx.push(k, k + 1, k + nt + 1, k + 1, k + nt + 2, k + nt + 1)
    }
  }
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  let o = mesh(p, g, coat);
  if (density) {
    let v = [], c = [];
    for (let i = 0; i < density; i++) {
      let x = lerp(min + .015, max - .018, rnd()), a = rnd() * TAU, pt = sample(x, a), n = V(0, Math.cos(a), Math.sin(a)),
        b = pt.clone().addScaledVector(n, .0015), tone = paint(x, a, pt).multiplyScalar(.71 + rnd() * .42);
      let len = .011 + rnd() * .021;
      let end = sample(Math.min(max, x + len), a + .014 * Math.sin(a)).addScaledVector(n, .003 + rnd() * .006);
      v.push(...b.toArray(), ...end.toArray());
      c.push(tone.r, tone.g, tone.b, tone.r, tone.g, tone.b)
    }
    strands(p, v, c)
  }
  return o
}
function shadeFur(x, a, q) {
  let mottling = noise(x * 4 + 2, Math.cos(a) * 3 + Math.sin(a) * 2), c = fawn.clone().lerp(honeyFur, .12 + .4 * mottling);
  return c.lerp(darkFur, .12 * (1 + Math.cos(a)) + .11 * noise(x * 3, a)).multiplyScalar(.9 + .15 * mottling)
}
const calf = group(scene), head = group(calf, .33, 1.59, .43);
head.rotation.y = .39;
const skullRows = [
  [-.075, .079, .015, .028],
  [.00, .105, .121, .157],
  [.12, .135, .16, .205],
  [.29, .17, .169, .196],
  [.48, .31, .235, .209],
  [.66, .44, .302, .25],
  [.86, .512, .357, .311],
  [1.035, .559, .37, .326],
  [1.19, .55, .312, .273],
  [1.30, .53, .19, .163],
  [1.345, .50, .014, .018]
];
function forehead(x, a, q) {
  let c = shadeFur(x, a, q), light = Math.exp(-Math.pow((x - .10) / .24, 4));
  c.lerp(creamFur, light * .91);
  let top = Math.cos(a), forelock = Math.exp(-((x - 1.01) ** 2 / .08 + (1 - top) * 12));
  c.lerp(honeyFur, .57 * forelock);
  let orbital = Math.exp(-((x - .776) ** 2 / .028 + (q.y - .57) ** 2 / .020));
  return c.lerp(darkFur, orbital * .54).lerp(creamFur, Math.max(0, -top) * .21)
}
coatSurface(head, skullRows, forehead, 6600);
const neck = group(calf);
coatSurface(neck, [
  [0, .12, .15, .18],
  [.21, .18, .32, .272],
  [.43, .14, .349, .284],
  [.71, .12, .394, .324],
  [1.03, .10, .48, .393],
  [1.19, .14, .465, .40]
], (x, a, q) => shadeFur(x + .9, a, q).lerp(creamFur, Math.max(0, -Math.cos(a)) * .37), 2000);
const torso = group(calf, 1.51, 0, -.11);
coatSurface(torso, [
  [-.31, 1.65, .089, .13],
  [-.18, 1.64, .39, .31],
  [.12, 1.66, .548, .425],
  [.43, 1.65, .61, .459],
  [.91, 1.64, .571, .485],
  [1.38, 1.62, .539, .45],
  [1.77, 1.65, .552, .445],
  [1.99, 1.62, .43, .364],
  [2.12, 1.61, .06, .087]
], (x, a, q) => shadeFur(x * .6, a, q).lerp(creamFur, .48 * Math.max(0, -Math.cos(a)) ** 2), 2100);
const legCoat = mat(0xb58c61, .91, 0, {map: furMap}), innerLeg = mat(0xc8a77c, .92, 0, {map: furMap});
function leg(x, z, hind, far) {
  let p = group(torso, x, 0, z), m = far ? innerLeg: legCoat;
  let pts = hind ? [
    [0, 1.77, .19],
    [-.04, 1.39, .20],
    [-.11, 1.13, .155],
    [.005, .89, .114],
    [.15, .66, .097],
    [.11, .50, .068],
    [.045, .22, .061],
    [.026, .14, .077]
  ]: [
    [0, 1.79, .19],
    [.015, 1.42, .16],
    [-.012, 1.14, .115],
    [-.035, .88, .09],
    [-.043, .70, .091],
    [-.039, .56, .062],
    [-.059, .24, .06],
    [-.084, .145, .08]
  ];
  let path = pts.map(e => V(e[0], e[1], 0)), curve = new T.CatmullRomCurve3(path), ps = [], ix = [];
  for (let i = 0; i <= 40; i++) {
    let u = i / 40, q = curve.getPoint(u), f = u * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)),
      r = lerp(pts[k][2], pts[k + 1][2], ease(f - k));
    for (let j = 0; j <= 24; j++) {
      let a = j / 24 * TAU;
      ps.push(q.x + r * 1.17 * Math.cos(a), q.y, r * .89 * Math.sin(a));
      if (i < 40 && j < 24) {
        let n = i * 25 + j;
        ix.push(n, n + 25, n + 1, n + 1, n + 25, n + 26)
      }
    }
  }
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(ps, 3));
  g.setIndex(ix.reverse());
  g.computeVertexNormals();
  mesh(p, g, m);
  let end = path.at(-1);
  for (let s of [-1, 1]) {
    let h = egg(p, end.x - .036, .096, s * .036, .117, .086, .038, hoofMat);
    h.rotation.z = .12
  }
}
leg(.19, -.25, false, true);
leg(1.62, -.24, true, true);
leg(.05, .265, false, false);
leg(1.71, .26, true, false);
tube(torso, [V(1.94, 1.94, -.065), V(2.09, 1.58, -.03), V(2.12, .95, .03), V(2.01, .69, .11)], .035, legCoat);
egg(torso, 2.005, .64, .108, .059, .144, .051, mat(0x785941, .9));
const jaw = group(head, .01, -.01, 0);
const chinFur = mat(0xebd4ab, .84, 0, {map: furMap, bumpMap: furMap, bumpScale: .004});
let chin = egg(jaw, .153, .012, 0, .225, .095, .177, chinFur);
chin.rotation.z = .15;
const tongue = egg(jaw, -.05, .015, .008, .106, .034, .093, tongueMat);
for (let s of [-1, 1]) tube(jaw, [V(-.081, .035, s * .045), V(-.022, .026, s * .136), V(.10, .04, s * .177), V(.245,
  .076, s * .171), V(.32, .096, s * .147)], .009, lipMat, 22);
const nose = group(head, -.005, .146, 0);
nose.rotation.order = 'YXZ';
nose.rotation.y = -Math.PI / 2;
nose.rotation.x = -.20;
let nosePos = [], noseCol = [], noseUv = [], noseInd = [];
for (let i = 0; i <= 60; i++) for (let j = 0; j <= 96; j++) {
  let a = j / 96 * TAU, b = i / 60 * Math.PI, s = Math.sin(b), u = s * Math.cos(a), v = Math.cos(b), w = s * Math.sin(a);
  let d = 0;
  for (let k of [-1, 1]) d += Math.exp(-(((u - k * (.54 + .11 * v)) / .186) ** 2 + ((v - .16) / .28) ** 2) * 1.45) * ease(w * 4);
  let col = new T.Color(0x504740).lerp(new T.Color(0x292c2a), .36 * (v + .8)).lerp(new T.Color(0x161819), d * .96).multiplyScalar(.91 + .14 * noise(u * 60,
    v * 60));
  nosePos.push(.184 * u * (1 - .09 * v), .112 * v, .136 * w - .042 * d - .008 * Math.exp(-u * u * 150) * Math.max(0,
    -v));
  noseCol.push(col.r, col.g, col.b);
  noseUv.push(j / 96, i / 60);
  if (i < 60 && j < 96) {
    let k = i * 97 + j;
    noseInd.push(k, k + 1, k + 97, k + 1, k + 98, k + 97)
  }
}
let ng = new T.BufferGeometry();
ng.setAttribute('position', new T.Float32BufferAttribute(nosePos, 3));
ng.setAttribute('color', new T.Float32BufferAttribute(noseCol, 3));
ng.setAttribute('uv', new T.Float32BufferAttribute(noseUv, 2));
ng.setIndex(noseInd);
ng.computeVertexNormals();
let nc = makeCanvas(256, 128), nx = nc.getContext('2d');
nx.fillStyle = '#aaa';
nx.fillRect(0, 0, 256, 128);
for (let i = 0; i < 7100; i++) {
  nx.fillStyle = rnd() > .42 ? '#888': '#ccc';
  nx.beginPath();
  nx.ellipse(rnd() * 256, rnd() * 128, .4 + rnd() * .87, .4 + rnd() * .6, 0, 0, TAU);
  nx.fill()
}
const wetNose = mesh(nose, ng, mat(0xffffff, .29, .04, {vertexColors: true, bumpMap: texture(nc), bumpScale: .0019}));
let whisk = [], whCol = [];
for (let i = 0; i < 84; i++) {
  let s = i % 2 ? 1: -1, x = rnd() * .26, [cy, ry, rz] = section(skullRows, x), a = 1.64 + rnd() * .99;
  let q = V(x, cy + ry * Math.cos(a), s * rz * Math.sin(a)), end = q.clone().add(V(-.026 - rnd() * .024, -.008 - rnd() * .022,
    s * (.02 + rnd() * .045)));
  whisk.push(...q.toArray(), ...end.toArray());
  whCol.push(.46, .36, .24, .79, .68, .50)
}
strands(head, whisk, whCol);
const eyes = [], earPivots = [], eyeGlass = mat(0x1e1813, .115, .12), iris = mat(0x483121, .25, .10), lidEdge = mat(0x48372a,
  .59), browFur = mat(0xb28a60, .88, 0, {map: furMap}), glint = new T.MeshBasicMaterial({color: 0xfffae8});
for (let side of [-1, 1]) {
  let p = group(head, .764, .584, side * .254);
  p.rotation.y = side > 0 ? -.38: Math.PI + .38;
  p.rotation.z = side * .12;
  let lidGroup = group(p), eyeball = group(lidGroup);
  egg(eyeball, 0, 0, 0, .127, .087, .063, iris);
  egg(eyeball, -.012, .002, .023, .108, .082, .051, eyeGlass);
  let shine = group(eyeball, -.031, .033, .067);
  let spot = box(shine, 0, 0, 0, .024, .018, .004, glint, .002);
  spot.rotation.z = -.24;
  box(shine, .019, .002, -.001, .008, .016, .003, glint, .001);
  let lidPts = [V(-.128, .003, .013), V(-.082, .064, .039), V(-.008, .088, .037), V(.067, .07, .035), V(.126, .013,
    .012)];
  tube(p, lidPts, .013, lidEdge);
  tube(p, [V(-.127, 0, .014), V(-.05, -.063, .038), V(.041, -.071, .035), V(.12, .002, .014)], .010, lidEdge);
  tube(p, lidPts.map(q => q.clone().add(V(.008, .026, -.012))), .023, browFur);
  for (let k = 0; k < 12; k++) {
    let t = k / 11, xx = lerp(-.099, .099, t), yy = .045 + .046 * Math.sin(Math.PI * t);
    rod(p, V(xx, yy, .035), V(xx + .007, yy + .015 + rnd() * .015, .051), .0025, lidEdge, .0008, 5)
  }
  const upperLid = new T.PlaneGeometry(1, 1, 24, 5);
  const lidSkin = mesh(p, upperLid, browFur);
  lidSkin.frustumCulled = false;
  const lidVertex = upperLid.attributes.position;
  function closeLid(closed) {
    for (let row = 0; row <= 5; row++) {
      for (let column = 0; column <= 24; column++) {
        const u = column / 12 - 1;
        const almond = Math.sqrt(Math.max(0, 1 - u * u));
        const hem = almond * lerp(.081, -.059, closed);
        const y = lerp(almond * .108 + .008, hem, row / 5);
        const fullness = Math.sqrt(Math.max(0, 1 - u * u - (y / .095) ** 2));
        lidVertex.setXYZ(row * 25 + column, u * .129, y, .018 + .063 * fullness);
      }
    }
    lidVertex.needsUpdate = true;
    upperLid.computeVertexNormals();
  }
  closeLid(0);
  eyes.push({lidGroup, eyeball, closeLid, previousBlink: 0});
  let ep = group(head, 1.081, .694, side * .242);
  earPivots.push(ep);
  let pos = [], col = [], ix = [], uv = [];
  for (let i = 0; i <= 42; i++) for (let j = 0; j <= 48; j++) {
    let u = i / 42, a = j / 48 * TAU, sw = Math.max(.003, Math.pow(Math.sin(u * Math.PI), .65)), across = Math.cos(a) * sw,
      front = Math.sin(a);
    let px = .27 * u + .094 * Math.sin(Math.PI * u) + .052 * front * sw, py = .218 * u + .052 * Math.sin(Math.PI * u) + .159 * across,
      pz = side * (.673 * u + .023 * across);
    px -= .074 * sw * Math.abs(across);
    let c = honeyFur.clone().lerp(fawn, .48).lerp(creamFur, .55 * Math.abs(across));
    if (front < 0) c.lerp(new T.Color(0x966454), (-front) ** .65 * sw * .97);
    pos.push(px, py, pz);
    col.push(c.r, c.g, c.b);
    uv.push(u, j / 48);
    if (i < 42 && j < 48) {
      let k = i * 49 + j;
      ix.push(k, k + 49, k + 1, k + 1, k + 49, k + 50)
    }
  }
  let geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(side < 0 ? ix.reverse(): ix);
  geo.computeVertexNormals();
  let em = coat.clone();
  em.side = T.DoubleSide;
  mesh(ep, geo, em);
}
// Fine, slightly raised guard hairs form a small cowlick on the poll.
let locks = [], lc = [];
for (let i = 0; i < 1250; i++) {
  let a = rnd() * TAU, r = Math.sqrt(rnd()), x = 1.015 + .22 * r * Math.cos(a), ang = .54 * r * Math.sin(a), [cy,
    ry, rz] = section(skullRows, x), p = V(x, cy + ry * Math.cos(ang), rz * Math.sin(ang)), q = p.clone().add(V(.012 * Math.cos(a + .9) + .011,
    .008 + .009 * rnd(), .019 * Math.sin(a + .9)));
  locks.push(...p.toArray(), ...q.toArray());
  let c = honeyFur.clone().multiplyScalar(.74 + rnd() * .49);
  lc.push(c.r, c.g, c.b, c.r, c.g, c.b)
}
strands(head, locks, lc);
function poseCalf(dt, time, target, turn, suck, contact, relax) {
  const sideways = clamp(Math.abs(target.x - head.position.x) / .56, 0, 1);
  const searchArc = contact ? 0 : Math.sin(sideways * Math.PI) * .046;
  head.position.lerp(V(target.x, target.y + searchArc, target.z), 1 - Math.exp(-dt * (contact ? 8 : 3.1)));
  head.rotation.y = follow(head.rotation.y, turn, 3.4, dt);
  const neckAngle = clamp((1.56 - target.y) * .36, -.095, .32);
  head.rotation.z = follow(head.rotation.z, neckAngle + .018 * Math.sin(time * .91) + .014 * suck, 5, dt);
  let anchor = V(.93, .35, 0).applyQuaternion(head.quaternion).add(head.position);
  neck.position.copy(anchor);
  let far = V(1.93, 1.65, -.11), delta = far.sub(anchor);
  neck.rotation.order = 'YXZ';
  neck.rotation.y = Math.atan2(-delta.z, delta.x);
  neck.rotation.z = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
  neck.scale.x = delta.length() / 1.19;
  let blinkPhase = (time + .4) % 4.83, blink = blinkPhase < .23 ? Math.sin(Math.PI * blinkPhase / .23) ** 1.25: 0;
  for (const eye of eyes) {
    const {lidGroup, eyeball} = eye;
    if (eye.previousBlink !== blink) eye.closeLid(blink);
    eye.previousBlink = blink;
    lidGroup.scale.y = 1 - .80 * blink;
    eyeball.position.x = clamp((target.x - head.position.x) * .12, -.016, .014)
  }
  let earBeat = Math.pow(Math.max(0, Math.cos(time * .84)), 16);
  earPivots.forEach((ear, i) => {
    ear.rotation.x = (i ? 1: -1) * (.042 * Math.sin(time * 1.15 + i) + .13 * relax);
    ear.rotation.y = (i ? 1: -1) * (.04 * Math.sin(time * .51) + earBeat * (i ? .19: .04))
  });
  jaw.position.y = -.012 - .036 * suck;
  jaw.position.x = .011 + .014 * suck;
  tongue.scale.x = .074 + .05 * suck;
  tongue.position.x = contact ? -.052: -.014;
  nose.scale.z = 1 - (contact ? .072: 0) + .018 * Math.sin(time * 3.4);
  nose.scale.x = 1 + .019 * Math.sin(time * 3.4) + (contact ? .033: 0);
}
// Soft ear margins, the shallow fold of the concha, and individual marginal hairs.
for (let side of [-1, 1]) {
  let p = earPivots[side > 0 ? 1: 0], pts = [];
  for (let k = 0; k <= 12; k++) {
    let u = .12 + .61 * k / 12, sw = Math.sin(u * Math.PI) ** .65;
    pts.push(V(.27 * u + .094 * Math.sin(Math.PI * u) - .058 * sw, .218 * u + .052 * Math.sin(Math.PI * u) - .064 * sw,
      side * .673 * u))
  }
  tube(p, pts, .011, mat(0xc69f77, .93), 22);
  let ptsHair = [], color = [];
  for (let i = 0; i < 410; i++) {
    let u = .04 + rnd() * .92, sign = rnd() < .5 ? -1: 1, sw = Math.sin(u * Math.PI) ** .65, across = sign * sw;
    let x = .27 * u + .094 * Math.sin(Math.PI * u) - .074 * sw * Math.abs(across), y = .218 * u + .052 * Math.sin(Math.PI * u) + .159 * across,
      z = side * (.673 * u + .023 * across);
    ptsHair.push(x, y, z, x - .004 - rnd() * .008, y + sign * (.004 + rnd() * .012), z + side * .015);
    let c = creamFur.clone().multiplyScalar(.66 + rnd() * .37);
    color.push(c.r, c.g, c.b, c.r, c.g, c.b)
  }
  strands(p, ptsHair, color)
}
