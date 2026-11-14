// 足跡地圖：把所有旅程的地點放在同一張地圖上
import { DB } from './db.js';
import { $, esc, fmtRange, fmtShort } from './util.js';
import { drawMap } from './map.js';
import { icon } from './icons.js';

let sel = ''; // 目前篩選的旅程 id（空字串 = 全部）

const tripsWithPlaces = () => [...DB.trips].filter((t) => (t.places || []).length).sort((a, b) => b.start.localeCompare(a.start));

export function renderPlaces() {
  const ts = tripsWithPlaces();
  const n = ts.reduce((a, t) => a + t.places.length, 0);
  const chips = [`<button class="chip${sel === '' ? ' on' : ''}" data-pt="">全部</button>`, ...ts.map((t) => `<button class="chip${sel === t.id ? ' on' : ''}" data-pt="${esc(t.id)}">${esc(t.emoji || '✈️')} ${esc(t.en || t.name)}</button>`)].join('');
  const rows = ts.filter((t) => !sel || t.id === sel).map((t) => `<div class="pl-trip"><a href="#/trip/${esc(t.id)}" class="pl-trip-h"><i style="background:${esc(t.color)}"></i><b>${esc(t.name)}</b><small>${fmtRange(t.start, t.end)}</small></a>
    <div class="pl-chips">${[...t.places].sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).map((p) => `<span>${icon('pin', 12)} ${esc(p.name)}${p.date ? `<small>${fmtShort(p.date)}</small>` : ''}</span>`).join('')}</div></div>`).join('');
  return `<div class="page-head"><div><div class="hero-kicker dim">FOOTPRINTS</div><h1 class="cal-title">足跡地圖</h1><div class="cal-sub">${ts.length} 趟旅程 · ${n} 個地點</div></div></div>
    ${ts.length ? `<div class="chips pt-chips">${chips}</div><div class="map-wrap"><div id="map" class="map tall"><div class="map-loading">地圖載入中…</div></div></div><div class="pl-list">${rows}</div>`
      : `<div class="empty big"><div class="empty-ic">🗺️</div><p>還沒有地點。<br>在旅程裡的「地點與地圖」加入地點，<br>這裡就會出現你的足跡。</p><a class="btn primary" href="#/trips">前往旅程</a></div>`}`;
}

export function bindPlaces() {
  const draw = () => {
    const el = $('#map'); if (!el) return;
    const ts = tripsWithPlaces().filter((t) => !sel || t.id === sel);
    const pts = ts.flatMap((t) => t.places.map((p) => ({ ...p, _c: t.color })));
    drawMap(el, pts, ts.length === 1 ? ts[0].color : '#2f6b62').catch((e) => { el.innerHTML = `<div class="map-loading">${esc(e.message)}</div>`; });
  };
  draw();
  $('#main').onclick = (e) => {
    const c = e.target.closest('[data-pt]');
    if (!c) return;
    sel = c.dataset.pt;
    $('#main').innerHTML = renderPlaces(); bindPlaces();
  };
}
