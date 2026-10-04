import { useTranslation } from 'react-i18next'
import styles from './PartialFootnote.module.css'
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
}

/**
 * The note under the session list that explains the "¹" on partial figures:
 * one sentence for each distinct reason a card on screen is partial, in a
 * fixed order. Each partial figure points at it by id.
 *
 * @example
 * <PartialFootnote reasons={new Set(['unreadableLines'])} />
 */
export function PartialFootnote({ reasons }: PartialFootnoteProps): React.JSX.Element | null {
  const { t } = useTranslation('sessions')
  const shown = REASON_ORDER.filter((reason) => reasons.has(reason))
  if (shown.length === 0) return null

  return (
    <p id={PARTIAL_FOOTNOTE_ID} className={styles.footnote}>
      {t('footnote.label')} {shown.map((reason) => t(`footnote.${reason}`)).join(' ')}
    </p>
  )
}
