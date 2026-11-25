(function () {
  'use strict';

  let nextPropId = 1;

  // Build a crisp 3D curved apple slice wedge
  function createAppleWedgeGeometry(remainRatio) {
    const r = Math.max(0.28, Math.min(1.0, remainRatio));
    const arc = Math.PI * (0.42 * r + 0.14);
    const radius = 0.088 * (0.68 + 0.32 * r);
    const thick = 0.044 * (0.72 + 0.28 * r);

    // Build custom wedge prism with curved red skin outer face & flat creamy flesh sides
    const segs = 10;
    const positions = [];
    const normals = [];
    const uvs = [];
    const skinIndices = [];
    const fleshIndices = [];

    // Helper to push vertex
    function pushV(x, y, z, nx, ny, nz, u, v) {
      const idx = positions.length / 3;
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
      return idx;
    }

    const innerR = radius * (0.28 + (1 - r) * 0.28);
    // Outer curved skin strip
    const outerTop = [];
    const outerBot = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const a = -arc * 0.5 + arc * t;
      const cx = Math.cos(a);
      const sz = Math.sin(a);
      const yHalf = thick * 0.5 * (0.55 + 0.45 * Math.sin(t * Math.PI));
      outerTop.push(pushV(cx * radius, yHalf, sz * radius, cx, 0.15, sz, t, 1));
      outerBot.push(pushV(cx * radius, -yHalf, sz * radius, cx, -0.15, sz, t, 0));
    }
    for (let i = 0; i < segs; i++) {
      skinIndices.push(outerTop[i], outerBot[i + 1], outerBot[i]);
      skinIndices.push(outerTop[i], outerTop[i + 1], outerBot[i + 1]);
    }

    // Two flat cut flesh faces (top and bottom wedge fans meeting at inner spine)
    const spineStart = pushV(innerR, 0, -Math.sin(arc * 0.35) * innerR, -1, 0, 0, 0.1, 0.5);
    const spineEnd = pushV(innerR, 0, Math.sin(arc * 0.35) * innerR, -1, 0, 0, 0.9, 0.5);
    const topFlesh = [];
    const botFlesh = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const a = -arc * 0.5 + arc * t;
      const cx = Math.cos(a);
      const sz = Math.sin(a);
      const yHalf = thick * 0.5 * (0.55 + 0.45 * Math.sin(t * Math.PI));
      topFlesh.push(pushV(cx * radius, yHalf, sz * radius, 0, 1, 0, t, 1));
      botFlesh.push(pushV(cx * radius, -yHalf, sz * radius, 0, -1, 0, t, 0));
    }
    const midSpineTop = pushV(innerR, 0.004, 0, -0.3, 0.95, 0, 0.5, 0.1);
    const midSpineBot = pushV(innerR, -0.004, 0, -0.3, -0.95, 0, 0.5, 0.1);

    for (let i = 0; i < segs; i++) {
      fleshIndices.push(midSpineTop, topFlesh[i + 1], topFlesh[i]);
      fleshIndices.push(midSpineBot, botFlesh[i], botFlesh[i + 1]);
    }
    // End caps
    fleshIndices.push(midSpineTop, topFlesh[0], botFlesh[0]);
    fleshIndices.push(midSpineTop, botFlesh[0], midSpineBot);
    fleshIndices.push(midSpineTop, botFlesh[segs], topFlesh[segs]);
    fleshIndices.push(midSpineTop, midSpineBot, botFlesh[segs]);
    void spineStart;
    void spineEnd;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const allIndices = skinIndices.concat(fleshIndices);
    geo.setIndex(allIndices);
    geo.addGroup(0, skinIndices.length, 0);
    geo.addGroup(skinIndices.length, fleshIndices.length, 1);
    geo.computeVertexNormals();
    geo.translate(-radius * 0.55, 0, 0);
    return geo;
  }

  class AppleSlice {
    constructor(opts) {
      this.id = opts.id || ('apple_' + nextPropId++);
      this.kind = 'apple';
      this.env = opts.env;
      this.scene = opts.scene;
      this.materials = opts.materials; // [skinMat, fleshMat]

      this.alive = true;
      this.dragging = false;
      this.inBasket = false;
      this.onPlatform = false;
      this.inWater = false;
      this.sunk = false;
      this.waterTimer = 0;
      this.bitesTaken = opts.bitesTaken || 0;
      this.maxBites = 4;
      this.remainRatio = Math.max(0.25, 1.0 - this.bitesTaken / this.maxBites);

      this.pos = new THREE.Vector3(opts.x || 0, opts.y || 0.16, opts.z || 1.25);
      this.vel = new THREE.Vector3();
      this.rotY = opts.rotY !== undefined ? opts.rotY : (Math.random() * Math.PI * 2);
      this.arcAnim = null;

      this.group = new THREE.Group();
      this.mesh = new THREE.Mesh(createAppleWedgeGeometry(this.remainRatio), this.materials);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.group.add(this.mesh);

      // Generous invisible touch sphere so child can pick up & move placed apples too
      this.hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.hitMesh.userData.prop = this;
      this.group.add(this.hitMesh);

      this.group.position.copy(this.pos);
      this.group.rotation.y = this.rotY;
      this.scene.add(this.group);
    }

    launchArcTo(tx, ty, tz, duration) {
      this.arcAnim = {
        sx: this.pos.x, sy: this.pos.y, sz: this.pos.z,
        tx, ty, tz,
        t: 0, dur: duration || 0.42
      };
    }

    takeBite(fromX, fromZ) {
      this.bitesTaken++;
      this.remainRatio = Math.max(0.0, 1.0 - this.bitesTaken / this.maxBites);
      if (this.bitesTaken >= this.maxBites) {
        this.destroy();
        return true;
      }
      // Rebuild smaller bitten wedge geometry
      const oldGeo = this.mesh.geometry;
      this.mesh.geometry = createAppleWedgeGeometry(this.remainRatio);
      oldGeo.dispose();
      // Subtle nudge from the bite
      const dx = this.pos.x - fromX;
      const dz = this.pos.z - fromZ;
      const d = Math.hypot(dx, dz) + 0.001;
      this.pos.x += (dx / d) * 0.012;
      this.pos.z += (dz / d) * 0.012;
      return false;
    }

    update(dt, audio) {
      if (!this.alive) return;

      if (this.arcAnim) {
        const a = this.arcAnim;
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        const ease = 1 - Math.pow(1 - p, 2);
        this.pos.x = a.sx + (a.tx - a.sx) * ease;
        this.pos.z = a.sz + (a.tz - a.sz) * ease;
        this.pos.y = a.sy + (a.ty - a.sy) * ease + Math.sin(p * Math.PI) * 0.22;
        if (p >= 1) {
          this.arcAnim = null;
          this.settleAtCurrentPos(audio);
        }
      } else if (!this.dragging) {
        if (this.inWater) {
          // Apple dropped in water floats briefly, then slowly sinks ("小さく浮いてからゆっくり沈みかけます")
          this.waterTimer += dt;
          const bob = Math.sin(this.waterTimer * 3.4) * 0.008;
          const sink = Math.max(0, (this.waterTimer - 2.0) * 0.042);
          this.pos.y = this.env.waterY + this.env.waterDepthBonus + 0.006 + bob - sink;
          this.group.rotation.z = Math.sin(this.waterTimer * 1.9) * 0.16;
          this.pos.x += this.vel.x * dt;
          this.pos.z += this.vel.z * dt;
          this.vel.multiplyScalar(0.95);
          if (sink > 0.16) {
            this.sunk = true;
            if (sink > 0.42) {
              this.destroy();
              return;
            }
          }
        }
      }

      this.group.position.copy(this.pos);
      this.group.rotation.y = this.rotY;
    }

    settleAtCurrentPos(audio) {
      this.onPlatform = this.env.isOnPlatform(this.pos.x, this.pos.z);
      if (this.onPlatform) {
        this.inWater = false;
        this.pos.y = this.env.platformCenter.y + 0.025;
        if (audio) audio.playStoneSet();
      } else if (this.env.isInWater(this.pos.x, this.pos.z, 0.08)) {
        this.inWater = true;
        this.waterTimer = 0;
        this.pos.y = this.env.waterY + 0.01;
        this.env.addRipple(this.pos.x, this.pos.z, 0.55);
        if (audio) audio.playWaterRipple(0.45, 1.32);
      } else {
        this.inWater = false;
        this.pos.y = this.env.frontEdgeY + 0.024;
        if (audio) audio.playStoneSet();
      }
      this.group.position.copy(this.pos);
    }

    destroy() {
      this.alive = false;
      this.scene.remove(this.group);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
    }

    serialize() {
      return {
        id: this.id,
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        rotY: this.rotY,
        bitesTaken: this.bitesTaken,
        onPlatform: this.onPlatform,
        inWater: this.inWater
      };
    }
  }

  class YuzuFruit {
    constructor(opts) {
      this.id = opts.id || ('yuzu_' + nextPropId++);
      this.kind = 'yuzu';
      this.env = opts.env;
      this.scene = opts.scene;

      this.alive = true;
      this.dragging = false;
      this.inWater = opts.inWater !== false;
      this.onPlatform = false;
      this.radius = 0.078;
      this.pos = new THREE.Vector3(opts.x || 0, opts.y || 0.0, opts.z || 0);
      this.vx = opts.vx || 0;
      this.vz = opts.vz || 0;
      this.bobSeed = Math.random() * Math.PI * 2;
      this.chinPressed = 0;
      this.arcAnim = null;

      this.group = new THREE.Group();
      const bodyGeo = new THREE.SphereGeometry(this.radius, 18, 14);
      bodyGeo.scale(1.04, 0.90, 1.04);
      const body = new THREE.Mesh(bodyGeo, opts.yuzuMat);
      body.castShadow = true;
      body.receiveShadow = true;
      this.group.add(body);

      // Tiny dark-green citrus calyx stem on top
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.020, 0.014, 6), opts.stemMat);
      stem.position.y = this.radius * 0.88;
      this.group.add(stem);

      this.hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.hitMesh.userData.prop = this;
      this.group.add(this.hitMesh);

      this.group.position.copy(this.pos);
      this.scene.add(this.group);
    }

    launchArcTo(tx, ty, tz, duration) {
      this.arcAnim = {
        sx: this.pos.x, sy: this.pos.y, sz: this.pos.z,
        tx, ty, tz,
        t: 0, dur: duration || 0.48
      };
    }

    settleAtCurrentPos(audio) {
      this.onPlatform = this.env.isOnPlatform(this.pos.x, this.pos.z);
      if (this.onPlatform) {
        this.inWater = false;
        this.pos.y = this.env.platformCenter.y + this.radius * 0.85;
        if (audio) audio.playStoneSet();
      } else if (this.env.isInWater(this.pos.x, this.pos.z, 0.04)) {
        this.inWater = true;
        this.pos.y = this.env.waterY + this.env.waterDepthBonus + 0.018;
        this.vx = (Math.random() - 0.5) * 0.16;
        this.vz = (Math.random() - 0.5) * 0.16;
        this.env.addRipple(this.pos.x, this.pos.z, 0.82);
        if (audio) audio.playWaterRipple(0.62, 1.12);
      } else {
        this.inWater = false;
        this.pos.y = this.env.frontEdgeY + this.radius * 0.85;
        if (audio) audio.playStoneSet();
      }
      this.group.position.copy(this.pos);
    }

    update(dt, time, yuzus, audio) {
      if (!this.alive) return;

      if (this.arcAnim) {
        const a = this.arcAnim;
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        const ease = 1 - Math.pow(1 - p, 2);
        this.pos.x = a.sx + (a.tx - a.sx) * ease;
        this.pos.z = a.sz + (a.tz - a.sz) * ease;
        this.pos.y = a.sy + (a.ty - a.sy) * ease + Math.sin(p * Math.PI) * 0.28;
        this.group.rotation.x += dt * 2.2;
        if (p >= 1) {
          this.arcAnim = null;
          this.settleAtCurrentPos(audio);
        }
        this.group.position.copy(this.pos);
        return;
      }

      if (this.dragging) {
        this.group.position.copy(this.pos);
        return;
      }

      if (this.inWater) {
        // Gentle buoyant thermal drift & bobbing
        this.vx += Math.sin(time * 0.55 + this.bobSeed) * 0.015 * dt;
        this.vz += Math.cos(time * 0.48 + this.bobSeed * 1.3) * 0.015 * dt;

        // Soft damping
        const damp = Math.pow(0.28, dt);
        this.vx *= damp;
        this.vz *= damp;

        this.pos.x += this.vx * dt;
        this.pos.z += this.vz * dt;

        // Soft bounce inside the oval hot spring wall
        const rx = this.env.poolRx - 0.14;
        const rz = this.env.poolRz - 0.14;
        const dx = this.pos.x - this.env.poolCenter.x;
        const dz = this.pos.z - this.env.poolCenter.y;
        const norm = Math.hypot(dx / rx, dz / rz);
        if (norm > 1.0) {
          this.pos.x = this.env.poolCenter.x + (dx / norm);
          this.pos.z = this.env.poolCenter.y + (dz / norm);
          const nx = dx / (rx * norm);
          const nz = dz / (rz * norm);
          const dot = this.vx * nx + this.vz * nz;
          if (dot > 0) {
            this.vx -= 1.6 * dot * nx;
            this.vz -= 1.6 * dot * nz;
          }
        }

        // Elastic yuzu-to-yuzu collisions with gentle hollow bonk sound!
        for (let i = 0; i < yuzus.length; i++) {
          const other = yuzus[i];
          if (other === this || !other.inWater || other.dragging) continue;
          const ox = other.pos.x - this.pos.x;
          const oz = other.pos.z - this.pos.z;
          const d = Math.hypot(ox, oz);
          const minD = this.radius + other.radius + 0.008;
          if (d > 0.0001 && d < minD) {
            const nx = ox / d;
            const nz = oz / d;
            const pen = (minD - d) * 0.5;
            this.pos.x -= nx * pen;
            this.pos.z -= nz * pen;
            other.pos.x += nx * pen;
            other.pos.z += nz * pen;

            const rvx = other.vx - this.vx;
            const rvz = other.vz - this.vz;
            const rel = rvx * nx + rvz * nz;
            if (rel < 0) {
              const imp = -rel * 0.78;
              this.vx -= nx * imp;
              this.vz -= nz * imp;
              other.vx += nx * imp;
              other.vz += nz * imp;
              if (Math.abs(rel) > 0.08) {
                if (audio) audio.playYuzuBonk(Math.min(0.85, Math.abs(rel) * 1.4));
                this.env.addRipple((this.pos.x + other.pos.x) * 0.5, (this.pos.z + other.pos.z) * 0.5, 0.25);
              }
            }
          }
        }

        const chinDip = this.chinPressed * 0.022;
        this.chinPressed = Math.max(0, this.chinPressed - dt * 2.5);
        const bob = Math.sin(time * 2.4 + this.bobSeed) * 0.008;
        this.pos.y = this.env.waterY + this.env.waterDepthBonus + 0.016 + bob - chinDip;
        this.group.rotation.x = Math.sin(time * 1.7 + this.bobSeed) * 0.14;
        this.group.rotation.z = Math.cos(time * 1.5 + this.bobSeed) * 0.14;
      }

      this.group.position.copy(this.pos);
    }

    destroy() {
      this.alive = false;
      this.scene.remove(this.group);
    }

    serialize() {
      return {
        id: this.id,
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        inWater: this.inWater
      };
    }
  }

  // Large wet green cabbage leaf with edge-draping into water & jagged tooth-mark deformation!
  class CabbageLeaf {
    constructor(opts) {
      this.id = opts.id || ('cabbage_' + nextPropId++);
      this.kind = 'cabbage';
      this.env = opts.env;
      this.scene = opts.scene;

      this.alive = true;
      this.dragging = false;
      this.onPlatform = !!opts.onPlatform;
      this.drapeWater = !this.onPlatform;
      this.leftBites = opts.leftBites || 0;
      this.rightBites = opts.rightBites || 0;
      this.maxTotalBites = 8;
      this.remainRatio = Math.max(0.15, 1.0 - (this.leftBites + this.rightBites) / this.maxTotalBites);
      this.noseBumped = false;
      this.arcAnim = null;

      this.pos = new THREE.Vector3(opts.x || 0, opts.y || 0.15, opts.z || 1.24);
      this.rotY = opts.rotY || 0;

      this.group = new THREE.Group();
      this.geo = new THREE.PlaneGeometry(0.42, 0.32, 16, 12);
      this.geo.rotateX(-Math.PI / 2);
      // Save base positions so we can cleanly apply water-draping & jagged bite notches
      this.basePos = new Float32Array(this.geo.attributes.position.array);
      this.mesh = new THREE.Mesh(this.geo, opts.cabbageMat);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.group.add(this.mesh);

      this.hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.14, 0.34),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.hitMesh.userData.prop = this;
      this.group.add(this.hitMesh);

      this._deformLeaf();
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.rotY;
      this.scene.add(this.group);
    }

    _deformLeaf() {
      const pos = this.geo.attributes.position;
      const leftCut = -0.21 + this.leftBites * 0.044;
      const rightCut = 0.21 - this.rightBites * 0.044;

      for (let i = 0; i < pos.count; i++) {
        let x = this.basePos[i * 3];
        let y = this.basePos[i * 3 + 1];
        let z = this.basePos[i * 3 + 2];

        // Natural oval leafy silhouette with ruffled edge
        const nx = x / 0.21;
        const nz = z / 0.16;
        const r = Math.hypot(nx * 0.92, nz);
        const ruffle = Math.sin(Math.atan2(nz, nx) * 7.0) * 0.014 * Math.min(1, r);

        // Gently cup the leaf upward at sides
        y += (nx * nx * 0.018) + ruffle + (1.0 - Math.min(1, r)) * 0.012;

        // If resting on the front bath edge, inner edge (-Z side) drapes gracefully into the water!
        if (this.drapeWater && z < -0.02) {
          const hang = Math.min(1, (-z - 0.02) / 0.14);
          y -= hang * hang * 0.115;
        }

        // Carve jagged bite contours from left and/or right ends ("かじられた跡がぎざぎざに残ります")
        if (this.leftBites > 0 && x < leftCut) {
          const jag = Math.abs(Math.sin(z * 58.0 + this.leftBites * 2.1)) * 0.026;
          x = Math.min(rightCut - 0.02, leftCut + jag);
          y -= 0.005;
        }
        if (this.rightBites > 0 && x > rightCut) {
          const jag = Math.abs(Math.sin(z * 62.0 + this.rightBites * 1.9)) * 0.026;
          x = Math.max(leftCut + 0.02, rightCut - jag);
          y -= 0.005;
        }

        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      this.geo.computeVertexNormals();
    }

    launchArcTo(tx, ty, tz, duration) {
      this.arcAnim = {
        sx: this.pos.x, sy: this.pos.y, sz: this.pos.z,
        tx, ty, tz,
        t: 0, dur: duration || 0.45
      };
    }

    settleAtCurrentPos(audio) {
      this.onPlatform = this.env.isOnPlatform(this.pos.x, this.pos.z);
      if (this.onPlatform) {
        this.drapeWater = false;
        this.pos.y = this.env.platformCenter.y + 0.016;
        if (audio) audio.playStoneSet();
      } else {
        // Place neatly along the stone rim so its inner edge drapes gently into the hot spring
        this.drapeWater = true;
        this.pos.z = Math.max(1.12, Math.min(1.42, this.pos.z));
        this.pos.y = this.env.frontEdgeY + 0.016;
        this.env.addRipple(this.pos.x, this.pos.z - 0.16, 0.25);
        if (audio) audio.playStoneSet();
      }
      this._deformLeaf();
      this.group.position.copy(this.pos);
    }

    takeBite(fromX, fromZ, endSide) {
      if (endSide === 'left') {
        this.leftBites++;
      } else if (endSide === 'right') {
        this.rightBites++;
      } else {
        if (fromX < this.pos.x) this.leftBites++;
        else this.rightBites++;
      }

      const total = this.leftBites + this.rightBites;
      this.remainRatio = Math.max(0, 1.0 - total / this.maxTotalBites);
      if (total >= this.maxTotalBites) {
        this.destroy();
        return true;
      }
      this._deformLeaf();
      return false;
    }

    update(dt, time, audio) {
      if (!this.alive) return;
      if (this.arcAnim) {
        const a = this.arcAnim;
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        const ease = 1 - Math.pow(1 - p, 2);
        this.pos.x = a.sx + (a.tx - a.sx) * ease;
        this.pos.z = a.sz + (a.tz - a.sz) * ease;
        this.pos.y = a.sy + (a.ty - a.sy) * ease + Math.sin(p * Math.PI) * 0.24;
        if (p >= 1) {
          this.arcAnim = null;
          this.settleAtCurrentPos(audio);
        }
      }
      // Subtle gentle bob from water on the draped tip
      if (!this.dragging && this.drapeWater && !this.arcAnim) {
        this.group.rotation.x = Math.sin(time * 1.9) * 0.018;
      }
      this.group.position.copy(this.pos);
    }

    destroy() {
      this.alive = false;
      this.scene.remove(this.group);
      this.geo.dispose();
    }

    serialize() {
      return {
        id: this.id,
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        rotY: this.rotY,
        onPlatform: this.onPlatform,
        leftBites: this.leftBites,
        rightBites: this.rightBites
      };
    }
  }

  // Interactive Woven Bamboo Basket sitting on the flat stone edge (or slidable to the raised stone platform!)
  class BambooBasket {
    constructor(scene, textures, env) {
      this.scene = scene;
      this.env = env;
      this.onPlatform = false;
      this.defaultPos = new THREE.Vector3(0.44, env.frontEdgeY, 1.38);
      this.platformPos = new THREE.Vector3(1.16, env.platformCenter.y, 0.36);
      this.pos = this.defaultPos.clone();
      this.targetPos = this.defaultPos.clone();
      this.highlightKind = null; // 'apple' | 'yuzu' | 'cabbage' | 'basket' | null
      this.time = 0;

      // Shared materials for food items inside & spawned from basket
      const basketTex = textures.createBasketTextures();
      const appleTex = textures.createAppleTextures();
      const yuzuTex = textures.createYuzuTextures();
      const cabbageTex = textures.createCabbageTextures();

      this.basketMat = new THREE.MeshStandardMaterial({
        map: basketTex.map,
        bumpMap: basketTex.bumpMap,
        bumpScale: 0.025,
        color: 0xdab888,
        roughness: 0.78,
        side: THREE.DoubleSide
      });

      this.rimMat = new THREE.MeshStandardMaterial({
        map: basketTex.map,
        bumpMap: basketTex.bumpMap,
        bumpScale: 0.02,
        color: 0xc9a068,
        roughness: 0.70,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      });

      this.appleSkinMat = new THREE.MeshStandardMaterial({
        map: appleTex.skinMap,
        roughness: 0.22,
        metalness: 0.04,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      });
      this.appleFleshMat = new THREE.MeshStandardMaterial({
        map: appleTex.fleshMap,
        roughness: 0.52,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      });

      this.yuzuMat = new THREE.MeshStandardMaterial({
        map: yuzuTex.map,
        bumpMap: yuzuTex.bumpMap,
        bumpScale: 0.014,
        roughness: 0.44,
        metalness: 0.02,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      });
      this.stemMat = new THREE.MeshStandardMaterial({ color: 0x456b2f, roughness: 0.75 });

      this.cabbageMat = new THREE.MeshStandardMaterial({
        map: cabbageTex.map,
        bumpMap: cabbageTex.bumpMap,
        bumpScale: 0.018,
        roughness: 0.36, // moist glossy wet green
        metalness: 0.03,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      });

      this.root = new THREE.Group();
      this.root.position.copy(this.pos);
      this.scene.add(this.root);

      this.appleCount = 3;
      this.yuzuCount = 2;
      this.cabbageUnlocked = false;
      this.cabbageAvailable = false;

      this.hitMeshes = [];
      this._buildBasketMesh();
      this._buildBasketContents();
    }

    _buildBasketMesh() {
      // Shallow woven bamboo bowl via LatheGeometry
      const pts = [
        new THREE.Vector2(0.0, 0.008),
        new THREE.Vector2(0.18, 0.010),
        new THREE.Vector2(0.24, 0.036),
        new THREE.Vector2(0.28, 0.110),
        new THREE.Vector2(0.29, 0.135)
      ];
      const bowlGeo = new THREE.LatheGeometry(pts, 28);
      const bowl = new THREE.Mesh(bowlGeo, this.basketMat);
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      this.root.add(bowl);

      // Thick comfortable rounded bamboo rim ("籠の縁は指が自然に収まる太さ")
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.292, 0.024, 10, 28), this.rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.138;
      rim.castShadow = true;
      rim.receiveShadow = true;
      this.root.add(rim);

      // Decorative dark bamboo binding wraps around the rim
      const wrapMat = new THREE.MeshStandardMaterial({ color: 0x7a5732, roughness: 0.8 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 10), wrapMat);
        wrap.position.set(Math.cos(a) * 0.292, 0.138, Math.sin(a) * 0.292);
        wrap.rotation.y = -a;
        this.root.add(wrap);
      }

      // Basket rim touch hitbox (for sliding basket to platform or waking capybaras at finale)
      this.basketHitMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.28, 0.16, 14),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.basketHitMesh.position.y = 0.08;
      this.basketHitMesh.userData.interactKind = 'basket';
      this.root.add(this.basketHitMesh);
    }

    _buildBasketContents() {
      // Apple slice display meshes inside basket (curved glossy red skin facing camera + crisp creamy cut face!)
      this.appleSlots = [];
      const appleOffsets = [
        { x: -0.10, y: 0.086, z: 0.08, ry: -1.15, rx: 0.48, rz: -0.22 },
        { x: -0.02, y: 0.094, z: 0.11, ry: -1.65, rx: 0.55, rz: 0.18 },
        { x: -0.12, y: 0.094, z: -0.03, ry: -0.55, rx: 0.52, rz: -0.15 }
      ];
      appleOffsets.forEach((o, idx) => {
        const slot = new THREE.Group();
        slot.position.set(o.x, o.y, o.z);
        slot.rotation.set(o.rx, o.ry, o.rz);
        const m = new THREE.Mesh(createAppleWedgeGeometry(1.0), [this.appleSkinMat, this.appleFleshMat]);
        m.castShadow = true;
        slot.add(m);

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.095, 8, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.userData.interactKind = 'basket_apple';
        hit.userData.slotIndex = idx;
        slot.add(hit);
        this.hitMeshes.push(hit);

        this.root.add(slot);
        this.appleSlots.push({ group: slot, baseY: o.y, hit });
      });

      // Yuzu display meshes inside basket (right side of basket)
      this.yuzuSlots = [];
      const yuzuOffsets = [
        { x: 0.11, y: 0.092, z: 0.03 },
        { x: 0.05, y: 0.088, z: -0.10 }
      ];
      yuzuOffsets.forEach((o, idx) => {
        const slot = new THREE.Group();
        slot.position.set(o.x, o.y, o.z);
        const geo = new THREE.SphereGeometry(0.075, 16, 12);
        geo.scale(1.04, 0.90, 1.04);
        const body = new THREE.Mesh(geo, this.yuzuMat);
        body.castShadow = true;
        slot.add(body);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.019, 0.014, 6), this.stemMat);
        stem.position.y = 0.068;
        slot.add(stem);

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.105, 8, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.userData.interactKind = 'basket_yuzu';
        hit.userData.slotIndex = idx;
        slot.add(hit);
        this.hitMeshes.push(hit);

        this.root.add(slot);
        this.yuzuSlots.push({ group: slot, baseY: o.y, hit });
      });

      // Large moist green cabbage leaf draped inside back-left of basket (appears in Discovery #2!)
      this.cabbageSlot = new THREE.Group();
      this.cabbageSlot.position.set(-0.04, 0.115, -0.09);
      this.cabbageSlot.rotation.set(0.28, -0.25, 0.08);
      const cabGeo = new THREE.PlaneGeometry(0.32, 0.25, 10, 8);
      cabGeo.rotateX(-Math.PI / 2);
      const cp = cabGeo.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        const vx = cp.getX(i);
        const vz = cp.getZ(i);
        cp.setY(i, (vx * vx + vz * vz) * 0.45 + Math.sin(vx * 18) * 0.008);
      }
      cabGeo.computeVertexNormals();
      const cabMesh = new THREE.Mesh(cabGeo, this.cabbageMat);
      cabMesh.castShadow = true;
      this.cabbageSlot.add(cabMesh);

      this.cabbageHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.145, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      this.cabbageHit.userData.interactKind = 'basket_cabbage';
      this.cabbageSlot.add(this.cabbageHit);
      this.hitMeshes.push(this.cabbageHit);

      this.cabbageSlot.visible = false;
      this.cabbageSlot.scale.setScalar(0.01);
      this.root.add(this.cabbageSlot);
    }

    unlockCabbage() {
      if (!this.cabbageUnlocked) {
        this.cabbageUnlocked = true;
        this.cabbageAvailable = true;
        this.cabbageSlot.visible = true;
      }
    }

    replenishSoftly() {
      if (this.appleCount < 2) this.appleCount = 3;
      if (this.yuzuCount < 1) this.yuzuCount = 2;
      if (this.cabbageUnlocked && !this.cabbageAvailable) {
        this.cabbageAvailable = true;
        this.cabbageSlot.visible = true;
      }
    }

    moveToPlatform(onPlat) {
      this.onPlatform = !!onPlat;
      this.targetPos.copy(this.onPlatform ? this.platformPos : this.defaultPos);
    }

    getWorldAnchorFor(kind) {
      const v = new THREE.Vector3();
      if (kind === 'apple' && this.appleSlots[0]) {
        this.appleSlots[0].group.getWorldPosition(v);
        return v;
      }
      if (kind === 'yuzu' && this.yuzuSlots[0]) {
        this.yuzuSlots[0].group.getWorldPosition(v);
        return v;
      }
      if (kind === 'cabbage' && this.cabbageUnlocked) {
        this.cabbageSlot.getWorldPosition(v);
        return v;
      }
      this.root.getWorldPosition(v);
      v.y += 0.14;
      return v;
    }

    getInteractiveMeshes() {
      const list = [];
      for (let i = 0; i < this.appleSlots.length; i++) {
        if (i < this.appleCount) list.push(this.appleSlots[i].hit);
      }
      for (let i = 0; i < this.yuzuSlots.length; i++) {
        if (i < this.yuzuCount) list.push(this.yuzuSlots[i].hit);
      }
      if (this.cabbageUnlocked && this.cabbageAvailable) {
        list.push(this.cabbageHit);
      }
      list.push(this.basketHitMesh);
      return list;
    }

    update(dt) {
      this.time += dt;
      this.pos.lerp(this.targetPos, Math.min(1, dt * 4.5));
      this.root.position.copy(this.pos);

      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.8);
      const hop = Math.max(0, Math.sin(this.time * 3.8)) * 0.016;

      // Update apple slots visibility & subtle world-only highlight
      for (let i = 0; i < this.appleSlots.length; i++) {
        const s = this.appleSlots[i];
        s.group.visible = i < this.appleCount;
        const hl = (this.highlightKind === 'apple' && i === 0);
        s.group.position.y = s.baseY + (hl ? hop : 0);
      }
      if (this.highlightKind === 'apple') {
        this.appleSkinMat.emissive.setHex(0x8a2c14);
        this.appleSkinMat.emissiveIntensity = 0.22 + pulse * 0.26;
        this.appleFleshMat.emissive.setHex(0x7c5c26);
        this.appleFleshMat.emissiveIntensity = 0.16 + pulse * 0.20;
      } else {
        this.appleSkinMat.emissiveIntensity = 0;
        this.appleFleshMat.emissiveIntensity = 0;
      }

      // Update yuzu slots
      for (let i = 0; i < this.yuzuSlots.length; i++) {
        const s = this.yuzuSlots[i];
        s.group.visible = i < this.yuzuCount;
        const hl = (this.highlightKind === 'yuzu' && i === 0);
        s.group.position.y = s.baseY + (hl ? hop : 0);
      }
      if (this.highlightKind === 'yuzu') {
        this.yuzuMat.emissive.setHex(0x9a6d0e);
        this.yuzuMat.emissiveIntensity = 0.20 + pulse * 0.25;
      } else {
        this.yuzuMat.emissiveIntensity = 0;
      }

      // Update cabbage slot smooth reveal & highlight
      if (this.cabbageUnlocked && this.cabbageAvailable) {
        this.cabbageSlot.visible = true;
        const sc = this.cabbageSlot.scale.x + (1.0 - this.cabbageSlot.scale.x) * Math.min(1, dt * 3.2);
        this.cabbageSlot.scale.setScalar(sc);
        this.cabbageSlot.position.y = 0.115 + (this.highlightKind === 'cabbage' ? hop : 0);
      } else {
        this.cabbageSlot.visible = false;
      }
      if (this.highlightKind === 'cabbage') {
        this.cabbageMat.emissive.setHex(0x3a7026);
        this.cabbageMat.emissiveIntensity = 0.22 + pulse * 0.26;
      } else {
        this.cabbageMat.emissiveIntensity = 0;
      }

      // Basket rim highlight (for platform slide or finale wake)
      if (this.highlightKind === 'basket') {
        this.rimMat.emissive.setHex(0x885c24);
        this.rimMat.emissiveIntensity = 0.22 + pulse * 0.28;
      } else {
        this.rimMat.emissiveIntensity = 0;
      }
    }

    spawnApple(x, y, z, opts) {
      return new AppleSlice({
        env: this.env,
        scene: this.scene,
        materials: [this.appleSkinMat.clone(), this.appleFleshMat.clone()],
        x, y, z,
        bitesTaken: opts && opts.bitesTaken,
        rotY: opts && opts.rotY,
        id: opts && opts.id
      });
    }

    spawnYuzu(x, y, z, opts) {
      return new YuzuFruit({
        env: this.env,
        scene: this.scene,
        yuzuMat: this.yuzuMat.clone(),
        stemMat: this.stemMat,
        x, y, z,
        inWater: opts ? opts.inWater : true,
        id: opts && opts.id
      });
    }

    spawnCabbage(x, y, z, opts) {
      return new CabbageLeaf({
        env: this.env,
        scene: this.scene,
        cabbageMat: this.cabbageMat.clone(),
        x, y, z,
        onPlatform: opts && opts.onPlatform,
        leftBites: opts && opts.leftBites,
        rightBites: opts && opts.rightBites,
        rotY: opts && opts.rotY,
        id: opts && opts.id
      });
    }
  }

  // Tiny crisp crumbs when biting apple or cabbage
  class CrumbPool {
    constructor(scene) {
      this.scene = scene;
      this.items = [];
      const geo = new THREE.DodecahedronGeometry(0.011, 0);
      this.appleMat = new THREE.MeshStandardMaterial({ color: 0xf4e8c4, roughness: 0.7 });
      this.leafMat = new THREE.MeshStandardMaterial({ color: 0x6ea452, roughness: 0.65 });
      for (let i = 0; i < 20; i++) {
        const m = new THREE.Mesh(geo, this.appleMat);
        m.visible = false;
        this.scene.add(m);
        this.items.push({ mesh: m, active: false, vx: 0, vy: 0, vz: 0, life: 0 });
      }
    }

    burst(x, y, z, isLeaf) {
      let n = 0;
      for (let i = 0; i < this.items.length && n < 5; i++) {
        const c = this.items[i];
        if (!c.active) {
          c.active = true;
          c.life = 0.55 + Math.random() * 0.25;
          c.mesh.material = isLeaf ? this.leafMat : this.appleMat;
          c.mesh.visible = true;
          c.mesh.position.set(x, y, z);
          const a = Math.random() * Math.PI * 2;
          const s = 0.22 + Math.random() * 0.32;
          c.vx = Math.cos(a) * s;
          c.vy = 0.45 + Math.random() * 0.45;
          c.vz = Math.sin(a) * s;
          n++;
        }
      }
    }

    update(dt) {
      for (let i = 0; i < this.items.length; i++) {
        const c = this.items[i];
        if (!c.active) continue;
        c.life -= dt;
        c.vy -= 3.8 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z += c.vz * dt;
        c.mesh.rotation.x += dt * 5;
        if (c.life <= 0) {
          c.active = false;
          c.mesh.visible = false;
        }
      }
    }
  }

  window.PokapokaProps = {
    BambooBasket,
    AppleSlice,
    YuzuFruit,
    CabbageLeaf,
    CrumbPool
  };
})();
