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
| **Testing** | Vitest + Testing Library | Test suite for core logic |
| **Error Handling** | React ErrorBoundary | Global error boundary with recovery UI |

---

## 3. Architecture

### 3.1 Application Flow

```
[Login/Signup] → [Email Confirmation] → [Login]
                                            ↓
[Welcome Screen] → [Onboarding Wizard (5 steps)] → [Vercel API Proxy → Claude generates Week 1]
                                                             ↓
[Dashboard] ← shows current week → [Calendar Page] (drag-and-drop rescheduling)
    ↓
[Complete Workouts] → detailed logging: actual HR, RPE, splits, notes
    ↓
[End-of-Week Review] → feeling + physical issues + constraints
    ↓
[Vercel API Proxy → Claude generates next week] → back to Dashboard
    ↓
[Progress Page] → training load, volume charts, race readiness, AI insights
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
│   │   ├── LoginPage.tsx               # Email/password login
│   │   ├── SignupPage.tsx              # Registration with email confirmation
│   │   ├── ConfirmEmailPage.tsx        # Post-signup verification page
│   │   ├── Index.tsx                   # Gate: welcome → onboarding → dashboard
│   │   ├── Dashboard.tsx               # Main training view
│   │   ├── CalendarPage.tsx            # Calendar with drag-and-drop
│   │   ├── ProgressPage.tsx            # Analytics, training load, charts
│   │   ├── GoalsPage.tsx               # Race goal management (editable)
│   │   ├── SettingsPage.tsx            # Integrations, notifications, sign out
│   │   ├── ProfilePage.tsx             # Fitness metrics (syncs to training)
│   │   └── NotFound.tsx                # 404
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx              # Supabase auth state (signup, login, logout, reset password)
│   │   ├── TrainingContext.tsx          # Plan state + Supabase persistence + localStorage cache
│   │   └── OnboardingContext.tsx        # Onboarding wizard state + Supabase profile sync
│   │
│   ├── components/
│   │   ├── ProtectedRoute.tsx          # Auth route guard → redirect to /login
│   │   ├── ErrorBoundary.tsx           # Global error boundary with recovery UI
│   │   ├── dashboard/                  # Dashboard widgets and layouts
│   │   ├── onboarding/                 # 5-step wizard
│   │   ├── WeekReview.tsx              # End-of-week feedback dialog
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
├── vercel.json                          # API rewrite rules
└── package.json
```

### 3.4 Database Schema

```
profiles          ← extends auth.users, stores fitness data + onboarding state
training_plans    ← race goals, one active plan per user
weeks             ← individual training weeks (current + completed)
workouts          ← daily workout details + actual completion data
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

### ✅ Fully Implemented (Phases 1–4)

- **Authentication** — Email/password signup with email confirmation, login, logout, password reset, session persistence
- **Protected routes** — Unauthenticated users redirected to login, loading spinner while auth resolves
- **Server-side API proxy** — Claude API key never exposed to client, calls proxied through Vercel
- **Supabase database** — Full schema with RLS, profiles, plans, weeks, workouts, feedback tables
- **Data persistence** — Supabase as primary store, localStorage as offline cache/fallback
- **Onboarding wizard** — 5-step flow with Supabase profile sync on completion
- **AI plan generation** — Triathlon-aware prompts, JSON parsing with error recovery, week-by-week adaptation
- **Dashboard** — Current week display, today's workout, upcoming workouts, weekly progress ring
- **Workout actions** — Mark complete/skip with detailed logging (actual HR, RPE, splits, notes)
- **Actual vs. planned comparison** — Post-completion data displayed against planned targets
- **Week review & next week generation** — Feedback dialog → Claude → new adaptive week
- **Calendar page** — Monthly view with color-coded workouts, drag-and-drop rescheduling with alerts
- **Multi-week history browser** — Browse completed weeks with full workout detail
- **Profile ↔ Training sync** — Fitness metric changes trigger replanning prompt
- **Goal editing** — Change race date/type/target → automatic replanning
- **Plan change requests** — "Request Plan Change" with mandatory comment
- **Progress & analytics** — Training load monitoring, volume charts, discipline distribution, AI insights, race readiness score
- **Strava integration** — OAuth flow, auto-match activities to planned workouts
- **Google Calendar integration** — Push workouts as events, read conflicts
- **Garmin Connect** — Activity sync
- **Error boundary** — Global error boundary with "Try Again" and "Reset Data" recovery
- **Sign out** — Available in Settings page with user email display
- **Settings persistence** — Dark mode, notifications stored in Supabase
- **Test suite** — Unit tests for `claudeApi.ts`, `TrainingContext`, onboarding

### 🔮 Planned (Phase 5: Social & Advanced)

- PDF export of training plans
- Social sharing of milestones and achievements
- Push notifications via Web Push API + service worker
- Multi-race support with multiple active plans
- Coach mode (read-only view with override capability)
- PWA with full offline support

---

## 5. Resolved Issues

All previously identified technical issues have been addressed:

1. ~~**🔴 API Key in Frontend**~~ → ✅ Moved to server-side Vercel serverless function
2. ~~**🔴 No Data Backup**~~ → ✅ Supabase PostgreSQL with RLS; localStorage as cache
3. ~~**🟡 `mockPlanGenerator.ts` dead code**~~ → ✅ Deleted
4. ~~**🟡 Profile edits silently ignored**~~ → ✅ Profile ↔ Training sync implemented
5. ~~**🟡 No error boundaries**~~ → ✅ Global ErrorBoundary with recovery UI
6. **🟡 Date timezone edge cases** — Partially mitigated but may still affect users in extreme timezone offsets
