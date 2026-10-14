import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { FileDiffDto } from '../../../../../../shared/ipc/fileDiffDto'
import { testDetail } from '../../testSessionDetail'
import { LEAD_REPORT, inspector, renderInspectorScene } from '../testInspectorScene'

const diff: FileDiffDto = {
  filePath: '/repo/src/a.ts',
  truncated: false,
  changes: [
    {
      kind: 'patch',
      source: 'edit-write',
      operation: 'edit',
      hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-x', '+y'] }],
      userModified: false,
      shared: false,
      cut: false
    }
  ]
}

function renderScene(): ReturnType<typeof renderInspectorScene> {
  return renderInspectorScene({
    apiOverrides: { getFileDiff: () => Promise.resolve({ ok: true, value: diff }) }
  })
}

const row = (): HTMLElement => inspector().getByRole('button', { name: /\/repo\/src\/a\.ts/ })

describe('FilesTouched rows', () => {
  it('are buttons that announce they open a dialog', () => {
    renderScene()

    expect(row().getAttribute('aria-haspopup')).toBe('dialog')
    expect(inspector().getByRole('button', { name: /\/repo\/b\.ts/ })).toBeTruthy()
  })

  it('open a dialog named by the file path, which loads that agent’s diff', async () => {
    const { api } = renderScene()

    await userEvent.click(row())

    const dialog = await screen.findByRole('dialog', { name: '/repo/src/a.ts' })
    expect(dialog).toBeTruthy()
    expect(await screen.findByText('+y')).toBeTruthy()
    expect(api.getFileDiff).toHaveBeenCalledWith({
      projectDirName: expect.any(String),
      sessionId: expect.any(String),
      agentId: null,
      filePath: '/repo/src/a.ts'
    })
  })

  it('open with Enter on the focused row', async () => {
    renderScene()
    row().focus()

    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('dialog', { name: '/repo/src/a.ts' })).toBeTruthy()
  })

  it('return focus to the row when the dialog is closed with Close', async () => {
    renderScene()
    await userEvent.click(row())
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(row())
  })

  it('fetch nothing until a row is opened', () => {
    const { api } = renderScene()

    expect(api.getFileDiff).not.toHaveBeenCalled()
  })

  it('are plain text in an archived session, which has no transcript to read', () => {
    renderInspectorScene({ detail: testDetail({ lead: LEAD_REPORT, archived: true }) })

    expect(inspector().getByText('/repo/src/a.ts')).toBeTruthy()
    expect(inspector().queryByRole('button', { name: /\/repo\/src\/a\.ts/ })).toBeNull()
  })
})
