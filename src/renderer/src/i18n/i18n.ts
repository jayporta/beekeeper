import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { pickLanguage, SUPPORTED_LANGUAGES } from './pickLanguage'
import { resources } from './resources'

/**
 * The app's i18next instance, ready on import: resources are bundled, so it
 * initializes synchronously and never fetches.
 */
export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
  resources,
  lng: pickLanguage(navigator.language),
  fallbackLng: SUPPORTED_LANGUAGES[0],
  supportedLngs: SUPPORTED_LANGUAGES,
  nonExplicitSupportedLngs: true,
  defaultNS: 'common',
  ns: Object.keys(resources.en),
  initAsync: false,
  interpolation: { escapeValue: false }
})
