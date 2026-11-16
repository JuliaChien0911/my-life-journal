// Service Worker：讓 App 可安裝到主畫面，並在離線時仍能開啟外殼。
// 策略：同源檔案「網路優先、失敗用快取」，所以更新程式碼後下次開啟就會自動換新。
const VERSION = 'diary-v1-v12';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/state.js', 'js/util.js', 'js/icons.js', 'js/md.js', 'js/db.js',
  'js/storage.js', 'js/calendar.js', 'js/panel.js', 'js/trips.js', 'js/search.js',
  'js/settings.js', 'js/map.js', 'js/demo.js', 'js/art.js', 'js/media.js', 'js/home.js', 'js/album.js', 'js/stats.js', 'js/timeline.js', 'js/vault.js', 'js/places.js', 'js/covers.js', 'js/applock.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // GitHub API 等外部請求不處理
  e.respondWith(
    fetch(req, { cache: 'no-cache' }) // 每次向伺服器確認有沒有新版，避免 GitHub Pages 的 10 分鐘快取讓畫面停在舊版
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
