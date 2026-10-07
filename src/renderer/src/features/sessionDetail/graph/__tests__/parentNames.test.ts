import { describe, expect, it } from 'vitest'
import { layoutGraph } from '../layoutGraph'
import { parentNames } from '../parentNames'
import { testGraphNode } from '../testGraphNode'
import { testGraphT } from '../testGraphT'

describe('parentNames', () => {
  it('names each node’s parent, and leaves the root out', () => {
    const root = testGraphNode('lead', {
      name: 'Lead',
      kind: 'lead',
      children: [
        testGraphNode('mate', {
          name: 'writer',
          kind: 'teammate',
          children: [testGraphNode('deep', { name: 'drafter' })]
        }),
        testGraphNode('sub', { name: 'scout' })
      ]
    })

    const names = parentNames(layoutGraph(root), testGraphT)

    expect([...names]).toEqual([
      ['mate', 'Lead'],
      ['deep', 'writer'],
      ['sub', 'Lead']
    ])
  })

  it('is empty for a graph of one node', () => {
    expect(parentNames(layoutGraph(testGraphNode('lead')), testGraphT).size).toBe(0)
  })

  it('gives a run’s id with its name when another run has the same name, and only then', () => {
    const run = (runId: string, duplicateName: boolean): ReturnType<typeof testGraphNode> =>
      testGraphNode(`run:${runId}`, {
        kind: 'workflow',
        name: 'scan',
        workflow: { runId, name: 'scan', completed: true, duplicateName, phases: [] },
        children: [testGraphNode(`sub:${runId}`)]
      })
    const root = testGraphNode('lead', { children: [run('wf_a', true), run('wf_b', false)] })

    const names = parentNames(layoutGraph(root), testGraphT)

    expect(names.get('sub:wf_a')).toBe('scan (wf_a)')
    expect(names.get('sub:wf_b')).toBe('scan')
  })
})
