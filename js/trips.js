// 旅程：清單、詳情（日記時間軸 + 地點地圖）、新增 / 編輯
import { S, go, hooks, TRIP_COLORS, TRIP_EMOJIS } from './state.js';
import { DB } from './db.js';
import { $, $$, esc, todayStr, addDays, diffDays, fmtRange, fmtShort, parseYmd, WEEK, openModal, toast, uid } from './util.js';
import { icon } from './icons.js';
import { drawMap, geocode } from './map.js';
import { art, artBg, palFromString } from './art.js';
import { hydrate } from './media.js';
import { resizeImage } from './util.js';

const daysOf = (t) => diffDays(t.start, t.end) + 1;
const status = (t, today) => (t.end < today ? 'past' : t.start > today ? 'soon' : 'now');
const writtenIn = (t) => { let n = 0; for (let d = t.start; d <= t.end; d = addDays(d, 1)) if (DB.index.entries[d]) n++; return n; };

/* ---------------- 清單 ---------------- */
export function tripCard(t, full = false) {
  const today = todayStr(), st = status(t, today), total = daysOf(t), w = writtenIn(t);
  const tag = st === 'now' ? '進行中' : st === 'soon' ? `${diffDays(today, t.start)} 天後出發` : '';
  const pal = TRIP_COLORS.indexOf(t.color) >= 0 ? TRIP_COLORS.indexOf(t.color) : palFromString(t.id);
  return `<a class="trip-photo${full ? ' full' : ''}" href="#/trip/${esc(t.id)}" ${t.cover ? `data-bg="${esc(t.cover)}"` : ''} style="${artBg(t.id, pal)};--c:${esc(t.color)}">
    <div class="tp-shade"></div>${tag ? `<span class="pill">${tag}</span>` : ''}
    <div class="tp-in"><div class="tp-emoji">${esc(t.emoji || '✈️')}</div>${t.en ? `<div class="tp-en script">${esc(t.en)}</div>` : ''}<h3>${esc(t.name)}</h3>
      <small>${t.destination ? esc(t.destination) + ' · ' : ''}${fmtRange(t.start, t.end)} · ${total} 天</small>
      ${full ? `<div class="progress"><i style="width:${Math.min(100, (w / total) * 100)}%"></i></div><div class="tc-foot"><span>📝 ${w}/${total} 天有日記</span><span>📍 ${(t.places || []).length} 個地點</span></div>` : ''}
    </div></a>`;
}

export function renderTrips() {
  const today = todayStr();
  const sorted = [...DB.trips].sort((a, b) => b.start.localeCompare(a.start));
  const groups = [
    ['now', '進行中', sorted.filter((t) => status(t, today) === 'now')],
    ['soon', '即將出發', sorted.filter((t) => status(t, today) === 'soon').reverse()],
    ['past', '過往旅程', sorted.filter((t) => status(t, today) === 'past')],
  ];
  const body = groups.filter(([, , l]) => l.length).map(([k, label, l]) => `<h2 class="sec">${label}</h2><div class="trip-grid">${l.map((t) => tripCard(t, true)).join('')}</div>`).join('');
  return `<div class="page-head"><div><div class="hero-kicker dim">MY TRAVELS</div><h1 class="cal-title">我的旅行</h1><div class="cal-sub">${DB.trips.length ? `共 ${DB.trips.length} 趟旅程` : '把旅行跟日記串在一起'}</div></div>
    <button class="btn primary" data-act="new-trip">${icon('plus', 16)} 新增旅程</button></div>
    ${body || `<div class="empty big"><div class="empty-ic">🧳</div><p>還沒有旅程。<br>新增一趟旅程後，月曆上會出現彩色橫條，<br>旅程期間的日記也會自動整理成遊記時間軸。</p><button class="btn primary" data-act="new-trip">新增第一趟旅程</button></div>`}`;
}

export function bindTrips() {
  $('#main').onclick = (e) => { if (e.target.closest('[data-act="new-trip"]')) editTrip(null); };
}

/* ---------------- 詳情 ---------------- */
export function renderTrip() {
  const t = DB.tripById(S.tripId);
  if (!t) return `<div class="empty big"><p>找不到這趟旅程</p><a class="btn" href="#/trips">回旅程清單</a></div>`;
  const total = daysOf(t), w = writtenIn(t);
  const photos = (() => { let n = 0; for (let d = t.start; d <= t.end; d = addDays(d, 1)) n += DB.index.entries[d]?.photos || 0; return n; })();
  const pal = TRIP_COLORS.indexOf(t.color) >= 0 ? TRIP_COLORS.indexOf(t.color) : palFromString(t.id);
  return `<div class="trip-hero" ${t.cover ? `data-bg="${esc(t.cover)}"` : ''} style="--c:${esc(t.color)};${artBg(t.id, pal)}">
      <a class="back" href="#/trips">${icon('back', 18)} 旅程</a>
      <div class="th-mast"><span>TRAVEL JOURNAL</span><i></i><span>${t.start.slice(0, 4)}</span></div>
      ${t.en ? `<div class="th-script script">${esc(t.en)}</div>` : ''}
      <h1>${esc(t.name)}</h1>
      <div class="th-meta">${t.destination ? `${icon('pin', 14)} ${esc(t.destination)} · ` : ''}${fmtRange(t.start, t.end)} · ${total} 天</div>
      ${t.notes ? `<p class="th-notes">${esc(t.notes)}</p>` : ''}
      <div class="th-stats"><span><b>${total}</b>Days</span><span><b>${w}</b>Stories</span><span><b>${photos}</b>Photos</span><span><b>${(t.places || []).length}</b>Places</span></div>
      <button class="btn sm light" data-act="edit-trip">${icon('edit', 15)} 編輯旅程</button>
    </div>
    <div class="seg3">${[['timeline', '每日故事'], ['photos', '精選照片'], ['map', '地點地圖']].map(([k, l]) => `<button class="${S.tripTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="trip-body">${S.tripTab === 'timeline' ? timeline(t) : S.tripTab === 'photos' ? tripPhotos(t) : mapTab(t)}</div>`;
}

function timeline(t) {
  const today = todayStr();
  let out = '';
  for (let d = t.start, i = 1; d <= t.end && i <= 120; d = addDays(d, 1), i++) {
    const e = DB.index.entries[d];
    const dt = parseYmd(d), wd = WEEK[dt.getDay()];
    const places = (t.places || []).filter((p) => p.date === d);
    const img = e && e.cover ? `<div class="sd-img" data-bg="${esc(e.cover)}" data-thumb="1" style="${artBg(d, dt.getMonth())}">${e.photos > 1 ? `<em>+${e.photos - 1}</em>` : ''}</div>` : '';
    out += `<button class="tl-item sd${e ? ' has' : ''}${i % 2 ? '' : ' flip'}${img ? ' with-img' : ''}" data-date="${d}">
      ${img}
      <div class="sd-body">
        <div class="sd-day"><span class="script">Day</span><b>${pad2(i)}</b></div>
        <div class="sd-date">${d.replace(/-/g, '.')} · 週${wd}${e && e.weather ? ' · ' + e.weather : ''}${e && e.mood ? ' ' + e.mood : ''}</div>
        ${e ? `<h3>${esc(e.title || e.excerpt.slice(0, 24) || '（無標題）')}</h3><p>${esc(e.excerpt)}</p>`
          : `<p class="sd-empty">${d > today ? '尚未到這天' : '還沒寫 · 點此補寫'}</p>`}
        ${places.length ? `<div class="places">${places.map((p) => `<span>${icon('pin', 13)} ${esc(p.name)}</span>`).join('')}</div>` : ''}
      </div></button>`;
  }
  return `<div class="spreads">${out}</div>`;
}

const pad2 = (n) => String(n).padStart(2, '0');

// 精選照片：旅程期間所有日記照片的拼貼牆
function tripPhotos(t) {
  const list = [];
  for (let d = t.start; d <= t.end; d = addDays(d, 1)) {
    const e = DB.index.entries[d];
    for (const p of (e && (e.pics && e.pics.length ? e.pics : e.cover ? [e.cover] : [])) || []) list.push({ d, p });
  }
  if (!list.length) return `<div class="empty big"><div class="empty-ic">🖼️</div><p>這趟旅程還沒有照片。<br>在旅程期間的日記加入照片，就會排在這裡。</p></div>`;
  return `<div class="mosaic big">${list.slice(0, 60).map((x, i) => `<button class="mz mz${i % 7}" data-date="${x.d}" data-bg="${esc(x.p)}" data-thumb="1"><span>${x.d.slice(5).replace('-', '/')}</span></button>`).join('')}</div>`;
}

let pending = null; // 搜尋後選中的地點

function mapTab(t) {
  const places = sortedPlaces(t);
  const opts = (() => { let o = '<option value="">不指定日期</option>'; for (let d = t.start, i = 1; d <= t.end && i <= 120; d = addDays(d, 1), i++) o += `<option value="${d}">Day ${i} · ${fmtShort(d)}</option>`; return o; })();
  return `<div class="map-wrap"><div id="map" class="map"><div class="map-loading">地圖載入中…</div></div></div>
  <div class="place-form">
    <div class="row-search"><input id="p-name" class="inp" placeholder="搜尋地點，例如：清水寺"><button class="btn" data-act="p-search">搜尋</button></div>
    <div id="p-results" class="results"></div>
    <div class="row2"><select id="p-date" class="inp">${opts}</select><input id="p-note" class="inp" placeholder="備註（選填）"></div>
    <button class="btn primary" data-act="p-add">${icon('plus', 16)} 加入地點</button>
  </div>
  <div class="place-list">${places.length ? places.map((p, i) => `<div class="place" data-id="${esc(p.id)}">
      <span class="pn" style="background:${esc(t.color)}">${i + 1}</span>
      <div class="pi"><b>${esc(p.name)}</b><small>${p.date ? fmtShort(p.date) : '未指定日期'}${p.note ? ' · ' + esc(p.note) : ''}${typeof p.lat !== 'number' ? ' · 無座標' : ''}</small></div>
      <button class="icon-btn" data-act="p-del" aria-label="刪除">${icon('trash', 16)}</button></div>`).join('') : '<p class="muted center">還沒有地點。搜尋後加入，就會標在地圖上。</p>'}</div>`;
}

const sortedPlaces = (t) => [...(t.places || [])].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

export function bindTrip() {
  const main = $('#main');
  const t = () => DB.tripById(S.tripId);
  if (S.tripTab === 'map' && t()) {
    const el = $('#map');
    drawMap(el, sortedPlaces(t()), t().color).catch((e) => { el.innerHTML = `<div class="map-loading">${esc(e.message)}</div>`; });
  }
  main.onclick = async (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { S.tripTab = tab.dataset.tab; hooks.renderMain(); return; }
    const item = e.target.closest('.tl-item, .mz');
    if (item) { hooks.openDay(item.dataset.date); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'edit-trip') editTrip(t());
    else if (act === 'p-search') {
      const q = $('#p-name').value.trim(); if (!q) return;
      const box = $('#p-results'); box.innerHTML = '<div class="muted">搜尋中…</div>';
      try {
        const r = await geocode(q);
        box.innerHTML = r.length ? r.map((x, i) => `<button class="res" data-i="${i}"><b>${esc(x.name)}</b><small>${esc(x.full)}</small></button>`).join('') : '<div class="muted">找不到，試試更精確的名稱；也可以直接按「加入地點」只記錄名稱。</div>';
        box._r = r;
      } catch (err) { box.innerHTML = `<div class="muted">${esc(err.message)}（離線時仍可只記錄名稱）</div>`; }
    } else if (e.target.closest('.res')) {
      const r = $('#p-results')._r[Number(e.target.closest('.res').dataset.i)];
      pending = r; $('#p-name').value = r.name;
      $('#p-results').innerHTML = `<div class="picked">${icon('check', 15)} 已選：${esc(r.full)}</div>`;
    } else if (act === 'p-add') {
      const name = $('#p-name').value.trim(); if (!name) { toast('請輸入地點名稱'); return; }
      const tr = t();
      const p = { id: uid(), name, date: $('#p-date').value, note: $('#p-note').value.trim() };
      if (pending && pending.name === name) { p.lat = pending.lat; p.lng = pending.lng; }
      pending = null;
      try { await DB.saveTrips(DB.trips.map((x) => (x.id === tr.id ? { ...tr, places: [...(tr.places || []), p] } : x))); toast('已加入地點'); hooks.renderMain(); } catch (err) { toast(err.message, 'error'); }
    } else if (act === 'p-del') {
      const id = e.target.closest('.place').dataset.id; const tr = t();
      try { await DB.saveTrips(DB.trips.map((x) => (x.id === tr.id ? { ...tr, places: tr.places.filter((p) => p.id !== id) } : x))); hooks.renderMain(); } catch (err) { toast(err.message, 'error'); }
    }
  };
}

/* ---------------- 新增 / 編輯旅程 ---------------- */
export function editTrip(trip) {
  const isNew = !trip;
  const today = todayStr();
  const t = trip ? { ...trip } : { id: '', name: '', emoji: '✈️', destination: '', start: today, end: addDays(today, 2), color: TRIP_COLORS[DB.trips.length % TRIP_COLORS.length], notes: '', places: [] };
  const m = openModal(`<div class="modal-head"><h3>${isNew ? '新增旅程' : '編輯旅程'}</h3><button class="icon-btn" data-close aria-label="關閉">${icon('x')}</button></div>
    <div class="form">
      <label>旅程名稱<input id="t-name" class="inp" value="${esc(t.name)}" placeholder="例如：京都賞楓小旅行" maxlength="40"></label>
      <label>英文標題（選填，用在封面的手寫字）<input id="t-en" class="inp" value="${esc(t.en || '')}" placeholder="例如：Kyoto in Autumn" maxlength="40"></label>
      <label>目的地<input id="t-dest" class="inp" value="${esc(t.destination)}" placeholder="例如：日本・京都"></label>
      <div class="row2"><label>出發日<input id="t-start" type="date" class="inp" value="${t.start}"></label><label>回程日<input id="t-end" type="date" class="inp" value="${t.end}"></label></div>
      <div class="field"><span class="lbl">圖示</span><div class="chips" id="t-emojis">${TRIP_EMOJIS.map((e) => `<button type="button" class="chip${e === t.emoji ? ' on' : ''}" data-v="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">顏色（月曆橫條）</span><div class="swatches" id="t-colors">${TRIP_COLORS.map((c) => `<button type="button" class="sw${c === t.color ? ' on' : ''}" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">封面照片</span><div class="cover-pick"><div id="t-cover" class="cover-prev" ${t.cover ? `data-bg="${esc(t.cover)}"` : ''} style="${artBg(t.id || 'new', 0)}"></div><div class="cover-btns"><button type="button" class="btn sm" id="t-cover-btn">${icon('image', 15)} 選擇照片</button><button type="button" class="btn ghost sm" id="t-cover-rm">移除</button></div><input type="file" id="t-cover-file" accept="image/*" hidden></div></div>
      <label>備註<textarea id="t-notes" class="inp" rows="3" placeholder="旅行目標、行程提醒…">${esc(t.notes)}</textarea></label>
      <div class="actions"><button class="btn primary grow" id="t-save">儲存</button>${isNew ? '' : `<button class="btn danger" id="t-del">${icon('trash', 16)}</button>`}</div>
    </div>`);
  const el = m.el;
  hydrate(el);
  let newCover = null, removeCover = false;
  $('#t-cover-btn', el).onclick = () => $('#t-cover-file', el).click();
  $('#t-cover-rm', el).onclick = () => { removeCover = true; newCover = null; const c = $('#t-cover', el); c.style.backgroundImage = `url('${art(t.id || 'new', 0)}')`; };
  $('#t-cover-file', el).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { newCover = await resizeImage(f, 1600, 0.82); removeCover = false; $('#t-cover', el).style.backgroundImage = `url('${URL.createObjectURL(newCover)}')`; } catch (err) { toast(err.message, 'error'); }
  };
  const single = (box) => (e) => { const b = e.target.closest('[data-v]'); if (!b) return; $$('[data-v]', box).forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
  $('#t-emojis', el).onclick = single($('#t-emojis', el));
  $('#t-colors', el).onclick = single($('#t-colors', el));
  $('#t-save', el).onclick = async () => {
    const name = $('#t-name', el).value.trim();
    const start = $('#t-start', el).value, end = $('#t-end', el).value;
    if (!name) return toast('請輸入旅程名稱');
    if (!start || !end || end < start) return toast('日期不正確：回程日不能早於出發日');
    const next = { ...t, id: t.id || `${name.replace(/[^\w一-龥]+/g, '-').slice(0, 20)}-${uid()}`, name, en: $('#t-en', el).value.trim(), destination: $('#t-dest', el).value.trim(), start, end, notes: $('#t-notes', el).value.trim(), emoji: $('#t-emojis .on', el)?.dataset.v || '✈️', color: $('#t-colors .on', el)?.dataset.v || t.color };
    try {
      if (newCover) next.cover = await DB.uploadCover(next.id.replace(/[^\w-]/g, '').slice(0, 24) || 'trip', newCover);
      else if (removeCover) next.cover = '';
      await DB.saveTrips(isNew ? [...DB.trips, next] : DB.trips.map((x) => (x.id === next.id ? next : x)));
      m.close(); toast('旅程已儲存 ✓');
      if (isNew) go(`#/trip/${next.id}`); else hooks.renderAll();
    } catch (err) { toast(err.message, 'error'); }
  };
  const del = $('#t-del', el);
  if (del) del.onclick = async () => {
    if (!confirm('刪除這趟旅程？（日記不會被刪除，只會移除旅程與地點）')) return;
    try { await DB.saveTrips(DB.trips.filter((x) => x.id !== t.id)); m.close(); toast('已刪除旅程'); go('#/trips'); } catch (err) { toast(err.message, 'error'); }
  };
}
