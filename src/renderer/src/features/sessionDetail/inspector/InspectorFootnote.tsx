import { useTranslation } from 'react-i18next'
import { Footnote } from '@renderer/components/Footnote'
import { INSPECTOR_FOOTNOTE_ID } from './inspectorFootnoteId'
import type { InspectorReason } from './inspectorReasons'

/** The order the reasons are given in, whatever order they were found in. */
const REASON_ORDER = [
  'unreadableLines',
  'unpricedTokens',
  'incompleteFiles',
  'unrecordedTokens',
  'subagentsUnreadable',
  'subagentsNotLoaded',
  'belowIncomplete',
  'workflowAgentsIncomplete',
  'other'
] as const satisfies readonly InspectorReason[]

/** Props for {@link InspectorFootnote}. */
interface InspectorFootnoteProps {
  /** Why any figure in the inspector is partial. Nothing renders when it is empty. */
  readonly reasons: ReadonlySet<InspectorReason>
}

/**
 * The note at the foot of the inspector that explains each "¹": one sentence
 * for each reason a figure on screen may be low, in a fixed order.
 *
 * @example
 * <InspectorFootnote reasons={new Set(['incompleteFiles'])} />
 */
export function InspectorFootnote({ reasons }: InspectorFootnoteProps): React.JSX.Element | null {
  const { t } = useTranslation('sessionDetail')
  const sentences = REASON_ORDER.filter((reason) => reasons.has(reason)).map((reason) =>
    t(`inspector.footnote.${reason}`)
  )

  return (
    <Footnote
      id={INSPECTOR_FOOTNOTE_ID}
      label={t('inspector.footnote.label')}
      sentences={sentences}
    />
  )
}
