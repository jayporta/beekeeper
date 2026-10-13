import type { PluginState } from 'claude-code'
import { describe, expectTypeOf, it } from 'vitest'
import type { BeekeeperPaneView } from '../../../../../mod/types/index'
import type { PaneSelection } from '../Pane'
import type { PaneView } from '../paneView'

describe('the $.state contract', () => {
  it('describes the same view the pane builds', () => {
    expectTypeOf<PaneView>().toExtend<BeekeeperPaneView>()
    expectTypeOf<BeekeeperPaneView>().toExtend<PaneView>()
  })

  it('describes the same selection the pane stores', () => {
    type Stored = PluginState['beekeeper']['selected']
    expectTypeOf<PaneSelection | null>().toExtend<Stored>()
    expectTypeOf<Stored>().toExtend<PaneSelection | null>()
  })
})
