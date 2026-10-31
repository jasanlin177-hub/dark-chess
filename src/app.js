// 暗棋畫面：B 方圓（田中一光幾何）版面的互動邏輯
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  DanqiSound.setTimbre('wood');
  let lastOpts = null, noteTimer = null;

  // 立體主題：霧面陶瓷，紙上的方格
  const theme3d = {
    transparent: true, fov: 28,
    boardTop: '#F4EEDF', boardSide: '#141414', gridLine: 'rgba(20,20,20,.9)', boardBorder: 'rgba(20,20,20,1)',
    red: { color: '#C8341C', roughness: 0.75, clearcoat: 0 },
    black: { color: '#36363D', roughness: 0.36, clearcoat: 0.6 },  // 炭黑帶光澤，受光面才看得出造型
    outline: [{ color: '#7A1C0E', width: 0.012 }, { color: '#EFE7D6', width: 0.022 }],  // 黑棋用紙色描邊勾出剪影
    rim: '#FFF6E0', rimI: 1.6, headI: 0.9,
    bandRed: { bg: '#EFE7D6', ink: '#C8341C', rule: '#C8341C' },
    bandBlack: { bg: '#EFE7D6', ink: '#141414', rule: '#141414' },
    badgeRed: { bg: '#D9381E', ink: '#EFE7D6', rule: '#D9381E' },
    badgeBlack: { bg: '#141414', ink: '#EFE7D6', rule: '#141414' },
    cup: { color: '#2E4A62', roughness: 0.8, clearcoat: 0 },
    select: '#E3B23C', target: '#141414', capture: '#D9381E', last: '#E3B23C',
    hemiSky: '#ffffff', hemiGround: '#8a7f6a', hemi: 1.0, sun: '#ffffff', sunI: 2.2, fillI: 0.3, exposure: 1.0,
    ground: { y: -0.37, shadow: 0.18 },
    sunPos: [2, 12, 3],  // 光從接近正上方打下來，影子短，不會投到棋盤外
    font: '"Noto Serif TC","PMingLiU","Songti TC",serif'
  };

  function note(msg) { const n = $('note'); n.textContent = msg; n.hidden = false; clearTimeout(noteTimer); noteTimer = setTimeout(() => { n.hidden = true; }, 6000); }
  function plHTML(p, v) {
    return '<span class="disc ' + (p.color < 0 ? '' : 'c' + p.color) + '"></span><span class="nm">' + p.name + '</span><span>' + p.colorName + '</span>' +
      (p.thinking ? '<span class="turn">思考中</span>' : p.active ? '<span class="turn">輪到</span>' : '') +
      '<span class="eat" aria-label="吃掉的棋">' + p.captured.map(c => '<i class="c' + v.colorOf(c) + '">' + v.nameOf(c) + '</i>').join('') + '</span>';
  }
  function onRender(v) {
    $('pTop').innerHTML = plHTML(v.players[1 - v.bottom], v);
    $('pBot').innerHTML = plHTML(v.players[v.bottom], v);
    $('status').textContent = v.status;
    $('noCap').innerHTML = v.nearDraw ? '<span class="near">未吃子 ' + v.noCap + ' / ' + v.drawLimit + '（將和局）</span>' : '未吃子 ' + v.noCap + ' / ' + v.drawLimit;
    $('lvl').textContent = (v.mode === 'ai' ? '電腦・' + v.levelName : '兩人對戰') + '・' + ruleName(v.state.rules);
    $('bStop').hidden = !v.chainPending;
    $('bUndo').disabled = $('bEndUndo').disabled = !v.canUndo;
  }
  const game = DanqiGame.create({
    stage: $('stage'), theme3d, onRender, onNotice: note,
    onResult: v => { $('eT').textContent = v.result.title; $('eWhy').textContent = v.result.reason; $('ovEnd').hidden = false; }
  });
  const pick = n => document.querySelector('input[name="' + n + '"]:checked').value;
  // 規則選項：從規則視窗的開關讀，開局時帶進對局（下到一半改開關不影響這一局）
  const currentRules = () => ({ chainReverse: $('optReverse').checked });
  const ruleName = r => (r.chainReverse ? '連吃可回頭' : '連吃只能同方向');
  function start() {
    lastOpts = { mode: pick('mode'), level: pick('level'), first: pick('first'), rules: currentRules() };
    $('menu').hidden = true; $('game').hidden = false; $('ovEnd').hidden = true;
    game.newGame(lastOpts);
  }
  function toMenu() { game.quit(); $('ovEnd').hidden = true; $('game').hidden = true; $('menu').hidden = false; }
  // 偏好（立體、音效、音量）只存在這台裝置的瀏覽器；存不了（無痕模式等）也不影響遊戲
  const pref = {
    get(k, d) { try { const v = localStorage.getItem('danqi.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('danqi.' + k, v); } catch (e) { /* 忽略 */ } }
  };
  function set3D(on) {
    const ok = game.set3D(on);
    $('b3d').setAttribute('aria-pressed', String(ok)); $('b2d').setAttribute('aria-pressed', String(!ok));
    pref.set('3d', ok ? '1' : '0');
  }
  function syncSound() { $('bSound').textContent = DanqiSound.isEnabled() ? '開' : '關'; $('vol').value = Math.round(DanqiSound.getVolume() * 100); }
  document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { const ai = pick('mode') === 'ai'; $('fLevel').hidden = $('fFirst').hidden = !ai; }));
  $('bStart').onclick = start;
  $('bNew').onclick = () => { if (!game.inProgress() || confirm('放棄這局，重新開始？')) start(); };
  $('bMenu').onclick = () => { if (!game.inProgress() || confirm('離開這一局？')) toMenu(); };
  $('bUndo').onclick = () => game.undo();
  $('bStop').onclick = () => game.stopChain();
  $('bEndUndo').onclick = () => { $('ovEnd').hidden = true; game.undo(); };
  $('bEndMenu').onclick = toMenu;
  $('bEndAgain').onclick = () => { $('ovEnd').hidden = true; lastOpts.rules = currentRules(); game.newGame(lastOpts); };
  $('b2d').onclick = () => set3D(false);
  $('b3d').onclick = () => set3D(true);
  $('bSet').onclick = () => { $('ovSet').hidden = false; };
  // 對局中改了開關：提醒這一局還是照開局時的規則
  function syncRuleHint() {
    const v = game.view(), now = currentRules(), hint = $('optHint');
    const differs = v && !v.result && v.state.rules.chainReverse !== now.chainReverse;
    hint.classList.toggle('on', !!differs);
    hint.textContent = differs
      ? '這一局仍是「' + ruleName(v.state.rules) + '」，下一局起改為「' + ruleName(now) + '」。'
      : '取消勾選＝只能同方向連吃。設定會記住，從下一局開始生效。';
  }
  $('optReverse').onchange = () => { pref.set('chainReverse', $('optReverse').checked ? '1' : '0'); syncRuleHint(); };
  $('bRules').onclick = () => { syncRuleHint(); $('ovRules').hidden = false; };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { b.closest('.ov').hidden = true; });
  $('bSound').onclick = () => { DanqiSound.setEnabled(!DanqiSound.isEnabled()); pref.set('sound', DanqiSound.isEnabled() ? '1' : '0'); syncSound(); DanqiSound.play('select'); };
  $('vol').oninput = e => DanqiSound.setVolume(e.target.value / 100);
  $('vol').onchange = e => { pref.set('volume', e.target.value); DanqiSound.play('move'); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ['ovSet', 'ovRules', 'ovIos'].forEach(id => { $(id).hidden = true; }); });

  // ───── 安裝成 App（PWA）：只在 https 網址（或本機測試伺服器）上啟用；直接開檔案照常能玩 ─────
  const onWeb = /^https?:$/.test(location.protocol);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (onWeb) {
    const link = document.createElement('link');
    link.rel = 'manifest'; link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
  }

  // 安裝按鈕：Android／電腦 Chrome 用瀏覽器的安裝視窗；iPhone 沒有這種視窗，改顯示「加入主畫面」教學
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; $('bInstall').hidden = false; });
  window.addEventListener('appinstalled', () => { installEvent = null; $('bInstall').hidden = true; note('已安裝到主畫面，之後可以從「暗棋」圖示直接打開。'); });
  if (onWeb && isIos && !standalone) $('bInstall').hidden = false;
  $('bInstall').onclick = async () => {
    if (installEvent) {
      installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') $('bInstall').hidden = true;
      installEvent = null;
    } else if (isIos) {
      $('ovIos').hidden = false;
    }
  };

  // 背景程式與更新提示：有新版先在背景下載好，跳提示讓玩家自己決定什麼時候更新
  if (onWeb && 'serviceWorker' in navigator) {
    let waiting = null, reloading = false;
    const showUpdate = w => { waiting = w; $('update').hidden = false; };
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
      });
      // 從背景切回來時順便檢查有沒有新版
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => { /* 離線時檢查不到，下次再試 */ }); });
    }).catch(err => {
      console.error('[暗棋] 離線功能無法啟用：', err);
      note('離線功能無法啟用（' + err.message + '），需要網路才能打開，遊戲本身不受影響。');
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
    $('bUpdate').onclick = () => {
      if (game.inProgress() && !confirm('更新會重新載入，這一局會中斷。要現在更新嗎？（也可以按「稍後」，下完再更新）')) return;
      $('update').hidden = true;
      if (waiting) waiting.postMessage('skipWaiting');
    };
    $('bUpdateLater').onclick = () => { $('update').hidden = true; };
  }

  DanqiSound.setEnabled(pref.get('sound', '1') === '1');
  DanqiSound.setVolume(Number(pref.get('volume', '80')) / 100);
  syncSound();
  $('optReverse').checked = pref.get('chainReverse', '1') === '1';
  if (pref.get('3d', '0') === '1') set3D(true);
  // 網址加 ?debug 時開放給自動測試操作
  if (/[?&]debug\b/.test(location.search)) window.__danqi = game;
})();
