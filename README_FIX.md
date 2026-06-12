# README Fix — Live Demo Link Update

**Date:** 2026-06-11  
**Commit:** `4776a54`  
**Branch:** `main`  
**Repo:** https://github.com/Nithish-kumar-git/family-finance-tracker

## Changes Made

### `README.md`

**Change 1 — Added live demo link (line 4, after project description):**

```diff
+**Live demo:** [https://scintillating-donut-a597ff.netlify.app](https://scintillating-donut-a597ff.netlify.app)
```

**Change 2 — Replaced placeholder Netlify URL in env vars section:**

```diff
-FRONTEND_URL=https://your-netlify-app.netlify.app
+FRONTEND_URL=https://scintillating-donut-a597ff.netlify.app
```

## Git Log

```
git add README.md
git commit -m "fix: update live demo link to Netlify URL"
git push origin main
```

## Notes

- The README did not contain a `YOUR_NETLIFY_URL` placeholder or an existing Vercel URL used as the app link.  
  The live demo line was **added** near the top of the file (after the intro description), which is the standard location.
- The `FRONTEND_URL` placeholder in the backend `.env` example section was also updated to the actual Netlify URL as it represents the app URL (not the backend).
- The `VITE_API_URL` Vercel reference in the frontend env section was left unchanged — it is the **backend** API URL, not the app URL.
