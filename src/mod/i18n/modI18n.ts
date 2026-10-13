import i18next from 'i18next'
import { registerFormats } from '../../shared/i18n/formats'
import en from '../locales/en.json'

const instance = i18next.createInstance()

void instance.init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['mod'],
  defaultNS: 'mod',
  resources: { en: { mod: en } },
  interpolation: { escapeValue: false },
  initAsync: false
})
registerFormats(instance)

/** Looks up a mod string in the `mod` namespace. */
export const t = instance.getFixedT('en', 'mod')
