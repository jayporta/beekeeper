import { Component } from 'react'
import styles from './AppErrorBoundary.module.css'

/** Props for {@link AppErrorBoundary}. */
interface AppErrorBoundaryProps {
  /** The app subtree to guard. */
  readonly children: React.ReactNode
  /**
   * Called when the person presses Reload.
   * @defaultValue Reloads the window.
   */
  readonly onReload?: () => void
}

interface AppErrorBoundaryState {
  readonly hasError: boolean
}

function reloadWindow(): void {
  window.location.reload()
}

/**
 * Catches an error thrown while rendering the app and shows a plain message
 * with a Reload button instead of a blank window. The error's message and
 * stack are never rendered or logged, since they may hold transcript content.
 * The app's only class component, because React has no hook for this.
 *
 * @example
 * <AppErrorBoundary><App /></AppErrorBoundary>
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    const { onReload = reloadWindow } = this.props
    return (
      <div className={styles.fallback} role="alert">
        <h1 className={styles.heading}>Something went wrong</h1>
        <p>Beekeeper hit an unexpected error. Reload to try again.</p>
        <button type="button" className={styles.button} onClick={onReload}>
          Reload
        </button>
      </div>
    )
  }
}
