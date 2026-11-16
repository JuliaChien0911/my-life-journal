// 相簿：所有日記裡的照片，依月份整理
import { DB } from './db.js';
import { S, hooks } from './state.js';
import { $, esc, fmtShort } from './util.js';
import { artBg } from './art.js';

let limit = 120;
let sel = ''; // '' = 全部、'life' = 生活（不在任何旅程內）、其他 = 旅程 id

function photos() {
  const out = [];
  for (const [d, e] of Object.entries(DB.index.entries)) {
    const list = e.pics && e.pics.length ? e.pics : e.cover ? [e.cover] : [];
    for (const p of list) out.push({ d, p });
  }
  return out.sort((a, b) => b.d.localeCompare(a.d) || a.p.localeCompare(b.p));
}

const inTrip = (d, t) => t.start <= d && d <= t.end;
const dayNo = (d, t) => Math.round((new Date(d + 'T00:00:00') - new Date(t.start + 'T00:00:00')) / 86400000) + 1;

export function renderAlbum() {
  const trips = [...DB.trips].sort((a, b) => b.start.localeCompare(a.start));
  if (sel && sel !== 'life' && !DB.tripById(sel)) sel = '';
  const everything = photos();
  const trip = sel && sel !== 'life' ? DB.tripById(sel) : null;
  const all = trip ? everything.filter((x) => inTrip(x.d, trip))
    : sel === 'life' ? everything.filter((x) => !trips.some((t) => inTrip(x.d, t)))
    : everything;
  const chips = [`<button class="chip${sel === '' ? ' on' : ''}" data-al="">全部</button>`, `<button class="chip${sel === 'life' ? ' on' : ''}" data-al="life">生活</button>`,
    ...trips.map((t) => `<button class="chip${sel === t.id ? ' on' : ''}" data-al="${esc(t.id)}">${esc(t.emoji || '✈️')} ${esc(t.name)}</button>`)].join('');
  const shown = all.slice(0, limit);
  let html = '', last = '';
  for (const { d, p } of shown) {
    // 旅程內依「第幾天」分組（新到舊），其他依月份分組
    const key = trip ? d : d.slice(0, 7);
    if (key !== last) {
      if (last) html += '</div>';
      html += trip ? `<h3 class="al-month">Day ${dayNo(d, trip)} · ${fmtShort(d)}</h3><div class="al-grid">` : `<h3 class="al-month">${key.replace('-', ' 年 ')} 月</h3><div class="al-grid">`;
      last = key;
    }
    html += `<button class="al-item" data-date="${d}" data-bg="${esc(p)}" data-thumb="1" title="${d}"><span>${fmtShort(d)}</span></button>`;
  }
  if (last) html += '</div>';
  return `<div class="page-head"><div><div class="hero-kicker dim">GALLERY</div><h1 class="cal-title">相簿</h1><div class="cal-sub">共 ${all.length} 張照片</div></div></div>
  <div class="chips pt-chips">${chips}</div>
  ${html || `<div class="empty big"><div class="empty-ic">🖼️</div><p>${sel ? '這裡還沒有照片。' : '還沒有照片。<br>寫日記時按「照片」加入，就會出現在這裡。'}</p></div>`}
  ${all.length > limit ? `<p class="center"><button class="btn" data-act="more">載入更多（還有 ${all.length - limit} 張）</button></p>` : ''}`;
}

export function bindAlbum() {
  $('#main').onclick = (e) => {
    if (e.target.closest('[data-act="more"]')) { limit += 120; hooks.renderMain(); return; }
    const c = e.target.closest('[data-al]');
    if (c) { sel = c.dataset.al; limit = 120; hooks.renderMain(); return; }
    const it = e.target.closest('.al-item');
    if (it) hooks.openDay(it.dataset.date);
  };
}
