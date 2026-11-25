// Afternoon sunlit ranch 3D world, props & tactile physics particles for こやぎの もぐもぐ
(function () {
  'use strict';

  const T = window.KoyagiTextures;

  class RanchWorld {
    constructor(scene) {
      this.scene = scene;
      this.time = 0;

      // Interactive targets & visual references
      this.troughs = {};         // 'left', 'center', 'right'
      this.basket = null;
      this.basketGroup = null;
      this.basketTiltGroup = null;
      this.basketHayCluster = null;
      this.basketCarrots = [];   // clickable leafy carrots in basket
      this.bucketGroup = null;
      this.bucketWaterMesh = null;
      this.bucketRipples = [];
      this.gatePivot = null;
      this.gateMesh = null;

      // Dynamic world items & particles
      this.heldHay = null;
      this.heldCarrot = null;
      this.looseItems = [];      // spilled hay bundles, rolled/fallen carrots, chewed carrot leaves
      this.hayParticles = [];    // fluttering dry hay leaves
      this.crumbParticles = [];  // orange carrot crunch crumbs
      this.waterDrips = [];      // chin water droplets
      this.grassInstanced = null;

      // World highlight target (ONLY one world object subtly illuminated/bobbed at a time)
      this.highlightTarget = 'basket_hay';
      this.highlightMaterials = {};

      // Gate & bucket state
      this.gateAngle = 0;        // 0 closed, ~0.16 slightly ajar invitation, ~1.55 wide open
      this.gateTargetAngle = 0;
      this.bucketBaseX = -0.52;
      this.bucketBaseZ = 0.34;
      this.bucketSlide = 0;      // 0..1 pushed closer to fence/kids
      this.bucketTargetSlide = 0;
      this.waterLevel = 1.0;     // 0.25..1.0
      this.basketTilt = 0;       // radians when tilted
      this.basketTargetTilt = 0;
      this.basketPosOffset = new THREE.Vector3();
      this.basketHayLevel = 1.0; // 0.35..1.0 (always keeps hay available!)
      this.carrotsUnlocked = false;
      this.carrotsReveal = 0;    // 0..1 smooth emergence

      // Shared materials
      this.mats = {};

      this._setupAtmosphereAndLighting();
      this._buildTerrainAndBackdrop();
      this._buildFenceAndGate();
      this._buildFeedingTroughs();
      this._buildWoodenBasket();
      this._buildTinWaterBucket();
      this._buildHeldVisuals();
    }

    _setupAtmosphereAndLighting() {
      // Soft warm golden-afternoon atmospheric haze so distant pasture blurs softly
      this.scene.fog = new THREE.FogExp2(0xe7d9be, 0.036);

      // Warm sunny afternoon sky dome (custom lightweight gradient shader)
      const skyGeo = new THREE.SphereGeometry(48, 28, 18);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x88b4dc) },
          midColor: { value: new THREE.Color(0xd5dfda) },
          horizonColor: { value: new THREE.Color(0xf4dec0) },
          sunDir: { value: new THREE.Vector3(-0.72, 0.36, -0.58).normalize() }
        },
        vertexShader: `
          varying vec3 vWorldDir;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldDir = normalize(position);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 horizonColor;
          uniform vec3 sunDir;
          varying vec3 vWorldDir;
          void main() {
            vec3 d = normalize(vWorldDir);
            float h = clamp(d.y, 0.0, 1.0);
            vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
            col = mix(col, topColor, smoothstep(0.24, 0.85, h));
            float sunAmt = max(dot(d, sunDir), 0.0);
            col += vec3(1.0, 0.90, 0.68) * pow(sunAmt, 14.0) * 0.42;
            col += vec3(1.0, 0.96, 0.84) * pow(sunAmt, 160.0) * 0.55;
            gl_FragColor = vec4(col, 1.0);
          }
        `
      });
      this.scene.add(new THREE.Mesh(skyGeo, skyMat));

      // Oblique golden afternoon directional sun from side-left-back
      // Gives warm translucent backlighting on goat ear rims & cheek fuzz + long gentle shadows
      this.sunLight = new THREE.DirectionalLight(0xffe6bd, 2.15);
      this.sunLight.position.set(-6.5, 4.2, -2.6);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.camera.near = 1.0;
      this.sunLight.shadow.camera.far = 22.0;
      this.sunLight.shadow.camera.left = -4.5;
      this.sunLight.shadow.camera.right = 4.5;
      this.sunLight.shadow.camera.top = 4.0;
      this.sunLight.shadow.camera.bottom = -3.0;
      this.sunLight.shadow.bias = -0.0006;
      this.sunLight.shadow.normalBias = 0.018;
      this.scene.add(this.sunLight);

      // Soft afternoon sky/ground hemisphere bounce (shadows NEVER pitch black!)
      const hemi = new THREE.HemisphereLight(0xd4e5f7, 0xb8a378, 1.05);
      this.scene.add(hemi);

      // Warm front-right fill bounce from sunlit earth so faces & fur show soft detail
      const fillLight = new THREE.DirectionalLight(0xfff1dc, 0.58);
      fillLight.position.set(3.5, 2.8, 4.2);
      this.scene.add(fillLight);

      // Subtle warm golden rim accent behind the goats for afternoon hair glow
      const rimLight = new THREE.DirectionalLight(0xffd79a, 0.55);
      rimLight.position.set(-4.2, 2.2, -4.8);
      this.scene.add(rimLight);
    }

    _buildTerrainAndBackdrop() {
      const groundTex = T.createGroundTexture();
      const groundGeo = new THREE.PlaneGeometry(46, 46, 48, 48);
      groundGeo.rotateX(-Math.PI * 0.5);

      // Gently sculpt rolling sunny pasture hills in the background while keeping fence/play area flat
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        let y = 0;
        if (z < -3.2) {
          const t = Math.min(1, (-z - 3.2) / 14);
          y = t * t * (1.2 + Math.sin(x * 0.25) * 0.65 + Math.cos(z * 0.22 + 0.5) * 0.45);
        } else if (Math.abs(x) > 3.5) {
          const t = Math.min(1, (Math.abs(x) - 3.5) / 10);
          y = t * t * 0.55;
        }
        pos.setY(i, y);
      }
      groundGeo.computeVertexNormals();

      const groundMat = new THREE.MeshStandardMaterial({
        map: groundTex,
        roughness: 0.94,
        metalness: 0.0
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.receiveShadow = true;
      this.scene.add(ground);

      // Subtle worn sandy-earth footpath right along the fence line
      const pathGeo = new THREE.PlaneGeometry(5.6, 1.35);
      pathGeo.rotateX(-Math.PI * 0.5);
      const pathMat = new THREE.MeshStandardMaterial({
        color: 0xb79f77,
        roughness: 0.96,
        transparent: true,
        opacity: 0.52
      });
      const path = new THREE.Mesh(pathGeo, pathMat);
      path.position.set(0, 0.004, 0.15);
      path.receiveShadow = true;
      this.scene.add(path);

      // Instanced soft afternoon grass tufts around foreground & pasture
      const bladeCount = 520;
      const bladeGeo = new THREE.ConeGeometry(0.016, 0.14, 3);
      bladeGeo.translate(0, 0.065, 0);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x8ea35a,
        roughness: 0.9
      });
      this.grassInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      for (let i = 0; i < bladeCount; i++) {
        let gx = (Math.random() - 0.5) * 14;
        let gz = -7.5 + Math.random() * 10.5;
        // Keep immediate footpath right under basket/bucket tidy
        if (Math.abs(gx) < 1.2 && Math.abs(gz - 0.45) < 0.55) {
          gz -= 1.6;
        }
        const scaleY = 0.65 + Math.random() * 1.1;
        dummy.position.set(gx, 0, gz);
        dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
        dummy.scale.set(0.8 + Math.random() * 0.6, scaleY, 0.8 + Math.random() * 0.6);
        dummy.updateMatrix();
        this.grassInstanced.setMatrixAt(i, dummy.matrix);
        col.setHSL(0.21 + (Math.random() - 0.5) * 0.04, 0.34, 0.44 + Math.random() * 0.14);
        this.grassInstanced.setColorAt(i, col);
      }
      this.grassInstanced.instanceMatrix.needsUpdate = true;
      if (this.grassInstanced.instanceColor) this.grassInstanced.instanceColor.needsUpdate = true;
      this.scene.add(this.grassInstanced);

      // Tiny white meadow clover blossoms scattered sparsely in the sunlit grass
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf7f2df, roughness: 0.85 });
      const flowerGeo = new THREE.SphereGeometry(0.015, 6, 6);
      for (let i = 0; i < 36; i++) {
        const fx = (Math.random() - 0.5) * 6.5;
        const fz = -4.2 + Math.random() * 6.0;
        if (Math.abs(fx) < 0.7 && Math.abs(fz - 0.4) < 0.7) continue;
        const f = new THREE.Mesh(flowerGeo, flowerMat);
        f.position.set(fx, 0.03, fz);
        f.scale.set(1, 0.55, 1);
        this.scene.add(f);
      }

      // Soft distant pasture trees & gentle hill treeline (blurred softly into afternoon haze)
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x765c43, roughness: 0.95 });
      const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x6f8b52, roughness: 0.92 });
      const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x859c5b, roughness: 0.92 });
      const treePositions = [
        [-6.5, -10.5, 1.35], [-3.2, -12.8, 1.15], [2.8, -13.2, 1.4],
        [6.8, -10.2, 1.25], [9.5, -8.5, 1.1], [-9.2, -8.0, 1.2]
      ];
      for (const [tx, tz, ts] of treePositions) {
        const tg = new THREE.Group();
        tg.position.set(tx, 0.35, tz);
        tg.scale.setScalar(ts);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.9, 8), trunkMat);
        trunk.position.y = 0.95;
        tg.add(trunk);

        const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 10), foliageMat1);
        c1.position.set(0, 2.45, 0);
        c1.scale.set(1.25, 0.92, 1.1);
        tg.add(c1);

        const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), foliageMat2);
        c2.position.set(-0.65, 2.2, 0.35);
        tg.add(c2);

        const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), foliageMat1);
        c3.position.set(0.7, 2.1, -0.2);
        tg.add(c3);

        this.scene.add(tg);
      }

      // Distant warm wooden ranch shed silhouette far off in the pasture haze
      const barnGroup = new THREE.Group();
      barnGroup.position.set(-4.8, 0.55, -14.5);
      barnGroup.rotation.y = 0.28;
      const barnWall = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.9, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xa67e5c, roughness: 0.92 })
      );
      barnWall.position.y = 0.95;
      barnGroup.add(barnWall);
      const barnRoof = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 1.1, 4),
        new THREE.MeshStandardMaterial({ color: 0x7b563e, roughness: 0.9 })
      );
      barnRoof.position.y = 2.45;
      barnRoof.rotation.y = Math.PI * 0.25;
      barnRoof.scale.set(1.1, 1.0, 0.85);
      barnGroup.add(barnRoof);
      this.scene.add(barnGroup);
    }

    _buildFenceAndGate() {
      const woodTex = T.createWoodTexture('fence');
      const woodBump = T.createWoodBumpTexture();

      this.mats.fenceWood = new THREE.MeshStandardMaterial({
        map: woodTex,
        bumpMap: woodBump,
        bumpScale: 0.012,
        color: 0xc99c6d, // sunlit rubbed amber wood (擦れて飴色)
        roughness: 0.78,
        metalness: 0.02
      });

      this.mats.gateWood = this.mats.fenceWood.clone();
      this.highlightMaterials.gate = this.mats.gateWood;

      const fenceGroup = new THREE.Group();
      this.scene.add(fenceGroup);

      // Fence posts (wide clear central window from x = -0.82 to x = +0.62 so both kid goats' faces & front legs are completely unobstructed!)
      const postXs = [-3.6, -2.2, -0.86, 0.62, 1.28, 2.6, 3.9];
      for (const px of postXs) {
        const postH = 0.96 + (Math.sin(px * 3.1) * 0.02);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.088, postH, 0.088), this.mats.fenceWood);
        post.position.set(px, postH * 0.5, 0);
        post.rotation.y = (Math.sin(px * 7.3) * 0.03);
        post.castShadow = true;
        post.receiveShadow = true;
        fenceGroup.add(post);

        // Weathered beveled post cap
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.024, 0.094), this.mats.fenceWood);
        cap.position.set(px, postH + 0.01, 0);
        cap.castShadow = true;
        fenceGroup.add(cap);
      }

      // Horizontal rails (left extension, central main span, right extension)
      // Gaps between ground->0.30, 0.30->0.66, and open above 0.66 so goats' faces & front legs shine clearly!
      const railSpans = [
        { x0: -3.6, x1: -0.86 },
        { x0: -0.86, x1: 0.62 },
        { x0: 1.28, x1: 3.9 }
      ];
      const railHeights = [0.30, 0.66];
      for (const span of railSpans) {
        const len = span.x1 - span.x0;
        const cx = (span.x0 + span.x1) * 0.5;
        for (const ry of railHeights) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.068, 0.036), this.mats.fenceWood);
          rail.position.set(cx, ry, 0.022);
          rail.castShadow = true;
          rail.receiveShadow = true;
          fenceGroup.add(rail);
        }
      }

      // --- Hinged Wooden Gate (木戸) between x = 0.62 (latch side) and x = 1.28 (hinge post) ---
      this.gatePivot = new THREE.Group();
      this.gatePivot.position.set(1.24, 0, 0.02);
      fenceGroup.add(this.gatePivot);

      const gateWidth = 0.58;
      const gateBody = new THREE.Group();
      this.gatePivot.add(gateBody);

      // Vertical stiles
      const hingeStile = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.80, 0.038), this.mats.gateWood);
      hingeStile.position.set(-0.028, 0.46, 0);
      hingeStile.castShadow = true;
      gateBody.add(hingeStile);

      const latchStile = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.80, 0.038), this.mats.gateWood);
      latchStile.position.set(-gateWidth + 0.028, 0.46, 0);
      latchStile.castShadow = true;
      gateBody.add(latchStile);

      // Gate horizontal slats
      for (const gy of [0.22, 0.48, 0.74]) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 0.068, 0.032), this.mats.gateWood);
        slat.position.set(-gateWidth * 0.5, gy, 0);
        slat.castShadow = true;
        slat.receiveShadow = true;
        gateBody.add(slat);
      }

      // Diagonal wooden gate brace
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.052, 0.028), this.mats.gateWood);
      brace.position.set(-gateWidth * 0.5, 0.48, -0.012);
      brace.rotation.z = 0.66;
      brace.castShadow = true;
      gateBody.add(brace);

      // Dull iron hinges & rounded wooden latch handle
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x4b4c4e, roughness: 0.55, metalness: 0.65 });
      for (const hy of [0.26, 0.70]) {
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.032, 0.048), ironMat);
        hinge.position.set(-0.02, hy, 0);
        gateBody.add(hinge);
      }
      const latchKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.085, 10), ironMat);
      latchKnob.rotation.x = Math.PI * 0.5;
      latchKnob.position.set(-gateWidth + 0.045, 0.62, 0.032);
      gateBody.add(latchKnob);

      // Invisible generous raycast hitbox for easy 5-year-old tapping/pushing of the wooden gate
      const gateHit = new THREE.Mesh(
        new THREE.BoxGeometry(gateWidth + 0.14, 0.88, 0.24),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      gateHit.position.set(-gateWidth * 0.5, 0.46, 0.04);
      gateHit.userData = { interactType: 'gate' };
      gateBody.add(gateHit);
      this.gateHitMesh = gateHit;
    }

    _buildFeedingTroughs() {
      const troughWoodTex = T.createWoodTexture('trough');
      const woodBump = T.createWoodBumpTexture();
      const hayTex = T.createHayTexture();

      this.mats.troughWood = new THREE.MeshStandardMaterial({
        map: troughWoodTex,
        bumpMap: woodBump,
        bumpScale: 0.01,
        color: 0xb78859,
        roughness: 0.82
      });

      this.mats.hayMound = new THREE.MeshStandardMaterial({
        map: hayTex,
        color: 0xd6ba74, // dry dusty golden hay (乾いてほこりっぽい金色)
        roughness: 0.93
      });

      this.mats.hayStalk = new THREE.MeshStandardMaterial({
        color: 0xd9bf78,
        roughness: 0.9
      });

      // 3 wooden feeding trough sections mounted along the fence at y = 0.59, z = 0.11
      const slots = [
        { key: 'left', x: -0.44 },
        { key: 'center', x: 0.0 },
        { key: 'right', x: 0.44 }
      ];

      for (const s of slots) {
        const g = new THREE.Group();
        g.position.set(s.x, 0.57, 0.12);
        this.scene.add(g);

        const w = 0.36, d = 0.18, h = 0.085;
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), this.mats.troughWood);
        base.position.y = 0;
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);

        // Front lip/rim (にんじんは転がると餌入れの縁で止まり)
        const frontLip = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), this.mats.troughWood);
        frontLip.position.set(0, h * 0.5, d * 0.5 - 0.01);
        frontLip.rotation.x = 0.12;
        frontLip.castShadow = true;
        frontLip.receiveShadow = true;
        g.add(frontLip);

        // Back lip against fence rail
        const backLip = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.82, 0.018), this.mats.troughWood);
        backLip.position.set(0, h * 0.4, -d * 0.5 + 0.01);
        backLip.castShadow = true;
        g.add(backLip);

        // Side wooden dividers
        for (const side of [-1, 1]) {
          const endBoard = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.95, d), this.mats.troughWood);
          endBoard.position.set(side * (w * 0.5 - 0.01), h * 0.45, 0);
          endBoard.castShadow = true;
          g.add(endBoard);
        }

        // Dynamic hay mound inside this trough slot (grows taller with more hay!)
        const moundGroup = new THREE.Group();
        moundGroup.position.set(0, 0.022, 0);
        moundGroup.visible = false;
        g.add(moundGroup);

        const moundCore = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10), this.mats.hayMound);
        moundCore.scale.set(1.15, 0.46, 0.65);
        moundCore.position.y = 0.03;
        moundCore.castShadow = true;
        moundCore.receiveShadow = true;
        moundGroup.add(moundCore);

        // Wispy 3D golden hay stalks sticking out naturally from the mound
        const stalks = [];
        for (let i = 0; i < 22; i++) {
          const st = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0022, 0.0032, 0.11 + Math.random() * 0.09, 5),
            this.mats.hayStalk
          );
          st.position.set(
            (Math.random() - 0.5) * 0.24,
            0.03 + Math.random() * 0.055,
            (Math.random() - 0.5) * 0.10
          );
          st.rotation.set(
            (Math.random() - 0.5) * 1.6,
            Math.random() * Math.PI,
            Math.PI * 0.5 + (Math.random() - 0.5) * 0.9
          );
          moundGroup.add(st);
          stalks.push(st);
        }

        // Subtle warm highlight mat for drop target invitation
        const dropZone = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.08, 0.22, d + 0.18),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        dropZone.position.set(0, 0.08, 0);
        dropZone.userData = { interactType: 'trough', slot: s.key };
        g.add(dropZone);

        this.troughs[s.key] = {
          key: s.key,
          x: s.x,
          y: 0.62,
          z: 0.12,
          group: g,
          moundGroup,
          moundCore,
          stalks,
          dropZone,
          hayAmount: 0,     // 0..3.0 (affects visible mound height!)
          spread: 0.5,      // 0 neat bundle .. 1 scattered fluffy
          lastAddedAt: 0
        };
      }
    }

    _buildWoodenBasket() {
      const basketTex = T.createWoodTexture('basket');
      const woodBump = T.createWoodBumpTexture();

      this.mats.basketWood = new THREE.MeshStandardMaterial({
        map: basketTex,
        bumpMap: woodBump,
        bumpScale: 0.009,
        color: 0xd0a876,
        roughness: 0.78
      });
      this.highlightMaterials.basket = this.mats.basketWood;

      this.mats.basketHay = new THREE.MeshStandardMaterial({
        map: T.createHayTexture(),
        color: 0xd9bf77,
        roughness: 0.92
      });
      this.highlightMaterials.basket_hay = this.mats.basketHay;

      // Root basket position right in foreground center
      this.basketGroup = new THREE.Group();
      this.basketGroup.position.set(0.02, 0, 0.88);
      this.scene.add(this.basketGroup);

      // Inner pivot so basket can tilt smoothly (籠を指で傾けると)
      this.basketTiltGroup = new THREE.Group();
      this.basketTiltGroup.position.set(0, 0.11, 0);
      this.basketGroup.add(this.basketTiltGroup);

      // Rustic small wooden wheels & skids underneath (木の手押し籠)
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x875f3c,
        roughness: 0.85
      });
      for (const side of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.026, 16), wheelMat);
        wheel.rotation.z = Math.PI * 0.5;
        wheel.position.set(side * 0.255, -0.042, -0.06);
        wheel.castShadow = true;
        this.basketTiltGroup.add(wheel);

        // Wooden rear support leg/skid
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.095, 0.032), wheelMat);
        skid.position.set(side * 0.18, -0.058, 0.10);
        skid.castShadow = true;
        this.basketTiltGroup.add(skid);
      }

      // Slatted wooden basket body
      const bw = 0.46, bd = 0.31, bh = 0.20;
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.024, bd), this.mats.basketWood);
      bottom.position.y = -0.01;
      bottom.castShadow = true;
      bottom.receiveShadow = true;
      this.basketTiltGroup.add(bottom);

      // Slatted front & back walls
      for (const zSign of [-1, 1]) {
        for (let row = 0; row < 3; row++) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.01, 0.048, 0.02), this.mats.basketWood);
          slat.position.set(0, 0.032 + row * 0.064, zSign * (bd * 0.5));
          slat.castShadow = true;
          slat.receiveShadow = true;
          this.basketTiltGroup.add(slat);
        }
      }

      // Slatted side walls
      for (const xSign of [-1, 1]) {
        for (let row = 0; row < 3; row++) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.048, bd), this.mats.basketWood);
          slat.position.set(xSign * (bw * 0.5), 0.032 + row * 0.064, 0);
          slat.castShadow = true;
          slat.receiveShadow = true;
          this.basketTiltGroup.add(slat);
        }
        // Corner wooden posts
        for (const zSign of [-1, 1]) {
          const corner = new THREE.Mesh(new THREE.BoxGeometry(0.032, bh + 0.02, 0.032), this.mats.basketWood);
          corner.position.set(xSign * (bw * 0.5 - 0.01), bh * 0.5, zSign * (bd * 0.5 - 0.01));
          corner.castShadow = true;
          this.basketTiltGroup.add(corner);
        }
      }

      // Thick rounded wooden push-handle (籠の取っ手は指が自然に収まる太さ)
      const handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, 0.16, 0.08),
        new THREE.Vector3(-0.21, 0.30, 0.14),
        new THREE.Vector3(0.0, 0.33, 0.155),
        new THREE.Vector3(0.21, 0.30, 0.14),
        new THREE.Vector3(0.22, 0.16, 0.08)
      ]);
      const handleGeo = new THREE.TubeGeometry(handleCurve, 24, 0.022, 12, false);
      const handleMesh = new THREE.Mesh(handleGeo, this.mats.basketWood);
      handleMesh.castShadow = true;
      handleMesh.receiveShadow = true;
      handleMesh.userData = { interactType: 'basket_handle' };
      this.basketTiltGroup.add(handleMesh);
      this.basketHandleMesh = handleMesh;

      // Generous invisible hitbox on basket rim/handle for tilting
      const handleHit = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.24, 0.18),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      handleHit.position.set(0, 0.24, 0.14);
      handleHit.userData = { interactType: 'basket_handle' };
      this.basketTiltGroup.add(handleHit);
      this.basketHandleHit = handleHit;

      // --- Lush 3D Hay Bundles inside the Basket ---
      this.basketHayCluster = new THREE.Group();
      this.basketHayCluster.position.set(0, 0.11, -0.01);
      this.basketTiltGroup.add(this.basketHayCluster);

      // Soft sculpted hay cushion core
      const hayBase = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 12), this.mats.basketHay);
      hayBase.scale.set(1.06, 0.52, 0.72);
      hayBase.castShadow = true;
      hayBase.receiveShadow = true;
      this.basketHayCluster.add(hayBase);

      // 46 individual curved/angled golden hay stalks for crisp tactile realism
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0xe0c782, roughness: 0.9 });
      this.basketHayStalks = [];
      for (let i = 0; i < 46; i++) {
        const len = 0.15 + Math.random() * 0.14;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0038, len, 5), stalkMat);
        st.position.set(
          (Math.random() - 0.5) * 0.34,
          0.02 + Math.random() * 0.085,
          (Math.random() - 0.5) * 0.20
        );
        st.rotation.set(
          (Math.random() - 0.5) * 1.1,
          Math.random() * Math.PI,
          Math.PI * 0.5 + (Math.random() - 0.5) * 0.75
        );
        st.castShadow = true;
        this.basketHayCluster.add(st);
        this.basketHayStalks.push(st);
      }

      // Generous raycast hitbox for pinching hay
      const hayHit = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.22, 0.30),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hayHit.position.set(0, 0.06, 0);
      hayHit.userData = { interactType: 'basket_hay' };
      this.basketHayCluster.add(hayHit);
      this.basketHayHit = hayHit;

      // --- Sunlit Leafy Baby Carrots (Discovery 2 — 葉っぱ付きの小さなにんじん) ---
      this.mats.carrotSkin = new THREE.MeshPhysicalMaterial({
        map: T.createCarrotTexture(),
        color: 0xf47a22, // glossy natural sunlit orange
        roughness: 0.30,
        metalness: 0.0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.28
      });
      this.highlightMaterials.carrot = this.mats.carrotSkin;

      this.mats.carrotCut = new THREE.MeshStandardMaterial({
        map: T.createCarrotCutTexture(),
        color: 0xffa447,
        roughness: 0.35
      });

      this.mats.carrotLeaf = new THREE.MeshStandardMaterial({
        color: 0x5c8f38,
        roughness: 0.78,
        side: THREE.DoubleSide
      });

      this.basketCarrotsGroup = new THREE.Group();
      this.basketCarrotsGroup.position.set(0.11, 0.16, 0.02);
      this.basketCarrotsGroup.visible = false;
      this.basketTiltGroup.add(this.basketCarrotsGroup);

      const carrotOffsets = [
        { x: -0.05, y: 0.035, z: -0.03, rx: 0.18, ry: 0.42, rz: 1.24 },
        { x: 0.02,  y: 0.048, z: 0.01,  rx: -0.12, ry: 0.22, rz: 1.12 },
        { x: 0.07,  y: 0.038, z: -0.04, rx: 0.25, ry: -0.18, rz: 1.32 },
        { x: -0.01, y: 0.052, z: 0.05,  rx: -0.22, ry: 0.55, rz: 1.08 }
      ];
      for (let i = 0; i < carrotOffsets.length; i++) {
        const co = carrotOffsets[i];
        const cObj = this.createCarrotMesh(1.0);
        cObj.group.position.set(co.x, co.y, co.z);
        cObj.group.rotation.set(co.rx, co.ry, co.rz);

        // Generous clickable hitbox per carrot
        const cHit = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        cHit.userData = { interactType: 'basket_carrot', carrotIndex: i };
        cObj.group.add(cHit);

        this.basketCarrotsGroup.add(cObj.group);
        this.basketCarrots.push({
          index: i,
          available: true,
          obj: cObj,
          hit: cHit,
          basePos: new THREE.Vector3(co.x, co.y, co.z)
        });
      }
    }

    // Build a realistic 3D baby carrot with feathered green leaves and dynamic bite shortening + cut cross-section!
    createCarrotMesh(remaining = 1.0) {
      const group = new THREE.Group();

      // Leafy feathered green top (at local +Y)
      const leafGroup = new THREE.Group();
      leafGroup.position.set(0, 0.072, 0);
      group.add(leafGroup);

      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + (i % 2) * 0.25;
        const stem = new THREE.Group();
        stem.rotation.set(0.32 + (i % 2) * 0.22, ang, 0);
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.078, 5), this.mats.carrotLeaf);
        frond.position.y = 0.039;
        frond.scale.set(0.8, 1.0, 0.35);
        frond.castShadow = true;
        stem.add(frond);
        leafGroup.add(stem);
      }

      // Tapered carrot body (top crown at y = +0.072, tip at y = -0.078 when remaining = 1.0)
      const fullLen = 0.15;
      const bodyPivot = new THREE.Group();
      bodyPivot.position.set(0, 0.072, 0);
      group.add(bodyPivot);

      const bodyGeo = new THREE.CylinderGeometry(0.021, 0.0085, fullLen, 14, 1, false);
      bodyGeo.translate(0, -fullLen * 0.5, 0);
      const bodyMesh = new THREE.Mesh(bodyGeo, this.mats.carrotSkin);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bodyPivot.add(bodyMesh);

      // Fresh bright orange cut cross-section cap (visible after first bite!)
      const cutDisc = new THREE.Mesh(new THREE.CircleGeometry(0.0175, 14), this.mats.carrotCut);
      cutDisc.rotation.x = Math.PI * 0.5;
      cutDisc.position.set(0, -fullLen, 0);
      cutDisc.visible = false;
      bodyPivot.add(cutDisc);

      const obj = {
        group,
        leafGroup,
        bodyPivot,
        bodyMesh,
        cutDisc,
        fullLen,
        remaining: 1.0,
        setRemaining(r) {
          this.remaining = Math.max(0, Math.min(1, r));
          if (this.remaining <= 0.06) {
            this.bodyMesh.visible = false;
            this.cutDisc.visible = false;
          } else {
            this.bodyMesh.visible = true;
            this.bodyMesh.scale.set(1, this.remaining, 1);
            // Reveal bright orange cross-section once bitten (r < 0.96)
            const bitten = this.remaining < 0.96;
            this.cutDisc.visible = bitten;
            const cutY = -this.fullLen * this.remaining - 0.001;
            const radiusScale = 0.52 + (1 - this.remaining) * 0.56;
            this.cutDisc.position.set(0, cutY, 0);
            this.cutDisc.scale.set(radiusScale, radiusScale, 1);
          }
        }
      };
      obj.setRemaining(remaining);
      return obj;
    }

    _buildTinWaterBucket() {
      const tinTex = T.createTinTexture();
      this.mats.tin = new THREE.MeshStandardMaterial({
        map: tinTex,
        color: 0xbac2c6,
        roughness: 0.42, // dull galvanized tin sheen (ブリキの鈍い反射)
        metalness: 0.58,
        side: THREE.DoubleSide
      });
      this.highlightMaterials.bucket = this.mats.tin;

      this.bucketGroup = new THREE.Group();
      this.bucketGroup.position.set(this.bucketBaseX, 0, this.bucketBaseZ);
      this.scene.add(this.bucketGroup);

      // Tapered bucket body via LatheGeometry
      const pts = [
        new THREE.Vector2(0.0, 0.004),
        new THREE.Vector2(0.105, 0.004),
        new THREE.Vector2(0.132, 0.22),
        new THREE.Vector2(0.139, 0.228),
        new THREE.Vector2(0.130, 0.232),
        new THREE.Vector2(0.125, 0.218)
      ];
      const bucketGeo = new THREE.LatheGeometry(pts, 24);
      const bucketMesh = new THREE.Mesh(bucketGeo, this.mats.tin);
      bucketMesh.castShadow = true;
      bucketMesh.receiveShadow = true;
      this.bucketGroup.add(bucketMesh);

      // Wire bail handle resting slightly tilted on rim
      const wireCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.134, 0.21, 0),
        new THREE.Vector3(-0.12, 0.14, 0.115),
        new THREE.Vector3(0, 0.115, 0.15),
        new THREE.Vector3(0.12, 0.14, 0.115),
        new THREE.Vector3(0.134, 0.21, 0)
      ]);
      const wireMat = new THREE.MeshStandardMaterial({ color: 0x7a8084, roughness: 0.4, metalness: 0.72 });
      const wire = new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 20, 0.0045, 6, false), wireMat);
      this.bucketGroup.add(wire);

      // Clear sunlit water surface inside bucket
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x9ec4d4,
        roughness: 0.10,
        metalness: 0.08,
        transparent: true,
        opacity: 0.84,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08
      });
      this.bucketWaterMesh = new THREE.Mesh(new THREE.CircleGeometry(0.123, 24), waterMat);
      this.bucketWaterMesh.rotation.x = -Math.PI * 0.5;
      this.bucketWaterMesh.position.y = 0.195;
      this.bucketGroup.add(this.bucketWaterMesh);

      // Expanding ripple rings on water surface
      const ringGeo = new THREE.RingGeometry(0.015, 0.023, 24);
      ringGeo.rotateX(-Math.PI * 0.5);
      for (let i = 0; i < 3; i++) {
        const rm = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({
            color: 0xf4fbff,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
          })
        );
        rm.position.y = 0.198;
        this.bucketGroup.add(rm);
        this.bucketRipples.push({ mesh: rm, age: 99, active: false });
      }

      // Generous raycast hitbox for pushing bucket
      const bucketHit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.16, 0.28, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      bucketHit.position.y = 0.14;
      bucketHit.userData = { interactType: 'bucket' };
      this.bucketGroup.add(bucketHit);
      this.bucketHitMesh = bucketHit;
    }

    _buildHeldVisuals() {
      // 3D Hay pinch carried by the child's finger
      this.heldHay = new THREE.Group();
      this.heldHay.visible = false;
      this.scene.add(this.heldHay);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), this.mats.basketHay);
      core.scale.set(1.25, 0.72, 0.92);
      core.castShadow = true;
      this.heldHay.add(core);

      const stalkMat = new THREE.MeshStandardMaterial({ color: 0xe3cb86, roughness: 0.9 });
      for (let i = 0; i < 18; i++) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.003, 0.12 + Math.random() * 0.08, 5), stalkMat);
        st.position.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.06);
        st.rotation.set(Math.random() * 1.4, Math.random() * Math.PI, Math.random() * 1.4);
        this.heldHay.add(st);
      }

      // 3D Carrot held by the child's finger (orient tip forward toward goats!)
      this.heldCarrot = this.createCarrotMesh(1.0);
      this.heldCarrot.group.visible = false;
      this.heldCarrot.group.rotation.set(Math.PI * 0.48, 0, 0.15);
      this.scene.add(this.heldCarrot.group);
    }

    // Spawn dry fluttering hay blades (乾いた葉が数本ひらひら落ちます)
    spawnHayLeaves(pos, count = 6, spreadVel = 0.6) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xdec47c, roughness: 0.9 });
      for (let i = 0; i < count; i++) {
        const len = 0.045 + Math.random() * 0.055;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0024, len, 4), mat);
        mesh.position.set(
          pos.x + (Math.random() - 0.5) * 0.12,
          pos.y + (Math.random() - 0.5) * 0.06,
          pos.z + (Math.random() - 0.5) * 0.10
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.scene.add(mesh);
        this.hayParticles.push({
          mesh,
          vx: (Math.random() - 0.5) * spreadVel,
          vy: 0.18 + Math.random() * 0.35 * spreadVel,
          vz: (Math.random() - 0.5) * spreadVel,
          rx: (Math.random() - 0.5) * 5,
          rz: (Math.random() - 0.5) * 5,
          life: 1.4 + Math.random() * 1.1,
          maxLife: 2.5
        });
      }
    }

    // Spawn crisp orange carrot crumbs on bite
    spawnCarrotCrumbs(pos, count = 7) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xf4862c, roughness: 0.4 });
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.008 + Math.random() * 0.006, 0), mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this.crumbParticles.push({
          mesh,
          vx: (Math.random() - 0.5) * 0.65,
          vy: 0.25 + Math.random() * 0.35,
          vz: (Math.random() - 0.5) * 0.65,
          life: 0.8 + Math.random() * 0.4
        });
      }
    }

    // Spawn glistening water droplet dripping from goat's chin (顎から水滴がしたたります)
    spawnWaterDrip(pos) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xdff4ff,
        roughness: 0.05,
        metalness: 0.05,
        transparent: true,
        opacity: 0.86,
        clearcoat: 1.0
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 8), mat);
      mesh.scale.set(0.85, 1.35, 0.85);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.waterDrips.push({
        mesh,
        vy: -0.08,
        life: 0.85
      });
    }

    triggerWaterRipple() {
      const r = this.bucketRipples.find(item => !item.active) || this.bucketRipples[0];
      r.active = true;
      r.age = 0;
      r.mesh.scale.setScalar(1);
      r.mesh.material.opacity = 0.65;
    }

    // Add hay into a trough slot (speed affects fluffiness/scatter & mound height grows with amount)
    addHayToTrough(slotKey, amount = 0.7, speed = 0.4) {
      const slot = this.troughs[slotKey];
      if (!slot) return;
      slot.hayAmount = Math.min(2.6, slot.hayAmount + amount);
      slot.spread = Math.min(1.0, Math.max(0.15, speed * 0.75));
      slot.lastAddedAt = this.time;
      this.updateTroughVisual(slotKey);

      const leafCount = speed > 0.7 ? 12 : 5;
      this.spawnHayLeaves(new THREE.Vector3(slot.x, slot.y + 0.07, slot.z), leafCount, 0.35 + speed * 0.75);
    }

    updateTroughVisual(slotKey) {
      const slot = this.troughs[slotKey];
      if (!slot) return;
      if (slot.hayAmount <= 0.02) {
        slot.moundGroup.visible = false;
        return;
      }
      slot.moundGroup.visible = true;
      // Height grows visibly with stacked hay amount (量によって餌入れに山ができる高さが変わります)
      const hScale = 0.35 + slot.hayAmount * 0.58;
      const wScale = 0.78 + Math.min(1.0, slot.hayAmount) * 0.28 + slot.spread * 0.14;
      slot.moundGroup.scale.set(wScale, hScale, 0.85 + slot.spread * 0.18);
    }

    // Spawn a loose spilled hay cluster, rolled carrot, or chewed carrot leaf remnant on meadow/trough
    spawnLooseItem(type, x, y, z, remaining = 1.0, onTroughRim = false) {
      // Keep loose items capped cleanly so scene stays lively & fast
      if (this.looseItems.length > 26) {
        const oldest = this.looseItems.shift();
        this.scene.remove(oldest.mesh);
      }

      let mesh, obj = null;
      if (type === 'hay') {
        mesh = new THREE.Group();
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), this.mats.hayMound);
        tuft.scale.set(1.25, 0.36, 0.95);
        tuft.castShadow = true;
        tuft.receiveShadow = true;
        mesh.add(tuft);
        for (let i = 0; i < 10; i++) {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.0028, 0.10, 4), this.mats.hayStalk);
          st.position.set((Math.random() - 0.5) * 0.10, 0.015, (Math.random() - 0.5) * 0.08);
          st.rotation.set(Math.PI * 0.5 + (Math.random() - 0.5) * 0.4, Math.random() * Math.PI, 0);
          mesh.add(st);
        }
      } else if (type === 'carrot' || type === 'carrot_leaf') {
        obj = this.createCarrotMesh(type === 'carrot_leaf' ? 0.04 : remaining);
        mesh = obj.group;
        mesh.rotation.set(Math.PI * 0.5, Math.random() * Math.PI * 2, 0);
      }

      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      // Hitbox if pickupable carrot
      let hit = null;
      if (type === 'carrot' && remaining > 0.15) {
        hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.userData = { interactType: 'loose_carrot' };
        mesh.add(hit);
      }

      const item = {
        id: 'item_' + Math.random().toString(36).slice(2, 8),
        type, // 'hay' | 'carrot' | 'carrot_leaf'
        mesh,
        obj,
        hit,
        x, y, z,
        vx: 0, vy: 0, vz: 0,
        remaining,
        onTroughRim,
        edible: type === 'hay' || (type === 'carrot' && remaining > 0.12)
      };
      if (hit) hit.userData.looseItem = item;
      this.looseItems.push(item);
      return item;
    }

    // Spill hay & carrots from tilted basket onto the meadow grass (籠を傾けると中身がまとめてこぼれます)
    spillBasketContents(tiltDir = -1) {
      const bx = this.basketGroup.position.x + tiltDir * 0.28;
      const bz = this.basketGroup.position.z - 0.16;

      // 3 fresh hay clusters tumble onto the grass
      for (let i = 0; i < 3; i++) {
        const tx = bx + tiltDir * (0.06 + i * 0.14) + (Math.random() - 0.5) * 0.14;
        const tz = bz + (Math.random() - 0.5) * 0.26;
        const item = this.spawnLooseItem('hay', tx, 0.03, tz, 1.0, false);
        item.vx = tiltDir * (0.25 + Math.random() * 0.2);
        item.vy = 0.25;
      }
      this.spawnHayLeaves(new THREE.Vector3(bx, 0.24, bz), 14, 0.85);

      // Up to 2 available carrots roll onto the grass
      let spilledCarrots = 0;
      for (const bc of this.basketCarrots) {
        if (this.carrotsUnlocked && bc.available && spilledCarrots < 2) {
          bc.available = false;
          bc.obj.group.visible = false;
          const cx = bx + tiltDir * (0.14 + spilledCarrots * 0.16);
          const cz = bz + (spilledCarrots === 0 ? -0.10 : 0.10);
          const item = this.spawnLooseItem('carrot', cx, 0.03, cz, 1.0, false);
          item.vx = tiltDir * 0.35;
          item.vy = 0.22;
          spilledCarrots++;
        }
      }

      // Basket keeps a bit of hay so play never runs dry
      this.basketHayLevel = Math.max(0.45, this.basketHayLevel - 0.28);
    }

    replenishCarrotsIfEmpty() {
      if (!this.carrotsUnlocked) return;
      const anyLeft = this.basketCarrots.some(c => c.available);
      if (!anyLeft) {
        for (const c of this.basketCarrots) {
          c.available = true;
          c.obj.setRemaining(1.0);
          c.obj.group.visible = true;
        }
      }
    }

    getWorldPositionOfHighlight() {
      const v = new THREE.Vector3();
      if (this.highlightTarget === 'basket_hay') {
        this.basketHayCluster.getWorldPosition(v);
        v.y += 0.08;
      } else if (this.highlightTarget === 'carrot') {
        const c = this.basketCarrots.find(x => x.available) || this.basketCarrots[0];
        c.obj.group.getWorldPosition(v);
      } else if (this.highlightTarget === 'bucket') {
        this.bucketGroup.getWorldPosition(v);
        v.y += 0.16;
      } else if (this.highlightTarget === 'gate') {
        this.gateHitMesh.getWorldPosition(v);
      } else if (this.highlightTarget === 'basket_tilt') {
        this.basketHandleMesh.getWorldPosition(v);
      } else {
        this.basketGroup.getWorldPosition(v);
        v.y += 0.22;
      }
      return v;
    }

    update(dt) {
      this.time += dt;

      // Smooth gate swing
      this.gateAngle += (this.gateTargetAngle - this.gateAngle) * Math.min(1, dt * 4.5);
      this.gatePivot.rotation.y = this.gateAngle;

      // Smooth water bucket slide & water level
      this.bucketSlide += (this.bucketTargetSlide - this.bucketSlide) * Math.min(1, dt * 5.0);
      this.bucketGroup.position.set(
        this.bucketBaseX + this.bucketSlide * 0.08,
        0,
        this.bucketBaseZ - this.bucketSlide * 0.20
      );
      const waterY = 0.065 + this.waterLevel * 0.132;
      this.bucketWaterMesh.position.y = waterY;
      const waterRadiusScale = 0.85 + this.waterLevel * 0.15;
      this.bucketWaterMesh.scale.setScalar(waterRadiusScale);

      // Animate water ripples
      for (const r of this.bucketRipples) {
        if (!r.active) continue;
        r.age += dt;
        const p = r.age / 0.85;
        if (p >= 1) {
          r.active = false;
          r.mesh.material.opacity = 0;
        } else {
          r.mesh.position.y = waterY + 0.003;
          r.mesh.scale.setScalar(1 + p * 4.2);
          r.mesh.material.opacity = (1 - p) * 0.58;
        }
      }

      // Smooth basket tilt & gentle hay replenishment
      this.basketTilt += (this.basketTargetTilt - this.basketTilt) * Math.min(1, dt * 6.5);
      this.basketTiltGroup.rotation.z = this.basketTilt;
      this.basketGroup.position.set(
        0.02 + this.basketPosOffset.x,
        0,
        0.88 + this.basketPosOffset.z
      );
      if (this.basketHayLevel < 0.85) {
        this.basketHayLevel = Math.min(0.85, this.basketHayLevel + dt * 0.025);
      }
      this.basketHayCluster.scale.set(1, 0.65 + this.basketHayLevel * 0.45, 1);

      // Smooth carrot emergence in Discovery 2
      if (this.carrotsUnlocked) {
        this.basketCarrotsGroup.visible = true;
        this.carrotsReveal = Math.min(1, this.carrotsReveal + dt * 0.7);
        this.basketCarrotsGroup.position.y = 0.08 + this.carrotsReveal * 0.095;
      }

      // Subtle single-object sunlit world highlight (only ONE next-touchable object pulses softly!)
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4);
      const clearEmissive = (mat) => {
        if (mat && mat.emissive) {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      };
      clearEmissive(this.mats.basketHay);
      clearEmissive(this.mats.carrotSkin);
      clearEmissive(this.mats.tin);
      clearEmissive(this.mats.gateWood);
      clearEmissive(this.mats.basketWood);

      // Reset small gentle invitation bounce
      this.basketHayCluster.position.y = 0.11;
      this.bucketGroup.position.y = 0;

      if (this.highlightTarget === 'basket_hay') {
        this.mats.basketHay.emissive.setHex(0xffe194);
        this.mats.basketHay.emissiveIntensity = 0.09 + pulse * 0.14;
        this.basketHayCluster.position.y = 0.11 + pulse * 0.012;
      } else if (this.highlightTarget === 'carrot' && this.carrotsUnlocked) {
        this.mats.carrotSkin.emissive.setHex(0xffb454);
        this.mats.carrotSkin.emissiveIntensity = 0.10 + pulse * 0.18;
        for (const bc of this.basketCarrots) {
          if (bc.available) {
            bc.obj.group.position.y = bc.basePos.y + pulse * 0.012;
          }
        }
      } else if (this.highlightTarget === 'bucket') {
        this.mats.tin.emissive.setHex(0xd6ecff);
        this.mats.tin.emissiveIntensity = 0.08 + pulse * 0.15;
        this.bucketGroup.position.y = pulse * 0.009;
      } else if (this.highlightTarget === 'gate') {
        this.mats.gateWood.emissive.setHex(0xffd996);
        this.mats.gateWood.emissiveIntensity = 0.08 + pulse * 0.16;
      } else if (this.highlightTarget === 'basket_tilt') {
        this.mats.basketWood.emissive.setHex(0xffdca0);
        this.mats.basketWood.emissiveIntensity = 0.08 + pulse * 0.14;
      }

      // Update fluttering dry hay leaf particles
      for (let i = this.hayParticles.length - 1; i >= 0; i--) {
        const p = this.hayParticles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.hayParticles.splice(i, 1);
          continue;
        }
        p.vy -= 1.05 * dt; // light dry flutter fall
        p.vx += Math.sin(this.time * 6 + i) * 0.28 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y = Math.max(0.015, p.mesh.position.y + p.vy * dt);
        p.mesh.position.z += p.vz * dt;
        if (p.mesh.position.y > 0.02) {
          p.mesh.rotation.x += p.rx * dt;
          p.mesh.rotation.z += p.rz * dt;
        } else {
          p.vx *= 0.85;
          p.vz *= 0.85;
        }
      }

      // Update carrot crunch crumbs
      for (let i = this.crumbParticles.length - 1; i >= 0; i--) {
        const c = this.crumbParticles[i];
        c.life -= dt;
        if (c.life <= 0) {
          this.scene.remove(c.mesh);
          this.crumbParticles.splice(i, 1);
          continue;
        }
        c.vy -= 3.6 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y = Math.max(0.01, c.mesh.position.y + c.vy * dt);
        c.mesh.position.z += c.vz * dt;
      }

      // Update glistening chin water drips
      for (let i = this.waterDrips.length - 1; i >= 0; i--) {
        const d = this.waterDrips[i];
        d.life -= dt;
        d.vy -= 4.2 * dt;
        d.mesh.position.y += d.vy * dt;
        if (d.life <= 0 || d.mesh.position.y <= 0.02) {
          if (d.mesh.position.y <= 0.22 && Math.hypot(d.mesh.position.x - this.bucketGroup.position.x, d.mesh.position.z - this.bucketGroup.position.z) < 0.2) {
            this.triggerWaterRipple();
          }
          if (window.KoyagiAudio && Math.random() < 0.55) {
            window.KoyagiAudio.playWaterDrip();
          }
          this.scene.remove(d.mesh);
          this.waterDrips.splice(i, 1);
        }
      }

      // Settle loose dropped items smoothly (carrots roll & stop at trough rim or settle on grass!)
      for (const item of this.looseItems) {
        if (Math.abs(item.vx) > 0.005 || Math.abs(item.vy) > 0.005 || Math.abs(item.vz) > 0.005) {
          item.vy -= 3.8 * dt;
          item.x += item.vx * dt;
          item.y += item.vy * dt;
          item.z += item.vz * dt;

          const floorY = item.onTroughRim ? 0.625 : 0.028;
          if (item.y <= floorY) {
            item.y = floorY;
            item.vy = 0;
            item.vx *= 0.84;
            item.vz *= 0.84;
            if (item.onTroughRim) {
              // Stops cleanly at trough front lip (転がると餌入れの縁で止まり)
              item.z = Math.min(0.19, Math.max(0.06, item.z));
            }
          }
          item.mesh.position.set(item.x, item.y, item.z);
          if (item.type === 'carrot') {
            item.mesh.rotation.z += (item.vx + item.vz) * dt * 8;
          }
        }
      }
    }

    serialize() {
      return {
        troughs: {
          left: this.troughs.left.hayAmount,
          center: this.troughs.center.hayAmount,
          right: this.troughs.right.hayAmount
        },
        basketHayLevel: Math.max(0.55, this.basketHayLevel), // Always keep hay ready to try!
        carrotsUnlocked: this.carrotsUnlocked,
        carrotsAvailable: this.basketCarrots.map(c => c.available),
        bucketSlide: this.bucketTargetSlide,
        waterLevel: this.waterLevel,
        gateOpen: this.gateTargetAngle > 0.5,
        gateAjar: this.gateTargetAngle > 0.1 && this.gateTargetAngle <= 0.5,
        looseItems: this.looseItems.slice(-18).map(it => ({
          type: it.type,
          x: it.x,
          y: it.y,
          z: it.z,
          remaining: it.remaining,
          onTroughRim: it.onTroughRim
        }))
      };
    }

    restore(data) {
      if (!data) return;
      if (data.troughs) {
        for (const k of ['left', 'center', 'right']) {
          if (typeof data.troughs[k] === 'number') {
            this.troughs[k].hayAmount = Math.max(0, Math.min(2.6, data.troughs[k]));
            this.updateTroughVisual(k);
          }
        }
      }
      // Guarantee usable hay in basket when returning!
      this.basketHayLevel = Math.max(0.6, typeof data.basketHayLevel === 'number' ? data.basketHayLevel : 0.9);
      this.carrotsUnlocked = !!data.carrotsUnlocked;
      if (this.carrotsUnlocked) {
        this.carrotsReveal = 1;
        this.basketCarrotsGroup.visible = true;
        if (Array.isArray(data.carrotsAvailable)) {
          this.basketCarrots.forEach((c, idx) => {
            c.available = data.carrotsAvailable[idx] !== false;
            c.obj.group.visible = c.available;
          });
        }
        this.replenishCarrotsIfEmpty();
      }
      if (typeof data.bucketSlide === 'number') {
        this.bucketSlide = this.bucketTargetSlide = Math.max(0, Math.min(1, data.bucketSlide));
      }
      if (typeof data.waterLevel === 'number') {
        this.waterLevel = Math.max(0.25, Math.min(1, data.waterLevel));
      }
      if (data.gateOpen) {
        this.gateAngle = this.gateTargetAngle = 1.52;
      } else if (data.gateAjar) {
        this.gateAngle = this.gateTargetAngle = 0.22;
      }
      if (Array.isArray(data.looseItems)) {
        for (const it of data.looseItems) {
          this.spawnLooseItem(it.type, it.x, it.y, it.z, it.remaining, !!it.onTroughRim);
        }
      }
    }
  }

  window.KoyagiWorld = {
    RanchWorld
  };
})();
