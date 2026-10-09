/** Runs a task after every earlier one has settled, and resolves with its result. */
export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>

/**
 * Creates a queue that runs tasks one at a time in the order they arrive. A
 * task that rejects rejects only its own caller, and the next task still runs.
 *
 * @returns The function that queues a task.
 */
export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve()
  return (task) => {
    const result = tail.then(task)
    tail = result.catch(() => undefined)
    return result
  }
}
