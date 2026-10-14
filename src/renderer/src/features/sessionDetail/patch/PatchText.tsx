import { useMemo } from 'react'
import styles from './PatchText.module.css'
import { patchRuns } from './patchRuns'

/** Props for {@link PatchText}. */
interface PatchTextProps {
  /** The patch text. Untrusted: it is rendered as plain text, never as markup. */
  readonly patch: string
}

/**
 * A patch as plain text in a `<pre>`, with each added or removed line colored
 * by its first character. The text wraps, so nothing scrolls sideways.
 *
 * @example
 * <PatchText patch={'@@ -1 +1 @@\n-old\n+new\n'} />
 */
export function PatchText({ patch }: PatchTextProps): React.JSX.Element {
  const runs = useMemo(() => patchRuns(patch), [patch])

  return (
    <pre className={styles.patch}>
      {runs.map((run, index) => (
        <span key={index} className={styles.run} data-kind={run.kind}>
          {run.text}
        </span>
      ))}
    </pre>
  )
}
