import { err } from '../../core/shared/result'
import type { ServiceDeps } from '../serviceDeps'

/** Service dependencies that count the scans and git lookups a call makes. */
export interface CountingDeps {
  /** The dependencies, which locate no git. */
  readonly deps: ServiceDeps
  /** How many scans reached the scheduler and how many times git was looked up. */
  readonly counts: { scans: number; git: number }
}

/**
 * Wraps dependencies so each scan and git lookup is counted, and no git is found.
 * @param base - The dependencies to wrap.
 * @returns The wrapped dependencies and their counters.
 */
export function countingDeps(base: ServiceDeps): CountingDeps {
  const counts = { scans: 0, git: 0 }
  const deps: ServiceDeps = {
    ...base,
    scans: {
      run: (key, task) => {
        counts.scans += 1
        return base.scans.run(key, task)
      }
    },
    git: () => {
      counts.git += 1
      return Promise.resolve(err('git-not-found'))
    }
  }
  return { deps, counts }
}
