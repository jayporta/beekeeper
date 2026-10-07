import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { err, ok } from '../../shared/result'
import { readWorkflowRun } from '../readWorkflowRun'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import { parseWorkflowRunId, type WorkflowRunId } from '../workflowRunId'

const RUN_ID = parseWorkflowRunId('wf_a') as WorkflowRunId
const MAX_RECORD_BYTES = 2 * 1024 * 1024

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

describe('readWorkflowRun', () => {
  it('reads the record stored for a run', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/workflows/wf_a.json': JSON.stringify({
          workflowName: 'scan',
          status: 'completed',
          phases: [{ title: 'Inventory' }]
        })
      }
    })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      ok({ name: 'scan', completed: true, phases: ['Inventory'] })
    )
  })

  it('reports a run with no record file as missing', async () => {
    tree = await buildDiscoveryTree({ files: { 'session/workflows/wf_b.json': '{}' } })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      err({ reason: 'missing' })
    )
  })

  it('reports a symlinked record as a symlink rather than following it', async () => {
    tree = await buildDiscoveryTree({
      files: { 'elsewhere.json': '{"workflowName":"scan"}' },
      symlinks: { 'session/workflows/wf_a.json': '../../elsewhere.json' }
    })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      err({ reason: 'symlink' })
    )
  })

  it('reports a record just over 2 MiB as too-large', async () => {
    // A JSON string of exactly MAX_RECORD_BYTES + 1 bytes: two quotes around the padding.
    const oversized = `"${'a'.repeat(MAX_RECORD_BYTES - 1)}"`
    tree = await buildDiscoveryTree({ files: { 'session/workflows/wf_a.json': oversized } })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      err({ reason: 'too-large' })
    )
  })

  it('reads a record of exactly 2 MiB', async () => {
    // An object padded to exactly MAX_RECORD_BYTES, so only the cap decides.
    const head = '{"workflowName":"scan","pad":"'
    const tail = '"}'
    const padding = 'a'.repeat(MAX_RECORD_BYTES - head.length - tail.length)
    tree = await buildDiscoveryTree({
      files: { 'session/workflows/wf_a.json': `${head}${padding}${tail}` }
    })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      ok({ name: 'scan', completed: false, phases: [] })
    )
  })

  it('reports unparseable content as invalid-json', async () => {
    tree = await buildDiscoveryTree({ files: { 'session/workflows/wf_a.json': '{' } })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      err({ reason: 'invalid-json' })
    )
  })

  it.each([
    ['an array', '[]'],
    ['null', 'null']
  ])('reports %s as invalid-shape', async (_label, content) => {
    tree = await buildDiscoveryTree({ files: { 'session/workflows/wf_a.json': content } })

    expect(await readWorkflowRun(join(tree.root, 'session'), RUN_ID)).toEqual(
      err({ reason: 'invalid-shape' })
    )
  })
})
