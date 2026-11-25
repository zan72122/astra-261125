'use strict';
const dog = group(), body = group(dog), head = group(dog), eyes = [], lids = [], ears = [], legs = [];
dog.position.set(-.12, .044, -1.76);
dog.scale.setScalar(1.14);
const furMap = texture(256, 256, (g, w, h) => {
  g.fillStyle = '#878787';
  g.fillRect(0, 0, w, h);
  for (let j = 0; j < 7500; j++) {
    let x = rnd() * w, y = rnd() * h;
    g.strokeStyle = rnd() < .48 ? '#aeaeae' : '#686868';
    g.lineWidth = range(.35, .85);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 1, y + 4, x + range(-2, 3), y + range(6, 15));
    g.stroke()
  }
});
const furMat = new T.MeshStandardMaterial( {vertexColors : true, roughness : .94, bumpMap : furMap, bumpScale : .0038});
const gardenLightTime = {value : 0};
function coatLight(m) {
  m.onBeforeCompile = s => {
    s.uniforms.gardenTime = gardenLightTime;
    s.vertexShader = 'varying vec3 furWorld;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfurWorld=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = 'varying vec3 furWorld; uniform float gardenTime;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat warmth=smoothstep(.045,.22,diffuseColor.r-diffuseColor.b);float beam=furWorld.x+.48*furWorld.y+.20*furWorld.z-.34*sin(gardenTime*.108);float gleam=exp(-40.0*beam*beam)*warmth;diffuseColor.rgb+=vec3(.041,.026,.014)*gleam;')
  };
  return m
}
coatLight(furMat);
const cream = color(0xf1e6cb), ivory = color(0xf8eedc), tan = color(0xb36232), rust = color(0x8e441f), deep = color(0x66331e);
function tone(a, b, t) {
  return a.clone().lerp(b, clamp(t))
}
function noise3(x, y, z) {
  return Math.sin(x * 21 + z * 8 + Math.sin(y * 23)) * .43 + Math.sin(x * 37 - y * 19 + z * 14) * .27 + Math.cos(z * 45 + x * 16) * .18 + Math.sin(58 * y - 28 * x) * .12
}
function coat(parent, pos, size, shade, shape) {
  const geo = new T.SphereGeometry(1, 80, 56), att = geo.attributes.position, colors = [];
  for (let i = 0; i < att.count; i++) {
    const p = v3().fromBufferAttribute(att, i), c = shade(p.x, p.y, p.z);
    c.multiplyScalar(1 + .024 * noise3(p.x, p.y, p.z));
    colors.push(c.r, c.g, c.b);
    if (shape) {
      shape(p);
      att.setXYZ(i, p.x, p.y, p.z)
    }
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const o = mesh(parent, geo, furMat, ...pos);
  o.scale.set(...size);
  return o
}
// Curved tapered locks gather into the longer feathering of a spaniel's ears and bib.
function hair(parent, locks) {
  let pts = [], cols = [], idx = [];
  for (const d of locks) {
    const base = pts.length / 3;
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, width = d.w * (.22 + .86 * Math.sin(PI * Math.pow(u, .81))) * (1 - u * .76) + .00016;
      const px = d.x + d.dx * u + d.wave * Math.sin(TAU * u + d.phase) * Math.sin(PI * u), py = d.y + d.dy * u, pz = d.z + d.dz * u + .009 * Math.sin(PI * u);
      for (let j = -1; j <= 1; j++) {
        pts.push(px + j * width, py, pz + (1 - Math.abs(j)) * width * .46);
        let c = d.c.clone().multiplyScalar((1 - .085 * Math.abs(j)) * (1 + .025 * u));
        cols.push(c.r, c.g, c.b)
      }
      if (i < 6)for (let j = 0; j < 2; j++) {
        let a = base + i * 3 + j;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4)
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const o = mesh(parent, geo, coatLight(new T.MeshStandardMaterial( {vertexColors : true, roughness : .88, side : T.DoubleSide})));
  o.castShadow = false;
  return o
}
const bodyShade = (x, y, z) => tone(cream, tan, smooth((-.24 - z + .23 * Math.sin(x * 5 + y * 2) + .08 * noise3(x, y, z)) * 10));
const barrel = coat(body, [0, .81, -.08], [.49, .72, .75], bodyShade);
barrel.rotation.x = -.25;
for (const k of [-1, 1]) {
  const hip = coat(body, [k * .365, .48, -.31], [.32, .46, .48], (x, y, z) => tone(cream, tan, smooth((.56 - z + .16 * y) * 6)));
  hip.rotation.z = k * .13;
  const paw = coat(body, [k * .43, .145, -.08], [.205, .14, .34], (x, y, z) => tone(cream, ivory, (y + 1) / 2));
  paw.rotation.y = k * .2;
}
coat(body, [0, 1.14, .21], [.445, .64, .405], (x, y, z) => tone(cream, tan, smooth((Math.abs(x) * .33 - z + .11 * Math.sin(y * 8)) * 6)));
const bibLocks = [];
for (let i = 0; i < 840; i++) {
  let x = range(-.98, .98), y = range(-.9, .84), z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  if (z < .21)continue;
  bibLocks.push( {x : x * .445, y : 1.14 + y * .64, z : .21 + z * .403, dx : x * range(.014, .087), dy : -range(.07, .24), dz : range(.002, .029), w : range(.004, .013), phase : rnd() * TAU, wave : range(.001, .009), c : tone(cream, ivory, rnd()).multiplyScalar(range(.83, 1.02))})
}
hair(body, bibLocks);
const claw = material(0xbba98c, .62), toeShadow = material(0xcdbea2);
for (const k of [-1, 1]) {
  const leg = group(dog);
  legs.push(leg);
  leg.position.set(k * .312, 0, .34);
  const shin = coat(leg, [0, .416, -.023], [.135, .391, .154], (x, y, z) => tone(cream, tan, smooth((noise3(x, y, z) * .08 + k * x * .3 + y * .3 - .28) * 8)));
  shin.rotation.x = -.12;
  coat(leg, [0, .131, .126], [.17, .131, .245], (x, y, z) => tone(cream, ivory, (z + 1) / 2));
  for (let j = -1; j <= 1; j++) {
    let xx = j * .087, zz = .26 - Math.abs(j) * .025;
    coat(leg, [xx, .103, zz], [.072, .083, .112], () => cream.clone());
    oval(leg, claw, xx, .073, zz + .084, .018, .020, .034, smallBall)
  }
}
const tail = group(dog);
tail.position.set(-.36, .31, -.49);
tail.rotation.z = .18;
const tailCurve = [v3(), v3(-.32, -.05, .05), v3(-.63, -.14, .19), v3(-.91, -.18, .41)];
tube(tail, material(0xb76e45), tailCurve, .088);
const tailLocks = [];
for (let i = 0; i < 300; i++) {
  let u = rnd(), p = new T.CatmullRomCurve3(tailCurve).getPoint(u);
  tailLocks.push( {x : p.x, y : p.y + range(-.025, .065), z : p.z + range(-.054, .068), dx : -range(.03, .15), dy : -range(.018, .08), dz : range(.03, .17), wave : .013, phase : rnd() * TAU, w : range(.006, .023), c : tone(tan, cream, smooth((u - .45) * 2) + range(-.12, .13))})
}
hair(tail, tailLocks);
head.position.set(0, 1.71, .37);
function faceColour(x, y, z) {
  let stripe = .124 + .07 * (1 - y) + .22 * smooth((-.04 - y) * 2.7) + .058 * Math.sin(y * 4.1 + .12);
  stripe += .013 * noise3(x, y, z) + .016 * Math.sin(y * 9 + 1);
  const brown = smooth((Math.abs(x + .018 * Math.sin(y * 5)) - stripe) * 27);
  return tone(tone(cream, ivory, z * .6 + .4), tone(tan, rust, .28 + .17 * y + .18 * Math.cos(x * 5 + z * 3)), brown)
}
coat(head, [0, .015, -.025], [.507, .448, .439], faceColour, p => {
  p.x *= 1 + .052 * p.y;
  p.y += .035 * (1 - p.y * p.y) * p.z
});
const brows = [];
for (let i = 0; i < 800; i++) {
  let x = range(-1, 1), y = range(-.64, .99), z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  if (z < .12)continue;
  let c = faceColour(x, y, z);
  brows.push( {x : x * .507 * (1 + .052 * y), y : .015 + (y + .035 * (1 - y * y) * z) * .448, z : -.024 + z * .439, dx : Math.sign(x) * range(.006, .032), dy : range(-.019, .002), dz : .002, w : range(.0008, .0026), wave : .0008, phase : rnd() * TAU, c : c.multiplyScalar(range(.77, 1.08))})
}
hair(head, brows);
const lip = material(0x4c3733, .66), noseM = material(0x282522, .31, {bumpMap : furMap, bumpScale : .002}), nostril = material(0x151513, .85);
coat(head, [0, -.185, .323], [.242, .145, .194], () => cream.clone());
oval(head, lip, 0, -.143, .417, .235, .091, .167);
for (const k of [-1, 1]) {
  const pad = coat(head, [k * .109, -.103, .409], [.166, .132, .180], (x, y, z) => tone(cream, ivory, .5 + y * .22));
  pad.rotation.z = k * .13;
}
const whiskerDots = [];
for (const k of [-1, 1]) {
  for (let i = 0; i < 20; i++) {
    let a = range(.25, 1.37), b = range(-.55, .24);
    let x = k * (.109 + .166 * Math.sin(a) * Math.cos(b)), y = -.103 + .132 * Math.sin(b), z = .409 + .181 * Math.cos(a) * Math.cos(b);
    whiskerDots.push( {p : [x, y, z], s : [.004, .004, .004], c : 0x987c60});
    if (i < 5)tube(head, material(0xccbea9, .76), [v3(x, y, z), v3(x + k * .065, y + .002, z + .043), v3(x + k * range(.12, .19), y - range(.005, .035), z + .072)], .00095)
  }
}
instance(head, smallBall, material(0xffffff), whiskerDots);
const nose = oval(head, noseM, 0, -.008, .539, .143, .092, .099);
for (const k of [-1, 1]) {
  const o = oval(head, nostril, k * .076, -.002, .619, .037, .021, .009);
  o.rotation.z = k * .25
}
tube(head, lip, [v3(0, -.074, .575), v3(0, -.107, .567), v3(0, -.132, .562)], .005);
const eyeLine = material(0x3d2920, .61), iris = material(0x442f20, .24), pupil = material(0x151713, .14), glint = new T.MeshBasicMaterial( {color : 0xfff4dc});
for (const k of [-1, 1]) {
  const socket = group(head);
  socket.position.set(k * .265, .075, .317);
  socket.rotation.y = k * .38;
  socket.rotation.z = k * .065;
  oval(socket, eyeLine, 0, 0, 0, .108, .098, .065);
  const e = group(socket);
  eyes.push(e);
  oval(e, iris, 0, .002, .036, .09, .084, .051);
  oval(e, pupil, .001, 0, .068, .057, .060, .025);
  oval(e, glint, -.028, .038, .085, .016, .012, .006, smallBall);
  oval(e, glint, .031, .006, .09, .0055, .005, .003, smallBall);
  const eyeLid = oval(socket, material(0x955028), 0, .096, .053, .104, .012, .031);
  lids.push(eyeLid);
}
for (const k of [-1, 1]) {
  const ear = group(head);
  ear.position.set(k * .432, .171, -.075);
  ear.rotation.z = k * .12;
  ears.push(ear);
  const earShade = (x, y, z) => tone(rust, tan, .28 + .25 * x * k + .19 * Math.sin(x * 7 + y * 4) + .12 * z);
  coat(ear, [k * .075, -.315, .005], [.192, .454, .225], earShade, p => {
    p.x *= 1 - .14 * p.y;
    p.z += .15 * (1 - p.y * p.y)
  });
  const locks = [];
  for (let i = 0; i < 1050; i++) {
    let a = range(-PI, PI), y = range(-.96, .99), r = Math.sqrt(1 - y * y), x = r * Math.sin(a), z = r * Math.cos(a);
    const c = earShade(x, y, z).multiplyScalar(range(.68, 1.13));
    locks.push( {x : k * .075 + .194 * x * (1 - .14 * y), y : -.315 + .455 * y, z : .005 + .226 * (z + .15 * (1 - y * y)), dx : k * range(-.018, .04), dy : -range(.054, .156) * (1.1 - .2 * y), dz : .023 * z + .012, w : range(.002, .009), wave : range(.003, .016), phase : y * 3 + x * 2 + k, c})
  }
  hair(ear, locks)
}
const dogShade = shadow(scene, 0, .034, -1.6, 2.63, 2.04, .88);

const mouthCrumb = oval(head, material(0x92533c, .4), .202, -.157, .513, .027, .014, .011, smallBall);
mouthCrumb.visible = false;
