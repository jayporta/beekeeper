import about from '@renderer/features/about/locales/en.json'
import firstRun from '@renderer/features/firstRun/locales/en.json'
import navigation from '@renderer/features/navigation/locales/en.json'
import overview from '@renderer/features/overview/locales/en.json'
import projects from '@renderer/features/projects/locales/en.json'
import sessionDetail from '@renderer/features/sessionDetail/locales/en.json'
import sessions from '@renderer/features/sessions/locales/en.json'
import common from './locales/en.json'

/** Every namespace's English strings, bundled with the app. */
export const resources = {
  en: { common, about, firstRun, navigation, overview, projects, sessionDetail, sessions }
} as const
