import { useGesture } from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/web";
import {
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Item, VoteChoice } from "../lib/api.js";

export type SwipeCardHandle = {
  /** Fly the card left/right then invoke onVote — mirrors swipe gesture commit */
  animateVoteOut: (choice: VoteChoice) => void;
};

type Props = {
  item: Item;
  onVote: (choice: VoteChoice, decisionMs: number, itemId: string) => void;
  onPullDownResults?: () => void;
};

/** Hero dimensions match seed URLs (`/480/640`) — keeps aspect-ratio stable → no CLS jump */
const IMG_WIDE = 480;
const IMG_TALL = 640;

function springInstant() {
  return { tension: 900, friction: 85 } as const;
}

export const SwipeCard = forwardRef(function SwipeCard(
  { item, onVote, onPullDownResults }: Props,
  ref
) {
  const deckRef = useRef<HTMLDivElement>(null);
  const [deckW, setDeckW] = useState(360);
  const visibleAt = useRef(Date.now());
  const exitingRef = useRef(false);

  const prefersReduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    visibleAt.current = Date.now();
    exitingRef.current = false;
  }, [item.id]);

  useLayoutEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      setDeckW(w > 0 ? w : 360);
    });
    ro.observe(el);
    const w = el.offsetWidth;
    setDeckW(w > 0 ? w : 360);
    return () => ro.disconnect();
  }, []);

  const thresholds = useMemo(() => {
    const sw = Math.min(112, deckW * 0.29);
    return { swipe: Math.max(64, sw), maxDrag: deckW * 0.94 };
  }, [deckW]);

  const cfgDrag = prefersReduceMotion ? springInstant() : ({ tension: 320, friction: 28 } as const);
  const cfgExit = prefersReduceMotion ? springInstant() : ({ tension: 220, friction: 22 } as const);
  const cfgSnap = prefersReduceMotion ? springInstant() : ({ tension: 440, friction: 34 } as const);
  const cfgIntro = prefersReduceMotion ? springInstant() : ({ tension: 280, friction: 29 } as const);

  const [{ x, y, rot }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rot: 0,
    config: cfgDrag,
  }));

  const [{ entrScale, entrOpacity }, entrApi] = useSpring(() => ({
    entrScale: 1,
    entrOpacity: 1,
    config: cfgIntro,
  }));

  const runIntro = useCallback(() => {
    if (prefersReduceMotion) {
      entrApi.set({ entrScale: 1, entrOpacity: 1 });
      return;
    }
    entrApi.start({
      entrScale: 1,
      entrOpacity: 1,
      config: cfgIntro,
      from: { entrScale: 0.93, entrOpacity: 0.12 },
    });
  }, [cfgIntro, entrApi, prefersReduceMotion]);

  useLayoutEffect(() => {
    api.start({ x: 0, y: 0, rot: 0, immediate: true });
    entrApi.set({ entrScale: 0.93, entrOpacity: prefersReduceMotion ? 1 : 0.06 });
    const id = requestAnimationFrame(runIntro);
    return () => cancelAnimationFrame(id);
  }, [api, entrApi, item.id, prefersReduceMotion, runIntro]);

  const finalizeVote = useCallback(
    (choice: VoteChoice) => {
      const ms = Date.now() - visibleAt.current;
      const id = item.id;
      window.setTimeout(
        () => onVote(choice, ms, id),
        prefersReduceMotion ? 20 : 200
      );
    },
    [item.id, onVote, prefersReduceMotion]
  );

  useImperativeHandle(
    ref,
    () => ({
      animateVoteOut(choice) {
        if (exitingRef.current) return;
        exitingRef.current = true;
        const dir = choice === "yes" ? 1 : -1;
        api.start({
          x: deckW * 1.45 * dir,
          y: 0,
          rot: dir * 24,
          config: cfgExit,
        });
        finalizeVote(choice);
      },
    }),
    [api, cfgExit, deckW, finalizeVote]
  );

  const bind = useGesture(
    {
      onDrag: ({ active, movement: [mx, my], velocity: [vx], last }) => {
        if (exitingRef.current) return;
        if (last) {
          const flick = Math.abs(vx) > 0.5;
          if (mx > thresholds.swipe || (flick && mx > 42)) {
            exitingRef.current = true;
            api.start({
              x: deckW * 1.45,
              y: 0,
              rot: 24,
              config: cfgExit,
            });
            finalizeVote("yes");
            return;
          }
          if (mx < -thresholds.swipe || (flick && mx < -42)) {
            exitingRef.current = true;
            api.start({
              x: -deckW * 1.45,
              y: 0,
              rot: -24,
              config: cfgExit,
            });
            finalizeVote("no");
            return;
          }
          api.start({ x: 0, y: 0, rot: 0, config: cfgSnap });
          if (onPullDownResults && my > 76 && Math.abs(mx) < 48) {
            onPullDownResults();
          }
          return;
        }
        const clampedX = Math.max(-thresholds.maxDrag, Math.min(thresholds.maxDrag, mx));
        const clampedY = my > 0 ? Math.min(my, 140) : my;
        api.start({
          x: clampedX,
          y: clampedY,
          rot: (clampedX / deckW) * 21,
          immediate: active,
        });
      },
    },
    { drag: { filterTaps: true, pointer: { capture: true } } }
  );

  return (
    <div ref={deckRef} className="deck-stage" {...bind()}>
      {/* Wireframe: swipe-down opens results sheet — cyan “stage light” bleed */}
      <animated.div
        className="pull-down-curtain"
        style={{
          opacity: y.to((yy: number) =>
            yy > 14 ? Math.min(0.68, yy / 128) : 0
          ),
        }}
        aria-hidden
      />
      <div className="deck-stage-inner">
        <animated.div className="card-entr" style={{ scale: entrScale, opacity: entrOpacity }}>
          <animated.div className="card" style={{ x, y, rotateZ: rot }}>
            <div className="card-media card-media--hero">
              <div className="card-media-slot" aria-hidden />
              <img
                className="card-hero-img"
                src={item.imageUrl}
                alt=""
                width={IMG_WIDE}
                height={IMG_TALL}
                draggable={false}
                decoding="async"
                loading="eager"
              />
              <animated.div
                className="swipe-hint swipe-hint--yes"
                style={{
                  opacity: x.to((px: number) => (px > 0 ? Math.min(1, px / thresholds.swipe) : 0)),
                }}
              >
                YES
              </animated.div>
              <animated.div
                className="swipe-hint swipe-hint--no"
                style={{
                  opacity: x.to((px: number) => (px < 0 ? Math.min(1, -px / thresholds.swipe) : 0)),
                }}
              >
                NO
              </animated.div>
              <animated.div
                className="tint tint--yes"
                style={{
                  opacity: x.to((px: number) =>
                    px > 0 ? Math.min(0.5, px / (thresholds.swipe * 1.06)) : 0
                  ),
                }}
              />
              <animated.div
                className="tint tint--no"
                style={{
                  opacity: x.to((px: number) =>
                    px < 0 ? Math.min(0.5, -px / (thresholds.swipe * 1.06)) : 0
                  ),
                }}
              />
            </div>
            <div className="card-body">
              <h2 className="card-title font-display">{item.label}</h2>
              <p className="card-desc">{item.description}</p>
              <div className="card-hints" aria-hidden>
                <span className="hint-no">← No</span>
                <span className="hint-yes">Yes →</span>
              </div>
            </div>
          </animated.div>
        </animated.div>
      </div>

      <div className="threshold-wrap" aria-label="Swipe distance indicator">
        <div className="threshold-rail-wrap" aria-hidden>
          <div className="threshold-rail-bg">
            <span className="rail-no" />
            <span className="rail-zone" />
            <span className="rail-yes" />
          </div>
          <div className="threshold-shuttle-anchor">
            <animated.div className="threshold-shuttle" style={{ translateX: x.to((px: number) => Math.max(-deckW * 0.38, Math.min(deckW * 0.38, px * 0.42))) }} />
          </div>
        </div>
        <animated.p
          className="threshold-readout"
          style={{
            opacity: x.to((px: number) => Math.min(1, Math.abs(px) / thresholds.swipe)),
          }}
        >
          Pass the tinted zone — or use buttons — to lock in your vote
        </animated.p>
        <p className="pull-reminder subtle">Pull down on the deck to slide into Results.</p>
      </div>
    </div>
  );
}) as ForwardRefExoticComponent<Props & RefAttributes<SwipeCardHandle>>;
