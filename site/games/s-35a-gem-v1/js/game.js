// Main simulation, tactile interaction, goat behavior & persistence for こやぎの もぐもぐ
(function () {
  'use strict';

  const STORAGE_KEY = 'koyagi_mogumogu_v1';

  class KoyagiGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.guideCanvas = document.getElementById('guide-canvas');
      this.guideCtx = this.guideCanvas.getContext('2d');

      // Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.06;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(44, 1, 0.08, 90);

      // World & Goats (strictly 3 goats max: white kid, fawn kid, adult mother)
      this.world = new window.KoyagiWorld.RanchWorld(this.scene);

      this.whiteKid = new window.KoyagiGoat.GoatActor({
        id: 'white',
        x: -0.36,
        z: -0.34,
        rotY: 0.22,
        zone: 'inside'
      });
      this.fawnKid = new window.KoyagiGoat.GoatActor({
        id: 'fawn',
        x: 0.36,
        z: -0.32,
        rotY: -0.22,
        zone: 'inside'
      });
      this.motherGoat = new window.KoyagiGoat.GoatActor({
        id: 'mother',
        x: -0.68,
        z: -4.4,
        rotY: 0.16,
        zone: 'inside'
      });

      this.kids = [this.whiteKid, this.fawnKid];
      this.allGoats = [this.whiteKid, this.fawnKid, this.motherGoat];
      for (const g of this.allGoats) {
        this.scene.add(g.group);
      }

      // Camera view interpolation ('fence' vs 'meadow')
      this.viewMode = 'fence';
      this.viewBlend = 0; // 0 = elevated oblique fence view, 1 = low child-crouching meadow view
      this.camPos = new THREE.Vector3();
      this.camLook = new THREE.Vector3();
      this.camFov = 44;

      // Play progression & discovery state
      this.elapsedPlay = 0;
      this.totalHayFed = 0;
      this.totalCarrotBites = 0;
      this.totalDrinks = 0;
      this.motherApproached = false;
      this.motherNudged = false;
      this.motherFedCount = 0;
      this.gateInvited = false;
      this.basketSpilledCount = 0;
      this.roundRestTriggered = false;
      this.lastTapTroughCycle = 0;

      // Memory & ordering (Discovery 6)
      this.lastFedKidId = null;
      this.consecutiveKidId = null;
      this.consecutiveCount = 0;
      this.delayedLookTimers = { white: 0, fawn: 0 };
      this.delayedLookTargets = { white: null, fawn: null };

      // Active interaction state (single-finger tap & drag)
      this.raycaster = new THREE.Raycaster();
      this.pointerNdc = new THREE.Vector2();
      this.activePointerId = null;
      this.dragMode = null; // null | 'hay' | 'carrot' | 'bucket' | 'gate' | 'basket_tilt'
      this.dragStartScreen = { x: 0, y: 0 };
      this.dragLastScreen = { x: 0, y: 0 };
      this.dragSpeed = 0;
      this.dragMoved = false;
      this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.35);
      this.dragWorldPos = new THREE.Vector3();
      this.heldCarrotState = null; // { sourceBasketIdx, sourceLooseItem, remaining, biteTimer, pullBaselineZ, bitingGoat }
      this.hayLeafDropTimer = 0;

      // Idle 4-second translucent finger guide
      this.idleSeconds = 0;
      this.guideAlpha = 0;
      this.guideAnimPhase = 0;
      this.hasInteractedOnce = false;

      // Side-by-side hay tug cooldown
      this.tugCooldown = 0;

      // Persistence timer
      this.saveTimer = 0;
      this.lastTime = performance.now();

      // Restore saved session if present (safe validation)
      this._restoreState();

      // Set initial camera immediately so frame 1 is perfectly framed!
      this._resize();
      this._updateCamera(1.0);

      // Bind events
      this._bindEvents();

      // Render frame 1 immediately, then start loop
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame((t) => this._loop(t));
    }

    _bindEvents() {
      window.addEventListener('resize', () => this._resize());

      this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
      window.addEventListener('pointermove', (e) => this._onPointerMove(e));
      window.addEventListener('pointerup', (e) => this._onPointerUp(e));
      window.addEventListener('pointercancel', (e) => this._onPointerUp(e));

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this._saveState();
      });
      window.addEventListener('pagehide', () => this._saveState());
    }

    _resize() {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      this.width = w;
      this.height = h;
      this.aspect = w / h;

      this.renderer.setSize(w, h, false);
      this.camera.aspect = this.aspect;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.guideCanvas.width = Math.round(w * dpr);
      this.guideCanvas.height = Math.round(h * dpr);
      this.guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this._updateCamera(1.0);
    }

    _getCameraPose(mode) {
      // Smoothly adapts framing between iPhone portrait (390x844, aspect ~0.46) and iPad landscape (1180x820, aspect ~1.44)
      const portraitFactor = Math.max(0, Math.min(1, (1.15 - this.aspect) / 0.72));

      if (mode === 'fence') {
        return {
          pos: new THREE.Vector3(
            0.03,
            THREE.MathUtils.lerp(1.26, 1.56, portraitFactor),
            THREE.MathUtils.lerp(2.44, 3.24, portraitFactor)
          ),
          look: new THREE.Vector3(
            0.03,
            THREE.MathUtils.lerp(0.45, 0.44, portraitFactor),
            THREE.MathUtils.lerp(-0.14, -0.10, portraitFactor)
          ),
          fov: THREE.MathUtils.lerp(43, 53, portraitFactor)
        };
      } else {
        // Low child-crouching-on-grass eye level (草地にしゃがんだような低い目線)
        return {
          pos: new THREE.Vector3(
            -0.02,
            THREE.MathUtils.lerp(0.56, 0.68, portraitFactor),
            THREE.MathUtils.lerp(2.12, 2.68, portraitFactor)
          ),
          look: new THREE.Vector3(
            0.02,
            THREE.MathUtils.lerp(0.36, 0.36, portraitFactor),
            THREE.MathUtils.lerp(0.45, 0.42, portraitFactor)
          ),
          fov: THREE.MathUtils.lerp(44, 52, portraitFactor)
        };
      }
    }

    _updateCamera(lerpRate) {
      const targetBlend = this.viewMode === 'meadow' ? 1 : 0;
      this.viewBlend += (targetBlend - this.viewBlend) * lerpRate;

      const fencePose = this._getCameraPose('fence');
      const meadowPose = this._getCameraPose('meadow');

      const s = this.viewBlend * this.viewBlend * (3 - 2 * this.viewBlend); // smoothstep
      const desiredPos = fencePose.pos.clone().lerp(meadowPose.pos, s);
      const desiredLook = fencePose.look.clone().lerp(meadowPose.look, s);
      const desiredFov = THREE.MathUtils.lerp(fencePose.fov, meadowPose.fov, s);

      if (lerpRate >= 0.99) {
        this.camPos.copy(desiredPos);
        this.camLook.copy(desiredLook);
        this.camFov = desiredFov;
      } else {
        this.camPos.lerp(desiredPos, lerpRate);
        this.camLook.lerp(desiredLook, lerpRate);
        this.camFov += (desiredFov - this.camFov) * lerpRate;
      }

      this.camera.fov = this.camFov;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.updateProjectionMatrix();
    }

    // --- Pointer Input (Strictly World-Object Driven) ---
    _screenToNdc(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    _getInteractiveMeshes() {
      const list = [];
      // Carrots first (smaller targets sitting on top of hay)
      if (this.world.carrotsUnlocked) {
        for (const bc of this.world.basketCarrots) {
          if (bc.available) list.push(bc.hit);
        }
      }
      // Loose pickupable carrots on trough rim or grass
      for (const item of this.world.looseItems) {
        if (item.hit && item.edible) list.push(item.hit);
      }
      // Hay in basket
      list.push(this.world.basketHayHit);
      // Basket handle (for tilting or sliding basket)
      list.push(this.world.basketHandleHit);
      // Tin water bucket
      list.push(this.world.bucketHitMesh);
      // Wooden gate
      list.push(this.world.gateHitMesh);
      return list;
    }

    _onPointerDown(e) {
      if (this.activePointerId !== null) return;
      e.preventDefault();

      window.KoyagiAudio.unlock();
      this.idleSeconds = 0;
      this.guideAlpha = 0;

      this._screenToNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);

      const hits = this.raycaster.intersectObjects(this._getInteractiveMeshes(), false);
      if (!hits.length) {
        // Strictly ignore non-interactive background taps (画面全体をどこでも反応させない)
        return;
      }

      const hitObj = hits[0].object;
      const meta = hitObj.userData || {};
      const type = meta.interactType;

      this.activePointerId = e.pointerId;
      this.dragStartScreen = { x: e.clientX, y: e.clientY };
      this.dragLastScreen = { x: e.clientX, y: e.clientY };
      this.dragSpeed = 0;
      this.dragMoved = false;
      this.hasInteractedOnce = true;

      // Wake up resting goats if child touches the basket again! (籠にもう一度触れると、片方の子やぎが耳を立て、遊びがまた始まります)
      if (this.roundRestTriggered && (type === 'basket_hay' || type === 'basket_handle' || type === 'basket_carrot')) {
        this._wakeFromRest();
      }

      if (type === 'basket_hay') {
        this.dragMode = 'hay';
        this.dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0.32, 0.94).normalize(),
          new THREE.Vector3(0, 0.62, 0.22)
        );
        this.world.basketHayLevel = Math.max(0.42, this.world.basketHayLevel - 0.10);
        this.world.heldHay.visible = true;
        this._updateHeldPosition();

        // Immediate tactile feedback on first touch!
        window.KoyagiAudio.playHayRustle(0.85, 0.28);
        this.world.spawnHayLeaves(this.world.heldHay.position, 6, 0.45);
        this._notifyGoatsOfSound(this.world.heldHay.position, true);
      } else if (type === 'basket_carrot' || type === 'loose_carrot') {
        this.dragMode = 'carrot';
        this.dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0.25, 0.96).normalize(),
          new THREE.Vector3(0, 0.64, this.viewMode === 'meadow' ? 0.55 : 0.14)
        );

        let remaining = 1.0;
        let sourceBasketIdx = -1;
        let sourceLooseItem = null;

        if (type === 'basket_carrot') {
          const bc = this.world.basketCarrots[meta.carrotIndex];
          if (bc && bc.available) {
            bc.available = false;
            bc.obj.group.visible = false;
            sourceBasketIdx = meta.carrotIndex;
          }
        } else if (type === 'loose_carrot' && meta.looseItem) {
          sourceLooseItem = meta.looseItem;
          remaining = sourceLooseItem.remaining;
          sourceLooseItem.edible = false;
          this.scene.remove(sourceLooseItem.mesh);
          const idx = this.world.looseItems.indexOf(sourceLooseItem);
          if (idx >= 0) this.world.looseItems.splice(idx, 1);
        }

        this.world.heldCarrot.setRemaining(remaining);
        this.world.heldCarrot.group.visible = true;
        this.heldCarrotState = {
          sourceBasketIdx,
          remaining,
          biteTimer: 0.35,
          bitingGoat: null,
          lastZ: 0
        };
        this._updateHeldPosition();
        window.KoyagiAudio.playHayRustle(0.45, 0.16);
        this._notifyGoatsOfSound(this.world.heldCarrot.group.position, true);
      } else if (type === 'bucket') {
        this.dragMode = 'bucket';
        this._pushWaterBucket();
      } else if (type === 'gate') {
        this.dragMode = 'gate';
        this.gateStartAngle = this.world.gateTargetAngle;
      } else if (type === 'basket_handle') {
        this.dragMode = 'basket_tilt';
        window.KoyagiAudio.playBasketWood();
      }
    }

    _onPointerMove(e) {
      if (e.pointerId !== this.activePointerId || !this.dragMode) return;
      e.preventDefault();

      const dx = e.clientX - this.dragLastScreen.x;
      const dy = e.clientY - this.dragLastScreen.y;
      const distFromStart = Math.hypot(e.clientX - this.dragStartScreen.x, e.clientY - this.dragStartScreen.y);
      if (distFromStart > 10) this.dragMoved = true;

      this.dragSpeed = this.dragSpeed * 0.65 + Math.hypot(dx, dy) * 0.045;
      this.dragLastScreen = { x: e.clientX, y: e.clientY };
      this.idleSeconds = 0;

      this._screenToNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);

      if (this.dragMode === 'hay' || this.dragMode === 'carrot') {
        this._updateHeldPosition();
        if (this.dragMode === 'hay') {
          this.hayLeafDropTimer -= 0.016;
          if (this.hayLeafDropTimer <= 0 && this.dragSpeed > 0.25) {
            this.hayLeafDropTimer = 0.18;
            this.world.spawnHayLeaves(this.world.heldHay.position, 2, 0.3);
            if (Math.random() < 0.35) window.KoyagiAudio.playHayRustle(0.35, 0.14);
          }
        }
      } else if (this.dragMode === 'bucket') {
        // Dragging toward fence pushes tin bucket further in
        if (dy < -12) {
          this.world.bucketTargetSlide = 1.0;
        } else if (dy > 16) {
          this.world.bucketTargetSlide = 0.2;
        }
      } else if (this.dragMode === 'gate') {
        // Dragging right/down pushes gate outward open; dragging left/up pulls gate closed!
        const delta = (e.clientX - this.dragStartScreen.x) * 0.009 + (e.clientY - this.dragStartScreen.y) * 0.005;
        const nextAngle = Math.max(0, Math.min(1.56, this.gateStartAngle + delta));
        this.world.gateTargetAngle = nextAngle;
      } else if (this.dragMode === 'basket_tilt') {
        // Horizontal drag tilts the basket (籠を指で傾けると) or slides it close to goat's nose in meadow view!
        const totalDx = e.clientX - this.dragStartScreen.x;
        const totalDy = e.clientY - this.dragStartScreen.y;
        const tilt = Math.max(-0.88, Math.min(0.88, -totalDx * 0.0068));
        this.world.basketTargetTilt = tilt;

        if (this.viewMode === 'meadow') {
          this.world.basketPosOffset.x = Math.max(-0.32, Math.min(0.32, totalDx * 0.0018));
          this.world.basketPosOffset.z = Math.max(-0.22, Math.min(0.14, totalDy * 0.0015));
        }

        if (Math.abs(tilt) > 0.52 && !this._spilledDuringThisDrag) {
          this._spilledDuringThisDrag = true;
          this._performBasketSpill(tilt > 0 ? -1 : 1);
        }
      }
    }

    _onPointerUp(e) {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;

      const mode = this.dragMode;
      this.dragMode = null;

      if (mode === 'hay') {
        this._releaseHeldHay();
      } else if (mode === 'carrot') {
        this._releaseHeldCarrot();
      } else if (mode === 'gate') {
        this._finishGateInteraction();
      } else if (mode === 'basket_tilt') {
        if (!this.dragMoved && this.viewMode === 'meadow') {
          // Quick tap on basket handle in meadow view gives a friendly tilt & spill!
          this.world.basketTargetTilt = 0.68;
          this._performBasketSpill(-1);
          setTimeout(() => { this.world.basketTargetTilt = 0; }, 520);
        } else {
          this.world.basketTargetTilt = 0;
        }
        this._spilledDuringThisDrag = false;
      }
      this._saveState();
    }

    _updateHeldPosition() {
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, hit)) {
        // Clamp cleanly inside reachable ranch play area
        hit.x = Math.max(-0.88, Math.min(0.92, hit.x));
        hit.y = Math.max(0.24, Math.min(1.18, hit.y));
        hit.z = Math.max(-0.18, Math.min(1.05, hit.z));
        this.dragWorldPos.copy(hit);

        if (this.dragMode === 'hay') {
          this.world.heldHay.position.copy(hit);
          this.world.heldHay.rotation.z = Math.sin(this.world.time * 5) * 0.12;
        } else if (this.dragMode === 'carrot') {
          this.world.heldCarrot.group.position.copy(hit);
          // Point carrot tip gently toward nearest goat
          this.world.heldCarrot.group.rotation.set(Math.PI * 0.48, -hit.x * 0.25, 0.12);
        }
      }
    }

    _releaseHeldHay() {
      const pos = this.world.heldHay.position.clone();
      this.world.heldHay.visible = false;

      // Check if offering directly to Mother Goat (Discovery 4!)
      if (this.motherApproached && this.motherGoat.z > -1.8) {
        const mHead = this.motherGoat.getWorldSnoutPosition();
        if (Math.hypot(pos.x - mHead.x, pos.y - mHead.y) < 0.42 && pos.y > 0.72) {
          this._feedMotherGoat(pos);
          return;
        }
      }

      // In low meadow view, dropping hay near ground drops it on grass for the kids!
      if (this.viewMode === 'meadow' && pos.y < 0.56) {
        const dropZ = Math.max(0.32, Math.min(0.95, pos.z));
        this.world.spawnLooseItem('hay', pos.x, 0.03, dropZ, 1.0, false);
        this.world.spawnHayLeaves(new THREE.Vector3(pos.x, 0.12, dropZ), 8, 0.55);
        window.KoyagiAudio.playHayDrop(this.dragSpeed);
        this._notifyGoatsOfSound(new THREE.Vector3(pos.x, 0.1, dropZ), true);
        return;
      }

      // Determine target trough slot (Left / Center / Right)
      let targetSlot = null;
      if (!this.dragMoved) {
        // Friendly first tap for 5-year-old: places a pinch cleanly on alternating troughs!
        const order = ['left', 'right', 'center'];
        targetSlot = order[this.lastTapTroughCycle % 3];
        this.lastTapTroughCycle++;
      } else if (pos.y > 0.34) {
        if (pos.x < -0.22) targetSlot = 'left';
        else if (pos.x > 0.22) targetSlot = 'right';
        else targetSlot = 'center';
      }

      if (targetSlot) {
        const speedNorm = Math.min(1.4, Math.max(0.15, this.dragSpeed));
        this.world.addHayToTrough(targetSlot, 0.72, speedNorm);
        window.KoyagiAudio.playHayDrop(speedNorm);
        this.totalHayFed++;
        this._onHayPlacedInTrough(targetSlot);
      } else {
        // Gently returns to basket with a dry rustle
        this.world.spawnHayLeaves(pos, 4, 0.3);
        window.KoyagiAudio.playHayRustle(0.4, 0.18);
      }
    }

    _releaseHeldCarrot() {
      const state = this.heldCarrotState;
      this.heldCarrotState = null;
      const pos = this.world.heldCarrot.group.position.clone();
      this.world.heldCarrot.group.visible = false;

      if (!state) return;

      // Clear any goat actively stretching for this carrot
      if (state.bitingGoat && state.bitingGoat.state === 'eat_carrot') {
        state.bitingGoat.state = 'idle';
        state.bitingGoat.stateTimer = 0;
        state.bitingGoat.lookTarget = null;
      }

      if (state.remaining <= 0.14) {
        // Already eaten down to leafy top -> leave chewed carrot leaves on grass!
        this.world.spawnLooseItem('carrot_leaf', pos.x, 0.03, Math.max(0.28, pos.z), 0.04, false);
        this.world.replenishCarrotsIfEmpty();
        return;
      }

      // Check if quick tap without dragging -> hold carrot nicely at nearest trough rim so kid can nibble it!
      if (!this.dragMoved) {
        const slotKey = this.whiteKid.zone === 'inside' ? 'left' : 'center';
        const slot = this.world.troughs[slotKey];
        const item = this.world.spawnLooseItem('carrot', slot.x, 0.625, slot.z + 0.04, state.remaining, true);
        item.vx = (Math.random() - 0.5) * 0.12;
        item.vz = 0.08;
        this._notifyGoatsOfSound(new THREE.Vector3(slot.x, 0.62, slot.z), true);
        return;
      }

      // Dropped near trough -> rolls gently and stops at trough lip (転がると餌入れの縁で止まり)
      if (Math.abs(pos.x) < 0.65 && pos.y > 0.44 && pos.z < 0.36) {
        const item = this.world.spawnLooseItem('carrot', pos.x, 0.65, 0.12, state.remaining, true);
        item.vx = (Math.random() - 0.5) * 0.18;
        item.vz = 0.16;
        window.KoyagiAudio.playBasketWood();
      } else {
        // Dropped onto meadow grass -> goat can pick it up with its nose! (柵の外に落ちた分は草地で子やぎが鼻で拾えます)
        const gz = Math.max(0.26, Math.min(1.02, pos.z));
        const item = this.world.spawnLooseItem('carrot', pos.x, 0.06, gz, state.remaining, false);
        item.vx = (Math.random() - 0.5) * 0.22;
        item.vz = (Math.random() - 0.5) * 0.18;
        window.KoyagiAudio.playHayRustle(0.35, 0.15);
      }
      this.world.replenishCarrotsIfEmpty();
    }

    _pushWaterBucket() {
      this.world.bucketTargetSlide = this.world.bucketTargetSlide > 0.5 ? 0.85 : 1.0;
      this.world.triggerWaterRipple();
      window.KoyagiAudio.playWaterSlosh();

      // Invite the thirstiest kid (one that has eaten hay, or closest available) to drink
      const candidates = this.kids.filter(k => !k.isSitting && k.state !== 'eat_carrot');
      if (candidates.length) {
        candidates.sort((a, b) => (b.hayEaten - a.hayEaten) || (a.x - b.x));
        const drinker = candidates[0];
        this._sendGoatToDrink(drinker);
      }
    }

    _finishGateInteraction() {
      if (!this.dragMoved) {
        // Tap toggles gate open / closed
        if (this.world.gateTargetAngle < 0.65) {
          this.world.gateTargetAngle = 1.52;
        } else {
          this.world.gateTargetAngle = 0.0;
        }
      } else {
        // Snap cleanly to open or closed based on where finger pushed it
        this.world.gateTargetAngle = this.world.gateTargetAngle > 0.55 ? 1.52 : 0.0;
      }

      window.KoyagiAudio.playGateCreak();

      if (this.world.gateTargetAngle > 1.0) {
        // Gate opened! Camera smoothly lowers to child-crouching meadow view, kids exit one by one!
        this.viewMode = 'meadow';
        this._queueKidsExitGate();
      } else {
        // Gate closed mid-way: any kid still inside stays inside! (途中で木戸を戻せば、まだ出ていない子は柵の中に残ります)
        for (const k of this.kids) {
          if (k.zone === 'inside' && k.state === 'exit_gate') {
            k.state = 'idle';
            k.targetX = k.id === 'white' ? -0.36 : 0.34;
            k.targetZ = -0.36;
            k.targetRotY = k.id === 'white' ? 0.2 : -0.2;
          }
        }
        // If no kids are outside in the meadow, return smoothly to fence view
        if (this.kids.every(k => k.zone === 'inside')) {
          this.viewMode = 'fence';
        }
      }
    }

    _performBasketSpill(tiltDir) {
      this.world.spillBasketContents(tiltDir);
      this.basketSpilledCount++;
      window.KoyagiAudio.playBasketWood();
      window.KoyagiAudio.playHayRustle(0.95, 0.35);

      // Kids outside in the meadow immediately turn & choose from the spilled treats
      // (Note: any hay already in a goat's mouth remains untouched!)
      for (const k of this.kids) {
        k.perkEars(1.0);
        if (k.isSitting) k.standUp();
      }
    }

    // --- Discovery & World-Driven Goat AI ---

    _notifyGoatsOfSound(soundPos, isDrySound) {
      for (const k of this.kids) {
        if (k.isSitting) continue;
        k.perkEars(0.8);
        // If waiting or eating on the other side, turn head toward the sound!
        if (k.state === 'idle' || k.state === 'propped_wait') {
          k.lookTarget = soundPos.clone();
        } else if (isDrySound && Math.abs(k.x - soundPos.x) > 0.35) {
          // A beat later, look over toward the dry sound on the opposite side
          this.delayedLookTimers[k.id] = 0.55;
          this.delayedLookTargets[k.id] = soundPos.clone();
        }
      }
    }

    _onHayPlacedInTrough(slotKey) {
      const slot = this.world.troughs[slotKey];
      const soundPos = new THREE.Vector3(slot.x, slot.y + 0.05, slot.z);

      // Left trough -> White kid; Right trough -> Fawn kid; Center -> Both kids!
      if (slotKey === 'left') {
        this._dispatchKidToTrough(this.whiteKid, slotKey);
        this._recordFeedOrder('white', 'fawn', soundPos);
      } else if (slotKey === 'right') {
        this._dispatchKidToTrough(this.fawnKid, slotKey);
        this._recordFeedOrder('fawn', 'white', soundPos);
      } else {
        // Center: both kids come side-by-side!
        this._dispatchKidToTrough(this.whiteKid, 'center', -0.18);
        this._dispatchKidToTrough(this.fawnKid, 'center', 0.18);
        this.consecutiveCount = 0;
        this.consecutiveKidId = null;
      }

      // If Mother Goat is close by, she also turns gently toward the rustle
      if (this.motherApproached && this.motherGoat.state === 'idle') {
        this.motherGoat.perkEars(0.6);
        this.motherGoat.lookTarget = soundPos.clone();
      }
    }

    _recordFeedOrder(fedId, otherId, soundPos) {
      // Discovery 6: if one kid was fed repeatedly, then the waiting kid gets food, waiting kid hurries while previously fed kid looks up a beat later!
      if (this.consecutiveKidId === otherId && this.consecutiveCount >= 2) {
        const waitingKid = fedId === 'white' ? this.whiteKid : this.fawnKid;
        const prevKid = otherId === 'white' ? this.whiteKid : this.fawnKid;
        if (!waitingKid.isSitting) {
          waitingKid.state = 'hurry';
          waitingKid.triggerHop();
        }
        this.delayedLookTimers[prevKid.id] = 0.75;
        this.delayedLookTargets[prevKid.id] = soundPos.clone();
      }

      if (this.consecutiveKidId === fedId) {
        this.consecutiveCount++;
      } else {
        this.consecutiveKidId = fedId;
        this.consecutiveCount = 1;
      }
      this.lastFedKidId = fedId;
    }

    _dispatchKidToTrough(kid, slotKey, xOffset = 0) {
      if (kid.isSitting) kid.standUp();
      if (kid.state === 'eat_carrot' || kid.state === 'drink') return;

      const slot = this.world.troughs[slotKey];
      kid.perkEars(1.0);
      kid.pendingTroughSlot = slotKey;
      kid.pendingTroughOffset = xOffset;

      // Discovery 6: when Mother Goat is nearby, kid first trots close by Mother's feet, then heads to the trough!
      if (kid.zone === 'inside' && this.motherApproached && this.motherGoat.z > -1.65 && Math.hypot(kid.x - this.motherGoat.x, kid.z - this.motherGoat.z) > 0.65 && Math.random() < 0.65) {
        kid.viaMother = true;
        kid.targetX = this.motherGoat.x + (kid.id === 'white' ? -0.34 : 0.34);
        kid.targetZ = Math.min(-0.62, this.motherGoat.z + 0.38);
      } else {
        kid.viaMother = false;
        kid.targetX = slot.x + xOffset;
        kid.targetZ = kid.zone === 'inside' ? -0.30 : 0.42;
      }
      kid.targetRotY = kid.zone === 'inside' ? (xOffset < 0 ? 0.25 : xOffset > 0 ? -0.25 : 0) : Math.PI;
      kid.lookTarget = new THREE.Vector3(slot.x, slot.y, slot.z);
      if (kid.state !== 'hurry') {
        kid.state = 'to_trough';
      }
      kid.stateTimer = 0;
    }

    _sendGoatToDrink(kid) {
      if (kid.isSitting) kid.standUp();
      kid.perkEars(0.95);
      kid.state = 'to_bucket';
      kid.stateTimer = 0;
      const bx = this.world.bucketBaseX + 0.08;
      kid.targetX = bx + 0.05;
      kid.targetZ = kid.zone === 'inside' ? -0.28 : 0.56;
      kid.targetRotY = kid.zone === 'inside' ? -0.15 : Math.PI - 0.15;
      kid.lookTarget = new THREE.Vector3(bx, 0.22, this.world.bucketBaseZ - 0.18);
    }

    _feedMotherGoat(pos) {
      window.KoyagiAudio.playHayRustle(0.75, 0.32);
      this.world.spawnHayLeaves(pos, 8, 0.45);
      this.motherFedCount++;
      this.motherGoat.state = 'mother_eat';
      this.motherGoat.startEatingHay(4.4, true);
      this.motherGoat.lookTarget = new THREE.Vector3(pos.x, pos.y - 0.05, pos.z);
      window.KoyagiAudio.playSoftBleat(0.68); // Deep warm gentle mother goat hum

      // Kids snuggle right close against Mother's legs! (子やぎはその足元にぴったり寄り添います)
      for (const k of this.kids) {
        if (k.zone === 'inside' && !k.isSitting && k.state !== 'eat_carrot') {
          k.state = 'snuggle_mother';
          k.stateTimer = 0;
          k.targetX = this.motherGoat.x + (k.id === 'white' ? -0.30 : 0.30);
          k.targetZ = this.motherGoat.z + 0.26;
          k.targetRotY = k.id === 'white' ? 0.35 : -0.35;
          k.lookTarget = this.motherGoat.getHeadWorldPosition();
        }
      }
    }

    _queueKidsExitGate() {
      // Kids step out through the wooden gate one by one! (子やぎが順番に出てきます)
      let order = 0;
      for (const k of this.kids) {
        if (k.zone === 'inside') {
          if (k.isSitting) k.standUp();
          k.state = 'exit_gate';
          k.exitStage = 0; // 0 = wait turn & walk behind gate, 1 = pass through gate gap, 2 = walk to foreground basket
          k.exitDelay = order * 1.65;
          k.stateTimer = 0;
          order++;
        }
      }
    }

    _wakeFromRest() {
      this.roundRestTriggered = false;
      // One kid perks its ears and stands up right away, then the other follows gently
      const first = this.kids[Math.floor(Math.random() * this.kids.length)];
      const second = first === this.whiteKid ? this.fawnKid : this.whiteKid;

      first.standUp();
      first.fullness = 2.0;
      first.perkEars(1.0);
      first.triggerHop();
      window.KoyagiAudio.playSoftBleat(1.12);

      setTimeout(() => {
        second.standUp();
        second.fullness = 2.5;
        second.perkEars(0.85);
      }, 1400);

      // Replenish carrots & basket hay gently for the new afternoon round
      this.world.basketHayLevel = 0.92;
      this.world.replenishCarrotsIfEmpty();
    }

    // --- Per-Frame Update Loop ---

    _loop(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      this._step(dt);
      this.renderer.render(this.scene, this.camera);
      this._drawFingerGuide(dt);

      requestAnimationFrame((t) => this._loop(t));
    }

    _step(dt) {
      this.elapsedPlay += dt;
      this.idleSeconds += dt;
      this.tugCooldown = Math.max(0, this.tugCooldown - dt);

      // Periodic autosave every ~6 seconds
      this.saveTimer += dt;
      if (this.saveTimer >= 6.0) {
        this.saveTimer = 0;
        this._saveState();
      }

      // Smooth camera transition
      this._updateCamera(Math.min(1, dt * 2.6));

      // Update world props & particles
      this.world.update(dt);

      // Update held carrot biting & neck-stretching pull mechanic (Discovery 2)
      if (this.dragMode === 'carrot' && this.heldCarrotState) {
        this._updateHeldCarrotInteraction(dt);
      }

      // Update discovery milestones & single world-object highlight
      this._updateDiscoveriesAndHighlight();

      // Update goat AI behaviors
      this._updateMotherAI(dt);
      for (const k of this.kids) {
        this._updateKidAI(k, dt);
      }
      this._checkSideBySideHayTug();
      this._checkIdleForeheadBump();

      // Step goat skeletal & procedural animations
      const env = {
        spawnWaterDrip: (pos) => this.world.spawnWaterDrip(pos)
      };
      for (const g of this.allGoats) {
        g.update(dt, env);
      }
    }

    _updateHeldCarrotInteraction(dt) {
      const st = this.heldCarrotState;
      const cPos = this.world.heldCarrot.group.position;

      // Find nearest non-sitting kid whose snout can reach the carrot
      let bestKid = null;
      let bestDist = 0.68;
      for (const k of this.kids) {
        if (k.isSitting) continue;
        const headPos = k.getHeadWorldPosition();
        const d = Math.hypot(cPos.x - headPos.x, cPos.y - headPos.y, cPos.z - headPos.z);
        if (d < bestDist) {
          bestDist = d;
          bestKid = k;
        }
      }

      if (bestKid) {
        if (st.bitingGoat && st.bitingGoat !== bestKid && st.bitingGoat.state === 'eat_carrot') {
          st.bitingGoat.state = 'idle';
        }
        st.bitingGoat = bestKid;
        bestKid.state = 'eat_carrot';
        bestKid.perkEars(0.95);
        bestKid.lookTarget = cPos.clone();

        // Gently shift kid closer to carrot's X
        bestKid.targetX = Math.max(-0.68, Math.min(0.68, cPos.x));
        if (bestKid.zone === 'inside') {
          bestKid.targetZ = -0.28;
          bestKid.targetRotY = Math.atan2(cPos.x - bestKid.x, Math.max(0.2, cPos.z - bestKid.z));
        } else {
          bestKid.targetZ = Math.max(0.28, Math.min(0.88, cPos.z - 0.34));
          bestKid.targetRotY = Math.atan2(cPos.x - bestKid.x, cPos.z - bestKid.z);
        }

        // If child slowly pulls finger back without letting go, kid stretches neck forward to follow!
        const pullExtension = Math.max(0.55, Math.min(1.18, bestDist * 1.85));
        bestKid.neckReach += (pullExtension - bestKid.neckReach) * Math.min(1, dt * 6);

        // Bite when carrot tip is within lip reach!
        if (bestDist < 0.56 && st.remaining > 0.14) {
          st.biteTimer -= dt;
          if (st.biteTimer <= 0) {
            st.biteTimer = 0.88;
            st.remaining = Math.max(0.06, st.remaining - 0.28);
            this.world.heldCarrot.setRemaining(st.remaining);
            this.world.spawnCarrotCrumbs(bestKid.getWorldSnoutPosition(), 8);
            window.KoyagiAudio.playCarrotBite();

            bestKid.chewAmount = 1.0;
            bestKid.jawOpen = 0.7;
            setTimeout(() => { bestKid.jawOpen = 0; }, 160);
            bestKid.carrotsEaten++;
            bestKid.fullness += 1.05;
            bestKid.remembersCarrot = true;
            bestKid.lastAteSlot = 'hand';
            this.totalCarrotBites++;

            if (st.remaining <= 0.14) {
              // Final nibble -> happy gentle bleat & drop chewed leafy stem
              window.KoyagiAudio.playSoftBleat(bestKid.id === 'white' ? 1.15 : 1.02);
              this._releaseHeldCarrot();
              this.dragMode = null;
              this.activePointerId = null;
            }
          }
        }
      } else if (st.bitingGoat) {
        if (st.bitingGoat.state === 'eat_carrot') {
          st.bitingGoat.state = 'idle';
          st.bitingGoat.lookTarget = null;
        }
        st.bitingGoat = null;
      }
    }

    _updateDiscoveriesAndHighlight() {
      // Discovery 2: Leafy baby carrots emerge in basket (~2-3 min OR after 3 hay feedings)
      if (!this.world.carrotsUnlocked && (this.totalHayFed >= 3 || this.elapsedPlay >= 60)) {
        this.world.carrotsUnlocked = true;
      }

      // Discovery 4: Adult Mother Goat slowly walks forward from distant pasture
      if (!this.motherApproached && (this.totalHayFed + this.totalCarrotBites >= 5 || this.elapsedPlay >= 105)) {
        this.motherApproached = true;
        this.motherGoat.state = 'walk_in';
        this.motherGoat.targetX = -0.05;
        this.motherGoat.targetZ = -1.10;
        this.motherGoat.targetRotY = 0.08;
      }

      // Discovery 5: Wooden gate gently creaks slightly ajar (~3-4 min OR after 7+ rich interactions)
      const totalInteractions = this.totalHayFed + this.totalCarrotBites + this.totalDrinks + this.motherFedCount;
      if (!this.gateInvited && (totalInteractions >= 7 || this.elapsedPlay >= 145)) {
        this.gateInvited = true;
        if (this.world.gateTargetAngle < 0.15) {
          this.world.gateTargetAngle = 0.24; // slightly ajar inviting touch!
          window.KoyagiAudio.playGateCreak();
        }
      }

      // Fullness & Peaceful End-of-Cycle Rest (~5-8 min or both kids well-fed)
      const avgFullness = (this.whiteKid.fullness + this.fawnKid.fullness) * 0.5;
      if (!this.roundRestTriggered && avgFullness >= 8.2 && this.kids.every(k => k.state === 'idle' || k.state === 'propped_wait')) {
        this.roundRestTriggered = true;
        this._beginPeacefulRest();
      }

      // Choose ONLY ONE next-touchable world object to softly glow/bounce
      if (this.dragMode) {
        this.world.highlightTarget = null;
      } else if (this.roundRestTriggered) {
        this.world.highlightTarget = 'basket_hay';
      } else if (this.viewMode === 'meadow' && this.basketSpilledCount === 0) {
        this.world.highlightTarget = 'basket_tilt';
      } else if (this.gateInvited && this.world.gateTargetAngle < 0.65 && this.viewMode === 'fence') {
        this.world.highlightTarget = 'gate';
      } else if (this.totalHayFed >= 4 && this.totalDrinks === 0) {
        this.world.highlightTarget = 'bucket';
      } else if (this.world.carrotsUnlocked && this.totalCarrotBites === 0) {
        this.world.highlightTarget = 'carrot';
      } else if (this.totalHayFed < 3) {
        this.world.highlightTarget = 'basket_hay';
      } else {
        // Gentle subtle rhythm between basket hay & carrot after all discoveries are live
        this.world.highlightTarget = (this.world.carrotsUnlocked && this.totalCarrotBites < 3) ? 'carrot' : 'basket_hay';
      }
    }

    _beginPeacefulRest() {
      // Kids gather near Mother Goat (or together on the sunny grass) and fold their legs to rest
      for (const k of this.kids) {
        k.state = 'to_rest';
        k.stateTimer = 0;
        if (k.zone === 'outside') {
          k.targetX = k.id === 'white' ? -0.34 : 0.36;
          k.targetZ = 0.54;
          k.targetRotY = k.id === 'white' ? 0.42 : -0.45;
        } else {
          const anchorX = this.motherApproached ? this.motherGoat.x : 0;
          const anchorZ = this.motherApproached ? Math.min(-0.46, this.motherGoat.z + 0.42) : -0.42;
          k.targetX = anchorX + (k.id === 'white' ? -0.34 : 0.34);
          k.targetZ = anchorZ;
          k.targetRotY = k.id === 'white' ? 0.32 : -0.32;
        }
      }
    }

    _updateMotherAI(dt) {
      const m = this.motherGoat;
      if (m.state === 'walk_in') {
        const d = Math.hypot(m.targetX - m.x, m.targetZ - m.z);
        if (d < 0.08) {
          // Arrived near fence! Gently nudge nearest inside kid's back with her nose!
          const insideKid = this.kids.find(k => k.zone === 'inside');
          if (insideKid && !this.motherNudged) {
            this.motherNudged = true;
            m.state = 'nudge_kid';
            m.stateTimer = 0;
            m.nudgeTargetKid = insideKid;
            m.targetX = insideKid.x;
            m.targetZ = insideKid.z - 0.56;
            m.lookTarget = new THREE.Vector3(insideKid.x, 0.55, insideKid.z);
          } else {
            m.state = 'idle';
            m.stateTimer = 0;
          }
        }
      } else if (m.state === 'nudge_kid') {
        const k = m.nudgeTargetKid;
        if (k) {
          m.lookTarget = new THREE.Vector3(k.x, 0.52, k.z);
          if (m.stateTimer > 1.4 && m.stateTimer < 1.6) {
            // Soft affectionate mother nudge -> kid perks ears & wags tail happily
            k.perkEars(1.0);
            if (!k.isSitting) k.triggerHop();
          }
        }
        if (m.stateTimer > 2.8) {
          m.state = 'idle';
          m.stateTimer = 0;
          m.lookTarget = null;
          m.targetX = -0.05;
          m.targetZ = -1.06;
          m.targetRotY = 0.08;
        }
      } else if (m.state === 'mother_eat') {
        if (m.stateTimer > 4.2) {
          m.state = 'idle';
          m.stateTimer = 0;
          m.lookTarget = null;
        }
      } else if (!this.motherApproached) {
        // Distant peaceful grazing in background pasture before Discovery 4
        m.lookTarget = new THREE.Vector3(m.x + Math.sin(this.world.time * 0.3) * 0.6, 0.15, m.z + 0.5);
        m.chewAmount = 0.35;
      }
    }

    _updateKidAI(kid, dt) {
      // Handle delayed look-up reaction (Discovery 6)
      if (this.delayedLookTimers[kid.id] > 0) {
        this.delayedLookTimers[kid.id] -= dt;
        if (this.delayedLookTimers[kid.id] <= 0 && this.delayedLookTargets[kid.id]) {
          kid.perkEars(0.85);
          kid.lookTarget = this.delayedLookTargets[kid.id];
          this.delayedLookTargets[kid.id] = null;
        }
      }

      const dist = Math.hypot(kid.targetX - kid.x, kid.targetZ - kid.z);

      // --- Exiting wooden gate one by one (Discovery 5) ---
      if (kid.state === 'exit_gate') {
        if (this.world.gateTargetAngle < 0.6 && kid.zone === 'inside' && kid.exitStage < 2) {
          // Gate closed before this kid crossed -> stays inside!
          kid.state = 'idle';
          kid.targetX = kid.id === 'white' ? -0.36 : 0.34;
          kid.targetZ = -0.36;
          return;
        }

        if (kid.exitStage === 0) {
          if (kid.stateTimer < kid.exitDelay) return;
          // Walk behind gate gap
          kid.targetX = 0.90;
          kid.targetZ = -0.32;
          if (Math.hypot(kid.targetX - kid.x, kid.targetZ - kid.z) < 0.12) {
            kid.exitStage = 1;
          }
          return;
        } else if (kid.exitStage === 1) {
          // Step cleanly through open wooden gate into foreground meadow
          kid.targetX = 0.88;
          kid.targetZ = 0.44;
          if (Math.hypot(kid.targetX - kid.x, kid.targetZ - kid.z) < 0.12) {
            kid.zone = 'outside';
            kid.exitStage = 2;
            // Trot right up close to foreground basket & sniff inside!
            kid.targetX = kid.id === 'white' ? -0.26 : 0.30;
            kid.targetZ = 0.56;
            kid.targetRotY = kid.id === 'white' ? 0.55 : -0.55;
            kid.lookTarget = new THREE.Vector3(0.02, 0.28, 0.88);
          }
          return;
        } else if (kid.exitStage === 2) {
          if (dist < 0.10) {
            kid.state = 'sniff_basket';
            kid.stateTimer = 0;
            kid.perkEars(0.9);
            kid.lookTarget = new THREE.Vector3(0.02, 0.24, 0.88);
          }
          return;
        }
      }

      // --- Walking to trough (with optional Mother Goat greeting waypoint) ---
      if (kid.state === 'to_trough' || kid.state === 'hurry') {
        if (dist < 0.09) {
          if (kid.viaMother) {
            // Greeted Mother's legs, now head directly to trough!
            kid.viaMother = false;
            const slot = this.world.troughs[kid.pendingTroughSlot];
            kid.targetX = slot.x + (kid.pendingTroughOffset || 0);
            kid.targetZ = kid.zone === 'inside' ? -0.30 : 0.42;
            return;
          }
          const slot = this.world.troughs[kid.pendingTroughSlot];
          if (slot && slot.hayAmount > 0.05) {
            kid.state = 'eat_hay';
            kid.eatingSlot = kid.pendingTroughSlot;
            kid.startEatingHay(3.4, true);
            kid.lookTarget = new THREE.Vector3(slot.x, slot.y, slot.z);
          } else {
            kid.state = 'idle';
          }
        }
        return;
      }

      // --- Eating hay from trough ---
      if (kid.state === 'eat_hay') {
        const slot = this.world.troughs[kid.eatingSlot];
        if (slot && slot.hayAmount > 0.02) {
          slot.hayAmount = Math.max(0, slot.hayAmount - dt * 0.21);
          this.world.updateTroughVisual(kid.eatingSlot);
          kid.chewAmount = 1.0;
        }
        if (kid.stateTimer > 3.2 || !slot || slot.hayAmount <= 0.02) {
          kid.hayEaten++;
          kid.fullness += 0.9;
          kid.lastAteSlot = kid.eatingSlot;
          kid.state = 'idle';
          kid.stateTimer = 0;
          kid.lookTarget = null;
        }
        return;
      }

      // --- Side-by-side hay tug animation ---
      if (kid.state === 'tug_hay') {
        if (kid.stateTimer > 1.35) {
          kid.mouthHayPull = 0;
          kid.state = 'eat_hay';
          kid.stateTimer = 1.2;
        }
        return;
      }

      // --- Walking to & drinking from tin water bucket (Discovery 3) ---
      if (kid.state === 'to_bucket') {
        if (dist < 0.12) {
          kid.state = 'drink';
          kid.stateTimer = 0;
          kid.sipTimer = 0.2;
          kid.lookTarget = new THREE.Vector3(this.world.bucketGroup.position.x, 0.14, this.world.bucketGroup.position.z);
        }
        return;
      }

      if (kid.state === 'drink') {
        kid.sipTimer -= dt;
        if (kid.sipTimer <= 0) {
          kid.sipTimer = 0.55;
          window.KoyagiAudio.playWaterSip();
          this.world.triggerWaterRipple();
          this.world.waterLevel = Math.max(0.28, this.world.waterLevel - 0.045);
        }
        if (kid.stateTimer > 2.6) {
          this.totalDrinks++;
          kid.wetChinTimer = 2.6; // Chin water droplets drip when lifting head! (顎から水滴がしたたります)
          kid.state = 'idle';
          kid.stateTimer = 0;
          kid.lookTarget = null;
          kid.targetX = kid.id === 'white' ? -0.36 : 0.36;
          kid.targetZ = kid.zone === 'inside' ? -0.34 : 0.52;
        }
        return;
      }

      // --- Sniffing basket up close in Low Meadow View ---
      if (kid.state === 'sniff_basket') {
        kid.lookTarget = new THREE.Vector3(
          this.world.basketGroup.position.x,
          0.26,
          this.world.basketGroup.position.z
        );
        if (kid.stateTimer > 3.0) {
          kid.state = 'idle';
          kid.stateTimer = 0;
        }
        return;
      }

      // --- Eating spilled hay or fallen carrot on the meadow grass ---
      if (kid.state === 'to_ground_item') {
        const it = kid.targetLooseItem;
        if (!it || !it.edible) {
          kid.state = 'idle';
          return;
        }
        if (dist < 0.28) {
          kid.state = 'eat_ground';
          kid.stateTimer = 0;
          kid.lookTarget = new THREE.Vector3(it.x, 0.04, it.z);
          if (it.type === 'carrot') {
            window.KoyagiAudio.playCarrotBite();
            this.world.spawnCarrotCrumbs(new THREE.Vector3(it.x, 0.06, it.z), 6);
            kid.remembersCarrot = true;
            kid.carrotsEaten++;
          } else {
            kid.startEatingHay(2.8, true);
            kid.hayEaten++;
          }
          kid.fullness += 0.95;
        }
        return;
      }

      if (kid.state === 'eat_ground') {
        const it = kid.targetLooseItem;
        if (kid.stateTimer > 2.2) {
          if (it && it.edible) {
            it.edible = false;
            if (it.type === 'carrot') {
              // Leave chewed leafy carrot top on the grass!
              it.obj.setRemaining(0.04);
              it.type = 'carrot_leaf';
              if (it.hit) it.hit.visible = false;
            } else {
              // Shrink spilled hay slightly so some scattered hay remains on grass
              it.mesh.scale.multiplyScalar(0.55);
            }
          }
          kid.targetLooseItem = null;
          kid.state = 'idle';
          kid.stateTimer = 0;
          kid.lookTarget = null;
        }
        return;
      }

      // --- Snuggling beside Mother Goat's legs ---
      if (kid.state === 'snuggle_mother') {
        if (kid.stateTimer > 4.0) {
          kid.state = 'idle';
          kid.stateTimer = 0;
          kid.lookTarget = null;
        }
        return;
      }

      // --- Walking to rest spot & folding legs ---
      if (kid.state === 'to_rest') {
        if (dist < 0.12) {
          kid.sitDown();
        }
        return;
      }

      if (kid.state === 'rest') {
        return;
      }

      // --- Everyday goat behaviors while waiting (rubbing forehead on fence, low hop, head bump, expecting carrot vs hay) ---
      if (kid.state === 'rub_fence' || kid.state === 'head_bump') {
        if (kid.stateTimer > 2.1) {
          kid.state = 'idle';
          kid.stateTimer = 0;
          kid.lookTarget = null;
        }
        return;
      }

      // --- Idle / Propped-Wait decision making ---
      // 1. Check if there is an edible loose item (spilled hay or fallen carrot) reachable!
      const looseFood = this.world.looseItems.find(it => {
        if (!it.edible) return false;
        if (kid.zone === 'outside' && !it.onTroughRim) return true;
        if (kid.zone === 'inside' && it.onTroughRim) return true;
        return false;
      });
      if (looseFood && !this.roundRestTriggered) {
        kid.targetLooseItem = looseFood;
        kid.state = 'to_ground_item';
        kid.stateTimer = 0;
        const angle = Math.atan2(looseFood.x - kid.x, looseFood.z - kid.z);
        kid.targetX = looseFood.x - Math.sin(angle) * 0.22;
        kid.targetZ = looseFood.onTroughRim ? -0.30 : Math.max(0.28, looseFood.z - Math.cos(angle) * 0.22);
        kid.targetRotY = angle;
        kid.lookTarget = new THREE.Vector3(looseFood.x, looseFood.y, looseFood.z);
        return;
      }

      // 2. Check if any trough still has hay to munch
      const preferredSlot = kid.id === 'white' ? 'left' : 'right';
      if (this.world.troughs[preferredSlot].hayAmount > 0.12) {
        this._dispatchKidToTrough(kid, preferredSlot);
        return;
      }
      if (this.world.troughs.center.hayAmount > 0.12) {
        this._dispatchKidToTrough(kid, 'center', kid.id === 'white' ? -0.18 : 0.18);
        return;
      }

      // 3. Expectation positioning (Discovery 6):
      // Carrot-fed kid waits right near the basket with front hooves propped on the lower fence rail!
      // Hay-only kid waits slightly further back with subtle ear/jaw movements.
      if (kid.zone === 'inside' && !this.roundRestTriggered) {
        if (kid.remembersCarrot) {
          kid.targetX = kid.id === 'white' ? -0.22 : 0.22;
          kid.targetZ = -0.27;
          kid.targetRotY = kid.id === 'white' ? 0.18 : -0.18;
          if (dist < 0.08) kid.state = 'propped_wait';
        } else {
          kid.targetX = kid.id === 'white' ? -0.38 : 0.38;
          kid.targetZ = kid.hayEaten > 0 ? -0.44 : -0.34;
          kid.targetRotY = kid.id === 'white' ? 0.20 : -0.20;
        }
      } else if (kid.zone === 'outside' && !this.roundRestTriggered) {
        // Wait softly near basket in meadow view
        kid.targetX = kid.id === 'white' ? -0.34 : 0.36;
        kid.targetZ = kid.remembersCarrot ? 0.62 : 0.46;
        kid.targetRotY = kid.id === 'white' ? 0.45 : -0.45;
      }

      // 4. Gentle everyday kid behaviors while waiting (rub head on fence, realistic low 4-leg hop)
      kid.idleActionTimer -= dt;
      if (kid.idleActionTimer <= 0 && !kid.isSitting) {
        kid.idleActionTimer = 4.5 + Math.random() * 4.5;
        const r = Math.random();
        if (r < 0.38 && kid.zone === 'inside' && kid.state !== 'propped_wait') {
          // Rub hornless forehead gently against the wooden fence rail
          kid.state = 'rub_fence';
          kid.stateTimer = 0;
        } else if (r < 0.66 && kid.fullness < 6.5) {
          // Low, brief, realistic 4-legged kid hop (never exaggerated!)
          kid.triggerHop();
        } else {
          // Soft look toward basket or viewer
          kid.lookTarget = new THREE.Vector3(0.02, 0.35, 0.88);
          kid.perkEars(0.5);
        }
      }
    }

    // Side-by-side Center trough hay tug split (片方がもう片方の口元の草を横からくわえて引っぱり、草が二つに分かれます)
    _checkSideBySideHayTug() {
      if (this.tugCooldown > 0) return;
      const w = this.whiteKid;
      const f = this.fawnKid;
      if (w.state === 'eat_hay' && f.state === 'eat_hay' && w.eatingSlot === 'center' && f.eatingSlot === 'center') {
        if (w.mouthHayAmount > 0.35 && Math.hypot(w.x - f.x, w.z - f.z) < 0.52) {
          this.tugCooldown = 9.0;
          const puller = Math.random() < 0.5 ? f : w;
          const holder = puller === f ? w : f;

          puller.state = 'tug_hay';
          puller.stateTimer = 0;
          puller.lookTarget = holder.getWorldSnoutPosition();

          holder.state = 'tug_hay';
          holder.stateTimer = 0;
          holder.mouthHayPull = 1.0;

          // Split the hay stalk in two mid-tug!
          setTimeout(() => {
            const mid = holder.getWorldSnoutPosition().lerp(puller.getWorldSnoutPosition(), 0.5);
            this.world.spawnHayLeaves(mid, 6, 0.48);
            window.KoyagiAudio.playHayRustle(0.65, 0.18);
            holder.mouthHayAmount = 0.55;
            puller.mouthHayAmount = 0.55;
          }, 680);
        }
      }
    }

    // Occasional gentle forehead-to-forehead kid bump when idling close together
    _checkIdleForeheadBump() {
      const w = this.whiteKid;
      const f = this.fawnKid;
      if (w.state === 'idle' && f.state === 'idle' && w.zone === f.zone && !w.isSitting && !f.isSitting) {
        const d = Math.hypot(w.x - f.x, w.z - f.z);
        if (d < 0.82 && w.stateTimer > 6.5 && f.stateTimer > 6.5 && Math.random() < 0.004) {
          const midX = (w.x + f.x) * 0.5;
          const midZ = (w.z + f.z) * 0.5;
          w.state = 'head_bump';
          f.state = 'head_bump';
          w.stateTimer = 0;
          f.stateTimer = 0;
          w.lookTarget = new THREE.Vector3(midX, 0.68, midZ);
          f.lookTarget = new THREE.Vector3(midX, 0.68, midZ);
          w.targetRotY = Math.atan2(f.x - w.x, f.z - w.z);
          f.targetRotY = Math.atan2(w.x - f.x, w.z - f.z);
        }
      }
    }

    // --- 4-Second Translucent Guiding Child's Finger (Zero Text / Zero Icons / Zero Arrows) ---
    _projectToScreen(worldPos) {
      const p = worldPos.clone().project(this.camera);
      return {
        x: (p.x * 0.5 + 0.5) * this.width,
        y: (-p.y * 0.5 + 0.5) * this.height
      };
    }

    _drawFingerGuide(dt) {
      const ctx = this.guideCtx;
      ctx.clearRect(0, 0, this.width, this.height);

      const waitThreshold = this.roundRestTriggered ? 6.5 : 4.0;
      const shouldShow = !this.dragMode && this.idleSeconds >= waitThreshold && this.world.highlightTarget;

      if (shouldShow) {
        this.guideAlpha = Math.min(1, this.guideAlpha + dt * 1.8);
        this.guideAnimPhase = (this.guideAnimPhase + dt * 0.55) % 1.0;
      } else {
        this.guideAlpha = Math.max(0, this.guideAlpha - dt * 5.0);
      }

      if (this.guideAlpha <= 0.01) return;

      // Determine 3D start & end points for the natural gesture
      const start3 = this.world.getWorldPositionOfHighlight();
      let end3 = start3.clone();
      let isTapGesture = false;

      if (this.roundRestTriggered) {
        isTapGesture = true;
      } else if (this.world.highlightTarget === 'basket_hay') {
        const slotKey = this.totalHayFed === 0 ? 'left' : this.totalHayFed === 1 ? 'right' : 'center';
        const s = this.world.troughs[slotKey];
        end3.set(s.x, s.y + 0.06, s.z);
      } else if (this.world.highlightTarget === 'carrot') {
        const kidPos = this.whiteKid.getWorldSnoutPosition();
        end3.set(kidPos.x, kidPos.y + 0.02, 0.14);
      } else if (this.world.highlightTarget === 'bucket') {
        end3.set(start3.x + 0.06, start3.y, start3.z - 0.24);
      } else if (this.world.highlightTarget === 'gate') {
        end3.set(start3.x + 0.34, start3.y, start3.z + 0.26);
      } else if (this.world.highlightTarget === 'basket_tilt') {
        end3.set(start3.x - 0.32, start3.y - 0.05, start3.z);
      }

      const p0 = this._projectToScreen(start3);
      const p1 = this._projectToScreen(end3);

      // Ease animation curve with gentle pause at start and end
      const tRaw = this.guideAnimPhase;
      let gx = p0.x, gy = p0.y, pressScale = 1.0, fade = 1.0;
      if (isTapGesture) {
        const tapWave = Math.sin(tRaw * Math.PI * 2);
        pressScale = 1.0 - Math.max(0, tapWave) * 0.14;
        fade = 0.7 + 0.3 * Math.sin(tRaw * Math.PI);
      } else {
        const moveT = Math.max(0, Math.min(1, (tRaw - 0.14) / 0.62));
        const ease = moveT * moveT * (3 - 2 * moveT);
        gx = p0.x + (p1.x - p0.x) * ease;
        gy = p0.y + (p1.y - p0.y) * ease - Math.sin(ease * Math.PI) * 22;
        pressScale = tRaw > 0.1 && tRaw < 0.8 ? 0.92 : 1.0;
        fade = tRaw < 0.12 ? tRaw / 0.12 : (tRaw > 0.84 ? (1 - tRaw) / 0.16 : 1.0);
      }

      const alpha = this.guideAlpha * fade * 0.56;
      if (alpha <= 0.01) return;

      // Soft warm translucent touch ripple at fingertip
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(pressScale, pressScale);

      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
      glow.addColorStop(0, `rgba(255, 248, 232, ${alpha * 0.95})`);
      glow.addColorStop(1, 'rgba(255, 248, 232, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      // Delicate semi-transparent child's pointing finger silhouette (半透明の指 — no text, no icons, no arrows)
      ctx.rotate(-0.32);
      ctx.fillStyle = `rgba(255, 246, 235, ${alpha})`;
      ctx.strokeStyle = `rgba(170, 140, 110, ${alpha * 0.55})`;
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      // Rounded index fingertip centered at (0, 0) extending down-right into a tiny soft palm
      ctx.moveTo(-7, 2);
      ctx.arc(0, 2, 7, Math.PI, 0, false);
      ctx.lineTo(7, 24);
      ctx.quadraticCurveTo(18, 24, 19, 34);
      ctx.quadraticCurveTo(21, 50, 8, 56);
      ctx.quadraticCurveTo(-8, 60, -16, 46);
      ctx.quadraticCurveTo(-20, 34, -12, 26);
      ctx.lineTo(-7, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // --- Persistence (localStorage) ---
    _saveState() {
      try {
        const payload = {
          v: 1,
          elapsedPlay: this.elapsedPlay,
          totalHayFed: this.totalHayFed,
          totalCarrotBites: this.totalCarrotBites,
          totalDrinks: this.totalDrinks,
          motherApproached: this.motherApproached,
          motherNudged: this.motherNudged,
          motherFedCount: this.motherFedCount,
          gateInvited: this.gateInvited,
          basketSpilledCount: this.basketSpilledCount,
          roundRestTriggered: this.roundRestTriggered,
          lastFedKidId: this.lastFedKidId,
          consecutiveKidId: this.consecutiveKidId,
          consecutiveCount: this.consecutiveCount,
          viewMode: this.viewMode,
          goats: {
            white: this.whiteKid.serialize(),
            fawn: this.fawnKid.serialize(),
            mother: this.motherGoat.serialize()
          },
          world: this.world.serialize()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        // Ignore storage quota / private mode issues
      }
    }

    _restoreState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || data.v !== 1) return;

        if (typeof data.elapsedPlay === 'number') this.elapsedPlay = data.elapsedPlay;
        if (typeof data.totalHayFed === 'number') this.totalHayFed = data.totalHayFed;
        if (typeof data.totalCarrotBites === 'number') this.totalCarrotBites = data.totalCarrotBites;
        if (typeof data.totalDrinks === 'number') this.totalDrinks = data.totalDrinks;
        this.motherApproached = !!data.motherApproached;
        this.motherNudged = !!data.motherNudged;
        if (typeof data.motherFedCount === 'number') this.motherFedCount = data.motherFedCount;
        this.gateInvited = !!data.gateInvited;
        if (typeof data.basketSpilledCount === 'number') this.basketSpilledCount = data.basketSpilledCount;
        this.roundRestTriggered = !!data.roundRestTriggered;
        this.lastFedKidId = data.lastFedKidId || null;
        this.consecutiveKidId = data.consecutiveKidId || null;
        if (typeof data.consecutiveCount === 'number') this.consecutiveCount = data.consecutiveCount;
        if (data.viewMode === 'meadow' || data.viewMode === 'fence') {
          this.viewMode = data.viewMode;
          this.viewBlend = this.viewMode === 'meadow' ? 1 : 0;
        }

        if (data.goats) {
          this.whiteKid.restore(data.goats.white);
          this.fawnKid.restore(data.goats.fawn);
          this.motherGoat.restore(data.goats.mother);
        }
        if (data.world) {
          this.world.restore(data.world);
        }
      } catch (e) {
        // Fallback cleanly to fresh afternoon start
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.koyagiGame = new KoyagiGame();
  });
})();
