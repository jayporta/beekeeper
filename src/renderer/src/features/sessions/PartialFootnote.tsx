import { useTranslation } from 'react-i18next'
import { Footnote } from '@renderer/components/Footnote'
import { PARTIAL_FOOTNOTE_ID } from './partialFootnoteId'
import type { PartialReason } from './partialReasons'

/** The order the reasons are given in, whatever order they were found in. */
const REASON_ORDER = [
  'unreadableLines',
  'missingTeammates',
  'unrecordedUsage',
  'subagentsExcluded'
] as const satisfies readonly PartialReason[]

/** Props for {@link PartialFootnote}. */
interface PartialFootnoteProps {
  /** Why any figure on screen is partial. Nothing renders when it is empty. */
  readonly reasons: ReadonlySet<PartialReason>
  /**
   * Sentences to use in place of a reason's own, for a view whose wording
   * differs from the list's, such as one with no list to point at.
   * @defaultValue The list's sentence for every reason.
   */
  readonly overrides?: Partial<Record<PartialReason, string>>
}

/**
 * The note under the session list that explains the "¹" on partial figures:
 * one sentence for each distinct reason a card on screen is partial, in a
 * fixed order. Each partial figure points at it by id.
 *
 * @example
 * <PartialFootnote reasons={new Set(['unreadableLines'])} />
 */
export function PartialFootnote({
  reasons,
  overrides
}: PartialFootnoteProps): React.JSX.Element | null {
  const { t } = useTranslation('sessions')
  const sentences = REASON_ORDER.filter((reason) => reasons.has(reason)).map(
    (reason) => overrides?.[reason] ?? t(`footnote.${reason}`)
  )

  return <Footnote id={PARTIAL_FOOTNOTE_ID} label={t('footnote.label')} sentences={sentences} />
}
