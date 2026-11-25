"use strict";
let now = 0, played = 0, sessionStart = 0, started = false, lastTouch = 0, serial = 0, lastEntry = 0, windowView = false, viewBlend = 0, visited = false, returned = false;
const actions = { drops: 0, lifts: 0 }, camTop = V(), aimTop = V(), camLow = V(), aimLow = V();

function resize() {
  const w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.aspect = aspect;
  camera.fov = 35;
  camera.updateProjectionMatrix();
  const dir = V(aspect < 0.85 ? 0.16 : 0.285, aspect < 0.85 ? 0.76 : 0.57, 1).normalize();
  aimTop.set(0, aspect < 0.85 ? -0.52 : -0.4, 0.03);
  const side = V().crossVectors(V(0, 1, 0), dir).normalize(), up = V().crossVectors(dir, side), tan = Math.tan(camera.fov * PI / 360);
  const marks = [restPos.clone().add(V(0, 1.37 * animalScale, 0)), V(-W / 2, FLOOR, front), V(W / 2, FLOOR, front), V(-W / 2, 0.2, front), V(W / 2, 0.2, front), V(W / 2, 0.8, back), V(-W / 2, 1.2, back)];
  let dist = 0;
  for (const p of marks) {
    const d = p.clone().sub(aimTop), x = Math.abs(d.dot(side)), y = Math.abs(d.dot(up));
    dist = Math.max(dist, d.dot(dir) + Math.max(x / (tan * aspect * (aspect < 0.85 ? 1.39 : 0.947)), y / (tan * 0.925)));
  }
  camTop.copy(aimTop).addScaledVector(dir, dist);
  const glassDistance = Math.max(3.2, (bayHalf + 0.24) / (Math.tan(43 * PI / 360) * aspect * 0.96));
  camLow.set(0.04, FLOOR * 0.735, front + glassDistance);
  aimLow.set(0, FLOOR * 0.42, -0.3);
  setCamera();
}

function setCamera() {
  const t = smooth(0, 1, viewBlend);
  camera.position.lerpVectors(camTop, camLow, t);
  const aim = V().lerpVectors(aimTop, aimLow, t);
  camera.fov = mix(35, 43, t);
  camera.updateProjectionMatrix();
  camera.lookAt(aim);
  camera.updateMatrixWorld();
}
const ray = new T.Raycaster(), ndc = new T.Vector2(), dragPlane = new T.Plane(V(0, 1, 0), -0.97);

function rayAt(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set((x - r.left) / r.width * 2 - 1, 1 - (y - r.top) / r.height * 2);
  ray.setFromCamera(ndc, camera);
}

function atHeight(y) {
  dragPlane.constant = -y;
  return ray.ray.intersectPlane(dragPlane, V());
}

function orient(f) {
  f.o.rotation.set(f.tilt, f.yaw, f.roll, "YXZ");
}

function boardPose(f, p, d = 0) {
  const loc = V(0, 0.105, 0.025 + d);
  f.o.position.copy(p.board.localToWorld(loc));
  const q = new T.Quaternion().setFromEuler(new T.Euler(0, f.yaw - p.g.rotation.y, f.roll, "YXZ"));
  f.o.quaternion.copy(p.board.getWorldQuaternion(new T.Quaternion())).multiply(q);
}

function layBoard(f, p) {
  f.state = "board";
  f.port = p;
  p.ready = f;
  f.tilt = 0;
  boardPose(f, p);
}

function stockPosition(n) {
  const locations = [[-0.08, 0.08, 0.23, -1.19], [-0.13, 0.12, -0.11, -0.84], [0.22, 0.16, -0.08, -1.55], [-0.28, 0.185, 0.015, -0.3], [0.03, 0.2, 0.17, -0.76], [0.16, 0.23, 0.16, -1.62]];
  const s = locations[n % locations.length];
  return { p: wpos(dish, s[0], s[1] + 0.02, s[2]), yaw: s[3] };
}

function freshStock(f) {
  const n = fishList.filter((k) => k !== f && k.state === "dish").length, s = stockPosition(n);
  f.state = "dish";
  f.port = null;
  f.o.visible = true;
  f.o.scale.setScalar(1);
  f.o.position.copy(s.p);
  f.yaw = s.yaw;
  f.tilt = 0;
  f.roll = 1.25 + n % 3 * 0.13;
  orient(f);
}
const first = newFish();
first.yaw = ports[0].g.rotation.y + 0.99;
layBoard(first, ports[0]);
for (let i = 0; i < 5; i++) freshStock(newFish());
let audio = null;

function wakeAudio() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) try {
      audio = new AC();
    } catch {
    }
  }
  if (audio?.state === "suspended") audio.resume().catch(() => {
  });
}

function sound(kind, x = 0, amp = 1) {
  if (!audio || audio.state === "closed") return;
  const t = audio.currentTime, under = viewBlend > 0.5, panner = audio.createStereoPanner ? audio.createStereoPanner() : audio.createGain();
  if (panner.pan) panner.pan.value = clamp(x / (W * 0.55), -0.8, 0.8);
  panner.connect(audio.destination);
  const splash = kind === "splash" || kind === "dive", dur = splash ? 0.3 : kind === "clink" ? 0.1 : 0.082;
  const gain = audio.createGain();
  gain.connect(panner);
  gain.gain.setValueAtTime(1e-4, t);
  gain.gain.exponentialRampToValueAtTime((splash ? 0.105 : 0.065) * amp + 1e-4, t + 6e-3);
  gain.gain.exponentialRampToValueAtTime(1e-4, t + dur);
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = (under ? 1250 : 4200) * (kind === "dive" ? 0.65 : 1);
  filter.connect(gain);
  const buf = audio.createBuffer(1, Math.ceil(audio.sampleRate * dur), audio.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.createBufferSource();
  src.buffer = buf;
  src.connect(filter);
  src.start();
  const osc = audio.createOscillator(), og = audio.createGain();
  osc.type = splash ? "sine" : "triangle";
  osc.frequency.setValueAtTime(splash ? 390 : 790, t);
  osc.frequency.exponentialRampToValueAtTime(splash ? 126 : 380, t + dur);
  og.gain.value = splash ? 0.73 : 0.39;
  osc.connect(og);
  og.connect(gain);
  osc.start();
  osc.stop(t + dur);
  osc.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
    og.disconnect();
    osc.disconnect();
    panner.disconnect();
  };
}
const rings = [], ringGeo = new T.RingGeometry(0.93, 1, 60);
ringGeo.rotateX(-PI / 2);

function ripple(x, z, size = 1) {
  for (let i = 0; i < 3; i++) {
    const m = new T.MeshBasicMaterial({ color: i === 1 ? 0x9bdedb : 0xe0fff7, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
    const o = mesh(ringGeo, m);
    o.position.set(x, 0.034 + i * 2e-3, z);
    o.castShadow = o.receiveShadow = false;
    o.renderOrder = 4;
    rings.push({ o, age: -i * 0.135, size });
  }
}
const bubbles = [], bubbleMat = mat(0xb4edf0, 0.13, 0.37, { transparent: true, opacity: 0.45, depthWrite: false });

function bubble(x, y, z, r = 0.032, waterDrop = false) {
  const o = egg(scene, bubbleMat, x, y, z, r, r * (waterDrop ? 1.6 : 1.12), r, true);
  o.castShadow = false;
  bubbles.push({ o, r, dx: rand() - 0.5, vy: waterDrop ? -0.2 : 0.43 + rand() * 0.28, fall: waterDrop, age: 0 });
  return o;
}

function current(x, z, y) {
  const shield = smooth(0.1, 1.75, Math.abs(x - perch.x) * 0.7 + Math.abs(z - perch.z) * 0.4);
  return V(-(0.085 + 0.32 * shield) * (0.86 + 0.14 * Math.sin(z * 1.19 + y - now * 0.17)), 0, 0.095 * Math.cos(x * 0.75 + y * 0.43) + 0.05 * Math.sin(z + now * 0.15));
}

function effects(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.age += dt;
    if (r.age > 2.1) {
      scene.remove(r.o);
      r.o.material.dispose();
      rings.splice(i, 1);
      continue;
    }
    r.o.visible = r.age >= 0;
    if (r.age < 0) continue;
    const sz = (0.07 + 0.64 * r.age) * r.size;
    r.o.scale.setScalar(sz);
    r.o.material.opacity = 0.55 * (1 - r.age / 2.1) ** 1.65;
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i], p = b.o.position;
    b.age += dt;
    if (b.fall) {
      b.vy -= 7 * dt;
      p.y += b.vy * dt;
      p.x += (b.vx || 0) * dt;
      p.z += (b.vz || 0) * dt;
    } else {
      const flow = current(p.x, p.z, p.y);
      p.x += (flow.x * 0.75 + b.dx * 0.08) * dt;
      p.z += flow.z * dt;
      p.y += b.vy * dt;
      b.o.scale.x = b.r * (1 + 0.095 * Math.sin(b.age * 8));
    }
    if ((b.fall ? p.y <= 0 : p.y >= 0) || b.age > 16) {
      if (b.fall) ripple(p.x, p.z, 0.26);
      scene.remove(b.o);
      bubbles.splice(i, 1);
    }
  }
  if (Math.floor(now * 2) !== Math.floor((now - dt) * 2)) {
    const side = now % 3 < 1 ? 1 : -1;
    bubble(side * W * 0.34 + rand() * 0.1, FLOOR + 0.18, back + 1.5 + (side + 1) * 0.58 + rand() * 0.16, 0.014 + rand() * 0.029);
  }
}

function queuedPose(f, p, i) {
  return wpos(p.g, 0, 0.215, -0.78 - i * 0.32);
}

function loadNext(p) {
  if (p.ready || p.transit || !p.queue.length) return;
  const f = p.queue.shift();
  f.state = "loading";
  p.transit = { f, start: f.o.position.clone(), age: 0 };
  p.queue.forEach((q, i) => q.slot = i);
}

function release(p) {
  if (p.cycle >= 0 || p.transit) return;
  p.cycle = 0;
  p.feed = p.ready;
  p.ready = null;
  lastTouch = now;
  sound("click", p.anchor.x, 0.84);
  if (p.feed) {
    p.feed.state = "sliding";
    p.feed.entry = p.index;
    p.feed.broad = Math.abs(Math.sin(p.feed.yaw - p.g.rotation.y));
    p.feed.serial = ++serial;
    actions.drops++;
    lastEntry = p.index;
  }
}

function updatePorts(dt) {
  for (const p of ports) {
    if (p.cycle >= 0) {
      const old = p.cycle, t = p.cycle += dt;
      p.button.position.y = -0.133 * (smooth(0, 0.115, t) - smooth(0.49, 0.79, t));
      rods[p.index].g.position.y = p.button.position.y;
      p.board.rotation.x = 0.7 * (smooth(0.12, 0.69, t) - smooth(0.97, 1.5, t));
      if (old < 0.27 && t >= 0.27 && p.feed) {
        const d = wpos(p.board, 0, 0.09, 0.37);
        bubble(d.x, d.y, d.z, 0.026, true);
      }
      if (p.feed) {
        const f = p.feed;
        f.tail.rotation.y = 0.14 * (1 - f.broad) * Math.sin(smooth(0.27, 0.83, t) * PI);
        const d = 0.75 * Math.pow(smooth(0.28, 0.86, t), 1.7);
        boardPose(f, p, d);
        if (t >= 0.83) {
          const a = p.g.rotation.y;
          f.state = "air";
          f.port = null;
          f.vel.set(Math.sin(a) * 1.19, -0.55, Math.cos(a) * 1.19);
          const e = new T.Euler().setFromQuaternion(f.o.quaternion, "YXZ");
          f.tilt = e.x;
          f.roll = e.z;
          f.yaw = e.y;
          f.age = 0;
          p.feed = null;
        }
      }
      if (t > 1.54) {
        p.cycle = -1;
        loadNext(p);
      }
    }
    if (p.transit) {
      const t = p.transit;
      t.age += dt;
      const f = t.f, k = smooth(0, 0.41, t.age);
      f.o.position.lerpVectors(t.start, wpos(p.board, 0, 0.105, 0.025), k);
      p.dividers[0].position.y = 0.162 - 0.12 * Math.sin(k * PI);
      if (k >= 1) {
        p.transit = null;
        layBoard(f, p);
      }
    }
    for (let i = 0; i < p.queue.length; i++) {
      const f = p.queue[i];
      f.o.position.lerp(queuedPose(f, p, i), 1 - Math.exp(-8 * dt));
    }
  }
}
let focusFish = null, heldFish = null, birdState = "rock", birdAge = 0, hadMeal = false, swimMix = 0, openBill = 0, catchDelay = 0, idleTime = 0, lastMeal = V(), hasMealPoint = false, landPreen = false;
let birdYaw = 0.5, birdPitch = 0, headYaw = 0, stepOrigin = V(), ledgeLip = V(), launchDest = V(), swallowAge = 0, waitingIndex = 0;
const memory = [0, 0], swimVelocity = V(), jawPoint = V(), jawPoint2 = V();

function steerAngle(a, b, k) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
}

function setBird(mode) {
  birdState = mode;
  birdAge = 0;
}

function landedInWater(f) {
  const p = f.o.position;
  f.state = "water";
  f.age = 0;
  f.vel.multiplyScalar(0.59);
  f.turnRate = 0.9 + (1 - f.broad) * 0.6;
  f.entryYaw = f.yaw;
  f.entryRoll = f.roll;
  f.entryTilt = f.tilt;
  f.wetDepth = 0;
  ripple(p.x, p.z, 0.84);
  for (let i = 0; i < 4; i++) {
    const a = TAU * rand();
    bubble(p.x + 0.04 * Math.cos(a), 0.016, p.z + 0.04 * Math.sin(a), 0.01 + rand() * 0.014, true);
    const b = bubbles[bubbles.length - 1];
    b.vy = 0.45 + rand() * 0.84;
    b.vx = 0.24 * Math.cos(a);
    b.vz = 0.24 * Math.sin(a);
  }
  sound("splash", p.x, f.entry === 1 ? 0.65 : 1);
  for (let i = 0; i < 6; i++) bubble(p.x + (rand() - 0.5) * 0.11, -0.09 - rand() * 0.21, p.z + (rand() - 0.5) * 0.09, 0.019 + rand() * 0.027);
  if (birdState === "rock") {
    focusFish = f;
    const path = p.clone().sub(perch);
    path.y = 0;
    path.normalize();
    path.z = Math.max(0.58, path.z);
    path.normalize();
    let edge = 0;
    while (edge < 3.2 && rockBelow(perch.x + path.x * edge, perch.z + path.z * edge)) edge += 0.08;
    ledgeLip.copy(restPos).addScaledVector(path, Math.max(0, edge - 0.42));
    const support = rockBelow(ledgeLip.x, ledgeLip.z);
    if (support) ledgeLip.y = support.h + animalScale * 1.065;
    launchDest.copy(perch).addScaledVector(path, edge + 0.65);
    launchDest.y = -0.77;
    setBird("notice");
    landPreen = false;
  }
}

function dryRest(f) {
  f.state = "rock";
  f.vel.set(0, 0, 0);
  f.tilt *= 0.2;
  f.roll = 1.43;
  orient(f);
}

function rockBelow(x, z) {
  let highest = null;
  for (const r of rockRanges) {
    const d = ((x - r.x) / r.rx) ** 2 + ((z - r.z) / r.rz) ** 2;
    if (d < 0.87) {
      const h = r.top - Math.max(0, Math.sqrt(d) - 0.52) * 0.44;
      if (!highest || h > highest.h) highest = { h, r };
    }
  }
  return highest;
}

function updateFish(dt) {
  for (const f of fishList) {
    const p = f.o.position;
    if (f.state === "air" || f.state === "fall") {
      const prevY = p.y;
      f.age += dt;
      f.vel.y -= 6.3 * dt;
      p.addScaledVector(f.vel, dt);
      f.tilt += dt * (1 - f.broad) * 0.7;
      orient(f);
      if (f.state === "fall") {
        const r = rockBelow(p.x, p.z);
        if (r && prevY >= r.h && p.y <= r.h + 0.06) {
          p.y = r.h + 0.07;
          dryRest(f);
          continue;
        }
      }
      const surface = dimples.value[f.entry === null ? 2 : f.entry];
      if (p.y < 0.32) surface.set(p.x, p.z, 0.093 * (1 - smooth(0.015, 0.32, p.y)), 0);
      if (Math.min(wpos(f.o, 0, 0, 0.32).y, wpos(f.o, 0, 0, -0.36).y, p.y - 0.042) <= 0) landedInWater(f);
    } else if (f.state === "water") {
      f.age += dt;
      const flow = current(p.x, p.z, p.y), k = 1 - Math.exp(-dt * 1.27), sink = 0.76 - f.broad * 0.39;
      f.vel.x = mix(f.vel.x, flow.x * (0.48 + f.broad * 0.95), k);
      f.vel.z = mix(f.vel.z, flow.z * (0.65 + f.broad * 0.56), k);
      f.vel.y = mix(f.vel.y, -sink, 1 - Math.exp(-2.1 * dt));
      const ledge = rockBelow(p.x, p.z);
      if (ledge && p.y > FLOOR + 0.58 && p.y < -0.17) {
        f.vel.x += Math.sign(p.x - ledge.r.x) * dt * 0.55;
        f.vel.z += Math.sign(p.z - ledge.r.z) * dt * 0.34;
        f.vel.y = Math.max(f.vel.y, -sink * 0.51);
      }
      p.addScaledVector(f.vel, dt);
      p.x = clamp(p.x, -netRX + 0.29, netRX - 0.29);
      p.z = clamp(p.z, -netRZ + 0.26, netRZ - 0.26);
      f.wetDepth = -p.y;
      f.tilt = mix(f.entryTilt, 0.86 - f.broad * 0.7, 1 - Math.exp(-f.age * 1.7)) + 0.14 * Math.sin(f.age * 2.1) * Math.exp(-f.age * 0.36);
      f.roll = f.entryRoll + 1.8 * Math.sin(f.age * 1.55) * Math.exp(-f.age * 0.31) + 0.56 * (1 - Math.exp(-f.age * 0.52));
      f.yaw = f.entryYaw + (0.34 + 0.3 * f.broad) * Math.sin(f.age * 0.85);
      f.tail.rotation.x = 0.11 * Math.sin(f.age * 3) * Math.exp(-0.47 * f.age);
      orient(f);
      if (p.y <= netY(p.x, p.z) + 0.07) {
        f.state = "net";
        f.settle = 0;
        f.onMesh = V(p.x, 0, p.z);
        f.netYaw = f.yaw;
        f.landTilt = f.tilt;
        f.landRoll = f.roll;
        f.liftSeen = netLift;
        f.vel.multiplyScalar(0.12);
        f.weight = 0;
      }
    } else if (f.state === "net") {
      f.settle += dt;
      const k = smooth(0, 0.65, f.settle), rise = netLift - f.liftSeen;
      f.liftSeen = netLift;
      f.onMesh.x = clamp(f.onMesh.x + f.vel.x * dt * 0.48, -netRX + 0.25, netRX - 0.25);
      f.vel.multiplyScalar(Math.exp(-dt * 4));
      f.onMesh.z = clamp(f.onMesh.z - 0.038 * Math.max(0, rise), -netRZ + 0.26, netRZ - 0.26);
      p.set(f.onMesh.x, netY(f.onMesh.x, f.onMesh.z) + 0.07 - 0.046 * k + 0.025 * Math.sin(f.settle * 12) * Math.exp(-f.settle * 4), f.onMesh.z);
      f.weight = k;
      f.tilt = mix(f.landTilt, 0, k) - Math.min(0.21, Math.abs(rise) * 4);
      f.roll = mix(f.landRoll, 1.4, k);
      f.tail.rotation.x = 0.16 * Math.sin(f.settle * 8) * Math.exp(-f.settle * 3);
      orient(f);
    } else if (f.state === "spent") {
      f.age += dt;
      if (f.age > 3.2 && fishList.filter((q) => q.state === "dish").length < 5) freshStock(f);
    }
  }
}

function resetEmptyHeight() {
  if (visited && netDesired < 0.02 && hadMeal && (played - sessionStart > 358 || actions.lifts > 0)) {
    returned = true;
  }
}

function updateNet(dt) {
  netLift = mix(netLift, netDesired, 1 - Math.exp(-dt * 9));
  handle.position.y = -0.56 - handleTravel;
  netG.position.y = netLift;
  netEdge.position.y = netLift;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { o, a, b } = line;
    const slack = i % 2 === 0 ? 1 - smooth(0, 0.10, handleTravel) : 0;
    if (line.slack !== slack) {
      const vertices = o.geometry.attributes.position;
      const length = o.geometry.parameters.height;
      for (let j = 0; j < vertices.count; j++) {
        const along = line.straight[j * 3 + 1] / length + 0.5;
        vertices.setZ(j, line.straight[j * 3 + 2] - 0.19 * slack * Math.sin(PI * along));
      }
      vertices.needsUpdate = true;
      line.slack = slack;
    }
    if (i % 2 === 0) a.y = netY(a.x, a.z);
    else b.y = handle.position.y + 0.04;
    const delta = b.clone().sub(a);
    o.position.copy(a).lerp(b, 0.5);
    o.scale.y = delta.length() / o.geometry.parameters.height;
    o.quaternion.setFromUnitVectors(V(0, 1, 0), delta.normalize());
  }
  for (const w of pulleys) w.rotation.z = -netLift * 5;
  if (Math.floor(now * 24) === Math.floor((now - dt) * 24)) return;
  netArray.set(unloadedNet);
  for (const f of fishList) {
    if (f.state !== "net") continue;
    const p = f.o.position, ci = Math.round((p.x / netRX + 1) * nx / 2), cj = Math.round((p.z / netRZ + 1) * nz / 2);
    for (let j = Math.max(0, cj - 4); j <= Math.min(nz, cj + 4); j++) for (let i = Math.max(0, ci - 4); i <= Math.min(nx, ci + 4); i++) {
      const k = (j * (nx + 1) + i) * 3;
      netArray[k + 1] -= 0.067 * f.weight * Math.exp(-((netArray[k] - p.x) ** 2 + (netArray[k + 2] - p.z) ** 2) * 12);
    }
  }
  netGeo.attributes.position.needsUpdate = true;
}

function available(f) {
  return f && (f.state === "water" || f.state === "net" && netLift > 0.2);
}

function biteTest(f) {
  const inside = (v) => {
    f.o.worldToLocal(v);
    const z = v.z;
    if (z < -0.25 || z > 0.29) return false;
    const r = 1 - ((z - 0.022) / 0.342) ** 2;
    return (v.x / 0.067) ** 2 + (v.y / 0.103) ** 2 < r;
  };
  for (const z of [0.24, 0.29, 0.34, 0.39]) {
    upperJaw.localToWorld(jawPoint.set(0, -0.028, z));
    lowerJaw.localToWorld(jawPoint2.set(0, -0.022, z));
    if (inside(jawPoint) && inside(jawPoint2)) return true;
  }
  return false;
}

function takeFish(f) {
  heldFish = f;
  swallowAge = 0;
  focusFish = null;
  f.state = "mouth";
  f.bitePos = head.worldToLocal(f.o.position.clone());
  f.biteQuat = head.getWorldQuaternion(new T.Quaternion()).invert().multiply(f.o.quaternion);
  hadMeal = true;
  lastMeal.copy(f.o.position);
  hasMealPoint = true;
  if (f.entry !== null) {
    memory[0] *= 0.68;
    memory[1] *= 0.68;
    memory[f.entry] += 1;
    waitingIndex = memory[1] > memory[0] ? 1 : 0;
  }
}

function reachRest() {
  stepOrigin.copy(peng.position);
  setBird("climb");
  landPreen = true;
  focusFish = null;
}

function updateBird(dt) {
  birdAge += dt;
  catchDelay = Math.max(0, catchDelay - dt);
  const pos = peng.position, rotK = 1 - Math.exp(-dt * 3.6);
  const land = birdState === "rock" || birdState === "notice", swimming = birdState === "swim";
  swimMix = mix(swimMix, land ? 0 : 1, 1 - Math.exp(-dt * 3.6));
  body.rotation.z = 0.024 * Math.sin(now * 1.43) * (1 - swimMix);
  let headAim = 0, desiredPitch = 0, desiredHeadPitch = 0, wingBeat = 0;
  if (land) {
    const walk = birdState === "notice" ? 0.95 : landPreen ? 0.06 : 0.22 + 0.43 * smooth(0.15, 0.87, Math.sin(now * 0.78));
    pos.copy(restPos);
    pos.y += 9e-3 * Math.sin(now * 2) + 0.018 * Math.abs(Math.sin(now * 4.1)) * walk;
    pos.x += 0.085 * Math.sin(now * 0.91) * walk;
    for (let i = 0; i < 2; i++) {
      const ph = now * 4.1 + i * PI;
      feet[i].position.y = -0.918 + walk * 0.071 * Math.max(0, Math.sin(ph));
      feet[i].position.z = -0.029 + walk * 0.084 * Math.cos(ph);
    }
    if (birdState === "notice" && focusFish) {
      pos.lerp(ledgeLip, smooth(0.18, 0.98, birdAge));
      const d2 = focusFish.o.position.clone().sub(pos), a = Math.atan2(d2.x, d2.z);
      headAim = clamp(Math.atan2(Math.sin(a - birdYaw), Math.cos(a - birdYaw)), -0.87, 0.87);
      if (birdAge > 0.21) birdYaw = steerAngle(birdYaw, a, rotK * 0.65);
      if (birdAge > 1.01) {
        stepOrigin.copy(pos);
        setBird("jump");
      }
    } else if (landPreen) {
      const v = smooth(-0.65, 0.3, Math.sin(birdAge * 1.46));
      headAim = -1.65 * v;
      desiredHeadPitch = 0.84 * v;
    } else {
      headAim = 0.23 * Math.sin(now * 0.78) + 0.16 * Math.sin(now * 0.37);
      desiredHeadPitch = 0.07 + 0.079 * Math.sin(now * 0.9);
      birdYaw = steerAngle(birdYaw, 0.55 + 0.13 * Math.sin(now * 0.42), rotK * 0.2);
    }
  } else if (birdState === "jump" || birdState === "climb") {
    const climb = birdState === "climb", u = clamp(birdAge / (climb ? 1.75 : 1.14), 0, 1), to = climb ? restPos : launchDest;
    pos.lerpVectors(stepOrigin, to, smooth(0, 1, u));
    pos.y += Math.sin(PI * u) * (climb ? 0.56 : 0.43);
    desiredPitch = climb ? 1.08 * (1 - u) : 1.62 * smooth(0, 0.84, u);
    desiredHeadPitch = -0.57 * smooth(0.29, 0.86, u);
    wingBeat = Math.sin(u * PI);
    if (!climb && u > 0.68 && u - dt / 1.14 <= 0.68) {
      ripple(pos.x, pos.z, 1.65);
      sound("dive", pos.x, 1.15);
    }
    if (u >= 1) {
      setBird(climb ? "rock" : "swim");
      if (climb) {
        returned = false;
        sessionStart = played;
        birdYaw = 0.56;
      } else swimVelocity.set(Math.sin(birdYaw) * 0.6, -0.36, Math.cos(birdYaw) * 0.6);
    }
  } else if (swimming) {
    if (!available(focusFish)) focusFish = null;
    if (!focusFish && !heldFish && catchDelay <= 0) focusFish = fishList.filter(available).sort((a, b) => a.serial - b.serial)[0] || null;
    idleTime = focusFish || heldFish ? 0 : idleTime + dt;
    const target = V(), heading = V(), prevMouth = mouthSocket.getWorldPosition(V());
    let speed = 1.8, precision = 0;
    if (focusFish) {
      const dest = focusFish.o.position;
      target.copy(dest);
      if (focusFish.state === "water") target.addScaledVector(focusFish.vel, 0.12);
      heading.copy(target).sub(pos);
      const dist = prevMouth.distanceTo(dest);
      precision = 1 - smooth(0.16, 1.25, dist);
      speed = clamp(0.32 + dist * 1.34, 0.25, 2.29);
    } else {
      const base = hasMealPoint ? lastMeal : V(perch.x, -0.55, perch.z + 1);
      const t = now * 0.38, hoverDepth = idleTime > 8 ? -0.28 : clamp(base.y, -1.9, -0.38);
      target.copy(base);
      target.x += 0.64 * Math.sin(t);
      target.z += 0.56 * Math.cos(t * 0.86);
      if (hasMealPoint && idleTime > 6) {
        const station = ports[waitingIndex].anchor;
        target.x = mix(target.x, station.x - 0.7, 0.38);
        target.z = mix(target.z, station.z + 0.46, 0.38);
      }
      target.y = hoverDepth + 0.058 * Math.sin(now * 1.68);
      target.z = clamp(target.z, back + 0.65, front - 0.72);
      target.x = clamp(target.x, -W * 0.41, W * 0.41);
      if ((returned || played - sessionStart > 378 && !windowView && netLift < 0.04) && hadMeal && !heldFish && idleTime > 1) {
        target.copy(launchDest);
        if (pos.distanceTo(target) < 0.82) {
          reachRest();
          return;
        }
      }
      heading.copy(target).sub(pos);
      speed = clamp(heading.length() * 1.1, 0.08, heldFish ? 0.82 : 1.07);
    }
    const dir = heading.clone().normalize(), yaw = Math.atan2(dir.x, dir.z), pitch = clamp(PI * 0.5 - Math.asin(clamp(dir.y, -1, 1)), 0.33, 2.67);
    const turn = Math.atan2(Math.sin(yaw - birdYaw), Math.cos(yaw - birdYaw));
    tail.rotation.y = mix(tail.rotation.y, clamp(-turn * 0.38, -0.5, 0.5), 1 - Math.exp(-dt * 2));
    headAim = clamp(turn * 0.74, -0.63, 0.63);
    birdYaw = steerAngle(birdYaw, yaw, 1 - Math.exp(-dt * (1.75 + precision * 1.3)));
    desiredPitch = focusFish ? pitch : mix(1.32, pitch, 0.58);
    desiredHeadPitch = -(focusFish ? 1.32 : 1.15);
    body.rotation.z = mix(body.rotation.z, clamp(-turn * 0.45, -0.67, 0.67), rotK);
    const forward = V(Math.sin(birdYaw) * Math.sin(desiredPitch), Math.cos(desiredPitch), Math.cos(birdYaw) * Math.sin(desiredPitch));
    const velocity = forward.multiplyScalar(speed);
    if (focusFish) {
      const fix = target.clone().sub(prevMouth).multiplyScalar(5.5);
      velocity.lerp(fix, precision);
    } else velocity.lerp(dir.multiplyScalar(speed), 0.48);
    swimVelocity.lerp(velocity, 1 - Math.exp(-dt * (3 + precision * 7)));
    pos.addScaledVector(swimVelocity, dt);
    pos.x = clamp(pos.x, -W * 0.49, W * 0.49);
    pos.z = clamp(pos.z, back + 0.19, front - 0.23);
    pos.y = clamp(pos.y, FLOOR + 0.39, 0.01);
    wingBeat = 0.5 + 0.5 * Math.sin(now * (focusFish ? 5.5 : 3.2));
    desiredHeadPitch += 0.065 * Math.sin(now * 3.2);
    if (idleTime > 8) desiredHeadPitch -= 0.22;
  }
  birdPitch = mix(birdPitch, desiredPitch, 1 - Math.exp(-dt * 5.4));
  headYaw = steerAngle(headYaw, headAim, 1 - Math.exp(-dt * 8));
  peng.rotation.set(birdPitch, birdYaw, 0, "YXZ");
  head.rotation.set(mix(head.rotation.x, desiredHeadPitch, rotK), headYaw, 0, "YXZ");
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    wings[i].rotation.z = s * (0.054 + swimMix * (0.72 + 0.9 * wingBeat) + 0.025 * Math.sin(now * 2));
    wings[i].rotation.x = swimMix * (0.34 * wingBeat - 0.29);
    feet[i].rotation.x = -0.57 * swimMix;
  }
  mouthSocket.getWorldPosition(mouth);
  const d = focusFish ? mouth.distanceTo(focusFish.o.position) : 99;
  const gape = heldFish ? 0.09 : focusFish && swimming ? d < 0.125 ? 0.035 : d < 1.22 ? 0.47 : 0.07 : 0.015;
  openBill = mix(openBill, gape, 1 - Math.exp(-dt * 12));
  upperJaw.rotation.x = -openBill * 0.4;
  lowerJaw.rotation.x = openBill * 0.85;
  if (swimming && focusFish && d < 0.23 && openBill < 0.27 && biteTest(focusFish)) takeFish(focusFish);
  if (heldFish) {
    const f = heldFish;
    swallowAge += dt;
    const k = smooth(0.48, 1.62, swallowAge);
    const q = f.biteQuat.clone().slerp(new T.Quaternion().setFromEuler(new T.Euler(0.12, PI, 0.45, "YXZ")), smooth(0.16, 0.91, swallowAge));
    const local = f.bitePos.clone().lerp(V(0, -0.14, 0.06), k);
    f.o.position.copy(head.localToWorld(local));
    f.o.quaternion.copy(head.getWorldQuaternion(new T.Quaternion())).multiply(q);
    f.o.scale.setScalar(1 - 0.45 * k);
    if (swallowAge >= 1.64) {
      f.state = "spent";
      f.o.visible = false;
      f.age = 0;
      heldFish = null;
      catchDelay = 2.75;
    }
  }
}
let pointer = null, handleTravel = 0, guideTarget = null, guideMaterial = null, guideBase = null;
const screenV = V();

function projectToScreen(p) {
  const q = screenV.copy(p).project(camera);
  return { x: (q.x + 1) * canvas.clientWidth / 2, y: (1 - q.y) * canvas.clientHeight / 2 };
}

function screenDist(p, x, y) {
  const a = projectToScreen(p);
  return Math.hypot(x - a.x, y - a.y);
}

function screenSegment(a, b, x, y) {
  const p = projectToScreen(a), q = projectToScreen(b), dx = q.x - p.x, dy = q.y - p.y, t = clamp(((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { d: Math.hypot(x - p.x - dx * t, y - p.y - dy * t), t };
}

function onFront(x, y) {
  rayAt(x, y);
  return ray.ray.intersectPlane(new T.Plane(V(0, 0, 1), -(front + 0.13)), V());
}

function touchTarget(x, y) {
  rayAt(x, y);
  if (windowView) {
    for (const p of ports) {
      const r = rods[p.index];
      if (screenDist(wpos(r.cap), x, y) < 24 || ray.intersectObject(r.cap).length) return { type: "release", p };
    }
    if (screenSegment(wpos(handle, 0, -0.03, 0.02), wpos(handle, 0, -0.36, 0.04), x, y).d < 23) return { type: "lift" };
    const lip = onFront(x, y);
    if (lip && Math.abs(lip.x) < W * 0.53 && Math.abs(lip.y - 0.11) < 0.18 + W * 0.016) return { type: "up" };
  } else {
    for (const p2 of ports) {
      if (ray.intersectObject(p2.cap).length || screenDist(p2.anchor, x, y) < Math.max(17, canvas.clientWidth * 0.017)) return { type: "release", p: p2 };
    }
    let best = null, score = Infinity;
    for (const f of fishList) {
      if (!["dish", "board", "rock", "queue"].includes(f.state)) continue;
      const hit = screenSegment(wpos(f.o, 0, 0, -0.414), wpos(f.o, 0, 0, 0.342), x, y);
      const rank = hit.d - f.o.position.y * 0.54;
      if (hit.d < Math.max(13, canvas.clientWidth * 0.0105) && rank < score) {
        best = { type: "fish", f, grip: mix(-0.414, 0.342, hit.t) };
        score = rank;
      }
    }
    if (best) return best;
    const p = onFront(x, y);
    if (p && Math.abs(p.x) < W * 0.49 && p.y > FLOOR + 0.19 && p.y < -0.18) return { type: "down" };
  }
  return null;
}

function releaseFromSupport(f) {
  const p = f.port;
  if (!p) return;
  if (p.ready === f) p.ready = null;
  const n = p.queue.indexOf(f);
  if (n !== -1) p.queue.splice(n, 1);
  f.port = null;
}

function dryDestination(pos) {
  let winner = null, rank = Infinity;
  for (const p of ports) {
    const v = p.g.worldToLocal(pos.clone());
    if (Math.abs(v.x) < 0.68 && v.z > -1.88 && v.z < 0.96) {
      const d = Math.abs(v.x) + 0.14 * Math.abs(v.z);
      if (d < rank) {
        winner = { p, v };
        rank = d;
      }
    }
  }
  return winner;
}

function placeFish(f) {
  f.tail.rotation.y = 0;
  const target = dryDestination(f.o.position);
  if (target) {
    const { p, v } = target;
    if (!p.ready && !p.transit && p.cycle < 0 && v.z > -0.61) {
      layBoard(f, p);
      sound("clink", p.anchor.x, 0.4);
      return;
    }
    if (p.queue.length < 3) {
      f.state = "queue";
      f.port = p;
      f.slot = p.queue.length;
      p.queue.push(f);
      f.o.position.copy(queuedPose(f, p, f.slot));
      f.tilt = 0;
      orient(f);
      sound("clink", p.anchor.x, 0.4);
      if (p.cycle < 0) loadNext(p);
      return;
    }
  }
  const dp = dish.worldToLocal(f.o.position.clone());
  if (dp.x * dp.x + dp.z * dp.z < 1.17) {
    dp.x = clamp(dp.x, -0.68, 0.68);
    dp.z = clamp(dp.z, -0.58, 0.58);
    let h = 0.076 + 0.085 * (dp.x * dp.x + dp.z * dp.z);
    for (const q of fishList) {
      if (q !== f && q.state === "dish" && Math.hypot(q.o.position.x - f.o.position.x, q.o.position.z - f.o.position.z) < 0.27) h = Math.min(0.27, Math.max(h, q.o.position.y - dishPos.y + 0.057));
    }
    dp.y = h;
    f.o.position.copy(dish.localToWorld(dp));
    f.state = "dish";
    f.roll = 1.38;
    f.tilt = 0;
    orient(f);
    sound("clink", f.o.position.x, 0.42);
    return;
  }
  f.state = "fall";
  f.age = 0;
  f.serial = ++serial;
  f.broad = Math.abs(Math.sin(f.yaw));
  f.entry = null;
  f.vel.set(0, -0.1, 0);
  const r = rockBelow(f.o.position.x, f.o.position.z);
  if (r) f.o.position.y = Math.max(r.h + 0.12, f.o.position.y);
}

function dragAt(x, y) {
  if (!pointer) return;
  const a = pointer.action;
  rayAt(x, y);
  if (a.type === "lift") {
    const start = projectToScreen(V(liftX, -0.56, liftZ)), end = projectToScreen(V(liftX, -0.56 - Math.abs(FLOOR) * 0.64, liftZ)), span = Math.max(38, end.y - start.y), max = Math.abs(FLOOR) * 0.64;
    handleTravel = clamp(pointer.initial + (y - pointer.y) / span * max, 0, max);
    netDesired = maxLift * clamp((handleTravel - 0.1) / (max - 0.1), 0, 1);
    if (Math.abs(pointer.initial - handleTravel) > 0.14 && !pointer.lifted) {
      actions.lifts++;
      pointer.lifted = true;
      sound("click", liftX, 0.45);
    }
    return;
  }
  if (a.type !== "fish") return;
  const p = atHeight(pointer.height);
  if (!p) return;
  p.x = clamp(p.x, -W / 2 + 0.09, W / 2 - 0.09);
  p.z = clamp(p.z, back + 0.09, front - 0.13);
  const change = V().subVectors(p, pointer.lastGrip);
  change.y = 0;
  pointer.lastGrip.copy(p);
  if (change.lengthSq() > 3e-4) {
    const motionAngle = Math.atan2(change.x, change.z), headHold = a.grip > 0.12, tailHold = a.grip < -0.17;
    const desired = motionAngle + (headHold ? 0 : tailHold ? PI : Math.sign(a.grip || 1) * PI * 0.5);
    pointer.yaw = steerAngle(pointer.yaw, desired, Math.min(0.75, change.length() * 4.1));
  }
  pointer.target.copy(p);
  pointer.moved = pointer.moved || Math.hypot(x - pointer.x, y - pointer.y) > 4;
}

function followDrag(dt) {
  if (pointer?.action.type !== "fish") return;
  const { f, grip } = pointer.action;
  const lag = Math.atan2(Math.sin(pointer.yaw - f.yaw), Math.cos(pointer.yaw - f.yaw));
  f.tail.rotation.y = mix(f.tail.rotation.y, clamp(-lag * 0.24, -0.22, 0.22), 1 - Math.exp(-dt * 11));
  f.yaw = steerAngle(f.yaw, pointer.yaw, 1 - Math.exp(-dt * 13));
  f.roll = mix(f.roll, 1.04, 1 - Math.exp(-dt * 8));
  f.tilt = 0;
  orient(f);
  const local = V(0, 0, grip).applyQuaternion(f.o.quaternion);
  f.o.position.lerp(pointer.target.clone().sub(local), 1 - Math.exp(-dt * 22));
}

function stopPointer(ev) {
  if (!pointer || ev.pointerId !== pointer.id) return;
  const a = pointer.action;
  if (a.type === "fish") {
    if (ev.type === "pointerup") dragAt(ev.clientX, ev.clientY);
    if (pointer.moved) followDrag(0.22);
    else {
      a.f.o.position.copy(pointer.original);
      a.f.yaw = pointer.originalYaw;
    }
    const old = pointer.oldPort;
    placeFish(a.f);
    if (old && old.cycle < 0) loadNext(old);
  }
  if (a.type === "lift" && pointer.lifted) sound("click", liftX, 0.65);
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  pointer = null;
  lastTouch = now;
}
canvas.addEventListener("pointerdown", (ev) => {
  if (pointer) return;
  wakeAudio();
  const a = touchTarget(ev.clientX, ev.clientY);
  if (!a) return;
  ev.preventDefault();
  started = true;
  lastTouch = now;
  clearGlow();
  pointer = { id: ev.pointerId, action: a, x: ev.clientX, y: ev.clientY };
  canvas.setPointerCapture(ev.pointerId);
  if (a.type === "release") {
    release(a.p);
  } else if (a.type === "down") {
    windowView = true;
    visited = true;
    sound("clink", 0, 0.36);
  } else if (a.type === "up") {
    windowView = false;
    resetEmptyHeight();
    sound("clink", 0, 0.32);
  } else if (a.type === "lift") {
    pointer.initial = handleTravel;
  } else if (a.type === "fish") {
    const f = a.f;
    pointer.original = f.o.position.clone();
    pointer.originalYaw = f.yaw;
    pointer.oldPort = f.port;
    releaseFromSupport(f);
    f.state = "drag";
    f.o.position.y += 0.14;
    pointer.height = Math.max(0.99, f.o.position.y + 0.09);
    pointer.yaw = f.yaw;
    const p = atHeight(pointer.height) || f.o.position.clone();
    pointer.lastGrip = p.clone();
    pointer.target = p.clone();
  }
});
canvas.addEventListener("pointermove", (ev) => {
  if (pointer) {
    if (pointer.id === ev.pointerId) {
      lastTouch = now;
      dragAt(ev.clientX, ev.clientY);
    }
  } else if (ev.pointerType === "mouse") canvas.style.cursor = touchTarget(ev.clientX, ev.clientY) ? "pointer" : "default";
});
canvas.addEventListener("pointerup", stopPointer);
canvas.addEventListener("pointercancel", stopPointer);
canvas.addEventListener("lostpointercapture", (ev) => {
  if (pointer?.id === ev.pointerId) stopPointer(ev);
});
canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
const hintHand = group(), skin = new T.MeshPhysicalMaterial({ color: 0xffd2ab, transparent: true, opacity: 0.4, depthWrite: false, roughness: 0.56, metalness: 0 });
const palm = egg(hintHand, skin, 0.21, 0.43, 0.12, 0.188, 0.243, 0.09);
palm.rotation.z = -0.32;

function finger(points, r) {
  tube(hintHand, skin, points, r, 18);
  const p = points[0];
  egg(hintHand, skin, ...p, r, r, r, true);
}
finger([[0, 0.043, 0], [8e-3, 0.139, 2e-3], [0.038, 0.235, 0.035], [0.085, 0.324, 0.071]], 0.047);
finger([[0.135, 0.228, 0.147], [0.125, 0.298, 0.187], [0.144, 0.384, 0.12]], 0.05);
finger([[0.226, 0.246, 0.156], [0.227, 0.32, 0.187], [0.22, 0.402, 0.13]], 0.048);
finger([[0.308, 0.292, 0.155], [0.31, 0.352, 0.169], [0.284, 0.428, 0.129]], 0.044);
finger([[-8e-3, 0.317, 0.143], [-0.035, 0.365, 0.157], [0.033, 0.434, 0.117], [0.094, 0.47, 0.1]], 0.055);
hintHand.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = o.receiveShadow = false;
    o.renderOrder = 7;
  }
});
hintHand.visible = false;
const rimCue = box(scene, ivory.clone(), 0, 0.146, front + 0.065, W + 0.382, 0.058, 0.242);
rimCue.material.emissive.set(0xffd193);

function clearGlow() {
  if (guideMaterial && guideBase) {
    guideMaterial.emissive.copy(guideBase.c);
    guideMaterial.emissiveIntensity = guideBase.i;
  }
  guideMaterial = null;
  guideBase = null;
  guideTarget = null;
  hintHand.visible = false;
}
const guided = new Map();

function fishGlow(f) {
  if (!guided.has(f)) {
    const obj = f.o.children[0];
    obj.material = obj.material.clone();
    guided.set(f, obj.material);
  }
  return guided.get(f);
}

function nextGuide() {
  const ready = ports.filter((p) => p.ready && p.cycle < 0), stock = fishList.filter((f) => f.state === "dish" || f.state === "rock"), onNet = fishList.some((f) => f.state === "net");
  const plateHint = (p) => ({ key: p.cap, material: windowView ? rods[p.index].cap.material : p.cap.material, from: windowView ? wpos(rods[p.index].cap) : p.anchor, kind: "press" });
  const windowHint = (up = false) => ({ key: rimCue, material: rimCue.material, from: V(-0.36, up ? 0.14 : -0.49, front + 0.13), kind: "press" });
  if (windowView) {
    if ((played - sessionStart > 358 || !ready.length) && netDesired > 0.02) return { key: handleLoop, material: handleLoop.material, from: wpos(handle, 0, -0.23, 0.055), to: wpos(handle, 0, 0.49, 0.055), kind: "pull" };
    if (ready.length) return plateHint(ready[0]);
    if (onNet && netLift < 0.15 && actions.lifts === 0) return { key: handleLoop, material: handleLoop.material, from: wpos(handle, 0, -0.23, 0.055), to: wpos(handle, 0, -0.96, 0.055), kind: "pull" };
    return windowHint(true);
  }
  if (!visited && ready.length && (actions.drops >= 3 || played > 105)) {
    const p = ready[0];
    if (!p.queue.length && stock.length) {
      const f = stock[stock.length - 1];
      return { key: f, material: fishGlow(f), from: f.o.position.clone(), to: queuedPose(f, p, 0), kind: "carry" };
    }
    return windowHint();
  }
  if (!visited && played > 160 && onNet || played - sessionStart > 358 && !returned && !landPreen && hadMeal) return windowHint();
  if (ready.length) return plateHint(ready[0]);
  if (fishList.some((f) => ["sliding", "air", "loading"].includes(f.state))) return null;
  if (stock.length) {
    const f = stock[stock.length - 1], p = ports[actions.drops === 1 ? 1 : 1 - lastEntry];
    return { key: f, material: fishGlow(f), from: f.o.position.clone(), to: wpos(p.board, 0, 0.14, 0.06), kind: "carry" };
  }
  return windowHint();
}

function guide() {
  if (pointer || Math.abs(viewBlend - (windowView ? 1 : 0)) > 0.02) {
    clearGlow();
    return;
  }
  const h = nextGuide();
  if (!h) {
    clearGlow();
    return;
  }
  if (h.key !== guideTarget) {
    clearGlow();
    guideTarget = h.key;
    guideMaterial = h.material;
    guideBase = { c: h.material.emissive.clone(), i: h.material.emissiveIntensity };
  }
  const pulse = 0.5 + 0.5 * Math.sin(now * 2.8);
  guideMaterial.emissive.setHex(0xffc578);
  guideMaterial.emissiveIntensity = 0.035 + 0.205 * pulse ** 3;
  if (now - lastTouch < 4) {
    hintHand.visible = false;
    return;
  }
  const phase = (now - lastTouch - 4) % 4.5 / 4.5;
  hintHand.visible = phase < 0.84;
  if (!hintHand.visible) return;
  const u = smooth(0.17, 0.66, phase), fade = smooth(0, 0.12, phase) * (1 - smooth(0.69, 0.84, phase));
  skin.opacity = 0.45 * fade;
  hintHand.position.copy(h.from);
  if (h.to) {
    hintHand.position.lerp(h.to, u);
    hintHand.position.y += 0.1 + 0.32 * Math.sin(u * PI);
  } else {
    hintHand.position.y += 0.28 - 0.25 * Math.sin(smooth(0.11, 0.71, phase) * PI);
  }
  hintHand.position.z += 0.04;
  hintHand.rotation.set(-0.24, 0.38, -0.17);
  hintHand.scale.setScalar(portrait ? 1.02 : 1.15);
}
// Keep only the handle itself warm when it is the next object to touch.
handleLoop.material = brass.clone();

function advance(dt) {
  now += dt;
  if (started) played += dt;
  timeU.value = now;
  viewBlend = clamp(viewBlend + (windowView ? 1 : -1) * dt / 0.98, 0, 1);
  for (const impact of dimples.value) impact.z *= Math.exp(-dt * 8);
  updatePorts(dt);
  updateNet(dt);
  followDrag(dt);
  updateFish(dt);
  updateBird(dt);
  effects(dt);
}
let prev = 0, acc = 0;

function frame(stamp) {
  const delta = prev ? Math.min(0.09, (stamp - prev) / 1e3) : 1 / 60;
  prev = stamp;
  acc += Math.max(0, delta);
  while (acc >= 1 / 60) {
    advance(1 / 60);
    acc -= 1 / 60;
  }
  setCamera();
  guide();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// Combine stationary fittings that share a finish; the moving hinges and controls keep their pivots.

function batchFittings(parent, skip = new Set()) {
  const sets = new Map();
  for (const mesh2 of parent.children) {
    if (!mesh2.isMesh || skip.has(mesh2) || !mesh2.visible || mesh2.material.transparent) continue;
    const key = [mesh2.material.uuid, mesh2.castShadow, mesh2.receiveShadow].join("/");
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(mesh2);
  }
  for (const parts of sets.values()) {
    if (parts.length < 3) continue;
    const positions = [], normals = [], uvs = [], colors = [], indices = [];
    for (const part of parts) {
      part.updateMatrix();
      const geo = part.geometry, attr = geo.attributes;
      const offset = positions.length / 3, normalMatrix = new T.Matrix3().getNormalMatrix(part.matrix);
      const point = V();
      for (let i = 0; i < attr.position.count; i++) {
        point.fromBufferAttribute(attr.position, i).applyMatrix4(part.matrix);
        positions.push(point.x, point.y, point.z);
        point.fromBufferAttribute(attr.normal, i).applyNormalMatrix(normalMatrix);
        normals.push(point.x, point.y, point.z);
        if (attr.uv) uvs.push(attr.uv.getX(i), attr.uv.getY(i));
        if (attr.color) colors.push(attr.color.getX(i), attr.color.getY(i), attr.color.getZ(i));
      }
      const idx = geo.index;
      for (let i = 0; i < (idx?.count ?? attr.position.count); i++) indices.push(offset + (idx ? idx.getX(i) : i));
      part.visible = false;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    if (uvs.length === positions.length / 3 * 2) geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    if (colors.length === positions.length) geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    const combined = new T.Mesh(geometry, parts[0].material);
    combined.castShadow = parts[0].castShadow;
    combined.receiveShadow = parts[0].receiveShadow;
    parent.add(combined);
  }
}
batchFittings(scene, new Set([rimCue, ...lines.map((line) => line.o)]));
for (const p of ports) {
  batchFittings(p.g, new Set(p.dividers));
  batchFittings(p.board);
}
for (const fish of fishList) batchFittings(fish.o);
batchFittings(head);
for (const foot of feet) batchFittings(foot);
resize();
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  prev = 0;
  acc = 0;
});
requestAnimationFrame(frame);
