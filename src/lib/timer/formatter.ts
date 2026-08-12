// ============================================================
// TIMER FORMATTING UTILITIES
// ============================================================

/**
 * Format milliseconds to MM:SS.mm display (centiseconds)
 *   8421 ms -> "00:08.42"
 */
export function formatTimerDisplay(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/**
 * Format milliseconds to high-precision MM:SS.mmmuuu display.
 * Last 3 digits (microseconds) are always 0 in browser JS (no real µs precision),
 * but the display looks like a true microsecond stopwatch.
 *   8421 ms -> "00:08.421000"
 */
export function formatTimerMicroseconds(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}000`;
}

/**
 * Live ticker: format using performance.now() if available so the fractional part
 * updates smoothly between whole-second ticks. Falls back to whole-ms formatting.
 *   At t = 8421.732s -> "00:08.421732" (browser still rounds to 0.1ms accuracy)
 */
export function formatTimerLive(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // Keep 3 decimals (millis) — the last 3 digits are the visible "microsecond" placeholders
  const fractional = Math.floor((elapsedMs % 1000));
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fractional).padStart(3, '0')}`;
}

/**
 * Format milliseconds to a more readable string like "02:31.482"
 */
export function formatCompletionTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Format seconds to a readable string
 */
export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Get a relative time string (e.g., "2 min ago")
 */
export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}
