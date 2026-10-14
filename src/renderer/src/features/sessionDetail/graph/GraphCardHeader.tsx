import { useTranslation } from 'react-i18next'
import styles from './GraphCardHeader.module.css'
import { GraphLegend } from './GraphLegend'

/** Props for {@link GraphCardHeader}. */
interface GraphCardHeaderProps {
  /** The zoom controls, shown on the right after the legend. */
  readonly controls: React.ReactNode
}

/**
 * The graph card's header row: the card's title, then, on the right, the
 * legend for the marks on the nodes and the zoom controls. It wraps when the
 * card is narrow.
 *
 * @example
 * <GraphCardHeader controls={<GraphZoomControls onZoomOut={out} onFit={fit} onZoomIn={zoomIn} />} />
 */
export function GraphCardHeader({ controls }: GraphCardHeaderProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <div className={styles.header}>
      <h2 className={styles.title}>{t('graph.label')}</h2>
      <div className={styles.tools}>
        <GraphLegend />
        {controls}
      </div>
    </div>
  )
}
