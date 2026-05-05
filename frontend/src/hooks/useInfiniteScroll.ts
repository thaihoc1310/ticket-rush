import { useEffect, useRef } from "react";

/**
 * Custom hook that uses IntersectionObserver to detect when a sentinel
 * element enters the viewport, triggering a callback to load more items.
 *
 * @param onLoadMore - Called when the sentinel becomes visible
 * @param options.enabled - Whether the observer is active (set false when all items shown)
 * @param options.rootMargin - Margin around the root to trigger earlier (default "200px")
 * @returns A ref to attach to the sentinel element
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options?: { enabled?: boolean; rootMargin?: string },
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const enabled = options?.enabled ?? true;
  const rootMargin = options?.rootMargin ?? "200px";

  // Keep a stable ref to the latest onLoadMore to avoid re-creating observer
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
