// 資料層：日記 / 旅程 / 索引。
// repo 內檔案結構：
//   entries/2026/2026-11-14.md   每天一篇（front matter + 內文）
//   photos/2026/…jpg             照片
//   trips.json                   所有旅程（含地點）
//   index.json                   每天的摘要索引（讓月曆與搜尋不必逐篇下載）
import { vault } from './vault.js';
import { LocalAdapter, GitHubAdapter } from './storage.js';
import { S } from './state.js';
import { store, ymd, parseYmd, uid } from './util.js';
import { parseEntry, serializeEntry, plainText, countPhotos, firstPhoto, allPhotos } from './md.js';
import { seedDemo } from './demo.js';

vault.onLock(() => { DB.mem && DB.mem.clear(); try { document.dispatchEvent(new CustomEvent('vault-locked')); } catch {} });

export const DB = {
  adapter: null,
  mode: 'demo',
  key: 'demo',
  index: { version: 1, entries: {} },
  trips: [],
  mem: new Map(),
  home: {},
  queue: Promise.resolve(),

  async init() {
    const s = S.settings;
    this.mem.clear();
    if (s.mode === 'github' && s.token && s.owner && s.repo) {
      this.mode = 'github';
      this.adapter = new GitHubAdapter(s);
      this.key = `${s.owner}/${s.repo}@${s.branch}`;
      this.index = store.get(`dc:index:${this.key}`, { version: 1, entries: {} });
      this.trips = store.get(`dc:trips:${this.key}`, []);
    } else {
      this.mode = 'demo';
      this.adapter = new LocalAdapter();
      this.key = 'demo';
      if (store.get('demoSeeded') !== 3) { this.adapter.clear(); this.adapter = new LocalAdapter(); await seedDemo(this); store.set('demoSeeded', 3); } // 範例資料改版時重新建立
      await this.load();
    }
  },

  // 從儲存層重新讀取索引與旅程
  async load() {
    const [i, t] = await Promise.all([this.adapter.getText('index.json'), this.adapter.getText('trips.json')]);
    this.index = i ? JSON.parse(i.text) : { version: 1, entries: {} };
    this.trips = t ? (JSON.parse(t.text).trips || []) : [];
    try { const h = await this.adapter.getText('home.json'); this.home = h ? JSON.parse(h.text) : {}; } catch { this.home = {}; }
    if (this.mode === 'github') {
      store.set(`dc:index:${this.key}`, this.index);
      store.set(`dc:trips:${this.key}`, this.trips);
    }
  },

  enqueue(fn) { // 寫入一律排隊，避免同時儲存互相覆蓋
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  },

  entryPath: (date) => `entries/${date.slice(0, 4)}/${date}.md`,

  async getEntry(date) {
    if (this.mem.has(date)) return this.mem.get(date);
    const ck = `dc:e:${this.key}:${date}`;
    let e = null;
    try {
      const r = await this.adapter.getText(this.entryPath(date));
      e = r ? parseEntry(r.text) : null;
      if (this.mode === 'github') (r ? store.set(ck, r.text) : store.del(ck));
    } catch (err) {
      const cached = this.mode === 'github' ? store.get(ck) : null; // 離線時用快取
      if (cached == null) throw err;
      e = parseEntry(cached);
    }
    if (e && e.meta.locked) {
      if (!vault.unlocked) return { meta: { ...e.meta, title: '', tags: [] }, body: '', locked: true, cipher: e.body };
      try {
        const inner = JSON.parse(await vault.decrypt(e.body));
        e = { meta: { ...e.meta, ...inner.meta, tags: inner.meta.tags || [], locked: true }, body: inner.body || '' };
      } catch { return { meta: { ...e.meta, title: '', tags: [] }, body: '', locked: true, cipher: e.body, bad: true }; }
    }
    this.mem.set(date, e);
    return e;
  },

  lockedSummary(meta) {
    return { title: '🔒 私密日記', mood: '🔒', weather: '', location: '', trip: meta.trip || '', tags: [], excerpt: '這篇日記已上鎖', photos: 0, cover: '', pics: [], words: 0, locked: true };
  },

  // 上鎖日記存檔內容：front matter 只留 locked 與 trip，其餘全部加密
  async sealEntry(meta, body) {
    if (!vault.unlocked) throw new Error('請先輸入日記密碼解鎖');
    const inner = { meta: { title: meta.title, mood: meta.mood, weather: meta.weather, location: meta.location, tags: meta.tags || [] }, body };
    return serializeEntry({ locked: true, trip: meta.trip }, await vault.encrypt(JSON.stringify(inner)));
  },

  summarize(meta, body) {
    const text = plainText(body);
    return {
      title: meta.title || '', mood: meta.mood || '', weather: meta.weather || '',
      location: meta.location || '', trip: meta.trip || '', tags: meta.tags || [],
      excerpt: text.slice(0, 160), photos: countPhotos(body), cover: firstPhoto(body), pics: allPhotos(body).slice(0, 24), words: text.length,
    };
  },

  saveEntry(date, meta, body) {
    return this.enqueue(async () => {
      const empty = !body.trim() && !meta.title && !meta.mood && !meta.weather && !meta.location && !meta.trip && !(meta.tags || []).length;
      const locked = !empty && !!meta.locked;
      const fileText = empty ? '' : locked ? await this.sealEntry(meta, body) : serializeEntry(meta, body);
      if (empty) await this.adapter.remove(this.entryPath(date), `刪除日記 ${date}`);
      else await this.adapter.putText(this.entryPath(date), fileText, `日記 ${date}`);
      await this.patchIndex(date, empty ? null : locked ? this.lockedSummary(meta) : this.summarize(meta, body));
      this.mem.set(date, empty ? null : { meta, body });
      if (this.mode === 'github') {
        const ck = `dc:e:${this.key}:${date}`;
        empty ? store.del(ck) : store.set(ck, fileText);
      }
    });
  },

  // 首頁封面：自己指定一張照片（空字串 = 回到自動挑選）；存在資料庫的 home.json，各裝置共用
  setHomeCover(path) {
    return this.enqueue(async () => {
      const home = { ...this.home, cover: path || '' };
      await this.adapter.putText('home.json', JSON.stringify(home), '首頁封面');
      this.home = home;
    });
  },

  deleteEntry(date) { return this.saveEntry(date, { tags: [] }, ''); },

  // 先抓最新的 index.json 再合併，這樣兩台裝置輪流寫也不會互相覆蓋
  async patchIndex(date, info) {
    const fresh = await this.adapter.getText('index.json');
    const idx = fresh ? JSON.parse(fresh.text) : { version: 1, entries: {} };
    if (info) idx.entries[date] = info; else delete idx.entries[date];
    await this.adapter.putText('index.json', JSON.stringify(idx), `索引 ${date}`);
    this.index = idx;
    if (this.mode === 'github') store.set(`dc:index:${this.key}`, idx);
  },

  saveTrips(trips) {
    return this.enqueue(async () => {
      await this.adapter.putText('trips.json', JSON.stringify({ version: 1, trips }, null, 1), '更新旅程');
      this.trips = trips;
      if (this.mode === 'github') store.set(`dc:trips:${this.key}`, trips);
    });
  },

  // 上傳照片：原圖 + 小縮圖（.t.jpg，月曆與清單用，載入快）
  async uploadPhoto(date, blob, thumb) {
    const base = `photos/${date.slice(0, 4)}/${date}-${uid()}`;
    await this.adapter.putBinary(`${base}.jpg`, blob, `照片 ${date}`);
    if (thumb) await this.adapter.putBinary(`${base}.t.jpg`, thumb, `縮圖 ${date}`);
    return `${base}.jpg`;
  },
  async uploadCover(id, blob) {
    const path = `photos/covers/${id}-${uid()}.jpg`;
    await this.adapter.putBinary(path, blob, '旅程封面');
    return path;
  },
  photoUrl(path) { return this.adapter.blobUrl(path); },

  // 從所有 entries/*.md 重建 index.json（索引壞掉或手動在 GitHub 改了檔案時使用）
  async rebuildIndex(onProgress) {
    const paths = (await this.adapter.list('entries/')).filter((p) => /\d{4}-\d{2}-\d{2}\.md$/.test(p));
    const entries = {};
    let done = 0;
    const work = [...paths];
    const worker = async () => {
      while (work.length) {
        const p = work.shift();
        const date = p.match(/(\d{4}-\d{2}-\d{2})\.md$/)[1];
        const r = await this.adapter.getText(p);
        if (r) { const e = parseEntry(r.text); entries[date] = e.meta.locked ? this.lockedSummary(e.meta) : this.summarize(e.meta, e.body); }
        onProgress && onProgress(++done, paths.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await this.enqueue(async () => {
      const idx = { version: 1, entries };
      await this.adapter.putText('index.json', JSON.stringify(idx), '重建索引');
      this.index = idx;
      if (this.mode === 'github') store.set(`dc:index:${this.key}`, idx);
    });
    return paths.length;
  },

  // ---- 查詢小工具 ----
  tripsOn(date) { return this.trips.filter((t) => t.start <= date && date <= t.end); },
  tripById(id) { return this.trips.find((t) => t.id === id); },
  entryDates() { return Object.keys(this.index.entries).sort(); },
  allTags() {
    const c = {};
    for (const e of Object.values(this.index.entries)) for (const t of e.tags || []) c[t] = (c[t] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  },
  streak(today) {
    let n = 0;
    let d = parseYmd(today);
    if (!this.index.entries[ymd(d)]) d.setDate(d.getDate() - 1);
    while (this.index.entries[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
};
