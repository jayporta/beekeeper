import { describe, expect, it } from 'vitest'
import { MAX_LABEL_CODE_UNITS } from '../boundedLabel'
import { teammateSpawnResultSchema } from '../schemas'

const valid = { status: 'teammate_spawned', agent_id: 'scout@team-1', name: 'scout' }

describe('teammateSpawnResultSchema', () => {
  it('accepts a spawn result without agent_type', () => {
    expect(teammateSpawnResultSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts an unknown field but strips it from the parsed data', () => {
    const parsed = teammateSpawnResultSchema.safeParse({ ...valid, prompt: 'long text' })

    expect([parsed.success, parsed.data]).toEqual([true, valid])
  })

  it.each([
    ['team_name', { team_name: 'x'.repeat(MAX_LABEL_CODE_UNITS + 1) }],
    ['agent_type', { agent_type: null }],
    ['agent_id', { agent_id: 42 }]
  ])('reads an unusable %s as absent rather than failing', (field, override) => {
    const parsed = teammateSpawnResultSchema.safeParse({ ...valid, ...override })

    expect([
      parsed.success,
      parsed.data?.[field as 'team_name' | 'agent_type' | 'agent_id']
    ]).toEqual([true, undefined])
  })

  it('accepts a spawn with no agent_id but a team_name', () => {
    const parsed = teammateSpawnResultSchema.safeParse({
      status: 'teammate_spawned',
      name: 'scout',
      team_name: 'team-1'
    })

    expect([parsed.success, parsed.data?.team_name]).toEqual([true, 'team-1'])
  })

  it('rejects a different status', () => {
    expect(
      teammateSpawnResultSchema.safeParse({ ...valid, status: 'async_launched' }).success
    ).toBe(false)
  })

  it('rejects a result missing name', () => {
    expect(teammateSpawnResultSchema.safeParse({ ...valid, name: undefined }).success).toBe(false)
  })

  it('rejects an oversized name', () => {
    expect(
      teammateSpawnResultSchema.safeParse({ ...valid, name: 'x'.repeat(MAX_LABEL_CODE_UNITS + 1) })
        .success
    ).toBe(false)
  })

  it('rejects a name under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    const name = '😀'.repeat(200)

    expect(teammateSpawnResultSchema.safeParse({ ...valid, name }).success).toBe(false)
  })

  it('reads a non-BMP agent_id under the code-point cap but over the code-unit cap as absent', () => {
    const agentId = '😀'.repeat(200)
    const parsed = teammateSpawnResultSchema.safeParse({ ...valid, agent_id: agentId })

    expect([parsed.success, parsed.data?.agent_id]).toEqual([true, undefined])
  })
})
