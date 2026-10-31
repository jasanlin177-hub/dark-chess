// 截圖用：開一盤全部翻開的棋（固定亂數），切到立體，方便檢查每種棋子的造型
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = DanqiEngine, g = window.__danqi;
const base = E.newGame(E.makeRng(7));
const state = E.createState({ cells: base.secret, playerColor: [0, 1] });
document.querySelector('input[name=mode][value=pvp]').click();
document.getElementById('bStart').click();
await sleep(200);
g.newGame({ mode: 'pvp', state });
if (!g.is3D()) { (document.getElementById('b3d') || document.getElementById('bView')).click(); }
await sleep(1500);
return '3D=' + g.is3D();
