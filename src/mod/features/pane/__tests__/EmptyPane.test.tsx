import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { t } from '../../../i18n/modI18n'
import { EmptyPane } from '../EmptyPane'
import { installTestH, removeTestH, type TestNode } from '../testElements'

const Box = (): object => ({})
const Text = (): object => ({})

describe('EmptyPane', () => {
  beforeAll(installTestH)
  afterAll(removeTestH)

  it('draws one column box holding the pane title, then the empty-state text', () => {
    const tree = EmptyPane({ Box, Text }) as TestNode

    expect(tree.type).toBe(Box)
    expect(tree.props).toEqual({ flexDirection: 'column' })
    const lines = tree.children as TestNode[]
    expect(lines.map((line) => line.type)).toEqual([Text, Text])
    expect(lines.map((line) => line.children)).toEqual([[t('pane.title')], [t('pane.empty')]])
  })

  it('words the empty state as the locale says', () => {
    expect(t('pane.empty')).toBe('Nothing here yet.')
  })
})
