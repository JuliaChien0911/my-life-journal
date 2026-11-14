// 照片載入：把 data-photo / data-bg 標記的元素換成真正的圖片（GitHub 私人 repo 的圖需帶 Token 取得）
import { DB } from './db.js';
import { thumbPath } from './md.js';
import { $$ } from './util.js';

const load = async (p) => { try { return await DB.photoUrl(p); } catch { return null; } };

export function hydrate(root = document) {
  for (const img of $$('img[data-photo]', root)) {
    const p = img.dataset.photo;
    img.dataset.path = p; // 保留路徑（設為首頁封面等功能要用）
    img.removeAttribute('data-photo');
    load(p).then((u) => { if (u) img.src = u; else img.alt = '（找不到照片）'; });
  }
  for (const el of $$('[data-bg]', root)) {
    const p = el.dataset.bg;
    if (!p || el.dataset.done) continue;
    el.dataset.done = '1';
    (async () => {
      let u = el.dataset.thumb ? await load(thumbPath(p)) : null; // 小圖優先，載入快
      if (!u) u = await load(p);
      if (u) { el.style.backgroundImage = `url("${u}")`; el.classList.add('loaded'); }
    })();
  }
}
