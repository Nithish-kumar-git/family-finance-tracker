# FamilyFinanceTracker

AI-powered family finance tracker built for a Chennai family managing pension income, investments, job search, and long-term milestones.

## What this app does

- **Dashboard** — income overview, deficit calculator, Ask Amma AI chatbot
- **Expenses** — add/log expenses with AI SMS parser, view by category
- **Budgets** — monthly budget targets with overage alerts
- **Assets** — Fixed Deposits, Mutual Funds, LIC policies, Chit Funds, Gold
- **Milestones** — family action plan with urgent/upcoming/completed tracking
- **Employment** — job application tracker with weekly targets and impact calculator
- **Report** — monthly report with AI insights and "Copy for Claude" export
- **PWA** — installable on Android/iOS, works offline with service worker cache

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite, TailwindCSS, Zustand, Recharts |
| Backend | Python FastAPI, SQLAlchemy, PostgreSQL (Supabase) |
| AI | Google Gemini 2.0 Flash (AI Studio free tier) |
| PWA | vite-plugin-pwa, Workbox service worker |
| Deployment | Netlify (frontend) + Vercel (backend) |

## Local development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Git

### Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env — add SUPABASE_DATABASE_URL and GEMINI_API_KEY

pip install -r requirements.txt
python seed.py          # Creates tables and seeds family data
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`
Health check: `GET http://localhost:8000/health` → `{"status":"ok","database":"connected"}`

### Frontend setup

```bash
cd familyfinancetracker
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`
API calls proxy to `http://localhost:8000` via Vite's dev server proxy.

### Test users

| User | PIN | Role |
|------|-----|------|
| Amma | 1111 | Primary user — pension income ₹26,354/month |
| Nithish | 2222 | Job seeker — Employment tracker |
| Abeerami | 3333 | Secondary income contributor |

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for the full step-by-step guide.

**Summary:**
1. Push to GitHub
2. Seed Supabase database with `python seed.py`
3. Deploy `backend/` to Vercel — add `SUPABASE_DATABASE_URL` and `GEMINI_API_KEY`
4. Deploy `familyfinancetracker/` to Netlify — add `VITE_API_URL`
5. Update `FRONTEND_URL` in Vercel after getting the Netlify domain
6. Install as PWA from Chrome on Android

## Project structure

```
family-finance-tracker/
├── backend/                      # FastAPI backend
│   ├── main.py                   # App entry point, CORS, router registration
│   ├── database.py               # SQLAlchemy engine + session
│   ├── models.py                 # ORM table definitions
│   ├── schemas.py                # Pydantic request/response models
│   ├── seed.py                   # Creates tables + seeds family data
│   ├── vercel.json               # Vercel deployment config
│   ├── requirements.txt
│   ├── routers/
│   │   ├── expenses.py
│   │   ├── assets.py
│   │   ├── milestones.py
│   │   ├── employment.py
│   │   ├── reports.py
│   │   ├── ai.py
│   │   └── reset.py
│   └── services/
│       ├── ai_service.py         # Gemini API calls
│       └── analytics_service.py  # Report generation
│
├── familyfinancetracker/         # React frontend
│   ├── public/
│   │   ├── manifest.json         # PWA manifest
│   │   └── icons/
│   │       ├── icon-192.svg
│   │       └── icon-512.svg
│   ├── src/
│   │   ├── App.jsx               # Router + protected layout
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── store/
│   │   │   └── useStore.js       # Zustand global state
│   │   ├── data/
│   │   │   └── seedData.js       # EXPENSE_CATEGORIES + INITIAL_DATA
│   │   ├── utils/
│   │   │   ├── api.js            # All API calls (never call fetch directly)
│   │   │   ├── formatters.js     # formatCurrency, formatDate, daysUntil
│   │   │   └── calculations.js
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── BottomNav.jsx
│   │   │   │   └── PageWrapper.jsx
│   │   │   ├── ui/
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   └── PWAInstallButton.jsx
│   │   │   └── charts/
│   │   │       └── SparkLine.jsx
│   │   ├── hooks/
│   │   │   ├── useExpenses.js
│   │   │   ├── useAssets.js
│   │   │   ├── useReport.js
│   │   │   └── usePWAInstall.js
│   │   └── pages/
│   │       ├── Auth.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Expenses.jsx
│   │       ├── Budgets.jsx
│   │       ├── Assets.jsx
│   │       ├── Milestones.jsx
│   │       ├── Employment.jsx
│   │       └── Report.jsx
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── PROGRESS.md                   # Build status (updated each conversation)
├── RULES.md                      # Coding rules for AI assistants
├── DEPLOYMENT_GUIDE.md           # Step-by-step deployment guide
└── README.md                     # This file
```

## Key architecture decisions

- **API-first**: All data mutations go through `api.*` functions in `api.js`. Never call `fetch()` directly.
- **Zustand store**: Single global store with localStorage persistence. All pages read from it.
- **Named imports only**: `EXPENSE_CATEGORIES` and `INITIAL_DATA` are named exports from `seedData.js` — never use default imports.
- **Offline-first**: `api.js` wraps all calls in try/catch and falls back to Zustand store if the backend is unreachable.
- **All calculations in hooks**: No inline arithmetic in JSX. All computed values live in `useReport.js`, `useAssets.js`, or `useExpenses.js`.

## Environment variables

### Backend (`.env` or Vercel)
```
SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
GEMINI_API_KEY=AIza...
FRONTEND_URL=https://your-netlify-app.netlify.app
```

### Frontend (`.env.production` or Netlify)
```
VITE_API_URL=https://your-vercel-app.vercel.app
```
