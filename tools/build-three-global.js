// 把 vendor/three.module.min.js（ES module）轉成一般 <script> 可用的版本 vendor/three.global.js，
// 包在函式裡避免變數外洩，最後掛到 window.THREE。這樣用 file:// 直接開網頁也能載入（module 在 file:// 會被瀏覽器擋）。
// 用法：node tools/build-three-global.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'vendor', 'three.module.min.js');
const out = path.join(__dirname, '..', 'vendor', 'three.global.js');
const code = fs.readFileSync(src, 'utf8');

if (/\bimport\b/.test(code)) throw new Error('three.module.min.js 含有 import，無法直接轉換');
const m = code.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
if (!m) throw new Error('找不到檔尾的 export{...}，Three.js 版本格式可能變了');
const exportsCount = (code.match(/export\s*\{/g) || []).length;
if (exportsCount !== 1) throw new Error('預期只有 1 個 export 敘述，實際 ' + exportsCount + ' 個');

const pairs = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const parts = s.split(/\s+as\s+/);
  return parts.length === 2 ? parts[1] + ':' + parts[0] : parts[0] + ':' + parts[0];
});
const body = code.slice(0, m.index);
const result = '/* Three.js r' + (code.match(/const t="(\d+)"/) || [])[1] + '，MIT 授權，由 tools/build-three-global.js 自動轉換 */\n' +
  '(function(){\n' + body + '\nwindow.THREE={' + pairs.join(',') + '};\n})();\n';
fs.writeFileSync(out, result);
console.log('輸出 ' + out + '，匯出 ' + pairs.length + ' 個名稱，' + Math.round(result.length / 1024) + ' KB');
