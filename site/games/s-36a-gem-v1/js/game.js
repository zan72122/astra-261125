(function () {
  'use strict';

  const STORAGE_KEY = 'risu_no_donguri_v1';

  class RisuNoDonguriGame {
    constructor() {
      this.canvas = document.getElementById('stage');
      this.hintCanvas = document.getElementById('hint-canvas');
      this.hintCtx = this.hintCanvas.getContext('2d');

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 45);

      this.audio = new window.ForestAudio();
      this.world = new window.ForestWorld(this.scene);

      // Game entities & state
      this.foods = [];
      this.caches = [];
      this.shards = [];
      this.preferredSpots = [];

      // Pouch supply (always keeps treats ready for the next morning!)
      this.pouchStock = { acorn: 12, seed: 24, walnut: 6 };
      this.nextPouchCycleIdx = 0;

      // Progression & timing
      this.elapsed = 0;
      this.idleSeconds = 0;
      this.totalInteractions = 0;
      this.seedsStuffedTotal = 0;
      this.walnutsCrackedTotal = 0;
      this.walnutUnlocked = false;
      this.chipmunk2Spawned = false;
      this.rootViewUnlocked = false;
      this.restingMode = false;
      this.cycleProgress = 0; // 0..1 across 5-8 min play session

      // Camera director state ('stump' | 'roots' | 'rest')
      this.cameraMode = 'stump';
      this.camPos = new THREE.Vector3(0.06, 1.72, 2.86);
      this.camLook = new THREE.Vector3(0.0, 0.42, 0.08);
      this.camFov = 42;
      this.rootViewHoldTimer = 0;

      // Pointer / single-finger drag state
      this.raycaster = new THREE.Raycaster();
      this.pointerNdc = new THREE.Vector2();
      this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.world.STUMP_TOP_Y);
      this.activePointerId = null;
      this.pointerDownPos = { x: 0, y: 0 };
      this.pointerLastPos = { x: 0, y: 0 };
      this.pointerVelWorld = new THREE.Vector3();
      this.draggedFood = null;
      this.draggingPlate = false;
      this.downTarget = null;
      this.hasDragged = false;
      this.pouchOpenedOnDown = false;

      // Diegetic single-object highlight & translucent finger hint state
      this.hintAlpha = 0;
      this.hintPhase = 0;
      this.highlightPulseObj = null;

      // Build the two chipmunks (strictly max 2!)
      this.chipmunk1 = new window.Chipmunk(this.scene, this.world, this.audio, {
        id: 0,
        scale: 1.22,
        visible: true,
        startPos: new THREE.Vector3(-0.04, this.world.STUMP_TOP_Y, 0.04),
        heading: 0.46,
      });

      this.chipmunk2 = new window.Chipmunk(this.scene, this.world, this.audio, {
        id: 1,
        scale: 1.02,
        visible: false,
        startPos: this.world.CHIPMUNK2_PEEK_POS.clone(),
        heading: 0.95,
      });
      this.chipmunks = [this.chipmunk1, this.chipmunk2];

      // Restore saved morning state OR seed fresh initial opening layout
      const restored = this._loadState();
      if (!restored) {
        this._setupInitialObjects();
      }

      // Apply immediate responsive camera framing BEFORE first frame render!
      this._resize();
      this._snapCameraToTarget();

      // Input & lifecycle listeners
      this._bindEvents();

      // Render frame 1 immediately so opening frame always shows chipmunk prominently on mossy stump!
      this.lastTime = performance.now();
      this.world.update(0.016, 0, this.cycleProgress);
      this.chipmunk1._updateVisualRig(0.016, 0, false);
      if (this.chipmunk2.visible) this.chipmunk2._updateVisualRig(0.016, 0, false);
      this.renderer.render(this.scene, this.camera);

      // Periodic autosave
      this.saveTimer = 0;
      requestAnimationFrame((t) => this._loop(t));
    }

    _setupInitialObjects() {
      // Place 2 glossy acorns and 3 striped sunflower seeds on the wooden plate so the very first tap/drag works immediately
      const p = this.world.PLATE_POS;
      this._spawnFood('acorn', new THREE.Vector3(p.x - 0.06, p.y + 0.055, p.z + 0.03));
      this._spawnFood('acorn', new THREE.Vector3(p.x + 0.07, p.y + 0.055, p.z - 0.02));
      this._spawnFood('seed', new THREE.Vector3(p.x + 0.01, p.y + 0.042, p.z + 0.08));
      this._spawnFood('seed', new THREE.Vector3(p.x - 0.02, p.y + 0.042, p.z - 0.07));
      this._spawnFood('seed', new THREE.Vector3(p.x + 0.08, p.y + 0.042, p.z + 0.06));
      this.world.setPouchOpen(false);
    }

    _spawnFood(kind, pos, vel = null) {
      const mesh = this.world.createFoodMesh(kind);
      mesh.position.copy(pos);
      mesh.rotation.set(
        kind === 'acorn' ? 1.15 : 0.1,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4
      );
      this.scene.add(mesh);

      const item = {
        id: Math.random().toString(36).slice(2),
        kind,
        mesh,
        pos: pos.clone(),
        vel: vel ? vel.clone() : new THREE.Vector3(),
        onGround: !vel,
        consumed: false,
        heldBy: null,
        beingDragged: false,
        wedgedInCrack: false,
        rollSoundCooldown: 0,
      };
      mesh.userData.foodItem = item;
      mesh.traverse((child) => {
        child.userData.foodItem = item;
      });
      this.foods.push(item);
      return item;
    }

    _removeFood(item) {
      item.consumed = true;
      if (item.mesh && item.mesh.parent) {
        item.mesh.parent.remove(item.mesh);
      }
      const idx = this.foods.indexOf(item);
      if (idx >= 0) this.foods.splice(idx, 1);
    }

    _spawnWalnutShard(origin) {
      if (this.shards.length > 26) {
        const old = this.shards.shift();
        if (old && old.mesh.parent) old.mesh.parent.remove(old.mesh);
      }
      const mesh = this.world.createWalnutShardMesh();
      const ang = Math.random() * Math.PI * 2;
      const dist = 0.08 + Math.random() * 0.16;
      let sx = origin.x + Math.cos(ang) * dist;
      let sz = origin.z + Math.sin(ang) * dist;
      // Keep shards resting visibly on the stump top when cracked on stump
      if (this.world.isOnStump(origin.x, origin.z)) {
        const r = Math.hypot(sx, sz);
        if (r > this.world.STUMP_RADIUS - 0.08) {
          sx *= (this.world.STUMP_RADIUS - 0.08) / r;
          sz *= (this.world.STUMP_RADIUS - 0.08) / r;
        }
      }
      const sy = this.world.getSurfaceHeight(sx, sz) + 0.008;
      mesh.position.set(sx, sy, sz);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
      this.scene.add(mesh);
      this.shards.push({ mesh, pos: new THREE.Vector3(sx, sy, sz) });
    }

    _createCacheAt(pos, items, alreadyUncovered = false) {
      // Clamp cache spot cleanly outside stump cylinder
      const r = Math.hypot(pos.x, pos.z);
      const p = pos.clone();
      if (r < this.world.STUMP_RADIUS + 0.18) {
        const ang = Math.atan2(p.z, p.x);
        p.x = Math.cos(ang) * (this.world.STUMP_RADIUS + 0.24);
        p.z = Math.sin(ang) * (this.world.STUMP_RADIUS + 0.24);
      }
      p.y = this.world.getGroundHeight(p.x, p.z);

      // Merge if very close to an existing hidden mound
      for (const c of this.caches) {
        if (!c.uncovered && c.pos.distanceTo(p) < 0.28) {
          c.items.push(...items);
          c.mound.group.scale.setScalar(Math.min(1.28, 1.0 + c.items.length * 0.05));
          return c;
        }
      }

      const mound = this.world.createCacheMoundMesh(p, items.length);
      const cache = {
        id: Math.random().toString(36).slice(2),
        pos: p,
        items: items.length ? items.slice() : ['seed', 'seed'],
        mound,
        uncovered: alreadyUncovered,
        scatterAnim: alreadyUncovered ? 1 : 0,
      };
      mound.hit.userData.cacheObj = cache;
      mound.group.traverse((ch) => {
        if (ch.userData.interactive === 'cache-mound') ch.userData.cacheObj = cache;
      });
      if (alreadyUncovered) {
        this._applyCacheLeafScatter(cache, 1);
      }
      this.caches.push(cache);
      return cache;
    }

    _applyCacheLeafScatter(cache, t) {
      for (const leaf of cache.mound.coverLeaves) {
        const bp = leaf.userData.basePos;
        const dir = leaf.userData.scatterDir;
        leaf.position.set(
          bp.x + dir.x * 0.15 * t,
          bp.y - 0.025 * t,
          bp.z + dir.z * 0.15 * t
        );
        leaf.rotation.z = t * 0.45;
      }
    }

    _uncoverCache(cache) {
      if (!cache || cache.uncovered) return;
      cache.uncovered = true;
      this.audio.playLeafRustle(0.24, 1.15);

      // Reveal the hidden seeds/acorns right on top of the brushed-open mound!
      const count = Math.min(4, Math.max(2, cache.items.length));
      let firstFood = null;
      for (let i = 0; i < count; i++) {
        const kind = cache.items[i] || 'seed';
        const ang = (i / count) * Math.PI * 2 + 0.4;
        const fPos = new THREE.Vector3(
          cache.pos.x + Math.cos(ang) * 0.055,
          cache.pos.y + 0.06,
          cache.pos.z + Math.sin(ang) * 0.055
        );
        const f = this._spawnFood(kind, fPos, new THREE.Vector3(Math.cos(ang) * 0.16, 0.14, Math.sin(ang) * 0.16));
        if (!firstFood) firstFood = f;
      }
      cache.items = [];

      // Chipmunk notices uncovered stash right away and hurries to re-hide it elsewhere!
      if (firstFood) {
        this.chipmunk1.reactToSound(cache.pos, firstFood);
      }
    }

    _takeFromCache(cache) {
      const recovered = cache.items.slice();
      cache.items = [];
      cache.uncovered = true;
      if (cache.mound && cache.mound.group.parent) {
        cache.mound.group.parent.remove(cache.mound.group);
      }
      const idx = this.caches.indexOf(cache);
      if (idx >= 0) this.caches.splice(idx, 1);
      return recovered;
    }

    // --- RESPONSIVE CAMERA FRAMING (iPhone 390x844 portrait & iPad 1180x820 landscape!) ---
    _getCameraTargetPreset() {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      const isPortrait = aspect < 0.85;
      const portraitT = isPortrait ? THREE.MathUtils.clamp((0.85 - aspect) / 0.42, 0, 1) : 0;

      if (this.cameraMode === 'roots') {
        // Ground-hugging chipmunk eye-level view showing leaf veins, acorn caps, damp moss, root hollows, AND cloth pouch!
        const pos = new THREE.Vector3(
          THREE.MathUtils.lerp(1.48, 1.56, portraitT),
          THREE.MathUtils.lerp(0.36, 0.42, portraitT),
          THREE.MathUtils.lerp(2.04, 2.38, portraitT)
        );
        const look = new THREE.Vector3(
          THREE.MathUtils.lerp(0.18, 0.22, portraitT),
          THREE.MathUtils.lerp(0.24, 0.24, portraitT),
          THREE.MathUtils.lerp(-0.14, -0.10, portraitT)
        );
        const fov = THREE.MathUtils.lerp(40, 54, portraitT);
        return { pos, look, fov };
      }

      if (this.cameraMode === 'rest') {
        // Gentle golden-hour serene framing of both chipmunks sitting side-by-side on the stump + leaf mounds + pouch
        const pos = new THREE.Vector3(
          0.08,
          THREE.MathUtils.lerp(1.42, 1.82, portraitT),
          THREE.MathUtils.lerp(2.68, 3.58, portraitT)
        );
        const look = new THREE.Vector3(0.0, 0.48, 0.08);
        const fov = THREE.MathUtils.lerp(38, 52, portraitT);
        return { pos, look, fov };
      }

      // Default 'stump' elevated three-quarter morning view:
      // Chipmunk prominently centered, full body visible, wooden plate + cloth pouch + stump + autumn leaves all framed cleanly!
      const pos = new THREE.Vector3(
        0.04,
        THREE.MathUtils.lerp(1.44, 1.92, portraitT),
        THREE.MathUtils.lerp(2.42, 3.46, portraitT)
      );
      const look = new THREE.Vector3(
        0.0,
        THREE.MathUtils.lerp(0.46, 0.44, portraitT),
        THREE.MathUtils.lerp(0.14, 0.18, portraitT)
      );
      const fov = THREE.MathUtils.lerp(38, 54, portraitT);
      return { pos, look, fov };
    }

    _snapCameraToTarget() {
      const preset = this._getCameraTargetPreset();
      this.camPos.copy(preset.pos);
      this.camLook.copy(preset.look);
      this.camFov = preset.fov;
      this.camera.fov = this.camFov;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.updateProjectionMatrix();
    }

    _resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.hintCanvas.width = Math.floor(w * dpr);
      this.hintCanvas.height = Math.floor(h * dpr);
      this.hintCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // --- SINGLE-FINGER TAP & DRAG INTERACTION ---
    _bindEvents() {
      window.addEventListener('resize', () => this._resize());
      window.addEventListener('pagehide', () => this._saveState());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this._saveState();
      });

      this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
      window.addEventListener('pointermove', (e) => this._onPointerMove(e));
      window.addEventListener('pointerup', (e) => this._onPointerUp(e));
      window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    }

    _updatePointerNdc(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    _raycastInteractive() {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);

      // 1. Loose food items (highest priority so child can grab acorns/seeds/walnuts effortlessly!)
      const foodMeshes = this.foods
        .filter((f) => !f.consumed && !f.heldBy)
        .map((f) => f.mesh);
      const foodHits = this.raycaster.intersectObjects(foodMeshes, true);
      if (foodHits.length > 0) {
        const item = foodHits[0].object.userData.foodItem;
        if (item) return { type: 'food', item, point: foodHits[0].point };
      }

      // 2. Cloth pouch & visible items peeking inside pouch
      const pouchHits = this.raycaster.intersectObject(this.world.pouchGroup, true);
      if (pouchHits.length > 0) {
        let obj = pouchHits[0].object;
        let kindTag = null;
        while (obj && obj !== this.world.pouchGroup) {
          if (obj.userData.interactive) {
            kindTag = obj.userData.interactive;
            break;
          }
          obj = obj.parent;
        }
        return { type: 'pouch', sub: kindTag || 'pouch', point: pouchHits[0].point };
      }

      // 3. Raised leaf cache mounds (brush aside to uncover hidden seeds!)
      const moundHits = this.raycaster.intersectObjects(
        this.caches.filter((c) => !c.uncovered).map((c) => c.mound.group),
        true
      );
      if (moundHits.length > 0) {
        let obj = moundHits[0].object;
        let cacheObj = obj.userData.cacheObj;
        while (!cacheObj && obj) {
          obj = obj.parent;
          if (obj && obj.userData && obj.userData.cacheObj) cacheObj = obj.userData.cacheObj;
        }
        if (!cacheObj) {
          cacheObj = this.caches.find((c) => !c.uncovered && c.mound.group.getObjectById(moundHits[0].object.id));
        }
        if (cacheObj) return { type: 'cache', cache: cacheObj, point: moundHits[0].point };
      }

      // 4. Wooden plate
      const plateHits = this.raycaster.intersectObject(this.world.plateGroup, true);
      if (plateHits.length > 0) {
        return { type: 'plate', point: plateHits[0].point };
      }

      // 5. Chipmunks themselves (gentle curious reaction)
      const chipMeshes = this.chipmunks.filter((c) => c.visible).map((c) => c.root);
      const chipHits = this.raycaster.intersectObjects(chipMeshes, true);
      if (chipHits.length > 0) {
        const isSecond = this.chipmunk2.visible && this.chipmunk2.root.getObjectById(chipHits[0].object.id);
        return { type: 'chipmunk', chipmunk: isSecond ? this.chipmunk2 : this.chipmunk1, point: chipHits[0].point };
      }

      return null;
    }

    _projectPointerToWorld(elevOffset = 0.08) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      // Raycast stump top + ground so dragging seamlessly glides over BOTH stump and forest floor!
      const surfaces = [this.world.stumpTopMesh, this.world.groundMesh];
      const hits = this.raycaster.intersectObjects(surfaces, false);
      if (hits.length > 0) {
        const pt = hits[0].point.clone();
        // Keep within playable forest clearing
        pt.x = THREE.MathUtils.clamp(pt.x, -1.35, 1.35);
        pt.z = THREE.MathUtils.clamp(pt.z, -1.15, 1.38);
        pt.y = this.world.getSurfaceHeight(pt.x, pt.z) + elevOffset;
        return pt;
      }
      const fallback = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, fallback);
      fallback.x = THREE.MathUtils.clamp(fallback.x, -1.35, 1.35);
      fallback.z = THREE.MathUtils.clamp(fallback.z, -1.15, 1.38);
      fallback.y = this.world.getSurfaceHeight(fallback.x, fallback.z) + elevOffset;
      return fallback;
    }

    _pickNextKindFromPouch(subTag) {
      if (subTag === 'pouch-walnut' && this.walnutUnlocked) return 'walnut';
      if (subTag === 'pouch-seed') return 'seed';
      if (subTag === 'pouch-acorn') return 'acorn';

      // Thoughtful discovery rhythm when tapping/dragging general pouch:
      // First acorn -> then clusters of sunflower seeds (to discover cheek pouches!) -> then walnut once unlocked!
      const pattern = this.walnutUnlocked
        ? ['walnut', 'seed', 'seed', 'acorn', 'seed', 'seed', 'walnut', 'acorn']
        : ['seed', 'seed', 'seed', 'acorn', 'seed', 'seed', 'acorn', 'seed'];
      const kind = pattern[this.nextPouchCycleIdx % pattern.length];
      this.nextPouchCycleIdx++;
      return kind;
    }

    _onPointerDown(e) {
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.audio.unlock();
      this.idleSeconds = 0;

      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerLastPos = { x: e.clientX, y: e.clientY };
      this.pointerVelWorld.set(0, 0, 0);
      this.hasDragged = false;
      this.pouchOpenedOnDown = false;

      this._updatePointerNdc(e.clientX, e.clientY);
      const hit = this._raycastInteractive();
      this.downTarget = hit;
      if (!hit) return; // Empty sky/forest background does not react!

      // If in resting cycle end and child touches pouch/food/plate -> wake chipmunk & resume play!
      if (this.restingMode && (hit.type === 'pouch' || hit.type === 'food' || hit.type === 'plate')) {
        this._resumeFromRest();
      }

      if (hit.type === 'food') {
        const f = hit.item;
        f.beingDragged = true;
        f.wedgedInCrack = false;
        f.vel.set(0, 0, 0);
        this.draggedFood = f;
        this.audio.playNutDrop(f.kind, 0.35);
      } else if (hit.type === 'pouch') {
        if (!this.world.pouchOpen) {
          // First tap on closed pouch immediately opens mouth with rustle + wakes/alerts chipmunk!
          this.world.setPouchOpen(true);
          this.pouchOpenedOnDown = true;
          this.audio.playPouchRustle(true);
          this.chipmunk1.reactToSound(this.world.POUCH_POS);
          this.totalInteractions++;
        } else if (hit.sub === 'pouch-mouth') {
          // Will close if tapped without dragging, or pull out item if dragged!
        } else {
          // Pulling directly out of open pouch spawns a tactile nut/seed right under the finger!
          const kind = this._pickNextKindFromPouch(hit.sub);
          const spawnPos = this.world.POUCH_POS.clone().add(new THREE.Vector3(0, 0.30, 0));
          const f = this._spawnFood(kind, spawnPos);
          f.beingDragged = true;
          this.draggedFood = f;
          this.audio.playPouchRustle(true);
          this.totalInteractions++;
        }
      } else if (hit.type === 'cache') {
        this._uncoverCache(hit.cache);
        this.totalInteractions++;
      } else if (hit.type === 'plate') {
        this.draggingPlate = true;
      } else if (hit.type === 'chipmunk') {
        hit.chipmunk.reactToSound(hit.point);
        this.audio.playChirp(hit.chipmunk.id === 0 ? 1.0 : 1.18);
      }
    }

    _onPointerMove(e) {
      if (e.pointerId !== this.activePointerId) return;
      this.idleSeconds = 0;

      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) {
        this.hasDragged = true;
      }

      this._updatePointerNdc(e.clientX, e.clientY);

      // If started on open pouch mouth and began dragging -> pull out a treat!
      if (!this.draggedFood && this.downTarget && this.downTarget.type === 'pouch' && this.hasDragged) {
        if (!this.world.pouchOpen) {
          this.world.setPouchOpen(true);
          this.audio.playPouchRustle(true);
        }
        const kind = this._pickNextKindFromPouch(this.downTarget.sub);
        const spawnPos = this.world.POUCH_POS.clone().add(new THREE.Vector3(0, 0.30, 0));
        const f = this._spawnFood(kind, spawnPos);
        f.beingDragged = true;
        this.draggedFood = f;
        this.totalInteractions++;
      }

      if (this.draggedFood) {
        const worldPt = this._projectPointerToWorld(0.11);
        const prev = this.draggedFood.pos.clone();
        this.draggedFood.pos.lerp(worldPt, 0.65);
        this.draggedFood.mesh.position.copy(this.draggedFood.pos);
        // Track gentle toss/flick velocity
        const stepVel = this.draggedFood.pos.clone().sub(prev).multiplyScalar(14);
        this.pointerVelWorld.lerp(stepVel, 0.45);
      } else if (this.draggingPlate && this.hasDragged) {
        const moveDx = e.clientX - this.pointerLastPos.x;
        this.world.setPlateAngle(this.world.plateAngle + moveDx * 0.014);
      } else if (this.hasDragged) {
        // Gentle swipe across a raised leaf cache mound also brushes leaves open!
        const hit = this._raycastInteractive();
        if (hit && hit.type === 'cache') {
          this._uncoverCache(hit.cache);
          this.totalInteractions++;
        }
      }

      this.pointerLastPos = { x: e.clientX, y: e.clientY };
    }

    _onPointerUp(e) {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;

      if (this.draggedFood) {
        const f = this.draggedFood;
        f.beingDragged = false;
        this.draggedFood = null;

        // If tapped (not dragged!) on an item sitting on the plate or pouch -> gracefully toss it onto the mossy stump!
        if (!this.hasDragged) {
          let targetPos;
          if (this.cameraMode === 'roots') {
            // In low root view, tapping places treat near the root hollow or stump rim
            targetPos = new THREE.Vector3(
              0.42 + (Math.random() - 0.5) * 0.36,
              this.world.getGroundHeight(0.42, -0.15) + 0.16,
              -0.15 + (Math.random() - 0.5) * 0.28
            );
          } else {
            // Place cleanly onto the mossy stump top so it rolls with a crisp "koron"!
            targetPos = new THREE.Vector3(
              (Math.random() - 0.5) * 0.46,
              this.world.STUMP_TOP_Y + 0.14,
              0.08 + Math.random() * 0.34
            );
          }
          f.pos.copy(targetPos);
          f.mesh.position.copy(targetPos);
          f.vel.set((Math.random() - 0.5) * 0.42, -0.2, -0.35 - Math.random() * 0.25);
          f.onGround = false;
        } else {
          // Check if child placed a walnut right into the stump's walnut crack!
          if (f.kind === 'walnut' && f.pos.distanceTo(this.world.CRACK_POS) < 0.24) {
            f.wedgedInCrack = true;
            f.pos.copy(this.world.CRACK_POS).add(new THREE.Vector3(0, 0.042, 0));
            f.mesh.position.copy(f.pos);
            f.mesh.rotation.set(0.12, -0.56, 0.08);
            f.vel.set(0, 0, 0);
            f.onGround = true;
            this.audio.playNutDrop('walnut', 0.95);
            this._notifyChipmunksOfFood(f);
            this._recordPreferredSpot(f.pos);
            this.totalInteractions++;
            return;
          }

          // Release with natural capped toss velocity
          const speed = Math.hypot(this.pointerVelWorld.x, this.pointerVelWorld.z);
          const cap = f.kind === 'seed' ? 0.55 : 1.55;
          const scale = speed > cap ? cap / speed : 1.0;
          f.vel.set(
            this.pointerVelWorld.x * scale,
            0.05,
            this.pointerVelWorld.z * scale
          );
          // Seeds slide just a little from drop position
          if (f.kind === 'seed' && speed < 0.12) {
            f.vel.x += (Math.random() - 0.5) * 0.18;
            f.vel.z += (Math.random() - 0.5) * 0.18;
          }
          f.onGround = false;
        }

        this.totalInteractions++;
        this._recordPreferredSpot(f.pos);
      } else if (this.downTarget && this.downTarget.type === 'pouch' && !this.hasDragged && !this.pouchOpenedOnDown) {
        if (this.downTarget.sub === 'pouch-mouth' && this.world.pouchOpen) {
          // Finger can close the cloth pouch mouth too!
          this.world.setPouchOpen(false);
          this.audio.playPouchRustle(false);
        }
      } else if (this.draggingPlate) {
        this.draggingPlate = false;
        if (!this.hasDragged) {
          this.world.setPlateAngle(this.world.plateAngle + 0.35);
          this.audio.playWoodSlide();
          this.chipmunk1.reactToSound(this.world.PLATE_POS);
        }
      }

      this.downTarget = null;
      this.draggingPlate = false;
    }

    _recordPreferredSpot(pos) {
      if (!this.world.isOnStump(pos.x, pos.z, 0.08)) return;
      this.preferredSpots.push(new THREE.Vector3(pos.x, this.world.STUMP_TOP_Y, pos.z));
      if (this.preferredSpots.length > 8) this.preferredSpots.shift();
    }

    _getPreferredWaitSpot() {
      if (this.preferredSpots.length < 2) return null;
      const avg = new THREE.Vector3();
      for (const s of this.preferredSpots) avg.add(s);
      avg.multiplyScalar(1 / this.preferredSpots.length);
      return avg;
    }

    _notifyChipmunksOfFood(food) {
      for (const c of this.chipmunks) {
        if (c.visible) {
          c.reactToSound(food.pos, food);
        }
      }
    }

    _resumeFromRest() {
      this.restingMode = false;
      this.cycleProgress = 0.25;
      this.cameraMode = 'stump';
      this.chipmunk1.wakeUp();
      if (this.chipmunk2.visible) {
        setTimeout(() => {
          if (!this.restingMode) this.chipmunk2.wakeUp();
        }, 700);
      }
    }

    // --- PHYSICS UPDATE FOR ROLLING ACORNS, SLIDING SEEDS, WALNUTS ---
    _updateFoodPhysics(dt) {
      const gravity = 4.2;

      for (const f of this.foods) {
        if (f.consumed || f.heldBy || f.beingDragged || f.wedgedInCrack) continue;

        f.rollSoundCooldown = Math.max(0, f.rollSoundCooldown - dt);
        const radius = f.kind === 'walnut' ? 0.056 : f.kind === 'acorn' ? 0.036 : 0.016;
        const onStump = this.world.isOnStump(f.pos.x, f.pos.z, -0.02);
        const surfY = this.world.getSurfaceHeight(f.pos.x, f.pos.z) + radius;

        if (!f.onGround || f.pos.y > surfY + 0.005 || Math.hypot(f.vel.x, f.vel.z) > 0.015) {
          // Gravity when airborne or tumbling off stump edge
          if (f.pos.y > surfY + 0.004) {
            f.vel.y -= gravity * dt;
          }

          f.pos.addScaledVector(f.vel, dt);

          const nowOnStump = this.world.isOnStump(f.pos.x, f.pos.z, -0.02);
          const nowSurfY = this.world.getSurfaceHeight(f.pos.x, f.pos.z) + radius;

          // Landing impact!
          if (f.pos.y <= nowSurfY) {
            const impactSpeed = Math.abs(f.vel.y);
            f.pos.y = nowSurfY;
            if (impactSpeed > 0.35) {
              // Crisp dry wooden "koron" bounce on stump, soft leaf rustle on ground!
              if (nowOnStump) {
                this.audio.playNutDrop(f.kind, Math.min(1, impactSpeed * 0.65));
              } else {
                this.audio.playLeafRustle(0.14, 0.75);
              }
              f.vel.y = impactSpeed * (f.kind === 'seed' ? 0.12 : 0.28);
              this._notifyChipmunksOfFood(f);
            } else {
              f.vel.y = 0;
              f.onGround = true;
            }

            // Natural rolling / sliding friction
            const speed = Math.hypot(f.vel.x, f.vel.z);
            if (speed > 0.01) {
              // Shallow cracks on the stump naturally catch & slow rolling acorns!
              const nearCrack = nowOnStump && f.pos.distanceTo(this.world.CRACK_POS) < 0.14;
              const damp = nowOnStump
                ? (f.kind === 'seed' ? 4.8 : nearCrack ? 6.5 : 2.1)
                : 5.5;
              const factor = Math.max(0, 1 - damp * dt);
              f.vel.x *= factor;
              f.vel.z *= factor;

              // Visual rolling spin proportional to travel
              f.mesh.rotation.x += (f.vel.z * dt) / Math.max(0.02, radius);
              f.mesh.rotation.z -= (f.vel.x * dt) / Math.max(0.02, radius);

              if (nowOnStump && speed > 0.22 && f.rollSoundCooldown <= 0) {
                this.audio.playNutRollTick(f.kind, speed);
                f.rollSoundCooldown = 0.14;
              }
            } else {
              f.vel.x = 0;
              f.vel.z = 0;
            }
          }

          // Keep food inside playable clearing
          f.pos.x = THREE.MathUtils.clamp(f.pos.x, -1.45, 1.45);
          f.pos.z = THREE.MathUtils.clamp(f.pos.z, -1.2, 1.45);

          // If dropped directly onto stump without strong velocity, still notify chipmunks once settled
          if (f.onGround && !f.notifiedOnce) {
            f.notifiedOnce = true;
            if (nowOnStump || this.world.isOnPlate(f.pos.x, f.pos.z) === false) {
              this.audio.playNutDrop(f.kind, 0.72);
              this._notifyChipmunksOfFood(f);
            }
          }

          f.mesh.position.copy(f.pos);
        }
      }
    }

    // --- PROGRESSION DIRECTOR (All 6 Discoveries + 5-8 Min Arc) ---
    _updateProgression(dt) {
      if (!this.restingMode) {
        this.elapsed += dt;
        this.cycleProgress = Math.min(1, this.elapsed / 380);
      }

      // Discovery 3 (~2 min): Rugged walnuts appear peeking out inside the cloth pouch!
      if (!this.walnutUnlocked && (this.elapsed >= 95 || this.totalInteractions >= 6 || this.caches.length >= 1)) {
        this.walnutUnlocked = true;
        this.world.setWalnutUnlocked(true);
      }

      // Discovery 4 (~2.5-3 min): Slightly smaller second chipmunk peeks out from behind the left tree trunk!
      if (!this.chipmunk2Spawned && (this.elapsed >= 135 || this.totalInteractions >= 9)) {
        this.chipmunk2Spawned = true;
        this.chipmunk2.visible = true;
        this.chipmunk2.root.visible = true;
        this.chipmunk2.pos.copy(this.world.CHIPMUNK2_PEEK_POS);
        this.chipmunk2.state = 'PEEK_SHY';
        this.chipmunk2.stateTimer = 0;
        this.audio.playChirp(1.22);
      }

      // Camera mode gentle return from root view if user places several items back on stump after exploring roots
      if (this.cameraMode === 'roots') {
        this.rootViewHoldTimer += dt;
      }

      // 5-8 min serene ending: both chipmunks sit side by side on the stump with tails wrapped over their backs!
      if (
        !this.restingMode &&
        this.chipmunk2Spawned &&
        this.elapsed >= 320 &&
        this.idleSeconds >= 7.5 &&
        !this.draggedFood &&
        this.foods.filter((f) => !f.consumed && !f.heldBy && this.world.isOnStump(f.pos.x, f.pos.z)).length === 0
      ) {
        this.restingMode = true;
        this.cameraMode = 'rest';
        this.chipmunk1.setRestTogether(new THREE.Vector3(-0.14, this.world.STUMP_TOP_Y, 0.04), 0.22);
        this.chipmunk2.shyness = 0;
        this.chipmunk2.setRestTogether(new THREE.Vector3(0.16, this.world.STUMP_TOP_Y, 0.08), -0.18);
      }
    }

    // --- DIEGETIC SINGLE-OBJECT GUIDANCE + 4-SECOND TRANSLUCENT FINGER DEMO ---
    _getNextGuideTarget() {
      // Determine ONE meaningful next affordance in the world (never multiple at once!)
      if (this.restingMode) {
        return {
          worldObj: this.world.pouchGroup,
          from: this.world.POUCH_POS.clone().add(new THREE.Vector3(0, 0.24, 0)),
          to: null, // gentle tap
        };
      }

      // If dragging a walnut, softly highlight the stump crack!
      if (this.draggedFood && this.draggedFood.kind === 'walnut') {
        return {
          worldObj: this.world.crackGroup,
          from: null,
          to: null,
        };
      }

      // First move: if acorns are sitting on the plate and nothing is on the stump yet -> guide dragging an acorn onto stump!
      const plateAcorn = this.foods.find(
        (f) => !f.consumed && !f.heldBy && !f.beingDragged && this.world.isOnPlate(f.pos.x, f.pos.z)
      );
      if (this.totalInteractions === 0 && plateAcorn) {
        return {
          worldObj: plateAcorn.mesh,
          from: plateAcorn.pos.clone(),
          to: new THREE.Vector3(0.08, this.world.STUMP_TOP_Y + 0.05, 0.24),
        };
      }

      // In low root view with an intact leaf mound -> guide brushing the leaf mound!
      if (this.cameraMode === 'roots') {
        const covered = this.caches.find((c) => !c.uncovered);
        if (covered) {
          return {
            worldObj: covered.mound.group,
            from: covered.pos.clone().add(new THREE.Vector3(-0.08, 0.06, 0)),
            to: covered.pos.clone().add(new THREE.Vector3(0.10, 0.06, 0.04)),
          };
        }
      }

      // If walnut is on stump and not wedged -> guide sliding it into the stump crack!
      const looseWalnut = this.foods.find(
        (f) => !f.consumed && !f.heldBy && !f.wedgedInCrack && f.kind === 'walnut'
      );
      if (looseWalnut) {
        return {
          worldObj: looseWalnut.mesh,
          from: looseWalnut.pos.clone(),
          to: this.world.CRACK_POS.clone().add(new THREE.Vector3(0, 0.05, 0)),
        };
      }

      // If Chipmunk 2 is still shy peeking behind the tree -> guide placing a seed near Chipmunk 2!
      if (this.chipmunk2.visible && this.chipmunk2.shyness > 0.35 && this.world.pouchOpen) {
        return {
          worldObj: this.world.pouchGroup,
          from: this.world.POUCH_POS.clone().add(new THREE.Vector3(0, 0.24, 0)),
          to: this.chipmunk2.pos.clone().add(new THREE.Vector3(0.32, 0.06, 0.28)),
        };
      }

      // If cloth pouch is closed -> gently highlight pouch to open it!
      if (!this.world.pouchOpen) {
        return {
          worldObj: this.world.pouchGroup,
          from: this.world.POUCH_POS.clone().add(new THREE.Vector3(0, 0.24, 0)),
          to: null,
        };
      }

      // Otherwise guide dragging a seed/walnut from the open cloth pouch onto the stump!
      return {
        worldObj: this.world.pouchGroup,
        from: this.world.POUCH_POS.clone().add(new THREE.Vector3(0, 0.25, 0)),
        to: new THREE.Vector3(0.14, this.world.STUMP_TOP_Y + 0.05, 0.22),
      };
    }

    _worldToScreen(v) {
      const p = v.clone().project(this.camera);
      return {
        x: (p.x * 0.5 + 0.5) * window.innerWidth,
        y: (-p.y * 0.5 + 0.5) * window.innerHeight,
        inFront: p.z < 1.0,
      };
    }

    _updateDiegeticGuidance(dt, elapsed) {
      const guide = this._getNextGuideTarget();

      // Subtle single-object diegetic pulse (gentle warm scale bounce on ONLY the one next object)
      if (this.highlightPulseObj && this.highlightPulseObj !== guide.worldObj) {
        this.highlightPulseObj.scale.setScalar(1.0);
      }
      this.highlightPulseObj = guide.worldObj || null;
      if (this.highlightPulseObj && (this.idleSeconds > 1.2 || (this.draggedFood && this.draggedFood.kind === 'walnut'))) {
        const pulse = 1.0 + Math.sin(elapsed * 4.2) * 0.045;
        this.highlightPulseObj.scale.setScalar(pulse);
      } else if (this.highlightPulseObj) {
        this.highlightPulseObj.scale.setScalar(1.0);
      }

      // After ~4 seconds of inactivity, show a gentle translucent finger demonstrating the next gesture
      const shouldShowFinger = this.idleSeconds >= 4.0 && !this.draggedFood && guide.from;
      const targetAlpha = shouldShowFinger ? 1.0 : 0.0;
      this.hintAlpha += (targetAlpha - this.hintAlpha) * Math.min(1, dt * 4.0);

      const ctx = this.hintCtx;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (this.hintAlpha < 0.02 || !guide.from) return;

      this.hintPhase = (this.hintPhase + dt * 0.55) % 1.0;
      const p0 = this._worldToScreen(guide.from);
      if (!p0.inFront) return;

      let fx = p0.x;
      let fy = p0.y;
      let pressScale = 1.0;
      let ripple = 0;

      if (guide.to) {
        const p1 = this._worldToScreen(guide.to);
        if (!p1.inFront) return;
        // Smooth ease-in-out drag arc: pause -> press -> glide -> release
        if (this.hintPhase < 0.16) {
          pressScale = 1.0 - (this.hintPhase / 0.16) * 0.12;
          ripple = this.hintPhase / 0.16;
        } else if (this.hintPhase < 0.78) {
          const u = (this.hintPhase - 0.16) / 0.62;
          const ease = u * u * (3 - 2 * u);
          fx = p0.x + (p1.x - p0.x) * ease;
          fy = p0.y + (p1.y - p0.y) * ease - Math.sin(u * Math.PI) * 28;
          pressScale = 0.88;
        } else {
          fx = p1.x;
          fy = p1.y;
          pressScale = 0.88 + ((this.hintPhase - 0.78) / 0.22) * 0.14;
        }
      } else {
        // Gentle tap motion
        const tapCycle = Math.sin(this.hintPhase * Math.PI * 2);
        fy = p0.y - Math.max(0, tapCycle) * 14;
        pressScale = tapCycle < 0 ? 0.88 : 1.0;
        ripple = tapCycle < 0 ? Math.abs(tapCycle) : 0;
      }

      const fadeEdge = Math.sin(Math.min(1, Math.max(0, this.hintPhase)) * Math.PI);
      const a = this.hintAlpha * (0.25 + 0.75 * fadeEdge);

      ctx.save();
      ctx.globalAlpha = a * 0.62;

      // Soft warm translucent touch glow ring under fingertip (zero arrows, zero icons, zero text!)
      if (ripple > 0.05) {
        ctx.strokeStyle = 'rgba(255, 246, 214, 0.72)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fx, fy, 12 + ripple * 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Soft translucent rounded child's fingertip silhouette
      ctx.translate(fx, fy);
      ctx.rotate(-0.34);
      ctx.scale(pressScale, pressScale);

      const fg = ctx.createRadialGradient(0, 6, 3, 0, 14, 34);
      fg.addColorStop(0, 'rgba(255, 248, 232, 0.82)');
      fg.addColorStop(0.65, 'rgba(248, 224, 192, 0.56)');
      fg.addColorStop(1, 'rgba(244, 216, 180, 0.0)');
      ctx.fillStyle = fg;

      const drawCapsule = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      drawCapsule(-14, -10, 28, 52, 14);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 252, 240, 0.55)';
      ctx.lineWidth = 1.6;
      drawCapsule(-11, -7, 22, 42, 11);
      ctx.stroke();

      // Subtle fingertip nail sheen
      ctx.fillStyle = 'rgba(255, 255, 250, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, -1, 6.5, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // --- PERSISTENT STATE (localStorage) ---
    _saveState() {
      try {
        const data = {
          version: 1,
          elapsed: Math.min(280, this.elapsed),
          totalInteractions: this.totalInteractions,
          walnutUnlocked: this.walnutUnlocked,
          chipmunk2Spawned: this.chipmunk2Spawned,
          rootViewUnlocked: this.rootViewUnlocked,
          pouchOpen: this.world.pouchOpen,
          plateAngle: this.world.plateAngle,
          chipmunks: this.chipmunks.map((c) => ({
            visible: c.visible,
            pos: [c.pos.x, c.pos.y, c.pos.z],
            heading: c.heading,
            cheekCount: c.cheekCount,
            cheekItems: c.cheekItems,
            shyness: c.shyness,
            trustFeeds: c.trustFeeds,
          })),
          caches: this.caches.map((c) => ({
            pos: [c.pos.x, c.pos.y, c.pos.z],
            items: c.items,
            uncovered: c.uncovered,
          })),
          shards: this.shards.slice(-18).map((s) => [s.pos.x, s.pos.y, s.pos.z]),
          foods: this.foods
            .filter((f) => !f.consumed && !f.heldBy)
            .slice(-12)
            .map((f) => ({
              kind: f.kind,
              pos: [f.pos.x, f.pos.y, f.pos.z],
              wedgedInCrack: f.wedgedInCrack,
            })),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_e) {
        // Ignore storage quota / private mode issues silently
      }
    }

    _loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || data.version !== 1) return false;

        this.elapsed = Number(data.elapsed) || 0;
        this.totalInteractions = Number(data.totalInteractions) || 0;
        this.walnutUnlocked = !!data.walnutUnlocked;
        this.chipmunk2Spawned = !!data.chipmunk2Spawned;
        this.rootViewUnlocked = !!data.rootViewUnlocked;
        this.world.setWalnutUnlocked(this.walnutUnlocked);
        this.world.setPouchOpen(!!data.pouchOpen);
        if (typeof data.plateAngle === 'number') {
          this.world.setPlateAngle(data.plateAngle);
        }

        if (Array.isArray(data.chipmunks)) {
          data.chipmunks.forEach((sc, idx) => {
            const c = this.chipmunks[idx];
            if (!c || !sc) return;
            c.visible = idx === 0 ? true : !!sc.visible;
            c.root.visible = c.visible;
            if (Array.isArray(sc.pos) && sc.pos.length === 3) {
              c.pos.set(sc.pos[0], sc.pos[1], sc.pos[2]);
            }
            // Guarantee Chipmunk 1 is always clearly visible on the stump on opening frame!
            if (idx === 0 && !this.world.isOnStump(c.pos.x, c.pos.z)) {
              c.pos.set(-0.05, this.world.STUMP_TOP_Y, 0.04);
            }
            c.heading = typeof sc.heading === 'number' ? sc.heading : c.heading;
            c.targetHeading = c.heading;
            c.cheekCount = Math.min(6, Math.max(0, Number(sc.cheekCount) || 0));
            c.cheekDisplay = c.cheekCount;
            c.cheekItems = Array.isArray(sc.cheekItems) ? sc.cheekItems.slice(0, 6) : [];
            c.shyness = typeof sc.shyness === 'number' ? sc.shyness : c.shyness;
            c.trustFeeds = Number(sc.trustFeeds) || 0;
            c.state = idx === 1 && c.shyness > 0.3 ? 'PEEK_SHY' : 'IDLE_SIT';
          });
        }

        if (Array.isArray(data.caches)) {
          for (const sc of data.caches) {
            if (Array.isArray(sc.pos) && sc.pos.length === 3) {
              this._createCacheAt(new THREE.Vector3(sc.pos[0], sc.pos[1], sc.pos[2]), sc.items || ['seed'], !!sc.uncovered);
            }
          }
        }

        if (Array.isArray(data.shards)) {
          for (const sp of data.shards) {
            if (Array.isArray(sp) && sp.length === 3) {
              const mesh = this.world.createWalnutShardMesh();
              mesh.position.set(sp[0], sp[1], sp[2]);
              mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
              this.scene.add(mesh);
              this.shards.push({ mesh, pos: new THREE.Vector3(sp[0], sp[1], sp[2]) });
            }
          }
        }

        if (Array.isArray(data.foods) && data.foods.length > 0) {
          for (const sf of data.foods) {
            if (Array.isArray(sf.pos) && sf.pos.length === 3) {
              const item = this._spawnFood(sf.kind || 'acorn', new THREE.Vector3(sf.pos[0], sf.pos[1], sf.pos[2]));
              item.wedgedInCrack = !!sf.wedgedInCrack;
              item.notifiedOnce = true;
            }
          }
        } else {
          // Ensure fresh nuts/seeds are waiting on the plate when returning the next morning
          const p = this.world.PLATE_POS;
          this._spawnFood('acorn', new THREE.Vector3(p.x - 0.05, p.y + 0.055, p.z + 0.02));
          this._spawnFood('seed', new THREE.Vector3(p.x + 0.05, p.y + 0.042, p.z + 0.05));
        }

        return true;
      } catch (_e) {
        return false;
      }
    }

    // --- MAIN ANIMATION LOOP ---
    _loop(now) {
      requestAnimationFrame((t) => this._loop(t));
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (!this.draggedFood) {
        this.idleSeconds += dt;
      }

      this._updateProgression(dt);
      this._updateFoodPhysics(dt);

      // Update cache mound leaf-brush animations
      for (const c of this.caches) {
        if (c.uncovered && c.scatterAnim < 1) {
          c.scatterAnim = Math.min(1, c.scatterAnim + dt * 4.5);
          this._applyCacheLeafScatter(c, c.scatterAnim);
        }
      }

      // Context callbacks shared with chipmunks
      const chipCtx = {
        foods: this.foods,
        caches: this.caches,
        preferredSpot: this._getPreferredWaitSpot(),
        getPartner: (self) => (self.id === 0 ? this.chipmunk2 : this.chipmunk1),
        canPlayWithPartner: (self) => {
          const p = self.id === 0 ? this.chipmunk2 : this.chipmunk1;
          return p.visible && p.shyness < 0.3 && (p.state === 'IDLE_SIT' || p.state === 'STAND_ALERT');
        },
        consumeFood: (f) => this._removeFood(f),
        spawnWalnutShard: (origin) => this._spawnWalnutShard(origin),
        pickCacheSpot: (_chip, avoidPos = null) => {
          const candidates = this.world.ROOT_HOLLOWS.filter((pt) => !avoidPos || pt.distanceTo(avoidPos) > 0.5);
          // Favor the hero back-right root hollow early so low camera shows it prominently!
          if (this.caches.length === 0) return this.world.ROOT_HOLLOWS[0].clone();
          const chosen = candidates[Math.floor(Math.random() * candidates.length)] || this.world.ROOT_HOLLOWS[0];
          return chosen.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.14, 0, (Math.random() - 0.5) * 0.14));
        },
        onStartCaching: (chip, spot) => {
          // Discovery 5 (~3-4 min): when a chipmunk runs with puffed cheeks toward the tree roots, smoothly glide camera to ground eye-level!
          if (!this.rootViewUnlocked && (this.elapsed >= 165 || this.caches.length >= 1) && chip.cheekCount >= 2 && spot.z < 0.05) {
            this.rootViewUnlocked = true;
            this.cameraMode = 'roots';
            this.rootViewHoldTimer = 0;
          }
        },
        createCacheAt: (pos, items) => this._createCacheAt(pos, items, false),
        takeFromCache: (cache) => this._takeFromCache(cache),
        onCheekStuffed: () => {
          this.seedsStuffedTotal++;
        },
        onFoodFinished: (_chip, kind) => {
          if (kind === 'walnut') this.walnutsCrackedTotal++;
        },
      };

      for (const c of this.chipmunks) {
        c.update(dt, this.elapsed, chipCtx);
      }

      // Smoothly glide camera between elevated stump view, ground-level root eye-line, and golden rest framing
      const targetCam = this._getCameraTargetPreset();
      const camEase = Math.min(1, dt * 1.45);
      this.camPos.lerp(targetCam.pos, camEase);
      this.camLook.lerp(targetCam.look, camEase);
      this.camFov += (targetCam.fov - this.camFov) * camEase;
      this.camera.fov = this.camFov;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.updateProjectionMatrix();

      // Update world animations (pouch mouth, dappled morning sun, drifting sunlit dust)
      this.world.update(dt, this.elapsed, this.cycleProgress);

      // Update diegetic guidance & 4-second translucent finger demo
      this._updateDiegeticGuidance(dt, this.elapsed);

      // Periodic autosave every 6 seconds
      this.saveTimer += dt;
      if (this.saveTimer >= 6.0) {
        this.saveTimer = 0;
        this._saveState();
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.__game = new RisuNoDonguriGame();
  });
})();
