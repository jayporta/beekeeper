import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SidebarResizer.module.css'
import { SIDEBAR_ID } from './sidebarId'
import { DEFAULT_SIDEBAR_WIDTH, SIDEBAR_STEP, SIDEBAR_STEP_LARGE } from './sidebarWidth'

/** Pointer travel in px under which a press counts as a click, not a drag. */
const CLICK_TRAVEL = 4

/** The props of {@link SidebarResizer}. */
interface SidebarResizerProps {
  /** The sidebar's current width in px. */
  width: number
  /** The narrowest width in px. */
  min: number
  /** The widest width in px. */
  max: number
  /** Called with a width in px while the pointer drags. */
  onPreview: (px: number) => void
  /** Called with the width in px to save. */
  onCommit: (px: number) => void
}

/** Where a drag began and how far it has gone. */
interface Drag {
  readonly startX: number
  readonly startWidth: number
  travel: number
  width: number
}

/**
 * The sidebar's resize handle, a window splitter (ARIA) on the sidebar's right
 * edge. Arrow keys step the width (Shift for a larger step), Home and End jump
 * to the ends, and Enter restores the default. A drag follows the pointer, and
 * a click without a drag toggles between the default and the widest.
 *
 * @example
 * <SidebarResizer width={260} min={200} max={560} onPreview={preview} onCommit={commit} />
 */
export function SidebarResizer({
  width,
  min,
  max,
  onPreview,
  onCommit
}: SidebarResizerProps): React.JSX.Element {
  const { t } = useTranslation()
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  function end(): void {
    const current = drag.current
    if (current === null) return
    drag.current = null
    setDragging(false)
    if (current.travel < CLICK_TRAVEL) {
      onCommit(width >= max ? DEFAULT_SIDEBAR_WIDTH : max)
    } else {
      onCommit(current.width)
    }
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    const step = event.shiftKey ? SIDEBAR_STEP_LARGE : SIDEBAR_STEP
    const next = {
      ArrowLeft: width - step,
      ArrowRight: width + step,
      Home: min,
      End: max,
      Enter: DEFAULT_SIDEBAR_WIDTH
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onCommit(next)
  }

  function onPointerDown(event: React.PointerEvent<HTMLHRElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startX: event.clientX, startWidth: width, travel: 0, width }
    setDragging(true)
  }

  function onPointerMove(event: React.PointerEvent): void {
    const current = drag.current
    if (current === null) return
    const delta = event.clientX - current.startX
    current.travel = Math.max(current.travel, Math.abs(delta))
    current.width = current.startWidth + delta
    onPreview(current.width)
  }

  return (
    // An hr is a separator, and a focusable separator is the ARIA window-splitter pattern, so the interaction rules allow it.
    <hr
      aria-orientation="vertical"
      aria-label={t('resizeSidebar')}
      aria-controls={SIDEBAR_ID}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={t('sidebarWidth', { px: width })}
      tabIndex={0}
      className={styles.separator}
      data-dragging={dragging || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  )
}
