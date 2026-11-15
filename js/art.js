// 沒有照片時，自動產生風景插畫（SVG）當封面：同一個 seed 永遠畫出同一張。
// 三種場景：town（山丘小鎮）、lake（湖光山色＋倒影）、forest（松林）；帶薄霧與顆粒質感。
const PALS = [
  ['#4F93D6', '#C4E2F5', '#FFF4C2', '#8FB3D1', '#6FA05A', '#3F7A3A'], // 晴空山丘
  ['#4C9BD8', '#D2EAF6', '#FFFFFF', '#6FA3C4', '#4E92B8', '#2F6F95'], // 明亮湖光
  ['#6FB0E0', '#EAF4F8', '#FFE9A8', '#A7C0D8', '#86B35A', '#4A8A3C'], // 午後小鎮
  ['#3F86C9', '#B3D8F0', '#FFFFFF', '#5E8FB8', '#3F7BA6', '#2A5F85'], // 高山湖
  ['#7DB7E8', '#F2F6EA', '#FFF1B8', '#B9C9A8', '#8DB650', '#5C8F34'], // 草地小鎮
  ['#8CC4E8', '#E6F1C8', '#FFFBD0', '#6FA05A', '#4F8A3E', '#2F6B2E'], // 森林
];
const KINDS = ['town', 'lake', 'town', 'lake', 'town', 'forest'];

function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const cache = new Map();
const W = 800, H = 500;

export function art(seed = 'x', pal) {
  const key = seed + '|' + pal;
  if (cache.has(key)) return cache.get(key);
  const r = rng(String(seed));
  const idx = typeof pal === 'number' ? ((pal % PALS.length) + PALS.length) % PALS.length : Math.floor(r() * PALS.length);
  const p = PALS[idx], kind = KINDS[idx];
  const lake = kind === 'lake', waterY = lake ? 352 : H + 20;

  const ridge = (base, amp, steps, sharp = 0) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      let y = base + (r() - 0.5) * 2 * amp;
      if (sharp && i % 2) y -= amp * sharp * r(); // 讓山頭更尖
      pts.push([(W * i) / steps, y]);
    }
    let d = `M0 ${H} L0 ${pts[0][1].toFixed(0)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${pts[i][0].toFixed(0)} ${pts[i][1].toFixed(0)} ${mx.toFixed(0)} ${my.toFixed(0)}`;
    }
    d += ` L${W} ${pts[pts.length - 1][1].toFixed(0)} L${W} ${H}Z`;
    return { pts, d };
  };
  const yAt = (pts, x) => { const i = Math.min(pts.length - 2, Math.floor((x / W) * (pts.length - 1))); const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); };

  const sx = W * (0.2 + 0.6 * r()), sy = H * (0.28 + 0.12 * r()), sr = 30 + r() * 24;
  let stars = '';
  for (let i = 0; i < 34; i++) stars += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H * 0.3).toFixed(0)}" r="${(0.5 + r() * 1.1).toFixed(1)}" fill="#fff" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`;

  const far = ridge(lake ? 250 : 292, 64, 10, lake ? 0.9 : 0.3);
  const mid = ridge(lake ? 300 : 345, 48, 9, lake ? 0.6 : 0.2);
  const near = ridge(lake ? 440 : 410, lake ? 14 : 34, 8);

  let extra = '';
  if (kind === 'town') { // 山丘上的小房子，窗戶亮著暖光
    for (let i = 0, x = 60 + r() * 60; x < W - 40 && i < 24; i++) {
      const w = 12 + r() * 16, h = 9 + r() * 14, y = yAt(near.pts, x + w / 2) + 2;
      extra += `<rect x="${x.toFixed(0)}" y="${(y - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${p[5]}" opacity=".96"/><path d="M${(x - 2).toFixed(0)} ${(y - h).toFixed(0)}l${(w / 2 + 2).toFixed(0)} -${(5 + r() * 5).toFixed(0)}l${(w / 2 + 2).toFixed(0)} ${(5 + r() * 5).toFixed(0)}z" fill="${p[4]}"/>`;
      if (r() > 0.35) extra += `<rect x="${(x + w * 0.3).toFixed(0)}" y="${(y - h * 0.65).toFixed(0)}" width="3" height="4" fill="${p[2]}" opacity=".9"/>`;
      x += w + 6 + r() * 22;
    }
  } else if (kind === 'forest') { // 松林
    for (let x = 6; x < W; x += 14 + r() * 16) {
      const y = yAt(near.pts, x) + 6, h = 38 + r() * 46;
      extra += `<path d="M${x} ${y.toFixed(0)}l${(9 + h * 0.12).toFixed(0)} 0l-${(4.5 + h * 0.06).toFixed(0)} -${h.toFixed(0)}z" fill="${p[5]}"/>`;
    }
  }
  const water = lake
    ? `<rect y="${waterY}" width="${W}" height="${H - waterY}" fill="url(#w)"/><g clip-path="url(#c)" opacity=".4"><g transform="translate(0 ${2 * waterY}) scale(1 -1)"><path d="${far.d}" fill="${p[3]}"/><path d="${mid.d}" fill="${p[4]}"/></g></g>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${(r() * W).toFixed(0)}" y="${(waterY + 14 + i * 16).toFixed(0)}" width="${(60 + r() * 140).toFixed(0)}" height="1.5" fill="#fff" opacity=".13"/>`).join('')}`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".74" stop-color="${p[1]}"/></linearGradient>
<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}" stop-opacity=".85"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="g"><stop offset="0" stop-color="${p[2]}"/><stop offset=".3" stop-color="${p[2]}" stop-opacity=".5"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>
<clipPath id="c"><rect y="${waterY}" width="${W}" height="${H - waterY}"/></clipPath>
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .09 0"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>${stars}
<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${(sr * 5).toFixed(0)}" fill="url(#g)"/><circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${sr.toFixed(0)}" fill="${p[2]}"/>
<path d="${far.d}" fill="${p[3]}"/><rect y="${(lake ? 300 : 320)}" width="${W}" height="60" fill="url(#m)"/>
<path d="${mid.d}" fill="${p[4]}"/>${water}<rect y="${lake ? 340 : 360}" width="${W}" height="40" fill="url(#m)" opacity=".7"/>
<path d="${near.d}" fill="${p[5]}"/>${extra}
<rect width="${W}" height="${H}" filter="url(#n)"/></svg>`;
  const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg).replace(/'/g, '%27');
  cache.set(key, uri);
  return uri;
}

export const artBg = (seed, pal) => `background-image:url('${art(seed, pal)}')`;
export const palFromString = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % PALS.length; };
