// 試用模式的範例資料（日期以「今天」為基準，所以打開就會看到本月有內容）
import { todayStr, addDays, uid } from './util.js';
import { serializeEntry, plainText, countPhotos, firstPhoto, allPhotos } from './md.js';
import { art } from './art.js';

export async function seedDemo(DB) {
  const a = DB.adapter;
  const today = todayStr();
  const tripStart = addDays(today, -9);
  const upStart = addDays(today, 21);
  const entries = {};

  const add = async (date, meta, body) => {
    meta = { title: '', mood: '', weather: '', location: '', trip: '', tags: [], ...meta };
    await a.putText(`entries/${date.slice(0, 4)}/${date}.md`, serializeEntry(meta, body));
    const text = plainText(body);
    entries[date] = { title: meta.title, mood: meta.mood, weather: meta.weather, location: meta.location, trip: meta.trip, tags: meta.tags, excerpt: text.slice(0, 160), photos: countPhotos(body), cover: firstPhoto(body), pics: allPhotos(body), words: text.length };
  };

  const photo = (name, pal) => { a.files[`photos/demo/${name}.jpg`] = { url: art(name, pal) }; return `![](photos/demo/${name}.jpg)`; };
  const kyoto = 'demo-kyoto';
  await add(addDays(tripStart, 0), { title: '抵達京都', mood: '🥰', weather: '⛅', location: '京都', trip: kyoto, tags: ['旅行', '京都'] },
    '早班飛機落地，一路搭 JR 到京都站。**行李放好就直接出門**，在錦市場吃了玉子燒和豆乳甜甜圈。\n\n- 入住：車站旁的小旅館\n- 晚餐：拉麵，湯頭很濃\n\n> 秋天的京都，空氣裡有一點點楓葉的味道。\n\n' + photo('kyoto-1', 0));
  await add(addDays(tripStart, 1), { title: '伏見稻荷＋清水寺', mood: '😊', weather: '☀️', location: '伏見稻荷大社', trip: kyoto, tags: ['旅行', '京都', '寺社'] },
    '一大早爬千本鳥居，人少、光線好。下午去清水寺，楓葉剛好轉紅。\n\n走了兩萬五千步，腳超痛，但很值得。\n\n' + photo('kyoto-2', 4) + '\n' + photo('kyoto-3', 2));
  await add(addDays(tripStart, 2), { title: '嵐山竹林', mood: '😌', weather: '☁️', location: '嵐山', trip: kyoto, tags: ['旅行', '京都'] },
    '搭嵐電去嵐山，竹林小徑很安靜。中午吃湯豆腐，下午在渡月橋邊發呆。\n\n' + photo('kyoto-4', 5));
  await add(addDays(today, -3), { title: '慢慢過的一天', mood: '😌', weather: '🌧️', location: '家裡', tags: ['日常'] },
    '下雨天，窩在家整理旅行照片。\n\n- [x] 洗衣服\n- [x] 整理照片\n- [ ] 寫旅行遊記\n\n' + photo('home-1', 3));
  await add(addDays(today, -1), { title: '回到日常', mood: '😮‍💨', weather: '☁️', location: '公司', tags: ['工作'] },
    '連假後第一天，信件堆成山。晚上跟朋友約了吃飯，聊起下一趟想去台東。');
  await add(addDays(today, -365), { title: '一年前的今天', mood: '😊', weather: '☀️', location: '台北', tags: ['日常'] },
    '去了新開的咖啡店，點了一杯手沖。希望明年的我也過得很好。');

  const trips = [
    { id: kyoto, name: '京都賞楓小旅行', en: 'Kyoto in Autumn', emoji: '🏯', destination: '日本・京都', start: tripStart, end: addDays(tripStart, 4), cover: photo('kyoto-cover', 4) && 'photos/demo/kyoto-cover.jpg', color: '#c4513a', notes: '第一次秋天去京都，目標：看楓葉、吃甜點。',
      places: [
        { id: uid(), name: '錦市場', lat: 35.005, lng: 135.7649, date: addDays(tripStart, 0), note: '玉子燒、豆乳甜甜圈' },
        { id: uid(), name: '伏見稻荷大社', lat: 34.9671, lng: 135.7727, date: addDays(tripStart, 1), note: '早上去人少' },
        { id: uid(), name: '清水寺', lat: 34.9949, lng: 135.785, date: addDays(tripStart, 1), note: '' },
        { id: uid(), name: '嵐山竹林小徑', lat: 35.0094, lng: 135.6722, date: addDays(tripStart, 2), note: '' },
      ] },
    { id: 'demo-taitung', name: '台東慢旅', en: 'Slow Taitung', emoji: '🏖️', destination: '台灣・台東', start: upStart, end: addDays(upStart, 2), cover: photo('taitung-cover', 1) && 'photos/demo/taitung-cover.jpg', color: '#3f6b5e', notes: '計畫：池上騎單車、都蘭看海、鹿野高台。',
      places: [{ id: uid(), name: '池上伯朗大道', lat: 23.1226, lng: 121.2205, date: addDays(upStart, 0), note: '租腳踏車' }] },
  ];

  await a.putText('trips.json', JSON.stringify({ version: 1, trips }));
  await a.putText('index.json', JSON.stringify({ version: 1, entries }));
}
