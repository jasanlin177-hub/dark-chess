# 三個設計方向的截圖：選單、平面、立體 × 桌機 1440×900、手機 390×844
# 用法（在專案根目錄）：pwsh tools/shots-all.ps1
$env:PYTHONIOENCODING = "utf-8"
function PlayJs([bool]$want3d) {
  $flag = if ($want3d) { 'true' } else { 'false' }
  return @"
const sleep = ms => new Promise(r => setTimeout(r, ms));
document.getElementById('bStart').click();
await sleep(400);
const want = $flag, g = window.__danqi, E = DanqiEngine;
if (g.is3D() !== want) {
  const b = document.getElementById(want ? 'b3d' : 'b2d') || document.getElementById('bView');
  b.click();
  await sleep(500);
}
const click = sq => { if (g.is3D()) window.__click(sq); else document.querySelectorAll('.db-cell')[[...document.querySelectorAll('.db-cell')].findIndex(c => c.getAttribute('aria-label').startsWith('第' + (Math.floor(sq / 8) + 1) + '列第' + (sq % 8 + 1) + '行'))].click(); };
for (let k = 0; k < 9; k++) {
  for (let w = 0; w < 80 && g.view().thinking; w++) await sleep(100);
  const s = g.view().state;
  const hid = []; for (let i = 0; i < 32; i++) if (s.cells[i] === E.HIDDEN) hid.push(i);
  click(hid[(k * 5) % hid.length]);
  await sleep(1400);
}
for (let w = 0; w < 80 && g.view().thinking; w++) await sleep(100);
const acts = E.legalActions(g.view().state).filter(a => a.type === 'move' || a.type === 'cap');
if (acts.length) click(acts[0].from);
return g.view().status + ' 3D=' + g.is3D() + ' 可走=' + acts.length;
"@
}
foreach ($d in 1, 2, 3) {
  $src = "design-demos/dir-$d.html"
  python tools/shot.py $src "design-demos/shots/dir-$d-menu.png" 1440 900 1200
  python tools/shot.py $src "design-demos/shots/dir-$d-flat.png" 1440 900 1500 desktop (PlayJs $false)
  python tools/shot.py $src "design-demos/shots/dir-$d-3d.png" 1440 900 2500 desktop (PlayJs $true)
  python tools/shot.py $src "design-demos/shots/dir-$d-m-flat.png" 390 844 1500 mobile (PlayJs $false)
  python tools/shot.py $src "design-demos/shots/dir-$d-m-3d.png" 390 844 2500 mobile (PlayJs $true)
}
