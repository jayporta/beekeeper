import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { graphNode } from './testGraphScene'

/** The box the graph is scaled in: the node's parent. */
export const surface = (): HTMLElement => graphNode(/^Lead/).parentElement as HTMLElement

/** The box sized to the scaled graph and the room around it: the surface's parent. */
export const sizer = (): HTMLElement => surface().parentElement as HTMLElement

/** The element that scrolls and pans: the sizer's parent. */
export const viewport = (): HTMLElement => sizer().parentElement as HTMLElement

/** The scale the surface is drawn at. */
export const scale = (): number => Number(/scale\(([\d.]+)\)/.exec(surface().style.transform)?.[1])

/** Presses the button with the given accessible name. */
export const press = async (name: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name }))
}

/** A width and a height to give the view, in pixels. */
interface ViewBox {
  /** The view's width. */
  readonly width: number
  /** The view's height. */
  readonly height: number
}

/**
 * Gives every element the size of a view with no scrollbars and no borders,
 * since jsdom lays nothing out. Call it again to resize.
 *
 * @param box - The border box and the client box, which are the same size.
 */
export function sizeView({ width, height }: ViewBox): void {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
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
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
    element === view
      ? ({ scrollPaddingBottom: `${pixels}px` } as CSSStyleDeclaration)
      : realComputedStyle(element, pseudo)
  )
}
