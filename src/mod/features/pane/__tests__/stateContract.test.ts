import type { PluginState } from 'claude-code'
import { describe, expectTypeOf, it } from 'vitest'
import type {
  BeekeeperBrowseView,
  BeekeeperDiffs,
  BeekeeperNav,
  BeekeeperPaneView
} from '../../../../../mod/types/index'
import type { PaneSelection } from '../Pane'
import type { PaneDiffs } from '../../diffs/paneDiffs'
import type { BrowseView } from '../../browse/browseView'
import type { PaneNav } from '../../shared/paneNav'
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

  it('describes the same browse view the pane builds', () => {
    expectTypeOf<BrowseView>().toExtend<BeekeeperBrowseView>()
    expectTypeOf<BeekeeperBrowseView>().toExtend<BrowseView>()
  })

  it('describes the same worktree diff the pane builds', () => {
    expectTypeOf<PaneDiffs>().toExtend<BeekeeperDiffs>()
    expectTypeOf<BeekeeperDiffs>().toExtend<PaneDiffs>()
  })

  it('describes the same nav the pane reads', () => {
    expectTypeOf<PaneNav>().toExtend<BeekeeperNav>()
    expectTypeOf<BeekeeperNav>().toExtend<PaneNav>()
  })

  it("keeps the nav and browse views under the mod's state", () => {
    expectTypeOf<PluginState['beekeeper']['nav']>().toExtend<BeekeeperNav | undefined>()
    expectTypeOf<PluginState['beekeeper']['browse']>().toExtend<BeekeeperBrowseView | undefined>()
    expectTypeOf<PluginState['beekeeper']['diffs']>().toExtend<BeekeeperDiffs | undefined>()
  })
})
