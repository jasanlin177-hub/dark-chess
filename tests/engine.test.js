// 規則與電腦 AI 的自動測試：node tests/engine.test.js
const assert = require('assert');
const E = require('./load-engine');

const { HIDDEN, EMPTY } = E;
const K = 0, A = 1, EL = 2, R = 3, H = 4, C = 5, P = 6;
const red = t => t, black = t => 7 + t;
const sq = (r, c) => r * 8 + c;

// 建立測試盤面：pieces = [[列, 行, 代碼]]；代碼用 ['H', 底牌] 表示蓋著的棋
function pos(pieces, opts = {}) {
  const cells = new Array(32).fill(EMPTY), secret = new Array(32).fill(EMPTY);
  for (const [r, c, v] of pieces) {
    if (Array.isArray(v)) { cells[sq(r, c)] = HIDDEN; secret[sq(r, c)] = v[1]; }
    else cells[sq(r, c)] = v;
  }
  return E.createState({ cells, secret, playerColor: opts.pc || [0, 1], toMove: opts.toMove || 0, noCap: opts.noCap || 0 });
}
// 殘局測試盤面湊不滿 32 顆，直接組電腦資料（沒有蓋著的棋，未翻池為空）
const endInfo = s => ({ cells: s.cells.slice(), pool: new Array(14).fill(0), color: s.playerColor[s.toMove], noCap: s.noCap });
const targetsOf = (s, from) => E.legalActions(s).filter(a => a.from === from).map(a => a.type + ':' + a.to).sort();

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✔ ' + name); }
  catch (e) { fail++; console.log('  ✘ ' + name + '\n      ' + e.message); }
}

console.log('【大小與吃子】');
test('帥不能吃兵，兵可以吃帥', () => {
  const s = pos([[0, 0, red(K)], [0, 1, black(P)], [3, 0, red(P)], [3, 1, black(K)]]);
  assert.deepStrictEqual(targetsOf(s, sq(0, 0)), ['move:8']);
  assert.ok(targetsOf(s, sq(3, 0)).includes('cap:' + sq(3, 1)));
});
test('同級可以互吃、小不能吃大', () => {
  const s = pos([[1, 1, red(H)], [1, 2, black(H)], [0, 1, black(R)]]);
  const t = targetsOf(s, sq(1, 1));
  assert.ok(t.includes('cap:' + sq(1, 2)), '傌應該能吃馬');
  assert.ok(!t.includes('cap:' + sq(0, 1)), '傌不能吃車');
});
test('蓋著的棋不能吃、自己的棋不能吃', () => {
  const s = pos([[1, 1, red(K)], [1, 2, ['H', black(P)]], [1, 0, red(P)]]);
  assert.deepStrictEqual(targetsOf(s, sq(1, 1)), ['move:' + sq(0, 1), 'move:' + sq(2, 1)]);
});

console.log('【炮】');
test('炮隔一顆（蓋著的也算）可以吃帥將；緊鄰不能吃', () => {
  const s = pos([[0, 0, red(C)], [0, 1, ['H', red(P)]], [0, 2, black(K)], [1, 0, black(P)]]);
  const t = targetsOf(s, sq(0, 0));
  assert.ok(t.includes('cap:' + sq(0, 2)), '應能跳吃將');
  assert.ok(!t.includes('cap:' + sq(1, 0)), '緊鄰的卒不能吃');
});
test('炮中間隔兩顆以上不能吃、跳過去碰到自己棋不能吃', () => {
  const s = pos([[0, 0, red(C)], [0, 1, black(P)], [0, 2, black(P)], [0, 3, black(K)], [1, 0, red(P)], [2, 0, red(K)]]);
  const t = targetsOf(s, sq(0, 0));
  assert.ok(t.includes('cap:' + sq(0, 2)));
  assert.ok(!t.includes('cap:' + sq(0, 3)), '隔兩顆不能吃');
  assert.ok(!t.some(x => x === 'cap:' + sq(2, 0)), '不能吃自己的棋');
});
test('炮連吃：吃完可選擇繼續或停止，只能同方向', () => {
  // 炮(0,0) 屏(0,1) 黑卒(0,2) 屏(0,3) 黑將(0,4)；(0,2) 往下：屏(1,2) 黑士(2,2) ← 轉彎方向不可以
  const s0 = pos([[0, 0, red(C)], [0, 1, ['H', red(P)]], [0, 2, black(P)], [0, 3, ['H', red(P)]], [0, 4, black(K)],
    [1, 2, ['H', red(P)]], [2, 2, black(A)], [3, 7, black(P)]]);
  let s = E.applyAction(s0, { type: 'cap', from: sq(0, 0), to: sq(0, 2) });
  assert.ok(s.pendingChain, '應進入連吃狀態');
  assert.strictEqual(s.toMove, 0, '連吃中還是同一方');
  const acts = E.legalActions(s).map(a => a.type + (a.to !== undefined ? ':' + a.to : '')).sort();
  assert.deepStrictEqual(acts, ['cap:' + sq(0, 4), 'stop'], '只能同方向繼續吃將或停止，不能轉彎吃士');
  const stopped = E.applyAction(s, { type: 'stop' });
  assert.strictEqual(stopped.toMove, 1, '停止後換對方');
  const cont = E.applyAction(s, { type: 'cap', from: sq(0, 2), to: sq(0, 4) });
  assert.strictEqual(cont.toMove, 1, '沒有下一個可吃的就自動結束回合');
  assert.strictEqual(cont.cells[sq(0, 4)], red(C));
  assert.strictEqual(cont.cells[sq(0, 2)], EMPTY);
  assert.strictEqual(cont.captured[1].length, 2);
});
test('炮不吃子時只能走一格', () => {
  const s = pos([[1, 3, red(C)], [3, 7, black(P)]]);
  assert.deepStrictEqual(targetsOf(s, sq(1, 3)), ['move:' + sq(0, 3), 'move:' + sq(1, 2), 'move:' + sq(1, 4), 'move:' + sq(2, 3)].sort());
});

console.log('【俥】');
test('俥直線走多格、被擋住就停', () => {
  const s = pos([[0, 0, red(R)], [0, 3, ['H', red(P)]], [3, 7, black(P)]]);
  const t = targetsOf(s, sq(0, 0));
  assert.deepStrictEqual(t, ['move:1', 'move:2', 'move:8', 'move:16', 'move:24'].sort());
});
test('俥可以衝過去吃路上第一顆對方棋（大小照舊）', () => {
  const s = pos([[0, 0, red(R)], [0, 5, black(H)], [0, 7, black(P)], [3, 0, black(A)]]);
  const t = targetsOf(s, sq(0, 0));
  assert.ok(t.includes('cap:' + sq(0, 5)), '應能遠距吃馬');
  assert.ok(!t.includes('cap:' + sq(0, 7)), '不能越過馬吃卒');
  assert.ok(!t.includes('cap:' + sq(3, 0)), '俥不能吃士');
  assert.ok(t.includes('move:' + sq(2, 0)) && !t.includes('move:' + sq(3, 0)));
});

console.log('【翻棋、勝負、和局】');
test('第一個翻棋的人拿到翻出的顏色', () => {
  const s0 = E.newGame(E.makeRng(7));
  const flipSq = 5, code = s0.secret[flipSq];
  const s = E.applyAction(s0, { type: 'flip', sq: flipSq });
  assert.strictEqual(s.playerColor[0], E.colorOf(code));
  assert.strictEqual(s.playerColor[1], 1 - E.colorOf(code));
  assert.strictEqual(s.toMove, 1);
});
test('開局只能翻棋', () => {
  const acts = E.legalActions(E.newGame(E.makeRng(1)));
  assert.strictEqual(acts.length, 32);
  assert.ok(acts.every(a => a.type === 'flip'));
});
test('吃光對方就贏', () => {
  const s0 = pos([[0, 0, red(P)], [0, 1, black(K)]]);
  const s = E.applyAction(s0, { type: 'cap', from: 0, to: 1 });
  assert.deepStrictEqual(s.result, { winner: 0, loser: 1, reason: 'wipeout' });
});
test('還有蓋著的對方棋就不算吃光', () => {
  const s0 = pos([[0, 0, red(P)], [0, 1, black(K)], [3, 7, ['H', black(P)]]]);
  const s = E.applyAction(s0, { type: 'cap', from: 0, to: 1 });
  assert.strictEqual(s.result, null);
});
test('無棋可走就輸', () => {
  // 黑方只剩一顆帥將被困在角落：四周都是自己無法吃的紅兵… 將不能吃兵，且無空格
  const s0 = pos([[0, 0, black(K)], [0, 1, red(P)], [1, 0, red(P)], [3, 7, red(A)], [3, 6, red(EL)]], { toMove: 0 });
  const s = E.applyAction(s0, { type: 'move', from: sq(3, 7), to: sq(2, 7) });
  assert.deepStrictEqual(s.result, { winner: 0, loser: 1, reason: 'stalemate' });
});
test('連續 50 步沒吃子判和局；吃子會歸零', () => {
  const s0 = pos([[0, 0, red(R)], [3, 7, black(R)], [3, 0, black(P)]], { noCap: 49 });
  const s = E.applyAction(s0, { type: 'move', from: 0, to: 1 });
  assert.deepStrictEqual(s.result, { winner: -1, loser: -1, reason: 'draw' });
  const s2 = E.applyAction(s0, { type: 'cap', from: 0, to: sq(3, 0) });
  assert.strictEqual(s2.noCap, 0);
  assert.strictEqual(s2.result, null);
});
test('不合法的動作會丟出錯誤，不會默默接受', () => {
  const s = pos([[0, 0, red(K)], [0, 1, black(P)]]);
  assert.throws(() => E.applyAction(s, { type: 'cap', from: 0, to: 1 }), /不合法/);
});

console.log('【電腦 AI】');
test('電腦拿不到底牌：給它的資料沒有 secret', () => {
  const info = E.buildInfo(E.newGame(E.makeRng(3)));
  assert.deepStrictEqual(Object.keys(info).sort(), ['cells', 'color', 'noCap', 'pool']);
  assert.ok(info.cells.every(v => v === HIDDEN));
});
test('電腦不偷看：只換底牌位置，電腦的決定完全一樣', () => {
  let s = E.newGame(E.makeRng(11));
  const rng = E.makeRng(99);
  for (let i = 0; i < 14 && !s.result; i++) {
    const acts = E.legalActions(s);
    s = E.applyAction(s, acts[Math.floor(rng() * acts.length)]);
    if (s.pendingChain) s = E.applyAction(s, { type: 'stop' });
  }
  const hiddenSqs = s.cells.map((v, i) => (v === HIDDEN ? i : -1)).filter(i => i >= 0);
  assert.ok(hiddenSqs.length > 5);
  const s2 = JSON.parse(JSON.stringify(s));
  const codes = hiddenSqs.map(i => s.secret[i]).reverse();
  hiddenSqs.forEach((i, k) => { s2.secret[i] = codes[k]; });
  assert.notDeepStrictEqual(s.secret, s2.secret, '測試前提：底牌必須真的不同');
  for (const level of ['easy', 'normal', 'hard']) {
    const opts = { level, seed: 5, maxDepth: 2, timeMs: 1e9 };
    const a = E.think(E.buildInfo(s), opts), b = E.think(E.buildInfo(s2), opts);
    assert.deepStrictEqual(a.actions, b.actions, level + ' 的決定不應受底牌影響');
  }
});
test('困難：有白吃的將會吃', () => {
  // 炮台用紅仕（仕吃不了將），確保只有炮能吃
  const s = pos([[0, 0, red(C)], [0, 1, red(A)], [0, 2, black(K)], [3, 7, black(P)], [3, 0, red(EL)]]);
  const r = E.think(endInfo(s), { level: 'hard', seed: 1, timeMs: 500 });
  assert.deepStrictEqual(r.actions[0], { type: 'cap', from: 0, to: 2 });
});
test('困難：會用炮連吃兩顆', () => {
  const s = pos([[0, 0, red(C)], [0, 1, red(P)], [0, 2, black(A)], [0, 3, red(P)], [0, 4, black(A)], [3, 7, black(P)], [3, 0, red(K)]]);
  const r = E.think(endInfo(s), { level: 'hard', seed: 1, timeMs: 500 });
  assert.deepStrictEqual(r.actions, [{ type: 'cap', from: 0, to: 2 }, { type: 'cap', from: 2, to: 4 }]);
});
test('困難：大子被攻擊時會躲開', () => {
  // 紅仕在 (1,1)，黑將在 (1,2) 隔壁準備吃它；紅方應該把仕移開（不能走到將旁邊）
  const s = pos([[1, 1, red(A)], [1, 2, black(K)], [3, 7, red(P)], [0, 7, black(P)]]);
  const r = E.think(endInfo(s), { level: 'hard', seed: 1, timeMs: 800 });
  const a = r.actions[0];
  assert.strictEqual(a.from, sq(1, 1), '應該移動被攻擊的仕，實際：' + JSON.stringify(a));
  assert.ok([sq(1, 0), sq(0, 1), sq(2, 1)].includes(a.to));
});
test('電腦回傳的動作在實際對局中都合法（隨機 20 個盤面）', () => {
  const rng = E.makeRng(2024);
  for (let g = 0; g < 20; g++) {
    let s = E.newGame(E.makeRng(100 + g));
    const steps = 5 + Math.floor(rng() * 40);
    for (let i = 0; i < steps && !s.result; i++) {
      const acts = E.legalActions(s);
      s = E.applyAction(s, acts[Math.floor(rng() * acts.length)]);
      if (s.pendingChain) s = E.applyAction(s, { type: 'stop' });
    }
    if (s.result) continue;
    const r = E.think(E.buildInfo(s), { level: ['easy', 'normal', 'hard'][g % 3], seed: g, timeMs: 150 });
    for (const a of r.actions) s = E.applyAction(s, a); // 不合法會丟錯
  }
});

console.log('\n結果：通過 ' + pass + '，失敗 ' + fail);
process.exit(fail ? 1 : 0);
