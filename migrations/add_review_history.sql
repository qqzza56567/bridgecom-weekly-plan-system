-- ============================================================
-- Migration: Add review_history table for audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.review_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id     UUID REFERENCES public.weekly_plans(id) ON DELETE CASCADE NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('submitted', 'resubmitted', 'approved', 'rejected')),
    actor_id    UUID REFERENCES public.profiles(id),
    actor_name  TEXT NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_review_history_plan_id ON public.review_history(plan_id);
CREATE INDEX idx_review_history_created_at ON public.review_history(created_at DESC);

ALTER TABLE public.review_history ENABLE ROW LEVEL SECURITY;

-- 計畫擁有者可讀自己計畫的審核歷程
CREATE POLICY "Plan owners can read own review history"
    ON public.review_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.weekly_plans wp
            WHERE wp.id = review_history.plan_id AND wp.user_id = auth.uid()
        )
    );

-- 主管可讀下屬計畫的審核歷程
CREATE POLICY "Managers can read subordinate review history"
    ON public.review_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.weekly_plans wp
            JOIN public.user_relationships ur ON ur.subordinate_id = wp.user_id
            WHERE wp.id = review_history.plan_id AND ur.manager_id = auth.uid()
        )
    );

-- 寫入由 Edge Function (service_role) 或已認證使用者執行，不需要前端 INSERT 政策
-- (PlanService 呼叫時帶著 anon key，故需額外允許 INSERT)
CREATE POLICY "Authenticated users can insert review history"
    ON public.review_history FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
