import { describe, expect, it, vi } from 'vitest'
import type { IpcResult } from '../../../shared/ipc/ipcResult'
import { errorWithCode } from '../../testErrorWithCode'
import { guardIpc } from '../guardIpc'
import { okResult } from '../ipcResults'
import { toIpcErrorCode } from '../toIpcErrorCode'

const trusted = (): boolean => true

describe('guardIpc', () => {
  it('refuses an untrusted sender without running the handler', async () => {
    let ran = false
    const listener = guardIpc({
      isTrusted: () => false,
      handle: () => {
        ran = true
        return Promise.resolve(okResult(1))
      }
    })
    expect(await listener({})).toEqual({ ok: false, error: { code: 'untrusted-sender' } })
    expect(ran).toBe(false)
  })

  it('passes the payload to a trusted call', async () => {
    const listener = guardIpc({
      isTrusted: trusted,
      handle: (payload) => Promise.resolve(okResult(payload))
    })
    expect(await listener({}, 'x')).toEqual({ ok: true, value: 'x' })
  })

  it('turns a throw into a code without leaking its message or path', async () => {
    const secret = new Error('ENOENT: no such file /Users/jay/.claude/projects/secret-project')
    const listener = guardIpc({ isTrusted: trusted, handle: () => Promise.reject(secret) })
    const result = await listener({})
    expect(result).toEqual({ ok: false, error: { code: 'internal' } })
    expect(JSON.stringify(result)).not.toContain('secret-project')
  })

  it('maps a missing file to not-found and drops its message', async () => {
    const enoent = Object.assign(new Error('/Users/jay/private'), { code: 'ENOENT' })
    const listener = guardIpc({ isTrusted: trusted, handle: () => Promise.reject(enoent) })
    const result = await listener({})
    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('turns a synchronous throw inside the handler into a code', async () => {
    const listener = guardIpc({
      isTrusted: trusted,
      handle: () => {
        throw new Error('sync /secret')
      }
    })
    expect(await listener({})).toEqual({ ok: false, error: { code: 'internal' } })
  })
})

describe('guardIpc sender check', () => {
  it('turns a throwing sender getter into a code', async () => {
    const event = {
      get senderFrame(): never {
        throw new Error('frame disposed /secret')
      }
    }
    const listener = guardIpc({
      isTrusted: (e: typeof event) => e.senderFrame !== null,
      handle: () => Promise.resolve(okResult('x'))
    })
    const result = await listener(event)
    expect(result).toEqual({ ok: false, error: { code: 'internal' } })
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})

describe('guardIpc logging', () => {
  function loggedLines(
    handle: () => Promise<IpcResult<number>>,
    isTrusted: () => boolean = trusted
  ): { lines: string[]; run: () => Promise<IpcResult<number>> } {
    const lines: string[] = []
    const listener = guardIpc({ isTrusted, handle, log: (line) => lines.push(line) })
    return { lines, run: () => listener({}) }
  }

  it('logs one line naming the class of an internal failure, never its message', async () => {
    const { lines, run } = loggedLines(() => Promise.reject(new TypeError('secret /Users/x/path')))
    await run()
    expect(lines).toEqual(['Beekeeper hit an internal error handling an IPC call (TypeError).'])
  })

  it('names an unmapped code in the line, never the message', async () => {
    const { lines, run } = loggedLines(() => Promise.reject(errorWithCode('EIO')))
    await run()
    expect(lines).toEqual(['Beekeeper hit an internal error handling an IPC call (EIO).'])
  })

  it('logs nothing for a missing file', async () => {
    const { lines, run } = loggedLines(() => Promise.reject(errorWithCode('ENOENT')))
    await run()
    expect(lines).toEqual([])
  })

  it('logs nothing for a permission failure', async () => {
    const { lines, run } = loggedLines(() => Promise.reject(errorWithCode('EACCES')))
    await run()
    expect(lines).toEqual([])
  })

  it('logs nothing for an untrusted sender', async () => {
    const { lines, run } = loggedLines(
      () => Promise.resolve(okResult(1)),
      () => false
    )
    await run()
    expect(lines).toEqual([])
  })

  it('logs nothing for an ok result', async () => {
    const { lines, run } = loggedLines(() => Promise.resolve(okResult(1)))
    await run()
    expect(lines).toEqual([])
  })

  it('logs one line when the sender check throws', async () => {
    const lines: string[] = []
    const listener = guardIpc({
      isTrusted: () => {
        throw new RangeError('frame disposed /secret')
      },
      handle: () => Promise.resolve(okResult(1)),
      log: (line) => lines.push(line)
    })
    await listener({})
    expect(lines).toEqual(['Beekeeper hit an internal error handling an IPC call (RangeError).'])
  })

  it('logs to the console when no logger is given', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const listener = guardIpc({
        isTrusted: trusted,
        handle: () => Promise.reject(new TypeError('x'))
      })
      await listener({})
      expect(spy).toHaveBeenCalledWith(
        'Beekeeper hit an internal error handling an IPC call (TypeError).'
      )
    } finally {
      spy.mockRestore()
    }
  })
})

describe('toIpcErrorCode', () => {
  it.each([
    [{ code: 'ENOENT' }, 'not-found'],
    [{ code: 'ENOTDIR' }, 'not-found'],
    [{ code: 'EACCES' }, 'unreadable'],
    [{ code: 'EPERM' }, 'unreadable'],
    [{ code: 'EIO' }, 'internal'],
    [new Error('boom'), 'internal'],
    ['string', 'internal']
  ])('maps %j to %s', (error, expected) => {
    expect(toIpcErrorCode(error)).toBe(expected)
  })
})
