import { useId } from 'react'
import { Card } from '@renderer/components/Card'
import styles from './SummaryCard.module.css'

/** Props for {@link SummaryCard}. */
interface SummaryCardProps {
  /** The card's title, which names its region. */
  readonly title: string
  /** A muted caption on the title's right, such as what the card counts. */
  readonly caption: React.ReactNode
  /** The card's content. */
  readonly children: React.ReactNode
}

/**
 * One of the session detail's summary cards: a titled region with a muted
 * caption on the right of its title.
 *
 * @example
 * <SummaryCard title="Signals" caption="Tool errors">{rows}</SummaryCard>
 */
export function SummaryCard({ title, caption, children }: SummaryCardProps): React.JSX.Element {
  const titleId = useId()

  return (
    <Card as="section" labelledBy={titleId} className={styles.card}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <span className={styles.caption}>{caption}</span>
      </div>
      {children}
    </Card>
  )
}
