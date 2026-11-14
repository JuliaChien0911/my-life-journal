// 儲存層：兩種「轉接器」提供同樣的介面，之後想換成別的後端（Gist、Cloudflare R2…）只要再寫一個即可。
//   getText(path) → {text} | null     putText(path, text, msg)
//   putBinary(path, blob, msg)        blobUrl(path) → 可顯示的圖片網址
//   remove(path, msg)                 list(prefix) → 路徑陣列
import { store } from './util.js';

const bytesToB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
const textToB64 = (t) => bytesToB64(new TextEncoder().encode(t));
const b64ToText = (b64) => new TextDecoder().decode(b64ToBytes(b64));
const blobToB64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});
const blobToDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

/* ---------------- 試用模式：存在這個瀏覽器的 localStorage ---------------- */
export class LocalAdapter {
  constructor() {
    this.name = 'demo';
    this.key = 'diary_demo_files';
    this.files = store.get(this.key, {});
  }
  persist() {
    if (!store.set(this.key, this.files)) throw new Error('瀏覽器儲存空間已滿，請連接 GitHub 或刪除一些照片');
  }
  async getText(path) { const f = this.files[path]; return f && f.text != null ? { text: f.text } : null; }
  async putText(path, text) { this.files[path] = { text }; this.persist(); }
  async putBinary(path, blob) { this.files[path] = { url: await blobToDataUrl(blob) }; this.persist(); }
  async blobUrl(path) { return this.files[path]?.url || null; }
  async remove(path) { delete this.files[path]; this.persist(); }
  async list(prefix) { return Object.keys(this.files).filter((p) => p.startsWith(prefix)); }
  exportAll() { return JSON.stringify(this.files, null, 1); }
  clear() { this.files = {}; store.del(this.key); }
}

/* ---------------- GitHub：透過 REST API 讀寫 repo 內的檔案 ---------------- */
export class GitHubAdapter {
  constructor({ owner, repo, branch, token }) {
    Object.assign(this, { owner, repo, branch: branch || 'main', token });
    this.name = 'github';
    this.shas = {};      // path → 最新 sha（更新檔案時需要）
    this.blobUrls = {};  // path → Promise<objectURL>
  }

  async request(url, opts = {}) {
    const res = await fetch(url.startsWith('http') ? url : `https://api.github.com/repos/${this.owner}/${this.repo}${url ? '/' + url : ''}`, {
      cache: 'no-store',
      ...opts,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    return res;
  }

  async fail(res, what) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch { /* ignore */ }
    const hint = res.status === 401 ? '（Token 無效或已過期）'
      : res.status === 403 ? '（權限不足或請求過於頻繁）'
      : res.status === 404 ? '（找不到 repo，或 Token 沒有這個 repo 的權限）' : '';
    const e = new Error(`${what}失敗 ${res.status}${hint} ${detail}`.trim());
    e.status = res.status;
    return e;
  }

  encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

  async test() {
    const res = await this.request('');
    if (!res.ok) throw await this.fail(res, '連線');
    const j = await res.json();
    if (j.permissions && j.permissions.push === false) throw new Error('這個 Token 只有讀取權限，請改為 Contents: Read and write');
    return { private: j.private, fullName: j.full_name, defaultBranch: j.default_branch };
  }

  async getFile(path) {
    const res = await this.request(`contents/${this.encPath(path)}?ref=${encodeURIComponent(this.branch)}`);
    if (res.status === 404) { delete this.shas[path]; return null; }
    if (!res.ok) throw await this.fail(res, '讀取');
    const j = await res.json();
    this.shas[path] = j.sha;
    return j;
  }

  async readB64(j) {
    if (j.content) return j.content;
    const res = await this.request(`git/blobs/${j.sha}`); // 大檔（>1MB）改走 blob API
    if (!res.ok) throw await this.fail(res, '讀取');
    return (await res.json()).content;
  }

  async getText(path) {
    const j = await this.getFile(path);
    return j ? { text: b64ToText(await this.readB64(j)) } : null;
  }

  async put(path, b64, message, retry = true) {
    if (!this.shas[path]) await this.getFile(path); // 不存在會得到 null，就是新增
    const body = { message, content: b64, branch: this.branch };
    if (this.shas[path]) body.sha = this.shas[path];
    const res = await this.request(`contents/${this.encPath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) {
      if (retry && (res.status === 409 || res.status === 422)) { delete this.shas[path]; await this.getFile(path); return this.put(path, b64, message, false); }
      throw await this.fail(res, '儲存');
    }
    this.shas[path] = (await res.json()).content.sha;
  }

  putText(path, text, msg = 'diary: update') { return this.put(path, textToB64(text), msg); }
  async putBinary(path, blob, msg = 'diary: photo') { return this.put(path, await blobToB64(blob), msg); }

  blobUrl(path) {
    if (!this.blobUrls[path]) {
      this.blobUrls[path] = (async () => {
        const j = await this.getFile(path);
        if (!j) return null;
        const bytes = b64ToBytes(await this.readB64(j));
        return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      })().catch((e) => { delete this.blobUrls[path]; throw e; });
    }
    return this.blobUrls[path];
  }

  async remove(path, msg = 'diary: delete') {
    if (!this.shas[path]) await this.getFile(path);
    if (!this.shas[path]) return;
    const res = await this.request(`contents/${this.encPath(path)}`, {
      method: 'DELETE', body: JSON.stringify({ message: msg, sha: this.shas[path], branch: this.branch }),
    });
    if (!res.ok && res.status !== 404) throw await this.fail(res, '刪除');
    delete this.shas[path];
  }

  async list(prefix) {
    const res = await this.request(`git/trees/${encodeURIComponent(this.branch)}?recursive=1`);
    if (res.status === 404 || res.status === 409) return []; // 空 repo
    if (!res.ok) throw await this.fail(res, '列出檔案');
    const j = await res.json();
    return (j.tree || []).filter((n) => n.type === 'blob' && n.path.startsWith(prefix)).map((n) => n.path);
  }
}
