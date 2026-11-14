// 地圖：Leaflet + OpenStreetMap（免費、不用金鑰）；地點搜尋用 Nominatim
let leafletPromise;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = () => resolve(window.L);
      js.onerror = () => { leafletPromise = null; reject(new Error('地圖載入失敗（可能離線）')); };
      document.head.appendChild(js);
    });
  }
  return leafletPromise;
}

let current;
export async function drawMap(el, places, color = '#c4513a') {
  const L = await loadLeaflet();
  if (current) { current.remove(); current = null; }
  const map = L.map(el, { scrollWheelZoom: false }).setView([25.03, 121.56], 5);
  current = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = places.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
  pts.forEach((p, i) => {
    const icon = L.divIcon({ className: '', html: `<div class="map-pin" style="background:${color}">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
    const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    const div = document.createElement('div');
    const b = document.createElement('b'); b.textContent = p.name; div.appendChild(b);
    if (p.note) { const n = document.createElement('div'); n.textContent = p.note; div.appendChild(n); }
    m.bindPopup(div);
  });
  if (pts.length > 1) {
    L.polyline(pts.map((p) => [p.lat, p.lng]), { color, weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(map);
    map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [36, 36] });
  } else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 13);
  setTimeout(() => map.invalidateSize(), 50);
  return map;
}

export async function geocode(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=zh-TW&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('搜尋失敗');
  return (await res.json()).map((r) => ({ name: r.name || r.display_name.split(',')[0], full: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}
