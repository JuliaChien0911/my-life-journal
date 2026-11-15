// 首頁封面挑選器（類似 FB 的更換封面）：從已有照片挑 / 上傳新照片 → 拖曳調整位置 → 儲存
import { DB } from './db.js';
import { hooks } from './state.js';
import { openModal, $, $$, esc, toast, resizeImage } from './util.js';
import { icon } from './icons.js';
import { hydrate } from './media.js';

function allPhotos() {
  const seen = new Set(), out = [];
  const add = (p) => { if (p && !seen.has(p)) { seen.add(p); out.push(p); } };
  add(DB.home.cover);
  const dates = Object.keys(DB.index.entries).sort().reverse();
  for (const d of dates) for (const p of (DB.index.entries[d].pics || [])) add(p);
  for (const t of DB.trips) add(t.cover);
  return out;
}

export function pickHomeCover() {
  const photos = allPhotos();
  const m = openModal(`<div class="modal-head"><h3>更換首頁封面</h3><button class="icon-btn" data-close aria-label="關閉">${icon('x')}</button></div>
    <div class="cp-body">
      <label class="btn primary cp-up">${icon('image', 16)} 上傳新照片<input type="file" accept="image/*" hidden id="cp-file"></label>
      <div class="cp-title">從我的照片選擇（${photos.length}）</div>
      ${photos.length ? `<div class="cp-grid">${photos.map((p) => `<button class="cp-it" data-p="${esc(p)}"><i data-bg="${esc(p)}" data-thumb="1"></i></button>`).join('')}</div>`
        : '<div class="empty"><p>還沒有照片，先上傳一張吧</p></div>'}
      ${DB.home.cover ? '<button class="btn grow" id="cp-auto" style="margin-top:12px;width:100%">恢復自動挑選</button>' : ''}
    </div>`);
  m.el.classList.add('cp-modal');
  hydrate(m.el);
  m.el.querySelector('#cp-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const blob = await resizeImage(f, 1800, 0.84); step2(m, { blob }); } catch (err) { toast(err.message, 'error'); }
  };
  const au = m.el.querySelector('#cp-auto');
  if (au) au.onclick = async () => { await DB.setHomeCover(''); toast('已恢復自動挑選'); m.close(); hooks.renderAll(); };
  m.el.querySelector('.cp-grid')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (b) step2(m, { path: b.dataset.p });
  });
}

async function step2(m, src) {
  const el = m.el;
  el.innerHTML = `<div class="modal-head"><h3>調整位置</h3><button class="icon-btn" data-close aria-label="關閉">${icon('x')}</button></div>
    <div class="cp-body"><div class="cp-frame" id="cp-fr"><span class="cp-hint">按住拖曳，調整要顯示的位置</span></div>
    <div class="actions" style="margin-top:12px"><button class="btn grow" id="cp-back">返回</button><button class="btn primary grow" id="cp-save" disabled>儲存</button></div></div>`;
  const fr = el.querySelector('#cp-fr');
  let url;
  try { url = src.blob ? URL.createObjectURL(src.blob) : await DB.photoUrl(src.path); } catch { url = null; }
  if (!url) { toast('讀不到照片', 'error'); return pickHomeCover(), m.close(); }
  const im = new Image();
  await new Promise((r) => { im.onload = r; im.onerror = r; im.src = url; });
  fr.style.backgroundImage = `url("${url}")`;
  let px = 50, py = 50;
  const apply = () => { fr.style.backgroundPosition = `${px}% ${py}%`; };
  apply();
  const over = () => {
    const w = fr.clientWidth, h = fr.clientHeight, s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    return [im.naturalWidth * s - w, im.naturalHeight * s - h];
  };
  let drag = null;
  fr.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, px, py }; fr.setPointerCapture(e.pointerId); fr.classList.add('drag'); };
  fr.onpointermove = (e) => {
    if (!drag) return;
    const [ox, oy] = over();
    if (ox > 1) px = Math.min(100, Math.max(0, drag.px - (e.clientX - drag.x) / ox * 100));
    if (oy > 1) py = Math.min(100, Math.max(0, drag.py - (e.clientY - drag.y) / oy * 100));
    apply();
  };
  fr.onpointerup = fr.onpointercancel = () => { drag = null; fr.classList.remove('drag'); };
  const save = el.querySelector('#cp-save'); save.disabled = false;
  el.querySelector('#cp-back').onclick = () => { m.close(); pickHomeCover(); };
  save.onclick = async () => {
    save.disabled = true; save.textContent = '儲存中…';
    try {
      const path = src.path || await DB.uploadCover('home', src.blob);
      await DB.setHomeCover(path, `${Math.round(px)}% ${Math.round(py)}%`);
      toast('已更換首頁封面 ✓'); m.close(); hooks.renderAll();
    } catch (e) { toast(e.message, 'error'); save.disabled = false; save.textContent = '儲存'; }
  };
}
