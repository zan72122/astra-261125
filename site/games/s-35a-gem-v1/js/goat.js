// Realistic articulated 3D Goat builder & procedural animator for こやぎの もぐもぐ
(function () {
  'use strict';

  const T = window.KoyagiTextures;

  let sharedFurBump = null;
  let sharedFuzzAlpha = null;
  let sharedKidEyeTex = null;
  let sharedMotherEyeTex = null;

  function ensureSharedTextures() {
    if (!sharedFurBump) sharedFurBump = T.createFurBumpTexture();
    if (!sharedFuzzAlpha) sharedFuzzAlpha = T.createFuzzAlphaTexture();
    if (!sharedKidEyeTex) sharedKidEyeTex = T.createGoatEyeTexture(false);
    if (!sharedMotherEyeTex) sharedMotherEyeTex = T.createGoatEyeTexture(true);
  }

  class GoatActor {
    constructor(options) {
      ensureSharedTextures();
      this.id = options.id; // 'white' | 'fawn' | 'mother'
      this.isMother = options.id === 'mother';
      this.scale = this.isMother ? 1.38 : (options.id === 'white' ? 0.98 : 1.01);

      this.group = new THREE.Group();
      this.group.name = `goat_${this.id}`;

      // Logical world state
      this.x = options.x || 0;
      this.z = options.z || -0.35;
      this.rotY = options.rotY || 0;
      this.targetX = this.x;
      this.targetZ = this.z;
      this.targetRotY = this.rotY;

      // Zone: 'inside' (behind fence z < 0) or 'outside' (meadow z > 0)
      this.zone = options.zone || 'inside';

      // Behavioral state
      this.state = 'idle';
      // States: 'idle', 'walk', 'eat_hay', 'tug_hay', 'eat_carrot', 'drink',
      //         'propped_wait', 'rub_fence', 'hop', 'head_bump', 'nudge_kid',
      //         'mother_eat', 'sniff_basket', 'eat_ground', 'rest'
      this.stateTimer = 0;
      this.actionDuration = 0;
      this.subPhase = 0;

      // Memory & needs
      this.fullness = 0;         // 0..10+
      this.hayEaten = 0;
      this.carrotsEaten = 0;
      this.remembersCarrot = false;
      this.lastAteSlot = null;   // 'left' | 'center' | 'right' | 'ground' | 'hand'
      this.isSitting = false;
      this.sitBlend = 0;         // 0 standing .. 1 folded legs sitting
      this.propBlend = 0;        // 0 standing .. 1 front hooves on lower fence rail
      this.eyeRestBlend = 0;     // 0 alert .. 1 half-closed peaceful

      // Animation parameters
      this.walkCycle = Math.random() * Math.PI * 2;
      this.stepAccum = 0;
      this.breathPhase = Math.random() * Math.PI * 2;
      this.tailPhase = Math.random() * Math.PI * 2;
      this.chewAmount = 0;       // 0..1 active chewing
      this.chewPhase = Math.random() * Math.PI * 2;
      this.chewSoundTimer = 0;
      this.jawOpen = 0;
      this.earPerk = 0;          // 0..1 alert ear perk
      this.earTwitchTimer = 1.2 + Math.random() * 2.5;
      this.earTwitchSide = 1;
      this.earTwitchVal = 0;
      this.blinkTimer = 2.0 + Math.random() * 3.5;
      this.blinkAmount = 0;
      this.idleActionTimer = 3.2 + Math.random() * 3.5;

      // Neck & head look/reach targets
      this.neckReach = 0;        // 0..1 stretching neck forward
      this.neckPitch = 0;        // radians (positive = dip down, negative = lift up)
      this.neckYaw = 0;          // radians
      this.headPitch = 0;
      this.headYaw = 0;
      this.headRoll = 0;
      this.lookTarget = null;    // THREE.Vector3 in world space

      // Hop motion
      this.hopTimer = 0;
      this.hopDuration = 0.36;
      this.hopHeight = 0.13;

      // Dangling mouth hay state
      this.mouthHayAmount = 0;   // 0..1
      this.mouthHayPull = 0;     // 0..1 being pulled during side-by-side tug

      // Chin drip timer (after drinking water)
      this.wetChinTimer = 0;
      this.dripEmitTimer = 0;

      // Build 3D model
      this._buildModel();
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.rotY;
    }

    _buildModel() {
      const furTex = T.createFurTexture(this.id);
      const furColor = this.id === 'white'
        ? 0xf7f5f0
        : this.id === 'fawn'
          ? 0xd6bfa2
          : 0xebe3d5;
      const secondaryColor = this.id === 'white'
        ? 0xeeeae2
        : this.id === 'fawn'
          ? 0xe8dcc8
          : 0xd9cbb7;

      // Physical fur material with warm golden afternoon sheen
      this.furMat = new THREE.MeshPhysicalMaterial({
        map: furTex,
        color: furColor,
        bumpMap: sharedFurBump,
        bumpScale: 0.006,
        roughness: 0.88,
        metalness: 0.0,
        sheen: 0.62,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color(0xffe7bd)
      });

      this.softLightFurMat = new THREE.MeshPhysicalMaterial({
        map: furTex,
        color: secondaryColor,
        bumpMap: sharedFurBump,
        bumpScale: 0.005,
        roughness: 0.90,
        metalness: 0.0,
        sheen: 0.55,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color(0xffe9c2)
      });

      // Warm backlit ear-rim & cheek fuzz (ほんのり透ける産毛)
      const fuzzColor = this.id === 'white' ? 0xfff3dc : this.id === 'fawn' ? 0xf5d7ad : 0xf7e7cc;
      this.fuzzMat = new THREE.MeshStandardMaterial({
        color: fuzzColor,
        alphaMap: sharedFuzzAlpha,
        transparent: true,
        opacity: 0.46,
        roughness: 0.9,
        emissive: new THREE.Color(0xffcf87),
        emissiveIntensity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      // Soft pinkish inner ear translucent material
      this.innerEarMat = new THREE.MeshPhysicalMaterial({
        color: this.id === 'fawn' ? 0xd9a896 : 0xe3b6a6,
        roughness: 0.78,
        sheen: 0.4,
        sheenColor: new THREE.Color(0xffcaa8),
        emissive: new THREE.Color(0xe6906a),
        emissiveIntensity: 0.14
      });

      // Moist shiny nose (鼻の湿りが光ります)
      this.noseMat = new THREE.MeshPhysicalMaterial({
        color: this.id === 'white' ? 0x6b5550 : 0x4b3b36,
        roughness: 0.20,
        metalness: 0.04,
        clearcoat: 0.82,
        clearcoatRoughness: 0.16
      });

      // Dark brown split hooves
      this.hoofMat = new THREE.MeshStandardMaterial({
        color: 0x3b3129,
        roughness: 0.62,
        metalness: 0.05
      });

      // Authentic horizontal-pupil goat eye material
      this.eyeMat = new THREE.MeshPhysicalMaterial({
        map: this.isMother ? sharedMotherEyeTex : sharedKidEyeTex,
        roughness: 0.12,
        metalness: 0.02,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1
      });

      // Root rig scaled by goat size
      this.rig = new THREE.Group();
      this.rig.scale.setScalar(this.scale);
      this.group.add(this.rig);

      // Body pivot (moves up/down for breathing, hopping, sitting, propping)
      this.bodyPivot = new THREE.Group();
      this.bodyPivot.position.set(0, 0.47, 0);
      this.rig.add(this.bodyPivot);

      // --- Torso (organic multi-part goat body) ---
      const torsoGeo = new THREE.CapsuleGeometry(0.125, 0.25, 10, 18);
      torsoGeo.rotateX(Math.PI * 0.5);
      const torso = new THREE.Mesh(torsoGeo, this.furMat);
      torso.scale.set(0.94, 1.05, 1.0);
      torso.castShadow = true;
      torso.receiveShadow = true;
      this.bodyPivot.add(torso);

      // Chest fullness
      const chestGeo = new THREE.SphereGeometry(0.122, 16, 14);
      const chest = new THREE.Mesh(chestGeo, this.softLightFurMat);
      chest.position.set(0, -0.005, 0.135);
      chest.scale.set(0.9, 1.02, 0.92);
      chest.castShadow = true;
      chest.receiveShadow = true;
      this.bodyPivot.add(chest);

      // Soft belly rounding
      const bellyGeo = new THREE.SphereGeometry(0.126, 16, 14);
      const belly = new THREE.Mesh(bellyGeo, this.softLightFurMat);
      belly.position.set(0, -0.022, -0.01);
      belly.scale.set(0.92, 0.92, 1.25);
      belly.castShadow = true;
      belly.receiveShadow = true;
      this.bodyPivot.add(belly);

      // Rump
      const rumpGeo = new THREE.SphereGeometry(0.118, 16, 14);
      const rump = new THREE.Mesh(rumpGeo, this.furMat);
      rump.position.set(0, 0.008, -0.145);
      rump.scale.set(0.92, 0.98, 0.96);
      rump.castShadow = true;
      rump.receiveShadow = true;
      this.bodyPivot.add(rump);

      // Subtle fawn shoulder/back saddle patch if fawn kid
      if (this.id === 'fawn') {
        const patchMat = new THREE.MeshPhysicalMaterial({
          color: 0xe6dac6,
          bumpMap: sharedFurBump,
          bumpScale: 0.004,
          roughness: 0.9,
          sheen: 0.5,
          sheenColor: new THREE.Color(0xffe8c2)
        });
        const patch = new THREE.Mesh(new THREE.SphereGeometry(0.112, 14, 12), patchMat);
        patch.position.set(0.025, 0.015, 0.02);
        patch.scale.set(0.85, 0.95, 1.05);
        this.bodyPivot.add(patch);
      }

      // --- Short perky upright tail (短い尻尾) ---
      this.tailPivot = new THREE.Group();
      this.tailPivot.position.set(0, 0.065, -0.24);
      this.bodyPivot.add(this.tailPivot);

      const tailGeo = new THREE.ConeGeometry(0.026, 0.11, 10);
      tailGeo.translate(0, 0.05, 0);
      const tailMesh = new THREE.Mesh(tailGeo, this.softLightFurMat);
      tailMesh.rotation.x = -0.58; // naturally perky upright kid goat tail
      tailMesh.castShadow = true;
      this.tailPivot.add(tailMesh);

      // --- Four articulated legs (FL, FR, BL, BR) ---
      this.legs = {
        fl: this._buildLeg(-0.072, -0.05, 0.145, true),
        fr: this._buildLeg(0.072, -0.05, 0.145, true),
        bl: this._buildLeg(-0.074, -0.04, -0.145, false),
        br: this._buildLeg(0.074, -0.04, -0.145, false)
      };

      // --- Neck & Head hierarchy ---
      this.neckPivot = new THREE.Group();
      this.neckPivot.position.set(0, 0.068, 0.175);
      this.bodyPivot.add(this.neckPivot);

      const neckGeo = new THREE.CapsuleGeometry(0.068, 0.17, 8, 14);
      const neckMesh = new THREE.Mesh(neckGeo, this.furMat);
      neckMesh.position.set(0, 0.105, 0.055);
      neckMesh.rotation.x = 0.42;
      neckMesh.scale.set(0.92, 1.0, 1.04);
      neckMesh.castShadow = true;
      neckMesh.receiveShadow = true;
      this.neckPivot.add(neckMesh);

      // Soft throat fuzz
      const throat = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), this.softLightFurMat);
      throat.position.set(0, 0.05, 0.05);
      throat.scale.set(0.88, 1.05, 0.95);
      this.neckPivot.add(throat);

      // Head pivot at top of neck
      this.headPivot = new THREE.Group();
      this.headPivot.position.set(0, 0.215, 0.115);
      this.neckPivot.add(this.headPivot);

      // Cranium (rounded hornless head for kids — 小さな角のない頭)
      const skullGeo = new THREE.SphereGeometry(0.092, 18, 16);
      const skull = new THREE.Mesh(skullGeo, this.furMat);
      skull.position.set(0, 0.032, 0.015);
      skull.scale.set(0.90, 0.96, 1.08);
      skull.castShadow = true;
      skull.receiveShadow = true;
      this.headPivot.add(skull);

      // Soft forehead crown tuft (gentle fluffy kid poll, no horns on kids)
      const pollTuft = new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 10), this.softLightFurMat);
      pollTuft.position.set(0, 0.095, 0.012);
      pollTuft.scale.set(0.95, 0.62, 0.95);
      this.headPivot.add(pollTuft);

      // Mother goat has graceful natural curved adult goat horns & soft chin beard
      if (this.isMother) {
        const hornMat = new THREE.MeshStandardMaterial({
          color: 0x8e7c64,
          roughness: 0.58,
          metalness: 0.05
        });
        for (const side of [-1, 1]) {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * 0.036, 0.105, -0.005),
            new THREE.Vector3(side * 0.062, 0.175, -0.045),
            new THREE.Vector3(side * 0.085, 0.215, -0.125),
            new THREE.Vector3(side * 0.095, 0.205, -0.175)
          ]);
          const hornGeo = new THREE.TubeGeometry(curve, 14, 0.016, 8, false);
          // Taper horn vertices smoothly toward tip
          const pos = hornGeo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const zVal = pos.getZ(i);
            const t = Math.min(1, Math.max(0, (-zVal - 0.005) / 0.17));
            const center = curve.getPoint(t);
            const shrink = 1 - t * 0.72;
            pos.setXYZ(
              i,
              center.x + (pos.getX(i) - center.x) * shrink,
              center.y + (pos.getY(i) - center.y) * shrink,
              center.z + (pos.getZ(i) - center.z) * shrink
            );
          }
          hornGeo.computeVertexNormals();
          const horn = new THREE.Mesh(hornGeo, hornMat);
          horn.castShadow = true;
          this.headPivot.add(horn);
        }
      }

      // Soft goat cheeks & sunlit translucent cheek fuzz (頬の産毛)
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), this.softLightFurMat);
        cheek.position.set(side * 0.052, -0.005, 0.045);
        cheek.scale.set(0.84, 0.88, 1.12);
        this.headPivot.add(cheek);

        // Translucent sunlit cheek peach-fuzz rim
        const fuzzPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.075), this.fuzzMat);
        fuzzPlane.position.set(side * 0.076, -0.002, 0.038);
        fuzzPlane.rotation.y = side * 0.35;
        this.headPivot.add(fuzzPlane);
      }

      // Tapered caprine nasal bridge & upper muzzle
      const bridgeGeo = new THREE.CylinderGeometry(0.040, 0.062, 0.125, 14);
      bridgeGeo.rotateX(Math.PI * 0.5);
      const bridge = new THREE.Mesh(bridgeGeo, this.furMat);
      bridge.position.set(0, 0.004, 0.118);
      bridge.rotation.x = 0.22;
      bridge.scale.set(0.95, 0.82, 1.0);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      this.headPivot.add(bridge);

      // Soft upper lip / muzzle pad
      this.upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), this.softLightFurMat);
      this.upperLip.position.set(0, -0.015, 0.176);
      this.upperLip.scale.set(1.02, 0.72, 0.88);
      this.upperLip.castShadow = true;
      this.headPivot.add(this.upperLip);

      // Glossy wet goat nose (鼻の湿りが光ります)
      this.noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.027, 14, 12), this.noseMat);
      this.noseMesh.position.set(0, -0.004, 0.205);
      this.noseMesh.scale.set(1.22, 0.76, 0.72);
      this.headPivot.add(this.noseMesh);

      // Subtle nostrils
      const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x261d1a, roughness: 0.45 });
      for (const side of [-1, 1]) {
        const nos = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 8), nostrilMat);
        nos.position.set(side * 0.014, -0.005, 0.218);
        nos.scale.set(1.2, 0.65, 0.5);
        nos.rotation.z = side * -0.45;
        this.headPivot.add(nos);
      }

      // Articulated lower jaw (moves down AND side-to-side for horizontal grinding!)
      this.jawPivot = new THREE.Group();
      this.jawPivot.position.set(0, -0.036, 0.088);
      this.headPivot.add(this.jawPivot);

      const jawGeo = new THREE.CapsuleGeometry(0.028, 0.072, 8, 12);
      jawGeo.rotateX(Math.PI * 0.5);
      const jawMesh = new THREE.Mesh(jawGeo, this.softLightFurMat);
      jawMesh.position.set(0, -0.008, 0.052);
      jawMesh.scale.set(1.06, 0.75, 1.0);
      jawMesh.castShadow = true;
      this.jawPivot.add(jawMesh);

      // Subtle soft beard tuft for mother goat
      if (this.isMother) {
        const beardGeo = new THREE.ConeGeometry(0.025, 0.075, 10);
        beardGeo.rotateX(Math.PI);
        const beard = new THREE.Mesh(beardGeo, this.softLightFurMat);
        beard.position.set(0, -0.048, 0.082);
        this.jawPivot.add(beard);
      }

      // Reference point for chin drips & snout position
      this.snoutAnchor = new THREE.Object3D();
      this.snoutAnchor.position.set(0, -0.018, 0.215);
      this.headPivot.add(this.snoutAnchor);

      this.chinAnchor = new THREE.Object3D();
      this.chinAnchor.position.set(0, -0.036, 0.092);
      this.jawPivot.add(this.chinAnchor);

      // Dangling hay stalks sticking out of corner of mouth (口の端からぶら下がる草)
      this.mouthHayGroup = new THREE.Group();
      this.mouthHayGroup.position.set(0.024, -0.002, 0.088);
      this.mouthHayGroup.visible = false;
      this.jawPivot.add(this.mouthHayGroup);

      const stalkMat = new THREE.MeshStandardMaterial({
        color: 0xd4b66c,
        roughness: 0.88
      });
      this.mouthHayStalks = [];
      const stalkConfigs = [
        { len: 0.145, rx: 0.45, ry: 0.55, rz: -0.35, r: 0.0034 },
        { len: 0.115, rx: 0.65, ry: 0.22, rz: -0.62, r: 0.0028 },
        { len: 0.095, rx: 0.35, ry: -0.38, rz: 0.42, r: 0.0026 },
        { len: 0.125, rx: 0.55, ry: 0.78, rz: -0.22, r: 0.0030 }
      ];
      for (const sc of stalkConfigs) {
        const g = new THREE.CylinderGeometry(sc.r * 0.6, sc.r, sc.len, 5);
        g.translate(0, -sc.len * 0.5, 0);
        const m = new THREE.Mesh(g, stalkMat);
        m.rotation.set(sc.rx, sc.ry, sc.rz);
        this.mouthHayGroup.add(m);
        this.mouthHayStalks.push(m);
      }

      // --- Authentic Goat Eyes (横長の瞳を持つ本物の山羊の目) ---
      this.eyelids = [];
      for (const side of [-1, 1]) {
        const eyeSocket = new THREE.Group();
        eyeSocket.position.set(side * 0.068, 0.032, 0.064);
        // Natural caprine eye orientation: slightly lateral yet readable from front
        eyeSocket.rotation.y = side * 0.62;
        eyeSocket.rotation.x = 0.04;
        this.headPivot.add(eyeSocket);

        // Eyeball (small realistic goat eye, never giant cartoon eye)
        const eyeGeo = new THREE.SphereGeometry(0.0205, 16, 14);
        // Rotate UV so texture center (horizontal pupil) points cleanly along +Z of eyeSocket
        eyeGeo.rotateY(-Math.PI * 0.5);
        const eyeball = new THREE.Mesh(eyeGeo, this.eyeMat);
        eyeSocket.add(eyeball);

        // Subtle dark eyelid rim (realistic caprine lash line, not human mascara)
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x4b3e35, roughness: 0.75 });
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0026, 6, 16), rimMat);
        rim.position.z = 0.002;
        eyeSocket.add(rim);

        // Upper eyelid (fur-colored shell that rotates down smoothly to blink/rest)
        const upperLidGeo = new THREE.SphereGeometry(0.0228, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
        const upperLid = new THREE.Mesh(upperLidGeo, this.furMat);
        upperLid.rotation.x = -0.78; // open resting position
        eyeSocket.add(upperLid);

        // Lower eyelid
        const lowerLidGeo = new THREE.SphereGeometry(0.0225, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
        const lowerLid = new THREE.Mesh(lowerLidGeo, this.softLightFurMat);
        lowerLid.rotation.x = 0.42;
        eyeSocket.add(lowerLid);

        this.eyelids.push({ upper: upperLid, lower: lowerLid });
      }

      // --- Articulated Goat Ears with Backlit Translucent Rim Fuzz ---
      this.earLPivot = this._buildEar(-1);
      this.earRPivot = this._buildEar(1);
    }

    _buildEar(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.068, 0.072, -0.012);
      this.headPivot.add(pivot);

      const earGroup = new THREE.Group();
      // Natural slightly outward-cupped young goat ear
      earGroup.rotation.z = side * -0.92;
      earGroup.rotation.y = side * -0.18;
      earGroup.rotation.x = 0.14;
      pivot.add(earGroup);

      // Outer ear fur shell
      const outerGeo = new THREE.SphereGeometry(0.044, 12, 10);
      outerGeo.scale(0.66, 1.72, 0.24);
      outerGeo.translate(0, 0.068, 0);
      const outer = new THREE.Mesh(outerGeo, this.furMat);
      outer.castShadow = true;
      earGroup.add(outer);

      // Soft warm pink-peach inner ear (catches translucent afternoon light)
      const innerGeo = new THREE.SphereGeometry(0.036, 10, 8);
      innerGeo.scale(0.56, 1.48, 0.14);
      innerGeo.translate(0, 0.064, 0.008);
      const inner = new THREE.Mesh(innerGeo, this.innerEarMat);
      earGroup.add(inner);

      // Backlit translucent ear-edge peach fuzz (午後の斜めの日差しで耳の縁がほんのり透けます)
      const rimFuzz = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.155), this.fuzzMat);
      rimFuzz.position.set(0, 0.072, -0.002);
      earGroup.add(rimFuzz);

      return pivot;
    }

    _buildLeg(x, y, z, isFront) {
      const hip = new THREE.Group();
      hip.position.set(x, y, z);
      this.bodyPivot.add(hip);

      // Upper leg
      const upperLen = 0.21;
      const upperGeo = new THREE.CapsuleGeometry(isFront ? 0.033 : 0.039, upperLen - 0.06, 6, 10);
      upperGeo.translate(0, -upperLen * 0.5, 0);
      const upper = new THREE.Mesh(upperGeo, this.furMat);
      upper.castShadow = true;
      upper.receiveShadow = true;
      hip.add(upper);

      // Knee joint
      const knee = new THREE.Group();
      knee.position.set(0, -upperLen, 0);
      hip.add(knee);

      // Delicate knobby kid knee
      const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), this.softLightFurMat);
      knee.add(kneeCap);

      // Lower leg (slender goat cannon bone)
      const lowerLen = 0.19;
      const lowerGeo = new THREE.CapsuleGeometry(0.021, lowerLen - 0.04, 6, 10);
      lowerGeo.translate(0, -lowerLen * 0.5, 0);
      const lower = new THREE.Mesh(lowerGeo, this.softLightFurMat);
      lower.castShadow = true;
      lower.receiveShadow = true;
      knee.add(lower);

      // Split dark goat hoof
      const hoofGroup = new THREE.Group();
      hoofGroup.position.set(0, -lowerLen - 0.015, 0.008);
      knee.add(hoofGroup);

      for (const s of [-0.009, 0.009]) {
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.030, 0.032), this.hoofMat);
        toe.position.set(s, 0, 0);
        toe.castShadow = true;
        hoofGroup.add(toe);
      }

      return { hip, knee, hoofGroup };
    }

    getWorldSnoutPosition(out = new THREE.Vector3()) {
      this.group.updateMatrixWorld(true);
      return this.snoutAnchor.getWorldPosition(out);
    }

    getWorldChinPosition(out = new THREE.Vector3()) {
      this.group.updateMatrixWorld(true);
      return this.chinAnchor.getWorldPosition(out);
    }

    getHeadWorldPosition(out = new THREE.Vector3()) {
      this.group.updateMatrixWorld(true);
      return this.headPivot.getWorldPosition(out);
    }

    perkEars(amount = 1.0) {
      this.earPerk = Math.max(this.earPerk, amount);
    }

    triggerHop() {
      if (this.isMother || this.isSitting || this.hopTimer > 0) return;
      this.hopTimer = this.hopDuration;
      this.hopHeight = 0.11 + Math.random() * 0.05; // Realistic low brief kid hop
      this.perkEars(0.85);
      if (window.KoyagiAudio) window.KoyagiAudio.playHoofStep(false);
    }

    startEatingHay(duration = 3.2, withDanglingStalks = true) {
      this.chewAmount = 1.0;
      this.mouthHayAmount = withDanglingStalks ? 1.0 : 0.4;
      this.mouthHayPull = 0;
      this.actionDuration = duration;
      this.stateTimer = 0;
      this.perkEars(0.75);
    }

    standUp() {
      if (this.isSitting) {
        this.isSitting = false;
        this.perkEars(1.0);
        this.state = 'idle';
        this.stateTimer = 0;
      }
    }

    sitDown() {
      this.isSitting = true;
      this.state = 'rest';
      this.stateTimer = 0;
    }

    update(dt, env) {
      this.stateTimer += dt;
      this.breathPhase += dt * (this.isMother ? 1.7 : 2.35);

      // --- Movement toward targetX / targetZ ---
      const dx = this.targetX - this.x;
      const dz = this.targetZ - this.z;
      const dist = Math.hypot(dx, dz);

      let movingSpeed = 0;
      if (!this.isSitting && dist > 0.025) {
        const baseSpeed = this.isMother ? 0.44 : (this.state === 'hurry' ? 1.05 : 0.72);
        const step = Math.min(dist, baseSpeed * dt);
        this.x += (dx / dist) * step;
        this.z += (dz / dist) * step;
        movingSpeed = step / Math.max(dt, 0.001);

        // Smoothly face travel direction while walking
        const moveYaw = Math.atan2(dx, dz);
        this.rotY = lerpAngle(this.rotY, moveYaw, Math.min(1, dt * 5.2));
      } else {
        this.rotY = lerpAngle(this.rotY, this.targetRotY, Math.min(1, dt * 3.8));
      }

      // Walk gait & hoof audio sync
      if (movingSpeed > 0.05) {
        const freq = this.isMother ? 5.6 : 8.5;
        this.walkCycle += dt * freq * (movingSpeed / (this.isMother ? 0.44 : 0.72));
        this.stepAccum += dt * (movingSpeed / (this.isMother ? 0.44 : 0.72));
        if (this.stepAccum >= (this.isMother ? 0.46 : 0.30)) {
          this.stepAccum = 0;
          if (window.KoyagiAudio) window.KoyagiAudio.playHoofStep(this.isMother);
        }
      } else {
        // Settle legs smoothly to neutral stance
        this.walkCycle += (Math.round(this.walkCycle / Math.PI) * Math.PI - this.walkCycle) * Math.min(1, dt * 6);
      }

      // --- Sit / Prop / Rest smooth blends ---
      const sitTarget = this.isSitting ? 1 : 0;
      this.sitBlend += (sitTarget - this.sitBlend) * Math.min(1, dt * 2.2);

      const propTarget = (!this.isSitting && this.state === 'propped_wait' && dist < 0.08) ? 1 : 0;
      this.propBlend += (propTarget - this.propBlend) * Math.min(1, dt * 4.0);

      const eyeRestTarget = this.isSitting ? 0.72 : 0;
      this.eyeRestBlend += (eyeRestTarget - this.eyeRestBlend) * Math.min(1, dt * 1.6);

      // --- Realistic low brief kid hop ---
      let hopY = 0;
      let hopPitch = 0;
      if (this.hopTimer > 0) {
        this.hopTimer = Math.max(0, this.hopTimer - dt);
        const p = 1 - this.hopTimer / this.hopDuration;
        hopY = Math.sin(p * Math.PI) * this.hopHeight;
        hopPitch = Math.sin(p * Math.PI * 2) * 0.14;
        if (this.hopTimer === 0 && window.KoyagiAudio) {
          window.KoyagiAudio.playHoofStep(false);
        }
      }

      // --- Body height, pitch & breathing ---
      const breath = Math.sin(this.breathPhase) * 0.005;
      const walkBob = movingSpeed > 0.05 ? Math.abs(Math.sin(this.walkCycle)) * 0.015 : 0;
      const baseY = 0.47;
      const sitDrop = this.sitBlend * 0.275;
      const propLift = this.propBlend * 0.085;
      this.bodyPivot.position.y = baseY - sitDrop + propLift + hopY + walkBob + breath;
      this.bodyPivot.rotation.x = -this.propBlend * 0.28 + hopPitch + (this.state === 'rub_fence' ? 0.06 : 0);

      // --- Leg articulation (walk, prop on fence rail, fold when sitting, hop) ---
      const walkAmp = Math.min(1, movingSpeed / 0.55) * 0.36;
      const s1 = Math.sin(this.walkCycle);
      const s2 = Math.sin(this.walkCycle + Math.PI);

      // Front legs
      const frontPropHip = -0.88 * this.propBlend;
      const frontPropKnee = 0.58 * this.propBlend;
      const frontSitHip = -1.28 * this.sitBlend;
      const frontSitKnee = 2.15 * this.sitBlend;
      const hopTuck = hopY > 0.01 ? (hopY / this.hopHeight) * 0.42 : 0;

      this.legs.fl.hip.rotation.x = s1 * walkAmp + frontPropHip + frontSitHip - hopTuck * 0.5;
      this.legs.fl.knee.rotation.x = Math.max(0, -s1 * walkAmp * 0.9) + frontPropKnee + frontSitKnee + hopTuck;

      this.legs.fr.hip.rotation.x = s2 * walkAmp + frontPropHip + frontSitHip - hopTuck * 0.5;
      this.legs.fr.knee.rotation.x = Math.max(0, -s2 * walkAmp * 0.9) + frontPropKnee + frontSitKnee + hopTuck;

      // Back legs
      const backSitHip = 1.22 * this.sitBlend;
      const backSitKnee = -1.95 * this.sitBlend;
      this.legs.bl.hip.rotation.x = s2 * walkAmp + backSitHip + hopTuck * 0.4;
      this.legs.bl.knee.rotation.x = Math.min(0, -s2 * walkAmp * 0.6) + backSitKnee - hopTuck * 0.6;

      this.legs.br.hip.rotation.x = s1 * walkAmp + backSitHip + hopTuck * 0.4;
      this.legs.br.knee.rotation.x = Math.min(0, -s1 * walkAmp * 0.6) + backSitKnee - hopTuck * 0.6;

      // --- Tail wagging (slower as fullness grows!) ---
      const fullnessSlow = Math.max(0.22, 1 - this.fullness * 0.075);
      const wagSpeed = (this.isSitting ? 2.2 : (this.state === 'eat_carrot' || this.state === 'eat_hay' ? 13.5 : 7.5)) * fullnessSlow;
      const wagAmp = (this.isSitting ? 0.08 : (this.state === 'eat_carrot' ? 0.42 : 0.24)) * fullnessSlow;
      this.tailPhase += dt * wagSpeed;
      this.tailPivot.rotation.z = Math.sin(this.tailPhase) * wagAmp;
      this.tailPivot.rotation.x = -0.1 + Math.sin(this.tailPhase * 0.5) * 0.06;

      // --- Neck & Head posture ---
      let targetNeckPitch = 0.02;
      let targetNeckYaw = 0;
      let targetNeckReach = 0;
      let targetHeadPitch = 0.02;
      let targetHeadYaw = 0;
      let targetHeadRoll = 0;

      if (this.lookTarget && !this.isSitting) {
        // Compute local yaw & pitch toward world lookTarget
        const headPos = this.getHeadWorldPosition();
        const lx = this.lookTarget.x - headPos.x;
        const ly = this.lookTarget.y - headPos.y;
        const lz = this.lookTarget.z - headPos.z;
        const worldYaw = Math.atan2(lx, lz);
        let relYaw = normalizeAngle(worldYaw - this.rotY);
        relYaw = Math.max(-0.95, Math.min(0.95, relYaw));
        const horiz = Math.max(0.15, Math.hypot(lx, lz));
        const pitch = Math.max(-0.55, Math.min(0.95, Math.atan2(-ly, horiz)));

        targetNeckYaw = relYaw * 0.55;
        targetHeadYaw = relYaw * 0.45;
        targetNeckPitch = pitch * 0.58;
        targetHeadPitch = pitch * 0.42;
      }

      // State-specific head/neck nuances
      if (this.state === 'eat_hay') {
        targetNeckReach = 0.72;
        const dip = Math.sin(this.stateTimer * 2.2) > 0.2 ? 0.25 : 0.04;
        targetNeckPitch += dip;
        targetHeadPitch += 0.14;
      } else if (this.state === 'tug_hay') {
        targetNeckReach = 0.78;
        targetHeadRoll = Math.sin(this.stateTimer * 10) * 0.14;
        targetNeckYaw += Math.sin(this.stateTimer * 8) * 0.12;
      } else if (this.state === 'eat_carrot') {
        targetNeckReach = Math.max(this.neckReach, 0.75);
      } else if (this.state === 'drink') {
        targetNeckReach = 0.65;
        targetNeckPitch = 0.76 + Math.sin(this.stateTimer * 4.5) * 0.05;
        targetHeadPitch = 0.32;
      } else if (this.state === 'rub_fence') {
        // Gently rubbing hornless forehead against the wooden rail
        targetNeckReach = 0.35;
        targetNeckPitch = 0.32;
        targetHeadPitch = 0.45;
        targetHeadYaw = Math.sin(this.stateTimer * 5.2) * 0.22;
        targetHeadRoll = Math.sin(this.stateTimer * 5.2) * 0.16;
      } else if (this.state === 'head_bump') {
        // Playful gentle forehead-to-forehead touch
        targetNeckReach = 0.45;
        targetNeckPitch = 0.22;
        targetHeadPitch = 0.36;
      } else if (this.state === 'sniff_basket') {
        targetNeckReach = 0.58;
        targetNeckPitch = 0.42 + Math.sin(this.stateTimer * 6.5) * 0.06;
        targetHeadPitch = 0.18;
      } else if (this.state === 'eat_ground') {
        targetNeckReach = 0.55;
        targetNeckPitch = 0.88;
        targetHeadPitch = 0.24;
      } else if (this.state === 'nudge_kid') {
        targetNeckReach = 0.55;
        targetNeckPitch = 0.38;
        targetHeadPitch = 0.22;
      } else if (this.isSitting) {
        // Peaceful resting posture
        targetNeckReach = 0.0;
        targetNeckPitch = 0.08 + Math.sin(this.breathPhase * 0.6) * 0.03;
        targetHeadPitch = 0.06;
        targetHeadYaw = Math.sin(this.breathPhase * 0.35) * 0.08;
      }

      // Smooth interpolation for natural organic weight
      const k = Math.min(1, dt * 5.5);
      this.neckPitch += (targetNeckPitch - this.neckPitch) * k;
      this.neckYaw += (targetNeckYaw - this.neckYaw) * k;
      this.neckReach += (targetNeckReach - this.neckReach) * Math.min(1, dt * 4.5);
      this.headPitch += (targetHeadPitch - this.headPitch) * k;
      this.headYaw += (targetHeadYaw - this.headYaw) * k;
      this.headRoll += (targetHeadRoll - this.headRoll) * k;

      this.neckPivot.rotation.set(this.neckPitch, this.neckYaw, 0);
      this.neckPivot.position.set(0, 0.068 + this.neckReach * 0.025, 0.175 + this.neckReach * 0.115);
      this.headPivot.rotation.set(this.headPitch, this.headYaw, this.headRoll);

      // --- Authentic Horizontal Side-to-Side Goat Chewing (横に顎を動かしながら噛み) ---
      const isCudChewing = this.isSitting;
      const activeChew = this.chewAmount > 0.02 || isCudChewing;
      const chewRate = isCudChewing ? 3.2 : (this.isMother ? 5.0 : 7.6);
      this.chewPhase += dt * chewRate;

      if (this.chewAmount > 0) {
        this.chewAmount = Math.max(0, this.chewAmount - dt * (this.state === 'eat_hay' || this.state === 'eat_ground' || this.state === 'mother_eat' ? 0.12 : 0.38));
      }

      const chewAmp = isCudChewing ? 0.42 : Math.max(this.chewAmount, 0.12); // Subtle jaw micro-motion even while waiting!
      const jawCycle = Math.sin(this.chewPhase);
      const jawGrind = Math.cos(this.chewPhase); // 90 deg offset -> true circular/lateral goat grinding!

      this.jawPivot.rotation.x = Math.max(0, jawCycle) * 0.19 * chewAmp + this.jawOpen * 0.24;
      this.jawPivot.position.x = jawGrind * 0.014 * chewAmp; // Visible side-to-side horizontal grind
      this.upperLip.scale.y = 0.72 + Math.sin(this.chewPhase * 1.1) * 0.06 * chewAmp;

      // Soft chewing audio occasionally when actively munching hay
      if (this.chewAmount > 0.35 && !isCudChewing) {
        this.chewSoundTimer -= dt;
        if (this.chewSoundTimer <= 0) {
          this.chewSoundTimer = 0.42 + Math.random() * 0.32;
          if (window.KoyagiAudio) window.KoyagiAudio.playChewSoft();
        }
      }

      // --- Dangling mouth hay stalks ---
      if (this.mouthHayAmount > 0.01) {
        this.mouthHayGroup.visible = true;
        if (this.state !== 'tug_hay') {
          this.mouthHayAmount = Math.max(0, this.mouthHayAmount - dt * 0.24);
        }
        const s = 0.35 + this.mouthHayAmount * 0.85;
        this.mouthHayGroup.scale.set(1, s + this.mouthHayPull * 0.35, 1);
        this.mouthHayGroup.rotation.z = jawGrind * 0.22 + this.mouthHayPull * 0.3;
        this.mouthHayGroup.rotation.x = Math.sin(this.chewPhase * 0.8) * 0.12;
      } else {
        this.mouthHayGroup.visible = false;
      }

      // --- Ears (perk up at sound + subtle independent ear micro-twitches) ---
      this.earPerk = Math.max(0, this.earPerk - dt * 0.45);
      this.earTwitchTimer -= dt;
      if (this.earTwitchTimer <= 0) {
        this.earTwitchTimer = 1.6 + Math.random() * 3.0;
        this.earTwitchSide = Math.random() < 0.5 ? -1 : 1;
        this.earTwitchVal = 1.0;
      }
      this.earTwitchVal = Math.max(0, this.earTwitchVal - dt * 4.5);

      const perkAngle = this.earPerk * 0.34;
      const relaxDrop = this.isSitting ? -0.18 : 0;
      const twitchL = this.earTwitchSide < 0 ? Math.sin(this.earTwitchVal * Math.PI) * 0.28 : 0;
      const twitchR = this.earTwitchSide > 0 ? Math.sin(this.earTwitchVal * Math.PI) * 0.28 : 0;

      this.earLPivot.rotation.z = -(perkAngle + relaxDrop + twitchL);
      this.earLPivot.rotation.y = this.earPerk * 0.22;
      this.earRPivot.rotation.z = (perkAngle + relaxDrop + twitchR);
      this.earRPivot.rotation.y = -this.earPerk * 0.22;

      // --- Natural Blinking & Resting Half-Closed Eyes (目を細めて) ---
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = 2.6 + Math.random() * 3.8;
        this.blinkAmount = 1.0;
      }
      if (this.blinkAmount > 0) {
        this.blinkAmount = Math.max(0, this.blinkAmount - dt * 6.5);
      }
      const blinkWave = Math.sin(this.blinkAmount * Math.PI);
      const lidClose = Math.max(this.eyeRestBlend * 0.52, blinkWave);

      for (const lid of this.eyelids) {
        lid.upper.rotation.x = -0.78 + lidClose * 0.92;
        lid.lower.rotation.x = 0.42 - lidClose * 0.32;
      }

      // --- Chin water drips after drinking ---
      if (this.wetChinTimer > 0) {
        this.wetChinTimer = Math.max(0, this.wetChinTimer - dt);
        this.dripEmitTimer -= dt;
        if (this.dripEmitTimer <= 0 && env && env.spawnWaterDrip) {
          this.dripEmitTimer = 0.22 + Math.random() * 0.26;
          env.spawnWaterDrip(this.getWorldChinPosition());
        }
      }

      // Apply transform
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.rotY;
    }

    serialize() {
      return {
        x: this.x,
        z: this.z,
        rotY: this.rotY,
        zone: this.zone,
        fullness: this.fullness,
        hayEaten: this.hayEaten,
        carrotsEaten: this.carrotsEaten,
        remembersCarrot: this.remembersCarrot,
        lastAteSlot: this.lastAteSlot,
        isSitting: this.isSitting
      };
    }

    restore(data) {
      if (!data) return;
      if (typeof data.x === 'number') { this.x = this.targetX = data.x; }
      if (typeof data.z === 'number') { this.z = this.targetZ = data.z; }
      if (typeof data.rotY === 'number') { this.rotY = this.targetRotY = data.rotY; }
      if (data.zone === 'inside' || data.zone === 'outside') this.zone = data.zone;
      if (typeof data.fullness === 'number') this.fullness = data.fullness;
      if (typeof data.hayEaten === 'number') this.hayEaten = data.hayEaten;
      if (typeof data.carrotsEaten === 'number') this.carrotsEaten = data.carrotsEaten;
      this.remembersCarrot = !!data.remembersCarrot;
      this.lastAteSlot = data.lastAteSlot || null;
      this.isSitting = !!data.isSitting;
      this.sitBlend = this.isSitting ? 1 : 0;
      this.eyeRestBlend = this.isSitting ? 0.72 : 0;
      if (this.isSitting) this.state = 'rest';
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.rotY;
    }
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function lerpAngle(a, b, t) {
    return a + normalizeAngle(b - a) * t;
  }

  window.KoyagiGoat = {
    GoatActor
  };
})();
