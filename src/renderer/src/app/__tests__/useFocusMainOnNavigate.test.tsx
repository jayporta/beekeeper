import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useFocusMainOnNavigate } from '../useFocusMainOnNavigate'

const ref = { projectDirName: 'a', sessionId: '11111111-1111-4111-8111-111111111111' }

afterEach(() => {
  useNavigationStore.setState({ navigationCount: 0 })
  useNavigationStore.getState().reset()
})

function Harness(): React.JSX.Element {
  const mainRef = useRef<HTMLElement>(null)
  useFocusMainOnNavigate(mainRef)
  return (
    <>
      <button type="button">Elsewhere</button>
      <main ref={mainRef} tabIndex={-1}>
        Main
      </main>
    </>
  )
}

describe('useFocusMainOnNavigate', () => {
  it('leaves focus alone on the first render', () => {
    render(<Harness />)

    expect(document.activeElement).toBe(document.body)
  })

  it.each([
    ['showOverview', () => useNavigationStore.getState().showOverview()],
    ['showSessions', () => useNavigationStore.getState().showSessions()],
    ['showSession', () => useNavigationStore.getState().showSession(ref)]
  ])('focuses the main landmark after %s', (_name, navigate) => {
    render(<Harness />)
    screen.getByRole('button', { name: 'Elsewhere' }).focus()

    act(navigate)

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('does not move focus when navigation is reset', () => {
    render(<Harness />)
    act(() => {
      useNavigationStore.getState().showSession(ref)
    })
    screen.getByRole('button', { name: 'Elsewhere' }).focus()

    act(() => {
      useNavigationStore.getState().reset()
    })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }))
  })
})
