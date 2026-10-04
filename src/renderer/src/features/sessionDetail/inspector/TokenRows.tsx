import { useTranslation } from 'react-i18next'
import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import { formatTokens } from '@renderer/features/sessions/formatTokens'
import styles from './TokenRows.module.css'
import { tokenBreakdown } from './tokenBreakdown'

/** Props for {@link TokenRows}. */
interface TokenRowsProps {
  /** The agent's report. */
  readonly report: AgentReportDto
  /** The agent's own tokens, for the heading. */
  readonly tokens: number
}

/**
 * The agent's tokens by class: input, output, cache read, and cache write
 * (both windows), each with its count as text and a bar sized against the
 * largest class. The bars are decoration, hidden from assistive technology.
 *
 * @example
 * <TokenRows report={report} tokens={3100000} />
 */
export function TokenRows({ report, tokens }: TokenRowsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        {t('inspector.tokensHeading', { total: formatTokens(tokens, tSessions) })}
      </h3>
      <ul className={styles.rows}>
        {tokenBreakdown(report).map((row) => (
          <li key={row.tokenClass} className={styles.row}>
            <span>{t(`inspector.tokenClass.${row.tokenClass}`)}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${row.fraction * 100}%` }} />
            </span>
            <span className={styles.value}>{t('inspector.tokenValue', { count: row.tokens })}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
