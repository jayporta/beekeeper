import { describe, expect, it } from 'vitest'
import type { SessionRole } from '../sessionRole'
import { createSessionRoleObserver } from '../sessionRoleObserver'
import { buildAgentSettingRecord, buildAssistantRecord, buildUserRecord } from '../testFixtures'

function observeAll(records: readonly Record<string, unknown>[]): SessionRole {
  const observer = createSessionRoleObserver()
  for (const record of records) observer.observe(record)
  return observer.role()
}

describe('createSessionRoleObserver', () => {
  it('reads as a lead when no record carries a marker', () => {
    expect(observeAll([buildUserRecord(), buildAssistantRecord()])).toEqual({ kind: 'lead' })
  })

  it('classifies an agent-setting record alone as an agent with its type', () => {
    expect(observeAll([buildAgentSettingRecord('Explore')])).toEqual({
      kind: 'agent',
      agentType: 'Explore',
      agentName: null,
      teamName: null
    })
  })

  it('classifies a user record carrying agentName as an agent', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 'scout' } })])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: 'scout',
      teamName: null
    })
  })

  it('classifies an assistant record carrying teamName as an agent', () => {
    expect(observeAll([buildAssistantRecord({ extra: { teamName: 'team-1' } })])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
      teamName: 'team-1'
    })
  })

  it('leaves a standalone agent-name record a lead', () => {
    expect(observeAll([{ type: 'agent-name', agentName: 'scout' }])).toEqual({ kind: 'lead' })
  })

  it('leaves a user record with a non-string agentName a lead', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 42 } })])).toEqual({ kind: 'lead' })
  })

  it('normalizes an empty agentName to null while still classifying an agent', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: '' } })])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
      teamName: null
    })
  })

  it('stores null for an oversized value but keeps the agent classification', () => {
    expect(observeAll([buildUserRecord({ extra: { teamName: 'x'.repeat(257) } })])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
      teamName: null
    })
  })

  it('stores null for a name carrying a newline but keeps the agent classification', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 'scout\nadmin' } })])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
      teamName: null
    })
  })

  it('stores null for a name carrying a non-whitespace control character', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 'scout\u0007' } })])).toMatchObject({
      kind: 'agent',
      agentName: null
    })
  })

  it('keeps a value of exactly the cap', () => {
    const atCap = 'x'.repeat(256)

    expect(observeAll([buildUserRecord({ extra: { teamName: atCap } })])).toMatchObject({
      teamName: atCap
    })
  })

  it('stores null for a name carrying a line separator', () => {
    expect(
      observeAll([buildUserRecord({ extra: { agentName: 'scout\u2028admin' } })])
    ).toMatchObject({ kind: 'agent', agentName: null })
  })

  it('stores null for a team name carrying a non-breaking space', () => {
    expect(observeAll([buildUserRecord({ extra: { teamName: 'team\u00a01' } })])).toMatchObject({
      kind: 'agent',
      teamName: null
    })
  })

  it('stores null for a name carrying a lone surrogate', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 'scout\ud800' } })])).toMatchObject({
      kind: 'agent',
      agentName: null
    })
  })

  it('stores null for a whitespace-only name', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: '   ' } })])).toMatchObject({
      kind: 'agent',
      agentName: null
    })
  })

  it('trims surrounding whitespace from a name', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: '  scout  ' } })])).toMatchObject({
      agentName: 'scout'
    })
  })

  it('normalizes a decomposed name to NFC', () => {
    expect(
      observeAll([buildUserRecord({ extra: { agentName: 'cafe\u0301-review' } })])
    ).toMatchObject({ agentName: 'caf\u00e9-review' })
  })

  it('stores null for a name carrying a private-use character', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 'scout\ue000' } })])).toMatchObject({
      kind: 'agent',
      agentName: null
    })
  })

  it('stores null for a team name carrying a paragraph separator', () => {
    expect(observeAll([buildUserRecord({ extra: { teamName: 'team\u20291' } })])).toMatchObject({
      kind: 'agent',
      teamName: null
    })
  })

  it('keeps a name containing a plain space', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: 'chunk 1 review' } })])).toMatchObject(
      { agentName: 'chunk 1 review' }
    )
  })

  it('stores null for a team name carrying a bidi override', () => {
    expect(observeAll([buildUserRecord({ extra: { teamName: 'team-\u202e1' } })])).toMatchObject({
      kind: 'agent',
      teamName: null
    })
  })

  it('classifies an agent-setting with no agentSetting field as an agent with a null type', () => {
    expect(observeAll([{ type: 'agent-setting' }])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
      teamName: null
    })
  })

  it('classifies an agent-setting with a non-string value as an agent with a null type', () => {
    expect(observeAll([buildAgentSettingRecord(7)])).toMatchObject({
      kind: 'agent',
      agentType: null
    })
  })

  it('keeps the first value when a repeated agent-setting arrives', () => {
    expect(
      observeAll([buildAgentSettingRecord('Explore'), buildAgentSettingRecord('code-reviewer')])
    ).toMatchObject({ agentType: 'Explore' })
  })

  it('does not let a later record clear a value with null', () => {
    expect(
      observeAll([
        buildUserRecord({ extra: { agentName: 'scout' } }),
        buildUserRecord({ extra: { agentName: '' } })
      ])
    ).toMatchObject({ agentName: 'scout' })
  })

  it('collects values from different records', () => {
    expect(
      observeAll([
        buildAgentSettingRecord('Explore'),
        buildUserRecord({ extra: { agentName: 'scout', teamName: 'team-1' } })
      ])
    ).toEqual({ kind: 'agent', agentType: 'Explore', agentName: 'scout', teamName: 'team-1' })
  })
})
