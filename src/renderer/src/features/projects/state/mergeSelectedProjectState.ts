/**
 * Merges the persisted project selection into the current state. The entry is
 * unvalidated input: only a string or `null` `selectedDirName` is taken from
 * it, and every other field, including the actions, stays as the current state
 * has it, so a stored value can neither select a non-folder nor overwrite an
 * action.
 *
 * @param persisted - Whatever was stored, or `undefined` when nothing was.
 * @param current - The store's current state.
 * @returns The state with `selectedDirName` taken from `persisted` when it is a string or `null`.
 */
export function mergeSelectedProjectState<T extends { readonly selectedDirName: string | null }>(
  persisted: unknown,
  current: T
): T {
  if (typeof persisted !== 'object' || persisted === null || !('selectedDirName' in persisted)) {
    return current
  }
  const { selectedDirName } = persisted
  return typeof selectedDirName === 'string' || selectedDirName === null
    ? { ...current, selectedDirName }
    : current
}
