import { execFile } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import { promisify } from 'node:util'
import { ok, type Result } from '../../shared/result'
import type { ProcessOutput, ProcessPort, ProcessRequest, ProcessRunError } from '../processPort'
import { classifyExecFailure } from './classifyExecFailure'

const execFileAsync = promisify(execFile)

async function run(request: ProcessRequest): Promise<Result<ProcessOutput, ProcessRunError>> {
  try {
    const { stdout } = await execFileAsync(request.file, [...request.args], {
      env: { ...request.env },
      timeout: request.timeoutMs,
      maxBuffer: request.maxOutputBytes,
      encoding: 'buffer'
    })
    return ok({ exitCode: 0, stdout })
  } catch (error) {
    return classifyExecFailure(error)
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** The process port backed by Node's `child_process`. */
export const nodeProcess: ProcessPort = {
  run,
  isExecutable,
  platform: process.platform,
  exactOutput: true
}
