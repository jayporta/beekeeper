import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { graphNode, renderGraph } from '@renderer/features/sessionDetail/graph/testGraphScene'
import { isBackKeyEvent } from '../isBackKeyEvent'

afterEach(() => {
  useNavigationStore.getState().reset()
})

/** What the Back shortcut makes of a key pressed on a graph node, asked after the graph has handled it. */
function backKeyOnGraphNode(init: KeyboardEventInit): boolean {
  let accepted = false
  const listener = (event: KeyboardEvent): void => {
    accepted = isBackKeyEvent(event)
  }
  document.addEventListener('keydown', listener)
  fireEvent.keyDown(graphNode(/^Lead/), init)
  document.removeEventListener('keydown', listener)
  return accepted
}

describe('Back shortcut on the agent graph', () => {
  it('goes back on Alt and the left arrow from a graph node, which the graph leaves alone', () => {
    renderGraph()

    expect(backKeyOnGraphNode({ key: 'ArrowLeft', altKey: true })).toBe(true)
  })
})
