import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import type {
  UncommittedStatusDto,
  WorktreeDiffsDto
} from '../../../../../../shared/ipc/worktreeDiffDto'
import type {
  WorktreePatchDto,
  WorktreePatchFileDto
} from '../../../../../../shared/ipc/worktreePatchDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { SCENE_SESSION } from '../../graph/testGraphScene'
import { LEAD_REPORT, renderInspectorScene } from '../../inspector/testInspectorScene'
import { testDetail, testMeta, testNode, testReport } from '../../testSessionDetail'

afterEach(() => {
  vi.restoreAllMocks()
  useNavigationStore.getState().reset()
})

const detail = testDetail({
  lead: LEAD_REPORT,
  children: [
    testNode('a1', { meta: testMeta({ name: 'scout', worktreeBranch: 'feature/x' }) }),
    testNode('a3', { meta: testMeta({ name: 'builder', worktreeBranch: 'feature/y' }) })
  ],
  reports: { a1: testReport(), a3: testReport() }
})

const entry = (agentId: string, files: number): WorktreeDiffsDto['agents'][number] => ({
  agentId,
  inferredBase: false,
  result: {
    ok: true,
    diff: {
      uncommitted: 'included',
      files: Array.from({ length: files }, (_, i) => ({ path: `f${i}.ts`, added: 1, deleted: 0 })),
      untracked: []
    }
  }
})

const diffsWith = (agents: WorktreeDiffsDto['agents']): IpcResult<WorktreeDiffsDto> => ({
  ok: true,
  value: { git: 'ok', agents, sharedWorktree: null }
})

const file = (overrides: Partial<WorktreePatchFileDto> = {}): WorktreePatchFileDto => ({
  path: 'src/a.ts',
  patch: 'diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n',
  truncated: false,
  ...overrides
})

const ready = (
  files: WorktreePatchFileDto[],
  truncatedTotal = false
): IpcResult<WorktreePatchDto> => ({
  ok: true,
  value: { kind: 'ready', uncommitted: 'included', files, truncatedTotal }
})

type Patches = Parameters<typeof renderInspectorScene>[0] extends infer O
  ? O extends { patches?: infer P }
    ? P
    : never
  : never

async function openDiff(patches: Patches = { a1: ready([file()]) }): Promise<void> {
  const rendered = renderInspectorScene({
    detail,
    diffs: { [SCENE_SESSION.sessionId]: diffsWith([entry('a1', 1), entry('a3', 2)]) },
    patches
  })
  openedApi = rendered.api
  await userEvent.click(screen.getByRole('button', { name: /^scout/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Open diff' }))
}

let openedApi: ReturnType<typeof renderInspectorScene>['api'] | undefined

const dialog = (): ReturnType<typeof within> => within(screen.getByRole('dialog'))

describe('the Open diff button', () => {
  it('shows for a subagent that changed files, as a button', async () => {
    renderInspectorScene({
      detail,
      diffs: { [SCENE_SESSION.sessionId]: diffsWith([entry('a1', 1)]) }
    })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await screen.findByRole('button', { name: 'Open diff' })).toBeTruthy()
  })

  it('does not show when the agent changed no files', async () => {
    renderInspectorScene({
      detail,
      diffs: { [SCENE_SESSION.sessionId]: diffsWith([entry('a1', 0)]) }
    })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    await screen.findByText(/\+0 −0 across 0 files/)
    expect(screen.queryByRole('button', { name: 'Open diff' })).toBeNull()
  })

  it('does not show when the diff could not be computed', async () => {
    renderInspectorScene({
      detail,
      diffs: {
        [SCENE_SESSION.sessionId]: diffsWith([
          { agentId: 'a1', inferredBase: false, result: { ok: false, code: 'timeout' } }
        ])
      }
    })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    await screen.findByText('Git took too long to produce the diff.')
    expect(screen.queryByRole('button', { name: 'Open diff' })).toBeNull()
  })

  it('does not fetch the patch until it is pressed', async () => {
    const { api } = renderInspectorScene({
      detail,
      diffs: { [SCENE_SESSION.sessionId]: diffsWith([entry('a1', 1)]) }
    })
    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    await screen.findByRole('button', { name: 'Open diff' })

    expect(api.getWorktreePatch).not.toHaveBeenCalled()
  })
})

describe('the patch dialog', () => {
  it('opens as a modal dialog named Diff, with the branch, and fetches that agent’s patch', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')

    await openDiff()

    expect(showModal).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Diff' })).toBeTruthy()
    expect(dialog().getByText('feature/x').tagName).toBe('BDI')
    expect(openedApi?.getWorktreePatch).toHaveBeenCalledExactlyOnceWith(
      SCENE_SESSION.projectDirName,
      SCENE_SESSION.sessionId,
      'a1'
    )
  })

  it('asks for the patch of the agent whose diff was opened, not another’s', async () => {
    await openDiff({ a1: ready([file()]), a3: ready([file({ path: 'other.ts' })]) })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await userEvent.click(screen.getByRole('button', { name: /^builder/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open diff' }))

    expect(await dialog().findByRole('heading', { level: 3, name: 'other.ts' })).toBeTruthy()
    expect(openedApi?.getWorktreePatch).toHaveBeenLastCalledWith(
      SCENE_SESSION.projectDirName,
      SCENE_SESSION.sessionId,
      'a3'
    )
  })

  it('never shows one agent’s cached patch under another agent’s diff', async () => {
    await openDiff({ a1: ready([file()]), a3: new Promise(() => undefined) })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await userEvent.click(screen.getByRole('button', { name: /^builder/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open diff' }))

    expect(await dialog().findByText('Loading the diff')).toBeTruthy()
    expect(dialog().queryByRole('heading', { level: 3, name: 'src/a.ts' })).toBeNull()
  })

  it('closes with the Close button, and returns focus to Open diff', async () => {
    await openDiff()
    const opener = screen.getByRole('button', { name: 'Open diff', hidden: true })

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('closes on Escape, which the browser sends as a cancel event, and returns focus', async () => {
    await openDiff()
    const opener = screen.getByRole('button', { name: 'Open diff', hidden: true })

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('says the patch is loading while it loads', async () => {
    await openDiff({ a1: new Promise(() => undefined) })

    expect(await dialog().findByRole('status')).toBeTruthy()
    expect(dialog().getByText('Loading the diff')).toBeTruthy()
  })

  it('says the diff could not be loaded when the call fails', async () => {
    await openDiff({ a1: { ok: false, error: { code: 'unreadable' } } })

    expect(await dialog().findByText("beekeeper couldn't load the diff.")).toBeTruthy()
  })

  it.each([
    ['git-not-found', "Git isn't installed, so the diff isn't available."],
    ['git-too-old', 'This version of git is too old to show the diff. Update git to see it.']
  ] as const)('says so when git is unusable (%s)', async (git, note) => {
    await openDiff({ a1: { ok: true, value: { kind: 'unavailable', git } } })

    expect(await dialog().findByText(note)).toBeTruthy()
  })

  it.each([
    ['branch-not-found', 'The branch no longer exists.'],
    ['output-too-large', 'The diff is too large to show.'],
    ['outside-project', "The repository can't be found."],
    ['git-failed', "The diff couldn't be computed."]
  ] as const)('notes why a patch failed (%s)', async (code, note) => {
    await openDiff({ a1: { ok: true, value: { kind: 'failed', code } } })

    expect(await dialog().findByText(note)).toBeTruthy()
  })

  it('says there is nothing to show for a patch of no files', async () => {
    await openDiff({ a1: ready([]) })

    expect(await dialog().findByText('No changes to show.')).toBeTruthy()
  })
})

describe('announcing the outcome', () => {
  function deferredPatch(): {
    promise: Promise<IpcResult<WorktreePatchDto>>
    resolve: (result: IpcResult<WorktreePatchDto>) => void
  } {
    let resolve: (result: IpcResult<WorktreePatchDto>) => void = () => undefined
    const promise = new Promise<IpcResult<WorktreePatchDto>>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  it('keeps one status region from loading to loaded, with a hidden summary and no patch text in it', async () => {
    const pending = deferredPatch()
    await openDiff({ a1: pending.promise })
    const status = await dialog().findByRole('status')
    expect(status.textContent).toBe('Loading the diff')

    pending.resolve(ready([file(), file({ path: 'src/b.ts' })]))

    await waitFor(() => {
      expect(status.textContent).toBe('Diff loaded: 2 files')
    })
    expect(dialog().getByRole('status')).toBe(status)
    expect(status.classList.contains('visuallyHidden')).toBe(true)
    expect(status.querySelector('pre')).toBeNull()
    expect(dialog().getAllByRole('heading', { level: 3 })).toHaveLength(2)
  })

  it('loads the patch again when the dialog is reopened, so the status region announces the load again', async () => {
    await openDiff({ a1: ready([file()]) })
    await dialog().findByRole('heading', { level: 3, name: 'src/a.ts' })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    const pending = deferredPatch()
    openedApi?.getWorktreePatch.mockReturnValueOnce(pending.promise)

    await userEvent.click(screen.getByRole('button', { name: 'Open diff' }))

    expect(dialog().getByRole('status').textContent).toBe('Loading the diff')
    expect(dialog().queryByRole('heading', { level: 3 })).toBeNull()
    pending.resolve(ready([file(), file({ path: 'src/b.ts' })]))
    await waitFor(() => {
      expect(dialog().getByRole('status').textContent).toBe('Diff loaded: 2 files')
    })
    expect(openedApi?.getWorktreePatch).toHaveBeenCalledTimes(2)
  })

  it('counts a single file in the singular', async () => {
    const pending = deferredPatch()
    await openDiff({ a1: pending.promise })
    const status = await dialog().findByRole('status')

    pending.resolve(ready([file()]))

    await waitFor(() => {
      expect(status.textContent).toBe('Diff loaded: 1 file')
    })
  })

  it('keeps one status region from loading to a failure, and shows the failure in it', async () => {
    const pending = deferredPatch()
    await openDiff({ a1: pending.promise })
    const status = await dialog().findByRole('status')

    pending.resolve({ ok: false, error: { code: 'unreadable' } })

    await waitFor(() => {
      expect(status.textContent).toBe("beekeeper couldn't load the diff.")
    })
    expect(dialog().getByRole('status')).toBe(status)
    expect(status.classList.contains('visuallyHidden')).toBe(false)
  })

  it.each([
    [
      { kind: 'unavailable', git: 'git-not-found' },
      "Git isn't installed, so the diff isn't available."
    ],
    [{ kind: 'failed', code: 'git-failed' }, "The diff couldn't be computed."]
  ] as const)(
    'puts why a patch is unavailable or failed in the status region (%j)',
    async (value, note) => {
      await openDiff({ a1: { ok: true, value } })

      await waitFor(() => {
        expect(dialog().getByRole('status').textContent).toBe(note)
      })
    }
  )

  it('puts the empty note in the status region for a patch of no files', async () => {
    await openDiff({ a1: ready([]) })

    await waitFor(() => {
      expect(dialog().getByRole('status').textContent).toBe('No changes to show.')
    })
  })
})

describe('the patch text', () => {
  it('shows each file by its path, with its patch as text in a pre', async () => {
    await openDiff({
      a1: ready([file(), file({ path: 'src/b.ts', patch: '@@ -1 +1 @@\n-b\n+B\n' })])
    })

    const heading = await dialog().findByRole('heading', { level: 3, name: 'src/a.ts' })

    expect(heading.querySelector('bdi')?.textContent).toBe('src/a.ts')
    expect(
      dialog()
        .getAllByRole('heading', { level: 3 })
        .map((heading: HTMLElement) => heading.textContent)
    ).toEqual(['src/a.ts', 'src/b.ts'])
    const pre = heading.closest('section')?.querySelector('pre')
    expect(pre?.textContent).toBe(file().patch)
  })

  it('renders markup in a patch as text, never as elements', async () => {
    const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)><b>bold</b>'
    await openDiff({
      a1: ready([file({ path: '<i>x</i>.ts', patch: `@@ -1 +1 @@\n-${hostile}\n+${hostile}\n` })])
    })

    await dialog().findByRole('heading', { level: 3 })
    const root = screen.getByRole('dialog')

    expect(root.querySelector('script, img, b, i')).toBeNull()
    expect(root.querySelector('pre')?.textContent).toContain(`+${hostile}\n`)
    expect(within(root).getByRole('heading', { level: 3 }).textContent).toBe('<i>x</i>.ts')
  })

  it('colors added and removed lines by their first character, and leaves the rest alone', async () => {
    await openDiff({
      a1: ready([file({ patch: 'diff --git a/x b/x\n context\n-gone\n+came\n+more\n tail\n' })])
    })

    await dialog().findByRole('heading', { level: 3 })
    const runs = [...screen.getByRole('dialog').querySelectorAll<HTMLElement>('pre [data-kind]')]

    expect(runs.map((run) => [run.dataset['kind'], run.textContent])).toEqual([
      ['other', 'diff --git a/x b/x\n context\n'],
      ['remove', '-gone\n'],
      ['add', '+came\n+more\n'],
      ['other', ' tail\n']
    ])
  })

  it('shows where a renamed file came from', async () => {
    await openDiff({ a1: ready([file({ path: 'new.ts', oldPath: 'old.ts' })]) })

    expect(await dialog().findByText('renamed from old.ts')).toBeTruthy()
  })

  it('notes a file whose patch was cut', async () => {
    await openDiff({ a1: ready([file({ truncated: true })]) })

    expect(await dialog().findByText('Patch truncated')).toBeTruthy()
    expect(screen.getByRole('dialog').querySelector('pre')).not.toBeNull()
  })

  it('lists a file left out by the total cap with its note and no patch', async () => {
    await openDiff({ a1: ready([file({ patch: '', truncated: true })], true) })

    expect(await dialog().findByText('Patch truncated')).toBeTruthy()
    expect(screen.getByRole('dialog').querySelector('pre')).toBeNull()
  })

  it('notes a diff the total cap cut', async () => {
    await openDiff({ a1: ready([file({ truncated: true })], true) })

    expect(
      await dialog().findByText(
        'Patch truncated: the diff is too large, so only its first part is shown.'
      )
    ).toBeTruthy()
  })

  it('has no truncation note for a patch that fits', async () => {
    await openDiff()

    await dialog().findByRole('heading', { level: 3 })
    expect(dialog().queryByText(/Patch truncated/)).toBeNull()
  })

  it('shows a file the patch lists twice under distinct paths without a key clash', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await openDiff({
      a1: ready([file({ path: 'same.ts' }), file({ path: 'same.ts', oldPath: 'other.ts' })])
    })

    await waitFor(() => {
      expect(dialog().getAllByRole('heading', { level: 3 })).toHaveLength(2)
    })
    expect(error).not.toHaveBeenCalled()
  })
})

describe('uncommitted work', () => {
  const withUncommitted = (uncommitted: UncommittedStatusDto): IpcResult<WorktreePatchDto> => ({
    ok: true,
    value: { kind: 'ready', uncommitted, files: [file()], truncatedTotal: false }
  })

  it('says uncommitted work is left out when the agent’s worktree folder is not available', async () => {
    await openDiff({ a1: withUncommitted('no-worktree') })

    expect(
      await dialog().findByText(
        "Uncommitted changes aren't included: this agent's worktree folder isn't available."
      )
    ).toBeTruthy()
  })

  it('says uncommitted work is left out when a git filter would have to run', async () => {
    await openDiff({ a1: withUncommitted('skipped-filters') })

    expect(await dialog().findByText(/this repository uses git filters/)).toBeTruthy()
  })

  it('says uncommitted work is left out when the folder is not the agent’s worktree', async () => {
    await openDiff({ a1: withUncommitted('worktree-mismatch') })

    expect(await dialog().findByText(/that folder isn't this agent's worktree/)).toBeTruthy()
  })

  it('has no note when uncommitted work is included', async () => {
    await openDiff({ a1: withUncommitted('included') })

    await dialog().findByRole('heading', { level: 3 })
    expect(dialog().queryByText(/Uncommitted changes/)).toBeNull()
  })
})
