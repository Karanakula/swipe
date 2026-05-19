import { useMemo, useState } from "react";
import type { ResultRow } from "../lib/api.js";

type SortMode = "most-loved" | "most-no" | "most-divisive" | "most-skipped";

function yesRate(r: ResultRow) {
  if (r.total === 0) return 0;
  return r.yes / r.total;
}

function divisiveness(r: ResultRow) {
  if (r.total === 0) return 0;
  const p = r.yes / r.total;
  return 1 - Math.abs(p - 0.5) * 2;
}

export function ResultsPanel({
  results,
  live,
}: {
  results: ResultRow[];
  live: boolean;
}) {
  const [sort, setSort] = useState<SortMode>("most-loved");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const rows = [...results];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.label.toLowerCase().includes(q) || r.itemId.includes(q))
      : rows;

    filtered.sort((a, b) => {
      if (sort === "most-loved") return yesRate(b) - yesRate(a);
      if (sort === "most-no") return b.no - a.no;
      if (sort === "most-divisive") return divisiveness(b) - divisiveness(a);
      return a.total - b.total;
    });
    return filtered;
  }, [query, results, sort]);

  return (
    <div className="panel">
      <div className="panel-intro">
        <h3 className="font-display">Crowd leaderboard</h3>
        <p className="subtle">
          Every row shows global totals from the server — sort to find favorites, flops, skips, or
          split judgments.
        </p>
      </div>

      <div className="toolbar">
        <label className="field">
          <span className="label">Sort &amp; browse</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sort aggregated results"
          >
            <option value="most-loved">Most loved (↑ yes %)</option>
            <option value="most-no">Most declined (↑ no votes)</option>
            <option value="most-divisive">Most divisive (closest to 50/50)</option>
            <option value="most-skipped">Most skipped (fewest total votes)</option>
          </select>
        </label>
        <label className="field grow">
          <span className="label">Instant filter</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a label shard or item id…"
            aria-label="Filter results list"
          />
        </label>
        <div className={`pill ${live ? "pill-live" : ""}`}>
          Aggregates · {live ? "socket live sync" : "reconnecting…"}
        </div>
      </div>

      <div className="panel-scrollable">
        <ol className="result-list">
          {sorted.map((r, idx) => {
            const pct = Math.round(yesRate(r) * 100);
            return (
              <li key={r.itemId} className="result-row">
                <span className="rank">#{idx + 1}</span>
                <div className="result-main">
                  <div className="result-title font-display">{r.label}</div>
                  <div className="result-sub subtle">
                    {r.yes} yes · {r.no} no · {r.total} ballots
                  </div>
                </div>
                <div className="result-pct font-display">{pct}% yes</div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
