import { useRef } from "react";
import type { Item, VoteChoice } from "../lib/api.js";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard.js";

type Props = {
  current: Item | null;
  next: Item | null;
  remainingCount: number;
  totalCount: number;
  votedCount: number;
  onVote: (choice: VoteChoice, decisionMs: number, itemId: string) => void;
  onUndo?: () => void;
  canUndo: boolean;
  onOpenResults: () => void;
};

export function SwipeDeck({
  current,
  next,
  remainingCount,
  totalCount,
  votedCount,
  onVote,
  onUndo,
  canUndo,
  onOpenResults,
}: Props) {
  const cardRef = useRef<SwipeCardHandle>(null);

  const barPct =
    totalCount === 0 ? 0 : Math.min(100, Math.round((votedCount / totalCount) * 100));

  const progressHead =
    remainingCount === 0 ? (
      <span className="deck-progress-copy">
        Progress: <strong className="font-display">Done</strong>
      </span>
    ) : (
      <span className="deck-progress-copy">
        Progress:{" "}
        <strong className="font-display">
          {votedCount + 1} / {totalCount}
        </strong>
      </span>
    );

  return (
    <div className="swipe-screen">
      <section className="deck-progress-ring" aria-live="polite">
        <div className="deck-progress-head">
          {progressHead}
          <span className="deck-rem subtle">{remainingCount} remaining</span>
        </div>
        <div className="deck-progress-track" aria-hidden>
          <div className="deck-progress-fill" style={{ width: `${barPct}%` }} />
          {remainingCount > 0 && totalCount > 0 ? (
            <span
              className="deck-progress-glow"
              style={{
                left: `${Math.min(
                  98,
                  Math.max(2, ((votedCount + 0.5) / totalCount) * 100)
                )}%`,
              }}
            />
          ) : null}
        </div>
      </section>

      <div className="stack">
        {next ? (
          <article className="card card--back" aria-hidden>
            <div className="card-media card-media--hero card-media--back">
              <div className="card-media-slot" />
              <img
                className="card-hero-img"
                src={next.imageUrl}
                alt=""
                width={480}
                height={640}
                loading="lazy"
                decoding="async"
              />
            </div>
          </article>
        ) : null}
        {current ? (
          <SwipeCard
            ref={cardRef}
            key={current.id}
            item={current}
            onVote={onVote}
            onPullDownResults={onOpenResults}
          />
        ) : (
          <div className="empty-deck">
            <p className="h1 font-display">You&apos;ve voted on everything.</p>
            <p className="subtle">
              See how the crowd ranked each landmark — open Results.
            </p>
            <button type="button" className="btn primary tap-lg" onClick={onOpenResults}>
              View results
            </button>
          </div>
        )}
      </div>

      {current ? (
        <div className="actions">
          <button
            type="button"
            className="btn danger wide tap-lg"
            aria-label="Vote no (swipe left)"
            onClick={() => cardRef.current?.animateVoteOut("no")}
          >
            No
          </button>
          {canUndo && onUndo ? (
            <button type="button" className="btn ghost tap-lg tap-undo" onClick={onUndo}>
              Undo
            </button>
          ) : (
            <span className="ghost-slot" aria-hidden />
          )}
          <button
            type="button"
            className="btn success wide tap-lg"
            aria-label="Vote yes (swipe right)"
            onClick={() => cardRef.current?.animateVoteOut("yes")}
          >
            Yes
          </button>
        </div>
      ) : null}
    </div>
  );
}
