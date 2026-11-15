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
  const today = todayStr();
  const d = parseYmd(today);
  const t = totals();
  const trips = [...DB.trips].sort((a, b) => b.start.localeCompare(a.start));
  const now = DB.tripsOn(today)[0];
  const feat = now || trips.find((x) => x.start <= today && x.cover) || trips.find((x) => x.cover) || trips[0];
  const dates = Object.keys(DB.index.entries).sort().reverse();
  const cover = DB.home.cover || (feat && feat.cover) || dates.map((x) => DB.index.entries[x].cover).find(Boolean) || '';
  const recent = dates.slice(0, 6);
  const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const mmdd = today.slice(5);
  const otd = dates.find((x) => x.slice(5) === mmdd && x !== today);

  let heroTitle = 'My Life Journal', heroSub = 'Record · Travel · Live', heroBtn = '';
  if (feat) {
    const days = diffDays(feat.start, feat.end) + 1;
    let ph = 0; for (let x = feat.start; x <= feat.end; x = ymd(new Date(parseYmd(x).getTime() + 864e5))) ph += DB.index.entries[x]?.photos || 0;
    heroTitle = feat.en || feat.name;
    heroSub = `${days} Days · ${(feat.places || []).length} Places · ${ph} Photos`;
    heroBtn = `<a class="btn paper-btn" href="#/trip/${esc(feat.id)}">閱讀旅程 ${icon('chevR', 15)}</a>`;
  }
  const banner = DB.mode === 'demo'
    ? `<div class="banner"><span>🧪 目前是<b>試用模式</b>，資料只存在這個瀏覽器。</span><button class="link" data-act="settings">連接 GitHub 開始同步 →</button></div>` : '';

  return `<div class="mast"><span>VOL. ${String(d.getMonth() + 1).padStart(2, '0')}</span><i></i><span>${MONTH_EN[d.getMonth() + 1].toUpperCase()} ${d.getFullYear()}</span><i></i><span>${t.n} STORIES</span></div>
  <section class="hh"${cover ? ` data-bg="${esc(cover)}"` : ''} style="${artBg(feat ? feat.id : 'home', 1)}${DB.home.cover && DB.home.pos ? `;background-position:${esc(DB.home.pos)}` : ''}">
      <button class="hh-cam" data-act="pick-cover" aria-label="更換封面">${icon('image', 15)}<span>更換封面</span></button>
      <form class="hh-search" id="hs">${icon('search', 16)}<input id="hs-q" type="search" placeholder="搜尋回憶…" autocomplete="off" enterkeyhint="search"></form>
      <div class="hh-in">
        <div class="hh-kicker">${MONTH_EN[d.getMonth() + 1].toUpperCase()} ${d.getFullYear()} · ${feat ? (now ? 'NOW TRAVELING' : 'FEATURED JOURNEY') : 'WELCOME'}</div>
        <h1 class="hh-title ${/^[\x00-\x7f]+$/.test(heroTitle) ? 'script-it' : 'zh'}">${esc(heroTitle)}</h1>
        <div class="hh-sub">${esc(heroSub)}</div>
        <div class="hh-actions">${heroBtn}<button class="btn primary" data-act="write">${icon('edit', 16)} 寫今天的日記</button></div>
      </div>
    </section>
    <section class="float-card">
      <div class="fc fc-fp"><h3>${icon('pin', 16)} 本月足跡</h3>${footprints(prefix)}</div>
      <div class="fc fc-cal" id="mc">${miniCal()}</div>
      <div class="fc fc-quote"><p class="script quote-t">${QUOTES[(d.getDate() + d.getMonth()) % QUOTES.length]}</p>${leaf}</div>
    </section>
    <nav class="quick">${[['timeline', 'book', '日記'], ['trips', 'plane', '旅行'], ['album', 'image', '相簿'], ['places', 'map', '足跡'], ['stats/' + d.getFullYear(), 'chart', '統計']].map(([h, ic, l]) => `<a href="#/${h}"><span>${icon(ic, 22)}</span>${l}</a>`).join('')}</nav>
    ${banner}
    ${spread(dates)}
    <div class="sec-row"><h2 class="sec">我的旅行</h2><a href="#/trips">查看更多 →</a></div>
    ${trips.length ? `<div class="rail">${trips.slice(0, 8).map((x) => tripCard(x)).join('')}<button class="trip-add" data-act="new-trip"><span>${icon('plus', 26)}</span>新增旅程</button></div>` : `<div class="empty"><p>還沒有旅程</p><button class="btn" data-act="new-trip">新增第一趟旅程</button></div>`}
    ${mosaic()}
    <div class="sec-row"><h2 class="sec">最近的日記</h2><a href="#/timeline">時光軸 →</a></div>
    ${recent.length ? `<div class="polaroids">${recent.map((x, i) => {
      const e = DB.index.entries[x]; const dt = parseYmd(x);
      const rot = [-1.8, 1.2, -0.8, 1.9, -1.3, 0.9][i % 6];
      return `<button class="polaroid" data-date="${x}" style="--rot:${rot}deg"><span class="tape"></span>
        <div class="pl-img" ${e.cover ? `data-bg="${esc(e.cover)}" data-thumb="1"` : ''} style="${e.cover ? '' : artBg(x, dt.getMonth())}"></div>
        <div class="pl-cap"><span class="script pl-date">${x.replace(/-/g, '.')} <em>${WEEK[dt.getDay()]}</em></span><b>${e.mood || ''} ${esc(e.title || e.excerpt.slice(0, 18) || '（無標題）')}</b><small>${esc(e.excerpt)}</small></div></button>`;
    }).join('')}</div>` : `<div class="empty"><div class="empty-ic">✍️</div><p>寫下第一篇日記吧</p></div>`}
    ${otd ? `<button class="otd-card" data-date="${otd}">🕰️ <b>那年今天</b>　${otd.slice(0, 4)} 年 · ${esc(DB.index.entries[otd].title || DB.index.entries[otd].excerpt.slice(0, 24))}</button>` : ''}`;
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
