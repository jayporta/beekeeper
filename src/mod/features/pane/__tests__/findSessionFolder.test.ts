import { describe, expect, it } from 'vitest'
import { createTestHost, type TestPath } from '../../../testHost'
import { findSessionFolder } from '../findSessionFolder'

const ROOT = '/home/u/.claude/projects'
const ID = '11111111-1111-4111-8111-111111111111'

function folders(
  names: readonly string[],
  transcripts: Readonly<Record<string, number>> = {}
): Record<string, TestPath> {
  const paths: Record<string, TestPath> = {
    [ROOT]: {
      kind: 'dir',
      entries: names.map((name) => ({
        name,
        kind: 'dir',
        size: 0,
        mtimeMs: 1,
        isLink: false
      }))
    }
  }
  for (const [folder, mtimeMs] of Object.entries(transcripts)) {
    paths[`${ROOT}/${folder}/${ID}.jsonl`] = { kind: 'file', mtimeMs }
  }
  return paths
}

function find(
  paths: Record<string, TestPath>,
  sessionRoot = '/work/app',
  sessionId = ID
): Promise<string | null> {
  return findSessionFolder(createTestHost({ paths }), {
    projectsRoot: ROOT,
    sessionId,
    sessionRoot
  })
}

describe('findSessionFolder', () => {
  it('finds the one folder that holds the transcript', async () => {
    expect(await find(folders(['-a', '-b'], { '-b': 5 }))).toBe('-b')
  })

  it('returns null when no folder holds the transcript', async () => {
    expect(await find(folders(['-a', '-b']))).toBeNull()
  })

  it('returns null when the projects folder is missing', async () => {
    expect(await find({})).toBeNull()
  })

  it('prefers the folder named for the session root when several match', async () => {
    const paths = folders(['-work-app', '-other'], { '-work-app': 1, '-other': 9 })

    expect(await find(paths, '/work/app')).toBe('-work-app')
  })

  it('takes the newest transcript when none matches the session root', async () => {
    const paths = folders(['-a', '-b'], { '-a': 1, '-b': 9 })

    expect(await find(paths, '/elsewhere')).toBe('-b')
  })

  it('returns null without reading anything for an id that is not a session id', async () => {
    const paths = folders(['-a'], { '-a': 1 })

    expect(await find(paths, '/work/app', '../../etc/passwd')).toBeNull()
  })

  it('ignores a folder whose transcript path is not a regular file', async () => {
    const paths = folders(['-a'])
    paths[`${ROOT}/-a/${ID}.jsonl`] = { kind: 'dir' }

    expect(await find(paths)).toBeNull()
  })
})
