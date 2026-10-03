import { useTranslation } from 'react-i18next'
import { StatusMessage } from '@renderer/components/StatusMessage'

/**
 * Stands in for the all-projects overview until it is built.
 *
 * @example
 * <OverviewPlaceholder />
 */
export function OverviewPlaceholder(): React.JSX.Element {
  const { t } = useTranslation('navigation')
  return <StatusMessage heading={t('overview.heading')} body={t('overview.body')} />
}
