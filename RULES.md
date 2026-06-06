# FAMILYFINANCETRACKER — PERMANENT BUILD RULES
# This file is read automatically at the start of every session.
# Every rule here is non-negotiable. Breaking any rule makes the output unusable.
# Last updated: June 2026 | Version: 1.0

---

## WHO YOU ARE

You are building FamilyFinanceTracker — a React 18 PWA + Python FastAPI backend
for a real Chennai family. Full spec is in SUPER_MASTER_PROMPT_V2.md.
Read PROGRESS.md to know what is already built before doing anything.

---

## RULE 1 — READ BEFORE WRITING

Before writing a single line of code in any session:
1. Read PROGRESS.md — know exactly which conversations are complete
2. Read SUPER_MASTER_PROMPT_V2.md Section 0 (Zero-Tolerance Rules)
3. Read the CURRENT TASK you have been given
4. Check which files already exist in the project — do not recreate them

---

## RULE 2 — NEVER MODIFY COMPLETED FILES

Files from completed conversations are LOCKED. You must not edit them unless
the task you were given explicitly names the file and says "modify this file."

How to check: look at PROGRESS.md. Any conversation marked ✓ COMPLETE means
all its files are locked. Do not touch them.

If you need a function from a completed file: import it. Do not copy the code.
If a completed file has a bug: report it in your completion report. Do not fix it
silently — Claude must be informed so the fix can be tracked.

---

## RULE 3 — EXACT FIELD NAMES ONLY

Every field name you use in any file must come from one of these three sources:
1. SUPER_MASTER_PROMPT_V2.md Section 4 (data model / initialState)
2. SUPER_MASTER_PROMPT_V2.md Section 5 (expense categories)
3. An existing file already in the project that defines the field

Never invent a field name. Never rename a field. Never use camelCase where
the spec uses snake_case or vice versa.

The exact expense category keys are (use these exactly, no others):
  groceries, utilities, medical, transport, household,
  lic_premium, chit_contribution, personal, education, other

---

## RULE 4 — EXACT LIBRARY METHODS ONLY

Never use a Python or JavaScript library method unless it is in the official
documentation for the exact package version listed in requirements.txt or
package.json. If you are not 100% certain a method exists: use the simplest,
most basic documented approach instead. When uncertain, write:
  # UNCERTAIN: [describe what you are uncertain about]
and list it in your completion report. Do not guess silently.

---

## RULE 5 — DEPENDENCY DIRECTION IS ONE-WAY

Backend (Python):
  routers → services → (models, database)
  routers NEVER import other routers
  services NEVER import routers
  main.py only does: app creation, CORS, router registration

Frontend (React):
  pages → hooks → api.js → backend
  pages → components/ui
  pages → utils/
  No page imports another page
  No component imports a hook
  No utils imports from store or components
  No inline fetch() in any component or page — all fetching through hooks

---

## RULE 6 — TECHNOLOGY STACK IS FIXED

Do not add any library, package, or tool not listed in SUPER_MASTER_PROMPT_V2.md
Section 2. Do not upgrade or change versions. If a library seems missing, report it.
Never install something new without a user confirmation.

Backend stack:
  Python 3.11, FastAPI, SQLAlchemy, psycopg2-binary, pydantic,
  google-generativeai, pandas, python-dotenv, python-multipart, uvicorn

Frontend stack:
  React 18, Vite, Tailwind CSS v3, Zustand, Recharts,
  Lucide React, date-fns, vite-plugin-pwa

Database: Supabase (PostgreSQL via SUPABASE_DATABASE_URL)
AI: Google Gemini API — model: gemini-1.5-flash ONLY

---

## RULE 7 — ENVIRONMENT VARIABLES

Never hardcode API keys, database URLs, or environment-specific values.
All sensitive values come from environment variables only.

Backend .env variables:
  SUPABASE_DATABASE_URL
  GEMINI_API_KEY
  FRONTEND_URL

Frontend .env.local variables:
  VITE_API_URL

Never read .env values directly from a React component.
Always use import.meta.env.VITE_* in React.
Always use os.getenv() in Python.

---

## RULE 8 — COMPLETE FILES ONLY

Every file you produce must be 100% complete from the first line to the last.
No TODOs. No stubs. No "# implement later". No pass statements in route bodies.
No "..." placeholders. No truncation with "rest of code here".

A file is only done when:
  - It has no syntax errors
  - Every function has a real implementation
  - Every import references a package in requirements.txt or package.json
  - Every field name matches the spec

---

## RULE 9 — COMPLETION REPORT IS MANDATORY

After finishing every task, produce a completion report using this exact format:

=== COMPLETION REPORT: Conversation [N] ===
STATUS: [COMPLETE / PARTIAL / FAILED]
FILES CREATED: [path: one sentence each]
FILES MODIFIED: [path: what changed]
ENDPOINTS BUILT: [METHOD /path: what it does]
COMPONENTS BUILT: [name: what it does]
UNCERTAIN ITEMS: [every # UNCERTAIN comment]
ISSUES ENCOUNTERED: [problems and how handled]
WHAT TO TEST: [specific verification steps]
MISSING OR DEFERRED: [anything not built and why]
=== END REPORT ===

Do not summarise. Fill in every section. "None" is acceptable for empty sections.

---

## RULE 10 — GIT COMMITS

After every conversation that completes successfully, the user will run:
  git add .
  git commit -m "feat: [conversation description]"

This creates an immutable checkpoint. If a later conversation breaks something,
the user can roll back. Never assume git is set up — report if it is not.

---

## RULE 11 — CHAT SESSION MANAGEMENT

One Antigravity chat session = one conversation number. Never mix two
conversation numbers in one chat. Never continue a previous chat for a new task.

When to produce a CHECKPOINT automatically:
  - After every 8 files created in a single chat session
  - When the chat has more than 12 back-and-forth exchanges
  - When the user asks for one

Checkpoint format:
=== CHECKPOINT: Conversation [N] Round [R] ===
FILES BUILT SO FAR: [list every file created]
FILES STILL TO BUILD: [list remaining files from PRODUCES]
ISSUES TO CARRY FORWARD: [or None]
=== END CHECKPOINT ===

After producing a checkpoint, tell the user:
"Start a fresh Antigravity chat and paste the Continuation Prompt below to continue."
Then produce the continuation prompt as the very next block.

---

## KEY FINANCIAL NUMBERS (never change these)

Monthly deficit target: ₹48,196
Monthly expenses target: ₹85,800
Monthly pension income: ₹37,604
Emergency fund target: ₹4,20,000
Marriage budget: ₹10,00,000
Renovation budget: ₹12,50,000

---

## ALL API ENDPOINT PREFIXES (do not invent new ones)

/api/expenses        /api/expenses/bulk
/api/assets/fds      /api/assets/mf       /api/assets/lic
/api/assets/chits    /api/assets/gold     /api/assets/summary
/api/milestones
/api/employment      /api/employment/bulk  /api/employment/stats
/api/reports/snapshot  /api/reports/snapshots
/api/ai/parse-transaction  /api/ai/monthly-insights  /api/ai/chat
/api/reset
/health