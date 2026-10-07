import { Component, createRef } from 'react'
import { Translation } from 'react-i18next'
import { StatusMessage } from '@renderer/components/StatusMessage'
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
 * with a Reload button instead of a blank window, inside a main landmark, and
 * focuses the button. The error's message and stack are never rendered or
 * logged here, or by the `createRoot` handlers, since they may hold
 * transcript content.
 * The app's only class component, because React has no hook for this.
 *
 * @example
 * <AppErrorBoundary><App /></AppErrorBoundary>
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  private readonly reloadButton = createRef<HTMLButtonElement>()

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidMount(): void {
    // An error during the first render commits the boundary already in its error state.
    if (this.state.hasError) this.focusReload()
  }

  componentDidUpdate(
    _previousProps: AppErrorBoundaryProps,
    previousState: AppErrorBoundaryState
  ): void {
    if (this.state.hasError && !previousState.hasError) this.focusReload()
  }

  /** The view just went blank, so put focus on the one action left. */
  private focusReload(): void {
    this.reloadButton.current?.focus()
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    const { onReload = reloadWindow } = this.props
    return (
      <main className={styles.main}>
        <Translation ns="common">
          {(t) => (
            <StatusMessage heading={t('error.heading')} role="alert">
              <p>{t('error.unexpected')}</p>
              <button
                ref={this.reloadButton}
                type="button"
                className={styles.button}
                onClick={onReload}
              >
                {t('error.reload')}
              </button>
            </StatusMessage>
          )}
        </Translation>
      </main>
    )
  }
}
