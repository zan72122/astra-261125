window.RPP = window.RPP || {};

RPP.RedPanda = (function () {
  class RedPanda {
    constructor(id, scene, world, foodMgr, options) {
      this.id = id; // 0 = main panda, 1 = hollow panda
      this.scene = scene;
      this.world = world;
      this.foodMgr = foodMgr;
      this.variant = options && options.variant ? options.variant : 0;

      this.root = new THREE.Group();
      this.scene.add(this.root);

      this.buildModel();

      // Location on branch graph
      this.currentNode = options && options.startNode ? options.startNode : 'midCenter';
      this.pos = this.world.nodes[this.currentNode].clone();
      this.facingYaw = options && options.startYaw != null ? options.startYaw : 0.42;
      this.pitch = 0;

      // Movement along graph path
      this.path = [];
      this.pathIndex = 0;
      this.edgeT = 0;
      this.walkPhase = 0;
      this.stepSoundPhase = 0;

      // State machine
      this.state = options && options.startState ? options.startState : 'idle_sit';
      this.stateTimer = 0;
      this.nextIdleTimer = 3.8 + Math.random() * 3.5;

      // Eating & held food (held food never vanishes on state change!)
      this.targetDishId = null;
      this.targetDishSide = 'right';
      this.activeFood = null;
      this.heldFood = null; // physically held in front paws
      this.sharingFood = false;
      this.biteTimer = 0;
      this.chewAmount = 0;

      // Memory & fullness
      this.fullness = 0; // 0..1
      this.dishAffinity = { low: 0.1, mid: 0.25, high: 0.1 };
      this.lastEatenDish = null;
      this.consecutiveFeeds = 0;

      // Hollow progression (for Panda 2)
      this.hollowStage = this.id === 0 ? 2 : 0; // 0=hidden deep, 1=peeking, 2=active on branches
      this.pawReachProgress = 0;

      // Animation helpers
      this.blinkTimer = 2.2 + Math.random() * 2.5;
      this.blinkClosed = 0;
      this.earTwitchTimer = 2.5 + Math.random() * 3;
      this.earTwitchVal = 0;
      this.breathTimer = 1.2 + Math.random() * 1.8;
      this.breathPuffs = [];
      this.lookTargetWorld = new THREE.Vector3(0, 1.3, 1.2);
      this.lookSmooth = new THREE.Vector3(0, 1.3, 1.2);
      this.curlBlend = 0;
      this.sleepTailCover = 0;
      this.peekFromTail = 0;
      this.sitUpBlend = 0;
      this.startleBlend = 0;
      this.yawnBlend = 0;
      this.washBlend = 0;

      this.syncTransform();
    }

    buildModel() {
      const tex = RPP.Textures.getAll();
      const russetMap = this.variant === 0 ? tex.furRusset : tex.furRusset2;
      const tailMap = this.variant === 0 ? tex.tailRing1 : tex.tailRing2;

      // Soft physical fur materials: sheen catches winter morning white light at fur tips!
      const russetMat = new THREE.MeshPhysicalMaterial({
        map: russetMap,
        bumpMap: tex.furBump,
        bumpScale: 0.014,
        roughness: 0.88,
        metalness: 0.0,
        sheen: 0.78,
        sheenRoughness: 0.62,
        sheenColor: new THREE.Color(0xf4eee6),
      });
      const darkMat = new THREE.MeshPhysicalMaterial({
        map: tex.furDark,
        bumpMap: tex.furBump,
        bumpScale: 0.012,
        roughness: 0.9,
        metalness: 0.0,
        sheen: 0.48,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0xd8cfc8),
      });
      const creamMat = new THREE.MeshPhysicalMaterial({
        map: tex.furCream,
        bumpMap: tex.furBump,
        bumpScale: 0.009,
        roughness: 0.86,
        metalness: 0.0,
        sheen: 0.6,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color(0xffffff),
      });
      const tearMat = new THREE.MeshStandardMaterial({
        color: 0x5c2717,
        roughness: 0.88,
      });
      const tailMat = new THREE.MeshPhysicalMaterial({
        map: tailMap,
        bumpMap: tex.furBump,
        bumpScale: 0.016,
        roughness: 0.9,
        metalness: 0.0,
        sheen: 0.82,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0xf6f0e6),
      });
      const noseMat = new THREE.MeshStandardMaterial({
        color: 0x191312,
        roughness: 0.3,
        metalness: 0.05,
      });
      const eyeMat = new THREE.MeshPhysicalMaterial({
        color: 0x0e0a09,
        roughness: 0.08,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
      const tongueMat = new THREE.MeshStandardMaterial({
        color: 0xd9848a,
        roughness: 0.55,
      });

      this.bodyPivot = new THREE.Group();
      this.root.add(this.bodyPivot);

      // Subtle scale distinction: Panda 2 is ~6% smaller/daintier
      if (this.variant === 1) {
        this.bodyPivot.scale.setScalar(0.94);
      }

      // =======================================================================
      // TORSO (plush arched back + dark chocolate underside)
      // =======================================================================
      this.torso = new THREE.Group();
      this.torso.position.set(0, 0.175, 0);
      this.bodyPivot.add(this.torso);

      // Main russet body core
      const torsoGeo = new THREE.CapsuleGeometry(0.112, 0.24, 10, 18);
      torsoGeo.rotateX(Math.PI / 2);
      const torsoMesh = new THREE.Mesh(torsoGeo, russetMat);
      torsoMesh.scale.set(1.02, 0.94, 1.08);
      torsoMesh.castShadow = true;
      torsoMesh.receiveShadow = true;
      this.torso.add(torsoMesh);

      // Plush rounded shoulder & rump fur volumes
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 12), russetMat);
      shoulder.position.set(0, 0.012, 0.105);
      shoulder.scale.set(0.98, 0.96, 1.0);
      shoulder.castShadow = true;
      this.torso.add(shoulder);

      const rump = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 12), russetMat);
      rump.position.set(0, 0.005, -0.115);
      rump.scale.set(1.04, 0.95, 1.08);
      rump.castShadow = true;
      this.torso.add(rump);

      // Dark espresso chest & belly fur (signature red panda dark underside)
      const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.21, 8, 14), darkMat);
      belly.rotation.x = Math.PI / 2;
      belly.position.set(0, -0.048, 0.01);
      belly.scale.set(0.92, 0.72, 1.05);
      belly.castShadow = true;
      this.torso.add(belly);

      // =======================================================================
      // NECK & HEAD (anatomically realistic small black eyes & white markings)
      // =======================================================================
      this.neck = new THREE.Group();
      this.neck.position.set(0, 0.068, 0.185);
      this.torso.add(this.neck);

      const neckFur = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 10), russetMat);
      neckFur.position.set(0, -0.01, -0.01);
      this.neck.add(neckFur);

      this.head = new THREE.Group();
      this.head.position.set(0, 0.045, 0.055);
      this.neck.add(this.head);

      // Broad rounded skull
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.104, 20, 16), russetMat);
      skull.scale.set(1.08, 0.92, 0.98);
      skull.castShadow = true;
      skull.receiveShadow = true;
      this.head.add(skull);

      // Soft russet forehead bridge
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.084, 14, 12), russetMat);
      crown.position.set(0, 0.028, 0.022);
      crown.scale.set(1.02, 0.78, 0.92);
      this.head.add(crown);

      // Cream-white muzzle (short & softly rounded)
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 12), creamMat);
      muzzle.position.set(0, -0.022, 0.084);
      muzzle.scale.set(1.06, 0.80, 0.96);
      muzzle.castShadow = true;
      this.head.add(muzzle);

      // Small glossy black nose at tip of muzzle
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), noseMat);
      nose.position.set(0, -0.012, 0.133);
      nose.scale.set(1.18, 0.86, 0.85);
      this.head.add(nose);

      // Breath emitter reference point
      this.noseTip = new THREE.Object3D();
      this.noseTip.position.set(0, -0.018, 0.145);
      this.head.add(this.noseTip);

      // Hinged lower jaw + small pink tongue (for yawns & chewing!)
      this.jaw = new THREE.Group();
      this.jaw.position.set(0, -0.042, 0.055);
      this.head.add(this.jaw);

      const chin = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), creamMat);
      chin.position.set(0, -0.008, 0.035);
      chin.scale.set(1.02, 0.62, 1.05);
      this.jaw.add(chin);

      const innerMouth = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c262a, roughness: 0.7 })
      );
      innerMouth.position.set(0, 0.006, 0.036);
      innerMouth.scale.set(0.95, 0.45, 0.95);
      this.jaw.add(innerMouth);

      this.tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.022, 6, 10), tongueMat);
      this.tongue.rotation.x = Math.PI * 0.46;
      this.tongue.position.set(0, 0.006, 0.056);
      this.tongue.scale.set(1.0, 1.0, 0.48);
      this.tongue.visible = false;
      this.jaw.add(this.tongue);

      // Plush cream-white cheeks (animated もぐもぐ when chewing!)
      this.cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), creamMat);
      this.cheekL.position.set(-0.072, -0.028, 0.042);
      this.cheekL.scale.set(0.88, 0.78, 0.95);
      this.head.add(this.cheekL);

      this.cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), creamMat);
      this.cheekR.position.set(0.072, -0.028, 0.042);
      this.cheekR.scale.set(0.88, 0.78, 0.95);
      this.head.add(this.cheekR);

      // Dark russet tear-stripes descending from under each eye (iconic real red panda face!)
      for (const side of [-1, 1]) {
        const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.045, 6, 8), tearMat);
        stripe.position.set(side * 0.044, -0.026, 0.078);
        stripe.rotation.z = side * 0.28;
        stripe.rotation.x = 0.25;
        stripe.scale.set(0.95, 1.0, 0.55);
        this.head.add(stripe);
      }

      // Small cream eyebrow spots (subtle, real red panda markings — NOT human eyebrows!)
      for (const side of [-1, 1]) {
        const browDot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), creamMat);
        browDot.position.set(side * 0.036, 0.042, 0.084);
        browDot.scale.set(1.15, 0.8, 0.55);
        this.head.add(browDot);
      }

      // SMALL, ROUND, REALISTIC BLACK EYES (never oversized, never human expressions!)
      this.eyelids = [];
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 14, 12), eyeMat);
        eye.position.set(side * 0.046, 0.012, 0.091);
        this.head.add(eye);

        // Eyelid cap for natural blinking & peaceful sleeping
        const lid = new THREE.Mesh(
          new THREE.SphereGeometry(0.0158, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
          russetMat
        );
        lid.position.copy(eye.position);
        lid.rotation.x = -Math.PI * 0.52;
        this.head.add(lid);
        this.eyelids.push(lid);
      }

      // Upright rounded triangular ears with soft cream-white furry rim & inner tufts
      this.ears = [];
      for (const side of [-1, 1]) {
        const earPivot = new THREE.Group();
        earPivot.position.set(side * 0.078, 0.072, -0.005);
        earPivot.rotation.set(0.12, side * 0.24, -side * 0.36);

        const outerEar = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.076, 12), russetMat);
        outerEar.position.y = 0.026;
        outerEar.scale.set(0.95, 1.0, 0.52);
        outerEar.castShadow = true;
        earPivot.add(outerEar);

        const rimEar = new THREE.Mesh(new THREE.ConeGeometry(0.040, 0.072, 12), creamMat);
        rimEar.position.set(0, 0.024, 0.008);
        rimEar.scale.set(0.92, 0.96, 0.36);
        earPivot.add(rimEar);

        const darkPatch = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), darkMat);
        darkPatch.position.set(0, 0.012, 0.016);
        darkPatch.scale.set(0.9, 1.1, 0.4);
        earPivot.add(darkPatch);

        this.head.add(earPivot);
        this.ears.push(earPivot);
      }

      // =======================================================================
      // FOUR ARTICULATED DARK FURRY LEGS & PAWS
      // =======================================================================
      const buildLeg = (x, y, z, isFront) => {
        const hip = new THREE.Group();
        hip.position.set(x, y, z);

        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.078, 8, 12), darkMat);
        upper.position.set(0, -0.048, 0);
        upper.castShadow = true;
        hip.add(upper);

        const knee = new THREE.Group();
        knee.position.set(0, -0.095, 0);
        hip.add(knee);

        const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.068, 8, 12), darkMat);
        lower.position.set(0, -0.038, 0.008);
        lower.castShadow = true;
        knee.add(lower);

        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), darkMat);
        paw.position.set(0, -0.075, 0.024);
        paw.scale.set(0.95, 0.62, 1.25);
        paw.castShadow = true;
        knee.add(paw);

        this.torso.add(hip);
        return { hip, knee, paw, isFront };
      };

      this.legs = {
        fl: buildLeg(-0.074, -0.025, 0.135, true),
        fr: buildLeg(0.074, -0.025, 0.135, true),
        bl: buildLeg(-0.078, -0.028, -0.135, false),
        br: buildLeg(0.078, -0.028, -0.135, false),
      };

      // Anchor between front paws where held apples / grapes attach cleanly
      this.pawHoldAnchor = new THREE.Group();
      this.pawHoldAnchor.position.set(0, -0.02, 0.255);
      this.torso.add(this.pawHoldAnchor);

      // =======================================================================
      // 7-SEGMENT LUSH BUSHY RINGED TAIL
      // =======================================================================
      this.tailSegments = [];
      let parentSeg = this.torso;
      const segLengths = [0.082, 0.084, 0.084, 0.082, 0.078, 0.072, 0.066];
      const segRadii = [0.064, 0.076, 0.082, 0.080, 0.074, 0.064, 0.048];
      const totalSegs = segLengths.length;

      for (let i = 0; i < totalSegs; i++) {
        const segPivot = new THREE.Group();
        if (i === 0) {
          segPivot.position.set(0, -0.005, -0.185);
        } else {
          segPivot.position.set(0, 0, -segLengths[i - 1] * 0.88);
        }

        // Custom UV mapping along tail length so our ringed texture bands run clearly along the whole tail!
        const geo = new THREE.CapsuleGeometry(segRadii[i], segLengths[i] * 0.55, 8, 14);
        geo.rotateX(Math.PI / 2);
        const uv = geo.attributes.uv;
        const v0 = i / totalSegs;
        const v1 = (i + 1) / totalSegs;
        for (let k = 0; k < uv.count; k++) {
          const origV = uv.getY(k);
          uv.setY(k, THREE.MathUtils.lerp(v0, v1, origV));
        }
        uv.needsUpdate = true;

        const m = new THREE.Mesh(geo, tailMat);
        m.position.set(0, 0, -segLengths[i] * 0.45);
        m.castShadow = true;
        m.receiveShadow = true;
        segPivot.add(m);

        parentSeg.add(segPivot);
        this.tailSegments.push(segPivot);
        parentSeg = segPivot;
      }

      // Tag panda for subtle tap interaction
      this.root.traverse((ch) => {
        if (ch.isMesh) {
          ch.userData = Object.assign(ch.userData || {}, { interactive: 'panda', pandaId: this.id });
        }
      });
    }

    // Spawn a soft white winter breath puff at the nose
    emitBreath(scaleMul) {
      const tex = RPP.Textures.getAll();
      const mat = new THREE.SpriteMaterial({
        map: tex.softPuff,
        color: 0xf4f9ff,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const wp = new THREE.Vector3();
      this.noseTip.getWorldPosition(wp);
      sp.position.copy(wp);
      const baseSc = (0.065 + Math.random() * 0.025) * (scaleMul || 1);
      sp.scale.setScalar(baseSc);
      this.scene.add(sp);

      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.head.getWorldQuaternion(new THREE.Quaternion()));
      this.breathPuffs.push({
        sprite: sp,
        vel: new THREE.Vector3(fwd.x * 0.09 + (Math.random() - 0.5) * 0.03, 0.095 + Math.random() * 0.04, fwd.z * 0.09),
        life: 1.55,
        maxLife: 1.55,
        baseScale: baseSc,
      });
    }

    syncTransform() {
      this.root.position.copy(this.pos);
      this.root.rotation.set(this.pitch, this.facingYaw, 0, 'YXZ');
    }

    // Start walking smoothly along the branch spline network to targetNode
    walkTo(targetNode, onArrivedState) {
      if (this.currentNode === targetNode && this.state !== 'walk') {
        if (onArrivedState) this.setState(onArrivedState);
        return;
      }
      const allowHollow = this.id === 1;
      const p = this.world.getPath(this.currentNode, targetNode, allowHollow);
      if (p.length <= 1) {
        if (onArrivedState) this.setState(onArrivedState);
        return;
      }
      this.path = p;
      this.pathIndex = 0;
      this.edgeT = 0;
      this.arrivedState = onArrivedState || 'idle_sit';
      this.state = 'walk';
      this.stateTimer = 0;
      RPP.Audio.playBranchCreak();
    }

    setState(st) {
      this.state = st;
      this.stateTimer = 0;
      if (st === 'yawn') {
        RPP.Audio.playYawn();
        this.emitBreath(1.45);
      }
    }

    // Notify panda when food lands on a dish
    noticeSoundAt(worldPos) {
      this.lookTargetWorld.copy(worldPos);
      if (this.state === 'sleep_curled') return;
      if (this.state === 'curled') {
        // Slowly look up first; may get up if food is interesting
        this.nextIdleTimer = Math.min(this.nextIdleTimer, 1.2);
      }
    }

    // Direct gentle poke/tap on panda (subtle realistic reaction)
    onGentleTap() {
      if (this.state === 'sleep_curled') {
        this.peekFromTail = 1.0;
        return;
      }
      if (this.state === 'walk' || this.state.startsWith('eat_') || this.hollowStage < 2) {
        this.earTwitchVal = 1.0;
        return;
      }
      // Occasionally do the cute startle stand-up (威嚇のしぐさ)!
      if (this.state === 'idle_sit' && Math.random() < 0.55) {
        this.setState('startle');
      } else {
        this.earTwitchVal = 1.0;
        this.lookTargetWorld.set(0, 1.4, 2.2);
      }
    }

    // Pick which food item on a dish to eat next
    chooseDishAndEat(otherPanda, preferDishId) {
      if (this.hollowStage < 2) return false;
      if (this.state === 'walk' || this.state.startsWith('eat_') || this.state === 'sleep_curled') return false;
      // If still holding an apple from before, finish eating it first!
      if (this.heldFood && this.heldFood.bitesLeft > 0) {
        this.activeFood = this.heldFood;
        this.biteTimer = 0.8;
        this.setState('eat_apple');
        return true;
      }

      const dishOrder = ['low', 'mid', 'high'];
      let bestDish = null;
      let bestScore = -999;

      for (const dId of dishOrder) {
        const items = this.foodMgr.dishItems[dId];
        if (!items || items.length === 0) continue;

        // Check if other panda is already heading to or eating at this dish
        const otherHere =
          otherPanda &&
          otherPanda.hollowStage === 2 &&
          otherPanda.targetDishId === dId &&
          (otherPanda.state === 'walk' || otherPanda.state.startsWith('eat_'));

        // Check if there's an unheld item OR a shareable apple
        const hasEdible = items.some(
          (it) => !it.heldBy || (it.type === 'apple' && it.bitesLeft >= 2 && !it.sharedWith)
        );
        if (!hasEdible) continue;

        let score = 2.0 + (this.dishAffinity[dId] || 0) * 1.4;
        if (preferDishId === dId) score += 1.5;

        // Distance factor (prefer nearby dishes, but strongly prefer splitting up if two dishes have food!)
        const dist = this.pos.distanceTo(this.world.dishes[dId].pos);
        score -= dist * 0.45;
        if (otherHere) {
          // If another dish also has food, split to different branches!
          const otherDishesHaveFood = dishOrder.some(
            (od) => od !== dId && this.foodMgr.dishItems[od].some((it) => !it.heldBy)
          );
          score += otherDishesHaveFood ? -3.5 : -0.4;
        }

        if (score > bestScore) {
          bestScore = score;
          bestDish = dId;
        }
      }

      if (!bestDish) return false;

      const dish = this.world.dishes[bestDish];
      // Pick left or right perch so two pandas at the same dish sit on opposite sides!
      let side = 'right';
      if (
        otherPanda &&
        otherPanda.hollowStage === 2 &&
        otherPanda.targetDishId === bestDish &&
        (otherPanda.state === 'walk' || otherPanda.state.startsWith('eat_'))
      ) {
        side = otherPanda.targetDishSide === 'right' ? 'left' : 'right';
      } else {
        const dL = this.pos.distanceTo(this.world.nodes[dish.leftNode]);
        const dR = this.pos.distanceTo(this.world.nodes[dish.rightNode]);
        side = dL < dR ? 'left' : 'right';
      }

      this.targetDishId = bestDish;
      this.targetDishSide = side;
      const targetNode = side === 'left' ? dish.leftNode : dish.rightNode;
      this.walkTo(targetNode, 'approach_eat');
      return true;
    }

    beginEatingAtDish(otherPanda) {
      const dId = this.targetDishId;
      if (!dId) {
        this.setState('idle_sit');
        return;
      }
      const items = this.foodMgr.dishItems[dId] || [];
      const dish = this.world.dishes[dId];
      this.lookTargetWorld.copy(dish.pos);

      // Face the dish gently
      this.facingYaw = Math.atan2(dish.pos.x - this.pos.x, dish.pos.z - this.pos.z);

      // Check for unheld food first
      let targetItem = items.find((it) => !it.heldBy);
      let isSharing = false;

      // If no unheld food, check if the other panda is eating an apple at this dish so we can share it from the opposite side!
      if (!targetItem && otherPanda && otherPanda.heldFood && otherPanda.heldFood.type === 'apple' && otherPanda.targetDishId === dId && otherPanda.heldFood.bitesLeft >= 2) {
        targetItem = otherPanda.heldFood;
        isSharing = true;
      }

      if (!targetItem) {
        this.targetDishId = null;
        this.setState('idle_sit');
        return;
      }

      this.activeFood = targetItem;
      this.sharingFood = isSharing;
      this.biteTimer = 0.72;
      this.lastEatenDish = dId;
      this.dishAffinity[dId] = Math.min(2.0, (this.dishAffinity[dId] || 0) + 0.35);

      if (targetItem.type === 'apple') {
        if (!isSharing) {
          targetItem.heldBy = this.id;
          this.heldFood = targetItem;
          // Attach apple into front paws so it stays held even across motions!
          this.pawHoldAnchor.add(targetItem.mesh);
          targetItem.mesh.position.set(0, 0.015, 0.01);
          targetItem.mesh.rotation.set(0.15, 0.4, 0.3);
        } else {
          targetItem.sharedWith = this.id;
        }
        this.setState('eat_apple');
      } else if (targetItem.type === 'bamboo') {
        targetItem.heldBy = this.id;
        this.setState('eat_bamboo');
      } else if (targetItem.type === 'grape') {
        const grapeList = items.filter((it) => it.type === 'grape' && !it.heldBy);
        targetItem.heldBy = this.id;
        this.heldFood = targetItem;
        this.pawHoldAnchor.add(targetItem.mesh);
        targetItem.mesh.position.set(0.025, 0.015, 0.01);

        // If 2+ grapes are on the dish, try to hug them all -> one tumbles off the branch into the snow!
        if (grapeList.length >= 2) {
          const extra = grapeList[1];
          this.foodMgr.removeFoodItem(extra);
          this.greedyDropPending = true;
          this.greedyDropTimer = 0.52;
        } else {
          this.greedyDropPending = false;
        }
        this.setState('eat_grape');
      }
    }

    update(dt, elapsed, otherPanda, finaleMode, onFeedComplete) {
      this.stateTimer += dt;

      // Update floating white breath puffs
      for (let i = this.breathPuffs.length - 1; i >= 0; i--) {
        const bp = this.breathPuffs[i];
        bp.life -= dt;
        if (bp.life <= 0) {
          this.scene.remove(bp.sprite);
          bp.sprite.material.dispose();
          this.breathPuffs.splice(i, 1);
          continue;
        }
        bp.sprite.position.addScaledVector(bp.vel, dt);
        bp.vel.x += Math.sin(elapsed * 2 + i) * 0.01 * dt;
        const t = 1 - bp.life / bp.maxLife;
        bp.sprite.scale.setScalar(bp.baseScale * (1 + t * 2.1));
        bp.sprite.material.opacity = Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * (1 - t) * 0.44;
      }

      // Periodic white breath in winter morning air (visible whenever awake or sleeping!)
      if (this.hollowStage >= 1) {
        this.breathTimer -= dt;
        if (this.breathTimer <= 0) {
          this.breathTimer = this.state === 'sleep_curled' ? 3.8 + Math.random() * 1.4 : 2.6 + Math.random() * 1.6;
          this.emitBreath(this.state === 'sleep_curled' ? 0.85 : 1.0);
        }
      }

      // Natural blinking
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = 2.6 + Math.random() * 3.8;
        this.blinkPhase = 0.18;
      }
      if (this.blinkPhase > 0) {
        this.blinkPhase = Math.max(0, this.blinkPhase - dt);
        this.blinkClosed = Math.sin((this.blinkPhase / 0.18) * Math.PI);
      } else {
        this.blinkClosed = 0;
      }

      // Ear twitch
      this.earTwitchTimer -= dt;
      if (this.earTwitchTimer <= 0) {
        this.earTwitchTimer = 3.0 + Math.random() * 4.5;
        this.earTwitchVal = 0.7;
      }
      this.earTwitchVal = Math.max(0, this.earTwitchVal - dt * 4.5);

      // Decay chew animation
      this.chewAmount = Math.max(0, this.chewAmount - dt * 2.4);

      // =======================================================================
      // HOLLOW STAGE LOGIC (Panda 2)
      // =======================================================================
      if (this.id === 1 && this.hollowStage < 2) {
        const hollowIn = this.world.nodes.hollowIn;
        const hollowRim = this.world.nodes.hollowRim;
        if (this.hollowStage === 0) {
          this.pos.copy(hollowIn).add(new THREE.Vector3(-0.04, -0.02, -0.05));
          this.facingYaw = 0.48;
          this.pitch = 0;
          this.lookTargetWorld.set(-0.28, 1.65, 0.3);
        } else if (this.hollowStage === 1) {
          // Peeking curiously out of the hollow!
          const cleared = this.world.getHollowCleared();
          const peekT = 0.38 + cleared * 0.32;
          this.pos.lerpVectors(hollowIn, hollowRim, peekT);
          this.facingYaw = 0.56;
          this.pitch = 0;
          this.pawReachProgress += ((cleared > 0.32 ? 1 : 0) - this.pawReachProgress) * Math.min(1, dt * 2.5);
          this.lookTargetWorld.copy(this.world.dishes.mid.pos);
        }
        this.syncTransform();
        this.animateRig(dt, elapsed);
        return;
      }

      // =======================================================================
      // MAIN BEHAVIOR STATE MACHINE
      // =======================================================================
      if (this.state === 'walk') {
        this.updateWalk(dt);
      } else if (this.state === 'approach_eat') {
        this.beginEatingAtDish(otherPanda);
      } else if (this.state === 'eat_apple') {
        this.updateEatApple(dt, onFeedComplete);
      } else if (this.state === 'eat_bamboo') {
        this.updateEatBamboo(dt, elapsed, onFeedComplete);
      } else if (this.state === 'eat_grape') {
        this.updateEatGrape(dt, onFeedComplete);
      } else if (this.state === 'yawn') {
        if (this.stateTimer > 2.2) {
          this.setState('idle_sit');
        }
      } else if (this.state === 'wash_face') {
        if (this.stateTimer > 3.2) {
          this.setState('idle_sit');
        }
      } else if (this.state === 'startle') {
        if (this.stateTimer > 2.15) {
          this.setState('idle_sit');
        }
      } else if (this.state === 'sleep_curled') {
        // Cozy finale sleep with bushy tail over face
        this.peekFromTail = Math.max(0, this.peekFromTail - dt * 0.4);
      } else if (this.state === 'curled' || this.state === 'idle_sit') {
        // If finale mode active, head to cozy main branch to curl up together & sleep!
        if (finaleMode) {
          const sleepNode = this.id === 0 ? 'midCenter' : 'midDishR';
          if (this.currentNode !== sleepNode) {
            this.walkTo(sleepNode, 'sleep_curled');
          } else {
            this.facingYaw = this.id === 0 ? 0.35 : -0.35;
            this.setState('sleep_curled');
          }
        } else {
          // Check if any dish has tasty food waiting
          if (this.stateTimer > 0.7 && this.chooseDishAndEat(otherPanda, null)) {
            // Started walking to food!
          } else {
            this.updateIdleBehaviors(dt, otherPanda);
          }
        }
      }

      this.syncTransform();
      this.animateRig(dt, elapsed);
    }

    updateWalk(dt) {
      if (this.pathIndex >= this.path.length - 1) {
        this.currentNode = this.path[this.path.length - 1];
        this.pos.copy(this.world.nodes[this.currentNode]);
        this.pitch = 0;
        const nextSt = this.arrivedState || 'idle_sit';
        if (nextSt === 'sleep_curled') {
          this.facingYaw = this.id === 0 ? 0.35 : -0.35;
        }
        this.setState(nextSt);
        return;
      }

      const from = this.path[this.pathIndex];
      const to = this.path[this.pathIndex + 1];
      const edge = this.world.edgeMap[from + '|' + to];
      if (!edge) {
        this.setState('idle_sit');
        return;
      }

      // Gentle, realistic red panda walking speed (unhurried & careful)
      const speed = 0.44;
      this.edgeT += (speed * dt) / Math.max(0.15, edge.length);

      if (this.edgeT >= 1) {
        this.edgeT = 0;
        this.pathIndex++;
        this.currentNode = to;
        if (this.pathIndex >= this.path.length - 1) {
          this.pos.copy(this.world.nodes[to]);
          this.pitch = 0;
          const nextSt = this.arrivedState || 'idle_sit';
          if (nextSt === 'sleep_curled') {
            this.facingYaw = this.id === 0 ? 0.35 : -0.35;
          }
          this.setState(nextSt);
          return;
        }
      }

      const curFrom = this.path[this.pathIndex];
      const curTo = this.path[this.pathIndex + 1];
      const curEdge = this.world.edgeMap[curFrom + '|' + curTo];
      if (!curEdge) return;

      curEdge.curve.getPointAt(THREE.MathUtils.clamp(this.edgeT, 0, 1), this.pos);
      const tang = curEdge.curve.getTangentAt(THREE.MathUtils.clamp(this.edgeT, 0, 1)).normalize();

      const targetYaw = Math.atan2(tang.x, tang.z);
      const targetPitch = -Math.asin(THREE.MathUtils.clamp(tang.y, -0.65, 0.65)) * 0.72;

      // Shortest angle smooth turn (no unnatural spinning!)
      let diff = targetYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingYaw += diff * Math.min(1, dt * 6.5);
      this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 6.5);

      this.walkPhase += dt * 5.8;
      this.stepSoundPhase += dt * 2.4;
      if (this.stepSoundPhase >= 1) {
        this.stepSoundPhase -= 1;
        RPP.Audio.playFootstep();
      }
      this.lookTargetWorld.copy(this.pos).addScaledVector(tang, 0.8);
    }

    updateEatApple(dt, onFeedComplete) {
      const item = this.activeFood;
      if (!item || item.bitesLeft <= 0) {
        if (this.heldFood === item) this.heldFood = null;
        this.activeFood = null;
        this.sharingFood = false;
        this.targetDishId = null;
        this.setState('idle_sit');
        return;
      }

      const dish = this.targetDishId ? this.world.dishes[this.targetDishId] : null;
      if (dish) {
        const wantYaw = Math.atan2(dish.pos.x - this.pos.x, dish.pos.z - this.pos.z);
        let d = wantYaw - this.facingYaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.facingYaw += d * Math.min(1, dt * 4.5);
      }

      this.biteTimer -= dt;
      if (this.biteTimer <= 0) {
        this.biteTimer = 1.25 + Math.random() * 0.35;
        item.bitesLeft -= 1;
        this.chewAmount = 1.0;
        RPP.Audio.playAppleCrunch(0.95);

        const mouthPos = new THREE.Vector3();
        this.noseTip.getWorldPosition(mouthPos);
        this.foodMgr.spawnAppleCrumbs(mouthPos, 5);
        this.foodMgr.applyFoodVisualProgress(item);

        if (item.bitesLeft <= 0) {
          this.foodMgr.removeFoodItem(item);
          if (this.heldFood === item) this.heldFood = null;
          this.activeFood = null;
          this.sharingFood = false;
          this.fullness = Math.min(1, this.fullness + 0.14);
          if (onFeedComplete) onFeedComplete(this, 'apple', this.targetDishId);
          this.targetDishId = null;
          this.nextIdleTimer = 2.6 + Math.random() * 2.0;
          this.setState('idle_sit');
        }
      }
    }

    updateEatBamboo(dt, elapsed, onFeedComplete) {
      const item = this.activeFood;
      if (!item || item.bitesLeft <= 0 || !item.mesh.parent) {
        this.activeFood = null;
        this.targetDishId = null;
        this.setState('idle_sit');
        return;
      }

      const dish = this.targetDishId ? this.world.dishes[this.targetDishId] : null;
      if (dish) {
        const wantYaw = Math.atan2(dish.pos.x - this.pos.x, dish.pos.z - this.pos.z);
        let d = wantYaw - this.facingYaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.facingYaw += d * Math.min(1, dt * 4.5);

        // Gently bend the bamboo twig toward the red panda's front paw!
        const pullDirX = Math.sign(this.pos.x - dish.pos.x);
        const sway = Math.sin(elapsed * 3.8) * 0.08;
        item.mesh.rotation.z = -pullDirX * 0.36 + sway;
      }

      this.biteTimer -= dt;
      if (this.biteTimer <= 0) {
        this.biteTimer = 1.35 + Math.random() * 0.35;
        item.bitesLeft -= 1;
        this.chewAmount = 0.95;

        // Snow falls off the plucked bamboo leaf (ぱらぱら落ちる)!
        const leaves = item.mesh.userData.leaves || [];
        const pluckedLeaf = leaves[item.bitesLeft];
        const snowPos = new THREE.Vector3();
        if (pluckedLeaf) {
          pluckedLeaf.getWorldPosition(snowPos);
        } else {
          item.mesh.getWorldPosition(snowPos);
          snowPos.y += 0.18;
        }
        RPP.Audio.playBambooPluck();
        this.foodMgr.spawnSnowFlakes(snowPos, 11, 0.11);
        this.foodMgr.applyFoodVisualProgress(item);

        if (item.bitesLeft <= 0) {
          // Leave bare twig briefly or clear cleanly
          this.foodMgr.removeFoodItem(item);
          this.activeFood = null;
          this.fullness = Math.min(1, this.fullness + 0.14);
          if (onFeedComplete) onFeedComplete(this, 'bamboo', this.targetDishId);
          this.targetDishId = null;
          this.nextIdleTimer = 2.8 + Math.random() * 2.0;
          this.setState('idle_sit');
        }
      }
    }

    updateEatGrape(dt, onFeedComplete) {
      const item = this.activeFood;
      if (!item || item.bitesLeft <= 0) {
        if (this.heldFood === item) this.heldFood = null;
        this.activeFood = null;
        this.targetDishId = null;
        this.setState('idle_sit');
        return;
      }

      // If multiple grapes were stacked, drop one clumsily off the branch!
      if (this.greedyDropPending) {
        this.greedyDropTimer -= dt;
        if (this.greedyDropTimer <= 0) {
          this.greedyDropPending = false;
          const pawPos = new THREE.Vector3();
          this.pawHoldAnchor.getWorldPosition(pawPos);
          this.foodMgr.dropGrapeFromBranch(pawPos);
        }
      }

      this.biteTimer -= dt;
      if (this.biteTimer <= 0) {
        this.biteTimer = 1.15;
        item.bitesLeft -= 1;
        this.chewAmount = 0.9;
        RPP.Audio.playGrapeChew();
        this.foodMgr.applyFoodVisualProgress(item);

        if (item.bitesLeft <= 0) {
          this.foodMgr.removeFoodItem(item);
          if (this.heldFood === item) this.heldFood = null;
          this.activeFood = null;
          this.fullness = Math.min(1, this.fullness + 0.08);
          if (onFeedComplete) onFeedComplete(this, 'grape', this.targetDishId);
          this.targetDishId = null;
          this.nextIdleTimer = 2.0 + Math.random() * 1.5;
          this.setState('idle_sit');
        }
      }
    }

    updateIdleBehaviors(dt, otherPanda) {
      // Gently look toward favorite dish or basket
      const favDish = this.getFavoriteDishId();
      if (this.state === 'curled' && favDish) {
        // Even when curled up near its favorite dish, keeps eyes gently watching the dish!
        this.lookTargetWorld.copy(this.world.dishes[favDish].pos);
      } else {
        const lookFocus = this.lastEatenDish
          ? this.world.dishes[this.lastEatenDish].pos
          : this.world.basketWorldPos;
        this.lookTargetWorld.copy(lookFocus);
      }

      // Face gently toward camera-front / favorite dish when sitting (showing full 3/4 face + ringed tail!)
      const desiredYaw =
        this.currentNode === 'midCenter'
          ? -0.52
          : this.currentNode === 'midRight'
            ? -0.68
            : this.currentNode === 'highLeft'
              ? 0.58
              : -0.25;
      let yd = desiredYaw - this.facingYaw;
      while (yd > Math.PI) yd -= Math.PI * 2;
      while (yd < -Math.PI) yd += Math.PI * 2;
      this.facingYaw += yd * Math.min(1, dt * 1.5);

      this.nextIdleTimer -= dt;
      if (this.nextIdleTimer > 0) return;

      // Fullness makes curling up longer and more likely
      const curlChance = 0.25 + this.fullness * 0.42;
      const r = Math.random();

      if (this.state === 'curled') {
        if (Math.random() < 0.55 - this.fullness * 0.25) {
          this.setState('idle_sit');
          this.nextIdleTimer = 3.5 + Math.random() * 3.0;
        } else {
          this.nextIdleTimer = 4.0 + this.fullness * 4.0;
        }
        return;
      }

      if (r < curlChance) {
        this.setState('curled');
        this.nextIdleTimer = 5.0 + this.fullness * 5.5 + Math.random() * 3.0;
      } else if (r < curlChance + 0.20) {
        this.setState('wash_face');
        this.nextIdleTimer = 4.0 + Math.random() * 2.5;
      } else if (r < curlChance + 0.34) {
        this.setState('yawn');
        this.nextIdleTimer = 4.0 + Math.random() * 3.0;
      } else if (r < curlChance + 0.41 && this.fullness < 0.7) {
        this.setState('startle');
        this.nextIdleTimer = 4.5 + Math.random() * 3.0;
      } else {
        // Gentle branch wander (bias toward favorite dish perch or beside other panda!)
        const candidates = ['midCenter', 'midRight', 'midDishR', 'lowDishL', 'highDishL', 'highLeft'];
        let pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (favDish && Math.random() < 0.55) {
          pick = this.world.dishes[favDish].rightNode;
        }
        // If two pandas are both out, occasionally sit side by side on main branch aligning tails!
        if (otherPanda && otherPanda.hollowStage === 2 && Math.random() < 0.35) {
          if (otherPanda.currentNode === 'midCenter') pick = 'midRight';
          else if (otherPanda.currentNode === 'midRight') pick = 'midCenter';
        }
        if (pick !== this.currentNode && (!otherPanda || otherPanda.currentNode !== pick)) {
          this.walkTo(pick, 'idle_sit');
        }
        this.nextIdleTimer = 5.0 + Math.random() * 4.5;
      }
    }

    getFavoriteDishId() {
      let best = 'mid';
      let v = -1;
      for (const k of ['low', 'mid', 'high']) {
        if ((this.dishAffinity[k] || 0) > v) {
          v = this.dishAffinity[k] || 0;
          best = k;
        }
      }
      return best;
    }

    animateRig(dt, elapsed) {
      const k = Math.min(1, dt * 6.5);
      const isCurled = this.state === 'curled' || this.state === 'sleep_curled';
      const isSleeping = this.state === 'sleep_curled';
      const isEatingHold = this.state === 'eat_apple' || this.state === 'eat_grape';
      const isEatingBamboo = this.state === 'eat_bamboo';
      const isStartle = this.state === 'startle';
      const isYawn = this.state === 'yawn';
      const isWash = this.state === 'wash_face';
      const isWalk = this.state === 'walk';

      this.curlBlend += ((isCurled ? 1 : 0) - this.curlBlend) * Math.min(1, dt * 2.8);
      this.sleepTailCover += ((isSleeping ? 1 - this.peekFromTail * 0.65 : 0) - this.sleepTailCover) * Math.min(1, dt * 2.2);
      this.sitUpBlend += ((isEatingHold || isWash ? 1 : isEatingBamboo ? 0.55 : 0) - this.sitUpBlend) * k;
      this.startleBlend += ((isStartle ? 1 : 0) - this.startleBlend) * Math.min(1, dt * 5.2);
      this.yawnBlend += ((isYawn ? Math.sin(Math.min(1, this.stateTimer / 2.2) * Math.PI) : 0) - this.yawnBlend) * Math.min(1, dt * 7);
      this.washBlend += ((isWash ? 1 : 0) - this.washBlend) * k;

      // Gentle breathing
      const breathe = Math.sin(elapsed * (isSleeping ? 1.3 : 2.2) + this.id * 1.7) * 0.008;

      // Torso posture
      const baseTorsoY = 0.175;
      this.torso.position.y =
        baseTorsoY +
        breathe -
        this.curlBlend * 0.068 +
        this.sitUpBlend * 0.038 +
        this.startleBlend * 0.095;
      this.torso.rotation.x =
        -this.sitUpBlend * 0.42 -
        this.startleBlend * 0.92 +
        this.curlBlend * 0.14;
      this.torso.rotation.z = isWalk ? Math.sin(this.walkPhase) * 0.045 : 0;

      // Head tracking + eating tilt + yawn
      this.lookSmooth.lerp(this.lookTargetWorld, Math.min(1, dt * 3.5));
      const localLook = this.root.worldToLocal(this.lookSmooth.clone());
      let targetHeadYaw = Math.atan2(localLook.x, Math.max(0.15, localLook.z));
      targetHeadYaw = THREE.MathUtils.clamp(targetHeadYaw, -0.72, 0.72);
      let targetHeadPitch = -Math.atan2(localLook.y - 0.25, Math.max(0.25, Math.hypot(localLook.x, localLook.z)));
      targetHeadPitch = THREE.MathUtils.clamp(targetHeadPitch, -0.35, 0.35);

      if (isSleeping) {
        targetHeadYaw = 0.48 * (1 - this.peekFromTail * 0.8);
        targetHeadPitch = 0.32 * (1 - this.peekFromTail * 0.9);
      } else if (isCurled) {
        // Curled up, body tucked, but eyes gently watch favorite dish!
        targetHeadYaw = THREE.MathUtils.clamp(targetHeadYaw, -0.55, 0.55);
        targetHeadPitch = 0.12;
      } else if (isEatingHold) {
        // Slightly tilt head upward when munching an apple (少し上を向いてしゃくしゃく)
        targetHeadYaw = Math.sin(elapsed * 2.5) * 0.06;
        targetHeadPitch = -0.22 + Math.sin(elapsed * 9.5) * 0.06 * this.chewAmount;
      } else if (isStartle) {
        targetHeadYaw = 0;
        targetHeadPitch = -0.1;
      }

      this.head.rotation.y += (targetHeadYaw - this.head.rotation.y) * k;
      this.head.rotation.x +=
        (targetHeadPitch - this.torso.rotation.x * 0.75 - this.yawnBlend * 0.22 - this.head.rotation.x) * k;
      this.head.rotation.z = this.washBlend * Math.sin(elapsed * 6.5) * 0.14;

      // Chewing white cheeks (もぐもぐ動く!) & jaw + tiny pink tongue on yawn
      const chewOsc = this.chewAmount > 0.02 ? (0.5 + 0.5 * Math.sin(elapsed * 16.0)) * this.chewAmount : 0;
      const cheekScale = 1 + chewOsc * 0.16;
      this.cheekL.scale.set(0.88 * cheekScale, 0.78 * (1 + chewOsc * 0.1), 0.95 * cheekScale);
      this.cheekR.scale.set(0.88 * cheekScale, 0.78 * (1 + chewOsc * 0.1), 0.95 * cheekScale);

      this.jaw.rotation.x = this.yawnBlend * 0.56 + chewOsc * 0.15;
      this.tongue.visible = this.yawnBlend > 0.18;
      if (this.tongue.visible) {
        this.tongue.position.z = 0.052 + this.yawnBlend * 0.022;
      }

      // Eyelids (natural blink, yawn squint, cozy closed eyes when sleeping)
      const eyeClose = Math.max(
        this.blinkClosed,
        this.yawnBlend * 0.65,
        isSleeping ? 1 - this.peekFromTail * 0.92 : 0
      );
      for (const lid of this.eyelids) {
        lid.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.58, Math.PI * 0.46, eyeClose);
      }

      // Subtle ear twitch
      this.ears[0].rotation.z = 0.36 + this.earTwitchVal * 0.18;
      this.ears[1].rotation.z = -0.36 - this.earTwitchVal * 0.12;

      // Legs animation (walking, sitting/holding food, bamboo pull, face wash, cute threat pose, hollow paw reach)
      const wf = this.walkPhase;
      const stride = isWalk ? 0.52 : 0;

      const setLeg = (leg, hx, hz, kx) => {
        leg.hip.rotation.x += (hx - leg.hip.rotation.x) * Math.min(1, dt * 10);
        leg.hip.rotation.z += (hz - leg.hip.rotation.z) * Math.min(1, dt * 10);
        leg.knee.rotation.x += (kx - leg.knee.rotation.x) * Math.min(1, dt * 10);
      };

      if (isStartle) {
        // Adorable standing threat display: hind legs planted, front paws raised & spread wide!
        setLeg(this.legs.fl, -0.45, 0.72, -0.45);
        setLeg(this.legs.fr, -0.45, -0.72, -0.45);
        setLeg(this.legs.bl, 0.85, 0.08, 0.15);
        setLeg(this.legs.br, 0.85, -0.08, 0.15);
      } else if (isEatingHold) {
        // Both front paws cradling apple or grape near mouth!
        const nibbleLift = -0.95 - chewOsc * 0.14;
        setLeg(this.legs.fl, nibbleLift, -0.34, -0.58);
        setLeg(this.legs.fr, nibbleLift, 0.34, -0.58);
        setLeg(this.legs.bl, 0.38, 0.08, 0.25);
        setLeg(this.legs.br, 0.38, -0.08, 0.25);
        this.pawHoldAnchor.position.set(0, 0.035 + chewOsc * 0.015, 0.245);
      } else if (isEatingBamboo) {
        // Front paw reaching out to pull the bamboo branch closer!
        const pull = Math.sin(elapsed * 3.8) * 0.1;
        setLeg(this.legs.fl, -0.95 + pull, -0.15, -0.35);
        setLeg(this.legs.fr, -0.55, 0.12, -0.2);
        setLeg(this.legs.bl, 0.28, 0.05, 0.2);
        setLeg(this.legs.br, 0.28, -0.05, 0.2);
      } else if (isWash) {
        // Rubbing cheek gently with right front paw!
        const rub = Math.sin(elapsed * 7.5);
        setLeg(this.legs.fl, -0.35, -0.1, -0.3);
        setLeg(this.legs.fr, -1.35 + rub * 0.18, 0.28, -0.82 + rub * 0.12);
        setLeg(this.legs.bl, 0.38, 0.06, 0.25);
        setLeg(this.legs.br, 0.38, -0.06, 0.25);
      } else if (this.id === 1 && this.hollowStage === 1 && this.pawReachProgress > 0.05) {
        // Panda 2 extending curious front paw out of cleared hollow toward the middle dish!
        setLeg(this.legs.fl, -0.1, 0, 0.1);
        setLeg(this.legs.fr, -0.95 * this.pawReachProgress, -0.12, -0.25 * this.pawReachProgress);
        setLeg(this.legs.bl, 0.2, 0, 0.2);
        setLeg(this.legs.br, 0.2, 0, 0.2);
      } else if (isCurled) {
        // Legs tucked warmly underneath
        setLeg(this.legs.fl, 0.65, -0.15, -1.1);
        setLeg(this.legs.fr, 0.65, 0.15, -1.1);
        setLeg(this.legs.bl, -0.65, -0.15, 1.0);
        setLeg(this.legs.br, -0.65, 0.15, 1.0);
      } else if (isWalk) {
        setLeg(this.legs.fl, Math.sin(wf) * stride, 0, Math.max(0, -Math.cos(wf)) * 0.45);
        setLeg(this.legs.br, Math.sin(wf) * stride, 0, Math.max(0, Math.cos(wf)) * 0.45);
        setLeg(this.legs.fr, Math.sin(wf + Math.PI) * stride, 0, Math.max(0, -Math.cos(wf + Math.PI)) * 0.45);
        setLeg(this.legs.bl, Math.sin(wf + Math.PI) * stride, 0, Math.max(0, Math.cos(wf + Math.PI)) * 0.45);
      } else {
        // Relaxed perched sit on branch
        setLeg(this.legs.fl, 0.08, -0.06, -0.12);
        setLeg(this.legs.fr, 0.08, 0.06, -0.12);
        setLeg(this.legs.bl, 0.22, -0.06, -0.18);
        setLeg(this.legs.br, 0.22, 0.06, -0.18);
      }

      // =======================================================================
      // 7-SEGMENT TAIL ANIMATION (balance, gentle winter breeze, wrap, face cover!)
      // =======================================================================
      const breeze = Math.sin(elapsed * 1.4 + this.id * 2.1);
      for (let i = 0; i < this.tailSegments.length; i++) {
        const seg = this.tailSegments[i];
        const frac = (i + 1) / this.tailSegments.length;

        // Default relaxed drape & gentle wind ripple
        let ty = breeze * (0.04 + frac * 0.07) + Math.sin(elapsed * 2.8 - i * 0.55) * 0.028 * frac;
        let tx = i === 0 ? -0.22 : -0.06 * (1 - frac * 0.6);

        if (isWalk) {
          // Tail held out smoothly for balance while traversing branches!
          tx = i === 0 ? 0.08 - this.pitch * 0.4 : 0.02;
          ty = Math.sin(wf - i * 0.45) * 0.14;
        }

        // Curl tail warmly around flank when curled up
        if (this.curlBlend > 0.01) {
          const wrapYaw = 0.43 * (i === 0 ? 0.95 : 1.0);
          const wrapPitch = i === 0 ? -0.08 : 0.03;
          ty = THREE.MathUtils.lerp(ty, wrapYaw, this.curlBlend);
          tx = THREE.MathUtils.lerp(tx, wrapPitch, this.curlBlend);
        }

        // Drape lush tail tip gently across nose/face during finale sleep!
        if (this.sleepTailCover > 0.01) {
          const coverYaw = i < 4 ? 0.48 : 0.42;
          const coverPitch = i === 0 ? 0.02 : i < 4 ? 0.06 : 0.14;
          ty = THREE.MathUtils.lerp(ty, coverYaw, this.sleepTailCover);
          tx = THREE.MathUtils.lerp(tx, coverPitch, this.sleepTailCover);
        }

        seg.rotation.y += (ty - seg.rotation.y) * Math.min(1, dt * 4.5);
        seg.rotation.x += (tx - seg.rotation.x) * Math.min(1, dt * 4.5);
      }
    }

    serialize() {
      return {
        node: this.currentNode,
        state: this.state === 'walk' || this.state.startsWith('eat_') ? 'idle_sit' : this.state,
        fullness: this.fullness,
        dishAffinity: this.dishAffinity,
        lastEatenDish: this.lastEatenDish,
        hollowStage: this.hollowStage,
        facingYaw: this.facingYaw,
        heldFood: this.heldFood
          ? { type: this.heldFood.type, bitesLeft: this.heldFood.bitesLeft }
          : null,
      };
    }

    restore(data) {
      if (!data) return;
      if (data.hollowStage != null) this.hollowStage = data.hollowStage;
      if (data.node && this.world.nodes[data.node]) {
        this.currentNode = data.node;
        this.pos.copy(this.world.nodes[data.node]);
      }
      if (data.facingYaw != null) this.facingYaw = data.facingYaw;
      if (data.fullness != null) this.fullness = data.fullness;
      if (data.dishAffinity) this.dishAffinity = Object.assign(this.dishAffinity, data.dishAffinity);
      if (data.lastEatenDish) this.lastEatenDish = data.lastEatenDish;
      if (data.state) this.state = data.state;

      if (data.heldFood && data.heldFood.bitesLeft > 0) {
        const it = this.foodMgr.createFoodItem(data.heldFood.type, { bitesLeft: data.heldFood.bitesLeft });
        it.heldBy = this.id;
        this.heldFood = it;
        this.activeFood = it;
        this.pawHoldAnchor.add(it.mesh);
        it.mesh.position.set(0, 0.015, 0.01);
        this.state = data.heldFood.type === 'grape' ? 'eat_grape' : 'eat_apple';
      }
      this.syncTransform();
    }
  }

  return { RedPanda };
})();
