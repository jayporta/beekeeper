import type { i18n as I18n } from 'i18next'
import { SUPPORTED_LANGUAGES } from './pickLanguage'

/** Anything with a `format` method for a number, as `Intl.NumberFormat` and `Intl.DateTimeFormat` have. */
interface NumberFormatter {
  format(value: number): string
}

/**
 * Wraps a formatter factory so one formatter is built per language and reused.
 * i18next's built-in `number`, `currency`, and `datetime` formats key their
 * cache on every option, values included, so each distinct value would build
 * and keep its own `Intl` object.
 *
 * @param create - Builds the formatter for a language.
 * @returns An i18next format function for one value in one language.
 */
function cachedByLanguage(
  create: (language: string) => NumberFormatter
): (value: number, language: string | undefined) => string {
  const byLanguage = new Map<string, NumberFormatter>()
  return (value, language = SUPPORTED_LANGUAGES[0]) => {
    let formatter = byLanguage.get(language)
    if (formatter === undefined) {
      formatter = create(language)
      byLanguage.set(language, formatter)
    }
    return formatter.format(value)
  }
}

const FORMATS = {
  integer: cachedByLanguage(
    (language) => new Intl.NumberFormat(language, { maximumFractionDigits: 0 })
  ),
  compactInteger: cachedByLanguage(
    (language) => new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 })
  ),
  usd: cachedByLanguage(
    (language) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' })
  ),
  shortDateTime: cachedByLanguage(
    (language) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' })
  ),
  weekday: cachedByLanguage((language) => new Intl.DateTimeFormat(language, { weekday: 'short' })),
  monthDay: cachedByLanguage(
    (language) => new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' })
  )
}

/**
 * The names of the registered formats, for use as `{{value, name}}` in resource
 * strings. i18next matches format names case-insensitively.
 */
export const FORMAT_NAMES: readonly string[] = Object.keys(FORMATS)

/**
 * Registers Beekeeper's formats on an initialized i18next instance: `integer`
 * (a whole number with the language's grouping), `compactInteger` (a whole
 * number in short compact notation, such as 12.4M), `usd` (a US dollar amount),
 * `shortDateTime` (a medium date and a short time), `weekday` (a short weekday
 * name, such as Wed), and `monthDay` (a short month and the day, such as Oct 7).
 * Each builds one `Intl` object per language.
 *
 * @param instance - An instance that has finished `init`.
 * @throws {Error} When the instance has no formatter, because it has not been initialized.
 */
export function registerFormats(instance: I18n): void {
  const { formatter } = instance.services
  if (formatter === undefined) throw new Error('i18next must be initialized before registerFormats')
  for (const [name, format] of Object.entries(FORMATS)) formatter.add(name, format)
}
