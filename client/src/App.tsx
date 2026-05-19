import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAnalytics,
  fetchItems,
  fetchMatches,
  fetchMyVotes,
  fetchResults,
  postUndo,
  postVote,
  resultsWebSocketUrl,
  type Item,
  type MatchRow,
  type ResultRow,
  type VoteChoice,
} from "./lib/api.js";
import { getOrCreateSessionId } from "./lib/session.js";
import { AnalyticsStrip } from "./components/AnalyticsStrip.js";
import { MatchesPanel } from "./components/MatchesPanel.js";
import { ResultsPanel } from "./components/ResultsPanel.js";
import { SwipeDeck } from "./components/SwipeDeck.js";

type Tab = "swipe" | "results" | "matches";

export default function App() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [tab, setTab] = useState<Tab>("swipe");
  const [items, setItems] = useState<Item[]>([]);
  const [voted, setVoted] = useState<Record<string, VoteChoice>>({});
  const [results, setResults] = useState<ResultRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchThreshold, setMatchThreshold] = useState(0.55);
  const [analytics, setAnalytics] = useState<Awaited<
    ReturnType<typeof fetchAnalytics>
  > | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [undoStack, setUndoStack] = useState<string[]>([]);

  const refreshResults = useCallback(async () => {
    const [r, a] = await Promise.all([fetchResults(), fetchAnalytics()]);
    setResults(r);
    setAnalytics(a);
  }, []);

  const refreshMatches = useCallback(async () => {
    const m = await fetchMatches(sessionId, matchThreshold);
    setMatches(m.matches);
  }, [sessionId, matchThreshold]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [it, mv] = await Promise.all([
          fetchItems(),
          fetchMyVotes(sessionId),
        ]);
        if (cancelled) return;
        const record: Record<string, VoteChoice> = {};
        for (const v of mv.votes) record[v.itemId] = v.choice;

        setItems(it);
        setVoted(record);
        await refreshResults();
        if (cancelled) return;
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshResults]);

  useEffect(() => {
    if (tab !== "matches") return;
    void refreshMatches();
  }, [tab, refreshMatches]);

  useEffect(() => {
    const url = resultsWebSocketUrl();
    let ws: WebSocket | null = null;
    let reconnect: number | undefined;

    const connect = () => {
      ws = new WebSocket(url);
      ws.addEventListener("open", () => setLive(true));
      ws.addEventListener("close", () => {
        setLive(false);
        reconnect = window.setTimeout(connect, 1200);
      });
      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string };
          if (msg.type === "results_updated") void refreshResults();
        } catch {
          // ignore
        }
      });
    };

    connect();
    return () => {
      if (reconnect) window.clearTimeout(reconnect);
      ws?.close();
      setLive(false);
    };
  }, [refreshResults]);

  const queue = useMemo(() => {
    return items.filter((i) => voted[i.id] == null);
  }, [items, voted]);

  const current = queue[0] ?? null;
  const next = queue[1] ?? null;

  const totalCount = items.length;
  const votedCount = totalCount > 0 ? totalCount - queue.length : 0;

  const handleVote = async (choice: VoteChoice, decisionMs: number, itemId: string) => {
    try {
      await postVote({ sessionId, itemId, choice, decisionMs });
      setUndoStack((s) => [...s, itemId]);
      setVoted((v) => ({ ...v, [itemId]: choice }));
      await refreshResults();
      await refreshMatches();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleUndo = async () => {
    const itemId = undoStack.at(-1);
    if (!itemId) return;
    try {
      await postUndo(sessionId, itemId);
      setUndoStack((s) => s.slice(0, -1));
      setVoted((v) => {
        const nextMap = { ...v };
        delete nextMap[itemId];
        return nextMap;
      });
      await refreshResults();
      await refreshMatches();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <div className="brand">Landmark Swipe</div>
          <div className="subtle small">Global landmark speed-judging</div>
        </div>
        <nav className="tabs" aria-label="Primary">
          <button
            type="button"
            className={tab === "swipe" ? "tab active" : "tab"}
            onClick={() => setTab("swipe")}
          >
            Swipe
          </button>
          <button
            type="button"
            className={tab === "results" ? "tab active" : "tab"}
            onClick={() => setTab("results")}
          >
            Results
          </button>
          <button
            type="button"
            className={tab === "matches" ? "tab active" : "tab"}
            onClick={() => setTab("matches")}
          >
            Matches
          </button>
        </nav>
      </header>

      {error ? (
        <div className="banner error" role="alert">
          {error}{" "}
          <button type="button" className="linkish" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="main">
        {loading ? <div className="center subtle">Loading deck…</div> : null}

        {!loading && tab === "swipe" ? (
          <SwipeDeck
            current={current}
            next={next}
            remainingCount={queue.length}
            totalCount={totalCount}
            votedCount={votedCount}
            onVote={(c, ms, id) => void handleVote(c, ms, id)}
            canUndo={undoStack.length > 0}
            onUndo={() => void handleUndo()}
            onOpenResults={() => setTab("results")}
          />
        ) : null}

        {!loading && tab === "results" ? (
          <ResultsPanel results={results} live={live} />
        ) : null}

        {!loading && tab === "matches" ? (
          <MatchesPanel
            matches={matches}
            threshold={matchThreshold}
            onThresholdChange={setMatchThreshold}
          />
        ) : null}
      </main>

      <footer className="footer">
        <AnalyticsStrip data={analytics} />
        <div className="subtle small">
          Session id stored locally (UUID). Pull down on a card or open the Results tab.
        </div>
      </footer>
    </div>
  );
}
