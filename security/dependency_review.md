# Dependency remediation — 17 October 2026

Source baseline: `aee36c95e34d2b5e596cc36a3ab80806a55735b2`.
Reports came from the npm registry audit endpoint and the committed lockfile.
The baseline had 18 affected packages: 13 high and 5 moderate. The final full
audit has 7 affected packages: 5 high and 2 moderate, all build/development-only.
`npm audit --omit=dev` reports zero findings. Counts are affected packages, not
independent vulnerabilities; several entries propagate the same transitive flaw.

| Package | Baseline version | Severity | Use | Candidate version | Patched version / status |
| --- | --- | --- | --- | --- | --- |
| baseline-browser-mapping | 2.10.34 | Moderate | Build | 2.11.29 | >=2.11.0; resolved |
| brace-expansion | 5.0.6 / 2.1.1 | High | Build | 5.0.12 / 2.1.7 | 5.0.12 / 2.1.7 cover reported advisories; resolved |
| braces | 3.0.3 | High | Build | 3.0.3 | Still affected; npm recommends moving the parent Tailwind dependency to 4.3.3 |
| browserslist | 4.28.2 | High | Build | 4.29.3 | >4.28.6; resolved |
| chokidar | 3.6.0 | High | Build | 3.6.0 | Transitive braces finding; remains through Tailwind 3 |
| esbuild | 0.21.5 | Moderate | Build/dev server | 0.25.12 | >=0.25.0; resolved |
| fast-glob | 3.3.3 | High | Build | 3.3.3 | Transitive glob/braces finding; remains through Tailwind 3 |
| fast-uri | 3.1.2 | High | Build | 3.1.8 | >=3.1.8 covers all reported advisories; resolved |
| micromatch | 4.0.8 | High | Build | 4.0.8 | Transitive braces finding; remains through Tailwind 3 |
| nanoid | 3.3.12 | High | Build | 3.3.20 | >=3.3.18; resolved |
| postcss | 8.5.15 | High | Build | 8.5.30 | >8.5.22; resolved |
| postcss-selector-parser | 6.1.2 | Moderate | Build | 6.1.4 | >=7.1.6 needed for remaining quadratic-complexity finding |
| react-router | 6.30.4 | Moderate | Browser runtime | 7.18.4 | >=7.18.0; resolved |
| react-router-dom | 6.30.4 | Moderate | Browser runtime | 7.18.4 | 6.30.6 fixes one advisory; 7.18.4 also fixes inherited router advisories |
| source-map-js | 1.2.1 | High | Build | 1.2.2 | >=1.2.2; resolved |
| tailwindcss | 3.4.19 | High | Build | 3.4.19 | Parent of remaining transitive findings; npm suggests 4.3.3 |
| vite | 5.4.21 | High | Build/dev server | 6.4.3 | >6.4.2 for reported Vite issues, with patched esbuild; resolved |
| vite-plugin-pwa | 0.19.8 | High | Build | 0.21.2 | Compatible with Vite 6; no final audit finding |
| postcss-nested | 6.2.0 | Moderate (final audit) | Build | 6.2.0 | Final audit also flags this parent of the affected selector parser |

## Changes retained and checked

- Applied compatible registry-recommended updates without `--force` and with
  installation scripts disabled. The lockfile records the exact transitive tree.
- Explicitly selected React Router 7.18.4 after checking its Node/React peers
  and the app's flat declarative routes. Added two tests using the actual App
  route tree and installed React/Router, covering all eight protected pages.
- Selected Vite 6.4.3 and PWA 0.21.2 instead of npm's broader Vite 8/PWA 2
  suggestion. Verified compatibility with the existing React plugin 4.7.0.
- Declared Node >=22 and added `.nvmrc` with 22: the already-installed
  Supabase SDK 2.118.0 requires Node >=22. Tests/build ran with Node 22.20.0.
- `npm ls --depth=0` passes without peer errors; 139 frontend tests pass;
  production bundling and service-worker generation pass. The local browser
  redirects `/expenses` to sign-in with no console errors. Missing sign-in
  configuration is displayed explicitly; no email was sent.

## Remaining work

The seven remaining findings share the Tailwind 3 build dependency chain. The
braces issue concerns deeply nested untrusted patterns; the selector-parser
issue concerns expensive selector parsing. These packages run while building or
developing, not as the browser's database/authentication runtime. Do not treat
that distinction as a clean full audit, or run builds on untrusted templates.

Removing them requires a deliberate Tailwind 4/postcss pipeline migration and
visual regression checks. No forced overrides or stylesheet migration was
performed as part of this authentication release.

Upstream evidence:
- https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6
- https://github.com/remix-run/react-router/blob/v7/docs/upgrading/v6.md
- https://v6.vite.dev/guide/migration.html
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- https://docs.npmjs.com/cli/v11/commands/npm-audit/
