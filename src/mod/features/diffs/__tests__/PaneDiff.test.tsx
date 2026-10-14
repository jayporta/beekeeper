import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pane, type PaneElements } from '../../pane/Pane'
import { testPaneNode, testPaneView } from '../../pane/testPaneView'
import type { PaneNode, PaneView } from '../../pane/paneView'
import { installTestH, makeTestElements, removeTestH, textOf } from '../../shared/testElements'
import { testPatchPane } from '../../patch/testPatchPane'
import { PaneDiff } from '../PaneDiff'
import type { PaneDiffs, PaneDiffResult } from '../paneDiffs'

const elements = makeTestElements()
const NODE: PaneNode = testPaneNode('sub:a1', {
  name: 'builder',
  worktree: { projectDirName: '-p', sessionId: 's1', agentId: 'a1', branch: 'feat/x' }
})

function diffsOf(overrides: Partial<PaneDiffs> = {}): PaneDiffs {
  return {
    sessionId: 's1',
    key: 'sub:a1',
    status: 'ready',
    errorCode: null,
    git: 'ok',
    result: null,
    refreshedAtMs: 1,
    ...overrides
  }
}

const okResult = (
  overrides: Partial<Extract<PaneDiffResult, { ok: true }>> = {}
): PaneDiffResult => ({
  ok: true,
  uncommitted: 'included',
  files: [],
  fileCount: 0,
  untracked: [],
  untrackedCount: 0,
  ...overrides
})

const draw = (diffs: PaneDiffs | undefined, node: PaneNode = NODE): string =>
  textOf(PaneDiff({ elements, node, sessionId: 's1', diffs, patch: testPatchPane() }))

beforeAll(installTestH)
afterAll(removeTestH)

describe('PaneDiff', () => {
  it('names the branch', () => {
    expect(draw(diffsOf({ result: okResult() }))).toContain('Worktree branch feat/x')
  })

  it('says it is loading before a diff is stored, while one loads, and for a diff of another node or session', () => {
    const loading = 'Loading the worktree diff.'

    expect(draw(undefined)).toContain(loading)
    expect(draw(diffsOf({ status: 'loading' }))).toContain(loading)
    expect(draw(diffsOf({ key: 'sub:other', result: okResult() }))).toContain(loading)
    expect(draw(diffsOf({ sessionId: 's2', result: okResult() }))).toContain(loading)
  })

  it("never draws another node's files", () => {
    const other = diffsOf({
      key: 'sub:other',
      result: okResult({
        files: [{ path: 'secret.ts', oldPath: null, added: 1, deleted: 0 }],
        fileCount: 1
      })
    })

    expect(draw(other)).not.toContain('secret.ts')
  })

  it('shows each file with its lines in words, and binary files as binary', () => {
    const text = draw(
      diffsOf({
        result: okResult({
          files: [
            { path: 'src/a.ts', oldPath: null, added: 12, deleted: 3 },
            { path: 'img.png', oldPath: null, added: null, deleted: null }
          ],
          fileCount: 2
        })
      })
    )

    expect(text).toContain('12 added, 3 deleted  src/a.ts')
    expect(text).toContain('Binary  img.png')
  })

  it('says where a renamed file came from', () => {
    const text = draw(
      diffsOf({
        result: okResult({
          files: [{ path: 'new.ts', oldPath: 'old.ts', added: 0, deleted: 0 }],
          fileCount: 1
        })
      })
    )

    expect(text).toContain('renamed from old.ts')
  })

  it('lists untracked files, and says how many more there are past the caps', () => {
    const text = draw(
      diffsOf({
        result: okResult({
          files: [{ path: 'a.ts', oldPath: null, added: 1, deleted: 0 }],
          fileCount: 250,
          untracked: ['notes/'],
          untrackedCount: 60
        })
      })
    )

    expect(text).toContain('New, not tracked  notes/')
    expect(text).toContain('and 249 more files')
    expect(text).toContain('and 59 more not tracked')
  })

  it('says there are no changes', () => {
    expect(draw(diffsOf({ result: okResult() }))).toContain('No changes on this branch.')
  })

  it('draws a fixed line for git being missing or too old', () => {
    expect(draw(diffsOf({ git: 'git-not-found' }))).toContain("Git isn't installed")
    expect(draw(diffsOf({ git: 'git-too-old' }))).toContain('too old')
  })

  it('draws a fixed line for a diff code, and for a missing entry', () => {
    expect(draw(diffsOf({ result: { ok: false, code: 'branch-not-found' } }))).toContain(
      'The branch no longer exists.'
    )
    expect(draw(diffsOf({ result: { ok: false, code: 'timeout' } }))).toContain('took too long')
    expect(draw(diffsOf({ result: null }))).toContain("The diff couldn't be computed.")
  })

  it('draws a note when uncommitted work is not included', () => {
    expect(draw(diffsOf({ result: okResult({ uncommitted: 'skipped-filters' }) }))).toContain(
      "Uncommitted changes aren't included"
    )
  })

  it('draws the service error line for an error', () => {
    expect(draw(diffsOf({ status: 'error', errorCode: 'not-found' }))).toContain(
      "can't find this session's transcript"
    )
  })
})

describe('the session screen with a worktree diff', () => {
  const view = (node: PaneNode): PaneView =>
    testPaneView(testPaneNode('lead', { kind: 'lead', children: [node] }))
  const screen = (node: PaneNode, selectedKey: string, diffs?: PaneDiffs): string =>
    textOf(
      Pane({
        elements: elements as PaneElements,
        view: view(node),
        selected: { sessionId: 's1', key: selectedKey },
        onSelect: () => {},
        nav: undefined,
        browse: undefined,
        diffs,
        patch: testPatchPane(),
        onNav: () => {},
        onPickProject: () => {},
        columns: undefined
      })
    )

  it('draws the diff section only for a selected node with a worktree', () => {
    const plain = testPaneNode('sub:plain')

    expect(screen(NODE, 'sub:a1')).toContain('Worktree branch feat/x')
    expect(screen(plain, 'sub:plain')).not.toContain('Worktree branch')
  })
})
