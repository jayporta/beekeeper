/**
 * Merges the persisted first-run entry into the current state. The entry is
 * unvalidated input: only a boolean `dismissed` is taken from it, and every
 * other field, including the actions, stays as the current state has it, so a
 * stored value can neither hide the screen with a wrong type nor overwrite an
 * action.
 *
 * @param persisted - Whatever was stored, or `undefined` when nothing was.
 * @param current - The store's current state.
 * @returns The state with `dismissed` taken from `persisted` when it is a boolean.
 */
export function mergeFirstRunState<T extends { readonly dismissed: boolean }>(
  persisted: unknown,
  current: T
): T {
  if (typeof persisted !== 'object' || persisted === null || !('dismissed' in persisted)) {
    return current
  }
  const { dismissed } = persisted
  return typeof dismissed === 'boolean' ? { ...current, dismissed } : current
}
