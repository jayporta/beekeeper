import { useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { GRAPH_NOTES_ID } from './graphFootnoteId'
import styles from './GraphViewport.module.css'
import { GraphZoomControls } from './GraphZoomControls'
import { useGraphPan } from './useGraphPan'
import { useGraphSlack } from './useGraphSlack'
import { useGraphZoom } from './useGraphZoom'

/** Props for {@link GraphViewport}. */
interface GraphViewportProps {
  /** The graph's width at scale 1, in pixels. */
  readonly width: number
  /** The graph's height at scale 1, in pixels. */
  readonly height: number
  /** The graph's edges and nodes, placed in a `width` by `height` box. */
  readonly children: React.ReactNode
}

/**
 * The window onto the graph: it scrolls, pans freely in every direction by
 * dragging its background, by the wheel and by trackpad (until the graph's edge
 * reaches the middle of the view), zooms with the controls at its bottom right and
 * with Ctrl or Cmd and the wheel, and fits the whole graph to its size on
 * request. The graph is scaled with a CSS transform, and its box is sized to
 * match with empty room on every side, so scrollbars follow the zoom and the
 * graph can be panned past its edges. It is the graph's labelled region and a
 * tab stop ahead of the nodes, so the keyboard can scroll it without moving
 * among them.
 *
 * @example
 * <GraphViewport width={476} height={346}>{nodes}</GraphViewport>
 */
export function GraphViewport({ width, height, children }: GraphViewportProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const viewportRef = useRef<HTMLDivElement>(null)
  const slack = useGraphSlack(viewportRef)
  const { scale, zoomOut, zoomIn, fit } = useGraphZoom(viewportRef, {
    content: { width, height },
    slack
  })
  const pan = useGraphPan(viewportRef)
  // React types no custom properties, so the full-size height the view's styles read takes an assertion.
  const viewportStyle = { '--graph-height': `${height}px` } as CSSProperties
  // React types no custom properties, so the scale the graph's styles read takes an assertion.
  const surfaceStyle = {
    width,
    height,
    left: slack.width,
    top: slack.height,
    transform: `scale(${scale})`,
    '--graph-scale': scale
  } as CSSProperties

  return (
    <div className={styles.stage}>
      <div
        ref={viewportRef}
        role="region"
        aria-label={t('graph.label')}
        aria-describedby={GRAPH_NOTES_ID}
        tabIndex={0}
        className={styles.viewport}
        style={viewportStyle}
        {...pan}
      >
        <div
          className={styles.sizer}
          style={{
            width: width * scale + 2 * slack.width,
            height: height * scale + 2 * slack.height
          }}
        >
          <div className={styles.surface} style={surfaceStyle}>
            {children}
          </div>
        </div>
      </div>
      <GraphZoomControls onZoomOut={zoomOut} onFit={fit} onZoomIn={zoomIn} />
    </div>
  )
}
