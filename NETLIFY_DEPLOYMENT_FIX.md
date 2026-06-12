# Netlify Deployment Fix - Ask Amma AI Configuration

**Issue**: "Ask Amma AI is unavailable offline" error on new Netlify deployment

**Root Cause**: The frontend is detecting the backend API as unreachable because the `VITE_API_URL` environment variable is not configured in your new Netlify account.

---

## Fix Steps for New Netlify Account

### 1. Configure Environment Variable in Netlify

1. Go to your Netlify site dashboard: https://app.netlify.com
2. Navigate to: **Site settings** → **Environment variables**
3. Click **Add a variable**
4. Add the following:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://family-finance-tracker-pearl.vercel.app`
   - **Scopes**: Check "All deploy contexts" (or at minimum "Production")
5. Click **Save**

### 2. Trigger a Redeploy

After adding the environment variable, you MUST redeploy:

1. Go to: **Deploys** tab
2. Click **Trigger deploy** → **Clear cache and deploy site**

OR simply push a new commit to trigger automatic deployment.

---

## Why This Happens

The frontend code (`familyfinancetracker/src/utils/api.js`) reads the backend URL from:

```javascript
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
```

When `VITE_API_URL` is not set:
- It defaults to `http://localhost:8000` (which doesn't exist in production)
- All API calls fail with network errors
- The app sets `isOffline: true` in the store
- Ask Amma AI shows "unavailable offline" message

---

## Backend URL Details

**Current Backend**: Your FastAPI backend is deployed on Vercel at:
```
https://family-finance-tracker-pearl.vercel.app
```

**Verification**: You can test the backend is working by visiting:
```
https://family-finance-tracker-pearl.vercel.app/docs
```

This should show the FastAPI Swagger UI documentation.

---

## Alternative: Update Backend URL

If your backend URL has changed (e.g., you deployed to a new Vercel account too), update the environment variable to point to the new backend URL.

To find your current backend URL:
1. Go to your Vercel dashboard
2. Find the "family-finance-tracker" project (backend)
3. Copy the production domain URL
4. Use that URL in the Netlify environment variable

---

## Local Development

For local development, the frontend reads from `.env.local`:

```bash
# familyfinancetracker/.env.local
VITE_API_URL=https://family-finance-tracker-pearl.vercel.app
```

This file is already configured correctly in your local repo.

---

## Verify the Fix

After redeploying with the environment variable:

1. Open your Netlify site
2. Go to Dashboard page
3. Click the "Ask Amma AI" button (floating button at bottom-right)
4. You should see the chat interface (not "unavailable offline")
5. Try asking a question like "How much did we spend this month?"
6. The AI should respond (confirming the backend connection works)

---

## Button Overlap Fix (Desktop)

**Issue**: On desktop/laptop, Ask Amma AI and Add Expense buttons overlap

**Fix Applied**: Changed Ask Amma AI button positioning on desktop:
- Mobile: `bottom-24 right-4` (stacked vertically)
- Desktop: `bottom-8 right-24` (side by side)

Result:
- Mobile: Buttons stack vertically (no overlap)
- Desktop: Buttons sit side-by-side at the bottom (no overlap)

---

## Files Modified

1. **Dashboard.jsx**: 
   - FAB button: `lg:bottom-8 lg:right-6`
   - Ask Amma AI button: `lg:bottom-8 lg:right-24`

---

## Quick Checklist

- [ ] Add `VITE_API_URL` environment variable in Netlify
- [ ] Trigger redeploy (clear cache)
- [ ] Verify Ask Amma AI works on deployed site
- [ ] Verify buttons don't overlap on desktop

---

## Support Resources

- **Netlify Environment Variables**: https://docs.netlify.com/environment-variables/overview/
- **Vite Environment Variables**: https://vitejs.dev/guide/env-and-mode.html
- **Vercel Backend Logs**: Check your Vercel dashboard for API errors

---

**Date**: 2026-06-13  
**Status**: Ready to deploy
