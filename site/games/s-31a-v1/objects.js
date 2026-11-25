'use strict';
const rubber = material(0x5cafa5, .77), rimRubber = material(0x67b7ab, .62), indent = material(0x418f88, .81);
function outline(w, h, r) {
  let s = new T.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s
}
function flatShape(p, shape, thick, bevel, mat, y = 0) {
  const geo = new T.ExtrudeGeometry(shape, {depth : thick, bevelEnabled : true, bevelSize : bevel, bevelThickness : bevel, bevelSegments : 4, curveSegments : 20});
  geo.rotateX(-PI / 2);
  return mesh(p, geo, mat, 0, y, 0)
}
function border(p, w, h, r, height, rad, m) {
  const pts = outline(w, h, r).getSpacedPoints(190).slice(0, -1).map(p => v3(p.x, height, -p.y));
  return mesh(p, new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 200, rad, 9, true), m)
}
const mat = group(), matHome = v3(-.09, .119, .46), matWindow = v3(-.16, 1.405, glassZ + .059);
mat.position.copy(matHome);
const matBody = flatShape(mat, outline(2.89, 1.91, .18), .041, .018, rubber, -.053);
border(mat, 2.82, 1.84, .155, .009, .029, rimRubber);
border(mat, 2.71, 1.73, .125, .008, .009, indent);
function sdRound(x, z, w, h, r) {
  const a = Math.abs(x) - w + r, b = Math.abs(z) - h + r;
  return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(0, Math.max(a, b)) - r
}
function ribs(x, z) {
  if (x < .01 || x > 1.32)return 0;
  const j = clamp(Math.round((x - .106) / .185), 0, 6), cx = .106 + j * .185;
  const dz = Math.max(0, Math.abs(z) - (.657 - .037 * (j % 2))), d = Math.hypot(x - cx, dz);
  return d < .048 ? .061 * Math.pow(Math.max(0, 1 - (d / .048) ** 2), 1.35) : 0
}
function grain(x, z) {
  if (x > -.055 || sdRound(x, z, 1.34, .847, .14) > -.016)return 0;
  const row = Math.round(z / .108), col = Math.round((x - (row % 2) * .053) / .106);
  const d = Math.hypot(x - col * .106 - (row % 2) * .053, z - row * .108);
  return .021 * Math.pow(Math.max(0, 1 - (d / .03) ** 2), 1.2)
}
function relief(x, z) {
  return -.002 + ribs(x, z) + grain(x, z)
}
const panelGeo = new T.PlaneGeometry(2.696, 1.724, 194, 126);
panelGeo.rotateX(-PI / 2);
for (let i = 0; i < panelGeo.attributes.position.count; i++) {
  const a = panelGeo.attributes.position, x = a.getX(i), z = a.getZ(i);
  a.setY(i, sdRound(x, z, 1.348, .862, .13) > .001 ? -.018 : relief(x, z))
}
panelGeo.computeVertexNormals();
const panel = mesh(mat, panelGeo, rubber);
const matField = new PasteField(141, 93, 2.68, 1.71, (x, z) => sdRound(x, z, 1.334, .847, .13) < 0);
const foodSkin = pasteSurface(mat, matField, relief, 0x5cafa5);
const grip = group(mat);
grip.position.set(-.76, -.018, .947);
const gripShape = outline(.59, .217, .103), hole = new T.Path();
hole.absellipse(0, -.017, .171, .045, 0, TAU, true, 0);
gripShape.holes.push(hole);
flatShape(grip, gripShape, .038, .012, rimRubber);
const cups = [], cupRubber = material(0xa0ccba, .48, {transparent : true, opacity : .87});
for (const [x, z] of [[-1.31, -.78], [1.31, -.78], [-1.31, .78], [1.31, .78]]) {
  const cup = group(mat);
  cup.position.set(x, -.055, z);
  cups.push(cup);
  lathe(cup, cupRubber, [[.043, -.001], [.056, -.025], [.116, -.054], [.143, -.067], [.157, -.062], [.157, -.052], [.125, -.044], [.066, -.013], [.06, 0]]);
  const tab = oval(cup, cupRubber, Math.sign(x) * .132, -.051, .009, .09, .018, .045);
  tab.rotation.y = -Math.sign(x) * .18;
  ring(mat, indent, x, .011, z, .063, .006);
  oval(mat, rimRubber, x, .011, z, .052, .007, .052, smallBall)
}
const bendParts = [];
mat.updateMatrixWorld(true);
const inverseMat = mat.matrixWorld.clone().invert();
mat.traverse(o => {
  if (!o.isMesh || o === foodSkin.object)return;
  let geo = o.geometry.clone();
  o.geometry = geo;
  const st = geo.attributes.position.array.slice(), localToMat = new T.Matrix4().multiplyMatrices(inverseMat, o.matrixWorld), q = v3(0, 1, 0).transformDirection(localToMat.clone().invert());
  bendParts.push( {o, st, localToMat, q, scale : o.getWorldScale(v3())})
});
let lastBend = 0;
function bendMat(h) {
  if (Math.abs(h - lastBend) < .001 && !(h === 0 && lastBend !== 0))return;
  for (const b of bendParts) {
    let p = b.o.geometry.attributes.position, matCoords = v3();
    for (let i = 0; i < p.count; i++) {
      const x = b.st[i * 3], y = b.st[i * 3 + 1], z = b.st[i * 3 + 2];
      matCoords.set(x, y, z).applyMatrix4(b.localToMat);
      const dy = h * Math.pow(clamp((matCoords.z + .96) / 1.92), 2);
      p.setXYZ(i, x + b.q.x * dy / b.scale.x, y + b.q.y * dy / b.scale.y, z + b.q.z * dy / b.scale.z)
    }
    p.needsUpdate = true;
    b.o.geometry.computeVertexNormals()
  }
  lastBend = h;
  foodSkin.refresh(h)
}
const matShadow = shadow(scene, matHome.x, .0345, matHome.z, 3.58, 2.47, .68);
const dish = group(), dishHome = v3(.55, .036, 2.105), dishDock = v3(1.46, .348, -2.623);
dish.position.copy(dishHome);
const ceramic = material(0xe5d8b9, .33), glaze = material(0x788b7b, .44);
lathe(dish, ceramic, [[0, .032], [.29, .032], [.30, .009], [.33, .009], [.345, .039], [.455, .065], [.565, .126], [.591, .15], [.592, .167], [.577, .178], [.548, .166], [.505, .136], [.419, .104], [.31, .087], [0, .083]]);
ring(dish, glaze, 0, .172, 0, .572, .006);
ring(dish, glaze, 0, .156, 0, .547, .003);
const specks = [];
for (let i = 0; i < 220; i++) {
  const r = range(.471, .567), a = rnd() * TAU;
  specks.push( {p : [r * Math.cos(a), .124 + (r - .47) * .5, r * Math.sin(a)], s : [range(.001, .0035), .0009, range(.001, .003)], c : rnd() < .5 ? 0xb4a187 : 0xc8b398})
}
instance(dish, tinyBall, material(0xffffff), specks);
const dishBase = (x, z) => .082 + .052 * Math.pow(Math.hypot(x, z) / .5, 3);
const dishField = new PasteField(61, 61, .946, .946, (x, z) => Math.hypot(x, z) < .458);
for (let i = 0; i < dishField.h.length; i++) {
  const x = dishField.x(i), z = dishField.z(i), rad = Math.hypot(x * 1.02, z * 1.11), edge = .435 + .019 * Math.sin(Math.atan2(z, x) * 5);
  dishField.h[i] = rad < edge ? .139 * Math.pow(1 - (rad / edge) ** 2, .84) * (.97 + .073 * Math.sin(x * 23 + z * 11) + .049 * Math.sin(31 * z - 15 * x)) : 0
}
const dishSkin = pasteSurface(dish, dishField, dishBase, 0xe5d8b9);
const dishShadow = shadow(scene, dishHome.x, .0347, dishHome.z, 1.5, 1.49, .77);
const dockTray = group();
dockTray.position.copy(dishDock);
dockTray.position.y -= .013;
lathe(dockTray, wood, [[0, 0], [.55, 0], [.635, .009], [.657, .023], [.651, .035], [.627, .036], [.605, .022], [.565, .014], [0, .014]]);
const shelf = box(scene, wood, 1.58, .275, -2.89, 1.86, .135, 1.05);
box(scene, trim, 1.61, .155, -2.96, .16, .24, .38);
const tool = group(), bladeGroup = group(tool);
const bladeM = material(0xc5b797, .49), thin = material(0xb5a584, .54), metal = material(0xb59b69, .33, {metalness : .52});
const bladeShape = new T.Shape();
bladeShape.moveTo(-.061, -.16);
bladeShape.bezierCurveTo(-.092, -.1, -.181, -.094, -.18, .05);
bladeShape.bezierCurveTo(-.18, .16, -.153, .21, -.073, .219);
bladeShape.bezierCurveTo(.018, .229, .152, .225, .173, .16);
bladeShape.bezierCurveTo(.197, .03, .163, -.055, .121, -.099);
bladeShape.bezierCurveTo(.088, -.126, .073, -.13, .054, -.173);
bladeShape.closePath();
const blade = flatShape(bladeGroup, bladeShape, .021, .013, bladeM);
box(tool, thin, 0, .018, .21, .093, .049, .167);
const handleHolder = group(tool);
handleHolder.position.set(0, .027, .241);
handleHolder.rotation.x = PI / 2;
const handle = lathe(handleHolder, wood, [[.041, 0], [.055, .012], [.058, .035], [.053, .095], [.047, .18], [.055, .38], [.072, .58], [.073, .69], [.069, .717], [.052, .744], [.027, .755], [0, .757]], 40);
lathe(handleHolder, metal, [[.055, .014], [.059, .016], [.059, .043], [.055, .047]], 40);
const toolHomeAngle = .96, homeOffset = v3(-.136, .212, -.085);
const foodOnBlade = group(bladeGroup);
foodOnBlade.position.set(0, .021, -.079);
const pasteM = material(0x98553b, .51, {bumpMap : furMap, bumpScale : .006});
let dollopGeo = new T.SphereGeometry(1, 48, 28);
for (let i = 0; i < dollopGeo.attributes.position.count; i++) {
  let a = dollopGeo.attributes.position, x = a.getX(i), y = a.getY(i), z = a.getZ(i), f = 1 + .045 * noise3(x, y, z);
  a.setXYZ(i, x * f + .12 * y * y, Math.max(-.12, y) * f, z * f - .14 * y * y)
}
dollopGeo.computeVertexNormals();
const dollop = mesh(foodOnBlade, dollopGeo, pasteM);
let bladeLoad = 0;
for (let j = 0; j < 10; j++)bladeLoad += dishField.scrape(-.09 + j * .011, -.22 + j * .028, 0, 1, .14, .09, .73, .008);
function bladePortion() {
  const r = Math.cbrt(Math.max(bladeLoad, 0) / 2.12);
  dollop.scale.set(r * 1.12, r * .85, r);
  dollop.visible = bladeLoad > .000025
}
function homeTool() {
  const p = dish.position.clone().add(homeOffset);
  p.y = dish.position.y + dishBase(homeOffset.x, homeOffset.z) + Math.max(.011, dishField.at(homeOffset.x, homeOffset.z)) + .012;
  return p
}
tool.position.copy(homeTool());
tool.rotation.order = 'YXZ';
tool.rotation.set(-.065, toolHomeAngle, 0, 'YXZ');
bladePortion();
foodSkin.refresh();
dishSkin.refresh();

const leadingPaste = mesh(mat, dollopGeo, pasteM);
leadingPaste.visible = false;
