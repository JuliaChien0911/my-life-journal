// 全域狀態與設定
import { store, todayStr, parseYmd } from './util.js';

export const DEFAULT_SETTINGS = {
  mode: 'demo',        // 'demo' | 'github'
  owner: '', repo: '', branch: 'main', token: '',
  weekStart: 0,        // 0=週日開頭, 1=週一開頭
  theme: 'light',      // auto | light | dark
};

const t = parseYmd(todayStr());

export const S = {
  settings: { ...DEFAULT_SETTINGS, ...store.get('settings', {}) },
  view: 'month',            // month | year | trips | trip | search
  cursor: { y: t.getFullYear(), m: t.getMonth() },
  year: t.getFullYear(),
  selected: todayStr(),
  panelOpen: false,
  editing: null,            // 正在編輯的日期（字串）或 null
  tripId: null,
  tripTab: 'timeline',      // timeline | map
  q: '',
  filters: { mood: '', trip: '', tag: '' },
};

export function saveSettings(patch) {
  Object.assign(S.settings, patch);
  store.set('settings', S.settings);
  if (S.settings.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.settings.theme;
}

// 各模組透過 hooks 呼叫主程式的重繪，避免循環匯入
export const hooks = { route() {}, renderMain() {}, renderPanel() {}, renderAll() {}, openDay() {}, syncState() {} };

// 一般情況用網址 hash 導航；在無法改網址的嵌入環境（window.__MEM_NAV__）則改用記憶體導航
export const nav = { hash: '' };
export const getHash = () => (window.__MEM_NAV__ ? nav.hash : location.hash);
export const go = (hash) => {
  if (window.__MEM_NAV__) { nav.hash = hash; hooks.route(); }
  else if (location.hash === hash) hooks.renderAll();
  else location.hash = hash;
};

export const MOODS = [
  { e: '🥰', t: '很棒' }, { e: '😊', t: '開心' }, { e: '😐', t: '普通' }, { e: '😮‍💨', t: '疲憊' }, { e: '😢', t: '難過' },
];
export const WEATHERS = [
  { e: '☀️', t: '晴' }, { e: '⛅', t: '多雲' }, { e: '☁️', t: '陰' }, { e: '🌧️', t: '雨' }, { e: '⛈️', t: '雷雨' }, { e: '❄️', t: '雪' }, { e: '🌫️', t: '霧' },
];
export const TRIP_COLORS = ['#c4513a', '#3f6b5e', '#d29b2a', '#4a6fa5', '#8a5a83', '#2e8b9a', '#b5651d', '#6b8e23'];
export const TRIP_EMOJIS = ['✈️', '🚆', '⛰️', '🏖️', '🏯', '🏙️', '🚗', '⛺', '🍜', '🎒'];
