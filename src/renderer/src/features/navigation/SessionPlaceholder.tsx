import { useTranslation } from 'react-i18next'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { Breadcrumb } from './Breadcrumb'
import { useNavigationStore } from './state/useNavigationStore'
import styles from './SessionPlaceholder.module.css'

/**
 * Stands in for the single-session view until it is built, with a breadcrumb
 * back to the sessions list.
 *
 * @example
 * <SessionPlaceholder />
 */
export function SessionPlaceholder(): React.JSX.Element {
  const { t } = useTranslation('navigation')
  const showSessions = useNavigationStore((state) => state.showSessions)

  return (
    <div className={styles.view}>
      <Breadcrumb
        segments={[
          { label: t('breadcrumb.sessions'), onSelect: showSessions },
          { label: t('session.heading') }
        ]}
      />
      <StatusMessage heading={t('session.heading')} body={t('session.body')} />
    </div>
  )
}
