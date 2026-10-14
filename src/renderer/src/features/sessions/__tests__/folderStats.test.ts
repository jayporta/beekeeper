import { describe, expect, it } from 'vitest'
import { folderStats } from '../folderStats'
import { testAgentRole, testSession } from '../../../../../shared/sessions/testSessionFixtures'

const DIR = '-p'

/** A session of the folder whose file was written, so it is readable. */
const session = (
  n: number,
  options: Parameters<typeof testSession>[1] = {}
): ReturnType<typeof testSession> => testSession(n, { modifiedMs: 5, ...options })

describe('folderStats', () => {
  it('adds up the tokens, cost, agents and sessions of the folder', () => {
    const stats = folderStats(
      [
        session(1, { projectDirName: DIR, totalTokens: 100, costUSD: 1, subagentCount: 2 }),
        session(2, { projectDirName: DIR, totalTokens: 50, costUSD: 0.5, subagentCount: 0 })
      ],
      DIR
    )

    expect(stats).toMatchObject({ sessions: 2, tokens: 150, usd: 1.5, agents: 4 })
  })

  it('leaves out sessions from other folders, such as teammates nested under a lead', () => {
    const stats = folderStats(
      [
        session(1, { projectDirName: DIR, totalTokens: 100 }),
        session(2, { projectDirName: '-other', totalTokens: 900 })
      ],
      DIR
    )

    expect(stats).toMatchObject({ sessions: 1, tokens: 100 })
  })

  it('counts lead and solo sessions only, though teammates add their tokens and agents', () => {
    const stats = folderStats(
      [
        session(1, { projectDirName: DIR, totalTokens: 100 }),
        session(2, {
          projectDirName: DIR,
          totalTokens: 10,
          role: testAgentRole('w', 'code')
        })
      ],
      DIR
    )

    expect(stats).toMatchObject({ sessions: 1, tokens: 110, agents: 2 })
  })

  it('counts archived sessions', () => {
    const stats = folderStats(
      [session(1, { projectDirName: DIR, totalTokens: 7, archived: true })],
      DIR
    )

    expect(stats.tokens).toBe(7)
  })

  it('counts a session however old it is', () => {
    const stats = folderStats(
      [session(1, { projectDirName: DIR, totalTokens: 7, latestMs: 1, modifiedMs: 1 })],
      DIR
    )

    expect(stats).toMatchObject({ sessions: 1, tokens: 7 })
  })

  it('gives the lead or solo session active last as the latest time', () => {
    const stats = folderStats(
      [
        session(1, { projectDirName: DIR, latestMs: 1000, modifiedMs: 1000 }),
        session(2, { projectDirName: DIR, latestMs: 5000, modifiedMs: 5000 })
      ],
      DIR
    )

    expect(stats.latestMs).toBe(5000)
  })

  it('has no latest time when no session has timestamps', () => {
    const stats = folderStats([session(1, { projectDirName: DIR, modifiedMs: 5 })], DIR)

    expect(stats.latestMs).toBeNull()
  })

  it('is all zeros for no sessions in the folder', () => {
    const stats = folderStats([session(1, { projectDirName: '-other' })], DIR)

    expect(stats).toMatchObject({ sessions: 0, tokens: 0, usd: 0, agents: 0, latestMs: null })
    expect(stats.reasons).toEqual([])
  })

  it('counts an unreadable session as partial, not as tokens', () => {
    const stats = folderStats(
      [session(1, { projectDirName: DIR, unreadable: true, modifiedMs: 5 })],
      DIR
    )

    expect(stats.tokens).toBe(0)
    expect(stats.reasons).toEqual(['unreadable'])
    expect(stats.partial).toEqual({ tokens: true, cost: true, sessions: true, agents: true })
  })

  it('marks only the cost when a session recorded tokens but no cost', () => {
    const stats = folderStats(
      [session(1, { projectDirName: DIR, totalTokens: 5, modifiedMs: 5 })],
      DIR
    )

    expect(stats.partial).toEqual({ tokens: false, cost: true, sessions: false, agents: false })
  })

  it('marks the agents when a subagents folder could not be read', () => {
    const stats = folderStats(
      [
        session(1, {
          projectDirName: DIR,
          totalTokens: 5,
          costUSD: 1,
          modifiedMs: 5,
          subagentCount: null
        })
      ],
      DIR
    )

    expect(stats.partial.agents).toBe(true)
    expect(stats.reasons).toEqual(['uncountedSubagents'])
  })

  it('does not report undated sessions, which mean nothing without a window', () => {
    const stats = folderStats(
      [session(1, { projectDirName: DIR, totalTokens: 5, costUSD: 1, modifiedMs: 5 })],
      DIR
    )

    expect(stats.reasons).toEqual([])
    expect(stats.partial).toEqual({ tokens: false, cost: false, sessions: false, agents: false })
  })
})
