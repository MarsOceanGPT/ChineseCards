/* World War Mouse — a mouse soldier vs. the cat army */
(function () {
  'use strict';

  // ---------- constants ----------
  var MAP_X = 65;            // half-width of the battlefield
  var MAP_Z_MIN = -115, MAP_Z_MAX = 100;
  var PLAYER_SPEED = 12, SPRINT_SPEED = 19;
  var PLAYER_RADIUS = 0.6;
  var PLAYER_MAX_HP = 100;
  var ROCKET_SPEED = 45, ROCKET_DAMAGE = 40, ROCKET_SPLASH = 4.5;
  var SHELL_SPEED = 26;
  var AMMO_PER_PICKUP = 4;
  var TANK_HP = 100, SOLDIER_HP = 20, KING_HP = 400;
  var SOLDIER_SPEED = 6.2, SOLDIER_DAMAGE = 8, SOLDIER_RANGE = 2.4;
  var MAX_SOLDIERS = 9;

  // ---------- deterministic rng for level layout ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // ---------- renderer / scene ----------
  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x87b5e0, 60, 220);

  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  scene.add(new THREE.AmbientLight(0xbfd4ff, 0.55));
  var sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sun.position.set(40, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
  sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
  sun.shadow.camera.far = 300;
  scene.add(sun);

  // ---------- ground ----------
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * MAP_X + 60, MAP_Z_MAX - MAP_Z_MIN + 80),
    new THREE.MeshLambertMaterial({ color: 0x5c8a3c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (MAP_Z_MIN + MAP_Z_MAX) / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // dirt path down the middle toward the castle
  var path = new THREE.Mesh(
    new THREE.PlaneGeometry(8, MAP_Z_MAX - MAP_Z_MIN),
    new THREE.MeshLambertMaterial({ color: 0x8a6f45 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, (MAP_Z_MIN + MAP_Z_MAX) / 2);
  scene.add(path);

  // ---------- obstacles (AABB colliders) ----------
  var obstacles = []; // {x, z, hx, hz, h}

  function addObstacleCollider(x, z, hx, hz) {
    obstacles.push({ x: x, z: z, hx: hx, hz: hz });
  }

  function makeCrate(x, z, s, rng) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshLambertMaterial({ color: 0x9c7440 })
    );
    m.castShadow = true; m.receiveShadow = true;
    m.position.y = s / 2;
    g.add(m);
    var band = new THREE.Mesh(
      new THREE.BoxGeometry(s + 0.06, s * 0.18, s + 0.06),
      new THREE.MeshLambertMaterial({ color: 0x6e4f28 })
    );
    band.position.y = s / 2;
    g.add(band);
    g.position.set(x, 0, z);
    g.rotation.y = rng() * 0.5 - 0.25;
    scene.add(g);
    addObstacleCollider(x, z, s * 0.62, s * 0.62);
  }

  function makeRock(x, z, s) {
    var m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      new THREE.MeshLambertMaterial({ color: 0x8a8a86 })
    );
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(x, s * 0.55, z);
    m.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(m);
    addObstacleCollider(x, z, s * 0.85, s * 0.85);
  }

  function makeBarrier(x, z, w, rotY) {
    var g = new THREE.Group();
    var wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, 1.4, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x7d7a70 })
    );
    wall.castShadow = true; wall.receiveShadow = true;
    wall.position.y = 0.7;
    g.add(wall);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    if (Math.abs(Math.sin(rotY)) > 0.5) addObstacleCollider(x, z, 0.6, w / 2);
    else addObstacleCollider(x, z, w / 2, 0.6);
  }

  // ---------- castle ----------
  var stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a948c });
  function castleWall(x, z, w, d, h) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    addObstacleCollider(x, z, w / 2, d / 2);
  }
  function castleTower(x, z) {
    var t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 14, 10), stoneMat);
    t.position.set(x, 7, z);
    t.castShadow = true; t.receiveShadow = true;
    scene.add(t);
    var roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.6, 4, 10),
      new THREE.MeshLambertMaterial({ color: 0x7a2f2f })
    );
    roof.position.set(x, 16, z);
    roof.castShadow = true;
    scene.add(roof);
    addObstacleCollider(x, z, 3.2, 3.2);
  }

  // castle courtyard centered at (0, -95), gate opening faces +z (toward player)
  var CASTLE_Z = -95;
  castleWall(-16, CASTLE_Z + 20, 20, 2, 9);   // front-left of gate
  castleWall(16, CASTLE_Z + 20, 20, 2, 9);    // front-right of gate
  castleWall(-25, CASTLE_Z - 2, 2, 42, 9);    // left wall
  castleWall(25, CASTLE_Z - 2, 2, 42, 9);     // right wall
  castleWall(0, CASTLE_Z - 22, 52, 2, 9);     // back wall
  castleTower(-25, CASTLE_Z + 20);
  castleTower(25, CASTLE_Z + 20);
  castleTower(-25, CASTLE_Z - 22);
  castleTower(25, CASTLE_Z - 22);

  // ---------- particles ----------
  var MAX_PARTICLES = 3000;
  var pPos = new Float32Array(MAX_PARTICLES * 3);
  var pCol = new Float32Array(MAX_PARTICLES * 3);
  var particles = []; // {i, vel:Vector3, life, maxLife, gravity}
  var pFree = [];
  for (var i = MAX_PARTICLES - 1; i >= 0; i--) { pFree.push(i); pPos[i * 3 + 1] = -1000; }
  var pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  var pPoints = new THREE.Points(pGeom, new THREE.PointsMaterial({
    size: 0.45, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  pPoints.frustumCulled = false;
  scene.add(pPoints);

  function spawnParticle(pos, vel, color, life, gravity) {
    if (!pFree.length) return;
    var idx = pFree.pop();
    pPos[idx * 3] = pos.x; pPos[idx * 3 + 1] = pos.y; pPos[idx * 3 + 2] = pos.z;
    pCol[idx * 3] = color.r; pCol[idx * 3 + 1] = color.g; pCol[idx * 3 + 2] = color.b;
    particles.push({ i: idx, vel: vel, life: life, maxLife: life, gravity: gravity });
  }

  var tmpColor = new THREE.Color();
  function fireworkExplosion(pos, big) {
    var count = big ? 90 : 55;
    var hue = Math.random();
    for (var k = 0; k < count; k++) {
      var dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      var speed = (big ? 14 : 10) * (0.4 + Math.random() * 0.6);
      tmpColor.setHSL((hue + Math.random() * 0.15) % 1, 1, 0.55 + Math.random() * 0.25);
      spawnParticle(pos.clone(), dir.multiplyScalar(speed),
        tmpColor.clone(), 0.6 + Math.random() * 0.5, 9);
    }
  }

  function updateParticles(dt) {
    for (var k = particles.length - 1; k >= 0; k--) {
      var p = particles[k];
      p.life -= dt;
      var idx = p.i;
      if (p.life <= 0) {
        pPos[idx * 3 + 1] = -1000;
        pFree.push(idx);
        particles.splice(k, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      pPos[idx * 3] += p.vel.x * dt;
      pPos[idx * 3 + 1] += p.vel.y * dt;
      pPos[idx * 3 + 2] += p.vel.z * dt;
      var fade = p.life / p.maxLife;
      pCol[idx * 3] *= (0.9 + 0.1 * fade);
      pCol[idx * 3 + 1] *= (0.9 + 0.1 * fade);
      pCol[idx * 3 + 2] *= (0.9 + 0.1 * fade);
    }
    pGeom.attributes.position.needsUpdate = true;
    pGeom.attributes.color.needsUpdate = true;
  }

  // ---------- audio (tiny synth, no assets) ----------
  var audioCtx = null;
  function audio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    }
    return audioCtx;
  }
  function playNoise(duration, volume, filterFreq) {
    var ctx = audio(); if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * duration);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var k = 0; k < len; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = filterFreq;
    var gain = ctx.createGain(); gain.gain.value = volume;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start();
  }
  function playTone(freq, endFreq, duration, volume, type) {
    var ctx = audio(); if (!ctx) return;
    var osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), ctx.currentTime + duration);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  }
  var sfx = {
    shoot: function () { playNoise(0.25, 0.25, 2500); playTone(600, 120, 0.3, 0.12, 'sawtooth'); },
    explode: function () { playNoise(0.5, 0.5, 900); playTone(160, 40, 0.4, 0.2, 'triangle'); },
    pickup: function () { playTone(500, 900, 0.12, 0.15, 'square'); playTone(900, 1400, 0.15, 0.12, 'square'); },
    hurt: function () { playTone(300, 90, 0.2, 0.2, 'sawtooth'); },
    meow: function () { playTone(700, 350, 0.35, 0.1, 'sawtooth'); },
    fanfare: function () {
      [523, 659, 784, 1047].forEach(function (f, k) {
        setTimeout(function () { playTone(f, f, 0.25, 0.15, 'square'); }, k * 160);
      });
    }
  };

  // ---------- player (mouse soldier) ----------
  var grayMat = new THREE.MeshLambertMaterial({ color: 0xa8a8b0 });
  var pinkMat = new THREE.MeshLambertMaterial({ color: 0xe8a0a8 });
  var helmetMat = new THREE.MeshLambertMaterial({ color: 0x4a5d34 });

  function buildMouse() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.9), grayMat);
    body.position.y = 0.75; body.castShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.6), grayMat);
    head.position.set(0, 1.35, -0.25); head.castShadow = true;
    g.add(head);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), pinkMat);
    nose.position.set(0, 1.3, -0.6);
    g.add(nose);
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), pinkMat);
      ear.rotation.x = Math.PI / 2;
      ear.position.set(s * 0.28, 1.72, -0.2);
      ear.castShadow = true;
      g.add(ear);
    });
    var helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.22, 12), helmetMat);
    helmet.position.set(0, 1.66, -0.25);
    helmet.castShadow = true;
    g.add(helmet);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.9), pinkMat);
    tail.position.set(0, 0.55, 0.85);
    tail.rotation.x = 0.35;
    g.add(tail);
    // firework launcher on the shoulder (visible when armed)
    var launcher = new THREE.Group();
    var tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: 0xb8462f })
    );
    tube.rotation.x = Math.PI / 2;
    launcher.add(tube);
    var tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.3, 10),
      new THREE.MeshLambertMaterial({ color: 0xffd23f })
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.7;
    launcher.add(tip);
    launcher.position.set(0.45, 1.35, 0);
    g.add(launcher);
    g.userData.launcher = launcher;
    return g;
  }

  var player = {
    mesh: buildMouse(),
    pos: new THREE.Vector3(0, 0, 92),
    hp: PLAYER_MAX_HP,
    ammo: 0,
    velX: 0, velZ: 0,
    yaw: 0,           // model faces -z natively; yaw 0 faces the castle
    lastHurt: -10,
    fireCooldown: 0
  };
  scene.add(player.mesh);

  // ---------- pickups ----------
  var pickups = [];
  var PICKUP_SPOTS = [
    [1.2, 86], [-18, 70], [24, 58], [-34, 38], [14, 24],
    [-8, 2], [30, -18], [-28, -38], [6, -56], [-14, -70], [34, -62], [0, CASTLE_Z + 12]
  ];

  function buildFireworkPickup(x, z) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.9, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9452f })
    );
    body.position.y = 0.45; body.castShadow = true;
    g.add(body);
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xffd23f })
    );
    cone.position.y = 1.1; cone.castShadow = true;
    g.add(cone);
    var stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: 0xc9b28a })
    );
    stick.position.set(0.16, 0.5, 0);
    g.add(stick);
    var glow = new THREE.PointLight(0xffa040, 0.8, 6);
    glow.position.y = 1;
    g.add(glow);
    g.position.set(x, 0, z);
    scene.add(g);
    pickups.push({ mesh: g, x: x, z: z, t: Math.random() * 6 });
  }
  PICKUP_SPOTS.forEach(function (s) { buildFireworkPickup(s[0], s[1]); });

  // ---------- cat enemies ----------
  var furMat = new THREE.MeshLambertMaterial({ color: 0xd98e3c });
  var furDarkMat = new THREE.MeshLambertMaterial({ color: 0xb06f28 });
  var bellyMat = new THREE.MeshLambertMaterial({ color: 0xf2e3c8 });
  var trackMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  var metalMat = new THREE.MeshLambertMaterial({ color: 0x555c61 });

  function buildCatHead(scale) {
    // cat face with an open mouth holding the firework cannon
    var head = new THREE.Group();
    var skull = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 1.6 * scale, 1.8 * scale), furMat);
    skull.castShadow = true;
    head.add(skull);
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.4 * scale, 0.8 * scale, 4), furDarkMat);
      ear.position.set(s * 0.7 * scale, 1.1 * scale, 0);
      ear.castShadow = true;
      head.add(ear);
      var eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x30ff30, emissive: 0x104010 })
      );
      eye.position.set(s * 0.5 * scale, 0.25 * scale, -0.92 * scale);
      head.add(eye);
    });
    // open mouth (dark box) with cannon barrel inside
    var mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * scale, 0.6 * scale, 0.4 * scale),
      new THREE.MeshLambertMaterial({ color: 0x1a0d0d })
    );
    mouth.position.set(0, -0.4 * scale, -0.85 * scale);
    head.add(mouth);
    var barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * scale, 0.26 * scale, 2.2 * scale, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.4 * scale, -1.6 * scale);
    barrel.castShadow = true;
    head.add(barrel);
    head.userData.muzzleLocal = new THREE.Vector3(0, -0.4 * scale, -2.7 * scale);
    return head;
  }

  function buildCatTank(scale, isKing) {
    var g = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3.4 * scale, 1.4 * scale, 5 * scale),
      isKing ? new THREE.MeshLambertMaterial({ color: 0x7a4fa0 }) : furMat);
    hull.position.y = 1.1 * scale;
    hull.castShadow = true; hull.receiveShadow = true;
    g.add(hull);
    [-1, 1].forEach(function (s) {
      var track = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.9 * scale, 5.4 * scale), trackMat);
      track.position.set(s * 1.9 * scale, 0.45 * scale, 0);
      track.castShadow = true;
      g.add(track);
    });
    var belly = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 0.3 * scale, 3.6 * scale), bellyMat);
    belly.position.y = 1.85 * scale;
    g.add(belly);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.25 * scale, 2 * scale), furDarkMat);
    tail.position.set(0, 1.6 * scale, 3.2 * scale);
    tail.rotation.x = -0.4;
    g.add(tail);
    var head = buildCatHead(scale);
    head.position.set(0, 2.9 * scale, -1.2 * scale);
    g.add(head);
    g.userData.head = head;
    if (isKing) {
      var crown = new THREE.Group();
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * scale, 0.75 * scale, 0.3 * scale, 8),
        new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x332200 }));
      crown.add(band);
      for (var k = 0; k < 5; k++) {
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.5 * scale, 4),
          new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x332200 }));
        var a = (k / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.6 * scale, 0.35 * scale, Math.sin(a) * 0.6 * scale);
        crown.add(spike);
      }
      crown.position.set(0, 1.05 * scale, 0);
      head.add(crown);
    }
    return g;
  }

  function buildHpBar(width, yOffset) {
    var g = new THREE.Group();
    var bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x501010, depthTest: false, transparent: true }));
    var fg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x35d035, depthTest: false, transparent: true }));
    fg.position.z = 0.01;
    g.add(bg); g.add(fg);
    g.position.y = yOffset;
    g.userData.fg = fg;
    g.userData.width = width;
    g.renderOrder = 5;
    return g;
  }
  function setHpBar(bar, frac) {
    frac = Math.max(0, frac);
    bar.userData.fg.scale.x = Math.max(frac, 0.0001);
    bar.userData.fg.position.x = -bar.userData.width * (1 - frac) / 2;
  }

  var tanks = [];   // includes the king (isKing flag)
  var soldiers = [];

  function spawnTank(x, z, opts) {
    opts = opts || {};
    var isKing = !!opts.king;
    var scale = isKing ? 1.9 : 1;
    var mesh = buildCatTank(scale, isKing);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    var bar = buildHpBar(isKing ? 4 : 2.6, isKing ? 9.5 : 5.2);
    mesh.add(bar);
    var tank = {
      mesh: mesh, head: mesh.userData.head, bar: bar,
      x: x, z: z, scale: scale,
      hp: isKing ? KING_HP : TANK_HP,
      maxHp: isKing ? KING_HP : TANK_HP,
      isKing: isKing,
      headYaw: 0,
      fireTimer: 2 + Math.random() * 2,
      deployTimer: isKing ? 6 : 4 + Math.random() * 4,
      range: isKing ? 55 : 48,
      flash: 0,
      alive: true,
      mySoldiers: 0
    };
    tanks.push(tank);
    var collider = { x: x, z: z, hx: 2.4 * scale, hz: 3 * scale };
    obstacles.push(collider);
    tank.collider = collider;
    return tank;
  }

  spawnTank(-24, 44);
  spawnTank(22, 8);
  spawnTank(-14, -34);
  spawnTank(20, -62);
  var king = spawnTank(0, CASTLE_Z - 8, { king: true });

  function buildCatSoldier() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), furMat);
    body.position.y = 0.95; body.castShadow = true;
    g.add(body);
    var belly = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.06), bellyMat);
    belly.position.set(0, 0.9, -0.18);
    g.add(belly);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.42), furMat);
    head.position.y = 1.55; head.castShadow = true;
    g.add(head);
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 4), furDarkMat);
      ear.position.set(s * 0.15, 1.87, 0);
      g.add(ear);
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03),
        new THREE.MeshLambertMaterial({ color: 0x30ff30, emissive: 0x103010 }));
      eye.position.set(s * 0.12, 1.6, -0.22);
      g.add(eye);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), furDarkMat);
      arm.position.set(s * 0.37, 1.05, 0);
      g.add(arm);
    });
    var legs = [];
    [-1, 1].forEach(function (s) {
      var pivot = new THREE.Group();
      pivot.position.set(s * 0.16, 0.58, 0);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.16), furDarkMat);
      leg.position.y = -0.29;
      leg.castShadow = true;
      pivot.add(leg);
      g.add(pivot);
      legs.push(pivot);
    });
    g.userData.legs = legs;
    return g;
  }

  function spawnSoldier(x, z, fromTank) {
    if (soldiers.length >= MAX_SOLDIERS) return;
    var mesh = buildCatSoldier();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    var bar = buildHpBar(0.9, 2.2);
    mesh.add(bar);
    soldiers.push({
      mesh: mesh, bar: bar,
      pos: new THREE.Vector3(x, 0, z),
      hp: SOLDIER_HP,
      attackTimer: 0,
      walkT: Math.random() * 10,
      fromTank: fromTank || null
    });
    if (fromTank) fromTank.mySoldiers++;
    fireworkExplosion(new THREE.Vector3(x, 1, z), false);
  }

  // a couple of gate guards
  spawnSoldier(-4, CASTLE_Z + 24, null);
  spawnSoldier(4, CASTLE_Z + 24, null);

  // ---------- level scatter (crates, rocks, barriers) ----------
  var rng = mulberry32(20260731);
  function clearOfImportantSpots(x, z, minD) {
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < 10) return false;
    for (var k = 0; k < PICKUP_SPOTS.length; k++)
      if (Math.hypot(x - PICKUP_SPOTS[k][0], z - PICKUP_SPOTS[k][1]) < minD) return false;
    for (k = 0; k < tanks.length; k++)
      if (Math.hypot(x - tanks[k].x, z - tanks[k].z) < minD + 4) return false;
    if (z < CASTLE_Z + 22 && Math.abs(x) < 28) return false; // keep the courtyard clear
    if (Math.abs(x) < 5 && z > CASTLE_Z + 18) return false;  // keep the main path clear
    return true;
  }
  for (var n = 0; n < 46; n++) {
    var ox = (rng() * 2 - 1) * (MAP_X - 6);
    var oz = MAP_Z_MIN + 18 + rng() * (MAP_Z_MAX - MAP_Z_MIN - 28);
    if (!clearOfImportantSpots(ox, oz, 4)) continue;
    var kind = rng();
    if (kind < 0.5) makeCrate(ox, oz, 1.6 + rng() * 1.6, rng);
    else if (kind < 0.8) makeRock(ox, oz, 1.2 + rng() * 1.4);
    else makeBarrier(ox, oz, 4 + rng() * 3, rng() * Math.PI);
  }

  // ---------- projectiles ----------
  var projectiles = []; // {mesh, vel, friendly, life}

  function buildRocketMesh(friendly) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: friendly ? 0xd9452f : 0x333333, emissive: friendly ? 0x401008 : 0x111111 })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    var tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.22, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x403000 })
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.33;
    g.add(tip);
    return g;
  }

  function fireProjectile(origin, dir, friendly) {
    var mesh = buildRocketMesh(friendly);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(dir));
    scene.add(mesh);
    projectiles.push({
      mesh: mesh,
      vel: dir.clone().multiplyScalar(friendly ? ROCKET_SPEED : SHELL_SPEED),
      friendly: friendly,
      life: 4,
      age: 0   // obstacle collision arms after a moment so shells clear their own tank
    });
  }

  function pointHitsObstacle(x, z, pad) {
    for (var k = 0; k < obstacles.length; k++) {
      var o = obstacles[k];
      if (Math.abs(x - o.x) < o.hx + pad && Math.abs(z - o.z) < o.hz + pad) return true;
    }
    return false;
  }

  function explode(pos, friendly) {
    fireworkExplosion(pos, !friendly);
    sfx.explode();
    shake = Math.min(shake + (friendly ? 0.15 : 0.3), 0.6);
    if (friendly) {
      // damage cats
      tanks.forEach(function (t) {
        if (!t.alive) return;
        var d = Math.hypot(pos.x - t.x, pos.z - t.z);
        var r = ROCKET_SPLASH + t.scale * 2;
        if (d < r) damageTank(t, ROCKET_DAMAGE);
      });
      for (var k = soldiers.length - 1; k >= 0; k--) {
        var s = soldiers[k];
        if (pos.distanceTo(s.pos.clone().setY(pos.y)) < ROCKET_SPLASH + 1) {
          s.hp -= ROCKET_DAMAGE;
          if (s.hp <= 0) killSoldier(k);
          else setHpBar(s.bar, s.hp / SOLDIER_HP);
        }
      }
    } else {
      var d = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
      if (d < ROCKET_SPLASH + 1.5) {
        var dmg = Math.round(20 * (1 - d / (ROCKET_SPLASH + 1.5)) + 5);
        hurtPlayer(dmg);
      }
    }
  }

  function damageTank(t, dmg) {
    t.hp -= dmg;
    t.flash = 0.15;
    setHpBar(t.bar, t.hp / t.maxHp);
    if (t.hp <= 0 && t.alive) {
      t.alive = false;
      var p = new THREE.Vector3(t.x, 2.5 * t.scale, t.z);
      fireworkExplosion(p, true);
      fireworkExplosion(p.clone().add(new THREE.Vector3(1, 1, 0)), true);
      sfx.explode();
      scene.remove(t.mesh);
      var ci = obstacles.indexOf(t.collider);
      if (ci >= 0) obstacles.splice(ci, 1);
      if (t.isKing) winGame();
      else {
        var left = tanks.filter(function (x) { return x.alive && !x.isKing; }).length;
        showMessage(left > 0
          ? 'Cat tank destroyed! ' + left + ' more guarding the way.'
          : 'All field tanks down! Storm the castle and defeat the CAT KING!', 3.5);
      }
    }
  }

  function killSoldier(idx) {
    var s = soldiers[idx];
    fireworkExplosion(s.pos.clone().setY(1.2), false);
    if (s.fromTank) s.fromTank.mySoldiers--;
    scene.remove(s.mesh);
    soldiers.splice(idx, 1);
  }

  // ---------- input ----------
  var keys = {};
  var pitch = 0;
  var pointerLocked = false;

  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if ((e.code === 'Space' || e.code === 'Enter') && state === 'playing') {
      e.preventDefault();
      tryShoot();
    }
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  function requestLock() {
    if (IS_TOUCH || !canvas.requestPointerLock) return;
    try { canvas.requestPointerLock(); } catch (e) { }
  }
  document.addEventListener('pointerlockchange', function () {
    pointerLocked = document.pointerLockElement === canvas;
    if (state === 'playing' && !pointerLocked && !IS_TOUCH) {
      state = 'paused';
      show('pause-screen');
    }
  });
  function applyAim(dx, dy, sens) {
    player.yaw -= dx * sens;
    pitch += dy * sens;
    pitch = Math.max(-0.55, Math.min(0.9, pitch));
  }
  document.addEventListener('mousemove', function (e) {
    if (!pointerLocked || state !== 'playing') return;
    applyAim(e.movementX, e.movementY, 0.0023);
  });
  var dragAim = null; // fallback aiming when pointer lock is unavailable
  canvas.addEventListener('mousedown', function (e) {
    if (state !== 'playing' || e.button !== 0) return;
    if (pointerLocked) { tryShoot(); return; }
    requestLock();
    dragAim = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragAim || pointerLocked || state !== 'playing') return;
    var dx = e.clientX - dragAim.x, dy = e.clientY - dragAim.y;
    dragAim.moved += Math.abs(dx) + Math.abs(dy);
    dragAim.x = e.clientX; dragAim.y = e.clientY;
    applyAim(dx, dy, 0.0045);
  });
  document.addEventListener('mouseup', function (e) {
    if (dragAim && !pointerLocked && state === 'playing' && dragAim.moved < 6) {
      tryShoot(enemyTargetAt(e.clientX, e.clientY));
    }
    dragAim = null;
  });

  // ---------- touch controls ----------
  var touchUi = document.getElementById('touch-ui');
  var joystickEl = document.getElementById('joystick');
  var knobEl = document.getElementById('joystick-knob');
  var fireBtn = document.getElementById('fire-btn');
  var joy = { id: null, baseX: 0, baseY: 0, x: 0, y: 0 };   // x,y in [-1,1]
  var aimTouch = { id: null, lastX: 0, lastY: 0, moved: 0, startT: 0 };
  var fireHeld = false;

  if (IS_TOUCH) {
    var controlsLine = document.getElementById('controls-line');
    if (controlsLine) controlsLine.textContent = 'LEFT STICK — move  |  DRAG — aim  |  TAP A CAT — fire at it  |  🎆 — fire';

    joystickEl.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      var r = joystickEl.getBoundingClientRect();
      joy.id = t.identifier;
      joy.baseX = r.left + r.width / 2;
      joy.baseY = r.top + r.height / 2;
    }, { passive: false });

    fireBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      fireHeld = true;
      tryShoot();
    }, { passive: false });
    fireBtn.addEventListener('touchend', function (e) { e.preventDefault(); fireHeld = false; }, { passive: false });

    document.addEventListener('touchstart', function (e) {
      if (state !== 'playing') return;
      for (var k = 0; k < e.changedTouches.length; k++) {
        var t = e.changedTouches[k];
        if (t.identifier === joy.id) continue;
        if (t.target === fireBtn || t.target === joystickEl || t.target === knobEl) continue;
        if (aimTouch.id === null) {
          aimTouch.id = t.identifier;
          aimTouch.lastX = t.clientX; aimTouch.lastY = t.clientY;
          aimTouch.moved = 0; aimTouch.startT = performance.now();
        }
      }
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
      if (state !== 'playing') return;
      e.preventDefault();
      for (var k = 0; k < e.changedTouches.length; k++) {
        var t = e.changedTouches[k];
        if (t.identifier === joy.id) {
          var dx = t.clientX - joy.baseX, dy = t.clientY - joy.baseY;
          var len = Math.hypot(dx, dy), max = 52;
          if (len > max) { dx = dx / len * max; dy = dy / len * max; }
          joy.x = dx / max; joy.y = dy / max;
          knobEl.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        } else if (t.identifier === aimTouch.id) {
          aimTouch.moved += Math.abs(t.clientX - aimTouch.lastX) + Math.abs(t.clientY - aimTouch.lastY);
          applyAim(t.clientX - aimTouch.lastX, t.clientY - aimTouch.lastY, 0.004);
          aimTouch.lastX = t.clientX; aimTouch.lastY = t.clientY;
        }
      }
    }, { passive: false });

    var endTouch = function (e) {
      for (var k = 0; k < e.changedTouches.length; k++) {
        var t = e.changedTouches[k];
        if (t.identifier === joy.id) {
          joy.id = null; joy.x = 0; joy.y = 0;
          knobEl.style.transform = 'translate(-50%, -50%)';
        }
        if (t.identifier === aimTouch.id) {
          // quick tap on a cat = fire a rocket straight at it
          if (state === 'playing' && aimTouch.moved < 14 && performance.now() - aimTouch.startT < 400) {
            var target = enemyTargetAt(t.clientX, t.clientY);
            if (target) tryShoot(target);
          }
          aimTouch.id = null;
        }
      }
    };
    document.addEventListener('touchend', endTouch);
    document.addEventListener('touchcancel', endTouch);
  }

  // find an enemy under (or near) a screen point; returns a world-space aim target
  var raycaster = new THREE.Raycaster();
  function enemyTargetAt(clientX, clientY) {
    var ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    var meshes = [];
    tanks.forEach(function (t) { if (t.alive) meshes.push(t.mesh); });
    soldiers.forEach(function (s) { meshes.push(s.mesh); });
    var hits = raycaster.intersectObjects(meshes, true);
    if (hits.length) return hits[0].point.clone();
    // near-miss assist: aim at the enemy whose center is closest on screen
    var best = null, bestD = 90;
    function consider(x, y, z) {
      var v = new THREE.Vector3(x, y, z).project(camera);
      if (v.z > 1) return;
      var sx = (v.x + 1) / 2 * window.innerWidth;
      var sy = (-v.y + 1) / 2 * window.innerHeight;
      var d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = new THREE.Vector3(x, y, z); }
    }
    tanks.forEach(function (t) { if (t.alive) consider(t.x, 2.4 * t.scale, t.z); });
    soldiers.forEach(function (s) { consider(s.pos.x, 1.1, s.pos.z); });
    return best;
  }

  function tryShoot(targetPos) {
    if (player.fireCooldown > 0) return;
    if (player.ammo <= 0) {
      showMessage('No fireworks! Find more on the battlefield.', 1.6);
      return;
    }
    player.ammo--;
    player.fireCooldown = 0.45;
    var muzzle = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    var shootDir;
    if (!targetPos) {
      // aim assist: snap to an enemy near the crosshair
      targetPos = enemyTargetAt(window.innerWidth / 2, window.innerHeight / 2);
    }
    if (targetPos) {
      shootDir = targetPos.clone().sub(muzzle).normalize();
    } else {
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      var far = camera.position.clone().add(dir.multiplyScalar(120));
      shootDir = far.sub(muzzle).normalize();
    }
    muzzle.add(shootDir.clone().multiplyScalar(1.0));
    fireProjectile(muzzle, shootDir, true);
    // launch spray from the muzzle
    for (var k = 0; k < 18; k++) {
      var sprayDir = shootDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8
      )).normalize().multiplyScalar(4 + Math.random() * 7);
      tmpColor.setHSL(0.07 + Math.random() * 0.08, 1, 0.55 + Math.random() * 0.35);
      spawnParticle(muzzle.clone(), sprayDir, tmpColor.clone(), 0.35 + Math.random() * 0.3, 7);
    }
    sfx.shoot();
    shake = Math.min(shake + 0.08, 0.5);
    updateHud();
  }

  // ---------- collision helper ----------
  function collideCircle(pos, radius) {
    for (var k = 0; k < obstacles.length; k++) {
      var o = obstacles[k];
      var cx = Math.max(o.x - o.hx, Math.min(pos.x, o.x + o.hx));
      var cz = Math.max(o.z - o.hz, Math.min(pos.z, o.z + o.hz));
      var dx = pos.x - cx, dz = pos.z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        var d = Math.sqrt(d2);
        if (d < 1e-5) { pos.x += radius; continue; }
        var push = (radius - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
    pos.x = Math.max(-MAP_X, Math.min(MAP_X, pos.x));
    pos.z = Math.max(MAP_Z_MIN, Math.min(MAP_Z_MAX, pos.z));
  }

  // ---------- HUD ----------
  var healthBar = document.getElementById('health-bar');
  var ammoCount = document.getElementById('ammo-count');
  var messageEl = document.getElementById('message');
  var kingWrap = document.getElementById('king-hp-wrap');
  var kingBar = document.getElementById('king-hp');
  var damageFlash = document.getElementById('damage-flash');
  var messageTimer = 0;

  function updateHud() {
    healthBar.style.width = Math.max(0, (player.hp / PLAYER_MAX_HP) * 100) + '%';
    ammoCount.innerHTML = '&#128640; ' + player.ammo;
    if (king.alive && Math.hypot(player.pos.x - king.x, player.pos.z - king.z) < 65) {
      kingWrap.classList.remove('hidden');
      kingBar.style.width = Math.max(0, (king.hp / king.maxHp) * 100) + '%';
    } else {
      kingWrap.classList.add('hidden');
    }
  }

  function showMessage(text, secs) {
    messageEl.textContent = text;
    messageEl.style.opacity = '1';
    messageTimer = secs;
  }

  function hurtPlayer(dmg) {
    if (state !== 'playing') return;
    player.hp -= dmg;
    player.lastHurt = elapsed;
    sfx.hurt();
    damageFlash.style.opacity = '1';
    setTimeout(function () { damageFlash.style.opacity = '0'; }, 130);
    shake = Math.min(shake + 0.25, 0.6);
    updateHud();
    if (player.hp <= 0) loseGame();
  }

  // ---------- screens / state ----------
  var state = 'start'; // start | playing | paused | won | lost
  function show(id) {
    ['start-screen', 'pause-screen', 'gameover-screen', 'victory-screen'].forEach(function (s) {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }
  function hideAll() { show('__none__'); }

  document.getElementById('start-btn').addEventListener('click', function () {
    state = 'playing';
    hideAll();
    requestLock();
    audio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (IS_TOUCH) touchUi.classList.remove('hidden');
    showMessage('Grab the firework next to you — you will need it!', 4);
  });
  document.getElementById('resume-btn').addEventListener('click', function () {
    state = 'playing';
    hideAll();
    requestLock();
  });
  document.getElementById('retry-btn').addEventListener('click', function () { location.reload(); });
  document.getElementById('again-btn').addEventListener('click', function () { location.reload(); });

  var victoryTimer = 0;
  function winGame() {
    state = 'won';
    victoryTimer = 0;
    fireHeld = false;
    sfx.fanfare();
    if (document.exitPointerLock) document.exitPointerLock();
    touchUi.classList.add('hidden');
    show('victory-screen');
  }
  function loseGame() {
    state = 'lost';
    fireHeld = false;
    sfx.meow();
    if (document.exitPointerLock) document.exitPointerLock();
    touchUi.classList.add('hidden');
    show('gameover-screen');
  }

  // ---------- update ----------
  var shake = 0;
  var elapsed = 0;
  var tmpV = new THREE.Vector3();

  function updatePlayer(dt) {
    var speed = (keys.ShiftLeft || keys.ShiftRight) ? SPRINT_SPEED : PLAYER_SPEED;
    var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);   // forward
    var rx = -fz, rz = fx;                                        // right
    var mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
    if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
    if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
    if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
    var len = Math.hypot(mx, mz);
    var joyLen = Math.hypot(joy.x, joy.y);
    if (len === 0 && joyLen > 0.12) {
      // joystick: up = forward, right = strafe right; full deflection sprints
      mx = fx * -joy.y + rx * joy.x;
      mz = fz * -joy.y + rz * joy.x;
      len = Math.hypot(mx, mz);
      speed = joyLen > 0.92 ? SPRINT_SPEED : PLAYER_SPEED * Math.min(1, joyLen * 1.15);
    }
    // ease velocity toward the input so movement ramps instead of snapping
    var tvx = len > 0 ? (mx / len) * speed : 0;
    var tvz = len > 0 ? (mz / len) * speed : 0;
    var ease = 1 - Math.exp(-9 * dt);
    player.velX += (tvx - player.velX) * ease;
    player.velZ += (tvz - player.velZ) * ease;
    player.pos.x += player.velX * dt;
    player.pos.z += player.velZ * dt;
    if (fireHeld) tryShoot();
    collideCircle(player.pos, PLAYER_RADIUS);

    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.yaw;
    player.mesh.userData.launcher.visible = player.ammo > 0;
    // little hop while running
    var moving = Math.hypot(player.velX, player.velZ) > 1;
    player.mesh.position.y = moving ? Math.abs(Math.sin(elapsed * 10)) * 0.12 : 0;

    player.fireCooldown = Math.max(0, player.fireCooldown - dt);

    // slow regen after 6s without damage
    if (player.hp < PLAYER_MAX_HP && elapsed - player.lastHurt > 6) {
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 2.5 * dt);
    }

    // over-shoulder camera: crosshair follows the true aim direction
    // (pitch 0 = level with the horizon, positive pitch = look down)
    var camDist = 6.5;
    var cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    var ax = -Math.sin(player.yaw) * cosP, ay = -sinP, az = -Math.cos(player.yaw) * cosP;
    var rvx = Math.cos(player.yaw), rvz = -Math.sin(player.yaw);
    var hx = player.pos.x + rvx * 0.9;
    var hy = player.pos.y + 1.9;
    var hz = player.pos.z + rvz * 0.9;
    camera.position.set(hx - ax * camDist, hy - ay * camDist + 0.5, hz - az * camDist);
    if (camera.position.y < 0.4) camera.position.y = 0.4;
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 1.5);
    }
    camera.lookAt(hx + ax * 12, hy + ay * 12, hz + az * 12);
  }

  function updatePickups(dt) {
    for (var k = pickups.length - 1; k >= 0; k--) {
      var p = pickups[k];
      p.t += dt;
      p.mesh.position.y = 0.15 + Math.sin(p.t * 2.5) * 0.12;
      p.mesh.rotation.y += dt * 1.5;
      if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 1.9) {
        player.ammo += AMMO_PER_PICKUP;
        sfx.pickup();
        showMessage('Picked up fireworks! +' + AMMO_PER_PICKUP + ' rockets', 2);
        scene.remove(p.mesh);
        pickups.splice(k, 1);
        updateHud();
      }
    }
  }

  function updateTanks(dt) {
    tanks.forEach(function (t) {
      if (!t.alive) return;
      if (t.flash > 0) {
        t.flash -= dt;
        t.mesh.traverse(function (o) {
          if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = t.flash > 0 ? 3 : 1;
        });
      }
      var dx = player.pos.x - t.x, dz = player.pos.z - t.z;
      var dist = Math.hypot(dx, dz);
      if (dist > t.range) return;

      // rotate cat head toward the player
      var targetYaw = Math.atan2(-dx, -dz);
      var diff = targetYaw - t.headYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t.headYaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      t.head.rotation.y = t.headYaw;

      // fire firework shells from the mouth cannon
      t.fireTimer -= dt;
      if (t.fireTimer <= 0 && Math.abs(diff) < 0.25) {
        t.fireTimer = t.isKing ? 2.2 : 3.2 + Math.random();
        var muzzle = t.head.localToWorld(t.head.userData.muzzleLocal.clone());
        var aim = new THREE.Vector3(
          player.pos.x + (Math.random() - 0.5) * 3,
          1.2,
          player.pos.z + (Math.random() - 0.5) * 3
        ).sub(muzzle).normalize();
        fireProjectile(muzzle, aim, false);
        if (t.isKing) {
          // king fires a spread of three
          [-0.18, 0.18].forEach(function (a) {
            var rot = aim.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
            fireProjectile(muzzle.clone(), rot, false);
          });
        }
        sfx.shoot();
        // muzzle sparks
        for (var s = 0; s < 8; s++) {
          spawnParticle(muzzle.clone(),
            aim.clone().multiplyScalar(6).add(new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(3)),
            new THREE.Color(0xffcc66), 0.3, 4);
        }
      }

      // deploy cat soldiers from the rear hatch
      t.deployTimer -= dt;
      if (t.deployTimer <= 0) {
        t.deployTimer = t.isKing ? 9 : 8 + Math.random() * 3;
        if (t.mySoldiers < 3 && soldiers.length < MAX_SOLDIERS) {
          spawnSoldier(t.x + (Math.random() - 0.5) * 3, t.z + 4 * t.scale, t);
          sfx.meow();
        }
      }
    });
  }

  function updateSoldiers(dt) {
    for (var k = soldiers.length - 1; k >= 0; k--) {
      var s = soldiers[k];
      var dx = player.pos.x - s.pos.x, dz = player.pos.z - s.pos.z;
      var dist = Math.hypot(dx, dz);
      if (dist > 90) continue;
      s.mesh.rotation.y = Math.atan2(-dx, -dz);
      if (dist > SOLDIER_RANGE * 0.8) {
        s.pos.x += (dx / dist) * SOLDIER_SPEED * dt;
        s.pos.z += (dz / dist) * SOLDIER_SPEED * dt;
        collideCircle(s.pos, 0.4);
        s.walkT += dt * 11;
        var swing = Math.sin(s.walkT) * 0.6;
        s.mesh.userData.legs[0].rotation.x = swing;
        s.mesh.userData.legs[1].rotation.x = -swing;
      }
      s.attackTimer -= dt;
      if (dist < SOLDIER_RANGE && s.attackTimer <= 0) {
        s.attackTimer = 1.1;
        hurtPlayer(SOLDIER_DAMAGE);
        sfx.meow();
        // scratch lunge
        s.pos.x += (dx / dist) * 0.4;
        s.pos.z += (dz / dist) * 0.4;
      }
      s.mesh.position.copy(s.pos);
    }
  }

  function updateProjectiles(dt) {
    for (var k = projectiles.length - 1; k >= 0; k--) {
      var p = projectiles[k];
      p.life -= dt;
      p.age += dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      var pos = p.mesh.position;

      // firework spark spray: a shower of embers streaming behind the rocket
      var sparkCount = p.friendly ? 4 : 2;
      for (var sp = 0; sp < sparkCount; sp++) {
        var along = pos.clone().addScaledVector(p.vel, -dt * Math.random()); // fill the gap between frames
        var backVel = p.vel.clone().multiplyScalar(-0.06).add(new THREE.Vector3(
          (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5
        ));
        var roll = Math.random();
        if (roll < 0.55) tmpColor.setHSL(0.07 + Math.random() * 0.06, 1, 0.55 + Math.random() * 0.2);      // gold/orange
        else if (roll < 0.85) tmpColor.setHSL(0.12, 0.9, 0.75);                                             // bright yellow
        else tmpColor.setRGB(1, 1, 1);                                                                      // white-hot
        spawnParticle(along, backVel, tmpColor.clone(), 0.35 + Math.random() * 0.35, 6);
      }

      var boom = false;
      if (p.life <= 0 || pos.y <= 0.15) boom = true;
      else if (p.age > 0.18 && pointHitsObstacle(pos.x, pos.z, 0.2) && pos.y < 10) boom = true;
      else if (p.friendly) {
        for (var j = 0; j < tanks.length; j++) {
          var t = tanks[j];
          if (t.alive && Math.hypot(pos.x - t.x, pos.z - t.z) < 2.8 * t.scale && pos.y < 5.5 * t.scale) { boom = true; break; }
        }
        if (!boom) {
          for (j = 0; j < soldiers.length; j++) {
            if (pos.distanceTo(soldiers[j].pos.clone().setY(pos.y)) < 0.9 && pos.y < 2.2) { boom = true; break; }
          }
        }
      } else {
        if (Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) < 1 && pos.y < 2.2) boom = true;
      }

      if (boom) {
        explode(pos.clone(), p.friendly);
        scene.remove(p.mesh);
        projectiles.splice(k, 1);
      }
    }
  }

  function updateHpBarBillboards() {
    tanks.forEach(function (t) {
      if (t.alive) t.bar.quaternion.copy(camera.quaternion);
    });
    soldiers.forEach(function (s) {
      s.bar.quaternion.copy(camera.quaternion);
    });
  }

  // celebration fireworks after victory
  function updateVictory(dt) {
    victoryTimer -= dt;
    if (victoryTimer <= 0) {
      victoryTimer = 0.4;
      fireworkExplosion(new THREE.Vector3(
        player.pos.x + (Math.random() - 0.5) * 40,
        10 + Math.random() * 14,
        player.pos.z + (Math.random() - 0.5) * 40
      ), true);
    }
  }

  // ---------- main loop ----------
  var lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (state === 'playing') {
      elapsed += dt;
      updatePlayer(dt);
      updatePickups(dt);
      updateTanks(dt);
      updateSoldiers(dt);
      updateProjectiles(dt);
      updateHud();
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.style.opacity = '0';
      }
    } else if (state === 'won') {
      updateVictory(dt);
    }
    updateParticles(dt);
    updateHpBarBillboards();
    renderer.render(scene, camera);
  }

  // aim camera at the battlefield for the start screen
  camera.position.set(0, 6, 104);
  camera.lookAt(0, 2, 60);
  updateHud();
  requestAnimationFrame(loop);

  // small debug/testing handle
  window.WWM = { player: player, tanks: tanks, soldiers: soldiers, king: king, camera: camera, getState: function () { return state; } };
})();
