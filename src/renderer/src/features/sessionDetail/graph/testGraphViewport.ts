import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

/** The element that scrolls and pans: the graph's labelled region. */
export const viewport = (): HTMLElement => screen.getByRole('region', { name: 'Agent graph' })

/** The box sized to the scaled graph and the room around it: the viewport's only child. */
export const sizer = (): HTMLElement => viewport().firstElementChild as HTMLElement

/** The box the graph is scaled in: the sizer's only child. */
export const surface = (): HTMLElement => sizer().firstElementChild as HTMLElement

/** The scale the surface is drawn at. */
export const scale = (): number => Number(/scale\(([\d.]+)\)/.exec(surface().style.transform)?.[1])

/** Presses the button with the given accessible name. */
export const press = async (name: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name }))
}

/** A width and a height to give the view, in pixels. */
export interface ViewBox {
  /** The view's width. */
  readonly width: number
  /** The view's height. */
  readonly height: number
}

/** Holds the view's offsets within its content, as the browser does when it lays the view out. */
let layOut: () => void = () => undefined

/**
 * Gives every element the client size of a view, since jsdom lays nothing
 * out, as if the view's scrollbars took no room. Call it again to resize. If
 * the scroll clamping is modeled, the new size clamps the offsets against the
 * content as it is, as the browser does before any observer reports, and a
 * clamp fires `scroll`.
 *
 * @param box - The client box.
 */
export function sizeView({ width, height }: ViewBox): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
  layOut()
}

/**
 * Makes the rendered view's scroll offsets behave as the browser's do: they
 * read back held within `0` and the sizer's size less the view's client size,
 * taken from the sizer's inline style and the client size {@link sizeView}
 * gives, and a resize by {@link sizeView} holds them at once. Setting an offset
 * or holding one by a resize fires `scroll`. Call it after rendering and
 * sizing, and before the first resize.
 */
export function modelScrollClamp(): void {
  const view = viewport()
  const content = sizer()
  const offsets = { left: 0, top: 0 }
  const reach = (key: 'left' | 'top'): number =>
    Math.max(
      0,
      key === 'left'
        ? Number.parseFloat(content.style.width) - view.clientWidth
        : Number.parseFloat(content.style.height) - view.clientHeight
    )
  const held = (key: 'left' | 'top'): number => Math.min(Math.max(0, offsets[key]), reach(key))
  const axis = (key: 'left' | 'top'): PropertyDescriptor => ({
    configurable: true,
    get: () => {
      offsets[key] = held(key)
      return offsets[key]
    },
    set: (value: number) => {
      offsets[key] = value
      view.dispatchEvent(new Event('scroll'))
    }
  })
  Object.defineProperties(view, { scrollLeft: axis('left'), scrollTop: axis('top') })
  layOut = () => {
    const clamped = held('left') !== offsets.left || held('top') !== offsets.top
    offsets.left = held('left')
    offsets.top = held('top')
    if (clamped) view.dispatchEvent(new Event('scroll'))
  }
}

const realComputedStyle = window.getComputedStyle.bind(window)

/**
 * Gives the rendered view a bottom scroll padding, the room the zoom controls
 * cover, since jsdom doesn't apply the stylesheet. Call it after rendering.
 *
 * @param pixels - The scroll padding below the view's content.
 */
export function stubControlsClearance(pixels: number): void {
  const view = viewport()
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = realComputedStyle(element, pseudo)
    if (element !== view) return style
    return new Proxy(style, {
      get: (target, property) => {
        if (property === 'scrollPaddingBottom') return `${pixels}px`
        const value: unknown = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
  })
}
