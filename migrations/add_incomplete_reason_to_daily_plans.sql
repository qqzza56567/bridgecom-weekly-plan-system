-- Migration: Add incomplete_reason column to daily_plans table
-- This field stores the reason when a user submits fewer than 3 goals

ALTER TABLE public.daily_plans 
ADD COLUMN IF NOT EXISTS incomplete_reason TEXT;

-- Add a comment to document the purpose
COMMENT ON COLUMN public.daily_plans.incomplete_reason IS 'Reason provided by user when submitting fewer than 3 daily goals';
