(function () {
  'use strict';

  const STORAGE_KEY = 'kapibara_pokapoka_save_v1';

  class PokapokaGame {
    constructor() {
      this.canvas = document.getElementById('stage');
      this.handDemoEl = document.getElementById('hand-demo');

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (THREE.SRGBColorSpace) {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.06;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);

      // Camera transition state (0 = diagonal rim view, 1 = water-level / platform intimate view)
      this.camLowBlend = 0;
      this.camLowTarget = 0;
      this.camPos = new THREE.Vector3();
      this.camLook = new THREE.Vector3();

      this.audio = new window.PokapokaAudio();
      this.textures = window.PokapokaTextures;
      this.env = new window.PokapokaEnvironment(this.scene, this.textures);
      this.basket = new window.PokapokaProps.BambooBasket(this.scene, this.textures, this.env);
      this.crumbs = new window.PokapokaProps.CrumbPool(this.scene);

      // Active props in the world
      this.foods = [];
      this.yuzus = [];

      // Three capybaras: Adult & Baby prominently in center from Frame 1; 3rd enters calmly mid-game
      this.adult = new window.PokapokaCapybara({
        id: 'adult',
        scale: 1.04,
        x: -0.20,
        y: -0.22,
        z: 0.04,
        homeX: -0.20,
        homeZ: 0.04,
        facing: 0.42,
        baseHex: '#9e7856',
        tipHex: '#cca680',
        wetHex: '#705139',
        seed: 101,
        env: this.env,
        audio: this.audio,
        textures: this.textures
      });
      this.scene.add(this.adult.root);

      this.baby = new window.PokapokaCapybara({
        id: 'baby',
        scale: 0.65,
        x: 0.34,
        y: -0.12,
        z: 0.22,
        homeX: 0.34,
        homeZ: 0.22,
        facing: -0.26,
        baseHex: '#ad8664',
        tipHex: '#d7b48f',
        wetHex: '#7d5c42',
        seed: 207,
        env: this.env,
        audio: this.audio,
        textures: this.textures
      });
      this.scene.add(this.baby.root);

      this.friend = new window.PokapokaCapybara({
        id: 'friend',
        scale: 0.96,
        x: -1.45,
        y: 0.24,
        z: -3.6,
        homeX: -0.68,
        homeZ: -0.26,
        facing: 0.42,
        inWater: false,
        visible: false,
        baseHex: '#8f6c4e',
        tipHex: '#b9936f',
        wetHex: '#634630',
        seed: 319,
        env: this.env,
        audio: this.audio,
        textures: this.textures
      });
      this.scene.add(this.friend.root);

      this.capybaras = [this.adult, this.baby, this.friend];

      // Discovery & progression counters (natural 5-8 min rhythm)
      this.elapsedPlayTime = 0;
      this.applesFed = 0;
      this.yuzusDropped = 0;
      this.troughUsed = false;
      this.cabbagePlaced = 0;
      this.friendArrived = false;
      this.platformUnlocked = false;
      this.finaleActive = false;
      this.duskFactor = 0;

      // Single-finger interaction & idle guidance state
      this.raycaster = new THREE.Raycaster();
      this.pointerNdc = new THREE.Vector2();
      this.dragState = null;
      this.idleSeconds = 0;
      this.handDemoPhase = 0;
      this.hasEverTouched = false;
      this.saveTimer = 0;
      this.replenishTimer = 0;
      this.appleSpotIndex = 0;

      // Restore previous saved evening if available (always keeping adult & baby clearly visible and an apple in basket!)
      this._restoreState();

      this._bindEvents();
      this._onResize();

      // Immediate first render so Frame 1 shows adult & baby clearly right away
      this._updateCamera(1.0);
      this.renderer.render(this.scene, this.camera);

      this.lastTime = performance.now();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    _bindEvents() {
      window.addEventListener('resize', () => this._onResize());
      window.addEventListener('orientationchange', () => setTimeout(() => this._onResize(), 60));

      this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e), { passive: false });
      window.addEventListener('pointermove', (e) => this._onPointerMove(e), { passive: false });
      window.addEventListener('pointerup', (e) => this._onPointerUp(e), { passive: false });
      window.addEventListener('pointercancel', (e) => this._onPointerUp(e), { passive: false });

      window.addEventListener('pagehide', () => this._saveState());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this._saveState();
      });
    }

    _onResize() {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      this.width = w;
      this.height = h;
      this.aspect = w / h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = this.aspect;
      this._updateCamera(1.0);
    }

    _updateCamera(lerpAlpha) {
      // Responsive framing for both iPhone portrait (390x844) and iPad landscape (1180x820)
      const portraitT = Math.max(0, Math.min(1, (1.10 - this.aspect) / 0.65));

      // Diagonal rim-height camera (initial view: adult & baby big in center, sunset sky visible, basket + apples + yuzu + trough + platform framed)
      const highFov = 41 + portraitT * 15; // 41° landscape -> 56° portrait
      const highPos = new THREE.Vector3(
        0.04 - portraitT * 0.02,
        1.02 + portraitT * 0.44,
        3.08 + portraitT * 0.96
      );
      const highLook = new THREE.Vector3(
        0.02,
        0.34 + portraitT * 0.02,
        0.24 + portraitT * 0.08
      );

      // Low water-level / raised-stone-platform camera (~3-4 min smooth descent)
      const lowFov = 43 + portraitT * 14;
      const lowPos = new THREE.Vector3(
        0.10 - portraitT * 0.04,
        0.44 + portraitT * 0.14,
        2.32 + portraitT * 0.72
      );
      const lowLook = new THREE.Vector3(
        0.14 - portraitT * 0.04,
        0.26 + portraitT * 0.03,
        0.22 + portraitT * 0.06
      );

      const b = this.camLowBlend;
      // Smooth cubic ease
      const sb = b * b * (3 - 2 * b);
      const targetPos = highPos.lerp(lowPos, sb);
      const targetLook = highLook.lerp(lowLook, sb);
      const targetFov = highFov + (lowFov - highFov) * sb;

      if (lerpAlpha >= 0.99) {
        this.camPos.copy(targetPos);
        this.camLook.copy(targetLook);
        this.camera.fov = targetFov;
      } else {
        this.camPos.lerp(targetPos, lerpAlpha);
        this.camLook.lerp(targetLook, lerpAlpha);
        this.camera.fov += (targetFov - this.camera.fov) * lerpAlpha;
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.updateProjectionMatrix();
    }

    _setPointerFromEvent(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    _raycastPlaneY(yLevel) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLevel);
      const out = new THREE.Vector3();
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      if (this.raycaster.ray.intersectPlane(plane, out)) {
        return out;
      }
      return null;
    }

    _onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();

      this.audio.unlock();
      this.hasEverTouched = true;
      this.idleSeconds = 0;
      this._hideHandDemo();

      this._setPointerFromEvent(e);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);

      // Collect ONLY real interactive world objects (never respond to empty sky/background!)
      const candidates = [];
      candidates.push(...this.basket.getInteractiveMeshes());
      candidates.push(this.env.troughHitMesh);
      for (let i = 0; i < this.foods.length; i++) {
        if (this.foods[i].alive) candidates.push(this.foods[i].hitMesh);
      }
      for (let i = 0; i < this.yuzus.length; i++) {
        if (this.yuzus[i].alive) candidates.push(this.yuzus[i].hitMesh);
      }

      const hits = this.raycaster.intersectObjects(candidates, false);
      if (hits.length === 0) return;

      // Prioritize food items inside basket over basket rim itself
      let picked = hits[0].object;
      for (let i = 0; i < hits.length; i++) {
        const k = hits[i].object.userData.interactKind;
        if (k === 'basket_apple' || k === 'basket_yuzu' || k === 'basket_cabbage') {
          picked = hits[i].object;
          break;
        }
      }

      // If waking from the purple dusk finale via touching the basket or its food, wake the baby gently!
      const kind = picked.userData.interactKind;
      if (this.finaleActive && (kind === 'basket' || kind === 'basket_apple' || kind === 'basket_yuzu' || kind === 'basket_cabbage')) {
        this._wakeFromFinale();
      }

      if (kind === 'trough') {
        this.troughUsed = true;
        this.env.triggerTroughPour(3.0);
        this.dragState = {
          kind: 'trough',
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false
        };
        return;
      }

      if (kind === 'basket_apple') {
        if (this.basket.appleCount <= 0) return;
        this.audio.playBasketTouch();
        const origin = this.basket.getWorldAnchorFor('apple');
        const apple = this.basket.spawnApple(origin.x, origin.y + 0.05, origin.z);
        apple.dragging = true;
        this.foods.push(apple);
        this.basket.appleCount = Math.max(1, this.basket.appleCount - 1);
        this.dragState = {
          kind: 'prop',
          prop: apple,
          fromBasket: true,
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false
        };
        return;
      }

      if (kind === 'basket_yuzu') {
        if (this.basket.yuzuCount <= 0) return;
        this.audio.playBasketTouch();
        const origin = this.basket.getWorldAnchorFor('yuzu');
        const yuzu = this.basket.spawnYuzu(origin.x, origin.y + 0.06, origin.z, { inWater: false });
        yuzu.dragging = true;
        this.yuzus.push(yuzu);
        // Keep max 12 floating yuzu so bath stays cheerful & responsive
        if (this.yuzus.length > 12) {
          const oldest = this.yuzus.shift();
          oldest.destroy();
        }
        this.dragState = {
          kind: 'prop',
          prop: yuzu,
          fromBasket: true,
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false
        };
        return;
      }

      if (kind === 'basket_cabbage') {
        this.audio.playBasketTouch();
        const origin = this.basket.getWorldAnchorFor('cabbage');
        const leaf = this.basket.spawnCabbage(origin.x, origin.y + 0.06, origin.z);
        leaf.dragging = true;
        this.foods.push(leaf);
        this.basket.cabbageAvailable = false;
        this.dragState = {
          kind: 'prop',
          prop: leaf,
          fromBasket: true,
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false
        };
        return;
      }

      if (kind === 'basket') {
        this.audio.playBasketTouch();
        if (this.platformUnlocked || this.camLowBlend > 0.35) {
          // Slide basket smoothly between front flat stone and raised stone platform!
          this.basket.moveToPlatform(!this.basket.onPlatform);
        } else {
          // Friendly fallback for a 5-year-old tapping the basket edge: place an apple slice directly on the stone rim!
          const origin = this.basket.getWorldAnchorFor('apple');
          const apple = this.basket.spawnApple(origin.x, origin.y + 0.05, origin.z);
          this.foods.push(apple);
          this._autoPlaceApple(apple);
        }
        return;
      }

      // Picking up an already placed prop (floating yuzu, rim apple, cabbage)
      if (picked.userData.prop && picked.userData.prop.alive) {
        const prop = picked.userData.prop;
        prop.dragging = true;
        prop.arcAnim = null;
        if (prop.kind === 'yuzu' && prop.inWater) {
          this.env.addRipple(prop.pos.x, prop.pos.z, 0.35);
          this.audio.playWaterRipple(0.32, 1.35);
        }
        this.dragState = {
          kind: 'prop',
          prop,
          fromBasket: false,
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false
        };
      }
    }

    _onPointerMove(e) {
      if (!this.dragState) return;
      e.preventDefault();
      this.idleSeconds = 0;

      const distPx = Math.hypot(e.clientX - this.dragState.startClientX, e.clientY - this.dragState.startClientY);
      if (distPx > 14) {
        this.dragState.moved = true;
      }

      if (this.dragState.kind === 'trough') {
        // Dragging downward/rightward tilts the bamboo trough further!
        const dy = (e.clientY - this.dragState.startClientY) / 90;
        const tilt = Math.max(0.35, Math.min(1.0, 0.7 + dy));
        this.env.setTroughManualTilt(tilt);
        return;
      }

      if (this.dragState.kind === 'prop' && this.dragState.prop && this.dragState.prop.alive) {
        this._setPointerFromEvent(e);
        const p = this.dragState.prop;
        const hit = this._raycastPlaneY(0.28);
        if (hit) {
          // Clamp comfortably within the bath & stone rim area
          p.pos.x = Math.max(-1.45, Math.min(1.45, hit.x));
          p.pos.z = Math.max(-1.05, Math.min(1.58, hit.z));
          const surfY = this.env.getSurfaceHeightAt(p.pos.x, p.pos.z);
          p.pos.y = surfY + 0.16;
          p.group.position.copy(p.pos);
        }
      }
    }

    _onPointerUp(e) {
      if (!this.dragState) return;
      e.preventDefault();
      const ds = this.dragState;
      this.dragState = null;

      if (ds.kind === 'trough') {
        this.env.triggerTroughPour(2.4);
        return;
      }

      if (ds.kind === 'prop' && ds.prop && ds.prop.alive) {
        const p = ds.prop;
        p.dragging = false;

        if (!ds.moved && ds.fromBasket) {
          // Single tap on a basket item -> immediate, joyful, visible placement!
          if (p.kind === 'apple') {
            this._autoPlaceApple(p);
          } else if (p.kind === 'yuzu') {
            this._autoDropYuzu(p);
          } else if (p.kind === 'cabbage') {
            this._autoPlaceCabbage(p);
          }
        } else {
          // Dragged & dropped freely by the child
          p.settleAtCurrentPos(this.audio);
          if (p.kind === 'yuzu' && p.inWater) {
            this.yuzusDropped++;
            this._notifyWaterSound(p.pos.x, p.pos.z);
          } else if (p.kind === 'apple') {
            this.applesFed++;
            if (p.inWater) this._notifyWaterSound(p.pos.x, p.pos.z);
          } else if (p.kind === 'cabbage') {
            this.cabbagePlaced++;
          }
        }
      }
    }

    _autoPlaceApple(apple) {
      // Cycle naturally across stone rim spots (and raised platform when unlocked!)
      const spots = this.platformUnlocked
        ? [
            { x: -0.24, y: this.env.frontEdgeY + 0.024, z: 1.24 },
            { x: 0.86,  y: this.env.platformCenter.y + 0.024, z: 0.24 },
            { x: -0.68, y: this.env.frontEdgeY + 0.024, z: 1.18 },
            { x: 0.10,  y: this.env.frontEdgeY + 0.024, z: 1.26 }
          ]
        : [
            { x: -0.18, y: this.env.frontEdgeY + 0.024, z: 1.24 },
            { x: -0.56, y: this.env.frontEdgeY + 0.024, z: 1.20 },
            { x: 0.14,  y: this.env.frontEdgeY + 0.024, z: 1.26 }
          ];
      const sp = spots[this.appleSpotIndex % spots.length];
      this.appleSpotIndex++;
      apple.launchArcTo(sp.x, sp.y, sp.z, 0.42);
      this.applesFed++;
    }

    _autoDropYuzu(yuzu) {
      // Gently arc into a nice open spot near the capybaras in the hot spring
      const angle = (this.yuzusDropped * 1.35) + 0.4;
      const rad = 0.42 + (this.yuzusDropped % 3) * 0.20;
      const tx = Math.max(-0.95, Math.min(0.85, Math.cos(angle) * rad));
      const tz = Math.max(-0.65, Math.min(0.75, Math.sin(angle) * rad + 0.18));
      yuzu.launchArcTo(tx, this.env.waterY + 0.02, tz, 0.48);
      this.yuzusDropped++;
      setTimeout(() => this._notifyWaterSound(tx, tz), 460);
    }

    _autoPlaceCabbage(leaf) {
      if (this.platformUnlocked && (this.baby.onPlatform || this.basket.onPlatform || this.cabbagePlaced >= 1)) {
        leaf.launchArcTo(this.env.platformCenter.x - 0.14, this.env.platformCenter.y + 0.016, this.env.platformCenter.z + 0.02, 0.48);
      } else {
        leaf.launchArcTo(-0.08, this.env.frontEdgeY + 0.016, 1.22, 0.46);
      }
      this.cabbagePlaced++;
    }

    _notifyWaterSound(x, z) {
      for (let i = 0; i < this.capybaras.length; i++) {
        this.capybaras[i].onWaterSound(x, z);
      }
    }

    _wakeFromFinale() {
      this.finaleActive = false;
      this.elapsedPlayTime = 160; // keep all discoveries unlocked while returning to warm sunset glow
      const bPos = this.basket.pos;
      this.baby.wakeUp(bPos.x, bPos.z);
      setTimeout(() => this.adult.wakeUp(bPos.x, bPos.z), 900);
      setTimeout(() => {
        if (this.friend.visible) this.friend.wakeUp(bPos.x, bPos.z);
      }, 1700);
      this.basket.replenishSoftly();
    }

    _updateDiscoveryProgression(dt) {
      this.elapsedPlayTime += dt;

      // Discovery #2: Cabbage Leaf appears in basket around 2-3 min (or earlier once child tries apples + yuzu!)
      if (!this.basket.cabbageUnlocked) {
        const activeEarly = this.applesFed >= 2 && this.yuzusDropped >= 1 && this.elapsedPlayTime >= 42;
        const timedUnlock = this.elapsedPlayTime >= 115;
        if (activeEarly || timedUnlock) {
          this.basket.unlockCabbage();
        }
      }

      // Discovery #4: 3rd Capybara walks calmly in from winter grass meadow after several feedings
      if (!this.friendArrived) {
        const fedEnough = (this.applesFed + this.cabbagePlaced) >= 3 && this.elapsedPlayTime >= 62;
        const timedFriend = this.elapsedPlayTime >= 150;
        if (fedEnough || timedFriend) {
          this.friendArrived = true;
          this.friend.beginMeadowArrival(-0.68, -0.24);
        }
      }

      // Discovery #5: Raised stone platform + camera smoothly descends to water/platform level (~3-4 min)
      if (!this.platformUnlocked) {
        const activeUnlock = this.friendArrived && this.cabbagePlaced >= 1 && this.elapsedPlayTime >= 95;
        const timedPlatform = this.elapsedPlayTime >= 185;
        if (activeUnlock || timedPlatform) {
          this.platformUnlocked = true;
          this.camLowTarget = 1.0;
          if (this.baby.inWater && this.baby.state === 'soak') {
            this.baby.goToPlatform();
          }
        }
      }

      // Smoothly transition camera height
      this.camLowBlend += (this.camLowTarget - this.camLowBlend) * Math.min(1, dt * 0.22);

      // Gentle basket replenishment so the child never hits a dead end
      this.replenishTimer += dt;
      if (this.replenishTimer >= 4.0) {
        this.replenishTimer = 0;
        const activeCabbage = this.foods.some((f) => f.alive && f.kind === 'cabbage');
        if (this.basket.appleCount < 2) this.basket.appleCount = 3;
        if (this.basket.cabbageUnlocked && !this.basket.cabbageAvailable && !activeCabbage) {
          this.basket.cabbageAvailable = true;
        }
      }

      // 5–8 minute gentle evening dusk cycle -> pale lavender-purple finale
      const avgFull = (this.adult.fullness + this.baby.fullness + (this.friend.visible ? this.friend.fullness : 0)) / (this.friend.visible ? 3 : 2);
      const timeDusk = Math.max(0, Math.min(1, (this.elapsedPlayTime - 250) / 140));
      const fullDusk = this.platformUnlocked ? Math.max(0, (avgFull - 0.52) / 0.42) : 0;
      const targetDusk = this.finaleActive ? 1.0 : Math.min(1.0, Math.max(timeDusk, fullDusk));
      this.duskFactor += (targetDusk - this.duskFactor) * Math.min(1, dt * 0.25);

      if (!this.finaleActive && this.duskFactor > 0.88 && this.friendArrived) {
        this.finaleActive = true;
        this.capybaras.forEach((c) => {
          if (c.visible) {
            c.state = 'huddle_sleep';
            c.sleeping = true;
          }
        });
      }
    }

    // World-only guidance: highlight ONE next-to-touch object & animate translucent finger demo after 4s idle
    _updateGuidance(dt) {
      if (this.dragState) {
        this.idleSeconds = 0;
        this._hideHandDemo();
        return;
      }

      this.idleSeconds += dt;

      // Choose the single most natural next object to softly glow/bob
      let guideTarget = null;
      if (this.finaleActive) {
        guideTarget = 'basket';
      } else if (this.applesFed === 0) {
        guideTarget = 'apple';
      } else if (this.yuzusDropped === 0) {
        guideTarget = 'yuzu';
      } else if (!this.troughUsed && this.elapsedPlayTime > 26) {
        guideTarget = 'trough';
      } else if (this.basket.cabbageUnlocked && this.cabbagePlaced === 0 && this.basket.cabbageAvailable) {
        guideTarget = 'cabbage';
      } else if (this.platformUnlocked && !this.basket.onPlatform && this.idleSeconds > 4.0) {
        guideTarget = 'basket';
      } else if (this.idleSeconds > 4.0) {
        guideTarget = (this.yuzus.length < 4) ? 'yuzu' : 'apple';
      }

      this.basket.highlightKind = (guideTarget === 'trough') ? null : guideTarget;
      this.env.setTroughHighlight(guideTarget === 'trough' ? 1.0 : 0.0);

      // Show translucent child hand demonstration after ~4 seconds without touch
      if (this.idleSeconds >= 4.0 && guideTarget) {
        this.handDemoPhase = (this.handDemoPhase + dt * 0.48) % 1.0;
        let start3D, end3D;

        if (guideTarget === 'apple') {
          start3D = this.basket.getWorldAnchorFor('apple');
          end3D = new THREE.Vector3(-0.18, this.env.frontEdgeY + 0.04, 1.24);
        } else if (guideTarget === 'yuzu') {
          start3D = this.basket.getWorldAnchorFor('yuzu');
          end3D = new THREE.Vector3(0.08, 0.06, 0.34);
        } else if (guideTarget === 'cabbage') {
          start3D = this.basket.getWorldAnchorFor('cabbage');
          end3D = this.platformUnlocked
            ? new THREE.Vector3(this.env.platformCenter.x - 0.10, this.env.platformCenter.y + 0.04, this.env.platformCenter.z)
            : new THREE.Vector3(-0.08, this.env.frontEdgeY + 0.04, 1.22);
        } else if (guideTarget === 'trough') {
          start3D = this.env.getTroughAnchorWorld();
          end3D = start3D.clone().add(new THREE.Vector3(0.02, -0.16, 0.0));
        } else {
          start3D = this.basket.getWorldAnchorFor('basket');
          end3D = start3D.clone().add(new THREE.Vector3(0, 0.04, 0));
        }

        const pStart = this._projectToScreen(start3D);
        const pEnd = this._projectToScreen(end3D);

        const t = this.handDemoPhase;
        let x, y, alpha, scale;
        if (t < 0.18) {
          // Fade in gently over start target
          const k = t / 0.18;
          x = pStart.x;
          y = pStart.y;
          alpha = k * 0.85;
          scale = 1.04 - k * 0.08;
        } else if (t < 0.72) {
          // Smooth arc glide to destination
          const k = (t - 0.18) / 0.54;
          const ease = k * k * (3 - 2 * k);
          x = pStart.x + (pEnd.x - pStart.x) * ease;
          y = pStart.y + (pEnd.y - pStart.y) * ease - Math.sin(ease * Math.PI) * 26;
          alpha = 0.85;
          scale = 0.96;
        } else {
          // Soft release & fade out
          const k = (t - 0.72) / 0.28;
          x = pEnd.x;
          y = pEnd.y;
          alpha = (1 - k) * 0.85;
          scale = 0.96 + k * 0.08;
        }

        this.handDemoEl.style.opacity = alpha.toFixed(3);
        this.handDemoEl.style.transform = `translate3d(${(x - 28).toFixed(1)}px, ${(y - 8).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      } else {
        this._hideHandDemo();
      }
    }

    _hideHandDemo() {
      this.handDemoPhase = 0;
      this.handDemoEl.style.opacity = '0';
    }

    _projectToScreen(v3) {
      const p = v3.clone().project(this.camera);
      return {
        x: (p.x * 0.5 + 0.5) * this.width,
        y: (-p.y * 0.5 + 0.5) * this.height
      };
    }

    _saveState() {
      try {
        const data = {
          version: 1,
          elapsedPlayTime: this.elapsedPlayTime,
          applesFed: this.applesFed,
          yuzusDropped: this.yuzusDropped,
          troughUsed: this.troughUsed,
          cabbagePlaced: this.cabbagePlaced,
          friendArrived: this.friendArrived,
          platformUnlocked: this.platformUnlocked,
          finaleActive: this.finaleActive,
          duskFactor: this.duskFactor,
          camLowBlend: this.camLowBlend,
          camLowTarget: this.camLowTarget,
          warmth: this.env.warmth,
          waterDepthBonus: this.env.waterDepthBonus,
          troughTilt: this.env.troughTilt,
          basket: {
            onPlatform: this.basket.onPlatform,
            appleCount: Math.max(1, this.basket.appleCount), // Always leave at least 1 apple to try on return!
            yuzuCount: Math.max(1, this.basket.yuzuCount),
            cabbageUnlocked: this.basket.cabbageUnlocked,
            cabbageAvailable: this.basket.cabbageAvailable
          },
          capybaras: this.capybaras.map((c) => c.serialize()),
          yuzus: this.yuzus.filter((y) => y.alive).map((y) => y.serialize()),
          apples: this.foods.filter((f) => f.alive && f.kind === 'apple' && !f.sunk).map((f) => f.serialize()),
          cabbages: this.foods.filter((f) => f.alive && f.kind === 'cabbage').map((f) => f.serialize())
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // Ignore storage quota / privacy errors
      }
    }

    _restoreState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || data.version !== 1) return;

        this.elapsedPlayTime = Math.min(260, data.elapsedPlayTime || 0);
        this.applesFed = data.applesFed || 0;
        this.yuzusDropped = data.yuzusDropped || 0;
        this.troughUsed = !!data.troughUsed;
        this.cabbagePlaced = data.cabbagePlaced || 0;
        this.friendArrived = !!data.friendArrived;
        this.platformUnlocked = !!data.platformUnlocked;
        this.finaleActive = false;
        this.duskFactor = Math.min(0.45, data.duskFactor || 0);
        this.camLowTarget = data.camLowTarget || 0;
        this.camLowBlend = data.camLowBlend || 0;

        if (typeof data.warmth === 'number') this.env.warmth = data.warmth;
        if (typeof data.waterDepthBonus === 'number') this.env.waterDepthBonus = data.waterDepthBonus;
        if (typeof data.troughTilt === 'number') this.env.troughTilt = data.troughTilt;

        if (data.basket) {
          this.basket.appleCount = Math.max(1, data.basket.appleCount || 2);
          this.basket.yuzuCount = Math.max(1, data.basket.yuzuCount || 2);
          if (data.basket.cabbageUnlocked) this.basket.unlockCabbage();
          this.basket.cabbageAvailable = !!data.basket.cabbageAvailable;
          this.basket.moveToPlatform(!!data.basket.onPlatform);
          this.basket.pos.copy(this.basket.targetPos);
        }

        if (Array.isArray(data.capybaras)) {
          data.capybaras.forEach((cd) => {
            const target = this.capybaras.find((c) => c.id === cd.id);
            if (target) {
              // Ensure adult & baby always appear clearly in the bath on return
              if (target.id === 'adult' || target.id === 'baby') {
                cd.visible = true;
              }
              target.restore(cd);
            }
          });
        }

        if (Array.isArray(data.yuzus)) {
          data.yuzus.slice(0, 12).forEach((yd) => {
            const yz = this.basket.spawnYuzu(yd.x, yd.y, yd.z, { inWater: yd.inWater, id: yd.id });
            this.yuzus.push(yz);
          });
        }

        if (Array.isArray(data.apples)) {
          data.apples.slice(0, 6).forEach((ad) => {
            const ap = this.basket.spawnApple(ad.x, ad.y, ad.z, {
              bitesTaken: ad.bitesTaken,
              rotY: ad.rotY,
              id: ad.id
            });
            ap.onPlatform = !!ad.onPlatform;
            ap.inWater = !!ad.inWater;
            this.foods.push(ap);
          });
        }

        if (Array.isArray(data.cabbages)) {
          data.cabbages.slice(0, 2).forEach((cd) => {
            const cb = this.basket.spawnCabbage(cd.x, cd.y, cd.z, {
              onPlatform: cd.onPlatform,
              leftBites: cd.leftBites,
              rightBites: cd.rightBites,
              rotY: cd.rotY,
              id: cd.id
            });
            this.foods.push(cb);
          });
        }
      } catch (e) {
        // Start fresh cleanly if saved state invalid
      }
    }

    _loop(now) {
      requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      this._updateDiscoveryProgression(dt);
      this.env.update(dt, this.duskFactor, this.audio);
      this.basket.update(dt);
      this.crumbs.update(dt);

      // Update foods & yuzus
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const f = this.foods[i];
        if (!f.alive) {
          this.foods.splice(i, 1);
          continue;
        }
        if (f.kind === 'apple') f.update(dt, this.audio);
        else f.update(dt, this.env.time, this.audio);
      }
      for (let i = this.yuzus.length - 1; i >= 0; i--) {
        const y = this.yuzus[i];
        if (!y.alive) {
          this.yuzus.splice(i, 1);
          continue;
        }
        y.update(dt, this.env.time, this.yuzus, this.audio);
      }

      // Update all capybaras with continuous physical context
      const capyCtx = {
        foods: this.foods,
        yuzus: this.yuzus,
        capybaras: this.capybaras,
        phaseInfo: {
          platformUnlocked: this.platformUnlocked,
          finaleActive: this.finaleActive
        },
        onBite: (capy, food) => {
          const snout = capy.getSnoutWorldPos();
          this.crumbs.burst(snout.x, snout.y - 0.02, snout.z, food.kind === 'cabbage');
        },
        onNoseBump: (c1, c2) => {
          const midX = (c1.pos.x + c2.pos.x) * 0.5;
          const midZ = (c1.pos.z + c2.pos.z) * 0.5;
          this.env.addRipple(midX, midZ, 0.35);
        }
      };
      for (let i = 0; i < this.capybaras.length; i++) {
        this.capybaras[i].update(dt, capyCtx);
      }

      this._updateCamera(Math.min(1, dt * 3.0));
      this._updateGuidance(dt);

      // Periodic auto-save
      this.saveTimer += dt;
      if (this.saveTimer >= 6.0) {
        this.saveTimer = 0;
        this._saveState();
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window._pokapokaGame = new PokapokaGame();
  });
})();
