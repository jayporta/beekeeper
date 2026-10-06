import { useEffect, type RefObject } from 'react'

/** How much of a page a page key scrolls, leaving the rest as overlap for the eye. */
const PAGE_FRACTION = 0.875
/** How far an arrow key scrolls, in pixels. */
const LINE_PX = 40

/** Where a key takes a scroller, given its current offset and sizes. `null` for a key that scrolls nothing. */
function scrollTopAfter(event: KeyboardEvent, viewport: HTMLElement): number | null {
  const page = viewport.clientHeight * PAGE_FRACTION
  switch (event.key) {
    case 'PageDown':
      return viewport.scrollTop + page
    case 'PageUp':
      return viewport.scrollTop - page
    case ' ':
      return viewport.scrollTop + (event.shiftKey ? -page : page)
    case 'ArrowDown':
      return viewport.scrollTop + LINE_PX
    case 'ArrowUp':
      return viewport.scrollTop - LINE_PX
    case 'Home':
      return 0
    case 'End':
      return viewport.scrollHeight
    default:
      return null
  }
}

/**
 * Lets the scroll keys scroll the graph while focus is on the page's main
 * landmark. Navigating moves focus to main, which in a layout where the panes
 * scroll on their own is an ancestor of neither, so the browser would scroll
 * nothing. Page Up and Down, Space with or without Shift, the arrow keys, Home
 * and End scroll the graph instead. A key pressed on anything else, with Ctrl,
 * Meta or Alt, or while the page itself can scroll, is left alone.
 *
 * @param viewportRef - The graph's scrolling element.
 */
export function useScrollKeysFromMain(viewportRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.target instanceof Element) || !event.target.matches('main')) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const page = document.scrollingElement ?? document.documentElement
      if (page.scrollHeight > page.clientHeight) return
      const viewport = viewportRef.current
      if (viewport === null) return
      const top = scrollTopAfter(event, viewport)
      if (top === null) return
      event.preventDefault()
      viewport.scrollTop = top
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [viewportRef])
}
