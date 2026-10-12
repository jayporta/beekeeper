import type { Engine, Register } from 'claude-code'
import { EmptyPane, t, type ModHost } from './lib.js'

const PANE_ID = 'beekeeper'

/** The mod's only `$` calls, as closures lib can use without seeing `$`. */
export function hostOf($: Engine): ModHost {
  return { version: () => $.session.version() }
}

/** Registers the mod's hooks with the engine. */
export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (e.isInteractive) {
      await $.command.register({ name: 'beekeeper', description: t('command.description') })
    }
    return started
  }).catch(($, e, next) => next(e))
  on('command.run', { command: 'beekeeper' }, async ($) => {
    await $.ui.open({ id: PANE_ID, title: t('pane.title') })
    return { text: t('command.opened') }
  })
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) =>
    EmptyPane($.ui.resolve(e))
  )
}
