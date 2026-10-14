import { t } from '../../i18n/modI18n'
import { MINIMUM_CLAUDE_CODE } from '../start/minimumVersion'
import type { PaneErrorCode } from './paneErrorCode'

/**
 * The fixed line for a failure, by its code. Never a message from the failure itself.
 *
 * @param code - The failure's code, or `null` for an unknown one.
 * @returns The line.
 */
export function errorLine(code: PaneErrorCode | null): string {
  return t(`pane.error.${code ?? 'internal'}`, { minimum: MINIMUM_CLAUDE_CODE })
}
