import { useRef, useState, type ReactNode, type TouchEvent } from 'react';

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Swipe-down-to-reload, native touch events only (no library — this app
 * isn't on Ionic and pages scroll at the document level, not inside a
 * per-screen container, so the gesture is gated on window.scrollY rather
 * than an element's own scrollTop). Calls onRefresh, which each screen wires
 * to its existing one-shot loader — there are no live Firestore listeners
 * anywhere in this app, so re-running the loader is the only way to reload.
 */
export function PullToRefresh({ children, onRefresh }: { children: ReactNode; onRefresh: () => Promise<void> }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  function onTouchStart(event: TouchEvent) {
    if (refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = event.touches[0].clientY;
  }

  function onTouchMove(event: TouchEvent) {
    if (startY.current === null || refreshing) return;
    const delta = event.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, MAX_PULL));
    }
  }

  async function onTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;

    if (pullDistance < PULL_THRESHOLD) {
      setPullDistance(0);
      return;
    }

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }

  return (
    <div className="pull-to-refresh" onTouchEnd={() => void onTouchEnd()} onTouchMove={onTouchMove} onTouchStart={onTouchStart}>
      <div className="pull-indicator" style={{ height: refreshing ? PULL_THRESHOLD : pullDistance }}>
        {(refreshing || pullDistance > 0) && <span className={refreshing ? 'spin' : ''} />}
      </div>
      {children}
    </div>
  );
}
