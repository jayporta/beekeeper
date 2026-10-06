import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { SCENE_SESSION, graphNode, graphNodes, renderGraph } from '../testGraphScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

/** The names of the node buttons that are in the tab order. */
const tabbable = (): string[] =>
  graphNodes()
    .filter((button) => button.tabIndex === 0)
    .map((button) => button.getAttribute('aria-label') ?? '')

describe('GraphCanvas roving tab stop', () => {
  it('puts only the lead in the tab order by default', () => {
    renderGraph()

    expect(tabbable()).toEqual([expect.stringMatching(/^Lead/)])
  })

  it('moves the tab stop to the selected node', async () => {
    renderGraph()

    await userEvent.click(graphNode(/^scout/))

    expect(tabbable()).toEqual([expect.stringMatching(/^scout/)])
  })

  it('stops on the graph region first, so the keyboard can scroll it', async () => {
    renderGraph()

    await userEvent.tab()

    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Agent graph' }))
  })

  it('lands on the lead after the graph region', async () => {
    renderGraph()

    await userEvent.tab()
    await userEvent.tab()

    expect(document.activeElement).toBe(graphNode(/^Lead/))
  })

  it('does not put the other nodes in the tab order', async () => {
    renderGraph()

    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()

    expect(graphNodes()).not.toContain(document.activeElement)
  })
})

describe('GraphCanvas keyboard hint', () => {
  const HINT =
    'Up and Down move between siblings, Left goes to the parent and Right to the first child. Home and End go to the first and last agent. Enter selects.'

  it('tells a person which keys reach the other nodes', () => {
    renderGraph()

    expect(screen.getByText(HINT)).toBeTruthy()
  })

  it('describes the graph region, so a screen reader meets it on entering', () => {
    renderGraph()

    expect(screen.getByRole('region', { name: 'Agent graph', description: HINT })).toBeTruthy()
  })
})

describe('GraphCanvas arrow keys', () => {
  const focused = (): string => document.activeElement?.getAttribute('aria-label') ?? ''

  it('goes to the first child with the right arrow and back to the parent with the left', async () => {
    renderGraph()
    graphNode(/^Lead/).focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(focused()).toMatch(/^scout/)

    await userEvent.keyboard('{ArrowLeft}')
    expect(focused()).toMatch(/^Lead/)
  })

  it('goes to the next sibling with the down arrow and the previous with the up arrow', async () => {
    renderGraph()
    graphNode(/^scout/).focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(focused()).toMatch(/^reader/)

    await userEvent.keyboard('{ArrowDown}{ArrowUp}')
    expect(focused()).toMatch(/^reader/)
  })

  it('goes to the lead with Home and to the last node with End', async () => {
    renderGraph()
    graphNode(/^reader/).focus()

    await userEvent.keyboard('{End}')
    expect(focused()).toMatch(/^tester/)

    await userEvent.keyboard('{Home}')
    expect(focused()).toMatch(/^Lead/)
  })

  it('stays put at the end of a branch', async () => {
    renderGraph()
    graphNode(/^Lead/).focus()

    await userEvent.keyboard('{ArrowLeft}{ArrowUp}{ArrowDown}')
    expect(focused()).toMatch(/^Lead/)

    graphNode(/^tester/).focus()
    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(focused()).toMatch(/^tester/)
  })

  it('moves focus without changing the selection', async () => {
    renderGraph()
    graphNode(/^Lead/).focus()

    await userEvent.keyboard('{ArrowRight}{ArrowDown}')

    expect(useNavigationStore.getState().selectedAgent).toBeNull()
    expect(graphNode(/^Lead/).getAttribute('aria-current')).toBe('true')
  })

  it('does not scroll the window, at the end of a branch either', () => {
    renderGraph()

    expect(fireEvent.keyDown(graphNode(/^scout/), { key: 'ArrowDown' })).toBe(false)
    expect(fireEvent.keyDown(graphNode(/^Lead/), { key: 'ArrowLeft' })).toBe(false)
  })

  it('leaves a key it does not handle to the browser', () => {
    renderGraph()

    expect(fireEvent.keyDown(graphNode(/^Lead/), { key: 'PageDown' })).toBe(true)
  })

  it.each([['altKey'], ['ctrlKey'], ['metaKey']])(
    'leaves an arrow pressed with %s to the browser, which uses it to go back',
    (modifier) => {
      renderGraph()
      graphNode(/^Lead/).focus()

      const notPrevented = fireEvent.keyDown(graphNode(/^Lead/), {
        key: 'ArrowRight',
        [modifier]: true
      })

      expect(notPrevented).toBe(true)
      expect(document.activeElement).toBe(graphNode(/^Lead/))
    }
  )
})

describe('GraphCanvas Enter and Space', () => {
  it.each([['{Enter}'], [' ']])('select the focused node with %j', async (key) => {
    renderGraph()
    graphNode(/^Lead/).focus()
    await userEvent.keyboard('{ArrowRight}')

    await userEvent.keyboard(key)

    expect(useNavigationStore.getState().selectedAgent).toEqual({
      kind: 'subagent',
      ownerRef: SCENE_SESSION,
      agentId: 'a1'
    })
    expect(screen.getByRole('button', { name: /^scout/ }).getAttribute('aria-current')).toBe('true')
  })
})
