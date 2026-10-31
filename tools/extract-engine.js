// 從 暗棋.html 抽出 <script id="engine"> 區塊，給 design-demos 的原型用（規則仍以 暗棋.html 為唯一來源）
// 用法：node tools/extract-engine.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, '暗棋.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('在 暗棋.html 找不到 <script id="engine"> 區塊');
const src = m[1];
const out = path.join(root, 'design-demos', 'shared', 'engine.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
// 原始碼同時保留成字串，讓原型能用它建立背景執行緒（Web Worker）
fs.writeFileSync(out, '// 由 tools/extract-engine.js 自動產生，請勿手改\nvar DANQI_ENGINE_SRC = ' + JSON.stringify(src) + ';\n(0, eval)(DANQI_ENGINE_SRC);\n');
console.log('輸出 ' + out + '（' + Math.round(src.length / 1024) + ' KB）');
