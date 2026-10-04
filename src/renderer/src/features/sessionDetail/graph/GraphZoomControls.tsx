import { useTranslation } from 'react-i18next'
import styles from './GraphZoomControls.module.css'

/** Props for {@link GraphZoomControls}. */
interface GraphZoomControlsProps {
  /** Shrinks the graph by one step. */
  readonly onZoomOut: () => void
  /** Scales the whole graph to fit the view. */
  readonly onFit: () => void
  /** Magnifies the graph by one step. */
  readonly onZoomIn: () => void
}

/**
 * The graph's zoom controls, in a group at the bottom right of the canvas:
 * zoom out, fit, and zoom in. Each is at least 44px square.
 *
 * @example
 * <GraphZoomControls onZoomOut={zoomOut} onFit={fit} onZoomIn={zoomIn} />
 */
export function GraphZoomControls({
  onZoomOut,
  onFit,
  onZoomIn
}: GraphZoomControlsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <div role="group" aria-label={t('graph.zoom.label')} className={styles.controls}>
      <button type="button" aria-label={t('graph.zoom.outLabel')} onClick={onZoomOut}>
        {t('graph.zoom.out')}
      </button>
      <button type="button" aria-label={t('graph.zoom.fitLabel')} onClick={onFit}>
        {t('graph.zoom.fit')}
      </button>
      <button type="button" aria-label={t('graph.zoom.inLabel')} onClick={onZoomIn}>
        {t('graph.zoom.in')}
      </button>
    </div>
  )
}
