-- ============================================================
-- Fix: Add missing INSERT policy for profiles table
-- ============================================================

-- 允許已登入的用戶在 profiles 表中建立自己的個人檔案（註冊時使用）
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
