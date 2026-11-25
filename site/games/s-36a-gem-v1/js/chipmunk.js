(function (global) {
  'use strict';

  // Helper: add subtle warm backlit golden fur rim lighting via onBeforeCompile
  function applyFurRimShader(material, rimColorHex = 0xffe092, strength = 0.42) {
    material.onBeforeCompile = function (shader) {
      shader.uniforms.uRimColor = { value: new THREE.Color(rimColorHex) };
      shader.uniforms.uRimStrength = { value: strength };
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRimColor;
        uniform float uRimStrength;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `float furRim = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
        gl_FragColor.rgb += uRimColor * furRim * uRimStrength;
        #include <dithering_fragment>`
      );
    };
  }

  class Chipmunk {
    constructor(scene, world, audio, options = {}) {
      this.scene = scene;
      this.world = world;
      this.audio = audio;

      this.id = options.id || 0; // 0 = main chipmunk, 1 = smaller second chipmunk
      this.scale = options.scale || (this.id === 0 ? 1.0 : 0.86);
      this.visible = options.visible !== false;

      // Persistent & behavioral state
      this.pos = (options.startPos ? options.startPos.clone() : new THREE.Vector3(-0.04, world.STUMP_TOP_Y, 0.02));
      this.heading = options.heading !== undefined ? options.heading : 0.38;
      this.targetHeading = this.heading;

      this.cheekCount = 0; // 0..6 seeds stuffed in cheek pouches
      this.cheekItems = []; // ['seed', 'acorn', ...]
      this.cheekDisplay = 0; // smoothed visual cheek inflation

      this.shyness = this.id === 0 ? 0.0 : 1.0; // Chipmunk 2 starts shy (1.0 -> 0.0 as child feeds near it)
      this.trustFeeds = 0;
      this.totalEaten = 0;
      this.totalCached = 0;

      // State machine
      this.state = this.id === 0 ? 'IDLE_SIT' : 'HIDDEN';
      this.stateTimer = 0;
      this.stateDuration = 2.4;

      // Movement & locomotion
      this.moveTarget = null;
      this.movePath = [];
      this.moveSpeed = 0.88;
      this.scurryPhase = 0;
      this.stepAccum = 0;
      this.hopArc = null; // smooth jump arc between stump and ground

      // Food & interaction references
      this.targetFood = null;
      this.heldFood = null;
      this.targetCache = null;
      this.tugPartner = null;
      this.tugFood = null;
      this.lookTarget = null;
      this.nibbleAccum = 0;
      this.shardAccum = 0;
      this.digAccum = 0;

      // Animated pose blend parameters
      this.standAmount = this.id === 0 ? 0.46 : 0.32; // 0 = four paws / low crouch, 1 = upright on hind legs
      this.headPitch = 0;
      this.headYaw = 0;
      this.headTilt = 0; // cute side-to-side head tilt!
      this.noseTwitch = 0;
      this.eyeSquint = 0; // 0 = open glossy bead eye, 1 = gently narrowed sleepy eye
      this.blinkTimer = 2.5 + Math.random() * 3.0;
      this.blinkAmount = 0;
      this.tailCurl = 0; // 0 = natural S-curve upright/trailing, 1 = curled snug along back
      this.tailFlickEnergy = 0.35;
      this.groomPhase = 0;

      // Build 3D model
      this._buildModel();
      this.root.position.copy(this.pos);
      this.root.rotation.y = this.heading;
      this.root.visible = this.visible;
      this.scene.add(this.root);
    }

    _buildModel() {
      const FT = global.ForestTextures;
      const furTex = FT.createChipmunkFurTextures(this.id);
      const headTex = FT.createChipmunkHeadTexture(this.id);
      const tailPlumeTex = FT.createTailFurPlumeTexture(this.id);

      const furMat = new THREE.MeshStandardMaterial({
        map: furTex.map,
        bumpMap: furTex.bumpMap,
        bumpScale: 0.014,
        roughness: 0.86,
        metalness: 0.0,
      });
      applyFurRimShader(furMat, 0xffe296, 0.38);

      const headMat = new THREE.MeshStandardMaterial({
        map: headTex,
        bumpMap: furTex.bumpMap,
        bumpScale: 0.010,
        roughness: 0.84,
      });
      applyFurRimShader(headMat, 0xffe296, 0.34);

      const cheekMat = new THREE.MeshStandardMaterial({
        color: this.id === 0 ? 0xdac19e : 0xe2cca9,
        bumpMap: furTex.bumpMap,
        bumpScale: 0.008,
        roughness: 0.86,
      });
      applyFurRimShader(cheekMat, 0xffe6a6, 0.30);

      const pawMat = new THREE.MeshStandardMaterial({
        color: 0xc9a384,
        roughness: 0.78,
      });

      const earInnerMat = new THREE.MeshStandardMaterial({
        color: 0xd4a48a,
        roughness: 0.85,
      });

      const noseMat = new THREE.MeshStandardMaterial({
        color: 0x5c362e,
        roughness: 0.35,
      });

      // Small, glossy black bead eyes — authentic real chipmunk eyes (NEVER oversized or cartoonish!)
      const eyeMat = new THREE.MeshPhysicalMaterial({
        color: 0x0b0908,
        roughness: 0.04,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      });

      const eyeRingMat = new THREE.MeshStandardMaterial({
        color: 0xe6d6bc,
        roughness: 0.88,
      });

      // Outer golden backlit tail hair plume material
      const tailPlumeMat = new THREE.MeshStandardMaterial({
        map: tailPlumeTex,
        transparent: true,
        alphaTest: 0.08,
        roughness: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: new THREE.Color(0x9a6d28),
        emissiveIntensity: 0.24,
      });
      applyFurRimShader(tailPlumeMat, 0xffdf7e, 0.72);

      const tailCoreMat = new THREE.MeshStandardMaterial({
        color: this.id === 0 ? 0x8f5f3c : 0x9c6d48,
        roughness: 0.82,
      });
      applyFurRimShader(tailCoreMat, 0xffe188, 0.55);

      this.root = new THREE.Group();
      this.root.scale.setScalar(this.scale);

      // Pelvis / body pivot (allows pitching smoothly from four-legged scurry to upright sitting/standing!)
      this.bodyPivot = new THREE.Group();
      this.bodyPivot.position.set(0, 0.095, -0.02);
      this.root.add(this.bodyPivot);

      // Sculpted organic torso: oriented along Z (tail at -Z, chest at +Z)
      // Rotate UV mapping so dorsal stripe (u=0.5) runs cleanly along top back (+Y)!
      const torsoGeo = new THREE.SphereGeometry(0.105, 24, 20);
      torsoGeo.scale(0.84, 0.82, 1.48);
      // Adjust UVs so spine is centered at top (+Y) and stripes run along Z
      const tPos = torsoGeo.attributes.position;
      const tUv = torsoGeo.attributes.uv;
      for (let i = 0; i < tPos.count; i++) {
        const vx = tPos.getX(i);
        const vy = tPos.getY(i);
        const vz = tPos.getZ(i);
        // Symmetric angle around Z axis: top (+Y) maps to u=0.5, belly (-Y) maps to u=1.0 (zero UV seam!)
        const ang = Math.atan2(vx, vy); // 0 at +Y, +-PI at -Y
        const u = 0.5 + (Math.abs(ang) / (Math.PI * 2));
        const v = THREE.MathUtils.clamp((vz / 0.155 + 1) * 0.5, 0.02, 0.98);
        tUv.setXY(i, u, v);
      }
      tUv.needsUpdate = true;
      torsoGeo.computeVertexNormals();

      this.torsoMesh = new THREE.Mesh(torsoGeo, furMat);
      this.torsoMesh.position.set(0, 0.015, 0.02);
      this.torsoMesh.castShadow = true;
      this.torsoMesh.receiveShadow = true;
      this.bodyPivot.add(this.torsoMesh);

      // Rounded haunches (hindquarters)
      const haunchGeo = new THREE.SphereGeometry(0.088, 18, 14);
      haunchGeo.scale(0.96, 0.88, 1.05);
      const haunchMesh = new THREE.Mesh(haunchGeo, furMat);
      haunchMesh.position.set(0, 0.0, -0.055);
      haunchMesh.castShadow = true;
      haunchMesh.receiveShadow = true;
      this.bodyPivot.add(haunchMesh);

      // Chest fluff
      const chestMesh = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), cheekMat);
      chestMesh.scale.set(0.82, 0.78, 0.85);
      chestMesh.position.set(0, -0.012, 0.095);
      this.bodyPivot.add(chestMesh);

      // --- HEAD & NECK ---
      this.headPivot = new THREE.Group();
      this.headPivot.position.set(0, 0.062, 0.145);
      this.bodyPivot.add(this.headPivot);

      // Cranium
      const skullGeo = new THREE.SphereGeometry(0.068, 18, 16);
      skullGeo.scale(0.90, 0.84, 1.08);
      const skullMesh = new THREE.Mesh(skullGeo, headMat);
      skullMesh.position.set(0, 0.012, 0.018);
      skullMesh.castShadow = true;
      skullMesh.receiveShadow = true;
      this.headPivot.add(skullMesh);

      // Subtle facial dark-and-pale cheek stripes along sides of head
      const stripeDarkMat = new THREE.MeshStandardMaterial({ color: 0x452e1e, roughness: 0.88 });
      const stripeLightMat = new THREE.MeshStandardMaterial({ color: 0xe6d6bc, roughness: 0.88 });
      for (const side of [-1, 1]) {
        const browLight = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.036, 4, 8), stripeLightMat);
        browLight.rotation.x = Math.PI / 2 - 0.12;
        browLight.rotation.z = side * 0.16;
        browLight.position.set(side * 0.044, 0.036, 0.034);
        this.headPivot.add(browLight);

        const eyeStripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.042, 4, 8), stripeDarkMat);
        eyeStripe.rotation.x = Math.PI / 2;
        eyeStripe.position.set(side * 0.052, 0.018, 0.022);
        this.headPivot.add(eyeStripe);
      }

      // Pointed realistic chipmunk snout / muzzle
      const snoutGeo = new THREE.ConeGeometry(0.042, 0.082, 14);
      snoutGeo.rotateX(Math.PI / 2);
      const snoutMesh = new THREE.Mesh(snoutGeo, headMat);
      snoutMesh.scale.set(0.92, 0.78, 1.0);
      snoutMesh.position.set(0, 0.002, 0.078);
      snoutMesh.castShadow = true;
      this.headPivot.add(snoutMesh);

      // Twitching tiny pink-brown nose
      this.nosePivot = new THREE.Group();
      this.nosePivot.position.set(0, 0.005, 0.118);
      const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 10, 8), noseMat);
      noseMesh.scale.set(1.05, 0.82, 0.85);
      this.nosePivot.add(noseMesh);

      // Delicate fine whiskers (thin dark filaments)
      const whiskerMat = new THREE.MeshBasicMaterial({ color: 0x3b2c22, transparent: true, opacity: 0.55 });
      for (const side of [-1, 1]) {
        for (let w = 0; w < 3; w++) {
          const wg = new THREE.CylinderGeometry(0.0007, 0.0004, 0.046, 4);
          wg.rotateZ(Math.PI / 2);
          const wh = new THREE.Mesh(wg, whiskerMat);
          wh.position.set(side * 0.028, -0.003 + (w - 1) * 0.005, -0.012);
          wh.rotation.y = side * (-0.25 - w * 0.14);
          wh.rotation.z = side * (-0.12 + w * 0.1);
          this.nosePivot.add(wh);
        }
      }
      this.headPivot.add(this.nosePivot);

      // --- DEFORMABLE CHEEK POUCHES (ほお袋!) ---
      this.leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), cheekMat);
      this.leftCheek.position.set(-0.042, -0.012, 0.052);
      this.leftCheek.castShadow = true;
      this.leftCheek.receiveShadow = true;
      this.headPivot.add(this.leftCheek);

      this.rightCheek = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), cheekMat);
      this.rightCheek.position.set(0.042, -0.012, 0.052);
      this.rightCheek.castShadow = true;
      this.rightCheek.receiveShadow = true;
      this.headPivot.add(this.rightCheek);

      // Small glossy black realistic squirrel eyes + natural pale fur ring (NO cartoon/human features!)
      this.eyes = [];
      for (const side of [-1, 1]) {
        const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.0135, 0.0036, 6, 14), eyeRingMat);
        eyeRing.position.set(side * 0.049, 0.024, 0.048);
        eyeRing.rotation.y = side * 1.12;
        this.headPivot.add(eyeRing);

        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 10), eyeMat);
        eye.position.set(side * 0.050, 0.024, 0.049);
        eye.scale.set(0.85, 0.96, 0.96);
        this.headPivot.add(eye);
        this.eyes.push(eye);
      }

      // Rounded upright chipmunk ears
      this.ears = [];
      for (const side of [-1, 1]) {
        const earPivot = new THREE.Group();
        earPivot.position.set(side * 0.036, 0.056, -0.006);
        const outer = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), headMat);
        outer.scale.set(0.62, 1.28, 0.72);
        outer.position.y = 0.018;
        outer.castShadow = true;
        earPivot.add(outer);

        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), earInnerMat);
        inner.scale.set(0.55, 1.05, 0.45);
        inner.position.set(0, 0.016, 0.008);
        earPivot.add(inner);

        earPivot.rotation.z = -side * 0.22;
        earPivot.rotation.x = -0.12;
        this.headPivot.add(earPivot);
        this.ears.push(earPivot);
      }

      // Food mount point right between front paws / mouth when nibbling
      this.mouthHoldMount = new THREE.Group();
      this.mouthHoldMount.position.set(0, -0.048, 0.115);
      this.headPivot.add(this.mouthHoldMount);

      // --- FRONT ARMS & PAWS ---
      this.frontLegs = [];
      for (const side of [-1, 1]) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.054, -0.028, 0.095);

        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.048, 5, 8), headMat);
        arm.position.set(0, -0.026, 0.010);
        arm.rotation.x = -0.25;
        arm.castShadow = true;
        shoulder.add(arm);

        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), pawMat);
        paw.scale.set(0.95, 0.62, 1.25);
        paw.position.set(0, -0.058, 0.024);
        shoulder.add(paw);

        this.bodyPivot.add(shoulder);
        this.frontLegs.push(shoulder);
      }

      // --- HIND LEGS & FEET ---
      this.hindLegs = [];
      for (const side of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.068, 0.055, -0.065);

        const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.050, 12, 10), headMat);
        thigh.scale.set(0.75, 1.05, 1.15);
        thigh.castShadow = true;
        hip.add(thigh);

        const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.052, 4, 8), pawMat);
        foot.rotation.x = Math.PI / 2;
        foot.scale.set(0.9, 1.0, 0.52);
        foot.position.set(side * 0.005, -0.046, 0.036);
        foot.castShadow = true;
        hip.add(foot);

        this.root.add(hip);
        this.hindLegs.push(hip);
      }

      // --- 5-SEGMENT FLUFFY BACKLIT GOLDEN TAIL ---
      this.tailBase = new THREE.Group();
      this.tailBase.position.set(0, 0.032, -0.145);
      this.bodyPivot.add(this.tailBase);

      this.tailSegments = [];
      let parentSeg = this.tailBase;
      const segLengths = [0.072, 0.078, 0.080, 0.076, 0.068];
      const segWidths = [0.056, 0.082, 0.095, 0.088, 0.068];

      for (let i = 0; i < segLengths.length; i++) {
        const seg = new THREE.Group();
        if (i > 0) seg.position.set(0, 0, -segLengths[i - 1] * 0.84);
        parentSeg.add(seg);

        // Soft volumetric core
        const core = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.018 * (1 - i * 0.11), segLengths[i] * 0.72, 5, 8),
          tailCoreMat
        );
        core.rotation.x = Math.PI / 2;
        core.position.z = -segLengths[i] * 0.45;
        core.castShadow = true;
        seg.add(core);

        // 3 crossed layered hair-plume fin planes per segment so from EVERY camera angle individual hairs glow golden!
        const w = segWidths[i] * 2.15;
        const l = segLengths[i] * 1.65;
        const angles = [0, Math.PI / 3, (Math.PI * 2) / 3];
        for (const a of angles) {
          const plume = new THREE.Mesh(new THREE.PlaneGeometry(w, l), tailPlumeMat);
          plume.rotation.x = Math.PI / 2;
          plume.rotation.y = a;
          plume.position.z = -segLengths[i] * 0.48;
          seg.add(plume);
        }

        this.tailSegments.push(seg);
        parentSeg = seg;
      }

      // Invisible generous touch sphere on chipmunk
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(0, 0.14, 0.04);
      hit.userData.interactive = `chipmunk-${this.id}`;
      this.root.add(hit);
    }

    // Immediate alert reaction when a nut drops/rolls nearby ("音に後ろ足で立ち上がり、鼻をひくひくさせて首をかしげる")
    reactToSound(soundPos, foodItem = null) {
      if (this.state === 'HIDDEN') return;
      if (this.state === 'REST_TOGETHER') {
        this.wakeUp();
      }
      // Don't abruptly yank out of digging/caching or mid-tug
      if (this.state === 'DIG_CACHE' || this.state === 'SHARE_TUG') return;

      // Chipmunk 2 shy check: only approaches food placed reasonably close to it while shy
      if (this.id === 1 && this.shyness > 0.25) {
        const d = this.pos.distanceTo(soundPos);
        if (d > 1.35) {
          this.lookTarget = soundPos.clone();
          this.state = 'PEEK_SHY';
          this.stateTimer = 0;
          this.stateDuration = 2.6;
          return;
        }
      }

      this.lookTarget = soundPos.clone();
      // If currently eating, remember the new sound subtly without rushing
      if (this.state === 'PICK_EAT' && this.heldFood) {
        this.tailFlickEnergy = 0.85;
        return;
      }

      this.targetFood = foodItem;
      this.state = 'STAND_ALERT';
      this.stateTimer = 0;
      this.stateDuration = 0.68 + Math.random() * 0.28;
      this.tailFlickEnergy = 0.9;
    }

    wakeUp() {
      if (this.state === 'REST_TOGETHER') {
        this.state = 'STAND_ALERT';
        this.stateTimer = 0;
        this.stateDuration = 0.95;
        this.tailCurl = 0;
        this.eyeSquint = 0;
        this.audio.playChirp(this.id === 0 ? 1.0 : 1.16);
      }
    }

    setRestTogether(spotPos, faceHeading) {
      if (this.state === 'HIDDEN' || !this.visible) return;
      this._releaseHeldFood();
      this.moveTarget = spotPos.clone();
      this.restTargetPos = spotPos.clone();
      this.restTargetHeading = faceHeading;
      this.state = 'GO_REST';
      this.stateTimer = 0;
    }

    startTugWith(partner, food) {
      this._releaseHeldFood();
      this.tugPartner = partner;
      this.tugFood = food;
      this.targetFood = null;
      this.state = 'SHARE_TUG';
      this.stateTimer = 0;
      this.stateDuration = 2.3 + Math.random() * 0.8;
      this.audio.playChirp(this.id === 0 ? 1.02 : 1.18);
    }

    _releaseHeldFood() {
      if (this.heldFood && this.heldFood.mesh) {
        this.scene.attach(this.heldFood.mesh);
        this.heldFood.heldBy = null;
        this.heldFood = null;
      }
    }

    _moveToward(dest, dt, speed) {
      const dx = dest.x - this.pos.x;
      const dz = dest.z - this.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.04) {
        this.pos.x = dest.x;
        this.pos.z = dest.z;
        this.pos.y = this.world.getSurfaceHeight(this.pos.x, this.pos.z);
        return true;
      }

      this.targetHeading = Math.atan2(dx, dz);

      // Realistic stump-edge hop transition when stepping on or off the mossy stump!
      const currOnStump = this.world.isOnStump(this.pos.x, this.pos.z, -0.02);
      const step = Math.min(dist, speed * dt);
      const nx = this.pos.x + (dx / dist) * step;
      const nz = this.pos.z + (dz / dist) * step;
      const nextOnStump = this.world.isOnStump(nx, nz, -0.02);

      if (!this.hopArc && currOnStump !== nextOnStump) {
        // Launch a quick graceful hop between stump rim and forest floor
        const hopDist = Math.min(dist, 0.34);
        const endX = this.pos.x + (dx / dist) * hopDist;
        const endZ = this.pos.z + (dz / dist) * hopDist;
        this.hopArc = {
          start: this.pos.clone(),
          end: new THREE.Vector3(endX, this.world.getSurfaceHeight(endX, endZ), endZ),
          t: 0,
          dur: 0.28,
        };
        this.audio.playFootstep(!nextOnStump);
        return false;
      }

      this.pos.x = nx;
      this.pos.z = nz;
      const surfY = this.world.getSurfaceHeight(nx, nz);
      this.pos.y += (surfY - this.pos.y) * Math.min(1, dt * 16);

      // Realistic quick chipmunk scurry bounce & tiny footsteps
      this.scurryPhase += dt * (18 + speed * 8);
      this.stepAccum += dt * speed;
      if (this.stepAccum > 0.16) {
        this.stepAccum = 0;
        this.audio.playFootstep(!currOnStump);
      }
      return false;
    }

    update(dt, elapsed, ctx) {
      if (!this.visible || this.state === 'HIDDEN') return;

      this.stateTimer += dt;

      // Active jump arc between stump & ground
      if (this.hopArc) {
        this.hopArc.t += dt / this.hopArc.dur;
        const p = Math.min(1, this.hopArc.t);
        this.pos.lerpVectors(this.hopArc.start, this.hopArc.end, p);
        const peak = Math.max(this.hopArc.start.y, this.hopArc.end.y) + 0.18;
        this.pos.y += Math.sin(p * Math.PI) * (peak - Math.min(this.hopArc.start.y, this.hopArc.end.y) * 0.5) * 0.55;
        if (p >= 1) {
          this.pos.copy(this.hopArc.end);
          this.hopArc = null;
          this.audio.playFootstep(!this.world.isOnStump(this.pos.x, this.pos.z));
        }
        this._updateVisualRig(dt, elapsed, true);
        return;
      }

      let isMoving = false;
      let targetStand = 0.22;
      let targetHeadPitch = 0.0;
      let targetHeadTilt = 0.0;
      let targetHeadYaw = 0.0;
      let targetTailCurl = 0.0;
      let targetSquint = 0.0;

      // Check for loose food on stump/ground if idle
      const findBestFood = () => {
        let best = null;
        let bestScore = Infinity;
        for (const f of ctx.foods) {
          if (f.consumed || f.heldBy || f.beingDragged || f.inPouch) continue;
          const d = this.pos.distanceTo(f.pos);
          // Chipmunk 2 while shy only considers food placed near it (or not far up on stump)
          if (this.id === 1 && this.shyness > 0.28) {
            if (d > 1.25) continue;
          }
          // Prefer sunflower seeds when cheek-stuffing, and close food generally
          let score = d;
          if (f.kind === 'seed' && this.cheekCount > 0 && this.cheekCount < 5) score -= 0.45;
          if (f.wedgedInCrack) score -= 0.35;
          if (score < bestScore) {
            bestScore = score;
            best = f;
          }
        }
        return best;
      };

      switch (this.state) {
        case 'PEEK_SHY': {
          // Chipmunk 2 peeking cautiously from behind the mossy tree trunk
          targetStand = 0.35;
          targetHeadYaw = Math.sin(elapsed * 1.4) * 0.28;
          if (this.lookTarget) {
            this.targetHeading = Math.atan2(this.lookTarget.x - this.pos.x, this.lookTarget.z - this.pos.z);
          } else {
            this.targetHeading = Math.atan2(0 - this.pos.x, 0 - this.pos.z);
          }
          const nearFood = findBestFood();
          if (nearFood) {
            this.targetFood = nearFood;
            this.state = 'APPROACH_FOOD';
            this.stateTimer = 0;
          } else if (this.shyness <= 0.25 && this.stateTimer > 2.2) {
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 2.0;
          }
          break;
        }

        case 'IDLE_SIT': {
          targetStand = this.cheekCount >= 3 ? 0.62 : 0.28;
          // Alert natural freezes punctuated by quick head glances
          const glanceStep = Math.floor(elapsed * 0.85 + this.id * 3.1);
          targetHeadYaw = Math.sin(glanceStep * 2.7) * 0.42;
          // Signature adorable head tilt when cheeks are stuffed!
          if (this.cheekCount >= 2) {
            targetHeadTilt = Math.sin(elapsed * 1.35) * 0.30;
          }

          // Check if cheeks are full -> scurry down to cache!
          if (this.cheekCount >= 4 && this.stateTimer > 1.35) {
            const spot = ctx.pickCacheSpot(this);
            this.moveTarget = spot;
            this.state = 'GO_CACHE';
            this.stateTimer = 0;
            ctx.onStartCaching(this, spot);
            break;
          }

          // Check if there is uncovered/loose food waiting
          const nextFood = findBestFood();
          if (nextFood && this.stateTimer > 0.35) {
            this.targetFood = nextFood;
            this.lookTarget = nextFood.pos.clone();
            this.state = 'STAND_ALERT';
            this.stateTimer = 0;
            this.stateDuration = 0.55;
            break;
          }

          // Otherwise cycle through authentic natural chipmunk mannerisms!
          if (this.stateTimer > this.stateDuration) {
            const r = Math.random();
            if (this.cheekCount >= 2 && r < 0.48) {
              const spot = ctx.pickCacheSpot(this);
              this.moveTarget = spot;
              this.state = 'GO_CACHE';
              this.stateTimer = 0;
              ctx.onStartCaching(this, spot);
            } else if (ctx.caches.length > 0 && this.cheekCount === 0 && r < 0.24) {
              // Periodically return to a remembered cache to dig it up & re-hide!
              const cache = ctx.caches[Math.floor(Math.random() * ctx.caches.length)];
              if (cache && !cache.uncovered) {
                this.targetCache = cache;
                this.moveTarget = cache.pos.clone();
                this.state = 'RECACHE_FETCH';
                this.stateTimer = 0;
                break;
              }
            } else if (ctx.canPlayWithPartner(this) && r < 0.42) {
              this.state = 'PLAY_INTERACT';
              this.stateTimer = 0;
              this.stateDuration = 2.8;
              this.audio.playChirp(this.id === 0 ? 1.0 : 1.15);
              break;
            } else if (r < 0.56) {
              // Sit up and rapidly wash face with both paws ("前足で顔をくしくし洗う")
              this.state = 'GROOM_FACE';
              this.stateTimer = 0;
              this.stateDuration = 1.9 + Math.random() * 0.9;
            } else if (r < 0.78 && this.world.isOnStump(this.pos.x, this.pos.z)) {
              // Quick nimble lap around the mossy stump ("切り株の上を小走りで一周")
              const baseAng = Math.atan2(this.pos.z, this.pos.x);
              const dir = Math.random() < 0.5 ? 1 : -1;
              this.movePath = [];
              for (let k = 1; k <= 5; k++) {
                const a = baseAng + dir * (k * Math.PI * 0.4);
                const rad = 0.36 + (k % 2) * 0.10;
                this.movePath.push(new THREE.Vector3(Math.cos(a) * rad, this.world.STUMP_TOP_Y, Math.sin(a) * rad));
              }
              this.state = 'STUMP_LAP';
              this.stateTimer = 0;
            } else if (ctx.preferredSpot && r < 0.92 && this.id === 0) {
              // Wait expectantly near the spot where the child often gives treats!
              this.moveTarget = ctx.preferredSpot.clone();
              this.state = 'GO_WAIT_SPOT';
              this.stateTimer = 0;
            } else {
              // Stand alert on hind legs looking around
              this.state = 'STAND_ALERT';
              this.stateTimer = 0;
              this.stateDuration = 1.3 + Math.random() * 0.8;
            }
          }
          break;
        }

        case 'STAND_ALERT': {
          // Upright on hind legs, twitching nose, tilting head curiously
          targetStand = 0.96;
          targetHeadPitch = -0.10;
          targetHeadTilt = Math.sin(this.stateTimer * 3.2) * (this.cheekCount > 0 ? 0.32 : 0.22);
          this.noseTwitch = 1.0;

          if (this.lookTarget) {
            this.targetHeading = Math.atan2(this.lookTarget.x - this.pos.x, this.lookTarget.z - this.pos.z);
          }

          if (this.stateTimer > this.stateDuration) {
            if (this.targetFood && !this.targetFood.consumed && !this.targetFood.heldBy && !this.targetFood.beingDragged) {
              this.state = 'APPROACH_FOOD';
              this.stateTimer = 0;
            } else {
              this.state = 'IDLE_SIT';
              this.stateTimer = 0;
              this.stateDuration = 1.8 + Math.random() * 1.6;
            }
          }
          break;
        }

        case 'GROOM_FACE': {
          // Adorable quick front-paw face washing
          targetStand = 0.86;
          targetHeadPitch = 0.24;
          this.groomPhase += dt * 19;
          if (this.stateTimer > this.stateDuration) {
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 1.8 + Math.random() * 1.4;
          }
          break;
        }

        case 'STUMP_LAP': {
          targetStand = 0.04;
          if (!this.movePath || this.movePath.length === 0) {
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 1.6;
            break;
          }
          isMoving = true;
          const arrived = this._moveToward(this.movePath[0], dt, 0.92);
          if (arrived) {
            this.movePath.shift();
          }
          break;
        }

        case 'GO_WAIT_SPOT': {
          targetStand = 0.05;
          if (!this.moveTarget) {
            this.state = 'STAND_ALERT';
            this.stateTimer = 0;
            this.stateDuration = 2.0;
            break;
          }
          isMoving = true;
          if (this._moveToward(this.moveTarget, dt, 0.82)) {
            this.lookTarget = this.world.POUCH_POS.clone();
            this.state = 'STAND_ALERT';
            this.stateTimer = 0;
            this.stateDuration = 2.2;
          }
          break;
        }

        case 'APPROACH_FOOD': {
          const f = this.targetFood;
          if (!f || f.consumed || f.beingDragged || (f.heldBy && f.heldBy !== this)) {
            // If another chipmunk already grabbed the same acorn and we are right beside it -> emergent tug-of-war!
            if (f && f.kind === 'acorn' && f.heldBy && f.heldBy !== this && f.heldBy.state === 'PICK_EAT' && this.pos.distanceTo(f.pos) < 0.34) {
              const partner = f.heldBy;
              partner.startTugWith(this, f);
              this.startTugWith(partner, f);
              break;
            }
            this.targetFood = null;
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 1.2;
            break;
          }

          // Emergent simultaneous convergence on the same acorn!
          const other = ctx.getPartner(this);
          if (
            other &&
            other.visible &&
            other.state === 'APPROACH_FOOD' &&
            other.targetFood === f &&
            f.kind === 'acorn' &&
            this.pos.distanceTo(f.pos) < 0.28 &&
            other.pos.distanceTo(f.pos) < 0.34
          ) {
            this.startTugWith(other, f);
            other.startTugWith(this, f);
            break;
          }

          targetStand = 0.04;
          isMoving = true;
          const speed = this.id === 1 && this.shyness > 0.3 ? 0.56 : 0.96;
          const reachDist = f.wedgedInCrack ? 0.16 : 0.15;
          const dist = Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z);

          if (dist <= reachDist) {
            // Reached the food!
            this.targetHeading = Math.atan2(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
            if (this.id === 1) {
              this.trustFeeds++;
              this.shyness = Math.max(0, this.shyness - 0.36);
            }

            if (f.kind === 'seed' && this.cheekCount < 6) {
              // Sunflower seeds get swiftly stuffed into cheek pouches!
              this.heldFood = f;
              f.heldBy = this;
              this.mouthHoldMount.attach(f.mesh);
              f.mesh.position.set(0, 0, 0);
              this.state = 'STUFF_CHEEK';
              this.stateTimer = 0;
              this.stateDuration = 0.62;
            } else {
              // Pick up acorn or walnut with both paws (or brace around wedged walnut in stump crack!)
              this.heldFood = f;
              f.heldBy = this;
              if (!f.wedgedInCrack) {
                this.mouthHoldMount.attach(f.mesh);
                f.mesh.position.set(0, 0, 0);
              }
              this.state = 'PICK_EAT';
              this.stateTimer = 0;
              this.nibbleAccum = 0;
              this.shardAccum = 0;
              if (f.kind === 'walnut') {
                // Hard walnut takes much longer unless child helped wedge it into the stump crack!
                this.stateDuration = f.wedgedInCrack ? 3.2 : 7.8;
              } else {
                this.stateDuration = 3.4 + Math.random() * 0.9;
              }
            }
          } else {
            this._moveToward(f.pos, dt, speed);
          }
          break;
        }

        case 'STUFF_CHEEK': {
          // Sit up, pop sunflower seed into cheek pouch, then tilt head adorably!
          targetStand = 0.88;
          targetHeadPitch = this.stateTimer < 0.32 ? 0.18 : -0.05;
          targetHeadTilt = this.stateTimer >= 0.32 ? (this.cheekCount % 2 === 0 ? 0.34 : -0.34) : 0;

          if (this.heldFood && this.stateTimer > 0.30) {
            const f = this.heldFood;
            this.cheekCount = Math.min(6, this.cheekCount + 1);
            this.cheekItems.push(f.kind);
            ctx.consumeFood(f);
            this.heldFood = null;
            this.targetFood = null;
            this.audio.playCheekTuck();
            ctx.onCheekStuffed(this);
          }

          if (this.stateTimer > this.stateDuration + 0.55) {
            // Pause briefly with cute tilted head showing puffed cheeks, then check for more seeds or go cache
            const moreSeeds = ctx.foods.find(
              (f) => !f.consumed && !f.heldBy && !f.beingDragged && f.kind === 'seed' && this.pos.distanceTo(f.pos) < 1.6
            );
            if (moreSeeds && this.cheekCount < 5) {
              this.targetFood = moreSeeds;
              this.state = 'APPROACH_FOOD';
              this.stateTimer = 0;
            } else if (this.cheekCount >= 4) {
              const spot = ctx.pickCacheSpot(this);
              this.moveTarget = spot;
              this.state = 'GO_CACHE';
              this.stateTimer = 0;
              ctx.onStartCaching(this, spot);
            } else {
              this.state = 'IDLE_SIT';
              this.stateTimer = 0;
              this.stateDuration = 1.9;
            }
          }
          break;
        }

        case 'PICK_EAT': {
          const f = this.heldFood;
          if (!f || f.consumed) {
            this.heldFood = null;
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            break;
          }

          const isWalnut = f.kind === 'walnut';
          const isWedged = !!f.wedgedInCrack;

          if (isWedged) {
            // Brace paws low around the wedged walnut in the stump crack!
            targetStand = 0.28;
            targetHeadPitch = 0.38;
            this.targetHeading = Math.atan2(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
          } else {
            // Sit up holding the acorn/walnut with both front paws, spinning & turning it!
            targetStand = 0.90;
            targetHeadPitch = 0.16;
            const inspectPhase = this.stateTimer < (isWalnut ? 1.8 : 0.9);
            if (inspectPhase) {
              // Turning the nut around to find the best spot to gnaw ("くるくると回しながら殻の向きを確かめ")
              f.mesh.rotation.y += dt * (isWalnut ? 4.2 : 5.4);
              f.mesh.rotation.x += dt * (isWalnut ? 2.8 : 3.2);
              targetHeadTilt = Math.sin(this.stateTimer * 4.5) * 0.18;
            } else {
              // Fast tiny rotation + crisp nibbling
              f.mesh.rotation.y += dt * 1.4;
              f.mesh.position.y = Math.sin(this.stateTimer * 28) * 0.004;
            }
          }

          // Crisp nibbling audio & walnut shell shards!
          if (this.stateTimer > (isWalnut ? 1.1 : 0.7)) {
            this.nibbleAccum += dt;
            const nibbleInterval = isWalnut ? (isWedged ? 0.24 : 0.36) : 0.28;
            if (this.nibbleAccum >= nibbleInterval) {
              this.nibbleAccum = 0;
              this.audio.playNibble(isWalnut);
            }
            if (isWalnut) {
              this.shardAccum += dt;
              const shardInterval = isWedged ? 0.72 : 1.55;
              if (this.shardAccum >= shardInterval) {
                this.shardAccum = 0;
                const origin = isWedged ? f.pos : this.pos;
                ctx.spawnWalnutShard(origin);
              }
            }
          }

          // Finish eating (or crack open walnut!)
          if (this.stateTimer >= this.stateDuration) {
            if (isWalnut) {
              this.audio.playWalnutCrack();
              ctx.spawnWalnutShard(isWedged ? f.pos : this.pos);
              ctx.spawnWalnutShard(isWedged ? f.pos : this.pos);
            }
            // If it's an acorn and chipmunk still has cheek room & other food nearby, maybe tuck half or eat cleanly
            ctx.consumeFood(f);
            this.heldFood = null;
            this.targetFood = null;
            this.totalEaten++;
            ctx.onFoodFinished(this, f.kind, isWedged);

            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 1.6 + Math.random() * 1.1;
          }
          break;
        }

        case 'GO_CACHE': {
          targetStand = 0.05;
          isMoving = true;
          if (!this.moveTarget) {
            this.state = 'IDLE_SIT';
            break;
          }
          if (this._moveToward(this.moveTarget, dt, 0.94)) {
            this.state = 'DIG_CACHE';
            this.stateTimer = 0;
            this.stateDuration = 2.1;
            this.digAccum = 0;
          }
          break;
        }

        case 'DIG_CACHE': {
          // Phase 1: scratch/dig autumn leaves with front paws; Phase 2: spit out seeds; Phase 3: push dirt & leaves over with nose!
          targetStand = 0.08;
          if (this.stateTimer < 0.85) {
            targetHeadPitch = 0.42;
            this.groomPhase += dt * 24; // rapid digging paw motion
            this.digAccum += dt;
            if (this.digAccum > 0.24) {
              this.digAccum = 0;
              this.audio.playLeafRustle(0.15, 0.9);
            }
          } else if (this.stateTimer < 1.35) {
            // Emptying cheek pouches into the ground!
            targetHeadPitch = 0.34;
            if (this.cheekCount > 0) {
              this.cachedNow = (this.cachedNow || 0) + this.cheekCount;
              const items = this.cheekItems.slice();
              this.cheekCount = 0;
              this.cheekItems = [];
              ctx.createCacheAt(this.pos.clone(), items);
              this.totalCached++;
              this.audio.playCheekTuck();
            }
          } else {
            // Pushing soil & leaves back over with nose ("鼻で土をかぶせて隠します")
            targetHeadPitch = 0.36 + Math.sin(this.stateTimer * 14) * 0.14;
            this.digAccum += dt;
            if (this.digAccum > 0.32) {
              this.digAccum = 0;
              this.audio.playLeafRustle(0.13, 0.7);
            }
          }

          if (this.stateTimer >= this.stateDuration) {
            this.cachedNow = 0;
            // Scurry back up onto the mossy stump (unless child left food right down here!)
            const groundFood = findBestFood();
            if (groundFood && this.pos.distanceTo(groundFood.pos) < 1.1) {
              this.targetFood = groundFood;
              this.state = 'APPROACH_FOOD';
              this.stateTimer = 0;
            } else {
              this.moveTarget = new THREE.Vector3(
                (this.id === 0 ? -0.08 : 0.22) + (Math.random() - 0.5) * 0.24,
                this.world.STUMP_TOP_Y,
                (Math.random() - 0.5) * 0.24
              );
              this.state = 'RETURN_STUMP';
              this.stateTimer = 0;
            }
          }
          break;
        }

        case 'RECACHE_FETCH': {
          // Returning to a remembered cache to dig it up & hide it elsewhere!
          targetStand = 0.05;
          isMoving = true;
          if (!this.targetCache || this.targetCache.uncovered) {
            this.state = 'IDLE_SIT';
            break;
          }
          if (this._moveToward(this.targetCache.pos, dt, 0.88)) {
            this.audio.playLeafRustle(0.18, 0.85);
            const recovered = ctx.takeFromCache(this.targetCache);
            this.cheekCount = Math.min(6, this.cheekCount + Math.max(2, recovered.length));
            this.cheekItems.push(...(recovered.length ? recovered : ['seed', 'seed']));
            this.targetCache = null;
            // Pick a DIFFERENT cache spot to re-hide!
            const newSpot = ctx.pickCacheSpot(this, this.pos);
            this.moveTarget = newSpot;
            this.state = 'GO_CACHE';
            this.stateTimer = 0;
          }
          break;
        }

        case 'RETURN_STUMP': {
          targetStand = 0.04;
          isMoving = true;
          if (!this.moveTarget || this._moveToward(this.moveTarget, dt, 0.90)) {
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 1.8 + Math.random() * 1.2;
          }
          break;
        }

        case 'PLAY_INTERACT': {
          // Tail waving & playful short chase with the other chipmunk
          const partner = ctx.getPartner(this);
          if (!partner || !partner.visible) {
            this.state = 'IDLE_SIT';
            break;
          }
          this.tailFlickEnergy = 1.0;
          const d = this.pos.distanceTo(partner.pos);
          if (d > 0.42 && this.stateTimer < 1.8) {
            targetStand = 0.05;
            isMoving = true;
            const chasePt = partner.pos.clone().add(new THREE.Vector3(Math.cos(elapsed * 2) * 0.25, 0, Math.sin(elapsed * 2) * 0.25));
            this._moveToward(chasePt, dt, 0.96);
          } else {
            targetStand = 0.82;
            this.targetHeading = Math.atan2(partner.pos.x - this.pos.x, partner.pos.z - this.pos.z);
            targetHeadTilt = Math.sin(elapsed * 5) * 0.22;
          }
          if (this.stateTimer > this.stateDuration) {
            this.state = 'IDLE_SIT';
            this.stateTimer = 0;
            this.stateDuration = 2.0;
          }
          break;
        }

        case 'SHARE_TUG': {
          // Emergent two-chipmunk acorn spin & gentle tug-of-war!
          const partner = this.tugPartner;
          const f = this.tugFood;
          if (!partner || !f || f.consumed) {
            this.tugPartner = null;
            this.tugFood = null;
            this.state = 'IDLE_SIT';
            break;
          }
          targetStand = 0.78;
          this.targetHeading = Math.atan2(f.pos.x - this.pos.x, f.pos.z - this.pos.z);

          // Chipmunk 0 drives the shared acorn's spinning & bobbing between both pairs of paws
          if (this.id === 0) {
            const mid = this.pos.clone().add(partner.pos).multiplyScalar(0.5);
            f.pos.set(mid.x, Math.max(this.pos.y, partner.pos.y) + 0.13 + Math.sin(elapsed * 14) * 0.012, mid.z);
            f.mesh.position.copy(f.pos);
            f.mesh.rotation.y += dt * 7.5;
            f.mesh.rotation.z = Math.sin(elapsed * 12) * 0.4;
          }

          if (this.stateTimer >= this.stateDuration) {
            if (this.id === 0) {
              // Either hand to one chipmunk OR pop loose ("ころんと落ちて別々に拾います")
              const rollOut = Math.random() < 0.45;
              if (rollOut) {
                f.heldBy = null;
                f.vel.set((Math.random() - 0.5) * 0.75, 0.18, (Math.random() - 0.5) * 0.75);
                f.onGround = false;
                this.audio.playNutDrop('acorn', 0.85);
                this.state = 'STAND_ALERT';
                this.stateTimer = 0;
                this.stateDuration = 0.65;
                partner.state = 'STAND_ALERT';
                partner.stateTimer = 0;
                partner.stateDuration = 0.65;
              } else {
                const winner = this.cheekCount > partner.cheekCount ? partner : this;
                const loser = winner === this ? partner : this;
                winner.heldFood = f;
                f.heldBy = winner;
                winner.mouthHoldMount.attach(f.mesh);
                f.mesh.position.set(0, 0, 0);
                winner.state = 'PICK_EAT';
                winner.stateTimer = 0;
                winner.stateDuration = 3.2;
                loser.state = 'IDLE_SIT';
                loser.stateTimer = 0;
                loser.stateDuration = 1.4;
              }
              this.tugPartner = null;
              this.tugFood = null;
              partner.tugPartner = null;
              partner.tugFood = null;
            }
          }
          break;
        }

        case 'GO_REST': {
          targetStand = 0.06;
          isMoving = true;
          if (!this.restTargetPos || this._moveToward(this.restTargetPos, dt, 0.72)) {
            this.state = 'REST_TOGETHER';
            this.stateTimer = 0;
            // Keep cheeks just slightly puffed in contentment ("頬を少しだけふくらませたまま目を細めます")
            if (this.cheekCount < 1) {
              this.cheekCount = 1;
            }
          }
          break;
        }

        case 'REST_TOGETHER': {
          // 5-8 min serene ending: seated side-by-side on the stump, tail curled along back, eyes gently narrowed
          targetStand = 0.52;
          targetHeadPitch = 0.08;
          targetHeadTilt = this.id === 0 ? 0.08 : -0.08;
          targetTailCurl = 1.0;
          targetSquint = 0.68;
          if (this.restTargetHeading !== undefined) {
            this.targetHeading = this.restTargetHeading;
          }
          break;
        }
      }

      // Smoothly blend pose parameters
      this.standAmount += (targetStand - this.standAmount) * Math.min(1, dt * 8.0);
      this.headPitch += (targetHeadPitch - this.headPitch) * Math.min(1, dt * 8.0);
      this.headYaw += (targetHeadYaw - this.headYaw) * Math.min(1, dt * 7.0);
      this.headTilt += (targetHeadTilt - this.headTilt) * Math.min(1, dt * 7.5);
      this.tailCurl += (targetTailCurl - this.tailCurl) * Math.min(1, dt * 3.0);
      this.eyeSquint += (targetSquint - this.eyeSquint) * Math.min(1, dt * 2.5);
      this.noseTwitch = Math.max(0.28, this.noseTwitch - dt * 0.45);
      this.tailFlickEnergy = Math.max(0.24, this.tailFlickEnergy - dt * 0.35);

      this._updateVisualRig(dt, elapsed, isMoving);
    }

    _updateVisualRig(dt, elapsed, isMoving) {
      // Smooth heading turn
      let diff = this.targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 11.5);

      this.root.position.copy(this.pos);
      this.root.rotation.y = this.heading;

      // Subtle breathing + scurrying hop bounce
      const breathe = Math.sin(elapsed * 3.1 + this.id * 1.7) * 0.004;
      const bounce = isMoving ? Math.abs(Math.sin(this.scurryPhase)) * 0.022 : 0;

      // Body posture pitch: negative X rotates front upward onto hind legs!
      const standPitch = -this.standAmount * 0.78;
      this.bodyPivot.rotation.x = standPitch + (isMoving ? Math.sin(this.scurryPhase * 2) * 0.08 : 0);
      this.bodyPivot.position.y = 0.095 + this.standAmount * 0.048 + bounce + breathe;

      // Keep head level as body stands upright, plus expressive tilt & curious look
      this.headPivot.rotation.x = -standPitch * 0.82 + this.headPitch;
      this.headPivot.rotation.y = this.headYaw;
      this.headPivot.rotation.z = this.headTilt;

      // Natural nose twitch ("鼻をひくひく")
      const twitch = Math.sin(elapsed * 22 + this.id * 4) * 0.0045 * this.noseTwitch;
      this.nosePivot.position.y = 0.005 + twitch;
      this.nosePivot.rotation.x = twitch * 14;

      // Smoothly scale cheek pouches proportionally to stuffed seed count! ("置いた数だけ頬の大きさが変わります")
      const targetCheek = Math.min(6, this.cheekCount);
      this.cheekDisplay += (targetCheek - this.cheekDisplay) * Math.min(1, dt * 7.0);
      const puff = this.cheekDisplay; // 0 .. 6
      const cx = 0.58 + puff * 0.19;
      const cy = 0.56 + puff * 0.16;
      const cz = 0.62 + puff * 0.15;
      const offsetOut = 0.036 + puff * 0.0058;
      this.leftCheek.scale.set(cx, cy, cz);
      this.rightCheek.scale.set(cx, cy, cz);
      this.leftCheek.position.set(-offsetOut, -0.012 - puff * 0.0022, 0.052 + puff * 0.002);
      this.rightCheek.position.set(offsetOut, -0.012 - puff * 0.0022, 0.052 + puff * 0.002);

      // Subtle natural eye blink & sleepy narrowing (no human eyebrows!)
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkAmount = 1.0;
        this.blinkTimer = 2.6 + Math.random() * 3.8;
      }
      this.blinkAmount = Math.max(0, this.blinkAmount - dt * 11);
      const lidClose = Math.min(0.88, Math.max(this.eyeSquint, this.blinkAmount * 0.92));
      for (const eye of this.eyes) {
        eye.scale.y = 0.96 * (1 - lidClose * 0.72);
      }

      // Ears micro-perking
      const earPerk = Math.sin(elapsed * 2.5 + this.id) * 0.05;
      this.ears[0].rotation.z = 0.22 + earPerk;
      this.ears[1].rotation.z = -0.22 - earPerk;

      // Front paw articulation: scurrying, holding nut, grooming face, or digging leaves
      const holding = this.state === 'PICK_EAT' || this.state === 'STUFF_CHEEK' || this.state === 'SHARE_TUG';
      const grooming = this.state === 'GROOM_FACE';
      const digging = this.state === 'DIG_CACHE' && this.stateTimer < 0.85;

      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const arm = this.frontLegs[i];
        if (grooming) {
          // Rapid circular face-rubbing paws!
          arm.rotation.x = -1.15 + Math.sin(this.groomPhase + i * 1.4) * 0.34;
          arm.rotation.z = -side * (0.42 + Math.cos(this.groomPhase) * 0.14);
        } else if (digging) {
          arm.rotation.x = -0.35 + Math.sin(this.groomPhase + i * Math.PI) * 0.65;
          arm.rotation.z = 0;
        } else if (holding) {
          // Both paws tucked forward holding the nut near the mouth
          arm.rotation.x = -0.82 + Math.sin(elapsed * 18 + i) * 0.08;
          arm.rotation.z = -side * 0.34;
        } else if (isMoving) {
          arm.rotation.x = Math.sin(this.scurryPhase + i * Math.PI) * 0.68;
          arm.rotation.z = 0;
        } else {
          // Relaxed paws tucked neatly on chest when upright, or resting on stump when crouched
          arm.rotation.x = -this.standAmount * 0.58;
          arm.rotation.z = -side * this.standAmount * 0.18;
        }
      }

      // Hind legs scurry cycle
      for (let i = 0; i < 2; i++) {
        const leg = this.hindLegs[i];
        leg.rotation.x = isMoving ? -Math.sin(this.scurryPhase + i * Math.PI) * 0.58 : 0;
      }

      // Fluffy 5-segment tail animation: flicking ("ふるふる"), trailing when running, or curling snug over back when resting!
      const flick = Math.sin(elapsed * (6.2 + this.tailFlickEnergy * 6.0) + this.id * 2.1) * (0.14 + this.tailFlickEnergy * 0.16);
      const sway = Math.sin(elapsed * 2.4 + this.id) * 0.12;
      const basePitch = THREE.MathUtils.lerp(
        isMoving ? 0.25 : 0.72 + this.standAmount * 0.22,
        1.42, // curled snugly up & over the back when resting!
        this.tailCurl
      );

      for (let i = 0; i < this.tailSegments.length; i++) {
        const seg = this.tailSegments[i];
        if (i === 0) {
          seg.rotation.x = basePitch + flick * 0.35;
          seg.rotation.y = sway * (1 - this.tailCurl * 0.75);
        } else {
          // Natural S-curve when alert; tight cozy arch over back when resting
          const curveAlert = i < 3 ? 0.24 : -0.26;
          const curveRest = 0.34;
          seg.rotation.x = THREE.MathUtils.lerp(curveAlert, curveRest, this.tailCurl) + flick * (0.16 * i) * (1 - this.tailCurl * 0.8);
          seg.rotation.y = Math.sin(elapsed * 4.2 - i * 0.65 + this.id) * 0.12 * this.tailFlickEnergy * (1 - this.tailCurl * 0.85);
        }
      }
    }
  }

  global.Chipmunk = Chipmunk;
})(window);
