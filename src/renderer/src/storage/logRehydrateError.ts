/**
 * Builds a Zustand `persist` `onRehydrateStorage` option that logs when a
 * store fails to load from storage, whether the read failed or the stored
 * value could not be parsed. Zustand otherwise drops either silently.
 *
 * The message is fixed and names only the key: the stored value and the error
 * can both hold transcript-derived text, since a parse error quotes the input.
 *
 * @param key - The key the store is persisted under.
 * @returns An `onRehydrateStorage` option for the store.
 * @example
 * persist(config, { name: 'first-run', onRehydrateStorage: logRehydrateError('first-run') })
 */
export function logRehydrateError(key: string): () => (state: unknown, error?: unknown) => void {
  return () => (_state, error) => {
    if (error !== undefined) console.error(`Beekeeper could not restore "${key}" from IndexedDB.`)
  }
}
