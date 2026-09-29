import { createFsRunner, type FsRunner } from './fsDeadline'

/** Never settles, standing in for a filesystem call on a hung mount. */
export function neverSettles(): Promise<never> {
  return new Promise<never>(() => undefined)
}

/** Options for {@link hangingFsRunner}. */
export interface HangingFsRunnerOptions {
  /** How many calls run for real before the hang starts. */
  readonly passes: number
  /** How many calls hang once it starts. Defaults to every later call. */
  readonly hangs?: number
}

/**
 * Creates a runner that lets the first `passes` calls through, hangs the next
 * `hangs`, and lets the rest through. A hung call times out after 50
 * milliseconds of real time and keeps its slot for good, so the runner's cap
 * of unsettled calls is `hangs` plus one, which leaves room for the rest.
 * @param options - When the hang starts and how long it lasts.
 * @returns The runner.
 */
export function hangingFsRunner(options: HangingFsRunnerOptions): FsRunner {
  const { passes, hangs = Infinity } = options
  const inner = createFsRunner({ deadlineMs: 50, maxUnsettled: hangs + 1 })
  let calls = 0
  return (call) => {
    calls += 1
    const hangsNow = calls > passes && calls <= passes + hangs
    return inner(hangsNow ? neverSettles : call)
  }
}
