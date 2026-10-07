import { describe, expect, it } from 'vitest'
import { MAX_LABEL_CODE_UNITS } from '../boundedLabel'
import { MAX_WORKFLOW_PHASES, workflowRunRecordSchema } from '../schemas/workflowRunRecord'

describe('workflowRunRecordSchema', () => {
  it('reads the name, completion and phase titles', () => {
    const record = workflowRunRecordSchema.parse({
      workflowName: 'scan',
      status: 'completed',
      phases: [{ title: 'Inventory' }, { title: 'Research' }]
    })

    expect(record).toEqual({ name: 'scan', completed: true, phases: ['Inventory', 'Research'] })
  })

  it('reads a status other than completed as not completed', () => {
    const record = workflowRunRecordSchema.parse({ workflowName: 'scan', status: 'failed' })

    expect(record.completed).toBe(false)
  })

  it('reads a missing status as not completed', () => {
    expect(workflowRunRecordSchema.parse({ workflowName: 'scan' }).completed).toBe(false)
  })

  it.each([
    ['a bidi override', 'sc‮out'],
    ['a newline', 'sc\nout'],
    ['a blank value', '   '],
    ['an oversized value', 'x'.repeat(MAX_LABEL_CODE_UNITS + 1)],
    ['a number', 7],
    ['an absent value', undefined]
  ])('reads a workflowName with %s as no name', (_label, workflowName) => {
    const record = workflowRunRecordSchema.parse({ workflowName, status: 'completed' })

    expect(record.name).toBeNull()
  })

  it('trims the name', () => {
    expect(workflowRunRecordSchema.parse({ workflowName: '  scan ' }).name).toBe('scan')
  })

  it('keeps the first 32 phases of a longer list', () => {
    const phases = Array.from({ length: 40 }, (_, i) => ({ title: `P${i}` }))

    const record = workflowRunRecordSchema.parse({ workflowName: 'scan', phases })

    expect(record.phases).toEqual(phases.slice(0, MAX_WORKFLOW_PHASES).map((p) => p.title))
    expect(record.phases).toHaveLength(32)
  })

  it.each([
    ['no title', {}],
    ['a numeric title', { title: 3 }],
    ['an unprintable title', { title: 'a‮b' }],
    ['a non-object entry', 'Inventory']
  ])('drops a phase with %s and keeps the others', (_label, bad) => {
    const record = workflowRunRecordSchema.parse({
      phases: [{ title: 'First' }, bad, { title: 'Last' }]
    })

    expect(record.phases).toEqual(['First', 'Last'])
  })

  it('reads a phases value that is not a list as no phases', () => {
    expect(workflowRunRecordSchema.parse({ phases: { title: 'x' } }).phases).toEqual([])
  })

  it('tolerates extra fields', () => {
    const record = workflowRunRecordSchema.parse({
      workflowName: 'scan',
      script: 'run()',
      result: { big: 'payload' }
    })

    expect(record).toEqual({ name: 'scan', completed: false, phases: [] })
  })

  it('reads an empty object as an unnamed, unfinished run with no phases', () => {
    expect(workflowRunRecordSchema.parse({})).toEqual({ name: null, completed: false, phases: [] })
  })

  it.each([
    ['an array', []],
    ['null', null],
    ['a string', 'scan'],
    ['a number', 7]
  ])('fails on %s', (_label, input) => {
    expect(workflowRunRecordSchema.safeParse(input).success).toBe(false)
  })
})
