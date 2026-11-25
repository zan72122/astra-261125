window.RPP = window.RPP || {};

RPP.World = (function () {
  function createTaperedBranch(curve, rStart, rEnd, tubularSegs, radialSegs, snowBias) {
    const frames = curve.computeFrenetFrames(tubularSegs, false);
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const snowPositions = [];
    const snowNormals = [];
    const snowUvs = [];
    const snowIndices = [];

    const up = new THREE.Vector3(0, 1, 0);
    const pt = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const localUp = new THREE.Vector3();
    const nrm = new THREE.Vector3();

    for (let i = 0; i <= tubularSegs; i++) {
      const u = i / tubularSegs;
      curve.getPointAt(u, pt);
      curve.getTangentAt(u, tangent).normalize();

      // Build stable frame aligned to world up so snow always sits on top
      side.crossVectors(tangent, up);
      if (side.lengthSq() < 0.0001) {
        side.set(1, 0, 0);
      } else {
        side.normalize();
      }
      localUp.crossVectors(side, tangent).normalize();

      const radius = THREE.MathUtils.lerp(rStart, rEnd, u);
      const wobble = 1 + Math.sin(u * Math.PI * 5.0) * 0.04;
      const r = radius * wobble;

      for (let j = 0; j <= radialSegs; j++) {
        const v = j / radialSegs;
        const theta = v * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        nrm.set(0, 0, 0)
          .addScaledVector(side, cos)
          .addScaledVector(localUp, sin)
          .normalize();

        // Center of branch is shifted down by r so the curve runs along the exact top walkable surface
        const vx = pt.x + nrm.x * r - localUp.x * r;
        const vy = pt.y + nrm.y * r - localUp.y * r;
        const vz = pt.z + nrm.z * r - localUp.z * r;

        positions.push(vx, vy, vz);
        normals.push(nrm.x, nrm.y, nrm.z);
        uvs.push(v, u * 3.0);

        // Snow cap only on top hemisphere (sin > 0.15)
        const snowThickness = snowBias && sin > 0.12
          ? snowBias * Math.pow(Math.max(0, (sin - 0.12) / 0.88), 0.65) *
            (0.75 + 0.25 * Math.sin(u * 17.0 + theta * 2.0)) *
            Math.sin(Math.min(1, u * 5) * Math.PI * 0.5) *
            Math.sin(Math.min(1, (1 - u) * 5) * Math.PI * 0.5)
          : 0;
        const sr = r + 0.003 + snowThickness;
        snowPositions.push(
          pt.x + nrm.x * sr - localUp.x * r,
          pt.y + nrm.y * sr - localUp.y * r + snowThickness * 0.22,
          pt.z + nrm.z * sr - localUp.z * r
        );
        snowNormals.push(nrm.x, nrm.y, nrm.z);
        snowUvs.push(v, u * 3.0);
      }
    }

    const row = radialSegs + 1;
    for (let i = 0; i < tubularSegs; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = i * row + j;
        const b = (i + 1) * row + j;
        const c = (i + 1) * row + (j + 1);
        const d = i * row + (j + 1);
        indices.push(a, b, d, b, c, d);

        if (snowBias) {
          const thetaMid = ((j + 0.5) / radialSegs) * Math.PI * 2;
          if (Math.sin(thetaMid) > 0.22) {
            snowIndices.push(a, b, d, b, c, d);
          }
        }
      }
    }

    const barkGeo = new THREE.BufferGeometry();
    barkGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    barkGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    barkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    barkGeo.setIndex(indices);
    barkGeo.computeVertexNormals();

    let snowGeo = null;
    if (snowBias && snowIndices.length > 0) {
      snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
      snowGeo.setAttribute('normal', new THREE.Float32BufferAttribute(snowNormals, 3));
      snowGeo.setAttribute('uv', new THREE.Float32BufferAttribute(snowUvs, 2));
      snowGeo.setIndex(snowIndices);
      snowGeo.computeVertexNormals();
    }

    return { barkGeo, snowGeo };
  }

  function create(scene) {
    const tex = RPP.Textures.getAll();

    // Soft bright winter morning sky & fog (never dark!)
    scene.fog = new THREE.FogExp2(0xd9e7f3, 0.042);

    const skyGeo = new THREE.SphereGeometry(38, 32, 20);
    const skyMat = new THREE.MeshBasicMaterial({
      map: tex.skyMap,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Winter morning side sunlight + cool snow sky bounce + white fur-tip rim light
    const hemiLight = new THREE.HemisphereLight(0xd4e6f8, 0xbcd0e4, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e4, 2.05);
    sunLight.position.set(6.5, 5.2, 3.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 20;
    sunLight.shadow.camera.left = -4.2;
    sunLight.shadow.camera.right = 4.2;
    sunLight.shadow.camera.top = 4.2;
    sunLight.shadow.camera.bottom = -2.2;
    sunLight.shadow.bias = -0.0006;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // Soft white rim light from back-left so red panda fur tips catch the winter morning glow
    const rimLight = new THREE.DirectionalLight(0xf2f7ff, 0.92);
    rimLight.position.set(-4.8, 3.8, -5.2);
    scene.add(rimLight);

    // Gentle front fill so facial features stay crisp and soft without harsh black shadows
    const frontFill = new THREE.DirectionalLight(0xe6f0fa, 0.42);
    frontFill.position.set(0.4, 1.8, 5.5);
    scene.add(frontFill);

    // Subtle warm interior fill inside the tree hollow so Panda 2's fur is faintly visible
    const hollowLight = new THREE.PointLight(0xf6cfa4, 0.75, 1.45, 1.8);
    hollowLight.position.set(-0.84, 1.68, -0.18);
    scene.add(hollowLight);

    // Shared materials
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f6fb,
      roughness: 0.78,
      metalness: 0.0,
      bumpMap: tex.snowBump,
      bumpScale: 0.012,
    });
    const snowShadowMat = new THREE.MeshStandardMaterial({
      color: 0xe6eff8,
      roughness: 0.82,
      bumpMap: tex.snowBump,
      bumpScale: 0.01,
    });
    const barkMat = new THREE.MeshStandardMaterial({
      map: tex.barkMap,
      bumpMap: tex.barkBump,
      bumpScale: 0.032,
      roughness: 0.92,
      metalness: 0.0,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      map: tex.woodMap,
      roughness: 0.75,
      metalness: 0.02,
    });
    const wickerMat = new THREE.MeshStandardMaterial({
      map: tex.wickerMap,
      roughness: 0.86,
      metalness: 0.0,
    });

    // Snowy ground terrain
    const groundGeo = new THREE.PlaneGeometry(46, 46, 64, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z);
      let h = 0;
      if (dist > 2.2) {
        const edge = Math.min(1, (dist - 2.2) / 5.5);
        h =
          edge *
          (0.32 * Math.sin(x * 0.28 + 0.6) * Math.cos(z * 0.25) +
            0.22 * Math.sin(x * 0.65 - z * 0.45) +
            0.28 * Math.max(0, -z * 0.14));
      } else {
        h = 0.025 * Math.sin(x * 1.4) * Math.cos(z * 1.2);
      }
      pos.setY(i, h);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, snowMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // Snowdrifts nestled around the tree roots
    const driftSpots = [
      [-1.15, 0.06, -0.52, 0.72, 0.22, 0.62],
      [-0.65, 0.03, -0.22, 0.55, 0.16, 0.48],
      [-1.58, 0.08, -0.30, 0.68, 0.26, 0.55],
      [0.85, 0.04, -0.65, 0.85, 0.22, 0.65],
      [1.45, 0.05, 0.35, 0.75, 0.18, 0.58],
    ];
    for (const [x, y, z, sx, sy, sz] of driftSpots) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), snowShadowMat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.receiveShadow = true;
      scene.add(m);
    }

    // =========================================================================
    // WALKABLE BRANCH GRAPH & HERO CLIMBING TREE
    // Every node (x, y, z) is the exact walkable top surface of a branch!
    // =========================================================================
    const nodes = {
      hollowIn: new THREE.Vector3(-0.98, 1.59, -0.28),
      hollowRim: new THREE.Vector3(-0.70, 1.56, -0.04),
      midDishL: new THREE.Vector3(-0.52, 1.59, 0.03),
      midDishR: new THREE.Vector3(0.02, 1.67, 0.09),
      midCenter: new THREE.Vector3(0.28, 1.72, 0.08),
      midRight: new THREE.Vector3(0.86, 1.77, -0.02),
      lowBend: new THREE.Vector3(-0.56, 1.18, 0.06),
      lowDishL: new THREE.Vector3(0.14, 1.00, 0.34),
      lowDishR: new THREE.Vector3(0.78, 0.96, 0.38),
      highFork: new THREE.Vector3(-0.08, 2.02, -0.08),
      highDishL: new THREE.Vector3(0.14, 2.28, -0.11),
      highDishR: new THREE.Vector3(0.82, 2.34, -0.15),
      highLeft: new THREE.Vector3(-0.48, 2.26, -0.22),
    };

    const edgeDefs = [
      ['hollowIn', 'hollowRim', 0.14, 0.14, null],
      ['hollowRim', 'midDishL', 0.16, 0.16, null],
      ['midDishL', 'midDishR', 0.16, 0.15, new THREE.Vector3(-0.25, 1.64, 0.07)],
      ['midDishR', 'midCenter', 0.15, 0.14, null],
      ['midCenter', 'midRight', 0.14, 0.11, new THREE.Vector3(0.58, 1.76, 0.03)],
      ['midDishL', 'lowBend', 0.14, 0.13, new THREE.Vector3(-0.58, 1.38, 0.04)],
      ['lowBend', 'lowDishL', 0.13, 0.12, new THREE.Vector3(-0.22, 1.08, 0.22)],
      ['lowDishL', 'lowDishR', 0.12, 0.10, new THREE.Vector3(0.46, 0.98, 0.37)],
      ['midDishR', 'highFork', 0.13, 0.12, new THREE.Vector3(-0.04, 1.86, -0.01)],
      ['midCenter', 'highFork', 0.12, 0.11, new THREE.Vector3(0.11, 1.90, 0.0)],
      ['highFork', 'highDishL', 0.12, 0.11, new THREE.Vector3(0.03, 2.17, -0.10)],
      ['highDishL', 'highDishR', 0.11, 0.095, new THREE.Vector3(0.48, 2.33, -0.13)],
      ['highFork', 'highLeft', 0.11, 0.095, new THREE.Vector3(-0.28, 2.16, -0.15)],
    ];

    const adjacency = {};
    const edgeMap = {};
    for (const k of Object.keys(nodes)) adjacency[k] = [];

    for (const [a, b, rA, rB, midPt] of edgeDefs) {
      const pts = midPt
        ? [nodes[a].clone(), midPt.clone(), nodes[b].clone()]
        : [nodes[a].clone(), nodes[a].clone().lerp(nodes[b], 0.5), nodes[b].clone()];
      const curve = new THREE.CatmullRomCurve3(pts);
      const len = curve.getLength();
      const keyAB = a + '|' + b;
      const keyBA = b + '|' + a;
      edgeMap[keyAB] = { from: a, to: b, curve, length: len, rStart: rA, rEnd: rB };
      edgeMap[keyBA] = {
        from: b,
        to: a,
        curve: new THREE.CatmullRomCurve3(pts.slice().reverse()),
        length: len,
        rStart: rB,
        rEnd: rA,
      };
      adjacency[a].push({ to: b, cost: len });
      adjacency[b].push({ to: a, cost: len });
    }

    function getPath(startId, endId, allowHollow) {
      if (startId === endId) return [startId];
      const dist = {};
      const prev = {};
      const visited = new Set();
      for (const k of Object.keys(nodes)) dist[k] = Infinity;
      dist[startId] = 0;

      while (true) {
        let u = null;
        let best = Infinity;
        for (const k of Object.keys(nodes)) {
          if (!visited.has(k) && dist[k] < best) {
            best = dist[k];
            u = k;
          }
        }
        if (!u || u === endId) break;
        visited.add(u);
        for (const nb of adjacency[u]) {
          if (!allowHollow && nb.to === 'hollowIn' && endId !== 'hollowIn') continue;
          const nd = dist[u] + nb.cost;
          if (nd < dist[nb.to]) {
            dist[nb.to] = nd;
            prev[nb.to] = u;
          }
        }
      }
      if (!prev[endId]) return [startId];
      const path = [];
      let cur = endId;
      while (cur) {
        path.unshift(cur);
        cur = prev[cur];
      }
      return path;
    }

    const treeGroup = new THREE.Group();
    scene.add(treeGroup);

    // Main gnarled trunk (shifted slightly back-left around hollow height so the hollow opening is completely unobstructed!)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.22, -0.05, -0.64),
      new THREE.Vector3(-1.18, 0.85, -0.58),
      new THREE.Vector3(-1.16, 1.62, -0.56),
      new THREE.Vector3(-1.02, 2.38, -0.48),
      new THREE.Vector3(-0.82, 3.25, -0.46),
      new THREE.Vector3(-0.70, 4.15, -0.52),
    ]);
    const trunkMeshData = createTaperedBranch(trunkCurve, 0.34, 0.14, 30, 14, 0);
    const trunkMesh = new THREE.Mesh(trunkMeshData.barkGeo, barkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // Flared roots anchoring the trunk into the snow
    const rootDefs = [
      [[-1.08, 0.25, -0.45], [-1.52, 0.08, -0.15], [-1.85, -0.05, 0.15]],
      [[-1.02, 0.22, -0.42], [-0.72, 0.07, 0.02], [-0.52, -0.06, 0.32]],
      [[-1.16, 0.24, -0.58], [-1.42, 0.08, -0.95], [-1.68, -0.05, -1.25]],
    ];
    for (const pts of rootDefs) {
      const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const { barkGeo, snowGeo } = createTaperedBranch(c, 0.17, 0.06, 12, 10, 0.022);
      const bm = new THREE.Mesh(barkGeo, barkMat);
      bm.castShadow = true;
      bm.receiveShadow = true;
      treeGroup.add(bm);
      if (snowGeo) {
        const sm = new THREE.Mesh(snowGeo, snowMat);
        sm.receiveShadow = true;
        treeGroup.add(sm);
      }
    }

    // Build visual 3D branches matching every walkable branch segment (plus natural tapering extensions)
    const visualBranches = [
      // Hero main middle branch
      {
        pts: [
          new THREE.Vector3(-0.88, 1.55, -0.25),
          nodes.hollowRim,
          nodes.midDishL,
          new THREE.Vector3(-0.25, 1.64, 0.07),
          nodes.midDishR,
          nodes.midCenter,
          new THREE.Vector3(0.58, 1.76, 0.03),
          nodes.midRight,
          new THREE.Vector3(1.38, 1.84, -0.10),
        ],
        r0: 0.18,
        r1: 0.065,
        snow: 0.034,
      },
      // Lower sweeping branch
      {
        pts: [
          new THREE.Vector3(-0.98, 1.16, -0.35),
          nodes.lowBend,
          new THREE.Vector3(-0.22, 1.08, 0.22),
          nodes.lowDishL,
          new THREE.Vector3(0.46, 0.98, 0.37),
          nodes.lowDishR,
          new THREE.Vector3(1.22, 0.94, 0.42),
        ],
        r0: 0.16,
        r1: 0.06,
        snow: 0.032,
      },
      // Diagonal limb connecting middle branch down to lower branch
      {
        pts: [
          nodes.midDishL,
          new THREE.Vector3(-0.58, 1.38, 0.04),
          nodes.lowBend,
        ],
        r0: 0.135,
        r1: 0.125,
        snow: 0.024,
      },
      // Ascending branch connecting main branch up to high branch
      {
        pts: [
          nodes.midDishR,
          new THREE.Vector3(-0.04, 1.86, -0.01),
          nodes.highFork,
          new THREE.Vector3(0.03, 2.17, -0.10),
          nodes.highDishL,
          new THREE.Vector3(0.48, 2.33, -0.13),
          nodes.highDishR,
          new THREE.Vector3(1.34, 2.42, -0.22),
        ],
        r0: 0.135,
        r1: 0.055,
        snow: 0.032,
      },
      // Secondary diagonal bridge from midCenter to highFork
      {
        pts: [
          nodes.midCenter,
          new THREE.Vector3(0.11, 1.90, 0.0),
          nodes.highFork,
        ],
        r0: 0.115,
        r1: 0.105,
        snow: 0.022,
      },
      // Upper left lookout limb
      {
        pts: [
          nodes.highFork,
          new THREE.Vector3(-0.28, 2.16, -0.15),
          nodes.highLeft,
          new THREE.Vector3(-0.96, 2.46, -0.35),
        ],
        r0: 0.11,
        r1: 0.06,
        snow: 0.028,
      },
      // High canopy twigs for silhouette & winter framing
      {
        pts: [
          new THREE.Vector3(-0.72, 2.72, -0.34),
          new THREE.Vector3(-0.10, 2.98, -0.45),
          new THREE.Vector3(0.75, 3.16, -0.58),
          new THREE.Vector3(1.45, 3.28, -0.68),
        ],
        r0: 0.10,
        r1: 0.032,
        snow: 0.024,
      },
      {
        pts: [
          new THREE.Vector3(-0.78, 2.65, -0.34),
          new THREE.Vector3(-1.45, 2.92, -0.45),
          new THREE.Vector3(-2.15, 3.05, -0.55),
        ],
        r0: 0.095,
        r1: 0.03,
        snow: 0.024,
      },
    ];

    for (const br of visualBranches) {
      const curve = new THREE.CatmullRomCurve3(br.pts);
      const { barkGeo, snowGeo } = createTaperedBranch(curve, br.r0, br.r1, 24, 12, br.snow);
      const bm = new THREE.Mesh(barkGeo, barkMat);
      bm.castShadow = true;
      bm.receiveShadow = true;
      treeGroup.add(bm);

      if (snowGeo) {
        const sm = new THREE.Mesh(snowGeo, snowMat);
        sm.receiveShadow = true;
        treeGroup.add(sm);
      }
    }

    // =========================================================================
    // TREE HOLLOW (木の洞) — warm dim interior + brushable snow mound on lip
    // =========================================================================
    const hollowGroup = new THREE.Group();
    hollowGroup.position.set(-0.84, 1.62, -0.22);
    hollowGroup.rotation.y = 0.42;
    scene.add(hollowGroup);

    // Outer gnarled bark housing around the hollow (open in front so interior & Panda 2 are unobstructed!)
    const outerShellGeo = new THREE.SphereGeometry(0.32, 18, 14, Math.PI * 0.28, Math.PI * 1.44, 0.08, Math.PI - 0.16);
    outerShellGeo.scale(1.05, 1.22, 1.15);
    const outerShell = new THREE.Mesh(outerShellGeo, barkMat);
    outerShell.position.set(0, 0.02, -0.04);
    outerShell.rotation.y = Math.PI * 0.5;
    outerShell.castShadow = true;
    outerShell.receiveShadow = true;
    hollowGroup.add(outerShell);

    const collarGeo = new THREE.TorusGeometry(0.24, 0.082, 12, 24);
    collarGeo.scale(0.96, 1.16, 0.85);
    const collarMesh = new THREE.Mesh(collarGeo, barkMat);
    collarMesh.position.set(0, 0.02, 0.13);
    collarMesh.castShadow = true;
    collarMesh.receiveShadow = true;
    hollowGroup.add(collarMesh);

    // Warm wooden interior cavity (NOT pitch black — warm wood tones visible!)
    const cavityMat = new THREE.MeshStandardMaterial({
      color: 0x6b4930,
      roughness: 0.9,
      side: THREE.BackSide,
    });
    const cavityGeo = new THREE.SphereGeometry(0.28, 18, 14);
    cavityGeo.scale(1.0, 1.16, 1.12);
    const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
    cavityMesh.position.set(0, 0.02, -0.05);
    hollowGroup.add(cavityMesh);

    // Warm wood-scented floor slab inside the hollow (revealed when snow is brushed away!)
    const hollowFloorMat = new THREE.MeshStandardMaterial({
      map: tex.woodMap,
      color: 0xa67c54,
      roughness: 0.85,
    });
    const hollowFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.05, 16), hollowFloorMat);
    hollowFloor.position.set(0, -0.20, 0.02);
    hollowFloor.receiveShadow = true;
    hollowGroup.add(hollowFloor);

    // Soft snow cushion sitting on the hollow entrance lip (brushable by child's finger!)
    const hollowSnowGroup = new THREE.Group();
    hollowSnowGroup.position.set(0, -0.17, 0.19);
    hollowGroup.add(hollowSnowGroup);

    const hollowSnowClumps = [];
    const clumpPositions = [
      [-0.14, 0.02, 0.01, 0.085, 0.055, 0.075],
      [-0.07, 0.035, 0.02, 0.095, 0.062, 0.08],
      [0.0, 0.04, 0.025, 0.10, 0.065, 0.082],
      [0.07, 0.032, 0.02, 0.092, 0.06, 0.078],
      [0.14, 0.02, 0.01, 0.082, 0.05, 0.072],
      [-0.10, 0.065, -0.01, 0.07, 0.048, 0.065],
      [0.02, 0.075, -0.005, 0.078, 0.052, 0.068],
      [0.10, 0.06, -0.01, 0.07, 0.045, 0.062],
    ];
    for (let i = 0; i < clumpPositions.length; i++) {
      const [cx, cy, cz, sx, sy, sz] = clumpPositions[i];
      const clumpMat = snowMat.clone();
      const clump = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), clumpMat);
      clump.position.set(cx, cy, cz);
      clump.scale.set(sx, sy, sz);
      clump.userData = { interactive: 'hollowSnow', clumpIndex: i, baseScale: new THREE.Vector3(sx, sy, sz) };
      hollowSnowGroup.add(clump);
      hollowSnowClumps.push(clump);
    }

    // Invisible slightly wider hit-helper for easy child swiping on hollow snow
    const hollowHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hollowHit.position.set(0, 0.04, 0.02);
    hollowHit.userData = { interactive: 'hollowSnow' };
    hollowSnowGroup.add(hollowHit);

    const hollowSnowWorldPos = new THREE.Vector3();
    hollowGroup.updateMatrixWorld(true);
    hollowSnowGroup.getWorldPosition(hollowSnowWorldPos);

    // =========================================================================
    // THREE SHALLOW WOODEN SAUCERS (受け皿: low, mid, high)
    // =========================================================================
    const dishConfigs = [
      {
        id: 'low',
        pos: new THREE.Vector3(0.46, 1.05, 0.43),
        leftNode: 'lowDishL',
        rightNode: 'lowDishR',
        pitch: 0.92,
      },
      {
        id: 'mid',
        pos: new THREE.Vector3(-0.28, 1.71, 0.16),
        leftNode: 'midDishL',
        rightNode: 'midDishR',
        pitch: 1.04,
      },
      {
        id: 'high',
        pos: new THREE.Vector3(0.48, 2.41, -0.06),
        leftNode: 'highDishL',
        rightNode: 'highDishR',
        pitch: 1.18,
      },
    ];

    const dishes = {};
    const dishProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.11, 0.0),
      new THREE.Vector2(0.165, 0.018),
      new THREE.Vector2(0.175, 0.042),
      new THREE.Vector2(0.16, 0.045),
      new THREE.Vector2(0.135, 0.024),
      new THREE.Vector2(0.0, 0.018),
    ];
    const dishGeo = new THREE.LatheGeometry(dishProfile, 28);

    for (const cfg of dishConfigs) {
      const g = new THREE.Group();
      g.position.copy(cfg.pos);

      const dMat = new THREE.MeshStandardMaterial({
        map: tex.woodMap,
        color: 0xc89d72,
        roughness: 0.68,
        metalness: 0.02,
      });
      const bowl = new THREE.Mesh(dishGeo, dMat);
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      bowl.userData = { interactive: 'dish', dishId: cfg.id };
      g.add(bowl);

      // Wooden mounting post anchoring dish cleanly to the branch below
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.14, 10), woodMat);
      peg.position.set(0, -0.065, -0.02);
      peg.castShadow = true;
      g.add(peg);

      // Subtle touch target sphere for easy tapping on mobile
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.14, 14),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.set(0, 0.04, 0);
      hit.userData = { interactive: 'dish', dishId: cfg.id };
      g.add(hit);

      // Soft warm glow ring (only visible when highlighted or hovered while dragging)
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffe4a8,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.155, 0.215, 28), glowMat);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.048;
      g.add(glowRing);

      scene.add(g);
      dishes[cfg.id] = {
        id: cfg.id,
        group: g,
        bowl,
        material: dMat,
        glowMat,
        pos: cfg.pos.clone(),
        surfaceY: cfg.pos.y + 0.024,
        leftNode: cfg.leftNode,
        rightNode: cfg.rightNode,
        pitch: cfg.pitch,
        bounceVel: 0,
        bounceOff: 0,
        hoverStrength: 0,
      };
    }

    // =========================================================================
    // SMALL WOODEN FEEDING STAND & WOVEN BASKET (小さな木の餌台と籠)
    // =========================================================================
    const standPos = new THREE.Vector3(-0.16, 0.0, 0.88);
    const standGroup = new THREE.Group();
    standGroup.position.copy(standPos);
    scene.add(standGroup);

    // Rustic wooden tabletop (y = 0.64)
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.055, 20), woodMat);
    tableTop.position.set(0, 0.63, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    standGroup.add(tableTop);

    // Three splayed wooden legs
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.68, 10), woodMat);
      leg.position.set(Math.cos(ang) * 0.18, 0.31, Math.sin(ang) * 0.18);
      leg.rotation.z = -Math.cos(ang) * 0.16;
      leg.rotation.x = Math.sin(ang) * 0.16;
      leg.castShadow = true;
      leg.receiveShadow = true;
      standGroup.add(leg);
    }

    // Snow dusted on edge of stand
    const standSnow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), snowMat);
    standSnow.scale.set(1.2, 0.25, 0.9);
    standSnow.position.set(-0.22, 0.665, -0.14);
    standGroup.add(standSnow);

    // Woven shallow basket tilted gently toward viewer so contents shine clearly
    const basketGroup = new THREE.Group();
    basketGroup.position.set(0, 0.67, 0.01);
    basketGroup.rotation.x = 0.20;
    standGroup.add(basketGroup);

    const basketProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.18, 0.0),
      new THREE.Vector2(0.24, 0.045),
      new THREE.Vector2(0.265, 0.115),
      new THREE.Vector2(0.25, 0.128),
      new THREE.Vector2(0.225, 0.05),
      new THREE.Vector2(0.165, 0.018),
      new THREE.Vector2(0.0, 0.018),
    ];
    const basketMesh = new THREE.Mesh(new THREE.LatheGeometry(basketProfile, 28), wickerMat);
    basketMesh.castShadow = true;
    basketMesh.receiveShadow = true;
    basketMesh.userData = { interactive: 'basket' };
    basketGroup.add(basketMesh);

    // Braided rim torus
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.258, 0.018, 10, 28), wickerMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.118;
    rimMesh.castShadow = true;
    rimMesh.userData = { interactive: 'basket' };
    basketGroup.add(rimMesh);

    // Soft warm glow ring for basket guidance
    const basketGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffe4a8,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const basketGlow = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.30, 32), basketGlowMat);
    basketGlow.rotation.x = -Math.PI / 2;
    basketGlow.position.y = 0.13;
    basketGroup.add(basketGlow);

    // =========================================================================
    // ZOO ENCLOSURE BACKGROUND (wooden fence, snowy evergreens, rocks)
    // =========================================================================
    const bgGroup = new THREE.Group();
    scene.add(bgGroup);

    const fenceWoodMat = new THREE.MeshStandardMaterial({
      map: tex.woodMap,
      color: 0x997c62,
      roughness: 0.88,
    });
    // Gentle curved wooden zoo fence in mid-background
    for (let i = -7; i <= 7; i++) {
      const fx = i * 1.15;
      const fz = -4.8 - Math.abs(i) * 0.14;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.35, 8), fenceWoodMat);
      post.position.set(fx, 0.62, fz);
      post.receiveShadow = true;
      bgGroup.add(post);

      // Tiny snow cap on fence post
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), snowMat);
      cap.scale.set(1.05, 0.45, 1.05);
      cap.position.set(fx, 1.30, fz);
      bgGroup.add(cap);

      if (i < 7) {
        const nx = (i + 1) * 1.15;
        const nz = -4.8 - Math.abs(i + 1) * 0.14;
        const len = Math.hypot(nx - fx, nz - fz);
        const ang = Math.atan2(nz - fz, nx - fx);
        for (const ry of [0.55, 1.02]) {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, len, 7), fenceWoodMat);
          rail.position.set((fx + nx) * 0.5, ry, (fz + nz) * 0.5);
          rail.rotation.z = Math.PI / 2;
          rail.rotation.y = -ang;
          bgGroup.add(rail);
        }
      }
    }

    // Snow-laden evergreen pine trees in the peaceful winter zoo park
    const pineGreenMat = new THREE.MeshStandardMaterial({
      color: 0x3b5842,
      roughness: 0.9,
    });
    const pineSpots = [
      [-4.8, -6.5, 1.35],
      [-2.4, -7.8, 1.55],
      [0.6, -8.5, 1.4],
      [3.1, -7.2, 1.6],
      [5.4, -6.2, 1.3],
      [-6.8, -4.5, 1.25],
      [6.8, -4.8, 1.45],
      [-1.0, -10.5, 1.85],
      [2.2, -11.2, 1.75],
    ];
    for (const [px, pz, sc] of pineSpots) {
      const pg = new THREE.Group();
      pg.position.set(px, 0, pz);
      pg.scale.setScalar(sc);

      const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.3, 8), barkMat);
      pt.position.y = 0.65;
      pg.add(pt);

      const tiers = [
        [1.4, 1.25, 1.35],
        [2.2, 1.02, 1.2],
        [2.9, 0.78, 1.05],
        [3.5, 0.50, 0.85],
      ];
      for (const [ty, rad, h] of tiers) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 9), pineGreenMat);
        cone.position.y = ty;
        pg.add(cone);

        const sCone = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.94, h * 0.58, 9), snowShadowMat);
        sCone.position.y = ty + h * 0.24;
        pg.add(sCone);
      }
      bgGroup.add(pg);
    }

    // Snow-dusted zoo boulders & distant rustic log
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7e8389, roughness: 0.92 });
    const rocks = [
      [-2.45, 0.24, -1.8, 0.65, 0.42, 0.52],
      [2.15, 0.22, -2.1, 0.72, 0.44, 0.56],
      [2.75, 0.16, -1.65, 0.42, 0.28, 0.38],
      [-2.85, 0.18, -2.4, 0.48, 0.34, 0.44],
    ];
    for (const [rx, ry, rz, sx, sy, sz] of rocks) {
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
      rk.position.set(rx, ry, rz);
      rk.scale.set(sx, sy, sz);
      rk.receiveShadow = true;
      bgGroup.add(rk);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.92, 12, 8), snowMat);
      cap.position.set(rx, ry + sy * 0.48, rz);
      cap.scale.set(sx * 0.92, sy * 0.42, sz * 0.92);
      bgGroup.add(cap);
    }

    // =========================================================================
    // FALLING SNOW SYSTEM (subtle at morning start, rich gentle snow at finale)
    // =========================================================================
    const snowCount = 260;
    const snowGeoPts = new THREE.BufferGeometry();
    const snowArr = new Float32Array(snowCount * 3);
    const snowVel = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowArr[i * 3] = (Math.random() - 0.5) * 9.5;
      snowArr[i * 3 + 1] = Math.random() * 5.2;
      snowArr[i * 3 + 2] = (Math.random() - 0.5) * 7.0;
      snowVel[i * 3] = (Math.random() - 0.5) * 0.16;
      snowVel[i * 3 + 1] = -(0.22 + Math.random() * 0.24);
      snowVel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
    snowGeoPts.setAttribute('position', new THREE.BufferAttribute(snowArr, 3));
    const snowPtsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: tex.softPuff,
      size: 0.095,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const snowPoints = new THREE.Points(snowGeoPts, snowPtsMat);
    scene.add(snowPoints);

    // State for hollow snow clearing
    let hollowCleared = 0; // 0 = full snow on lip, 1 = fully cleared
    let snowIntensity = 0.18;
    let targetSnowIntensity = 0.18;

    function setHollowCleared(val) {
      hollowCleared = THREE.MathUtils.clamp(val, 0, 1);
      for (let i = 0; i < hollowSnowClumps.length; i++) {
        const c = hollowSnowClumps[i];
        const threshold = i / hollowSnowClumps.length;
        const remain = THREE.MathUtils.clamp((1 - hollowCleared - threshold * 0.45) / 0.55, 0, 1);
        c.visible = remain > 0.04;
        const bs = c.userData.baseScale;
        c.scale.set(bs.x * remain, bs.y * remain, bs.z * remain);
      }
      hollowHit.visible = hollowCleared < 0.92;
    }

    function setTargetSnowIntensity(v) {
      targetSnowIntensity = THREE.MathUtils.clamp(v, 0.1, 1.0);
    }

    function bounceDish(dishId, strength) {
      const d = dishes[dishId];
      if (!d) return;
      d.bounceVel = -(strength || 0.35);
    }

    function update(dt, elapsed, guidedTarget, hoveredDishId) {
      // Update falling snow
      snowIntensity += (targetSnowIntensity - snowIntensity) * Math.min(1, dt * 0.6);
      snowPtsMat.opacity = 0.14 + snowIntensity * 0.72;
      snowPtsMat.size = 0.065 + snowIntensity * 0.055;

      const pAttr = snowGeoPts.attributes.position;
      const speedMul = 0.55 + snowIntensity * 0.75;
      for (let i = 0; i < snowCount; i++) {
        let x = pAttr.getX(i) + (snowVel[i * 3] + Math.sin(elapsed * 0.7 + i) * 0.07) * dt * speedMul;
        let y = pAttr.getY(i) + snowVel[i * 3 + 1] * dt * speedMul;
        let z = pAttr.getZ(i) + snowVel[i * 3 + 2] * dt * speedMul;
        if (y < 0.02) {
          y = 4.8 + Math.random() * 0.6;
          x = (Math.random() - 0.5) * 9.0;
          z = (Math.random() - 0.5) * 6.5;
        }
        pAttr.setXYZ(i, x, y, z);
      }
      pAttr.needsUpdate = true;

      // Dish spring bounce & subtle glow
      for (const id of Object.keys(dishes)) {
        const d = dishes[id];
        d.bounceVel += -d.bounceOff * 95 * dt;
        d.bounceVel *= Math.pow(0.08, dt);
        d.bounceOff += d.bounceVel * dt;
        d.group.position.y = d.pos.y + d.bounceOff * 0.04;

        const isHovered = hoveredDishId === id;
        const isGuided = guidedTarget && guidedTarget.kind === 'dish' && guidedTarget.dishId === id;
        const targetGlow = isHovered ? 0.55 : isGuided ? 0.25 + 0.16 * Math.sin(elapsed * 3.4) : 0;
        d.hoverStrength += (targetGlow - d.hoverStrength) * Math.min(1, dt * 10);
        d.glowMat.opacity = d.hoverStrength;
      }

      // Basket glow (only when basket itself is the single guided target, e.g., waking up sleeping pandas)
      const basketGuided = guidedTarget && guidedTarget.kind === 'basket';
      basketGlowMat.opacity = basketGuided ? 0.24 + 0.16 * Math.sin(elapsed * 3.2) : 0;

      // Hollow snow subtle gentle shimmer when hollow snow is the single guided target
      const hollowGuided = guidedTarget && guidedTarget.kind === 'hollowSnow' && hollowCleared < 0.85;
      const pulse = hollowGuided ? 0.18 + 0.14 * Math.sin(elapsed * 3.4) : 0;
      for (const c of hollowSnowClumps) {
        if (c.visible) {
          c.material.emissive.setRGB(pulse * 0.55, pulse * 0.65, pulse * 0.85);
        }
      }
    }

    return {
      nodes,
      edgeMap,
      getPath,
      dishes,
      standGroup,
      basketGroup,
      basketWorldPos: new THREE.Vector3(-0.16, 0.77, 0.89),
      hollowGroup,
      hollowSnowGroup,
      hollowSnowClumps,
      hollowSnowWorldPos,
      getHollowCleared: () => hollowCleared,
      setHollowCleared,
      setTargetSnowIntensity,
      bounceDish,
      update,
    };
  }

  return { create };
})();
