# HSU — 攝影師形象網站

車輛 · 風景 · 動物 · 活動 的攝影與影像作品集。純靜態網站，部署於 GitHub Pages。

🔗 **網站：** https://jung217.github.io/hsu/

---

## 我要怎麼維護？（三件常做的事）

### 1. 填上你的 Instagram（聯繫按鈕）
打開 `assets/js/main.js`，最上面這幾行改一改就好：

```js
const SITE = {
  instagram: "https://www.instagram.com/你的帳號/",
  instagramHandle: "@你的帳號",
  email: "",   // 想顯示 Email 就填，例如 "hsu@example.com"；留空就不顯示
};
```

### 2. 補上 YouTube 影片連結
影片全部走 YouTube 嵌入。打開 `assets/data/videos.json`，把每支影片的 `youtubeId` 換成你的 YouTube 影片 ID：

- 網址 `https://youtu.be/AbC123xyz` → ID 是 `AbC123xyz`
- 網址 `https://www.youtube.com/watch?v=AbC123xyz` → ID 是 `AbC123xyz`

```json
{ "title": "FPV", "youtubeId": "AbC123xyz", "orientation": "landscape" }
```

`orientation` 填 `landscape`（橫向 16:9）或 `vertical`（直向 9:16，Shorts/Reels）。
`youtubeId` 留空會顯示「待補連結」佔位卡，不影響網站運作。

### 3. 新增 / 更換照片
1. 把原圖丟進 `作品集/照/` 對應的分類資料夾（`車`、`風景`、`動物`、`活動`；`車` 下可再分車款子資料夾）。
2. 執行優化指令，會自動壓縮、產生縮圖、更新清單：
   ```bash
   npm install      # 第一次才需要
   npm run optimize
   ```
3. `git add . && git commit && git push`，GitHub Pages 會自動更新。

> 原圖放在 `作品集/`（已被 `.gitignore` 排除，不會上傳）。網站實際用的是 `assets/photos/` 裡壓好的版本。

---

## 本機預覽
因為網站會用 `fetch` 載入 JSON，必須透過本機伺服器開（不能直接雙擊 index.html）：

```bash
npx serve .
# 或
python -m http.server 8000
```
然後瀏覽 `http://localhost:8000/`。

---

## 技術備註
- 純 HTML / CSS / 原生 JavaScript，無打包工具、無框架。
- 圖片優化用 [`sharp`](https://sharp.pixelplumbing.com/)（見 `scripts/optimize.mjs`）。
- 所有資源路徑為相對路徑，可直接放在 GitHub Pages 專案頁的子路徑（`/hsu/`）下。
- 影片不佔 repo 空間（YouTube 串流），照片總量已從約 1.2GB 壓到約 22MB。

## 授權
程式碼依 `LICENSE`。照片與影片版權皆屬 HSU 所有。
