# Coy Discover

A standalone, mobile-first Discover experience for the Coy SDE Intern Assignment. The Home tab intentionally stays blank. All discovery and matching features live in Discover.

Built with **React, Vite, Node.js, and Express**. The assignment permits React and Express; this implementation uses that option rather than Next.js. No signup, API keys, external auth, or paid services are needed. One logged-in user is assumed.

## Run locally

Install Node.js **22.12 or newer**, then open a terminal in this folder:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The API runs on port 3107, and Vite forwards API requests to it. Keep both ports free. If you override `PORT`, also update the proxy target in `vite.config.js` for development.

To run the production version:

```sh
npm run build
npm start
```

Open **http://localhost:3107**. Express serves both the built frontend and the API.

## Demo in two minutes

1. Open Discover. The first profile is Aanya.
2. Like Aanya using the heart button or a right swipe. She has a seeded incoming like, so the mutual-match dialog appears.
3. Open Matches to see the connection. Return to Discover.
4. Like Kabir. This is a one-sided like and produces no match notification.
5. Pass on Meera. Neither Kabir nor Meera appears in the feed again.
6. Like Arjun to demonstrate another mutual match.
7. Reload the page, or stop and restart the server. Your swipes and matches remain saved.
8. Keep swiping until the feed ends to see the empty state. Home remains blank throughout.

Desktop controls: buttons, or left/right arrow keys while the card or page is focused. On mobile, drag the card horizontally. A short drag returns the card to its starting position. Dialogs support Escape and keyboard focus containment. Reduced-motion preferences are respected.

## API

| Endpoint | Request | Response |
| --- | --- | --- |
| `GET /feed` | None | `{ "profiles": [...] }`, excluding every previously liked or passed profile |
| `POST /swipe` | `{ "profileId": "p01", "action": "like" }` or `"pass"` | `{ "matched": true, "createdMatch": true, "alreadySwiped": false, "match": { "profile": {...}, "matchedAt": "..." } }` |
| `GET /matches` | None | `{ "matches": [{ "profile": {...}, "matchedAt": "..." }] }`, mutual matches only |
| `GET /health` | None | `{ "status": "ok" }` |

For a non-match, `matched` and `createdMatch` are false and `match` is null. Repeating the same swipe is idempotent: it returns the existing outcome with `createdMatch: false`. Changing an existing swipe returns HTTP 409. Invalid requests return 400, unknown profiles return 404, and storage failures return 500.

## Privacy and persistence

- There are **32 fictional adult profiles** with name, age, photo, bio, city, college, and interests.
- Incoming likes exist exclusively in `server/profiles.js`. They are never sent as a feed flag, count, badge, or separate endpoint. This server file is not part of the frontend bundle.
- `publicProfile()` explicitly allows only public profile fields, protecting against accidental future serialization of private fields.
- A match requires both an outgoing `like` and a server-side incoming like. A pass cannot produce a match, even if the other person liked the user.
- Swipes and matches persist in `data/state.json`, which is created on the first swipe. API responses use `Cache-Control: no-store`.
- Writes are serialized, protected by an exclusive lock across app instances sharing the file, and committed through an atomic rename. Failed writes do not replace the file with partial JSON. Corrupt state is reported rather than silently erased.
- Simultaneous requests and identical retries cannot create duplicate matches. The browser locks controls during a request and advances only after the server has acknowledged it.
- All portraits and fonts are bundled locally; normal app use does not contact third-party image or font servers.
- This is a single-user assignment demo. The public repository includes fictional seed data, including the incoming-like set. Its privacy guarantee applies to runtime API/UI behavior; it is not secrecy from someone reading the public source. A real product would store private likes in an authenticated database.

To start a fresh demo, **stop the server**, then run `npm run reset` and restart. Reset is an explicit developer action; the UI never recycles swiped profiles. If a process is force-killed during a transaction and leaves `data/state.json.lock`, stop all app instances and remove that lock file before restarting.

## Tests

```sh
npm test
npm run build
```

The 11 automated backend tests cover complete seed data, explicit public-field serialization, private incoming likes, mutual matching, one-sided likes, passes, idempotency, conflicting retries, invalid requests, persistence across app instances, concurrent writes, feed exhaustion, and corrupt data.

## Deploy

Any Node-capable host can run `npm ci && npm run build` as the build step and `npm start` as the start command. Set `PORT` if the host provides one. Set `DATA_FILE` to a writable path on a **persistent disk**, for example `/var/data/coy-state.json`.

Do not use an ephemeral or read-only serverless filesystem when persistence is required. Use a single long-running service with durable storage. For Docker:

```sh
docker build -t coy-discover .
docker run --rm -p 3107:3107 -v coy-data:/app/data coy-discover
```

## Submission

Public GitHub repository: **https://github.com/Vishesh162/coy-assignment**. Submit this URL for Part B. The repository includes the source, tests, assets, documentation, and package lockfile; generated build files, dependencies, and local swipe data are excluded.

See `SUBMISSION_CHECKLIST.md` for the remaining Part B submission steps. Part A's exploration of Coy is handled separately.

## Project structure

```text
src/             React UI, drag gestures, animations, match dialog
server/          Express API, public seed profiles, private incoming likes, JSON store
tests/           Isolated backend integration tests
public/          Bundled portraits, fonts, and icons
scripts/         Development launcher and explicit demo reset
```

Asset provenance and font licenses are documented in `ASSETS.md` and `public/fonts/`.
