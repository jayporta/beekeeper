import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileTouchDto } from '../../../../../../shared/ipc/agentDto'
import { testDetail } from '../../testSessionDetail'
import { LEAD_REPORT, inspector, renderInspectorScene } from '../testInspectorScene'

const withFiles = (
  fileTouches: readonly FileTouchDto[],
  fileListIncomplete = false
): ReturnType<typeof renderInspectorScene> =>
  renderInspectorScene({
    detail: testDetail({ lead: { ...LEAD_REPORT, fileTouches, fileListIncomplete } })
  })

describe('FilesTouched', () => {
  it('counts the files in its heading and lists each with what was done to it', () => {
    renderInspectorScene()

    expect(inspector().getByRole('heading', { level: 3, name: 'Files touched · 2' })).toBeTruthy()
    const rows = inspector().getByText('/repo/src/a.ts').closest('li')
    expect(rows?.textContent).toBe('/repo/src/a.tsedit')
    expect(inspector().getByText('/repo/b.ts').closest('li')?.textContent).toBe('/repo/b.tscreate')
  })

  it.each(['edit', 'create', 'update', 'delete', 'change'] as const)(
    'names the %s operation',
    (operation) => {
      withFiles([{ filePath: '/repo/x.ts', operation, source: 'edit-write' }])

      expect(inspector().getByText('/repo/x.ts').closest('li')?.textContent).toBe(
        `/repo/x.ts${operation}`
      )
    }
  )

  it('shows a whole path, however long, as plain text in bdi', () => {
    const filePath = `/repo/${'very-long-folder-name/'.repeat(12)}file.ts`
    withFiles([{ filePath, operation: 'edit', source: 'edit-write' }])

    expect(inspector().getByText(filePath).tagName).toBe('BDI')
  })

  it('does not parse a path as markup', () => {
    const filePath = '/repo/<img src=x onerror=alert(1)>.ts'
    const { container } = withFiles([{ filePath, operation: 'edit', source: 'edit-write' }])

    expect(inspector().getByText(filePath)).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('lists a file touched twice twice', () => {
    withFiles([
      { filePath: '/repo/x.ts', operation: 'edit', source: 'edit-write' },
      { filePath: '/repo/x.ts', operation: 'delete', source: 'bash' }
    ])

    expect(inspector().getAllByText('/repo/x.ts')).toHaveLength(2)
  })

  it('says a read-only agent edited nothing', () => {
    withFiles([])

    expect(inspector().getByText('Read-only agent. No edits recorded.')).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 3, name: 'Files touched · 0' })).toBeTruthy()
  })

  it('marks a list that may be missing files, and explains it', () => {
    withFiles([{ filePath: '/repo/x.ts', operation: 'edit', source: 'edit-write' }], true)

    const heading = inspector().getByRole('heading', { level: 3, name: /Files touched · 1/ })
    expect(heading.textContent).toContain('¹')
    expect(inspector().getByText(/The file list may be missing files/)).toBeTruthy()
  })

  it('does not call an agent with an incomplete list read-only', () => {
    withFiles([], true)

    expect(inspector().queryByText(/Read-only agent/)).toBeNull()
    expect(inspector().getByText('No edits recorded.')).toBeTruthy()
  })

  it('has no region of its own in the page’s landmarks', () => {
    renderInspectorScene()

    expect(screen.getAllByRole('region')).toHaveLength(2)
  })
})
