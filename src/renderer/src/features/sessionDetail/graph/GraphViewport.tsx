import { useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { GRAPH_HINT_ID } from './graphFootnoteId'
import styles from './GraphViewport.module.css'
import { GraphZoomControls } from './GraphZoomControls'
import { useGraphPan } from './useGraphPan'
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
 * The window onto the graph: it scrolls, pans by dragging its background,
 * zooms with the controls at its bottom right and with Ctrl or Cmd and the
 * wheel, and fits the whole graph to its size on request. The graph is scaled
 * with a CSS transform, and its box is sized to match, so scrollbars follow
 * the zoom. It is the graph's labelled region and a tab stop ahead of the
 * nodes, so the keyboard can scroll it without moving among them.
 *
 * @example
 * <GraphViewport width={476} height={346}>{nodes}</GraphViewport>
 */
export function GraphViewport({ width, height, children }: GraphViewportProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const viewportRef = useRef<HTMLDivElement>(null)
  const { scale, zoomOut, zoomIn, fit } = useGraphZoom(viewportRef, { width, height })
  const pan = useGraphPan(viewportRef)
  // React types no custom properties, so the scale the graph's styles read takes an assertion.
  const surfaceStyle = {
    width,
    height,
    transform: `scale(${scale})`,
    '--graph-scale': scale
  } as CSSProperties

  return (
    <div className={styles.stage}>
      <div
        ref={viewportRef}
        role="region"
        aria-label={t('graph.label')}
        aria-describedby={GRAPH_HINT_ID}
        tabIndex={0}
        className={styles.viewport}
        {...pan}
      >
        <div className={styles.sizer} style={{ width: width * scale, height: height * scale }}>
          <div className={styles.surface} style={surfaceStyle}>
            {children}
          </div>
        </div>
      </div>
      <GraphZoomControls onZoomOut={zoomOut} onFit={fit} onZoomIn={zoomIn} />
    </div>
  )
}
