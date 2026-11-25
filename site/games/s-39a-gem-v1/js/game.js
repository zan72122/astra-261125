window.RPP = window.RPP || {};

RPP.Game = (function () {
  const SAVE_KEY = 'lesser_panda_apple_v1';

  function init() {
    const glCanvas = document.getElementById('gl-canvas');
    const hintCanvas = document.getElementById('hint-canvas');
    const hintCtx = hintCanvas.getContext('2d');

    const renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcde0f0);

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);

    // Build World, Food, and Two Red Pandas
    const world = RPP.World.create(scene);
    const foodMgr = RPP.Food.create(scene, world);

    // Panda 1: right in center of hero thick branch on Frame 1, 3/4 view showing face, body & full ringed tail!
    const panda1 = new RPP.RedPanda.RedPanda(0, scene, world, foodMgr, {
      variant: 0,
      startNode: 'midCenter',
      startYaw: -0.52,
      startState: 'idle_sit',
    });

    // Panda 2: nestled inside the warm-lit tree hollow, emerges mid-play!
    const panda2 = new RPP.RedPanda.RedPanda(1, scene, world, foodMgr, {
      variant: 1,
      startNode: 'hollowIn',
      startYaw: 0.52,
      startState: 'idle_sit',
    });

    const pandas = [panda1, panda2];

    // =========================================================================
    // PROGRESSION & SAVE STATE
    // =========================================================================
    let playTime = 0; // Active play seconds
    let totalFeeds = 0;
    let cameraStage = 0; // 0 = oblique base view -> 1 = branch eye-level view (~3-4 min)
    let targetCameraStage = 0;
    let finaleMode = false;
    let dishesUsed = new Set();
    const hasEverPlacedType = { apple: false, bamboo: false, grape: false };
    let lastInteractionTime = 0;
    let elapsed = 0;
    let lastSaveTime = 0;

    function saveState() {
      try {
        const data = {
          version: 1,
          playTime,
          totalFeeds,
          cameraStage: targetCameraStage,
          finaleMode,
          dishesUsed: Array.from(dishesUsed),
          hasEverPlacedType,
          hollowCleared: world.getHollowCleared(),
          food: foodMgr.serialize(),
          pandas: pandas.map((p) => p.serialize()),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch (e) {
        // Ignore storage errors in restricted modes
      }
    }

    function restoreState() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || data.version !== 1) return;

        playTime = data.playTime || 0;
        totalFeeds = data.totalFeeds || 0;
        targetCameraStage = data.cameraStage || 0;
        cameraStage = targetCameraStage;
        finaleMode = !!data.finaleMode;
        if (Array.isArray(data.dishesUsed)) dishesUsed = new Set(data.dishesUsed);
        if (data.hasEverPlacedType) Object.assign(hasEverPlacedType, data.hasEverPlacedType);
        if (data.hollowCleared != null) world.setHollowCleared(data.hollowCleared);
        if (data.food) foodMgr.restore(data.food);
        if (Array.isArray(data.pandas)) {
          for (let i = 0; i < Math.min(2, data.pandas.length); i++) {
            pandas[i].restore(data.pandas[i]);
          }
        }
        if (finaleMode) {
          world.setTargetSnowIntensity(1.0);
        }
      } catch (e) {
        // Start fresh cleanly if saved state is unreadable
      }
    }

    restoreState();

    // Ensure Panda 1 is always clearly visible on frame 1 even after reload
    if (panda1.hollowStage < 2) panda1.hollowStage = 2;

    // =========================================================================
    // RESPONSIVE CAMERA RIG (iPhone 390x844 Portrait & iPad 1180x820 Landscape)
    // =========================================================================
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    let viewportW = window.innerWidth;
    let viewportH = window.innerHeight;

    function computeCameraPose(stageVal) {
      const aspect = viewportW / Math.max(1, viewportH);
      const isPortrait = aspect < 0.85;

      let pos0, look0, fov0;
      let pos1, look1, fov1;

      if (isPortrait) {
        // iPhone 390x844 portrait framing:
        // Stage 0: Oblique front from near tree base, showing Panda 1 large in center, all 3 dishes, hollow & basket!
        fov0 = 54;
        pos0 = new THREE.Vector3(0.24, 1.32, 4.72);
        look0 = new THREE.Vector3(-0.04, 1.48, 0.02);

        // Stage 1 (~3-4 min): Branch eye-level close-up showing snowy branch, fur detail, breath, hollow & basket reachable!
        fov1 = 55;
        pos1 = new THREE.Vector3(0.18, 1.82, 4.02);
        look1 = new THREE.Vector3(-0.08, 1.56, -0.06);
      } else {
        // iPad 1180x820 & desktop landscape framing:
        fov0 = 40;
        pos0 = new THREE.Vector3(0.42, 1.24, 4.22);
        look0 = new THREE.Vector3(-0.02, 1.46, 0.02);

        fov1 = 44;
        pos1 = new THREE.Vector3(0.28, 1.84, 3.55);
        look1 = new THREE.Vector3(-0.08, 1.54, -0.05);
      }

      const s = stageVal * stageVal * (3 - 2 * stageVal); // smoothstep
      camPos.lerpVectors(pos0, pos1, s);
      camLook.lerpVectors(look0, look1, s);
      camera.fov = THREE.MathUtils.lerp(fov0, fov1, s);
      camera.aspect = aspect;
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.updateProjectionMatrix();
    }

    function onResize() {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;
      renderer.setSize(viewportW, viewportH, false);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      hintCanvas.width = Math.round(viewportW * dpr);
      hintCanvas.height = Math.round(viewportH * dpr);
      hintCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeCameraPose(cameraStage);
    }
    window.addEventListener('resize', onResize);
    onResize();

    // =========================================================================
    // PROGRESSION DISCOVERIES (1..6 + 5-8 min Cozy Sleep Finale)
    // =========================================================================
    function updateProgression(dt) {
      if (!finaleMode) {
        playTime += dt;
      }

      // Discovery 2 (~1.5-2.5 min or after 2 feeds): Snow-dusted Bamboo appears in basket!
      if (!foodMgr.isBambooUnlocked() && (totalFeeds >= 2 || playTime >= 95)) {
        foodMgr.unlockBamboo();
        saveState();
      }

      // Discovery 3 (~2.5-3.5 min or after 4 feeds): Translucent Purple Grapes appear in basket!
      if (!foodMgr.isGrapeUnlocked() && (totalFeeds >= 4 || playTime >= 150)) {
        foodMgr.unlockGrapes();
        saveState();
      }

      // Discovery 4 & 5 (~3-4 min or after 5 feeds): Camera glides up to branch eye-level & Panda 2 peeks from hollow!
      if (targetCameraStage < 1 && (totalFeeds >= 5 || playTime >= 185)) {
        targetCameraStage = 1;
        saveState();
      }
      if (panda2.hollowStage === 0 && (totalFeeds >= 3 || playTime >= 145 || world.getHollowCleared() > 0.15)) {
        panda2.hollowStage = 1;
        saveState();
      }

      // Smooth camera transition
      cameraStage += (targetCameraStage - cameraStage) * Math.min(1, dt * 0.28);
      computeCameraPose(cameraStage);

      // Panda 2 emerges from hollow onto branches once food is placed near hollow (mid dish) or snow is cleared!
      if (panda2.hollowStage === 1) {
        const midHasFood = foodMgr.dishItems.mid.length > 0;
        const cleared = world.getHollowCleared();
        if ((midHasFood && (cleared > 0.2 || totalFeeds >= 5)) || (cleared >= 0.82 && totalFeeds >= 4)) {
          panda2.hollowStage = 2;
          panda2.currentNode = 'hollowRim';
          panda2.pos.copy(world.nodes.hollowRim);
          panda2.walkTo('midDishL', midHasFood ? 'approach_eat' : 'idle_sit');
          if (midHasFood) {
            panda2.targetDishId = 'mid';
            panda2.targetDishSide = 'left';
          }
          saveState();
        }
      }

      // Finale (~5-8 min & both pandas well-fed): Both curl up together on main branch, tails over faces, snow drifts down!
      if (
        !finaleMode &&
        panda2.hollowStage === 2 &&
        ((panda1.fullness >= 0.85 && panda2.fullness >= 0.45 && totalFeeds >= 11) || playTime >= 390)
      ) {
        const anyEating = pandas.some((p) => p.state.startsWith('eat_'));
        if (!anyEating) {
          finaleMode = true;
          world.setTargetSnowIntensity(1.0);
          saveState();
        }
      }
    }

    function onFeedComplete(panda, foodType, dishId) {
      totalFeeds++;
      if (dishId) dishesUsed.add(dishId);
      // Track favoritism: if one panda eats repeatedly while the other waits, boost waiting panda's eagerness
      const other = panda.id === 0 ? panda2 : panda1;
      if (other.hollowStage === 2) {
        panda.consecutiveFeeds++;
        other.consecutiveFeeds = 0;
      }
      saveState();
    }

    function wakeFromFinale() {
      if (!finaleMode) return;
      finaleMode = false;
      world.setTargetSnowIntensity(0.22);
      // Panda 1 peeks out from behind its bushy tail first, then gently wakes!
      panda1.peekFromTail = 1.0;
      panda1.fullness = 0.25;
      panda2.fullness = 0.25;
      totalFeeds = Math.max(6, totalFeeds - 5);
      playTime = Math.min(playTime, 240);
      setTimeout(() => {
        if (!finaleMode && panda1.state === 'sleep_curled') {
          panda1.setState('idle_sit');
        }
      }, 950);
      setTimeout(() => {
        if (!finaleMode && panda2.state === 'sleep_curled') {
          panda2.setState('idle_sit');
        }
      }, 2200);
      saveState();
    }

    // =========================================================================
    // DIEGETIC GUIDANCE (ONLY ONE OBJECT HIGHLIGHTS AT A TIME + 4s HAND HINT)
    // =========================================================================
    function getGuidedTarget() {
      if (dragState) {
        return { kind: 'dish', dishId: dragState.hoveredDishId || pickInvitingDishId() };
      }
      if (finaleMode) {
        return { kind: 'basket' };
      }
      // First discovery: apples in basket
      if (totalFeeds === 0 && countAllDishFood() === 0) {
        return { kind: 'basketItem', foodType: 'apple', destDish: 'mid' };
      }
      // Encourage trying another height after first apple
      if (totalFeeds === 1 && countAllDishFood() === 0) {
        const nextDish = dishesUsed.has('high') ? 'low' : 'high';
        return { kind: 'basketItem', foodType: 'apple', destDish: nextDish };
      }
      // Discovery 2: bamboo unlocked & not yet placed
      if (foodMgr.isBambooUnlocked() && !hasEverPlacedType.bamboo && countAllDishFood() === 0) {
        return { kind: 'basketItem', foodType: 'bamboo', destDish: 'mid' };
      }
      // Discovery 3: grapes unlocked & not yet placed
      if (foodMgr.isGrapeUnlocked() && !hasEverPlacedType.grape && countAllDishFood() === 0) {
        return { kind: 'basketItem', foodType: 'grape', destDish: 'high' };
      }
      // Discovery 5: brush snow off tree hollow when Panda 2 is peeking!
      if (panda2.hollowStage === 1 && world.getHollowCleared() < 0.72) {
        return { kind: 'hollowSnow' };
      }
      // Lure Panda 2 out via middle dish near hollow
      if (panda2.hollowStage === 1 && foodMgr.dishItems.mid.length === 0) {
        return { kind: 'basketItem', foodType: 'apple', destDish: 'mid' };
      }
      // Gentle deterministic default if idle with empty dishes
      if (countAllDishFood() === 0) {
        const ft =
          foodMgr.isGrapeUnlocked() && totalFeeds % 3 === 2
            ? 'grape'
            : foodMgr.isBambooUnlocked() && totalFeeds % 3 === 1
              ? 'bamboo'
              : 'apple';
        return { kind: 'basketItem', foodType: ft, destDish: pickInvitingDishId() };
      }
      return null;
    }

    function countAllDishFood() {
      return foodMgr.dishItems.low.length + foodMgr.dishItems.mid.length + foodMgr.dishItems.high.length;
    }

    function pickInvitingDishId() {
      // If Panda 2 is peeking in hollow, invite middle dish!
      if (panda2.hollowStage === 1 && foodMgr.dishItems.mid.length === 0) return 'mid';
      // Otherwise prefer an empty dish not yet used, or mid -> high -> low
      const order = ['mid', 'high', 'low'];
      for (const id of order) {
        if (!dishesUsed.has(id) && foodMgr.dishItems[id].length === 0) return id;
      }
      for (const id of order) {
        if (foodMgr.dishItems[id].length === 0) return id;
      }
      return 'mid';
    }

    // =========================================================================
    // SINGLE-FINGER TAP & DRAG INTERACTION (NO EMPTY-BACKGROUND REACTIONS!)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const dragWorldPt = new THREE.Vector3();

    let dragState = null;
    let brushingHollow = false;
    let lastBrushPos = null;

    function getPointerNDC(clientX, clientY) {
      const rect = glCanvas.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    function projectToScreen(worldPos) {
      const v = worldPos.clone().project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * viewportW,
        y: (-v.y * 0.5 + 0.5) * viewportH,
      };
    }

    function findNearestDishToScreen(clientX, clientY) {
      let bestId = null;
      let bestDist = 115; // Generous child-friendly snap radius in CSS pixels
      for (const id of ['low', 'mid', 'high']) {
        const sp = projectToScreen(world.dishes[id].pos);
        const d = Math.hypot(sp.x - clientX, sp.y - clientY);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      }
      return bestId;
    }

    function gatherInteractiveMeshes() {
      const list = [];
      // Basket & its items
      world.basketGroup.traverse((o) => {
        if (o.isMesh && o.visible && o.userData && o.userData.interactive) list.push(o);
      });
      // Hollow snow
      if (world.getHollowCleared() < 0.92) {
        world.hollowSnowGroup.traverse((o) => {
          if (o.isMesh && o.visible && o.userData && o.userData.interactive) list.push(o);
        });
      }
      // Dropped snow apples & dish items
      for (const it of foodMgr.snowApples) {
        it.mesh.traverse((o) => {
          if (o.isMesh) list.push(o);
        });
      }
      // Dishes
      for (const id of ['low', 'mid', 'high']) {
        world.dishes[id].group.traverse((o) => {
          if (o.isMesh && o.userData && o.userData.interactive) list.push(o);
        });
      }
      // Pandas
      for (const p of pandas) {
        if (p.hollowStage >= 1) {
          p.root.traverse((o) => {
            if (o.isMesh && o.userData && o.userData.interactive) list.push(o);
          });
        }
      }
      return list;
    }

    function notifyPandasOfDish(dishId) {
      const dishPos = world.dishes[dishId].pos;
      for (const p of pandas) {
        p.noticeSoundAt(dishPos);
      }
      // Immediately start nearest idle panda walking so the child sees instant response!
      const idle = pandas
        .filter((p) => p.hollowStage === 2 && (p.state === 'idle_sit' || p.state === 'curled'))
        .sort((a, b) => a.pos.distanceTo(dishPos) - b.pos.distanceTo(dishPos));
      if (idle.length > 0) {
        idle[0].chooseDishAndEat(idle[0].id === 0 ? panda2 : panda1, dishId);
      }
    }

    function handlePointerDown(e) {
      if (e.isPrimary === false) return;
      RPP.Audio.unlock();

      getPointerNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);

      const hits = raycaster.intersectObjects(gatherInteractiveMeshes(), false);
      if (hits.length === 0) {
        // Strict rule: do NOT react to empty background taps!
        return;
      }

      // Prioritize basketItem > snowFood > hollowSnow > basket > dish > panda
      const priority = { basketItem: 1, snowFood: 2, hollowSnow: 3, basket: 4, dish: 5, panda: 6 };
      hits.sort((a, b) => {
        const pa = priority[a.object.userData.interactive] || 99;
        const pb = priority[b.object.userData.interactive] || 99;
        if (pa !== pb) return pa - pb;
        return a.distance - b.distance;
      });

      const top = hits[0];
      const info = top.object.userData;
      lastInteractionTime = elapsed;

      if (info.interactive === 'basketItem' || info.interactive === 'basket') {
        if (finaleMode) {
          wakeFromFinale();
          RPP.Audio.playPickup();
          return;
        }
        const foodType = info.foodType || 'apple';
        const item = foodMgr.createFoodItem(foodType);
        const startPos = foodMgr.getBasketItemWorldPos(foodType);
        item.mesh.position.copy(startPos);
        RPP.Audio.playPickup();

        // Set drag plane passing through branch front depth (z = 0.25)
        dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).normalize(),
          new THREE.Vector3(0, 1.4, 0.28)
        );

        dragState = {
          pointerId: e.pointerId,
          item,
          foodType,
          startPos: startPos.clone(),
          startClientX: e.clientX,
          startClientY: e.clientY,
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          velX: 0,
          velY: 0,
          movedDist: 0,
          hoveredDishId: null,
        };
        glCanvas.setPointerCapture(e.pointerId);
        // Immediately turn Panda 1's head curiously toward the lifted treat!
        panda1.lookTargetWorld.copy(startPos);
        return;
      }

      if (info.interactive === 'snowFood') {
        const item = foodMgr.findFoodById(info.foodId);
        if (!item) return;
        foodMgr.detachFromDishOrSnow(item);
        RPP.Audio.playPickup();
        dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).normalize(),
          new THREE.Vector3(0, 1.2, 0.35)
        );
        dragState = {
          pointerId: e.pointerId,
          item,
          foodType: item.type,
          startPos: item.mesh.position.clone(),
          startClientX: e.clientX,
          startClientY: e.clientY,
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          velX: 0,
          velY: 0,
          movedDist: 0,
          hoveredDishId: null,
        };
        glCanvas.setPointerCapture(e.pointerId);
        return;
      }

      if (info.interactive === 'hollowSnow') {
        brushingHollow = true;
        lastBrushPos = { x: e.clientX, y: e.clientY };
        glCanvas.setPointerCapture(e.pointerId);
        brushHollowSnow(0.24);
        return;
      }

      if (info.interactive === 'dish') {
        const dId = info.dishId;
        world.bounceDish(dId, 0.32);
        RPP.Audio.playDishTap(world.dishes[dId].pitch);
        notifyPandasOfDish(dId);
        return;
      }

      if (info.interactive === 'panda') {
        const p = pandas[info.pandaId];
        if (p) p.onGentleTap();
        return;
      }
    }

    function brushHollowSnow(amount) {
      const cur = world.getHollowCleared();
      if (cur >= 0.98) return;
      const next = Math.min(1, cur + amount);
      world.setHollowCleared(next);
      RPP.Audio.playBrushSnow();
      foodMgr.spawnSnowFlakes(world.hollowSnowWorldPos, 9, 0.16);
      if (panda2.hollowStage === 0) {
        panda2.hollowStage = 1;
      }
      saveState();
    }

    function handlePointerMove(e) {
      if (brushingHollow) {
        if (lastBrushPos) {
          const dist = Math.hypot(e.clientX - lastBrushPos.x, e.clientY - lastBrushPos.y);
          if (dist > 18) {
            lastBrushPos = { x: e.clientX, y: e.clientY };
            lastInteractionTime = elapsed;
            brushHollowSnow(0.22);
          }
        }
        return;
      }

      if (!dragState || e.pointerId !== dragState.pointerId) return;
      lastInteractionTime = elapsed;

      const dx = e.clientX - dragState.lastClientX;
      const dy = e.clientY - dragState.lastClientY;
      dragState.movedDist += Math.hypot(dx, dy);
      dragState.velX = dragState.velX * 0.55 + dx * 0.45;
      dragState.velY = dragState.velY * 0.55 + dy * 0.45;
      dragState.lastClientX = e.clientX;
      dragState.lastClientY = e.clientY;

      getPointerNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragWorldPt)) {
        // Gently pull dragged item slightly closer toward hovered dish for tactile snapping feel
        const nearDish = findNearestDishToScreen(e.clientX, e.clientY);
        dragState.hoveredDishId = nearDish;
        if (nearDish) {
          const dp = world.dishes[nearDish].pos;
          dragState.item.mesh.position.lerp(new THREE.Vector3(dp.x, dp.y + 0.13, dp.z + 0.05), 0.35);
        } else {
          dragState.item.mesh.position.lerp(dragWorldPt, 0.55);
        }
        dragState.item.mesh.rotation.y += 0.04;
        // Pandas follow the moving treat with their eyes!
        for (const p of pandas) {
          if (p.hollowStage >= 1 && p.state !== 'sleep_curled') {
            p.lookTargetWorld.copy(dragState.item.mesh.position);
          }
        }
      }
    }

    function handlePointerUp(e) {
      if (brushingHollow) {
        brushingHollow = false;
        lastBrushPos = null;
        return;
      }
      if (!dragState || e.pointerId !== dragState.pointerId) return;

      const ds = dragState;
      dragState = null;
      lastInteractionTime = elapsed;

      const speedPx = Math.hypot(ds.velX, ds.velY);
      const nearDish = findNearestDishToScreen(e.clientX, e.clientY);

      if (ds.movedDist < 22) {
        // Child simply TAPPED the food in basket/snow -> gracefully toss onto the most inviting dish!
        // Guarantees the very first tap creates an immediate delightful visual change!
        const destDish = pickInvitingDishId();
        hasEverPlacedType[ds.foodType] = true;
        foodMgr.tossToDish(ds.item, ds.item.mesh.position.clone(), destDish);
        return;
      }

      if (nearDish && speedPx < 36) {
        // Gently placed on a saucer -> settles right inside the shallow wooden rim!
        hasEverPlacedType[ds.foodType] = true;
        foodMgr.placeOnDish(ds.item, nearDish, false);
        notifyPandasOfDish(nearDish);
        saveState();
      } else {
        // Flicked briskly or released away from a saucer -> arcs off into the snow below!
        const vx = THREE.MathUtils.clamp(ds.velX * 0.045, -1.6, 1.6);
        const vy = THREE.MathUtils.clamp(-ds.velY * 0.04 + 0.7, 0.2, 2.2);
        const vz = 0.25;
        foodMgr.launchItem(ds.item, ds.item.mesh.position.clone(), new THREE.Vector3(vx, vy, vz), null);
      }
    }

    glCanvas.addEventListener('pointerdown', handlePointerDown);
    glCanvas.addEventListener('pointermove', handlePointerMove);
    glCanvas.addEventListener('pointerup', handlePointerUp);
    glCanvas.addEventListener('pointercancel', handlePointerUp);

    // =========================================================================
    // 4-SECOND IDLE TRANSLUCENT CHILD FINGER HINT (NO ARROWS, NO TEXT, NO ICONS)
    // =========================================================================
    let hintAlpha = 0;
    function drawIdleFingerHint(dt, guided) {
      hintCtx.clearRect(0, 0, viewportW, viewportH);

      const idleSeconds = elapsed - lastInteractionTime;
      const shouldShow = !dragState && !brushingHollow && idleSeconds > 4.0 && guided != null;
      hintAlpha += ((shouldShow ? 1 : 0) - hintAlpha) * Math.min(1, dt * 3.0);
      if (hintAlpha < 0.02 || !guided) return;

      let startWorld = null;
      let endWorld = null;

      if (guided.kind === 'basketItem') {
        startWorld = foodMgr.getBasketItemWorldPos(guided.foodType);
        const dId = guided.destDish || 'mid';
        endWorld = world.dishes[dId].pos.clone().add(new THREE.Vector3(0, 0.05, 0));
      } else if (guided.kind === 'hollowSnow') {
        startWorld = world.hollowSnowWorldPos.clone().add(new THREE.Vector3(-0.14, 0.02, 0.02));
        endWorld = world.hollowSnowWorldPos.clone().add(new THREE.Vector3(0.16, 0.02, 0.02));
      } else if (guided.kind === 'basket') {
        startWorld = world.basketWorldPos.clone();
        endWorld = world.basketWorldPos.clone().add(new THREE.Vector3(0, 0.08, 0));
      }

      if (!startWorld || !endWorld) return;
      const p0 = projectToScreen(startWorld);
      const p1 = projectToScreen(endWorld);

      // Gentle 2.4-second loop: touch down -> glide in soft arc -> lift & fade
      const cycle = ((elapsed - lastInteractionTime - 4.0) % 2.6) / 2.6;
      const moveT = THREE.MathUtils.clamp((cycle - 0.14) / 0.64, 0, 1);
      const ease = moveT * moveT * (3 - 2 * moveT);

      const midX = (p0.x + p1.x) * 0.5;
      const midY = Math.min(p0.y, p1.y) - 42;
      const inv = 1 - ease;
      const x = inv * inv * p0.x + 2 * inv * ease * midX + ease * ease * p1.x;
      const y = inv * inv * p0.y + 2 * inv * ease * midY + ease * ease * p1.y;

      let localFade = 1;
      if (cycle < 0.14) localFade = cycle / 0.14;
      else if (cycle > 0.80) localFade = Math.max(0, (1 - cycle) / 0.20);
      const alpha = hintAlpha * localFade * 0.68;
      if (alpha < 0.01) return;

      // Soft translucent fingertip ripple at touch start
      if (cycle < 0.35) {
        const rt = cycle / 0.35;
        hintCtx.save();
        hintCtx.strokeStyle = `rgba(255, 250, 238, ${alpha * (1 - rt) * 0.7})`;
        hintCtx.lineWidth = 2.5;
        hintCtx.beginPath();
        hintCtx.arc(p0.x, p0.y, 10 + rt * 18, 0, Math.PI * 2);
        hintCtx.stroke();
        hintCtx.restore();
      }

      // Draw a soft, gentle translucent child's fingertip silhouette (NO arrows, NO icons!)
      hintCtx.save();
      hintCtx.translate(x, y);
      hintCtx.rotate(-0.32);

      // Soft glowing pad under fingertip
      const glow = hintCtx.createRadialGradient(0, 0, 2, 0, 0, 22);
      glow.addColorStop(0, `rgba(255, 250, 240, ${alpha * 0.55})`);
      glow.addColorStop(1, 'rgba(255, 250, 240, 0)');
      hintCtx.fillStyle = glow;
      hintCtx.beginPath();
      hintCtx.arc(0, 0, 22, 0, Math.PI * 2);
      hintCtx.fill();

      // Translucent rounded child index finger & curled small hand silhouette
      hintCtx.fillStyle = `rgba(255, 248, 240, ${alpha * 0.72})`;
      hintCtx.strokeStyle = `rgba(180, 155, 132, ${alpha * 0.42})`;
      hintCtx.lineWidth = 1.6;
      hintCtx.beginPath();
      hintCtx.moveTo(-7, 2);
      hintCtx.quadraticCurveTo(-7, -9, 0, -9);
      hintCtx.quadraticCurveTo(7, -9, 7, 2);
      hintCtx.lineTo(8, 22);
      hintCtx.quadraticCurveTo(18, 20, 19, 30);
      hintCtx.quadraticCurveTo(21, 44, 9, 48);
      hintCtx.quadraticCurveTo(-8, 51, -13, 38);
      hintCtx.quadraticCurveTo(-16, 28, -8, 22);
      hintCtx.closePath();
      hintCtx.fill();
      hintCtx.stroke();
      hintCtx.restore();
    }

    // Save cleanly when leaving page
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveState();
    });
    window.addEventListener('pagehide', saveState);

    // =========================================================================
    // MAIN ANIMATION LOOP
    // =========================================================================
    let prevTime = performance.now();

    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;
      elapsed += dt;

      updateProgression(dt);
      const guided = getGuidedTarget();

      world.update(dt, elapsed, guided, dragState ? dragState.hoveredDishId : null);
      foodMgr.update(dt, elapsed, guided, (dishId) => {
        notifyPandasOfDish(dishId);
        saveState();
      });

      panda1.update(dt, elapsed, panda2, finaleMode, onFeedComplete);
      panda2.update(dt, elapsed, panda1, finaleMode, onFeedComplete);

      renderer.render(scene, camera);
      drawIdleFingerHint(dt, guided);

      // Periodic auto-save every 15s
      if (elapsed - lastSaveTime > 15) {
        lastSaveTime = elapsed;
        saveState();
      }
    }

    // Render frame 1 immediately so the red panda is crystal clear from the very first millisecond!
    panda1.update(0.016, 0, panda2, finaleMode, onFeedComplete);
    panda2.update(0.016, 0, panda1, finaleMode, onFeedComplete);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.addEventListener('DOMContentLoaded', init);
  return { init };
})();
