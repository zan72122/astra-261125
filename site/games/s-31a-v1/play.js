'use strict';
const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(), normal = v3(), clock = new T.Timer();
let age = 0, activity = 0, gesture = null, toolMode = 'home', place = 'floor', first = true, stroke = null, currentLocal = null, desiredLocal = null;
let returnTime = 0, returnPos = v3(), returnRot = new T.Quaternion(), pickup = 0, pickupFrom = v3(), pickupRot = new T.Quaternion();
let releaseAt = -20, visits = 0, strokes = 0, dogMode = 'wait', dogTime = 0, lickPlan = null, lickQuota = 0, nextVisit = 999, worked = false;
let lift = 0, liftGoal = 0, cupIndex = 0, cupDown = [0, 0, 0, 0], view = 0, dock = 0, dockGoal = 0, slide = false, wallAge = 0;
let selectedAt = 0, firstTouch = -1, breath = 0, restBlend = 0, wake = 0, lastScratch = -1, peel = 0;
const eyePoint = v3(), dogTarget = v3(), headTarget = v3(), carryHover = v3(), sceneUp = v3(0, 1, 0);
let lickVolume = 0, rememberNext = false, lastStroke = null, revisitThenLatest = false, crumb = 0;
const memory = Array.from( {length : 96}, () => ( {served : 0, ate : 0, taste : -100, seen : -100, lickedAt : -100, x : 0, z : 0}));
function bin(x, z) {
  return clamp(Math.floor((z / 1.71 + .5) * 8), 0, 7) * 12 + clamp(Math.floor((x / 2.68 + .5) * 12), 0, 11)
}
function record(x, z, amount) {
  if (amount < .000003)return;
  const m = memory[bin(x, z)];
  m.served += amount;
  m.x = x;
  m.z = z;
  m.taste = age
}
function matPoint(x, z, height = 0) {
  return mat.localToWorld(v3(x, height + relief(x, z) + matField.at(x, z), z))
}
function localHit(obj, localY = 0) {
  obj.updateWorldMatrix(true, false);
  normal.set(0, 1, 0).transformDirection(obj.matrixWorld);
  plane.setFromNormalAndCoplanarPoint(normal, obj.localToWorld(v3(0, localY, 0)));
  const p = ray.ray.intersectPlane(plane, v3());
  return p ? obj.worldToLocal(p) : null
}
function setRay(e) {
  const b = canvas.getBoundingClientRect();
  ndc.set((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2);
  ray.setFromCamera(ndc, camera)
}
function screen(p) {
  p = p.clone().project(camera);
  return {x : (p.x * .5 + .5) * innerWidth, y : (.5 - p.y * .5) * innerHeight}
}
function nearby(e, p, r) {
  let s = screen(p);
  return Math.hypot(e.clientX - s.x, e.clientY - s.y) < r
}
function withinMat(p, pad = 0) {
  return p && sdRound(p.x, p.z, 1.44 + pad, .95 + pad, .16) < 0
}
function playingSurface() {
  return place === 'floor' || place === 'window'
}
const restQuat = new T.Quaternion().setFromEuler(new T.Euler(-.065, toolHomeAngle, 0, 'YXZ'));
function sound(kind, level = 1, point = tool.position) {
  if (!audio || audio.state === 'closed')return;
  const t = audio.currentTime, g = audio.createGain(), pan = audio.createStereoPanner ? audio.createStereoPanner() : audio.createGain();
  if (pan.pan)pan.pan.value = clamp(point.clone().project(camera).x, -.8, .8);
  g.connect(pan);
  pan.connect(audio.destination);
  if (kind === 'tap' || kind === 'cup') {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(kind === 'tap' ? 972 : 330, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'tap' ? 650 : 116, t + .066);
    g.gain.setValueAtTime(level * (kind === 'tap' ? .045 : .09), t);
    g.gain.exponentialRampToValueAtTime(.0001, t + .14);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + .16);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
      pan.disconnect()
    };
    return
  }
  const src = audio.createBufferSource(), filter = audio.createBiquadFilter();
  src.buffer = noiseBuffer;
  src.loop = true;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(kind === 'lick' ? 1140 : 1630, t);
  filter.frequency.exponentialRampToValueAtTime(kind === 'lick' ? 435 : 950, t + .105);
  filter.Q.value = kind === 'lick' ? 1.8 : .8;
  src.connect(filter);
  filter.connect(g);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0003, level * .071), t + .018);
  g.gain.exponentialRampToValueAtTime(.0001, t + .134);
  src.start(t);
  src.stop(t + .145);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    g.disconnect();
    pan.disconnect()
  }
}
let audio = null, noiseBuffer, scooping = null;
function startSound() {
  if (!audio) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio)return;
    audio = new Audio();
    noiseBuffer = audio.createBuffer(1, audio.sampleRate * .24, audio.sampleRate);
    const a = noiseBuffer.getChannelData(0);
    for (let i = 0; i < a.length; i++)a[i] = Math.random() * 2 - 1
  }
  if (audio.state === 'suspended')audio.resume(). catch (() => {})
}
function cancelVisit() {
  if (dogMode === 'lick' && lickPlan) {
    lickVolume += lickPlan.ate;
    crumb = clamp(crumb + lickPlan.ate * 240)
  }
  dogMode = 'wait';
  dogTime = 0;
  tongue.visible = false;
  wake = age;
  nextVisit = Infinity
}
function takeTool(scoop, p) {
  cancelVisit();
  toolMode = 'held';
  selectedAt = age;
  pickup = 0;
  pickupFrom.copy(tool.position);
  pickupRot.copy(tool.quaternion);
  scooping = scoop && bladeLoad < .00032 ? {x : clamp(p?.x || 0, -.35, .35), z : clamp(p?.z || 0, -.34, .34), step : 0} : null;
  carryHover.copy(homeTool()).add(v3(-.09, .32, -.10));
  currentLocal = desiredLocal = null;
  first = false;
  sound('tap', .22, tool.position)
}
function scoopTo(step) {
  if (!scooping)return;
  while (scooping.step < step) {
    const z = clamp(scooping.z - .10 + scooping.step * .028, -.39, .39);
    bladeLoad += dishField.scrape(scooping.x, z, 0, 1, .148, .087, .7, .004);
    scooping.step++
  }
  bladePortion()
}
function startStroke(p) {
  if (scooping) {
    scoopTo(8);
    scooping = null
  }

  currentLocal = v3(clamp(p.x, -1.27, 1.27), 0, clamp(p.z, -.79, .79));
  desiredLocal = currentLocal.clone();
  stroke = {speed : 0, ux : -Math.sin(toolHomeAngle), uz : -Math.cos(toolHomeAngle), length : 0, wait : 0};
  toolMode = 'press';
  strokes++;
  worked = true;
  pickup = 1;
  lastStroke = currentLocal.clone();
  if (bladeLoad > .00001) {
    const portion = bladeLoad * .44;
    bladeLoad -= matField.deposit(currentLocal.x, currentLocal.z, .174, portion, .92);
    record(currentLocal.x, currentLocal.z, portion);
    bladePortion()
  }
}
function advanceStroke(dt) {
  if (!stroke || !desiredLocal)return;
  const dx = desiredLocal.x - currentLocal.x, dz = desiredLocal.z - currentLocal.z, dist = Math.hypot(dx, dz);
  const previousSpeed = stroke.speed;
  stroke.speed = mix(stroke.speed, Math.min(4, dist / Math.max(dt, .006)), 1 - Math.exp(-dt * 18 - dist / .12));
  if (dist < .0005) {
    stroke.wait += dt;
    return
  }
  const count = Math.ceil(dist / .022), ux = dx / dist, uz = dz / dist, step = dist / count;
  for (let k = 0; k < count; k++) {
    currentLocal.x += ux * step;
    currentLocal.z += uz * step;
    const before = bladeLoad, x = currentLocal.x, z = currentLocal.z;
    bladeLoad = matField.smear(x, z, ux, uz, step, mix(previousSpeed, stroke.speed, (k + 1) / count), bladeLoad, (px, pz) => (px > .04 && ribs(px, pz) < .008 ? .014 : 0), relief, place === 'window');
    record(x, z, Math.max(0, before - bladeLoad))
  }
  stroke.length += dist;
  stroke.ux = ux;
  stroke.uz = uz;
  lastStroke.copy(currentLocal);
  bladePortion();
  if (age - lastScratch > .115) {
    sound('scrape', clamp(dist * 8, .12, .48));
    lastScratch = age
  }
}
function releaseTool() {
  scooping = null;
  if (toolMode === 'press') {
    advanceStroke(.016);
    const x = clamp(currentLocal.x + stroke.ux * .157, -1.29, 1.29), z = clamp(currentLocal.z + stroke.uz * .157, -.80, .80);
    const amount = bladeLoad, rad = clamp(.058 + Math.cbrt(amount) * .55, .073, .182);
    bladeLoad -= matField.deposit(x, z, rad, amount * .88, .94);
    bladeLoad -= matField.deposit(x + stroke.ux * .032, z + stroke.uz * .032, rad * .53, bladeLoad, .82);
    record(x, z, amount);
    lastStroke.set(x, 0, z);
    bladePortion();
  }
  leadingPaste.visible = false;
  foodOnBlade.visible = true;
  toolMode = 'return';
  returnTime = 0;
  returnPos.copy(tool.position);
  returnRot.copy(tool.quaternion);
  stroke = null;
  desiredLocal = currentLocal = null;
  releaseAt = age;
  rememberNext = place === 'window';
  revisitThenLatest = rememberNext
}
function toolMotion(dt) {
  const restHeight = homeTool().y - dish.position.y;
  restQuat.setFromEuler(new T.Euler(Math.asin(clamp((restHeight - .205) / .715, -.38, .38)), toolHomeAngle, 0, 'YXZ'));
  if (scooping && toolMode === 'held') {
    const elapsed = age - selectedAt, u = smooth((elapsed - .13) / .24);
    scoopTo(Math.floor(u * 8));
    const z = clamp(scooping.z - .10 + u * .202, -.39, .39);
    const tip = dish.localToWorld(v3(scooping.x, dishBase(scooping.x, z) + .018, z));
    tool.position.lerpVectors(pickupFrom, tip, smooth(elapsed / .13));
    tool.quaternion.slerp(restQuat, 1 - Math.exp(-dt * 15));
    if (u < 1)return;
    scooping = null;
    pickupFrom.copy(tool.position);
    pickupRot.copy(tool.quaternion);
    pickup = 0
  }
  if (toolMode === 'home') {
    tool.position.copy(homeTool());
    tool.quaternion.copy(restQuat);
    return
  }
  if (toolMode === 'return') {
    returnTime += dt;
    let t = clamp(returnTime / .79), s = smooth(t);
    tool.position.lerpVectors(returnPos, homeTool(), s);
    tool.position.y += Math.sin(t * PI) * .205;
    tool.quaternion.slerpQuaternions(returnRot, restQuat, s);
    bladeGroup.rotation.x *= Math.exp(-dt * 8);
    if (t === 1) {
      toolMode = 'home';
      sound('tap', .85);
      lickQuota = strokes <= 1 ? 1 : 2;
      nextVisit = age + (visits === 0 ? 4.4 : 1.45)
    }
    return
  }
  let angle = toolHomeAngle, tilt = .56, roll = -.12;
  if (toolMode === 'press') {
    advanceStroke(dt);
    let p = currentLocal, height = relief(p.x, p.z) + Math.min(.061, matField.at(p.x, p.z) * .55) + .018;
    const mx = clamp(p.x + stroke.ux * .157, -1.29, 1.29), mz = clamp(p.z + stroke.uz * .157, -.80, .80), massRadius = Math.cbrt(Math.max(0, bladeLoad) / 2.12);
    leadingPaste.visible = bladeLoad > .000015;
    leadingPaste.position.set(mx, relief(mx, mz) + matField.at(mx, mz) + .004, mz);
    leadingPaste.scale.set(massRadius * 1.28, massRadius * .68, massRadius * 1.12);
    foodOnBlade.visible = false;
    carryHover.copy(mat.localToWorld(v3(p.x, height, p.z)));
    tilt = .09;
    roll = -.075;
    bladeGroup.rotation.x = mix(bladeGroup.rotation.x, clamp(stroke.speed * .08, .018, .18), .25)
  }
  const q = new T.Quaternion().setFromEuler(new T.Euler(-tilt, angle, roll, 'YXZ'));
  if (toolMode === 'press')q.premultiply(mat.quaternion);
  if (toolMode === 'held' && pickup < 1) {
    pickup = clamp(pickup + dt * 3.0);
    const t = smooth(pickup);
    // Swing the handle up around the actual ceramic rim before lifting the blade.
    const pivot = dish.localToWorld(v3(.39, .171, .28)), arm = pickupFrom.clone().sub(pivot);
    const swing = new T.Quaternion().setFromAxisAngle(v3(Math.cos(angle), 0, -Math.sin(angle)), -.36 * Math.sin(t * PI));
    tool.position.copy(arm.applyQuaternion(swing).add(pivot)).lerp(carryHover, t);
    tool.quaternion.slerpQuaternions(pickupRot, q, t);
    tool.quaternion.premultiply(swing)
  } else {
    tool.position.lerp(carryHover, 1 - Math.exp(-dt * 33));
    tool.quaternion.slerp(q, 1 - Math.exp(-dt * 23))
  }
  foodOnBlade.rotation.x = toolMode === 'held' ? -.22 : 0
}
function rimAvailable() {
  return worked && visits > 0 && playingSurface() && toolMode === 'home'
}
function changeLift(f) {
  lift = clamp(f);
  foodSkin.backlight.value = lift;
  const travel = clamp((lift - .11) / .89), rotation = smooth(travel);
  mat.position.lerpVectors(matHome, matWindow, rotation);
  mat.position.y += Math.sin(PI * travel) * .46;
  mat.rotation.x = rotation * PI / 2;
  bendMat(.25 * smooth(lift / .15) * (1 - smooth((lift - .16) / .64)));
  matShadow.material.opacity = .68 * (1 - lift);
}
function moveDish(f) {
  dock = clamp(f);
  dish.position.lerpVectors(dishHome, dishDock, smooth(dock));
  dish.position.x += Math.sin(PI * dock) * .78;
  dish.position.y = mix(dishHome.y, dishDock.y, smooth((dock - .73) / .27));
  dishShadow.position.x = dish.position.x;
  dishShadow.position.z = dish.position.z;
  dishShadow.material.opacity = .77 * (1 - dock)
}
function beginLift() {
  cancelVisit();
  place = 'lift';
  liftGoal = .085;
  gesture.kind = 'lift';
  gesture.baseLift = lift
}
function startPeel(i) {
  cancelVisit();
  place = 'peeling';
  gesture.kind = 'peel';
  gesture.cup = i < 0 ? 2 : i;
  peel = .12
}
function finishPeel() {
  place = 'down';
  liftGoal = 0;
  cupIndex = 0;
  cupDown.fill(0);
  peel = 0;
  sound('cup', .7, mat.position)
}
function findCup(e) {
  let best = Infinity, index = -1;
  for (let i = 0; i < cups.length; i++) {
    let p = cups[i].getWorldPosition(v3()), s = screen(p), d = Math.hypot(s.x - e.clientX, s.y - e.clientY);
    if (d < best) {
      best = d;
      index = i
    }
  }
  return best < Math.max(24, Math.min(innerWidth, innerHeight) * .055) ? index : -1
}
function plateHit(p) {
  return p && Math.hypot(p.x, p.z) < .633
}
function toolHit(e) {
  if (ray.intersectObjects([handle, blade, dollop], false).length)return true;
  const a = screen(tool.localToWorld(v3(0, .035, .12))), b = screen(tool.localToWorld(v3(0, .035, .99))), dx = b.x - a.x, dy = b.y - a.y, t = clamp(((e.clientX - a.x) * dx + (e.clientY - a.y) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(e.clientX - a.x - t * dx, e.clientY - a.y - t * dy) < 16
}
canvas.addEventListener('pointerdown', e => {
  if (gesture)return;
  setRay(e);
  startSound();
  if (firstTouch < 0)firstTouch = age;
  let p = localHit(mat), d = localHit(dish, .147);
  const atGrip = nearby(e, grip.getWorldPosition(v3()), Math.max(24, innerWidth * .027));
  const g = {id : e.pointerId, kind : '', x : e.clientX, y : e.clientY, moved : false};
  gesture = g;
  if (place === 'pressCups') {
    let i = findCup(e);
    if (plateHit(d) && Math.hypot(d.x, d.z) > .454 && dock < .99) {
      g.kind = 'dish';
      g.baseDock = dock
    }
    else if (atGrip && cupIndex === 0) {
      g.kind = 'sillGrip'
    } else if (i >= 0 && !cupDown[i]) {
      g.kind = 'cup';
      g.cup = i;
      cupDown[i] = .01
    }
  } else if (playingSurface()) {
    if (toolMode === 'held' && withinMat(p, .03)) {
      startStroke(p);
      g.kind = 'paint';
      g.offset = v3()
    }
    else if ((toolMode === 'home' || toolMode === 'return') && toolHit(e)) {
      takeTool(false);
      g.kind = 'pickup';
      g.offset = p ? mat.worldToLocal(tool.getWorldPosition(v3())).sub(p) : v3();
      g.offset.y = 0
    } else if (place === 'window' && rimAvailable() && (atGrip || findCup(e) >= 0)) {
      startPeel(findCup(e))
    }
    else if (place === 'floor' && rimAvailable() && atGrip) {
      beginLift()
    }
    else if (plateHit(d) && !first && toolMode !== 'press') {
      if (Math.hypot(d.x, d.z) > .454 && place === 'window' && dock < .99) {
        cancelVisit();
        g.kind = 'dish';
        g.baseDock = dock
      }
      else if (toolMode === 'home' || toolMode === 'held') {
        takeTool(true, d);
        g.kind = 'pickup';
        g.offset = v3()
      }
    } else if (toolMode === 'held' && toolHit(e)) {
      g.kind = 'pickup';
      g.offset = v3()
    }
  }
  if (!g.kind) {
    gesture = null;
    return
  }
  activity = age;
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault()
});
canvas.addEventListener('pointermove', e => {
  if (!gesture || gesture.id !== e.pointerId)return;
  const g = gesture;
  setRay(e);
  activity = age;
  const dy = g.y - e.clientY, move = Math.hypot(e.clientX - g.x, dy);
  if (move > 5)g.moved = true;
  if (g.kind === 'pickup' && g.moved) {
    let p = localHit(mat, .035);
    if (p) {
      let pt = p.clone().add(g.offset);
      if (withinMat(pt, -.012)) {
        startStroke(pt);
        g.kind = 'paint'
      }
      else {
        carryHover.copy(mat.localToWorld(pt.setY(.24)));
        carryHover.y = Math.max(carryHover.y, homeTool().y + .08)
      }
    }
  } else if (g.kind === 'paint') {
    let p = localHit(mat, .029);
    if (p) {
      p.add(g.offset);
      desiredLocal.set(clamp(p.x, -1.275, 1.275), 0, clamp(p.z, -.797, .797))
    }
  }
  else if (g.kind === 'lift') {
    const start = screen(matHome), end = screen(matWindow);
    const travel = Math.max(80, start.y - end.y);
    liftGoal = clamp(.085 + Math.max(0, dy) / travel);
    const glassPlane = new T.Plane(v3(0, 0, 1), -glassZ), hit = ray.ray.intersectPlane(glassPlane, v3());
    if (move > 42 && hit && Math.abs(hit.x) < 2.1 && hit.y > .52 && hit.y < 2.95)liftGoal = 1
  } else if (g.kind === 'sillGrip' && move > 12) {
    place = 'lift';
    g.kind = 'lift';
    g.y = e.clientY + Math.max(80, screen(matHome).y - screen(matWindow).y);
    liftGoal = .95
  } else if (g.kind === 'peel') {
    peel = clamp(.12 + move / Math.max(22, innerWidth * .040));
    if (peel === 1 && place === 'peeling')finishPeel()
  } else if (g.kind === 'dish') {
    const start = screen(dishHome), end = screen(dishDock), dx = end.x - start.x, dyy = end.y - start.y;
    dockGoal = clamp(g.baseDock + ((e.clientX - g.x) * dx + (e.clientY - g.y) * dyy) / Math.max(900, dx * dx + dyy * dyy));
    moveDish(dockGoal)
  }
});
function pointerEnd(e, cancelled = false) {
  if (!gesture || gesture.id !== e.pointerId)return;
  const g = gesture;
  activity = age;
  if (g.kind === 'paint' || g.kind === 'pickup' && (g.moved || cancelled))releaseTool();
  if (g.kind === 'lift') {
    if (!cancelled && liftGoal > .86) {
      liftGoal = 1;
      place = 'mounting'
    } else {
      liftGoal = 0;
      place = 'down'
    }
  }
  if (g.kind === 'peel' && place === 'peeling') {
    if (!cancelled && peel > .38)finishPeel(); else {
      place = 'window';
      peel = 0
    }
  }
  if (g.kind === 'cup') {
    if (cancelled) {
      cupDown[g.cup] = 0
    } else {
      cupDown[g.cup] = 1;
      cupIndex++;
      sound('cup', .8, cups[g.cup].getWorldPosition(v3()));
      if (cupIndex === 4) {
        place = 'window';
        wallAge = age;
        nextVisit = age + 4.5;
        lickQuota = 1;
        rememberNext = true;
        revisitThenLatest = true
      }
    }
  }
  if (g.kind === 'dish') {
    slide = true;
    dockGoal = dock > .09 ? 1 : 0;
    nextVisit = age + 2.8;
    lickQuota = 1
  }
  gesture = null
}
canvas.addEventListener('pointerup', e => pointerEnd(e));
canvas.addEventListener('pointercancel', e => pointerEnd(e, true));
canvas.addEventListener('lostpointercapture', e => {
  if (gesture?.id === e.pointerId)pointerEnd(e, true)
});
// The dog's remembered locations are in mat coordinates, including after turning the mat upright.
function pickVisit() {
  if (!worked || !playingSurface() || toolMode !== 'home')return false;
  let candidate = null, fromMemory = false;
  if (rememberNext) {
    let best = -Infinity;
    for (const m of memory) {
      if (!m.served || age - m.seen < 5.8)continue;
      const score = Math.log1p(m.served * 3800) + Math.log1p(m.ate * 2300) * .48 + .18 * Math.exp(-Math.max(0, age - m.lickedAt) / 120) + Math.min(.55, (age - m.seen) * .0035) - Math.min(.55, (age - m.taste) * .0009);
      if (score > best) {
        candidate = v3(m.x, 0, m.z);
        best = score;
        fromMemory = true
      }
    }
  }
  if (!candidate && lastStroke)candidate = lastStroke.clone();
  if (!candidate)return false;
  const cx = candidate.x, cz = candidate.z;
  let best = -1, thickness = 0;
  const reach = fromMemory ? .175 : .25;
  matField.each(cx, cz, reach, reach, (i, x, z) => {
    const dist = Math.hypot(x, z), h = matField.h[i], s = h * (1 - clamp(dist / reach) * .82);
    if (dist < reach && s > best && h > .0018) {
      best = s;
      thickness = h;
      candidate.set(cx + x, 0, cz + z)
    }
  });
  const wall = place === 'window', channel = candidate.x > .045 && ribs(candidate.x, candidate.z) < .022 && thickness < .082;
  const side = wall ? -1 : 1, dx = channel ? .025 : clamp(candidate.x * .33, -.38, .38), dz = side * Math.sqrt(1 - dx * dx);
  const len = channel ? .233 : .295;
  // Begin at the exposed edge of this patch. Repeated licks advance into
  // the furrow as the nearer food is taken away.
  const lip = candidate.clone();
  for (let j = 0; j < 19; j++) {
    const x = lip.x - dx * .013, z = lip.z - dz * .013;
    if (!matField.allowed(x, z) || matField.at(x, z) < Math.max(.0028, thickness * .11))break;
    lip.set(x, 0, z)
  }
  const start = v3(clamp(lip.x - dx * .016, -1.29, 1.29), 0, clamp(lip.z - dz * .016, -.808, .808));
  const end = v3(clamp(start.x + dx * len, -1.29, 1.29), 0, clamp(start.z + dz * len, -.808, .808));
  const memoryBin = bin(cx, cz);
  lickPlan = {candidate, memoryBin, start, end, dx, dz, channel, thickness, wall, sniff : thickness < .0025, ate : 0, elapsed : 0, lastU : null, sounded : false};
  dogMode = 'approach';
  dogTime = 0;
  nextVisit = Infinity;
  return true
}
const tongueGeo = new T.BufferGeometry(), nAlong = 19, nAcross = 16, tonguePos = new Float32Array((nAlong + 1) * nAcross * 3), tongueIndex = [];
for (let j = 0; j < nAlong; j++)for (let i = 0; i < nAcross; i++) {
  let a = j * nAcross + i, b = j * nAcross + (i + 1) % nAcross;
  tongueIndex.push(a, b, a + nAcross, b, b + nAcross, a + nAcross)
}
tongueGeo.setAttribute('position', new T.BufferAttribute(tonguePos, 3).setUsage(T.DynamicDrawUsage));
tongueGeo.setIndex(tongueIndex);
tongueGeo.computeVertexNormals();
const tongue = mesh(scene, tongueGeo, material(0xd38c88, .34, {side : T.DoubleSide}));
tongue.visible = false;
tongue.frustumCulled = false;
function tongueShape(mouth, tip, n, width, amount, across, patch = null) {
  const positions = tongueGeo.attributes.position, mid = mouth.clone().lerp(tip, .48).addScaledVector(n, .046);
  for (let j = 0; j <= nAlong; j++) {
    const t = j / nAlong, s = 1 - t, center = mouth.clone().multiplyScalar(s * s).addScaledVector(mid, 2 * s * t).addScaledVector(tip, t * t);
    const round = Math.sqrt(Math.min(1, Math.max(.002, (1 - t) * 6)));
    let w = width * (.45 + .56 * Math.sin(t * PI * .86)) * round;
    if (patch) {
      if (t < .57) {
        const u = t / .57;
        center.lerpVectors(mouth, patch.back, u).addScaledVector(n, .041 * Math.sin(u * PI));
        w = width * (.55 - .24 * u)
      }
      else {
        const u = (t - .57) / .43;
        center.lerpVectors(patch.back, tip, u);
        w = width * Math.sqrt(Math.max(.001, 1 - (2 * u - 1) ** 2))
      }
    }
    for (let i = 0; i < nAcross; i++) {
      const a = i / nAcross * TAU, side = Math.cos(a), up = Math.sin(a);
      const q = center.clone().addScaledVector(across, side * w).addScaledVector(n, up * .023 * round * (.7 + .3 * amount) - .004 * (1 - side * side));
      positions.setXYZ(j * nAcross + i, q.x, q.y, q.z)
    }
  }
  positions.needsUpdate = true;
  tongueGeo.computeVertexNormals();
  tongue.visible = true
}
function dab(plan, u, width, depth, force) {
  const x = mix(plan.start.x, plan.end.x, u), z = mix(plan.start.z, plan.end.z, u);
  const portion = matField.scrape(x, z, plan.dx, plan.dz, width, depth, force, .00035, i => {
    const px = matField.x(i), pz = matField.z(i);
    // A broad tongue bridges the ribs. Its tapered tip reaches a little deeper.
    return px > .03 && ribs(px, pz) < .026 ? .005 + clamp((width - .043) * .58, 0, .029) : 0
  });
  plan.ate += portion;
  const eaten = memory[bin(x, z)];
  eaten.ate += portion;
  if (portion > 0)eaten.lickedAt = age
}
function lick(dt) {
  const p = lickPlan, t = clamp(dogTime / .89), m = head.localToWorld(v3(0, -.184, .522)), normal = v3(0, 1, 0).transformDirection(mat.matrixWorld);
  const u = t < .63 ? smooth(t / .63) : 1 - smooth((t - .63) / .37) * .84, flex = Math.sin(Math.PI * t);
  const x = mix(p.start.x, p.end.x, u) + (p.channel ? .016 * Math.sin(u * PI) : 0), z = mix(p.start.z, p.end.z, u), width = (p.channel ? .051 : .122) * (.32 + .68 * flex);
  const contact = t > .105 && t < .90, reach = smooth(t / .125) * smooth((1 - t) / .15), tip = m.clone().lerp(matPoint(x, z, .007), reach);
  const span = .017 + .043 * flex;
  let patch = null;
  if (contact) {
    const back = matPoint(x - p.dx * span, z - p.dz * span, .015), front = matPoint(x + p.dx * span, z + p.dz * span, .013);
    patch = {back};
    tip.copy(front);
    const prev = p.lastU ?? u, count = Math.max(1, Math.ceil(Math.abs(u - prev) * .3 / .014));
    for (let j = 1; j <= count; j++)dab(p, mix(prev, u, j / count), width, span, 1 - Math.exp(-dt * 13 / count));
    p.lastU = u
  }
  tongueShape(m, tip, normal, width, flex, v3(p.dz, 0, -p.dx).transformDirection(mat.matrixWorld), patch);
  if (t > .82 && !p.sounded && p.ate > .000012) {
    sound('lick', clamp(.28 + p.ate * 560, .28, .96), tip);
    p.sounded = true
  }
  if (t >= 1) {
    tongue.visible = false;
    dogMode = 'liftHead';
    dogTime = 0;
    lickVolume += p.ate;
    crumb = clamp(crumb + p.ate * 240)
  }
}
function dogAnimation(dt) {
  dogTime += dt;
  breath = Math.sin(age * 2.17);
  const wall = place === 'window', near = dogMode === 'approach' || dogMode === 'sniff' || dogMode === 'lick';
  if (toolMode === 'home' && !gesture && playingSurface() && age > nextVisit)pickVisit();
  let takeRest = wall && toolMode === 'home' && !near && dogMode === 'wait' && age - releaseAt > 3.1 && (age - firstTouch > 355 || wallAge > 0 && age - wallAge > 108 && strokes >= 9);
  const desiredRest = takeRest ? 1 : 0;
  restBlend = mix(restBlend, desiredRest, 1 - Math.exp(-dt * (desiredRest ? .72 : 3.5)));
  if (takeRest && restBlend < .045 && age - wake > 3) {
    dogMode = 'wipe';
    dogTime = 0;
    wake = age
  }
  const r = restBlend, sc = dog.scale.x;
  let yaw = .065 * Math.sin(age * .27), pitch = -.10, roll = .057 + .023 * Math.sin(age * .68);
  dogTarget.set(-.12, .044, -1.76);
  headTarget.set(.01, 1.71 + breath * .011, .37);
  if (lift > .025 || wall) {
    let b = smooth(lift);
    dogTarget.lerp(v3(-1.31, .044, -1.94), b);
    yaw = mix(yaw, 2.04, b);
    pitch = mix(pitch, -.065, b);
    headTarget.y = mix(headTarget.y, 1.43, b)
  }
  headTarget.y -= r * .82;
  headTarget.z += r * .20;
  pitch += r * .05;
  let approaching = near && lickPlan;
  if (approaching) {
    const p = lickPlan, reachPoint = matPoint(p.start.x, p.start.z, .014);
    yaw = p.wall ? (1.89 + .07 * p.candidate.x) : clamp(p.candidate.x * .64, -.83, .83);
    pitch = p.wall ? -.08 : 1.06;
    roll = p.channel ? .028 : -.025;
    headTarget.z = p.wall ? .58 : .78;
    // Work backwards from the first point of contact to the mouth and paws.
    const want = reachPoint.clone().add(p.wall ? v3(-.035, -.041, .195) : v3(-p.dx * .085, .098, -p.dz * .095));
    const m = v3(0, -.184, .522).applyEuler(new T.Euler(pitch, 0, roll, 'YXZ'));
    headTarget.y = clamp((want.y - .044) / sc - m.y, .55, 1.93);
    const offset = v3(headTarget.x + m.x, 0, headTarget.z + m.z).multiplyScalar(sc).applyAxisAngle(sceneUp, yaw);
    dogTarget.x = want.x - offset.x;
    dogTarget.z = want.z - offset.z;
    if (dogMode === 'sniff')headTarget.y += Math.sin(dogTime * 9) * .008;
  } else if (toolMode === 'held' || toolMode === 'press') {
    const target = tool.position.clone().sub(dog.position);
    yaw = wall ? Math.atan2(target.x, target.z) : clamp(Math.atan2(target.x, target.z), -.43, .43);
    pitch = wall ? .03 : .19;
    headTarget.z -= .064;
    headTarget.y += .048;
    roll = -.035
  }
  const focus = toolMode === 'held' || toolMode === 'press' ? tool.position : (near ? matPoint(lickPlan.candidate.x, lickPlan.candidate.z) : camera.position);
  eyePoint.copy(focus);
  if (toolMode === 'home' && !near && ((place === 'floor' && visits > 0 && age - releaseAt < 16) || !playingSurface()))eyePoint.copy(grip.getWorldPosition(v3()));
  const damping = 1 - Math.exp(-dt * (approaching ? 4.2 : 2.6));
  dog.position.lerp(dogTarget, damping);
  const yawErr = Math.atan2(Math.sin(yaw - dog.rotation.y), Math.cos(yaw - dog.rotation.y));
  dog.rotation.y += yawErr * damping;
  head.position.lerp(headTarget, 1 - Math.exp(-dt * 5.3));
  head.rotation.order = 'YXZ';
  head.rotation.x = mix(head.rotation.x, pitch, 1 - Math.exp(-dt * 5));
  head.rotation.z = mix(head.rotation.z, roll, 1 - Math.exp(-dt * 4.6));
  const bow = clamp((1.48 - head.position.y) / .96) * (1 - r);
  body.scale.set(1 + .007 * breath, 1 + .008 * breath - r * .34 - bow * .31, 1 + r * .14 + bow * .09);
  body.position.y = -r * .11;
  body.rotation.x = mix(body.rotation.x, approaching ? .29 : -r * .18, damping);
  mouthCrumb.visible = crumb > .035;
  mouthCrumb.scale.set(.027 * crumb, .014 * crumb, .011 * crumb);
  for (let i = 0; i < 2; i++) {
    const k = i === 0 ? -1 : 1, leg = legs[i], e = ears[i], stretch = smooth(clamp((r - .20 * i) * 1.32));
    leg.position.z = .34 + stretch * .36 + (approaching ? .055 * Math.sin(Math.min(1, dogTime) * TAU + i * 2) * Math.exp(-dogTime * 2) : 0);
    leg.scale.y = 1 - stretch * .40;
    leg.rotation.x = -stretch * .37;
    e.rotation.x = mix(e.rotation.x, -head.rotation.x * .64 + .032 * Math.sin(age * 2.17 - .48 - i * .19), 1 - Math.exp(-dt * 6));
    e.rotation.z = k * (.12 + .021 * Math.sin(age * 1.14 - .32) + .012 * breath);
  }
  tail.rotation.y = Math.sin(age * (toolMode === 'home' ? 2.5 : 6.9)) * (toolMode === 'home' ? .12 : .42) * (1 - r * .8);
  dog.updateMatrixWorld(true);
  const gaze = head.worldToLocal(eyePoint.clone()).normalize();
  for (let i = 0; i < 2; i++) {
    eyes[i].rotation.y = clamp(gaze.x * .29, -.21, .21);
    eyes[i].rotation.x = clamp(-gaze.y * .25, -.18, .18);
    const blink = Math.max(0, 1 - Math.abs(((age + .8) % 5.27) - .13) / .13);
    lids[i].scale.y = .012 + .054 * blink + .012 * r;
    lids[i].position.y = .096 - .075 * blink - .008 * r
  }
  dogShade.position.set(dog.position.x, .034, dog.position.z + .1);
  if (dogMode === 'approach' && dogTime > 1.30) {
    dogMode = 'sniff';
    memory[lickPlan.memoryBin].seen = age;
    dogTime = 0
  }
  if (dogMode === 'sniff' && dogTime > .63) {
    dogMode = lickPlan.sniff ? 'liftHead' : 'lick';
    dogTime = 0
  }
  if (dogMode === 'lick')lick(dt);
  if (dogMode === 'liftHead' && dogTime > 1.15) {
    dogMode = 'wait';
    dogTime = 0;
    visits++;
    lickQuota--;
    rememberNext = !revisitThenLatest;
    revisitThenLatest = false;
    nextVisit = lickQuota > 0 ? age + 1.55 : Infinity
  }
  if (dogMode === 'wipe') {
    const m = head.localToWorld(v3(0, -.17, .515)), t = clamp(dogTime / .64), a = Math.sin(PI * t), tip = head.localToWorld(v3(.186 * a, -.17 + .144 * a, .515 + .055 * a));
    if (t > .35)crumb = Math.max(0, crumb - dt * 3);
    tongueShape(m, tip, v3(0, 1, 0), .071 * a, a, v3(0, 0, 1));
    if (t >= 1) {
      tongue.visible = false;
      dogMode = 'wait'
    }
  }
}
const hintFinger = group(), skinHint = material(0xefceb0, .64, {transparent : true, opacity : .38, depthWrite : false});
const finger = lathe(hintFinger, skinHint, [[0, 0], [.036, .008], [.055, .034], [.059, .082], [.056, .143], [.064, .208], [.059, .274], [.047, .313], [.023, .331], [0, .336]], 30);
const nailHint = material(0xf3d7c7, .54, {transparent : true, opacity : .22, depthWrite : false});
oval(hintFinger, nailHint, 0, .074, .05, .037, .046, .010, smallBall);
hintFinger.rotation.set(.27, .16, -.61);
hintFinger.visible = false;
hintFinger.traverse(o => {
  o.castShadow = false
});
handle.material = handle.material.clone();
grip.children[0].material = rimRubber.clone();
const buttons = mat.children.filter(o => o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.scale.x - .052) < .0001);
for (const o of buttons)o.material = o.material.clone();
let hintMaterial = null;
function guide() {
  let target = null, finish = null, m = null;
  if (gesture || dogMode === 'lick' || dogMode === 'approach' || dogMode === 'sniff' || toolMode === 'return' || dogMode === 'wipe') {
    resetHint();
    return
  }
  if (place === 'pressCups') {
    let i = cupDown.findIndex(x => !x);
    if (i >= 0) {
      target = mat.localToWorld(v3(cups[i].position.x, .018, cups[i].position.z));
      m = buttons[i]?.material;
      finish = target.clone().add(v3(0, 0, -.046))
    }
  } else if (!playingSurface()) {
    resetHint();
    return
  }
  else if (toolMode === 'held') {
    const p = lastStroke || v3(-.33, 0, .14);
    target = matPoint(p.x, p.z, .016);
    finish = matPoint(clamp(p.x + .32, -1.25, 1.25), clamp(p.z - .09, -.77, .77), .014);
    m = rubber
  } else if (place === 'window' && dock < .98) {
    target = dish.localToWorld(v3(.44, .158, .30));
    finish = dishDock.clone().add(v3(.42, .16, .25));
    m = ceramic
  }
  else if (rimAvailable() && place === 'floor' && age - firstTouch > 55 && strokes >= 2) {
    target = grip.localToWorld(v3(0, .041, 0));
    finish = matWindow.clone().add(v3(-.76, -.944, .035));
    m = grip.children[0].material
  }
  else if (restBlend > .75 && age - activity > 16) {
    const c = cups[2];
    target = mat.localToWorld(v3(c.position.x - .20, -.08, c.position.z));
    finish = target.clone().add(v3(-.05, .01, .12));
    m = cupRubber
  }
  else if (!first && bladeLoad < .00032 && strokes % 3 === 1 && dishField.volume() > .001) {
    let best = 0, idx = 0;
    for (let i = 0; i < dishField.h.length; i++)if (dishField.h[i] > best) {
      best = dishField.h[i];
      idx = i
    }
    target = dish.localToWorld(v3(dishField.x(idx), .18 + best * .35, dishField.z(idx)));
    finish = target.clone().add(v3(.13, .04, .01));
    m = ceramic
  } else {
    target = tool.localToWorld(v3(0, .098, .65));
    finish = target.clone().add(v3(-.02, .17, -.12));
    m = handle.material
  }
  if (hintMaterial && m !== hintMaterial)hintMaterial.emissive.setHex(0);
  hintMaterial = m;
  if (m) {
    m.emissive.setHex(0xeec18a);
    m.emissiveIntensity = (.035 + .075 * (.5 + .5 * Math.sin(age * 3.1))) * clamp((age - activity) / 1.1)
  }
  const elapsed = age - activity - 4;
  if (!target || elapsed < 0) {
    hintFinger.visible = false;
    return
  }
  const t = (elapsed % 4.65) / 3;
  hintFinger.visible = t <= 1;
  if (t <= 1) {
    let fade = smooth(t / .18) * smooth((1 - t) / .13), u = smooth((t - .40) / .39);
    hintFinger.position.lerpVectors(target, finish, u);
    hintFinger.position.y += .015 + .18 * (1 - smooth(t / .34)) + .105 * smooth((t - .82) / .18);
    if (place === 'pressCups' || place === 'window' && toolMode === 'held')hintFinger.position.z += .068;
    skinHint.opacity = .39 * fade;
    nailHint.opacity = .27 * fade
  }
}
function resetHint() {
  hintFinger.visible = false;
  if (hintMaterial) {
    hintMaterial.emissive.setHex(0);
    hintMaterial = null
  }
}
let viewportW = 0, viewportH = 0;
const floorCamera = {eye : v3(), aim : v3()}, windowCamera = {eye : v3(), aim : v3()};
function fitCamera(viewpoint, target, direction, points, padding = .93) {
  const forward = direction.clone().normalize(), right = v3().crossVectors(sceneUp, forward).normalize(), up = v3().crossVectors(forward, right), tan = Math.tan(camera.fov * PI / 360);
  let distance = 3.8;
  for (const point of points) {
    const pos = point.clone().sub(target), along = pos.dot(forward);
    distance = Math.max(distance, along + Math.abs(pos.dot(right)) / (tan * camera.aspect * padding), along + Math.abs(pos.dot(up)) / (tan * .881))
  }
  viewpoint.aim.copy(target);
  viewpoint.eye.copy(target).addScaledVector(forward, distance)
}
function resize() {
  viewportW = canvas.clientWidth || innerWidth;
  viewportH = canvas.clientHeight || innerHeight;
  renderer.setSize(viewportW, viewportH, false);
  camera.aspect = viewportW / viewportH;
  const portrait = clamp((1.12 - camera.aspect) / .66);
  camera.fov = mix(35, 48, portrait);
  camera.updateProjectionMatrix();
  const points = [v3(-1.56, .13, 1.36), v3(1.39, .13, 1.42), v3(-1.53, .13, -.50), v3(.16, 2.59, -1.29), v3(-.91, 2.12, -1.49), v3(1.38, .22, 2.72), v3(.65, .12, 2.73)];
  fitCamera(floorCamera, v3(.01, .78, .04), v3(mix(.183, .051, portrait), mix(.62, .78, portrait), .86), points, .936)
}
function moveCamera(dt) {
  if (canvas.clientWidth !== viewportW || canvas.clientHeight !== viewportH)resize();
  let towards = (place === 'window' || place === 'peeling' || place === 'down' && view > .001) ? 1 : 0;
  if (place === 'down')towards = lift;
  view = mix(view, towards, 1 - Math.exp(-dt * 2.25));
  const portrait = clamp((1 - camera.aspect) / .55);
  const reveal = place === 'window' ? smooth((age - wallAge - 3.1) / 2.3) : 1;
  const framedDish = dishDock.clone().lerp(dish.position, reveal);
  const wide = (1 - smooth(dock)) * reveal;
  const aim = v3(.22, 1.12, -2.90).lerp(v3(.08, .73, -1.15), wide);
  const wallPoints = [v3(-1.71, 2.39, -3.12), v3(1.32, 2.37, -3.12), v3(-1.75, .45, -2.06), v3(1.42, .42, -3.13), v3(-1.75, .42, -3.13), framedDish.clone().add(v3(.92, .24, .71)), framedDish.clone().add(v3(-.58, .11, .43))];
  fitCamera(windowCamera, aim, v3(mix(.61, .45, portrait), mix(.23, .56, wide), 1), wallPoints, .929);
  camera.position.lerpVectors(floorCamera.eye, windowCamera.eye, view);
  camera.lookAt(floorCamera.aim.clone().lerp(windowCamera.aim, view));
  camera.updateMatrixWorld(true)
}
let gravityTime = 0;
function animate() {
  requestAnimationFrame(animate);
  clock.update();
  const dt = Math.min(.05, clock.getDelta());
  if (document.hidden)return;
  age += dt;
  if (place === 'lift' || place === 'down' || place === 'mounting') {
    const to = liftGoal - lift, step = Math.sign(to) * Math.min(Math.abs(to), dt * (place === 'down' ? .97 : 1.75));
    if (step)changeLift(lift + step);
    if (place === 'mounting' && lift === 1) {
      place = 'pressCups';
      activity = age;
      cupDown.fill(0);
      cupIndex = 0
    }
    if (place === 'down' && lift === 0) {
      place = 'floor';
      activity = age;
      lickQuota = 1;
      nextVisit = age + 3.8;
      rememberNext = true
    }
  }
  if (slide) {
    moveDish(mix(dock, dockGoal, 1 - Math.exp(-dt * 6)));
    if (Math.abs(dock - dockGoal) < .002) {
      moveDish(dockGoal);
      slide = false
    }
  }
  for (let i = 0; i < cups.length; i++) {
    if (gesture?.kind === 'cup' && gesture.cup === i)cupDown[i] = Math.min(.99, cupDown[i] + dt * 4);
    const sc = 1 - .38 * cupDown[i];
    cups[i].scale.y = sc;
    cups[i].scale.x = cups[i].scale.z = 1 + .075 * cupDown[i];
    cups[i].position.y = -.055 - .024 * cupDown[i];
    cups[i].rotation.z = place === 'peeling' && gesture?.cup === i ? peel * .8 * Math.sign(cups[i].position.x) : 0
  }
  if (place === 'window') {
    gravityTime += dt;
    if (gravityTime > .10) {
      matField.fall(gravityTime, (x, z) => x > .03 && ribs(x, z) < .016 ? .065 : .008);
      gravityTime = 0
    }
  }
  toolMotion(dt);
  dogAnimation(dt);
  moveCamera(dt);
  if (matField.dirty)foodSkin.refresh(lastBend);
  if (dishField.dirty)dishSkin.refresh();
  guide();
  travelingDrops.forEach((o, i) => {
    o.position.y -= dt * (.018 + i * .004) * (.5 + .5 * Math.sin(age * .47 + i));
    if (o.position.y < .41)o.position.y = 4.25
  });
  gardenLightTime.value = age;
  sun.intensity = 2.71 + .16 * Math.sin(age * .091);
  fill.intensity = 1.02 + .045 * Math.sin(age * .091 - .42);
  renderer.render(scene, camera)
}
resize();
moveCamera(0);
dogAnimation(0);
requestAnimationFrame(animate);
