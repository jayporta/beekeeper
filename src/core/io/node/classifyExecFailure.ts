import { err, ok, type Result } from '../../shared/result'
import type { ProcessOutput, ProcessRunError } from '../processPort'

const MAX_BUFFER_CODE = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'

function readProp(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined
  return (value as Record<string, unknown>)[key]
}

/**
 * Sorts a rejection from `execFile` into a process outcome.
 * @param error - The value `execFile` rejected with.
 * @returns A non-zero exit as `ok` with its code and stdout, otherwise `output-too-large`, `timeout` or `spawn-failed`.
 */
export function classifyExecFailure(error: unknown): Result<ProcessOutput, ProcessRunError> {
  const code = readProp(error, 'code')
  if (code === MAX_BUFFER_CODE) return err('output-too-large')
  if (typeof code === 'number') {
    const stdout = readProp(error, 'stdout')
    return ok({ exitCode: code, stdout: Buffer.isBuffer(stdout) ? stdout : new Uint8Array(0) })
  }
  return err(readProp(error, 'killed') === true ? 'timeout' : 'spawn-failed')
}
