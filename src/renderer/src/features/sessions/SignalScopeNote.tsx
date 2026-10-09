import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import type { SessionRow } from './sessionRow'
import { hasSignalCounts, signalTotalsOf } from './signalNotes'

/** Props for {@link SignalScopeNote}. */
interface SignalScopeNoteProps {
  /** The rows on screen. Nothing renders unless one has a nonzero signal count. */
  readonly rows: readonly SessionRow[]
}

/**
 * The note under the session list that says what the cards' signal counts
 * cover: the lead and its teammates, not their subagents.
 *
 * @example
 * <SignalScopeNote rows={rows} />
 */
export function SignalScopeNote({ rows }: SignalScopeNoteProps): React.JSX.Element | null {
  const { t } = useTranslation('sessions')
  const counted = rows.some(({ item }) => hasSignalCounts(signalTotalsOf(item)))
  if (!counted) return null

  return <MutedText smaller>{t('signalScope')}</MutedText>
}
