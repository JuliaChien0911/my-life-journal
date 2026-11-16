// 設定：GitHub 連線、外觀、資料維護
import { S, saveSettings, hooks } from './state.js';
import { DB } from './db.js';
import { GitHubAdapter } from './storage.js';
import { $, esc, openModal, toast, store } from './util.js';
import { icon } from './icons.js';
import { applock } from './applock.js';
import { askPass } from './vault.js';

// 設定連結：把連線資料編成 #/setup=... ，貼到新裝置的瀏覽器即可自動連線（# 後面的內容不會送到任何伺服器）
const b64u = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (str) => atob(str.replace(/-/g, '+').replace(/_/g, '/'));
export function makeSetupLink(cfg) {
  const j = JSON.stringify({ o: cfg.owner, r: cfg.repo, b: cfg.branch || 'main', t: cfg.token });
  return location.origin + location.pathname + '#/setup=' + b64u(j);
}
export function parseSetupLink(hash) {
  const m = /^#\/setup=([\w-]+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const j = JSON.parse(unb64u(m[1]));
    if (!j.o || !j.r || !j.t) return null;
    return { owner: j.o, repo: j.r, branch: j.b || 'main', token: j.t };
  } catch { return null; }
}

function showSetupLink(cfg) {
  const link = makeSetupLink(cfg);
  const m = openModal(`<div class="modal-head"><h3>🔗 新裝置設定連結</h3><button class="icon-btn" data-close aria-label="關閉">${icon('x')}</button></div>
    <div class="form">
      <p class="note">在新裝置的瀏覽器打開這個連結，就會自動連線，不用再手動輸入。</p>
      <p class="note bad">⚠️ 連結裡含有你的 Token，等同密碼：只傳給自己（AirDrop、傳給自己的訊息），用完就刪掉，不要貼到公開的地方。</p>
      <textarea class="inp" id="sl" rows="4" readonly>${esc(link)}</textarea>
      <div class="actions"><button class="btn primary grow" id="sl-copy">複製連結</button>${navigator.share ? '<button class="btn grow" id="sl-share">分享</button>' : ''}</div>
    </div>`);
  const ta = m.el.querySelector('#sl');
  ta.onfocus = () => ta.select();
  m.el.querySelector('#sl-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('已複製連結'); } catch { ta.focus(); ta.select(); toast('請長按選取後拷貝'); }
  };
  const sh = m.el.querySelector('#sl-share');
  if (sh) sh.onclick = () => navigator.share({ title: '我的日誌設定連結', text: link }).catch(() => {});
}

export function openSettings() {
  const s = S.settings;
  const gh = DB.mode === 'github';
  const m = openModal(`<div class="modal-head"><h3>設定</h3><button class="icon-btn" data-close aria-label="關閉">${icon('x')}</button></div>
  <div class="form">
    <section class="set-sec">
      <h4>${icon('cloud', 18)} 同步到 GitHub ${gh ? '<span class="pill ok">已連線</span>' : '<span class="pill">試用模式</span>'}</h4>
      <p class="muted sm">日記會以文字檔存進你指定的 repo，每次儲存都是一筆 commit，任何裝置登入後都能看到。建議使用<b>私人（Private）repo</b>。<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">建立 Token →</a>（只勾選該 repo，權限 Contents: Read and write）</p>
      <div class="row2"><label>GitHub 帳號<input id="s-owner" class="inp" value="${esc(s.owner)}" placeholder="your-name" autocapitalize="off" autocomplete="off"></label>
      <label>Repo 名稱<input id="s-repo" class="inp" value="${esc(s.repo)}" placeholder="my-diary-data" autocapitalize="off" autocomplete="off"></label></div>
      <div class="row2"><label>分支<input id="s-branch" class="inp" value="${esc(s.branch)}" placeholder="main"></label>
      <label>Token<input id="s-token" type="password" class="inp" value="${esc(s.token)}" placeholder="github_pat_…" autocomplete="off"></label></div>
      <div class="actions"><button class="btn primary grow" id="s-connect">測試並連線</button>${gh ? '<button class="btn" id="s-disconnect">改回試用模式</button>' : ''}</div>
      <div id="s-msg" class="note" hidden></div>
    </section>
    <section class="set-sec">
      <h4>🔐 開啟密碼（這台裝置） ${applock.enabled ? '<span class="pill ok">已啟用</span>' : '<span class="pill">未啟用</span>'}</h4>
      <p class="muted sm">${applock.enabled ? '每次重新開啟網站都要輸入密碼。Token 已加密，這台裝置不會留下日記內容。' : gh ? '建議在公司電腦等共用裝置啟用：開啟網站要先輸入密碼，Token 會加密，也不會在這台裝置留下日記內容。手機／iPad 不受影響，各裝置各自設定。' : '請先連線到 GitHub，才能啟用開啟密碼。'}</p>
      <div class="actions wrap">${applock.enabled ? '<button class="btn" id="s-lockoff">關閉開啟密碼</button><button class="btn" id="s-locknow">立即鎖定</button>' : gh ? '<button class="btn primary" id="s-lockon">設定開啟密碼</button>' : ''}</div>
    </section>
    <section class="set-sec">
      <h4>外觀</h4>
      <div class="row2">
        <label>每週從<select id="s-week" class="inp"><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>週日</option><option value="1" ${s.weekStart === 1 ? 'selected' : ''}>週一</option></select></label>
        <label>主題<select id="s-theme" class="inp"><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>跟隨系統</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>淺色</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option></select></label>
      </div>
      <div class="note">首頁封面：${DB.home.cover ? '已自訂（可從首頁左下「更換封面」更換）' : '自動挑選（可從首頁「更換封面」指定）'} ${DB.home.cover ? '<button class="link" id="s-homecover">恢復自動</button>' : ''}</div>
    </section>
    <section class="set-sec">
      <h4>資料</h4>
      <div class="actions wrap">
        ${gh ? `<button class="btn" id="s-setuplink">🔗 新裝置設定連結</button><button class="btn" id="s-rebuild">重建索引</button><a class="btn" target="_blank" rel="noopener" href="https://github.com/${esc(s.owner)}/${esc(s.repo)}">在 GitHub 查看</a>` : '<button class="btn" id="s-export">匯出試用資料</button><button class="btn danger" id="s-reset">清除試用資料</button>'}
      </div>
      <p class="muted sm">${gh ? '若你直接在 GitHub 上新增或修改了日記檔，按「重建索引」讓月曆與搜尋更新。' : '試用資料只在這個瀏覽器；連接 GitHub 後會使用 repo 內的資料。'}</p>
    </section>
  </div>`);
  const el = m.el;
  const msg = (t, bad) => { const b = $('#s-msg', el); b.hidden = false; b.className = 'note' + (bad ? ' bad' : ' good'); b.textContent = t; };

  $('#s-week', el).onchange = (e) => { saveSettings({ weekStart: Number(e.target.value) }); hooks.renderAll(); };
  const hc = $('#s-homecover', el); if (hc) hc.onclick = async () => { await DB.setHomeCover(''); toast('已恢復自動挑選'); m.close(); hooks.renderAll(); };
  $('#s-theme', el).onchange = (e) => saveSettings({ theme: e.target.value });

  $('#s-connect', el).onclick = async (ev) => {
    const cfg = { owner: $('#s-owner', el).value.trim(), repo: $('#s-repo', el).value.trim(), branch: $('#s-branch', el).value.trim() || 'main', token: $('#s-token', el).value.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) return msg('請完整填寫帳號、Repo 與 Token', true);
    const btn = ev.target; btn.disabled = true; btn.textContent = '連線中…';
    try {
      const info = await new GitHubAdapter(cfg).test();
      saveSettings({ ...cfg, mode: 'github' });
      await DB.init();
      hooks.syncState('syncing');
      await DB.load();
      if (!Object.keys(DB.index.entries).length) { // 第一次連接，若 repo 內已有日記檔就自動建立索引
        const n = await DB.rebuildIndex().catch(() => 0);
        if (n) toast(`已找到 ${n} 篇日記並建立索引`);
      }
      hooks.syncState('ok');
      msg(`連線成功：${info.fullName}${info.private ? '（私人）' : '（⚠️ 公開 repo，任何人都看得到日記）'}`, false);
      toast('已連接 GitHub ✓');
      hooks.renderAll();
      setTimeout(m.close, info.private ? 900 : 2800);
    } catch (e) { msg(e.message, true); hooks.syncState('error'); }
    finally { btn.disabled = false; btn.textContent = '測試並連線'; }
  };

  const dc = $('#s-disconnect', el);
  if (dc) dc.onclick = async () => { saveSettings({ mode: 'demo', token: '' }); await DB.init(); m.close(); hooks.syncState('demo'); hooks.renderAll(); toast('已切回試用模式（Token 已從此裝置移除）'); };


  const lon = $('#s-lockon', el);
  if (lon) lon.onclick = async () => {
    if (!applock.supported()) return toast('這個瀏覽器不支援加密功能', 'error');
    const pass = await askPass({ create: true, title: '設定開啟密碼', note: '<p class="note">之後在這台裝置開啟網站都要輸入這組密碼。Token 會用它加密，<b>忘記密碼無法找回</b>（只能清除此裝置後重新連線，GitHub 上的日記不受影響）。</p>' });
    if (!pass) return;
    try { await applock.enable(pass, S.settings.token); saveSettings({}); m.close(); toast('已啟用開啟密碼 ✓'); } catch (e) { toast(e.message, 'error'); }
  };
  const lof = $('#s-lockoff', el);
  if (lof) lof.onclick = () => {
    if (!confirm('關閉後，這台裝置開啟網站不再需要密碼，Token 會以明文存回瀏覽器。確定嗎？')) return;
    applock.disable(); saveSettings({}); m.close(); toast('已關閉開啟密碼');
  };
  const lnow = $('#s-locknow', el);
  if (lnow) lnow.onclick = () => location.reload();

  const sl = $('#s-setuplink', el);
  if (sl) sl.onclick = () => showSetupLink(S.settings);

  const rb = $('#s-rebuild', el);
  if (rb) rb.onclick = async () => {
    rb.disabled = true;
    try { const n = await DB.rebuildIndex((d, t) => { rb.textContent = `重建中 ${d}/${t}`; }); toast(`索引已重建（${n} 篇）`); hooks.renderAll(); m.close(); } catch (e) { toast(e.message, 'error'); }
    rb.disabled = false; rb.textContent = '重建索引';
  };

  const ex = $('#s-export', el);
  if (ex) ex.onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([DB.adapter.exportAll()], { type: 'application/json' }));
    a.download = 'diary-demo-backup.json'; a.click();
  };
  const rs = $('#s-reset', el);
  if (rs) rs.onclick = async () => {
    if (!confirm('清除試用模式的所有資料（包含範例）？')) return;
    DB.adapter.clear(); store.set('demoSeeded', 3);
    await DB.init(); m.close(); hooks.renderAll(); toast('已清除');
  };
}
