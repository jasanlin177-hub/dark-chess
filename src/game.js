// 暗棋遊戲流程（輪替、電腦、悔棋、音效觸發）＋平面棋盤。
// 畫面版面由 app.js 負責，透過 onRender(view) 拿到要顯示的資料。
var DanqiFlatBoard = (function () {
  'use strict';
  const E = DanqiEngine;

  // 結構用的最低限度樣式；顏色、材質由各方向自己定義
  const CSS = `
  .db-board { position: relative; width: 100%; height: 100%; container-type: size; touch-action: manipulation; }
  .db-layer { position: absolute; inset: 0; }
  .db-cells { display: grid; z-index: 10; }
  .db-cell { position: relative; border: 0; padding: 0; margin: 0; background: transparent; cursor: pointer; outline: none; }
  .db-cell:focus-visible { box-shadow: inset 0 0 0 3px var(--db-focus, #1565c0); }
  .db-pieces { z-index: 5; pointer-events: none; }
  .db-piece { position: absolute; left: 0; top: 0; transition: transform .3s cubic-bezier(.3,.7,.3,1), opacity .35s; perspective: 600px; }
  .db-piece.moving { z-index: 3; }
  .db-piece .db-in { position: absolute; inset: 8%; transition: transform .45s cubic-bezier(.3,.7,.3,1.2); transform-style: preserve-3d; }
  .db-piece.up .db-in { transform: rotateY(180deg); }
  .db-piece.dead { opacity: 0; }
  .db-piece.dead .db-in { transform: rotateY(180deg) scale(.3); }
  .db-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; align-items: center; justify-content: center; }
  .db-front { transform: rotateY(180deg); }
  `;
  let cssDone = false;

  function create() {
    let root, piecesEl, cellsEl, cellEls = [], clickCb = null, portrait = false, ro = null;
    const pieceEls = new Map();
    let lastState = null;

    function posOf(sq) {
      const r = Math.floor(sq / E.COLS), c = sq % E.COLS;
      return portrait ? { x: r, y: c, w: 4, h: 8 } : { x: c, y: r, w: 8, h: 4 };
    }
    function layoutCells() {
      cellsEl.style.gridTemplateColumns = 'repeat(' + (portrait ? 4 : 8) + ',1fr)';
      cellsEl.style.gridTemplateRows = 'repeat(' + (portrait ? 8 : 4) + ',1fr)';
      // 依顯示位置排列格子按鈕
      const order = [];
      for (let sq = 0; sq < E.N; sq++) { const p = posOf(sq); order[p.y * p.w + p.x] = sq; }
      order.forEach(sq => cellsEl.appendChild(cellEls[sq]));
      root.classList.toggle('portrait', portrait);
    }
    function place(p, sq) {
      const pos = posOf(sq);
      p.style.width = (100 / pos.w) + '%';
      p.style.height = (100 / pos.h) + '%';
      const tf = 'translate(' + pos.x * 100 + '%,' + pos.y * 100 + '%)';
      if (p.style.transform && p.style.transform !== tf) {
        p.classList.add('moving');
        clearTimeout(p._mv);
        p._mv = setTimeout(() => p.classList.remove('moving'), 340);
      }
      p.style.transform = tf;
    }

    return {
      mount(stage) {
        if (!cssDone) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }
        root = document.createElement('div');
        root.className = 'db-board';
        root.innerHTML = '<div class="db-layer db-grid"></div><div class="db-layer db-pieces"></div><div class="db-layer db-cells"></div>';
        stage.appendChild(root);
        piecesEl = root.querySelector('.db-pieces');
        cellsEl = root.querySelector('.db-cells');
        for (let sq = 0; sq < E.N; sq++) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'db-cell';
          b.addEventListener('click', () => clickCb && clickCb(sq));
          cellEls.push(b);
        }
        const check = () => {
          const want = stage.clientHeight > stage.clientWidth * 1.05;
          if (want !== portrait || !cellsEl.children.length) {
            portrait = want;
            layoutCells();
            if (lastState) for (const [, p] of pieceEls) place(p, p._sq);
          }
        };
        check();
        ro = new ResizeObserver(check);
        ro.observe(stage);
      },
      unmount() {
        if (ro) ro.disconnect();
        if (root) root.remove();
        pieceEls.clear(); cellEls = [];
      },
      onCell(cb) { clickCb = cb; },
      sync(s) {
        lastState = s;
        const present = new Set();
        for (let sq = 0; sq < E.N; sq++) {
          const id = s.ids[sq];
          if (id < 0) continue;
          present.add(id);
          let p = pieceEls.get(id);
          if (!p) {
            p = document.createElement('div');
            p.className = 'db-piece';
            p.innerHTML = '<div class="db-in"><div class="db-face db-back"></div><div class="db-face db-front"><span></span></div></div>';
            piecesEl.appendChild(p);
            pieceEls.set(id, p);
          }
          p._sq = sq;
          p.classList.remove('dead');
          place(p, sq);
          const v = s.cells[sq], label = p.querySelector('.db-front span');
          if (v === E.HIDDEN) { p.classList.remove('up'); label.textContent = ''; delete p.dataset.color; delete p.dataset.type; }
          else { label.textContent = E.nameOf(v); p.dataset.color = String(E.colorOf(v)); p.dataset.type = String(E.typeOf(v)); p.classList.add('up'); }
        }
        for (const [id, p] of pieceEls) {
          if (present.has(id)) continue;
          pieceEls.delete(id);
          p.classList.add('dead');
          setTimeout(() => p.remove(), 400);
        }
      },
      mark(m) {
        for (let sq = 0; sq < E.N; sq++) {
          const c = cellEls[sq];
          c.classList.toggle('sel', m.selected === sq);
          c.classList.toggle('tgt', m.targets.has(sq));
          c.classList.toggle('cap', m.targets.get(sq) === true);
          c.classList.toggle('last', m.last.has(sq));
          c.setAttribute('aria-label', m.labels[sq]);
        }
      }
    };
  }
  return { create };
})();

var DanqiGame = (function () {
  'use strict';
  const E = DanqiEngine, S = DanqiSound;
  const COLOR_NAME = ['紅', '黑'];
  const LEVEL_NAME = { easy: '簡單', normal: '普通', hard: '困難' };
  const PIECE_VALUE = [100, 50, 26, 24, 12, 32, 8];
  const AI_MIN_DELAY = 500, AI_STEP_DELAY = 430, WARN_FROM = 40;

  // opts：{ stage, theme3d, onRender(view), onNotice(msg, isErr), onResult(view) }
  function create(opts) {
    const g = { mode: 'ai', level: 'normal', human: 0, state: null, history: [], selected: null, thinking: false, token: 0, chainN: 0, is3D: false };
    let renderer = null;

    // ───── 電腦：背景執行緒 ─────
    let worker = null, reqId = 0;
    const pending = new Map();
    function runOnMain(job) { setTimeout(() => { try { job.resolve(E.think(job.info, job.opts)); } catch (e) { job.reject(e); } }, 30); }
    function fallbackToMain(reason) {
      console.warn('[暗棋] 背景執行緒無法使用，改在主畫面計算。原因：', reason);
      opts.onNotice && opts.onNotice('此瀏覽器無法背景運算，電腦改在主畫面思考，思考時畫面可能短暫停頓。', false);
      if (worker) { try { worker.terminate(); } catch (e) { /* 已經壞了 */ } }
      worker = null;
      for (const job of pending.values()) runOnMain(job);
      pending.clear();
    }
    try {
      // 背景執行緒的程式＝頁面上 <script id="engine"> 的原始碼（原型則用抽出來的 DANQI_ENGINE_SRC）
      const engineSrc = typeof DANQI_ENGINE_SRC !== 'undefined' ? DANQI_ENGINE_SRC : document.getElementById('engine').textContent;
      const src = engineSrc + '\nself.onmessage=function(e){var d=e.data;try{self.postMessage({id:d.id,ok:true,res:DanqiEngine.think(d.info,d.opts)});}catch(err){self.postMessage({id:d.id,ok:false,msg:String(err&&err.message||err)});}};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = e => {
        const job = pending.get(e.data.id);
        if (!job) return;
        pending.delete(e.data.id);
        if (e.data.ok) job.resolve(e.data.res); else job.reject(new Error(e.data.msg));
      };
      worker.onerror = e => { e.preventDefault(); fallbackToMain(e.message || '背景執行緒錯誤'); };
    } catch (err) { fallbackToMain(err && err.message || err); }
    function requestAI(info, o) {
      return new Promise((resolve, reject) => {
        const job = { info, opts: o, resolve, reject };
        if (worker) { const id = ++reqId; pending.set(id, job); worker.postMessage({ id, info, opts: o }); }
        else runOnMain(job);
      });
    }

    // ───── 棋盤切換（平面／立體） ─────
    function mountRenderer(want3D) {
      let r;
      if (want3D) {
        try { r = DanqiBoard3D.create(opts.theme3d); }
        catch (e) {
          console.error('[暗棋] 立體模式無法啟動：', e);
          opts.onNotice && opts.onNotice('立體模式無法啟動（' + e.message + '），已改用平面模式。', true);
          want3D = false;
        }
      }
      if (!r) r = DanqiFlatBoard.create();
      if (renderer) renderer.unmount();
      opts.stage.innerHTML = '';
      renderer = r;
      g.is3D = want3D;
      renderer.mount(opts.stage);
      renderer.onCell(onCell);
      if (g.state) render();
      return want3D;
    }

    // ───── 文字 ─────
    function playerName(i) {
      if (g.mode === 'ai') return i === g.human ? '你' : '電腦';
      return i === 0 ? '玩家一' : '玩家二';
    }
    function colorName(i) { const c = g.state.playerColor[i]; return c < 0 ? '未定' : COLOR_NAME[c]; }
    function isHumanTurn() { const s = g.state; return !s.result && !g.thinking && (g.mode === 'pvp' || s.toMove === g.human); }
    function canUndo() {
      if (g.thinking || !g.history.length) return false;
      if (g.mode === 'pvp') return true;
      return g.history.some(h => h.toMove === g.human);
    }
    function cellLabel(s, sq) {
      const pos = '第' + (Math.floor(sq / E.COLS) + 1) + '列第' + (sq % E.COLS + 1) + '行：';
      const v = s.cells[sq];
      if (v === E.EMPTY) return pos + '空格';
      if (v === E.HIDDEN) return pos + '蓋著的棋';
      return pos + COLOR_NAME[E.colorOf(v)] + E.nameOf(v);
    }
    function statusText() {
      const s = g.state;
      if (s.result) return resultInfo().title;
      if (g.thinking) return '電腦思考中…';
      if (s.pendingChain) return '連吃中：點紅圈繼續吃，或按「停止連吃」';
      const who = playerName(s.toMove);
      if (s.playerColor[s.toMove] < 0) return who === '你' ? '翻開任一顆棋，翻到的顏色就是你的' : '輪到' + who + '：翻開任一顆棋決定顏色';
      return (who === '你' ? '輪到你' : '輪到' + who) + '（' + colorName(s.toMove) + '）：翻棋或走棋';
    }
    function resultInfo() {
      const r = g.state.result;
      let title, kind;
      if (r.winner < 0) { title = '和局'; kind = 'draw'; }
      else if (g.mode === 'ai') { kind = r.winner === g.human ? 'win' : 'lose'; title = kind === 'win' ? '你贏了！' : '電腦獲勝'; }
      else { kind = 'win'; title = playerName(r.winner) + '（' + colorName(r.winner) + '）獲勝'; }
      let reason;
      if (r.reason === 'draw') reason = '雙方連續 ' + E.DRAW_LIMIT + ' 步都沒有吃子';
      else if (r.reason === 'wipeout') reason = playerName(r.loser) + '的棋子全部被吃光了';
      else reason = playerName(r.loser) + '已經無棋可走';
      return { title, reason, kind };
    }

    function view() {
      const s = g.state;
      const players = [0, 1].map(i => {
        const c = s.playerColor[i];
        return { name: playerName(i), color: c, colorName: colorName(i), active: !s.result && s.toMove === i, thinking: g.thinking && s.toMove === i, captured: c < 0 ? [] : s.captured[1 - c].slice() };
      });
      return {
        state: s, mode: g.mode, level: g.level, levelName: LEVEL_NAME[g.level], human: g.human,
        bottom: g.mode === 'ai' ? g.human : 0, players, status: statusText(),
        noCap: s.noCap, drawLimit: E.DRAW_LIMIT, nearDraw: s.noCap >= WARN_FROM,
        canUndo: canUndo(), chainPending: !!(s.pendingChain && isHumanTurn()), thinking: g.thinking,
        result: s.result ? resultInfo() : null, is3D: g.is3D,
        toMoveColor: s.playerColor[s.toMove], nameOf: E.nameOf, colorOf: E.colorOf
      };
    }

    function render() {
      const s = g.state;
      renderer.sync(s);
      const targets = new Map();
      let selected = s.pendingChain ? s.pendingChain.sq : g.selected;
      if (selected != null && isHumanTurn()) {
        for (const a of E.legalActions(s)) if ((a.type === 'move' || a.type === 'cap') && a.from === selected) targets.set(a.to, a.type === 'cap');
      } else if (!s.pendingChain) selected = null;
      const lm = s.lastMove;
      const last = new Set(lm ? (lm.type === 'flip' ? [lm.sq] : [lm.from, lm.to]) : []);
      const labels = [];
      for (let sq = 0; sq < E.N; sq++) labels.push(cellLabel(s, sq));
      renderer.mark({ selected: s.result ? null : selected, targets, last, labels });
      opts.onRender(view());
    }

    // ───── 操作 ─────
    function onCell(sq) {
      if (!g.state || !isHumanTurn()) return;
      const s = g.state, acts = E.legalActions(s);
      if (s.pendingChain) {
        const a = acts.find(x => x.type === 'cap' && x.to === sq);
        if (a) doAction(a); else S.play('invalid');
        return;
      }
      if (g.selected != null) {
        const a = acts.find(x => (x.type === 'move' || x.type === 'cap') && x.from === g.selected && x.to === sq);
        if (a) { doAction(a); return; }
      }
      const v = s.cells[sq];
      if (v === E.HIDDEN) { doAction({ type: 'flip', sq }); return; }
      if (v >= 0 && E.colorOf(v) === s.playerColor[s.toMove]) {
        if (g.selected === sq) { g.selected = null; S.play('deselect'); render(); return; }
        g.selected = sq;
        S.play(acts.some(x => x.from === sq) ? 'select' : 'invalid');
        render();
        return;
      }
      if (g.selected != null || v >= 0) S.play('invalid');
      g.selected = null;
      render();
    }

    function soundFor(prev, a) {
      if (a.type === 'flip') S.play('flip');
      else if (a.type === 'move') S.play('move');
      else if (a.type === 'cap') {
        g.chainN = prev.pendingChain ? g.chainN + 1 : 1;
        if (g.chainN > 1) S.play('chain', { n: g.chainN });
        else S.play('capture', { value: PIECE_VALUE[E.typeOf(prev.cells[a.to])] });
      }
    }

    function apply(a) {
      const prev = g.state;
      g.state = E.applyAction(prev, a); // 不合法會丟錯
      soundFor(prev, a);
    }

    function doAction(a) {
      const s = g.state;
      if (!s.pendingChain) g.history.push(s);
      try { apply(a); }
      catch (e) {
        console.error('[暗棋] 套用動作失敗：', e);
        opts.onNotice && opts.onNotice('程式錯誤：' + e.message, true);
        if (!s.pendingChain) g.history.pop();
        return;
      }
      g.selected = null;
      render();
      afterAction();
    }

    function afterAction() {
      const s = g.state;
      if (s.result) { finish(); return; }
      if (!s.pendingChain && s.noCap >= WARN_FROM) setTimeout(() => S.play('warn'), 250);
      maybeAI();
    }

    function finish() {
      const info = resultInfo(), token = g.token, st = g.state;
      // 延遲期間若已悔棋或開新局，就不要再跳結果
      const still = () => token === g.token && g.state === st && st.result;
      setTimeout(() => { if (still()) S.play(info.kind); }, 350);
      setTimeout(() => { if (still() && opts.onResult) opts.onResult(view()); }, 700);
    }

    function aiFailed(err) {
      console.error('[暗棋] 電腦思考失敗：', err);
      g.thinking = false;
      opts.onNotice && opts.onNotice('電腦思考時發生錯誤：' + (err && err.message || err), true);
      render();
    }

    function maybeAI() {
      const s = g.state;
      if (g.mode !== 'ai' || s.result || s.toMove === g.human || g.thinking) return;
      g.thinking = true;
      render();
      const token = ++g.token, started = performance.now();
      let info;
      try { info = E.buildInfo(s); } catch (e) { aiFailed(e); return; }
      requestAI(info, { level: g.level, seed: (Math.random() * 4294967296) >>> 0 }).then(res => {
        if (token !== g.token) return;
        setTimeout(() => playAI(res.actions, token), Math.max(0, AI_MIN_DELAY - (performance.now() - started)));
      }, err => { if (token === g.token) aiFailed(err); });
    }

    function playAI(actions, token) {
      if (token !== g.token) return;
      if (!actions || !actions.length) { aiFailed(new Error('電腦沒有回傳任何動作')); return; }
      g.history.push(g.state);
      let i = 0;
      const step = () => {
        if (token !== g.token) return;
        try {
          if (i < actions.length) { apply(actions[i++]); render(); setTimeout(step, AI_STEP_DELAY); return; }
          if (g.state.pendingChain) g.state = E.applyAction(g.state, { type: 'stop' });
        } catch (e) { aiFailed(e); return; }
        g.thinking = false;
        render();
        if (!g.state.result) setTimeout(() => S.play('turn'), 120);
        afterAction();
      };
      step();
    }

    return {
      newGame(o) {
        o = o || {};
        g.token++;
        g.mode = o.mode || 'ai';
        g.level = o.level || 'normal';
        let first = o.first || 'human';
        if (first === 'random') first = Math.random() < 0.5 ? 'human' : 'ai';
        g.human = g.mode === 'ai' && first === 'ai' ? 1 : 0;
        g.state = o.state || E.newGame();
        g.history = []; g.selected = null; g.thinking = false; g.chainN = 0;
        mountRenderer(g.is3D); // 每局重建棋盤（會自動 render）
        S.play('start');
        maybeAI();
      },
      undo() {
        if (!canUndo()) return;
        g.token++;
        if (g.mode === 'pvp') g.state = g.history.pop();
        else { let s; do { s = g.history.pop(); } while (s.toMove !== g.human); g.state = s; }
        g.selected = null; g.thinking = false;
        S.play('undo');
        render();
      },
      stopChain() { if (g.state && g.state.pendingChain && isHumanTurn()) doAction({ type: 'stop' }); },
      // 等同點一下某一格（給鍵盤操作與自動測試用）
      clickCell(sq) { onCell(sq); },
      set3D(on) { const ok = mountRenderer(!!on); return ok; },
      is3D() { return g.is3D; },
      hasGame() { return !!g.state; },
      inProgress() { return !!(g.state && !g.state.result && g.state.ply > 0); },
      quit() { g.token++; g.thinking = false; },
      view() { return g.state ? view() : null; }
    };
  }
  return { create };
})();
