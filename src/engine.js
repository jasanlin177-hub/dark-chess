// 暗棋規則引擎與電腦 AI（不碰畫面）。主畫面、背景執行緒、自動測試共用這一份。
var DanqiEngine = (function () {
  'use strict';

  const COLS = 8, ROWS = 4, N = 32;
  const EMPTY = -1, HIDDEN = 14;
  // 棋子種類：0 帥 1 仕 2 相 3 俥 4 傌 5 炮 6 兵；棋子代碼 = 顏色 * 7 + 種類（紅 0、黑 1）
  const KING = 0, ADV = 1, ELE = 2, ROOK = 3, HORSE = 4, CANNON = 5, PAWN = 6;
  const RANK = [7, 6, 5, 4, 3, 2, 1];
  const COUNT = [1, 2, 2, 2, 2, 2, 5];
  // 電腦評估用的棋子價值
  const VALUE = [100, 50, 26, 24, 12, 32, 8];
  const NAMES = [['帥', '仕', '相', '俥', '傌', '炮', '兵'], ['將', '士', '象', '車', '馬', '包', '卒']];
  const DRAW_LIMIT = 50;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const WIN = 100000, INF = 1e9;
  const TIMEOUT = { timeout: true };

  const LEVELS = {
    easy: { maxDepth: 1, timeMs: 300, noise: 30, randomness: 0.25 },
    normal: { maxDepth: 3, timeMs: 900, noise: 4, randomness: 0 },
    hard: { maxDepth: 12, timeMs: 1800, noise: 0, randomness: 0 }
  };
  // 搜尋中（非第一層）每個節點最多展開幾格翻棋
  const FLIP_LIMIT = 4;

  // STEP[格][方向] = 相鄰格，出界為 -1
  const STEP = [];
  for (let sq = 0; sq < N; sq++) {
    const r = Math.floor(sq / COLS), c = sq % COLS, row = [];
    for (let d = 0; d < 4; d++) {
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      row.push(nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS ? nr * COLS + nc : -1);
    }
    STEP.push(row);
  }

  const colorOf = code => (code >= 7 ? 1 : 0);
  const typeOf = code => code % 7;
  const isUp = v => v >= 0 && v < HIDDEN;
  const nameOf = code => NAMES[colorOf(code)][typeOf(code)];

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 一般吃子（炮另計）：大吃小、同級互吃；帥不能吃兵、兵可以吃帥
  function canCapture(att, tgt) {
    if (att === KING && tgt === PAWN) return false;
    if (att === PAWN && tgt === KING) return true;
    return RANK[att] >= RANK[tgt];
  }

  // 炮從 from 往方向 d 跳吃：跳過一顆棋（蓋著的也算）後碰到的第一顆棋，若是翻開的對方棋就能吃；回傳目標格或 -1
  function cannonTarget(cells, from, d, color) {
    let n = STEP[from][d];
    while (n >= 0 && cells[n] === EMPTY) n = STEP[n][d];
    if (n < 0) return -1;
    n = STEP[n][d];
    while (n >= 0 && cells[n] === EMPTY) n = STEP[n][d];
    if (n < 0) return -1;
    const v = cells[n];
    if (!isUp(v) || colorOf(v) === color) return -1;
    return n;
  }

  function dirBetween(a, b) {
    const dr = Math.sign(Math.floor(b / COLS) - Math.floor(a / COLS));
    const dc = Math.sign((b % COLS) - (a % COLS));
    for (let d = 0; d < 4; d++) if (DIRS[d][0] === dr && DIRS[d][1] === dc) return d;
    return -1;
  }

  // 產生某一格棋子的走法。move = { from, to, seq }，seq 為吃子格的順序（null 表示不吃子）
  // fullChain = true 時，炮連吃的每一種長度都列成一個走法（給電腦用）
  function genPieceMoves(cells, sq, out, fullChain) {
    const code = cells[sq], color = colorOf(code), t = typeOf(code);
    for (let d = 0; d < 4; d++) {
      const n = STEP[sq][d];
      if (t === CANNON) {
        if (n >= 0 && cells[n] === EMPTY) out.push({ from: sq, to: n, seq: null });
        let cur = sq;
        const seq = [];
        for (;;) {
          const tg = cannonTarget(cells, cur, d, color);
          if (tg < 0) break;
          seq.push(tg);
          out.push({ from: sq, to: tg, seq: seq.slice() });
          if (!fullChain) break;
          cur = tg;
        }
      } else if (t === ROOK) {
        let m = n;
        while (m >= 0 && cells[m] === EMPTY) { out.push({ from: sq, to: m, seq: null }); m = STEP[m][d]; }
        // 俥可以走多格，但只能吃緊鄰的對方棋（不能衝過去遠距吃）
        if (m >= 0 && m === n) {
          const v = cells[m];
          if (isUp(v) && colorOf(v) !== color && canCapture(ROOK, typeOf(v))) out.push({ from: sq, to: m, seq: [m] });
        }
      } else {
        if (n < 0) continue;
        const v = cells[n];
        if (v === EMPTY) out.push({ from: sq, to: n, seq: null });
        else if (isUp(v) && colorOf(v) !== color && canCapture(t, typeOf(v))) out.push({ from: sq, to: n, seq: [n] });
      }
    }
  }

  function genMoves(cells, color, out, fullChain) {
    for (let sq = 0; sq < N; sq++) {
      const v = cells[sq];
      if (isUp(v) && colorOf(v) === color) genPieceMoves(cells, sq, out, fullChain);
    }
    return out;
  }

  // ───────────── 實際對局狀態 ─────────────
  // cells：玩家看得到的盤面（蓋著的棋為 HIDDEN）；secret：蓋著的棋實際是什麼（電腦不會拿到這份資料）

  function createState(o) {
    o = o || {};
    const cells = o.cells ? Array.from(o.cells) : new Array(N).fill(HIDDEN);
    const secret = o.secret ? Array.from(o.secret) : new Array(N).fill(EMPTY);
    for (let sq = 0; sq < N; sq++) if (cells[sq] !== HIDDEN) secret[sq] = EMPTY;
    return {
      cells,
      secret,
      ids: o.ids ? Array.from(o.ids) : cells.map((v, i) => (v === EMPTY ? -1 : i)),
      toMove: o.toMove || 0,
      playerColor: o.playerColor ? Array.from(o.playerColor) : [-1, -1],
      noCap: o.noCap || 0,
      captured: o.captured ? o.captured.map(a => Array.from(a)) : [[], []],
      pendingChain: null,
      lastMove: null,
      result: null,
      ply: 0
    };
  }

  function newGame(rand) {
    rand = rand || Math.random;
    const codes = [];
    for (let c = 0; c < 2; c++) for (let t = 0; t < 7; t++) for (let k = 0; k < COUNT[t]; k++) codes.push(c * 7 + t);
    for (let i = codes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = codes[i]; codes[i] = codes[j]; codes[j] = tmp;
    }
    return createState({ secret: codes });
  }

  const cloneState = s => JSON.parse(JSON.stringify(s));

  function legalActions(s) {
    if (s.result) return [];
    const color = s.playerColor[s.toMove];
    if (s.pendingChain) {
      const acts = [];
      const t = cannonTarget(s.cells, s.pendingChain.sq, s.pendingChain.dir, color);
      if (t >= 0) acts.push({ type: 'cap', from: s.pendingChain.sq, to: t });
      acts.push({ type: 'stop' });
      return acts;
    }
    const acts = [];
    for (let sq = 0; sq < N; sq++) if (s.cells[sq] === HIDDEN) acts.push({ type: 'flip', sq });
    if (color >= 0) {
      for (const m of genMoves(s.cells, color, [], false)) acts.push({ type: m.seq ? 'cap' : 'move', from: m.from, to: m.to });
    }
    return acts;
  }

  function sameAction(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'flip') return a.sq === b.sq;
    if (a.type === 'stop') return true;
    return a.from === b.from && a.to === b.to;
  }

  function aliveCount(s, color) {
    let n = 0;
    for (let sq = 0; sq < N; sq++) {
      const v = s.cells[sq];
      if (isUp(v) && colorOf(v) === color) n++;
      else if (v === HIDDEN && colorOf(s.secret[sq]) === color) n++;
    }
    return n;
  }

  function movePiece(s, from, to) {
    s.cells[to] = s.cells[from]; s.cells[from] = EMPTY;
    s.ids[to] = s.ids[from]; s.ids[from] = -1;
  }

  // 輪到的一方開始走之前判定勝負：棋子被吃光、和局、無棋可走
  function judge(s) {
    const mover = s.toMove, color = s.playerColor[mover];
    if (color >= 0 && aliveCount(s, color) === 0) return { winner: 1 - mover, loser: mover, reason: 'wipeout' };
    if (s.noCap >= DRAW_LIMIT) return { winner: -1, loser: -1, reason: 'draw' };
    if (legalActions(s).length === 0) return { winner: 1 - mover, loser: mover, reason: 'stalemate' };
    return null;
  }

  function endTurn(s) {
    s.pendingChain = null;
    s.toMove = 1 - s.toMove;
    s.ply++;
    s.result = judge(s);
  }

  // 套用一個動作並回傳新狀態（不改動原狀態）。不合法的動作直接丟出錯誤，不默默略過
  function applyAction(s, a) {
    if (!legalActions(s).some(x => sameAction(x, a))) {
      throw new Error('不合法的動作：' + JSON.stringify(a) + '（輪到玩家 ' + s.toMove + '）');
    }
    const n = cloneState(s);
    const color = n.playerColor[n.toMove];
    if (a.type === 'flip') {
      const code = n.secret[a.sq];
      if (!(code >= 0 && code < HIDDEN)) throw new Error('翻棋資料異常：第 ' + a.sq + ' 格的底牌是 ' + code);
      n.cells[a.sq] = code; n.secret[a.sq] = EMPTY;
      if (color < 0) {
        n.playerColor[n.toMove] = colorOf(code);
        n.playerColor[1 - n.toMove] = 1 - colorOf(code);
      }
      n.noCap++;
      n.lastMove = { type: 'flip', sq: a.sq, code };
      endTurn(n);
    } else if (a.type === 'move') {
      movePiece(n, a.from, a.to);
      n.noCap++;
      n.lastMove = { type: 'move', from: a.from, to: a.to };
      endTurn(n);
    } else if (a.type === 'cap') {
      const victim = n.cells[a.to], attacker = n.cells[a.from];
      n.captured[colorOf(victim)].push(victim);
      const startFrom = n.pendingChain && n.lastMove ? n.lastMove.from : a.from;
      movePiece(n, a.from, a.to);
      n.noCap = 0;
      n.lastMove = { type: 'cap', from: startFrom, to: a.to, code: victim };
      if (typeOf(attacker) === CANNON) {
        const d = dirBetween(a.from, a.to);
        if (cannonTarget(n.cells, a.to, d, color) >= 0) {
          n.pendingChain = { sq: a.to, dir: d };
          return n;
        }
      }
      endTurn(n);
    } else if (a.type === 'stop') {
      endTurn(n);
    }
    return n;
  }

  // 給電腦的資訊：只有看得到的盤面與「還沒翻出來的棋有哪些」，不含底牌位置
  function buildInfo(s) {
    const pool = new Array(14).fill(0);
    for (let c = 0; c < 2; c++) for (let t = 0; t < 7; t++) pool[c * 7 + t] = COUNT[t];
    let hidden = 0;
    for (let sq = 0; sq < N; sq++) {
      const v = s.cells[sq];
      if (isUp(v)) pool[v]--;
      else if (v === HIDDEN) hidden++;
    }
    for (const list of s.captured) for (const v of list) pool[v]--;
    const total = pool.reduce((a, b) => a + b, 0);
    if (pool.some(k => k < 0) || total !== hidden) {
      throw new Error('盤面資料不一致：未翻棋子池 ' + JSON.stringify(pool) + '，蓋著的格數 ' + hidden);
    }
    return { cells: s.cells.slice(), pool, color: s.playerColor[s.toMove], noCap: s.noCap };
  }

  // ───────────── 電腦 AI ─────────────
  // 期望值搜尋：走棋用 alpha-beta；翻棋是「機率節點」，依未翻棋子池的比例加權平均

  function createSearcher(info) {
    const cells = Int8Array.from(info.cells);
    const pool = Int8Array.from(info.pool);
    let poolTotal = 0, hiddenCount = 0, noCap = info.noCap, nodes = 0;
    const mat = [0, 0], cnt = [0, 0];
    for (let sq = 0; sq < N; sq++) {
      const v = cells[sq];
      if (isUp(v)) { mat[colorOf(v)] += VALUE[typeOf(v)]; cnt[colorOf(v)]++; }
      else if (v === HIDDEN) hiddenCount++;
    }
    for (let code = 0; code < 14; code++) {
      poolTotal += pool[code];
      mat[colorOf(code)] += pool[code] * VALUE[typeOf(code)];
      cnt[colorOf(code)] += pool[code];
    }
    const S = { deadline: Infinity };

    function make(m) {
      const piece = cells[m.from];
      const rec = { piece, caps: null, noCap };
      if (m.seq) {
        rec.caps = [];
        for (const t of m.seq) {
          const v = cells[t];
          rec.caps.push(v);
          cells[t] = EMPTY;
          mat[colorOf(v)] -= VALUE[typeOf(v)];
          cnt[colorOf(v)]--;
        }
        noCap = 0;
      } else noCap++;
      cells[m.from] = EMPTY;
      cells[m.to] = piece;
      return rec;
    }

    function unmake(m, rec) {
      cells[m.to] = EMPTY;
      if (rec.caps) {
        for (let i = 0; i < m.seq.length; i++) {
          const v = rec.caps[i];
          cells[m.seq[i]] = v;
          mat[colorOf(v)] += VALUE[typeOf(v)];
          cnt[colorOf(v)]++;
        }
      }
      cells[m.from] = rec.piece;
      noCap = rec.noCap;
    }

    function capValue(m) {
      let v = 0;
      for (const t of m.seq) v += VALUE[typeOf(cells[t])];
      return v;
    }

    // 這一方現在能吃到的最大價值
    function maxGain(color) {
      let best = 0;
      for (const m of genMoves(cells, color, [], true)) if (m.seq) { const v = capValue(m); if (v > best) best = v; }
      return best;
    }

    // 追殺：子力領先時，鼓勵能吃掉對方棋的己方棋子靠近它（避免殘局繞圈拖到和局）
    function chase(color) {
      if (mat[color] <= mat[1 - color]) return 0;
      let bonus = 0;
      for (let t = 0; t < N; t++) {
        const v = cells[t];
        if (!isUp(v) || colorOf(v) === color) continue;
        let best = 99;
        for (let s = 0; s < N; s++) {
          const p = cells[s];
          if (!isUp(p) || colorOf(p) !== color) continue;
          const pt = typeOf(p);
          if (pt !== CANNON && !canCapture(pt, typeOf(v))) continue;
          const d = Math.abs((s >> 3) - (t >> 3)) + Math.abs((s & 7) - (t & 7));
          if (d < best) best = d;
        }
        if (best < 99) bonus += (10 - best) * 0.8;
      }
      return bonus;
    }

    // 靜態評估（站在 color 這一方、輪到 color 走）
    function evaluate(color) {
      return mat[color] - mat[1 - color] + 0.5 * maxGain(color) - 0.25 * maxGain(1 - color) +
        chase(color) - chase(1 - color);
    }

    // 翻棋格挑選：旁邊有翻開棋子的格子比較有戰術意義；另外保留一格「孤立」格代表其他平凡的翻法
    function flipSquares(limit) {
      const list = [];
      for (let sq = 0; sq < N; sq++) {
        if (cells[sq] !== HIDDEN) continue;
        let rel = 0;
        for (let d = 0; d < 4; d++) { const n = STEP[sq][d]; if (n >= 0 && isUp(cells[n])) rel++; }
        list.push({ sq, rel });
      }
      if (limit >= list.length) return list.map(x => x.sq);
      list.sort((a, b) => b.rel - a.rel);
      const out = list.slice(0, limit - 1).map(x => x.sq);
      const iso = list.find(x => x.rel === 0 && out.indexOf(x.sq) < 0);
      out.push(iso ? iso.sq : list[limit - 1].sq);
      return out;
    }

    function flipValue(sq, depth, color, ply) {
      const total = poolTotal, oldNo = noCap;
      let ev = 0;
      hiddenCount--; poolTotal--; noCap++;
      for (let code = 0; code < 14; code++) {
        const k = pool[code];
        if (!k) continue;
        pool[code]--; cells[sq] = code;
        const v = -search(depth - 1, 1 - color, -INF, INF, true, ply + 1);
        pool[code]++;
        ev += (k / total) * v;
      }
      cells[sq] = HIDDEN; hiddenCount++; poolTotal++; noCap = oldNo;
      return ev;
    }

    function orderMoves(moves) {
      for (const m of moves) m.k = m.seq ? 1000 + capValue(m) - VALUE[typeOf(cells[m.from])] / 100 : 0;
      moves.sort((a, b) => b.k - a.k);
    }

    // chanceUsed：這條路線已經展開過一次翻棋機率，之後的翻棋只用靜態估值代表，控制運算量
    function search(depth, color, alpha, beta, chanceUsed, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > S.deadline) throw TIMEOUT;
      const opp = 1 - color;
      if (cnt[color] === 0) return -WIN + ply;
      if (cnt[opp] === 0) return WIN - ply;
      if (noCap >= DRAW_LIMIT) return 0;
      if (depth <= 0) return evaluate(color);
      const moves = genMoves(cells, color, [], true);
      if (moves.length === 0 && hiddenCount === 0) return -WIN + ply;
      orderMoves(moves);
      let best = -INF, i = 0;
      // 先算吃子
      for (; i < moves.length && moves[i].seq; i++) {
        const m = moves[i], rec = make(m);
        const v = -search(depth - 1, opp, -beta, -alpha, chanceUsed, ply + 1);
        unmake(m, rec);
        if (v > best) { best = v; if (v > alpha) alpha = v; if (alpha >= beta) return best; }
      }
      // 再算翻棋
      if (hiddenCount > 0) {
        let v;
        if (chanceUsed) v = -evaluate(opp);
        else {
          v = -INF;
          for (const sq of flipSquares(FLIP_LIMIT)) { const fv = flipValue(sq, depth, color, ply); if (fv > v) v = fv; }
        }
        if (v > best) { best = v; if (v > alpha) alpha = v; if (alpha >= beta) return best; }
      }
      // 最後是一般走棋
      for (; i < moves.length; i++) {
        const m = moves[i], rec = make(m);
        const v = -search(depth - 1, opp, -beta, -alpha, chanceUsed, ply + 1);
        unmake(m, rec);
        if (v > best) { best = v; if (v > alpha) alpha = v; if (alpha >= beta) return best; }
      }
      return best;
    }

    S.rootMoves = function (color) {
      const list = genMoves(cells, color, [], true);
      for (let sq = 0; sq < N; sq++) if (cells[sq] === HIDDEN) list.push({ flip: sq });
      return list;
    };
    S.rootValue = function (m, color, depth, alpha) {
      if (m.flip !== undefined) return flipValue(m.flip, depth, color, 0);
      const rec = make(m);
      try { return -search(depth - 1, 1 - color, -INF, -alpha, false, 1); }
      finally { unmake(m, rec); }
    };
    S.nodes = () => nodes;
    return S;
  }

  function moveToActions(m) {
    if (m.flip !== undefined) return [{ type: 'flip', sq: m.flip }];
    if (!m.seq) return [{ type: 'move', from: m.from, to: m.to }];
    const acts = [];
    let from = m.from;
    for (const t of m.seq) { acts.push({ type: 'cap', from, to: t }); from = t; }
    return acts;
  }

  // opts：{ level, seed, timeMs?, maxDepth? }；回傳 { actions, depth, nodes, score }
  function think(info, opts) {
    opts = opts || {};
    const cfg = LEVELS[opts.level] || LEVELS.normal;
    const rand = makeRng(opts.seed || 1);
    const timeMs = opts.timeMs != null ? opts.timeMs : cfg.timeMs;
    const maxDepth = opts.maxDepth != null ? opts.maxDepth : cfg.maxDepth;
    const color = info.color;

    if (color < 0) {
      // 還沒決定顏色，只能翻棋：隨便翻一顆
      const hidden = [];
      for (let sq = 0; sq < N; sq++) if (info.cells[sq] === HIDDEN) hidden.push(sq);
      return { actions: [{ type: 'flip', sq: hidden[Math.floor(rand() * hidden.length)] }], depth: 0, nodes: 0, score: 0 };
    }

    const S = createSearcher(info);
    let root = S.rootMoves(color);
    if (root.length === 0) throw new Error('電腦沒有任何可走的動作（遊戲應該已經結束）');
    if (root.length === 1) return { actions: moveToActions(root[0]), depth: 0, nodes: 0, score: 0 };

    const start = Date.now();
    const exact = cfg.noise > 0 || cfg.randomness > 0;
    let scored = null, doneDepth = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      // 第一層一定算完，之後才受時間限制
      S.deadline = depth === 1 ? Infinity : start + timeMs;
      try {
        let alpha = -INF;
        const cur = root.map(m => {
          const v = S.rootValue(m, color, depth, exact ? -INF : alpha);
          if (v > alpha) alpha = v;
          return { m, v };
        });
        scored = cur;
        doneDepth = depth;
      } catch (e) {
        if (e === TIMEOUT) break;
        throw e;
      }
      scored.sort((a, b) => b.v - a.v);
      root = scored.map(x => x.m);
      if (Math.abs(scored[0].v) > WIN / 2) break;
      if (Date.now() - start > timeMs) break;
    }

    let pick;
    if (cfg.randomness > 0 && rand() < cfg.randomness) {
      pick = scored[Math.floor(rand() * scored.length)];
    } else {
      let bestV = -Infinity;
      for (const x of scored) {
        const v = x.v + (cfg.noise ? (rand() * 2 - 1) * cfg.noise : 0);
        if (v > bestV) { bestV = v; pick = x; }
      }
    }
    return { actions: moveToActions(pick.m), depth: doneDepth, nodes: S.nodes(), score: Math.round(pick.v) };
  }

  return {
    COLS, ROWS, N, EMPTY, HIDDEN, KING, ADV, ELE, ROOK, HORSE, CANNON, PAWN, NAMES, DRAW_LIMIT, LEVELS,
    colorOf, typeOf, nameOf, makeRng, cannonTarget,
    createState, newGame, legalActions, applyAction, sameAction, aliveCount, buildInfo, think
  };
})();
