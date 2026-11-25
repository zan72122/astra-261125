(function () {
  'use strict';

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  class Capybara {
    constructor(opts) {
      this.id = opts.id; // 'adult' | 'baby' | 'friend'
      this.isBaby = opts.id === 'baby';
      this.scale = opts.scale || 1.0;
      this.env = opts.env;
      this.audio = opts.audio;

      // Natural warm brown coats (not dark, not oversaturated)
      const furTex = opts.textures.createFurTextures(
        opts.baseHex || '#9a7454',
        opts.tipHex || '#c29c78',
        opts.wetHex || '#6e4f37',
        opts.seed || 101
      );

      this.furMat = new THREE.MeshStandardMaterial({
        map: furTex.map,
        bumpMap: furTex.bumpMap,
        bumpScale: 0.020,
        roughnessMap: furTex.roughnessMap,
        roughness: 0.80,
        metalness: 0.03
      });

      // Seamless natural head coat matching torso (no dark chocolate multiplication!)
      this.snoutMat = new THREE.MeshStandardMaterial({
        map: furTex.map,
        bumpMap: furTex.bumpMap,
        bumpScale: 0.014,
        color: 0xf4e8dc,
        roughness: 0.78,
        metalness: 0.03
      });

      this.noseMat = new THREE.MeshStandardMaterial({
        color: 0x5c4334,
        roughness: 0.58,
        metalness: 0.04
      });

      this.eyeMat = new THREE.MeshStandardMaterial({
        color: 0x1a120e,
        roughness: 0.12,
        metalness: 0.16
      });

      this.earInnerMat = new THREE.MeshStandardMaterial({
        color: 0x7e5f48,
        roughness: 0.86
      });

      this.toothMat = new THREE.MeshStandardMaterial({
        color: 0xf4ead3,
        roughness: 0.35
      });

      this.whiskerMat = new THREE.MeshStandardMaterial({
        color: 0xd9c6b0,
        roughness: 0.32,
        metalness: 0.12
      });

      this.pawMat = new THREE.MeshStandardMaterial({
        color: 0x5d4536,
        roughness: 0.78
      });

      this.root = new THREE.Group();
      this.root.scale.setScalar(this.scale);

      this._buildModel();

      // Spatial & behavioral state
      this.pos = new THREE.Vector3(opts.x || 0, opts.y || -0.15, opts.z || 0);
      this.facing = opts.facing || 0;
      this.targetFacing = this.facing;
      this.inWater = opts.inWater !== false;
      this.onPlatform = false;
      this.onRim = false;
      this.visible = opts.visible !== false;
      this.root.visible = this.visible;

      // Animation parameters
      this.state = opts.initialState || 'soak';
      this.stateTimer = 0;
      this.time = Math.random() * 10;
      this.walkCycle = 0;
      this.neckStretch = 0;      // 0..1
      this.headPitch = 0;
      this.headYaw = 0;
      this.chewPhase = 0;
      this.chewAmount = 0;
      this.sniffAmount = 0;
      this.biteFlash = 0;
      this.eyelidClose = 0.42;   // 0.35..0.55 = authentic calm half-closed capybara eyes; 1.0 = closed
      this.blinkTimer = 2.4 + Math.random() * 3.2;
      this.blinkPhase = 0;
      this.earFlickTimer = 5.0 + Math.random() * 6.0;
      this.earFlickPhase = 0;
      this.exhaleTimer = 4.2 + Math.random() * 5.0;
      this.repositionTimer = 7.0 + Math.random() * 7.0;
      this.roamTimer = 14.0 + Math.random() * 10.0;

      // Memory & preference
      this.fullness = 0.0;         // 0..1
      this.favoriteSpot = null;    // { x, z } remembered where it ate
      this.favoriteYuzuId = null;  // remembered yuzu id it rested chin on
      this.homeSpot = new THREE.Vector2(opts.homeX !== undefined ? opts.homeX : this.pos.x, opts.homeZ !== undefined ? opts.homeZ : this.pos.z);

      // Active targets
      this.targetFood = null;
      this.targetFoodEnd = 'center'; // 'left' | 'right' | 'center' for shared cabbage
      this.targetYuzu = null;
      this.yuzuMode = null;          // 'nudge' | 'chin'
      this.walkPath = [];
      this.biteCooldown = 0;
      this.chewSoundTimer = 0;
      this.rippleTimer = 0;
      this.restingOnAdult = false;
      this.sleeping = false;

      this.syncTransform();
    }

    _buildModel() {
      // Heavy barrel body
      this.bodyPivot = new THREE.Group();
      this.root.add(this.bodyPivot);

      const torsoGeo = new THREE.SphereGeometry(0.32, 22, 16);
      torsoGeo.scale(0.86, 0.84, 1.48);
      // Subtly flatten belly and round shoulders like a real capybara
      const tp = torsoGeo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const vx = tp.getX(i);
        const vy = tp.getY(i);
        const vz = tp.getZ(i);
        let ny = vy;
        if (vz < -0.1) ny += 0.025 * (-vz); // slightly higher rump
        if (vy < -0.15) ny = -0.15 + (vy + 0.15) * 0.65;
        tp.setXYZ(i, vx, ny, vz);
      }
      torsoGeo.computeVertexNormals();
      this.torsoMesh = new THREE.Mesh(torsoGeo, this.furMat);
      this.torsoMesh.position.set(0, 0.25, -0.04);
      this.torsoMesh.castShadow = true;
      this.torsoMesh.receiveShadow = true;
      this.bodyPivot.add(this.torsoMesh);

      // Thick short shoulders/neck
      this.neckPivot = new THREE.Group();
      this.neckPivot.position.set(0, 0.30, 0.34);
      this.bodyPivot.add(this.neckPivot);

      const neckGeo = new THREE.CylinderGeometry(0.155, 0.195, 0.26, 14);
      neckGeo.rotateX(Math.PI * 0.38);
      const neckMesh = new THREE.Mesh(neckGeo, this.furMat);
      neckMesh.position.set(0, 0.04, 0.06);
      neckMesh.castShadow = true;
      neckMesh.receiveShadow = true;
      this.neckPivot.add(neckMesh);

      // Iconic boxy / rectangular capybara head (blunt flat snout, high small eyes)
      this.headPivot = new THREE.Group();
      this.headPivot.position.set(0, 0.09, 0.16);
      this.neckPivot.add(this.headPivot);

      // Cranium & boxy muzzle sculpted from subdivided box-sphere blend
      const headGeo = new THREE.SphereGeometry(0.175, 20, 16);
      const hp = headGeo.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        let vx = hp.getX(i);
        let vy = hp.getY(i);
        let vz = hp.getZ(i);
        // Elongate forward into rectangular barrel snout
        vz *= 1.48;
        vx *= 0.86;
        vy *= 0.88;
        // Boxify the snout (forward half)
        if (vz > 0.02) {
          const t = Math.min(1, vz / 0.24);
          // Slightly flatter nose bridge and squared blunt front
          vy = vy * (1.0 - 0.16 * t) - 0.015 * t;
          vx = Math.sign(vx) * Math.pow(Math.abs(vx) / 0.16, 0.84) * 0.145 * (1.0 - 0.12 * t);
          if (vz > 0.21) {
            vz = 0.21 + (vz - 0.21) * 0.42; // blunt muzzle tip
          }
        }
        // Subtle gentle cheeks
        if (vy < 0 && vz > -0.05 && vz < 0.14) {
          vx *= 1.07;
        }
        hp.setXYZ(i, vx, vy, vz);
      }
      headGeo.computeVertexNormals();
      this.headMesh = new THREE.Mesh(headGeo, this.snoutMat);
      this.headMesh.position.set(0, 0.03, 0.08);
      this.headMesh.castShadow = true;
      this.headMesh.receiveShadow = true;
      this.headPivot.add(this.headMesh);

      // Subtle authentic capybara flat dark-brown muzzle tip & sculpted nostrils (not a protruding dog nose!)
      const nosePadGeo = new THREE.SphereGeometry(0.058, 12, 10);
      nosePadGeo.scale(1.28, 0.58, 0.24);
      const nosePad = new THREE.Mesh(nosePadGeo, this.noseMat);
      nosePad.position.set(0, 0.032, 0.300);
      this.headPivot.add(nosePad);

      // Sculpted nostrils that subtly flare while breathing
      const nostrilGeo = new THREE.SphereGeometry(0.012, 8, 6);
      nostrilGeo.scale(0.85, 1.10, 0.45);
      const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x261a14, roughness: 0.48 });
      this.leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      this.leftNostril.position.set(-0.042, 0.042, 0.308);
      this.leftNostril.rotation.z = 0.28;
      this.headPivot.add(this.leftNostril);

      this.rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      this.rightNostril.position.set(0.042, 0.042, 0.308);
      this.rightNostril.rotation.z = -0.28;
      this.headPivot.add(this.rightNostril);

      // Articulated lower jaw for genuine side-to-side chewing ("口をもぐもぐ横に動かし")
      this.jawPivot = new THREE.Group();
      this.jawPivot.position.set(0, -0.052, 0.10);
      this.headPivot.add(this.jawPivot);

      const jawGeo = new THREE.SphereGeometry(0.115, 14, 10);
      jawGeo.scale(0.84, 0.52, 1.55);
      const jawMesh = new THREE.Mesh(jawGeo, this.snoutMat);
      jawMesh.position.set(0, -0.015, 0.06);
      this.jawPivot.add(jawMesh);

      // Subtle front incisors visible when biting
      const toothGeo = new THREE.BoxGeometry(0.016, 0.024, 0.010);
      this.leftTooth = new THREE.Mesh(toothGeo, this.toothMat);
      this.leftTooth.position.set(-0.011, 0.008, 0.185);
      this.rightTooth = new THREE.Mesh(toothGeo, this.toothMat);
      this.rightTooth.position.set(0.011, 0.008, 0.185);
      this.jawPivot.add(this.leftTooth);
      this.jawPivot.add(this.rightTooth);

      // Small, calm, realistic capybara eyes set high on the sides of the head
      // Strictly small and gentle — NEVER oversized or human-like!
      this.eyelids = [];
      [-1, 1].forEach((side) => {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(side * 0.116, 0.096, 0.104);
        eyeGroup.rotation.y = side * 0.30;

        const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), this.eyeMat);
        eyeball.scale.set(0.88, 0.72, 1.05);
        eyeGroup.add(eyeball);

        // Fur-matched upper eyelid hood for calm half-closed real capybara gaze
        const upperLidGeo = new THREE.SphereGeometry(0.025, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
        const upperLid = new THREE.Mesh(upperLidGeo, this.snoutMat);
        upperLid.rotation.x = -0.35;
        eyeGroup.add(upperLid);

        // Subtle lower eyelid rim
        const lowerLidGeo = new THREE.SphereGeometry(0.0245, 10, 6, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42);
        const lowerLid = new THREE.Mesh(lowerLidGeo, this.snoutMat);
        eyeGroup.add(lowerLid);

        this.eyelids.push({ upper: upperLid, lower: lowerLid });
        this.headPivot.add(eyeGroup);
      });

      // Small rounded ears set back near the top of the head
      this.leftEar = this._buildEar(-1);
      this.rightEar = this._buildEar(1);
      this.headPivot.add(this.leftEar);
      this.headPivot.add(this.rightEar);

      // Fine wet whiskers on both sides of the snout (noticeable at water-level camera!)
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 4; i++) {
          const len = 0.095 + (i % 2) * 0.028;
          const wGeo = new THREE.CylinderGeometry(0.0014, 0.0024, len, 4);
          wGeo.rotateZ(Math.PI / 2);
          const whisker = new THREE.Mesh(wGeo, this.whiskerMat);
          whisker.position.set(
            side * (0.095 + len * 0.42),
            0.004 - i * 0.013,
            0.255 - i * 0.015
          );
          whisker.rotation.y = -side * (0.28 + i * 0.12);
          whisker.rotation.z = -side * (0.08 + i * 0.06);
          this.headPivot.add(whisker);
        }
      });

      // Four short sturdy legs (visible when walking out onto the edge / raised stone platform)
      this.legs = [];
      const legCoords = [
        { name: 'FL', x: -0.15, z: 0.22 },
        { name: 'FR', x: 0.15,  z: 0.22 },
        { name: 'BL', x: -0.16, z: -0.26 },
        { name: 'BR', x: 0.16,  z: -0.26 }
      ];
      legCoords.forEach((lc) => {
        const pivot = new THREE.Group();
        pivot.position.set(lc.x, 0.14, lc.z);

        const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.044, 0.24, 8), this.furMat);
        legMesh.position.y = -0.10;
        legMesh.castShadow = true;
        pivot.add(legMesh);

        const pawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), this.pawMat);
        pawMesh.scale.set(0.95, 0.55, 1.3);
        pawMesh.position.set(0, -0.21, 0.025);
        pivot.add(pawMesh);

        this.bodyPivot.add(pivot);
        this.legs.push({ pivot, isFront: lc.z > 0, side: lc.x < 0 ? -1 : 1 });
      });

      // Helper anchor at snout tip for distance checks, sniffing, and breath puffs
      this.snoutTip = new THREE.Object3D();
      this.snoutTip.position.set(0, 0.02, 0.34);
      this.headPivot.add(this.snoutTip);

      // Anchor on adult's warm back where baby can rest its head
      this.backRestAnchor = new THREE.Object3D();
      this.backRestAnchor.position.set(0, 0.44, -0.06);
      this.bodyPivot.add(this.backRestAnchor);
    }

    _buildEar(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.118, 0.122, -0.072);

      const outerGeo = new THREE.SphereGeometry(0.042, 10, 8);
      outerGeo.scale(0.46, 0.92, 0.86);
      const outer = new THREE.Mesh(outerGeo, this.snoutMat);
      outer.position.set(side * 0.016, 0.016, -0.008);
      outer.rotation.z = -side * 0.52;
      outer.rotation.y = side * 0.34;
      pivot.add(outer);

      const innerGeo = new THREE.SphereGeometry(0.028, 8, 6);
      innerGeo.scale(0.36, 0.76, 0.66);
      const inner = new THREE.Mesh(innerGeo, this.earInnerMat);
      inner.position.set(side * 0.021, 0.015, 0.002);
      inner.rotation.z = -side * 0.52;
      pivot.add(inner);

      return pivot;
    }

    getSnoutWorldPos(out) {
      const v = out || new THREE.Vector3();
      this.root.updateMatrixWorld(true);
      this.snoutTip.getWorldPosition(v);
      return v;
    }

    getBackRestWorldPos(out) {
      const v = out || new THREE.Vector3();
      this.root.updateMatrixWorld(true);
      this.backRestAnchor.getWorldPosition(v);
      return v;
    }

    // Slow head/body turn when a water sound occurs elsewhere
    onWaterSound(x, z) {
      if (!this.visible || this.sleeping || this.state === 'eat_apple' || this.state === 'eat_cabbage') return;
      const dist = Math.hypot(x - this.pos.x, z - this.pos.z);
      if (dist > 0.35 && dist < 3.0) {
        this.targetFacing = Math.atan2(x - this.pos.x, z - this.pos.z);
      }
    }

    wakeUp(lookX, lookZ) {
      this.sleeping = false;
      this.fullness = Math.max(0.15, this.fullness - 0.35);
      if (lookX !== undefined && lookZ !== undefined) {
        this.targetFacing = Math.atan2(lookX - this.pos.x, lookZ - this.pos.z);
      }
      if (this.state === 'huddle_sleep') {
        this.state = 'soak';
        this.stateTimer = 0;
      }
    }

    // Start 3rd capybara walking in calmly from the winter grass meadow
    beginMeadowArrival(settleX, settleZ) {
      this.visible = true;
      this.root.visible = true;
      this.inWater = false;
      this.onRim = false;
      this.onPlatform = false;
      this.pos.set(-1.35, 0.24, -3.55);
      this.facing = Math.atan2(-0.55 - this.pos.x, -1.35 - this.pos.z);
      this.targetFacing = this.facing;
      this.homeSpot.set(settleX, settleZ);
      this.walkPath = [
        { x: -0.78, z: -2.05, y: 0.14, inWater: false },
        { x: -0.54, z: -1.24, y: 0.08, inWater: false },
        { x: -0.56, z: -0.68, y: -0.21, inWater: true },
        { x: settleX, z: settleZ, y: -0.21, inWater: true }
      ];
      this.state = 'enter_bath';
      this.stateTimer = 0;
    }

    // Send baby capybara out onto the raised stone platform (Discovery #5)
    goToPlatform() {
      if (!this.isBaby || !this.visible) return;
      if (this.onPlatform || this.state === 'walk_to_platform') return;
      this.restingOnAdult = false;
      this.targetYuzu = null;
      this.walkPath = [
        { x: 0.52, z: 0.72, y: -0.13, inWater: true },
        { x: 0.78, z: 0.78, y: 0.22, inWater: false, onRim: true },
        { x: 0.90, z: 0.34, y: this.env.platformCenter.y, inWater: false, onPlatform: true }
      ];
      this.state = 'walk_to_platform';
      this.stateTimer = 0;
    }

    // Return baby capybara smoothly from edge/platform back into the bath
    returnToBath() {
      if (this.inWater) return;
      this.walkPath = [
        { x: 0.68, z: 0.80, y: 0.15, inWater: false, onRim: true },
        { x: this.homeSpot.x, z: this.homeSpot.y, y: this.isBaby ? -0.13 : -0.22, inWater: true }
      ];
      this.state = 'walk_back_bath';
      this.stateTimer = 0;
    }

    syncTransform() {
      // Sink gently deeper into warm bath when steam/warmth is high!
      const warmthSink = this.inWater ? (this.env.warmth - 0.32) * (this.isBaby ? 0.045 : 0.07) : 0;
      const waterRise = this.inWater ? this.env.waterDepthBonus : 0;
      const breatheBob = this.inWater ? Math.sin(this.time * 1.45) * 0.008 : 0;
      this.root.position.set(this.pos.x, this.pos.y - warmthSink + waterRise + breatheBob, this.pos.z);
      this.root.rotation.y = this.facing;
    }

    update(dt, ctx) {
      if (!this.visible) return;
      this.time += dt;
      this.stateTimer += dt;
      if (this.biteCooldown > 0) this.biteCooldown -= dt;

      const { foods, yuzus, capybaras, phaseInfo } = ctx;
      const adult = capybaras.find((c) => c.id === 'adult');

      // 1. Everyday subtle autonomous life (blinking, breathing, nostrils, ear flicks, nose exhales)
      this._updateAmbientMicroBehaviors(dt);

      // 2. High-level unhurried decision & physical movement
      if (this.state === 'enter_bath' || this.state === 'walk_to_platform' || this.state === 'walk_back_bath' || this.state === 'rim_stroll') {
        this._updateWalkPath(dt, yuzus);
      } else {
        // Check if any edible food is available (unless already sleeping deeply at finale)
        if (!this.sleeping) {
          this._selectFoodOrYuzu(dt, foods, yuzus, capybaras, phaseInfo);
        }

        if (this.state === 'eat_apple') {
          this._updateEatApple(dt, foods, ctx);
        } else if (this.state === 'eat_cabbage') {
          this._updateEatCabbage(dt, foods, capybaras, ctx);
        } else if (this.state === 'yuzu_play') {
          this._updateYuzuPlay(dt, yuzus);
        } else if (this.state === 'rest_on_adult' && adult) {
          this._updateRestOnAdult(dt, adult);
        } else if (this.state === 'huddle_sleep') {
          this._updateHuddleSleep(dt, capybaras, yuzus);
        } else {
          this._updateSoakIdle(dt, capybaras, yuzus, phaseInfo);
        }
      }

      // 3. Soft capybara-to-capybara body separation (never interpenetrate, but allow cozy nestling)
      if (this.inWater && this.state !== 'enter_bath') {
        const myRad = this.isBaby ? 0.24 : 0.34;
        for (let i = 0; i < capybaras.length; i++) {
          const other = capybaras[i];
          if (other === this || !other.visible || !other.inWater) continue;
          const oRad = other.isBaby ? 0.24 : 0.34;
          const minDist = (this.restingOnAdult && other.id === 'adult') ? 0.36 : (myRad + oRad) * 0.90;
          const dx = this.pos.x - other.pos.x;
          const dz = this.pos.z - other.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.001 && d < minDist) {
            const push = (minDist - d) * dt * 1.6;
            this.pos.x += (dx / d) * push;
            this.pos.z += (dz / d) * push;
          }
        }
        const clamped = this.env.clampToPool(this.pos.x, this.pos.z, this.isBaby ? 0.24 : 0.34);
        this.pos.x = clamped.x;
        this.pos.z = clamped.z;
      }

      // 4. Gently nudge nearby floating yuzu aside when moving in water
      if (this.inWater) {
        const bodyRad = this.isBaby ? 0.28 : 0.40;
        for (let i = 0; i < yuzus.length; i++) {
          const yz = yuzus[i];
          if (!yz.inWater) continue;
          if (this.targetYuzu === yz && this.yuzuMode === 'chin') continue;
          const dx = yz.pos.x - this.pos.x;
          const dz = yz.pos.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          const minD = bodyRad + yz.radius;
          if (d > 0.001 && d < minD) {
            const overlap = minD - d;
            yz.vx += (dx / d) * overlap * 2.2;
            yz.vz += (dz / d) * overlap * 2.2;
          }
        }
      }

      // 5. Smoothly apply articulated pose (neck, head, jaw chewing, eyelids, ears, legs)
      this._applyArticulatedPose(dt);
      this.syncTransform();
    }

    _updateAmbientMicroBehaviors(dt) {
      // Gentle nostril breathing flare
      const breath = 0.5 + 0.5 * Math.sin(this.time * 1.65);
      const nScale = 0.92 + breath * 0.20 + this.sniffAmount * Math.sin(this.time * 13.0) * 0.18;
      this.leftNostril.scale.set(nScale, nScale, 1);
      this.rightNostril.scale.set(nScale, nScale, 1);

      // Slow eyelids: naturally half-closed, closing more deeply when warm, full, or sleeping
      let desiredClose = 0.42 + this.env.warmth * 0.20 + this.fullness * 0.22;
      if (this.yuzuMode === 'chin' || this.restingOnAdult) desiredClose += 0.24;
      if (this.sleeping || this.state === 'huddle_sleep') desiredClose = 1.0;
      if (this.state === 'eat_apple' || this.state === 'eat_cabbage') desiredClose = 0.34;
      desiredClose = Math.max(0.28, Math.min(1.0, desiredClose));

      // Occasional slow natural blink
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkPhase = 1.0;
        this.blinkTimer = (this.fullness > 0.5 ? 2.2 : 3.5) + Math.random() * 4.5;
      }
      if (this.blinkPhase > 0) {
        this.blinkPhase = Math.max(0, this.blinkPhase - dt * 3.4);
      }
      const blinkBump = Math.sin(this.blinkPhase * Math.PI) * (1.0 - desiredClose);
      this.eyelidClose += ((desiredClose + blinkBump) - this.eyelidClose) * Math.min(1, dt * 7.0);

      // Occasional ear twitch flicking droplets into the water ("耳をぴくぴく動かしてお湯を飛ばす")
      this.earFlickTimer -= dt;
      if (this.earFlickTimer <= 0 && !this.sleeping) {
        this.earFlickPhase = 1.0;
        this.earFlickTimer = 6.5 + Math.random() * 8.5;
        if (this.inWater) {
          const tip = this.getSnoutWorldPos();
          this.env.spawnDroplets(this.pos.x, tip.y + 0.10, this.pos.z, 4, 0.85);
          if (this.audio) this.audio.playWaterRipple(0.22, 1.55);
        }
      }
      if (this.earFlickPhase > 0) {
        this.earFlickPhase = Math.max(0, this.earFlickPhase - dt * 2.6);
      }

      // Occasional soft warm nose exhale swaying the steam ("鼻からふーっと息を吐いて湯気を揺らす")
      this.exhaleTimer -= dt;
      if (this.exhaleTimer <= 0 && this.state !== 'eat_apple' && this.state !== 'eat_cabbage') {
        this.exhaleTimer = 5.5 + Math.random() * 7.0;
        const snout = this.getSnoutWorldPos();
        const fx = Math.sin(this.facing + this.headYaw);
        const fz = Math.cos(this.facing + this.headYaw);
        this.env.pushBreath(snout.x, snout.y, snout.z, fx, fz);
        if (this.audio) this.audio.playNoseExhale(this.isBaby);
      }
    }

    _selectFoodOrYuzu(dt, foods, yuzus, capybaras, phaseInfo) {
      // Keep current food target if still valid and edible
      if (this.targetFood && this.targetFood.alive && !this.targetFood.dragging && !this.targetFood.sunk) {
        return;
      }
      this.targetFood = null;

      // Look for available cabbage first (especially for baby & shared eating), then apples!
      let bestFood = null;
      let bestScore = Infinity;

      for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        if (!f.alive || f.dragging || f.inBasket || f.sunk) continue;
        // Count how many OTHER capybaras are targeting this food
        const claimants = capybaras.filter((c) => c !== this && c.visible && c.targetFood === f);

        if (f.kind === 'cabbage') {
          // Up to 2 capybaras share one cabbage leaf from opposite ends!
          if (claimants.length >= 2) continue;
          const dist = Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
          const pref = this.isBaby ? -0.6 : -0.25;
          const score = dist + pref;
          if (score < bestScore) {
            bestScore = score;
            bestFood = f;
          }
        } else if (f.kind === 'apple') {
          // If 3 separate apples exist, each capybara prefers an unclaimed one; if only 1 exists, noses can gather!
          const unclaimedApples = foods.filter((a) =>
            a.alive && !a.dragging && !a.inBasket && !a.sunk && a.kind === 'apple' &&
            !capybaras.some((c) => c !== this && c.visible && c.targetFood === a)
          );
          if (unclaimedApples.length > 0 && claimants.length > 0) continue;
          const dist = Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
          const score = dist + claimants.length * 0.55;
          if (score < bestScore) {
            bestScore = score;
            bestFood = f;
          }
        }
      }

      if (bestFood) {
        this.targetFood = bestFood;
        this.targetYuzu = null;
        this.restingOnAdult = false;
        this.state = bestFood.kind === 'cabbage' ? 'eat_cabbage' : 'eat_apple';
        this.stateTimer = 0;

        if (bestFood.kind === 'cabbage') {
          const otherClaimant = capybaras.find((c) => c !== this && c.visible && c.targetFood === bestFood);
          if (otherClaimant) {
            this.targetFoodEnd = otherClaimant.targetFoodEnd === 'left' ? 'right' : 'left';
          } else {
            this.targetFoodEnd = this.isBaby ? 'right' : 'left';
          }
        }
        return;
      }

      // If no food right now and we were eating, smoothly return to soaking or platform resting
      if (this.state === 'eat_apple' || this.state === 'eat_cabbage') {
        this.state = 'soak';
        this.stateTimer = 0;
        this.neckStretch = 0;
        this.sniffAmount = 0;
        this.chewAmount = 0;
      }

      // Look for nearby floating yuzu to nudge or rest chin on!
      if (this.inWater && this.state === 'soak' && yuzus.length > 0 && this.stateTimer > 2.2) {
        // Prefer remembered favorite yuzu if nearby, otherwise nearest floating yuzu
        let pick = yuzus.find((y) => y.id === this.favoriteYuzuId && y.inWater);
        if (!pick) {
          let bestD = 1.45;
          for (let i = 0; i < yuzus.length; i++) {
            const y = yuzus[i];
            if (!y.inWater || y.dragging) continue;
            const d = Math.hypot(y.pos.x - this.pos.x, y.pos.z - this.pos.z);
            if (d < bestD) {
              bestD = d;
              pick = y;
            }
          }
        }
        if (pick && Math.random() < dt * 0.35) {
          this.targetYuzu = pick;
          this.yuzuMode = (yuzus.length >= 2 && Math.random() < 0.6) ? 'chin' : 'nudge';
          this.state = 'yuzu_play';
          this.stateTimer = 0;
        }
      }
    }

    _moveToward(tx, tz, speed, dt) {
      const dx = tx - this.pos.x;
      const dz = tz - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.02) {
        this.targetFacing = Math.atan2(dx, dz);
        const diff = angleDiff(this.facing, this.targetFacing);
        this.facing += diff * Math.min(1, dt * 2.1);

        const align = Math.max(0.2, Math.cos(diff));
        const step = Math.min(dist, speed * align * dt);
        this.pos.x += (dx / dist) * step;
        this.pos.z += (dz / dist) * step;
        this.walkCycle += step * (this.isBaby ? 9.0 : 6.2);

        if (this.inWater) {
          this.rippleTimer -= dt;
          if (this.rippleTimer <= 0) {
            this.env.addRipple(this.pos.x, this.pos.z, 0.28);
            this.rippleTimer = 0.55;
          }
        }
      }
      return dist;
    }

    _updateWalkPath(dt, yuzus) {
      if (this.walkPath.length === 0) {
        this.state = 'soak';
        this.stateTimer = 0;
        return;
      }
      const wp = this.walkPath[0];
      const speed = this.isBaby ? 0.34 : 0.30; // slow, heavy, unhurried capybara pace
      const dist = this._moveToward(wp.x, wp.z, speed, dt);
      this.pos.y += (wp.y - this.pos.y) * Math.min(1, dt * 2.4);

      if (dist < 0.10) {
        const wasInWater = this.inWater;
        this.inWater = !!wp.inWater;
        this.onPlatform = !!wp.onPlatform;
        this.onRim = !!wp.onRim;
        this.pos.y = wp.y;
        if (wasInWater !== this.inWater) {
          this.env.addRipple(this.pos.x, this.pos.z, 0.72);
          if (this.audio) this.audio.playWaterRipple(0.55, this.isBaby ? 1.25 : 0.92);
        }
        this.walkPath.shift();
        if (this.walkPath.length === 0) {
          if (this.state === 'enter_bath') {
            // Gently displace nearby yuzu when 3rd capybara settles in
            yuzus.forEach((y) => {
              if (!y.inWater) return;
              const dx = y.pos.x - this.pos.x;
              const dz = y.pos.z - this.pos.z;
              const d = Math.hypot(dx, dz) + 0.01;
              if (d < 0.85) {
                y.vx += (dx / d) * 0.45;
                y.vz += (dz / d) * 0.45;
              }
            });
            this.targetFacing = 0.32;
          } else if (this.state === 'walk_to_platform') {
            this.targetFacing = -0.65;
          }
          this.state = 'soak';
          this.stateTimer = 0;
        }
      }
    }

    _updateEatApple(dt, foods, ctx) {
      const f = this.targetFood;
      if (!f || !f.alive || f.dragging || f.sunk) {
        this.targetFood = null;
        this.state = 'soak';
        return;
      }

      // Compute comfortable eating stand-off point (staying in water if food is on rim, or on platform if already on platform)
      const reach = this.isBaby ? 0.38 : 0.56;
      const toFoodX = f.pos.x - this.pos.x;
      const toFoodZ = f.pos.z - this.pos.z;
      const d = Math.hypot(toFoodX, toFoodZ) + 0.001;

      let goalX = f.pos.x - (toFoodX / d) * reach;
      let goalZ = f.pos.z - (toFoodZ / d) * reach;
      if (this.inWater) {
        const cl = this.env.clampToPool(goalX, goalZ, this.isBaby ? 0.24 : 0.32);
        goalX = cl.x;
        goalZ = cl.z;
      }

      const distToGoal = Math.hypot(goalX - this.pos.x, goalZ - this.pos.z);
      const speed = this.isBaby ? 0.30 : 0.26;
      if (distToGoal > 0.14) {
        this._moveToward(goalX, goalZ, speed, dt);
        this.neckStretch += (0.25 - this.neckStretch) * dt * 2.5;
        this.sniffAmount += (0.3 - this.sniffAmount) * dt * 3;
        this.chewAmount *= (1 - dt * 4);
      } else {
        // Face the apple, slowly stretch neck, twitch nose to sniff, then crunch & chew side-to-side!
        this.targetFacing = Math.atan2(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
        this.facing += angleDiff(this.facing, this.targetFacing) * Math.min(1, dt * 2.6);

        const snout = this.getSnoutWorldPos();
        const snoutDist = Math.hypot(f.pos.x - snout.x, f.pos.z - snout.z);
        this.neckStretch += (Math.min(1.0, 0.55 + snoutDist * 0.9) - this.neckStretch) * Math.min(1, dt * 2.2);

        // Aim head pitch gently toward apple height
        const dy = f.pos.y - snout.y;
        this.headPitch += (Math.max(-0.35, Math.min(0.45, -dy * 1.4)) - this.headPitch) * Math.min(1, dt * 3.0);

        if (this.stateTimer < 1.15) {
          // Sniffing phase ("鼻をひくひくさせて匂いを嗅ぎ")
          this.sniffAmount = 1.0;
          this.chewAmount *= (1 - dt * 4);
        } else {
          this.sniffAmount = 0.2;
          this.chewAmount = 1.0;
          this.chewPhase += dt * (this.isBaby ? 7.8 : 6.4);

          this.chewSoundTimer -= dt;
          if (this.chewSoundTimer <= 0) {
            if (this.audio) this.audio.playChew(false, this.isBaby);
            this.chewSoundTimer = 0.42 + Math.random() * 0.14;
          }

          // Take a crisp front-tooth bite every ~1.35s (never rushed!)
          if (this.biteCooldown <= 0) {
            this.biteCooldown = 1.35 + Math.random() * 0.35;
            this.biteFlash = 1.0;
            const finished = f.takeBite(this.pos.x, this.pos.z);
            if (this.audio) this.audio.playAppleCrunch(this.isBaby);
            if (ctx.onBite) ctx.onBite(this, f, finished);

            // Remember this favorite feeding spot!
            this.favoriteSpot = { x: f.pos.x, z: f.pos.z };
            this.fullness = Math.min(1.0, this.fullness + 0.085);

            if (finished) {
              this.targetFood = null;
              this.state = 'soak';
              this.stateTimer = 0;
            }
          }
        }
      }
    }

    _updateEatCabbage(dt, foods, capybaras, ctx) {
      const f = this.targetFood;
      if (!f || !f.alive || f.dragging) {
        this.targetFood = null;
        this.state = 'soak';
        return;
      }

      // If baby & cabbage is on the front edge or raised stone platform, baby climbs out to eat!
      if (this.isBaby && this.inWater) {
        if (f.onPlatform) {
          this.goToPlatform();
          return;
        }
        if (this.env.isOnFrontEdge(f.pos.x, f.pos.z)) {
          // Step smoothly up onto the flat stone edge beside the cabbage
          this.walkPath = [
            { x: f.pos.x + 0.18, z: 1.08, y: 0.02, inWater: true },
            { x: f.pos.x + 0.24, z: Math.min(1.42, f.pos.z + 0.06), y: this.env.frontEdgeY, inWater: false, onRim: true }
          ];
          this.state = 'rim_stroll';
          this.stateTimer = 0;
          return;
        }
      }

      // Pick opposite ends of the leaf so adult & baby eat toward each other and meet noses in the middle!
      const endOffset = (this.targetFoodEnd === 'left' ? -1 : 1) * (0.14 * f.remainRatio);
      const biteX = f.pos.x + endOffset;
      const biteZ = f.pos.z;

      const reach = this.isBaby ? 0.32 : 0.54;
      const dx = biteX - this.pos.x;
      const dz = biteZ - this.pos.z;
      const d = Math.hypot(dx, dz) + 0.001;

      let goalX = biteX - (dx / d) * reach;
      let goalZ = biteZ - (dz / d) * reach;
      if (this.inWater) {
        const cl = this.env.clampToPool(goalX, goalZ, this.isBaby ? 0.24 : 0.32);
        goalX = cl.x;
        goalZ = cl.z;
      }

      const distToGoal = Math.hypot(goalX - this.pos.x, goalZ - this.pos.z);
      if (distToGoal > 0.16) {
        this._moveToward(goalX, goalZ, this.isBaby ? 0.30 : 0.26, dt);
        this.neckStretch += (0.35 - this.neckStretch) * dt * 2.4;
      } else {
        this.targetFacing = Math.atan2(biteX - this.pos.x, biteZ - this.pos.z);
        this.facing += angleDiff(this.facing, this.targetFacing) * Math.min(1, dt * 2.6);
        this.neckStretch += (0.85 - this.neckStretch) * Math.min(1, dt * 2.2);

        const snout = this.getSnoutWorldPos();
        const dy = f.pos.y - snout.y;
        this.headPitch += (Math.max(-0.35, Math.min(0.45, -dy * 1.4)) - this.headPitch) * Math.min(1, dt * 3.0);

        this.chewAmount = 1.0;
        this.chewPhase += dt * (this.isBaby ? 8.2 : 6.6);
        this.chewSoundTimer -= dt;
        if (this.chewSoundTimer <= 0) {
          if (this.audio) this.audio.playChew(true, this.isBaby);
          this.chewSoundTimer = 0.36 + Math.random() * 0.14;
        }

        if (this.biteCooldown <= 0) {
          this.biteCooldown = 1.25 + Math.random() * 0.3;
          this.biteFlash = 0.85;
          const finished = f.takeBite(this.pos.x, this.pos.z, this.targetFoodEnd);
          if (ctx.onBite) ctx.onBite(this, f, finished);

          this.favoriteSpot = { x: f.pos.x, z: f.pos.z };
          this.fullness = Math.min(1.0, this.fullness + 0.075);

          // Check for gentle nose-to-nose bump in the middle when two capybaras share the same leaf!
          const partner = capybaras.find((c) => c !== this && c.visible && c.targetFood === f);
          if (partner && f.remainRatio <= 0.42 && !f.noseBumped) {
            f.noseBumped = true;
            if (this.audio) this.audio.playNoseBoop();
            // Gentle playful pause & tiny soft recoil
            this.headPitch = -0.14;
            partner.headPitch = -0.14;
            if (ctx.onNoseBump) ctx.onNoseBump(this, partner);
          }

          if (finished) {
            this.targetFood = null;
            this.state = 'soak';
            this.stateTimer = 0;
          }
        }
      }
    }

    _updateYuzuPlay(dt, yuzus) {
      const yz = this.targetYuzu;
      if (!yz || !yz.inWater || yz.dragging || this.stateTimer > 12.0) {
        this.targetYuzu = null;
        this.yuzuMode = null;
        this.state = 'soak';
        this.stateTimer = 0;
        return;
      }

      const snout = this.getSnoutWorldPos();
      const dx = yz.pos.x - this.pos.x;
      const dz = yz.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz) + 0.001;

      const desiredDist = this.isBaby ? 0.36 : 0.54;
      if (dist > desiredDist + 0.12) {
        const gx = yz.pos.x - (dx / dist) * desiredDist;
        const gz = yz.pos.z - (dz / dist) * desiredDist;
        const cl = this.env.clampToPool(gx, gz, this.isBaby ? 0.24 : 0.34);
        this._moveToward(cl.x, cl.z, 0.24, dt);
      } else {
        this.targetFacing = Math.atan2(dx, dz);
        this.facing += angleDiff(this.facing, this.targetFacing) * Math.min(1, dt * 2.2);

        if (this.yuzuMode === 'nudge') {
          // Gently poke yuzu with snout
          this.neckStretch += (0.55 - this.neckStretch) * dt * 2.5;
          if (this.stateTimer > 1.3 && Math.hypot(yz.pos.x - snout.x, yz.pos.z - snout.z) < 0.28) {
            const nx = Math.sin(this.facing);
            const nz = Math.cos(this.facing);
            yz.vx += nx * 0.42;
            yz.vz += nz * 0.42;
            this.env.addRipple(yz.pos.x, yz.pos.z, 0.42);
            if (this.audio) this.audio.playYuzuBonk(0.45);
            this.favoriteYuzuId = yz.id;
            this.targetYuzu = null;
            this.yuzuMode = null;
            this.state = 'soak';
            this.stateTimer = 0;
          }
        } else {
          // Rest chin blissfully on the floating yuzu ("顎をのせたり")
          this.neckStretch += (0.45 - this.neckStretch) * dt * 2.0;
          this.headPitch += (0.16 - this.headPitch) * dt * 2.2;
          // Gently keep the yuzu right beneath the chin
          const chinX = snout.x;
          const chinZ = snout.z;
          yz.pos.x += (chinX - yz.pos.x) * Math.min(1, dt * 2.0);
          yz.pos.z += (chinZ - yz.pos.z) * Math.min(1, dt * 2.0);
          yz.vx *= 0.88;
          yz.vz *= 0.88;
          yz.chinPressed = 1.0;
          this.favoriteYuzuId = yz.id;
        }
      }
    }

    _updateRestOnAdult(dt, adult) {
      if (!adult.inWater || this.stateTimer > 11.0) {
        this.restingOnAdult = false;
        this.state = 'soak';
        this.stateTimer = 0;
        return;
      }
      const backPos = adult.getBackRestWorldPos();
      const sideDirX = Math.cos(adult.facing);
      const sideDirZ = -Math.sin(adult.facing);
      const goalX = backPos.x + sideDirX * 0.40;
      const goalZ = backPos.z + sideDirZ * 0.40;
      const cl = this.env.clampToPool(goalX, goalZ, 0.24);
      const d = Math.hypot(cl.x - this.pos.x, cl.z - this.pos.z);

      if (d > 0.14) {
        this._moveToward(cl.x, cl.z, 0.24, dt);
      } else {
        this.targetFacing = Math.atan2(backPos.x - this.pos.x, backPos.z - this.pos.z);
        this.facing += angleDiff(this.facing, this.targetFacing) * Math.min(1, dt * 2.0);
        this.neckStretch += (0.45 - this.neckStretch) * dt * 1.8;
        this.headPitch += (-0.12 - this.headPitch) * dt * 1.8; // gently leaning head up onto adult's back
      }
    }

    _updateHuddleSleep(dt, capybaras, yuzus) {
      this.sleeping = true;
      if (!this.inWater) {
        this.returnToBath();
        return;
      }
      // Gently drift close to the center huddle spot surrounded by yuzu
      const huddleSpot = this.id === 'adult'
        ? { x: -0.14, z: 0.06 }
        : this.id === 'baby'
          ? { x: 0.32, z: 0.28 }
          : { x: -0.58, z: -0.18 };
      const d = Math.hypot(huddleSpot.x - this.pos.x, huddleSpot.z - this.pos.z);
      if (d > 0.12) {
        this._moveToward(huddleSpot.x, huddleSpot.z, 0.18, dt);
      } else {
        const cozyFacing = this.id === 'adult' ? 0.34 : this.id === 'baby' ? -0.35 : 0.62;
        this.facing += angleDiff(this.facing, cozyFacing) * Math.min(1, dt * 1.2);
      }
      this.neckStretch += (0.0 - this.neckStretch) * dt * 2.0;
      this.headPitch += (0.06 - this.headPitch) * dt * 1.6;
      this.chewAmount *= (1 - dt * 4);
      this.sniffAmount *= (1 - dt * 4);
    }

    _updateSoakIdle(dt, capybaras, yuzus, phaseInfo) {
      this.neckStretch += (0.0 - this.neckStretch) * Math.min(1, dt * 2.2);
      this.headPitch += (0.0 - this.headPitch) * Math.min(1, dt * 2.0);
      this.chewAmount *= (1 - dt * 4);
      this.sniffAmount *= (1 - dt * 4);

      // Slowly turn toward remembered favorite spot if waiting for food
      this.repositionTimer -= dt;
      if (this.repositionTimer <= 0) {
        this.repositionTimer = 6.5 + Math.random() * 8.0;
        if (this.favoriteSpot && this.inWater) {
          // Wait quietly facing the edge spot where it ate!
          this.targetFacing = Math.atan2(this.favoriteSpot.x - this.pos.x, this.favoriteSpot.z - this.pos.z);
        } else {
          // Subtle natural shift in facing angle ("お湯の中で少し体の向きを変えたり")
          this.targetFacing = this.facing + (Math.random() - 0.5) * 0.95;
        }
      }
      this.facing += angleDiff(this.facing, this.targetFacing) * Math.min(1, dt * 0.95);

      // Gentle drift toward favorite waiting side or home spot
      if (this.inWater && this.favoriteSpot && this.stateTimer > 3.0) {
        const cl = this.env.clampToPool(this.favoriteSpot.x * 0.72, this.favoriteSpot.z * 0.72, this.isBaby ? 0.25 : 0.34);
        const d = Math.hypot(cl.x - this.pos.x, cl.z - this.pos.z);
        if (d > 0.35 && d < 1.3) {
          this._moveToward(cl.x, cl.z, 0.14, dt);
        }
      }

      // Baby special natural behaviors: lean on adult's back OR stroll onto rim/platform and back
      if (this.isBaby) {
        this.roamTimer -= dt;
        if (this.roamTimer <= 0) {
          this.roamTimer = 18.0 + Math.random() * 14.0;
          if (!this.inWater) {
            // Return calmly back into the warm bath after resting on rim/platform
            this.returnToBath();
          } else if (phaseInfo && phaseInfo.platformUnlocked && Math.random() < 0.48) {
            this.goToPlatform();
          } else if (Math.random() < 0.45) {
            this.restingOnAdult = true;
            this.state = 'rest_on_adult';
            this.stateTimer = 0;
          } else {
            // Short calm stroll out onto the flat stone edge, then back into the water
            this.walkPath = [
              { x: 0.22, z: 1.05, y: 0.02, inWater: true },
              { x: 0.08, z: 1.32, y: this.env.frontEdgeY, inWater: false, onRim: true },
              { x: -0.26, z: 1.30, y: this.env.frontEdgeY, inWater: false, onRim: true },
              { x: 0.12, z: 0.92, y: -0.13, inWater: true },
              { x: this.homeSpot.x, z: this.homeSpot.y, y: -0.13, inWater: true }
            ];
            this.state = 'rim_stroll';
            this.stateTimer = 0;
          }
        }
      }
    }

    _applyArticulatedPose(dt) {
      // Neck & head stretch/pitch/sniff
      this.neckPivot.position.z = 0.34 + this.neckStretch * 0.10;
      this.neckPivot.rotation.x = this.neckStretch * 0.14 + this.headPitch * 0.35;

      const sniffNod = this.sniffAmount * Math.sin(this.time * 10.5) * 0.035;
      const idleSway = Math.sin(this.time * 0.65) * 0.035;
      this.headPivot.rotation.x = this.headPitch * 0.65 + sniffNod;
      this.headPivot.rotation.y = this.headYaw + idleSway;

      // Side-to-side chewing motion ("口をもぐもぐ横に動かし")
      if (this.biteFlash > 0) {
        this.biteFlash = Math.max(0, this.biteFlash - dt * 4.5);
      }
      const sideShift = Math.sin(this.chewPhase) * 0.016 * this.chewAmount;
      const jawOpen = (0.5 + 0.5 * Math.cos(this.chewPhase)) * 0.14 * this.chewAmount + this.biteFlash * 0.22;
      this.jawPivot.position.x = sideShift;
      this.jawPivot.rotation.x = jawOpen;
      this.jawPivot.rotation.z = sideShift * 2.2;

      // Eyelid rotation (half-closed to fully shut)
      for (let i = 0; i < this.eyelids.length; i++) {
        const lid = this.eyelids[i];
        // Upper lid rotates forward/down to cover the small dark eye
        lid.upper.rotation.x = -0.58 + this.eyelidClose * 0.96;
        lid.lower.rotation.x = 0.12 - this.eyelidClose * 0.32;
      }

      // Ear twitch animation
      const flick = this.earFlickPhase > 0 ? Math.sin(this.earFlickPhase * Math.PI * 6) * 0.42 * this.earFlickPhase : 0;
      this.leftEar.rotation.z = flick;
      this.rightEar.rotation.z = -flick * 0.9;

      // Gentle leg walk cycle when on stone/land, relaxed tucked when soaking
      const walking = !this.inWater && (this.state === 'enter_bath' || this.state === 'walk_to_platform' || this.state === 'walk_back_bath' || this.state === 'rim_stroll');
      for (let i = 0; i < this.legs.length; i++) {
        const leg = this.legs[i];
        if (walking) {
          const phase = this.walkCycle + (leg.isFront ? 0 : Math.PI) + (leg.side < 0 ? 0 : Math.PI);
          leg.pivot.rotation.x = Math.sin(phase) * 0.34;
        } else {
          leg.pivot.rotation.x += (0 - leg.pivot.rotation.x) * Math.min(1, dt * 4);
        }
      }
      // Subtle heavy waddle roll when walking on stone
      this.bodyPivot.rotation.z = walking ? Math.sin(this.walkCycle) * 0.045 : 0;
    }

    serialize() {
      return {
        id: this.id,
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        facing: this.facing,
        inWater: this.inWater,
        onPlatform: this.onPlatform,
        onRim: this.onRim,
        visible: this.visible,
        fullness: this.fullness,
        favoriteSpot: this.favoriteSpot,
        favoriteYuzuId: this.favoriteYuzuId
      };
    }

    restore(data) {
      if (!data) return;
      this.pos.set(data.x, data.y, data.z);
      this.facing = data.facing || 0;
      this.targetFacing = this.facing;
      this.inWater = data.inWater !== false;
      this.onPlatform = !!data.onPlatform;
      this.onRim = !!data.onRim;
      this.visible = data.visible !== false;
      this.root.visible = this.visible;
      this.fullness = data.fullness || 0;
      this.favoriteSpot = data.favoriteSpot || null;
      this.favoriteYuzuId = data.favoriteYuzuId || null;
      this.syncTransform();
    }
  }

  window.PokapokaCapybara = Capybara;
})();
