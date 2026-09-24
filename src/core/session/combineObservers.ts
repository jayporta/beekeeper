/**
 * Fans one record out to several observers, in the order given, so one pass
 * over a transcript can feed every reader.
 *
 * @param observers - The observers to feed each record to.
 * @returns A single observer that forwards each record to all of them.
 */
export function combineObservers(
  ...observers: readonly ((record: Record<string, unknown>) => void)[]
): (record: Record<string, unknown>) => void {
  return (record) => {
    for (const observe of observers) observe(record)
  }
}
