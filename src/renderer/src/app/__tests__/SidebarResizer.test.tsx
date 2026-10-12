import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetPersistedState } from '@renderer/testRenderApp'
import { SidebarResizer } from '../SidebarResizer'
import { DEFAULT_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '../sidebarWidth'
import { useSidebarWidth } from '../useSidebarWidth'

/** The resizer wired to the real width hook, as the shell wires it. */
function Harness(): React.JSX.Element {
  const sidebar = useSidebarWidth()
  return (
    <SidebarResizer
      width={sidebar.width}
      min={sidebar.min}
      max={sidebar.max}
      onPreview={sidebar.preview}
      onCommit={sidebar.commit}
    />
  )
}

/** Sets the window width and tells listeners. */
function setViewport(width: number): void {
  window.innerWidth = width
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

const separator = (): HTMLElement => screen.getByRole('separator', { name: 'Resize sidebar' })
const widthNow = (): number => Number(separator().getAttribute('aria-valuenow'))

const originalWidth = window.innerWidth

beforeEach(() => {
  window.innerWidth = 1600
  Element.prototype.setPointerCapture = () => undefined
})

afterEach(async () => {
  window.innerWidth = originalWidth
  await resetPersistedState()
})

describe('SidebarResizer', () => {
  it('exposes the width and its range to assistive technology', () => {
    render(<Harness />)

    expect(separator().getAttribute('aria-orientation')).toBe('vertical')
    expect(separator().getAttribute('aria-valuenow')).toBe(String(DEFAULT_SIDEBAR_WIDTH))
    expect(separator().getAttribute('aria-valuemin')).toBe(String(MIN_SIDEBAR_WIDTH))
    expect(separator().getAttribute('aria-valuemax')).toBe(String(MAX_SIDEBAR_WIDTH))
    expect(separator().getAttribute('aria-valuetext')).toBe(`${DEFAULT_SIDEBAR_WIDTH} pixels`)
    expect(separator().getAttribute('aria-controls')).toBe('sidebar')
  })

  it('widens by 16px on ArrowRight and narrows by 16px on ArrowLeft', async () => {
    render(<Harness />)
    separator().focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH + 16)
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH - 16)
  })

  it('steps by 64px with Shift', async () => {
    render(<Harness />)
    separator().focus()

    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')

    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH + 64)
  })

  it('stops at the minimum and the maximum', async () => {
    render(<Harness />)
    separator().focus()

    await userEvent.keyboard('{Home}{ArrowLeft}')
    expect(widthNow()).toBe(MIN_SIDEBAR_WIDTH)
    await userEvent.keyboard('{End}{ArrowRight}')
    expect(widthNow()).toBe(MAX_SIDEBAR_WIDTH)
  })

  it('restores the default width on Enter', async () => {
    render(<Harness />)
    separator().focus()

    await userEvent.keyboard('{End}{Enter}')

    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it('follows a drag and keeps the width where it ends', () => {
    render(<Harness />)

    fireEvent.pointerDown(separator(), { clientX: 300, pointerId: 1 })
    fireEvent.pointerMove(separator(), { clientX: 380, pointerId: 1 })
    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH + 80)
    fireEvent.pointerUp(separator(), { clientX: 380, pointerId: 1 })

    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH + 80)
  })

  it('clamps a drag past the maximum', () => {
    render(<Harness />)

    fireEvent.pointerDown(separator(), { clientX: 300, pointerId: 1 })
    fireEvent.pointerMove(separator(), { clientX: 3000, pointerId: 1 })
    fireEvent.pointerUp(separator(), { clientX: 3000, pointerId: 1 })

    expect(widthNow()).toBe(MAX_SIDEBAR_WIDTH)
  })

  it('toggles between the default and the maximum on a click without a drag', () => {
    render(<Harness />)

    fireEvent.pointerDown(separator(), { clientX: 300, pointerId: 1 })
    fireEvent.pointerUp(separator(), { clientX: 300, pointerId: 1 })
    expect(widthNow()).toBe(MAX_SIDEBAR_WIDTH)

    fireEvent.pointerDown(separator(), { clientX: 300, pointerId: 1 })
    fireEvent.pointerUp(separator(), { clientX: 300, pointerId: 1 })
    expect(widthNow()).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it('narrows the effective width when the window shrinks', async () => {
    render(<Harness />)
    separator().focus()
    await userEvent.keyboard('{End}')

    setViewport(1000)

    expect(widthNow()).toBe(360)
    expect(separator().getAttribute('aria-valuemax')).toBe('360')
  })
})
