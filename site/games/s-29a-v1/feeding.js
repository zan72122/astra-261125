'use strict';
const apparatus = group(scene);
const rest = V(-.30, 1.32, .60);
const stand = group(apparatus, -1.44, 0, .55);
// A low mortised stool carries the pivot, with a banked wooden cradle above it.
for (let x of [-.37, .37]) for (let z of [-.22, .22]) {
  let leg = box(stand, x, .47, z, .108, .91, .107, structural);
  leg.rotation.z = -x * .17;
  leg.rotation.x = z * .19
}
box(stand, 0, .77, .007, .89, .20, .50, edgeWood);
box(stand, 0, .91, 0, 1.04, .13, .62, sandWood, .035);
box(stand, 0, .28, 0, .83, .082, .078, structural);
for (let x of [-.39, .39]) nail(stand, x, .82, .263);
for (let z of [-.18, .18]) {
  let o = box(stand, .13, 1.01, z, .67, .11, .072, structural, .03);
  o.rotation.z = -.09
}
const basePivot = V(-1.53, .999, .57), movingArm = group(apparatus), armPivot = group(apparatus, ...basePivot.toArray());
box(armPivot, 0, .02, 0, .29, .091, .32, pewter, .025);
for (let s of [-1, 1]) {
  box(armPivot, 0, .094, s * .111, .15, .18, .038, pewter, .024);
  egg(armPivot, 0, .143, s * .142, .051, .051, .018, brass)
}
const armLinks = [];
for (let s of [-1, 1]) {
  let bar = box(movingArm, 0, 0, 0, .068, 1, .033, pewter, .014);
  armLinks.push({bar, side: s})
}
const bottle = group(apparatus, ...rest.toArray());
bottle.rotation.order = 'YXZ';
bottle.rotation.z = -.14;
const vesselProfile = [
  [-1.585, .015],
  [-1.583, .213],
  [-1.56, .262],
  [-1.51, .283],
  [-1.43, .291],
  [-.69, .291],
  [-.61, .287],
  [-.55, .276],
  [-.47, .251],
  [-.397, .205],
  [-.335, .15],
  [-.28, .135],
  [-.235, .135]
];
function revolvedX(p, profile, m) {
  let g = new T.LatheGeometry(profile.map(([x, r]) => new T.Vector2(r, x)), 80);
  g.rotateZ(-Math.PI / 2);
  return mesh(p, g, m)
}
const glass = mat(0xe4f5f2, .135, .13, {transparent: true, opacity: .145, depthWrite: false, envMapIntensity: 1.7,
  side: T.FrontSide});
glass.onBeforeCompile = shader => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', [
    'float glassEdge = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.25);',
    'diffuseColor.a = 0.095 + glassEdge * 0.55;',
    '#include <opaque_fragment>'
  ].join('\n'));
};
const bottleWall = revolvedX(bottle, vesselProfile, glass);
bottleWall.castShadow = false;
bottleWall.renderOrder = 8;
const glassEdge = mat(0xd4e1d4, .18, .26, {transparent: true, opacity: .4, depthWrite: false});
for (let[x, r]of [[-1.53, .277], [-1.463, .292], [-.326, .151], [-.249, .135]]) {
  let o = ring(bottle, x, 0, 0, r, .009, glassEdge, 'x');
  o.castShadow = false;
  o.renderOrder = 9
}
const enamel = mat(0xe6d5b2, .34, .18), rubber = mat(0xa96141, .49, 0), milkMat = mat(0xfff8e2, .26, .0), milkTopMat = mat(0xfffbee,
  .19, 0);
const vent = group(bottle, -.43, -.062, .212);
egg(vent, 0, 0, 0, .023, .017, .007, pewter);
egg(vent, 0, 0, .006, .009, .007, .003, iron);
const collar = revolvedX(bottle, [[-.358, .144], [-.353, .166], [-.339, .177], [-.242, .174], [-.222, .16], [-.219,
  .125]], enamel);
for (let i = 0; i < 56; i++) {
  let a = i * TAU / 56;
  let o = rod(bottle, V(-.333, .173 * Math.cos(a), .173 * Math.sin(a)), V(-.25, .173 * Math.cos(a), .173 * Math.sin(a)),
    .0045, enamel, .0045, 6);
  o.castShadow = false
}
const teat = group(bottle, -.226, 0, 0);
revolvedX(teat, [
  [0, .128],
  [.017, .128],
  [.028, .118],
  [.048, .091],
  [.079, .067],
  [.145, .056],
  [.201, .061],
  [.229, .051],
  [.242, .031],
  [.245, .002]
], rubber);
const lid = group(bottle, -1.564, .215, 0);
let stopper = revolvedX(lid, [[-.036, .203], [-.031, .227], [-.011, .238], [.012, .235], [.022, .209]], enamel);
stopper.position.y = -.215;
ring(bottle, -1.56, 0, 0, .24, .021, pewter, 'x');
box(lid, -.004, .004, 0, .097, .046, .137, pewter);
ring(lid, -.034, -.42, .008, .052, .014, brass, 'y');
const saddle = group(bottle, -.994, -.284, 0);
box(saddle, 0, -.018, .0, 1.01, .076, .35, sandWood, .031);
for (let x of [-.34, .34]) {
  let pts = [];
  for (let i = 0; i < 19; i++) {
    let a = lerp(-1.32, 1.32, i / 18);
    pts.push(V(x, .266 - .295 * Math.cos(a), .295 * Math.sin(a)))
  }
  tube(saddle, pts, .024, pewter);
  for (let s of [-1, 1]) {
    let o = egg(saddle, x, .177, s * .278, .029, .029, .013, brass);
    o.castShadow = false
  }
}
const grip = group(saddle, -.05, -.018, .297);
const handleWood = timber(0xbb8751, 2);
const gripMesh = revolvedX(grip, [
  [-.427, .012],
  [-.417, .056],
  [-.39, .085],
  [-.35, .091],
  [-.286, .077],
  [-.19, .068],
  [.13, .068],
  [.23, .077],
  [.303, .084],
  [.345, .077],
  [.368, .047],
  [.37, .006]
], handleWood);
for (let x of [-.345, -.316, .263, .293]) ring(grip, x, 0, 0, x < 0 ? .083: .079, .004, darkWood, 'x');
for (let x of [-.234, .180]) {
  rod(saddle, V(x, -.014, .10), V(x - .05, -.034, .30), .022, pewter)
}
function updateArm() {
  bottle.updateMatrixWorld();
  let end = saddle.localToWorld(V(.05, -.071, 0)), start = basePivot.clone().add(V(0, .135, 0));
  for (let {bar, side} of armLinks) {
    let a = start.clone().add(V(0, 0, side * .091)), b = end.clone().add(V(0, 0, side * .091)), v = b.clone().sub(a);
    bar.position.copy(a).lerp(b, .5);
    bar.scale.y = v.length();
    bar.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize())
  }
}
// The circular segments at each axial station are integrated to conserve volume.
const liquidStations = 57, arcSegments = 50;
const stations = Array.from({length: liquidStations}, (_, i) => {
  let x = lerp(-1.567, -.242, i / (liquidStations - 1)), j = 0;
  while (j < vesselProfile.length - 2 && vesselProfile[j + 1][0] < x) j++;
  let[a, r] = vesselProfile[j], [b, s] = vesselProfile[j + 1];
  return {x, r: lerp(r, s, (x - a) / (b - a)) - .009, w: i === 0 || i === liquidStations - 1 ? .5: 1}
});
const volumeCapacity = stations.reduce((n, s) => n + s.w * Math.PI * s.r * s.r, 0);
function filledArea(r, y) {
  if (y >= r) return Math.PI * r * r;
  if (y <= -r) return 0;
  return r * r * (Math.asin(y / r) + Math.PI / 2) + y * Math.sqrt(Math.max(0, r * r - y * y))
}
function levelFor(amount, angle) {
  let sn = Math.sin(angle), cs = Math.cos(angle), lo = -2.2, hi = 2.2;
  for (let k = 0; k < 19; k++) {
    let h = (lo + hi) * .5, v = 0;
    for (let s of stations) v += s.w * filledArea(s.r, (h - s.x * sn) / cs);
    if (v < amount * volumeCapacity) lo = h; else hi = h
  }
  return (lo + hi) * .5
}
function dynamicStrip(n, m, material, parent) {
  let geo = new T.BufferGeometry(), array = new Float32Array(n * m * 3), ind = [];
  geo.setAttribute('position', new T.BufferAttribute(array, 3).setUsage(T.DynamicDrawUsage));
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) {
    let k = i * m + j;
    ind.push(k, k + 1, k + m, k + 1, k + m + 1, k + m)
  }
  geo.setIndex(ind);
  let obj = mesh(parent, geo, material);
  obj.frustumCulled = false;
  return {
    obj,
    geo,
    array,
    write(i, j, x, y, z) {
      let k = (i * m + j) * 3;
      array[k] = x;
      array[k + 1] = y;
      array[k + 2] = z
    },
    update() {
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals()
    }
  }
}
milkMat.side = milkTopMat.side = T.DoubleSide;
const liquidBody = dynamicStrip(liquidStations, arcSegments + 1, milkMat, bottle), surface = dynamicStrip(liquidStations,
  2, milkTopMat, bottle);
let filmMat = mat(0xfff9db, .28, 0, {side: T.DoubleSide, transparent: true, opacity: .18, depthWrite: false});
let films = [dynamicStrip(liquidStations, 2, filmMat, bottle), dynamicStrip(liquidStations, 2, filmMat, bottle)];
films.forEach(f => {
  f.obj.castShadow = false;
  f.obj.renderOrder = 4
});
// Milk left above the current surface drains in narrow, irregular tracks.
const trailCount = 26, trailSteps = 7, trailGeo = new T.BufferGeometry();
const trailVerts = new Float32Array(trailCount * trailSteps * 6), trailIndex = [];
const trailSpecs = Array.from({length: trailCount}, (_, j) => ({station: 2 + Math.floor(rnd() * (liquidStations - 5)),
  side: j % 4 === 0 ? -1: 1, width: .0017 + rnd() * .003, phase: rnd() * TAU}));
for (let i = 0; i < trailCount; i++) for (let k = 0; k < trailSteps - 1; k++) {
  let n = (i * trailSteps + k) * 2;
  trailIndex.push(n, n + 1, n + 2, n + 1, n + 3, n + 2)
}
trailGeo.setAttribute('position', new T.BufferAttribute(trailVerts, 3).setUsage(T.DynamicDrawUsage));
trailGeo.setIndex(trailIndex);
const milkTraces = mesh(bottle, trailGeo, new T.MeshBasicMaterial({color: 0xfffae8, transparent: true, opacity: .31,
  side: T.DoubleSide, depthWrite: false}));
milkTraces.renderOrder = 5;
milkTraces.frustumCulled = false;
milkTraces.castShadow = false;
function traceMilk(sn, cs) {
  trailSpecs.forEach(({station, side, width, phase}, i) => {
    let {x, r} = stations[station], low = clamp((liquidHeight - x * sn) / cs, -r, r), top = clamp(highWater[station],
      low, r);
    for (let k = 0; k < trailSteps; k++) {
      let u = k / (trailSteps - 1), y = lerp(low, top, u), w = width * (.30 + .70 * u), cx = x + .005 * Math.sin(u * 4 + phase),
        z = side * (Math.sqrt(Math.max(0, r * r - y * y)) + .003);
      let n = (i * trailSteps + k) * 6;
      trailVerts.set([cx - w, y, z, cx + w, y, z], n)
    }
  });
  trailGeo.attributes.position.needsUpdate = true
}
const highWater = new Array(liquidStations).fill(-1);
let leftSurface = -1.53, rightSurface = -.26;
let liquidAngle = -.14, liquidHeight = 0, neckIsWet = true, lastLiquidAmount = -1, lastLiquidAngle = 9;
function updateMilk(amount, angle, dt, force = false) {
  let changed = Math.abs(amount - lastLiquidAmount) > .00015 || Math.abs(angle - lastLiquidAngle) > .0007 || force;
  if (changed) {
    liquidHeight = levelFor(amount, angle);
    lastLiquidAngle = angle;
    lastLiquidAmount = amount
  }
  let sn = Math.sin(angle), cs = Math.cos(angle);
  let firstSurface = Infinity, lastSurface = -Infinity;
  for (let i = 0; i < stations.length; i++) {
    let {x, r} = stations[i], yy = (liquidHeight - x * sn) / cs, y = clamp(yy, -r, r), edge = Math.acos(clamp(y / r,
      -1, 1)), z = Math.sqrt(Math.max(0, r * r - y * y));
    if (Math.abs(yy) < r * .985) {
      firstSurface = Math.min(firstSurface, x);
      lastSurface = Math.max(lastSurface, x);
    }
    if (changed) {
      for (let j = 0; j <= arcSegments; j++) {
        let a = lerp(edge, TAU - edge, j / arcSegments);
        liquidBody.write(i, j, x, r * Math.cos(a), r * Math.sin(a))
      }
      surface.write(i, 0, x, y, -z);
      surface.write(i, 1, x, y, z)
    }
    highWater[i] = Math.max(y, highWater[i] - dt * (.012 + .006 * Math.sin(i * 2.9)));
    let top = clamp(highWater[i], -r, r);
    for (let j = 0; j < 2; j++) {
      let s = j ? 1: -1;
      films[j].write(i, 0, x, y, s * (z + .002));
      films[j].write(i, 1, x, top, s * (Math.sqrt(Math.max(0, r * r - top * top)) + .002))
    }
  }
  if (firstSurface <= lastSurface) {
    leftSurface = firstSurface;
    rightSurface = lastSurface;
  }
  traceMilk(sn, cs);
  if (changed) {
    liquidBody.update();
    surface.update()
  }
  films.forEach(f => f.update());
  liquidBody.obj.visible = surface.obj.visible = amount > .0003;
  neckIsWet = amount > .0015 && liquidHeight > (-.24 * sn - .046 * cs);
  liquidAngle = angle
}
const foamMat = mat(0xfff8e3, .18, .07, {transparent: true, opacity: .79});
const bubbleClear = mat(0xecf4e9, .12, .08, {transparent: true, opacity: .51, depthWrite: false});
const bubbles = [];
function birthBubble(u = -.45, size = .015, surfaceOnly = false) {
  if (bubbles.length >= 42) {
    let old = bubbles.shift();
    bottle.remove(old.obj)
  }
  let obj = egg(bottle, u, 0, 0, size, size, size, surfaceOnly ? foamMat: bubbleClear);
  obj.castShadow = false;
  obj.renderOrder = 5;
  bubbles.push({obj, x: u, z: (rnd() - .5) * .16, age: surfaceOnly ? 2: 0, lifetime: 32 + rnd() * 37, size, top: surfaceOnly})
}
function animateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    let b = bubbles[i];
    b.age += dt;
    if (b.age > b.lifetime) {
      bottle.remove(b.obj);
      bubbles.splice(i, 1);
      continue
    }
    const surfaceDirection = Math.sign(liquidAngle);
    const drift = surfaceDirection * Math.abs(Math.sin(liquidAngle)) * .11 * dt;
    const floatTo = clamp(b.x + drift, leftSurface, rightSurface);
    b.x = follow(b.x, floatTo, b.top ? 4 : 2.4, dt);
    if (b.top) b.x = clamp(b.x + drift, leftSurface, rightSurface);
    const stationIndex = clamp(Math.round((b.x + 1.567) / 1.325 * (liquidStations - 1)), 0, liquidStations - 1);
    const st = stations[stationIndex];
    const y = (liquidHeight - b.x * Math.sin(liquidAngle)) / Math.cos(liquidAngle);
    const surfaceY = clamp(y, -st.r + .012, st.r - .012);
    const width = Math.sqrt(Math.max(0, st.r * st.r - surfaceY * surfaceY));
    const rise = clamp(b.age / 1.25, 0, 1);
    const bubbleY = lerp(-st.r + .02, surfaceY + .003, rise);
    if (rise >= 1) b.top = true;
    b.z = b.top
      ? follow(b.z, width * (.88 + .09 * Math.sin(b.lifetime)), 1.3, dt)
      : Math.sqrt(Math.max(0, st.r * st.r - bubbleY * bubbleY)) - .001;
    b.obj.position.set(b.x, bubbleY, b.z);
    b.obj.scale.setScalar(b.size * clamp((b.lifetime - b.age) / 3, .04, 1));
    b.obj.scale.y *= b.top ? .64: 1;
    b.obj.visible = lastLiquidAmount > .001 && width > .015;
    if (b.top) b.obj.material = foamMat;
    if (b.top && i > 0) {
      let other = bubbles[i - 1];
      if (other.top && Math.abs(other.x - b.x) < (b.size + other.size) * .52 && Math.abs(other.z - b.z) < .018 && other.size < .032) {
        other.size = Math.cbrt(other.size ** 3 + b.size ** 3);
        bottle.remove(b.obj);
        bubbles.splice(i, 1)
      }
    }
  }
}
const rail = group(apparatus, -.36, 1.045, .02), railMat = timber(0xc39a69, 1);
// Gaps between blocks form two actual shallow hook notches.
const hooks = [-.55, .035];
let boundaries = [-1.14, hooks[0] - .071, hooks[0] + .071, hooks[1] - .071, hooks[1] + .071, .44];
box(rail, -.35, 0, 0, 1.58, .135, .135, railMat, .014);
for (let i = 0; i < 5; i += 2) {
  let a = boundaries[i], b = boundaries[i + 1];
  box(rail, (a + b) / 2, .084, 0, b - a, .037, .138, sandWood, .008)
}
for (let x of [-1.02, .345]) {
  box(rail, x, -.524, -.025, .085, 1.04, .12, structural);
  nail(rail, x, .004, .076, .019)
}
for (let x of hooks) {
  box(rail, x, -.385, .062, .187, .134, .164, edgeWood, .029);
  nail(rail, x, -.394, .147, .012)
}
const shelf = group(apparatus, -.52, .35, .36);
for (let i = 0; i < 3; i++) box(shelf, 0, -.037, -.16 + i * .19, 1.82, .09, .182, honey[i + 2], .012);
for (let x of [-.78, .78]) {
  let b = box(shelf, x, -.16, -.04, .079, .43, .08, edgeWood);
  b.rotation.x = -.63
}
const bucketHome = V(-.34, .365, .40);
const bucket = group(apparatus, ...bucketHome.toArray());
const bucketPaint = mat(0x70887d, .38, .50, {side: T.DoubleSide}), tin = mat(0xa5aaa0, .32, .75, {side: T.DoubleSide});
function lathe(p, profile, m) {
  return mesh(p, new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 72), m)
}
lathe(bucket, [[.002, .015], [.207, .015], [.235, .032], [.25, .076], [.337, .516], [.342, .55], [.338, .564]],
  bucketPaint);
lathe(bucket, [[.332, .554], [.329, .51], [.242, .084], [.23, .048], [.002, .048]], tin);
for (let[r, y, t]of [[.341, .554, .012], [.25, .079, .011], [.26, .123, .006], [.321, .462, .005]]) ring(bucket,
  0, y, 0, r, t, pewter, 'y');
for (let s of [-1, 1]) {
  egg(bucket, 0, .462, s * .321, .053, .067, .009, pewter);
  egg(bucket, 0, .47, s * .334, .022, .022, .008, brass)
}
const bail = group(bucket, 0, .467, 0);
let wire = [];
for (let j = 0; j <= 32; j++) {
  let a = j * Math.PI / 32;
  wire.push(V(-.094 * Math.sin(a), .35 * Math.sin(a), .326 * Math.cos(a)))
}
tube(bail, wire, .012, pewter);
rod(bail, V(-.093, .346, -.107), V(-.093, .346, .107), .030, handleWood);
const hanger = group(bucket, 0, .526, -.283);
box(hanger, 0, -.012, -.048, .123, .054, .151, pewter);
box(hanger, 0, -.075, -.118, .121, .146, .025, pewter, .007);
const bucketTeat = group(bucket, .238, .126, .035);
bucketTeat.rotation.z = .10;
revolvedX(bucketTeat, [[0, .073], [.033, .078], [.055, .065], [.066, .048], [.148, .043], [.193, .05], [.211, .031],
  [.214, .003]], rubber);
const bucketOutletHeight = .0497;
tube(bucket, [V(.245, .126, .034), V(.229, .116, .034), V(.213, .082, .034), V(.205, bucketOutletHeight + .009,
  .034)], .018, pewter, 12);
const bucketPool = cyl(bucket, 0, .05, 0, .235, .235, .012, milkTopMat, 72);
const bucketFoam = [];
function bucketBubble() {
  let a = rnd() * TAU;
  let o = egg(bucket, 0, 0, 0, .014, .008, .014, foamMat);
  o.castShadow = false;
  bucketFoam.push({o, a, life: 25 + rnd() * 20})
}
function bucketFillFraction(h) {
  let r = .231 + (.332 - .231) * h;
  return h * (.231 * .231 + .231 * r + r * r) / (.231 * .231 + .231 * .332 + .332 * .332)
}
const bucketCapacity = .49 * Math.PI * (.231 ** 2 + .231 * .332 + .332 ** 2) / 3 / (volumeCapacity * 1.325 / (liquidStations - 1));
function bucketHeight(vol) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 13; i++) {
    let h = (lo + hi) / 2;
    if (bucketFillFraction(h) < vol / bucketCapacity) lo = h; else hi = h
  }
  return (lo + hi) / 2
}
function updateBucketMilk(vol, t, dt, pulse) {
  let h = bucketHeight(vol);
  bucketPool.position.y = .049 + h * .49;
  bucketPool.scale.x = bucketPool.scale.z = (.232 + h * .101) / .235;
  bucketPool.visible = vol > .00015;
  bucketPool.rotation.z = .018 * pulse * Math.sin(6 * t);
  for (let i = bucketFoam.length - 1; i >= 0; i--) {
    let b = bucketFoam[i];
    b.life -= dt;
    if (b.life < 0 || !bucketPool.visible) {
      bucket.remove(b.o);
      bucketFoam.splice(i, 1);
      continue
    }
    b.o.position.set((.224 + h * .100) * Math.cos(b.a), bucketPool.position.y + .008, (.224 + h * .100) * Math.sin(b.a))
  }
}
const pourYoke = group(apparatus, -1.02, 1.30, .07);
rod(pourYoke, V(0, -.255, 0), V(0, .01, 0), .032, pewter);
tube(pourYoke, [V(0, .14, -.18), V(0, .017, -.095), V(0, 0, .01), V(0, .045, .126), V(0, .14, .18)], .021, pewter);
const refillHome = V(-1.20, .36, .32), refill = group(apparatus, ...refillHome.toArray());
const stoneware = mat(0xe1d9bb, .33, .06, {side: T.DoubleSide});
const spareJar = lathe(refill, [
  [.004, 0],
  [.103, 0],
  [.123, .033],
  [.126, .254],
  [.12, .34],
  [.097, .384],
  [.082, .40],
  [.082, .424],
  [.073, .424],
  [.073, .398],
  [.108, .334],
  [.115, .23],
  [.113, .034],
  [.005, .026]
], stoneware);
ring(refill, 0, .395, 0, .083, .008, pewter, 'y');
const spareLid = group(refill, -.081, .423, 0);
cyl(spareLid, .081, .012, 0, .086, .088, .033, enamel);
rod(spareLid, V(0, 0, -.05), V(0, 0, .05), .013, brass);
const spareCapacity = .061;
function retainedInSpare(roll) {
  let cs = Math.cos(roll), sn = Math.max(.00001, Math.abs(Math.sin(roll))), rim = .415 * cs - .073 * sn, full = 0,
    under = 0;
  for (let i = 0; i < 28; i++) {
    let y = (i + .5) * .415 / 28, r = y < .33 ? .115: lerp(.115, .073, (y - .33) / .085);
    under += filledArea(r, (rim - y * cs) / sn);
    full += Math.PI * r * r
  }
  return under / full
}
const stream = mesh(scene, new T.CylinderGeometry(1, .78, 1, 16), milkMat);
stream.visible = false;
const droplet = egg(scene, 0, 0, 0, .018, .028, .018, milkMat);
droplet.visible = false;
// Soft contact shadows anchor the small feet, shelf and bottle support.
function contactShadow(p, x, y, z, w, d, opacity) {
  let material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {strength: {value: opacity}},
    vertexShader: 'varying vec2 v; void main(){v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 v; uniform float strength; void main(){vec2 c=(v-.5)*2.;float a=max(0.,1.-dot(c,c));gl_FragColor=vec4(.16,.105,.065,a*a*strength);}'
  });
  let shadow = mesh(p, new T.PlaneGeometry(w, d), material, x, y, z);
  shadow.rotation.x = -Math.PI / 2;
  shadow.castShadow = shadow.receiveShadow = false;
  return shadow
}
contactShadow(scene, -1.44, .006, .55, 1.49, .98, .26);
for (let x of [-1.81, -1.07]) for (let z of [.33, .77]) contactShadow(scene, x, .007, z, .25, .22, .38);
contactShadow(scene, 2.50, .008, -.12, 3.55, 1.63, .31);
const pailShadow = contactShadow(shelf, .18, .013, .04, .75, .53, .36);
