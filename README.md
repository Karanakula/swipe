# Landmark Swipe — Swipe-to-Vote (Mobile Web)

Mobile-first web app: swipe through **110 landmark-inspired picks** (placeholder photos) and vote **yes/no**. Votes are stored in **SQLite** via a small **Express** API so aggregates reflect **all users**. Optimized layout for a **390×844** viewport; mouse drag works on desktop for grading.

## Theme

**“Hypothetical landmark trips”** — each card is a stylized destination cue (mix of ruin / skyline / park / island / mountain templates in the copy). You are deciding **whether you would book a trip there tomorrow** — a lightweight, judgment-based theme suitable for rapid swiping.

## Quick start

**Requirements**

- **Node.js ≥ 22.12** (for [`node:sqlite`](https://nodejs.org/api/sqlite.html) — built-in module, no native SQLite compile).
- Network access for **Lorem Picsum** images (`picsum.photos`).

**Install**

```bash
npm install
```

**Seed the database (110 items)**

```bash
npm run seed
```

**Run API + UI together**

```bash
npm run dev
```

- API: `http://localhost:3333`  
- Client (Vite): `http://localhost:5173` (set `VITE_API_URL` if you change the port — see `.env.example`)

If you see **`EADDRINUSE` on port 3333**, something else is already listening (often a stray `tsx watch`). Stop it or run the API on another port (`PORT=3340 npm run dev -w server`) and put `VITE_API_URL=http://localhost:3340` in `client/.env.local`.

**Build for production assets**

```bash
npm run build
```

Then start only the API (open the Vite preview separately, or point static hosting at `client/dist`):

```bash
npm run start -w server
```

## Architecture (short)

- **Client** (`client/`): React + Vite + TypeScript — **Outfit / Plus Jakarta Sans typography**, **≤390 px capped shell**, **CLS-safe heroes** (`aspect-ratio: 480/640`, intrinsic `width`/`height`). **`@use-gesture/react`** + **`@react-spring/web`**: swipe tilt + **green/red tints**, **threshold rail/shuttle**, **pull-down cyan curtain** cue for Results; **buttons fire the same fly-out** animation as gestures. Tabs: Swipe · Results · Matches. Pull-down release **or** Results tab navigates aggregates. Undo + session UUID caching as before.
- **Server** (`server/`): Express JSON API, **`node:sqlite`** file DB under `server/data/swipe.sqlite`. **WebSocket** (`/ws`) broadcasts `results_updated` after each vote so open clients can refresh aggregates (stretch: real-time; polling would also meet the brief).

## Vote de-duplication (required)

For each `(session_id, item_id)` pair there is **at most one row** in `votes` (primary key).  
`POST /vote` uses **`INSERT … ON CONFLICT DO UPDATE`** so repeat submissions **replace** the previous choice instead of incrementing counts twice. Documented behavior: **latest vote wins** per session per item.

## Persistence choice (SQLite via `node:sqlite`)

- **Pros**: Single file, zero extra services, **no native addon build** (relevant when `better-sqlite3` fails on some Node/toolchain combos), easy to reset for graders (`rm server/data/swipe.sqlite && npm run seed`).
- **Cons**: Node marks the module **experimental** (may emit a startup warning); not a fit for huge write concurrency (fine for this exercise).

## API (as specified)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/items` | All votable items |
| `POST` | `/vote` | Body: `{ itemId, choice: "yes"\|"no", sessionId }` — optional `decisionMs` for analytics |
| `GET` | `/results` | Per-item yes/no aggregates |

Additional endpoints used by the app: `GET /my-votes`, `POST /vote/undo`, `GET /matches`, `GET /analytics`, `GET /health`, `WebSocket /ws`.

## Admin / seed scripts

- **Seed 110 items**: `npm run seed` (implemented in `server/seed.ts`).
- **Add one item without code changes**:  
  `npm run add-item -- --id my-id --label "Label" --image "https://..." --desc "optional"`  
  (`SWIPE_DB_PATH` overrides DB location.)

## Media credits

- Photos are **deterministic Lorem Picsum** URLs (`https://picsum.photos/seed/...`) — placeholder stock-style imagery suitable for a classroom demo.  
  Source: [Lorem Picsum](https://picsum.photos/).

## Requirements checklist

### Core (Section 3.1)

| Requirement | Status |
|-------------|--------|
| Documented voting theme | Yes (`README`, UI) |
| ≥100 distinct items with image + label + description | Yes (110 seeded) |
| Swipe right = yes, left = no; Yes/No buttons | Yes |
| Visual feedback: tilt, color hints, threshold cue, smooth next card | Yes |
| Results view: pull-down **or** tab; global aggregates per item | Yes |
| Sort/filter on results | Yes (sort + text filter) |
| Backend persistence (not `localStorage` as source of truth) | Yes |
| End-of-deck state | Yes |
| Required endpoints `/items`, `/vote`, `/results` | Yes |
| Idempotent per user/item | Yes (see above) |
| Input validation on server | Yes |
| README: run, architecture, trade-offs | This file |

### Stretch (Section 3.2) — **all implemented**

| # | Feature | How |
|---|---------|-----|
| 7 | Session identity | UUID in `localStorage`; votes survive reload via `GET /my-votes` |
| 8 | Undo | `POST /vote/undo` + UI button |
| 9 | Matches view | `GET /matches` + slider threshold |
| 10 | Real-time aggregates | WebSocket broadcast + client refetch |
| 11 | Admin seed script | `seed.ts` + `scripts/add-item.ts` |
| 12 | Basic analytics | `GET /analytics` + footer strip |

## Known issues / limits

- **Node** may print an **ExperimentalWarning** for `node:sqlite` — expected until the API is fully stable.
- **Images** load from the network; offline runs show broken images unless you swap URLs to local assets.
- **No authentication** — session id is client-controlled (acceptable for the stated anonymous model; documented trade-off).
- **Undo** applies to the **last action in the current browser session** (stack resets on full page reload; server votes remain).
- **Concurrent writes**: WAL mode helps; this assignment workload is light; heavy parallel load was not a goal.

## AI usage reflection

See **`AI_NOTES.md`** (required brief — personalize before submit).

## Suggested demo checklist (2–3 min)

1. Show swipe gestures (tilt + green/red) and **progress** `n / 110`.
2. Vote with **buttons**; open **Results** tab — sort modes + search.
3. Open **Matches** after a few **yes** votes; adjust threshold.
4. Mention **session** persistence (refresh page, resume queue) and **WebSocket** “Live” pill.
