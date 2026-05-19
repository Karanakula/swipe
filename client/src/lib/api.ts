export type VoteChoice = "yes" | "no";

export type Item = {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
};

export type ResultRow = {
  itemId: string;
  label: string;
  yes: number;
  no: number;
  total: number;
};

const base = () =>
  (import.meta.env.VITE_API_URL ?? "http://localhost:3333").replace(/\/$/, "");

async function readError(res: Response) {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${base()}/items`);
  if (!res.ok) throw new Error(await readError(res));
  const j = (await res.json()) as { items: Item[] };
  return j.items;
}

export async function fetchMyVotes(sessionId: string) {
  const u = new URL(`${base()}/my-votes`);
  u.searchParams.set("sessionId", sessionId);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    votes: { itemId: string; choice: VoteChoice; votedAt: number }[];
  };
}

export async function fetchResults(): Promise<ResultRow[]> {
  const res = await fetch(`${base()}/results`);
  if (!res.ok) throw new Error(await readError(res));
  const j = (await res.json()) as { results: ResultRow[] };
  return j.results;
}

export async function postVote(input: {
  sessionId: string;
  itemId: string;
  choice: VoteChoice;
  decisionMs?: number;
}) {
  const res = await fetch(`${base()}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: input.sessionId,
      itemId: input.itemId,
      choice: input.choice,
      ...(input.decisionMs != null ? { decisionMs: input.decisionMs } : {}),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function postUndo(sessionId: string, itemId: string) {
  const res = await fetch(`${base()}/vote/undo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, itemId }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export type MatchRow = {
  itemId: string;
  label: string;
  description: string;
  imageUrl: string;
  yesRate: number;
  yes: number;
  no: number;
};

export async function fetchMatches(sessionId: string, threshold = 0.55) {
  const u = new URL(`${base()}/matches`);
  u.searchParams.set("sessionId", sessionId);
  u.searchParams.set("threshold", String(threshold));
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { matches: MatchRow[]; threshold: number };
}

export async function fetchAnalytics() {
  const res = await fetch(`${base()}/analytics`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    totalVoteRecords: number;
    uniqueSessions: number;
    averageDecisionMs: number | null;
  };
}

export function resultsWebSocketUrl() {
  const http = base();
  const ws =
    http.startsWith("https") ? `wss://${http.slice(8)}` : `ws://${http.slice(7)}`;
  return `${ws}/ws`;
}
