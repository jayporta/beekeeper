import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileChangeDto, FileDiffDto } from '../../../../../../shared/ipc/fileDiffDto'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { FileDiffBody } from '../FileDiffBody'

const target = {
  ref: { projectDirName: '-Users-test-proj', sessionId: 's1' },
  agentId: null,
  filePath: '/repo/a.ts'
}

const patch = (
  overrides: Partial<Extract<FileChangeDto, { kind: 'patch' }>> = {}
): FileChangeDto => ({
  kind: 'patch',
  source: 'edit-write',
  operation: 'edit',
  hunks: [
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-old line', '+new line'] }
  ],
  userModified: false,
  shared: false,
  ...overrides
})

function renderBody(result: IpcResult<FileDiffDto>): void {
  installBeekeeperApi({ getFileDiff: () => Promise.resolve(result) })
  render(<FileDiffBody target={target} />, { wrapper: createQueryWrapper(createTestQueryClient()) })
}

const diff = (changes: FileChangeDto[], truncated = false): IpcResult<FileDiffDto> => ({
  ok: true,
  value: { filePath: '/repo/a.ts', changes, truncated }
})

describe('FileDiffBody', () => {
  it('shows the hunk header and the changed lines as text', async () => {
    renderBody(diff([patch()]))

    expect(await screen.findByText(/@@ -1,1 \+1,1 @@/)).toBeTruthy()
    expect(screen.getByText('-old line')).toBeTruthy()
    expect(screen.getByText('+new line')).toBeTruthy()
  })

  it('numbers each change and names its operation', async () => {
    renderBody(diff([patch(), patch({ operation: 'create' })]))

    expect(await screen.findByRole('heading', { name: 'Change 1 of 2' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Change 2 of 2' })).toBeTruthy()
    expect(screen.getByText('create')).toBeTruthy()
  })

  it('says when the person edited a change before accepting it', async () => {
    renderBody(diff([patch({ userModified: true })]))

    expect(await screen.findByText('Edited by the person before it was accepted.')).toBeTruthy()
  })

  it('says a Bash change came from a command, and that a shared diff may include outside changes', async () => {
    renderBody(diff([patch({ source: 'bash', shared: true })]))

    expect(await screen.findByText('Changed by a Bash command.')).toBeTruthy()
    expect(
      screen.getByText('This diff may include changes made outside this command.')
    ).toBeTruthy()
  })

  it('says no diff was recorded for an unrecorded change', async () => {
    renderBody(diff([{ kind: 'unrecorded', source: 'bash', operation: 'change' }]))

    expect(await screen.findByText('No diff was recorded for this change.')).toBeTruthy()
    expect(screen.getByText('Changed by a Bash command.')).toBeTruthy()
  })

  it('says no lines changed for a patch with no hunks', async () => {
    renderBody(diff([patch({ hunks: [] })]))

    expect(await screen.findByText('No lines changed.')).toBeTruthy()
  })

  it('says when the diff was cut', async () => {
    renderBody(diff([patch()], true))

    expect(await screen.findByText('The diff was cut to stay within the size limit.')).toBeTruthy()
  })

  it('explains a not-found result as a transcript that no longer holds the changes', async () => {
    renderBody({ ok: false, error: { code: 'not-found' } })

    expect(
      await screen.findByText("This agent's transcript no longer holds these changes.")
    ).toBeTruthy()
  })

  it('reports any other failure as unreadable', async () => {
    renderBody({ ok: false, error: { code: 'internal' } })

    expect(await screen.findByText("Couldn't read the changes.")).toBeTruthy()
  })

  it('shows a loading status first', () => {
    installBeekeeperApi({ getFileDiff: () => new Promise(() => undefined) })
    render(<FileDiffBody target={target} />, {
      wrapper: createQueryWrapper(createTestQueryClient())
    })

    expect(screen.getByRole('status').textContent).toContain('Loading changes…')
  })
})
