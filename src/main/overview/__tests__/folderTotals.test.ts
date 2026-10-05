import { describe, expect, it } from 'vitest'
import { folderTotals, type TotalsSession } from '../folderTotals'

const DAY = 24 * 60 * 60 * 1000
const NOW = 100 * DAY
const WINDOW = 7 * DAY
const CUTOFF = NOW - WINDOW

/** A readable session, active at `latestMs`, with nothing else set. */
function session(id: string, overrides: Partial<TotalsSession> = {}): TotalsSession {
  const { summary, ...rest } = overrides
  return {
    sessionId: id,
    mtimeMs: NOW,
    subagentCount: 0,
    summary: {
      title: `title ${id}`,
      usage: { totalTokens: 100, totalUSD: 1 },
      activity: { earliestMs: NOW - 1000, latestMs: NOW - 500 },
      skippedLines: 0,
      role: { kind: 'lead' },
      transcriptTokens: null,
      ...summary
    },
    ...rest
  }
}

/** A session whose summary couldn't be read. */
const unreadable = (id: string, mtimeMs: number | null = NOW): TotalsSession => ({
  sessionId: id,
  mtimeMs,
  subagentCount: 0,
  summary: null
})

const totals = (sessions: readonly TotalsSession[]): ReturnType<typeof folderTotals> =>
  folderTotals({ sessions, nowMs: NOW, windowMs: WINDOW })

const agent = { kind: 'agent', agentName: 'w', agentType: 'code', teamName: 't' } as const

describe('folderTotals', () => {
  it('is all zero, with no latest session, for an empty folder', () => {
    expect(totals([])).toEqual({
      tokens: 0,
      usd: 0,
      sessions: 0,
      agents: 0,
      latest: null,
      partial: {
        withoutTokens: 0,
        withoutCost: 0,
        unreadable: 0,
        lowTokens: 0,
        uncountedSubagents: 0,
        undated: 0
      }
    })
  })

  it('sums each session’s own tokens and cost', () => {
    const result = totals([
      session('a', {
        summary: { ...session('a').summary!, usage: { totalTokens: 100, totalUSD: 1 } }
      }),
      session('b', {
        summary: { ...session('b').summary!, usage: { totalTokens: 50, totalUSD: 0.5 } }
      })
    ])

    expect(result).toMatchObject({ tokens: 150, usd: 1.5, sessions: 2 })
  })
})

describe('folderTotals window', () => {
  const latestAt = (latestMs: number, mtimeMs = NOW): TotalsSession =>
    session('s', {
      mtimeMs,
      summary: { ...session('s').summary!, activity: { earliestMs: latestMs, latestMs } }
    })

  it('counts a session active exactly at the cutoff', () => {
    expect(totals([latestAt(CUTOFF)]).sessions).toBe(1)
  })

  it('leaves out a session active a millisecond before the cutoff', () => {
    expect(totals([latestAt(CUTOFF - 1)])).toMatchObject({ sessions: 0, agents: 0, tokens: 0 })
  })

  it('leaves out a session whose activity is old though its file was written to since', () => {
    expect(totals([latestAt(CUTOFF - DAY, NOW)]).sessions).toBe(0)
  })

  it('counts a session whose activity is in the window though its file looks older', () => {
    expect(totals([latestAt(NOW - 1000, CUTOFF - 5 * DAY)]).sessions).toBe(1)
  })

  it('counts nothing, with no latest session, when every session is outside the window', () => {
    const old = (id: string): TotalsSession => latestAt(CUTOFF - DAY - Number(id), CUTOFF - DAY)

    expect(totals([old('1'), old('2')])).toMatchObject({
      tokens: 0,
      usd: 0,
      sessions: 0,
      agents: 0,
      latest: null
    })
  })

  it('counts a session that is not yet over: activity after now', () => {
    expect(totals([latestAt(NOW + DAY)]).sessions).toBe(1)
  })
})

describe('folderTotals sessions and agents', () => {
  it('counts lead and solo sessions as sessions, and teammates only as agents', () => {
    const teammate = session('t', { summary: { ...session('t').summary!, role: agent } })

    const result = totals([session('lead'), session('solo'), teammate])

    expect(result.sessions).toBe(2)
    expect(result.agents).toBe(3)
  })

  it('counts every session and each one’s subagents as agents', () => {
    const result = totals([
      session('a', { subagentCount: 3 }),
      session('b', { subagentCount: 0 }),
      session('t', { subagentCount: 2, summary: { ...session('t').summary!, role: agent } })
    ])

    // Three sessions, and 3 + 0 + 2 subagents.
    expect(result.agents).toBe(8)
  })

  it('counts a session with an unknown number of subagents as itself alone', () => {
    expect(totals([session('a', { subagentCount: null })]).agents).toBe(1)
  })

  it('adds a teammate’s own totals once, never into its lead’s', () => {
    const teammate = session('t', {
      summary: { ...session('t').summary!, role: agent, usage: { totalTokens: 40, totalUSD: 0.4 } }
    })
    const lead = session('lead', {
      summary: { ...session('lead').summary!, usage: { totalTokens: 100, totalUSD: 1 } }
    })

    expect(totals([lead, teammate])).toMatchObject({ tokens: 140, usd: 1.4 })
  })

  it('does not count the subagents of a session outside the window', () => {
    const old = session('old', {
      subagentCount: 5,
      mtimeMs: CUTOFF - DAY,
      summary: {
        ...session('old').summary!,
        activity: { earliestMs: CUTOFF - DAY, latestMs: CUTOFF - DAY }
      }
    })

    expect(totals([old]).agents).toBe(0)
  })
})

describe('folderTotals latest session', () => {
  const at = (id: string, latestMs: number): TotalsSession =>
    session(id, {
      summary: { ...session(id).summary!, activity: { earliestMs: latestMs, latestMs } }
    })

  it('is the lead session with the greatest last activity in the window', () => {
    const result = totals([at('a', NOW - 3000), at('b', NOW - 1000), at('c', NOW - 2000)])

    expect(result.latest).toEqual({ sessionId: 'b', title: 'title b', latestMs: NOW - 1000 })
  })

  it('is not a teammate, even when it was active later', () => {
    const teammate = session('t', {
      summary: {
        ...session('t').summary!,
        role: agent,
        activity: { earliestMs: NOW - 10, latestMs: NOW - 10 }
      }
    })

    expect(totals([at('a', NOW - 5000), teammate]).latest?.sessionId).toBe('a')
  })

  it('has a null title for a session with none', () => {
    const untitled = session('u', { summary: { ...session('u').summary!, title: null } })

    expect(totals([untitled]).latest).toMatchObject({ sessionId: 'u', title: null })
  })

  it('breaks a tie by session id, so the answer does not depend on order', () => {
    const forward = totals([at('b', NOW - 100), at('a', NOW - 100)]).latest?.sessionId
    const backward = totals([at('a', NOW - 100), at('b', NOW - 100)]).latest?.sessionId

    expect([forward, backward]).toEqual(['a', 'a'])
  })

  it('is null when no lead session has an activity time', () => {
    const undated = session('u', { summary: { ...session('u').summary!, activity: null } })

    expect(totals([undated]).latest).toBeNull()
  })
})

describe('folderTotals tokens that are missing or partial', () => {
  it('falls back to the transcript’s tokens when none were recorded, with no cost', () => {
    const running = session('r', {
      summary: { ...session('r').summary!, usage: null, transcriptTokens: 70 }
    })

    expect(totals([running])).toMatchObject({
      tokens: 70,
      usd: 0,
      partial: { withoutTokens: 0, withoutCost: 1, lowTokens: 0 }
    })
  })

  it('marks the fallback as low when the session has subagents, or an unknown number', () => {
    const base = { ...session('r').summary!, usage: null, transcriptTokens: 70 }

    expect(totals([session('a', { subagentCount: 2, summary: base })]).partial.lowTokens).toBe(1)
    expect(totals([session('b', { subagentCount: null, summary: base })]).partial.lowTokens).toBe(1)
  })

  it('does not mark a recorded total low because the session has subagents', () => {
    expect(totals([session('a', { subagentCount: 4 })]).partial.lowTokens).toBe(0)
  })

  it('counts a session with no tokens at all, and still counts the session', () => {
    const none = session('n', { summary: { ...session('n').summary!, usage: null } })

    expect(totals([none])).toMatchObject({
      tokens: 0,
      sessions: 1,
      agents: 1,
      partial: { withoutTokens: 1, withoutCost: 1 }
    })
  })

  it('counts a recorded cost of nothing as recorded', () => {
    const free = session('f', {
      summary: { ...session('f').summary!, usage: { totalTokens: 10, totalUSD: 0 } }
    })

    expect(totals([free]).partial).toMatchObject({ withoutTokens: 0, withoutCost: 0 })
  })

  it('counts a usage record whose token total is unknown as having no tokens', () => {
    const unknown = session('u', {
      summary: { ...session('u').summary!, usage: { totalTokens: null, totalUSD: 2 } }
    })

    expect(totals([unknown])).toMatchObject({
      usd: 2,
      partial: { withoutTokens: 1, withoutCost: 0 }
    })
  })

  it('marks a session with unreadable transcript lines as low', () => {
    const skipped = session('s', { summary: { ...session('s').summary!, skippedLines: 3 } })

    expect(totals([skipped]).partial.lowTokens).toBe(1)
  })

  it('counts a session once as low, however many reasons it has', () => {
    const many = session('m', {
      subagentCount: null,
      summary: { ...session('m').summary!, skippedLines: 2, usage: null, transcriptTokens: 5 }
    })

    expect(totals([many]).partial.lowTokens).toBe(1)
  })

  it('counts a session whose subagents folder could not be read as having uncounted subagents', () => {
    expect(totals([session('a', { subagentCount: null })]).partial.uncountedSubagents).toBe(1)
  })

  it('does not call a recorded total low because its subagents folder could not be read', () => {
    expect(totals([session('a', { subagentCount: null })]).partial.lowTokens).toBe(0)
  })

  it('counts a session once as having uncounted subagents, and still counts the session itself as an agent', () => {
    const result = totals([
      session('a', { subagentCount: null }),
      session('b', { subagentCount: 3 })
    ])

    expect(result.partial.uncountedSubagents).toBe(1)
    expect(result.agents).toBe(1 + 4)
  })

  it.each([0, 2])('does not count a session with %s subagents counted as uncounted', (count) => {
    expect(totals([session('a', { subagentCount: count })]).partial.uncountedSubagents).toBe(0)
  })

  it('leaves an unreadable summary to the unreadable count, not the uncounted subagents', () => {
    const result = totals([{ ...unreadable('u'), subagentCount: null }])

    expect(result.partial).toMatchObject({ unreadable: 1, uncountedSubagents: 0 })
  })
})

describe('folderTotals sessions that could not be read or dated', () => {
  it('counts an unreadable summary as an agent in the window by its file time, as unreadable, with no tokens', () => {
    const result = totals([unreadable('u')])

    expect(result).toMatchObject({
      sessions: 0,
      agents: 1,
      tokens: 0,
      partial: { unreadable: 1, withoutTokens: 0 }
    })
  })

  it('leaves out an unreadable summary whose file is older than the window', () => {
    expect(totals([unreadable('u', CUTOFF - 1)])).toMatchObject({
      agents: 0,
      partial: { unreadable: 0 }
    })
  })

  it('counts a transcript that could not be stat’d as unreadable only, since it has no time', () => {
    expect(totals([unreadable('u', null)])).toMatchObject({
      agents: 0,
      sessions: 0,
      partial: { unreadable: 1 }
    })
  })

  it('still counts an unreadable session’s subagents as agents', () => {
    expect(totals([{ ...unreadable('u'), subagentCount: 2 }]).agents).toBe(3)
  })

  it('counts a session with no timestamps by its file time, and marks it undated', () => {
    const undated = session('u', { summary: { ...session('u').summary!, activity: null } })

    expect(totals([undated])).toMatchObject({ sessions: 1, tokens: 100, partial: { undated: 1 } })
  })

  it('leaves out a session with no timestamps whose file is older than the window', () => {
    const undated = session('u', {
      mtimeMs: CUTOFF - 1,
      summary: { ...session('u').summary!, activity: null }
    })

    expect(totals([undated])).toMatchObject({ sessions: 0, partial: { undated: 0 } })
  })

  it('counts a session with no timestamps whose file is exactly at the cutoff', () => {
    const undated = session('u', {
      mtimeMs: CUTOFF,
      summary: { ...session('u').summary!, activity: null }
    })

    expect(totals([undated]).sessions).toBe(1)
  })
})
