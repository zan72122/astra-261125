(function (global) {
  'use strict';

  const T = global.OtterTextures;

  // Shared texture cache
  let sharedTextures = null;
  function getTextures() {
    if (sharedTextures) return sharedTextures;
    sharedTextures = {
      momFur: T.createFurTextures('#4f392b', '#876c55', 11),
      babyFur: T.createFurTextures('#735b46', '#ad9279', 23),
      rockOtterFur: T.createFurTextures('#5a4334', '#947a63', 37),
      creamFur: T.createFurTextures('#dcd0bc', '#f3eadc', 51),
      clam: T.createClamTexture(),
      scallop: T.createScallopTexture(),
      stone: T.createStoneTexture(),
      sand: T.createSandTexture(),
      rim: T.createPoolRimTexture(),
      rock: T.createRockTexture(),
      caustics: T.createCausticsTexture(),
      dot: T.createSoftDotTexture()
    };
    return sharedTextures;
  }

  function makeFurMat(texPair, tintHex, opts = {}) {
    return new THREE.MeshPhysicalMaterial({
      color: tintHex,
      map: texPair.map,
      bumpMap: texPair.bumpMap,
      bumpScale: opts.bumpScale ?? 0.012,
      roughness: opts.roughness ?? 0.56,
      metalness: 0.0,
      clearcoat: opts.clearcoat ?? 0.28,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.44,
      sheen: opts.sheen ?? 0.48,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(opts.sheenColor ?? '#a48d78')
    });
  }

  /**
   * Articulated realistic 3D sea otter.
   * Local coordinate frame of `bodyGroup`:
   *   +Z = head / forward
   *   -Z = tail / backward
   *   +Y = belly / chest (so rotation (0,0,0) = floating on back, face & belly up!)
   *   +X = otter's left, -X = otter's right
   */
  function createOtterRig(options = {}) {
    const tex = getTextures();
    const isBaby = Boolean(options.isBaby);
    const variant = options.variant || (isBaby ? 'baby' : 'mom');

    const furTex = variant === 'baby'
      ? tex.babyFur
      : (variant === 'rock' ? tex.rockOtterFur : tex.momFur);

    const bodyColor = variant === 'baby' ? '#8c725b' : (variant === 'rock' ? '#684f3f' : '#5e4535');
    const chestColor = variant === 'baby' ? '#9e846c' : (variant === 'rock' ? '#7a614e' : '#705644');
    const faceColor = variant === 'baby' ? '#ddd0bd' : (variant === 'rock' ? '#e7dfd0' : '#e4d8c5');
    const pawColor = variant === 'baby' ? '#4a382c' : '#32241c';

    const bodyMat = makeFurMat(furTex, bodyColor, {
      clearcoat: isBaby ? 0.16 : 0.30,
      roughness: isBaby ? 0.66 : 0.54
    });
    const chestMat = makeFurMat(furTex, chestColor, {
      clearcoat: isBaby ? 0.15 : 0.26,
      roughness: isBaby ? 0.68 : 0.56
    });
    const faceMat = makeFurMat(tex.creamFur, faceColor, {
      bumpScale: 0.008,
      clearcoat: isBaby ? 0.12 : 0.22,
      roughness: 0.62,
      sheenColor: '#f3ead9'
    });
    const pawMat = new THREE.MeshStandardMaterial({
      color: pawColor,
      roughness: 0.62,
      metalness: 0.0
    });
    const noseMat = new THREE.MeshPhysicalMaterial({
      color: '#1e1714',
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15
    });
    const eyeMat = new THREE.MeshPhysicalMaterial({
      color: '#0e0b0a',
      roughness: 0.06,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    });
    const innerMouthMat = new THREE.MeshStandardMaterial({
      color: '#8f5956',
      roughness: 0.72
    });
    const whiskerMat = new THREE.MeshStandardMaterial({
      color: '#efe8da',
      roughness: 0.5,
      transparent: true,
      opacity: 0.75
    });

    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // --- Torso (smooth overlapping sculpted capsules/spheres for natural buoyant silhouette) ---
    const mainTorso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), bodyMat);
    mainTorso.scale.set(0.95, 0.74, 1.85);
    mainTorso.position.set(0, -0.02, -0.02);
    mainTorso.castShadow = true;
    mainTorso.receiveShadow = true;
    bodyGroup.add(mainTorso);

    // Plump sunlit belly cushion (+Y)
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.20, 22, 16), chestMat);
    belly.scale.set(0.92, 0.56, 1.48);
    belly.position.set(0, 0.055, 0.02);
    belly.receiveShadow = true;
    bodyGroup.add(belly);

    // Broad upper chest / shoulders
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.185, 20, 16), chestMat);
    chest.scale.set(0.96, 0.76, 1.02);
    chest.position.set(0, 0.03, 0.24);
    chest.castShadow = true;
    chest.receiveShadow = true;
    bodyGroup.add(chest);

    // Lower hips tapering smoothly toward hind flippers & tail
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), bodyMat);
    hips.scale.set(0.92, 0.72, 1.12);
    hips.position.set(0, -0.02, -0.28);
    hips.castShadow = true;
    bodyGroup.add(hips);

    // Neck transition (cream-tinted throat blending to dark brown nape)
    const neckBack = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), bodyMat);
    neckBack.scale.set(0.95, 0.85, 1.05);
    neckBack.position.set(0, 0.02, 0.37);
    bodyGroup.add(neckBack);

    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), faceMat);
    throat.scale.set(0.92, 0.72, 0.95);
    throat.position.set(0, 0.068, 0.37);
    bodyGroup.add(throat);

    // --- Head Group ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.105, 0.43);
    // Natural gentle chin-up angle so face, whiskers, nose & small dark eyes are clearly visible!
    headGroup.rotation.x = -0.10;
    bodyGroup.add(headGroup);

    // Dark-brown back crown of head
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 18), bodyMat);
    cranium.scale.set(1.06, 0.92, 1.04);
    cranium.position.set(0, -0.022, -0.005);
    cranium.castShadow = true;
    cranium.receiveShadow = true;
    headGroup.add(cranium);

    // Creamy face mask (broad sea otter cheeks & forehead)
    const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.132, 24, 18), faceMat);
    faceMask.scale.set(1.06, 0.86, 0.94);
    faceMask.position.set(0, 0.030, 0.036);
    faceMask.receiveShadow = true;
    headGroup.add(faceMask);

    // Soft forehead blend
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 14), faceMat);
    brow.scale.set(1.12, 0.72, 0.85);
    brow.position.set(0, 0.044, 0.072);
    headGroup.add(brow);

    // Plush whisker pads (distinctive wide sea otter muzzle)
    const padL = new THREE.Mesh(new THREE.SphereGeometry(0.054, 14, 12), faceMat);
    padL.scale.set(1.06, 0.80, 0.86);
    padL.position.set(0.042, 0.092, 0.078);
    headGroup.add(padL);

    const padR = padL.clone();
    padR.position.x = -0.042;
    headGroup.add(padR);

    // Lower jaw (articulated for chewing & baby yawning)
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, 0.064, 0.056);
    headGroup.add(jawGroup);

    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), faceMat);
    chin.scale.set(1.06, 0.62, 0.92);
    chin.position.set(0, 0.014, 0.024);
    jawGroup.add(chin);

    const mouthCavity = new THREE.Mesh(new THREE.SphereGeometry(0.030, 10, 8), innerMouthMat);
    mouthCavity.scale.set(1.0, 0.52, 0.82);
    mouthCavity.position.set(0, 0.028, 0.030);
    jawGroup.add(mouthCavity);

    // Broad dark diamond-rounded sea otter nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.031, 14, 12), noseMat);
    nose.scale.set(1.20, 0.76, 0.84);
    nose.position.set(0, 0.128, 0.092);
    headGroup.add(nose);

    // Small, round, authentic black sea otter eyes (strictly realistic size, positioned clearly on upper face!)
    const eyeRadius = isBaby ? 0.0175 : 0.0165;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 14, 12);
    const eyelidGeo = new THREE.SphereGeometry(eyeRadius * 1.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.062, 0.118, 0.026);
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(-0.062, 0.118, 0.026);
    headGroup.add(eyeR);

    // Eyelids (open = rotated back behind eye; closed = covering eye smoothly)
    const lidL = new THREE.Mesh(eyelidGeo, faceMat);
    lidL.position.copy(eyeL.position);
    lidL.scale.set(1.04, 1.04, 1.04);
    headGroup.add(lidL);

    const lidR = new THREE.Mesh(eyelidGeo, faceMat);
    lidR.position.copy(eyeR.position);
    lidR.scale.set(1.04, 1.04, 1.04);
    headGroup.add(lidR);

    // Small low-set rounded ears
    const earGeo = new THREE.SphereGeometry(0.029, 12, 10);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.scale.set(0.55, 0.92, 0.85);
    earL.position.set(0.136, 0.032, -0.015);
    earL.rotation.z = -0.35;
    headGroup.add(earL);

    const earR = earL.clone();
    earR.position.x = -0.136;
    earR.rotation.z = 0.35;
    headGroup.add(earR);

    // Fine pale whiskers
    const whiskerGeo = new THREE.CylinderGeometry(0.0014, 0.0005, 0.095, 5);
    whiskerGeo.rotateZ(Math.PI * 0.5);
    for (let side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const w = new THREE.Mesh(whiskerGeo, whiskerMat);
        w.position.set(side * 0.084, 0.092 + (i - 1.5) * 0.009, 0.080 - i * 0.006);
        w.rotation.y = side * (-0.28 - i * 0.08);
        w.rotation.z = side * (-0.12 + i * 0.07);
        headGroup.add(w);
      }
    }

    // --- Articulated Forearms & Paws ---
    function buildArm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.155, 0.065, 0.22);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.095, 8, 12), bodyMat);
      upper.position.set(side * -0.018, 0.055, 0.04);
      upper.rotation.x = 0.45;
      upper.rotation.z = side * 0.32;
      upper.castShadow = true;
      shoulder.add(upper);

      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), pawMat);
      paw.scale.set(0.95, 0.62, 1.18);
      paw.position.set(side * -0.045, 0.11, 0.095);
      paw.castShadow = true;
      shoulder.add(paw);

      return { shoulder, paw };
    }

    const leftArm = buildArm(1);
    const rightArm = buildArm(-1);
    bodyGroup.add(leftArm.shoulder);
    bodyGroup.add(rightArm.shoulder);

    // --- Webbed Hind Flippers ---
    function buildFlipper(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.125, 0.025, -0.34);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.09, 8, 10), bodyMat);
      leg.rotation.x = Math.PI * 0.45;
      leg.position.set(side * 0.015, 0.015, -0.06);
      hip.add(leg);

      // Broad webbed flipper paddle
      const web = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), pawMat);
      web.scale.set(1.12, 0.26, 1.85);
      web.position.set(side * 0.032, 0.042, -0.175);
      web.rotation.y = side * 0.24;
      web.rotation.x = 0.18;
      web.castShadow = true;
      hip.add(web);

      return hip;
    }

    const leftFlipper = buildFlipper(1);
    const rightFlipper = buildFlipper(-1);
    bodyGroup.add(leftFlipper);
    bodyGroup.add(rightFlipper);

    // --- Articulated Muscular Flat Tail (3 segments) ---
    const tail1 = new THREE.Group();
    tail1.position.set(0, -0.025, -0.40);
    bodyGroup.add(tail1);

    const tMesh1 = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), bodyMat);
    tMesh1.scale.set(0.88, 0.56, 1.65);
    tMesh1.position.set(0, 0, -0.09);
    tail1.add(tMesh1);

    const tail2 = new THREE.Group();
    tail2.position.set(0, 0, -0.17);
    tail1.add(tail2);

    const tMesh2 = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), bodyMat);
    tMesh2.scale.set(0.95, 0.44, 1.85);
    tMesh2.position.set(0, 0, -0.09);
    tail2.add(tMesh2);

    const tail3 = new THREE.Group();
    tail3.position.set(0, 0, -0.165);
    tail2.add(tail3);

    const tMesh3 = new THREE.Mesh(new THREE.SphereGeometry(0.040, 10, 8), bodyMat);
    tMesh3.scale.set(1.05, 0.32, 1.75);
    tMesh3.position.set(0, 0, -0.06);
    tail3.add(tMesh3);

    // --- Anchors for carrying baby, stone, shell, meat, and kelp wrap ---
    const bellyAnchor = new THREE.Group();
    bellyAnchor.position.set(0, 0.165, 0.02);
    bodyGroup.add(bellyAnchor);

    const stoneAnchor = new THREE.Group();
    stoneAnchor.position.set(0, 0.165, 0.175);
    bodyGroup.add(stoneAnchor);

    const shellAnchor = new THREE.Group();
    shellAnchor.position.set(0, 0.255, 0.24);
    bodyGroup.add(shellAnchor);

    const mouthAnchor = new THREE.Group();
    mouthAnchor.position.set(0, 0.095, 0.13);
    headGroup.add(mouthAnchor);

    // Kelp wrap ribbon around torso (shown when mom wraps in kelp to sleep!)
    const kelpWrapGroup = new THREE.Group();
    const kelpWrapMat = new THREE.MeshPhysicalMaterial({
      color: '#5a6a34',
      roughness: 0.34,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
      side: THREE.DoubleSide
    });
    const wrapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.26, -0.05, -0.16),
      new THREE.Vector3(-0.22, 0.16, -0.05),
      new THREE.Vector3(0.0, 0.205, 0.02),
      new THREE.Vector3(0.22, 0.15, 0.10),
      new THREE.Vector3(0.26, -0.05, 0.04),
      new THREE.Vector3(0.18, -0.15, -0.10),
      new THREE.Vector3(-0.14, -0.12, -0.22),
      new THREE.Vector3(-0.42, 0.0, -0.28)
    ]);
    const wrapGeo = new THREE.TubeGeometry(wrapCurve, 32, 0.026, 8, false);
    wrapGeo.scale(1, 0.48, 1);
    const wrapMesh = new THREE.Mesh(wrapGeo, kelpWrapMat);
    kelpWrapGroup.add(wrapMesh);

    // Second ribbon strand draped gently across belly
    const wrapCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.38, -0.02, 0.04),
      new THREE.Vector3(-0.18, 0.175, 0.08),
      new THREE.Vector3(0.05, 0.195, -0.06),
      new THREE.Vector3(0.24, 0.10, -0.16),
      new THREE.Vector3(0.32, -0.06, -0.24)
    ]);
    const wrapGeo2 = new THREE.TubeGeometry(wrapCurve2, 24, 0.021, 7, false);
    wrapGeo2.scale(1, 0.42, 1);
    kelpWrapGroup.add(new THREE.Mesh(wrapGeo2, kelpWrapMat));

    kelpWrapGroup.visible = false;
    bodyGroup.add(kelpWrapGroup);

    if (isBaby) {
      root.scale.setScalar(0.47);
    }

    // Helper to set eye closure (0 = open, 1 = peacefully closed)
    function setEyesClosed(amount) {
      const a = Math.max(0, Math.min(1, amount));
      // Eyes face +Y (skyward when on back); lid dome starts covering +Y at rotX = 0, tilts back at rotX = -2.2
      const openRotX = -2.25;
      const closedRotX = 0.08;
      const rx = openRotX + (closedRotX - openRotX) * a;
      lidL.rotation.x = rx;
      lidR.rotation.x = rx;
      lidL.visible = a > 0.05;
      lidR.visible = a > 0.05;
    }
    setEyesClosed(0);

    return {
      root,
      bodyGroup,
      headGroup,
      jawGroup,
      leftArm,
      rightArm,
      leftFlipper,
      rightFlipper,
      tail1,
      tail2,
      tail3,
      bellyAnchor,
      stoneAnchor,
      shellAnchor,
      mouthAnchor,
      kelpWrapGroup,
      setEyesClosed
    };
  }

  // --- Clam (Asari) 3D Bivalve ---
  function createClamMesh() {
    const tex = getTextures();
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex.clam,
      color: '#e8e7e2',
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.62,
      clearcoatRoughness: 0.2
    });

    const g = new THREE.Group();
    const topHalf = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 12), mat);
    topHalf.scale.set(1.22, 0.46, 0.96);
    topHalf.position.y = 0.011;
    topHalf.castShadow = true;
    topHalf.receiveShadow = true;
    g.add(topHalf);

    const botHalf = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 12), mat);
    botHalf.scale.set(1.22, 0.44, 0.96);
    botHalf.position.y = -0.011;
    botHalf.castShadow = true;
    g.add(botHalf);

    g.userData.shellType = 'clam';
    return g;
  }

  // --- Scallop (Hotate) 3D Fan-Shaped Fluted Bivalve ---
  function createScallopMesh() {
    const tex = getTextures();
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex.scallop,
      color: '#efece6',
      roughness: 0.26,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22
    });

    const g = new THREE.Group();
    // Sculpted scalloped fan using extruded shape + subtle dome
    const shape = new THREE.Shape();
    shape.moveTo(-0.036, -0.088);
    shape.lineTo(0.036, -0.088);
    shape.lineTo(0.052, -0.068);
    shape.lineTo(0.026, -0.055);
    const fanSteps = 14;
    for (let i = 0; i <= fanSteps; i++) {
      const a = -Math.PI * 0.42 + (i / fanSteps) * Math.PI * 0.84;
      const r = 0.095 + (i % 2 === 0 ? 0.006 : -0.002);
      shape.lineTo(Math.sin(a) * r, -0.01 + Math.cos(a) * r);
    }
    shape.lineTo(-0.026, -0.055);
    shape.lineTo(-0.052, -0.068);
    shape.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.009,
      bevelSegments: 3
    });
    extrudeGeo.center();
    extrudeGeo.rotateX(Math.PI * 0.5);

    const mesh = new THREE.Mesh(extrudeGeo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);

    g.userData.shellType = 'scallop';
    return g;
  }

  // --- Cracked Shell Half (sinks & rests after cracking) ---
  function createShellHalfMesh(type = 'clam') {
    const tex = getTextures();
    const isScallop = type === 'scallop';

    const outerMat = new THREE.MeshPhysicalMaterial({
      map: isScallop ? tex.scallop : tex.clam,
      color: isScallop ? '#ebe7e0' : '#e0dfda',
      roughness: 0.28,
      clearcoat: 0.5,
      side: THREE.FrontSide
    });
    const innerMat = new THREE.MeshPhysicalMaterial({
      color: '#f5f2eb',
      roughness: 0.18,
      clearcoat: 0.72,
      side: THREE.BackSide
    });

    const g = new THREE.Group();
    const radius = isScallop ? 0.088 : 0.054;
    const geo = new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.48);
    geo.scale(isScallop ? 1.08 : 1.2, isScallop ? 0.25 : 0.44, isScallop ? 1.05 : 0.94);

    const outer = new THREE.Mesh(geo, outerMat);
    outer.castShadow = true;
    const inner = new THREE.Mesh(geo, innerMat);
    g.add(outer);
    g.add(inner);
    return g;
  }

  // --- Shellfish Meat Morsel ---
  function createMeatMesh(isScallop = false) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: isScallop ? '#f7eee0' : '#ebd4ba',
      roughness: 0.32,
      clearcoat: 0.48,
      clearcoatRoughness: 0.25
    });
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      isScallop ? new THREE.CylinderGeometry(0.036, 0.038, 0.026, 14) : new THREE.SphereGeometry(0.030, 12, 10),
      mat
    );
    if (!isScallop) m.scale.set(1.25, 0.75, 0.95);
    g.add(m);
    return g;
  }

  // --- Flat Round Wet River Stone ---
  function createFlatStoneMesh() {
    const tex = getTextures();
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex.stone,
      color: '#5a4a3e',
      roughness: 0.28,
      metalness: 0.02,
      clearcoat: 0.46,
      clearcoatRoughness: 0.30
    });

    const geo = new THREE.SphereGeometry(0.135, 22, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      // Flatten top & bottom smoothly like a real water-worn flat stone
      y *= 0.34;
      x *= 1.12 + 0.06 * Math.sin(z * 14);
      z *= 0.92 + 0.05 * Math.cos(x * 12);
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // --- Small Aquarium Bucket with Thick Finger-Friendly Rim ---
  function createBucketMesh() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: '#c9d9db',
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.34,
      clearcoatRoughness: 0.32,
      side: THREE.DoubleSide
    });
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: '#e3ecee',
      roughness: 0.32,
      clearcoat: 0.42
    });
    const innerBottomMat = new THREE.MeshStandardMaterial({
      color: '#8ea3a6',
      roughness: 0.6
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: '#8b9699',
      roughness: 0.35,
      metalness: 0.65
    });

    // Tapered bucket wall (open top)
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.195, 0.26, 28, 1, true),
      bodyMat
    );
    wall.position.y = 0.13;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Solid bottom floor inside bucket
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.196, 24), innerBottomMat);
    bottom.rotation.x = -Math.PI * 0.5;
    bottom.position.y = 0.025;
    bottom.receiveShadow = true;
    group.add(bottom);

    // Subtle raised base ring
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.198, 0.198, 0.025, 24), bodyMat);
    baseRing.position.y = 0.0125;
    baseRing.castShadow = true;
    group.add(baseRing);

    // Thick comfortable rolled rim (finger-friendly thickness)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.246, 0.028, 14, 32), rimMat);
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = 0.258;
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);

    // Casual rested wire handle draped on the front/side
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.255, 0.23, 0.0),
      new THREE.Vector3(-0.22, 0.14, 0.20),
      new THREE.Vector3(0.0, 0.08, 0.28),
      new THREE.Vector3(0.22, 0.14, 0.20),
      new THREE.Vector3(0.255, 0.23, 0.0)
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 24, 0.008, 8, false), handleMat);
    group.add(handle);

    // Invisible generous hit-collider sphere inside/around bucket for easy 5yo tapping
    const hitArea = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.25, 0.34, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitArea.position.y = 0.17;
    hitArea.userData.isBucketHit = true;
    group.add(hitArea);

    return { group, rim, rimMat, hitArea };
  }

  // --- Swaying Underwater & Surface Floating Kelp Bed ---
  function createKelpBed(anchorX, anchorZ) {
    const group = new THREE.Group();
    group.position.set(anchorX, 0, anchorZ);

    const kelpMat = new THREE.MeshPhysicalMaterial({
      color: '#5c6e37',
      roughness: 0.36,
      clearcoat: 0.48,
      clearcoatRoughness: 0.30,
      side: THREE.DoubleSide
    });
    const kelpLightMat = new THREE.MeshPhysicalMaterial({
      color: '#738544',
      roughness: 0.38,
      clearcoat: 0.45,
      side: THREE.DoubleSide
    });

    const stalks = [];
    const stalkSpecs = [
      { ox: 0.0, oz: 0.0, len: 1.34, leanX: 0.28, leanZ: 0.10, phase: 0.0 },
      { ox: -0.16, oz: 0.12, len: 1.30, leanX: 0.36, leanZ: -0.08, phase: 1.1 },
      { ox: 0.12, oz: -0.15, len: 1.32, leanX: 0.24, leanZ: 0.20, phase: 2.3 },
      { ox: -0.10, oz: -0.20, len: 1.28, leanX: 0.32, leanZ: 0.04, phase: 3.6 }
    ];

    stalkSpecs.forEach((spec, idx) => {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(spec.ox, -1.28, spec.oz);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(spec.leanX * 0.25, spec.len * 0.35, spec.leanZ * 0.3),
        new THREE.Vector3(spec.leanX * 0.65, spec.len * 0.72, spec.leanZ * 0.7),
        new THREE.Vector3(spec.leanX, spec.len, spec.leanZ)
      ]);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.014, 6, false), kelpMat);
      stalkGroup.add(stem);

      // Leafy blades rising along stalk
      for (let k = 0; k < 5; k++) {
        const pt = curve.getPoint(0.28 + k * 0.17);
        const bladeGeo = new THREE.PlaneGeometry(0.11, 0.32, 2, 4);
        const pos = bladeGeo.attributes.position;
        for (let vi = 0; vi < pos.count; vi++) {
          const bx = pos.getX(vi);
          const by = pos.getY(vi);
          const taper = 1 - Math.abs(by / 0.18);
          pos.setX(vi, bx * Math.max(0.15, taper));
          pos.setZ(vi, Math.sin(by * 14 + k) * 0.018);
        }
        bladeGeo.computeVertexNormals();
        const blade = new THREE.Mesh(bladeGeo, k % 2 === 0 ? kelpMat : kelpLightMat);
        blade.position.copy(pt);
        blade.rotation.y = (idx * 1.4 + k * 1.1);
        blade.rotation.x = 0.45;
        stalkGroup.add(blade);
      }

      group.add(stalkGroup);
      stalks.push({ group: stalkGroup, phase: spec.phase });
    });

    // Floating surface kelp ribbon mat (graceful curved underwater-to-surface kelp fronds!)
    const surfaceFronds = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.PlaneGeometry(0.11, 0.58, 4, 14);
      geo.rotateX(-Math.PI * 0.5);
      const pos = geo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const x = pos.getX(vi);
        const z = pos.getZ(vi);
        const u = (z + 0.29) / 0.58; // 0..1 along leaf
        const widthProfile = Math.sin(u * Math.PI) * (0.75 + 0.25 * Math.sin(u * Math.PI * 5));
        pos.setX(vi, x * Math.max(0.08, widthProfile) + Math.sin(u * 6.5 + i) * 0.032);
        pos.setY(vi, Math.sin(u * 9.0 + i) * 0.008);
      }
      geo.computeVertexNormals();
      const frond = new THREE.Mesh(geo, i % 2 === 0 ? kelpLightMat : kelpMat);
      const a = -0.7 + i * 0.38;
      frond.position.set(0.22 + Math.cos(a) * 0.16, -0.018 - i * 0.002, Math.sin(a) * 0.20);
      frond.rotation.y = a + 0.65;
      group.add(frond);
      surfaceFronds.push({ mesh: frond, baseRotY: frond.rotation.y, phase: i * 0.9 });
    }

    function update(t) {
      stalks.forEach(s => {
        s.group.rotation.z = Math.sin(t * 0.75 + s.phase) * 0.055;
        s.group.rotation.x = Math.cos(t * 0.6 + s.phase) * 0.04;
      });
      surfaceFronds.forEach(f => {
        f.mesh.rotation.y = f.baseRotY + Math.sin(t * 0.8 + f.phase) * 0.08;
        f.mesh.position.y = -0.012 + Math.sin(t * 1.4 + f.phase) * 0.008;
      });
    }

    return { group, update };
  }

  // --- Bright Sunny Daytime Aquarium Environment ---
  function createAquariumEnvironment(scene) {
    const tex = getTextures();

    // 1. Bright sunlit daytime sky dome
    const skyGeo = new THREE.SphereGeometry(28, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#97cee2') },
        uMidColor: { value: new THREE.Color('#d2ecef') },
        uLowColor: { value: new THREE.Color('#8ec5c7') },
        uWarmth: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uLowColor;
        uniform float uWarmth;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = h > 0.0
            ? mix(uMidColor, uTopColor, smoothstep(0.0, 0.65, h))
            : mix(uMidColor, uLowColor, smoothstep(0.0, -0.35, h));
          col = mix(col, col * vec3(1.06, 1.01, 0.93), uWarmth);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // 2. Sandy sunlit pool floor (y = -1.28)
    const floorGeo = new THREE.PlaneGeometry(14, 12, 32, 28);
    floorGeo.rotateX(-Math.PI * 0.5);
    const fPos = floorGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const x = fPos.getX(i);
      const z = fPos.getZ(i);
      const y = -1.28 + Math.sin(x * 0.9) * 0.03 + Math.cos(z * 1.1) * 0.025;
      fPos.setY(i, y);
    }
    floorGeo.computeVertexNormals();

    const floorMat = new THREE.MeshStandardMaterial({
      map: tex.sand,
      color: '#e3d9c3',
      roughness: 0.88,
      metalness: 0.0
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    scene.add(floor);

    // Animated sunlit caustics layer shimmering softly across the sandy bottom
    const causticsGeo = new THREE.PlaneGeometry(12, 10);
    causticsGeo.rotateX(-Math.PI * 0.5);
    const causticsMat = new THREE.MeshBasicMaterial({
      map: tex.caustics,
      color: '#d8f6f3',
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const causticsMesh = new THREE.Mesh(causticsGeo, causticsMat);
    causticsMesh.position.y = -1.23;
    scene.add(causticsMesh);

    // Underwater subtle pool walls (pale bright blue-green aquarium concrete/tile sides)
    const poolWallMat = new THREE.MeshStandardMaterial({
      color: '#95c6c7',
      roughness: 0.78
    });
    const backPoolWall = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.4), poolWallMat);
    backPoolWall.position.set(0, -0.4, -3.55);
    backPoolWall.receiveShadow = true;
    scene.add(backPoolWall);

    // Bright sunlit aquarium atrium upper backdrop wall (warm pale stone above waterline)
    const atriumMat = new THREE.MeshStandardMaterial({
      color: '#dce5e4',
      roughness: 0.85
    });
    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(16, 4.0, 0.35), atriumMat);
    upperWall.position.set(0, 2.2, -3.75);
    scene.add(upperWall);

    const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 9), poolWallMat);
    sideWallL.position.set(-4.8, -0.2, -0.5);
    scene.add(sideWallL);

    const sideWallR = sideWallL.clone();
    sideWallR.position.x = 4.8;
    scene.add(sideWallR);

    // 3. Front Aquarium Pool Rim (coping ledge where the bucket rests!)
    const rimMat = new THREE.MeshStandardMaterial({
      map: tex.rim,
      color: '#e8e2d6',
      roughness: 0.68,
      metalness: 0.02
    });
    const frontRim = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.24, 1.35), rimMat);
    frontRim.position.set(0, 0.06, 2.40);
    frontRim.receiveShadow = true;
    frontRim.castShadow = true;
    scene.add(frontRim);

    // Smooth rounded inner lip of the pool coping
    const rimLip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 10.5, 16), rimMat);
    rimLip.rotation.z = Math.PI * 0.5;
    rimLip.position.set(0, 0.115, 1.73);
    rimLip.receiveShadow = true;
    scene.add(rimLip);

    // Front underwater pool wall trim below rim
    const frontUnderWall = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 1.45, 0.22),
      new THREE.MeshStandardMaterial({ color: '#8abfc1', roughness: 0.72 })
    );
    frontUnderWall.position.set(0, -0.72, 1.82);
    scene.add(frontUnderWall);

    // 4. Naturalistic Aquarium Rock Outcrop (smooth water-worn boulders, warm coastal stone!)
    const rockMat = new THREE.MeshStandardMaterial({
      map: tex.rock,
      color: '#a8a296',
      roughness: 0.74,
      metalness: 0.02
    });
    const wetRockMat = new THREE.MeshPhysicalMaterial({
      map: tex.rock,
      color: '#7e867f',
      roughness: 0.44,
      clearcoat: 0.30,
      clearcoatRoughness: 0.34
    });

    const rockGroup = new THREE.Group();
    scene.add(rockGroup);

    function makeSculptedRock(rx, ry, rz, mat, seed = 1) {
      const geo = new THREE.SphereGeometry(1, 28, 22);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const n = 1
          + 0.08 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.8 - seed)
          + 0.045 * Math.cos((vx + vy) * 5.2 + vz * 3.6);
        // Smooth water-worn flat top plateau for lounging
        const topFlat = vy > 0.28 ? 0.28 + (vy - 0.28) * 0.38 : vy;
        p.setXYZ(i, vx * rx * n, topFlat * ry * n, vz * rz * n);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }

    // Main sunlit flat lounging rock shelf (where 2nd adult otter rests & cracks clams!)
    const loungeRock = makeSculptedRock(0.92, 0.80, 0.74, wetRockMat, 1.3);
    loungeRock.position.set(1.06, -0.48, -1.22);
    rockGroup.add(loungeRock);

    // Flat top plateau cap right at y = +0.12 for clean otter lounging
    const loungeTop = makeSculptedRock(0.74, 0.24, 0.60, rockMat, 2.7);
    loungeTop.position.set(1.02, 0.02, -1.18);
    rockGroup.add(loungeTop);

    // Taller backdrop cliff rock behind it creating the "岩陰" (rock shadow cove)
    const backCliff = makeSculptedRock(1.25, 1.30, 0.92, rockMat, 4.1);
    backCliff.position.set(1.95, 0.16, -2.28);
    rockGroup.add(backCliff);

    // Secondary background rocks along the back-left for natural aquarium habitat framing
    const leftBackRock = makeSculptedRock(1.15, 0.98, 0.85, rockMat, 5.5);
    leftBackRock.position.set(-2.20, -0.16, -2.10);
    rockGroup.add(leftBackRock);

    const midSubmergedRock = makeSculptedRock(0.46, 0.28, 0.40, wetRockMat, 6.8);
    midSubmergedRock.position.set(-0.92, -1.16, -1.45);
    rockGroup.add(midSubmergedRock);

    const rightSubmergedRock = makeSculptedRock(0.42, 0.24, 0.36, wetRockMat, 8.2);
    rightSubmergedRock.position.set(0.32, -1.18, -1.36);
    rockGroup.add(rightSubmergedRock);

    // 5. Clear Bright Aquamarine Water Surface (Custom Shader with interactive ripples & sparkles!)
    const MAX_RIPPLES = 8;
    const rippleData = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      rippleData.push(new THREE.Vector4(0, 0, -99, 0)); // x, z, startTime, strength
    }

    const waterGeo = new THREE.PlaneGeometry(11.5, 6.2, 96, 64);
    waterGeo.rotateX(-Math.PI * 0.5);

    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uRipples: { value: rippleData },
        uShallowColor: { value: new THREE.Color('#64bfc4') },
        uDeepColor: { value: new THREE.Color('#479ea8') },
        uSkyReflect: { value: new THREE.Color('#d4f2f4') },
        uSunDir: { value: new THREE.Vector3(0.35, 0.86, 0.36).normalize() },
        uUnderwater: { value: 0.0 },
        uWarmth: { value: 0.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec4 uRipples[${MAX_RIPPLES}];
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vWaveH;

        float waveHeight(vec2 p, float t) {
          float h = 0.0;
          h += sin(p.x * 2.1 + t * 1.15) * 0.011;
          h += cos(p.y * 2.4 - t * 0.95) * 0.009;
          h += sin((p.x * 1.4 - p.y * 1.8) + t * 1.55) * 0.006;

          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 rp = uRipples[i];
            float age = t - rp.z;
            if (age > 0.0 && age < 3.6 && rp.w > 0.001) {
              float d = length(p - rp.xy);
              float radius = age * 1.15;
              float band = exp(-pow((d - radius) * 5.2, 2.0));
              float decay = exp(-age * 1.05);
              h += sin((d - radius) * 20.0) * band * decay * rp.w * 0.036;
            }
          }
          return h;
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float h = waveHeight(wp.xz, uTime);
          wp.y += h;

          float eps = 0.04;
          float hx = waveHeight(wp.xz + vec2(eps, 0.0), uTime);
          float hz = waveHeight(wp.xz + vec2(0.0, eps), uTime);
          vec3 n = normalize(vec3(h - hx, eps, h - hz));

          vWorldPos = wp.xyz;
          vNormal = n;
          vWaveH = h;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uSkyReflect;
        uniform vec3 uSunDir;
        uniform float uUnderwater;
        uniform float uWarmth;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vWaveH;

        void main() {
          vec3 N = normalize(vNormal);
          if (!gl_FrontFacing) N = -N;

          vec3 V = normalize(cameraPosition - vWorldPos);
          float ndotv = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = pow(1.0 - ndotv, 2.6);

          // Soft bright aquamarine daylight water (never muddy, never neon)
          float depthGrad = smoothstep(1.8, -2.5, vWorldPos.z);
          vec3 waterCol = mix(uShallowColor, uDeepColor, depthGrad * 0.55);
          waterCol = mix(waterCol, uSkyReflect, fresnel * 0.52);

          // Gentle sunlit wave-crest sparkle glints
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 96.0);
          float microGlint = pow(max(dot(N, H), 0.0), 26.0) * 0.22;
          vec3 sunTint = mix(vec3(1.0, 0.99, 0.94), vec3(1.0, 0.93, 0.80), uWarmth);

          vec3 col = waterCol + sunTint * (spec * 0.85 + microGlint);

          // Ripple crest foam whisper
          float foam = smoothstep(0.017, 0.032, abs(vWaveH)) * 0.35;
          col = mix(col, vec3(0.95, 0.99, 0.99), foam);

          // When viewed from underwater, make the underside luminous Snell's window
          if (uUnderwater > 0.05) {
            vec3 underCol = mix(vec3(0.62, 0.88, 0.90), vec3(0.92, 0.98, 0.97), ndotv * 0.7 + spec * 0.5);
            col = mix(col, underCol, uUnderwater * 0.85);
          }

          // Clear transparency so sandy floor, flat stone, & underwater otter remain crisp!
          float alpha = mix(0.24, 0.56, fresnel) + foam * 0.25 + spec * 0.35;
          alpha = mix(alpha, 0.42, uUnderwater);

          gl_FragColor = vec4(col, clamp(alpha, 0.20, 0.72));
        }
      `
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, 0, -0.75);
    waterMesh.renderOrder = 2;
    scene.add(waterMesh);

    // 6. Volumetric Underwater Sunbeams ("光の筋")
    const sunbeamGroup = new THREE.Group();
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.14 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float edge = sin(vUv.x * 3.14159);
          float fade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
          float shimmer = 0.78 + 0.22 * sin(uTime * 1.3 + vUv.x * 8.0);
          float a = edge * edge * fade * shimmer * uOpacity;
          gl_FragColor = vec4(0.84, 0.98, 0.96, a);
        }
      `
    });

    const beamSpecs = [
      { x: -0.9, z: -0.4, w: 0.65, h: 1.55, rotZ: -0.22 },
      { x: -0.2, z: 0.1, w: 0.85, h: 1.60, rotZ: -0.18 },
      { x: 0.45, z: -0.35, w: 0.70, h: 1.55, rotZ: -0.20 },
      { x: 0.95, z: 0.35, w: 0.60, h: 1.50, rotZ: -0.24 },
      { x: -0.55, z: 0.65, w: 0.55, h: 1.48, rotZ: -0.19 }
    ];
    beamSpecs.forEach((b, idx) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), beamMat);
      mesh.position.set(b.x, -0.64, b.z);
      mesh.rotation.z = b.rotZ;
      mesh.rotation.y = (idx - 2) * 0.16;
      sunbeamGroup.add(mesh);
    });
    scene.add(sunbeamGroup);

    // Helper to trigger an expanding surface water ripple
    let rippleIdx = 0;
    function addRipple(x, z, time, strength = 0.7) {
      rippleData[rippleIdx].set(x, z, time, Math.min(1.4, strength));
      rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
    }

    function update(t, underwaterAmount, warmthAmount) {
      waterMat.uniforms.uTime.value = t;
      waterMat.uniforms.uUnderwater.value = underwaterAmount;
      waterMat.uniforms.uWarmth.value = warmthAmount;
      skyMat.uniforms.uWarmth.value = warmthAmount;

      // Scroll caustics gently on sandy bottom
      tex.caustics.offset.set(
        Math.sin(t * 0.18) * 0.25 + t * 0.022,
        Math.cos(t * 0.14) * 0.25 + t * 0.015
      );
      causticsMat.opacity = 0.24 + underwaterAmount * 0.18;

      // Brighten sunbeams gracefully when viewing underwater
      beamMat.uniforms.uTime.value = t;
      beamMat.uniforms.uOpacity.value = 0.07 + underwaterAmount * 0.26;
    }

    return {
      waterMesh,
      floor,
      frontRim,
      loungeTop,
      addRipple,
      update
    };
  }

  global.OtterModels = {
    getTextures,
    createOtterRig,
    createClamMesh,
    createScallopMesh,
    createShellHalfMesh,
    createMeatMesh,
    createFlatStoneMesh,
    createBucketMesh,
    createKelpBed,
    createAquariumEnvironment
  };
})(window);
