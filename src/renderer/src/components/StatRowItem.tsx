import { PartialMarker } from './PartialMarker'

/** Props for {@link StatRowItem}. */
interface StatRowItemProps {
  /** What the figure is. */
  readonly label: string
  /** The figure, as text. */
  readonly children: React.ReactNode
  /**
   * The spoken note that sends the reader to the footnote, when the figure may be low.
   * @defaultValue No marker.
   */
  readonly partialNote?: string
}

/**
 * One label and figure of the stat row. A partial figure carries the marker
 * that points at the row's footnote.
 *
 * @example
 * <StatRow><StatRowItem label="Sessions">12</StatRowItem></StatRow>
 */
export function StatRowItem({ label, children, partialNote }: StatRowItemProps): React.JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {children}
        {partialNote !== undefined && <PartialMarker note={partialNote} />}
      </dd>
    </div>
  )
}
