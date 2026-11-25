# 日日學

非營利公益學習網站：每天為台灣國中、高中學生準備兩篇約 100 字的英語短文（可切換程度），以及一則 300 字以內、附來源與授權圖片的宜蘭歷史／地理見聞，並可一鍵列印 A4 或下載 PDF。

本專案由助理以**職員／工作帳號**託管與發布，使用者只需收到網址。請不要推送到個人 GitHub 帳號 `@shinwei0623`。

## 本機預覽

需要 Node.js 22 以上。

```bash
cd daily-learning-portal
npm install
npm run dev
```

完整建置（靜態檔在 `dist/`，可重建，原始碼不放在 dist/build 資料夾裡）：

```bash
npm run build
npm run pdf          # 需本機有 Chrome／Chromium，產出 public/pdfs 與 dist/pdfs
npm run preview
```

## 每日自動產文

GitHub Actions 於每天 **台北時間 00:30**（UTC 16:30）執行 `scripts/generate-daily.mjs`，寫入 Markdown 後建置並發布到 GitHub Pages。

若尚未設定 API 鑰匙，排程不會產新文，但仍會發布既有內容。需要在倉庫的 Secrets 設定**其中一個**：

| Secret 名稱 | 說明 |
| --- | --- |
| `GEMINI_API_KEY` | 建議。至 Google AI Studio 申請 Gemini API 鑰匙 |
| `OPENAI_API_KEY` | 備用 |

可選變數：`GEMINI_MODEL`（預設 `gemini-3.8-flash`；忙碌或不可用時會改試 `gemini-3.6-flash`、`gemini-3.5-flash-lite`）、`SITE_URL`、`BASE_PATH`（若以 `username.github.io/repo-name/` 發布，設為 `/repo-name/`）。

宜蘭見聞採「先有來源再改寫」：題目與摘錄在 `src/data/yilan-topics.json`。沒有可用授權圖片（`download_url`）的題目會被跳過，以免無圖或授權不明的內容自動上線。

英語短文由字庫抽字。`src/data/wordbank-*.json` 是精簡常用字，**不是**大考中心全文。完整官方字表請依非營利條件自行從官方 PDF 匯入。

高中範圍依大學入學考試中心《高中英文參考詞彙表》（111 學年度起適用，6,005 字）；國中依十二年國教課綱英語文領域附錄五（約 2,000 字）。字表著作權屬財團法人大學入學考試中心基金會，僅供非營利使用，轉載須註明出處。

## 發布（職員帳號）

1. 用職員 GitHub 帳號開一個**新的公開倉庫**（不要用 `@shinwei0623`）。
2. 把本目錄推上去。
3. 倉庫 Settings → Pages → Build and deployment 選 GitHub Actions。
4. 加入 `GEMINI_API_KEY` secret。
5. 若網址是 `https://<職員帳號>.github.io/<倉庫名>/`，在 Actions variables 設 `BASE_PATH=/<倉庫名>/` 與 `SITE_URL=https://<職員帳號>.github.io/<倉庫名>`。
6. 手動跑一次工作流程，確認 Pages 網址可開啟。

## 內容與版面

- `/` 今日總覽（英語可切國中／高中）
- `/english/junior/`、`/english/senior/` 與依日期的檔案頁
- `/yilan/` 與 `/yilan/YYYY-MM-DD/` 見聞頁（含列印 A4 與 PDF）
- `/resources/` 教育資源分享（只連官方免費網站）
- `/about/` 出處與授權說明

列印使用 CSS `@page { size: A4; margin: 12mm; }`，並另有列印版面與 PDF。
