import { describe, expect, it } from 'vitest'
import { MOD_ALLOWLIST } from '../modCallAllowlist.mjs'
import { findViolations, parseValidateReport } from '../modCalls.mjs'

/** A `claude plugin validate --json` report with one hooks module, built from the notes the test gives. */
function report(
  notes: string[],
  overrides: {
    success?: boolean
    manifestErrors?: unknown[]
    errors?: unknown[]
    gatingHooks?: unknown[]
  } = {}
): unknown {
  return {
    success: overrides.success ?? true,
    manifest: { errors: overrides.manifestErrors ?? [], warnings: [], notes: [], gatingHooks: [] },
    contents: [
      {
        file: '/mod/hooks/hooks.json',
        errors: overrides.errors ?? [],
        warnings: [],
        notes,
        gatingHooks: overrides.gatingHooks ?? []
      }
    ]
  }
}

const CLEAN_NOTES = ['./register.js hooks: session.start', './register.js calls: $.ui.open']

describe('parseValidateReport', () => {
  it('lists the calls on one line, dropping the via-host marker', () => {
    const parsed = parseValidateReport(
      report(['./register.js calls: $.fs.read (via hostOf), $.ui.open'])
    )

    expect(parsed.calls).toEqual(['$.fs.read', '$.ui.open'])
  })

  it('keeps the calls apart when a via marker names several functions', () => {
    const parsed = parseValidateReport(
      report(['./register.js calls: $.env.get (via gitRepoVariablesSet, hostOf), $.ui.open'])
    )

    expect(parsed.calls).toEqual(['$.env.get', '$.ui.open'])
  })

  it('reads "nothing on $" as no calls', () => {
    expect(parseValidateReport(report(['./register.js calls: nothing on $'])).calls).toEqual([])
  })

  it('reads env reads and writes', () => {
    const parsed = parseValidateReport(
      report([
        './register.js calls: $.env.get, $.env.set',
        './register.js env writes: FOO',
        './register.js env reads: GIT_DIR, HOME'
      ])
    )

    expect(parsed.envReads).toEqual(['GIT_DIR', 'HOME'])
    expect(parsed.envWrites).toEqual(['FOO'])
  })

  it('reads env reads of "nothing" as none', () => {
    const parsed = parseValidateReport(
      report(['./register.js calls: $.ui.open', './register.js env reads: nothing'])
    )

    expect(parsed.envReads).toEqual([])
  })

  it('reads a missing env or state line as none, since validate omits it', () => {
    const parsed = parseValidateReport(report(CLEAN_NOTES))

    expect(parsed.envReads).toEqual([])
    expect(parsed.envWrites).toEqual([])
    expect(parsed.stateWrites).toEqual([])
  })

  it('reads state writes', () => {
    const parsed = parseValidateReport(
      report(['./register.js calls: $.state.set', './register.js state writes: pane.title'])
    )

    expect(parsed.stateWrites).toEqual(['pane.title'])
  })

  it('accepts a gating hook that has a .catch, which gatingHooks reports', () => {
    const parsed = parseValidateReport(
      report([...CLEAN_NOTES, './register.js gating hook with .catch: agent.spawn'])
    )

    expect(parsed.uncaughtGates).toEqual([])
  })

  it('reads state reads', () => {
    const parsed = parseValidateReport(
      report(['./register.js calls: $.state.get', './register.js state reads: beekeeper.view'])
    )

    expect(parsed.stateReads).toEqual(['beekeeper.view'])
  })

  it('reads state reads of "nothing" as none', () => {
    const parsed = parseValidateReport(
      report(['./register.js calls: $.ui.open', './register.js state reads: nothing'])
    )

    expect(parsed.stateReads).toEqual([])
  })

  it('throws on a note it does not recognize, so a renamed label cannot hide a call', () => {
    expect(() =>
      parseValidateReport(report([...CLEAN_NOTES, './register.js environment reads: HOME']))
    ).toThrow(/Unexpected validate note/)
  })

  it('accepts every kind of note validate prints for the mod', () => {
    const parsed = parseValidateReport(
      report([
        './register.js hooks: session.start, command.run{command=beekeeper}',
        './register.js answers its own command: command.run{command=beekeeper}',
        './register.js gating hook without .catch: command.run{command=beekeeper}',
        './register.js calls: $.ui.open'
      ])
    )

    expect(parsed.calls).toEqual(['$.ui.open'])
  })

  it('throws when no calls line exists, so a format change cannot pass silently', () => {
    expect(() => parseValidateReport(report(['./register.js hooks: session.start']))).toThrow(
      /calls/
    )
  })

  it('lists gating hooks that have no catch', () => {
    const parsed = parseValidateReport(
      report(CLEAN_NOTES, {
        gatingHooks: [
          { module: './register.js', pattern: 'tool.call', hook: 'tool.call', hasCatch: false },
          {
            module: './register.js',
            pattern: 'session.start',
            hook: 'session.start',
            hasCatch: true
          }
        ]
      })
    )

    expect(parsed.uncaughtGates).toEqual(['./register.js tool.call'])
  })

  it('collects the errors of the manifest and the contents', () => {
    const parsed = parseValidateReport(
      report(CLEAN_NOTES, {
        success: false,
        manifestErrors: [{ path: 'name', message: 'bad name' }],
        errors: ['hooks.json is wrong']
      })
    )

    expect(parsed.errors).toEqual(expect.arrayContaining(['name: bad name', 'hooks.json is wrong']))
  })

  it('reports success false even with no error entries', () => {
    expect(parseValidateReport(report(CLEAN_NOTES, { success: false })).errors).toHaveLength(1)
  })

  it.each([
    ['an empty object', {}],
    ['null', null],
    ['a string', 'ok'],
    ['contents that is not an array', { success: true, manifest: { errors: [] }, contents: {} }],
    ['a missing manifest', { success: true, contents: [] }],
    [
      'notes that are not strings',
      {
        success: true,
        manifest: { errors: [] },
        contents: [{ errors: [], notes: [1], gatingHooks: [] }]
      }
    ]
  ])('throws on a report that is %s', (_name, input) => {
    expect(() => parseValidateReport(input)).toThrow(/validate report/)
  })
})

describe('findViolations', () => {
  const clean = (): ReturnType<typeof parseValidateReport> =>
    parseValidateReport(report(CLEAN_NOTES))

  it('finds none in a clean report', () => {
    expect(findViolations(clean(), MOD_ALLOWLIST)).toEqual([])
  })

  it('names a call outside the allowlist', () => {
    const violations = findViolations(
      { ...clean(), calls: ['$.ui.open', '$.store.set'] },
      MOD_ALLOWLIST
    )

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('$.store.set')
  })

  it('names an env write', () => {
    const violations = findViolations({ ...clean(), envWrites: ['FOO'] }, MOD_ALLOWLIST)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('FOO')
  })

  it('names a state write outside the allowlist', () => {
    const violations = findViolations({ ...clean(), stateWrites: ['pane.title'] }, MOD_ALLOWLIST)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('pane.title')
  })

  it("allows a write to the mod's own state key", () => {
    expect(findViolations({ ...clean(), stateWrites: ['beekeeper.view'] }, MOD_ALLOWLIST)).toEqual(
      []
    )
  })

  it('names a state read outside the allowlist', () => {
    const violations = findViolations({ ...clean(), stateReads: ['other.key'] }, MOD_ALLOWLIST)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('other.key')
  })

  it("allows a read of the mod's own state key", () => {
    expect(findViolations({ ...clean(), stateReads: ['beekeeper.view'] }, MOD_ALLOWLIST)).toEqual(
      []
    )
  })

  it('names an env read outside the allowlist', () => {
    const violations = findViolations(
      { ...clean(), envReads: ['HOME', 'ANTHROPIC_API_KEY'] },
      MOD_ALLOWLIST
    )

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('ANTHROPIC_API_KEY')
  })

  it('names the module and hook of a gating hook without a catch', () => {
    const violations = findViolations(
      { ...clean(), uncaughtGates: ['./register.js tool.call'] },
      MOD_ALLOWLIST
    )

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('./register.js tool.call')
  })

  it('lists every validate error', () => {
    const violations = findViolations({ ...clean(), errors: ['one', 'two'] }, MOD_ALLOWLIST)

    expect(violations.join('\n')).toContain('one')
    expect(violations.join('\n')).toContain('two')
  })

  it('allows the calls and env reads the mod is meant to make', () => {
    const parsed = {
      ...clean(),
      calls: ['$.session.version', '$.process.spawn', '$.fs.stat'],
      envReads: ['HOME', 'CLAUDE_CONFIG_DIR', 'GIT_DIR']
    }

    expect(findViolations(parsed, MOD_ALLOWLIST)).toEqual([])
  })

  it('refuses the calls that would break the promises', () => {
    const banned = ['$.http.fetch', '$.fs.write', '$.model.ask', '$.env.set', '$.store.set']
    const violations = findViolations({ ...clean(), calls: banned }, MOD_ALLOWLIST)

    expect(violations).toHaveLength(banned.length)
  })
})
