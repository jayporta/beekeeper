import firstRun from '@renderer/features/firstRun/locales/en.json'
import projects from '@renderer/features/projects/locales/en.json'
import sessions from '@renderer/features/sessions/locales/en.json'
import common from './locales/en.json'

/** Every namespace's English strings, bundled with the app. */
export const resources = { en: { common, firstRun, projects, sessions } } as const
