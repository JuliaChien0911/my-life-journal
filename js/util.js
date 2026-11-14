// 共用小工具：日期、DOM、本機儲存、提示訊息、對話框
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayStr = () => ymd(new Date());
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export const fmtLong = (s) => { const d = parseYmd(s); return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日（週${WEEK[d.getDay()]}）`; };
export const fmtShort = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
export const fmtRange = (a, b) => (a.slice(0, 4) === b.slice(0, 4) ? `${a.replace(/-/g, '/')} – ${b.slice(5).replace('-', '/')}` : `${a.replace(/-/g, '/')} – ${b.replace(/-/g, '/')}`);

export const uid = () => Math.random().toString(36).slice(2, 8);
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function toast(msg, kind = '') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), kind === 'error' ? 4500 : 2200);
  setTimeout(() => el.remove(), kind === 'error' ? 4900 : 2600);
}

export function openModal(html) {
  const root = $('#modal-root');
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(back);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); back.remove(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  const el = back.firstElementChild;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { el, close };
}

export function lightbox(src) {
  const m = openModal(`<img class="lb-img" src="${esc(src)}" alt=""><button class="btn ghost" data-close style="margin-top:12px;width:100%">關閉</button>`);
  m.el.classList.add('lightbox');
}

// 把圖片縮小成 JPEG，節省 GitHub 空間與載入時間
export async function resizeImage(file, max = 1600, quality = 0.82) {
  const bmp = await (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }) : loadImg(file));
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r);
  c.height = Math.round(bmp.height * r);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('圖片處理失敗'))), 'image/jpeg', quality));
}
function loadImg(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('無法讀取圖片'));
    img.src = URL.createObjectURL(file);
  });
}
