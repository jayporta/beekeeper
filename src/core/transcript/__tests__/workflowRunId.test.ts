import { describe, expect, it } from 'vitest'
import { parseWorkflowRunId } from '../workflowRunId'

describe('parseWorkflowRunId', () => {
  it('accepts a workflow run folder name', () => {
    expect(parseWorkflowRunId('wf_1d41dcdc-bf0')).toBe('wf_1d41dcdc-bf0')
  })

  it('accepts a 64-character suffix', () => {
    const name = `wf_${'a'.repeat(64)}`

    expect(parseWorkflowRunId(name)).toBe(name)
  })

  it.each([
    ['an empty suffix', 'wf_'],
    ['a path separator', 'wf_a/b'],
    ['a dot', 'wf_a.b'],
    ['a different prefix', 'run_1'],
    ['a 65-character suffix', `wf_${'a'.repeat(65)}`],
    ['a trailing newline', 'wf_a\n'],
    ['a parent traversal', 'wf_..']
  ])('rejects %s', (_label, name) => {
    expect(parseWorkflowRunId(name)).toBeNull()
  })
})
