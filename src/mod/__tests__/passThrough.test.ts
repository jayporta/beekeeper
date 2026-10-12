import { describe, expect, it } from 'vitest'
import { register } from '../register'
import { createFailingEngine, createTestEngine } from '../testEngine'
import { createNext } from '../testNext'
import { recordingOn, type Registered } from '../testOn'

/** The hooks on events the mod owns: it answers these itself instead of passing them on. */
const OWNED = [
  { event: 'command.run', matcher: { command: 'beekeeper' } },
  { event: 'ui.render', matcher: { component: 'Pane', requestId: 'beekeeper' } }
]

const isOwned = (entry: Registered): boolean =>
  OWNED.some(
    ({ event, matcher }) =>
      entry.event === event && JSON.stringify(entry.matcher) === JSON.stringify(matcher)
  )

const { on, registered } = recordingOn()
register(on, {})
const passed = registered.filter((entry) => !isOwned(entry))

const SENTINEL_RESULT = Object.freeze({ cwd: '/sentinel' })
const SENTINEL_INPUT = Object.freeze({ cwd: '/sentinel', surface: 'terminal', isInteractive: true })

/**
 * Runs a hook the way the engine does: if it throws, the registration's `.catch` handler runs in
 * its place, with the same `$`, `e` and `next`.
 */
async function dispatch(
  entry: Registered,
  $: Parameters<Registered['hook']>[0]
): Promise<{
  result: unknown
  runs: number
  input: unknown
}> {
  const { next, spy } = createNext(SENTINEL_RESULT)
  let result: unknown
  try {
    result = await entry.hook($, SENTINEL_INPUT, next)
  } catch {
    if (!entry.catchHandler) throw new Error(`${entry.event} can throw and has no .catch handler`)
    result = await entry.catchHandler($, SENTINEL_INPUT, next)
  }
  return { result, runs: spy.mock.calls.length, input: spy.mock.calls[0]?.[0] }
}

describe('hooks on events the mod does not own', () => {
  it('leaves at least one hook to check, and owns exactly the declared ones', () => {
    expect(passed.length).toBeGreaterThan(0)
    expect(registered.length - passed.length).toBe(OWNED.length)
  })

  describe.each(passed.map((entry) => [entry.event, entry] as const))('%s', (_event, entry) => {
    const situations = [
      ['everything succeeds', () => createTestEngine().$],
      ['every engine call fails', () => createFailingEngine()],
      [
        'Claude Code is older than the minimum',
        () => createTestEngine({ version: { version: '2.1.200', base: '2.1.200' } }).$
      ]
    ] as const

    it.each(situations)('passes the event on once, unchanged, when %s', async (_name, engine) => {
      const { result, runs, input } = await dispatch(entry, engine())

      expect(runs).toBe(1)
      expect(input).toBe(SENTINEL_INPUT)
      expect(result).toBe(SENTINEL_RESULT)
    })
  })
})
