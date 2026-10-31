// 暗棋立體棋盤（Three.js）：西洋棋造型棋子＋中文字腰帶，蓋著的棋用罩杯蓋住，翻棋時掀開。
// 介面與平面棋盤相同：mount / unmount / onCell / sync / mark
var DanqiBoard3D = (function () {
  'use strict';
  const E = DanqiEngine;

  const DEFAULT_THEME = {
    background: '#2a1e16', fog: null, transparent: false,
    boardTop: '#e2bf86', boardTop2: null, boardSide: '#7a4e25', gridLine: 'rgba(90,55,25,.65)', boardBorder: 'rgba(90,55,25,.9)',
    red: { color: '#c62828', roughness: 0.35, metalness: 0, clearcoat: 0.6 },
    black: { color: '#1f1f22', roughness: 0.35, metalness: 0, clearcoat: 0.6 },
    bandRed: { bg: '#f7ecd6', ink: '#b3261e', rule: '#b3261e' },
    bandBlack: { bg: '#f7ecd6', ink: '#1a1a1a', rule: '#1a1a1a' },
    cup: { color: '#5b3a1f', roughness: 0.45, metalness: 0, clearcoat: 0.4 },
    select: '#1e88e5', target: '#1e88e5', capture: '#e53935', last: '#ffd54f',
    font: '"Noto Serif TC","Noto Sans TC","Microsoft JhengHei","PingFang TC",serif',
    hemiSky: '#ffffff', hemiGround: '#6b5a48', hemi: 0.9, sun: '#fff4e0', sunI: 2.4, fill: '#9fb4ff', fillI: 0.5,
    exposure: 1.05, pieceScale: 1
  };

  // ───── 幾何（所有棋子共用，只建一次） ─────
  let GEO = null;
  function V(r, y) { return new THREE.Vector2(r, y); }
  function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(p => V(p[0], p[1])), seg || 40); }
  function buildGeometry() {
    const T = THREE;
    const base = lathe([[0, 0], [0.41, 0], [0.42, 0.025], [0.42, 0.07], [0.38, 0.09], [0.37, 0.09]]);
    const collar = new T.CylinderGeometry(0.372, 0.372, 0.21, 64, 1, true);
    collar.translate(0, 0.195, 0);
    const parts = {};
    // 兵：圓頭
    parts[6] = [
      { g: lathe([[0.37, 0.24], [0.32, 0.27], [0.24, 0.3], [0.16, 0.38], [0.12, 0.5], [0.2, 0.53], [0.2, 0.56], [0.11, 0.58], [0, 0.58]]) },
      { g: new T.SphereGeometry(0.16, 32, 20), y: 0.72 }
    ];
    // 俥：城堡
    const rookParts = [{ g: lathe([[0.37, 0.24], [0.3, 0.28], [0.24, 0.32], [0.21, 0.7], [0.29, 0.74], [0.3, 0.86], [0.21, 0.86], [0.21, 0.8], [0, 0.8]]) }];
    for (let i = 0; i < 4; i++) {
      const b = new T.BoxGeometry(0.13, 0.11, 0.1);
      const a = i * Math.PI / 2 + Math.PI / 4;
      b.rotateY(-a);
      b.translate(Math.cos(a) * 0.24, 0.915, Math.sin(a) * 0.24);
      rookParts.push({ g: b });
    }
    parts[3] = rookParts;
    // 相：主教帽
    const mitre = new T.SphereGeometry(0.16, 32, 24);
    mitre.scale(1, 1.4, 1);
    parts[2] = [
      { g: lathe([[0.37, 0.24], [0.3, 0.28], [0.22, 0.32], [0.14, 0.56], [0.22, 0.59], [0.12, 0.62], [0, 0.62]]) },
      { g: mitre, y: 0.8 },
      { g: new T.SphereGeometry(0.05, 16, 12), y: 1.04 }
    ];
    // 仕：皇后冠
    const queen = [
      { g: lathe([[0.37, 0.24], [0.3, 0.28], [0.22, 0.32], [0.13, 0.62], [0.21, 0.66], [0.14, 0.69], [0.17, 0.82], [0.26, 0.93], [0.2, 0.95], [0, 0.91]]) },
      { g: new T.SphereGeometry(0.07, 16, 12), y: 1.0 }
    ];
    for (let i = 0; i < 8; i++) {
      const s = new T.SphereGeometry(0.042, 12, 10), a = i * Math.PI / 4;
      s.translate(Math.cos(a) * 0.24, 0.96, Math.sin(a) * 0.24);
      queen.push({ g: s });
    }
    parts[1] = queen;
    // 帥：國王十字
    const v = new T.BoxGeometry(0.07, 0.24, 0.07); v.translate(0, 1.12, 0);
    const h = new T.BoxGeometry(0.2, 0.07, 0.07); h.translate(0, 1.15, 0);
    parts[0] = [
      { g: lathe([[0.37, 0.24], [0.3, 0.28], [0.23, 0.32], [0.14, 0.66], [0.22, 0.7], [0.15, 0.73], [0.18, 0.88], [0.25, 0.96], [0.18, 0.99], [0, 1.0]]) },
      { g: v }, { g: h }
    ];
    // 傌：馬頭（側面輪廓擠出）
    const sh = new T.Shape();
    const pts = [[-0.2, 0.36], [0.2, 0.36], [0.15, 0.5], [0.29, 0.6], [0.33, 0.69], [0.22, 0.79], [0.11, 0.9], [0.05, 1.02], [-0.02, 0.92], [-0.15, 0.86], [-0.24, 0.66]];
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const head = new T.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3 });
    head.translate(0, 0, -0.1);
    parts[4] = [
      { g: lathe([[0.37, 0.24], [0.31, 0.28], [0.26, 0.33], [0.25, 0.4], [0, 0.4]]) },
      { g: head }
    ];
    // 炮：砲台（西洋棋沒有，自訂）
    const barrel = new T.CylinderGeometry(0.075, 0.095, 0.64, 24);
    barrel.rotateX(Math.PI / 2 - 0.35);
    barrel.translate(0, 0.66, 0.05);
    const muzzle = new T.TorusGeometry(0.085, 0.025, 10, 24);
    muzzle.rotateX(-0.35);
    muzzle.translate(0, 0.77, 0.35);
    const wheelL = new T.CylinderGeometry(0.17, 0.17, 0.05, 28); wheelL.rotateZ(Math.PI / 2); wheelL.translate(-0.17, 0.6, -0.04);
    const wheelR = wheelL.clone(); wheelR.translate(0.34, 0, 0);
    parts[5] = [
      { g: lathe([[0.37, 0.24], [0.3, 0.28], [0.24, 0.33], [0.19, 0.46], [0.23, 0.5], [0, 0.5]]) },
      { g: barrel }, { g: muzzle }, { g: wheelL }, { g: wheelR }
    ];
    // 罩杯
    const cup = lathe([[0.44, 0], [0.455, 0.03], [0.425, 0.07], [0.395, 0.4], [0.35, 0.56], [0.25, 0.66], [0.1, 0.705], [0, 0.71]], 48);
    const knob = new T.SphereGeometry(0.075, 20, 14); knob.translate(0, 0.75, 0);
    GEO = { base, collar, parts, cup, knob };
  }

  function create(themeIn) {
    if (!window.THREE) throw new Error('找不到 Three.js（vendor/three.global.js 沒有載入）');
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('此裝置不支援 WebGL');
    const T = THREE;
    const th = Object.assign({}, DEFAULT_THEME, themeIn || {});
    if (!GEO) buildGeometry();

    let stage, renderer, scene, camera, ro, raf = 0, clickCb = null, alive = false;
    let boardTexCanvas, boardTex, hlGroup;
    const objs = new Map();          // id → { group, sq, hidden, code }
    const tweens = [];
    const view = { theta: 0, phi: 0.82, radius: 14, portrait: false, userMoved: false };
    let mats = null, rim = null, head = null;
    const charTex = new Map();       // 棋子代碼 → 字樣材質

    function phys(o) { return new T.MeshPhysicalMaterial({ color: o.color, roughness: o.roughness, metalness: o.metalness || 0, clearcoat: o.clearcoat || 0, clearcoatRoughness: 0.25 }); }

    function cellPos(sq) { return new T.Vector3(sq % E.COLS - 3.5, 0, Math.floor(sq / E.COLS) - 1.5); }

    // ───── 字樣腰帶 ─────
    function drawBand(canvas, code) {
      const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
      const band = E.colorOf(code) === 0 ? th.bandRed : th.bandBlack;
      ctx.fillStyle = band.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = band.rule; ctx.fillRect(0, 10, W, 8); ctx.fillRect(0, H - 18, W, 8);
      ctx.fillStyle = band.ink;
      ctx.font = '900 196px ' + th.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) ctx.fillText(E.nameOf(code), W / 8 + i * W / 4, H / 2 + 8);
    }
    function bandMaterial(code) {
      let m = charTex.get(code);
      if (!m) {
        const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
        drawBand(c, code);
        const tex = new T.CanvasTexture(c);
        tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 4;
        m = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.5 });
        m.userData.canvas = c;
        charTex.set(code, m);
      }
      return m;
    }

    // 名牌：永遠面向鏡頭的小圓牌，手機上也看得清楚是什麼棋
    const badgeTex = new Map();
    function drawBadge(canvas, code) {
      const ctx = canvas.getContext('2d'), S = canvas.width;
      const b = (E.colorOf(code) === 0 ? th.badgeRed : th.badgeBlack) || (E.colorOf(code) === 0 ? th.bandRed : th.bandBlack);
      ctx.clearRect(0, 0, S, S);
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
      ctx.fillStyle = b.bg; ctx.fill();
      ctx.lineWidth = 12; ctx.strokeStyle = b.rule; ctx.stroke();
      ctx.fillStyle = b.ink; ctx.font = '900 ' + Math.round(S * 0.6) + 'px ' + th.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(E.nameOf(code), S / 2, S / 2 + S * 0.04);
    }
    function badgeMaterial(code) {
      let m = badgeTex.get(code);
      if (!m) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        drawBadge(c, code);
        const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
        m = new T.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }); // 永遠畫在最上層，後排的棋也看得到
        m.userData.canvas = c;
        badgeTex.set(code, m);
      }
      return m;
    }
    function addBadge(o) {
      if (th.badge === false) return;
      o.badge = new T.Sprite(badgeMaterial(o.code));
      o.badge.scale.setScalar(th.badgeSize || 0.42);
      o.badge.renderOrder = 5;
      o.group.add(o.badge);
    }

    // ───── 棋盤 ─────
    function drawBoard() {
      const c = boardTexCanvas, ctx = c.getContext('2d'), W = c.width, H = c.height;
      const u = W / 8.6; // 每單位格子的像素
      ctx.fillStyle = th.boardTop; ctx.fillRect(0, 0, W, H);
      const ox = 0.3 * u, oy = 0.3 * u;
      if (th.boardTop2) {
        ctx.fillStyle = th.boardTop2;
        for (let r = 0; r < 4; r++) for (let col = 0; col < 8; col++) if ((r + col) % 2) ctx.fillRect(ox + col * u, oy + r * u, u, u);
      }
      ctx.strokeStyle = th.gridLine; ctx.lineWidth = Math.max(2, u * 0.02);
      for (let col = 0; col <= 8; col++) { ctx.beginPath(); ctx.moveTo(ox + col * u, oy); ctx.lineTo(ox + col * u, oy + 4 * u); ctx.stroke(); }
      for (let r = 0; r <= 4; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * u); ctx.lineTo(ox + 8 * u, oy + r * u); ctx.stroke(); }
      ctx.strokeStyle = th.boardBorder; ctx.lineWidth = u * 0.05;
      ctx.strokeRect(ox - u * 0.12, oy - u * 0.12, 8 * u + u * 0.24, 4 * u + u * 0.24);
      boardTex.needsUpdate = true;
    }

    // ───── 描邊（反向外殼）：沿法線把背面往外推一點，畫成單色，深色棋子的輪廓才看得出來 ─────
    const outlineMats = [null, null];
    function outlineMaterial(colorIdx) {
      const o = th.outline && th.outline[colorIdx];
      if (!o) return null;
      if (!outlineMats[colorIdx]) {
        const m = new T.MeshBasicMaterial({ color: o.color, side: T.BackSide });
        const w = (o.width || 0.014).toFixed(4);
        m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normal * ' + w + ';'); };
        outlineMats[colorIdx] = m;
      }
      return outlineMats[colorIdx];
    }

    // ───── 棋子物件 ─────
    function buildPiece(code) {
      const grp = new T.Group();
      const m = E.colorOf(code) === 0 ? mats.red : mats.black;
      const add = (g, mat, y) => { const mesh = new T.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; if (y) mesh.position.y = y; grp.add(mesh); return mesh; };
      const om = outlineMaterial(E.colorOf(code));
      const addOutlined = (g, y) => { add(g, m, y); if (om) { const s = new T.Mesh(g, om); if (y) s.position.y = y; grp.add(s); } };
      addOutlined(GEO.base);
      add(GEO.collar, bandMaterial(code));
      // 腰帶加高後，上半身整體往上抬一點
      for (const p of GEO.parts[E.typeOf(code)]) addOutlined(p.g, (p.y || 0) + 0.06);
      // 黑方馬頭、砲口朝另一邊
      if (E.colorOf(code) === 1) grp.rotation.y = Math.PI;
      grp.scale.setScalar(th.pieceScale);
      return grp;
    }
    function buildCup() {
      const grp = new T.Group();
      const a = new T.Mesh(GEO.cup, mats.cup), b = new T.Mesh(GEO.knob, mats.cup);
      a.castShadow = b.castShadow = true; a.receiveShadow = true;
      grp.add(a, b);
      grp.scale.setScalar(th.pieceScale);
      return grp;
    }

    // ───── 補間動畫 ─────
    const ease = t => 1 - Math.pow(1 - t, 3);
    function tween(dur, fn, done, delay) {
      tweens.push({ t0: performance.now() + (delay || 0), dur, fn, done });
    }
    function runTweens(now) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        if (now < tw.t0) continue;
        const k = Math.min(1, (now - tw.t0) / tw.dur);
        tw.fn(k);
        if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
      }
    }

    // ───── 視角 ─────
    // 鏡頭要框住的點：棋盤四角、棋子高度、底座（有的話）
    const corners = [], fitX = (th.fit && th.fit.x) || 0.94, fitY = (th.fit && th.fit.y) || 0.9;
    const lowY = th.plinth ? -0.36 - th.plinth.h : 0, halfX = th.plinth ? 4.7 : 4.3, halfZ = th.plinth ? 2.7 : 2.3;
    for (const y of [lowY, 0.95]) for (const x of [-halfX, halfX]) for (const z of [-halfZ, halfZ]) corners.push(new T.Vector3(x, y, z));
    function placeCamera(r) {
      const sp = Math.sin(view.phi);
      camera.position.set(r * sp * Math.sin(view.theta), r * Math.cos(view.phi), r * sp * Math.cos(view.theta));
      camera.lookAt(0, 0.15, 0);
      camera.updateMatrixWorld();
      if (head) head.position.copy(camera.position).add(new T.Vector3(0, 2, 0));
      if (rim) rim.position.set(-camera.position.x * 0.8, Math.abs(camera.position.y) * 0.6 + 3, -camera.position.z * 0.8);
    }
    function fits(r) {
      placeCamera(r);
      const v = new T.Vector3();
      for (const c of corners) { v.copy(c).project(camera); if (Math.abs(v.x) > fitX || Math.abs(v.y) > fitY) return false; }
      return true;
    }
    function fitCamera() {
      let lo = 3, hi = 200;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      view.radius = hi;
      placeCamera(hi);
    }
    function defaultView() {
      view.theta = view.portrait ? Math.PI / 2 : 0;
      view.phi = view.portrait ? 0.55 : 0.7;
      view.userMoved = false;
      fitCamera();
    }

    function resize() {
      const w = stage.clientWidth, h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const portrait = h > w * 1.05;
      if (portrait !== view.portrait || !view.userMoved) { view.portrait = portrait; defaultView(); }
      else fitCamera();
    }

    // ───── 高亮 ─────
    let hl = null, selectedSq = -1;
    function buildHighlights() {
      hlGroup = new T.Group();
      scene.add(hlGroup);
      const flat = g => { g.rotateX(-Math.PI / 2); return g; };
      const basic = (color, op) => new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });
      hl = {
        last: [0, 1].map(() => new T.Mesh(flat(new T.PlaneGeometry(0.94, 0.94)), basic(th.last, 0.38))),
        sel: new T.Mesh(flat(new T.RingGeometry(0.46, 0.56, 48)), basic(th.select, 0.95)),
        dots: [], rings: []
      };
      for (let i = 0; i < 16; i++) {
        hl.dots.push(new T.Mesh(flat(new T.CircleGeometry(0.11, 24)), basic(th.target, 0.85)));
        hl.rings.push(new T.Mesh(flat(new T.RingGeometry(0.42, 0.5, 48)), basic(th.capture, 0.9)));
      }
      [...hl.last, hl.sel, ...hl.dots, ...hl.rings].forEach(m => { m.visible = false; m.renderOrder = 2; hlGroup.add(m); });
    }

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      runTweens(now);
      if (th.autoSpin && !view.userMoved) { view.theta += th.autoSpin * Math.min(0.05, (now - (frame.last || now)) / 1000); fitCamera(); }
      frame.last = now;
      const pulse = 0.55 + 0.4 * Math.sin(now / 160);
      for (const r of hl.rings) if (r.visible) r.material.opacity = pulse;
      const dx = camera.position.x, dz = camera.position.z, len = Math.hypot(dx, dz) || 1;
      objs.forEach(o => {
        if (o.badge) o.badge.position.set(dx / len * 0.47, 0.2, dz / len * 0.47);
        if (o.piece) {
          const want = o.sq === selectedSq ? 0.24 + Math.sin(now / 180) * 0.04 : 0;
          o.piece.position.y += (want - o.piece.position.y) * 0.25;
          if (o.badge) o.badge.position.y += o.piece.position.y;
        }
      });
      renderer.render(scene, camera);
    }

    // ───── 點擊與拖曳旋轉 ─────
    function bindPointer(el) {
      let down = null;
      const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
      el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, theta: view.theta, phi: view.phi, drag: false }; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.drag && Math.hypot(dx, dy) > 7) down.drag = true;
        if (down.drag) {
          view.theta = down.theta - dx * 0.008;
          view.phi = Math.min(1.25, Math.max(0.22, down.phi - dy * 0.006));
          view.userMoved = true;
          fitCamera();
        }
      });
      el.addEventListener('pointerup', e => {
        if (!down) return;
        const wasDrag = down.drag;
        down = null;
        if (wasDrag) return;
        const rect = el.getBoundingClientRect();
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        // 先打棋子（立著的棋子比地面好點），打不到再算地面格子
        const meshes = [];
        objs.forEach(o => o.group.traverse(m => { if (m.isMesh) { m.userData.sq = o.sq; meshes.push(m); } }));
        const hits = ray.intersectObjects(meshes, false);
        let sq = -1;
        if (hits.length) sq = hits[0].object.userData.sq;
        else if (ray.ray.intersectPlane(plane, hit)) {
          const c = Math.round(hit.x + 3.5), r = Math.round(hit.z + 1.5);
          if (c >= 0 && c < 8 && r >= 0 && r < 4) sq = r * 8 + c;
        }
        if (sq >= 0 && clickCb) clickCb(sq);
      });
      el.addEventListener('pointercancel', () => { down = null; });
      el.addEventListener('dblclick', () => defaultView());
    }

    return {
      mount(st) {
        stage = st;
        renderer = new T.WebGLRenderer({ antialias: true, alpha: !!th.transparent });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = th.exposure;
        renderer.outputColorSpace = T.SRGBColorSpace;
        const cv = renderer.domElement;
        // 畫布鋪滿整個舞台（含 padding），尺寸計算才一致
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:pointer;';
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', '立體棋盤：點棋子操作，拖曳可旋轉視角，連點兩下回到預設視角');
        stage.appendChild(cv);

        scene = new T.Scene();
        if (!th.transparent) scene.background = new T.Color(th.background);
        if (th.fog) scene.fog = new T.Fog(th.fog.color, th.fog.near, th.fog.far);
        camera = new T.PerspectiveCamera(th.fov || 32, 1, 0.1, 400); // 視角越小越接近等角俯視

        scene.add(new T.HemisphereLight(th.hemiSky, th.hemiGround, th.hemi));
        const sun = new T.DirectionalLight(th.sun, th.sunI);
        sun.position.set(4, 10, 6);
        sun.castShadow = true;
        const small = Math.min(window.innerWidth, window.innerHeight) < 600;
        sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
        Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5, near: 1, far: 30 });
        sun.shadow.bias = -0.0005;
        sun.shadow.radius = 4;
        scene.add(sun);
        const fill = new T.DirectionalLight(th.fill, th.fillI);
        fill.position.set(-6, 4, -5);
        scene.add(fill);
        if (th.rimI) {
          // 輪廓光跟著鏡頭轉，永遠從棋子背後打亮邊緣
          rim = new T.DirectionalLight(th.rim || '#ffffff', th.rimI);
          scene.add(rim);
        }
        if (th.headI) {
          // 跟著鏡頭的柔光：面向玩家的那一面（例如馬頭側面）不會整片黑掉
          head = new T.PointLight(th.head || '#ffffff', th.headI, 0, 0);
          scene.add(head);
        }

        mats = { red: phys(th.red), black: phys(th.black), cup: phys(th.cup) };

        boardTexCanvas = document.createElement('canvas');
        boardTexCanvas.width = 2048; boardTexCanvas.height = Math.round(2048 * 4.6 / 8.6);
        boardTex = new T.CanvasTexture(boardTexCanvas);
        boardTex.colorSpace = T.SRGBColorSpace;
        boardTex.anisotropy = 8;
        drawBoard();
        const side = new T.MeshStandardMaterial({ color: th.boardSide, roughness: 0.6 });
        const top = new T.MeshStandardMaterial({ map: boardTex, roughness: 0.75 });
        const board = new T.Mesh(new T.BoxGeometry(8.6, 0.36, 4.6), [side, side, top, side, side, side]);
        board.position.y = -0.18;
        board.receiveShadow = true;
        scene.add(board);
        if (th.plinth) {
          const pl = new T.Mesh(new T.BoxGeometry(9.4, th.plinth.h, 5.4), new T.MeshStandardMaterial({ color: th.plinth.color, roughness: 0.8 }));
          pl.position.y = -0.36 - th.plinth.h / 2;
          pl.receiveShadow = true;
          scene.add(pl);
        }
        if (th.ground) {
          const gr = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: th.ground.shadow }));
          gr.rotation.x = -Math.PI / 2;
          gr.position.y = th.ground.y;
          gr.receiveShadow = true;
          scene.add(gr);
        }
        buildHighlights();
        bindPointer(cv);

        ro = new ResizeObserver(resize);
        ro.observe(stage);
        resize();
        alive = true;
        raf = requestAnimationFrame(frame);

        // 字型載入後重畫棋子上的字
        if (document.fonts && document.fonts.load) {
          document.fonts.load('900 100px ' + th.font).then(() => {
            charTex.forEach((m, code) => { drawBand(m.userData.canvas, code); m.map.needsUpdate = true; });
            badgeTex.forEach((m, code) => { drawBadge(m.userData.canvas, code); m.map.needsUpdate = true; });
          }).catch(e => console.warn('[暗棋] 字型載入失敗，使用系統字型：', e));
        }
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        }
        charTex.forEach(m => { m.map.dispose(); m.dispose(); });
        outlineMats.forEach(m => m && m.dispose());
        badgeTex.forEach(m => { m.map.dispose(); m.dispose(); });
        objs.clear();
      },
      onCell(cb) { clickCb = cb; window.__click = sq => clickCb && clickCb(sq); },
      sync(s) {
        const present = new Set();
        for (let sq = 0; sq < E.N; sq++) {
          const id = s.ids[sq];
          if (id < 0) continue;
          present.add(id);
          const v = s.cells[sq], hidden = v === E.HIDDEN;
          let o = objs.get(id);
          const target = cellPos(sq);
          if (!o) {
            o = { group: new T.Group(), sq, hidden, code: hidden ? -1 : v, piece: null, cup: null };
            if (hidden) { o.cup = buildCup(); o.group.add(o.cup); }
            else { o.piece = buildPiece(v); o.group.add(o.piece); addBadge(o); }
            o.group.position.copy(target);
            scene.add(o.group);
            objs.set(id, o);
            continue;
          }
          // 翻棋：罩杯掀起飛走，棋子彈出來
          if (o.hidden && !hidden) {
            o.hidden = false; o.code = v;
            const cup = o.cup; o.cup = null;
            o.piece = buildPiece(v);
            o.piece.scale.setScalar(0.01);
            o.group.add(o.piece);
            const s0 = th.pieceScale;
            cup.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
            tween(520, k => {
              const e = ease(k);
              cup.position.y = e * 1.8; cup.rotation.x = -e * 0.9; cup.position.z = -e * 0.4;
              cup.traverse(m => { if (m.isMesh) m.material.opacity = 1 - k; });
            }, () => { o.group.remove(cup); cup.traverse(m => { if (m.isMesh) m.material.dispose(); }); });
            const pc = o.piece; // 動畫中途可能被悔棋拿掉，用區域變數保住參照
            tween(420, k => { const b = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.18 : 1; pc.scale.setScalar(s0 * Math.max(0.01, ease(k)) * b); }, null, 120);
            addBadge(o);
            if (o.badge) { const bs = th.badgeSize || 0.42, bd = o.badge; bd.scale.setScalar(0.01); tween(300, k => bd.scale.setScalar(bs * Math.max(0.01, ease(k))), null, 380); }
          } else if (!o.hidden && hidden) {
            // 悔棋退回翻棋前
            if (o.piece) o.group.remove(o.piece);
            if (o.badge) o.group.remove(o.badge);
            o.piece = null; o.badge = null; o.hidden = true; o.code = -1;
            o.cup = buildCup(); o.group.add(o.cup);
          }
          // 移動：一般滑過去，吃子或遠距用跳的
          if (o.sq !== sq) {
            const from = o.group.position.clone(), dist = from.distanceTo(target);
            const capture = s.lastMove && s.lastMove.type === 'cap' && s.lastMove.to === sq;
            const arc = capture || dist > 1.5 ? 0.55 + dist * 0.12 : 0.12;
            const grp = o.group;
            tween(capture ? 380 : 320, k => {
              const e = ease(k);
              grp.position.lerpVectors(from, target, e);
              grp.position.y = Math.sin(Math.PI * k) * arc;
            }, () => grp.position.copy(target));
            o.sq = sq;
          }
        }
        // 被吃掉：倒下、沉下去、淡出
        for (const [id, o] of objs) {
          if (present.has(id)) continue;
          objs.delete(id);
          const grp = o.group;
          grp.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
          const tilt = (Math.random() < 0.5 ? -1 : 1) * 1.4;
          tween(480, k => {
            const e = ease(k);
            grp.rotation.z = tilt * e;
            grp.position.y = -e * 0.5;
            grp.scale.setScalar(1 - e * 0.5);
            grp.traverse(m => { if (m.isMesh) m.material.opacity = 1 - k; });
          }, () => { scene.remove(grp); grp.traverse(m => { if (m.isMesh) m.material.dispose(); }); }, 180);
        }
      },
      mark(m) {
        let i = 0;
        m.last.forEach(sq => { if (i < 2) { const h = hl.last[i++]; h.position.copy(cellPos(sq)).setY(0.004); h.visible = true; } });
        for (; i < 2; i++) hl.last[i].visible = false;
        selectedSq = m.selected == null ? -1 : m.selected;
        hl.sel.visible = m.selected != null;
        if (m.selected != null) hl.sel.position.copy(cellPos(m.selected)).setY(0.008);
        let d = 0, r = 0;
        m.targets.forEach((isCap, sq) => {
          const mesh = isCap ? hl.rings[r++] : hl.dots[d++];
          if (!mesh) return;
          mesh.position.copy(cellPos(sq)).setY(0.012);
          mesh.visible = true;
        });
        for (; d < hl.dots.length; d++) hl.dots[d].visible = false;
        for (; r < hl.rings.length; r++) hl.rings[r].visible = false;
      },
      resetView() { defaultView(); }
    };
  }
  return { create };
})();
