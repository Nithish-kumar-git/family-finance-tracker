# BUGFIX RATELIMIT — 2026-06-07

STATUS: COMPLETE

## CHANGE MADE

### backend/services/ai_service.py

All three `except Exception` blocks upgraded to detect 429 / quota / rate-limit errors:

#### parse_transaction()
- Catches `429 / quota / too many` → returns structured dict with
  `description: "Rate limit — retry in 60s"` so the frontend can surface it.
- All other errors → unchanged generic fallback.

#### get_monthly_insights()
- Catches `429 / quota / too many` → returns 5-item list where the first
  insight is `"Rate limit reached — please wait 60 seconds and try again."`.
- Includes helpful note: `"Gemini free tier allows ~15 requests per minute."`.
- All other errors → unchanged generic fallback list.

#### chat()
- Catches `429 / quota / too many` → returns
  `"Rate limit reached — please wait 60 seconds and try again."`.
- All other errors → `"I'm unable to answer right now. Please try again in a moment."`.

## LOCKED FILES TOUCHED
None
