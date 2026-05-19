# AI collaboration notes

Honest record of how AI tools were used on this project, per the assignment brief. I reviewed and ran everything locally before considering it “done.”

---

## 1. Which parts of the system did the AI write end-to-end?

Most of the **first working version** came from AI pair-programming in **Cursor** (chat + edits), not line-by-line typing from scratch. Concretely, AI drafted or heavily scaffolded:

- **Monorepo layout** — root `package.json` workspaces, `client/` (Vite + React + TS) and `server/` (Express + TS).
- **Backend** — `server/src/index.ts` (all REST routes, WebSocket on `/ws`, vote upsert + broadcast), `server/src/db.ts` (schema + `openDb()`), `server/src/validation.ts`, `server/seed.ts` (110 items), and `server/scripts/add-item.ts`.
- **Frontend** — `App.tsx` tab shell, `SwipeDeck.tsx`, `SwipeCard.tsx` (gestures + springs), `ResultsPanel.tsx`, `MatchesPanel.tsx`, `AnalyticsStrip.tsx`, plus `lib/api.ts` and `lib/session.ts`.
- **Docs / hygiene** — `README.md` structure (install, architecture, requirements tables), `.gitignore` fixes so WAL sidecars and `dist/` don’t get committed, and the first draft of this file.

What I did **not** treat as “fire and forget”: I still stepped through votes in the UI, hit the API with wrong payloads to see 400s, re-ran `npm run seed` after deleting the DB, and read the SQL for `/matches` until the threshold behavior made sense. The rubric expects me to explain the code in a demo — so anything AI wrote, I treated as a draft I own after review.

---

## 2. Where did you push back on, fix, or rewrite the AI’s output?

**Example: swapping the database stack after `npm install` blew up.**

The first sketch used **`better-sqlite3`**. On my Mac, install died in **`node-gyp`** — missing/wrong Python toolchain, the usual native-addon pain. Rather than spending an hour fighting Xcode CLI tools for a class project, I pushed back: drop the native module and use Node’s built-in **`node:sqlite`** (`DatabaseSync` in `server/src/db.ts`).

That wasn’t a one-line change. I had to:

1. Rewrite queries from **`@named` parameters** (what the AI had written for `better-sqlite3`) to **positional `?`** placeholders, which `node:sqlite` expects.
2. Replace `db.transaction(() => { ... })` with a small **`runInTransaction()`** helper that runs `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` manually — see `server/src/db.ts`.
3. Accept a startup **`ExperimentalWarning`** from Node until the API is stable (documented in the README under known issues).

A smaller but real fix: the initial **`.gitignore`** ignored `*.sqlite` but not **`*.sqlite-shm`** / **`*.sqlite-wal`**. After `git status` showed those files as untracked, I had it updated so I wouldn’t accidentally push my local dev database artifacts.

Another tweak I cared about: **`SwipeCard.tsx`** — the AI’s first gesture thresholds felt either too twitchy or too stiff on a 390px-wide layout. I nudged commit distance and spring config until a deliberate swipe and a button tap both felt like the same “card flies off, next one appears” moment.

---

## 3. One thing the AI did better than expected / one thing worse

**Better than expected:** Getting a **full vertical slice** in one pass — `npm run seed`, `npm run dev`, swipe a card, see counts move on Results, WebSocket “Live” pill updating when I had two tabs open. That saved a lot of yak-shaving about folder structure and endpoint shapes. The **matches query** (join user yes-votes with global yes-rate) was also faster to iterate on with AI than writing SQL cold.

**Worse than expected:** It **over-assumed my environment** — native SQLite bindings “just work,” port 3333 is always free, images are always local. I hit **`EADDRINUSE`** when a stray `tsx watch` was still running; the README troubleshooting table exists because that actually happened. It also reached for **`better-sqlite3`** by default even though the brief only needs a file DB and Node 22+ already ships SQLite. I should have specified “no native addons” earlier.

---

## 4. Other AI tools used (if any)

- **Cursor** (Agent / chat) — primary tool for scaffolding, refactors, README, and `.gitignore`.
- **No GitHub Copilot** or separate ChatGPT thread for this repo; if I used inline completions in the editor, they were minor (import paths, boilerplate) and not worth listing separately.

---

## Integrity note

This project was built **with** AI assistance, not despite it. The useful part for grading isn’t hiding that — it’s being clear about what broke (native install), what we changed (`node:sqlite`, positional SQL, gitignore), and what I can still explain live in a demo.
