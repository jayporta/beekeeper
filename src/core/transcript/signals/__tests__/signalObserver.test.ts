import { describe, expect, it } from 'vitest'
import { commandHash } from '../commandHash'
import { createSignalObserver, MAX_SIGNAL_EVENTS_PER_TRANSCRIPT } from '../signalObserver'
import type { SignalObserver } from '../signalObserver'
import { buildAssistantToolUseRecord, buildUserToolResultRecord } from '../../testFileTouchFixtures'
import { buildSystemRecord } from '../testSignalFixtures'

function observed(...records: Record<string, unknown>[]): SignalObserver {
  const observer = createSignalObserver()
  for (const record of records) observer.observe(record)
  return observer
}

describe('createSignalObserver', () => {
  it('records a Bash call with its command hash and timestamp', () => {
    const observer = observed(
      buildAssistantToolUseRecord({
        toolUseId: 'a',
        toolName: 'Bash',
        input: { command: 'ls -la' },
        timestamp: '2026-01-01T00:00:01.000Z'
      })
    )
    expect(observer.events()).toEqual([
      {
        kind: 'tool-call',
        toolUseId: 'a',
        tool: 'Bash',
        commandHash: commandHash('ls -la'),
        atMs: Date.parse('2026-01-01T00:00:01.000Z')
      }
    ])
  })

  it('gives a call to another tool a null command hash', () => {
    const observer = observed(
      buildAssistantToolUseRecord({ toolUseId: 'a', toolName: 'Read', input: { command: 'ls' } })
    )
    expect(observer.events()).toMatchObject([{ tool: 'Read', commandHash: null }])
  })

  it('gives a Bash call whose command is not a string a null hash', () => {
    const observer = observed(
      buildAssistantToolUseRecord({ toolUseId: 'a', toolName: 'Bash', input: { command: 42 } })
    )
    expect(observer.events()).toMatchObject([{ tool: 'Bash', commandHash: null }])
  })

  it('records an errored result with its timestamp', () => {
    const observer = observed(
      buildUserToolResultRecord({
        toolUseId: 'a',
        isError: true,
        timestamp: '2026-01-01T00:00:02.000Z'
      })
    )
    expect(observer.events()).toEqual([
      {
        kind: 'tool-result',
        toolUseId: 'a',
        isError: true,
        atMs: Date.parse('2026-01-01T00:00:02.000Z')
      }
    ])
  })

  it.each(['true', 1])('treats is_error %j as not an error', (isError) => {
    const observer = observed(buildUserToolResultRecord({ toolUseId: 'a', isError }))
    expect(observer.events()).toMatchObject([{ kind: 'tool-result', isError: false }])
  })

  it('records every tool_result block in one user record', () => {
    const observer = observed({
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'a', is_error: true },
          { type: 'tool_result', tool_use_id: 'b' }
        ]
      }
    })
    expect(observer.events()).toMatchObject([
      { toolUseId: 'a', isError: true, atMs: null },
      { toolUseId: 'b', isError: false, atMs: null }
    ])
  })

  it('records compact_boundary and agents_killed system records by uuid', () => {
    const observer = observed(
      buildSystemRecord({ subtype: 'compact_boundary', uuid: 'u1' }),
      buildSystemRecord({ subtype: 'agents_killed', uuid: 'u2' })
    )
    expect(observer.events()).toEqual([
      { kind: 'compaction', uuid: 'u1' },
      { kind: 'agents-killed', uuid: 'u2' }
    ])
  })

  it('ignores a system record of another subtype', () => {
    const observer = observed(buildSystemRecord({ subtype: 'turn_duration', uuid: 'u1' }))
    expect(observer.events()).toEqual([])
  })

  it('ignores a system record whose uuid is not a bounded identifier', () => {
    const observer = observed(buildSystemRecord({ subtype: 'compact_boundary', uuid: '' }))
    expect(observer.events()).toEqual([])
  })

  it('stops at the cap and reports capped', () => {
    const observer = createSignalObserver()
    for (let index = 0; index <= MAX_SIGNAL_EVENTS_PER_TRANSCRIPT; index += 1) {
      observer.observe(buildUserToolResultRecord({ toolUseId: `t${index}`, isError: true }))
    }
    expect(observer.events()).toHaveLength(MAX_SIGNAL_EVENTS_PER_TRANSCRIPT)
    expect(observer.capped()).toBe(true)
  })

  it('reads no further records once capped', () => {
    const observer = createSignalObserver()
    for (let index = 0; index <= MAX_SIGNAL_EVENTS_PER_TRANSCRIPT; index += 1) {
      observer.observe(buildUserToolResultRecord({ toolUseId: `t${index}` }))
    }
    let reads = 0
    const unread = {
      type: 'user',
      get message(): unknown {
        reads += 1
        return undefined
      }
    }

    observer.observe(unread)

    expect(reads).toBe(0)
  })

  it('does not report capped at exactly the cap', () => {
    const observer = createSignalObserver()
    for (let index = 0; index < MAX_SIGNAL_EVENTS_PER_TRANSCRIPT; index += 1) {
      observer.observe(buildUserToolResultRecord({ toolUseId: `t${index}` }))
    }
    expect(observer.capped()).toBe(false)
  })

  it('yields nothing for an empty transcript', () => {
    const observer = createSignalObserver()
    expect(observer.events()).toEqual([])
    expect(observer.capped()).toBe(false)
  })

  it('never holds the command text', () => {
    const command = 'curl https://example.invalid/secret-token-123'
    const observer = observed(
      buildAssistantToolUseRecord({ toolUseId: 'a', toolName: 'Bash', input: { command } })
    )
    expect(JSON.stringify(observer.events())).not.toContain(command)
  })
})
