(function () {
  'use strict';

  class PokapokaEnvironment {
    constructor(scene, textures) {
      this.scene = scene;
      this.textures = textures;
      this.time = 0;
      this.duskFactor = 0; // 0 = warm winter sunset orange, 1 = soft pale purple dusk
      this.warmth = 0.35;  // 0..1 (increases when pouring from bamboo trough)
      this.waterDepthBonus = 0; // subtle visual rise when pouring

      // Pool dimensions (compact so both 390x844 portrait and 1180x820 landscape frame everything!)
      this.poolCenter = new THREE.Vector2(0, 0.02);
      this.poolRx = 1.48;
      this.poolRz = 1.18;
      this.waterY = 0.0;

      // Key landmarks
      this.frontEdgeY = 0.14;
      this.platformCenter = new THREE.Vector3(0.96, 0.30, 0.20);
      this.platformSize = { rx: 0.42, rz: 0.42 }; // X: 0.54..1.38, Z: -0.22..0.62
      this.spoutSplashPos = new THREE.Vector3(-0.84, 0.0, -0.24);

      // Ripples ring buffer for water shader
      this.maxRipples = 14;
      this.ripples = [];
      for (let i = 0; i < this.maxRipples; i++) {
        this.ripples.push(new THREE.Vector4(99, 99, -100, 0)); // x, z, startTime, strength
      }
      this.rippleCursor = 0;

      // Trough interactive state
      this.troughTilt = 0;       // 0..1 current visual tilt
      this.troughTargetTilt = 0; // 0..1 desired tilt
      this.troughHoldTimer = 0;
      this.troughHighlight = 0;

      // Steam & droplets
      this.steamParticles = [];
      this.droplets = [];

      this._buildSkyAndLighting();
      this._buildTerrainAndFence();
      this._buildPoolAndStones();
      this._buildWater();
      this._buildBambooTrough();
      this._buildSteamSystem();
    }

    _buildSkyAndLighting() {
      // Soft atmospheric fog matching warm winter evening mist
      this.fogColorSunset = new THREE.Color(0xecc29d);
      this.fogColorDusk = new THREE.Color(0xcab6cf);
      this.scene.fog = new THREE.FogExp2(this.fogColorSunset.getHex(), 0.048);

      // Evening sunset sky dome shader
      const skyGeo = new THREE.SphereGeometry(38, 32, 20);
      this.skyUniforms = {
        uDusk: { value: 0.0 },
        uSunDir: { value: new THREE.Vector3(-0.72, 0.22, -0.65).normalize() }
      };
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.skyUniforms,
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform float uDusk;
          uniform vec3 uSunDir;
          varying vec3 vWorldPos;
          void main() {
            vec3 dir = normalize(vWorldPos);
            float h = clamp(dir.y, -0.05, 1.0);

            // Warm winter sunset palette (soft, never harsh or oversaturated)
            vec3 sunsetHorizon = vec3(0.95, 0.72, 0.52);
            vec3 sunsetMid     = vec3(0.90, 0.68, 0.56);
            vec3 sunsetZenith  = vec3(0.62, 0.64, 0.74);

            // Pale lavender-purple dusk finale palette
            vec3 duskHorizon   = vec3(0.84, 0.68, 0.74);
            vec3 duskMid       = vec3(0.67, 0.58, 0.74);
            vec3 duskZenith    = vec3(0.42, 0.41, 0.58);

            vec3 cHorizon = mix(sunsetHorizon, duskHorizon, uDusk);
            vec3 cMid     = mix(sunsetMid, duskMid, uDusk);
            vec3 cZenith  = mix(sunsetZenith, duskZenith, uDusk);

            vec3 col = mix(cHorizon, cMid, smoothstep(0.0, 0.28, h));
            col = mix(col, cZenith, smoothstep(0.24, 0.82, h));

            // Soft low evening sun glow from the side-back
            float sunDot = max(dot(dir, uSunDir), 0.0);
            float halo = pow(sunDot, 7.0) * (0.42 - 0.22 * uDusk);
            float core = pow(sunDot, 72.0) * (0.65 - 0.40 * uDusk);
            vec3 sunTint = mix(vec3(1.0, 0.86, 0.66), vec3(0.94, 0.76, 0.82), uDusk);
            col += sunTint * (halo + core);

            // Soft horizon mist blend
            col = mix(col, cHorizon * 1.02, smoothstep(0.14, -0.02, h) * 0.45);
            gl_FragColor = vec4(col, 1.0);
          }
        `
      });
      this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
      this.scene.add(this.skyMesh);

      // Hemisphere light: warm cream-orange sky + soft earthy bounce so shadows stay gentle
      this.hemiLight = new THREE.HemisphereLight(0xffe7cf, 0x9b8068, 1.15);
      this.scene.add(this.hemiLight);

      // Low side sunset directional light (highlights wet fur & casts warm soft shadows)
      this.sunLight = new THREE.DirectionalLight(0xffcb96, 1.65);
      this.sunLight.position.set(-6.5, 2.75, -3.4);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 1.0;
      this.sunLight.shadow.camera.far = 16.0;
      this.sunLight.shadow.camera.left = -3.8;
      this.sunLight.shadow.camera.right = 3.8;
      this.sunLight.shadow.camera.top = 3.2;
      this.sunLight.shadow.camera.bottom = -3.2;
      this.sunLight.shadow.bias = -0.0008;
      this.sunLight.shadow.normalBias = 0.025;
      this.scene.add(this.sunLight);

      // Soft warm front-right fill so capybaras' faces, noses, and eyes stay clearly legible
      this.fillLight = new THREE.DirectionalLight(0xffe4cc, 0.58);
      this.fillLight.position.set(3.2, 2.6, 4.4);
      this.scene.add(this.fillLight);

      // Subtle warm water-bounce glow from below the pool surface
      this.poolBounce = new THREE.PointLight(0xffcf9e, 0.45, 5.5, 1.6);
      this.poolBounce.position.set(0.0, 0.35, 0.25);
      this.scene.add(this.poolBounce);
    }

    _buildTerrainAndFence() {
      const grassTex = this.textures.createWinterGrassTexture();
      const groundMat = new THREE.MeshStandardMaterial({
        map: grassTex,
        roughness: 0.94,
        metalness: 0.0
      });

      // Winter dry-grass meadow extending behind and around the bath
      const groundGeo = new THREE.PlaneGeometry(28, 24, 24, 24);
      groundGeo.rotateX(-Math.PI / 2);
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // Depress gently inside the pool footprint, rise gently toward the rear meadow
        const nx = (x - this.poolCenter.x) / (this.poolRx + 0.35);
        const nz = (z - this.poolCenter.y) / (this.poolRz + 0.35);
        const r2 = nx * nx + nz * nz;
        let y = 0.05;
        if (r2 < 1.0) {
          y = -0.58 * (1.0 - r2 * 0.7);
        } else {
          const backSlope = Math.max(0, (-z - 1.5) * 0.065);
          const undulate = Math.sin(x * 0.45) * Math.cos(z * 0.38) * 0.08;
          y = 0.06 + backSlope + undulate;
        }
        pos.setY(i, y);
      }
      groundGeo.computeVertexNormals();
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.receiveShadow = true;
      this.scene.add(ground);

      // Small winter grass tufts around the back meadow (where 3rd capybara walks from)
      const tuftMat = new THREE.MeshStandardMaterial({
        color: 0xa48e62,
        roughness: 0.95
      });
      const tuftCoords = [
        [-2.4, -2.4], [-1.7, -2.9], [-0.4, -2.5], [0.9, -2.7], [1.9, -2.3],
        [-2.8, -3.8], [-0.9, -4.1], [0.6, -3.7], [2.4, -3.5], [1.6, -1.9],
        [-2.1, -1.4], [-2.5, 0.2], [2.2, -0.8], [2.4, 0.6]
      ];
      tuftCoords.forEach(([tx, tz], idx) => {
        const group = new THREE.Group();
        const baseY = 0.06 + Math.max(0, (-tz - 1.5) * 0.065);
        group.position.set(tx, baseY, tz);
        for (let b = 0; b < 5; b++) {
          const h = 0.16 + ((idx * 7 + b * 3) % 5) * 0.04;
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.032, h, 4), tuftMat);
          blade.position.set(Math.cos(b * 1.25) * 0.06, h * 0.42, Math.sin(b * 1.25) * 0.06);
          blade.rotation.z = (b - 2) * 0.18;
          blade.rotation.x = Math.sin(b + idx) * 0.14;
          group.add(blade);
        }
        this.scene.add(group);
      });

      // Zoo bamboo fence & weathered timber posts in the middle-background
      const bambooTex = this.textures.createBambooCulmTextures();
      const fenceMat = new THREE.MeshStandardMaterial({
        map: bambooTex.map,
        bumpMap: bambooTex.bumpMap,
        bumpScale: 0.015,
        color: 0xb9aa84,
        roughness: 0.78
      });
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x6f5a46,
        roughness: 0.92
      });
      const twineMat = new THREE.MeshStandardMaterial({
        color: 0x3b312a,
        roughness: 0.95
      });

      const fenceGroup = new THREE.Group();
      const fenceZ = -5.6;
      const postXs = [-5.4, -3.6, -1.8, 0.0, 1.8, 3.6, 5.4];
      postXs.forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.05, 8), postMat);
        post.position.set(px, 0.72, fenceZ);
        post.castShadow = true;
        post.receiveShadow = true;
        fenceGroup.add(post);
      });

      // Lower open-top zoo bamboo fence so the warm evening sunset sky spreads generously above!
      for (let x = -5.3; x <= 5.3; x += 0.18) {
        const h = 0.92 + Math.sin(x * 3.1) * 0.04;
        const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, h, 6), fenceMat);
        slat.position.set(x, 0.68, fenceZ + 0.05);
        fenceGroup.add(slat);
      }

      // Two horizontal bamboo rails with dark twine bindings
      [0.48, 0.92].forEach((ry) => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 11.2, 8), fenceMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, ry, fenceZ + 0.09);
        fenceGroup.add(rail);
        postXs.forEach((px) => {
          const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 5, 10), twineMat);
          tie.position.set(px, ry, fenceZ + 0.07);
          fenceGroup.add(tie);
        });
      });

      // Side angled bamboo wings framing the zoo enclosure
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 14; i++) {
          const tz = fenceZ + i * 0.42;
          const tx = side * (4.6 - i * 0.14);
          const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 1.4, 6), fenceMat);
          slat.position.set(tx, 0.72, tz);
          fenceGroup.add(slat);
        }
      });
      this.scene.add(fenceGroup);

      // Bare winter trees silhouetted softly behind the fence
      this._buildWinterTree(-3.8, -7.2, 1.15);
      this._buildWinterTree(3.5, -7.6, 1.0);
      this._buildWinterTree(0.9, -9.2, 0.85);
    }

    _buildWinterTree(x, z, scale) {
      const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3d, roughness: 0.94 });
      const group = new THREE.Group();
      group.position.set(x, 0.35, z);
      group.scale.setScalar(scale);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 2.8, 7), barkMat);
      trunk.position.y = 1.4;
      trunk.rotation.z = x < 0 ? -0.06 : 0.05;
      group.add(trunk);

      const branches = [
        { y: 2.1, len: 1.5, rz: 0.62, ry: 0.4 },
        { y: 2.3, len: 1.4, rz: -0.55, ry: -0.3 },
        { y: 2.6, len: 1.15, rz: 0.34, ry: 1.6 },
        { y: 2.7, len: 1.05, rz: -0.38, ry: -1.4 }
      ];
      branches.forEach((b) => {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, b.len, 6), barkMat);
        br.position.set(0, b.y, 0);
        br.rotation.y = b.ry;
        br.rotation.z = b.rz;
        br.translateY(b.len * 0.45);
        group.add(br);

        // Sub-twig
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.028, b.len * 0.62, 5), barkMat);
        twig.position.copy(br.position);
        twig.rotation.y = b.ry + 0.5;
        twig.rotation.z = b.rz * 1.45;
        twig.translateY(b.len * 0.55);
        group.add(twig);
      });

      this.scene.add(group);
    }

    _buildPoolAndStones() {
      const stoneTex = this.textures.createStoneTextures(212);
      this.stoneMat = new THREE.MeshStandardMaterial({
        map: stoneTex.map,
        bumpMap: stoneTex.bumpMap,
        bumpScale: 0.032,
        color: 0xb7aca0,
        roughness: 0.84,
        metalness: 0.02
      });
      this.wetStoneMat = new THREE.MeshStandardMaterial({
        map: stoneTex.map,
        bumpMap: stoneTex.bumpMap,
        bumpScale: 0.025,
        color: 0x8d8176,
        roughness: 0.46,
        metalness: 0.06
      });

      // Submerged warm stone pool bed
      const bedGeo = new THREE.CylinderGeometry(1.62, 1.32, 0.14, 32);
      bedGeo.scale(1.0, 1.0, 0.80);
      const bed = new THREE.Mesh(bedGeo, this.wetStoneMat);
      bed.position.set(0, -0.54, 0.02);
      bed.receiveShadow = true;
      this.scene.add(bed);

      // Front flat stone ledge (平たい石) — wide, flat, calm surface for the bamboo basket, apple slices, and cabbage
      const flatLedgeGroup = new THREE.Group();
      const frontSlabs = [
        { x: -0.78, z: 1.34, rx: 0.56, rz: 0.34, y: 0.14, rot: 0.16 },
        { x: -0.14, z: 1.42, rx: 0.58, rz: 0.36, y: 0.14, rot: 0.03 },
        { x: 0.50,  z: 1.40, rx: 0.58, rz: 0.38, y: 0.14, rot: -0.08 },
        { x: 1.06,  z: 1.18, rx: 0.44, rz: 0.36, y: 0.15, rot: -0.35 }
      ];
      frontSlabs.forEach((s) => {
        const geo = new THREE.CylinderGeometry(1, 1.08, 0.32, 16);
        geo.scale(s.rx, 1, s.rz);
        // Subtle organic edge wobble while keeping the top flat for resting food
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const vx = p.getX(i);
          const vy = p.getY(i);
          const vz = p.getZ(i);
          const ang = Math.atan2(vz, vx);
          const w = 1.0 + Math.sin(ang * 3 + s.x * 4) * 0.05 + Math.cos(ang * 5 - s.z * 3) * 0.03;
          p.setX(i, vx * w);
          p.setZ(i, vz * w);
          if (vy > 0.1) {
            p.setY(i, vy + Math.sin(vx * 4) * 0.004);
          }
        }
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, this.stoneMat);
        mesh.position.set(s.x, s.y - 0.16, s.z);
        mesh.rotation.y = s.rot;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        flatLedgeGroup.add(mesh);
      });
      this.scene.add(flatLedgeGroup);

      // Slightly raised flat stone platform on the right (縁から少しだけ上がった石の台)
      const platGeo = new THREE.CylinderGeometry(1, 1.12, 0.46, 18);
      platGeo.scale(0.47, 1, 0.46);
      const pp = platGeo.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const vx = pp.getX(i);
        const vz = pp.getZ(i);
        const ang = Math.atan2(vz, vx);
        const w = 1.0 + Math.sin(ang * 3 + 1.1) * 0.06;
        pp.setX(i, vx * w);
        pp.setZ(i, vz * w);
      }
      platGeo.computeVertexNormals();
      this.platformMesh = new THREE.Mesh(platGeo, this.stoneMat);
      this.platformMesh.position.set(this.platformCenter.x, this.platformCenter.y - 0.23, this.platformCenter.z);
      this.platformMesh.castShadow = true;
      this.platformMesh.receiveShadow = true;
      this.scene.add(this.platformMesh);

      // Gentle intermediate stepping stone between rim and raised platform for baby capybara
      const stepGeo = new THREE.CylinderGeometry(0.26, 0.30, 0.34, 12);
      const stepMesh = new THREE.Mesh(stepGeo, this.wetStoneMat);
      stepMesh.position.set(0.84, 0.22 - 0.17, 0.72);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      this.scene.add(stepMesh);

      // Natural river boulders wrapping the left, back, and right perimeter
      const boulderSpecs = [
        // Left rim
        { x: -1.36, z: 0.94, rx: 0.36, ry: 0.24, rz: 0.32, y: 0.10 },
        { x: -1.62, z: 0.44, rx: 0.40, ry: 0.28, rz: 0.38, y: 0.12 },
        { x: -1.66, z: -0.18, rx: 0.44, ry: 0.32, rz: 0.40, y: 0.14 },
        { x: -1.42, z: -0.78, rx: 0.42, ry: 0.30, rz: 0.36, y: 0.13 },
        // Rear rim (leaving a gentle lower stone ramp around x=-0.55 for the 3rd capybara)
        { x: -1.04, z: -1.16, rx: 0.38, ry: 0.22, rz: 0.32, y: 0.09 },
        { x: -0.52, z: -1.26, rx: 0.42, ry: 0.14, rz: 0.34, y: 0.04, wet: true }, // entry slope
        { x: 0.08,  z: -1.28, rx: 0.44, ry: 0.26, rz: 0.34, y: 0.11 },
        { x: 0.68,  z: -1.16, rx: 0.46, ry: 0.30, rz: 0.38, y: 0.14 },
        { x: 1.18,  z: -0.82, rx: 0.48, ry: 0.34, rz: 0.40, y: 0.17 },
        { x: 1.48,  z: -0.32, rx: 0.42, ry: 0.32, rz: 0.38, y: 0.18 },
        // Outer framing rocks behind the platform & spout
        { x: 1.56,  z: 0.66, rx: 0.36, ry: 0.24, rz: 0.34, y: 0.12 },
        { x: -1.85, z: -0.72, rx: 0.45, ry: 0.36, rz: 0.42, y: 0.18 }
      ];

      boulderSpecs.forEach((b, i) => {
        const g = new THREE.DodecahedronGeometry(1.0, 2);
        const pos = g.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const vx = pos.getX(k);
          const vy = pos.getY(k);
          const vz = pos.getZ(k);
          const n = 1.0 + 0.09 * Math.sin(vx * 3.2 + i) * Math.cos(vz * 2.9 - i);
          // Slightly flatten tops
          const flatY = vy > 0.45 ? 0.45 + (vy - 0.45) * 0.45 : vy;
          pos.setXYZ(k, vx * b.rx * n, flatY * b.ry * n, vz * b.rz * n);
        }
        g.computeVertexNormals();
        const rock = new THREE.Mesh(g, b.wet ? this.wetStoneMat : this.stoneMat);
        rock.position.set(b.x, b.y, b.z);
        rock.rotation.y = i * 0.7;
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
      });

      // Invisible generous raycast plane for placing food on the stone edge & platform
      this.placePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.placePlane.position.y = this.frontEdgeY;
      this.scene.add(this.placePlane);
    }

    _buildWater() {
      // Oval water surface mesh with interactive ripples & warm sky reflections (NEVER dark brown!)
      const geo = new THREE.PlaneGeometry(3.45, 2.85, 64, 52);
      geo.rotateX(-Math.PI / 2);

      this.waterUniforms = {
        uTime: { value: 0 },
        uDusk: { value: 0 },
        uWarmth: { value: this.warmth },
        uSunDir: { value: new THREE.Vector3(-0.72, 0.24, -0.65).normalize() },
        uRipples: { value: this.ripples }
      };

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: this.waterUniforms,
        vertexShader: `
          uniform float uTime;
          uniform vec4 uRipples[${this.maxRipples}];
          varying vec3 vWorldPos;
          varying float vWaveH;
          varying vec2 vGrad;

          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            float h = 0.0;
            vec2 grad = vec2(0.0);

            // Gentle thermal ambient shimmer
            float w1 = sin(wp.x * 3.1 + uTime * 1.15) * cos(wp.z * 2.7 - uTime * 0.9);
            float w2 = sin((wp.x * 2.2 - wp.z * 2.5) + uTime * 1.5);
            h += (w1 * 0.0045 + w2 * 0.003);
            grad.x += cos(wp.x * 3.1 + uTime * 1.15) * 3.1 * 0.0045;
            grad.y += -sin(wp.z * 2.7 - uTime * 0.9) * 2.7 * 0.0045;

            // Interactive circular ripples
            for (int i = 0; i < ${this.maxRipples}; i++) {
              vec4 rp = uRipples[i];
              float age = uTime - rp.z;
              if (age > 0.0 && age < 4.5 && rp.w > 0.001) {
                vec2 d = wp.xz - rp.xy;
                float dist = length(d) + 0.0001;
                float radius = age * 0.72;
                float env = exp(-pow((dist - radius) * 4.2, 2.0)) * exp(-age * 0.85) * rp.w;
                float phase = (dist - radius) * 24.0;
                h += sin(phase) * 0.016 * env;
                float dWave = cos(phase) * 24.0 * 0.016 * env;
                grad += (d / dist) * dWave;
              }
            }

            wp.y += h;
            vWorldPos = wp.xyz;
            vWaveH = h;
            vGrad = grad;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uDusk;
          uniform float uWarmth;
          uniform vec3 uSunDir;
          varying vec3 vWorldPos;
          varying float vWaveH;
          varying vec2 vGrad;

          void main() {
            // Soft oval mask so water stays strictly inside the stone basin
            vec2 rel = (vWorldPos.xz - vec2(0.0, 0.02)) / vec2(1.56, 1.24);
            float r2 = dot(rel, rel);
            if (r2 > 1.06) discard;
            float edgeSoft = smoothstep(1.06, 0.82, r2);

            vec3 N = normalize(vec3(-vGrad.x * 2.6, 1.0, -vGrad.y * 2.6));
            vec3 V = normalize(cameraPosition - vWorldPos);
            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);

            // Soft translucent mineral-warm bath water reflecting evening sky orange (NOT dark brown)
            vec3 waterDeepSunset = vec3(0.66, 0.56, 0.48);
            vec3 waterDeepDusk   = vec3(0.50, 0.45, 0.56);
            vec3 skyReflSunset   = vec3(0.98, 0.75, 0.54);
            vec3 skyReflDusk     = vec3(0.78, 0.64, 0.82);

            vec3 baseCol = mix(waterDeepSunset, waterDeepDusk, uDusk);
            vec3 skyRefl = mix(skyReflSunset, skyReflDusk, uDusk);

            // Blend sky reflection gently across the whole surface with warm subtle ripples
            float gentleRip = sin(vWorldPos.x * 7.5 + uTime * 1.4) * cos(vWorldPos.z * 6.5 - uTime * 1.1) * 0.04;
            vec3 col = mix(baseCol, skyRefl, clamp(0.54 + fresnel * 0.40 + gentleRip, 0.0, 1.0));

            // Soft golden sunset shimmer across ripples
            vec3 H = normalize(uSunDir + V);
            float spec = pow(max(dot(N, H), 0.0), 22.0) * (0.52 - 0.24 * uDusk);
            float rippleSparkle = smoothstep(0.004, 0.018, abs(vWaveH)) * 0.22;
            col += mix(vec3(1.0, 0.86, 0.66), vec3(0.92, 0.80, 0.94), uDusk) * (spec + rippleSparkle);

            // Gentle milky-warm mineral softness when hot water is added
            col = mix(col, vec3(0.94, 0.88, 0.82), uWarmth * 0.14);

            // Pale shoreline contact highlight
            float rimFoam = smoothstep(0.76, 0.96, r2) * 0.11;
            col += vec3(0.96, 0.90, 0.84) * rimFoam;

            float alpha = (0.85 + fresnel * 0.11) * edgeSoft;
            gl_FragColor = vec4(col, alpha);
          }
        `
      });

      this.waterMesh = new THREE.Mesh(geo, mat);
      this.waterMesh.position.y = this.waterY;
      this.waterMesh.renderOrder = 2;
      this.scene.add(this.waterMesh);
    }

    _buildBambooTrough() {
      const bTex = this.textures.createBambooCulmTextures();
      this.bambooMat = new THREE.MeshStandardMaterial({
        map: bTex.map,
        bumpMap: bTex.bumpMap,
        bumpScale: 0.02,
        color: 0xb6bb82,
        roughness: 0.58,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      });
      const innerBambooMat = new THREE.MeshStandardMaterial({
        color: 0xd9cfa2,
        roughness: 0.52,
        side: THREE.DoubleSide
      });
      const cordMat = new THREE.MeshStandardMaterial({ color: 0x3f332a, roughness: 0.95 });

      const root = new THREE.Group();
      root.position.set(-1.38, 0.0, -0.24);
      this.scene.add(root);

      // Crossed bamboo support legs (A-frame stand)
      [-0.14, 0.14].forEach((dz) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.88, 8), this.bambooMat);
        leg.position.set(0.0, 0.42, dz);
        leg.rotation.x = dz > 0 ? 0.30 : -0.30;
        leg.castShadow = true;
        leg.receiveShadow = true;
        root.add(leg);
      });
      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.018, 6, 12), cordMat);
      knot.position.set(0, 0.58, 0);
      knot.rotation.y = Math.PI / 2;
      root.add(knot);

      // Vertical water supply pipe behind the trough
      const supplyPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.92, 10), this.bambooMat);
      supplyPipe.position.set(-0.34, 0.46, 0);
      supplyPipe.castShadow = true;
      root.add(supplyPipe);

      // Pivoting split-bamboo trough (とい)
      this.troughPivot = new THREE.Group();
      this.troughPivot.position.set(0.0, 0.60, 0.0);
      root.add(this.troughPivot);

      // Half-cylinder split bamboo channel (concave U-trough cradling water cleanly from below)
      const troughLen = 0.92;
      const outerGeo = new THREE.CylinderGeometry(0.072, 0.066, troughLen, 16, 1, true, Math.PI * 0.12, Math.PI * 0.76);
      outerGeo.rotateZ(-Math.PI / 2);
      outerGeo.rotateX(Math.PI * 0.5);
      const outerMesh = new THREE.Mesh(outerGeo, this.bambooMat);
      outerMesh.position.set(0.10, 0.02, 0);
      outerMesh.castShadow = true;
      outerMesh.receiveShadow = true;
      this.troughPivot.add(outerMesh);

      const innerGeo = new THREE.CylinderGeometry(0.062, 0.056, troughLen - 0.01, 16, 1, true, Math.PI * 0.12, Math.PI * 0.76);
      innerGeo.rotateZ(-Math.PI / 2);
      innerGeo.rotateX(Math.PI * 0.5);
      const innerMesh = new THREE.Mesh(innerGeo, innerBambooMat);
      innerMesh.position.set(0.10, 0.022, 0);
      this.troughPivot.add(innerMesh);

      // Closed back cap
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 12), this.bambooMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(-0.36, 0.015, 0);
      this.troughPivot.add(cap);

      // Glistening shallow water strip nestled inside the bamboo channel
      const innerWaterMat = new THREE.MeshStandardMaterial({
        color: 0xf4e3d0,
        roughness: 0.15,
        metalness: 0.08,
        transparent: true,
        opacity: 0.78
      });
      this.troughWaterStrip = new THREE.Mesh(new THREE.BoxGeometry(troughLen * 0.92, 0.014, 0.082), innerWaterMat);
      this.troughWaterStrip.position.set(0.10, 0.008, 0);
      this.troughPivot.add(this.troughWaterStrip);

      // Generous invisible touch hit-box for 5-year-old finger tapping/dragging
      this.troughHitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.12, 0.44, 0.44),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.troughHitMesh.position.set(0.12, 0.0, 0.0);
      this.troughHitMesh.userData.interactKind = 'trough';
      this.troughPivot.add(this.troughHitMesh);

      // Curved translucent pouring water stream from spout tip into pool
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.88, 0.42, -0.24),
        new THREE.Vector3(-0.82, 0.25, -0.24),
        new THREE.Vector3(-0.80, -0.02, -0.24)
      );
      const streamGeo = new THREE.TubeGeometry(curve, 14, 0.024, 8, false);
      this.streamMat = new THREE.MeshStandardMaterial({
        color: 0xfef4ea,
        roughness: 0.12,
        metalness: 0.05,
        transparent: true,
        opacity: 0.0
      });
      this.pourStreamMesh = new THREE.Mesh(streamGeo, this.streamMat);
      this.pourStreamMesh.renderOrder = 3;
      this.scene.add(this.pourStreamMesh);

      // Small splash ring at water impact point
      this.splashFoam = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.09, 18).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xfff6ec, transparent: true, opacity: 0.0, depthWrite: false })
      );
      this.splashFoam.position.set(-0.80, 0.012, -0.24);
      this.splashFoam.renderOrder = 3;
      this.scene.add(this.splashFoam);

      this.troughWorldTip = new THREE.Vector3(-0.92, 0.46, -0.24);
    }

    _buildSteamSystem() {
      const steamTex = this.textures.createSteamTexture();
      this.steamGroup = new THREE.Group();
      this.scene.add(this.steamGroup);

      // Pool of 46 soft rising steam wisps (translucent, never obscuring capybaras' faces)
      for (let i = 0; i < 46; i++) {
        const mat = new THREE.SpriteMaterial({
          map: steamTex,
          color: 0xfff8f0,
          transparent: true,
          opacity: 0.0,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        const p = {
          sprite,
          life: Math.random(),
          maxLife: 4.5 + Math.random() * 4.0,
          vx: 0.04 + Math.random() * 0.05,
          vy: 0.12 + Math.random() * 0.09,
          vz: -0.02 + (Math.random() - 0.5) * 0.04,
          baseScale: 0.48 + Math.random() * 0.52,
          isBreath: false,
          swaySeed: Math.random() * 10
        };
        this._resetSteamParticle(p, true);
        this.steamGroup.add(sprite);
        this.steamParticles.push(p);
      }

      // Pool of 24 glistening water droplets (for ear flicks & splashes)
      const dropGeo = new THREE.SphereGeometry(0.015, 6, 5);
      const dropMat = new THREE.MeshStandardMaterial({
        color: 0xfff4e6,
        roughness: 0.1,
        metalness: 0.15,
        transparent: true,
        opacity: 0.85
      });
      for (let i = 0; i < 24; i++) {
        const m = new THREE.Mesh(dropGeo, dropMat);
        m.visible = false;
        this.scene.add(m);
        this.droplets.push({
          mesh: m,
          active: false,
          vx: 0, vy: 0, vz: 0
        });
      }
    }

    _resetSteamParticle(p, randomHeight) {
      // Spawn mostly across the bath surface, biased slightly away from right-in-front-of-camera
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * 0.88;
      let sx = Math.cos(ang) * this.poolRx * rad;
      let sz = Math.sin(ang) * this.poolRz * rad + this.poolCenter.y;
      // When pouring, bias extra particles near the bamboo spout
      if (this.troughTilt > 0.25 && Math.random() < 0.38) {
        sx = this.spoutSplashPos.x + (Math.random() - 0.5) * 0.55;
        sz = this.spoutSplashPos.z + (Math.random() - 0.5) * 0.45;
      }
      p.isBreath = false;
      p.life = randomHeight ? Math.random() * p.maxLife : 0;
      p.sprite.position.set(sx, 0.06 + (randomHeight ? Math.random() * 0.95 : 0), sz);
      p.vx = 0.045 + Math.random() * 0.045;
      p.vy = 0.11 + Math.random() * 0.08 + this.warmth * 0.05;
      p.vz = -0.02 + (Math.random() - 0.5) * 0.035;
      p.baseScale = 0.46 + Math.random() * 0.46;
    }

    // Capybara exhaling through nose ("鼻からふーっと息を吐いて湯気を揺らす")
    pushBreath(x, y, z, dirX, dirZ) {
      // Gently push nearby steam wisps
      for (let i = 0; i < this.steamParticles.length; i++) {
        const p = this.steamParticles[i];
        const dx = p.sprite.position.x - x;
        const dy = p.sprite.position.y - y;
        const dz = p.sprite.position.z - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.85) {
          const push = (1.0 - Math.sqrt(d2) / 0.92) * 0.34;
          p.vx += dirX * push;
          p.vz += dirZ * push;
          p.vy += 0.05 * push;
        }
      }
      // Spawn 2 dedicated visible warm nose-vapor puffs
      let spawned = 0;
      for (let i = 0; i < this.steamParticles.length && spawned < 2; i++) {
        const p = this.steamParticles[i];
        if (!p.isBreath && p.life > p.maxLife * 0.72) {
          p.isBreath = true;
          p.life = 0;
          p.maxLife = 1.85 + Math.random() * 0.5;
          p.sprite.position.set(x + dirX * 0.04, y, z + dirZ * 0.04);
          p.vx = dirX * (0.34 + Math.random() * 0.14);
          p.vz = dirZ * (0.34 + Math.random() * 0.14);
          p.vy = 0.08 + Math.random() * 0.04;
          p.baseScale = 0.20 + Math.random() * 0.10;
          spawned++;
        }
      }
    }

    spawnDroplets(x, y, z, count, speed) {
      let n = 0;
      for (let i = 0; i < this.droplets.length && n < count; i++) {
        const d = this.droplets[i];
        if (!d.active) {
          d.active = true;
          d.mesh.visible = true;
          d.mesh.position.set(x, y, z);
          const ang = Math.random() * Math.PI * 2;
          const spd = (speed || 0.9) * (0.65 + Math.random() * 0.7);
          d.vx = Math.cos(ang) * spd;
          d.vy = 0.85 + Math.random() * 0.85;
          d.vz = Math.sin(ang) * spd;
          n++;
        }
      }
    }

    addRipple(x, z, strength) {
      const r = this.ripples[this.rippleCursor];
      r.set(x, z, this.time, Math.min(1.5, strength || 0.7));
      this.rippleCursor = (this.rippleCursor + 1) % this.maxRipples;
    }

    triggerTroughPour(holdDuration) {
      this.troughTargetTilt = 1.0;
      this.troughHoldTimer = Math.max(this.troughHoldTimer, holdDuration || 2.8);
    }

    setTroughManualTilt(val) {
      this.troughTargetTilt = Math.max(0, Math.min(1, val));
      if (val > 0.15) {
        this.troughHoldTimer = 0.8;
      }
    }

    setTroughHighlight(intensity) {
      this.troughHighlight = intensity;
    }

    getTroughAnchorWorld() {
      const v = new THREE.Vector3(0.22, 0.05, 0);
      this.troughPivot.localToWorld(v);
      return v;
    }

    isInWater(x, z, margin) {
      const m = margin || 0;
      const nx = (x - this.poolCenter.x) / Math.max(0.2, this.poolRx - m);
      const nz = (z - this.poolCenter.y) / Math.max(0.2, this.poolRz - m);
      return (nx * nx + nz * nz) <= 1.0;
    }

    isOnPlatform(x, z) {
      const dx = (x - this.platformCenter.x) / this.platformSize.rx;
      const dz = (z - this.platformCenter.z) / this.platformSize.rz;
      return (dx * dx + dz * dz) <= 1.0;
    }

    isOnFrontEdge(x, z) {
      return z >= 1.06 && z <= 1.72 && x >= -1.25 && x <= 1.25;
    }

    clampToPool(x, z, margin) {
      const rx = Math.max(0.3, this.poolRx - (margin || 0.28));
      const rz = Math.max(0.3, this.poolRz - (margin || 0.28));
      const dx = x - this.poolCenter.x;
      const dz = z - this.poolCenter.y;
      const norm = Math.sqrt((dx * dx) / (rx * rx) + (dz * dz) / (rz * rz));
      if (norm > 1.0) {
        return {
          x: this.poolCenter.x + dx / norm,
          z: this.poolCenter.y + dz / norm
        };
      }
      return { x, z };
    }

    getSurfaceHeightAt(x, z) {
      if (this.isOnPlatform(x, z)) return this.platformCenter.y;
      if (this.isOnFrontEdge(x, z)) return this.frontEdgeY;
      if (this.isInWater(x, z, 0)) return this.waterY;
      return this.frontEdgeY;
    }

    update(dt, duskFactor, audio) {
      this.time += dt;
      this.duskFactor += (duskFactor - this.duskFactor) * Math.min(1, dt * 0.8);

      // Update sky, fog & lighting colors smoothly along sunset -> pale purple dusk
      this.skyUniforms.uDusk.value = this.duskFactor;
      this.waterUniforms.uTime.value = this.time;
      this.waterUniforms.uDusk.value = this.duskFactor;
      this.waterUniforms.uWarmth.value = this.warmth;

      this.scene.fog.color.copy(this.fogColorSunset).lerp(this.fogColorDusk, this.duskFactor);
      this.sunLight.color.setRGB(
        1.0 - 0.14 * this.duskFactor,
        0.80 - 0.14 * this.duskFactor,
        0.59 + 0.18 * this.duskFactor
      );
      this.sunLight.intensity = 1.65 - 0.45 * this.duskFactor;
      this.hemiLight.color.setRGB(
        1.0 - 0.16 * this.duskFactor,
        0.91 - 0.14 * this.duskFactor,
        0.81 + 0.12 * this.duskFactor
      );

      // Update bamboo trough tilt & hot water pour
      if (this.troughHoldTimer > 0) {
        this.troughHoldTimer -= dt;
        if (this.troughHoldTimer <= 0) {
          this.troughTargetTilt = 0;
        }
      }
      this.troughTilt += (this.troughTargetTilt - this.troughTilt) * Math.min(1, dt * 4.5);

      // Resting angle slightly elevated; tilting dips spout downward toward water
      const restAngle = -0.10;
      const pourAngle = -0.34;
      const bounce = this.troughHighlight > 0.05 ? Math.sin(this.time * 3.8) * 0.025 * this.troughHighlight : 0;
      this.troughPivot.rotation.z = restAngle + (pourAngle - restAngle) * this.troughTilt + bounce;

      if (this.troughHighlight > 0.01) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4);
        this.bambooMat.emissive.setHex(0x886228);
        this.bambooMat.emissiveIntensity = this.troughHighlight * (0.20 + pulse * 0.24);
      } else {
        this.bambooMat.emissiveIntensity = 0;
      }

      // Pouring stream visibility, ripples, warmth increase
      const flow = Math.max(0, (this.troughTilt - 0.12) / 0.88);
      this.streamMat.opacity = flow * 0.72;
      this.pourStreamMesh.scale.set(0.65 + flow * 0.45, 1, 0.65 + flow * 0.45);
      this.splashFoam.material.opacity = flow * (0.35 + 0.15 * Math.sin(this.time * 12));
      const fScale = 0.8 + flow * 0.5 + Math.sin(this.time * 9) * 0.1;
      this.splashFoam.scale.set(fScale, fScale, 1);

      if (flow > 0.12) {
        this.warmth = Math.min(1.0, this.warmth + dt * 0.14 * flow);
        this.waterDepthBonus = Math.min(0.032, this.waterDepthBonus + dt * 0.008 * flow);
        if (Math.random() < dt * 4.5 * flow) {
          this.addRipple(
            this.spoutSplashPos.x + (Math.random() - 0.5) * 0.08,
            this.spoutSplashPos.z + (Math.random() - 0.5) * 0.08,
            0.38 + flow * 0.35
          );
        }
      } else {
        // Gently cool back toward a cozy baseline warmth (never cold!)
        this.warmth = Math.max(0.32, this.warmth - dt * 0.014);
        this.waterDepthBonus = Math.max(0, this.waterDepthBonus - dt * 0.002);
      }
      this.waterMesh.position.y = this.waterY + this.waterDepthBonus;

      if (audio) {
        audio.setPourLevel(flow);
      }

      // Update steam particles
      const activeSteamCount = Math.floor(20 + this.warmth * 26);
      for (let i = 0; i < this.steamParticles.length; i++) {
        const p = this.steamParticles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          this._resetSteamParticle(p, false);
        }
        const t = p.life / p.maxLife;
        p.sprite.position.x += (p.vx + Math.sin(this.time * 0.8 + p.swaySeed) * 0.025) * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;

        // Dampen extra exhale velocity gently
        if (!p.isBreath) {
          p.vx += (0.045 - p.vx) * dt * 0.8;
          p.vz += (-0.015 - p.vz) * dt * 0.8;
        } else {
          p.vx *= (1 - dt * 1.1);
          p.vz *= (1 - dt * 1.1);
        }

        const fadeIn = Math.min(1, t / 0.20);
        const fadeOut = Math.max(0, 1 - Math.max(0, (t - 0.45) / 0.55));
        const visibleSlot = (i < activeSteamCount || p.isBreath) ? 1.0 : 0.0;
        const maxAlpha = p.isBreath ? 0.42 : (0.24 + this.warmth * 0.22);
        p.sprite.material.opacity = fadeIn * fadeOut * maxAlpha * visibleSlot;

        const sc = p.baseScale * (0.65 + t * 0.95);
        p.sprite.scale.set(sc, sc * 0.88, 1);

        // Soft warm sunset / lavender tint on steam
        p.sprite.material.color.setRGB(
          1.0,
          0.96 - 0.03 * this.duskFactor,
          0.93 + 0.04 * this.duskFactor
        );
      }

      // Update water droplets
      for (let i = 0; i < this.droplets.length; i++) {
        const d = this.droplets[i];
        if (!d.active) continue;
        d.vy -= 5.8 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        if (d.mesh.position.y <= this.waterY) {
          d.active = false;
          d.mesh.visible = false;
          if (this.isInWater(d.mesh.position.x, d.mesh.position.z, 0)) {
            this.addRipple(d.mesh.position.x, d.mesh.position.z, 0.24);
          }
        }
      }
    }
  }

  window.PokapokaEnvironment = PokapokaEnvironment;
})();
