// 極簡 Markdown：標題、粗斜體、清單、引用、連結、圖片（只允許 photos/ 內的圖與 https 圖）
// 先跳脫 HTML 再轉換，所以不會有 XSS。
import { esc } from './util.js';

// ---- 日記檔案格式：front matter + 內文 ----
const META_KEYS = ['title', 'mood', 'weather', 'location', 'trip', 'locked'];

export function parseEntry(text) {
  text = String(text || '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const raw = {};
  let body = text;
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) raw[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    body = m[2];
  }
  const meta = {};
  for (const k of META_KEYS) meta[k] = raw[k] || '';
  meta.locked = raw.locked === 'true';
  meta.tags = raw.tags ? raw.tags.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean) : [];
  return { meta, body: body.replace(/^\n+/, '').replace(/\s+$/, '') };
}

export function serializeEntry(meta, body) {
  const lines = ['---'];
  for (const k of META_KEYS) if (meta[k]) lines.push(`${k}: ${String(meta[k]).replace(/\n/g, ' ')}`);
  if (meta.tags && meta.tags.length) lines.push(`tags: [${meta.tags.join(', ')}]`);
  lines.push('---', '');
  return lines.join('\n') + String(body || '').trimEnd() + '\n';
}

// 給索引用：純文字摘要
export function plainText(body) {
  return String(body || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[#>\-*\d.\s\[\]xX]+/gm, '')
    .replace(/[*`~_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const firstPhoto = (body) => (String(body || '').match(/!\[[^\]]*\]\((photos\/[^)\s]+)\)/) || [])[1] || '';
export const allPhotos = (body) => [...String(body || '').matchAll(/!\[[^\]]*\]\((photos\/[^)\s]+)\)/g)].map((m) => m[1]);
export const thumbPath = (p) => p.replace(/\.jpg$/, '.t.jpg');
export const countPhotos = (body) => (String(body || '').match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;

// ---- 轉成 HTML ----
function imgTag(alt, url) {
  if (/^photos\/[\w\-./]+$/.test(url)) return `<img data-photo="${url}" alt="${alt}" loading="lazy">`;
  if (/^https:\/\/[^\s"<>]+$/.test(url)) return `<img src="${url}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`;
  return '';
}

function inline(t) {
  t = esc(t);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => imgTag(alt, url));
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return t;
}

export function renderMd(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      const n = m[1].length + 1; // # → h2，避免與頁面標題衝突
      html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue;
    }
    if (/^-{3,}\s*$/.test(line)) { html += '<hr>'; i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html += `<blockquote>${buf.map(inline).join('<br>')}</blockquote>`; continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      let items = '';
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let t = lines[i++].replace(/^\s*[-*]\s+/, '');
        const task = t.match(/^\[([ xX])\]\s+(.*)$/);
        items += task
          ? `<li class="task"><input type="checkbox" disabled ${task[1] !== ' ' ? 'checked' : ''}> ${inline(task[2])}</li>`
          : `<li>${inline(t)}</li>`;
      }
      html += `<ul>${items}</ul>`; continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      let items = '';
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items += `<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ''))}</li>`;
      html += `<ol>${items}</ol>`; continue;
    }
    // 段落
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|-{3,}\s*$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    const onlyImages = buf.every((l) => /^\s*(!\[[^\]]*\]\([^)]+\)\s*)+$/.test(l));
    html += onlyImages ? `<div class="photo-row">${buf.map(inline).join('')}</div>` : `<p>${buf.map(inline).join('<br>')}</p>`;
  }
  return html;
}
