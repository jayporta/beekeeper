import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { buildAppMenuTemplate } from '../appMenu'

const DEV_TOOL_ROLES = ['reload', 'forceReload', 'toggleDevTools']
const ZOOM_ROLES = ['zoomIn', 'zoomOut', 'resetZoom']
const PLATFORMS = ['darwin', 'linux', 'win32'] as const
const ABOUT_LABEL = 'About beekeeper'

/** Every item in the template, submenus included. */
function flatten(items: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => {
    const submenu = Array.isArray(item.submenu) ? item.submenu : []
    return [item, ...flatten(submenu)]
  })
}

/** The template for a platform, with a spy as the About handler unless one is given. */
function build(
  platform: NodeJS.Platform,
  { devTools = false, onAbout = vi.fn() }: { devTools?: boolean; onAbout?: () => void } = {}
): MenuItemConstructorOptions[] {
  return buildAppMenuTemplate({ platform, devTools, onAbout })
}

function rolesOf(template: readonly MenuItemConstructorOptions[]): (string | undefined)[] {
  return flatten(template).map((item) => item.role)
}

describe('buildAppMenuTemplate', () => {
  describe.each(PLATFORMS)('on %s', (platform) => {
    it('has no reload or developer tools role when dev tools are off', () => {
      const roles = rolesOf(build(platform))

      for (const role of DEV_TOOL_ROLES) expect(roles).not.toContain(role)
    })

    it('has reload, force reload, and developer tools roles when dev tools are on', () => {
      const roles = rolesOf(build(platform, { devTools: true }))

      for (const role of DEV_TOOL_ROLES) expect(roles).toContain(role)
    })

    it.each([false, true])('has the zoom roles when devTools is %s', (devTools) => {
      const roles = rolesOf(build(platform, { devTools }))

      for (const role of ZOOM_ROLES) expect(roles).toContain(role)
    })

    it('has a hidden zoom in item bound to the key without Shift', () => {
      const items = flatten(build(platform))

      expect(
        items.some(
          (item) =>
            item.role === 'zoomIn' &&
            item.accelerator === 'CommandOrControl+=' &&
            item.visible === false
        )
      ).toBe(true)
    })

    it('has no item with a click handler besides About', () => {
      const items = flatten(build(platform, { devTools: true }))

      const others = items.filter((item) => item.click !== undefined && item.label !== ABOUT_LABEL)

      expect(others).toEqual([])
    })

    it('has a file menu', () => {
      const template = build(platform)

      expect(template.map((item) => item.role)).toContain('fileMenu')
    })

    it('has a Help menu holding an About item', () => {
      const help = build(platform).find((item) => item.role === 'help')
      const submenu = Array.isArray(help?.submenu) ? help.submenu : []

      expect(submenu.map((item) => item.label)).toEqual([ABOUT_LABEL])
    })

    it('calls onAbout when the Help menu About item is clicked', () => {
      const onAbout = vi.fn()
      const help = build(platform, { onAbout }).find((item) => item.role === 'help')
      const item = Array.isArray(help?.submenu) ? help.submenu[0] : undefined

      item?.click?.(undefined as never, undefined, undefined as never)

      expect(onAbout).toHaveBeenCalledTimes(1)
    })

    it('puts the Help menu last', () => {
      const template = build(platform)

      expect(template.at(-1)?.role).toBe('help')
    })
  })

  it('starts with the app menu on macOS', () => {
    const template = build('darwin')

    expect(rolesOf(template.slice(0, 1))).toEqual(
      expect.arrayContaining(['hide', 'hideOthers', 'unhide', 'quit'])
    )
  })

  it('labels the macOS app menu in lowercase', () => {
    expect(build('darwin')[0]?.label).toBe('beekeeper')
  })

  it('opens the macOS app menu with an About item that calls onAbout', () => {
    const onAbout = vi.fn()
    const appMenu = build('darwin', { onAbout })[0]
    const first = Array.isArray(appMenu?.submenu) ? appMenu.submenu[0] : undefined

    first?.click?.(undefined as never, undefined, undefined as never)

    expect(first?.label).toBe(ABOUT_LABEL)
    expect(onAbout).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['hide', 'Hide beekeeper'],
    ['quit', 'Quit beekeeper']
  ])(
    'labels the macOS %s item explicitly, since its role would use the bundle name',
    (role, label) => {
      const appMenu = build('darwin')[0]
      const items = Array.isArray(appMenu?.submenu) ? appMenu.submenu : []

      expect(items.find((item) => item.role === role)?.label).toBe(label)
    }
  )

  it('has no built-in about role on macOS', () => {
    expect(rolesOf(build('darwin'))).not.toContain('about')
  })

  it('puts the file menu right after the app menu on macOS', () => {
    const template = build('darwin')

    expect(template[1]?.role).toBe('fileMenu')
  })

  it.each(['linux', 'win32'] as const)('starts with the file menu on %s', (platform) => {
    const [first] = build(platform)

    expect(first?.role).toBe('fileMenu')
  })

  it.each(['linux', 'win32'] as const)('has no app menu items on %s', (platform) => {
    const roles = rolesOf(build(platform))

    for (const role of ['hide', 'hideOthers', 'unhide']) {
      expect(roles).not.toContain(role)
    }
  })
})
