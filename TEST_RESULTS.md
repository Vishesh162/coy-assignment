# Verification results

## Current stack

React 19 frontend, Next.js 16.4.6 App Router backend running on Node.js, and persistent JSON storage. The React interface keeps the supplied Coy styling. Home remains blank.

## Backend: 13 tests passed

Run `npm test`.

The tests verify 32 complete adult profiles, server-only incoming likes, an explicit public-field allowlist, matching only on reciprocal likes, private one-sided likes, passes, idempotent retries, conflicting-action rejection, invalid and oversized requests, no-store JSON responses, persistence across handler instances, serialized concurrent writes, feed exhaustion, and safe handling of corrupt stored data.

## Real Next.js browser checks: 10 passed

Run `npm run build` followed by `npm run test:browser` with Chrome or Edge installed. These checks start the actual production Next.js app on an isolated port and use a separate JSON file; they do not reset local demo data.

1. All 32 portraits load, profile fields are complete, 9 incoming likes stay server-only, and only one profile card is rendered.
2. Desktop Like animates the card, shows its feedback stamp, locks duplicate input, and opens the mutual-match dialog.
3. Matches renders the connection; a browser reload retains it and excludes the swiped profile from the feed.
4. A keyboard one-sided like produces no match, and the desktop Pass button advances the feed.
5. Actual mobile touch gestures: right creates a mutual match, left passes, and a short drag returns without recording a swipe.
6. A failed swipe keeps its card and displays an error; retry records one successful choice.
7. Home remains blank and Discover remains reachable.
8. Reduced-motion preferences disable the card animation.
9. Exhausting all 32 profiles shows the empty state; reload never recycles profiles and keeps both demo mutual matches.
10. No uncaught browser errors.

The browser run also checks horizontal overflow at 1440, 1024, 820, 768, 390, and 320 pixels. Screenshots and a machine-readable result are saved in the ignored `.taste-skill/requirements-*/` folder.

## Build

`npm run build` passed with Next.js 16.4.6. The build includes `/` and the dynamic Node.js routes `/feed`, `/swipe`, `/matches`, and `/health`.

## Deployment and submission

The Dockerfile has been updated for the Next.js build. Docker execution and deployment to an external host have not been tested. JSON persistence requires a writable persistent disk on the deployment host.

Source repository: https://github.com/Vishesh162/coy-assignment. No assignment submission has been sent.
