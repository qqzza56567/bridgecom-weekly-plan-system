-- ============================================================
-- Fix: Resolve Infinite Recursion in RLS Policies
-- ============================================================

-- 建立一個繞過 RLS 的輔助函數 (SECURITY DEFINER)，
-- 用來安全地查詢當前用戶的權限，避免在 profiles 自身的 Policy 中產生無限遞迴查詢
CREATE OR REPLACE FUNCTION public.get_user_role(query_uid uuid)
RETURNS TABLE (is_manager boolean, is_admin boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_manager, is_admin FROM profiles WHERE id = query_uid;
$$;

-- 移除原本會導致無限遞迴的 Policy
DROP POLICY IF EXISTS "Managers can read all profiles" ON public.profiles;

-- 重建不具遞迴危險的 Policy
CREATE POLICY "Managers can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.get_user_role(auth.uid())
      WHERE is_manager = true OR is_admin = true
    )
  );

-- 將其他有使用到隱式 profile 查詢的 Admin 管理權限 Policy 一併更新為安全寫法
DROP POLICY IF EXISTS "Admins can manage all relationships" ON public.user_relationships;
CREATE POLICY "Admins can manage all relationships"
  ON public.user_relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.get_user_role(auth.uid())
      WHERE is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage monthly reports" ON public.monthly_reports;
CREATE POLICY "Admins can manage monthly reports"
  ON public.monthly_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.get_user_role(auth.uid())
      WHERE is_admin = true
    )
  );
