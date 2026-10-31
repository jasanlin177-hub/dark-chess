// 載入要測試的規則引擎：
//   預設：從 暗棋.html（或環境變數 DANQI_HTML 指定的檔案）取出 <script id="engine"> 區塊，測的是實際交付的那一份
//   DANQI_SRC=1：直接載入 src/engine.js（開發中、還沒建置時用）
const fs = require('fs');
const path = require('path');

let code, from;
if (process.env.DANQI_SRC) {
  from = 'src/engine.js';
  code = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8');
} else {
  const file = process.env.DANQI_HTML || path.join(__dirname, '..', '暗棋.html');
  from = path.basename(file);
  const m = fs.readFileSync(file, 'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('在 ' + from + ' 找不到 <script id="engine"> 區塊');
  code = m[1];
}
console.log('（測試對象：' + from + '）');
module.exports = new Function(code + '\nreturn DanqiEngine;')();
