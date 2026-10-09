import { describe, expect, it } from 'vitest'
import { summarizeSignals } from '../summarizeSignals'
import type { AgentSignals } from '../agentSignals'
import type { SignalEvent } from '../signalEvent'

const call = (
  toolUseId: string,
  extra: Partial<Extract<SignalEvent, { kind: 'tool-call' }>> = {}
): SignalEvent => ({
  kind: 'tool-call',
  toolUseId,
  tool: 'Read',
  commandHash: null,
  atMs: null,
  ...extra
})
const result = (toolUseId: string, isError: boolean, atMs: number | null = null): SignalEvent => ({
  kind: 'tool-result',
  toolUseId,
  isError,
  atMs
})
const summarize = (events: SignalEvent[]): AgentSignals =>
  summarizeSignals(events, { partial: false })

describe('summarizeSignals', () => {
  it('gives all zeros and no wait for no events', () => {
    expect(summarize([])).toEqual({
      toolErrors: 0,
      longestErrorStreak: 0,
      longestBashRepeat: 0,
      compactions: 0,
      agentsKilled: 0,
      longestToolWait: null,
      partial: false
    })
  })

  it('counts every errored result', () => {
    expect(summarize([result('a', true), result('b', false), result('c', true)]).toolErrors).toBe(2)
  })

  it('finds the longest run of errored results, reset by a success', () => {
    const events = [result('a', true), result('b', true), result('c', false), result('d', true)]
    expect(summarize(events).longestErrorStreak).toBe(2)
  })

  it('finds the longest run of identical Bash commands, ignoring other tools between them', () => {
    const events = [
      call('a', { tool: 'Bash', commandHash: 7 }),
      call('r1'),
      call('b', { tool: 'Bash', commandHash: 7 }),
      call('c', { tool: 'Bash', commandHash: 7 }),
      call('d', { tool: 'Bash', commandHash: 9 })
    ]
    expect(summarize(events).longestBashRepeat).toBe(3)
  })

  it('gives a repeat run of 1 for Bash calls that never repeat', () => {
    const events = [
      call('a', { tool: 'Bash', commandHash: 1 }),
      call('b', { tool: 'Bash', commandHash: 2 })
    ]
    expect(summarize(events).longestBashRepeat).toBe(1)
  })

  it('breaks a repeat run at a Bash call with no readable command', () => {
    const events = [
      call('a', { tool: 'Bash', commandHash: 1 }),
      call('b', { tool: 'Bash', commandHash: null }),
      call('c', { tool: 'Bash', commandHash: 1 })
    ]
    expect(summarize(events).longestBashRepeat).toBe(1)
  })

  it('counts compactions and agent kills', () => {
    const events: SignalEvent[] = [
      { kind: 'compaction', uuid: 'u1' },
      { kind: 'compaction', uuid: 'u2' },
      { kind: 'agents-killed', uuid: 'u3' }
    ]
    expect(summarize(events)).toMatchObject({ compactions: 2, agentsKilled: 1 })
  })

  it('takes the longest wait from a call to its result, with the tool name', () => {
    const events = [
      call('a', { tool: 'Bash', atMs: 1000 }),
      result('a', false, 61_000),
      call('b', { tool: 'Read', atMs: 70_000 }),
      result('b', false, 71_000)
    ]
    expect(summarize(events).longestToolWait).toEqual({ ms: 60_000, tool: 'Bash' })
  })

  it.each(['Agent', 'AskUserQuestion', 'ExitPlanMode'])('leaves %s out of waits', (tool) => {
    const events = [call('a', { tool, atMs: 0 }), result('a', false, 9_000_000)]
    expect(summarize(events).longestToolWait).toBeNull()
  })

  it('drops a wait whose result is timestamped before its call', () => {
    expect(
      summarize([call('a', { atMs: 5000 }), result('a', false, 1000)]).longestToolWait
    ).toBeNull()
  })

  it('drops a wait when the call has no timestamp', () => {
    expect(
      summarize([call('a', { atMs: null }), result('a', false, 1000)]).longestToolWait
    ).toBeNull()
  })

  it('drops a wait when the result has no timestamp', () => {
    expect(summarize([call('a', { atMs: 0 }), result('a', false, null)]).longestToolWait).toBeNull()
  })

  it('counts a result with no matching call toward errors but not waits', () => {
    const summary = summarize([result('orphan', true, 1000)])
    expect(summary).toMatchObject({ toolErrors: 1, longestToolWait: null })
  })

  it('carries the partial flag it is given', () => {
    expect(summarizeSignals([], { partial: true }).partial).toBe(true)
  })
})
