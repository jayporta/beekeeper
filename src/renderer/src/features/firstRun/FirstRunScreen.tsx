import { useEffect, useRef } from 'react'
import styles from './FirstRunScreen.module.css'
import { isMacOS } from './isMacOs'
import { useFirstRunStore } from './state/useFirstRunStore'

/**
 * The first-run view: what Beekeeper reads, that nothing leaves the
 * computer, and, on macOS, why it may ask for folder access. "Got it" dismisses it
 * and the choice persists. Takes focus on its heading when it appears, so a
 * screen reader announces the change of view.
 *
 * @example
 * <FirstRunScreen />
 */
export function FirstRunScreen(): React.JSX.Element {
  const dismiss = useFirstRunStore((state) => state.dismiss)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Welcome to Beekeeper
      </h1>

      <section className={styles.section} aria-labelledby="first-run-reads">
        <h2 id="first-run-reads" className={styles.heading}>
          What Beekeeper reads
        </h2>
        <p>
          Beekeeper reads the session files Claude Code writes under <code>~/.claude/projects</code>{' '}
          and shows what each agent did, changed, and cost. It only reads. It never writes to{' '}
          <code>~/.claude</code> or to your repositories.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="first-run-local">
        <h2 id="first-run-local" className={styles.heading}>
          Nothing leaves your computer
        </h2>
        <p>
          Beekeeper makes no network requests and sends no telemetry. Everything you see is worked
          out locally from those files.
        </p>
      </section>

      {isMacOS() && (
        <section className={styles.section} aria-labelledby="first-run-macos">
          <h2 id="first-run-macos" className={styles.heading}>
            Why macOS may ask for folder access
          </h2>
          <p>
            To show what an agent changed, Beekeeper runs read-only git commands in the repository a
            session worked in. When that is a worktree under a protected folder such as Documents,
            Desktop, or Downloads, macOS asks whether Beekeeper may access it. Allow it to see that
            worktree&apos;s changes. If you decline, Beekeeper hides those changes and everything
            else keeps working.
          </p>
        </section>
      )}

      <button type="button" className={styles.button} onClick={dismiss}>
        Got it
      </button>
    </div>
  )
}
