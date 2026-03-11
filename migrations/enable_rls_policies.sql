-- ============================================================
-- Migration: Enable Row Level Security (RLS) on all tables
-- Run this in Supabase SQL Editor AFTER deploying the app.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 員工讀取自己的 profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 員工更新自己的 profile（full_name 等）
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 主管及 Admin 可讀取所有 profile（用於顯示下屬名稱）
CREATE POLICY "Managers can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_manager = true OR p.is_admin = true)
    )
  );

-- ---------------------------------------------------------------
-- 2. user_relationships
-- ---------------------------------------------------------------
ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;

-- 主管可讀自己管理的關係
CREATE POLICY "Managers can read own relationships"
  ON public.user_relationships FOR SELECT
  USING (manager_id = auth.uid());

-- Admin 可讀/寫所有關係
CREATE POLICY "Admins can manage all relationships"
  ON public.user_relationships FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ---------------------------------------------------------------
-- 3. weekly_plans
-- ---------------------------------------------------------------
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

-- 員工可讀/寫自己的週計畫
CREATE POLICY "Users can manage own weekly plans"
  ON public.weekly_plans FOR ALL
  USING (auth.uid() = user_id);

-- 主管可讀取下屬的週計畫
CREATE POLICY "Managers can read subordinate weekly plans"
  ON public.weekly_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_relationships ur
      WHERE ur.manager_id = auth.uid() AND ur.subordinate_id = weekly_plans.user_id
    )
  );

-- 主管可更新下屬週計畫的審核欄位（status, review_comment, last_week_review, ai_report）
CREATE POLICY "Managers can update subordinate plan review fields"
  ON public.weekly_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_relationships ur
      WHERE ur.manager_id = auth.uid() AND ur.subordinate_id = weekly_plans.user_id
    )
  );

-- ---------------------------------------------------------------
-- 4. plan_tasks
-- ---------------------------------------------------------------
ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;

-- 可存取任務的條件：是任務所屬 plan 的擁有者，或是對應員工的主管
CREATE POLICY "Access plan_tasks via plan ownership"
  ON public.plan_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_plans wp
      WHERE wp.id = plan_tasks.plan_id AND (
        wp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_relationships ur
          WHERE ur.manager_id = auth.uid() AND ur.subordinate_id = wp.user_id
        )
      )
    )
  );

-- ---------------------------------------------------------------
-- 5. daily_plans
-- ---------------------------------------------------------------
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

-- 員工可讀/寫自己的每日計畫
CREATE POLICY "Users can manage own daily plans"
  ON public.daily_plans FOR ALL
  USING (auth.uid() = user_id);

-- 主管可讀取下屬的每日計畫（用於 AI 週報生成）
CREATE POLICY "Managers can read subordinate daily plans"
  ON public.daily_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_relationships ur
      WHERE ur.manager_id = auth.uid() AND ur.subordinate_id = daily_plans.user_id
    )
  );

-- ---------------------------------------------------------------
-- 6. monthly_reports
-- ---------------------------------------------------------------
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

-- Admin 可讀/寫所有月報
CREATE POLICY "Admins can manage monthly reports"
  ON public.monthly_reports FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 主管可讀取下屬的月報
CREATE POLICY "Managers can read subordinate monthly reports"
  ON public.monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_relationships ur
      WHERE ur.manager_id = auth.uid() AND ur.subordinate_id = monthly_reports.user_id
    )
  );

-- ============================================================
-- NOTE: Supabase Edge Functions use SUPABASE_SERVICE_ROLE_KEY
-- which bypasses RLS entirely. Admin operations in Edge Functions
-- (clearAllPlans, fetchAllPlans, auto-generate-plans) are safe.
-- ============================================================
