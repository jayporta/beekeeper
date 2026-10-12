import { describe, expect, it } from 'vitest'
import { t } from '../i18n/modI18n'
import { hostOf, register } from '../register'
import { createTestEngine, type TestEngineAnswers } from '../testEngine'
import { createNext } from '../testNext'
import { recordingOn } from '../testOn'

/** Runs the registered session.start hook against a fake `$` and returns the calls it made. */
async function startSession(
  answers: TestEngineAnswers,
  { isInteractive }: { isInteractive: boolean }
): Promise<ReturnType<typeof createTestEngine>['calls']> {
  const { on, registered } = recordingOn()
  register(on, {})
  const start = registered.find((entry) => entry.event === 'session.start')
  const { $, calls } = createTestEngine(answers)
  const { next } = createNext({ cwd: '/work' })
  await start?.hook($, { cwd: '/work', surface: 'terminal', isInteractive }, next)
  return calls.filter((call) => call.name !== 'session.version')
}

describe('register', () => {
  it('registers session.start, the beekeeper command and the Pane render', () => {
    const { on, registered } = recordingOn()

    register(on, {})

    expect(registered.map(({ event, matcher }) => ({ event, matcher }))).toEqual([
      { event: 'session.start', matcher: undefined },
      { event: 'command.run', matcher: { command: 'beekeeper' } },
      { event: 'ui.render', matcher: { component: 'Pane', requestId: 'beekeeper' } }
    ])
  })

  it('opens the beekeeper pane and replies with one line when /beekeeper runs', async () => {
    const { on, registered } = recordingOn()
    register(on, {})
    const command = registered.find((entry) => entry.event === 'command.run')
    const { $, calls } = createTestEngine()

    const reply = await (command?.hook as unknown as (engine: typeof $) => Promise<unknown>)($)

    expect(calls).toEqual([{ name: 'ui.open', args: [{ id: 'beekeeper', title: 'beekeeper' }] }])
    expect(reply).toEqual({ text: t('command.opened') })
  })

  it('answers the host version call with the engine version', async () => {
    const { $, calls } = createTestEngine({ version: { version: '2.1.300' } })

    const version = await hostOf($).version()

    expect(version).toEqual({ version: '2.1.300' })
    expect(calls).toEqual([{ name: 'session.version', args: [] }])
  })

  describe('hostOf', () => {
    it('lists a directory through $.fs.list', async () => {
      const { $, calls } = createTestEngine()

      const entries = await hostOf($).list('/d')

      expect(entries).toEqual([])
      expect(calls).toEqual([{ name: 'fs.list', args: ['/d'] }])
    })

    it('stats a path through $.fs.stat and resolves links', async () => {
      const { $, calls } = createTestEngine()

      await hostOf($).stat('/p')

      expect(calls).toEqual([{ name: 'fs.stat', args: ['/p', { resolve: true }] }])
    })

    it('spawns tail one byte past the offset, because tail counts from 1', async () => {
      const { $, calls } = createTestEngine()

      await hostOf($).tail('/abs/file', 5).next()

      expect(calls).toEqual([
        { name: 'process.spawn', args: [{ argv: ['tail', '-c', '+6', '/abs/file'] }] }
      ])
    })

    it.each([
      ['a negative start', '/abs/file', -1],
      ['a fractional start', '/abs/file', 1.5],
      ['an unsafe start', '/abs/file', Number.MAX_SAFE_INTEGER + 1],
      ['a relative path', 'file', 0],
      ['a path that looks like an option', '-f', 0]
    ])('refuses %s before any spawn', (_name, path, start) => {
      const { $, calls } = createTestEngine()

      expect(() => hostOf($).tail(path, start)).toThrow()
      expect(calls).toEqual([])
    })

    // readBytes is not tested here: Uint8Array.fromBase64 needs Node 25, and CI runs Node 24.
    // The plugin smoke test covers it.
  })

  describe('session.start', () => {
    it('registers /beekeeper on an interactive session that meets the minimum', async () => {
      const calls = await startSession({}, { isInteractive: true })

      expect(calls).toEqual([
        {
          name: 'command.register',
          args: [{ name: 'beekeeper', description: t('command.description') }]
        }
      ])
    })

    it('toasts the version and registers no command when Claude Code is too old', async () => {
      const calls = await startSession(
        { version: { version: '2.1.200', base: '2.1.200' } },
        { isInteractive: true }
      )

      expect(calls).toEqual([
        {
          name: 'ui.toast',
          args: [t('start.tooOld', { minimum: '2.1.296', version: '2.1.200' }), undefined]
        }
      ])
    })

    it('toasts fixed text and registers no command when the version call fails', async () => {
      const calls = await startSession({ versionFails: true }, { isInteractive: true })

      expect(calls).toEqual([{ name: 'ui.toast', args: [t('start.failed'), undefined] }])
    })

    it('registers nothing and toasts nothing on a session that is not interactive', async () => {
      const calls = await startSession(
        { version: { version: '2.1.200', base: '2.1.200' } },
        { isInteractive: false }
      )

      expect(calls).toEqual([])
    })
  })
})
