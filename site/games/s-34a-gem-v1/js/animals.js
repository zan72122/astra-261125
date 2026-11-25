(function () {
  'use strict';

  // Helper: create vertex-colored organic chick down geometry (soft cream belly -> warm egg-yolk back)
  function createChickBodyGeo() {
    const geo = new THREE.SphereGeometry(0.24, 24, 18);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cCream = new THREE.Color(0xfff7dc);
    const cYolk = new THREE.Color(0xf3cf6b);
    const cWarm = new THREE.Color(0xecc055);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Plump pear-shaped baby chick torso (+Z is forward chest, -Z is rounded rump)
      const nz = z / 0.24;
      const ny = y / 0.24;
      z *= 1.18;
      y *= 0.96;
      if (nz > 0) {
        // Gentle chest fullness
        y -= nz * 0.018;
        x *= 1.0 + nz * 0.04;
      } else {
        // Taper slightly toward short tail rump
        y += (-nz) * 0.032;
        x *= 1.0 - (-nz) * 0.14;
      }
      if (ny < 0) {
        // Soft round belly
        x *= 1.0 + (-ny) * 0.08;
      }
      pos.setXYZ(i, x, y, z);

      // Soft cream-to-egg-yolk gradient
      const topMix = THREE.MathUtils.clamp((ny + 0.55) / 1.45, 0, 1);
      tmp.copy(cCream).lerp(cYolk, topMix * 0.85);
      if (ny > 0.35 && nz < 0.2) tmp.lerp(cWarm, 0.28);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function createChickHeadGeo() {
    const geo = new THREE.SphereGeometry(0.172, 22, 16);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cCream = new THREE.Color(0xfff8e2);
    const cYolk = new THREE.Color(0xf5d678);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const ny = y / 0.172;
      const nz = z / 0.172;
      // Slightly fuller fluffy cheeks & gentle crown
      if (ny < 0.15) x *= 1.05;
      if (nz > 0.3) {
        x *= 0.94;
        y *= 0.96;
      }
      pos.setXYZ(i, x, y, z);

      const mix = THREE.MathUtils.clamp((ny + 0.5) / 1.35, 0, 1);
      tmp.copy(cCream).lerp(cYolk, mix * 0.78);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // Create backlit velvety downy chick material: soft cream-to-yolk with bright translucent white rim fuzz
  function createChickDownMaterial(tintHex, downBump) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: tintHex,
      vertexColors: true,
      bumpMap: downBump,
      bumpScale: 0.008,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 1.0,
      sheenRoughness: 0.62,
      sheenColor: new THREE.Color(0xfffef5)
    });

    // Subtle warm backlit rim translucency on downy edges
    mat.onBeforeCompile = function (shader) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        vec3 rimN = normalize(vNormal);
        vec3 rimV = normalize(vViewPosition);
        float fres = pow(1.0 - max(dot(rimN, rimV), 0.0), 2.5);
        gl_FragColor.rgb += vec3(0.32, 0.30, 0.22) * fres;
        #include <dithering_fragment>
        `
      );
    };
    return mat;
  }

  // =========================================================
  // MOTHER HEN (茶色いお母さんめんどり)
  // =========================================================
  class MotherHen {
    constructor(scene, env, sound) {
      this.scene = scene;
      this.env = env;
      this.sound = sound;
      this.root = new THREE.Group();
      this.homePos = new THREE.Vector3(-1.28, env.boxBounds.floorY + 0.01, -0.58);
      this.root.position.copy(this.homePos);
      this.root.rotation.y = 0.62;
      scene.add(this.root);

      const T = window.PiyoTextures;
      const featherTex = T.createHenFeatherTexture();
      this.featherMat = new THREE.MeshPhysicalMaterial({
        map: featherTex,
        color: 0xdca070,
        roughness: 0.84,
        sheen: 0.55,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color(0xffe2be)
      });
      this.darkFeatherMat = new THREE.MeshStandardMaterial({
        map: featherTex,
        color: 0x8f5634,
        roughness: 0.86
      });
      this.combMat = new THREE.MeshStandardMaterial({ color: 0xc94a3f, roughness: 0.58 });
      this.beakMat = new THREE.MeshStandardMaterial({ color: 0xd79f4a, roughness: 0.45 });
      this.legMat = new THREE.MeshStandardMaterial({ color: 0xc99248, roughness: 0.62 });
      this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x16110e, roughness: 0.12, metalness: 0.1 });

      this._buildModel();

      // Behavior state
      this.state = 'watch'; // 'watch' | 'call' | 'tidbit_pickup' | 'tidbit_carry' | 'fluff'
      this.stateTimer = 0;
      this.callCooldown = 14;
      this.tidbitGrain = null;
      this.tidbitTargetPos = new THREE.Vector3();
      this.tidbitChick = null;
      this.callPos = new THREE.Vector3(-0.62, env.boxBounds.floorY, -0.14);
      this.fluffAmount = 0;
      this.shelterAmount = 0;
      this.lookTarget = new THREE.Vector3(0.4, 0.35, 0.5);
      this.blinkTimer = 2.8;
      this.breathPhase = 0;
      this.justCalled = false;
    }

    _buildModel() {
      // Legs & sturdy scaled feet (visible up close at chick eye-level!)
      this.legsGroup = new THREE.Group();
      this.root.add(this.legsGroup);
      for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.24, 0.0, 0.08);
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.46, 10), this.legMat);
        shin.position.y = 0.24;
        shin.castShadow = true;
        leg.add(shin);

        // 3 front toes + 1 rear toe planted firmly on the straw
        for (const toeAng of [-0.42, 0, 0.42]) {
          const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.19, 4, 8), this.legMat);
          toe.rotation.x = Math.PI / 2;
          toe.rotation.z = -toeAng;
          toe.position.set(Math.sin(toeAng) * 0.11, 0.02, 0.11 * Math.cos(toeAng));
          toe.castShadow = true;
          leg.add(toe);
        }
        const backToe = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.09, 4, 8), this.legMat);
        backToe.rotation.x = Math.PI / 2;
        backToe.position.set(0, 0.02, -0.07);
        leg.add(backToe);

        this.legsGroup.add(leg);
      }

      // Main body pivot (breathes, squats slightly to shelter chicks, leans forward to peck)
      this.bodyPivot = new THREE.Group();
      this.bodyPivot.position.set(0, 0.62, 0);
      this.root.add(this.bodyPivot);

      const torsoGeo = new THREE.SphereGeometry(0.62, 26, 20);
      torsoGeo.scale(0.95, 0.86, 1.32);
      this.torso = new THREE.Mesh(torsoGeo, this.featherMat);
      this.torso.castShadow = true;
      this.torso.receiveShadow = true;
      this.bodyPivot.add(this.torso);

      // Soft warm breast & belly skirt feathers (where chicks tuck under!)
      const bellyGeo = new THREE.SphereGeometry(0.56, 20, 14);
      bellyGeo.scale(1.04, 0.64, 1.18);
      this.bellySkirt = new THREE.Mesh(bellyGeo, this.featherMat);
      this.bellySkirt.position.set(0, -0.22, 0.14);
      this.bellySkirt.castShadow = true;
      this.bellySkirt.receiveShadow = true;
      this.bodyPivot.add(this.bellySkirt);

      // Layered left & right folded wings (expand outward when fluffing or sheltering)
      this.wingL = this._makeWing(1);
      this.wingR = this._makeWing(-1);
      this.bodyPivot.add(this.wingL);
      this.bodyPivot.add(this.wingR);

      // Layered tail feather fan
      this.tailGroup = new THREE.Group();
      this.tailGroup.position.set(0, 0.16, -0.68);
      for (let i = -3; i <= 3; i++) {
        const fGeo = new THREE.ConeGeometry(0.11, 0.66 - Math.abs(i) * 0.04, 6);
        fGeo.scale(0.32, 1.0, 1.0);
        const feather = new THREE.Mesh(fGeo, Math.abs(i) > 1 ? this.darkFeatherMat : this.featherMat);
        feather.position.set(i * 0.065, 0.14, -0.14);
        feather.rotation.set(-0.68, i * 0.16, -i * 0.12);
        feather.castShadow = true;
        this.tailGroup.add(feather);
      }
      this.bodyPivot.add(this.tailGroup);

      // Articulated neck & head
      this.neckPivot = new THREE.Group();
      this.neckPivot.position.set(0, 0.24, 0.56);
      this.bodyPivot.add(this.neckPivot);

      const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.28, 0.48, 16), this.featherMat);
      neckMesh.position.set(0, 0.2, 0.08);
      neckMesh.rotation.x = 0.28;
      neckMesh.castShadow = true;
      this.neckPivot.add(neckMesh);

      this.headPivot = new THREE.Group();
      this.headPivot.position.set(0, 0.44, 0.17);
      this.neckPivot.add(this.headPivot);

      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), this.featherMat);
      headMesh.scale.set(0.92, 0.98, 1.1);
      headMesh.castShadow = true;
      this.headPivot.add(headMesh);

      // Natural soft red-coral comb (5 gentle lobes)
      const combGroup = new THREE.Group();
      combGroup.position.set(0, 0.18, 0.02);
      for (let i = 0; i < 5; i++) {
        const r = 0.042 + Math.sin((i / 4) * Math.PI) * 0.018;
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), this.combMat);
        lobe.scale.set(0.48, 1.3, 0.9);
        lobe.position.set(0, 0.02 + Math.sin((i / 4) * Math.PI) * 0.025, 0.08 - i * 0.045);
        combGroup.add(lobe);
      }
      this.headPivot.add(combGroup);

      // Small wattles beneath beak
      for (const s of [-1, 1]) {
        const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), this.combMat);
        wattle.scale.set(0.55, 1.35, 0.8);
        wattle.position.set(s * 0.032, -0.095, 0.14);
        this.headPivot.add(wattle);
      }

      // Eyes + blinking lids
      this.eyelids = [];
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), this.eyeMat);
        eye.position.set(s * 0.165, 0.035, 0.115);
        this.headPivot.add(eye);

        const lid = new THREE.Mesh(
          new THREE.SphereGeometry(0.031, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
          this.featherMat
        );
        lid.position.copy(eye.position);
        lid.rotation.x = -Math.PI * 0.5;
        this.headPivot.add(lid);
        this.eyelids.push(lid);
      }

      // Articulated curved beak (upper + lower)
      const upperGeo = new THREE.ConeGeometry(0.056, 0.21, 10);
      upperGeo.rotateX(Math.PI / 2);
      upperGeo.scale(0.82, 0.72, 1.0);
      this.upperBeak = new THREE.Mesh(upperGeo, this.beakMat);
      this.upperBeak.position.set(0, 0.005, 0.25);
      this.upperBeak.rotation.x = 0.14;
      this.headPivot.add(this.upperBeak);

      const lowerGeo = new THREE.ConeGeometry(0.044, 0.17, 10);
      lowerGeo.rotateX(Math.PI / 2);
      lowerGeo.scale(0.75, 0.55, 1.0);
      this.lowerBeak = new THREE.Mesh(lowerGeo, this.beakMat);
      this.lowerBeak.position.set(0, -0.026, 0.225);
      this.lowerBeak.rotation.x = 0.04;
      this.headPivot.add(this.lowerBeak);

      // Anchor point at beak tip for holding tidbitting millet grain
      this.beakTip = new THREE.Object3D();
      this.beakTip.position.set(0, -0.015, 0.34);
      this.headPivot.add(this.beakTip);

      // Generous invisible touch hit area for gentle petting/interaction
      this.hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.88, 12, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.hitMesh.position.set(0, 0.65, 0.05);
      this.hitMesh.userData.interactive = 'mother_hen';
      this.root.add(this.hitMesh);
    }

    _makeWing(side) {
      const g = new THREE.Group();
      g.position.set(side * 0.48, -0.02, 0.04);
      const wGeo = new THREE.SphereGeometry(0.46, 16, 12);
      wGeo.scale(0.36, 0.68, 1.24);
      const wing = new THREE.Mesh(wGeo, this.darkFeatherMat);
      wing.position.set(side * 0.06, -0.04, -0.08);
      wing.castShadow = true;
      wing.receiveShadow = true;
      g.add(wing);
      return g;
    }

    getShelterSlot(index) {
      // Positions nestled right under Mother Hen's warm belly/breast feathers
      const localSlots = [
        new THREE.Vector3(-0.22, 0.0, 0.34),
        new THREE.Vector3(0.06, 0.0, 0.42),
        new THREE.Vector3(0.30, 0.0, 0.30)
      ];
      const p = localSlots[index % 3].clone();
      this.root.localToWorld(p);
      p.y = this.env.boxBounds.floorY + 0.01;
      return p;
    }

    getFrontFeedSpot() {
      const p = new THREE.Vector3(0.0, 0.0, 0.92);
      this.root.localToWorld(p);
      p.y = this.env.boxBounds.floorY + 0.01;
      return p;
    }

    startCalling(spot) {
      if (this.state !== 'watch') return;
      this.state = 'call';
      this.stateTimer = 0;
      this.callPos.copy(spot || this.getFrontFeedSpot());
      this.sound.playHenCluck('call');
      this.justCalled = true;
    }

    startTidbitTransfer(grain, chick) {
      if (this.state !== 'watch' && this.state !== 'call') return false;
      this.state = 'tidbit_pickup';
      this.stateTimer = 0;
      this.tidbitGrain = grain;
      this.tidbitChick = chick;
      grain.reservedBy = 99; // Reserved by Mother Hen
      return true;
    }

    playSatisfiedFluff() {
      this.state = 'fluff';
      this.stateTimer = 0;
      this.sound.playHenCluck('fluff');
    }

    setHighlight(s) {
      const em = s * 0.22;
      this.beakMat.emissive.setRGB(em, em * 0.78, em * 0.32);
    }

    update(dt, elapsed, chicks) {
      this.breathPhase += dt * 1.9;
      this.stateTimer += dt;
      this.justCalled = false;

      // Count how many chicks are tucked beneath her belly
      let tuckedCount = 0;
      for (const c of chicks) {
        if (c.isTuckedUnderHen()) tuckedCount++;
      }
      const targetShelter = tuckedCount > 0 ? Math.min(1, 0.45 + tuckedCount * 0.22) : 0;
      this.shelterAmount += (targetShelter - this.shelterAmount) * Math.min(1, dt * 3.5);

      // Gentle blinking
      this.blinkTimer -= dt;
      let lidClose = 0;
      if (this.blinkTimer < 0) {
        if (this.blinkTimer > -0.16) lidClose = Math.sin(((this.blinkTimer + 0.16) / 0.16) * Math.PI);
        else this.blinkTimer = 2.6 + Math.random() * 3.4;
      }
      if (tuckedCount === 3) lidClose = Math.max(lidClose, 0.45);
      for (const lid of this.eyelids) {
        lid.rotation.x = -Math.PI * 0.5 + lidClose * 0.85;
      }

      // Base body posture: lowers softly when sheltering chicks
      const squat = this.shelterAmount * 0.14;
      const breath = Math.sin(this.breathPhase) * 0.018;
      this.bodyPivot.position.y = 0.62 - squat + breath;

      let targetNeckPitch = 0.04;
      let targetHeadPitch = 0.0;
      let targetNeckYaw = 0.0;
      let targetFluff = this.shelterAmount * 0.55;
      let beakOpen = 0;

      if (this.state === 'watch') {
        // Look gently toward the lookTarget
        const localLook = this.root.worldToLocal(this.lookTarget.clone());
        targetNeckYaw = THREE.MathUtils.clamp(Math.atan2(localLook.x, Math.max(0.2, localLook.z)) * 0.55, -0.65, 0.65);
        targetHeadPitch = THREE.MathUtils.clamp((0.9 - localLook.y) * 0.22, -0.18, 0.32);
      } else if (this.state === 'call') {
        // Gentle tidbitting ground-pecking ("とんとん" calling chicks!)
        const localSpot = this.root.worldToLocal(this.callPos.clone());
        targetNeckYaw = THREE.MathUtils.clamp(Math.atan2(localSpot.x, Math.max(0.2, localSpot.z)) * 0.7, -0.65, 0.65);
        const peckWave = Math.sin(this.stateTimer * 9.2);
        targetNeckPitch = 0.78 + Math.max(0, peckWave) * 0.34;
        targetHeadPitch = 0.35 + Math.max(0, peckWave) * 0.25;
        if (Math.abs(peckWave - 0.95) < 0.08 && Math.floor(this.stateTimer * 12) % 3 === 0) {
          this.sound.playHenCluck('tap');
        }
        if (this.stateTimer > 2.2) {
          this.state = 'watch';
          this.stateTimer = 0;
        }
      } else if (this.state === 'tidbit_pickup') {
        const g = this.tidbitGrain;
        if (!g || !g.active) {
          this.state = 'watch';
        } else {
          const gp = new THREE.Vector3(g.x, g.y, g.z);
          const localG = this.root.worldToLocal(gp);
          targetNeckYaw = THREE.MathUtils.clamp(Math.atan2(localG.x, Math.max(0.2, localG.z)) * 0.85, -0.8, 0.8);
          const p = Math.min(1, this.stateTimer / 0.52);
          targetNeckPitch = p * 1.05;
          targetHeadPitch = p * 0.42;
          beakOpen = p > 0.65 ? 0.18 : 0.0;
          if (this.stateTimer >= 0.55) {
            g.state = 'carried_hen';
            this.sound.playHenCluck('call');
            this.state = 'tidbit_carry';
            this.stateTimer = 0;
            // Choose spot right in front of the nearest chick
            if (this.tidbitChick) {
              const cp = this.tidbitChick.pos;
              const toHen = new THREE.Vector3().subVectors(this.homePos, cp).normalize();
              this.tidbitTargetPos.set(
                THREE.MathUtils.clamp(cp.x + toHen.x * 0.26, -1.2, 0.6),
                this.env.boxBounds.floorY + 0.03,
                THREE.MathUtils.clamp(cp.z + toHen.z * 0.26, -0.4, 0.9)
              );
            } else {
              this.tidbitTargetPos.copy(this.getFrontFeedSpot());
            }
          }
        }
      } else if (this.state === 'tidbit_carry') {
        const g = this.tidbitGrain;
        if (!g || !g.active) {
          this.state = 'watch';
        } else {
          const localT = this.root.worldToLocal(this.tidbitTargetPos.clone());
          targetNeckYaw = THREE.MathUtils.clamp(Math.atan2(localT.x, Math.max(0.2, localT.z)) * 0.85, -0.85, 0.85);
          if (this.stateTimer < 0.45) {
            // Lift head briefly with grain in beak so child clearly sees her holding it!
            targetNeckPitch = 0.28;
            targetHeadPitch = 0.12;
          } else {
            // Lean down and gently place it in front of the chick
            const dp = Math.min(1, (this.stateTimer - 0.45) / 0.45);
            targetNeckPitch = 0.28 + dp * 0.78;
            targetHeadPitch = 0.12 + dp * 0.34;
          }
          const tip = new THREE.Vector3();
          this.beakTip.getWorldPosition(tip);
          g.x = tip.x;
          g.y = tip.y;
          g.z = tip.z;

          if (this.stateTimer >= 0.95) {
            g.x = this.tidbitTargetPos.x;
            g.y = this.env.boxBounds.floorY + 0.032;
            g.z = this.tidbitTargetPos.z;
            g.state = 'settled';
            g.buried = false;
            g.giftedByHen = true;
            g.reservedBy = -1;
            g.age = 0;
            this.sound.playGrainLand('straw');
            this.tidbitGrain = null;
            this.state = 'watch';
            this.stateTimer = 0;
          }
        }
      } else if (this.state === 'fluff') {
        // Content feather fluff!
        const pulse = Math.sin(Math.min(1, this.stateTimer / 1.45) * Math.PI);
        const shake = Math.sin(this.stateTimer * 26) * 0.08 * pulse;
        targetFluff = Math.max(targetFluff, pulse * 1.15);
        this.bodyPivot.rotation.z = shake;
        targetNeckPitch = -0.05;
        if (this.stateTimer > 1.5) {
          this.bodyPivot.rotation.z = 0;
          this.state = 'watch';
          this.stateTimer = 0;
        }
      }

      // Smooth interpolation of neck, head, fluff, and wings
      this.neckPivot.rotation.x += (targetNeckPitch - this.neckPivot.rotation.x) * Math.min(1, dt * 8);
      this.neckPivot.rotation.y += (targetNeckYaw - this.neckPivot.rotation.y) * Math.min(1, dt * 6);
      this.headPivot.rotation.x += (targetHeadPitch - this.headPivot.rotation.x) * Math.min(1, dt * 8);
      this.lowerBeak.rotation.x = 0.04 + beakOpen;

      this.fluffAmount += (targetFluff - this.fluffAmount) * Math.min(1, dt * 6);
      const fs = 1.0 + this.fluffAmount * 0.14;
      this.torso.scale.set(0.95 * fs, 0.86 * (1 + this.fluffAmount * 0.09), 1.32 * (1 + this.fluffAmount * 0.06));
      this.bellySkirt.scale.set(1.04 + this.shelterAmount * 0.16, 0.64 + this.shelterAmount * 0.14, 1.18 + this.shelterAmount * 0.1);
      this.wingL.rotation.z = -(0.08 + this.fluffAmount * 0.28);
      this.wingR.rotation.z = (0.08 + this.fluffAmount * 0.28);
      this.wingL.position.x = 0.48 + this.fluffAmount * 0.08;
      this.wingR.position.x = -0.48 - this.fluffAmount * 0.08;
    }
  }

  // =========================================================
  // FLUFFY BABY CHICK (ふわふわの黄色いひよこ)
  // =========================================================
  class Chick {
    constructor(index, startPos, scene, env, sound, downBump, sharedGeos) {
      this.index = index;
      this.scene = scene;
      this.env = env;
      this.sound = sound;

      // Subtle distinct personality & soft plumage tone per chick
      const profiles = [
        { tint: 0xfff8dc, curiosity: 1.0, speed: 1.48, scale: 1.02 }, // Chick 0: most curious, pale cream-yellow
        { tint: 0xfde8a6, curiosity: 0.74, speed: 1.36, scale: 0.99 }, // Chick 1: warm yolk-yellow, playful chaser
        { tint: 0xfbe096, curiosity: 0.55, speed: 1.24, scale: 1.04 }  // Chick 2: extra fluffy & cozy near Mother Hen
      ];
      this.profile = profiles[index % 3];

      this.root = new THREE.Group();
      this.pos = startPos.clone();
      this.root.position.copy(this.pos);
      scene.add(this.root);

      this.facing = index === 0 ? 0.45 : index === 1 ? -0.25 : 0.92;
      this.root.rotation.y = this.facing;

      this.downMat = createChickDownMaterial(this.profile.tint, downBump);
      this.beakMat = new THREE.MeshStandardMaterial({ color: 0xe6a664, roughness: 0.46 });
      this.legMat = new THREE.MeshStandardMaterial({ color: 0xdca06c, roughness: 0.58 });
      this.eyeMat = new THREE.MeshPhysicalMaterial({
        color: 0x110e0c,
        roughness: 0.06,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04
      });

      this._buildModel(sharedGeos);

      // State machine & memory
      this.state = 'idle';
      // States: 'idle', 'doze_one_leg', 'stretch_wing', 'scratch_straw', 'tuck_under_hen',
      //         'head_cock', 'walk_to', 'peck_grain', 'chase_leaf', 'carry_leaf', 'tug_leaf',
      //         'nibble_leaf', 'drink_water', 'sleep_full'
      this.stateTimer = 0;
      this.idleDuration = 1.6 + index * 0.9;
      this.targetPos = this.pos.clone();
      this.targetGrain = null;
      this.targetLeaf = null;
      this.nextStateAfterWalk = 'idle';
      this.stepPhase = index * 1.7;
      this.breathPhase = index * 2.1;
      this.tailTwitch = 0;
      this.headCockAngle = 0;
      this.blinkTimer = 1.8 + index * 1.1;
      this.fullness = 0.0; // 0..1 (rounds belly & slows pace gently; >= 0.92 triggers cozy nap)
      this.thirst = 0.0;   // rises as chick eats dry millet
      this.drowsy = false;
      this.pecksDone = 0;
      this.memory = { dish_center: 0, straw_edge: 0, straw_left: 0, hen_front: 0, outdoor_dish: 0 };
      this.lastEatenZone = 'dish_center';
      this.expectantTimer = 0;
      this.inHenCallDetour = false;
      this.deferredTarget = null;
    }

    _buildModel(geos) {
      const s = this.profile.scale;
      this.scaleGroup = new THREE.Group();
      this.scaleGroup.scale.setScalar(s);
      this.root.add(this.scaleGroup);

      // Legs (left & right articulated from hip so chick can walk briskly, scratch straw, or tuck 1 leg to doze!)
      this.legL = this._makeLeg(0.082);
      this.legR = this._makeLeg(-0.082);
      this.scaleGroup.add(this.legL);
      this.scaleGroup.add(this.legR);

      // Body pivot
      this.bodyPivot = new THREE.Group();
      this.bodyPivot.position.set(0, 0.34, 0);
      this.scaleGroup.add(this.bodyPivot);

      this.torsoMesh = new THREE.Mesh(geos.body, this.downMat);
      this.torsoMesh.castShadow = true;
      this.torsoMesh.receiveShadow = true;
      this.bodyPivot.add(this.torsoMesh);

      // Subtle downy tufts along back & rump silhouette for genuine soft fuzziness
      const tuftGeo = new THREE.SphereGeometry(0.068, 8, 6);
      const tuftCoords = [
        [0, 0.19, -0.11, 1.1], [0.11, 0.14, -0.05, 0.95], [-0.11, 0.14, -0.05, 0.95],
        [0, 0.12, -0.22, 1.0], [0.15, 0.02, 0.06, 0.9], [-0.15, 0.02, 0.06, 0.9]
      ];
      for (const tc of tuftCoords) {
        const t = new THREE.Mesh(tuftGeo, this.downMat);
        t.position.set(tc[0], tc[1], tc[2]);
        t.scale.setScalar(tc[3]);
        this.bodyPivot.add(t);
      }

      // Short fuzzy tail tuft (短い尾羽 - twitches briskly on every peck!)
      this.tailPivot = new THREE.Group();
      this.tailPivot.position.set(0, 0.07, -0.25);
      const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.12, 8), this.downMat);
      tailCone.rotation.x = -Math.PI * 0.42;
      tailCone.position.set(0, 0.02, -0.04);
      tailCone.castShadow = true;
      this.tailPivot.add(tailCone);
      this.bodyPivot.add(this.tailPivot);

      // Stubby little downy wings (spread & flap delicately when stretching!)
      this.wingL = this._makeWing(1);
      this.wingR = this._makeWing(-1);
      this.bodyPivot.add(this.wingL);
      this.bodyPivot.add(this.wingR);

      // Articulated neck & head
      this.neckPivot = new THREE.Group();
      this.neckPivot.position.set(0, 0.13, 0.15);
      this.bodyPivot.add(this.neckPivot);

      this.headPivot = new THREE.Group();
      this.headPivot.position.set(0, 0.15, 0.055);
      this.neckPivot.add(this.headPivot);

      this.headMesh = new THREE.Mesh(geos.head, this.downMat);
      this.headMesh.castShadow = true;
      this.headMesh.receiveShadow = true;
      this.headPivot.add(this.headMesh);

      // Soft crown down tuft
      const crownTuft = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), this.downMat);
      crownTuft.position.set(0, 0.145, -0.01);
      crownTuft.scale.set(1.1, 0.75, 1.15);
      this.headPivot.add(crownTuft);

      // Real baby-chick eyes: small glossy black bead dots (小さな黒いつぶらな点, NOT oversized!)
      this.eyelids = [];
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), this.eyeMat);
        eye.position.set(side * 0.134, 0.028, 0.106);
        this.headPivot.add(eye);

        // Soft downy eyelid for natural blinks & cozy sleeping
        const lid = new THREE.Mesh(
          new THREE.SphereGeometry(0.0275, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
          this.downMat
        );
        lid.position.copy(eye.position);
        lid.rotation.x = -Math.PI * 0.54;
        this.headPivot.add(lid);
        this.eyelids.push(lid);
      }

      // Tiny pointed upper & lower beak
      const ubGeo = new THREE.ConeGeometry(0.036, 0.115, 8);
      ubGeo.rotateX(Math.PI / 2);
      ubGeo.scale(0.86, 0.66, 1.0);
      this.upperBeak = new THREE.Mesh(ubGeo, this.beakMat);
      this.upperBeak.position.set(0, -0.008, 0.196);
      this.upperBeak.rotation.x = 0.08;
      this.headPivot.add(this.upperBeak);

      const lbGeo = new THREE.ConeGeometry(0.028, 0.095, 8);
      lbGeo.rotateX(Math.PI / 2);
      lbGeo.scale(0.76, 0.52, 1.0);
      this.lowerBeak = new THREE.Mesh(lbGeo, this.beakMat);
      this.lowerBeak.position.set(0, -0.028, 0.184);
      this.headPivot.add(this.lowerBeak);

      // Beak tip anchor for carrying/tugging chickweed leaf
      this.beakAnchor = new THREE.Object3D();
      this.beakAnchor.position.set(0, -0.018, 0.255);
      this.headPivot.add(this.beakAnchor);

      // Gentle tap hit volume
      this.hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.hitMesh.position.set(0, 0.36, 0.04);
      this.hitMesh.userData.interactive = 'chick';
      this.hitMesh.userData.chickIndex = this.index;
      this.scaleGroup.add(this.hitMesh);
    }

    _makeLeg(xOff) {
      const hip = new THREE.Group();
      hip.position.set(xOff, 0.24, 0.01);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.23, 8), this.legMat);
      shin.position.y = -0.115;
      shin.castShadow = true;
      hip.add(shin);

      const foot = new THREE.Group();
      foot.position.set(0, -0.228, 0);
      for (const ang of [-0.46, 0, 0.46]) {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.095, 4, 6), this.legMat);
        toe.rotation.x = Math.PI / 2;
        toe.rotation.z = -ang;
        toe.position.set(Math.sin(ang) * 0.056, 0.008, Math.cos(ang) * 0.056);
        foot.add(toe);
      }
      const rear = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.042, 4, 6), this.legMat);
      rear.rotation.x = Math.PI / 2;
      rear.position.set(0, 0.008, -0.032);
      foot.add(rear);

      hip.add(foot);
      return hip;
    }

    _makeWing(side) {
      const p = new THREE.Group();
      p.position.set(side * 0.21, 0.04, 0.02);
      const geo = new THREE.SphereGeometry(0.135, 12, 10);
      geo.scale(0.38, 0.68, 1.18);
      const m = new THREE.Mesh(geo, this.downMat);
      m.position.set(side * 0.02, -0.02, -0.05);
      m.castShadow = true;
      p.add(m);
      return p;
    }

    isTuckedUnderHen() {
      return this.state === 'tuck_under_hen' || this.state === 'sleep_full';
    }

    isOutside() {
      return this.pos.x > 3.22;
    }

    getFavoriteZone() {
      let best = 'dish_center';
      let bestVal = 0.5;
      for (const k in this.memory) {
        if (this.memory[k] > bestVal) {
          bestVal = this.memory[k];
          best = k;
        }
      }
      return best;
    }

    // Command chick to react to a sound/grain with authentic head-cock then short brisk steps
    directToGrain(grain, delayCock) {
      if (this.state === 'sleep_full' || this.state === 'carry_leaf' || this.state === 'tug_leaf') return;
      if (this.targetGrain && this.targetGrain.reservedBy === this.index) {
        this.targetGrain.reservedBy = -1;
      }
      this.targetGrain = grain;
      grain.reservedBy = this.index;
      this.targetPos.set(grain.x, this.pos.y, grain.z);
      this.nextStateAfterWalk = 'peck_grain';
      if (delayCock) {
        this.state = 'head_cock';
        this.stateTimer = 0;
        this.headCockAngle = (Math.random() < 0.5 ? 1 : -1) * (0.34 + Math.random() * 0.14);
      } else {
        this.state = 'walk_to';
        this.stateTimer = 0;
      }
    }

    directToPosition(pos, nextState) {
      this.targetPos.copy(pos);
      this.nextStateAfterWalk = nextState || 'idle';
      this.state = 'walk_to';
      this.stateTimer = 0;
    }

    directToLeaf(leaf) {
      if (this.state === 'sleep_full') return;
      this.targetLeaf = leaf;
      this.targetPos.set(leaf.x, this.pos.y, leaf.z);
      this.nextStateAfterWalk = 'grab_leaf';
      this.state = 'walk_to';
      this.stateTimer = 0;
    }

    directToWater(waterPos) {
      if (this.state === 'sleep_full' || this.state === 'carry_leaf' || this.state === 'tug_leaf') return;
      // Stand right at rim of ceramic water dish
      const ang = Math.atan2(this.pos.z - waterPos.z, this.pos.x - waterPos.x);
      const standX = waterPos.x + Math.cos(ang) * 0.56;
      const standZ = THREE.MathUtils.clamp(waterPos.z + Math.sin(ang) * 0.56, -1.2, 1.85);
      this.targetPos.set(standX, this.pos.y, standZ);
      this.waterTarget = waterPos.clone();
      this.nextStateAfterWalk = 'drink_water';
      this.state = 'walk_to';
      this.stateTimer = 0;
    }

    wakeUpGentle() {
      if (this.state === 'sleep_full' || this.state === 'tuck_under_hen' || this.state === 'doze_one_leg') {
        this.fullness = Math.min(this.fullness, 0.25);
        this.drowsy = false;
        this.state = 'head_cock';
        this.stateTimer = 0;
        this.headCockAngle = 0.36;
        // Step slightly out from Mother Hen's belly
        this.targetPos.set(-0.35 + this.index * 0.38, this.env.boxBounds.floorY + 0.01, 0.48 + this.index * 0.14);
        this.nextStateAfterWalk = 'idle';
        this.sound.playChirp(this.index, 'happy');
      }
    }

    _canCrossDoorway(doorOpenAmount) {
      return doorOpenAmount > 0.32;
    }

    _stepToward(destX, destZ, speed, dt, doorOpenAmount) {
      // Navigate smoothly through the wooden doorway if crossing between box & outdoor grass
      let navX = destX;
      let navZ = destZ;
      const currentlyOut = this.pos.x > 3.18;
      const destOut = destX > 3.18;

      if (currentlyOut !== destOut) {
        if (!this._canCrossDoorway(doorOpenAmount)) {
          // Door is closed! Stay on current side cleanly
          if (currentlyOut) navX = Math.max(3.45, destX);
          else navX = Math.min(2.85, destX);
        } else {
          // Funnel cleanly through box right cutout (X=2.02, Z=0.45) and wooden doorway (X=3.18, Z=0.72)
          if (!currentlyOut && this.pos.x < 1.95 && (this.pos.z < -0.15 || this.pos.z > 1.05)) {
            navX = 1.85;
            navZ = 0.45;
          } else if (Math.abs(this.pos.x - 3.18) < 1.4 && (this.pos.z < 0.05 || this.pos.z > 1.45)) {
            navX = currentlyOut ? 3.45 : 2.85;
            navZ = 0.72;
          }
        }
      }

      const dx = navX - this.pos.x;
      const dz = navZ - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.04) return true;

      // Smooth turn toward walk direction (never spinning wildly)
      const desiredAngle = Math.atan2(dx, dz);
      let diff = desiredAngle - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 11.5);

      // Slow gently as belly gets full
      const fullnessFactor = 1.0 - this.fullness * 0.42;
      const stepDist = Math.min(dist, speed * fullnessFactor * dt);
      this.pos.x += (dx / dist) * stepDist;
      this.pos.z += (dz / dist) * stepDist;

      // Clamp inside valid playable bounds
      const box = this.env.boxBounds;
      if (this.pos.x <= 3.18) {
        this.pos.x = Math.max(box.minX + 0.24, this.pos.x);
        this.pos.z = Math.max(box.minZ + 0.24, Math.min(box.maxZ - 0.14, this.pos.z));
      } else {
        this.pos.x = Math.min(5.35, this.pos.x);
        this.pos.z = Math.max(-1.0, Math.min(1.65, this.pos.z));
      }

      // Smooth ground height transition across wooden box threshold to coop floor & outdoor grass
      let groundY = box.floorY + 0.01;
      if (this.pos.x > 2.15 && this.pos.x <= 3.25) groundY = 0.01;
      else if (this.pos.x > 3.25) groundY = 0.0;
      this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * 14);

      // Fine quick real-chick footstep cadence (grounded, minimal subtle vertical bob)
      this.stepPhase += dt * (16.5 * fullnessFactor);
      const stride = Math.sin(this.stepPhase);
      this.legL.rotation.x = stride * 0.56;
      this.legR.rotation.x = -stride * 0.56;
      this.legL.position.y = 0.24 + Math.max(0, stride) * 0.032;
      this.legR.position.y = 0.24 + Math.max(0, -stride) * 0.032;
      this.bodyPivot.position.y = 0.34 + Math.abs(stride) * 0.014;
      this.bodyPivot.rotation.z = stride * 0.045;
      // Realistic slight pigeon-like forward-back head stabilization during steps
      this.headPivot.position.z = 0.055 + Math.cos(this.stepPhase * 2) * 0.018;

      if (Math.abs(stride) > 0.92 && Math.random() < 0.25) {
        this.sound.playFootstep(this.pos.x > 3.22);
      }
      return false;
    }

    update(dt, elapsed, ctx) {
      const { env, props, motherHen, chicks, onChickAteGrain, onChickDrank } = ctx;
      this.stateTimer += dt;
      this.breathPhase += dt * (2.9 - this.fullness * 0.9);
      this.tailTwitch = Math.max(0, this.tailTwitch - dt * 6.5);

      // Belly softly rounds out as fullness rises!
      const bellyScale = 1.0 + this.fullness * 0.17;
      const breath = Math.sin(this.breathPhase) * 0.022;
      this.torsoMesh.scale.set(bellyScale, 1.0 + this.fullness * 0.08 + breath, 1.0 + this.fullness * 0.1 + breath * 0.5);

      // Gentle blinking / drowsy eyes
      this.blinkTimer -= dt;
      let lidClose = 0;
      if (this.blinkTimer < 0) {
        if (this.blinkTimer > -0.14) lidClose = Math.sin(((this.blinkTimer + 0.14) / 0.14) * Math.PI);
        else this.blinkTimer = 2.0 + Math.random() * 3.5;
      }
      if (this.state === 'doze_one_leg' || this.drowsy) {
        lidClose = Math.max(lidClose, 0.55 + Math.sin(elapsed * 1.4 + this.index) * 0.25);
      }
      if (this.state === 'sleep_full') {
        // Last chick slowly blinks and closes its eyes
        lidClose = Math.min(1.0, 0.35 + this.stateTimer * 0.25);
      }
      for (const lid of this.eyelids) {
        lid.rotation.x = -Math.PI * 0.54 + lidClose * 0.92;
      }

      // Reset default limb poses smoothly each frame before state overrides
      let bodyY = 0.34 + breath * 0.35;
      let bodyPitch = 0;
      let neckPitch = 0;
      let headPitch = 0;
      let headRoll = 0;
      let headYaw = 0;
      let wingSpreadL = 0;
      let wingSpreadR = 0;
      let beakOpen = 0;
      let legLX = 0, legRX = 0;
      let legLY = 0.24, legRY = 0.24;

      // --- STATE MACHINE ---
      if (this.state === 'idle') {
        // Subtle alive looking around & expectant neck-craning near remembered feeding spots
        const lookWave = Math.sin(elapsed * 1.1 + this.index * 2.3);
        headYaw = lookWave * 0.26;
        if (this.expectantTimer > 0) {
          this.expectantTimer -= dt;
          neckPitch = -0.18;
          headPitch = -0.16; // Craning neck up expectantly!
        }

        if (this.stateTimer > this.idleDuration) {
          this.stateTimer = 0;
          this.idleDuration = 2.4 + Math.random() * 2.8;

          // Choose a natural real-chick idle behavior
          const r = Math.random();
          if (this.fullness > 0.85) {
            // Very full: tuck warmly beneath Mother Hen's belly feathers!
            const slot = motherHen.getShelterSlot(this.index);
            this.directToPosition(slot, 'sleep_full');
          } else if (r < 0.24 && !this.isOutside()) {
            this.state = 'doze_one_leg';
            this.drowsy = true;
          } else if (r < 0.44) {
            this.state = 'stretch_wing';
          } else if (r < 0.66 && !this.isOutside()) {
            this.state = 'scratch_straw';
            this.sound.playStrawRustle(0.55);
            env.strawSystem.scratchAt(this.pos.x, this.pos.z, 0.48);
            props.uncoverGrainsNear(this.pos.x, this.pos.z, 0.48);
          } else if (r < 0.82 && !this.isOutside() && this.index >= 1) {
            // Nestle briefly under Mother Hen's belly and peek out!
            const slot = motherHen.getShelterSlot(this.index);
            this.directToPosition(slot, 'tuck_under_hen');
          } else {
            // Trot a few tiny steps near remembered favorite feeding zone
            const fav = this.getFavoriteZone();
            let wx = this.pos.x + (Math.random() - 0.5) * 0.9;
            let wz = this.pos.z + (Math.random() - 0.5) * 0.8;
            if (fav === 'dish_center' && !this.isOutside()) {
              wx = props.feedDish.pos.x + (Math.random() - 0.5) * 0.85;
              wz = props.feedDish.pos.z + (Math.random() - 0.5) * 0.75;
              this.expectantTimer = 2.6;
            } else if (fav === 'hen_front' && !this.isOutside()) {
              const hs = motherHen.getFrontFeedSpot();
              wx = hs.x + (Math.random() - 0.5) * 0.55;
              wz = hs.z + (Math.random() - 0.5) * 0.55;
            } else if (this.isOutside()) {
              wx = 3.7 + Math.random() * 1.1;
              wz = -0.3 + Math.random() * 1.5;
            }
            wx = THREE.MathUtils.clamp(wx, this.isOutside() ? 3.5 : -1.45, this.isOutside() ? 5.1 : 1.7);
            wz = THREE.MathUtils.clamp(wz, -0.8, 1.4);
            this.directToPosition(new THREE.Vector3(wx, this.pos.y, wz), 'idle');
          }
        }
      } else if (this.state === 'doze_one_leg') {
        // Standing on left foot, right foot tucked up into belly fluff, head gently nodding
        legRY = 0.34;
        legRX = -0.65;
        bodyY = 0.31 + breath * 0.4;
        headPitch = 0.22 + Math.sin(elapsed * 1.5) * 0.06;
        bodyPitch = 0.05;
        if (this.stateTimer > 4.2 + Math.random() * 2.5) {
          this.drowsy = false;
          this.state = 'idle';
          this.stateTimer = 0;
        }
      } else if (this.state === 'stretch_wing') {
        // Spread wings softly & flutter gently while stretching a leg back
        const p = Math.min(1, this.stateTimer / 1.55);
        const envCurve = Math.sin(p * Math.PI);
        const flutter = Math.sin(this.stateTimer * 24) * 0.14 * envCurve;
        wingSpreadL = envCurve * 0.88 + flutter;
        wingSpreadR = envCurve * 0.88 - flutter;
        bodyPitch = -0.12 * envCurve;
        legRX = -0.45 * envCurve;
        neckPitch = -0.18 * envCurve;
        if (this.stateTimer > 1.6) {
          this.state = 'idle';
          this.stateTimer = 0;
        }
      } else if (this.state === 'scratch_straw') {
        // Authentic quick chick straw-scratching kick!
        const kick = Math.sin(this.stateTimer * 22);
        bodyPitch = 0.24;
        headPitch = 0.32;
        if (this.stateTimer < 0.45) {
          legRX = kick * 0.72;
          legRY = 0.25 + Math.max(0, -kick) * 0.04;
        } else {
          legLX = kick * 0.72;
          legLY = 0.25 + Math.max(0, -kick) * 0.04;
        }
        if (Math.abs(this.stateTimer - 0.46) < dt * 1.5) {
          env.strawSystem.scratchAt(this.pos.x, this.pos.z, 0.46);
          props.uncoverGrainsNear(this.pos.x, this.pos.z, 0.48);
          this.sound.playStrawRustle(0.45);
        }
        if (this.stateTimer > 0.95) {
          if (this.targetGrain && this.targetGrain.active && this.targetGrain.state === 'settled') {
            this.state = 'peck_grain';
          } else {
            this.state = 'idle';
          }
          this.stateTimer = 0;
        }
      } else if (this.state === 'tuck_under_hen' || this.state === 'sleep_full') {
        // Nestled warmly beneath Mother Hen's belly feathers with little head peeking out!
        const slot = motherHen.getShelterSlot(this.index);
        this.pos.lerp(slot, Math.min(1, dt * 4));
        // Face gently outward toward the camera/box so the tiny peeking head is clearly visible
        const outAngle = 0.45 + (this.index - 1) * 0.28;
        let diff = outAngle - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facing += diff * Math.min(1, dt * 5);

        bodyY = 0.23 + breath * 0.25; // Crouched cozy down in the straw
        legLY = 0.32;
        legRY = 0.32;
        if (this.state === 'sleep_full') {
          // Last chick pokes head slightly further forward before drifting off
          neckPitch = this.index === 2 ? 0.16 : 0.26;
          headPitch = 0.22 + Math.sin(elapsed * 1.1 + this.index) * 0.04;
        } else {
          headYaw = Math.sin(elapsed * 1.4 + this.index) * 0.32;
          if (this.stateTimer > 6.0 && this.fullness < 0.82) {
            this.state = 'idle';
            this.stateTimer = 0;
          }
        }
      } else if (this.state === 'head_cock') {
        // Adorable head tilt listening to the tiny sound of falling millet!
        const dx = this.targetPos.x - this.pos.x;
        const dz = this.targetPos.z - this.pos.z;
        const desiredAngle = Math.atan2(dx, dz);
        let diff = desiredAngle - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facing += diff * Math.min(1, dt * 9);
        headRoll = this.headCockAngle;
        headPitch = -0.08;
        if (this.stateTimer > 0.32) {
          this.state = 'walk_to';
          this.stateTimer = 0;
        }
      } else if (this.state === 'walk_to') {
        // Keep tracking moving grain or moving leaf if needed
        if (this.nextStateAfterWalk === 'peck_grain') {
          if (!this.targetGrain || !this.targetGrain.active || this.targetGrain.state !== 'settled') {
            this.targetGrain = null;
            this.state = 'idle';
            this.stateTimer = 0;
          } else {
            this.targetPos.set(this.targetGrain.x, this.pos.y, this.targetGrain.z);
          }
        } else if (this.nextStateAfterWalk === 'grab_leaf') {
          if (!this.targetLeaf || (this.targetLeaf.state !== 'ground' && this.targetLeaf.state !== 'carried')) {
            this.targetLeaf = null;
            this.state = 'idle';
            this.stateTimer = 0;
          } else {
            this.targetPos.set(this.targetLeaf.x, this.pos.y, this.targetLeaf.z);
          }
        }

        const arriveRadius = this.nextStateAfterWalk === 'peck_grain' ? 0.27
          : this.nextStateAfterWalk === 'grab_leaf' ? 0.30
          : this.nextStateAfterWalk === 'drink_water' ? 0.14 : 0.12;

        const d = Math.hypot(this.targetPos.x - this.pos.x, this.targetPos.z - this.pos.z);
        if (d <= arriveRadius || this.stateTimer > 6.5) {
          this.stateTimer = 0;
          if (this.nextStateAfterWalk === 'peck_grain') {
            if (this.targetGrain && this.targetGrain.buried) {
              // Scratch the straw first to uncover the half-buried millet grain!
              this.state = 'scratch_straw';
              this.sound.playStrawRustle(0.55);
              env.strawSystem.scratchAt(this.targetGrain.x, this.targetGrain.z, 0.42);
              props.uncoverGrainsNear(this.targetGrain.x, this.targetGrain.z, 0.44);
            } else {
              this.state = 'peck_grain';
              this.pecksDone = 0;
            }
          } else if (this.nextStateAfterWalk === 'grab_leaf') {
            this._handleArriveAtLeaf(props);
          } else if (this.nextStateAfterWalk === 'drink_water') {
            this.state = 'drink_water';
            this.sound.playWaterSip();
            props.waterDish.triggerRipple();
          } else if (this.nextStateAfterWalk === 'sleep_full') {
            this.state = 'sleep_full';
          } else if (this.nextStateAfterWalk === 'tuck_under_hen') {
            this.state = 'tuck_under_hen';
          } else {
            this.state = 'idle';
          }
        } else {
          const speed = this.nextStateAfterWalk === 'grab_leaf' ? this.profile.speed * 1.18 : this.profile.speed;
          this._stepToward(this.targetPos.x, this.targetPos.z, speed, dt, env.door.openAmount);
          // Skip default leg overwrite since _stepToward animated them
          legLX = this.legL.rotation.x;
          legRX = this.legR.rotation.x;
          legLY = this.legL.position.y;
          legRY = this.legR.position.y;
          bodyY = this.bodyPivot.position.y;
        }
      } else if (this.state === 'peck_grain') {
        const g = this.targetGrain;
        if (!g || !g.active || g.state !== 'settled') {
          this.targetGrain = null;
          this.state = 'idle';
          this.stateTimer = 0;
        } else {
          const desiredAngle = Math.atan2(g.x - this.pos.x, g.z - this.pos.z);
          let diff = desiredAngle - this.facing;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.facing += diff * Math.min(1, dt * 12);

          // Crisp rapid real-chick vertical pecking (つんつん) + tail twitch (尾羽がぴくっ)
          const cycle = (this.stateTimer % 0.24) / 0.24;
          const strike = cycle < 0.45 ? Math.sin((cycle / 0.45) * Math.PI) : 0;
          bodyPitch = 0.28 + strike * 0.42;
          neckPitch = 0.35 + strike * 0.65;
          headPitch = 0.25 + strike * 0.38;
          beakOpen = strike * 0.16;

          const countNow = Math.floor(this.stateTimer / 0.24);
          if (countNow > this.pecksDone) {
            this.pecksDone = countNow;
            this.tailTwitch = 1.0; // Crisp short tail twitch!
            this.sound.playPeck(g.surface);
            if (this.pecksDone >= 2) {
              // Grain eaten!
              const eatenZone = g.zone;
              const wasGifted = g.giftedByHen;
              props.removeGrain(g);
              this.targetGrain = null;
              this.memory[eatenZone] = (this.memory[eatenZone] || 0) + 1;
              this.lastEatenZone = eatenZone;
              this.fullness = Math.min(1.0, this.fullness + 0.055);
              this.thirst = Math.min(1.0, this.thirst + 0.22);
              if (Math.random() < 0.42) this.sound.playChirp(this.index, 'happy');
              if (onChickAteGrain) onChickAteGrain(this, eatenZone, wasGifted);
              this.state = 'idle';
              this.stateTimer = 0;
              this.idleDuration = 0.45 + Math.random() * 0.6;
            }
          }
        }
      } else if (this.state === 'carry_leaf') {
        // Playfully running in a cute arc holding the chickweed leaf in beak!
        const lf = this.targetLeaf;
        if (!lf || (lf.state !== 'carried' && lf.state !== 'tug')) {
          this.targetLeaf = null;
          this.state = 'idle';
          this.stateTimer = 0;
        } else if (lf.state === 'tug') {
          this.state = 'tug_leaf';
          this.stateTimer = 0;
        } else {
          // Run around playfully inside the box (or outdoor grass)
          const d = Math.hypot(this.targetPos.x - this.pos.x, this.targetPos.z - this.pos.z);
          if (d < 0.22 || this.stateTimer < 0.05) {
            const ang = elapsed * 1.3 + this.index * 2;
            const cx = this.isOutside() ? 4.3 : 0.15;
            const cz = this.isOutside() ? 0.5 : 0.35;
            this.targetPos.set(cx + Math.cos(ang) * 0.95, this.pos.y, cz + Math.sin(ang) * 0.72);
          }
          this._stepToward(this.targetPos.x, this.targetPos.z, this.profile.speed * 1.15, dt, env.door.openAmount);
          legLX = this.legL.rotation.x;
          legRX = this.legR.rotation.x;
          legLY = this.legL.position.y;
          legRY = this.legR.position.y;
          bodyY = this.bodyPivot.position.y;
          wingSpreadL = 0.28 + Math.sin(elapsed * 18) * 0.12;
          wingSpreadR = 0.28 - Math.sin(elapsed * 18) * 0.12;
          headPitch = -0.14;

          // Position leaf at beak tip
          const tip = new THREE.Vector3();
          this.beakAnchor.getWorldPosition(tip);
          lf.x = tip.x;
          lf.y = tip.y;
          lf.z = tip.z;
          lf.mesh.position.copy(tip);
          lf.mesh.rotation.set(0.18, this.facing + Math.sin(elapsed * 14) * 0.2, 0);

          // If carrying a torn half (or nobody chased for 3.2s), set down and nibble happily!
          if ((lf.kind !== 'whole' && this.stateTimer > 0.75) || this.stateTimer > 3.8) {
            lf.state = 'ground';
            lf.y = this.pos.y + 0.025;
            lf.mesh.position.set(lf.x, lf.y, lf.z);
            lf.mesh.rotation.set(0, this.facing, 0);
            this.state = 'nibble_leaf';
            this.stateTimer = 0;
          }
        }
      } else if (this.state === 'tug_leaf') {
        // Gentle playful tug-of-war with another chick (no fighting - cute chase & share!)
        const lf = this.targetLeaf;
        if (!lf || lf.state !== 'tug') {
          this.state = 'idle';
          this.stateTimer = 0;
        } else {
          const partnerIdx = lf.holderA === this.index ? lf.holderB : lf.holderA;
          const partner = chicks[partnerIdx];
          if (!partner) {
            lf.state = 'carried';
            this.state = 'carry_leaf';
          } else {
            const dx = partner.pos.x - this.pos.x;
            const dz = partner.pos.z - this.pos.z;
            const desiredAngle = Math.atan2(dx, dz);
            let diff = desiredAngle - this.facing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.facing += diff * Math.min(1, dt * 12);

            // Cute rhythmic gentle tugging back & forth
            const pull = Math.sin(this.stateTimer * 11 + (lf.holderA === this.index ? 0 : Math.PI));
            bodyPitch = 0.14 - pull * 0.14;
            headRoll = pull * 0.18;
            wingSpreadL = 0.24 + Math.abs(pull) * 0.22;
            wingSpreadR = 0.24 + Math.abs(pull) * 0.22;

            // Keep nice spacing for the leaf between the two beaks
            const dist = Math.hypot(dx, dz);
            if (dist > 0.62) {
              this.pos.x += (dx / dist) * dt * 0.5;
              this.pos.z += (dz / dist) * dt * 0.5;
            } else if (dist < 0.48) {
              this.pos.x -= (dx / dist) * dt * 0.35;
              this.pos.z -= (dz / dist) * dt * 0.35;
            }

            // Holder A drives the shared leaf transform & tear trigger!
            if (lf.holderA === this.index) {
              lf.tugProgress += dt;
              const tipA = new THREE.Vector3();
              const tipB = new THREE.Vector3();
              this.beakAnchor.getWorldPosition(tipA);
              partner.beakAnchor.getWorldPosition(tipB);
              lf.mesh.position.copy(tipA).lerp(tipB, 0.5);
              lf.mesh.rotation.set(0.1, Math.atan2(tipB.x - tipA.x, tipB.z - tipA.z), 0);
              const stretch = 1.0 + Math.min(0.28, lf.tugProgress * 0.18);
              lf.mesh.scale.set(1.0, 1.0, stretch);

              if (lf.tugProgress > 1.55) {
                // Leaf tears cleanly in two revealing fine leaf veins!
                const torn = props.basket.tearLeafInTwo(lf, tipA, tipB);
                if (torn) {
                  this.targetLeaf = torn.leftLeaf;
                  this.state = 'carry_leaf';
                  this.stateTimer = 0;
                  partner.targetLeaf = torn.rightLeaf;
                  partner.state = 'carry_leaf';
                  partner.stateTimer = 0;
                  this.sound.playChirp(this.index, 'happy');
                  partner.sound.playChirp(partner.index, 'happy');
                }
              }
            }
          }
        }
      } else if (this.state === 'nibble_leaf') {
        const lf = this.targetLeaf;
        if (!lf || lf.state === 'scrap') {
          this.targetLeaf = null;
          this.state = 'idle';
          this.stateTimer = 0;
        } else {
          const cycle = (this.stateTimer % 0.32) / 0.32;
          const strike = cycle < 0.45 ? Math.sin((cycle / 0.45) * Math.PI) : 0;
          bodyPitch = 0.25 + strike * 0.34;
          neckPitch = 0.34 + strike * 0.52;
          headPitch = 0.25 + strike * 0.32;

          if (this.stateTimer > 1.65) {
            this.tailTwitch = 1.0;
            this.sound.playPeck('straw');
            lf.scrapScale = 0.46; // Leave a tiny torn chickweed scrap on the straw!
            lf.state = 'scrap';
            this.fullness = Math.min(1.0, this.fullness + 0.11);
            this.targetLeaf = null;
            this.state = 'idle';
            this.stateTimer = 0;
            this.sound.playChirp(this.index, 'happy');
          }
        }
      } else if (this.state === 'drink_water') {
        // Real baby chick drinking: dip beak into water -> tilt head UPWARD -> "kokun" swallow!
        if (this.waterTarget) {
          const desiredAngle = Math.atan2(this.waterTarget.x - this.pos.x, this.waterTarget.z - this.pos.z);
          let diff = desiredAngle - this.facing;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.facing += diff * Math.min(1, dt * 10);
        }

        if (this.stateTimer < 0.48) {
          // Scoop water gently
          const p = Math.sin((this.stateTimer / 0.48) * Math.PI);
          bodyPitch = 0.34 * p;
          neckPitch = 0.72 * p;
          headPitch = 0.42 * p;
          beakOpen = 0.1 * p;
        } else if (this.stateTimer < 1.35) {
          // Tilt head UPWARD toward morning light and gulp ("こくん")!
          const p = Math.sin(((this.stateTimer - 0.48) / 0.87) * Math.PI);
          bodyPitch = -0.14 * p;
          neckPitch = -0.36 * p;
          headPitch = -0.68 * p;
          // Tiny throat bob during gulp
          const gulpBob = Math.sin((this.stateTimer - 0.65) * 18) * 0.08 * p;
          headPitch += gulpBob;
        } else if (this.stateTimer < 2.2) {
          // One more little sip!
          const sub = this.stateTimer - 1.35;
          if (sub < dt * 1.5) {
            this.sound.playWaterSip();
            props.waterDish.triggerRipple();
          }
          if (sub < 0.35) {
            const p = Math.sin((sub / 0.35) * Math.PI);
            bodyPitch = 0.32 * p;
            neckPitch = 0.68 * p;
            headPitch = 0.38 * p;
          } else {
            const p = Math.sin(((sub - 0.35) / 0.5) * Math.PI);
            bodyPitch = -0.12 * p;
            neckPitch = -0.32 * p;
            headPitch = -0.62 * p;
          }
        } else {
          this.thirst = 0;
          this.tailTwitch = 0.8;
          this.state = 'idle';
          this.stateTimer = 0;
          if (onChickDrank) onChickDrank(this);
        }
      }

      // Apply articulated pose smoothly
      this.root.position.copy(this.pos);
      this.root.rotation.y = this.facing;
      this.bodyPivot.position.y += (bodyY - this.bodyPivot.position.y) * Math.min(1, dt * 14);
      this.bodyPivot.rotation.x += (bodyPitch - this.bodyPivot.rotation.x) * Math.min(1, dt * 14);
      if (this.state !== 'walk_to' && this.state !== 'carry_leaf') {
        this.bodyPivot.rotation.z *= Math.pow(0.05, dt);
        this.headPivot.position.z += (0.055 - this.headPivot.position.z) * Math.min(1, dt * 10);
      }

      this.neckPivot.rotation.x += (neckPitch - this.neckPivot.rotation.x) * Math.min(1, dt * 16);
      this.headPivot.rotation.x += (headPitch - this.headPivot.rotation.x) * Math.min(1, dt * 16);
      this.headPivot.rotation.y += (headYaw - this.headPivot.rotation.y) * Math.min(1, dt * 10);
      this.headPivot.rotation.z += (headRoll - this.headPivot.rotation.z) * Math.min(1, dt * 12);

      this.wingL.rotation.z += (-(0.06 + wingSpreadL) - this.wingL.rotation.z) * Math.min(1, dt * 14);
      this.wingR.rotation.z += ((0.06 + wingSpreadR) - this.wingR.rotation.z) * Math.min(1, dt * 14);
      this.tailPivot.rotation.x = 0.12 + this.tailTwitch * 0.52;
      this.lowerBeak.rotation.x = beakOpen;

      this.legL.rotation.x += (legLX - this.legL.rotation.x) * Math.min(1, dt * 16);
      this.legR.rotation.x += (legRX - this.legR.rotation.x) * Math.min(1, dt * 16);
      this.legL.position.y += (legLY - this.legL.position.y) * Math.min(1, dt * 14);
      this.legR.position.y += (legRY - this.legR.position.y) * Math.min(1, dt * 14);
    }

    _handleArriveAtLeaf(props) {
      const lf = this.targetLeaf;
      if (!lf) {
        this.state = 'idle';
        return;
      }
      if (lf.state === 'ground') {
        lf.state = 'carried';
        lf.holderA = this.index;
        this.state = 'carry_leaf';
        this.stateTimer = 0;
        this.sound.playChirp(this.index, 'happy');
      } else if (lf.state === 'carried' && lf.kind === 'whole' && lf.holderA !== this.index && lf.holderB < 0) {
        // Second chick catches the other end of the chickweed leaf -> playful tug!
        lf.state = 'tug';
        lf.holderB = this.index;
        lf.tugProgress = 0;
        this.state = 'tug_leaf';
        this.stateTimer = 0;
        this.sound.playChirp(this.index, 'happy');
      } else {
        this.targetLeaf = null;
        this.state = 'idle';
      }
    }
  }

  function buildAnimals(scene, env, sound) {
    const downBump = window.PiyoTextures.createChickDownBumpTexture();
    const sharedGeos = {
      body: createChickBodyGeo(),
      head: createChickHeadGeo()
    };

    const motherHen = new MotherHen(scene, env, sound);
    const fy = env.boxBounds.floorY + 0.01;
    // Start all 3 chicks clearly framed right near screen center on frame 1!
    const startPositions = [
      new THREE.Vector3(0.36, fy, 0.42),   // Chick 0 (Curio)
      new THREE.Vector3(-0.22, fy, 0.72),  // Chick 1 (Piyo)
      new THREE.Vector3(-0.52, fy, 0.16)   // Chick 2 (Nemu)
    ];
    const chicks = startPositions.map((p, i) => new Chick(i, p, scene, env, sound, downBump, sharedGeos));

    return { motherHen, chicks };
  }

  window.PiyoAnimals = { buildAnimals };
})();
