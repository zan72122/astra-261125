(function (global) {
  'use strict';

  const STUMP_TOP_Y = 0.56;
  const STUMP_RADIUS = 0.72;
  const CRACK_POS = new THREE.Vector3(0.29, STUMP_TOP_Y, 0.19);
  const PLATE_POS = new THREE.Vector3(-0.34, 0.04, 0.95);
  const POUCH_POS = new THREE.Vector3(0.36, 0.04, 0.92);

  const ROOT_HOLLOWS = [
    new THREE.Vector3(0.72, 0.03, -0.26),
    new THREE.Vector3(0.28, 0.03, -0.72),
    new THREE.Vector3(-0.62, 0.03, -0.56),
    new THREE.Vector3(0.96, 0.03, 0.30),
    new THREE.Vector3(-0.88, 0.03, 0.36),
  ];

  const CHIPMUNK2_TREE_POS = new THREE.Vector3(-1.42, 0, -0.98);
  const CHIPMUNK2_PEEK_POS = new THREE.Vector3(-1.02, 0.04, -0.66);

  function seededRand(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Create a sculpted 3D curled autumn leaf geometry
  function createCurledLeafGeometry(scale = 1.0) {
    const geo = new THREE.PlaneGeometry(0.16 * scale, 0.21 * scale, 4, 5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const nx = x / (0.08 * scale);
      const ny = y / (0.105 * scale);
      // Cup edges gently upward + slight arch along midrib for authentic dry leaf curl
      const curl = (nx * nx * 0.016 + (1 - ny * ny) * 0.010 + ny * 0.008) * scale;
      pos.setZ(i, curl);
    }
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  class ForestWorld {
    constructor(scene) {
      this.scene = scene;
      this.STUMP_TOP_Y = STUMP_TOP_Y;
      this.STUMP_RADIUS = STUMP_RADIUS;
      this.CRACK_POS = CRACK_POS.clone();
      this.PLATE_POS = PLATE_POS.clone();
      this.POUCH_POS = POUCH_POS.clone();
      this.ROOT_HOLLOWS = ROOT_HOLLOWS.map((v) => v.clone());
      this.CHIPMUNK2_TREE_POS = CHIPMUNK2_TREE_POS.clone();
      this.CHIPMUNK2_PEEK_POS = CHIPMUNK2_PEEK_POS.clone();

      this.textures = {};
      this.materials = {};
      this.pouchOpen = false;
      this.pouchOpenAnim = 0.0;
      this.walnutUnlocked = false;
      this.plateAngle = 0.22;

      this.dappleLayers = [];
      this.dustMotes = null;
      this.dustBasePositions = [];

      this._initTexturesAndMaterials();
      this._initSkyAndLights();
      this._buildGroundAndForest();
      this._buildStumpAndRoots();
      this._buildForegroundDetails();
      this._buildWoodenPlate();
      this._buildClothPouch();
      this._buildSunDust();
    }

    _initTexturesAndMaterials() {
      const FT = global.ForestTextures;
      const bark = FT.createBarkTextures();
      const stumpTop = FT.createStumpTopTextures();
      const moss = FT.createMossTextures();
      const ground = FT.createGroundTextures();
      const acorn = FT.createAcornTextures();
      const walnut = FT.createWalnutTextures();
      const linen = FT.createLinenTextures();

      this.textures = {
        bark,
        stumpTop,
        moss,
        ground,
        acorn,
        walnut,
        linen,
        seed: FT.createSunflowerSeedTexture(),
        plate: FT.createWoodPlateTexture(),
        dapple: FT.createDappleTexture(),
        leafRed: FT.createAutumnLeafTexture('red'),
        leafGold: FT.createAutumnLeafTexture('gold'),
        leafAmber: FT.createAutumnLeafTexture('amber'),
      };

      this.materials = {
        bark: new THREE.MeshStandardMaterial({
          map: bark.map,
          bumpMap: bark.bumpMap,
          bumpScale: 0.035,
          roughness: 0.88,
          metalness: 0.0,
        }),
        stumpTop: new THREE.MeshStandardMaterial({
          map: stumpTop.map,
          bumpMap: stumpTop.bumpMap,
          bumpScale: 0.022,
          roughness: 0.76,
          metalness: 0.0,
        }),
        moss: new THREE.MeshStandardMaterial({
          map: moss.map,
          bumpMap: moss.bumpMap,
          bumpScale: 0.026,
          roughness: 0.50, // damp morning sheen
          metalness: 0.02,
        }),
        ground: new THREE.MeshStandardMaterial({
          map: ground.map,
          bumpMap: ground.bumpMap,
          bumpScale: 0.028,
          roughness: 0.90,
          metalness: 0.0,
        }),
        acornNut: new THREE.MeshStandardMaterial({
          map: acorn.nutMap,
          roughness: 0.22, // glossy brown acorn
          metalness: 0.04,
        }),
        acornCap: new THREE.MeshStandardMaterial({
          map: acorn.capMap,
          bumpMap: acorn.capBump,
          bumpScale: 0.024,
          roughness: 0.86,
        }),
        walnut: new THREE.MeshStandardMaterial({
          map: walnut.map,
          bumpMap: walnut.bumpMap,
          bumpScale: 0.03,
          roughness: 0.80,
        }),
        walnutInside: new THREE.MeshStandardMaterial({
          color: 0xd9be8c,
          roughness: 0.72,
        }),
        seed: new THREE.MeshStandardMaterial({
          map: this.textures.seed,
          roughness: 0.42,
        }),
        linen: new THREE.MeshStandardMaterial({
          map: linen.map,
          bumpMap: linen.bumpMap,
          bumpScale: 0.018,
          roughness: 0.92,
          side: THREE.DoubleSide,
        }),
        linenInner: new THREE.MeshStandardMaterial({
          color: 0x5c4734,
          roughness: 0.98,
          side: THREE.BackSide,
        }),
        cord: new THREE.MeshStandardMaterial({
          color: 0x9b7a52,
          roughness: 0.88,
        }),
        plate: new THREE.MeshStandardMaterial({
          map: this.textures.plate,
          roughness: 0.48,
        }),
        leaves: [
          new THREE.MeshStandardMaterial({
            map: this.textures.leafRed,
            alphaTest: 0.35,
            roughness: 0.68,
            side: THREE.DoubleSide,
          }),
          new THREE.MeshStandardMaterial({
            map: this.textures.leafGold,
            alphaTest: 0.35,
            roughness: 0.64,
            side: THREE.DoubleSide,
          }),
          new THREE.MeshStandardMaterial({
            map: this.textures.leafAmber,
            alphaTest: 0.35,
            roughness: 0.66,
            side: THREE.DoubleSide,
          }),
        ],
      };
    }

    _initSkyAndLights() {
      // Warm bright autumn morning forest backdrop (never gloomy/dark)
      this.scene.background = new THREE.Color(0xc9d7b6);
      this.scene.fog = new THREE.FogExp2(0xc7cfaf, 0.072);

      // Soft warm sunlit sky & earthy moss bounce
      this.hemiLight = new THREE.HemisphereLight(0xfff5dc, 0x867452, 1.08);
      this.scene.add(this.hemiLight);

      // Primary morning sun casting crisp soft shadows and golden dapples
      this.sunLight = new THREE.DirectionalLight(0xfff0c8, 2.35);
      this.sunLight.position.set(2.4, 5.2, 2.1);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.camera.near = 0.5;
      this.sunLight.shadow.camera.far = 16;
      const d = 3.2;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.015;
      this.scene.add(this.sunLight);

      // Warm golden backlight from upper-back canopy so the chipmunk's tail fur glows golden!
      this.rimLight = new THREE.DirectionalLight(0xffd98a, 1.45);
      this.rimLight.position.set(-1.8, 2.8, -3.4);
      this.scene.add(this.rimLight);

      // Gentle front fill so the chipmunk's face, stripes, and dark glossy eyes stay clearly legible
      this.fillLight = new THREE.DirectionalLight(0xfff6e5, 0.52);
      this.fillLight.position.set(0.5, 1.6, 3.6);
      this.scene.add(this.fillLight);
    }

    _buildGroundAndForest() {
      const rand = seededRand(202611);

      // Gently undulating sunlit autumn forest path terrain
      const groundGeo = new THREE.PlaneGeometry(24, 24, 56, 56);
      groundGeo.rotateX(-Math.PI / 2);
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.hypot(x, z);
        // Keep central path area gently flat/natural, rise gently into mossy banks further out
        const bank = Math.max(0, r - 2.4) * 0.14;
        const gentle = Math.sin(x * 0.9) * Math.cos(z * 0.8) * 0.045 + Math.sin(x * 2.1 + z * 1.7) * 0.018;
        const h = Math.max(0, gentle * Math.min(1, r / 1.2) + bank);
        pos.setY(i, h);
      }
      groundGeo.computeVertexNormals();

      this.groundMesh = new THREE.Mesh(groundGeo, this.materials.ground);
      this.groundMesh.receiveShadow = true;
      this.groundMesh.name = 'forest-ground';
      this.scene.add(this.groundMesh);

      // Animated morning dapple light overlays hovering subtly just above ground & stump
      const dappleMatGround = new THREE.MeshBasicMaterial({
        map: this.textures.dapple,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dappleGround = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), dappleMatGround);
      dappleGround.rotation.x = -Math.PI / 2;
      dappleGround.position.set(0.1, 0.055, 0.25);
      this.scene.add(dappleGround);
      this.dappleLayers.push({ mesh: dappleGround, baseX: 0.1, baseZ: 0.25, speed: 0.35, amp: 0.08 });

      const dappleMatStump = new THREE.MeshBasicMaterial({
        map: this.textures.dapple,
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dappleStump = new THREE.Mesh(new THREE.CircleGeometry(STUMP_RADIUS * 0.98, 28), dappleMatStump);
      dappleStump.rotation.x = -Math.PI / 2;
      dappleStump.position.set(0, STUMP_TOP_Y + 0.004, 0);
      this.scene.add(dappleStump);
      this.dappleLayers.push({ mesh: dappleStump, baseX: 0, baseZ: 0, speed: 0.42, amp: 0.03 });

      // Hero tree trunk behind-left (where Chipmunk 2 peeks out!)
      this._buildTreeTrunk(CHIPMUNK2_TREE_POS.x, CHIPMUNK2_TREE_POS.z, 0.42, 5.5, true);

      // Background forest trees framing the autumn morning path warmly
      const bgTrees = [
        [-3.2, -2.5, 0.48, 7.0],
        [-0.3, -3.6, 0.40, 6.5],
        [2.2, -2.9, 0.46, 6.8],
        [3.6, -1.4, 0.38, 6.2],
        [-3.4, 0.4, 0.36, 6.0],
        [1.1, -4.8, 0.52, 7.5],
        [-2.0, -5.2, 0.50, 7.5],
      ];
      for (const [tx, tz, rad, h] of bgTrees) {
        this._buildTreeTrunk(tx, tz, rad, h, false);
      }

      // Soft sunlit autumn foliage bushes & distant ferns in background (warm golds, russets, forest greens)
      const bushPalette = [0xb9682e, 0xd49c36, 0x627c3d, 0xa84b2a, 0x7a8d42];
      for (let i = 0; i < 24; i++) {
        const angle = -Math.PI * 0.92 + (i / 23) * Math.PI * 1.15 + (rand() - 0.5) * 0.14;
        const dist = 2.6 + rand() * 3.8;
        const bx = Math.cos(angle) * dist;
        const bz = Math.sin(angle) * dist - 0.8;
        if (bz > 0.7 && Math.abs(bx) < 2.2) continue;

        const grp = new THREE.Group();
        const col = bushPalette[Math.floor(rand() * bushPalette.length)];
        const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.82 });
        const puffs = 3 + Math.floor(rand() * 3);
        for (let p = 0; p < puffs; p++) {
          const r = 0.24 + rand() * 0.34;
          const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mat);
          m.position.set((rand() - 0.5) * 0.45, r * 0.65 + rand() * 0.2, (rand() - 0.5) * 0.45);
          m.scale.set(1.15, 0.78, 1.05);
          m.castShadow = false;
          m.receiveShadow = true;
          grp.add(m);
        }
        grp.position.set(bx, 0.02, bz);
        this.scene.add(grp);
      }

      // Overhead warm autumn canopy boughs filtering light
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0xd9a13a,
        emissive: 0x5c3a0a,
        emissiveIntensity: 0.28,
        roughness: 0.75,
      });
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 + rand() * 0.55, 1), canopyMat);
        c.position.set(-3.2 + i * 0.85 + (rand() - 0.5) * 0.6, 3.8 + rand() * 0.9, -2.5 + (rand() - 0.5) * 2.2);
        c.scale.set(1.5, 0.45, 1.2);
        this.scene.add(c);
      }

      // Scatter 170 sculpted 3D curled autumn leaves across the forest floor around the stump
      const leafGeoSmall = createCurledLeafGeometry(0.92);
      const leafGeoMed = createCurledLeafGeometry(1.18);
      for (let i = 0; i < 165; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = 0.78 + rand() * 2.55;
        const lx = Math.cos(angle) * dist;
        const lz = Math.sin(angle) * dist;
        // Avoid burying the plate or pouch center
        if (Math.hypot(lx - PLATE_POS.x, lz - PLATE_POS.z) < 0.24) continue;
        if (Math.hypot(lx - POUCH_POS.x, lz - POUCH_POS.z) < 0.24) continue;

        const mat = this.materials.leaves[Math.floor(rand() * this.materials.leaves.length)];
        const leaf = new THREE.Mesh(rand() > 0.5 ? leafGeoMed : leafGeoSmall, mat);
        const y = this.getGroundHeight(lx, lz) + 0.012 + rand() * 0.018;
        leaf.position.set(lx, y, lz);
        leaf.rotation.set((rand() - 0.5) * 0.24, rand() * Math.PI * 2, (rand() - 0.5) * 0.24);
        leaf.scale.setScalar(0.8 + rand() * 0.48);
        leaf.receiveShadow = true;
        leaf.castShadow = dist < 1.8;
        this.scene.add(leaf);
      }
    }

    _buildTreeTrunk(x, z, radius, height, withRoots) {
      const grp = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(radius * 0.78, radius * 1.15, height, 14, 6);
      const pos = trunkGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const flare = Math.max(0, 1 - (vy + height * 0.5) / 1.4);
        const ridge = Math.sin(ang * 5) * 0.06 * flare + Math.cos(ang * 3 + vy * 0.6) * 0.025;
        pos.setX(i, vx + Math.cos(ang) * ridge);
        pos.setZ(i, vz + Math.sin(ang) * ridge);
      }
      trunkGeo.computeVertexNormals();

      const mesh = new THREE.Mesh(trunkGeo, this.materials.bark);
      mesh.position.y = height * 0.5 - 0.1;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      grp.add(mesh);

      if (withRoots) {
        for (let r = 0; r < 4; r++) {
          const ang = -0.6 + r * 1.15;
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(Math.cos(ang) * radius * 0.7, 0.36, Math.sin(ang) * radius * 0.7),
            new THREE.Vector3(Math.cos(ang) * (radius + 0.35), 0.13, Math.sin(ang) * (radius + 0.35)),
            new THREE.Vector3(Math.cos(ang) * (radius + 0.85), -0.02, Math.sin(ang) * (radius + 0.85)),
          ]);
          const rMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.095, 8, false), this.materials.bark);
          rMesh.castShadow = true;
          rMesh.receiveShadow = true;
          grp.add(rMesh);
        }
        // Damp moss patches at trunk base
        for (let m = 0; m < 4; m++) {
          const ang = 0.2 + m * 0.75;
          const mossPatch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.materials.moss);
          mossPatch.scale.set(1.4, 0.42, 1.1);
          mossPatch.position.set(Math.cos(ang) * radius * 1.05, 0.12 + m * 0.03, Math.sin(ang) * radius * 1.05);
          mossPatch.receiveShadow = true;
          grp.add(mossPatch);
        }
      }

      grp.position.set(x, 0, z);
      this.scene.add(grp);
    }

    _buildStumpAndRoots() {
      this.stumpGroup = new THREE.Group();
      this.stumpGroup.name = 'mossy-stump';

      // Fluted organic stump side body
      const sideGeo = new THREE.CylinderGeometry(STUMP_RADIUS * 0.99, STUMP_RADIUS * 1.24, STUMP_TOP_Y + 0.06, 36, 10, true);
      const pos = sideGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ang = Math.atan2(z, x);
        const bottomWeight = Math.max(0, 0.5 - y / (STUMP_TOP_Y + 0.06));
        const rootFlute =
          (Math.sin(ang * 5 + 0.4) * 0.085 + Math.cos(ang * 7 - 0.6) * 0.038) * Math.pow(bottomWeight, 1.35) +
          Math.sin(ang * 13 + y * 5) * 0.012;
        const r = Math.hypot(x, z);
        const nr = r + rootFlute;
        pos.setX(i, Math.cos(ang) * nr);
        pos.setZ(i, Math.sin(ang) * nr);
      }
      sideGeo.computeVertexNormals();
      const sideMesh = new THREE.Mesh(sideGeo, this.materials.bark);
      sideMesh.position.y = (STUMP_TOP_Y - 0.04) * 0.5;
      sideMesh.castShadow = true;
      sideMesh.receiveShadow = true;
      sideMesh.userData.surface = 'stump-side';
      this.stumpGroup.add(sideMesh);

      // Slightly uneven natural stump top surface with recessed crack groove
      const topGeo = new THREE.CircleGeometry(STUMP_RADIUS * 0.99, 44);
      topGeo.rotateX(-Math.PI / 2);
      const tPos = topGeo.attributes.position;
      for (let i = 0; i < tPos.count; i++) {
        const x = tPos.getX(i);
        const z = tPos.getZ(i);
        const r = Math.hypot(x, z);
        // Subtle dish + edge bevel
        const bevel = r > STUMP_RADIUS * 0.88 ? -(r - STUMP_RADIUS * 0.88) * 0.12 : 0;
        const undul = Math.sin(x * 5.2) * Math.cos(z * 4.7) * 0.005;
        tPos.setY(i, undul + bevel);
      }
      topGeo.computeVertexNormals();

      this.stumpTopMesh = new THREE.Mesh(topGeo, this.materials.stumpTop);
      this.stumpTopMesh.position.y = STUMP_TOP_Y;
      this.stumpTopMesh.receiveShadow = true;
      this.stumpTopMesh.userData.surface = 'stump-top';
      this.stumpGroup.add(this.stumpTopMesh);

      // Sculpted V-shaped walnut crack crevice on stump top (at CRACK_POS)
      const crackGroup = new THREE.Group();
      const crackMat = new THREE.MeshStandardMaterial({ color: 0x352518, roughness: 0.96 });
      const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.046), crackMat);
      crackMesh.position.set(0, 0.001, 0);
      crackGroup.add(crackMesh);

      // Raised weathered wood lips framing the walnut crack so a 5-year-old visually notices it
      const lipMat = new THREE.MeshStandardMaterial({ color: 0x866747, roughness: 0.84 });
      for (const side of [-1, 1]) {
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.018, 0.27, 7), lipMat);
        lip.rotation.z = Math.PI / 2;
        lip.position.set(0, 0.008, side * 0.032);
        lip.castShadow = true;
        lip.receiveShadow = true;
        crackGroup.add(lip);
      }
      crackGroup.position.copy(CRACK_POS);
      crackGroup.rotation.y = -0.56;
      crackGroup.userData.crackTarget = true;
      this.crackGroup = crackGroup;
      this.stumpGroup.add(crackGroup);

      // Sculpted gnarled roots radiating from stump base, forming natural hollows behind & beside the stump
      const rootConfigs = [
        // Back-right framing the hero root hollow (visible up-close in low camera!)
        { ang: -0.78, len: 1.05, r: 0.115, lift: 0.24 },
        { ang: -0.18, len: 0.98, r: 0.105, lift: 0.20 },
        { ang: -1.42, len: 1.08, r: 0.11, lift: 0.22 },
        // Back-left roots
        { ang: -2.28, len: 0.98, r: 0.10, lift: 0.20 },
        { ang: 2.85, len: 0.88, r: 0.095, lift: 0.18 },
        // Front gentle roots cradling the plate/pouch area without blocking them
        { ang: 0.62, len: 0.82, r: 0.085, lift: 0.15 },
        { ang: 2.35, len: 0.85, r: 0.09, lift: 0.16 },
      ];
      for (const rc of rootConfigs) {
        const c = Math.cos(rc.ang);
        const s = Math.sin(rc.ang);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(c * (STUMP_RADIUS * 0.82), rc.lift, s * (STUMP_RADIUS * 0.82)),
          new THREE.Vector3(c * (STUMP_RADIUS + rc.len * 0.36), rc.lift * 0.45, s * (STUMP_RADIUS + rc.len * 0.36)),
          new THREE.Vector3(c * (STUMP_RADIUS + rc.len * 0.78), 0.055, s * (STUMP_RADIUS + rc.len * 0.78)),
          new THREE.Vector3(c * (STUMP_RADIUS + rc.len), -0.04, s * (STUMP_RADIUS + rc.len)),
        ]);
        const rGeo = new THREE.TubeGeometry(curve, 16, rc.r, 10, false);
        const rMesh = new THREE.Mesh(rGeo, this.materials.bark);
        rMesh.castShadow = true;
        rMesh.receiveShadow = true;
        this.stumpGroup.add(rMesh);
      }

      // Lush 3D damp green moss cushions hugging stump rim, bark flanks, and root hollows
      const rand = seededRand(88776);
      for (let i = 0; i < 34; i++) {
        const ang = (i / 34) * Math.PI * 2 + (rand() - 0.5) * 0.18;
        const onRim = i % 3 === 0;
        const rad = onRim ? STUMP_RADIUS * (0.90 + rand() * 0.08) : STUMP_RADIUS * (1.02 + rand() * 0.25);
        const y = onRim ? STUMP_TOP_Y - 0.02 + rand() * 0.022 : 0.06 + rand() * 0.24;
        const sz = onRim ? 0.085 + rand() * 0.055 : 0.11 + rand() * 0.09;
        const mossBall = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 1), this.materials.moss);
        mossBall.scale.set(1.25 + rand() * 0.5, 0.38 + rand() * 0.2, 1.0 + rand() * 0.45);
        mossBall.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        mossBall.rotation.y = rand() * Math.PI * 2;
        mossBall.castShadow = true;
        mossBall.receiveShadow = true;
        this.stumpGroup.add(mossBall);
      }

      // Subtle dark earthy hollow pads in the tree root alcoves
      const hollowMat = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.96 });
      for (const hPos of this.ROOT_HOLLOWS.slice(0, 3)) {
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), hollowMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(hPos.x, 0.036, hPos.z);
        pad.receiveShadow = true;
        this.stumpGroup.add(pad);
      }

      this.scene.add(this.stumpGroup);
    }

    // Extra crisp close-up props in the low-camera foreground: large veined autumn leaves, fallen acorn caps, damp moss tufts
    _buildForegroundDetails() {
      const heroLeafGeo = createCurledLeafGeometry(1.55);
      const closeSpots = [
        { x: 0.96, z: 1.08, rotY: 0.65, matIdx: 0 },
        { x: 1.15, z: 1.24, rotY: 2.15, matIdx: 1 },
        { x: 0.84, z: 1.32, rotY: -0.95, matIdx: 2 },
        { x: 1.05, z: 0.72, rotY: 1.40, matIdx: 1 },
        { x: 0.82, z: 0.06, rotY: 2.65, matIdx: 0 },
        { x: 0.64, z: -0.44, rotY: 0.40, matIdx: 2 },
      ];
      for (const s of closeSpots) {
        const m = new THREE.Mesh(heroLeafGeo, this.materials.leaves[s.matIdx]);
        m.position.set(s.x, this.getGroundHeight(s.x, s.z) + 0.022, s.z);
        m.rotation.set(0.06, s.rotY, -0.05);
        m.castShadow = true;
        m.receiveShadow = true;
        this.scene.add(m);
      }

      // Fallen empty acorn caps ("どんぐりの帽子") visible up close at ground eye-level
      const capSpots = [
        { x: 0.98, z: 1.18, tiltX: 0.45, tiltZ: 0.3 },
        { x: 0.76, z: 0.56, tiltX: 2.4, tiltZ: -0.2 },
        { x: -0.72, z: 0.82, tiltX: 1.8, tiltZ: 0.4 },
      ];
      for (const cs of capSpots) {
        const cap = this._createAcornCapMesh(1.15);
        cap.position.set(cs.x, this.getGroundHeight(cs.x, cs.z) + 0.032, cs.z);
        cap.rotation.set(cs.tiltX, cs.x * 2.5, cs.tiltZ);
        this.scene.add(cap);
      }

      // Damp glistening moss tufts right near the low-camera root foreground
      const mossSpots = [
        [1.18, 0.92, 0.13],
        [0.92, 0.86, 0.09],
        [0.86, -0.06, 0.14],
        [0.48, -0.62, 0.12],
      ];
      for (const [mx, mz, mr] of mossSpots) {
        const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(mr, 2), this.materials.moss);
        tuft.scale.set(1.35, 0.48, 1.15);
        tuft.position.set(mx, this.getGroundHeight(mx, mz) + mr * 0.25, mz);
        tuft.castShadow = true;
        tuft.receiveShadow = true;
        this.scene.add(tuft);
      }
    }

    _buildWoodenPlate() {
      this.plateGroup = new THREE.Group();
      this.plateGroup.name = 'wooden-plate';

      // Turned wooden saucer profile via LatheGeometry
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.14, 0.0),
        new THREE.Vector2(0.21, 0.024),
        new THREE.Vector2(0.235, 0.056),
        new THREE.Vector2(0.222, 0.062),
        new THREE.Vector2(0.195, 0.036),
        new THREE.Vector2(0.12, 0.022),
        new THREE.Vector2(0.0, 0.020),
      ];
      const geo = new THREE.LatheGeometry(pts, 32);
      const mesh = new THREE.Mesh(geo, this.materials.plate);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.interactive = 'plate';
      this.plateMesh = mesh;
      this.plateGroup.add(mesh);

      // Invisible generous touch hitbox for 5-year-old fingers
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.09, 14),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.04;
      hit.userData.interactive = 'plate';
      this.plateGroup.add(hit);

      this.plateGroup.position.copy(PLATE_POS);
      this.plateGroup.rotation.y = this.plateAngle;
      this.scene.add(this.plateGroup);
    }

    _buildClothPouch() {
      this.pouchGroup = new THREE.Group();
      this.pouchGroup.name = 'cloth-pouch';

      // Sculpted plump linen drawstring pouch body
      const bodyPts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.12, 0.0),
        new THREE.Vector2(0.21, 0.055),
        new THREE.Vector2(0.23, 0.14),
        new THREE.Vector2(0.19, 0.22),
        new THREE.Vector2(0.135, 0.275),
      ];
      const bodyGeo = new THREE.LatheGeometry(bodyPts, 28);
      // Organic cloth folds around body
      const bPos = bodyGeo.attributes.position;
      for (let i = 0; i < bPos.count; i++) {
        const x = bPos.getX(i);
        const y = bPos.getY(i);
        const z = bPos.getZ(i);
        const ang = Math.atan2(z, x);
        const fold = Math.sin(ang * 7 + y * 9) * 0.009 * (y / 0.28);
        const r = Math.hypot(x, z);
        if (r > 0.01) {
          bPos.setX(i, x + Math.cos(ang) * fold);
          bPos.setZ(i, z + Math.sin(ang) * fold);
        }
      }
      bodyGeo.computeVertexNormals();

      const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.linen);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bodyMesh.userData.interactive = 'pouch';
      this.pouchBodyMesh = bodyMesh;
      this.pouchGroup.add(bodyMesh);

      const innerMesh = new THREE.Mesh(bodyGeo, this.materials.linenInner);
      innerMesh.scale.set(0.95, 0.96, 0.95);
      this.pouchGroup.add(innerMesh);

      // Animated gathered collar / mouth of the cloth pouch (scales open & closed!)
      this.pouchMouthGroup = new THREE.Group();
      this.pouchMouthGroup.position.y = 0.265;
      const collarPts = [
        new THREE.Vector2(0.12, 0.0),
        new THREE.Vector2(0.135, 0.045),
        new THREE.Vector2(0.155, 0.088),
      ];
      const collarGeo = new THREE.LatheGeometry(collarPts, 28);
      const cPos = collarGeo.attributes.position;
      for (let i = 0; i < cPos.count; i++) {
        const x = cPos.getX(i);
        const y = cPos.getY(i);
        const z = cPos.getZ(i);
        const ang = Math.atan2(z, x);
        const ruffle = Math.sin(ang * 9) * 0.014 * (y / 0.09);
        cPos.setX(i, x + Math.cos(ang) * ruffle);
        cPos.setZ(i, z + Math.sin(ang) * ruffle);
      }
      collarGeo.computeVertexNormals();
      const collarMesh = new THREE.Mesh(collarGeo, this.materials.linen);
      collarMesh.castShadow = true;
      collarMesh.receiveShadow = true;
      collarMesh.userData.interactive = 'pouch-mouth';
      this.pouchMouthGroup.add(collarMesh);

      // Drawstring hemp cord around neck
      const cordMesh = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.011, 8, 28), this.materials.cord);
      cordMesh.rotation.x = Math.PI / 2;
      cordMesh.position.y = 0.01;
      cordMesh.userData.interactive = 'pouch-mouth';
      this.pouchMouthGroup.add(cordMesh);

      // Loose drawstring tail cords resting forward
      for (const side of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.025, 0.01, 0.125),
          new THREE.Vector3(side * 0.06, -0.04, 0.17),
          new THREE.Vector3(side * 0.085, -0.10, 0.195),
        ]);
        const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.008, 6, false), this.materials.cord);
        tail.userData.interactive = 'pouch-mouth';
        this.pouchMouthGroup.add(tail);
      }
      this.pouchGroup.add(this.pouchMouthGroup);

      // Visible items peeking inside the pouch when opened (acorn, sunflower seeds, and walnut once unlocked!)
      this.pouchContentsGroup = new THREE.Group();
      this.pouchContentsGroup.position.set(0, 0.22, 0);

      this.peekAcorn = this.createFoodMesh('acorn');
      this.peekAcorn.position.set(-0.045, 0.035, 0.025);
      this.peekAcorn.rotation.set(0.35, 0.5, 0.2);
      this.peekAcorn.userData.interactive = 'pouch-acorn';
      this.pouchContentsGroup.add(this.peekAcorn);

      this.peekSeedsGroup = new THREE.Group();
      const seedOffsets = [
        [0.045, 0.032, 0.038, 0.5],
        [0.068, 0.028, -0.008, 1.4],
        [0.025, 0.030, -0.038, -0.7],
        [0.052, 0.038, 0.008, 2.2],
      ];
      for (const [sx, sy, sz, rot] of seedOffsets) {
        const sMesh = this.createFoodMesh('seed');
        sMesh.position.set(sx, sy, sz);
        sMesh.rotation.set(0.2, rot, 0.15);
        sMesh.userData.interactive = 'pouch-seed';
        this.peekSeedsGroup.add(sMesh);
      }
      this.pouchContentsGroup.add(this.peekSeedsGroup);

      this.peekWalnut = this.createFoodMesh('walnut');
      this.peekWalnut.position.set(-0.01, 0.045, -0.042);
      this.peekWalnut.rotation.set(0.25, 0.8, 0.1);
      this.peekWalnut.visible = false;
      this.peekWalnut.userData.interactive = 'pouch-walnut';
      this.pouchContentsGroup.add(this.peekWalnut);

      this.pouchGroup.add(this.pouchContentsGroup);

      // Generous invisible touch hitboxes for pouch & mouth
      const pouchHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 12, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      pouchHit.position.set(0, 0.16, 0);
      pouchHit.userData.interactive = 'pouch';
      this.pouchGroup.add(pouchHit);

      // Slight cozy lean toward center stump
      this.pouchGroup.position.copy(POUCH_POS);
      this.pouchGroup.rotation.set(0.08, -0.35, 0.05);
      this.scene.add(this.pouchGroup);
    }

    _buildSunDust() {
      const count = 45;
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const rand = seededRand(99001);
      for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * 4.2;
        const y = 0.25 + rand() * 2.2;
        const z = (rand() - 0.5) * 3.8;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        this.dustBasePositions.push({ x, y, z, phase: rand() * Math.PI * 2 });
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xfff2c2,
        size: 0.024,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      this.dustMotes = new THREE.Points(geo, mat);
      this.scene.add(this.dustMotes);
    }

    _createAcornCapMesh(scale = 1.0) {
      const grp = new THREE.Group();
      const capGeo = new THREE.SphereGeometry(0.044 * scale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54);
      const cap = new THREE.Mesh(capGeo, this.materials.acornCap);
      cap.castShadow = true;
      cap.receiveShadow = true;
      grp.add(cap);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * scale, 0.007 * scale, 0.028 * scale, 6), this.materials.acornCap);
      stem.position.y = 0.05 * scale;
      stem.rotation.z = 0.16;
      grp.add(stem);
      return grp;
    }

    // Create photorealistic 3D food items: 'acorn' | 'seed' | 'walnut'
    createFoodMesh(kind) {
      const grp = new THREE.Group();
      grp.userData.foodKind = kind;

      if (kind === 'acorn') {
        // Glossy chestnut acorn nut body
        const nutPts = [
          new THREE.Vector2(0.0, -0.058),
          new THREE.Vector2(0.011, -0.046),
          new THREE.Vector2(0.032, -0.022),
          new THREE.Vector2(0.040, 0.006),
          new THREE.Vector2(0.038, 0.028),
          new THREE.Vector2(0.0, 0.034),
        ];
        const nutGeo = new THREE.LatheGeometry(nutPts, 18);
        const nut = new THREE.Mesh(nutGeo, this.materials.acornNut);
        nut.castShadow = true;
        nut.receiveShadow = true;
        grp.add(nut);

        // Textured cupule cap
        const cap = this._createAcornCapMesh(1.0);
        cap.position.y = 0.014;
        grp.add(cap);

        // Slightly tilted resting posture + generous touch collider
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.088, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.userData.foodHit = true;
        grp.add(hit);
      } else if (kind === 'seed') {
        // Teardrop striped sunflower seed
        const seedPts = [
          new THREE.Vector2(0.0, -0.036),
          new THREE.Vector2(0.012, -0.024),
          new THREE.Vector2(0.020, -0.004),
          new THREE.Vector2(0.017, 0.018),
          new THREE.Vector2(0.006, 0.032),
          new THREE.Vector2(0.0, 0.038),
        ];
        const sGeo = new THREE.LatheGeometry(seedPts, 12);
        sGeo.scale(1.0, 1.0, 0.56); // slightly flattened teardrop
        const seed = new THREE.Mesh(sGeo, this.materials.seed);
        seed.rotation.x = Math.PI / 2;
        seed.castShadow = true;
        seed.receiveShadow = true;
        grp.add(seed);

        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.userData.foodHit = true;
        grp.add(hit);
      } else if (kind === 'walnut') {
        // Rugged gray-brown two-halved walnut shell
        const wGeo = new THREE.IcosahedronGeometry(0.062, 2);
        const wp = wGeo.attributes.position;
        for (let i = 0; i < wp.count; i++) {
          const x = wp.getX(i);
          const y = wp.getY(i);
          const z = wp.getZ(i);
          const bump = 1.0 + Math.sin(x * 78) * Math.cos(y * 64) * 0.055 + Math.sin(z * 82) * 0.04;
          // Raised equatorial seam ridge
          const seam = Math.exp(-Math.pow(x / 0.012, 2)) * 0.006;
          wp.setXYZ(i, x * bump * 0.92 + Math.sign(x) * seam, y * bump * 1.12, z * bump * 0.96);
        }
        wGeo.computeVertexNormals();
        const walnut = new THREE.Mesh(wGeo, this.materials.walnut);
        walnut.castShadow = true;
        walnut.receiveShadow = true;
        grp.add(walnut);

        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.userData.foodHit = true;
        grp.add(hit);
      }

      return grp;
    }

    // Create a 3D walnut shell fragment scattered on the stump when chewed
    createWalnutShardMesh() {
      const grp = new THREE.Group();
      const sGeo = new THREE.SphereGeometry(0.032, 7, 5, 0, Math.PI * 0.95, 0.3, Math.PI * 0.55);
      const outer = new THREE.Mesh(sGeo, this.materials.walnut);
      outer.castShadow = true;
      outer.receiveShadow = true;
      grp.add(outer);

      const inner = new THREE.Mesh(sGeo, this.materials.walnutInside);
      inner.scale.setScalar(0.92);
      inner.material = this.materials.walnutInside.clone();
      inner.material.side = THREE.BackSide;
      grp.add(inner);

      grp.scale.set(0.85 + Math.random() * 0.45, 0.7 + Math.random() * 0.4, 0.85 + Math.random() * 0.45);
      return grp;
    }

    // Create an interactive raised autumn-leaf mound marking a chipmunk cache!
    createCacheMoundMesh(pos, seedCount) {
      const grp = new THREE.Group();
      grp.position.set(pos.x, this.getGroundHeight(pos.x, pos.z), pos.z);

      // Soft raised mound of damp forest earth
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
        this.materials.ground
      );
      earth.scale.set(1.15, 0.52, 1.05);
      earth.receiveShadow = true;
      earth.castShadow = true;
      grp.add(earth);

      // Cluster of overlapping curled autumn leaves covering the mound (they brush aside when touched!)
      const coverLeaves = [];
      const leafGeo = createCurledLeafGeometry(1.05);
      const count = 6;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + (i % 2) * 0.3;
        const leaf = new THREE.Mesh(leafGeo, this.materials.leaves[i % 3]);
        const r = i === 0 ? 0.01 : 0.055;
        leaf.position.set(Math.cos(ang) * r, 0.055 + (i === 0 ? 0.018 : 0.0), Math.sin(ang) * r);
        leaf.rotation.set((i === 0 ? 0.05 : 0.28) * Math.sin(ang), ang + 1.1, -(i === 0 ? 0.05 : 0.28) * Math.cos(ang));
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        leaf.userData.basePos = leaf.position.clone();
        leaf.userData.scatterDir = new THREE.Vector3(Math.cos(ang), 0.06, Math.sin(ang));
        grp.add(leaf);
        coverLeaves.push(leaf);
      }

      // Generous touch hitbox for brushing leaves aside
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.06;
      hit.userData.interactive = 'cache-mound';
      grp.add(hit);

      this.scene.add(grp);
      return {
        group: grp,
        earth,
        coverLeaves,
        hit,
        seedCount,
      };
    }

    getGroundHeight(x, z) {
      const r = Math.hypot(x, z);
      const bank = Math.max(0, r - 2.4) * 0.14;
      const gentle = Math.sin(x * 0.9) * Math.cos(z * 0.8) * 0.045 + Math.sin(x * 2.1 + z * 1.7) * 0.018;
      return Math.max(0, gentle * Math.min(1, r / 1.2) + bank);
    }

    isOnStump(x, z, margin = 0) {
      return Math.hypot(x, z) <= STUMP_RADIUS - margin;
    }

    isOnPlate(x, z) {
      return Math.hypot(x - PLATE_POS.x, z - PLATE_POS.z) <= 0.21;
    }

    getSurfaceHeight(x, z) {
      if (this.isOnStump(x, z, -0.02)) {
        return STUMP_TOP_Y;
      }
      if (this.isOnPlate(x, z)) {
        return PLATE_POS.y + 0.032;
      }
      return this.getGroundHeight(x, z) + 0.02;
    }

    setPouchOpen(open) {
      this.pouchOpen = !!open;
    }

    setWalnutUnlocked(unlocked) {
      this.walnutUnlocked = !!unlocked;
      if (this.peekWalnut) {
        this.peekWalnut.visible = this.walnutUnlocked;
      }
    }

    setPlateAngle(angle) {
      this.plateAngle = angle;
      if (this.plateGroup) {
        this.plateGroup.rotation.y = angle;
      }
    }

    update(dt, elapsed, cycleProgress) {
      // Animate cloth pouch mouth opening / closing smoothly
      const targetOpen = this.pouchOpen ? 1.0 : 0.0;
      this.pouchOpenAnim += (targetOpen - this.pouchOpenAnim) * Math.min(1, dt * 8.5);

      if (this.pouchMouthGroup) {
        const s = 0.42 + this.pouchOpenAnim * 0.78;
        this.pouchMouthGroup.scale.set(s, 0.92 + (1 - this.pouchOpenAnim) * 0.28, s);
      }
      if (this.pouchContentsGroup) {
        this.pouchContentsGroup.visible = this.pouchOpenAnim > 0.18;
        const rise = THREE.MathUtils.lerp(-0.06, 0.025, this.pouchOpenAnim);
        this.pouchContentsGroup.position.y = 0.22 + rise;
        const cs = 0.65 + this.pouchOpenAnim * 0.38;
        this.pouchContentsGroup.scale.setScalar(cs);
      }

      // Gently sway morning canopy dapple light
      for (const dl of this.dappleLayers) {
        dl.mesh.position.x = dl.baseX + Math.sin(elapsed * dl.speed) * dl.amp;
        dl.mesh.position.z = dl.baseZ + Math.cos(elapsed * dl.speed * 0.78) * dl.amp * 0.7;
      }

      // Gradually tilt morning sun warmer & lower over the 5-8 minute arc ("木漏れ日が少し傾き")
      const sunTilt = Math.min(1, Math.max(0, cycleProgress));
      this.sunLight.position.set(
        THREE.MathUtils.lerp(2.4, 3.6, sunTilt),
        THREE.MathUtils.lerp(5.2, 3.4, sunTilt),
        THREE.MathUtils.lerp(2.1, 1.5, sunTilt)
      );
      this.sunLight.color.setRGB(
        1.0,
        THREE.MathUtils.lerp(0.94, 0.87, sunTilt),
        THREE.MathUtils.lerp(0.78, 0.64, sunTilt)
      );

      // Drift subtle golden sunlit forest dust motes
      if (this.dustMotes) {
        const pos = this.dustMotes.geometry.attributes.position;
        for (let i = 0; i < this.dustBasePositions.length; i++) {
          const b = this.dustBasePositions[i];
          pos.setXYZ(
            i,
            b.x + Math.sin(elapsed * 0.35 + b.phase) * 0.12,
            b.y + Math.sin(elapsed * 0.24 + b.phase * 1.4) * 0.08,
            b.z + Math.cos(elapsed * 0.31 + b.phase) * 0.10
          );
        }
        pos.needsUpdate = true;
      }
    }
  }

  global.ForestWorld = ForestWorld;
})(window);
