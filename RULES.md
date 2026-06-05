# FAMILYFINANCETRACKER — PERMANENT BUILD RULES
# Read at the start of every session. Every rule is non-negotiable.

## RULE 1 — READ BEFORE WRITING
Before any code: read PROGRESS.md (what is locked), SUPER_MASTER_PROMPT_V2.md (full spec).

## RULE 2 — NEVER MODIFY LOCKED FILES
Files from completed conversations are frozen. Check PROGRESS.md LOCKED FILES section.
If a file is listed there: do not open it, do not edit it, do not recreate it.

## RULE 3 — EXACT FIELD NAMES ONLY
Use only field names from SPEC_SUMMARY.md or existing project files. Never invent names.
Expense categories (exact, no others): groceries, utilities, medical, transport,
household, lic_premium, chit_contribution, personal, education, other

## RULE 4 — EXACT LIBRARY METHODS ONLY
Never use a method not documented for the exact installed version. When uncertain:
write # UNCERTAIN: [describe] and list it in the completion report.

## RULE 5 — DEPENDENCY DIRECTION (one-way, no exceptions)
Backend:  routers → services → (models, database). No circular imports. No router importing router.
Frontend: pages → hooks → api.js. No inline fetch in components. No component importing a hook.

## RULE 6 — FIXED TECH STACK
Backend: Python 3.11, FastAPI, SQLAlchemy, psycopg2-binary, pydantic,
         google-generativeai, pandas, python-dotenv, uvicorn
Frontend: React 18, Vite, Tailwind CSS v3, Zustand, Recharts, Lucide React, date-fns
Database: Supabase PostgreSQL (SUPABASE_DATABASE_URL env var)
AI model: gemini-1.5-flash only

## RULE 7 — ENVIRONMENT VARIABLES
Never hardcode keys. Backend reads: os.getenv("VAR"). Frontend reads: import.meta.env.VITE_VAR

## RULE 8 — COMPLETE FILES ONLY
Every file: 100% complete, no TODOs, no stubs, no "# implement later".

## RULE 9 — COMPLETION REPORT IS MANDATORY
End every task with a report in this format:
=== COMPLETION REPORT: Conversation [N] ===
STATUS: [COMPLETE/PARTIAL/FAILED]
FILES CREATED: [path: description]
FILES MODIFIED: [path: what changed] or None
ENDPOINTS BUILT: [METHOD /path: what it does] or N/A
COMPONENTS BUILT: [name: what it does] or N/A
UNCERTAIN ITEMS: [list or None]
ISSUES ENCOUNTERED: [list or None]
WHAT TO TEST: [specific steps]
LOCKED FILES TOUCHED: [list or None — must be None]
MISSING OR DEFERRED: [list or None]
=== END REPORT ===

## RULE 10 — GIT AFTER EVERY CONVERSATION
After each verified conversation: git add . && git commit -m "feat: Conv N — description" && git push

## KEY NUMBERS (never change)
Monthly deficit: Rs.48196 | Expenses target: Rs.85800 | Pension: Rs.37604
Emergency fund target: Rs.420000 | Marriage budget: Rs.1000000
