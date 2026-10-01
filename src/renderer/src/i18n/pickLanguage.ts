/** The languages Beekeeper has resources for. The first is the fallback. */
export const SUPPORTED_LANGUAGES = ['en'] as const

const FALLBACK = SUPPORTED_LANGUAGES[0]

/**
 * Chooses the UI language from the browser's. A supported language keeps its
 * region, so `en-GB` formats dates the British way. An unsupported or invalid
 * tag falls back to English, so text and formatting never disagree.
 *
 * @param language - `navigator.language`.
 * @returns A canonical BCP 47 tag whose language Beekeeper supports.
 */
export function pickLanguage(language: string): string {
  let canonical: string | undefined
  try {
    canonical = Intl.getCanonicalLocales(language)[0]
  } catch {
    // An invalid tag throws a RangeError; it gets the fallback below.
  }
  if (canonical === undefined) return FALLBACK
  const base = new Intl.Locale(canonical).language
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? canonical : FALLBACK
}
