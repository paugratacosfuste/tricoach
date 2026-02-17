# TriCoach AI — Design System & Aesthetic Guide

> **Purpose:** This document defines every visual and interaction design decision for the TriCoach AI application. It is written to be consumed by any AI, LLM, or human developer so they can implement or redesign the app with full aesthetic consistency.
>
> **Last updated:** 2026-02-17

---

## 1. Design Philosophy

### Concept: "Precision Endurance"

TriCoach AI is a training tool for triathletes — athletes who operate at the intersection of discipline, data, and physical intuition. The design must feel like **a high-end sports instrument**: the visual equivalent of a clean race-day cockpit. Not flashy. Not gamified. Not generic fitness-app cheerful.

The aesthetic is **dark, focused, and quietly confident** — like the calm before a race start. Every element earns its place. The interface should feel like it was designed by someone who actually trains, not by someone who Googled "fitness app UI."

### Core Principles

1. **Function-first density** — Athletes want information, not decoration. Show data clearly, but don't drown in whitespace. Every pixel should serve the athlete's decision-making.
2. **Discipline-coded identity** — Swim, bike, and run are sacred in triathlon. Each discipline has its own unmistakable color. This coding runs through every surface of the app.
3. **Earned progression** — The UI should subtly reward consistency. Completed workouts feel satisfying. Skipped ones don't punish — they inform.
4. **Coach-like authority** — The tone is that of a knowledgeable, calm coach. Not a hype-man. Not a drill sergeant. Think: the best coach you've ever had, distilled into an interface.

---

## 2. Color System

### 2.1 Foundation Palette (Dark Theme — Primary)

The app defaults to dark mode. This is intentional: athletes check their training early morning or late evening, dark reduces eye strain, and it gives the discipline colors maximum vibrancy.

```css
/* Background layers — deep navy, not pure black */
--background:           hsl(220, 25%, 6%);      /* #0d1017 — deepest layer */
--surface-1:            hsl(220, 25%, 9%);      /* #131823 — cards, panels */
--surface-2:            hsl(220, 25%, 12%);     /* #1a2030 — elevated cards, modals */
--surface-3:            hsl(220, 25%, 16%);     /* #232d3f — hover states, active items */

/* Text hierarchy */
--text-primary:         hsl(210, 25%, 95%);     /* #eff2f6 — headings, primary content */
--text-secondary:       hsl(215, 15%, 60%);     /* #8a95a8 — descriptions, metadata */
--text-tertiary:        hsl(215, 12%, 40%);     /* #5a6478 — timestamps, placeholders */

/* Borders */
--border-subtle:        hsl(220, 20%, 16%);     /* barely visible structure */
--border-default:       hsl(220, 20%, 22%);     /* card borders */
--border-strong:        hsl(220, 20%, 30%);     /* focused inputs, selected items */
```

**Why deep navy, not black?** Pure black (#000) feels dead and sterile. Deep navy has warmth and depth — it feels like the pre-dawn sky when you're heading to a morning swim session.

### 2.2 Discipline Colors

These are the soul of the app. They must be **instantly recognizable** and **never swapped**.

```css
/* Discipline identity colors */
--swim:        hsl(195, 90%, 55%);    /* #1db8e0 — Chlorine blue. Cool, aquatic, sharp. */
--bike:        hsl(150, 75%, 45%);    /* #1db866 — Chainring green. Mechanical, energetic. */
--run:         hsl(16, 100%, 60%);    /* #ff5c33 — Pavement orange. Raw, warm, gritty. */
--strength:    hsl(270, 65%, 60%);    /* #9566cc — Iron violet. Dense, grounded. */
--rest:        hsl(220, 15%, 35%);    /* #4a5568 — Slate. Quiet, intentional. */
```

Each discipline color is used at **three opacity levels**:

| Usage | Opacity | Example |
|-------|---------|---------|
| **Background tint** | 10-15% | Workout card background, calendar day fill |
| **Border / accent** | 40-50% | Left border on cards, progress bar segment |
| **Full intensity** | 100% | Icon fill, badge text, active state indicator |

```css
/* Example usage for swim */
.workout-swim {
  background: hsl(195 90% 55% / 0.10);
  border-left: 3px solid hsl(195 90% 55% / 0.50);
  /* Icon and heading text use full --swim color */
}
```

### 2.3 Semantic Colors

```css
--success:       hsl(150, 75%, 45%);   /* Same as bike green — completed workouts */
--warning:       hsl(42, 100%, 55%);   /* #ffb31a — Amber — needs attention */
--danger:        hsl(0, 75%, 55%);     /* #d93636 — Skipped, errors */
--info:          hsl(210, 80%, 60%);   /* #3b82f6 — Informational callouts */
```

### 2.4 Light Theme (Secondary)

Light mode exists for outdoor readability. It inverts the luminance but keeps discipline colors identical.

```css
.light {
  --background:       hsl(220, 15%, 97%);    /* Warm off-white, not stark #fff */
  --surface-1:        hsl(0, 0%, 100%);
  --surface-2:        hsl(220, 15%, 97%);
  --surface-3:        hsl(220, 15%, 93%);
  --text-primary:     hsl(220, 25%, 10%);
  --text-secondary:   hsl(215, 15%, 45%);
  --text-tertiary:    hsl(215, 12%, 60%);
  --border-subtle:    hsl(220, 15%, 90%);
  --border-default:   hsl(220, 15%, 85%);
  --border-strong:    hsl(220, 15%, 70%);
  /* Discipline colors remain unchanged */
}
```

---

## 3. Typography

### 3.1 Font Selection

```css
/* Display font — headings, week titles, race names */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&display=swap');

/* Body font — workout descriptions, metadata, form labels */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');

/* Data font — numbers, durations, distances, paces, HR values */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
```

| Role | Font | Weight(s) | Why |
|------|------|-----------|-----|
| **Display** | Outfit | 500–800 | Geometric sans-serif with athletic energy. Round but structured — not cold like Helvetica, not quirky like Quicksand. It has the confidence of a race bib number. |
| **Body** | DM Sans | 400–600 | Slightly humanist, extremely legible at small sizes. Clean without being clinical. Works beautifully for coaching notes and workout descriptions. |
| **Data / Monospace** | JetBrains Mono | 400–600 | Tabular numbers for perfect alignment in training tables. Every digit takes equal width — critical for pace columns (4:35/km), HR values (152bpm), and duration (1:45:00). |

### 3.2 Type Scale

```css
--text-xs:    0.75rem;    /* 12px — timestamps, tertiary metadata */
--text-sm:    0.8125rem;  /* 13px — form labels, descriptions */
--text-base:  0.9375rem;  /* 15px — body text, workout descriptions */
--text-lg:    1.125rem;   /* 18px — section headings, workout names */
--text-xl:    1.375rem;   /* 22px — page subheadings */
--text-2xl:   1.75rem;    /* 28px — page titles */
--text-3xl:   2.25rem;    /* 36px — hero stats, race countdown */
```

### 3.3 Typography Rules

- **Headings** (`h1`–`h4`) always use **Outfit**. Never bold the body font for headings.
- **Numerical data** (pace, HR, distance, duration, TSS) always uses **JetBrains Mono**. This ensures columns align and data feels precise.
- **Body paragraphs** use **DM Sans** at `--text-base` with `line-height: 1.6`.
- **All-caps** is reserved for: training phase labels (`BASE`, `BUILD`, `PEAK`, `TAPER`), discipline badges (`SWIM`, `BIKE`, `RUN`), and status indicators. Never for headings.
- **Letter-spacing**: +0.05em on all-caps text, -0.02em on display headings larger than `--text-2xl`.

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

Use a **4px base unit**. All spacing is a multiple of 4.

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### 4.2 Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (240px, desktop only)  │  Main Content     │
│  ┌───────────────────────────┐  │  ┌─────────────┐  │
│  │ Logo + App Name           │  │  │ Page Header  │  │
│  │                           │  │  │ (sticky)     │  │
│  │ Nav Items:                │  │  ├─────────────┤  │
│  │  ▸ Dashboard              │  │  │             │  │
│  │  ▸ Calendar               │  │  │  Content    │  │
│  │  ▸ Progress               │  │  │  (scrolls)  │  │
│  │  ▸ Goals                  │  │  │             │  │
│  │  ▸ Profile                │  │  │ max-width:  │  │
│  │  ▸ Settings               │  │  │ 960px       │  │
│  │                           │  │  │ centered    │  │
│  │ ─────────────────────     │  │  │             │  │
│  │ Current Phase Badge       │  │  │             │  │
│  │ Weeks to Race: 12         │  │  └─────────────┘  │
│  └───────────────────────────┘  │                    │
│                                 │  ┌─────────────┐  │
│  Mobile: Bottom tab bar (56px)  │  │ Mobile Nav   │  │
│                                 │  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

- **Sidebar**: Fixed, 240px wide, `--surface-1` background. Collapsed to bottom tab bar on mobile (<768px).
- **Main content**: Max-width 960px, centered with `--space-8` horizontal padding. Scrollable.
- **Page header**: Sticky top, includes page title and contextual actions (e.g., "Request Plan Change" on Dashboard).
- **Mobile nav**: Fixed bottom bar, 56px tall, 5 items max. Uses discipline-colored active indicators.

### 4.3 Card System

Cards are the primary content container. Three tiers:

```css
/* Base card */
.card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: var(--space-6);
}

/* Elevated card (workout detail, active item) */
.card-elevated {
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  padding: var(--space-6);
  box-shadow: 0 4px 24px hsl(220 25% 4% / 0.4);
}

/* Glass card (overlay on hero sections, floating elements) */
.card-glass {
  background: hsl(220 25% 10% / 0.6);
  backdrop-filter: blur(16px);
  border: 1px solid hsl(220 25% 25% / 0.3);
  border-radius: 16px;
  padding: var(--space-6);
}
```

**Workout cards** always have a **3px left border** in the discipline color. This is the single most recognizable pattern in the app — it must be consistent everywhere workouts appear (dashboard, calendar, history, detail sheet).

### 4.4 Border Radius Scale

```css
--radius-sm:   6px;    /* Badges, small buttons */
--radius-md:   8px;    /* Input fields, tags */
--radius-lg:   12px;   /* Cards, panels */
--radius-xl:   16px;   /* Modals, sheets, elevated cards */
--radius-full: 9999px; /* Circular avatars, pills, progress rings */
```

---

## 5. Component Patterns

### 5.1 Workout Card

The workout card is the atomic unit of the entire app. It appears on the dashboard, calendar, history, and detail views.

```
┌──┬──────────────────────────────────────────┐
│  │  🏊  Threshold Intervals                 │  ← discipline icon (emoji) + name (Outfit 600)
│  │  45min · 1.8km · Zone 3–4               │  ← metadata line (DM Sans 400, text-secondary)
│S │                                           │
│W │  4x400m at threshold pace with 45s rest  │  ← purpose (DM Sans 400, text-secondary)
│I │                                           │
│M │  ┌─────────────────────────────────────┐ │
│  │  │ ✓ Mark Done        ╳ Skip           │ │  ← action buttons (only for status: 'planned')
│  │  └─────────────────────────────────────┘ │
└──┴──────────────────────────────────────────┘
 ↑ 3px left border in --swim color
```

**States:**
- `planned` — full color, actions visible
- `completed` — subtle green checkmark overlay, `opacity: 0.7`, completion badge
- `skipped` — muted, red slash through icon, `opacity: 0.5`
- `partial` — amber indicator, partial completion badge

### 5.2 Discipline Icons

Use **emoji** for discipline icons, not Lucide/icon libraries. Emojis are universally recognized, instantly scannable, and add warmth to a data-heavy interface.

```
🏊  Swim
🚴  Bike
🏃  Run
💪  Strength
😴  Rest
```

These are used at two sizes: `text-2xl` (compact cards, calendar) and `text-4xl` (expanded cards, today's workout).

### 5.3 Progress Ring

The weekly progress ring is a circular SVG showing completion percentage. It's the centerpiece of the dashboard.

```
Specs:
- Size: 120px × 120px
- Stroke width: 8px
- Track color: var(--border-subtle)
- Fill: conic gradient through discipline colors of completed workouts
- Center text: "4/6" in JetBrains Mono 600, --text-2xl
- Below center: "workouts" in DM Sans 400, text-tertiary
```

### 5.4 Training Phase Badge

An always-visible indicator of where the athlete is in their periodization cycle.

```
Specs:
- All-caps text: "BUILD 2" in Outfit 700, --text-xs
- Letter-spacing: +0.08em
- Background: gradient from discipline-relevant color at 15% opacity
- Border-radius: --radius-full (pill shape)
- Padding: 4px 12px
- Placed in sidebar footer (desktop) or page header (mobile)
```

Phase color mapping:
- **Base** → `--swim` tint (building foundations, like pool work)
- **Build 1 / Build 2** → `--bike` tint (building engine)
- **Peak** → `--run` tint (sharpening speed)
- **Taper** → `--warning` tint (caution, ease off)
- **Race Week** → white/gold (celebration, readiness)

### 5.5 Calendar Day Cell

```
┌─────────────────┐
│  17              │  ← date number (Outfit 500, text-secondary; today: text-primary + underline)
│                  │
│  ▓▓  🏊 45min   │  ← color bar (discipline) + icon + duration
│  ▓▓  🏃 60min   │
│                  │
└─────────────────┘
```

- Today's cell has a subtle **glow border** in `--text-primary` at 20% opacity.
- Days with workouts show thin horizontal bars in discipline colors.
- Past completed workouts show a small ✓ checkmark.
- Past skipped workouts show the bar with a strikethrough pattern.

### 5.6 Buttons

```css
/* Primary action — "Generate Plan", "Mark Done" */
.btn-primary {
  background: linear-gradient(135deg, var(--run), hsl(25, 100%, 55%));
  color: white;
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  transition: opacity 150ms, transform 150ms;
}
.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary action — "Skip", "Cancel" */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  /* Same font, weight, radius, padding */
}

/* Destructive — "Reset Plan", "Delete" */
.btn-destructive {
  background: hsl(0 75% 55% / 0.15);
  color: var(--danger);
  border: 1px solid hsl(0 75% 55% / 0.3);
}
```

Primary buttons use the **run-orange gradient**. This is the app's primary action color — warm, energetic, and impossible to miss against the dark navy background.

### 5.7 Input Fields

```css
input, select, textarea {
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: 'DM Sans', sans-serif;
  padding: var(--space-3) var(--space-4);
  transition: border-color 150ms;
}
input:focus {
  border-color: var(--run);
  outline: none;
  box-shadow: 0 0 0 3px hsl(16 100% 60% / 0.15);
}
```

Numerical inputs (HR, pace, distance, duration) use **JetBrains Mono** for the value.

---

## 6. Motion & Animation

### 6.1 Principles

- **Fast feedback**: Button presses, state changes = 150ms
- **Spatial transitions**: Page navigations, sheet opens = 300ms with ease-out
- **Data reveals**: Staggered entrance for lists of workouts = 50ms delay between items
- **No gratuitous animation**: Nothing bounces. Nothing spins. Nothing pulses unless it's a loading state.

### 6.2 Key Animations

```css
/* Page content entrance — staggered fade-up */
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-in {
  animation: fade-up 400ms ease-out forwards;
}
/* Apply with stagger: style="animation-delay: ${index * 50}ms" */

/* Workout completion — satisfying checkmark scale */
@keyframes complete-pop {
  0% { transform: scale(0.8); opacity: 0; }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* Progress ring fill — smooth arc draw */
@keyframes ring-fill {
  from { stroke-dashoffset: var(--circumference); }
  to { stroke-dashoffset: var(--target-offset); }
}
.progress-ring circle {
  animation: ring-fill 800ms ease-out forwards;
}

/* Sheet / modal entrance */
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sheet-enter {
  animation: slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 6.3 Framer Motion Defaults

For React components using Framer Motion:

```tsx
// Default transition for most animations
const defaultTransition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

// Page transition wrapper
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, staggerChildren: 0.05 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// List item (workout cards, calendar entries)
const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};
```

---

## 7. Iconography

### 7.1 System Icons

Use **Lucide React** for all UI/system icons (navigation, actions, status indicators). Size: 16px for inline, 20px for buttons, 24px for navigation.

### 7.2 Discipline Icons

Use **emoji** (see section 5.2). Never replace with SVG icons — the emoji give the app its personality.

### 7.3 Status Icons

| Status | Icon | Color |
|--------|------|-------|
| Planned | `Circle` (Lucide, outline only) | `--text-tertiary` |
| Completed | `CheckCircle2` (Lucide, filled) | `--success` |
| Skipped | `XCircle` (Lucide, filled) | `--danger` |
| Partial | `AlertCircle` (Lucide, filled) | `--warning` |

---

## 8. Data Visualization

### 8.1 Charts (Recharts)

```
General chart styling:
- Background: transparent (inherits card background)
- Grid lines: var(--border-subtle), 1px, dashed
- Axis labels: JetBrains Mono 400, --text-tertiary, --text-xs
- Axis lines: hidden (grid is sufficient)
- Tooltip: card-glass styling with discipline-colored dot indicators
```

### 8.2 Volume Chart (Weekly Stacked Bar)

Stacked bars showing hours per discipline per week. Each segment uses the discipline color at 80% opacity, with a 1px gap between segments.

### 8.3 Training Load Line Chart

Single line showing weekly TSS (duration × RPE). Line color: `--text-primary`. Area fill: gradient from `--text-primary` at 10% to transparent.

### 8.4 Race Readiness Score

A large circular gauge (similar to progress ring but bigger, 160px) with a score from 0–100 in the center.

```
0–39:   Red zone (--danger)
40–69:  Amber zone (--warning)
70–89:  Green zone (--success)
90–100: Gold zone (#FFD700)
```

---

## 9. Responsive Behavior

### 9.1 Breakpoints

```css
--bp-sm:   640px;   /* Mobile landscape */
--bp-md:   768px;   /* Tablet — sidebar collapses to bottom nav */
--bp-lg:   1024px;  /* Desktop — sidebar visible */
--bp-xl:   1280px;  /* Wide desktop — max content width increases */
```

### 9.2 Mobile Adaptations

- Sidebar → fixed bottom tab bar (5 items: Dashboard, Calendar, Progress, Goals, Profile)
- Cards stack vertically with `--space-4` gap
- Today's workout card is always first and always expanded
- Calendar switches from month grid to scrollable week strip
- Sheets slide up from bottom (full-width, 85vh max-height)
- Font sizes reduce by 1 step on mobile (`--text-2xl` → `--text-xl` for page titles)

### 9.3 Touch Targets

All interactive elements have a **minimum 44×44px** touch target on mobile, even if the visual element is smaller.

---

## 10. Shadows & Depth

```css
--shadow-sm:    0 1px 3px hsl(220 25% 4% / 0.3);
--shadow-md:    0 4px 12px hsl(220 25% 4% / 0.4);
--shadow-lg:    0 8px 32px hsl(220 25% 4% / 0.5);
--shadow-glow:  0 0 24px hsl(16 100% 60% / 0.15);   /* Run-orange glow for CTAs */
--shadow-swim:  0 0 24px hsl(195 90% 55% / 0.15);    /* Swim glow for swim context */
--shadow-bike:  0 0 24px hsl(150 75% 45% / 0.15);    /* Bike glow for bike context */
```

Use glows sparingly — only on the primary CTA, today's workout card, and the active nav item.

---

## 11. Backgrounds & Texture

### 11.1 Main Background

The app background is not a flat color. It has a **subtle radial gradient** originating from the top-left, giving depth without distraction.

```css
body {
  background:
    radial-gradient(
      ellipse 80% 60% at 10% 10%,
      hsl(220 30% 10%) 0%,
      hsl(220 25% 6%) 60%
    );
  background-attachment: fixed;
}
```

### 11.2 Hero Section Gradient

The dashboard hero area (showing today's workout and race countdown) uses a subtle mesh gradient:

```css
.hero-gradient {
  background:
    radial-gradient(ellipse at 20% 50%, hsl(16 100% 60% / 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 30%, hsl(195 90% 55% / 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, hsl(150 75% 45% / 0.05) 0%, transparent 50%);
}
```

This creates an extremely subtle tricolor glow (run/swim/bike) that's almost subliminal — you feel the three disciplines without seeing them explicitly.

### 11.3 Noise Texture

A very faint noise overlay adds organic texture to flat surfaces, preventing the "sterile digital" feel:

```css
.noise-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* Inline SVG noise pattern */
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
}
```

---

## 12. Tone of Voice in UI Copy

The interface speaks like a **calm, experienced triathlon coach**:

- **Workout names**: Active, descriptive. "Threshold Intervals" not "Hard Swim #3". "Easy Recovery Spin" not "Bike Workout".
- **Coaching tips**: Second person, direct. "Focus on hip rotation through the catch" not "The athlete should focus on..."
- **Feedback prompts**: Empathetic, not judgmental. "How did this week feel?" not "Rate your performance."
- **Error states**: Honest, helpful. "Couldn't generate your plan — the AI service is temporarily unavailable. Your data is saved." not "Something went wrong."
- **Empty states**: Motivational but grounded. "Your first training week is being built. This takes about 15 seconds." not "Hang tight! 🎉"

**Never use**: exclamation marks in error messages, sarcasm, generic motivational quotes, or fitness-bro language.

---

## 13. Week Calendar Convention

Weeks start on **Monday** (European convention, standard in triathlon training). The calendar grid always shows Mon–Sun.

---

## 14. Implementation Checklist for Redesign

When implementing this design system, apply changes in this order:

1. **CSS Variables** — Replace all color, spacing, shadow, and radius tokens first
2. **Font imports** — Swap to Outfit + DM Sans + JetBrains Mono
3. **Typography rules** — Update all font-family assignments by role
4. **Card system** — Apply new background/border/radius/shadow tokens
5. **Discipline coding** — Ensure all workout surfaces use the 3-tier opacity system
6. **Buttons** — Update primary gradient, hover states, border styles
7. **Motion** — Add page transitions, card staggers, completion animations
8. **Backgrounds** — Apply body gradient, hero mesh, noise overlay
9. **Data components** — Style charts, progress ring, readiness gauge
10. **Responsive** — Verify mobile nav, touch targets, font scaling

---

## 15. What This Design Is NOT

- **Not a generic fitness app** — No neon green. No gradient cards on white. No "You crushed it!" popups.
- **Not gamified** — No points, streaks, badges, or leaderboards. Athletes are self-motivated; the app respects that.
- **Not minimal to the point of uselessness** — Data density is intentional. Athletes want to see their training data, not hunt for it.
- **Not dark-mode-for-the-sake-of-dark** — The dark theme serves the discipline colors and the use context (early/late day training checks).

---

*This document is the single source of truth for TriCoach AI's visual identity. Every design decision is intentional and serves the athlete using the app.*
