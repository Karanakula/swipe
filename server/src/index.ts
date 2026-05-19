import cors from "cors";
import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";
import { openDb, runInTransaction } from "./db.js";
import { clamp, isChoice, isUuid } from "./validation.js";

const PORT = Number(process.env.PORT ?? 3333);

const db = openDb();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

/** Broadcast helper set after server listens */
let broadcastResults: () => void = () => {};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/items", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, label, description, image_url AS imageUrl FROM items ORDER BY id`
    )
    .all() as {
      id: string;
      label: string;
      description: string;
      imageUrl: string;
    }[];
  res.json({ items: rows });
});

/** User's current votes — enables resume after reload (session persistence). */
app.get("/my-votes", (req, res) => {
  const sessionId = req.query.sessionId;
  if (!isUuid(sessionId)) {
    res.status(400).json({ error: "sessionId query must be a UUID v4 string" });
    return;
  }
  const rows = db
    .prepare(
      `SELECT item_id AS itemId, choice, voted_at AS votedAt FROM votes WHERE session_id = ?`
    )
    .all(sessionId) as { itemId: string; choice: "yes" | "no"; votedAt: number }[];
  res.json({ votes: rows });
});

app.get("/results", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        i.id AS itemId,
        i.label AS label,
        COALESCE(SUM(CASE WHEN v.choice = 'yes' THEN 1 ELSE 0 END), 0) AS yesCount,
        COALESCE(SUM(CASE WHEN v.choice = 'no' THEN 1 ELSE 0 END), 0) AS noCount
      FROM items i
      LEFT JOIN votes v ON v.item_id = i.id
      GROUP BY i.id
    `
    )
    .all() as {
    itemId: string;
    label: string;
    yesCount: number;
    noCount: number;
  }[];

  const results = rows.map((r) => ({
    itemId: r.itemId,
    label: r.label,
    yes: r.yesCount,
    no: r.noCount,
    total: r.yesCount + r.noCount,
  }));
  res.json({ results });
});

type VoteBody = {
  itemId?: unknown;
  choice?: unknown;
  sessionId?: unknown;
  decisionMs?: unknown;
};

app.post("/vote", (req, res) => {
  const body = req.body as VoteBody;
  const itemId = body.itemId;
  const choice = body.choice;
  const sessionId = body.sessionId;
  const decisionMsRaw = body.decisionMs;

  if (!isUuid(sessionId)) {
    res.status(400).json({ error: "sessionId must be a UUID v4 string" });
    return;
  }
  if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 128) {
    res.status(400).json({ error: "itemId must be a non-empty string (max 128 chars)" });
    return;
  }
  if (!isChoice(choice)) {
    res.status(400).json({ error: 'choice must be "yes" or "no"' });
    return;
  }

  let decisionMs: number | null = null;
  if (decisionMsRaw !== undefined && decisionMsRaw !== null) {
    if (typeof decisionMsRaw !== "number" || !Number.isFinite(decisionMsRaw)) {
      res.status(400).json({ error: "decisionMs must be a finite number when provided" });
      return;
    }
    decisionMs = Math.round(clamp(decisionMsRaw, 0, 10 * 60 * 1000));
  }

  const itemExists = db.prepare(`SELECT 1 FROM items WHERE id = ?`).get(itemId);
  if (!itemExists) {
    res.status(404).json({ error: "Unknown itemId" });
    return;
  }

  const now = Date.now();

  const upsertVote = db.prepare(`
    INSERT INTO votes (session_id, item_id, choice, voted_at, decision_ms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id, item_id) DO UPDATE SET
      choice = excluded.choice,
      voted_at = excluded.voted_at,
      decision_ms = excluded.decision_ms
  `);

  const upsertSession = db.prepare(`
    INSERT INTO sessions_meta (session_id, first_seen_at, last_seen_at)
    VALUES (?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
  `);

  runInTransaction(db, () => {
    upsertVote.run(sessionId, itemId, choice, now, decisionMs);
    upsertSession.run(sessionId, now, now);
  });

  broadcastResults();
  res.status(200).json({ ok: true, deduped: "latest_vote_wins" });
});

/** Stretch: undo = delete user's vote for an item (client sends last itemId) */
app.post("/vote/undo", (req, res) => {
  const body = req.body as { sessionId?: unknown; itemId?: unknown };
  if (!isUuid(body.sessionId)) {
    res.status(400).json({ error: "sessionId must be a UUID v4 string" });
    return;
  }
  if (typeof body.itemId !== "string" || body.itemId.length === 0) {
    res.status(400).json({ error: "itemId required" });
    return;
  }
  const info = db
    .prepare(`DELETE FROM votes WHERE session_id = ? AND item_id = ?`)
    .run(body.sessionId, body.itemId) as { changes: number };
  if (!Number(info.changes)) {
    res.status(404).json({ error: "No vote to undo for this item" });
    return;
  }
  broadcastResults();
  res.json({ ok: true });
});

/**
 * Stretch: items where this session voted yes AND global yes-rate >= threshold (0–1).
 */
app.get("/matches", (req, res) => {
  const sessionId = req.query.sessionId;
  const th = req.query.threshold;
  if (!isUuid(sessionId)) {
    res.status(400).json({ error: "sessionId query must be a UUID v4 string" });
    return;
  }
  let threshold = 0.55;
  if (th !== undefined) {
    const n = Number(th);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      res.status(400).json({ error: "threshold must be between 0 and 1" });
      return;
    }
    threshold = n;
  }

  const rows = db
    .prepare(
      `
      WITH agg AS (
        SELECT
          item_id,
          SUM(CASE WHEN choice = 'yes' THEN 1 ELSE 0 END) AS yes_count,
          SUM(CASE WHEN choice = 'no' THEN 1 ELSE 0 END) AS no_count
        FROM votes
        GROUP BY item_id
      )
      SELECT
        i.id AS itemId,
        i.label AS label,
        i.description AS description,
        i.image_url AS imageUrl,
        a.yes_count AS yesCount,
        a.no_count AS noCount
      FROM agg a
      JOIN items i ON i.id = a.item_id
      JOIN votes my ON my.item_id = i.id AND my.session_id = ? AND my.choice = 'yes'
      WHERE (a.yes_count + a.no_count) > 0
        AND (CAST(a.yes_count AS REAL) / (a.yes_count + a.no_count)) >= ?
      ORDER BY (CAST(a.yes_count AS REAL) / (a.yes_count + a.no_count)) DESC
    `
    )
    .all(sessionId, threshold) as {
    itemId: string;
    label: string;
    description: string;
    imageUrl: string;
    yesCount: number;
    noCount: number;
  }[];

  const matches = rows.map((r) => {
    const total = r.yesCount + r.noCount;
    const yesRate = total === 0 ? 0 : r.yesCount / total;
    return {
      itemId: r.itemId,
      label: r.label,
      description: r.description,
      imageUrl: r.imageUrl,
      yesRate,
      yes: r.yesCount,
      no: r.noCount,
    };
  });
  res.json({ matches, threshold });
});

/** Stretch: basic analytics */
app.get("/analytics", (_req, res) => {
  const totalVotes = (
    db.prepare(`SELECT COUNT(*) AS c FROM votes`).get() as { c: number }
  ).c;
  const sessions = (
    db.prepare(`SELECT COUNT(*) AS c FROM sessions_meta`).get() as { c: number }
  ).c;
  const avgDecision = db
    .prepare(
      `SELECT AVG(decision_ms) AS a FROM votes WHERE decision_ms IS NOT NULL`
    )
    .get() as { a: number | null };

  res.json({
    totalVoteRecords: totalVotes,
    uniqueSessions: sessions,
    averageDecisionMs: avgDecision.a == null ? null : Math.round(avgDecision.a),
  });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "hello" }));
});

broadcastResults = () => {
  const payload = JSON.stringify({ type: "results_updated" });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
};

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${PORT} is already in use. Stop the existing process or run with a different port, e.g.:\n` +
        `  PORT=3340 npm run dev -w server\n` +
        `  # then create client/.env.local with:\n` +
        `  # VITE_API_URL=http://localhost:3340\n`
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`WebSocket at ws://localhost:${PORT}/ws`);
});
