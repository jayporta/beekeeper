import { describe, expect, it } from 'vitest'
import { classifyExecFailure } from '../classifyExecFailure'

function failure(error: object): unknown {
  return Object.assign(new Error('secret /path'), error)
}

describe('classifyExecFailure', () => {
  it('returns a non-zero exit code instead of an error', () => {
    const result = classifyExecFailure(failure({ code: 1, stdout: Buffer.from('') }))

    expect(result).toEqual({ ok: true, value: { exitCode: 1, stdout: Buffer.from('') } })
  })

  it('keeps the stdout of a non-zero exit', () => {
    const result = classifyExecFailure(failure({ code: 2, stdout: Buffer.from('partial') }))

    expect(result.ok && Buffer.from(result.value.stdout).toString()).toBe('partial')
  })

  it('reports output over the cap as output-too-large', () => {
    const result = classifyExecFailure(
      failure({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', stdout: Buffer.from('cut') })
    )

    expect(result).toEqual({ ok: false, error: 'output-too-large' })
  })

  it('reports a killed process as a timeout', () => {
    const result = classifyExecFailure(failure({ killed: true, signal: 'SIGTERM', code: null }))

    expect(result).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports a launch failure as spawn-failed without leaking the message', () => {
    const result = classifyExecFailure(failure({ code: 'ENOENT' }))

    expect(result).toEqual({ ok: false, error: 'spawn-failed' })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('gives empty bytes for a numeric code with no stdout', () => {
    const result = classifyExecFailure(failure({ code: 128 }))

    expect(result).toEqual({ ok: true, value: { exitCode: 128, stdout: new Uint8Array(0) } })
  })

  it('reports a non-object rejection as spawn-failed', () => {
    expect(classifyExecFailure('boom')).toEqual({ ok: false, error: 'spawn-failed' })
    expect(classifyExecFailure(undefined)).toEqual({ ok: false, error: 'spawn-failed' })
  })
})
