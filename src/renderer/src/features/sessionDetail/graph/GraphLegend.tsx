import { useTranslation } from 'react-i18next'
import styles from './GraphLegend.module.css'

/**
 * The key to the marks drawn on the graph's nodes: tool errors, compactions,
 * and a stopped agent. It is hidden from assistive technology, since each
 * node's accessible name says its marks in words.
 *
 * @example
 * <GraphLegend />
 */
export function GraphLegend(): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <p aria-hidden="true" className={styles.legend}>
      <span>{t('graph.footnote.legend.toolErrors')}</span>
      <span>{t('graph.footnote.legend.compactions')}</span>
      <span>{t('graph.footnote.legend.stopped')}</span>
    </p>
  )
}
