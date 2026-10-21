# Finora — historical verification, 16 October 2026

> Recorded under the former Family Finance Tracker name. The results below describe that historical source, not the current release. See [README](README.md) and the [project handoff](docs/FAMILY_FINANCE_TRACKER_HANDOFF.md) for current behavior and later test evidence.

## Reproduced defects and fixes

- Expense deletion: synthetic regression tests initially failed in nine failure cases. The API had reported network/HTTP errors as `{ deleted: true }`, and the hook accepted any truthy response. Both layers now require `deleted === true`; failures preserve the cached/displayed expense and show an actionable, accessible message.
- Expense saving: preserved and completed the existing uncommitted acknowledgement/draft safeguards. Only matching server responses enter the cache; rapid submissions are blocked. Retrying an unchanged draft retains its submission ID, and the server reuses the existing record, including when concurrent requests race. No database migration is required. Editing the draft starts a new submission. Submission IDs last for the current mounted form; after reload/navigation, check History before re-entering an uncertain save.
- Recurring expenses: confirmed primary/child saves are retained, unconfirmed children are explicitly counted, and no automatic resubmission occurs.
- Amma/provider failures: reproduced the old service returning provider failures as successful answers. All three AI endpoints now return sanitized structured failures with stable codes and retryability. Chat shows Retry for transient errors and administrator guidance for configuration failures; conversation is retained. SMS parsing failures retain the entered text.
- Gemini startup: reproduced import failure on client initialization without credentials. Initialization is now lazy, missing/placeholder credentials return a non-retryable 503, and requests use an explicit Gemini Developer API client with a 20-second request timeout. Upgraded the withdrawn `google-genai==1.16.0` release to the non-withdrawn `1.16.1` patch; declared `httpx==0.28.1` explicitly. Real SDK construction is covered without provider traffic.
- Reset: reproduced the static header authorizing deletion of all 12 financial tables using a mock database. No server-verified administrator identity exists. Reset now always returns 403 and has no database dependency, regardless of confirmation or bearer headers. Existing browser PIN behavior is preserved.

## Verification results

- Frontend: `npm test` — 123 passed, 0 failed, 0 skipped. Uses synthetic data and mocked requests, including actual API/hook/form/chat code.
- Backend: `.venv/Scripts/python.exe -I -B -m unittest discover -s backend/tests -v` — 22 passed, 0 failed, 0 skipped. Includes SQLite commit/rollback and concurrent retry tests, provider failure contracts, reset denial, both PostgreSQL drivers, and startup without Gemini credentials. AI tests block external traffic and allow only Windows' standard-library event-loop socketpair implementation.
- Production build: `npm run build` passes, including service worker generation. Vite reports an existing bundle-size warning (approximately 792 kB before compression).
- Dependency consistency: `pip check` passes with `google-genai==1.16.1` installed.
- Initial environmental failures: the system Python alias was inaccessible; downloads were interrupted; sandboxed Vite failed with EPERM on `index.html`; the initial strict socket guard also blocked Windows' event-loop control pipe. Tests/build were rerun after resolving these issues, with no production data access.

## Deployment evidence and limits

- Public frontend `https://scintillating-donut-a597ff.netlify.app` returned HTTP 200, loading `/assets/index-IX59Q-Wp.js`. The alternative hostname in old local notes returned 404.
- Backend `https://family-finance-tracker-pearl.vercel.app/health` returned HTTP 200 with `{"status":"ok","database":"connected"}`.
- Vercel production deployment `dpl_nWwEL7aAYj94vNchXeja2wgKu9RR` is READY and identifies source commit `175c0b7bf6fc968afed583739e46bcd324b42f3e`. The starting local HEAD was `75675e0601fe197bbb21c2bc935d84c7a4113a9d`; these repairs are newer than both.
- A live POST to `/api/ai/chat` with a synthetic greeting, synthetic context marker and empty history returned HTTP 200 with a meaningful greeting. No household data was transmitted.
- The live API schema still lists `/api/reset` and declares no authentication scheme or security requirement. No destructive production call was made.
- Deployment was not performed: Vercel project access returned 403 for team `team_FgAW7JGzyxjTv3cniaU871xG`; no authenticated Vercel CLI fallback was available. No authenticated Netlify deployment integration was available. The live frontend's exact source SHA could not be established.
- Live save/delete workflows were not exercised because no isolated test household or database is configured. Their local behavior is covered by regression tests, but this is not evidence that the current production version contains the fixes.

## Remaining blockers

- Restore deployment access to the existing Vercel project and Netlify site, deploy the verified source, then verify against an isolated test household. Production still has the old reset implementation until deployment.
- Other finance routes have no server-side authentication/authorization; browser PINs are not an API security boundary. The reset fix does not establish application-wide security. A separate authenticated API design is needed without changing existing household access unexpectedly.
- A pre-existing untracked local deployment note contains a credential-looking value. It was not uploaded, included in these changes, or tested; review and rotate it if it is a real credential.
- Existing unrelated local notes and the `portfolio/` directory were preserved.
