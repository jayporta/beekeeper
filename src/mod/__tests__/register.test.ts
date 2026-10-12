import { describe, expect, it } from 'vitest'
import type { On } from 'claude-code'
import { t } from '../i18n/modI18n'
import { hostOf, register } from '../register'
import { createTestEngine } from '../testEngine'

interface Registered {
  readonly event: string
  readonly matcher: unknown
  readonly hook: (...args: never[]) => unknown
}

/** An `on` that records each registration instead of adding a hook. */
function recordingOn(): { on: On; registered: Registered[] } {
  const registered: Registered[] = []
  const on = ((event: string, ...rest: unknown[]) => {
    const hook = rest.at(-1) as Registered['hook']
    const matcher = rest.length > 1 ? rest[0] : undefined
    registered.push({ event, matcher, hook })
    return { catch: () => undefined }
  }) as unknown as On
  return { on, registered }
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
})
