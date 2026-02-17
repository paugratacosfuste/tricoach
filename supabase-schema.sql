-- ============================================
-- TriCoach AI — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Users profile (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
  weight NUMERIC(5,1),
  height INTEGER,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced', 'elite')),
  lthr INTEGER,
  threshold_pace TEXT,
  max_hr INTEGER,
  ftp INTEGER,
  swim_level TEXT CHECK (swim_level IN ('cant-swim', 'learning', 'comfortable', 'competitive')),
  weekly_availability JSONB,
  integrations JSONB,
  settings JSONB DEFAULT '{}',
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Training plans
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  race_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  race_type TEXT NOT NULL,
  goal_time TEXT,
  goal_priority TEXT CHECK (goal_priority IN ('finish', 'pb', 'podium')),
  total_weeks INTEGER NOT NULL,
  current_week_number INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weeks (current and completed)
CREATE TABLE public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  theme TEXT,
  focus TEXT,
  phase TEXT,
  total_planned_hours NUMERIC(4,1),
  is_recovery_week BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, week_number)
);

-- Workouts
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES public.weeks(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('swim', 'bike', 'run', 'strength', 'rest')) NOT NULL,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  distance NUMERIC(6,2),
  description TEXT,
  purpose TEXT,
  structure JSONB,
  heart_rate_guidance TEXT,
  pace_guidance TEXT,
  coaching_tips JSONB,
  adaptation_notes TEXT,
  status TEXT CHECK (status IN ('planned', 'completed', 'skipped', 'partial')) DEFAULT 'planned',
  actual_duration INTEGER,
  actual_distance NUMERIC(6,2),
  actual_avg_hr INTEGER,
  actual_feeling INTEGER CHECK (actual_feeling BETWEEN 1 AND 5),
  actual_notes TEXT,
  actual_rpe INTEGER CHECK (actual_rpe BETWEEN 1 AND 10),
  actual_splits JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Week feedback
CREATE TABLE public.week_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES public.weeks(id) ON DELETE CASCADE NOT NULL UNIQUE,
  overall_feeling TEXT CHECK (overall_feeling IN ('struggling', 'tired', 'okay', 'good', 'great')) NOT NULL,
  physical_issues JSONB,
  notes TEXT,
  next_week_constraints TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Training plans: users can only access their own
CREATE POLICY "Users can manage own plans" ON public.training_plans FOR ALL USING (user_id = auth.uid());

-- Weeks: users can only access weeks from their plans
CREATE POLICY "Users can access own weeks" ON public.weeks FOR ALL
  USING (plan_id IN (SELECT id FROM public.training_plans WHERE user_id = auth.uid()));

-- Workouts: users can only access workouts from their weeks
CREATE POLICY "Users can access own workouts" ON public.workouts FOR ALL
  USING (week_id IN (
    SELECT w.id FROM public.weeks w
    JOIN public.training_plans p ON w.plan_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- Week feedback: users can only access feedback from their weeks
CREATE POLICY "Users can access own feedback" ON public.week_feedback FOR ALL
  USING (week_id IN (
    SELECT w.id FROM public.weeks w
    JOIN public.training_plans p ON w.plan_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- ============================================
-- Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
