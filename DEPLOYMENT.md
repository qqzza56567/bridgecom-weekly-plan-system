# 🚀 Bridgecom 週計畫系統 - 正式上線指南

本文件旨在指導您完成從本地開發環境到正式上線的所有必要步驟。

## 🛡️ 第一階段：安全性與驗證 (Security & Auth)

### 1. Google OAuth 登入設定
系統已升級支援 Google 帳戶登入。請按照以下步驟完成設定：
1.  前往 [Google Cloud Console](https://console.cloud.google.com/)。
2.  建立一個新的專案，並進入「APIs & Services」 > 「OAuth consent screen」。
3.  設定為「Internal」（如果您有 Google Workspace）或「External」。
4.  在「Credentials」頁面建立一個 **OAuth 2.0 Client ID** (Web application)。
5.  在 Supabase Dashboard 的 **Authentication > Providers > Google** 中，填入 Client ID 與 Client Secret。
6.  將 Supabase 提供的 `Redirect URL` 複製回 Google Cloud Console 的 **Authorized redirect URIs** 中。

### 2. 資料庫權限 (RLS)
務必執行 `supabase_schema.sql` 以確保 RLS 已啟用。RLS 能確保：
- 使用者只能看到自己的計畫。
- 主管能看到下屬的計畫 (需透過 `user_relationships` 資料表定義)。
- 只有 Admin 能刪除使用者。

### 3. API Key 保護與 AI 安全
- **Supabase Anon Key**: 安全，可公開。
- **Gemini API Key**: 目前位於前端，這在開發期沒問題，但**正式上線建議移動至 Supabase Edge Function**。
    - 這樣 Key 就會儲存在 Supabase 後端，前端透過 `supabase.functions.invoke` 來呼叫驗證，避免 Key 被使用者從原始碼中擷取。

---

## 🏗️ 第二階段：部署流程 (Vercel)

### 1. 準備工作
1.  確保 `.env.local` 已列入 `.gitignore` (已預設處理)。
2.  將程式碼 Push 到你的 GitHub 私有儲存庫。

### 2. Vercel 部署步驟
1.  在 [Vercel Dashboard](https://vercel.com/) 匯入專案。
2.  在 **Environment Variables** 中設定以下變數：
    - `VITE_SUPABASE_URL`: 你的 Supabase 專案網址。
    - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase Anon Public Key。
    - `VITE_GEMINI_API_KEY`: 你的 Google Gemini API Key。
3.  點擊 **Deploy**。

---

## ✅ 第三階段：上線檢核清單 (Production Checklist)

- [ ] **身分驗證**: 測試 Google 登入是否正常。
- [ ] **資料隔離**: 使用 A 帳號登入，確認看不到 B 帳號的計畫。
- [ ] **功能檢查**: 
    - [ ] 曉三計畫 AI 驗證是否正常。
    - [ ] 關鍵職責佔比計算是否正確。
    - [ ] 成果追蹤報表是否正確呈現。
- [ ] **性能**: 確認 2025 年的大量測試資料載入時，畫面的分頁與追蹤摘要是否流暢。

---

## 🆘 常見問題排除

- **Google 登入報錯**: 通常是 `Redirect URI` 沒有在 Google Cloud Console 設定正確。
- **存取被拒 (403)**: 請檢查 Supabase 的 RLS Policy 是否有誤，或者 `profiles` 表中尚未建立對應的使用者紀錄。
- **AI 驗證失敗**: 檢查 `VITE_GEMINI_API_KEY` 是否複製正確且有無額度限制。
