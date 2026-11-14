// 主程式：路由、外殼、啟動
import { S, hooks, go, saveSettings, getHash } from './state.js';
import { DB } from './db.js';
import { $, $$, todayStr, isDate, pad, toast, openModal } from './util.js';
import { icon } from './icons.js';
import { renderMonth, bindMonth } from './calendar.js';
import { renderHome, bindHome } from './home.js';
import { renderAlbum, bindAlbum } from './album.js';
import { renderStats, bindStats } from './stats.js';
import { renderPanel } from './panel.js';
import { renderTrips, bindTrips, renderTrip, bindTrip } from './trips.js';
import { renderSearch, bindSearch } from './search.js';
import { renderTimeline, bindTimeline } from './timeline.js';
import { renderPlaces, bindPlaces } from './places.js';
import { openSettings } from './settings.js';
import { hydrate } from './media.js';

const TABS = [
  { id: 'home', label: '首頁', ic: 'home', href: () => '#/home' },
  { id: 'month', label: '月曆', ic: 'calendar', href: () => `#/month/${S.cursor.y}-${pad(S.cursor.m + 1)}` },
  { id: 'timeline', label: '時光軸', ic: 'book', href: () => '#/timeline' },
  { id: 'trips', label: '旅程', ic: 'plane', href: () => '#/trips' },
  { id: 'places', label: '足跡', ic: 'map', href: () => '#/places', desktopOnly: true },
  { id: 'album', label: '相簿', ic: 'image', href: () => '#/album' },
  { id: 'stats', label: '統計', ic: 'chart', href: () => `#/stats/${S.year}`, desktopOnly: true },
  { id: 'search', label: '搜尋', ic: 'search', href: () => '#/search', desktopOnly: true },
];
const activeTab = () => (S.view === 'trip' ? 'trips' : S.view);

/* ---------- 路由 ---------- */
function route() {
  const [name, arg] = getHash().replace(/^#\/?/, '').split('/');
  const now = new Date();
  const setCursor = (s) => { const [y, m] = s.split('-').map(Number); S.cursor = { y, m: m - 1 }; };
  switch (name) {
    case 'day':
      if (!isDate(arg)) return go('#/');
      S.view = 'month'; S.selected = arg; setCursor(arg); S.panelOpen = true;
      break;
    case 'month': {
      S.view = 'month'; S.panelOpen = false;
      if (/^\d{4}-\d{2}$/.test(arg || '')) setCursor(arg); else S.cursor = { y: now.getFullYear(), m: now.getMonth() };
      const key = `${S.cursor.y}-${pad(S.cursor.m + 1)}`;
      if (!S.selected.startsWith(key)) S.selected = todayStr().startsWith(key) ? todayStr() : `${key}-01`;
      break;
    }
    case 'home': S.view = 'home'; S.panelOpen = false; break;
    case 'album': S.view = 'album'; S.panelOpen = false; break;
    case 'year': case 'stats': S.view = 'stats'; S.year = Number(arg) || now.getFullYear(); S.panelOpen = false; break;
    case 'timeline': S.view = 'timeline'; S.panelOpen = false; break;
    case 'places': S.view = 'places'; S.panelOpen = false; break;
    case 'trips': S.view = 'trips'; S.panelOpen = false; break;
    case 'trip': S.view = 'trip'; S.tripId = arg; S.panelOpen = false; if (S._tripSeen !== arg) { S.tripTab = 'timeline'; S._tripSeen = arg; } break;
    case 'search': S.view = 'search'; S.panelOpen = false; break;
    default: return go('#/home');
  }
  if (S.editing && S.editing !== S.selected) S.editing = null;
  renderAll();
}

function openDay(date, { edit = false } = {}) {
  S.editing = edit ? date : null;
  go(`#/day/${date}`);
}

/* ---------- 繪製 ---------- */
function renderNav() {
  const cur = activeTab();
  $('#tabs').innerHTML = TABS.map((t) => `<a class="tab${cur === t.id ? ' on' : ''}" href="${t.href()}">${icon(t.ic, 18)}<span>${t.label}</span></a>`).join('');
  $('#tabbar').innerHTML = TABS.filter((t) => !t.desktopOnly).map((t) => `<a class="tb${cur === t.id ? ' on' : ''}" href="${t.href()}">${icon(t.ic, 22)}<span>${t.label}</span></a>`).join('');
}

function renderMain() {
  const main = $('#main');
  $('#layout').classList.toggle('has-panel', S.view === 'month');
  const scroll = window.scrollY;
  switch (S.view) {
    case 'month': main.innerHTML = renderMonth(); bindMonth(); break;
    case 'home': main.innerHTML = renderHome(); bindHome(); break;
    case 'album': main.innerHTML = renderAlbum(); bindAlbum(); break;
    case 'stats': main.innerHTML = renderStats(); bindStats(); break;
    case 'timeline': main.innerHTML = renderTimeline(); bindTimeline(); break;
    case 'places': main.innerHTML = renderPlaces(); bindPlaces(); break;
    case 'trips': main.innerHTML = renderTrips(); bindTrips(); break;
    case 'trip': main.innerHTML = renderTrip(); bindTrip(); break;
    case 'search': main.innerHTML = renderSearch(); bindSearch(); break;
  }
  main.className = `view-${S.view}`;
  document.body.classList.toggle('panel-open', S.view === 'month' && S.panelOpen);
  renderNav();
  hydrate(main);
  const changed = S._lv !== S.view; S._lv = S.view;
  window.scrollTo(0, changed ? 0 : scroll);
}

function renderAll() {
  renderMain();
  if (S.view === 'month') renderPanel();
  else $('#panel').classList.remove('open');
}

function syncState(state) {
  const el = $('#sync');
  const map = {
    demo: ['demo', '試用模式', '資料只存在這個瀏覽器'],
    ok: ['ok', 'GitHub', `已同步 ${S.settings.owner}/${S.settings.repo}`],
    syncing: ['syncing', '同步中', ''],
    error: ['error', '離線', '無法連線，顯示的是上次的快取'],
  };
  const [cls, label, title] = map[state] || map.demo;
  el.className = `sync ${cls}`;
  el.title = title;
  el.innerHTML = `<i></i><span>${label}</span>`;
}

Object.assign(hooks, { route, renderMain, renderPanel, renderAll, openDay, syncState });

/* ---------- 啟動 ---------- */
document.addEventListener('vault-locked', () => { try { hooks.renderAll(); } catch {} });

async function boot() {
  $('#btn-settings').innerHTML = icon('sliders');
  $('#btn-search').innerHTML = icon('search');
  $('#fab').innerHTML = icon('edit', 24);
  $('#btn-settings').onclick = openSettings;
  $('#btn-today').onclick = () => openDay(todayStr());
  $('#btn-write').onclick = () => openDay(todayStr(), { edit: true });
  $('#fab').onclick = () => openDay(todayStr(), { edit: true });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-act="settings"]')) openSettings(); });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || $('.modal-back')) return;
    if (e.key === 'n') { e.preventDefault(); openDay(todayStr(), { edit: true }); }
  });
  window.addEventListener('hashchange', route);
  if (window.__MEM_NAV__) document.addEventListener('click', (e) => { const l = e.target.closest('a[href^="#/"]'); if (l) { e.preventDefault(); go(l.getAttribute('href')); } });
  saveSettings({}); // 套用主題

  try { await DB.init(); } catch (e) { toast(e.message, 'error'); }
  syncState(DB.mode === 'github' ? 'syncing' : 'demo');
  route(); // 先用快取畫面立即顯示

  if (DB.mode === 'github') {
    try {
      await DB.load();
      syncState('ok');
      if (!(S.editing)) renderAll(); else renderMain();
    } catch (e) {
      syncState('error');
      toast(e.status === 401 ? 'GitHub Token 失效，請到設定重新連線' : '無法同步：' + e.message, 'error');
    }
  }
  try {
    if ('serviceWorker' in navigator && !window.__MEM_NAV__ && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch { /* ignore */ }
}

boot();
