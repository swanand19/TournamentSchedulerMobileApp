import { useCallback, useMemo, useState } from 'react';

import { api } from '@/api/client';
import type { ActivityItem, ActivityPage } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';

// A match's activity, newest first. The newest page is reloaded when the live line says the match
// changed, and polled (that's how a ball or a goal arrives without the line); older pages are fetched on demand with `before` and kept. Ids count up through the
// match, so the two join without a gap: anything older than the newest page's oldest line comes
// from the pages already loaded.

const PAGE = 40;

export function useActivity(sport: 'football' | 'cricket', matchId: number, { pollMs, enabled = true }: { pollMs?: number; enabled?: boolean } = {}) {
  const fetcher = useCallback(
    () => api.call<ActivityPage>('WATCH_ACTIVITY', { routeParams: { sport, matchId }, query: { take: PAGE } }),
    [sport, matchId],
  );
  const latest = useQuery(fetcher, { pollMs, enabled, live: pollMs ? { kind: 'match', sport, matchId } : null });
  const [older, setOlder] = useState<{ items: ActivityItem[]; hasMore: boolean }>({ items: [], hasMore: true });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<Error | null>(null);

  const items = useMemo(() => {
    const top = latest.data?.items ?? [];
    const floor = top.length ? top[top.length - 1].id : Infinity;
    return [...top, ...older.items.filter((i) => i.id < floor)];
  }, [latest.data, older.items]);

  const hasMore = older.items.length ? older.hasMore : !!latest.data?.hasMore;

  const loadMore = useCallback(async () => {
    if (loadingMore || !items.length) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.call<ActivityPage>('WATCH_ACTIVITY', {
        routeParams: { sport, matchId },
        query: { before: items[items.length - 1].id, take: PAGE },
      });
      setOlder((o) => ({ items: [...o.items, ...page.items], hasMore: page.hasMore }));
    } catch (e) {
      setMoreError(e as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [items, loadingMore, sport, matchId]);

  return { ...latest, items, hasMore, loadMore, loadingMore, moreError };
}
