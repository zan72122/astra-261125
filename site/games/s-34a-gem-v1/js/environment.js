(function () {
  'use strict';

  function seededRand(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function createMorningEnvMap(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();

    // Soft sunlit morning dome
    const domeGeo = new THREE.SphereGeometry(20, 24, 16);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float y = vPos.y;
          vec3 ground = vec3(0.72, 0.56, 0.36);
          vec3 horizon = vec3(0.99, 0.92, 0.78);
          vec3 sky = vec3(0.76, 0.89, 0.99);
          vec3 col = y < 0.0
            ? mix(horizon, ground, clamp(-y * 2.2, 0.0, 1.0))
            : mix(horizon, sky, clamp(y * 1.4, 0.0, 1.0));
          // Morning sun glow on entrance side
          float sun = pow(max(dot(vPos, normalize(vec3(0.78, 0.45, 0.35))), 0.0), 18.0);
          col += vec3(1.0, 0.95, 0.82) * sun * 1.6;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    envScene.add(new THREE.Mesh(domeGeo, domeMat));
    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    domeGeo.dispose();
    domeMat.dispose();
    return rt.texture;
  }

  function buildEnvironment(scene, renderer) {
    const T = window.PiyoTextures;
    const rand = seededRand(1337);

    // Warm spring morning sky background (visible through window & open wooden door)
    scene.background = new THREE.Color(0xdceaf2);
    scene.fog = new THREE.FogExp2(0xeadfc8, 0.022);
    scene.environment = createMorningEnvMap(renderer);

    // --- LIGHTING (Warm morning sun from entrance side + soft window fill, no harsh black shadows) ---
    const hemi = new THREE.HemisphereLight(0xfff7e6, 0xc9a36f, 1.18);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff1d0, 2.3);
    sunLight.position.set(8.5, 6.8, 3.6);
    sunLight.target.position.set(-0.2, 0.4, 0.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 2.0;
    sunLight.shadow.camera.far = 22.0;
    sunLight.shadow.camera.left = -6.5;
    sunLight.shadow.camera.right = 7.5;
    sunLight.shadow.camera.top = 6.0;
    sunLight.shadow.camera.bottom = -5.5;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.018;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Window fill light from left-back illuminating Mother Hen's brown feathers softly
    const windowLight = new THREE.DirectionalLight(0xffe9c6, 1.05);
    windowLight.position.set(-7.0, 4.4, -1.6);
    windowLight.target.position.set(0.0, 0.5, 0.2);
    scene.add(windowLight);
    scene.add(windowLight.target);

    // Warm floor bounce fill inside coop so underside of chicks & hen stays bright and tender
    const bounceLight = new THREE.PointLight(0xffe4b5, 0.75, 11, 1.5);
    bounceLight.position.set(0.4, 1.6, 2.6);
    scene.add(bounceLight);

    // --- TEXTURES & MATERIALS ---
    const floorTex = T.createWoodTexture({ base: [176, 134, 92], grain: [134, 94, 58], planks: 6, seed: 21, repeatX: 2, repeatY: 2 });
    const wallTex = T.createWoodTexture({ base: [194, 154, 108], grain: [152, 112, 72], planks: 5, seed: 33, repeatX: 2, repeatY: 1 });
    const boxWoodTex = T.createWoodTexture({ base: [204, 162, 110], grain: [158, 115, 68], planks: 3, seed: 55, repeatX: 1, repeatY: 1 });
    const doorWoodTex = T.createWoodTexture({ base: [192, 146, 94], grain: [142, 98, 56], planks: 4, seed: 84, repeatX: 1, repeatY: 1 });
    const strawBedTex = T.createStrawBedTexture();
    const grassTex = T.createGardenGrassTexture();
    const stoneTex = T.createStoneTexture();
    const ceramicTex = T.createCeramicTexture('#e6e2d5', 'rgba(128,118,104,0.22)');

    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.86, metalness: 0.0 });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.88, metalness: 0.0 });
    const boxMat = new THREE.MeshStandardMaterial({ map: boxWoodTex, roughness: 0.82, metalness: 0.0 });
    const doorMat = new THREE.MeshStandardMaterial({ map: doorWoodTex, roughness: 0.8, metalness: 0.0 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.88 });

    // --- COOP FLOOR & WALLS ---
    const coopGroup = new THREE.Group();
    scene.add(coopGroup);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.2, 8.6), floorMat);
    floor.position.set(-1.15, -0.1, 0.4);
    floor.receiveShadow = true;
    coopGroup.add(floor);

    // Back wall (Z = -3.6)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.0, 5.2, 0.22), wallMat);
    backWall.position.set(-1.15, 2.5, -3.65);
    backWall.receiveShadow = true;
    coopGroup.add(backWall);

    // Left wall (X = -4.2) with bright sunlit window cutout
    const leftLower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 8.6), wallMat);
    leftLower.position.set(-4.2, 0.675, 0.4);
    leftLower.receiveShadow = true;
    coopGroup.add(leftLower);

    const leftUpper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 8.6), wallMat);
    leftUpper.position.set(-4.2, 4.3, 0.4);
    coopGroup.add(leftUpper);

    const leftBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 2.0), wallMat);
    leftBack.position.set(-4.2, 2.45, -2.85);
    coopGroup.add(leftBack);

    const leftFront = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 4.1), wallMat);
    leftFront.position.set(-4.2, 2.45, 2.65);
    coopGroup.add(leftFront);

    // Window frame & mullions (X = -4.15, Y = 1.35..3.5, Z = -1.85..+0.6)
    const winFrame = new THREE.Group();
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 2.55), beamMat);
    sill.position.set(-4.12, 1.38, -0.62);
    winFrame.add(sill);
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.15, 0.08), beamMat);
    mullionV.position.set(-4.15, 2.45, -0.62);
    winFrame.add(mullionV);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 2.45), beamMat);
    mullionH.position.set(-4.15, 2.42, -0.62);
    winFrame.add(mullionH);
    coopGroup.add(winFrame);

    // Soft bright sunlight glow outside left window
    const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff8e2 });
    const winBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0), winGlowMat);
    winBackdrop.rotation.y = Math.PI / 2;
    winBackdrop.position.set(-5.0, 2.5, -0.62);
    coopGroup.add(winBackdrop);

    // Gentle sunlit foliage silhouette outside window
    const leafSilMat = new THREE.MeshStandardMaterial({ color: 0x8bb665, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.45 + rand() * 0.35, 10, 8), leafSilMat);
      bush.position.set(-4.75, 1.55 + rand() * 1.4, -1.6 + i * 0.42);
      coopGroup.add(bush);
    }

    // Soft morning light shafts streaming into the coop
    const rayGeo = new THREE.PlaneGeometry(3.2, 4.4);
    const rayCanvas = document.createElement('canvas');
    rayCanvas.width = 128;
    rayCanvas.height = 128;
    const rctx = rayCanvas.getContext('2d');
    const rg = rctx.createLinearGradient(0, 0, 0, 128);
    rg.addColorStop(0, 'rgba(255,244,205,0.22)');
    rg.addColorStop(0.6, 'rgba(255,240,195,0.08)');
    rg.addColorStop(1, 'rgba(255,240,195,0.0)');
    rctx.fillStyle = rg;
    rctx.fillRect(0, 0, 128, 128);
    const rayTex = new THREE.CanvasTexture(rayCanvas);
    const rayMat = new THREE.MeshBasicMaterial({
      map: rayTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const ray1 = new THREE.Mesh(rayGeo, rayMat);
    ray1.position.set(-2.2, 1.9, -0.4);
    ray1.rotation.set(0.12, 0.25, -0.58);
    coopGroup.add(ray1);

    // --- RIGHT ENTRANCE WALL (X = +3.18) WITH LOW SLIDING WOODEN DOOR ---
    const rightX = 3.18;
    // Back section of right wall (Z: -3.65 .. -0.55)
    const rBack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.8, 3.1), wallMat);
    rBack.position.set(rightX, 2.4, -2.1);
    rBack.castShadow = true;
    rBack.receiveShadow = true;
    coopGroup.add(rBack);

    // Front corner post on right wall (Z: +1.75 .. +2.15)
    const rFrontPost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.8, 0.42), beamMat);
    rFrontPost.position.set(rightX, 2.4, 1.96);
    rFrontPost.castShadow = true;
    rFrontPost.receiveShadow = true;
    coopGroup.add(rFrontPost);

    // Top lintel above low wooden door (Y > 1.88, spanning doorway Z: -0.55 .. +1.75)
    const rLintel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 2.55), beamMat);
    rLintel.position.set(rightX, 1.98, 0.6);
    rLintel.castShadow = true;
    coopGroup.add(rLintel);

    // Wooden sliding rails (bottom & top) for the low door
    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 4.2), beamMat);
    bottomRail.position.set(rightX - 0.12, 0.035, -0.25);
    bottomRail.receiveShadow = true;
    coopGroup.add(bottomRail);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 4.2), beamMat);
    topRail.position.set(rightX - 0.12, 1.88, -0.25);
    coopGroup.add(topRail);

    // Low Sliding Wooden Door (木戸)
    // Closed: door center Z = 0.60 (covers Z: -0.52 .. +1.72)
    // Open:   door center Z = -1.32 (opens Z: -0.20 .. +1.72)
    const doorGroup = new THREE.Group();
    const doorClosedZ = 0.60;
    const doorOpenZ = -1.28;
    doorGroup.position.set(rightX - 0.12, 0.07, doorClosedZ);

    // Door frame + vertical wooden slats with tiny sunlit gaps
    const doorWidth = 2.26;
    const doorHeight = 1.76;
    const slatCount = 8;
    const slatW = doorWidth / slatCount;
    const doorMeshes = [];

    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorHeight, slatW - 0.02), doorMat);
      slat.position.set(0, doorHeight * 0.5, -doorWidth * 0.5 + (i + 0.5) * slatW);
      slat.castShadow = true;
      slat.receiveShadow = true;
      doorGroup.add(slat);
      doorMeshes.push(slat);
    }
    // Cross battens on inside face
    for (const by of [0.32, 1.42]) {
      const batten = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, doorWidth - 0.06), beamMat);
      batten.position.set(-0.055, by, 0);
      batten.castShadow = true;
      doorGroup.add(batten);
      doorMeshes.push(batten);
    }
    // Diagonal brace
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 1.95), beamMat);
    brace.position.set(-0.055, 0.87, 0);
    brace.rotation.x = 0.56;
    doorGroup.add(brace);

    // Inviting tactile round wooden pull knob on the front-facing inside edge of the door
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd9a86c, roughness: 0.62 });
    const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 12), handleMat);
    handleStem.rotation.z = Math.PI / 2;
    handleStem.position.set(-0.12, 0.92, 0.82);
    doorGroup.add(handleStem);

    const handleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), handleMat);
    handleKnob.scale.set(0.75, 1.0, 1.0);
    handleKnob.position.set(-0.19, 0.92, 0.82);
    handleKnob.castShadow = true;
    doorGroup.add(handleKnob);
    doorMeshes.push(handleKnob);

    // Invisible generous hit box for easy 5-year-old finger dragging
    const doorHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.85, 2.35),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    doorHit.position.set(-0.12, 0.92, 0);
    doorHit.userData.interactive = 'door';
    doorGroup.add(doorHit);

    coopGroup.add(doorGroup);

    const door = {
      group: doorGroup,
      hitMesh: doorHit,
      meshes: doorMeshes,
      knob: handleKnob,
      openAmount: 0,
      targetOpen: 0,
      closedZ: doorClosedZ,
      openZ: doorOpenZ,
      setOpen(val) {
        this.openAmount = Math.max(0, Math.min(1, val));
        this.targetOpen = this.openAmount;
        this.group.position.z = this.closedZ + (this.openZ - this.closedZ) * this.openAmount;
      },
      setHighlight(strength) {
        const em = strength * 0.28;
        handleMat.emissive.setRGB(em * 1.0, em * 0.78, em * 0.35);
        handleKnob.scale.set(0.75 + strength * 0.1, 1 + strength * 0.12, 1 + strength * 0.12);
      }
    };

    // --- SHALLOW WOODEN BOX WITH GOLDEN STRAW ---
    const boxBounds = {
      minX: -2.05,
      maxX: 1.95,
      minZ: -1.45,
      maxZ: 1.65,
      floorY: 0.11
    };
    const boxGroup = new THREE.Group();
    scene.add(boxGroup);

    // Wooden bottom board + straw bed surface
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(4.24, 0.11, 3.34), boxMat);
    boxBase.position.set(-0.05, 0.055, 0.1);
    boxBase.receiveShadow = true;
    boxGroup.add(boxBase);

    const strawBedMat = new THREE.MeshStandardMaterial({
      map: strawBedTex,
      roughness: 0.94,
      metalness: 0.0
    });
    const strawBed = new THREE.Mesh(new THREE.PlaneGeometry(4.02, 3.12), strawBedMat);
    strawBed.rotation.x = -Math.PI / 2;
    strawBed.position.set(-0.05, 0.114, 0.1);
    strawBed.receiveShadow = true;
    strawBed.userData.interactive = 'straw_box';
    boxGroup.add(strawBed);

    // Box side planks:
    // Back plank (full height 0.42)
    const plankBack = new THREE.Mesh(new THREE.BoxGeometry(4.26, 0.42, 0.13), boxMat);
    plankBack.position.set(-0.05, 0.21, -1.52);
    plankBack.castShadow = true;
    plankBack.receiveShadow = true;
    boxGroup.add(plankBack);

    // Left plank (full height 0.42)
    const plankLeft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 3.32), boxMat);
    plankLeft.position.set(-2.12, 0.21, 0.1);
    plankLeft.castShadow = true;
    plankLeft.receiveShadow = true;
    boxGroup.add(plankLeft);

    // Front plank split with a low smooth notch at X: -1.15 .. +0.15 so water dish slides cleanly inward
    const plankFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.36, 0.13), boxMat);
    plankFrontL.position.set(-1.68, 0.18, 1.72);
    plankFrontL.castShadow = true;
    plankFrontL.receiveShadow = true;
    boxGroup.add(plankFrontL);

    const plankFrontMidLow = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.13, 0.14), boxMat);
    plankFrontMidLow.position.set(-0.52, 0.065, 1.72);
    plankFrontMidLow.receiveShadow = true;
    boxGroup.add(plankFrontMidLow);

    const plankFrontR = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.36, 0.13), boxMat);
    plankFrontR.position.set(1.11, 0.18, 1.72);
    plankFrontR.castShadow = true;
    plankFrontR.receiveShadow = true;
    boxGroup.add(plankFrontR);

    // Right plank split with a low doorway step at Z: -0.25 .. +1.05 facing the sliding door
    const plankRightBack = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 1.32), boxMat);
    plankRightBack.position.set(2.02, 0.2, -0.92);
    plankRightBack.castShadow = true;
    plankRightBack.receiveShadow = true;
    boxGroup.add(plankRightBack);

    const plankRightStep = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.38), boxMat);
    plankRightStep.position.set(2.02, 0.07, 0.42);
    plankRightStep.receiveShadow = true;
    boxGroup.add(plankRightStep);

    const plankRightFront = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.68), boxMat);
    plankRightFront.position.set(2.02, 0.18, 1.44);
    plankRightFront.castShadow = true;
    plankRightFront.receiveShadow = true;
    boxGroup.add(plankRightFront);

    // --- 3D INTERACTIVE GOLDEN STRAW STALKS (InstancedMesh) ---
    const STRAW_COUNT = 680;
    // Gently arched 3D stalk segment
    const stalkGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.46, 5, 3);
    const posAttr = stalkGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const t = y / 0.23; // -1..1
      posAttr.setX(i, posAttr.getX(i) + (1 - t * t) * 0.032);
    }
    stalkGeo.rotateZ(Math.PI / 2);
    stalkGeo.computeVertexNormals();

    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.0
    });
    const strawMesh = new THREE.InstancedMesh(stalkGeo, stalkMat, STRAW_COUNT);
    strawMesh.receiveShadow = true;
    strawMesh.castShadow = true;
    scene.add(strawMesh);

    const strawData = [];
    const dummy = new THREE.Object3D();
    const strawPalette = [0xe8c977, 0xdcb55c, 0xf2db98, 0xcfa449, 0xe4be6a, 0xedd38b];
    const tmpColor = new THREE.Color();

    for (let i = 0; i < STRAW_COUNT; i++) {
      // Cluster slightly fuller around edges & center, keeping dish area slightly clearer
      let x = boxBounds.minX + 0.12 + rand() * (boxBounds.maxX - boxBounds.minX - 0.24);
      let z = boxBounds.minZ + 0.12 + rand() * (boxBounds.maxZ - boxBounds.minZ - 0.24);
      // Avoid crowding right on top of the terracotta dish center (0.88, 0.98)
      const dd = Math.hypot(x - 0.88, z - 0.98);
      if (dd < 0.48) {
        const ang = rand() * Math.PI * 2;
        x = 0.88 + Math.cos(ang) * (0.52 + rand() * 0.35);
        z = 0.98 + Math.sin(ang) * (0.52 + rand() * 0.35);
        x = Math.max(boxBounds.minX + 0.1, Math.min(boxBounds.maxX - 0.1, x));
        z = Math.max(boxBounds.minZ + 0.1, Math.min(boxBounds.maxZ - 0.1, z));
      }
      const baseY = boxBounds.floorY + 0.015 + rand() * 0.06;
      const rotY = rand() * Math.PI * 2;
      const tiltX = (rand() - 0.5) * 0.26;
      const tiltZ = (rand() - 0.5) * 0.26;
      const scaleL = 0.65 + rand() * 0.85;
      const scaleW = 0.75 + rand() * 0.55;

      strawData.push({
        bx: x, by: baseY, bz: z,
        ox: 0, oy: 0, oz: 0,
        vx: 0, vy: 0, vz: 0,
        rotY, tiltX, tiltZ, scaleL, scaleW,
        disturbed: false
      });

      dummy.position.set(x, baseY, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(scaleL, scaleW, scaleW);
      dummy.updateMatrix();
      strawMesh.setMatrixAt(i, dummy.matrix);

      tmpColor.setHex(strawPalette[(rand() * strawPalette.length) | 0]);
      strawMesh.setColorAt(i, tmpColor);
    }
    strawMesh.instanceMatrix.needsUpdate = true;
    strawMesh.instanceColor.needsUpdate = true;

    const strawSystem = {
      mesh: strawMesh,
      scratchAt(wx, wz, radius) {
        const r = radius || 0.45;
        for (let i = 0; i < STRAW_COUNT; i++) {
          const s = strawData[i];
          const dx = s.bx + s.ox - wx;
          const dz = s.bz + s.oz - wz;
          const d = Math.hypot(dx, dz);
          if (d < r) {
            const push = (1 - d / r) * 0.16;
            const nx = d > 0.001 ? dx / d : Math.cos(i);
            const nz = d > 0.001 ? dz / d : Math.sin(i);
            s.vx += nx * push * 4.2;
            s.vz += nz * push * 4.2;
            s.vy += push * 2.2;
            s.disturbed = true;
          }
        }
      },
      update(dt) {
        let anyChanged = false;
        for (let i = 0; i < STRAW_COUNT; i++) {
          const s = strawData[i];
          if (!s.disturbed) continue;
          anyChanged = true;
          s.ox += s.vx * dt;
          s.oy += s.vy * dt;
          s.oz += s.vz * dt;
          s.vx *= Math.pow(0.06, dt);
          s.vz *= Math.pow(0.06, dt);
          s.vy -= 4.8 * dt;
          if (s.oy < 0) {
            s.oy = 0;
            s.vy = 0;
          }
          // Gentle slow settle back partway so scratched spots look parted
          s.ox *= Math.pow(0.85, dt);
          s.oz *= Math.pow(0.85, dt);

          dummy.position.set(s.bx + s.ox, s.by + s.oy, s.bz + s.oz);
          dummy.rotation.set(s.tiltX + s.oy * 1.4, s.rotY + s.ox * 1.2, s.tiltZ);
          dummy.scale.set(s.scaleL, s.scaleW, s.scaleW);
          dummy.updateMatrix();
          strawMesh.setMatrixAt(i, dummy.matrix);

          if (Math.abs(s.vx) < 0.004 && Math.abs(s.vz) < 0.004 && s.oy === 0 && Math.abs(s.ox) < 0.006 && Math.abs(s.oz) < 0.006) {
            s.disturbed = false;
          }
        }
        if (anyChanged) strawMesh.instanceMatrix.needsUpdate = true;
      }
    };

    // --- OUTDOOR SHORT MORNING-DEW GRASS & GARDEN ---
    const gardenGroup = new THREE.Group();
    scene.add(gardenGroup);

    const grassGround = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 13.0),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.92 })
    );
    grassGround.rotation.x = -Math.PI / 2;
    grassGround.position.set(8.8, -0.01, 0.3);
    grassGround.receiveShadow = true;
    grassGround.userData.interactive = 'outdoor_grass';
    gardenGroup.add(grassGround);

    // 3D short dewy grass blades outside the wooden door
    const GRASS_COUNT = 820;
    const bladeGeo = new THREE.ConeGeometry(0.022, 0.24, 3);
    bladeGeo.translate(0, 0.12, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
    const grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, GRASS_COUNT);
    grassMesh.receiveShadow = true;
    gardenGroup.add(grassMesh);

    const grassInfo = [];
    const grassColors = [0x6ea043, 0x7eb24e, 0x5c8c38, 0x8bc158, 0x67983e];
    for (let i = 0; i < GRASS_COUNT; i++) {
      let gx = 3.35 + rand() * 5.6;
      let gz = -2.8 + rand() * 6.0;
      // Keep flat stone top clear of grass blades
      if (Math.hypot(gx - 4.45, gz - 0.55) < 0.68) {
        gx += 0.9;
      }
      const scY = 0.55 + rand() * 0.95;
      const rotY = rand() * Math.PI * 2;
      const lean = 0.08 + rand() * 0.22;
      const phase = rand() * Math.PI * 2;
      grassInfo.push({ gx, gz, scY, rotY, lean, phase });

      dummy.position.set(gx, -0.01, gz);
      dummy.rotation.set(lean, rotY, 0);
      dummy.scale.set(1, scY, 1);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);

      tmpColor.setHex(grassColors[(rand() * grassColors.length) | 0]);
      grassMesh.setColorAt(i, tmpColor);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    grassMesh.instanceColor.needsUpdate = true;

    // Sparkling morning dew droplets on grass tips
    const DEW_COUNT = 55;
    const dewGeo = new THREE.SphereGeometry(0.019, 8, 6);
    const dewMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef9ff,
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.8
    });
    const dewMesh = new THREE.InstancedMesh(dewGeo, dewMat, DEW_COUNT);
    for (let i = 0; i < DEW_COUNT; i++) {
      const g = grassInfo[(i * 11) % grassInfo.length];
      dummy.position.set(g.gx, 0.14 * g.scY, g.gz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.75 + rand() * 0.7);
      dummy.updateMatrix();
      dewMesh.setMatrixAt(i, dummy.matrix);
    }
    dewMesh.instanceMatrix.needsUpdate = true;
    gardenGroup.add(dewMesh);

    // Tiny spring clover blossoms in the grass
    const cloverMat = new THREE.MeshStandardMaterial({ color: 0xf9f6ec, roughness: 0.75 });
    for (let i = 0; i < 16; i++) {
      const cx = 3.6 + rand() * 4.4;
      const cz = -1.8 + rand() * 4.2;
      if (Math.hypot(cx - 4.45, cz - 0.55) < 0.85) continue;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), cloverMat);
      flower.position.set(cx, 0.14, cz);
      gardenGroup.add(flower);
    }

    // Soft sunlit wooden garden fence & warm spring hedge in the outdoor background
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xc9a980, roughness: 0.88 });
    for (let i = 0; i < 7; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), fenceMat);
      post.position.set(8.8, 0.72, -3.6 + i * 1.3);
      post.castShadow = true;
      gardenGroup.add(post);
    }
    for (const ry of [0.55, 1.18]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 8.2), fenceMat);
      rail.position.set(8.75, ry, 0.3);
      gardenGroup.add(rail);
    }
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x76a250, roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.85 + rand() * 0.5, 12, 10), bushMat);
      b.position.set(9.6 + rand() * 0.9, 0.75 + rand() * 0.5, -3.5 + i * 0.95);
      b.scale.set(1.0, 0.85, 1.15);
      gardenGroup.add(b);
    }

    // --- OUTDOOR FLAT GARDEN STONE & SMALL SAUCER ---
    const outdoorDishPos = new THREE.Vector3(4.48, 0.14, 0.55);

    const stoneGeo = new THREE.CylinderGeometry(0.68, 0.76, 0.15, 14);
    const sp = stoneGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const vx = sp.getX(i);
      const vz = sp.getZ(i);
      const ang = Math.atan2(vz, vx);
      const wobble = 1.0 + Math.sin(ang * 3 + 0.5) * 0.08 + Math.cos(ang * 5) * 0.04;
      sp.setX(i, vx * wobble);
      sp.setZ(i, vz * wobble * 0.88);
    }
    stoneGeo.computeVertexNormals();
    const stone = new THREE.Mesh(
      stoneGeo,
      new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, metalness: 0.0 })
    );
    stone.position.set(outdoorDishPos.x, 0.065, outdoorDishPos.z);
    stone.receiveShadow = true;
    stone.castShadow = true;
    gardenGroup.add(stone);

    // Outdoor small stoneware saucer on the flat stone
    const outProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.28, 0.0),
      new THREE.Vector2(0.38, 0.06),
      new THREE.Vector2(0.41, 0.11),
      new THREE.Vector2(0.37, 0.12),
      new THREE.Vector2(0.31, 0.045),
      new THREE.Vector2(0.0, 0.032)
    ];
    const outDishGeo = new THREE.LatheGeometry(outProfile, 28);
    const outDishMat = new THREE.MeshStandardMaterial({
      map: ceramicTex,
      color: 0xf0ece0,
      roughness: 0.42,
      metalness: 0.04
    });
    const outdoorDish = new THREE.Mesh(outDishGeo, outDishMat);
    outdoorDish.position.copy(outdoorDishPos);
    outdoorDish.castShadow = true;
    outdoorDish.receiveShadow = true;
    outdoorDish.userData.interactive = 'outdoor_dish';
    gardenGroup.add(outdoorDish);

    const outdoorZone = {
      minX: 3.45,
      maxX: 5.55,
      minZ: -1.15,
      maxZ: 1.75,
      dishPos: outdoorDishPos,
      dishMesh: outdoorDish,
      setHighlight(strength) {
        const em = strength * 0.22;
        outDishMat.emissive.setRGB(em, em * 0.85, em * 0.45);
      }
    };

    function update(dt, elapsed) {
      strawSystem.update(dt);

      // Gentle breeze sway on outdoor grass
      if (door.openAmount > 0.02 || Math.sin(elapsed) > -2) {
        for (let i = 0; i < GRASS_COUNT; i += 2) {
          const g = grassInfo[i];
          const sway = Math.sin(elapsed * 1.9 + g.phase) * 0.06;
          dummy.position.set(g.gx, -0.01, g.gz);
          dummy.rotation.set(g.lean + sway, g.rotY, sway * 0.5);
          dummy.scale.set(1, g.scY, 1);
          dummy.updateMatrix();
          grassMesh.setMatrixAt(i, dummy.matrix);
        }
        grassMesh.instanceMatrix.needsUpdate = true;
      }
    }

    return {
      boxBounds,
      strawSystem,
      door,
      outdoorDishPos,
      outdoorZone,
      sunLight,
      update
    };
  }

  window.PiyoEnv = { buildEnvironment };
})();
