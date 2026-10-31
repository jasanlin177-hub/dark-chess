// 截圖用（需 ?debug）：對電腦開局，自己翻 9 顆棋讓電腦回應，最後選一顆能走的棋。WANT_3D 由呼叫端替換成 true/false
const sleep = ms => new Promise(r => setTimeout(r, ms));
document.getElementById('bStart').click();
await sleep(400);
const want = WANT_3D, g = window.__danqi, E = DanqiEngine;
if (g.is3D() !== want) { document.getElementById(want ? 'b3d' : 'b2d').click(); await sleep(500); }
for (let k = 0; k < 9; k++) {
  for (let w = 0; w < 80 && g.view().thinking; w++) await sleep(100);
  const s = g.view().state;
  const hid = []; for (let i = 0; i < 32; i++) if (s.cells[i] === E.HIDDEN) hid.push(i);
  g.clickCell(hid[(k * 5) % hid.length]);
  await sleep(1400);
}
for (let w = 0; w < 80 && g.view().thinking; w++) await sleep(100);
const acts = E.legalActions(g.view().state).filter(a => a.type === 'move' || a.type === 'cap');
if (acts.length) g.clickCell(acts[0].from);
return g.view().status + ' 3D=' + g.is3D() + ' 可走=' + acts.length;
