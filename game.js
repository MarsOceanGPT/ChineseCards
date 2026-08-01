/* World War Mouse — a mouse soldier vs. the cat army */
(function () {
  'use strict';

  var IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // ---------- constants ----------
  var MAP_X = 65;
  var MAP_Z_MIN = -115, MAP_Z_MAX = 118;
  var PLAYER_SPEED = 12, SPRINT_SPEED = 19;
  var PLAYER_RADIUS = 0.6;
  var PLAYER_MAX_HP = 100;
  var GRAVITY = 26, JUMP_V = 10.2;
  var ROCKET_SPEED = 45, ROCKET_DAMAGE = 40, ROCKET_SPLASH = 4.5;
  var SEEKER_SPEED = 32, SEEKER_TURN = 4.5;
  var SHELL_SPEED = 26;
  var TANK_HP = 100, SOLDIER_HP = 20, KING_HP = 400;
  var SOLDIER_SPEED = 6.2, SOLDIER_DAMAGE = 8, SOLDIER_RANGE = 2.4;
  var GUARD_HP = 130, GUARD_DAMAGE = 20, GUARD_SPEED = 4.4;
  var MOUSE_KING_HP = 250;
  var MOUSE_GUARD_HP = 140, MOUSE_GUARD_DAMAGE = 24;
  var ALLY_HP = 40;
  var MAX_SOLDIERS = 9;
  var HOUSE_X = 0, HOUSE_Z = 106;
  var CASTLE_Z = -95;

  // ---------- deterministic rng for level layout ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- renderer / scene ----------
  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc4ea);
  scene.fog = new THREE.Fog(0x9fcdec, 70, 240);

  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  scene.add(new THREE.AmbientLight(0xcfe0ff, 0.3));
  var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a7a3a, 0.55);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff0c8, 1.25);
  sun.position.set(40, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
  sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
  sun.shadow.camera.far = 320;
  scene.add(sun);

  // ---------- ground with a simple grass texture ----------
  var grassCanvas = document.createElement('canvas');
  grassCanvas.width = grassCanvas.height = 256;
  (function () {
    var ctx = grassCanvas.getContext('2d');
    ctx.fillStyle = '#5f8f42';
    ctx.fillRect(0, 0, 256, 256);
    var shades = ['#557f39', '#699a4a', '#4f7834', '#71a353', '#5a8a3e'];
    for (var k = 0; k < 2600; k++) {
      ctx.fillStyle = shades[(Math.random() * shades.length) | 0];
      ctx.globalAlpha = 0.25 + Math.random() * 0.4;
      var s = 1 + Math.random() * 3;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    ctx.globalAlpha = 1;
  })();
  var grassTex = new THREE.CanvasTexture(grassCanvas);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(26, 40);
  grassTex.colorSpace = THREE.SRGBColorSpace;

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * MAP_X + 60, MAP_Z_MAX - MAP_Z_MIN + 80),
    new THREE.MeshLambertMaterial({ map: grassTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (MAP_Z_MIN + MAP_Z_MAX) / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var path = new THREE.Mesh(
    new THREE.PlaneGeometry(8, MAP_Z_MAX - MAP_Z_MIN),
    new THREE.MeshLambertMaterial({ color: 0x8a6f45 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, (MAP_Z_MIN + MAP_Z_MAX) / 2);
  path.receiveShadow = true;
  scene.add(path);

  // drifting clouds
  var clouds = [];
  (function () {
    var cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x555555 });
    for (var c = 0; c < 7; c++) {
      var g = new THREE.Group();
      var puffs = 3 + (Math.random() * 3 | 0);
      for (var p = 0; p < puffs; p++) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 8, 2.4, 4 + Math.random() * 4), cloudMat);
        m.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 6);
        g.add(m);
      }
      g.position.set((Math.random() - 0.5) * 220, 44 + Math.random() * 20, MAP_Z_MIN + Math.random() * (MAP_Z_MAX - MAP_Z_MIN));
      scene.add(g);
      clouds.push({ mesh: g, speed: 0.7 + Math.random() * 0.9 });
    }
  })();

  // sun disc with a soft glow halo
  function makeGlowTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,244,214,0.9)');
    grad.addColorStop(0.6, 'rgba(255,230,170,0.28)');
    grad.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  var glowTex = makeGlowTexture();
  var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff6d8, transparent: true, opacity: 1, depthWrite: false, fog: false
  }));
  sunSprite.position.set(110, 130, 60);
  sunSprite.scale.setScalar(34);
  scene.add(sunSprite);
  var sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffe9b0, transparent: true, opacity: 0.4,
    depthWrite: false, fog: false, blending: THREE.AdditiveBlending
  }));
  sunHalo.position.copy(sunSprite.position);
  sunHalo.scale.setScalar(85);
  scene.add(sunHalo);

  // grass tufts + wildflowers (instanced, cheap)
  (function scatterFlora() {
    var rng2 = mulberry32(424242);
    function okSpot(x, z) {
      if (Math.abs(x) < 4.8) return false;                        // keep the dirt path clean
      if (z > 92 && Math.abs(x) < 17) return false;               // house area
      if (z < CASTLE_Z + 22 && Math.abs(x) < 28) return false;    // castle courtyard
      return true;
    }
    var bladeCanvas = document.createElement('canvas');
    bladeCanvas.width = bladeCanvas.height = 64;
    var bctx = bladeCanvas.getContext('2d');
    for (var b = 0; b < 15; b++) {
      var bx = 8 + Math.random() * 48;
      bctx.strokeStyle = ['#4e7c33', '#5f9240', '#6da34c', '#456f2d'][(Math.random() * 4) | 0];
      bctx.lineWidth = 2 + Math.random() * 2;
      bctx.beginPath();
      bctx.moveTo(bx, 64);
      bctx.quadraticCurveTo(bx + (Math.random() - 0.5) * 14, 34, bx + (Math.random() - 0.5) * 22, 6 + Math.random() * 16);
      bctx.stroke();
    }
    var bladeTex = new THREE.CanvasTexture(bladeCanvas);
    bladeTex.colorSpace = THREE.SRGBColorSpace;
    var tuftGeo = new THREE.PlaneGeometry(1.0, 0.8);
    var tuftMat = new THREE.MeshLambertMaterial({ map: bladeTex, alphaTest: 0.4, side: THREE.DoubleSide, transparent: false });
    var TUFTS = IS_TOUCH ? 220 : 380;
    var tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler();
    var pv = new THREE.Vector3(), sc = new THREE.Vector3();
    var placed = 0, tries = 0;
    while (placed < TUFTS && tries++ < 6000) {
      var x = (rng2() * 2 - 1) * (MAP_X - 2);
      var z = MAP_Z_MIN + 6 + rng2() * (MAP_Z_MAX - MAP_Z_MIN - 12);
      if (!okSpot(x, z)) continue;
      var s = 0.7 + rng2() * 0.9;
      eul.set(0, rng2() * Math.PI, 0);
      q.setFromEuler(eul);
      pv.set(x, 0.36 * s, z);
      sc.set(s, s, s);
      m4.compose(pv, q, sc);
      tufts.setMatrixAt(placed++, m4);
    }
    tufts.count = placed;
    scene.add(tufts);

    var FLOWERS = IS_TOUCH ? 90 : 160;
    var flowerGeo = new THREE.IcosahedronGeometry(0.1, 0);
    var flowerMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWERS);
    var petal = new THREE.Color();
    var palette = [0xff7b9c, 0xffd23f, 0xffffff, 0xc17bff, 0xff9d5c];
    placed = 0; tries = 0;
    while (placed < FLOWERS && tries++ < 4000) {
      var fx = (rng2() * 2 - 1) * (MAP_X - 2);
      var fz = MAP_Z_MIN + 6 + rng2() * (MAP_Z_MAX - MAP_Z_MIN - 12);
      if (!okSpot(fx, fz)) continue;
      pv.set(fx, 0.14, fz);
      sc.setScalar(0.7 + rng2() * 0.7);
      q.identity();
      m4.compose(pv, q, sc);
      flowers.setMatrixAt(placed, m4);
      petal.set(palette[(rng2() * palette.length) | 0]);
      flowers.setColorAt(placed++, petal);
    }
    flowers.count = placed;
    scene.add(flowers);
  })();

  // butterflies fluttering around the meadow
  var butterflies = [];
  (function () {
    var wingColors = [0xffa8c5, 0x9fd4ff, 0xfff3a0, 0xd4b5ff];
    for (var b = 0; b < 6; b++) {
      var g = new THREE.Group();
      var mat = new THREE.MeshLambertMaterial({ color: wingColors[b % wingColors.length], side: THREE.DoubleSide });
      var wings = [];
      [-1, 1].forEach(function (s) {
        var pivot = new THREE.Group();
        var wing = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), mat);
        wing.position.x = s * 0.18;
        pivot.add(wing);
        g.add(pivot);
        wings.push(pivot);
      });
      g.userData = {
        wings: wings,
        cx: (Math.random() - 0.5) * 90,
        cz: 20 + Math.random() * 80,
        r: 6 + Math.random() * 14,
        speed: 0.25 + Math.random() * 0.3,
        phase: Math.random() * 20
      };
      scene.add(g);
      butterflies.push(g);
    }
  })();

  // castle war banners flanking the gate
  (function () {
    var bannerMat = new THREE.MeshLambertMaterial({ color: 0x8a2430, side: THREE.DoubleSide });
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x7c5a38 });
    [-9, 9].forEach(function (bx) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.5, 6), poleMat);
      pole.position.set(bx, 9 + 2.7, CASTLE_Z + 20);
      scene.add(pole);
      var banner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3), bannerMat);
      banner.position.set(bx, 9 + 2.2, CASTLE_Z + 20.15);
      scene.add(banner);
      var sigil = new THREE.Mesh(new THREE.CircleGeometry(0.4, 3), new THREE.MeshLambertMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
      sigil.position.set(bx, 9 + 2.2, CASTLE_Z + 20.25);
      sigil.rotation.z = Math.PI;
      scene.add(sigil);
    });
  })();

  // ---------- colliders ----------
  var obstacles = []; // ground-up columns {x, z, hx, hz, h}
  var platforms = []; // elevated walkable slabs {x, z, hx, hz, y}

  function addObstacleCollider(x, z, hx, hz, h) {
    var o = { x: x, z: z, hx: hx, hz: hz, h: h || 2.5 };
    obstacles.push(o);
    return o;
  }

  function collideCircle(pos, radius) {
    var feet = pos.y;
    for (var k = 0; k < obstacles.length; k++) {
      var o = obstacles[k];
      if (o.h <= feet + 0.45) continue; // low enough to stand on — not a wall
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

  function groundHeightAt(x, z, radius, feet) {
    var g = 0;
    var k, o;
    for (k = 0; k < obstacles.length; k++) {
      o = obstacles[k];
      if (o.h > feet + 0.5 || o.h <= g) continue;
      if (Math.abs(x - o.x) < o.hx + radius * 0.5 && Math.abs(z - o.z) < o.hz + radius * 0.5) g = o.h;
    }
    for (k = 0; k < platforms.length; k++) {
      o = platforms[k];
      if (o.y > feet + 0.5 || o.y <= g) continue;
      if (Math.abs(x - o.x) < o.hx && Math.abs(z - o.z) < o.hz) g = o.y;
    }
    return g;
  }

  function pointHitsObstacle(x, z, pad, y) {
    for (var k = 0; k < obstacles.length; k++) {
      var o = obstacles[k];
      if (y !== undefined && y > o.h) continue;
      if (Math.abs(x - o.x) < o.hx + pad && Math.abs(z - o.z) < o.hz + pad) return true;
    }
    return false;
  }

  // ---------- shared materials ----------
  var grayMat = new THREE.MeshLambertMaterial({ color: 0xa8a8b0 });
  var brownMat = new THREE.MeshLambertMaterial({ color: 0x9a7b5a });
  var whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f0ea });
  var pinkMat = new THREE.MeshLambertMaterial({ color: 0xe8a0a8 });
  var helmetMat = new THREE.MeshLambertMaterial({ color: 0x4a5d34 });
  var silverMat = new THREE.MeshLambertMaterial({ color: 0xc4c9d0 });
  var steelMat = new THREE.MeshLambertMaterial({ color: 0x8b939e });
  var goldMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x332200 });
  var woodMat = new THREE.MeshLambertMaterial({ color: 0xa5794f });
  var woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x7c5a38 });
  var stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a948c });
  var furMat = new THREE.MeshLambertMaterial({ color: 0xd98e3c });
  var furDarkMat = new THREE.MeshLambertMaterial({ color: 0xb06f28 });
  var bellyMat = new THREE.MeshLambertMaterial({ color: 0xf2e3c8 });
  var trackMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  var metalMat = new THREE.MeshLambertMaterial({ color: 0x555c61 });

  // ---------- decorations ----------
  function makeCrate(x, z, s, rng) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), woodMat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.y = s / 2;
    g.add(m);
    var band = new THREE.Mesh(new THREE.BoxGeometry(s + 0.06, s * 0.18, s + 0.06), woodDarkMat);
    band.position.y = s / 2;
    g.add(band);
    g.position.set(x, 0, z);
    if (rng) g.rotation.y = rng() * 0.5 - 0.25;
    scene.add(g);
    addObstacleCollider(x, z, s * 0.62, s * 0.62, s);
    return g;
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
    addObstacleCollider(x, z, s * 0.85, s * 0.85, s * 1.1);
  }

  function makeBarrier(x, z, w, rotY) {
    var g = new THREE.Group();
    var wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 0.8), new THREE.MeshLambertMaterial({ color: 0x7d7a70 }));
    wall.castShadow = true; wall.receiveShadow = true;
    wall.position.y = 0.7;
    g.add(wall);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    if (Math.abs(Math.sin(rotY)) > 0.5) addObstacleCollider(x, z, 0.6, w / 2, 1.4);
    else addObstacleCollider(x, z, w / 2, 0.6, 1.4);
  }

  function makeTree(x, z, s) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 1.6 * s, 7), woodDarkMat);
    trunk.position.y = 0.8 * s; trunk.castShadow = true;
    g.add(trunk);
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a33 });
    var l1 = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 2.2 * s, 8), leafMat);
    l1.position.y = 2.4 * s; l1.castShadow = true;
    g.add(l1);
    var l2 = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 1.8 * s, 8), leafMat);
    l2.position.y = 3.5 * s; l2.castShadow = true;
    g.add(l2);
    g.position.set(x, 0, z);
    scene.add(g);
    addObstacleCollider(x, z, 0.5 * s, 0.5 * s, 1.6 * s);
  }

  // ---------- castle (cat side) ----------
  function castleWall(x, z, w, d, h) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    addObstacleCollider(x, z, w / 2, d / 2, h);
  }
  function castleTower(x, z) {
    var t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 14, 10), stoneMat);
    t.position.set(x, 7, z);
    t.castShadow = true; t.receiveShadow = true;
    scene.add(t);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4, 10), new THREE.MeshLambertMaterial({ color: 0x7a2f2f }));
    roof.position.set(x, 16, z);
    roof.castShadow = true;
    scene.add(roof);
    addObstacleCollider(x, z, 3.2, 3.2, 14);
  }

  castleWall(-16, CASTLE_Z + 20, 20, 2, 9);
  castleWall(16, CASTLE_Z + 20, 20, 2, 9);
  castleWall(-25, CASTLE_Z - 2, 2, 42, 9);
  castleWall(25, CASTLE_Z - 2, 2, 42, 9);
  castleWall(0, CASTLE_Z - 22, 52, 2, 9);
  castleTower(-25, CASTLE_Z + 20);
  castleTower(25, CASTLE_Z + 20);
  castleTower(-25, CASTLE_Z - 22);
  castleTower(25, CASTLE_Z - 22);

  // ---------- mouse house ----------
  var plankMat = new THREE.MeshLambertMaterial({ color: 0xb98d5e });
  function houseWall(x, z, w, d, h) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plankMat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    addObstacleCollider(x, z, w / 2, d / 2, h);
    return m;
  }

  var atticLeaders = [];
  (function buildHouse() {
    // shell: 24 wide x 16 deep, door gap in the front wall
    houseWall(HOUSE_X - 7.25, HOUSE_Z - 8, 9.5, 1, 6);   // front left
    houseWall(HOUSE_X + 7.25, HOUSE_Z - 8, 9.5, 1, 6);   // front right
    houseWall(HOUSE_X - 12, HOUSE_Z, 1, 16, 6);          // left
    houseWall(HOUSE_X + 12, HOUSE_Z, 1, 16, 6);          // right
    houseWall(HOUSE_X, HOUSE_Z + 8, 25, 1, 6);           // back

    // door frame + windows (emissive warm glow)
    var frame = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 1.2), woodDarkMat);
    frame.position.set(HOUSE_X, 5, HOUSE_Z - 8); frame.castShadow = true;
    scene.add(frame);
    var winMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x8a6a20 });
    [[-7, HOUSE_Z - 8.1, 0], [7, HOUSE_Z - 8.1, 0], [-12.1, HOUSE_Z - 3, 1], [12.1, HOUSE_Z - 3, 1]].forEach(function (w) {
      var win = new THREE.Mesh(new THREE.BoxGeometry(w[2] ? 0.3 : 2.2, 2, w[2] ? 2.2 : 0.3), winMat);
      win.position.set(HOUSE_X + w[0], 3.2, w[1]);
      scene.add(win);
    });

    // roof slab (walkable) + parapet + chimney
    var roof = new THREE.Mesh(new THREE.BoxGeometry(27.6, 0.5, 19.6), new THREE.MeshLambertMaterial({ color: 0x8a4034 }));
    roof.position.set(HOUSE_X, 6.15 - 0.25, HOUSE_Z);
    roof.castShadow = true; roof.receiveShadow = true;
    scene.add(roof);
    platforms.push({ x: HOUSE_X, z: HOUSE_Z, hx: 13.8, hz: 9.8, y: 6.15 });
    var chimney = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.6), new THREE.MeshLambertMaterial({ color: 0x77504f }));
    chimney.position.set(HOUSE_X - 10, 7.2, HOUSE_Z + 6);
    chimney.castShadow = true;
    scene.add(chimney);

    // cozy interior light so the king's hall isn't pitch dark
    var lamp = new THREE.PointLight(0xffd9a0, 1.4, 30);
    lamp.position.set(HOUSE_X, 4.6, HOUSE_Z);
    scene.add(lamp);

    // parkour route up the right side: crate -> plank -> plank -> roof
    makeCrate(HOUSE_X + 15.8, HOUSE_Z - 6.5, 1.4);
    function ledge(x, z, h, w, d) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), woodDarkMat);
      m.position.set(x, h - 0.175, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      addObstacleCollider(x, z, w / 2, d / 2, h);
    }
    ledge(HOUSE_X + 14.6, HOUSE_Z - 3, 2.9, 2.6, 2.2);
    ledge(HOUSE_X + 13.6, HOUSE_Z + 1.5, 4.4, 2.2, 2.2);

    // attic conference on the roof: table, banner, five mouse world leaders
    var table = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 12), woodDarkMat);
    table.position.set(HOUSE_X, 6.15 + 0.85, HOUSE_Z);
    table.castShadow = true;
    scene.add(table);
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.85, 8), woodDarkMat);
    leg.position.set(HOUSE_X, 6.15 + 0.42, HOUSE_Z);
    scene.add(leg);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), woodDarkMat);
    pole.position.set(HOUSE_X, 6.15 + 1.7, HOUSE_Z + 3.6);
    scene.add(pole);
    var flag = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.08), new THREE.MeshLambertMaterial({ color: 0x4a86d8 }));
    flag.position.set(HOUSE_X + 1.1, 6.15 + 2.9, HOUSE_Z + 3.6);
    scene.add(flag);
    var sashColors = [0xd84a4a, 0x4a86d8, 0x46a05a, 0xd8b14a, 0x9a5ad8];
    for (var L = 0; L < 5; L++) {
      var a = (L / 5) * Math.PI * 2 + 0.3;
      var lm = buildMouse({ color: L % 2 ? 0xbfae98 : 0xa8a8b0, sash: sashColors[L], scale: 0.75 });
      lm.position.set(HOUSE_X + Math.cos(a) * 3.1, 6.15, HOUSE_Z + Math.sin(a) * 3.1);
      lm.rotation.y = Math.atan2(-(HOUSE_X - lm.position.x), -(HOUSE_Z - lm.position.z)) + Math.PI;
      scene.add(lm);
      atticLeaders.push(lm);
    }
  })();

  // ---------- mouse builder (player / king / allies / guards / leaders) ----------
  function buildMouse(opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var bodyMat = opts.color ? new THREE.MeshLambertMaterial({ color: opts.color }) : grayMat;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.9), bodyMat);
    body.position.y = 0.75; body.castShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.6), bodyMat);
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
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.9), pinkMat);
    tail.position.set(0, 0.55, 0.85);
    tail.rotation.x = 0.35;
    g.add(tail);
    if (opts.helmet) {
      var helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.22, 12), helmetMat);
      helmet.position.set(0, 1.66, -0.25);
      helmet.castShadow = true;
      g.add(helmet);
    }
    if (opts.crown) {
      var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.24, 8), goldMat);
      crown.position.set(0, 1.72, -0.25);
      crown.castShadow = true;
      g.add(crown);
      for (var c = 0; c < 4; c++) {
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), goldMat);
        var ca = (c / 4) * Math.PI * 2;
        spike.position.set(Math.cos(ca) * 0.26, 1.92, -0.25 + Math.sin(ca) * 0.26);
        g.add(spike);
      }
      var cape = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.1), new THREE.MeshLambertMaterial({ color: 0xa02030 }));
      cape.position.set(0, 0.85, 0.5);
      cape.rotation.x = 0.15;
      g.add(cape);
    }
    if (opts.sash) {
      var sash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.95), new THREE.MeshLambertMaterial({ color: opts.sash }));
      sash.position.set(0, 0.78, 0);
      sash.rotation.z = 0.5;
      g.add(sash);
    }
    if (opts.armor) {
      // full knightly plate: cuirass, great helm with red plume, pauldrons, shield
      var plate = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.72, 1.0), silverMat);
      plate.position.y = 0.8;
      plate.castShadow = true;
      g.add(plate);
      var trim = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 1.04), goldMat);
      trim.position.y = 0.52;
      g.add(trim);
      var helm = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.4, 12), silverMat);
      helm.position.set(0, 1.62, -0.25);
      helm.castShadow = true;
      g.add(helm);
      var dome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
      dome.position.set(0, 1.82, -0.25);
      dome.castShadow = true;
      g.add(dome);
      var visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), new THREE.MeshLambertMaterial({ color: 0x22262c }));
      visor.position.set(0, 1.58, -0.62);
      g.add(visor);
      var plume = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.55), new THREE.MeshLambertMaterial({ color: 0xc23040 }));
      plume.position.set(0, 2.18, -0.18);
      plume.rotation.x = -0.25;
      plume.castShadow = true;
      g.add(plume);
      [-1, 1].forEach(function (s) {
        var pauldron = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.2, 8), steelMat);
        pauldron.rotation.z = Math.PI / 2;
        pauldron.position.set(s * 0.46, 1.22, 0);
        pauldron.castShadow = true;
        g.add(pauldron);
      });
      var shield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.48), silverMat);
      shield.position.set(-0.55, 1.0, -0.05);
      shield.castShadow = true;
      g.add(shield);
      var emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), goldMat);
      emblem.rotation.z = Math.PI / 2;
      emblem.position.set(-0.62, 1.0, -0.05);
      g.add(emblem);
    }
    if (opts.spear) {
      var spear = new THREE.Group();
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), woodDarkMat);
      spear.add(shaft);
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 6), steelMat);
      tip.position.y = 1.25;
      spear.add(tip);
      spear.position.set(0.5, 1.1, 0);
      spear.rotation.x = -0.15;
      g.add(spear);
    }
    if (opts.launcher) {
      var launcher = new THREE.Group();
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 10),
        new THREE.MeshLambertMaterial({ color: 0xb8462f }));
      tube.rotation.x = Math.PI / 2;
      launcher.add(tube);
      var ltip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 10), goldMat);
      ltip.rotation.x = -Math.PI / 2;
      ltip.position.z = -0.7;
      launcher.add(ltip);
      launcher.position.set(0.45, 1.35, 0);
      g.add(launcher);
      g.userData.launcher = launcher;
    }
    g.scale.setScalar(scale);
    return g;
  }

  // ---------- hp bars ----------
  function buildHpBar(width, yOffset, color) {
    var g = new THREE.Group();
    var bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x501010, depthTest: false, transparent: true }));
    var fg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.18),
      new THREE.MeshBasicMaterial({ color: color || 0x35d035, depthTest: false, transparent: true }));
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

  // ---------- particle system (soft round glow sprites, per-particle size/alpha) ----------
  var PFX = IS_TOUCH ? 0.65 : 1;   // particle density scale on phones
  var MAX_PARTICLES = 4500;
  var pPos = new Float32Array(MAX_PARTICLES * 3);
  var pCol = new Float32Array(MAX_PARTICLES * 3);
  var pSiz = new Float32Array(MAX_PARTICLES);
  var pAlp = new Float32Array(MAX_PARTICLES);
  var particles = [];
  var pFree = [];
  for (var i = MAX_PARTICLES - 1; i >= 0; i--) { pFree.push(i); pPos[i * 3 + 1] = -1000; pAlp[i] = 0; }
  var pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
  pGeom.setAttribute('aSize', new THREE.BufferAttribute(pSiz, 1));
  pGeom.setAttribute('aAlpha', new THREE.BufferAttribute(pAlp, 1));
  var pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute vec3 aColor;',
      'attribute float aSize;',
      'attribute float aAlpha;',
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'void main() {',
      '  vColor = aColor; vAlpha = aAlpha;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = aSize * (270.0 / -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'void main() {',
      '  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;',
      '  float a = smoothstep(1.0, 0.12, d) * vAlpha;',
      '  if (a < 0.004) discard;',
      '  gl_FragColor = vec4(vColor * a, a);',
      '}'
    ].join('\n')
  });
  var pPoints = new THREE.Points(pGeom, pMat);
  pPoints.frustumCulled = false;
  scene.add(pPoints);

  // opts: {gravity, size, endSize, drag, fade} — or a number for gravity (legacy)
  function spawnParticle(pos, vel, color, life, opts) {
    if (!pFree.length) return;
    if (typeof opts === 'number') opts = { gravity: opts };
    opts = opts || {};
    var idx = pFree.pop();
    pPos[idx * 3] = pos.x; pPos[idx * 3 + 1] = pos.y; pPos[idx * 3 + 2] = pos.z;
    pCol[idx * 3] = color.r; pCol[idx * 3 + 1] = color.g; pCol[idx * 3 + 2] = color.b;
    var size = opts.size !== undefined ? opts.size : 0.5;
    pSiz[idx] = size; pAlp[idx] = 1;
    particles.push({
      i: idx, vel: vel, life: life, maxLife: life,
      gravity: opts.gravity !== undefined ? opts.gravity : 9,
      drag: opts.drag || 0,
      size: size,
      endSize: opts.endSize !== undefined ? opts.endSize : size,
      fade: opts.fade || 1
    });
  }

  function updateParticles(dt) {
    for (var k = particles.length - 1; k >= 0; k--) {
      var p = particles[k];
      p.life -= dt;
      var idx = p.i;
      if (p.life <= 0) {
        pPos[idx * 3 + 1] = -1000;
        pAlp[idx] = 0;
        pFree.push(idx);
        particles.splice(k, 1);
        continue;
      }
      if (p.drag) {
        var dr = Math.max(0, 1 - p.drag * dt);
        p.vel.multiplyScalar(dr);
      }
      p.vel.y -= p.gravity * dt;
      pPos[idx * 3] += p.vel.x * dt;
      pPos[idx * 3 + 1] += p.vel.y * dt;
      pPos[idx * 3 + 2] += p.vel.z * dt;
      var t = 1 - p.life / p.maxLife;
      pSiz[idx] = p.size + (p.endSize - p.size) * t;
      pAlp[idx] = Math.pow(Math.max(p.life / p.maxLife, 0), p.fade);
    }
    pGeom.attributes.position.needsUpdate = true;
    pGeom.attributes.aColor.needsUpdate = true;
    pGeom.attributes.aSize.needsUpdate = true;
    pGeom.attributes.aAlpha.needsUpdate = true;
  }

  // ---------- shockwave rings ----------
  var rings = [];
  function spawnRing(pos, color, maxScale, life, horizontal) {
    var mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 28),
      new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      })
    );
    mesh.position.copy(pos);
    if (horizontal) { mesh.rotation.x = -Math.PI / 2; mesh.position.y = Math.max(0.12, pos.y); }
    scene.add(mesh);
    rings.push({ mesh: mesh, life: life, maxLife: life, maxScale: maxScale, bb: !horizontal });
  }
  function updateRings(dt) {
    for (var k = rings.length - 1; k >= 0; k--) {
      var r = rings[k];
      r.life -= dt;
      if (r.life <= 0) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        rings.splice(k, 1);
        continue;
      }
      var t = 1 - r.life / r.maxLife;
      var e = 1 - (1 - t) * (1 - t); // ease-out
      r.mesh.scale.setScalar(0.4 + r.maxScale * e);
      r.mesh.material.opacity = 0.85 * (r.life / r.maxLife);
      if (r.bb) r.mesh.quaternion.copy(camera.quaternion);
    }
  }

  // ---------- flying debris ----------
  var debris = [];
  var debrisMats = [furMat, furDarkMat, trackMat, metalMat];
  function spawnDebris(pos, count) {
    for (var k = 0; k < count; k++) {
      var s = 0.18 + Math.random() * 0.35;
      var m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), debrisMats[(Math.random() * debrisMats.length) | 0]);
      m.position.copy(pos);
      m.castShadow = true;
      scene.add(m);
      debris.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 10, 5 + Math.random() * 8, (Math.random() - 0.5) * 10),
        ang: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 1.3 + Math.random() * 0.5
      });
    }
  }
  function updateDebris(dt) {
    for (var k = debris.length - 1; k >= 0; k--) {
      var d = debris[k];
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        debris.splice(k, 1);
        continue;
      }
      d.vel.y -= 22 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < 0.1) { d.mesh.position.y = 0.1; d.vel.y = Math.abs(d.vel.y) * 0.35; d.vel.x *= 0.7; d.vel.z *= 0.7; }
      d.mesh.rotation.x += d.ang.x * dt;
      d.mesh.rotation.y += d.ang.y * dt;
      d.mesh.rotation.z += d.ang.z * dt;
      if (d.life < 0.3) d.mesh.scale.setScalar(d.life / 0.3);
    }
  }

  // ---------- explosion light pool ----------
  var boomLights = [];
  for (var bl = 0; bl < 3; bl++) {
    var L = new THREE.PointLight(0xffaa55, 0, 26);
    scene.add(L);
    boomLights.push(L);
  }
  var boomLightIdx = 0;
  function flashLight(pos, color, intensity) {
    var L = boomLights[boomLightIdx++ % boomLights.length];
    L.position.copy(pos);
    L.position.y = Math.max(L.position.y, 1.5);
    L.color.set(color);
    L.intensity = intensity;
  }
  function updateBoomLights(dt) {
    boomLights.forEach(function (L) {
      if (L.intensity > 0) L.intensity = Math.max(0, L.intensity - dt * 22);
    });
  }

  // ---------- firework explosions with crackle bursts ----------
  var tmpColor = new THREE.Color();
  var crackles = []; // {pos, t, hue}

  function sparkBurst(pos, count, hue, speed, life, size) {
    count = Math.round(count * PFX);
    for (var k = 0; k < count; k++) {
      var dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      var sp = speed * (0.35 + Math.random() * 0.65);
      tmpColor.setHSL((hue + Math.random() * 0.12) % 1, 1, 0.55 + Math.random() * 0.3);
      spawnParticle(pos.clone(), dir.multiplyScalar(sp), tmpColor.clone(),
        life * (0.7 + Math.random() * 0.6),
        { gravity: 7, drag: 1.1, size: size, endSize: size * 0.25, fade: 0.7 });
    }
  }

  function fireworkExplosion(pos, big) {
    var hue = Math.random();
    tmpColor.setHSL(hue, 1, 0.6);
    // core flash + shockwave
    spawnParticle(pos.clone(), new THREE.Vector3(0, 0, 0), new THREE.Color(1, 1, 1), 0.18,
      { gravity: 0, size: big ? 7 : 4.5, endSize: big ? 11 : 7, fade: 0.8 });
    spawnRing(pos.clone(), tmpColor.clone(), big ? 10 : 6.5, 0.5);
    if (pos.y < 2.5) spawnRing(pos.clone(), tmpColor.clone(), big ? 8 : 5.5, 0.55, true);
    flashLight(pos, tmpColor.clone(), big ? 8 : 5);
    // main colored starburst
    sparkBurst(pos, big ? 120 : 75, hue, big ? 15 : 11, 1.0, 0.55);
    // white-hot inner sparks
    for (var k = 0; k < 16 * PFX; k++) {
      var dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      spawnParticle(pos.clone(), dir.multiplyScalar(4 + Math.random() * 5), new THREE.Color(1, 1, 0.9),
        0.3 + Math.random() * 0.2, { gravity: 2, size: 0.8, endSize: 0.2 });
    }
    // glowing smoke haze
    for (var s = 0; s < 10 * PFX; s++) {
      var sd = new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      tmpColor.setHSL(hue, 0.5, 0.16);
      spawnParticle(pos.clone(), sd, tmpColor.clone(), 1.4 + Math.random() * 0.6,
        { gravity: -0.6, drag: 1.5, size: 1.2, endSize: 3.6, fade: 1.6 });
    }
    // delayed crackle pops around the blast
    var pops = big ? 4 : 2;
    for (var c = 0; c < pops; c++) {
      crackles.push({
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6)),
        t: 0.2 + Math.random() * 0.45,
        hue: (hue + Math.random() * 0.3) % 1
      });
    }
  }

  function updateCrackles(dt) {
    for (var k = crackles.length - 1; k >= 0; k--) {
      var c = crackles[k];
      c.t -= dt;
      if (c.t <= 0) {
        sparkBurst(c.pos, 26, c.hue, 6.5, 0.55, 0.42);
        spawnParticle(c.pos.clone(), new THREE.Vector3(0, 0, 0), new THREE.Color(1, 1, 1), 0.12,
          { gravity: 0, size: 2.6, endSize: 4, fade: 0.8 });
        playNoise(0.1, 0.16, 2000);
        crackles.splice(k, 1);
      }
    }
  }

  // ---------- audio (layered synth SFX through a compressor bus) ----------
  var audioCtx = null, masterBus = null;
  function audio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterBus = audioCtx.createGain();
        masterBus.gain.value = 0.8;
        var comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 8;
        masterBus.connect(comp);
        comp.connect(audioCtx.destination);
      } catch (e) { }
    }
    return audioCtx;
  }
  function playNoise(duration, volume, filterFreq, filterEnd, delay) {
    var ctx = audio(); if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var len = Math.floor(ctx.sampleRate * duration);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var k = 0; k < len; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(filterFreq, t0);
    if (filterEnd) filt.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 40), t0 + duration);
    var gain = ctx.createGain(); gain.gain.value = volume;
    src.connect(filt); filt.connect(gain); gain.connect(masterBus);
    src.start(t0);
  }
  function playTone(freq, endFreq, duration, volume, type, delay) {
    var ctx = audio(); if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain); gain.connect(masterBus);
    osc.start(t0); osc.stop(t0 + duration);
  }
  function playBend(points, duration, volume, type) {
    // points: array of [timeFrac, freq] — pitch curve, e.g. a meow
    var ctx = audio(); if (!ctx) return;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(points[0][1], t0);
    for (var k = 1; k < points.length; k++) {
      osc.frequency.exponentialRampToValueAtTime(points[k][1], t0 + duration * points[k][0]);
    }
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + duration * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain); gain.connect(masterBus);
    osc.start(t0); osc.stop(t0 + duration);
  }
  var sfx = {
    shoot: function () {
      playTone(140, 50, 0.18, 0.3, 'sine');                 // launch thump
      playNoise(0.45, 0.3, 3400, 500);                       // whoosh tail
      playTone(800, 130, 0.35, 0.08, 'sawtooth');
    },
    explode: function (vol) {
      vol = vol === undefined ? 1 : vol;
      if (vol < 0.05) return;
      playTone(110, 26, 0.55, 0.5 * vol, 'sine');            // deep sub boom
      playNoise(0.65, 0.5 * vol, 1400, 180);                 // blast wash
      for (var k = 0; k < 5; k++) {                          // firework crackle tail
        playNoise(0.05, 0.12 * vol, 2500 + Math.random() * 3000, null, 0.12 + Math.random() * 0.5);
      }
    },
    pickup: function () {
      [660, 880, 1320].forEach(function (f, k) { playTone(f, f, 0.12, 0.12, 'square', k * 0.06); });
      playTone(2640, 3520, 0.2, 0.05, 'triangle', 0.18);
    },
    munch: function () {
      playNoise(0.07, 0.25, 900);
      playNoise(0.07, 0.22, 700, null, 0.12);
      playNoise(0.09, 0.2, 500, null, 0.24);
    },
    hurt: function () { playTone(280, 70, 0.25, 0.22, 'sawtooth'); playNoise(0.15, 0.2, 800); },
    meow: function () { playBend([[0, 480], [0.3, 820], [1, 300]], 0.45, 0.12, 'sawtooth'); },
    squeak: function () { playBend([[0, 1300], [0.4, 1900], [1, 1100]], 0.18, 0.1, 'square'); },
    clang: function () {
      playTone(2350, 2100, 0.12, 0.1, 'square');
      playTone(3620, 3200, 0.09, 0.06, 'square');
      playNoise(0.06, 0.2, 8000);
      playTone(160, 90, 0.1, 0.15, 'sine');
    },
    jump: function () { playTone(350, 600, 0.15, 0.07, 'square'); },
    fanfare: function () {
      [[523, 0], [659, 0.16], [784, 0.32], [1047, 0.48], [784, 0.72], [1047, 0.88]].forEach(function (n) {
        playTone(n[0], n[0], 0.28, 0.13, 'square', n[1]);
        playTone(n[0] / 2, n[0] / 2, 0.3, 0.08, 'triangle', n[1]);
      });
    }
  };

  // ---------- player ----------
  var player = {
    mesh: buildMouse({ helmet: true, launcher: true }),
    pos: new THREE.Vector3(0, 0, 90),
    hp: PLAYER_MAX_HP,
    ammo: 0,
    seekers: 0,
    weapon: 'normal',
    velX: 0, velZ: 0, velY: 0,
    grounded: true,
    yaw: 0,           // face the battlefield on spawn
    lastHurt: -10,
    fireCooldown: 0
  };
  scene.add(player.mesh);

  // ---------- mouse king, guards, allies ----------
  var mouseKing = {
    mesh: buildMouse({ color: 0xf2f0ea, crown: true, scale: 1.15 }),
    pos: new THREE.Vector3(HOUSE_X, 0, HOUSE_Z + 1),
    hp: MOUSE_KING_HP, maxHp: MOUSE_KING_HP,
    alive: true, t: 0
  };
  mouseKing.mesh.position.copy(mouseKing.pos);
  scene.add(mouseKing.mesh);
  mouseKing.bar = buildHpBar(1.4, 2.4, 0x4a86d8);
  mouseKing.mesh.add(mouseKing.bar);

  var mouseGuards = [];
  [0, Math.PI].forEach(function (a0) {
    var m = buildMouse({ color: 0xb9b9c2, armor: true, spear: true });
    scene.add(m);
    var bar = buildHpBar(1.0, 2.3, 0x4a86d8);
    m.add(bar);
    mouseGuards.push({
      mesh: m, bar: bar,
      pos: new THREE.Vector3(HOUSE_X + Math.cos(a0) * 3.6, 0, HOUSE_Z + Math.sin(a0) * 3.6),
      hp: MOUSE_GUARD_HP, maxHp: MOUSE_GUARD_HP,
      angle: a0, cool: 0, walkT: 0
    });
  });

  var allies = [];
  [[-3.5, 96], [3.5, 96], [0, 92]].forEach(function (s) {
    var m = buildMouse({ color: 0x9a7b5a, helmet: true, launcher: true });
    scene.add(m);
    var bar = buildHpBar(1.0, 2.3, 0x4a86d8);
    m.add(bar);
    allies.push({
      mesh: m, bar: bar,
      pos: new THREE.Vector3(s[0], 0, s[1]),
      hp: ALLY_HP, maxHp: ALLY_HP,
      ammo: 0, cool: 1 + Math.random() * 2, walkT: Math.random() * 10
    });
  });

  // ---------- pickups ----------
  var pickups = []; // {mesh,x,z,t,type,amount,respawn,timer(active when >0 hidden)}
  var PICKUP_SPOTS = [
    [1.2, 88], [-18, 70], [24, 58], [-34, 38], [14, 24],
    [-8, 2], [30, -18], [-28, -38], [6, -56], [-14, -70], [34, -62], [0, CASTLE_Z + 12]
  ];
  var SEEKER_SPOTS = [[-24, 52], [18, -8], [-6, -48]];

  function buildFireworkMesh(seeker) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 10),
      new THREE.MeshLambertMaterial({ color: seeker ? 0x2f7fd9 : 0xd9452f }));
    body.position.y = 0.45; body.castShadow = true;
    g.add(body);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 10),
      new THREE.MeshLambertMaterial({ color: seeker ? 0x7fd9ff : 0xffd23f, emissive: seeker ? 0x104060 : 0x403000 }));
    cone.position.y = 1.1; cone.castShadow = true;
    g.add(cone);
    var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: 0xc9b28a }));
    stick.position.set(0.16, 0.5, 0);
    g.add(stick);
    var glow = new THREE.PointLight(seeker ? 0x40a0ff : 0xffa040, 0.8, 6);
    glow.position.y = 1;
    g.add(glow);
    return g;
  }

  function addPickup(x, z, type, amount, respawn) {
    var mesh;
    if (type === 'popcorn') {
      mesh = new THREE.Group();
      var bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.35, 10),
        new THREE.MeshLambertMaterial({ color: 0xc94f4f }));
      bowl.position.y = 0.18; bowl.castShadow = true;
      mesh.add(bowl);
      for (var pc = 0; pc < 7; pc++) {
        var kernel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0),
          new THREE.MeshLambertMaterial({ color: pc % 3 ? 0xfff3d0 : 0xf7d980 }));
        kernel.position.set((Math.random() - 0.5) * 0.6, 0.45 + Math.random() * 0.2, (Math.random() - 0.5) * 0.6);
        mesh.add(kernel);
      }
    } else if (type === 'box') {
      mesh = new THREE.Group();
      var crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), woodMat);
      crate.position.y = 0.4; crate.castShadow = true;
      mesh.add(crate);
      for (var r = 0; r < 3; r++) {
        var mini = buildFireworkMesh(false);
        mini.scale.setScalar(0.6);
        mini.position.set((r - 1) * 0.35, 0.8, 0);
        mesh.add(mini);
      }
    } else if (type === 'seekerbox') {
      mesh = new THREE.Group();
      var crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshLambertMaterial({ color: 0x4a6a8a }));
      crate2.position.y = 0.4; crate2.castShadow = true;
      mesh.add(crate2);
      for (var r2 = 0; r2 < 2; r2++) {
        var mini2 = buildFireworkMesh(true);
        mini2.scale.setScalar(0.6);
        mini2.position.set((r2 - 0.5) * 0.5, 0.8, 0);
        mesh.add(mini2);
      }
    } else {
      mesh = buildFireworkMesh(type === 'seeker');
    }
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    pickups.push({ mesh: mesh, x: x, z: z, t: Math.random() * 6, type: type, amount: amount, respawn: respawn || 0, timer: 0 });
  }

  PICKUP_SPOTS.forEach(function (s) { addPickup(s[0], s[1], 'normal', 4, 30); });
  SEEKER_SPOTS.forEach(function (s) { addPickup(s[0], s[1], 'seeker', 2, 45); });
  // inside the house: firework boxes + popcorn
  addPickup(HOUSE_X - 8, HOUSE_Z + 4, 'box', 6, 40);
  addPickup(HOUSE_X + 8, HOUSE_Z + 4, 'box', 6, 40);
  addPickup(HOUSE_X - 8, HOUSE_Z - 4, 'seekerbox', 3, 50);
  addPickup(HOUSE_X + 8, HOUSE_Z - 4, 'popcorn', 25, 40);
  addPickup(HOUSE_X, HOUSE_Z + 6, 'popcorn', 25, 40);

  // ---------- cat enemies ----------
  function buildCatHead(scale) {
    var head = new THREE.Group();
    var skull = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 1.6 * scale, 1.8 * scale), furMat);
    skull.castShadow = true;
    head.add(skull);
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.4 * scale, 0.8 * scale, 4), furDarkMat);
      ear.position.set(s * 0.7 * scale, 1.1 * scale, 0);
      ear.castShadow = true;
      head.add(ear);
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x30ff30, emissive: 0x104010 }));
      eye.position.set(s * 0.5 * scale, 0.25 * scale, -0.92 * scale);
      head.add(eye);
    });
    var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.6 * scale, 0.4 * scale),
      new THREE.MeshLambertMaterial({ color: 0x1a0d0d }));
    mouth.position.set(0, -0.4 * scale, -0.85 * scale);
    head.add(mouth);
    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.26 * scale, 2.2 * scale, 10), metalMat);
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
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * scale, 0.75 * scale, 0.3 * scale, 8), goldMat);
      crown.add(band);
      for (var k = 0; k < 5; k++) {
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.5 * scale, 4), goldMat);
        var a = (k / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.6 * scale, 0.35 * scale, Math.sin(a) * 0.6 * scale);
        crown.add(spike);
      }
      crown.position.set(0, 1.05 * scale, 0);
      head.add(crown);
    }
    return g;
  }

  var tanks = [];
  var soldiers = []; // cat foot units: {kind:'cat'|'catguard', ...}

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
    tank.collider = addObstacleCollider(x, z, 2.4 * scale, 3 * scale, 3.2 * scale);
    return tank;
  }

  spawnTank(-24, 44);
  spawnTank(22, 8);
  spawnTank(-14, -34);
  spawnTank(20, -62);
  var king = spawnTank(0, CASTLE_Z - 8, { king: true });

  function buildCatSoldier(guard) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), furMat);
    body.position.y = 0.95; body.castShadow = true;
    g.add(body);
    if (guard) {
      var plate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.42), silverMat);
      plate.position.y = 1.0; plate.castShadow = true;
      g.add(plate);
    } else {
      var belly = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.06), bellyMat);
      belly.position.set(0, 0.9, -0.18);
      g.add(belly);
    }
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.42), furMat);
    head.position.y = 1.55; head.castShadow = true;
    g.add(head);
    if (guard) {
      var helm = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 8), steelMat);
      helm.position.y = 1.95; helm.castShadow = true;
      g.add(helm);
      var spear = new THREE.Group();
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), woodDarkMat);
      spear.add(shaft);
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), steelMat);
      tip.position.y = 1.4;
      spear.add(tip);
      spear.position.set(0.42, 1.15, 0);
      spear.rotation.x = -0.15;
      g.add(spear);
    }
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 4), furDarkMat);
      ear.position.set(s * 0.15, guard ? 1.8 : 1.87, 0);
      g.add(ear);
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03),
        new THREE.MeshLambertMaterial({ color: guard ? 0xff5030 : 0x30ff30, emissive: guard ? 0x401008 : 0x103010 }));
      eye.position.set(s * 0.12, 1.6, -0.22);
      g.add(eye);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), guard ? steelMat : furDarkMat);
      arm.position.set(s * 0.37, 1.05, 0);
      g.add(arm);
    });
    var legs = [];
    [-1, 1].forEach(function (s) {
      var pivot = new THREE.Group();
      pivot.position.set(s * 0.16, 0.58, 0);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.16), guard ? steelMat : furDarkMat);
      leg.position.y = -0.29;
      leg.castShadow = true;
      pivot.add(leg);
      g.add(pivot);
      legs.push(pivot);
    });
    g.userData.legs = legs;
    return g;
  }

  function spawnSoldier(x, z, fromTank, opts) {
    opts = opts || {};
    var isGuard = !!opts.guard;
    if (!isGuard) {
      var catCount = soldiers.filter(function (s) { return s.kind === 'cat'; }).length;
      if (catCount >= MAX_SOLDIERS) return;
    }
    var mesh = buildCatSoldier(isGuard);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    var bar = buildHpBar(0.9, isGuard ? 2.5 : 2.2);
    mesh.add(bar);
    soldiers.push({
      kind: isGuard ? 'catguard' : 'cat',
      mesh: mesh, bar: bar,
      pos: new THREE.Vector3(x, 0, z),
      hp: isGuard ? GUARD_HP : SOLDIER_HP,
      maxHp: isGuard ? GUARD_HP : SOLDIER_HP,
      dmg: isGuard ? GUARD_DAMAGE : SOLDIER_DAMAGE,
      speed: isGuard ? GUARD_SPEED : SOLDIER_SPEED,
      attackTimer: 0,
      walkT: Math.random() * 10,
      fromTank: fromTank || null,
      mission: opts.mission || null,
      stationed: isGuard,
      home: isGuard ? new THREE.Vector3(x, 0, z) : null
    });
    if (fromTank) fromTank.mySoldiers++;
    if (!isGuard) fireworkExplosion(new THREE.Vector3(x, 1, z), false);
  }

  // castle gate guards + imperial guards flanking the cat king
  spawnSoldier(-4, CASTLE_Z + 24, null);
  spawnSoldier(4, CASTLE_Z + 24, null);
  spawnSoldier(-5.5, CASTLE_Z - 2, null, { guard: true });
  spawnSoldier(5.5, CASTLE_Z - 2, null, { guard: true });

  // ---------- level scatter ----------
  var rng = mulberry32(20260731);
  function clearOfImportantSpots(x, z, minD) {
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < 10) return false;
    var all = PICKUP_SPOTS.concat(SEEKER_SPOTS);
    for (var k = 0; k < all.length; k++)
      if (Math.hypot(x - all[k][0], z - all[k][1]) < minD) return false;
    for (k = 0; k < tanks.length; k++)
      if (Math.hypot(x - tanks[k].x, z - tanks[k].z) < minD + 4) return false;
    if (z < CASTLE_Z + 22 && Math.abs(x) < 28) return false;
    if (z > HOUSE_Z - 14 && Math.abs(x) < 20) return false;   // keep the house area clear
    if (Math.abs(x) < 5) return false;                        // keep the main path clear
    return true;
  }
  for (var n = 0; n < 46; n++) {
    var ox = (rng() * 2 - 1) * (MAP_X - 6);
    var oz = MAP_Z_MIN + 18 + rng() * (MAP_Z_MAX - MAP_Z_MIN - 40);
    if (!clearOfImportantSpots(ox, oz, 4)) continue;
    var kind = rng();
    if (kind < 0.45) makeCrate(ox, oz, 1.6 + rng() * 1.6, rng);
    else if (kind < 0.7) makeRock(ox, oz, 1.2 + rng() * 1.4);
    else if (kind < 0.85) makeBarrier(ox, oz, 4 + rng() * 3, rng() * Math.PI);
    else makeTree(ox, oz, 1.1 + rng() * 0.9);
  }

  // ---------- projectiles ----------
  var projectiles = []; // {mesh, vel, friendly, seek, life, age}

  function buildRocketMesh(friendly, seek) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8),
      new THREE.MeshLambertMaterial({
        color: seek ? 0x2f7fd9 : (friendly ? 0xd9452f : 0x333333),
        emissive: seek ? 0x103050 : (friendly ? 0x401008 : 0x111111)
      }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8),
      new THREE.MeshLambertMaterial({ color: seek ? 0x7fd9ff : 0xffd23f, emissive: seek ? 0x104060 : 0x403000 }));
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.33;
    g.add(tip);
    return g;
  }

  function fireProjectile(origin, dir, friendly, seek) {
    var mesh = buildRocketMesh(friendly, seek);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(dir));
    if (friendly) {
      var glow = new THREE.PointLight(seek ? 0x66ccff : 0xffa040, 1.2, 8);
      mesh.add(glow);
    }
    scene.add(mesh);
    projectiles.push({
      mesh: mesh,
      vel: dir.clone().multiplyScalar(seek ? SEEKER_SPEED : (friendly ? ROCKET_SPEED : SHELL_SPEED)),
      friendly: friendly,
      seek: !!seek,
      life: seek ? 6 : 4,
      age: 0
    });
  }

  function nearestEnemyTo(pos) {
    var best = null, bestD = 1e9;
    tanks.forEach(function (t) {
      if (!t.alive) return;
      var d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < bestD) { bestD = d; best = new THREE.Vector3(t.x, 2.2 * t.scale, t.z); }
    });
    soldiers.forEach(function (s) {
      var d = Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z);
      if (d < bestD) { bestD = d; best = new THREE.Vector3(s.pos.x, 1.1, s.pos.z); }
    });
    return best;
  }

  // ---------- damage routing ----------
  function damageTank(t, dmg) {
    t.hp -= dmg;
    t.flash = 0.15;
    setHpBar(t.bar, t.hp / t.maxHp);
    if (t.hp <= 0 && t.alive) {
      t.alive = false;
      var p = new THREE.Vector3(t.x, 2.5 * t.scale, t.z);
      fireworkExplosion(p, true);
      fireworkExplosion(p.clone().add(new THREE.Vector3(1, 1, 0)), true);
      spawnDebris(p, Math.round((t.isKing ? 16 : 10) * PFX));
      shake = Math.min(shake + 0.4, 0.7);
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

  function damageSoldierObj(s, dmg) {
    s.hp -= dmg;
    setHpBar(s.bar, s.hp / s.maxHp);
    if (s.hp <= 0) {
      var idx = soldiers.indexOf(s);
      if (idx >= 0) {
        fireworkExplosion(s.pos.clone().setY(1.2), false);
        if (s.fromTank) s.fromTank.mySoldiers--;
        scene.remove(s.mesh);
        soldiers.splice(idx, 1);
      }
    }
  }

  function damageAlly(a, dmg) {
    a.hp -= dmg;
    setHpBar(a.bar, a.hp / a.maxHp);
    if (a.hp <= 0) {
      var idx = allies.indexOf(a);
      if (idx >= 0) {
        fireworkExplosion(a.pos.clone().setY(1), false);
        scene.remove(a.mesh);
        allies.splice(idx, 1);
        showMessage('A fellow mouse soldier has fallen!', 2.5);
        sfx.squeak();
      }
    }
  }

  function damageMouseGuard(g, dmg) {
    g.hp -= dmg;
    setHpBar(g.bar, g.hp / g.maxHp);
    if (g.hp <= 0) {
      var idx = mouseGuards.indexOf(g);
      if (idx >= 0) {
        fireworkExplosion(g.pos.clone().setY(1), false);
        scene.remove(g.mesh);
        mouseGuards.splice(idx, 1);
        showMessage('A royal mouse guard has fallen!', 2.5);
        sfx.squeak();
      }
    }
  }

  function damageMouseKing(dmg) {
    if (!mouseKing.alive) return;
    mouseKing.hp -= dmg;
    setHpBar(mouseKing.bar, mouseKing.hp / mouseKing.maxHp);
    sfx.squeak();
    if (mouseKing.hp <= 150 && mouseKing.hp + dmg > 150) showMessage('⚠ The MOUSE KING is under attack! Defend him!', 3);
    if (mouseKing.hp <= 0) {
      mouseKing.alive = false;
      fireworkExplosion(mouseKing.pos.clone().setY(1.5), true);
      scene.remove(mouseKing.mesh);
      loseGame('The Mouse King has fallen! The cats have won the war.');
    }
  }

  function explode(pos, friendly) {
    fireworkExplosion(pos, !friendly);
    var hearDist = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
    sfx.explode(Math.max(0.12, 1 - hearDist / 80));
    shake = Math.min(shake + (friendly ? 0.15 : 0.3), 0.6);
    var k, d;
    if (friendly) {
      tanks.forEach(function (t) {
        if (!t.alive) return;
        var dd = Math.hypot(pos.x - t.x, pos.z - t.z);
        if (dd < ROCKET_SPLASH + t.scale * 2) damageTank(t, ROCKET_DAMAGE);
      });
      for (k = soldiers.length - 1; k >= 0; k--) {
        var s = soldiers[k];
        if (pos.distanceTo(s.pos.clone().setY(pos.y)) < ROCKET_SPLASH + 1) damageSoldierObj(s, ROCKET_DAMAGE);
      }
    } else {
      var r = ROCKET_SPLASH + 1.5;
      d = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
      if (d < r) hurtPlayer(Math.round(13 * (1 - d / r) + 4));   // per-shell damage lowered — tanks fire volleys now
      for (k = allies.length - 1; k >= 0; k--) {
        d = Math.hypot(pos.x - allies[k].pos.x, pos.z - allies[k].pos.z);
        if (d < r) damageAlly(allies[k], Math.round(16 * (1 - d / r) + 4));
      }
      for (k = mouseGuards.length - 1; k >= 0; k--) {
        d = Math.hypot(pos.x - mouseGuards[k].pos.x, pos.z - mouseGuards[k].pos.z);
        if (d < r) damageMouseGuard(mouseGuards[k], Math.round(16 * (1 - d / r) + 4));
      }
      if (mouseKing.alive) {
        d = Math.hypot(pos.x - mouseKing.pos.x, pos.z - mouseKing.pos.z);
        if (d < r) damageMouseKing(Math.round(18 * (1 - d / r) + 4));
      }
    }
  }

  // ---------- input ----------
  var keys = {};
  var pitch = 0;
  var pointerLocked = false;
  var jumpQueued = false;

  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (state !== 'playing') return;
    if (e.code === 'Space') { e.preventDefault(); jumpQueued = true; }
    if (e.code === 'KeyF' || e.code === 'Enter') { e.preventDefault(); tryShoot(); }
    if (e.code === 'Digit1') setWeapon('normal');
    if (e.code === 'Digit2') setWeapon('seeker');
    if (e.code === 'KeyQ') setWeapon(player.weapon === 'normal' ? 'seeker' : 'normal');
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
  var dragAim = null;
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

  // weapon switch (HUD tap/click)
  var ammoWrap = document.getElementById('ammo-wrap');
  function setWeapon(w) {
    player.weapon = w;
    document.getElementById('ammo-normal').classList.toggle('active', w === 'normal');
    document.getElementById('ammo-seeker').classList.toggle('active', w === 'seeker');
  }
  ammoWrap.addEventListener('click', function (e) {
    e.stopPropagation();
    setWeapon(player.weapon === 'normal' ? 'seeker' : 'normal');
  });
  ammoWrap.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  ammoWrap.addEventListener('touchend', function (e) {
    e.preventDefault(); e.stopPropagation();
    setWeapon(player.weapon === 'normal' ? 'seeker' : 'normal');
  }, { passive: false });

  // ---------- touch controls ----------
  var touchUi = document.getElementById('touch-ui');
  var joystickEl = document.getElementById('joystick');
  var knobEl = document.getElementById('joystick-knob');
  var fireBtn = document.getElementById('fire-btn');
  var jumpBtn = document.getElementById('jump-btn');
  var joy = { id: null, baseX: 0, baseY: 0, x: 0, y: 0 };
  var aimTouch = { id: null, lastX: 0, lastY: 0, moved: 0, startT: 0 };
  var fireHeld = false;

  if (IS_TOUCH) {
    var controlsLine = document.getElementById('controls-line');
    if (controlsLine) controlsLine.textContent = 'STICK — move  |  DRAG — aim  |  TAP A CAT — fire at it  |  🎆 fire  |  ⬆ jump';

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

    jumpBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      jumpQueued = true;
    }, { passive: false });

    document.addEventListener('touchstart', function (e) {
      if (state !== 'playing') return;
      for (var k = 0; k < e.changedTouches.length; k++) {
        var t = e.changedTouches[k];
        if (t.identifier === joy.id) continue;
        if (t.target === fireBtn || t.target === jumpBtn || t.target === joystickEl || t.target === knobEl) continue;
        if (t.target === ammoWrap || ammoWrap.contains(t.target)) continue;
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

  // ---------- shooting ----------
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
    var isSeeker = player.weapon === 'seeker';
    if (isSeeker && player.seekers <= 0) {
      if (player.ammo > 0) { setWeapon('normal'); isSeeker = false; }
      else { showMessage('No fireworks! Find more on the battlefield.', 1.6); return; }
    }
    if (!isSeeker && player.ammo <= 0) {
      if (player.seekers > 0) { setWeapon('seeker'); isSeeker = true; }
      else { showMessage('No fireworks! Find more on the battlefield.', 1.6); return; }
    }
    if (isSeeker) player.seekers--; else player.ammo--;
    player.fireCooldown = 0.45;
    var muzzle = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    var shootDir;
    if (!targetPos) targetPos = enemyTargetAt(window.innerWidth / 2, window.innerHeight / 2);
    if (targetPos) {
      shootDir = targetPos.clone().sub(muzzle).normalize();
    } else {
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      var far = camera.position.clone().add(dir.multiplyScalar(120));
      shootDir = far.sub(muzzle).normalize();
    }
    muzzle.add(shootDir.clone().multiplyScalar(1.0));
    fireProjectile(muzzle, shootDir, true, isSeeker);
    for (var k = 0; k < 18; k++) {
      var sprayDir = shootDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8
      )).normalize().multiplyScalar(4 + Math.random() * 7);
      if (isSeeker) tmpColor.setHSL(0.55 + Math.random() * 0.08, 1, 0.6 + Math.random() * 0.3);
      else tmpColor.setHSL(0.07 + Math.random() * 0.08, 1, 0.55 + Math.random() * 0.35);
      spawnParticle(muzzle.clone(), sprayDir, tmpColor.clone(), 0.35 + Math.random() * 0.3, 7);
    }
    sfx.shoot();
    shake = Math.min(shake + 0.08, 0.5);
    updateHud();
  }

  // ---------- HUD ----------
  var healthBar = document.getElementById('health-bar');
  var ammoNormalEl = document.querySelector('#ammo-normal span');
  var ammoSeekerEl = document.querySelector('#ammo-seeker span');
  var messageEl = document.getElementById('message');
  var kingWrap = document.getElementById('king-hp-wrap');
  var kingBar = document.getElementById('king-hp');
  var mkBar = document.getElementById('mk-bar');
  var damageFlash = document.getElementById('damage-flash');
  var messageTimer = 0;

  function updateHud() {
    healthBar.style.width = Math.max(0, (player.hp / PLAYER_MAX_HP) * 100) + '%';
    ammoNormalEl.textContent = player.ammo;
    ammoSeekerEl.textContent = player.seekers;
    mkBar.style.width = Math.max(0, (mouseKing.hp / mouseKing.maxHp) * 100) + '%';
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
    if (player.hp <= 0) loseGame('You were captured by the cats. The mouse resistance needs you — try again!');
  }

  // ---------- screens / state ----------
  var state = 'start';
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
    showMessage('Grab the firework ahead — and keep the Mouse King safe!', 4);
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
  function loseGame(reason) {
    state = 'lost';
    fireHeld = false;
    sfx.meow();
    if (document.exitPointerLock) document.exitPointerLock();
    touchUi.classList.add('hidden');
    var p = document.querySelector('#gameover-screen p');
    if (p && reason) p.textContent = reason;
    show('gameover-screen');
  }

  // ---------- update ----------
  var shake = 0;
  var elapsed = 0;
  var raidTimer = 40;
  var atticDone = false;

  function updatePlayer(dt) {
    var speed = (keys.ShiftLeft || keys.ShiftRight) ? SPRINT_SPEED : PLAYER_SPEED;
    var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    var rx = -fz, rz = fx;
    var mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
    if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
    if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
    if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
    var len = Math.hypot(mx, mz);
    var joyLen = Math.hypot(joy.x, joy.y);
    if (len === 0 && joyLen > 0.12) {
      mx = fx * -joy.y + rx * joy.x;
      mz = fz * -joy.y + rz * joy.x;
      len = Math.hypot(mx, mz);
      speed = joyLen > 0.92 ? SPRINT_SPEED : PLAYER_SPEED * Math.min(1, joyLen * 1.15);
    }
    var tvx = len > 0 ? (mx / len) * speed : 0;
    var tvz = len > 0 ? (mz / len) * speed : 0;
    var ease = 1 - Math.exp(-9 * dt);
    player.velX += (tvx - player.velX) * ease;
    player.velZ += (tvz - player.velZ) * ease;
    player.pos.x += player.velX * dt;
    player.pos.z += player.velZ * dt;
    collideCircle(player.pos, PLAYER_RADIUS);

    // vertical: gravity, jumping, landing on crates / the roof
    if (jumpQueued) {
      if (player.grounded) {
        player.velY = JUMP_V;
        player.grounded = false;
        sfx.jump();
      }
      jumpQueued = false;
    }
    player.velY -= GRAVITY * dt;
    player.pos.y += player.velY * dt;
    var g = groundHeightAt(player.pos.x, player.pos.z, PLAYER_RADIUS, player.pos.y);
    if (player.pos.y <= g) {
      player.pos.y = g;
      player.velY = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }

    if (fireHeld) tryShoot();

    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.yaw;
    player.mesh.userData.launcher.visible = (player.ammo + player.seekers) > 0;
    var moving = Math.hypot(player.velX, player.velZ) > 1;
    if (player.grounded && moving) player.mesh.position.y = player.pos.y + Math.abs(Math.sin(elapsed * 10)) * 0.12;

    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    if (player.hp < PLAYER_MAX_HP && elapsed - player.lastHurt > 6) {
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 2.5 * dt);
    }

    // attic conference easter egg
    if (!atticDone && player.pos.y > 5.5 &&
        Math.abs(player.pos.x - HOUSE_X) < 5 && Math.abs(player.pos.z - HOUSE_Z) < 4) {
      atticDone = true;
      player.seekers += 3;
      sfx.fanfare();
      showMessage('🐭🌍 You joined the Attic Conference of Mouse World Leaders! They gift you 3 seeker fireworks.', 5);
    }

    // camera — with wall collision so the view never phases through geometry
    var camDist = 6.5;
    var cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    var ax = -Math.sin(player.yaw) * cosP, ay = -sinP, az = -Math.cos(player.yaw) * cosP;
    var rvx = Math.cos(player.yaw), rvz = -Math.sin(player.yaw);
    var hx = player.pos.x + rvx * 0.9;
    var hy = player.pos.y + 1.9;
    var hz = player.pos.z + rvz * 0.9;
    for (var cd = 0.8; cd <= camDist; cd += 0.25) {
      var cpx = hx - ax * cd, cpy = hy - ay * cd + 0.5, cpz = hz - az * cd;
      if (pointHitsObstacle(cpx, cpz, 0.3, cpy)) {
        camDist = Math.max(1.2, cd - 0.4);
        break;
      }
    }
    camera.position.set(hx - ax * camDist, hy - ay * camDist + 0.5, hz - az * camDist);
    if (camera.position.y < 0.4) camera.position.y = 0.4;
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 1.5);
    }
    camera.lookAt(hx + ax * 12, hy + ay * 12, hz + az * 12);
  }

  function consumePickup(p) {
    p.timer = p.respawn > 0 ? p.respawn : -1;
    p.mesh.visible = false;
    if (p.timer < 0) {
      scene.remove(p.mesh);
      pickups.splice(pickups.indexOf(p), 1);
    }
  }

  function updatePickups(dt) {
    for (var k = pickups.length - 1; k >= 0; k--) {
      var p = pickups[k];
      if (p.timer > 0) {
        p.timer -= dt;
        if (p.timer <= 0) { p.mesh.visible = true; p.timer = 0; }
        continue;
      }
      p.t += dt;
      p.mesh.position.y = 0.15 + Math.sin(p.t * 2.5) * 0.12;
      if (p.type !== 'popcorn') {
        p.mesh.rotation.y += dt * 1.5;
        // idle sparkle fountain so pickups glitter from afar
        if (Math.random() < dt * 5) {
          tmpColor.setHSL(p.type === 'seeker' || p.type === 'seekerbox' ? 0.56 : 0.09, 1, 0.65);
          spawnParticle(new THREE.Vector3(p.x + (Math.random() - 0.5) * 0.6, 1.2, p.z + (Math.random() - 0.5) * 0.6),
            new THREE.Vector3(0, 1.5 + Math.random(), 0), tmpColor.clone(), 0.7,
            { gravity: -0.5, size: 0.3, endSize: 0.06 });
        }
      }
      if (player.pos.y < 2.5 && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 1.9) {
        if (p.type === 'popcorn') {
          if (player.hp >= PLAYER_MAX_HP - 1) continue;
          player.hp = Math.min(PLAYER_MAX_HP, player.hp + p.amount);
          sfx.munch();
          showMessage('Popcorn! +' + p.amount + ' HP 🍿', 2);
        } else if (p.type === 'seeker' || p.type === 'seekerbox') {
          player.seekers += p.amount;
          sfx.pickup();
          showMessage('Seeker fireworks! +' + p.amount + ' 🎯 (they chase cats!)', 2.5);
        } else {
          player.ammo += p.amount;
          sfx.pickup();
          showMessage('Picked up fireworks! +' + p.amount + ' rockets', 2);
        }
        sparkBurst(new THREE.Vector3(p.x, 1.2, p.z), 22,
          p.type === 'popcorn' ? 0.13 : (p.type === 'seeker' || p.type === 'seekerbox' ? 0.56 : 0.09), 5, 0.5, 0.4);
        consumePickup(p);
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
      if (dist > (wrath ? 78 : t.range)) return;

      var targetYaw = Math.atan2(-dx, -dz);
      var diff = targetYaw - t.headYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t.headYaw += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
      t.head.rotation.y = t.headYaw;

      t.fireTimer -= dt;
      if (t.fireTimer <= 0 && Math.abs(diff) < 0.25) {
        t.fireTimer = t.isKing ? 1.6 : 2.0 + Math.random() * 0.6;
        var muzzle = t.head.localToWorld(t.head.userData.muzzleLocal.clone());
        // tight aim, then a fanned volley of shells
        var aim = new THREE.Vector3(
          player.pos.x + (Math.random() - 0.5) * 1.2,
          player.pos.y + 1.2,
          player.pos.z + (Math.random() - 0.5) * 1.2
        ).sub(muzzle).normalize();
        var up = new THREE.Vector3(0, 1, 0);
        var shots = t.isKing ? 5 : 3;
        var spreadTotal = t.isKing ? 0.22 : 0.11;
        for (var si = 0; si < shots; si++) {
          var off = (si / (shots - 1) - 0.5) * spreadTotal + (Math.random() - 0.5) * 0.02;
          fireProjectile(muzzle.clone(), aim.clone().applyAxisAngle(up, off), false);
        }
        sfx.shoot();
        for (var s = 0; s < 8; s++) {
          spawnParticle(muzzle.clone(),
            aim.clone().multiplyScalar(6).add(new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(3)),
            new THREE.Color(0xffcc66), 0.3, 4);
        }
      }

      t.deployTimer -= dt;
      if (t.deployTimer <= 0) {
        t.deployTimer = t.isKing ? 9 : 8 + Math.random() * 3;
        if (t.mySoldiers < 3) {
          spawnSoldier(t.x + (Math.random() - 0.5) * 3, t.z + 4 * t.scale, t);
          sfx.meow();
        }
      }
    });

    // periodic raid on the mouse king
    raidTimer -= dt;
    if (raidTimer <= 0) {
      raidTimer = 48;
      var aliveTanks = tanks.filter(function (t) { return t.alive && !t.isKing; });
      if (aliveTanks.length && mouseKing.alive) {
        var t = aliveTanks[(Math.random() * aliveTanks.length) | 0];
        spawnSoldier(t.x, t.z + 4, t, { mission: 'raid' });
        showMessage('⚠ A cat raider is heading for the MOUSE KING!', 3.5);
        sfx.meow();
      }
    }
  }

  // royal wrath: approach (or wound) the Cat King and EVERY cat hunts you alone
  var wrath = false;
  function updateWrath() {
    var wasWrath = wrath;
    if (king.alive && state === 'playing') {
      var d = Math.hypot(player.pos.x - king.x, player.pos.z - king.z);
      wrath = d < 34 || king.hp < king.maxHp;
    } else {
      wrath = false;
    }
    if (wrath && !wasWrath) {
      showMessage('😾 You dare approach the CAT KING?! Every cat on the field is coming for YOU!', 4);
      sfx.meow();
      setTimeout(function () { sfx.meow(); }, 220);
      setTimeout(function () { sfx.meow(); }, 480);
      soldiers.forEach(function (s) { s.stationed = false; });
    }
  }

  // pick what a cat foot unit should chase
  function catPickTarget(s) {
    if (wrath) {
      // the king's fury overrides every other order — hunt the player, only the player
      return { pos: player.pos, hit: function (d) { hurtPlayer(d); }, aggro: 1e9 };
    }
    if (s.mission === 'raid' && mouseKing.alive) {
      return { pos: mouseKing.pos, hit: function (d) { damageMouseKing(d); }, aggro: 1e9 };
    }
    var best = null, bestD = 1e9;
    function consider(pos, hit) {
      var d = Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z);
      if (d < bestD) { bestD = d; best = { pos: pos, hit: hit, d: d }; }
    }
    consider(player.pos, function (d) { hurtPlayer(d); });
    allies.forEach(function (a) { consider(a.pos, function (d) { damageAlly(a, d); }); });
    mouseGuards.forEach(function (g) { consider(g.pos, function (d) { damageMouseGuard(g, d); }); });
    if (mouseKing.alive) consider(mouseKing.pos, function (d) { damageMouseKing(d); });
    if (best && bestD > 90) return null;
    return best;
  }

  window.addEventListener('blur', function () { keys = {}; });

  function updateCatUnits(dt) {
    for (var k = soldiers.length - 1; k >= 0; k--) {
      var s = soldiers[k];

      // imperial guards hold their post until provoked
      if (s.stationed) {
        var provoked = s.hp < s.maxHp || (king.alive && king.hp < king.maxHp) ||
          Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z) < 22;
        if (!provoked) {
          s.mesh.position.copy(s.pos);
          continue;
        }
        s.stationed = false;
      }

      var target = catPickTarget(s);
      if (!target) continue;
      var dx = target.pos.x - s.pos.x, dz = target.pos.z - s.pos.z;
      var dist = Math.hypot(dx, dz);
      s.mesh.rotation.y = Math.atan2(-dx, -dz);
      if (dist > SOLDIER_RANGE * 0.8) {
        s.pos.x += (dx / dist) * s.speed * dt;
        s.pos.z += (dz / dist) * s.speed * dt;
        collideCircle(s.pos, 0.4);
        s.walkT += dt * (s.kind === 'catguard' ? 7 : 11);
        var swing = Math.sin(s.walkT) * 0.6;
        s.mesh.userData.legs[0].rotation.x = swing;
        s.mesh.userData.legs[1].rotation.x = -swing;
      }
      s.attackTimer -= dt;
      if (dist < SOLDIER_RANGE && s.attackTimer <= 0) {
        s.attackTimer = s.kind === 'catguard' ? 1.4 : 1.1;
        target.hit(s.dmg);
        if (s.kind === 'catguard') sfx.clang(); else sfx.meow();
        s.pos.x += (dx / dist) * 0.4;
        s.pos.z += (dz / dist) * 0.4;
      }
      s.mesh.position.copy(s.pos);
    }
  }

  function updateMouseGuards(dt) {
    mouseGuards.forEach(function (g) {
      // intercept any cat that threatens the king
      var threat = null, bestD = 1e9;
      soldiers.forEach(function (s) {
        var dKing = Math.hypot(s.pos.x - mouseKing.pos.x, s.pos.z - mouseKing.pos.z);
        if (dKing > 26) return;
        var d = Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z);
        if (d < bestD) { bestD = d; threat = s; }
      });
      g.cool -= dt;
      if (threat) {
        var dx = threat.pos.x - g.pos.x, dz = threat.pos.z - g.pos.z;
        var dist = Math.hypot(dx, dz);
        g.mesh.rotation.y = Math.atan2(-dx, -dz);
        if (dist > 1.9) {
          g.pos.x += (dx / dist) * (GUARD_SPEED + 0.4) * dt;
          g.pos.z += (dz / dist) * (GUARD_SPEED + 0.4) * dt;
          collideCircle(g.pos, 0.4);
          g.walkT += dt * 8;
        } else if (g.cool <= 0) {
          g.cool = 1.2;
          damageSoldierObj(threat, MOUSE_GUARD_DAMAGE);
          sfx.clang();
          sparkBurst(threat.pos.clone().setY(1.2), 8, 0.12, 4, 0.3, 0.3);
        }
      } else if (mouseKing.alive) {
        // patrol a slow circle around the king
        g.angle += dt * 0.6;
        var px = mouseKing.pos.x + Math.cos(g.angle) * 3.6;
        var pz = mouseKing.pos.z + Math.sin(g.angle) * 3.6;
        var ddx = px - g.pos.x, ddz = pz - g.pos.z;
        var dd = Math.hypot(ddx, ddz);
        if (dd > 0.3) {
          g.pos.x += (ddx / dd) * Math.min(GUARD_SPEED * dt, dd);
          g.pos.z += (ddz / dd) * Math.min(GUARD_SPEED * dt, dd);
          g.mesh.rotation.y = Math.atan2(-ddx, -ddz);
          g.walkT += dt * 6;
        }
      }
      g.mesh.position.copy(g.pos);
    });
  }

  function updateAllies(dt) {
    allies.forEach(function (a) {
      a.cool -= dt;
      var moved = false;
      if (a.ammo <= 0) {
        // scavenge: run to the nearest available firework
        var best = null, bestD = 1e9;
        pickups.forEach(function (p) {
          if (p.timer !== 0 || p.type === 'popcorn') return;
          var d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
          if (d < bestD) { bestD = d; best = p; }
        });
        if (best) {
          if (bestD < 1.5) {
            a.ammo += 4;
            consumePickup(best);
            sfx.pickup();
          } else {
            var dx = best.x - a.pos.x, dz = best.z - a.pos.z;
            a.pos.x += (dx / bestD) * 7 * dt;
            a.pos.z += (dz / bestD) * 7 * dt;
            a.mesh.rotation.y = Math.atan2(-dx, -dz);
            moved = true;
          }
        }
      } else {
        // armed: engage the nearest cat, otherwise escort the player
        var tgt = null, td = 1e9;
        tanks.forEach(function (t) {
          if (!t.alive) return;
          var d = Math.hypot(t.x - a.pos.x, t.z - a.pos.z);
          if (d < td) { td = d; tgt = new THREE.Vector3(t.x, 2 * t.scale, t.z); }
        });
        soldiers.forEach(function (s) {
          var d = Math.hypot(s.pos.x - a.pos.x, s.pos.z - a.pos.z);
          if (d < td) { td = d; tgt = new THREE.Vector3(s.pos.x, 1.1, s.pos.z); }
        });
        if (tgt && td < 50) {
          a.mesh.rotation.y = Math.atan2(-(tgt.x - a.pos.x), -(tgt.z - a.pos.z));
          if (a.cool <= 0) {
            a.cool = 2.6;
            a.ammo--;
            var origin = a.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
            var dir = tgt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2))
              .sub(origin).normalize();
            fireProjectile(origin.add(dir.clone().multiplyScalar(0.8)), dir, true);
            sfx.squeak();
          }
        } else {
          var pdx = player.pos.x - a.pos.x, pdz = player.pos.z - a.pos.z;
          var pd = Math.hypot(pdx, pdz);
          if (pd > 9) {
            a.pos.x += (pdx / pd) * 7 * dt;
            a.pos.z += (pdz / pd) * 7 * dt;
            a.mesh.rotation.y = Math.atan2(-pdx, -pdz);
            moved = true;
          }
        }
      }
      if (moved) {
        collideCircle(a.pos, 0.4);
        a.walkT += dt * 10;
      }
      a.mesh.position.copy(a.pos);
      a.mesh.position.y = moved ? Math.abs(Math.sin(a.walkT)) * 0.1 : 0;
    });
  }

  function updateProjectiles(dt) {
    for (var k = projectiles.length - 1; k >= 0; k--) {
      var p = projectiles[k];
      p.life -= dt;
      p.age += dt;

      if (p.seek && p.age > 0.15) {
        var tgt = nearestEnemyTo(p.mesh.position);
        if (tgt) {
          var desired = tgt.sub(p.mesh.position).normalize();
          var cur = p.vel.clone().normalize();
          cur.lerp(desired, Math.min(1, SEEKER_TURN * dt)).normalize();
          p.vel.copy(cur.multiplyScalar(SEEKER_SPEED));
          p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
        }
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      var pos = p.mesh.position;

      // ember spray + glowing trail behind every rocket
      var sparkCount = Math.round((p.friendly ? 4 : 2) * PFX);
      for (var sp = 0; sp < sparkCount; sp++) {
        var along = pos.clone().addScaledVector(p.vel, -dt * Math.random());
        var backVel = p.vel.clone().multiplyScalar(-0.06).add(new THREE.Vector3(
          (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5
        ));
        var roll = Math.random();
        if (p.seek) tmpColor.setHSL(0.53 + Math.random() * 0.1, 1, 0.6 + Math.random() * 0.25);
        else if (roll < 0.55) tmpColor.setHSL(0.07 + Math.random() * 0.06, 1, 0.55 + Math.random() * 0.2);
        else if (roll < 0.85) tmpColor.setHSL(0.12, 0.9, 0.75);
        else tmpColor.setRGB(1, 1, 1);
        spawnParticle(along, backVel, tmpColor.clone(), 0.35 + Math.random() * 0.35,
          { gravity: 6, drag: 1.5, size: 0.4, endSize: 0.1, fade: 0.7 });
      }
      // soft glow puff that lingers along the flight path
      if (Math.random() < 0.55) {
        tmpColor.setHSL(p.seek ? 0.56 : 0.08, 0.9, 0.3);
        spawnParticle(pos.clone(), new THREE.Vector3(0, 0.4, 0), tmpColor.clone(), 0.5,
          { gravity: 0, size: 0.9, endSize: 1.8, fade: 1.4 });
      }

      var boom = false;
      if (p.life <= 0 || pos.y <= 0.15) boom = true;
      else if (p.age > 0.18 && pointHitsObstacle(pos.x, pos.z, 0.2, pos.y) && pos.y < 10) boom = true;
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
        if (Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) < 1 && Math.abs(pos.y - player.pos.y - 1.2) < 1.6) boom = true;
      }

      if (boom) {
        explode(pos.clone(), p.friendly);
        scene.remove(p.mesh);
        projectiles.splice(k, 1);
      }
    }
  }

  function updateBillboards() {
    var q = camera.quaternion;
    tanks.forEach(function (t) { if (t.alive) t.bar.quaternion.copy(q); });
    soldiers.forEach(function (s) { s.bar.quaternion.copy(q); });
    // friendly bars only appear once they've taken damage
    allies.forEach(function (a) { a.bar.visible = a.hp < a.maxHp; a.bar.quaternion.copy(q); });
    mouseGuards.forEach(function (g) { g.bar.visible = g.hp < g.maxHp; g.bar.quaternion.copy(q); });
    if (mouseKing.alive) {
      mouseKing.bar.visible = mouseKing.hp < mouseKing.maxHp;
      mouseKing.bar.quaternion.copy(q);
    }
  }

  function updateAmbient(dt) {
    clouds.forEach(function (c) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 140) c.mesh.position.x = -140;
    });
    // butterflies flutter along wandering loops
    butterflies.forEach(function (b) {
      var u = b.userData;
      var t = elapsed * u.speed + u.phase;
      var nx = u.cx + Math.cos(t) * u.r;
      var nz = u.cz + Math.sin(t * 0.7) * u.r;
      var ny = 1.1 + Math.sin(t * 2.3) * 0.5;
      b.rotation.y = Math.atan2(-(nx - b.position.x), -(nz - b.position.z));
      b.position.set(nx, ny, nz);
      var flap = Math.sin(elapsed * 16 + u.phase) * 0.9;
      u.wings[0].rotation.z = flap;
      u.wings[1].rotation.z = -flap;
    });
    // fireflies drift around the mouse house
    if (Math.random() < dt * 10) {
      tmpColor.setHSL(0.18 + Math.random() * 0.1, 1, 0.6);
      spawnParticle(
        new THREE.Vector3(HOUSE_X + (Math.random() - 0.5) * 34, 0.8 + Math.random() * 4, HOUSE_Z - 10 + (Math.random() - 0.5) * 16),
        new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6),
        tmpColor.clone(), 1.6, { gravity: -0.1, size: 0.22, endSize: 0.05, fade: 1.2 });
    }
    // king idles; attic leaders bob when the conference has been joined
    if (mouseKing.alive) {
      mouseKing.t += dt;
      mouseKing.mesh.position.y = Math.abs(Math.sin(mouseKing.t * 1.5)) * 0.06;
      mouseKing.mesh.rotation.y = Math.sin(mouseKing.t * 0.4) * 0.6;
    }
    if (atticDone) {
      atticLeaders.forEach(function (m, i) {
        m.position.y = 6.15 + Math.abs(Math.sin(elapsed * 5 + i)) * 0.18;
      });
    }
  }

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
      updateWrath();
      updatePlayer(dt);
      updatePickups(dt);
      updateTanks(dt);
      updateCatUnits(dt);
      updateMouseGuards(dt);
      updateAllies(dt);
      updateProjectiles(dt);
      updateHud();
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.style.opacity = '0';
      }
    } else if (state === 'won') {
      updateVictory(dt);
    }
    updateAmbient(dt);
    updateParticles(dt);
    updateRings(dt);
    updateDebris(dt);
    updateBoomLights(dt);
    updateCrackles(dt);
    updateBillboards();
    renderer.render(scene, camera);
  }

  camera.position.set(10, 7, 122);
  camera.lookAt(0, 3, 90);
  updateHud();
  setWeapon('normal');
  requestAnimationFrame(loop);

  // small debug/testing handle
  window.WWM = {
    player: player, tanks: tanks, soldiers: soldiers, allies: allies,
    mouseKing: mouseKing, mouseGuards: mouseGuards, king: king, camera: camera,
    pickups: pickups, getState: function () { return state; }
  };
})();
