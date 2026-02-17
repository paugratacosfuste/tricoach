# TriCoach AI — Action Plan

> This document is designed to be consumed by an AI agent to execute changes. Every task includes exact file paths, code patterns, schemas, and verification steps.
>
> **Read `status.md` first** for full architecture and current state context.

---

## Phase 1: Foundation & Security ✅ DONE

### 1.1 Vercel API Route Proxy for Claude ✅

**Goal:** Move the Claude API key to a server-side Vercel function so it's never exposed in the client bundle.

#### Files Created
- `api/generate-week.ts` — Vercel serverless function proxying Claude API calls
- `vercel.json` — API rewrite rules + SPA catch-all routing

#### Files Modified
- `src/lib/claudeApi.ts` — Client calls `/api/generate-week` instead of Anthropic directly
- `.env.local` — Removed `VITE_ANTHROPIC_API_KEY`

---

### 1.2 Supabase Database ✅

**Goal:** Persist all data in Supabase instead of localStorage.

#### Files Created
- `src/lib/supabase.ts` — Supabase client initialization
- `supabase-schema.sql` — Full DB schema (profiles, training_plans, weeks, workouts, week_feedback) + RLS + triggers

#### Files Modified
- `src/contexts/TrainingContext.tsx` — Supabase persistence with localStorage as offline cache
- `src/contexts/OnboardingContext.tsx` — Supabase profile sync on onboarding completion

---

### 1.3 Authentication (Supabase Auth) ✅

**Goal:** Email/password signup with email confirmation.

#### Files Created
- `src/contexts/AuthContext.tsx` — Auth state, signup with duplicate detection, login, logout, reset password
- `src/pages/LoginPage.tsx` — Login form (orange palette)
- `src/pages/SignupPage.tsx` — Registration form (orange palette)
- `src/pages/ConfirmEmailPage.tsx` — Post-signup verification page (orange palette)
- `src/components/ProtectedRoute.tsx` — Auth route guard

#### Files Modified
- `src/App.tsx` — AuthProvider wrapping, public + protected route structure

---

### 1.4 Cleanup ✅

- Deleted `src/lib/mockPlanGenerator.ts`
- Created `src/components/ErrorBoundary.tsx` — Global error boundary with recovery UI
- Removed all Lovable branding (meta tags, favicon, lovable-tagger dependency)
- Added `@vercel/node` devDependency to fix Vercel build

---

## Phase 2: Core Experience Polish

> **Priority:** High — These features directly improve the daily training experience.
> **Estimated effort:** ~3-4 sessions

### 2.1 Workout Detail Logging

**Goal:** When marking a workout complete, capture actual performance data instead of just flipping status.

**Current state:** `WorkoutDetailSheet.tsx` shows planned workout details and has "Mark as Done" / "Skip" buttons with no data entry.

##### [MODIFY] `src/components/dashboard/WorkoutDetailSheet.tsx`

Replace the simple "Mark as Done" button with an expandable completion form:

1. When "Mark as Done" is clicked, show a form section with:
   - **Actual duration** — Number input, pre-filled from `workout.duration`
   - **Actual distance** — Number input (if workout has distance), pre-filled from `workout.distance`
   - **Average HR** — Number input (optional)
   - **RPE** — Button group 1-10 with labels:
     ```
     1: Very Light | 2-3: Light | 4-5: Moderate | 6-7: Hard | 8-9: Very Hard | 10: Maximal
     ```
   - **How did it feel?** — 5-point emoji scale: 😫 😕 😐 🙂 🤩 (maps to 1-5)
   - **Notes** — Free-text textarea
   - **"Save & Complete"** button (primary) and **"Cancel"** button (ghost)

2. On submit, call `onComplete(workout, actualData)` where:
   ```typescript
   interface ActualData {
     duration: number;
     distance?: number;
     avgHR?: number;
     feeling: 1 | 2 | 3 | 4 | 5;
     rpe?: number;
     notes?: string;
   }
   ```

3. The parent (`Dashboard.tsx` / `CalendarPage.tsx`) should call `updateWorkoutStatus()` from `TrainingContext` with the actual data.

##### [MODIFY] `src/contexts/TrainingContext.tsx` → `updateWorkoutStatus()`

Ensure the Supabase update in `updateWorkoutStatus()` writes all actual data columns:
```sql
UPDATE workouts SET
  status = $status,
  actual_duration = $actualData.duration,
  actual_distance = $actualData.distance,
  actual_avg_hr = $actualData.avgHR,
  actual_feeling = $actualData.feeling,
  actual_rpe = $actualData.rpe,
  actual_notes = $actualData.notes
WHERE id = $workoutId
```

##### [MODIFY] `src/components/dashboard/WorkoutDetailSheet.tsx` (display section)

When viewing a **completed** workout, show an "Actual vs Planned" comparison:
```
Planned: 45min / 8km         Actual: 42min / 7.8km
HR: —                        RPE: 6/10 | Felt: 🙂
Notes: "Legs felt heavy in the last km"
```

#### Verification
- Mark a workout complete → form appears, fill all fields
- Save → check Supabase `workouts` table for actual data columns
- Reopen the completed workout → see actual vs planned comparison
- Skip a workout → should NOT show the completion form

---

### 2.2 Multi-Week History Browser

**Goal:** Browse all completed training weeks with workout detail.

**Current state:** No `HistoryPage` exists. Dashboard only shows current week.

##### [NEW] `src/pages/HistoryPage.tsx`

1. Query all completed weeks from Supabase:
   ```sql
   SELECT w.*, wf.overall_feeling, wf.notes as feedback_notes
   FROM weeks w
   LEFT JOIN week_feedback wf ON wf.week_id = w.id
   WHERE w.plan_id = $planId AND w.is_completed = true
   ORDER BY w.week_number DESC
   ```

2. Display as a vertical timeline:
   - Each week card shows: week number, phase, theme, date range, total hours
   - Completion rate badge (e.g., "5/6 completed")
   - Feeling indicator from feedback (emoji or color)
   - Click to expand → show all workouts with status + actual data

3. Empty state: "No completed weeks yet. Keep training!"

##### [MODIFY] `src/App.tsx`
- Add route: `/history` → `<ProtectedRoute><HistoryPage /></ProtectedRoute>`

##### [MODIFY] `src/components/dashboard/Sidebar.tsx` and `MobileNav.tsx`
- Add "History" navigation item with `History` icon from lucide-react
- Position between "Progress" and "Goals" in nav order

#### Verification
- Complete a week → navigate to History → see the completed week
- Click week card → expanded view shows all workouts
- Empty state shows correctly for new users

---

### 2.3 Profile ↔ Training Sync

**Goal:** When fitness metrics change, offer to regenerate the training plan with updated data.

**Current state:** `ProfilePage.tsx` shows editable fitness metrics but "Save Changes" button does nothing meaningful — data updates in local context only, no Supabase persist, no replanning trigger.

##### [MODIFY] `src/pages/ProfilePage.tsx`

1. Wire "Save Changes" button to:
   ```typescript
   async function handleSave() {
     // 1. Update Supabase profiles table
     const { error } = await supabase
       .from('profiles')
       .update({
         first_name: data.profile?.firstName,
         age: data.profile?.age,
         weight: data.profile?.weight,
         height: data.profile?.height,
         max_hr: data.fitness?.maxHR,
         lthr: data.fitness?.lthr,
         threshold_pace: data.fitness?.thresholdPace,
         ftp: data.fitness?.ftp,
       })
       .eq('id', user.id);

     // 2. Check if performance-affecting fields changed
     if (metricsChanged) {
       // Show AlertDialog: "Your fitness metrics have changed.
       // Regenerate next week with updated data?"
       // If yes → call generateNextWeek()
     }
   }
   ```

2. Track which fields changed by storing original values on mount and comparing at save time. Only trigger the replanning dialog for performance-related fields: `maxHR`, `lthr`, `thresholdPace`, `ftp`, `fitnessLevel`.

3. Add a toast notification: "Profile saved successfully" on success.

#### Verification
- Edit threshold pace → save → see "Regenerate?" dialog
- Accept regeneration → new week appears on dashboard
- Edit just name → save → no regeneration dialog appears

---

### 2.4 Workout Rescheduling & Plan Change Requests

**Goal:** Allow athletes to reschedule workouts within the week and request plan adjustments.

**Current state:** `CalendarPage.tsx` has workout display per day but no drag-and-drop. No `RegeneratePlanDialog` exists.

##### [MODIFY] `src/pages/CalendarPage.tsx`

Option A (Simpler — recommended first): Instead of drag-and-drop, add a **"Move to..."** button in the `WorkoutDetailSheet` for planned workouts:
1. Show day picker (Mon-Sun of the current week)
2. On select, show `AlertDialog`: "Sticking to your planned schedule leads to better results. Are you sure you want to move this workout to [day]?"
3. If confirmed → update `workouts.date` in Supabase

Option B (Advanced — Phase 2 stretch): Implement drag-and-drop with `@dnd-kit/core`:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
- Make each workout card `Draggable`
- Make each day cell `Droppable`
- On drop → same confirmation dialog → update date

##### [NEW] `src/components/RegeneratePlanDialog.tsx`

Dialog component:
```typescript
interface RegeneratePlanDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  isGenerating: boolean;
}
```

1. **Mandatory text area** — "Tell us what's wrong with the current plan or what you need changed" (minimum 10 characters)
2. Character counter below textarea
3. "Regenerate Plan" button — disabled until 10+ characters
4. Loading state while generating
5. On submit → call `generateNextWeek()` from `TrainingContext` with comment as `nextWeekConstraints`

##### [MODIFY] `src/pages/Dashboard.tsx`

Add a "Request Plan Change" button below the weekly overview:
```tsx
<Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
  <RefreshCw className="w-4 h-4 mr-2" />
  Request Plan Change
</Button>
```

#### Verification
- Open calendar → click workout → "Move to..." → select different day → confirm → verify date changed in Supabase
- Dashboard → "Request Plan Change" → type comment → submit → loading → new week generated
- Dialog should be disabled with < 10 characters

---

### 2.5 Goal Editing with Replanning

**Goal:** Allow athletes to modify their race goal and trigger automatic replanning.

**Current state:** `GoalsPage.tsx` displays race info as read-only cards. No editing capability.

##### [MODIFY] `src/pages/GoalsPage.tsx`

1. Add "Edit Goal" button that toggles fields into edit mode:
   - Race name (text input)
   - Race date (date picker)
   - Race type (select dropdown: sprint, olympic, 70.3, ironman)
   - Goal time (text input, optional)
   - Priority (radio group: Finish, PB, Podium)

2. On save:
   ```typescript
   // 1. Update training_plans table
   await supabase.from('training_plans').update({
     race_name: newData.raceName,
     race_date: newData.raceDate,
     race_type: newData.raceType,
     goal_time: newData.goalTime,
     goal_priority: newData.priority,
     total_weeks: calculateTotalWeeks(newData.raceDate),
   }).eq('id', planId);

   // 2. Show confirmation dialog
   // "Your goal has changed. Next week's plan will be regenerated."

   // 3. Trigger replanning
   await generateNextWeek(currentFeedback, "Goal updated: ...");
   ```

3. Recalculate `total_weeks` from the new race date using `calculateTotalWeeks()` from `TrainingContext`.

#### Verification
- Goals page → Edit Goal → change race date → save → see confirmation
- Dashboard shows new week reflecting updated goal
- Supabase `training_plans` row reflects new values

---

### 2.6 Settings Persistence

**Goal:** Persist user preferences to Supabase.

**Current state:** `SettingsPage.tsx` shows toggles and buttons but nothing persists. Sign-out works. The `profiles` table already has a `settings JSONB` column.

##### [MODIFY] `src/pages/SettingsPage.tsx`

1. Load settings from Supabase on mount:
   ```typescript
   const { data } = await supabase
     .from('profiles')
     .select('settings')
     .eq('id', user.id)
     .single();
   ```

2. Save on toggle change:
   ```typescript
   await supabase.from('profiles').update({
     settings: {
       ...currentSettings,
       darkMode: newValue,
       weekStartsOn: newValue, // 'monday' | 'sunday'
       distanceUnit: newValue, // 'km' | 'miles'
       notifications: { workoutReminder: true, weekReview: true }
     }
   }).eq('id', user.id);
   ```

3. Dark mode: integrate with document class toggle (`document.documentElement.classList.toggle('dark')`). The Tailwind dark mode is already configured.

#### Verification
- Toggle dark mode → reload → preference persists
- Change distance unit → check Supabase settings column
- Log out → log back in → settings still there

---

### 2.7 Test Suite

**Goal:** Unit tests for core logic functions.

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

## Phase 3: Integrations

> **Priority:** Medium — Adds major value but depends on third-party accounts.
> **Estimated effort:** ~2-3 sessions per integration

### 3.1 Strava Integration

**Goal:** Auto-sync Strava activities to match planned workouts and auto-complete them.

#### OAuth Setup

##### [NEW] `api/strava/auth.ts`
Vercel serverless function to initiate Strava OAuth:
```typescript
export default function handler(req, res) {
  const redirectUri = `${process.env.VERCEL_URL}/api/strava/callback`;
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=read,activity:read_all`;
  res.redirect(authUrl);
}
```

##### [NEW] `api/strava/callback.ts`
Handle OAuth callback:
1. Exchange code for access_token + refresh_token
2. Store tokens in Supabase `profiles.integrations` JSONB:
   ```json
   { "strava": { "connected": true, "accessToken": "...", "refreshToken": "...", "expiresAt": 12345 } }
   ```
3. Redirect back to `/settings?strava=connected`

##### [NEW] `api/strava/activities.ts`
Fetch recent activities:
1. Check token expiry, refresh if needed via Strava API
2. Fetch activities from the past 7 days
3. Return formatted activity data

##### [NEW] `src/lib/stravaSync.ts`
Activity matching logic:
```typescript
function matchActivityToWorkout(activity: StravaActivity, workouts: Workout[]): Workout | null {
  // Match by: same date + same type (strava "Run" → "run", "Ride" → "bike", "Swim" → "swim")
  // + approximate distance match (within 20% tolerance)
  // Return the best matching workout, or null if no match
}
```

#### Schema Changes

##### [MODIFY] `supabase-schema.sql`
Add to `profiles` table (already has `integrations JSONB`):
```sql
-- No schema change needed; integrations JSONB handles Strava tokens
```

##### [MODIFY] `src/pages/SettingsPage.tsx`
- "Connect Strava" button → navigates to `/api/strava/auth`
- Show "Connected ✓" badge when `integrations.strava.connected === true`
- "Disconnect" button → clear tokens from Supabase

#### Environment Variables (Vercel Dashboard)
```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
```

#### Verification
- Click "Connect Strava" → OAuth flow → redirect back with connected status
- Complete a Strava activity → check sync → workout auto-completes with actual data
- Disconnect → tokens cleared, status updates

---

### 3.2 Google Calendar Integration

**Goal:** Push planned workouts as events and check for scheduling conflicts.

##### [NEW] `api/google/auth.ts` and `api/google/callback.ts`
Google OAuth2 flow, similar to Strava pattern.

##### [NEW] `api/google/events.ts`
- `POST` — Push workouts as calendar events (title: "🏃 Easy Run - 45min", description with workout details)
- `GET` — Read existing events to check for conflicts

##### [MODIFY] `src/pages/SettingsPage.tsx`
- "Connect Google Calendar" button → OAuth flow
- Toggle: "Avoid conflicts with existing events" (sends calendar data to Claude prompt)
- Toggle: "Auto-add workouts to calendar"

##### [MODIFY] `src/lib/claudeApi.ts` → `buildWeekPrompt()`
If Google Calendar is connected and "Avoid conflicts" is on, include busy times in the prompt:
```
SCHEDULING CONSTRAINTS:
- Tuesday 18:00-20:00: Busy (work event)
- Thursday 07:00-09:00: Busy (meeting)
```

---

### 3.3 Garmin Connect (Stretch Goal)

Similar activity sync as Strava but with Garmin's API.
- Requires Garmin Consumer Key application (approval process takes days/weeks)
- Same pattern: OAuth → token storage → activity fetch → workout matching

---

## Phase 4: Intelligence & Analytics

> **Priority:** Medium — Enhances the coaching experience with data insights.
> **Estimated effort:** ~2 sessions

### 4.1 Enhanced Progress Dashboard

**Current state:** `ProgressPage.tsx` has basic charts (bar chart, line chart) using Recharts with placeholder-style data from the training context.

##### [MODIFY] `src/pages/ProgressPage.tsx`

Expand with the following chart sections:

1. **Weekly Volume Stacked Bar Chart** — X axis: week numbers, Y axis: hours. Stacked by discipline (swim=blue, bike=green, run=orange). Data source: completed weeks' workouts grouped by type.

2. **Discipline Distribution Pie Chart** — Shows % of total training time per discipline. Include strength. Use sport-themed colors already defined in CSS (`--swim`, `--bike`, `--run`).

3. **Completion Rate Line Chart** — X axis: weeks, Y axis: % completed workouts. Shows trend over time. Target line at 85%.

4. **Training Load Trend** — Simplified TSS: `duration_minutes × RPE / 10` for each workout. Sum per week. Show as area chart with warning threshold (red zone if load jumps >30% week-over-week).

### 4.2 Race Readiness Score

##### [NEW] `src/lib/raceReadiness.ts`

Calculate a 0-100 score from:
```typescript
function calculateRaceReadiness(plan: TrainingPlan): number {
  const completionRate = completedWorkouts / totalWorkouts;        // 40% weight
  const loadProgression = isProgressiveOverload(weeklyLoads);      // 20% weight
  const consistency = calculateStreak(workoutStatuses);             // 20% weight
  const timeRemaining = weeksToRace / totalWeeks;                  // 20% weight

  return Math.round(
    completionRate * 40 +
    loadProgression * 20 +
    consistency * 20 +
    timeRemaining * 20
  );
}
```

Display on Dashboard as a circular progress indicator with color coding:
- 0-40: Red ("Needs Attention")
- 41-70: Yellow ("On Track")
- 71-100: Green ("Race Ready")

### 4.3 AI Coaching Insights

##### [NEW] `api/coaching-insights.ts`

Vercel serverless function that:
1. Takes training history summary as input
2. Asks Claude for 2-3 brief coaching insights (e.g., "Your swim volume has dropped 20% — consistency here will pay off on race day")
3. Returns insights as string array

##### [MODIFY] `src/pages/Dashboard.tsx` or `ProgressPage.tsx`
- Show coaching insights card
- Refresh weekly or on-demand ("Get AI Insights" button)
- Cache insights in Supabase to avoid repeated API calls

---

## Phase 5: Social & Advanced

> **Priority:** Low — Nice-to-have features for v2.
> **Estimated effort:** ~3-4 sessions

### 5.1 PDF Export of Training Plans

##### [NEW] `src/lib/pdfExport.ts`
Use `jspdf` or `@react-pdf/renderer`:
```bash
npm install jspdf
```
Generate a PDF with:
- Cover page: race name, date, athlete name
- Weekly training table: day, type, name, duration, distance
- Include coaching notes per workout

Add "Export to PDF" button on Dashboard and History pages.

### 5.2 Push Notifications

##### [NEW] `public/service-worker.js`
Service worker for Web Push API.

##### [NEW] `api/push/subscribe.ts`
Store push subscription endpoint in Supabase.

##### [NEW] `api/push/send.ts`
Triggered by cron or Supabase edge function — sends notifications for:
- Daily workout reminder (morning)
- Week review reminder (Sunday evening)

##### [MODIFY] `src/pages/SettingsPage.tsx`
- "Enable Notifications" toggle → request browser permission + register subscription

### 5.3 Multi-Race Support

##### [MODIFY] Database schema
- Allow multiple `training_plans` with `is_active` flag
- Add plan switcher in dashboard header

##### [MODIFY] `src/contexts/TrainingContext.tsx`
- Load only the active plan
- Add `switchPlan(planId)` function

### 5.4 PWA Offline Support

##### [NEW] `public/manifest.json`
```json
{
  "name": "TriCoach AI",
  "short_name": "TriCoach",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#f97316",
  "background_color": "#0f172a"
}
```

##### [MODIFY] `index.html`
Add manifest link and service worker registration.

### 5.5 Coach Mode (Stretch Goal)
- Read-only view of an athlete's training plan
- Shared via link with token
- Coach can add comments/overrides

### 5.6 Social Sharing
- Share milestones (workout streaks, race readiness milestones) as images
- Generate shareable cards using canvas/SVG
