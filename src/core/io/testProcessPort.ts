import type { Result } from '../shared/result'
import type { ProcessOutput, ProcessPort, ProcessRequest, ProcessRunError } from './processPort'

/** Answers one {@link ProcessRequest} in a {@link fakeProcessPort}. */
export type FakeProcessRun = (
  request: ProcessRequest
) => Promise<Result<ProcessOutput, ProcessRunError>>

/**
 * A process port that answers every run with `run`, for tests that never
 * start a real child.
 * @param run - Answers each request.
 * @returns A port that runs nothing and executes no file.
 */
export function fakeProcessPort(run: FakeProcessRun): ProcessPort {
  return {
    run,
    isExecutable: () => Promise.resolve(false),
    platform: 'darwin',
    exactOutput: true
  }
}
