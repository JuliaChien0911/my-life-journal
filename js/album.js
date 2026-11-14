// 相簿：所有日記裡的照片，依月份整理
import { DB } from './db.js';
import { S, hooks } from './state.js';
import { $, esc, fmtShort } from './util.js';
import { artBg } from './art.js';

let limit = 120;

function photos() {
  const out = [];
  for (const [d, e] of Object.entries(DB.index.entries)) {
    const list = e.pics && e.pics.length ? e.pics : e.cover ? [e.cover] : [];
    for (const p of list) out.push({ d, p });
  }
  return out.sort((a, b) => b.d.localeCompare(a.d) || a.p.localeCompare(b.p));
}

export function renderAlbum() {
  const all = photos();
  const shown = all.slice(0, limit);
  let html = '', last = '';
  for (const { d, p } of shown) {
    const m = d.slice(0, 7);
    if (m !== last) { if (last) html += '</div>'; html += `<h3 class="al-month">${m.replace('-', ' 年 ')} 月</h3><div class="al-grid">`; last = m; }
    html += `<button class="al-item" data-date="${d}" data-bg="${esc(p)}" data-thumb="1" title="${d}"><span>${fmtShort(d)}</span></button>`;
  }
  if (last) html += '</div>';
  return `<div class="page-head"><div><div class="hero-kicker dim">GALLERY</div><h1 class="cal-title">相簿</h1><div class="cal-sub">共 ${all.length} 張照片</div></div></div>
  ${html || `<div class="empty big"><div class="empty-ic">🖼️</div><p>還沒有照片。<br>寫日記時按「照片」加入，就會出現在這裡。</p></div>`}
  ${all.length > limit ? `<p class="center"><button class="btn" data-act="more">載入更多（還有 ${all.length - limit} 張）</button></p>` : ''}`;
}

export function bindAlbum() {
  $('#main').onclick = (e) => {
    if (e.target.closest('[data-act="more"]')) { limit += 120; hooks.renderMain(); return; }
    const it = e.target.closest('.al-item');
    if (it) hooks.openDay(it.dataset.date);
  };
}
