import { useTranslation } from 'react-i18next'
import { Footnote } from '@renderer/components/Footnote'
import { OVERVIEW_FOOTNOTE_ID } from './overviewFootnoteId'
import type { PartialReason } from '../../../../shared/overview/partialReasons'

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
  const { t: tCommon } = useTranslation('common')
  if (reasons.length === 0) return null

  const sentences = [
    ...reasons.map((reason) =>
      reason === 'loading' || reason === 'failed'
        ? t(`footnote.${reason}`)
        : tCommon(`partialReason.${reason}`)
    ),
    tCommon('partialReason.mayBeLow')
  ]

  return <Footnote id={OVERVIEW_FOOTNOTE_ID} label={t('footnote.label')} sentences={sentences} />
}
