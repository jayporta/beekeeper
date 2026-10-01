import type { SessionsT } from './sessionsT'

/**
 * Formats a token count in short compact notation in the active language.
 *
 * @param tokens - The count, or `null` when unknown.
 * @param t - The sessions translate function, which supplies the compact format.
 * @returns For example `12.4M tokens`, or `null` when `tokens` is `null`.
 */
export function formatTokens(tokens: number | null, t: SessionsT): string | null {
  return tokens === null ? null : t('tokens', { value: tokens })
}
