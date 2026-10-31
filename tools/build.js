// 建置：src/index.html ＋ 各模組 → 單一檔案 暗棋.html（不需要網路、不需要安裝就能玩）
// 用法：node tools/build.js
// 流程：組出暫存檔 → 契約檢查 → 用暫存檔跑規則測試 → 全部通過才覆蓋 暗棋.html。任何一步失敗就中止，不產出。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const OUT = path.join(root, '暗棋.html');
const TMP = path.join(root, '暗棋.build-tmp.html');

function fail(msg) {
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  console.error('✘ 建置中止：' + msg);
  process.exit(1);
}

// 1. 組裝
let html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const inlined = [];
html = html.replace(/<script([^>]*?) data-inline="([^"]+)"><\/script>/g, (all, attrs, rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('找不到要嵌入的檔案 ' + rel + (rel.includes('three') ? '（先執行 node tools/build-three-global.js）' : ''));
  const code = fs.readFileSync(file, 'utf8');
  if (/<\/script/i.test(code)) fail(rel + ' 裡面含有 </script，嵌入會破壞網頁');
  inlined.push(rel);
  return '<script' + attrs + '>\n' + code.replace(/\s+$/, '') + '\n</script>';
});

// 2. 契約檢查：曾經出過的問題在這裡擋下來
const checks = [
  [/data-inline=/.test(html), '還有沒嵌入的 data-inline'],
  [!/<script id="engine">/.test(html), '缺少 <script id="engine">（背景執行緒與測試都靠它）'],
  [/window\.__click/.test(html), '殘留測試用的 window.__click'],
  [/window\.__danqi\s*=\s*game;\s*\n/.test(html) && !/\?&\]debug/.test(html), '測試用的 window.__danqi 沒有限定在 ?debug'],
  [/<script[^>]+src="(?!https?:)/.test(html), '還有引用本機外部 js 檔（單一檔案交付會壞）'],
  [!/REVISION|const t="1\d\d"/.test(html), 'Three.js 沒有嵌入']
];
for (const [bad, msg] of checks) if (bad) fail(msg);

fs.writeFileSync(TMP, html);

// 3. 用暫存檔跑規則與電腦測試
try {
  const out = execFileSync(process.execPath, [path.join(root, 'tests', 'engine.test.js')], { env: Object.assign({}, process.env, { DANQI_HTML: TMP }), encoding: 'utf8' });
  const last = out.trim().split('\n').pop();
  console.log('  測試：' + last);
} catch (e) {
  console.error(e.stdout || e.message);
  fail('規則測試沒過');
}

// 4. 通過才覆蓋正式檔
fs.renameSync(TMP, OUT);
console.log('✔ 已產出 暗棋.html（' + Math.round(html.length / 1024) + ' KB），嵌入：' + inlined.join('、'));
