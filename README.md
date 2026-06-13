<div align="center">

# FamilyFinanceTracker

**AI-powered family finance PWA — built for real, used daily**

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org) [![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com) [![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev) [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com) [![Gemini AI](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev) [![Netlify](https://img.shields.io/badge/Netlify-Live-00C7B7?style=flat-square&logo=netlify&logoColor=white)](https://scintillating-donut-a597ff.netlify.app)

[**→ Live Demo**](https://scintillating-donut-a597ff.netlify.app) · [API Health](https://family-finance-tracker-pearl.vercel.app/health)

> *"A full-stack finance tracker built for real family use, with AI-powered expense parsing,*
> *financial insights, and a natural language chatbot. Live and used daily by my family in Chennai."*

</div>

---

## What makes this different

Most portfolio projects are tutorials with fake data. This one is different:

- **Real users** — three family members in Chennai use this daily to track ₹64 lakh in savings, upcoming FD maturities, LIC premium deadlines, and a job search
- **Real AI** — Google Gemini parses actual UPI bank notifications, generates monthly financial insights in Tamil-household-friendly English, and answers natural language questions about live financial data
- **Real architecture** — offline-first PWA with localStorage fallback, so the app works during Vercel cold starts and no data is lost on network failure

---

## Screenshots

### Login Screen
![Login](docs/screenshots/auth.png)
*Clean dark login — three family members, PIN authentication*

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)
*Dark hero with live financial summary — corpus, income, expenses in one view*

### Expense Tracker
![Expenses](docs/screenshots/expenses.png)
*AI-powered expense entry — paste a UPI notification to auto-fill the form*

### Monthly Report
![Report](docs/screenshots/report.png)
*One-click report generation with Gemini AI insights and Claude analysis export*

### Milestones & Goals
![Milestones](docs/screenshots/milestones.png)
*Urgent deadline tracking — 8 urgent actions, upcoming FD maturities and LIC premiums*

### Ask Amma AI
![Ask Amma AI](docs/screenshots/chatbot.png)
*Natural language finance chatbot — answers questions using live family financial data*

---

## AI Features (the portfolio centrepiece)

### 1. Smart UPI / SMS Transaction Parser

Paste any Indian bank SMS or UPI notification. Gemini extracts the amount, merchant name, and expense category automatically — filling the add-expense form in under a second.

```
Input: "SBI UPI: Rs.1,200 paid to BIGBASKET via UPI Ref 12345"

Output: {
  amount: 1200,
  category: "groceries",
  description: "BigBasket",
  confidence: 0.97
}
```

### 2. Ask Amma AI — Finance Chatbot

A floating chat interface on the Dashboard. Family members ask questions in plain English. The AI receives the complete live financial context (income, expenses, corpus, upcoming milestones, employment status) with every message.

```
"What happens if Nithish gets a ₹35,000 job?"

→ "At ₹35,000/month, your monthly deficit drops from ₹48,196 to ₹13,196. 
   Abeerami's post-marriage contribution of ₹15,000 would bring you to a 
   surplus of ₹1,804/month — effectively ending the deficit."
```

### 3. Monthly Financial Insights

One-click generation of 5 plain-English observations about the month's finances. Prompted specifically for a non-finance-background Chennai household — no jargon, exact rupee amounts, actionable observations.

---

## Full Feature List

**Core tracking**
- Multi-user PIN auth (3 family members, each with a 4-digit PIN)
- Expense logging with 10 categories, recurring expense support, AI auto-fill
- Budget management with real-time per-category progress bars and overspend alerts
- Monthly report generator — produces structured JSON + one-click Claude AI analysis export

**Asset tracker**
- Fixed Deposits — maturity countdowns, purpose tagging, auto-renew warnings
- Mutual Funds — current value vs invested amount, gain/loss, Switch-to-Direct alerts
- LIC policies — premium due reminders, paid-up eligibility tracking, Mark Paid workflow
- Chit Funds — monthly contribution tracking, completion timeline
- Physical Gold — weight × live price calculation, last-updated timestamp

**Milestones**
- 16 pre-loaded family action items across 2026–2028
- Urgent/dangerous deadline flagging with pulsing indicators
- Timeline view for upcoming items, category filters

**Employment**
- Job application pipeline (Applied → Interview → Offer → Accepted)
- Weekly progress tracking vs 25 applications/week target
- Live impact calculator: "At ₹X salary, family deficit becomes ₹Y"

**PWA**
- Installable on Android (Chrome) and iOS (Safari) from the browser
- Offline-first: localStorage fallback activates silently on network failure
- Service worker caches app shell for instant loads

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v3, Recharts, Lucide React, date-fns |
| State | Zustand with localStorage persistence |
| Backend | Python 3.11, FastAPI, SQLAlchemy ORM, pandas, Uvicorn |
| Database | Supabase (PostgreSQL, free tier) |
| AI | Google Gemini API — gemini-2.5-flash-lite |
| Deployment | Netlify (frontend auto-deploy) + Vercel serverless (backend) |
| PWA | vite-plugin-pwa with Workbox service worker |

---

## Architecture

```
[Android / iOS / Desktop Browser]
         │
         │ PWA — runs without browser chrome
         ▼
[React 18 + Vite + Tailwind] ←── localStorage (offline fallback)
         │
         │ api.js — fetch with automatic offline fallback
         │ On network error: serves cached data, sets isOffline flag
         ▼
[FastAPI on Vercel Serverless]
         │
         │ SQLAlchemy ORM + pandas
         │ google-genai SDK
         │ Monthly aggregation
         │ 3 AI endpoints
         ▼                    ▼
[Supabase PostgreSQL]   [Gemini 2.5 Flash Lite]
```

**Offline behaviour:** When `api.js` receives a network error, it sets `isOffline: true` in Zustand, shows a red dot in the header, and returns Zustand store data (persisted to localStorage). The user sees no error. Writes queue locally and sync when connectivity returns.

---

## Project Structure

```
family-finance-tracker/
├── backend/                    Python FastAPI backend
│   ├── main.py                 App entry, CORS, router registration
│   ├── models.py               SQLAlchemy ORM (13 tables)
│   ├── schemas.py              Pydantic request/response schemas
│   ├── seed.py                 One-time table creation + family data
│   ├── services/
│   │   ├── ai_service.py       Gemini API — all 3 AI features
│   │   └── analytics_service.py pandas aggregation
│   └── routers/                7 route modules
│
└── familyfinancetracker/       React 18 PWA
    └── src/
        ├── pages/              9 pages
        ├── hooks/              useExpenses, useAssets, useReport, usePWAInstall
        ├── components/         layout/, ui/, charts/
        ├── store/              Zustand + localStorage persistence
        └── utils/              api.js (offline fallback), formatters, calculations
```

---

## Local Development

**Prerequisites:** Python 3.11+, Node.js 18+, Supabase account

```bash
# Clone
git clone https://github.com/Nithish-kumar-git/family-finance-tracker.git
cd family-finance-tracker

# Backend
cd backend
cp .env.example .env     # Fill in SUPABASE_DATABASE_URL and GEMINI_API_KEY
pip install -r requirements.txt
python seed.py           # creates tables + inserts family data
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd familyfinancetracker
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev              # → http://localhost:5173
```

Login: Amma (PIN 1111) · Nithish (PIN 2222) · Abeerami (PIN 3333)

---

## Environment Variables

**backend/.env**
```
SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
GEMINI_API_KEY=AIza...
FRONTEND_URL=https://scintillating-donut-a597ff.netlify.app
```

**familyfinancetracker/.env.local**
```
VITE_API_URL=https://family-finance-tracker-pearl.vercel.app
```

---

## Resume Highlights

- **Built full-stack PWA** — Python FastAPI backend deployed as Vercel serverless functions, React 18 frontend on Netlify, PostgreSQL on Supabase; entirely free infrastructure
- **Integrated Google Gemini API** (gemini-2.5-flash-lite) to auto-categorise raw UPI/SMS bank notifications into 10 expense categories; zero-error offline design via localStorage fallback
- **Built production AI chatbot** (Ask Amma AI) with live financial context injection; app actively used by a family of three in Chennai
- **Used pandas + SQLAlchemy ORM** for monthly expense aggregation, budget variance analysis, and 6-month trend generation from Supabase PostgreSQL
- **Offline-first PWA architecture** — automatic localStorage fallback in React ensures zero data loss during Vercel cold starts or network failure

---

## Deployment

Full deployment guide: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

Live: [https://scintillating-donut-a597ff.netlify.app](https://scintillating-donut-a597ff.netlify.app)

---

<div align="center">

Built by <a href="https://github.com/Nithish-kumar-git">Nithish</a> · Chennai, 2026 · MIT License

</div>

---
