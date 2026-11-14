// 月曆與年曆視圖
import { S, go, hooks } from './state.js';
import { DB } from './db.js';
import { $, $$, esc, ymd, todayStr, WEEK, pad } from './util.js';
import { icon } from './icons.js';
import { artBg } from './art.js';
import { tripCard } from './trips.js';

const MONTH_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 本月封面：本月最後一篇有照片的日記；沒有就用本月內旅程的封面
function monthCover(prefix) {
  const ds = Object.keys(DB.index.entries).filter((d) => d.startsWith(prefix) && DB.index.entries[d].cover).sort();
  if (ds.length) return DB.index.entries[ds[ds.length - 1]].cover;
  const t = DB.trips.find((x) => x.cover && x.start.slice(0, 7) <= prefix && x.end.slice(0, 7) >= prefix);
  return t ? t.cover : '';
}

// 幫每個旅程分配「橫條所在的列」，這樣跨日的旅程橫條在每一天都對齊
function assignSlots(trips, from, to) {
  const list = trips.filter((t) => t.start <= to && t.end >= from).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const ends = [];
  const slot = {};
  for (const t of list) {
    let s = ends.findIndex((e) => e < t.start);
    if (s < 0) { s = ends.length; ends.push(t.end); } else ends[s] = t.end;
    slot[t.id] = s;
  }
  return slot;
}

export function renderMonth() {
  const { y, m } = S.cursor;
  const ws = S.settings.weekStart;
  const first = new Date(y, m, 1);
  const dim = new Date(y, m + 1, 0).getDate();
  const offset = (first.getDay() - ws + 7) % 7;
  const rows = Math.ceil((offset + dim) / 7);
  const days = [];
  for (let i = 0; i < rows * 7; i++) days.push(ymd(new Date(y, m, 1 - offset + i)));
  const slots = assignSlots(DB.trips, days[0], days[days.length - 1]);
  const today = todayStr();
  const prefix = `${y}-${pad(m + 1)}`;
  const monthCount = Object.keys(DB.index.entries).filter((d) => d.startsWith(prefix)).length;
  const streak = DB.streak(today);
  const monthEnd = `${prefix}-${pad(dim)}`;
  const monthTrips = DB.trips.filter((t) => t.start <= monthEnd && t.end >= `${prefix}-01`);

  const dow = [...Array(7)].map((_, i) => `<div class="${(i + ws) % 7 === 0 || (i + ws) % 7 === 6 ? 'we' : ''}">${WEEK[(i + ws) % 7]}</div>`).join('');

  const cells = days.map((d, i) => {
    const e = DB.index.entries[d];
    const col = i % 7;
    const covering = DB.tripsOn(d);
    const maxSlot = covering.length ? Math.max(...covering.map((t) => slots[t.id])) : -1;
    let bars = '';
    for (let s = 0; s <= maxSlot; s++) {
      const t = covering.find((x) => slots[x.id] === s);
      if (!t) { bars += '<i class="bar empty"></i>'; continue; }
      const cls = `bar${d === t.start ? ' start' : ''}${d === t.end ? ' end' : ''}`;
      const label = d === t.start || col === 0 ? `${t.emoji || ''} ${esc(t.name)}` : '';
      bars += `<i class="${cls}" style="--c:${esc(t.color)}">${label}</i>`;
    }
    const classes = ['day', d.slice(0, 7) !== prefix ? 'other' : '', d === today ? 'today' : '', d === S.selected ? 'sel' : '', e ? 'has' : '', col === 0 || col === 6 ? '' : ''].filter(Boolean).join(' ');
    const wd = (col + ws) % 7;
    const photo = e && e.cover ? ` has-photo" data-bg="${esc(e.cover)}" data-thumb="1` : '';
    return `<button class="${classes}${wd === 0 || wd === 6 ? ' we' : ''}${photo}" data-date="${d}" aria-label="${d}${e ? ' 有日記' : ''}">
      <span class="num">${Number(d.slice(8))}</span>
      ${e ? `<span class="mood">${e.mood || '<i class="dot"></i>'}</span><span class="ttl">${esc(e.title || e.excerpt)}</span>` : ''}
      <span class="bars">${bars}</span>
    </button>`;
  }).join('');

  const banner = DB.mode === 'demo'
    ? `<div class="banner"><span>🧪 目前是<b>試用模式</b>，資料只存在這個瀏覽器。</span><button class="link" data-act="settings">連接 GitHub 開始同步 →</button></div>` : '';

  const cover = monthCover(prefix);
  const railTrips = [...DB.trips].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8);
  return `<section class="hero"${cover ? ` data-bg="${esc(cover)}"` : ''} style="${artBg('month' + prefix)}">
      <div class="hero-nav">
        <button class="icon-btn" data-nav="-1" aria-label="上個月">${icon('chevL')}</button>
        <button class="btn ghost sm" data-nav="today">本月</button>
        <button class="icon-btn" data-nav="1" aria-label="下個月">${icon('chevR')}</button>
      </div>
      <div class="hero-in">
        <div class="hero-kicker">${y} · ${m + 1} 月</div>
        <h1 class="hero-title script-it">${MONTH_EN[m + 1]}</h1>
        <div class="hero-sub">本月 <b>${monthCount}</b> 篇${streak > 1 ? ` · 連續 <b>${streak}</b> 天 🔥` : ''}${monthTrips.length ? ` · ✈️ ${monthTrips.map((t) => esc(t.name)).join('、')}` : ''}</div>
        <a class="hero-search" href="#/search">${icon('search', 16)} 搜尋你的回憶…</a>
      </div>
    </section>
    ${banner}
    <section class="cal">
      <div class="dow">${dow}</div>
      <div class="grid rows-${rows}" id="grid">${cells}</div>
    </section>
    ${railTrips.length ? `<div class="sec-row"><h2 class="sec">我的旅行</h2><a href="#/trips">查看全部 →</a></div><div class="rail">${railTrips.map((t) => tripCard(t)).join('')}</div>` : ''}`;
}

export function bindMonth() {
  const main = $('#main');
  main.onclick = (e) => {
    const day = e.target.closest('.day');
    if (day) { hooks.openDay(day.dataset.date); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const v = nav.dataset.nav;
      const d = v === 'today' ? new Date() : new Date(S.cursor.y, S.cursor.m + Number(v), 1);
      if (v === 'today') S.selected = todayStr();
      go(`#/month/${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
  };
  // 手機左右滑動換月
  let sx = 0, sy = 0;
  main.ontouchstart = (e) => { if (e.target.closest('#grid')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } else sx = 0; };
  main.ontouchend = (e) => {
    if (!sx) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) {
      const d = new Date(S.cursor.y, S.cursor.m + (dx < 0 ? 1 : -1), 1);
      go(`#/month/${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    sx = 0;
  };
}

/* ---------------- 年曆：一眼看出哪些天有寫 ---------------- */
export function renderYear() {
  const y = S.year;
  const today = todayStr();
  const ws = S.settings.weekStart;
  const total = Object.keys(DB.index.entries).filter((d) => d.startsWith(String(y))).length;
  const trips = DB.trips.filter((t) => t.start.slice(0, 4) <= String(y) && t.end.slice(0, 4) >= String(y));
  const months = [...Array(12)].map((_, m) => {
    const dim = new Date(y, m + 1, 0).getDate();
    const off = (new Date(y, m, 1).getDay() - ws + 7) % 7;
    let cells = '<i></i>'.repeat(off);
    for (let d = 1; d <= dim; d++) {
      const s = `${y}-${pad(m + 1)}-${pad(d)}`;
      const e = DB.index.entries[s];
      const lvl = !e ? '' : e.words > 400 ? 'l3' : e.words > 120 ? 'l2' : 'l1';
      const trip = DB.tripsOn(s)[0];
      cells += `<button class="yd ${lvl}${s === today ? ' today' : ''}" data-date="${s}" ${trip ? `style="--c:${esc(trip.color)}"` : ''} title="${s}${e ? ' ' + esc(e.title || '') : ''}">${d}${trip ? '<u></u>' : ''}</button>`;
    }
    const cnt = Object.keys(DB.index.entries).filter((x) => x.startsWith(`${y}-${pad(m + 1)}`)).length;
    return `<section class="ym"><button class="ym-title" data-month="${y}-${pad(m + 1)}">${m + 1} 月 <small>${cnt ? cnt + ' 篇' : ''}</small></button><div class="ym-grid">${cells}</div></section>`;
  }).join('');
  return `<div class="page-head">
      <div><h1 class="cal-title">${y} 年</h1><div class="cal-sub">共 <b>${total}</b> 篇日記 · <b>${trips.length}</b> 趟旅程</div></div>
      <div class="cal-nav"><button class="icon-btn" data-y="-1" aria-label="前一年">${icon('chevL')}</button><button class="btn ghost sm" data-y="0">今年</button><button class="icon-btn" data-y="1" aria-label="後一年">${icon('chevR')}</button></div>
    </div>
    <div class="year-grid">${months}</div>
    <div class="legend">少 <i class="yd l1"></i><i class="yd l2"></i><i class="yd l3"></i> 多 <span>　底線色 = 旅程期間</span></div>`;
}

export function bindYear() {
  $('#main').onclick = (e) => {
    const d = e.target.closest('.yd');
    if (d) { hooks.openDay(d.dataset.date); return; }
    const mo = e.target.closest('[data-month]');
    if (mo) { go(`#/month/${mo.dataset.month}`); return; }
    const yb = e.target.closest('[data-y]');
    if (yb) { const v = Number(yb.dataset.y); go(`#/year/${v === 0 ? new Date().getFullYear() : S.year + v}`); }
  };
}
