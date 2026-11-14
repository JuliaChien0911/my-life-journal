// 搜尋與篩選（依索引，不需下載每篇日記）
import { S, MOODS, hooks } from './state.js';
import { DB } from './db.js';
import { $, esc, fmtLong, parseYmd, WEEK, debounce } from './util.js';
import { icon } from './icons.js';
import { hydrate } from './media.js';

const re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hl = (text, q) => { const t = esc(text); if (!q) return t; return t.replace(new RegExp(`(${re(esc(q))})`, 'gi'), '<mark>$1</mark>'); };

export function results() {
  const q = S.q.trim().toLowerCase();
  const { mood, trip, tag } = S.filters;
  return Object.entries(DB.index.entries)
    .filter(([d, e]) => {
      if (mood && e.mood !== mood) return false;
      if (tag && !(e.tags || []).includes(tag)) return false;
      if (trip) { const t = DB.tripById(trip); if (!t || d < t.start || d > t.end) return false; }
      if (!q) return true;
      return [e.title, e.excerpt, e.location, (e.tags || []).join(' '), d].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => b[0].localeCompare(a[0]));
}

function list() {
  const r = results();
  if (!r.length) return `<div class="empty"><div class="empty-ic">🔍</div><p>${Object.keys(DB.index.entries).length ? '沒有符合的日記' : '還沒有任何日記'}</p></div>`;
  let lastMonth = '';
  return r.slice(0, 300).map(([d, e]) => {
    const mon = d.slice(0, 7);
    const head = mon !== lastMonth ? `<h3 class="sr-month">${mon.replace('-', ' 年 ')} 月</h3>` : '';
    lastMonth = mon;
    const dt = parseYmd(d);
    return `${head}<button class="sr-item" data-date="${d}">
      <div class="sr-date"><b>${dt.getDate()}</b><span>週${WEEK[dt.getDay()]}</span></div>
      <div class="sr-main"><div class="sr-title">${e.mood || ''} ${hl(e.title || e.excerpt.slice(0, 28) || '（無標題）', S.q.trim())}${e.photos ? ` <small>📷${e.photos}</small>` : ''}</div>
        <div class="sr-ex">${hl(e.excerpt, S.q.trim())}</div>
        <div class="sr-tags">${e.location ? `<span>${icon('pin', 12)} ${esc(e.location)}</span>` : ''}${(e.tags || []).map((t) => `<span>#${esc(t)}</span>`).join('')}</div></div>
      ${e.cover ? `<div class="thumb" data-bg="${esc(e.cover)}" data-thumb="1"></div>` : ''}
    </button>`;
  }).join('') + (r.length > 300 ? `<p class="muted center">只顯示最新 300 篇，請縮小條件</p>` : '');
}

export function renderSearch() {
  const tags = DB.allTags().slice(0, 14);
  const f = S.filters;
  return `<div class="page-head"><div><div class="hero-kicker dim">SEARCH</div><h1 class="cal-title">搜尋回憶</h1><div class="cal-sub">共 ${Object.keys(DB.index.entries).length} 篇日記</div></div></div>
  <div class="search-box">${icon('search', 18)}<input id="q" class="inp" type="search" placeholder="搜尋標題、內容、地點、標籤…" value="${esc(S.q)}" autocomplete="off"></div>
  <div class="filters">
    <div class="chips">${MOODS.map((m) => `<button class="chip${f.mood === m.e ? ' on' : ''}" data-f="mood" data-v="${m.e}" title="${m.t}">${m.e}</button>`).join('')}</div>
    <select id="f-trip" class="inp sm"><option value="">所有旅程</option>${DB.trips.map((t) => `<option value="${esc(t.id)}" ${f.trip === t.id ? 'selected' : ''}>${esc(t.emoji || '')} ${esc(t.name)}</option>`).join('')}</select>
  </div>
  ${tags.length ? `<div class="tag-row">${tags.map(([t, n]) => `<button class="tag${f.tag === t ? ' on' : ''}" data-f="tag" data-v="${esc(t)}">#${esc(t)} <small>${n}</small></button>`).join('')}</div>` : ''}
  <div id="sr-list">${list()}</div>`;
}

export function bindSearch() {
  const main = $('#main');
  const refresh = () => { $('#sr-list').innerHTML = list(); hydrate($('#sr-list')); };
  $('#q').oninput = debounce((e) => { S.q = e.target.value; refresh(); }, 150);
  $('#f-trip').onchange = (e) => { S.filters.trip = e.target.value; refresh(); };
  main.onclick = (e) => {
    const f = e.target.closest('[data-f]');
    if (f) {
      const k = f.dataset.f;
      S.filters[k] = S.filters[k] === f.dataset.v ? '' : f.dataset.v;
      hooks.renderMain(); return;
    }
    const it = e.target.closest('.sr-item');
    if (it) hooks.openDay(it.dataset.date);
  };
}
