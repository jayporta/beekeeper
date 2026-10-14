import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import { MutedText } from '@renderer/components/MutedText'
import { tokenClasses } from '../tokens/tokenClasses'
import { TokenClassBar } from '../tokens/TokenClassBar'
import { TokenClassRows } from '../tokens/TokenClassRows'
import styles from './InspectorTokens.module.css'

/** Props for {@link InspectorTokens}. */
interface InspectorTokensProps {
  /** The agent's report, or the run's, which adds its agents'. */
  readonly report: AgentReportDto
  /** The report's tokens, for the heading. */
  readonly tokens: number
  /** The model the agent ran on, or what the figures cover for a run, shown muted beside the heading. `null` leaves it out. Transcript-derived. */
  readonly model: string | null
}

/**
 * The agent's tokens by class: a small segmented bar, a heading with the total
 * and the model, then input, output, cache read, and cache write (both windows)
 * each with its count as text. The bar is decoration, hidden from assistive
 * technology.
 *
 * @example
 * <InspectorTokens report={report} tokens={3100000} model="claude-opus-5" />
 */
export function InspectorTokens({
  report,
  tokens,
  model
}: InspectorTokensProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const classes = useMemo(() => tokenClasses([report]), [report])
  const heading = t('inspector.tokensHeading', {
    total: tSessions('figure.compact', { value: tokens })
  })

  return (
    <section className={styles.tokens}>
      <TokenClassBar classes={classes} size="small" />
      <div className={styles.heading}>
        <h3 className={styles.title}>{heading}</h3>
        {model !== null && (
          <MutedText as="span" wrapAnywhere>
            <bdi>{model}</bdi>
          </MutedText>
        )}
      </div>
      <TokenClassRows classes={classes} />
    </section>
  )
}
