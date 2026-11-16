// 右側（手機為全螢幕）的「當日日記」面板：閱讀與編輯
import { S, go, hooks, MOODS, WEATHERS } from './state.js';
import { DB } from './db.js';
import { openModal, $, $$, esc, fmtLong, parseYmd, WEEK, addDays, diffDays, store, toast, debounce, resizeImage, lightbox, todayStr } from './util.js';
import { icon } from './icons.js';
import { renderMd } from './md.js';
import { hydrate } from './media.js';
import { artBg } from './art.js';
import { vault, askPass } from './vault.js';

const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let token = 0;

export const hydratePhotos = hydrate;

const headBar = (date, right) => {
  const d = parseYmd(date);
  return `<div class="panel-head">
    <button class="icon-btn only-mobile" data-act="close" aria-label="返回">${icon('back')}</button>
    <div class="ph-title"><b>${d.getMonth() + 1} 月 ${d.getDate()} 日</b><span>${d.getFullYear()} · 週${WEEK[d.getDay()]}</span></div>
    <div class="ph-actions">${right}</div>
  </div>`;
};

function hero(date, info, entry, trips) {
  const d = parseYmd(date);
  const cover = info?.cover || trips.find((t) => t.cover)?.cover || '';
  const place = entry?.meta.location || trips[0]?.destination || '';
  return `<div class="p-hero" ${cover ? `data-bg="${esc(cover)}"` : ''} style="${artBg(date, d.getMonth())}"><div class="tp-shade"></div>
    <div class="p-hero-in"><div class="p-date"><b>${d.getMonth() + 1}/${d.getDate()}</b><span>${WEEK_EN[d.getDay()]}.</span></div>${place ? `<div class="p-loc">${icon('pin', 14)} ${esc(place)}</div>` : ''}</div></div>`;
}

export async function renderPanel() {
  const el = $('#panel');
  const my = ++token;
  const date = S.selected;
  el.classList.toggle('open', S.panelOpen);
  if (S.editing === date) return renderEditor(el, date, my);
  bindPanelView();

  const info = DB.index.entries[date];
  const nav = `<button class="icon-btn" data-act="prev" aria-label="前一天">${icon('chevL')}</button><button class="icon-btn" data-act="next" aria-label="後一天">${icon('chevR')}</button>`;
  let entry = null;
  if (info) {
    el.innerHTML = headBar(date, nav) + '<div class="panel-body"><div class="skeleton"></div><div class="skeleton short"></div></div>';
    try { entry = await DB.getEntry(date); } catch (e) {
      if (my !== token) return;
      el.innerHTML = headBar(date, nav) + `<div class="panel-body"><div class="empty"><p>讀取失敗：${esc(e.message)}</p><button class="btn" data-act="reload">重試</button></div></div>`;
      return;
    }
    if (my !== token) return;
  }

  const trips = DB.tripsOn(date);
  if (entry?.meta.trip && !trips.find((t) => t.id === entry.meta.trip)) { const t = DB.tripById(entry.meta.trip); if (t) trips.push(t); }
  const tripHtml = trips.map((t) => {
    const n = diffDays(t.start, date) + 1, total = diffDays(t.start, t.end) + 1;
    const places = (t.places || []).filter((p) => p.date === date);
    return `<div class="trip-chip" style="--c:${esc(t.color)}">
      <a href="#/trip/${esc(t.id)}"><span>${esc(t.emoji || '✈️')} ${esc(t.name)}</span><small>${n >= 1 && n <= total ? `第 ${n} 天 / 共 ${total} 天` : '旅程'}</small></a>
      ${places.length ? `<div class="places">${places.map((p) => `<span>${icon('pin', 13)} ${esc(p.name)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');

  const mmdd = date.slice(5);
  const past = Object.keys(DB.index.entries).filter((d) => d.slice(5) === mmdd && d !== date).sort().reverse();
  const onThisDay = past.length ? `<div class="otd"><h4>🕰️ 那年今天</h4>${past.map((d) => `<button class="otd-item" data-date="${d}"><b>${d.slice(0, 4)}</b> ${esc(DB.index.entries[d].title || DB.index.entries[d].excerpt.slice(0, 30))}</button>`).join('')}</div>` : '';

  if (!entry) {
    el.innerHTML = headBar(date, nav) + hero(date, info, null, trips) + `<div class="panel-body">${tripHtml}
      <div class="empty"><div class="empty-ic">${date === todayStr() ? '✍️' : '📖'}</div>
      <p>${date === todayStr() ? '今天還沒有日記' : date > todayStr() ? '這天還沒到，可以先寫下計畫或期待' : '這天沒有留下紀錄'}</p>
      <button class="btn primary" data-act="edit">${icon('edit', 16)} ${date > todayStr() ? '寫點什麼' : '開始寫'}</button></div>${onThisDay}</div>`;
    hydrate(el);
    return;
  }
  if (entry.locked) {
    el.innerHTML = headBar(date, nav) + hero(date, null, null, trips) + `<div class="panel-body">${tripHtml}
      <div class="lock-screen"><div class="lock-ic">${icon('lock', 30)}</div><h3>這篇日記已上鎖</h3>
      <p class="muted sm">${entry.bad ? '密碼與這篇不符，請重新輸入' : '輸入日記密碼才能閱讀'}</p>
      <button class="btn primary" data-act="unlock">${icon('unlock', 16)} 解鎖</button></div>${onThisDay}</div>`;
    hydrate(el);
    return;
  }
  const m = entry.meta;
  const lockBtn = vault.unlocked ? `<button class="icon-btn" data-act="relock" aria-label="立即上鎖" title="立即上鎖">${icon('lock', 18)}</button>` : '';
  el.innerHTML = headBar(date, lockBtn + nav + `<button class="btn sm" data-act="edit">${icon('edit', 15)} 編輯</button>`) + hero(date, info, entry, trips) + `<div class="panel-body">
    ${tripHtml}
    <div class="meta-row">${m.locked ? `<span class="m-loc">${icon('lock', 13)} 已上鎖</span>` : ''}${m.mood ? `<span class="m-emoji" title="心情">${m.mood}</span>` : ''}${m.weather ? `<span class="m-emoji" title="天氣">${m.weather}</span>` : ''}${m.location ? `<span class="m-loc">${icon('pin', 14)} ${esc(m.location)}</span>` : ''}</div>
    ${m.title ? `<h2 class="entry-title">${esc(m.title)}</h2>` : ''}
    ${m.tags.length ? `<div class="tag-row">${m.tags.map((t) => `<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="prose">${renderMd(entry.body) || '<p class="muted">（只有標記，沒有內文）</p>'}</div>
    ${onThisDay}
  </div>`;
  hydrate(el);
}

/* ---------------- 編輯器 ---------------- */
function draftKey(date) { return `draft:${DB.key}:${date}`; }

async function renderEditor(el, date, my) {
  let entry = null;
  if (DB.index.entries[date]) {
    try { entry = await DB.getEntry(date); } catch (e) { toast('讀取失敗：' + e.message, 'error'); S.editing = null; return renderPanel(); }
    if (my !== token) return;
    if (entry.locked) { toast('請先解鎖這篇日記', 'error'); S.editing = null; return renderPanel(); }
  }
  const base = entry || { meta: { title: '', mood: '', weather: '', location: '', trip: '', tags: [], locked: false }, body: '' };
  const draft = store.get(draftKey(date));
  const cur = draft ? { meta: { ...base.meta, ...draft.meta }, body: draft.body } : { meta: { ...base.meta }, body: base.body };
  const cover = DB.tripsOn(date)[0];
  if (!cur.meta.trip && cover) cur.meta.trip = cover.id;

  const pick = (list, val, name) => list.map((x) => `<button type="button" class="chip${x.e === val ? ' on' : ''}" data-${name}="${x.e}" title="${x.t}">${x.e}</button>`).join('');
  const hints = ['今天發生了什麼事？', '今天最想記住的一件事…', '現在的心情是…', '今天遇到了誰、吃了什麼？'];

  el.innerHTML = headBar(date, `<button class="btn ghost sm" data-act="cancel">取消</button><button class="btn primary sm" data-act="save">儲存</button>`) + `
  <div class="panel-body editor">
    ${draft ? '<div class="note">已還原上次未儲存的草稿</div>' : ''}
    <div class="field"><label>心情</label><div class="chips" id="moods">${pick(MOODS, cur.meta.mood, 'mood')}</div></div>
    <div class="field"><label>天氣</label><div class="chips" id="weathers">${pick(WEATHERS, cur.meta.weather, 'weather')}</div></div>
    <input id="f-title" class="inp title-inp" placeholder="標題（可留空）" value="${esc(cur.meta.title)}" maxlength="80">
    <div class="row2">
      <input id="f-loc" class="inp" placeholder="📍 地點" value="${esc(cur.meta.location)}">
      <select id="f-trip" class="inp"><option value="">不屬於旅程</option>${DB.trips.map((t) => `<option value="${esc(t.id)}" ${t.id === cur.meta.trip ? 'selected' : ''}>${esc(t.emoji || '✈️')} ${esc(t.name)}</option>`).join('')}</select>
    </div>
    <input id="f-tags" class="inp" list="tag-list" placeholder="標籤（用逗號分隔，例如：旅行, 美食）" value="${esc(cur.meta.tags.join(', '))}">
    <datalist id="tag-list">${DB.allTags().map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist>
    <label class="lock-row"><input type="checkbox" id="f-lock" ${cur.meta.locked ? 'checked' : ''}> ${icon('lock', 15)} <span>上鎖這篇日記<small>內容會加密後才存到 GitHub</small></span></label>
    <div class="toolbar">
      <button type="button" class="btn ghost sm" data-act="photo">${icon('image', 16)} 照片</button>
      <button type="button" class="btn ghost sm" data-act="preview">${icon('eye', 16)} 預覽</button>
      <span class="hint" id="hint">先點文字中要放的位置，再按「照片」（可多選）</span>
    </div>
    <textarea id="f-body" class="inp body" placeholder="${hints[parseYmd(date).getDate() % hints.length]}">${esc(cur.body)}</textarea>
    <div id="preview" class="prose" hidden></div>
    <input type="file" id="f-file" accept="image/*" multiple hidden>
    <div class="actions">
      <button class="btn primary grow" data-act="save">儲存日記</button>
      ${entry ? `<button class="btn danger" data-act="delete" aria-label="刪除">${icon('trash', 16)}</button>` : ''}
    </div>
  </div>`;

  const body = $('#f-body', el);
  const grow = () => { body.style.height = 'auto'; body.style.height = Math.max(220, body.scrollHeight + 4) + 'px'; };
  grow();
  const collect = () => ({
    meta: {
      title: $('#f-title', el).value.trim(),
      mood: $('#moods .on', el)?.dataset.mood || '',
      weather: $('#weathers .on', el)?.dataset.weather || '',
      location: $('#f-loc', el).value.trim(),
      trip: $('#f-trip', el).value,
      tags: [...new Set($('#f-tags', el).value.split(/[,，、\s]+/).map((s) => s.replace(/^#/, '').trim()).filter(Boolean))],
      locked: $('#f-lock', el).checked,
    },
    body: body.value,
  });
  const saveDraft = debounce(() => { if (!body.isConnected || S.editing !== date) return; if ($('#f-lock', el).checked) { store.del(draftKey(date)); return; } store.set(draftKey(date), { ...collect(), t: Date.now() }); $('#hint', el) && ($('#hint', el).textContent = '草稿已自動保存'); }, 600);
  el.oninput = (e) => { if (e.target === body) grow(); saveDraft(); };
  el.onchange = saveDraft;

  const exit = () => { S.editing = null; hooks.renderAll(); };
  const dirty = () => { const c = collect(); return JSON.stringify(c) !== JSON.stringify({ meta: base.meta, body: base.body }); };

  const save = async (btns) => {
    if (uploading) {
      btns.forEach((b) => { b.disabled = true; b.dataset.old = b.textContent; b.textContent = '等照片上傳完…'; });
      await uploading.catch(() => {});
      btns.forEach((b) => { b.disabled = false; b.textContent = b.dataset.old; });
    }
    const { meta, body: text } = collect();
    if (meta.locked && !vault.unlocked) {
      if (!vault.supported()) { toast('這個瀏覽器不支援加密（需要 https 網址）', 'error'); return; }
      try {
        if (await vault.exists(DB.adapter)) {
          const pw = await askPass({ title: '輸入日記密碼' }); if (pw == null) return;
          await vault.unlock(DB.adapter, pw);
        } else {
          const pw = await askPass({ create: true, title: '設定日記密碼' }); if (pw == null) return;
          await vault.setup(DB.adapter, pw);
        }
      } catch (err) { toast(err.message, 'error'); return; }
    }
    btns.forEach((b) => { b.disabled = true; });
    const old = btns.map((b) => b.textContent);
    btns.forEach((b) => { b.textContent = '儲存中…'; });
    try {
      await DB.saveEntry(date, meta, text);
      store.del(draftKey(date));
      toast(DB.mode === 'github' ? '已同步到 GitHub ✓' : '已儲存 ✓');
      exit();
    } catch (e) {
      toast(e.message, 'error');
      btns.forEach((b, i) => { b.disabled = false; b.textContent = old[i]; });
    }
  };

  el.onclick = async (e) => {
    const mood = e.target.closest('[data-mood]');
    const weather = e.target.closest('[data-weather]');
    if (mood || weather) {
      const b = mood || weather;
      const was = b.classList.contains('on');
      $$('.chip', b.parentElement).forEach((c) => c.classList.remove('on'));
      if (!was) b.classList.add('on');
      saveDraft(); return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close' && uploading) { toast('照片還在上傳，請稍候'); return; }
    if (act === 'close') { S.editing = null; go(`#/month/${date.slice(0, 7)}`); }
    else if (act === 'cancel') { if (uploading) { toast('照片還在上傳，請稍候'); return; } if (dirty() && !confirm('放棄尚未儲存的內容？')) return; store.del(draftKey(date)); exit(); }
    else if (act === 'save') save($$('[data-act="save"]', el));
    else if (act === 'delete') { if (confirm('確定刪除這天的日記？（GitHub 上仍可從版本紀錄找回）')) { try { await DB.deleteEntry(date); store.del(draftKey(date)); toast('已刪除'); exit(); } catch (err) { toast(err.message, 'error'); } } }
    else if (act === 'photo') $('#f-file', el).click();
    else if (act === 'preview') {
      const pv = $('#preview', el);
      pv.hidden = !pv.hidden; body.hidden = !pv.hidden;
      if (!pv.hidden) { pv.innerHTML = renderMd(body.value) || '<p class="muted">（還沒有內容）</p>'; hydratePhotos(pv); }
    }
  };

  // 記住游標位置：點「照片」按鈕時 textarea 會失去焦點，照片要插在最後停留的位置
  let lastPos = body.value.length;
  const remember = () => { lastPos = body.selectionStart ?? lastPos; };
  ['keyup', 'click', 'select', 'blur', 'input'].forEach((ev) => body.addEventListener(ev, remember));
  const setHint = (t) => { const h = $('#hint', el); if (h) h.textContent = t; };
  let uploading = null; // 上傳中的 Promise；儲存時會等它完成

  $('#f-file', el).onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const run = async () => {
      let ok = 0;
      for (const [i, f] of files.entries()) {
        const n = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
        try {
          setHint(`處理照片${n}…`);
          const blob = await resizeImage(f);
          const thumb = await resizeImage(f, 360, 0.7);
          setHint((DB.mode === 'github' ? '上傳到 GitHub' : '儲存照片') + `${n}…`);
          const path = await DB.uploadPhoto(date, blob, thumb);
          const pos = Math.min(lastPos, body.value.length);
          const ins = `${pos && body.value[pos - 1] !== '\n' ? '\n' : ''}![](${path})\n`;
          body.value = body.value.slice(0, pos) + ins + body.value.slice(pos);
          lastPos = pos + ins.length;
          ok++;
          grow(); saveDraft();
        } catch (err) { toast(`照片${n} 失敗：` + err.message, 'error'); }
      }
      setHint(ok ? `已加入 ${ok} 張照片 ✓` : '');
    };
    const prev = uploading || Promise.resolve();
    const job = prev.then(run);
    uploading = job;
    job.finally(() => { if (uploading === job) uploading = null; });
  };
  el.onkeydown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save($$('[data-act="save"]', el)); }
  };
  if (!body.value) body.focus({ preventScroll: true });
}

/* ---------------- 閱讀模式事件 ---------------- */
export function bindPanelView() {
  const el = $('#panel');
  el.onclick = (e) => {
    if (S.editing === S.selected) return; // 編輯器自己處理
    const act = e.target.closest('[data-act]')?.dataset.act;
    const img = e.target.closest('.prose img');
    if (img && img.src) { photoView(img); return; }
    const tag = e.target.closest('[data-tag]');
    if (tag) { S.q = ''; S.filters = { mood: '', trip: '', tag: tag.dataset.tag }; go('#/search'); return; }
    const otd = e.target.closest('[data-date]');
    if (otd) { hooks.openDay(otd.dataset.date); return; }
    if (act === 'close') { S.panelOpen = false; go(`#/month/${S.selected.slice(0, 7)}`); }
    else if (act === 'edit') { S.editing = S.selected; hooks.renderPanel(); }
    else if (act === 'prev') hooks.openDay(addDays(S.selected, -1));
    else if (act === 'next') hooks.openDay(addDays(S.selected, 1));
    else if (act === 'reload') hooks.renderPanel();
    else if (act === 'relock') { vault.lock(); toast('已上鎖'); hooks.renderAll(); }
    else if (act === 'unlock') {
      (async () => {
        const pw = await askPass({ title: '輸入日記密碼' }); if (pw == null) return;
        try { await vault.unlock(DB.adapter, pw); toast('已解鎖 ✓'); hooks.renderPanel(); } catch (err) { toast(err.message, 'error'); }
      })();
    }
  };
  el.oninput = null; el.onchange = null; el.onkeydown = null;
}

// 看大圖，並可指定成首頁封面
function photoView(img) {
  const path = img.dataset.path || '';
  const isCover = path && DB.home.cover === path;
  const m = openModal(`<img class="lb-img" src="${esc(img.src)}" alt="">
    <div class="actions" style="margin-top:12px">${path ? `<button class="btn ${isCover ? '' : 'primary'} grow" data-hc>${isCover ? '取消首頁封面' : '設為首頁封面'}</button>` : ''}<button class="btn grow" data-close>關閉</button></div>`);
  m.el.classList.add('lightbox');
  const b = m.el.querySelector('[data-hc]');
  if (b) b.onclick = async () => {
    b.disabled = true;
    try { await DB.setHomeCover(isCover ? '' : path); toast(isCover ? '已改回自動挑選' : '已設為首頁封面 ✓'); m.close(); } catch (e) { toast(e.message, 'error'); b.disabled = false; }
  };
}
