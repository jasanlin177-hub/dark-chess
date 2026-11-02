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
  return E.createState({ cells, secret, playerColor: opts.pc || [0, 1], toMove: opts.toMove || 0, noCap: opts.noCap || 0, rules: opts.rules });
}
// 殘局測試盤面湊不滿 32 顆，直接組電腦資料（沒有蓋著的棋，未翻池為空）
const endInfo = s => ({ cells: s.cells.slice(), pool: new Array(14).fill(0), color: s.playerColor[s.toMove], noCap: s.noCap, rules: s.rules });
const SAME_ONLY = { chain: 'same' };
const NO_CHAIN = { chain: 'none' };
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
test('炮連吃：吃完可選擇繼續或停止，不能轉 90 度', () => {
  // 炮(0,0) 屏(0,1) 黑卒(0,2) 屏(0,3) 黑將(0,4)；(0,2) 往下：屏(1,2) 黑士(2,2) ← 轉彎方向不可以
  const s0 = pos([[0, 0, red(C)], [0, 1, ['H', red(P)]], [0, 2, black(P)], [0, 3, ['H', red(P)]], [0, 4, black(K)],
    [1, 2, ['H', red(P)]], [2, 2, black(A)], [3, 7, black(P)]]);
  let s = E.applyAction(s0, { type: 'cap', from: sq(0, 0), to: sq(0, 2) });
  assert.ok(s.pendingChain, '應進入連吃狀態');
  assert.strictEqual(s.toMove, 0, '連吃中還是同一方');
  const acts = E.legalActions(s).map(a => a.type + (a.to !== undefined ? ':' + a.to : '')).sort();
  assert.deepStrictEqual(acts, ['cap:' + sq(0, 4), 'stop'], '只能沿同一直線繼續吃將或停止，不能轉彎吃士');
  const stopped = E.applyAction(s, { type: 'stop' });
  assert.strictEqual(stopped.toMove, 1, '停止後換對方');
  const cont = E.applyAction(s, { type: 'cap', from: sq(0, 2), to: sq(0, 4) });
  assert.strictEqual(cont.toMove, 1, '沒有下一個可吃的就自動結束回合');
  assert.strictEqual(cont.cells[sq(0, 4)], red(C));
  assert.strictEqual(cont.cells[sq(0, 2)], EMPTY);
  assert.strictEqual(cont.captured[1].length, 2);
});
// 回頭連吃的標準盤面：黑將(0,0) 空 紅炮(0,2) 屏(0,3) 黑士(0,4)
// 炮往右跳吃士 → 回頭往左：跳過同一個屏、經過自己空出來的 (0,2)，吃到 (0,0) 的將
const reversePos = rules => pos([[0, 0, black(K)], [0, 2, red(C)], [0, 3, ['H', red(P)]], [0, 4, black(A)], [3, 7, black(P)], [3, 0, red(K)]], { rules });
test('預設規則：炮連吃可以回頭（反方向）', () => {
  const s0 = reversePos();
  assert.strictEqual(s0.rules.chain, 'both', '預設應為同方向、反方向皆可');
  const s = E.applyAction(s0, { type: 'cap', from: sq(0, 2), to: sq(0, 4) });
  assert.ok(s.pendingChain, '回頭還能吃，應進入連吃狀態');
  const acts = E.legalActions(s).map(a => a.type + (a.to !== undefined ? ':' + a.to : '')).sort();
  assert.deepStrictEqual(acts, ['cap:' + sq(0, 0), 'stop']);
  const done = E.applyAction(s, { type: 'cap', from: sq(0, 4), to: sq(0, 0) });
  assert.strictEqual(done.cells[sq(0, 0)], red(C));
  assert.strictEqual(done.cells[sq(0, 4)], EMPTY);
  assert.strictEqual(done.cells[sq(0, 2)], EMPTY);
  assert.strictEqual(done.captured[1].length, 2);
  assert.strictEqual(done.toMove, 1, '沒得再吃就結束回合');
});
test('規則改成只能同方向：不能回頭', () => {
  const s = E.applyAction(reversePos(SAME_ONLY), { type: 'cap', from: sq(0, 2), to: sq(0, 4) });
  assert.strictEqual(s.pendingChain, null, '同方向沒得吃就不該進入連吃');
  assert.strictEqual(s.toMove, 1);
});
// 來回連吃盤面（列 0）：黑士(0,0) 空 黑象(0,2) 紅炮(0,3) 屏(0,4) 黑馬(0,5) 黑車(0,6) 空
//   右吃(0,5) → 回頭左吃(0,2)（經過空出來的(0,3)）→ 再右吃(0,6)（經過空出來的(0,5)）→ 再左吃(0,0)
const pingPongPos = rules => pos([[0, 0, black(A)], [0, 2, black(EL)], [0, 3, red(C)], [0, 4, ['H', red(P)]], [0, 5, black(H)], [0, 6, black(R)],
  [3, 7, black(P)], [3, 0, red(K)]], { rules });
test('回頭連吃可以來回不限次數（同一條直線上）', () => {
  let s = pingPongPos();
  for (const [from, to] of [[3, 5], [5, 2], [2, 6], [6, 0]]) {
    assert.ok(E.legalActions(s).some(a => a.type === 'cap' && a.from === sq(0, from) && a.to === sq(0, to)), '應能從 ' + from + ' 吃到 ' + to);
    s = E.applyAction(s, { type: 'cap', from: sq(0, from), to: sq(0, to) });
  }
  assert.strictEqual(s.captured[1].length, 4, '四跳吃掉四顆');
  assert.strictEqual(s.cells[sq(0, 0)], red(C));
  assert.strictEqual(s.toMove, 1, '吃完沒得再跳，回合結束');
});
test('電腦也會照規則走來回連吃；改成只能同方向時就不會', () => {
  const r = E.think(endInfo(pingPongPos()), { level: 'hard', seed: 1, timeMs: 600 });
  assert.deepStrictEqual(r.actions.map(a => a.to), [5, 2, 6, 0].map(c => sq(0, c)), '預設規則下應一路吃四顆，實際：' + JSON.stringify(r.actions));
  let s = pingPongPos();
  for (const a of r.actions) s = E.applyAction(s, a);   // 每一跳都要被實際規則接受
  const r2 = E.think(endInfo(pingPongPos(SAME_ONLY)), { level: 'hard', seed: 1, timeMs: 600 });
  assert.ok(r2.actions.length <= 1, '只能同方向時最多吃一顆，實際：' + JSON.stringify(r2.actions));
  assert.strictEqual(E.buildInfo(E.newGame(E.makeRng(1), SAME_ONLY)).rules.chain, 'same', '規則選項要傳給電腦');
});
test('禁止連吃：吃一顆就結束回合，同方向還能吃也不行', () => {
  // 同一個盤面在預設規則下會進入連吃（見上面的連吃測試）
  const s0 = pos([[0, 0, red(C)], [0, 1, ['H', red(P)]], [0, 2, black(P)], [0, 3, ['H', red(P)]], [0, 4, black(K)], [3, 7, black(P)]], { rules: NO_CHAIN });
  const s = E.applyAction(s0, { type: 'cap', from: sq(0, 0), to: sq(0, 2) });
  assert.strictEqual(s.pendingChain, null, '不該進入連吃');
  assert.strictEqual(s.toMove, 1, '吃完就換對方');
  const r = E.think(endInfo(pingPongPos(NO_CHAIN)), { level: 'hard', seed: 1, timeMs: 600 });
  assert.ok(r.actions.length <= 1, '電腦在禁止連吃時最多吃一顆，實際：' + JSON.stringify(r.actions));
  let t = pingPongPos(NO_CHAIN);
  for (const a of r.actions) t = E.applyAction(t, a);
});
test('規則選項：舊版設定相容、亂填會報錯', () => {
  assert.strictEqual(E.createState({ rules: { chainReverse: false } }).rules.chain, 'same', '舊版「不可回頭」對應到僅同方向');
  assert.strictEqual(E.createState({ rules: { chainReverse: true } }).rules.chain, 'both');
  assert.throws(() => E.createState({ rules: { chain: 'zigzag' } }), /不認得的連吃規則/);
});
test('炮不吃子時只能走一格', () => {
  const s = pos([[1, 3, red(C)], [3, 7, black(P)]]);
  assert.deepStrictEqual(targetsOf(s, sq(1, 3)), ['move:' + sq(0, 3), 'move:' + sq(1, 2), 'move:' + sq(1, 4), 'move:' + sq(2, 3)].sort());
});

console.log('【俥】');
test('俥一次只走一格（不能直線走多格）', () => {
  const s = pos([[0, 0, red(R)], [0, 3, ['H', red(P)]], [3, 7, black(P)]]);
  const t = targetsOf(s, sq(0, 0));
  assert.deepStrictEqual(t, ['move:1', 'move:8'].sort());
  const s3 = pos([[1, 3, red(R)], [3, 7, black(P)]]);
  assert.deepStrictEqual(targetsOf(s3, sq(1, 3)), ['move:' + sq(0, 3), 'move:' + sq(1, 2), 'move:' + sq(1, 4), 'move:' + sq(2, 3)].sort(), '中間位置四個方向各一格');
});
test('俥不能遠距吃，只能吃緊鄰的對方棋（大小照舊）', () => {
  const s = pos([[0, 0, red(R)], [0, 5, black(H)], [0, 7, black(P)], [3, 0, black(A)]]);
  const t = targetsOf(s, sq(0, 0));
  assert.ok(!t.includes('cap:' + sq(0, 5)), '不能遠距吃馬');
  assert.ok(!t.some(x => x.startsWith('cap:')), '這個盤面不應有任何吃子');
  const s2 = pos([[1, 1, red(R)], [1, 2, black(H)], [0, 1, black(A)], [3, 7, black(P)]]);
  const t2 = targetsOf(s2, sq(1, 1));
  assert.ok(t2.includes('cap:' + sq(1, 2)), '緊鄰的馬可以吃');
  assert.ok(!t2.includes('cap:' + sq(0, 1)), '緊鄰的士不能吃');
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
  const s0 = pos([[0, 0, red(R)], [3, 7, black(R)], [1, 0, black(P)]], { noCap: 49 });
  const s = E.applyAction(s0, { type: 'move', from: 0, to: 1 });
  assert.deepStrictEqual(s.result, { winner: -1, loser: -1, reason: 'draw' });
  const s2 = E.applyAction(s0, { type: 'cap', from: 0, to: sq(1, 0) });
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
  assert.deepStrictEqual(Object.keys(info).sort(), ['cells', 'color', 'noCap', 'pool', 'rules']);
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
