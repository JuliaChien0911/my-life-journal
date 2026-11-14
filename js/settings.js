// 設定：GitHub 連線、外觀、資料維護
import { S, saveSettings, hooks } from './state.js';
import { DB } from './db.js';
import { GitHubAdapter } from './storage.js';
import { $, esc, openModal, toast, store } from './util.js';
import { icon } from './icons.js';

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
      <h4>外觀</h4>
      <div class="row2">
        <label>每週從<select id="s-week" class="inp"><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>週日</option><option value="1" ${s.weekStart === 1 ? 'selected' : ''}>週一</option></select></label>
        <label>主題<select id="s-theme" class="inp"><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>跟隨系統</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>淺色</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option></select></label>
      </div>
      <div class="note">首頁封面：${DB.home.cover ? '已自訂（在日記裡點照片可更換）' : '自動挑選（在日記裡點照片可指定）'} ${DB.home.cover ? '<button class="link" id="s-homecover">恢復自動</button>' : ''}</div>
    </section>
    <section class="set-sec">
      <h4>資料</h4>
      <div class="actions wrap">
        ${gh ? `<button class="btn" id="s-rebuild">重建索引</button><a class="btn" target="_blank" rel="noopener" href="https://github.com/${esc(s.owner)}/${esc(s.repo)}">在 GitHub 查看</a>` : '<button class="btn" id="s-export">匯出試用資料</button><button class="btn danger" id="s-reset">清除試用資料</button>'}
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
