(function (global) {
  'use strict';

  const M = global.OtterModels;
  const Storage = global.OtterStorage;
  const AudioEngine = global.OtterAudio;
  const HintOverlay = global.FingerHint;

  // =========================================================================
  // Math & Helpers
  // =========================================================================
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(cur, tgt, lambda, dt) { return lerp(cur, tgt, 1 - Math.exp(-lambda * dt)); }
  function angleDiff(a, b) {
    let d = (b - a + Math.PI) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    return d - Math.PI;
  }
  function dampAngle(cur, tgt, lambda, dt) {
    return cur + angleDiff(cur, tgt) * (1 - Math.exp(-lambda * dt));
  }

  const KELP_POS = { x: -1.16, z: -0.36 };
  const KELP_BABY_SPOT = { x: -0.88, z: -0.28 };
  const ROCK_SPOT = { x: 0.96, y: 0.16, z: -1.16 };
  const ROCK_COVE_START = { x: 1.95, y: -0.05, z: -2.02 };
  const FLOOR_Y = -1.21;
  const RIM_Y = 0.18;

  // =========================================================================
  // Scene, Renderer & Lighting
  // =========================================================================
  const canvas = document.getElementById('stage');
  const hintCanvas = document.getElementById('hint-canvas');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const surfaceFogColor = new THREE.Color('#bce2e4');
  const underFogColor = new THREE.Color('#6db8bd');
  scene.fog = new THREE.Fog(surfaceFogColor.clone(), 9.5, 25);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.08, 60);

  // Sunny bright daytime aquarium lighting (warm daylight key + bright aqua fill + soft wet-fur rim)
  const hemiLight = new THREE.HemisphereLight('#e5f7fa', '#8cc2c2', 1.25);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#fff8eb', 2.05);
  sunLight.position.set(3.2, 7.6, 3.8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1.0;
  sunLight.shadow.camera.far = 18.0;
  sunLight.shadow.camera.left = -4.2;
  sunLight.shadow.camera.right = 4.2;
  sunLight.shadow.camera.top = 4.2;
  sunLight.shadow.camera.bottom = -4.2;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight);

  // Gentle back-side daylight bounce for soft wet-fur specular glow
  const rimLight = new THREE.DirectionalLight('#dff6f5', 0.65);
  rimLight.position.set(-3.5, 3.2, -3.5);
  scene.add(rimLight);

  // =========================================================================
  // Audio, Storage & Environment
  // =========================================================================
  const audio = new AudioEngine();
  const hint = new HintOverlay(hintCanvas);
  const saved = Storage.load();

  const env = M.createAquariumEnvironment(scene);
  const kelpBed = M.createKelpBed(KELP_POS.x, KELP_POS.z);
  scene.add(kelpBed.group);

  // Bucket on the front pool rim
  const bucketObj = M.createBucketMesh();
  scene.add(bucketObj.group);

  // Subtle highlight glow ring on water when dragging a shell above the pool
  const dropPreviewRing = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.115, 28),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  dropPreviewRing.rotation.x = -Math.PI * 0.5;
  dropPreviewRing.position.y = 0.015;
  dropPreviewRing.visible = false;
  scene.add(dropPreviewRing);

  // =========================================================================
  // Particle Pools (Splash droplets, surface foam rings, underwater bubbles)
  // =========================================================================
  const droplets = [];
  const dropletGeo = new THREE.SphereGeometry(0.017, 7, 6);
  const dropletMat = new THREE.MeshPhysicalMaterial({
    color: '#e8fafc',
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85
  });
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(dropletGeo, dropletMat);
    m.visible = false;
    scene.add(m);
    droplets.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.6 });
  }

  function spawnSplashDroplets(x, z, intensity = 0.6) {
    const count = Math.floor(6 + intensity * 14);
    let spawned = 0;
    for (let i = 0; i < droplets.length && spawned < count; i++) {
      const d = droplets[i];
      if (d.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * (0.65 + intensity * 0.75);
      d.mesh.position.set(x + Math.cos(a) * 0.04, 0.03, z + Math.sin(a) * 0.04);
      d.vx = Math.cos(a) * spd;
      d.vy = (1.05 + Math.random() * 1.45) * (0.55 + intensity * 0.85);
      d.vz = Math.sin(a) * spd;
      d.maxLife = 0.42 + Math.random() * 0.28;
      d.life = d.maxLife;
      d.mesh.scale.setScalar(0.55 + Math.random() * 0.85);
      d.mesh.visible = true;
      spawned++;
    }
  }

  const bubbles = [];
  const bubbleGeo = new THREE.SphereGeometry(0.018, 8, 7);
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: '#eefcff',
    roughness: 0.05,
    metalness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.62
  });
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(bubbleGeo, bubbleMat);
    m.visible = false;
    scene.add(m);
    bubbles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, phase: Math.random() * 6 });
  }

  function spawnBubbles(x, y, z, count = 4, spread = 0.14) {
    let spawned = 0;
    for (let i = 0; i < bubbles.length && spawned < count; i++) {
      const b = bubbles[i];
      if (b.life > 0) continue;
      b.mesh.position.set(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread * 0.5,
        z + (Math.random() - 0.5) * spread
      );
      b.vx = (Math.random() - 0.5) * 0.12;
      b.vy = 0.32 + Math.random() * 0.34;
      b.vz = (Math.random() - 0.5) * 0.12;
      b.life = 1.2 + Math.random() * 1.1;
      b.mesh.scale.setScalar(0.45 + Math.random() * 1.15);
      b.mesh.visible = true;
      spawned++;
    }
  }

  // =========================================================================
  // Otters (Mother, Baby, Second Adult on Rock — max 3!)
  // =========================================================================
  const momRig = M.createOtterRig({ isBaby: false, variant: 'mom' });
  scene.add(momRig.root);

  const babyRig = M.createOtterRig({ isBaby: true, variant: 'baby' });
  scene.add(babyRig.root);

  const rockRig = M.createOtterRig({ isBaby: false, variant: 'rock' });
  scene.add(rockRig.root);

  // Flat round stone (interactive!)
  const stoneMesh = M.createFlatStoneMesh();
  const stoneHitSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  stoneHitSphere.userData.isStoneHit = true;
  stoneMesh.add(stoneHitSphere);
  scene.add(stoneMesh);

  // Subtle sunlit shimmer halo for the ONE currently guided world object
  const highlightHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshBasicMaterial({
      color: '#fff8dc',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(highlightHalo);

  // =========================================================================
  // Game World State
  // =========================================================================
  const world = {
    time: 0,
    playTime: saved.playTime || 0,
    napCount: saved.napCount || 0,
    idleTime: 0,
    lastSaveTime: 0,
    hasInteracted: false,

    cameraStage: saved.cameraStage || 'diagonal', // 'diagonal' | 'low'
    underwaterBlend: 0,
    lowViewBlend: saved.cameraStage === 'low' ? 1 : 0,
    warmthBlend: saved.mom.sleeping ? 0.65 : 0,

    scallopUnlocked: saved.scallopUnlocked || false,
    scallopDroppedOnce: saved.dropHistory.some(d => d.type === 'scallop'),
    rockOtterUnlocked: saved.rockOtterUnlocked || false,

    dropHistory: saved.dropHistory || [],

    // Mother otter
    mom: {
      x: saved.mom.x,
      y: -0.02,
      z: saved.mom.z,
      yaw: saved.mom.yaw,
      roll: 0,       // 0 = on back, PI = face down diving
      pitch: 0,
      state: saved.mom.sleeping ? 'sleep' : 'idle',
      stateTime: 0,
      idleSub: 'float', // 'float' | 'face_rub' | 'groom_roll' | 'paddle_drift'
      idleSubTimer: 3.5,
      hasStone: saved.mom.hasStone,
      fedCount: saved.mom.fedCount,
      crackedCount: saved.mom.crackedCount,
      sharedCount: saved.mom.sharedCount,
      kelpWrapped: saved.mom.kelpWrapped,
      sleeping: saved.mom.sleeping,
      eyesClosed: saved.mom.sleeping ? 1 : 0,
      blinkTimer: 2.8,

      targetShell: null,
      heldShell: null,       // { type, mesh }
      heldMeat: null,        // { mesh, isScallop, timer }
      tapCount: 0,
      tapPhase: 0,
      chewTimer: 0,
      groomRollAngle: 0,
      lookTarget: new THREE.Vector3(0, 0.2, 1.5),
      diveStartPos: new THREE.Vector3(),
      diveDepth: 0
    },

    // Baby otter
    baby: {
      carrier: saved.baby.carrier || 'mom', // 'mom' | 'kelp'
      x: saved.mom.x,
      y: 0.16,
      z: saved.mom.z,
      yaw: saved.mom.yaw,
      yawnTimer: 6.0,
      yawnProgress: 0,
      eatTimer: 0,
      eatMeatMesh: null,
      eyesClosed: saved.mom.sleeping ? 1 : 0,
      wakeStretch: 0
    },

    // Second adult otter on rock
    rockOtter: {
      active: saved.rockOtter.active || false,
      x: saved.rockOtter.active ? saved.rockOtter.x : ROCK_COVE_START.x,
      y: saved.rockOtter.active ? ROCK_SPOT.y : ROCK_COVE_START.y,
      z: saved.rockOtter.active ? saved.rockOtter.z : ROCK_COVE_START.z,
      yaw: saved.rockOtter.yaw || -2.45,
      roll: 0,
      state: saved.rockOtter.active
        ? (saved.rockOtter.sleeping ? 'sleep' : 'lounge')
        : 'hidden',
      stateTime: 0,
      fedCount: saved.rockOtter.fedCount || 0,
      sleeping: saved.rockOtter.sleeping || false,
      waitBias: saved.rockOtter.waitBias || 0,
      eyesClosed: saved.rockOtter.sleeping ? 1 : 0,
      targetShell: null,
      heldShell: null,
      tapCount: 0,
      tapPhase: 0,
      chewTimer: 0
    },

    // Flat stone
    stone: {
      location: saved.stone.location || 'bottom', // 'bottom' | 'dragging' | 'falling' | 'mom_belly'
      x: saved.stone.x,
      y: saved.stone.location === 'bottom' ? FLOOR_Y : saved.stone.y,
      z: saved.stone.z,
      vy: 0
    },

    // Bucket shells
    bucketShells: [], // array of { type, mesh, slotIdx }
    // Active shells in air / sinking in water / waiting on bottom or rock
    activeShells: [],
    // Cracked half-shells (sinking or resting on sand / floating on surface)
    crackedShells: []
  };

  // Sync kelp wrap visibility from saved state
  momRig.kelpWrapGroup.visible = world.mom.kelpWrapped;
  rockRig.root.visible = world.rockOtter.active;

  // =========================================================================
  // Bucket Shell Slots & Creation
  // =========================================================================
  const BUCKET_SLOTS = [
    { x: -0.075, y: 0.085, z: -0.055, ry: 0.4, rx: 0.2 },
    { x:  0.075, y: 0.088, z: -0.045, ry: -0.7, rx: -0.15 },
    { x: -0.015, y: 0.092, z:  0.068, ry: 1.2, rx: 0.12 },
    { x: -0.068, y: 0.145, z:  0.015, ry: 2.1, rx: -0.25 },
    { x:  0.055, y: 0.152, z:  0.025, ry: -1.6, rx: 0.22 },
    { x:  0.005, y: 0.195, z: -0.015, ry: 0.85, rx: 0.08 },
    { x: -0.025, y: 0.175, z: -0.040, ry: -0.35, rx: -0.12 }
  ];

  function createShellEntity(type) {
    const mesh = type === 'scallop' ? M.createScallopMesh() : M.createClamMesh();
    // Generous invisible touch sphere for 5-year-old fingers
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(type === 'scallop' ? 0.13 : 0.095, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData.isShellHit = true;
    mesh.add(hit);
    return mesh;
  }

  function addShellToBucket(type) {
    if (world.bucketShells.length >= BUCKET_SLOTS.length) return null;
    const usedSlots = new Set(world.bucketShells.map(s => s.slotIdx));
    let slotIdx = 0;
    for (let i = 0; i < BUCKET_SLOTS.length; i++) {
      if (!usedSlots.has(i)) { slotIdx = i; break; }
    }
    const slot = BUCKET_SLOTS[slotIdx];
    const mesh = createShellEntity(type);
    mesh.position.set(slot.x, slot.y, slot.z);
    mesh.rotation.set(slot.rx, slot.ry, 0);
    mesh.userData.bucketShellRef = null;
    bucketObj.group.add(mesh);

    const entry = { type, mesh, slotIdx };
    mesh.userData.bucketShellRef = entry;
    world.bucketShells.push(entry);
    return entry;
  }

  function ensureBucketStock(forceScallop = false) {
    const desired = 5;
    while (world.bucketShells.length < desired) {
      const hasScallop = world.bucketShells.some(s => s.type === 'scallop');
      const wantScallop = (world.scallopUnlocked || forceScallop) &&
        (!hasScallop || (world.bucketShells.length === desired - 1 && Math.random() < 0.45));
      addShellToBucket(wantScallop ? 'scallop' : 'clam');
    }
    if ((world.scallopUnlocked || forceScallop) && !world.bucketShells.some(s => s.type === 'scallop')) {
      // Replace one top clam with a scallop so it's clearly visible!
      if (world.bucketShells.length >= BUCKET_SLOTS.length) {
        const last = world.bucketShells.pop();
        bucketObj.group.remove(last.mesh);
      }
      addShellToBucket('scallop');
    }
  }

  // Populate initial bucket from saved state
  (saved.bucketShells || ['clam', 'clam', 'clam', 'clam', 'clam']).forEach(t => addShellToBucket(t));
  ensureBucketStock(world.scallopUnlocked);

  // Restore saved cracked shell halves
  function spawnCrackedHalf(type, x, y, z, ry, floating, settled = false) {
    const mesh = M.createShellHalfMesh(type);
    mesh.position.set(x, y, z);
    mesh.rotation.set(floating ? Math.PI : (Math.random() - 0.5) * 0.5, ry, (Math.random() - 0.5) * 0.4);
    scene.add(mesh);

    const item = {
      type,
      mesh,
      x, y, z,
      vx: settled ? 0 : (Math.random() - 0.5) * 0.35,
      vy: settled ? 0 : (floating ? 0.02 : -0.18 - Math.random() * 0.12),
      vz: settled ? 0 : (Math.random() - 0.5) * 0.35,
      ry,
      phase: Math.random() * 6.28,
      floating,
      settled
    };
    world.crackedShells.push(item);

    // Cap total cracked halves for silky 60fps
    while (world.crackedShells.length > 36) {
      const oldest = world.crackedShells.shift();
      scene.remove(oldest.mesh);
    }
    return item;
  }

  (saved.crackedShells || []).forEach(c => {
    spawnCrackedHalf(c.type, c.x, c.floating ? -0.008 : FLOOR_Y, c.z, c.ry, c.floating, true);
  });

  // =========================================================================
  // Responsive Camera & Foreground Bucket Framing (iPhone 390x844 & iPad 1180x820)
  // =========================================================================
  const camState = {
    pos: new THREE.Vector3(0, 2.4, 3.5),
    target: new THREE.Vector3(0, -0.08, 0.25),
    fov: 42
  };

  function getAspectMetrics() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);
    // portraitT = 1 for narrow portrait (~0.46), 0 for wide landscape (~1.44+)
    const portraitT = clamp((1.12 - aspect) / (1.12 - 0.46), 0, 1);
    return { w, h, aspect, portraitT };
  }

  function updateBucketPlacement() {
    const { portraitT } = getAspectMetrics();
    // Place bucket naturally on the sunlit front coping rim so it fits cleanly in BOTH portrait & landscape
    const bx = lerp(-1.02, -0.44, portraitT);
    const bz = lerp(1.96, 1.96, portraitT);
    bucketObj.group.position.set(bx, RIM_Y, bz);
  }
  updateBucketPlacement();

  function computeDesiredCamera(t) {
    const { portraitT } = getAspectMetrics();

    // 1. Opening Diagonal View (all key elements framed cleanly on frame 1!)
    const diagPos = new THREE.Vector3(
      lerp(-0.04, -0.02, portraitT),
      lerp(2.38, 2.75, portraitT),
      lerp(3.56, 4.05, portraitT)
    );
    const diagTarget = new THREE.Vector3(
      lerp(0.02, 0.02, portraitT),
      lerp(-0.18, -0.15, portraitT),
      lerp(0.42, 0.45, portraitT)
    );
    const diagFov = lerp(40, 52, portraitT);

    // 2. Low Water-Level Eye Line View (~3-4 min)
    const lowPos = new THREE.Vector3(
      lerp(0.14, 0.08, portraitT),
      lerp(0.60, 0.76, portraitT),
      lerp(3.12, 3.38, portraitT)
    );
    const lowTarget = new THREE.Vector3(
      lerp(world.mom.x * 0.30, world.mom.x * 0.22, portraitT),
      0.02,
      lerp(0.32, 0.38, portraitT)
    );
    const lowFov = lerp(38, 50, portraitT);

    // Blend surface view between diagonal and low
    const surfPos = diagPos.clone().lerp(lowPos, world.lowViewBlend);
    const surfTarget = diagTarget.clone().lerp(lowTarget, world.lowViewBlend);
    const surfFov = lerp(diagFov, lowFov, world.lowViewBlend);

    // 3. Underwater Side Chase View (when mother dives for a scallop!)
    const underPos = new THREE.Vector3(
      clamp(world.mom.x * 0.42 + 0.15, -0.9, 0.9),
      -0.58,
      lerp(2.42, 2.86, portraitT)
    );
    const underTarget = new THREE.Vector3(
      clamp(world.mom.x * 0.72, -1.1, 1.1),
      clamp(world.mom.y * 0.75 - 0.10, -0.95, -0.28),
      clamp(world.mom.z * 0.55, -0.8, 0.6)
    );
    const underFov = lerp(44, 54, portraitT);

    const pos = surfPos.lerp(underPos, world.underwaterBlend);
    const target = surfTarget.lerp(underTarget, world.underwaterBlend);
    const fov = lerp(surfFov, underFov, world.underwaterBlend);

    // Subtle organic breathing sway
    pos.x += Math.sin(t * 0.35) * 0.015;
    pos.y += Math.cos(t * 0.45) * 0.01;

    return { pos, target, fov };
  }

  // Initialize camera immediately for crisp first frame
  {
    const initCam = computeDesiredCamera(0);
    camState.pos.copy(initCam.pos);
    camState.target.copy(initCam.target);
    camState.fov = initCam.fov;
    camera.fov = camState.fov;
    camera.position.copy(camState.pos);
    camera.lookAt(camState.target);
    camera.updateProjectionMatrix();
  }

  function onResize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
    updateBucketPlacement();
    hint.resize();
  }
  window.addEventListener('resize', onResize);

  // =========================================================================
  // Spatial Memory Helper
  // =========================================================================
  function getPreferredWaterSpot() {
    const waterDrops = world.dropHistory.filter(d => d.zone === 'water').slice(-8);
    if (waterDrops.length === 0) return { x: -0.10, z: 0.18 };
    let sx = 0, sz = 0, sw = 0;
    waterDrops.forEach((d, idx) => {
      const w = 1 + idx * 0.35;
      sx += d.x * w;
      sz += d.z * w;
      sw += w;
    });
    return {
      x: clamp(sx / sw, -1.05, 0.85),
      z: clamp(sz / sw, -0.55, 0.72)
    };
  }

  function recordDrop(x, z, zone, type) {
    world.dropHistory.push({ x, z, zone, type });
    if (world.dropHistory.length > 24) world.dropHistory.shift();
    if (type === 'scallop') world.scallopDroppedOnce = true;
    saveNow();
  }

  function isRockDropZone(x, z) {
    if (!world.rockOtter.active) return false;
    const dx = x - ROCK_SPOT.x;
    const dz = z - ROCK_SPOT.z;
    return Math.hypot(dx, dz) < 0.88 || (x > 0.45 && z < -0.52);
  }

  // =========================================================================
  // Persistence Helper
  // =========================================================================
  function buildSavePayload() {
    return {
      playTime: world.playTime,
      napCount: world.napCount,
      cameraStage: world.cameraStage,
      scallopUnlocked: world.scallopUnlocked,
      rockOtterUnlocked: world.rockOtterUnlocked,
      mom: {
        x: world.mom.x,
        z: world.mom.z,
        yaw: world.mom.yaw,
        hasStone: world.mom.hasStone,
        fedCount: world.mom.fedCount,
        crackedCount: world.mom.crackedCount,
        sharedCount: world.mom.sharedCount,
        kelpWrapped: world.mom.kelpWrapped,
        sleeping: world.mom.sleeping
      },
      baby: {
        carrier: world.baby.carrier
      },
      rockOtter: {
        active: world.rockOtter.active,
        x: world.rockOtter.x,
        z: world.rockOtter.z,
        yaw: world.rockOtter.yaw,
        fedCount: world.rockOtter.fedCount,
        sleeping: world.rockOtter.sleeping,
        waitBias: world.rockOtter.waitBias
      },
      stone: {
        location: world.stone.location === 'mom_belly' ? 'mom_belly' : 'bottom',
        x: world.stone.location === 'bottom' ? world.stone.x : 0.56,
        y: FLOOR_Y,
        z: world.stone.location === 'bottom' ? world.stone.z : 0.12
      },
      bucketShells: world.bucketShells.map(s => s.type),
      crackedShells: world.crackedShells.slice(-36).map(c => ({
        type: c.type,
        x: c.x,
        y: c.y,
        z: c.z,
        ry: c.ry,
        floating: c.floating
      })),
      dropHistory: world.dropHistory
    };
  }

  function saveNow() {
    Storage.save(buildSavePayload());
    world.lastSaveTime = world.time;
  }

  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });

  // =========================================================================
  // Dropping & Spawning Active Shells
  // =========================================================================
  function releaseShellIntoWorld(type, startPos, targetHintPos = null) {
    const mesh = type === 'scallop' ? M.createScallopMesh() : M.createClamMesh();
    mesh.position.copy(startPos);
    mesh.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
    scene.add(mesh);

    const dropHeight = Math.max(0.08, startPos.y);
    let vx = 0, vy = -0.15, vz = 0;

    if (targetHintPos) {
      // Gentle toss arc on quick tap
      const flightTime = 0.46;
      vx = (targetHintPos.x - startPos.x) / flightTime;
      vz = (targetHintPos.z - startPos.z) / flightTime;
      vy = (0.04 - startPos.y + 0.5 * 5.2 * flightTime * flightTime) / flightTime;
    }

    const shellObj = {
      id: Math.random().toString(36).slice(2),
      type,
      mesh,
      phase: 'air', // 'air' | 'sinking' | 'bottom' | 'rock_landed' | 'claimed'
      x: startPos.x,
      y: startPos.y,
      z: startPos.z,
      vx, vy, vz,
      dropHeight,
      wobblePhase: Math.random() * 6.28,
      age: 0,
      zone: 'water',
      claimedBy: null
    };
    world.activeShells.push(shellObj);
    return shellObj;
  }

  // =========================================================================
  // Single-Finger Pointer Input (Tap & Drag Only, Interactive World Objects Only!)
  // =========================================================================
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  const drag = {
    kind: null, // 'shell' | 'stone'
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    shellType: null,
    bucketEntry: null,
    heldMesh: null,
    worldPos: new THREE.Vector3()
  };

  function setPointerNDC(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Map pointer ray to an intuitive 3D drag point over the pool (higher on screen = higher drop!)
  function computeShellDragPosition(clientX, clientY) {
    setPointerNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);

    // Intersect a gentle water plane to get X/Z aim
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(waterPlane, hit)) {
      hit.set(0, 0, 0.2);
    }

    // Clamp cleanly to playable pool + rock ledge area
    hit.x = clamp(hit.x, -1.65, 1.55);
    hit.z = clamp(hit.z, -1.65, 2.02);

    // Height varies naturally with screen vertical lift (allows low gentle drops OR high splashy drops!)
    const screenUp = clamp((pointerNDC.y + 0.85) / 1.55, 0, 1);
    const y = lerp(0.14, 1.18, Math.pow(screenUp, 1.15));
    // Keep slightly above bucket rim if still over rim
    const overRim = hit.z > 1.70;
    return new THREE.Vector3(hit.x, overRim ? Math.max(0.55, y) : y, hit.z);
  }

  function computeStoneDragPosition(clientX, clientY) {
    setPointerNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);

    // Drag along a gently inclined vertical-ish plane passing near the stone/mom
    const normal = new THREE.Vector3(0, 0.35, 1).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      new THREE.Vector3(world.mom.x, -0.45, Math.max(0.2, world.mom.z))
    );
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) {
      hit.set(world.stone.x, -0.4, world.stone.z);
    }
    hit.x = clamp(hit.x, -1.35, 1.35);
    hit.y = clamp(hit.y, FLOOR_Y, 0.42);
    hit.z = clamp(hit.z, -0.65, 1.25);
    return hit;
  }

  function wakeFromNap() {
    world.mom.sleeping = false;
    world.mom.kelpWrapped = false;
    world.mom.state = 'idle';
    world.mom.stateTime = 0;
    world.mom.idleSub = 'float';
    world.mom.idleSubTimer = 2.8;
    momRig.kelpWrapGroup.visible = false;

    world.baby.carrier = 'mom';
    world.baby.wakeStretch = 1.0;
    world.baby.yawnProgress = 0.01;

    if (world.rockOtter.active) {
      world.rockOtter.sleeping = false;
      world.rockOtter.state = 'lounge';
      world.rockOtter.stateTime = 0;
    }

    world.napCount += 1;
    world.playTime = 140; // Keep mid-late discoveries alive for the new calm cycle
    world.mom.fedCount = 2; // Refresh gentle appetite while keeping memory
    ensureBucketStock(world.scallopUnlocked);
    audio.playWaterStir(0.12);
    env.addRipple(world.mom.x, world.mom.z, world.time, 0.45);
    saveNow();
  }

  function onPointerDown(e) {
    if (drag.pointerId !== null) return; // Single-finger only!
    audio.unlock();
    world.idleTime = 0;
    world.hasInteracted = true;

    setPointerNDC(e.clientX, e.clientY);
    raycaster.setFromCamera(pointerNDC, camera);

    // 1. Check bucket shells & bucket hit area
    const bucketTargets = [];
    world.bucketShells.forEach(s => bucketTargets.push(s.mesh));
    bucketTargets.push(bucketObj.hitArea);
    const bucketHits = raycaster.intersectObjects(bucketTargets, true);

    if (bucketHits.length > 0) {
      // If otters are sleeping, touching the bucket gently wakes them up!
      if (world.mom.sleeping) {
        wakeFromNap();
        return;
      }

      // Find the tapped shell, or pick the topmost shell in the bucket
      let chosen = null;
      for (const h of bucketHits) {
        let obj = h.object;
        while (obj && obj !== bucketObj.group) {
          if (obj.userData && obj.userData.bucketShellRef) {
            chosen = obj.userData.bucketShellRef;
            break;
          }
          obj = obj.parent;
        }
        if (chosen) break;
      }
      if (!chosen && world.bucketShells.length > 0) {
        // Prefer scallop if unlocked & child taps near top, else topmost shell
        chosen = world.bucketShells[world.bucketShells.length - 1];
      }
      if (!chosen) return;

      // Remove from bucket and attach to active drag
      const idx = world.bucketShells.indexOf(chosen);
      if (idx >= 0) world.bucketShells.splice(idx, 1);
      bucketObj.group.remove(chosen.mesh);

      const heldMesh = chosen.type === 'scallop' ? M.createScallopMesh() : M.createClamMesh();
      const wp = new THREE.Vector3();
      bucketObj.group.getWorldPosition(wp);
      wp.y += 0.34;
      heldMesh.position.copy(wp);
      scene.add(heldMesh);

      drag.kind = 'shell';
      drag.pointerId = e.pointerId;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.moved = false;
      drag.shellType = chosen.type;
      drag.heldMesh = heldMesh;
      drag.worldPos.copy(wp);

      audio.playPickup(chosen.type === 'scallop');
      // Immediate visible response on first touch: mother lifts her gaze & gives a soft paw wave!
      world.mom.lookTarget.copy(wp);
      if (world.mom.state === 'idle' && world.mom.idleSub === 'float') {
        world.mom.idleSubTimer = Math.min(world.mom.idleSubTimer, 0.5);
      }

      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    // 2. Check flat stone on the sandy floor (when not yet on mom's belly and not sleeping)
    if (!world.mom.sleeping && world.stone.location === 'bottom') {
      const stoneHits = raycaster.intersectObject(stoneMesh, true);
      if (stoneHits.length > 0) {
        drag.kind = 'stone';
        drag.pointerId = e.pointerId;
        drag.startX = e.clientX;
        drag.startY = e.clientY;
        drag.moved = false;
        world.stone.location = 'dragging';
        world.stone.vy = 0;

        audio.playWaterStir(0.11);
        spawnBubbles(world.stone.x, world.stone.y + 0.08, world.stone.z, 6, 0.16);
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }
    }

    // 3. Bonus responsive tap on mom's held shell while on her belly -> immediate crisp knock!
    if (!world.mom.sleeping && world.mom.heldShell && (world.mom.state === 'hold_shell' || world.mom.state === 'crack_shell')) {
      const shellHits = raycaster.intersectObject(world.mom.heldShell.mesh, true);
      if (shellHits.length > 0) {
        if (world.mom.hasStone) {
          world.mom.state = 'crack_shell';
          world.mom.tapPhase = 0.85; // Triggers crisp tap right away
        } else {
          audio.playWaterStir(0.06);
          world.mom.tapPhase = 0.9;
        }
      }
    }
  }

  function onPointerMove(e) {
    if (drag.pointerId !== e.pointerId || !drag.kind) return;
    world.idleTime = 0;

    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 16) {
      drag.moved = true;
    }

    if (drag.kind === 'shell' && drag.heldMesh) {
      const pos = computeShellDragPosition(e.clientX, e.clientY);
      drag.worldPos.copy(pos);
      drag.heldMesh.position.lerp(pos, 0.55);
      drag.heldMesh.rotation.y += 0.04;
      world.mom.lookTarget.copy(pos);

      const overWater = pos.z < 1.68;
      dropPreviewRing.visible = overWater;
      if (overWater) {
        dropPreviewRing.position.set(pos.x, 0.018, pos.z);
        const s = lerp(0.75, 1.45, clamp((pos.y - 0.15) / 1.0, 0, 1));
        dropPreviewRing.scale.setScalar(s);
      }
    } else if (drag.kind === 'stone') {
      const pos = computeStoneDragPosition(e.clientX, e.clientY);
      world.stone.x = lerp(world.stone.x, pos.x, 0.45);
      world.stone.y = lerp(world.stone.y, pos.y, 0.45);
      world.stone.z = lerp(world.stone.z, pos.z, 0.45);
      if (Math.random() < 0.25 && world.stone.y < -0.05) {
        spawnBubbles(world.stone.x, world.stone.y, world.stone.z, 1, 0.1);
      }
    }
  }

  function onPointerUp(e) {
    if (drag.pointerId !== e.pointerId || !drag.kind) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

    if (drag.kind === 'shell') {
      dropPreviewRing.visible = false;
      const type = drag.shellType;
      const startPos = drag.heldMesh.position.clone();
      scene.remove(drag.heldMesh);
      drag.heldMesh = null;

      if (!drag.moved) {
        // Quick tap on bucket clam/scallop -> gentle arc drop right into open water near mom!
        const pref = getPreferredWaterSpot();
        const dropX = clamp(world.mom.x + (Math.random() - 0.5) * 0.42, -0.9, 0.8);
        const dropZ = clamp(lerp(world.mom.z, pref.z, 0.35) + 0.32, -0.3, 0.95);
        releaseShellIntoWorld(type, startPos, new THREE.Vector3(dropX, 0, dropZ));
      } else if (startPos.z > 1.70) {
        // Released back over the bucket rim -> return to bucket gently
        addShellToBucket(type);
      } else {
        // Dropped from dragged position & height!
        releaseShellIntoWorld(type, startPos, null);
      }

      // Gently refill bucket when running low
      setTimeout(() => ensureBucketStock(world.scallopUnlocked), 700);
    } else if (drag.kind === 'stone') {
      const distToMom = Math.hypot(world.stone.x - world.mom.x, world.stone.z - world.mom.z);
      const liftedHighEnough = world.stone.y > -0.62 || distToMom < 0.92;

      if (drag.moved && liftedHighEnough) {
        // Give stone to mother otter!
        world.stone.location = 'mom_belly';
        world.mom.hasStone = true;
        audio.playStonePlace();
        env.addRipple(world.mom.x, world.mom.z, world.time, 0.42);
        spawnBubbles(world.mom.x, -0.05, world.mom.z, 5, 0.22);

        // If mom was holding a shell waiting for the stone, immediately start cracking!
        if (world.mom.heldShell && world.mom.state === 'hold_shell') {
          world.mom.state = 'crack_shell';
          world.mom.stateTime = 0;
          world.mom.tapCount = 0;
          world.mom.tapPhase = 0.2;
        }
        saveNow();
      } else if (!drag.moved) {
        // Gentle tap on sunken stone -> buoyantly nudges upward slightly with bubbles to teach dragging!
        world.stone.location = 'falling';
        world.stone.vy = 0.95;
        audio.playWaterStir(0.09);
        spawnBubbles(world.stone.x, world.stone.y + 0.1, world.stone.z, 7, 0.18);
      } else {
        // Dropped deep -> sinks gently back onto sandy floor
        world.stone.location = 'falling';
        world.stone.vy = -0.1;
      }
    }

    drag.kind = null;
    drag.pointerId = null;
    drag.shellType = null;
    drag.moved = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // =========================================================================
  // Active Shell Physics (Splashes, Clam fast-wobble vs Scallop flutter-glide)
  // =========================================================================
  function updateActiveShells(dt) {
    for (let i = world.activeShells.length - 1; i >= 0; i--) {
      const s = world.activeShells[i];
      s.age += dt;

      if (s.phase === 'air') {
        s.vy -= 5.2 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.mesh.rotation.x += dt * 1.4;
        s.mesh.rotation.z += dt * 0.9;

        // Check if landed directly onto the sunlit rock ledge for the 2nd otter!
        const overRockTop = world.rockOtter.active &&
          Math.hypot(s.x - ROCK_SPOT.x, s.z - ROCK_SPOT.z) < 0.62 &&
          s.y <= ROCK_SPOT.y + 0.04;

        if (overRockTop) {
          s.y = ROCK_SPOT.y + 0.04;
          s.vx = s.vy = s.vz = 0;
          s.phase = 'rock_landed';
          s.zone = 'rock';
          audio.playStoneKnock(true);
          recordDrop(s.x, s.z, 'rock', s.type);
          notifyShellDropped(s);
        } else if (s.y <= 0.0) {
          // Splash into the water!
          s.y = 0.0;
          const impactSpeed = Math.abs(s.vy);
          const intensity = clamp((s.dropHeight * 0.72 + impactSpeed * 0.12), 0.16, 1.0);
          const isBig = s.type === 'scallop';

          audio.playSplash(intensity, isBig);
          env.addRipple(s.x, s.z, world.time, 0.35 + intensity * 0.85);
          spawnSplashDroplets(s.x, s.z, intensity);
          spawnBubbles(s.x, -0.05, s.z, Math.floor(3 + intensity * 5), 0.14);

          s.phase = 'sinking';
          s.vx *= 0.2;
          s.vz *= 0.2;
          s.vy = isBig ? -0.22 : -0.52;
          s.zone = isRockDropZone(s.x, s.z) ? 'rock' : 'water';
          recordDrop(s.x, s.z, s.zone, s.type);
          notifyShellDropped(s);
        }
      } else if (s.phase === 'sinking') {
        s.wobblePhase += dt * (s.type === 'scallop' ? 2.8 : 5.4);
        if (s.type === 'scallop') {
          // Flat scallop flutters and glides gracefully back and forth!
          const glide = Math.sin(s.wobblePhase);
          s.vx = glide * 0.38;
          s.vz = Math.cos(s.wobblePhase * 0.75) * 0.18;
          s.vy = lerp(s.vy, -0.24 - Math.abs(Math.cos(s.wobblePhase)) * 0.10, dt * 3.0);
          s.mesh.rotation.z = glide * 0.52;
          s.mesh.rotation.x = Math.cos(s.wobblePhase) * 0.28;
        } else {
          // Small dense clam sinks briskly with gentle wobble
          s.vx = Math.sin(s.wobblePhase) * 0.12;
          s.vz = Math.cos(s.wobblePhase * 0.8) * 0.08;
          s.vy = lerp(s.vy, -0.58, dt * 3.5);
          s.mesh.rotation.z = Math.sin(s.wobblePhase) * 0.32;
          s.mesh.rotation.x += dt * 0.8;
        }

        s.x = clamp(s.x + s.vx * dt, -2.0, 1.9);
        s.z = clamp(s.z + s.vz * dt, -1.7, 1.42);
        s.y += s.vy * dt;

        if (Math.random() < 0.12) {
          spawnBubbles(s.x, s.y + 0.04, s.z, 1, 0.06);
        }

        if (s.y <= FLOOR_Y + 0.03) {
          s.y = FLOOR_Y + 0.03;
          s.phase = 'bottom';
          s.mesh.rotation.x = 0.08;
          s.mesh.rotation.z = 0.05;
        }
      }

      if (s.phase !== 'claimed') {
        s.mesh.position.set(s.x, s.y, s.z);
      }

      // Clean up very old unclaimed bottom shells if too many accumulate
      if (s.phase === 'bottom' && s.age > 45 && !s.claimedBy) {
        scene.remove(s.mesh);
        world.activeShells.splice(i, 1);
      }
    }
  }

  // Trigger otter curiosity & baby-sharing immediately when a new shell splashes!
  function notifyShellDropped(shell) {
    // 1. If dropped near rock otter, let rock otter respond
    if (shell.zone === 'rock' && world.rockOtter.active && !world.rockOtter.sleeping) {
      if (world.rockOtter.state === 'lounge') {
        world.rockOtter.targetShell = shell;
        shell.claimedBy = 'rock';
        world.rockOtter.state = 'fetch_shell';
        world.rockOtter.stateTime = 0;
        world.rockOtter.waitBias = clamp(world.rockOtter.waitBias + 0.3, 0, 1);
      }
      return;
    }

    // 2. Otherwise it's in mother otter's water!
    if (world.mom.sleeping) return;

    // Look immediately toward the splash sound!
    world.mom.lookTarget.set(shell.x, 0.0, shell.z);

    // Discovery 2: If mom currently holds meat from cracking a shell and child drops ANOTHER shell,
    // she smoothly offers the meat piece to baby first (from her current posture!)
    if (world.mom.heldMeat && world.baby.carrier === 'mom' &&
        (world.mom.state === 'eat_shell' || world.mom.state === 'idle')) {
      world.mom.state = 'share_baby';
      world.mom.stateTime = 0;
      return;
    }

    // Mid-dive redirect: if mom is already diving underwater, she can curve toward a closer/fresher shell!
    if (world.mom.state === 'dive_underwater' && world.mom.targetShell) {
      const distOld = Math.hypot(world.mom.x - world.mom.targetShell.x, world.mom.z - world.mom.targetShell.z);
      const distNew = Math.hypot(world.mom.x - shell.x, world.mom.z - shell.z);
      if (distNew < distOld + 0.45 && shell.type === 'scallop' || distNew < distOld * 0.85) {
        world.mom.targetShell.claimedBy = null;
        world.mom.targetShell = shell;
        shell.claimedBy = 'mom';
      }
    }
  }

  // =========================================================================
  // Cracked Half-Shells Physics
  // =========================================================================
  function updateCrackedShells(dt, t) {
    for (let i = 0; i < world.crackedShells.length; i++) {
      const c = world.crackedShells[i];
      if (c.floating) {
        c.x = clamp(c.x + c.vx * dt, -1.9, 1.6);
        c.z = clamp(c.z + c.vz * dt, -1.5, 1.35);
        c.vx *= Math.exp(-1.4 * dt);
        c.vz *= Math.exp(-1.4 * dt);
        c.y = -0.008 + Math.sin(t * 1.6 + c.phase) * 0.010;
        c.mesh.position.set(c.x, c.y, c.z);
        c.mesh.rotation.x = Math.PI + Math.sin(t * 1.2 + c.phase) * 0.08;
        c.mesh.rotation.z = Math.cos(t * 1.1 + c.phase) * 0.08;
      } else if (!c.settled) {
        c.phase += dt * 3.8;
        c.x += (c.vx + Math.sin(c.phase) * 0.12) * dt;
        c.z += (c.vz + Math.cos(c.phase * 0.8) * 0.08) * dt;
        c.vx *= Math.exp(-1.6 * dt);
        c.vz *= Math.exp(-1.6 * dt);
        c.y += c.vy * dt;
        c.mesh.rotation.x += dt * 0.9;
        c.mesh.rotation.z = Math.sin(c.phase) * 0.45;
        if (c.y <= FLOOR_Y + 0.015) {
          c.y = FLOOR_Y + 0.015;
          c.settled = true;
          c.mesh.rotation.x = Math.random() > 0.5 ? 0.1 : Math.PI - 0.1;
          c.mesh.rotation.z = 0.05;
        }
        c.mesh.position.set(c.x, c.y, c.z);
      }
    }
  }

  // =========================================================================
  // Mother Otter State Machine & Natural Sea Otter Animation
  // =========================================================================
  function findBestWaterShell() {
    let best = null;
    let bestScore = Infinity;
    for (const s of world.activeShells) {
      if (s.zone !== 'water') continue;
      if (s.phase !== 'sinking' && s.phase !== 'bottom') continue;
      if (s.claimedBy && s.claimedBy !== 'mom') continue;
      const d = Math.hypot(s.x - world.mom.x, s.z - world.mom.z);
      // Prefer scallops slightly and fresher sinking shells
      const score = d - (s.type === 'scallop' ? 0.4 : 0) - (s.phase === 'sinking' ? 0.25 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  function releaseMomCrackedHalves(type) {
    const basePos = new THREE.Vector3();
    momRig.shellAnchor.getWorldPosition(basePos);
    const shouldFloatOne = Math.random() < 0.35;
    spawnCrackedHalf(type, basePos.x - 0.06, basePos.y, basePos.z, Math.random() * 6, shouldFloatOne, false);
    spawnCrackedHalf(type, basePos.x + 0.06, basePos.y, basePos.z, Math.random() * 6, false, false);
  }

  function updateMotherOtter(dt, t) {
    const mom = world.mom;
    mom.stateTime += dt;

    // Natural gentle blinking when awake
    if (!mom.sleeping) {
      mom.blinkTimer -= dt;
      if (mom.blinkTimer <= 0) {
        mom.blinkTimer = 3.2 + Math.random() * 3.8;
      }
      const blink = mom.blinkTimer < 0.16 ? Math.sin((mom.blinkTimer / 0.16) * Math.PI) : 0;
      mom.eyesClosed = damp(mom.eyesClosed, blink, 18, dt);
    } else {
      mom.eyesClosed = damp(mom.eyesClosed, 1.0, 2.2, dt);
    }
    momRig.setEyesClosed(mom.eyesClosed);

    // Held meat timer (so mom holds remaining meat long enough for child to drop another clam & trigger sharing!)
    if (mom.heldMeat) {
      mom.heldMeat.timer -= dt;
      if (mom.heldMeat.timer <= 0 && mom.state !== 'share_baby') {
        // Quietly finishes the remaining morsel herself
        momRig.shellAnchor.remove(mom.heldMeat.mesh);
        mom.heldMeat = null;
      }
    }

    // Default pose targets (floating peacefully on back)
    let targetY = -0.02 + Math.sin(t * 1.45) * 0.018;
    let targetRoll = 0;
    let targetPitch = Math.sin(t * 1.1) * 0.04;
    let armMode = 'rest'; // 'rest' | 'face_rub' | 'paddle' | 'hold' | 'tap' | 'eat' | 'share' | 'swim' | 'sleep'
    let swimSpeed = 0;

    // --- STATE TRANSITIONS & MOVEMENT ---
    if (mom.state === 'idle') {
      // Check if an unclaimed water shell is waiting!
      const shell = findBestWaterShell();
      if (shell && !mom.heldShell) {
        mom.targetShell = shell;
        shell.claimedBy = 'mom';
        // If it's a scallop and baby is on mom's belly, first tuck baby safely in the kelp!
        if (shell.type === 'scallop' && world.baby.carrier === 'mom') {
          mom.state = 'park_baby';
          mom.stateTime = 0;
        } else {
          mom.state = 'approach_shell';
          mom.stateTime = 0;
        }
      } else {
        // Peaceful natural idle sea otter rhythms!
        // Longer contented grooming as satiation grows
        const satiation = clamp(mom.fedCount / 8, 0, 1);
        mom.idleSubTimer -= dt;
        if (mom.idleSubTimer <= 0) {
          const r = Math.random();
          if (r < 0.38 + satiation * 0.25) {
            mom.idleSub = 'face_rub';
            mom.idleSubTimer = 2.8 + satiation * 2.2;
          } else if (r < 0.56 + satiation * 0.22 && world.baby.carrier !== 'mom') {
            mom.idleSub = 'groom_roll';
            mom.groomRollAngle = 0;
            mom.idleSubTimer = 3.2;
          } else if (r < 0.78) {
            mom.idleSub = 'paddle_drift';
            mom.idleSubTimer = 3.8 + Math.random() * 2.0;
          } else {
            mom.idleSub = 'float';
            mom.idleSubTimer = 3.0 + Math.random() * 2.2;
          }
        }

        // Gently drift toward preferred feeding spot (spatial memory!)
        const pref = getPreferredWaterSpot();
        const driftX = pref.x + Math.sin(t * 0.26) * 0.16;
        const driftZ = pref.z + Math.cos(t * 0.22) * 0.12;
        const distPref = Math.hypot(driftX - mom.x, driftZ - mom.z);
        if (distPref > 0.06) {
          const speed = mom.idleSub === 'paddle_drift' ? 0.26 : 0.11;
          mom.x += ((driftX - mom.x) / distPref) * Math.min(distPref, speed * dt);
          mom.z += ((driftZ - mom.z) / distPref) * Math.min(distPref, speed * dt);
        }

        // Gentle welcoming diagonal orientation toward the pool rim & preferred spot
        const desiredYaw = -0.36 + Math.sin(t * 0.2) * 0.18;
        mom.yaw = dampAngle(mom.yaw, desiredYaw, 1.4, dt);

        if (mom.idleSub === 'face_rub') {
          armMode = 'face_rub';
        } else if (mom.idleSub === 'paddle_drift') {
          armMode = 'paddle';
        } else if (mom.idleSub === 'groom_roll') {
          // Single slow graceful grooming roll
          mom.groomRollAngle += dt * 2.1;
          targetRoll = Math.min(mom.groomRollAngle, Math.PI * 2);
          armMode = 'face_rub';
          if (mom.groomRollAngle >= Math.PI * 2) {
            mom.idleSub = 'float';
            mom.idleSubTimer = 3.0;
          }
        }
      }
    } else if (mom.state === 'park_baby') {
      // Swim gently to the floating kelp bed & tuck baby safely before deep scallop chase!
      const dx = KELP_BABY_SPOT.x - mom.x;
      const dz = KELP_BABY_SPOT.z - mom.z;
      const dist = Math.hypot(dx, dz);
      armMode = 'paddle';
      if (dist > 0.16) {
        const yawToKelp = Math.atan2(dx, dz);
        mom.yaw = dampAngle(mom.yaw, yawToKelp, 3.2, dt);
        mom.x += (dx / dist) * Math.min(dist, 0.72 * dt);
        mom.z += (dz / dist) * Math.min(dist, 0.72 * dt);
      } else {
        // Tuck baby safely into floating kelp
        world.baby.carrier = 'kelp';
        world.baby.x = KELP_BABY_SPOT.x;
        world.baby.z = KELP_BABY_SPOT.z;
        world.baby.yaw = -0.3;
        audio.playWaterStir(0.08);
        env.addRipple(KELP_BABY_SPOT.x, KELP_BABY_SPOT.z, t, 0.3);
        mom.state = 'approach_shell';
        mom.stateTime = 0;
        saveNow();
      }
    } else if (mom.state === 'approach_shell') {
      const sh = mom.targetShell;
      if (!sh || sh.phase === 'claimed') {
        mom.state = 'idle';
      } else {
        const dx = sh.x - mom.x;
        const dz = sh.z - mom.z;
        const dist = Math.hypot(dx, dz);
        const yawToShell = Math.atan2(dx, dz);
        mom.yaw = dampAngle(mom.yaw, yawToShell, 4.2, dt);
        armMode = 'paddle';

        // Smoothly twist over and dive!
        const isDeepScallop = sh.type === 'scallop';
        if (dist > 0.55 && !isDeepScallop) {
          mom.x += (dx / dist) * 0.78 * dt;
          mom.z += (dz / dist) * 0.78 * dt;
          targetRoll = 0.55;
        } else {
          // Twist smoothly face-down and submerge!
          mom.state = isDeepScallop ? 'dive_underwater' : 'dive_quick';
          mom.stateTime = 0;
          audio.playWaterStir(0.14);
          audio.playBubbles(isDeepScallop ? 6 : 3);
          env.addRipple(mom.x, mom.z, t, isDeepScallop ? 0.65 : 0.45);
          spawnBubbles(mom.x, -0.1, mom.z, isDeepScallop ? 10 : 6, 0.25);
        }
      }
    } else if (mom.state === 'dive_quick' || mom.state === 'dive_underwater') {
      const sh = mom.targetShell;
      const isDeep = mom.state === 'dive_underwater';
      if (!sh || sh.phase === 'claimed') {
        mom.state = 'surface';
        mom.stateTime = 0;
      } else {
        const dx = sh.x - mom.x;
        const dy = Math.min(sh.y, isDeep ? -0.45 : -0.25) - mom.y;
        const dz = sh.z - mom.z;
        const dist3 = Math.hypot(dx, dy, dz);
        const spd = isDeep ? 1.05 : 1.15;

        const yawTo = Math.atan2(dx, dz);
        mom.yaw = dampAngle(mom.yaw, yawTo, 4.5, dt);
        targetRoll = Math.PI; // Belly facing down while diving gracefully
        targetPitch = clamp(-Math.atan2(dy, Math.max(0.15, Math.hypot(dx, dz))), -0.95, 0.85);
        armMode = 'swim';
        swimSpeed = 1.0;

        if (dist3 > 0.22) {
          mom.x += (dx / dist3) * spd * dt;
          mom.y = clamp(mom.y + (dy / dist3) * spd * dt, FLOOR_Y + 0.26, -0.05);
          mom.z += (dz / dist3) * spd * dt;
          targetY = mom.y;

          if (Math.random() < (isDeep ? 0.45 : 0.22)) {
            spawnBubbles(mom.x, mom.y + 0.08, mom.z, 1, 0.16);
          }
        } else {
          // Caught the shell in her forepaws!
          sh.phase = 'claimed';
          scene.remove(sh.mesh);
          const idx = world.activeShells.indexOf(sh);
          if (idx >= 0) world.activeShells.splice(idx, 1);

          const heldMesh = sh.type === 'scallop' ? M.createScallopMesh() : M.createClamMesh();
          heldMesh.position.set(0, 0, 0);
          momRig.shellAnchor.add(heldMesh);
          mom.heldShell = { type: sh.type, mesh: heldMesh };
          mom.targetShell = null;

          audio.playBubbles(4);
          spawnBubbles(mom.x, mom.y + 0.08, mom.z, 8, 0.22);

          mom.state = 'surface';
          mom.stateTime = 0;
        }
      }
    } else if (mom.state === 'surface') {
      // Swim gracefully back up to the sunlit surface and roll onto her back!
      const riseSpd = 0.95;
      mom.y = Math.min(-0.02, mom.y + riseSpd * dt);
      targetY = mom.y;
      const depthRatio = clamp(-mom.y / 1.1, 0, 1);
      targetRoll = depthRatio > 0.25 ? Math.PI : 0;
      targetPitch = depthRatio > 0.25 ? -0.55 : 0;
      armMode = depthRatio > 0.25 ? 'swim' : 'hold';
      swimSpeed = depthRatio;

      // Drift softly back toward central comfortable zone
      const pref = getPreferredWaterSpot();
      mom.x = damp(mom.x, clamp(pref.x, -0.85, 0.72), 0.9, dt);
      mom.z = damp(mom.z, clamp(pref.z, -0.35, 0.65), 0.9, dt);

      if (Math.random() < 0.25 && mom.y < -0.1) {
        spawnBubbles(mom.x, mom.y + 0.08, mom.z, 1, 0.14);
      }

      if (mom.y >= -0.04) {
        audio.playWaterStir(0.11);
        env.addRipple(mom.x, mom.z, t, 0.45);
        // If baby was parked in kelp, glide over to scoop baby back onto belly first!
        if (world.baby.carrier === 'kelp') {
          mom.state = 'pickup_baby';
          mom.stateTime = 0;
        } else if (mom.heldShell) {
          mom.state = mom.hasStone ? 'crack_shell' : 'hold_shell';
          mom.stateTime = 0;
          mom.tapCount = 0;
          mom.tapPhase = 0;
        } else {
          mom.state = 'idle';
          mom.stateTime = 0;
        }
      }
    } else if (mom.state === 'pickup_baby') {
      const dx = KELP_BABY_SPOT.x - mom.x;
      const dz = KELP_BABY_SPOT.z - mom.z;
      const dist = Math.hypot(dx, dz);
      armMode = mom.heldShell ? 'hold' : 'paddle';
      mom.yaw = dampAngle(mom.yaw, -0.36, 2.5, dt);
      if (dist > 0.24) {
        mom.x += (dx / dist) * Math.min(dist, 0.75 * dt);
        mom.z += (dz / dist) * Math.min(dist, 0.75 * dt);
      } else {
        world.baby.carrier = 'mom';
        audio.playWaterStir(0.08);
        env.addRipple(mom.x, mom.z, t, 0.3);
        if (mom.heldShell) {
          mom.state = mom.hasStone ? 'crack_shell' : 'hold_shell';
          mom.stateTime = 0;
          mom.tapCount = 0;
          mom.tapPhase = 0;
        } else {
          mom.state = 'idle';
          mom.stateTime = 0;
        }
        saveNow();
      }
    } else if (mom.state === 'hold_shell') {
      // Holding a clam on her belly without the flat stone yet!
      // Curiously taps & turns it in her paws while the flat stone below subtly gleams.
      armMode = 'hold';
      mom.yaw = dampAngle(mom.yaw, -0.36, 2.0, dt);

      // Gentle curious paw wiggle
      if (mom.heldShell) {
        mom.heldShell.mesh.rotation.y = Math.sin(t * 2.2) * 0.45;
      }

      // If child takes a long time (~18s) without bringing the stone, mom patiently cracks a small clam
      // by tapping with paws so the child never feels stuck, while keeping the stone discoverable!
      if (mom.stateTime > 18.0) {
        mom.state = 'crack_shell';
        mom.stateTime = 0;
        mom.tapCount = 2;
        mom.tapPhase = 0;
      }
    } else if (mom.state === 'crack_shell') {
      // Rhythmic authentic sea otter "kon-kon!" knocking shell against the flat stone on her belly!
      armMode = 'tap';
      mom.yaw = dampAngle(mom.yaw, -0.36, 2.0, dt);

      const tapRate = 2.05; // Unhurried rhythmic ~2 taps/sec
      const prevPhase = mom.tapPhase;
      mom.tapPhase += dt * tapRate;

      // Impact happens when phase crosses integer boundary
      if (Math.floor(mom.tapPhase) > Math.floor(prevPhase)) {
        mom.tapCount += 1;
        const needed = mom.heldShell && mom.heldShell.type === 'scallop' ? 4 : 3;
        if (mom.tapCount < needed) {
          audio.playStoneKnock(false);
          env.addRipple(mom.x, mom.z, t, 0.22);
        } else {
          // CRACK OPEN ("Paka!")
          const shellType = mom.heldShell ? mom.heldShell.type : 'clam';
          audio.playShellCrack(shellType === 'scallop');
          env.addRipple(mom.x, mom.z, t, 0.35);

          if (mom.heldShell) {
            releaseMomCrackedHalves(shellType);
            momRig.shellAnchor.remove(mom.heldShell.mesh);
            mom.heldShell = null;
          }

          // Replace with plump shell meat!
          if (mom.heldMeat) {
            momRig.shellAnchor.remove(mom.heldMeat.mesh);
          }
          const meatMesh = M.createMeatMesh(shellType === 'scallop');
          momRig.shellAnchor.add(meatMesh);
          mom.heldMeat = { mesh: meatMesh, isScallop: shellType === 'scallop', timer: 16.0 };

          mom.crackedCount += 1;
          mom.fedCount += 1;
          mom.chewTimer = 3.2;
          mom.state = 'eat_shell';
          mom.stateTime = 0;
          saveNow();
        }
      }
    } else if (mom.state === 'eat_shell') {
      // Mother brings meat to mouth and munches contentedly ("mogu-mogu")
      armMode = 'eat';
      mom.yaw = dampAngle(mom.yaw, -0.36, 1.8, dt);
      mom.chewTimer -= dt;

      if (Math.floor((mom.chewTimer + dt) * 1.6) > Math.floor(mom.chewTimer * 1.6) && mom.chewTimer > 0.3) {
        audio.playEat(false);
      }

      if (mom.chewTimer <= 0) {
        // Check if another shell was dropped while mom was eating -> if she still has meat, share with baby!
        const waitingShell = findBestWaterShell();
        if (waitingShell && mom.heldMeat && world.baby.carrier === 'mom') {
          mom.state = 'share_baby';
          mom.stateTime = 0;
        } else {
          mom.state = 'idle';
          mom.stateTime = 0;
          mom.idleSub = 'face_rub';
          mom.idleSubTimer = 2.4;
        }
      }
    } else if (mom.state === 'share_baby') {
      // Discovery 2: Mother smoothly leans slightly & offers remaining meat to baby on her belly!
      armMode = 'share';
      mom.yaw = dampAngle(mom.yaw, -0.36, 2.0, dt);

      if (mom.stateTime > 0.75 && mom.heldMeat) {
        // Hand meat over to baby!
        const isScallop = mom.heldMeat.isScallop;
        momRig.shellAnchor.remove(mom.heldMeat.mesh);
        mom.heldMeat = null;

        if (world.baby.eatMeatMesh) {
          babyRig.shellAnchor.remove(world.baby.eatMeatMesh);
        }
        const babyMeat = M.createMeatMesh(isScallop);
        babyMeat.scale.setScalar(0.85);
        babyRig.shellAnchor.add(babyMeat);
        world.baby.eatMeatMesh = babyMeat;
        world.baby.eatTimer = 2.6;
        mom.sharedCount += 1;
        audio.playEat(true);
        saveNow();
      }

      if (mom.stateTime > 2.0) {
        mom.state = 'idle';
        mom.stateTime = 0;
      }
    } else if (mom.state === 'goto_sleep') {
      // Glide calmly to the kelp bed to wrap up and nap!
      const tx = KELP_BABY_SPOT.x + 0.24;
      const tz = KELP_BABY_SPOT.z + 0.16;
      const dx = tx - mom.x;
      const dz = tz - mom.z;
      const dist = Math.hypot(dx, dz);
      armMode = 'paddle';

      if (dist > 0.12) {
        mom.yaw = dampAngle(mom.yaw, -0.32, 1.8, dt);
        mom.x += (dx / dist) * Math.min(dist, 0.36 * dt);
        mom.z += (dz / dist) * Math.min(dist, 0.36 * dt);
      } else {
        world.baby.carrier = 'mom';
        mom.kelpWrapped = true;
        mom.sleeping = true;
        momRig.kelpWrapGroup.visible = true;
        mom.state = 'sleep';
        mom.stateTime = 0;
        audio.playWaterStir(0.06);
        saveNow();
      }
    } else if (mom.state === 'sleep') {
      armMode = 'sleep';
      targetY = -0.02 + Math.sin(t * 0.9) * 0.014;
      mom.yaw = dampAngle(mom.yaw, -0.32 + Math.sin(t * 0.25) * 0.05, 1.0, dt);
    }

    // Smooth body orientation & vertical bobbing
    mom.y = damp(mom.y, targetY, 6.0, dt);
    mom.roll = damp(mom.roll, targetRoll, 4.8, dt);
    mom.pitch = damp(mom.pitch, targetPitch, 5.0, dt);

    momRig.root.position.set(mom.x, mom.y, mom.z);
    momRig.root.rotation.y = mom.yaw;
    momRig.bodyGroup.rotation.z = mom.roll;
    momRig.bodyGroup.rotation.x = mom.pitch;

    // --- Articulated Limbs, Head, Tail & Flippers ---
    const isUnderwater = mom.y < -0.18;
    const undulateFreq = isUnderwater ? 5.6 : 1.6;
    const undulateAmp = isUnderwater ? 0.34 : 0.08;

    // Gentle sculling tail & hind flippers (graceful slow rhythm at surface, sinuous underwater!)
    momRig.tail1.rotation.x = Math.sin(t * undulateFreq) * undulateAmp;
    momRig.tail2.rotation.x = Math.sin(t * undulateFreq - 0.9) * undulateAmp * 1.15;
    momRig.tail3.rotation.x = Math.sin(t * undulateFreq - 1.8) * undulateAmp * 1.25;

    const flipKick = isUnderwater ? 0.48 : 0.14;
    momRig.leftFlipper.rotation.x = 0.12 + Math.sin(t * (isUnderwater ? 5.6 : 1.55)) * flipKick;
    momRig.rightFlipper.rotation.x = 0.12 + Math.sin(t * (isUnderwater ? 5.6 : 1.55) + 1.4) * flipKick;

    // Head look & chewing jaw
    let headPitch = -0.08 + Math.sin(t * 0.9) * 0.04;
    let headYaw = 0;
    if (armMode === 'share') {
      headPitch = -0.34; // Looks lovingly down toward baby
    } else if (armMode === 'eat') {
      headPitch = -0.18 + Math.sin(t * 7.5) * 0.05;
    } else if (armMode === 'sleep') {
      headPitch = -0.04 + Math.sin(t * 0.9) * 0.025;
      headYaw = 0.12;
    } else if (!isUnderwater && !mom.sleeping) {
      // Softly track held shell or latest splash
      const toLook = new THREE.Vector3().subVectors(mom.lookTarget, momRig.root.position);
      const localAngle = angleDiff(mom.yaw, Math.atan2(toLook.x, toLook.z));
      headYaw = clamp(localAngle * 0.35, -0.38, 0.38);
    }
    momRig.headGroup.rotation.x = damp(momRig.headGroup.rotation.x, headPitch, 5.5, dt);
    momRig.headGroup.rotation.y = damp(momRig.headGroup.rotation.y, headYaw, 4.0, dt);

    // Jaw chewing motion
    const jawOpen = armMode === 'eat' ? Math.max(0, Math.sin(t * 9.5)) * 0.18 : 0;
    momRig.jawGroup.rotation.x = damp(momRig.jawGroup.rotation.x, jawOpen, 14, dt);

    // Forearms & Paws animation
    let lArmX = 0.0, lArmY = 0.0, lArmZ = 0.0;
    let rArmX = 0.0, rArmY = 0.0, rArmZ = 0.0;

    if (armMode === 'rest') {
      // Calmly resting paws gently on chest / cradling baby
      lArmX = 0.12 + Math.sin(t * 1.2) * 0.05;
      rArmX = 0.12 + Math.cos(t * 1.2) * 0.05;
      lArmZ = 0.22;
      rArmZ = -0.22;
    } else if (armMode === 'face_rub') {
      // Real sea otter face-washing rub ("前足で顔をごしごし洗う")
      const rub = Math.sin(t * 5.8);
      lArmX = -0.68 + rub * 0.14;
      rArmX = -0.68 - rub * 0.14;
      lArmZ = 0.42 + Math.cos(t * 5.8) * 0.12;
      rArmZ = -0.42 - Math.cos(t * 5.8) * 0.12;
    } else if (armMode === 'paddle') {
      const p = Math.sin(t * 3.1);
      lArmX = 0.25 + p * 0.38;
      rArmX = 0.25 - p * 0.38;
      lArmZ = -0.35;
      rArmZ = 0.35;
    } else if (armMode === 'hold') {
      lArmX = -0.22;
      rArmX = -0.22;
      lArmZ = 0.56;
      rArmZ = -0.56;
    } else if (armMode === 'tap') {
      // Rhythmic lifting & tapping shell onto belly stone!
      const frac = mom.tapPhase % 1;
      const lift = Math.sin(frac * Math.PI); // 0 at knock impact, 1 at top of lift
      lArmX = -0.28 - lift * 0.32;
      rArmX = -0.28 - lift * 0.32;
      lArmZ = 0.58;
      rArmZ = -0.58;
      momRig.shellAnchor.position.set(0, 0.215 + lift * 0.115, 0.195);
    } else if (armMode === 'eat') {
      lArmX = -0.62 + Math.sin(t * 6.5) * 0.06;
      rArmX = -0.62 + Math.cos(t * 6.5) * 0.06;
      lArmZ = 0.55;
      rArmZ = -0.55;
      momRig.shellAnchor.position.set(0, 0.24, 0.39);
    } else if (armMode === 'share') {
      // Reach smoothly back over chest toward baby's mouth
      lArmX = 0.35;
      rArmX = 0.35;
      lArmZ = 0.52;
      rArmZ = -0.52;
      momRig.shellAnchor.position.set(0, 0.25, 0.06);
    } else if (armMode === 'swim') {
      // Tucked sleekly near chest underwater while hind flippers & tail propel
      lArmX = 0.15;
      rArmX = 0.15;
      lArmZ = 0.42;
      rArmZ = -0.42;
    } else if (armMode === 'sleep') {
      // Gently hugging baby close to chest
      lArmX = 0.28;
      rArmX = 0.28;
      lArmZ = 0.45;
      rArmZ = -0.45;
    }

    if (armMode !== 'tap' && armMode !== 'eat' && armMode !== 'share') {
      momRig.shellAnchor.position.set(0, 0.255, 0.23);
    }

    momRig.leftArm.shoulder.rotation.x = damp(momRig.leftArm.shoulder.rotation.x, lArmX, 10, dt);
    momRig.leftArm.shoulder.rotation.y = damp(momRig.leftArm.shoulder.rotation.y, lArmY, 10, dt);
    momRig.leftArm.shoulder.rotation.z = damp(momRig.leftArm.shoulder.rotation.z, lArmZ, 10, dt);

    momRig.rightArm.shoulder.rotation.x = damp(momRig.rightArm.shoulder.rotation.x, rArmX, 10, dt);
    momRig.rightArm.shoulder.rotation.y = damp(momRig.rightArm.shoulder.rotation.y, rArmY, 10, dt);
    momRig.rightArm.shoulder.rotation.z = damp(momRig.rightArm.shoulder.rotation.z, rArmZ, 10, dt);

    // Sync stone onto mom's belly if she owns it (anchored safely so waves never wash it away!)
    if (world.stone.location === 'mom_belly') {
      const sp = new THREE.Vector3();
      const sq = new THREE.Quaternion();
      momRig.stoneAnchor.getWorldPosition(sp);
      momRig.stoneAnchor.getWorldQuaternion(sq);
      stoneMesh.position.copy(sp);
      stoneMesh.quaternion.copy(sq);
    }
  }

  // =========================================================================
  // Baby Otter Animation (On Mom's Belly OR Floating Safely in Kelp)
  // =========================================================================
  function updateBabyOtter(dt, t) {
    const baby = world.baby;
    const mom = world.mom;

    if (baby.carrier === 'mom') {
      // Ride naturally on mother's belly with gentle organic coupling
      const bp = new THREE.Vector3();
      const bq = new THREE.Quaternion();
      momRig.bellyAnchor.getWorldPosition(bp);
      momRig.bellyAnchor.getWorldQuaternion(bq);

      babyRig.root.position.lerp(bp, 1 - Math.exp(-14 * dt));
      babyRig.root.quaternion.slerp(bq, 1 - Math.exp(-12 * dt));
      // Slightly offset baby toward lower-mid belly when mom holds stone on upper chest
      babyRig.bodyGroup.position.set(0, 0.04, mom.hasStone ? -0.15 : -0.04);
      babyRig.bodyGroup.rotation.set(0.06, 0.08, 0);
    } else {
      // Floating safely tucked in the surface kelp bed while mom dives for scallop!
      const bob = Math.sin(t * 1.7 + 0.8) * 0.015;
      baby.x = damp(baby.x, KELP_BABY_SPOT.x + Math.sin(t * 0.5) * 0.03, 3.0, dt);
      baby.z = damp(baby.z, KELP_BABY_SPOT.z + Math.cos(t * 0.45) * 0.03, 3.0, dt);
      babyRig.root.position.lerp(new THREE.Vector3(baby.x, -0.015 + bob, baby.z), 1 - Math.exp(-6 * dt));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, baby.yaw + Math.sin(t * 0.6) * 0.08, 0));
      babyRig.root.quaternion.slerp(q, 1 - Math.exp(-5 * dt));
      babyRig.bodyGroup.position.set(0, 0, 0);
    }

    // Eyes: sleep with mom, or gentle blinks
    if (mom.sleeping && baby.carrier === 'mom') {
      baby.eyesClosed = damp(baby.eyesClosed, 1.0, 2.5, dt);
    } else {
      baby.eyesClosed = damp(baby.eyesClosed, 0.0, 4.5, dt);
    }
    babyRig.setEyesClosed(baby.eyesClosed);

    // Occasional cute baby yawn ("あくび")
    if (!mom.sleeping && baby.eatTimer <= 0) {
      baby.yawnTimer -= dt;
      if (baby.yawnTimer <= 0 && baby.yawnProgress === 0) {
        baby.yawnProgress = 0.01;
        baby.yawnTimer = 11 + Math.random() * 10;
      }
    }
    let yawnAmt = 0;
    if (baby.yawnProgress > 0) {
      baby.yawnProgress += dt * 0.52;
      if (baby.yawnProgress >= 1) {
        baby.yawnProgress = 0;
      } else {
        yawnAmt = Math.sin(baby.yawnProgress * Math.PI);
      }
    }

    // Eating shared clam meat ("ちゅっと吸うようにして食べます")
    let eatAmt = 0;
    if (baby.eatTimer > 0) {
      baby.eatTimer -= dt;
      eatAmt = 1;
      if (Math.floor((baby.eatTimer + dt) * 2.1) > Math.floor(baby.eatTimer * 2.1) && baby.eatTimer > 0.25) {
        audio.playEat(true);
      }
      if (baby.eatTimer <= 0 && baby.eatMeatMesh) {
        babyRig.shellAnchor.remove(baby.eatMeatMesh);
        baby.eatMeatMesh = null;
      }
    }

    // Tiny paws & hind flippers wiggle naturally
    const wiggle = mom.sleeping ? 0.15 : 1.0;
    babyRig.leftFlipper.rotation.x = 0.15 + Math.sin(t * 2.3) * 0.20 * wiggle;
    babyRig.rightFlipper.rotation.x = 0.15 + Math.cos(t * 2.1) * 0.20 * wiggle;
    babyRig.tail1.rotation.x = Math.sin(t * 2.0) * 0.12 * wiggle;

    if (eatAmt > 0) {
      // Brings tiny paws to mouth to suckle the offered morsel!
      babyRig.leftArm.shoulder.rotation.x = damp(babyRig.leftArm.shoulder.rotation.x, -0.66 + Math.sin(t * 8) * 0.05, 10, dt);
      babyRig.rightArm.shoulder.rotation.x = damp(babyRig.rightArm.shoulder.rotation.x, -0.66 + Math.cos(t * 8) * 0.05, 10, dt);
      babyRig.leftArm.shoulder.rotation.z = damp(babyRig.leftArm.shoulder.rotation.z, 0.52, 10, dt);
      babyRig.rightArm.shoulder.rotation.z = damp(babyRig.rightArm.shoulder.rotation.z, -0.52, 10, dt);
      babyRig.shellAnchor.position.set(0, 0.24, 0.36);
      babyRig.jawGroup.rotation.x = Math.max(0, Math.sin(t * 10)) * 0.16;
    } else {
      const stretch = yawnAmt * 0.42;
      babyRig.leftArm.shoulder.rotation.x = damp(babyRig.leftArm.shoulder.rotation.x, -0.15 - stretch + Math.sin(t * 2.8) * 0.16 * wiggle, 8, dt);
      babyRig.rightArm.shoulder.rotation.x = damp(babyRig.rightArm.shoulder.rotation.x, -0.15 - stretch + Math.cos(t * 2.6) * 0.16 * wiggle, 8, dt);
      babyRig.leftArm.shoulder.rotation.z = damp(babyRig.leftArm.shoulder.rotation.z, 0.32 - stretch * 0.3, 8, dt);
      babyRig.rightArm.shoulder.rotation.z = damp(babyRig.rightArm.shoulder.rotation.z, -0.32 + stretch * 0.3, 8, dt);
      babyRig.jawGroup.rotation.x = damp(babyRig.jawGroup.rotation.x, yawnAmt * 0.42, 12, dt);
    }

    babyRig.headGroup.rotation.x = damp(babyRig.headGroup.rotation.x, -0.10 + yawnAmt * 0.22 + Math.sin(t * 1.3) * 0.05 * wiggle, 6, dt);
    babyRig.headGroup.rotation.y = damp(babyRig.headGroup.rotation.y, Math.sin(t * 0.75) * 0.18 * wiggle, 4, dt);
  }

  // =========================================================================
  // Second Adult Otter on the Rock (Discovery 4 & 6)
  // =========================================================================
  function findRockShell() {
    for (const s of world.activeShells) {
      if (s.zone !== 'rock') continue;
      if (s.phase !== 'sinking' && s.phase !== 'bottom' && s.phase !== 'rock_landed') continue;
      if (s.claimedBy && s.claimedBy !== 'rock') continue;
      return s;
    }
    return null;
  }

  function updateRockOtter(dt, t) {
    const ro = world.rockOtter;
    if (!ro.active) {
      rockRig.root.visible = false;
      return;
    }
    rockRig.root.visible = true;
    ro.stateTime += dt;

    if (ro.sleeping) {
      ro.eyesClosed = damp(ro.eyesClosed, 1.0, 2.2, dt);
    } else {
      ro.eyesClosed = damp(ro.eyesClosed, 0.0, 6.0, dt);
    }
    rockRig.setEyesClosed(ro.eyesClosed);

    const restX = ROCK_SPOT.x - ro.waitBias * 0.18;
    const restZ = ROCK_SPOT.z + ro.waitBias * 0.24;
    let targetRoll = 0.22; // Relaxed half-back / side lounge on sunlit rock
    let armMode = 'lounge';

    if (ro.state === 'arriving') {
      // Swims smoothly out from behind the back-right rock cove onto the flat sunlit rock ledge!
      const dx = restX - ro.x;
      const dz = restZ - ro.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.14) {
        ro.yaw = dampAngle(ro.yaw, Math.atan2(dx, dz), 3.0, dt);
        ro.x += (dx / dist) * 0.52 * dt;
        ro.z += (dz / dist) * 0.52 * dt;
        ro.y = damp(ro.y, dist < 0.6 ? ROCK_SPOT.y : -0.02, 3.0, dt);
        targetRoll = dist < 0.6 ? 0.35 : Math.PI;
        armMode = 'swim';
        if (dist >= 0.6 && Math.random() < 0.15) {
          env.addRipple(ro.x, ro.z, t, 0.22);
        }
      } else {
        ro.state = 'lounge';
        ro.stateTime = 0;
        audio.playWaterStir(0.09);
        saveNow();
      }
    } else if (ro.state === 'lounge') {
      ro.x = damp(ro.x, restX, 1.8, dt);
      ro.z = damp(ro.z, restZ, 1.8, dt);
      ro.y = damp(ro.y, ROCK_SPOT.y, 3.5, dt);
      ro.yaw = dampAngle(ro.yaw, -2.55, 1.8, dt);
      targetRoll = 0.22;
      armMode = Math.sin(t * 0.45) > 0.65 ? 'face_rub' : 'lounge';

      const sh = findRockShell();
      if (sh) {
        ro.targetShell = sh;
        sh.claimedBy = 'rock';
        ro.state = 'fetch_shell';
        ro.stateTime = 0;
      }
    } else if (ro.state === 'fetch_shell') {
      const sh = ro.targetShell;
      if (!sh || sh.phase === 'claimed') {
        ro.state = 'lounge';
      } else {
        const dx = sh.x - ro.x;
        const dz = sh.z - ro.z;
        const dist = Math.hypot(dx, dz);
        ro.yaw = dampAngle(ro.yaw, Math.atan2(dx, dz), 4.0, dt);
        if (dist > 0.26) {
          ro.x += (dx / dist) * 0.72 * dt;
          ro.z += (dz / dist) * 0.72 * dt;
          const onRock = Math.hypot(ro.x - ROCK_SPOT.x, ro.z - ROCK_SPOT.z) < 0.65;
          ro.y = damp(ro.y, onRock ? ROCK_SPOT.y : -0.03, 4.5, dt);
          targetRoll = onRock ? 0.5 : Math.PI;
          armMode = 'swim';
        } else {
          // Picked up shell!
          sh.phase = 'claimed';
          scene.remove(sh.mesh);
          const idx = world.activeShells.indexOf(sh);
          if (idx >= 0) world.activeShells.splice(idx, 1);

          const heldMesh = sh.type === 'scallop' ? M.createScallopMesh() : M.createClamMesh();
          rockRig.shellAnchor.add(heldMesh);
          ro.heldShell = { type: sh.type, mesh: heldMesh };
          ro.targetShell = null;
          ro.state = 'return_rock';
          ro.stateTime = 0;
          audio.playWaterStir(0.09);
        }
      }
    } else if (ro.state === 'return_rock') {
      const dx = restX - ro.x;
      const dz = restZ - ro.z;
      const dist = Math.hypot(dx, dz);
      ro.y = damp(ro.y, ROCK_SPOT.y, 3.8, dt);
      if (dist > 0.12) {
        ro.x += (dx / dist) * 0.65 * dt;
        ro.z += (dz / dist) * 0.65 * dt;
        ro.yaw = dampAngle(ro.yaw, -2.55, 2.5, dt);
        targetRoll = 0.2;
      } else {
        ro.state = 'crack_on_rock';
        ro.stateTime = 0;
        ro.tapCount = 0;
        ro.tapPhase = 0;
      }
    } else if (ro.state === 'crack_on_rock') {
      // Cracks the shell directly against the rock ledge beside it!
      ro.yaw = dampAngle(ro.yaw, -2.55, 2.5, dt);
      targetRoll = 0.75; // Leans gently sideways toward the rock surface
      armMode = 'rock_tap';

      const prevP = ro.tapPhase;
      ro.tapPhase += dt * 2.15;
      if (Math.floor(ro.tapPhase) > Math.floor(prevP)) {
        ro.tapCount += 1;
        if (ro.tapCount < 3) {
          audio.playStoneKnock(true);
        } else {
          const type = ro.heldShell ? ro.heldShell.type : 'clam';
          audio.playShellCrack(type === 'scallop');
          if (ro.heldShell) {
            const wp = new THREE.Vector3();
            rockRig.shellAnchor.getWorldPosition(wp);
            spawnCrackedHalf(type, wp.x - 0.18, 0.05, wp.z + 0.25, Math.random() * 6, false, false);
            rockRig.shellAnchor.remove(ro.heldShell.mesh);
            ro.heldShell = null;
          }
          ro.fedCount += 1;
          ro.chewTimer = 3.2;
          ro.state = 'eat_on_rock';
          ro.stateTime = 0;
          saveNow();
        }
      }
    } else if (ro.state === 'eat_on_rock') {
      targetRoll = 0.22;
      armMode = 'eat';
      ro.chewTimer -= dt;
      if (Math.floor((ro.chewTimer + dt) * 1.5) > Math.floor(ro.chewTimer * 1.5) && ro.chewTimer > 0.3) {
        audio.playEat(false);
      }
      if (ro.chewTimer <= 0) {
        ro.state = 'lounge';
        ro.stateTime = 0;
      }
    } else if (ro.state === 'sleep') {
      ro.x = damp(ro.x, restX, 1.5, dt);
      ro.z = damp(ro.z, restZ, 1.5, dt);
      ro.y = damp(ro.y, ROCK_SPOT.y, 2.5, dt);
      ro.yaw = dampAngle(ro.yaw, -2.4, 1.2, dt);
      targetRoll = 0.55;
      armMode = 'sleep';
    }

    ro.roll = damp(ro.roll, targetRoll, 4.2, dt);
    rockRig.root.position.set(ro.x, ro.y, ro.z);
    rockRig.root.rotation.y = ro.yaw;
    rockRig.bodyGroup.rotation.z = ro.roll;

    // Articulation
    rockRig.tail1.rotation.x = Math.sin(t * 1.3 + 2.0) * 0.07;
    rockRig.leftFlipper.rotation.x = 0.15 + Math.sin(t * 1.2) * 0.08;
    rockRig.rightFlipper.rotation.x = 0.15 + Math.cos(t * 1.2) * 0.08;
    rockRig.headGroup.rotation.x = armMode === 'sleep' ? -0.18 : -0.28 + Math.sin(t * 0.8) * 0.04;
    rockRig.jawGroup.rotation.x = armMode === 'eat' ? Math.max(0, Math.sin(t * 9)) * 0.16 : 0;

    let lx = 0.1, rx = 0.1, lz = 0.25, rz = -0.25;
    if (armMode === 'rock_tap') {
      const lift = Math.sin((ro.tapPhase % 1) * Math.PI);
      lx = -0.35 - lift * 0.35;
      rx = -0.35 - lift * 0.35;
      lz = 0.55;
      rz = -0.55;
      rockRig.shellAnchor.position.set(0.08, 0.22 + lift * 0.10, 0.24);
    } else if (armMode === 'face_rub') {
      const rub = Math.sin(t * 5.2);
      lx = -0.65 + rub * 0.12;
      rx = -0.65 - rub * 0.12;
      lz = 0.42;
      rz = -0.42;
    } else if (armMode === 'eat') {
      lx = -0.58; rx = -0.58; lz = 0.5; rz = -0.5;
    } else if (armMode === 'sleep') {
      lx = -0.45; rx = -0.45; lz = 0.35; rz = -0.35;
    }
    rockRig.leftArm.shoulder.rotation.x = damp(rockRig.leftArm.shoulder.rotation.x, lx, 8, dt);
    rockRig.rightArm.shoulder.rotation.x = damp(rockRig.rightArm.shoulder.rotation.x, rx, 8, dt);
    rockRig.leftArm.shoulder.rotation.z = damp(rockRig.leftArm.shoulder.rotation.z, lz, 8, dt);
    rockRig.rightArm.shoulder.rotation.z = damp(rockRig.rightArm.shoulder.rotation.z, rz, 8, dt);
  }

  // =========================================================================
  // Stone Bottom Physics
  // =========================================================================
  function updateStone(dt) {
    if (world.stone.location === 'falling') {
      world.stone.vy -= 2.2 * dt;
      world.stone.y += world.stone.vy * dt;
      if (world.stone.y <= FLOOR_Y) {
        world.stone.y = FLOOR_Y;
        world.stone.vy = 0;
        world.stone.location = 'bottom';
      }
      stoneMesh.position.set(world.stone.x, world.stone.y, world.stone.z);
    } else if (world.stone.location === 'bottom' || world.stone.location === 'dragging') {
      stoneMesh.position.set(world.stone.x, world.stone.y, world.stone.z);
      stoneMesh.rotation.set(0, 0.35, 0);
    }
  }

  // =========================================================================
  // Progression Unlocks & 5-8 Minute Peaceful Cycle Pacing
  // =========================================================================
  function updateProgression(dt) {
    if (!world.mom.sleeping && world.hasInteracted) {
      world.playTime += dt;
    }

    const totalFed = world.mom.fedCount + world.rockOtter.fedCount;

    // Discovery 3 (~2-3 min or 3 cracked clams): Scallops appear in the bucket!
    if (!world.scallopUnlocked && (world.mom.crackedCount >= 3 || world.playTime >= 115)) {
      world.scallopUnlocked = true;
      ensureBucketStock(true);
      saveNow();
    }

    // Discovery 4 (~2.5-3.5 min or 4 feedings): Second adult otter emerges from back rock cove!
    if (!world.rockOtterUnlocked && (totalFed >= 4 || world.playTime >= 150)) {
      world.rockOtterUnlocked = true;
      world.rockOtter.active = true;
      world.rockOtter.state = 'arriving';
      world.rockOtter.x = ROCK_COVE_START.x;
      world.rockOtter.y = ROCK_COVE_START.y;
      world.rockOtter.z = ROCK_COVE_START.z;
      world.rockOtter.stateTime = 0;
      saveNow();
    }

    // Camera gentle descent to low water-level perspective (~3-4 min or 6 feedings)
    if (world.cameraStage === 'diagonal' && (world.playTime >= 195 || totalFed >= 6)) {
      world.cameraStage = 'low';
      saveNow();
    }

    // Peaceful 5-8 minute ending: kelp-wrap sleep!
    const readyToNap = !world.mom.sleeping &&
      world.mom.state === 'idle' &&
      !world.mom.heldShell &&
      world.activeShells.length === 0 &&
      (world.playTime >= 330 || (world.playTime >= 245 && totalFed >= 10));

    if (readyToNap) {
      world.mom.state = 'goto_sleep';
      world.mom.stateTime = 0;
      if (world.rockOtter.active) {
        world.rockOtter.sleeping = true;
        world.rockOtter.state = 'sleep';
      }
    }
  }

  // =========================================================================
  // Single World-Object Soft Highlight & ~4s Idle Translucent Fingertip Guide
  // =========================================================================
  function projectToScreen(vec3) {
    const v = vec3.clone().project(camera);
    if (v.z > 1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  function updateGuidance(dt, t) {
    if (drag.kind === null) {
      world.idleTime += dt;
    }

    // Choose ONLY ONE object in the world to gently gleam / bounce
    let guideObj = null;
    let fromWorld = null;
    let toWorld = null;

    if (world.mom.sleeping) {
      guideObj = 'bucket';
      const bp = new THREE.Vector3();
      bucketObj.group.getWorldPosition(bp);
      bp.y += 0.22;
      fromWorld = bp;
      toWorld = null; // Gentle tap on bucket to wake baby!
    } else if (!world.mom.hasStone && world.stone.location === 'bottom' &&
               (world.mom.heldShell || world.mom.crackedCount === 0 && world.dropHistory.length >= 1)) {
      // Discovery 1 guide: highlight the flat stone on the sandy bottom!
      guideObj = 'stone';
      fromWorld = new THREE.Vector3(world.stone.x, world.stone.y + 0.04, world.stone.z);
      toWorld = new THREE.Vector3(world.mom.x, 0.14, world.mom.z);
    } else if (world.bucketShells.length > 0 && world.underwaterBlend < 0.3) {
      // Highlight a scallop first if newly unlocked & not yet dropped, else top clam in bucket
      let targetShell = world.bucketShells[world.bucketShells.length - 1];
      if (world.scallopUnlocked && !world.scallopDroppedOnce) {
        const sc = world.bucketShells.find(s => s.type === 'scallop');
        if (sc) targetShell = sc;
      }
      guideObj = targetShell;
      const sp = new THREE.Vector3();
      targetShell.mesh.getWorldPosition(sp);
      fromWorld = sp;

      // Guide target: toward rock ledge if 2nd otter just arrived & hasn't been fed yet, else water near mom
      if (world.rockOtter.active && world.rockOtter.state === 'lounge' && world.rockOtter.fedCount === 0) {
        toWorld = new THREE.Vector3(ROCK_SPOT.x - 0.15, 0.12, ROCK_SPOT.z + 0.25);
      } else {
        toWorld = new THREE.Vector3(world.mom.x + 0.18, 0.05, world.mom.z + 0.28);
      }
    }

    // Apply subtle sunlit shimmer & gentle pulse to the ONE highlighted object
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
    world.bucketShells.forEach(s => {
      const slot = BUCKET_SLOTS[s.slotIdx];
      const isTarget = guideObj === s && drag.kind === null;
      s.mesh.position.y = slot.y + (isTarget ? pulse * 0.018 : 0);
      const sc = isTarget ? 1.0 + pulse * 0.055 : 1.0;
      s.mesh.scale.setScalar(sc);
    });

    if (guideObj === 'stone' && drag.kind === null) {
      highlightHalo.visible = true;
      highlightHalo.position.set(world.stone.x, world.stone.y + 0.05, world.stone.z);
      highlightHalo.scale.setScalar(1.0 + pulse * 0.25);
      highlightHalo.material.opacity = 0.18 + pulse * 0.22;
    } else if (guideObj === 'bucket' && drag.kind === null) {
      highlightHalo.visible = true;
      const bp = new THREE.Vector3();
      bucketObj.group.getWorldPosition(bp);
      highlightHalo.position.set(bp.x, bp.y + 0.22, bp.z);
      highlightHalo.scale.setScalar(1.5 + pulse * 0.22);
      highlightHalo.material.opacity = 0.14 + pulse * 0.18;
    } else if (guideObj && guideObj.mesh && drag.kind === null) {
      highlightHalo.visible = true;
      const sp = new THREE.Vector3();
      guideObj.mesh.getWorldPosition(sp);
      highlightHalo.position.copy(sp);
      highlightHalo.scale.setScalar(0.65 + pulse * 0.20);
      highlightHalo.material.opacity = 0.15 + pulse * 0.16;
    } else {
      highlightHalo.visible = false;
    }

    // After ~4 seconds without touching, softly show the translucent fingertip demonstration
    const showHint = world.idleTime >= 4.0 && drag.kind === null && fromWorld !== null && world.underwaterBlend < 0.25;
    const fromPx = fromWorld ? projectToScreen(fromWorld) : null;
    const toPx = toWorld ? projectToScreen(toWorld) : null;
    hint.updateAndDraw(dt, showHint, fromPx, toPx);
  }

  // =========================================================================
  // Particle Updates
  // =========================================================================
  function updateParticles(dt, t) {
    for (let i = 0; i < droplets.length; i++) {
      const d = droplets[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vy -= 5.8 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.life <= 0 || d.mesh.position.y < -0.02) {
        d.life = 0;
        d.mesh.visible = false;
      }
    }

    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.position.x += (b.vx + Math.sin(t * 5 + b.phase) * 0.08) * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      if (b.life <= 0 || b.mesh.position.y >= -0.01) {
        b.life = 0;
        b.mesh.visible = false;
      }
    }
  }

  // =========================================================================
  // Main Loop
  // =========================================================================
  let lastTime = performance.now();

  function step(dt) {
    world.time += dt;
    const t = world.time;

    updateProgression(dt);
    updateActiveShells(dt);
    updateCrackedShells(dt, t);
    updateStone(dt);
    updateMotherOtter(dt, t);
    updateBabyOtter(dt, t);
    updateRockOtter(dt, t);
    updateParticles(dt, t);
    kelpBed.update(t);

    // Camera transition weights
    const targetUnderwater = (world.mom.state === 'dive_underwater' ||
      (world.mom.state === 'surface' && world.mom.y < -0.25 && world.underwaterBlend > 0.25)) ? 1 : 0;
    world.underwaterBlend = damp(world.underwaterBlend, targetUnderwater, targetUnderwater ? 2.4 : 1.9, dt);

    const targetLow = world.cameraStage === 'low' ? 1 : 0;
    world.lowViewBlend = damp(world.lowViewBlend, targetLow, 0.55, dt);

    const targetWarmth = world.mom.sleeping ? 0.65 : 0.0;
    world.warmthBlend = damp(world.warmthBlend, targetWarmth, 0.5, dt);

    // Smooth camera motion
    const desiredCam = computeDesiredCamera(t);
    camState.pos.lerp(desiredCam.pos, 1 - Math.exp(-3.4 * dt));
    camState.target.lerp(desiredCam.target, 1 - Math.exp(-4.2 * dt));
    camState.fov = damp(camState.fov, desiredCam.fov, 3.0, dt);

    camera.fov = camState.fov;
    camera.position.copy(camState.pos);
    camera.lookAt(camState.target);
    camera.updateProjectionMatrix();

    // Update fog, water shader, caustics, sunbeams, and underwater audio muffle
    scene.fog.color.copy(surfaceFogColor).lerp(underFogColor, world.underwaterBlend);
    scene.fog.near = lerp(9.5, 2.2, world.underwaterBlend);
    scene.fog.far = lerp(25.0, 9.5, world.underwaterBlend);

    env.update(t, world.underwaterBlend, world.warmthBlend);
    audio.setUnderwater(world.underwaterBlend);
    updateGuidance(dt, t);

    // Periodic autosave every ~6 seconds
    if (world.time - world.lastSaveTime > 6.0 && world.hasInteracted) {
      saveNow();
    }
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    step(dt);
    renderer.render(scene, camera);
  }

  // Snap initial poses immediately so mother, baby, stone, bucket, and water are 100% posed on frame 1!
  momRig.root.position.set(world.mom.x, world.mom.y, world.mom.z);
  momRig.root.rotation.y = world.mom.yaw;
  momRig.root.updateMatrixWorld(true);
  if (world.baby.carrier === 'mom') {
    const bp0 = new THREE.Vector3();
    const bq0 = new THREE.Quaternion();
    momRig.bellyAnchor.getWorldPosition(bp0);
    momRig.bellyAnchor.getWorldQuaternion(bq0);
    babyRig.root.position.copy(bp0);
    babyRig.root.quaternion.copy(bq0);
  } else {
    babyRig.root.position.set(KELP_BABY_SPOT.x, -0.015, KELP_BABY_SPOT.z);
  }
  step(0.016);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
})(window);
