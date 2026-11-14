// 統計：總覽、每月篇數、心情分布、常用標籤，再接年度熱度圖
import { DB } from './db.js';
import { S } from './state.js';
import { esc, pad, parseYmd, addDays, ymd } from './util.js';
import { totals } from './home.js';
import { renderYear, bindYear } from './calendar.js';
import { MOODS } from './state.js';

function longestStreak() {
  const ds = DB.entryDates(); let best = 0, cur = 0, prev = '';
  for (const d of ds) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}

export function renderStats() {
  const t = totals();
  const y = S.year;
  const months = [...Array(12)].map((_, i) => Object.keys(DB.index.entries).filter((d) => d.startsWith(`${y}-${pad(i + 1)}`)).length);
  const max = Math.max(1, ...months);
  const moods = MOODS.map((m) => ({ ...m, n: Object.values(DB.index.entries).filter((e) => e.mood === m.e).length }));
  const mmax = Math.max(1, ...moods.map((m) => m.n));
  const tags = DB.allTags().slice(0, 10);
  return `<div class="page-head"><div><div class="hero-kicker dim">INSIGHTS</div><h1 class="cal-title">統計</h1><div class="cal-sub">回顧你記錄下的生活</div></div></div>
  <div class="stat-cards">
    <div><b>${t.n}</b><span>篇日記</span></div><div><b>${(t.chars / 1000).toFixed(1)}k</b><span>累計字數</span></div>
    <div><b>${t.photos}</b><span>張照片</span></div><div><b>${t.trips}</b><span>趟旅程</span></div>
    <div><b>${t.streak}</b><span>目前連續天</span></div><div><b>${longestStreak()}</b><span>最長連續天</span></div>
  </div>
  <section class="card-sec"><h2 class="sec">${y} 年每月篇數</h2>
    <div class="bars-chart">${months.map((n, i) => `<div class="bc"><i style="height:${(n / max) * 100}%"></i><b>${n || ''}</b><span>${i + 1}</span></div>`).join('')}</div></section>
  <section class="card-sec"><h2 class="sec">心情分布</h2>
    <div class="mood-dist">${moods.map((m) => `<div><span class="me">${m.e}</span><div class="mbar"><i style="width:${(m.n / mmax) * 100}%"></i></div><b>${m.n}</b></div>`).join('')}</div></section>
  ${tags.length ? `<section class="card-sec"><h2 class="sec">常用標籤</h2><div class="tag-row">${tags.map(([tg, n]) => `<span class="tag">#${esc(tg)} <small>${n}</small></span>`).join('')}</div></section>` : ''}
  <h2 class="sec" style="margin-top:28px">年度熱度圖</h2>
  ${renderYear()}`;
}
export const bindStats = bindYear;
