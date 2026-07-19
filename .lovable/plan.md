## InterviewReady AI — Polish Pass (Frontend Only)

Scope: visual + UX improvements for demo. No backend/auth/AI integration. All mock data stays in `src/lib/mockInterviewApi.ts`.

### 1. Mock data (`src/lib/mockInterviewApi.ts` + `types.ts`)

- Add `mockUser = { name: "Student", email: "student@demo.com" }` export.
- Add `interviewTip: string` field to `Feedback` type and populate it (rotating tips array).
- Update `MOCK_HISTORY` dates to **2026** (Apr–May 2026).
- Keep all `// TODO: replace with Gemini API call` markers.

### 2. Dashboard (`src/routes/dashboard.tsx`)

- Replace "Welcome back, Alex" with `Welcome back, {mockUser.name}`.
- New subtitle: "Track your interview practice progress and improve your readiness."

### 3. Login (`src/routes/login.tsx`) + new `/register`

- Create `src/routes/register.tsx` — minimal sign-up form (name/email/password) styled like login, submitting → `/dashboard`.
- Fix bottom link on login: "Don't have an account? Register" → `to="/register"`.
- Confirm Google button + Login submit both navigate to `/dashboard` (already true).
- On `/register`, link back to `/login`.

### 4. Interview Room (`src/routes/interview.tsx`, `QuestionCard.tsx`, `FeedbackCard.tsx`)

- Submit state: full-card overlay/skeleton with spinner + text "Analyzing your answer…" while feedback loads (replace inline button-only loader with a visible analyzing panel under the question).
- `FeedbackCard`: add **Interview Tip** section (lightbulb, accent panel) using `feedback.interviewTip`. Keep existing scores/strengths/weaknesses/improved answer.
- Mobile layout: switch grid to `grid-cols-1 lg:grid-cols-[1fr_320px]` (already), but move sidebar **after** main column on mobile via order utilities; make Submit/Next/Finish buttons `w-full sm:w-auto`.

### 5. Result page (`src/routes/result.tsx`)

- Add **Session Summary card** at top (above ScoreCard row): Job Role, Interview Type, Difficulty, Number of Questions — read from `localStorage["ir.session"].setup` and `ir.setup` fallback.
- Improved **empty state**: when no `ir.report` in storage, show a friendly card with icon + "No report yet — complete an interview to see your readiness report" + CTA buttons to `/start` and `/dashboard` (instead of auto-loading mock).
- Premium polish: add subtle gradient header band, divider between sections, consistent rounded-3xl cards, ensure mobile stacking.

### 6. History (`src/routes/history.tsx`, `SessionHistoryCard.tsx`)

- Dates already updated in mock (step 1).
- `SessionHistoryCard`: add **score badge** with color tiers
  - ≥80 → success tone (green)
  - 60–79 → warning tone (amber)
  - <60 → destructive tone (red)
  - Replace plain score number with `Badge` + keep large number; add subtle border-left accent in tier color.
- Slightly richer card: role icon, hover lift, improved spacing.

### 7. Mobile responsiveness pass

- Interview room sidebar order on mobile (point 4).
- Buttons full-width on mobile in: interview Submit/Next/Finish, result CTAs, login/register submit.
- Verify dashboard stat grid already responsive (it is).

### Files touched

- Edit: `src/lib/types.ts`, `src/lib/mockInterviewApi.ts`, `src/routes/dashboard.tsx`, `src/routes/login.tsx`, `src/routes/interview.tsx`, `src/routes/result.tsx`, `src/components/FeedbackCard.tsx`, `src/components/QuestionCard.tsx`, `src/components/SessionHistoryCard.tsx`
- New: `src/routes/register.tsx`

### Out of scope

Backend, real auth, Gemini, Firebase, payments, video, emotion detection. No removal of existing pages.
