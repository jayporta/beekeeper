import { Card } from '@renderer/components/Card'
import styles from './SessionDetailHeaderCard.module.css'

/** Props for {@link SessionDetailHeaderCard}. */
interface SessionDetailHeaderCardProps {
  /** The breadcrumb, which every state of the view shows. */
  readonly breadcrumb: React.ReactNode
  /**
   * The session's header content under the breadcrumb, once there is some.
   * @defaultValue Nothing: the card holds only the breadcrumb.
   */
  readonly children?: React.ReactNode
}

/**
 * The session detail's header card: the breadcrumb, and under it the header
 * content when the view has it. The card stays mounted as the view loads, so
 * the breadcrumb keeps its place and focus.
 *
 * @example
 * <SessionDetailHeaderCard breadcrumb={<SessionDetailBreadcrumb title="Refactor parser" lead={null} />} />
 */
export function SessionDetailHeaderCard({
  breadcrumb,
  children
}: SessionDetailHeaderCardProps): React.JSX.Element {
  return (
    <Card as="header" className={styles.card}>
      {breadcrumb}
      {children}
    </Card>
  )
}
