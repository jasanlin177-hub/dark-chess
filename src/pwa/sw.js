// 暗棋的背景程式（service worker）：讓安裝後的遊戲沒網路也能開，並在有新版時通知畫面。
// __VERSION__ 與 __FILES__ 由 tools/build.js 建置時填入；版本＝暗棋.html 內容的雜湊，內容一變就會觸發更新
const VERSION = '__VERSION__';
const CACHE = 'danqi-' + VERSION;
const FONT_CACHE = 'danqi-fonts';
const FILES = __FILES__;

// 安裝：先把遊戲檔案全部存起來。不自動接手，等玩家在畫面上按「更新」（避免打斷下到一半的棋）
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

// 啟用：清掉舊版本的快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('danqi-') && k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 畫面按下「更新」時傳 skipWaiting 過來
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google 字型：先用快取，背景再更新；第一次有網路時存起來，之後離線也有設計字型
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
      if (hit) { net.catch(() => { /* 離線時更新不到沒關係，已有快取 */ }); return hit; }
      return net;
    }));
    return;
  }

  // 遊戲本身：先用快取（離線也能開），快取沒有才上網；網址後面的 ?debug 之類不影響比對
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))
    );
  }
});
