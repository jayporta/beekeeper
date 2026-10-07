import type { AgentMarkKind } from './agentMarks'
import styles from './AgentMark.module.css'

/** Props for {@link AgentMark}. */
interface AgentMarkProps {
  /** What the mark stands for. */
  readonly kind: AgentMarkKind
}

/**
 * One mark of the agent strip and its legend: a filled square for a lead, a
 * solid outlined square for a teammate, a double-bordered square for a
 * workflow run, and a smaller dashed square for a subagent. It is decorative, so it has no text of its own.
 *
 * @example
 * <AgentMark kind="teammate" />
 */
export function AgentMark({ kind }: AgentMarkProps): React.JSX.Element {
  return <span data-kind={kind} className={styles[kind]} />
}
