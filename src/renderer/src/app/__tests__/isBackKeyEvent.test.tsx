import { afterEach, describe, expect, it } from 'vitest'
import { isBackKeyEvent } from '../isBackKeyEvent'

const added: Element[] = []

afterEach(() => {
  for (const element of added.splice(0)) element.remove()
})

/** Adds an element to the page, so a key event can be dispatched on it and bubble. */
function add(tag: string, attributes: Record<string, string> = {}): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  document.body.append(element)
  added.push(element)
  return element
}

/** Options for {@link decide}. */
interface DecideOptions {
  /** Event fields that replace the Alt+Left defaults. */
  readonly init?: KeyboardEventInit
  /** Cancels the event before the check, as a handler that already used the key would. */
  readonly prevented?: boolean
}

/** What {@link isBackKeyEvent} says about a keydown dispatched on `target`, asked while the event is in flight. */
function decide(target: Element, { init = {}, prevented = false }: DecideOptions = {}): boolean {
  let answer = false
  const listener = (event: KeyboardEvent): void => {
    answer = isBackKeyEvent(event)
  }
  if (prevented) {
    target.addEventListener('keydown', (event) => {
      event.preventDefault()
    })
  }
  document.addEventListener('keydown', listener)
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      altKey: true,
      bubbles: true,
      cancelable: true,
      ...init
    })
  )
  document.removeEventListener('keydown', listener)
  return answer
}

describe('isBackKeyEvent', () => {
  it('accepts Alt and the left arrow pressed on the page', () => {
    expect(decide(document.body)).toBe(true)
  })

  it('accepts it pressed on a button, which does not use the arrow keys', () => {
    expect(decide(add('button'))).toBe(true)
  })

  it.each([
    ['without Alt', { altKey: false }],
    ['with the right arrow', { key: 'ArrowRight' }],
    ['with Shift', { shiftKey: true }],
    ['with Control', { ctrlKey: true }],
    ['with Command or the Windows key', { metaKey: true }],
    ['as a key repeat', { repeat: true }]
  ])('rejects it %s', (_name, init) => {
    expect(decide(document.body, { init })).toBe(false)
  })

  it('rejects an event something already handled and cancelled', () => {
    expect(decide(add('button'), { prevented: true })).toBe(false)
  })

  it.each([
    ['an input', () => add('input', { type: 'search' })],
    ['a checkbox input', () => add('input', { type: 'checkbox' })],
    ['a textarea', () => add('textarea')],
    ['a select', () => add('select')],
    ['an editable element', () => add('div', { contenteditable: 'true' })],
    ['an editable element with an empty attribute', () => add('div', { contenteditable: '' })],
    ['a plaintext-only editable element', () => add('div', { contenteditable: 'plaintext-only' })],
    ['the sidebar resizer, which steps with the arrow keys', () => add('hr', { tabindex: '0' })]
  ])('rejects it pressed in %s, where the key belongs to that control', (_name, create) => {
    expect(decide(create())).toBe(false)
  })

  it.each([
    'slider',
    'spinbutton',
    'listbox',
    'tablist',
    'grid',
    'tree',
    'treegrid',
    'menu',
    'menubar',
    'radiogroup',
    'combobox',
    'textbox',
    'searchbox'
  ])('rejects it pressed in a custom %s, which moves with the arrow keys', (role) => {
    expect(decide(add('div', { role, tabindex: '0' }))).toBe(false)
  })

  it('rejects it pressed in an item inside a widget that uses the arrow keys', () => {
    const listbox = add('div', { role: 'listbox' })
    const option = document.createElement('div')
    option.setAttribute('role', 'option')
    listbox.append(option)

    expect(decide(option)).toBe(false)
  })

  it.each(['region', 'group', 'dialog', 'img'])(
    'accepts it pressed in an element with the %s role, which does not use the arrow keys',
    (role) => {
      expect(decide(add('div', { role, tabindex: '0' }))).toBe(true)
    }
  )

  it('rejects it pressed in an element inside an editable one', () => {
    const editable = add('div', { contenteditable: 'true' })
    const inner = document.createElement('span')
    editable.append(inner)

    expect(decide(inner)).toBe(false)
  })

  it('accepts it pressed in an element that opts out of editing', () => {
    expect(decide(add('div', { contenteditable: 'false' }))).toBe(true)
  })
})
