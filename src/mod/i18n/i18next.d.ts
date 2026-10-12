import type en from '../locales/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'mod'
    resources: { mod: typeof en }
  }
}
