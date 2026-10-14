/**
 * Whether a session was last active before a totals window starts: by its last
 * message, else by when its transcript was last written. The one rule the
 * folder totals and the archived-session filter share.
 *
 * @param times - When the session's last message was, or `null` when it has none, and when its transcript was last written.
 * @param cutoffMs - The window's start, in milliseconds since the Unix epoch.
 * @returns `true` when the session is out of the window.
 */
export function isBeforeTotalsWindow(
  times: { readonly latestMs: number | null; readonly mtimeMs: number },
  cutoffMs: number
): boolean {
  return (times.latestMs ?? times.mtimeMs) < cutoffMs
}
