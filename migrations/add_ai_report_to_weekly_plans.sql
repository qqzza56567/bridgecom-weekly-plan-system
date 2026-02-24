-- Add ai_report JSONB column to weekly_plans table to store Gemini generated execution reports
ALTER TABLE weekly_plans ADD COLUMN ai_report JSONB;
