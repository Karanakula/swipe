export function AnalyticsStrip({
  data,
}: {
  data: {
    totalVoteRecords: number;
    uniqueSessions: number;
    averageDecisionMs: number | null;
  } | null;
}) {
  if (!data) return null;
  return (
    <div className="analytics-strip subtle">
      <span>Sessions: {data.uniqueSessions}</span>
      <span>Vote rows: {data.totalVoteRecords}</span>
      {data.averageDecisionMs != null ? (
        <span>Avg decision: {data.averageDecisionMs}ms</span>
      ) : (
        <span>Avg decision: —</span>
      )}
    </div>
  );
}
