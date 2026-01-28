-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Sync with Supabase Auth or Standalone)
-- Note: In a real Supabase app, we often use the 'auth.users' table trigger to populate a 'public.profiles' table.
-- For simplicity, we create a 'profiles' table to store application-specific user data.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Maps to auth.users.id if using Supabase Auth
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    is_manager BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Relationships (Hierarchy)
-- Stores who reports to whom.
CREATE TABLE public.user_relationships (
    manager_id UUID REFERENCES public.profiles(id),
    subordinate_id UUID REFERENCES public.profiles(id),
    PRIMARY KEY (manager_id, subordinate_id)
);

-- 3. Weekly Plans Table
CREATE TABLE public.weekly_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    user_name TEXT, -- Snapshot of user name at time of creation (optional, or join profiles)
    
    week_start_date DATE NOT NULL, -- The Wednesday start date (YYYY-MM-DD)
    week_range_label TEXT NOT NULL, -- e.g "1月7日 - 1月13日"
    
    status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'draft',
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    review_comment TEXT, -- Comment from manager
    
    total_hours NUMERIC(5, 2) DEFAULT 0,
    key_ratio NUMERIC(5, 2) DEFAULT 0,
    
    remark TEXT, -- User remark for low hours/ratio
    
    -- "Last Week Review" JSONB structure
    -- Storing this as JSONB is flexible since it's a snapshot of the previous week's performance
    last_week_review JSONB
);

-- 4. Tasks Table (The items within a weekly plan)
CREATE TABLE public.plan_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('關鍵職責', '其他事項')),
    priority TEXT CHECK (priority IN ('高', '中', '低')),
    outcome TEXT,
    
    estimated_hours NUMERIC(4, 2) DEFAULT 0,
    actual_hours NUMERIC(4, 2) DEFAULT 0,
    progress INTEGER DEFAULT 0,
    not_done_reason TEXT,
    status TEXT CHECK (status IN ('open', 'in_progress', 'on_hand', 'done')) DEFAULT 'open',
    last_touched_at DATE,
    
    sort_order INT DEFAULT 0
);

-- 5. Daily Plans Table
CREATE TABLE public.daily_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    date DATE NOT NULL,
    goals JSONB DEFAULT '[]'::JSONB, -- Storing list of strings/objects
    
    status TEXT CHECK (status IN ('Valid', 'Invalid')) DEFAULT 'Valid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies (Examples)
-- These ensure security at the database level.

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own plans
-- CREATE POLICY "Users can view own plans" ON public.weekly_plans
-- FOR SELECT USING (auth.uid() = user_id);

-- Policy: Managers can see subordinates' plans
-- (This requires a recursive query or a helper function in Supabase usually)
