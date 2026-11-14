# 📔 我的日誌

月曆式個人日記，結合旅行紀錄。純前端、不需伺服器、不需建置，資料以文字檔存放在**你自己的 GitHub**，手機、平板、電腦打開同一個網址就能同步閱讀與撰寫。

## 功能

- **月曆**：每天顯示心情與標題；旅程以彩色橫條跨日標示；手機可左右滑動換月
- **年度**：一年 12 個月的熱度圖，一眼看出哪些天有寫
- **旅程**：設定名稱、日期、目的地、顏色；自動把旅程期間的日記整理成「Day 1…」遊記時間軸；可加入地點並顯示在地圖上
- **日記**：心情、天氣、地點、標籤、Markdown 內文、照片（自動縮圖後上傳）、草稿自動保存
- **搜尋**：標題／內容／地點／標籤，加上心情與旅程篩選
- **那年今天**：自動列出往年同一天的日記
- **PWA**：可「加入主畫面」像 App 一樣使用，淺色／深色主題
- **試用模式**：還沒連 GitHub 也能先玩（內附範例資料）

## 架構（為什麼這樣設計）

```
app repo（公開，放這份程式碼，開 GitHub Pages）
   └─ 網站本身，不含任何個人資料
data repo（私人，放你的日記）
   ├─ entries/2026/2026-11-14.md   每天一個 Markdown 檔
   ├─ photos/2026/…jpg             照片
   ├─ trips.json                   旅程與地點
   └─ index.json                   每天的摘要（月曆與搜尋用）
```

**程式與資料分開**：GitHub Pages 的私人 repo 需要付費方案，而日記又不該公開，所以網站放公開 repo、日記放私人 repo，網站用你的 Token 直接讀寫私人 repo。日記就是純文字檔，每次儲存都是一筆 commit，有完整版本歷史，永遠不會被這個 App 綁住。

## 部署（約 10 分鐘，只做一次）

### 1. 建立兩個 repo
- `my-diary`：**Public**，把這個資料夾的所有檔案上傳到 `main` 分支
- `my-diary-data`：**Private**，勾選「Add a README file」（讓它有初始分支）

### 2. 開啟 GitHub Pages
`my-diary` → **Settings → Pages** → Source 選 **Deploy from a branch**，Branch 選 `main` / `/ (root)` → Save。
約一分鐘後網址是 `https://你的帳號.github.io/my-diary/`。

### 3. 建立 Token（讓網站能讀寫你的日記）
GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
- Repository access：**Only select repositories** → 只選 `my-diary-data`
- Permissions → Repository permissions → **Contents: Read and write**
- 過期時間建議 1 年，到期時重新產生即可

### 4. 在網站連線
打開網址 → 右上角設定 → 填入帳號、Repo 名稱 `my-diary-data`、分支 `main`、Token → **測試並連線**。
之後每台裝置（手機、平板、電腦）都做一次第 4 步即可；Token 只存在該裝置的瀏覽器，不會上傳。

> 手機：用 Safari／Chrome 開啟網址 →「分享」→「加入主畫面」，就像 App 一樣。

## 日常使用
- 點月曆上的任一天 → 閱讀或「編輯」；右下角筆形按鈕（桌機為「寫今天的日記」或按 `n`）直接寫今天
- `Ctrl／⌘ + S` 儲存；照片按「📷 照片」，會縮成最長邊 1600px 再上傳
- 旅程頁新增旅程後，旅程期間的日記會自動串起來；在「地點與地圖」搜尋並加入景點，那天打開日記就會看到當天的景點

## 隱私與安全
- 日記請放 **Private** repo。設定頁連線時若偵測到是公開 repo 會警告
- Token 只給單一 repo 的 Contents 權限，即使外洩也碰不到你其他程式碼；懷疑外洩就到 GitHub 刪除該 Token
- 內文會先跳脫再轉成 HTML，不會執行日記裡的任何腳本

## 檔案說明（要擴充看這裡）
| 檔案 | 用途 |
|---|---|
| `js/storage.js` | **儲存層**。`LocalAdapter`（試用）與 `GitHubAdapter`，介面相同；要換成別的後端只要新增一個 adapter |
| `js/db.js` | 日記／旅程／索引的讀寫邏輯 |
| `js/calendar.js` | 月曆與年曆 |
| `js/panel.js` | 當日閱讀與編輯面板 |
| `js/trips.js`、`js/map.js` | 旅程、時間軸、地圖（Leaflet + OpenStreetMap，免金鑰） |
| `js/search.js`、`js/settings.js` | 搜尋、設定 |
| `js/md.js` | 日記檔格式（front matter）與 Markdown 轉換 |
| `css/app.css` | 所有樣式；顏色集中在最上方 `:root`，換主題只改這裡 |

## 擴充點子
- **統計**：心情趨勢、年度回顧、旅行天數／足跡地圖（資料都在 `index.json` 與 `trips.json`）
- **一天多篇**：把檔名改成 `2026-11-14-1.md`，索引改為陣列
- **旅行花費**：在 `trips.json` 的旅程加 `expenses` 欄位，旅程頁新增分頁
- **加密**：在 `db.js` 儲存前以 Web Crypto 加密內文（換取更高隱私，代價是 GitHub 上看不到明文）
- **全文搜尋**：改用 GitHub Search API，或把完整內文放進索引
- **匯出**：把某趟旅程的日記合併成 PDF／電子書（用 `trips.js` 的時間軸資料即可）
- **Obsidian 相容**：`entries/` 本身就是 Markdown，可直接用 Obsidian 或任何編輯器開啟

## 疑難排解
| 狀況 | 處理 |
|---|---|
| 連線失敗 401 | Token 錯誤或過期，重新產生 |
| 連線失敗 404 | Repo 名稱／帳號打錯，或 Token 沒有勾選該 repo |
| 儲存失敗 403／422 | Token 缺少 Contents: Read and write；或 repo 完全是空的（請先建立 README） |
| 直接在 GitHub 上新增／改了日記，月曆沒更新 | 設定 → **重建索引** |
| 更新程式碼後畫面沒變 | 重新整理一次（Service Worker 會在下次開啟時換新） |
| 地圖空白 | 需要網路載入地圖圖磚；離線時仍可閱讀與寫日記 |
