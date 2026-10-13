import { describe, expectTypeOf, it } from 'vitest'
import type { BeekeeperPaneView } from '../../../../../mod/types/index'
import type { PaneView } from '../paneView'

describe('the $.state contract', () => {
  it('describes the same view the pane builds', () => {
    expectTypeOf<PaneView>().toExtend<BeekeeperPaneView>()
    expectTypeOf<BeekeeperPaneView>().toExtend<PaneView>()
  })
})
