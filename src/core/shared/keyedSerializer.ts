/** Runs async tasks one at a time per key, so work on one resource never overlaps itself. */
export interface KeyedSerializer {
  /**
   * Runs a task once every earlier task for the same key has settled. Tasks
   * for different keys do not wait for each other.
   *
   * @param key - What the task works on, such as a file path.
   * @param task - The work to run.
   * @returns The task's own outcome: its value, or its rejection. An earlier
   * task's failure never reaches a later one.
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T>
  /** How many keys have a task running or waiting. */
  readonly pendingKeys: number
}

/** Settles a task's outcome without acting on it, so a failure stays with the caller that ran it. */
const ignore = (): undefined => undefined

/**
 * Creates a {@link KeyedSerializer}. It keeps a record of a key only while a
 * task for it is running or waiting, so an idle serializer holds nothing.
 *
 * @returns A serializer with no pending work.
 */
export function createKeyedSerializer(): KeyedSerializer {
  const tails = new Map<string, Promise<void>>()

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve()
      const result = previous.then(task)
      const tail = result.then(ignore, ignore)
      tails.set(key, tail)
      void tail.then(() => {
        if (tails.get(key) === tail) tails.delete(key)
      })
      return result
    },
    get pendingKeys() {
      return tails.size
    }
  }
}
