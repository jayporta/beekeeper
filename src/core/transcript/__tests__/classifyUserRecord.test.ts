import { describe, expect, it } from 'vitest'
import { classifyUserRecord } from '../classifyUserRecord'

const user = (extra: Record<string, unknown> = {}, content: unknown = 'hello'): unknown => ({
  type: 'user',
  message: { role: 'user', content },
  ...extra
})

const textBlock = (text: string): Record<string, unknown> => ({ type: 'text', text })
const toolResult = (id = 'toolu_01'): Record<string, unknown> => ({
  type: 'tool_result',
  tool_use_id: id,
  content: 'ok'
})

describe('classifyUserRecord: origin signals', () => {
  it('gives human when turnOrigin and origin.kind agree on human', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'human', origin: { kind: 'human' } }))).toEqual({
      kind: 'human'
    })
  })

  it('gives teammate-message when turnOrigin and origin.kind agree on peer', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'peer', origin: { kind: 'peer' } }))).toEqual({
      kind: 'teammate-message'
    })
  })

  it('classifies turnOrigin task_notification with an underscore', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'task_notification' })).kind).toBe(
      'task-notification'
    )
  })

  it('classifies origin.kind task-notification with a hyphen', () => {
    expect(classifyUserRecord(user({ origin: { kind: 'task-notification' } })).kind).toBe(
      'task-notification'
    )
  })

  it('classifies turnOrigin auto_continuation with an underscore', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'auto_continuation' })).kind).toBe(
      'auto-continuation'
    )
  })

  it('classifies origin.kind auto-continuation with a hyphen', () => {
    expect(classifyUserRecord(user({ origin: { kind: 'auto-continuation' } })).kind).toBe(
      'auto-continuation'
    )
  })

  it('does not accept the wrong spelling in either field', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'task-notification' })).kind).toBe('unknown')
    expect(classifyUserRecord(user({ origin: { kind: 'task_notification' } })).kind).toBe('unknown')
  })

  it('gives unknown for an unrecognized turnOrigin, without reaching the prefix checks', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'sdk' }, '<task-notification>')).kind).toBe(
      'unknown'
    )
  })

  it('gives unknown for an unrecognized origin.kind, without reaching the prefix checks', () => {
    expect(
      classifyUserRecord(user({ origin: { kind: 'coordinator' } }, '<task-notification>')).kind
    ).toBe('unknown')
  })

  it('gives unknown for a turnOrigin that is not a string', () => {
    expect(classifyUserRecord(user({ turnOrigin: 7 })).kind).toBe('unknown')
  })

  it('lets turnOrigin win when it disagrees with origin.kind', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'human', origin: { kind: 'peer' } })).kind).toBe(
      'human'
    )
  })

  it('lets origin win over a tool result', () => {
    expect(classifyUserRecord(user({ origin: { kind: 'human' } }, [toolResult()])).kind).toBe(
      'human'
    )
  })

  it('ignores an origin that is not an object', () => {
    expect(classifyUserRecord(user({ origin: 'peer' })).kind).toBe('human')
  })

  it('falls through when origin has no kind', () => {
    expect(classifyUserRecord(user({ origin: {} }, [toolResult()])).kind).toBe('tool-result')
  })
})

describe('classifyUserRecord: peer records', () => {
  it('gives teammate-message for origin.kind peer without handback', () => {
    expect(classifyUserRecord(user({ origin: { kind: 'peer' } }))).toEqual({
      kind: 'teammate-message'
    })
  })

  it('gives teammate-message when handback is not exactly true', () => {
    expect(classifyUserRecord(user({ origin: { kind: 'peer', handback: 'true' } })).kind).toBe(
      'teammate-message'
    )
  })

  it('gives subagent-handback for origin.kind peer with handback', () => {
    expect(classifyUserRecord(user({ origin: { kind: 'peer', handback: true } })).kind).toBe(
      'subagent-handback'
    )
  })

  it('gives subagent-handback for turnOrigin peer when origin carries handback', () => {
    expect(
      classifyUserRecord(user({ turnOrigin: 'peer', origin: { kind: 'peer', handback: true } }))
        .kind
    ).toBe('subagent-handback')
  })

  it('gives teammate-message for turnOrigin peer with no origin', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'peer' })).kind).toBe('teammate-message')
  })

  it('gives subagent-handback for turnOrigin peer when only origin carries handback', () => {
    expect(classifyUserRecord(user({ turnOrigin: 'peer', origin: { handback: true } })).kind).toBe(
      'subagent-handback'
    )
  })

  it('carries from and senderTaskId on a hand-back', () => {
    const origin = { kind: 'peer', handback: true, from: 'a1', senderTaskId: 'a2', body: 'x' }
    expect(classifyUserRecord(user({ origin }))).toEqual({
      kind: 'subagent-handback',
      from: 'a1',
      senderTaskId: 'a2'
    })
  })

  it('omits from and senderTaskId when absent, mistyped, or over the cap', () => {
    const origin = { kind: 'peer', handback: true, from: 5, senderTaskId: 'x'.repeat(257) }
    expect(classifyUserRecord(user({ origin }))).toEqual({ kind: 'subagent-handback' })
  })
})

describe('classifyUserRecord: tool results', () => {
  it('classifies a record with a tool_result block', () => {
    expect(classifyUserRecord(user({}, [toolResult()])).kind).toBe('tool-result')
  })

  it('classifies a tool_result mixed with a text block', () => {
    expect(classifyUserRecord(user({}, [textBlock('note'), toolResult()])).kind).toBe('tool-result')
  })

  it('classifies a record whose toolUseResult is a string', () => {
    expect(classifyUserRecord(user({ toolUseResult: 'Error: nope' })).kind).toBe('tool-result')
  })

  it('classifies a record whose toolUseResult is a list', () => {
    expect(classifyUserRecord(user({ toolUseResult: [{ a: 1 }] })).kind).toBe('tool-result')
  })

  it('classifies a record whose toolUseResult is an object', () => {
    expect(classifyUserRecord(user({ toolUseResult: { stdout: '' } })).kind).toBe('tool-result')
  })

  it('treats a tool_result block without an id as a tool result', () => {
    expect(classifyUserRecord(user({}, [{ type: 'tool_result' }])).kind).toBe('tool-result')
  })

  it('lets a tool result win over isMeta', () => {
    expect(classifyUserRecord(user({ isMeta: true }, [toolResult()])).kind).toBe('tool-result')
  })
})

describe('classifyUserRecord: meta records', () => {
  it('classifies isMeta true', () => {
    expect(classifyUserRecord(user({ isMeta: true })).kind).toBe('meta')
  })

  it('classifies isCompactSummary true', () => {
    expect(classifyUserRecord(user({ isCompactSummary: true })).kind).toBe('meta')
  })

  it('does not treat a truthy non-boolean isMeta as meta', () => {
    expect(classifyUserRecord(user({ isMeta: 'true' })).kind).toBe('human')
  })

  it('lets isMeta win over a content prefix', () => {
    expect(classifyUserRecord(user({ isMeta: true }, '<task-notification>')).kind).toBe('meta')
  })
})

describe('classifyUserRecord: content prefixes', () => {
  const asString = (text: string): unknown => user({}, text)
  const asBlocks = (text: string): unknown => user({}, [textBlock(text)])

  it.each([
    ['string', asString],
    ['block', asBlocks]
  ] as const)('classifies a <task-notification> prefix on %s content', (_label, build) => {
    expect(classifyUserRecord(build('<task-notification>\n<task-id>a</task-id>'))).toEqual({
      kind: 'task-notification'
    })
  })

  it.each([
    ['string', asString],
    ['block', asBlocks]
  ] as const)('classifies the relay prefix on %s content', (_label, build) => {
    expect(classifyUserRecord(build('Another Claude session sent a message: hi')).kind).toBe(
      'teammate-message'
    )
  })

  it('classifies the relay prefix as a hand-back when origin.handback is true', () => {
    expect(
      classifyUserRecord(
        user({ origin: { handback: true } }, 'Another Claude session sent a message')
      ).kind
    ).toBe('subagent-handback')
  })

  it.each([
    ['string', asString],
    ['block', asBlocks]
  ] as const)('classifies local-command stdout on %s content as meta', (_label, build) => {
    expect(classifyUserRecord(build('<local-command-stdout>ok</local-command-stdout>')).kind).toBe(
      'meta'
    )
  })

  it.each([
    ['string', asString],
    ['block', asBlocks]
  ] as const)('classifies an interrupt marker on %s content as meta', (_label, build) => {
    expect(classifyUserRecord(build('[Request interrupted by user]')).kind).toBe('meta')
  })

  it('keeps a prefix that is not at the start as human', () => {
    expect(classifyUserRecord(asString('see <task-notification> here')).kind).toBe('human')
    expect(classifyUserRecord(asString(' <task-notification>')).kind).toBe('human')
    expect(classifyUserRecord(asString('x [Request interrupted')).kind).toBe('human')
  })

  it('reads the first text block, skipping non-text blocks before it', () => {
    const record = user({}, [{ type: 'image' }, textBlock('<task-notification>')])
    expect(classifyUserRecord(record).kind).toBe('task-notification')
  })

  it('ignores prefixes in text blocks after the first', () => {
    const record = user({}, [textBlock('hi'), textBlock('<task-notification>')])
    expect(classifyUserRecord(record).kind).toBe('human')
  })

  it('keeps a slash-command record as human', () => {
    expect(classifyUserRecord(asString('<command-name>/clear</command-name>')).kind).toBe('human')
  })
})

describe('classifyUserRecord: task-notification tool-use id', () => {
  const note = (id: string): unknown =>
    user({}, `<task-notification>\n<tool-use-id>${id}</tool-use-id>\n<summary>secret</summary>`)

  it('carries a valid tool-use id and nothing else from the content', () => {
    expect(classifyUserRecord(note('toolu_015aJj3B3P5u3uGS5PUhnYpm'))).toEqual({
      kind: 'task-notification',
      toolUseId: 'toolu_015aJj3B3P5u3uGS5PUhnYpm'
    })
  })

  it('carries the id when the classification comes from origin', () => {
    const record = user({ origin: { kind: 'task-notification' } }, [
      textBlock('<task-notification><tool-use-id>toolu_x1</tool-use-id>')
    ])
    expect(classifyUserRecord(record)).toEqual({
      kind: 'task-notification',
      toolUseId: 'toolu_x1'
    })
  })

  it('omits the id when the tag is missing', () => {
    expect(classifyUserRecord(user({}, '<task-notification>')).kind).toBe('task-notification')
    expect(classifyUserRecord(user({}, '<task-notification>'))).not.toHaveProperty('toolUseId')
  })

  it('omits an id that is not tool-use id shaped', () => {
    expect(classifyUserRecord(note('not an id; drop table'))).toEqual({
      kind: 'task-notification'
    })
  })

  it('omits an id over the cap', () => {
    expect(classifyUserRecord(note(`toolu_${'a'.repeat(300)}`))).toEqual({
      kind: 'task-notification'
    })
  })
})

describe('classifyUserRecord: humans and malformed input', () => {
  it('gives human for a plain prompt with no origin fields, as on an old version', () => {
    expect(classifyUserRecord(user())).toEqual({ kind: 'human' })
  })

  it('gives human for block content with only text', () => {
    expect(classifyUserRecord(user({}, [textBlock('fix the bug')])).kind).toBe('human')
  })

  it('gives human when the message is missing', () => {
    expect(classifyUserRecord({ type: 'user' }).kind).toBe('human')
  })

  it.each([
    ['null', null],
    ['an array', [{ type: 'user' }]],
    ['a string', 'user'],
    ['a number', 3],
    ['undefined', undefined],
    ['an assistant record', { type: 'assistant', message: { content: [] } }],
    ['a record with no type', { message: { content: 'hi' } }]
  ])('gives unknown for %s', (_label, value) => {
    expect(classifyUserRecord(value)).toEqual({ kind: 'unknown' })
  })

  it('does not throw on odd content shapes', () => {
    expect(classifyUserRecord(user({}, null)).kind).toBe('human')
    expect(classifyUserRecord(user({}, [null, 3, 'x', { type: 'text' }])).kind).toBe('human')
    expect(classifyUserRecord({ type: 'user', message: 'x' }).kind).toBe('human')
  })

  it('tolerates unknown extra fields', () => {
    expect(classifyUserRecord(user({ futureField: { a: 1 } })).kind).toBe('human')
  })
})
