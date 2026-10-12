import { describe, expect, it, vi } from 'vitest'
import { createTestHost, type TestHostAnswers } from '../../../testHost'
import { locateProjectsRoot } from '../locateProjectsRoot'

describe('locateProjectsRoot', () => {
  it('is resolved when the folder exists, at its real path', async () => {
    const host = createTestHost({
      paths: { '/home/u/.claude/projects': { kind: 'dir', isLink: true, realPath: '/data/p' } }
    })

    expect(await locateProjectsRoot(host)).toEqual({ path: '/data/p', isResolved: true })
  })

  it('is unresolved, at the plain path, when the folder is missing', async () => {
    expect(await locateProjectsRoot(createTestHost())).toEqual({
      path: '/home/u/.claude/projects',
      isResolved: false
    })
  })

  it('is unresolved when the engine reports no real path, as for a link with no target yet', async () => {
    const host = createTestHost()
    vi.spyOn(host, 'stat').mockResolvedValue({ kind: 'dir', size: 0, mtimeMs: 0, isLink: true })

    expect(await locateProjectsRoot(host)).toEqual({
      path: '/home/u/.claude/projects',
      isResolved: false
    })
  })

  it.each([
    ['neither variable is set', { env: {} } satisfies TestHostAnswers],
    ['the folder would be relative', { env: { HOME: 'relative' } } satisfies TestHostAnswers]
  ])('is undefined when %s', async (_name, answers) => {
    expect(await locateProjectsRoot(createTestHost(answers))).toBeUndefined()
  })
})
