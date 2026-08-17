import { db } from '@/lib/db';

/**
 * A very short-lived cache for the single CompetitionSettings row.
 *
 * WHY THIS EXISTS
 * Every polled endpoint opened with `competitionSettings.findFirst()`. With the
 * student page polling at 800ms, the projector at 1500ms, and the admin panel
 * hitting three endpoints at once, a hall of thirty phones was issuing hundreds
 * of identical reads a second for a table with exactly one row.
 *
 * Combined with `connection_limit=1` in the pooled DATABASE_URL, that saturated
 * the per-lambda pool and produced:
 *   P2024 Timed out fetching a new connection from the connection pool
 * which surfaced to students as "failed to fetch data" mid-competition.
 *
 * 700ms is deliberately shorter than the fastest poll interval, so a quiz
 * master's click still reaches every screen on the next tick — the cache
 * removes duplicate reads *within* a tick, not across ticks. Nothing about the
 * competition's responsiveness changes; only the redundant traffic goes away.
 *
 * The cache is per-lambda-instance and in-memory, so it cannot go stale across
 * a deploy and needs no invalidation plumbing.
 */

const TTL_MS = 700;

type Settings = Awaited<ReturnType<typeof db.competitionSettings.findFirst>>;

interface CacheEntry {
  value: Settings;
  at: number;
}

const globalForCache = globalThis as unknown as {
  __r2SettingsCache?: CacheEntry;
  __r2SettingsInflight?: Promise<Settings> | null;
};

/**
 * Read the settings row, reusing a result fetched in the last 700ms.
 *
 * Concurrent callers within the same instance share one in-flight promise, so a
 * burst of simultaneous requests costs exactly one database round trip rather
 * than one each — which is precisely the case that was exhausting the pool.
 */
export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  const cached = globalForCache.__r2SettingsCache;

  if (cached && now - cached.at < TTL_MS) return cached.value;

  if (globalForCache.__r2SettingsInflight) {
    return globalForCache.__r2SettingsInflight;
  }

  const promise = db.competitionSettings
    .findFirst()
    .then((value) => {
      globalForCache.__r2SettingsCache = { value, at: Date.now() };
      return value;
    })
    .finally(() => {
      globalForCache.__r2SettingsInflight = null;
    });

  globalForCache.__r2SettingsInflight = promise;
  return promise;
}

/**
 * Drop the cache immediately.
 *
 * Called by the admin control route after it writes, so the very next poll from
 * any screen sees the new state rather than waiting out the TTL. This is what
 * keeps "press Open" feeling instant despite the cache.
 */
export function invalidateSettings(): void {
  globalForCache.__r2SettingsCache = undefined;
}
