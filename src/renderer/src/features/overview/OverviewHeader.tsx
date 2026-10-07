import { useTranslation } from 'react-i18next'
import { CapsText } from '@renderer/components/CapsText'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { SegmentedControl } from '@renderer/components/SegmentedControl'
import styles from './OverviewHeader.module.css'
import { useTotalsWindowStore } from './state/useTotalsWindowStore'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'

/** The windows the control offers, in display order. */
const WINDOWS = ['7d', '30d'] as const satisfies readonly TotalsWindowDto[]

/**
 * The overview's header: a kicker that names the window, the view's heading,
 * and the control that switches the window between 7 and 30 days. The window
 * is shared with the sidebar's figures.
 *
 * @example
 * <OverviewHeader />
 */
export function OverviewHeader(): React.JSX.Element {
  const { t } = useTranslation('overview')
  const range = useTotalsWindowStore((state) => state.window)
  const setWindow = useTotalsWindowStore((state) => state.setWindow)

  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <CapsText accent>{t('kicker', { range: t(`range.${range}`) })}</CapsText>
        <h1 id={MAIN_HEADING_ID} className={styles.title}>
          {t('heading')}
        </h1>
      </div>
      <SegmentedControl
        label={t('window.label')}
        options={WINDOWS.map((value) => ({ value, label: t(`window.${value}`) }))}
        value={range}
        onChange={setWindow}
      />
    </header>
  )
}
