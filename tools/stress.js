// 原型壓力測試（在頁面裡執行）：兩人模式隨機下 45 秒，穿插悔棋、平面／立體切換、連吃停止、結束後悔棋或開新局
const sleep = ms => new Promise(r => setTimeout(r, ms));
document.querySelector('input[name=mode][value=pvp]').click();
document.getElementById('bStart').click();
await sleep(300);
const g = window.__danqi, E = DanqiEngine;
const t0 = Date.now(); let n = 0, games = 0, undos = 0, chains = 0, flips3d = 0, popups = 0;
let rng = 12345; const rnd = k => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng % k; };
const click = sq => {
  if (g.clickCell) g.clickCell(sq);
  else if (g.is3D()) window.__click(sq);
  else [...document.querySelectorAll('.db-cell')].find(c => c.getAttribute('aria-label').startsWith('第' + (Math.floor(sq / 8) + 1) + '列第' + (sq % 8 + 1) + '行')).click();
};
while (Date.now() - t0 < 45000) {
  const v = g.view();
  if (v.result) {
    games++;
    // 一半等結果視窗跳出來再處理，一半馬上處理（測延遲跳窗）
    if (games % 2) await sleep(900);
    if (!document.getElementById('ovEnd').hidden) popups++;
    document.getElementById('ovEnd').hidden = true;
    if (games % 3 === 0) { g.undo(); undos++; } else document.getElementById('bNew').click();
    await sleep(50);
    continue;
  }
  if (n % 50 === 25) { g.set3D(!g.is3D()); flips3d++; await sleep(100); }
  if (n % 37 === 36 && v.canUndo) { g.undo(); undos++; }
  const acts = E.legalActions(v.state);
  if (v.state.pendingChain) chains++;
  const a = acts[rnd(acts.length)];
  if (a.type === 'flip') click(a.sq);
  else if (a.type === 'stop') g.stopChain();
  else { if (!v.state.pendingChain) click(a.from); click(a.to); }
  n++;
  await sleep(15);
}
return '動作 ' + n + '、終局 ' + games + '、看到結果視窗 ' + popups + '、悔棋 ' + undos + '、連吃狀態 ' + chains + '、切換平面立體 ' + flips3d;
