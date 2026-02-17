# TriCoach AI — Action Plan

> This document is designed to be consumed by an AI agent to execute changes. Every task includes exact file paths, code patterns, schemas, and verification steps.
>
> **Read `status.md` first** for full architecture and current state context.

---

## Phase 1: Foundation & Security ✅ DONE

### 1.1 Vercel API Route Proxy for Claude ✅

**Goal:** Move the Claude API key to a server-side Vercel function so it's never exposed in the client bundle.

#### Files to Create

##### [NEW] `api/generate-week.ts`
Vercel serverless function that:
1. Receives a POST request with the body: `{ prompt: string }`
2. Reads `ANTHROPIC_API_KEY` from `process.env` (Vercel environment variable, NOT prefixed with `VITE_`)
3. Calls `https://api.anthropic.com/v1/messages` with:
   - Model: `claude-sonnet-4-20250514`
   - Max tokens: 8000
   - The prompt from the request body
   - Headers: `x-api-key`, `anthropic-version: 2023-06-01` (do NOT include `anthropic-dangerous-direct-browser-access`)
4. Returns the Claude response JSON to the client
5. Handles errors: return appropriate HTTP status codes (401, 429, 500) with error messages

```typescript
// Exact structure:
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json(data);
}
```

##### [NEW] `vercel.json`
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

#### Files to Modify

##### [MODIFY] `src/lib/claudeApi.ts`
- **Remove** lines 20-21: `const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;` and `const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';`
- **Change** the `generateWeekPlan()` function (line 409-461) to:
  - Remove the API key check
  - Build the prompt string using `buildWeekPrompt()` (already done)
  - Call `/api/generate-week` instead of the Anthropic URL directly
  - Remove `anthropic-dangerous-direct-browser-access` header
  - Keep the response parsing logic (`parseWeekResponse`) unchanged

Exact change in `generateWeekPlan()`:
```typescript
// Replace the fetch call (lines 431-444) with:
const response = await fetch('/api/generate-week', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt }),
});
```

##### [MODIFY] `.env.local`
- Remove `VITE_ANTHROPIC_API_KEY=...` (this key must be added to Vercel's environment variables dashboard instead, named `ANTHROPIC_API_KEY` without the `VITE_` prefix)

#### Verification
- Run `npm run build` — should succeed without VITE_ANTHROPIC_API_KEY reference
- Deploy to Vercel, set `ANTHROPIC_API_KEY` in Vercel → Project Settings → Environment Variables
- Complete onboarding flow → Week 1 should generate via the API route
- Check the browser DevTools Network tab: requests should go to `/api/generate-week`, NOT to `api.anthropic.com`
- Inspect the built JS bundle to confirm the API key is not present

---

### 1.2 Supabase Database ✅

**Goal:** Persist all data in Supabase instead of localStorage.

#### Prerequisites
- Create a Supabase project at https://supabase.com
- Note the project URL and anon key
- Install: `npm install @supabase/supabase-js`

#### Files to Create

##### [NEW] `src/lib/supabase.ts`
Supabase client initialization:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

##### [NEW] SQL migrations — run in Supabase SQL Editor

```sql
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
  weekly_availability JSONB,  -- stores WeeklyAvailability object
  integrations JSONB,         -- stores Integrations object
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
  duration INTEGER NOT NULL,                  -- minutes
  distance NUMERIC(6,2),                      -- km
  description TEXT,
  purpose TEXT,
  structure JSONB,                            -- WorkoutSegment[]
  heart_rate_guidance TEXT,
  pace_guidance TEXT,
  coaching_tips JSONB,                        -- string[]
  adaptation_notes TEXT,
  status TEXT CHECK (status IN ('planned', 'completed', 'skipped', 'partial')) DEFAULT 'planned',
  -- Actual data (filled on completion)
  actual_duration INTEGER,
  actual_distance NUMERIC(6,2),
  actual_avg_hr INTEGER,
  actual_feeling INTEGER CHECK (actual_feeling BETWEEN 1 AND 5),
  actual_notes TEXT,
  actual_rpe INTEGER CHECK (actual_rpe BETWEEN 1 AND 10),
  actual_splits JSONB,                        -- for future detailed logging
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Week feedback
CREATE TABLE public.week_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES public.weeks(id) ON DELETE CASCADE NOT NULL UNIQUE,
  overall_feeling TEXT CHECK (overall_feeling IN ('struggling', 'tired', 'okay', 'good', 'great')) NOT NULL,
  physical_issues JSONB,                      -- string[]
  notes TEXT,
  next_week_constraints TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own plans" ON public.training_plans FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can access own weeks" ON public.weeks FOR ALL
  USING (plan_id IN (SELECT id FROM public.training_plans WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own workouts" ON public.workouts FOR ALL
  USING (week_id IN (SELECT w.id FROM public.weeks w JOIN public.training_plans p ON w.plan_id = p.id WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can access own feedback" ON public.week_feedback FOR ALL
  USING (week_id IN (SELECT w.id FROM public.weeks w JOIN public.training_plans p ON w.plan_id = p.id WHERE p.user_id = auth.uid()));

-- Auto-create profile on signup
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
```

#### Files to Modify

##### [MODIFY] `src/contexts/TrainingContext.tsx`
- Replace all `localStorage` read/write functions (`savePlanToStorage`, `loadPlanFromStorage`, `saveUserDataToStorage`, `loadUserDataFromStorage`) with Supabase queries
- The `initializePlan` function should:
  1. Insert into `training_plans`
  2. Insert into `weeks` (week 1)
  3. Insert into `workouts` (all workouts for week 1)
- The `updateWorkoutStatus` function should update the workout row in Supabase
- The `generateNextWeek` function should:
  1. Insert feedback into `week_feedback`
  2. Mark current week as `is_completed = true`
  3. Insert new week and workouts
- Keep localStorage as offline fallback / cache

##### [MODIFY] `src/contexts/OnboardingContext.tsx`
- Replace `localStorage` read/write with Supabase `profiles` table operations
- `completeOnboarding` should update `profiles.onboarding_complete = true`

##### [MODIFY] `.env.local`
Add:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Verification
- Sign up a new user → profile row should appear in `profiles` table
- Complete onboarding → profile should have fitness data populated
- Generate week 1 → rows in `training_plans`, `weeks`, and `workouts` tables
- Mark a workout complete → `workouts` row should update
- Complete week review → `week_feedback` row created, new week generated
- Clear localStorage → reload → data should still be there from Supabase

---

### 1.3 Authentication (Supabase Auth) ✅

**Goal:** Email/password signup with email confirmation.

#### Supabase Dashboard Config
- Go to Authentication → Settings
- Enable email confirmations
- Set the site URL (your Vercel deployment URL)
- Set redirect URLs for confirmation emails

#### Files to Create

##### [NEW] `src/contexts/AuthContext.tsx`
```typescript
// Provides:
// - user: User | null
// - session: Session | null
// - isLoading: boolean
// - signUp(email, password, firstName): Promise — calls supabase.auth.signUp()
// - signIn(email, password): Promise — calls supabase.auth.signInWithPassword()
// - signOut(): Promise — calls supabase.auth.signOut()
// - resetPassword(email): Promise

// On mount: supabase.auth.getSession() + supabase.auth.onAuthStateChange()
```

##### [NEW] `src/pages/LoginPage.tsx`
- Email + password form
- "Don't have an account? Sign up" link
- "Forgot password?" link
- Error handling for invalid credentials

##### [NEW] `src/pages/SignupPage.tsx`
- Email + password + first name form
- Password requirements (min 8 chars)
- On submit: call `signUp()` → show "Check your email for confirmation" message
- "Already have an account? Log in" link

##### [NEW] `src/pages/ConfirmEmailPage.tsx`
- Simple page shown after signup: "Please check your email to confirm your account"
- Auto-redirect to login once confirmed

##### [NEW] `src/components/ProtectedRoute.tsx`
```typescript
// Wraps routes that require authentication
// If not authenticated → redirect to /login
// If authenticated but not onboarded → redirect to /
// Shows loading spinner while auth state is resolving
```

#### Files to Modify

##### [MODIFY] `src/App.tsx`
- Wrap everything in `<AuthProvider>`
- Add routes: `/login`, `/signup`, `/confirm-email`
- Wrap protected routes with `<ProtectedRoute>`
- New route structure:
  ```
  /login          → LoginPage (public)
  /signup         → SignupPage (public)
  /confirm-email  → ConfirmEmailPage (public)
  /               → ProtectedRoute → Index (onboarding or dashboard)
  /dashboard      → ProtectedRoute → Dashboard
  /calendar       → ProtectedRoute → CalendarPage
  /progress       → ProtectedRoute → ProgressPage
  /goals          → ProtectedRoute → GoalsPage
  /settings       → ProtectedRoute → SettingsPage
  /profile        → ProtectedRoute → ProfilePage
  ```

#### Verification
- Visit `/dashboard` without logging in → should redirect to `/login`
- Sign up with an email → should receive confirmation email
- Try to log in before confirming → should get error
- Confirm email → log in → should reach onboarding/dashboard
- Log out → should redirect to `/login`
- Refresh page while logged in → should stay authenticated (session persists)

---

### 1.4 Cleanup ✅

#### Files to Modify/Delete

##### [DELETE] `src/lib/mockPlanGenerator.ts`
Remove entirely. It uses an outdated type shape and is never imported.

##### [MODIFY] Multiple files
Remove all `console.log` statements used for debugging (search for `console.log` across `src/`). Keep `console.error` and `console.warn` for actual error handling.

##### [NEW] `src/components/ErrorBoundary.tsx`
A React error boundary component that:
- Catches render errors
- Shows a friendly UI with "Something went wrong" message
- Has a "Try Again" button that reloads the page
- Has a "Reset Data" button that clears localStorage and signs out

##### [MODIFY] `src/App.tsx`
Wrap the router in `<ErrorBoundary>`.

---

## Phase 2: Core Experience Polish

### 2.1 Multi-Week History Browser

##### [NEW] `src/pages/HistoryPage.tsx`
- Query all completed weeks from `weeks` table (where `is_completed = true`)
- Display as a vertical timeline or list
- Each week shows: week number, phase, theme, completion rate, feeling
- Click a week → expand to show all workouts with their status and actual data
- Add route `/history` to `App.tsx`
- Add "History" to sidebar/mobile nav

### 2.2 Profile ↔ Training Sync

##### [MODIFY] `src/pages/ProfilePage.tsx`
- When user changes fitness metrics and saves:
  1. Update `profiles` table in Supabase
  2. Show an alert dialog: "Your fitness metrics have changed. Would you like to regenerate next week's training plan with the updated data?"
  3. If yes → call `generateNextWeek()` from `TrainingContext` with updated user data
  4. Update `TrainingContext.userData` to stay in sync

### 2.3 Workout Detail Logging

##### [MODIFY] `src/components/dashboard/WorkoutDetailSheet.tsx`
Expand the completion flow. When clicking "Mark Complete", show an expanded form:
- **Actual duration** (pre-filled from planned)
- **Actual distance** (pre-filled from planned)
- **Average HR** (optional, number input)
- **RPE** (1-10 scale with labeled buttons, e.g. 1=Very Easy, 10=Maximal)
- **Split times** (optional, text area for free-form input)
- **Notes** (free-text)

Store all data in the `workouts` table columns: `actual_duration`, `actual_distance`, `actual_avg_hr`, `actual_feeling`, `actual_rpe`, `actual_notes`, `actual_splits`.

### 2.4 Workout Editing & Rescheduling

##### [MODIFY] `src/pages/CalendarPage.tsx`
- Implement drag-and-drop using a library (e.g., `@dnd-kit/core`) for workouts between days
- On drop to a different day:
  1. Show an `AlertDialog`: "Sticking to your planned schedule leads to better results. Are you sure you want to move this workout?"
  2. If confirmed → update the workout's `date` in Supabase

##### [NEW] `src/components/RegeneratePlanDialog.tsx`
- Dialog with a **mandatory** text area for the athlete to explain what's wrong with the current plan
- "Regenerate Plan" button disabled until text area has content (minimum 10 characters)
- On submit → send the comment as `nextWeekConstraints` to `generateNextWeek()`
- Accessible from Dashboard (add a "Request Plan Change" button)

### 2.5 Goal Editing with Replanning

##### [MODIFY] `src/pages/GoalsPage.tsx`
- Add "Edit Goal" button that enables editing fields: race name, race date, target time, race type, priority
- On save:
  1. Update `training_plans` table
  2. Recalculate `total_weeks` from new race date
  3. Show confirmation: "Your goal has changed. Next week's plan will be regenerated with the updated goal."
  4. Mark current week as completed and trigger `generateNextWeek()` with updated plan data

### 2.6 Settings Persistence

##### [MODIFY] `src/pages/SettingsPage.tsx`
- Store settings in Supabase `profiles` table (add a `settings JSONB` column) or in localStorage for non-critical preferences
- Dark mode: use `next-themes` (already installed) and persist choice
- Notification toggles: store state, wire up when push notifications are implemented later

### 2.7 Test Suite

##### [NEW] `src/lib/__tests__/claudeApi.test.ts`
- Test `fixTruncatedJson()` with various malformed JSON strings
- Test `parseWeekResponse()` with sample Claude responses
- Test `buildHistoryContext()` with mock completed weeks
- Test `createWeekSummary()` with mock week data

##### [NEW] `src/contexts/__tests__/TrainingContext.test.tsx`
- Test `initializePlan()` creates correct plan structure
- Test `updateWorkoutStatus()` updates the right workout
- Test `getWorkoutsForDate()` returns correct workouts
- Test `generateNextWeek()` moves current week to completed

##### [NEW] `src/components/onboarding/__tests__/OnboardingWizard.test.tsx`
- Test step navigation (next/previous)
- Test data persistence between steps
- Test form validation

**Run tests with:** `npm run test`

---

## Phase 3: Integrations (Future — Not for immediate implementation)

### Strava OAuth
- Register app on Strava developer portal
- Implement OAuth2 flow via Vercel API route (`/api/strava/auth`, `/api/strava/callback`)
- Store Strava tokens in `profiles` table
- Create `/api/strava/activities` to fetch recent activities
- Auto-match activities to planned workouts by date + type + approximate distance

### Google Calendar
- Register app in Google Cloud Console
- Implement OAuth2 flow via Vercel API route
- Push workouts as calendar events on plan generation
- Read existing events to check for conflicts before scheduling

### Garmin Connect (Stretch Goal)
- More complex API requiring a Consumer Key approval process
- Similar flow to Strava once approved

---

## Phase 4: Intelligence & Analytics (Future)

- Rich progress dashboard with Recharts: weekly volume stacked bars, discipline pie chart, completion line chart
- Training load monitoring: simplified TSS from duration × RPE
- AI coaching insights: periodic Claude analysis of training history
- Race readiness score: weighted combination of completion rate, load progression, time remaining
- Nutrition/recovery tips: phase-aware AI suggestions

---

## Phase 5: Social & Advanced (Future)

- PDF export of training plans
- Social sharing of milestones
- Push notifications (Web Push API + service worker)
- Multi-race support (multiple active plans)
- Coach mode (read-only view with override capability)
- PWA with offline support
