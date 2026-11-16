// 開啟密碼：每台裝置自己決定要不要啟用。
// 啟用後：GitHub Token 用密碼加密（PBKDF2 → AES-GCM）才存進瀏覽器，且不再把日記內容快取在本機。
// 沒有密碼就拿不到 Token，也看不到日記。忘記密碼無法找回，但可「清除此裝置資料」重新連線（GitHub 上的資料不受影響）。
const KEY = 'applock';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let key = null; // 只在記憶體

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } };

async function derive(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(text));
  return `${b64(iv)}:${b64(ct)}`;
}
async function open(k, s) {
  const [iv, ct] = String(s).split(':');
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(ct)));
}

// 清除本機快取的日記內容（索引、旅程、各篇文字、草稿）
export function clearLocalCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('dc:') || k.startsWith('draft:')).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

export const applock = {
  supported: () => !!(window.crypto && crypto.subtle),
  get enabled() { return !!read(); },
  get unlocked() { return !!key; },

  // 啟用：用密碼加密 Token，並清掉本機快取
  async enable(pass, token) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await derive(pass, salt);
    const ok = write({ v: 1, salt: b64(salt), check: await seal(k, 'my-life-journal'), tokenEnc: token ? await seal(k, token) : '' });
    if (!ok) throw new Error('無法寫入瀏覽器儲存空間');
    key = k;
    clearLocalCache();
  },
  // 解鎖：回傳解密後的 Token
  async unlock(pass) {
    const v = read();
    if (!v) return '';
    const k = await derive(pass, unb64(v.salt));
    try { await open(k, v.check); } catch { throw new Error('密碼不正確'); }
    key = k;
    return v.tokenEnc ? open(k, v.tokenEnc) : '';
  },
  // 之後換了 Token（重新連線）時更新密文
  async updateToken(token) {
    const v = read();
    if (!v) return;
    if (!token) { localStorage.removeItem(KEY); key = null; return; } // 已中斷連線，不需要再鎖
    if (!key) return;
    v.tokenEnc = await seal(key, token);
    write(v);
  },
  // 關閉開啟密碼（需已解鎖）；Token 之後以明文存回
  disable() { localStorage.removeItem(KEY); key = null; },
  // 忘記密碼：清掉此裝置上的連線與快取
  wipeDevice() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem('settings');
      clearLocalCache();
    } catch { /* ignore */ }
    key = null;
  },
};

// 全螢幕密碼畫面。解鎖成功才 resolve，回傳 Token。
export function gate() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'applock';
    el.innerHTML = `<form class="applock-box" id="al-f">
      <span class="script">My Life Journal</span>
      <h2>🔒 輸入密碼</h2>
      <input class="inp" id="al-p" type="password" autocomplete="current-password" placeholder="密碼" required>
      <div class="note bad" id="al-e" hidden></div>
      <button class="btn primary" id="al-b">解鎖</button>
      <button type="button" class="link" id="al-forget">忘記密碼？</button>
    </form>`;
    document.body.appendChild(el);
    const $e = (s) => el.querySelector(s);
    const err = $e('#al-e');
    const input = $e('#al-p');
    setTimeout(() => input.focus(), 50);
    $e('#al-f').onsubmit = async (ev) => {
      ev.preventDefault();
      const btn = $e('#al-b');
      btn.disabled = true; btn.textContent = '解鎖中…'; err.hidden = true;
      try {
        const token = await applock.unlock(input.value);
        el.remove();
        resolve(token);
      } catch (e) {
        err.textContent = e.message || '解鎖失敗'; err.hidden = false;
        input.value = ''; input.focus();
        btn.disabled = false; btn.textContent = '解鎖';
      }
    };
    $e('#al-forget').onclick = () => {
      if (!confirm('忘記密碼無法找回。\n\n要清除「這台裝置」上的連線資料嗎？\nGitHub 上的日記不會被刪除，之後可重新連線。')) return;
      applock.wipeDevice();
      location.reload();
    };
  });
}
