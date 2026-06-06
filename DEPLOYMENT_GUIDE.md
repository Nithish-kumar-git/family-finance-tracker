# FamilyFinanceTracker — Deployment Guide

## Who this is for
This guide is written for Nithish. No prior DevOps experience required.
All services used are free tier with no credit card needed (except Supabase,
which requires an email address only).

---

## Prerequisites — accounts to create before starting

| Service | URL | What it does | Cost |
|---------|-----|-------------|------|
| GitHub | github.com | Hosts your code | Free |
| Supabase | supabase.com | PostgreSQL database | Free (500 MB, no pause if used weekly) |
| Vercel | vercel.com | Hosts the FastAPI backend | Free |
| Netlify | netlify.com | Hosts the React frontend | Free |
| Google AI Studio | aistudio.google.com | Gemini API key | Free (1,500 req/day) |

---

## Step 1 — Get your Gemini API key (5 minutes, no credit card)

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google account
2. Click **Get API Key** in the left sidebar
3. Click **Create API key**
4. Copy the key — it starts with `AIza...`
5. Save it somewhere safe (Notes app, password manager)
6. Free tier limits: 1,500 requests/day, 1 million tokens/minute
   This family uses roughly 10–20 AI calls/day at most. Well within limits.

---

## Step 2 — Set up Supabase PostgreSQL database (10 minutes)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub or email
2. Click **New project**
3. Project name: `family-finance-tracker`
4. Region: **South Asia (Mumbai)** — closest to Chennai, lowest latency
5. Set a strong database password — save it immediately (you cannot retrieve it later)
6. Click **Create new project** — wait 2–3 minutes for provisioning

**Get your database connection string:**
1. In your Supabase project: go to **Settings** (gear icon) → **Database**
2. Scroll to **Connection string** → select **URI** tab
3. Copy the string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual password
5. This is your `SUPABASE_DATABASE_URL` — save it with the Gemini key

---

## Step 3 — Push your code to GitHub (5 minutes)

Run these commands from the repo root (`family-finance-tracker/`):

```bash
git init
git add .
git commit -m "feat: initial commit — FamilyFinanceTracker"
```

Create a new repo on github.com:
- Name: `family-finance-tracker`
- Visibility: **Public** (required for Vercel/Netlify free tier integrations)
- Do **NOT** initialise with README — you already have one

```bash
git remote add origin https://github.com/[your-username]/family-finance-tracker.git
git branch -M main
git push -u origin main
```

Verify: open `github.com/[your-username]/family-finance-tracker` — your files should be there.

---

## Step 4 — Create database tables and seed family data (5 minutes)

Do this on your local machine before deploying to Vercel.

```bash
cd backend

# Create your local environment file
cp .env.example .env

# Open .env in any text editor and fill in:
#   SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
#   GEMINI_API_KEY=AIza...
#   FRONTEND_URL=https://placeholder.netlify.app   (update this in Step 7 below)

pip install -r requirements.txt

python seed.py
```

Expected output:
```
Creating tables...
Tables created.
Seeding users...
Seeding fixed deposits...
Seeding mutual funds...
Seeding LIC policies...
Seeding chit funds...
Seeding gold...
Seeding emergency fund...
Seeding monthly income...
Seeding milestones...
Seed complete.
```

Verify the tables were created:
1. Go to your Supabase project → **Table Editor**
2. You should see tables: `users`, `expenses`, `fixed_deposits`, `mutual_funds`,
   `lic_policies`, `chit_funds`, `gold`, `emergency_fund`, `monthly_income`,
   `milestones`, `job_applications`, `monthly_snapshots`

---

## Step 5 — Deploy the FastAPI backend to Vercel (10 minutes)

1. Go to [vercel.com](https://vercel.com) → **Log in with GitHub**
2. Click **Add New Project**
3. Import your `family-finance-tracker` GitHub repository
4. Vercel will detect the `backend/vercel.json` and configure automatically
5. Before clicking **Deploy**, add **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `SUPABASE_DATABASE_URL` | Your full connection string from Step 2 |
   | `GEMINI_API_KEY` | Your API key from Step 1 |
   | `FRONTEND_URL` | `https://placeholder.netlify.app` (update after Step 7) |

6. Set **Root Directory** to `backend`
7. Click **Deploy** — wait 2–3 minutes

**Verify the backend is live:**
```
https://[your-vercel-project].vercel.app/health
```
You should see:
```json
{ "status": "ok", "database": "connected" }
```

If `"database": "disconnected"` appears, double-check your `SUPABASE_DATABASE_URL`
in Vercel → Settings → Environment Variables.

Copy your Vercel backend URL — you'll need it in the next step.
Example: `https://family-finance-tracker-api.vercel.app`

---

## Step 6 — Configure the frontend to use your backend (2 minutes)

In the `familyfinancetracker/` folder, create a `.env.production` file:

```bash
# familyfinancetracker/.env.production
VITE_API_URL=https://[your-vercel-project].vercel.app
```

Replace `[your-vercel-project]` with your actual Vercel subdomain from Step 5.

---

## Step 7 — Deploy the React frontend to Netlify (10 minutes)

**Build the frontend first:**
```bash
cd familyfinancetracker
npm install
npm run build
```

This creates a `dist/` folder.

**Deploy to Netlify:**
1. Go to [netlify.com](https://netlify.com) → **Log in with GitHub**
2. Click **Add new site** → **Import an existing project**
3. Connect GitHub → select your `family-finance-tracker` repo
4. Configure build settings:
   - **Base directory**: `familyfinancetracker`
   - **Build command**: `npm run build`
   - **Publish directory**: `familyfinancetracker/dist`
5. Add **Environment Variables** (Netlify → Site → Settings → Environment variables):

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://[your-vercel-project].vercel.app` |

6. Click **Deploy site** — wait 2–3 minutes

Your site will be live at a URL like: `https://[random-name].netlify.app`

**Custom domain (optional — free with Netlify):**
- Netlify → Site → Domain management → Add custom domain
- You can get a free `.netlify.app` subdomain like `family-finance.netlify.app`

---

## Step 8 — Update CORS settings in the backend (2 minutes)

Now that you have your Netlify URL, update the backend CORS config:

1. Go to Vercel → your project → **Settings** → **Environment Variables**
2. Update `FRONTEND_URL` to your actual Netlify URL:
   `https://[your-netlify-site].netlify.app`
3. Go to **Deployments** → click the three dots on the latest → **Redeploy**

---

## Step 9 — Install as a PWA on Android (1 minute)

1. Open your Netlify URL in **Chrome on Android**
2. A banner will appear at the bottom: **"Add FamilyFinanceTracker to Home screen"**
3. Tap **Install**
4. The app will appear on your home screen and run like a native app
5. It will cache pages locally so it works even with slow/no internet

> **Note**: iOS Safari (iPhone) supports PWA via: tap the Share button (box with arrow) → **Add to Home Screen**

---

## Step 10 — Verify everything end-to-end (5 minutes)

Open your Netlify URL and test:

- [ ] Auth page loads — all 3 users visible
- [ ] Login as Amma (PIN: 1111) — Dashboard shows pension income ₹26,354
- [ ] Login as Nithish (PIN: 2222) — Employment page shows Baseline Deficit ₹48,196
- [ ] Add an expense → appears in Expenses list
- [ ] Navigate to /report → Cash Flow card shows the new expense
- [ ] AI Insights → tap "Get AI Insights" → Gemini returns 5 bullets
- [ ] /assets → FDs, Mutual Funds, LIC, Gold tabs all populated
- [ ] /milestones → urgent and upcoming milestones visible
- [ ] Backend health: `GET https://[your-vercel-project].vercel.app/health` → `{"status":"ok","database":"connected"}`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `/health` shows `"database": "disconnected"` | Check `SUPABASE_DATABASE_URL` in Vercel env vars — password may contain special chars that need URL encoding |
| Frontend shows "offline" badge | `VITE_API_URL` in Netlify env vars is wrong — must not have trailing slash |
| AI Insights button returns nothing | `GEMINI_API_KEY` in Vercel env vars is wrong or expired |
| PWA install prompt doesn't appear | Must be on HTTPS (Netlify provides this). Try in Chrome. May take one visit to trigger. |
| Seed failed: `could not connect` | Database password has special characters — URL-encode them (e.g. `@` → `%40`) |
| Tables already exist on re-seed | `python seed.py` uses `CREATE TABLE IF NOT EXISTS` — safe to run again |

---

## Costs summary

| Service | Free tier | When you'd pay |
|---------|-----------|----------------|
| Supabase | 500 MB, no pause if active weekly | Never, for this app |
| Vercel | 100 GB bandwidth/month, 100 deployments/day | Never, for this app |
| Netlify | 100 GB bandwidth/month, 300 build minutes/month | Never, for this app |
| Google AI Studio | 1,500 API calls/day | Never, for this family |

**Total monthly cost: ₹0**
