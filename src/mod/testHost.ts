import type { ModHost } from './modHost'

/** What the fake host answers; each field has a default. */
export interface TestHostAnswers {
  /** What `version()` resolves to, or a function that throws or rejects to simulate a failure. */
  version?: Awaited<ReturnType<ModHost['version']>> | (() => never)
}

/**
 * Builds a fake `ModHost` for tests.
 *
 * @param answers - Overrides for what the fake answers.
 * @returns The fake host.
 */
export function createTestHost(answers: TestHostAnswers = {}): ModHost {
  const { version = { version: '2.1.296', base: '2.1.296' } } = answers
  return {
    version: async () => (typeof version === 'function' ? version() : version)
  }
}
