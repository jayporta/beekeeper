import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it } from 'vitest'
import { buildAppMenuTemplate } from '../appMenu'

const DEV_TOOL_ROLES = ['reload', 'forceReload', 'toggleDevTools']
const ZOOM_ROLES = ['zoomIn', 'zoomOut', 'resetZoom']
const PLATFORMS = ['darwin', 'linux', 'win32'] as const

/** Every item in the template, submenus included. */
function flatten(items: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => {
    const submenu = Array.isArray(item.submenu) ? item.submenu : []
    return [item, ...flatten(submenu)]
  })
}

function rolesOf(template: readonly MenuItemConstructorOptions[]): (string | undefined)[] {
  return flatten(template).map((item) => item.role)
}

describe('buildAppMenuTemplate', () => {
  describe.each(PLATFORMS)('on %s', (platform) => {
    it('has no reload or developer tools role when dev tools are off', () => {
      const roles = rolesOf(buildAppMenuTemplate({ platform, devTools: false }))

      for (const role of DEV_TOOL_ROLES) expect(roles).not.toContain(role)
    })

    it('has reload, force reload, and developer tools roles when dev tools are on', () => {
      const roles = rolesOf(buildAppMenuTemplate({ platform, devTools: true }))

      for (const role of DEV_TOOL_ROLES) expect(roles).toContain(role)
    })

    it.each([false, true])('has the zoom roles when devTools is %s', (devTools) => {
      const roles = rolesOf(buildAppMenuTemplate({ platform, devTools }))

      for (const role of ZOOM_ROLES) expect(roles).toContain(role)
    })

    it('has a hidden zoom in item bound to the key without Shift', () => {
      const items = flatten(buildAppMenuTemplate({ platform, devTools: false }))

      expect(
        items.some(
          (item) =>
            item.role === 'zoomIn' &&
            item.accelerator === 'CommandOrControl+=' &&
            item.visible === false
        )
      ).toBe(true)
    })

    it('has no item with a click handler', () => {
      const items = flatten(buildAppMenuTemplate({ platform, devTools: true }))

      expect(items.filter((item) => item.click !== undefined)).toEqual([])
    })

    it('has no Help menu', () => {
      const roles = rolesOf(buildAppMenuTemplate({ platform, devTools: true }))

      expect(roles).not.toContain('help')
    })
  })

  it('starts with the app menu on macOS', () => {
    const template = buildAppMenuTemplate({ platform: 'darwin', devTools: false })

    expect(rolesOf(template.slice(0, 1))).toEqual(
      expect.arrayContaining(['about', 'hide', 'hideOthers', 'unhide', 'quit'])
    )
  })

  it.each(['linux', 'win32'] as const)('starts with the file menu on %s', (platform) => {
    const [first] = buildAppMenuTemplate({ platform, devTools: false })

    expect(first?.role).toBe('fileMenu')
  })

  it.each(['linux', 'win32'] as const)('has no app menu items on %s', (platform) => {
    const roles = rolesOf(buildAppMenuTemplate({ platform, devTools: false }))

    for (const role of ['about', 'hide', 'hideOthers', 'unhide']) {
      expect(roles).not.toContain(role)
    }
  })
})
