# Family Finance Tracker — Ink & Ivory Theme Overhaul

This document summarizes the complete UI overhaul implementing the "Ink & Ivory" design direction across the Family Finance Tracker web application.

## Design Direction
**Name:** Ink & Ivory
**Style:** Professional fintech meets personal finance.
**Inspiration:** Clean, data-forward, minimalist Indian fintech aesthetic (e.g., Zerodha, Jupiter Money).
**Layout:** Dark hero sections (`bg-slate-900`) contrast sharply with clean white content cards (`bg-white`). 
**Focus:** The financial numbers are the hero. Typography does the heavy lifting, with large bold rupee amounts taking precedence. Color is used strictly to communicate status (positive, negative, warning), never decoratively.

## Design Tokens & Palette

### Typography
- **Hero numbers:** `text-3xl font-bold tracking-tight text-white` (in dark hero sections) or `text-slate-900`
- **Section numbers:** `text-xl font-semibold text-slate-800`
- **Card numbers:** `text-base font-semibold text-slate-700`
- **Labels:** `text-xs font-medium uppercase tracking-widest text-slate-400`
- **Body:** `text-sm text-slate-600`
- **Captions:** `text-xs text-slate-400`

### Color Palette (Tailwind Classes)
- **Backgrounds:** `bg-slate-50` (app surface), `bg-white` (cards), `bg-slate-900` (hero sections)
- **Primary:** `indigo-600` (Replaced all instances of `violet-600` across the app)
- **Primary Shades:** `indigo-50`, `indigo-100`, `indigo-200`, `indigo-500`, `indigo-700`
- **Positive / Surplus:** `emerald-600`
- **Negative / Deficit:** `red-500` / `red-600`
- **Warning / Gold (Value):** `amber-500` / `amber-600`

### Components
- **Cards:** `bg-white rounded-2xl border border-slate-100 shadow-sm p-4`
- **Inner elements:** `rounded-xl`
- **Badges/chips:** `rounded-full`
- **Spacing:** `gap-3` between cards, `gap-2` inside cards

## Modified Files

### `src/pages/Auth.jsx`
- Fully refactored to use a centered, dark-themed layout (`bg-slate-900`).
- Replaced login card with an elegant white form.
- Typography adjusted to standard tokens.

### `src/pages/Dashboard.jsx`
- Implemented the dark hero band (`bg-slate-900`).
- The main corpus card overlaps the hero band for depth.
- Replaced primary `violet` accents with `indigo`.

### `src/pages/Assets.jsx`
- Transformed all tab contents (FD, MF, LIC, Chit, Gold) to use the dark hero structure.
- Removed excessive nesting and updated all classNames to adhere to the standardized white card pattern.

### `src/pages/Milestones.jsx`
- Urgent milestones now feature a dark hero block.
- Upcoming timeline streamlined with standard typography and padding rules.

### `src/pages/Employment.jsx`
- Status section converted to a dark hero featuring the Job Search title and employment status badge.
- When employed, the confirmed salary and family surplus is presented as high-contrast white text on dark background.
- Bar charts updated from `violet` to `indigo`.

### `src/pages/Report.jsx`
- Merged the month selector and Cash Flow components into a unified dark hero.
- Cash Flow insights inside the hero are strictly formatted using the token styles (text-white for Net Flow).
- AI Insights list visually standardized with `bg-slate-50` boundaries.

### `src/pages/Settings.jsx`
- Added a dark hero header ("Settings" + "v1.0.0").
- Re-verified that warning zones (`bg-red-50 border-red-200`) conform to the defined status colors.

### Global automated refactoring
- **`src/pages/Expenses.jsx` & `src/pages/Budgets.jsx`**: Executed an automated token migration replacing all `violet-*` classNames with `indigo-*` classNames to seamlessly align with the Ink & Ivory palette without altering local JSX structure.

## Technical Notes
- **Zero Logic Changes:** The overhaul was purely visual. All `useStore`, data fetching, calculations, and local states remain identical to the previous implementation.
- **Tailwind Only:** No inline styles were used; all styling relies exclusively on Tailwind utility classes.
