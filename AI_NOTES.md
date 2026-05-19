# AI collaboration notes

> **Before you submit:** Replace bracketed parts with your own voice. Keep answers specific (file names, errors you saw, what you changed).

## 1. Which parts of the system did the AI write end-to-end?

- The **first-pass implementation** of the repo layout (`client/` + `server/` workspaces), Express handlers for `/items`, `/vote`, `/results`, `/my-votes`, `/matches`, `/analytics`, `/vote/undo`, the **SQLite schema** (`server/src/db.ts`), the **110-row seed** (`server/seed.ts`), the **React** tab shell (Swipe / Results / Matches), the **gesture card** (`client/src/components/SwipeCard.tsx`), **WebSocket** notify on vote, **`README.md` outline**, and this **notes template** were produced with AI assistance.
- I still need to be able to explain **every line** in the final submission (per the brief) — treat the code as *mine after review*.

## 2. Where did you push back on, fix, or rewrite the AI’s output? (One concrete example)

- **Database driver:** An initial approach using `better-sqlite3` **failed to compile** locally (`node-gyp` / toolchain / Python mismatch during `npm install`). I **removed the native dependency** and reworked persistence to **`node:sqlite` (`DatabaseSync`)**, which is built into Node 22+.
- SQL **`@named` parameters** used with `better-sqlite3` were rewritten to **positional `?` placeholders** compatible with `node:sqlite`.
- The `better-sqlite3` **`db.transaction()` wrapper** was replaced with explicit **`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`** in a small `runInTransaction()` helper.

## 3. One thing the AI did better than expected / one thing worse

- **Better:** Rapid **vertical slice** (seed → API → swipe → results) so I could test the happy path quickly instead of debating libraries forever.
- **Worse:** It assumed **native addons always install**; I had to downgrade/resolve that with a **different persistence stack** than originally sketched.

## 4. Other AI tools used (if any)

- [Add: Copilot / inline completions / none / etc.]

---

**Integrity note:** The rubric rewards **honest, specific** collaboration notes — not pretending the work was written entirely without tools.
