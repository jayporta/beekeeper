import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphViewport } from '../GraphViewport'

const PAGE = 400

/** The element that scrolls: the node's grandparent inside the graph's sized box. */
const viewport = (): HTMLElement =>
  screen.getByRole('button', { name: 'node' }).parentElement?.parentElement
    ?.parentElement as HTMLElement
const main = (): HTMLElement => screen.getByRole('main')

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(PAGE)
  render(
    <main tabIndex={-1} aria-label="Main">
      <GraphViewport width={800} height={2000}>
        <button type="button">node</button>
      </GraphViewport>
    </main>
  )
  Object.defineProperty(viewport(), 'scrollHeight', { configurable: true, value: 2000 })
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(document.documentElement, 'scrollHeight')
})

const press = (target: Element, key: string, init: KeyboardEventInit = {}): boolean =>
  fireEvent.keyDown(target, { key, ...init })

describe('scroll keys with focus on main', () => {
  it.each([
    ['PageDown', {}, 350],
    [' ', {}, 350],
    ['PageUp', {}, -350],
    [' ', { shiftKey: true }, -350],
    ['ArrowDown', {}, 40],
    ['ArrowUp', {}, -40]
  ])('scrolls the graph for %j %j', (key, init, delta) => {
    viewport().scrollTop = 1000

    press(main(), key, init)

    expect(viewport().scrollTop).toBe(1000 + delta)
  })

  it('scrolls the graph to its top with Home and to its bottom with End', () => {
    viewport().scrollTop = 1000

    press(main(), 'Home')
    expect(viewport().scrollTop).toBe(0)

    press(main(), 'End')
    expect(viewport().scrollTop).toBe(2000)
  })

  it('claims a key it handles, so the browser does not also act on it', () => {
    expect(press(main(), 'PageDown')).toBe(false)
  })

  it('leaves other keys alone', () => {
    expect(press(main(), 'a')).toBe(true)
    expect(viewport().scrollTop).toBe(0)
  })

  it.each([['ctrlKey'], ['metaKey'], ['altKey']])('leaves a key pressed with %s alone', (mod) => {
    expect(press(main(), 'PageDown', { [mod]: true })).toBe(true)
    expect(viewport().scrollTop).toBe(0)
  })

  it('leaves a key pressed on a node inside main to the node', () => {
    const node = screen.getByRole('button', { name: 'node' })

    expect(press(node, 'PageDown')).toBe(true)
    expect(viewport().scrollTop).toBe(0)
  })

  it('leaves the key to the page while the page itself can scroll', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: PAGE * 3
    })

    expect(press(main(), 'PageDown')).toBe(true)
    expect(viewport().scrollTop).toBe(0)
  })
})

describe('scroll keys once the graph is gone', () => {
  it('stop listening', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const rendered = render(
      <GraphViewport width={1} height={1}>
        <span />
      </GraphViewport>
    )

    rendered.unmount()

    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
