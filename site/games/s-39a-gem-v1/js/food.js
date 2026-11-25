window.RPP = window.RPP || {};

RPP.Food = (function () {
  let nextFoodId = 1;

  function createAppleMesh(tex) {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshPhysicalMaterial({
      map: tex.appleSkin,
      roughness: 0.26,
      metalness: 0.0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
    });
    const fleshMat = new THREE.MeshStandardMaterial({
      color: 0xf7eed7,
      roughness: 0.62,
      metalness: 0.0,
    });

    // Sculpted apple wedge: closed quarter-sphere slice with curved red peel (+X) & two flat creamy flesh faces
    const radius = 0.068;
    const phiLen = Math.PI * 0.44;
    const thetaMin = 0.26;
    const thetaLen = Math.PI - thetaMin * 2;
    const outerGeo = new THREE.SphereGeometry(
      radius,
      16,
      12,
      Math.PI - phiLen * 0.5,
      phiLen,
      thetaMin,
      thetaLen
    );
    const outerMesh = new THREE.Mesh(outerGeo, skinMat);
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;
    group.add(outerMesh);

    // Exact matching inner creamy flesh cut-face polygon
    const shape = new THREE.Shape();
    shape.moveTo(0, radius * Math.cos(thetaMin));
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const th = thetaMin + (i / steps) * thetaLen;
      shape.lineTo(radius * Math.sin(th), radius * Math.cos(th));
    }
    shape.lineTo(0, radius * Math.cos(thetaMin + thetaLen));
    shape.closePath();

    const cutGeo = new THREE.ShapeGeometry(shape);
    const fleshDoubleMat = fleshMat.clone();
    fleshDoubleMat.side = THREE.DoubleSide;

    const cut1 = new THREE.Mesh(cutGeo, fleshDoubleMat);
    cut1.rotation.y = phiLen * 0.5;
    cut1.castShadow = true;
    group.add(cut1);

    const cut2 = new THREE.Mesh(cutGeo, fleshDoubleMat);
    cut2.rotation.y = -phiLen * 0.5;
    cut2.castShadow = true;
    group.add(cut2);

    // Subtle dark apple seed pip on cut face
    const seedMat = new THREE.MeshStandardMaterial({ color: 0x3b2316, roughness: 0.6 });
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 6), seedMat);
    seed.scale.set(0.7, 1.4, 0.5);
    seed.position.set(0.022, 0.002, 0.014);
    group.add(seed);

    // Center nicely for holding & placing
    const holder = new THREE.Group();
    group.position.set(-0.028, 0, 0);
    group.rotation.set(0.2, 0.5, 0.45);
    holder.add(group);

    holder.userData.visualRoot = group;
    holder.userData.materials = [skinMat, fleshDoubleMat];
    return holder;
  }

  function createBambooMesh() {
    const group = new THREE.Group();

    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x3b6637,
      roughness: 0.65,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2b5230,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf4f8fc,
      roughness: 0.78,
    });

    // Slender slightly curved bamboo twig
    const twigCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.012, 0.09, 0.006),
      new THREE.Vector3(0.032, 0.19, 0.01),
      new THREE.Vector3(0.056, 0.27, 0.008),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(twigCurve, 12, 0.0075, 7, false), stemMat);
    stem.castShadow = true;
    group.add(stem);

    // Bamboo nodes
    for (const t of [0.32, 0.68]) {
      const p = twigCurve.getPoint(t);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0022, 6, 10), stemMat);
      ring.position.copy(p);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    // Lance-shaped bamboo leaf geometry
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.018, 0.035, 0.013, 0.088);
    leafShape.quadraticCurveTo(0.004, 0.118, 0, 0.132);
    leafShape.quadraticCurveTo(-0.004, 0.118, -0.013, 0.088);
    leafShape.quadraticCurveTo(-0.018, 0.035, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
    // Gentle arch along leaf
    const lpos = leafGeo.attributes.position;
    for (let i = 0; i < lpos.count; i++) {
      const ly = lpos.getY(i);
      lpos.setZ(i, -ly * ly * 1.4);
    }
    leafGeo.computeVertexNormals();

    const leaves = [];
    const snowCaps = [];
    const leafSpecs = [
      { t: 0.36, ry: 0.5, rx: 0.85, rz: -0.35, sc: 0.92 },
      { t: 0.52, ry: -1.8, rx: 0.95, rz: 0.25, sc: 1.0 },
      { t: 0.68, ry: 1.2, rx: 0.78, rz: -0.2, sc: 0.95 },
      { t: 0.82, ry: -0.6, rx: 0.72, rz: 0.3, sc: 0.88 },
      { t: 0.96, ry: 2.2, rx: 0.55, rz: -0.15, sc: 0.84 },
    ];

    for (const sp of leafSpecs) {
      const p = twigCurve.getPoint(sp.t);
      const leafHolder = new THREE.Group();
      leafHolder.position.copy(p);
      leafHolder.rotation.set(sp.rx, sp.ry, sp.rz);
      leafHolder.scale.setScalar(sp.sc);

      const leafMesh = new THREE.Mesh(leafGeo, leafMat);
      leafMesh.castShadow = true;
      leafHolder.add(leafMesh);

      // Little white snow patch sitting on top of the bamboo leaf!
      const snowCap = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), snowMat);
      snowCap.scale.set(0.72, 0.38, 1.85);
      snowCap.position.set(0, 0.058, 0.005);
      leafHolder.add(snowCap);

      group.add(leafHolder);
      leaves.push(leafHolder);
      snowCaps.push(snowCap);
    }

    group.userData.leaves = leaves;
    group.userData.snowCaps = snowCaps;
    group.userData.materials = [stemMat, leafMat];
    return group;
  }

  function createGrapeMesh() {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x62307c,
      emissive: 0x16071f,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      transmission: 0.32,
      thickness: 0.05,
      ior: 1.38,
      transparent: true,
      opacity: 0.92,
    });
    const geo = new THREE.SphereGeometry(0.024, 14, 12);
    geo.scale(0.95, 1.12, 0.95);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.userData.materials = [mat];
    return m;
  }

  function createGrapeClusterMesh() {
    const group = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c6f3c, roughness: 0.8 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.06, 6), stemMat);
    stem.position.set(0, 0.055, 0);
    stem.rotation.z = 0.28;
    group.add(stem);

    const offsets = [
      [0, 0.025, 0],
      [-0.026, 0.02, 0.014],
      [0.026, 0.02, 0.012],
      [0.0, 0.018, -0.024],
      [-0.02, -0.008, -0.012],
      [0.022, -0.006, -0.014],
      [0.0, -0.01, 0.024],
      [-0.016, -0.032, 0.008],
      [0.016, -0.032, 0.008],
      [0.0, -0.052, 0.0],
    ];
    const mats = [];
    for (const [x, y, z] of offsets) {
      const b = createGrapeMesh();
      b.position.set(x, y, z);
      group.add(b);
      mats.push(b.material);
    }
    group.userData.materials = mats;
    return group;
  }

  function create(scene, world) {
    const tex = RPP.Textures.getAll();
    const foodGroup = new THREE.Group();
    scene.add(foodGroup);

    const dishItems = { low: [], mid: [], high: [] };
    const snowApples = []; // Dropped apples on the snow that can be picked back up!
    const snowMarks = []; // Snow craters and purple grape dots left in the snow
    const flyingItems = []; // Parabolic toss/fall physics items
    const particles = []; // Crumbs, falling bamboo snow, brush puffs

    // =========================================================================
    // BASKET DISPLAY ITEMS (always visible & touchable inside the basket)
    // =========================================================================
    let bambooUnlocked = false;
    let grapeUnlocked = false;

    const basketSlots = {
      apples: [],
      bamboo: null,
      grapes: null,
    };

    const appleBasketPositions = [
      new THREE.Vector3(-0.075, 0.062, 0.038),
      new THREE.Vector3(0.035, 0.058, 0.055),
      new THREE.Vector3(-0.018, 0.068, -0.045),
    ];

    function buildBasketContents() {
      // Clear existing
      for (const a of basketSlots.apples) world.basketGroup.remove(a.mesh);
      basketSlots.apples = [];
      if (basketSlots.bamboo) {
        world.basketGroup.remove(basketSlots.bamboo.mesh);
        basketSlots.bamboo = null;
      }
      if (basketSlots.grapes) {
        world.basketGroup.remove(basketSlots.grapes.mesh);
        basketSlots.grapes = null;
      }

      // Always keep 3 crisp apple wedges in the basket
      for (let i = 0; i < 3; i++) {
        const m = createAppleMesh(tex);
        m.position.copy(appleBasketPositions[i]);
        m.rotation.set(0.25 + i * 0.4, i * 1.9, 0.2 - i * 0.15);
        m.scale.setScalar(1.02);
        tagInteractive(m, { interactive: 'basketItem', foodType: 'apple', slotIdx: i });
        world.basketGroup.add(m);
        basketSlots.apples.push({
          mesh: m,
          basePos: appleBasketPositions[i].clone(),
          cooldown: 0,
        });
      }

      // Snow-dusted bamboo sprig (unlocked around 1.5–2.5 min or after a few feeds)
      const bm = createBambooMesh();
      bm.position.set(0.11, 0.045, -0.03);
      bm.rotation.set(-0.22, -0.5, -0.58);
      bm.visible = bambooUnlocked;
      tagInteractive(bm, { interactive: 'basketItem', foodType: 'bamboo' });
      world.basketGroup.add(bm);
      basketSlots.bamboo = {
        mesh: bm,
        basePos: bm.position.clone(),
        cooldown: 0,
      };

      // Translucent purple grape cluster (unlocked next)
      const gm = createGrapeClusterMesh();
      gm.position.set(-0.115, 0.088, -0.02);
      gm.rotation.set(0.35, 0.3, -0.25);
      gm.scale.setScalar(1.08);
      gm.visible = grapeUnlocked;
      tagInteractive(gm, { interactive: 'basketItem', foodType: 'grape' });
      world.basketGroup.add(gm);
      basketSlots.grapes = {
        mesh: gm,
        basePos: gm.position.clone(),
        cooldown: 0,
      };
    }

    function tagInteractive(obj, data) {
      obj.userData = Object.assign(obj.userData || {}, data);
      obj.traverse((child) => {
        if (child.isMesh) {
          child.userData = Object.assign(child.userData || {}, data);
        }
      });
    }

    buildBasketContents();

    function unlockBamboo() {
      if (bambooUnlocked) return false;
      bambooUnlocked = true;
      if (basketSlots.bamboo) {
        basketSlots.bamboo.mesh.visible = true;
        basketSlots.bamboo.mesh.scale.setScalar(0.01);
        basketSlots.bamboo.popAnim = 1.0;
      }
      return true;
    }

    function unlockGrapes() {
      if (grapeUnlocked) return false;
      grapeUnlocked = true;
      if (basketSlots.grapes) {
        basketSlots.grapes.mesh.visible = true;
        basketSlots.grapes.mesh.scale.setScalar(0.01);
        basketSlots.grapes.popAnim = 1.0;
      }
      return true;
    }

    // Create a live food entity in the world
    function createFoodItem(type, stateOverride) {
      let mesh;
      let totalBites = 4;
      if (type === 'apple') {
        mesh = createAppleMesh(tex);
        totalBites = 4;
      } else if (type === 'bamboo') {
        mesh = createBambooMesh();
        totalBites = 5;
      } else {
        mesh = createGrapeMesh();
        totalBites = 2;
      }
      const item = {
        id: nextFoodId++,
        type,
        mesh,
        totalBites,
        bitesLeft: stateOverride && stateOverride.bitesLeft != null ? stateOverride.bitesLeft : totalBites,
        dishId: null,
        onSnow: false,
        heldBy: null,
        sharedWith: null,
        slotOffset: new THREE.Vector3(),
      };
      applyFoodVisualProgress(item);
      foodGroup.add(mesh);
      return item;
    }

    function applyFoodVisualProgress(item) {
      if (item.type === 'apple') {
        const ratio = Math.max(0.28, item.bitesLeft / item.totalBites);
        item.mesh.scale.set(0.85 + ratio * 0.25, 0.55 + ratio * 0.55, 0.75 + ratio * 0.35);
      } else if (item.type === 'bamboo') {
        const leaves = item.mesh.userData.leaves || [];
        for (let i = 0; i < leaves.length; i++) {
          leaves[i].visible = i < item.bitesLeft;
        }
      } else if (item.type === 'grape') {
        const ratio = Math.max(0.55, item.bitesLeft / item.totalBites);
        item.mesh.scale.setScalar(ratio);
      }
    }

    // Arrange items cleanly inside a dish's shallow rim
    function layoutDish(dishId) {
      const list = dishItems[dishId];
      const dish = world.dishes[dishId];
      const offsets = [
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(-0.052, 0.0, 0.032),
        new THREE.Vector3(0.055, 0.0, 0.025),
        new THREE.Vector3(0.0, 0.0, -0.048),
      ];
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (it.heldBy) continue;
        const off = offsets[i % offsets.length];
        it.slotOffset.copy(off);
        const yOff = it.type === 'bamboo' ? 0.005 : it.type === 'grape' ? 0.025 : 0.036;
        it.mesh.position.set(dish.pos.x + off.x, dish.surfaceY + yOff, dish.pos.z + off.z);
        if (it.type === 'bamboo') {
          it.mesh.rotation.set(0.08, i * 1.1 + 0.4, -0.18);
        } else if (it.type === 'apple') {
          it.mesh.rotation.set(0.1, i * 1.4 + 0.3, 0.15);
        } else {
          it.mesh.rotation.set(0, i * 0.8, 0);
        }
      }
    }

    function placeOnDish(item, dishId, silent) {
      const list = dishItems[dishId];
      // Keep max 4 items per dish so dishes never overflow
      if (list.length >= 4) {
        const oldest = list.find((x) => !x.heldBy);
        if (oldest) removeFoodItem(oldest);
      }
      item.dishId = dishId;
      item.onSnow = false;
      item.heldBy = null;
      if (!list.includes(item)) list.push(item);
      tagInteractive(item.mesh, { interactive: 'dishFood', foodId: item.id, dishId });
      layoutDish(dishId);
      if (!silent) {
        world.bounceDish(dishId, 0.42);
        RPP.Audio.playDishTap(world.dishes[dishId].pitch);
      }
    }

    function removeFoodItem(item) {
      if (!item) return;
      if (item.dishId && dishItems[item.dishId]) {
        const idx = dishItems[item.dishId].indexOf(item);
        if (idx >= 0) dishItems[item.dishId].splice(idx, 1);
        layoutDish(item.dishId);
      }
      const sIdx = snowApples.indexOf(item);
      if (sIdx >= 0) snowApples.splice(sIdx, 1);
      if (item.mesh && item.mesh.parent) {
        item.mesh.parent.remove(item.mesh);
      }
      item.dishId = null;
      item.onSnow = false;
      item.heldBy = null;
    }

    function detachFromDishOrSnow(item) {
      if (item.dishId && dishItems[item.dishId]) {
        const idx = dishItems[item.dishId].indexOf(item);
        if (idx >= 0) dishItems[item.dishId].splice(idx, 1);
        layoutDish(item.dishId);
      }
      const sIdx = snowApples.indexOf(item);
      if (sIdx >= 0) snowApples.splice(sIdx, 1);
      item.dishId = null;
      item.onSnow = false;
      if (item.mesh.parent !== foodGroup) {
        foodGroup.add(item.mesh);
      }
    }

    // Add a snow crater or tiny purple grape dot on the snow below
    function addSnowMark(x, z, kind) {
      // Keep snow marks nicely bounded
      if (snowMarks.length > 26) {
        const old = snowMarks.shift();
        scene.remove(old.mesh);
      }
      let mesh;
      if (kind === 'grape') {
        const g = new THREE.Group();
        const crater = new THREE.Mesh(
          new THREE.RingGeometry(0.015, 0.055, 14),
          new THREE.MeshStandardMaterial({ color: 0xc8daf0, roughness: 0.9, side: THREE.DoubleSide })
        );
        crater.rotation.x = -Math.PI / 2;
        crater.position.y = 0.012;
        g.add(crater);

        const berry = createGrapeMesh();
        berry.position.y = 0.022;
        berry.scale.setScalar(1.05);
        g.add(berry);
        g.position.set(x, 0.01, z);
        mesh = g;
      } else {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(0.075, 16),
          new THREE.MeshStandardMaterial({ color: 0xc9dcef, roughness: 0.92 })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.016, z);
      }
      scene.add(mesh);
      snowMarks.push({ x, z, kind, mesh });
    }

    // Launch an item along a parabolic arc (either landing on snow or smoothly arcing into a dish)
    function launchItem(item, startPos, velocity, targetDishId) {
      detachFromDishOrSnow(item);
      item.mesh.position.copy(startPos);
      flyingItems.push({
        item,
        pos: startPos.clone(),
        vel: velocity.clone(),
        targetDishId: targetDishId || null,
        age: 0,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 5
        ),
      });
    }

    // Smoothly arc a tapped item from basket directly into a target dish
    function tossToDish(item, startPos, dishId) {
      const dest = world.dishes[dishId].pos.clone();
      dest.y += 0.07;
      const dur = 0.44;
      const g = 6.2;
      const vx = (dest.x - startPos.x) / dur;
      const vz = (dest.z - startPos.z) / dur;
      const vy = (dest.y - startPos.y + 0.5 * g * dur * dur) / dur;
      detachFromDishOrSnow(item);
      item.mesh.position.copy(startPos);
      flyingItems.push({
        item,
        pos: startPos.clone(),
        vel: new THREE.Vector3(vx, vy, vz),
        targetDishId: dishId,
        duration: dur,
        gravity: g,
        age: 0,
        spin: new THREE.Vector3(2.5, 3.0, 1.5),
      });
    }

    // Spawn a tumbling purple grape that slips from a greedy red panda's paws!
    function dropGrapeFromBranch(originPos) {
      const grape = createFoodItem('grape');
      const start = originPos.clone();
      const vx = (Math.random() - 0.5) * 0.55;
      const vz = 0.35 + Math.random() * 0.35;
      const vy = 0.55;
      RPP.Audio.playGrapeRoll();
      launchItem(grape, start, new THREE.Vector3(vx, vy, vz), null);
    }

    // Spawn particles (apple crumbs, falling bamboo snow, hollow brush puffs)
    const puffGeo = new THREE.SphereGeometry(1, 7, 6);
    const crumbMatCream = new THREE.MeshStandardMaterial({ color: 0xf7eed5, roughness: 0.7 });
    const crumbMatRed = new THREE.MeshStandardMaterial({ color: 0xc52d2a, roughness: 0.5 });
    const flakeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, transparent: true, opacity: 0.92 });

    function spawnAppleCrumbs(pos, count) {
      const n = count || 5;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(puffGeo, i === 0 ? crumbMatRed : crumbMatCream);
        const s = 0.006 + Math.random() * 0.006;
        m.scale.setScalar(s);
        m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04));
        scene.add(m);
        particles.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.55, 0.25 + Math.random() * 0.45, 0.15 + Math.random() * 0.35),
          gravity: 3.6,
          life: 0.65 + Math.random() * 0.35,
          maxLife: 1.0,
          fade: true,
        });
      }
    }

    function spawnSnowFlakes(pos, count, spread) {
      const n = count || 12;
      const sp = spread || 0.14;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(puffGeo, flakeMat.clone());
        const s = 0.008 + Math.random() * 0.011;
        m.scale.setScalar(s);
        m.position.copy(pos).add(
          new THREE.Vector3((Math.random() - 0.5) * sp, (Math.random() - 0.3) * sp * 0.7, (Math.random() - 0.5) * sp)
        );
        scene.add(m);
        particles.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.25, -0.12 - Math.random() * 0.25, (Math.random() - 0.5) * 0.25),
          gravity: 0.55,
          flutter: 0.4 + Math.random() * 0.6,
          life: 1.4 + Math.random() * 0.9,
          maxLife: 2.3,
          fade: true,
        });
      }
    }

    function findFoodById(id) {
      for (const dId of ['low', 'mid', 'high']) {
        for (const it of dishItems[dId]) {
          if (it.id === id) return it;
        }
      }
      for (const it of snowApples) {
        if (it.id === id) return it;
      }
      return null;
    }

    function getBasketItemWorldPos(foodType) {
      const out = new THREE.Vector3();
      world.basketGroup.updateMatrixWorld(true);
      if (foodType === 'bamboo' && basketSlots.bamboo) {
        basketSlots.bamboo.mesh.getWorldPosition(out);
      } else if (foodType === 'grape' && basketSlots.grapes) {
        basketSlots.grapes.mesh.getWorldPosition(out);
      } else if (basketSlots.apples[0]) {
        basketSlots.apples[0].mesh.getWorldPosition(out);
      } else {
        out.copy(world.basketWorldPos);
      }
      return out;
    }

    function update(dt, elapsed, guidedTarget, onLandedOnDish) {
      // Animate basket pop-ins & single-target gentle bounce/glow
      const guideType = guidedTarget && guidedTarget.kind === 'basketItem' ? guidedTarget.foodType : null;

      for (let i = 0; i < basketSlots.apples.length; i++) {
        const slot = basketSlots.apples[i];
        const isGuided = guideType === 'apple' && i === 0;
        const bounce = isGuided ? Math.abs(Math.sin(elapsed * 3.0)) * 0.024 : 0;
        slot.mesh.position.y = slot.basePos.y + bounce;
        setMeshGlow(slot.mesh, isGuided ? 0.22 + 0.14 * Math.sin(elapsed * 3.4) : 0);
      }

      if (basketSlots.bamboo && bambooUnlocked) {
        const b = basketSlots.bamboo;
        if (b.popAnim > 0) {
          b.popAnim = Math.max(0, b.popAnim - dt * 1.6);
          const sc = 1 - Math.pow(b.popAnim, 2);
          b.mesh.scale.setScalar(Math.max(0.01, sc));
        }
        const isGuided = guideType === 'bamboo';
        b.mesh.position.y = b.basePos.y + (isGuided ? Math.abs(Math.sin(elapsed * 3.0)) * 0.025 : 0);
        setMeshGlow(b.mesh, isGuided ? 0.25 + 0.15 * Math.sin(elapsed * 3.4) : 0);
      }

      if (basketSlots.grapes && grapeUnlocked) {
        const g = basketSlots.grapes;
        if (g.popAnim > 0) {
          g.popAnim = Math.max(0, g.popAnim - dt * 1.6);
          const sc = 1.08 * (1 - Math.pow(g.popAnim, 2));
          g.mesh.scale.setScalar(Math.max(0.01, sc));
        }
        const isGuided = guideType === 'grape';
        g.mesh.position.y = g.basePos.y + (isGuided ? Math.abs(Math.sin(elapsed * 3.0)) * 0.022 : 0);
        setMeshGlow(g.mesh, isGuided ? 0.26 + 0.14 * Math.sin(elapsed * 3.4) : 0);
      }

      // Update flying items
      for (let i = flyingItems.length - 1; i >= 0; i--) {
        const f = flyingItems[i];
        f.age += dt;
        const grav = f.gravity || 6.8;
        f.vel.y -= grav * dt;
        f.pos.addScaledVector(f.vel, dt);
        f.item.mesh.position.copy(f.pos);
        f.item.mesh.rotation.x += f.spin.x * dt;
        f.item.mesh.rotation.y += f.spin.y * dt;

        // Check guided dish landing
        if (f.targetDishId && f.duration && f.age >= f.duration) {
          placeOnDish(f.item, f.targetDishId, false);
          flyingItems.splice(i, 1);
          if (onLandedOnDish) onLandedOnDish(f.targetDishId, f.item);
          continue;
        }

        // Check passing near a lower dish while falling
        if (!f.targetDishId && f.vel.y < 0) {
          let caughtDish = null;
          for (const dId of ['high', 'mid', 'low']) {
            const d = world.dishes[dId];
            const horiz = Math.hypot(f.pos.x - d.pos.x, f.pos.z - d.pos.z);
            if (horiz < 0.17 && Math.abs(f.pos.y - d.surfaceY) < 0.09) {
              caughtDish = dId;
              break;
            }
          }
          if (caughtDish) {
            placeOnDish(f.item, caughtDish, false);
            flyingItems.splice(i, 1);
            if (onLandedOnDish) onLandedOnDish(caughtDish, f.item);
            continue;
          }
        }

        // Hit snowy ground
        if (f.pos.y <= 0.045) {
          f.pos.y = 0.045;
          f.pos.x = THREE.MathUtils.clamp(f.pos.x, -1.35, 1.35);
          f.pos.z = THREE.MathUtils.clamp(f.pos.z, -0.55, 1.35);
          RPP.Audio.playSnowDrop();
          spawnSnowFlakes(f.pos, 7, 0.12);

          if (f.item.type === 'grape') {
            addSnowMark(f.pos.x, f.pos.z, 'grape');
            removeFoodItem(f.item);
          } else if (f.item.type === 'apple') {
            addSnowMark(f.pos.x, f.pos.z, 'crater');
            f.item.mesh.position.copy(f.pos);
            f.item.mesh.rotation.set(0.15, Math.random() * Math.PI * 2, 0.3);
            f.item.onSnow = true;
            tagInteractive(f.item.mesh, { interactive: 'snowFood', foodId: f.item.id });
            snowApples.push(f.item);
          } else {
            addSnowMark(f.pos.x, f.pos.z, 'crater');
            f.item.mesh.position.copy(f.pos);
            f.item.mesh.rotation.set(Math.PI * 0.45, Math.random() * Math.PI * 2, 0.1);
            f.item.onSnow = true;
            tagInteractive(f.item.mesh, { interactive: 'snowFood', foodId: f.item.id });
            snowApples.push(f.item);
          }
          flyingItems.splice(i, 1);
        }
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          particles.splice(i, 1);
          continue;
        }
        p.vel.y -= p.gravity * dt;
        if (p.flutter) {
          p.mesh.position.x += Math.sin(elapsed * 5 + i) * 0.08 * dt * p.flutter;
        }
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.fade && p.mesh.material && p.mesh.material.transparent) {
          p.mesh.material.opacity = Math.min(1, p.life / (p.maxLife * 0.45));
        }
      }
    }

    function setMeshGlow(mesh, amount) {
      const mats = mesh.userData && mesh.userData.materials;
      if (!mats) return;
      for (const m of mats) {
        if (m && m.emissive) {
          m.emissive.setRGB(amount * 0.85, amount * 0.62, amount * 0.25);
        }
      }
    }

    function serialize() {
      const dState = {};
      for (const id of ['low', 'mid', 'high']) {
        dState[id] = dishItems[id]
          .filter((it) => !it.heldBy)
          .map((it) => ({ type: it.type, bitesLeft: it.bitesLeft }));
      }
      return {
        bambooUnlocked,
        grapeUnlocked,
        dishes: dState,
        snowItems: snowApples.slice(0, 6).map((it) => ({
          type: it.type,
          bitesLeft: it.bitesLeft,
          x: it.mesh.position.x,
          z: it.mesh.position.z,
        })),
        snowMarks: snowMarks.slice(-16).map((m) => ({ x: m.x, z: m.z, kind: m.kind })),
      };
    }

    function restore(data) {
      if (!data) return;
      if (data.bambooUnlocked) unlockBamboo();
      if (data.grapeUnlocked) unlockGrapes();

      if (data.dishes) {
        for (const id of ['low', 'mid', 'high']) {
          const arr = data.dishes[id] || [];
          for (const rec of arr) {
            const it = createFoodItem(rec.type, { bitesLeft: rec.bitesLeft });
            placeOnDish(it, id, true);
          }
        }
      }
      if (data.snowItems) {
        for (const rec of data.snowItems) {
          const it = createFoodItem(rec.type, { bitesLeft: rec.bitesLeft });
          it.mesh.position.set(rec.x, 0.045, rec.z);
          it.onSnow = true;
          tagInteractive(it.mesh, { interactive: 'snowFood', foodId: it.id });
          snowApples.push(it);
        }
      }
      if (data.snowMarks) {
        for (const m of data.snowMarks) {
          addSnowMark(m.x, m.z, m.kind);
        }
      }
    }

    return {
      dishItems,
      snowApples,
      isBambooUnlocked: () => bambooUnlocked,
      isGrapeUnlocked: () => grapeUnlocked,
      unlockBamboo,
      unlockGrapes,
      createFoodItem,
      applyFoodVisualProgress,
      placeOnDish,
      removeFoodItem,
      detachFromDishOrSnow,
      launchItem,
      tossToDish,
      dropGrapeFromBranch,
      spawnAppleCrumbs,
      spawnSnowFlakes,
      findFoodById,
      getBasketItemWorldPos,
      update,
      serialize,
      restore,
    };
  }

  return { create };
})();
