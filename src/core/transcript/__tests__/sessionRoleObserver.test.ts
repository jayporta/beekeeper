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

  it('routes each value through the label cleaner, keeping the classification', () => {
    const record = buildUserRecord({ extra: { agentName: 'a\nb', teamName: 'c\nd' } })

    expect(observeAll([record])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
      teamName: null
    })
  })

  it('routes an agent type through the label cleaner', () => {
    expect(observeAll([buildAgentSettingRecord('Ex\nplore')])).toMatchObject({
      kind: 'agent',
      agentType: null
    })
  })
  it('normalizes an empty agentName to null while still classifying an agent', () => {
    expect(observeAll([buildUserRecord({ extra: { agentName: '' } })])).toEqual({
      kind: 'agent',
      agentType: null,
      agentName: null,
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
