(function () {
  'use strict';

  const SAVE_KEY = 'piyopiyo_hiyoko_v1';

  // --- RENDERER & SCENE SETUP ---
  const canvas = document.getElementById('stage');
  const hintCanvas = document.getElementById('hint-layer');
  const hintCtx = hintCanvas.getContext('2d');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);

  // --- CORE SUBSYSTEMS ---
  const sound = new window.SoundEngine();
  const env = window.PiyoEnv.buildEnvironment(scene, renderer);
  const props = window.PiyoProps.buildProps(scene, env, sound);
  const { motherHen, chicks } = window.PiyoAnimals.buildAnimals(scene, env, sound);

  // --- GAME PROGRESSION & MEMORY STATE ---
  const state = {
    elapsed: 0,
    playTime: 0,          // Cumulative active play time for pacing (3-4 min eye-level, 5-8 min nap)
    idleSeconds: 0,       // Time since last touch (shows soft fingertip hint after ~4s)
    hasInteracted: false,
    totalGrainsEaten: 0,
    totalLeavesDropped: 0,
    hasPushedWater: false,
    hasSeenWaterDrink: false,
    hasSeenHenTidbit: false,
    hasOpenedDoor: false,
    hasFedOutdoor: false,
    eyeLevelBlend: 0,     // 0 = entrance 3/4 angle, 1 = chick eye-level height
    napPhaseActive: false,
    henCallTimer: 16,
    lastDropPos: new THREE.Vector3(0.88, 0.14, 0.98),
    lastDropTime: -10,
    zoneDropCounts: { dish_center: 0, straw_edge: 0, straw_left: 0, hen_front: 0, outdoor_dish: 0 },
    lastZoneChick: {}
  };

  // --- CAMERA RIG (Adaptive for iPhone 390x844 portrait & iPad 1180x820 landscape) ---
  const camCurrentPos = new THREE.Vector3(0.5, 4.0, 6.2);
  const camCurrentLook = new THREE.Vector3(0.15, 0.45, 0.48);
  const camTargetPos = new THREE.Vector3();
  const camTargetLook = new THREE.Vector3();
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;

  function computeCameraTargets() {
    const aspect = viewW / Math.max(1, viewH);
    const isPortrait = aspect < 0.92;
    const narrow = THREE.MathUtils.clamp((1.15 - aspect) / 0.72, 0, 1);

    // Compute smooth responsive vertical FOV so all 3 chicks, hen, box, dish & spoon fit cleanly
    const baseFov = isPortrait ? THREE.MathUtils.lerp(44, 55, narrow) : 38;
    if (Math.abs(camera.fov - baseFov) > 0.05) {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    }

    // Stage A: Initial entrance diagonal overview (clear view of all 3 chicks centered + hen + dish + spoon)
    const highPos = new THREE.Vector3(
      THREE.MathUtils.lerp(0.55, 0.25, narrow),
      THREE.MathUtils.lerp(3.85, 5.15, narrow),
      THREE.MathUtils.lerp(5.85, 7.65, narrow)
    );
    const highLook = new THREE.Vector3(
      THREE.MathUtils.lerp(0.18, 0.06, narrow),
      0.42,
      THREE.MathUtils.lerp(0.45, 0.62, narrow)
    );

    // Stage B: Chick eye-level height (~3-4 minutes: wooden box rim height, straw & hen feet up close!)
    const lowPos = new THREE.Vector3(
      THREE.MathUtils.lerp(0.68, 0.35, narrow),
      THREE.MathUtils.lerp(1.48, 2.08, narrow),
      THREE.MathUtils.lerp(4.75, 6.45, narrow)
    );
    const lowLook = new THREE.Vector3(
      THREE.MathUtils.lerp(0.12, 0.08, narrow),
      0.46,
      THREE.MathUtils.lerp(0.35, 0.48, narrow)
    );

    // Blend A -> B by eyeLevelBlend
    camTargetPos.copy(highPos).lerp(lowPos, state.eyeLevelBlend);
    camTargetLook.copy(highLook).lerp(lowLook, state.eyeLevelBlend);

    // Stage C: When the low wooden door opens, smoothly glide lower & sweep toward outdoor dewy grass!
    const doorOpen = env.door.openAmount;
    if (doorOpen > 0.01) {
      const outPos = new THREE.Vector3(
        THREE.MathUtils.lerp(1.65, 1.55, narrow),
        THREE.MathUtils.lerp(1.62, 2.35, narrow),
        THREE.MathUtils.lerp(5.55, 7.35, narrow)
      );
      const outLook = new THREE.Vector3(
        THREE.MathUtils.lerp(1.95, 1.82, narrow),
        0.38,
        0.48
      );
      const blend = Math.min(1, doorOpen * 1.15);
      camTargetPos.lerp(outPos, blend);
      camTargetLook.lerp(outLook, blend);
    } else if (getCurrentGuideTarget() === 'door' && isPortrait) {
      // Gently nudge framing slightly right on narrow phone when wooden door beckons
      camTargetPos.x += 0.52;
      camTargetLook.x += 0.48;
    }
  }

  function onResize() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / Math.max(1, viewH);
    camera.updateProjectionMatrix();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    hintCanvas.width = Math.round(viewW * dpr);
    hintCanvas.height = Math.round(viewH * dpr);
    hintCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    computeCameraTargets();
  }
  window.addEventListener('resize', onResize);

  // --- RAYCASTER & ONE-FINGER DIRECT INTERACTION ---
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const dragPlaneY = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.95);
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14);
  const doorPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -3.05);
  const hitPoint = new THREE.Vector3();

  let activeDrag = null; // { kind: 'spoon'|'leaf'|'water'|'door', pointerId, startX, startY, moved, ... }
  let spoonAutoAnim = null; // Quick forgiving sprinkle animation on first tap of spoon or dish!

  function getInteractiveMeshes() {
    return [
      props.spoon.hitMesh,
      props.feedDish.mesh,
      props.basket.hitMesh,
      props.waterDish.hitMesh,
      env.door.hitMesh,
      env.outdoorZone.dishMesh,
      motherHen.hitMesh,
      chicks[0].hitMesh,
      chicks[1].hitMesh,
      chicks[2].hitMesh
    ];
  }

  function setRayFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
  }

  function wakeFromNapIfNeeded() {
    if (!state.napPhaseActive) return;
    state.napPhaseActive = false;
    // Gently wake one chick first to peek out from beneath Mother Hen's feathers!
    chicks[0].wakeUpGentle();
    setTimeout(() => chicks[1].wakeUpGentle(), 950);
    setTimeout(() => chicks[2].wakeUpGentle(), 1850);
  }

  function triggerQuickSpoonSprinkle(targetVec) {
    // Smooth automatic lift-carry-tilt-sprinkle when a 5-year-old taps the spoon or dish!
    spoonAutoAnim = {
      t: 0,
      dur: 1.05,
      target: targetVec.clone(),
      grainsLeft: 7,
      emitTimer: 0
    };
  }

  function handlePointerDown(e) {
    if (activeDrag) return;
    sound.unlock();
    state.idleSeconds = 0;

    setRayFromClient(e.clientX, e.clientY);
    const hits = raycaster.intersectObjects(getInteractiveMeshes(), false);
    if (!hits.length) {
      // Do not react indiscriminately to empty background/walls!
      return;
    }

    const top = hits[0].object;
    const kind = top.userData.interactive;
    state.hasInteracted = true;

    if (kind === 'spoon') {
      wakeFromNapIfNeeded();
      spoonAutoAnim = null;
      props.spoon.isHeld = true;
      props.spoon.milletLevel = Math.max(0.75, props.spoon.milletLevel);
      props.spoon.updateGrainVisuals();
      activeDrag = {
        kind: 'spoon',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        dragSpeed: 0,
        holdTime: 0
      };
      // Immediate gentle sound & chick glance on first touch
      sound.playMilletPour(0.35);
      chicks[0].headCockAngle = 0.32;
      if (chicks[0].state === 'idle' || chicks[0].state === 'doze_one_leg') {
        chicks[0].state = 'head_cock';
        chicks[0].stateTimer = 0;
        chicks[0].targetPos.copy(props.feedDish.pos);
        chicks[0].nextStateAfterWalk = 'idle';
      }
      canvas.setPointerCapture(e.pointerId);
    } else if (kind === 'feed_dish') {
      wakeFromNapIfNeeded();
      triggerQuickSpoonSprinkle(new THREE.Vector3(props.feedDish.pos.x + 0.35, 0.95, props.feedDish.pos.z + 0.05));
    } else if (kind === 'outdoor_dish') {
      if (env.door.openAmount > 0.25) {
        wakeFromNapIfNeeded();
        triggerQuickSpoonSprinkle(new THREE.Vector3(env.outdoorDishPos.x + 0.32, 0.92, env.outdoorDishPos.z + 0.05));
      }
    } else if (kind === 'chickweed_basket') {
      wakeFromNapIfNeeded();
      const startLeafPos = props.basket.pos.clone().add(new THREE.Vector3(0, 0.55, 0));
      const leaf = props.basket.createWorldLeaf(startLeafPos, null);
      leaf.state = 'held_player';
      sound.playStrawRustle(0.3);
      activeDrag = {
        kind: 'leaf',
        pointerId: e.pointerId,
        leaf,
        startX: e.clientX,
        startY: e.clientY,
        moved: false
      };
      canvas.setPointerCapture(e.pointerId);
    } else if (kind === 'water_dish') {
      wakeFromNapIfNeeded();
      activeDrag = {
        kind: 'water',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        lastPos: props.waterDish.pos.clone()
      };
      canvas.setPointerCapture(e.pointerId);
    } else if (kind === 'door') {
      activeDrag = {
        kind: 'door',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOpen: env.door.openAmount,
        moved: false
      };
      canvas.setPointerCapture(e.pointerId);
    } else if (kind === 'chick') {
      // Gentle pet/tap on a chick: cute soft peep & tiny flutter/step!
      const idx = top.userData.chickIndex;
      const ch = chicks[idx];
      if (ch) {
        sound.playChirp(idx, ch.state === 'sleep_full' ? 'sleepy' : 'happy');
        ch.tailTwitch = 1.0;
        if (ch.state === 'idle' || ch.state === 'doze_one_leg') {
          ch.drowsy = false;
          ch.state = 'stretch_wing';
          ch.stateTimer = 0;
        }
      }
    } else if (kind === 'mother_hen') {
      // Gentle tap on Mother Hen: she warmly clucks and calls the chicks!
      motherHen.startCalling(motherHen.getFrontFeedSpot());
      notifyChicksOfHenCall(motherHen.getFrontFeedSpot());
    }
  }

  function handlePointerMove(e) {
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;
    state.idleSeconds = 0;

    const dxPx = e.clientX - activeDrag.startX;
    const dyPx = e.clientY - activeDrag.startY;
    if (Math.hypot(dxPx, dyPx) > 10) activeDrag.moved = true;

    setRayFromClient(e.clientX, e.clientY);

    if (activeDrag.kind === 'spoon') {
      const stepPx = Math.hypot(e.clientX - activeDrag.lastX, e.clientY - activeDrag.lastY);
      activeDrag.dragSpeed = activeDrag.dragSpeed * 0.72 + Math.min(1.5, stepPx / 18) * 0.28;
      activeDrag.lastX = e.clientX;
      activeDrag.lastY = e.clientY;

      if (raycaster.ray.intersectPlane(dragPlaneY, hitPoint)) {
        const maxX = env.door.openAmount > 0.3 ? 5.2 : 2.35;
        const tx = THREE.MathUtils.clamp(hitPoint.x + 0.18, -1.7, maxX);
        const tz = THREE.MathUtils.clamp(hitPoint.z, -1.25, 1.95);
        // Slightly higher when moving fast, dips smoothly over dish or straw
        const ty = 0.88 + Math.min(0.28, activeDrag.dragSpeed * 0.16);
        props.spoon.group.position.x += (tx - props.spoon.group.position.x) * 0.35;
        props.spoon.group.position.y += (ty - props.spoon.group.position.y) * 0.35;
        props.spoon.group.position.z += (tz - props.spoon.group.position.z) * 0.35;

        // Tilt increases naturally when positioned over the box/dish/outdoor dish or dragged briskly
        const overPlayArea = tx < 2.05 || (env.door.openAmount > 0.3 && tx > 3.55);
        const baseTilt = overPlayArea ? 0.56 : 0.12;
        const speedTilt = Math.min(0.44, activeDrag.dragSpeed * 0.42);
        props.spoon.tilt += ((baseTilt + speedTilt) - props.spoon.tilt) * 0.22;
      }
    } else if (activeDrag.kind === 'leaf') {
      if (raycaster.ray.intersectPlane(dragPlaneY, hitPoint)) {
        const maxX = env.door.openAmount > 0.3 ? 5.0 : 2.0;
        const lf = activeDrag.leaf;
        lf.x = THREE.MathUtils.clamp(hitPoint.x, -1.9, maxX);
        lf.y = 0.92;
        lf.z = THREE.MathUtils.clamp(hitPoint.z, -1.2, 2.0);
        lf.mesh.position.set(lf.x, lf.y, lf.z);
        lf.mesh.rotation.z = Math.sin(state.elapsed * 6) * 0.12;
      }
    } else if (activeDrag.kind === 'water') {
      if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
        const prevX = props.waterDish.pos.x;
        const prevZ = props.waterDish.pos.z;
        props.waterDish.setPosition(hitPoint.x, hitPoint.z);
        const movedDist = Math.hypot(props.waterDish.pos.x - prevX, props.waterDish.pos.z - prevZ);
        if (movedDist > 0.015) {
          sound.playCeramicSlide(movedDist * 14);
          if (Math.random() < 0.25) props.waterDish.triggerRipple();
        }
        if (props.waterDish.pushedClose && !state.hasPushedWater) {
          state.hasPushedWater = true;
          inviteThirstyChickToWater();
        }
      }
    } else if (activeDrag.kind === 'door') {
      // Intuitive horizontal drag (or leftward/up-left screen drag) slides the low wooden door open!
      if (raycaster.ray.intersectPlane(doorPlane, hitPoint)) {
        const zOpen = THREE.MathUtils.clamp((env.door.closedZ - hitPoint.z) / (env.door.closedZ - env.door.openZ), 0, 1);
        const prev = env.door.openAmount;
        env.door.setOpen(prev + (zOpen - prev) * 0.45);
        if (Math.abs(env.door.openAmount - prev) > 0.008) {
          sound.playWoodSlide(Math.abs(env.door.openAmount - prev) * 30);
        }
      } else {
        // Fallback screen-space horizontal/vertical swipe
        const delta = (-dxPx - dyPx * 0.45) / 170;
        env.door.setOpen(activeDrag.startOpen + delta);
      }
      if (env.door.openAmount > 0.45) {
        if (!state.hasOpenedDoor) {
          state.hasOpenedDoor = true;
          inviteChickOutdoors();
        }
      }
    }
  }

  function handlePointerUp(e) {
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;
    const drag = activeDrag;
    activeDrag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

    if (drag.kind === 'spoon') {
      props.spoon.isHeld = false;
      props.spoon.tilt = 0;
      if (!drag.moved) {
        // Quick tap on spoon -> forgiving graceful sprinkle right into terracotta dish!
        triggerQuickSpoonSprinkle(new THREE.Vector3(props.feedDish.pos.x + 0.35, 0.94, props.feedDish.pos.z + 0.06));
      }
    } else if (drag.kind === 'leaf') {
      const lf = drag.leaf;
      if (!drag.moved) {
        // Quick tap on chickweed basket -> gently tosses a dewy leaf into the center of the box!
        lf.x = -0.05 + (Math.random() - 0.5) * 0.5;
        lf.y = 1.05;
        lf.z = 0.42 + (Math.random() - 0.5) * 0.4;
      }
      lf.state = 'falling';
      lf.vy = -0.4;
      state.totalLeavesDropped++;
      setTimeout(() => notifyChicksOfLeaf(lf), 420);
    } else if (drag.kind === 'water') {
      if (!drag.moved) {
        // Gentle tap nudges the water dish closer to the chicks!
        const nextZ = props.waterDish.pushedClose ? 1.24 : 1.32;
        props.waterDish.setPosition(-0.46, nextZ);
        sound.playCeramicSlide(0.5);
        props.waterDish.triggerRipple();
        state.hasPushedWater = true;
        inviteThirstyChickToWater();
      } else if (props.waterDish.pushedClose) {
        inviteThirstyChickToWater();
      }
    } else if (drag.kind === 'door') {
      if (!drag.moved) {
        // Tapping the door smoothly toggles open/closed!
        const nextOpen = env.door.openAmount < 0.5 ? 0.92 : 0.0;
        env.door.targetOpen = nextOpen;
        sound.playWoodSlide(0.7);
        if (nextOpen > 0.5) {
          state.hasOpenedDoor = true;
          setTimeout(inviteChickOutdoors, 450);
        }
      }
    }

    scheduleSave();
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);

  // --- CHICK & HEN BEHAVIOR COORDINATION ---
  function onGrainLanded(grain) {
    state.zoneDropCounts[grain.zone] = (state.zoneDropCounts[grain.zone] || 0) + 1;
    state.lastDropPos.set(grain.x, grain.y, grain.z);
    state.lastDropTime = state.elapsed;

    // 1) If child drops millet right in front of Mother Hen -> Mother Hen tidbits it to a chick!
    const distHenFront = Math.hypot(grain.x - motherHen.getFrontFeedSpot().x, grain.z - motherHen.getFrontFeedSpot().z);
    if (distHenFront < 0.72 && (motherHen.state === 'watch' || motherHen.state === 'call')) {
      // Choose a chick not currently carrying a leaf
      const recipient = chicks.find(c => !c.isOutside() && c.state !== 'carry_leaf' && c.state !== 'tug_leaf') || chicks[0];
      if (motherHen.startTidbitTransfer(grain, recipient)) {
        state.hasSeenHenTidbit = true;
        return;
      }
    }

    // 2) Outdoor grain: invite outdoor chick, or if door is open invite curious chick outside!
    if (grain.zone === 'outdoor_dish' || grain.x > 3.25) {
      state.hasFedOutdoor = true;
      const outChick = chicks.find(c => c.isOutside() && c.state !== 'peck_grain');
      if (outChick) {
        outChick.directToGrain(grain, true);
        return;
      }
      if (env.door.openAmount > 0.32) {
        const venturer = chicks[0];
        if (venturer.state !== 'carry_leaf' && venturer.state !== 'tug_leaf') {
          venturer.directToGrain(grain, true);
          sound.playChirp(0, 'happy');
        }
      }
      return;
    }

    // 3) Discovery #1 & #6: Drop location decides WHICH chick(s) come!
    // Check if all 3 chicks are clustered at another spot and this is a lone far drop
    const indoorChicks = chicks.filter(c => !c.isOutside() && c.state !== 'carry_leaf' && c.state !== 'tug_leaf');
    if (!indoorChicks.length) return;

    if (grain.zone === 'dish_center') {
      // Center of terracotta dish: first chick cocks head & trots over, remaining 2 follow slightly later!
      const free = indoorChicks.filter(c => c.state !== 'peck_grain');
      if (free.length) {
        const first = free[0];
        first.directToGrain(grain, true);
        // Remaining chicks gently follow toward the dish slightly delayed so they gather heads together!
        for (let i = 1; i < indoorChicks.length; i++) {
          const ch = indoorChicks[i];
          if (ch.state === 'idle' || ch.state === 'doze_one_leg' || ch.state === 'tuck_under_hen') {
            setTimeout(() => {
              const otherGrain = findNearestAvailableGrain(ch.pos, false, 'dish_center');
              if (otherGrain) ch.directToGrain(otherGrain, true);
              else {
                const ang = i * 2.1 + 0.5;
                ch.directToPosition(new THREE.Vector3(
                  props.feedDish.pos.x + Math.cos(ang) * 0.45,
                  ch.pos.y,
                  props.feedDish.pos.z + Math.sin(ang) * 0.45
                ), 'idle');
              }
            }, 380 * i);
          }
        }
      }
    } else {
      // Spilled at the straw edge / far spot: ONLY the most curious chick (Chick 0) or closest free chick investigates!
      const curio = indoorChicks.find(c => c.index === 0) || indoorChicks[0];
      if (curio && curio.state !== 'peck_grain') {
        curio.directToGrain(grain, true);
      } else {
        const alt = indoorChicks.find(c => c.state === 'idle' || c.state === 'doze_one_leg');
        if (alt) alt.directToGrain(grain, true);
      }
    }
  }

  function findNearestAvailableGrain(fromPos, outsideOnly, preferZone) {
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < props.grains.length; i++) {
      const g = props.grains[i];
      if (!g.active || g.state !== 'settled' || g.reservedBy >= 0) continue;
      const isOut = g.x > 3.22;
      if (outsideOnly === true && !isOut) continue;
      if (outsideOnly === false && isOut) continue;
      let d = Math.hypot(g.x - fromPos.x, g.z - fromPos.z);
      if (preferZone && g.zone === preferZone) d *= 0.6;
      if (g.giftedByHen) d *= 0.45;
      if (d < bestScore) {
        bestScore = d;
        best = g;
      }
    }
    return best;
  }

  function notifyChicksOfLeaf(leaf) {
    if (!leaf || (leaf.state !== 'ground' && leaf.state !== 'falling')) return;
    const isOut = leaf.x > 3.22;
    const candidates = chicks.filter(c => c.isOutside() === isOut || (isOut && env.door.openAmount > 0.35));
    if (!candidates.length) return;

    // First chick runs to grab the chickweed leaf; second chick chases right behind to tug!
    const grabber = candidates[0];
    grabber.directToLeaf(leaf);
    if (candidates.length > 1) {
      const chaser = candidates[1];
      setTimeout(() => {
        if (leaf.state === 'carried' || leaf.state === 'ground') {
          chaser.directToLeaf(leaf);
        }
      }, 650);
    }
  }

  function inviteThirstyChickToWater() {
    if (!props.waterDish.pushedClose) return;
    // Prefer a chick that has eaten some dry millet
    const sorted = chicks
      .filter(c => !c.isOutside() && c.state !== 'carry_leaf' && c.state !== 'tug_leaf' && c.state !== 'sleep_full')
      .sort((a, b) => b.thirst - a.thirst);
    if (sorted.length) {
      sorted[0].directToWater(props.waterDish.pos);
    }
  }

  function inviteChickOutdoors() {
    if (env.door.openAmount < 0.38) return;
    // Most curious chick ventures out one by one into the dewy morning grass!
    const curio = chicks[0];
    if (!curio.isOutside() && curio.state !== 'sleep_full') {
      curio.directToPosition(new THREE.Vector3(3.95, 0.0, 0.72), 'idle');
      sound.playChirp(0, 'happy');
    }
  }

  function notifyChicksOfHenCall(callPos) {
    for (let i = 0; i < chicks.length; i++) {
      const ch = chicks[i];
      if (!ch.isOutside() && (ch.state === 'idle' || ch.state === 'doze_one_leg' || ch.state === 'walk_to')) {
        if (ch.state !== 'peck_grain') {
          ch.directToPosition(new THREE.Vector3(
            callPos.x + (i - 1) * 0.25,
            ch.pos.y,
            callPos.z + 0.16 + i * 0.08
          ), 'idle');
        }
      }
    }
  }

  function onChickAteGrain(chick, zone, wasGiftedByHen) {
    state.totalGrainsEaten++;
    state.lastZoneChick[zone] = chick.index;

    // If chick ate the grain gifted by Mother Hen -> Mother Hen fluffs her feathers contentedly!
    if (wasGiftedByHen) {
      motherHen.playSatisfiedFluff();
    }

    // If chick got thirsty and water dish is pushed close, occasionally trot for a sip!
    if (props.waterDish.pushedClose && chick.thirst >= 0.65 && !chick.isOutside() && Math.random() < 0.45) {
      chick.directToWater(props.waterDish.pos);
      return;
    }

    // Check if there is another available grain nearby so chick keeps pecking naturally
    const nextG = findNearestAvailableGrain(chick.pos, chick.isOutside() ? true : (env.door.openAmount > 0.35 ? null : false));
    if (nextG && chick.fullness < 0.92) {
      chick.directToGrain(nextG, false);
    }

    // Check cozy 5-8 minute nap finale when all 3 chicks are full!
    const allFull = chicks.every(c => c.fullness >= 0.90);
    if (allFull && state.totalGrainsEaten >= 18 && !state.napPhaseActive) {
      beginCozyNapFinale();
    }

    scheduleSave();
  }

  function onChickDrank(chick) {
    state.hasSeenWaterDrink = true;
    scheduleSave();
  }

  function beginCozyNapFinale() {
    state.napPhaseActive = true;
    // Tuck one by one beneath Mother Hen's belly feathers!
    chicks.forEach((ch, idx) => {
      setTimeout(() => {
        if (!state.napPhaseActive) return;
        const slot = motherHen.getShelterSlot(idx);
        ch.directToPosition(slot, 'sleep_full');
      }, idx * 1400);
    });
  }

  // --- DIEGETIC SINGLE-OBJECT GUIDANCE & 4-SECOND TRANSLUCENT FINGERTIP ---
  function getCurrentGuideTarget() {
    if (state.napPhaseActive) return 'spoon'; // Touching spoon again quietly begins a new morning play!
    if (state.totalGrainsEaten < 4) return 'spoon';
    if (state.totalLeavesDropped === 0 && (state.totalGrainsEaten >= 7 || state.playTime > 85)) return 'basket';
    if (!state.hasPushedWater && (state.totalGrainsEaten >= 10 || state.playTime > 125)) return 'water';
    if (!state.hasSeenHenTidbit && (state.totalGrainsEaten >= 13 || state.playTime > 160)) return 'hen_front';
    if (!state.hasOpenedDoor && (state.totalGrainsEaten >= 15 || state.playTime > 195)) return 'door';
    if (env.door.openAmount > 0.45 && !state.hasFedOutdoor) return 'outdoor_dish';
    return 'spoon';
  }

  function updateDiegeticHighlights(elapsed) {
    const pulse = (Math.sin(elapsed * 3.4) * 0.5 + 0.5);
    const guide = getCurrentGuideTarget();

    // Only ONE world object gently shimmers/pulses at a time!
    props.spoon.setHighlight(guide === 'spoon' && !activeDrag ? pulse : 0, elapsed);
    props.feedDish.setHighlight(guide === 'spoon' && activeDrag && activeDrag.kind === 'spoon' ? pulse * 0.9 : 0);
    props.basket.setHighlight(guide === 'basket' && !activeDrag ? pulse : 0, elapsed);
    props.waterDish.setHighlight(guide === 'water' && !activeDrag ? pulse : 0, elapsed);
    motherHen.setHighlight(guide === 'hen_front' ? pulse : 0);
    env.door.setHighlight(guide === 'door' && !activeDrag ? pulse : 0);
    env.outdoorZone.setHighlight(guide === 'outdoor_dish' ? pulse : 0);
  }

  function projectToScreen(worldVec) {
    const v = worldVec.clone().project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * viewW,
      y: (-v.y * 0.5 + 0.5) * viewH
    };
  }

  function drawGhostFingerHint() {
    hintCtx.clearRect(0, 0, viewW, viewH);
    if (activeDrag || state.idleSeconds < 4.0) return;

    const fadeIn = Math.min(1, (state.idleSeconds - 4.0) / 0.85);
    const guide = getCurrentGuideTarget();
    const cycle = ((state.idleSeconds - 4.0) % 2.8) / 2.8;

    let fromW, toW;
    if (guide === 'spoon' || guide === 'hen_front') {
      fromW = props.spoon.restPos.clone().add(new THREE.Vector3(0.25, 0.05, 0.05));
      toW = guide === 'hen_front'
        ? motherHen.getFrontFeedSpot().add(new THREE.Vector3(0.2, 0.55, 0.0))
        : props.feedDish.pos.clone().add(new THREE.Vector3(0.15, 0.55, 0.0));
    } else if (guide === 'basket') {
      fromW = props.basket.pos.clone().add(new THREE.Vector3(0, 0.35, 0));
      toW = new THREE.Vector3(0.1, 0.55, 0.45);
    } else if (guide === 'water') {
      fromW = props.waterDish.pos.clone().add(new THREE.Vector3(0, 0.12, 0));
      toW = new THREE.Vector3(-0.48, 0.14, 1.25);
    } else if (guide === 'door') {
      fromW = env.door.knob.getWorldPosition(new THREE.Vector3());
      toW = fromW.clone().add(new THREE.Vector3(0, 0, -1.25));
    } else if (guide === 'outdoor_dish') {
      fromW = props.spoon.restPos.clone();
      toW = env.outdoorDishPos.clone().add(new THREE.Vector3(0.15, 0.55, 0));
    } else {
      return;
    }

    const p0 = projectToScreen(fromW);
    const p1 = projectToScreen(toW);

    // Smooth ease-in-out motion along curved arc
    let alpha = fadeIn;
    let t = 0;
    if (cycle < 0.18) {
      t = 0;
      alpha *= cycle / 0.18;
    } else if (cycle < 0.78) {
      const u = (cycle - 0.18) / 0.60;
      t = u * u * (3 - 2 * u);
    } else {
      t = 1;
      alpha *= (1 - (cycle - 0.78) / 0.22);
    }

    const arcLift = Math.sin(t * Math.PI) * 32;
    const fx = p0.x + (p1.x - p0.x) * t;
    const fy = p0.y + (p1.y - p0.y) * t - arcLift;

    hintCtx.save();
    // Soft translucent warm ripple at touch contact point
    const ringR = 14 + (cycle < 0.18 ? (1 - cycle / 0.18) * 10 : Math.sin(t * Math.PI) * 4);
    hintCtx.beginPath();
    hintCtx.arc(fx, fy, ringR, 0, Math.PI * 2);
    hintCtx.strokeStyle = `rgba(255, 248, 226, ${(alpha * 0.52).toFixed(3)})`;
    hintCtx.lineWidth = 2.5;
    hintCtx.stroke();

    // Translucent soft child-sized fingertip silhouette (minimal, no hand/arm/arrows/text)
    const grad = hintCtx.createRadialGradient(fx - 3, fy - 4, 2, fx, fy + 6, 22);
    grad.addColorStop(0, `rgba(255, 244, 228, ${(alpha * 0.68).toFixed(3)})`);
    grad.addColorStop(0.65, `rgba(246, 220, 194, ${(alpha * 0.44).toFixed(3)})`);
    grad.addColorStop(1, `rgba(246, 220, 194, 0)`);
    hintCtx.fillStyle = grad;
    hintCtx.beginPath();
    hintCtx.ellipse(fx, fy + 8, 13, 19, -0.18, 0, Math.PI * 2);
    hintCtx.fill();

    // Subtle soft fingernail oval hint on the translucent fingertip
    hintCtx.fillStyle = `rgba(255, 252, 246, ${(alpha * 0.42).toFixed(3)})`;
    hintCtx.beginPath();
    hintCtx.ellipse(fx - 1, fy - 1, 6.5, 8.2, -0.18, 0, Math.PI * 2);
    hintCtx.fill();
    hintCtx.restore();
  }

  // --- PERSISTENCE (localStorage) ---
  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveState();
    }, 900);
  }

  function saveState() {
    try {
      const settledGrains = [];
      for (let i = 0; i < props.grains.length; i++) {
        const g = props.grains[i];
        if (g.active && g.state === 'settled') {
          settledGrains.push([
            +g.x.toFixed(3), +g.y.toFixed(3), +g.z.toFixed(3),
            g.buried ? 1 : 0, g.giftedByHen ? 1 : 0
          ]);
        }
      }
      const savedLeaves = props.worldLeaves
        .filter(l => l.state === 'ground' || l.state === 'scrap')
        .slice(0, 10)
        .map(l => ({
          x: +l.x.toFixed(3), y: +l.y.toFixed(3), z: +l.z.toFixed(3),
          kind: l.kind, state: l.state, sc: +l.scrapScale.toFixed(2)
        }));

      const payload = {
        v: 1,
        playTime: +state.playTime.toFixed(1),
        totalGrainsEaten: state.totalGrainsEaten,
        totalLeavesDropped: state.totalLeavesDropped,
        hasPushedWater: state.hasPushedWater,
        hasSeenWaterDrink: state.hasSeenWaterDrink,
        hasSeenHenTidbit: state.hasSeenHenTidbit,
        hasOpenedDoor: state.hasOpenedDoor,
        hasFedOutdoor: state.hasFedOutdoor,
        eyeLevelBlend: +state.eyeLevelBlend.toFixed(3),
        napPhaseActive: state.napPhaseActive,
        doorOpen: +env.door.openAmount.toFixed(3),
        waterPos: [+props.waterDish.pos.x.toFixed(3), +props.waterDish.pos.z.toFixed(3)],
        spoonRotY: +props.spoon.group.rotation.y.toFixed(3),
        spoonMillet: Math.max(0.75, +props.spoon.milletLevel.toFixed(2)), // Always keep playable millet!
        chicks: chicks.map(c => ({
          x: +c.pos.x.toFixed(3),
          y: +c.pos.y.toFixed(3),
          z: +c.pos.z.toFixed(3),
          facing: +c.facing.toFixed(3),
          fullness: +c.fullness.toFixed(3),
          drowsy: c.drowsy || c.state === 'doze_one_leg' || c.state === 'sleep_full',
          sleeping: c.state === 'sleep_full',
          tucked: c.state === 'tuck_under_hen',
          memory: c.memory
        })),
        grains: settledGrains.slice(0, 60),
        leaves: savedLeaves
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (_) {
      // Ignore storage quota / privacy mode errors
    }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return false;

      state.playTime = data.playTime || 0;
      state.totalGrainsEaten = data.totalGrainsEaten || 0;
      state.totalLeavesDropped = data.totalLeavesDropped || 0;
      state.hasPushedWater = !!data.hasPushedWater;
      state.hasSeenWaterDrink = !!data.hasSeenWaterDrink;
      state.hasSeenHenTidbit = !!data.hasSeenHenTidbit;
      state.hasOpenedDoor = !!data.hasOpenedDoor;
      state.hasFedOutdoor = !!data.hasFedOutdoor;
      state.eyeLevelBlend = THREE.MathUtils.clamp(data.eyeLevelBlend || 0, 0, 1);
      state.napPhaseActive = !!data.napPhaseActive;

      env.door.setOpen(data.doorOpen || 0);
      if (Array.isArray(data.waterPos) && data.waterPos.length === 2) {
        props.waterDish.setPosition(data.waterPos[0], data.waterPos[1]);
      }
      props.spoon.milletLevel = Math.max(0.78, data.spoonMillet || 1.0);
      props.spoon.updateGrainVisuals();
      if (typeof data.spoonRotY === 'number') {
        props.spoon.restRot.y = THREE.MathUtils.clamp(data.spoonRotY, -1.1, 0.2);
        props.spoon.group.rotation.y = props.spoon.restRot.y;
      }

      if (Array.isArray(data.chicks) && data.chicks.length === 3) {
        for (let i = 0; i < 3; i++) {
          const sc = data.chicks[i];
          const ch = chicks[i];
          ch.pos.set(sc.x, sc.y, sc.z);
          ch.root.position.copy(ch.pos);
          ch.facing = sc.facing || 0;
          ch.root.rotation.y = ch.facing;
          ch.fullness = THREE.MathUtils.clamp(sc.fullness || 0, 0, 1);
          ch.drowsy = !!sc.drowsy;
          if (sc.memory) Object.assign(ch.memory, sc.memory);
          if (sc.sleeping) ch.state = 'sleep_full';
          else if (sc.tucked) ch.state = 'tuck_under_hen';
          else if (sc.drowsy) ch.state = 'doze_one_leg';
        }
      }

      if (Array.isArray(data.grains)) {
        for (const sg of data.grains) {
          props.spawnGrain(
            new THREE.Vector3(sg[0], sg[1], sg[2]),
            null,
            { settled: true, buried: !!sg[3], giftedByHen: !!sg[4] }
          );
        }
      }
      if (Array.isArray(data.leaves)) {
        for (const sl of data.leaves) {
          const lf = props.basket.createWorldLeaf(new THREE.Vector3(sl.x, sl.y, sl.z), sl.kind === 'whole' ? null : sl.kind);
          lf.state = sl.state || 'scrap';
          lf.scrapScale = sl.sc || 0.5;
          lf.mesh.scale.setScalar(lf.scrapScale);
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
  });
  window.addEventListener('pagehide', saveState);

  // Restore saved morning state (or seed a few welcoming grains in the dish/straw)
  const restored = restoreState();
  if (!restored) {
    // Seed 3 tiny golden millet grains on the terracotta dish so the world feels lived-in right away
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      props.spawnGrain(
        new THREE.Vector3(props.feedDish.pos.x + Math.cos(a) * 0.14, props.feedDish.pos.y + 0.06, props.feedDish.pos.z + Math.sin(a) * 0.12),
        null,
        { settled: true }
      );
    }
  }

  // Initialize camera and render immediately on frame 0 (no blank/delayed first frame!)
  onResize();
  camCurrentPos.copy(camTargetPos);
  camCurrentLook.copy(camTargetLook);
  camera.position.copy(camCurrentPos);
  camera.lookAt(camCurrentLook);
  props.updateGrains(0.016, null);
  motherHen.update(0.016, 0, chicks);
  {
    const initCtx = { env, props, motherHen, chicks, onChickAteGrain, onChickDrank };
    for (let i = 0; i < chicks.length; i++) chicks[i].update(0.016, 0, initCtx);
  }
  updateDiegeticHighlights(0);
  renderer.render(scene, camera);

  // --- MAIN ANIMATION LOOP ---
  let lastTime = performance.now();

  function updateSpoon(dt) {
    const sp = props.spoon;

    // Velocity tracking for ballistic grain arcs
    sp.velocity.subVectors(sp.group.position, sp.lastPos).divideScalar(Math.max(0.008, dt));
    sp.lastPos.copy(sp.group.position);

    if (spoonAutoAnim) {
      spoonAutoAnim.t += dt;
      const p = Math.min(1, spoonAutoAnim.t / spoonAutoAnim.dur);
      if (p < 0.28) {
        const u = p / 0.28;
        sp.group.position.lerpVectors(sp.restPos, spoonAutoAnim.target, u * u * (3 - 2 * u));
        sp.tilt = u * 0.72;
      } else if (p < 0.74) {
        sp.group.position.copy(spoonAutoAnim.target);
        sp.tilt = 0.78;
        spoonAutoAnim.emitTimer += dt;
        if (spoonAutoAnim.grainsLeft > 0 && spoonAutoAnim.emitTimer >= 0.055) {
          spoonAutoAnim.emitTimer = 0;
          spoonAutoAnim.grainsLeft--;
          emitGrainFromSpoon(0.35);
        }
      } else {
        const u = (p - 0.74) / 0.26;
        sp.group.position.lerpVectors(spoonAutoAnim.target, sp.restPos, u * u * (3 - 2 * u));
        sp.tilt = (1 - u) * 0.72;
      }
      if (p >= 1) {
        spoonAutoAnim = null;
        sp.tilt = 0;
      }
    } else if (sp.isHeld) {
      // Pour continuously based on tilt angle!
      // Gentle tilt -> drops slowly in dish center; steeper/faster tilt -> arcs onto straw!
      if (sp.tilt > 0.24) {
        const rate = (sp.tilt - 0.20) * 19.5; // grains per second
        sp.pourCarry += rate * dt;
        while (sp.pourCarry >= 1.0) {
          sp.pourCarry -= 1.0;
          emitGrainFromSpoon(sp.tilt);
        }
      }
    } else {
      // Smoothly return spoon to rest on the millet bowl & softly replenish millet
      sp.group.position.lerp(sp.restPos, Math.min(1, dt * 6.5));
      sp.tilt += (0 - sp.tilt) * Math.min(1, dt * 8);
      if (sp.milletLevel < 1.0) {
        sp.milletLevel = Math.min(1.0, sp.milletLevel + dt * 0.35);
        sp.updateGrainVisuals();
      }
    }

    // Apply natural tilt & roll rotation to wooden spoon
    const targetRotZ = sp.restRot.z + sp.tilt * 0.78;
    const targetRotX = sp.restRot.x + sp.tilt * 0.22;
    const targetRotY = sp.restRot.y + (sp.isHeld ? 0.32 : 0);
    sp.group.rotation.x += (targetRotX - sp.group.rotation.x) * Math.min(1, dt * 12);
    sp.group.rotation.y += (targetRotY - sp.group.rotation.y) * Math.min(1, dt * 10);
    sp.group.rotation.z += (targetRotZ - sp.group.rotation.z) * Math.min(1, dt * 12);
  }

  function emitGrainFromSpoon(tiltStrength) {
    const sp = props.spoon;
    const tip = sp.getTipWorldPos(sp.tipWorldPos);
    // Slow tilt -> drops gently straight down; fast movement or steep tilt -> arcs further onto straw!
    const spread = 0.25 + tiltStrength * 0.55;
    const vx = sp.velocity.x * 0.36 - (0.35 + tiltStrength * 0.65) + (Math.random() - 0.5) * spread;
    const vy = -0.35 + sp.velocity.y * 0.18 + (Math.random() - 0.5) * 0.15;
    const vz = sp.velocity.z * 0.36 + (Math.random() - 0.5) * spread;

    props.spawnGrain(
      new THREE.Vector3(tip.x + (Math.random() - 0.5) * 0.05, tip.y - 0.02, tip.z + (Math.random() - 0.5) * 0.05),
      new THREE.Vector3(vx, vy, vz),
      null
    );
    sound.playMilletPour(tiltStrength);
    sp.milletLevel = Math.max(0.28, sp.milletLevel - 0.015);
    sp.updateGrainVisuals();
  }

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.max(0.001, Math.min(0.05, (now - lastTime) / 1000));
    lastTime = now;

    state.elapsed += dt;
    if (!activeDrag) state.idleSeconds += dt;
    if (state.hasInteracted) state.playTime += dt;

    // 1) Smooth camera eye-level lowering around 3-4 minutes (or after rich exploration!)
    const shouldLowerEyeLevel = state.playTime > 175 || (state.totalGrainsEaten >= 12 && state.hasSeenWaterDrink);
    if (shouldLowerEyeLevel && state.eyeLevelBlend < 1.0) {
      state.eyeLevelBlend = Math.min(1.0, state.eyeLevelBlend + dt * 0.055);
    }

    // Smooth sliding wooden door animation if tapped
    if (!activeDrag || activeDrag.kind !== 'door') {
      if (Math.abs(env.door.targetOpen - env.door.openAmount) > 0.002) {
        env.door.openAmount += (env.door.targetOpen - env.door.openAmount) * Math.min(1, dt * 6);
        env.door.group.position.z = env.door.closedZ + (env.door.openZ - env.door.closedZ) * env.door.openAmount;
      }
    }

    // 2) Update spoon, ballistic millet grains, chickweed leaves, water dish, straw & grass
    updateSpoon(dt);
    props.updateGrains(dt, onGrainLanded);
    props.updateWorldLeaves(dt);
    props.waterDish.update(dt, state.elapsed);
    env.update(dt, state.elapsed);

    // 3) Mother Hen autonomous warm calling after repeated feedings
    if (state.totalGrainsEaten >= 5 && !state.napPhaseActive) {
      state.henCallTimer -= dt;
      if (state.henCallTimer <= 0 && motherHen.state === 'watch') {
        state.henCallTimer = 18 + Math.random() * 12;
        const callSpot = motherHen.getFrontFeedSpot();
        motherHen.startCalling(callSpot);
        notifyChicksOfHenCall(callSpot);
      }
    }

    // Mother Hen looks gently toward the spoon when held, otherwise the active chick
    if (props.spoon.isHeld) {
      motherHen.lookTarget.copy(props.spoon.group.position);
    } else {
      const focusChick = chicks[Math.abs(Math.floor(state.elapsed * 0.2)) % chicks.length];
      motherHen.lookTarget.copy(focusChick.pos).add(new THREE.Vector3(0, 0.3, 0));
    }
    motherHen.update(dt, state.elapsed, chicks);

    // 4) Update all 3 chicks
    const chickCtx = { env, props, motherHen, chicks, onChickAteGrain, onChickDrank };
    for (let i = 0; i < chicks.length; i++) {
      chicks[i].update(dt, state.elapsed, chickCtx);
    }

    // Gentle soft chick-to-chick separation so they crowd close without overlapping meshes
    for (let i = 0; i < chicks.length; i++) {
      for (let j = i + 1; j < chicks.length; j++) {
        const a = chicks[i];
        const b = chicks[j];
        if (a.isTuckedUnderHen() && b.isTuckedUnderHen()) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const minSep = 0.44;
        if (d > 0.001 && d < minSep) {
          const push = (minSep - d) * 0.5 * Math.min(1, dt * 10);
          const nx = dx / d;
          const nz = dz / d;
          if (a.isOutside() === b.isOutside()) {
            a.pos.x -= nx * push;
            a.pos.z -= nz * push;
            b.pos.x += nx * push;
            b.pos.z += nz * push;
          }
        }
      }
    }

    // Idle chicks automatically notice unclaimed grains or whole chickweed leaves nearby!
    if (Math.floor(state.elapsed * 2) !== Math.floor((state.elapsed - dt) * 2)) {
      for (let i = 0; i < chicks.length; i++) {
        const ch = chicks[i];
        if (ch.state === 'idle' && ch.fullness < 0.92) {
          // Check whole chickweed leaf first if any on ground or being carried
          const liveLeaf = props.worldLeaves.find(l =>
            (l.state === 'ground' || (l.state === 'carried' && l.kind === 'whole' && l.holderA !== ch.index && l.holderB < 0)) &&
            ((l.x > 3.22) === ch.isOutside())
          );
          if (liveLeaf) {
            ch.directToLeaf(liveLeaf);
            continue;
          }
          const g = findNearestAvailableGrain(ch.pos, ch.isOutside() ? true : (env.door.openAmount > 0.35 ? null : false));
          if (g) ch.directToGrain(g, true);
        }
      }
    }

    // 5) Smooth camera tracking & diegetic guidance
    computeCameraTargets();
    camCurrentPos.lerp(camTargetPos, Math.min(1, dt * 2.4));
    camCurrentLook.lerp(camTargetLook, Math.min(1, dt * 2.8));
    camera.position.copy(camCurrentPos);
    camera.lookAt(camCurrentLook);

    updateDiegeticHighlights(state.elapsed);
    renderer.render(scene, camera);
    drawGhostFingerHint();
  }

  requestAnimationFrame(tick);
})();
