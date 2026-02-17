# TriCoach AI — Project Status

> Last updated: 2026-02-17

---

## 1. What Is TriCoach AI

An AI-powered triathlon and running coaching application that generates personalized weekly training plans using the Claude API. The app takes an athlete through onboarding, creates a tailored first week, and then adapts subsequent weeks based on end-of-week feedback — forming a continuous coaching loop.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Vite + React 18 | SPA, no SSR |
| **Language** | TypeScript | Strict types across the codebase |
| **UI Components** | shadcn/ui (49 components) | Built on Radix UI primitives |
| **Styling** | Tailwind CSS 3.x | Custom theme tokens (sport colors, gradients) |
| **Routing** | React Router DOM v6 | 11 routes in `App.tsx` (3 public + 8 protected) |
| **State Management** | React Context API | 3 contexts: `AuthContext`, `TrainingContext`, `OnboardingContext` |
| **Data Persistence** | Supabase (PostgreSQL) | Full schema with RLS; localStorage as offline cache |
| **Authentication** | Supabase Auth | Email/password with email confirmation |
| **AI Integration** | Claude API (Sonnet 4) | Server-side proxy via Vercel serverless function |
| **Backend** | Vercel Serverless Functions | API route at `/api/generate-week` |
| **Charts** | Recharts | Used in Progress page |
| **Animation** | Framer Motion | Used for transitions and micro-animations |
| **Forms** | React Hook Form + Zod | Used in onboarding |
| **Package Manager** | npm | |
| **Error Handling** | React ErrorBoundary | Global error boundary with recovery UI |

---

## 3. Architecture

### 3.1 Application Flow

```
[Login/Signup] → [Email Confirmation] → [Login]
                                            ↓
[Welcome Screen] → [Onboarding Wizard (5 steps)] → [Vercel API Proxy → Claude generates Week 1]
                                                             ↓
[Dashboard] ← shows current week → [Calendar Page]
    ↓
[Complete Workouts] → basic status toggle (complete/skip)
    ↓
[End-of-Week Review] → feeling + physical issues + constraints
    ↓
[Vercel API Proxy → Claude generates next week] → back to Dashboard
```

### 3.2 Security Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  React App  │────▶│  /api/generate-  │────▶│  Claude API  │
│ (browser)   │     │  week (Vercel)   │     │              │
│             │     │  ANTHROPIC_API_  │     └──────────────┘
│ No API key  │     │  KEY (server-    │
│ exposed     │     │  side only)      │
└──────┬──────┘     └──────────────────┘
       │
       │  Supabase Auth (JWT)
       ▼
┌──────────────┐
│  Supabase    │
│  PostgreSQL  │
│  + RLS       │
└──────────────┘
```

### 3.3 File Structure

```
tricoach-ai/
├── api/
│   └── generate-week.ts                 # Vercel serverless Claude proxy
├── src/
│   ├── App.tsx                          # AuthProvider → OnboardingProvider → TrainingProvider → Router
│   ├── main.tsx                         # Entry point
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx               # Email/password login (orange palette)
│   │   ├── SignupPage.tsx              # Registration with email confirmation (orange palette)
│   │   ├── ConfirmEmailPage.tsx        # Post-signup verification page (orange palette)
│   │   ├── Index.tsx                   # Gate: welcome → onboarding → dashboard
│   │   ├── Dashboard.tsx               # Main training view (current week)
│   │   ├── CalendarPage.tsx            # Calendar view of workouts (no drag-and-drop yet)
│   │   ├── ProgressPage.tsx            # Basic analytics with Recharts
│   │   ├── GoalsPage.tsx               # Race goal display (read-only)
│   │   ├── SettingsPage.tsx            # Integrations UI (not wired), sign out
│   │   ├── ProfilePage.tsx             # Fitness metrics display and edit (no Supabase persist)
│   │   └── NotFound.tsx                # 404
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx              # Supabase auth state (signup with dup detection, login, logout)
│   │   ├── TrainingContext.tsx          # Plan state + Supabase persistence + localStorage cache
│   │   └── OnboardingContext.tsx        # Onboarding wizard state + Supabase profile sync
│   │
│   ├── components/
│   │   ├── ProtectedRoute.tsx          # Auth route guard → redirect to /login
│   │   ├── ErrorBoundary.tsx           # Global error boundary with recovery UI
│   │   ├── WeekReview.tsx              # End-of-week feedback dialog
│   │   ├── dashboard/
│   │   │   ├── DashboardLayout.tsx     # Layout wrapper
│   │   │   ├── Sidebar.tsx             # Desktop navigation sidebar
│   │   │   ├── MobileNav.tsx           # Mobile bottom navigation
│   │   │   ├── WeeklyStrip.tsx         # Horizontal day strip
│   │   │   ├── WorkoutCard.tsx         # Workout summary card
│   │   │   └── WorkoutDetailSheet.tsx  # Workout detail slide-out (no logging form)
│   │   ├── onboarding/                 # 5-step wizard
│   │   └── ui/                         # 49 shadcn/ui components
│   │
│   ├── lib/
│   │   ├── claudeApi.ts                # AI prompt building + /api/generate-week proxy calls
│   │   ├── supabase.ts                 # Supabase client initialization
│   │   └── utils.ts                    # cn() utility
│   │
│   └── types/
│       └── training.ts                 # Full type system
│
├── supabase-schema.sql                  # Full DB schema + RLS + triggers
├── vercel.json                          # API rewrite rules + SPA routing
└── package.json
```

### 3.4 Database Schema

```
profiles          ← extends auth.users, stores fitness data + onboarding state + settings JSONB
training_plans    ← race goals, one active plan per user
weeks             ← individual training weeks (current + completed)
workouts          ← daily workout details + actual completion data columns (mostly unused)
week_feedback     ← end-of-week athlete feedback
```

All tables have Row Level Security (RLS) ensuring users can only access their own data. A database trigger auto-creates a profile row on user signup.

### 3.5 Data Model (from `types/training.ts`)

```
OnboardingData
├── UserProfile          { firstName, age, gender, weight, height }
├── FitnessAssessment    { fitnessLevel, lthr, thresholdPace, maxHR, ftp?, swimLevel }
├── RaceGoal             { raceType, raceName, raceDate, goalTime?, priority, customDistances? }
├── WeeklyAvailability   { monday..sunday: DayAvailability, weeklyHoursTarget }
└── Integrations         { googleCalendar: { connected, avoidConflicts }, strava: { connected, autoComplete } }

TrainingPlan
├── id, createdAt, raceName, raceDate, raceType, totalWeeks
├── currentWeekNumber
├── currentWeek: WeekPlan | null
│   ├── weekNumber, startDate, endDate, theme, focus, phase
│   ├── totalPlannedHours, isRecoveryWeek
│   └── workouts: Workout[]
│       ├── id, date, type, name, duration, distance?, description, purpose
│       ├── structure: WorkoutSegment[], heartRateGuidance, paceGuidance
│       ├── coachingTips[], adaptationNotes
│       ├── status: 'planned' | 'completed' | 'skipped' | 'partial'
│       └── actualData?: { duration, distance?, avgHR?, feeling: 1-5, notes? }
└── completedWeeks: CompletedWeek[]
    └── (same as WeekPlan + WeekSummary with feedback)
```

### 3.6 Claude API Integration (`claudeApi.ts`)

The app calls Claude via a **Vercel serverless proxy** at `/api/generate-week`:
- Model: `claude-sonnet-4-20250514`
- Max tokens: 8,000
- API key stored server-side only (Vercel environment variable)

**Prompt structure** includes: athlete profile, HR zones (calculated from LTHR), race goal, training context (week number, phase, recovery week flags, fatigue warnings), compressed training history, weekly availability per day, and triathlon-specific discipline distribution rules.

**Response parsing** includes a `fixTruncatedJson()` function that handles incomplete JSON responses by counting brackets and auto-closing them.

### 3.7 Helper Functions in Type System

- `calculateHRZones(lthr)` — 5-zone model based on LTHR percentage
- `calculateTrainingPhase(currentWeek, totalWeeks)` — Maps to: Base → Build 1 → Build 2 → Peak → Taper → Race Week
- `isRecoveryWeek(weekNumber)` — Every 4th week is recovery/deload

---

## 4. Feature Status

### ✅ Fully Implemented (Phase 1)

- **Authentication** — Email/password signup with duplicate user detection, email confirmation, login, logout, session persistence
- **Protected routes** — Unauthenticated users redirected to login, loading spinner while auth resolves
- **Server-side API proxy** — Claude API key never exposed to client, calls proxied through Vercel
- **Supabase database** — Full schema with RLS, profiles, plans, weeks, workouts, feedback tables
- **Data persistence** — Supabase as primary store, localStorage as offline cache/fallback
- **Onboarding wizard** — 5-step flow with Supabase profile sync on completion
- **AI plan generation** — Triathlon-aware prompts, JSON parsing with error recovery, week-by-week adaptation
- **Dashboard** — Current week display, today's workout highlight, upcoming workouts, weekly progress ring
- **Basic workout actions** — Mark complete / skip (status toggle only, no detailed logging)
- **Week review & next week generation** — Feedback dialog → Claude → new adaptive week
- **Calendar page** — Monthly view with color-coded workout indicators
- **Progress page** — Basic charts (bar chart, line chart) with Recharts
- **Settings page** — Sign out, UI for toggles (not persisted to DB)
- **Profile page** — View/edit fitness metrics (not persisted to Supabase on save)
- **Goals page** — Display race goal information (read-only)
- **Error boundary** — Global error boundary with "Try Again" and "Reset Data" recovery
- **Branding** — Custom TriCoach favicon, orange auth pages, all Lovable branding removed

### 🔨 Phase 2: Core Experience Polish (NOT YET STARTED)

- Detailed workout completion logging (actual HR, RPE, duration, notes)
- Actual vs planned comparison display
- Multi-week history browser page
- Profile ↔ Training sync (Supabase persist + replanning trigger)
- Workout rescheduling (move between days)
- Plan change requests (RegeneratePlanDialog)
- Goal editing with automatic replanning
- Settings persistence to Supabase
- Unit test suite

### 🔮 Phase 3: Integrations (NOT YET STARTED)

- Strava OAuth + activity auto-sync
- Google Calendar event push + conflict avoidance
- Garmin Connect activity sync (stretch goal)

### 🔮 Phase 4: Intelligence & Analytics (NOT YET STARTED)

- Enhanced progress dashboard (volume stacked bars, discipline pie, completion trend)
- Training load monitoring (simplified TSS)
- Race readiness score (0-100)
- AI coaching insights (periodic Claude analysis)

### 🔮 Phase 5: Social & Advanced (NOT YET STARTED)

- PDF export of training plans
- Push notifications (Web Push API + service worker)
- Multi-race support with plan switching
- PWA with offline support
- Coach mode (read-only shared view)
- Social sharing of milestones

---

## 5. Resolved Issues

All Phase 1 technical issues have been addressed:

1. ~~**🔴 API Key in Frontend**~~ → ✅ Moved to server-side Vercel serverless function
2. ~~**🔴 No Data Backup**~~ → ✅ Supabase PostgreSQL with RLS; localStorage as cache
3. ~~**🟡 `mockPlanGenerator.ts` dead code**~~ → ✅ Deleted
4. ~~**🟡 No error boundaries**~~ → ✅ Global ErrorBoundary with recovery UI
5. ~~**🟡 Lovable branding**~~ → ✅ Removed from all code, config, and assets
6. ~~**🟡 Duplicate user detection**~~ → ✅ Signup checks for empty identities array
7. ~~**🟡 Auth page colors**~~ → ✅ Recolored from blue to orange palette
8. **🟡 Date timezone edge cases** — Partially mitigated but may still affect users in extreme timezone offsets

## 6. Known Limitations

- **Profile edits don't persist to Supabase** — Changes update local context only (Phase 2 fix)
- **No detailed workout logging** — Complete/skip is a status toggle, no actual data capture (Phase 2 fix)
- **Settings don't persist** — UI toggles reset on reload (Phase 2 fix)
- **Goals are read-only** — No editing capability (Phase 2 fix)
- **No history browser** — Can only see current week (Phase 2 fix)
- **No workout rescheduling** — Cannot move workouts between days (Phase 2 fix)
