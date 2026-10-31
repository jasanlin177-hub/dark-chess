// 電腦互打，檢查各難度強弱是否合理：node tests/selfplay.js [每組局數] [困難每步秒數]
const E = require('./load-engine');

const games = Number(process.argv[2] || 6);
const hardMs = Number(process.argv[3] || 0.3) * 1000;
const pairs = [['hard', 'easy'], ['normal', 'easy'], ['hard', 'normal']];

function play(levels, seed) {
  let s = E.newGame(E.makeRng(seed));
  const think = { ms: [0, 0], moves: [0, 0], maxMs: [0, 0], depth: [0, 0] };
  let guard = 0;
  while (!s.result) {
    if (++guard > 3000) throw new Error('對局超過 3000 手沒有結束');
    const p = s.toMove, lv = levels[p];
    const t0 = Date.now();
    const r = E.think(E.buildInfo(s), { level: lv, seed: seed * 1000 + guard, timeMs: lv === 'hard' ? hardMs : undefined });
    const dt = Date.now() - t0;
    think.ms[p] += dt; think.moves[p]++; think.maxMs[p] = Math.max(think.maxMs[p], dt); think.depth[p] += r.depth;
    for (const a of r.actions) s = E.applyAction(s, a);
    if (s.pendingChain) s = E.applyAction(s, { type: 'stop' });
  }
  return { result: s.result, ply: s.ply, think };
}

for (const [a, b] of pairs) {
  const tally = { [a]: 0, [b]: 0, draw: 0 };
  let plies = 0, maxMs = 0, depthSum = 0, depthN = 0;
  for (let g = 0; g < games; g++) {
    // 輪流先手
    const levels = g % 2 === 0 ? [a, b] : [b, a];
    const r = play(levels, 1 + g);
    const w = r.result.winner;
    if (w < 0) tally.draw++; else tally[levels[w]]++;
    plies += r.ply;
    const ai = levels.indexOf(a);
    maxMs = Math.max(maxMs, r.think.maxMs[ai]);
    depthSum += r.think.depth[ai]; depthN += r.think.moves[ai];
  }
  console.log(`${a} 對 ${b}：${a} 勝 ${tally[a]}、${b} 勝 ${tally[b]}、和 ${tally.draw}（共 ${games} 局，平均 ${Math.round(plies / games)} 手；` +
    `${a} 單步最久 ${maxMs}ms、平均搜尋深度 ${(depthSum / depthN).toFixed(1)}）`);
}
