import { describe, expect, it, vi } from 'vitest'
import { err, ok, type Result } from '../../../core/shared/result'
import type {
  readWorkflowRun,
  WorkflowRunRecordError
} from '../../../core/transcript/readWorkflowRun'
import type { WorkflowRunRecord } from '../../../core/transcript/schemas/workflowRunRecord'
import { parseWorkflowRunId, type WorkflowRunId } from '../../../core/transcript/workflowRunId'
import { createWorkflowRunNamesCache, MAX_WORKFLOW_RUN_NAMES } from '../workflowRunNamesCache'

type ReadRun = typeof readWorkflowRun
type RunResult = Result<WorkflowRunRecord, WorkflowRunRecordError>

const SESSION_DIR = '/x/s'

function runId(id: string): WorkflowRunId {
  const parsed = parseWorkflowRunId(id)
  if (parsed === null) throw new Error(`bad run id ${id}`)
  return parsed
}

function record(name: string | null, completed = true): RunResult {
  return ok({ name, completed, phases: [] })
}

/** A `readRun` that answers each run id from `results`, and counts its calls. */
function fakeReadRun(results: Record<string, RunResult>): ReturnType<typeof vi.fn<ReadRun>> {
  return vi.fn<ReadRun>((_sessionDir, id) =>
    Promise.resolve(results[id] ?? err({ reason: 'missing' }))
  )
}

function read(
  cache: ReturnType<typeof createWorkflowRunNamesCache>,
  ...ids: string[]
): Promise<readonly string[]> {
  return cache.read({ sessionDir: SESSION_DIR, runIds: ids.map(runId) })
}

describe('createWorkflowRunNamesCache', () => {
  it('returns the runs’ names in run order', async () => {
    const readRun = fakeReadRun({ wf_a: record('alpha'), wf_b: record('beta') })

    expect(await read(createWorkflowRunNamesCache({ readRun }), 'wf_a', 'wf_b')).toEqual([
      'alpha',
      'beta'
    ])
  })

  it('returns no names for no runs without reading a record', async () => {
    const readRun = fakeReadRun({})

    expect(await read(createWorkflowRunNamesCache({ readRun }))).toEqual([])
    expect(readRun).not.toHaveBeenCalled()
  })

  it('returns a name shared by two runs once', async () => {
    const readRun = fakeReadRun({ wf_a: record('scan'), wf_b: record('scan') })

    expect(await read(createWorkflowRunNamesCache({ readRun }), 'wf_a', 'wf_b')).toEqual(['scan'])
  })

  it('leaves out a run whose completed record has no name, and never sends null', async () => {
    const readRun = fakeReadRun({ wf_a: record(null), wf_b: record('beta') })

    expect(await read(createWorkflowRunNamesCache({ readRun }), 'wf_a', 'wf_b')).toEqual(['beta'])
  })

  it('reads a record once when its run is listed again', async () => {
    const readRun = fakeReadRun({ wf_a: record('alpha') })
    const cache = createWorkflowRunNamesCache({ readRun })
    await read(cache, 'wf_a')

    expect(await read(cache, 'wf_a')).toEqual(['alpha'])
    expect(readRun).toHaveBeenCalledTimes(1)
  })

  it('reads only the runs it has not seen when a session gains a run', async () => {
    const readRun = fakeReadRun({ wf_a: record('alpha'), wf_b: record('beta') })
    const cache = createWorkflowRunNamesCache({ readRun })
    await read(cache, 'wf_a')

    expect(await read(cache, 'wf_a', 'wf_b')).toEqual(['alpha', 'beta'])
    expect(readRun).toHaveBeenCalledTimes(2)
  })

  it('keeps the same run id in two sessions apart', async () => {
    const readRun = vi.fn<ReadRun>((sessionDir) =>
      Promise.resolve(record(sessionDir === '/x/one' ? 'first' : 'second'))
    )
    const cache = createWorkflowRunNamesCache({ readRun })

    const first = await cache.read({ sessionDir: '/x/one', runIds: [runId('wf_a')] })
    const second = await cache.read({ sessionDir: '/x/two', runIds: [runId('wf_a')] })

    expect([first, second]).toEqual([['first'], ['second']])
  })

  it('reads a run again when its record is missing, so a record written later is found', async () => {
    const results: Record<string, RunResult> = {}
    const readRun = fakeReadRun(results)
    const cache = createWorkflowRunNamesCache({ readRun })
    expect(await read(cache, 'wf_a')).toEqual([])
    results.wf_a = record('alpha')

    expect(await read(cache, 'wf_a')).toEqual(['alpha'])
    expect(readRun).toHaveBeenCalledTimes(2)
  })

  it('reads a run again when its record is unusable', async () => {
    const readRun = fakeReadRun({ wf_a: err({ reason: 'invalid-shape' }) })
    const cache = createWorkflowRunNamesCache({ readRun })
    await read(cache, 'wf_a')
    await read(cache, 'wf_a')

    expect(readRun).toHaveBeenCalledTimes(2)
  })

  it('reads a run again while its record has no name and is not completed', async () => {
    const readRun = fakeReadRun({ wf_a: record(null, false) })
    const cache = createWorkflowRunNamesCache({ readRun })
    await read(cache, 'wf_a')
    await read(cache, 'wf_a')

    expect(readRun).toHaveBeenCalledTimes(2)
  })

  it('keeps a completed record that has no name, since it cannot gain one', async () => {
    const readRun = fakeReadRun({ wf_a: record(null, true) })
    const cache = createWorkflowRunNamesCache({ readRun })
    await read(cache, 'wf_a')
    await read(cache, 'wf_a')

    expect(readRun).toHaveBeenCalledTimes(1)
  })

  it('keeps the name of a record that is not completed', async () => {
    const readRun = fakeReadRun({ wf_a: record('alpha', false) })
    const cache = createWorkflowRunNamesCache({ readRun })
    await read(cache, 'wf_a')
    await read(cache, 'wf_a')

    expect(readRun).toHaveBeenCalledTimes(1)
  })

  it('leaves out a run whose record cannot be opened, without rejecting', async () => {
    const readRun = vi.fn<ReadRun>((_sessionDir, id) =>
      id === 'wf_a'
        ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }))
        : Promise.resolve(record('beta'))
    )

    expect(await read(createWorkflowRunNamesCache({ readRun }), 'wf_a', 'wf_b')).toEqual(['beta'])
  })

  it('stops at the most names it returns', async () => {
    const ids = Array.from({ length: MAX_WORKFLOW_RUN_NAMES + 5 }, (_, i) => `wf_${i}`)
    const readRun = vi.fn<ReadRun>((_sessionDir, id) => Promise.resolve(record(`name ${id}`)))

    const names = await read(createWorkflowRunNamesCache({ readRun }), ...ids)

    expect(names).toHaveLength(MAX_WORKFLOW_RUN_NAMES)
    expect(names[0]).toBe('name wf_0')
  })

  it('forgets the least recently used run when the weight bound is passed', async () => {
    const readRun = fakeReadRun({ wf_a: record('alpha'), wf_b: record('beta') })
    const oneEntry = 128 + `${SESSION_DIR}\0wf_a`.length + 'alpha'.length
    const cache = createWorkflowRunNamesCache({ readRun, maxWeight: oneEntry })
    await read(cache, 'wf_a')
    await read(cache, 'wf_b')
    readRun.mockClear()

    await read(cache, 'wf_a')

    expect(readRun).toHaveBeenCalledTimes(1)
  })

  it('serves, but does not keep, an entry heavier than the whole bound', async () => {
    const readRun = fakeReadRun({ wf_a: record('alpha') })
    const cache = createWorkflowRunNamesCache({ readRun, maxWeight: 10 })

    expect(await read(cache, 'wf_a')).toEqual(['alpha'])
    await read(cache, 'wf_a')
    expect(readRun).toHaveBeenCalledTimes(2)
  })
})
