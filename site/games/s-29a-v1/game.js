'use strict';
const saveKey = 'calf-barn-261125-v1';
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(saveKey) || '{}') || {}
} catch {}
const stored = (v, d, a, b) => Number.isFinite(v) ? clamp(v, a, b): d;
let milk = stored(saved.milk, .53, 0, 1), pailMilk = stored(saved.pailMilk, 0, 0, bucketCapacity);
let opened = stored(saved.opened, 0, 0, 1), hook = Number.isInteger(saved.hook) ? clamp(saved.hook, -1, 1): -1;
let lastHook = stored(saved.lastHook, 1, 0, 1), lastMouth = Array.isArray(saved.memory) && saved.memory.length === 3 ? V(...saved.memory.map((v,
  i) => stored(v, [0, 1.57, .52][i], [-.55, 1.28, .16][i], [.68, 2.12, .95][i]))): null;
let feedingOrder = Array.isArray(saved.history) ? saved.history.filter(x => x === 'pail' || x === 'bottle').slice(-32): [];
let started = Boolean(saved.started), nursed = stored(saved.nursed, 0, 0, 100000), handTime = stored(saved.handTime,
  0, 0, 1e8);
let active = null, mode = 'rest', angleGoal = -.14, angle = -.14, slosh = 0, sloshSpeed = 0, oldAngle = angle,
  bottleGoal = rest.clone(), pailGoal = bucketHome.clone();
let currentTime = 0, lastTouch = 0, movedAt = 0, sniffTime = 0, sniffed = false, latched = '', sipTime = 0, swallowed = false,
  bubbleDue = -1, lick = 0, relax = 0;
let seal = V(), sniffSpot = V(), seeking = false, searchTime = 0, releaseFrom = null, stage = opened, bucketSwing = 0,
  bucketVel = 0, releaseVel = 0, homeKnock = false;
let useReserve = false, reserveGoal = refillHome.clone(), reserve = stored(saved.reserve, spareCapacity, 0, spareCapacity);
let dock = false, capUp = false, capUsed = false, pourAngle = -.46, lastFlow = 0, dropTime = 0, dropAt = V(), lastSave = 0,
  stageLight = 0;
let portrait = false, aspect = 1;
if (Array.isArray(saved.bubbles)) for (let b of saved.bubbles.slice(-32)) {
  if (Array.isArray(b) && b.length === 2 && b.every(Number.isFinite)) birthBubble(clamp(b[0], -1.51, -.39), clamp(b[1], .008, .034),
    true)
}
if (Array.isArray(saved.film)) saved.film.slice(0, liquidStations).forEach((v, i) => highWater[i] = stored(v, -1,
  -1, .29));
for (let i = 0; i < stored(saved.pailFoam, 0, 0, 22); i++) bucketBubble();
function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      milk,
      pailMilk,
      reserve,
      opened,
      hook,
      lastHook,
      memory: lastMouth?.toArray(),
      nursed,
      started,
      handTime,
      history: feedingOrder,
      bubbles: bubbles.filter(b => b.top).map(b => [b.x, b.size]),
      film: highWater,
      pailFoam: bucketFoam.length
    }))
  } catch {}
  lastSave = currentTime
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    release();
    save()
  }
});
window.addEventListener('pagehide', save);
const sound = {
  ctx: null,
  noise: null,
  nextBreath: 2,
  nextWood: 9,
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return ;
    try {
      if (!this.ctx) {
        this.ctx = new AC();
        let n = Math.floor(this.ctx.sampleRate * 1.7);
        this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        let d = this.noise.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch (() => {})
    } catch {}
  },
  hush(f, seconds, volume, q = .6) {
    if (!this.ctx || this.ctx.state !== 'running') return ;
    let c = this.ctx, t = c.currentTime, b = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    b.buffer = this.noise;
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    g.gain.setValueAtTime(.00001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + seconds * .27);
    g.gain.exponentialRampToValueAtTime(.00001, t + seconds);
    b.connect(bp).connect(g).connect(c.destination);
    b.start(t, Math.random() * .22);
    b.stop(t + seconds + .02);
    b.onended = () => {
      b.disconnect();
      bp.disconnect();
      g.disconnect()
    }
  },
  tone(a, b, d, v, w = 'sine') {
    if (!this.ctx || this.ctx.state !== 'running') return ;
    let c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = w;
    o.frequency.setValueAtTime(a, t);
    o.frequency.exponentialRampToValueAtTime(b, t + d);
    g.gain.setValueAtTime(.00001, t);
    g.gain.exponentialRampToValueAtTime(v, t + .013);
    g.gain.exponentialRampToValueAtTime(.00001, t + d);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(t + d + .015);
    o.onended = () => {
      o.disconnect();
      g.disconnect()
    }
  },
  gulp() {
    this.tone(165, 77, .17, .072);
    this.hush(720, .112, .062, 1.5)
  },
  knock() {
    this.tone(204, 81, .13, .044, 'triangle');
    this.hush(1100, .09, .025)
  },
  creak() {
    this.tone(356, 289, .16, .014, 'triangle');
    this.hush(1520, .26, .016, 2.5)
  },
  tick(t) {
    if (t > this.nextBreath) {
      this.hush(510 + rnd() * 110, .58, .036);
      this.nextBreath = t + 2.8 + rnd() * 2.1
    }
    if (t > this.nextWood) {
      this.creak();
      this.nextWood = t + 11 + rnd() * 13
    }
  }
};
function mounted(k) {
  return V(rail.position.x + hooks[k], rail.position.y + .099 - .505, rail.position.z + .369)
}
if (hook >= 0) {
  pailGoal.copy(mounted(hook));
  bucket.position.copy(pailGoal)
}
function cameraPose() {
  let s = stage, p = portrait ? 1: 0;
  let target = V(lerp(-.10 - .10 * p, -.475 - .04 * p, s), lerp(1.68, 1.15, s), lerp(.22, .34, s));
  let direction = V(lerp(-.17 - .49 * p, -.46 - .16 * p, s), lerp(.105 + .104 * p, .172 + .102 * p, s), 1).normalize();
  let width = lerp(p ? 2.75: Math.min(6.65, Math.max(4.80, aspect * 3.46)), p ? 2.44: Math.min(5.4, Math.max(3.85,
    aspect * 2.60)), s);
  let dist = lerp(5.6, 4.35, s);
  camera.fov = 2 * Math.atan(width / (2 * aspect * dist)) * 180 / Math.PI;
  camera.position.copy(target).addScaledVector(direction, dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld()
}
function size() {
  let w = canvas.clientWidth, h = canvas.clientHeight;
  aspect = w / Math.max(1, h);
  portrait = aspect < .84;
  camera.aspect = aspect;
  renderer.setSize(w, h, false);
  cameraPose()
}
window.addEventListener('resize', size);
size();
function project(q) {
  let v = q.clone().project(camera);
  return {x: (v.x + 1) * canvas.clientWidth / 2, y: (1 - v.y) * canvas.clientHeight / 2}
}
function world(o, x = 0, y = 0, z = 0) {
  return o.localToWorld(V(x, y, z))
}
const ray = new T.Raycaster();
function planePoint(px, py, z) {
  ray.setFromCamera(new T.Vector2(px / canvas.clientWidth * 2 - 1, 1 - py / canvas.clientHeight * 2), camera);
  let d = (z - ray.ray.origin.z) / ray.ray.direction.z;
  return ray.ray.at(d, V())
}
function canWindow() {
  return started && !active && mode === 'rest' && opened < .999
}
function canBucket() {
  return opened > .965 && !active && !dock
}
function targetControls() {
  let c = [];
  function add(id, node, points, r) {
    c.push({id, node, points, r})
  }
  if (!active && mode !== 'return') {
    if (dock && useReserve) {
      add('lid', spareLid, [world(spareLid, .085, .019)], 25);
      add('pour', refill, [world(refill, 0, .12, .052), world(refill, 0, .22, .033)], 24)
    } else if (dock) {
      add('lid', lid, [world(lid, -.03, -.34, .04), world(lid, 0, -.18, 0)], 31);
      add('pour', grip, [world(grip, -.26), world(grip), world(grip, .24)], 28)
    } else {
      add('hold', grip, [world(grip, -.38), world(grip, -.18), world(grip, .03), world(grip, .24), world(grip,
        .34)], 27);
      add('bottle', bottle, [world(bottle, -1.39, .07), world(bottle, -1.10, .06), world(bottle, -.83, .04), world(bottle,
        -.53, 0)], 22)
    }
  }
  if (canWindow()) add('window', pull, [world(pull, 0, 0, .1)], 27);
  if (canBucket()) add('pail', bucket, [world(bail, -.095, .35, 0), world(bail, -.07, .25, .18), world(bucket,
    0, .39, .25), world(bucket, 0, .23, .18)], 26);
  if (opened > .965 && milk < .0015 && !active && !dock) add('refill', refill, [world(refill, 0, .27, 0), world(refill,
    0, .4, 0)], 27);
  return c
}
function pick(x, y) {
  let list = [];
  for (let c of targetControls()) {
    for (let pt of c.points) {
      let q = project(pt), d = Math.hypot(x - q.x, y - q.y), r = c.r + (portrait ? 0: 5);
      if (d < r) list.push({c, d: d / r})
    }
  }
  list.sort((a, b) => a.d - b.d);
  return list[0]?.c
}
function priority() {
  if (active) return '';
  if (dock) return capUp ? ((useReserve ? reserve: milk) < .001 || pailMilk >= bucketCapacity - .001 ? 'lid': 'pour'): (capUsed ? 'return': 'lid');
  if (opened > .965) {
    if (hook < 0) return 'pail';
    if (milk < .0015) return 'refill';
    return 'hold'
  }
  if (opened > .004 || (nursed > 1 && mode === 'rest' && handTime > 4)) return 'window';
  return 'hold'
}
function loseLatch() {
  latched = '';
  sipTime = 0;
  swallowed = false;
  lick = 0
}
function startReturn() {
  if (useReserve) {
    useReserve = false;
    dock = false;
    capUp = false;
    mode = 'rest';
    reserveGoal.copy(refillHome);
    return
  }
  dock = false;
  capUp = false;
  mode = 'return';
  releaseVel = 0;
  homeKnock = false;
  bottleGoal.copy(rest);
  angleGoal = -.14;
  loseLatch();
  sniffed = false;
  sniffTime = 0;
  searchTime = 0;
  releaseFrom = head.position.clone();
  seeking = true
}
function enterDock(spare = false) {
  useReserve = spare;
  dock = true;
  mode = spare ? 'reserveDock': 'dock';
  capUp = false;
  capUsed = false;
  pourAngle = -.46;
  sloshSpeed += .50;
  sound.knock();
  loseLatch();
  if (active) active = null;
  save()
}
function grab(e) {
  if (active || e.button > 0) return ;
  sound.unlock();
  let c = pick(e.clientX, e.clientY);
  if (!c) return ;
  let p = planePoint(e.clientX, e.clientY, bottle.position.z), id = c.id === 'bottle' ? 'hold': c.id;
  active = {
    id,
    pid: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    px: e.clientX,
    py: e.clientY,
    p,
    startBottle: bottle.position.clone(),
    startPail: bucket.position.clone(),
    startAngle: angleGoal,
    startOpen: opened,
    time: currentTime,
    fromHook: hook,
    maxDrag: 0,
    tilt: false,
    wasDock: dock
  };
  canvas.setPointerCapture(e.pointerId);
  lastTouch = currentTime;
  started = true;
  guide.visible = false;
  if (id === 'hold') {
    let butt = project(world(grip, -.40, 0, 0)), front = project(world(grip, .35, 0, 0)), vx = front.x - butt.x,
      vy = front.y - butt.y;
    let gripFraction = ((e.clientX - butt.x) * vx + (e.clientY - butt.y) * vy) / Math.max(1, vx * vx + vy * vy);
    active.tiltArmed = gripFraction < .35 && handTime > 3.8;
    mode = 'hand';
    bottleGoal.copy(bottle.position);
    bottleGoal.y += .055;
    angleGoal = angle - .086;
    sloshSpeed -= 1.85;
    sniffed = false;
    sniffTime = 0;
    seeking = false;
    loseLatch();
    sound.creak()
  }
  if (id === 'window') {
    sound.creak();
    opened = Math.min(1, opened + .012)
  }
  if (id === 'pail') {
    loseLatch();
    hook = -1;
    pailGoal.copy(bucket.position);
    pailGoal.y += .07;
    bucketVel += .44;
    sound.knock()
  }
  if (id === 'lid') {
    active.startAngle = pourAngle;
    capUp = !capUp;
    capUsed = true;
    sound.tone(571, 322, .095, .038, 'triangle')
  }
  if (id === 'pour') {
    active.startAngle = pourAngle
  }
  if (id === 'refill') {
    if (reserve < .0001) reserve = spareCapacity;
    active.startSpare = refill.position.clone();
    reserveGoal.copy(refill.position);
    reserveGoal.y += .046;
    sound.knock()
  }
  save()
}
function drag(e) {
  if (!active || active.pid !== e.pointerId) return ;
  let a = active, dx = e.clientX - a.sx, dy = e.clientY - a.sy;
  a.px = e.clientX;
  a.py = e.clientY;
  a.maxDrag = Math.max(a.maxDrag, Math.hypot(dx, dy));
  lastTouch = currentTime;
  movedAt = currentTime;
  let z = a.id === 'pail' ? a.startPail.z: a.startBottle.z;
  let start = planePoint(a.sx, a.sy, z), p = planePoint(e.clientX, e.clientY, z), delta = p.sub(start);
  if (a.id === 'hold') {
    if (a.tilt) {
      angleGoal = clamp(a.startAngle - delta.y * 1.7, -1.12, .26);
      bottleGoal.x = clamp(a.startBottle.x + delta.x * .20, -.64, .53);
      bottleGoal.y = clamp(a.startBottle.y + delta.y * .062, 1.29, 2.11)
    } else {
      bottleGoal.x = clamp(a.startBottle.x + delta.x, -.84, .64);
      bottleGoal.y = clamp(a.startBottle.y + .048 + delta.y, 1.09, 2.22);
      bottleGoal.z = clamp(a.startBottle.z - delta.x * .12, .31, .76);
      angleGoal = clamp(-.14 - delta.y * .26, -.44, .08)
    }
    if (latched === 'bottle' && bottleGoal.distanceTo(seal) > .125) {
      loseLatch();
      sniffTime = 0;
      sniffed = false;
      sloshSpeed += .43
    }
    if (opened > .965 && hook >= 0 && a.maxDrag > 19) {
      let at = project(world(pourYoke, 0, .08, 0));
      if (Math.hypot(at.x - e.clientX, at.y - e.clientY) < (portrait ? 40: 51)) enterDock()
    }
  } else if (a.id === 'carryBack') {
    if (a.returningSpare) {
      reserveGoal.copy(a.startSpare).add(delta);
      reserveGoal.y = Math.max(refillHome.y, reserveGoal.y)
    } else {
      bottleGoal.copy(a.startBottle).add(delta);
      bottleGoal.y = Math.max(rest.y, bottleGoal.y);
      angleGoal = follow(a.startAngle, -.14, 4, .1)
    }
  } else if (a.id === 'refill') {
    let delta = planePoint(e.clientX, e.clientY, refillHome.z).sub(planePoint(a.sx, a.sy, refillHome.z));
    reserveGoal.copy(a.startSpare).add(delta);
    reserveGoal.y = clamp(reserveGoal.y, refillHome.y, 1.7);
    let aim = project(world(pourYoke, 0, .09));
    if (hook >= 0 && Math.hypot(e.clientX - aim.x, e.clientY - aim.y) < 43) enterDock(true)
  } else if (a.id === 'window') {
    let sx = project(world(shutter, .75, 0, 0)), ex = project(world(shutter, 2.95, 0, 0));
    opened = clamp(a.startOpen + dx / Math.max(90, ex.x - sx.x), 0, 1);
    if (opened > .987) opened = 1
  } else if (a.id === 'pail') {
    pailGoal.x = clamp(a.startPail.x + delta.x, -1.25, .32);
    pailGoal.y = clamp(a.startPail.y + delta.y + .05, bucketHome.y, 1.50);
    bucketVel = clamp(bucketVel + delta.x * .028, -1.2, 1.2);
    for (let k = 0; k < 2; k++) {
      let slot = mounted(k);
      if (Math.abs(pailGoal.x - slot.x) < .22 && pailGoal.y >= slot.y + .022) a.overSlot = k
    }
  } else if (a.id === 'pour' || (a.id === 'lid' && capUp && a.maxDrag > 12)) {
    if (!capUp && a.id === 'pour' && a.maxDrag > 16) {
      a.id = 'carryBack';
      a.returningSpare = useReserve;
      a.startSpare = refill.position.clone();
      a.startBottle.copy(bottle.position);
      a.startAngle = angle;
      a.sx = e.clientX;
      a.sy = e.clientY;
      dock = false;
      useReserve = false;
      mode = 'carryBack';
      return
    }
    if (capUp) {
      let dist = -dy / (portrait ? 145: 162);
      pourAngle = clamp((a.startAngle ?? -.46) + dist * 2.18, -.72, 1.54);
      if (dy > 75 && pourAngle < -.52) {
        startReturn();
        active = null
      }
    }
  }
}
function release(e) {
  if (!active || (e && active.pid !== e.pointerId)) return ;
  let a = active;
  active = null;
  lastTouch = currentTime;
  if (a.id === 'hold') {
    if (opened > .965 && hook >= 0 && a.maxDrag > 12) {
      let at = project(world(pourYoke, 0, .1));
      if (Math.hypot(at.x - a.px, at.y - a.py) < (portrait ? 54: 68)) {
        enterDock();
        return
      }
    }
    startReturn()
  }
  if (a.id === 'pail') {
    let nearest = Math.abs(pailGoal.x - mounted(0).x) < Math.abs(pailGoal.x - mounted(1).x) ? 0: 1;
    if (a.fromHook >= 0 && a.maxDrag < 12) {
      hook = a.fromHook;
      pailGoal.copy(mounted(hook))
    } else if (a.overSlot === nearest && Math.abs(pailGoal.y - mounted(nearest).y - .04) < .162 && Math.abs(pailGoal.x - mounted(nearest).x) < .235) {
      hook = nearest;
      lastHook = nearest;
      pailGoal.copy(mounted(nearest));
      sound.knock()
    } else {
      hook = -1;
      pailGoal.copy(bucketHome)
    }
    bucketVel += .16;
    sniffTime = 0;
    sniffed = false
  }
  if (a.id === 'refill' || (a.id === 'carryBack' && a.returningSpare)) reserveGoal.copy(refillHome);
  if (a.id === 'carryBack') startReturn();
  if (a.id === 'window' && opened === 1) sound.knock();
  if ((a.id === 'pour' || a.id === 'lid') && capUp) pourAngle = -.46;
  if (a.id === 'pour' && a.maxDrag < 8 && !capUp) {
    startReturn()
  }
  save()
}
canvas.addEventListener('pointerdown', grab);
canvas.addEventListener('pointermove', drag);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
  release();
  save()
});
const guide = group(scene), guideSkin = mat(0xffedd4, .62, 0, {transparent: true, opacity: .31, depthWrite: false}),
  guideNail = mat(0xfff7e8, .42, 0, {transparent: true, opacity: .22, depthWrite: false});
function finger(p, pts, radii) {
  let curve = new T.CatmullRomCurve3(pts), ps = [], idx = [];
  for (let i = 0; i <= 24; i++) {
    let u = i / 24, q = curve.getPoint(u), f = u * (radii.length - 1), k = Math.min(radii.length - 2, Math.floor(f)),
      r = lerp(radii[k], radii[k + 1], ease(f - k)), t = curve.getTangent(u).normalize(), n = t.clone().cross(V(0,
      0, 1)).normalize(), b = t.clone().cross(n);
    for (let j = 0; j <= 18; j++) {
      let a = j / 18 * TAU, v = q.clone().addScaledVector(n, r * Math.cos(a)).addScaledVector(b, r * .85 * Math.sin(a));
      ps.push(...v.toArray());
      if (i < 24 && j < 18) {
        let k = i * 19 + j;
        idx.push(k, k + 1, k + 19, k + 1, k + 20, k + 19)
      }
    }
  }
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(ps, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  mesh(p, g, guideSkin)
}
finger(guide, [V(), V(.018, -.022, .013), V(.070, -.076, .036), V(.125, -.135, .071), V(.163, -.199, .072)], [.003,
  .031, .033, .035, .041]);
let palm = egg(guide, .21, -.25, .059, .105, .131, .048, guideSkin);
palm.rotation.z = .48;
for (let j = 0; j < 3; j++) {
  let x = .165 + .041 * j;
  finger(guide, [V(x, -.19 - .018 * j, .055), V(x - .019, -.139 - .02 * j, .042), V(x + .004, -.123 - .021 * j,
    .011), V(x + .032, -.19 - .022 * j, .006)], [.036, .032, .029, .019])
}
finger(guide, [V(.143, -.277, .046), V(.087, -.237, .044), V(.071, -.188, .037), V(.089, -.167, .022)], [.042,
  .036, .029, .006]);
let nailTip = egg(guide, .025, -.026, .042, .019, .029, .004, guideNail);
nailTip.rotation.z = .65;
guide.traverse(o => {
  o.castShadow = false;
  o.receiveShadow = false
});
guide.visible = false;
const spareCapGlow = meshMaterial(spareLid.children[0]);
const pullGlow = meshMaterial(pull.children.at(-1)), lidGlow = meshMaterial(stopper), bailGlow = meshMaterial(bail.children.at(-1)),
  refillGlow = meshMaterial(refill.children[0]);
function meshMaterial(obj) {
  obj.material = obj.material.clone();
  return obj.material
}
const prompts = {hold: handleWood, window: pullGlow, pail: bailGlow, lid: lidGlow, pour: handleWood, refill: refillGlow,
  return : handleWood};
let lastGlowMaterial = null;
function hints(t) {
  let id = priority(), age = t - lastTouch;
  prompts.lid = useReserve ? spareCapGlow: lidGlow;
  prompts.pour = prompts.return = useReserve ? refillGlow: handleWood;
  if (lastGlowMaterial) lastGlowMaterial.emissive.setRGB(0, 0, 0);
  if (id && prompts[id]) {
    let a = .039 + .105 * (.5 + .5 * Math.sin(t * 2.75)) ** 3;
    prompts[id].emissive.setRGB(a, a * .52, a * .13)
  }
  lastGlowMaterial = prompts[id];
  let phase = (age - 4) % 6.3;
  guide.visible = !!id && age >= 4 && phase >= 0 && phase < 3.1 && mode !== 'return';
  if (!guide.visible) return ;
  let p = clamp((phase - .44) / 1.94, 0, 1), u = ease(p), src, dst;
  if (id === 'hold') {
    src = world(grip, -.04, 0, .082);
    if (hook >= 0 && opened > .965) dst = world(pourYoke, 0, .095, .02); else dst = src.clone().add(V(.12, .37,
      0))
  }
  if (id === 'window') {
    src = world(pull, 0, .0, .18);
    dst = src.clone().add(V(.57, 0, 0))
  }
  if (id === 'pail') {
    src = world(bail, -.09, .35, 0);
    dst = src.clone().add(mounted(Math.round(lastHook)).sub(bucket.position));
    dst.y += .10
  }
  if (id === 'lid') {
    src = useReserve ? world(spareLid, .09, .04, 0): world(lid, -.035, -.39, 0);
    dst = src.clone().add(V(.036, .12, 0))
  }
  if (id === 'pour') {
    src = useReserve ? world(refill, 0, .18, .06): world(grip, 0, 0, .04);
    dst = src.clone().add(V(.03, .34, 0))
  }
  if (id === 'return') {
    src = useReserve ? world(refill, 0, .19, .06): world(grip, 0, 0, .04);
    dst = useReserve ? refillHome.clone().add(V(0, .2, 0)): world(stand, 0, 1.15, .31)
  }
  if (id === 'refill') {
    src = world(refill, 0, .23, .06);
    dst = world(pourYoke, 0, .09, 0)
  }
  if (!src || !dst) {
    guide.visible = false;
    return
  }
  guide.position.copy(src).lerp(dst, u);
  guide.position.z += .083;
  guide.position.y += .048 * (1 - ease(phase / .4));
  guide.rotation.y = portrait ? -.38: -.08;
  let a = ease(phase / .24) * ease((3.1 - phase) / .42);
  guideSkin.opacity = .31 * a;
  guideNail.opacity = .24 * a;
  guide.scale.setScalar(portrait ? .96: 1.04)
}
function motion(dt, t) {
  stage = follow(stage, opened, 4.3, dt);
  shutter.position.x = -1.50 + opened * 2.25;
  cameraPose();
  if (mode === 'return') {
    bottleGoal.copy(rest);
    releaseVel = Math.min(1.32, releaseVel + dt * 2.65);
    let currentY = bottle.position.y;
    if (currentY > rest.y) bottle.position.y = Math.max(rest.y, currentY - releaseVel * dt); else bottle.position.y = follow(currentY,
      rest.y, 8, dt);
    bottle.position.x = follow(bottle.position.x, rest.x, 5.6, dt);
    bottle.position.z = follow(bottle.position.z, rest.z, 7, dt);
    if (!homeKnock && Math.abs(bottle.position.y - rest.y) < .022) {
      homeKnock = true;
      sloshSpeed += .60;
      sound.knock()
    }
    if (bottle.position.distanceTo(rest) < .012 && Math.abs(angle + .14) < .03) {
      mode = 'rest';
      bottle.position.copy(rest);
      save()
    }
  } else if (mode === 'dock') {
    angleGoal = pourAngle;
    let dest = V(bucket.position.x - .035, bucket.position.y + .90, bucket.position.z);
    let q = new T.Quaternion().setFromEuler(new T.Euler(0, Math.PI - .085, angleGoal, 'YXZ'));
    bottleGoal.copy(dest).sub(V(-1.566, -.133, 0).applyQuaternion(q));
    bottle.position.lerp(bottleGoal, 1 - Math.exp(-dt * 7));
  } else {
    bottle.position.lerp(bottleGoal, 1 - Math.exp(-dt * 12))
  }
  let yawGoal = dock && !useReserve ? Math.PI - .085: (portrait ? .24: .025);
  bottle.rotation.y = follow(bottle.rotation.y, yawGoal, dock ? 7.5: 6, dt);
  angle = follow(angle, angleGoal, 8.5, dt);
  sloshSpeed += -(angle - oldAngle) * 3.8;
  oldAngle = angle;
  sloshSpeed += (-slosh * 37 - sloshSpeed * 3.9) * dt;
  slosh = clamp(slosh + sloshSpeed * dt, -.34, .34);
  bottle.rotation.z = angle;
  let roll = useReserve ? -(1.18 + pourAngle): 0;
  refill.rotation.z = follow(refill.rotation.z, roll, 9, dt);
  if (useReserve) {
    reserveGoal.set(bucket.position.x - .05, bucket.position.y + .81, bucket.position.z);
    reserveGoal.sub(V(0, .414, 0).applyQuaternion(refill.quaternion))
  }
  refill.position.lerp(reserveGoal, 1 - Math.exp(-dt * 8.4));
  spareLid.rotation.z = follow(spareLid.rotation.z, useReserve && capUp ? 2.38: 0, 9, dt);
  let targetCap = capUp && !useReserve ? -2.12: 0;
  lid.rotation.z = follow(lid.rotation.z, targetCap, 10, dt);
  bucket.position.lerp(pailGoal, 1 - Math.exp(-dt * (active?.id === 'pail' ? 6.1: 7.8)));
  bucketVel += (-bucketSwing * 24 - bucketVel * 4.8) * dt;
  bucketSwing += bucketVel * dt;
  bucket.rotation.z = bucketSwing;
  bail.rotation.x = .09 + .12 * Math.sin(bucketSwing * 3);
  bail.position.y = .467 + clamp((pailGoal.y - bucket.position.y) * .23, -.018, .037);
  pourYoke.position.x = hook < 0 ? -.99: bucket.position.x - .64;
  pourYoke.position.z = hook < 0 ? .07: bucket.position.z;
  pourYoke.position.y = hook < 0 ? 1.30: bucket.position.y + .64;
  refill.scale.y = follow(refill.scale.y, 1, 5, dt);
  motes.position.x = .035 * Math.sin(t * .13);
  motes.position.y = .034 * Math.sin(t * .22);
  stageLight = follow(stageLight, stage, 2, dt);
  softbox.intensity = 1.42 + stageLight * .30;
  windowLight.intensity = stageLight * 26;
  let sweep = clamp(stage * 1.55, 0, 1);
  windowLight.target.position.set(lerp(-1.34, .94, sweep) - ease((stage - .65) / .35) * .85, lerp(1.12, 1.94, sweep) - ease((stage - .65) / .35) * .42,
    .53);
  pailShadow.material.uniforms.strength.value = .34 * clamp(1 - (bucket.position.y - bucketHome.y) * 3, 0, 1);
  updateArm()
}
function flow(dt, t) {
  let rate = 0, streamStart = world(bottle, -1.592, -.198, 0), dest = V(bucket.position.x, bucket.position.y + .55,
    bucket.position.z);
  if (useReserve && dock && capUp && hook >= 0) {
    streamStart = world(refill, .068, .413, 0);
    let excess = reserve / spareCapacity - retainedInSpare(refill.rotation.z);
    if (excess > 0 && reserve > .00001 && pailMilk < bucketCapacity - .0001) {
      rate = Math.sqrt(excess) * .035;
      let qty = Math.min(reserve, bucketCapacity - pailMilk, dt * rate);
      reserve -= qty;
      pailMilk += qty
    }
  } else if (dock && capUp && milk > 0 && hook >= 0 && pailMilk < bucketCapacity - .0001 && Math.hypot(streamStart.x - dest.x,
    streamStart.z - dest.z) < .29) {
    let depth = liquidHeight - (-1.56 * Math.sin(angle) - .198 * Math.cos(angle));
    if (depth > .0001 && angle > -.37) rate = Math.min(.109, Math.sqrt(depth) * .102);
    if (angle > 1.42 && milk < .012) rate = Math.max(rate, .017);
    let amount = Math.min(milk, Math.max(0, bucketCapacity - pailMilk), rate * dt);
    milk -= amount;
    pailMilk += amount;
    if (amount === 0) rate = 0;
  }
  stream.visible = rate > .0001;
  if (stream.visible) {
    let hit = V(streamStart.x + .016 * Math.cos(angle), bucket.position.y + bucketPool.position.y + .008, streamStart.z),
      d = streamStart.clone().sub(hit);
    stream.position.copy(hit).lerp(streamStart, .5);
    stream.scale.set(.005 + rate * .233, d.length(), .005 + rate * .233);
    stream.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) sound.hush(1450, .24, .021 + rate * .18);
    if (Math.floor(t * 2) !== Math.floor((t - dt) * 2) && bucketFoam.length < 25) bucketBubble()
  }
  if (lastFlow > 0 && !rate) {
    dropTime = .02;
    dropAt.copy(streamStart)
  }
  lastFlow = rate;
  if (dropTime) {
    dropTime += dt;
    droplet.position.copy(dropAt);
    droplet.position.y -= dropTime * dropTime * 2.9;
    droplet.visible = droplet.position.y > bucket.position.y + bucketPool.position.y;
    if (!droplet.visible) dropTime = 0
  } else droplet.visible = false
}
function feed(dt, t) {
  let holding = mode === 'hand', fromPail = !holding && hook >= 0 && active?.id !== 'pail', source = holding ? 'bottle': fromPail ? 'pail': '';
  let tip = holding ? world(teat, .235, 0, 0): fromPail ? world(bucketTeat, .203, 0, 0): null;
  let turn = holding ? .37: fromPail ? (.28 + .24 * hook): .39, breath = Math.sin(t * 2.36);
  let target = V(.34, 1.56 + .011 * breath, .42);
  let wet = holding ? neckIsWet: fromPail && pailMilk > .0001 && bucketPool.position.y >= bucketOutletHeight;
  let noseContact = false;
  if (tip) {
    let isNear = fromPail || ((tip.x > -.61 && tip.x < .67) && (tip.y > 1.32 && tip.y < 2.21));
    let low = holding ? 1.26: .59;
    let noseGoal = tip.clone().add(V(.109, -.139, -.047));
    noseGoal.x = clamp(noseGoal.x, -.47, .84);
    noseGoal.y = clamp(noseGoal.y, low, 1.97);
    let mouthGoal = tip.clone().add(V(.056, -.030, -.022));
    mouthGoal.y = clamp(mouthGoal.y, fromPail ? .62: 1.39, 2.06);
    mouthGoal.x = clamp(mouthGoal.x, -.54, .74);
    if (!latched) {
      target.copy(noseGoal);
      if (!isNear) {
        target.x = clamp(target.x, -.13, .55);
        target.y = clamp(target.y, 1.32, 1.97)
      }
      let distance = head.position.distanceTo(noseGoal);
      if (isNear && distance < .13) {
        noseContact = true;
        if (!sniffed) {
          sniffed = true;
          sniffSpot.copy(tip);
          sound.hush(880, .26, .051)
        }
        sniffTime += dt
      }
      let waited = t - movedAt > .27 || fromPail;
      let lipHeight = fromPail || tip.y > 1.439;
      let canMeet = isNear && lipHeight && sniffed && sniffTime > (fromPail ? .42: lastMouth && tip.distanceTo(lastMouth) < .13 ? .20: .61) && (waited || tip.x < sniffSpot.x - .035);
      if (canMeet && (holding || wet)) {
        target.copy(mouthGoal);
        if (head.position.distanceTo(mouthGoal) < .068) {
          latched = source;
          seal.copy(tip);
          sipTime = 0;
          swallowed = false;
          if (holding && active?.tiltArmed && !active.tilt) {
            active.tilt = true;
            active.sx = active.px;
            active.sy = active.py;
            active.startBottle.copy(bottle.position);
            active.startAngle = angle
          }
        }
      }
    } else if (latched !== source) {
      loseLatch();
      sniffed = false;
      sniffTime = 0
    }
    if (latched === source) {
      target.copy(mouthGoal);
      noseContact = true;
      if (!isNear || head.position.distanceTo(mouthGoal) > .20) {
        loseLatch();
        sniffed = false;
        sniffTime = 0
      } else if (wet) {
        sipTime += dt;
        let span = fromPail ? 1.83: 2.19;
        lick = sipTime < 1.05 ? Math.sin(Math.PI * clamp(sipTime / 1.05, 0, 1)) ** 1.4: 0;
        if (sipTime >= .57 && !swallowed) {
          let amount = Math.min(holding ? milk: pailMilk, holding ? .0061: .0076);
          if (holding) {
            milk -= amount;
            lastMouth = tip.clone();
            nursed++;
            bubbleDue = t + .25
          } else {
            pailMilk -= amount;
            bucketBubble()
          }
          if (feedingOrder.at(-1) !== source) {
            feedingOrder.push(source);
            feedingOrder = feedingOrder.slice(-32)
          }
          swallowed = true;
          sound.gulp();
          save()
        }
        if (sipTime >= span) {
          sipTime = 0;
          swallowed = false
        }
      } else {
        lick = follow(lick, 0, 8, dt);
        sipTime = 0;
        swallowed = false;
        if (fromPail) {
          loseLatch();
          relax = 1;
          sniffTime = 0
        }
      }
    }
  } else {
    if (latched) loseLatch();
    sniffed = false;
    sniffTime = 0;
    searchTime += dt;
    relax = follow(relax, 1, 1, dt);
    if (lastMouth) {
      target.copy(lastMouth).add(V(.09, .024 + .009 * breath, -.027));
      target.x += .025 * Math.sin(t * .83);
      target.y += .018 * Math.sin(t * 1.16)
    } else if (seeking && releaseFrom) {
      let k = ease(searchTime / 3.2);
      target.lerp(releaseFrom, 1 - k);
      target.y += .028 * Math.sin(searchTime * 2.3)
    }
  }
  if (source) relax = follow(relax, wet ? 0: .55, 2, dt);
  if (holding) handTime += dt;
  if (bubbleDue >= 0 && t >= bubbleDue) {
    birthBubble(-.43 - rnd() * .12, .018 + rnd() * .006);
    bubbleDue = -1
  }
  if (holding && !latched) target.z += .014 * Math.sin(t * 2.3);
  poseCalf(dt, t, target, turn, lick, noseContact, relax);
  teat.scale.y = 1 - .16 * (latched === 'bottle' ? lick: 0);
  teat.rotation.z = follow(teat.rotation.z, mode === 'return' && bottle.position.distanceTo(head.position) < .26 ? .24: 0,
    10, dt);
  bucketTeat.scale.y = 1 - (latched === 'pail' ? .14 * lick: 0);
  bucketTeat.rotation.z = .10 + (latched === 'pail' ? lick * .042: 0);
}
const throatTuft = egg(head, .61, .204, .045, .177, .121, .167, chinFur);
throatTuft.rotation.z = .26;
batchSolids(stand);
batchSolids(saddle, [grip]);
batchSolids(bottle, [bottleWall, teat, lid, saddle, liquidBody.obj, surface.obj, ...films.map(f => f.obj), ...bubbles.map(b => b.obj)]);
batchSolids(torso);
batchSolids(rail);
batchSolids(shelf);
updateMilk(milk, angle, .01, true);
updateBucketMilk(pailMilk, 0, 0, 0);
updateArm();
let previous = performance.now(), fluidClock = 0;
function frame(now) {
  let dt = Math.min(.045, Math.max(.001, (now - previous) / 1000));
  previous = now;
  currentTime += dt;
  let t = currentTime;
  motion(dt, t);
  fluidClock += dt;
  if (fluidClock >= 1 / 30) {
    updateMilk(milk, clamp(angle + slosh, -1.55, 1.55), fluidClock);
    fluidClock = 0
  }
  feed(dt, t);
  flow(dt, t);
  animateBubbles(dt);
  updateBucketMilk(pailMilk, t, dt, latched === 'pail' ? lick: (stream.visible ? .45: 0));
  throatTuft.scale.y = .121 + .016 * (swallowed ? Math.max(0, 1 - Math.abs(sipTime - .71) * 7): 0);
  hints(t);
  sound.tick(t);
  if (t - lastSave > 3 && started) save();
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = Math.floor(t * 18) !== Math.floor((t - dt) * 18) || t < .10;
  renderer.render(scene, camera);
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame);
