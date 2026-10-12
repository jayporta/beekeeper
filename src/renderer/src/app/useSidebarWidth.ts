import { useState } from 'react'
import { useSidebarWidthStore } from '@renderer/app/state/useSidebarWidthStore'
import { MIN_SIDEBAR_WIDTH, clampSidebarWidth, sidebarMaxWidth } from './sidebarWidth'
import { useViewportWidth } from './useViewportWidth'

/** The sidebar's width and the ways to change it. */
interface SidebarWidth {
  /** The width to draw in px: the live drag width while dragging, else the stored width, limited by the window. */
  readonly width: number
  /** The narrowest width in px. */
  readonly min: number
  /** The widest width in px for the current window. */
  readonly max: number
  /** Shows a width while the person drags, without saving it. */
  preview: (px: number) => void
  /** Saves a width and ends any preview. */
  commit: (px: number) => void
  /** Drops any preview and keeps the saved width. */
  cancel: () => void
}

/**
 * The sidebar's width for the current window. The stored width is the one the
 * person chose, limited only to the absolute range. It is limited to the window
 * during render, so a window that shrinks narrows the sidebar without touching
 * what was saved.
 *
 * @returns The width, its range, and how to preview, save, or cancel a new width.
 */
export function useSidebarWidth(): SidebarWidth {
  const viewportWidth = useViewportWidth()
  const stored = useSidebarWidthStore((state) => state.width)
  const setStored = useSidebarWidthStore((state) => state.setWidth)
  const [live, setLive] = useState<number | null>(null)

  return {
    width: clampSidebarWidth(live ?? stored, viewportWidth),
    min: MIN_SIDEBAR_WIDTH,
    max: sidebarMaxWidth(viewportWidth),
    preview: (px) => {
      setLive(px)
    },
    cancel: () => {
      setLive(null)
    },
    commit: (px) => {
      setStored(clampSidebarWidth(px, Number.POSITIVE_INFINITY))
      setLive(null)
    }
  }
}
