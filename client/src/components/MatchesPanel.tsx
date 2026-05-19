import type { MatchRow } from "../lib/api.js";

export function MatchesPanel({
  matches,
  threshold,
  onThresholdChange,
}: {
  matches: MatchRow[];
  threshold: number;
  onThresholdChange: (n: number) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-intro">
        <h3 className="font-display">Your crowd matches</h3>
        <p className="subtle">
          Surfaces landmarks you boosted with <strong>a yes vote</strong> once their global
          positivity clears your chosen bar.
        </p>
      </div>

      <div className="toolbar">
        <label className="field grow">
          <span className="label">
            Agreement floor · {Math.round(threshold * 100)}% global yes-rate
          </span>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.01}
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            aria-valuemin={0.5}
            aria-valuemax={0.95}
            aria-valuenow={threshold}
          />
        </label>
      </div>
      <p className="subtle explain">
        Tweaking the slider re-queries immediately — tighter thresholds yield fewer picks but higher
        confidence that the room agrees with your taste call.
      </p>
      <div className="panel-scrollable">
        <ul className="match-list">
          {matches.map((m) => (
            <li key={m.itemId} className="match-row">
              <div className="thumb">
                <img
                  src={m.imageUrl}
                  alt=""
                  width={76}
                  height={76}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="match-row-main">
                <div className="result-title font-display">{m.label}</div>
                <div className="result-sub subtle">
                  {Math.round(m.yesRate * 100)}% yes globally · {m.yes}/{m.no}
                </div>
                {m.description ? (
                  <div className="micro">{m.description}</div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {matches.length === 0 ? (
          <p className="matches-empty subtle">No matches yet — widen the slider or vote yes more.</p>
        ) : null}
      </div>
    </div>
  );
}
