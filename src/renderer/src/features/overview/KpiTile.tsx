import { MutedText } from '@renderer/components/MutedText'
import styles from './KpiTile.module.css'

/** Which figure a tile shows, which picks its tint and dot. */
export type KpiKind = 'tokens' | 'api' | 'sessions' | 'agents'

/** The class of each kind's tint. */
const KIND_CLASSES = {
  tokens: styles.tokens,
  api: styles.api,
  sessions: styles.sessions,
  agents: styles.agents
} as const satisfies Record<KpiKind, string | undefined>

/** Props for {@link KpiTile}. */
interface KpiTileProps {
  /** Which figure the tile shows. */
  readonly kind: KpiKind
  /** The figure's name, beside its dot. */
  readonly label: string
  /** The figure: text, or a placeholder and any partial marker. */
  readonly children: React.ReactNode
  /** The line under the figure. */
  readonly sub: string
}

/**
 * One tinted tile of the overview's totals: a dot and label, the figure big,
 * and a line under it. It is a list item, so the tiles sit in a list.
 *
 * @example
 * <ul><KpiTile kind="sessions" label="Sessions" sub="leads and solo sessions">6</KpiTile></ul>
 */
export function KpiTile({ kind, label, children, sub }: KpiTileProps): React.JSX.Element {
  return (
    <li className={`${styles.tile} ${KIND_CLASSES[kind]}`}>
      <p className={styles.label}>
        <span aria-hidden="true" className={styles.dot} />
        {label}
      </p>
      <p className={styles.figure}>{children}</p>
      <MutedText className={styles.sub}>{sub}</MutedText>
    </li>
  )
}
