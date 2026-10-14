import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TitleBar } from '../TitleBar'

afterEach(() => {
  Reflect.deleteProperty(navigator, 'windowControlsOverlay')
})

describe('TitleBar', () => {
  it('holds its children', () => {
    render(
      <TitleBar>
        <button type="button">Inside</button>
      </TitleBar>
    )

    expect(screen.getByRole('button', { name: 'Inside' })).toBeTruthy()
  })

  it('is a drag region only where the window controls overlay is visible', () => {
    const { container, unmount } = render(<TitleBar />)
    expect((container.firstElementChild as HTMLElement).dataset['overlay']).toBe('false')
    unmount()

    Object.defineProperty(navigator, 'windowControlsOverlay', {
      value: Object.assign(new EventTarget(), { visible: true }),
      configurable: true
    })
    const overlaid = render(<TitleBar />)

    expect((overlaid.container.firstElementChild as HTMLElement).dataset['overlay']).toBe('true')
  })
})
