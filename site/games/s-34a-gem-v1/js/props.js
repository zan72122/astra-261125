(function () {
  'use strict';

  function buildProps(scene, env, sound) {
    const T = window.PiyoTextures;
    const box = env.boxBounds;

    // --- 1. TERRACOTTA FEED DISH (素焼きの餌皿) ---
    const dishPos = new THREE.Vector3(0.88, box.floorY + 0.005, 0.98);
    const tcTex = T.createTerracottaTextures();
    const dishProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.39, 0.0),
      new THREE.Vector2(0.51, 0.075),
      new THREE.Vector2(0.54, 0.18),
      new THREE.Vector2(0.49, 0.195),
      new THREE.Vector2(0.45, 0.145),
      new THREE.Vector2(0.35, 0.048),
      new THREE.Vector2(0.0, 0.036)
    ];
    const dishGeo = new THREE.LatheGeometry(dishProfile, 36);
    const dishMat = new THREE.MeshStandardMaterial({
      map: tcTex.map,
      bumpMap: tcTex.bumpMap,
      bumpScale: 0.014,
      roughness: 0.88,
      metalness: 0.0
    });
    const feedDish = new THREE.Mesh(dishGeo, dishMat);
    feedDish.position.copy(dishPos);
    feedDish.castShadow = true;
    feedDish.receiveShadow = true;
    feedDish.userData.interactive = 'feed_dish';
    scene.add(feedDish);

    const feedDishObj = {
      mesh: feedDish,
      pos: dishPos,
      radius: 0.48,
      setHighlight(s) {
        const em = s * 0.22;
        dishMat.emissive.setRGB(em, em * 0.72, em * 0.36);
      }
    };

    // --- 2. SMALL MILLET RESERVE BOWL & WOODEN SCOOP SPOON (木のさじ) ---
    const reservePos = new THREE.Vector3(2.38, 0.0, 1.88);
    const spoonWoodTex = T.createWoodTexture({ base: [214, 174, 120], grain: [164, 122, 74], planks: 2, seed: 109 });
    const spoonMat = new THREE.MeshStandardMaterial({
      map: spoonWoodTex,
      roughness: 0.68,
      metalness: 0.0
    });
    const reserveMat = new THREE.MeshStandardMaterial({
      map: T.createWoodTexture({ base: [176, 132, 86], grain: [130, 90, 52], planks: 2, seed: 112 }),
      roughness: 0.78
    });

    // Small wooden millet bowl next to the box where the spoon rests
    const potProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.32, 0.0),
      new THREE.Vector2(0.42, 0.22),
      new THREE.Vector2(0.43, 0.38),
      new THREE.Vector2(0.38, 0.39),
      new THREE.Vector2(0.35, 0.14),
      new THREE.Vector2(0.0, 0.12)
    ];
    const milletPot = new THREE.Mesh(new THREE.LatheGeometry(potProfile, 26), reserveMat);
    milletPot.position.copy(reservePos);
    milletPot.castShadow = true;
    milletPot.receiveShadow = true;
    scene.add(milletPot);

    // Matte pale-yellow millet mound inside the reserve pot
    const milletMat = new THREE.MeshStandardMaterial({
      color: 0xe6d496,
      roughness: 0.88,
      metalness: 0.0
    });
    const potMound = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), milletMat);
    potMound.scale.set(1.0, 0.42, 1.0);
    potMound.position.set(reservePos.x, 0.28, reservePos.z);
    potMound.receiveShadow = true;
    scene.add(potMound);

    // Carved Wooden Scoop Spoon (浅い溝のある小さな木べら、端に丸み)
    const spoonGroup = new THREE.Group();
    const spoonRestPos = new THREE.Vector3(1.86, 0.48, 1.56);
    const spoonRestRot = new THREE.Euler(0.06, -0.58, 0.14);
    spoonGroup.position.copy(spoonRestPos);
    spoonGroup.rotation.copy(spoonRestRot);

    // Hollowed shallow scoop bowl (oriented pointing along -X so handle extends +X)
    const bowlGeo = new THREE.SphereGeometry(0.28, 22, 16, 0, Math.PI * 2, Math.PI * 0.44, Math.PI * 0.56);
    bowlGeo.scale(1.18, 0.48, 0.82);
    const bowlOuter = new THREE.Mesh(bowlGeo, spoonMat);
    bowlOuter.position.set(-0.22, 0.04, 0);
    bowlOuter.castShadow = true;
    bowlOuter.receiveShadow = true;
    spoonGroup.add(bowlOuter);

    // Rim lip around the shallow scoop groove
    const rimGeo = new THREE.TorusGeometry(0.26, 0.028, 10, 24);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.scale(1.18, 1.0, 0.82);
    const rimMesh = new THREE.Mesh(rimGeo, spoonMat);
    rimMesh.position.set(-0.22, 0.025, 0);
    rimMesh.castShadow = true;
    spoonGroup.add(rimMesh);

    // Tapered wooden handle with rounded ergonomic thumb/finger end
    const handleGeo = new THREE.CapsuleGeometry(0.055, 0.68, 8, 14);
    handleGeo.rotateZ(Math.PI / 2);
    handleGeo.scale(1.0, 0.58, 1.12);
    const handleMesh = new THREE.Mesh(handleGeo, spoonMat);
    handleMesh.position.set(0.42, 0.04, 0);
    handleMesh.castShadow = true;
    handleMesh.receiveShadow = true;
    spoonGroup.add(handleMesh);

    // Rounded finger pad at the end of handle
    const endPad = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), spoonMat);
    endPad.scale.set(1.25, 0.46, 1.05);
    endPad.position.set(0.82, 0.045, 0);
    endPad.castShadow = true;
    spoonGroup.add(endPad);

    // Visible millet heap inside the spoon's shallow groove (individual tiny grains!)
    const SPOON_GRAIN_COUNT = 34;
    const grainGeo = new THREE.SphereGeometry(0.024, 8, 6);
    grainGeo.scale(1.22, 0.86, 0.95);
    const spoonGrains = new THREE.InstancedMesh(grainGeo, milletMat, SPOON_GRAIN_COUNT);
    spoonGrains.castShadow = true;
    const dummy = new THREE.Object3D();
    const spoonGrainOffsets = [];
    for (let i = 0; i < SPOON_GRAIN_COUNT; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / SPOON_GRAIN_COUNT) * 0.21;
      const gx = -0.22 + Math.cos(a) * r * 1.15;
      const gz = Math.sin(a) * r * 0.78;
      const gy = 0.02 + (1 - r / 0.22) * 0.055 + (i % 3) * 0.008;
      spoonGrainOffsets.push({ x: gx, y: gy, z: gz, rx: a, ry: a * 0.7 });
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(a, a * 0.7, 0);
      dummy.scale.setScalar(0.88 + (i % 5) * 0.06);
      dummy.updateMatrix();
      spoonGrains.setMatrixAt(i, dummy.matrix);
    }
    spoonGrains.instanceMatrix.needsUpdate = true;
    spoonGroup.add(spoonGrains);

    // Generous invisible touch hit area for the wooden spoon
    const spoonHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.52, 0.75),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    spoonHit.position.set(0.18, 0.05, 0);
    spoonHit.userData.interactive = 'spoon';
    spoonGroup.add(spoonHit);
    scene.add(spoonGroup);

    const spoon = {
      group: spoonGroup,
      hitMesh: spoonHit,
      restPos: spoonRestPos,
      restRot: spoonRestRot,
      milletLevel: 1.0, // 0..1 visible millet on scoop
      tilt: 0,          // 0..1 pouring tilt
      pourCarry: 0,
      isHeld: false,
      velocity: new THREE.Vector3(),
      lastPos: spoonRestPos.clone(),
      tipWorldPos: new THREE.Vector3(),
      getTipWorldPos(out) {
        out.set(-0.50, 0.02, 0);
        this.group.localToWorld(out);
        return out;
      },
      updateGrainVisuals() {
        const visibleCount = Math.max(4, Math.round(this.milletLevel * SPOON_GRAIN_COUNT));
        for (let i = 0; i < SPOON_GRAIN_COUNT; i++) {
          const o = spoonGrainOffsets[i];
          const sc = i < visibleCount ? (0.88 + (i % 5) * 0.06) : 0.0001;
          dummy.position.set(o.x, o.y - (1 - this.milletLevel) * 0.03, o.z);
          dummy.rotation.set(o.rx, o.ry, 0);
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          spoonGrains.setMatrixAt(i, dummy.matrix);
        }
        spoonGrains.instanceMatrix.needsUpdate = true;
      },
      setHighlight(s, t) {
        const em = s * 0.25;
        spoonMat.emissive.setRGB(em, em * 0.78, em * 0.35);
        if (!this.isHeld && s > 0.01) {
          this.group.position.y = this.restPos.y + Math.sin(t * 4.2) * 0.032 * s;
          this.group.rotation.z = this.restRot.z + Math.sin(t * 4.2) * 0.045 * s;
        }
      }
    };

    // --- 3. DYNAMIC MILLET GRAINS POOL (Ballistic pouring + straw half-burying) ---
    const MAX_GRAINS = 160;
    const grainInstMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.0
    });
    const grainMesh = new THREE.InstancedMesh(grainGeo, grainInstMat, MAX_GRAINS);
    grainMesh.castShadow = true;
    grainMesh.receiveShadow = true;
    scene.add(grainMesh);

    const grains = [];
    const tmpCol = new THREE.Color();
    const grainTones = [0xecdc9e, 0xe4d08c, 0xf2e4ad, 0xdcc57f];

    for (let i = 0; i < MAX_GRAINS; i++) {
      grains.push({
        id: i,
        active: false,
        state: 'none', // 'air' | 'settled' | 'carried_hen'
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        rotX: 0, rotY: 0, rotZ: 0,
        surface: 'straw', // 'dish' | 'straw' | 'stone'
        zone: 'dish_center',
        buried: false,
        giftedByHen: false,
        reservedBy: -1,
        age: 0,
        tone: grainTones[i % grainTones.length]
      });
      dummy.position.set(0, -10, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      grainMesh.setMatrixAt(i, dummy.matrix);
      tmpCol.setHex(grainTones[i % grainTones.length]);
      grainMesh.setColorAt(i, tmpCol);
    }
    grainMesh.instanceMatrix.needsUpdate = true;
    grainMesh.instanceColor.needsUpdate = true;

    let grainCursor = 0;

    function classifyZone(x, z) {
      if (x > 3.35) return 'outdoor_dish';
      if (Math.hypot(x - dishPos.x, z - dishPos.z) < 0.56) return 'dish_center';
      if (Math.hypot(x - (-0.75), z - (-0.18)) < 0.78) return 'hen_front';
      if (x < -0.25) return 'straw_left';
      return 'straw_edge';
    }

    function spawnGrain(pos, vel, opts) {
      // Find inactive slot or recycle oldest settled grain
      let g = null;
      for (let k = 0; k < MAX_GRAINS; k++) {
        const cand = grains[(grainCursor + k) % MAX_GRAINS];
        if (!cand.active) {
          g = cand;
          grainCursor = (grainCursor + k + 1) % MAX_GRAINS;
          break;
        }
      }
      if (!g) {
        let oldest = grains[0];
        for (let k = 1; k < MAX_GRAINS; k++) {
          if (grains[k].state === 'settled' && grains[k].age > oldest.age) oldest = grains[k];
        }
        g = oldest;
      }

      g.active = true;
      g.state = (opts && opts.settled) ? 'settled' : 'air';
      g.x = pos.x;
      g.y = pos.y;
      g.z = pos.z;
      g.vx = vel ? vel.x : 0;
      g.vy = vel ? vel.y : 0;
      g.vz = vel ? vel.z : 0;
      g.rotX = Math.random() * 6.28;
      g.rotY = Math.random() * 6.28;
      g.rotZ = Math.random() * 6.28;
      g.buried = !!(opts && opts.buried);
      g.giftedByHen = !!(opts && opts.giftedByHen);
      g.reservedBy = -1;
      g.age = 0;
      g.zone = classifyZone(g.x, g.z);
      g.surface = g.zone === 'dish_center' ? 'dish' : g.zone === 'outdoor_dish' ? 'stone' : 'straw';
      return g;
    }

    function updateGrains(dt, onGrainLanded) {
      let dirty = false;
      for (let i = 0; i < MAX_GRAINS; i++) {
        const g = grains[i];
        if (!g.active) continue;
        g.age += dt;

        if (g.state === 'air') {
          dirty = true;
          g.vy -= 9.4 * dt;
          g.x += g.vx * dt;
          g.y += g.vy * dt;
          g.z += g.vz * dt;
          g.rotX += dt * 7;
          g.rotY += dt * 5;

          // Keep grains gently inside playable bounds
          if (g.x < box.minX + 0.08) { g.x = box.minX + 0.08; g.vx *= -0.3; }
          if (g.z < box.minZ + 0.08) { g.z = box.minZ + 0.08; g.vz *= -0.3; }
          if (g.z > 2.25) { g.z = 2.25; g.vz *= -0.3; }

          // Determine floor height beneath grain
          const distDish = Math.hypot(g.x - dishPos.x, g.z - dishPos.z);
          const distOut = Math.hypot(g.x - env.outdoorDishPos.x, g.z - env.outdoorDishPos.z);

          let floorY = box.floorY + 0.025;
          let surf = 'straw';
          if (distDish < 0.44) {
            floorY = dishPos.y + 0.056 + (distDish / 0.44) * 0.028;
            surf = 'dish';
          } else if (distOut < 0.36) {
            floorY = env.outdoorDishPos.y + 0.052;
            surf = 'stone';
          } else if (g.x > 3.25) {
            floorY = 0.025;
            surf = 'straw';
          } else if (g.x > box.maxX || g.z > box.maxZ) {
            floorY = 0.025;
            surf = 'straw';
          }

          if (g.y <= floorY) {
            g.y = floorY;
            g.surface = surf;
            g.zone = classifyZone(g.x, g.z);

            if (Math.abs(g.vy) > 1.35) {
              // Tiny realistic dry seed bounce
              g.vy = -g.vy * 0.24;
              g.vx *= 0.45;
              g.vz *= 0.45;
              sound.playGrainLand(surf);
            } else {
              g.state = 'settled';
              g.vx = g.vy = g.vz = 0;
              // Grains falling on straw often half-sink into straw crevices!
              if (surf === 'straw' && g.x >= box.minX && g.x <= box.maxX && g.z >= box.minZ && g.z <= box.maxZ) {
                if (Math.random() < 0.58) {
                  g.buried = true;
                  g.y = box.floorY + 0.012;
                }
              }
              sound.playGrainLand(surf);
              if (onGrainLanded) onGrainLanded(g);
            }
          }
        }

        if (g.state === 'carried_hen' || g.state === 'air' || g.age < 0.25) {
          dirty = true;
        }

        dummy.position.set(g.x, g.y, g.z);
        dummy.rotation.set(g.rotX, g.rotY, g.rotZ);
        const sc = g.buried ? 0.84 : 1.04;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        grainMesh.setMatrixAt(i, dummy.matrix);
      }

      if (dirty) grainMesh.instanceMatrix.needsUpdate = true;
    }

    function removeGrain(g) {
      g.active = false;
      g.state = 'none';
      g.reservedBy = -1;
      dummy.position.set(0, -10, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      grainMesh.setMatrixAt(g.id, dummy.matrix);
      grainMesh.instanceMatrix.needsUpdate = true;
    }

    function uncoverGrainsNear(wx, wz, radius) {
      let uncovered = 0;
      for (let i = 0; i < MAX_GRAINS; i++) {
        const g = grains[i];
        if (g.active && g.state === 'settled' && g.buried) {
          if (Math.hypot(g.x - wx, g.z - wz) < (radius || 0.45)) {
            g.buried = false;
            g.y = box.floorY + 0.036;
            g.age = 0;
            uncovered++;
          }
        }
      }
      return uncovered;
    }

    // --- 4. WOVEN BASKET & DEWY CHICKWEED LEAVES (小さな籠と朝露のはこべの葉) ---
    const basketPos = new THREE.Vector3(-1.58, 0.0, 1.98);
    const basketGroup = new THREE.Group();
    basketGroup.position.copy(basketPos);
    scene.add(basketGroup);

    const basketTex = T.createBasketTexture();
    const basketMat = new THREE.MeshStandardMaterial({
      map: basketTex,
      roughness: 0.88,
      metalness: 0.0
    });
    const basketProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.32, 0.0),
      new THREE.Vector2(0.42, 0.16),
      new THREE.Vector2(0.45, 0.34),
      new THREE.Vector2(0.40, 0.36),
      new THREE.Vector2(0.36, 0.09),
      new THREE.Vector2(0.0, 0.08)
    ];
    const basketMesh = new THREE.Mesh(new THREE.LatheGeometry(basketProfile, 24), basketMat);
    basketMesh.castShadow = true;
    basketMesh.receiveShadow = true;
    basketGroup.add(basketMesh);

    const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.034, 8, 24), basketMat);
    basketRim.rotation.x = Math.PI / 2;
    basketRim.position.y = 0.35;
    basketGroup.add(basketRim);

    const leafWholeTex = T.createChickweedLeafTexture(null);
    const leafLeftTex = T.createChickweedLeafTexture('left');
    const leafRightTex = T.createChickweedLeafTexture('right');

    // Gently cupped organic 3D leaf geometry
    function createCurvedLeafGeo(w, l) {
      const geo = new THREE.PlaneGeometry(w, l, 6, 8);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i);
        const lz = p.getZ(i);
        const nx = lx / (w * 0.5);
        const nz = lz / (l * 0.5);
        // Natural arch along length + gentle cup across width
        const arch = (1 - nz * nz) * 0.042 + nx * nx * 0.025;
        p.setY(i, arch);
      }
      geo.computeVertexNormals();
      return geo;
    }

    const wholeLeafGeo = createCurvedLeafGeo(0.34, 0.44);
    const halfLeafGeo = createCurvedLeafGeo(0.28, 0.38);
    const dewDropGeo = new THREE.SphereGeometry(0.017, 10, 8);
    const dewDropMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2fbff,
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.84,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.9
    });

    function makeLeafMesh(kind) {
      const tex = kind === 'left' ? leafLeftTex : kind === 'right' ? leafRightTex : leafWholeTex;
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.42,
        clearcoat: 0.35,
        clearcoatRoughness: 0.22
      });
      const g = new THREE.Group();
      const blade = new THREE.Mesh(kind ? halfLeafGeo : wholeLeafGeo, mat);
      blade.castShadow = true;
      blade.receiveShadow = true;
      g.add(blade);

      // Tiny sparkling morning dewdrops on the leaf!
      const dropPositions = kind === 'left'
        ? [[-0.04, 0.055, -0.02]]
        : kind === 'right'
        ? [[0.04, 0.055, 0.03]]
        : [[-0.04, 0.06, -0.03], [0.05, 0.058, 0.04], [-0.01, 0.052, 0.09]];
      for (const dp of dropPositions) {
        const drop = new THREE.Mesh(dewDropGeo, dewDropMat);
        drop.position.set(dp[0], dp[1], dp[2]);
        drop.scale.set(1.0, 0.72, 1.0);
        g.add(drop);
      }
      g.userData.bladeMat = mat;
      return g;
    }

    // Visual bunch of fresh chickweed leaves resting inside the basket
    const basketLeaves = [];
    for (let i = 0; i < 6; i++) {
      const lm = makeLeafMesh(null);
      const ang = (i / 6) * Math.PI * 2 + 0.3;
      const rad = i === 0 ? 0.02 : 0.14;
      lm.position.set(Math.cos(ang) * rad, 0.28 + (i % 3) * 0.035, Math.sin(ang) * rad);
      lm.rotation.set((i % 2 ? 0.18 : -0.15), ang, (i % 3 - 1) * 0.14);
      basketGroup.add(lm);
      basketLeaves.push(lm);
    }

    const basketHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.52, 0.62, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    basketHit.position.y = 0.28;
    basketHit.userData.interactive = 'chickweed_basket';
    basketGroup.add(basketHit);

    // Active chickweed leaves dropped in the world (whole or torn halves)
    const worldLeaves = [];

    function createWorldLeaf(pos, kind) {
      const mesh = makeLeafMesh(kind || null);
      mesh.position.copy(pos);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(mesh);
      const leaf = {
        id: Math.random().toString(36).slice(2, 9),
        mesh,
        kind: kind || 'whole', // 'whole' | 'left' | 'right'
        state: 'ground',       // 'held_player' | 'falling' | 'ground' | 'carried' | 'tug' | 'scrap'
        x: pos.x, y: pos.y, z: pos.z,
        vx: 0, vy: 0, vz: 0,
        holderA: -1,
        holderB: -1,
        tugProgress: 0,
        bitesLeft: kind ? 3 : 5,
        scrapScale: 1.0
      };
      worldLeaves.push(leaf);
      return leaf;
    }

    function tearLeafInTwo(leaf, posA, posB) {
      if (leaf.kind !== 'whole') return null;
      sound.playLeafTear();
      scene.remove(leaf.mesh);
      const idx = worldLeaves.indexOf(leaf);
      if (idx >= 0) worldLeaves.splice(idx, 1);

      const leftLeaf = createWorldLeaf(posA, 'left');
      const rightLeaf = createWorldLeaf(posB, 'right');
      leftLeaf.state = 'carried';
      leftLeaf.holderA = leaf.holderA;
      rightLeaf.state = 'carried';
      rightLeaf.holderA = leaf.holderB;
      return { leftLeaf, rightLeaf };
    }

    function updateWorldLeaves(dt) {
      for (let i = 0; i < worldLeaves.length; i++) {
        const lf = worldLeaves[i];
        if (lf.state === 'falling') {
          lf.vy -= 5.2 * dt;
          lf.x += lf.vx * dt;
          lf.y += lf.vy * dt;
          lf.z += lf.vz * dt;
          lf.mesh.rotation.y += dt * 1.4;
          lf.mesh.rotation.z = Math.sin(lf.y * 5) * 0.25;

          const distOut = Math.hypot(lf.x - env.outdoorDishPos.x, lf.z - env.outdoorDishPos.z);
          let floorY = box.floorY + 0.035;
          if (distOut < 0.45) floorY = env.outdoorDishPos.y + 0.06;
          else if (lf.x > 3.25) floorY = 0.035;

          if (lf.y <= floorY) {
            lf.y = floorY;
            lf.vx = lf.vy = lf.vz = 0;
            lf.state = 'ground';
            lf.mesh.rotation.z = 0;
            lf.mesh.rotation.x = 0;
            sound.playStrawRustle(0.35);
          }
          lf.mesh.position.set(lf.x, lf.y, lf.z);
        } else if (lf.state === 'ground' || lf.state === 'scrap') {
          lf.mesh.position.set(lf.x, lf.y, lf.z);
          lf.mesh.scale.setScalar(lf.scrapScale);
        }
      }
      // Keep max 10 leaf scraps tidy
      let scraps = worldLeaves.filter(l => l.state === 'scrap');
      while (scraps.length > 8) {
        const old = scraps.shift();
        scene.remove(old.mesh);
        const ix = worldLeaves.indexOf(old);
        if (ix >= 0) worldLeaves.splice(ix, 1);
      }
    }

    const basket = {
      group: basketGroup,
      pos: basketPos,
      hitMesh: basketHit,
      leaves: basketLeaves,
      worldLeaves,
      createWorldLeaf,
      tearLeafInTwo,
      setHighlight(s, t) {
        const em = s * 0.28;
        for (let i = 0; i < basketLeaves.length; i++) {
          const bm = basketLeaves[i].userData.bladeMat;
          if (bm) bm.emissive.setRGB(em * 0.55, em * 1.0, em * 0.45);
          if (s > 0.02) {
            basketLeaves[i].position.y = 0.28 + (i % 3) * 0.035 + Math.sin(t * 4.5 + i) * 0.018 * s;
          }
        }
      }
    };

    // --- 5. SHALLOW CERAMIC WATER DISH WITH RIPPLES & SUNLIGHT GLINT (浅い水皿) ---
    const waterStartPos = new THREE.Vector3(-0.56, 0.0, 2.08);
    const waterGroup = new THREE.Group();
    waterGroup.position.copy(waterStartPos);
    scene.add(waterGroup);

    const waterCeramicTex = T.createCeramicTexture('#e6efe9', 'rgba(116,134,126,0.22)');
    const waterDishMat = new THREE.MeshStandardMaterial({
      map: waterCeramicTex,
      roughness: 0.28,
      metalness: 0.04
    });
    const wProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.35, 0.0),
      new THREE.Vector2(0.45, 0.065),
      new THREE.Vector2(0.47, 0.165),
      new THREE.Vector2(0.42, 0.175),
      new THREE.Vector2(0.38, 0.13),
      new THREE.Vector2(0.30, 0.045),
      new THREE.Vector2(0.0, 0.035)
    ];
    const waterBowl = new THREE.Mesh(new THREE.LatheGeometry(wProfile, 32), waterDishMat);
    waterBowl.castShadow = true;
    waterBowl.receiveShadow = true;
    waterGroup.add(waterBowl);

    // Translucent water surface disc
    const waterSurfaceGeo = new THREE.CircleGeometry(0.405, 32);
    waterSurfaceGeo.rotateX(-Math.PI / 2);
    const waterSurfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0xcfe8ee,
      roughness: 0.05,
      metalness: 0.12,
      transparent: true,
      opacity: 0.76,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.75
    });
    const waterSurface = new THREE.Mesh(waterSurfaceGeo, waterSurfaceMat);
    waterSurface.position.y = 0.128;
    waterGroup.add(waterSurface);

    // Expanding concentric ripple rings + sunlit shimmer glints
    const ripples = [];
    for (let i = 0; i < 4; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.062, 28), rMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.133;
      waterGroup.add(ring);
      ripples.push({ mesh: ring, mat: rMat, life: 0, active: false });
    }

    // Sparkling morning sun glint dot that dances on the water when rippled
    const glintMat = new THREE.MeshBasicMaterial({
      color: 0xfffce8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sunGlint = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), glintMat);
    sunGlint.rotation.x = -Math.PI / 2;
    sunGlint.position.set(0.11, 0.136, -0.06);
    waterGroup.add(sunGlint);

    const waterHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.34, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    waterHit.position.y = 0.14;
    waterHit.userData.interactive = 'water_dish';
    waterGroup.add(waterHit);

    let rippleIdx = 0;
    let rippleEnergy = 0;

    const waterDish = {
      group: waterGroup,
      hitMesh: waterHit,
      pos: waterGroup.position,
      startPos: waterStartPos.clone(),
      pushedClose: false,
      triggerRipple() {
        const r = ripples[rippleIdx % ripples.length];
        rippleIdx++;
        r.active = true;
        r.life = 0;
        r.mesh.scale.setScalar(0.5);
        r.mat.opacity = 0.78;
        rippleEnergy = Math.min(1.0, rippleEnergy + 0.75);
      },
      setPosition(x, z) {
        const cx = Math.max(-1.12, Math.min(0.18, x));
        const cz = Math.max(1.06, Math.min(2.15, z));
        // Smoothly glide over the low front sill (Z ~ 1.72)
        const sillFactor = Math.max(0, Math.min(1, (1.88 - cz) / 0.32));
        const cy = sillFactor * (box.floorY + 0.004);
        this.group.position.set(cx, cy, cz);
        this.pushedClose = cz < 1.62;
      },
      setHighlight(s, t) {
        const em = s * 0.24;
        waterDishMat.emissive.setRGB(em * 0.65, em * 0.9, em * 1.0);
        if (s > 0.05) {
          glintMat.opacity = 0.55 + Math.sin(t * 5.0) * 0.35;
        }
      },
      update(dt, elapsed) {
        rippleEnergy = Math.max(0, rippleEnergy - dt * 0.55);
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          if (!r.active) continue;
          r.life += dt;
          const p = r.life / 1.35;
          if (p >= 1) {
            r.active = false;
            r.mat.opacity = 0;
          } else {
            const sc = 0.45 + p * 5.8;
            r.mesh.scale.setScalar(sc);
            r.mat.opacity = (1 - p) * (1 - p) * 0.72;
          }
        }
        // Morning sun shimmer on water surface
        const wobble = 0.012 + rippleEnergy * 0.055;
        sunGlint.position.x = 0.11 + Math.sin(elapsed * 4.5) * wobble;
        sunGlint.position.z = -0.06 + Math.cos(elapsed * 5.3) * wobble;
        sunGlint.scale.set(
          1.0 + Math.sin(elapsed * 6.2) * (0.12 + rippleEnergy * 0.55),
          1.0 + Math.cos(elapsed * 5.1) * (0.12 + rippleEnergy * 0.4),
          1
        );
        glintMat.opacity = 0.42 + rippleEnergy * 0.48 + Math.sin(elapsed * 3.8) * 0.12;
      }
    };

    return {
      feedDish: feedDishObj,
      spoon,
      grains,
      spawnGrain,
      updateGrains,
      removeGrain,
      uncoverGrainsNear,
      basket,
      worldLeaves,
      updateWorldLeaves,
      waterDish
    };
  }

  window.PiyoProps = { buildProps };
})();
