import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { SessionsBody } from '../SessionsBody'

/** A body whose folder is gone, as of the failed load at `errorUpdatedAt`. */
function notFoundBody(errorUpdatedAt: number): React.JSX.Element {
  return (
    <SessionsBody
      data={undefined}
      error={new IpcCallError('not-found')}
      errorUpdatedAt={errorUpdatedAt}
      isFetching={false}
      onRetry={() => undefined}
      hasMatches
    >
      {null}
    </SessionsBody>
  )
}

describe('SessionsBody for a gone folder', () => {
  it('names its message group by the heading and describes it by the body', () => {
    render(notFoundBody(1))

    expect(
      screen.getByRole('group', {
        name: 'Project folder not found',
        description: "This project's folder no longer exists in ~/.claude/projects."
      })
    ).toBeTruthy()
  })

  it('announces a repeated failure again with a fresh alert', () => {
    const { rerender } = render(notFoundBody(1))
    const first = screen.getByRole('alert')

    rerender(notFoundBody(2))

    expect(screen.getByRole('alert')).not.toBe(first)
    expect(first.isConnected).toBe(false)
  })
})
