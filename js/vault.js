// 日記鎖：用密碼加密（PBKDF2 → AES-GCM 256）。密碼只存在這個分頁的記憶體，不會上傳，也不會存進瀏覽器。
// vault.json（放在資料庫 repo）只存「鹽」與一小段用來驗證密碼的密文，忘記密碼無法復原。
import { openModal, esc } from './util.js';

let key = null;
let hideTimer = null;
const listeners = [];
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(text));
  return `enc1:${b64(iv)}:${b64(ct)}`;
}
async function open(k, s) {
  const [tag, iv, ct] = String(s).trim().split(':');
  if (tag !== 'enc1') throw new Error('不是加密內容');
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(ct)));
}

export const vault = {
  get unlocked() { return !!key; },
  supported: () => !!(window.crypto && crypto.subtle),
  onLock(fn) { listeners.push(fn); },
  lock() { key = null; listeners.forEach((f) => f()); },
  encrypt: (text) => seal(key, text),
  decrypt: (s) => open(key, s),

  async exists(adapter) { return !!(await adapter.getText('vault.json')); },
  async setup(adapter, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await derive(pass, salt);
    await adapter.putText('vault.json', JSON.stringify({ v: 1, salt: b64(salt), check: await seal(k, 'my-life-journal') }), '日記鎖設定');
    key = k;
  },
  async unlock(adapter, pass) {
    const r = await adapter.getText('vault.json');
    if (!r) throw new Error('找不到鎖設定');
    const v = JSON.parse(r.text);
    const k = await derive(pass, unb64(v.salt));
    try { await open(k, v.check); } catch { throw new Error('密碼不正確'); }
    key = k;
  },
};

// 離開畫面超過 5 分鐘自動上鎖
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (key) hideTimer = setTimeout(() => vault.lock(), 5 * 60 * 1000); }
  else clearTimeout(hideTimer);
});

// 密碼輸入視窗：create=true 時要輸入兩次
export function askPass({ create = false, title = '輸入日記密碼' } = {}) {
  return new Promise((resolve) => {
    const m = openModal(`<div class="modal-head"><h3>🔒 ${esc(title)}</h3></div>
      <form class="form" id="pf">
        ${create ? '<p class="note">這是第一次使用日記鎖。請設定一組密碼：上鎖的日記會加密後才存到 GitHub，<b>忘記密碼就無法復原</b>，請務必記好。</p>' : ''}
        <input class="inp" id="p1" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" placeholder="密碼" required minlength="${create ? 6 : 1}">
        ${create ? '<input class="inp" id="p2" type="password" autocomplete="new-password" placeholder="再輸入一次（至少 6 個字元）" required minlength="6">' : ''}
        <div class="note bad" id="pe" hidden></div>
        <div class="actions"><button type="button" class="btn grow" data-close>取消</button><button class="btn primary grow">${create ? '設定密碼' : '解鎖'}</button></div>
      </form>`);
    let done = false;
    const fin = (v) => { if (done) return; done = true; resolve(v); m.close(); };
    m.el.querySelector('[data-close]').addEventListener('click', () => fin(null));
    m.el.parentElement.addEventListener('mousedown', (e) => { if (e.target === m.el.parentElement) fin(null); });
    m.el.querySelector('#pf').onsubmit = (e) => {
      e.preventDefault();
      const a = m.el.querySelector('#p1').value;
      if (create && a !== m.el.querySelector('#p2').value) { const er = m.el.querySelector('#pe'); er.textContent = '兩次輸入不一樣'; er.hidden = false; return; }
      fin(a);
    };
    setTimeout(() => m.el.querySelector('#p1').focus(), 50);
  });
}
