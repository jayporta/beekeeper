import type { Next } from 'claude-code'
import { vi, type Mock } from 'vitest'

/** An engine-like `next` and the spy behind it. */
export interface TestNext<R> {
  /** The `next` to hand to a hook. */
  readonly next: Next<object, R>
  /** Records each time the chain below `next` actually runs. */
  readonly spy: Mock<(e: object) => Promise<R>>
}

/**
 * Builds a `next` that behaves as the engine's does: the first call runs the chain below it, and a
 * later call replays the first call's answer without running the chain again. `called` reads true
 * once it has been called.
 *
 * @param result - What the chain below answers.
 * @returns The `next` and its spy.
 */
export function createNext<R>(result: R): TestNext<R> {
  const spy = vi.fn<(e: object) => Promise<R>>(async () => result)
  let pending: Promise<R> | undefined
  const call = (e: object): Promise<R> => {
    pending ??= spy(e)
    return pending
  }
  const next = Object.defineProperty(call, 'called', { get: () => pending !== undefined })
  return { next: next as Next<object, R>, spy }
}
