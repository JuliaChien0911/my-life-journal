// 時光軸：把所有日記依年 / 月排成一條垂直時間線（可切換 全部 / 生活 / 旅行）
import { S, hooks } from './state.js';
import { DB } from './db.js';
import { $, esc, parseYmd, WEEK } from './util.js';
import { artBg } from './art.js';
import { icon } from './icons.js';

const MONTH_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let limit = 60;

export function renderTimeline() {
  const f = S.tlFilter || 'all';
  const all = Object.entries(DB.index.entries).sort((a, b) => b[0].localeCompare(a[0]));
  const list = all.filter(([, e]) => (f === 'all' ? true : f === 'trip' ? !!e.trip : !e.trip));
  const shown = list.slice(0, limit);
  let html = '', ly = '', lm = '';
  for (const [d, e] of shown) {
    const y = d.slice(0, 4), m = d.slice(0, 7), dt = parseYmd(d);
    if (y !== ly) { html += `<div class="tm-year script-it">${y}</div>`; ly = y; lm = ''; }
    if (m !== lm) {
      const n = list.filter(([x]) => x.startsWith(m)).length;
      html += `<div class="tm-month"><b class="script">${MONTH_EN[dt.getMonth() + 1]}</b><span>${dt.getMonth() + 1} 月 · ${n} 篇</span></div>`; lm = m;
    }
    const trip = e.trip ? DB.tripById(e.trip) : null;
    html += `<button class="tm-item${e.cover ? ' has-img' : ''}" data-date="${d}">
      <div class="tm-date"><b>${dt.getDate()}</b><span>週${WEEK[dt.getDay()]}</span></div>
      <i class="tm-dot"></i>
      <div class="tm-card">
        ${e.cover ? `<div class="tm-img" data-bg="${esc(e.cover)}" data-thumb="1" style="${artBg(d, dt.getMonth())}">${e.photos > 1 ? `<em>+${e.photos - 1}</em>` : ''}</div>` : ''}
        <div class="tm-txt">
          <div class="tm-meta">${e.mood ? `<span>${e.mood}</span>` : ''}${e.weather ? `<span>${e.weather}</span>` : ''}${e.location ? `<span>${icon('pin', 12)} ${esc(e.location)}</span>` : ''}${trip ? `<span class="tm-trip" style="--c:${esc(trip.color)}">${esc(trip.emoji || '✈️')} ${esc(trip.name)}</span>` : ''}</div>
          <h3>${esc(e.title || e.excerpt.slice(0, 20) || '（無標題）')}</h3>
          <p>${esc(e.excerpt)}</p>
          ${(e.tags || []).length ? `<div class="tm-tags">${e.tags.slice(0, 4).map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      </div></button>`;
  }
  const seg = [['all', '全部'], ['life', '生活日記'], ['trip', '旅行日記']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-tlf="${k}">${l}</button>`).join('');
  return `<div class="page-head"><div><div class="hero-kicker dim">TIMELINE</div><h1 class="cal-title">時光軸</h1><div class="cal-sub">共 ${list.length} 篇 · 一天一天收藏</div></div>
    <button class="btn primary" data-act="write">${icon('edit', 16)} 寫日記</button></div>
    <div class="seg3">${seg}</div>
    ${html ? `<div class="tm">${html}</div>` : `<div class="empty big"><div class="empty-ic">📔</div><p>這裡還沒有日記。<br>寫下今天，時光軸就開始了。</p></div>`}
    ${list.length > limit ? `<p class="center"><button class="btn" data-act="more">載入更多（還有 ${list.length - limit} 篇）</button></p>` : ''}`;
}

export function bindTimeline() {
  $('#main').onclick = (e) => {
    const f = e.target.closest('[data-tlf]');
    if (f) { S.tlFilter = f.dataset.tlf; limit = 60; hooks.renderMain(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'more') { limit += 60; hooks.renderMain(); return; }
    if (act === 'write') { hooks.openDay(new Date().toLocaleDateString('sv'), { edit: true }); return; }
    const it = e.target.closest('.tm-item');
    if (it) hooks.openDay(it.dataset.date);
  };
}
