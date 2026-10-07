import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testNode } from '../../testSessionDetail'
import { SCENE_SESSION, graphNode, renderGraph, renderGraphWith } from '../testGraphScene'

afterEach(() => {
  vi.useRealTimers()
  useNavigationStore.getState().reset()
})

const status = (): HTMLElement => screen.getByRole('status')

describe('GraphCanvas selection announcement', () => {
  it('says nothing before anything is selected', () => {
    renderGraph()

    expect(status().textContent).toBe('')
  })

  it('names the node a press selected', async () => {
    renderGraph()

    await userEvent.click(graphNode(/^scout/))

    await waitFor(() => {
      expect(status().textContent).toBe('scout selected')
    })
  })

  it('names a run with its id when another run shares its name', async () => {
    const detail = testDetail({
      children: [
        testNode('w1', { workflowRunId: 'wf_a' }),
        testNode('w2', { workflowRunId: 'wf_b' })
      ],
      workflowRuns: [
        { runId: 'wf_a', record: { name: 'scan', completed: true, phases: [] } },
        { runId: 'wf_b', record: { name: 'scan', completed: true, phases: [] } }
      ]
    })
    renderGraphWith({ detail, row: null })

    await userEvent.click(graphNode(/^scan, workflow of .*wf_b/))

    await waitFor(() => {
      expect(status().textContent).toBe('scan (wf_b) selected')
    })
  })

  it('names the node Enter selected', async () => {
    renderGraph()
    graphNode(/^Lead/).focus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')

    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(status().textContent).toBe('reader selected')
    })
  })

  it('says nothing when the arrow keys only move focus', async () => {
    renderGraph()
    graphNode(/^Lead/).focus()

    await userEvent.keyboard('{ArrowRight}{ArrowDown}{End}')

    expect(status().textContent).toBe('')
  })

  it('says nothing when the selected node is pressed again', async () => {
    renderGraph()

    await userEvent.click(graphNode(/^Lead/))

    expect(status().textContent).toBe('')
  })

  it('says nothing for a node that was already selected when the graph showed', () => {
    useNavigationStore.getState().showSession(SCENE_SESSION, { kind: 'teammate', ref: testRef(2) })

    renderGraph()

    expect(status().textContent).toBe('')
  })

  it('names the node again when it is selected a second time after another', async () => {
    renderGraph()
    await userEvent.click(graphNode(/^scout/))
    await userEvent.click(graphNode(/^reader/))
    await userEvent.click(graphNode(/^scout/))

    await waitFor(() => {
      expect(status().textContent).toBe('scout selected')
    })
  })

  it('empties once it has been read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderGraph()
    await userEvent.click(graphNode(/^scout/))
    await waitFor(() => {
      expect(status().textContent).toBe('scout selected')
    })

    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS)
    })

    expect(status().textContent).toBe('')
  })

  it('shares the graph’s one status region with the expansion announcements', () => {
    const { container } = renderGraph()

    expect(within(container).getAllByRole('status')).toHaveLength(1)
  })
})
