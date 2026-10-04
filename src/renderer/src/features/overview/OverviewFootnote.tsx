import { useTranslation } from 'react-i18next'
import styles from './OverviewFootnote.module.css'
import type { PartialReason } from './partialReasons'

/** Props for {@link OverviewFootnote}. */
interface OverviewFootnoteProps {
  /** Why a figure on screen is partial. Nothing renders when it is empty. */
  readonly reasons: readonly PartialReason[]
}

/**
 * The note under the overview that explains the "¹" on partial figures: one
 * sentence for each reason, then that a total may be low.
 *
 * @example
 * <OverviewFootnote reasons={['unreadable']} />
 */
export function OverviewFootnote({ reasons }: OverviewFootnoteProps): React.JSX.Element | null {
  const { t } = useTranslation('overview')
  if (reasons.length === 0) return null

  return (
    <p className={styles.footnote}>
      {t('footnote.label')} {reasons.map((reason) => t(`footnote.${reason}`)).join(' ')}{' '}
      {t('footnote.mayBeLow')}
    </p>
  )
}
