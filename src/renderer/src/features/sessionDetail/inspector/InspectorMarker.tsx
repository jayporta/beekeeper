import { useTranslation } from 'react-i18next'
import { PartialMarker } from '@renderer/components/PartialMarker'

/**
 * The marker after a partial figure in the inspector, whose spoken note sends
 * the reader to the inspector's footnote.
 *
 * @example
 * <p>3.1M tokens<InspectorMarker /></p>
 */
export function InspectorMarker(): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return <PartialMarker note={t('partial.note')} />
}
