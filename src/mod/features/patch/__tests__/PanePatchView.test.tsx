import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { testPaneNode } from '../../pane/testPaneView'
import type { PaneNode } from '../../pane/paneView'
import {
  findAll,
  installTestH,
  makeTestElements,
  removeTestH,
  textOf,
  type TestNode
} from '../../shared/testElements'
import { PanePatchView } from '../PanePatchView'
import { emptyPanePatch, PATCH_CHAR_BUDGET, type PanePatch, type PanePatchFile } from '../panePatch'
import { testPatchPane, testPatchPaneOf } from '../testPatchPane'
import { toPanePatch } from '../toPanePatch'

const NODE: PaneNode = testPaneNode('sub:a1', {
  worktree: { projectDirName: '-p', sessionId: 's1', agentId: 'a1', branch: 'feat/x' }
})
const HEADER = 'diff --git a/f b/f\n--- a/f\n+++ b/f\n'
const HUNK = '@@ -1 +1 @@\n-old\n+new\n'

const readyPatch = (overrides: Partial<PanePatch> = {}): PanePatch => ({
  ...emptyPanePatch({ sessionId: 's1', key: 'sub:a1', status: 'ready', nowMs: 1 }),
  uncommitted: 'included',
  ...overrides
})
const file = (overrides: Partial<PanePatchFile> = {}): PanePatchFile => ({
  path: 'src/a.ts',
  oldPath: null,
  text: HEADER + HUNK,
  truncated: false,
  ...overrides
})

beforeAll(installTestH)
afterAll(removeTestH)

describe.each(['terminal', 'desktop'] as const)('PanePatchView on %s', () => {
  const elements = makeTestElements()
  const draw = (patch: ReturnType<typeof testPatchPane>, hasFiles = true): TestNode =>
    PanePatchView({ elements, node: NODE, sessionId: 's1', hasFiles, patch }) as TestNode
  const codes = (tree: TestNode): TestNode[] => findAll(tree, elements.Code)
  const buttons = (tree: TestNode): TestNode[] => findAll(tree, elements.Button)

  it('offers Show patch when none is stored, and draws nothing else', () => {
    const tree = draw(testPatchPane())

    expect(textOf(tree)).toBe('Show patch')
    expect(buttons(tree)).toHaveLength(1)
  })

  it('offers nothing when the diff lists no files', () => {
    expect(buttons(draw(testPatchPane(), false))).toEqual([])
  })

  it('asks for the patch of the node when Show patch is pressed', () => {
    const onShow = vi.fn()
    const tree = draw(testPatchPane({ onShow }))

    void (buttons(tree)[0]?.props['onPress'] as () => void)()

    expect(onShow).toHaveBeenCalledWith('sub:a1')
  })

  it('offers Hide patch for a shown patch and hides it when pressed', () => {
    const onHide = vi.fn()
    const tree = draw(testPatchPaneOf(readyPatch({ files: [file()] }), { onHide }))

    void (buttons(tree)[0]?.props['onPress'] as () => void)()

    expect(textOf(tree)).toContain('Hide patch')
    expect(onHide).toHaveBeenCalled()
  })

  it('treats a hidden patch, and one of another node or session, as not shown', () => {
    for (const stored of [
      emptyPanePatch({ sessionId: 's1', key: 'sub:a1', status: 'none', nowMs: 1 }),
      readyPatch({ key: 'sub:other', files: [file({ path: 'secret.ts' })] }),
      readyPatch({ sessionId: 's2', files: [file({ path: 'secret.ts' })] })
    ]) {
      const text = textOf(draw(testPatchPaneOf(stored)))

      expect(text).toContain('Show patch')
      expect(text).not.toContain('secret.ts')
    }
  })

  it('says it is loading while the patch loads', () => {
    const tree = draw(
      testPatchPaneOf(
        emptyPanePatch({ sessionId: 's1', key: 'sub:a1', status: 'loading', nowMs: 1 })
      )
    )

    expect(textOf(tree)).toContain('Loading the patch.')
  })

  it('draws a file as its path and a Code block holding its text, as a diff when it has a hunk', () => {
    const tree = draw(testPatchPaneOf(readyPatch({ files: [file()] })))

    const [code] = codes(tree)
    expect(textOf(tree)).toContain('src/a.ts')
    expect(code?.props).toMatchObject({ source: HEADER + HUNK, format: 'diff' })
    expect(code?.props).not.toHaveProperty('key')
    expect(code?.children).toEqual([])
  })

  it('draws a patch without a hunk as source, never as a diff', () => {
    const binary = file({ text: 'diff --git a/i b/i\nBinary files differ\n' })
    const tree = draw(testPatchPaneOf(readyPatch({ files: [binary] })))

    expect(codes(tree)[0]?.props).toMatchObject({ format: 'source' })
  })

  it('puts a key on the box around each file, not on its Code', () => {
    const tree = draw(testPatchPaneOf(readyPatch({ files: [file(), file({ path: 'b.ts' })] })))

    const keyed = findAll(tree, elements.Box).filter((box) => box.props['key'] !== undefined)
    expect(keyed).toHaveLength(2)
  })

  it('says where a renamed file came from', () => {
    const tree = draw(testPatchPaneOf(readyPatch({ files: [file({ oldPath: 'old.ts' })] })))

    expect(textOf(tree)).toContain('renamed from old.ts')
  })

  it('says it was cut when a file was, or files were left out, and not otherwise', () => {
    const cutLine = 'Cut to fit the pane. The desktop app shows the whole patch.'
    const lines = (patch: PanePatch): string => textOf(draw(testPatchPaneOf(patch)))

    expect(lines(readyPatch({ files: [file()] }))).not.toContain(cutLine)
    expect(lines(readyPatch({ files: [file({ truncated: true })] }))).toContain(cutLine)
    const omitted = lines(readyPatch({ files: [file()], omittedCount: 3 }))
    expect(omitted).toContain('3 more files not shown')
    expect(omitted).toContain(cutLine)
  })

  it('draws fixed lines for git being unavailable, a diff code and a service error', () => {
    const line = (patch: PanePatch): string => textOf(draw(testPatchPaneOf(patch)))
    const failed = emptyPanePatch({
      sessionId: 's1',
      key: 'sub:a1',
      status: 'error',
      errorCode: 'not-found',
      nowMs: 1
    })

    expect(line(readyPatch({ failure: { git: 'git-not-found' } }))).toContain("Git isn't installed")
    expect(line(readyPatch({ failure: { git: 'git-too-old' } }))).toContain('too old')
    expect(line(readyPatch({ failure: { code: 'timeout' } }))).toContain('took too long')
    expect(line(failed)).toContain("can't find this session's transcript")
  })

  it('draws a 300 KB patch in under 100,000 characters, with the cut line', () => {
    const hunks = Array.from({ length: 12_000 }, (_, i) => `@@ -${i} +${i} @@\n+line ${i}\n`)
    const big = HEADER + hunks.join('')
    expect(big.length).toBeGreaterThan(250_000)
    const stored = toPanePatch({
      sessionId: 's1',
      key: 'sub:a1',
      nowMs: 1,
      dto: {
        kind: 'ready',
        uncommitted: 'included',
        truncatedTotal: false,
        files: [{ path: 'big.ts', patch: big, truncated: false }]
      }
    })

    const tree = draw(testPatchPaneOf(stored))
    const text = textOf(tree)
    const sources = codes(tree).reduce((sum, code) => sum + String(code.props['source']).length, 0)

    expect(text.length + sources).toBeLessThan(100_000)
    expect(sources).toBeGreaterThan(PATCH_CHAR_BUDGET / 2)
    expect(text).toContain('Cut to fit the pane.')
  })
})
