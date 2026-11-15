// 首頁：大圖封面 + 本月足跡 / 迷你月曆 / 金句 + 我的旅行 + 最近日記（寶麗來）
import { S, go, hooks } from './state.js';
import { DB } from './db.js';
import { $, esc, todayStr, parseYmd, WEEK, pad, ymd, diffDays } from './util.js';
import { icon } from './icons.js';
import { artBg } from './art.js';
import { tripCard } from './trips.js';

const MONTH_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUOTES = ['Collect moments, not things.', 'Every ordinary day is a story.', 'Make today worth remembering.', 'Slow down, look around, write it down.', 'Wander often, wonder always.'];
let hc = null; // 首頁迷你月曆目前顯示的月份

export function totals() {
  const es = Object.values(DB.index.entries);
  return { n: es.length, photos: es.reduce((a, e) => a + (e.photos || 0), 0), chars: es.reduce((a, e) => a + (e.words || 0), 0), trips: DB.trips.length, streak: DB.streak(todayStr()) };
}

const leaf = `<svg class="leaf" viewBox="0 0 80 110" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M40 108C38 80 42 50 56 10"/><path d="M41 90c-12-2-20-10-22-20 11 0 20 6 22 20zM43 72c10-4 17-12 18-22-10 2-17 9-18 22zM47 52c-9-3-15-10-16-19 9 1 15 7 16 19zM51 34c7-4 11-10 11-17-7 2-11 8-11 17z"/></svg>`;

function footprints(prefix) {
  const groups = new Map();
  for (const [d, e] of Object.entries(DB.index.entries).sort()) {
    if (!d.startsWith(prefix) || !e.location) continue;
    if (!groups.has(e.location)) groups.set(e.location, { name: e.location, date: d, cover: e.cover || '' });
    else if (!groups.get(e.location).cover && e.cover) groups.get(e.location).cover = e.cover;
  }
  const list = [...groups.values()].slice(0, 8);
  if (!list.length) return '<p class="muted sm">寫日記時填上「地點」，這個月去過的地方就會像貼紙一樣收集在這裡。</p>';
  return `<div class="fp-row">${list.map((g, i) => `<button class="fp" data-date="${g.date}"><i class="fp-img" ${g.cover ? `data-bg="${esc(g.cover)}" data-thumb="1"` : ''} style="${g.cover ? '' : artBg(g.name, i)}"></i><span>${esc(g.name)}</span></button>`).join('')}</div>`;
}

function miniCal() {
  const now = parseYmd(todayStr());
  if (!hc) hc = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = hc, ws = S.settings.weekStart, today = todayStr();
  const off = (new Date(y, m, 1).getDay() - ws + 7) % 7, dim = new Date(y, m + 1, 0).getDate();
  const head = [...Array(7)].map((_, i) => `<i>${WEEK[(i + ws) % 7]}</i>`).join('');
  let cells = '<b></b>'.repeat(off);
  for (let d = 1; d <= dim; d++) {
    const s = `${y}-${pad(m + 1)}-${pad(d)}`;
    cells += `<button class="mc${s === today ? ' today' : ''}${DB.index.entries[s] ? ' has' : ''}" data-date="${s}">${d}</button>`;
  }
  return `<div class="mc-head"><b>${y} 年 ${m + 1} 月</b><span><button class="icon-btn" data-hc="-1" aria-label="上個月">${icon('chevL', 16)}</button><button class="icon-btn" data-hc="1" aria-label="下個月">${icon('chevR', 16)}</button></span></div><div class="mc-grid">${head}${cells}</div>`;
}


// 最新一篇日記：跨頁式排版（兩張疊放的寶麗來 + 日期 / 地點 / 內文）
function spread(dates) {
  const d = dates.find((x) => DB.index.entries[x].cover) || dates[0];
  if (!d) return '';
  const e = DB.index.entries[d], dt = parseYmd(d);
  const pics = (e.pics && e.pics.length ? e.pics : e.cover ? [e.cover] : []);
  const second = pics[1] || (dates.map((x) => DB.index.entries[x]).filter((x) => x !== e && x.cover)[0] || {}).cover || '';
  return `<section class="spread" data-date="${d}">
    <div class="sp-photos">
      <div class="sp-p sp-a"><span class="tape"></span><div ${e.cover ? `data-bg="${esc(e.cover)}" data-thumb="1"` : ''} style="${e.cover ? '' : artBg(d, dt.getMonth())}"></div></div>
      <div class="sp-p sp-b"><div ${second ? `data-bg="${esc(second)}" data-thumb="1"` : ''} style="${second ? '' : artBg(d + 'b', dt.getMonth() + 2)}"></div><span class="script">${esc(e.location || 'Memories')}</span></div>
    </div>
    <div class="sp-text">
      <div class="sp-kicker">LATEST STORY</div>
      <div class="sp-date script-it">${d.replace(/-/g, '.')}</div>
      <div class="sp-loc">${e.location ? icon('pin', 14) + ' ' + esc(e.location) : '週' + WEEK[dt.getDay()]}${e.mood ? ' · ' + e.mood : ''}${e.weather ? ' ' + e.weather : ''}</div>
      <h3 class="sp-title">${esc(e.title || '未命名的一天')}</h3>
      <p>${esc(e.excerpt)}</p>
      <span class="sp-more">閱讀日記 ${icon('chevR', 15)}</span>
    </div></section>`;
}

// 最近收藏的照片：不規則拼貼
function mosaic() {
  const out = [];
  for (const [d, e] of Object.entries(DB.index.entries).sort().reverse()) {
    for (const p of (e.pics && e.pics.length ? e.pics : e.cover ? [e.cover] : [])) { out.push({ d, p }); if (out.length >= 7) break; }
    if (out.length >= 7) break;
  }
  if (out.length < 3) return '';
  return `<div class="sec-row"><h2 class="sec">最近收藏的照片</h2><a href="#/album">相簿 →</a></div>
    <div class="mosaic">${out.map((x, i) => `<button class="mz mz${i}" data-date="${x.d}" data-bg="${esc(x.p)}" data-thumb="1"><span>${x.d.slice(5).replace('-', '/')}</span></button>`).join('')}</div>`;
}

export function renderHome() {
  const today = todayStr(), d = parseYmd(today), t = totals(), E = DB.index.entries;
  const dates = Object.keys(E).sort().reverse();
  const covers = dates.filter((x) => E[x].cover);
  const trips = [...DB.trips].sort((a, b) => b.start.localeCompare(a.start));
  const cur = DB.tripsOn(today)[0] || trips[0];
  const tc = trips.find((x) => x.cover);
  const hero = DB.home.cover || (cur && cur.cover) || (tc && tc.cover) || (covers[0] && E[covers[0]].cover) || '';
  const im = (src, key, idx, thumb) => `${src ? `data-bg="${esc(src)}" ${thumb ? 'data-thumb="1" ' : ''}` : ''}style="${artBg(key, idx)}"`;
  const pic = (i) => (covers[i] !== undefined ? E[covers[i]].cover : '');
  const cam = (w) => `<svg class="ic" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
  const heart = `<svg class="ic" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z"/></svg>`;
  const go = icon('chevR', 14);
  const weekday = (x) => WEEK[parseYmd(x).getDay()];

  // 四張快速卡片
  const cards = [
    ['#/album', cam(30), '最近照片', `${t.photos} 張美好回憶`, pic(0), 'p'],
    ['#/trips', icon('plane', 28), '最近旅行', `${t.trips} 次旅行`, tc ? tc.cover : pic(3), 't'],
    ['#/timeline', icon('book', 28), '最近日記', `${t.n} 篇日記`, pic(1) || pic(0), 'd'],
    ['#/stats/' + d.getFullYear(), heart, '收藏回憶', '用愛珍藏的時光', pic(2) || pic(0), 'f'],
  ].map((x, i) => `<a href="${x[0]}"><div class="dq-img" ${im(x[4], 'q' + x[5], i, 1)}></div><div class="dq-row"><span class="dq-ic">${x[1]}</span><span class="dq-t"><b>${x[2]}</b><small>${x[3]}</small></span><span class="dq-go">${go}</span></div></a>`).join('');

  // 最新日記
  const le = dates[0], L0 = le ? E[le] : null;
  const tag = L0 ? ((L0.tags && L0.tags[0]) || (L0.trip && (DB.tripById(L0.trip) || {}).name) || '日記') : '';
  const diary = L0
    ? `<button class="dd-body" data-date="${le}"><div class="dd-img" ${im(L0.cover, le, d.getMonth(), 1)}></div><div class="dd-txt"><span class="dd-date">${le.replace(/-/g, '.')}　星期${weekday(le)}</span><h3>${esc(L0.title || L0.excerpt.slice(0, 20) || '（無標題）')}</h3><p>${esc(L0.excerpt)}</p><div class="dd-foot"><span class="dd-pill">${esc(tag)}</span><span class="dd-meta">${cam(18)} ${L0.photos || 0}${L0.location ? ` &nbsp; ${icon('pin', 15)} ${esc(L0.location)}` : ''}</span></div></div></button>`
    : `<div class="empty"><p>寫下第一篇日記吧</p><button class="btn primary" data-act="write">寫今天的日記</button></div>`;

  // On This Day
  const md = today.slice(5);
  const pv = dates.filter((x) => x.slice(5) === md && x !== today);
  const ly = pv[0] || `${d.getFullYear() - 1}-${md}`;
  const wd = pv[0] && pv[0].slice(0, 4) === String(d.getFullYear() - 1) ? '去年' : '過去';
  const otd = `<aside class="do"><div class="do-h">${icon('calendar', 26)}<h2>On This Day</h2></div><div class="do-date">${ly.slice(0, 4)} · ${md.replace('-', ' · ')}</div>`
    + (pv.length
      ? `<p>${wd}的今天，你留下了 ${pv.length} 個回憶。</p><div class="do-th">${pv.slice(0, 3).map((x) => `<button class="do-i" data-date="${x}" ${im(E[x].cover, x, 0, 1)}></button>`).join('')}</div><button class="do-go" data-date="${pv[0]}">查看${wd}今日 ${go}</button>`
      : `<p>還沒有過去的紀錄。今天寫下的，明年的今天就會出現在這裡。</p><button class="do-go" data-act="write">寫今天的日記 ${go}</button>`)
    + `</aside>`;

  // 旅行橫幅
  let days = 0, ph = 0;
  if (cur) {
    days = diffDays(cur.start, cur.end) + 1;
    for (let x = cur.start, n = 0; x <= cur.end && n < 400; x = ymd(new Date(parseYmd(x).getTime() + 864e5)), n++) ph += E[x]?.photos || 0;
  }
  const banner = cur
    ? `<a class="dt" href="#/trip/${esc(cur.id)}"><div class="dt-bg" ${im(cur.cover, cur.id, 2, 1)}></div><div class="dt-shade"></div><div class="dt-l"><span class="dt-k">TRAVEL JOURNAL</span><b class="dt-n">${esc(cur.name)}</b><span class="dt-d">${cur.start.slice(5).replace('-', '.')} – ${cur.end.slice(5).replace('-', '.')}${cur.destination ? ' · ' + esc(cur.destination) : ''}</span><span class="dt-btn">查看旅程 ${go}</span></div><div class="dt-r"><span>${icon('pin', 20)} ${(cur.places || []).length} Places</span><span>${cam(20)} ${ph} Memories</span><span>${icon('calendar', 20)} ${days} Days</span></div></a>`
    : `<button class="dt dt-new" data-act="new-trip">${icon('plus', 22)} 新增第一趟旅程</button>`;
  const demo = DB.mode === 'demo'
    ? `<div class="banner"><span>🧪 目前是<b>試用模式</b>，資料只存在這個瀏覽器。</span><button class="link" data-act="settings">連接 GitHub 開始同步 →</button></div>` : '';
  const pos = DB.home.cover && DB.home.pos ? `;background-position:${esc(DB.home.pos)}` : '';

  return `${demo}<section class="dh">
    <div class="dh-bg" ${hero ? `data-bg="${esc(hero)}" ` : ''}style="${artBg('home', 1)}${pos}"></div><div class="dh-shade"></div>
    <button class="hh-cam" data-act="pick-cover" aria-label="更換封面">${icon('image', 15)}<span>更換封面</span></button>
    <form class="hh-search" id="hs">${icon('search', 16)}<input id="hs-q" type="search" placeholder="搜尋回憶…" autocomplete="off" enterkeyhint="search"></form>
    <div class="dh-in">
      <div class="dh-title">My Life Journal</div>
      <div class="dh-tag">Collect Beautiful Moments ♡</div>
      <div class="dh-sub">我的生活 · 我的故事 · 我留下的時間</div>
      <div class="dh-date"><b>${d.getFullYear()} · ${pad(d.getMonth() + 1)} · ${pad(d.getDate())}<span>星期${WEEK[d.getDay()]}</span></b><span>今天，想記住什麼？</span></div>
      <button class="dh-write" data-act="write">${icon('edit', 18)} 寫日記 ${icon('chevR', 16)}</button>
    </div></section>
    <nav class="dq">${cards}</nav>
    <div class="drow"><section class="dd"><div class="dsec"><h2>最新日記</h2><a href="#/timeline">查看更多 ›</a></div>${diary}</section>${otd}</div>
    ${banner}`;
}

export function bindHome() {
  const main = $('#main');
  $('#hs').onsubmit = (e) => { e.preventDefault(); S.q = $('#hs-q').value.trim(); S.filters = { mood: '', trip: '', tag: '' }; go('#/search'); };
  main.onclick = (e) => {
    const nav = e.target.closest('[data-hc]');
    if (nav) { hc = { y: new Date(hc.y, hc.m + Number(nav.dataset.hc), 1).getFullYear(), m: new Date(hc.y, hc.m + Number(nav.dataset.hc), 1).getMonth() }; $('#mc').innerHTML = miniCal(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'write') { hooks.openDay(todayStr(), { edit: true }); return; }
    if (act === 'pick-cover') { import('./covers.js').then((m) => m.pickHomeCover()); return; }
    if (act === 'new-trip') { import('./trips.js').then((m) => m.editTrip(null)); return; }
    const c = e.target.closest('[data-date]');
    if (c) hooks.openDay(c.dataset.date);
  };
}
