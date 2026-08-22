import { useEffect, useState } from 'react';

/**
 * True only once `active` has been continuously true for `delayMs`.
 *
 * AGENTS.md §8 Loading: "Delay 200ms before showing one — a skeleton that
 * flashes for 80ms is worse than no skeleton." Wrap every skeleton in this so
 * a fast response never produces a flicker.
 */
export function useDelayedFlag(active: boolean, delayMs = 200): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);

  return active && elapsed;
}
