// 從 暗棋.html 取出 <script id="engine"> 區塊執行，測試的就是遊戲實際用的同一份規則
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '暗棋.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('在 暗棋.html 找不到 <script id="engine"> 區塊');

module.exports = new Function(m[1] + '\nreturn DanqiEngine;')();
