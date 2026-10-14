import type { BaseWindow, MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { buildAppMenuTemplate } from '../appMenu'

const DEV_TOOL_ROLES = ['reload', 'forceReload', 'toggleDevTools']
const ZOOM_ROLES = ['zoomIn', 'zoomOut', 'resetZoom']
/** The menu has one branch for macOS and one for every other platform. */
const PLATFORMS = ['darwin', 'linux'] as const
const ABOUT_LABEL = 'About beekeeper'
const BACK_LABEL = 'Back'

/** Every item in the template, submenus included. */
function flatten(items: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => {
    const submenu = Array.isArray(item.submenu) ? item.submenu : []
    return [item, ...flatten(submenu)]
  })
}

/** The template for a platform, with spies as the About and Back handlers unless they are given. */
function build(
  platform: NodeJS.Platform,
  {
    devTools = false,
    onAbout = vi.fn(),
    onBack = vi.fn()
  }: {
    devTools?: boolean
    onAbout?: () => void
    onBack?: (window: BaseWindow | undefined) => void
  } = {}
): MenuItemConstructorOptions[] {
  return buildAppMenuTemplate({ platform, devTools, onAbout, onBack })
}

/** The View menu's Back item. */
function backItem(template: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
  const view = template.find((item) => item.label === 'View')
  const items = Array.isArray(view?.submenu) ? view.submenu : []
  const item = items.find((candidate) => candidate.label === BACK_LABEL)
  if (item === undefined) throw new Error('the View menu has no Back item')
  return item
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

    it('has no item with a click handler besides About and Back', () => {
      const items = flatten(build(platform, { devTools: true }))

      const others = items.filter(
        (item) =>
          item.click !== undefined && item.label !== ABOUT_LABEL && item.label !== BACK_LABEL
      )

      expect(others).toEqual([])
    })

    it('has a Back item in the View menu bound to Cmd or Ctrl and [', () => {
      const item = backItem(build(platform))

      expect(item.accelerator).toBe('CommandOrControl+[')
    })

    it('keeps the Back item visible and enabled, since the renderer decides whether there is anywhere to go', () => {
      const item = backItem(build(platform))

      expect(item.visible).not.toBe(false)
      expect(item.enabled).not.toBe(false)
    })

    it('hands the window the Back item was chosen in to onBack', () => {
      const onBack = vi.fn()
      const chosenIn = {} as BaseWindow

      backItem(build(platform, { onBack })).click?.(
        undefined as never,
        chosenIn,
        undefined as never
      )

      expect(onBack).toHaveBeenCalledExactlyOnceWith(chosenIn)
    })

    it('hands onBack no window when the Back item is chosen with none open', () => {
      const onBack = vi.fn()

      backItem(build(platform, { onBack })).click?.(
        undefined as never,
        undefined,
        undefined as never
      )

      expect(onBack).toHaveBeenCalledExactlyOnceWith(undefined)
    })

    it('does not call onAbout when Back is chosen', () => {
      const onAbout = vi.fn()

      backItem(build(platform, { onAbout })).click?.(
        undefined as never,
        undefined,
        undefined as never
      )

      expect(onAbout).not.toHaveBeenCalled()
    })

    it('does not call onBack when About is chosen', () => {
      const onBack = vi.fn()
      const help = build(platform, { onBack }).find((item) => item.role === 'help')
      const about = Array.isArray(help?.submenu) ? help.submenu[0] : undefined

      about?.click?.(undefined as never, undefined, undefined as never)

      expect(onBack).not.toHaveBeenCalled()
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

  it('starts with the file menu elsewhere', () => {
    const [first] = build('linux')

    expect(first?.role).toBe('fileMenu')
  })

  it('has no app menu items elsewhere', () => {
    const roles = rolesOf(build('linux'))

    for (const role of ['hide', 'hideOthers', 'unhide']) {
      expect(roles).not.toContain(role)
    }
  })
})
