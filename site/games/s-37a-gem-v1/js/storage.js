(function (global) {
  'use strict';

  const STORAGE_KEY = 'rakko_pukapuka_state_v1';

  const DEFAULT_STATE = {
    version: 1,
    playTime: 0,
    napCount: 0,
    cameraStage: 'diagonal', // 'diagonal' | 'low'
    scallopUnlocked: false,
    rockOtterUnlocked: false,
    mom: {
      x: -0.14,
      z: 0.24,
      yaw: -0.42,
      hasStone: false,
      fedCount: 0,
      crackedCount: 0,
      sharedCount: 0,
      kelpWrapped: false,
      sleeping: false
    },
    baby: {
      carrier: 'mom' // 'mom' | 'kelp'
    },
    rockOtter: {
      active: false,
      x: 0.96,
      z: -1.16,
      yaw: -2.45,
      fedCount: 0,
      sleeping: false,
      waitBias: 0
    },
    stone: {
      location: 'bottom', // 'bottom' | 'mom_belly'
      x: 0.56,
      y: -1.21,
      z: 0.12
    },
    bucketShells: ['clam', 'clam', 'clam', 'clam', 'clam'],
    crackedShells: [],
    dropHistory: []
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function sanitize(raw) {
    const base = clone(DEFAULT_STATE);
    if (!raw || typeof raw !== 'object') return base;

    base.playTime = Number.isFinite(raw.playTime) ? Math.max(0, raw.playTime) : 0;
    base.napCount = Number.isFinite(raw.napCount) ? Math.max(0, raw.napCount) : 0;
    base.cameraStage = raw.cameraStage === 'low' ? 'low' : 'diagonal';
    base.scallopUnlocked = Boolean(raw.scallopUnlocked);
    base.rockOtterUnlocked = Boolean(raw.rockOtterUnlocked);

    if (raw.mom && typeof raw.mom === 'object') {
      base.mom.x = Number.isFinite(raw.mom.x) ? Math.max(-1.6, Math.min(1.2, raw.mom.x)) : base.mom.x;
      base.mom.z = Number.isFinite(raw.mom.z) ? Math.max(-0.85, Math.min(0.95, raw.mom.z)) : base.mom.z;
      base.mom.yaw = Number.isFinite(raw.mom.yaw) ? raw.mom.yaw : base.mom.yaw;
      base.mom.hasStone = Boolean(raw.mom.hasStone);
      base.mom.fedCount = Number.isFinite(raw.mom.fedCount) ? Math.max(0, raw.mom.fedCount) : 0;
      base.mom.crackedCount = Number.isFinite(raw.mom.crackedCount) ? Math.max(0, raw.mom.crackedCount) : 0;
      base.mom.sharedCount = Number.isFinite(raw.mom.sharedCount) ? Math.max(0, raw.mom.sharedCount) : 0;
      base.mom.kelpWrapped = Boolean(raw.mom.kelpWrapped);
      base.mom.sleeping = Boolean(raw.mom.sleeping);
    }

    if (raw.baby && typeof raw.baby === 'object') {
      base.baby.carrier = raw.baby.carrier === 'kelp' ? 'kelp' : 'mom';
    }

    if (raw.rockOtter && typeof raw.rockOtter === 'object') {
      base.rockOtter.active = Boolean(raw.rockOtter.active);
      base.rockOtter.x = Number.isFinite(raw.rockOtter.x) ? raw.rockOtter.x : base.rockOtter.x;
      base.rockOtter.z = Number.isFinite(raw.rockOtter.z) ? raw.rockOtter.z : base.rockOtter.z;
      base.rockOtter.yaw = Number.isFinite(raw.rockOtter.yaw) ? raw.rockOtter.yaw : base.rockOtter.yaw;
      base.rockOtter.fedCount = Number.isFinite(raw.rockOtter.fedCount) ? Math.max(0, raw.rockOtter.fedCount) : 0;
      base.rockOtter.sleeping = Boolean(raw.rockOtter.sleeping);
      base.rockOtter.waitBias = Number.isFinite(raw.rockOtter.waitBias) ? raw.rockOtter.waitBias : 0;
    }

    if (raw.stone && typeof raw.stone === 'object') {
      base.stone.location = raw.stone.location === 'mom_belly' ? 'mom_belly' : 'bottom';
      base.stone.x = Number.isFinite(raw.stone.x) ? Math.max(-1.4, Math.min(1.4, raw.stone.x)) : base.stone.x;
      base.stone.y = Number.isFinite(raw.stone.y) ? raw.stone.y : base.stone.y;
      base.stone.z = Number.isFinite(raw.stone.z) ? Math.max(-0.6, Math.min(1.3, raw.stone.z)) : base.stone.z;
    }

    if (Array.isArray(raw.bucketShells)) {
      const valid = raw.bucketShells.filter(t => t === 'clam' || t === 'scallop').slice(0, 7);
      base.bucketShells = valid;
    }
    // Always ensure next playable shells remain in the bucket
    while (base.bucketShells.length < 3) {
      base.bucketShells.push(base.scallopUnlocked && base.bucketShells.length === 2 ? 'scallop' : 'clam');
    }
    if (base.scallopUnlocked && !base.bucketShells.includes('scallop')) {
      base.bucketShells.push('scallop');
    }

    if (Array.isArray(raw.crackedShells)) {
      base.crackedShells = raw.crackedShells.slice(-36).map(item => ({
        type: item.type === 'scallop' ? 'scallop' : 'clam',
        x: Number.isFinite(item.x) ? item.x : 0,
        y: Number.isFinite(item.y) ? item.y : -1.58,
        z: Number.isFinite(item.z) ? item.z : 0,
        ry: Number.isFinite(item.ry) ? item.ry : 0,
        floating: Boolean(item.floating)
      }));
    }

    if (Array.isArray(raw.dropHistory)) {
      base.dropHistory = raw.dropHistory.slice(-24).map(d => ({
        x: Number.isFinite(d.x) ? d.x : 0,
        z: Number.isFinite(d.z) ? d.z : 0,
        zone: d.zone === 'rock' ? 'rock' : 'water',
        type: d.type === 'scallop' ? 'scallop' : 'clam'
      }));
    }

    return base;
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_STATE);
      return sanitize(JSON.parse(raw));
    } catch (_) {
      return clone(DEFAULT_STATE);
    }
  }

  function save(state) {
    try {
      const clean = sanitize(state);
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (_) {
      // Ignore storage quota or private mode failures
    }
  }

  global.OtterStorage = {
    load,
    save,
    DEFAULT_STATE
  };
})(window);
